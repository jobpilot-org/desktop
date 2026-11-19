import { Link } from 'react-router';

import {
  countByFilter,
  FILTER_LABELS,
  STATUS_FILTERS,
} from '@/domain/application';
import {
  APPOINTMENT_KIND_LABELS,
  formatAppointmentTime,
} from '@/domain/details';
import { dueToday } from '@/domain/reminders';

import { useData } from '../app-context';
import { ReminderList } from '../components/reminder-list';
import { Empty, LoadError, Section } from '../ui';

const DAY = 24 * 60 * 60 * 1000;

export function OverviewPage() {
  const state = useData(async (repos) => {
    const now = new Date();
    const [applications, reminders, appointments] = await Promise.all([
      repos.applications.listActive(),
      repos.reminders.open(),
      repos.details.upcomingAppointments(
        now,
        new Date(now.getTime() + 14 * DAY),
      ),
    ]);
    return { applications, reminders, appointments };
  });

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const { applications, reminders, appointments } = state.data;
  const counts = countByFilter(applications);
  const due = dueToday(reminders);

  return (
    <div className="page">
      <h1>Übersicht</h1>

      <div className="stats">
        {STATUS_FILTERS.filter((filter) => filter !== 'all').map((filter) => (
          <Link
            key={filter}
            to={`/bewerbungen?filter=${filter}`}
            className="stat"
          >
            <span className="stat-value">{counts[filter]}</span>
            <span className="stat-label">{FILTER_LABELS[filter]}</span>
          </Link>
        ))}
      </div>

      <div className="columns">
        <Section title="Heute fällig">
          {due.length ? (
            <ReminderList reminders={due} />
          ) : (
            <Empty>Keine Erinnerungen für heute.</Empty>
          )}
        </Section>

        <Section title="Nächste Termine">
          {appointments.length ? (
            <ul className="rows">
              {appointments.map((appointment) => (
                <li key={appointment.id} className="row">
                  <div className="row-main">
                    <Link to={`/bewerbung/${appointment.applicationId}`}>
                      <strong>{appointment.company}</strong>
                    </Link>
                    <span className="muted">
                      {formatAppointmentTime(appointment.startsAt)} ·{' '}
                      {APPOINTMENT_KIND_LABELS[appointment.kind]} ·{' '}
                      {appointment.role}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>In den nächsten 14 Tagen stehen keine Termine an.</Empty>
          )}
        </Section>
      </div>

      {applications.length === 0 && (
        <Section title="Los geht’s">
          <Empty>
            Noch keine Bewerbungen.{' '}
            <Link to="/bewerbung/neu">Erste Bewerbung anlegen</Link>
          </Empty>
        </Section>
      )}
    </div>
  );
}
