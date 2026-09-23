import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import type { Habit } from '@/data/types';
import { checkIn } from '@/lib/checkIn';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { CheckButton } from './CheckButton';
import { HabitTile } from './HabitTile';

/** Minimal Today row (SPEC §4.3): tile, name, "6 of 8 glasses", 5px bar, check button. */
export const HabitRow = memo(function HabitRow({ habit, count, streak, last }: { habit: Habit; count: number; streak: number; last?: boolean }) {
  const { c, habit: hc } = useTheme();
  const col = hc(habit.hue);
  const progress = Math.min(1, count / habit.goal);
  const done = progress >= 1;
  const sub = done ? `Done · ${streak}-day streak` : `${count} of ${habit.goal} ${habit.unit}`;
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }]}>
      <Pressable
        style={styles.main}
        onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${habit.name}, ${sub}. Open details`}
      >
        <HabitTile hue={habit.hue} icon={habit.icon} />
        <View style={styles.body}>
          <View style={styles.line}>
            <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
            <Text variant="small" color="ink3" numberOfLines={1}>{sub}</Text>
          </View>
          <ProgressBar progress={progress} color={col.c} />
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
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 0 },
  body: { flex: 1, gap: 6, minWidth: 0 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { fontFamily: fonts.body600, fontSize: 15.5, flexShrink: 1 },
});
