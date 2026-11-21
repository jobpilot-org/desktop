import { useEffect, useState, type FormEvent } from 'react';

import {
  checkFile,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
  entryLabel,
  fileTypeLabel,
  formatFileSize,
  guessKind,
  parseDocumentForm,
  suggestEntry,
  titleFromFileName,
  type DocumentFormValues,
  type DocumentKind,
  type ProfileDocument,
} from '@/domain/documents';
import {
  compareEntriesNewestFirst,
  PROFILE_ENTRY_KIND_LABELS,
  type Profile,
  type ProfileEntry,
} from '@/domain/profile';

import { useApp } from '../app-context';
import { Dialog, Field, useAction, useToast } from '../ui';

// Bausteine der Dokumentenverwaltung – Dokumentenseite und Profil. Dateien liegen im privaten
// Bucket; geöffnet wird über eine kurzlebige signierte Adresse im Standardprogramm (Browser bzw.
// PDF-Betrachter, siehe main.ts), das Foto als Blob direkt in der App.

/** Öffnet ein Dokument außerhalb der App */
export function useOpenDocument() {
  const { repos } = useApp();
  const toast = useToast();
  return async (document: ProfileDocument) => {
    try {
      window.open(await repos.documents.signedUrl(document), '_blank');
    } catch {
      toast({ text: 'Das Dokument ließ sich nicht öffnen.' });
    }
  };
}

/** Vorschau des Bewerbungsfotos; lädt die Datei als Blob (die CSP erlaubt blob:-Bilder) */
export function PhotoThumb({
  photo,
  size = 96,
}: {
  photo?: ProfileDocument;
  size?: number;
}) {
  const { repos } = useApp();
  const [url, setUrl] = useState<string>();

  // Nur bei einer anderen Datei neu laden, nicht bei jedem Neuladen der Liste
  const path = photo?.storagePath;
  useEffect(() => {
    if (!photo) {
      setUrl(undefined);
      return;
    }
    let objectUrl: string | undefined;
    let active = true;
    repos.documents.download(photo).then(
      (blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      },
      () => active && setUrl(undefined),
    );
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- photo ändert sich nur mit path
  }, [path, repos]);

  return (
    <span
      className="photo-thumb"
      style={{ width: size, height: (size * 4) / 3 }}
      aria-label={photo ? 'Bewerbungsfoto' : 'Kein Bewerbungsfoto'}
      role="img"
    >
      {url ? <img src={url} alt="" /> : <span aria-hidden="true">👤</span>}
    </span>
  );
}

/** Kleine Knöpfe mit den Dokumenten einer Station */
export function DocumentChips({
  documents,
}: {
  documents: readonly ProfileDocument[];
}) {
  const open = useOpenDocument();
  if (!documents.length) return null;
  return (
    <span className="document-chips">
      {documents.map((document) => (
        <button
          key={document.id}
          type="button"
          className="document-chip"
          title={`${DOCUMENT_KIND_LABELS[document.kind]} öffnen`}
          onClick={() => void open(document)}
        >
          📎 {document.title}
        </button>
      ))}
    </span>
  );
}

/** „Arbeitszeugnis · PDF · 120 KB“ */
export function documentMeta(document: ProfileDocument) {
  return [
    DOCUMENT_KIND_LABELS[document.kind],
    fileTypeLabel(document.mimeType),
    formatFileSize(document.sizeBytes),
  ].join(' · ');
}

function sortedEntries(profile?: Profile) {
  return {
    experience: [...(profile?.experience ?? [])].sort(
      compareEntriesNewestFirst,
    ),
    education: [...(profile?.education ?? [])].sort(compareEntriesNewestFirst),
  };
}

/**
 * Neues Dokument (mit `file`) oder bestehendes bearbeiten (mit `document`). Bei neuen Dateien
 * schlägt der Dialog Titel, Art und Station aus dem Dateinamen vor; `kind` legt die Art fest
 * (z. B. beim Foto).
 */
export function DocumentDialog({
  file,
  document,
  kind,
  profile,
  onClose,
}: {
  file?: File;
  document?: ProfileDocument;
  kind?: DocumentKind;
  profile?: Profile;
  onClose: () => void;
}) {
  const { repos } = useApp();
  const run = useAction();
  const entries = [
    ...(profile?.experience ?? []),
    ...(profile?.education ?? []),
  ];
  const { experience, education } = sortedEntries(profile);
  const [values, setValues] = useState<DocumentFormValues>(() => {
    if (document) {
      return {
        kind: document.kind,
        title: document.title,
        profileEntryId: document.profileEntryId ?? '',
      };
    }
    const name = file?.name ?? '';
    const guessed = kind ?? guessKind(file ?? { name, type: '' });
    return {
      kind: guessed,
      title: guessed === 'photo' ? 'Bewerbungsfoto' : titleFromFileName(name),
      profileEntryId:
        guessed === 'photo' ? '' : (suggestEntry(name, entries)?.id ?? ''),
    };
  });
  const [errors, setErrors] = useState<
    Partial<Record<'title' | 'file', string>>
  >({});
  const [busy, setBusy] = useState(false);

  // Nur das Foto ist an Bildformate gebunden; die Art kann deshalb die Datei ungültig machen
  const fileError = file ? checkFile(file, values.kind) : undefined;
  const isPhoto = values.kind === 'photo';
  const kinds =
    document?.kind === 'photo' || kind === 'photo'
      ? (['photo'] as const)
      : DOCUMENT_KINDS;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = parseDocumentForm(values, entries);
    if (!result.ok) return setErrors(result.errors);
    if (fileError) return setErrors({ file: fileError });
    setBusy(true);
    const ok = await run(
      () =>
        document
          ? repos.documents.update(document.id, result.value)
          : repos.documents.upload(file!, result.value),
      document ? 'Gespeichert' : 'Hochgeladen',
    );
    setBusy(false);
    if (ok) onClose();
  }

  async function remove() {
    if (!document || !confirm(`„${document.title}“ löschen?`)) return;
    if (await run(() => repos.documents.remove(document), 'Gelöscht'))
      onClose();
  }

  const entryOption = (entry: ProfileEntry) => (
    <option key={entry.id} value={entry.id}>
      {entryLabel(entry)}
    </option>
  );

  return (
    <Dialog
      title={document ? 'Dokument bearbeiten' : 'Dokument hochladen'}
      open
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        {file && (
          <p className="wide muted small">
            {file.name} · {formatFileSize(file.size)}
          </p>
        )}
        <Field label="Titel" error={errors.title} wide>
          <input
            autoFocus
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
        </Field>
        <Field label="Art" error={fileError ?? errors.file}>
          <select
            value={values.kind}
            disabled={kinds.length === 1}
            onChange={(e) => {
              const next = e.target.value as DocumentKind;
              setValues({
                ...values,
                kind: next,
                profileEntryId: next === 'photo' ? '' : values.profileEntryId,
              });
            }}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {DOCUMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        {!isPhoto && (
          <Field label="Gehört zu">
            <select
              value={values.profileEntryId}
              onChange={(e) =>
                setValues({ ...values, profileEntryId: e.target.value })
              }
            >
              <option value="">Keiner Station</option>
              {experience.length > 0 && (
                <optgroup label={PROFILE_ENTRY_KIND_LABELS.experience}>
                  {experience.map(entryOption)}
                </optgroup>
              )}
              {education.length > 0 && (
                <optgroup label={PROFILE_ENTRY_KIND_LABELS.education}>
                  {education.map(entryOption)}
                </optgroup>
              )}
            </select>
          </Field>
        )}
        <div className="dialog-buttons">
          {document && (
            <button
              type="button"
              className="danger"
              onClick={() => void remove()}
            >
              Löschen
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="submit"
            className="primary"
            disabled={busy || !!fileError}
          >
            {document ? 'Speichern' : busy ? 'Wird hochgeladen …' : 'Hochladen'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Mehrere gewählte Dateien nacheinander im Dialog bestätigen. `add(files, kind?)` reiht sie ein;
 * `dialog` zeigt den Dialog für die erste Datei der Warteschlange.
 */
export function useDocumentUpload(profile?: Profile) {
  const [queue, setQueue] = useState<{ file: File; kind?: DocumentKind }[]>([]);
  const current = queue[0];
  const add = (files: Iterable<File>, kind?: DocumentKind) =>
    setQueue((q) => [...q, ...Array.from(files, (file) => ({ file, kind }))]);
  const dialog = current && (
    <DocumentDialog
      // Neuer Schlüssel je Datei, damit das Formular frisch startet
      key={`${current.file.name}-${current.file.lastModified}-${queue.length}`}
      file={current.file}
      kind={current.kind}
      profile={profile}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  );
  return { add, dialog };
}
