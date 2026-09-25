import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/icons/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { presetSubtitle, type Preset } from '@/data/presets';
import { useTheme } from '@/theme';
import { easing } from '@/theme/motion';
import { fonts } from '@/theme/tokens';
import { HabitTile } from './HabitTile';

/** a1 check that pops in with overshoot (scale + fade), instant under reduce motion. */
export const Checkbox = memo(function Checkbox({ on }: { on: boolean }) {
  const { c, reduceMotion } = useTheme();
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const to = on ? 1 : 0;
    v.set(reduceMotion ? to : withTiming(to, { duration: 300, easing: easing.overshoot }));
  }, [on, reduceMotion, v]);
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value), transform: [{ scale: 0.5 + 0.5 * v.value }] }));
  return (
    <View style={[styles.box, { borderColor: on ? c.a1 : c.line }]}>
      <Animated.View style={[styles.fill, { backgroundColor: c.a1 }, fill]}>
        <Icon name="check" size={14} color={c.a1ink} strokeWidth={3.2} />
      </Animated.View>
    </View>
  );
});

/**
 * One preset goal: tile, name in the habit colour, "Daily · 8 glasses", checkbox.
 * `added` = already being grown (disabled). `full` = no room left on Free: unchecked rows dim, and the tap
 * still reaches `onPress` so the screen can explain or open Plus.
 */
export const PresetRow = memo(function PresetRow({ preset, on, added, full, fullHint, onPress }: {
  preset: Preset;
  on: boolean;
  added?: boolean;
  full?: boolean;
  /** Read out on unchecked rows while `full`. */
  fullHint?: string;
  onPress: (id: string) => void;
}) {
  const { c, habit } = useTheme();
  const h = habit(preset.hue);
  const sub = presetSubtitle(preset);
  return (
    <PressableScale
      onPress={() => onPress(preset.id)}
      disabled={added}
      scaleTo={0.98}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on || !!added, disabled: !!added }}
      accessibilityLabel={`${preset.name}, ${sub}${added ? ', already added' : ''}`}
      accessibilityHint={full && !on && !added ? fullHint : undefined}
      style={[
        styles.row,
        { backgroundColor: c.surface, borderColor: on ? c.a1 : c.line },
        (added || (full && !on)) && styles.dim,
      ]}
    >
      <HabitTile hue={preset.hue} icon={preset.icon} size={46} />
      <View style={styles.text}>
        <Text style={styles.name} color={h.text} numberOfLines={1}>
          {preset.name}
        </Text>
        <Text variant="small" color="ink3" numberOfLines={2}>
          {sub}
        </Text>
      </View>
      {added ? (
        <Text variant="small" color="ink3" style={styles.added}>
          Added
        </Text>
      ) : (
        <Checkbox on={on} />
      )}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22, borderWidth: 1.5 },
  dim: { opacity: 0.5 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: fonts.body700, fontSize: 15, lineHeight: 20 },
  added: { fontFamily: fonts.body600 },
  box: { width: 26, height: 26, borderRadius: 9, borderWidth: 2 },
  // Covers the border too, so the filled state reads as one solid square.
  fill: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
