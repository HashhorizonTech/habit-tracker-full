// Achievements (SPEC §4.11): badge definitions, progress computed from real data,
// unlock evaluation against the synced `badges` collection, and the unlock modal.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { playSound } from '@/audio/sounds';
import { BadgeCoin } from '@/components/achievements/BadgeCoin';
import { BadgeRays } from '@/components/achievements/BadgeRays';
import type { IconName } from '@/components/icons/paths';
import { Mascot } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { todayKey } from '@/data/dates';
import { doneOn, habitsForDay, liveHabits, overallStreak } from '@/data/selectors';
import type { Collections, Habit, Profile } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { useData } from '@/store/data';
import { toast, useUI } from '@/store/ui';
import { useTheme } from '@/theme';
import { fonts } from '@/theme/tokens';

export type BadgeId = 'spark' | 'momentum' | 'diver' | 'pages' | 'bird' | 'iron' | 'perfect' | 'owl' | 'century';

export interface BadgeDef {
  id: BadgeId;
  name: string;
  desc: string;
  icon: IconName;
  need: number;
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'spark', name: 'First Spark', desc: 'Kept a streak for 7 days', icon: 'flame', need: 7 },
  { id: 'momentum', name: 'Momentum', desc: 'Kept a streak for 30 days', icon: 'trophy', need: 30 },
  { id: 'diver', name: 'Deep Diver', desc: 'Completed 10 focus sessions', icon: 'clock', need: 10 },
  { id: 'pages', name: 'Page Turner', desc: 'Read 100 pages', icon: 'book', need: 100 },
  { id: 'bird', name: 'Early Bird', desc: '10 habits done before 8 AM', icon: 'sun', need: 10 },
  { id: 'iron', name: 'Iron Will', desc: 'Complete 20 workouts', icon: 'dumbbell', need: 20 },
  { id: 'perfect', name: 'Perfect Day', desc: 'Finish every habit in one day', icon: 'star', need: 1 },
  { id: 'owl', name: 'Night Owl', desc: 'Reflect in the evening 14 times', icon: 'moon', need: 14 },
  { id: 'century', name: 'Centurion', desc: 'Reach a 100-day streak', icon: 'bolt', need: 100 },
];

export const badgeById = (id: string) => BADGES.find((b) => b.id === id);

export interface BadgeProgress {
  id: BadgeId;
  have: number;
  need: number;
  unlocked: boolean;
  /** Stored unlock time; null when locked or reached but not yet evaluated. */
  unlockedAt: number | null;
}

export type BadgeData = Pick<Collections, 'habits' | 'habitLogs' | 'focusSessions' | 'moodLogs' | 'badges'> & {
  profile: Pick<Profile, 'streakProtection'>;
};

const EARLY_HOUR = 8;
const NIGHT_HOUR = 20;

const isWorkout = (h: Habit) => h.category === 'Fitness' || h.icon === 'dumbbell';
const isEvening = (h: Habit) => h.timeOfDay === 'Evening' || h.category === 'Evening';
const isJournal = (h: Habit) => /journal|reflect/i.test(h.name);
const isPages = (h: Habit) => h.unit.trim().toLowerCase() === 'pages';

/** Best single day as habits done / habits on the agenda (ratio first, then size). */
function bestDay(habits: Habit[], logs: Collections['habitLogs']): { have: number; need: number } {
  const dates = new Set<string>();
  for (const l of Object.values(logs)) if (!l.deleted && l.count > 0) dates.add(l.date);
  let best = { have: 0, need: habitsForDay(habits, logs, todayKey()).length || habits.length };
  for (const date of dates) {
    const list = habitsForDay(habits, logs, date);
    if (!list.length) continue;
    const have = list.filter((h) => doneOn(logs, h, date)).length;
    const r = have / list.length;
    const br = best.need ? best.have / best.need : 0;
    if (r > br || (r === br && list.length > best.need)) best = { have, need: list.length };
  }
  return best;
}

/** Progress for every badge from the current data. Unlocks already stored always stay unlocked. */
export function badgeProgress(data: BadgeData): BadgeProgress[] {
  const habits = liveHabits(data.habits);
  const byId = new Map(habits.map((h) => [h.id, h]));
  const logs = data.habitLogs;
  const longest = overallStreak(habits, logs, { restDays: data.profile.streakProtection.restDays }).longest;

  let pages = 0;
  let early = 0;
  let workouts = 0;
  let owl = 0;
  for (const l of Object.values(logs)) {
    const h = l.deleted ? undefined : byId.get(l.habitId);
    if (!h) continue;
    if (isPages(h)) pages += l.count;
    const done = l.count >= h.goal;
    if (!done) continue;
    if (isWorkout(h)) workouts++;
    const hour = l.completedAt ? new Date(l.completedAt).getHours() : null;
    if (hour !== null && hour < EARLY_HOUR) early++;
    // Evening habits count whenever they're done; a journal counts when written after 8 PM.
    if (isEvening(h) || (isJournal(h) && hour !== null && hour >= NIGHT_HOUR)) owl++;
  }

  const sessions = Object.values(data.focusSessions).filter((s) => !s.deleted && s.completed && s.mode === 'focus').length;
  const perfect = bestDay(habits, logs);

  const raw: Record<BadgeId, { have: number; need?: number }> = {
    spark: { have: longest },
    momentum: { have: longest },
    diver: { have: sessions },
    pages: { have: pages },
    bird: { have: early },
    iron: { have: workouts },
    perfect: { have: perfect.have, need: Math.max(1, perfect.need) },
    owl: { have: owl },
    century: { have: longest },
  };

  return BADGES.map((b) => {
    const need = raw[b.id].need ?? b.need;
    const have = Math.min(raw[b.id].have, need);
    const stored = data.badges[b.id];
    const unlockedAt = stored && !stored.deleted ? stored.unlockedAt : null;
    return { id: b.id, have, need, unlocked: unlockedAt != null || (need > 0 && have >= need), unlockedAt };
  });
}

/**
 * Compares progress with the stored badges: newly reached ones get `unlockedAt = now`
 * (returned), changed progress is written back. Unchanged badges are never touched.
 */
export function evaluateBadges(): string[] {
  const state = useData.getState();
  const unlocked: string[] = [];
  const now = Date.now();
  for (const p of badgeProgress(state)) {
    const stored = state.badges[p.id];
    const live = stored && !stored.deleted ? stored : null;
    const prev = live?.progress ?? 0;
    if (!live?.unlockedAt && p.have >= p.need) {
      state.setBadge(p.id, { unlockedAt: now, progress: p.have });
      unlocked.push(p.id);
    } else if (p.have !== prev && !(live?.unlockedAt && p.have < prev)) {
      // Once unlocked, stored progress only moves forward.
      state.setBadge(p.id, { progress: p.have });
    }
  }
  return unlocked;
}

export const formatBadgeDate = (ts: number) => new Date(ts).toLocaleString('en', { month: 'short', day: 'numeric' });

/** Sound, haptic and the unlock modal for the first new badge; the rest get a toast. */
export function celebrateUnlocks(ids: string[]) {
  if (!ids.length) return;
  playSound('achievement');
  haptic.success();
  openBadgeModal(ids[0]);
  const more = ids.length - 1;
  if (more > 0) toast(`+${more} more badge${more === 1 ? '' : 's'}`, 'trophy');
}

/** Badge detail / unlock modal. Locked badges show "Almost there · N to go" without confetti. */
export function openBadgeModal(id: string) {
  const def = badgeById(id);
  const p = badgeProgress(useData.getState()).find((x) => x.id === id);
  if (!def || !p) return;
  const label = p.unlocked ? `Achievement unlocked: ${def.name}` : `${def.name}, ${p.have} of ${p.need}`;
  useUI.getState().openModal((close) => <BadgeModal def={def} progress={p} close={close} />, label, { burst: p.unlocked });
}

const STAGE_W = 180;
const STAGE_H = 170;
const COIN = 112;
const POP = Easing.bezier(0.3, 1.6, 0.5, 1);

function BadgeModal({ def, progress, close }: { def: BadgeDef; progress: BadgeProgress; close: () => void }) {
  const { c, reduceMotion } = useTheme();
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    // tdPop: .7 → 1.04 → 1 with the overshoot curve, 100 ms after the card lands.
    if (!reduceMotion) pop.set(withDelay(100, withTiming(1, { duration: 600, easing: POP })));
  }, [pop, reduceMotion]);
  const coinStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value / 0.6),
    transform: [{ scale: 0.7 + 0.3 * pop.value }],
  }));
  const left = progress.need - progress.have;

  return (
    <>
      <View style={styles.stage}>
        <BadgeRays size={STAGE_H - 6} />
        <Animated.View style={coinStyle}>
          <BadgeCoin
            icon={def.icon}
            unlocked={progress.unlocked}
            progress={progress.have / progress.need}
            size={COIN}
            ring={5}
            border={4}
            borderColor={c.sheet}
            iconSize={44}
            iconStroke={1.8}
          />
        </Animated.View>
        <View style={styles.mascot} pointerEvents="none">
          <Mascot size={66} face="wow" />
        </View>
      </View>
      {progress.unlocked && (
        <Text variant="caption" color="a1text" style={styles.caption}>
          Achievement unlocked
        </Text>
      )}
      <Text variant="h1" align="center" style={styles.name}>
        {def.name}
      </Text>
      <Text color="ink2" align="center">
        {def.desc}
      </Text>
      {!progress.unlocked && (
        <View style={styles.progress}>
          <ProgressBar progress={progress.have / progress.need} color={c.a1} height={8} delay={200} />
          <Text variant="small" color="ink3" align="center" tabular>
            Almost there · {left} to go
          </Text>
        </View>
      )}
      <Button label="Nice!" onPress={close} style={styles.cta} />
    </>
  );
}

const styles = StyleSheet.create({
  stage: { width: STAGE_W, height: STAGE_H, alignItems: 'center', justifyContent: 'center' },
  mascot: { position: 'absolute', right: -6, bottom: -4 },
  caption: { fontFamily: fonts.body700, letterSpacing: 1.6, marginTop: 4 },
  name: { fontSize: 26, lineHeight: 30, letterSpacing: -0.52, fontFamily: fonts.display700 },
  progress: { alignSelf: 'stretch', gap: 8, paddingHorizontal: 12, marginTop: 4 },
  cta: { alignSelf: 'stretch', marginTop: 8, height: 52, borderRadius: 17 },
});
