import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AreaChart, BarChart } from '@/components/charts';
import { Icon } from '@/components/icons/Icon';
import { MoodFace } from '@/components/illustration';
import { Text } from '@/components/ui/Text';
import { formatFocusTotal, RANGE_LABEL, RANGE_VS, type HabitInsights, type Range } from '@/data/insights';
import { alpha, mix, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { Card, CardGrid } from './Card';
import { DeltaChip } from './DeltaChip';
import { HBar } from './HBar';

interface TabProps {
  data: HabitInsights;
  range: Range;
  animateKey: string;
  wide: boolean;
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Habits tab of Insights (SPEC §4.10): consistency, trend, categories, streak runs, mood. */
export function HabitsTab({ data, range, animateKey, wide }: TabProps) {
  const overview = <Overview data={data} range={range} animateKey={animateKey} />;
  const trend = <Trend data={data} range={range} animateKey={animateKey} />;
  const categories = data.categories.length > 0 && <Categories data={data} animateKey={animateKey} />;
  const streaks = <Streaks data={data} animateKey={animateKey} />;
  const mood = <Mood data={data} animateKey={animateKey} />;

  if (wide) {
    return (
      <CardGrid
        wide
        left={<>{overview}{streaks}</>}
        right={<>{trend}{categories}{mood}</>}
      />
    );
  }
  return (
    <View style={styles.stack}>
      {overview}
      {trend}
      {categories}
      {streaks}
      {mood}
    </View>
  );
}

function Overview({ data, range, animateKey }: Omit<TabProps, 'wide'>) {
  const { c, fixed } = useTheme();
  const last = data.bars.length - 1;
  const rest = alpha(mix(c.a1, c.a2, 0.55), 0.75);
  const summary =
    range === '7D'
      ? data.bars.map((v, i) => `${data.labels[i]} ${v}%`).join(', ')
      : `from ${data.bars[0]}% to ${data.bars[last]}% in the latest ${range === '1Y' ? 'month' : range === '3M' ? 'week' : 'day'}`;

  return (
    <Card>
      <View style={styles.heroHead}>
        <Text variant="caption" color="ink3">Habit consistency · {RANGE_LABEL[range]}</Text>
        <View style={styles.heroRow}>
          <Text style={[styles.big, { color: c.ink }]} tabular>
            {data.consistency == null ? '—' : `${data.consistency}%`}
          </Text>
          {data.delta != null && <DeltaChip delta={data.delta} vs={RANGE_VS[range]} />}
        </View>
      </View>
      <BarChart
        values={data.bars}
        max={100}
        labels={data.labels}
        colors={(_, i) => (i === last ? c.a1 : rest)}
        height={150}
        gap={data.bars.length > 14 ? 2 : 6}
        maxBarWidth={26}
        animateKey={animateKey}
        accessibilityLabel={`Habit completion, ${RANGE_LABEL[range].toLowerCase()}: ${summary}`}
      />
      <View style={[styles.grid, { borderTopColor: c.line }]}>
        <Stat label="Current streak" value={days(data.currentStreak)} border={c.line} icon={<Icon name="flame" size={18} color={fixed.flame} filled />} />
        <Stat label="Longest streak" value={days(data.longestStreak)} border={c.line} />
        <Stat label="Focus time" value={formatFocusTotal(data.focusMinutes)} />
        <Stat label="Tasks completed" value={String(data.tasksDone)} />
      </View>
    </Card>
  );
}

function Stat({ label, value, border, icon }: { label: string; value: string; border?: string; icon?: ReactNode }) {
  return (
    <View
      style={[styles.stat, border != null && { borderBottomWidth: 1, borderBottomColor: border }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text color="ink3" style={styles.statLabel}>{label}</Text>
      <View style={styles.statRow}>
        <Text style={styles.statValue} tabular>{value}</Text>
        {icon}
      </View>
    </View>
  );
}

function Trend({ data, range, animateKey }: Omit<TabProps, 'wide'>) {
  const { c } = useTheme();
  const lo = Math.min(...data.trend);
  const min = Math.max(0, Math.min(40, Math.floor((lo - 10) / 10) * 10));
  return (
    <Card title="Productivity trend">
      <AreaChart
        values={data.trend}
        min={min}
        max={100}
        color={c.a1}
        height={130}
        animateKey={animateKey}
        accessibilityLabel={`Productivity trend, ${RANGE_LABEL[range].toLowerCase()}: from ${data.trend[0]}% to ${data.trend[data.trend.length - 1]}%`}
      />
    </Card>
  );
}

function Categories({ data, animateKey }: { data: HabitInsights; animateKey: string }) {
  const { habit } = useTheme();
  return (
    <Card title="By category">
      <View
        style={styles.rows}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Completion by category: ${data.categories.map((x) => `${x.category} ${x.pct}%`).join(', ')}`}
      >
        {data.categories.map((x, i) => (
          <View key={x.category} style={styles.catRow}>
            <Text style={styles.catLabel} numberOfLines={1}>{x.category}</Text>
            <View style={styles.flex}>
              <HBar fraction={x.pct / 100} color={habit(x.hue).c} track delay={i * 40} animateKey={animateKey} />
            </View>
            <Text color="ink2" align="right" style={styles.catValue} tabular>{x.pct}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Bars leave room on the right for the "12d current" label. */
const RUN_MAX = 0.72;

function Streaks({ data, animateKey }: { data: HabitInsights; animateKey: string }) {
  const { c, fixed } = useTheme();
  const top = Math.max(1, ...data.runs.map((r) => r.length));
  return (
    <Card title="Streak history">
      {data.runs.length > 0 && (
        <View
          style={styles.rows}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Streak history: ${data.runs
            .map((r) => `${r.label} ${days(r.length)}${r.current ? ', current' : r.longest ? ', longest' : ''}`)
            .join('; ')}`}
        >
          {data.runs.map((r, i) => (
            <View key={`${r.label}${i}`} style={styles.runRow}>
              <Text color="ink3" style={styles.runLabel}>{r.label}</Text>
              <View style={[styles.flex, styles.runTrack]}>
                <HBar
                  fraction={(r.length / top) * RUN_MAX}
                  height={22}
                  color={r.current ? fixed.flame : r.longest ? c.a1 : mix(c.a1, c.track, 0.4)}
                  delay={i * 40}
                  animateKey={animateKey}
                />
                <Text style={styles.runValue} numberOfLines={1} tabular>
                  {r.length}d{' '}
                  {(r.current || r.longest) && <Text color="ink3" style={styles.runTag}>{r.current ? 'current' : 'longest'}</Text>}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <Text color="ink2" style={styles.note}>
        Every reset is a fresh start. Missing a day never erases the work you’ve already done.
      </Text>
    </Card>
  );
}

function Mood({ data, animateKey }: { data: HabitInsights; animateKey: string }) {
  const { c } = useTheme();
  const m = data.mood;
  if (!m) {
    return (
      <Card>
        <Text variant="caption" color="ink3">Mood × habits</Text>
        <Text color="ink2" style={styles.note}>Log your mood for a few days and you’ll see which habits lift it.</Text>
      </Card>
    );
  }
  const name = m.habitName.toLowerCase();
  const sentence = `You tend to feel better on days you complete your ${name}.`;
  return (
    <Card>
      <Text variant="caption" color="ink3">Mood × habits</Text>
      <Text style={styles.moodLine}>{sentence}</Text>
      <View
        style={styles.rows}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${sentence} ${m.withPct}% good or great days with it, ${m.withoutPct}% without.`}
      >
        <View style={styles.moodRow}>
          <MoodFace mood="great" size={30} />
          <View style={styles.flex}>
            <HBar fraction={m.withPct / 100} color={c.a1} track delay={200} duration={900} animateKey={animateKey} />
          </View>
          <Text style={styles.moodPct} tabular>{m.withPct}%</Text>
        </View>
        <View style={styles.moodRow}>
          <MoodFace mood="okay" size={30} />
          <View style={styles.flex}>
            <HBar fraction={m.withoutPct / 100} color={c.ink3} track delay={300} duration={900} animateKey={animateKey} />
          </View>
          <Text style={styles.moodPct} tabular>{m.withoutPct}%</Text>
        </View>
      </View>
      <Text color="ink3" style={styles.caption}>Share of “Great” or “Good” days · with vs without {name}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  heroHead: { gap: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  big: { fontFamily: fonts.display700, fontSize: 60, lineHeight: 64, letterSpacing: -2.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1 },
  stat: { width: '50%', paddingVertical: 14, gap: 2 },
  statLabel: { fontSize: 12.5, lineHeight: 16 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontFamily: fonts.display700, fontSize: 24, lineHeight: 29, letterSpacing: -0.5 },
  rows: { gap: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catLabel: { width: 96, fontFamily: fonts.body600, fontSize: 13.5, lineHeight: 18 },
  catValue: { width: 40, fontSize: 13, lineHeight: 17 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  runLabel: { width: 40, fontFamily: fonts.body600, fontSize: 12.5, lineHeight: 16 },
  runTrack: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  runValue: { fontFamily: fonts.body700, fontSize: 13, lineHeight: 17, flexShrink: 0 },
  runTag: { fontFamily: fonts.body500, fontSize: 13 },
  note: { fontSize: 13.5, lineHeight: 19 },
  moodLine: { fontFamily: fonts.body700, fontSize: 16, lineHeight: 22 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moodPct: { width: 38, fontFamily: fonts.body700, fontSize: 13, lineHeight: 17 },
  caption: { fontSize: 12.5, lineHeight: 17 },
});
