import type { ProfileEntry } from '@/domain/profile';

// Dokumente des Nutzers: Arbeitszeugnisse, Zertifikate, Abschlusszeugnisse, sonstige Anhänge und
// ein Bewerbungsfoto. Die Datei liegt im privaten Storage-Bucket `documents` (backend), die
// Metadaten in der Tabelle `documents`. Dokumente lassen sich einer Station des Profils zuordnen,
// z. B. das Arbeitszeugnis einer Firma der Station bei dieser Firma.

export const DOCUMENT_KINDS = ['photo', 'reference', 'certificate', 'diploma', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Alles außer dem Foto – die Arten, die einer Station zugeordnet werden können */
export const ATTACHMENT_KINDS = ['reference', 'certificate', 'diploma', 'other'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  photo: 'Bewerbungsfoto',
  reference: 'Arbeitszeugnis',
  certificate: 'Zertifikat',
  diploma: 'Abschlusszeugnis',
  other: 'Sonstiges',
};

/** Überschriften der Abschnitte auf der Dokumentenseite */
export const DOCUMENT_SECTION_LABELS: Record<AttachmentKind, string> = {
  reference: 'Arbeitszeugnisse',
  certificate: 'Zertifikate',
  diploma: 'Abschlusszeugnisse',
  other: 'Sonstige Anhänge',
};

/** Wie im Bucket `documents` erlaubt */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
export const PHOTO_MIME_TYPES: readonly DocumentMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Für `<input type="file" accept>` */
export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export type ProfileDocument = {
  id: string;
  kind: DocumentKind;
  title: string;
  fileName: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
  storagePath: string;
  /** Station des Profils, zu der das Dokument gehört */
  profileEntryId?: string;
  createdAt: string;
};

export type DocumentInput = {
  kind: DocumentKind;
  title: string;
  profileEntryId?: string;
};

/** Was von einer gewählten Datei gebraucht wird (File im Browser) */
export type FileInfo = { name: string; type: string; size: number };

const EXTENSION_TYPES: Record<string, DocumentMimeType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/** MIME-Typ der Datei; manche Systeme liefern keinen, dann zählt die Endung */
export function mimeTypeOf(file: Pick<FileInfo, 'name' | 'type'>): DocumentMimeType | undefined {
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type as DocumentMimeType;
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension];
}

/** Fehlermeldung, wenn die Datei nicht passt; sonst undefined */
export function checkFile(file: FileInfo, kind: DocumentKind): string | undefined {
  const type = mimeTypeOf(file);
  if (!type) return 'Bitte eine PDF-Datei oder ein Bild (JPG, PNG, WebP) wählen.';
  if (kind === 'photo' && !PHOTO_MIME_TYPES.includes(type)) {
    return 'Das Bewerbungsfoto muss ein Bild sein (JPG, PNG oder WebP).';
  }
  if (file.size <= 0) return 'Die Datei ist leer.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'Die Datei ist größer als 10 MB.';
  return undefined;
}

/** „arbeitszeugnis_increon-2023.pdf“ → „arbeitszeugnis increon 2023“ */
export function titleFromFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, '');
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || name;
}

const KIND_PATTERNS: [RegExp, DocumentKind][] = [
  [/bewerbungsfoto|portrait|portr[aä]t|passfoto|(^|[^a-z])(foto|photo)([^a-z]|$)/i, 'photo'],
  [/arbeitszeugnis|zwischenzeugnis|dienstzeugnis|referenz|reference/i, 'reference'],
  [/zertifikat|certificate|certification|zertifizierung|teilnahme|nachweis|schein/i, 'certificate'],
  [/abschluss|abitur|bachelor|master|diplom|urkunde|studium|ausbildung|gesellenbrief|meisterbrief|schulzeugnis|transcript/i, 'diploma'],
  [/zeugnis/i, 'reference'],
];

/** Art aus dem Dateinamen raten; ohne Hinweis „Sonstiges“ (auch Bilder – oft eingescannte Nachweise) */
export function guessKind(file: Pick<FileInfo, 'name' | 'type'>): DocumentKind {
  const name = file.name;
  for (const [pattern, kind] of KIND_PATTERNS) {
    if (!pattern.test(name)) continue;
    if (kind === 'photo' && mimeTypeOf(file) === 'application/pdf') continue;
    return kind;
  }
  return 'other';
}

/** Rechtsformen und Füllwörter zählen beim Abgleich mit dem Dateinamen nicht */
const STOP_WORDS = new Set([
  'gmbh', 'mbh', 'ag', 'se', 'kg', 'co', 'ug', 'ohg', 'gbr', 'ev', 'inc', 'ltd', 'llc',
  'und', 'the', 'der', 'die', 'das', 'von', 'für', 'fuer', 'group', 'gruppe', 'holding',
  'deutschland', 'germany',
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

function words(text: string) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * Station, zu der eine Datei vermutlich gehört: Firma bzw. Schule der Station steht im Dateinamen
 * oder Titel (z. B. „Arbeitszeugnis_Increon.pdf“ → Station bei der Increon GmbH). Nur bei einem
 * eindeutigen Treffer, sonst undefined.
 */
export function suggestEntry(
  text: string,
  entries: readonly ProfileEntry[],
): ProfileEntry | undefined {
  const haystack = new Set(words(text));
  // Auch zusammengeschriebene Namen finden („increonag“ enthält „increon“)
  const joined = normalize(text).replace(/[^a-z0-9]/g, '');
  let best: ProfileEntry | undefined;
  let bestScore = 0;
  let tie = false;
  for (const entry of entries) {
    if (!entry.organization) continue;
    const orgWords = words(entry.organization);
    if (!orgWords.length) continue;
    const hits = orgWords.filter((word) => haystack.has(word) || joined.includes(word)).length;
    if (!hits) continue;
    const score = hits / orgWords.length;
    if (score > bestScore) {
      best = entry;
      bestScore = score;
      tie = false;
    } else if (score === bestScore) {
      // Mehrere Stationen bei derselben Firma: welche, weiß nur der Nutzer
      tie = true;
    }
  }
  return tie ? undefined : best;
}

/** Objektname im Bucket: `<user_id>/<document_id>/<Dateiname nur aus sicheren Zeichen>` */
export function storagePath(userId: string, documentId: string, fileName: string) {
  const safe =
    normalize(fileName)
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_.]+/, '')
      .slice(-120) || 'datei';
  return `${userId}/${documentId}/${safe}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}

/** „PDF“, „JPG“ … für die Anzeige */
export function fileTypeLabel(mimeType: DocumentMimeType) {
  return mimeType === 'application/pdf' ? 'PDF' : mimeType.slice('image/'.length).replace('jpeg', 'jpg').toUpperCase();
}

/** Bezeichnung einer Station in Auswahllisten: „Entwickler · Increon“ */
export function entryLabel(entry: Pick<ProfileEntry, 'title' | 'organization'>) {
  return [entry.title, entry.organization].filter(Boolean).join(' · ');
}

/** Dokumente nach Station; Schlüssel ist die id der Station */
export function documentsByEntry(documents: readonly ProfileDocument[]) {
  const map = new Map<string, ProfileDocument[]>();
  for (const document of documents) {
    if (!document.profileEntryId) continue;
    const list = map.get(document.profileEntryId) ?? [];
    list.push(document);
    map.set(document.profileEntryId, list);
  }
  return map;
}

export type DocumentFormValues = { kind: DocumentKind; title: string; profileEntryId: string };

export function parseDocumentForm(
  values: DocumentFormValues,
  entries: readonly Pick<ProfileEntry, 'id'>[],
): { ok: true; value: DocumentInput } | { ok: false; errors: Partial<Record<'title', string>> } {
  const title = values.title.trim();
  if (!title) return { ok: false, errors: { title: 'Bitte einen Titel angeben.' } };
  if (title.length > 200) return { ok: false, errors: { title: 'Höchstens 200 Zeichen.' } };
  // Das Foto gehört zu keiner Station; eine gelöschte Station gilt als „keine“
  const entryId =
    values.kind !== 'photo' && entries.some((entry) => entry.id === values.profileEntryId)
      ? values.profileEntryId
      : undefined;
  return { ok: true, value: { kind: values.kind, title, profileEntryId: entryId } };
}

/**
 * Nach dem Ersetzen des Profils (PDF-Import) haben die Stationen neue ids und die Zuordnungen sind
 * gelöst. Ordnet Dokumente der neuen Station mit gleicher Art, Bezeichnung und Firma zu, sonst der
 * einzigen neuen Station dieser Art bei derselben Firma. Liefert nur die eindeutigen Treffer.
 */
export function reassignDocuments(
  documents: readonly ProfileDocument[],
  oldEntries: readonly ProfileEntry[],
  newEntries: readonly ProfileEntry[],
): { id: string; profileEntryId: string }[] {
  const key = (text?: string) => normalize(text ?? '').replace(/[^a-z0-9]/g, '');
  const result: { id: string; profileEntryId: string }[] = [];
  for (const document of documents) {
    const old = oldEntries.find((entry) => entry.id === document.profileEntryId);
    if (!old || !old.organization) continue;
    const sameOrg = newEntries.filter(
      (entry) => entry.kind === old.kind && key(entry.organization) === key(old.organization),
    );
    const exact = sameOrg.filter((entry) => key(entry.title) === key(old.title));
    const match = exact.length === 1 ? exact[0] : sameOrg.length === 1 ? sameOrg[0] : undefined;
    if (match) result.push({ id: document.id, profileEntryId: match.id });
  }
  return result;
}
