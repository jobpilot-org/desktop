import type { FitResult } from '@/domain/job-fit';
import type { Profile } from '@/domain/profile';
import { reviewRequest, type ReviewRequest } from '@/domain/profile-review';

// Anschreiben: je Stellenangebot bzw. Bewerbung eines, gespeichert in Teilen (Ansprache,
// Tonalität, Länge, Stärken, Betreff, Abschnitte), damit der Assistent Abschnitt für Abschnitt
// vorschlagen und der Nutzer jeden Teil ändern kann. Absender und Empfänger kommen beim Anzeigen
// aus Profil und Stelle. Die KI schreibt über die Edge Function `cover-letter`.

export const LETTER_TONES = ['formal', 'modern', 'personal'] as const;
export type LetterTone = (typeof LETTER_TONES)[number];
export const LETTER_TONE_LABELS: Record<LetterTone, string> = {
  formal: 'Formell',
  modern: 'Modern & sachlich',
  personal: 'Persönlich',
};
export const LETTER_TONE_HINTS: Record<LetterTone, string> = {
  formal: 'Klassisch und gediegen – z. B. Banken, Behörden, Kanzleien',
  modern: 'Klar und direkt, ohne Floskeln – passt fast immer',
  personal: 'Mit eigener Stimme, darf duzen, wenn die Anzeige duzt – Start-ups, Agenturen',
};

export const LETTER_LENGTHS = ['short', 'medium'] as const;
export type LetterLength = (typeof LETTER_LENGTHS)[number];
export const LETTER_LENGTH_LABELS: Record<LetterLength, string> = {
  short: 'Kurz (etwa eine halbe Seite)',
  medium: 'Standard (etwa eine Seite)',
};

export const SECTION_KEYS = ['intro', 'fit', 'strengths', 'motivation', 'closing'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_LABELS: Record<SectionKey, string> = {
  intro: 'Einstieg',
  fit: 'Passung zur Stelle',
  strengths: 'Weitere Stärken',
  motivation: 'Motivation für das Unternehmen',
  closing: 'Schluss',
};
export const SECTION_HINTS: Record<SectionKey, string> = {
  intro: 'Bezug zur Stelle und ein konkreter Aufhänger',
  fit: 'Anforderungen der Stelle mit deinen Erfahrungen verbinden',
  strengths: 'Deine ausgewählten Stärken, auf die Stelle bezogen',
  motivation: 'Warum genau dieses Unternehmen und diese Aufgabe',
  closing: 'Wunsch nach einem Gespräch, ggf. Verfügbarkeit',
};

export type LetterSection = { key: SectionKey; text: string };

export type CoverLetter = {
  id: string;
  postingId?: string;
  applicationId?: string;
  salutation: string;
  tone: LetterTone;
  length: LetterLength;
  strengths: string[];
  subject: string;
  sections: LetterSection[];
  closing: string;
  updatedAt: string;
};

export type CoverLetterInput = Omit<CoverLetter, 'id' | 'updatedAt'>;

/** Wofür das Anschreiben ist: Eckdaten der Stelle, ggf. mit Passung und Ansprechperson */
export type LetterPosting = {
  company: string;
  role: string;
  location?: string;
  jobDescription?: string;
  contactName?: string;
  fit?: FitResult;
};

export const DEFAULT_CLOSING = 'Mit freundlichen Grüßen';
export const TEAM_SALUTATION = 'Sehr geehrte Damen und Herren,';

export type SalutationOption = { label: string; value: string };

/**
 * Vorschläge für die Ansprache. Frau oder Herr leitet jobpilot nicht aus dem Vornamen ab – der
 * Nutzer wählt; steht „Frau“/„Herr“ schon in der Angabe, wird es übernommen.
 */
export function salutationOptions(posting: Pick<LetterPosting, 'company' | 'contactName'>): SalutationOption[] {
  const options: SalutationOption[] = [];
  const contact = posting.contactName?.trim().replace(/\s+/g, ' ');
  if (contact) {
    const titled = contact.match(/^(frau|herr)\s+(.+)$/i);
    if (titled) {
      const lastName = titled[2]!;
      const female = titled[1]!.toLowerCase() === 'frau';
      options.push({
        label: `${female ? 'Sehr geehrte Frau' : 'Sehr geehrter Herr'} ${lastName}`,
        value: `${female ? 'Sehr geehrte Frau' : 'Sehr geehrter Herr'} ${lastName},`,
      });
    } else {
      const parts = contact.split(' ');
      const lastName = parts[parts.length - 1]!;
      options.push(
        { label: `Sehr geehrte Frau ${lastName}`, value: `Sehr geehrte Frau ${lastName},` },
        { label: `Sehr geehrter Herr ${lastName}`, value: `Sehr geehrter Herr ${lastName},` },
        { label: `Guten Tag ${contact}`, value: `Guten Tag ${contact},` },
      );
    }
  }
  options.push({ label: 'Sehr geehrte Damen und Herren', value: TEAM_SALUTATION });
  if (posting.company.trim()) {
    options.push({
      label: `Liebes Team von ${posting.company.trim()}`,
      value: `Liebes Team von ${posting.company.trim()},`,
    });
  }
  return options;
}

/** Stärken zum Hervorheben – aus der Passung („betonen“ zuerst, dann Pros), ohne Doppelte */
export function suggestedStrengths(posting: Pick<LetterPosting, 'fit'>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...(posting.fit?.emphasize ?? []), ...(posting.fit?.pros ?? [])]) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item.trim());
  }
  return result.slice(0, 8);
}

/** Abschnitte in fester Reihenfolge; fehlende leer */
export function orderSections(sections: readonly { key: string; text: string }[]): LetterSection[] {
  return SECTION_KEYS.map((key) => ({
    key,
    text: sections.find((section) => section.key === key)?.text.trim() ?? '',
  }));
}

export function hasContent(letter: Pick<CoverLetter, 'sections'>) {
  return letter.sections.some((section) => section.text.trim() !== '');
}

/** Neues Anschreiben mit sinnvollen Vorgaben */
export function emptyLetter(
  target: { postingId?: string; applicationId?: string },
  posting: LetterPosting,
): CoverLetterInput {
  return {
    ...target,
    salutation: salutationOptions(posting)[0]!.value,
    tone: 'modern',
    length: 'medium',
    strengths: suggestedStrengths(posting).slice(0, 3),
    subject: `Bewerbung als ${posting.role}`,
    sections: orderSections([]),
    closing: DEFAULT_CLOSING,
  };
}

export type LetterRequest = {
  mode: 'draft' | 'section';
  profile: ReviewRequest['profile'];
  posting: { company: string; role: string; location?: string; description?: string };
  salutation: string;
  tone: LetterTone;
  length: LetterLength;
  strengths: string[];
  sections?: LetterSection[];
  section?: SectionKey;
  hint?: string;
};

/** Anfrage an `cover-letter`: Profil ohne Name und Kontaktdaten wie beim KI-Check */
export function letterRequest(
  profile: Profile,
  posting: LetterPosting,
  letter: CoverLetterInput,
  section?: { key: SectionKey; hint?: string },
): LetterRequest {
  return {
    mode: section ? 'section' : 'draft',
    profile: reviewRequest(profile).profile,
    posting: {
      company: posting.company,
      role: posting.role,
      location: posting.location || undefined,
      description: posting.jobDescription?.trim().slice(0, 20_000) || undefined,
    },
    salutation: letter.salutation,
    tone: letter.tone,
    length: letter.length,
    strengths: letter.strengths.filter((s) => s.trim()).slice(0, 10),
    ...(section
      ? {
          sections: letter.sections.filter((s) => s.text.trim()),
          section: section.key,
          hint: section.hint?.trim() || undefined,
        }
      : {}),
  };
}

/** Antwort eines Entwurfs: Betreff und alle Abschnitte; wirft, wenn sie unbrauchbar ist */
export function parseDraft(data: unknown): { subject: string; sections: LetterSection[] } {
  const d = (data ?? {}) as { subject?: unknown; sections?: unknown };
  if (!Array.isArray(d.sections)) throw new Error('Keine Abschnitte');
  const sections = orderSections(
    d.sections.filter(
      (s): s is { key: string; text: string } =>
        typeof s === 'object' && s !== null && typeof s.key === 'string' && typeof s.text === 'string',
    ),
  );
  if (!hasContent({ sections })) throw new Error('Leerer Entwurf');
  return { subject: typeof d.subject === 'string' ? d.subject.trim() : '', sections };
}

export function parseSectionText(data: unknown): string {
  const text = (data as { text?: unknown } | null)?.text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Leerer Abschnitt');
  return text.trim();
}

/** „22. November 2026“ */
export function letterDate(date: Date) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/**
 * Das ganze Anschreiben als Text: Absender aus dem Profil, Empfänger, Ort und Datum, Betreff,
 * Anrede, Abschnitte, Gruß und Name – zum Kopieren in ein Dokument oder eine E-Mail.
 */
export function letterText(
  letter: Pick<CoverLetter, 'salutation' | 'subject' | 'sections' | 'closing'>,
  profile: Profile,
  posting: Pick<LetterPosting, 'company' | 'contactName'>,
  date = new Date(),
) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const sender = [
    name,
    profile.street,
    [profile.postalCode, profile.city].filter(Boolean).join(' '),
    profile.phone,
    profile.email,
  ].filter((line) => line && line.trim());
  const recipient = [posting.company, posting.contactName].filter((line) => line && line.trim());
  const place = profile.city ? `${profile.city}, ` : '';
  const body = letter.sections.map((s) => s.text.trim()).filter(Boolean);
  return [
    sender.join('\n'),
    recipient.join('\n'),
    `${place}${letterDate(date)}`,
    letter.subject.trim(),
    [letter.salutation.trim(), '', body.join('\n\n')].join('\n'),
    [letter.closing.trim(), '', name].join('\n'),
  ]
    .filter((block) => block.trim())
    .join('\n\n');
}
