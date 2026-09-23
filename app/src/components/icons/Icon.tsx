import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { FILLED_ICONS, ICON_PATHS, type IconName } from './paths';

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Force a filled glyph (e.g. the streak flame). */
  filled?: boolean;
}

export const Icon = memo(function Icon({ name, size = 24, color, strokeWidth = 1.9, filled }: IconProps) {
  const fill = filled ?? FILLED_ICONS.has(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={ICON_PATHS[name] ?? ICON_PATHS.sparkle}
        fill={fill ? color : 'none'}
        stroke={fill ? 'none' : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});

export type { IconName };
