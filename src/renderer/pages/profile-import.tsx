import { useRef, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { reassignDocuments } from '@/domain/documents';
import {
  allEntries,
  summarizeProfileInput,
  type ProfileInput,
} from '@/domain/profile';

import { CvImportError, importCv } from '@/data/cv-import';

import { useApp, useData } from '../app-context';
import {
  EntriesSection,
  LanguagesSection,
  LinksSection,
  PersonalSection,
  SkillsSection,
  SummarySection,
} from '../components/profile-sections';
import { useAction, useConfirm } from '../ui';
import { useProfile } from './profile';

const CONSENT_TEXT =
  'Für den Import wird dein Lebenslauf (PDF) an den jobpilot-Server gesendet und von dort mit deinem eigenen KI-Key zur Verarbeitung an den KI-Anbieter (Anthropic) weitergeleitet. Gespeichert wird nur das Ergebnis, und erst, nachdem du es geprüft hast.';

type Step =
  | { kind: 'choose'; error?: string }
  | { kind: 'reading'; fileName: string }
  | { kind: 'preview'; fileName: string; draft: ProfileInput };

/** Lebenslauf als PDF wählen → KI liest ihn aus → Vorschau → übernehmen */
export function ProfileImportPage() {
  const confirm = useConfirm();
  const { supabase, repos } = useApp();
  const navigate = useNavigate();
  const run = useAction();
  const { profile } = useProfile();
  const keyState = useData((r) => r.aiKey.status());
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const missingKey = keyState.data?.configured === false;
  const hasProfile =
    !!profile &&
    (allEntries(profile).length > 0 ||
      profile.skills.length > 0 ||
      !!profile.summary);

  async function read(file: File) {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setStep({ kind: 'choose', error: 'Bitte eine PDF-Datei wählen.' });
      return;
    }
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
    setStep({ kind: 'reading', fileName: file.name });
    try {
      const draft = await importCv(supabase, await file.arrayBuffer());
      setStep({ kind: 'preview', fileName: file.name, draft });
    } catch (error) {
      setStep({
        kind: 'choose',
        error:
          error instanceof CvImportError
            ? error.message
            : 'Der Import ist fehlgeschlagen. Bitte noch einmal versuchen.',
      });
    }
  }

  async function accept(draft: ProfileInput) {
    // Fehlt der Name im PDF, bleibt der bisherige (bzw. der aus der Registrierung)
    const input = {
      ...draft,
      firstName: draft.firstName || profile?.firstName || '',
      lastName: draft.lastName || profile?.lastName || '',
    };
    const saved = await run(async () => {
      // Die Stationen bekommen neue ids; Dokumente danach wieder passend zuordnen
      const documents = await repos.documents.list();
      const oldEntries = profile ? allEntries(profile) : [];
      await repos.profile.replace(input);
      const fresh = await repos.profile.get();
      const moves = reassignDocuments(
        documents,
        oldEntries,
        fresh ? allEntries(fresh) : [],
      );
      for (const move of moves) {
        const document = documents.find((d) => d.id === move.id)!;
        await repos.documents.update(document.id, {
          kind: document.kind,
          title: document.title,
          profileEntryId: move.profileEntryId,
        });
      }
    }, 'Profil übernommen');
    if (saved) navigate('/profil');
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void read(file);
  }

  return (
    <div className="page">
      <p className="jp-eyebrow">Profil</p>
      <h1>Lebenslauf importieren</h1>

      {step.kind === 'choose' && (
        <>
          <p className="muted">
            Wähle deinen Lebenslauf als PDF. Die KI liest daraus Kopfdaten,
            Stationen, Kenntnisse und Sprachen; du prüfst das Ergebnis, bevor es
            gespeichert wird.
          </p>
          {missingKey && (
            <p className="error-box">
              Für den Import brauchst du einen eigenen KI-Key.{' '}
              <Link to="/einstellungen">In den Einstellungen hinterlegen</Link>
            </p>
          )}
          {step.error && <p className="error-box">{step.error}</p>}
          <div
            className={`dropzone section${over ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={drop}
          >
            <strong>PDF hierher ziehen</strong>
            <span className="muted">oder</span>
            <button
              type="button"
              className="primary"
              disabled={missingKey}
              onClick={() => fileInput.current?.click()}
            >
              Datei auswählen
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void read(file);
              }}
            />
          </div>
          <p className="muted small section">{CONSENT_TEXT}</p>
          <div className="wizard-buttons">
            <button type="button" onClick={() => navigate('/profil')}>
              Abbrechen
            </button>
          </div>
        </>
      )}

      {step.kind === 'reading' && (
        <div className="dropzone section" role="status">
          <strong>{step.fileName} wird gelesen …</strong>
          <span className="muted">Das dauert meist bis zu einer Minute.</span>
        </div>
      )}

      {step.kind === 'preview' && (
        <>
          <p className="muted">
            Aus <strong>{step.fileName}</strong> gelesen:{' '}
            {summarizeProfileInput(step.draft)}. Bitte prüfen – einzelne
            Einträge kannst du nach dem Übernehmen auf der Profilseite
            korrigieren.
          </p>
          {hasProfile && (
            <p className="error-box">
              Übernehmen ersetzt dein bisheriges Profil vollständig. Dokumente
              bleiben erhalten und werden, wo möglich, wieder der passenden
              Station zugeordnet.
            </p>
          )}
          <PersonalSection personal={step.draft} />
          <SummarySection summary={step.draft.summary} />
          <EntriesSection kind="experience" entries={step.draft.experience} />
          <EntriesSection kind="education" entries={step.draft.education} />
          {step.draft.volunteering.length > 0 && (
            <EntriesSection
              kind="volunteer"
              entries={step.draft.volunteering}
            />
          )}
          {step.draft.links && step.draft.links.length > 0 && (
            <LinksSection links={step.draft.links} />
          )}
          <SkillsSection skills={step.draft.skills} />
          <LanguagesSection languages={step.draft.languages} />
          <div className="wizard-buttons">
            <button type="button" onClick={() => setStep({ kind: 'choose' })}>
              Andere Datei
            </button>
            <span className="spacer" />
            <button type="button" onClick={() => navigate('/profil')}>
              Verwerfen
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void accept(step.draft)}
            >
              Übernehmen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
