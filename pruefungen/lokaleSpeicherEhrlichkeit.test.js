// Prüfungen zur Speicher-Ehrlichkeit der lokalen KI (Zwischenschritt 0.51.3):
// VRAM-Passt-Prüfung über Ollamas Prozessliste, die einstellbare Geduld der
// Werkzeug-Schicht und die 96k-Zwischenstufe der Fensterwahl.
//
// Anlass (Wiederholungslauf Life OS, 20.08.2026): Der lokale Bauer starb nach
// 72 Minuten am Zeitlimit der Werkzeug-Schicht. Der Lokal-Wächter aus 0.51.1
// feuerte korrekt nicht — es war kein Kontext-Überlauf, sondern Speicherdruck:
// Das 128k-Fenster sprengte mit seinem Zwischenspeicher die 32-GB-Karte, Ollama
// lagerte in den Arbeitsspeicher aus (gemessen 7,5 → 42 GB), und jeder
// Gesprächswechsel rechnete das volle Gespräch im RAM-Kriechgang neu durch.
//
// Rot vor Grün: Vor diesem Schritt gab es vramBefundAus, ollamaSpeicherStand und
// lokaleGeduldBereinigen nicht; /api/ps wurde nirgends abgefragt, API_TIMEOUT_MS
// stand ausschließlich auf der Wegwerf-Liste geerbter Schalter, und die
// Fensterwahl kannte nur 32k/64k/128k.
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LOKAL_GEDULD_WAHL,
  LOKAL_GEDULD_STANDARD,
  LOKAL_KONTEXT_WAHL,
  VRAM_PASST_ANTEIL,
  lokaleGeduldBereinigen,
  vramBefundAus,
  vramProzent
} from '../src/shared/lokalRegeln.js'
import { ollamaSpeicherStand } from '../src/main/motor/lokalerSpeicher.js'
import { einstellungenSpeichern, einstellungenLaden } from '../src/main/einstellungen.js'
import { CLI_SCHALTER_WEG, umgebungBereinigen } from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

const hier = path.dirname(fileURLToPath(import.meta.url))
const motorQuelle = fs.readFileSync(
  path.join(hier, '..', 'src', 'main', 'motor', 'claudeCodeMotor.js'),
  'utf8'
)

const BASIS = { motorModus: 'abo', apiSchluessel: '', ausgabenObergrenzeUsd: 5 }
// Gemessene Größenordnung eines 27B-Modells samt Zwischenspeicher (Bytes).
const GESAMT = 30_000_000_000

afterEach(() => {
  vi.restoreAllMocks()
  // Die Einstellungsdatei ist zwischen den Prüfdateien geteilt — der neue
  // Wert darf keinem anderen Lauf eine Ticker-Zeile unterschieben.
  einstellungenSpeichern({ ...BASIS, lokaleAntwortGeduldMs: LOKAL_GEDULD_STANDARD })
})

describe('0.51.3 · Auswertung von Ollamas Prozessliste', () => {
  it('erkennt das voll geladene Modell — auch mit dem :latest, das Ollama anhängt', () => {
    const befund = vramBefundAus(
      [{ name: 'flowforge-qwen3.8-27b:latest', size: GESAMT, size_vram: GESAMT }],
      'flowforge-qwen3.8-27b'
    )
    expect(befund).toMatchObject({ anteil: 1, passt: true })
  })

  it('erkennt es auch, wenn der Suchname das :latest trägt und die Liste nicht', () => {
    const befund = vramBefundAus(
      [{ model: 'flowforge-qwen3.8-27b', size: GESAMT, size_vram: GESAMT }],
      'flowforge-qwen3.8-27b:latest'
    )
    expect(befund?.passt).toBe(true)
  })

  it('meldet ausgelagerten Speicher als „passt nicht" — der Fall vom 20.08.2026', () => {
    // 18 von 30 GB in der Karte: genau das Bild, das Ollama zeigte, während
    // der Bauer 72 Minuten kroch und dann am Zeitlimit starb.
    const befund = vramBefundAus(
      [{ name: 'flowforge-qwen3.8-27b:latest', size: GESAMT, size_vram: 18_000_000_000 }],
      'flowforge-qwen3.8-27b'
    )
    expect(befund.passt).toBe(false)
    expect(vramProzent(befund.anteil)).toBe(60)
  })

  it('lässt eine Handbreit Luft: 99 % gelten als drin, 98 % nicht', () => {
    expect(VRAM_PASST_ANTEIL).toBe(0.99)
    const bei = (anteil) =>
      vramBefundAus([{ name: 'm', size: 1_000_000, size_vram: Math.round(1_000_000 * anteil) }], 'm')
        .passt
    expect(bei(0.99)).toBe(true)
    expect(bei(0.98)).toBe(false)
  })

  it('rundet den Anteil AB — neben einer Warnung darf nie „100 %" stehen', () => {
    expect(vramProzent(0.999)).toBe(99)
    expect(vramProzent(1)).toBe(100)
    expect(vramProzent('kaputt')).toBe(0)
    expect(vramProzent(-3)).toBe(0)
  })

  it('liefert null statt einer Warnung, wenn die Frage nicht beantwortbar ist', () => {
    // Kein Fehlalarm aus fehlenden Feldern: Georg würde sonst genau das
    // Fenster verstellen, das richtig war.
    expect(vramBefundAus([{ name: 'flowforge-m:latest' }], 'flowforge-m')).toBeNull()
    expect(vramBefundAus([{ name: 'flowforge-m', size: GESAMT }], 'flowforge-m')).toBeNull()
    expect(vramBefundAus([{ name: 'flowforge-m', size: 0, size_vram: 0 }], 'flowforge-m')).toBeNull()
    // Ein anderes Modell in der Liste ist keine Auskunft über unseres.
    expect(vramBefundAus([{ name: 'llama3', size: GESAMT, size_vram: 0 }], 'flowforge-m')).toBeNull()
    expect(vramBefundAus(null, 'flowforge-m')).toBeNull()
    expect(vramBefundAus([{ name: 'flowforge-m', size: 1, size_vram: 1 }], '')).toBeNull()
  })
})

describe('0.51.3 · Abfrage von /api/ps', () => {
  it('fragt genau /api/ps an der Adresse des Blocks — Endstrich der Adresse egal', async () => {
    let gefragt = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      gefragt = String(url)
      return {
        ok: true,
        json: async () => ({
          models: [{ name: 'flowforge-m:latest', size: GESAMT, size_vram: 15_000_000_000 }]
        })
      }
    })
    const stand = await ollamaSpeicherStand({
      adresse: 'http://gaming-pc:11434/',
      modell: 'flowforge-m'
    })
    expect(gefragt).toBe('http://gaming-pc:11434/api/ps')
    expect(stand).toMatchObject({ ok: true, passt: false })
    expect(vramProzent(stand.anteil)).toBe(50)
  })

  it('schweigt bei HTTP-Fehler, kaputter Antwort und geworfenem Fehler — nie ein Fehlalarm', async () => {
    const mit = async (antwort) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        if (typeof antwort === 'function') return antwort()
        return antwort
      })
      const stand = await ollamaSpeicherStand({ adresse: 'http://x:11434', modell: 'flowforge-m' })
      vi.restoreAllMocks()
      return stand
    }
    expect(await mit({ ok: false, json: async () => ({}) })).toEqual({ ok: false })
    expect(await mit({ ok: true, json: async () => ({ irgendwas: 1 }) })).toEqual({ ok: false })
    expect(
      await mit({
        ok: true,
        json: async () => {
          throw new Error('kein JSON')
        }
      })
    ).toEqual({ ok: false })
    expect(
      await mit(() => {
        throw new Error('nicht erreichbar')
      })
    ).toEqual({ ok: false })
  })

  it('fragt gar nicht erst ohne Adresse oder Modell', async () => {
    const ruf = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => ({ ok: true, json: async () => ({}) }))
    expect(await ollamaSpeicherStand({ adresse: '', modell: 'flowforge-m' })).toEqual({ ok: false })
    expect(await ollamaSpeicherStand({ adresse: 'http://x:11434', modell: '  ' })).toEqual({
      ok: false
    })
    expect(ruf).not.toHaveBeenCalled()
  })
})

describe('0.51.3 · Warnzeile im Ticker', () => {
  it('nennt Anteil, Fenster, Folge und den Weg heraus — in Alltagssprache', () => {
    const zeile = texte.ticker.lokalSpeicherKnapp(60, 131072)
    expect(zeile).toContain('60 %')
    expect(zeile).toContain('131.072')
    expect(zeile).toContain('Zeitüberschreitung')
    expect(zeile).toContain('Kontextfenster')
    // Der zweite Weg (Ollama-Servervariablen) steht im Einstellungs-Hinweis;
    // die Ticker-Zeile verweist darauf, statt Befehle in den Lauf zu schreiben.
    expect(zeile).toContain('Zwischenspeicher-Kompression')
    expect(texte.einstellungen.lokaleHelferKontextHinweis).toContain('OLLAMA_FLASH_ATTENTION=1')
    expect(texte.einstellungen.lokaleHelferKontextHinweis).toContain('OLLAMA_KV_CACHE_TYPE=q8_0')
  })
})

describe('0.51.3 · Geduld der Werkzeug-Schicht als Einstellung', () => {
  it('kennt Standard und drei verlängerte Stufen', () => {
    expect(LOKAL_GEDULD_WAHL).toEqual([0, 900000, 1800000, 3600000])
    expect(LOKAL_GEDULD_STANDARD).toBe(0)
    expect(texte.einstellungen.lokaleGeduldWahl(0)).toContain('Standard')
    expect(texte.einstellungen.lokaleGeduldWahl(1800000)).toBe('30 Minuten')
  })

  it('nimmt nur bekannte Stufen an, alles andere ist Standard', () => {
    expect(lokaleGeduldBereinigen(900000)).toBe(900000)
    expect(lokaleGeduldBereinigen('1800000')).toBe(1800000)
    expect(lokaleGeduldBereinigen(12345)).toBe(0)
    expect(lokaleGeduldBereinigen(undefined)).toBe(0)
    expect(lokaleGeduldBereinigen('viel Geduld')).toBe(0)
  })

  it('speichert die Wahl — und verliert sie NICHT, wenn ein Aufrufer das Feld nicht kennt', () => {
    // Genau der stille Verlust, den Prüfer 1 in Bausession 51 an der
    // Adress-Liste fand. Hier wöge er schwerer: Der zurückgedrehte Wert holte
    // genau den Abbruch zurück, gegen den die Einstellung gebaut ist.
    expect(
      einstellungenSpeichern({ ...BASIS, lokaleAntwortGeduldMs: 1800000 }).einstellungen
        .lokaleAntwortGeduldMs
    ).toBe(1800000)
    expect(einstellungenSpeichern({ ...BASIS }).einstellungen.lokaleAntwortGeduldMs).toBe(1800000)
    expect(einstellungenLaden().einstellungen.lokaleAntwortGeduldMs).toBe(1800000)
    // Eine unbekannte Stufe ist dagegen eine Aussage: zurück auf Standard.
    expect(
      einstellungenSpeichern({ ...BASIS, lokaleAntwortGeduldMs: 42 }).einstellungen
        .lokaleAntwortGeduldMs
    ).toBe(0)
  })
})

describe('0.51.3 · Verdrahtung im Motor', () => {
  it('setzt API_TIMEOUT_MS ausschließlich in der Umgebung lokaler Motor-Instanzen', () => {
    const treffer = motorQuelle.match(/umgebung\.API_TIMEOUT_MS/g) ?? []
    expect(treffer).toHaveLength(1)
    const bereinigt = motorQuelle.indexOf(
      'const umgebung = umgebungBereinigen(process.env)\n    if (lokal)'
    )
    const gesetzt = motorQuelle.indexOf('umgebung.API_TIMEOUT_MS')
    const claudeZweig = motorQuelle.indexOf("} else if (modus === 'api')")
    expect(bereinigt).toBeGreaterThan(-1)
    // Erst bereinigen, dann setzen — und noch VOR dem Claude-Zweig, also
    // innerhalb von `if (lokal)`.
    expect(gesetzt).toBeGreaterThan(bereinigt)
    expect(gesetzt).toBeLessThan(claudeZweig)
  })

  it('ein GEERBTES API_TIMEOUT_MS fliegt weiter raus — die Bereinigung aus 0.51.1 bleibt', () => {
    expect(CLI_SCHALTER_WEG.has('API_TIMEOUT_MS')).toBe(true)
    expect(umgebungBereinigen({ API_TIMEOUT_MS: '600000', PATH: 'x' })).toEqual({ PATH: 'x' })
  })

  it('misst den Speicherstand im Einmal-Moment der Start-Prompt-Zeile', () => {
    // Nach dem ersten Turn ist das Modell sicher geladen — derselbe Moment,
    // an dem der Lokal-Wächter die Start-Prompt-Zeile meldet.
    const start = motorQuelle.indexOf('block.startPromptGemeldet = true')
    const messung = motorQuelle.indexOf('speicherPruefungMelden()\n')
    const naechsteFunktion = motorQuelle.indexOf('// Übertrag anfordern')
    expect(start).toBeGreaterThan(-1)
    expect(messung).toBeGreaterThan(start)
    expect(messung).toBeLessThan(naechsteFunktion)
    // Ohne await: Ein hängendes Ollama darf den Wächter nicht aufhalten.
    expect(motorQuelle).not.toContain('await speicherPruefungMelden()')
  })
})

describe('0.51.3 · 96k-Zwischenstufe', () => {
  it('steht in der Stufenliste, die Dialog, Speicherung und Deckel gemeinsam lesen', () => {
    expect(LOKAL_KONTEXT_WAHL).toEqual([32768, 65536, 98304, 131072])
    expect(texte.einstellungen.lokaleHelferKontextWahl(98304)).toBe('96k Token')
  })
})
