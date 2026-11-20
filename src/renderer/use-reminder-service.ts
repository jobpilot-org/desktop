import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useApp } from './app-context';
import { desktop } from './desktop';
import {
  loadShown,
  notificationsEnabled,
  pruneShown,
  remindersToNotify,
  saveShown,
} from './notifications';

const MINUTE = 60 * 1000;

/**
 * Hält die Erinnerungen aktuell, solange jemand angemeldet ist:
 * - Abgleich mit den Regeln nach jeder Änderung und stündlich (Fristen verstreichen auch ohne
 *   Änderung, z. B. für das Dankeschön nach einem Termin)
 * - jede Minute prüfen, ob eine Desktop-Benachrichtigung fällig ist
 */
export function useReminderService() {
  const { repos, dataVersion, notifyChange } = useApp();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const reconciling = useRef(false);

  useEffect(() => {
    const reconcile = async () => {
      if (reconciling.current) return;
      reconciling.current = true;
      try {
        // Meldet nur bei echter Änderung – der nächste Abgleich findet dann nichts mehr
        if (await repos.reminders.reconcile()) notifyChange();
      } catch {
        // Offline o. Ä.: beim nächsten Anlass erneut versuchen
      } finally {
        reconciling.current = false;
      }
    };
    void reconcile();
    const timer = setInterval(reconcile, 60 * MINUTE);
    return () => clearInterval(timer);
  }, [repos, dataVersion, notifyChange]);

  useEffect(() => {
    const check = async () => {
      if (!notificationsEnabled() || Notification.permission !== 'granted')
        return;
      try {
        const open = await repos.reminders.open();
        const shown = pruneShown(loadShown(), open);
        for (const reminder of remindersToNotify(open, shown)) {
          const notification = new Notification(reminder.title, {
            body: reminder.body || reminder.company,
            tag: reminder.key,
          });
          notification.onclick = () => {
            desktop.focusWindow();
            navigateRef.current(`/bewerbung/${reminder.applicationId}`);
          };
          shown[reminder.key] = reminder.snoozedUntil ?? reminder.dueAt;
        }
        saveShown(shown);
      } catch {
        // nächster Versuch in einer Minute
      }
    };
    void check();
    const timer = setInterval(check, MINUTE);
    return () => clearInterval(timer);
  }, [repos, dataVersion]);
}
