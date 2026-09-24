import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Mask, Path, RadialGradient, Stop } from 'react-native-svg';
import { useLinearLoop } from '@/components/illustration';
import { useSvgId } from '@/lib/useSvgId';
import { splitAlpha, useTheme } from '@/theme';

const WEDGE = 10;
const PERIOD = 18000;

function wedges(r: number): string {
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(r + r * Math.sin(a)).toFixed(2)} ${(r - r * Math.cos(a)).toFixed(2)}`;
  };
  let d = '';
  for (let a = 0; a < 360; a += WEDGE * 2) d += `M${r} ${r} L${pt(a)} A${r} ${r} 0 0 1 ${pt(a + WEDGE)} Z`;
  return d;
}

/**
 * Sunburst behind the unlock coin: alternating 10° a1soft wedges, radially faded,
 * rotating once every 18 s (static under Reduce Motion).
 */
export const BadgeRays = memo(function BadgeRays({ size }: { size: number }) {
  const { c } = useTheme();
  const id = useSvgId('rays');
  const t = useLinearLoop(PERIOD);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360}deg` }] }));
  const r = size / 2;
  const fill = splitAlpha(c.a1soft);
  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <Svg width={size} height={size}>
          <Defs>
            {/* CSS mask: radial-gradient(circle, black 30%, transparent 70%) of the half-diagonal */}
            <RadialGradient id={`${id}g`} cx={r} cy={r} r={r} gradientUnits="userSpaceOnUse">
              <Stop offset="0.42" stopColor="#fff" stopOpacity={1} />
              <Stop offset="0.99" stopColor="#fff" stopOpacity={0} />
            </RadialGradient>
            <Mask id={`${id}m`} x="0" y="0" width={size} height={size} maskUnits="userSpaceOnUse">
              <Circle cx={r} cy={r} r={r} fill={`url(#${id}g)`} />
            </Mask>
          </Defs>
          <G mask={`url(#${id}m)`}>
            <Path d={wedges(r)} fill={fill.color} fillOpacity={fill.opacity} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({ wrap: { position: 'absolute' } });
