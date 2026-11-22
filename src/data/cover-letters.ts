import {
  letterRequest,
  parseDraft,
  parseSectionText,
  type CoverLetter,
  type CoverLetterInput,
  type LetterPosting,
  type LetterSection,
  type SectionKey,
} from '@/domain/cover-letter';
import type { Profile } from '@/domain/profile';

import {
  AiFunctionError,
  invokeAiFunction,
  type AiFunctionErrorCode,
} from './ai-function';
import { toCoverLetter, toCoverLetterColumns, unwrap } from './mappers';
import type { Supabase } from './supabase';

const MESSAGES: Record<AiFunctionErrorCode, string> = {
  unauthorized: 'Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.',
  'missing-key': 'Für das Anschreiben brauchst du einen eigenen KI-Key.',
  'invalid-key':
    'Dein KI-Key wurde abgelehnt. Bitte prüfe ihn in den Einstellungen.',
  'bad-request': 'Das Anschreiben ließ sich nicht erstellen.',
  'too-large': 'Profil und Anzeige sind zu umfangreich für das Anschreiben.',
  refused: 'Der KI-Dienst hat das Anschreiben abgelehnt.',
  incomplete:
    'Das Anschreiben wurde nicht vollständig. Bitte noch einmal versuchen.',
  'ai-unavailable':
    'Der KI-Dienst ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  unavailable:
    'Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
  offline: 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.',
  'invalid-response':
    'Die Antwort war unvollständig. Bitte noch einmal versuchen.',
};

export class CoverLetterError extends Error {
  constructor(readonly code: AiFunctionErrorCode) {
    super(MESSAGES[code]);
  }
}

async function call<T>(supabase: Supabase, body: unknown): Promise<T | null> {
  try {
    return await invokeAiFunction<T>(supabase, 'cover-letter', body);
  } catch (error) {
    throw error instanceof AiFunctionError
      ? new CoverLetterError(error.code)
      : error;
  }
}

/**
 * Anschreiben (Tabelle `cover_letters`): je Stellenangebot bzw. Bewerbung eines. Wird aus dem
 * Stellenangebot eine Bewerbung, bekommt das Anschreiben zusätzlich deren id und wandert mit.
 */
export function createCoverLettersRepository(supabase: Supabase) {
  return {
    /** Anschreiben zur Bewerbung, sonst zum Stellenangebot */
    async find(target: {
      postingId?: string;
      applicationId?: string;
    }): Promise<CoverLetter | undefined> {
      for (const [column, value] of [
        ['application_id', target.applicationId],
        ['posting_id', target.postingId],
      ] as const) {
        if (!value) continue;
        const row = unwrap(
          await supabase
            .from('cover_letters')
            .select('*')
            .eq(column, value)
            .maybeSingle(),
        );
        if (row) return toCoverLetter(row);
      }
      return undefined;
    },

    /** Neu anlegen bzw. ändern; gibt die id zurück */
    async save(input: CoverLetterInput, id?: string, model?: string) {
      const values = {
        ...toCoverLetterColumns(input),
        ...(model ? { model } : {}),
      };
      if (id) {
        unwrap(
          await supabase.from('cover_letters').update(values).eq('id', id),
        );
        return id;
      }
      const row = unwrap(
        await supabase
          .from('cover_letters')
          .insert(values)
          .select('id')
          .single(),
      );
      if (!row) throw new Error('Anschreiben wurde nicht gespeichert');
      return row.id;
    },

    /** Nach dem Löschen des Stellenangebots („Rückgängig“): mit derselben id wieder anlegen */
    async restore(letter: CoverLetter) {
      unwrap(
        await supabase
          .from('cover_letters')
          .insert({ id: letter.id, ...toCoverLetterColumns(letter) }),
      );
    },

    /** Aus dem Stellenangebot wurde eine Bewerbung: Anschreiben wandert mit */
    async linkApplication(postingId: string, applicationId: string) {
      unwrap(
        await supabase
          .from('cover_letters')
          .update({ application_id: applicationId })
          .eq('posting_id', postingId)
          .is('application_id', null),
      );
    },

    /** Ganzer Entwurf: Betreff und alle Abschnitte (Edge Function `cover-letter`) */
    async draft(
      profile: Profile,
      posting: LetterPosting,
      letter: CoverLetterInput,
    ): Promise<{ subject: string; sections: LetterSection[]; model?: string }> {
      const data = await call<{ model?: unknown }>(
        supabase,
        letterRequest(profile, posting, letter),
      );
      try {
        return {
          ...parseDraft(data),
          model: typeof data?.model === 'string' ? data.model : undefined,
        };
      } catch {
        throw new CoverLetterError('invalid-response');
      }
    },

    /** Einen Abschnitt neu vorschlagen, optional mit Wunsch („kürzer“, „mehr zu …“) */
    async rewriteSection(
      profile: Profile,
      posting: LetterPosting,
      letter: CoverLetterInput,
      key: SectionKey,
      hint?: string,
    ): Promise<string> {
      const data = await call(
        supabase,
        letterRequest(profile, posting, letter, { key, hint }),
      );
      try {
        return parseSectionText(data);
      } catch {
        throw new CoverLetterError('invalid-response');
      }
    },
  };
}
