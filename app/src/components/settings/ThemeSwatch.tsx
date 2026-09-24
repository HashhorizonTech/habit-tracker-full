import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

/** 26px disc split diagonally a2 | a1 (the "Color theme" row, like `linear-gradient(135deg, a2 50%, a1 50%)`). */
export function ThemeSwatch({ size = 26 }: { size?: number }) {
  const { c } = useTheme();
  const inner = size * Math.SQRT2;
  const offset = (size - inner) / 2;
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]} accessible={false}>
      <View style={[styles.split, { width: inner, height: inner, left: offset, top: offset }]}>
        <View style={[styles.half, { backgroundColor: c.a2 }]} />
        <View style={[styles.half, { backgroundColor: c.a1 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { overflow: 'hidden' },
  split: { position: 'absolute', flexDirection: 'row', transform: [{ rotate: '45deg' }] },
  half: { flex: 1 },
});
