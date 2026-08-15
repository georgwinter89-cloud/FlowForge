// Prüfungen zur Kategorie eigener Blöcke (BAUPLAN 30): das Feld `bereich`
// wird normalisiert (trim, Mehrfach-Leerzeichen, Anzeigename → Schlüssel),
// Altbestand ohne Feld landet unter „eigene", die Längengrenze greift — und
// jeder Katalog-Arbeitsblock sitzt fest in einem der vier Bereiche.
import { describe, it, expect } from 'vitest'
import { pruefeBereich, pruefeEigenenBlock, BEREICH_MAX } from '../src/shared/blockRegeln.js'
import {
  BLOCK_KATALOG,
  BEREICHE,
  BEREICH_EIGENE,
  blockBereich,
  eigeneBloeckeSetzen,
  freieBereiche
} from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const rohBlock = { name: 'Test', auftrag: 'Tu was.', braucht: [], liefert: [] }

describe('Bereich eigener Blöcke', () => {
  it('leer oder fehlend wird „eigene"', () => {
    expect(pruefeBereich('').bereich).toBe(BEREICH_EIGENE)
    expect(pruefeBereich(undefined).bereich).toBe(BEREICH_EIGENE)
    expect(pruefeEigenenBlock(rohBlock).block.bereich).toBe(BEREICH_EIGENE)
  })
  it('trimmt und zieht Mehrfach-Leerzeichen zusammen', () => {
    expect(pruefeBereich('  Meine   Helfer  ').bereich).toBe('Meine Helfer')
  })
  it('macht aus dem Anzeigenamen einer festen Klappe den Schlüssel', () => {
    expect(pruefeBereich('Prüfen').bereich).toBe('pruefen')
    expect(pruefeBereich('auftrag finden').bereich).toBe('auftrag')
    expect(pruefeBereich('Eigene').bereich).toBe(BEREICH_EIGENE)
    expect(pruefeBereich('bauen').bereich).toBe('bauen')
  })
  it('weist zu lange Namen mit klarer Meldung ab', () => {
    const urteil = pruefeBereich('x'.repeat(BEREICH_MAX + 1))
    expect(urteil.fehler).toBe(texte.blockRegeln.bereichZuLang(BEREICH_MAX))
  })
  it('freieBereiche liefert nur freie Namen, alphabetisch und ohne Doppelte', () => {
    eigeneBloeckeSetzen([
      { id: 'eigen-1', bereich: 'Zebra', braucht: [], liefert: [] },
      { id: 'eigen-2', bereich: 'pruefen', braucht: [], liefert: [] },
      { id: 'eigen-3', bereich: 'Anker', braucht: [], liefert: [] },
      { id: 'eigen-4', bereich: 'Zebra', braucht: [], liefert: [] },
      { id: 'eigen-5', braucht: [], liefert: [] }
    ])
    expect(freieBereiche()).toEqual(['Anker', 'Zebra'])
    eigeneBloeckeSetzen([])
  })
})

describe('Bereiche der Katalog-Blöcke', () => {
  it('jeder Arbeitsblock trägt einen der vier Bereiche, Übungs-Blöcke keinen', () => {
    for (const block of BLOCK_KATALOG) {
      if (block.uebung) expect(blockBereich(block)).toBeNull()
      else expect(BEREICHE).toContain(blockBereich(block))
    }
  })
  it('jeder Bereich hat einen Anzeigenamen', () => {
    for (const bereich of [...BEREICHE, BEREICH_EIGENE, 'uebung'])
      expect(typeof texte.projektansicht.bereiche[bereich]).toBe('string')
  })
})
