// XP & levels (SPEC §4.11). Level L → L+1 costs 250·L XP, so Level 12 spans 3,000 XP
// (matches "2,380 / 3,000 XP · 620 to Level 13").
export const XP = { habit: 10, task: 5, focus: 25, mood: 5 } as const;

export const xpForLevel = (level: number) => 250 * level;
/** Total XP needed to reach the start of `level` (level 1 starts at 0). */
export const xpToReach = (level: number) => 125 * level * (level - 1);

export interface LevelInfo {
  level: number;
  into: number;
  span: number;
  toNext: number;
  progress: number;
  title: string;
}

const TITLES: [number, string][] = [
  [1, 'Seedling'], [3, 'Sprout'], [6, 'Steady Grower'], [9, 'Habit Builder'],
  [12, 'Consistency Master'], [16, 'Deep Rooted'], [20, 'Evergreen'],
];

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  while (xpToReach(level + 1) <= totalXp) level++;
  const into = totalXp - xpToReach(level);
  const span = xpForLevel(level);
  const title = [...TITLES].reverse().find(([l]) => level >= l)?.[1] ?? 'Seedling';
  return { level, into, span, toNext: span - into, progress: into / span, title };
}
