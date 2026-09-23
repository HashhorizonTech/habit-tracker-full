import { memo, useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';

const ACircle = Animated.createAnimatedComponent(Circle);

export interface RingProps {
  size: number;
  stroke: number;
  /** 0–1. Animates from the previous value (SPEC §5, 600–900 ms). */
  progress: number;
  color: string;
  track?: string;
  /** Start angle in degrees; -90 = 12 o'clock. */
  rotate?: number;
}

export const Ring = memo(function Ring({ size, stroke, progress, color, track, rotate = -90 }: RingProps) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(Math.max(0, Math.min(1, progress)), { duration: duration.progress, easing: easing.out }));
  }, [progress, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.value) }));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: `${rotate}deg` }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.track} strokeWidth={stroke} fill="none" />
      <ACircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${C} ${C}`}
        animatedProps={props}
      />
    </Svg>
  );
});
