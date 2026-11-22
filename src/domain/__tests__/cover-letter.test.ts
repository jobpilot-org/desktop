import {
  emptyLetter,
  letterRequest,
  letterText,
  orderSections,
  parseDraft,
  parseSectionText,
  salutationOptions,
  suggestedStrengths,
  TEAM_SALUTATION,
  type CoverLetterInput,
} from '@/domain/cover-letter';
import type { Profile } from '@/domain/profile';

const profile: Profile = {
  firstName: 'Erika',
  lastName: 'Muster',
  street: 'Hauptstr. 1',
  postalCode: '10115',
  city: 'Berlin',
  phone: '030 123',
  email: 'erika@example.org',
  headline: 'Fullstack-Entwicklerin',
  experience: [
    { id: 'e1', kind: 'experience', title: 'Senior Entwicklerin', organization: 'Acme', isCurrent: true },
  ],
  education: [],
  volunteering: [],
  skills: [],
  languages: [],
  links: [],
};

const posting = {
  company: 'Simple First',
  role: 'KI- & Digitalisierungsberater (m/w/d)',
  location: 'Remote',
  jobDescription: 'Du führst KI-Projekte bei Kanzleien …',
  contactName: 'Julia Illgner',
  fit: {
    score: 70,
    level: 'hoch' as const,
    summary: '',
    pros: ['Erfahrung mit Automatisierung', 'Workshops moderieren'],
    cons: [],
    prognosis: { chance: 'mittel' as const, text: '' },
    emphasize: ['Workshops moderieren', 'Kundenprojekte eigenverantwortlich'],
  },
};

describe('Ansprache', () => {
  it('schlägt Anreden vor, ohne Frau/Herr aus dem Vornamen abzuleiten', () => {
    expect(salutationOptions(posting).map((o) => o.value)).toEqual([
      'Sehr geehrte Frau Illgner,',
      'Sehr geehrter Herr Illgner,',
      'Guten Tag Julia Illgner,',
      TEAM_SALUTATION,
      'Liebes Team von Simple First,',
    ]);
  });

  it('übernimmt Frau/Herr aus der Angabe und kommt ohne Ansprechperson aus', () => {
    expect(salutationOptions({ company: 'Acme', contactName: 'Frau  Muster' })[0]!.value).toBe(
      'Sehr geehrte Frau Muster,',
    );
    expect(salutationOptions({ company: 'Acme', contactName: 'Herr Dr. Beispiel' })[0]!.value).toBe(
      'Sehr geehrter Herr Dr. Beispiel,',
    );
    expect(salutationOptions({ company: 'Acme' })[0]!.value).toBe(TEAM_SALUTATION);
  });
});

describe('Vorgaben', () => {
  it('schlägt Stärken aus der Passung vor, ohne Doppelte', () => {
    expect(suggestedStrengths(posting)).toEqual([
      'Workshops moderieren',
      'Kundenprojekte eigenverantwortlich',
      'Erfahrung mit Automatisierung',
    ]);
    expect(suggestedStrengths({})).toEqual([]);
  });

  it('legt ein neues Anschreiben mit sinnvollen Vorgaben an', () => {
    expect(emptyLetter({ postingId: 'p1' }, posting)).toEqual({
      postingId: 'p1',
      salutation: 'Sehr geehrte Frau Illgner,',
      tone: 'modern',
      length: 'medium',
      strengths: [
        'Workshops moderieren',
        'Kundenprojekte eigenverantwortlich',
        'Erfahrung mit Automatisierung',
      ],
      subject: 'Bewerbung als KI- & Digitalisierungsberater (m/w/d)',
      sections: orderSections([]),
      closing: 'Mit freundlichen Grüßen',
    });
  });
});

describe('Anfrage und Antwort', () => {
  const letter: CoverLetterInput = {
    ...emptyLetter({ postingId: 'p1' }, posting),
    sections: orderSections([{ key: 'intro', text: 'Einstieg' }]),
  };

  it('schickt keine Kontaktdaten und beim Abschnitt nur den nötigen Zusammenhang', () => {
    const draft = letterRequest(profile, posting, letter);
    const json = JSON.stringify(draft);
    for (const secret of ['Erika', 'Muster', 'Hauptstr', '030 123', 'erika@']) {
      expect(json).not.toContain(secret);
    }
    expect(draft).toMatchObject({ mode: 'draft', tone: 'modern', posting: { company: 'Simple First' } });
    expect(draft).not.toHaveProperty('section');

    const section = letterRequest(profile, posting, letter, { key: 'fit', hint: ' kürzer ' });
    expect(section).toMatchObject({
      mode: 'section',
      section: 'fit',
      hint: 'kürzer',
      sections: [{ key: 'intro', text: 'Einstieg' }],
    });
  });

  it('prüft Entwurf und Abschnitt', () => {
    expect(
      parseDraft({
        subject: ' Bewerbung ',
        sections: [
          { key: 'closing', text: 'Schluss' },
          { key: 'intro', text: ' Einstieg ' },
          { key: 'quatsch', text: 'x' },
        ],
      }),
    ).toEqual({
      subject: 'Bewerbung',
      sections: [
        { key: 'intro', text: 'Einstieg' },
        { key: 'fit', text: '' },
        { key: 'strengths', text: '' },
        { key: 'motivation', text: '' },
        { key: 'closing', text: 'Schluss' },
      ],
    });
    expect(() => parseDraft({ sections: [] })).toThrow();
    expect(() => parseDraft(null)).toThrow();
    expect(parseSectionText({ text: ' Neu ' })).toBe('Neu');
    expect(() => parseSectionText({ text: '' })).toThrow();
  });
});

describe('letterText', () => {
  it('setzt Absender, Empfänger, Datum, Betreff, Anrede, Text und Gruß zusammen', () => {
    const text = letterText(
      {
        salutation: 'Sehr geehrte Frau Illgner,',
        subject: 'Bewerbung als Berater',
        sections: orderSections([
          { key: 'intro', text: 'Erster Absatz.' },
          { key: 'closing', text: 'Ich freue mich auf ein Gespräch.' },
        ]),
        closing: 'Mit freundlichen Grüßen',
      },
      profile,
      posting,
      new Date(2026, 10, 22),
    );
    expect(text).toBe(
      [
        'Erika Muster\nHauptstr. 1\n10115 Berlin\n030 123\nerika@example.org',
        'Simple First\nJulia Illgner',
        'Berlin, 22. November 2026',
        'Bewerbung als Berater',
        'Sehr geehrte Frau Illgner,\n\nErster Absatz.\n\nIch freue mich auf ein Gespräch.',
        'Mit freundlichen Grüßen\n\nErika Muster',
      ].join('\n\n'),
    );
  });
});
