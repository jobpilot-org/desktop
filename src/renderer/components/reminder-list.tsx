import { Link } from 'react-router';

import type { ReminderWithCompany } from '@/data/reminders';
import { formatDue, snoozeUntil } from '@/domain/reminders';

import { useApp } from '../app-context';
import { useAction } from '../ui';

/** Offene Erinnerungen mit „Erledigt“ und „Später“ (3 Tage) */
export function ReminderList({
  reminders,
  showCompany = true,
}: {
  reminders: ReminderWithCompany[];
  showCompany?: boolean;
}) {
  const { repos } = useApp();
  const run = useAction();
  const now = new Date();

  return (
    <ul className="rows">
      {reminders.map((reminder) => {
        const overdue =
          (reminder.snoozedUntil ?? reminder.dueAt) < now.toISOString();
        return (
          <li key={reminder.key} className="row">
            <div className="row-main">
              <strong>{reminder.title}</strong>
              <span className={overdue ? 'muted overdue' : 'muted'}>
                {formatDue(reminder, now)}
                {showCompany && (
                  <>
                    {' · '}
                    <Link to={`/bewerbung/${reminder.applicationId}`}>
                      {reminder.company}
                    </Link>
                  </>
                )}
              </span>
              {reminder.body && <span className="muted">{reminder.body}</span>}
            </div>
            <div className="row-actions">
              <button
                onClick={() =>
                  run(() => repos.reminders.snooze(reminder.key, snoozeUntil()))
                }
              >
                Später
              </button>
              <button
                onClick={() =>
                  run(() => repos.reminders.markDone(reminder.key))
                }
              >
                Erledigt
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
