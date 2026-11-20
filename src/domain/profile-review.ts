import { z } from 'zod';

import {
  formatPeriod,
  normalizeLines,
  type Profile,
  type ProfileEntry,
  type ProfileEntryInput,
  type ProfileEntryKind,
  type ProfileLanguage,
  type ProfilePersonal,
  type ProfileSkill,
  type ProfileSkillInput,
} from '@/domain/profile';

// Profil-Check per KI auf grobe inhaltliche Fehler: Bewertung, Stärken und Korrekturvorschläge,
// ohne Bezug auf eine Stelle (das Zuschneiden auf eine Stellenanzeige ist ein eigenes Feature). Die Edge Function
// `profile-review` (backend/supabase/functions/profile-review) erwartet `ReviewRequest` und liefert
// eine Antwort, die `parseProfileReview` prüft. Vorschläge mit Ersatztext lassen sich einzeln
// übernehmen (`applyRewrite`).

// --- Anfrage ---------------------------------------------------------------------------------

/** Profil, wie es an die KI geht: ohne Name und Kontaktdaten, nur ob sie vorhanden sind */
export type ReviewProfile = {
  headline?: string;
  city?: string;
  summary?: string;
  contact: { address: boolean; phone: boolean; email: boolean; birthDate: boolean };
  experience: ReviewEntry[];
  education: ReviewEntry[];
  skills: { id: string; category?: string; items: string }[];
  languages: { language: string; level?: string }[];
};

type ReviewEntry = {
  id: string;
  title: string;
  organization?: string;
  location?: string;
  description?: string;
  period: string;
};

export type ReviewRequest = { profile: ReviewProfile };

export function reviewRequest(profile: Profile): ReviewRequest {
  const entry = (e: ProfileEntry): ReviewEntry => ({
    id: e.id,
    title: e.title,
    organization: e.organization,
    location: e.location,
    description: e.description,
    period: formatPeriod(e),
  });
  return {
    profile: {
      headline: profile.headline,
      city: profile.city,
      summary: profile.summary,
      contact: {
        address: !!(profile.street || profile.postalCode),
        phone: !!profile.phone,
        email: !!profile.email,
        birthDate: !!profile.birthDate,
      },
      experience: profile.experience.map(entry),
      education: profile.education.map(entry),
      skills: profile.skills.map(({ id, category, items }) => ({ id, category, items })),
      languages: profile.languages.map(({ language, level }) => ({ language, level })),
    },
  };
}

/** Lohnt sich ein Check? Ohne Stationen und Kurzprofil gibt es kaum etwas zu bewerten. */
export function canReview(profile: Profile) {
  return profile.experience.length > 0 || profile.education.length > 0 || !!profile.summary;
}

// --- Antwort ---------------------------------------------------------------------------------

export const REVIEW_AREAS = [
  'personal',
  'summary',
  'experience',
  'education',
  'skills',
  'languages',
  'overall',
] as const;
export type ReviewArea = (typeof REVIEW_AREAS)[number];

export const REVIEW_AREA_LABELS: Record<ReviewArea, string> = {
  personal: 'Persönliche Daten',
  summary: 'Kurzprofil',
  experience: 'Berufserfahrung',
  education: 'Aus- und Weiterbildung',
  skills: 'Kenntnisse',
  languages: 'Sprachen',
  overall: 'Gesamtbild',
};

export const REVIEW_PRIORITIES = ['high', 'medium', 'low'] as const;
export type ReviewPriority = (typeof REVIEW_PRIORITIES)[number];

export const REVIEW_PRIORITY_LABELS: Record<ReviewPriority, string> = {
  high: 'Wichtig',
  medium: 'Empfohlen',
  low: 'Feinschliff',
};

/** Ersatztext, der genau ein Feld des Profils ersetzt */
export type ReviewRewrite =
  | { field: 'headline' | 'summary'; text: string }
  | { field: 'description'; entryId: string; text: string }
  | { field: 'items'; skillId: string; text: string };

export type ReviewSuggestion = {
  area: ReviewArea;
  priority: ReviewPriority;
  title: string;
  detail: string;
  /** Station bzw. Kenntnisgruppe, auf die sich der Vorschlag bezieht */
  targetId?: string;
  rewrite?: ReviewRewrite;
};

export type ProfileReview = {
  /** 0–100 */
  score: number;
  verdict: string;
  strengths: string[];
  suggestions: ReviewSuggestion[];
};

const reviewText = z.string().trim();

const responseSchema = z.object({
  score: z.number(),
  verdict: reviewText.min(1),
  strengths: z.array(reviewText).nullish(),
  suggestions: z
    .array(
      z.object({
        area: z.enum(REVIEW_AREAS).catch('overall'),
        targetId: z.string().nullish(),
        priority: z.enum(REVIEW_PRIORITIES).catch('medium'),
        title: reviewText,
        detail: reviewText,
        rewrite: z
          .object({
            field: z.enum(['headline', 'summary', 'description', 'items']),
            text: reviewText,
          })
          .nullish()
          .catch(null),
      }),
    )
    .nullish(),
});

/**
 * Prüft die Antwort des Checks gegen das aktuelle Profil. Ersatztexte, deren Ziel es nicht gibt
 * oder die nichts ändern, fallen weg; der Vorschlag selbst bleibt. Wirft bei einer Form, die gar
 * nicht passt.
 */
export function parseProfileReview(data: unknown, profile: Profile): ProfileReview {
  const response = responseSchema.parse(data);
  const entries = [...profile.experience, ...profile.education];
  const knownIds = new Set([...entries.map((e) => e.id), ...profile.skills.map((s) => s.id)]);

  const suggestions = (response.suggestions ?? []).flatMap((s): ReviewSuggestion[] => {
    if (!s.title && !s.detail) return [];
    const targetId = s.targetId && knownIds.has(s.targetId) ? s.targetId : undefined;
    const suggestion: ReviewSuggestion = {
      area: s.area,
      priority: s.priority,
      title: s.title || s.detail,
      detail: s.title ? s.detail : '',
      ...(targetId ? { targetId } : {}),
    };
    const rewrite = s.rewrite && toRewrite(s.rewrite.field, s.rewrite.text, targetId);
    if (rewrite && rewriteChanges(profile, rewrite)) suggestion.rewrite = rewrite;
    return [suggestion];
  });

  return {
    score: Math.round(Math.min(100, Math.max(0, response.score))),
    verdict: response.verdict,
    strengths: (response.strengths ?? []).filter(Boolean),
    // Stabil nach Priorität: innerhalb einer Stufe bleibt die Reihenfolge der KI
    suggestions: suggestions
      .map((s, i) => ({ s, i }))
      .sort(
        (a, b) =>
          REVIEW_PRIORITIES.indexOf(a.s.priority) - REVIEW_PRIORITIES.indexOf(b.s.priority) ||
          a.i - b.i,
      )
      .map(({ s }) => s),
  };

  function toRewrite(
    field: 'headline' | 'summary' | 'description' | 'items',
    text: string,
    id: string | undefined,
  ): ReviewRewrite | undefined {
    if (!text) return undefined;
    if (field === 'headline' || field === 'summary') return { field, text };
    if (field === 'description') {
      const lines = normalizeLines(text);
      return id && lines && entries.some((e) => e.id === id)
        ? { field, entryId: id, text: lines }
        : undefined;
    }
    return id && profile.skills.some((s) => s.id === id)
      ? { field, skillId: id, text }
      : undefined;
  }
}

// --- Übernehmen ------------------------------------------------------------------------------

/** Bisheriger Text des Feldes, das der Vorschlag ersetzt */
export function currentRewriteText(profile: Profile, rewrite: ReviewRewrite): string | undefined {
  switch (rewrite.field) {
    case 'headline':
      return profile.headline;
    case 'summary':
      return profile.summary;
    case 'description':
      return findEntry(profile, rewrite.entryId)?.description;
    case 'items':
      return findSkill(profile, rewrite.skillId)?.items;
  }
}

function rewriteChanges(profile: Profile, rewrite: ReviewRewrite) {
  return (currentRewriteText(profile, rewrite) ?? '').trim() !== rewrite.text.trim();
}

/** Bezeichnung des Ziels für die Anzeige, z. B. „Kurzprofil“ oder „Entwickler · Firma“ */
export function rewriteTargetLabel(profile: Profile, rewrite: ReviewRewrite): string {
  switch (rewrite.field) {
    case 'headline':
      return 'Berufsbezeichnung';
    case 'summary':
      return 'Kurzprofil';
    case 'description': {
      const entry = findEntry(profile, rewrite.entryId);
      return entry
        ? `Stichpunkte: ${[entry.title, entry.organization].filter(Boolean).join(' · ')}`
        : 'Stichpunkte';
    }
    case 'items': {
      const skill = findSkill(profile, rewrite.skillId);
      return skill?.category ? `Kenntnisse: ${skill.category}` : 'Kenntnisse';
    }
  }
}

/** Was zum Übernehmen gespeichert wird – je Ziel über die passende Repository-Methode */
export type RewriteChange =
  | { kind: 'personal'; personal: ProfilePersonal }
  | { kind: 'entry'; entry: ProfileEntry; input: ProfileEntryInput }
  | { kind: 'skill'; skill: ProfileSkill; input: ProfileSkillInput };

/** undefined, wenn das Ziel inzwischen fehlt (z. B. Station gelöscht) */
export function applyRewrite(profile: Profile, rewrite: ReviewRewrite): RewriteChange | undefined {
  switch (rewrite.field) {
    case 'headline':
    case 'summary': {
      const {
        onboardedAt: _onboardedAt,
        experience: _experience,
        education: _education,
        skills: _skills,
        languages: _languages,
        ...personal
      } = profile;
      return { kind: 'personal', personal: { ...personal, [rewrite.field]: rewrite.text } };
    }
    case 'description': {
      const entry = findEntry(profile, rewrite.entryId);
      if (!entry) return undefined;
      const { id: _id, kind: _kind, ...input } = entry;
      return { kind: 'entry', entry, input: { ...input, description: rewrite.text } };
    }
    case 'items': {
      const skill = findSkill(profile, rewrite.skillId);
      if (!skill) return undefined;
      const { id: _id, ...input } = skill;
      return { kind: 'skill', skill, input: { ...input, items: rewrite.text } };
    }
  }
}

// --- Selbst bearbeiten -----------------------------------------------------------------------

/** Bearbeiten-Dialog des Profils; ohne Eintrag legt er einen neuen an */
export type ProfileEditTarget =
  | { kind: 'personal' }
  | { kind: 'summary' }
  | { kind: 'entry'; entryKind: ProfileEntryKind; entry?: ProfileEntry }
  | { kind: 'skill'; skill?: ProfileSkill }
  | { kind: 'language'; language?: ProfileLanguage };

/**
 * Wo der Nutzer einen Vorschlag selbst umsetzt: der Ersatztext bzw. die genannte Station oder
 * Kenntnisgruppe, sonst der Abschnitt (bei Stationen, Kenntnissen und Sprachen ein neuer Eintrag).
 * Beim Gesamtbild gibt es kein eindeutiges Ziel.
 */
export function suggestionEditTarget(
  profile: Profile,
  suggestion: ReviewSuggestion,
): ProfileEditTarget | undefined {
  const { rewrite } = suggestion;
  if (rewrite?.field === 'headline') return { kind: 'personal' };
  if (rewrite?.field === 'summary') return { kind: 'summary' };
  const id =
    rewrite?.field === 'description'
      ? rewrite.entryId
      : rewrite?.field === 'items'
        ? rewrite.skillId
        : suggestion.targetId;
  if (id) {
    const entry = findEntry(profile, id);
    if (entry) return { kind: 'entry', entryKind: entry.kind, entry };
    const skill = findSkill(profile, id);
    if (skill) return { kind: 'skill', skill };
  }
  switch (suggestion.area) {
    case 'personal':
      return { kind: 'personal' };
    case 'summary':
      return { kind: 'summary' };
    case 'experience':
    case 'education':
      return { kind: 'entry', entryKind: suggestion.area };
    case 'skills':
      return { kind: 'skill' };
    case 'languages':
      return { kind: 'language' };
    case 'overall':
      return undefined;
  }
}

/** Beschriftung des Knopfs, z. B. „Station bearbeiten“ oder „Sprache hinzufügen“ */
export function editTargetLabel(target: ProfileEditTarget): string {
  switch (target.kind) {
    case 'personal':
      return 'Persönliche Daten bearbeiten';
    case 'summary':
      return 'Kurzprofil bearbeiten';
    case 'entry': {
      const noun = target.entryKind === 'experience' ? 'Station' : 'Ausbildung';
      return target.entry ? `${noun} bearbeiten` : `${noun} hinzufügen`;
    }
    case 'skill':
      return target.skill ? 'Kenntnisse bearbeiten' : 'Kenntnisse hinzufügen';
    case 'language':
      return target.language ? 'Sprache bearbeiten' : 'Sprache hinzufügen';
  }
}

function findEntry(profile: Profile, id: string) {
  return [...profile.experience, ...profile.education].find((e) => e.id === id);
}

function findSkill(profile: Profile, id: string) {
  return profile.skills.find((s) => s.id === id);
}

/** Einordnung der Punktzahl in Worten */
export function scoreLabel(score: number): string {
  if (score >= 90) return 'Bewerbungsreif';
  if (score >= 70) return 'Solide';
  if (score >= 50) return 'Ausbaufähig';
  return 'Lückenhaft';
}
