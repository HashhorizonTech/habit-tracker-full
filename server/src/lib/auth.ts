import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { unauthorized } from "./errors.js";
import { ACCESS_TOKEN_TTL } from "./tokens.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    signAccessToken: (userId: string) => string;
  }
  interface FastifyRequest {
    userId: string;
  }
}

export const authPlugin = fp<{ secret: string }>(async (app: FastifyInstance, { secret }) => {
  await app.register(fastifyJwt, { secret, sign: { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL } });

  app.decorateRequest("userId", "");
  app.decorate("signAccessToken", (userId: string) => app.jwt.sign({ sub: userId }));

  app.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify({ algorithms: ["HS256"] });
    } catch {
      throw unauthorized("Missing, invalid or expired access token");
    }
    // Tokens outlive account deletion; reject tokens for users that no longer exist.
    const user = await app.db.user.findUnique({ where: { id: request.user.sub }, select: { id: true } });
    if (!user) throw unauthorized("Account no longer exists");
    request.userId = user.id;
  });
});
