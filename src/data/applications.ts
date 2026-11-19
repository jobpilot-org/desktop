import {
  createId,
  type ApplicationInput,
  type ApplicationStatus,
  type JobApplication,
  type StatusEvent,
} from '@/domain/application';
import type { ApplicationHistory } from '@/domain/insights';

import {
  toApplicationColumns,
  toJobApplication,
  toStatusEvent,
  unwrap,
  unwrapList,
} from './mappers';
import type { Supabase } from './supabase';

/**
 * Bewerbungen in Supabase – dieselben Operationen wie das Repository der mobile-app, aber
 * asynchron. RLS beschränkt alle Abfragen auf die Zeilen des angemeldeten Nutzers, `user_id`
 * setzt die Datenbank, `updated_at` ein Trigger.
 *
 * Bewerbung und Statusereignis werden nacheinander geschrieben, nicht in einer Transaktion: Schlägt
 * das zweite Schreiben fehl, fehlt dieser Eintrag im Verlauf.
 */
export function createApplicationsRepository(supabase: Supabase) {
  async function insertEvent(
    applicationId: string,
    from: ApplicationStatus | null,
    to: ApplicationStatus,
    at: string,
  ) {
    unwrap(
      await supabase.from('status_events').insert({
        application_id: applicationId,
        from_status: from,
        to_status: to,
        at,
      }),
    );
  }

  async function currentStatus(
    id: string,
  ): Promise<ApplicationStatus | undefined> {
    const row = unwrap(
      await supabase
        .from('applications')
        .select('status')
        .eq('id', id)
        .maybeSingle(),
    );
    return row?.status as ApplicationStatus | undefined;
  }

  return {
    /** Nicht gelöschte Bewerbungen, neueste zuerst */
    async listActive(): Promise<JobApplication[]> {
      const rows = unwrapList(
        await supabase
          .from('applications')
          .select('*')
          .is('archived_at', null)
          .order('applied_at', { ascending: false })
          .order('created_at', { ascending: false }),
      );
      return rows.map(toJobApplication);
    },

    async get(id: string): Promise<JobApplication | undefined> {
      const row = unwrap(
        await supabase
          .from('applications')
          .select('*')
          .eq('id', id)
          .is('archived_at', null)
          .maybeSingle(),
      );
      return row ? toJobApplication(row) : undefined;
    },

    async create(
      input: ApplicationInput,
      now = new Date(),
    ): Promise<JobApplication> {
      const id = createId();
      const timestamp = now.toISOString();
      unwrap(
        await supabase.from('applications').insert({
          ...toApplicationColumns(input),
          id,
          created_at: timestamp,
          updated_at: timestamp,
        }),
      );
      await insertEvent(id, null, input.status, timestamp);
      return { ...input, id };
    },

    /** Speichert alle Felder; ein geänderter Status wird wie bei changeStatus protokolliert */
    async update(id: string, input: ApplicationInput, now = new Date()) {
      const current = await currentStatus(id);
      if (!current) return;
      unwrap(
        await supabase
          .from('applications')
          .update(toApplicationColumns(input))
          .eq('id', id),
      );
      if (current !== input.status) {
        await insertEvent(id, current, input.status, now.toISOString());
      }
    },

    /** Ändert den Status und protokolliert den Wechsel. false, wenn sich nichts ändert. */
    async changeStatus(
      id: string,
      to: ApplicationStatus,
      now = new Date(),
    ): Promise<boolean> {
      const current = await currentStatus(id);
      if (!current || current === to) return false;
      // Nur ändern, wenn der Status noch der gelesene ist – sonst hat ein anderes Gerät
      // gleichzeitig geändert und das Ereignis würde einen falschen Ausgangsstatus nennen.
      const changed = unwrapList(
        await supabase
          .from('applications')
          .update({ status: to })
          .eq('id', id)
          .eq('status', current)
          .select('id'),
      );
      if (!changed.length) return false;
      await insertEvent(id, current, to, now.toISOString());
      return true;
    },

    /** Weiches Löschen: Eintrag verschwindet aus allen Listen, lässt sich aber zurückholen */
    async archive(id: string, now = new Date()) {
      unwrap(
        await supabase
          .from('applications')
          .update({ archived_at: now.toISOString() })
          .eq('id', id),
      );
    },

    async restore(id: string) {
      unwrap(
        await supabase
          .from('applications')
          .update({ archived_at: null })
          .eq('id', id),
      );
    },

    async statusEvents(applicationId: string): Promise<StatusEvent[]> {
      const rows = unwrapList(
        await supabase
          .from('status_events')
          .select('*')
          .eq('application_id', applicationId)
          .order('at')
          .order('id'),
      );
      return rows.map(toStatusEvent);
    },

    /** Alle nicht gelöschten Bewerbungen mit ihrem Verlauf – für die Auswertungen */
    async histories(): Promise<ApplicationHistory[]> {
      const rows = unwrapList(
        await supabase
          .from('applications')
          .select('*, status_events(*)')
          .is('archived_at', null)
          .order('at', { referencedTable: 'status_events' })
          .order('id', { referencedTable: 'status_events' }),
      );
      return rows.map(({ status_events, ...application }) => ({
        application: toJobApplication(application),
        events: status_events.map(toStatusEvent),
      }));
    },
  };
}

export type ApplicationsRepository = ReturnType<
  typeof createApplicationsRepository
>;
