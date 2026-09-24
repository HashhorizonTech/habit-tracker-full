import { memo } from 'react';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '@/theme';

/** 1.5px dashed rule. Drawn in SVG because single-side dashed borders don't render on iOS. */
export const DashedDivider = memo(function DashedDivider() {
  const { c } = useTheme();
  return (
    <Svg width="100%" height={2} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={c.line} strokeWidth={1.5} strokeDasharray="5 4" />
    </Svg>
  );
});
