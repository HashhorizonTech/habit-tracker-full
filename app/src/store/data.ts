// Local-first data store (SPEC §6). Every mutation stamps `updatedAt` and marks the
// record dirty; the sync engine (src/api/sync.ts) pushes dirty records and merges
// remote changes with last-write-wins.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { todayKey } from '@/data/dates';
import { doneOn, habitsForDay, liveHabits } from '@/data/selectors';
import type { BadgeState, CollectionKey, Collections, FocusSession, Habit, HabitLog, MoodLog, Profile, Task } from '@/data/types';
import { usePersistHydrated } from '@/lib/usePersistHydrated';
import { levelInfo } from '@/lib/xp';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const COLLECTION_KEYS: CollectionKey[] = ['habits', 'habitLogs', 'tasks', 'focusSessions', 'moodLogs', 'badges'];

const emptyCollections = (): Collections => ({ habits: {}, habitLogs: {}, tasks: {}, focusSessions: {}, moodLogs: {}, badges: {} });

export const defaultProfile = (name = ''): Profile => ({
  name,
  xp: 0,
  themeId: 'aurora',
  mode: 'dark',
  prefs: {},
  notificationPrefs: {},
  streakProtection: { enabled: true, restDaysLeft: 2, restDays: [] },
  onboardedAt: null,
  updatedAt: 0,
});

type AnyRecord = Collections[CollectionKey][string];

/** id → updatedAt of the version that still needs pushing. */
type Dirty = Record<CollectionKey, Record<string, number>>;
const emptyDirty = (): Dirty => ({ habits: {}, habitLogs: {}, tasks: {}, focusSessions: {}, moodLogs: {}, badges: {} });

export interface StepResult {
  /** The habit just reached its goal. */
  completed: boolean;
  /** The habit was complete and this tap undid a step. */
  undone: boolean;
  count: number;
  /** Every scheduled habit is now complete. */
  allDone: boolean;
  leveledUp: number | null;
}

export type HabitInput = Omit<Habit, 'id' | 'updatedAt' | 'deleted' | 'createdAt' | 'order'>;
export type TaskInput = Pick<Task, 'title'> & Partial<Omit<Task, 'id' | 'updatedAt' | 'deleted' | 'createdAt'>>;

interface DataState extends Collections {
  /** The account this local data belongs to (null = not signed in yet). */
  ownerId: string | null;
  profile: Profile;
  dirty: Dirty;
  profileDirty: number | null;
  syncCursor: number;
  lastSyncedAt: number | null;

  addHabit: (input: HabitInput) => Habit;
  updateHabit: (id: string, patch: Partial<HabitInput>) => void;
  deleteHabit: (id: string) => void;
  reorderHabits: (orderedIds: string[]) => void;
  /** One tap on the check button: +step, or undo one step when already complete. */
  stepHabit: (id: string, date?: string) => StepResult;
  /** Swipe to complete: jump straight to the goal. */
  completeHabit: (id: string, date?: string) => StepResult;

  addTask: (input: TaskInput) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => { done: boolean; leveledUp: number | null };
  deleteTask: (id: string) => void;

  addFocusSession: (s: Omit<FocusSession, 'id' | 'updatedAt' | 'deleted'>) => { leveledUp: number | null };
  logMood: (m: Pick<MoodLog, 'mood' | 'tags'> & { note?: string | null; date?: string }) => { leveledUp: number | null };
  setBadge: (id: string, patch: Partial<Pick<BadgeState, 'unlockedAt' | 'progress'>>) => void;

  updateProfile: (patch: Partial<Omit<Profile, 'updatedAt'>>) => void;
  addXp: (amount: number) => number | null;

  // sync plumbing
  applyRemote: (changes: Partial<{ [K in CollectionKey]: Collections[K][string][] }> & { profile?: Profile | null }, cursor: number) => void;
  markPushed: (pushed: Dirty, profileAt: number | null) => void;
  replaceAll: (ownerId: string | null, data?: Partial<Collections> & { profile?: Profile }) => void;
  claim: (ownerId: string) => void;
}

/** Every habit on the day's agenda is complete ("Perfect Day"). */
const isAllDone = (s: Pick<DataState, 'habits' | 'habitLogs'>, date: string) => {
  const today = habitsForDay(liveHabits(s.habits), s.habitLogs, date);
  return today.length > 0 && today.every((h) => doneOn(s.habitLogs, h, date));
};

export const useData = create<DataState>()(
  persist(
    (set, get) => {
      /** Write records into a collection, stamping and marking dirty. */
      function put<K extends CollectionKey>(key: K, records: Collections[K][string][]) {
        const now = Date.now();
        set((s) => {
          const col = { ...s[key] } as Record<string, AnyRecord>;
          const dirty: Record<string, number> = { ...s.dirty[key] };
          for (const r of records) {
            const stamped = { ...r, updatedAt: Math.max(now, (col[r.id]?.updatedAt ?? 0) + 1) };
            col[r.id] = stamped;
            dirty[r.id] = stamped.updatedAt;
          }
          return { [key]: col, dirty: { ...s.dirty, [key]: dirty } } as Partial<DataState>;
        });
      }

      function addXp(amount: number): number | null {
        const before = levelInfo(get().profile.xp).level;
        const xp = Math.max(0, get().profile.xp + amount);
        get().updateProfile({ xp });
        const after = levelInfo(xp).level;
        return after > before ? after : null;
      }

      function writeLog(id: string, date: string, count: number): { prev: number; habit: Habit } | null {
        const habit = get().habits[id];
        if (!habit) return null;
        const logId = `${id}:${date}`;
        const prevLog = get().habitLogs[logId];
        const prev = prevLog?.count ?? 0;
        const done = count >= habit.goal;
        const log: HabitLog = {
          id: logId,
          habitId: id,
          date,
          count,
          completedAt: done ? (prev >= habit.goal ? prevLog?.completedAt ?? Date.now() : Date.now()) : null,
          updatedAt: 0,
          deleted: false,
        };
        put('habitLogs', [log]);
        return { prev, habit };
      }

      function stepResult(id: string, date: string, prev: number, count: number, goal: number): StepResult {
        const completed = prev < goal && count >= goal;
        const undone = prev >= goal && count < goal;
        let leveledUp: number | null = null;
        if (completed) leveledUp = addXp(10);
        else if (undone) addXp(-10);
        return { completed, undone, count, allDone: completed && isAllDone(get(), date), leveledUp };
      }

      return {
        ...emptyCollections(),
        ownerId: null,
        profile: defaultProfile(),
        dirty: emptyDirty(),
        profileDirty: null,
        syncCursor: 0,
        lastSyncedAt: null,

        addHabit: (input) => {
          const order = Math.max(-1, ...Object.values(get().habits).filter((h) => !h.deleted).map((h) => h.order)) + 1;
          const habit: Habit = { ...input, id: newId(), createdAt: Date.now(), order, updatedAt: 0, deleted: false };
          put('habits', [habit]);
          return get().habits[habit.id];
        },
        updateHabit: (id, patch) => {
          const h = get().habits[id];
          if (h) put('habits', [{ ...h, ...patch }]);
        },
        deleteHabit: (id) => {
          const h = get().habits[id];
          if (h) put('habits', [{ ...h, deleted: true }]);
        },
        reorderHabits: (orderedIds) => {
          const hs = get().habits;
          const changed = orderedIds
            .map((id, order) => (hs[id] && hs[id].order !== order ? { ...hs[id], order } : null))
            .filter((h): h is Habit => !!h);
          if (changed.length) put('habits', changed);
        },
        stepHabit: (id, date = todayKey()) => {
          const h = get().habits[id];
          if (!h) return { completed: false, undone: false, count: 0, allDone: false, leveledUp: null };
          const prev = get().habitLogs[`${id}:${date}`]?.count ?? 0;
          const count = prev >= h.goal ? Math.max(0, h.goal - h.step) : Math.min(h.goal, prev + h.step);
          writeLog(id, date, count);
          return stepResult(id, date, prev, count, h.goal);
        },
        completeHabit: (id, date = todayKey()) => {
          const h = get().habits[id];
          if (!h) return { completed: false, undone: false, count: 0, allDone: false, leveledUp: null };
          const prev = get().habitLogs[`${id}:${date}`]?.count ?? 0;
          if (prev >= h.goal) return { completed: false, undone: false, count: prev, allDone: false, leveledUp: null };
          writeLog(id, date, h.goal);
          return stepResult(id, date, prev, h.goal, h.goal);
        },

        addTask: (input) => {
          const task: Task = {
            due: null,
            time: null,
            priority: 'med',
            done: false,
            doneAt: null,
            habitId: null,
            focusSessions: 0,
            list: 'today',
            ...input,
            id: newId(),
            createdAt: Date.now(),
            updatedAt: 0,
            deleted: false,
          };
          put('tasks', [task]);
          return get().tasks[task.id];
        },
        updateTask: (id, patch) => {
          const t = get().tasks[id];
          if (t) put('tasks', [{ ...t, ...patch }]);
        },
        toggleTask: (id) => {
          const t = get().tasks[id];
          if (!t) return { done: false, leveledUp: null };
          const done = !t.done;
          put('tasks', [{ ...t, done, doneAt: done ? Date.now() : null }]);
          const leveledUp = addXp(done ? 5 : -5);
          return { done, leveledUp: done ? leveledUp : null };
        },
        deleteTask: (id) => {
          const t = get().tasks[id];
          if (t) put('tasks', [{ ...t, deleted: true }]);
        },

        addFocusSession: (s) => {
          put('focusSessions', [{ ...s, id: newId(), updatedAt: 0, deleted: false }]);
          return { leveledUp: s.completed && s.mode === 'focus' ? addXp(25) : null };
        },
        logMood: ({ mood, tags, note = null, date = todayKey() }) => {
          const first = !get().moodLogs[date] || get().moodLogs[date].deleted;
          put('moodLogs', [{ id: date, date, mood, tags, note, loggedAt: Date.now(), updatedAt: 0, deleted: false }]);
          return { leveledUp: first ? addXp(5) : null };
        },
        setBadge: (id, patch) => {
          const b = get().badges[id] ?? { id, unlockedAt: null, progress: 0, updatedAt: 0, deleted: false };
          put('badges', [{ ...b, ...patch }]);
        },

        updateProfile: (patch) => {
          const now = Math.max(Date.now(), get().profile.updatedAt + 1);
          set((s) => ({ profile: { ...s.profile, ...patch, updatedAt: now }, profileDirty: now }));
        },
        addXp,

        applyRemote: (changes, cursor) => {
          set((s) => {
            const next: Partial<DataState> = { syncCursor: cursor, lastSyncedAt: Date.now() };
            for (const key of COLLECTION_KEYS) {
              const incoming = changes[key] as AnyRecord[] | undefined;
              if (!incoming?.length) continue;
              const col = { ...s[key] } as Record<string, AnyRecord>;
              for (const r of incoming) {
                const local = col[r.id];
                // A local edit that hasn't been pushed and is newer wins.
                if (local && local.updatedAt > r.updatedAt) continue;
                col[r.id] = r;
              }
              (next as Record<string, unknown>)[key] = col;
            }
            if (changes.profile && changes.profile.updatedAt > s.profile.updatedAt) next.profile = changes.profile;
            return next;
          });
        },
        markPushed: (pushed, profileAt) => {
          set((s) => {
            const dirty = { ...s.dirty };
            for (const key of COLLECTION_KEYS) {
              const d = { ...dirty[key] };
              for (const [id, at] of Object.entries(pushed[key])) if (d[id] === at) delete d[id];
              dirty[key] = d;
            }
            return { dirty, profileDirty: s.profileDirty === profileAt ? null : s.profileDirty };
          });
        },
        replaceAll: (ownerId, data) => {
          set({
            ...emptyCollections(),
            ...data,
            ownerId,
            profile: data?.profile ?? defaultProfile(),
            dirty: emptyDirty(),
            profileDirty: null,
            syncCursor: 0,
            lastSyncedAt: null,
          });
        },
        /** Adopt locally created data for a newly signed-in account and queue all of it for upload. */
        claim: (ownerId) => {
          set((s) => {
            const dirty = emptyDirty();
            for (const key of COLLECTION_KEYS) for (const r of Object.values(s[key]) as AnyRecord[]) dirty[key][r.id] = r.updatedAt;
            // The profile is not pushed here: an existing account's server profile (XP,
            // level, prefs) must win. It is pushed on the next deliberate profile edit.
            return { ownerId, dirty, profileDirty: null, syncCursor: 0, lastSyncedAt: null };
          });
        },
      };
    },
    {
      name: 'tend.data',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ habits, habitLogs, tasks, focusSessions, moodLogs, badges, ownerId, profile, dirty, profileDirty, syncCursor, lastSyncedAt }) => ({
        habits, habitLogs, tasks, focusSessions, moodLogs, badges, ownerId, profile, dirty, profileDirty, syncCursor, lastSyncedAt,
      }),
    },
  ),
);

/** True once AsyncStorage has been read (drives the loading skeleton). */
export const useDataHydrated = () => usePersistHydrated(useData.persist);
