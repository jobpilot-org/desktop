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
import { postingState } from '@/domain/job-postings';
import { dueToday } from '@/domain/reminders';

import { useData } from '../app-context';
import { ReminderList } from '../components/reminder-list';
import { Empty, LoadError, Section } from '../ui';

const DAY = 24 * 60 * 60 * 1000;

export function OverviewPage() {
  const state = useData(async (repos) => {
    const now = new Date();
    const [applications, reminders, appointments, postings] = await Promise.all(
      [
        repos.applications.listActive(),
        repos.reminders.open(),
        repos.details.upcomingAppointments(
          now,
          new Date(now.getTime() + 14 * DAY),
        ),
        repos.jobPostings.list(),
      ],
    );
    return { applications, reminders, appointments, postings };
  });

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const { applications, reminders, appointments, postings } = state.data;
  const counts = countByFilter(applications);
  const activeIds = new Set(applications.map((a) => a.id));
  // Neueste zuerst (so liefert sie das Repository)
  const openPostings = postings.filter(
    (posting) => postingState(posting, activeIds) === 'open',
  );
  const due = dueToday(reminders);

  return (
    <div className="page">
      <p className="jp-eyebrow overview-eyebrow">
        Dein Karriere-Dashboard ·{' '}
        {new Intl.DateTimeFormat('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date())}
      </p>
      <h1 className="overview-title">
        Deine Suche,
        <br />
        mit Überblick.
      </h1>

      <div className="stats">
        <Link to="/stellen" className="stat stat-postings">
          <span className="stat-value">{openPostings.length}</span>
          <span className="stat-label">Stellenangebote</span>
        </Link>
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

      <Section
        title="Neue Stellenangebote"
        action={
          openPostings.length > 0 && <Link to="/stellen">Alle anzeigen</Link>
        }
      >
        {openPostings.length ? (
          <ul className="rows">
            {openPostings.slice(0, 5).map((posting) => (
              <li key={posting.id} className="row">
                <div className="row-main">
                  <Link to={`/stellen/${posting.id}`}>
                    <strong>{posting.company}</strong>
                  </Link>
                  <span className="muted">
                    {[posting.role, posting.location, posting.source]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Keine offenen Stellenangebote. Mit der jobpilot-Extension merkst du
            dir Anzeigen direkt im Browser.
          </Empty>
        )}
      </Section>

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
