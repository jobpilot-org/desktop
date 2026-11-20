import type { Profile } from '@/domain/profile';
import {
  parseProfileReview,
  reviewRequest,
  type ProfileReview,
} from '@/domain/profile-review';

import {
  AiFunctionError,
  invokeAiFunction,
  type AiFunctionErrorCode,
} from './ai-function';
import type { Supabase } from './supabase';

const MESSAGES: Record<AiFunctionErrorCode, string> = {
  unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.',
  'missing-key':
    'Für den Profil-Check brauchst du einen eigenen KI-Key. Hinterlege ihn in den Einstellungen.',
  'invalid-key':
    'Dein KI-Key wurde abgelehnt. Bitte prüfe ihn in den Einstellungen.',
  'bad-request':
    'Das Profil ließ sich nicht prüfen. Bitte noch einmal versuchen.',
  'too-large': 'Das Profil ist zu umfangreich für den Check.',
  refused: 'Der KI-Dienst hat den Check dieses Profils abgelehnt.',
  incomplete:
    'Die Bewertung wurde nicht vollständig. Bitte noch einmal versuchen.',
  'ai-unavailable':
    'Der KI-Dienst ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  unavailable:
    'Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  offline: 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.',
  'invalid-response':
    'Die Antwort des Checks war unvollständig. Bitte noch einmal versuchen.',
};

export class ProfileReviewError extends Error {
  constructor(readonly code: AiFunctionErrorCode) {
    super(MESSAGES[code]);
  }
}

/**
 * Lässt das Profil von der KI auf grobe inhaltliche Fehler prüfen (Edge Function
 * `profile-review`). Name und Kontaktdaten gehen nicht mit; gespeichert wird nichts.
 */
export async function reviewProfile(
  supabase: Supabase,
  profile: Profile,
): Promise<ProfileReview> {
  let data: { review: unknown } | null;
  try {
    data = await invokeAiFunction<{ review: unknown }>(
      supabase,
      'profile-review',
      reviewRequest(profile),
    );
  } catch (error) {
    throw error instanceof AiFunctionError
      ? new ProfileReviewError(error.code)
      : error;
  }
  try {
    return parseProfileReview(data?.review, profile);
  } catch {
    throw new ProfileReviewError('invalid-response');
  }
}
