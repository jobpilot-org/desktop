import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import {
  parsePersonalForm,
  personalToForm,
  type PersonalFormField,
  type Profile,
} from '@/domain/profile';

import { useApp } from '../app-context';
import { PersonalFields } from '../components/profile-dialogs';
import { Field, LoadError, useAction, useToast } from '../ui';
import { useProfile, useProfileEditor } from './profile';

const STEPS = [
  {
    title: 'Persönliche Daten',
    intro: 'Wie heißt du, und wie erreicht man dich?',
  },
  {
    title: 'Kurzprofil',
    intro:
      'Ein paar Sätze über dich: Erfahrung, Schwerpunkte und was du als Nächstes suchst.',
  },
  {
    title: 'Berufserfahrung',
    intro:
      'Lege deine beruflichen Stationen an – die aktuelle zuerst. Du kannst jederzeit später ergänzen.',
  },
  {
    title: 'Aus- und Weiterbildung, Ehrenamt',
    intro:
      'Abschlüsse, Studium, Ausbildung, Zertifikate und Weiterbildungen – und wo du dich ehrenamtlich engagierst.',
  },
  {
    title: 'Kenntnisse, Sprachen und Links',
    intro:
      'Was kannst du? Gruppiere deine Kenntnisse, z. B. „Frontend: React, TypeScript“, und ergänze Links wie LinkedIn oder GitHub.',
  },
] as const;

/** Profil Schritt für Schritt: jeder Schritt speichert sofort, Abbrechen verliert also nichts */
export function ProfileAssistantPage() {
  const { state, profile } = useProfile();
  if (state.status === 'error' && !profile) {
    return (
      <div className="page">
        <LoadError error={state.error} />
      </div>
    );
  }
  if (!profile) return null;
  return <Assistant profile={profile} />;
}

function Assistant({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const { sections, dialogs } = useProfileEditor(profile);
  const last = step === STEPS.length - 1;
  const { title, intro } = STEPS[step]!;

  function next() {
    if (last) {
      toast({ text: 'Profil gespeichert' });
      navigate('/profil');
    } else {
      setStep(step + 1);
    }
  }
  const back = step > 0 ? () => setStep(step - 1) : undefined;

  return (
    <div className="page">
      <p className="jp-eyebrow">
        Assistent · Schritt {step + 1} von {STEPS.length}
      </p>
      <h1>{title}</h1>
      <ol className="steps" aria-hidden="true">
        {STEPS.map((s, index) => (
          <li key={s.title} className={index <= step ? 'is-done' : undefined} />
        ))}
      </ol>
      <p className="muted">{intro}</p>

      {step === 0 && (
        <PersonalStep profile={profile} onDone={next} onBack={back} />
      )}
      {step === 1 && (
        <SummaryStep profile={profile} onDone={next} onBack={back} />
      )}
      {step >= 2 && (
        <>
          {step === 2 && sections.experience}
          {step === 3 && (
            <>
              {sections.education}
              {sections.volunteering}
            </>
          )}
          {step === 4 && (
            <>
              {sections.skills}
              {sections.languages}
              {sections.links}
            </>
          )}
          <WizardButtons onBack={back} last={last} onNext={next} />
        </>
      )}
      {dialogs}
    </div>
  );
}

function WizardButtons({
  onBack,
  onNext,
  last,
  submit = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  last: boolean;
  submit?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="wizard-buttons">
      <button type="button" onClick={() => navigate('/profil')}>
        Abbrechen
      </button>
      <span className="spacer" />
      {onBack && (
        <button type="button" onClick={onBack}>
          Zurück
        </button>
      )}
      <button
        type={submit ? 'submit' : 'button'}
        className="primary"
        onClick={submit ? undefined : onNext}
      >
        {last ? 'Fertig' : 'Weiter'}
      </button>
    </div>
  );
}

function PersonalStep({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile;
  onDone: () => void;
  onBack?: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const [values, setValues] = useState(() => personalToForm(profile));
  const [errors, setErrors] = useState<
    Partial<Record<PersonalFormField, string>>
  >({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parsePersonalForm(values);
    if (!result.ok) return setErrors(result.errors);
    // Kurzprofil gehört zum nächsten Schritt und bleibt hier unverändert
    if (
      await run(() =>
        repos.profile.savePersonal({
          ...result.value,
          summary: profile.summary,
        }),
      )
    ) {
      onDone();
    }
  }

  return (
    <form className="form-grid section" onSubmit={submit} noValidate>
      <PersonalFields values={values} errors={errors} onChange={setValues} />
      <div className="wide">
        <WizardButtons onBack={onBack} last={false} submit />
      </div>
    </form>
  );
}

function SummaryStep({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile;
  onDone: () => void;
  onBack?: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const [summary, setSummary] = useState(profile.summary ?? '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parsePersonalForm({ ...personalToForm(profile), summary });
    // Name fehlt nur, wenn Schritt 1 übersprungen wurde – dann dorthin zurück
    if (!result.ok) return onBack?.();
    if (await run(() => repos.profile.savePersonal(result.value))) onDone();
  }

  return (
    <form className="form-grid section" onSubmit={submit} noValidate>
      <Field label="Kurzprofil" wide>
        <textarea
          rows={10}
          autoFocus
          placeholder="z. B. Fullstack-Entwickler mit über 10 Jahren Erfahrung in …"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Field>
      <div className="wide">
        <WizardButtons onBack={onBack} last={false} submit />
      </div>
    </form>
  );
}
