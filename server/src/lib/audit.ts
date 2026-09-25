import { randomUUID } from "node:crypto";
import type { Db, Tx } from "./db.js";
import { now } from "./time.js";

export type AuditAction = "grant" | "revoke" | "disable" | "enable" | "delete" | "resolve_report";

export async function writeAudit(
  db: Db | Tx,
  entry: { adminId: string; action: AuditAction; targetUserId: string | null; details?: Record<string, unknown> },
): Promise<void> {
  await db.auditLog.create({
    data: {
      id: randomUUID(),
      adminId: entry.adminId,
      action: entry.action,
      targetUserId: entry.targetUserId,
      details: JSON.stringify(entry.details ?? {}),
      createdAt: now(),
    },
  });
}
