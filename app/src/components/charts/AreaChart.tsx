import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { useSvgId } from '@/lib/useSvgId';
import { splitAlpha, useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';
import { fonts } from '@/theme/tokens';

export interface AreaChartProps {
  values: number[];
  /** Value at the bottom of the plot. Defaults to 0. */
  min?: number;
  /** Value at the top of the plot. Defaults to the largest value. */
  max?: number;
  /** Spread evenly under the chart (first / last flush with the edges). */
  labels?: string[];
  color: string;
  height: number;
  /** Change to replay the left → right reveal. */
  animateKey?: string | number;
  accessibilityLabel: string;
}

const STROKE = 3;

/**
 * Smooth cubic line (horizontal-midpoint control points, like the prototype's `linePath`).
 * Points sit between 12% and 96% of the height; returns the line and the closed area.
 */
export function linePath(values: number[], width: number, height: number, min: number, max: number, inset = 0) {
  const n = values.length;
  const span = max - min || 1;
  const w = width - inset * 2;
  const pts = values.map((v, i) => [
    inset + (n === 1 ? w / 2 : (i / (n - 1)) * w),
    height * (0.96 - ((Math.max(min, Math.min(max, v)) - min) / span) * 0.84),
  ]);
  if (!pts.length) return { line: '', area: '' };
  let line = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = ((x0 + x1) / 2).toFixed(1);
    line += ` C${cx} ${y0.toFixed(1)} ${cx} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  const lastX = pts[n - 1][0].toFixed(1);
  const firstX = pts[0][0].toFixed(1);
  return { line, area: `${line} L${lastX} ${height} L${firstX} ${height} Z` };
}

/**
 * Smooth area line chart revealed left → right over 1.2 s (SPEC §5). The reveal is a
 * clipping View whose width animates; animated SVG ClipPath rects don't redraw on Android.
 */
export const AreaChart = memo(function AreaChart({
  values,
  min = 0,
  max,
  labels,
  color,
  height,
  animateKey,
  accessibilityLabel,
}: AreaChartProps) {
  const { reduceMotion } = useTheme();
  const id = useSvgId('area');
  const [width, setWidth] = useState(0);
  const top = max ?? Math.max(min + 1, ...values);
  const { line, area } = linePath(values, width, height, min, top, STROKE / 2);
  const stop = splitAlpha(color);

  // 0 → 1 share of the width that is revealed.
  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  const lastKey = useRef(animateKey);
  useEffect(() => {
    if (!width) return;
    cancelAnimation(reveal);
    if (reduceMotion) {
      reveal.set(1);
      return;
    }
    if (lastKey.current !== animateKey) {
      lastKey.current = animateKey;
      reveal.set(0);
    }
    reveal.set(withTiming(1, { duration: duration.lineReveal, easing: easing.out }));
  }, [animateKey, reduceMotion, width, reveal]);

  const clip = useAnimatedStyle(() => ({ width: reveal.value * width }), [width]);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.View style={[styles.clip, { height }, clip]}>
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={stop.color} stopOpacity={stop.opacity * 0.34} />
                  <Stop offset="1" stopColor={stop.color} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={area} fill={`url(#${id}f)`} />
              <Path d={line} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        )}
      </View>
      {labels && (
        <View style={styles.labels}>
          {labels.map((l, i) => (
            <Text key={i} variant="small" color="ink3" style={styles.label}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  label: { fontSize: 11.5, lineHeight: 15, fontFamily: fonts.body600 },
});
