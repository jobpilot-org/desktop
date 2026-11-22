import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  detectAddress,
  emptyLetter,
  LETTER_ADDRESS_LABELS,
  LETTER_ADDRESSES,
  hasContent,
  LETTER_LENGTH_LABELS,
  LETTER_LENGTHS,
  LETTER_TONE_HINTS,
  LETTER_TONE_LABELS,
  LETTER_TONES,
  letterParts,
  letterText,
  salutationOptions,
  SECTION_HINTS,
  SECTION_LABELS,
  suggestedStrengths,
  type CoverLetterInput,
  type LetterAddress,
  type LetterPosting,
  type SectionKey,
} from '@/domain/cover-letter';
import type { Profile } from '@/domain/profile';
import type { Repositories } from '@/data';
import { CoverLetterError } from '@/data/cover-letters';

import { errorMessage, useApp, useData } from '../app-context';
import { Field, LoadError, useToast } from '../ui';
import { useProfile } from './profile';

const CONSENT_TEXT =
  'Für das Anschreiben werden dein Profil – ohne Name, Anschrift, Telefon, E-Mail und Geburtsdaten – und der Anzeigentext an den jobpilot-Server gesendet und von dort mit deinem eigenen KI-Key an den KI-Anbieter (Anthropic) weitergeleitet.';

const STEPS = [
  {
    title: 'Ansprache',
    intro:
      'Wen sprichst du an? Die Vorschläge kommen aus der Ansprechperson der Anzeige.',
  },
  {
    title: 'Ton & Stärken',
    intro:
      'Wie soll das Schreiben klingen, und welche Stärken sollen auf die Stelle bezogen herausstechen?',
  },
  {
    title: 'Abschnitt für Abschnitt',
    intro:
      'Der Vorschlag der KI – jeden Abschnitt kannst du direkt ändern oder mit einem Wunsch neu vorschlagen lassen.',
  },
  {
    title: 'Vorschau',
    intro: 'So sieht dein Anschreiben aus. Absender kommt aus deinem Profil.',
  },
];

export type LetterKind = 'posting' | 'application';

type Loaded = {
  posting: LetterPosting;
  target: { postingId?: string; applicationId?: string };
  backTo: string;
  backLabel: string;
  letter?: { id: string; input: CoverLetterInput };
};

async function loadTarget(
  r: Repositories,
  kind: LetterKind,
  id: string,
): Promise<Loaded | undefined> {
  if (kind === 'posting') {
    const posting = await r.jobPostings.get(id);
    if (!posting) return undefined;
    const target = {
      postingId: posting.id,
      applicationId: posting.applicationId,
    };
    const letter = await r.coverLetters.find(target);
    return {
      posting,
      target,
      backTo: `/stellen/${id}`,
      backLabel: posting.company,
      letter: letter && { id: letter.id, input: letter },
    };
  }
  const [application, posting, contacts] = await Promise.all([
    r.applications.get(id),
    r.jobPostings.findByApplication(id),
    r.details.contacts(id),
  ]);
  if (!application) return undefined;
  const letter = await r.coverLetters.find({
    applicationId: id,
    postingId: posting?.id,
  });
  return {
    posting: {
      company: application.company,
      role: application.role,
      location: application.location || posting?.location,
      jobDescription: application.jobDescription || posting?.jobDescription,
      contactName: posting?.contactName ?? contacts[0]?.name,
      fit: posting?.fit,
    },
    target: { applicationId: id, postingId: posting?.id },
    backTo: `/bewerbung/${id}`,
    backLabel: application.company,
    // Ein Anschreiben vom Stellenangebot wandert beim Speichern zur Bewerbung mit
    letter: letter && {
      id: letter.id,
      input: { ...letter, applicationId: id },
    },
  };
}

/** Assistent fürs Anschreiben: Ansprache → Ton & Stärken → Abschnitte → Vorschau */
export function CoverLetterPage({ kind }: { kind: LetterKind }) {
  const { id = '' } = useParams();
  const state = useData((r) => loadTarget(r, kind, id), [kind, id]);
  const { profile } = useProfile();

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (state.data === undefined && state.status === 'loading') return null;
  if (!state.data) {
    return (
      <div className="page">
        <p className="empty">
          Dazu gibt es nichts mehr. <Link to="/">Zur Übersicht</Link>
        </p>
      </div>
    );
  }
  // Beim Wechsel zu einem anderen Anschreiben noch die alten Daten: nicht damit starten
  const expected = kind === 'posting' ? `/stellen/${id}` : `/bewerbung/${id}`;
  if (!profile || state.data.backTo !== expected) return null;
  // Ein Mal mit den geladenen Daten starten; danach hält der Assistent den Stand selbst
  return (
    <LetterWizard key={`${kind}-${id}`} loaded={state.data} profile={profile} />
  );
}

function LetterWizard({
  loaded,
  profile,
}: {
  loaded: Loaded;
  profile: Profile;
}) {
  const { repos, notifyChange } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const { posting } = loaded;
  const [letterId, setLetterId] = useState(loaded.letter?.id);
  const [letter, setLetter] = useState<CoverLetterInput>(
    () => loaded.letter?.input ?? emptyLetter(loaded.target, posting),
  );
  // Vorhandenes Anschreiben: gleich die Vorschau
  const [step, setStep] = useState(
    loaded.letter && hasContent(loaded.letter.input) ? 3 : 0,
  );
  const [busy, setBusy] = useState<'draft' | SectionKey>();
  const [error, setError] = useState<string>();
  const [missingKey, setMissingKey] = useState(false);
  const [model, setModel] = useState<string>();

  const profileEmpty =
    !profile.summary?.trim() &&
    !profile.headline?.trim() &&
    profile.experience.length === 0 &&
    profile.education.length === 0;

  const update = (patch: Partial<CoverLetterInput>) =>
    setLetter((current) => ({ ...current, ...patch }));

  async function save(next = letter, usedModel = model) {
    try {
      const savedId = await repos.coverLetters.save(next, letterId, usedModel);
      setLetterId(savedId);
      notifyChange();
      return true;
    } catch (e) {
      toast({ text: `Speichern fehlgeschlagen: ${errorMessage(e)}` });
      return false;
    }
  }

  async function goTo(next: number) {
    if (await save()) setStep(next);
  }

  /** Zustimmung zur KI-Nutzung einmalig einholen (wie KI-Check und Passung) */
  async function consent() {
    if ((await repos.settings.get('ai.consent')) === 'yes') return true;
    if (!confirm(`${CONSENT_TEXT}\n\nEinverstanden?`)) return false;
    await repos.settings.set('ai.consent', 'yes');
    return true;
  }

  function showError(e: unknown) {
    setMissingKey(e instanceof CoverLetterError && e.code === 'missing-key');
    setError(
      e instanceof CoverLetterError
        ? e.message
        : 'Das hat nicht geklappt. Bitte noch einmal versuchen.',
    );
  }

  async function draft() {
    if (
      hasContent(letter) &&
      !confirm('Der neue Vorschlag ersetzt alle Abschnitte. Fortfahren?')
    )
      return;
    if (!(await consent())) return;
    setError(undefined);
    setBusy('draft');
    try {
      const result = await repos.coverLetters.draft(profile, posting, letter);
      const next = {
        ...letter,
        subject: result.subject || letter.subject,
        sections: result.sections,
      };
      setLetter(next);
      setModel(result.model);
      if (await save(next, result.model)) setStep(2);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(undefined);
    }
  }

  async function rewrite(key: SectionKey, hint: string) {
    if (!(await consent())) return;
    setError(undefined);
    setBusy(key);
    try {
      const text = await repos.coverLetters.rewriteSection(
        profile,
        posting,
        letter,
        key,
        hint,
      );
      const next = {
        ...letter,
        sections: letter.sections.map((s) =>
          s.key === key ? { ...s, text } : s,
        ),
      };
      setLetter(next);
      await save(next);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(undefined);
    }
  }

  /** Bisheriges Anschreiben verwerfen und mit frischen Vorschlägen von vorn beginnen */
  async function restart() {
    if (
      !confirm(
        'Neu beginnen? Ansprache, Ton, Stärken und alle Abschnitte werden verworfen.',
      )
    )
      return;
    const fresh = emptyLetter(loaded.target, posting);
    setLetter(fresh);
    setModel(undefined);
    setError(undefined);
    if (await save(fresh, undefined)) {
      setStep(0);
      window.scrollTo({ top: 0 });
      toast({ text: 'Anschreiben zurückgesetzt' });
    }
  }

  const { title, intro } = STEPS[step]!;

  return (
    <div className="page cover-letter">
      <nav className="back">
        <Link to={loaded.backTo}>← {loaded.backLabel}</Link>
      </nav>
      <p className="jp-eyebrow">
        Anschreiben · Schritt {step + 1} von {STEPS.length}
      </p>
      <h1>{title}</h1>
      <p className="subtitle">
        {posting.role} bei {posting.company}
      </p>
      <ol className="steps" aria-hidden="true">
        {STEPS.map((s, index) => (
          <li key={s.title} className={index <= step ? 'is-done' : undefined} />
        ))}
      </ol>
      <p className="muted">{intro}</p>

      {step === 0 && (
        <SalutationStep
          posting={posting}
          value={letter.salutation}
          address={letter.address}
          onChange={(salutation) => update({ salutation })}
          onAddress={(address) =>
            update({
              address,
              salutation: salutationOptions(posting, address)[0]!.value,
            })
          }
        />
      )}
      {step === 1 && (
        <StyleStep
          posting={posting}
          letter={letter}
          onChange={update}
          profileEmpty={profileEmpty}
        />
      )}
      {step === 2 && (
        <SectionsStep
          letter={letter}
          onChange={update}
          busy={busy}
          onRewrite={rewrite}
        />
      )}
      {step === 3 && (
        <Preview letter={letter} profile={profile} posting={posting} />
      )}

      {error && (
        <p className="error-box">
          {error}
          {missingKey && (
            <>
              {' '}
              <Link to="/einstellungen">In den Einstellungen hinterlegen</Link>
            </>
          )}
        </p>
      )}

      <div className="wizard-buttons">
        {step > 0 && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void goTo(step - 1)}
          >
            Zurück
          </button>
        )}
        {step === 0 && (
          <button
            type="button"
            className="primary"
            disabled={!letter.salutation.trim()}
            onClick={() => void goTo(1)}
          >
            Weiter
          </button>
        )}
        {step === 1 && (
          <>
            <button
              type="button"
              className="primary"
              disabled={Boolean(busy) || profileEmpty}
              onClick={() => void draft()}
            >
              {busy === 'draft'
                ? 'Anschreiben wird geschrieben …'
                : hasContent(letter)
                  ? 'Neu vorschlagen lassen'
                  : 'Anschreiben vorschlagen lassen'}
            </button>
            {hasContent(letter) && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void goTo(2)}
              >
                Weiter mit bisherigem Text
              </button>
            )}
          </>
        )}
        {step === 2 && (
          <button
            type="button"
            className="primary"
            disabled={Boolean(busy)}
            onClick={() => void goTo(3)}
          >
            Zur Vorschau
          </button>
        )}
        {step === 3 && (
          <>
            <button
              type="button"
              className="primary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(letterText(letter, profile, posting))
                  .then(() => toast({ text: 'Anschreiben kopiert' }))
              }
            >
              Text kopieren
            </button>
            <button type="button" onClick={() => setStep(2)}>
              Abschnitte bearbeiten
            </button>
            <button type="button" onClick={() => navigate(loaded.backTo)}>
              Fertig
            </button>
          </>
        )}
        {hasContent(letter) && (
          <button
            type="button"
            className="wizard-buttons__end danger"
            disabled={Boolean(busy)}
            onClick={() => void restart()}
          >
            Neu beginnen
          </button>
        )}
      </div>
    </div>
  );
}

function SalutationStep({
  posting,
  value,
  address,
  onChange,
  onAddress,
}: {
  posting: LetterPosting;
  value: string;
  address: LetterAddress;
  onChange: (value: string) => void;
  onAddress: (address: LetterAddress) => void;
}) {
  const options = salutationOptions(posting, address);
  const custom = !options.some((o) => o.value === value);
  const detected = detectAddress(posting.jobDescription);
  return (
    <div className="letter-step">
      <h2 className="letter-step__title">Du oder Sie</h2>
      <div className="segmented" role="group" aria-label="Du oder Sie">
        {LETTER_ADDRESSES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={address === option}
            onClick={() => onAddress(option)}
          >
            {LETTER_ADDRESS_LABELS[option]}
            {detected === option ? ' · wie die Anzeige' : ''}
          </button>
        ))}
      </div>
      <p className="small muted">
        {detected
          ? `Die Anzeige ${detected === 'du' ? 'duzt' : 'siezt'} – Vorschlag: ${LETTER_ADDRESS_LABELS[detected]}.`
          : 'Aus der Anzeige ist nicht klar, ob geduzt wird – im Zweifel Sie.'}
      </p>
      <h2 className="letter-step__title">Anrede</h2>
      <p className="small muted">
        {posting.contactName
          ? `Ansprechperson laut Anzeige: ${posting.contactName}.${address === 'sie' ? ' Ob Frau oder Herr, wählst du selbst.' : ''}`
          : 'In der Anzeige steht keine Ansprechperson – wenn du einen Namen kennst, trag die Anrede selbst ein.'}
      </p>
      <div className="option-list" role="radiogroup" aria-label="Anrede">
        {options.map((option) => (
          <label key={option.value} className="option">
            <input
              type="radio"
              name="salutation"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
        <label className="option">
          <input
            type="radio"
            name="salutation"
            checked={custom}
            onChange={() => onChange('')}
          />
          Eigene Anrede
        </label>
      </div>
      {custom && (
        <input
          autoFocus
          aria-label="Eigene Anrede"
          placeholder="z. B. Hallo Julia,"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function StyleStep({
  posting,
  letter,
  onChange,
  profileEmpty,
}: {
  posting: LetterPosting;
  letter: CoverLetterInput;
  onChange: (patch: Partial<CoverLetterInput>) => void;
  profileEmpty: boolean;
}) {
  const [own, setOwn] = useState('');
  const suggestions = suggestedStrengths(posting);
  const all = [
    ...suggestions,
    ...letter.strengths.filter((s) => !suggestions.includes(s)),
  ];
  const toggle = (strength: string) =>
    onChange({
      strengths: letter.strengths.includes(strength)
        ? letter.strengths.filter((s) => s !== strength)
        : [...letter.strengths, strength],
    });

  function addOwn() {
    const value = own.trim();
    if (!value) return;
    if (!letter.strengths.includes(value))
      onChange({ strengths: [...letter.strengths, value] });
    setOwn('');
  }

  return (
    <div className="letter-step">
      <h2 className="letter-step__title">Tonalität</h2>
      <div className="tone-choices">
        {LETTER_TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            className="choice"
            aria-pressed={letter.tone === tone}
            onClick={() => onChange({ tone })}
          >
            <strong>{LETTER_TONE_LABELS[tone]}</strong>
            <span className="muted small">{LETTER_TONE_HINTS[tone]}</span>
          </button>
        ))}
      </div>

      <h2 className="letter-step__title">Länge</h2>
      <div className="segmented" role="group" aria-label="Länge">
        {LETTER_LENGTHS.map((length) => (
          <button
            key={length}
            type="button"
            aria-pressed={letter.length === length}
            onClick={() => onChange({ length })}
          >
            {LETTER_LENGTH_LABELS[length]}
          </button>
        ))}
      </div>

      <h2 className="letter-step__title">Stärken hervorheben</h2>
      <p className="small muted">
        {suggestions.length
          ? 'Vorschläge aus der Passung – wähle, was auf die Stelle bezogen herausstechen soll.'
          : 'Noch keine Passung bewertet – trag ein, was herausstechen soll, oder lass die KI aus deinem Profil wählen.'}
      </p>
      {all.length > 0 && (
        <div className="chips">
          {all.map((strength) => (
            <button
              key={strength}
              type="button"
              className="chip"
              aria-pressed={letter.strengths.includes(strength)}
              onClick={() => toggle(strength)}
            >
              {letter.strengths.includes(strength) ? '✓ ' : ''}
              {strength}
            </button>
          ))}
        </div>
      )}
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          addOwn();
        }}
      >
        <input
          aria-label="Eigene Stärke"
          placeholder="Eigene Stärke, z. B. Projekte mit Kanzleien"
          value={own}
          onChange={(e) => setOwn(e.target.value)}
        />
        <button type="submit" disabled={!own.trim()}>
          Hinzufügen
        </button>
      </form>

      {!posting.jobDescription?.trim() && (
        <p className="small muted">
          Ohne Anzeigentext kennt die KI nur Firma und Position – das
          Anschreiben wird allgemeiner.
        </p>
      )}
      {profileEmpty && (
        <p className="error-box">
          Dein Profil ist noch leer – die KI braucht deinen Lebenslauf.{' '}
          <Link to="/profil">Profil pflegen</Link>
        </p>
      )}
    </div>
  );
}

function SectionsStep({
  letter,
  onChange,
  busy,
  onRewrite,
}: {
  letter: CoverLetterInput;
  onChange: (patch: Partial<CoverLetterInput>) => void;
  busy?: 'draft' | SectionKey;
  onRewrite: (key: SectionKey, hint: string) => Promise<void>;
}) {
  return (
    <div className="letter-step">
      <Field label="Betreff">
        <input
          value={letter.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
        />
      </Field>
      <p className="letter-salutation">{letter.salutation}</p>
      {letter.sections.map((section) => (
        <SectionEditor
          key={section.key}
          sectionKey={section.key}
          text={section.text}
          busy={busy === section.key}
          disabled={Boolean(busy)}
          onChange={(text) =>
            onChange({
              sections: letter.sections.map((s) =>
                s.key === section.key ? { ...s, text } : s,
              ),
            })
          }
          onRewrite={(hint) => onRewrite(section.key, hint)}
        />
      ))}
      <Field label="Grußformel">
        <input
          value={letter.closing}
          onChange={(e) => onChange({ closing: e.target.value })}
        />
      </Field>
    </div>
  );
}

function SectionEditor({
  sectionKey,
  text,
  busy,
  disabled,
  onChange,
  onRewrite,
}: {
  sectionKey: SectionKey;
  text: string;
  busy: boolean;
  disabled: boolean;
  onChange: (text: string) => void;
  onRewrite: (hint: string) => Promise<void>;
}) {
  const [hint, setHint] = useState('');
  return (
    <section className="card letter-section" aria-busy={busy}>
      <header>
        <h3>{SECTION_LABELS[sectionKey]}</h3>
        <span className="muted small">{SECTION_HINTS[sectionKey]}</span>
      </header>
      <AutoTextarea
        value={text}
        disabled={busy}
        aria-label={SECTION_LABELS[sectionKey]}
        onChange={onChange}
      />
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onRewrite(hint).then(() => setHint(''));
        }}
      >
        <input
          aria-label={`Wunsch für „${SECTION_LABELS[sectionKey]}“`}
          placeholder="Wunsch, z. B. kürzer, mehr zu Supabase, ohne Fachbegriffe"
          value={hint}
          disabled={disabled}
          onChange={(e) => setHint(e.target.value)}
        />
        <button type="submit" disabled={disabled}>
          {busy ? 'Wird geschrieben …' : 'Neu vorschlagen'}
        </button>
      </form>
    </section>
  );
}

/** Textfeld, das mit dem Inhalt wächst */
function AutoTextarea({
  value,
  onChange,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const [element, setElement] = useState<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [element, value]);
  return (
    <textarea
      ref={setElement}
      className="letter-textarea"
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

function Preview({
  letter,
  profile,
  posting,
}: {
  letter: CoverLetterInput;
  profile: Profile;
  posting: LetterPosting;
}) {
  const missing = [
    !profile.street && 'Anschrift',
    !profile.phone && 'Telefon',
    !profile.email && 'E-Mail',
  ].filter(Boolean);
  return (
    <>
      {missing.length > 0 && (
        <p className="small muted">
          Im Absender fehlt {missing.join(', ')} –{' '}
          <Link to="/profil">im Profil ergänzen</Link>.
        </p>
      )}
      <LetterPaper letter={letter} profile={profile} posting={posting} />
    </>
  );
}

/** Der Brief wie auf Papier: Absender, Empfänger, Datum rechtsbündig, Betreff fett */
function LetterPaper({
  letter,
  profile,
  posting,
}: {
  letter: CoverLetterInput;
  profile: Profile;
  posting: LetterPosting;
}) {
  const parts = letterParts(letter, profile, posting);
  return (
    <article className="letter-paper">
      {parts.sender.length > 0 && (
        <p className="letter-paper__sender">{parts.sender.join('\n')}</p>
      )}
      {parts.recipient.length > 0 && <p>{parts.recipient.join('\n')}</p>}
      <p className="letter-paper__date">{parts.date}</p>
      {parts.subject && (
        <p className="letter-paper__subject">{parts.subject}</p>
      )}
      {parts.salutation && <p>{parts.salutation}</p>}
      {parts.body.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      <p>
        {parts.closing}
        {'\n\n'}
        {parts.name}
      </p>
    </article>
  );
}
