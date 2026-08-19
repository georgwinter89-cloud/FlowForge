// Prüfungen zu „davon lokal", Block-Dauer und lokaler Bilanz (BAUPLAN 51):
// 1. Extrakt: bevorzugt bericht.verbrauch.lokal (Hauptprozess-Summe, zählt
//    auch kontingent-erschöpfte Anläufe), Rückfall Block-Summe über die
//    Klasse „lokal" (0.49/0.50-Berichte) — Dauer rückwirkend „ohne Angabe",
//    fällt aus Durchschnitten, nie 0.
// 2. Eimer: Dauer nach dem Muster mitTokens/ohneTokens; Ø-Dauer in
//    Blocktyp × Modell (löst die SPEC-Zusage §3.4 ein).
// 3. lokaleBilanz: Schwellen 5 / 0.7 / 0.2 mechanisch erzwungen, „(ohne
//    Modell)"-Zeilen nie, Deckel 15 Zeilen, vorhanden=false ohne Daten.
import { describe, it, expect } from 'vitest'
import {
  BILANZ_MAX_ZEILEN,
  blockModellAuswerten,
  laufExtraktAusBericht,
  lokaleBilanz,
  motorAuswerten,
  OHNE_MODELL,
  urteilPruefen
} from '../src/shared/metrikRegeln.js'

const START = '2026-08-20T10:00:00.000Z'

function bericht(teile = {}) {
  return { id: 'l1', workflow: 'Kette', gestartetAm: START, zustand: 'erfolgreich', ...teile }
}
function lokalBlock(teile = {}) {
  return {
    block: 'Bauer',
    instanzId: 'b1',
    zustand: 'erfolgreich',
    tokens: 1000,
    kostenUsd: 0,
    klasse: 'lokal',
    modelle: [{ modell: 'flowforge-qwen', tokens: 1000, anteil: 1 }],
    ...teile
  }
}
function urteil(teile = {}) {
  return urteilPruefen({
    zeit: START,
    projektPfad: 'C:\\P',
    laufId: 'l1',
    block: 'Bauer',
    modell: 'qwen2.5:7b',
    bereich: 'recherche',
    ausgang: 'uebernommen',
    schritte: 1,
    ...teile
  })
}

describe('BAUPLAN 51 · Extrakt „davon lokal"', () => {
  it('bevorzugt bericht.verbrauch.lokal — auch wenn Block-Einträge fehlen (kontingent-erschöpft)', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 9000, kostenUsd: null, lokal: { tokens: 4000, dauerMs: 120000 } },
        blockErgebnisse: []
      }),
      'C:\\P'
    )
    expect(e.lokalTokens).toBe(4000)
    expect(e.lokalDauerMs).toBe(120000)
  })

  it('0.49/0.50-Rückfall: Block-Summe über die Klasse „lokal", Dauer ohne Angabe (null, nie 0)', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 9000 },
        blockErgebnisse: [
          lokalBlock({ tokens: 1500 }),
          lokalBlock({ instanzId: 'b2', block: 'Prüfer', tokens: 500 }),
          { block: 'Bauer', instanzId: 'c1', zustand: 'erfolgreich', tokens: 7000, klasse: 'opus' }
        ]
      }),
      'C:\\P'
    )
    expect(e.lokalTokens).toBe(2000)
    expect(e.lokalDauerMs).toBeNull()
  })

  it('Berichte ohne lokale Blöcke haben ehrlich 0 lokal; Block-Dauer wird übernommen, wenn vorhanden', () => {
    const e = laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 100 },
        blockErgebnisse: [
          { block: 'Bauer', instanzId: 'c1', zustand: 'erfolgreich', tokens: 100, klasse: 'opus', dauerMs: 60000 }
        ]
      }),
      'C:\\P'
    )
    expect(e.lokalTokens).toBe(0)
    expect(e.lokalDauerMs).toBe(0)
    expect(e.bloecke[0].dauerMs).toBe(60000)
  })
})

describe('BAUPLAN 51 · Dauer in den Eimern', () => {
  const extrakte = [
    laufExtraktAusBericht(
      bericht({
        verbrauch: { tokens: 3000, lokal: { tokens: 1000, dauerMs: 60000 } },
        blockErgebnisse: [
          lokalBlock({ dauerMs: 60000, tokens: 1000 }),
          // Alter Eintrag ohne Dauer — fällt aus dem Ø, drückt ihn nicht auf 0.
          { block: 'Bauer', instanzId: 'c1', zustand: 'erfolgreich', tokens: 2000, klasse: 'opus' }
        ]
      }),
      'C:\\P'
    ),
    laufExtraktAusBericht(
      bericht({
        id: 'l2',
        verbrauch: { tokens: 2000 },
        blockErgebnisse: [
          { block: 'Bauer', instanzId: 'c2', zustand: 'erfolgreich', tokens: 2000, klasse: 'opus', dauerMs: 30000 }
        ]
      }),
      'C:\\P'
    )
  ]

  it('motorAuswerten führt „davon lokal" je Lauf und die Block-Dauer mit ehrlicher Lücke', () => {
    const m = motorAuswerten(extrakte)
    expect(m.gesamt.lokalTokens).toBe(1000)
    expect(m.gesamt.mitLokalDauer).toBe(1)
    expect(m.gesamt.lokalDauerMs).toBe(60000)
    // Zwei Bauer-Erstläufe (einer je Lauf): einer mit 60 s, einer ohne Angabe
    // — hier zählt die Instanz c1 ohne dauerMs als Lücke.
    const bauer = m.jeBlock.find((z) => z.block === 'Bauer')
    expect(bauer.erstlauf.mitDauer + bauer.erstlauf.ohneDauer).toBe(bauer.erstlauf.anzahl)
    expect(bauer.erstlauf.ohneDauer).toBeGreaterThan(0)
  })

  it('blockModellAuswerten trägt die Ø-Dauer je Zeile — alte Einträge als „ohne Angabe", nicht 0', () => {
    const zeilen = blockModellAuswerten(extrakte)
    const lokalZeile = zeilen.find((z) => z.modell === 'flowforge-qwen')
    expect(lokalZeile.erstlauf.dauerDurchschnitt).toBe(60000)
    const alteZeile = zeilen.find((z) => z.modell === OHNE_MODELL)
    // Beide Opus-Einträge landen in derselben „(ohne Modell)"-Zeile: einer mit
    // 30 s, einer ohne Angabe — der Ø rechnet NUR über die bekannte Dauer
    // (30 s, nicht 15 s), die Lücke steht ehrlich daneben.
    expect(alteZeile.erstlauf.dauerDurchschnitt).toBe(30000)
    expect(alteZeile.erstlauf.mitDauer).toBe(1)
    expect(alteZeile.erstlauf.ohneDauer).toBe(1)
  })
})

describe('BAUPLAN 51 · lokaleBilanz (Schwellen 5 / 0.7 / 0.2)', () => {
  it('ohne lokale Daten: vorhanden=false, kein Block', () => {
    const b = lokaleBilanz([], [])
    expect(b.vorhanden).toBe(false)
    expect(b.zeilen).toEqual([])
  })

  it('4 beurteilte Fälle ergeben NIE „lief gut" — erst ab 5', () => {
    const wenige = [0, 1, 2, 3].map(() => urteil())
    const genug = [0, 1, 2, 3, 4].map(() => urteil())
    expect(lokaleBilanz(wenige, []).zeilen[0].urteil).toBe('zuWenig')
    expect(lokaleBilanz(genug, []).zeilen[0].urteil).toBe('gut')
  })

  it('Quote unter 0.7 ist kein „gut"; unter 0.3 ehrlich „schlecht"', () => {
    const gemischt = [
      urteil(),
      urteil(),
      urteil(),
      urteil({ ausgang: 'verworfen' }),
      urteil({ ausgang: 'verworfen' })
    ]
    expect(lokaleBilanz(gemischt, []).zeilen[0].urteil).toBe('offen')
    const schlecht = [
      urteil({ ausgang: 'verworfen' }),
      urteil({ ausgang: 'verworfen' }),
      urteil({ ausgang: 'verworfen' }),
      urteil({ ausgang: 'verworfen' }),
      urteil()
    ]
    expect(lokaleBilanz(schlecht, []).zeilen[0].urteil).toBe('schlecht')
  })

  it('Abnahme-Paare: Widerspruch ≤ 0.2 „gut", ≥ 0.5 „schlecht", unter 5 Paaren „zuWenig"', () => {
    const abnahmeBericht = (anzahl, widersprueche, id) =>
      laufExtraktAusBericht(
        bericht({
          id,
          blockErgebnisse: [
            {
              block: 'Prüfer · Abnahme',
              instanzId: 'a-' + id,
              zustand: 'pruefung-bestanden',
              tokens: 10,
              modelle: [{ modell: 'claude-opus', tokens: 10, anteil: 1 }],
              abnahmeFuer: Array.from({ length: anzahl }, (_, i) => ({
                instanzId: `p${id}-${i}`,
                block: 'Prüfer',
                modell: 'flowforge-qwen',
                urteilLokal: 'bestanden',
                urteilAbnahme: i < widersprueche ? 'fehlgeschlagen' : 'bestanden',
                durchTor: false
              }))
            }
          ]
        }),
        'C:\\P'
      )
    const gut = lokaleBilanz([], [abnahmeBericht(5, 1, 'g')]).zeilen.find((z) => z.art === 'abnahme')
    expect(gut.urteil).toBe('gut')
    const schlecht = lokaleBilanz([], [abnahmeBericht(6, 3, 's')]).zeilen.find((z) => z.art === 'abnahme')
    expect(schlecht.urteil).toBe('schlecht')
    const wenig = lokaleBilanz([], [abnahmeBericht(4, 0, 'w')]).zeilen.find((z) => z.art === 'abnahme')
    expect(wenig.urteil).toBe('zuWenig')
  })

  it('„(ohne Modell)"-Zeilen erscheinen nie; lokale Blöcke ohne Prüf-Urteil bleiben „offen"/„zuWenig"', () => {
    const e = laufExtraktAusBericht(
      bericht({
        blockErgebnisse: [
          lokalBlock({ modelle: null }), // ohne Modell → nie in der Bilanz
          lokalBlock({ instanzId: 'b9' })
        ]
      }),
      'C:\\P'
    )
    const b = lokaleBilanz([], [e])
    expect(b.zeilen.every((z) => z.modell !== OHNE_MODELL)).toBe(true)
    const block = b.zeilen.find((z) => z.art === 'block')
    expect(block.modell).toBe('flowforge-qwen')
    expect(block.urteil).toBe('zuWenig')
  })

  it('Deckel: höchstens 15 Zeilen, Rest wird gezählt statt verschwiegen', () => {
    // 20 Modelle × Bereich recherche → 20 Zeilen vor dem Deckel.
    const urteile = []
    for (let m = 0; m < 20; m++)
      for (let i = 0; i < 5; i++) urteile.push(urteil({ modell: 'modell-' + m }))
    const b = lokaleBilanz(urteile, [])
    expect(b.zeilen.length).toBe(BILANZ_MAX_ZEILEN)
    expect(b.weggelassen).toBe(5)
  })
})
