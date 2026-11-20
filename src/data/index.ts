import { createApplicationsRepository } from './applications';
import { createDetailsRepository } from './details';
import { createRemindersRepository } from './reminders';
import { createSettingsRepository } from './settings';
import type { Supabase } from './supabase';

export function createRepositories(supabase: Supabase) {
  return {
    applications: createApplicationsRepository(supabase),
    details: createDetailsRepository(supabase),
    reminders: createRemindersRepository(supabase),
    settings: createSettingsRepository(supabase),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
