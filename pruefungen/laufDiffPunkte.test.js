// Prüfung zum Diff aus echten Sicherungspunkten (BAUPLAN 34).
// Die reine Rechnung steht in kantenEhrlichkeit.test.js — hier läuft der Weg
// über zwei wirkliche Punkte im versteckten Git-Verzeichnis, weil genau dort
// der Fehler säße, den man am Ergebnis nicht sieht: eine Prüfmappe, die als
// „Bauer-Änderung" in den Auftrag der Reparatur-Runde wandert.
// Rot-vor-Grün: Ohne den Prüfmappen-Ausschluss in punkteVergleichen taucht
// pruefung/test.js in der Dateiliste auf — der dritte Fall schlägt dann fehl.
//
// Diese Datei prüft ausdrücklich den Weg OHNE Strang (BAUPLAN 45): alle Aufrufe
// ohne die neuen Zusatzangaben, also gegen 'haupt' und ungefiltert. Sie ist
// damit die Zusage, dass der Alltagsweg unverändert weiterläuft, während der
// getrennte Weg je Schreiber in sicherungsstraenge.test.js gemessen wird.
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  sicherungspunktAnlegen,
  letzterPunktId,
  standWeichtAb,
  punkteVergleichen
} from '../src/main/sicherungspunkte.js'
import { diffTextBauen } from '../src/shared/laufDiff.js'

const projektPfad = path.join(os.tmpdir(), 'flowforge-diff-pruefung-' + process.pid)
let vorBauer = null
let nachBauer = null

beforeAll(async () => {
  fs.rmSync(projektPfad, { recursive: true, force: true })
  fs.mkdirSync(projektPfad, { recursive: true })
  fs.writeFileSync(path.join(projektPfad, 'app.js'), 'eins\nzwei\ndrei\n', 'utf8')
  fs.writeFileSync(path.join(projektPfad, 'weg.js'), 'verschwindet\n', 'utf8')
  await sicherungspunktAnlegen(projektPfad, 'vor dem Lauf')
  vorBauer = await letzterPunktId(projektPfad)

  // Der Bauer arbeitet: ändert, legt an, löscht.
  fs.writeFileSync(path.join(projektPfad, 'app.js'), 'eins\nZWEI\ndrei\n', 'utf8')
  // Bekannte Grenze der Sicherungspunkte (gefunden 15.08.2026): Die
  // Änderungs-Erkennung von isomorphic-git vergleicht Zeitstempel nur
  // sekundengenau — eine Änderung GLEICHER Länge innerhalb derselben Sekunde
  // wie der vorige Punkt bliebe unsichtbar. Im Alltag arbeitet ein Block
  // Sekunden bis Minuten; die Prüfung stellt diesen Abstand künstlich her,
  // statt eine Sub-Sekunden-Wette einzugehen.
  const spaeter = new Date(Date.now() + 5000)
  fs.utimesSync(path.join(projektPfad, 'app.js'), spaeter, spaeter)
  fs.writeFileSync(path.join(projektPfad, 'neu.js'), 'frisch gebaut\n', 'utf8')
  fs.rmSync(path.join(projektPfad, 'weg.js'))
  // Der Prüfer legt seine Tests in die Prüfmappe — die gehört NICHT in den Diff.
  fs.mkdirSync(path.join(projektPfad, 'pruefung'), { recursive: true })
  fs.writeFileSync(path.join(projektPfad, 'pruefung', 'test.js'), 'pruefe alles\n', 'utf8')
  await sicherungspunktAnlegen(projektPfad, 'nach Bauer')
  nachBauer = await letzterPunktId(projektPfad)
})

describe('BAUPLAN 34 · Diff aus zwei Sicherungspunkten', () => {
  it('legt für jeden Stand einen eigenen Punkt an', () => {
    expect(vorBauer).toBeTruthy()
    expect(nachBauer).toBeTruthy()
    expect(vorBauer).not.toBe(nachBauer)
  })

  it('findet geänderte, neue und gelöschte Dateien mit Zeilenbilanz', async () => {
    const vergleich = await punkteVergleichen(projektPfad, vorBauer, nachBauer)
    expect(vergleich.ok).toBe(true)
    // Ohne Dateiliste fällt nichts weg — der ungefilterte Weg meldet ehrlich 0,
    // statt die Zahl offenzulassen (BAUPLAN 45).
    expect(vergleich.ausserhalb).toBe(0)
    const nach = Object.fromEntries(vergleich.dateien.map((datei) => [datei.pfad, datei]))
    expect(nach['app.js']).toMatchObject({ art: 'geaendert', plus: 1, minus: 1 })
    expect(nach['neu.js']).toMatchObject({ art: 'neu' })
    expect(nach['weg.js']).toMatchObject({ art: 'geloescht' })
  })

  it('lässt die Prüfmappe draußen — sie ist keine Bauer-Änderung', async () => {
    const vergleich = await punkteVergleichen(projektPfad, vorBauer, nachBauer)
    expect(vergleich.dateien.map((datei) => datei.pfad)).not.toContain('pruefung/test.js')
    const text = diffTextBauen(vergleich.dateien)
    expect(text).not.toContain('pruefung/')
    expect(text).toContain('app.js')
    expect(text).toContain('+ZWEI')
  })

  it('merkt, ob der Ordner schon vom letzten Punkt abweicht', async () => {
    expect(await standWeichtAb(projektPfad)).toBe(false)
    fs.writeFileSync(path.join(projektPfad, 'app.js'), 'von aussen veraendert\n', 'utf8')
    expect(await standWeichtAb(projektPfad)).toBe(true)
  })

  it('meldet einen unveränderten Vergleich als leer', async () => {
    const vergleich = await punkteVergleichen(projektPfad, nachBauer, nachBauer)
    expect(vergleich.ok).toBe(true)
    expect(vergleich.dateien).toEqual([])
  })
})
