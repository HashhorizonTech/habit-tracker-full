import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HabitListRow, type HabitListItem } from '@/components/habit/HabitListRow';
import { SortableHabitList } from '@/components/habit/SortableHabitList';
import { Mascot } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { todayKey } from '@/data/dates';
import { completionRate, countOn, doneOn, habitStreak, habitsForDay, liveHabits, weekRow } from '@/data/selectors';
import { openCreateHabit } from '@/lib/actions';
import { useResponsive } from '@/lib/responsive';
import { useData } from '@/store/data';
import { usePrefs } from '@/store/prefs';
import { space } from '@/theme/tokens';

const FILTERS = ['All', 'Morning', 'Health', 'Fitness', 'Learning', 'Work', 'Personal', 'Evening'] as const;
type Filter = (typeof FILTERS)[number];

export default function HabitsScreen() {
  const habitsMap = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const restDays = useData((s) => s.profile.streakProtection.restDays);
  const reorder = useData((s) => s.reorderHabits);
  const weekStart = usePrefs((s) => s.weekStart);
  const { pad, columns } = useResponsive();
  const [filter, setFilter] = useState<Filter>('All');
  const [dragging, setDragging] = useState(false);

  const { all, items, doneToday } = useMemo(() => {
    const today = todayKey();
    const all = liveHabits(habitsMap);
    // Filter matches category or time of day (SPEC §4.4).
    const visible = all.filter((h) => filter === 'All' || h.category === filter || h.timeOfDay === filter);
    const items: HabitListItem[] = visible.map((habit) => ({
      habit,
      count: countOn(logs, habit.id, today),
      streak: habitStreak(habit, logs, { restDays, weekStart }),
      rate: completionRate(habit, logs, today),
      week: weekRow(habit, logs, weekStart, today),
    }));
    const doneToday = habitsForDay(all, logs, today).filter((h) => doneOn(logs, h, today)).length;
    return { all, items, doneToday };
  }, [habitsMap, logs, restDays, weekStart, filter]);

  const header = (
    <View style={styles.header}>
      <View style={{ gap: 4, flex: 1 }}>
        <Text variant="h1" accessibilityRole="header">My habits</Text>
        <Text color="ink2">
          {all.length} {all.length === 1 ? 'habit' : 'habits'} · {doneToday} done today
        </Text>
      </View>
      <Button label="New" icon="plus" size="sm" onPress={() => openCreateHabit()} style={{ height: 44, borderRadius: 15, paddingHorizontal: 16 }} />
    </View>
  );

  if (!all.length) {
    return (
      <Screen tab>
        {header}
        <EmptyState
          title="Ready to build your first habit?"
          body="Pick something small you'd be glad to do every day."
          cta="Create a habit"
          onPress={() => openCreateHabit()}
        />
      </Screen>
    );
  }

  // Drag-to-reorder is for the full list on phones; wide layouts show a static grid.
  const sortable = filter === 'All' && columns < 2;

  return (
    <Screen tab scrollEnabled={!dragging}>
      {header}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -pad, marginBottom: 2 }}
        contentContainerStyle={{ paddingHorizontal: pad, gap: space[2], paddingVertical: 2 }}
      >
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {items.length === 0 ? (
        <View style={styles.emptyCat}>
          <Mascot size={110} face="happy" accessory="sparkle" />
          <Text variant="h2" align="center">Nothing in {filter} yet</Text>
          <Text color="ink2" align="center" style={{ maxWidth: 260 }}>A small habit here could make a big difference.</Text>
          <Button
            label="Create a habit"
            size="md"
            onPress={() => openCreateHabit(filter === 'Morning' || filter === 'Evening' || filter === 'All' ? undefined : { category: filter })}
            style={{ marginTop: 6 }}
          />
        </View>
      ) : sortable ? (
        <SortableHabitList items={items} onReorder={reorder} onDragState={setDragging} />
      ) : (
        <View style={[styles.grid, columns >= 2 && { flexDirection: 'row', flexWrap: 'wrap', columnGap: 32 }]}>
          {items.map((it) => (
            <View key={it.habit.id} style={columns >= 2 ? { flexBasis: 380, flexGrow: 1 } : undefined}>
              <HabitListRow item={it} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 8, marginBottom: 18, gap: 12 },
  emptyCat: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  grid: {},
});
