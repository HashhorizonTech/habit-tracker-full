import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Mascot, type MascotAccessory, type MascotFace } from '@/components/illustration';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/** Mascot in a dashed halo + title + one line + CTA (SPEC §4.19). */
export function EmptyState({ title, body, cta, onPress, face = 'happy', accessory = 'sparkle', icon = 'plus' }: {
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
  face?: MascotFace;
  accessory?: MascotAccessory;
  icon?: 'plus' | null;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.halo}>
        <Svg width={210} height={210} style={StyleSheet.absoluteFill}>
          <Circle cx={105} cy={105} r={103} stroke={c.line} strokeWidth={1.5} strokeDasharray="4 6" fill={c.a1soft} fillOpacity={0.35} />
        </Svg>
        <Mascot size={130} face={face} accessory={accessory} />
      </View>
      <Text variant="h1" align="center" style={{ fontSize: 28, maxWidth: 300 }}>{title}</Text>
      <Text color="ink2" align="center" style={{ maxWidth: 320 }}>{body}</Text>
      {cta && onPress && <Button label={cta} icon={icon ?? undefined} onPress={onPress} size="md" style={{ marginTop: 8, paddingHorizontal: 26 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 12, paddingVertical: 36 },
  halo: { width: 210, height: 210, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
});
