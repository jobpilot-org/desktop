import type { Profile } from '@/domain/profile';
import {
  applyRewrite,
  canReview,
  currentRewriteText,
  editTargetLabel,
  parseProfileReview,
  reviewRequest,
  rewriteTargetLabel,
  scoreLabel,
  suggestionEditTarget,
  type ReviewSuggestion,
} from '@/domain/profile-review';

const profile: Profile = {
  firstName: 'Erika',
  lastName: 'Muster',
  headline: 'Entwicklerin',
  street: 'Hauptstr. 1',
  postalCode: '10115',
  city: 'Berlin',
  phone: '030 123',
  email: 'erika@example.org',
  birthDate: '1990-01-01',
  birthPlace: 'Hamburg',
  summary: 'Ich programmiere.',
  onboardedAt: '2026-11-20T10:00:00.000Z',
  experience: [
    {
      id: 'e1',
      kind: 'experience',
      title: 'Frontend-Entwicklerin',
      organization: 'Acme',
      description: 'Webseiten gebaut',
      startDate: '2023-05',
      isCurrent: true,
    },
  ],
  education: [
    {
      id: 'b1',
      kind: 'education',
      title: 'B.Sc. Informatik',
      organization: 'TU Berlin',
      startDate: '2015',
      endDate: '2019',
      isCurrent: false,
    },
  ],
  skills: [{ id: 's1', category: 'Sprachen', items: 'TS, JS' }],
  languages: [{ id: 'l1', language: 'Englisch', level: 'C1' }],
};

describe('reviewRequest', () => {
  it('schickt keine Kontaktdaten, nur ob sie vorhanden sind', () => {
    const request = reviewRequest(profile);
    const json = JSON.stringify(request);
    for (const secret of ['Erika', 'Muster', 'Hauptstr', '10115', '030 123', 'erika@', '1990', 'Hamburg']) {
      expect(json).not.toContain(secret);
    }
    expect(request).not.toHaveProperty('targetRole');
    expect(request.profile.contact).toEqual({
      address: true,
      phone: true,
      email: true,
      birthDate: true,
    });
    expect(request.profile.city).toBe('Berlin');
    expect(request.profile.experience[0]).toMatchObject({ id: 'e1', period: 'seit 05/2023' });
    expect(request.profile.skills[0]).toEqual({ id: 's1', category: 'Sprachen', items: 'TS, JS' });
  });

});

describe('canReview', () => {
  it('braucht Stationen oder ein Kurzprofil', () => {
    expect(canReview(profile)).toBe(true);
    expect(
      canReview({ ...profile, summary: undefined, experience: [], education: [] }),
    ).toBe(false);
  });
});

describe('parseProfileReview', () => {
  const suggestion = (overrides: Record<string, unknown>) => ({
    area: 'experience',
    targetId: null,
    priority: 'medium',
    title: 'Titel',
    detail: 'Detail',
    rewrite: null,
    ...overrides,
  });

  it('übernimmt gültige Ersatztexte und sortiert nach Priorität', () => {
    const review = parseProfileReview(
      {
        score: 72.4,
        verdict: 'Solide.',
        strengths: ['Klarer Werdegang', ''],
        suggestions: [
          suggestion({ priority: 'low', title: 'Klein' }),
          suggestion({
            priority: 'high',
            targetId: 'e1',
            rewrite: { field: 'description', text: '• Shop mit React gebaut\n\n– Ladezeit halbiert' },
          }),
          suggestion({ area: 'summary', rewrite: { field: 'summary', text: 'Neues Kurzprofil' } }),
        ],
      },
      profile,
    );
    expect(review.score).toBe(72);
    expect(review.strengths).toEqual(['Klarer Werdegang']);
    expect(review.suggestions.map((s) => s.priority)).toEqual(['high', 'medium', 'low']);
    expect(review.suggestions[0]!.rewrite).toEqual({
      field: 'description',
      entryId: 'e1',
      text: 'Shop mit React gebaut\nLadezeit halbiert',
    });
    expect(review.suggestions[1]!.rewrite).toEqual({ field: 'summary', text: 'Neues Kurzprofil' });
  });

  it('verwirft Ersatztexte ohne passendes Ziel oder ohne Änderung, behält den Vorschlag', () => {
    const review = parseProfileReview(
      {
        score: 140,
        verdict: 'Gut.',
        suggestions: [
          suggestion({ targetId: 'gibt-es-nicht', rewrite: { field: 'description', text: 'x' } }),
          suggestion({ targetId: 'e1', rewrite: { field: 'items', text: 'x' } }),
          suggestion({ rewrite: { field: 'headline', text: 'Entwicklerin' } }),
          suggestion({ area: 'unbekannt', priority: 'egal' }),
        ],
      },
      profile,
    );
    expect(review.score).toBe(100);
    expect(review.suggestions).toHaveLength(4);
    expect(review.suggestions.every((s) => s.rewrite === undefined)).toBe(true);
    expect(review.suggestions[0]!.targetId).toBeUndefined();
    expect(review.suggestions[3]).toMatchObject({ area: 'overall', priority: 'medium' });
  });

  it('wirft bei einer Antwort ohne Bewertung', () => {
    expect(() => parseProfileReview({ verdict: 'x' }, profile)).toThrow();
    expect(() => parseProfileReview(null, profile)).toThrow();
  });
});

describe('applyRewrite', () => {
  it('ersetzt Kopfdaten und behält alle übrigen', () => {
    const change = applyRewrite(profile, { field: 'headline', text: 'Senior-Entwicklerin' });
    expect(change).toEqual({
      kind: 'personal',
      personal: expect.objectContaining({
        headline: 'Senior-Entwicklerin',
        firstName: 'Erika',
        summary: 'Ich programmiere.',
        birthDate: '1990-01-01',
      }),
    });
    expect(change?.kind === 'personal' && 'experience' in change.personal).toBe(false);
    expect(change?.kind === 'personal' && 'onboardedAt' in change.personal).toBe(false);
  });

  it('ersetzt die Stichpunkte einer Station', () => {
    const change = applyRewrite(profile, { field: 'description', entryId: 'b1', text: 'Neu' });
    expect(change).toEqual({
      kind: 'entry',
      entry: profile.education[0],
      input: {
        title: 'B.Sc. Informatik',
        organization: 'TU Berlin',
        startDate: '2015',
        endDate: '2019',
        isCurrent: false,
        description: 'Neu',
      },
    });
  });

  it('ersetzt die Kenntnisse einer Gruppe', () => {
    expect(applyRewrite(profile, { field: 'items', skillId: 's1', text: 'TypeScript' })).toEqual({
      kind: 'skill',
      skill: profile.skills[0],
      input: { category: 'Sprachen', items: 'TypeScript' },
    });
  });

  it('liefert nichts, wenn das Ziel fehlt', () => {
    expect(applyRewrite(profile, { field: 'items', skillId: 'weg', text: 'x' })).toBeUndefined();
  });
});

describe('Anzeige', () => {
  it('zeigt bisherigen Text und Ziel', () => {
    const rewrite = { field: 'description' as const, entryId: 'e1', text: 'x' };
    expect(currentRewriteText(profile, rewrite)).toBe('Webseiten gebaut');
    expect(rewriteTargetLabel(profile, rewrite)).toBe('Stichpunkte: Frontend-Entwicklerin · Acme');
    expect(rewriteTargetLabel(profile, { field: 'items', skillId: 's1', text: 'x' })).toBe(
      'Kenntnisse: Sprachen',
    );
  });

  it('ordnet die Punktzahl ein', () => {
    expect(scoreLabel(95)).toBe('Bewerbungsreif');
    expect(scoreLabel(70)).toBe('Solide');
    expect(scoreLabel(55)).toBe('Ausbaufähig');
    expect(scoreLabel(10)).toBe('Lückenhaft');
  });
});

describe('suggestionEditTarget', () => {
  const base: ReviewSuggestion = {
    area: 'overall',
    priority: 'medium',
    title: 'Titel',
    detail: 'Detail',
  };

  it('öffnet die genannte Station bzw. Kenntnisgruppe', () => {
    expect(suggestionEditTarget(profile, { ...base, area: 'education', targetId: 'b1' })).toEqual({
      kind: 'entry',
      entryKind: 'education',
      entry: profile.education[0],
    });
    expect(suggestionEditTarget(profile, { ...base, area: 'skills', targetId: 's1' })).toEqual({
      kind: 'skill',
      skill: profile.skills[0],
    });
  });

  it('folgt dem Ersatztext', () => {
    expect(
      suggestionEditTarget(profile, {
        ...base,
        area: 'overall',
        rewrite: { field: 'description', entryId: 'e1', text: 'x' },
      }),
    ).toMatchObject({ kind: 'entry', entry: { id: 'e1' } });
    expect(
      suggestionEditTarget(profile, { ...base, rewrite: { field: 'headline', text: 'x' } }),
    ).toEqual({ kind: 'personal' });
  });

  it('nimmt sonst den Abschnitt, bei Listen einen neuen Eintrag', () => {
    expect(suggestionEditTarget(profile, { ...base, area: 'summary' })).toEqual({ kind: 'summary' });
    expect(suggestionEditTarget(profile, { ...base, area: 'experience' })).toEqual({
      kind: 'entry',
      entryKind: 'experience',
    });
    expect(suggestionEditTarget(profile, { ...base, area: 'languages' })).toEqual({
      kind: 'language',
    });
    expect(suggestionEditTarget(profile, base)).toBeUndefined();
  });

  it('beschriftet den Knopf', () => {
    expect(editTargetLabel({ kind: 'entry', entryKind: 'education', entry: profile.education[0] })).toBe(
      'Ausbildung bearbeiten',
    );
    expect(editTargetLabel({ kind: 'entry', entryKind: 'experience' })).toBe('Station hinzufügen');
    expect(editTargetLabel({ kind: 'summary' })).toBe('Kurzprofil bearbeiten');
    expect(editTargetLabel({ kind: 'language' })).toBe('Sprache hinzufügen');
  });
});
