import { useState } from 'react';

import { FOLLOW_UP_OPTIONS, type ReminderSettings } from '@/domain/reminders';

import { errorMessage, useApp, useData } from '../app-context';
import {
  notificationsEnabled,
  setNotificationsEnabled,
} from '../notifications';
import { Field, LoadError, Section, useAction, useToast } from '../ui';

export function SettingsPage() {
  const { repos, supabase, session } = useApp();
  const run = useAction();
  const toast = useToast();
  const state = useData((r) => r.reminders.settings());
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
              JobPilot-Apps.
            </p>
          </div>
        )}
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
          Gilt nur für diesen Rechner und nur, solange JobPilot geöffnet ist.
        </p>
      </Section>

      <Section title="Konto">
        <p>
          Angemeldet als <strong>{session?.user.email}</strong>
        </p>
        <button onClick={signOut}>Abmelden</button>
      </Section>
    </div>
  );
}
