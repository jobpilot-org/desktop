import {
  checkFile,
  documentsByEntry,
  entryLabel,
  fileTypeLabel,
  formatFileSize,
  guessKind,
  mimeTypeOf,
  parseDocumentForm,
  reassignDocuments,
  storagePath,
  suggestEntry,
  titleFromFileName,
  type ProfileDocument,
} from '@/domain/documents';
import type { ProfileEntry } from '@/domain/profile';

const entry = (id: string, organization?: string, kind: ProfileEntry['kind'] = 'experience'): ProfileEntry => ({
  id,
  kind,
  title: `Station ${id}`,
  organization,
  isCurrent: false,
});

const entries = [
  entry('e1', 'Increon GmbH'),
  entry('e2', 'Region10Group AG'),
  entry('e3', 'Deutsche Bahn AG'),
  entry('b1', 'TU München', 'education'),
  entry('x', undefined),
];

describe('Dateien prüfen', () => {
  it('erkennt den Typ auch ohne MIME-Angabe', () => {
    expect(mimeTypeOf({ name: 'a.PDF', type: '' })).toBe('application/pdf');
    expect(mimeTypeOf({ name: 'a.jpg', type: 'image/jpeg' })).toBe('image/jpeg');
    expect(mimeTypeOf({ name: 'a.docx', type: 'application/msword' })).toBeUndefined();
  });

  it('lehnt falsche Typen, leere und zu große Dateien ab', () => {
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 }, 'reference')).toBeUndefined();
    expect(checkFile({ name: 'a.docx', type: '', size: 1000 }, 'other')).toMatch(/PDF/);
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 1000 }, 'photo')).toMatch(/Bild/);
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 0 }, 'other')).toMatch(/leer/);
    expect(checkFile({ name: 'a.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }, 'other')).toMatch(
      /10 MB/,
    );
  });
});

describe('Vorschläge beim Hochladen', () => {
  it('macht aus dem Dateinamen einen Titel', () => {
    expect(titleFromFileName('Arbeitszeugnis_Increon-2023.pdf')).toBe('Arbeitszeugnis Increon 2023');
    expect(titleFromFileName('.pdf')).toBe('.pdf');
  });

  it('rät die Art', () => {
    const kind = (name: string, type = 'application/pdf') => guessKind({ name, type });
    expect(kind('Arbeitszeugnis_Increon.pdf')).toBe('reference');
    expect(kind('Zwischenzeugnis.pdf')).toBe('reference');
    expect(kind('Zeugnis Bahn.pdf')).toBe('reference');
    expect(kind('Abschlusszeugnis Bachelor.pdf')).toBe('diploma');
    expect(kind('AWS-Zertifikat.pdf')).toBe('certificate');
    expect(kind('Bewerbungsfoto.jpg', 'image/jpeg')).toBe('photo');
    expect(kind('foto_marco.png', 'image/png')).toBe('photo');
    expect(kind('Foto.pdf')).toBe('other');
    expect(kind('Fotografie-Kurs.pdf')).toBe('other');
    expect(kind('scan123.jpg', 'image/jpeg')).toBe('other');
  });

  it('ordnet nach der Firma im Dateinamen zu', () => {
    expect(suggestEntry('Arbeitszeugnis_Increon.pdf', entries)?.id).toBe('e1');
    expect(suggestEntry('Zeugnis region10group', entries)?.id).toBe('e2');
    expect(suggestEntry('Zeugnis DeutscheBahn.pdf', entries)?.id).toBe('e3');
    expect(suggestEntry('Bachelor TU Muenchen.pdf', entries)?.id).toBe('b1');
    expect(suggestEntry('Lebenslauf.pdf', entries)).toBeUndefined();
    // Rechtsformen allein reichen nicht
    expect(suggestEntry('Vertrag GmbH AG.pdf', entries)).toBeUndefined();
  });

  it('schlägt bei mehreren Stationen derselben Firma nichts vor', () => {
    expect(suggestEntry('Zeugnis Increon.pdf', [...entries, entry('e4', 'Increon GmbH')])).toBeUndefined();
  });
});

describe('Ablage und Anzeige', () => {
  it('baut einen sicheren Pfad im Ordner des Nutzers', () => {
    expect(storagePath('u1', 'd1', 'Zeugnis Größe & Co (1).pdf')).toBe('u1/d1/zeugnis_groesse_co_1_.pdf');
    expect(storagePath('u1', 'd1', '***')).toBe('u1/d1/datei');
  });

  it('formatiert Größe, Typ und Station', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(120 * 1024)).toBe('120 KB');
    expect(formatFileSize(1.25 * 1024 * 1024)).toBe('1,3 MB');
    expect(fileTypeLabel('application/pdf')).toBe('PDF');
    expect(fileTypeLabel('image/jpeg')).toBe('JPG');
    expect(entryLabel({ title: 'Entwickler', organization: 'Increon' })).toBe('Entwickler · Increon');
    expect(entryLabel({ title: 'Entwickler' })).toBe('Entwickler');
  });

  it('gruppiert nach Station', () => {
    const doc = (id: string, profileEntryId?: string): ProfileDocument => ({
      id,
      kind: 'reference',
      title: id,
      fileName: `${id}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 1,
      storagePath: `u/${id}/${id}.pdf`,
      profileEntryId,
      createdAt: '2026-11-21T00:00:00.000Z',
    });
    const map = documentsByEntry([doc('a', 'e1'), doc('b'), doc('c', 'e1')]);
    expect(map.get('e1')?.map((d) => d.id)).toEqual(['a', 'c']);
    expect(map.size).toBe(1);
  });
});

describe('parseDocumentForm', () => {
  it('verlangt einen Titel und prüft die Station', () => {
    expect(parseDocumentForm({ kind: 'reference', title: ' ', profileEntryId: '' }, entries)).toEqual({
      ok: false,
      errors: { title: 'Bitte einen Titel angeben.' },
    });
    expect(parseDocumentForm({ kind: 'reference', title: ' Zeugnis ', profileEntryId: 'e1' }, entries)).toEqual({
      ok: true,
      value: { kind: 'reference', title: 'Zeugnis', profileEntryId: 'e1' },
    });
    expect(
      parseDocumentForm({ kind: 'reference', title: 'Z', profileEntryId: 'weg' }, entries),
    ).toMatchObject({ value: { profileEntryId: undefined } });
    expect(
      parseDocumentForm({ kind: 'photo', title: 'Foto', profileEntryId: 'e1' }, entries),
    ).toMatchObject({ value: { profileEntryId: undefined } });
  });
});

describe('reassignDocuments', () => {
  const doc = (id: string, profileEntryId?: string): ProfileDocument => ({
    id,
    kind: 'reference',
    title: id,
    fileName: `${id}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 1,
    storagePath: `u/${id}/${id}.pdf`,
    profileEntryId,
    createdAt: '2026-11-21T00:00:00.000Z',
  });
  const old: ProfileEntry[] = [
    { id: 'o1', kind: 'experience', title: 'Entwickler', organization: 'Increon GmbH', isCurrent: false },
    { id: 'o2', kind: 'experience', title: 'Lead', organization: 'Acme', isCurrent: false },
    { id: 'o3', kind: 'experience', title: 'Junior', organization: 'Acme', isCurrent: false },
    { id: 'o4', kind: 'education', title: 'Bachelor', organization: 'Weg', isCurrent: false },
  ];

  it('findet die neue Station über Firma und Bezeichnung', () => {
    const fresh: ProfileEntry[] = [
      { id: 'n1', kind: 'experience', title: 'Senior Entwickler', organization: 'increon gmbh', isCurrent: false },
      { id: 'n2', kind: 'experience', title: 'Lead', organization: 'Acme', isCurrent: false },
      { id: 'n3', kind: 'experience', title: 'Werkstudent', organization: 'Acme', isCurrent: false },
    ];
    expect(
      reassignDocuments(
        [doc('a', 'o1'), doc('b', 'o2'), doc('c', 'o3'), doc('d', 'o4'), doc('e')],
        old,
        fresh,
      ),
    ).toEqual([
      // gleiche Firma, einzige Station dort
      { id: 'a', profileEntryId: 'n1' },
      // gleiche Firma und Bezeichnung
      { id: 'b', profileEntryId: 'n2' },
      // „Junior“ bei Acme gibt es nicht mehr, zwei Kandidaten → offen lassen
    ]);
  });
});
