import { clampChroma, formatHex, formatRgb, interpolate, parse } from 'culori';
import { FIXED_COLORS, GENERATED_THEMES } from './themes.generated';

export type ThemeId = keyof typeof GENERATED_THEMES;
export type Mode = 'light' | 'dark' | 'system';

export type ColorToken =
  | 'page' | 'bg' | 'bg2' | 'surface' | 'surface2' | 'sheet'
  | 'ink' | 'ink2' | 'ink3' | 'line' | 'track'
  | 'a1' | 'a2' | 'a1ink' | 'a1text' | 'a1soft' | 'a2soft' | 'glow';

export type Colors = Record<ColorToken, string>;

export interface HabitColors {
  c: string;
  soft: string;
  text: string;
  /** Heatmap levels 1–4 (level 0 is `track`). */
  levels: readonly string[];
  dim: string;
}

export interface MoodColors {
  fill: string;
  ink: string;
}

export type MoodId = 'great' | 'good' | 'okay' | 'low' | 'tired';

export interface Palette {
  id: ThemeId;
  name: string;
  dark: boolean;
  colors: Colors;
  habit: (hue: number) => HabitColors;
  mood: (id: MoodId) => MoodColors;
  fixed: typeof FIXED_COLORS;
}

export const THEME_IDS = Object.keys(GENERATED_THEMES) as ThemeId[];

const toStr = (c: ReturnType<typeof parse>) =>
  !c ? '#000000' : c.alpha == null || c.alpha >= 1 ? formatHex(c) : formatRgb(c);

// Fallback for hues that were not pre-generated (e.g. data synced from a newer client).
const runtimeHabit = (hue: number, dark: boolean, factor: number): HabitColors => {
  const at = (l: number, c: number, alpha?: number) =>
    toStr({ ...clampChroma({ mode: 'oklch', l, c: c * factor, h: hue }, 'oklch', 'rgb'), alpha });
  return {
    c: at(0.74, 0.13),
    soft: at(0.74, 0.13, dark ? 0.18 : 0.2),
    text: dark ? at(0.85, 0.1) : at(0.48, 0.13),
    levels: [0.3, 0.52, 0.76, 1].map((a) => at(0.74, 0.13, a)),
    dim: at(0.74, 0.13, 0.35),
  };
};

const cache = new Map<string, Palette>();

export function getPalette(id: ThemeId, dark: boolean): Palette {
  const key = `${id}|${dark}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const src = GENERATED_THEMES[id] ?? GENERATED_THEMES.aurora;
  const m = dark ? src.dark : src.light;
  const factor = id === 'minimal' ? 0.3 : 1;
  const habitCache = new Map<number, HabitColors>();
  const palette: Palette = {
    id,
    name: src.name,
    dark,
    colors: m.colors as Colors,
    habit: (hue) => {
      const pre = (m.habit as Record<string, HabitColors>)[String(hue)];
      if (pre) return pre;
      let h = habitCache.get(hue);
      if (!h) {
        h = runtimeHabit(hue, dark, factor);
        habitCache.set(hue, h);
      }
      return h;
    },
    mood: (moodId) => (m.mood as Record<MoodId, MoodColors>)[moodId],
    fixed: FIXED_COLORS,
  };
  cache.set(key, palette);
  return palette;
}

const mixCache = new Map<string, string>();

/**
 * CSS `color-mix(in oklch, a p%, b)`: `p` is the share of `a` (0–1).
 * Used for the calendar day fill and chart bar blends.
 */
export function mix(a: string, b: string, p: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
  const key = `${a}|${b}|${pct}`;
  const hit = mixCache.get(key);
  if (hit) return hit;
  const out = toStr(
    clampChroma(interpolate([b, a], 'oklch')(pct / 100), 'oklch', 'rgb') as ReturnType<typeof parse>,
  );
  mixCache.set(key, out);
  return out;
}

/** Same colour at a new alpha. */
export function alpha(color: string, a: number): string {
  const c = parse(color);
  return c ? formatRgb({ ...c, alpha: a }) : color;
}

/** Split a colour into an opaque hex + opacity — SVG stops ignore alpha inside rgba(). */
export function splitAlpha(color: string): { color: string; opacity: number } {
  const c = parse(color);
  if (!c) return { color, opacity: 1 };
  return { color: formatHex({ ...c, alpha: undefined }), opacity: c.alpha ?? 1 };
}
