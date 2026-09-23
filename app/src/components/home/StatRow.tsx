import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { fonts } from '@/theme/tokens';

/** "12 days · current streak" style row beside the dial. */
export function StatRow({ icon, iconBg, value, label, onPress, hint }: {
  icon: ReactNode;
  iconBg: string;
  value: string;
  label: string;
  onPress: () => void;
  hint: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${value} ${label}`} accessibilityHint={hint} style={styles.row}>
      <View style={[styles.tile, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.value} numberOfLines={1} tabular>{value}</Text>
        <Text style={styles.label} color="ink3" numberOfLines={1}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: 44 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.display700, fontSize: 20, letterSpacing: -0.4, lineHeight: 23 },
  label: { fontFamily: fonts.body500, fontSize: 12.5, lineHeight: 15 },
});
