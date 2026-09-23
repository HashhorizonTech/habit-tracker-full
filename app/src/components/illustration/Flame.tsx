import { memo } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Icon } from '@/components/icons/Icon';
import { useTheme } from '@/theme';
import { duration } from '@/theme/motion';
import { useLoop } from './useLoop';

/** Streak flame: scale 1 ↔ 1.1, rotate ±3°, 1.6 s loop, pivot near the base (SPEC §5). */
export const Flame = memo(function Flame({ size = 20, animate = true }: { size?: number; animate?: boolean }) {
  const { fixed } = useTheme();
  const t = useLoop(duration.flame, { enabled: animate });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: size * 0.4 },
      { scale: 1 + 0.1 * t.value },
      { rotate: `${-3 + 6 * t.value}deg` },
      { translateY: -size * 0.4 },
    ],
  }));
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Icon name="flame" size={size} color={fixed.flame} filled />
    </Animated.View>
  );
});
