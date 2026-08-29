// Dauerrote Prüfungen ruhen (BAUPLAN 63, Entscheidung Georg 29.08.2026): Nach
// drei roten LÄUFEN hintereinander läuft eine aufbewahrte Prüfung nicht mehr
// mit, sondern stellt einmal ihre Frage an der Karte.
//
// Gemessener Anlass (18 Läufe am Haushaltsplaner, 27.–29.08.2026): 550 Zeilen
// „Alte Prüfung … ist ROT", und „Wochenplan-Ansicht geprüft" war in 16 Läufen
// hintereinander rot — vor und nach jeder Runde neu abgespielt, ohne dass je
// etwas eskalierte. Aus diesen Meldungen entstanden wiederum Aufgaben-Karten
// über FlowForges eigenen Apparat.
//
// Rot-vor-Grün: Vor diesem Bauschritt kannte der Stempel weder rotLaeufe noch
// ruht, und kartenAuswahl hatte keinen Grund „ruht" — eine dreimal rote Karte
// lief unverändert in jedem Messpunkt weiter.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  stempelLaden,
  stempelSetzen,
  stempelRotVermerken,
  stempelGruenVermerken,
  stempelRuheAufheben,
  ROT_LAEUFE_BIS_RUHE
} from '../src/main/pruefkartenStempel.js'
import { kartenAuswahl } from '../src/shared/pruefkartenRegeln.js'
import { projektSchluessel } from '../src/main/pruefkarten.js'

const KARTE = 'aaaaaaaa-1111-2222-3333-444455556666'
let projekt

function stempelOrdner() {
  return path.join(os.tmpdir(), 'flowforge-pruefungen', 'pruefkarten', projektSchluessel(projekt))
}

function setzen() {
  return stempelSetzen(projekt, KARTE, {
    dateiListe: ['js/wochenplan.js'],
    befehl: 'node pruefung/pruefer-a1/pruefe.mjs',
    ordner: 'pruefer-a1',
    instanzId: 'a1'
  })
}

beforeEach(() => {
  projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-dauerrot-'))
  setzen()
})

afterEach(() => {
  fs.rmSync(stempelOrdner(), { recursive: true, force: true })
  fs.rmSync(projekt, { recursive: true, force: true })
})

describe('BAUPLAN 63 · Dauerrot wird je Lauf gezählt, nicht je Messpunkt', () => {
  it('zählt denselben Lauf nur einmal — ein Lauf hat mehrere Messpunkte', () => {
    expect(stempelRotVermerken(projekt, KARTE, 'lauf-1')).toEqual({
      rotLaeufe: 1,
      ruhtJetzt: false
    })
    expect(stempelRotVermerken(projekt, KARTE, 'lauf-1')).toEqual({
      rotLaeufe: 1,
      ruhtJetzt: false
    })
    expect(stempelLaden(projekt).karten[KARTE].ruht).toBe(false)
  })

  it('legt die Prüfung nach der dritten roten Runde still — genau einmal', () => {
    stempelRotVermerken(projekt, KARTE, 'lauf-1')
    stempelRotVermerken(projekt, KARTE, 'lauf-2')
    const dritter = stempelRotVermerken(projekt, KARTE, 'lauf-3')
    expect(ROT_LAEUFE_BIS_RUHE).toBe(3)
    expect(dritter).toEqual({ rotLaeufe: 3, ruhtJetzt: true })
    expect(stempelLaden(projekt).karten[KARTE].ruht).toBe(true)
    // Der vierte Lauf meldet die Ruhe NICHT noch einmal — sonst stünde die
    // Frage in jedem Lauf neu im Ticker, und das ist genau das Verhalten,
    // gegen das dieser Bauschritt gebaut ist.
    expect(stempelRotVermerken(projekt, KARTE, 'lauf-4').ruhtJetzt).toBe(false)
  })

  it('setzt den Zähler zurück, sobald die Prüfung wieder grün läuft', () => {
    stempelRotVermerken(projekt, KARTE, 'lauf-1')
    stempelRotVermerken(projekt, KARTE, 'lauf-2')
    expect(stempelGruenVermerken(projekt, KARTE)).toBe(true)
    expect(stempelLaden(projekt).karten[KARTE].rotLaeufe).toBe(0)
    // Und läuft von vorn — eine reparierte Prüfung steht nicht eine Runde vor
    // der Stilllegung.
    expect(stempelRotVermerken(projekt, KARTE, 'lauf-3')).toEqual({
      rotLaeufe: 1,
      ruhtJetzt: false
    })
  })

  it('nimmt eine ruhende Prüfung auf Georgs Antwort wieder auf', () => {
    for (const lauf of ['a', 'b', 'c']) stempelRotVermerken(projekt, KARTE, lauf)
    expect(stempelLaden(projekt).karten[KARTE].ruht).toBe(true)
    expect(stempelRuheAufheben(projekt, KARTE)).toBe(true)
    const eintrag = stempelLaden(projekt).karten[KARTE]
    expect(eintrag.ruht).toBe(false)
    expect(eintrag.rotLaeufe).toBe(0)
  })

  it('wirft den Dauerrot-Stand nicht weg, wenn die Karte neu gestempelt wird', () => {
    stempelRotVermerken(projekt, KARTE, 'lauf-1')
    stempelRotVermerken(projekt, KARTE, 'lauf-2')
    setzen()
    expect(stempelLaden(projekt).karten[KARTE].rotLaeufe).toBe(2)
  })
})

describe('BAUPLAN 63 · Eine ruhende Prüfung wird nicht mehr abgespielt', () => {
  const karte = { id: KARTE, titel: 'Wochenplan-Ansicht geprüft' }
  const eintrag = {
    dateiListe: ['js/wochenplan.js'],
    befehl: 'node pruefung/pruefer-a1/pruefe.mjs',
    ordner: 'pruefer-a1',
    instanzId: 'a1',
    zuletztMs: 0,
    dauerMs: 0,
    rotLaeufe: 3,
    rotLaufId: 'lauf-3'
  }
  const auswaehlen = (ruht) =>
    kartenAuswahl({
      karten: [karte],
      stempel: { [KARTE]: { ...eintrag, ruht } },
      paketDateien: null,
      gezogen: [],
      beimPruefer: [],
      schonGelaufen: []
    })

  it('meldet sie als übersprungen mit eigenem Grund — nicht als „nicht betroffen"', () => {
    const auswahl = auswaehlen(true)
    expect(auswahl.laeuft).toHaveLength(0)
    expect(auswahl.uebersprungen).toEqual([{ id: KARTE, grund: 'ruht' }])
    expect(auswahl.nichtAbspielbar).toHaveLength(0)
  })

  it('spielt sie wieder ab, sobald die Ruhe aufgehoben ist', () => {
    expect(auswaehlen(false).laeuft.map((e) => e.id)).toEqual([KARTE])
  })
})
