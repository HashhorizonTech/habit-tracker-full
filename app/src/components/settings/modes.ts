import type { Mode } from '@/theme/palette';

/** Light / Dark / System options shared by Settings and Themes. */
export const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];
