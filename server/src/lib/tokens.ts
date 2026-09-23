import { createHash, randomBytes } from "node:crypto";
import { DAY_MS } from "./time.js";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 60 * DAY_MS;

export const generateRefreshToken = (): string => randomBytes(32).toString("base64url");

/** Refresh tokens are high-entropy, so a fast unsalted hash is sufficient. */
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
