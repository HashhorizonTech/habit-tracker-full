import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Icon } from '@/components/icons/Icon';
import { Burst } from '@/components/ui/Burst';
import { PressableScale } from '@/components/ui/PressableScale';
import { Ring } from '@/components/ui/Ring';
import { useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';

const APath = Animated.createAnimatedComponent(Path);
const CHECK_INK = '#1c1e2d';

export interface CheckButtonProps {
  hue: number;
  progress: number;
  done: boolean;
  onPress: () => void;
  /** Spoken label, e.g. "Drink water, 6 of 8 glasses. Add 1". */
  label: string;
  size?: number;
}

/**
 * 46px check-in button (SPEC §4.3): progress ring + "+" while incomplete. On reaching the
 * goal the colour fill springs in (overshoot ~1.7), the check draws in after 150 ms and a
 * 10-particle burst plays.
 */
export const CheckButton = memo(function CheckButton({ hue, progress, done, onPress, label, size = 46 }: CheckButtonProps) {
  const { habit } = useTheme();
  const col = habit(hue);
  const fill = useSharedValue(done ? 1 : 0);
  const draw = useSharedValue(done ? 1 : 0);
  const [burst, setBurst] = useState(0);
  const wasDone = useRef(done);

  useEffect(() => {
    if (done === wasDone.current) return;
    wasDone.current = done;
    if (done) {
      fill.set(withTiming(1, { duration: 450, easing: easing.overshootStrong }));
      draw.set(withDelay(duration.checkDelay, withTiming(1, { duration: duration.checkDraw, easing: easing.out })));
      setBurst((b) => b + 1);
    } else {
      fill.set(withTiming(0, { duration: 250, easing: easing.out }));
      draw.set(withTiming(0, { duration: 150 }));
    }
  }, [done, fill, draw]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scale: fill.value }] }));
  const plusStyle = useAnimatedStyle(() => ({ opacity: 1 - fill.value }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: 24 * (1 - draw.value) }));
  const inset = size * (5 / 46);

  return (
    <PressableScale
      kind="icon"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ checked: done }}
      style={{ width: size, height: size }}
    >
      <Ring size={size} stroke={size * (3 / 46)} progress={progress} color={col.c} />
      <Animated.View style={[styles.abs, { left: inset, top: inset, right: inset, bottom: inset, borderRadius: size, backgroundColor: col.c }, fillStyle]} />
      <Animated.View style={[styles.center, plusStyle]} pointerEvents="none">
        <Icon name="plus" size={size * 0.43} color={col.text} strokeWidth={2.4} />
      </Animated.View>
      <View style={styles.center} pointerEvents="none">
        <Svg width={size * 0.48} height={size * 0.48} viewBox="0 0 24 24">
          <APath
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={CHECK_INK}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="24"
            animatedProps={checkProps}
          />
        </Svg>
      </View>
      {burst > 0 && <Burst key={burst} color={col.c} />}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  center: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
