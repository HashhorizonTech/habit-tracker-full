// Text for social preset keys (the server only stores the key) and inbox lines.
import type { CheerKey, InboxItem, NudgeKey } from '@/api/social';

export const CHEERS: { key: CheerKey; text: string }[] = [
  { key: 'cheer.proud', text: 'Proud of you!' },
  { key: 'cheer.keepgoing', text: 'Keep going — you’ve got this.' },
  { key: 'cheer.fire', text: 'Your streak is on fire!' },
];

const PRESETS: Record<NudgeKey | CheerKey, string> = {
  'nudge.gentle': 'A small check-in keeps your streak growing.',
  'nudge.streak': 'Your streak is waiting for you today.',
  'cheer.proud': 'Proud of you!',
  'cheer.keepgoing': 'Keep going — you’ve got this.',
  'cheer.fire': 'Your streak is on fire!',
};

export const presetText = (key: string | null | undefined) => (key && key in PRESETS ? PRESETS[key as NudgeKey | CheerKey] : null);

/** One friendly line per inbox item. */
export function inboxText(item: InboxItem): string {
  const name = item.from.name;
  switch (item.kind) {
    case 'nudge':
      return `${name} is cheering you on — a small check-in keeps your streak growing.`;
    case 'cheer':
      return `${name}: ${presetText(item.message) ?? 'Cheering you on!'}`;
    case 'friend_request':
      return `${name} wants to be friends`;
    case 'friend_accepted':
      return `${name} accepted — you can see each other’s streaks now.`;
    case 'invite_joined':
      return `${name} joined with your code — you both got 7 days of Plus.`;
  }
}

/** Short in-app toast when a nudge or cheer arrives while the app is open. */
export function arrivalToast(item: InboxItem): string {
  if (item.kind === 'cheer') return `${item.from.name}: ${presetText(item.message) ?? 'Cheering you on!'}`;
  return `${item.from.name} is cheering you on 🌱`;
}

/** "just now", "5m", "3h", "2d", then a date. */
export function relativeTime(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleString('en', { month: 'short', day: 'numeric' });
}
