import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Env } from "./env.js";
import { authPlugin } from "./lib/auth.js";
import { createDb, type Db } from "./lib/db.js";
import { AppError, errorBody } from "./lib/errors.js";
import { authRoutes, type AuthRouteOptions } from "./routes/auth.js";
import { exportRoutes } from "./routes/export.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { syncRoutes } from "./routes/sync.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

export interface BuildAppOptions {
  env: Pick<Env, "DATABASE_URL" | "JWT_SECRET" | "CORS_ORIGIN">;
  logger?: FastifyServerOptions["logger"];
  /** Limit for login/register per IP. Defaults to the contract's 10/min. */
  authRateLimit?: AuthRouteOptions["rateLimit"];
}

export async function buildApp({ env, logger = false, authRateLimit }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  const db = createDb(env.DATABASE_URL);
  app.decorate("db", db);
  app.addHook("onClose", async () => db.$disconnect());

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send(errorBody(err.code, err.message, err.details));
    }
    const status = typeof (err as { statusCode?: unknown }).statusCode === "number" ? (err as { statusCode: number }).statusCode : 500;
    if (status >= 500) {
      request.log.error({ err }, "unhandled error");
      return reply.code(500).send(errorBody("INTERNAL", "Something went wrong"));
    }
    // Fastify's own 4xx errors: malformed JSON, body too large, wrong content type, …
    const code = status === 413 ? "PAYLOAD_TOO_LARGE" : status === 415 ? "UNSUPPORTED_MEDIA_TYPE" : "BAD_REQUEST";
    return reply.code(status).send(errorBody(code, err instanceof Error ? err.message : "Bad request"));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody("NOT_FOUND", `Route ${request.method} ${request.url} not found`)),
  );

  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) =>
      new AppError(429, "RATE_LIMITED", `Too many attempts. Try again in ${Math.ceil(context.ttl / 1000)}s`),
  });
  await app.register(authPlugin, { secret: env.JWT_SECRET });

  await app.register(healthRoutes);
  await app.register(authRoutes, { rateLimit: authRateLimit ?? { max: 10, timeWindow: "1 minute" } });
  await app.register(meRoutes);
  await app.register(syncRoutes);
  await app.register(exportRoutes);

  return app;
}
