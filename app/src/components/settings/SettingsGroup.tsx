import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { useTheme, useThemedColor } from '@/theme';

/** Surface card (radius 20, 1px line) whose rows are separated by hairlines. */
export function SettingsCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = useThemedColor('surface');
  const border = useThemedColor('line', 'borderColor');
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Animated.View style={[styles.card, bg, border, style]}>
      {rows.map((row, i) => (
        <Fragment key={row.key ?? i}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: c.line }]} />}
          {row}
        </Fragment>
      ))}
    </Animated.View>
  );
}

export interface SettingsGroupProps {
  /** Caption above the group (rendered uppercase). */
  title: string;
  children: ReactNode;
  /** Wrap children in a SettingsCard (default). Off for mixed content such as Appearance. */
  card?: boolean;
}

/** Captioned section: "APPEARANCE", "FOCUS", … followed by a card of rows. */
export function SettingsGroup({ title, children, card = true }: SettingsGroupProps) {
  return (
    <View style={styles.group}>
      <Text variant="caption" color="ink3" accessibilityRole="header">
        {title}
      </Text>
      {card ? <SettingsCard>{children}</SettingsCard> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1 },
});
