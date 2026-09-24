import { useCallback, useState } from 'react';
import { STORAGE_PREFIX } from '../brand';

export type Theme = 'dark' | 'light';
const KEY = `${STORAGE_PREFIX}.theme`;

function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(current);
  const toggle = useCallback(() => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
    setTheme(next);
  }, []);
  return [theme, toggle];
}
