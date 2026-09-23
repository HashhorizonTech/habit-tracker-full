import { useEffect } from 'react';
import {
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { easing } from '@/theme/motion';
import { useTheme } from '@/theme';

/**
 * A 0 → 1 → 0 ping-pong loop on the UI thread. Each half takes `period / 2`.
 * Stays at 0 when Reduce Motion is on or `enabled` is false (SPEC §5).
 */
export function useLoop(period: number, { delay = 0, enabled = true } = {}): SharedValue<number> {
  const { reduceMotion } = useTheme();
  const t = useSharedValue(0);
  const on = enabled && !reduceMotion;
  useEffect(() => {
    if (!on) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    t.set(
      withDelay(delay, withRepeat(withTiming(1, { duration: period / 2, easing: easing.inOut }), -1, true)),
    );
    return () => cancelAnimation(t);
  }, [on, period, delay, t]);
  return t;
}

/** A continuous 0 → 1 linear loop (rotation, drift). */
export function useLinearLoop(period: number, { enabled = true } = {}): SharedValue<number> {
  const { reduceMotion } = useTheme();
  const t = useSharedValue(0);
  const on = enabled && !reduceMotion;
  useEffect(() => {
    if (!on) {
      cancelAnimation(t);
      t.set(0);
      return;
    }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration: period, easing: easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [on, period, t]);
  return t;
}
