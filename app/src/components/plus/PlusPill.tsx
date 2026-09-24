import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

/** Small "✦ Plus" marker on anything that's part of Plus. Decorative: callers say "Plus" in their label. */
export function PlusPill({ size = 'md', style }: { size?: 'md' | 'sm'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const sm = size === 'sm';
  return (
    <View
      style={[styles.pill, sm ? styles.sm : styles.md, { backgroundColor: c.a1soft }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="sparkle" size={sm ? 10 : 12} color={c.a1text} strokeWidth={2.4} />
      <Text style={[styles.text, { color: c.a1text, fontSize: sm ? 10.5 : 12 }]}>Plus</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  md: { height: 22, paddingHorizontal: 8, borderRadius: 11 },
  sm: { height: 18, paddingHorizontal: 6, borderRadius: 9 },
  text: { fontFamily: fonts.body700, lineHeight: 15 },
});
