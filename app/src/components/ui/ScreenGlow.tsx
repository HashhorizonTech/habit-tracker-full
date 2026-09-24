import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { settle } from '@/theme/motion';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useSvgId } from '@/lib/useSvgId';
import { splitAlpha, useTheme } from '@/theme';
import { useUI } from '@/store/ui';

/**
 * The soft background tints behind every screen: a1soft top-right, a2soft mid-left
 * (prototype: radial-gradient(420×320 at 90% -5%) + (360×300 at -10% 35%)).
 * Fades out during immersive focus.
 */
export const ScreenGlow = memo(function ScreenGlow({ width, height }: { width: number; height: number }) {
  const { c, reduceMotion } = useTheme();
  const calm = useUI((s) => s.calm);
  const id = useSvgId('glow');
  const a = splitAlpha(c.a1soft);
  const b = splitAlpha(c.a2soft);
  const style = useAnimatedStyle(() => ({ opacity: settle(calm ? 0 : 1, { duration: 800 }, reduceMotion) }), [calm, reduceMotion]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`${id}a`} cx={width * 0.9} cy={height * -0.05} rx={420} ry={320} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={a.color} stopOpacity={a.opacity} />
            <Stop offset="0.7" stopColor={a.color} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}b`} cx={width * -0.1} cy={height * 0.35} rx={360} ry={300} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
            <Stop offset="0.7" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width * 0.9} cy={height * -0.05} rx={420} ry={320} fill={`url(#${id}a)`} />
        <Ellipse cx={width * -0.1} cy={height * 0.35} rx={360} ry={300} fill={`url(#${id}b)`} />
      </Svg>
    </Animated.View>
  );
});
