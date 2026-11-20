import { createId } from '@/domain/application';
import type {
  Profile,
  ProfileEntryInput,
  ProfileEntryKind,
  ProfileInput,
  ProfileLanguageInput,
  ProfilePersonal,
  ProfileSkillInput,
} from '@/domain/profile';

import type { Json } from './database.types';
import {
  toProfile,
  toProfileEntryColumns,
  toProfilePersonalColumns,
  unwrap,
  unwrapList,
} from './mappers';
import type { Supabase } from './supabase';

type ListTable = 'profile_entries' | 'profile_skills' | 'profile_languages';

/** Lebenslauf des angemeldeten Nutzers: Kopfdaten, Stationen, Kenntnisse, Sprachen */
export function createProfileRepository(supabase: Supabase) {
  /** Neue Zeilen ans Ende ihrer Liste: höchste Position + 1 */
  const nextPosition = (rows: { position: number }[]) =>
    rows.length > 0 ? rows[0]!.position + 1 : 0;

  async function lastPositions(table: ListTable, kind?: ProfileEntryKind) {
    const query = supabase
      .from(table)
      .select('position')
      .order('position', { ascending: false })
      .limit(1);
    // Stationen zählen je Art (Beruf/Ausbildung) getrennt
    return unwrapList(
      await (kind && table === 'profile_entries'
        ? supabase
            .from('profile_entries')
            .select('position')
            .eq('kind', kind)
            .order('position', { ascending: false })
            .limit(1)
        : query),
    );
  }

  return {
    /** null, solange der Nutzer noch kein Profil angelegt hat */
    async get(): Promise<Profile | null> {
      const [row, entries, skills, languages] = await Promise.all([
        supabase.from('profiles').select('*').maybeSingle(),
        supabase.from('profile_entries').select('*'),
        supabase.from('profile_skills').select('*'),
        supabase.from('profile_languages').select('*'),
      ]);
      const profile = unwrap(row);
      if (!profile) return null;
      return toProfile(
        profile,
        unwrapList(entries),
        unwrapList(skills),
        unwrapList(languages),
      );
    },

    /** Kopfdaten speichern; legt das Profil an, falls es noch fehlt */
    async savePersonal(personal: ProfilePersonal) {
      unwrap(
        await supabase
          .from('profiles')
          .upsert(toProfilePersonalColumns(personal), {
            onConflict: 'user_id',
          }),
      );
    },

    /**
     * Merkt sich, dass die Willkommensseite erledigt ist. Fehlt das Profil, wird es mit `seed`
     * (z. B. Name aus der Registrierung) angelegt; vorhandene Daten bleiben unberührt.
     */
    async markOnboarded(
      seed: Pick<ProfilePersonal, 'firstName' | 'lastName'>,
      now = new Date(),
    ) {
      const onboarded_at = now.toISOString();
      const updated = unwrapList(
        await supabase
          .from('profiles')
          .update({ onboarded_at })
          .not('user_id', 'is', null)
          .select('user_id'),
      );
      if (updated.length > 0) return;
      unwrap(
        await supabase.from('profiles').insert({
          first_name: seed.firstName,
          last_name: seed.lastName,
          onboarded_at,
        }),
      );
    },

    /** Ersetzt das ganze Profil in einer Transaktion (Import, Assistent) */
    async replace(input: ProfileInput) {
      unwrap(
        await supabase.rpc('replace_profile', {
          profile: input as unknown as Json,
        }),
      );
    },

    /** Legt eine Station an (ohne id) oder überschreibt sie (mit id) */
    async saveEntry(
      kind: ProfileEntryKind,
      input: ProfileEntryInput,
      id?: string,
    ) {
      const values = toProfileEntryColumns(input);
      if (id) {
        unwrap(
          await supabase.from('profile_entries').update(values).eq('id', id),
        );
        return id;
      }
      const newId = createId();
      unwrap(
        await supabase.from('profile_entries').insert({
          ...values,
          id: newId,
          kind,
          position: nextPosition(await lastPositions('profile_entries', kind)),
        }),
      );
      return newId;
    },

    async deleteEntry(id: string) {
      unwrap(await supabase.from('profile_entries').delete().eq('id', id));
    },

    async saveSkill(input: ProfileSkillInput, id?: string) {
      const values = { category: input.category ?? null, items: input.items };
      if (id) {
        unwrap(
          await supabase.from('profile_skills').update(values).eq('id', id),
        );
        return;
      }
      unwrap(
        await supabase.from('profile_skills').insert({
          ...values,
          id: createId(),
          position: nextPosition(await lastPositions('profile_skills')),
        }),
      );
    },

    async deleteSkill(id: string) {
      unwrap(await supabase.from('profile_skills').delete().eq('id', id));
    },

    async saveLanguage(input: ProfileLanguageInput, id?: string) {
      const values = { language: input.language, level: input.level ?? null };
      if (id) {
        unwrap(
          await supabase.from('profile_languages').update(values).eq('id', id),
        );
        return;
      }
      unwrap(
        await supabase.from('profile_languages').insert({
          ...values,
          id: createId(),
          position: nextPosition(await lastPositions('profile_languages')),
        }),
      );
    },

    async deleteLanguage(id: string) {
      unwrap(await supabase.from('profile_languages').delete().eq('id', id));
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
