import { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/icons/Icon';
import { Burst } from '@/components/ui/Burst';
import { PressableScale } from '@/components/ui/PressableScale';
import type { Priority } from '@/data/types';
import { useTheme } from '@/theme';
import { spring } from '@/theme/motion';

/** Round task checkbox: priority-coloured ring that fills a1 when done (SPEC §4.8). */
export function TaskCheck({ done, priority, onPress, label }: { done: boolean; priority: Priority; onPress: () => void; label: string }) {
  const { c, fixed } = useTheme();
  const on = useSharedValue(done ? 1 : 0);
  const [burst, setBurst] = useState(0);
  const [prev, setPrev] = useState(done);
  if (prev !== done) {
    setPrev(done);
    if (done) setBurst((b) => b + 1);
  }
  useEffect(() => {
    on.set(done ? withSpring(1, spring.pop) : withTiming(0, { duration: 200 }));
  }, [done, on]);
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(1, on.value), transform: [{ scale: 0.5 + 0.5 * on.value }] }));
  return (
    <PressableScale kind="icon" onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label} hitSlop={9}
      style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: done ? c.a1 : fixed.priority[priority], alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={[{ position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: c.a1, alignItems: 'center', justifyContent: 'center' }, fill]}>
        <Icon name="check" size={15} color={c.a1ink} strokeWidth={2.8} />
      </Animated.View>
      {burst > 0 && <Burst key={burst} color={c.a1} />}
    </PressableScale>
  );
}
