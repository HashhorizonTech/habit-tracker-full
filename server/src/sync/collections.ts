import type { z } from "zod";
import type * as Rows from "../generated/prisma/client.js";
import type { Tx } from "../lib/db.js";
import {
  type BadgeState,
  BadgeStateSchema,
  type FocusSession,
  FocusSessionSchema,
  type Habit,
  type HabitLog,
  HabitLogSchema,
  HabitSchema,
  type MoodLog,
  MoodLogSchema,
  type Profile,
  type Task,
  TaskSchema,
} from "./schemas.js";

export interface SyncRecord {
  id: string;
  updatedAt: number;
  deleted: boolean;
}

type RowData<Row> = Omit<Row, "userId" | "rev">;

type SyncModel = "habit" | "habitLog" | "task" | "focusSession" | "moodLog" | "badgeState";

export interface Collection<R extends SyncRecord, Row> {
  model: SyncModel;
  schema: z.ZodType<R, unknown>;
  toRow(record: R): RowData<Row>;
  fromRow(row: Row): R;
}

const toJson = (value: unknown): string => JSON.stringify(value);
// Stored JSON was produced by toJson from validated input, so it is trusted here.
const fromJson = <T>(value: string): T => JSON.parse(value) as T;
const fromNullableJson = <T>(value: string | null): T | null => (value === null ? null : fromJson<T>(value));

const habits: Collection<Habit, Rows.Habit> = {
  model: "habit",
  schema: HabitSchema,
  toRow: (r) => ({ ...r, frequency: toJson(r.frequency), reminder: r.reminder ? toJson(r.reminder) : null }),
  fromRow: ({ userId: _u, rev: _r, ...row }) => ({
    ...row,
    frequency: fromJson<Habit["frequency"]>(row.frequency),
    reminder: fromNullableJson<NonNullable<Habit["reminder"]>>(row.reminder),
  }),
};

const habitLogs: Collection<HabitLog, Rows.HabitLog> = {
  model: "habitLog",
  schema: HabitLogSchema,
  toRow: (r) => r,
  fromRow: ({ userId: _u, rev: _r, ...row }) => row,
};

const tasks: Collection<Task, Rows.Task> = {
  model: "task",
  schema: TaskSchema,
  toRow: (r) => r,
  fromRow: ({ userId: _u, rev: _r, ...row }) => ({
    ...row,
    priority: row.priority as Task["priority"],
    list: row.list as Task["list"],
  }),
};

const focusSessions: Collection<FocusSession, Rows.FocusSession> = {
  model: "focusSession",
  schema: FocusSessionSchema,
  toRow: (r) => r,
  fromRow: ({ userId: _u, rev: _r, ...row }) => ({ ...row, mode: row.mode as FocusSession["mode"] }),
};

const moodLogs: Collection<MoodLog, Rows.MoodLog> = {
  model: "moodLog",
  schema: MoodLogSchema,
  toRow: (r) => ({ ...r, tags: toJson(r.tags) }),
  fromRow: ({ userId: _u, rev: _r, ...row }) => ({
    ...row,
    mood: row.mood as MoodLog["mood"],
    tags: fromJson<string[]>(row.tags),
  }),
};

const badges: Collection<BadgeState, Rows.BadgeState> = {
  model: "badgeState",
  schema: BadgeStateSchema,
  toRow: (r) => r,
  fromRow: ({ userId: _u, rev: _r, ...row }) => row,
};

/** Keys match the `changes` object of the sync request/response. */
export const collections = { habits, habitLogs, tasks, focusSessions, moodLogs, badges } as const;

export type CollectionKey = keyof typeof collections;
export const collectionKeys = Object.keys(collections) as CollectionKey[];

// The six synced models share the same key/rev/updatedAt shape, so one narrow
// structural view of their delegates is enough. Field-level typing is enforced
// by each collection's toRow/fromRow against the generated row types.
interface SyncDelegate {
  findMany(args: object): Promise<unknown[]>;
  upsert(args: object): Promise<unknown>;
}

const delegate = (tx: Tx, model: SyncModel) => tx[model] as unknown as SyncDelegate;

export async function storedUpdatedAt(
  tx: Tx,
  model: SyncModel,
  userId: string,
  ids: string[],
): Promise<Map<string, number>> {
  const rows = (await delegate(tx, model).findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, updatedAt: true },
  })) as Array<{ id: string; updatedAt: number }>;
  return new Map(rows.map((row) => [row.id, row.updatedAt]));
}

export async function writeRecord<R extends SyncRecord, Row>(
  tx: Tx,
  collection: Collection<R, Row>,
  userId: string,
  record: R,
  rev: number,
): Promise<void> {
  const data = { ...collection.toRow(record), rev };
  await delegate(tx, collection.model).upsert({
    where: { userId_id: { userId, id: record.id } },
    create: { ...data, userId },
    update: data,
  });
}

export async function listRecords<R extends SyncRecord, Row>(
  tx: Tx,
  collection: Collection<R, Row>,
  where: { userId: string; rev?: { gt: number }; deleted?: boolean },
): Promise<R[]> {
  const rows = (await delegate(tx, collection.model).findMany({ where, orderBy: { rev: "asc" } })) as Row[];
  return rows.map((row) => collection.fromRow(row));
}

// Profile is a single row per user without an id or tombstone.

export const profileToRow = (p: Profile): Omit<Rows.Profile, "userId" | "rev"> => ({
  ...p,
  prefs: toJson(p.prefs),
  notificationPrefs: toJson(p.notificationPrefs),
  streakProtection: toJson(p.streakProtection),
});

export const profileFromRow = ({ userId: _u, rev: _r, ...row }: Rows.Profile): Profile => ({
  ...row,
  mode: row.mode as Profile["mode"],
  prefs: fromJson<Profile["prefs"]>(row.prefs),
  notificationPrefs: fromJson<Profile["notificationPrefs"]>(row.notificationPrefs),
  streakProtection: fromJson<Profile["streakProtection"]>(row.streakProtection),
});
