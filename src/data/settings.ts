import { unwrap, unwrapList } from './mappers';
import type { Supabase } from './supabase';

export type SettingKey =
  | 'ai.consent'
  /** 'yes' = neue Stellenangebote automatisch auf Passung bewerten */
  | 'ai.fit.auto'
  | 'applications.filter'
  | 'applications.sort'
  | 'applications.view'
  | 'reminders.followUpDays'
  | 'reminders.appointments'
  | 'reminders.thankYou';

/** Kleine Schlüssel-Wert-Einstellungen je Nutzer – geteilt mit den anderen Apps */
export function createSettingsRepository(supabase: Supabase) {
  return {
    async all(): Promise<Map<string, string>> {
      const rows = unwrapList(
        await supabase.from('settings').select('key, value'),
      );
      return new Map(rows.map((row) => [row.key, row.value]));
    },

    async get(key: SettingKey): Promise<string | undefined> {
      const row = unwrap(
        await supabase
          .from('settings')
          .select('value')
          .eq('key', key)
          .maybeSingle(),
      );
      return row?.value;
    },

    async set(key: SettingKey, value: string) {
      // user_id füllt die Datenbank (auth.uid()), deshalb genügt der Schlüssel im Konflikt
      unwrap(
        await supabase
          .from('settings')
          .upsert({ key, value }, { onConflict: 'user_id,key' }),
      );
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
