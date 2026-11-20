import type { SupabaseClient } from '@supabase/supabase-js';

import type { Registration } from '@/domain/forms';

export type SignUpResult =
  | { status: 'signed-in' }
  | { status: 'confirm-email' }
  | { status: 'email-taken' }
  | { status: 'error'; message: string };

/**
 * Legt das Konto an. Ob die E-Mail schon vergeben ist, entscheidet Supabase: ohne
 * E-Mail-Bestätigung kommt der Fehler `user_already_exists`, mit Bestätigung ein Nutzer ohne
 * Identitäten (Supabase verrät die Adresse dann absichtlich nicht als Fehler).
 */
export async function signUp(
  supabase: SupabaseClient,
  registration: Registration,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: registration.email,
    password: registration.password,
    options: {
      data: {
        first_name: registration.firstName,
        last_name: registration.lastName,
      },
    },
  });
  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      return { status: 'email-taken' };
    }
    return {
      status: 'error',
      message: signUpMessage(error.code, error.message),
    };
  }
  if (data.user?.identities?.length === 0) return { status: 'email-taken' };
  // Mit Sitzung wechselt die App über onAuthStateChange direkt zur Übersicht
  return data.session ? { status: 'signed-in' } : { status: 'confirm-email' };
}

/** Supabase-Meldungen der Registrierung auf Deutsch */
export function signUpMessage(code: string | undefined, message: string) {
  if (code === 'signup_disabled') {
    return 'Die Registrierung ist auf dem Server abgeschaltet.';
  }
  if (code === 'weak_password') return 'Das Passwort ist zu schwach.';
  if (code === 'email_address_invalid') {
    return 'Diese E-Mail-Adresse wird nicht akzeptiert.';
  }
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit'
  ) {
    return 'Zu viele Versuche. Bitte später noch einmal probieren.';
  }
  if (message.toLowerCase().includes('fetch')) {
    return 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.';
  }
  return message;
}
