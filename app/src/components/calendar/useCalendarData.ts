import { useMemo } from 'react';
import type { CalendarData } from '@/data/calendar';
import { liveHabits, liveList } from '@/data/selectors';
import { useData } from '@/store/data';

/** Store slices the calendar needs, with live (non-deleted) habits and tasks. */
export function useCalendarData(): CalendarData {
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const tasks = useData((s) => s.tasks);
  const focusSessions = useData((s) => s.focusSessions);
  const moodLogs = useData((s) => s.moodLogs);
  return useMemo(
    () => ({ habits: liveHabits(habits), logs, tasks: liveList(tasks), focusSessions, moodLogs }),
    [habits, logs, tasks, focusSessions, moodLogs],
  );
}
