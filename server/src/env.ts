import { z } from "zod";

const flag = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const EnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Comma-separated origins, or "*" to reflect any origin. */
    CORS_ORIGIN: z.string().min(1).default("*"),

    /** Android application id the Play purchases belong to. */
    GOOGLE_PLAY_PACKAGE_NAME: z.string().min(1).default("com.tend.app"),
    /** Service-account key: raw JSON, or a path to the JSON file. Unset = billing not configured. */
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: optionalString,
    /** Shared secret expected in `?token=` on the RTDN push endpoint. Unset = endpoint rejects everything. */
    GOOGLE_RTDN_SECRET: optionalString,
    /** Accept `fake:<plan>:<random>` purchase tokens without Google. Never in production. */
    BILLING_FAKE: flag,

    PRICE_MONTHLY_INR: z.coerce.number().nonnegative().default(99),
    PRICE_YEARLY_INR: z.coerce.number().nonnegative().default(699),
    PRICE_LIFETIME_INR: z.coerce.number().nonnegative().default(1999),
  })
  .superRefine((env, ctx) => {
    if (env.BILLING_FAKE && env.NODE_ENV === "production") {
      ctx.addIssue({ code: "custom", path: ["BILLING_FAKE"], message: "BILLING_FAKE=true is not allowed when NODE_ENV=production" });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Billing/admin settings with their defaults, for callers (tests) that pass a partial env. */
export type BillingEnv = Pick<
  Env,
  | "NODE_ENV"
  | "GOOGLE_PLAY_PACKAGE_NAME"
  | "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
  | "GOOGLE_RTDN_SECRET"
  | "BILLING_FAKE"
  | "PRICE_MONTHLY_INR"
  | "PRICE_YEARLY_INR"
  | "PRICE_LIFETIME_INR"
>;

export const BILLING_ENV_DEFAULTS: BillingEnv = {
  NODE_ENV: "development",
  GOOGLE_PLAY_PACKAGE_NAME: "com.tend.app",
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: undefined,
  GOOGLE_RTDN_SECRET: undefined,
  BILLING_FAKE: false,
  PRICE_MONTHLY_INR: 99,
  PRICE_YEARLY_INR: 699,
  PRICE_LIFETIME_INR: 1999,
};
