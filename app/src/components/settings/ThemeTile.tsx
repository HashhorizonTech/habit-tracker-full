import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from '@/components/icons/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { spring } from '@/theme/motion';
import { getPalette, splitAlpha, type ThemeId } from '@/theme/palette';
import { fonts } from '@/theme/tokens';

const RING = 48;
const STROKE = 6;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Conic ring: a1 for 0–45 %, a2 for 45–72 %, `line` for the rest, starting at 12 o'clock. */
function MiniRing({ a1, a2, line }: { a1: string; a2: string; line: string }) {
  const track = splitAlpha(line);
  const arc = { cx: RING / 2, cy: RING / 2, r: R, fill: 'none', strokeWidth: STROKE, rotation: -90, origin: `${RING / 2}, ${RING / 2}` };
  return (
    <Svg width={RING} height={RING} accessible={false}>
      <Circle {...arc} stroke={track.color} strokeOpacity={track.opacity} />
      <Circle {...arc} stroke={a2} strokeDasharray={`${CIRC * 0.27} ${CIRC}`} strokeDashoffset={-CIRC * 0.45} />
      <Circle {...arc} stroke={a1} strokeDasharray={`${CIRC * 0.45} ${CIRC}`} />
    </Svg>
  );
}

export interface ThemeTileProps {
  id: ThemeId;
  /** Preview in dark or light (the current mode). */
  dark: boolean;
  selected: boolean;
  onSelect: (id: ThemeId) => void;
  width: number;
}

/** Mini preview of a theme in the current mode, with a spring-in check when selected (SPEC §4.17). */
export const ThemeTile = memo(function ThemeTile({ id, dark, selected, onSelect, width }: ThemeTileProps) {
  const { c, reduceMotion } = useTheme();
  const p = getPalette(id, dark);
  const t = p.colors;

  const check = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    const to = selected ? 1 : 0;
    check.set(reduceMotion ? withTiming(to, { duration: 200 }) : withSpring(to, spring.pop));
  }, [selected, reduceMotion, check]);
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, check.value)),
    transform: [{ scale: Math.max(0, check.value) }],
  }));

  return (
    <PressableScale
      onPress={() => onSelect(id)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${p.name} theme`}
      style={[styles.tile, { width, borderColor: selected ? c.a1 : c.line }]}
    >
      <View style={[styles.preview, { backgroundColor: t.bg }]}>
        <View style={[styles.blob, { backgroundColor: t.a1 }]} />
        <MiniRing a1={t.a1} a2={t.a2} line={t.line} />
        <View style={styles.bars}>
          <View style={[styles.bar1, { backgroundColor: t.ink }]} />
          <View style={[styles.bar2, { backgroundColor: t.surface2 }]} />
          <View style={[styles.pill, { backgroundColor: t.a1 }]} />
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={1}>
          {p.name}
        </Text>
        <Animated.View style={[styles.check, { backgroundColor: c.a1 }, checkStyle]}>
          <Icon name="check" size={13} strokeWidth={3.2} color={c.a1ink} />
        </Animated.View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  tile: { gap: 10, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 12, borderRadius: 24, borderWidth: 2 },
  preview: { height: 96, padding: 14, borderRadius: 17, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10 },
  blob: { position: 'absolute', right: -20, top: -24, width: 80, height: 80, borderRadius: 40, opacity: 0.22 },
  bars: { flex: 1, gap: 6 },
  bar1: { height: 7, width: '80%', borderRadius: 4 },
  bar2: { height: 6, width: '55%', borderRadius: 3 },
  pill: { height: 14, width: 44, borderRadius: 7, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, minHeight: 22 },
  name: { fontFamily: fonts.body700, fontSize: 14.5, flexShrink: 1 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
