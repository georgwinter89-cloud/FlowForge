// Prüfungen zur Instanz-Identität (BAUPLAN 41): Zusatznamen, und alles je
// Instanz statt je Projekt oder je Lauf.
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es weder blockAnzeigeName noch
// pruefOrdnerFuer, budgetNehmen oder laufstandPasst (Import rot), der
// Prüfbefehl kannte keine Instanz-Kennung (pruefbefehlSetzen nahm zwei
// Argumente), und pruefungenArchivieren nahm die ganze Prüfmappe — der Fall
// „zwei Prüfer" unten lief nachweislich rot: Prüfer A archivierte auch die
// Tests von Prüfer B. Beim Nachbauen wurde zusätzlich je eine Erwartung
// verfälscht (z.B. 'pruefer-' erwartet statt des echten Ordnernamens) und rot
// gesehen, bevor sie richtiggestellt wurde.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  blockAnzeigeName,
  pruefOrdnerFuer,
  zusatznameBereinigen,
  ZUSATZNAME_MAX
} from '../src/shared/blockKatalog.js'
import { budgetNehmen, laufstandPasst } from '../src/shared/kettenRegeln.js'
import { workflowSpeichern, workflowLaden } from '../src/main/workflow.js'
import {
  pruefbefehlSetzen,
  pruefbefehlLaden,
  pruefbefehlVorhanden,
  pruefbefehlArchivieren,
  pruefbefehlArchivLaden
} from '../src/main/pruefbefehl.js'
import { pruefungenArchivieren, pruefkartenOrdner } from '../src/main/pruefkarten.js'
import { laufExtraktAusBericht, motorAuswerten } from '../src/shared/metrikRegeln.js'

const bauerDef = { name: 'Bauer', prueft: false, nurLesen: false }
const prueferDef = { name: 'Prüfer', prueft: true, nurLesen: false }
const uebungsPrueferDef = { name: 'Übungs-Prüfer (fair)', prueft: true, nurLesen: true }

describe('BAUPLAN 41 · Zusatzname macht Instanzen unterscheidbar', () => {
  it('hängt den Zusatznamen an den Katalognamen', () => {
    expect(blockAnzeigeName(bauerDef, { zusatz: 'Datenbank' })).toBe('Bauer · Datenbank')
  })

  it('bleibt ohne Zusatznamen beim Katalognamen', () => {
    expect(blockAnzeigeName(bauerDef, { zusatz: '' })).toBe('Bauer')
    expect(blockAnzeigeName(bauerDef, null)).toBe('Bauer')
  })

  it('zieht Zeilenumbrüche und Mehrfach-Leerzeichen zusammen und deckelt die Länge', () => {
    expect(zusatznameBereinigen('  Daten\n  bank  ')).toBe('Daten bank')
    expect(zusatznameBereinigen('x'.repeat(80))).toHaveLength(ZUSATZNAME_MAX)
  })
})

describe('BAUPLAN 41 · Prüfordner je Prüf-Instanz', () => {
  it('gibt jedem schreibenden Prüfer einen eigenen Ordner aus seiner Kennung', () => {
    const a = pruefOrdnerFuer(prueferDef, { instanzId: '3f1c8a2b-1111-2222-3333-444455556666' })
    const b = pruefOrdnerFuer(prueferDef, { instanzId: '9e7d6c5b-1111-2222-3333-444455556666' })
    expect(a).toBe('pruefer-3f1c8a2b')
    expect(b).not.toBe(a)
  })

  // Der aufbewahrte Prüfbefehl zeigt über Läufe hinweg auf diesen Ordner —
  // ein Umbenennen dürfte ihn nicht ins Leere laufen lassen.
  it('hängt nicht am Zusatznamen', () => {
    const eintrag = { instanzId: '3f1c8a2b-1111-2222-3333-444455556666', zusatz: 'Datenbank' }
    const vorher = pruefOrdnerFuer(prueferDef, eintrag)
    expect(pruefOrdnerFuer(prueferDef, { ...eintrag, zusatz: 'Oberfläche' })).toBe(vorher)
  })

  it('gibt nur-lesenden Prüfern und Nicht-Prüfern keinen Ordner', () => {
    const eintrag = { instanzId: '3f1c8a2b-1111-2222-3333-444455556666' }
    expect(pruefOrdnerFuer(uebungsPrueferDef, eintrag)).toBe('')
    expect(pruefOrdnerFuer(bauerDef, eintrag)).toBe('')
  })

  it('legt die Dateien einer Prüfkarte im Ordner ihres Prüfers ab', () => {
    expect(pruefkartenOrdner('abcdefgh-1234', 'pruefer-3f1c8a2b')).toBe(
      'pruefer-3f1c8a2b/pruefkarte-abcdefgh'
    )
  })
})

describe('BAUPLAN 41 · Reparatur-Runden je Rückführungs-Ziel', () => {
  it('zählt für jedes Ziel getrennt', () => {
    const budget = new Map()
    expect(budgetNehmen(budget, 'bauer-a', 2)).toMatchObject({ erlaubt: true, genutzt: 1 })
    expect(budgetNehmen(budget, 'bauer-a', 2)).toMatchObject({ erlaubt: true, genutzt: 2 })
    expect(budgetNehmen(budget, 'bauer-a', 2).erlaubt).toBe(false)
    // Genau der Fehler vor diesem Bauschritt: Der zweite Zweig hatte keine
    // Runde mehr, obwohl er nie repariert hatte.
    expect(budgetNehmen(budget, 'bauer-b', 2)).toMatchObject({ erlaubt: true, genutzt: 1 })
  })

  it('gewährt bei 0 eingestellten Runden gar keine', () => {
    expect(budgetNehmen(new Map(), 'bauer-a', 0).erlaubt).toBe(false)
  })

  it('verweigert ohne Rückführungs-Ziel', () => {
    expect(budgetNehmen(new Map(), null, 2).erlaubt).toBe(false)
  })
})

describe('BAUPLAN 41 · Ein geänderter Zusatzname macht den Laufstand ungültig', () => {
  const kette = [
    { instanzId: 'a', zusatz: 'Datenbank' },
    { instanzId: 'b', zusatz: '' }
  ]
  const pfeile = [{ von: 'a', nach: 'b' }]
  const stand = {
    kettenIds: ['a', 'b'],
    fertigIds: ['a'],
    pfeile: [['a', 'b']],
    zusaetze: [
      ['a', 'Datenbank'],
      ['b', '']
    ]
  }

  it('nimmt einen unveränderten Stand an', () => {
    expect(laufstandPasst(kette, pfeile, stand)).toBe(true)
  })

  it('lehnt einen Stand mit anderem Zusatznamen ab', () => {
    const geaendert = [{ instanzId: 'a', zusatz: 'Oberfläche' }, kette[1]]
    expect(laufstandPasst(geaendert, pfeile, stand)).toBe(false)
  })

  it('lehnt weiterhin geänderte Blöcke und Pfeile ab', () => {
    expect(laufstandPasst([kette[0]], pfeile, stand)).toBe(false)
    expect(laufstandPasst(kette, [{ von: 'b', nach: 'a' }], stand)).toBe(false)
  })
})

describe('BAUPLAN 41 · Prüfbefehl und Prüfmappe je Instanz (echte Dateien)', () => {
  let projekt
  const prueferA = 'instanz-a'
  const prueferB = 'instanz-b'

  beforeEach(() => {
    projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-instanz-'))
  })
  afterEach(() => {
    fs.rmSync(projekt, { recursive: true, force: true })
  })

  it('hält die Prüfbefehle zweier Prüfer auseinander', () => {
    pruefbefehlSetzen(projekt, prueferA, 'npx vitest run pruefung/pruefer-aaaaaaaa')
    pruefbefehlSetzen(projekt, prueferB, 'npx vitest run pruefung/pruefer-bbbbbbbb')
    expect(pruefbefehlLaden(projekt, prueferA)).toContain('pruefer-aaaaaaaa')
    expect(pruefbefehlLaden(projekt, prueferB)).toContain('pruefer-bbbbbbbb')
  })

  // Der stille Fehler, den dieser Bauschritt abstellt: Der zweite Prüfer
  // bestand seine Pflicht, weil der erste gesetzt hatte.
  it('erfüllt die Pflicht nur für die Instanz, die gesetzt hat', () => {
    pruefbefehlSetzen(projekt, prueferA, 'npm test')
    expect(pruefbefehlVorhanden(projekt, prueferA)).toBe(true)
    expect(pruefbefehlVorhanden(projekt, prueferB)).toBe(false)
  })

  it('archiviert je Instanz, ohne das Archiv der anderen zu löschen', () => {
    pruefbefehlSetzen(projekt, prueferA, 'npm test')
    pruefbefehlArchivieren(projekt, prueferA)
    pruefbefehlSetzen(projekt, prueferB, 'npx jest')
    pruefbefehlArchivieren(projekt, prueferB)
    expect(pruefbefehlArchivLaden(projekt, prueferA)).toBe('npm test')
    expect(pruefbefehlArchivLaden(projekt, prueferB)).toBe('npx jest')
  })

  it('archiviert nur die Prüfungen des eigenen Prüfordners', () => {
    const mappe = path.join(projekt, 'pruefung')
    fs.mkdirSync(path.join(mappe, 'pruefer-aaaaaaaa'), { recursive: true })
    fs.mkdirSync(path.join(mappe, 'pruefer-bbbbbbbb'), { recursive: true })
    fs.mkdirSync(path.join(mappe, 'pruefer-aaaaaaaa', 'pruefkarte-12345678'), { recursive: true })
    fs.writeFileSync(path.join(mappe, 'pruefer-aaaaaaaa', 'meins.test.js'), 'a', 'utf8')
    fs.writeFileSync(path.join(mappe, 'pruefer-bbbbbbbb', 'fremd.test.js'), 'b', 'utf8')
    fs.writeFileSync(
      path.join(mappe, 'pruefer-aaaaaaaa', 'pruefkarte-12345678', 'alt.test.js'),
      'alt',
      'utf8'
    )

    pruefungenArchivieren(projekt, 'karte-a', 'pruefer-aaaaaaaa')
    // Das Archiv liegt außerhalb des Projektordners (im Prüfskript: der
    // Electron-Ersatz im Temp-Ordner) — sein Pfad wird wie in pruefkarten.js
    // aus dem Projektpfad gerechnet, damit der Blick eindeutig ist.
    const schluessel = crypto
      .createHash('sha1')
      .update(path.resolve(projekt).toLowerCase())
      .digest('hex')
      .slice(0, 16)
    const kartenOrdner = path.join(
      os.tmpdir(),
      'flowforge-pruefungen',
      'pruefkarten',
      schluessel,
      'karte-a'
    )
    const inhalt = fs.readdirSync(kartenOrdner)
    expect(inhalt).toContain('meins.test.js')
    expect(inhalt).not.toContain('fremd.test.js')
    // Eingelegte Prüfkarten haben ihr eigenes Archiv und gehören nicht dazu.
    expect(inhalt).not.toContain('pruefkarte-12345678')
    fs.rmSync(path.dirname(kartenOrdner), { recursive: true, force: true })
  })

  it('speichert den Zusatznamen im Schaubild — bereinigt und gedeckelt', () => {
    const gespeichert = workflowSpeichern(projekt, {
      reparaturRunden: 2,
      bloecke: [
        { instanzId: 'a', blockId: 'paket-schneiden', zusatz: '  Daten\nbank  ' },
        { instanzId: 'b', blockId: 'bauer', zusatz: 'x'.repeat(60) }
      ],
      pfeile: [{ von: 'a', nach: 'b' }]
    })
    expect(gespeichert.ok).toBe(true)
    const geladen = workflowLaden(projekt)
    expect(geladen.workflow.bloecke[0].zusatz).toBe('Daten bank')
    expect(geladen.workflow.bloecke[1].zusatz).toHaveLength(ZUSATZNAME_MAX)
  })
})

describe('BAUPLAN 41 · Die Metriken bleiben vergleichbar', () => {
  // SPEC §3.4: Katalogname und Zusatzname stehen getrennt im Bericht — sonst
  // zerfiele „Blocktyp" in beliebig viele Typen.
  const bericht = {
    id: 'lauf-1',
    gestartetAm: '2026-08-16T10:00:00.000Z',
    workflow: 'Bauer → Prüfer',
    zustand: 'erfolgreich',
    verbrauch: { tokens: 100, kostenUsd: 1 },
    blockErgebnisse: [
      { instanzId: 'p1', block: 'Prüfer', zusatz: 'Datenbank', zustand: 'pruefung-bestanden', tokens: 10 },
      { instanzId: 'p2', block: 'Prüfer', zusatz: 'Oberfläche', zustand: 'pruefung-bestanden', tokens: 20 }
    ]
  }

  it('zählt zwei verschieden benannte Prüfer als EINEN Blocktyp', () => {
    const extrakt = laufExtraktAusBericht(bericht, 'C:/projekt')
    const jeBlock = motorAuswerten([extrakt]).jeBlock
    expect(jeBlock).toHaveLength(1)
    expect(jeBlock[0].block).toBe('Prüfer')
    expect(jeBlock[0].erstlauf.anzahl).toBe(2)
  })

  it('behandelt sie trotzdem als eigene Instanzen (keine Wiederholung)', () => {
    const extrakt = laufExtraktAusBericht(bericht, 'C:/projekt')
    expect(extrakt.bloecke.every((b) => !b.wiederholung)).toBe(true)
  })
})
