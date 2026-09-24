import { StyleSheet, View } from 'react-native';
import { BarChart } from '@/components/charts';
import { Icon } from '@/components/icons/Icon';
import { Text } from '@/components/ui/Text';
import { formatMinutes } from '@/data/dates';
import { formatFocusTotal, HOURS, hourLabel, RANGE_LABEL, RANGE_VS, type FocusInsights, type Range } from '@/data/insights';
import { alpha, mix, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { Card, CardGrid } from './Card';
import { DeltaChip } from './DeltaChip';

interface TabProps {
  data: FocusInsights;
  range: Range;
  animateKey: string;
  wide: boolean;
}

/** Focus tab of Insights (SPEC §4.10): total, minutes per bucket, stats, productive hours. */
export function FocusTab({ data, range, animateKey, wide }: TabProps) {
  const overview = <Overview data={data} range={range} animateKey={animateKey} />;
  const hours = <Hours data={data} animateKey={animateKey} />;
  return <CardGrid wide={wide} left={overview} right={hours} />;
}

function Overview({ data, range, animateKey }: Omit<TabProps, 'wide'>) {
  const { c } = useTheme();
  const last = data.bars.length - 1;
  const rest = alpha(mix(c.a1, c.a2, 0.55), 0.75);
  const best = data.bars.indexOf(Math.max(...data.bars));
  return (
    <Card>
      <View style={styles.heroHead}>
        <Text variant="caption" color="ink3">Focused · {RANGE_LABEL[range]}</Text>
        <View style={styles.heroRow}>
          <Text style={[styles.big, { color: c.ink }]} tabular>{formatFocusTotal(data.totalMinutes)}</Text>
          {data.delta != null && <DeltaChip delta={data.delta} vs={RANGE_VS[range]} />}
        </View>
      </View>
      <BarChart
        values={data.bars}
        labels={data.labels}
        colors={(_, i) => (i === last ? c.a1 : rest)}
        height={150}
        gap={data.bars.length > 14 ? 2 : 6}
        maxBarWidth={26}
        animateKey={animateKey}
        accessibilityLabel={
          data.totalMinutes
            ? `Focus minutes, ${RANGE_LABEL[range].toLowerCase()}: ${formatMinutes(data.totalMinutes)} in total, most in one ${range === '1Y' ? 'month' : range === '3M' ? 'week' : 'day'} ${formatMinutes(data.bars[best])}`
            : `No focus minutes ${RANGE_LABEL[range].toLowerCase()}`
        }
      />
      <View style={[styles.stats, { borderColor: c.line }]}>
        <Stat label="Today" value={formatMinutes(data.todayMinutes)} />
        <Stat label="Sessions" value={String(data.sessions)} />
        <Stat label="Avg session" value={data.sessions ? formatMinutes(data.avgSession) : '—'} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text color="ink3" style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} tabular>{value}</Text>
    </View>
  );
}

function Hours({ data, animateKey }: { data: FocusInsights; animateKey: string }) {
  const { c } = useTheme();
  const peak = new Set(data.peak);
  const dim = mix(c.a1, c.track, 0.35);
  const edge = data.morningEdge;
  return (
    <Card
      title="Most productive time"
      right={data.peakLabel && <Text style={[styles.peak, { color: c.a1text }]}>{data.peakLabel}</Text>}
    >
      <BarChart
        values={data.hours}
        labels={HOURS.map(hourLabel)}
        colors={(_, i) => (peak.has(i) ? c.a1 : dim)}
        height={120}
        gap={4}
        animateKey={animateKey}
        accessibilityLabel={
          data.peakLabel ? `Focus sessions by start hour, 6 AM to 10 PM. Busiest ${data.peakLabel}.` : 'No focus sessions in this range yet.'
        }
      />
      {edge != null && (
        <View style={[styles.insight, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="sparkle" size={20} color={c.a1text} />
          <Text style={styles.flex}>
            {edge > 0 ? (
              <>
                Your sessions before 11 AM run{' '}
                <Text style={styles.strong}>{edge} {edge === 1 ? 'minute' : 'minutes'} longer</Text> on average. Protect your mornings.
              </>
            ) : (
              'Your sessions are steady across the day.'
            )}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroHead: { gap: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  big: { fontFamily: fonts.display700, fontSize: 56, lineHeight: 60, letterSpacing: -2.2 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1 },
  stat: { flex: 1, paddingVertical: 14, gap: 2 },
  statLabel: { fontSize: 12.5, lineHeight: 16 },
  statValue: { fontFamily: fonts.display700, fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  peak: { fontFamily: fonts.body700, fontSize: 15 },
  insight: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  strong: { fontFamily: fonts.body700 },
});
