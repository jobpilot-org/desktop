import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { Profile } from '@/domain/profile';
import {
  applyRewrite,
  canReview,
  currentRewriteText,
  REVIEW_AREA_LABELS,
  REVIEW_PRIORITY_LABELS,
  rewriteTargetLabel,
  scoreLabel,
  type ProfileReview,
  type ReviewSuggestion,
} from '@/domain/profile-review';

import { ProfileReviewError, reviewProfile } from '@/data/profile-review';

import { useApp, useData } from '../app-context';
import { Empty, LoadError, Section, useAction } from '../ui';
import { useProfile } from './profile';

const CONSENT_TEXT =
  'Für den Check wird dein Profil – ohne Name, Anschrift, Telefon, E-Mail und Geburtsdaten – an den jobpilot-Server gesendet und von dort mit deinem eigenen KI-Key an den KI-Anbieter (Anthropic) weitergeleitet. Gespeichert wird nichts; Vorschläge übernimmst du einzeln.';

type Step =
  | { kind: 'start'; error?: string }
  | { kind: 'running' }
  | { kind: 'result'; review: ProfileReview };

/** Profil von der KI auf grobe inhaltliche Fehler prüfen: Punktzahl, Stärken, Korrekturen zum Übernehmen */
export function ProfileReviewPage() {
  const { state, profile } = useProfile();
  if (state.status === 'error' && !profile) {
    return (
      <div className="page">
        <LoadError error={state.error} />
      </div>
    );
  }
  if (!profile) return null;
  return <ProfileReviewContent profile={profile} />;
}

function ProfileReviewContent({ profile }: { profile: Profile }) {
  const { supabase, repos } = useApp();
  const navigate = useNavigate();
  const keyState = useData((r) => r.aiKey.status());
  const [step, setStep] = useState<Step>({ kind: 'start' });

  const missingKey = keyState.data?.configured === false;
  const reviewable = canReview(profile);

  async function start() {
    if ((await repos.settings.get('ai.consent')) !== 'yes') {
      if (!confirm(`${CONSENT_TEXT}\n\nEinverstanden?`)) return;
      await repos.settings.set('ai.consent', 'yes');
    }
    setStep({ kind: 'running' });
    try {
      const review = await reviewProfile(supabase, profile);
      setStep({ kind: 'result', review });
    } catch (error) {
      setStep({
        kind: 'start',
        error:
          error instanceof ProfileReviewError
            ? error.message
            : 'Der Check ist fehlgeschlagen. Bitte noch einmal versuchen.',
      });
    }
  }

  return (
    <div className="page">
      <p className="jp-eyebrow">Profil</p>
      <h1>KI-Check</h1>

      {step.kind === 'start' && (
        <>
          <p className="muted">
            Die KI prüft deinen Lebenslauf auf grobe inhaltliche Fehler –
            Widersprüche, unplausible Zeiträume, Lücken, fehlende Angaben,
            Doppelungen und Tippfehler. Wo sie eine fertige Korrektur
            vorschlägt, übernimmst du sie mit einem Klick.
          </p>
          {missingKey && (
            <p className="error-box">
              Für den Check brauchst du einen eigenen KI-Key.{' '}
              <Link to="/einstellungen">In den Einstellungen hinterlegen</Link>
            </p>
          )}
          {!reviewable && (
            <p className="error-box">
              Dein Profil ist noch fast leer. Lege zuerst Stationen oder ein
              Kurzprofil an – oder{' '}
              <Link to="/profil/import">importiere deinen Lebenslauf</Link>.
            </p>
          )}
          {step.error && <p className="error-box">{step.error}</p>}
          <div className="wizard-buttons">
            <button type="button" onClick={() => navigate('/profil')}>
              Abbrechen
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="primary"
              disabled={missingKey || !reviewable}
              onClick={() => void start()}
            >
              Profil prüfen
            </button>
          </div>
          <p className="muted small section">{CONSENT_TEXT}</p>
        </>
      )}

      {step.kind === 'running' && (
        <div className="dropzone section" role="status">
          <strong>Dein Profil wird geprüft …</strong>
          <span className="muted">Das dauert meist bis zu einer Minute.</span>
        </div>
      )}

      {step.kind === 'result' && (
        <ReviewResult
          profile={profile}
          review={step.review}
          onRestart={() => setStep({ kind: 'start' })}
        />
      )}
    </div>
  );
}

function ReviewResult({
  profile,
  review,
  onRestart,
}: {
  profile: Profile;
  review: ProfileReview;
  onRestart: () => void;
}) {
  const navigate = useNavigate();
  return (
    <>
      <div className="card review-score">
        <div className="review-score-value">
          <strong>{review.score}</strong>
          <span className="muted">von 100</span>
        </div>
        <div>
          <p className="review-score-label">{scoreLabel(review.score)}</p>
          <p className="prewrap">{review.verdict}</p>
        </div>
      </div>

      <Section title="Stärken">
        {review.strengths.length ? (
          <ul className="review-strengths">
            {review.strengths.map((strength, i) => (
              <li key={i}>{strength}</li>
            ))}
          </ul>
        ) : (
          <Empty>Keine Stärken genannt.</Empty>
        )}
      </Section>

      <Section title="Gefundene Fehler">
        {review.suggestions.length ? (
          <ul className="rows">
            {review.suggestions.map((suggestion, i) => (
              <li key={i} className="row review-suggestion">
                <SuggestionItem profile={profile} suggestion={suggestion} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Keine groben Fehler gefunden.</Empty>
        )}
      </Section>

      <div className="wizard-buttons">
        <button type="button" onClick={onRestart}>
          Erneut prüfen
        </button>
        <span className="spacer" />
        <button
          type="button"
          className="primary"
          onClick={() => navigate('/profil')}
        >
          Zum Profil
        </button>
      </div>
    </>
  );
}

function SuggestionItem({
  profile,
  suggestion,
}: {
  profile: Profile;
  suggestion: ReviewSuggestion;
}) {
  const { repos } = useApp();
  const run = useAction();
  const [saving, setSaving] = useState(false);
  const { rewrite } = suggestion;

  const current = rewrite && currentRewriteText(profile, rewrite);
  // Übernommen, sobald das Profil den vorgeschlagenen Text enthält
  const applied = !!rewrite && (current ?? '').trim() === rewrite.text.trim();

  async function accept() {
    if (!rewrite) return;
    const change = applyRewrite(profile, rewrite);
    if (!change) return;
    setSaving(true);
    await run(() => {
      switch (change.kind) {
        case 'personal':
          return repos.profile.savePersonal(change.personal);
        case 'entry':
          return repos.profile.saveEntry(
            change.entry.kind,
            change.input,
            change.entry.id,
          );
        case 'skill':
          return repos.profile.saveSkill(change.input, change.skill.id);
      }
    }, 'Vorschlag übernommen');
    setSaving(false);
  }

  return (
    <div className="review-suggestion-body">
      <p className="review-meta">
        <span className="review-priority" data-priority={suggestion.priority}>
          {REVIEW_PRIORITY_LABELS[suggestion.priority]}
        </span>
        <span className="muted small">
          {REVIEW_AREA_LABELS[suggestion.area]}
        </span>
      </p>
      <strong>{suggestion.title}</strong>
      {suggestion.detail && <p className="prewrap">{suggestion.detail}</p>}
      {rewrite && (
        <div className="review-rewrite">
          <p className="muted small">{rewriteTargetLabel(profile, rewrite)}</p>
          {current && !applied && (
            <div className="review-compare">
              <span className="muted small">Bisher</span>
              <p className="prewrap muted">{current}</p>
            </div>
          )}
          <div className="review-compare">
            <span className="muted small">Vorschlag</span>
            <p className="prewrap">{rewrite.text}</p>
          </div>
          <div>
            {applied ? (
              <span className="review-applied">✓ Übernommen</span>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={saving}
                onClick={() => void accept()}
              >
                Übernehmen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
