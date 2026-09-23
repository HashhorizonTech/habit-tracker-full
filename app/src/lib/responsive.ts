import { useWindowDimensions } from 'react-native';
import { layout } from '@/theme/tokens';

export interface ResponsiveLayout {
  width: number;
  height: number;
  /** ≥ 1000: sidebar layout, no tab bar (SPEC §3). */
  isDesktop: boolean;
  /** ≥ 700: tablets — wider gutters, 2-up grids, floating tab bar stays. */
  isTablet: boolean;
  /** Horizontal screen padding. */
  pad: number;
  /** Columns for the auto-fit grid (minmax(330px, 1fr)) inside the content area. */
  columns: number;
  /** Usable content width (after sidebar and padding, capped at 1120). */
  contentWidth: number;
}

export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= layout.desktopBreakpoint;
  const isTablet = width >= layout.tabletBreakpoint;
  const pad = isDesktop ? layout.padDesktop : isTablet ? 32 : layout.padMobile;
  const main = width - (isDesktop ? layout.sidebarWidth : 0);
  const contentWidth = Math.min(layout.contentMaxWidth, main - pad * 2);
  const columns = Math.max(1, Math.floor((contentWidth + 20) / (layout.gridMinColumn + 20)));
  return { width, height, isDesktop, isTablet, pad, columns, contentWidth };
}
