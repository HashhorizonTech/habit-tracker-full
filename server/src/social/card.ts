import { z } from "zod";

const count = z.number().int().min(0).max(1_000_000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const MAX_CARD_BADGES = 20;
export const MAX_CARD_HABITS = 30;
export const MAX_HABIT_NAME = 60;

const CardHabitSchema = z.object({
  name: z.string().trim().min(1).max(MAX_HABIT_NAME),
  icon: z.string().min(1).max(64),
  hue: z.number().min(0).max(360),
  doneToday: z.boolean(),
  streak: count,
});

/** FriendCard as published by its owner. Unknown fields are dropped. */
export const FriendCardSchema = z.object({
  streak: count,
  longestStreak: count,
  level: z.number().int().min(0).max(100_000),
  xp: z.number().min(0).max(1e12),
  todayDone: z.number().int().min(0).max(1000),
  todayTotal: z.number().int().min(0).max(1000),
  todayPct: z.number().min(0).max(100),
  date,
  badges: z.array(z.string().min(1).max(64)).max(MAX_CARD_BADGES),
  habits: z.array(CardHabitSchema).max(MAX_CARD_HABITS),
  updatedAt: z.number().int().min(0),
});

export type FriendCard = z.output<typeof FriendCardSchema>;

/** Stored JSON was produced from validated input. */
export const parseStoredCard = (data: string): FriendCard => JSON.parse(data) as FriendCard;

/** What a friend sees: habits are stripped unless the owner shares habit names. */
export const cardForFriend = (card: FriendCard, shareHabitNames: boolean): FriendCard =>
  shareHabitNames ? card : { ...card, habits: [] };
