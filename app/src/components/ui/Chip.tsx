import { memo } from 'react';
import { Icon, type IconName } from '@/components/icons/Icon';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** 'outline' = filter chips (a1 when on); 'soft' = suggestion chips on surface2. */
  variant?: 'outline' | 'soft';
  size?: 'md' | 'sm';
}

export const Chip = memo(function Chip({ label, selected, onPress, icon, variant = 'outline', size = 'md' }: ChipProps) {
  const { c } = useTheme();
  const h = size === 'md' ? 36 : 32;
  const soft = variant === 'soft';
  const bg = selected ? c.a1 : soft ? c.surface2 : 'transparent';
  const fg = selected ? c.a1ink : c.ink2;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole={soft ? 'button' : 'togglebutton'}
      accessibilityState={soft ? undefined : { checked: !!selected }}
      accessibilityLabel={label}
      hitSlop={(44 - h) / 2}
      style={{
        height: h,
        paddingHorizontal: size === 'md' ? 15 : 11,
        borderRadius: h / 2,
        borderWidth: soft ? 0 : 1,
        borderColor: selected ? c.a1 : c.line,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {icon && <Icon name={icon} size={13} color={fg} strokeWidth={2} />}
      <Text style={{ fontFamily: fonts.body700, fontSize: size === 'md' ? 14 : 12.5, color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
});
