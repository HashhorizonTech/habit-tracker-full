// Loading skeletons (SPEC §4.19): shimmer blocks shaped like the real layout, never a spinner.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useLoop } from '@/components/illustration';
import { alpha, easing, mix, useTheme } from '@/theme';
import { Text } from './Text';

const SHIMMER_MS = 1400;

/** A rounded surface2 block with a lighter band sweeping across it (1.4 s loop; static under Reduce Motion). */
export function Shimmer({
  width = '100%',
  height,
  radius = 8,
  delay = 0,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, reduceMotion } = useTheme();
  const w = useSharedValue(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    t.set(0);
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: SHIMMER_MS, easing: easing.linear }), -1, false)));
    return () => cancelAnimation(t);
  }, [reduceMotion, delay, t]);

  const band = useAnimatedStyle(() => ({
    // Band is as wide as the block and travels from fully left to fully right.
    transform: [{ translateX: -w.value + t.value * 2 * w.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => w.set(e.nativeEvent.layout.width);
  const hi = mix(c.ink, c.surface2, 0.09);

  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius: radius, backgroundColor: c.surface2, overflow: 'hidden' }, style]}
    >
      {!reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, band]}>
          <LinearGradient
            colors={[alpha(hi, 0), hi, alpha(hi, 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** A plain surface2 shape whose opacity breathes (.3 ↔ 1, 1.4 s) — the prototype's `tdDot`. */
function Pulse({ style }: { style: StyleProp<ViewStyle> }) {
  const t = useLoop(SHIMMER_MS);
  const anim = useAnimatedStyle(() => ({ opacity: 1 - 0.7 * t.value }));
  return <Animated.View style={[style, anim]} />;
}

function RowSkeleton({ i }: { i: number }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <Pulse style={[styles.tile, { backgroundColor: c.surface2 }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <Shimmer width="50%" height={12} radius={6} delay={i * 60} />
        <View style={{ width: '30%', height: 10, borderRadius: 5, backgroundColor: c.surface2 }} />
      </View>
      <View style={[styles.check, { borderColor: c.surface2 }]} />
    </View>
  );
}

/**
 * Whole-screen loading state. `home` mirrors Today (title, dial + 3 stats, mood card, 5 rows);
 * `list` is title bars + 5 rows for the other data screens.
 */
export function ScreenSkeleton({ variant = 'home' }: { variant?: 'home' | 'list' }) {
  const { c } = useTheme();
  return (
    <View
      style={styles.box}
      accessible
      accessibilityLabel="Syncing your day"
      accessibilityState={{ busy: true }}
      accessibilityRole="progressbar"
    >
      {variant === 'home' && (
        <>
          <Shimmer width="46%" height={12} radius={6} />
          <Shimmer width="72%" height={28} radius={10} />
          <View style={styles.dialRow}>
            <Pulse style={[styles.dial, { borderColor: c.surface2 }]} />
            <View style={{ flex: 1, gap: 14 }}>
              <Shimmer height={44} radius={14} />
              <Shimmer height={44} radius={14} delay={100} />
              <Shimmer height={44} radius={14} delay={200} />
            </View>
          </View>
          <View style={[styles.mood, { borderColor: c.line }]}>
            <Shimmer width="40%" height={12} radius={6} />
            <View style={styles.moodFaces}>
              {[0, 1, 2, 3, 4].map((k) => (
                <Pulse key={k} style={[styles.face, { backgroundColor: c.surface2 }]} />
              ))}
            </View>
          </View>
        </>
      )}
      {variant === 'list' && (
        <View style={{ gap: 12, marginBottom: 6 }}>
          <Shimmer width="60%" height={12} radius={6} />
          <Shimmer height={40} radius={14} delay={100} />
        </View>
      )}
      {[0, 1, 2, 3, 4].map((i) => (
        <RowSkeleton key={i} i={i} />
      ))}
      <Text variant="small" color="ink3" align="center">Syncing your day…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 22, paddingTop: 10 },
  dialRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  dial: { width: 172, height: 172, borderRadius: 86, borderWidth: 14 },
  mood: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 14 },
  moodFaces: { flexDirection: 'row', justifyContent: 'space-between' },
  face: { width: 40, height: 40, borderRadius: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: 46, height: 46, borderRadius: 16 },
  check: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
});
