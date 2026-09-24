// Splash (SPEC §4.1). Plays once per JS runtime over the freshly mounted navigator:
// four circles bloom in, the wordmark fades up, three loader dots pulse, then it fades out.
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { useLoop } from '@/components/illustration';
import { useSvgId } from '@/lib/useSvgId';
import { useTheme } from '@/theme';
import { easing } from '@/theme/motion';
import { fonts } from '@/theme/tokens';

/** Survives remounts (fast refresh, theme changes) so the splash only plays on a cold launch. */
let played = false;

const MARK = 92;
const D = MARK / 2;
const Q = MARK / 4;
/** Prototype tdBloom: cubic-bezier(.3,1.5,.5,1), 0 → 1.1 at 70% → 1. */
const BLOOM = Easing.bezier(0.3, 1.5, 0.5, 1);
const HOLD = 2000;
const FADE = 400;

function Bloom({ left, top, size, color, opacity = 1, delay, dur = 600 }: {
  left: number; top: number; size: number; color: string; opacity?: number; delay: number; dur?: number;
}) {
  const { reduceMotion } = useTheme();
  const s = useSharedValue(reduceMotion ? 1 : 0);
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withDelay(delay, withTiming(1, { duration: dur * 0.7, easing: easing.out })));
    if (!reduceMotion) {
      s.set(
        withDelay(
          delay,
          withSequence(
            withTiming(1.1, { duration: dur * 0.7, easing: BLOOM }),
            withTiming(1, { duration: dur * 0.3, easing: easing.inOut }),
          ),
        ),
      );
    }
  }, [delay, dur, o, s, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: o.value * opacity, transform: [{ scale: s.value }] }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', left, top, width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

function LoaderDot({ delay, color }: { delay: number; color: string }) {
  const t = useLoop(1000, { delay });
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * t.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function SplashOverlay() {
  const [visible, setVisible] = useState(() => !played);
  const [fading, setFading] = useState(false);
  const { c, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const gid = useSvgId('splash');

  const fade = useSharedValue(1);
  const word = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    played = true;
    // Prototype: tdIn .6s with a .6s delay.
    word.set(withDelay(600, withTiming(1, { duration: 600, easing: easing.out })));
    const t1 = setTimeout(() => {
      setFading(true);
      fade.set(withTiming(0, { duration: FADE, easing: easing.out }));
    }, HOLD);
    const t2 = setTimeout(() => setVisible(false), HOLD + FADE + 20);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible, fade, word]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - word.value) * 12 }],
  }));

  if (!visible) return null;
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: c.bg }, rootStyle]}
      pointerEvents={fading ? 'none' : 'auto'}
      accessible
      accessibilityLabel="Tend. Build better days. Loading"
      accessibilityViewIsModal
    >
      {/* radial-gradient(circle at 50% 42%, bg2, bg 70%) */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <RadialGradient
            id={gid}
            cx={width / 2}
            cy={height * 0.42}
            r={Math.hypot(width / 2, height * 0.58)}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={c.bg2} stopOpacity={1} />
            <Stop offset="0.7" stopColor={c.bg} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gid})`} />
      </Svg>

      <View style={{ width: MARK, height: MARK }}>
        <Bloom left={Q} top={0} size={D} color={c.a1} delay={100} />
        <Bloom left={D} top={Q} size={D} color={c.a2} delay={220} />
        <Bloom left={Q} top={D} size={D} color={c.a1} opacity={0.75} delay={340} />
        <Bloom left={0} top={Q} size={D} color={c.a2} opacity={0.75} delay={460} />
        <Bloom left={36} top={36} size={20} color={c.bg} delay={700} dur={500} />
      </View>

      <Animated.View style={[styles.words, wordStyle]}>
        <Text style={styles.wordmark}>tend</Text>
        <Text color="ink2">Build better days</Text>
      </Animated.View>

      <View style={styles.dots}>
        <LoaderDot delay={0} color={c.ink3} />
        <LoaderDot delay={200} color={c.ink3} />
        <LoaderDot delay={400} color={c.ink3} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 95, alignItems: 'center', justifyContent: 'center', gap: 22 },
  words: { alignItems: 'center', gap: 4 },
  wordmark: { fontFamily: fonts.display700, fontSize: 46, lineHeight: 50, letterSpacing: -1.84 },
  dots: { position: 'absolute', bottom: 70, flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
