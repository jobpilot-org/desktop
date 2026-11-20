import { useState, type FormEvent } from 'react';

import {
  emptyEntryForm,
  entryToForm,
  parseEntryForm,
  parseLanguageForm,
  parsePersonalForm,
  parseSkillForm,
  personalToForm,
  type EntryFormField,
  type EntryFormValues,
  type LanguageFormValues,
  type PersonalFormField,
  type PersonalFormValues,
  type ProfileEntry,
  type ProfileEntryKind,
  type ProfileLanguage,
  type ProfilePersonal,
  type ProfileSkill,
  type SkillFormValues,
} from '@/domain/profile';

import { useApp } from '../app-context';
import { Dialog, Field, useAction } from '../ui';

// Dialoge der Profilseite und des Assistenten. Jeder Dialog wird nur gerendert, solange er offen
// ist – so startet das Formular immer frisch (wie detail-dialogs.tsx).

function DialogButtons({
  onClose,
  onDelete,
}: {
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="dialog-buttons">
      {onDelete && (
        <button type="button" className="danger" onClick={onDelete}>
          Löschen
        </button>
      )}
      <span className="spacer" />
      <button type="button" onClick={onClose}>
        Abbrechen
      </button>
      <button type="submit" className="primary">
        Speichern
      </button>
    </div>
  );
}

/** Felder der Kopfdaten – auch im ersten Schritt des Assistenten verwendet */
export function PersonalFields({
  values,
  errors,
  onChange,
  withSummary = false,
}: {
  values: PersonalFormValues;
  errors: Partial<Record<PersonalFormField, string>>;
  onChange: (values: PersonalFormValues) => void;
  withSummary?: boolean;
}) {
  const input = (field: PersonalFormField) => ({
    value: values[field],
    onChange: (e: { target: { value: string } }) =>
      onChange({ ...values, [field]: e.target.value }),
  });
  return (
    <>
      <Field label="Vorname" error={errors.firstName}>
        <input autoComplete="given-name" autoFocus {...input('firstName')} />
      </Field>
      <Field label="Nachname" error={errors.lastName}>
        <input autoComplete="family-name" {...input('lastName')} />
      </Field>
      <Field label="Berufsbezeichnung" error={errors.headline} wide>
        <input
          placeholder="z. B. Senior Fullstack-Entwickler"
          {...input('headline')}
        />
      </Field>
      <Field label="Straße und Hausnummer" error={errors.street} wide>
        <input autoComplete="street-address" {...input('street')} />
      </Field>
      <Field label="PLZ" error={errors.postalCode}>
        <input autoComplete="postal-code" {...input('postalCode')} />
      </Field>
      <Field label="Ort" error={errors.city}>
        <input autoComplete="address-level2" {...input('city')} />
      </Field>
      <Field label="Telefon" error={errors.phone}>
        <input type="tel" autoComplete="tel" {...input('phone')} />
      </Field>
      <Field label="E-Mail" error={errors.email}>
        <input type="email" autoComplete="email" {...input('email')} />
      </Field>
      <Field label="Geburtsdatum" error={errors.birthDate}>
        <input type="date" {...input('birthDate')} />
      </Field>
      <Field label="Geburtsort" error={errors.birthPlace}>
        <input {...input('birthPlace')} />
      </Field>
      {withSummary && (
        <Field label="Kurzprofil" error={errors.summary} wide>
          <textarea rows={6} {...input('summary')} />
        </Field>
      )}
    </>
  );
}

/** Kopfdaten bearbeiten; `summaryOnly` zeigt nur das Kurzprofil */
export function PersonalDialog({
  personal,
  summaryOnly = false,
  onClose,
  onSaved,
}: {
  personal: ProfilePersonal;
  summaryOnly?: boolean;
  onClose: () => void;
  /** Nach Speichern bzw. Löschen, vor `onClose` */
  onSaved?: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const [values, setValues] = useState(() => personalToForm(personal));
  const [errors, setErrors] = useState<
    Partial<Record<PersonalFormField, string>>
  >({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parsePersonalForm(values);
    if (!result.ok) return setErrors(result.errors);
    if (
      await run(
        () => repos.profile.savePersonal(result.value),
        'Profil gespeichert',
      )
    ) {
      onSaved?.();
      onClose();
    }
  }

  return (
    <Dialog
      title={summaryOnly ? 'Kurzprofil' : 'Persönliche Daten'}
      open
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        {summaryOnly ? (
          <Field label="Kurzprofil" error={errors.summary} wide>
            <textarea
              rows={10}
              autoFocus
              placeholder="Wer bist du beruflich, was kannst du besonders gut, wohin willst du?"
              value={values.summary}
              onChange={(e) =>
                setValues({ ...values, summary: e.target.value })
              }
            />
          </Field>
        ) : (
          <PersonalFields
            values={values}
            errors={errors}
            onChange={setValues}
          />
        )}
        <DialogButtons onClose={onClose} />
      </form>
    </Dialog>
  );
}

const ENTRY_LABELS: Record<
  ProfileEntryKind,
  { title: string; organization: string; new: string; edit: string }
> = {
  experience: {
    title: 'Position',
    organization: 'Firma',
    new: 'Neue berufliche Station',
    edit: 'Berufliche Station bearbeiten',
  },
  education: {
    title: 'Abschluss bzw. Weiterbildung',
    organization: 'Schule, Hochschule oder Anbieter',
    new: 'Neue Aus- oder Weiterbildung',
    edit: 'Aus- oder Weiterbildung bearbeiten',
  },
};

export function EntryDialog({
  kind,
  entry,
  onClose,
  onSaved,
}: {
  kind: ProfileEntryKind;
  /** Ohne: neue Station */
  entry?: ProfileEntry;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const labels = ENTRY_LABELS[kind];
  const [values, setValues] = useState<EntryFormValues>(() =>
    entry ? entryToForm(entry) : emptyEntryForm(),
  );
  const [errors, setErrors] = useState<Partial<Record<EntryFormField, string>>>(
    {},
  );
  const input = (field: Exclude<EntryFormField, 'isCurrent'>) => ({
    value: values[field],
    onChange: (e: { target: { value: string } }) =>
      setValues({ ...values, [field]: e.target.value }),
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseEntryForm(values, kind);
    if (!result.ok) return setErrors(result.errors);
    if (
      await run(
        () => repos.profile.saveEntry(kind, result.value, entry?.id),
        'Gespeichert',
      )
    ) {
      onSaved?.();
      onClose();
    }
  }

  async function remove() {
    if (!entry || !confirm(`„${entry.title}“ löschen?`)) return;
    if (await run(() => repos.profile.deleteEntry(entry.id), 'Gelöscht')) {
      onSaved?.();
      onClose();
    }
  }

  return (
    <Dialog title={entry ? labels.edit : labels.new} open onClose={onClose}>
      <form className="form-grid" onSubmit={submit} noValidate>
        <Field label={labels.title} error={errors.title} wide>
          <input autoFocus {...input('title')} />
        </Field>
        <Field label={labels.organization} error={errors.organization}>
          <input {...input('organization')} />
        </Field>
        <Field label="Ort" error={errors.location}>
          <input {...input('location')} />
        </Field>
        <Field label="Beginn" error={errors.startDate}>
          <input placeholder="MM/JJJJ oder JJJJ" {...input('startDate')} />
        </Field>
        <Field label="Ende" error={errors.endDate}>
          <input
            placeholder={values.isCurrent ? 'heute' : 'MM/JJJJ oder JJJJ'}
            disabled={values.isCurrent}
            {...input('endDate')}
          />
        </Field>
        <label className="checkbox wide">
          <input
            type="checkbox"
            checked={values.isCurrent}
            onChange={(e) =>
              setValues({ ...values, isCurrent: e.target.checked })
            }
          />
          {kind === 'experience' ? 'Ich arbeite noch hier' : 'Läuft noch'}
        </label>
        <Field
          label="Stichpunkte (einer pro Zeile)"
          error={errors.description}
          wide
        >
          <textarea rows={6} {...input('description')} />
        </Field>
        <DialogButtons
          onClose={onClose}
          onDelete={entry ? remove : undefined}
        />
      </form>
    </Dialog>
  );
}

export function SkillDialog({
  skill,
  onClose,
  onSaved,
}: {
  skill?: ProfileSkill;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const [values, setValues] = useState<SkillFormValues>({
    category: skill?.category ?? '',
    items: skill?.items ?? '',
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof SkillFormValues, string>>
  >({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseSkillForm(values);
    if (!result.ok) return setErrors(result.errors);
    if (
      await run(
        () => repos.profile.saveSkill(result.value, skill?.id),
        'Gespeichert',
      )
    ) {
      onSaved?.();
      onClose();
    }
  }

  async function remove() {
    if (!skill || !confirm('Diese Kenntnisse löschen?')) return;
    if (await run(() => repos.profile.deleteSkill(skill.id), 'Gelöscht')) {
      onSaved?.();
      onClose();
    }
  }

  return (
    <Dialog
      title={skill ? 'Kenntnisse bearbeiten' : 'Neue Kenntnisse'}
      open
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        <Field label="Bereich" error={errors.category} wide>
          <input
            autoFocus
            placeholder="z. B. Frontend"
            value={values.category}
            onChange={(e) => setValues({ ...values, category: e.target.value })}
          />
        </Field>
        <Field label="Kenntnisse (kommagetrennt)" error={errors.items} wide>
          <textarea
            rows={3}
            placeholder="z. B. React, TypeScript, CSS"
            value={values.items}
            onChange={(e) => setValues({ ...values, items: e.target.value })}
          />
        </Field>
        <DialogButtons
          onClose={onClose}
          onDelete={skill ? remove : undefined}
        />
      </form>
    </Dialog>
  );
}

export function LanguageDialog({
  language,
  onClose,
  onSaved,
}: {
  language?: ProfileLanguage;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const [values, setValues] = useState<LanguageFormValues>({
    language: language?.language ?? '',
    level: language?.level ?? '',
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof LanguageFormValues, string>>
  >({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseLanguageForm(values);
    if (!result.ok) return setErrors(result.errors);
    if (
      await run(
        () => repos.profile.saveLanguage(result.value, language?.id),
        'Gespeichert',
      )
    ) {
      onSaved?.();
      onClose();
    }
  }

  async function remove() {
    if (!language || !confirm(`${language.language} löschen?`)) return;
    if (
      await run(() => repos.profile.deleteLanguage(language.id), 'Gelöscht')
    ) {
      onSaved?.();
      onClose();
    }
  }

  return (
    <Dialog
      title={language ? 'Sprache bearbeiten' : 'Neue Sprache'}
      open
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        <Field label="Sprache" error={errors.language}>
          <input
            autoFocus
            placeholder="z. B. Englisch"
            value={values.language}
            onChange={(e) => setValues({ ...values, language: e.target.value })}
          />
        </Field>
        <Field label="Niveau" error={errors.level}>
          <input
            placeholder="z. B. verhandlungssicher"
            value={values.level}
            onChange={(e) => setValues({ ...values, level: e.target.value })}
          />
        </Field>
        <DialogButtons
          onClose={onClose}
          onDelete={language ? remove : undefined}
        />
      </form>
    </Dialog>
  );
}
