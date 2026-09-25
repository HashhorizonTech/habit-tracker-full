import type { FastifyBaseLogger } from "fastify";
import type { Db } from "../lib/db.js";
import type { PushSender } from "./fcm.js";

export type InboxKind = "nudge" | "cheer" | "friend_request" | "friend_accepted" | "invite_joined";

const CHEER_BODIES: Record<string, string> = {
  "cheer.proud": "Proud of you!",
  "cheer.keepgoing": "Keep going — you've got this.",
  "cheer.fire": "Your streak is on fire!",
};
const DEFAULT_CHEER_BODY = CHEER_BODIES["cheer.keepgoing"]!;

/** Server-side notification text (English). */
export function notificationText(kind: InboxKind, fromName: string, message: string | null): { title: string; body: string } {
  switch (kind) {
    case "nudge":
      return { title: `${fromName} is cheering you on`, body: "A small check-in keeps your streak growing." };
    case "cheer":
      return { title: `${fromName} sent you a cheer 🎉`, body: (message && CHEER_BODIES[message]) || DEFAULT_CHEER_BODY };
    case "friend_request":
      return { title: `${fromName} wants to be friends`, body: "Open the app to accept." };
    case "friend_accepted":
      return { title: `${fromName} accepted your invite`, body: "You can now see each other's streaks." };
    case "invite_joined":
      return { title: `${fromName} joined with your code`, body: "You both got 7 days of Plus." };
  }
}

/**
 * Sends pushes to every FCM token of a user. Fire-and-forget from the request's point of
 * view (the inbox row is the source of truth); `idle()` lets tests await pending sends.
 */
export class Notifier {
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly db: Db,
    private readonly sender: PushSender | null,
    private readonly log: FastifyBaseLogger,
  ) {}

  get enabled(): boolean {
    return this.sender !== null;
  }

  notify(userId: string, kind: InboxKind, fromName: string, message: string | null = null): void {
    if (!this.sender) return;
    const task = this.deliver(this.sender, userId, kind, fromName, message).catch((err: unknown) => {
      this.log.warn({ err }, "push delivery failed");
    });
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
  }

  async idle(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  private async deliver(sender: PushSender, userId: string, kind: InboxKind, fromName: string, message: string | null) {
    // Expo push tokens can't be addressed through FCM; only native FCM tokens are used.
    const tokens = await this.db.pushToken.findMany({ where: { userId, kind: "fcm" }, select: { token: true } });
    if (!tokens.length) return;
    const { title, body } = notificationText(kind, fromName, message);
    const data = { type: kind, fromName };
    const results = await Promise.all(tokens.map(({ token }) => sender.send({ token, title, body, data }).then((r) => [token, r] as const)));
    const dead = results.filter(([, r]) => r === "unregistered").map(([t]) => t);
    if (dead.length) await this.db.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}
