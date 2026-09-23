import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

/** −  value  + stepper (Create habit goal, Focus custom preset). */
export function Stepper({ value, onDec, onInc, label, min, max, format }: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  label: string;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: c.surface2, borderColor: c.line }]} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ now: value, min, max }}>
      <IconButton icon="minus" label={`Decrease ${label}`} size={36} iconSize={16} variant="plain" onPress={onDec} disabled={min != null && value <= min} style={{ backgroundColor: c.bg, borderRadius: 11 }} />
      <Text style={{ fontFamily: fonts.display700, fontSize: 18, minWidth: 34, textAlign: 'center' }} tabular>
        {format ? format(value) : value}
      </Text>
      <IconButton icon="plus" label={`Increase ${label}`} size={36} iconSize={16} variant="plain" onPress={onInc} disabled={max != null && value >= max} style={{ backgroundColor: c.bg, borderRadius: 11 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, borderRadius: 15, borderWidth: 1, alignSelf: 'flex-start' },
});
