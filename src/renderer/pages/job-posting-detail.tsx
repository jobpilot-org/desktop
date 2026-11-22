import { Fragment } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  formatSalary,
  STATUS_LABELS,
  WORK_MODE_LABELS,
} from '@/domain/application';
import { POSTING_STATE_LABELS, postingState } from '@/domain/job-postings';

import { useApp, useData } from '../app-context';
import { FitSection } from '../components/job-fit';
import { useDeletePosting } from '../delete-actions';
import { useProfile } from './profile';
import { Empty, formatDate, LoadError, Section, useAction } from '../ui';

/** Ein Stellenangebot: Eckdaten, Anzeige, Ansprechpartner – und daraus eine Bewerbung machen */
export function JobPostingDetailPage() {
  const { id = '' } = useParams();
  const { repos } = useApp();
  const navigate = useNavigate();
  const run = useAction();
  const deletePosting = useDeletePosting();
  const { profile } = useProfile();

  const state = useData(
    async (r) => {
      const posting = await r.jobPostings.get(id);
      const application = posting?.applicationId
        ? await r.applications.get(posting.applicationId)
        : undefined;
      return { posting, application };
    },
    [id],
  );

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const { posting, application } = state.data;
  if (!posting) {
    return (
      <div className="page">
        <Empty>
          Dieses Stellenangebot gibt es nicht mehr.{' '}
          <Link to="/stellen">Zur Liste</Link>
        </Empty>
      </div>
    );
  }

  const current = postingState(
    posting,
    new Set(application ? [application.id] : []),
  );
  const salary = formatSalary(posting.salaryMin, posting.salaryMax);
  const facts: [string, string | undefined][] = [
    [
      'Ort',
      [posting.location, posting.workMode && WORK_MODE_LABELS[posting.workMode]]
        .filter(Boolean)
        .join(' · ') || undefined,
    ],
    ['Gehalt', salary || undefined],
    ['Quelle', posting.source],
    ['Gemerkt am', formatDate(posting.createdAt.slice(0, 10))],
  ];

  async function remove() {
    if (await deletePosting(posting!)) navigate('/stellen');
  }

  return (
    <div className="page">
      <nav className="back">
        <Link to="/stellen">← Stellenangebote</Link>
      </nav>
      <div className="page-header detail-header">
        <div>
          <p className="jp-eyebrow">Stellenangebot</p>
          <h1 className="detail-company">{posting.company}</h1>
          <p className="subtitle">{posting.role}</p>
        </div>
        <span className="posting-state" data-state={current}>
          {POSTING_STATE_LABELS[current]}
        </span>
      </div>

      {current === 'applied' && application ? (
        <section className="next-step">
          <span className="jp-eyebrow">Bewerbung angelegt</span>
          <p>
            {STATUS_LABELS[application.status]} seit{' '}
            {formatDate(application.appliedAt)} ·{' '}
            <Link to={`/bewerbung/${application.id}`}>Zur Bewerbung</Link>
          </p>
        </section>
      ) : (
        <div className="toolbar posting-actions">
          <button
            type="button"
            className="primary"
            onClick={() =>
              navigate(`/bewerbung/neu?stellenangebot=${posting.id}`)
            }
          >
            Bewerbung anlegen
          </button>
          {posting.jobUrl && (
            // Öffnet im Standardbrowser (setWindowOpenHandler in main.ts)
            <button
              type="button"
              onClick={() => window.open(posting.jobUrl, '_blank')}
            >
              Anzeige öffnen ↗
            </button>
          )}
          {current === 'dismissed' ? (
            <button
              type="button"
              onClick={() =>
                void run(
                  () => repos.jobPostings.setDismissed(id, false),
                  'Wieder offen',
                )
              }
            >
              Wieder öffnen
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                void run(
                  () => repos.jobPostings.setDismissed(id, true),
                  'Als nicht interessant markiert',
                )
              }
            >
              Nicht interessant
            </button>
          )}
        </div>
      )}

      <FitSection posting={posting} profile={profile} />

      <div className="columns">
        <div className="stack">
          <Section title="Eckdaten">
            <dl className="facts">
              {facts
                .filter((fact): fact is [string, string] => !!fact[1])
                .map(([label, value]) => (
                  <Fragment key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </Fragment>
                ))}
              {posting.jobUrl && (
                <>
                  <dt>Anzeige</dt>
                  <dd>
                    <a href={posting.jobUrl} target="_blank" rel="noreferrer">
                      {hostOf(posting.jobUrl)}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </Section>

          {(posting.contactName || posting.contactEmail) && (
            <Section title="Ansprechpartner">
              <p>
                {posting.contactName}
                {posting.contactEmail && (
                  <>
                    {posting.contactName && <br />}
                    <a href={`mailto:${posting.contactEmail}`}>
                      {posting.contactEmail}
                    </a>
                  </>
                )}
              </p>
            </Section>
          )}
        </div>

        <div className="stack">
          <Section title="Stellenanzeige">
            {posting.jobDescription ? (
              <p className="prewrap">{posting.jobDescription}</p>
            ) : (
              <Empty>Kein Anzeigentext gespeichert.</Empty>
            )}
          </Section>
        </div>
      </div>

      <button className="danger delete-button" onClick={() => void remove()}>
        Stellenangebot löschen
      </button>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
