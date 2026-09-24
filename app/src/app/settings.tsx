import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MODE_OPTIONS, SettingsCard, SettingsGroup, SettingsRow, ThemeSwatch } from '@/components/settings';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { exportData } from '@/lib/exportData';
import { applyStreakProtection } from '@/lib/streakProtection';
import { useAppearance } from '@/store/appearance';
import { useData } from '@/store/data';
import { usePrefs, type Ambient, type Prefs } from '@/store/prefs';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const AMBIENTS: Ambient[] = ['Off', 'Rain', 'Café', 'Forest', 'Brown noise'];
const WEEK_OPTIONS: { value: Prefs['weekStart']; label: string }[] = [
  { value: 'Mon', label: 'Mon' },
  { value: 'Sun', label: 'Sun' },
];

type ExportFormat = 'csv' | 'json';

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
        <SettingsGroup title="Appearance" card={false}>
          <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} size="sm" label="Appearance mode" />
          <SettingsCard>
            <SettingsRow
              title="Color theme"
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
            below={
              <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Ambient sound">
                {AMBIENTS.map((a) => (
                  <Chip key={a} label={a} selected={ambient === a} onPress={() => setPref('ambient', a)} />
                ))}
              </View>
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Habits">
          <SettingsRow
            title="Streak protection"
            sub="Rest days never break a streak"
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
          <SettingsRow title="Export all data" right={<ExportFormats busy={exporting} onExport={onExport} />} />
          <SettingsRow title="Notifications" onPress={() => router.push('/notifications')} />
          <SettingsRow
            title="Replay onboarding"
            trailingIcon="reset"
            onPress={() => router.push('/onboarding' as Href)}
            accessibilityHint="Shows the welcome steps again"
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
