import type { JobPosting } from '@/domain/job-postings';

import { toJobPosting, unwrap, unwrapList } from './mappers';
import type { Supabase } from './supabase';

/**
 * Stellenangebote (Tabelle `job_postings`): gemerkte Anzeigen, die noch keine Bewerbung sind.
 * Angelegt werden sie vor allem von der Browser-Extension; die App listet, verknüpft mit der daraus
 * entstandenen Bewerbung, verwirft und löscht.
 */
export function createJobPostingsRepository(supabase: Supabase) {
  return {
    /** Alle Stellenangebote, neueste zuerst */
    async list(): Promise<JobPosting[]> {
      const rows = unwrapList(
        await supabase
          .from('job_postings')
          .select('*')
          .order('created_at', { ascending: false }),
      );
      return rows.map(toJobPosting);
    },

    async get(id: string): Promise<JobPosting | undefined> {
      const row = unwrap(
        await supabase
          .from('job_postings')
          .select('*')
          .eq('id', id)
          .maybeSingle(),
      );
      return row ? toJobPosting(row) : undefined;
    },

    /** Stellenangebot, aus dem eine Bewerbung entstanden ist */
    async findByApplication(
      applicationId: string,
    ): Promise<JobPosting | undefined> {
      const row = unwrap(
        await supabase
          .from('job_postings')
          .select('*')
          .eq('application_id', applicationId)
          .maybeSingle(),
      );
      return row ? toJobPosting(row) : undefined;
    },

    /** Mit der daraus angelegten Bewerbung verknüpfen; „verworfen“ entfällt damit */
    async linkApplication(id: string, applicationId: string) {
      unwrap(
        await supabase
          .from('job_postings')
          .update({ application_id: applicationId, dismissed_at: null })
          .eq('id', id),
      );
    },

    /** „Nicht interessant“ setzen bzw. wieder öffnen */
    async setDismissed(id: string, dismissed: boolean, now = new Date()) {
      unwrap(
        await supabase
          .from('job_postings')
          .update({ dismissed_at: dismissed ? now.toISOString() : null })
          .eq('id', id),
      );
    },

    async remove(id: string) {
      unwrap(await supabase.from('job_postings').delete().eq('id', id));
    },
  };
}
