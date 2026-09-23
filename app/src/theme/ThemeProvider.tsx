import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAppearance } from '@/store/appearance';
import { duration, easing } from './motion';
import { getPalette, type ColorToken, type Colors, type Palette } from './palette';

interface ThemeContextValue extends Palette {
  c: Colors;
  reduceMotion: boolean;
  /** 0 → 1 while cross-fading from `from` to `to` colours. */
  progress: SharedValue<number>;
  from: SharedValue<Colors>;
  to: SharedValue<Colors>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { themeId, mode } = useAppearance();
  const system = useColorScheme();
  const dark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const palette = getPalette(themeId, dark);
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(1);
  const from = useSharedValue<Colors>(palette.colors);
  const to = useSharedValue<Colors>(palette.colors);
  const last = useRef(palette.colors);

  useEffect(() => {
    if (last.current === palette.colors) return;
    from.set(last.current);
    to.set(palette.colors);
    last.current = palette.colors;
    progress.set(0);
    progress.set(withTiming(1, { duration: duration.theme, easing: easing.inOut }));
  }, [palette.colors, from, to, progress]);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...palette, c: palette.colors, reduceMotion, progress, from, to }),
    [palette, reduceMotion, progress, from, to],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

type ColorProp = 'backgroundColor' | 'borderColor' | 'color';

/**
 * Animated style that interpolates a colour token across a theme / mode switch
 * (SPEC §1: ~400 ms, no reload). Use on large surfaces: screen bg, sheets, cards, tab bar.
 */
export function useThemedColor(token: ColorToken, prop: ColorProp = 'backgroundColor') {
  const { progress, from, to } = useTheme();
  return useAnimatedStyle(() => ({
    [prop]: interpolateColor(progress.value, [0, 1], [from.value[token], to.value[token]]),
  }));
}
