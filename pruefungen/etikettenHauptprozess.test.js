// Prüfungen zum Hauptprozess-Teil der Etiketten-Bibliothek (BAUPLAN 48, Teil
// B): Speichern/Löschen mit Sperren, Umbenennen zieht in allen eigenen Blöcken
// nach, Block speichern kanonisiert und legt unbekannte Etiketten automatisch
// an (K1/K2), Abgleich des Altbestands beim Start (K18).
//
// Rot vor Grün — so gemessen: Vor dem Bauschritt gab es src/main/
// eigeneEtiketten.js nicht, und eigeneBloecke.js exportierte weder
// etikettUmbenennen noch bloeckeMitEtikett — jeder Import schlug fehl. Die
// Reihenfolge-Regel K1 wurde zusätzlich verfälscht geprüft (Auto-Anlage VOR
// pruefeEigenenBlock → ein ungültiger Block hinterließ ein Etikett), und die
// Erwartung „kein Etikett ohne Block" lief damit nachweislich rot.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Eigener Datenordner — die anderen Prüfdateien teilen sich den Stub-Ordner;
// hier entstehen eigene-bloecke.json und eigene-etiketten.json, und nichts
// darf dazwischenfunken.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-etiketten-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  Notification: Object.assign(function () {}, { isSupported: () => false }),
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const {
  eigeneEtikettenLaden,
  eigeneEtikettenListe,
  eigenesEtikettSpeichern,
  eigenesEtikettLoeschen,
  etikettSicherstellen,
  blockSpeichernMitEtiketten,
  etikettenAbgleichen
} = await import('../src/main/eigeneEtiketten.js')
const { eigeneBloeckeLaden, eigeneBloeckeListe, etikettUmbenennen, bloeckeMitEtikett } =
  await import('../src/main/eigeneBloecke.js')
const { eigenesEtikett, bekannteEtiketten } = await import('../src/shared/blockKatalog.js')
const { teilFuerEtikett } = await import('../src/shared/lieferschein.js')
const { texte } = await import('../src/shared/texte.js')

const tr = texte.etikettRegeln

function block(name, extra = {}) {
  return { name, auftrag: 'Tu etwas. Antworte auf Deutsch.', braucht: [], liefert: [], ...extra }
}

beforeAll(() => {
  eigeneEtikettenLaden()
  eigeneBloeckeLaden()
})

describe('BAUPLAN 48 · Etikett speichern, umbenennen, löschen', () => {
  let id

  it('legt ein Etikett mit Feldern an — mit id, Werkzeug und ohne Automatik-Marke', () => {
    const erg = eigenesEtikettSpeichern({
      name: 'Marktanalyse',
      felder: [{ bezeichnung: 'Zielgruppe', art: 'text', pflicht: true }]
    })
    expect(erg.ok).toBe(true)
    const e = erg.etiketten.find((x) => x.name === 'Marktanalyse')
    expect(e.id.startsWith('etikett-')).toBe(true)
    expect(e.werkzeug).toBe('melde_marktanalyse')
    expect(e.automatisch).toBe(false)
    id = e.id
    // Datei liegt im Datenordner, Registry kennt das Etikett.
    expect(fs.existsSync(path.join(datenOrdner, 'eigene-etiketten.json'))).toBe(true)
    expect(eigenesEtikett('marktanalyse')?.id).toBe(id)
    expect(teilFuerEtikett('Marktanalyse')?.werkzeug).toBe('melde_marktanalyse')
  })

  it('weist einen zweiten gleichen Namen und einen Katalog-Namen ab', () => {
    expect(eigenesEtikettSpeichern({ name: ' MARKTANALYSE ' }).fehler).toBe(
      tr.nameVergeben('Marktanalyse')
    )
    expect(eigenesEtikettSpeichern({ name: 'Arbeitspaket' }).fehler).toBe(tr.nameKatalog('Arbeitspaket', true))
  })

  it('zieht ein Umbenennen in ALLEN eigenen Blöcken nach (braucht, liefert, brauchtWozu)', () => {
    const a = blockSpeichernMitEtiketten(block('Analyst', { liefert: ['Marktanalyse'] }))
    expect(a.ok).toBe(true)
    const b = blockSpeichernMitEtiketten(
      block('Verwerter', { braucht: ['marktanalyse'], brauchtWozu: { marktanalyse: 'wertet sie aus' } })
    )
    expect(b.ok).toBe(true)
    // Schon beim Speichern kanonisch (K1): „marktanalyse" → „Marktanalyse".
    const verwerter = b.bloecke.find((x) => x.name === 'Verwerter')
    expect(verwerter.braucht).toEqual(['Marktanalyse'])
    expect(verwerter.brauchtWozu).toEqual({ Marktanalyse: 'wertet sie aus' })
    expect(b.hinweise).toContain(tr.hinweisSchreibweise('marktanalyse', 'Marktanalyse'))
    expect(bloeckeMitEtikett('Marktanalyse').map((x) => x.name).sort()).toEqual(['Analyst', 'Verwerter'])

    const um = eigenesEtikettSpeichern({
      id,
      name: 'Marktstudie',
      felder: [{ schluessel: 'zielgruppe', bezeichnung: 'Zielgruppe', art: 'text', pflicht: true }]
    })
    expect(um.ok).toBe(true)
    const bloecke = eigeneBloeckeListe().bloecke
    expect(bloecke.find((x) => x.name === 'Analyst').liefert).toEqual(['Marktstudie'])
    expect(bloecke.find((x) => x.name === 'Verwerter').braucht).toEqual(['Marktstudie'])
    expect(bloecke.find((x) => x.name === 'Verwerter').brauchtWozu).toEqual({ Marktstudie: 'wertet sie aus' })
    expect(bloeckeMitEtikett('Marktanalyse')).toEqual([])
    // Neuer Name → neuer Slug; alte Meldungen bleiben selbsttragend (K13).
    expect(eigenesEtikett('Marktstudie').werkzeug).toBe('melde_marktstudie')
  })

  it('verweigert das Löschen, solange ein eigener Block das Etikett nutzt — und nennt die Blöcke', () => {
    const erg = eigenesEtikettLoeschen(id)
    expect(erg.ok).toBe(false)
    expect(erg.fehler).toBe(tr.fehlerNochVerwendet(['Analyst', 'Verwerter']))
    expect(eigenesEtikettLoeschen('etikett-gibt-es-nicht').fehler).toBe(tr.fehlerUnbekannt)
  })

  it('etikettUmbenennen ohne Treffer ändert nichts', () => {
    expect(etikettUmbenennen('Gibt es nicht', 'Egal').geaendert).toBe(0)
  })
})

describe('BAUPLAN 48 · Block speichern mit Etiketten (K1/K2)', () => {
  it('legt unbekannte Etiketten automatisch an — ohne Felder, mit Quelle — und sagt es', () => {
    const erg = blockSpeichernMitEtiketten(block('Sammler', { liefert: ['Notizen', 'Skizze'] }))
    expect(erg.ok).toBe(true)
    expect(erg.hinweise).toEqual([tr.hinweisNeuAngelegt('Notizen'), tr.hinweisNeuAngelegt('Skizze')])
    const notizen = erg.etiketten.find((e) => e.name === 'Notizen')
    expect(notizen.automatisch).toBe(true)
    expect(notizen.quelle).toBe('Sammler')
    expect(notizen.felder).toEqual([])
    expect(notizen.werkzeug).toBeNull()
    expect(bekannteEtiketten()).toContain('Skizze')
    // Ein Katalog-Etikett wird NICHT als eigenes angelegt — auch eines der Übung (K22).
    const k = blockSpeichernMitEtiketten(block('Leser', { braucht: ['prüfbeleg', 'textdatei'] }))
    expect(k.ok).toBe(true)
    expect(k.etiketten.some((e) => e.name.toLowerCase() === 'prüfbeleg')).toBe(false)
    expect(k.etiketten.some((e) => e.name.toLowerCase() === 'textdatei')).toBe(false)
    expect(k.bloecke.find((b) => b.name === 'Leser').braucht).toEqual(['Prüfbeleg', 'Textdatei'])
  })

  it('legt bei einem ungültigen Block KEIN Etikett an (Reihenfolge K1)', () => {
    const vorher = eigeneEtikettenListe().etiketten.length
    const erg = blockSpeichernMitEtiketten({ name: '', auftrag: 'x', liefert: ['Niemals'] })
    expect(erg.ok).toBe(false)
    expect(eigeneEtikettenListe().etiketten.length).toBe(vorher)
    expect(eigenesEtikett('Niemals')).toBeNull()
  })

  // Prüfer-Befund 48: „Plan" in braucht und „plan" in brauchtOptional sind
  // DASSELBE neue Etikett — vorher ging der Block durch (zwei Schreibweisen,
  // ein Etikett), und die Regel „nie in beiden Listen" griff erst nach dem
  // nächsten App-Start. Die erste Schreibweise gewinnt schon beim Speichern.
  it('zieht zwei Schreibweisen eines NEUEN Etiketts im selben Block zusammen', () => {
    const erg = blockSpeichernMitEtiketten({
      name: 'Planer',
      auftrag: 'x',
      braucht: ['Plan'],
      brauchtOptional: ['plan']
    })
    expect(erg.ok).toBe(false)
    expect(erg.fehler).toBe(texte.blockRegeln.brauchtOptionalDoppelt('Plan'))
    expect(eigenesEtikett('Plan')).toBeNull()
    const ok = blockSpeichernMitEtiketten({
      name: 'Planer',
      auftrag: 'x',
      braucht: ['Plan'],
      liefert: ['plan']
    })
    expect(ok.ok).toBe(true)
    const block = ok.bloecke.find((b) => b.name === 'Planer')
    expect(block.liefert).toEqual(['Plan'])
    expect(ok.hinweise).toContain(tr.hinweisSchreibweise('plan', 'Plan'))
    expect(ok.etiketten.filter((e) => e.name.toLowerCase() === 'plan')).toHaveLength(1)
  })

  it('etikettSicherstellen gibt Bekanntes kanonisch zurück und legt nur Neues an', () => {
    expect(etikettSicherstellen('ARBEITSPAKET')).toEqual({ name: 'Arbeitspaket', neu: false, id: null })
    expect(etikettSicherstellen('notizen').name).toBe('Notizen')
    expect(etikettSicherstellen('notizen').neu).toBe(false)
  })
})

describe('BAUPLAN 48 · Abgleich des Altbestands beim Start (K18)', () => {
  it('zieht Etiketten eigener Blöcke auf die kanonische Schreibweise und legt fehlende an', () => {
    // Altbestand von Hand in die Datei schreiben: ein Block mit abweichender
    // Schreibweise und einem unbekannten Etikett — dann laden wie beim Start.
    const pfad = path.join(datenOrdner, 'eigene-bloecke.json')
    const bestand = JSON.parse(fs.readFileSync(pfad, 'utf8'))
    bestand.push({
      id: 'eigen-alt',
      name: 'Alt',
      auftrag: 'Alt. Antworte auf Deutsch.',
      braucht: ['NOTIZEN'],
      liefert: ['Uralt-Etikett'],
      brauchtWozu: { NOTIZEN: 'liest sie' }
    })
    fs.writeFileSync(pfad, JSON.stringify(bestand), 'utf8')
    eigeneEtikettenLaden()
    eigeneBloeckeLaden()
    const erg = etikettenAbgleichen()
    expect(erg.ok).toBe(true)
    expect(erg.neu).toBe(1)
    const alt = eigeneBloeckeListe().bloecke.find((b) => b.id === 'eigen-alt')
    expect(alt.braucht).toEqual(['Notizen'])
    expect(alt.brauchtWozu).toEqual({ Notizen: 'liest sie' })
    const uralt = eigenesEtikett('Uralt-Etikett')
    expect(uralt.automatisch).toBe(true)
    expect(uralt.quelle).toBe('Alt')
    // Ein zweiter Abgleich ändert nichts mehr.
    expect(etikettenAbgleichen().neu).toBe(0)
  })
})
