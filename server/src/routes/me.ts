import type { FastifyInstance } from "fastify";
import { profileFromRow } from "../sync/collections.js";
import { loadPlusStatus } from "../lib/plus.js";
import { toPublicUser } from "../lib/users.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.get("/v1/me", async (request) => {
    const [user, plus] = await Promise.all([
      app.db.user.findUniqueOrThrow({ where: { id: request.userId }, include: { profile: true } }),
      loadPlusStatus(app.db, request.userId),
    ]);
    return { user: toPublicUser(user), profile: user.profile ? profileFromRow(user.profile) : null, plus };
  });

  app.get("/v1/plus", async (request) => loadPlusStatus(app.db, request.userId));

  // All user-owned tables reference User with ON DELETE CASCADE.
  app.delete("/v1/me", async (request, reply) => {
    await app.db.user.delete({ where: { id: request.userId } });
    return reply.code(204).send();
  });
}
