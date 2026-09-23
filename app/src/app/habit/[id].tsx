import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AreaChart, BarChart, Heatmap, HeatmapLegend } from '@/components/charts';
import { HabitTile } from '@/components/habit/HabitTile';
import { Icon, type IconName } from '@/components/icons/Icon';
import { Flame, Mascot, useLoop } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader, goBack } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { WEEKDAYS, parseKey, todayKey } from '@/data/dates';
import {
  bestTime,
  byWeekday,
  completionRate,
  frequencyLabel,
  habitLongest,
  habitStreak,
  heatmap,
  history,
  monthlyCompletion,
  progressOn,
  timeBucket,
  totalCompletions,
  type Logs,
} from '@/data/selectors';
import type { Habit } from '@/data/types';
import { checkIn } from '@/lib/checkIn';
import { useResponsive } from '@/lib/responsive';
import { useSvgId } from '@/lib/useSvgId';
import { useData } from '@/store/data';
import { splitAlpha, useTheme } from '@/theme';
import { fonts, space } from '@/theme/tokens';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CHECK_INK = '#1c1e2d';
const BREATH_MS = 3000;

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useData((s) => s.habits[id]);
  const logs = useData((s) => s.habitLogs);
  const restDays = useData((s) => s.profile.streakProtection.restDays);

  if (!habit || habit.deleted) return <Removed />;
  return <Detail habit={habit} logs={logs} restDays={restDays} />;
}

function Removed() {
  return (
    <Screen>
      <ScreenHeader title="Habit" back />
      <View style={styles.removed}>
        <Mascot size={120} face="sleepy" float />
        <Text variant="h2" align="center">This habit has been removed</Text>
        <Button label="Go back" variant="secondary" size="md" onPress={goBack} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}

function useStats(h: Habit, logs: Logs, restDays: string[]) {
  return useMemo(() => {
    const today = todayKey();
    const streak = habitStreak(h, logs, { restDays, today });
    const longest = Math.max(streak, habitLongest(h, logs, { restDays, today }));
    const months = monthlyCompletion(h, logs, today);
    const [prev, last] = months.slice(-2).map((m) => m.pct);
    return {
      streak,
      longest,
      rate: completionRate(h, logs, today),
      total: totalCompletions(h, logs),
      grid: heatmap(h, logs, today),
      weekday: byWeekday(h, logs, today),
      bestTime: bestTime(h, logs),
      bucket: timeBucket(h, logs),
      months,
      delta: (last ?? 0) - (prev ?? 0),
      history: history(h, logs, today),
      rest: new Set(restDays),
      pct: Math.round(progressOn(logs, h, today) * 100),
    };
  }, [h, logs, restDays]);
}

type Stats = ReturnType<typeof useStats>;

function Detail({ habit: h, logs, restDays }: { habit: Habit; logs: Logs; restDays: string[] }) {
  const { habit } = useTheme();
  const { columns } = useResponsive();
  const col = habit(h.hue);
  const s = useStats(h, logs, restDays);
  const wide = columns >= 2;

  const hero = <StreakHero streak={s.streak} longest={s.longest} color={col.c} />;
  const stats = <StatStrip items={[['Current', `${s.streak}d`], ['Longest', `${s.longest}d`], ['Completion', `${s.rate}%`], ['Total', `${s.total}`]]} />;
  const hist = <History h={h} rows={s.history} rest={s.rest} color={col.c} />;
  const charts = (
    <>
      <HeatmapSection s={s} levels={col.levels} animateKey={h.id} />
      <WeekdaySection s={s} color={col.c} dim={col.dim} animateKey={h.id} />
      <Section title="Monthly completion">
        <AreaChart
          values={s.months.map((m) => m.pct)}
          labels={s.months.map((m) => m.label)}
          min={Math.max(0, Math.min(40, Math.floor((Math.min(...s.months.map((m) => m.pct)) - 10) / 10) * 10))}
          max={100}
          color={col.c}
          height={120}
          animateKey={h.id}
          accessibilityLabel={`Monthly completion: ${s.months.map((m) => `${m.label} ${m.pct}%`).join(', ')}`}
        />
      </Section>
      <Insights bucket={s.bucket} delta={s.delta} />
    </>
  );

  return (
    <Screen footer={<Button label={`Check in · ${s.pct}% today`} onPress={() => checkIn(h.id)} accessibilityHint={`Adds ${h.step} ${h.unit}`} />}>
      <ScreenHeader
        back
        leading={<HabitTile hue={h.hue} icon={h.icon} size={44} />}
        title={h.name}
        subtitle={`${frequencyLabel(h.frequency)} · ${h.timeOfDay} · ${h.goal} ${h.unit}`}
      />
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {hero}
            {stats}
            {hist}
          </View>
          <View style={styles.column}>{charts}</View>
        </View>
      ) : (
        <View style={styles.column}>
          {hero}
          {stats}
          {charts}
          {hist}
        </View>
      )}
    </Screen>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="h2" accessibilityRole="header">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function StreakHero({ streak, longest, color }: { streak: number; longest: number; color: string }) {
  const { c, fixed, dark } = useTheme();
  const id = useSvgId('hero');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tint = splitAlpha(color);
  const breath = useLoop(BREATH_MS);
  const breathStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * breath.value,
    transform: [{ scale: 0.96 + 0.14 * breath.value }],
  }));

  const headline = streak > 0 ? 'You’re doing great.' : 'Ready when you are.';
  const note =
    streak === 0
      ? 'Every reset is a fresh start.'
      : streak >= longest
        ? 'This is your longest streak ever.'
        : `${longest - streak} more ${longest - streak === 1 ? 'day' : 'days'} to beat your best.`;

  return (
    <View
      style={[styles.hero, { borderColor: c.line }]}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      accessible
      accessibilityLabel={`${streak} day streak. ${headline} ${note}`}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={id} cx={0} cy={0} rx={size.width * 1.2} ry={size.height * 1.4} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={tint.color} stopOpacity={dark ? 0.28 : 0.22} />
              <Stop offset="0.6" stopColor={tint.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      )}
      <View style={styles.flameDisc}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 39, backgroundColor: fixed.flameSoft }, breathStyle]} />
        <Flame size={44} />
      </View>
      <View style={styles.heroText}>
        <Text style={styles.streakNum} tabular>
          {streak}
          <Text style={styles.streakUnit}> day streak</Text>
        </Text>
        <Text variant="bodyStrong" style={styles.headline}>{headline}</Text>
        <Text variant="small" color="ink2" style={{ fontSize: 13.5 }}>{note}</Text>
      </View>
    </View>
  );
}

/** 4-up stat strip (SPEC §4.6) between hairlines; numbers shrink a little on narrow phones. */
function StatStrip({ items }: { items: [string, string][] }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const size = width && width < 380 ? 22 : 26;
  return (
    <View style={[styles.strip, { borderColor: c.line }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {items.map(([label, value]) => (
        <View key={label} style={[styles.stat, { flex: 1 }]} accessible accessibilityLabel={`${label} ${value}`}>
          <Text variant="caption" color="ink3" style={{ fontSize: 11 }} numberOfLines={1}>{label}</Text>
          <Text variant="stat" style={{ fontSize: size, lineHeight: size + 4 }} numberOfLines={1}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function HeatmapSection({ s, levels, animateKey }: { s: Stats; levels: readonly string[]; animateKey: string }) {
  const past = s.grid.cols.flat().filter((d) => !d.future);
  const full = past.filter((d) => d.level === 4).length;
  return (
    <Section title="Last 18 weeks" right={<HeatmapLegend levels={levels} />}>
      <Heatmap
        key={animateKey}
        cols={s.grid.cols}
        months={s.grid.months}
        levels={levels}
        accessibilityLabel={`Last 18 weeks: completed on ${full} of ${past.length} days.`}
      />
    </Section>
  );
}

function WeekdaySection({ s, color, dim, animateKey }: { s: Stats; color: string; dim: string; animateKey: string }) {
  const { rates, best, bestLabel } = s.weekday;
  const any = rates[best] > 0;
  return (
    <Section title="By weekday">
      <BarChart
        values={rates}
        max={100}
        labels={DOW}
        colors={(_, i) => (any && i === best ? color : dim)}
        height={96}
        animateKey={animateKey}
        accessibilityLabel={`Completion by weekday: ${WEEKDAYS.map((d, i) => `${d} ${rates[i]}%`).join(', ')}.${any ? ` Best day ${bestLabel} at ${rates[best]}%.` : ''}`}
      />
      <View style={styles.bestRow}>
        <Text variant="small" color="ink3" style={styles.bestText}>
          Best day <Text variant="small" style={[styles.bestText, styles.bold]}>{any ? bestLabel : '—'}</Text>
        </Text>
        <Text variant="small" color="ink3" style={styles.bestText}>
          Best time <Text variant="small" style={[styles.bestText, styles.bold]}>{s.bestTime ?? '—'}</Text>
        </Text>
      </View>
    </Section>
  );
}

function Insights({ bucket, delta }: { bucket: Stats['bucket']; delta: number }) {
  const when = bucket
    ? <Text>You complete this habit most often in the {bucket}.</Text>
    : <Text>Check in a few more times and we’ll spot your best time of day.</Text>;
  const trend =
    delta > 0 ? (
      <Text>You’re <Text variant="bodyStrong">{delta}% more consistent</Text> this month than last.</Text>
    ) : delta < 0 ? (
      <Text>This month is {-delta}% quieter than last — that’s okay.</Text>
    ) : (
      <Text>You’re holding steady — just as consistent as last month.</Text>
    );
  return (
    <View style={[styles.section, { gap: 10 }]}>
      <Text variant="h2" accessibilityRole="header">Insights</Text>
      <InsightRow icon="sparkle">{when}</InsightRow>
      <InsightRow icon="stats">{trend}</InsightRow>
    </View>
  );
}

function InsightRow({ icon, children }: { icon: IconName; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.insight, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Icon name={icon} size={20} color={c.a1text} />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function History({ h, rows, rest, color }: { h: Habit; rows: Stats['history']; rest: Set<string>; color: string }) {
  const { c } = useTheme();
  return (
    <View>
      <Text variant="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>History</Text>
      {rows.map((r, i) => {
        const label = i === 0 ? 'Today' : parseKey(r.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
        const status = r.done
          ? `${h.goal} ${h.unit}`
          : i === 0 || (r.count > 0 && !rest.has(r.date))
            ? `${r.count} of ${h.goal} ${h.unit}`
            : 'Rest day';
        const time = r.time ?? '—';
        return (
          <View
            key={r.date}
            style={[styles.histRow, { borderBottomColor: c.line }]}
            accessible
            accessibilityLabel={`${label}: ${r.done ? 'done' : status}${r.time ? ` at ${r.time}` : ''}`}
          >
            <View style={[styles.dot, { borderColor: r.done ? color : c.line, backgroundColor: r.done ? color : 'transparent' }]}>
              {r.done && <Icon name="check" size={13} color={CHECK_INK} strokeWidth={3.2} />}
            </View>
            <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{label}</Text>
            <Text variant="small" color="ink2">{status}</Text>
            <Text variant="small" color="ink3" align="right" tabular style={styles.time}>{time}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  removed: { alignItems: 'center', gap: space[4], paddingTop: space[10], maxWidth: 360, alignSelf: 'center', width: '100%' },
  columns: { flexDirection: 'row', gap: 28, alignItems: 'flex-start' },
  column: { flex: 1, gap: 26 },
  section: { gap: space[3] },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 22, borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  flameDisc: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  heroText: { flex: 1, gap: 2 },
  streakNum: { fontFamily: fonts.display800, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
  streakUnit: { fontFamily: fonts.display700, fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
  headline: { fontFamily: fonts.body700, fontSize: 15.5, marginTop: 4 },
  strip: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { paddingVertical: space[4], paddingHorizontal: space[1], gap: 2 },
  bestRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[6], rowGap: space[1] },
  bestText: { fontSize: 13.5, lineHeight: 19 },
  bold: { fontFamily: fonts.body700 },
  insight: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: 14, paddingHorizontal: space[4], borderRadius: 20, borderWidth: 1 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 11, borderBottomWidth: 1 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  time: { width: 64, fontSize: 13 },
});
