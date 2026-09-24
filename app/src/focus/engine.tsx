// Focus timer side effects: notification scheduling, sounds, ambient loop, keep-awake,
// completion detection (foreground tick + on resume) and the completion modal.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { playSound } from '@/audio/sounds';
import { Mascot } from '@/components/illustration';
import { Burst } from '@/components/ui/Burst';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatMinutes, todayKey } from '@/data/dates';
import { focusMinutesOn, focusStreak } from '@/data/selectors';
import type { FocusMode } from '@/data/types';
import { checkBadges } from '@/lib/checkIn';
import { haptic } from '@/lib/haptics';
import { cancel, scheduleAt } from '@/lib/notifications';
import { useData } from '@/store/data';
import { LONG_EVERY, modeTotal, presetValues, remainingMs, useFocus } from '@/store/focus';
import { usePrefs } from '@/store/prefs';
import { toast, useUI } from '@/store/ui';
import { splitAlpha, useTheme } from '@/theme';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fonts } from '@/theme/tokens';
import { isAmbientLocked } from '@/lib/plusFeatures';
import { isPlusNow } from '@/store/plus';
import { setAmbient, stopAmbient } from './ambient';

const KEEP_AWAKE_TAG = 'tend-focus';

const LABEL: Record<FocusMode, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' };

function syncAmbient() {
  const s = useFocus.getState();
  const ambient = usePrefs.getState().ambient;
  // Ambient sounds are part of Plus (usePlusGuards also resets the pref).
  if (s.status === 'running' && s.mode === 'focus') setAmbient(isAmbientLocked(ambient, isPlusNow()) ? 'Off' : ambient);
  else stopAmbient();
}

async function scheduleEnd() {
  const s = useFocus.getState();
  await cancel(s.notificationId);
  if (s.status !== 'running' || !s.endAt) return;
  const isFocus = s.mode === 'focus';
  const task = s.taskId ? useData.getState().tasks[s.taskId] : null;
  const id = await scheduleAt(new Date(s.endAt), {
    title: isFocus ? 'Focus session complete!' : 'Break’s over.',
    body: isFocus ? `+${presetValues(s).focus} min${task ? ` · ${task.title}` : ''}` : 'Ready when you are.',
    data: { kind: 'focus' },
  });
  // Ignore if the run changed while we were scheduling.
  if (useFocus.getState().endAt === s.endAt) useFocus.getState().setNotificationId(id);
  else await cancel(id);
}

function keepAwake(on: boolean) {
  if (on) activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
  else deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
}

export function startTimer() {
  const s = useFocus.getState();
  s.start();
  playSound('focusStart');
  haptic.medium();
  keepAwake(true);
  syncAmbient();
  void scheduleEnd();
}

export function pauseTimer() {
  const s = useFocus.getState();
  s.pause();
  haptic.selection();
  keepAwake(false);
  syncAmbient();
  void cancel(s.notificationId);
}

export const toggleTimer = () => (useFocus.getState().status === 'running' ? pauseTimer() : startTimer());

export function resetTimer() {
  const s = useFocus.getState();
  void cancel(s.notificationId);
  s.reset();
  haptic.selection();
  keepAwake(false);
  syncAmbient();
}

/** Skip: focus → short break, break → focus (prototype behaviour). */
export function skipTimer() {
  const s = useFocus.getState();
  void cancel(s.notificationId);
  s.setMode(s.mode === 'focus' ? 'short' : 'focus');
  haptic.selection();
  keepAwake(false);
  syncAmbient();
}

export function setTimerMode(mode: FocusMode) {
  const s = useFocus.getState();
  if (s.mode === mode && s.status === 'idle') return;
  void cancel(s.notificationId);
  s.setMode(mode);
  keepAwake(false);
  syncAmbient();
}

/** Dev only: make the running session end in `seconds` (stands in for the prototype's fast timer). */
export function devFinishSoon(seconds = 8) {
  if (!__DEV__) return;
  const s = useFocus.getState();
  if (s.status !== 'running') return;
  const endAt = Date.now() + seconds * 1000;
  useFocus.setState({ endAt, startedAt: endAt - modeTotal(s) });
  void scheduleEnd();
  toast(`Dev: ends in ${seconds}s`, 'focus');
}

/** Start the right break after a focus session: long after every 4th session. */
export function startBreak() {
  const s = useFocus.getState();
  s.setMode(s.cycle >= LONG_EVERY ? 'long' : 'short');
  startTimer();
}

/** Home focus card / Tasks "Focus on this": focus mode, optionally linked, auto-start. */
export function quickFocus(taskId?: string | null) {
  const s = useFocus.getState();
  if (taskId !== undefined) s.setTask(taskId);
  if (s.status === 'running' && s.mode === 'focus') return;
  void cancel(s.notificationId);
  s.setMode('focus');
  startTimer();
}

function FocusCompleteModal({ minutes, close }: { minutes: number; close: () => void }) {
  const { c, fixed } = useTheme();
  const sessions = useData((d) => d.focusSessions);
  const status = useFocus((f) => f.status);
  const today = formatMinutes(focusMinutesOn(sessions, todayKey()).minutes);
  const streak = focusStreak(sessions);
  const autoBreak = status === 'running';
  const glow = splitAlpha(c.glow);
  return (
    <View style={{ alignItems: 'center', alignSelf: 'stretch', gap: 12 }}>
      <View style={styles.hero}>
        <View style={styles.glow}>
          <Svg width={160} height={150}>
            <Defs>
              <RadialGradient id="focusDoneGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={glow.color} stopOpacity={glow.opacity} />
                <Stop offset="0.68" stopColor={glow.color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={160} height={150} fill="url(#focusDoneGlow)" />
          </Svg>
        </View>
        <Mascot size={130} face="wow" accessory="sparkle" />
        <Burst big />
      </View>
      <Text variant="h1" align="center" style={{ fontSize: 26, lineHeight: 30 }}>Focus session complete!</Text>
      <Text style={{ fontFamily: fonts.display700, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 }} color="a1text">
        +{minutes} min
      </Text>
      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: fixed.flameSoft }]}>
          <Text style={[styles.chipText, { color: fixed.flame }]}>Focus streak · {streak}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: c.surface2 }]}>
          <Text style={styles.chipText}>Today · {today}</Text>
        </View>
      </View>
      <Button
        label="Start a break"
        onPress={() => {
          if (!autoBreak) startBreak();
          close();
          setTimeout(checkBadges, 400);
        }}
        style={{ alignSelf: 'stretch', height: 52, borderRadius: 17 }}
      />
      <Button
        label="Done for now"
        variant="ghost"
        size="md"
        onPress={() => {
          if (autoBreak) resetTimer();
          close();
          setTimeout(checkBadges, 400);
        }}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}

/** A run reached zero (in the foreground, or while we were away). */
function completeRun(inForeground: boolean) {
  const s = useFocus.getState();
  if (s.status !== 'running' || !s.endAt) return;
  const endAt = s.endAt;
  const mode = s.mode;
  const minutes = Math.round(modeTotal(s) / 60_000);
  s.finish();
  s.setNotificationId(null);
  keepAwake(false);
  stopAmbient();

  if (mode === 'focus') {
    const data = useData.getState();
    data.addFocusSession({
      start: s.startedAt ?? endAt - minutes * 60_000,
      end: endAt,
      mode: 'focus',
      minutes,
      taskId: s.taskId,
      completed: true,
    });
    if (s.taskId && data.tasks[s.taskId]) data.updateTask(s.taskId, { focusSessions: data.tasks[s.taskId].focusSessions + 1 });
    s.bumpCycle();
    if (inForeground) playSound('focusBell');
    haptic.success();
    if (usePrefs.getState().autoBreak) startBreak();
    useUI.getState().openModal((close) => <FocusCompleteModal minutes={minutes} close={close} />, 'Focus session complete');
  } else {
    if (mode === 'long') useFocus.setState({ cycle: 0 });
    s.setMode('focus');
    if (inForeground) playSound('breakOver');
    haptic.light();
    toast('Break’s over. Ready when you are.', 'focus');
  }
}

/** Mount once at the root: watches the clock while running and on every resume. */
export function useFocusEngine() {
  const status = useFocus((s) => s.status);

  useEffect(() => {
    // After a restart: a run that ended while the app was closed completes now.
    const s = useFocus.getState();
    if (s.status === 'running' && remainingMs(s) <= 0) completeRun(false);
    else if (s.status === 'running') {
      keepAwake(true);
      syncAmbient();
    }
    const sub = AppState.addEventListener('change', (state) => {
      const cur = useFocus.getState();
      if (state === 'active' && cur.status === 'running' && remainingMs(cur) <= 0) completeRun(false);
      // Ambient audio pauses in the background; the notification carries the bell.
      if (state === 'background') stopAmbient();
      if (state === 'active') syncAmbient();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => {
      const cur = useFocus.getState();
      if (AppState.currentState === 'active' && remainingMs(cur) <= 0) completeRun(true);
    }, 500);
    return () => clearInterval(id);
  }, [status]);
}

export { LABEL as FOCUS_LABEL };

const styles = StyleSheet.create({
  hero: { width: 160, height: 150, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', left: 0, top: 0 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center' },
  chipText: { fontFamily: fonts.body700, fontSize: 13 },
});
