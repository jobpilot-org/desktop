import { createId } from '@/domain/application';
import type {
  Appointment,
  AppointmentInput,
  Contact,
  ContactInput,
  Note,
  UpcomingAppointment,
} from '@/domain/details';

import {
  toAppointment,
  toContact,
  toContactColumns,
  toIsoTimestamp,
  toNote,
  unwrap,
  unwrapList,
} from './mappers';
import type { Supabase } from './supabase';

/** Kontakte, Notizen und Termine einer Bewerbung */
export function createDetailsRepository(supabase: Supabase) {
  return {
    // --- Kontakte ---

    async contacts(applicationId: string): Promise<Contact[]> {
      const rows = unwrapList(
        await supabase
          .from('contacts')
          .select('*')
          .eq('application_id', applicationId)
          .order('created_at'),
      );
      return rows.map(toContact);
    },

    /** Legt an (ohne id) oder überschreibt (mit id) */
    async saveContact(
      applicationId: string,
      input: ContactInput,
      id?: string,
      now = new Date(),
    ): Promise<string> {
      const values = toContactColumns(input);
      if (id) {
        unwrap(await supabase.from('contacts').update(values).eq('id', id));
        return id;
      }
      const newId = createId();
      unwrap(
        await supabase.from('contacts').insert({
          ...values,
          id: newId,
          application_id: applicationId,
          created_at: now.toISOString(),
        }),
      );
      return newId;
    },

    async deleteContact(id: string) {
      unwrap(await supabase.from('contacts').delete().eq('id', id));
    },

    // --- Notizen ---

    async notes(applicationId: string): Promise<Note[]> {
      const rows = unwrapList(
        await supabase
          .from('notes')
          .select('*')
          .eq('application_id', applicationId)
          .order('created_at', { ascending: false }),
      );
      return rows.map(toNote);
    },

    async addNote(
      applicationId: string,
      body: string,
      now = new Date(),
    ): Promise<string> {
      const id = createId();
      unwrap(
        await supabase.from('notes').insert({
          id,
          application_id: applicationId,
          body: body.trim(),
          created_at: now.toISOString(),
        }),
      );
      return id;
    },

    async deleteNote(id: string) {
      unwrap(await supabase.from('notes').delete().eq('id', id));
    },

    // --- Termine ---

    async appointments(applicationId: string): Promise<Appointment[]> {
      const rows = unwrapList(
        await supabase
          .from('appointments')
          .select('*')
          .eq('application_id', applicationId)
          .order('starts_at'),
      );
      return rows.map(toAppointment);
    },

    async saveAppointment(
      applicationId: string,
      input: AppointmentInput,
      id?: string,
      now = new Date(),
    ): Promise<string> {
      const values = {
        kind: input.kind,
        starts_at: input.startsAt,
        location: input.location ?? null,
        notes: input.notes ?? null,
      };
      if (id) {
        unwrap(await supabase.from('appointments').update(values).eq('id', id));
        return id;
      }
      const newId = createId();
      unwrap(
        await supabase.from('appointments').insert({
          ...values,
          id: newId,
          application_id: applicationId,
          created_at: now.toISOString(),
        }),
      );
      return newId;
    },

    async deleteAppointment(id: string) {
      unwrap(await supabase.from('appointments').delete().eq('id', id));
    },

    /** Termine aller nicht gelöschten Bewerbungen im Zeitraum [from, to), früheste zuerst */
    async upcomingAppointments(
      from: Date,
      to: Date,
    ): Promise<UpcomingAppointment[]> {
      const rows = unwrapList(
        await supabase
          .from('appointments')
          .select('*, applications!inner(company, role, archived_at)')
          .is('applications.archived_at', null)
          .gte('starts_at', from.toISOString())
          .lt('starts_at', to.toISOString())
          .order('starts_at'),
      );
      return rows.map(({ applications, ...row }) => ({
        ...toAppointment(row),
        company: applications.company,
        role: applications.role,
      }));
    },

    /** Frühester anstehender Termin je Bewerbung – für die Sortierung */
    async nextAppointmentByApplication(
      now = new Date(),
    ): Promise<Map<string, string>> {
      const rows = unwrapList(
        await supabase
          .from('appointments')
          .select('application_id, starts_at')
          .gte('starts_at', now.toISOString())
          .order('starts_at'),
      );
      const next = new Map<string, string>();
      for (const row of rows) {
        if (!next.has(row.application_id)) {
          next.set(row.application_id, toIsoTimestamp(row.starts_at));
        }
      }
      return next;
    },
  };
}

export type DetailsRepository = ReturnType<typeof createDetailsRepository>;
