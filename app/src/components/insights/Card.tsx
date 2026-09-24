import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { radius } from '@/theme/tokens';

/** Surface card (radius 24, 1px line border) holding one Insights section. */
export function Card({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>
      {title != null && (
        <View style={styles.head}>
          <Text variant="h2" accessibilityRole="header" style={styles.title}>{title}</Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

/** Two columns on wide layouts, a single stack on phones. */
export function CardGrid({ wide, left, right }: { wide: boolean; left: ReactNode; right: ReactNode }) {
  if (!wide) {
    return (
      <View style={styles.column}>
        {left}
        {right}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={[styles.column, styles.flex]}>{left}</View>
      <View style={[styles.column, styles.flex]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 20, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 19, lineHeight: 23, flexShrink: 1 },
  row: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  column: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
});
