import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme';
import { MAX_FONT_SCALE, type as typeScale, type TypeVariant } from '@/theme/tokens';
import type { ColorToken } from '@/theme/palette';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  /** Theme token or a literal colour. */
  color?: ColorToken | (string & {});
  align?: 'left' | 'center' | 'right';
  tabular?: boolean;
}

export function Text({ variant = 'body', color = 'ink', align, tabular, style, ...rest }: TextProps) {
  const { c } = useTheme();
  const resolved = (c as Record<string, string>)[color] ?? color;
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        typeScale[variant],
        { color: resolved },
        align && { textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
