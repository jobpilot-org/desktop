import { useState } from 'react';
import { useNavigate } from 'react-router';

import type { Profile, ProfilePersonal } from '@/domain/profile';
import type { ProfileEditTarget } from '@/domain/profile-review';

import { useApp, useData } from '../app-context';
import {
  EntryDialog,
  LanguageDialog,
  PersonalDialog,
  SkillDialog,
} from '../components/profile-dialogs';
import {
  EntriesSection,
  LanguagesSection,
  PersonalSection,
  SkillsSection,
  SummarySection,
} from '../components/profile-sections';
import { LoadError } from '../ui';

type OpenDialog = ProfileEditTarget & { onSaved?: () => void };

/** Name aus der Registrierung (user_metadata), solange noch kein Profil gespeichert ist */
export function useProfileSeed(): ProfilePersonal {
  const { session } = useApp();
  const meta = session?.user.user_metadata ?? {};
  return {
    firstName: typeof meta.first_name === 'string' ? meta.first_name : '',
    lastName: typeof meta.last_name === 'string' ? meta.last_name : '',
    email: session?.user.email,
  };
}

/** Lädt das Profil; fehlt es noch, ein leeres mit dem Namen aus der Registrierung */
export function useProfile() {
  const seed = useProfileSeed();
  const state = useData((r) => r.profile.get());
  const profile: Profile | undefined =
    state.data === undefined
      ? undefined
      : (state.data ?? {
          ...seed,
          experience: [],
          education: [],
          skills: [],
          languages: [],
        });
  return { state, profile };
}

/**
 * Abschnitte des Profils mit ihren Bearbeiten-Dialogen – Profilseite, Assistent und KI-Check.
 * `edit` öffnet einen Dialog gezielt; `onSaved` läuft nach Speichern bzw. Löschen.
 */
export function useProfileEditor(profile: Profile) {
  const [dialog, setDialog] = useState<OpenDialog>();
  const close = () => setDialog(undefined);
  const onSaved = dialog?.onSaved;
  const edit = (target: ProfileEditTarget, saved?: () => void) =>
    setDialog({ ...target, onSaved: saved });

  const dialogs = (
    <>
      {dialog?.kind === 'personal' && (
        <PersonalDialog personal={profile} onClose={close} onSaved={onSaved} />
      )}
      {dialog?.kind === 'summary' && (
        <PersonalDialog
          personal={profile}
          summaryOnly
          onClose={close}
          onSaved={onSaved}
        />
      )}
      {dialog?.kind === 'entry' && (
        <EntryDialog
          kind={dialog.entryKind}
          entry={dialog.entry}
          onClose={close}
          onSaved={onSaved}
        />
      )}
      {dialog?.kind === 'skill' && (
        <SkillDialog skill={dialog.skill} onClose={close} onSaved={onSaved} />
      )}
      {dialog?.kind === 'language' && (
        <LanguageDialog
          language={dialog.language}
          onClose={close}
          onSaved={onSaved}
        />
      )}
    </>
  );

  const sections = {
    personal: (
      <PersonalSection
        personal={profile}
        onEdit={() => setDialog({ kind: 'personal' })}
      />
    ),
    summary: (
      <SummarySection
        summary={profile.summary}
        onEdit={() => setDialog({ kind: 'summary' })}
      />
    ),
    experience: (
      <EntriesSection
        kind="experience"
        entries={profile.experience}
        onEdit={(entry) =>
          setDialog({ kind: 'entry', entryKind: 'experience', entry })
        }
      />
    ),
    education: (
      <EntriesSection
        kind="education"
        entries={profile.education}
        onEdit={(entry) =>
          setDialog({ kind: 'entry', entryKind: 'education', entry })
        }
      />
    ),
    skills: (
      <SkillsSection
        skills={profile.skills}
        onEdit={(skill) => setDialog({ kind: 'skill', skill })}
      />
    ),
    languages: (
      <LanguagesSection
        languages={profile.languages}
        onEdit={(language) => setDialog({ kind: 'language', language })}
      />
    ),
  };

  return { sections, dialogs, edit };
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { state, profile } = useProfile();

  if (state.status === 'error' && !profile) {
    return (
      <div className="page">
        <LoadError error={state.error} />
      </div>
    );
  }
  if (!profile) return null;
  return <ProfileContent profile={profile} navigate={navigate} />;
}

function ProfileContent({
  profile,
  navigate,
}: {
  profile: Profile;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { sections, dialogs } = useProfileEditor(profile);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="jp-eyebrow">Dein Lebenslauf</p>
          <h1>Profil</h1>
        </div>
        <div className="toolbar">
          <button type="button" onClick={() => navigate('/profil/assistent')}>
            Assistent
          </button>
          <button type="button" onClick={() => navigate('/profil/import')}>
            PDF importieren
          </button>
          <button type="button" onClick={() => navigate('/profil/check')}>
            KI-Check
          </button>
        </div>
      </div>
      <p className="muted">
        Dein Profil gilt für alle jobpilot-Apps. Klicke auf einen Eintrag, um
        ihn zu bearbeiten.
      </p>
      {sections.personal}
      {sections.summary}
      {sections.experience}
      {sections.education}
      {sections.skills}
      {sections.languages}
      {dialogs}
    </div>
  );
}
