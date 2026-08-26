// Prüfungen zu „davon OpenRouter" (Bauschritt 60): der eigene Verbrauchs-Topf
// je Lauf, sein Extrakt und die Eimer der Metriken — exakt das Lokal-Muster
// aus BAUPLAN 51, plus die GEMESSENEN Anbieter-Kosten (usage.cost, gebucht im
// Übersetzer). Kern-Ehrlichkeit überall: null heißt „kein Anbieter hat je
// einen Betrag gemeldet", nie eine erfundene 0 — und OpenRouter-Kosten sind
// echtes Geld, sie erscheinen nie als theoretische API-/Abo-Kosten.
//
// Rot vor Grün: Vor Bauschritt 60 kannte der Extrakt keine openrouter*-Felder,
// die Eimer keine openrouterTokens/…-Zähler, und die Texte hätten mit einem
// Eimer ohne diese Felder nichts anzuzeigen gehabt.
import { describe, it, expect } from 'vitest'
import { laufExtraktAusBericht, motorAuswerten } from '../src/shared/metrikRegeln.js'
import { texte } from '../src/shared/texte.js'

const START = '2026-08-24T10:00:00.000Z'

function bericht(teile = {}) {
  return { id: 'l1', workflow: 'Kette', gestartetAm: START, zustand: 'erfolgreich', ...teile }
}
function openrouterBlock(teile = {}) {
  return {
    block: 'Bauer',
    instanzId: 'o1',
    zustand: 'erfolgreich',
    tokens: 3000,
    kostenUsd: null,
    klasse: 'openrouter',
    modelle: [{ modell: 'stealth/ox-alpha', tokens: 3000, anteil: 1 }],
    ...teile
  }
}

describe('Bauschritt 60 · Extrakt „davon OpenRouter"', () => {
  it('bevorzugt bericht.verbrauch.openrouter — auch ohne Block-Einträge (kontingent-erschöpft)', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: {
          tokens: 9000,
          kostenUsd: null,
          openrouter: { tokens: 4000, dauerMs: 90000, kostenUsd: 0.0042 }
        },
        blockErgebnisse: []
      }),
      'C:\\P'
    )
    expect(e.openrouterTokens).toBe(4000)
    expect(e.openrouterDauerMs).toBe(90000)
    expect(e.openrouterKostenUsd).toBe(0.0042)
  })

  it('im Topf heißt kostenUsd null ehrlich „nicht gemeldet" — nie 0', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 9000, openrouter: { tokens: 4000, dauerMs: 90000, kostenUsd: null } },
        blockErgebnisse: []
      }),
      'C:\\P'
    )
    expect(e.openrouterKostenUsd).toBe(null)
  })

  it('0.60-Rückfall: Block-Summe über die Klasse „openrouter" — Kosten null, wenn kein Block welche trägt', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 9000 },
        blockErgebnisse: [
          openrouterBlock({ tokens: 1500 }),
          openrouterBlock({ instanzId: 'o2', block: 'Prüfer', tokens: 500 }),
          { block: 'Bauer', instanzId: 'c1', zustand: 'erfolgreich', tokens: 7000, klasse: 'opus' }
        ]
      }),
      'C:\\P'
    )
    expect(e.openrouterTokens).toBe(2000)
    // Dauer gibt es rückwirkend nicht — null („ohne Angabe"), nie 0.
    expect(e.openrouterDauerMs).toBeNull()
    // 0.60-Blöcke tragen durchweg kostenUsd null → keiner gemeldet → null.
    expect(e.openrouterKostenUsd).toBeNull()
  })

  it('im Rückfall zählen nur ECHT gemessene Blockkosten — eine gemeldete 0 macht aus null eine 0', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 9000 },
        blockErgebnisse: [
          openrouterBlock({ kostenUsd: 0.003, dauerMs: 60000 }),
          openrouterBlock({ instanzId: 'o2', kostenUsd: null, dauerMs: 30000 }),
          openrouterBlock({ instanzId: 'o3', kostenUsd: 0, dauerMs: 10000 })
        ]
      }),
      'C:\\P'
    )
    expect(e.openrouterKostenUsd).toBe(0.003)
    expect(e.openrouterDauerMs).toBe(100000)
  })

  it('Berichte ohne OpenRouter haben ehrlich 0 Tokens, 0 Dauer und null Kosten — alte Berichte brechen nie', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 100 },
        blockErgebnisse: [{ block: 'Bauer', instanzId: 'c1', zustand: 'erfolgreich', tokens: 100, klasse: 'opus' }]
      }),
      'C:\\P'
    )
    expect(e.openrouterTokens).toBe(0)
    expect(e.openrouterDauerMs).toBe(0)
    expect(e.openrouterKostenUsd).toBeNull()
  })
})

describe('Bauschritt 60 · Eimer der Metriken', () => {
  const extrakte = [
    laufExtraktAusBericht(
      bericht({
        verbrauch: {
          tokens: 5000,
          openrouter: { tokens: 3000, dauerMs: 120000, kostenUsd: 0.01 }
        },
        blockErgebnisse: [openrouterBlock({ dauerMs: 120000, kostenUsd: 0.01 })]
      }),
      'C:\\P'
    ),
    // Ein Lauf MIT OpenRouter-Tokens, aber ohne Dauer-Angabe und ohne
    // gemeldete Kosten (0.60-Bericht im Rückfall).
    laufExtraktAusBericht(
      bericht({
        id: 'l2',
        verbrauch: { tokens: 2000 },
        blockErgebnisse: [openrouterBlock({ instanzId: 'o9', tokens: 2000 })]
      }),
      'C:\\P'
    ),
    // Und ein Lauf ganz ohne OpenRouter.
    laufExtraktAusBericht(
      bericht({
        id: 'l3',
        verbrauch: { tokens: 700 },
        blockErgebnisse: [{ block: 'Bauer', instanzId: 'c1', zustand: 'erfolgreich', tokens: 700, klasse: 'opus' }]
      }),
      'C:\\P'
    )
  ]

  it('motorAuswerten führt die openrouter-Felder exakt nach dem Lokal-Muster', () => {
    const m = motorAuswerten(extrakte)
    expect(m.gesamt.openrouterTokens).toBe(5000)
    expect(m.gesamt.openrouterLaeufe).toBe(2)
    expect(m.gesamt.openrouterDauerMs).toBe(120000)
    expect(m.gesamt.mitOpenrouterDauer).toBe(1)
    expect(m.gesamt.ohneOpenrouterDauer).toBe(1)
    // Summe NUR gemeldeter Beträge — der Lauf ohne Meldung drückt nichts.
    expect(m.gesamt.openrouterKostenUsd).toBe(0.01)
    // OpenRouter-Kosten sind echtes Geld — sie stecken NIE in der
    // theoretischen API-Kosten-Summe des Eimers.
    expect(m.gesamt.kostenUsd).toBe(0)
    // Auch je Woche und je Kette liegen die Felder (die Texte lesen sie).
    expect(m.jeWoche[0].openrouterTokens).toBe(5000)
    expect(m.jeKette[0].openrouterKostenUsd).toBe(0.01)
  })

  it('die Metrik-Texte zeigen die Anteile aus GENAU diesen Feldnamen', () => {
    const m = motorAuswerten(extrakte)
    const zeile = texte.metriken.gesamtZeile(m.gesamt)
    expect(zeile).toMatch(/davon OpenRouter: 5\.000 Tokens/)
    expect(zeile).toMatch(/0,01 \$/)
    const woche = texte.metriken.wocheZeile(m.jeWoche[0])
    expect(woche).toMatch(/davon OpenRouter: 5\.000/)
    // Ohne OpenRouter-Anteil taucht die Beschriftung nicht auf.
    const ohne = motorAuswerten([extrakte[2]])
    expect(texte.metriken.gesamtZeile(ohne.gesamt)).not.toMatch(/OpenRouter/)
  })

  it('die Laufbericht-Zeile des Topfs: gemessener Betrag oder ehrlich „nicht gemeldet"', () => {
    const mit = texte.metriken.davonOpenrouterZeile({ tokens: 3000, dauerMs: 120000, kostenUsd: 0.01 })
    expect(mit).toMatch(/3\.000 Tokens/)
    expect(mit).toMatch(/0,01 \$/)
    expect(mit).toMatch(/echtes Geld/)
    const ohne = texte.metriken.davonOpenrouterZeile({ tokens: 3000, dauerMs: 120000, kostenUsd: null })
    expect(ohne).toMatch(/Kosten nicht gemeldet/)
    expect(ohne).not.toMatch(/0 \$/)
    // Eine gemeldete 0 ist eine Messung — sie wird gezeigt, nicht verschwiegen.
    expect(texte.metriken.davonOpenrouterZeile({ tokens: 10, kostenUsd: 0 })).toMatch(/0 \$/)
  })

  it('der Abo-Anteil der Gesamtzeile zieht OpenRouter-Tokens ab (weder Abo noch lokal)', () => {
    // Beide Anteile vorhanden: Der Abo-Anteil steht in der Lokal-Beschriftung
    // und rechnet gesamt − lokal − openrouter.
    const beides = texte.metriken.gesamtZeile({
      anzahl: 1,
      tokens: 10000,
      mitKosten: 0,
      ohneKosten: 1,
      kostenUsd: 0,
      lokalTokens: 2000,
      mitLokalDauer: 0,
      ohneLokalDauer: 0,
      lokalDauerMs: 0,
      openrouterTokens: 3000,
      mitOpenrouterDauer: 0,
      ohneOpenrouterDauer: 0,
      openrouterDauerMs: 0,
      openrouterKostenUsd: 0
    })
    expect(beides).toMatch(/Abo-Anteil: 5\.000 Tokens/)
  })
})
