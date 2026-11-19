import { useEffect, useState, type DragEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  countByFilter,
  filterApplications,
  FILTER_LABELS,
  formatSalary,
  isSortOrder,
  isStatusFilter,
  PIPELINE_STATUSES,
  PRIORITY_LABELS,
  SORT_LABELS,
  SORT_ORDERS,
  sortApplications,
  STATUS_FILTERS,
  STATUS_LABELS,
  WORK_MODE_LABELS,
  type ApplicationStatus,
  type JobApplication,
  type SortOrder,
  type StatusFilter,
} from '@/domain/application';
import { formatAppointmentTime } from '@/domain/details';

import { useApp, useData } from '../app-context';
import { Empty, formatDate, LoadError, StatusBadge, useAction } from '../ui';

type View = 'list' | 'board';

const COLUMNS: { key: string; title: string; statuses: ApplicationStatus[] }[] =
  [
    ...PIPELINE_STATUSES.map((status) => ({
      key: status,
      title: STATUS_LABELS[status],
      statuses: [status],
    })),
    {
      key: 'closed',
      title: 'Abgeschlossen',
      statuses: ['rejected', 'withdrawn'],
    },
  ];

export function ApplicationsPage() {
  const { repos } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [view, setView] = useState<View>('list');
  const urlFilter = searchParams.get('filter');
  const filter: StatusFilter = isStatusFilter(urlFilter) ? urlFilter : 'all';

  const state = useData(async (r) => {
    const [applications, nextAppointments] = await Promise.all([
      r.applications.listActive(),
      r.details.nextAppointmentByApplication(),
    ]);
    return { applications, nextAppointments };
  });

  // Zuletzt gewählte Ansicht kommt aus den Kontoeinstellungen – geteilt mit den anderen Apps
  useEffect(() => {
    void repos.settings.all().then((stored) => {
      const storedSort = stored.get('applications.sort');
      if (isSortOrder(storedSort)) setSort(storedSort);
      if (stored.get('applications.view') === 'board') setView('board');
      const storedFilter = stored.get('applications.filter');
      if (
        !urlFilter &&
        isStatusFilter(storedFilter) &&
        storedFilter !== 'all'
      ) {
        setSearchParams({ filter: storedFilter }, { replace: true });
      }
    });
    // nur beim Öffnen der Seite
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeFilter = (next: StatusFilter) => {
    setSearchParams(next === 'all' ? {} : { filter: next });
    void repos.settings.set('applications.filter', next).catch(() => {});
  };
  const changeSort = (next: SortOrder) => {
    setSort(next);
    void repos.settings.set('applications.sort', next).catch(() => {});
  };
  const changeView = (next: View) => {
    setView(next);
    void repos.settings.set('applications.view', next).catch(() => {});
  };

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const { applications, nextAppointments } = state.data;
  const counts = countByFilter(applications);
  // Im Board sind die Spalten schon der Filter – dort nur die Suche anwenden
  const visible = sortApplications(
    filterApplications(applications, {
      filter: view === 'board' ? 'all' : filter,
      query,
    }),
    sort,
    nextAppointments,
  );
  const open = (id: string) => navigate(`/bewerbung/${id}`);

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1>Bewerbungen</h1>
        <div className="toolbar">
          <input
            type="search"
            placeholder="Suchen nach Firma, Position, Ort …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Bewerbungen durchsuchen"
          />
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value as SortOrder)}
            aria-label="Sortierung"
          >
            {SORT_ORDERS.map((order) => (
              <option key={order} value={order}>
                {SORT_LABELS[order]}
              </option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="Ansicht">
            <button
              aria-pressed={view === 'list'}
              onClick={() => changeView('list')}
            >
              Liste
            </button>
            <button
              aria-pressed={view === 'board'}
              onClick={() => changeView('board')}
            >
              Board
            </button>
          </div>
        </div>
      </div>

      {view === 'list' && (
        <div className="chips" role="group" aria-label="Filter">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option}
              className="chip"
              aria-pressed={filter === option}
              onClick={() => changeFilter(option)}
            >
              {FILTER_LABELS[option]}{' '}
              <span className="count">{counts[option]}</span>
            </button>
          ))}
        </div>
      )}

      {applications.length === 0 ? (
        <Empty>Noch keine Bewerbungen – lege oben links die erste an.</Empty>
      ) : view === 'list' ? (
        <ApplicationTable
          applications={visible}
          nextAppointments={nextAppointments}
          onOpen={open}
        />
      ) : (
        <Board
          applications={visible}
          nextAppointments={nextAppointments}
          onOpen={open}
        />
      )}
    </div>
  );
}

function ApplicationTable({
  applications,
  nextAppointments,
  onOpen,
}: {
  applications: JobApplication[];
  nextAppointments: ReadonlyMap<string, string>;
  onOpen: (id: string) => void;
}) {
  if (!applications.length) return <Empty>Keine Treffer.</Empty>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Unternehmen</th>
          <th>Status</th>
          <th>Ort</th>
          <th>Gehalt</th>
          <th>Priorität</th>
          <th>Datum</th>
          <th>Nächster Termin</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((application) => {
          const next = nextAppointments.get(application.id);
          return (
            <tr
              key={application.id}
              tabIndex={0}
              onClick={() => onOpen(application.id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(application.id)}
            >
              <td>
                <strong>{application.company}</strong>
                <div className="muted">{application.role}</div>
              </td>
              <td>
                <StatusBadge status={application.status} />
              </td>
              <td>
                {application.location}
                {application.workMode && (
                  <div className="muted">
                    {WORK_MODE_LABELS[application.workMode]}
                  </div>
                )}
              </td>
              <td>
                {formatSalary(application.salaryMin, application.salaryMax) ??
                  '–'}
              </td>
              <td className={`priority-${application.priority}`}>
                {PRIORITY_LABELS[application.priority]}
              </td>
              <td>{formatDate(application.appliedAt)}</td>
              <td>{next ? formatAppointmentTime(next) : '–'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Eine Spalte je Status. Karten lassen sich in eine andere Spalte ziehen; „Abgeschlossen“ setzt
 * dabei „Abgesagt“ – „Zurückgezogen“ gibt es über die Statusauswahl im Detail.
 */
function Board({
  applications,
  nextAppointments,
  onOpen,
}: {
  applications: JobApplication[];
  nextAppointments: ReadonlyMap<string, string>;
  onOpen: (id: string) => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const [dragOver, setDragOver] = useState<string>();

  const drop = (event: DragEvent, statuses: ApplicationStatus[]) => {
    event.preventDefault();
    setDragOver(undefined);
    const id = event.dataTransfer.getData('text/plain');
    const application = applications.find((a) => a.id === id);
    if (!application || statuses.includes(application.status)) return;
    void run(
      () => repos.applications.changeStatus(id, statuses[0]),
      `${application.company}: ${STATUS_LABELS[statuses[0]]}`,
    );
  };

  return (
    <div className="board">
      {COLUMNS.map((column) => {
        const cards = applications.filter((a) =>
          column.statuses.includes(a.status),
        );
        return (
          <section
            key={column.key}
            className={`board-column${dragOver === column.key ? ' drag-over' : ''}`}
            aria-label={`${column.title}, ${cards.length}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(column.key);
            }}
            onDragLeave={() => setDragOver(undefined)}
            onDrop={(e) => drop(e, column.statuses)}
          >
            <header>
              <span className={`dot status-${column.statuses[0]}`} />
              {column.title}
              <span className="count">{cards.length}</span>
            </header>
            {cards.map((application) => {
              const next = nextAppointments.get(application.id);
              return (
                <article
                  key={application.id}
                  className="board-card"
                  draggable
                  tabIndex={0}
                  onDragStart={(e) =>
                    e.dataTransfer.setData('text/plain', application.id)
                  }
                  onClick={() => onOpen(application.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(application.id)}
                >
                  <strong>{application.company}</strong>
                  <span className="muted">{application.role}</span>
                  {column.key === 'closed' && (
                    <StatusBadge status={application.status} />
                  )}
                  {next && (
                    <span className="muted small">
                      📅 {formatAppointmentTime(next)}
                    </span>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
