import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FocusTab } from '@/components/insights/FocusTab';
import { HabitsTab } from '@/components/insights/HabitsTab';
import { Chip } from '@/components/ui/Chip';
import { DataGate } from '@/components/ui/DataGate';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { todayKey } from '@/data/dates';
import { focusInsights, habitInsights, RANGES, type Range } from '@/data/insights';
import { liveHabits } from '@/data/selectors';
import { useResponsive } from '@/lib/responsive';
import { useData } from '@/store/data';

type Tab = 'habits' | 'focus';

const RANGE_OPTIONS = RANGES.map((r) => ({ value: r, label: r }));

export default function InsightsScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { columns } = useResponsive();
  const [tab, setTab] = useState<Tab>(params.tab === 'focus' ? 'focus' : 'habits');
  const [range, setRange] = useState<Range>('7D');

  // The tab stays mounted, so a later `/insights?tab=focus` link has to switch tabs here.
  const [seenParam, setSeenParam] = useState(params.tab);
  if (params.tab !== seenParam) {
    setSeenParam(params.tab);
    if (params.tab === 'habits' || params.tab === 'focus') setTab(params.tab);
  }

  // Bumped on every focus so all charts replay their grow-in; `today` rolls over past midnight.
  const [visit, setVisit] = useState({ n: 0, today: todayKey() });
  useFocusEffect(useCallback(() => setVisit((v) => ({ n: v.n + 1, today: todayKey() })), []));
  const today = visit.today;

  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const tasks = useData((s) => s.tasks);
  const sessions = useData((s) => s.focusSessions);
  const moods = useData((s) => s.moodLogs);
  const restDays = useData((s) => s.profile.streakProtection.restDays);

  const hasHabits = useMemo(() => liveHabits(habits).length > 0, [habits]);
  const hasFocus = useMemo(() => Object.values(sessions).some((s) => !s.deleted && s.completed && s.mode === 'focus'), [sessions]);

  const habitData = useMemo(
    () => (tab === 'habits' ? habitInsights(range, { habits, logs, tasks, sessions, moods, restDays, today }) : null),
    [tab, range, habits, logs, tasks, sessions, moods, restDays, today],
  );
  const focusData = useMemo(
    () => (tab === 'focus' ? focusInsights(range, sessions, today) : null),
    [tab, range, sessions, today],
  );

  if (!hasHabits && !hasFocus) {
    return (
      <Screen tab>
        <Text variant="h1" accessibilityRole="header" style={styles.title}>Insights</Text>
        <DataGate>
        <EmptyState
          title="Your story starts here"
          body="Complete a few habits and your story will appear here."
          cta="Check in today"
          onPress={() => router.navigate('/')}
          face="wow"
          accessory="star"
          icon={null}
        />
        </DataGate>
      </Screen>
    );
  }

  const animateKey = `${tab}-${range}-${visit.n}`;
  const wide = columns >= 2;

  return (
    <Screen tab>
      <View style={styles.header}>
        <Text variant="h1" accessibilityRole="header">Insights</Text>
        <View style={styles.controls}>
          <View style={styles.chips} accessibilityRole="tablist">
            <Chip label="Habits" selected={tab === 'habits'} onPress={() => setTab('habits')} />
            <Chip label="Focus" selected={tab === 'focus'} onPress={() => setTab('focus')} />
          </View>
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} size="sm" label="Date range" style={styles.range} />
        </View>
      </View>
      <DataGate>
      {habitData && <HabitsTab data={habitData} range={range} animateKey={animateKey} wide={wide} />}
      {focusData && <FocusTab data={focusData} range={range} animateKey={animateKey} wide={wide} />}
      </DataGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: 8 },
  header: { gap: 16, paddingTop: 8, marginBottom: 22 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', gap: 6 },
  range: { flexGrow: 1, flexBasis: 200, maxWidth: 300 },
});
