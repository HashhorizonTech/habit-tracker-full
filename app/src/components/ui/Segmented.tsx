import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icon } from '@/components/icons/Icon';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { spring } from '@/theme/motion';
import { fonts } from '@/theme/tokens';
import { Text } from './Text';

export interface SegmentedProps<T extends string> {
  /** `locked` options (part of Plus) show a small sparkle after the label. */
  options: { value: T; label: string; count?: number; locked?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'md' | 'sm';
  /** Scroll horizontally instead of splitting evenly (e.g. 5 frequency options). */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  label?: string;
}

/** Surface2 track with an ink pill that springs to the selected option. */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', scroll, style, label }: SegmentedProps<T>) {
  const { c } = useTheme();
  const [widths, setWidths] = useState<number[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = widths.length === options.length && widths.every((v) => v > 0);

  useEffect(() => {
    if (!ready) return;
    const left = widths.slice(0, index).reduce((a, b) => a + b, 0);
    x.set(withSpring(left, spring.tab));
    w.set(withSpring(widths[index], spring.tab));
  }, [index, ready, widths, x, w]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));
  const h = size === 'md' ? 44 : 36;

  const track = (
    <View
      style={[styles.track, { backgroundColor: c.surface2, borderRadius: size === 'md' ? 16 : 13 }, scroll && styles.trackScroll, !scroll && style]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {ready && <Animated.View style={[styles.pill, { backgroundColor: c.ink, height: h, borderRadius: size === 'md' ? 12 : 10 }, pill]} />}
      {options.map((o, i) => {
        const on = i === index;
        return (
          <Pressable
            key={o.value}
            onLayout={(e) => {
              const width = e.nativeEvent.layout.width;
              setWidths((prev) => {
                if (prev[i] === width) return prev;
                const next = [...prev];
                next[i] = width;
                return next;
              });
            }}
            onPress={() => {
              if (!on) haptic.selection();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.locked ? `${o.label}, Plus` : undefined}
            style={[styles.item, scroll && styles.itemScroll, { height: h }]}
          >
            <View style={styles.labelRow}>
              <Text style={{ fontFamily: fonts.body700, fontSize: size === 'md' ? 15 : 13.5, color: on ? c.bg : c.ink2 }} numberOfLines={1}>
                {o.label}
                {o.count != null && <Text style={{ fontFamily: fonts.body600, fontSize: 12.5, color: on ? c.bg : c.ink3 }}>{`  ${o.count}`}</Text>}
              </Text>
              {o.locked && <Icon name="sparkle" size={11} color={on ? c.bg : c.a1text} strokeWidth={2.4} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  // Many options (e.g. 5 frequencies) size to their labels and scroll instead of squeezing.
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ flexGrow: 1 }}>
        {track}
      </ScrollView>
    );
  }
  return track;
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4 },
  pill: { position: 'absolute', top: 4, left: 4 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trackScroll: { flexGrow: 1 },
  itemScroll: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', paddingHorizontal: 13 },
});
