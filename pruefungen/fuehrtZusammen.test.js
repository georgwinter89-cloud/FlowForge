// Prüfungen zum Integrator (BAUPLAN 47): das Kennzeichen `fuehrtZusammen` an
// Katalog- und eigenen Blöcken — und was es am Schaubild bedeutet.
//
// Ein Block, der zusammenführt, bekommt ALLE Lieferungen seiner
// braucht-Etiketten (bestand schon seit BAUPLAN 40). Neu ist die Steck-Prüfung
// „mindestens zwei": Für jedes Pflicht-Etikett müssen mindestens zwei
// VERSCHIEDENE Vorfahren es liefern — sonst „führt er zusammen", was nie
// geteilt war. Dazu kommen: der Integrator bekommt kein eigenes Arbeitspaket
// (zielListe), aber die adressierten Zuschnitte ALLER seiner Umsetzer-Vorfahren
// (zuschnittRouting, auch bei ungleicher Distanz), zwei Katalog-Blöcke und das
// Häkchen für eigene Blöcke.
//
// Nacharbeit nach Prüfer-Befund: Beim Zeichnen (pruefeSchaubild) genügt EIN
// Lieferant — sonst ließ sich das Schaubild in natürlicher Reihenfolge nicht
// stecken (jeder einzelne Pfeil war „nur einer"); der Start bleibt bei zwei.
// Und der Prüfer HINTER dem Integrator erbt dessen Zuschnitte.
//
// Rot-vor-Grün: Vor diesem Bauschritt kannte der Katalog keinen Block mit dem
// Kennzeichen (die Katalog-Fälle scheiterten an `blockDefinition(...) ==
// null`), brauchtFehler zählte nur „liefert es irgendwer" (der Fall „genau ein
// Lieferant" ging durch), zielListe nahm jeden Umsetzer (der Integrator wäre ein
// Ziel geworden), zuschnittRouting verengte auf den nächsten Vorfahren (bei
// ungleicher Distanz fiel ein Zuschnitt weg), und pruefeEigenenBlock warf das
// Feld still weg (Rundlauf ergab false). Jeder Fall hier lief gegen den alten
// Stand nachweislich rot.
import { describe, it, expect, afterEach } from 'vitest'
import {
  pruefeSchaubild,
  pruefeVersorgung,
  zielListe,
  zuschnittRouting,
  uebergabenAuswahl,
  brauchtHerkunft
} from '../src/shared/kettenRegeln.js'
import {
  BLOCK_KATALOG,
  blockDefinition,
  eigeneBloeckeSetzen
} from '../src/shared/blockKatalog.js'
import { pruefeEigenenBlock } from '../src/shared/blockRegeln.js'
import { werkzeugeFuerBlock } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const tk = texte.kette

// Georgs Alltagstest-Schaubild: Paket schneiden → Bauer · A → Integrator und
// Paket schneiden → Bauer · B → Integrator.
const bloecke = [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '' },
  { instanzId: 'ba', blockId: 'bauer', zusatz: 'A' },
  { instanzId: 'bb', blockId: 'bauer', zusatz: 'B' },
  { instanzId: 'i', blockId: 'integrator-code', zusatz: '' }
]
const pfeile = [
  { von: 'p', nach: 'ba' },
  { von: 'p', nach: 'bb' },
  { von: 'ba', nach: 'i' },
  { von: 'bb', nach: 'i' }
]

afterEach(() => eigeneBloeckeSetzen([]))

describe('BAUPLAN 47 · Katalog: zwei Integrator-Blöcke', () => {
  it('Integrator (Code) steht im Bereich Bauen mit den vereinbarten Feldern', () => {
    const def = blockDefinition('integrator-code')
    expect(def).toBeTruthy()
    expect(def.name).toBe('Integrator (Code)')
    expect(def.bereich).toBe('bauen')
    expect(def.modell).toBe('standard')
    expect(def.fuehrtZusammen).toBe(true)
    expect(def.nurLesen).toBe(false)
    expect(def.prueft).toBe(false)
    expect(def.braucht).toEqual(['Umsetzungsbericht'])
    expect(def.brauchtOptional).toEqual(['Arbeitspaket'])
    expect(def.liefert).toEqual(['Umsetzungsbericht'])
    expect(def.felder).toEqual([])
    expect(def.startanleitungPflicht).toBeFalsy()
    // brauchtWozu für Pflicht UND optionales Etikett — Empfängersicht.
    for (const etikett of ['Umsetzungsbericht', 'Arbeitspaket'])
      expect(typeof def.brauchtWozu[etikett], etikett).toBe('string')
    expect([...werkzeugeFuerBlock(def)]).toEqual(['melde_umsetzungsbericht'])
  })

  it('Integrator (Recherche) führt Projekt-Überblicke zusammen und meldet über den Rahmen', () => {
    const def = blockDefinition('integrator-recherche')
    expect(def).toBeTruthy()
    expect(def.name).toBe('Integrator (Recherche)')
    expect(def.bereich).toBe('bauen')
    expect(def.modell).toBe('sparsam')
    expect(def.fuehrtZusammen).toBe(true)
    expect(def.nurLesen).toBe(true)
    expect(def.prueft).toBe(false)
    expect(def.braucht).toEqual(['Projekt-Überblick'])
    expect(def.liefert).toEqual(['Projekt-Überblick'])
    expect(def.felder).toEqual([])
    expect(typeof def.brauchtWozu['Projekt-Überblick']).toBe('string')
    // Projekt-Überblick ist ein lockeres Etikett: Rahmen-Werkzeug melde_ergebnis.
    expect(werkzeugeFuerBlock(def).has('melde_ergebnis')).toBe(true)
  })

  it('beide liegen direkt hinter dem Bauer', () => {
    const ids = BLOCK_KATALOG.map((b) => b.id)
    const bauer = ids.indexOf('bauer')
    expect(ids[bauer + 1]).toBe('integrator-code')
    expect(ids[bauer + 2]).toBe('integrator-recherche')
  })

  it('Beschreibungen in Alltagssprache, höchstens 200 Zeichen', () => {
    for (const id of ['integrator-code', 'integrator-recherche']) {
      const def = blockDefinition(id)
      expect(def.beschreibung.length, id).toBeGreaterThan(20)
      expect(def.beschreibung.length, id).toBeLessThanOrEqual(200)
      expect(def.auftrag, id).toMatch(/Antworte auf Deutsch/)
    }
  })
})

describe('BAUPLAN 47 · Steck-Prüfung „mindestens zwei" am Schaubild', () => {
  it('lehnt ab, wenn niemand liefert — mit der Zusammenführ-Meldung (Anzahl 0)', () => {
    // Paket schneiden liefert kein Umsetzungsbericht: null Lieferanten.
    const b = [bloecke[0], bloecke[3]]
    const pf = [{ von: 'p', nach: 'i' }]
    const erwartet = tk.fehlerFuehrtZusammen('Integrator (Code)', 'Umsetzungsbericht', 0)
    expect(pruefeSchaubild(b, pf)).toBe(erwartet)
    expect(pruefeVersorgung(b, pf)).toBe(erwartet)
  })

  it('genau EINER liefert: der Start lehnt ab („bisher nur einer"), das Zeichnen nicht', () => {
    // Prüfer-Befund zu 47: Beim Zeichnen ist ein Lieferant ein erlaubter
    // Zwischenstand (der rote Chip sagt, was fehlt) — der Start bleibt scharf.
    const b = [bloecke[0], bloecke[1], bloecke[3]]
    const pf = [
      { von: 'p', nach: 'ba' },
      { von: 'ba', nach: 'i' }
    ]
    const erwartet = tk.fehlerFuehrtZusammen('Integrator (Code)', 'Umsetzungsbericht', 1)
    expect(pruefeSchaubild(b, pf)).toBeNull()
    expect(pruefeVersorgung(b, pf)).toBe(erwartet)
    // Und die Meldung ist die des Zusammenführens, nicht die alte „keiner liefert".
    expect(erwartet).not.toBe(tk.fehlerBraucht('Integrator (Code)', 'Umsetzungsbericht'))
  })

  it('lässt sich in natürlicher Reihenfolge stecken: p→A, p→B, A→I, dann B→I', () => {
    // Gegen den Stand vor der Nacharbeit rot: Nach A→I war das Schaubild
    // zusammenhängend und der Integrator hatte „nur einen" — der Pfeil
    // verschwand, B→I danach genauso; nur ein Umweg kam durch.
    const pf = [pfeile[0], pfeile[1], pfeile[2]]
    expect(pruefeSchaubild(bloecke, pf)).toBeNull()
    expect(pruefeVersorgung(bloecke, pf)).toBe(
      tk.fehlerFuehrtZusammen('Integrator (Code)', 'Umsetzungsbericht', 1)
    )
    expect(pruefeSchaubild(bloecke, pfeile)).toBeNull()
    expect(pruefeVersorgung(bloecke, pfeile)).toBeNull()
  })

  it('nimmt zwei Instanzen derselben Blocksorte als zwei Lieferanten', () => {
    expect(pruefeSchaubild(bloecke, pfeile)).toBeNull()
    expect(pruefeVersorgung(bloecke, pfeile)).toBeNull()
  })

  it('zählt DISTINKTE Vorfahren — zwei Pfeile vom selben Lieferanten sind einer', () => {
    // Bauer · A → Integrator direkt UND über einen Umweg: immer noch ein
    // Lieferant. (Zweiter Pfeil läuft über Paket schneiden → Integrator, der
    // kein Umsetzungsbericht liefert.)
    const b = [bloecke[0], bloecke[1], bloecke[3]]
    const pf = [
      { von: 'p', nach: 'ba' },
      { von: 'ba', nach: 'i' },
      { von: 'p', nach: 'i' }
    ]
    expect(pruefeVersorgung(b, pf)).toBe(
      tk.fehlerFuehrtZusammen('Integrator (Code)', 'Umsetzungsbericht', 1)
    )
  })

  it('transitive Vorfahren zählen mit — ein Integrator hinter einem Integrator ist gültig', () => {
    // Bewusst so: Der zweite Integrator sieht die Berichte beider Bauer UND
    // den des ersten Integrators (fuehrtZusammen nimmt alles) — es gibt also
    // wirklich etwas zusammenzuführen.
    const b = [...bloecke, { instanzId: 'i2', blockId: 'integrator-code', zusatz: 'zwei' }]
    const pf = [...pfeile, { von: 'i', nach: 'i2' }]
    expect(pruefeSchaubild(b, pf)).toBeNull()
    expect(pruefeVersorgung(b, pf)).toBeNull()
  })

  it('brauchtOptional zählt nicht — das Arbeitspaket darf von einem oder keinem kommen', () => {
    // Zwei Bauer ohne Paket schneiden: Sie haben keinen eingehenden Pfeil und
    // bleiben in pruefeSchaubild ausgenommen; der Integrator hat zwei
    // Berichte, aber null Arbeitspakete — kein Fehler.
    const b = [bloecke[1], bloecke[2], bloecke[3]]
    const pf = [
      { von: 'ba', nach: 'i' },
      { von: 'bb', nach: 'i' }
    ]
    expect(pruefeSchaubild(b, pf)).toBeNull()
  })

  it('normale Blöcke bleiben bei „mindestens einer" und der alten Meldung', () => {
    const b = [bloecke[0], bloecke[1]]
    expect(pruefeSchaubild(b, [{ von: 'p', nach: 'ba' }])).toBeNull()
    // Ein Bauer hinter einem Block, der kein Arbeitspaket liefert.
    const ohne = [
      { instanzId: 'k', blockId: 'kontext-laden' },
      { instanzId: 'b', blockId: 'bauer' }
    ]
    expect(pruefeSchaubild(ohne, [{ von: 'k', nach: 'b' }])).toBe(
      tk.fehlerBraucht('Bauer', 'Arbeitspaket')
    )
  })

  it('prüft im Schaubild erst, wenn alles zusammenhängt — Zwischenstände bleiben erlaubt', () => {
    // Integrator ganz ohne Lieferanten, aber eine unverbundene Karte daneben:
    // Beim Zeichnen kein Fehler, der Start prüft streng.
    const b = [bloecke[0], bloecke[3], { instanzId: 'lose', blockId: 'pruefer' }]
    const pf = [{ von: 'p', nach: 'i' }]
    expect(pruefeSchaubild(b, pf)).toBeNull()
    expect(pruefeVersorgung(b, pf)).toBe(
      tk.fehlerFuehrtZusammen('Integrator (Code)', 'Umsetzungsbericht', 0)
    )
  })

  it('gilt auch für eigene Blöcke mit dem Häkchen', () => {
    eigeneBloeckeSetzen([
      {
        id: 'eigen-sammler',
        name: 'Sammler',
        symbol: '🧺',
        beschreibung: '',
        auftrag: 'Sammle.',
        braucht: ['Umsetzungsbericht'],
        liefert: [],
        nurLesen: true,
        prueft: false,
        fuehrtZusammen: true,
        felder: [],
        eigen: true
      }
    ])
    const b = [bloecke[0], bloecke[1], { instanzId: 's', blockId: 'eigen-sammler' }]
    const pf = [
      { von: 'p', nach: 'ba' },
      { von: 'ba', nach: 's' }
    ]
    expect(pruefeVersorgung(b, pf)).toBe(tk.fehlerFuehrtZusammen('Sammler', 'Umsetzungsbericht', 1))
    expect(pruefeVersorgung([...b, bloecke[2]], [...pf, { von: 'p', nach: 'bb' }, { von: 'bb', nach: 's' }])).toBeNull()
  })
})

describe('BAUPLAN 47 · Der Integrator bekommt kein eigenes Paket, aber alle Zuschnitte', () => {
  it('zielListe nennt nur die Bauer, nicht den Integrator', () => {
    const ziele = zielListe(bloecke, pfeile, 'p')
    expect(ziele.map((z) => z.instanzId)).toEqual(['ba', 'bb'])
  })

  it('zuschnittRouting bringt bei ungleicher Distanz trotzdem beide Zuschnitte', () => {
    // Bauer · A → Prüfer → Integrator (Distanz 2) und Bauer · B → Integrator
    // (Distanz 1): Ohne die Ausnahme fiele Bauer · As Zuschnitt weg, und die
    // Dateilisten-Sperre träfe den Integrator genau an der Naht.
    const b = [...bloecke, { instanzId: 'pr', blockId: 'pruefer', zusatz: 'A' }]
    const pf = [
      { von: 'p', nach: 'ba' },
      { von: 'p', nach: 'bb' },
      { von: 'ba', nach: 'pr' },
      { von: 'pr', nach: 'i' },
      { von: 'bb', nach: 'i' }
    ]
    expect(zuschnittRouting(b, pf, 'i', ['ba', 'bb'])).toEqual(['ba', 'bb'])
    // Das Paket ohne Adresse kommt zusätzlich dazu.
    expect(zuschnittRouting(b, pf, 'i', ['ba', 'bb', ''])).toEqual(['ba', 'bb', ''])
    // Der Prüfer dahinter bekommt weiter nur das Paket SEINES Bauers.
    expect(zuschnittRouting(b, pf, 'pr', ['ba', 'bb'])).toEqual(['ba'])
  })

  it('der Prüfer HINTER dem Integrator erbt dessen Zuschnitte — derselbe Maßstab', () => {
    // Prüfer-Befund zu 47: Bauer · A → Prüfer · A → Integrator, Bauer · B →
    // Integrator, Integrator → Prüfer · Ende. Vorher bekam der End-Prüfer nur
    // ['bb'] und maß den Gesamtbericht an einem halben Maßstab.
    const b = [
      ...bloecke,
      { instanzId: 'pr', blockId: 'pruefer', zusatz: 'A' },
      { instanzId: 'prEnde', blockId: 'pruefer', zusatz: 'Ende' }
    ]
    const pf = [
      { von: 'p', nach: 'ba' },
      { von: 'p', nach: 'bb' },
      { von: 'ba', nach: 'pr' },
      { von: 'pr', nach: 'i' },
      { von: 'bb', nach: 'i' },
      { von: 'i', nach: 'prEnde' }
    ]
    expect(zuschnittRouting(b, pf, 'prEnde', ['ba', 'bb'])).toEqual(['ba', 'bb'])
    expect(zuschnittRouting(b, pf, 'prEnde', ['ba', 'bb', ''])).toEqual(['ba', 'bb', ''])
    // Prüfer · A: Der Integrator ist kein Vorfahr — er bleibt bei seinem Bauer.
    expect(zuschnittRouting(b, pf, 'pr', ['ba', 'bb'])).toEqual(['ba'])
  })

  it('ein näherer eigener Bauer schlägt einen ferneren Integrator; gleich nah erbt dazu', () => {
    // Gegenfall: Integrator → Bauer · C → Prüfer · X — C liegt näher, X bekommt nur C.
    const b = [
      ...bloecke,
      { instanzId: 'bc', blockId: 'bauer', zusatz: 'C' },
      { instanzId: 'px', blockId: 'pruefer', zusatz: 'X' }
    ]
    const pfFern = [...pfeile, { von: 'i', nach: 'bc' }, { von: 'bc', nach: 'px' }]
    expect(zuschnittRouting(b, pfFern, 'px', ['ba', 'bb', 'bc'])).toEqual(['bc'])
    // Gleich nah: Bauer · C → Prüfer · X und Integrator → Prüfer · X — C und das Erbe.
    const pfGleich = [
      ...pfeile,
      { von: 'p', nach: 'bc' },
      { von: 'bc', nach: 'px' },
      { von: 'i', nach: 'px' }
    ]
    expect(zuschnittRouting(b, pfGleich, 'px', ['ba', 'bb', 'bc'])).toEqual(['ba', 'bb', 'bc'])
  })

  it('zuschnittRouting bringt nur Zuschnitte von VORFAHREN — fremde Zweige nicht', () => {
    // Bauer · C hängt nicht vor dem Integrator: Sein Zuschnitt geht ihn nichts an.
    const b = [...bloecke, { instanzId: 'bc', blockId: 'bauer', zusatz: 'C' }]
    const pf = [...pfeile, { von: 'p', nach: 'bc' }]
    expect(zuschnittRouting(b, pf, 'i', ['ba', 'bb', 'bc'])).toEqual(['ba', 'bb'])
  })

  it('uebergabenAuswahl reicht dem Integrator alle drei Umsetzungsberichte', () => {
    const def = blockDefinition('integrator-code')
    const lieferung = (name, nummer, naehe) => ({
      name,
      nummer,
      naehe,
      liefert: ['Umsetzungsbericht'],
      text: `Bericht ${nummer}`
    })
    const { gruppen } = uebergabenAuswahl(def, [
      lieferung('Bauer · A', 2, 2),
      lieferung('Bauer · B', 3, 1),
      lieferung('Bauer · C', 4, 3)
    ])
    const treffer = gruppen.find((g) => g.etikett === 'Umsetzungsbericht')
    expect(treffer.angekommen.map((l) => l.nummer)).toEqual([2, 3, 4])
    expect(treffer.verdraengt).toEqual([])
  })

  it('die braucht-Chips nennen alle Lieferanten (Grundlage der Marke „zwei nötig")', () => {
    const herkunft = brauchtHerkunft(bloecke, pfeile, 'i')
    expect(herkunft.get('Umsetzungsbericht')).toEqual(['Bauer · A', 'Bauer · B'])
    const einer = brauchtHerkunft([bloecke[0], bloecke[1], bloecke[3]], [pfeile[0], pfeile[2]], 'i')
    expect(einer.get('Umsetzungsbericht')).toEqual(['Bauer · A'])
    // Der Chip-Text für „nur einer" ist vorhanden und nennt den Namen.
    expect(tk.kommtVonZuWenig(['Bauer · A'])).toContain('Bauer · A')
  })
})

describe('BAUPLAN 47 · Eigene Blöcke: Häkchen „führt zusammen"', () => {
  const roh = {
    name: 'Sammler',
    auftrag: 'Führe die Berichte zusammen.',
    braucht: ['Umsetzungsbericht'],
    liefert: ['Umsetzungsbericht'],
    nurLesen: false,
    fuehrtZusammen: true
  }

  it('überlebt den Rundlauf durch pruefeEigenenBlock', () => {
    const erste = pruefeEigenenBlock(roh)
    expect(erste.fehler).toBeUndefined()
    expect(erste.block.fuehrtZusammen).toBe(true)
    expect(pruefeEigenenBlock(erste.block).block.fuehrtZusammen).toBe(true)
  })

  it('ohne Häkchen (und bei Altbestand ohne Feld) ist es false — kein undefined', () => {
    expect(pruefeEigenenBlock({ ...roh, fuehrtZusammen: undefined }).block.fuehrtZusammen).toBe(false)
    expect(pruefeEigenenBlock({ ...roh, fuehrtZusammen: 'ja' }).block.fuehrtZusammen).toBe(true)
  })

  it('lehnt das Häkchen ohne ein einziges braucht-Etikett ab', () => {
    expect(pruefeEigenenBlock({ ...roh, braucht: [] }).fehler).toBe(
      texte.blockRegeln.fuehrtZusammenOhneBraucht
    )
    // Ohne Häkchen ist „kein braucht" weiterhin erlaubt.
    expect(pruefeEigenenBlock({ ...roh, braucht: [], fuehrtZusammen: false }).fehler).toBeUndefined()
  })
})
