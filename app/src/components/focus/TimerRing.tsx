import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Line, Stop } from 'react-native-svg';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useSvgId } from '@/lib/useSvgId';
import { remainingMs, type TimerStatus, useFocus } from '@/store/focus';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

const ACircle = Animated.createAnimatedComponent(Circle);
const BOX = 290;
const R = 124;
const RC = 2 * Math.PI * R;

/** Re-renders once a second while running; returns remaining ms. Only the digits use it. */
function useRemaining(status: TimerStatus) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [status]);
  return remainingMs(useFocus.getState());
}

const Ticks = memo(function Ticks({ elapsed, size }: { elapsed: number; size: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`} style={StyleSheet.absoluteFill}>
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
        const len = i % 5 === 0 ? 10 : 6;
        const r0 = 145;
        const r1 = 145 - len;
        return (
          <Line
            key={i}
            x1={145 + r0 * Math.cos(a)}
            y1={145 + r0 * Math.sin(a)}
            x2={145 + r1 * Math.cos(a)}
            y2={145 + r1 * Math.sin(a)}
            stroke={i < elapsed ? c.a1 : c.track}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
});

function Digits({ status, total, label, statusText }: { status: TimerStatus; total: number; label: string; statusText: string }) {
  const rem = useRemaining(status);
  const secs = Math.ceil(rem / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const elapsed = Math.floor((1 - rem / Math.max(1, total)) * 60);
  return (
    <>
      <Ticks elapsed={elapsed} size={BOX} />
      <View style={styles.center} pointerEvents="none">
        <Text variant="caption" color="a1text" style={{ letterSpacing: 1.6 }}>{label}</Text>
        <Text style={styles.digits} tabular accessibilityRole="timer" accessibilityLabel={`${Number(mm)} minutes ${Number(ss)} seconds left`}>
          {mm}:{ss}
        </Text>
        <Text variant="small" color="ink3">{statusText}</Text>
      </View>
    </>
  );
}

/**
 * 290px focus timer (SPEC §4.7): 60 ticks (elapsed turn a1), a2→a1 gradient ring that
 * shrinks linearly on the UI thread, and a glowing knob riding the end of the arc.
 */
export function TimerRing({ total, label, statusText, onPress, onLongPress }: { total: number; label: string; statusText: string; onPress: () => void; onLongPress?: () => void }) {
  const { c, reduceMotion } = useTheme();
  const id = useSvgId('ring');
  const status = useFocus((s) => s.status);
  const endAt = useFocus((s) => s.endAt);
  const paused = useFocus((s) => s.pausedRemaining);
  const frac = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(frac);
    const current = () => Math.max(0, Math.min(1, remainingMs(useFocus.getState()) / Math.max(1, total)));
    frac.set(current());
    if (status !== 'running') return;
    if (!reduceMotion) {
      // One linear animation to empty, driven on the UI thread.
      frac.set(withTiming(0, { duration: remainingMs(useFocus.getState()), easing: Easing.linear }));
      return;
    }
    // Reduce Motion: step once a second instead of animating.
    const id = setInterval(() => frac.set(current()), 1000);
    return () => clearInterval(id);
  }, [status, endAt, paused, total, frac, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RC * (1 - frac.value) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ rotate: `${360 * frac.value}deg` }] }));
  const grad = useMemo(() => ({ a: c.a2, b: c.a1 }), [c.a1, c.a2]);

  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress} scaleTo={0.985} accessibilityLabel="Timer. Tap to toggle immersive mode" style={styles.box}>
      <Svg width={BOX} height={BOX} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={grad.a} />
            <Stop offset="1" stopColor={grad.b} />
          </LinearGradient>
        </Defs>
        <Circle cx={145} cy={145} r={R} fill="none" stroke={c.track} strokeWidth={9} />
        <ACircle cx={145} cy={145} r={R} fill="none" stroke={`url(#${id})`} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${RC} ${RC}`} animatedProps={ringProps} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, knob]} pointerEvents="none">
        <View style={[styles.knob, { backgroundColor: c.ink, borderColor: c.a1soft, shadowColor: c.a1 }]} />
      </Animated.View>
      <Digits status={status} total={total} label={label} statusText={statusText} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  box: { width: BOX, height: BOX, marginVertical: 6 },
  center: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 },
  digits: { fontFamily: fonts.display600, fontSize: 66, lineHeight: 72, letterSpacing: -2.6 },
  knob: {
    position: 'absolute',
    left: 131,
    top: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 5,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
