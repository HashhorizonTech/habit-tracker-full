import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useLoop } from '@/components/illustration';
import { useSvgId } from '@/lib/useSvgId';
import { splitAlpha, useTheme } from '@/theme';

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const r = rng(i * 97 + 3);
  r();
  return { left: r(), top: 0.55 + r() * 0.45, size: 3 + r() * 5, duration: 7000 + r() * 8000, delay: r() * 8000, dx: (r() - 0.5) * 80, accent: i % 3 !== 0 };
});

function Particle({ p, height }: { p: (typeof PARTICLES)[number]; height: number }) {
  const { c } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(p.delay, withRepeat(withTiming(1, { duration: p.duration, easing: Easing.linear }), -1, false)));
  }, [t, p]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? (t.value / 0.15) * 0.9 : 0.9 * (1 - (t.value - 0.15) / 0.85),
    transform: [{ translateX: p.dx * t.value }, { translateY: -220 * t.value }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: `${p.left * 100}%`, top: p.top * height * 0.8, width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: p.accent ? c.a1 : c.a2 },
        style,
      ]}
    />
  );
}

/**
 * Immersive focus backdrop (SPEC §4.7): a large breathing radial glow behind the ring
 * (4.5 s loop) and 16 particles drifting upward. Nothing moves under Reduce Motion.
 */
export const Ambience = memo(function Ambience({ ringCenterY }: { ringCenterY: number }) {
  const { c, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const id = useSvgId('breath');
  const breath = useLoop(4500);
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.set(withTiming(1, { duration: 1200 }));
  }, [fade]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: fade.value * (0.55 + 0.45 * breath.value), transform: [{ scale: 0.96 + 0.14 * breath.value }] }));
  const g = splitAlpha(c.a1soft);
  const size = 520;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: width / 2 - size / 2, top: ringCenterY - size / 2, width: size, height: size }, glowStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={id} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={g.color} stopOpacity={Math.min(1, g.opacity * 2.2)} />
              <Stop offset="0.65" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={size} height={size} fill={`url(#${id})`} />
        </Svg>
      </Animated.View>
      {!reduceMotion && PARTICLES.map((p, i) => <Particle key={i} p={p} height={height} />)}
    </View>
  );
});
