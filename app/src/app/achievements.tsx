import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BadgeGrid } from '@/components/achievements/BadgeGrid';
import { LevelHero } from '@/components/achievements/LevelHero';
import { MilestoneTrack } from '@/components/achievements/MilestoneTrack';
import { DataGate } from '@/components/ui/DataGate';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { liveHabits } from '@/data/selectors';
import { badgeProgress, celebrateUnlocks, evaluateBadges } from '@/lib/badges';
import { useResponsive } from '@/lib/responsive';
import { levelInfo } from '@/lib/xp';
import { useData, useDataHydrated } from '@/store/data';

export default function AchievementsScreen() {
  const { contentWidth } = useResponsive();
  const hydrated = useDataHydrated();
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const focusSessions = useData((s) => s.focusSessions);
  const moodLogs = useData((s) => s.moodLogs);
  const badges = useData((s) => s.badges);
  const profile = useData((s) => s.profile);

  const hasHabits = useMemo(() => liveHabits(habits).length > 0, [habits]);
  const progress = useMemo(
    () => badgeProgress({ habits, habitLogs, focusSessions, moodLogs, badges, profile }),
    [habits, habitLogs, focusSessions, moodLogs, badges, profile],
  );
  const unlocked = progress.filter((p) => p.unlocked).length;

  // Re-check on every visit so progress is fresh and anything newly earned is celebrated.
  useFocusEffect(
    useCallback(() => {
      if (hydrated) celebrateUnlocks(evaluateBadges());
    }, [hydrated]),
  );

  return (
    <Screen>
      <ScreenHeader title="Achievements" back desktopRoot />
      <DataGate>
      {!hasHabits ? (
        <EmptyState
          title="Your first badge is one habit away"
          body="Keep a 7-day streak to unlock First Spark."
          cta="See habits"
          icon={null}
          face="wow"
          accessory="star"
          onPress={() => router.navigate('/habits')}
        />
      ) : (
        <View style={styles.body}>
          <LevelHero xp={profile.xp} />
          <MilestoneTrack level={levelInfo(profile.xp).level} />
          <View style={styles.head}>
            <Text variant="h2" accessibilityRole="header">Badges</Text>
            <Text variant="small" color="ink3" style={styles.count}>
              {unlocked} of {progress.length} unlocked
            </Text>
          </View>
          <BadgeGrid progress={progress} width={contentWidth} />
        </View>
      )}
      </DataGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 24 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { fontSize: 13.5 },
});
