import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icons/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

/** Gradient "Start a focus session" card (SPEC §4.3). */
export function FocusCard({ minutes, taskTitle, sessions, onPress }: { minutes: number; taskTitle: string; sessions: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`Start a ${minutes} minute focus session on ${taskTitle}. ${sessions} sessions today`} style={[styles.card, { borderColor: c.line }]}>
      <LinearGradient colors={[c.a1soft, c.a2soft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.ringDeco, { borderColor: c.a1soft }]} />
      <View style={[styles.play, { backgroundColor: c.a1, shadowColor: c.a1 }]}>
        <Icon name="play" size={22} color={c.a1ink} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title}>Start a focus session</Text>
        <Text variant="small" color="ink2" numberOfLines={1}>
          {minutes} min · {taskTitle}
        </Text>
        <View style={styles.dots}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < sessions ? c.a1 : c.track }]} />
          ))}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  ringDeco: { position: 'absolute', right: -30, top: -40, width: 130, height: 130, borderRadius: 65, borderWidth: 14 },
  play: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  title: { fontFamily: fonts.display700, fontSize: 18, letterSpacing: -0.3 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 5 },
  dot: { width: 16, height: 5, borderRadius: 3 },
});
