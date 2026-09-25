import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isUniqueViolation } from "../lib/db.js";
import { AppError, accountDisabled } from "../lib/errors.js";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "../lib/password.js";
import { createRefreshToken, revokeRefreshToken, rotateRefreshToken } from "../lib/sessions.js";
import { now } from "../lib/time.js";
import { toPublicUser } from "../lib/users.js";
import { parseInput } from "../lib/validate.js";
import { redeemInvite } from "../social/invite.js";

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8).max(128);

const RegisterBody = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(100),
  // Anything string-like is accepted; codes that don't resolve are ignored (registration still succeeds).
  inviteCode: z.string().max(64).nullish().catch(undefined),
});
const LoginBody = z.object({ email, password: z.string().min(1).max(128) });
const RefreshBody = z.object({ refreshToken: z.string().min(1).max(512) });

export interface AuthRouteOptions {
  rateLimit: { max: number; timeWindow: number | string };
}

export async function authRoutes(app: FastifyInstance, { rateLimit }: AuthRouteOptions): Promise<void> {
  const limited = { config: { rateLimit } };

  const issueSession = async (userId: string) => ({
    accessToken: app.signAccessToken(userId),
    refreshToken: (await createRefreshToken(app.db, userId)).token,
  });

  app.post("/v1/auth/register", limited, async (request, reply) => {
    const body = parseInput(RegisterBody, request.body);
    const passwordHash = await hashPassword(body.password);
    let user;
    try {
      user = await app.db.user.create({
        data: { id: randomUUID(), email: body.email, name: body.name, passwordHash, createdAt: now() },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
      throw err;
    }
    let inviteReward = false;
    if (body.inviteCode) {
      try {
        const redemption = await redeemInvite(app.db, user.id, body.inviteCode);
        if (redemption) {
          inviteReward = redemption.rewarded;
          app.notifier.notify(redemption.inviterId, "invite_joined", user.name);
        }
      } catch (err) {
        // The account exists already; a failed invite must not fail registration.
        request.log.error({ err }, "invite redemption failed");
      }
    }
    return reply.code(201).send({ user: toPublicUser(user), ...(await issueSession(user.id)), inviteReward });
  });

  app.post("/v1/auth/login", limited, async (request) => {
    const body = parseInput(LoginBody, request.body);
    const user = await app.db.user.findUnique({ where: { email: body.email } });
    const valid = user ? await verifyPassword(user.passwordHash, body.password) : await verifyAgainstDummy(body.password);
    if (!user || !valid) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    // Only revealed to someone who knows the password.
    if (user.disabledAt !== null) throw accountDisabled();
    return { user: toPublicUser(user), ...(await issueSession(user.id)) };
  });

  app.post("/v1/auth/refresh", async (request) => {
    const { refreshToken } = parseInput(RefreshBody, request.body);
    const rotated = await rotateRefreshToken(app.db, refreshToken);
    return { accessToken: app.signAccessToken(rotated.userId), refreshToken: rotated.token };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const { refreshToken } = parseInput(RefreshBody, request.body);
    await revokeRefreshToken(app.db, refreshToken);
    return reply.code(204).send();
  });
}
