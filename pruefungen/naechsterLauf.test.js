// Prüfungen zum Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): die harten
// Leitplanken des Werkzeugs naechster_lauf_vorschlagen, das Freischalt-Muster
// am Werkzeugaufruf und das stille Herausfallen gelöschter Karten beim Anzeigen.
import { describe, it, expect } from 'vitest'
import { laufVorschlagPruefen, EMPFEHLUNG_MAX } from '../src/main/motor/laufVorschlagWerkzeuge.js'
import { laufVorschlagAufloesen } from '../src/main/naechsterLauf.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const tl = texte.agentenLaufVorschlag
const karten = [
  { id: 's1', sorte: 'status', titel: 'Status', text: 'Wo stehen wir', erledigt: false },
  { id: 'a1', sorte: 'aufgabe', titel: 'Login bauen', text: 'Formular', erledigt: false },
  { id: 'a2', sorte: 'aufgabe', titel: 'Fehler beheben', text: 'Absturz', erledigt: false },
  { id: 'w1', sorte: 'wissen', titel: 'Aufbau', text: 'Electron-App', erledigt: false },
  { id: 'p1', sorte: 'pruefung', titel: 'Login geprüft', text: 'Hält', erledigt: false }
]

describe('Leitplanken von naechster_lauf_vorschlagen', () => {
  it('weist Fantasie-IDs mit klarer Meldung ab', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['a1', 'x9'],
      empfehlung: 'Weiter mit dem Login.',
      begruendung: 'Offen geblieben.',
      karten
    })
    expect(urteil.fehler).toBe(tl.unbekannteIds('x9'))
  })
  it('weist Prüfkarten ab — sie haben ihren eigenen Weg über den Prüfer', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['p1'],
      empfehlung: 'Weiter.',
      begruendung: '',
      karten
    })
    expect(urteil.fehler).toBe(tl.pruefkartenTabu)
  })
  it('filtert die Status-Karte still heraus — sie ist ohnehin immer dabei', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['s1', 'a1'],
      empfehlung: 'Weiter mit dem Login.',
      begruendung: 'Offen.',
      karten
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.kartenIds).toEqual(['a1'])
    expect(urteil.kartenTitel).toEqual(['Login bauen'])
  })
  it('verlangt eine gefüllte Empfehlung innerhalb der Längengrenze', () => {
    const leer = laufVorschlagPruefen({ kartenIds: ['a1'], empfehlung: '  ', karten })
    expect(leer.fehler).toBe(tl.empfehlungUngueltig(EMPFEHLUNG_MAX))
    const zuLang = laufVorschlagPruefen({
      kartenIds: ['a1'],
      empfehlung: 'x'.repeat(EMPFEHLUNG_MAX + 1),
      karten
    })
    expect(zuLang.fehler).toBe(tl.empfehlungUngueltig(EMPFEHLUNG_MAX))
  })
  it('entfernt doppelte IDs und lässt einen leeren Karten-Vorschlag zu', () => {
    const doppelt = laufVorschlagPruefen({
      kartenIds: ['a1', 'a1', 'a2'],
      empfehlung: 'Beide Aufgaben zusammen.',
      karten
    })
    expect(doppelt.ok).toBe(true)
    expect(doppelt.kartenIds).toEqual(['a1', 'a2'])
    const ohneKarten = laufVorschlagPruefen({
      kartenIds: [],
      empfehlung: 'Alles erledigt — als Nächstes ein Audit.',
      karten
    })
    expect(ohneKarten.ok).toBe(true)
    expect(ohneKarten.kartenIds).toEqual([])
  })
})

// Dasselbe Freischalt-Muster wie karte_vorschlagen (BAUPLAN 26): rückfragefrei
// nur im Sessionende, andere Blöcke lösen die übliche Rechte-Rückfrage aus.
describe('Freischalt-Muster am Werkzeugaufruf', () => {
  const werkzeug = 'mcp__naechsterlauf__naechster_lauf_vorschlagen'
  const projekt = 'D:\\pruefungen-uebungsprojekt'

  it('ohne Kennzeichen: Rückfrage nach dem üblichen Verfahren, kein hartes Nein', () => {
    const urteil = pruefeWerkzeug(werkzeug, {}, projekt, false, false)
    expect(urteil.gesperrt).toBeUndefined()
    expect(urteil.frage).toBe(texte.rechteFrage.laufVorschlag)
  })
  it('mit Kennzeichen (Sessionende): rückfragefrei erlaubt, auch unter „darf nur lesen"', () => {
    const urteil = pruefeWerkzeug(werkzeug, {}, projekt, true, false, true, false, false, false, true)
    expect(urteil.erlaubt).toBe(true)
  })
  it('das Sessionende trägt das Kennzeichen laufVorschlag — kein anderer Katalog-Block', () => {
    expect(blockDefinition('sessionende').laufVorschlag).toBe(true)
    for (const id of ['bauer', 'pruefer', 'audit', 'karten-pruefer', 'paket-schneiden'])
      expect(Boolean(blockDefinition(id).laufVorschlag)).toBe(false)
  })
})

describe('Anzeigen des gespeicherten Vorschlags', () => {
  it('gelöschte Karten fallen still heraus, die Empfehlung bleibt', () => {
    const roh = { empfehlung: 'Weiter mit dem Login.', kartenIds: ['a1', 'geloescht'] }
    const vorschlag = laufVorschlagAufloesen(roh, karten)
    expect(vorschlag.empfehlung).toBe('Weiter mit dem Login.')
    expect(vorschlag.karten).toEqual([{ id: 'a1', sorte: 'aufgabe', titel: 'Login bauen' }])
  })
  it('eine kaputte oder fremde Datei ergibt keinen Vorschlag', () => {
    expect(laufVorschlagAufloesen(null, karten)).toBeNull()
    expect(laufVorschlagAufloesen({ empfehlung: 42, kartenIds: [] }, karten)).toBeNull()
    expect(laufVorschlagAufloesen({ empfehlung: 'ok' }, karten)).toBeNull()
  })
})
