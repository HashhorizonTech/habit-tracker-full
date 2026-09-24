// Habit check-in feedback (SPEC §4.3): sound, haptic, toast, XP, badges and the Perfect Day moment.
import { playSound } from '@/audio/sounds';
import { useData, type StepResult } from '@/store/data';
import { toast } from '@/store/ui';
import { celebrateUnlocks, evaluateBadges, openBadgeModal } from './badges';
import { haptic } from './haptics';

/** Level-up moment: sound + toast, after the triggering feedback settles. */
export function levelUpToast(level: number) {
  setTimeout(() => {
    playSound('levelUp');
    toast(`Level ${level} · keep growing`, 'star');
  }, 1200);
}

/** Check badge progress after an action and celebrate anything newly unlocked. */
function checkBadges(opts: { perfectDay?: boolean } = {}) {
  const ids = evaluateBadges();
  if (opts.perfectDay) {
    // Completing every habit always gets the Perfect Day moment (SPEC §4.3).
    playSound('perfectDay');
    haptic.success();
    openBadgeModal('perfect');
    const rest = ids.filter((id) => id !== 'perfect');
    if (rest.length) setTimeout(() => celebrateUnlocks(rest), 2600);
    return;
  }
  celebrateUnlocks(ids);
}

function feedback(name: string, r: StepResult) {
  if (r.completed) {
    playSound('complete');
    haptic.light();
    toast(`${name} complete · +10 XP`, 'sparkle');
    setTimeout(() => checkBadges({ perfectDay: r.allDone }), 900);
  } else if (r.undone) {
    playSound('undo');
    haptic.selection();
  } else {
    playSound('tick');
    haptic.selection();
  }
  if (r.leveledUp) levelUpToast(r.leveledUp);
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
    setTimeout(() => checkBadges(), 900);
  } else {
    haptic.selection();
  }
  if (r.leveledUp) levelUpToast(r.leveledUp);
  return r.done;
}

export { checkBadges };
