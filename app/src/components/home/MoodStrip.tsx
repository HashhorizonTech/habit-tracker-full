import { StyleSheet, View } from 'react-native';
import { MoodFace, MOODS, moodById } from '@/components/illustration';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatClock } from '@/data/dates';
import type { MoodLog } from '@/data/types';
import { useTheme } from '@/theme';
import type { MoodId } from '@/theme/palette';
import { fonts } from '@/theme/tokens';

/** "How are you feeling?" card (SPEC §4.3). Shows the logged mood once set. */
export function MoodStrip({ today, onPick }: { today: MoodLog | null; onPick: (mood: MoodId) => void }) {
  const { c } = useTheme();
  const card = [styles.card, { backgroundColor: c.surface, borderColor: c.line }];
  if (today) {
    const def = moodById(today.mood);
    return (
      <PressableScale onPress={() => onPick(today.mood)} style={[card, styles.logged]} accessibilityLabel={`Feeling ${def.label}, logged at ${formatClock(today.loggedAt)}. Change`}>
        <MoodFace mood={today.mood} size={42} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Feeling {def.label}</Text>
          <Text variant="small" color="ink3">Logged at {formatClock(today.loggedAt)}</Text>
        </View>
        <Text style={{ fontFamily: fonts.body700, fontSize: 13 }} color="a1text">Change</Text>
      </PressableScale>
    );
  }
  return (
    <View style={[card, { gap: 12 }]}>
      <View style={styles.head}>
        <Text variant="bodyStrong">How are you feeling?</Text>
        <Text variant="small" color="ink3">One tap. No pressure.</Text>
      </View>
      <View style={styles.faces}>
        {MOODS.map((m) => (
          <PressableScale key={m.id} kind="icon" scaleTo={0.9} onPress={() => onPick(m.id)} accessibilityLabel={`Feeling ${m.label}`} hitSlop={4}>
            <MoodFace mood={m.id} size={40} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1 },
  logged: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  faces: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
});
