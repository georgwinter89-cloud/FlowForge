// Prüfungen zur Karten-Zuteilung (BAUPLAN 29): die harten Leitplanken des
// Werkzeugs karten_zuteilen (nur Karten aus der Kartenauswahl, nur echte
// Nachfahren im Schaubild), das Freischalt-Muster am Werkzeugaufruf und die
// Kennzeichen im Blockkatalog.
import { describe, it, expect } from 'vitest'
import { kartenZuteilungPruefen } from '../src/main/motor/kartenZuteilungWerkzeuge.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const tz = texte.agentenKartenZuteilung
const karten = [
  { id: 's1', sorte: 'status', titel: 'Status', text: 'Wo stehen wir', erledigt: false },
  { id: 'a1', sorte: 'aufgabe', titel: 'Login bauen', text: 'Formular', erledigt: false },
  { id: 'a2', sorte: 'aufgabe', titel: 'Fehler beheben', text: 'Absturz', erledigt: false },
  { id: 'w1', sorte: 'wissen', titel: 'Aufbau', text: 'Electron-App', erledigt: false },
  { id: 'e1', sorte: 'entscheidung', titel: 'Farbwahl', text: 'Dunkel, weil …', erledigt: false }
]
const ausgewaehlt = ['a1', 'a2', 'w1']
const nachfolger = new Map([
  ['Bauer', ['i-bauer']],
  ['Prüfer', ['i-pruefer']],
  ['Sessionende', ['i-ende']]
])

describe('Leitplanken von karten_zuteilen', () => {
  it('weist fremde Blocknamen ab und nennt die gültigen', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: 'Angreifer', kartenIds: ['a1'] }],
      karten,
      ausgewaehlt,
      nachfolger
    })
    expect(urteil.fehler).toBe(
      tz.unbekannteBloecke('Angreifer', 'Bauer, Prüfer, Sessionende')
    )
  })
  it('weist Karten ab, die nicht zur Kartenauswahl des Laufs gehören', () => {
    // e1 existiert als Karte, ist aber nicht in der Auswahl — genauso
    // abgewiesen wie eine reine Fantasie-ID.
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: 'Bauer', kartenIds: ['a1', 'e1', 'x9'] }],
      karten,
      ausgewaehlt,
      nachfolger
    })
    expect(urteil.fehler).toBe(tz.fremdeKarten('e1, x9'))
  })
  it('filtert die Status-Karte still heraus — sie ist ohnehin immer dabei', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: 'Bauer', kartenIds: ['s1', 'a1'] }],
      karten,
      ausgewaehlt,
      nachfolger
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zuteilung).toEqual([['i-bauer', ['a1']]])
    expect(urteil.jeBlock).toEqual([{ block: 'Bauer', anzahl: 1 }])
  })
  it('erlaubt eine leere Kartenliste — der Block bekommt nur die Status-Karte', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: 'Sessionende', kartenIds: [] }],
      karten,
      ausgewaehlt,
      nachfolger
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zuteilung).toEqual([['i-ende', []]])
  })
  it('entfernt doppelte IDs; beim doppelt genannten Block gewinnt der letzte Eintrag', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [
        { block: 'Bauer', kartenIds: ['a1', 'a1', 'w1'] },
        { block: 'Bauer', kartenIds: ['a2'] }
      ],
      karten,
      ausgewaehlt,
      nachfolger
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zuteilung).toEqual([['i-bauer', ['a2']]])
  })
  it('tragen mehrere Instanzen denselben Namen, bekommen alle die Zuteilung', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: 'Bauer', kartenIds: ['a1'] }],
      karten,
      ausgewaehlt,
      nachfolger: new Map([['Bauer', ['i-b1', 'i-b2']]])
    })
    expect(urteil.zuteilung).toEqual([
      ['i-b1', ['a1']],
      ['i-b2', ['a1']]
    ])
  })
  it('weist eine leere Zuteilung und Blöcke ohne Nachfahren klar ab', () => {
    expect(
      kartenZuteilungPruefen({ zuteilung: [], karten, ausgewaehlt, nachfolger }).fehler
    ).toBe(tz.leereZuteilung)
    expect(
      kartenZuteilungPruefen({
        zuteilung: [{ block: 'Bauer', kartenIds: ['a1'] }],
        karten,
        ausgewaehlt,
        nachfolger: new Map()
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
