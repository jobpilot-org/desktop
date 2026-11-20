import { Navigate, NavLink, Outlet, useLocation } from 'react-router';

import { useApp, useData } from './app-context';
import { useReminderService } from './use-reminder-service';

const NAV: { to: string; label: string; end: boolean; also?: string }[] = [
  { to: '/', label: 'Übersicht', end: true },
  // Auch Detailseite und Formular (/bewerbung/…) gehören zum Tab „Bewerbungen“
  { to: '/bewerbungen', label: 'Bewerbungen', end: false, also: '/bewerbung/' },
  { to: '/auswertung', label: 'Auswertung', end: false },
  { to: '/profil', label: 'Profil', end: false },
  { to: '/einstellungen', label: 'Einstellungen', end: false },
];

/** Kopfzeile wie die Web-Version der mobile-app (app-tabs.web.tsx): Wortmarke, dann die Tabs */
export function Layout() {
  const { session } = useApp();
  const { pathname } = useLocation();
  useReminderService();
  // Nach dem ersten Login zur Willkommensseite, bis ein Weg zum Profil gewählt ist
  const profile = useData((r) => r.profile.get());
  const needsWelcome = profile.status === 'ready' && !profile.data?.onboardedAt;
  if (needsWelcome && pathname === '/') {
    return <Navigate to="/willkommen" replace />;
  }

  return (
    <div className="shell">
      <header className="jp-topbar">
        <nav className="jp-topbar__inner" aria-label="Hauptnavigation">
          <NavLink to="/" end className="jp-brand">
            jobpilot<span className="jp-brand__dot">.</span>
          </NavLink>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ||
                (item.also !== undefined && pathname.startsWith(item.also))
                  ? 'jp-tab is-active'
                  : 'jp-tab'
              }
            >
              {item.label}
            </NavLink>
          ))}
          <span className="topbar-account" title={session?.user.email}>
            {session?.user.email}
          </span>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
