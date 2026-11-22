import { useState, type FormEvent } from 'react';

import { aiKeyInputError } from '@/data/ai-key';

import { useApp, useData } from '../app-context';
import {
  Field,
  formatDateTime,
  LoadError,
  PasswordInput,
  useAction,
  useConfirm,
} from '../ui';

/** Eigener KI-Key wie in der mobile-app (api-key-settings.tsx); gilt für alle Apps des Kontos */
export function AiKeySettings() {
  const confirm = useConfirm();
  const { repos } = useApp();
  const run = useAction();
  const state = useData(async (r) => ({
    key: await r.aiKey.status(),
    consent: (await r.settings.get('ai.consent')) === 'yes',
  }));
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();

  async function save(event: FormEvent) {
    event.preventDefault();
    const inputError = aiKeyInputError(draft);
    setError(inputError ?? undefined);
    if (inputError) return;
    // Der Key wird nicht behalten: Ein gespeicherter Key lässt sich nie wieder anzeigen
    if (await run(() => repos.aiKey.save(draft), 'API-Key gespeichert')) {
      setDraft('');
    }
  }

  async function remove() {
    if (
      !(await confirm({
        title: 'API-Key löschen?',
        message:
          'KI-Funktionen gehen erst wieder, wenn du einen neuen hinterlegst.',
        confirmLabel: 'Löschen',
        danger: true,
      }))
    ) {
      return;
    }
    await run(() => repos.aiKey.remove(), 'API-Key gelöscht');
  }

  if (state.status === 'error' && !state.data) {
    return <LoadError error={state.error} />;
  }
  const status = state.data?.key;

  return (
    <form className="form-grid" onSubmit={save} noValidate>
      <p className="muted wide">
        {!status
          ? 'Status wird geladen …'
          : status.configured && status.updatedAt
            ? `Eigener Key hinterlegt · zuletzt geändert am ${formatDateTime(status.updatedAt)}`
            : 'Noch kein eigener Key hinterlegt. Ohne Key geht der Lebenslauf-Import nicht.'}
      </p>
      <Field label="KI-API-Key (Anthropic)" error={error} wide>
        <PasswordInput
          autoComplete="off"
          placeholder={
            status?.configured ? 'Neuen Key einfügen' : 'Key einfügen'
          }
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(undefined);
          }}
        />
      </Field>
      <div className="dialog-buttons">
        {status?.configured && (
          <button
            type="button"
            className="danger"
            onClick={() => void remove()}
          >
            Key löschen
          </button>
        )}
        <span className="spacer" />
        <button type="submit" className="primary" disabled={!draft.trim()}>
          {status?.configured ? 'Key ersetzen' : 'Key speichern'}
        </button>
      </div>
      <p className="muted small wide">
        Wird verschlüsselt im Supabase Vault gespeichert und nur auf dem Server
        entschlüsselt. Gilt für alle jobpilot-Apps deines Kontos.
      </p>
      {state.data?.consent && (
        <p className="muted small wide">
          Du hast der Übermittlung an den KI-Anbieter zugestimmt.{' '}
          <button
            type="button"
            className="link"
            onClick={() =>
              void run(
                () => repos.settings.set('ai.consent', 'no'),
                'Zustimmung zurückgenommen',
              )
            }
          >
            Zurücknehmen
          </button>
        </p>
      )}
    </form>
  );
}
