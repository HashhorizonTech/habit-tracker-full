// Mirrors device preferences (theme, mode, focus/habit prefs) into Profile so they
// sync with the account, and applies them when they arrive from another device.
import type { Prefs } from '@/store/prefs';
import { usePrefs } from '@/store/prefs';
import { useAppearance } from '@/store/appearance';
import { useData } from '@/store/data';
import type { Mode, ThemeId } from '@/theme/palette';
import { THEME_IDS } from '@/theme/palette';

const PREF_KEYS: (keyof Prefs)[] = ['haptics', 'sound', 'autoBreak', 'ambient', 'weekStart', 'lock'];

const localPrefs = (): Prefs => {
  const p = usePrefs.getState();
  return Object.fromEntries(PREF_KEYS.map((k) => [k, p[k]])) as unknown as Prefs;
};

const same = (a: Record<string, unknown>, b: Record<string, unknown>) => PREF_KEYS.every((k) => a[k] === b[k]);

let applying = false;

function pushLocal() {
  if (applying) return;
  const { profile, updateProfile, ownerId, lastSyncedAt } = useData.getState();
  // Never stamp the profile before this account's server copy has been downloaded,
  // or a blank local profile would win last-write-wins and wipe XP.
  if (!ownerId || lastSyncedAt == null) return;
  const { themeId, mode } = useAppearance.getState();
  const prefs = localPrefs();
  if (profile.themeId === themeId && profile.mode === mode && same(profile.prefs, prefs as unknown as Record<string, unknown>)) return;
  updateProfile({ themeId, mode, prefs: { ...profile.prefs, ...prefs } });
}

function applyRemote() {
  const { profile } = useData.getState();
  if (!profile.updatedAt) return;
  applying = true;
  try {
    const a = useAppearance.getState();
    if (THEME_IDS.includes(profile.themeId as ThemeId) && profile.themeId !== a.themeId) a.setTheme(profile.themeId);
    if (['light', 'dark', 'system'].includes(profile.mode) && profile.mode !== a.mode) a.setMode(profile.mode as Mode);
    const p = usePrefs.getState();
    for (const k of PREF_KEYS) {
      const v = profile.prefs[k];
      if (v !== undefined && v !== p[k]) p.setPref(k, v as never);
    }
  } finally {
    applying = false;
  }
}

let started = false;

/** Call once after stores hydrate. */
export function startPrefsSync() {
  if (started) return;
  started = true;
  // A profile that already carries prefs (another device, or a fresh sign-in) wins once.
  if (Object.keys(useData.getState().profile.prefs).length) applyRemote();
  else pushLocal();
  usePrefs.subscribe(pushLocal);
  useAppearance.subscribe(pushLocal);
  useData.subscribe((s, prev) => {
    // First download for this account: adopt its prefs, or seed them if it has none.
    if (prev.lastSyncedAt == null && s.lastSyncedAt != null) {
      if (Object.keys(s.profile.prefs).length) applyRemote();
      else pushLocal();
      return;
    }
    // Only react to profiles that came from sync (not our own local writes).
    if (s.profile !== prev.profile && s.profileDirty === prev.profileDirty && s.profile.updatedAt > prev.profile.updatedAt) applyRemote();
  });
}
