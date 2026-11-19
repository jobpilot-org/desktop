import { NavLink, Outlet, useNavigate } from 'react-router';

import { useApp } from './app-context';
import { useReminderService } from './use-reminder-service';

const NAV = [
  { to: '/', label: 'Übersicht', end: true },
  { to: '/bewerbungen', label: 'Bewerbungen', end: false },
  { to: '/auswertung', label: 'Auswertung', end: false },
  { to: '/einstellungen', label: 'Einstellungen', end: false },
];

export function Layout() {
  const { session } = useApp();
  const navigate = useNavigate();
  useReminderService();

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Hauptnavigation">
        <div className="brand">JobPilot</div>
        <button className="primary" onClick={() => navigate('/bewerbung/neu')}>
          + Neue Bewerbung
        </button>
        <ul>
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">{session?.user.email}</div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
