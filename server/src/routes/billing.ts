import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { type BillingDeps, handleRtdn, VerifyBody, verifyPurchase } from "../billing/service.js";
import { unauthorized } from "../lib/errors.js";
import { parseInput } from "../lib/validate.js";

export interface BillingRouteOptions {
  deps: Omit<BillingDeps, "db" | "log">;
  rtdnSecret: string | undefined;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time comparison (hashing first makes the lengths equal). */
export function secretMatches(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== "string" || !given) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

export async function billingRoutes(app: FastifyInstance, { deps, rtdnSecret }: BillingRouteOptions): Promise<void> {
  const billing = (log: BillingDeps["log"]): BillingDeps => ({ ...deps, db: app.db, log });

  app.post("/v1/billing/google/verify", { onRequest: app.authenticate }, async (request) => {
    const body = parseInput(VerifyBody, request.body);
    return verifyPurchase(billing(request.log), request.userId, body);
  });

  // Pub/Sub push endpoint for Play real-time developer notifications (no user auth).
  app.post("/v1/billing/google/rtdn", async (request, reply) => {
    const { token } = (request.query ?? {}) as { token?: unknown };
    if (!secretMatches(token, rtdnSecret)) throw unauthorized("Invalid RTDN token");
    await handleRtdn(billing(request.log), request.body);
    return reply.code(204).send();
  });
}
