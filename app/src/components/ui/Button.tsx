import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '@/components/icons/Icon';
import { useTheme } from '@/theme';
import { radius } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const HEIGHT = { lg: 58, md: 48, sm: 40 } as const;

/** CTA button. Primary is the a1 pill with a soft glow; disabled drops to 45% (SPEC §4.5). */
export function Button({ label, onPress, variant = 'primary', size = 'lg', icon, disabled, loading, style, accessibilityHint }: ButtonProps) {
  const { c } = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? c.a1ink : variant === 'secondary' ? c.ink : c.ink2;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[
        styles.base,
        { height: HEIGHT[size], borderRadius: size === 'lg' ? 20 : radius.md },
        primary && { backgroundColor: c.a1, shadowColor: c.a1, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
        variant === 'secondary' && { backgroundColor: c.surface2 },
        disabled && { opacity: 0.45, elevation: 0, shadowOpacity: 0 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={18} color={fg} strokeWidth={2.4} />}
          <Text variant="subhead" color={fg} style={{ fontFamily: 'Figtree_700Bold' }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
