// Die Messung der Dateiliste an ECHTEN Sicherungspunkten (BAUPLAN 55):
// strangZusammenfuehren trägt jetzt die Mess-Basis (`basisId`, die Haupt-Spitze
// unmittelbar VOR der Zusammenführung), und messungNachZusammenfuehrung rechnet
// daraus die Liste der wirklich angefassten Dateien. Gemessen wird am
// versteckten Git-Verzeichnis, nicht an einer nachgebauten Rechnung — der
// Fehler, um den es geht (fremde Nachbararbeit als eigene gemessen), sitzt
// genau in der Frage, WELCHE zwei Punkte verglichen werden.
//
// Rot vor Grün (gemessen am Stand vor Bauschritt 55):
//   - strangZusammenfuehren kannte kein basisId — das Feld war undefined,
//     messungNachZusammenfuehrung gab es nicht (Import undefined → TypeError).
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'
import {
  sicherungspunktAnlegen,
  strangOeffnen,
  strangZusammenfuehren,
  letzterPunktId,
  messungNachZusammenfuehrung
} from '../src/main/sicherungspunkte.js'

// Das versteckte Git-Verzeichnis leitet sich allein aus dem Projektpfad ab und
// ÜBERLEBT das Löschen des Projektordners — ohne dieses Mitlöschen wäre die
// Prüfung beim ersten Lauf grün und danach rot, sobald das Betriebssystem eine
// Prozesskennung wiederverwendet (siehe sicherungsstraenge.test.js).
function gitOrdner(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(app.getPath('userData'), 'sicherungen', schluessel)
}

function projektAnlegen(name) {
  const pfad = path.join(os.tmpdir(), `flowforge-messung-${name}-${process.pid}`)
  fs.rmSync(pfad, { recursive: true, force: true })
  fs.rmSync(gitOrdner(pfad), { recursive: true, force: true })
  fs.mkdirSync(pfad, { recursive: true })
  return pfad
}

// Bekannte Grenze der Sicherungspunkte (belegt 15.08.2026, laufDiffPunkte.
// test.js): Die Änderungs-Erkennung von isomorphic-git vergleicht Zeitstempel
// nur sekundengenau. Der wachsende Zähler stellt den Alltagsabstand künstlich
// her, statt eine Sub-Sekunden-Wette einzugehen — ein fester Aufschlag gäbe
// zwei schnellen Schreibvorgängen DIESELBE Sekunde.
let schreibZaehler = 0
function schreiben(projektPfad, relativ, inhalt) {
  const ziel = path.join(projektPfad, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  const spaeter = new Date(Date.now() + ++schreibZaehler * 2000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

describe('BAUPLAN 55 · Messung eines Anlaufs mit eigenem Strang', () => {
  const projektPfad = projektAnlegen('kern')
  let basis = null
  let zusammen = null
  let messung = null

  beforeAll(async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    schreiben(projektPfad, 'weg.js', 'verschwindet\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    basis = await letzterPunktId(projektPfad)
    await strangOeffnen(projektPfad, 'strang/bauer-a')
    // Der Block arbeitet: ändert, legt an, löscht — und der Prüfer legt seine
    // Tests in die Prüfmappe, die NICHT in die Messung gehört.
    schreiben(projektPfad, 'app.js', 'ZWEI\n')
    schreiben(projektPfad, 'neu.js', 'frisch gebaut\n')
    fs.rmSync(path.join(projektPfad, 'weg.js'))
    schreiben(projektPfad, 'pruefung/test.js', 'pruefe alles\n')
    zusammen = await strangZusammenfuehren(projektPfad, 'strang/bauer-a', 'Nach Block „Bauer A"')
    messung = await messungNachZusammenfuehrung(projektPfad, zusammen.basisId, zusammen.id)
  })

  it('trägt die Haupt-Spitze von VOR der Zusammenführung als basisId', () => {
    expect(zusammen.ok).toBe(true)
    expect(zusammen.basisId).toBe(basis)
    expect(zusammen.id).not.toBe(basis)
  })

  it('misst genau die angefassten Dateien mit der richtigen Art', () => {
    expect(messung.ok).toBe(true)
    const nach = Object.fromEntries(messung.dateien.map((d) => [d.pfad, d.art]))
    expect(nach).toEqual({
      'app.js': 'geaendert',
      'neu.js': 'neu',
      'weg.js': 'geloescht'
    })
  })

  it('lässt die Prüfmappe draußen — DIFF_AUSGESCHLOSSEN gilt weiter', () => {
    expect(messung.dateien.map((d) => d.pfad)).not.toContain('pruefung/test.js')
  })

  it('gibt bei kaputter oder fehlender basisId ok:false zurück — nie eine leere Liste', async () => {
    const kaputt = await messungNachZusammenfuehrung(
      projektPfad,
      '0123456789abcdef0123456789abcdef01234567',
      zusammen.id
    )
    expect(kaputt.ok).toBe(false)
    // ok:false trägt bewusst KEIN dateien-Feld: Eine leere Liste hieße
    // „nichts angefasst", und genau diese Verwechslung darf es nie geben.
    expect(kaputt.dateien).toBeUndefined()
    const ohne = await messungNachZusammenfuehrung(projektPfad, null, zusammen.id)
    expect(ohne.ok).toBe(false)
    expect(ohne.dateien).toBeUndefined()
  })
})

describe('BAUPLAN 55 · Fertige Nachbararbeit steckt in basisId und misst sich nicht als eigene', () => {
  const projektPfad = projektAnlegen('nachbar')
  let basis = null
  let mA = null
  let mB = null

  beforeAll(async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    basis = await letzterPunktId(projektPfad)
    // Zwei Blöcke öffnen ihre Stränge auf demselben Basispunkt.
    await strangOeffnen(projektPfad, 'strang/bauer-a')
    await strangOeffnen(projektPfad, 'strang/bauer-b')
    // A wird fertig und führt zusammen — seine Datei liegt danach im
    // gemeinsamen Arbeitsordner, in dem B weiterarbeitet.
    schreiben(projektPfad, 'nachbar.js', 'Arbeit von A\n')
    mA = await strangZusammenfuehren(projektPfad, 'strang/bauer-a', 'Nach Block „A"')
    // B arbeitet danach und führt als Zweiter zusammen.
    schreiben(projektPfad, 'eigene.js', 'Arbeit von B\n')
    mB = await strangZusammenfuehren(projektPfad, 'strang/bauer-b', 'Nach Block „B"')
  })

  it('reicht die Basis je Zusammenführung weiter: A ab Laufstart, B ab A', () => {
    expect(mA.ok).toBe(true)
    expect(mA.basisId).toBe(basis)
    expect(mB.ok).toBe(true)
    expect(mB.basisId).toBe(mA.id)
  })

  it("misst für B nur B's Datei — A's Datei liegt im Arbeitsordner, erscheint aber NICHT", async () => {
    // Der Kernfall der Angriffsliste: nachbar.js liegt beim Zusammenführen von
    // B leibhaftig im Ordner. Eine Messung gegen den Laufstart rechnete sie B
    // zu — die Messung gegen basisId (A's Punkt) tut es nicht.
    const messung = await messungNachZusammenfuehrung(projektPfad, mB.basisId, mB.id)
    expect(messung.ok).toBe(true)
    const pfade = messung.dateien.map((d) => d.pfad)
    expect(pfade).toContain('eigene.js')
    expect(pfade).not.toContain('nachbar.js')
    expect(pfade).not.toContain('app.js')
  })

  it("misst für A genau A's Datei", async () => {
    const messung = await messungNachZusammenfuehrung(projektPfad, mA.basisId, mA.id)
    expect(messung.ok).toBe(true)
    expect(messung.dateien).toEqual([{ pfad: 'nachbar.js', art: 'neu' }])
  })
})

describe('BAUPLAN 55 · Auch der vorgezogene Strangpunkt trägt die Mess-Basis', () => {
  const projektPfad = projektAnlegen('vorziehen')
  let basis = null
  let aufStrang = null
  let zusammen = null

  beforeAll(async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    basis = await letzterPunktId(projektPfad)
    await strangOeffnen(projektPfad, 'strang/bauer-1')
    schreiben(projektPfad, 'app.js', 'ZWEI\n')
    // Gleiche Beschriftung wie die Zusammenführung: 'haupt' wird vorgezogen
    // statt einen Zwilling anzulegen (SPEC §3.3) — genau der Pfad, auf dem
    // basisId am leichtesten vergessen würde.
    aufStrang = await sicherungspunktAnlegen(projektPfad, 'Nach Block „Bauer"', {
      strang: 'strang/bauer-1'
    })
    zusammen = await strangZusammenfuehren(projektPfad, 'strang/bauer-1', 'Nach Block „Bauer"')
  })

  it('zieht vor (neu:false) und nennt trotzdem die Basis', () => {
    expect(zusammen.ok).toBe(true)
    expect(zusammen.neu).toBe(false)
    expect(zusammen.id).toBe(aufStrang.id)
    expect(zusammen.basisId).toBe(basis)
  })

  it('die Messung über den vorgezogenen Punkt zeigt die Arbeit des Blocks', async () => {
    const messung = await messungNachZusammenfuehrung(projektPfad, zusammen.basisId, zusammen.id)
    expect(messung.ok).toBe(true)
    expect(messung.dateien).toEqual([{ pfad: 'app.js', art: 'geaendert' }])
  })
})
