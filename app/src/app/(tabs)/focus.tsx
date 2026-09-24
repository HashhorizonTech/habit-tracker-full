import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Ambience } from '@/components/focus/Ambience';
import { TimerRing } from '@/components/focus/TimerRing';
import { Icon } from '@/components/icons/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { formatMinutes, todayKey } from '@/data/dates';
import { focusMinutesOn, focusStreak, liveList } from '@/data/selectors';
import type { FocusMode } from '@/data/types';
import { devFinishSoon, FOCUS_LABEL, resetTimer, setTimerMode, skipTimer, toggleTimer } from '@/focus/engine';
import { useData } from '@/store/data';
import { modeTotal, PRESETS, presetValues, useFocus } from '@/store/focus';
import { useUI } from '@/store/ui';
import { useTheme } from '@/theme';
import { duration, settle, spring } from '@/theme/motion';
import { fonts, space } from '@/theme/tokens';

const MODES: { value: FocusMode; label: string }[] = [
  { value: 'focus', label: 'Focus' },
  { value: 'short', label: 'Short break' },
  { value: 'long', label: 'Long break' },
];

/** Header, mode switch, presets and footer fade out while calm (600 ms). */
function Calm({ calm, children, style }: { calm: boolean; children: React.ReactNode; style?: object }) {
  const { reduceMotion } = useTheme();
  const s = useAnimatedStyle(() => ({ opacity: settle(calm ? 0 : 1, { duration: duration.calmFade }, reduceMotion) }), [calm, reduceMotion]);
  return (
    <Animated.View style={[style, s]} pointerEvents={calm ? 'none' : 'auto'} collapsable={false}>
      {children}
    </Animated.View>
  );
}

function RoundButton({ icon, label, onPress, size, accent, spin }: { icon: 'reset' | 'skip' | 'play' | 'pause'; label: string; onPress: () => void; size: number; accent?: boolean; spin?: boolean }) {
  const { c } = useTheme();
  const rot = useSharedValue(0);
  const pop = useSharedValue(1);
  useEffect(() => {
    // Play/pause icon morphs with a pop.
    if (accent) pop.set(withSequence(withTiming(0.6, { duration: 90 }), withSpring(1, spring.pop)));
  }, [icon, accent, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }, { scale: pop.value }] }));
  return (
    <PressableScale
      kind="icon"
      onPress={() => {
        if (spin) rot.set(withSequence(withTiming(-40, { duration: 160 }), withSpring(0, spring.pop)));
        onPress();
      }}
      accessibilityLabel={label}
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
        accent
          ? { backgroundColor: c.a1, shadowColor: c.a1, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 14 }, elevation: 10 }
          : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
      ]}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={accent ? 30 : 22} color={accent ? c.a1ink : c.ink} strokeWidth={2.1} />
      </Animated.View>
    </PressableScale>
  );
}

function PresetCard({ name, value, on, onPress }: { name: string; value: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${name} preset, ${value} minutes`}
      style={[styles.preset, { borderColor: on ? c.a1 : c.line, backgroundColor: on ? c.a1 : 'transparent' }]}
    >
      <Text style={{ fontFamily: fonts.body700, fontSize: 13.5, color: on ? c.a1ink : c.ink2 }}>{name}</Text>
      <Text style={{ fontFamily: fonts.body500, fontSize: 12, color: on ? c.a1ink : c.ink2, opacity: 0.85 }} tabular>{value}</Text>
    </PressableScale>
  );
}

function CustomStepper({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  const { c } = useTheme();
  const btn = { width: 32, height: 32, borderRadius: 10, backgroundColor: c.surface2, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={[styles.custom, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text variant="small" color="ink2">
        {label} <Text style={{ fontFamily: fonts.body700, fontSize: 13 }}>{value}m</Text>
      </Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <PressableScale kind="icon" onPress={onDec} style={btn} accessibilityLabel={`Shorter ${label.toLowerCase()}`} hitSlop={6}>
          <Icon name="minus" size={15} color={c.ink} strokeWidth={2.4} />
        </PressableScale>
        <PressableScale kind="icon" onPress={onInc} style={btn} accessibilityLabel={`Longer ${label.toLowerCase()}`} hitSlop={6}>
          <Icon name="plus" size={15} color={c.ink} strokeWidth={2.4} />
        </PressableScale>
      </View>
    </View>
  );
}

export default function FocusScreen() {
  const { c } = useTheme();
  const f = useFocus();
  const tasksMap = useData((s) => s.tasks);
  const sessions = useData((s) => s.focusSessions);
  const setCalm = useUI((s) => s.setCalm);
  const [immersive, setImmersive] = useState(false);
  const [ringY, setRingY] = useState(360);

  const running = f.status === 'running';
  const calm = running || immersive;
  const total = modeTotal(f);
  const preset = presetValues(f);

  // Immersive mode also hides the tab bar and background glows (via the UI store).
  useFocusEffect(
    useCallback(() => {
      setCalm(calm);
      return () => setCalm(false);
    }, [calm, setCalm]),
  );

  const undone = useMemo(
    () => liveList(tasksMap).filter((t) => !t.done).sort((a, b) => (a.list === b.list ? (a.time ?? '99').localeCompare(b.time ?? '99') : a.list === 'today' ? -1 : 1)),
    [tasksMap],
  );
  const task = (f.taskId && tasksMap[f.taskId] && !tasksMap[f.taskId].deleted ? tasksMap[f.taskId] : null) ?? undone[0] ?? null;

  const today = focusMinutesOn(sessions, todayKey());
  const streak = focusStreak(sessions);
  const hasAny = Object.values(sessions).some((s) => !s.deleted && s.completed);

  const statusText = running
    ? 'In session'
    : f.status === 'paused'
      ? 'Paused'
      : f.mode === 'focus'
        ? `${preset.focus} min session`
        : 'Take a breath';

  const choosePreset = (i: number) => {
    if (i === f.preset && f.status !== 'idle') return;
    resetTimer();
    if (i === 3) f.setCustom(f.customFocus, f.customBreak);
    else f.setPreset(i);
  };

  const cycleTask = () => {
    if (!undone.length) return;
    const i = task ? undone.findIndex((t) => t.id === task.id) : -1;
    f.setTask(undone[(i + 1) % undone.length].id);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen tab contentStyle={{ alignItems: 'center', gap: 22 }}>
        {calm && <Ambience ringCenterY={ringY} />}
        <Calm calm={calm} style={styles.header}>
          <Text variant="h1" accessibilityRole="header">Focus</Text>
          <PressableScale onPress={() => router.navigate({ pathname: '/insights', params: { tab: 'focus' } })} style={[styles.pill, { backgroundColor: c.surface, borderColor: c.line }]} accessibilityLabel="Focus insights">
            <Icon name="stats" size={16} color={c.ink} />
            <Text style={{ fontFamily: fonts.body700, fontSize: 13.5 }}>Insights</Text>
          </PressableScale>
        </Calm>

        <Calm calm={calm} style={{ width: '100%', maxWidth: 360 }}>
          <Segmented options={MODES} value={f.mode} onChange={setTimerMode} size="sm" label="Timer mode" />
        </Calm>

        <View onLayout={(e) => setRingY(e.nativeEvent.layout.y + 145 + 60)}>
          <TimerRing total={total} label={FOCUS_LABEL[f.mode]} statusText={statusText} onPress={() => !running && setImmersive((v) => !v)} onLongPress={__DEV__ ? () => devFinishSoon() : undefined} />
        </View>

        <PressableScale onPress={cycleTask} style={[styles.taskChip, { borderColor: c.line }]} accessibilityLabel={`Working on ${task?.title ?? 'Deep work'}. Tap to switch task`}>
          <Icon name="link" size={16} color={c.ink2} />
          <Text variant="small" color="ink2" numberOfLines={1} style={{ flexShrink: 1 }}>
            Working on <Text style={{ fontFamily: fonts.body700, fontSize: 13 }}>{task?.title ?? 'Deep work'}</Text>
          </Text>
        </PressableScale>

        <View style={styles.controls}>
          <RoundButton icon="reset" label="Reset" size={54} onPress={resetTimer} spin />
          <RoundButton
            icon={running ? 'pause' : 'play'}
            label={running ? 'Pause' : 'Start'}
            size={82}
            accent
            onPress={() => {
              // Link the task shown in the chip to the session.
              if (!f.taskId && task) f.setTask(task.id);
              toggleTimer();
            }}
          />
          <RoundButton icon="skip" label="Skip" size={54} onPress={skipTimer} />
        </View>

        <Calm calm={calm} style={styles.bottom}>
          <Text variant="caption" color="ink3" align="center" style={{ fontSize: 11 }}>Presets · focus / break</Text>
          <View style={styles.presets} accessibilityRole="radiogroup">
            {PRESETS.map((p, i) => (
              <PresetCard key={p.name} name={p.name} value={`${p.focus} / ${p.short}`} on={f.preset === i} onPress={() => choosePreset(i)} />
            ))}
            <PresetCard name="Custom" value={`${f.customFocus} / ${f.customBreak}`} on={f.preset === 3} onPress={() => choosePreset(3)} />
          </View>
          {f.preset === 3 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <CustomStepper
                label="Focus"
                value={f.customFocus}
                onDec={() => f.setCustom(Math.max(5, f.customFocus - 5), f.customBreak)}
                onInc={() => f.setCustom(Math.min(120, f.customFocus + 5), f.customBreak)}
              />
              <CustomStepper
                label="Break"
                value={f.customBreak}
                onDec={() => f.setCustom(f.customFocus, Math.max(1, f.customBreak - 1))}
                onInc={() => f.setCustom(f.customFocus, Math.min(30, f.customBreak + 1))}
              />
            </View>
          )}
          <View style={[styles.footer, { borderTopColor: c.line }]}>
            {hasAny ? (
              <>
                <View style={{ gap: 6 }}>
                  <Text variant="small" color="ink3">Today · {today.count} {today.count === 1 ? 'session' : 'sessions'}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {Array.from({ length: 6 }, (_, i) => (
                      <View key={i} style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: i < today.count ? c.a1 : c.track }} />
                    ))}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: fonts.display700, fontSize: 20 }} tabular>{formatMinutes(today.minutes)}</Text>
                  <Text variant="small" color="ink3">focus streak · {streak} {streak === 1 ? 'day' : 'days'}</Text>
                </View>
              </>
            ) : (
              <Text color="ink2" align="center" style={{ flex: 1 }}>Your first focus session is waiting.</Text>
            )}
          </View>
        </Calm>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1 },
  taskChip: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, borderStyle: 'dashed' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  bottom: { width: '100%', maxWidth: 420, gap: space[3] },
  presets: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1 },
  custom: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingRight: 6, paddingLeft: 14, borderRadius: 16, borderWidth: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1 },
});
