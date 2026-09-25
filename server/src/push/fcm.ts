import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

/*
 * Firebase Cloud Messaging HTTP v1, called with plain fetch (auth via google-auth-library).
 * The rest of the server talks to `PushSender`, so tests inject a fake.
 */

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const API_BASE = "https://fcm.googleapis.com/v1/projects";

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** FCM requires string values. */
  data: Record<string, string>;
}

/**
 * - `ok`: accepted by FCM
 * - `unregistered`: the token is dead (404 / UNREGISTERED) — the caller deletes it
 * - `error`: anything else (logged, token kept)
 */
export type PushResult = "ok" | "unregistered" | "error";

export interface PushSender {
  send(message: PushMessage): Promise<PushResult>;
}

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

/** Accepts the service-account key as raw JSON or as a path to the JSON file. */
export function loadFirebaseServiceAccount(value: string): ServiceAccount {
  const text = value.trimStart().startsWith("{") ? value : readFileSync(value, "utf8");
  const parsed = JSON.parse(text) as Partial<ServiceAccount> | null;
  if (!parsed || typeof parsed !== "object" || !parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not a service-account key (project_id/client_email/private_key missing)");
  }
  return parsed as ServiceAccount;
}

/** The HTTP v1 request body for one device. */
export function fcmRequestBody(message: PushMessage) {
  return {
    message: {
      token: message.token,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { priority: "high", notification: { channel_id: "social" } },
    },
  };
}

/** True when FCM says the token no longer exists (HTTP 404 or an UNREGISTERED error detail). */
export function isUnregistered(status: number, responseText: string): boolean {
  if (status === 404) return true;
  try {
    const body = JSON.parse(responseText) as { error?: { status?: string; details?: Array<{ errorCode?: string }> } };
    return body.error?.status === "UNREGISTERED" || (body.error?.details ?? []).some((d) => d.errorCode === "UNREGISTERED");
  } catch {
    return false;
  }
}

export function createFcmSender(
  serviceAccountJson: string,
  opts: {
    fetchImpl?: typeof fetch;
    /** Tests override the OAuth step. */
    getAccessToken?: () => Promise<string | null | undefined>;
    log?: { warn(obj: object, msg: string): void };
  } = {},
): PushSender {
  const credentials = loadFirebaseServiceAccount(serviceAccountJson);
  const auth = new GoogleAuth({ credentials, scopes: [SCOPE] });
  const getAccessToken = opts.getAccessToken ?? (() => auth.getAccessToken());
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${API_BASE}/${encodeURIComponent(credentials.project_id)}/messages:send`;

  return {
    async send(message) {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Could not obtain a Google access token");
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
          body: JSON.stringify(fcmRequestBody(message)),
        });
        if (res.ok) return "ok";
        const text = await res.text();
        if (isUnregistered(res.status, text)) return "unregistered";
        opts.log?.warn({ status: res.status, body: text.slice(0, 300) }, "fcm send failed");
        return "error";
      } catch (err) {
        opts.log?.warn({ err }, "fcm send failed");
        return "error";
      }
    },
  };
}
