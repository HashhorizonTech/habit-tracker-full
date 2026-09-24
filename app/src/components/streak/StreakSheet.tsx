import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { Flame } from '@/components/illustration';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { addDays, daysBetween, startOfWeek, todayKey } from '@/data/dates';
import { dayCounts, liveHabits, overallStreak } from '@/data/selectors';
import { restDaysFor } from '@/lib/plusFeatures';
import { applyStreakProtection, restDaysLeft } from '@/lib/streakProtection';
import { useData } from '@/store/data';
import { usePlus } from '@/store/plus';
import { usePrefs } from '@/store/prefs';
import { alpha, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

type CellState = 'streak' | 'good' | 'rest' | 'miss' | 'future';

/** Streak details sheet (SPEC §4.12): current + longest, 5-week grid, protection toggle. */
export function StreakSheet() {
  const { c, fixed } = useTheme();
  const habitsMap = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const sp = useData((s) => s.profile.streakProtection);
  const updateProfile = useData((s) => s.updateProfile);
  const weekStart = usePrefs((s) => s.weekStart);
  const { active: plus } = usePlus();

  const { current, longest, cells, protectedShown } = useMemo(() => {
    const today = todayKey();
    const habits = liveHabits(habitsMap);
    const st = overallStreak(habits, logs, { restDays: sp.restDays, today });
    const run = st.current > 0 ? st.runs[st.runs.length - 1] : null;
    const rest = new Set(sp.restDays);
    const first = addDays(startOfWeek(today, weekStart), -28);
    const cells = Array.from({ length: 35 }, (_, i) => {
      const date = addDays(first, i);
      let state: CellState;
      if (daysBetween(today, date) > 0) state = 'future';
      else if (rest.has(date)) state = 'rest';
      else if (run && date >= run.start && date <= run.end && dayCounts(habits, logs, date)) state = 'streak';
      else if (dayCounts(habits, logs, date)) state = 'good';
      else state = 'miss';
      return { date, state };
    });
    return { current: st.current, longest: st.longest, cells, protectedShown: cells.some((x) => x.state === 'rest') };
  }, [habitsMap, logs, sp.restDays, weekStart]);

  const left = restDaysLeft(sp.restDays, todayKey(), restDaysFor(plus));
  const bg: Record<CellState, string> = {
    streak: fixed.flame,
    good: alpha(fixed.flame, 0.3),
    rest: 'transparent',
    miss: c.track,
    future: 'transparent',
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.head} accessible accessibilityLabel={`${current} day streak. Longest ${longest} days.`}>
        <View>
          <View style={styles.big}>
            <Flame size={40} />
            <Text style={styles.bigNum} tabular>{current}</Text>
          </View>
          <Text variant="caption" color="ink3" style={{ fontSize: 12 }}>Day streak</Text>
        </View>
        <View style={{ paddingBottom: 2 }}>
          <View style={styles.big}>
            <Icon name="trophy" size={24} color={c.a1text} />
            <Text style={styles.midNum} tabular>{longest}</Text>
          </View>
          <Text variant="caption" color="ink3" style={{ fontSize: 12 }}>Longest</Text>
        </View>
      </View>

      <View style={styles.grid} accessibilityLabel="Last five weeks" accessible>
        {cells.map((x) => (
          <View key={x.date} style={styles.cellSlot}>
            <View
              style={[
                styles.cell,
                { backgroundColor: bg[x.state], opacity: x.state === 'future' ? 0 : 1 },
                x.state === 'rest' && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink3 },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={[styles.protect, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={[styles.shield, { backgroundColor: c.a1soft }]}>
          <Icon name="shield" size={20} color={c.a1text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Streak protection</Text>
          <Text variant="small" color="ink3">
            {left} rest {left === 1 ? 'day' : 'days'} left this month{protectedShown ? ' · dashed day was protected' : ''}
          </Text>
        </View>
        <Toggle
          value={sp.enabled}
          label="Streak protection"
          onChange={(enabled) => {
            updateProfile({ streakProtection: { ...sp, enabled } });
            if (enabled) applyStreakProtection();
          }}
        />
      </View>

      <Text color="ink2">Every reset is a fresh start. Missing a day never erases the work you’ve already done.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
  big: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bigNum: { fontFamily: fonts.display800, fontSize: 52, lineHeight: 56, letterSpacing: -2 },
  midNum: { fontFamily: fonts.display700, fontSize: 28, lineHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cellSlot: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  cell: { flex: 1, borderRadius: 12 },
  protect: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  shield: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
