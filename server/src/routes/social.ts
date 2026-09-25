import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseInput } from "../lib/validate.js";
import { FriendCardSchema } from "../social/card.js";
import {
  acceptRequest,
  block,
  cancelRequest,
  declineRequest,
  getSocialMe,
  InboxQuery,
  listBlocked,
  listFriends,
  listInbox,
  listRequests,
  markRead,
  nudge,
  NudgeBody,
  putCard,
  ReadBody,
  removeFriend,
  report,
  ReportBody,
  RequestBody,
  sendRequest,
  SettingsBody,
  type SocialDeps,
  unblock,
  updateSettings,
} from "../social/service.js";

export interface SocialRouteOptions {
  /** Per-user limit on social writes (requests, nudges, reports). */
  rateLimit: { max: number; timeWindow: number | string };
}

const IdParams = z.object({ id: z.string().min(1).max(200) });
const UserParams = z.object({ userId: z.string().min(1).max(200) });

export async function socialRoutes(app: FastifyInstance, { rateLimit }: SocialRouteOptions): Promise<void> {
  app.addHook("onRequest", app.authenticate);
  const deps = (): SocialDeps => ({ db: app.db, notifier: app.notifier });
  // Runs after authentication so the limit is per account (many phones share a carrier IP).
  const limited = {
    config: {
      rateLimit: { ...rateLimit, hook: "preHandler" as const, keyGenerator: (req: FastifyRequest) => `social:${req.userId}` },
    },
  };
  const userId = (request: FastifyRequest) => parseInput(UserParams, request.params).userId;

  app.get("/v1/social/me", async (request) => getSocialMe(app.db, request.userId));

  app.put("/v1/social/settings", async (request) => updateSettings(app.db, request.userId, parseInput(SettingsBody, request.body)));

  app.put("/v1/social/card", async (request) => putCard(app.db, request.userId, parseInput(FriendCardSchema, request.body)));

  app.post("/v1/social/requests", limited, async (request, reply) => {
    const { code } = parseInput(RequestBody, request.body);
    return reply.code(201).send(await sendRequest(deps(), request.userId, code));
  });

  app.get("/v1/social/requests", async (request) => listRequests(app.db, request.userId));

  app.post("/v1/social/requests/:id/accept", async (request) => ({
    friend: await acceptRequest(deps(), request.userId, parseInput(IdParams, request.params).id),
  }));

  app.post("/v1/social/requests/:id/decline", async (request, reply) => {
    await declineRequest(app.db, request.userId, parseInput(IdParams, request.params).id);
    return reply.code(204).send();
  });

  app.delete("/v1/social/requests/:id", async (request, reply) => {
    await cancelRequest(app.db, request.userId, parseInput(IdParams, request.params).id);
    return reply.code(204).send();
  });

  app.get("/v1/social/friends", async (request) => listFriends(app.db, request.userId));

  app.delete("/v1/social/friends/:userId", async (request, reply) => {
    await removeFriend(app.db, request.userId, userId(request));
    return reply.code(204).send();
  });

  app.post("/v1/social/friends/:userId/nudge", limited, async (request, reply) => {
    const body = parseInput(NudgeBody, request.body);
    return reply.code(201).send({ item: await nudge(deps(), request.userId, userId(request), body) });
  });

  app.get("/v1/social/inbox", async (request) => listInbox(app.db, request.userId, parseInput(InboxQuery, request.query).since));

  app.post("/v1/social/inbox/read", async (request, reply) => {
    const { ids } = parseInput(ReadBody, request.body ?? undefined);
    await markRead(app.db, request.userId, ids);
    return reply.code(204).send();
  });

  app.post("/v1/social/block/:userId", async (request, reply) => {
    await block(app.db, request.userId, userId(request));
    return reply.code(204).send();
  });

  app.delete("/v1/social/block/:userId", async (request, reply) => {
    await unblock(app.db, request.userId, userId(request));
    return reply.code(204).send();
  });

  app.get("/v1/social/blocked", async (request) => listBlocked(app.db, request.userId));

  app.post("/v1/social/report/:userId", limited, async (request, reply) => {
    const body = parseInput(ReportBody, request.body);
    return reply.code(201).send(await report(app.db, request.userId, userId(request), body));
  });
}
