import { useNavigate } from 'react-router';

import { useApp } from '../app-context';
import { useAction } from '../ui';
import { useProfileSeed } from './profile';

const CHOICES = [
  {
    to: '/profil/assistent',
    title: 'Mit dem Assistenten',
    text: 'Schritt für Schritt: persönliche Daten, Kurzprofil, Stationen, Kenntnisse.',
  },
  {
    to: '/profil/import',
    title: 'Lebenslauf importieren (PDF)',
    text: 'Die KI liest deinen Lebenslauf aus, du prüfst das Ergebnis. Braucht einen eigenen KI-Key.',
  },
  {
    to: '/profil',
    title: 'Selbst auf der Profilseite pflegen',
    text: 'Alle Abschnitte auf einer Seite, Einträge einzeln anlegen.',
  },
] as const;

/** Erscheint nach dem ersten Login, bis der Nutzer einen Weg gewählt hat (profiles.onboarded_at) */
export function WelcomePage() {
  const { repos } = useApp();
  const navigate = useNavigate();
  const run = useAction();
  const seed = useProfileSeed();

  async function choose(to: string) {
    if (await run(() => repos.profile.markOnboarded(seed))) navigate(to);
  }

  return (
    <div className="page">
      <p className="jp-eyebrow">
        Willkommen{seed.firstName && `, ${seed.firstName}`}
      </p>
      <h1>Lege dein Profil an</h1>
      <p className="muted">
        Dein Profil ist dein Lebenslauf in jobpilot. Wie möchtest du anfangen?
        Du kannst später jederzeit auf der Profilseite weitermachen.
      </p>
      <div className="choice-list">
        {CHOICES.map((choice) => (
          <button
            key={choice.to}
            type="button"
            className="choice"
            onClick={() => void choose(choice.to)}
          >
            <strong>{choice.title}</strong>
            <span className="muted">{choice.text}</span>
          </button>
        ))}
      </div>
      <div className="wizard-buttons">
        <button type="button" className="link" onClick={() => void choose('/')}>
          Später
        </button>
      </div>
    </div>
  );
}
