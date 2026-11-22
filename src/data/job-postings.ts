import type { FitResult } from '@/domain/job-fit';
import type { JobPosting, JobPostingSource } from '@/domain/job-postings';

import {
  toJobPosting,
  toJobPostingColumns,
  toJobPostingSource,
  toJobPostingSourceColumns,
  unwrap,
  unwrapList,
} from './mappers';
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

    /** Ergebnis der Passung mit den Hashes, aus denen es entstand */
    async saveFit(
      id: string,
      fit: FitResult,
      hashes: { profile: string; posting: string },
      model: string | undefined,
      now = new Date(),
    ) {
      unwrap(
        await supabase
          .from('job_postings')
          .update({
            fit_score: fit.score,
            fit_result: fit,
            fit_profile_hash: hashes.profile,
            fit_posting_hash: hashes.posting,
            fit_model: model ?? null,
            fit_at: now.toISOString(),
          })
          .eq('id', id),
      );
    },

    /** Quellen (Portal, Firmenseite), Firmenseite zuerst, dann die neueste */
    async sources(postingId: string): Promise<JobPostingSource[]> {
      const rows = unwrapList(
        await supabase
          .from('job_posting_sources')
          .select('*')
          .eq('posting_id', postingId)
          .order('captured_at', { ascending: false }),
      );
      return rows
        .map(toJobPostingSource)
        .sort(
          (a, b) => Number(b.kind === 'company') - Number(a.kind === 'company'),
        );
    },

    /** Quelle entfernen; die Eckdaten berechnet die Datenbank aus den übrigen neu */
    async removeSource(id: string) {
      unwrap(await supabase.from('job_posting_sources').delete().eq('id', id));
    },

    /**
     * „Rückgängig“ nach dem Löschen: legt das Stellenangebot mit derselben id und seine Quellen
     * wieder an (Quellen werden mit dem Stellenangebot gelöscht)
     */
    async restore(
      posting: JobPosting,
      sources: readonly JobPostingSource[] = [],
    ) {
      unwrap(
        await supabase
          .from('job_postings')
          .insert(toJobPostingColumns(posting)),
      );
      if (sources.length) {
        unwrap(
          await supabase
            .from('job_posting_sources')
            .insert(sources.map(toJobPostingSourceColumns)),
        );
      }
    },
  };
}
