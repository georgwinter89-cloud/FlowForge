// Prüfungen zur Oberfläche von 0.48.1 (Klasse Extra, Denktiefe je Block):
// Die Renderer-Dateien lassen sich hier nicht rendern, aber ihre Regeln sind
// greifbar — die Stellen, an denen die Angriffsliste (K1, K2, K8–K10) einen
// Bruch sah, werden als Text festgenagelt, damit eine spätere Umstellung sie
// nicht still verliert. Dazu: Die Oberfläche benutzt nur Texte und Schlüssel,
// die es wirklich gibt (kein „undefined" im Select, keine Option ohne Namen).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { texte } from '../src/shared/texte.js'
import {
  MODELL_KLASSEN,
  DENKTIEFEN,
  DENKTIEFE_STANDARD,
  klasseHatKostenHinweis,
  klasseKenntDenktiefe
} from '../src/shared/blockKatalog.js'

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')

describe('0.48.1 · Texte und Schlüssel, auf die die Oberfläche baut', () => {
  it('jede Modellklasse hat einen Anzeigenamen — auch „extra"', () => {
    for (const klasse of MODELL_KLASSEN) {
      expect(typeof texte.kette.modellNamen[klasse]).toBe('string')
    }
    expect(texte.kette.modellNamen.extra).toMatch(/Fable 5/)
    expect(klasseHatKostenHinweis('extra')).toBe(true)
    expect(klasseHatKostenHinweis('standard')).toBe(false)
  })

  it('jede Denktiefe hat einen langen (Select) und einen kurzen (Bericht) Namen', () => {
    for (const stufe of DENKTIEFEN) {
      expect(typeof texte.kette.denktiefeNamen[stufe]).toBe('string')
      expect(typeof texte.kette.denktiefeKurz[stufe]).toBe('string')
    }
    expect(DENKTIEFE_STANDARD).toBe('standard')
    expect(klasseKenntDenktiefe('sehr-sparsam')).toBe(false)
    expect(klasseKenntDenktiefe('extra')).toBe(true)
  })

  it('die Bericht-Zeile nennt Klasse, Denktiefe und gemessene Stufe — ohne Lücken', () => {
    const zeile = texte.laufberichte.klasseZeile
    expect(zeile('Extra (Fable 5)', 'xhigh', 'xhigh')).toBe(
      'Klasse: Extra (Fable 5) · Denktiefe: xhigh (wirksam: xhigh)'
    )
    expect(zeile('Standard (Opus)', 'Modell-Standard', null)).toBe(
      'Klasse: Standard (Opus) · Denktiefe: Modell-Standard'
    )
    expect(zeile('Standard (Opus)', '', null)).toBe('Klasse: Standard (Opus)')
  })
})

describe('0.48.1 · Leinwand: Blockkarte, Bericht und Kosten-Rückfrage', () => {
  const leinwand = lesen('src/renderer/src/Leinwand.jsx')

  it('die Blockkarte bietet alle Klassen und alle Denktiefen an und speichert die Denktiefe je Karte', () => {
    expect(leinwand).toMatch(/MODELL_KLASSEN\.map\(/)
    expect(leinwand).toMatch(/DENKTIEFEN\.map\(/)
    expect(leinwand).toMatch(/tk\.denktiefeNamen\[/)
    expect(leinwand).toMatch(/function denktiefeSetzen\(/)
    expect(leinwand).toMatch(/\{ \.\.\.b, denktiefe \}/)
    expect(leinwand).toMatch(/onDenktiefe=\{/)
  })

  it('Kosten-Hinweis bei Extra und Haiku-Hinweis bei Denktiefe ≠ Standard stehen an der Karte', () => {
    expect(leinwand).toMatch(/klasseHatKostenHinweis\(modellKlasse\) && \(/)
    expect(leinwand).toMatch(/tk\.modellExtraHinweis/)
    expect(leinwand).toMatch(
      /!klasseKenntDenktiefe\(modellKlasse\) && denktiefe !== DENKTIEFE_STANDARD && \(/
    )
    expect(leinwand).toMatch(/tk\.denktiefeHaikuHinweis/)
  })

  it('Bericht: Klassen-Zeile nur bei vorhandener Klasse, mit Rückfall auf den Schlüssel (K8/K9)', () => {
    expect(leinwand).toMatch(/typeof eintrag\.klasse === 'string' && \(/)
    expect(leinwand).toMatch(/tk\.modellNamen\[eintrag\.klasse\] \?\? eintrag\.klasse/)
    expect(leinwand).toMatch(/tk\.denktiefeKurz\[eintrag\.denktiefe\]/)
    expect(leinwand).toMatch(/eintrag\.denktiefeGemessen/)
  })

  it('starten(): die Kosten-Rückfrage kommt VOR dem Fehler-Return und merkt sich „Trotzdem starten" (K10)', () => {
    const start = leinwand.indexOf('async function starten()')
    expect(start).toBeGreaterThan(-1)
    const rumpf = leinwand.slice(start, leinwand.indexOf('async function warteschlangeVerlassen'))
    const rueckfrage = rumpf.indexOf("antwort.rueckfrage === 'extra-kosten'")
    const fehlerReturn = rumpf.indexOf('if (!antwort.ok) return setFehler(antwort.fehler)')
    expect(rueckfrage).toBeGreaterThan(-1)
    expect(fehlerReturn).toBeGreaterThan(rueckfrage)
    expect(rumpf).toMatch(/knopf: t\.extraRueckfrageKnopf/)
    expect(rumpf).toMatch(/await window\.flowforge\.extraKostenBestaetigen\(\)/)
    // Nach dem Bestätigen startet FlowForge von selbst neu — Georg klickt nicht zweimal.
    expect(rumpf).toMatch(/extraKostenBestaetigen\(\)\s*\n\s*starten\(\)/)
  })
})

describe('0.48.1 · Block-Editor und Metriken', () => {
  it('der Editor hat ein Denktiefe-Feld, speichert es mit und schützt den KI-Vorschlag (K2)', () => {
    const editor = lesen('src/renderer/src/BlockEditor.jsx')
    expect(editor).toMatch(/denktiefe: blockDenktiefe\(block\)/)
    expect(editor).toMatch(/DENKTIEFEN\.map\(/)
    expect(editor).toMatch(/tkette\.denktiefeNamen\[/)
    expect(editor).toMatch(/setzen\('denktiefe'/)
    expect(editor).toMatch(/klasseHatKostenHinweis\(werte\.modell\) && \(/)
    expect(editor).toMatch(/t\.modellExtraHinweis/)
    // K2: Rückfall VOR dem Vorschlag — sonst kippt das Select auf „ungesteuert".
    const vorschlagStelle = editor.indexOf('...vorschlag,')
    const modellRueckfall = editor.indexOf('modell: MODELL_KLASSE_STANDARD,')
    const denktiefeRueckfall = editor.indexOf('denktiefe: DENKTIEFE_STANDARD,')
    expect(modellRueckfall).toBeGreaterThan(-1)
    expect(denktiefeRueckfall).toBeGreaterThan(-1)
    expect(modellRueckfall).toBeLessThan(vorschlagStelle)
    expect(denktiefeRueckfall).toBeLessThan(vorschlagStelle)
  })

  it('Blocktyp × Modell trägt eine Denktiefe-Spalte, und der Zeilen-Schlüssel enthält sie (K1)', () => {
    const metriken = lesen('src/renderer/src/Metriken.jsx')
    expect(metriken).toMatch(/t\.spalteDenktiefe/)
    expect(metriken).toMatch(/z\.denktiefe \|\| t\.denktiefeOhne/)
    expect(metriken).toMatch(/key=\{`\$\{z\.block\} \$\{z\.modell\} \$\{z\.denktiefe \?\? ''\}`\}/)
  })
})
