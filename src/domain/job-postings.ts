import type { WorkMode } from '@/domain/application';
import { applicationToForm, type ApplicationFormValues } from '@/domain/forms';

// Stellenangebote: gemerkte Anzeigen (z. B. aus der Browser-Extension), die noch keine Bewerbung
// sind. Aus einem Stellenangebot wird erst eine Bewerbung, wenn der Nutzer sich bewirbt; dann zeigt
// `applicationId` auf diese Bewerbung. Tabelle `job_postings` in ../backend.

export type JobPosting = {
  id: string;
  company: string;
  role: string;
  location: string;
  workMode?: WorkMode;
  /** Jahresgehalt in Euro */
  salaryMin?: number;
  salaryMax?: number;
  source?: string;
  jobUrl?: string;
  /** Text der Stellenanzeige */
  jobDescription?: string;
  contactName?: string;
  contactEmail?: string;
  /** Bewerbung, die aus diesem Stellenangebot entstanden ist */
  applicationId?: string;
  /** Gesetzt = „nicht interessant“ */
  dismissedAt?: string;
  createdAt: string;
};

export const POSTING_STATES = ['open', 'applied', 'dismissed'] as const;
export type PostingState = (typeof POSTING_STATES)[number];
export const POSTING_STATE_LABELS: Record<PostingState, string> = {
  open: 'Offen',
  applied: 'Beworben',
  dismissed: 'Verworfen',
};

export const POSTING_FILTERS = [...POSTING_STATES, 'all'] as const;
export type PostingFilter = (typeof POSTING_FILTERS)[number];
export const POSTING_FILTER_LABELS: Record<PostingFilter, string> = {
  ...POSTING_STATE_LABELS,
  all: 'Alle',
};

/**
 * Zustand eines Stellenangebots. „Beworben“ nur, wenn die verknüpfte Bewerbung noch besteht –
 * eine gelöschte Bewerbung macht das Angebot wieder offen (bzw. verworfen).
 */
export function postingState(
  posting: Pick<JobPosting, 'applicationId' | 'dismissedAt'>,
  activeApplicationIds: ReadonlySet<string>,
): PostingState {
  if (posting.applicationId && activeApplicationIds.has(posting.applicationId)) return 'applied';
  return posting.dismissedAt ? 'dismissed' : 'open';
}

export function matchesPostingFilter(state: PostingState, filter: PostingFilter) {
  return filter === 'all' || state === filter;
}

export function isPostingFilter(value: unknown): value is PostingFilter {
  return typeof value === 'string' && (POSTING_FILTERS as readonly string[]).includes(value);
}

export function countByPostingFilter(states: readonly PostingState[]) {
  const counts: Record<PostingFilter, number> = { open: 0, applied: 0, dismissed: 0, all: states.length };
  for (const state of states) counts[state]++;
  return counts;
}

/**
 * Bewerbungsformular aus einem Stellenangebot: Eckdaten und Anzeigentext übernehmen, Status
 * „Beworben“ mit dem heutigen Tag – der Nutzer kann beides im Formular ändern.
 */
export function postingToApplicationForm(posting: JobPosting, today: string): ApplicationFormValues {
  return applicationToForm({
    id: '',
    company: posting.company,
    role: posting.role,
    location: posting.location,
    workMode: posting.workMode,
    appliedAt: today,
    status: 'applied',
    priority: 'normal',
    source: posting.source,
    jobUrl: posting.jobUrl,
    salaryMin: posting.salaryMin,
    salaryMax: posting.salaryMax,
    jobDescription: posting.jobDescription,
  });
}
