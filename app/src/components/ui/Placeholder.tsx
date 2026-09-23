import { StyleSheet, View } from 'react-native';
import { Mascot } from '@/components/illustration';
import { Text } from './Text';

/** Temporary body for screens that later steps build out. */
export function Placeholder({ step, what }: { step: number; what: string }) {
  return (
    <View style={styles.box}>
      <Mascot size={110} face="focus" accessory="coffee" />
      <Text variant="subhead" align="center">{what}</Text>
      <Text color="ink3" align="center">Built in step {step}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { alignItems: 'center', gap: 8, paddingVertical: 48 } });
