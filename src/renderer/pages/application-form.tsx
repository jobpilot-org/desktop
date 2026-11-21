import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  APPLICATION_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  SOURCE_SUGGESTIONS,
  STATUS_LABELS,
  toLocalIsoDate,
  WORK_MODES,
  WORK_MODE_LABELS,
} from '@/domain/application';
import {
  DUPLICATE_REASON_LABELS,
  findDuplicates,
  type DuplicateMatch,
} from '@/domain/duplicates';
import {
  applicationToForm,
  emptyApplicationForm,
  parseApplicationForm,
  type ApplicationFormField,
  type ApplicationFormValues,
} from '@/domain/forms';

import { errorMessage, useApp } from '../app-context';
import { Empty, Field, formatDate, LoadError, useToast } from '../ui';

/** Neue Bewerbung (ohne :id) oder Bearbeiten einer bestehenden */
export function ApplicationFormPage() {
  const { id } = useParams();
  const { repos, notifyChange } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<ApplicationFormValues>();
  const [loadError, setLoadError] = useState<unknown>();
  const [errors, setErrors] = useState<
    Partial<Record<ApplicationFormField, string>>
  >({});
  const [busy, setBusy] = useState(false);
  // Treffer der Dublettenprüfung; gesetzt = Hinweis zeigen, Speichern erst nach Bestätigung
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>();

  useEffect(() => {
    if (!id) {
      setValues(emptyApplicationForm(toLocalIsoDate(new Date())));
      return;
    }
    repos.applications
      .get(id)
      .then(
        (application) =>
          application && setValues(applicationToForm(application)),
        setLoadError,
      );
  }, [id, repos]);

  if (loadError) return <LoadError error={loadError} />;
  if (!values) return id ? <Empty>Bewerbung wird geladen …</Empty> : null;

  const set =
    <K extends ApplicationFormField>(key: K) =>
    (value: ApplicationFormValues[K]) => {
      setValues({ ...values, [key]: value });
      if (errors[key]) setErrors({ ...errors, [key]: undefined });
      // Nach einer Änderung erneut prüfen
      setDuplicates(undefined);
    };
  const text = (
    key: Exclude<ApplicationFormField, 'workMode' | 'status' | 'priority'>,
  ) => ({
    value: values[key],
    onChange: (e: { target: { value: string } }) => set(key)(e.target.value),
  });

  async function submit(event: FormEvent | undefined, confirmed = false) {
    event?.preventDefault();
    if (!values) return;
    const result = parseApplicationForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setBusy(true);
    try {
      // Dublettenprüfung gegen die nicht gelöschten Bewerbungen (ohne die gerade bearbeitete)
      if (!confirmed) {
        const matches = findDuplicates(
          result.value,
          await repos.applications.listActive(),
          id,
        );
        if (matches.length) {
          setDuplicates(matches);
          setBusy(false);
          return;
        }
      }
      const targetId = id ?? (await repos.applications.create(result.value)).id;
      if (id) await repos.applications.update(id, result.value);
      notifyChange();
      toast({ text: id ? 'Änderungen gespeichert' : 'Bewerbung angelegt' });
      navigate(`/bewerbung/${targetId}`, { replace: true });
    } catch (error) {
      toast({ text: `Speichern fehlgeschlagen: ${errorMessage(error)}` });
      setBusy(false);
    }
  }

  return (
    <form className="page" onSubmit={submit} noValidate>
      <div className="page-header">
        <h1>{id ? 'Bewerbung bearbeiten' : 'Neue Bewerbung'}</h1>
        <div className="toolbar">
          <button type="button" onClick={() => navigate(-1)}>
            Abbrechen
          </button>
          <button className="primary" type="submit" disabled={busy}>
            Speichern
          </button>
        </div>
      </div>

      {duplicates && (
        <DuplicateNotice
          matches={duplicates}
          busy={busy}
          onSaveAnyway={() => void submit(undefined, true)}
          onCancel={() => setDuplicates(undefined)}
        />
      )}

      <div className="card form-grid">
        <Field label="Unternehmen *" error={errors.company}>
          <input {...text('company')} autoFocus />
        </Field>
        <Field label="Position *" error={errors.role}>
          <input {...text('role')} />
        </Field>
        <Field label="Ort" error={errors.location}>
          <input {...text('location')} />
        </Field>
        <Field label="Arbeitsmodell" error={errors.workMode}>
          <select
            value={values.workMode}
            onChange={(e) =>
              set('workMode')(
                e.target.value as ApplicationFormValues['workMode'],
              )
            }
          >
            <option value="">Keine Angabe</option>
            {WORK_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {WORK_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" error={errors.status}>
          <select
            value={values.status}
            onChange={(e) =>
              set('status')(e.target.value as ApplicationFormValues['status'])
            }
          >
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={values.status === 'saved' ? 'Gemerkt am' : 'Beworben am'}
          error={errors.appliedAt}
        >
          <input type="date" {...text('appliedAt')} />
        </Field>
        <Field label="Priorität" error={errors.priority}>
          <select
            value={values.priority}
            onChange={(e) =>
              set('priority')(
                e.target.value as ApplicationFormValues['priority'],
              )
            }
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quelle" error={errors.source}>
          <input list="source-suggestions" {...text('source')} />
          <datalist id="source-suggestions">
            {SOURCE_SUGGESTIONS.map((source) => (
              <option key={source} value={source} />
            ))}
          </datalist>
        </Field>
        <Field label="Link zur Anzeige" error={errors.jobUrl} wide>
          <input type="url" placeholder="https://" {...text('jobUrl')} />
        </Field>
        <Field label="Gehalt von (€/Jahr)" error={errors.salaryMin}>
          <input inputMode="numeric" {...text('salaryMin')} />
        </Field>
        <Field label="Gehalt bis (€/Jahr)" error={errors.salaryMax}>
          <input inputMode="numeric" {...text('salaryMax')} />
        </Field>
        <Field label="Nächster Schritt" error={errors.nextStep} wide>
          <input {...text('nextStep')} />
        </Field>
        <Field
          label="Text der Stellenanzeige"
          error={errors.jobDescription}
          wide
        >
          <textarea rows={8} {...text('jobDescription')} />
        </Field>
      </div>
    </form>
  );
}

/** Hinweis der Dublettenprüfung: vorhandene Bewerbungen mit Grund, dann öffnen oder trotzdem speichern */
function DuplicateNotice({
  matches,
  busy,
  onSaveAnyway,
  onCancel,
}: {
  matches: DuplicateMatch[];
  busy: boolean;
  onSaveAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="duplicate-notice" role="alert">
      <p className="jp-eyebrow">Vielleicht schon erfasst</p>
      <p>
        {matches.length === 1
          ? 'Diese Stelle gibt es möglicherweise schon:'
          : `Diese Stelle gibt es möglicherweise schon ${matches.length}-mal:`}
      </p>
      <ul className="rows">
        {matches.map(({ application, reason }) => (
          <li key={application.id} className="row">
            <span className="row-main">
              <strong>
                {application.company} · {application.role}
              </strong>
              <span className="muted small">
                {STATUS_LABELS[application.status]} seit{' '}
                {formatDate(application.appliedAt)} ·{' '}
                {DUPLICATE_REASON_LABELS[reason]}
              </span>
            </span>
            <Link to={`/bewerbung/${application.id}`}>Öffnen</Link>
          </li>
        ))}
      </ul>
      <div className="duplicate-actions">
        <button type="button" onClick={onCancel}>
          Weiter bearbeiten
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={onSaveAnyway}
        >
          Trotzdem speichern
        </button>
      </div>
    </section>
  );
}
