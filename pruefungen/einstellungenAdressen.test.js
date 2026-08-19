// Prüfungen zur Ollama-Adress-Liste (BAUPLAN 51, Bauvertrag V1): Die Migration
// lebt AUSSCHLIESSLICH in einstellungenLaden (alter Einzel-String → Ein-
// Element-Liste), die Liste ist danach IMMER ein nicht-leeres Array
// bereinigter Adressen, und das alte Feld lokaleHelferAdresse spiegelt IMMER
// Element 0 — beim Laden UND beim Speichern. einstellungenSpeichern bereinigt
// je Eintrag (trim, End-Slashes, ^https?://), verwirft Ungültige, entfernt
// exakte Duplikate und fällt bei Aufrufern ohne Array aufs Einzelfeld zurück —
// sonst verlöre jedes Speichern ohne das Feld die Liste still.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Eigener Datenordner: Die anderen Prüfdateien teilen sich den Stub-Ordner und
// schreiben dort einstellungen.json — hier darf nichts dazwischenfunken.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-adressen-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const { einstellungenLaden, einstellungenSpeichern } = await import('../src/main/einstellungen.js')

const dateiPfad = path.join(datenOrdner, 'einstellungen.json')
const STANDARD_ADRESSE = 'http://127.0.0.1:11434'
const schreiben = (daten) => fs.writeFileSync(dateiPfad, JSON.stringify(daten), 'utf8')

beforeEach(() => {
  fs.rmSync(dateiPfad, { force: true })
})

describe('BAUPLAN 51 · Migration in einstellungenLaden', () => {
  it('ohne Datei gilt der Standard: Ein-Element-Liste, Spiegel = Element 0', () => {
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.lokaleHelferAdressen).toEqual([STANDARD_ADRESSE])
    expect(einstellungen.lokaleHelferAdresse).toBe(STANDARD_ADRESSE)
  })

  it('alte Datei mit Einzel-String wird zur Ein-Element-Liste — nicht zum Standard', () => {
    schreiben({ lokaleHelferAdresse: 'http://192.168.1.50:11434' })
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.lokaleHelferAdressen).toEqual(['http://192.168.1.50:11434'])
    expect(einstellungen.lokaleHelferAdresse).toBe('http://192.168.1.50:11434')
  })

  it('eine gespeicherte Liste wird je Eintrag bereinigt: Slashes, Duplikate, Unsinn', () => {
    schreiben({
      lokaleHelferAdressen: [
        ' http://a:11434/ ',
        'http://b:11434',
        'http://a:11434',
        'quatsch',
        ''
      ]
    })
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.lokaleHelferAdressen).toEqual(['http://a:11434', 'http://b:11434'])
    // Spiegel: Element 0 ist der Anker für Helfer-KI und Vorreparatur.
    expect(einstellungen.lokaleHelferAdresse).toBe('http://a:11434')
  })

  it('eine Liste ohne gültigen Eintrag fällt auf den Standard — nie leer', () => {
    schreiben({ lokaleHelferAdressen: ['quatsch', 42, null] })
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.lokaleHelferAdressen).toEqual([STANDARD_ADRESSE])
    expect(einstellungen.lokaleHelferAdresse).toBe(STANDARD_ADRESSE)
  })

  it('liegt die Liste in der Datei, gewinnt sie über das Einzelfeld', () => {
    schreiben({
      lokaleHelferAdresse: 'http://alt:11434',
      lokaleHelferAdressen: ['http://neu-a:11434', 'http://neu-b:11434']
    })
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.lokaleHelferAdressen).toEqual(['http://neu-a:11434', 'http://neu-b:11434'])
    expect(einstellungen.lokaleHelferAdresse).toBe('http://neu-a:11434')
  })
})

describe('BAUPLAN 51 · einstellungenSpeichern mit Adress-Liste', () => {
  const basis = { motorModus: 'abo' }

  it('bereinigt die Liste je Eintrag und schreibt das Einzelfeld als Spiegel mit', () => {
    const e = einstellungenSpeichern({
      ...basis,
      lokaleHelferAdressen: ['http://a:11434/', ' http://b:11434 ', 'http://a:11434', 'kaputt']
    })
    expect(e.ok).toBe(true)
    expect(e.einstellungen.lokaleHelferAdressen).toEqual(['http://a:11434', 'http://b:11434'])
    expect(e.einstellungen.lokaleHelferAdresse).toBe('http://a:11434')
    // Und die Datei trägt beides — Alt-Lesestellen bleiben gültig.
    const datei = JSON.parse(fs.readFileSync(dateiPfad, 'utf8'))
    expect(datei.lokaleHelferAdressen).toEqual(['http://a:11434', 'http://b:11434'])
    expect(datei.lokaleHelferAdresse).toBe('http://a:11434')
  })

  it('Aufrufer ohne Array-Feld (ältere Dialoge/Prüfungen) fallen aufs Einzelfeld zurück', () => {
    const e = einstellungenSpeichern({ ...basis, lokaleHelferAdresse: 'http://solo:11434' })
    expect(e.einstellungen.lokaleHelferAdressen).toEqual(['http://solo:11434'])
    expect(e.einstellungen.lokaleHelferAdresse).toBe('http://solo:11434')
  })

  it('ganz ohne Adressfelder gilt der Standard — die Liste ist nie leer', () => {
    const e = einstellungenSpeichern({ ...basis })
    expect(e.einstellungen.lokaleHelferAdressen).toEqual([STANDARD_ADRESSE])
    expect(e.einstellungen.lokaleHelferAdresse).toBe(STANDARD_ADRESSE)
  })

  it('Laden → Speichern des kompletten Satzes verliert die Mehrfach-Liste nicht (Erststart-Muster)', () => {
    schreiben({ lokaleHelferAdressen: ['http://a:11434', 'http://b:11434'] })
    const geladen = einstellungenLaden().einstellungen
    // Der Erststart-Dialog schickt den kompletten geladenen Satz zurück.
    const e = einstellungenSpeichern({ ...geladen, motorModus: 'abo' })
    expect(e.einstellungen.lokaleHelferAdressen).toEqual(['http://a:11434', 'http://b:11434'])
    expect(e.einstellungen.lokaleHelferAdresse).toBe('http://a:11434')
  })

  it('leere Liste beim Speichern fällt auf den Standard, nicht auf leer', () => {
    const e = einstellungenSpeichern({ ...basis, lokaleHelferAdressen: [] })
    expect(e.einstellungen.lokaleHelferAdressen).toEqual([STANDARD_ADRESSE])
    expect(e.einstellungen.lokaleHelferAdresse).toBe(STANDARD_ADRESSE)
  })
})
