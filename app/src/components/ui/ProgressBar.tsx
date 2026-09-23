import { memo, useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { easing } from '@/theme/motion';

/** Thin rounded bar that animates from its previous value (5px on habit rows). */
export const ProgressBar = memo(function ProgressBar({ progress, color, height = 5, delay = 0, style }: {
  progress: number;
  color: string;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withTiming(Math.max(0, Math.min(1, progress)), { duration: 700, easing: easing.out })));
  }, [progress, p, delay]);
  const fill = useAnimatedStyle(() => ({ width: w * p.value }));
  return (
    <View
      style={[{ height, borderRadius: height / 2, backgroundColor: c.track, overflow: 'hidden' }, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, fill]} />
    </View>
  );
});
