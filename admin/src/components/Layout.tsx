import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAdmin, useAuth } from '../auth/context';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users', end: false },
  { to: '/subscriptions', label: 'Subscriptions', end: false },
  { to: '/audit', label: 'Audit log', end: false },
];

export function Layout() {
  const admin = useAdmin();
  const { signOut } = useAuth();
  const location = useLocation();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // Menu (mobile) closes automatically on navigation: it's open only for the path it was opened on.
  const menuOpen = menuFor === location.pathname;

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <NavLink to="/" className="sidebar-logo" aria-label="Dashboard">
            <Logo />
          </NavLink>
          <button
            type="button"
            className="btn btn-ghost btn-sm menu-button"
            aria-expanded={menuOpen}
            aria-controls="sidebar-nav"
            onClick={() => setMenuFor(menuOpen ? null : location.pathname)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <div className="sidebar-collapsible" id="sidebar-nav">
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <ThemeToggle />
            <div className="sidebar-user">
              <span className="sidebar-user-label">Signed in as</span>
              <span className="sidebar-user-email" title={admin.email}>
                {admin.email}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <main id="main" className="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
