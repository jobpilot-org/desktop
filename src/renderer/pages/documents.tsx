import { useRef, useState, type DragEvent } from 'react';

import {
  ATTACHMENT_KINDS,
  DOCUMENT_ACCEPT,
  DOCUMENT_SECTION_LABELS,
  entryLabel,
  PHOTO_ACCEPT,
  type ProfileDocument,
} from '@/domain/documents';

import { useData } from '../app-context';
import {
  documentMeta,
  DocumentDialog,
  PhotoThumb,
  useDocumentUpload,
  useOpenDocument,
} from '../components/documents';
import { Empty, LoadError, Section } from '../ui';
import { useProfile } from './profile';

/** Arbeitszeugnisse, Zertifikate, Abschlüsse, sonstige Anhänge und das Bewerbungsfoto */
export function DocumentsPage() {
  const state = useData((r) => r.documents.list());
  const { profile } = useProfile();
  const upload = useDocumentUpload(profile);
  const open = useOpenDocument();
  const [editing, setEditing] = useState<ProfileDocument>();
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const documents = state.data ?? [];
  const photo = documents.find((d) => d.kind === 'photo');
  const entries = [
    ...(profile?.experience ?? []),
    ...(profile?.education ?? []),
    ...(profile?.volunteering ?? []),
  ];
  const entryName = (id?: string) => {
    const entry = id && entries.find((e) => e.id === id);
    return entry ? entryLabel(entry) : undefined;
  };

  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length) upload.add(event.dataTransfer.files);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="jp-eyebrow">Deine Unterlagen</p>
          <h1>Dokumente</h1>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="primary"
            onClick={() => fileInput.current?.click()}
          >
            Hochladen
          </button>
        </div>
      </div>
      <p className="muted">
        Arbeitszeugnisse, Zertifikate und weitere Anhänge für deine Bewerbungen.
        Ordne sie einer Station im Profil zu – etwa das Zeugnis einer Firma der
        Station bei dieser Firma.
      </p>
      <input
        ref={fileInput}
        type="file"
        accept={DOCUMENT_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          upload.add(files);
        }}
      />
      <input
        ref={photoInput}
        type="file"
        accept={PHOTO_ACCEPT}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          upload.add(files.slice(0, 1), 'photo');
        }}
      />

      {state.status === 'error' && !state.data && (
        <LoadError error={state.error} />
      )}

      <div
        className={`dropzone section${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <strong>Dateien hierher ziehen</strong>
        <span className="muted small">
          PDF, JPG, PNG oder WebP, höchstens 10 MB je Datei
        </span>
      </div>

      <Section title="Bewerbungsfoto">
        <div className="photo-row">
          <PhotoThumb photo={photo} />
          <div className="photo-actions">
            <button type="button" onClick={() => photoInput.current?.click()}>
              {photo ? 'Foto ersetzen' : 'Foto hochladen'}
            </button>
            {photo && (
              <button
                type="button"
                className="link"
                onClick={() => setEditing(photo)}
              >
                Bearbeiten oder löschen
              </button>
            )}
          </div>
        </div>
      </Section>

      {ATTACHMENT_KINDS.map((kind) => {
        const list = documents.filter((d) => d.kind === kind);
        return (
          <Section key={kind} title={DOCUMENT_SECTION_LABELS[kind]}>
            {list.length ? (
              <ul className="rows">
                {list.map((document) => (
                  <li key={document.id} className="row">
                    <button
                      type="button"
                      className="row-main plain"
                      title="Öffnen"
                      onClick={() => void open(document)}
                    >
                      <strong>{document.title}</strong>
                      <span className="muted small">
                        {[
                          entryName(document.profileEntryId) ??
                            'Keiner Station zugeordnet',
                          documentMeta(document),
                        ].join(' · ')}
                      </span>
                    </button>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="link"
                        onClick={() => setEditing(document)}
                      >
                        Bearbeiten
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Noch keine.</Empty>
            )}
          </Section>
        );
      })}

      {upload.dialog}
      {editing && (
        <DocumentDialog
          document={editing}
          profile={profile}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
