import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { easing } from '@/theme/motion';
import { fonts } from '@/theme/tokens';

const APath = Animated.createAnimatedComponent(Path);
const R = 86;
const C = 2 * Math.PI * R;

function arc(start: number, len: number) {
  const a0 = start / R;
  const a1 = (start + len) / R;
  const x0 = 100 + R * Math.cos(a0);
  const y0 = 100 + R * Math.sin(a0);
  const x1 = 100 + R * Math.cos(a1);
  const y1 = 100 + R * Math.sin(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${len / R > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function Segment({ i, n, progress, color }: { i: number; n: number; progress: number; color: string }) {
  const { c } = useTheme();
  const seg = C / Math.max(n, 1);
  const L = Math.max(4, seg - (n > 8 ? 12 : 20));
  const d = arc(i * seg, L);
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(i * 60, withTiming(progress, { duration: 900, easing: easing.out })));
  }, [progress, p, i]);
  const fill = useAnimatedProps(() => ({
    strokeDashoffset: L * (1 - p.value),
    strokeOpacity: p.value > 0.005 ? 1 : 0,
  }));
  return (
    <G>
      <Path d={d} fill="none" stroke={c.track} strokeWidth={14} strokeLinecap="round" />
      <APath d={d} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray={[L, L + 1]} animatedProps={fill} />
    </G>
  );
}

/**
 * The day dial (SPEC §4.3): one arc per habit in its colour, filling with progress
 * from 0 on mount. Centre shows the day % ("OF TODAY"). Tap opens Insights.
 */
export const DayDial = memo(function DayDial({ segments, pct, onPress, size = 172 }: {
  segments: { id: string; color: string; progress: number }[];
  pct: number;
  onPress: () => void;
  size?: number;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`Today ${pct}% complete across ${segments.length} habits. Opens insights.`}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200" style={{ transform: [{ rotate: '-80deg' }] }}>
        {segments.map((s, i) => (
          <Segment key={s.id} i={i} n={segments.length} progress={s.progress} color={s.color} />
        ))}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.pct} tabular>
          {pct}
          <Text style={[styles.pctSign]} color="ink3">%</Text>
        </Text>
        <Text variant="caption" color="ink3" style={{ fontSize: 11 }}>of today</Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pct: { fontFamily: fonts.display700, fontSize: 46, letterSpacing: -1.8, lineHeight: 50 },
  pctSign: { fontFamily: fonts.display700, fontSize: 22 },
});
