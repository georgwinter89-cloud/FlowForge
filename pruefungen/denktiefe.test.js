// Prüfungen zu Zwischenschritt 0.48.1: Modellklasse „Extra (Fable 5)" und
// Denktiefe je Block — die Regeln im geteilten Bereich (blockKatalog,
// blockRegeln, metrikRegeln), die Bereinigung in workflow.js, die gemerkte
// Kosten-Antwort in einstellungen.js und die Einstufung des Motors
// (Fable-Fehler, Agenten-Definitionen je Denktiefe).
//
// Rot-vor-Grün: Vor dem Schritt gab es DENKTIEFEN, blockDenktiefe,
// blockAgentTyp, klasseKenntDenktiefe, extraKostenBestaetigen,
// extraNichtVerfuegbarFehler und blockAgentDefinitionen nicht; workflow.js und
// pruefeEigenenBlock kannten kein Feld denktiefe; der Metrik-Extrakt trug keine
// Denktiefe, und „out of usage credits" wäre im Motor ein erschöpftes Kontingent
// gewesen (Pause + Wiederholung statt Klartext am Block).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Eigener Datenordner für einstellungen.js (wie erststartWahl.test.js): Die
// übrigen Prüfdateien teilen sich den Stub-Ordner — hier darf nichts
// dazwischenfunken, denn gemessen wird genau, was in der Datei steht.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-denktiefe-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  Notification: Object.assign(function () {}, { isSupported: () => false }),
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const {
  BLOCK_AGENT_TYPEN,
  DENKTIEFEN,
  DENKTIEFE_STANDARD,
  MODELL_KLASSEN,
  blockAgentTyp,
  blockDefinition,
  blockDenktiefe,
  denktiefeGueltig,
  klasseHatKostenHinweis,
  klasseKenntDenktiefe,
  sdkModell,
  unterModellFuer
} = await import('../src/shared/blockKatalog.js')
const { pruefeEigenenBlock } = await import('../src/shared/blockRegeln.js')
const { blockModellAuswerten, laufExtraktAusBericht, wirksameDenktiefe } = await import(
  '../src/shared/metrikRegeln.js'
)
const { workflowLaden, workflowSpeichern } = await import('../src/main/workflow.js')
const { einstellungenLaden, einstellungenSpeichern, extraKostenBestaetigen } = await import(
  '../src/main/einstellungen.js'
)
const { blockAgentDefinitionen, extraNichtVerfuegbarFehler, fehlerAusErgebnis } = await import(
  '../src/main/motor/claudeCodeMotor.js'
)
const { texte } = await import('../src/shared/texte.js')

describe('0.48.1 · Denktiefe je Block (blockKatalog)', () => {
  it('kennt sechs Stufen, Modell-Standard vorneweg', () => {
    expect(DENKTIEFEN).toEqual(['standard', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(DENKTIEFE_STANDARD).toBe('standard')
  })

  it('lässt nur bekannte Stufen durch', () => {
    expect(denktiefeGueltig('xhigh')).toBe('xhigh')
    expect(denktiefeGueltig('standard')).toBe('standard')
    expect(denktiefeGueltig('ultra')).toBe(null)
    expect(denktiefeGueltig(undefined)).toBe(null)
    expect(denktiefeGueltig(3)).toBe(null)
  })

  it('Karte gewinnt, sonst Voreinstellung des Blocks, sonst Modell-Standard', () => {
    const def = blockDefinition('pruefer')
    expect(blockDenktiefe(def, { denktiefe: 'xhigh' })).toBe('xhigh')
    expect(blockDenktiefe({ ...def, denktiefe: 'low' }, {})).toBe('low')
    expect(blockDenktiefe({ ...def, denktiefe: 'low' }, { denktiefe: 'max' })).toBe('max')
    expect(blockDenktiefe(def, { denktiefe: 'unsinn' })).toBe('standard')
    expect(blockDenktiefe(def, {})).toBe('standard')
    expect(blockDenktiefe(null, null)).toBe('standard')
  })

  it('Katalog-Blöcke tragen keine Denktiefe — sie laufen auf Modell-Standard', () => {
    for (const id of ['bauer', 'pruefer', 'angreifer', 'integrator'])
      expect(blockDenktiefe(blockDefinition(id))).toBe('standard')
  })

  it('leitet den Agententyp ab: block für Standard und Unsinn, sonst block-<Stufe>', () => {
    expect(blockAgentTyp('standard')).toBe('block')
    expect(blockAgentTyp('quatsch')).toBe('block')
    expect(blockAgentTyp(undefined)).toBe('block')
    expect(blockAgentTyp('low')).toBe('block-low')
    expect(blockAgentTyp('max')).toBe('block-max')
    expect(BLOCK_AGENT_TYPEN).toEqual([
      'block',
      'block-low',
      'block-medium',
      'block-high',
      'block-xhigh',
      'block-max'
    ])
  })

  it('nur Haiku und lokal kennen keine Denktiefe', () => {
    expect(MODELL_KLASSEN.filter((k) => !klasseKenntDenktiefe(k))).toEqual(['sehr-sparsam', 'lokal'])
    expect(klasseKenntDenktiefe('extra')).toBe(true)
    expect(klasseKenntDenktiefe('standard')).toBe(true)
  })

  it('hat für jede Stufe Klartext in Auswahl und Kurzform', () => {
    for (const stufe of DENKTIEFEN) {
      expect(texte.kette.denktiefeNamen[stufe]).toBeTruthy()
      expect(texte.kette.denktiefeKurz[stufe]).toBeTruthy()
    }
  })
})

describe('0.48.1 · Klasse Extra (Fable 5)', () => {
  it('übersetzt auf den SDK-Alias fable und trägt als einzige den Kosten-Hinweis', () => {
    expect(sdkModell('extra')).toBe('fable')
    expect(klasseHatKostenHinweis('extra')).toBe(true)
    expect(klasseHatKostenHinweis('standard')).toBe(false)
  })

  it('verteuert Unteraufgaben nicht: Extra-Block → Zuarbeit auf Sonnet, „wie Block" → Fable', () => {
    const bauer = blockDefinition('bauer')
    expect(unterModellFuer(bauer, 'extra', 'sparsam')).toBe('sonnet')
    expect(unterModellFuer(bauer, 'extra', 'wieBlock')).toBe('fable')
  })
})

describe('0.48.1 · Eigene Blöcke tragen eine Denktiefe', () => {
  const grund = { name: 'Rechtschreibprüfer', auftrag: 'Du liest Texte gegen.' }

  it('übernimmt eine gültige Stufe', () => {
    expect(pruefeEigenenBlock({ ...grund, denktiefe: 'medium' }).block.denktiefe).toBe('medium')
  })

  it('Altbestand ohne Feld und Unsinn landen auf Modell-Standard', () => {
    expect(pruefeEigenenBlock(grund).block.denktiefe).toBe('standard')
    expect(pruefeEigenenBlock({ ...grund, denktiefe: 'turbo' }).block.denktiefe).toBe('standard')
    expect(pruefeEigenenBlock({ ...grund, denktiefe: 7 }).block.denktiefe).toBe('standard')
  })
})

describe('0.48.1 · workflow.js säubert modell und denktiefe je Karte', () => {
  const projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-denktiefe-projekt-'))

  it('speichert gültige Werte und fällt bei Unsinn zurück', () => {
    const roh = {
      bloecke: [
        { instanzId: 'a', blockId: 'bauer', modell: 'extra', denktiefe: 'xhigh', position: { x: 0, y: 0 } },
        { instanzId: 'b', blockId: 'pruefer', modell: 'unsinn', denktiefe: 'unsinn', position: { x: 0, y: 0 } },
        { instanzId: 'c', blockId: 'angreifer', position: { x: 0, y: 0 } }
      ],
      pfeile: []
    }
    const gespeichert = workflowSpeichern(projekt, roh)
    expect(gespeichert.ok).toBe(true)
    const geladen = workflowLaden(projekt).workflow
    const karte = (id) => geladen.bloecke.find((b) => b.instanzId === id)
    expect(karte('a').modell).toBe('extra')
    expect(karte('a').denktiefe).toBe('xhigh')
    expect(karte('b').modell).toBe('standard')
    expect(karte('b').denktiefe).toBe('standard')
    expect(karte('c').denktiefe).toBe('standard')
    // Und in der Datei steht es genauso — kein undefined, das JSON verschluckt.
    const datei = JSON.parse(fs.readFileSync(path.join(projekt, 'workflow.json'), 'utf8'))
    for (const b of datei.bloecke) expect(DENKTIEFEN).toContain(b.denktiefe)
  })
})

describe('0.48.1 · Metrik-Extrakt kennt die wirksame Denktiefe', () => {
  const bericht = (blockErgebnisse) => ({
    id: 'l1',
    gestartetAm: '2026-08-19T10:00:00.000Z',
    workflow: 'Test',
    zustand: 'fertig',
    blockErgebnisse
  })
  const eintrag = (extra) => ({
    block: 'Prüfer',
    instanzId: 'p1',
    zustand: 'erfolgreich',
    tokens: 100,
    modelle: [{ modell: 'claude-opus-5', tokens: 100, anteil: 1 }],
    ...extra
  })

  it('gemessen schlägt gewählt; Standard ohne Messung ist leer', () => {
    expect(wirksameDenktiefe({ klasse: 'standard', denktiefe: 'low', denktiefeGemessen: 'high' })).toBe('high')
    expect(wirksameDenktiefe({ klasse: 'standard', denktiefe: 'xhigh', denktiefeGemessen: null })).toBe('xhigh')
    expect(wirksameDenktiefe({ klasse: 'standard', denktiefe: 'standard', denktiefeGemessen: null })).toBe('')
    expect(wirksameDenktiefe({})).toBe('')
  })

  it('Haiku-Fall (K11): eine ignorierte Wahl zählt nicht als Denktiefe — außer die CLI meldet eine', () => {
    expect(wirksameDenktiefe({ klasse: 'sehr-sparsam', denktiefe: 'xhigh', denktiefeGemessen: null })).toBe('')
    expect(wirksameDenktiefe({ klasse: 'sehr-sparsam', denktiefe: 'xhigh', denktiefeGemessen: 'xhigh' })).toBe('xhigh')
  })

  it('der Extrakt trägt je Block die Denktiefe; alte Berichte ohne Felder ergeben leer', () => {
    const extrakt = laufExtraktAusBericht(
      bericht([
        eintrag({ klasse: 'standard', denktiefe: 'xhigh', denktiefeGemessen: 'xhigh' }),
        eintrag({ klasse: 'sehr-sparsam', denktiefe: 'xhigh', denktiefeGemessen: null }),
        eintrag({})
      ]),
      'D:\\p'
    )
    expect(extrakt.bloecke.map((b) => b.denktiefe)).toEqual(['xhigh', '', ''])
  })

  it('Blocktyp × Modell teilt die Zeilen nach Denktiefe und sortiert sie zuletzt danach', () => {
    const extrakt = laufExtraktAusBericht(
      bericht([
        eintrag({ klasse: 'standard', denktiefe: 'xhigh', denktiefeGemessen: 'xhigh' }),
        eintrag({ klasse: 'standard', denktiefe: 'xhigh', denktiefeGemessen: 'xhigh', instanzId: 'p2' }),
        eintrag({ klasse: 'standard', denktiefe: 'standard', denktiefeGemessen: null, instanzId: 'p3' }),
        eintrag({ klasse: 'standard', denktiefe: 'standard', denktiefeGemessen: null, instanzId: 'p4' })
      ]),
      'D:\\p'
    )
    const zeilen = blockModellAuswerten([extrakt])
    expect(zeilen).toHaveLength(2)
    expect(zeilen.map((z) => [z.block, z.modell, z.denktiefe, z.erstlauf.anzahl])).toEqual([
      ['Prüfer', 'claude-opus-5', '', 2],
      ['Prüfer', 'claude-opus-5', 'xhigh', 2]
    ])
  })
})

describe('0.48.1 · Gemerkte Kosten-Antwort (einstellungen.js, K3)', () => {
  beforeEach(() => {
    fs.rmSync(path.join(datenOrdner, 'einstellungen.json'), { force: true })
  })

  it('steht ohne Datei auf false', () => {
    expect(einstellungenLaden().einstellungen.extraKostenBestaetigt).toBe(false)
  })

  it('extraKostenBestaetigen setzt true und schreibt die Datei', () => {
    einstellungenSpeichern({ motorModus: 'abo', apiSchluessel: '', ausgabenObergrenzeUsd: 5 })
    expect(extraKostenBestaetigen()).toEqual({ ok: true })
    expect(einstellungenLaden().einstellungen.extraKostenBestaetigt).toBe(true)
    const datei = JSON.parse(fs.readFileSync(path.join(datenOrdner, 'einstellungen.json'), 'utf8'))
    expect(datei.extraKostenBestaetigt).toBe(true)
    expect(datei.motorModus).toBe('abo')
  })

  it('Dialog-Speichern ohne Feld UND mit Feld false vergisst die Antwort nicht', () => {
    einstellungenSpeichern({ motorModus: 'abo', apiSchluessel: '', ausgabenObergrenzeUsd: 5 })
    extraKostenBestaetigen()
    const ohne = einstellungenSpeichern({ motorModus: 'abo', apiSchluessel: '', ausgabenObergrenzeUsd: 5 })
    expect(ohne.einstellungen.extraKostenBestaetigt).toBe(true)
    expect(einstellungenLaden().einstellungen.extraKostenBestaetigt).toBe(true)
    // Der Erststart schickt den kompletten geladenen Satz — notfalls mit false.
    const mitFalse = einstellungenSpeichern({
      ...einstellungenLaden().einstellungen,
      extraKostenBestaetigt: false,
      motorModus: 'abo'
    })
    expect(mitFalse.einstellungen.extraKostenBestaetigt).toBe(true)
    expect(einstellungenLaden().einstellungen.extraKostenBestaetigt).toBe(true)
  })

  it('ein Dialog kann die Antwort auch nicht still auf true setzen', () => {
    const gespeichert = einstellungenSpeichern({
      motorModus: 'abo',
      apiSchluessel: '',
      ausgabenObergrenzeUsd: 5,
      extraKostenBestaetigt: true
    })
    expect(gespeichert.einstellungen.extraKostenBestaetigt).toBe(false)
    expect(einstellungenLaden().einstellungen.extraKostenBestaetigt).toBe(false)
  })
})

describe('0.48.1 · Motor: Fable nicht verfügbar und Agenten je Denktiefe', () => {
  it('stuft die Fable-Fehlertexte der CLI als extra-nicht-verfuegbar ein', () => {
    for (const text of [
      'Fable 5 requires usage credits',
      "You're out of usage credits",
      "Your seat type doesn't include usage credits"
    ]) {
      expect(extraNichtVerfuegbarFehler(text)).toEqual({
        fehlertext: texte.lauf.extraNichtVerfuegbar,
        fehlerArt: 'extra-nicht-verfuegbar'
      })
      expect(fehlerAusErgebnis({ is_error: true, result: text }, '').fehlerArt).toBe(
        'extra-nicht-verfuegbar'
      )
    }
  })

  it('„rate limit" oder „usage limit" im Agent-Text bleiben NICHT hängen — nur Fable-Texte zählen', () => {
    expect(extraNichtVerfuegbarFehler('Ich habe das rate limit der API gelesen.')).toBe(null)
    expect(extraNichtVerfuegbarFehler('usage limit reached')).toBe(null)
    expect(extraNichtVerfuegbarFehler(null)).toBe(null)
    expect(extraNichtVerfuegbarFehler('')).toBe(null)
  })

  it('die Kontingent-Einstufung des Motors bleibt für echte Kontingent-Texte erhalten', () => {
    expect(fehlerAusErgebnis({ is_error: true, result: 'usage limit reached' }, '').fehlerArt).toBe(
      'kontingent'
    )
    expect(fehlerAusErgebnis({ is_error: true, result: 'out of extra usage' }, '').fehlerArt).toBe(
      'kontingent'
    )
  })

  it('definiert einen Block-Agenten je Denktiefe — effort nur, wo eine Stufe gewählt ist', () => {
    const agenten = blockAgentDefinitionen('SYSTEMTEXT')
    expect(Object.keys(agenten).sort()).toEqual([...BLOCK_AGENT_TYPEN].sort())
    expect(agenten.block.effort).toBeUndefined()
    expect(agenten['block-low'].effort).toBe('low')
    expect(agenten['block-xhigh'].effort).toBe('xhigh')
    expect(agenten['block-max'].effort).toBe('max')
    for (const typ of BLOCK_AGENT_TYPEN) {
      expect(agenten[typ].prompt).toBe('SYSTEMTEXT')
      expect(agenten[typ].model).toBe('opus')
      expect(agenten[typ].maxTurns).toBe(300)
    }
  })

  it('der Motor-Hook wählt den Agententyp nach der Karte, nicht fest „block"', () => {
    const quelle = fs.readFileSync('src/main/motor/claudeCodeMotor.js', 'utf8')
    expect(quelle).toMatch(/subagent_type: block\.agentTyp/)
    expect(quelle).not.toMatch(/subagent_type: 'block'/)
    // Haiku bekommt nie eine effort-Definition (K5).
    expect(quelle).toMatch(/klasseKenntDenktiefe\(klasse\) \? blockAgentTyp\(denktiefe\)/)
  })

  it('der Lauf fragt vor dem ersten Extra-Lauf im Abo-Modus einmal nach (lauf.js)', () => {
    const quelle = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(quelle).toMatch(/rueckfrage: 'extra-kosten'/)
    expect(quelle).toMatch(/!einstellungen\.extraKostenBestaetigt/)
    expect(quelle).toMatch(/denktiefeGemessen: ergebnis\.blockDenktiefeGemessen \?\? null/)
  })
})
