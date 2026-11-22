import { z } from 'zod';

import type { FormResult } from '@/domain/forms';

// Profil = Lebenslauf des Nutzers: Kopfdaten, Kurzprofil, Stationen (Beruf, Ausbildung, Ehrenamt),
// Kenntnisse, Sprachen und Links. Gespeichert in Supabase (profiles, profile_entries, profile_skills,
// profile_languages, profile_links); `replace_profile` nimmt genau die Form von `ProfileInput`
// entgegen.

/** `YYYY` oder `YYYY-MM` – Lebensläufe nennen oft nur das Jahr */
export type ProfilePeriod = string;

export const PROFILE_ENTRY_KINDS = ['experience', 'education', 'volunteer'] as const;
export type ProfileEntryKind = (typeof PROFILE_ENTRY_KINDS)[number];

export const PROFILE_ENTRY_KIND_LABELS: Record<ProfileEntryKind, string> = {
  experience: 'Berufserfahrung',
  education: 'Aus- und Weiterbildung',
  volunteer: 'Ehrenamt',
};

export type ProfileEntryInput = {
  title: string;
  organization?: string;
  location?: string;
  /** Eine Zeile je Stichpunkt */
  description?: string;
  startDate?: ProfilePeriod;
  endDate?: ProfilePeriod;
  /** „seit …“ bzw. „bis heute“; dann ohne Enddatum */
  isCurrent: boolean;
};

export type ProfileEntry = ProfileEntryInput & { id: string; kind: ProfileEntryKind };

export type ProfileSkillInput = { category?: string; items: string };
export type ProfileSkill = ProfileSkillInput & { id: string };

export type ProfileLanguageInput = { language: string; level?: string };
export type ProfileLanguage = ProfileLanguageInput & { id: string };

export const LINK_KINDS = ['linkedin', 'xing', 'github', 'gitlab', 'website', 'other'] as const;
export type ProfileLinkKind = (typeof LINK_KINDS)[number];
export const LINK_KIND_LABELS: Record<ProfileLinkKind, string> = {
  linkedin: 'LinkedIn',
  xing: 'XING',
  github: 'GitHub',
  gitlab: 'GitLab',
  website: 'Website',
  other: 'Sonstiger Link',
};

export type ProfileLinkInput = { kind: ProfileLinkKind; url: string; label?: string };
export type ProfileLink = ProfileLinkInput & { id: string };

export type ProfilePersonal = {
  firstName: string;
  lastName: string;
  headline?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
  /** Kalendertag `YYYY-MM-DD` */
  birthDate?: string;
  birthPlace?: string;
  summary?: string;
};

export type Profile = ProfilePersonal & {
  /** Zeitpunkt, ab dem die Willkommensseite nicht mehr erscheint */
  onboardedAt?: string;
  experience: ProfileEntry[];
  education: ProfileEntry[];
  volunteering: ProfileEntry[];
  skills: ProfileSkill[];
  languages: ProfileLanguage[];
  links: ProfileLink[];
};

/** Ganzes Profil ohne ids – Eingabe für `replace_profile` (Import, Assistent) */
export type ProfileInput = ProfilePersonal & {
  experience: ProfileEntryInput[];
  education: ProfileEntryInput[];
  volunteering: ProfileEntryInput[];
  skills: ProfileSkillInput[];
  languages: ProfileLanguageInput[];
  /** Fehlt das Feld, lässt `replace_profile` die Links unverändert */
  links?: ProfileLinkInput[];
};

export function emptyProfileInput(seed: Partial<ProfilePersonal> = {}): ProfileInput {
  return {
    firstName: '',
    lastName: '',
    ...seed,
    experience: [],
    education: [],
    volunteering: [],
    skills: [],
    languages: [],
  };
}

/** Alle Stationen: Berufserfahrung, Ausbildung, Ehrenamt */
export function allEntries(profile: Pick<Profile, 'experience' | 'education' | 'volunteering'>) {
  return [...profile.experience, ...profile.education, ...profile.volunteering];
}

/** Profil ohne ids, z. B. um es nach einem Assistenten-Schritt komplett zu speichern */
export function profileToInput(profile: Profile): ProfileInput {
  const entry = ({ id: _id, kind: _kind, ...rest }: ProfileEntry): ProfileEntryInput => rest;
  const {
    onboardedAt: _onboardedAt,
    experience,
    education,
    volunteering,
    skills,
    languages,
    links,
    ...personal
  } = profile;
  return {
    ...personal,
    experience: experience.map(entry),
    education: education.map(entry),
    volunteering: volunteering.map(entry),
    skills: skills.map(({ id: _id, ...rest }) => rest),
    languages: languages.map(({ id: _id, ...rest }) => rest),
    links: links.map(({ id: _id, ...rest }) => rest),
  };
}

// --- Zeiträume -------------------------------------------------------------------------------

const PERIOD_PATTERN = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

/** „2023-05“ → „05/2023“, „2013“ → „2013“ */
export function formatPeriodValue(period: ProfilePeriod): string {
  const [year, month] = period.split('-');
  return month ? `${month}/${year}` : (year ?? period);
}

/** Zeitraum wie im Lebenslauf: „05/2023 – 10/2026“, „seit 10/2025“, „2013“ */
export function formatPeriod(
  entry: Pick<ProfileEntryInput, 'startDate' | 'endDate' | 'isCurrent'>,
): string {
  const start = entry.startDate ? formatPeriodValue(entry.startDate) : undefined;
  const end = entry.endDate ? formatPeriodValue(entry.endDate) : undefined;
  if (entry.isCurrent) return start ? `seit ${start}` : 'aktuell';
  if (start && end) return start === end ? start : `${start} – ${end}`;
  return start ?? (end ? `bis ${end}` : '');
}

/**
 * Eingabe aus dem Formular in einen Zeitraum: „05/2023“, „5/2023“, „2023-05“ und „2023“ gehen.
 * Leer → undefined; alles andere → null (ungültig).
 */
export function parsePeriodInput(input: string): ProfilePeriod | undefined | null {
  const value = input.trim();
  if (!value) return undefined;
  const monthYear = /^(\d{1,2})\s*[/.]\s*(\d{4})$/.exec(value);
  const candidate = monthYear ? `${monthYear[2]}-${monthYear[1]!.padStart(2, '0')}` : value;
  return PERIOD_PATTERN.test(candidate) ? candidate : null;
}

/** Sortierschlüssel: Monat fehlt → Jahresanfang */
function periodKey(period: ProfilePeriod | undefined) {
  return period ? (period.length === 4 ? `${period}-01` : period) : '';
}

/** Neueste Station zuerst: laufende vor beendeten, dann nach Ende bzw. Beginn absteigend */
export function compareEntriesNewestFirst(a: ProfileEntryInput, b: ProfileEntryInput) {
  if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
  const endA = periodKey(a.endDate ?? a.startDate);
  const endB = periodKey(b.endDate ?? b.startDate);
  if (endA !== endB) return endA < endB ? 1 : -1;
  const startA = periodKey(a.startDate);
  const startB = periodKey(b.startDate);
  return startA === startB ? 0 : startA < startB ? 1 : -1;
}

// --- Formulare -------------------------------------------------------------------------------

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined);

function collectErrors<F extends string>(error: z.ZodError): Partial<Record<F, string>> {
  const errors: Partial<Record<F, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as F;
    errors[field] ??= issue.message;
  }
  return errors;
}

/** Leere optionale Felder ganz weglassen statt sie als undefined mitzuführen */
function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export type PersonalFormValues = {
  firstName: string;
  lastName: string;
  headline: string;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  birthDate: string;
  birthPlace: string;
  summary: string;
};
export type PersonalFormField = keyof PersonalFormValues;

const personalSchema = z.object({
  firstName: z.string().trim().min(1, 'Bitte den Vornamen eingeben'),
  lastName: z.string().trim().min(1, 'Bitte den Nachnamen eingeben'),
  headline: optionalText,
  street: optionalText,
  postalCode: optionalText,
  city: optionalText,
  phone: optionalText,
  email: optionalText.pipe(z.email('Bitte eine gültige E-Mail-Adresse eingeben').optional()),
  birthDate: optionalText.pipe(z.iso.date('Bitte ein gültiges Datum eingeben').optional()),
  birthPlace: optionalText,
  summary: optionalText,
});

export function personalToForm(personal: Partial<ProfilePersonal>): PersonalFormValues {
  return {
    firstName: personal.firstName ?? '',
    lastName: personal.lastName ?? '',
    headline: personal.headline ?? '',
    street: personal.street ?? '',
    postalCode: personal.postalCode ?? '',
    city: personal.city ?? '',
    phone: personal.phone ?? '',
    email: personal.email ?? '',
    birthDate: personal.birthDate ?? '',
    birthPlace: personal.birthPlace ?? '',
    summary: personal.summary ?? '',
  };
}

export function parsePersonalForm(
  values: PersonalFormValues,
): FormResult<ProfilePersonal, PersonalFormField> {
  const result = personalSchema.safeParse(values);
  if (!result.success) return { ok: false, errors: collectErrors(result.error) };
  return { ok: true, value: withoutUndefined(result.data) };
}

export type EntryFormValues = {
  title: string;
  organization: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};
export type EntryFormField = keyof EntryFormValues;

const PERIOD_HINT = 'Bitte als MM/JJJJ oder JJJJ eingeben';

export function emptyEntryForm(): EntryFormValues {
  return {
    title: '',
    organization: '',
    location: '',
    description: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
  };
}

export function entryToForm(entry: ProfileEntryInput): EntryFormValues {
  return {
    title: entry.title,
    organization: entry.organization ?? '',
    location: entry.location ?? '',
    description: entry.description ?? '',
    startDate: entry.startDate ? formatPeriodValue(entry.startDate) : '',
    endDate: entry.endDate ? formatPeriodValue(entry.endDate) : '',
    isCurrent: entry.isCurrent,
  };
}

export function parseEntryForm(
  values: EntryFormValues,
  kind: ProfileEntryKind,
): FormResult<ProfileEntryInput, EntryFormField> {
  const errors: Partial<Record<EntryFormField, string>> = {};
  const title = values.title.trim();
  if (!title) {
    errors.title = {
      experience: 'Bitte die Position eingeben',
      education: 'Bitte den Abschluss eingeben',
      volunteer: 'Bitte die Tätigkeit eingeben',
    }[kind];
  }
  const startDate = parsePeriodInput(values.startDate);
  if (startDate === null) errors.startDate = PERIOD_HINT;
  const endDate = values.isCurrent ? undefined : parsePeriodInput(values.endDate);
  if (endDate === null) errors.endDate = PERIOD_HINT;
  if (startDate && endDate && periodKey(endDate) < periodKey(startDate)) {
    errors.endDate = 'Das Ende liegt vor dem Beginn';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: withoutUndefined({
      title,
      organization: values.organization.trim() || undefined,
      location: values.location.trim() || undefined,
      description: normalizeLines(values.description),
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      isCurrent: values.isCurrent,
    }),
  };
}

/** Stichpunkte: Zeilen getrimmt, führende Aufzählungszeichen und Leerzeilen entfernt */
export function normalizeLines(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^\s*[•\-–*]\s*/, '').trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : undefined;
}

export type SkillFormValues = { category: string; items: string };

export function parseSkillForm(
  values: SkillFormValues,
): FormResult<ProfileSkillInput, keyof SkillFormValues> {
  const items = values.items.trim();
  if (!items) return { ok: false, errors: { items: 'Bitte mindestens eine Kenntnis eingeben' } };
  return {
    ok: true,
    value: withoutUndefined({ category: values.category.trim() || undefined, items }),
  };
}

export type LanguageFormValues = { language: string; level: string };

export function parseLanguageForm(
  values: LanguageFormValues,
): FormResult<ProfileLanguageInput, keyof LanguageFormValues> {
  const language = values.language.trim();
  if (!language) return { ok: false, errors: { language: 'Bitte die Sprache eingeben' } };
  return {
    ok: true,
    value: withoutUndefined({ language, level: values.level.trim() || undefined }),
  };
}

// --- Entwurf aus dem PDF-Import --------------------------------------------------------------

// Die KI liefert fehlende Werte als null (strukturierte Ausgabe kennt keine optionalen Felder).
// Hier wird der Entwurf geprüft und in `ProfileInput` umgewandelt; unbrauchbare Zeiträume fallen
// weg statt den ganzen Import scheitern zu lassen.

const draftText = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || undefined);

const draftPeriod = draftText.transform((value) =>
  value && PERIOD_PATTERN.test(value) ? value : undefined,
);

const draftEntry = z.object({
  title: draftText,
  organization: draftText,
  location: draftText,
  description: draftText,
  startDate: draftPeriod,
  endDate: draftPeriod,
  isCurrent: z.boolean().nullish(),
});

export const profileDraftSchema = z.object({
  firstName: draftText,
  lastName: draftText,
  headline: draftText,
  street: draftText,
  postalCode: draftText,
  city: draftText,
  phone: draftText,
  email: draftText,
  birthDate: draftText.transform((value) =>
    value && z.iso.date().safeParse(value).success ? value : undefined,
  ),
  birthPlace: draftText,
  summary: draftText,
  experience: z.array(draftEntry).nullish(),
  education: z.array(draftEntry).nullish(),
  volunteering: z.array(draftEntry).nullish(),
  links: z.array(z.object({ kind: draftText, url: draftText })).nullish(),
  skills: z.array(z.object({ category: draftText, items: draftText })).nullish(),
  languages: z.array(z.object({ language: draftText, level: draftText })).nullish(),
});

/** Prüft die Antwort des Imports; wirft bei einer Form, die gar nicht passt */
export function parseProfileDraft(data: unknown): ProfileInput {
  const draft = profileDraftSchema.parse(data);
  const entries = (list: z.infer<typeof draftEntry>[] | null | undefined) =>
    (list ?? []).flatMap((entry): ProfileEntryInput[] => {
      if (!entry.title) return [];
      const isCurrent = entry.isCurrent === true;
      return [
        withoutUndefined({
          title: entry.title,
          organization: entry.organization,
          location: entry.location,
          description: entry.description && normalizeLines(entry.description),
          startDate: entry.startDate,
          endDate: isCurrent ? undefined : entry.endDate,
          isCurrent,
        }),
      ];
    });
  const { experience, education, volunteering, links, skills, languages, ...personal } = draft;
  return {
    ...withoutUndefined(personal),
    firstName: personal.firstName ?? '',
    lastName: personal.lastName ?? '',
    experience: entries(experience),
    education: entries(education),
    volunteering: entries(volunteering),
    // Ohne Links im Lebenslauf das Feld weglassen – dann bleiben vorhandene Links erhalten
    ...linksField(
      (links ?? []).flatMap((link): ProfileLinkInput[] => {
        const url = link.url && normalizeLinkUrl(link.url);
        if (!url) return [];
        const kind =
          isLinkKind(link.kind) && link.kind !== 'other' ? link.kind : guessLinkKind(url);
        return [{ kind, url }];
      }),
    ),
    skills: (skills ?? []).flatMap((skill) =>
      skill.items ? [withoutUndefined({ category: skill.category, items: skill.items })] : [],
    ),
    languages: (languages ?? []).flatMap((language) =>
      language.language
        ? [withoutUndefined({ language: language.language, level: language.level })]
        : [],
    ),
  };
}

/** Kurzfassung für Vorschau und Rückfragen: „3 Stationen, 2 Ausbildungen …“ */
export function summarizeProfileInput(profile: ProfileInput): string {
  const parts = [
    count(profile.experience.length, 'berufliche Station', 'berufliche Stationen'),
    count(profile.education.length, 'Aus-/Weiterbildung', 'Aus-/Weiterbildungen'),
    ...(profile.volunteering.length
      ? [count(profile.volunteering.length, 'Ehrenamt', 'Ehrenämter')]
      : []),
    count(profile.skills.length, 'Kenntnisgruppe', 'Kenntnisgruppen'),
    count(profile.languages.length, 'Sprache', 'Sprachen'),
    ...(profile.links?.length ? [count(profile.links.length, 'Link', 'Links')] : []),
  ];
  return parts.join(', ');
}

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// --- Links -----------------------------------------------------------------------------------

function linksField(links: ProfileLinkInput[]): { links?: ProfileLinkInput[] } {
  return links.length ? { links } : {};
}

export function isLinkKind(value: unknown): value is ProfileLinkKind {
  return typeof value === 'string' && (LINK_KINDS as readonly string[]).includes(value);
}

/** „github.com/erika“ → „https://github.com/erika“; nur http(s), sonst undefined */
export function normalizeLinkUrl(input: string): string | undefined {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (!url.hostname.includes('.')) return undefined;
    return url.toString().length <= 500 ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const LINK_HOSTS: [RegExp, ProfileLinkKind][] = [
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)xing\.(com|de)$/, 'xing'],
  [/(^|\.)github\.com$/, 'github'],
  [/(^|\.)gitlab\.(com|io)$|^gitlab\./, 'gitlab'],
];

/** Art aus der Adresse; Unbekanntes gilt als Website */
export function guessLinkKind(url: string): ProfileLinkKind {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return LINK_HOSTS.find(([pattern]) => pattern.test(host))?.[1] ?? 'website';
  } catch {
    return 'other';
  }
}

/** Anzeige: Beschriftung oder kurze Adresse ohne Protokoll, „www.“ und Schrägstrich am Ende */
export function linkText(link: Pick<ProfileLinkInput, 'url' | 'label'>) {
  if (link.label) return link.label;
  return link.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

export type LinkFormValues = { kind: ProfileLinkKind | ''; url: string; label: string };
export type LinkFormField = keyof LinkFormValues;

export function parseLinkForm(
  values: LinkFormValues,
): FormResult<ProfileLinkInput, LinkFormField> {
  const url = normalizeLinkUrl(values.url);
  if (!url) {
    return {
      ok: false,
      errors: { url: 'Bitte eine gültige Adresse eingeben, z. B. github.com/deinname' },
    };
  }
  const label = values.label.trim();
  if (label.length > 100) return { ok: false, errors: { label: 'Höchstens 100 Zeichen' } };
  return {
    ok: true,
    value: withoutUndefined({
      kind: values.kind || guessLinkKind(url),
      url,
      label: label || undefined,
    }),
  };
}
