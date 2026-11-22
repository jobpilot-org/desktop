import type {
  ApplicationInput,
  ApplicationStatus,
  JobApplication,
  Priority,
  StatusEvent,
  WorkMode,
} from '@/domain/application';
import type {
  Appointment,
  AppointmentKind,
  Contact,
  ContactInput,
  Note,
} from '@/domain/details';
import type {
  Profile,
  ProfileEntry,
  ProfileEntryInput,
  ProfileEntryKind,
  ProfileLanguage,
  ProfileLink,
  ProfileLinkKind,
  ProfilePersonal,
  ProfileSkill,
} from '@/domain/profile';
import type {
  DocumentKind,
  DocumentMimeType,
  ProfileDocument,
} from '@/domain/documents';
import { parseFit, type FitResult } from '@/domain/job-fit';
import type {
  JobPosting,
  JobPostingSource,
  SourceKind,
} from '@/domain/job-postings';
import type { Reminder, ReminderKind } from '@/domain/reminders';

import type { Database, Json } from './database.types';

// Spalten der Datenbank (snake_case, null) ↔ Domain-Typen (camelCase, fehlende Felder).
// Die Check-Constraints der Migration lassen für Status, Art usw. nur die Werte aus `domain/` zu,
// deshalb sind die Typumwandlungen unten sicher.

export type Tables = Database['public']['Tables'];
export type ApplicationRow = Tables['applications']['Row'];
export type StatusEventRow = Tables['status_events']['Row'];
export type ContactRow = Tables['contacts']['Row'];
export type NoteRow = Tables['notes']['Row'];
export type AppointmentRow = Tables['appointments']['Row'];
export type ReminderRow = Tables['reminders']['Row'];
export type ProfileRow = Tables['profiles']['Row'];
export type ProfileEntryRow = Tables['profile_entries']['Row'];
export type ProfileSkillRow = Tables['profile_skills']['Row'];
export type ProfileLanguageRow = Tables['profile_languages']['Row'];
export type ProfileLinkRow = Tables['profile_links']['Row'];
export type DocumentRow = Tables['documents']['Row'];
export type JobPostingRow = Tables['job_postings']['Row'];
export type JobPostingSourceRow = Tables['job_posting_sources']['Row'];

/**
 * Postgres liefert `timestamptz` als `…+00:00`; die Domain vergleicht ISO-Strings mit `Z`, wie sie
 * `Date.toISOString()` erzeugt. Ohne Umwandlung würden Sortierung und Erinnerungsschlüssel kippen.
 */
export function toIsoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

const optionalTimestamp = (value: string | null) =>
  value === null ? undefined : toIsoTimestamp(value);

export function toJobApplication(row: ApplicationRow): JobApplication {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    location: row.location,
    workMode: (row.work_mode ?? undefined) as WorkMode | undefined,
    appliedAt: row.applied_at,
    status: row.status as ApplicationStatus,
    priority: row.priority as Priority,
    source: row.source ?? undefined,
    jobUrl: row.job_url ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    nextStep: row.next_step ?? undefined,
    jobDescription: row.job_description ?? undefined,
  };
}

/** Fehlende optionale Felder werden ausdrücklich geleert, damit ein Update sie löscht */
export function toApplicationColumns(input: ApplicationInput) {
  return {
    company: input.company,
    role: input.role,
    location: input.location,
    work_mode: input.workMode ?? null,
    applied_at: input.appliedAt,
    status: input.status,
    priority: input.priority,
    source: input.source ?? null,
    job_url: input.jobUrl ?? null,
    salary_min: input.salaryMin ?? null,
    salary_max: input.salaryMax ?? null,
    next_step: input.nextStep ?? null,
    job_description: input.jobDescription ?? null,
  } satisfies Tables['applications']['Update'];
}

export function toStatusEvent(row: StatusEventRow): StatusEvent {
  return {
    from: row.from_status as ApplicationStatus | null,
    to: row.to_status as ApplicationStatus,
    at: toIsoTimestamp(row.at),
  };
}

export function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    applicationId: row.application_id,
    name: row.name,
    role: row.role ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    linkedinUrl: row.linkedin_url ?? undefined,
  };
}

export function toContactColumns(input: ContactInput) {
  return {
    name: input.name,
    role: input.role ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    linkedin_url: input.linkedinUrl ?? null,
  } satisfies Tables['contacts']['Update'];
}

export function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    applicationId: row.application_id,
    body: row.body,
    createdAt: toIsoTimestamp(row.created_at),
  };
}

export function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    applicationId: row.application_id,
    kind: row.kind as AppointmentKind,
    startsAt: toIsoTimestamp(row.starts_at),
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function toReminder(row: ReminderRow): Reminder {
  return {
    key: row.key,
    applicationId: row.application_id,
    kind: row.kind as ReminderKind,
    dueAt: toIsoTimestamp(row.due_at),
    title: row.title,
    body: row.body,
    doneAt: optionalTimestamp(row.done_at),
    snoozedUntil: optionalTimestamp(row.snoozed_until),
  };
}

/** null → Feld fehlt; leere Strings ebenso, damit die Domain nur echte Werte sieht */
const optional = (value: string | null) => value || undefined;

export function toProfileEntry(row: ProfileEntryRow): ProfileEntry {
  return {
    id: row.id,
    kind: row.kind as ProfileEntryKind,
    title: row.title,
    organization: optional(row.organization),
    location: optional(row.location),
    description: optional(row.description),
    startDate: optional(row.start_date),
    endDate: optional(row.end_date),
    isCurrent: row.is_current,
  };
}

export function toProfileEntryColumns(input: ProfileEntryInput) {
  return {
    title: input.title,
    organization: input.organization ?? null,
    location: input.location ?? null,
    description: input.description ?? null,
    start_date: input.startDate ?? null,
    end_date: input.isCurrent ? null : (input.endDate ?? null),
    is_current: input.isCurrent,
  };
}

export function toProfilePersonalColumns(personal: ProfilePersonal) {
  return {
    first_name: personal.firstName,
    last_name: personal.lastName,
    headline: personal.headline ?? null,
    street: personal.street ?? null,
    postal_code: personal.postalCode ?? null,
    city: personal.city ?? null,
    phone: personal.phone ?? null,
    email: personal.email ?? null,
    birth_date: personal.birthDate ?? null,
    birth_place: personal.birthPlace ?? null,
    summary: personal.summary ?? null,
  };
}

/** Setzt das Profil aus der Kopfzeile und den Listen zusammen (Listen nach `position`) */
export function toProfile(
  row: ProfileRow,
  entries: ProfileEntryRow[],
  skills: ProfileSkillRow[],
  languages: ProfileLanguageRow[],
  links: ProfileLinkRow[] = [],
): Profile {
  const byPosition = <T extends { position: number }>(a: T, b: T) =>
    a.position - b.position;
  const sortedEntries = [...entries].sort(byPosition).map(toProfileEntry);
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    headline: optional(row.headline),
    street: optional(row.street),
    postalCode: optional(row.postal_code),
    city: optional(row.city),
    phone: optional(row.phone),
    email: optional(row.email),
    birthDate: optional(row.birth_date),
    birthPlace: optional(row.birth_place),
    summary: optional(row.summary),
    onboardedAt: optionalTimestamp(row.onboarded_at),
    experience: sortedEntries.filter((entry) => entry.kind === 'experience'),
    education: sortedEntries.filter((entry) => entry.kind === 'education'),
    volunteering: sortedEntries.filter((entry) => entry.kind === 'volunteer'),
    links: [...links].sort(byPosition).map(
      (link): ProfileLink => ({
        id: link.id,
        kind: link.kind as ProfileLinkKind,
        url: link.url,
        label: optional(link.label),
      }),
    ),
    skills: [...skills].sort(byPosition).map(
      (skill): ProfileSkill => ({
        id: skill.id,
        category: optional(skill.category),
        items: skill.items,
      }),
    ),
    languages: [...languages].sort(byPosition).map(
      (language): ProfileLanguage => ({
        id: language.id,
        language: language.language,
        level: optional(language.level),
      }),
    ),
  };
}

export function toDocument(row: DocumentRow): ProfileDocument {
  return {
    id: row.id,
    kind: row.kind as DocumentKind,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type as DocumentMimeType,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    profileEntryId: row.profile_entry_id ?? undefined,
    createdAt: toIsoTimestamp(row.created_at),
  };
}

export function toJobPosting(row: JobPostingRow): JobPosting {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    location: row.location,
    workMode: (row.work_mode as WorkMode | null) ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    source: row.source ?? undefined,
    jobUrl: row.job_url ?? undefined,
    jobDescription: row.job_description ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    applyEmail: row.apply_email ?? undefined,
    applyUrl: row.apply_url ?? undefined,
    applicationId: row.application_id ?? undefined,
    dismissedAt: optionalTimestamp(row.dismissed_at),
    createdAt: toIsoTimestamp(row.created_at),
    fit: storedFit(row.fit_result),
    fitProfileHash: row.fit_profile_hash ?? undefined,
    fitPostingHash: row.fit_posting_hash ?? undefined,
    fitAt: optionalTimestamp(row.fit_at),
  };
}

/** Gespeicherte Passung; ein unlesbares Ergebnis gilt als „noch nicht bewertet“ */
function storedFit(value: unknown): FitResult | undefined {
  if (value === null || value === undefined) return undefined;
  try {
    return parseFit(value);
  } catch {
    return undefined;
  }
}

/** Alle Spalten eines Stellenangebots – zum Wiederherstellen nach dem Löschen („Rückgängig“) */
export function toJobPostingColumns(posting: JobPosting) {
  return {
    id: posting.id,
    company: posting.company,
    role: posting.role,
    location: posting.location,
    work_mode: posting.workMode ?? null,
    salary_min: posting.salaryMin ?? null,
    salary_max: posting.salaryMax ?? null,
    source: posting.source ?? null,
    job_url: posting.jobUrl ?? null,
    job_description: posting.jobDescription ?? null,
    contact_name: posting.contactName ?? null,
    contact_email: posting.contactEmail ?? null,
    apply_email: posting.applyEmail ?? null,
    apply_url: posting.applyUrl ?? null,
    application_id: posting.applicationId ?? null,
    dismissed_at: posting.dismissedAt ?? null,
    created_at: posting.createdAt,
    fit_score: posting.fit?.score ?? null,
    fit_result: (posting.fit as Json | undefined) ?? null,
    fit_profile_hash: posting.fitProfileHash ?? null,
    fit_posting_hash: posting.fitPostingHash ?? null,
    fit_at: posting.fitAt ?? null,
  } satisfies Tables['job_postings']['Insert'];
}

export function toJobPostingSource(row: JobPostingSourceRow): JobPostingSource {
  const text = (value: string | null) => value ?? undefined;
  return {
    id: row.id,
    postingId: row.posting_id,
    kind: row.kind as SourceKind,
    source: text(row.source),
    url: text(row.url),
    company: text(row.company),
    role: text(row.role),
    location: text(row.location),
    workMode: (row.work_mode as WorkMode | null) ?? undefined,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    jobDescription: text(row.job_description),
    contactName: text(row.contact_name),
    contactEmail: text(row.contact_email),
    applyEmail: text(row.apply_email),
    applyUrl: text(row.apply_url),
    capturedAt: toIsoTimestamp(row.captured_at),
  };
}

/** Alle Spalten einer Quelle – zum Wiederherstellen nach dem Löschen des Stellenangebots */
export function toJobPostingSourceColumns(source: JobPostingSource) {
  return {
    id: source.id,
    posting_id: source.postingId,
    kind: source.kind,
    source: source.source ?? null,
    url: source.url ?? null,
    company: source.company ?? null,
    role: source.role ?? null,
    location: source.location ?? null,
    work_mode: source.workMode ?? null,
    salary_min: source.salaryMin ?? null,
    salary_max: source.salaryMax ?? null,
    job_description: source.jobDescription ?? null,
    contact_name: source.contactName ?? null,
    contact_email: source.contactEmail ?? null,
    apply_email: source.applyEmail ?? null,
    apply_url: source.applyUrl ?? null,
    captured_at: source.capturedAt,
  } satisfies Tables['job_posting_sources']['Insert'];
}

/** Supabase meldet Fehler als Rückgabewert; hier werden sie zu Ausnahmen */
export function unwrap<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error;
  return data;
}

/** Wie unwrap, für Listenabfragen: ohne Fehler ist das Ergebnis eine (ggf. leere) Liste */
export function unwrapList<T>({
  data,
  error,
}: {
  data: T[] | null;
  error: unknown;
}): T[] {
  if (error) throw error;
  return data ?? [];
}
