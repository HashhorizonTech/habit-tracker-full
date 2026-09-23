import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from '@/components/ui/Text';
import { fonts } from '@/theme/tokens';

/** Four overlapping circles + "tend" wordmark. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const { c } = useTheme();
  const d = size / 2;
  const q = size / 4;
  const dot = (left: number, top: number, color: string, opacity = 1) => (
    <View style={{ position: 'absolute', left, top, width: d, height: d, borderRadius: d / 2, backgroundColor: color, opacity }} />
  );
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      {dot(q, 0, c.a1)}
      {dot(d, q, c.a2)}
      {dot(q, d, c.a1, 0.75)}
      {dot(0, q, c.a2, 0.75)}
    </View>
  );
}

export function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="header" accessibilityLabel="Tend">
      <LogoMark />
      <Text style={{ fontFamily: fonts.display700, fontSize: 24, letterSpacing: -0.5 }}>tend</Text>
    </View>
  );
}
