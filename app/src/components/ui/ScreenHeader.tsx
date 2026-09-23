import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResponsive } from '@/lib/responsive';
import { space } from '@/theme/tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Show the 44px round back button (pushed screens). */
  back?: boolean;
  /** Screen is a sidebar destination on desktop, so the back button is hidden there. */
  desktopRoot?: boolean;
  /** Element between back button and title (e.g. habit icon tile). */
  leading?: ReactNode;
  right?: ReactNode;
  /** Caption above the title (e.g. "WEDNESDAY · SEPTEMBER 23"). */
  eyebrow?: string;
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function ScreenHeader({ title, subtitle, back, desktopRoot, leading, right, eyebrow }: ScreenHeaderProps) {
  const { isDesktop } = useResponsive();
  const showBack = back && !(isDesktop && desktopRoot);
  return (
    <View style={styles.row}>
      {showBack && <IconButton icon="chevLeft" label="Back" onPress={goBack} />}
      {leading}
      <View style={styles.titles}>
        {eyebrow && <Text variant="caption" color="ink3">{eyebrow}</Text>}
        <Text variant="h1" accessibilityRole="header" numberOfLines={2}>{title}</Text>
        {subtitle && <Text color="ink2">{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[5], minHeight: 56 },
  titles: { flex: 1, gap: 2 },
});
