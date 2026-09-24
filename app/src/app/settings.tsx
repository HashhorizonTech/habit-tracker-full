import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isPlaySubscription, plusSummary } from '@/components/plus/format';
import { PlusPill } from '@/components/plus/PlusPill';
import { MODE_OPTIONS, SettingsCard, SettingsGroup, SettingsRow, ThemeSwatch } from '@/components/settings';
import { DeleteAccountSheet } from '@/components/account/DeleteAccountSheet';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { APP_NAME } from '@/lib/brand';
import { manageSubscription, restore } from '@/lib/billing';
import { exportData } from '@/lib/exportData';
import { FREE_THEMES, isAmbientLocked, openPaywall, restDaysFor } from '@/lib/plusFeatures';
import { applyStreakProtection } from '@/lib/streakProtection';
import { useAppearance } from '@/store/appearance';
import { useData } from '@/store/data';
import { usePlus } from '@/store/plus';
import { usePrefs, type Ambient, type Prefs } from '@/store/prefs';
import { toast, useUI } from '@/store/ui';
import { THEME_IDS, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const AMBIENTS: Ambient[] = ['Off', 'Rain', 'Café', 'Forest', 'Brown noise'];
const WEEK_OPTIONS: { value: Prefs['weekStart']; label: string }[] = [
  { value: 'Mon', label: 'Mon' },
  { value: 'Sun', label: 'Sun' },
];

type ExportFormat = 'csv' | 'json';

async function restorePurchases() {
  const r = await restore();
  if (r.kind === 'restored') toast(r.status.active ? 'Purchases restored. Welcome back to Plus.' : 'Purchases restored.', 'sparkle');
  else if (r.kind === 'none') toast('No Plus purchases found on this Google account.', 'sparkle');
  else toast(r.message, 'sparkle');
}

function setStreakProtection(enabled: boolean) {
  const { profile, updateProfile } = useData.getState();
  updateProfile({ streakProtection: { ...profile.streakProtection, enabled } });
  if (enabled) applyStreakProtection();
}

/** "CSV · JSON" — each format is its own tap target. */
function ExportFormats({ busy, onExport }: { busy: boolean; onExport: (f: ExportFormat) => void }) {
  const { c } = useTheme();
  const fmt = (f: ExportFormat, label: string) => (
    <Pressable
      onPress={() => onExport(f)}
      disabled={busy}
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Export all data as ${label}`}
      accessibilityState={{ disabled: busy, busy }}
      style={({ pressed }) => ({ opacity: pressed || busy ? 0.5 : 1 })}
    >
      <Text style={[styles.value, { color: c.ink3 }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.formats}>
      {fmt('csv', 'CSV')}
      <Text style={[styles.value, { color: c.ink3 }]} accessible={false}>
        {' · '}
      </Text>
      {fmt('json', 'JSON')}
    </View>
  );
}

export default function SettingsScreen() {
  const { name } = useTheme();
  const mode = useAppearance((s) => s.mode);
  const setMode = useAppearance((s) => s.setMode);
  const autoBreak = usePrefs((s) => s.autoBreak);
  const sound = usePrefs((s) => s.sound);
  const ambient = usePrefs((s) => s.ambient);
  const haptics = usePrefs((s) => s.haptics);
  const weekStart = usePrefs((s) => s.weekStart);
  const lock = usePrefs((s) => s.lock);
  const setPref = usePrefs((s) => s.setPref);
  const streakOn = useData((s) => s.profile.streakProtection.enabled);
  const [exporting, setExporting] = useState(false);
  const { active: plus, status } = usePlus();
  const moreThemes = THEME_IDS.length - FREE_THEMES.length;

  const onExport = async (format: ExportFormat) => {
    if (exporting) return;
    setExporting(true);
    // exportData reports success / failure itself with a toast.
    try {
      await exportData(format);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" back />
      <View style={styles.body}>
        <SettingsGroup title="Subscription">
          <SettingsRow
            title={`${APP_NAME} Plus`}
            sub={plus ? plusSummary(status) : 'Free plan · Try Plus for more room to grow'}
            icon="sparkle"
            onPress={() => openPaywall('settings')}
            accessibilityHint="Opens Plus"
          />
          {plus && isPlaySubscription(status) && (
            <SettingsRow title="Manage subscription" onPress={manageSubscription} accessibilityHint="Opens Google Play" />
          )}
          <SettingsRow title="Restore purchases" trailingIcon="reset" onPress={restorePurchases} />
        </SettingsGroup>

        <SettingsGroup title="Appearance" card={false}>
          <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} size="sm" label="Appearance mode" />
          <SettingsCard>
            <SettingsRow
              title="Color theme"
              sub={plus ? undefined : `${moreThemes} more with Plus`}
              value={name}
              leading={<ThemeSwatch />}
              onPress={() => router.push('/themes')}
              accessibilityHint="Opens the theme selector"
            />
          </SettingsCard>
        </SettingsGroup>

        <SettingsGroup title="Focus">
          <SettingsRow
            title="Auto-start breaks"
            sub="Roll straight into your break"
            toggle={{ value: autoBreak, onChange: (v) => setPref('autoBreak', v) }}
          />
          <SettingsRow title="Completion sounds" toggle={{ value: sound, onChange: (v) => setPref('sound', v) }} />
          <SettingsRow
            title="Ambient sound"
            right={plus ? undefined : <PlusPill />}
            below={
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Ambient sound">
                {AMBIENTS.map((a) => {
                  const locked = isAmbientLocked(a, plus);
                  return (
                    <Chip
                      key={a}
                      label={a}
                      icon={locked ? 'sparkle' : undefined}
                      selected={ambient === a}
                      onPress={() => (locked ? openPaywall('ambient') : setPref('ambient', a))}
                    />
                  );
                })}
              </View>
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Habits">
          <SettingsRow
            title="Streak protection"
            sub={`Rest days never break a streak · ${restDaysFor(plus)} a month`}
            toggle={{ value: streakOn, onChange: setStreakProtection }}
          />
          <SettingsRow title="Haptic feedback" toggle={{ value: haptics, onChange: (v) => setPref('haptics', v) }} />
          <SettingsRow
            title="Week starts on"
            style={styles.weekRow}
            right={
              <Segmented
                options={WEEK_OPTIONS}
                value={weekStart}
                onChange={(v) => setPref('weekStart', v)}
                size="sm"
                label="Week starts on"
                style={styles.week}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Privacy & data">
          <SettingsRow title="Lock with Face ID" toggle={{ value: lock, onChange: (v) => setPref('lock', v) }} />
          {plus ? (
            <SettingsRow title="Export all data" right={<ExportFormats busy={exporting} onExport={onExport} />} />
          ) : (
            <SettingsRow
              title="Export all data"
              right={<PlusPill />}
              onPress={() => openPaywall('export')}
              accessibilityHint="Data export is part of Plus"
            />
          )}
          <SettingsRow title="Notifications" onPress={() => router.push('/notifications')} />
          <SettingsRow
            title="Replay onboarding"
            trailingIcon="reset"
            onPress={() => router.push('/onboarding' as Href)}
            accessibilityHint="Shows the welcome steps again"
          />
          <SettingsRow
            title="Delete account"
            sub="Permanently remove your account and data"
            onPress={() => useUI.getState().openSheet((close) => <DeleteAccountSheet close={close} />, 'Delete account')}
          />
        </SettingsGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 22, width: '100%', maxWidth: 640 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekRow: { paddingVertical: 10, paddingRight: 10 },
  week: { width: 116 },
  formats: { flexDirection: 'row', alignItems: 'center' },
  value: { fontFamily: fonts.body500, fontSize: 14 },
});
