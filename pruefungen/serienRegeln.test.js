// Serienlauf (Bauschritt 61) — die reinen Regeln: Was übernimmt eine Serie
// mechanisch aus dem Karten-Vorschlag des Sessionendes, und wann fehlt einer
// nächsten Runde die Auftragsquelle?
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es serienKartenAusVorschlag nicht —
// der Übernehmen-Knopf des Renderers zieht erledigte Karten bewusst mit herein
// (Georg sieht sie), eine Serie darf das NICHT: Der Startprüfer zählt nur
// offene Aufgaben, eine erledigte Karte in der Auswahl erzeugte einen
// Fehlstart mitten in der Nacht. Und die Auftragsquellen-Prüfung lebte als
// Schleife IN laufStarten — die Serie hätte am Ende einer erfolgreichen Runde
// keinen Weg gehabt, dieselbe Frage für die NÄCHSTE Runde zu stellen, ohne
// den Fehlstart erst zu produzieren.
import { describe, it, expect } from 'vitest'
import { serienKartenAusVorschlag } from '../src/main/naechsterLauf.js'
import { auftragsquelleFehlt } from '../src/shared/kettenRegeln.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'

const karten = [
  { id: 's1', sorte: 'status', titel: 'Stand', text: 'Wo stehen wir', erledigt: false },
  { id: 'a1', sorte: 'aufgabe', titel: 'Login bauen', text: 'Formular', erledigt: false },
  { id: 'a2', sorte: 'aufgabe', titel: 'Fehler beheben', text: 'Absturz', erledigt: false },
  { id: 'a3', sorte: 'aufgabe', titel: 'Alter Kram', text: 'Längst fertig', erledigt: true },
  { id: 'w1', sorte: 'wissen', titel: 'Aufbau', text: 'Electron-App', erledigt: false }
]

describe('Bauschritt 61 · serienKartenAusVorschlag — was die Serie übernimmt', () => {
  it('übernimmt offene Aufgaben mit IDs und Titeln in Vorschlags-Reihenfolge', () => {
    const ergebnis = serienKartenAusVorschlag({ kartenIds: ['a2', 'a1'] }, karten)
    expect(ergebnis).toEqual({ ids: ['a2', 'a1'], titel: ['Fehler beheben', 'Login bauen'] })
  })

  it('lässt erledigte Aufgaben heraus — anders als der Übernehmen-Knopf', () => {
    const ergebnis = serienKartenAusVorschlag({ kartenIds: ['a3', 'a1'] }, karten)
    expect(ergebnis).toEqual({ ids: ['a1'], titel: ['Login bauen'] })
  })

  it('lässt gelöschte Karten still heraus', () => {
    const ergebnis = serienKartenAusVorschlag({ kartenIds: ['geloescht', 'a2'] }, karten)
    expect(ergebnis).toEqual({ ids: ['a2'], titel: ['Fehler beheben'] })
  })

  it('übernimmt nur Aufgaben — Status und Wissen fallen heraus', () => {
    const ergebnis = serienKartenAusVorschlag({ kartenIds: ['s1', 'w1', 'a1'] }, karten)
    expect(ergebnis).toEqual({ ids: ['a1'], titel: ['Login bauen'] })
  })

  it('leeres Ergebnis heißt null — die Serie nimmt dann die normale Vorauswahl', () => {
    expect(serienKartenAusVorschlag({ kartenIds: [] }, karten)).toBeNull()
    expect(serienKartenAusVorschlag({ kartenIds: ['a3', 'geloescht'] }, karten)).toBeNull()
  })

  it('ungültiges roh heißt null — kaputte Datei, fremde Form, gar nichts', () => {
    expect(serienKartenAusVorschlag(null, karten)).toBeNull()
    expect(serienKartenAusVorschlag({}, karten)).toBeNull()
    expect(serienKartenAusVorschlag({ kartenIds: 'a1' }, karten)).toBeNull()
    expect(serienKartenAusVorschlag({ kartenIds: ['a1'] }, null)).toBeNull()
  })
})

// Die Auftragsquellen-Prüfung als reine Funktion — dieselbe, die laufStarten
// vor jedem Start durchsetzt (dort mit Fehlertext beim Aufrufer). Katalog-
// Blöcke als Prüfmaterial: 'diagnose' trägt das oderOffeneAufgaben-Feld,
// 'spaeher' keins, 'spec-interview' erzeugt selbst Aufgaben.
describe('Bauschritt 61 · auftragsquelleFehlt — die Vorabprüfung der nächsten Runde', () => {
  const defVon = (blockId) => blockDefinition(blockId)
  const diagnose = { instanzId: 'd', blockId: 'diagnose', feldWerte: {} }
  const fehlerbildLabel = blockDefinition('diagnose').felder.find(
    (f) => f.oderOffeneAufgaben
  ).label

  it('kein oderOffeneAufgaben-Feld in der Kette → null, auch ohne Aufgaben', () => {
    const kette = [{ instanzId: 's', blockId: 'spaeher', feldWerte: {} }]
    expect(
      auftragsquelleFehlt({ kette, bloecke: kette, pfeile: [], aufgabenIds: [], karten, defVon })
    ).toBeNull()
  })

  it('gefülltes Feld → null — der Block weiß auch ohne Karten, was zu tun ist', () => {
    const kette = [{ instanzId: 'd', blockId: 'diagnose', feldWerte: { fehlerbild: 'Absturz beim Start' } }]
    expect(
      auftragsquelleFehlt({ kette, bloecke: kette, pfeile: [], aufgabenIds: [], karten, defVon })
    ).toBeNull()
  })

  it('ein Aufgaben erzeugender Vorfahre → null — die Karten entstehen erst im Lauf', () => {
    const bloecke = [{ instanzId: 'i', blockId: 'spec-interview', feldWerte: { idee: 'App' } }, diagnose]
    expect(
      auftragsquelleFehlt({
        kette: bloecke,
        bloecke,
        pfeile: [{ von: 'i', nach: 'd' }],
        aufgabenIds: [],
        karten,
        defVon
      })
    ).toBeNull()
  })

  it('keine offene Aufgabe in der Auswahl → Fund mit Block und Feld-Label', () => {
    expect(
      auftragsquelleFehlt({
        kette: [diagnose],
        bloecke: [diagnose],
        pfeile: [],
        // In der Auswahl stehen nur eine erledigte Aufgabe und eine
        // Wissens-Karte — genau der Stand nach einer abgearbeiteten Serie.
        aufgabenIds: ['a3', 'w1'],
        karten,
        defVon
      })
    ).toEqual({ instanzId: 'd', feldLabel: fehlerbildLabel })
  })

  it('eine offene Aufgabe in der Auswahl → null', () => {
    expect(
      auftragsquelleFehlt({
        kette: [diagnose],
        bloecke: [diagnose],
        pfeile: [],
        aufgabenIds: ['a1'],
        karten,
        defVon
      })
    ).toBeNull()
  })
})
