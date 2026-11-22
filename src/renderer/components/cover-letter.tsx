import { useNavigate } from 'react-router';

import { hasContent, SECTION_KEYS } from '@/domain/cover-letter';

import { useData } from '../app-context';
import { formatDateTime, Section } from '../ui';

/**
 * Block „Anschreiben“ auf den Detailseiten von Stellenangebot und Bewerbung: Einstieg in den
 * Assistenten bzw. Stand des Anschreibens zu genau dieser Anzeige.
 */
export function CoverLetterSection({
  target,
  path,
}: {
  target: { postingId?: string; applicationId?: string };
  /** Seite des Assistenten, z. B. /stellen/<id>/anschreiben */
  path: string;
}) {
  const navigate = useNavigate();
  const state = useData(
    (r) => r.coverLetters.find(target),
    [target.postingId, target.applicationId],
  );
  if (state.data === undefined && state.status === 'loading') return null;
  const letter = state.data;
  const started = letter && hasContent(letter);
  const intro = letter?.sections.find(
    (s) => s.key === SECTION_KEYS[0] && s.text,
  )?.text;

  return (
    <Section
      title="Anschreiben"
      action={
        <button type="button" onClick={() => navigate(path)}>
          {started ? 'Öffnen' : 'Anschreiben erstellen'}
        </button>
      }
    >
      {started ? (
        <div className="letter-summary">
          <strong>{letter.subject || 'Ohne Betreff'}</strong>
          {intro && <p className="letter-summary__intro">{intro}</p>}
          <span className="muted small">
            Zuletzt geändert {formatDateTime(letter.updatedAt)}
          </span>
        </div>
      ) : (
        <p className="muted">
          Ein Anschreiben genau für diese Anzeige: Der Assistent fragt
          Ansprache, Ton und Stärken ab und schlägt Abschnitt für Abschnitt vor
          – du kannst alles ändern.
        </p>
      )}
    </Section>
  );
}
