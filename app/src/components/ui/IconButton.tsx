import { StyleSheet } from 'react-native';
import { Icon, type IconName } from '@/components/icons/Icon';
import { useTheme } from '@/theme';
import { layout } from '@/theme/tokens';
import { PressableScale, type PressableScaleProps } from './PressableScale';

export interface IconButtonProps extends Omit<PressableScaleProps, 'children'> {
  icon: IconName;
  /** Required: every icon button needs a spoken label (SPEC §7). */
  label: string;
  size?: number;
  iconSize?: number;
  variant?: 'surface' | 'accent' | 'plain';
}

/** Round icon button (44px default): back, calendar, close, "+". */
export function IconButton({ icon, label, size = layout.backButton, iconSize = 20, variant = 'surface', style, ...rest }: IconButtonProps) {
  const { c } = useTheme();
  const bg = variant === 'accent' ? c.a1 : variant === 'surface' ? c.surface : 'transparent';
  const fg = variant === 'accent' ? c.a1ink : c.ink;
  return (
    <PressableScale
      kind="icon"
      accessibilityLabel={label}
      hitSlop={size < layout.minTouch ? (layout.minTouch - size) / 2 : 0}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        variant === 'surface' && { borderWidth: 1, borderColor: c.line },
        style,
      ]}
      {...rest}
    >
      <Icon name={icon} size={iconSize} color={fg} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
