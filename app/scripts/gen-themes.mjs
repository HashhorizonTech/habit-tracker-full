// Build-time theme generator (SPEC §1). Converts the OKLCH formulas from the
// prototype's `tv()` into sRGB hex / rgba strings React Native can use, and
// checks text contrast. Run: npm run gen:themes
import { writeFileSync } from 'node:fs';
import { clampChroma, formatHex, formatRgb, wcagContrast } from 'culori';

const THEMES = [
  { id: 'aurora', name: 'Aurora', h: 275, c: 0.035, a1: [0.7, 0.17, 290], a2: [0.74, 0.13, 230] },
  { id: 'mint', name: 'Mint', h: 165, c: 0.025, a1: [0.76, 0.12, 168], a2: [0.86, 0.1, 115] },
  { id: 'sunset', name: 'Sunset', h: 45, c: 0.03, a1: [0.74, 0.15, 48], a2: [0.72, 0.16, 12] },
  { id: 'lavender', name: 'Lavender', h: 300, c: 0.03, a1: [0.7, 0.15, 300], a2: [0.8, 0.1, 330] },
  { id: 'ocean', name: 'Ocean', h: 232, c: 0.035, a1: [0.7, 0.14, 245], a2: [0.8, 0.12, 200] },
  { id: 'minimal', name: 'Minimal', h: 260, c: 0, a1: [0.2, 0, 0], a2: [0.6, 0, 0] },
  { id: 'forest', name: 'Forest', h: 150, c: 0.025, a1: [0.64, 0.11, 152], a2: [0.82, 0.08, 110] },
  { id: 'candy', name: 'Candy', h: 345, c: 0.03, a1: [0.74, 0.15, 350], a2: [0.76, 0.12, 265] },
];

// Habit colour hues offered in Create habit, plus any used by seed/onboarding data.
const HABIT_HUES = [230, 200, 165, 120, 60, 25, 340, 285];
const MOOD_HUES = { great: 85, good: 150, okay: 235, low: 285, tired: 25 };

const col = (l, c, h, alpha) => {
  const raw = { mode: 'oklch', l, c, h: h ?? 0 };
  const inGamut = clampChroma(raw, 'oklch', 'rgb');
  return alpha == null ? inGamut : { ...inGamut, alpha };
};
const str = (color) =>
  color.alpha == null || color.alpha >= 1 ? formatHex(color) : formatRgb(color);
const ok = (l, c, h, a) => str(col(l, c, h, a));
const withAlpha = (hexColor, alpha) => {
  // hexColor already in gamut; reparse via culori
  const base = col(...hexColor);
  return str({ ...base, alpha });
};

function tokens(t, dark) {
  const { h, c } = t;
  const mn = t.id === 'minimal';
  const v = dark
    ? {
        page: ok(0.13, c * 1.1, h),
        bg: ok(0.17, c * 1.2, h),
        bg2: ok(0.21, c * 1.5, h),
        surface: ok(0.23, c * 1.3, h, 0.7),
        surface2: ok(0.26, c * 1.4, h),
        sheet: ok(0.2, c * 1.3, h),
        ink: ok(0.97, Math.min(c, 0.01), h),
        ink2: ok(0.8, c * 1.2, h),
        ink3: ok(0.66, c * 1.2, h),
        line: 'rgba(255, 255, 255, 0.08)',
        track: 'rgba(255, 255, 255, 0.09)',
      }
    : {
        page: ok(0.92, c * 0.9, h),
        bg: ok(0.975, c * 0.4, h),
        bg2: ok(0.955, c * 0.7, h),
        surface: 'rgba(255, 255, 255, 0.75)',
        surface2: ok(0.935, c * 0.7, h),
        sheet: ok(0.99, c * 0.2, h),
        ink: ok(0.22, c * 1.4, h),
        ink2: ok(0.42, c * 1.2, h),
        ink3: ok(0.52, c, h),
        line: ok(0.3, c * 1.5, h, 0.1),
        track: ok(0.3, c * 1.5, h, 0.09),
      };
  const [l1, c1, h1] = t.a1;
  const [l2, c2, h2] = t.a2;
  const a1 = mn ? (dark ? [0.95, 0, 0] : [0.2, 0, 0]) : [l1, c1, h1];
  const a2 = mn ? (dark ? [0.68, 0, 0] : [0.55, 0, 0]) : [l2, c2, h2];
  v.a1 = ok(...a1);
  v.a2 = ok(...a2);
  v.a1ink = mn ? (dark ? ok(0.15, 0, 0) : ok(0.99, 0, 0)) : ok(0.2, 0.05, h1);
  v.a1text = mn ? v.a1 : dark ? ok(0.84, c1 * 0.75, h1) : ok(0.5, c1, h1);
  v.a1soft = withAlpha(a1, dark ? 0.2 : 0.16);
  v.a2soft = withAlpha(a2, dark ? 0.16 : 0.14);
  v.glow = withAlpha(a1, dark ? 0.45 : 0.35);
  return v;
}

function habitPalette(dark, factor) {
  const out = {};
  for (const hue of HABIT_HUES) {
    out[hue] = {
      c: ok(0.74, 0.13 * factor, hue),
      soft: ok(0.74, 0.13 * factor, hue, dark ? 0.18 : 0.2),
      text: dark ? ok(0.85, 0.1 * factor, hue) : ok(0.48, 0.13 * factor, hue),
      // heatmap levels: track, 30%, 52%, 76%, 100%
      levels: [0.3, 0.52, 0.76, 1].map((a) => ok(0.74, 0.13 * factor, hue, a)),
      dim: ok(0.74, 0.13 * factor, hue, 0.35),
    };
  }
  return out;
}

function moodPalette(factor) {
  const out = {};
  for (const [id, hue] of Object.entries(MOOD_HUES)) {
    out[id] = { fill: ok(0.86, 0.11 * factor + 0.02, hue), ink: ok(0.3, 0.06, hue) };
  }
  return out;
}

const result = {};
const report = [];
for (const t of THEMES) {
  const factor = t.id === 'minimal' ? 0.3 : 1;
  result[t.id] = { id: t.id, name: t.name, dark: {}, light: {} };
  for (const mode of ['dark', 'light']) {
    const dark = mode === 'dark';
    const v = tokens(t, dark);
    result[t.id][mode] = {
      colors: v,
      habit: habitPalette(dark, factor),
      mood: moodPalette(factor),
    };
    const pairs = [
      ['ink3/bg', v.ink3, v.bg],
      ['ink3/sheet', v.ink3, v.sheet],
      ['ink2/bg', v.ink2, v.bg],
      ['a1ink/a1', v.a1ink, v.a1],
      ['a1text/bg', v.a1text, v.bg],
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio = wcagContrast(fg, bg);
      if (ratio < 4.5) report.push(`${t.id}/${mode} ${label} = ${ratio.toFixed(2)}`);
    }
  }
}

const FIXED = {
  flame: ok(0.76, 0.16, 52),
  flameSoft: ok(0.76, 0.16, 52, 0.18),
  priority: { high: ok(0.7, 0.17, 25), med: ok(0.8, 0.14, 80), low: ok(0.72, 0.1, 235) },
  positive: ok(0.78, 0.14, 150),
  positiveSoft: ok(0.78, 0.14, 150, 0.16),
  leaf: ok(0.76, 0.15, 145),
  stem: ok(0.6, 0.12, 150),
  blush: ok(0.8, 0.13, 15, 0.6),
  star: ok(0.87, 0.15, 90),
  sun: ok(0.87, 0.15, 80),
  sunHalo1: ok(0.87, 0.15, 80, 0.22),
  sunHalo2: ok(0.87, 0.15, 80, 0.08),
  moon: ok(0.9, 0.1, 95),
  sparkle: ok(0.9, 0.12, 90),
  cup: ok(0.95, 0.02, 60),
  face: '#1d1a2e',
};

const file = `// AUTO-GENERATED by scripts/gen-themes.mjs — do not edit by hand.
// Source of truth: SPEC §1 OKLCH formulas. Regenerate with \`npm run gen:themes\`.
export const GENERATED_THEMES = ${JSON.stringify(result, null, 2)} as const;

export const FIXED_COLORS = ${JSON.stringify(FIXED, null, 2)} as const;

export const HABIT_HUES = ${JSON.stringify(HABIT_HUES)} as const;
`;
writeFileSync(new URL('../src/theme/themes.generated.ts', import.meta.url), file);
console.log(`Wrote ${THEMES.length} themes × 2 modes.`);
console.log(report.length ? `Contrast below 4.5:1:\n  ${report.join('\n  ')}` : 'All checked text pairs ≥ 4.5:1');
