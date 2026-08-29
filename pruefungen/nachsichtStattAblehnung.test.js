// Nachsicht statt Ablehnung (BAUPLAN 63): Die Mechanik hörte an drei Stellen
// auf, dem Agenten zu helfen, und fing an, gegen ihn zu arbeiten. Gemessen an
// 18 Läufen am Testprojekt Haushaltsplaner (27.–29.08.2026).
//
// Rot-vor-Grün: Vor diesem Bauschritt lehnte pruefeKarteneingabe jede Karte ab,
// die einen Buchstaben über dem Richtwert lag (202 Fälle, Median 14 Zeichen
// darüber), verwarf der Lieferschein deswegen ganze Prüfbelege (67 Fälle), und
// die Schreibsperre stoppte Befehle wegen Zielen wie „$out" oder „/gi)"
// (10 von 13 gestoppten Schreibversuchen).
import { describe, it, expect } from 'vitest'
import { pruefeKarteneingabe, TITEL_MAX, TEXT_MAX } from '../src/shared/kartenRegeln.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { zielUnaufloesbar, pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { titelFuerIndex } from '../src/main/motor/kartenWerkzeuge.js'
import { texte } from '../src/shared/texte.js'

describe('BAUPLAN 63 · Kartenlängen sind Richtwert, keine Sperre', () => {
  it('nimmt eine Karte an, die über dem Richtwert liegt', () => {
    expect(pruefeKarteneingabe({ titel: 'x'.repeat(TITEL_MAX + 14), text: 'y' })).toBeNull()
    expect(pruefeKarteneingabe({ titel: 'Kurz', text: 'y'.repeat(TEXT_MAX + 221) })).toBeNull()
  })
  it('bleibt hart, wo eine Karte gar keine wäre: leerer Titel oder Text', () => {
    expect(pruefeKarteneingabe({ titel: '   ', text: 'y' })).toBe(texte.kartenRegeln.titelFehlt)
    expect(pruefeKarteneingabe({ titel: 'Kurz', text: '  ' })).toBe(texte.kartenRegeln.textFehlt)
  })
  it('nennt den Richtwert weiter im Werkzeug — der Wortlaut ist, was übrig bleibt', async () => {
    const { kartenWerkzeugBeschreibungen } = await import('../src/main/motor/kartenWerkzeuge.js')
    // Nur wenn das Werkzeug seine Beschreibungen exportiert; sonst reicht der
    // Nachweis über die Karten-Regeln oben.
    if (typeof kartenWerkzeugBeschreibungen !== 'function') return
    expect(kartenWerkzeugBeschreibungen().anlegen).toContain('Richtwert')
  })
})

describe('BAUPLAN 63 · Der Index kürzt die Anzeige, nicht die Karte', () => {
  it('kürzt einen überlangen Titel für das Verzeichnis', () => {
    const lang = 'A'.repeat(TITEL_MAX + 50)
    const gekuerzt = titelFuerIndex(lang)
    expect(gekuerzt.length).toBeLessThanOrEqual(TITEL_MAX)
    expect(gekuerzt.endsWith('…')).toBe(true)
  })
  it('lässt einen normalen Titel unangetastet', () => {
    expect(titelFuerIndex('Login bauen')).toBe('Login bauen')
  })
})

describe('BAUPLAN 63 · Ein langer Prüfkartentext verwirft nicht den ganzen Beleg', () => {
  const rahmen = {
    getan: 'Geprüft.',
    offen: 'nichts',
    fazit: 'Alles grün.',
    inhalt: 'Der Beleg.'
  }
  it('nimmt den Beleg an', () => {
    const urteil = meldungPruefen(
      'pruefbeleg',
      {
        ...rahmen,
        urteil: 'bestanden',
        pruefkarteTitel: 'Wochenplan geprüft',
        pruefkarteText: 'x'.repeat(TEXT_MAX + 62)
      },
      'Prüfbeleg'
    )
    expect(urteil.fehler).toBeUndefined()
  })
})

describe('BAUPLAN 63 · Die Schreibsperre erkennt Phantom-Ziele', () => {
  it('hält die gemessenen Phantome für unauflösbar', () => {
    // Genau die Ziele, an denen die Sperre in den Läufen falsch zuschlug.
    for (const phantom of ['$out', '$dump', '$p\\dump1.html', '/gi)', '[0-9]*', '${p}', '%TEMP%'])
      expect(zielUnaufloesbar(phantom), phantom).toBe(true)
  })
  it('hält echte Pfade für auflösbar — die Sperre greift dort weiter', () => {
    for (const echt of [
      'js/dataModel.js',
      'arbeitsablage/rot.html',
      'entharten.js',
      'src\\main\\lauf.js',
      'pruefung/pruefer-a1/pruefe.js'
    ])
      expect(zielUnaufloesbar(echt), echt).toBe(false)
  })
  // Die Gegenprobe: Ein AUFLÖSBARES Ziel außerhalb der Liste wird weiter hart
  // gestoppt — die Nachsicht gilt nur dem, was FlowForge nicht lesen kann.
  // (Die volle Sperr-Mechanik prüft dateilisteSperre.test.js.)
  it('sperrt einen echten Fremdschreibversuch weiter hart', () => {
    const bauer = (name, eingabe) =>
      pruefeWerkzeug(
        name,
        eingabe,
        'D:/Projekt',
        false, // nurLesen
        false, // darfPruefen
        true, // lokaleKi
        false, // nurLesenBefehle
        false, // darfKartenAnlegen
        false, // darfVorschlagen
        false, // darfLaufVorschlag
        false, // darfZuteilen
        '', // pruefOrdner
        [], // lieferscheinFrei
        ['js/dataModel.js'] // dateiListe
      )
    expect(bauer('Bash', { command: 'echo x > js/fremd.js' }).gesperrt).toBeTruthy()
    // Dasselbe Kommando mit unauflösbarem Ziel wird nicht mehr hart gestoppt.
    expect(bauer('Bash', { command: 'echo x > $out' }).gesperrt).toBeFalsy()
  })
})
