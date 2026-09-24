import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { Text } from '@/components/ui/Text';
import type { DaySummary, PlanRow } from '@/data/summary';
import { useTheme } from '@/theme';
import { fonts, radius, space } from '@/theme/tokens';

function Row({ row, accent }: { row: PlanRow; accent: boolean }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { backgroundColor: accent ? c.a1soft : c.a2soft }]}>
        <Icon name={row.icon} size={17} color={accent ? c.a1text : c.ink} strokeWidth={2} />
      </View>
      <Text style={styles.flex}>
        <Text variant="bodyStrong" style={styles.bold}>{row.lead}</Text>
        <Text color="ink2">{` · ${row.detail}`}</Text>
      </Text>
    </View>
  );
}

/** "Tomorrow · Thursday" plan card: habits, tasks and a suggested focus window. */
export function TomorrowCard({ plan }: { plan: DaySummary['tomorrow'] }) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text variant="caption" color="ink3" style={styles.caption} accessibilityRole="header">
        {`Tomorrow · ${plan.weekday}`}
      </Text>
      <Row row={plan.habits} accent />
      <Row row={plan.tasks} accent={false} />
      <Row row={plan.focus} accent />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: radius.lg, borderWidth: 1, gap: space[1] },
  caption: { marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  bold: { fontFamily: fonts.body700 },
});
