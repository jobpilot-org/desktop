import { createId } from '@/domain/application';
import {
  mimeTypeOf,
  storagePath,
  type DocumentInput,
  type ProfileDocument,
} from '@/domain/documents';

import { toDocument, unwrap, unwrapList } from './mappers';
import type { Supabase } from './supabase';

const BUCKET = 'documents';

/**
 * Dokumente des angemeldeten Nutzers: Datei im privaten Bucket `documents`, Metadaten in der
 * Tabelle `documents`. Pfad `<user_id>/<document_id>/<datei>` – die Storage-Policies lassen nur den
 * eigenen Ordner zu.
 */
export function createDocumentsRepository(supabase: Supabase) {
  const storage = () => supabase.storage.from(BUCKET);

  async function userId() {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Nicht angemeldet');
    return id;
  }

  async function removeFiles(paths: string[]) {
    // Bleibt eine Datei liegen, ist das kein Grund für einen Fehler – die Zeile ist schon weg
    if (paths.length) await storage().remove(paths);
  }

  return {
    async list(): Promise<ProfileDocument[]> {
      const rows = unwrapList(
        await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false }),
      );
      return rows.map(toDocument);
    },

    /**
     * Lädt die Datei hoch und legt die Zeile an. Ein neues Foto ersetzt das bisherige (es gibt
     * höchstens eins). Scheitert das Anlegen, wird die hochgeladene Datei wieder entfernt.
     */
    async upload(file: File, input: DocumentInput): Promise<ProfileDocument> {
      const mimeType = mimeTypeOf(file);
      if (!mimeType) throw new Error('Dateityp nicht erlaubt');
      const id = createId();
      const path = storagePath(await userId(), id, file.name);
      unwrap(
        await storage().upload(path, file, {
          contentType: mimeType,
          upsert: false,
        }),
      );
      try {
        const oldPhotos =
          input.kind === 'photo'
            ? unwrapList(
                await supabase
                  .from('documents')
                  .delete()
                  .eq('kind', 'photo')
                  .select('storage_path'),
              )
            : [];
        const row = unwrap(
          await supabase
            .from('documents')
            .insert({
              id,
              kind: input.kind,
              title: input.title,
              file_name: file.name,
              mime_type: mimeType,
              size_bytes: file.size,
              storage_path: path,
              profile_entry_id: input.profileEntryId ?? null,
            })
            .select('*')
            .single(),
        );
        if (!row) throw new Error('Dokument wurde nicht angelegt');
        await removeFiles(oldPhotos.map((photo) => photo.storage_path));
        return toDocument(row);
      } catch (error) {
        await removeFiles([path]);
        throw error;
      }
    },

    /** Titel, Art und Zuordnung ändern */
    async update(id: string, input: DocumentInput) {
      unwrap(
        await supabase
          .from('documents')
          .update({
            kind: input.kind,
            title: input.title,
            profile_entry_id: input.profileEntryId ?? null,
          })
          .eq('id', id),
      );
    },

    async remove(document: ProfileDocument) {
      unwrap(await supabase.from('documents').delete().eq('id', document.id));
      await removeFiles([document.storagePath]);
    },

    /** Kurzlebige Adresse zum Öffnen im Browser bzw. PDF-Betrachter */
    async signedUrl(document: ProfileDocument, expiresInSeconds = 120) {
      const data = unwrap(
        await storage().createSignedUrl(document.storagePath, expiresInSeconds),
      );
      if (!data) throw new Error('Keine Adresse für das Dokument');
      return data.signedUrl;
    },

    /** Datei als Blob, z. B. für die Vorschau des Fotos */
    async download(document: ProfileDocument) {
      const blob = unwrap(await storage().download(document.storagePath));
      if (!blob) throw new Error('Dokument nicht gefunden');
      return blob;
    },
  };
}
