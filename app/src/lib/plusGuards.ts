// Keeps local preferences inside what the account includes. If Plus ends (expired,
// refunded, revoked) the app falls back gently: only settings that are now locked change.
import { useEffect } from 'react';
import { useAuth } from '@/api/auth';
import { FALLBACK_THEME, FREE_AMBIENT, isAmbientLocked, isPresetLocked, isThemeLocked } from '@/lib/plusFeatures';
import { applyStreakProtection } from '@/lib/streakProtection';
import { useAppearance } from '@/store/appearance';
import { useFocus } from '@/store/focus';
import { isActive, usePlus, usePlusStore } from '@/store/plus';
import { usePrefs } from '@/store/prefs';

/** Longest delay setTimeout accepts (~24.8 days). */
const MAX_TIMEOUT = 2 ** 31 - 1;

/** Mount once at the root. */
export function usePlusGuards() {
  const { active, status } = usePlus();
  const userId = useAuth((s) => s.user?.id ?? null);
  // Only downgrade once the server has answered for this account, so a reinstall or a
  // cold offline start never wipes a Plus user's theme before their status loads.
  const verified = usePlusStore((s) => s.verified && s.userId === userId);
  const themeId = useAppearance((s) => s.themeId);
  const ambient = usePrefs((s) => s.ambient);
  const preset = useFocus((s) => s.preset);
  const timerIdle = useFocus((s) => s.status === 'idle');

  useEffect(() => {
    if (!verified || active) return;
    if (isThemeLocked(themeId, false)) useAppearance.getState().setTheme(FALLBACK_THEME);
    if (isAmbientLocked(ambient, false)) usePrefs.getState().setPref('ambient', FREE_AMBIENT);
    // Never interrupt a session that's already running.
    if (timerIdle && isPresetLocked(preset, false)) useFocus.getState().setPreset(0);
  }, [verified, active, themeId, ambient, preset, timerIdle]);

  // Rest days per month depend on Plus.
  useEffect(() => {
    applyStreakProtection();
  }, [active]);

  // Re-evaluate exactly when a cached status runs out, even if the app stays open.
  const expiresAt = status.expiresAt;
  useEffect(() => {
    if (expiresAt == null) return;
    const ms = expiresAt - Date.now();
    if (ms <= 0 || !isActive(usePlusStore.getState().status, Date.now())) return;
    const id = setTimeout(() => {
      usePlusStore.getState().tick();
      void usePlusStore.getState().refresh();
    }, Math.min(ms + 1_000, MAX_TIMEOUT));
    return () => clearTimeout(id);
  }, [expiresAt]);
}
