// Prüfungen zu „Modellklasse je Block" (BAUPLAN 37): Welche Klasse gilt für
// eine Blockkarte, was wird daraus fürs SDK, und welches Modell bekommen die
// Unteraufgaben eines Block-Agenten.
//
// Rot-vor-Grün: Alle Fälle hier schlugen vor dem Bauschritt fehl —
// blockModellKlasse, sdkModell, unterModellFuer und MODELL_KLASSEN gab es
// nicht, pruefeEigenenBlock kannte kein Modell-Feld. Die Fälle „schon
// sparsamer Block" und „Audit" prüfen die zwei Stellen, an denen eine naive
// Regel teurer bzw. flacher liefe als gewollt: Zuarbeit darf nie teurer
// werden als ihr Block, und die drei Audit-Blickwinkel sind der Kern des
// Blocks, keine Zuarbeit.
import { describe, it, expect } from 'vitest'
import {
  BLOCK_KATALOG,
  MODELL_KLASSEN,
  MODELL_KLASSE_STANDARD,
  KOORDINATOR_MODELL,
  blockDefinition,
  blockModellKlasse,
  modellKlasseGueltig,
  sdkModell,
  unterModellFuer
} from '../src/shared/blockKatalog.js'
import { pruefeEigenenBlock } from '../src/shared/blockRegeln.js'
import { texte } from '../src/shared/texte.js'

describe('Welche Modellklasse gilt für eine Blockkarte', () => {
  it('nimmt die Wahl an der Karte, wenn eine da ist', () => {
    const def = blockDefinition('bauer')
    expect(blockModellKlasse(def, { modell: 'sparsam' })).toBe('sparsam')
  })

  it('nimmt ohne Wahl die Voreinstellung des Blocks', () => {
    expect(blockModellKlasse(blockDefinition('sessionende'), {})).toBe('sparsam')
    expect(blockModellKlasse(blockDefinition('bauer'), {})).toBe('standard')
  })

  it('fällt bei unbekanntem Wert auf die Voreinstellung zurück — nie stumm auf billig', () => {
    const def = blockDefinition('bauer')
    expect(blockModellKlasse(def, { modell: 'gratis' })).toBe('standard')
    expect(blockModellKlasse(def, { modell: null })).toBe('standard')
  })

  it('kennt ohne Block und ohne Wahl trotzdem eine Klasse', () => {
    expect(blockModellKlasse(null, null)).toBe(MODELL_KLASSE_STANDARD)
  })

  it('lässt nur die drei bekannten Klassen durch', () => {
    expect(modellKlasseGueltig('sehr-sparsam')).toBe('sehr-sparsam')
    expect(modellKlasseGueltig('opus')).toBe(null)
  })
})

describe('Übersetzung in die Modelle des Motors', () => {
  it('gibt je Klasse einen SDK-Alias', () => {
    expect(sdkModell('standard')).toBe('opus')
    expect(sdkModell('sparsam')).toBe('sonnet')
    expect(sdkModell('sehr-sparsam')).toBe('haiku')
  })

  it('gibt bei Unsinn das Standard-Modell statt undefined', () => {
    // Ein undefined würde beim Agent-Aufruf zum Erben des Koordinator-
    // Modells führen — genau der stille Fehler, den Schritt 37 vermeidet.
    expect(sdkModell('gibtsnicht')).toBe('opus')
    expect(sdkModell(undefined)).toBe('opus')
  })

  it('lässt den Koordinator auf dem kleinsten Modell laufen', () => {
    expect(KOORDINATOR_MODELL).toBe('haiku')
  })
})

describe('Modell der Unteraufgaben', () => {
  const bauer = blockDefinition('bauer')

  it('stuft Zuarbeit eines Standard-Blocks auf sparsam herab', () => {
    expect(unterModellFuer(bauer, 'standard', 'sparsam')).toBe('sonnet')
  })

  it('lässt Zuarbeit bei „wie Block" auf der Klasse des Blocks', () => {
    expect(unterModellFuer(bauer, 'standard', 'wieBlock')).toBe('opus')
  })

  it('macht einen schon sparsameren Block nicht teurer', () => {
    expect(unterModellFuer(bauer, 'sehr-sparsam', 'sparsam')).toBe('haiku')
    expect(unterModellFuer(bauer, 'sparsam', 'sparsam')).toBe('sonnet')
  })

  it('lässt die Audit-Blickwinkel immer der Klasse ihres Blocks folgen', () => {
    const audit = blockDefinition('audit')
    expect(audit.unteraufgabenWieBlock).toBe(true)
    expect(unterModellFuer(audit, 'standard', 'sparsam')).toBe('opus')
    expect(unterModellFuer(audit, 'sehr-sparsam', 'sparsam')).toBe('haiku')
  })

  it('liefert immer ein konkretes Modell, nie „erben"', () => {
    for (const klasse of MODELL_KLASSEN)
      for (const einstellung of ['sparsam', 'wieBlock'])
        expect(typeof unterModellFuer(bauer, klasse, einstellung)).toBe('string')
  })
})

describe('Voreinstellungen im Katalog', () => {
  it('gibt jedem Arbeitsblock eine gültige Klasse', () => {
    for (const def of BLOCK_KATALOG.filter((b) => !b.uebung))
      expect(MODELL_KLASSEN).toContain(blockModellKlasse(def))
  })

  it('lässt Bauen und Prüfen auf dem großen Modell, Nebenrollen sparsam', () => {
    for (const id of ['bauer', 'pruefer', 'gesamtpruefung', 'diagnose', 'paket-schneiden', 'angreifer', 'audit'])
      expect(blockModellKlasse(blockDefinition(id))).toBe('standard')
    for (const id of ['sessionende', 'frage-mensch', 'karten-pruefer', 'kontext-laden'])
      expect(blockModellKlasse(blockDefinition(id))).toBe('sparsam')
  })

  it('hat für jede Klasse einen Klartext-Namen für Ticker und Auswahl', () => {
    for (const klasse of MODELL_KLASSEN)
      expect(texte.kette.modellNamen[klasse]).toBeTruthy()
  })
})

describe('Eigene Blöcke wählen ihre Klasse mit', () => {
  const grund = { name: 'Rechtschreibprüfer', auftrag: 'Du liest Texte gegen.' }

  it('übernimmt eine gültige Klasse', () => {
    expect(pruefeEigenenBlock({ ...grund, modell: 'sehr-sparsam' }).block.modell).toBe(
      'sehr-sparsam'
    )
  })

  it('gibt Altbestand ohne Feld die Standard-Klasse', () => {
    expect(pruefeEigenenBlock(grund).block.modell).toBe('standard')
  })

  it('weist Unsinn auf Standard zurück', () => {
    expect(pruefeEigenenBlock({ ...grund, modell: 'billig' }).block.modell).toBe('standard')
  })
})
