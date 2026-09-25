import type { FastifyInstance } from "fastify";
import { parseInput } from "../lib/validate.js";
import { deletePushToken, PushTokenBody, PushTokenDeleteBody, upsertPushToken } from "../social/service.js";

export async function pushRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", app.authenticate);

  app.post("/v1/push/token", async (request, reply) => {
    await upsertPushToken(app.db, request.userId, parseInput(PushTokenBody, request.body));
    return reply.code(204).send();
  });

  app.delete("/v1/push/token", async (request, reply) => {
    const { token } = parseInput(PushTokenDeleteBody, request.body);
    await deletePushToken(app.db, request.userId, token);
    return reply.code(204).send();
  });
}
