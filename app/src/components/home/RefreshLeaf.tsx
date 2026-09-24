import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from 'react-native-reanimated';
import { Mascot, useLoop } from '@/components/illustration';

/**
 * Home pull-to-refresh indicator (SPEC §4.19): the mascot bobbing and rocking on a 0.9 s loop
 * instead of the OS spinner. Mount it while refreshing; it fades in and fades out on unmount.
 * Under Reduce Motion the loop stays still and only the fades remain.
 */
export function RefreshLeaf({ size = 54 }: { size?: number }) {
  const t = useLoop(900);
  const bob = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * t.value }, { rotate: `${(t.value - 0.5) * 12}deg` }],
  }));
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(300)}
      style={styles.box}
      accessibilityLabel="Syncing"
      accessibilityState={{ busy: true }}
    >
      <Animated.View style={bob}>
        <Mascot size={size} face="happy" float={false} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', marginBottom: 8 },
});
