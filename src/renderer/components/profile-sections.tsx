import { Fragment, type ReactNode } from 'react';

import {
  compareEntriesNewestFirst,
  formatPeriod,
  PROFILE_ENTRY_KIND_LABELS,
  type ProfileEntryInput,
  type ProfileEntryKind,
  type ProfileLanguageInput,
  type ProfilePersonal,
  type ProfileSkillInput,
  LINK_KIND_LABELS,
  linkText,
  type ProfileLinkInput,
} from '@/domain/profile';

import type { ProfileDocument } from '@/domain/documents';

import { Empty, formatDate, Section } from '../ui';
import { DocumentChips } from './documents';

// Anzeige des Profils in Abschnitten. Mit `onEdit` bearbeitbar (Profilseite, Assistent), ohne nur
// lesbar (Vorschau des PDF-Imports). Die Listen tragen dort noch keine ids.

type WithId<T> = T & { id?: string };

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="link" onClick={onClick}>
      + {label}
    </button>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="link" onClick={onClick}>
      Bearbeiten
    </button>
  );
}

export function PersonalSection({
  personal,
  photo,
  onEdit,
}: {
  personal: ProfilePersonal;
  /** Bewerbungsfoto neben den Angaben (Profilseite) */
  photo?: ReactNode;
  onEdit?: () => void;
}) {
  const name = `${personal.firstName} ${personal.lastName}`.trim();
  const address = [
    personal.street,
    [personal.postalCode, personal.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
  const birth = [
    personal.birthDate && formatDate(personal.birthDate),
    personal.birthPlace && `in ${personal.birthPlace}`,
  ]
    .filter(Boolean)
    .join(' ');
  const facts: [string, string | undefined][] = [
    ['Name', name || undefined],
    ['Beruf', personal.headline],
    ['Anschrift', address || undefined],
    ['Telefon', personal.phone],
    ['E-Mail', personal.email],
    ['Geboren', birth || undefined],
  ];
  const filled = facts.filter((fact): fact is [string, string] => !!fact[1]);

  return (
    <Section
      title="Persönliche Daten"
      action={onEdit && <EditButton onClick={onEdit} />}
    >
      <div className={photo ? 'personal-with-photo' : undefined}>
        {filled.length ? (
          <dl className="facts">
            {filled.map(([label, value]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </Fragment>
            ))}
          </dl>
        ) : (
          <Empty>Noch keine persönlichen Daten.</Empty>
        )}
        {photo}
      </div>
    </Section>
  );
}

export function SummarySection({
  summary,
  onEdit,
}: {
  summary?: string;
  onEdit?: () => void;
}) {
  return (
    <Section
      title="Kurzprofil"
      action={onEdit && <EditButton onClick={onEdit} />}
    >
      {summary ? (
        <p className="prewrap profile-summary">{summary}</p>
      ) : (
        <Empty>
          Noch kein Kurzprofil – ein paar Sätze, wer du beruflich bist und was
          du suchst.
        </Empty>
      )}
    </Section>
  );
}

const ADD_LABELS: Record<ProfileEntryKind, string> = {
  experience: 'Station',
  education: 'Ausbildung',
  volunteer: 'Ehrenamt',
};

const EMPTY_TEXTS: Record<ProfileEntryKind, string> = {
  experience: 'Noch keine beruflichen Stationen.',
  education: 'Noch keine Aus- oder Weiterbildung.',
  volunteer: 'Noch kein Ehrenamt – z. B. Verein, Initiative oder Engagement.',
};

export function EntriesSection<E extends WithId<ProfileEntryInput>>({
  kind,
  entries,
  documents,
  onEdit,
}: {
  kind: ProfileEntryKind;
  entries: E[];
  /** Zugeordnete Dokumente je Station (id), z. B. das Arbeitszeugnis */
  documents?: ReadonlyMap<string, ProfileDocument[]>;
  /** Ohne Station: neue anlegen */
  onEdit?: (entry?: E) => void;
}) {
  const sorted = [...entries].sort(compareEntriesNewestFirst);
  return (
    <Section
      title={PROFILE_ENTRY_KIND_LABELS[kind]}
      action={
        onEdit && (
          <AddButton label={ADD_LABELS[kind]} onClick={() => onEdit()} />
        )
      }
    >
      {sorted.length ? (
        <ul className="rows">
          {sorted.map((entry, index) => {
            const body = (
              <>
                <span className="profile-period">{formatPeriod(entry)}</span>
                <span className="profile-entry">
                  <strong>{entry.title}</strong>
                  {(entry.organization || entry.location) && (
                    <span className="muted">
                      {[entry.organization, entry.location]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                  {entry.description && (
                    <ul className="profile-bullets">
                      {entry.description.split('\n').map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                </span>
              </>
            );
            return (
              <li key={entry.id ?? index} className="row">
                {onEdit ? (
                  <button
                    type="button"
                    className="row-main plain profile-row"
                    onClick={() => onEdit(entry)}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="row-main profile-row">{body}</div>
                )}
                {entry.id && documents?.get(entry.id) && (
                  <DocumentChips documents={documents.get(entry.id)!} />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>{EMPTY_TEXTS[kind]}</Empty>
      )}
    </Section>
  );
}

export function SkillsSection<S extends WithId<ProfileSkillInput>>({
  skills,
  onEdit,
}: {
  skills: S[];
  onEdit?: (skill?: S) => void;
}) {
  return (
    <Section
      title="Kenntnisse"
      action={
        onEdit && <AddButton label="Kenntnisse" onClick={() => onEdit()} />
      }
    >
      {skills.length ? (
        <ul className="rows">
          {skills.map((skill, index) => (
            <li key={skill.id ?? index} className="row">
              <SimpleRow
                label={skill.category}
                value={skill.items}
                onClick={onEdit && (() => onEdit(skill))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Noch keine Kenntnisse.</Empty>
      )}
    </Section>
  );
}

export function LanguagesSection<L extends WithId<ProfileLanguageInput>>({
  languages,
  onEdit,
}: {
  languages: L[];
  onEdit?: (language?: L) => void;
}) {
  return (
    <Section
      title="Sprachen"
      action={onEdit && <AddButton label="Sprache" onClick={() => onEdit()} />}
    >
      {languages.length ? (
        <ul className="rows">
          {languages.map((language, index) => (
            <li key={language.id ?? index} className="row">
              <SimpleRow
                label={language.language}
                value={language.level ?? ''}
                onClick={onEdit && (() => onEdit(language))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Noch keine Sprachen.</Empty>
      )}
    </Section>
  );
}

function SimpleRow({
  label,
  value,
  onClick,
}: {
  label?: string;
  value: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {label && <strong className="profile-label">{label}</strong>}
      <span>{value}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="row-main plain profile-row"
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <div className="row-main profile-row">{body}</div>
  );
}

export function LinksSection<K extends WithId<ProfileLinkInput>>({
  links,
  onEdit,
}: {
  links: K[];
  /** Ohne Link: neuen anlegen */
  onEdit?: (link?: K) => void;
}) {
  return (
    <Section
      title="Links"
      action={onEdit && <AddButton label="Link" onClick={() => onEdit()} />}
    >
      {links.length ? (
        <ul className="rows">
          {links.map((link, index) => (
            <li key={link.id ?? index} className="row">
              <div className="row-main profile-row">
                <strong className="profile-label">
                  {LINK_KIND_LABELS[link.kind]}
                </strong>
                {/* Öffnet im Standardbrowser (setWindowOpenHandler in main.ts) */}
                <a href={link.url} target="_blank" rel="noreferrer">
                  {linkText(link)}
                </a>
              </div>
              {onEdit && <EditButton onClick={() => onEdit(link)} />}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Noch keine Links – z. B. LinkedIn, XING, GitHub oder GitLab.
        </Empty>
      )}
    </Section>
  );
}
