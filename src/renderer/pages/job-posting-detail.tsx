import { Fragment } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  formatSalary,
  STATUS_LABELS,
  WORK_MODE_LABELS,
} from '@/domain/application';
import {
  companySearchUrl,
  POSTING_STATE_LABELS,
  postingState,
  SOURCE_KIND_LABELS,
  sourceDifferences,
} from '@/domain/job-postings';

import { useApp, useData } from '../app-context';
import { CoverLetterSection } from '../components/cover-letter';
import { FitRing, FitSection } from '../components/job-fit';
import { useDeletePosting } from '../delete-actions';
import { useProfile } from './profile';
import {
  Empty,
  formatDate,
  LoadError,
  Section,
  useAction,
  useConfirm,
} from '../ui';

/** Ein Stellenangebot: Eckdaten, Anzeige, Ansprechpartner – und daraus eine Bewerbung machen */
export function JobPostingDetailPage() {
  const confirm = useConfirm();
  const { id = '' } = useParams();
  const { repos } = useApp();
  const navigate = useNavigate();
  const run = useAction();
  const deletePosting = useDeletePosting();
  const { profile } = useProfile();

  const state = useData(
    async (r) => {
      const [posting, sources] = await Promise.all([
        r.jobPostings.get(id),
        r.jobPostings.sources(id),
      ]);
      const application = posting?.applicationId
        ? await r.applications.get(posting.applicationId)
        : undefined;
      return { posting, application, sources };
    },
    [id],
  );

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const { posting, application, sources } = state.data;
  const differences = sourceDifferences(sources);
  const hasCompanySource = sources.some((s) => s.kind === 'company');
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
        <div className="detail-side">
          <FitRing posting={posting} profile={profile} size="large" />
          <span className="posting-state" data-state={current}>
            {POSTING_STATE_LABELS[current]}
          </span>
        </div>
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
          {!hasCompanySource && (
            <button
              type="button"
              title="Sucht die Anzeige auf der Firmenseite – dort mit der Extension speichern, dann wird sie als Quelle ergänzt"
              onClick={() => window.open(companySearchUrl(posting), '_blank')}
            >
              Auf Firmenseite suchen ↗
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

      <CoverLetterSection
        target={{ postingId: posting.id, applicationId: posting.applicationId }}
        path={`/stellen/${posting.id}/anschreiben`}
      />

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

          <Section title="Bewerbung & Ansprechpartner">
            {posting.contactName ||
            posting.contactEmail ||
            posting.applyEmail ||
            posting.applyUrl ? (
              <dl className="facts">
                {posting.contactName && (
                  <>
                    <dt>Ansprechperson</dt>
                    <dd>{posting.contactName}</dd>
                  </>
                )}
                {posting.contactEmail && (
                  <>
                    <dt>E-Mail</dt>
                    <dd>
                      <a href={`mailto:${posting.contactEmail}`}>
                        {posting.contactEmail}
                      </a>
                    </dd>
                  </>
                )}
                {posting.applyEmail &&
                  posting.applyEmail !== posting.contactEmail && (
                    <>
                      <dt>Bewerbung an</dt>
                      <dd>
                        <a href={`mailto:${posting.applyEmail}`}>
                          {posting.applyEmail}
                        </a>
                      </dd>
                    </>
                  )}
                {posting.applyUrl && (
                  <>
                    <dt>Bewerbungsseite</dt>
                    <dd>
                      <a
                        href={posting.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {hostOf(posting.applyUrl)} ↗
                      </a>
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <Empty>
                Kein Ansprechpartner und kein Bewerbungsweg bekannt – oft stehen
                sie auf der Firmenseite.
              </Empty>
            )}
          </Section>

          <Section title="Quellen">
            {differences.length > 0 && (
              <div className="source-differences">
                <span className="jp-eyebrow">Abweichungen</span>
                {differences.map((difference) => (
                  <p key={difference.field}>
                    <strong>{difference.field}:</strong>{' '}
                    {difference.values
                      .map((v) => `${v.value} (${v.source})`)
                      .join(' · ')}
                  </p>
                ))}
                <p className="muted small">
                  Angezeigt werden die Angaben der Firmenseite, sonst der
                  neuesten Quelle.
                </p>
              </div>
            )}
            {sources.length ? (
              <ul className="rows">
                {sources.map((source) => (
                  <li key={source.id} className="row">
                    <div className="row-main">
                      <span>
                        <span className="source-kind" data-kind={source.kind}>
                          {SOURCE_KIND_LABELS[source.kind]}
                        </span>{' '}
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.source ?? hostOf(source.url)}
                          </a>
                        ) : (
                          source.source
                        )}
                      </span>
                      <span className="muted small">
                        {[
                          source.role,
                          `gespeichert am ${formatDate(source.capturedAt.slice(0, 10))}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {sources.length > 1 && (
                      <button
                        type="button"
                        className="link"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: 'Diese Quelle entfernen?',
                              confirmLabel: 'Entfernen',
                              danger: true,
                            })
                          )
                            await run(
                              () => repos.jobPostings.removeSource(source.id),
                              'Quelle entfernt',
                            );
                        }}
                      >
                        Entfernen
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Keine Quellen gespeichert.</Empty>
            )}
            {!hasCompanySource && (
              <p className="muted small">
                Tipp: Findest du die Anzeige auf der Firmenseite, speichere sie
                dort mit der Extension – sie wird als Quelle ergänzt.
              </p>
            )}
          </Section>
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
