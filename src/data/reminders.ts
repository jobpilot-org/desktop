import { createId, type JobApplication } from '@/domain/application';
import type { Appointment } from '@/domain/details';
import {
  DEFAULT_REMINDER_SETTINGS,
  diffReminders,
  effectiveDueAt,
  planReminders,
  type Reminder,
  type ReminderChanges,
  type ReminderSettings,
} from '@/domain/reminders';

import {
  toAppointment,
  toIsoTimestamp,
  toJobApplication,
  toReminder,
  unwrap,
  unwrapList,
} from './mappers';
import { createSettingsRepository } from './settings';
import type { Supabase } from './supabase';

export type ReminderWithCompany = Reminder & { company: string };

const DAY = 24 * 60 * 60 * 1000;

/** Gespeicherte Einstellungen → Regeln; fehlende oder kaputte Werte fallen auf den Standard zurück */
export function parseReminderSettings(
  stored: ReadonlyMap<string, string>,
): ReminderSettings {
  const raw = stored.get('reminders.followUpDays');
  const followUpDays = raw === undefined ? NaN : Number(raw);
  return {
    followUpDays: Number.isInteger(followUpDays)
      ? followUpDays
      : DEFAULT_REMINDER_SETTINGS.followUpDays,
    appointments: stored.get('reminders.appointments') !== 'off',
    thankYou: stored.get('reminders.thankYou') !== 'off',
  };
}

/**
 * Was sich an den gespeicherten Erinnerungen ändern muss. Rein, damit sich der Abgleich ohne
 * Datenbank testen lässt; `lastStatusChangeAt` fehlt bei Bewerbungen ohne Statusereignis.
 */
export function reminderChanges({
  applications,
  appointments,
  settings,
  stored,
  now,
}: {
  applications: (JobApplication & {
    createdAt: string;
    lastStatusChangeAt?: string;
  })[];
  appointments: Appointment[];
  settings: ReminderSettings;
  stored: Reminder[];
  now: Date;
}): ReminderChanges {
  const planned = planReminders({
    applications: applications.map(
      ({ createdAt, lastStatusChangeAt, ...application }) => ({
        ...application,
        lastStatusChangeAt: lastStatusChangeAt ?? createdAt,
      }),
    ),
    appointments,
    settings,
    now,
  });
  return diffReminders(planned, stored);
}

/** Erinnerungen in Supabase: Abgleich mit den Regeln (ADR 3 der mobile-app) und Aktionen */
export function createRemindersRepository(supabase: Supabase) {
  const settings = createSettingsRepository(supabase);

  async function withCompany(
    applicationId?: string,
  ): Promise<ReminderWithCompany[]> {
    let query = supabase
      .from('reminders')
      .select('*, applications!inner(company, archived_at)')
      .is('applications.archived_at', null)
      .is('done_at', null);
    if (applicationId) query = query.eq('application_id', applicationId);
    const rows = unwrapList(await query);
    return rows
      .map(({ applications, ...row }) => ({
        ...toReminder(row),
        company: applications.company,
      }))
      .sort((a, b) => effectiveDueAt(a).localeCompare(effectiveDueAt(b)));
  }

  return {
    async settings(): Promise<ReminderSettings> {
      return parseReminderSettings(await settings.all());
    },

    async saveSettings(next: ReminderSettings) {
      await settings.set('reminders.followUpDays', String(next.followUpDays));
      await settings.set(
        'reminders.appointments',
        next.appointments ? 'on' : 'off',
      );
      await settings.set('reminders.thankYou', next.thankYou ? 'on' : 'off');
    },

    /**
     * Gleicht die gespeicherten Erinnerungen mit den Regeln ab. Gibt zurück, ob sich etwas
     * geändert hat. Mehrere Geräte können gleichzeitig abgleichen: Neue Schlüssel werden deshalb
     * per Upsert ohne Überschreiben eingefügt, so bleiben Erledigt und Später erhalten.
     */
    async reconcile(now = new Date()): Promise<boolean> {
      const [applicationRows, eventRows, appointmentRows, storedRows, stored] =
        await Promise.all([
          supabase.from('applications').select('*').is('archived_at', null),
          supabase.from('status_events').select('application_id, at'),
          // Vergangene Termine nur, solange ein Dankeschön noch infrage kommt
          supabase
            .from('appointments')
            .select('*')
            .gte('starts_at', new Date(now.getTime() - 7 * DAY).toISOString()),
          supabase.from('reminders').select('*'),
          settings.all(),
        ]);

      const lastChangeById = new Map<string, string>();
      for (const row of unwrapList(eventRows)) {
        const at = toIsoTimestamp(row.at);
        const previous = lastChangeById.get(row.application_id);
        if (!previous || at > previous)
          lastChangeById.set(row.application_id, at);
      }
      const applications = unwrapList(applicationRows);
      const activeIds = new Set(applications.map((row) => row.id));

      const changes = reminderChanges({
        applications: applications.map((row) => ({
          ...toJobApplication(row),
          createdAt: toIsoTimestamp(row.created_at),
          lastStatusChangeAt: lastChangeById.get(row.id),
        })),
        appointments: unwrapList(appointmentRows)
          .filter((row) => activeIds.has(row.application_id))
          .map(toAppointment),
        settings: parseReminderSettings(stored),
        stored: unwrapList(storedRows).map(toReminder),
        now,
      });
      if (
        !changes.insert.length &&
        !changes.update.length &&
        !changes.remove.length
      ) {
        return false;
      }

      if (changes.remove.length) {
        unwrap(
          await supabase.from('reminders').delete().in('key', changes.remove),
        );
      }
      if (changes.insert.length) {
        const timestamp = now.toISOString();
        unwrap(
          await supabase.from('reminders').upsert(
            changes.insert.map((reminder) => ({
              key: reminder.key,
              application_id: reminder.applicationId,
              kind: reminder.kind,
              due_at: reminder.dueAt,
              title: reminder.title,
              body: reminder.body,
              created_at: timestamp,
            })),
            { onConflict: 'user_id,key', ignoreDuplicates: true },
          ),
        );
      }
      for (const { key, dueAt, title, body } of changes.update) {
        unwrap(
          await supabase
            .from('reminders')
            .update({ due_at: dueAt, title, body })
            .eq('key', key),
        );
      }
      return true;
    },

    /** Offene Erinnerungen aller nicht gelöschten Bewerbungen, nach Fälligkeit */
    open: () => withCompany(),

    forApplication: (applicationId: string) => withCompany(applicationId),

    async markDone(key: string, now = new Date()) {
      unwrap(
        await supabase
          .from('reminders')
          .update({ done_at: now.toISOString() })
          .eq('key', key),
      );
    },

    async snooze(key: string, until: string) {
      unwrap(
        await supabase
          .from('reminders')
          .update({ snoozed_until: until })
          .eq('key', key),
      );
    },

    async addCustom(
      applicationId: string,
      title: string,
      dueAt: string,
      now = new Date(),
    ): Promise<string> {
      const key = `custom:${createId()}`;
      unwrap(
        await supabase.from('reminders').insert({
          key,
          application_id: applicationId,
          kind: 'custom',
          due_at: dueAt,
          title: title.trim(),
          body: '',
          created_at: now.toISOString(),
        }),
      );
      return key;
    },

    async remove(key: string) {
      unwrap(await supabase.from('reminders').delete().eq('key', key));
    },
  };
}

export type RemindersRepository = ReturnType<typeof createRemindersRepository>;
