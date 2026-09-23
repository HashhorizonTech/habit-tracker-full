import type { Db } from "./db.js";
import { type CsvValue, toCsv } from "./csv.js";
import { toPublicUser } from "./users.js";
import { collections, listRecords, profileFromRow } from "../sync/collections.js";

export async function loadExport(db: Db, userId: string) {
  const live = { userId, deleted: false };
  const [user, habits, habitLogs, tasks, focusSessions, moodLogs, badges] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }),
    listRecords(db, collections.habits, live),
    listRecords(db, collections.habitLogs, live),
    listRecords(db, collections.tasks, live),
    listRecords(db, collections.focusSessions, live),
    listRecords(db, collections.moodLogs, live),
    listRecords(db, collections.badges, live),
  ]);
  return {
    exportedAt: Date.now(),
    user: toPublicUser(user),
    profile: user.profile ? profileFromRow(user.profile) : null,
    habits,
    habitLogs,
    tasks,
    focusSessions,
    moodLogs,
    badges,
  };
}

export type ExportData = Awaited<ReturnType<typeof loadExport>>;

const CSV_COLUMNS = [
  "type", "id", "date", "name", "category", "frequency", "goal", "unit", "count", "habitId", "taskId",
  "priority", "list", "done", "mode", "minutes", "completed", "mood", "tags", "note",
  "start", "end", "completedAt", "createdAt", "updatedAt",
] as const;

type CsvRow = Partial<Record<(typeof CSV_COLUMNS)[number], CsvValue>>;

const iso = (ms: number | null | undefined): string | null => (ms == null ? null : new Date(ms).toISOString());

export function exportToCsv(data: ExportData): string {
  const rows: CsvRow[] = [
    ...data.habits.map((h) => ({
      type: "habit", id: h.id, name: h.name, category: h.category, frequency: JSON.stringify(h.frequency),
      goal: h.goal, unit: h.unit, note: h.notes, createdAt: iso(h.createdAt), updatedAt: iso(h.updatedAt),
    })),
    ...data.habitLogs.map((l) => ({
      type: "log", id: l.id, date: l.date, habitId: l.habitId, count: l.count,
      completedAt: iso(l.completedAt), updatedAt: iso(l.updatedAt),
    })),
    ...data.tasks.map((t) => ({
      type: "task", id: t.id, date: t.due, name: t.title, habitId: t.habitId, priority: t.priority, list: t.list,
      done: t.done, completedAt: iso(t.doneAt), createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt),
    })),
    ...data.focusSessions.map((f) => ({
      type: "focus", id: f.id, taskId: f.taskId, mode: f.mode, minutes: f.minutes, completed: f.completed,
      start: iso(f.start), end: iso(f.end), updatedAt: iso(f.updatedAt),
    })),
    ...data.moodLogs.map((m) => ({
      type: "mood", id: m.id, date: m.date, mood: m.mood, tags: m.tags.join(";"), note: m.note,
      createdAt: iso(m.loggedAt), updatedAt: iso(m.updatedAt),
    })),
  ];
  return toCsv(CSV_COLUMNS, rows);
}
