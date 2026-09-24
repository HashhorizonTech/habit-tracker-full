import { useTheme } from '../lib/theme';

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="btn btn-ghost btn-sm theme-toggle" onClick={toggle} aria-label={`Switch to ${next} mode`}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
      <span className="theme-toggle-text">{next === 'light' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
