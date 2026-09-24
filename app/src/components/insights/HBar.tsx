import { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { easing } from '@/theme/motion';

export interface HBarProps {
  /** 0–1 share of the parent width. */
  fraction: number;
  color: string;
  height?: number;
  /** Draw a full-width track behind the bar. */
  track?: boolean;
  delay?: number;
  duration?: number;
  /** Change to replay the grow-from-zero animation. */
  animateKey?: string | number;
}

/** Horizontal bar that grows its width from 0 (restarts when `animateKey` changes). */
export const HBar = memo(function HBar({ fraction, color, height = 10, track, delay = 0, duration = 900, animateKey }: HBarProps) {
  const { c, reduceMotion } = useTheme();
  const target = Math.max(0, Math.min(1, fraction));
  const w = useSharedValue(reduceMotion ? target : 0);
  const lastKey = useRef(animateKey);

  useEffect(() => {
    cancelAnimation(w);
    if (reduceMotion) {
      w.set(target);
      return;
    }
    if (lastKey.current !== animateKey) {
      lastKey.current = animateKey;
      w.set(0);
    }
    w.set(withDelay(delay, withTiming(target, { duration, easing: easing.out })));
  }, [target, delay, duration, reduceMotion, animateKey, w]);

  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` as `${number}%` }));
  const bar = <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, style]} />;
  if (!track) return bar;
  return <View style={{ height, borderRadius: height / 2, backgroundColor: c.track, overflow: 'hidden' }}>{bar}</View>;
});
