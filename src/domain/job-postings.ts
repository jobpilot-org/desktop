import type { WorkMode } from '@/domain/application';
import { formatSalary } from '@/domain/application';
import { companyKey, roleKey, sameCompany } from '@/domain/duplicates';
import { applicationToForm, type ApplicationFormValues } from '@/domain/forms';
import type { StoredFit } from '@/domain/job-fit';

// Stellenangebote: gemerkte Anzeigen (z. B. aus der Browser-Extension), die noch keine Bewerbung
// sind. Aus einem Stellenangebot wird erst eine Bewerbung, wenn der Nutzer sich bewirbt; dann zeigt
// `applicationId` auf diese Bewerbung. Tabelle `job_postings` in ../backend.

export type JobPosting = StoredFit & {
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
  /** Wohin die Bewerbung geht (aus den Quellen, meist der Firmenseite) */
  applyEmail?: string;
  applyUrl?: string;
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

// --- Quellen -----------------------------------------------------------------------------------

export const SOURCE_KINDS = ['portal', 'company'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  portal: 'Jobportal',
  company: 'Firmenseite',
};

/**
 * Eine Stelle, wo sie gefunden wurde: auf einem Jobportal oder der Firmenseite. Die Eckdaten des
 * Stellenangebots leitet die Datenbank aus den Quellen ab – je Feld zuerst die Firmenseite, dann
 * die neueste Quelle (Trigger in `job_posting_sources`).
 */
export type JobPostingSource = {
  id: string;
  postingId: string;
  kind: SourceKind;
  source?: string;
  url?: string;
  company?: string;
  role?: string;
  location?: string;
  workMode?: WorkMode;
  salaryMin?: number;
  salaryMax?: number;
  jobDescription?: string;
  contactName?: string;
  contactEmail?: string;
  applyEmail?: string;
  applyUrl?: string;
  capturedAt: string;
};

export type SourceDifference = {
  /** „Position“, „Gehalt“, „Ort“, „Firma“ */
  field: string;
  values: { source: string; value: string }[];
};

/** Kurzname einer Quelle für Hinweise: „Indeed“ bzw. „Firmenseite“ */
export function sourceName(source: Pick<JobPostingSource, 'kind' | 'source'>) {
  return source.kind === 'company' ? SOURCE_KIND_LABELS.company : (source.source ?? SOURCE_KIND_LABELS.portal);
}

/**
 * Was sich zwischen den Quellen unterscheidet – damit der Nutzer sieht, dass z. B. Titel oder
 * Gehalt auf Portal und Firmenseite nicht übereinstimmen. Leere Angaben zählen nicht als Abweichung.
 */
export function sourceDifferences(sources: readonly JobPostingSource[]): SourceDifference[] {
  if (sources.length < 2) return [];
  const checks: {
    field: string;
    value: (s: JobPostingSource) => string | undefined;
    key: (v: string) => string;
    same?: (a: string, b: string) => boolean;
  }[] = [
    { field: 'Position', value: (s) => s.role, key: roleKey },
    // Schreibweisen derselben Firma („Simple First“ / „… Consulting GmbH“) sind keine Abweichung
    { field: 'Firma', value: (s) => s.company, key: companyKey, same: sameCompany },
    { field: 'Ort', value: (s) => s.location, key: (v) => v.trim().toLowerCase() },
    {
      field: 'Gehalt',
      value: (s) => formatSalary(s.salaryMin, s.salaryMax) ?? undefined,
      key: (v) => v,
    },
  ];
  const differences: SourceDifference[] = [];
  for (const check of checks) {
    const values = sources.flatMap((s) => {
      const value = check.value(s)?.trim();
      return value ? [{ source: sourceName(s), value }] : [];
    });
    const differs = check.same
      ? values.some((v) => !check.same!(v.value, values[0]!.value))
      : new Set(values.map((v) => check.key(v.value))).size > 1;
    if (differs) {
      differences.push({ field: check.field, values });
    }
  }
  return differences;
}

/**
 * Websuche nach der Anzeige auf der Firmenseite: Firma (ohne Rechtsform) + „Karriere“ + Position
 * ohne „(m/w/d)“. Vollautomatisch geht es nicht zuverlässig – jede Karriereseite ist anders.
 */
export function companySearchUrl(posting: Pick<JobPosting, 'company' | 'role'>) {
  const company = posting.company.replace(/\b(gmbh|mbh|ag|se|kg|ug|co\.?|& co\.? kg)\b/gi, '').trim();
  const role = posting.role.replace(/\((?:[^)]*\/[^)]*|all genders?)\)/gi, '').trim();
  const query = `"${company}" Karriere ${role}`.replace(/\s+/g, ' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
