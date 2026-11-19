import { STATUS_LABELS } from '@/domain/application';
import {
  bySource,
  funnel,
  responseStats,
  weeklyActivity,
} from '@/domain/insights';

import { useData } from '../app-context';
import { Empty, LoadError, Section } from '../ui';

const percent = (share: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(share);

export function InsightsPage() {
  const state = useData((repos) => repos.applications.histories());

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const histories = state.data;
  const stages = funnel(histories);
  const responses = responseStats(histories);
  const sources = bySource(histories);
  const weeks = weeklyActivity(histories);
  const maxWeek = Math.max(1, ...weeks.map((week) => week.count));

  if (!responses.submitted) {
    return (
      <div className="page">
        <h1>Auswertung</h1>
        <Empty>
          Sobald die erste Bewerbung abgeschickt ist, erscheinen hier
          Auswertungen.
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Auswertung</h1>

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{responses.submitted}</span>
          <span className="stat-label">Abgeschickt</span>
        </div>
        <div className="stat">
          <span className="stat-value">{percent(responses.rate)}</span>
          <span className="stat-label">Rückmeldequote</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {responses.averageDays === undefined
              ? '–'
              : `${new Intl.NumberFormat('de-DE').format(responses.averageDays)} Tage`}
          </span>
          <span className="stat-label">Ø bis zur Antwort</span>
        </div>
      </div>

      <div className="columns">
        <Section title="Wie weit kommen Bewerbungen?">
          <ul className="bars" aria-label="Funnel">
            {stages.map(({ stage, count, share }) => (
              <li key={stage}>
                <span className="bar-label">{STATUS_LABELS[stage]}</span>
                <span className="bar-track">
                  <span
                    className={`bar status-${stage}`}
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
                <span className="bar-value">
                  {count} · {percent(share)}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Bewerbungen pro Woche">
          <div className="week-chart" aria-label="Bewerbungen pro Woche">
            {weeks.map((week) => (
              <div
                key={week.weekStart}
                className="week"
                title={`${week.label}: ${week.count}`}
              >
                <span className="week-count">{week.count || ''}</span>
                <span
                  className="week-bar"
                  style={{ height: `${(week.count / maxWeek) * 100}%` }}
                />
                <span className="week-label">{week.label}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Erfolg nach Quelle">
        <table className="table compact">
          <thead>
            <tr>
              <th>Quelle</th>
              <th>Bewerbungen</th>
              <th>Gespräche</th>
              <th>Angebote</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.source}>
                <td>{source.source}</td>
                <td>{source.submitted}</td>
                <td>
                  {source.interviews} (
                  {percent(source.interviews / source.submitted)})
                </td>
                <td>{source.offers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
