import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { createGooglePlayApi, type GooglePlayApi } from "./billing/google.js";
import { BILLING_ENV_DEFAULTS, type BillingEnv, type Env } from "./env.js";
import { authPlugin } from "./lib/auth.js";
import { createDb, type Db } from "./lib/db.js";
import { AppError, errorBody } from "./lib/errors.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes, type AuthRouteOptions } from "./routes/auth.js";
import { billingRoutes } from "./routes/billing.js";
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
  env: Pick<Env, "DATABASE_URL" | "JWT_SECRET" | "CORS_ORIGIN"> & Partial<BillingEnv>;
  logger?: FastifyServerOptions["logger"];
  /** Limit for login/register per IP. Defaults to the contract's 10/min. */
  authRateLimit?: AuthRouteOptions["rateLimit"];
  /**
   * Google Play API client. Defaults to a real client when
   * GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is set, else none (verify → 503). Tests inject a fake.
   */
  googlePlay?: GooglePlayApi | null;
}

export async function buildApp({ env, logger = false, authRateLimit, googlePlay }: BuildAppOptions): Promise<FastifyInstance> {
  const billingEnv: BillingEnv = { ...BILLING_ENV_DEFAULTS, ...definedOnly(env) };
  if (billingEnv.BILLING_FAKE && billingEnv.NODE_ENV === "production") {
    throw new Error("BILLING_FAKE=true is not allowed when NODE_ENV=production");
  }
  const google =
    googlePlay !== undefined
      ? googlePlay
      : billingEnv.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
        ? createGooglePlayApi(billingEnv.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)
        : null;

  const app = Fastify({ logger });
  if (billingEnv.BILLING_FAKE) app.log.warn("BILLING_FAKE is on: fake:<plan>:<id> purchase tokens are accepted");

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

  // Like Fastify's JSON parser, but an empty body with a JSON content type is treated as no
  // body (browsers' fetch wrappers often send `Content-Type: application/json` on bodiless POSTs).
  const jsonParser = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    const text = typeof body === "string" ? body : body.toString("utf8");
    if (text.trim() === "") return done(null, undefined);
    jsonParser(request, text, done);
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(errorBody("NOT_FOUND", `Route ${request.method} ${request.url} not found`)),
  );

  await app.register(cors, {
    origin: parseCorsOrigin(env.CORS_ORIGIN),
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["Content-Disposition"],
    maxAge: 600,
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
  await app.register(billingRoutes, {
    deps: { google, packageName: billingEnv.GOOGLE_PLAY_PACKAGE_NAME, fake: billingEnv.BILLING_FAKE },
    rtdnSecret: billingEnv.GOOGLE_RTDN_SECRET,
  });
  await app.register(adminRoutes, {
    prices: {
      PRICE_MONTHLY_INR: billingEnv.PRICE_MONTHLY_INR,
      PRICE_YEARLY_INR: billingEnv.PRICE_YEARLY_INR,
      PRICE_LIFETIME_INR: billingEnv.PRICE_LIFETIME_INR,
    },
  });

  return app;
}

/** `*` reflects any origin; otherwise a comma-separated allow-list (e.g. the admin panel's origin). */
export function parseCorsOrigin(value: string): true | string[] {
  const origins = value.split(",").map((o) => o.trim()).filter(Boolean);
  return origins.length === 0 || origins.includes("*") ? true : origins;
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
