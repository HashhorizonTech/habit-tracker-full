import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';
import { fonts } from '@/theme/tokens';

export interface BarChartProps {
  values: number[];
  /** Value that fills the full height. Defaults to the largest value. */
  max?: number;
  /** One label per bar (empty strings leave a gap). */
  labels?: string[];
  colors: string[] | ((v: number, i: number) => string);
  /** Height of the bar area (labels sit below it). */
  height: number;
  gap?: number;
  /** Widest a bar may get (prototype: 30). */
  maxBarWidth?: number;
  /** Change to replay the grow-from-zero animation (tab / range switches). */
  animateKey?: string | number;
  /** Text summary for screen readers, e.g. "Best day Tuesday at 92%". */
  accessibilityLabel: string;
}

const GROW_MS = 800;
/** Bars never collapse to nothing, so empty days still read as a slot (prototype: max(3%)). */
const MIN_FRACTION = 0.03;

/**
 * Vertical bars that grow from 0 with a stagger (40 ms per bar, 12 ms when dense — SPEC §4.10),
 * rounded tops (10 / 5 px like the prototype), per-bar colours and optional labels.
 */
export const BarChart = memo(function BarChart({
  values,
  max,
  labels,
  colors,
  height,
  gap = 10,
  maxBarWidth = 30,
  animateKey,
  accessibilityLabel,
}: BarChartProps) {
  const [width, setWidth] = useState(0);
  const n = values.length;
  const top = max ?? Math.max(1, ...values);
  const slot = n ? (width - gap * (n - 1)) / n : 0;
  const barW = Math.max(1, Math.min(maxBarWidth, slot));
  const stagger = n > 14 ? duration.chartStaggerDense : duration.chartStagger;
  const colorAt = (v: number, i: number) => (typeof colors === 'function' ? colors(v, i) : colors[i % colors.length]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.row, { height, gap }]}>
        {width > 0 &&
          values.map((v, i) => (
            <View key={i} style={styles.slot}>
              <Bar
                fraction={Math.max(MIN_FRACTION, Math.min(1, v / top))}
                height={height}
                width={barW}
                color={colorAt(v, i)}
                delay={i * stagger}
                animateKey={animateKey}
              />
            </View>
          ))}
      </View>
      {labels && (
        <View style={[styles.labels, { gap }]}>
          {values.map((_, i) => (
            // Labels may be wider than their bar (e.g. "12p"); they overflow the slot, centred.
            <View key={i} style={styles.labelSlot}>
              <Text variant="small" color="ink3" align="center" numberOfLines={1} style={styles.label}>
                {labels[i] ?? ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

function Bar({ fraction, height, width, color, delay, animateKey }: {
  fraction: number;
  height: number;
  width: number;
  color: string;
  delay: number;
  animateKey?: string | number;
}) {
  const { reduceMotion } = useTheme();
  const h = useSharedValue(reduceMotion ? fraction * height : 0);

  const lastKey = useRef(animateKey);

  // Grow to the target: from zero on mount / key change, otherwise glide from the previous value.
  useEffect(() => {
    const target = fraction * height;
    cancelAnimation(h);
    if (reduceMotion) {
      h.set(target);
      return;
    }
    if (lastKey.current !== animateKey) {
      lastKey.current = animateKey;
      h.set(0);
    }
    h.set(withDelay(delay, withTiming(target, { duration: GROW_MS, easing: easing.out })));
  }, [fraction, height, delay, reduceMotion, animateKey, h]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  const r = Math.min(10, width / 2);
  return (
    <Animated.View
      style={[
        style,
        {
          width,
          backgroundColor: color,
          borderTopLeftRadius: r,
          borderTopRightRadius: r,
          borderBottomLeftRadius: Math.min(5, r),
          borderBottomRightRadius: Math.min(5, r),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  labels: { flexDirection: 'row', marginTop: 6 },
  labelSlot: { flex: 1, alignItems: 'center' },
  label: { width: 44, fontSize: 11.5, lineHeight: 15, fontFamily: fonts.body600 },
});
