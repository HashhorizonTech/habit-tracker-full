import { StyleSheet, View } from 'react-native';
import { playSound } from '@/audio/sounds';
import { Icon, type IconName } from '@/components/icons/Icon';
import { Mascot } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { REST_DAYS } from '@/lib/plusFeatures';
import { useUI } from '@/store/ui';
import { THEME_IDS, useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

export const BENEFITS: { icon: IconName; label: string }[] = [
  { icon: 'leaf', label: 'Unlimited habits' },
  { icon: 'palette', label: `All ${THEME_IDS.length} themes` },
  { icon: 'focus', label: 'Deep & Flow focus + ambient sounds' },
  { icon: 'stats', label: 'Full insights & mood patterns' },
  { icon: 'download', label: 'Data export' },
  { icon: 'shield', label: `${REST_DAYS.plus} rest days a month` },
];

/** Icon tile + label rows listing what Plus includes. */
export function BenefitList() {
  const { c } = useTheme();
  return (
    <View style={styles.list} accessibilityRole="list">
      {BENEFITS.map((b) => (
        <View key={b.label} style={styles.row}>
          <View style={[styles.tile, { backgroundColor: c.a1soft }]}>
            <Icon name={b.icon} size={18} color={c.a1text} />
          </View>
          <Text variant="bodyStrong" style={styles.flex}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

function WelcomePlus({ close }: { close: () => void }) {
  return (
    <View style={styles.welcome}>
      <Mascot size={130} face="wow" accessory="sparkle" />
      <Text variant="h1" align="center" style={styles.welcomeTitle}>Welcome to Plus</Text>
      <Text color="ink2" align="center">Everything’s unlocked. Grow at your own pace.</Text>
      <Button label="Lovely" onPress={close} style={styles.welcomeBtn} />
    </View>
  );
}

/** Confetti card after a successful purchase. */
export function celebratePlus() {
  playSound('achievement');
  haptic.success();
  useUI.getState().openModal((close) => <WelcomePlus close={close} />, 'Welcome to Plus', { burst: true });
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  welcome: { alignItems: 'center', alignSelf: 'stretch', gap: 12 },
  welcomeTitle: { fontSize: 26, lineHeight: 30, fontFamily: fonts.display800 },
  welcomeBtn: { alignSelf: 'stretch', marginTop: 8 },
});
