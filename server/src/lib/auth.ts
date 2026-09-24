import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { accountDisabled, forbidden, unauthorized } from "./errors.js";
import { ACCESS_TOKEN_TTL } from "./tokens.js";
import { type Role, toRole } from "./users.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    /** `authenticate` plus `403 FORBIDDEN` unless the user is an admin. */
    requireAdmin: (request: FastifyRequest) => Promise<void>;
    signAccessToken: (userId: string) => string;
  }
  interface FastifyRequest {
    userId: string;
    userRole: Role;
  }
}

export const authPlugin = fp<{ secret: string }>(async (app: FastifyInstance, { secret }) => {
  await app.register(fastifyJwt, { secret, sign: { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL } });

  app.decorateRequest("userId", "");
  app.decorateRequest("userRole", "user");
  app.decorate("signAccessToken", (userId: string) => app.jwt.sign({ sub: userId }));

  const authenticate = async (request: FastifyRequest) => {
    try {
      await request.jwtVerify({ algorithms: ["HS256"] });
    } catch {
      throw unauthorized("Missing, invalid or expired access token");
    }
    // Looked up on every request so deletion, disabling and role changes take effect
    // immediately instead of when the 15-minute access token expires.
    const user = await app.db.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, role: true, disabledAt: true },
    });
    if (!user) throw unauthorized("Account no longer exists");
    if (user.disabledAt !== null) throw accountDisabled();
    request.userId = user.id;
    request.userRole = toRole(user.role);
  };

  app.decorate("authenticate", authenticate);
  app.decorate("requireAdmin", async (request: FastifyRequest) => {
    await authenticate(request);
    if (request.userRole !== "admin") throw forbidden();
  });
});
