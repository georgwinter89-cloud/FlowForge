// Prüfungen zu den Metriken (BAUPLAN 31): Metrik-Datei der lokalen KI
// (Anhänge-Format, kaputte Zeilen), Extrakt je Laufbericht (Erstlauf vs.
// Wiederholung, ehrliche Lücken) und die Schnitte des Motors.
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  laufExtraktAusBericht,
  lokaleKiAuswerten,
  motorAuswerten,
  urteilPruefen,
  wocheVon
} from '../src/shared/metrikRegeln.js'
import { metrikUrteilSchreiben, metrikUrteileLesen } from '../src/main/metriken.js'

const datei = path.join(app.getPath('userData'), 'metriken', 'lokale-ki.jsonl')

describe('Metrik-Datei der lokalen KI', () => {
  beforeEach(() => {
    fs.rmSync(datei, { force: true })
  })
  it('hängt Urteile an und liest sie wieder', () => {
    expect(
      metrikUrteilSchreiben({
        projektPfad: 'C:\\P',
        laufId: 'l1',
        block: 'Bauer',
        modell: 'qwen2.5:7b',
        bereich: 'recherche',
        ausgang: 'uebernommen',
        schritte: 4
      })
    ).toBe(true)
    metrikUrteilSchreiben({
      projektPfad: 'C:\\P',
      laufId: 'l1',
      block: 'Bauer',
      modell: 'qwen2.5:7b',
      bereich: 'bauen',
      ausgang: 'nicht-gehalten',
      schritte: 9
    })
    const urteile = metrikUrteileLesen()
    expect(urteile).toHaveLength(2)
    expect(urteile[0]).toMatchObject({ bereich: 'recherche', ausgang: 'uebernommen', schritte: 4 })
    expect(urteile[1]).toMatchObject({ bereich: 'bauen', ausgang: 'nicht-gehalten', modell: 'qwen2.5:7b' })
    // Anhänge-Format: zwei Zeilen, keine Umschreibung der Datei.
    expect(fs.readFileSync(datei, 'utf8').trim().split('\n')).toHaveLength(2)
  })
  it('weist unbekannte Bereiche/Ausgänge ab und überspringt kaputte Zeilen', () => {
    expect(
      metrikUrteilSchreiben({ projektPfad: 'C:\\P', laufId: 'l', bereich: 'zauber', ausgang: 'uebernommen' })
    ).toBe(false)
    metrikUrteilSchreiben({ projektPfad: 'C:\\P', laufId: 'l', modell: 'm', bereich: 'entwurf', ausgang: 'verworfen' })
    fs.appendFileSync(datei, '{halbe Zeile', 'utf8')
    metrikUrteilSchreiben({ projektPfad: 'C:\\P', laufId: 'l', modell: 'm', bereich: 'reparatur', ausgang: 'gehalten' })
    // Die halbe Zeile hat keinen Zeilenumbruch — sie klebt am nächsten Eintrag;
    // genau dieser Fall (Absturz mitten im Schreiben) darf höchstens einen
    // Eintrag kosten, nie die Datei.
    const urteile = metrikUrteileLesen()
    expect(urteile.length).toBeGreaterThanOrEqual(1)
    expect(urteile[0]).toMatchObject({ bereich: 'entwurf', ausgang: 'verworfen', schritte: 0 })
  })
  it('urteilPruefen normalisiert Modell und Schritte', () => {
    expect(
      urteilPruefen({ zeit: '2026-08-15T10:00:00.000Z', bereich: 'bauen', ausgang: 'gehalten', schritte: '3.6' })
    ).toMatchObject({ modell: '?', schritte: 4 })
    expect(urteilPruefen({ zeit: 'gestern', bereich: 'bauen', ausgang: 'gehalten' })).toBeNull()
  })
})

describe('Lokale KI: Tabelle Modell × Bereich', () => {
  it('rechnet Quote nur über beurteilte, gescheiterte gesondert', () => {
    const u = (modell, bereich, ausgang, schritte, zeit = '2026-08-15T10:00:00.000Z') =>
      urteilPruefen({ zeit, modell, bereich, ausgang, schritte })
    const { zeilen, anzahl } = lokaleKiAuswerten([
      u('a', 'recherche', 'uebernommen', 4, '2026-08-14T09:00:00.000Z'),
      u('a', 'recherche', 'verworfen', 6),
      u('a', 'recherche', 'gescheitert', 2, '2026-08-16T09:00:00.000Z'),
      u('a', 'bauen', 'gehalten', 10),
      u('b', 'recherche', 'uebernommen', 1)
    ])
    expect(anzahl).toBe(5)
    expect(zeilen.map((z) => `${z.modell}/${z.bereich}`)).toEqual(['a/recherche', 'a/bauen', 'b/recherche'])
    const aR = zeilen[0]
    expect(aR).toMatchObject({ anzahl: 3, positiv: 1, negativ: 1, gescheitert: 1, schritte: 12 })
    expect(aR.quote).toBe(0.5)
    expect(aR.schritteDurchschnitt).toBe(4)
    expect(aR.von).toBe('2026-08-14T09:00:00.000Z')
    expect(aR.bis).toBe('2026-08-16T09:00:00.000Z')
    expect(zeilen[1].quote).toBe(1)
    // Nur gescheiterte → keine Quote.
    expect(lokaleKiAuswerten([u('c', 'entwurf', 'gescheitert', 1)]).zeilen[0].quote).toBeNull()
  })
})

describe('Motor: Extrakt und Schnitte', () => {
  const bericht = {
    id: 'b1',
    workflow: 'Paket schneiden → Bauer → Prüfer',
    gestartetAm: '2026-08-14T10:00:00.000Z',
    beendetAm: '2026-08-14T10:30:00.000Z',
    zustand: 'erfolgreich',
    verbrauch: { tokens: 1000, kostenUsd: 2 },
    blockErgebnisse: [
      { instanzId: 'p', block: 'Paket schneiden', zustand: 'erfolgreich', tokens: 100, kostenUsd: 0.2 },
      { instanzId: 'b', block: 'Bauer', zustand: 'erfolgreich', tokens: 500, kostenUsd: 1 },
      { instanzId: 'x', block: 'Prüfer', zustand: 'pruefung-nicht-bestanden', tokens: 100, kostenUsd: 0.2 },
      // Reparatur-Runde und Nachprüfung: dieselben Instanzen laufen erneut.
      { instanzId: 'b', block: 'Bauer', zustand: 'erfolgreich', tokens: 200, kostenUsd: 0.4 },
      { instanzId: 'x', block: 'Prüfer', zustand: 'pruefung-bestanden', tokens: 100, kostenUsd: 0.2 }
    ],
    ticker: [{ text: 'viel Text, der nicht in den Extrakt gehört' }]
  }
  it('extrahiert schmal und erkennt Wiederholungen je Instanz', () => {
    const e = laufExtraktAusBericht(bericht, 'C:\\P')
    expect(e).toMatchObject({ id: 'b1', projektPfad: 'C:\\P', tokens: 1000, kostenUsd: 2, sonderlauf: null })
    expect(e.ticker).toBeUndefined()
    expect(e.bloecke.map((b) => [b.block, b.wiederholung])).toEqual([
      ['Paket schneiden', false],
      ['Bauer', false],
      ['Prüfer', false],
      ['Bauer', true],
      ['Prüfer', true]
    ])
    expect(laufExtraktAusBericht({ workflow: 'x' }, 'C:\\P')).toBeNull()
  })
  it('alte Berichte ohne Kosten/Block-Tokens zählen als Lücke, nicht als 0', () => {
    const alt = laufExtraktAusBericht(
      {
        workflow: 'Bauer',
        gestartetAm: '2026-08-07T10:00:00.000Z',
        verbrauch: { tokens: 300 },
        blockErgebnisse: [{ block: 'Bauer', zustand: 'erfolgreich' }]
      },
      'C:\\P'
    )
    expect(alt.kostenUsd).toBeNull()
    expect(alt.bloecke[0].tokens).toBeNull()
    const m = motorAuswerten([alt, laufExtraktAusBericht(bericht, 'C:\\P')])
    expect(m.gesamt).toMatchObject({ anzahl: 2, tokens: 1300, mitKosten: 1, ohneKosten: 1, kostenUsd: 2 })
    expect(m.gesamt.kostenDurchschnitt).toBe(2)
    expect(m.gesamt.tokensDurchschnitt).toBe(650)
    const bauer = m.jeBlock.find((z) => z.block === 'Bauer')
    // Erstläufe: einer mit 500 Tokens, einer ohne Angabe → Ø 500 über den mit Tokens.
    expect(bauer.erstlauf).toMatchObject({ anzahl: 2, mitTokens: 1, ohneTokens: 1, tokensDurchschnitt: 500 })
    // Die Reparatur-Runde steht getrennt und verzerrt den Erstlauf nicht.
    expect(bauer.wiederholung).toMatchObject({ anzahl: 1, tokensDurchschnitt: 200, kostenDurchschnitt: 0.4 })
  })
  it('schneidet je Kette, Projekt und Woche', () => {
    const e1 = laufExtraktAusBericht(bericht, 'C:\\P')
    const e2 = laufExtraktAusBericht({ ...bericht, id: 'b2', gestartetAm: '2026-08-15T08:00:00.000Z' }, 'C:\\Q')
    const e3 = laufExtraktAusBericht(
      { ...bericht, id: 'b3', workflow: 'Audit', gestartetAm: '2026-08-08T08:00:00.000Z', verbrauch: { tokens: 50, kostenUsd: 0.1 } },
      'C:\\P'
    )
    const m = motorAuswerten([e1, e2, e3])
    expect(m.jeKette.map((k) => [k.kette, k.anzahl])).toEqual([
      ['Paket schneiden → Bauer → Prüfer', 2],
      ['Audit', 1]
    ])
    expect(m.jeProjekt.map((p) => [p.projektPfad, p.anzahl])).toEqual([
      ['C:\\P', 2],
      ['C:\\Q', 1]
    ])
    // 08.08. liegt in KW 32, 14./15.08. in KW 33 — chronologisch.
    expect(m.jeWoche.map((w) => [w.schluessel, w.anzahl, w.tokens])).toEqual([
      ['2026-W32', 1, 50],
      ['2026-W33', 2, 2000]
    ])
  })
  it('wocheVon: Montag bis Sonntag, ISO-Nummer, Jahreswechsel', () => {
    const w = wocheVon('2026-08-15T10:00:00.000Z') // Samstag
    expect(w.schluessel).toBe('2026-W33')
    expect(w.montag.getDay()).toBe(1)
    expect(w.sonntag.getDay()).toBe(0)
    expect(w.montag.getDate()).toBe(10)
    // 1. Januar 2027 (Freitag) gehört zur KW 53 des Jahres 2026.
    expect(wocheVon('2027-01-01T12:00:00').schluessel).toBe('2026-W53')
    // 4. Januar 2027 ist Montag der KW 1.
    expect(wocheVon('2027-01-04T12:00:00').schluessel).toBe('2027-W01')
    expect(wocheVon('quatsch')).toBeNull()
  })
})
