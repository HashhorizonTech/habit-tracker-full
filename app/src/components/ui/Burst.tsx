import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '@/theme';

const curve = Easing.bezier(0.15, 0.7, 0.3, 1);

function Particle({ t, i, n, radius, big, color }: { t: SharedValue<number>; i: number; n: number; radius: number; big: boolean; color: string }) {
  const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.25 : 0);
  const d = radius * (0.7 + (i % 3) * 0.17);
  const dx = Math.cos(a) * d;
  const dy = Math.sin(a) * d;
  const s = big ? (i % 3 ? 6 : 9) : i % 2 ? 4 : 6;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: dx * t.value }, { translateY: dy * t.value }, { scale: 1 - 0.8 * t.value }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: -s / 2, top: -s / 2, width: s, height: s, borderRadius: i % 4 === 0 ? 2 : s / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

function Group({ big, color, delay, indices, n, radius }: { big: boolean; color: (i: number) => string; delay: number; indices: number[]; n: number; radius: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: big ? 1200 : 650, easing: curve })));
  }, [t, delay, big]);
  return (
    <>
      {indices.map((i) => (
        <Particle key={i} t={t} i={i} n={n} radius={radius} big={big} color={color(i)} />
      ))}
    </>
  );
}

/**
 * Particle burst (SPEC §4.3 / §5): 10 particles for a habit check, 20-particle confetti
 * for modals. Mount with a new `key` to replay. Renders nothing under Reduce Motion.
 */
export const Burst = memo(function Burst({ color, big = false }: { color?: string; big?: boolean }) {
  const { c, fixed, reduceMotion } = useTheme();
  if (reduceMotion) return null;
  const n = big ? 20 : 10;
  const radius = big ? 130 : 34;
  const base = color ?? c.a1;
  const pick = (i: number) => (i % 3 === 1 ? c.a2 : i % 3 === 2 && big ? fixed.flame : base);
  const all = Array.from({ length: n }, (_, i) => i);
  return (
    <View pointerEvents="none" style={styles.origin}>
      {big ? (
        [0, 1, 2].map((g) => (
          <Group key={g} big color={pick} delay={g * 60} n={n} radius={radius} indices={all.filter((i) => i % 3 === g)} />
        ))
      ) : (
        <Group big={false} color={pick} delay={0} n={n} radius={radius} indices={all} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  origin: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: 3 },
});
