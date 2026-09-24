import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

/** "+6% vs last week" in green; flat or negative changes stay neutral (no guilt). */
export function DeltaChip({ delta, vs }: { delta: number; vs: string }) {
  const { c, fixed } = useTheme();
  const up = delta > 0;
  const label = `${up ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta)}% vs ${vs}`;
  return (
    <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center', backgroundColor: up ? fixed.positiveSoft : c.surface2 }}>
      <Text style={{ fontFamily: fonts.body700, fontSize: 13, lineHeight: 17, color: up ? fixed.positive : c.ink2 }} tabular>
        {label}
      </Text>
    </View>
  );
}
