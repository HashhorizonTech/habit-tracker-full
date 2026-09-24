import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { playSound } from '@/audio/sounds';
import { HabitTile } from '@/components/habit/HabitTile';
import { Mascot } from '@/components/illustration';
import { DashedDivider } from '@/components/summary/DashedDivider';
import { DayStats } from '@/components/summary/DayStats';
import { Prose } from '@/components/summary/Prose';
import { TomorrowCard } from '@/components/summary/TomorrowCard';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { goBack } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { buildSummary } from '@/data/summary';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { fonts, space } from '@/theme/tokens';

const MAX_WIDTH = 560;

/** Current time, refreshed each minute so the caption clock stays honest. */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function useDaySummary() {
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const tasks = useData((s) => s.tasks);
  const focusSessions = useData((s) => s.focusSessions);
  const moodLogs = useData((s) => s.moodLogs);
  const restDays = useData((s) => s.profile.streakProtection.restDays);
  const now = useMinuteClock();
  return useMemo(
    () => buildSummary({ habits, habitLogs, tasks, focusSessions, moodLogs, restDays, now }),
    [habits, habitLogs, tasks, focusSessions, moodLogs, restDays, now],
  );
}

function closeDay() {
  playSound('mood');
  toast('Day saved. Sleep well.', 'moon');
  goBack();
}

export default function SummaryScreen() {
  const s = useDaySummary();
  const done = s.tiles.filter((t) => t.done).map((t) => t.name);

  return (
    <Screen>
      <View style={styles.col}>
        <View style={styles.top}>
          <IconButton icon="chevLeft" label="Back" onPress={goBack} />
          <Text variant="caption" color="ink3" style={styles.flex}>{s.caption}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.titles}>
            <Text variant="display" accessibilityRole="header" style={styles.title}>Your day</Text>
            <Text color="ink2" style={styles.sub}>You showed up. That’s what counts.</Text>
          </View>
          <Mascot size={96} face="sleepy" accessory="moon" />
        </View>

        <View>
          <DashedDivider />
          <DayStats s={s} />
          <DashedDivider />
        </View>

        {s.tiles.length > 0 && (
          <View
            accessible
            accessibilityLabel={`${s.habitsDone} of ${s.habitsTotal} habits done${done.length ? `: ${done.join(', ')}` : ''}`}
            style={styles.tiles}
          >
            {s.tiles.map((t) => (
              <HabitTile key={t.id} hue={t.hue} icon={t.icon} size={40} dim={!t.done} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text variant="caption" color="ink3" accessibilityRole="header">Highlights</Text>
          <Prose spans={s.highlights} />
        </View>

        <TomorrowCard plan={s.tomorrow} />

        <Button label="Close the day" onPress={closeDay} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  col: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: space[6] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingTop: 6 },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[3] },
  titles: { flex: 1, gap: 6 },
  title: { fontFamily: fonts.display700, lineHeight: 46 },
  sub: { fontSize: 15.5, lineHeight: 21 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  section: { gap: 10 },
});
