// Anker gegen das Kreisen (BAUPLAN 62): die drei Leitplanken, die verhindern,
// dass ein Serienlauf sich von seinem eigenen Auswurf ernährt — Ziel-Karte
// samt Zielstand, Frischware-Nachrang und Eigenpflege-Deckel.
//
// Gemessen an zehn echten Serienrunden (Testprojekt Haushaltsplaner,
// 27./28.08.2026): 109 neue Karten, 94 abgehakt, offen blieben konstant ~15;
// fünf von sechs vorgeschlagenen Karten waren Minuten alt; 49 der 109 Karten
// betrafen FlowForges eigenen Apparat statt das Projekt.
//
// Rot-vor-Grün: Vor diesem Bauschritt kannte laufVorschlagPruefen weder
// laufStart noch zielstand — jede der drei Ablehnungen unten kam nicht
// zustande, und ein Vorschlag aus lauter frischer Eigenpflege ging glatt durch.
import { describe, it, expect } from 'vitest'
import {
  laufVorschlagPruefen,
  ZIELSTAND_MAX,
  EIGENPFLEGE_HOECHSTENS
} from '../src/main/motor/laufVorschlagWerkzeuge.js'
import { istEigenpflege, EINMAL_SORTEN, SORTEN } from '../src/shared/kartenRegeln.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const tl = texte.agentenLaufVorschlag
const LAUF_START = '2026-08-28T15:00:00.000Z'

// Ein Bestand, wie ihn eine späte Serienrunde hinterlässt: eine alte offene
// Aufgabe, ein frischer Fund dieses Laufs und zwei Karten über FlowForges
// eigenen Apparat.
const zielKarte = (text) => ({ id: 'z1', sorte: 'ziel', titel: 'Projektziel', text })
const alt = {
  id: 'alt1',
  sorte: 'aufgabe',
  erledigt: false,
  titel: 'Doppelte Mitglieder-Kennungen entzerren',
  text: 'Zwei Personen, ein Ziel — Häkchen landen bei der falschen Person.',
  angelegtAm: '2026-08-25T17:38:00.000Z'
}
const frisch = {
  id: 'neu1',
  sorte: 'aufgabe',
  erledigt: false,
  titel: 'Anzeige härten',
  text: 'Ein Mitglied ohne Namen zeigt undefined.',
  angelegtAm: '2026-08-28T16:47:00.000Z'
}
const eigenpflege1 = {
  id: 'ep1',
  sorte: 'aufgabe',
  erledigt: false,
  titel: 'Prüfmappe pruefkarte-144d20c9 ist rot',
  text: 'Ihre Attrappe ist überholt.',
  angelegtAm: '2026-08-28T15:03:00.000Z'
}
const eigenpflege2 = {
  id: 'ep2',
  sorte: 'aufgabe',
  erledigt: false,
  titel: 'arbeitsablage leeren',
  text: 'Wegwerf-Reste mehrerer Läufe liegen noch drin.',
  angelegtAm: '2026-08-28T15:09:00.000Z'
}
const bestand = (ziel) => [zielKarte(ziel), alt, frisch, eigenpflege1, eigenpflege2]
const ZIEL = 'Georg und Kathi sehen denselben Wochenplan auf beiden Geräten.'
const gueltig = {
  empfehlung: 'Als Nächstes die doppelten Kennungen entzerren.',
  begruendung: 'Der letzte Fund, der echte Nutzerdaten verfälscht.',
  zielstand: 'Der gemeinsame Plan steht; die Anzeige auf dem Handy fehlt noch.'
}

describe('BAUPLAN 62 · Ziel-Karte: die neue Sorte und ihre Sonderstellung', () => {
  it('kennt die Sorte ziel und führt sie als Einmal-Sorte neben status', () => {
    expect(SORTEN).toContain('ziel')
    expect(EINMAL_SORTEN).toEqual(['status', 'ziel'])
  })
})

describe('BAUPLAN 62 · Zielstand ist Pflicht, sobald ein Ziel gesetzt ist', () => {
  it('weist einen Vorschlag ohne zielstand ab', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['alt1'],
      empfehlung: gueltig.empfehlung,
      begruendung: gueltig.begruendung,
      karten: bestand(ZIEL)
    })
    expect(urteil.fehler).toBe(tl.zielstandFehlt(ZIELSTAND_MAX))
  })
  it('lässt ihn durch, wenn das Projektziel noch der unveränderte Starttext ist', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['alt1'],
      empfehlung: gueltig.empfehlung,
      begruendung: gueltig.begruendung,
      karten: bestand(texte.zielKarte.startText)
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zielstand).toBe('')
  })
  it('schluckt zielErreicht nicht, wenn es gar kein Ziel gibt', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['alt1'],
      ...gueltig,
      zielErreicht: true,
      karten: bestand(texte.zielKarte.startText)
    })
    expect(urteil.zielErreicht).toBe(false)
  })
  it('reicht zielErreicht durch, wenn ein Ziel gesetzt ist', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['alt1'],
      ...gueltig,
      zielErreicht: true,
      karten: bestand(ZIEL)
    })
    expect(urteil.zielErreicht).toBe(true)
  })
  it('weist einen zu langen zielstand ab', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['alt1'],
      ...gueltig,
      zielstand: 'x'.repeat(ZIELSTAND_MAX + 1),
      karten: bestand(ZIEL)
    })
    expect(urteil.fehler).toBe(tl.zielstandZuLang(ZIELSTAND_MAX))
  })
})

describe('BAUPLAN 62 · Frischware kommt nach den älteren offenen Aufgaben', () => {
  it('weist frische Karten ab, solange ältere offene liegen bleiben', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['neu1'],
      ...gueltig,
      karten: bestand(ZIEL),
      laufStart: LAUF_START
    })
    expect(urteil.fehler).toBe(tl.frischOhneBegruendung('„' + alt.titel + '"'))
  })
  it('lässt sie durch, wenn der Agent begründet, warum sie nicht warten können', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['neu1'],
      ...gueltig,
      frischBegruendung: 'Das undefined steht sichtbar in der Oberfläche.',
      karten: bestand(ZIEL),
      laufStart: LAUF_START
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.frischBegruendung).toContain('undefined')
  })
  it('lässt sie durch, wenn die ältere Karte selbst im Vorschlag steht', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['alt1', 'neu1'],
      ...gueltig,
      karten: bestand(ZIEL),
      laufStart: LAUF_START
    })
    expect(urteil.ok).toBe(true)
  })
  it('greift nicht ohne laufStart — alte Aufrufer bleiben unberührt', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['neu1'],
      ...gueltig,
      karten: bestand(ZIEL)
    })
    expect(urteil.ok).toBe(true)
  })
})

describe('BAUPLAN 62 · Eigenpflege-Deckel', () => {
  it('erkennt FlowForges eigene Orte, aber keine Produktarbeit', () => {
    expect(istEigenpflege(eigenpflege1)).toBe(true)
    expect(istEigenpflege(eigenpflege2)).toBe(true)
    expect(istEigenpflege(alt)).toBe(false)
    expect(istEigenpflege(frisch)).toBe(false)
  })
  it('weist mehr als eine Eigenpflege-Karte je Vorschlag ab, statt still zu kürzen', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['ep1', 'ep2'],
      ...gueltig,
      frischBegruendung: 'Beide Prüfmappen sind seit gestern rot.',
      karten: bestand(ZIEL),
      laufStart: LAUF_START
    })
    expect(urteil.fehler).toBe(tl.eigenpflegeDeckel(2, EIGENPFLEGE_HOECHSTENS))
  })
  it('lässt genau eine zusammen mit echter Projektarbeit durch', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: ['alt1', 'ep1'],
      ...gueltig,
      karten: bestand(ZIEL),
      laufStart: LAUF_START
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.kartenIds).toEqual(['alt1', 'ep1'])
  })
})

describe('BAUPLAN 62 · Die Vorlage aus der Feldbeschreibung ist raus', () => {
  it('nennt sie im Sessionende-Auftrag nicht mehr, dafür die neuen Felder', () => {
    const auftrag = blockDefinition('sessionende').auftrag
    // In 6 von 10 gemessenen Runden stand genau dieser Beispielsatz wörtlich
    // in der Empfehlung — das Beispiel war zur Gewohnheit geworden.
    expect(auftrag).not.toContain('Bug jagen')
    expect(auftrag).toContain('zielstand')
    expect(auftrag).toContain('frischBegruendung')
  })
})
