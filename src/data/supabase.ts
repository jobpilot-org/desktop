import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

export type Supabase = SupabaseClient<Database>;

// Standard ist das gehostete Projekt `dev` – die zentrale Datenbank aller Apps. Eine andere
// Instanz (z. B. die lokale aus ../backend) über VITE_SUPABASE_URL und
// VITE_SUPABASE_PUBLISHABLE_KEY in .env. Der Publishable Key ist öffentlich; er gibt nur frei,
// was RLS dem Aufrufer erlaubt.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://mczpmqhbhvvqysgwdbgg.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_F1D8l9dBkNsnanXX0PyOFw_ae5Paos5';

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
