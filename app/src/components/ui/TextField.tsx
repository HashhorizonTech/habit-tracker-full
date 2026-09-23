import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { useTheme } from '@/theme';
import { fonts, MAX_FONT_SCALE } from '@/theme/tokens';

export interface TextFieldProps extends TextInputProps {
  label: string;
  /** Adds a show/hide toggle. */
  secret?: boolean;
}

/** 54px rounded input matching the Create habit name field. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, secret, style, ...rest }, ref) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secret);
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: focused ? c.a1 : c.line }]}>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={c.ink3}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        secureTextEntry={hidden}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, { color: c.ink }, style]}
        {...rest}
      />
      {secret && (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
          <Icon name="eye" size={20} color={hidden ? c.ink3 : c.a1text} />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { height: 54, borderRadius: 18, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10 },
  input: { flex: 1, height: '100%', fontFamily: fonts.body600, fontSize: 16 },
});
