import {
  fitBlocker,
  fitRequest,
  fitStatus,
  hashText,
  parseFit,
  postingHash,
  profileHash,
  type FitPosting,
} from '@/domain/job-fit';
import type { Profile } from '@/domain/profile';

const profile: Profile = {
  firstName: 'Erika',
  lastName: 'Muster',
  headline: 'Fullstack-Entwicklerin',
  email: 'erika@example.org',
  phone: '030 123',
  experience: [
    {
      id: 'e1',
      kind: 'experience',
      title: 'Senior Entwicklerin',
      organization: 'Acme',
      startDate: '2020',
      isCurrent: true,
      description: 'React, TypeScript, Supabase',
    },
  ],
  education: [],
  skills: [{ id: 's1', category: 'Frontend', items: 'React, TypeScript' }],
  languages: [],
};

const posting: FitPosting = {
  company: 'FLH Media Digital',
  role: 'Senior Software & App Engineer (m/w/d)',
  location: 'Ismaning',
  jobDescription:
    'Wir suchen eine Senior-Entwicklerin mit TypeScript, React und React Native (Expo) für Web- und Mobile-Anwendungen.',
};

describe('fitRequest', () => {
  it('schickt das Profil ohne Name und Kontaktdaten und die Eckdaten der Anzeige', () => {
    const request = fitRequest(profile, posting);
    const json = JSON.stringify(request);
    for (const secret of ['Erika', 'Muster', 'erika@', '030 123']) expect(json).not.toContain(secret);
    expect(request.posting).toEqual({
      company: 'FLH Media Digital',
      role: 'Senior Software & App Engineer (m/w/d)',
      location: 'Ismaning',
      description: posting.jobDescription,
    });
    expect(request.profile.experience[0]).toMatchObject({ title: 'Senior Entwicklerin' });
  });
});

describe('fitBlocker', () => {
  it('braucht ein gefülltes Profil und einen Anzeigentext', () => {
    expect(fitBlocker(profile, posting)).toBeUndefined();
    expect(fitBlocker(undefined, posting)).toMatch(/Profil/);
    expect(fitBlocker({ ...profile, experience: [], summary: undefined }, posting)).toMatch(/Profil/);
    expect(fitBlocker(profile, { ...posting, jobDescription: 'kurz' })).toMatch(/Anzeigentext/);
  });
});

describe('Hashes und Status', () => {
  it('hasht stabil und unterscheidet Änderungen', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });

  it('ändert den Profil-Hash nicht beim Namen, aber bei Stationen', () => {
    expect(profileHash({ ...profile, firstName: 'Anna' })).toBe(profileHash(profile));
    expect(profileHash({ ...profile, headline: 'Backend-Entwicklerin' })).not.toBe(profileHash(profile));
  });

  it('erkennt veraltete Bewertungen', () => {
    const fit = parseFit({ score: 80 });
    const stored = {
      ...posting,
      fit,
      fitProfileHash: profileHash(profile),
      fitPostingHash: postingHash(posting),
    };
    expect(fitStatus(posting, profile)).toBe('none');
    expect(fitStatus(stored, profile)).toBe('current');
    expect(fitStatus(stored, { ...profile, summary: 'Neu' })).toBe('outdated');
    expect(fitStatus({ ...stored, jobDescription: 'Anderer Text' }, profile)).toBe('outdated');
    expect(fitStatus(stored, undefined)).toBe('current');
  });
});

describe('parseFit', () => {
  it('übernimmt eine vollständige Antwort und begrenzt Listen', () => {
    expect(
      parseFit({
        score: 83.6,
        level: 'hoch',
        summary: ' Passt gut. ',
        pros: ['React', ' ', 'TypeScript', 'a', 'b', 'c', 'd', 'e'],
        cons: ['Kein React Native belegt'],
        prognosis: { chance: 'mittel', text: 'Solide Chancen.' },
        emphasize: ['Supabase'],
      }),
    ).toEqual({
      score: 84,
      level: 'hoch',
      summary: 'Passt gut.',
      pros: ['React', 'TypeScript', 'a', 'b', 'c', 'd'],
      cons: ['Kein React Native belegt'],
      prognosis: { chance: 'mittel', text: 'Solide Chancen.' },
      emphasize: ['Supabase'],
    });
  });

  it('ergänzt fehlende Felder und klemmt den Score', () => {
    expect(parseFit({ score: 140, level: 'super' })).toMatchObject({
      score: 100,
      level: 'hoch',
      pros: [],
      prognosis: { chance: 'hoch', text: '' },
    });
    expect(parseFit({ score: 30 }).level).toBe('gering');
    expect(() => parseFit({ level: 'hoch' })).toThrow();
    expect(() => parseFit(null)).toThrow();
  });
});
