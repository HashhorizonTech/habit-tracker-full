import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { HabitTile } from '@/components/habit/HabitTile';
import { MoodFace } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Ring } from '@/components/ui/Ring';
import { Text } from '@/components/ui/Text';
import { daySummary } from '@/data/calendar';
import { formatMinutes, MONTHS, parseKey } from '@/data/dates';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { useCalendarData } from './useCalendarData';

const RING = 84;
const MAX_TILES = 6;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Day details sheet opened from a calendar cell (SPEC §4.9). */
export function DaySheet({ date, close }: { date: string; close: () => void }) {
  const { c } = useTheme();
  const data = useCalendarData();
  const day = useMemo(() => daySummary(data, date), [data, date]);
  const doneHabits = useMemo(() => {
    const ids = new Set(day.doneHabitIds);
    return data.habits.filter((h) => ids.has(h.id)).slice(0, MAX_TILES);
  }, [data.habits, day.doneHabitIds]);

  const d = parseKey(date);
  const title = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const hairline = { borderColor: c.line };
  const focusLine = day.focusCount
    ? `${plural(day.focusCount, 'focus session')} · ${formatMinutes(day.focusMinutes)}`
    : 'No focus sessions';

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View style={styles.ring} accessible accessibilityLabel={`${day.pct}% completed`}>
          <Ring size={RING} stroke={8} progress={day.pct / 100} color={c.a1} />
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <Text style={styles.ringPct} tabular>{day.pct}%</Text>
          </View>
        </View>
        <View style={styles.titles}>
          <Text variant="h2" accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text color="ink2">{day.pct}% completed</Text>
        </View>
        {day.mood && <MoodFace mood={day.mood} size={44} />}
      </View>

      <View style={[styles.list, hairline]}>
        <View style={[styles.row, styles.divider, hairline]}>
          <Text variant="bodyStrong" style={styles.flex}>
            {day.habitsDone} of {plural(day.habitsTotal, 'habit')}
          </Text>
          <View style={styles.tiles}>
            {doneHabits.map((h) => (
              <HabitTile key={h.id} hue={h.hue} icon={h.icon} size={28} />
            ))}
          </View>
        </View>
        <View style={[styles.row, styles.divider, hairline]}>
          <Text variant="bodyStrong">{plural(day.tasksDone, 'task')} done</Text>
        </View>
        <View style={styles.row}>
          <Text variant="bodyStrong">{focusLine}</Text>
        </View>
      </View>

      <Button label="Close" variant="secondary" size="md" onPress={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: RING, height: RING },
  center: { alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontFamily: fonts.display700, fontSize: 22, letterSpacing: -0.4 },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 24, lineHeight: 28 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: 4 },
});
