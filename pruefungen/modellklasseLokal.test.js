// Prüfungen zur fünften Modellklasse „lokal" (BAUPLAN 49): Georgs lokale KI
// über Ollamas Anthropic-Schnittstelle als Block-Agent. Geprüft werden die
// Regeln im Katalog (Reihenfolge, Aliase, Denktiefe/Kosten-Hinweis, keine
// Vorbelegung), der KI-Assistent (schlägt lokal nie vor), die Einstellungen
// (Häkchen und Feineinstellungen mit Bereinigung), die Texte, auf die die
// Oberfläche baut, und — am Quelltext — die Stellen in Leinwand, Block-Editor
// und Einstellungen-Dialog, die die Klasse sichtbar machen.
//
// Rot-vor-Grün: Vor Bauschritt 49 hatte MODELL_KLASSEN vier Einträge,
// MODELL_KLASSE_LOKAL/klasseIstLokal gab es nicht, einstellungenSpeichern
// kannte lokalBlockAgent/lokalFein nicht, und die texte-Schlüssel fehlten.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Eigener Datenordner (Muster aus erststartWahl.test.js): Die anderen
// Prüfdateien teilen sich den Stub-Ordner und schreiben dort einstellungen.json.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-lokal-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const {
  BLOCK_KATALOG,
  MODELL_KLASSEN,
  MODELL_KLASSE_LOKAL,
  blockDefinition,
  blockModellKlasse,
  klasseHatKostenHinweis,
  klasseIstLokal,
  klasseKenntDenktiefe,
  modellKlasseGueltig,
  sdkModell,
  unterModellFuer
} = await import('../src/shared/blockKatalog.js')
const { LOKAL_FEIN_FELDER, LOKAL_FEIN_VORLAGEN } = await import('../src/shared/lokalRegeln.js')
const { pruefeEigenenBlock } = await import('../src/shared/blockRegeln.js')
const { vorschlagSaeubern } = await import('../src/main/blockAssistent.js')
const { einstellungenLaden, einstellungenSpeichern } = await import('../src/main/einstellungen.js')
const { texte } = await import('../src/shared/texte.js')

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')

beforeEach(() => {
  fs.rmSync(path.join(datenOrdner, 'einstellungen.json'), { force: true })
})

describe('BAUPLAN 49 · Klasse lokal im Katalog', () => {
  it('steht ganz hinten als fünfte, „billigste" Klasse', () => {
    expect(MODELL_KLASSEN.at(-1)).toBe('lokal')
    expect(MODELL_KLASSEN.length).toBe(5)
    expect(MODELL_KLASSE_LOKAL).toBe('lokal')
    expect(modellKlasseGueltig('lokal')).toBe('lokal')
  })

  it('klasseIstLokal erkennt genau diese eine Klasse', () => {
    expect(MODELL_KLASSEN.filter(klasseIstLokal)).toEqual(['lokal'])
    expect(klasseIstLokal('standard')).toBe(false)
    expect(klasseIstLokal(undefined)).toBe(false)
  })

  it('der SDK-Alias ist der Platzhalter „lokal" — den Ollama-Namen setzt der lokale Motor ein', () => {
    expect(sdkModell('lokal')).toBe('lokal')
  })

  it('kennt keine Denktiefe und trägt keinen Kosten-Hinweis', () => {
    expect(klasseKenntDenktiefe('lokal')).toBe(false)
    expect(klasseHatKostenHinweis('lokal')).toBe(false)
  })

  it('Unteraufgaben eines lokalen Blocks bleiben lokal — es gibt nichts Billigeres', () => {
    const bauer = blockDefinition('bauer')
    expect(unterModellFuer(bauer, 'lokal', 'sparsam')).toBe('lokal')
    expect(unterModellFuer(bauer, 'lokal', 'wieBlock')).toBe('lokal')
    expect(unterModellFuer(blockDefinition('audit'), 'lokal', 'sparsam')).toBe('lokal')
  })

  it('kein Katalog-Block ist auf lokal vorbelegt — lokal ist immer Georgs bewusste Wahl', () => {
    for (const def of BLOCK_KATALOG) {
      expect(def.modell).not.toBe('lokal')
      expect(blockModellKlasse(def)).not.toBe('lokal')
    }
  })

  it('an der Karte und im Editor ist lokal wählbar', () => {
    expect(blockModellKlasse(blockDefinition('bauer'), { modell: 'lokal' })).toBe('lokal')
    const grund = { name: 'Lokaler Bauer', auftrag: 'Du baust.' }
    expect(pruefeEigenenBlock({ ...grund, modell: 'lokal' }).block.modell).toBe('lokal')
  })
})

describe('BAUPLAN 49 · Der KI-Assistent des Block-Editors schlägt lokal nie vor', () => {
  it('ein Vorschlag mit modell lokal wird auf Standard gezogen (wie bei Extra)', () => {
    expect(vorschlagSaeubern({ modell: 'lokal' }).modell).toBe('standard')
    expect(vorschlagSaeubern({ modell: 'extra' }).modell).toBe('standard')
    expect(vorschlagSaeubern({ modell: 'sparsam' }).modell).toBe('sparsam')
  })
})

describe('BAUPLAN 49 · Einstellungen: Häkchen und Feineinstellungen', () => {
  it('Standard: Block-Agent aus, Feineinstellungen = Ollama-Standard', () => {
    const e = einstellungenLaden().einstellungen
    expect(e.lokalBlockAgent).toBe(false)
    expect(e.lokalFein).toEqual(LOKAL_FEIN_VORLAGEN['ollama-standard'])
    expect(Object.keys(e.lokalFein)).toEqual(LOKAL_FEIN_FELDER)
  })

  it('Speichern übernimmt Häkchen und Werte — Unsinn wird zu Ollama-Standard, nicht geklemmt', () => {
    const ergebnis = einstellungenSpeichern({
      motorModus: 'abo',
      lokaleHelferAktiv: true,
      lokalBlockAgent: true,
      lokalFein: { ...LOKAL_FEIN_VORLAGEN['qwen-coding'], topK: 999, antwortlaenge: 4096, fremd: 1 }
    })
    expect(ergebnis.ok).toBe(true)
    const e = einstellungenLaden().einstellungen
    expect(e.lokalBlockAgent).toBe(true)
    expect(e.lokalFein).toEqual({
      ...LOKAL_FEIN_VORLAGEN['qwen-coding'],
      topK: null,
      antwortlaenge: 4096
    })
    expect(e.lokalFein).not.toHaveProperty('fremd')
  })

  it('ältere Aufrufer ohne die Felder: Häkchen aus, Feineinstellungen leer — nichts bleibt halb', () => {
    einstellungenSpeichern({ motorModus: 'abo' })
    const e = einstellungenLaden().einstellungen
    expect(e.lokalBlockAgent).toBe(false)
    expect(e.lokalFein).toEqual(LOKAL_FEIN_VORLAGEN['ollama-standard'])
  })

  it('eine von Hand bearbeitete Datei mit halbem lokalFein wird beim Laden vervollständigt', () => {
    fs.writeFileSync(
      path.join(datenOrdner, 'einstellungen.json'),
      JSON.stringify({ motorModus: 'abo', lokalBlockAgent: 'ja', lokalFein: { temperatur: '0,6' } })
    )
    const e = einstellungenLaden().einstellungen
    expect(e.lokalFein).toEqual({ ...LOKAL_FEIN_VORLAGEN['ollama-standard'], temperatur: 0.6 })
    expect(Object.keys(e.lokalFein)).toEqual(LOKAL_FEIN_FELDER)
  })
})

describe('BAUPLAN 49 · Texte, auf die die Oberfläche baut', () => {
  it('Karte/Editor: Name, Hinweis und Laufbericht-Name der Klasse lokal', () => {
    const tk = texte.kette
    expect(tk.modellNamen.lokal).toBe('lokal (Ollama)')
    expect(typeof tk.modellLokalHinweis).toBe('string')
    expect(tk.modellLokalHinweis).toMatch(/Denktiefe/)
    expect(tk.modellLokalHinweis).toMatch(/nie still/i)
    expect(tk.lokalModellName('flowforge-qwen')).toBe('lokal (flowforge-qwen)')
    // Denktiefe-Hinweis für lokal an der Karte und im Editor: der Haiku-Satz
    // nennt Haiku beim Namen und passt darum nicht.
    expect(typeof tk.denktiefeLokalHinweis).toBe('string')
    expect(tk.denktiefeLokalHinweis).not.toMatch(/Haiku/)
  })

  it('Lauf und Ticker: die Klartext-Fehler und Meldungen der lokalen Motor-Instanz', () => {
    const tl = texte.lauf
    expect(typeof tl.lokalNichtErlaubt).toBe('string')
    expect(typeof tl.lokalNichtErreichbar('http://x:11434')).toBe('string')
    expect(tl.lokalNichtErreichbar('http://x:11434')).toMatch(/http:\/\/x:11434/)
    expect(tl.lokalModellFehlt('qwen')).toMatch(/qwen/)
    expect(typeof tl.lokalModellFehler('kaputt')).toBe('string')
    const tt = texte.ticker
    expect(tt.lokalBereit('flowforge-qwen', 65536)).toMatch(/flowforge-qwen/)
    expect(tt.lokalSessionGestartet('flowforge-qwen', 65536)).toMatch(/flowforge-qwen/)
    expect(tt.lokalEigeneSession('Bauer', 'flowforge-qwen')).toMatch(/Bauer/)
    expect(typeof tt.warteGrundLokal('Bauer · A')).toBe('string')
  })

  it('Einstellungen: jedes Feld hat Label und Folgen-Hinweis, jede Vorlage einen Knopf-Namen', () => {
    const te = texte.einstellungen
    expect(te.lokalBlockUeberschrift).toBe('Lokale KI als Block-Agent')
    expect(typeof te.lokalBlockAgent).toBe('string')
    expect(te.lokalBlockAgentHinweis).toMatch(/nie still/)
    for (const feld of LOKAL_FEIN_FELDER) {
      expect(typeof te.lokalBlockFeinFelder[feld], feld).toBe('string')
      expect(typeof te.lokalBlockFeinHinweise[feld], feld).toBe('string')
    }
    for (const vorlage of Object.keys(LOKAL_FEIN_VORLAGEN))
      expect(typeof te.lokalBlockVorlageNamen[vorlage], vorlage).toBe('string')
    // Empfehlungen aus der Qwen3.8-Modellkarte stehen in den Hinweisen.
    expect(te.lokalBlockFeinHinweise.temperatur).toMatch(/1\.0/)
    expect(te.lokalBlockFeinHinweise.temperatur).toMatch(/0\.6/)
    expect(te.lokalBlockFeinHinweise.topP).toMatch(/0\.95/)
    expect(te.lokalBlockFeinHinweise.topK).toMatch(/20/)
    // Ehrliche Grenzen: Denken bleibt an, abgeleitetes Modell lädt nur beim Ändern neu.
    expect(te.lokalBlockDenkenHinweis).toMatch(/Denken bleibt an/)
    expect(te.lokalBlockFeinHinweis).toMatch(/flowforge-/)
    expect(te.lokalBlockFeinHinweis).toMatch(/nur neu/)
    expect(te.lokalBlockFeinHinweise.entwurfsTokens).toMatch(/Entwurfskopf/)
  })
})

describe('BAUPLAN 49 · Oberfläche (am Quelltext)', () => {
  it('Leinwand: Hinweis bei Klasse lokal, Denktiefe-Hinweis unterscheidet lokal von Haiku', () => {
    const leinwand = lesen('src/renderer/src/Leinwand.jsx')
    expect(leinwand).toMatch(/klasseIstLokal\(modellKlasse\) && \(/)
    expect(leinwand).toMatch(/tk\.modellLokalHinweis/)
    expect(leinwand).toMatch(/klasseIstLokal\(modellKlasse\) \? tk\.denktiefeLokalHinweis : tk\.denktiefeHaikuHinweis/)
    expect(leinwand).toMatch(/MODELL_KLASSEN\.map\(/)
  })

  it('Block-Editor: Hinweis bei Voreinstellung lokal, derselbe Satz wie an der Karte', () => {
    const editor = lesen('src/renderer/src/BlockEditor.jsx')
    expect(editor).toMatch(/klasseIstLokal\(werte\.modell\) && \(/)
    expect(editor).toMatch(/tkette\.modellLokalHinweis/)
    expect(editor).toMatch(/tkette\.denktiefeLokalHinweis/)
  })

  it('Einstellungen-Dialog: Häkchen nur mit Helfer-KI, Vorlagen-Knöpfe, sieben Felder, Speichern mit lokalFein', () => {
    const dialog = lesen('src/renderer/src/Einstellungen.jsx')
    expect(dialog).toMatch(/from '\.\.\/\.\.\/shared\/lokalRegeln\.js'/)
    expect(dialog).toMatch(/disabled=\{!lokaleHelferAktiv\}/)
    expect(dialog).toMatch(/checked=\{lokalBlockAgent\}/)
    expect(dialog).toMatch(/LOKAL_FEIN_FELDER\.map\(/)
    expect(dialog).toMatch(/lokalFeinVorlageErkennen\(/)
    expect(dialog).toMatch(/lokalesModellName\(/)
    for (const vorlage of Object.keys(LOKAL_FEIN_VORLAGEN)) expect(dialog).toContain(`'${vorlage}'`)
    // Speichern reicht beide Felder in den Hauptprozess.
    const speichern = dialog.slice(dialog.indexOf('async function speichern()'))
    expect(speichern).toMatch(/lokalBlockAgent,/)
    expect(speichern).toMatch(/lokalFein: lokalFeinBereinigt/)
    // Kein Denken-Schalter (gemessen: nicht steuerbar).
    expect(dialog).not.toMatch(/denken[A-Z]\w*Schalter|think/i)
  })

  it('Metriken zählen keine Klassen-Namen hart auf — lokal erscheint von selbst als eigene Zeile', () => {
    const metriken = lesen('src/renderer/src/Metriken.jsx')
    expect(metriken).not.toMatch(/'sehr-sparsam'|'sparsam'|'extra'|'standard'/)
  })
})
