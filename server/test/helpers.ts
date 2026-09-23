import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { buildApp, type BuildAppOptions } from "../src/app.js";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const prismaBin = join(serverRoot, "node_modules", ".bin", "prisma");

export interface TestContext {
  app: FastifyInstance;
  close(): Promise<void>;
}

/** Builds the app against a freshly migrated SQLite file in a temp directory. */
export async function createTestApp(options: Partial<BuildAppOptions> = {}): Promise<TestContext> {
  const dir = mkdtempSync(join(tmpdir(), "tend-test-"));
  const databaseUrl = `file:${join(dir, "test.db")}`;
  execFileSync(prismaBin, ["migrate", "deploy"], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  const app = await buildApp({
    env: { DATABASE_URL: databaseUrl, JWT_SECRET: "test-secret-that-is-at-least-32-characters-long", CORS_ORIGIN: "*" },
    authRateLimit: { max: 10_000, timeWindow: "1 minute" },
    ...options,
  });
  return {
    app,
    async close() {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

let counter = 0;

export async function register(app: FastifyInstance, email = `user${++counter}@example.com`): Promise<Session> {
  const res = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email, password: "correct horse", name: "Test" } });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const body = res.json();
  return { userId: body.user.id, accessToken: body.accessToken, refreshToken: body.refreshToken };
}

export const bearer = (session: Session) => ({ authorization: `Bearer ${session.accessToken}` });

export const emptyChanges = () => ({
  habits: [] as unknown[],
  habitLogs: [] as unknown[],
  tasks: [] as unknown[],
  focusSessions: [] as unknown[],
  moodLogs: [] as unknown[],
  badges: [] as unknown[],
  profile: null as unknown,
});

export type Changes = ReturnType<typeof emptyChanges>;

export function sync(
  app: FastifyInstance,
  session: Session,
  cursor: number,
  changes: Partial<Changes> = {},
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/v1/sync",
    headers: bearer(session),
    payload: { cursor, changes: { ...emptyChanges(), ...changes } },
  });
}

const T0 = 1_780_000_000_000;

export const habit = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Habit ${id}`,
  icon: "book",
  hue: 210,
  category: "mind",
  frequency: { type: "days", days: [true, false, true, false, true, false, false] },
  goal: 1,
  unit: "times",
  step: 1,
  timeOfDay: "morning",
  reminder: { on: true, time: "08:00" },
  notes: null,
  createdAt: T0,
  order: 0,
  updatedAt: T0,
  deleted: false,
  ...overrides,
});

export const habitLog = (habitId: string, date: string, overrides: Record<string, unknown> = {}) => ({
  id: `${habitId}:${date}`,
  habitId,
  date,
  count: 1,
  completedAt: T0,
  updatedAt: T0,
  deleted: false,
  ...overrides,
});

export const task = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Task ${id}`,
  due: "2026-09-23",
  time: null,
  priority: "high",
  done: false,
  doneAt: null,
  habitId: null,
  focusSessions: 0,
  list: "today",
  createdAt: T0,
  updatedAt: T0,
  deleted: false,
  ...overrides,
});

export const focusSession = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  start: T0,
  end: T0 + 25 * 60_000,
  mode: "focus",
  minutes: 25,
  taskId: null,
  completed: true,
  updatedAt: T0,
  deleted: false,
  ...overrides,
});

export const moodLog = (date: string, overrides: Record<string, unknown> = {}) => ({
  id: date,
  date,
  mood: "good",
  tags: ["work", "sleep"],
  note: null,
  loggedAt: T0,
  updatedAt: T0,
  deleted: false,
  ...overrides,
});

export const badge = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  unlockedAt: null,
  progress: 0.5,
  updatedAt: T0,
  deleted: false,
  ...overrides,
});

export const profile = (overrides: Record<string, unknown> = {}) => ({
  name: "Ravi",
  xp: 120,
  themeId: "sage",
  mode: "system",
  prefs: { weekStart: 1, haptics: true },
  notificationPrefs: { daily: { on: true, time: "09:00" } },
  streakProtection: { enabled: true, restDaysLeft: 2, restDays: ["2026-09-20"] },
  onboardedAt: T0,
  updatedAt: T0,
  ...overrides,
});

export { T0 };
