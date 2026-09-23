import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { spring } from '@/theme/motion';

/** 52×32 switch: white knob on a spring, track turns a1 when on (SPEC §4.16). */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTheme();
  const t = useSharedValue(value ? 1 : 0);
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    t.set(withSpring(value ? 1 : 0, spring.knob));
    on.set(withTiming(value ? 1 : 0, { duration: 200 }));
  }, [value, t, on]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], [c.track, c.a1]) }), [c.track, c.a1]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * t.value }] }));
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Animated.View style={[{ width: 52, height: 32, borderRadius: 16, padding: 3 }, track]}>
        <Animated.View
          style={[
            { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
            knob,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
