import { BlurTargetView, BlurView } from 'expo-blur';
import { router, usePathname } from 'expo-router';
import { useEffect, useState, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/Icon';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { useUI } from '@/store/ui';
import { alpha, useTheme } from '@/theme';
import { settle, spring } from '@/theme/motion';
import { fonts, layout } from '@/theme/tokens';
import { TABS, type NavItem } from './routes';

const { inset, bottom, height, radius } = layout.tabBar;

function TabButton({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const s = useSharedValue(active ? 1.08 : 1);
  useEffect(() => {
    s.set(withSpring(active ? 1.08 : 1, spring.pop));
  }, [active, s]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const fg = active ? c.a1ink : c.ink2;
  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={iconStyle}>
        <Icon name={item.icon} size={22} color={fg} />
      </Animated.View>
      {/* The bar has a fixed height, so labels grow less than body text (icons carry meaning). */}
      <Text style={[styles.label, { color: fg }]} maxFontSizeMultiplier={1.12} numberOfLines={1} adjustsFontSizeToFit>
        {item.label}
      </Text>
    </Pressable>
  );
}

/**
 * Floating bottom tab bar (SPEC §3): inset 16/22, 68 high, radius 26, frosted sheet @ 82%.
 * The a1 pill springs between tabs (damping ~14, overshoot). Hides during immersive focus.
 */
export function TabBar({ blurTarget }: { blurTarget: RefObject<View | null> }) {
  const { c, dark, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const calm = useUI((s) => s.calm);
  const [width, setWidth] = useState(0);

  const index = Math.max(0, TABS.findIndex((t) => t.match(pathname)));
  const slot = width / TABS.length;
  const x = useSharedValue(0);
  useEffect(() => {
    if (!width) return;
    const target = index * slot + 6;
    x.set(reduceMotion ? withTiming(target, { duration: 200 }) : withSpring(target, spring.tab));
  }, [index, slot, width, reduceMotion, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const hide = useAnimatedStyle(
    () => ({
      opacity: settle(calm ? 0 : 1, { duration: calm ? 350 : 500 }, reduceMotion),
      transform: [{ translateY: settle(calm ? (height + bottom) * 1.5 : 0, { duration: 500 }, reduceMotion) }],
    }),
    [calm, reduceMotion],
  );

  return (
    <Animated.View
      pointerEvents={calm ? 'none' : 'box-none'}
      style={[styles.wrap, { left: inset, right: inset, bottom: bottom + insets.bottom }, hide]}
    >
      <View
        style={[styles.bar, { borderColor: c.line, shadowColor: '#000' }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="tablist"
      >
        <BlurView
          intensity={40}
          tint={dark ? 'dark' : 'light'}
          blurTarget={Platform.OS === 'android' ? blurTarget : undefined}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(c.sheet, 0.82) }]} />
        {width > 0 && (
          <Animated.View
            style={[styles.pill, { width: slot - 12, backgroundColor: c.a1 }, pill]}
          />
        )}
        {TABS.map((t, i) => (
          <TabButton
            key={t.id}
            item={t}
            active={i === index}
            onPress={() => {
              if (i !== index) haptic.selection();
              router.navigate(t.href);
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export { BlurTargetView };

const styles = StyleSheet.create({
  wrap: { position: 'absolute', height },
  bar: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: radius,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  pill: { position: 'absolute', top: 8, bottom: 8, left: 0, borderRadius: 19 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  // Tight line height (the body variant's 21px would leave a gap under the label and push the
  // icon up, making the active pill's top and bottom padding unequal).
  label: { fontFamily: fonts.body700, fontSize: 10.5, lineHeight: 13, letterSpacing: 0.1, includeFontPadding: false },
});
