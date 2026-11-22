import {
  countByPostingFilter,
  matchesPostingFilter,
  postingState,
  postingToApplicationForm,
  type JobPosting,
} from '@/domain/job-postings';

const posting: JobPosting = {
  id: 'p1',
  company: 'FLH Media Digital',
  role: 'Senior Software & App Engineer (m/w/d)',
  location: 'Ismaning',
  workMode: 'hybrid',
  salaryMin: 75000,
  source: 'Indeed',
  jobUrl: 'https://de.indeed.com/viewjob?jk=abc',
  jobDescription: 'Kurzbeschreibung der Stelle …',
  contactName: 'Frau Muster',
  createdAt: '2026-11-22T08:00:00.000Z',
};

describe('postingState', () => {
  it('ist offen, beworben oder verworfen', () => {
    expect(postingState(posting, new Set())).toBe('open');
    expect(postingState({ ...posting, applicationId: 'a1' }, new Set(['a1']))).toBe('applied');
    expect(postingState({ ...posting, dismissedAt: '2026-11-22T09:00:00.000Z' }, new Set())).toBe(
      'dismissed',
    );
  });

  it('zählt eine gelöschte Bewerbung nicht als beworben', () => {
    expect(postingState({ ...posting, applicationId: 'weg' }, new Set(['a1']))).toBe('open');
  });

  it('filtert und zählt', () => {
    expect(matchesPostingFilter('open', 'all')).toBe(true);
    expect(matchesPostingFilter('applied', 'open')).toBe(false);
    expect(countByPostingFilter(['open', 'open', 'applied', 'dismissed'])).toEqual({
      open: 2,
      applied: 1,
      dismissed: 1,
      all: 4,
    });
  });
});

describe('postingToApplicationForm', () => {
  it('übernimmt Eckdaten und Anzeigentext, Status „Beworben“ ab heute', () => {
    expect(postingToApplicationForm(posting, '2026-11-22')).toEqual({
      company: 'FLH Media Digital',
      role: 'Senior Software & App Engineer (m/w/d)',
      location: 'Ismaning',
      workMode: 'hybrid',
      appliedAt: '2026-11-22',
      status: 'applied',
      priority: 'normal',
      source: 'Indeed',
      jobUrl: 'https://de.indeed.com/viewjob?jk=abc',
      salaryMin: '75.000',
      salaryMax: '',
      nextStep: '',
      jobDescription: 'Kurzbeschreibung der Stelle …',
    });
  });
});
