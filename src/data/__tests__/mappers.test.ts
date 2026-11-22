import type { ApplicationInput } from '@/domain/application';

import {
  toApplicationColumns,
  toDocument,
  toJobPosting,
  toJobPostingColumns,
  toIsoTimestamp,
  toJobApplication,
  toReminder,
  type ApplicationRow,
} from '../mappers';

const row: ApplicationRow = {
  id: 'app-1',
  user_id: '11111111-1111-1111-1111-111111111111',
  company: 'Acme',
  role: 'Entwicklerin',
  location: 'Berlin',
  work_mode: 'hybrid',
  applied_at: '2026-11-01',
  status: 'interview',
  priority: 'high',
  source: null,
  job_url: null,
  salary_min: 60000,
  salary_max: null,
  next_step: null,
  job_description: null,
  created_at: '2026-11-01T08:00:00+00:00',
  updated_at: '2026-11-02T08:00:00+00:00',
  archived_at: null,
};

describe('toIsoTimestamp', () => {
  it('wandelt das Postgres-Format in das ISO-Format der Domain um', () => {
    expect(toIsoTimestamp('2026-11-19T17:16:22.36+00:00')).toBe(
      '2026-11-19T17:16:22.360Z',
    );
    expect(toIsoTimestamp('2026-11-25T10:00:00+01:00')).toBe(
      '2026-11-25T09:00:00.000Z',
    );
  });
});

describe('toJobApplication', () => {
  it('übernimmt die Felder und lässt Datenbankspalten weg', () => {
    const application = toJobApplication(row);
    expect(application).toMatchObject({
      id: 'app-1',
      workMode: 'hybrid',
      appliedAt: '2026-11-01',
      status: 'interview',
      salaryMin: 60000,
    });
    expect(application.salaryMax).toBeUndefined();
    expect(application).not.toHaveProperty('user_id');
    expect(application).not.toHaveProperty('archived_at');
  });

  it('ergibt zusammen mit toApplicationColumns wieder die Eingabe', () => {
    const { id: _id, ...input } = toJobApplication(row);
    expect(
      toJobApplication({ ...row, ...toApplicationColumns(input) }),
    ).toEqual(toJobApplication(row));
  });
});

describe('toApplicationColumns', () => {
  it('leert fehlende optionale Felder ausdrücklich', () => {
    const input: ApplicationInput = {
      company: 'Acme',
      role: 'Dev',
      location: 'Berlin',
      appliedAt: '2026-11-01',
      status: 'applied',
      priority: 'normal',
    };
    expect(toApplicationColumns(input)).toMatchObject({
      work_mode: null,
      source: null,
      salary_min: null,
      job_description: null,
    });
  });
});

describe('toReminder', () => {
  it('normalisiert alle Zeitpunkte', () => {
    expect(
      toReminder({
        user_id: row.user_id,
        key: 'follow-up:app-1:x',
        application_id: 'app-1',
        kind: 'follow-up',
        due_at: '2026-11-11T08:00:00+00:00',
        title: 'Nachhaken',
        body: '',
        done_at: null,
        snoozed_until: '2026-11-14T08:00:00+00:00',
        created_at: '2026-11-01T08:00:00+00:00',
      }),
    ).toMatchObject({
      dueAt: '2026-11-11T08:00:00.000Z',
      doneAt: undefined,
      snoozedUntil: '2026-11-14T08:00:00.000Z',
    });
  });
});

describe('toDocument', () => {
  it('wandelt Spalten und Zeitstempel um, ohne Station undefined', () => {
    expect(
      toDocument({
        id: 'd1',
        user_id: '11111111-1111-1111-1111-111111111111',
        kind: 'reference',
        title: 'Arbeitszeugnis Increon',
        file_name: 'Zeugnis.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1200,
        storage_path: '11111111-1111-1111-1111-111111111111/d1/zeugnis.pdf',
        profile_entry_id: null,
        created_at: '2026-11-21T08:00:00+00:00',
        updated_at: '2026-11-21T08:00:00+00:00',
      }),
    ).toEqual({
      id: 'd1',
      kind: 'reference',
      title: 'Arbeitszeugnis Increon',
      fileName: 'Zeugnis.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1200,
      storagePath: '11111111-1111-1111-1111-111111111111/d1/zeugnis.pdf',
      profileEntryId: undefined,
      createdAt: '2026-11-21T08:00:00.000Z',
    });
  });
});

describe('toJobPosting', () => {
  it('wandelt Spalten um, leere Felder werden undefined', () => {
    expect(
      toJobPosting({
        id: 'p1',
        user_id: '11111111-1111-1111-1111-111111111111',
        company: 'Acme',
        role: 'Dev',
        location: '',
        work_mode: 'remote',
        salary_min: 60000,
        salary_max: null,
        source: 'Indeed',
        job_url: 'https://de.indeed.com/viewjob?jk=abc',
        job_description: null,
        contact_name: 'Frau Muster',
        contact_email: null,
        application_id: null,
        dismissed_at: '2026-11-22T09:00:00+00:00',
        created_at: '2026-11-22T08:00:00+00:00',
        updated_at: '2026-11-22T08:00:00+00:00',
        fit_score: null,
        fit_result: null,
        fit_profile_hash: null,
        fit_posting_hash: null,
        fit_model: null,
        fit_at: null,
      }),
    ).toEqual({
      id: 'p1',
      company: 'Acme',
      role: 'Dev',
      location: '',
      workMode: 'remote',
      salaryMin: 60000,
      salaryMax: undefined,
      source: 'Indeed',
      jobUrl: 'https://de.indeed.com/viewjob?jk=abc',
      jobDescription: undefined,
      contactName: 'Frau Muster',
      contactEmail: undefined,
      applicationId: undefined,
      dismissedAt: '2026-11-22T09:00:00.000Z',
      createdAt: '2026-11-22T08:00:00.000Z',
      fit: undefined,
      fitProfileHash: undefined,
      fitPostingHash: undefined,
      fitAt: undefined,
    });
  });
});

describe('toJobPostingColumns', () => {
  it('ergibt nach dem Zurücklesen wieder dasselbe Stellenangebot', () => {
    const posting = {
      id: 'p1',
      company: 'Acme',
      role: 'Dev',
      location: 'Berlin',
      workMode: 'hybrid' as const,
      salaryMin: 60000,
      source: 'Indeed',
      jobUrl: 'https://a.de/job',
      contactName: 'Frau Muster',
      applicationId: 'a1',
      createdAt: '2026-11-22T08:00:00.000Z',
      fit: {
        score: 81,
        level: 'hoch' as const,
        summary: 'Passt.',
        pros: ['React'],
        cons: [],
        prognosis: { chance: 'mittel' as const, text: 'Gut.' },
        emphasize: [],
      },
      fitProfileHash: 'p1',
      fitPostingHash: 'j1',
      fitAt: '2026-11-22T09:00:00.000Z',
    };
    const columns = toJobPostingColumns(posting);
    expect(
      toJobPosting({
        ...columns,
        user_id: '11111111-1111-1111-1111-111111111111',
        updated_at: columns.created_at,
        fit_model: 'claude-opus-5-5',
      }),
    ).toEqual({
      ...posting,
      salaryMax: undefined,
      jobDescription: undefined,
      contactEmail: undefined,
      dismissedAt: undefined,
    });
  });
});
