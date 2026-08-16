// Prüfungen zum Fan-in ohne Verlust (BAUPLAN 40).
//
// Rot-vor-Grün: Vor diesem Bauschritt entschied lauf.js selbst über Ankommen
// und Verdrängen — es gab weder eine prüfbare Funktion noch ein Feld
// `verdraengt`. Beide Verdrängungs-Richtungen liefen ohne Spur: Der spätere
// nähere Vorfahre ersetzte die bisherige Liste, der frühere nähere schluckte
// den späteren entfernteren ganz ohne Zweig im Code. Die ersten drei Fälle
// unten schlugen damit fehl (`verdraengt` existierte nicht), der
// fuehrtZusammen-Fall gab die entferntere Lieferung gar nicht heraus.
import { describe, it, expect } from 'vitest'
import { uebergabenAuswahl, brauchtHerkunft } from '../src/shared/kettenRegeln.js'

// Ein Bauer braucht das Arbeitspaket und nimmt eine Angriffsliste mit, falls
// eine kommt — die Kombination, an der die Distanz-Regel hängt.
const bauer = { braucht: ['Arbeitspaket'], brauchtOptional: ['Angriffsliste'] }

function lieferung(name, nummer, naehe, liefert) {
  return { name, nummer, naehe, liefert, text: `Fazit von ${name} ${nummer}` }
}

describe('BAUPLAN 40 · Verdrängung wird sichtbar, statt still zu geschehen', () => {
  it('meldet den entfernteren Vorfahren, wenn der nähere später kommt', () => {
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('Angreifer', 2, 2, ['Angriffsliste']),
      lieferung('Angreifer', 3, 1, ['Angriffsliste'])
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Angriffsliste')
    expect(treffer.angekommen.map((l) => l.nummer)).toEqual([3])
    expect(treffer.verdraengt.map((l) => l.nummer)).toEqual([2])
  })

  it('meldet den entfernteren Vorfahren auch, wenn der nähere zuerst kommt', () => {
    // Genau der Fall ohne else-Zweig: Die zweite Lieferung fiel wortlos weg.
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('Angreifer', 3, 1, ['Angriffsliste']),
      lieferung('Angreifer', 2, 2, ['Angriffsliste'])
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Angriffsliste')
    expect(treffer.angekommen.map((l) => l.nummer)).toEqual([3])
    expect(treffer.verdraengt.map((l) => l.nummer)).toEqual([2])
  })

  it('verdrängt auch mehrere gleich nahe auf einmal — und nennt alle', () => {
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('Angreifer', 1, 2, ['Angriffsliste']),
      lieferung('Angreifer', 2, 2, ['Angriffsliste']),
      lieferung('Angreifer', 3, 1, ['Angriffsliste'])
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Angriffsliste')
    expect(treffer.angekommen.map((l) => l.nummer)).toEqual([3])
    expect(treffer.verdraengt.map((l) => l.nummer)).toEqual([1, 2])
  })

  it('meldet nichts für Etiketten, die dieser Block gar nicht braucht', () => {
    // Sonst tickerte FlowForge Verdrängungen, die den Block nichts angehen.
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('Prüfer', 1, 2, ['Prüfbeleg']),
      lieferung('Prüfer', 2, 1, ['Prüfbeleg'])
    ])
    expect(gruppen).toEqual([])
  })
})

describe('BAUPLAN 34 bleibt · gleich nahe Lieferungen kommen alle an', () => {
  it('führt zwei gleich nahe Angreifer zusammen, ohne zu verdrängen', () => {
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('Angreifer', 2, 1, ['Angriffsliste']),
      lieferung('Angreifer', 3, 1, ['Angriffsliste'])
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Angriffsliste')
    expect(treffer.angekommen).toHaveLength(2)
    expect(treffer.verdraengt).toEqual([])
  })

  it('reicht Pflicht- und optionalen Bedarf getrennt heraus', () => {
    const { gruppen } = uebergabenAuswahl(bauer, [
      lieferung('Paket schneiden', 1, 2, ['Arbeitspaket']),
      lieferung('Angreifer', 2, 1, ['Angriffsliste'])
    ])
    expect(gruppen.map((g) => g.etikett)).toEqual(['Arbeitspaket', 'Angriffsliste'])
  })
})

describe('BAUPLAN 40 · Blöcke, die zusammenführen, nehmen alles', () => {
  // Das Kennzeichen bekommt seine Katalog-Blöcke erst mit BAUPLAN 47; die
  // Mechanik gehört hierher, weil sie dieselbe Stelle betrifft.
  const integrator = { braucht: ['Umsetzungsbericht'], fuehrtZusammen: true }

  it('bekommt alle Lieferungen, unabhängig von der Distanz', () => {
    const { gruppen } = uebergabenAuswahl(integrator, [
      lieferung('Bauer', 2, 3, ['Umsetzungsbericht']),
      lieferung('Bauer', 3, 1, ['Umsetzungsbericht']),
      lieferung('Bauer', 4, 2, ['Umsetzungsbericht'])
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Umsetzungsbericht')
    expect(treffer.angekommen.map((l) => l.nummer)).toEqual([2, 3, 4])
    expect(treffer.verdraengt).toEqual([])
  })
})

describe('BAUPLAN 40 · Die braucht-Chips zeigen, was der Lauf wirklich tut', () => {
  // Zwei Angreifer hintereinander vor dem Bauer: verschiedene Distanz.
  // Zusatznamen seit BAUPLAN 43: Der Chip nennt den ANZEIGENAMEN — bis dahin
  // stand am Bauer zweimal derselbe „Angreifer" zur Auswahl, und man sah nicht,
  // welcher der beiden gewonnen hatte.
  const bloecke = [
    { instanzId: 'paket', blockId: 'paket-schneiden' },
    { instanzId: 'a1', blockId: 'angreifer', zusatz: 'weit' },
    { instanzId: 'a2', blockId: 'angreifer', zusatz: 'nah' },
    { instanzId: 'bauer', blockId: 'bauer' }
  ]
  const pfeile = [
    { von: 'paket', nach: 'a1' },
    { von: 'a1', nach: 'a2' },
    { von: 'a2', nach: 'bauer' }
  ]

  it('nennt nur den näheren Lieferanten — wie die Übergabe im Lauf', () => {
    const herkunft = brauchtHerkunft(bloecke, pfeile, 'bauer')
    expect(herkunft.get('Angriffsliste')).toEqual(['Angreifer · nah'])
    expect(herkunft.get('Arbeitspaket')).toEqual(['Paket schneiden'])
  })

  it('lässt ein Etikett ohne Lieferanten leer („fehlt")', () => {
    const herkunft = brauchtHerkunft(
      [{ instanzId: 'bauer', blockId: 'bauer' }],
      [],
      'bauer'
    )
    expect(herkunft.get('Arbeitspaket')).toEqual([])
    expect(herkunft.get('Angriffsliste')).toEqual([])
  })
})
