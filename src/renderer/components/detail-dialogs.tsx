import { useState, type FormEvent } from 'react';

import {
  APPOINTMENT_KINDS,
  APPOINTMENT_KIND_LABELS,
  type Appointment,
  type Contact,
} from '@/domain/details';
import {
  appointmentToForm,
  contactToForm,
  emptyAppointmentForm,
  emptyContactForm,
  parseAppointmentForm,
  parseContactForm,
  type AppointmentFormField,
  type AppointmentFormValues,
  type ContactFormField,
  type ContactFormValues,
} from '@/domain/forms';

import { useApp } from '../app-context';
import { Dialog, Field, toDateTimeLocal, useAction, useConfirm } from '../ui';

// Jeder Dialog wird nur gerendert, solange er offen ist – so startet das Formular immer frisch.

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

export function AppointmentDialog({
  applicationId,
  appointment,
  onClose,
}: {
  applicationId: string;
  /** Ohne: neuer Termin */
  appointment?: Appointment;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const { repos } = useApp();
  const run = useAction();
  const [values, setValues] = useState<AppointmentFormValues>(
    appointment ? appointmentToForm(appointment) : emptyAppointmentForm(),
  );
  const [errors, setErrors] = useState<
    Partial<Record<AppointmentFormField, string>>
  >({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseAppointmentForm(values);
    if (!result.ok) return setErrors(result.errors);
    const saved = await run(
      () =>
        repos.details.saveAppointment(
          applicationId,
          result.value,
          appointment?.id,
        ),
      appointment ? 'Termin gespeichert' : 'Termin angelegt',
    );
    if (saved) onClose();
  }

  async function remove() {
    if (
      !appointment ||
      !(await confirm({
        title: 'Diesen Termin löschen?',
        confirmLabel: 'Löschen',
        danger: true,
      }))
    )
      return;
    if (
      await run(
        () => repos.details.deleteAppointment(appointment.id),
        'Termin gelöscht',
      )
    ) {
      onClose();
    }
  }

  return (
    <Dialog
      title={appointment ? 'Termin bearbeiten' : 'Neuer Termin'}
      open
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        <Field label="Art" error={errors.kind}>
          <select
            value={values.kind}
            onChange={(e) =>
              setValues({
                ...values,
                kind: e.target.value as AppointmentFormValues['kind'],
              })
            }
          >
            {APPOINTMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {APPOINTMENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Beginn" error={errors.startsAt}>
          <input
            type="datetime-local"
            value={toDateTimeLocal(values.startsAt)}
            onChange={(e) =>
              e.target.value &&
              setValues({ ...values, startsAt: new Date(e.target.value) })
            }
          />
        </Field>
        <Field label="Ort oder Link" error={errors.location} wide>
          <input
            value={values.location}
            onChange={(e) => setValues({ ...values, location: e.target.value })}
          />
        </Field>
        <Field label="Notizen" error={errors.notes} wide>
          <textarea
            rows={3}
            value={values.notes}
            onChange={(e) => setValues({ ...values, notes: e.target.value })}
          />
        </Field>
        <DialogButtons
          onClose={onClose}
          onDelete={appointment ? remove : undefined}
        />
      </form>
    </Dialog>
  );
}

const CONTACT_FIELDS: {
  key: ContactFormField;
  label: string;
  type?: string;
}[] = [
  { key: 'name', label: 'Name *' },
  { key: 'role', label: 'Funktion' },
  { key: 'email', label: 'E-Mail', type: 'email' },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'linkedinUrl', label: 'LinkedIn', type: 'url' },
];

export function ContactDialog({
  applicationId,
  contact,
  onClose,
}: {
  applicationId: string;
  contact?: Contact;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const { repos } = useApp();
  const run = useAction();
  const [values, setValues] = useState<ContactFormValues>(
    contact ? contactToForm(contact) : emptyContactForm(),
  );
  const [errors, setErrors] = useState<
    Partial<Record<ContactFormField, string>>
  >({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseContactForm(values);
    if (!result.ok) return setErrors(result.errors);
    const saved = await run(
      () => repos.details.saveContact(applicationId, result.value, contact?.id),
      contact ? 'Kontakt gespeichert' : 'Kontakt angelegt',
    );
    if (saved) onClose();
  }

  async function remove() {
    if (
      !contact ||
      !(await confirm({
        title: `${contact.name} löschen?`,
        confirmLabel: 'Löschen',
        danger: true,
      }))
    )
      return;
    if (
      await run(
        () => repos.details.deleteContact(contact.id),
        'Kontakt gelöscht',
      )
    )
      onClose();
  }

  return (
    <Dialog
      title={contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
      open
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        {CONTACT_FIELDS.map(({ key, label, type }) => (
          <Field key={key} label={label} error={errors[key]}>
            <input
              type={type ?? 'text'}
              value={values[key]}
              autoFocus={key === 'name'}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </Field>
        ))}
        <DialogButtons
          onClose={onClose}
          onDelete={contact ? remove : undefined}
        />
      </form>
    </Dialog>
  );
}

export function CustomReminderDialog({
  applicationId,
  onClose,
}: {
  applicationId: string;
  onClose: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(toDateTimeLocal(tomorrow));
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError('Bitte einen Text angeben');
    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime()))
      return setError('Bitte einen Zeitpunkt wählen');
    const saved = await run(
      () => repos.reminders.addCustom(applicationId, title, due.toISOString()),
      'Erinnerung angelegt',
    );
    if (saved) onClose();
  }

  return (
    <Dialog title="Eigene Erinnerung" open onClose={onClose}>
      <form className="form-grid" onSubmit={submit} noValidate>
        <Field label="Woran erinnern?" error={error} wide>
          <input
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Wann?">
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>
        <DialogButtons onClose={onClose} />
      </form>
    </Dialog>
  );
}
