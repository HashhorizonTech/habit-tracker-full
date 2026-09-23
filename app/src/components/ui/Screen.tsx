import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type RefreshControlProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/lib/responsive';
import { useTheme, useThemedColor } from '@/theme';
import { duration, easing } from '@/theme/motion';
import { layout } from '@/theme/tokens';
import { ScreenGlow } from './ScreenGlow';

export interface ScreenProps {
  children: ReactNode;
  /** Screen sits inside the tab navigator: reserve room for the floating tab bar on phones. */
  tab?: boolean;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned below the scroll area (e.g. "Check in" sticky CTA). */
  footer?: ReactNode;
  /** Turned off while a list row is being dragged. */
  scrollEnabled?: boolean;
}

/**
 * Page wrapper: themed background + glows, safe areas, responsive gutters and max width,
 * and the page-enter animation (fade + 12px slide-up, 400 ms) each time the screen gains focus.
 */
export function Screen({ children, tab, scroll = true, refreshControl, contentStyle, footer, scrollEnabled = true }: ScreenProps) {
  const { reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { pad, isDesktop } = useResponsive();
  const bg = useThemedColor('bg');
  const [size, setSize] = useState({ width: 0, height: 0 });

  const enter = useSharedValue(0);
  useFocusEffect(
    useCallback(() => {
      enter.set(0);
      enter.set(withTiming(1, { duration: duration.pageEnter, easing: easing.out }));
    }, [enter]),
  );
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - enter.value) * 12 }],
  }));

  const bottomPad = tab && !isDesktop ? layout.tabBar.height + layout.tabBar.bottom + 42 + insets.bottom : 40 + insets.bottom;
  const inner: StyleProp<ViewStyle> = [
    {
      paddingTop: (isDesktop ? 36 : 6) + insets.top,
      paddingBottom: footer ? 24 : bottomPad,
      paddingHorizontal: pad,
      width: '100%',
      maxWidth: layout.contentMaxWidth + pad * 2,
      alignSelf: 'center',
    },
    contentStyle,
  ];

  return (
    <Animated.View style={[styles.fill, bg]} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {size.width > 0 && <ScreenGlow width={size.width} height={size.height} />}
      <Animated.View style={[styles.fill, enterStyle]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={inner}
            refreshControl={refreshControl}
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, inner]}>{children}</View>
        )}
        {footer && (
          <View style={{ paddingHorizontal: pad, paddingBottom: bottomPad - 16, paddingTop: 12, width: '100%', maxWidth: layout.contentMaxWidth + pad * 2, alignSelf: 'center' }}>
            {footer}
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
