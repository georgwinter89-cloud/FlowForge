// Prüfungen zu „Sehen & Messen" (BAUPLAN 36): Harness-Kennzahlen, Modell je
// Block und die Sicht-Hilfe „woher kommt, was der Block braucht".
//
// Rot-vor-Grün: Alle Fälle hier schlugen vor dem Bauschritt fehl —
// harnessAuswerten, blockModellAuswerten, modellVonEintrag und brauchtHerkunft
// gab es nicht, und laufExtraktAusBericht kannte weder Modell noch erstes
// Urteil. Die beiden Fälle „Prüfbefehl-Nachforderung" und „ohne Modell" prüfen
// die Stellen, an denen eine naive Zählung falsche Zahlen liefern würde: Der
// erste Anlauf eines Prüfers ist nicht immer sein erstes Urteil, und ein
// Anlauf ohne Motor (Tor ohne KI) ist kein Opus-Anlauf mit 0 Tokens.
import { describe, it, expect } from 'vitest'
import {
  OHNE_MODELL,
  blockModellAuswerten,
  harnessAuswerten,
  laufExtraktAusBericht,
  modellVonEintrag
} from '../src/shared/metrikRegeln.js'
import { brauchtHerkunft } from '../src/shared/kettenRegeln.js'

// Ein Lauf mit Bauer und Prüfer; der Prüfer schickt einmal zurück und
// besteht im zweiten Anlauf.
function laufMitReparatur() {
  return {
    id: 'l1',
    workflow: 'Paket schneiden → Bauer → Prüfer',
    gestartetAm: '2026-08-10T09:00:00.000Z',
    beendetAm: '2026-08-10T10:00:00.000Z',
    zustand: 'erfolgreich',
    verbrauch: { tokens: 300000, kostenUsd: 6 },
    rechteFragen: [{ beschreibung: 'npm install', erlaubt: true }],
    entscheidungen: [],
    uebertraege: [],
    zusammenfassungen: [{ zeit: '2026-08-10T09:30:00.000Z', wer: 'Bauer', text: '…' }],
    blockErgebnisse: [
      {
        instanzId: 'a',
        block: 'Bauer',
        zustand: 'erfolgreich',
        tokens: 100000,
        kostenUsd: 2,
        modelle: [{ modell: 'claude-opus-5', tokens: 100000, anteil: 1 }]
      },
      {
        instanzId: 'b',
        block: 'Prüfer',
        zustand: 'pruefung-nicht-bestanden',
        tokens: 80000,
        kostenUsd: 2,
        modelle: [{ modell: 'claude-opus-5', tokens: 80000, anteil: 1 }]
      },
      {
        instanzId: 'a',
        block: 'Bauer',
        zustand: 'erfolgreich',
        tokens: 60000,
        kostenUsd: 1,
        modelle: [{ modell: 'claude-opus-5', tokens: 60000, anteil: 1 }]
      },
      {
        instanzId: 'b',
        block: 'Prüfer',
        zustand: 'pruefung-bestanden',
        tokens: 60000,
        kostenUsd: 1,
        modelle: [{ modell: 'claude-opus-5', tokens: 60000, anteil: 1 }]
      }
    ]
  }
}

// Ein sauberer Lauf: Der Prüfer besteht sofort.
function laufSauber() {
  return {
    id: 'l2',
    workflow: 'Paket schneiden → Bauer → Prüfer',
    gestartetAm: '2026-08-11T09:00:00.000Z',
    zustand: 'erfolgreich',
    verbrauch: { tokens: 120000, kostenUsd: 3 },
    rechteFragen: [],
    entscheidungen: [],
    uebertraege: [{ zeit: '2026-08-11T09:20:00.000Z', block: 'Bauer', text: '…' }],
    zusammenfassungen: [],
    blockErgebnisse: [
      {
        instanzId: 'b',
        block: 'Prüfer',
        zustand: 'pruefung-bestanden',
        tokens: 50000,
        kostenUsd: 1,
        modelle: [{ modell: 'claude-sonnet-5', tokens: 50000, anteil: 1 }]
      }
    ]
  }
}

const extrakt = (bericht) => laufExtraktAusBericht(bericht, 'C:\\P')

describe('BAUPLAN 36 · Modell je Block', () => {
  it('nimmt bei Mischung das führende Modell und meldet „ohne Modell", wenn keines lief', () => {
    expect(
      modellVonEintrag({
        modelle: [
          { modell: 'claude-haiku-4-5', tokens: 2000, anteil: 0.2 },
          { modell: 'claude-opus-5', tokens: 8000, anteil: 0.8 }
        ]
      })
    ).toBe('claude-opus-5')
    // Tor ohne KI (BAUPLAN 35): 0 Tokens, kein Modell — das ist etwas anderes
    // als „Opus hat nichts verbraucht".
    expect(modellVonEintrag({ tokens: 0, modelle: null })).toBe(OHNE_MODELL)
    // Alte Berichte kennen das Feld gar nicht.
    expect(modellVonEintrag({ tokens: 5000 })).toBe(OHNE_MODELL)
  })

  it('schneidet Blocktyp × Modell mit Erstläufen, Wiederholungen und Erstbestehen', () => {
    const zeilen = blockModellAuswerten([extrakt(laufMitReparatur()), extrakt(laufSauber())])
    const bauer = zeilen.find((z) => z.block === 'Bauer')
    expect(bauer.modell).toBe('claude-opus-5')
    expect(bauer.erstlauf.anzahl).toBe(1)
    expect(bauer.wiederholung.anzahl).toBe(1)
    // Kein Prüf-Block ⇒ keine erfundene Quote.
    expect(bauer.erstbestehenQuote).toBeNull()
    const prueferOpus = zeilen.find((z) => z.block === 'Prüfer' && z.modell === 'claude-opus-5')
    expect(prueferOpus.ersteUrteile).toBe(1)
    expect(prueferOpus.erstBestanden).toBe(0)
    expect(prueferOpus.erstbestehenQuote).toBe(0)
    const prueferSonnet = zeilen.find((z) => z.block === 'Prüfer' && z.modell === 'claude-sonnet-5')
    expect(prueferSonnet.erstbestehenQuote).toBe(1)
  })
})

describe('BAUPLAN 36 · Harness-Kennzahlen', () => {
  it('zählt Erstbestehen, Reparatur-Runden, Fragen und Überträge je Lauf', () => {
    const k = harnessAuswerten([extrakt(laufMitReparatur()), extrakt(laufSauber())]).gesamt
    expect(k.laeufe).toBe(2)
    expect(k.mitPruefung).toBe(2)
    expect(k.erstBestanden).toBe(1)
    expect(k.erstbestehenQuote).toBe(0.5)
    expect(k.reparaturRunden).toBe(1)
    expect(k.reparaturJeLauf).toBe(0.5)
    expect(k.rechteJeLauf).toBe(0.5)
    expect(k.folgenJeLauf).toBe(0)
    expect(k.uebertraegeJeLauf).toBe(0.5)
    expect(k.zusammenfassungenJeLauf).toBe(0.5)
    expect(k.ausgaenge).toEqual([{ zustand: 'erfolgreich', anzahl: 2 }])
  })

  it('rechnet das erste Urteil, nicht den ersten Anlauf (Prüfbefehl-Nachforderung)', () => {
    // BAUPLAN 35: Fehlt der Prüfbefehl, läuft der Prüfer einmal nur zum
    // Nachtragen — dieser Anlauf trägt noch gar kein Urteil. Wer den ersten
    // Anlauf zählt, hielte den Lauf fälschlich für „nicht erstbestanden".
    const bericht = {
      id: 'l3',
      workflow: 'Bauer → Prüfer',
      gestartetAm: '2026-08-12T09:00:00.000Z',
      zustand: 'erfolgreich',
      verbrauch: { tokens: 1000, kostenUsd: 1 },
      blockErgebnisse: [
        { instanzId: 'p', block: 'Prüfer', zustand: 'erfolgreich', tokens: 10 },
        { instanzId: 'p', block: 'Prüfer', zustand: 'pruefung-bestanden', tokens: 20 }
      ]
    }
    const k = harnessAuswerten([extrakt(bericht)]).gesamt
    expect(k.mitPruefung).toBe(1)
    expect(k.erstbestehenQuote).toBe(1)
    expect(k.reparaturRunden).toBe(0)
  })

  it('zählt Zusammenfassungen nur für Berichte, die etwas dazu sagen', () => {
    // Läufe vor Bauschritt 36 haben das Feld nicht — „keine Angabe" ist etwas
    // anderes als „null Zusammenfassungen" und darf den Schnitt nicht senken.
    const alt = { ...laufSauber(), id: 'alt' }
    delete alt.zusammenfassungen
    const neu = { ...laufSauber(), id: 'neu', zusammenfassungen: [{ text: 'x' }, { text: 'y' }] }
    const k = harnessAuswerten([extrakt(alt), extrakt(neu)]).gesamt
    expect(k.mitZusammenfassungsAngabe).toBe(1)
    expect(k.ohneZusammenfassungsAngabe).toBe(1)
    expect(k.zusammenfassungenJeLauf).toBe(2)
  })

  it('schneidet je Kette und je Kalenderwoche', () => {
    const auswertung = harnessAuswerten([extrakt(laufMitReparatur()), extrakt(laufSauber())])
    expect(auswertung.jeKette).toHaveLength(1)
    expect(auswertung.jeKette[0].kette).toBe('Paket schneiden → Bauer → Prüfer')
    expect(auswertung.jeKette[0].laeufe).toBe(2)
    // 10. und 11.08.2026 liegen in derselben Kalenderwoche (Mo–So).
    expect(auswertung.jeWoche).toHaveLength(1)
    expect(auswertung.jeWoche[0].laeufe).toBe(2)
    expect(auswertung.jeWoche[0].ausgaenge[0]).toEqual({ zustand: 'erfolgreich', anzahl: 2 })
  })
})

describe('BAUPLAN 36 · Sicht-Hilfe: woher kommt, was der Block braucht', () => {
  const bloecke = [
    { instanzId: '1', blockId: 'paket-schneiden' },
    { instanzId: '2', blockId: 'bauer' },
    { instanzId: '3', blockId: 'pruefer' }
  ]
  const pfeile = [
    { von: '1', nach: '2' },
    { von: '2', nach: '3' }
  ]

  it('nennt den liefernden Vorfahren', () => {
    const herkunft = brauchtHerkunft(bloecke, pfeile, '2')
    expect(herkunft.get('Arbeitspaket')).toEqual(['Paket schneiden'])
  })

  it('lässt die Liste leer, wenn keiner liefert — das ist das „fehlt"', () => {
    // Der Bauer allein auf der Leinwand: Sein Arbeitspaket liefert niemand.
    const herkunft = brauchtHerkunft([bloecke[1]], [], '2')
    expect(herkunft.get('Arbeitspaket')).toEqual([])
  })

  it('nennt bei gleicher Distanz alle Lieferanten (Fan-out, BAUPLAN 34)', () => {
    const zwei = [
      { instanzId: '1', blockId: 'paket-schneiden' },
      { instanzId: '1b', blockId: 'paket-schneiden' },
      { instanzId: '2', blockId: 'bauer' }
    ]
    const kanten = [
      { von: '1', nach: '2' },
      { von: '1b', nach: '2' }
    ]
    expect(brauchtHerkunft(zwei, kanten, '2').get('Arbeitspaket')).toEqual([
      'Paket schneiden',
      'Paket schneiden'
    ])
  })
})
