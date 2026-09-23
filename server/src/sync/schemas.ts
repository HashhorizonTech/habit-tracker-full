import { z } from "zod";

// Record shapes from docs/API.md. z.object strips unknown keys, which is how
// "unknown fields are dropped" is implemented.

const id = z.string().min(1).max(200);
const text = (max: number) => z.string().max(max);
const timestamp = z.number().nonnegative();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
/** Nullable fields may also be omitted by the client; they are stored as null. */
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().default(null);

const syncMeta = { id, updatedAt: timestamp, deleted: z.boolean() };

export const HabitSchema = z.object({
  ...syncMeta,
  name: text(200),
  icon: text(100),
  hue: z.number(),
  category: text(100),
  frequency: z.object({
    type: z.enum(["daily", "days", "weekly", "monthly", "custom"]),
    days: z.array(z.boolean()).length(7).optional(),
    times: z.number().optional(),
    every: z.number().optional(),
  }),
  goal: z.number(),
  unit: text(50),
  step: z.number(),
  timeOfDay: text(50),
  reminder: nullable(z.object({ on: z.boolean(), time: text(20) })),
  notes: nullable(text(10_000)),
  createdAt: timestamp,
  order: z.number(),
});

export const HabitLogSchema = z
  .object({
    ...syncMeta,
    habitId: id,
    date: dateString,
    count: z.number(),
    completedAt: nullable(timestamp),
  })
  .refine((r) => r.id === `${r.habitId}:${r.date}`, { message: "id must be \"<habitId>:<date>\"", path: ["id"] });

export const TaskSchema = z.object({
  ...syncMeta,
  title: text(500),
  due: nullable(dateString),
  time: nullable(text(20)),
  priority: z.enum(["high", "med", "low"]),
  done: z.boolean(),
  doneAt: nullable(timestamp),
  habitId: nullable(id),
  focusSessions: z.number().int().nonnegative(),
  list: z.enum(["today", "upcoming"]),
  createdAt: timestamp,
});

export const FocusSessionSchema = z.object({
  ...syncMeta,
  start: timestamp,
  end: timestamp,
  mode: z.enum(["focus", "short", "long"]),
  minutes: z.number().nonnegative(),
  taskId: nullable(id),
  completed: z.boolean(),
});

export const MoodLogSchema = z
  .object({
    ...syncMeta,
    date: dateString,
    mood: z.enum(["great", "good", "okay", "low", "tired"]),
    tags: z.array(text(100)).max(100),
    note: nullable(text(10_000)),
    loggedAt: timestamp,
  })
  .refine((r) => r.id === r.date, { message: "id must equal date", path: ["id"] });

export const BadgeStateSchema = z.object({
  ...syncMeta,
  unlockedAt: nullable(timestamp),
  progress: z.number(),
});

const jsonObject = z.record(z.string(), z.unknown());

export const ProfileSchema = z.object({
  name: text(200),
  xp: z.number(),
  themeId: text(100),
  mode: z.enum(["light", "dark", "system"]),
  prefs: jsonObject,
  notificationPrefs: jsonObject,
  streakProtection: z.object({
    enabled: z.boolean(),
    restDaysLeft: z.number(),
    restDays: z.array(dateString).max(1000),
  }),
  onboardedAt: nullable(timestamp),
  updatedAt: timestamp,
});

export type Habit = z.output<typeof HabitSchema>;
export type HabitLog = z.output<typeof HabitLogSchema>;
export type Task = z.output<typeof TaskSchema>;
export type FocusSession = z.output<typeof FocusSessionSchema>;
export type MoodLog = z.output<typeof MoodLogSchema>;
export type BadgeState = z.output<typeof BadgeStateSchema>;
export type Profile = z.output<typeof ProfileSchema>;

export const MAX_RECORDS_PER_PUSH = 2000;

// Envelope only; records are validated one by one so errors can name the record.
const records = z.array(z.unknown()).default([]);

export const SyncRequestSchema = z.object({
  cursor: z.number().int().nonnegative(),
  changes: z
    .object({
      habits: records,
      habitLogs: records,
      tasks: records,
      focusSessions: records,
      moodLogs: records,
      badges: records,
      profile: z.unknown().optional(),
    })
    .default({ habits: [], habitLogs: [], tasks: [], focusSessions: [], moodLogs: [], badges: [] }),
});
