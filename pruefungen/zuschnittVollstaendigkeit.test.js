// Prüfungen zur Vollständigkeit des Zuschnitts (BAUPLAN 44) in Alltagssprache:
// Nimmt „Paket schneiden" eine Aufgabe des gemeldeten Pakets nicht in seinen
// Zuschnitt auf, oder geht ein benanntes Ziel leer aus, fordert FlowForge
// sichtbar nach — genau einmal, und die Nachforderung nennt das Fehlende
// namentlich. Gemessen wird gegen das GEMELDETE Paket (paket_melden), nicht
// gegen die ganze Kartenauswahl, und über eine Rechnung (aufgabenIds) statt
// über einen Textvergleich.
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es zuschnittDeckung und budgetAusStand
// nicht (Import rot), aufgabenIds wurde nur auf Form und Anzahl geprüft — eine
// erfundene id lief glatt durch —, und die Deckung konnte niemand rechnen. Beim
// Nachbauen wurden zusätzlich einzelne Erwartungen verfälscht (z.B. „ein Paket
// ohne Adresse bedient auch zwei Ziele") und liefen dann rot.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  meldungPruefen,
  zuschnittDeckung,
  zuschnitteAusMeldungen
} from '../src/shared/lieferschein.js'
import { paketMeldungPruefen } from '../src/main/motor/kartenZuteilungWerkzeuge.js'
import { zielListe, budgetAusStand } from '../src/shared/kettenRegeln.js'
import { texte } from '../src/shared/texte.js'

const tl = texte.lieferschein
const rahmen = { fazit: 'Zugeschnitten.', getan: [], offen: [], anmerkung: '' }

// Georgs Alltagstest-Schaubild: zwei benannte Bauer hinter Paket schneiden.
const bloecke = [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '' },
  { instanzId: 'bu', blockId: 'bauer', zusatz: 'UI' },
  { instanzId: 'bm', blockId: 'bauer', zusatz: 'Motor' }
]
const pfeile = [
  { von: 'p', nach: 'bu' },
  { von: 'p', nach: 'bm' }
]
const ziele = zielListe(bloecke, pfeile, 'p')

// Das gemeldete Paket, wie paket_melden es liefert.
const paket = [
  { id: 'a1', titel: 'Oberfläche aufräumen' },
  { id: 'a2', titel: 'Motor entkoppeln' }
]

function meldung(pakete, umfeld = { ziele, paket }) {
  const ergebnis = meldungPruefen('arbeitspaket', { ...rahmen, pakete }, 'Arbeitspaket', umfeld)
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return ergebnis.meldung
}

function zuschnitt(zielBlock, ziel, aufgabenIds) {
  // Kurzname je Ziel (0.51.1): bei benanntem Ziel Pflicht.
  return { zielBlock, ziel, kurzname: ziel, fertigKriterien: ['Läuft grün.'], aufgabenIds }
}

describe('BAUPLAN 44 · Jede gemeldete Aufgabe muss in einem Zuschnitt vorkommen', () => {
  it('sieht ein vollständig geschnittenes Paket als gedeckt an', () => {
    const deckung = zuschnittDeckung(ziele, paket, [
      meldung([zuschnitt('2', 'Oberfläche', ['a1']), zuschnitt('3', 'Motor', ['a2'])])
    ])
    expect(deckung.fehlendeAufgaben).toEqual([])
    expect(deckung.unbedienteZiele).toEqual([])
  })

  it('nennt die übergangene Aufgabe namentlich — der Alltagstest dieses Schritts', () => {
    const deckung = zuschnittDeckung(ziele, paket, [
      meldung([zuschnitt('2', 'Oberfläche', ['a1']), zuschnitt('3', 'Motor', [])])
    ])
    expect(deckung.fehlendeAufgaben.map((a) => a.titel)).toEqual(['Motor entkoppeln'])
    // Und die Nachforderung an den Agenten sagt genau das, statt „irgendetwas
    // fehlt" — sonst wäre der zweite Anlauf eine Schnitzeljagd.
    const nachtrag = texte.agentenZuschnitt.nachforderung(['Motor entkoppeln'], [])
    expect(nachtrag).toContain('Motor entkoppeln')
    expect(texte.ticker.zuschnittNachgefordert('Paket schneiden', ['Motor entkoppeln'], [])).toContain(
      'Motor entkoppeln'
    )
  })

  // Karten-Index (BAUPLAN 53): Der Agent nimmt hier dieselben Kennungen, die
  // er im Verzeichnis gesehen hat — die Kurzform. Löst die Rechnung sie nicht
  // auf, weist sie eine vollkommen richtige Meldung als „erfundene id" ab.
  it('nimmt die Kurz-Kennung an und speichert die volle id im Zuschnitt', () => {
    const langesPaket = [
      { id: 'feedbeef-1111-4111-8111-111111111111', titel: 'Oberfläche aufräumen' }
    ]
    const gemeldet = meldung([zuschnitt('2', 'Oberfläche', ['feedbeef'])], {
      ziele,
      paket: langesPaket
    })
    expect(gemeldet.pakete[0].aufgabenIds).toEqual([langesPaket[0].id])
    expect(zuschnittDeckung(ziele, langesPaket, [gemeldet]).fehlendeAufgaben).toEqual([])
  })

  it('misst gegen das gemeldete Paket, nicht gegen die Zuschnitte — eine Rechnung, kein Textvergleich', () => {
    // Der Zuschnitt nennt eine Aufgabe, die gar nicht gemeldet wurde: Das ist
    // kein Deckungsfehler, aber es deckt auch nichts ab.
    const deckung = zuschnittDeckung(ziele, paket, [
      meldung([zuschnitt('2', 'Alles', ['a1', 'a2'])], { ziele, paket })
    ])
    expect(deckung.fehlendeAufgaben).toEqual([])
    expect(deckung.unbedienteZiele.map((z) => z.instanzId)).toEqual(['bm'])
  })
})

describe('BAUPLAN 44 · Jedes benannte Ziel braucht ein Paket', () => {
  it('meldet das leer ausgegangene Ziel mit seiner Blockbezeichnung', () => {
    const deckung = zuschnittDeckung(ziele, paket, [
      meldung([zuschnitt('2', 'Oberfläche', ['a1', 'a2'])])
    ])
    expect(deckung.unbedienteZiele.map((z) => z.bezeichnung)).toEqual([
      texte.ticker.blockBezeichnung(3, 'Bauer · Motor')
    ])
  })

  it('Rückfall ohne Bruch: bei genau EINEM Ziel bedient ein Paket ohne Adresse alles', () => {
    const einZiel = zielListe(
      [
        { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '' },
        { instanzId: 'b', blockId: 'bauer', zusatz: '' }
      ],
      [{ von: 'p', nach: 'b' }],
      'p'
    )
    expect(einZiel).toHaveLength(1)
    const ohneAdresse = meldung([{ ziel: 'Alles', fertigKriterien: ['Läuft.'], aufgabenIds: ['a1', 'a2'] }], {
      paket
    })
    const deckung = zuschnittDeckung(einZiel, paket, [ohneAdresse])
    expect(deckung.fehlendeAufgaben).toEqual([])
    expect(deckung.unbedienteZiele).toEqual([])
  })

  it('bei ZWEI Zielen ist ein Paket ohne Adresse genau das Problem — beide gelten als unbedient', () => {
    const ohneAdresse = meldung([{ ziel: 'Alles', fertigKriterien: ['Läuft.'], aufgabenIds: ['a1', 'a2'] }], {
      paket
    })
    const deckung = zuschnittDeckung(ziele, paket, [ohneAdresse])
    expect(deckung.unbedienteZiele.map((z) => z.instanzId)).toEqual(['bu', 'bm'])
  })

  it('ohne einen einzigen Zuschnitt prüft die Deckung gar nichts — das fängt die Meldungspflicht ab', () => {
    expect(zuschnittDeckung(ziele, paket, [])).toEqual({
      fehlendeAufgaben: [],
      unbedienteZiele: []
    })
    expect(zuschnitteAusMeldungen([])).toEqual([])
  })

  it('die ehrliche Grenze: ein Paket allein aus dem Feld hat keine Aufgaben zu decken', () => {
    // paketMeldungPruefen lässt aufgabenIds leer, wenn das Wunsch-/Fehlerbild-
    // Feld gefüllt ist — Georgs Normalfall. Dann bleibt nur die Zielabdeckung,
    // und der Ticker sagt das, statt eine nicht gelaufene Prüfung wie eine
    // bestandene aussehen zu lassen.
    const deckung = zuschnittDeckung(ziele, [], [
      meldung([zuschnitt('2', 'Oberfläche', []), zuschnitt('3', 'Motor', [])])
    ])
    expect(deckung.fehlendeAufgaben).toEqual([])
    expect(deckung.unbedienteZiele).toEqual([])
    expect(texte.ticker.paketOhneAufgaben(ziele[0].bezeichnung)).toContain(ziele[0].bezeichnung)
  })
})

describe('BAUPLAN 44 · Die Verbindung Zuschnitt → Aufgaben-Karte wird hart geprüft', () => {
  it('weist eine erfundene id ab und nennt die gültigen', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [zuschnitt('2', 'Oberfläche', ['a9'])] },
      'Arbeitspaket',
      { ziele, paket }
    )
    expect(ergebnis.fehler).toBe(
      tl.paketFehler(
        1,
        tl.aufgabeUnbekannt('a9', paket.map((a) => `${a.id} („${a.titel}")`).join(', '))
      )
    )
  })

  it('verlangt die Reihenfolge: erst paket_melden, dann der Zuschnitt', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [zuschnitt('2', 'Oberfläche', ['a1'])] },
      'Arbeitspaket',
      { ziele, paket: null }
    )
    expect(ergebnis.fehler).toBe(tl.paketFehler(1, tl.aufgabenIdsOhnePaket))
  })

  it('prüft nichts, wo der Lauf nichts weiß — Prüfskripte und selbstgebaute Wege', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [zuschnitt('', 'Irgendwas', ['frei-erfunden'])] },
      'Arbeitspaket'
    )
    expect(ergebnis.fehler).toBeUndefined()
  })
})

describe('BAUPLAN 44 · Eine verbrauchte Nachforderung übersteht den App-Neustart', () => {
  // Ohne diesen Weg gewährte jeder Neustart die Runde erneut — der Grundsatz
  // ist „lieber eine Nachforderung zu wenig als eine Endlosschleife".
  const kette = [
    { instanzId: 'p', def: { kartenZuteilung: true } },
    { instanzId: 'b', def: { kartenZuteilung: false } }
  ]

  it('liest die verbrauchten Kennungen aus dem Laufstand zurück', () => {
    expect(budgetAusStand(['p'], kette, (def) => def?.kartenZuteilung)).toEqual(['p'])
  })

  it('ohne Eintrag ist nichts verbraucht — ein frischer Lauf bekommt seine Runde', () => {
    expect(budgetAusStand(undefined, kette, (def) => def?.kartenZuteilung)).toEqual([])
  })

  it('ein Stand von vor Bauschritt 41 (ein blankes Ja) gilt vorsichtshalber für die betroffenen Blöcke', () => {
    expect(budgetAusStand(true, kette, (def) => def?.kartenZuteilung)).toEqual(['p'])
  })

  it('Kennungen, die es im heutigen Schaubild nicht mehr gibt, fallen heraus', () => {
    expect(budgetAusStand(['p', 'weg'], kette, () => true)).toEqual(['p'])
  })
})

// Rot vor Grün: aufgabenIds erbte die Listengrenze der übrigen Felder (20),
// während paket_melden beliebig viele Aufgaben annahm. Ein Paket mit 21
// gemeldeten Aufgaben war damit nicht mehr vollständig zuschneidbar — FlowForge
// forderte etwas nach, das der Agent gar nicht eintragen durfte, und warf ihm
// danach vor, er habe „den Zuschnitt nicht vervollständigt".
describe('BAUPLAN 44 · Beide Enden derselben Rechnung reichen gleich weit', () => {
  const einZiel = zielListe(
    [
      { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '' },
      { instanzId: 'b', blockId: 'bauer', zusatz: '' }
    ],
    [{ von: 'p', nach: 'b' }],
    'p'
  )
  const einundzwanzig = Array.from({ length: 21 }, (_, i) => ({
    id: `a${i + 1}`,
    titel: `Aufgabe ${i + 1}`
  }))

  it('schneidet ein Paket mit 21 Aufgaben vollständig — die alte Grenze lag bei 20', () => {
    const gemeldet = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          {
            zielBlock: einZiel[0].adresse,
            kurzname: 'Alles',
            ziel: 'Alles',
            fertigKriterien: ['Läuft grün.'],
            aufgabenIds: einundzwanzig.map((a) => a.id)
          }
        ]
      },
      'Arbeitspaket',
      { ziele: einZiel, paket: einundzwanzig }
    )
    expect(gemeldet.fehler).toBeUndefined()
    const deckung = zuschnittDeckung(einZiel, einundzwanzig, [gemeldet.meldung])
    expect(deckung.fehlendeAufgaben).toEqual([])
    expect(deckung.unbedienteZiele).toEqual([])
  })

  // 0.46.1 (Entscheidung Georg, 18.08.2026): keine Anzahl-Grenze mehr — an
  // KEINEM der beiden Enden. Rot vor Grün: Bis 0.46.0 wiesen paketMeldungPruefen
  // und der Zuschnitt 201 Kennungen ab (AUFGABEN_MAX = 200).
  it('nimmt 250 Aufgaben-Kennungen an beiden Enden an und rechnet die Deckung vollständig', () => {
    const viele = Array.from({ length: 250 }, (_, i) => `a${i + 1}`)
    const karten = viele.map((id) => ({ id, titel: id, sorte: 'aufgabe', erledigt: false }))
    const paketMeldung = paketMeldungPruefen({
      aufgabenIds: viele,
      karten,
      ausgewaehlt: viele,
      feldGefuellt: false
    })
    expect(paketMeldung.fehler).toBeUndefined()
    expect(paketMeldung.aufgaben).toHaveLength(250)
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          {
            zielBlock: einZiel[0].adresse,
            kurzname: 'Alles',
            ziel: 'Alles',
            fertigKriterien: ['Läuft.'],
            aufgabenIds: viele
          }
        ]
      },
      'Arbeitspaket',
      { ziele: einZiel, paket: paketMeldung.aufgaben }
    )
    expect(ergebnis.fehler).toBeUndefined()
    expect(ergebnis.meldung.pakete[0].aufgabenIds).toHaveLength(250)
    const deckung = zuschnittDeckung(einZiel, paketMeldung.aufgaben, [ergebnis.meldung])
    expect(deckung.fehlendeAufgaben).toEqual([])
    expect(deckung.unbedienteZiele).toEqual([])
  })
})

// Rot vor Grün: Die vier Ticker-Zeilen der Nachforderung nannten nur k.name.
// Zwei Auftragsquellen gleichen Namens ergaben im Laufbericht zwei Zeilen, die
// niemand auseinanderhalten konnte — genau der Mangel, den dieser Bauschritt
// für die Karten-Zuteilung behoben hat.
describe('BAUPLAN 44 · Die Nachforderung sagt, WELCHER Block nachgefordert wurde', () => {
  const quelle = fs.readFileSync('src/main/lauf.js', 'utf8')

  it('gibt allen vier Ticker-Zeilen die Blockbezeichnung statt des blanken Namens', () => {
    for (const zeile of [
      'paketNachgefordert',
      'paketFehltWeiter',
      'zuschnittNachgefordert',
      'zuschnittWeiterOhne'
    ]) {
      const treffer = quelle.match(new RegExp(`texte\\.ticker\\.${zeile}\\(([^,)]+)`))
      expect(treffer?.[1]).toBe('bezeichnung')
    }
  })

  it('und die Bezeichnung trägt die Blocknummer bis in den Laufbericht', () => {
    const bezeichnung = texte.ticker.blockBezeichnung(1, 'Paket schneiden')
    expect(texte.ticker.paketNachgefordert(bezeichnung)).toContain('Block 1')
    expect(texte.ticker.paketFehltWeiter(bezeichnung)).toContain('Block 1')
    expect(texte.ticker.zuschnittNachgefordert(bezeichnung, ['X'], [])).toContain('Block 1')
    expect(texte.ticker.zuschnittWeiterOhne(bezeichnung, ['X'], [])).toContain('Block 1')
  })
})
