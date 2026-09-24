import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  deleteUser,
  getStats,
  getUserDetail,
  grant,
  listAudit,
  listSubscriptions,
  listUsers,
  type Prices,
  revokeEntitlement,
  setDisabled,
} from "../admin/service.js";
import { ENTITLEMENT_STATUSES } from "../lib/plus.js";
import { parseInput } from "../lib/validate.js";

export interface AdminRouteOptions {
  prices: Prices;
}

const Paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

const UsersQuery = z.object({
  query: z.string().trim().max(200).optional(),
  plan: z.enum(["all", "plus", "free"]).default("all"),
  status: z.enum(["all", "active", "disabled"]).default("all"),
  ...Paging,
});

const SubscriptionsQuery = z.object({
  status: z.enum(["all", ...ENTITLEMENT_STATUSES]).default("all"),
  source: z.enum(["all", "play", "admin", "trial"]).default("all"),
  ...Paging,
});

const AuditQuery = z.object(Paging);

const IdParams = z.object({ id: z.string().min(1).max(200) });

const note = z.string().trim().min(1).max(500).optional();

const GrantBody = z
  .object({
    months: z.number().int().min(1).max(24).optional(),
    days: z.number().int().min(1).max(366).optional(),
    lifetime: z.boolean().optional(),
    note,
  })
  .refine((b) => [b.months !== undefined, b.days !== undefined, b.lifetime === true].filter(Boolean).length === 1, {
    message: "Provide exactly one of months, days or lifetime: true",
  });

const RevokeBody = z.object({ note }).default({});

export async function adminRoutes(app: FastifyInstance, { prices }: AdminRouteOptions): Promise<void> {
  app.addHook("onRequest", app.requireAdmin);

  app.get("/v1/admin/stats", async () => getStats(app.db, prices));

  app.get("/v1/admin/users", async (request) => listUsers(app.db, parseInput(UsersQuery, request.query)));

  app.get("/v1/admin/users/:id", async (request) => getUserDetail(app.db, parseInput(IdParams, request.params).id));

  app.post("/v1/admin/users/:id/grant", async (request, reply) => {
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(GrantBody, request.body ?? {});
    return reply.code(201).send(await grant(app.db, request.userId, id, body));
  });

  app.post("/v1/admin/entitlements/:id/revoke", async (request) => {
    const { id } = parseInput(IdParams, request.params);
    const body = parseInput(RevokeBody, request.body ?? undefined);
    return revokeEntitlement(app.db, request.userId, id, body.note);
  });

  app.post("/v1/admin/users/:id/disable", async (request) =>
    setDisabled(app.db, request.userId, parseInput(IdParams, request.params).id, true),
  );

  app.post("/v1/admin/users/:id/enable", async (request) =>
    setDisabled(app.db, request.userId, parseInput(IdParams, request.params).id, false),
  );

  app.delete("/v1/admin/users/:id", async (request, reply) => {
    await deleteUser(app.db, request.userId, parseInput(IdParams, request.params).id);
    return reply.code(204).send();
  });

  app.get("/v1/admin/subscriptions", async (request) => listSubscriptions(app.db, parseInput(SubscriptionsQuery, request.query)));

  app.get("/v1/admin/audit", async (request) => listAudit(app.db, parseInput(AuditQuery, request.query)));
}
