// Prüfbeleg-Weiterreichung durch Logik (Zwischenschritt 0.46.2, Entscheidung
// Georg 18.08.2026).
//
// Befund aus dem Life-OS-Lauf: Der Prüfbeleg des ersten Prüfers „kam bei
// niemandem an", obwohl ein Zweitaudit dahinter stand — der Katalog-Prüfer nahm
// kein Prüfbeleg-Etikett, und am Sessionende schluckte die Distanz-Regel den
// ersten Beleg still zugunsten des näheren Zweitaudits.
//
// Rot-vor-Grün: Vor 0.46.2 hatte der Prüfer kein brauchtOptional „Prüfbeleg"
// (das Zweitaudit bekam nichts, brauchtHerkunft kannte das Etikett am Zweitaudit
// gar nicht, der Vorspann des ersten Prüfers nannte keinen Empfänger), und
// uebergabenAuswahl kannte nur die Distanz: Lag der erste Prüfer direkt UND über
// das Zweitaudit vor dem Sessionende (gleich nah), kamen BEIDE Belege an; die
// Felder `grund` und `verdraengtVon` gab es nicht. Genau diese Fälle unten
// schlugen fehl.
import { describe, it, expect } from 'vitest'
import {
  uebergabenAuswahl,
  brauchtHerkunft,
  empfaengerLage,
  vorspannText
} from '../src/shared/kettenRegeln.js'
import { blockDefinition, BLOCK_KATALOG } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const v = texte.agentenVorspann
const bezeichnung = (nummer, name) => texte.ticker.blockBezeichnung(nummer, name)
const PRUEFER = blockDefinition('pruefer')
const SESSIONENDE = blockDefinition('sessionende')
const PRUEFER_BEDARF = [...PRUEFER.braucht, ...(PRUEFER.brauchtOptional ?? [])]

// Eine Lieferung, wie lauf.js und die kettenRegeln sie seit 0.46.2 bauen —
// mit Herkunft (instanzId, braucht des Lieferanten, vorfahrenIds).
function lieferung(instanzId, nummer, naehe, liefert, herkunft = {}) {
  return { instanzId, name: instanzId, nummer, naehe, liefert, text: `Fazit ${nummer}`, ...herkunft }
}
function block(instanzId, blockId, zusatz = '') {
  return { instanzId, blockId, zusatz, feldWerte: {}, zurueckZu: null }
}
const pfeil = (von, nach) => ({ von, nach })

describe('0.46.2 · Katalog-Prüfer nimmt einen Prüfbeleg optional an', () => {
  it('hat brauchtOptional „Prüfbeleg" mit einem wozu-Satz nach den Regeln', () => {
    expect(PRUEFER.brauchtOptional).toContain('Prüfbeleg')
    const satz = PRUEFER.brauchtWozu['Prüfbeleg']
    expect(typeof satz).toBe('string')
    expect(satz.length).toBeLessThanOrEqual(200)
    expect(satz[0]).toBe(satz[0].toLowerCase())
    expect(satz.trim().endsWith('.')).toBe(false)
  })

  it('nur der Prüfer — die Gesamtprüfung bleibt ohne den optionalen Bedarf', () => {
    const gesamt = BLOCK_KATALOG.find((b) => b.id === 'gesamtpruefung')
    expect(gesamt.brauchtOptional ?? []).not.toContain('Prüfbeleg')
  })
})

describe('0.46.2 · uebergabenAuswahl — Verdrängung durch Weiterverarbeitung', () => {
  const zweitaudit = (naehe) =>
    lieferung('z', 9, naehe, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b', 'p'] })
  const erster = (naehe) =>
    lieferung('p', 7, naehe, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b'] })

  it('Prüfer → Zweitaudit → Sessionende: das Sessionende bekommt nur den Beleg des Zweitaudits', () => {
    const { gruppen } = uebergabenAuswahl(SESSIONENDE, [erster(2), zweitaudit(1)])
    const treffer = gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(treffer.angekommen.map((l) => l.instanzId)).toEqual(['z'])
    expect(treffer.verdraengt).toHaveLength(1)
    expect(treffer.verdraengt[0].instanzId).toBe('p')
    expect(treffer.verdraengt[0].grund).toBe('weiterverarbeitung')
    expect(treffer.verdraengt[0].verdraengtVon).toEqual(['z'])
  })

  it('gilt unabhängig von der Distanz: auch direkt UND über das Zweitaudit zählt nur das Zweitaudit', () => {
    // Der Rot-Fall: gleich nah lieferte die Distanz-Regel bisher beide.
    const { gruppen } = uebergabenAuswahl(SESSIONENDE, [erster(1), zweitaudit(1)])
    const treffer = gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(treffer.angekommen.map((l) => l.instanzId)).toEqual(['z'])
    expect(treffer.verdraengt.map((l) => [l.instanzId, l.grund])).toEqual([['p', 'weiterverarbeitung']])
  })

  it('Life-OS: zwei Prüfer, Zweitaudit hinter beiden — es bekommt beide, das Sessionende nur das Zweitaudit', () => {
    const p1 = lieferung('p1', 4, 2, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b1'] })
    const p2 = lieferung('p2', 5, 2, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b2'] })
    const z = lieferung('z', 6, 1, ['Prüfbeleg'], {
      braucht: PRUEFER_BEDARF,
      vorfahrenIds: ['b1', 'b2', 'p1', 'p2']
    })
    // Am Zweitaudit: beide Prüfer gleich nah, keiner hat den anderen als Vorfahr.
    const beimZweitaudit = uebergabenAuswahl(PRUEFER, [
      lieferung('p1', 4, 1, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b1'] }),
      lieferung('p2', 5, 1, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b2'] })
    ]).gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(beimZweitaudit.angekommen.map((l) => l.instanzId)).toEqual(['p1', 'p2'])
    expect(beimZweitaudit.verdraengt).toEqual([])
    // Am Sessionende: nur das Zweitaudit; beide ersten Belege sind in ihm eingegangen.
    const beimEnde = uebergabenAuswahl(SESSIONENDE, [p1, p2, z]).gruppen.find(
      (g) => g.etikett === 'Prüfbeleg'
    )
    expect(beimEnde.angekommen.map((l) => l.instanzId)).toEqual(['z'])
    expect(beimEnde.verdraengt.map((l) => [l.instanzId, l.grund, l.verdraengtVon])).toEqual([
      ['p1', 'weiterverarbeitung', ['z']],
      ['p2', 'weiterverarbeitung', ['z']]
    ])
  })

  it('verdrängt nur, wenn der Nachfahre das Etikett auch braucht — sonst gilt die Distanz', () => {
    // Ein Nachfahre, der Prüfbelege liefert, aber keinen nimmt (etwa ein
    // selbstgebauter Block): Er hat den ersten Beleg nicht verarbeitet.
    const fremd = lieferung('f', 9, 1, ['Prüfbeleg'], { braucht: [], vorfahrenIds: ['b', 'p'] })
    const { gruppen } = uebergabenAuswahl(SESSIONENDE, [erster(1), fremd])
    const treffer = gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(treffer.angekommen.map((l) => l.instanzId)).toEqual(['p', 'f'])
    expect(treffer.verdraengt).toEqual([])
  })

  it('Laufzeit-Grenze: nur wer geliefert hat, verdrängt — ohne Zweitaudit-Lieferung kommt der erste Beleg an', () => {
    const { gruppen } = uebergabenAuswahl(SESSIONENDE, [erster(2)])
    const treffer = gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(treffer.angekommen.map((l) => l.instanzId)).toEqual(['p'])
    expect(treffer.verdraengt).toEqual([])
  })

  it('kettet weiter: Prüfer → Zweitaudit → Drittaudit — nur das letzte zählt', () => {
    const dritt = lieferung('d', 10, 1, ['Prüfbeleg'], {
      braucht: PRUEFER_BEDARF,
      vorfahrenIds: ['b', 'p', 'z']
    })
    const { gruppen } = uebergabenAuswahl(SESSIONENDE, [erster(3), zweitaudit(2), dritt])
    const treffer = gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(treffer.angekommen.map((l) => l.instanzId)).toEqual(['d'])
    expect(treffer.verdraengt.map((l) => l.instanzId)).toEqual(['p', 'z'])
    expect(treffer.verdraengt.every((l) => l.grund === 'weiterverarbeitung')).toBe(true)
  })
})

describe('0.46.2 · Regressionen — was war, bleibt', () => {
  const bauer = { braucht: ['Arbeitspaket'], brauchtOptional: ['Angriffsliste'] }
  const alt = (nummer, naehe, liefert) => ({ name: 'Angreifer', nummer, naehe, liefert, text: 'x' })

  it('Distanz-Regel wie bisher — jetzt mit grund „distanz" und den Gewinnern', () => {
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('a1', 2, 2, ['Angriffsliste']),
      lieferung('a2', 3, 1, ['Angriffsliste'])
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Angriffsliste')
    expect(treffer.angekommen.map((l) => l.instanzId)).toEqual(['a2'])
    expect(treffer.verdraengt.map((l) => [l.instanzId, l.grund, l.verdraengtVon])).toEqual([
      ['a1', 'distanz', ['a2']]
    ])
  })

  it('Lieferungen ohne instanzId/vorfahrenIds verhalten sich exakt wie bisher', () => {
    // Zwei Prüfbelege, ungleich nah, ohne Herkunft: der nähere gewinnt (Distanz).
    const nah = uebergabenAuswahl(SESSIONENDE, [alt(7, 2, ['Prüfbeleg']), alt(9, 1, ['Prüfbeleg'])])
    const t1 = nah.gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(t1.angekommen.map((l) => l.nummer)).toEqual([9])
    expect(t1.verdraengt.map((l) => [l.nummer, l.grund])).toEqual([[7, 'distanz']])
    // Gleich nah ohne Herkunft: beide kommen an — hier kann nichts weiterverarbeitet sein.
    const gleich = uebergabenAuswahl(SESSIONENDE, [alt(7, 1, ['Prüfbeleg']), alt(9, 1, ['Prüfbeleg'])])
    const t2 = gleich.gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(t2.angekommen.map((l) => l.nummer)).toEqual([7, 9])
    expect(t2.verdraengt).toEqual([])
  })

  it('führt-zusammen-Blöcke bekommen weiterhin alles — auch das Weiterverarbeitete', () => {
    const integrator = { braucht: ['Prüfbeleg'], fuehrtZusammen: true }
    const { gruppen } = uebergabenAuswahl(integrator, [
      lieferung('p', 7, 2, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b'] }),
      lieferung('z', 9, 1, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['b', 'p'] })
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Prüfbeleg')
    expect(treffer.angekommen.map((l) => l.instanzId)).toEqual(['p', 'z'])
    expect(treffer.verdraengt).toEqual([])
  })

  it('meldet weiterhin nichts für Etiketten, die der Block nicht braucht', () => {
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('p', 7, 2, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: [] }),
      lieferung('z', 9, 1, ['Prüfbeleg'], { braucht: PRUEFER_BEDARF, vorfahrenIds: ['p'] })
    ])
    expect(gruppen).toEqual([])
  })
})

describe('0.46.2 · Schaubild: Chips und Vorspann sagen dasselbe wie der Lauf', () => {
  // Georgs Life-OS-Schaubild: Paket schneiden → zwei Bauer → je ein Prüfer →
  // Zweitaudit hinter beiden → Sessionende hinter allem (auch direkt hinter
  // den ersten Prüfern, damit die Distanz allein NICHT reicht).
  const bloecke = [
    block('paket', 'paket-schneiden'),
    block('b1', 'bauer', 'UI'),
    block('b2', 'bauer', 'Motor'),
    block('p1', 'pruefer', 'UI'),
    block('p2', 'pruefer', 'Motor'),
    block('z', 'pruefer', 'Zweitaudit'),
    block('s', 'sessionende')
  ]
  const pfeile = [
    pfeil('paket', 'b1'),
    pfeil('paket', 'b2'),
    pfeil('b1', 'p1'),
    pfeil('b2', 'p2'),
    pfeil('p1', 'z'),
    pfeil('p2', 'z'),
    pfeil('z', 's'),
    pfeil('p1', 's'),
    pfeil('p2', 's')
  ]

  it('brauchtHerkunft: das Zweitaudit bekommt beide Prüfer, das Sessionende nur das Zweitaudit', () => {
    expect(brauchtHerkunft(bloecke, pfeile, 'z').get('Prüfbeleg')).toEqual([
      'Prüfer · UI',
      'Prüfer · Motor'
    ])
    expect(brauchtHerkunft(bloecke, pfeile, 's').get('Prüfbeleg')).toEqual(['Prüfer · Zweitaudit'])
    // Andere Etiketten unberührt: beide Umsetzungsberichte kommen am Sessionende an.
    expect(brauchtHerkunft(bloecke, pfeile, 's').get('Umsetzungsbericht')).toEqual([
      'Bauer · UI',
      'Bauer · Motor'
    ])
  })

  it('empfaengerLage: der erste Prüfer sieht das Zweitaudit als optionalen Empfänger — nicht das Sessionende', () => {
    const lage = empfaengerLage(bloecke, pfeile, 'p1')
    const belege = lage.empfaenger.filter((e) => e.etikett === 'Prüfbeleg')
    expect(belege.map((e) => [e.instanzId, e.optional, e.wozu])).toEqual([
      ['z', true, PRUEFER.brauchtWozu['Prüfbeleg']]
    ])
    // Der Beleg kommt an (beim Zweitaudit) — also keine „bei niemandem"-Meldung.
    expect(lage.verdraengt).toEqual([])
  })

  it('der Vorspann des ersten Prüfers nennt das Zweitaudit mit dem wozu-Satz', () => {
    const text = vorspannText(bloecke, pfeile, 'p1')
    expect(text).toContain(
      v.empfaengerOptional(bezeichnung(6, 'Prüfer · Zweitaudit'), 'Prüfbeleg', PRUEFER.brauchtWozu['Prüfbeleg'])
    )
    expect(text).not.toContain(v.verdraengt('Prüfbeleg', bezeichnung(6, 'Prüfer · Zweitaudit')))
  })

  it('das Zweitaudit sieht das Sessionende als Empfänger seines Belegs', () => {
    const lage = empfaengerLage(bloecke, pfeile, 'z')
    expect(lage.empfaenger.map((e) => [e.instanzId, e.etikett])).toEqual([['s', 'Prüfbeleg']])
  })
})

describe('0.46.2 · Ticker-Zeile zur Weiterverarbeitung', () => {
  it('trägt Etikett, Verdrängten, Weiterverarbeiter, Empfänger und Gewinner hinein', () => {
    const zeile = texte.ticker.uebergabeWeiterverarbeitet(
      'Prüfbeleg',
      bezeichnung(7, 'Prüfer'),
      bezeichnung(9, 'Zweitaudit'),
      bezeichnung(10, 'Sessionende'),
      bezeichnung(9, 'Zweitaudit')
    )
    for (const stueck of ['Prüfbeleg', bezeichnung(7, 'Prüfer'), bezeichnung(9, 'Zweitaudit'), bezeichnung(10, 'Sessionende')])
      expect(zeile).toContain(stueck)
    // Und es ist NICHT die Distanz-Zeile („näher im Schaubild").
    expect(zeile).not.toBe(
      texte.ticker.uebergabeVerdraengt('Prüfbeleg', bezeichnung(10, 'Sessionende'), bezeichnung(9, 'Zweitaudit'), bezeichnung(7, 'Prüfer'))
    )
  })
})
