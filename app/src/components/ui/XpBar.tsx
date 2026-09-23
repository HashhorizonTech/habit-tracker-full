import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { levelInfo } from '@/lib/xp';
import { useData } from '@/store/data';
import { useTheme } from '@/theme';
import { easing } from '@/theme/motion';
import { fonts } from '@/theme/tokens';
import { Text } from './Text';

/** a2 → a1 XP bar that animates from its previous value (SPEC §4.11). */
export function XpBar({ xp, compact }: { xp?: number; compact?: boolean }) {
  const { c } = useTheme();
  const profileXp = useData((s) => s.profile.xp);
  const info = levelInfo(xp ?? profileXp);
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(info.progress, { duration: 1000, easing: easing.out }));
  }, [info.progress, p]);
  const fill = useAnimatedStyle(() => ({ width: w * p.value }));
  return (
    <View style={{ gap: compact ? 10 : 8 }} accessible accessibilityLabel={`Level ${info.level}, ${info.into} of ${info.span} XP`}>
      {compact && (
        <View style={styles.row}>
          <Text style={{ fontFamily: fonts.body700, fontSize: 13 }}>Level {info.level}</Text>
          <Text variant="small" color="ink3" tabular>
            {info.into.toLocaleString()} / {info.span.toLocaleString()}
          </Text>
        </View>
      )}
      <View style={[styles.track, { backgroundColor: c.track, height: compact ? 6 : 8 }]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.fill, fill]}>
          <LinearGradient colors={[c.a2, c.a1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
});
