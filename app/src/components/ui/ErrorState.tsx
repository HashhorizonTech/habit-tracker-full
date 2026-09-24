import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Mascot } from '@/components/illustration';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/** Sync failed with nothing local to show (SPEC §4.19): sleepy mascot + moon, retry, small error code. */
export function ErrorState({ onRetry, code, retrying = true }: {
  onRetry: () => void;
  code?: string | null;
  /** The sync engine keeps retrying on a backoff; say so under the code. */
  retrying?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={styles.halo}>
        <Svg width={210} height={210} style={StyleSheet.absoluteFill}>
          <Circle cx={105} cy={105} r={103} stroke={c.line} strokeWidth={1.5} strokeDasharray="4 6" fill={c.a1soft} fillOpacity={0.35} />
        </Svg>
        <Mascot size={130} face="sleepy" accessory="moon" />
      </View>
      <Text variant="h1" align="center" accessibilityRole="header" style={{ fontSize: 24, maxWidth: 300 }}>
        We couldn’t sync just now
      </Text>
      <Text color="ink2" align="center" style={{ maxWidth: 300 }}>
        Nothing is lost — your check-ins are saved on this device and will sync when you’re back online.
      </Text>
      <Button label="Try again" onPress={onRetry} size="md" style={{ marginTop: 8, paddingHorizontal: 28 }} />
      <Text variant="small" color="ink3" align="center">
        Error code {code || 'SYNC-FAILED'}{retrying ? ' · retrying automatically' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 36, paddingHorizontal: 12, minHeight: 520 },
  halo: { width: 210, height: 210, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
