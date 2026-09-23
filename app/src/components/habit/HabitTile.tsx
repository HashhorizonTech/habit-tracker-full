import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '@/components/icons/Icon';
import { useTheme } from '@/theme';

/** Rounded icon tile: habit colour at 18% with the icon in the text tone (SPEC §1). */
export const HabitTile = memo(function HabitTile({ hue, icon, size = 46, dim, style }: {
  hue: number;
  icon: IconName;
  size?: number;
  /** Incomplete habits in the daily summary sit at 35%. */
  dim?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { habit } = useTheme();
  const h = habit(hue);
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size * 0.35, backgroundColor: h.soft, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.35 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={size * 0.47} color={h.text} />
    </View>
  );
});
