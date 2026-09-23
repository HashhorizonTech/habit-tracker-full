import type { Href } from 'expo-router';
import type { IconName } from '@/components/icons/paths';

export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: Href;
  /** Pathnames that count as this item being active. */
  match: (path: string) => boolean;
}

const is = (...paths: string[]) => (p: string) => paths.includes(p);
const startsWith = (prefix: string) => (p: string) => p === prefix || p.startsWith(prefix + '/');

/** Mobile floating tab bar (SPEC §3). */
export const TABS: NavItem[] = [
  { id: 'today', label: 'Today', icon: 'home', href: '/', match: is('/') },
  { id: 'habits', label: 'Habits', icon: 'habits', href: '/habits', match: startsWith('/habits') },
  { id: 'focus', label: 'Focus', icon: 'focus', href: '/focus', match: startsWith('/focus') },
  { id: 'insights', label: 'Insights', icon: 'stats', href: '/insights', match: startsWith('/insights') },
  { id: 'you', label: 'You', icon: 'profile', href: '/you', match: startsWith('/you') },
];

/** Desktop sidebar (≥1000px). Tasks, Calendar and Achievements become top-level here. */
export const SIDEBAR: NavItem[] = [
  TABS[0],
  TABS[1],
  TABS[2],
  { id: 'tasks', label: 'Tasks', icon: 'tasks', href: '/tasks', match: startsWith('/tasks') },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', href: '/calendar', match: startsWith('/calendar') },
  TABS[3],
  { id: 'achievements', label: 'Achievements', icon: 'trophy', href: '/achievements', match: startsWith('/achievements') },
  { ...TABS[4], label: 'Profile' },
];
