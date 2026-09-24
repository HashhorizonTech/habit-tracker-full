import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { playSound } from '@/audio/sounds';
import { Icon } from '@/components/icons/Icon';
import { Mascot, MoodFace, MOODS, moodById } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { todayKey } from '@/data/dates';
import { moodInsight } from '@/data/insights';
import { doneOn, liveHabits } from '@/data/selectors';
import { haptic } from '@/lib/haptics';
import { checkBadges, levelUpToast } from '@/lib/checkIn';
import { useData } from '@/store/data';
import { useTheme } from '@/theme';
import type { MoodId } from '@/theme/palette';
import { fonts } from '@/theme/tokens';

export const MOOD_TAGS = ['Energized', 'Calm', 'Focused', 'Grateful', 'Stressed', 'Tired', 'Social', 'Anxious'];

function Face({ id, label, selected, onPress }: { id: MoodId; label: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const s = useSharedValue(selected ? 1.18 : 1);
  const o = useSharedValue(selected ? 1 : 0.55);
  useEffect(() => {
    s.set(withSpring(selected ? 1.18 : 1, { damping: 9, stiffness: 240 }));
    o.set(withTiming(selected ? 1 : 0.55, { duration: 250 }));
  }, [selected, s, o]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: o.value }));
  return (
    <Pressable onPress={onPress} style={styles.face} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label}>
      <Animated.View style={style}>
        <MoodFace mood={id} size={52} />
      </Animated.View>
      <Text style={{ fontFamily: fonts.body700, fontSize: 12.5, color: selected ? c.ink : c.ink3 }}>{label}</Text>
    </Pressable>
  );
}

/** Mood check-in (SPEC §4.13): pick a face + tags, log it, then a kind confirmation. */
export function MoodSheet({ initial, close }: { initial: MoodId; close: () => void }) {
  const { c } = useTheme();
  const today = todayKey();
  const existing = useData((s) => (s.moodLogs[today] && !s.moodLogs[today].deleted ? s.moodLogs[today] : null));
  const [mood, setMood] = useState<MoodId>(initial);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [saved, setSaved] = useState(false);
  const [earnedXp, setEarnedXp] = useState(false);
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const moods = useData((s) => s.moodLogs);

  const insight = useMemo(() => {
    if (!saved) return null;
    const hs = liveHabits(habits);
    const found = moodInsight(hs, logs, moods, today);
    if (!found) return null;
    const h = hs.find((x) => x.name === found.habitName);
    return { name: found.habitName.toLowerCase(), doneToday: !!h && doneOn(logs, h, today) };
  }, [saved, habits, logs, moods, today]);

  const save = () => {
    const first = !existing;
    const r = useData.getState().logMood({ mood, tags });
    playSound('mood');
    haptic.success();
    setEarnedXp(first);
    setSaved(true);
    if (r.leveledUp) levelUpToast(r.leveledUp);
  };

  if (saved) {
    return (
      <Animated.View entering={FadeIn.duration(400)} style={[styles.col, { gap: 14 }]}>
        <Mascot size={120} face="happy" accessory="sparkle" />
        <Text variant="h2" align="center" style={{ fontSize: 24, lineHeight: 28 }}>Noted. Thanks for checking in.</Text>
        {insight && (
          <View style={[styles.insight, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="sparkle" size={18} color={c.a1text} />
            <Text style={{ flex: 1 }}>
              You tend to feel better on days you complete your <Text variant="bodyStrong">{insight.name}</Text>
              {insight.doneToday ? ' — and you already did today.' : '.'}
            </Text>
          </View>
        )}
        <Button
          label={earnedXp ? 'Done · +5 XP' : 'Done'}
          onPress={() => {
            close();
            setTimeout(checkBadges, 400);
          }}
          style={{ alignSelf: 'stretch' }}
        />
      </Animated.View>
    );
  }

  return (
    <View style={[styles.col, { gap: 22 }]}>
      <Text variant="h2" align="center" style={{ fontSize: 24, lineHeight: 28, marginTop: 4 }} accessibilityRole="header">
        How are you feeling today?
      </Text>
      <View style={styles.faces} accessibilityRole="radiogroup">
        {MOODS.map((m) => (
          <Face
            key={m.id}
            id={m.id}
            label={m.label}
            selected={mood === m.id}
            onPress={() => {
              haptic.selection();
              setMood(m.id);
            }}
          />
        ))}
      </View>
      <View style={styles.tags}>
        {MOOD_TAGS.map((t) => (
          <Chip
            key={t}
            label={t}
            size="sm"
            selected={tags.includes(t)}
            onPress={() => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
          />
        ))}
      </View>
      <Button label={`Log “${moodById(mood).label}”`} onPress={save} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'center' },
  faces: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', maxWidth: 380, width: '100%', alignItems: 'flex-start' },
  face: { alignItems: 'center', gap: 8, width: 64, paddingTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  insight: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignSelf: 'stretch' },
});
