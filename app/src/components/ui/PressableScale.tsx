import { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { duration, easing, pressScale } from '@/theme/motion';

const APressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** 'icon' presses to .9, default to .96 (SPEC §5). */
  kind?: 'default' | 'icon';
  scaleTo?: number;
}

/** Pressable that scales down on press, on the UI thread. */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { kind = 'default', scaleTo, style, onPressIn, onPressOut, disabled, ...rest },
  ref,
) {
  const s = useSharedValue(1);
  const target = scaleTo ?? pressScale[kind];
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(e) => {
        s.set(withTiming(target, { duration: duration.press, easing: easing.out }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withTiming(1, { duration: duration.press * 1.6, easing: easing.overshoot }));
        onPressOut?.(e);
      }}
      style={[style, animated]}
      {...rest}
    />
  );
});
