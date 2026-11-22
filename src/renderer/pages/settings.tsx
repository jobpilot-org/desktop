import { useEffect, useState } from 'react';

import { FOLLOW_UP_OPTIONS, type ReminderSettings } from '@/domain/reminders';

import { errorMessage, useApp, useData } from '../app-context';
import { AiKeySettings } from '../components/ai-key-settings';
import {
  notificationsEnabled,
  setNotificationsEnabled,
} from '../notifications';
import {
  loadTheme,
  setTheme,
  THEME_LABELS,
  THEMES,
  type Theme,
} from '../theme';
import {
  Field,
  LoadError,
  Section,
  useAction,
  useToast,
  useConfirm,
} from '../ui';

const FIT_CONSENT =
  'Für die Passung werden dein Profil – ohne Name, Anschrift, Telefon, E-Mail und Geburtsdaten – und der Anzeigentext an den jobpilot-Server gesendet und von dort mit deinem eigenen KI-Key an den KI-Anbieter (Anthropic) weitergeleitet.';

export function SettingsPage() {
  const confirm = useConfirm();
  const { repos, supabase, session } = useApp();
  const run = useAction();
  const toast = useToast();
  const state = useData((r) => r.reminders.settings());
  const fitAuto = useData((r) => r.settings.get('ai.fit.auto'));

  async function toggleFitAuto(enabled: boolean) {
    if (enabled && (await repos.settings.get('ai.consent')) !== 'yes') {
      if (
        !(await confirm({
          title: 'KI nutzen?',
          message: FIT_CONSENT,
          confirmLabel: 'Einverstanden',
        }))
      )
        return;
      await run(() => repos.settings.set('ai.consent', 'yes'));
    }
    await run(
      () => repos.settings.set('ai.fit.auto', enabled ? 'yes' : 'no'),
      enabled
        ? 'Neue Stellenangebote werden automatisch bewertet'
        : 'Passung nur noch auf Knopfdruck',
    );
  }
  const [theme, setThemeState] = useState<Theme>();
  useEffect(() => {
    void loadTheme().then(setThemeState);
  }, []);

  async function changeTheme(next: Theme) {
    setThemeState(next);
    await setTheme(next);
  }

  const [notify, setNotify] = useState(
    () => notificationsEnabled() && Notification.permission === 'granted',
  );

  const save = (next: ReminderSettings) =>
    run(() => repos.reminders.saveSettings(next), 'Einstellungen gespeichert');

  async function toggleNotifications(enabled: boolean) {
    if (enabled && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          text: 'Benachrichtigungen sind in den Systemeinstellungen blockiert.',
        });
        return;
      }
    }
    setNotificationsEnabled(enabled);
    setNotify(enabled);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error)
      toast({ text: `Abmelden fehlgeschlagen: ${errorMessage(error)}` });
  }

  return (
    <div className="page">
      <p className="jp-eyebrow">App</p>
      <h1>Einstellungen</h1>

      <Section title="Erinnerungen">
        {state.status === 'error' && !state.data && (
          <LoadError error={state.error} />
        )}
        {state.data && (
          <div className="form-grid">
            <Field label="Nachhaken nach">
              <select
                value={state.data.followUpDays}
                onChange={(e) =>
                  save({ ...state.data!, followUpDays: Number(e.target.value) })
                }
              >
                {FOLLOW_UP_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days === 0 ? 'Aus' : `${days} Tagen ohne Neuigkeit`}
                  </option>
                ))}
              </select>
            </Field>
            <label className="checkbox wide">
              <input
                type="checkbox"
                checked={state.data.appointments}
                onChange={(e) =>
                  save({ ...state.data!, appointments: e.target.checked })
                }
              />
              Vor Terminen erinnern (am Vorabend und eine Stunde vorher)
            </label>
            <label className="checkbox wide">
              <input
                type="checkbox"
                checked={state.data.thankYou}
                onChange={(e) =>
                  save({ ...state.data!, thankYou: e.target.checked })
                }
              />
              Nach Terminen an ein Dankeschön erinnern
            </label>
            <p className="muted wide">
              Diese Einstellungen gelten für dein Konto und damit für alle
              jobpilot-Apps.
            </p>
          </div>
        )}
      </Section>

      <Section title="Darstellung">
        <div
          className="segmented theme-choice"
          role="group"
          aria-label="Hell oder dunkel"
        >
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => void changeTheme(option)}
            >
              {THEME_LABELS[option]}
            </button>
          ))}
        </div>
        <p className="muted">
          „System“ folgt der Einstellung deines Rechners. Gilt nur für diesen
          Rechner.
        </p>
      </Section>

      <Section title="Desktop-Benachrichtigungen">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => void toggleNotifications(e.target.checked)}
          />
          Fällige Erinnerungen als Systembenachrichtigung anzeigen
        </label>
        <p className="muted">
          Gilt nur für diesen Rechner und nur, solange jobpilot geöffnet ist.
        </p>
      </Section>

      <Section title="KI">
        <AiKeySettings />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={fitAuto.data === 'yes'}
            disabled={fitAuto.status === 'loading'}
            onChange={(e) => void toggleFitAuto(e.target.checked)}
          />
          Neue Stellenangebote automatisch auf Passung bewerten
        </label>
        <p className="muted">
          Aus: Bewertung nur auf Knopfdruck im Stellenangebot. Jede Bewertung
          läuft über deinen eigenen KI-Key und kostet etwas Guthaben; ändert
          sich dein Profil, wird nur auf Knopfdruck neu bewertet. Gilt für dein
          Konto.
        </p>
      </Section>

      <Section title="Konto">
        <p>
          Angemeldet als <strong>{session?.user.email}</strong>
        </p>
        <button onClick={signOut}>Abmelden</button>
      </Section>

      <Section title="Über jobpilot">
        <p className="muted">Version {__APP_VERSION__}</p>
      </Section>
    </div>
  );
}
