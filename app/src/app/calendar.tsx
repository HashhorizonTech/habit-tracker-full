import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DaySheet } from '@/components/calendar/DaySheet';
import { useCalendarData } from '@/components/calendar/useCalendarData';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import {
  addMonths,
  compareMonths,
  earliestMonth,
  leadingBlanks,
  monthDays,
  monthOf,
  monthStats,
  weekdayLabels,
  type CalendarDay,
  type YearMonth,
} from '@/data/calendar';
import { formatMinutes, MONTHS, todayKey } from '@/data/dates';
import { useResponsive } from '@/lib/responsive';
import { usePrefs } from '@/store/prefs';
import { toast, useUI } from '@/store/ui';
import { mix, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const GAP = 8;
const GRID_MAX = 560;
/** Share of a1 above which cell text flips to a1ink (SPEC §4.9). */
const INK_FLIP = 0.62;

const fillShare = (pct: number) => 0.18 + (pct / 100) * 0.72;

function openDay(day: CalendarDay) {
  if (day.future) {
    toast('Nothing logged yet — it’s in the future', 'calendar');
    return;
  }
  useUI.getState().openSheet((close) => <DaySheet date={day.date} close={close} />, 'Day details');
}

function cellLabel(day: CalendarDay, month: number) {
  const name = `${MONTHS[month]} ${day.day}`;
  if (day.future) return `${name}, upcoming`;
  const focus = day.focusCount ? `, ${day.focusCount} focus session${day.focusCount === 1 ? '' : 's'}` : '';
  return `${day.today ? 'Today, ' : ''}${name}, ${day.pct}% completed${focus}`;
}

const DayCell = memo(function DayCell({ day, month, size }: { day: CalendarDay; month: number; size: number }) {
  const { c } = useTheme();
  const share = day.past ? fillShare(day.pct) : 0;
  const onFill = share > INK_FLIP;
  const fg = day.future ? c.ink3 : onFill ? c.a1ink : c.ink;
  const r = size * 0.3;
  return (
    <PressableScale
      kind="icon"
      onPress={() => openDay(day)}
      accessibilityLabel={cellLabel(day, month)}
      style={[
        styles.cell,
        { width: size, height: size, borderRadius: r },
        day.past ? { backgroundColor: mix(c.a1, c.surface2, share) } : { borderWidth: 1, borderColor: c.line },
      ]}
    >
      {day.today && <View pointerEvents="none" style={[styles.todayRing, { borderRadius: r + 4, borderColor: c.ink }]} />}
      <Text style={[styles.num, { color: fg }]} tabular>{day.day}</Text>
      <View style={styles.dots}>
        {Array.from({ length: Math.min(3, day.focusCount) }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: onFill ? c.a1ink : c.a1text }]} />
        ))}
      </View>
    </PressableScale>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" color="ink3" style={styles.statLabel}>{label}</Text>
      <Text variant="stat">{value}</Text>
    </View>
  );
}

function Legend() {
  const { c } = useTheme();
  return (
    <View style={styles.legend}>
      <View style={styles.legendSide}>
        <Text variant="small" color="ink3" style={styles.legendText}>Lighter</Text>
        {[0.3, 0.55, 0.85].map((p) => (
          <View key={p} style={[styles.swatch, { backgroundColor: mix(c.a1, c.surface2, p) }]} />
        ))}
        <Text variant="small" color="ink3" style={styles.legendText}>Fuller day</Text>
      </View>
      <View style={styles.legendSide}>
        <View style={[styles.legendDot, { backgroundColor: c.a1text }]} />
        <Text variant="small" color="ink3" style={styles.legendText}>focus session</Text>
      </View>
    </View>
  );
}

export default function CalendarScreen() {
  const { c } = useTheme();
  const { contentWidth } = useResponsive();
  const weekStart = usePrefs((s) => s.weekStart);
  const data = useCalendarData();
  const today = todayKey();
  const current = useMemo(() => monthOf(today), [today]);
  const [shown, setShown] = useState<YearMonth>(current);

  const first = useMemo(() => earliestMonth(data, today), [data, today]);
  const last = useMemo(() => addMonths(current, 1), [current]);
  const canPrev = compareMonths(shown, first) > 0;
  const canNext = compareMonths(shown, last) < 0;
  const step = useCallback((n: number) => setShown((m) => addMonths(m, n)), []);

  const days = useMemo(() => monthDays(data, shown, today), [data, shown, today]);
  const stats = useMemo(() => monthStats(days), [days]);
  const blanks = leadingBlanks(shown, weekStart);

  const gridWidth = Math.min(GRID_MAX, contentWidth);
  const cell = Math.floor(((gridWidth - GAP * 6) / 7) * 100) / 100;
  const hairline = { borderColor: c.line };

  if (!data.habits.length) {
    return (
      <Screen>
        <ScreenHeader title="Calendar" back desktopRoot />
        <EmptyState
          title="A blank month"
          body="Every day you show up will glow here."
          cta="Go to Today"
          icon={null}
          face="happy"
          accessory="sun"
          onPress={() => router.navigate('/')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Calendar" back desktopRoot />
      <View style={[styles.body, { width: gridWidth }]}>
        <View style={styles.switcher}>
          <IconButton icon="chevLeft" label="Previous month" size={40} iconSize={18} onPress={() => step(-1)} disabled={!canPrev} style={!canPrev && styles.off} />
          <Text style={styles.month} accessibilityRole="header" accessibilityLiveRegion="polite">
            {MONTHS[shown.month]} {shown.year}
          </Text>
          <IconButton icon="chev" label="Next month" size={40} iconSize={18} onPress={() => step(1)} disabled={!canNext} style={!canNext && styles.off} />
        </View>

        <View style={[styles.strip, hairline]}>
          <Stat label="Avg day" value={stats.avgPct == null ? '—' : `${stats.avgPct}%`} />
          <Stat label="Focused" value={stats.focusMinutes ? formatMinutes(stats.focusMinutes) : '—'} />
          <Stat label="Days logged" value={String(stats.daysLogged)} />
        </View>

        <View style={styles.grid}>
          {weekdayLabels(weekStart).map((l, i) => (
            <Text key={i} variant="small" color="ink3" align="center" style={[styles.weekday, { width: cell }]} importantForAccessibility="no">
              {l}
            </Text>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <View key={`b${i}`} style={{ width: cell, height: cell }} />
          ))}
          {days.map((d) => (
            <DayCell key={d.date} day={d} month={shown.month} size={cell} />
          ))}
        </View>

        <Legend />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { alignSelf: 'center', gap: 20 },
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  off: { opacity: 0.35 },
  month: { fontFamily: fonts.display700, fontSize: 22, lineHeight: 28, letterSpacing: -0.22 },
  strip: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  stat: { flex: 1, paddingVertical: 12, gap: 2 },
  statLabel: { fontSize: 11, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  weekday: { fontFamily: fonts.body700, fontSize: 11.5 },
  cell: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  todayRing: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderWidth: 2 },
  num: { fontFamily: fonts.body700, fontSize: 14, lineHeight: 17 },
  dots: { flexDirection: 'row', gap: 2, height: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  legendSide: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 12 },
  swatch: { width: 14, height: 14, borderRadius: 5 },
  legendDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 1 },
});
