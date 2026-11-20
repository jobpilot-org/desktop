import type { SupabaseClient } from '@supabase/supabase-js';

import { signUp, signUpMessage } from '../sign-up';

const registration = {
  firstName: 'Erika',
  lastName: 'Muster',
  email: 'erika@example.de',
  password: 'geheim123',
};

function client(result: { data?: unknown; error?: unknown }) {
  const signUpMock = vi.fn().mockResolvedValue({
    data: result.data ?? { user: null, session: null },
    error: result.error ?? null,
  });
  return {
    supabase: { auth: { signUp: signUpMock } } as unknown as SupabaseClient,
    signUpMock,
  };
}

describe('signUp', () => {
  it('gibt Vor- und Nachname als Metadaten an Supabase weiter', async () => {
    const { supabase, signUpMock } = client({
      data: { user: { identities: [{}] }, session: {} },
    });
    await expect(signUp(supabase, registration)).resolves.toEqual({
      status: 'signed-in',
    });
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'erika@example.de',
      password: 'geheim123',
      options: { data: { first_name: 'Erika', last_name: 'Muster' } },
    });
  });

  it('erkennt eine vergebene E-Mail am Fehlercode', async () => {
    const { supabase } = client({
      error: {
        code: 'user_already_exists',
        message: 'User already registered',
      },
    });
    await expect(signUp(supabase, registration)).resolves.toEqual({
      status: 'email-taken',
    });
  });

  it('erkennt eine vergebene E-Mail bei aktiver Bestätigung an fehlenden Identitäten', async () => {
    const { supabase } = client({
      data: { user: { identities: [] }, session: null },
    });
    await expect(signUp(supabase, registration)).resolves.toEqual({
      status: 'email-taken',
    });
  });

  it('meldet, wenn erst die E-Mail bestätigt werden muss', async () => {
    const { supabase } = client({
      data: { user: { identities: [{}] }, session: null },
    });
    await expect(signUp(supabase, registration)).resolves.toEqual({
      status: 'confirm-email',
    });
  });

  it('übersetzt übrige Fehler', async () => {
    const { supabase } = client({
      error: { code: 'signup_disabled', message: 'Signups not allowed' },
    });
    await expect(signUp(supabase, registration)).resolves.toEqual({
      status: 'error',
      message: 'Die Registrierung ist auf dem Server abgeschaltet.',
    });
  });
});

describe('signUpMessage', () => {
  it('erkennt fehlende Verbindung', () => {
    expect(signUpMessage(undefined, 'Failed to fetch')).toBe(
      'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.',
    );
  });

  it('reicht unbekannte Meldungen durch', () => {
    expect(signUpMessage('unexpected', 'Etwas ging schief')).toBe(
      'Etwas ging schief',
    );
  });
});
