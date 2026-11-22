import {
  companySearchUrl,
  countByPostingFilter,
  sourceDifferences,
  sourceName,
  type JobPostingSource,
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

describe('Quellen', () => {
  const portal: JobPostingSource = {
    id: 's1',
    postingId: 'p1',
    kind: 'portal',
    source: 'Indeed',
    company: 'Simple First Consulting GmbH',
    role: 'Spezialist KI-Automatisierung & Workflows (m/w/d)',
    location: 'Homeoffice',
    salaryMin: 57000,
    salaryMax: 75000,
    capturedAt: '2026-11-22T08:00:00.000Z',
  };
  const company: JobPostingSource = {
    id: 's2',
    postingId: 'p1',
    kind: 'company',
    source: 'simple-first.de',
    company: 'Simple First',
    role: 'KI- & Digitalisierungsberater - Steuerkanzleien (w/m/d)',
    salaryMin: 54000,
    salaryMax: 72000,
    capturedAt: '2026-11-22T09:00:00.000Z',
  };

  it('nennt Abweichungen zwischen Portal und Firmenseite', () => {
    expect(sourceDifferences([company, portal])).toEqual([
      {
        field: 'Position',
        values: [
          { source: 'Firmenseite', value: company.role },
          { source: 'Indeed', value: portal.role },
        ],
      },
      {
        field: 'Gehalt',
        values: [
          { source: 'Firmenseite', value: expect.stringContaining('54') },
          { source: 'Indeed', value: expect.stringContaining('57') },
        ],
      },
    ]);
  });

  it('meldet nichts bei gleichen oder fehlenden Angaben und nur einer Quelle', () => {
    expect(sourceDifferences([portal])).toEqual([]);
    expect(
      sourceDifferences([portal, { ...portal, id: 's3', kind: 'company', company: 'Simple First', role: 'Spezialist KI-Automatisierung & Workflows (w/m/d)', location: undefined }]),
    ).toEqual([]);
    expect(sourceName(portal)).toBe('Indeed');
    expect(sourceName(company)).toBe('Firmenseite');
  });

  it('baut die Suche nach der Firmenseite', () => {
    const url = companySearchUrl({
      company: 'Simple First Consulting GmbH',
      role: 'Spezialist KI-Automatisierung & Workflows (m/w/d)',
    });
    expect(decodeURIComponent(url)).toBe(
      'https://www.google.com/search?q="Simple First Consulting" Karriere Spezialist KI-Automatisierung & Workflows',
    );
  });
});
