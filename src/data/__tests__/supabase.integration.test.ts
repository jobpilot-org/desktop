import { profileToInput } from '@/domain/profile';

import { createRepositories } from '../index';
import { createSupabase } from '../supabase';

// Prüft die Repositories gegen die lokale Supabase aus ../backend – echtes SQL, echte RLS.
// Voraussetzung: `supabase start` in ../backend und das lokale Testkonto (siehe README).
// Start: `npm run test:integration`
const enabled = process.env.SUPABASE_INTEGRATION === '1';

describe.runIf(enabled)('Repositories gegen lokale Supabase', () => {
  const supabase = createSupabase({ auth: { persistSession: false } });
  const repos = createRepositories(supabase);
  let id: string;

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.SUPABASE_TEST_EMAIL ?? 'test@jobpilot.local',
      password: process.env.SUPABASE_TEST_PASSWORD ?? 'jobpilot-test',
    });
    if (error) throw error;
  });

  afterAll(async () => {
    // Kaskade entfernt Ereignisse, Kontakte, Notizen, Termine und Erinnerungen mit
    if (id) await supabase.from('applications').delete().eq('id', id);
    await supabase.auth.signOut();
  });

  it('legt an, ändert den Status und protokolliert den Verlauf', async () => {
    const created = await repos.applications.create({
      company: 'Desktop-Test GmbH',
      role: 'Integrationstest',
      location: 'Berlin',
      appliedAt: '2026-11-01',
      status: 'applied',
      priority: 'normal',
    });
    id = created.id;

    expect(await repos.applications.get(id)).toMatchObject({
      company: 'Desktop-Test GmbH',
      status: 'applied',
    });
    expect(await repos.applications.changeStatus(id, 'interview')).toBe(true);
    expect(await repos.applications.changeStatus(id, 'interview')).toBe(false);

    const events = await repos.applications.statusEvents(id);
    expect(events.map((event) => [event.from, event.to])).toEqual([
      [null, 'applied'],
      ['applied', 'interview'],
    ]);
    expect(events[0].at).toMatch(/Z$/);

    const history = (await repos.applications.histories()).find(
      (entry) => entry.application.id === id,
    );
    expect(history?.events).toHaveLength(2);
  });

  it('speichert Notizen, Kontakte und Termine', async () => {
    await repos.details.addNote(id, '  Erste Notiz  ');
    await repos.details.saveContact(id, { name: 'Ada', email: 'ada@x.de' });
    const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    startsAt.setMilliseconds(0);
    await repos.details.saveAppointment(id, {
      kind: 'video',
      startsAt: startsAt.toISOString(),
    });

    expect((await repos.details.notes(id))[0].body).toBe('Erste Notiz');
    expect((await repos.details.contacts(id))[0]).toMatchObject({
      name: 'Ada',
      email: 'ada@x.de',
    });
    const upcoming = await repos.details.upcomingAppointments(
      new Date(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
    expect(upcoming.find((a) => a.applicationId === id)).toMatchObject({
      company: 'Desktop-Test GmbH',
      startsAt: startsAt.toISOString(),
    });
  });

  it('gleicht Erinnerungen ab und bleibt danach stabil', async () => {
    await repos.reminders.reconcile();
    expect(await repos.reminders.reconcile()).toBe(false);

    const reminders = await repos.reminders.forApplication(id);
    expect(reminders.map((r) => r.kind)).toEqual(
      expect.arrayContaining(['appointment-day-before', 'thank-you']),
    );

    const [first] = reminders;
    await repos.reminders.markDone(first.key);
    expect(
      (await repos.reminders.forApplication(id)).some(
        (r) => r.key === first.key,
      ),
    ).toBe(false);
    // Erledigt bleibt beim nächsten Abgleich erhalten
    expect(await repos.reminders.reconcile()).toBe(false);
  });

  it('archiviert und stellt wieder her', async () => {
    await repos.applications.archive(id);
    expect(await repos.applications.get(id)).toBeUndefined();
    await repos.applications.restore(id);
    expect(await repos.applications.get(id)).toBeDefined();
  });

  it('schreibt Einstellungen per Upsert', async () => {
    const previous = await repos.settings.get('applications.view');
    await repos.settings.set('applications.view', 'board');
    await repos.settings.set('applications.view', 'list');
    expect(await repos.settings.get('applications.view')).toBe('list');
    if (previous) await repos.settings.set('applications.view', previous);
  });

  it('ersetzt, ergänzt und liest das Profil', async () => {
    // Das Testkonto soll danach so dastehen wie vorher
    const before = await repos.profile.get();
    try {
      await repos.profile.replace({
        firstName: 'Test',
        lastName: 'Konto',
        headline: 'Integrationstest',
        experience: [
          {
            title: 'Alt',
            startDate: '2019',
            endDate: '2022-02',
            isCurrent: false,
          },
        ],
        education: [
          {
            title: 'Bachelor',
            startDate: '2014',
            endDate: '2018',
            isCurrent: false,
          },
        ],
        skills: [{ category: 'Frontend', items: 'React' }],
        languages: [{ language: 'Deutsch', level: 'Muttersprache' }],
      });
      const id = await repos.profile.saveEntry('experience', {
        title: 'Neu',
        startDate: '2023-05',
        isCurrent: true,
      });

      const profile = await repos.profile.get();
      expect(profile).toMatchObject({
        firstName: 'Test',
        headline: 'Integrationstest',
        experience: [
          { title: 'Alt', endDate: '2022-02' },
          { id, title: 'Neu', startDate: '2023-05', isCurrent: true },
        ],
        education: [{ title: 'Bachelor' }],
        skills: [{ category: 'Frontend', items: 'React' }],
        languages: [{ language: 'Deutsch', level: 'Muttersprache' }],
      });
      expect(profile?.onboardedAt).toMatch(/Z$/);

      await repos.profile.savePersonal({
        firstName: 'Test',
        lastName: 'Konto',
      });
      expect((await repos.profile.get())?.headline).toBeUndefined();
    } finally {
      if (before) {
        await repos.profile.replace(profileToInput(before));
      } else {
        await supabase.from('profile_entries').delete().not('id', 'is', null);
        await supabase.from('profile_skills').delete().not('id', 'is', null);
        await supabase.from('profile_languages').delete().not('id', 'is', null);
        await supabase.from('profiles').delete().not('user_id', 'is', null);
      }
    }
  });
});
