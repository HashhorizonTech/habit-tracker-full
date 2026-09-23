import type { FastifyInstance } from "fastify";
import { parseInput } from "../lib/validate.js";
import { SyncRequestSchema } from "../sync/schemas.js";
import { sync } from "../sync/service.js";

// 2 000 records with generous text fields can exceed Fastify's 1 MiB default.
const SYNC_BODY_LIMIT = 16 * 1024 * 1024;

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.post("/v1/sync", { bodyLimit: SYNC_BODY_LIMIT }, async (request) => {
    const body = parseInput(SyncRequestSchema, request.body);
    return sync(app.db, request.userId, body);
  });
}
