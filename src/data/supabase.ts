import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

export type Supabase = SupabaseClient<Database>;

// Standard ist die lokale Instanz aus ../backend (`supabase start`, Werte über `supabase status`).
// Für eine gehostete Instanz VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY setzen (.env).
// Der Publishable Key ist öffentlich; er gibt nur frei, was RLS dem Aufrufer erlaubt.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

/** Die Session liegt im localStorage des Fensters und überdauert so einen Neustart der App */
export function createSupabase(
  options: Parameters<typeof createClient>[2] = {},
): Supabase {
  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    options,
  );
}
