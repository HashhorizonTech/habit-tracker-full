import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { syncNow } from '@/api/sync';
import { Icon } from '@/components/icons/Icon';
import { HabitRow } from '@/components/habit/HabitRow';
import { Avatar } from '@/components/home/Avatar';
import { DayDial } from '@/components/home/DayDial';
import { FocusCard } from '@/components/home/FocusCard';
import { MoodStrip } from '@/components/home/MoodStrip';
import { StatRow } from '@/components/home/StatRow';
import { Flame, Mascot } from '@/components/illustration';
import { TimelineRow } from '@/components/task/TimelineRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { formatMinutes, greeting, longDate, todayKey } from '@/data/dates';
import {
  countOn, dayPercent, focusMinutesOn, habitStreak, habitsForDay, liveHabits, liveList, overallStreak, progressOn, tasksForDay,
} from '@/data/selectors';
import { openCreateHabit } from '@/lib/actions';
import { loadDemoData } from '@/lib/demo';
import { quickFocus } from '@/focus/engine';
import { presetValues, useFocus } from '@/store/focus';
import { useResponsive } from '@/lib/responsive';
import { levelInfo } from '@/lib/xp';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts, space } from '@/theme/tokens';

function useToday() {
  const habitsMap = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const tasksMap = useData((s) => s.tasks);
  const sessions = useData((s) => s.focusSessions);
  const moods = useData((s) => s.moodLogs);
  const profile = useData((s) => s.profile);
  return useMemo(() => {
    const today = todayKey();
    const all = liveHabits(habitsMap);
    const habits = habitsForDay(all, logs, today);
    const tasks = tasksForDay(liveList(tasksMap), today);
    const restDays = profile.streakProtection.restDays;
    const upNext = tasks.filter((t) => !t.done).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')).slice(0, 3);
    const focus = focusMinutesOn(sessions, today);
    const mood = moods[today] && !moods[today].deleted ? moods[today] : null;
    return {
      today,
      all,
      habits: habits.map((h) => ({ h, count: countOn(logs, h.id, today), streak: habitStreak(h, logs, { restDays }) })),
      doneCount: habits.filter((h) => progressOn(logs, h, today) >= 1).length,
      pct: dayPercent(all, logs, tasks, today),
      streak: overallStreak(all, logs, { restDays }).current,
      tasksDone: tasks.filter((t) => t.done).length,
      tasksTotal: tasks.length,
      upNext,
      focus,
      mood,
      firstUndoneTask: upNext[0]?.title ?? 'Deep work',
    };
  }, [habitsMap, logs, tasksMap, sessions, moods, profile.streakProtection.restDays]);
}

export default function TodayScreen() {
  const { c, fixed, habit } = useTheme();
  const { columns } = useResponsive();
  const profile = useData((s) => s.profile);
  const t = useToday();
  const [refreshing, setRefreshing] = useState(false);
  const xp = levelInfo(profile.xp);
  const focusMinutes = useFocus((s) => presetValues(s).focus);
  const name = profile.name || 'there';

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  };

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="caption" color="ink3">{longDate()}</Text>
        <Text variant="h1" accessibilityRole="header">{greeting()}, {name}</Text>
        <Text color="ink2">Let{"'"}s make today count.</Text>
      </View>
      <View style={styles.headerActions}>
        <IconButton icon="calendar" label="Open calendar" onPress={() => router.push('/calendar')} />
        <PressableScale kind="icon" onPress={() => router.navigate('/you')} accessibilityLabel={`Profile, level ${xp.level}`}>
          <Avatar name={name} progress={xp.progress} />
        </PressableScale>
      </View>
    </View>
  );

  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['transparent']} progressBackgroundColor="transparent" tintColor="transparent" />
  );

  if (!t.all.length) {
    return (
      <Screen tab refreshControl={refresh}>
        {header}
        <EmptyState
          title="Ready to build your first habit?"
          body="Start tiny. Two minutes still counts — and it's the start of your story."
          cta="Create a habit"
          onPress={() => openCreateHabit()}
        />
        {__DEV__ && (
          <PressableScale onPress={loadDemoData} style={{ alignSelf: 'center', padding: 12 }} accessibilityLabel="Load demo data">
            <Text variant="small" color="ink3">Load demo data (dev)</Text>
          </PressableScale>
        )}
      </Screen>
    );
  }

  const dialSection = (
    <View style={{ gap: 22 }}>
      <View style={styles.dialRow}>
        <DayDial
          pct={t.pct}
          segments={t.habits.map(({ h, count }) => ({ id: h.id, color: habit(h.hue).c, progress: Math.min(1, count / h.goal) }))}
          onPress={() => router.navigate('/insights')}
        />
        <View style={{ flex: 1, gap: 6 }}>
          <StatRow
            icon={<Flame size={19} />}
            iconBg={fixed.flameSoft}
            value={`${t.streak} ${t.streak === 1 ? 'day' : 'days'}`}
            label="current streak"
            hint="Opens streak details"
            onPress={() => toast('Streak details arrive in step 6', 'flame')}
          />
          <StatRow
            icon={<Icon name="focus" size={19} color={c.a1text} />}
            iconBg={c.a1soft}
            value={formatMinutes(t.focus.minutes)}
            label="focused today"
            hint="Opens focus insights"
            onPress={() => router.navigate('/insights')}
          />
          <StatRow
            icon={<Icon name="tasks" size={19} color={c.ink} />}
            iconBg={c.a2soft}
            value={`${t.tasksDone} / ${t.tasksTotal}`}
            label="tasks done"
            hint="Opens tasks"
            onPress={() => router.push('/tasks')}
          />
        </View>
      </View>
      <MoodStrip today={t.mood} onPick={() => toast('Mood check-in arrives in step 6', 'heart')} />
    </View>
  );

  const habitsSection = (
    <View>
      <View style={styles.sectionHead}>
        <Text variant="h2" accessibilityRole="header">Today{"'"}s habits</Text>
        <View style={styles.sectionActions}>
          <PressableScale onPress={() => router.navigate('/habits')} accessibilityLabel={`${t.doneCount} of ${t.habits.length} done. See all habits`} hitSlop={10}>
            <Text style={styles.link} color="a1text">{t.doneCount} of {t.habits.length} · See all</Text>
          </PressableScale>
          <IconButton icon="plus" label="New habit" size={32} iconSize={17} variant="accent" onPress={() => openCreateHabit()} style={{ borderRadius: 11 }} />
        </View>
      </View>
      {t.habits.map(({ h, count, streak }, i) => (
        <HabitRow key={h.id} habit={h} count={count} streak={streak} last={i === t.habits.length - 1} />
      ))}
    </View>
  );

  const planSection = (
    <View style={{ gap: 22 }}>
      <FocusCard
        minutes={focusMinutes}
        taskTitle={t.firstUndoneTask}
        sessions={t.focus.count}
        onPress={() => {
          quickFocus(t.upNext[0]?.id ?? null);
          router.navigate('/focus');
        }}
      />
      <View>
        <View style={[styles.sectionHead, { marginBottom: 6 }]}>
          <Text variant="h2" accessibilityRole="header">Up next</Text>
          <PressableScale onPress={() => router.push('/tasks')} hitSlop={10} accessibilityLabel="All tasks">
            <Text style={styles.link} color="a1text">All tasks</Text>
          </PressableScale>
        </View>
        {t.upNext.length === 0 ? (
          <View style={styles.clear}>
            <Icon name="sparkle" size={18} color={c.ink2} />
            <Text color="ink2">Your day is clear.</Text>
          </View>
        ) : (
          t.upNext.map((task) => <TimelineRow key={task.id} task={task} />)
        )}
      </View>
      <PressableScale onPress={() => router.push('/summary')} style={[styles.recap, { borderColor: c.line }]} accessibilityLabel="Evening recap. See your day as a journal page">
        <View style={[styles.recapIcon, { backgroundColor: c.surface2 }]}>
          <Icon name="moon" size={19} color={c.ink2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Evening recap</Text>
          <Text variant="small" color="ink3">See your day as a journal page</Text>
        </View>
        <Icon name="chev" size={18} color={c.ink3} />
      </PressableScale>
    </View>
  );

  const sections = [dialSection, habitsSection, planSection];
  return (
    <Screen tab refreshControl={refresh}>
      {refreshing && (
        <View style={styles.refresh} accessibilityLabel="Syncing">
          <Mascot size={54} face="happy" />
        </View>
      )}
      {header}
      {columns >= 2 ? (
        <View style={styles.grid}>
          {sections.map((s, i) => (
            <View key={i} style={{ flexBasis: 330, flexGrow: 1, minWidth: 300 }}>{s}</View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 30 }}>{sections.map((s, i) => <View key={i}>{s}</View>)}</View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8, marginBottom: 26 },
  headerActions: { flexDirection: 'row', gap: 8 },
  dialRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { fontFamily: fonts.body700, fontSize: 13.5 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  recap: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed' },
  recapIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 30, alignItems: 'flex-start' },
  refresh: { alignItems: 'center', marginBottom: space[2] },
});
