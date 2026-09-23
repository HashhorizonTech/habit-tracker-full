import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { withSpring, withTiming, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons/Icon';
import { Text } from '@/components/ui/Text';
import { useResponsive } from '@/lib/responsive';
import { useUI } from '@/store/ui';
import { useTheme } from '@/theme';
import { duration } from '@/theme/motion';
import { fonts } from '@/theme/tokens';

const enter = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -14 }, { scale: 0.96 }] },
    animations: {
      opacity: withTiming(1, { duration: 250 }),
      transform: [
        { translateY: withSpring(0, { damping: 12, stiffness: 220 }) },
        { scale: withSpring(1, { damping: 12, stiffness: 220 }) },
      ],
    },
  };
};

/** Ink pill at the top with an a1 icon disc; springs in, auto-dismisses after 2.4 s (SPEC §4.19). */
export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const toast = useUI((s) => s.toast);
  const hide = useUI((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.text);
    const id = setTimeout(hide, duration.toast);
    return () => clearTimeout(id);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: isDesktop ? 24 : insets.top + 8 }]}>
      <Animated.View
        key={toast.key}
        entering={enter}
        exiting={FadeOut.duration(200)}
        accessibilityLiveRegion="polite"
        style={[styles.pill, { backgroundColor: c.ink }]}
      >
        <View style={[styles.disc, { backgroundColor: c.a1 }]}>
          <Icon name={toast.icon} size={14} color={c.a1ink} strokeWidth={2.4} />
        </View>
        <Text style={{ fontFamily: fonts.body700, fontSize: 14, color: c.bg }} numberOfLines={1}>
          {toast.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 80, paddingHorizontal: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 999,
    maxWidth: 520,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  disc: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
