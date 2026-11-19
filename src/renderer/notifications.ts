import { effectiveDueAt, isOpen, type Reminder } from '@/domain/reminders';

// Desktop-Benachrichtigungen sind eine Einstellung dieses Geräts, nicht des Kontos – sonst
// würden alle Rechner eines Nutzers gleichzeitig piepen, sobald er sie irgendwo einschaltet.

const ENABLED_KEY = 'jobpilot.notifications.enabled';
const SHOWN_KEY = 'jobpilot.notifications.shown';
const HOUR = 60 * 60 * 1000;
/** Länger Überfälliges erscheint nur in der Liste, nicht als Benachrichtigung */
const MAX_LATE = 24 * HOUR;

/** Schlüssel → Fälligkeit, zu der schon benachrichtigt wurde */
export type ShownReminders = Record<string, string>;

/**
 * Erinnerungen, für die jetzt eine Benachrichtigung fällig ist: offen, fällig, höchstens einen Tag
 * überfällig und für diese Fälligkeit noch nicht gezeigt. Nach „Später“ ändert sich die
 * Fälligkeit, dann kommt die Benachrichtigung erneut.
 */
export function remindersToNotify<T extends Reminder>(
  reminders: T[],
  shown: ShownReminders,
  now = new Date(),
): T[] {
  return reminders.filter((reminder) => {
    const due = effectiveDueAt(reminder);
    const late = now.getTime() - new Date(due).getTime();
    return (
      isOpen(reminder) &&
      late >= 0 &&
      late <= MAX_LATE &&
      shown[reminder.key] !== due
    );
  });
}

/** Gezeigte Einträge ohne passende offene Erinnerung fallen weg, damit der Speicher nicht wächst */
export function pruneShown(
  shown: ShownReminders,
  reminders: Reminder[],
): ShownReminders {
  const keys = new Set(reminders.map((reminder) => reminder.key));
  return Object.fromEntries(
    Object.entries(shown).filter(([key]) => keys.has(key)),
  );
}

export function notificationsEnabled() {
  return localStorage.getItem(ENABLED_KEY) === 'on';
}

export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
}

export function loadShown(): ShownReminders {
  try {
    return JSON.parse(
      localStorage.getItem(SHOWN_KEY) ?? '{}',
    ) as ShownReminders;
  } catch {
    return {};
  }
}

export function saveShown(shown: ShownReminders) {
  localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
}
