import { BlurView } from 'expo-blur';
import { createContext, useContext, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, type View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** Ref to the app's root BlurTargetView, so overlays can blur what's underneath on Android. */
export const RootBlurTarget = createContext<RefObject<View | null> | null>(null);

/** Dimmed, blurred backdrop whose opacity follows `progress` (0 → 1). Tap to dismiss. */
export function Backdrop({ progress, onPress, intensity, dim, label }: {
  progress: SharedValue<number>;
  onPress: () => void;
  intensity: number;
  dim: number;
  label: string;
}) {
  const target = useContext(RootBlurTarget);
  const style = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        blurTarget={Platform.OS === 'android' ? target ?? undefined : undefined}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(12, 12, 24, ${dim})` }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      />
    </Animated.View>
  );
}
