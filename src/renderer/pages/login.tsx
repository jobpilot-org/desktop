import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

// Dasselbe Icon wie das App-Symbol (packagerConfig.icon); alt bleibt leer, der Schriftzug darunter
// nennt den Namen schon
import appIcon from '../../../assets/icon.png';
import { useApp } from '../app-context';
import { Field, PasswordInput } from '../ui';

/** Supabase-Meldungen auf Deutsch */
function loginMessage(code: string | undefined, message: string) {
  if (code === 'invalid_credentials') return 'E-Mail oder Passwort ist falsch.';
  if (code === 'email_not_confirmed')
    return 'Die E-Mail-Adresse ist noch nicht bestätigt.';
  if (message.toLowerCase().includes('fetch')) {
    return 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.';
  }
  return message;
}

export function LoginPage() {
  const { supabase } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    // Bei Erfolg wechselt die App über onAuthStateChange zur Übersicht
    if (signInError)
      setError(loginMessage(signInError.code, signInError.message));
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img className="login-icon" src={appIcon} alt="" />
        <h1>
          jobpilot<span className="jp-brand__dot">.</span>
        </h1>
        <p className="muted">Bitte melde dich an.</p>
        <Field label="E-Mail">
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Passwort">
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && <p className="error-box">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
        <Link className="login-switch" to="/registrieren">
          Neuen Benutzer anlegen
        </Link>
      </form>
    </div>
  );
}
