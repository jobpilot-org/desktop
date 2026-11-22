import { createAiKeyRepository } from './ai-key';
import { createApplicationsRepository } from './applications';
import { createCoverLettersRepository } from './cover-letters';
import { createDetailsRepository } from './details';
import { createDocumentsRepository } from './documents';
import { createJobPostingsRepository } from './job-postings';
import { createProfileRepository } from './profile';
import { createRemindersRepository } from './reminders';
import { createSettingsRepository } from './settings';
import type { Supabase } from './supabase';

export function createRepositories(supabase: Supabase) {
  return {
    aiKey: createAiKeyRepository(supabase),
    applications: createApplicationsRepository(supabase),
    coverLetters: createCoverLettersRepository(supabase),
    details: createDetailsRepository(supabase),
    documents: createDocumentsRepository(supabase),
    jobPostings: createJobPostingsRepository(supabase),
    profile: createProfileRepository(supabase),
    reminders: createRemindersRepository(supabase),
    settings: createSettingsRepository(supabase),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
