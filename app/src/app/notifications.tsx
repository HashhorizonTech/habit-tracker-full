import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/icons/Icon';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { ensurePermission, initNotifications } from '@/lib/notifications';
import { rescheduleReminders } from '@/lib/reminders';
import { useNotificationPrefs, type NotifTone, type NotifType } from '@/store/notificationPrefs';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { mix } from '@/theme/palette';
import { fonts, space } from '@/theme/tokens';

const MAX_WIDTH = 640;

const PREVIEW: Record<NotifTone, { title: string; body: string }> = {
  gentle: { title: 'A little nudge', body: 'Your water habit is waiting whenever you are — 6 of 8 glasses so far.' },
  facts: { title: 'Drink water', body: 'Drink water · 2 glasses left today.' },
};

const TONES: { value: NotifTone; label: string }[] = [
  { value: 'gentle', label: 'Gentle nudges' },
  { value: 'facts', label: 'Just the facts' },
];

const ROWS: { id: NotifType; icon: IconName; title: string; desc: string; time: string }[] = [
  { id: 'habit', icon: 'bell', title: 'Habit reminders', desc: 'At each habit’s reminder time', time: 'Per habit' },
  { id: 'focus', icon: 'focus', title: 'Focus reminder', desc: 'When your usual focus window starts', time: '9:00 AM' },
  { id: 'summary', icon: 'moon', title: 'Daily summary', desc: 'Your day, wrapped up', time: '9:00 PM' },
  { id: 'streak', icon: 'flame', title: 'Streak reminder', desc: 'Only if a streak is still open late', time: '8:00 PM' },
  { id: 'morning', icon: 'sun', title: 'Morning motivation', desc: 'One gentle line to start the day', time: '7:30 AM' },
  { id: 'evening', icon: 'pen', title: 'Evening reflection', desc: 'A quiet prompt to journal', time: '10:00 PM' },
];

/** Asks for OS permission when a switch turns on; toasts if the system has it blocked. */
async function requestAccess() {
  await initNotifications();
  const granted = await ensurePermission();
  if (!granted) toast('Notifications are off in system settings', 'bell');
  else void rescheduleReminders();
}

function PreviewBubble({ tone }: { tone: NotifTone }) {
  const { c } = useTheme();
  const p = PREVIEW[tone];
  return (
    <View
      // Opaque: a translucent card with elevation shows the shadow through it on Android.
      style={[styles.bubble, { backgroundColor: mix(c.surface2, c.bg, 0.8), borderColor: c.line, shadowColor: '#000' }]}
      accessible
      accessibilityLabel={`Preview notification. ${p.title}. ${p.body}`}
    >
      <LinearGradient colors={[c.a2, c.a1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.appIcon}>
        <Text style={{ fontFamily: fonts.display800, fontSize: 16, lineHeight: 20, color: c.a1ink }}>t</Text>
      </LinearGradient>
      <Animated.View key={tone} entering={FadeIn.duration(280)} style={styles.bubbleText}>
        <View style={styles.bubbleHead}>
          <Text style={{ fontFamily: fonts.body700, fontSize: 14, lineHeight: 19, flexShrink: 1 }} numberOfLines={1}>
            {p.title}
          </Text>
          <Text color="ink3" style={{ fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17 }}>
            now
          </Text>
        </View>
        <Text color="ink2" style={{ fontFamily: fonts.body400, fontSize: 14, lineHeight: 19.5 }}>
          {p.body}
        </Text>
      </Animated.View>
    </View>
  );
}

function TypeRow({ row, on, enabled }: { row: (typeof ROWS)[number]; on: boolean; enabled: boolean }) {
  const { c } = useTheme();
  const setType = useNotificationPrefs((s) => s.setType);
  const op = useSharedValue(enabled ? 1 : 0.45);
  useEffect(() => {
    op.set(withTiming(enabled ? 1 : 0.45, { duration: 300 }));
  }, [enabled, op]);
  const dim = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View style={[styles.row, { borderBottomColor: c.line }, dim]}>
      <View style={[styles.rowIcon, { backgroundColor: c.surface2 }]}>
        <Icon name={row.icon} size={19} color={c.ink2} />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyStrong">{row.title}</Text>
        <Text color="ink3" style={styles.sub}>{`${row.desc} · ${row.time}`}</Text>
      </View>
      <View pointerEvents={enabled ? 'auto' : 'none'} accessibilityElementsHidden={!enabled} importantForAccessibility={enabled ? 'auto' : 'no-hide-descendants'}>
        <Toggle
          value={on && enabled}
          label={`${row.title}, ${row.time}`}
          onChange={(v) => {
            setType(row.id, v);
            if (v) void requestAccess();
          }}
        />
      </View>
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const { c } = useTheme();
  const enabled = useNotificationPrefs((s) => s.enabled);
  const tone = useNotificationPrefs((s) => s.tone);
  const types = useNotificationPrefs((s) => s.types);
  const setEnabled = useNotificationPrefs((s) => s.setEnabled);
  const setTone = useNotificationPrefs((s) => s.setTone);

  return (
    <Screen>
      <ScreenHeader title="Notifications" back />
      <View style={styles.col}>
        <PreviewBubble tone={tone} />

        <View style={{ gap: 10 }}>
          <Text variant="caption" color="ink3">
            Tone of voice
          </Text>
          <Segmented options={TONES} value={tone} onChange={setTone} label="Tone of voice" />
        </View>

        <View style={[styles.master, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={styles.rowText}>
            <Text style={{ fontFamily: fonts.body700, fontSize: 15, lineHeight: 21 }}>Allow notifications</Text>
            <Text color="ink3" style={styles.sub}>
              Quiet hours 10 PM – 7 AM
            </Text>
          </View>
          <Toggle
            value={enabled}
            label="Allow notifications"
            onChange={(v) => {
              setEnabled(v);
              if (v) void requestAccess();
            }}
          />
        </View>

        <View>
          {ROWS.map((row) => (
            <TypeRow key={row.id} row={row} on={types[row.id]} enabled={enabled} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  col: { gap: space[5], width: '100%', maxWidth: MAX_WIDTH },
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  appIcon: { width: 38, height: 38, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bubbleText: { flex: 1, gap: 2 },
  bubbleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
  master: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: space[4], borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  sub: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 17 },
});
