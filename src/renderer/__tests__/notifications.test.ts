import type { Reminder } from '@/domain/reminders';

import { pruneShown, remindersToNotify } from '../notifications';

const now = new Date('2026-11-19T10:00:00.000Z');
const reminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  key: 'follow-up:a:1',
  applicationId: 'a',
  kind: 'follow-up',
  dueAt: '2026-11-19T09:00:00.000Z',
  title: 'Nachhaken',
  body: '',
  ...overrides,
});

describe('remindersToNotify', () => {
  it('meldet fällige, noch nicht gezeigte Erinnerungen', () => {
    expect(remindersToNotify([reminder()], {}, now)).toHaveLength(1);
  });

  it('meldet nichts Künftiges, Erledigtes oder schon Gezeigtes', () => {
    expect(
      remindersToNotify(
        [
          reminder({ key: 'future', dueAt: '2026-11-19T11:00:00.000Z' }),
          reminder({ key: 'done', doneAt: '2026-11-19T09:30:00.000Z' }),
          reminder({ key: 'shown' }),
        ],
        { shown: '2026-11-19T09:00:00.000Z' },
        now,
      ),
    ).toEqual([]);
  });

  it('meldet nach „Später“ erneut, sobald die neue Fälligkeit erreicht ist', () => {
    const snoozed = reminder({ snoozedUntil: '2026-11-19T09:30:00.000Z' });
    expect(
      remindersToNotify([snoozed], { [snoozed.key]: snoozed.dueAt }, now),
    ).toHaveLength(1);
  });

  it('lässt länger als einen Tag Überfälliges aus', () => {
    expect(
      remindersToNotify(
        [reminder({ dueAt: '2026-11-17T09:00:00.000Z' })],
        {},
        now,
      ),
    ).toEqual([]);
  });
});

describe('pruneShown', () => {
  it('behält nur Schlüssel offener Erinnerungen', () => {
    expect(pruneShown({ a: 'x', b: 'y' }, [reminder({ key: 'a' })])).toEqual({
      a: 'x',
    });
  });
});
