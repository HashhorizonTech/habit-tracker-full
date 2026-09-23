// Habit check-in feedback (SPEC §4.3): sound, haptic, toast, XP and the Perfect Day moment.
import { View } from 'react-native';
import { playSound } from '@/audio/sounds';
import { Mascot } from '@/components/illustration';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useData, type StepResult } from '@/store/data';
import { toast, useUI } from '@/store/ui';
import { haptic } from './haptics';

function celebrateLevel(level: number) {
  setTimeout(() => {
    playSound('levelUp');
    toast(`Level ${level} · keep growing`, 'star');
  }, 1200);
}

/** "Perfect Day" unlock (full achievement modal arrives with Achievements in step 6). */
function celebratePerfectDay() {
  const s = useData.getState();
  if (!s.badges.perfect?.unlockedAt) s.setBadge('perfect', { unlockedAt: Date.now(), progress: 6 });
  playSound('perfectDay');
  haptic.success();
  useUI.getState().openModal(
    (close) => (
      <View style={{ alignItems: 'center', gap: 10, alignSelf: 'stretch' }}>
        <Mascot size={120} face="wow" accessory="star" />
        <Text variant="caption" color="a1text">Achievement unlocked</Text>
        <Text variant="h1" align="center">Perfect Day</Text>
        <Text color="ink2" align="center">Finish every habit in one day</Text>
        <Button label="Nice!" onPress={close} style={{ alignSelf: 'stretch', marginTop: 6 }} />
      </View>
    ),
    'Perfect Day unlocked',
    { burst: true },
  );
}

function feedback(name: string, r: StepResult) {
  if (r.completed) {
    playSound('complete');
    haptic.light();
    toast(`${name} complete · +10 XP`, 'sparkle');
    if (r.allDone) setTimeout(celebratePerfectDay, 900);
  } else if (r.undone) {
    playSound('undo');
    haptic.selection();
  } else {
    playSound('tick');
    haptic.selection();
  }
  if (r.leveledUp) celebrateLevel(r.leveledUp);
}

/** One tap on a habit's check button: +1 step, or undo one step when complete. */
export function checkIn(habitId: string) {
  const s = useData.getState();
  const h = s.habits[habitId];
  if (!h) return;
  feedback(h.name, s.stepHabit(habitId));
}

/** Swipe-to-complete: jump to the goal. */
export function completeNow(habitId: string) {
  const s = useData.getState();
  const h = s.habits[habitId];
  if (!h) return;
  const r = s.completeHabit(habitId);
  if (r.completed) feedback(h.name, r);
}

/** Task checkbox (Home "Up next" and Tasks). */
export function toggleTaskDone(taskId: string) {
  const r = useData.getState().toggleTask(taskId);
  if (r.done) {
    playSound('pop');
    haptic.light();
    toast('Nice — task done · +5 XP', 'check');
  } else {
    haptic.selection();
  }
  if (r.leveledUp) celebrateLevel(r.leveledUp);
  return r.done;
}
