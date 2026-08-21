// Prüfungen zum einstellbaren Kontext-Fenster der lokalen KI (0.46.3, SPEC §4.3):
// 32k / 64k / 128k, die Werkzeug-Deckel wachsen mit, die Einstellung fällt bei
// Unsinn auf den Standard zurück, und der Kreislauf schickt das gewählte Fenster
// als num_ctx an Ollama.
// Rot-vor-Grün: mit `faktor = 1` (statt fenster/32768) in grenzenFuer wurde
// „Deckel wachsen mit" rot; mit hart verdrahtetem num_ctx 32768 wurde die
// Kreislauf-Messung rot.
import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  grenzenFuer,
  lokaleHelferKontextSetzen,
  lokaleHelferGrenzen,
  lokalRecherchieren,
  KONTEXT_FENSTER_STANDARD,
  KONTEXT_FENSTER_WAHL
} from '../src/main/motor/lokaleHelfer.js'
import { einstellungenSpeichern, einstellungenLaden } from '../src/main/einstellungen.js'

afterEach(() => {
  lokaleHelferKontextSetzen(KONTEXT_FENSTER_STANDARD)
  vi.restoreAllMocks()
})

describe('0.46.3 · Kontext-Fenster der lokalen KI', () => {
  // 0.51.3: 96k als Mittelweg dazu — bei 64k bleiben nach dem gemessenen
  // Start-Prompt (~23,5k) nur ~28k Arbeitsraum bis zur Wächter-Marke, 128k
  // sprengt unkomprimiert die 32-GB-Karte.
  it('kennt genau vier Fenster (mit der 96k-Stufe) und 64k als Standard', () => {
    expect(KONTEXT_FENSTER_WAHL).toEqual([32768, 65536, 98304, 131072])
    expect(KONTEXT_FENSTER_STANDARD).toBe(65536)
  })

  it('lässt die Werkzeug-Deckel mit dem Fenster wachsen', () => {
    const klein = grenzenFuer(32768)
    const mittel = grenzenFuer(65536)
    const gross = grenzenFuer(131072)
    expect(klein).toMatchObject({
      kontext: 32768,
      runden: 48,
      zeilenJeLesen: 400,
      zeichenJeAntwort: 24000,
      trefferJeSuche: 60,
      eintraegeJeOrdner: 300
    })
    expect(mittel).toMatchObject({ kontext: 65536, runden: 64, zeilenJeLesen: 800, trefferJeSuche: 120 })
    // 0.51.3: 96k ist das Dreifache der 32k-Bezugsgröße; die Runden bekommen
    // eine EIGENE Stufe (80) — vorher fiel 96k in die 64k-Stufe und hätte ein
    // Drittel mehr Fenster ohne einen einzigen Zug mehr bekommen.
    expect(grenzenFuer(98304)).toMatchObject({
      kontext: 98304,
      runden: 80,
      zeilenJeLesen: 1200,
      zeichenJeAntwort: 72000,
      trefferJeSuche: 180,
      eintraegeJeOrdner: 900
    })
    expect(gross).toMatchObject({
      kontext: 131072,
      runden: 96,
      zeilenJeLesen: 1600,
      zeichenJeAntwort: 96000,
      eintraegeJeOrdner: 1200
    })
  })

  it('fällt bei Unsinn auf den Standard zurück', () => {
    expect(grenzenFuer(999).kontext).toBe(65536)
    expect(grenzenFuer(undefined).kontext).toBe(65536)
    expect(grenzenFuer('131072').kontext).toBe(131072)
  })

  it('setzt die geltenden Grenzen für den Lauf', () => {
    lokaleHelferKontextSetzen(131072)
    expect(lokaleHelferGrenzen().zeilenJeLesen).toBe(1600)
    lokaleHelferKontextSetzen(32768)
    expect(lokaleHelferGrenzen().zeilenJeLesen).toBe(400)
  })

  it('schickt das gewählte Fenster als num_ctx an Ollama, und datei_lesen nennt den passenden Deckel', async () => {
    lokaleHelferKontextSetzen(131072)
    const projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-kontext-'))
    let gesendet = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      gesendet = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({ message: { role: 'assistant', content: 'FAZIT: nichts zu tun' } })
      }
    })
    await lokalRecherchieren({
      projektPfad: projekt,
      auftrag: 'Sag nichts.',
      modell: 'test',
      aufSchritt: () => {},
      aufDenken: () => {}
    })
    fs.rmSync(projekt, { recursive: true, force: true })
    expect(gesendet.options.num_ctx).toBe(131072)
    const lesen = gesendet.tools.find((w) => w.function.name === 'datei_lesen')
    expect(lesen.function.description).toContain('1600')
  })

  it('speichert nur die vier bekannten Fenster in den Einstellungen', () => {
    const basis = { motorModus: 'abo', apiSchluessel: '', ausgabenObergrenzeUsd: 5 }
    expect(einstellungenSpeichern({ ...basis, lokaleHelferKontext: 131072 }).einstellungen.lokaleHelferKontext).toBe(131072)
    // 0.51.3 — genau die Falle, gegen die die Stufenliste einen einzigen
    // Wohnort bekam: Der Dialog bot 96k an, das Speichern drehte es zurück.
    expect(einstellungenSpeichern({ ...basis, lokaleHelferKontext: 98304 }).einstellungen.lokaleHelferKontext).toBe(98304)
    expect(einstellungenSpeichern({ ...basis, lokaleHelferKontext: 12345 }).einstellungen.lokaleHelferKontext).toBe(65536)
    expect(einstellungenSpeichern({ ...basis }).einstellungen.lokaleHelferKontext).toBe(65536)
    expect(einstellungenLaden().einstellungen.lokaleHelferKontext).toBe(65536)
  })
})
