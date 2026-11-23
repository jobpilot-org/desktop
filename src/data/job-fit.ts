import { invokeAiFunction } from '@jobpilot-org/shared-ai/client/supabase';
import {
  AiFunctionError,
  type AiFunctionErrorCode,
} from '@jobpilot-org/shared-ai/errors';

import {
  fitRequest,
  parseFit,
  type FitPosting,
  type FitResult,
} from '@/domain/job-fit';
import type { Profile } from '@/domain/profile';

import type { Supabase } from './supabase';

const MESSAGES: Record<AiFunctionErrorCode, string> = {
  unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.',
  'missing-key':
    'Für die Passung brauchst du einen eigenen KI-Key. Hinterlege ihn in den Einstellungen.',
  'invalid-key':
    'Dein KI-Key wurde abgelehnt. Bitte prüfe ihn in den Einstellungen.',
  'bad-request':
    'Die Passung ließ sich nicht bewerten – fehlt der Anzeigentext?',
  'too-large': 'Profil und Anzeige sind zu umfangreich für die Bewertung.',
  refused: 'Der KI-Dienst hat die Bewertung abgelehnt.',
  incomplete:
    'Die Bewertung wurde nicht vollständig. Bitte noch einmal versuchen.',
  'ai-unavailable':
    'Der KI-Dienst ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  unavailable:
    'Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  offline: 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.',
  'invalid-response':
    'Die Antwort war unvollständig. Bitte noch einmal versuchen.',
};

export class JobFitError extends Error {
  constructor(readonly code: AiFunctionErrorCode) {
    super(MESSAGES[code]);
  }
}

/**
 * Lässt die Passung von der KI bewerten (Edge Function `job-fit`). Name und Kontaktdaten gehen
 * nicht mit; gespeichert wird hier nichts.
 */
export async function evaluateFit(
  supabase: Supabase,
  profile: Profile,
  posting: FitPosting,
): Promise<{ fit: FitResult; model?: string }> {
  let data: { fit: unknown; model?: unknown } | null;
  try {
    data = await invokeAiFunction<{ fit: unknown; model?: unknown }>(
      supabase,
      'job-fit',
      fitRequest(profile, posting),
    );
  } catch (error) {
    throw error instanceof AiFunctionError
      ? new JobFitError(error.code)
      : error;
  }
  try {
    return {
      fit: parseFit(data?.fit),
      model: typeof data?.model === 'string' ? data.model : undefined,
    };
  } catch {
    throw new JobFitError('invalid-response');
  }
}
