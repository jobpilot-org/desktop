import { fitInputSchema, fitSchema } from '@jobpilot-org/shared-ai/features/job-fit';
import type { z } from 'zod';

import type { Profile } from '@/domain/profile';
import { canReview, reviewRequest } from '@/domain/profile-review';

// Passung des Profils zu einem Stellenangebot: Die KI (Edge Function `job-fit`) bewertet sie mit
// Score, Pros, Contras und Prognose. Das Ergebnis liegt am Stellenangebot, zusammen mit Hashes von
// Profil und Anzeigentext. Weichen die Hashes vom aktuellen Stand ab, gilt es als veraltet und wird
// nur auf Wunsch neu berechnet – so werden Tokens gespart (Idee aus Feature ⁷).

export const FIT_LEVELS = fitSchema.shape.level.options;
export type FitLevel = (typeof FIT_LEVELS)[number];

export const FIT_LEVEL_LABELS: Record<FitLevel, string> = {
  hoch: 'Passt gut',
  mittel: 'Passt teilweise',
  gering: 'Passt kaum',
};

export const CHANCE_LABELS: Record<FitLevel, string> = {
  hoch: 'Gute Aussichten',
  mittel: 'Mittlere Aussichten',
  gering: 'Geringe Aussichten',
};

export type FitResult = z.infer<typeof fitSchema>;

/** Was die Passung von einem Stellenangebot braucht */
export type FitPosting = {
  company: string;
  role: string;
  location: string;
  jobDescription?: string;
};

/** Mindestlänge des Anzeigentexts wie in der Edge Function */
const MIN_DESCRIPTION_CHARS = 80;

export type FitRequest = z.infer<typeof fitInputSchema>;

/** Anfrage an `job-fit`: Profil ohne Name und Kontaktdaten, dazu die Eckdaten der Anzeige */
export function fitRequest(profile: Profile, posting: FitPosting): FitRequest {
  return {
    profile: reviewRequest(profile).profile,
    posting: {
      company: posting.company,
      role: posting.role,
      location: posting.location || undefined,
      description: (posting.jobDescription ?? '').trim().slice(0, 20_000),
    },
  };
}

/** Lässt sich die Passung bewerten? Sonst der Grund für den Nutzer */
export function fitBlocker(profile: Profile | undefined, posting: FitPosting): string | undefined {
  if (!profile || !canReview(profile)) {
    return 'Dein Profil ist noch fast leer – lege zuerst Stationen oder ein Kurzprofil an.';
  }
  if ((posting.jobDescription ?? '').trim().length < MIN_DESCRIPTION_CHARS) {
    return 'Zu diesem Stellenangebot ist kein Anzeigentext gespeichert.';
  }
  return undefined;
}

/** Kurzer, stabiler Hash (cyrb53) – nur zum Erkennen von Änderungen, nicht für Sicherheit */
export function hashText(text: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Hash dessen, was die KI vom Profil sieht – ändert sich der Name, bleibt er gleich */
export function profileHash(profile: Profile) {
  return hashText(JSON.stringify(reviewRequest(profile).profile));
}

export function postingHash(posting: FitPosting) {
  return hashText(
    [posting.company, posting.role, posting.location, (posting.jobDescription ?? '').trim()].join('\n'),
  );
}

/** Gespeicherte Passung am Stellenangebot */
export type StoredFit = {
  fit?: FitResult;
  fitProfileHash?: string;
  fitPostingHash?: string;
  fitAt?: string;
};

/** none = noch nicht bewertet, current = passt zum aktuellen Stand, outdated = Profil oder Text geändert */
export function fitStatus(
  posting: FitPosting & StoredFit,
  profile: Profile | undefined,
): 'none' | 'current' | 'outdated' {
  if (!posting.fit) return 'none';
  if (!profile) return 'current';
  const same =
    posting.fitProfileHash === profileHash(profile) && posting.fitPostingHash === postingHash(posting);
  return same ? 'current' : 'outdated';
}

const isLevel = (value: unknown): value is FitLevel =>
  typeof value === 'string' && (FIT_LEVELS as readonly string[]).includes(value);

const strings = (value: unknown, max: number) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim())
        .slice(0, max)
    : [];

/** Prüft die Antwort von `job-fit` bzw. das gespeicherte Ergebnis; wirft, wenn es unbrauchbar ist */
export function parseFit(data: unknown): FitResult {
  if (typeof data !== 'object' || data === null) throw new Error('Keine Passung');
  const d = data as Record<string, unknown>;
  if (typeof d.score !== 'number' || !Number.isFinite(d.score)) throw new Error('Kein Score');
  const score = Math.min(100, Math.max(0, Math.round(d.score)));
  const prognosis = (d.prognosis ?? {}) as Record<string, unknown>;
  const level = isLevel(d.level) ? d.level : score >= 70 ? 'hoch' : score >= 45 ? 'mittel' : 'gering';
  return {
    score,
    level,
    summary: typeof d.summary === 'string' ? d.summary.trim() : '',
    pros: strings(d.pros, 6),
    cons: strings(d.cons, 6),
    prognosis: {
      chance: isLevel(prognosis.chance) ? prognosis.chance : level,
      text: typeof prognosis.text === 'string' ? prognosis.text.trim() : '',
    },
    emphasize: strings(d.emphasize, 5),
  };
}
