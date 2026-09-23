import type { FastifyInstance } from "fastify";
import { APP_VERSION } from "../lib/version.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true, version: APP_VERSION }));
}
