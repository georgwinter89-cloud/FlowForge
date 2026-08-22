// Die leere Prüfmappe erklärt sich (Zwischenschritt 0.51.6): FlowForge leert
// pruefung/ bei jedem Laufstart und lässt dort eine LIESMICH.md zurück, damit
// Blöcke den leeren Ordner nicht als Fund melden.
//
// Rot-vor-Grün: Vor diesem Zwischenschritt gab es src/main/pruefmappe.js nicht
// (Import rot). Die drei Zählstellen wurden einzeln rot gesehen, indem die
// frisch eingebaute Ausnahme wieder herausgenommen wurde:
//   - pruefmappeHatDateien meldete für eine Mappe, in der NUR die Erklärung
//     liegt, „hat Prüfungen" → die Baseline hätte einen alten Prüfbefehl gegen
//     nichts gemessen;
//   - pruefungenArchivieren legte die Erklärung als einzige „Prüfung" hinter
//     der Prüfkarte ab;
//   - pruefmappeUebersicht zeigte sie Georg als „1 Prüfung".
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  MAPPEN_ERKLAERUNG,
  istMappenErklaerung,
  istKartenOrdner,
  mappenErklaerungSchreiben,
  pruefmappeHatDateien
} from '../src/main/pruefmappe.js'
import {
  pruefungenArchivieren,
  pruefkarteEinlegen,
  pruefkartenArchivHatDateien,
  pruefkartenArchivLoeschen,
  pruefkartenOrdner
} from '../src/main/pruefkarten.js'
import { projektAnlegen, projektVergessen, pruefmappeUebersicht } from '../src/main/projekte.js'
import { BLOCK_KATALOG, PRUEFMAPPE_HINWEIS, blockDefinition } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

// Die neun Blöcke, denen der Hinweis in diesem Zwischenschritt zugewachsen ist
// — nachgesehen, nicht geschätzt: Sie sehen in den Projektordner oder messen
// das Projektgedächtnis nach.
const HINWEIS_BLOECKE = [
  'kontext-laden',
  'paket-schneiden',
  'angreifer',
  'diagnose',
  'integrator-recherche',
  'audit',
  'karten-pruefer',
  'sessionende',
  'spaeher'
]

// Die drei, die die Leerung schon vorher in eigener Sprache ansagen.
const EIGENE_SPRACHE = ['bauer', 'pruefer', 'gesamtpruefung']

function mappe(projekt, ...teile) {
  return path.join(projekt, 'pruefung', ...teile)
}

describe('0.51.6 · Was als Prüfung zählt und was die Erklärung ist', () => {
  it('erkennt die Erklärung direkt in der Prüfmappe', () => {
    expect(istMappenErklaerung(MAPPEN_ERKLAERUNG)).toBe(true)
  })

  it('ignoriert dabei die Groß- und Kleinschreibung (Windows-Dateisystem)', () => {
    expect(istMappenErklaerung('liesmich.md')).toBe(true)
  })

  it('zählt eine gleichnamige Datei im Prüfordner eines Blocks als dessen Prüfung', () => {
    expect(istMappenErklaerung('pruefer-aaaaaaaa/' + MAPPEN_ERKLAERUNG)).toBe(false)
  })

  it('hält jede andere Datei für eine Prüfung', () => {
    expect(istMappenErklaerung('ticker.test.js')).toBe(false)
    expect(istMappenErklaerung('')).toBe(false)
    expect(istMappenErklaerung(undefined)).toBe(false)
  })
})

describe('0.51.6 · Die Erklärung landet in der Mappe', () => {
  let projekt
  beforeEach(() => {
    projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-pruefmappe-'))
  })
  afterEach(() => {
    fs.rmSync(projekt, { recursive: true, force: true })
  })

  it('legt die Mappe an, wenn es sie noch gar nicht gibt (allererster Lauf)', () => {
    expect(mappenErklaerungSchreiben(projekt)).toBe(true)
    expect(fs.readFileSync(mappe(projekt, MAPPEN_ERKLAERUNG), 'utf8')).toBe(
      texte.agentenPruefordner.erklaerung
    )
  })

  it('sagt in der Datei, dass der leere Ordner kein Fund ist', () => {
    mappenErklaerungSchreiben(projekt)
    const inhalt = fs.readFileSync(mappe(projekt, MAPPEN_ERKLAERUNG), 'utf8')
    expect(inhalt).toMatch(/kein Fund/)
    expect(inhalt).toMatch(/Prüfkarten/)
  })

  it('schreibt sie nach dem Leeren erneut, ohne alte Reste zu erben', () => {
    fs.mkdirSync(mappe(projekt), { recursive: true })
    fs.writeFileSync(mappe(projekt, MAPPEN_ERKLAERUNG), 'alter Stand', 'utf8')
    mappenErklaerungSchreiben(projekt)
    expect(fs.readFileSync(mappe(projekt, MAPPEN_ERKLAERUNG), 'utf8')).toBe(
      texte.agentenPruefordner.erklaerung
    )
  })
})

describe('0.51.6 · Die Baseline hält eine Mappe mit nur der Erklärung für leer', () => {
  let projekt
  beforeEach(() => {
    projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-baseline-'))
  })
  afterEach(() => {
    fs.rmSync(projekt, { recursive: true, force: true })
  })

  it('meldet ohne Mappe nichts', () => {
    expect(pruefmappeHatDateien(projekt)).toBe(false)
  })

  it('meldet für eine frisch geleerte Mappe nichts', () => {
    mappenErklaerungSchreiben(projekt)
    expect(pruefmappeHatDateien(projekt)).toBe(false)
  })

  it('meldet die echte Prüfung daneben', () => {
    mappenErklaerungSchreiben(projekt)
    fs.writeFileSync(mappe(projekt, 'ticker.test.js'), 'test', 'utf8')
    expect(pruefmappeHatDateien(projekt)).toBe(true)
  })

  it('zählt im eigenen Prüfordner alles, auch eine gleichnamige Datei', () => {
    mappenErklaerungSchreiben(projekt)
    fs.mkdirSync(mappe(projekt, 'pruefer-aaaaaaaa'), { recursive: true })
    fs.writeFileSync(mappe(projekt, 'pruefer-aaaaaaaa', MAPPEN_ERKLAERUNG), 'x', 'utf8')
    expect(pruefmappeHatDateien(projekt, 'pruefer-aaaaaaaa')).toBe(true)
  })
})

describe('0.51.6 · Die Erklärung wandert nicht hinter eine Prüfkarte', () => {
  let projekt
  let kartenId
  beforeEach(() => {
    projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-archiv-'))
    kartenId = crypto.randomUUID()
  })
  afterEach(() => {
    pruefkartenArchivLoeschen(projekt, kartenId)
    fs.rmSync(projekt, { recursive: true, force: true })
  })

  it('archiviert eine Mappe, in der nur die Erklärung liegt, gar nicht', () => {
    mappenErklaerungSchreiben(projekt)
    pruefungenArchivieren(projekt, kartenId)
    expect(pruefkartenArchivHatDateien(projekt, kartenId)).toBe(false)
  })

  it('archiviert die echte Prüfung daneben — ohne die Erklärung', () => {
    mappenErklaerungSchreiben(projekt)
    fs.writeFileSync(mappe(projekt, 'ticker.test.js'), 'test', 'utf8')
    pruefungenArchivieren(projekt, kartenId)
    expect(pruefkartenArchivHatDateien(projekt, kartenId)).toBe(true)

    // Der Rückweg beim nächsten Laufstart zeigt, was wirklich aufbewahrt wurde.
    fs.rmSync(mappe(projekt), { recursive: true, force: true })
    expect(pruefkarteEinlegen(projekt, kartenId)).toBe(true)
    const eingelegt = fs.readdirSync(mappe(projekt, ...pruefkartenOrdner(kartenId).split('/')))
    expect(eingelegt).toEqual(['ticker.test.js'])
  })
})

describe('0.51.6 · Die Prüfmappen-Ansicht zeigt die Erklärung nicht', () => {
  let ablage
  let projekt
  beforeEach(async () => {
    ablage = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-ansicht-'))
    const erg = await projektAnlegen('Ansicht', ablage)
    expect(erg.ok).toBe(true)
    projekt = erg.pfad
  })
  afterEach(() => {
    projektVergessen(projekt)
    fs.rmSync(ablage, { recursive: true, force: true })
  })

  it('meldet eine frisch geleerte Mappe als leer', () => {
    mappenErklaerungSchreiben(projekt)
    expect(pruefmappeUebersicht(projekt)).toEqual({ ok: true, dateien: [] })
  })

  it('zeigt die echten Prüfungen daneben', () => {
    mappenErklaerungSchreiben(projekt)
    fs.writeFileSync(mappe(projekt, 'ticker.test.js'), 'test', 'utf8')
    const erg = pruefmappeUebersicht(projekt)
    expect(erg.ok).toBe(true)
    expect(erg.dateien.map((d) => d.name)).toEqual(['ticker.test.js'])
  })
})

// Seit BAUPLAN 52 legt FlowForge archivierte Prüfkarten SELBST in die Wurzel
// der Mappe (pruefung/pruefkarte-<kurz>/) und spielt sie dort ab. Das sind alte
// Dateien, keine Prüfungen dieses Laufs — sie brauchen dieselbe Ausnahme wie
// die Erklärung, an denselben drei Zählstellen.
//
// Rot-vor-Grün: Ohne istKartenOrdner meldete pruefmappeHatDateien für eine
// Mappe, in der nur ein ausgelegter Kartenordner liegt, „hat Prüfungen" — die
// Baseline-Schranke schaltete damit eine Messung scharf, die nichts über
// diesen Lauf aussagt; und pruefmappeUebersicht zeigte Georg Dutzende Dateien,
// die kein Block geschrieben hat.
describe('BAUPLAN 52 · Ausgelegte Prüfkarten sind keine Prüfungen dieses Laufs', () => {
  it('erkennt einen Kartenordner in der Wurzel der Mappe', () => {
    expect(istKartenOrdner('pruefkarte-0049e5aa')).toBe(true)
  })

  it('ignoriert dabei die Groß- und Kleinschreibung (Windows-Dateisystem)', () => {
    expect(istKartenOrdner('Pruefkarte-0049e5aa')).toBe(true)
  })

  it('lässt einen gleichnamigen Ordner im Prüfordner eines Blocks dessen Sache sein', () => {
    expect(istKartenOrdner('pruefer-aaaaaaaa/pruefkarte-0049e5aa')).toBe(false)
  })

  it('hält jeden anderen Eintrag für eine Prüfung', () => {
    expect(istKartenOrdner('pruefer-aaaaaaaa')).toBe(false)
    expect(istKartenOrdner('ticker.test.js')).toBe(false)
    expect(istKartenOrdner('')).toBe(false)
    expect(istKartenOrdner(undefined)).toBe(false)
  })
})

describe('BAUPLAN 52 · Die Baseline hält eine Mappe mit nur ausgelegten Karten für leer', () => {
  let projekt
  let kartenId
  beforeEach(() => {
    projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-kartenordner-'))
    kartenId = crypto.randomUUID()
  })
  afterEach(() => {
    pruefkartenArchivLoeschen(projekt, kartenId)
    fs.rmSync(projekt, { recursive: true, force: true })
  })

  it('zählt einen ausgelegten Kartenordner nicht als Prüfung', () => {
    mappenErklaerungSchreiben(projekt)
    fs.mkdirSync(mappe(projekt, 'pruefkarte-0049e5aa'), { recursive: true })
    fs.writeFileSync(mappe(projekt, 'pruefkarte-0049e5aa', 'alt.test.js'), 'alt', 'utf8')
    expect(pruefmappeHatDateien(projekt)).toBe(false)
  })

  it('zählt die echte Prüfung daneben weiterhin', () => {
    mappenErklaerungSchreiben(projekt)
    fs.mkdirSync(mappe(projekt, 'pruefkarte-0049e5aa'), { recursive: true })
    fs.writeFileSync(mappe(projekt, 'ticker.test.js'), 'test', 'utf8')
    expect(pruefmappeHatDateien(projekt)).toBe(true)
  })

  // Ohne diese Ausnahme wanderten FlowForges eigene ausgelegte Karten hinter
  // die frische Prüfkarte — und würden beim nächsten Lauf als „Prüfung dieses
  // Laufs" wieder eingelegt.
  it('bewahrt ohne Prüfordner nur die losen Dateien auf, keinen Ordner', () => {
    fs.mkdirSync(mappe(projekt, 'pruefkarte-0049e5aa'), { recursive: true })
    fs.writeFileSync(mappe(projekt, 'pruefkarte-0049e5aa', 'alt.test.js'), 'alt', 'utf8')
    fs.writeFileSync(mappe(projekt, 'ticker.test.js'), 'test', 'utf8')
    pruefungenArchivieren(projekt, kartenId)

    fs.rmSync(mappe(projekt), { recursive: true, force: true })
    expect(pruefkarteEinlegen(projekt, kartenId)).toBe(true)
    expect(fs.readdirSync(mappe(projekt, pruefkartenOrdner(kartenId)))).toEqual(['ticker.test.js'])
  })

  it('bewahrt gar nichts auf, wenn nur ein ausgelegter Kartenordner in der Mappe liegt', () => {
    fs.mkdirSync(mappe(projekt, 'pruefkarte-0049e5aa'), { recursive: true })
    fs.writeFileSync(mappe(projekt, 'pruefkarte-0049e5aa', 'alt.test.js'), 'alt', 'utf8')
    pruefungenArchivieren(projekt, kartenId)
    expect(pruefkartenArchivHatDateien(projekt, kartenId)).toBe(false)
  })
})

describe('BAUPLAN 52 · Die Prüfmappen-Ansicht zeigt ausgelegte Karten nicht', () => {
  let ablage
  let projekt
  beforeEach(async () => {
    ablage = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-kartenansicht-'))
    const erg = await projektAnlegen('Kartenansicht', ablage)
    expect(erg.ok).toBe(true)
    projekt = erg.pfad
  })
  afterEach(() => {
    projektVergessen(projekt)
    fs.rmSync(ablage, { recursive: true, force: true })
  })

  it('lässt den Kartenordner samt Inhalt aus der Liste', () => {
    mappenErklaerungSchreiben(projekt)
    fs.mkdirSync(mappe(projekt, 'pruefkarte-0049e5aa'), { recursive: true })
    fs.writeFileSync(mappe(projekt, 'pruefkarte-0049e5aa', 'alt.test.js'), 'alt', 'utf8')
    fs.writeFileSync(mappe(projekt, 'ticker.test.js'), 'test', 'utf8')
    const erg = pruefmappeUebersicht(projekt)
    expect(erg.ok).toBe(true)
    expect(erg.dateien.map((d) => d.name)).toEqual(['ticker.test.js'])
  })
})

describe('0.51.6 · Die Aufträge sagen es vorher', () => {
  it('trägt den Hinweis in genau den neun nachgesehenen Blöcken', () => {
    const mitHinweis = BLOCK_KATALOG.filter((b) => b.auftrag.includes(PRUEFMAPPE_HINWEIS)).map(
      (b) => b.id
    )
    expect(mitHinweis.sort()).toEqual([...HINWEIS_BLOECKE].sort())
  })

  it('nennt den Halbsatz über das Gedächtnis der Prüfungen', () => {
    expect(PRUEFMAPPE_HINWEIS).toMatch(/Prüfkarten, nicht im Ordner/)
    expect(PRUEFMAPPE_HINWEIS).toMatch(/beim Laufstart geleert/)
  })

  it('lässt die drei Blöcke unangetastet, die es schon in eigener Sprache sagen', () => {
    for (const id of EIGENE_SPRACHE) {
      const auftrag = blockDefinition(id).auftrag
      expect(auftrag, id).not.toContain(PRUEFMAPPE_HINWEIS)
      expect(auftrag, id).toMatch(/Laufstart geleert|leert sie am Laufstart/)
    }
  })
})
