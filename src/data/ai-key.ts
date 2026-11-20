import { unwrap } from './mappers';
import type { Supabase } from './supabase';

// Eigener KI-Key wie in der mobile-app (src/features/ai/api-key-store.ts): Die App sieht nur die
// Metadatenzeile; der Key liegt verschlüsselt im Supabase Vault und wird nur serverseitig gelesen
// (Edge Function `cv-import`, API-Routen der mobile-app). Gilt für alle Apps des Kontos.

export type AiKeyStatus = { configured: boolean; updatedAt?: string };

/** Fehlertext zur Eingabe oder null, wenn sie gespeichert werden kann */
export function aiKeyInputError(input: string): string | null {
  const value = input.trim();
  if (!value) return 'Bitte gib deinen API-Key ein.';
  if (/\s/.test(value)) return 'Der API-Key darf keine Leerzeichen enthalten.';
  return null;
}

export function createAiKeyRepository(supabase: Supabase) {
  return {
    async status(): Promise<AiKeyStatus> {
      const row = unwrap(
        await supabase.from('ai_api_keys').select('updated_at').maybeSingle(),
      );
      return row
        ? {
            configured: true,
            updatedAt: new Date(row.updated_at).toISOString(),
          }
        : { configured: false };
    },

    async save(apiKey: string) {
      unwrap(await supabase.rpc('save_ai_api_key', { api_key: apiKey.trim() }));
    },

    async remove() {
      unwrap(await supabase.rpc('delete_ai_api_key'));
    },
  };
}
