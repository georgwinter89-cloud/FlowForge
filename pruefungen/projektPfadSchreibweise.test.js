// Schrägstrich-Pfade sind dieselbe Adresse (Befund E2E-Prüfung 24.08.2026):
// Ein Lauf, der mit C:/…/projekt statt C:\…\projekt gestartet wurde, ließ die
// Karten-Werkzeuge den ganzen Lauf lang „Der Projektordner ist nicht mehr da"
// melden — istBekanntesProjekt verglich den rohen String gegen die Registry.
// Verglichen wird jetzt überall der eine Schlüssel projektPfadSchluessel, und
// laufStarten kanonisiert den Pfad am Eingang.
//
// Rot vor Grün: Vor der Reparatur scheiterte kartenLaden mit der
// Schrägstrich-Fassung eines registrierten Backslash-Pfads.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { projektPfadSchluessel, kartenLaden, projektVergessen, projekteLaden } from '../src/main/projekte.js'

const registryDatei = path.join(app.getPath('userData'), 'projekte.json')
let registryVorher = null

const projektPfad = path.join(os.tmpdir(), `flowforge-pfadschreibweise-${process.pid}`)
const schraegstrichFassung = projektPfad.replaceAll('\\', '/')

beforeAll(() => {
  registryVorher = fs.existsSync(registryDatei) ? fs.readFileSync(registryDatei, 'utf8') : null
  fs.rmSync(projektPfad, { recursive: true, force: true })
  fs.mkdirSync(projektPfad, { recursive: true })
  fs.writeFileSync(path.join(projektPfad, 'projekt.json'), JSON.stringify({ name: 'Probe' }))
  fs.writeFileSync(path.join(projektPfad, 'karten.json'), JSON.stringify([]))
})

afterAll(() => {
  // Die Registry liegt im geteilten Prüf-Datenordner — den Stand von vorher
  // wiederherstellen, damit keine andere Prüfdatei fremde Einträge liest.
  if (registryVorher === null) fs.rmSync(registryDatei, { force: true })
  else fs.writeFileSync(registryDatei, registryVorher)
  fs.rmSync(projektPfad, { recursive: true, force: true })
})

function registrySetzen(pfad) {
  fs.writeFileSync(registryDatei, JSON.stringify([{ pfad }]))
}

describe('projektPfadSchluessel — eine Schreibweise für jeden Vergleich', () => {
  it('Backslash, Schrägstrich, Groß/Klein und Schluss-Schrägstrich fallen zusammen', () => {
    const soll = projektPfadSchluessel(projektPfad)
    expect(projektPfadSchluessel(schraegstrichFassung)).toBe(soll)
    expect(projektPfadSchluessel(schraegstrichFassung + '/')).toBe(soll)
    expect(projektPfadSchluessel(projektPfad.toUpperCase())).toBe(soll)
  })

  it('kaputte Eingaben werfen nicht', () => {
    expect(() => projektPfadSchluessel(null)).not.toThrow()
    expect(() => projektPfadSchluessel(42)).not.toThrow()
  })
})

describe('Registry-Abgleich ist schreibweisen-fest', () => {
  it('registrierter Backslash-Pfad, angefragt mit Schrägstrichen: Karten kommen', () => {
    registrySetzen(projektPfad)
    expect(kartenLaden(schraegstrichFassung).ok).toBe(true)
  })

  it('registrierter Schrägstrich-Pfad, angefragt mit Backslashes: Karten kommen', () => {
    registrySetzen(schraegstrichFassung)
    expect(kartenLaden(projektPfad).ok).toBe(true)
  })

  it('ein wirklich fremder Pfad bleibt draußen', () => {
    registrySetzen(projektPfad)
    expect(kartenLaden(path.join(os.tmpdir(), 'flowforge-gibt-es-nicht')).ok).toBe(false)
  })

  it('projektVergessen trifft den Eintrag auch in der anderen Schreibweise', () => {
    registrySetzen(projektPfad)
    projektVergessen(schraegstrichFassung)
    expect(projekteLaden().projekte).toEqual([])
  })
})

describe('laufStarten kanonisiert den Pfad am Eingang (Quelltext-Zusicherung)', () => {
  it('der Pfad wird vor allem Weiteren durch path.resolve geführt', () => {
    const quelle = fs.readFileSync(
      path.join(process.cwd(), 'src', 'main', 'lauf.js'),
      'utf8'
    )
    expect(quelle).toMatch(/projektPfad = path\.resolve\(projektPfad\)/)
  })
})
