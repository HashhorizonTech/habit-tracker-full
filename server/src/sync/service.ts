import type { z } from "zod";
import type { Db, Tx } from "../lib/db.js";
import { AppError } from "../lib/errors.js";
import { now } from "../lib/time.js";
import { describeIssues } from "../lib/validate.js";
import {
  type Collection,
  type CollectionKey,
  collectionKeys,
  collections,
  listRecords,
  profileFromRow,
  profileToRow,
  type SyncRecord,
  storedUpdatedAt,
  writeRecord,
} from "./collections.js";
import { MAX_RECORDS_PER_PUSH, type Profile, ProfileSchema, type SyncRequestSchema } from "./schemas.js";

type SyncRequest = z.output<typeof SyncRequestSchema>;

type Changes = { [K in CollectionKey]: SyncRecord[] } & { profile: Profile | null };

export interface SyncResponse {
  cursor: number;
  changes: Changes;
}

const TRANSACTION_TIMEOUT_MS = 30_000;

export async function sync(db: Db, userId: string, request: SyncRequest): Promise<SyncResponse> {
  const incoming = validateChanges(request.changes);

  return db.$transaction(
    async (tx) => {
      // The no-op increment takes a row lock on the user (on Postgres), which
      // serialises concurrent syncs for one user so revs are assigned and
      // committed in order.
      const { rev: startRev } = await tx.user.update({
        where: { id: userId },
        data: { rev: { increment: 0 }, lastSyncAt: now() },
        select: { rev: true },
      });

      let rev = startRev;
      const nextRev = () => ++rev;

      for (const key of collectionKeys) {
        await applyCollection(tx, collections[key] as Collection<SyncRecord, unknown>, userId, incoming[key], nextRev);
      }
      if (incoming.profile) await applyProfile(tx, userId, incoming.profile, nextRev);

      if (rev !== startRev) await tx.user.update({ where: { id: userId }, data: { rev } });

      // A cursor ahead of the server (e.g. after a server-side restore) cannot be
      // trusted, so the device gets a full resync instead of silently missing data.
      const since = request.cursor > rev ? 0 : request.cursor;
      return { cursor: rev, changes: await changesSince(tx, userId, since) };
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_TIMEOUT_MS },
  );
}

function validateChanges(raw: SyncRequest["changes"]): Changes {
  const total = collectionKeys.reduce((n, key) => n + raw[key].length, 0) + (raw.profile == null ? 0 : 1);
  if (total > MAX_RECORDS_PER_PUSH) {
    throw new AppError(413, "TOO_MANY_RECORDS", `A push may contain at most ${MAX_RECORDS_PER_PUSH} records (got ${total})`);
  }

  const changes = { profile: null } as Changes;
  for (const key of collectionKeys) {
    const { schema } = collections[key] as Collection<SyncRecord, unknown>;
    changes[key] = raw[key].map((record) => {
      const result = schema.safeParse(record);
      if (!result.success) throw invalidRecord(key, recordId(record), result.error);
      return result.data;
    });
  }
  if (raw.profile != null) {
    const result = ProfileSchema.safeParse(raw.profile);
    if (!result.success) throw invalidRecord("profile", null, result.error);
    changes.profile = result.data;
  }
  return changes;
}

function recordId(record: unknown): string | null {
  const id = typeof record === "object" && record !== null ? (record as { id?: unknown }).id : undefined;
  return typeof id === "string" ? id : null;
}

function invalidRecord(collection: string, id: string | null, error: z.ZodError): AppError {
  const label = id === null ? collection : `${collection} record "${id}"`;
  return new AppError(400, "INVALID_RECORD", `Invalid ${label}: ${describeIssues(error)}`, { collection, id });
}

/** Last write wins: a record is accepted only if strictly newer than what is stored. */
async function applyCollection(
  tx: Tx,
  collection: Collection<SyncRecord, unknown>,
  userId: string,
  records: SyncRecord[],
  nextRev: () => number,
): Promise<void> {
  if (records.length === 0) return;
  const stored = await storedUpdatedAt(tx, collection.model, userId, [...new Set(records.map((r) => r.id))]);
  for (const record of records) {
    const current = stored.get(record.id);
    if (current !== undefined && record.updatedAt <= current) continue;
    await writeRecord(tx, collection, userId, record, nextRev());
    stored.set(record.id, record.updatedAt);
  }
}

async function applyProfile(tx: Tx, userId: string, profile: Profile, nextRev: () => number): Promise<void> {
  const current = await tx.profile.findUnique({ where: { userId }, select: { updatedAt: true } });
  if (current && profile.updatedAt <= current.updatedAt) return;
  const data = { ...profileToRow(profile), rev: nextRev() };
  await tx.profile.upsert({ where: { userId }, create: { ...data, userId }, update: data });
}

async function changesSince(tx: Tx, userId: string, cursor: number): Promise<Changes> {
  const where = { userId, rev: { gt: cursor } };
  const changes = {} as Changes;
  for (const key of collectionKeys) {
    changes[key] = await listRecords(tx, collections[key] as Collection<SyncRecord, unknown>, where);
  }
  const profile = await tx.profile.findFirst({ where });
  changes.profile = profile ? profileFromRow(profile) : null;
  return changes;
}
