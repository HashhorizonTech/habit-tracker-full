import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { playSound } from '@/audio/sounds';
import { Icon } from '@/components/icons/Icon';
import { Mascot } from '@/components/illustration';
import { TaskRow } from '@/components/task/TaskRow';
import { DataGate } from '@/components/ui/DataGate';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Segmented } from '@/components/ui/Segmented';
import { Text } from '@/components/ui/Text';
import { daysBetween, MONTHS, parseKey, todayKey, WEEKDAYS } from '@/data/dates';
import { liveList, tasksForDay } from '@/data/selectors';
import type { Task } from '@/data/types';
import { quickFocus } from '@/focus/engine';
import { openCreateHabit } from '@/lib/actions';
import { toggleTaskDone } from '@/lib/checkIn';
import { haptic } from '@/lib/haptics';
import { useData } from '@/store/data';
import { toast } from '@/store/ui';
import { useTheme } from '@/theme';
import { duration } from '@/theme/motion';
import { fonts, MAX_FONT_SCALE, space } from '@/theme/tokens';

type Tab = 'today' | 'upcoming' | 'done';

const EMPTY: Record<Tab, [string, string]> = {
  today: ['Your day is clear', 'Enjoy the space — or add one small thing.'],
  upcoming: ['Your day is clear', 'Nothing planned ahead. Future you says thanks.'],
  done: ['Nothing checked off yet', 'Finished tasks land here. The first one is the hardest.'],
};

const byTime = (a: Task, b: Task) => (a.time ?? '99').localeCompare(b.time ?? '99') || a.createdAt - b.createdAt;

/** Left-column label: clock time today, weekday this week, else "Sep 28". */
function whenLabel(t: Task, today: string): string {
  if (t.due && t.due !== today) {
    const d = daysBetween(today, t.due);
    const date = parseKey(t.due);
    if (d > 0 && d < 7) return WEEKDAYS[(date.getDay() + 6) % 7].slice(0, 3);
    return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
  }
  return t.time ?? 'Any';
}

export default function TasksScreen() {
  const { c } = useTheme();
  const tasksMap = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const addTask = useData((s) => s.addTask);
  const deleteTask = useData((s) => s.deleteTask);
  const [tab, setTab] = useState<Tab>('today');
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  // Just-completed tasks stay put for ~650 ms before animating out (SPEC §4.8).
  const [lingering, setLingering] = useState<Record<string, true>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const today = todayKey();
  const { lists, counts, todayDone, todayTotal } = useMemo(() => {
    const all = liveList(tasksMap);
    const todays = tasksForDay(all, today);
    const upcoming = all.filter((t) => !todays.includes(t) && !t.done && (t.list === 'upcoming' || (t.due != null && t.due > today)));
    const lists: Record<Tab, Task[]> = {
      today: todays.filter((t) => !t.done || lingering[t.id]).sort(byTime),
      upcoming: upcoming.filter((t) => !t.done || lingering[t.id]).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || byTime(a, b)),
      done: all.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)),
    };
    return {
      lists,
      counts: { today: todays.filter((t) => !t.done).length, upcoming: upcoming.length, done: lists.done.length },
      todayDone: todays.filter((t) => t.done).length,
      todayTotal: todays.length,
    };
  }, [tasksMap, today, lingering]);

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    addTask({ title, list: 'today', due: today });
    playSound('tick');
    haptic.light();
    setDraft('');
    setTab('today');
    toast('Added to today', 'plus');
  };

  const toggle = useCallback((t: Task) => {
    setMenu(null);
    const done = toggleTaskDone(t.id);
    if (done) {
      setLingering((l) => ({ ...l, [t.id]: true }));
      timers.current.push(
        setTimeout(() => setLingering(({ [t.id]: _gone, ...rest }) => rest), duration.taskLinger),
      );
    }
  }, []);

  const remove = useCallback(
    (t: Task) => {
      setMenu(null);
      deleteTask(t.id);
      toast('Task removed', 'trash');
    },
    [deleteTask],
  );

  const list = lists[tab];

  return (
    <Screen>
      <ScreenHeader title="Tasks" subtitle={`${todayDone} of ${todayTotal} done today`} back desktopRoot />
      <DataGate>

      <View style={[styles.add, { backgroundColor: c.surface, borderColor: c.line }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          placeholder="Add a task for today…"
          placeholderTextColor={c.ink3}
          returnKeyType="done"
          submitBehavior="submit"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel="New task for today"
          style={[styles.input, { color: c.ink }]}
        />
        <PressableScale kind="icon" onPress={submit} disabled={!draft.trim()} accessibilityLabel="Add task" style={[styles.addBtn, { backgroundColor: c.a1 }]}>
          <Icon name="plus" size={20} color={c.a1ink} strokeWidth={2.4} />
        </PressableScale>
      </View>

      <Segmented
        value={tab}
        onChange={(v) => {
          setTab(v);
          setMenu(null);
        }}
        size="sm"
        label="Task lists"
        style={{ marginTop: space[4], marginBottom: space[2] }}
        options={[
          { value: 'today', label: 'Today', count: counts.today },
          { value: 'upcoming', label: 'Upcoming', count: counts.upcoming },
          { value: 'done', label: 'Completed', count: counts.done },
        ]}
      />

      {list.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.empty}>
          <Mascot size={120} face="sleepy" accessory="coffee" />
          <Text style={{ fontFamily: fonts.display700, fontSize: 21 }} align="center">{EMPTY[tab][0]}</Text>
          <Text color="ink2" align="center" style={{ maxWidth: 270 }}>{EMPTY[tab][1]}</Text>
        </Animated.View>
      ) : (
        <View>
          {list.map((t) => (
            <Animated.View key={t.id} entering={FadeIn.duration(350)} exiting={FadeOut.duration(300)} layout={LinearTransition.duration(300)}>
              <TaskRow
                task={t}
                when={whenLabel(t, today)}
                habitName={t.habitId ? habits[t.habitId]?.name ?? null : null}
                menuOpen={menu === t.id}
                onToggle={() => toggle(t)}
                onMenu={() => setMenu(menu === t.id ? null : t.id)}
                onFocus={() => {
                  setMenu(null);
                  quickFocus(t.id);
                  router.navigate('/focus');
                }}
                onMakeHabit={() => {
                  setMenu(null);
                  openCreateHabit({ name: t.title });
                }}
                onDelete={() => remove(t)}
              />
            </Animated.View>
          ))}
        </View>
      )}
      </DataGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingRight: 6, paddingLeft: 16, borderRadius: 18, borderWidth: 1 },
  input: { flex: 1, minWidth: 0, height: 42, fontFamily: fonts.body500, fontSize: 15 },
  addBtn: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36 },
});
