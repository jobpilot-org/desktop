import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  APPLICATION_STATUSES,
  formatSalary,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WORK_MODE_LABELS,
  type ApplicationStatus,
} from '@/domain/application';
import {
  APPOINTMENT_KIND_LABELS,
  formatAppointmentTime,
  type Appointment,
  type Contact,
} from '@/domain/details';
import { buildTimeline, type TimelineItem } from '@/domain/timeline';

import { useApp, useData } from '../app-context';
import {
  AppointmentDialog,
  ContactDialog,
  CustomReminderDialog,
} from '../components/detail-dialogs';
import { ReminderList } from '../components/reminder-list';
import {
  Empty,
  formatDate,
  formatDateTime,
  LoadError,
  Section,
  StatusBadge,
  useAction,
  useToast,
} from '../ui';

type OpenDialog =
  | { kind: 'appointment'; appointment?: Appointment }
  | { kind: 'contact'; contact?: Contact }
  | { kind: 'reminder' };

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const { repos } = useApp();
  const navigate = useNavigate();
  const run = useAction();
  const toast = useToast();
  const [dialog, setDialog] = useState<OpenDialog>();
  const [note, setNote] = useState('');

  const state = useData(
    async (r) => {
      const [application, events, notes, appointments, contacts, reminders] =
        await Promise.all([
          r.applications.get(id),
          r.applications.statusEvents(id),
          r.details.notes(id),
          r.details.appointments(id),
          r.details.contacts(id),
          r.reminders.forApplication(id),
        ]);
      return { application, events, notes, appointments, contacts, reminders };
    },
    [id],
  );

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const { application, events, notes, appointments, contacts, reminders } =
    state.data;
  if (!application) {
    return (
      <div className="page">
        <Empty>
          Diese Bewerbung gibt es nicht mehr.{' '}
          <Link to="/bewerbungen">Zur Liste</Link>
        </Empty>
      </div>
    );
  }

  const now = new Date();
  const timeline = buildTimeline({ events, notes, appointments }, now);
  const upcoming = appointments.filter((a) => new Date(a.startsAt) > now);
  const salary = formatSalary(application.salaryMin, application.salaryMax);

  const changeStatus = (status: ApplicationStatus) =>
    run(
      () => repos.applications.changeStatus(id, status),
      `Status: ${STATUS_LABELS[status]}`,
    );

  async function archive() {
    if (!(await run(() => repos.applications.archive(id)))) return;
    navigate('/bewerbungen');
    toast({
      text: `${application?.company} gelöscht`,
      action: {
        label: 'Rückgängig',
        run: () => void run(() => repos.applications.restore(id)),
      },
    });
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    if (await run(() => repos.details.addNote(id, note))) setNote('');
  }

  return (
    <div className="page">
      <nav className="back">
        <Link to="/bewerbungen">← Bewerbungen</Link>
      </nav>
      <div className="page-header detail-header">
        <div>
          <h1 className="detail-company">{application.company}</h1>
          <p className="subtitle">{application.role}</p>
          {(application.location || application.workMode) && (
            <p className="detail-place muted">
              {[
                application.location,
                application.workMode && WORK_MODE_LABELS[application.workMode],
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <button onClick={() => navigate(`/bewerbung/${id}/bearbeiten`)}>
          Bearbeiten
        </button>
      </div>

      <div className="chips status-chips" role="group" aria-label="Status">
        {APPLICATION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="chip"
            aria-pressed={status === application.status}
            onClick={() => changeStatus(status)}
          >
            <span className={`dot status-${status}`} />
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {application.nextStep && (
        <section className="next-step">
          <span className="jp-eyebrow">Nächster Schritt</span>
          <p>{application.nextStep}</p>
        </section>
      )}

      <div className="columns">
        <div className="stack">
          <Section title="Eckdaten">
            <dl className="facts">
              <dt>Status</dt>
              <dd>
                <StatusBadge status={application.status} />
              </dd>
              <dt>Ort</dt>
              <dd>
                {application.location || '–'}
                {application.workMode &&
                  ` · ${WORK_MODE_LABELS[application.workMode]}`}
              </dd>
              <dt>
                {application.status === 'saved' ? 'Gemerkt am' : 'Beworben am'}
              </dt>
              <dd>{formatDate(application.appliedAt)}</dd>
              <dt>Priorität</dt>
              <dd>{PRIORITY_LABELS[application.priority]}</dd>
              {application.source && (
                <>
                  <dt>Quelle</dt>
                  <dd>{application.source}</dd>
                </>
              )}
              {salary && (
                <>
                  <dt>Gehalt</dt>
                  <dd>{salary}</dd>
                </>
              )}
              {application.jobUrl && (
                <>
                  <dt>Anzeige</dt>
                  <dd>
                    <a
                      href={application.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {hostOf(application.jobUrl)}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </Section>

          <Section
            title="Erinnerungen"
            action={
              <button
                className="link"
                onClick={() => setDialog({ kind: 'reminder' })}
              >
                + Eigene
              </button>
            }
          >
            {reminders.length ? (
              <ReminderList reminders={reminders} showCompany={false} />
            ) : (
              <Empty>Keine offenen Erinnerungen.</Empty>
            )}
          </Section>

          <Section
            title="Termine"
            action={
              <button
                className="link"
                onClick={() => setDialog({ kind: 'appointment' })}
              >
                + Termin
              </button>
            }
          >
            {upcoming.length ? (
              <ul className="rows">
                {upcoming.map((appointment) => (
                  <li key={appointment.id} className="row">
                    <button
                      className="row-main plain"
                      onClick={() =>
                        setDialog({ kind: 'appointment', appointment })
                      }
                    >
                      <strong>
                        {formatAppointmentTime(appointment.startsAt, now)}
                      </strong>
                      <span className="muted">
                        {APPOINTMENT_KIND_LABELS[appointment.kind]}
                        {appointment.location && ` · ${appointment.location}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Keine anstehenden Termine.</Empty>
            )}
          </Section>

          <Section
            title="Kontakte"
            action={
              <button
                className="link"
                onClick={() => setDialog({ kind: 'contact' })}
              >
                + Kontakt
              </button>
            }
          >
            {contacts.length ? (
              <ul className="rows">
                {contacts.map((contact) => (
                  <li key={contact.id} className="row">
                    <button
                      className="row-main plain"
                      onClick={() => setDialog({ kind: 'contact', contact })}
                    >
                      <strong>{contact.name}</strong>
                      {contact.role && (
                        <span className="muted">{contact.role}</span>
                      )}
                    </button>
                    <div className="row-actions">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`}>E-Mail</a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`}>Anrufen</a>
                      )}
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Noch keine Kontakte.</Empty>
            )}
          </Section>
        </div>

        <div className="stack">
          <Section title="Verlauf">
            <form className="note-form" onSubmit={addNote}>
              <textarea
                rows={2}
                placeholder="Notiz hinzufügen …"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(e);
                }}
              />
              <button type="submit" disabled={!note.trim()}>
                Notiz speichern
              </button>
            </form>
            <ol className="timeline">
              {timeline.map((item) => (
                <TimelineEntry
                  key={`${item.kind}-${item.at}-${'note' in item ? item.note.id : ''}`}
                  item={item}
                  onDeleteNote={(noteId) =>
                    confirm('Notiz löschen?') &&
                    run(() => repos.details.deleteNote(noteId))
                  }
                />
              ))}
            </ol>
          </Section>

          {application.jobDescription && (
            <Section title="Stellenanzeige">
              <details>
                <summary>Anzeigentext anzeigen</summary>
                <p className="prewrap">{application.jobDescription}</p>
              </details>
            </Section>
          )}
        </div>
      </div>

      <button className="danger delete-button" onClick={archive}>
        Bewerbung löschen
      </button>

      {dialog?.kind === 'appointment' && (
        <AppointmentDialog
          applicationId={id}
          appointment={dialog.appointment}
          onClose={() => setDialog(undefined)}
        />
      )}
      {dialog?.kind === 'contact' && (
        <ContactDialog
          applicationId={id}
          contact={dialog.contact}
          onClose={() => setDialog(undefined)}
        />
      )}
      {dialog?.kind === 'reminder' && (
        <CustomReminderDialog
          applicationId={id}
          onClose={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}

/** Andere Apps schreiben in dieselbe Tabelle – ein kaputter Link darf die Seite nicht sprengen */
function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function TimelineEntry({
  item,
  onDeleteNote,
}: {
  item: TimelineItem;
  onDeleteNote: (id: string) => void;
}) {
  if (item.kind === 'status') {
    const { from, to } = item.event;
    return (
      <li className="timeline-item">
        <span className="timeline-time">{formatDateTime(item.at)}</span>
        {from ? (
          <span>
            Status: {STATUS_LABELS[from]} → <StatusBadge status={to} />
          </span>
        ) : (
          <span>
            Angelegt als <StatusBadge status={to} />
          </span>
        )}
      </li>
    );
  }
  if (item.kind === 'note') {
    return (
      <li className="timeline-item note">
        <span className="timeline-time">
          {formatDateTime(item.at)}
          <button
            className="link small"
            onClick={() => onDeleteNote(item.note.id)}
          >
            Löschen
          </button>
        </span>
        <span className="prewrap">{item.note.body}</span>
      </li>
    );
  }
  return (
    <li className={`timeline-item${item.upcoming ? ' upcoming' : ''}`}>
      <span className="timeline-time">{formatDateTime(item.at)}</span>
      <span>
        {item.upcoming ? 'Geplant: ' : ''}
        {APPOINTMENT_KIND_LABELS[item.appointment.kind]}
        {item.appointment.location && ` · ${item.appointment.location}`}
      </span>
    </li>
  );
}
