import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import appIcon from '../../../assets/icon.png';
import {
  emptyRegistrationForm,
  parseRegistrationForm,
  type RegistrationFormField,
  type RegistrationFormValues,
} from '@/domain/forms';

import { useApp } from '../app-context';
import { signUp } from '../sign-up';
import { Field, PasswordInput } from '../ui';

export function RegisterPage() {
  const { supabase } = useApp();
  const [values, setValues] = useState(emptyRegistrationForm);
  const [errors, setErrors] = useState<
    Partial<Record<RegistrationFormField, string>>
  >({});
  const [error, setError] = useState<string>();
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  function input(field: keyof RegistrationFormValues) {
    return {
      value: values[field],
      onChange: (e: { target: { value: string } }) =>
        setValues((current) => ({ ...current, [field]: e.target.value })),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    const parsed = parseRegistrationForm(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await signUp(supabase, parsed.value);
    setBusy(false);
    if (result.status === 'email-taken') {
      setErrors({ email: 'Für diese E-Mail-Adresse gibt es schon ein Konto.' });
    } else if (result.status === 'error') {
      setError(result.message);
    } else if (result.status === 'confirm-email') {
      setConfirmEmail(true);
    }
  }

  if (confirmEmail) {
    return (
      <div className="login">
        <div className="login-card">
          <img className="login-icon" src={appIcon} alt="" />
          <h1>Fast geschafft</h1>
          <p className="muted">
            Wir haben dir eine E-Mail an {values.email.trim()} geschickt. Bitte
            bestätige darin deine Adresse und melde dich danach an.
          </p>
          <Link className="login-switch" to="/">
            Zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <img className="login-icon" src={appIcon} alt="" />
        <h1>
          jobpilot<span className="jp-brand__dot">.</span>
        </h1>
        <p className="muted">Neuen Benutzer anlegen.</p>
        <div className="login-name-row">
          <Field label="Vorname" error={errors.firstName}>
            <input
              autoComplete="given-name"
              autoFocus
              {...input('firstName')}
            />
          </Field>
          <Field label="Nachname" error={errors.lastName}>
            <input autoComplete="family-name" {...input('lastName')} />
          </Field>
        </div>
        <Field label="E-Mail" error={errors.email}>
          <input type="email" autoComplete="username" {...input('email')} />
        </Field>
        <Field label="Passwort" error={errors.password}>
          <PasswordInput autoComplete="new-password" {...input('password')} />
        </Field>
        <Field label="Passwort wiederholen" error={errors.passwordRepeat}>
          <PasswordInput
            autoComplete="new-password"
            {...input('passwordRepeat')}
          />
        </Field>
        {error && <p className="error-box">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Konto wird angelegt …' : 'Konto anlegen'}
        </button>
        <Link className="login-switch" to="/">
          Abbrechen
        </Link>
      </form>
    </div>
  );
}
