// Design tokens — SPEC §1. Colours live in themes.generated.ts / palette.ts.
import type { TextStyle } from 'react-native';

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 34,
  pill: 999,
} as const;

export const layout = {
  /** Screen side padding. */
  padMobile: 20,
  padDesktop: 44,
  /** At or above this window width the app switches to the sidebar layout. */
  desktopBreakpoint: 1000,
  /** Tablet width where lists can go 2-up but the tab bar remains. */
  tabletBreakpoint: 700,
  sidebarWidth: 248,
  contentMaxWidth: 1120,
  gridMinColumn: 330,
  tabBar: { inset: 16, bottom: 22, height: 68, radius: 26 },
  backButton: 44,
  minTouch: 44,
} as const;

export const fonts = {
  display600: 'BricolageGrotesque_600SemiBold',
  display700: 'BricolageGrotesque_700Bold',
  display800: 'BricolageGrotesque_800ExtraBold',
  body400: 'Figtree_400Regular',
  body500: 'Figtree_500Medium',
  body600: 'Figtree_600SemiBold',
  body700: 'Figtree_700Bold',
} as const;

/** letter-spacing in em → RN points. */
const em = (size: number, e: number) => +(size * e).toFixed(2);

const display = (size: number, family: string = fonts.display800, tracking = -0.03): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight: Math.round(size * 1.05),
  letterSpacing: em(size, tracking),
});

export const type = {
  display: display(44, fonts.display800, -0.04),
  h1: display(30, fonts.display800, -0.03),
  h2: display(20, fonts.display700, -0.02),
  subhead: { fontFamily: fonts.body600, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.body600, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.body500, fontSize: 13, lineHeight: 18 },
  caption: {
    fontFamily: fonts.body700,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: em(11.5, 0.1),
    textTransform: 'uppercase',
  },
  /** Stat numbers such as "12 days". */
  stat: { ...display(22, fonts.display800, -0.02), fontVariant: ['tabular-nums'] },
  bigNumber: { ...display(46, fonts.display800, -0.04), fontVariant: ['tabular-nums'] },
  timer: { ...display(66, fonts.display800, -0.04), lineHeight: 70, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Dynamic Type ceiling (SPEC §7: up to 130% without clipping). */
export const MAX_FONT_SCALE = 1.3;
