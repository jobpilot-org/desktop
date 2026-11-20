import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Supabase } from './supabase';

/**
 * Fehlercodes der KI-Edge-Functions (backend/supabase/functions/_shared/ai-request.ts), dazu
 * `offline` (Server nicht erreicht) und `invalid-response` (Antwort passt nicht).
 */
export type AiFunctionErrorCode =
  | 'unauthorized'
  | 'missing-key'
  | 'invalid-key'
  | 'bad-request'
  | 'too-large'
  | 'refused'
  | 'incomplete'
  | 'ai-unavailable'
  | 'unavailable'
  | 'offline'
  | 'invalid-response';

const SERVER_CODES = new Set<string>([
  'unauthorized',
  'missing-key',
  'invalid-key',
  'bad-request',
  'too-large',
  'refused',
  'incomplete',
  'ai-unavailable',
  'unavailable',
]);

/** Ruft eine KI-Edge-Function auf; wirft `{ code }` mit dem Fehlercode des Servers */
export async function invokeAiFunction<T>(
  supabase: Supabase,
  name: string,
  body: unknown,
): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body: body as Record<string, unknown>,
  });
  if (!error) return data;
  if (error instanceof FunctionsHttpError) {
    const response = (await (error.context as Response)
      .json()
      .catch(() => null)) as { error?: string } | null;
    const code = response?.error;
    throw new AiFunctionError(
      code && SERVER_CODES.has(code)
        ? (code as AiFunctionErrorCode)
        : 'unavailable',
    );
  }
  throw new AiFunctionError('offline');
}

export class AiFunctionError extends Error {
  constructor(readonly code: AiFunctionErrorCode) {
    super(code);
  }
}
