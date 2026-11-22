import type { JobApplication } from '@/domain/application';
import type { JobPosting } from '@/domain/job-postings';

import { useApp } from './app-context';
import { useAction, useToast } from './ui';

// Löschen mit „Rückgängig“ statt Rückfrage – gleich in Listen, Board und auf den Detailseiten.
// Bewerbungen werden archiviert (Soft Delete), Stellenangebote gelöscht und beim Rückgängig mit
// derselben id wieder angelegt.

/** Löscht eine Bewerbung; gibt zurück, ob es geklappt hat */
export function useDeleteApplication() {
  const { repos } = useApp();
  const run = useAction();
  const toast = useToast();
  return async (application: Pick<JobApplication, 'id' | 'company'>) => {
    if (!(await run(() => repos.applications.archive(application.id))))
      return false;
    toast({
      text: `Bewerbung ${application.company} gelöscht`,
      action: {
        label: 'Rückgängig',
        run: () => void run(() => repos.applications.restore(application.id)),
      },
    });
    return true;
  };
}

/** Löscht ein Stellenangebot; gibt zurück, ob es geklappt hat */
export function useDeletePosting() {
  const { repos } = useApp();
  const run = useAction();
  const toast = useToast();
  return async (posting: JobPosting) => {
    // Quellen gehen mit dem Stellenangebot weg – für „Rückgängig“ vorher merken
    const sources = await repos.jobPostings.sources(posting.id).catch(() => []);
    // Ein Anschreiben nur zum Stellenangebot geht mit; eins mit Bewerbung bleibt dort
    const letter = await repos.coverLetters
      .find({ postingId: posting.id })
      .catch(() => undefined);
    const lost = letter && !letter.applicationId ? letter : undefined;
    if (!(await run(() => repos.jobPostings.remove(posting.id)))) return false;
    toast({
      text: `Stellenangebot ${posting.company} gelöscht`,
      action: {
        label: 'Rückgängig',
        run: () =>
          void run(async () => {
            await repos.jobPostings.restore(posting, sources);
            if (lost) await repos.coverLetters.restore(lost);
          }),
      },
    });
    return true;
  };
}
