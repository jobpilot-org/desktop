import type { JobApplication } from '@/domain/application';
import { DEFAULT_REMINDER_SETTINGS } from '@/domain/reminders';

import { parseReminderSettings, reminderChanges } from '../reminders';

const application: JobApplication & { createdAt: string } = {
  id: 'app-1',
  company: 'Acme',
  role: 'Dev',
  location: 'Berlin',
  appliedAt: '2026-11-01',
  status: 'applied',
  priority: 'normal',
  createdAt: '2026-11-01T08:00:00.000Z',
};

describe('parseReminderSettings', () => {
  it('nutzt ohne gespeicherte Werte die Standards', () => {
    expect(parseReminderSettings(new Map())).toEqual(DEFAULT_REMINDER_SETTINGS);
  });

  it('liest gespeicherte Werte und ignoriert kaputte Zahlen', () => {
    expect(
      parseReminderSettings(
        new Map([
          ['reminders.followUpDays', '0'],
          ['reminders.thankYou', 'off'],
        ]),
      ),
    ).toEqual({ followUpDays: 0, appointments: true, thankYou: false });
    expect(
      parseReminderSettings(new Map([['reminders.followUpDays', 'abc']]))
        .followUpDays,
    ).toBe(DEFAULT_REMINDER_SETTINGS.followUpDays);
  });
});

describe('reminderChanges', () => {
  const now = new Date('2026-11-05T10:00:00Z');

  it('plant Nachhaken ab dem Anlegen, wenn kein Statusereignis vorliegt', () => {
    const changes = reminderChanges({
      applications: [application],
      appointments: [],
      settings: DEFAULT_REMINDER_SETTINGS,
      stored: [],
      now,
    });
    expect(changes.insert).toHaveLength(1);
    expect(changes.insert[0].key).toBe(
      'follow-up:app-1:2026-11-01T08:00:00.000Z',
    );
  });

  it('ist nach dem Speichern stabil – kein erneuter Abgleich nötig', () => {
    const input = {
      applications: [
        { ...application, lastStatusChangeAt: '2026-11-02T09:00:00.000Z' },
      ],
      appointments: [],
      settings: DEFAULT_REMINDER_SETTINGS,
      now,
    };
    const { insert } = reminderChanges({ ...input, stored: [] });
    expect(reminderChanges({ ...input, stored: insert })).toEqual({
      insert: [],
      update: [],
      remove: [],
    });
  });

  it('entfernt Regel-Erinnerungen, die nicht mehr gelten, aber keine eigenen', () => {
    const changes = reminderChanges({
      applications: [],
      appointments: [],
      settings: DEFAULT_REMINDER_SETTINGS,
      stored: [
        {
          key: 'follow-up:alt',
          applicationId: 'app-1',
          kind: 'follow-up',
          dueAt: now.toISOString(),
          title: '',
          body: '',
        },
        {
          key: 'custom:1',
          applicationId: 'app-1',
          kind: 'custom',
          dueAt: now.toISOString(),
          title: 'Eigene',
          body: '',
        },
      ],
      now,
    });
    expect(changes.remove).toEqual(['follow-up:alt']);
  });
});
