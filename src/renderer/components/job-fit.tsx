import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';

import {
  CHANCE_LABELS,
  FIT_LEVEL_LABELS,
  fitBlocker,
  fitStatus,
} from '@/domain/job-fit';
import type { JobPosting } from '@/domain/job-postings';
import type { Profile } from '@/domain/profile';

import { JobFitError } from '@/data/job-fit';

import { useApp, useData } from '../app-context';
import { useRunFit, useRunningFits } from '../fit-runner';
import { formatDateTime, Section, useConfirm } from '../ui';

const CONSENT_TEXT =
  'Für die Passung werden dein Profil – ohne Name, Anschrift, Telefon, E-Mail und Geburtsdaten – und der Anzeigentext an den jobpilot-Server gesendet und von dort mit deinem eigenen KI-Key an den KI-Anbieter (Anthropic) weitergeleitet.';

/**
 * Score als Ring (Liste und Übersicht klein, Kopf der Detailseite groß): Der Ring füllt sich mit
 * dem Score, die Farbe folgt der Einstufung. Ohne Bewertung ein gestrichelter Platzhalter, damit
 * die Zeilen bündig bleiben; veraltet = blass mit Hinweis.
 */
export function FitRing({
  posting,
  profile,
  size = 'small',
}: {
  posting: JobPosting;
  profile?: Profile;
  size?: 'small' | 'large';
}) {
  const running = useRunningFits().has(posting.id);
  const fit = posting.fit;
  if (running || !fit) {
    return (
      <span
        className="fit-ring"
        data-size={size}
        data-level={running ? 'running' : 'none'}
        title={
          running ? 'Passung wird bewertet …' : 'Passung noch nicht bewertet'
        }
      >
        <span className="fit-ring__value">{running ? '…' : '–'}</span>
        {size === 'large' && <span className="fit-ring__label">Passung</span>}
      </span>
    );
  }
  const outdated = fitStatus(posting, profile) === 'outdated';
  return (
    <span
      className="fit-ring"
      data-size={size}
      data-level={fit.level}
      data-outdated={outdated || undefined}
      style={{ '--fit': fit.score } as CSSProperties}
      role="img"
      aria-label={`Passung ${fit.score} von 100`}
      title={`Passung ${fit.score} von 100 – ${FIT_LEVEL_LABELS[fit.level]}${
        outdated ? ' (veraltet: Profil oder Anzeige geändert)' : ''
      }`}
    >
      <span className="fit-ring__value">{fit.score}</span>
      {size === 'large' && <span className="fit-ring__label">Passung</span>}
    </span>
  );
}

/** Block „Passung“ auf der Detailseite: Score, Einschätzung, Pros/Contras, Prognose, Betonen */
export function FitSection({
  posting,
  profile,
}: {
  posting: JobPosting;
  profile?: Profile;
}) {
  const confirm = useConfirm();
  const { repos } = useApp();
  const runFit = useRunFit();
  const running = useRunningFits().has(posting.id);
  const keyState = useData((r) => r.aiKey.status());
  const [error, setError] = useState<string>();

  const status = fitStatus(posting, profile);
  const blocker = fitBlocker(profile, posting);
  const missingKey = keyState.data?.configured === false;
  const fit = posting.fit;

  async function evaluate() {
    if (!profile) return;
    setError(undefined);
    if ((await repos.settings.get('ai.consent')) !== 'yes') {
      if (
        !(await confirm({
          title: 'KI nutzen?',
          message: CONSENT_TEXT,
          confirmLabel: 'Einverstanden',
        }))
      )
        return;
      await repos.settings.set('ai.consent', 'yes');
    }
    try {
      await runFit(posting, profile);
    } catch (e) {
      setError(
        e instanceof JobFitError
          ? e.message
          : 'Die Bewertung ist fehlgeschlagen. Bitte noch einmal versuchen.',
      );
    }
  }

  const button = (
    <button
      type="button"
      className={fit ? undefined : 'primary'}
      disabled={running || !!blocker || missingKey}
      onClick={() => void evaluate()}
    >
      {running ? 'Wird bewertet …' : fit ? 'Neu bewerten' : 'Passung bewerten'}
    </button>
  );

  return (
    <Section title="Passung">
      {fit ? (
        <div className="fit">
          <div className="fit-head">
            <p className="fit-level" data-level={fit.level}>
              {FIT_LEVEL_LABELS[fit.level]} · {fit.score} von 100
            </p>
            {fit.summary && <p>{fit.summary}</p>}
          </div>

          {status === 'outdated' && (
            <p className="muted small">
              Veraltet: Dein Profil oder die Anzeige hat sich seit der Bewertung
              geändert.
            </p>
          )}

          <div className="fit-columns">
            <div>
              <h3>Spricht dafür</h3>
              {fit.pros.length ? (
                <ul className="fit-list" data-kind="pro">
                  {fit.pros.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">–</p>
              )}
            </div>
            <div>
              <h3>Spricht dagegen</h3>
              {fit.cons.length ? (
                <ul className="fit-list" data-kind="con">
                  {fit.cons.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">–</p>
              )}
            </div>
          </div>

          <div className="fit-prognosis" data-level={fit.prognosis.chance}>
            <span className="jp-eyebrow">
              Prognose · {CHANCE_LABELS[fit.prognosis.chance]}
            </span>
            {fit.prognosis.text && <p>{fit.prognosis.text}</p>}
            <p className="muted small">
              Schätzung der KI aus Profil und Anzeige – ohne Wissen über andere
              Bewerbungen.
            </p>
          </div>

          {fit.emphasize.length > 0 && (
            <div>
              <h3>Das solltest du betonen</h3>
              <ul className="fit-list">
                {fit.emphasize.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="fit-footer">
            <span className="muted small">
              {posting.fitAt && `Bewertet am ${formatDateTime(posting.fitAt)}`}
            </span>
            {button}
          </div>
        </div>
      ) : (
        <div className="fit">
          <p className="muted">
            Die KI vergleicht dein Profil mit dieser Anzeige: Score, was dafür
            und dagegen spricht, und eine Prognose deiner Aussichten.
          </p>
          <div className="fit-footer">
            <span />
            {button}
          </div>
        </div>
      )}

      {blocker && <p className="muted small">{blocker}</p>}
      {missingKey && (
        <p className="error-box">
          Für die Passung brauchst du einen eigenen KI-Key.{' '}
          <Link to="/einstellungen">In den Einstellungen hinterlegen</Link>
        </p>
      )}
      {error && <p className="error-box">{error}</p>}
    </Section>
  );
}
