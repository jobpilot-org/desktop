import { invokeAiFunction } from '@jobpilot-org/shared-ai/client/supabase';
import {
  AiFunctionError,
  type AiFunctionErrorCode,
} from '@jobpilot-org/shared-ai/errors';

import { parseProfileDraft, type ProfileInput } from '@/domain/profile';

import type { Supabase } from './supabase';

/** Fehlercodes der Edge Function `cv-import` (backend/supabase/functions/cv-import) */
export type CvImportErrorCode = AiFunctionErrorCode;

const MESSAGES: Record<CvImportErrorCode, string> = {
  unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.',
  'missing-key':
    'Für den Import brauchst du einen eigenen KI-Key. Hinterlege ihn in den Einstellungen.',
  'invalid-key':
    'Dein KI-Key wurde abgelehnt. Bitte prüfe ihn in den Einstellungen.',
  'bad-request':
    'Die Datei ließ sich nicht lesen. Bitte ein unverschlüsseltes PDF wählen.',
  'too-large': 'Das PDF ist zu groß (höchstens 10 MB).',
  refused: 'Der KI-Dienst hat die Verarbeitung dieses Dokuments abgelehnt.',
  incomplete:
    'Der Lebenslauf konnte nicht vollständig gelesen werden. Bitte noch einmal versuchen.',
  'ai-unavailable':
    'Der KI-Dienst ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  unavailable:
    'Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  offline: 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.',
  'invalid-response':
    'Die Antwort des Imports war unvollständig. Bitte noch einmal versuchen.',
};

export class CvImportError extends Error {
  constructor(readonly code: CvImportErrorCode) {
    super(MESSAGES[code]);
  }
}

/** 10 MB, wie in der Edge Function */
export const MAX_CV_BYTES = 10 * 1024 * 1024;

/** ArrayBuffer → Base64, in Stücken, damit große PDFs den Aufruf-Stack nicht sprengen */
export function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Schickt das PDF an die Edge Function und liefert den geprüften Profilentwurf. Gespeichert wird
 * nichts – das macht der Aufrufer nach der Kontrolle über `profile.replace`.
 */
export async function importCv(
  supabase: Supabase,
  pdf: ArrayBuffer,
): Promise<ProfileInput> {
  if (pdf.byteLength > MAX_CV_BYTES) throw new CvImportError('too-large');
  let data: { profile: unknown } | null;
  try {
    data = await invokeAiFunction<{ profile: unknown }>(supabase, 'cv-import', {
      pdf: toBase64(pdf),
    });
  } catch (error) {
    throw error instanceof AiFunctionError
      ? new CvImportError(error.code)
      : error;
  }
  try {
    return parseProfileDraft(data?.profile);
  } catch {
    throw new CvImportError('invalid-response');
  }
}
