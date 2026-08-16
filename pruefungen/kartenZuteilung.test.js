// Prüfungen zur Karten-Zuteilung (BAUPLAN 29): die harten Leitplanken des
// Werkzeugs karten_zuteilen (nur Karten aus der Kartenauswahl, nur echte
// Nachfahren im Schaubild), das Freischalt-Muster am Werkzeugaufruf und die
// Kennzeichen im Blockkatalog.
//
// Adressierung je Blocknummer (BAUPLAN 44): Bis Bauschritt 43 adressierte der
// Agent über den Anzeigenamen, und ZWEI gleichnamige Instanzen bekamen beide
// dieselbe Zuteilung — die Prüfung „tragen mehrere Instanzen denselben Namen,
// bekommen alle die Zuteilung" zementierte genau das. Mit einem eigenen Paket
// je Ziel wäre das ein stiller Fehlschlag: Zwei Bauer ohne Zusatznamen sind
// über den Namen gar nicht auseinanderzuhalten. Seit 44 ist die Adresse die
// Blocknummer und trifft genau eine Instanz.
// Rot-vor-Grün: Vor dem Bauschritt kannte kartenZuteilungPruefen den Parameter
// `ziele` nicht (es erwartete eine Map Name → instanzIds) und lieferte auf jede
// Nummern-Adresse tz.unbekannteBloecke; die Fälle unten liefen nachweislich rot.
import { describe, it, expect } from 'vitest'
import { kartenZuteilungPruefen } from '../src/main/motor/kartenZuteilungWerkzeuge.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const tz = texte.agentenKartenZuteilung
const bezeichnung = (nummer, name) => texte.ticker.blockBezeichnung(nummer, name)
const karten = [
  { id: 's1', sorte: 'status', titel: 'Status', text: 'Wo stehen wir', erledigt: false },
  { id: 'a1', sorte: 'aufgabe', titel: 'Login bauen', text: 'Formular', erledigt: false },
  { id: 'a2', sorte: 'aufgabe', titel: 'Fehler beheben', text: 'Absturz', erledigt: false },
  { id: 'w1', sorte: 'wissen', titel: 'Aufbau', text: 'Electron-App', erledigt: false },
  { id: 'e1', sorte: 'entscheidung', titel: 'Farbwahl', text: 'Dunkel, weil …', erledigt: false }
]
const ausgewaehlt = ['a1', 'a2', 'w1']
// So baut lauf.js die Liste: je Nachfahre eine Zeile mit Blocknummer als Adresse.
const zielVon = (instanzId, nummer, name) => ({
  instanzId,
  nummer,
  name,
  adresse: String(nummer),
  bezeichnung: bezeichnung(nummer, name)
})
const ziele = [
  zielVon('i-bauer', 2, 'Bauer'),
  zielVon('i-pruefer', 3, 'Prüfer'),
  zielVon('i-ende', 4, 'Sessionende')
]

describe('BAUPLAN 44 · karten_zuteilen adressiert je Blocknummer genau eine Instanz', () => {
  it('weist fremde Adressen ab und nennt die gültigen', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: '9', kartenIds: ['a1'] }],
      karten,
      ausgewaehlt,
      ziele
    })
    expect(urteil.fehler).toBe(
      tz.unbekannteBloecke('9', ziele.map((z) => z.bezeichnung).join(' | '))
    )
  })
  it('weist Karten ab, die nicht zur Kartenauswahl des Laufs gehören', () => {
    // e1 existiert als Karte, ist aber nicht in der Auswahl — genauso
    // abgewiesen wie eine reine Fantasie-ID.
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: '2', kartenIds: ['a1', 'e1', 'x9'] }],
      karten,
      ausgewaehlt,
      ziele
    })
    expect(urteil.fehler).toBe(tz.fremdeKarten('e1, x9'))
  })
  it('filtert die Status-Karte still heraus — sie ist ohnehin immer dabei', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: '2', kartenIds: ['s1', 'a1'] }],
      karten,
      ausgewaehlt,
      ziele
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zuteilung).toEqual([['i-bauer', ['a1']]])
    // Bericht und Ticker nennen die Blocknummer (BAUPLAN 44): Zwei gleichnamige
    // Ziele ergaben vorher zwei identische Zeilen.
    expect(urteil.jeBlock).toEqual([{ block: bezeichnung(2, 'Bauer'), anzahl: 1 }])
  })
  it('liest die Adresse auch aus „Block 4 „Sessionende"" heraus', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: bezeichnung(4, 'Sessionende'), kartenIds: [] }],
      karten,
      ausgewaehlt,
      ziele
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zuteilung).toEqual([['i-ende', []]])
  })
  it('entfernt doppelte IDs; bei doppelt genannter Adresse gewinnt der letzte Eintrag', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [
        { block: '2', kartenIds: ['a1', 'a1', 'w1'] },
        { block: '2', kartenIds: ['a2'] }
      ],
      karten,
      ausgewaehlt,
      ziele
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zuteilung).toEqual([['i-bauer', ['a2']]])
  })
  it('zwei gleichnamige Bauer bekommen getrennte Zuteilungen — kein Auffächern mehr', () => {
    const gleichnamig = [zielVon('i-b1', 2, 'Bauer'), zielVon('i-b2', 3, 'Bauer')]
    const urteil = kartenZuteilungPruefen({
      zuteilung: [
        { block: '2', kartenIds: ['a1'] },
        { block: '3', kartenIds: ['a2'] }
      ],
      karten,
      ausgewaehlt,
      ziele: gleichnamig
    })
    expect(urteil.zuteilung).toEqual([
      ['i-b1', ['a1']],
      ['i-b2', ['a2']]
    ])
    // Und der genannte Name allein trifft keinen von beiden: Er ist mehrdeutig,
    // die Abweisung nennt die gültigen Adressen.
    expect(
      kartenZuteilungPruefen({
        zuteilung: [{ block: 'Bauer', kartenIds: ['a1'] }],
        karten,
        ausgewaehlt,
        ziele: gleichnamig
      }).fehler
    ).toBe(tz.unbekannteBloecke('Bauer', gleichnamig.map((z) => z.bezeichnung).join(' | ')))
  })
  it('weist eine leere Zuteilung und Blöcke ohne Nachfahren klar ab', () => {
    expect(kartenZuteilungPruefen({ zuteilung: [], karten, ausgewaehlt, ziele }).fehler).toBe(
      tz.leereZuteilung
    )
    expect(
      kartenZuteilungPruefen({
        zuteilung: [{ block: '2', kartenIds: ['a1'] }],
        karten,
        ausgewaehlt,
        ziele: []
      }).fehler
    ).toBe(tz.keineNachfolger)
  })
})

// Dasselbe Freischalt-Muster wie naechster_lauf_vorschlagen (BAUPLAN 28):
// rückfragefrei nur in Auftragsquellen-Blöcken, andere Blöcke lösen die
// übliche Rechte-Rückfrage aus.
describe('Freischalt-Muster am Werkzeugaufruf', () => {
  const werkzeug = 'mcp__zuteilung__karten_zuteilen'
  const projekt = 'D:\\pruefungen-uebungsprojekt'

  it('ohne Kennzeichen: Rückfrage nach dem üblichen Verfahren, kein hartes Nein', () => {
    const urteil = pruefeWerkzeug(werkzeug, {}, projekt, false, false)
    expect(urteil.gesperrt).toBeUndefined()
    expect(urteil.frage).toBe(texte.rechteFrage.kartenZuteilung)
  })
  it('mit Kennzeichen (Auftragsquelle): rückfragefrei erlaubt, auch unter „darf nur lesen"', () => {
    const urteil = pruefeWerkzeug(
      werkzeug, {}, projekt, true, false, true, false, false, false, false, true
    )
    expect(urteil.erlaubt).toBe(true)
  })
  it('Paket schneiden und Diagnose tragen das Kennzeichen kartenZuteilung — kein anderer Katalog-Block', () => {
    expect(blockDefinition('paket-schneiden').kartenZuteilung).toBe(true)
    expect(blockDefinition('diagnose').kartenZuteilung).toBe(true)
    for (const id of ['bauer', 'pruefer', 'angreifer', 'audit', 'karten-pruefer', 'sessionende'])
      expect(Boolean(blockDefinition(id).kartenZuteilung)).toBe(false)
  })
})
