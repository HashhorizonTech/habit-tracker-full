import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { Text } from '@/components/ui/Text';
import { frequencyLabel, type WeekCell } from '@/data/selectors';
import type { Habit } from '@/data/types';
import { checkIn } from '@/lib/checkIn';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { CheckButton } from './CheckButton';
import { HabitTile } from './HabitTile';

export interface HabitListItem {
  habit: Habit;
  count: number;
  streak: number;
  rate: number;
  week: WeekCell[];
}

const CHECK_INK = '#1c1e2d';

function WeekDot({ cell, color }: { cell: WeekCell; color: string }) {
  const { c } = useTheme();
  const done = cell.state === 'done';
  const border = done || cell.state === 'today' ? color : c.line;
  return (
    <View style={[styles.day, { opacity: cell.state === 'future' ? 0.4 : 1 }]}>
      <Text style={[styles.dayLabel, { color: cell.isToday ? c.ink : c.ink3 }]}>{cell.label}</Text>
      <View
        style={[
          styles.dot,
          { borderColor: border, backgroundColor: done ? color : 'transparent', borderStyle: cell.state === 'missed' ? 'dashed' : 'solid' },
        ]}
      >
        {done && <Icon name="check" size={12} color={CHECK_INK} strokeWidth={3} />}
      </View>
    </View>
  );
}

/** Habits list row (SPEC §4.4): tile, name, flame streak, rate, frequency, check button, M–S week. */
export const HabitListRow = memo(function HabitListRow({ item, divider = true }: { item: HabitListItem; divider?: boolean }) {
  const { c, habit: hc, fixed } = useTheme();
  const { habit, count, streak, rate, week } = item;
  const col = hc(habit.hue);
  const progress = Math.min(1, count / habit.goal);
  const done = progress >= 1;
  const freq = frequencyLabel(habit.frequency);
  const weekSummary = week.map((w) => `${w.label} ${w.state}`).join(', ');
  return (
    <View style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
      <View style={styles.top}>
        <Pressable
          style={styles.main}
          onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${habit.name}. ${streak} day streak, ${rate}% rate, ${freq}. Open details`}
        >
          <HabitTile hue={habit.hue} icon={habit.icon} size={48} />
          <View style={{ gap: 3, flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
            <View style={styles.meta}>
              <View style={styles.streak}>
                <Icon name="flame" size={13} color={fixed.flame} filled />
                <Text style={[styles.metaText, { color: fixed.flame, fontFamily: fonts.body700 }]}>{streak}</Text>
              </View>
              <Text style={styles.metaText} color="ink3">{rate}% rate</Text>
              <Text style={styles.metaText} color="ink3" numberOfLines={1}>{freq}</Text>
            </View>
          </View>
        </Pressable>
        <CheckButton
          hue={habit.hue}
          progress={progress}
          done={done}
          onPress={() => checkIn(habit.id)}
          label={done ? `${habit.name} done. Undo one step` : `${habit.name}, ${count} of ${habit.goal} ${habit.unit}. Add ${habit.step}`}
        />
      </View>
      <View style={styles.week} accessible accessibilityLabel={`This week: ${weekSummary}`}>
        {week.map((cell) => (
          <WeekDot key={cell.date} cell={cell} color={col.c} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { gap: 12, paddingVertical: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 0 },
  name: { fontFamily: fonts.body600, fontSize: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontFamily: fonts.body500, fontSize: 12.5 },
  week: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 62, paddingRight: 4 },
  day: { alignItems: 'center', gap: 4 },
  dayLabel: { fontFamily: fonts.body700, fontSize: 10.5 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
