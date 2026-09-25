import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/api/auth';
import { BadgeCoin } from '@/components/achievements/BadgeCoin';
import { Avatar } from '@/components/home/Avatar';
import { Icon, type IconName } from '@/components/icons/Icon';
import { isPlaySubscription, plusSummary } from '@/components/plus/format';
import { PlusPill } from '@/components/plus/PlusPill';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MONTHS } from '@/data/dates';
import { liveHabits, overallStreak } from '@/data/selectors';
import { openStreak } from '@/lib/actions';
import { badgeById, badgeProgress } from '@/lib/badges';
import { manageSubscription } from '@/lib/billing';
import { APP_NAME } from '@/lib/brand';
import { loadDemoData } from '@/lib/demo';
import { exportData } from '@/lib/exportData';
import { openPaywall } from '@/lib/plusFeatures';
import { levelInfo } from '@/lib/xp';
import { useData } from '@/store/data';
import { usePlus } from '@/store/plus';
import { useSocial } from '@/store/social';
import { toast, useUI } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

/** "Tending since March 2026" (current month when unknown). */
function sinceLabel(ms: number | null) {
  const d = ms ? new Date(ms) : new Date();
  return `Tending since ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function Group({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>{children}</View>;
}

function Row({ icon, label, value, onPress, last, chevron = true, danger, plusLocked }: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
  chevron?: boolean;
  danger?: boolean;
  /** Part of Plus: shows the Plus pill instead of the value. */
  plusLocked?: boolean;
}) {
  const { c, fixed } = useTheme();
  const tint = danger ? fixed.priority.high : c.ink;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={plusLocked ? `${label}, Plus` : value ? `${label}, ${value}` : label}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}
    >
      <Icon name={icon} size={20} color={danger ? tint : c.ink2} />
      <Text style={{ flex: 1, fontFamily: fonts.body600, fontSize: 15, color: tint }}>{label}</Text>
      {plusLocked ? <PlusPill /> : value && <Text style={{ fontSize: 14 }} color="ink3">{value}</Text>}
      {chevron && <Icon name="chev" size={18} color={c.ink3} />}
    </PressableScale>
  );
}

/** Near the top of Profile: a gentle "Try Plus" row, or the current plan with Manage. */
function PlusCard() {
  const { c } = useTheme();
  const { active, status } = usePlus();
  if (!active) {
    return (
      <PressableScale
        onPress={() => openPaywall('profile')}
        scaleTo={0.98}
        accessibilityLabel={`Try ${APP_NAME} Plus. Unlimited habits, every theme and more.`}
        style={[styles.plus, { backgroundColor: c.a1soft }]}
      >
        <View style={[styles.plusTile, { backgroundColor: c.a1 }]}>
          <Icon name="sparkle" size={20} color={c.a1ink} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="bodyStrong">Try Plus</Text>
          <Text variant="small" color="ink2">Unlimited habits, every theme and more.</Text>
        </View>
        <Icon name="chev" size={18} color={c.a1text} />
      </PressableScale>
    );
  }
  const play = isPlaySubscription(status);
  return (
    <View style={[styles.plus, { backgroundColor: c.a1soft }]}>
      <PressableScale
        onPress={() => openPaywall('profile')}
        scaleTo={0.98}
        accessibilityLabel={plusSummary(status)}
        style={styles.plusMain}
      >
        <View style={[styles.plusTile, { backgroundColor: c.a1 }]}>
          <Icon name="sparkle" size={20} color={c.a1ink} />
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>{plusSummary(status)}</Text>
      </PressableScale>
      {play && (
        <PressableScale onPress={manageSubscription} accessibilityLabel="Manage subscription" hitSlop={8} style={[styles.manage, { backgroundColor: c.surface }]}>
          <Text style={{ fontFamily: fonts.body700, fontSize: 13 }}>Manage</Text>
        </PressableScale>
      )}
    </View>
  );
}

/** Friends entry: count and unread, or the invite offer when there are none yet. */
function FriendsCard() {
  const { c } = useTheme();
  const friends = useSocial((s) => s.friends.length);
  const unread = useSocial((s) => s.unreadCount);
  const sub = friends
    ? `${friends} ${friends === 1 ? 'friend' : 'friends'}${unread ? ` · ${unread} new` : ''}`
    : `Invite friends — you both get 7 days of Plus${unread ? ` · ${unread} new` : ''}`;
  return (
    <PressableScale
      onPress={() => router.push('/friends')}
      scaleTo={0.98}
      accessibilityLabel={`Friends. ${sub}`}
      style={[styles.friends, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <View style={[styles.plusTile, { backgroundColor: c.a2soft }]}>
        <Icon name="users" size={20} color={c.ink} />
        {unread > 0 && <View style={[styles.friendsDot, { backgroundColor: c.a1, borderColor: c.surface }]} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong">Friends</Text>
        <Text variant="small" color="ink2" numberOfLines={2}>{sub}</Text>
      </View>
      <Icon name="chev" size={18} color={c.ink3} />
    </PressableScale>
  );
}

function ExportSheet({ close }: { close: () => void }) {
  const run = (f: 'csv' | 'json') => {
    close();
    void exportData(f);
  };
  return (
    <View style={{ gap: 12 }}>
      <Text variant="h2">Export data</Text>
      <Text color="ink2">Everything you’ve tracked, synced from your account.</Text>
      <Button label="CSV · spreadsheet" icon="download" onPress={() => run('csv')} />
      <Button label="JSON · full backup" icon="download" variant="secondary" onPress={() => run('json')} />
    </View>
  );
}

/** Profile (SPEC §4.15). */
export default function YouScreen() {
  const { c } = useTheme();
  const profile = useData((s) => s.profile);
  const habitsMap = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const sessions = useData((s) => s.focusSessions);
  const signOut = useAuth((s) => s.signOut);
  const { active: plus } = usePlus();
  const user = useAuth((s) => s.user);
  const themeName = useTheme().name;
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));

  const xp = levelInfo(profile.xp);
  const name = profile.name || user?.name || 'You';

  const stats = useMemo(() => {
    const habits = liveHabits(habitsMap);
    const streak = overallStreak(habits, logs, { restDays: profile.streakProtection.restDays }).current;
    const live = new Set(habits.map((h) => h.id));
    const goal = new Map(habits.map((h) => [h.id, h.goal]));
    let done = 0;
    for (const l of Object.values(logs)) if (!l.deleted && live.has(l.habitId) && l.count >= (goal.get(l.habitId) ?? 1)) done++;
    let minutes = 0;
    for (const s of Object.values(sessions)) if (!s.deleted && s.completed && s.mode === 'focus') minutes += s.minutes;
    return { streak, done, hours: Math.round(minutes / 60) };
  }, [habitsMap, logs, sessions, profile.streakProtection.restDays]);

  const badges = useMemo(() => {
    void tick;
    return badgeProgress(useData.getState()).filter((b) => b.unlocked);
  }, [tick]);

  const since = sinceLabel(profile.onboardedAt ?? (user?.createdAt ? new Date(user.createdAt).getTime() : null));

  return (
    <Screen tab contentStyle={{ maxWidth: 640 + 64 }}>
      <View style={styles.header}>
        <Text variant="h1" accessibilityRole="header">You</Text>
        <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <View style={styles.hero}>
        <View>
          <Avatar name={name} progress={xp.progress} size={88} ring={4} />
          <View style={[styles.lv, { backgroundColor: c.ink, borderColor: c.bg }]}>
            <Text style={{ fontFamily: fonts.body700, fontSize: 12, color: c.bg }}>Lv {xp.level}</Text>
          </View>
        </View>
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={{ fontFamily: fonts.display700, fontSize: 26, letterSpacing: -0.5 }} numberOfLines={1}>{name}</Text>
          <Text color="ink2">{xp.title}</Text>
          <Text variant="small" color="ink3">{since}</Text>
        </View>
      </View>

      <PlusCard />
      <FriendsCard />

      <View style={[styles.stats, { borderColor: c.line }]}>
        <PressableScale onPress={openStreak} style={styles.stat} accessibilityLabel={`${stats.streak} day current streak. Opens streak details`}>
          <Text style={styles.statNum} tabular>{stats.streak}d</Text>
          <Text variant="small" color="ink3">Current streak</Text>
        </PressableScale>
        <View style={styles.stat} accessible accessibilityLabel={`${stats.done} habits done`}>
          <Text style={styles.statNum} tabular>{stats.done.toLocaleString()}</Text>
          <Text variant="small" color="ink3">Habits done</Text>
        </View>
        <View style={styles.stat} accessible accessibilityLabel={`${stats.hours} hours focused`}>
          <Text style={styles.statNum} tabular>{stats.hours}h</Text>
          <Text variant="small" color="ink3">Focused</Text>
        </View>
      </View>

      <PressableScale onPress={() => router.push('/achievements')} style={styles.badges} accessibilityLabel={`${badges.length} badges. ${xp.toNext} XP to level ${xp.level + 1}`}>
        <View style={{ flexDirection: 'row' }}>
          {badges.slice(0, 4).map((b) => {
            const def = badgeById(b.id);
            return def ? (
              <View key={b.id} style={{ marginRight: -10 }}>
                <BadgeCoin icon={def.icon} unlocked size={44} progress={1} />
              </View>
            ) : null;
          })}
        </View>
        <View style={{ flex: 1, marginLeft: badges.length ? 14 : 0 }}>
          <Text variant="bodyStrong">{badges.length} {badges.length === 1 ? 'badge' : 'badges'}</Text>
          <Text variant="small" color="ink3">{xp.toNext.toLocaleString()} XP to Level {xp.level + 1}</Text>
        </View>
        <Icon name="chev" size={18} color={c.ink3} />
      </PressableScale>

      <Group>
        <Row icon="calendar" label="Calendar" onPress={() => router.push('/calendar')} />
        <Row icon="moon" label="Daily summary" onPress={() => router.push('/summary')} />
        <Row icon="trophy" label="Achievements" onPress={() => router.push('/achievements')} last />
      </Group>
      <Group>
        <Row icon="palette" label="Theme" value={themeName} onPress={() => router.push('/themes')} />
        <Row icon="bell" label="Notifications" onPress={() => router.push('/notifications')} />
        <Row icon="settings" label="Settings" onPress={() => router.push('/settings')} last />
      </Group>
      <Group>
        <Row
          icon="download"
          label="Export data"
          value="CSV · JSON"
          chevron={false}
          plusLocked={!plus}
          onPress={() => (plus ? useUI.getState().openSheet((close) => <ExportSheet close={close} />, 'Export data') : openPaywall('export'))}
        />
        <Row icon="shield" label="Privacy" onPress={() => toast('Your data is private to your account', 'shield')} />
        <Row icon="logout" label="Sign out" chevron={false} danger onPress={signOut} last />
      </Group>

      {__DEV__ && <Button label="Load demo data (dev)" variant="ghost" size="sm" onPress={loadDemoData} />}
      <Text variant="small" color="ink3" align="center" style={{ marginTop: 4 }}>{`${APP_NAME} 1.0 · Made for better days`}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 24 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 24 },
  lv: { position: 'absolute', right: -4, bottom: 0, height: 26, paddingHorizontal: 9, borderRadius: 13, borderWidth: 2, justifyContent: 'center' },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 24 },
  stat: { flex: 1, paddingVertical: 14 },
  statNum: { fontFamily: fonts.display700, fontSize: 24, lineHeight: 28 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  group: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 52 },
  plus: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, marginBottom: 24 },
  plusMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  plusTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  friends: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, borderWidth: 1, marginTop: -12, marginBottom: 24 },
  friendsDot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  manage: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center' },
});
