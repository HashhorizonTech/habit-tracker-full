import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '@/components/icons/Icon';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

export interface SettingsRowProps {
  title: string;
  /** Secondary line under the title (12.5 / ink3). */
  sub?: string;
  /** 38px icon tile on the left. */
  icon?: IconName;
  /** Custom leading element (e.g. the theme swatch); wins over `icon`. */
  leading?: ReactNode;
  /** Switch on the right; the row itself is not pressable. */
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  /** Muted value text on the right, e.g. current theme name. */
  value?: string;
  /** Trailing chevron (or another icon, e.g. `reset`). */
  trailingIcon?: IconName | false;
  /** Custom right-hand slot (segmented control, export formats…). */
  right?: ReactNode;
  /** Content stacked under the title (e.g. ambient sound chips). */
  below?: ReactNode;
  onPress?: () => void;
  /** Spoken hint for pressable rows. */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** One row of a settings card: [icon] title / sub … [toggle | value ›]. */
export function SettingsRow({
  title,
  sub,
  icon,
  leading,
  toggle,
  value,
  trailingIcon,
  right,
  below,
  onPress,
  accessibilityHint,
  style,
}: SettingsRowProps) {
  const { c } = useTheme();
  const trailing = trailingIcon ?? (onPress ? 'chev' : false);

  const lead =
    leading ??
    (icon ? (
      <View style={[styles.tile, { backgroundColor: c.surface2 }]}>
        <Icon name={icon} size={20} color={c.ink2} />
      </View>
    ) : null);

  const main = (
    <View style={[styles.row, below ? styles.column : null]}>
      <View style={styles.line}>
        {lead}
        <View style={styles.titles}>
          <Text variant="bodyStrong">{title}</Text>
          {sub && <Text style={[styles.sub, { color: c.ink3 }]}>{sub}</Text>}
        </View>
        {value != null && <Text style={[styles.value, { color: c.ink3 }]} numberOfLines={1}>{value}</Text>}
        {right}
        {toggle && <Toggle value={toggle.value} onChange={toggle.onChange} label={title} />}
        {trailing && <Icon name={trailing} size={16} strokeWidth={2} color={c.ink3} />}
      </View>
      {below}
    </View>
  );

  if (!onPress) return <View style={[styles.pad, style]}>{main}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.pad, pressed && { backgroundColor: c.surface2 }, style]}
    >
      {main}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingVertical: 14, paddingHorizontal: 16, minHeight: 56, justifyContent: 'center' },
  row: {},
  column: { gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1 },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17 },
  value: { fontFamily: fonts.body500, fontSize: 14, flexShrink: 1 },
});
