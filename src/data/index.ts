import { createAiKeyRepository } from './ai-key';
import { createApplicationsRepository } from './applications';
import { createDetailsRepository } from './details';
import { createProfileRepository } from './profile';
import { createRemindersRepository } from './reminders';
import { createSettingsRepository } from './settings';
import type { Supabase } from './supabase';

export function createRepositories(supabase: Supabase) {
  return {
    aiKey: createAiKeyRepository(supabase),
    applications: createApplicationsRepository(supabase),
    details: createDetailsRepository(supabase),
    profile: createProfileRepository(supabase),
    reminders: createRemindersRepository(supabase),
    settings: createSettingsRepository(supabase),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
