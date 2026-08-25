// Zusatzbauer-Einstellungen (BAUPLAN 57, E14): `fundeAusserhalb` (karte ·
// mitnehmen · bericht, Standard karte) und `zusatzbauerMax` (ganze Zahl ≥ 0,
// Standard 1). Gespeichert wird nach dem GEDULD-Muster (0.51.3): Ein Aufrufer,
// der die Felder gar nicht kennt (undefined), darf Georgs Wahl nicht still auf
// den Standard zurückdrehen — genau der stille Verlust, den das Kontextfenster-
// Gegenmuster hätte. Rot vor Grün: Vor dem Bauschritt kannte STANDARD keines
// der Felder, und einstellungenSpeichern ließ beide beim Speichern fallen.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Eigener Datenordner: Die anderen Prüfdateien teilen sich den Stub-Ordner und
// schreiben dort einstellungen.json — hier darf nichts dazwischenfunken.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-zusatzbauer-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const { einstellungenLaden, einstellungenSpeichern } = await import('../src/main/einstellungen.js')

const dateiPfad = path.join(datenOrdner, 'einstellungen.json')
const schreiben = (daten) => fs.writeFileSync(dateiPfad, JSON.stringify(daten), 'utf8')
const basis = { motorModus: 'abo' }

beforeEach(() => {
  fs.rmSync(dateiPfad, { force: true })
})

describe('BAUPLAN 57 · einstellungenLaden', () => {
  it('ohne Datei gelten die Standards: karte, Höchstzahl 1', () => {
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.fundeAusserhalb).toBe('karte')
    expect(einstellungen.zusatzbauerMax).toBe(1)
  })

  it('gespeicherte Werte kommen bereinigt an — der Lauf sieht nie Unsinn', () => {
    schreiben({ fundeAusserhalb: 'mitnehmen', zusatzbauerMax: 3 })
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.fundeAusserhalb).toBe('mitnehmen')
    expect(einstellungen.zusatzbauerMax).toBe(3)
  })

  it('kaputte Werte fallen auf den Standard, nicht auf undefined', () => {
    schreiben({ fundeAusserhalb: 'ignorieren', zusatzbauerMax: -4 })
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.fundeAusserhalb).toBe('karte')
    expect(einstellungen.zusatzbauerMax).toBe(1)
  })

  it('0 ist eine gültige Wahl — „nie mitnehmen" wird nicht auf 1 gehoben', () => {
    schreiben({ zusatzbauerMax: 0 })
    expect(einstellungenLaden().einstellungen.zusatzbauerMax).toBe(0)
  })
})

describe('BAUPLAN 57 · einstellungenSpeichern nach dem Geduld-Muster', () => {
  it('speichert beide Felder und schreibt sie in die Datei', () => {
    const e = einstellungenSpeichern({ ...basis, fundeAusserhalb: 'bericht', zusatzbauerMax: 2 })
    expect(e.ok).toBe(true)
    expect(e.einstellungen.fundeAusserhalb).toBe('bericht')
    expect(e.einstellungen.zusatzbauerMax).toBe(2)
    const datei = JSON.parse(fs.readFileSync(dateiPfad, 'utf8'))
    expect(datei.fundeAusserhalb).toBe('bericht')
    expect(datei.zusatzbauerMax).toBe(2)
  })

  // Der Kern des Musters: Genau dieser Aufruf drehte beim Kontextfenster-
  // Gegenmuster Georgs Wahl still zurück.
  it('ein Aufrufer ohne die Felder (ältere Dialoge) hält Georgs Wahl aus der Datei', () => {
    schreiben({ fundeAusserhalb: 'mitnehmen', zusatzbauerMax: 4 })
    const e = einstellungenSpeichern({ ...basis })
    expect(e.einstellungen.fundeAusserhalb).toBe('mitnehmen')
    expect(e.einstellungen.zusatzbauerMax).toBe(4)
    const datei = JSON.parse(fs.readFileSync(dateiPfad, 'utf8'))
    expect(datei.fundeAusserhalb).toBe('mitnehmen')
    expect(datei.zusatzbauerMax).toBe(4)
  })

  it('mitgeschickter Unsinn wird bereinigt (unbekannter Wert = Standard)', () => {
    schreiben({ fundeAusserhalb: 'mitnehmen', zusatzbauerMax: 4 })
    const e = einstellungenSpeichern({ ...basis, fundeAusserhalb: 'quatsch', zusatzbauerMax: 2.5 })
    expect(e.einstellungen.fundeAusserhalb).toBe('karte')
    expect(e.einstellungen.zusatzbauerMax).toBe(1)
  })

  it('eine leere Höchstzahl ist NICHT 0 — sie fällt auf den Standard', () => {
    const e = einstellungenSpeichern({ ...basis, zusatzbauerMax: '' })
    expect(e.einstellungen.zusatzbauerMax).toBe(1)
  })

  it('0 übersteht das Speichern — eine bewusste Wahl bleibt eine', () => {
    const e = einstellungenSpeichern({ ...basis, fundeAusserhalb: 'mitnehmen', zusatzbauerMax: 0 })
    expect(e.einstellungen.zusatzbauerMax).toBe(0)
  })

  it('Laden → Speichern des kompletten Satzes verliert nichts (Erststart-Muster)', () => {
    schreiben({ fundeAusserhalb: 'bericht', zusatzbauerMax: 5 })
    const geladen = einstellungenLaden().einstellungen
    const e = einstellungenSpeichern({ ...geladen, motorModus: 'abo' })
    expect(e.einstellungen.fundeAusserhalb).toBe('bericht')
    expect(e.einstellungen.zusatzbauerMax).toBe(5)
  })
})
