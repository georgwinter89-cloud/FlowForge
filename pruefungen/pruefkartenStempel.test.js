// Der Stempel der Prüfkarten (BAUPLAN 52): Ohne ihn kann FlowForge eine
// archivierte Prüfung nicht von selbst abspielen — er trägt Dateiliste,
// Prüfbefehl und Ordnernamen von damals, dazu die Rotationsmarke.
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es src/main/pruefkartenStempel.js
// nicht (Import rot). Danach wurde jede Zusage einzeln rot gesehen, indem die
// frisch gebaute Regel wieder herausgenommen wurde:
//   - ohne das Übernehmen von zuletztMs/dauerMs in stempelSetzen verlor jede
//     neu gestempelte Karte ihre Rotationsmarke und drängelte sich beim
//     nächsten Lauf wieder vor;
//   - ohne den Filter in stempelLaden lieferte eine gelöschte Karte weiter
//     einen Stempel — der Messpunkt hätte eine Prüfung ohne Karte abgespielt;
//   - ohne das `kaputt`-Kennzeichen sah eine unlesbare Datei genauso aus wie
//     ein Projekt, in dem noch nie gestempelt wurde.
//
// Der Wohnort wird hier nicht geraten: Er wird aus dem Projektpfad genauso
// gerechnet wie in pruefkarten.js (sha1 des kleingeschriebenen aufgelösten
// Pfads, 16 Zeichen) — der Electron-Ersatz legt den Datenordner in den
// Temp-Ordner.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  stempelLaden,
  stempelSetzen,
  stempelMessungVermerken,
  stempelLoeschen,
  stempelAufraeumen
} from '../src/main/pruefkartenStempel.js'
import { projektSchluessel } from '../src/main/pruefkarten.js'
import { texte } from '../src/shared/texte.js'

const KARTE_A = 'aaaaaaaa-1111-2222-3333-444455556666'
const KARTE_B = 'bbbbbbbb-1111-2222-3333-444455556666'

let projekt

function stempelDatei() {
  return path.join(
    os.tmpdir(),
    'flowforge-pruefungen',
    'pruefkarten',
    projektSchluessel(projekt),
    'stempel.json'
  )
}

function setzen(kartenId, zusatz = {}) {
  return stempelSetzen(projekt, kartenId, {
    dateiListe: ['src/api/nutzer.js'],
    befehl: 'node pruefung/pruefer-6c746d22/pruefe.mjs',
    ordner: 'pruefer-6c746d22',
    instanzId: '6c746d22-8d13',
    ...zusatz
  })
}

beforeEach(() => {
  projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-stempel-'))
})

afterEach(() => {
  fs.rmSync(path.dirname(stempelDatei()), { recursive: true, force: true })
  fs.rmSync(projekt, { recursive: true, force: true })
})

describe('BAUPLAN 52 · Der Stempel entsteht beim Anlegen der Karte', () => {
  it('meldet für ein Projekt ohne Stempel eine leere, aber heile Ablage', () => {
    expect(stempelLaden(projekt)).toEqual({ karten: {}, kaputt: false })
  })

  it('bewahrt Dateiliste, Befehl, Ordner und Instanz auf', () => {
    expect(setzen(KARTE_A)).toEqual({ ok: true })
    expect(stempelLaden(projekt).karten[KARTE_A]).toEqual({
      dateiListe: ['src/api/nutzer.js'],
      befehl: 'node pruefung/pruefer-6c746d22/pruefe.mjs',
      ordner: 'pruefer-6c746d22',
      instanzId: '6c746d22-8d13',
      zuletztMs: 0,
      dauerMs: 0
    })
  })

  it('legt die Datei neben dem Archiv im verwalteten Bereich an, nicht im Projekt', () => {
    setzen(KARTE_A)
    expect(fs.existsSync(stempelDatei())).toBe(true)
    expect(fs.existsSync(path.join(projekt, 'stempel.json'))).toBe(false)
  })

  it('hält mehrere Karten nebeneinander, ohne die vorige zu überschreiben', () => {
    setzen(KARTE_A)
    setzen(KARTE_B, { ordner: 'pruefer-9f2edf01' })
    const { karten } = stempelLaden(projekt)
    expect(Object.keys(karten).sort()).toEqual([KARTE_A, KARTE_B].sort())
    expect(karten[KARTE_B].ordner).toBe('pruefer-9f2edf01')
  })

  // Neu gestempelt heißt nicht neu gelaufen: Ginge die Rotationsmarke beim
  // Überschreiben verloren, drängelte sich jede frisch bestätigte Karte beim
  // nächsten Lauf wieder vor die, die wirklich lange nicht dran war.
  it('lässt Rotationsmarke und Dauer beim erneuten Stempeln stehen', () => {
    setzen(KARTE_A)
    stempelMessungVermerken(projekt, KARTE_A, { zuletztMs: 1755800000000, dauerMs: 4200 })
    setzen(KARTE_A, { befehl: 'node pruefung/pruefer-6c746d22/sammel.mjs' })
    const eintrag = stempelLaden(projekt).karten[KARTE_A]
    expect(eintrag.befehl).toBe('node pruefung/pruefer-6c746d22/sammel.mjs')
    expect(eintrag.zuletztMs).toBe(1755800000000)
    expect(eintrag.dauerMs).toBe(4200)
  })

  it('bringt jedes Feld auf seine Form, statt einer Fremdfassung zu vertrauen', () => {
    stempelSetzen(projekt, KARTE_A, {
      dateiListe: ['  src/api/nutzer.js  ', '', null, 'src/api/rollen.js'],
      befehl: '  npm test  ',
      ordner: '  pruefer-6c746d22  ',
      instanzId: null
    })
    expect(stempelLaden(projekt).karten[KARTE_A]).toMatchObject({
      dateiListe: ['src/api/nutzer.js', 'src/api/rollen.js'],
      befehl: 'npm test',
      ordner: 'pruefer-6c746d22',
      instanzId: ''
    })
  })
})

describe('BAUPLAN 52 · Die Messung wird sofort vermerkt', () => {
  it('schreibt Zeitpunkt und Dauer', () => {
    setzen(KARTE_A)
    expect(stempelMessungVermerken(projekt, KARTE_A, { zuletztMs: 1755800000000, dauerMs: 900 })).toBe(
      true
    )
    expect(stempelLaden(projekt).karten[KARTE_A]).toMatchObject({
      zuletztMs: 1755800000000,
      dauerMs: 900
    })
  })

  it('legt für eine Karte ohne Stempel nichts aus dem Nichts an', () => {
    expect(stempelMessungVermerken(projekt, KARTE_A, { zuletztMs: 1, dauerMs: 1 })).toBe(false)
    expect(stempelLaden(projekt).karten).toEqual({})
  })
})

describe('BAUPLAN 52 · Verwaiste Stempel', () => {
  // Eine Karte kann mitten im Lauf gelöscht worden sein. Ein Stempel ohne Karte
  // ist ein Auftrag ohne Auftraggeber — er darf keine Messung mehr auslösen.
  it('lässt beim Laden Einträge ohne zugehörige Karte draußen', () => {
    setzen(KARTE_A)
    setzen(KARTE_B)
    const { karten } = stempelLaden(projekt, [KARTE_A])
    expect(Object.keys(karten)).toEqual([KARTE_A])
  })

  it('schreibt beim Filtern nicht in die Datei — Aufräumen ist ein eigener Schritt', () => {
    setzen(KARTE_A)
    setzen(KARTE_B)
    stempelLaden(projekt, [KARTE_A])
    expect(Object.keys(stempelLaden(projekt).karten).sort()).toEqual([KARTE_A, KARTE_B].sort())
  })

  it('zeigt ohne Kartenliste alles (null heißt „nicht filtern")', () => {
    setzen(KARTE_A)
    expect(Object.keys(stempelLaden(projekt, null).karten)).toEqual([KARTE_A])
  })

  it('räumt verwaiste Einträge auf und sagt, wie viele es waren', () => {
    setzen(KARTE_A)
    setzen(KARTE_B)
    expect(stempelAufraeumen(projekt, [KARTE_A])).toBe(1)
    expect(Object.keys(stempelLaden(projekt).karten)).toEqual([KARTE_A])
  })

  it('räumt nichts auf, wenn nichts verwaist ist', () => {
    setzen(KARTE_A)
    expect(stempelAufraeumen(projekt, [KARTE_A])).toBe(0)
  })

  it('löscht den Stempel einer einzelnen Karte, ohne die anderen anzurühren', () => {
    setzen(KARTE_A)
    setzen(KARTE_B)
    stempelLoeschen(projekt, KARTE_A)
    expect(Object.keys(stempelLaden(projekt).karten)).toEqual([KARTE_B])
  })

  it('wirft nicht, wenn es gar nichts zu löschen gibt', () => {
    expect(() => stempelLoeschen(projekt, KARTE_A)).not.toThrow()
    setzen(KARTE_A)
    expect(() => stempelLoeschen(projekt, 'gibtsnicht')).not.toThrow()
    expect(Object.keys(stempelLaden(projekt).karten)).toEqual([KARTE_A])
  })
})

describe('BAUPLAN 52 · Eine kaputte Stempeldatei wird benannt, nicht verschluckt', () => {
  it('meldet kaputt statt still „noch nie gestempelt"', () => {
    setzen(KARTE_A)
    fs.writeFileSync(stempelDatei(), '{ das ist kein JSON', 'utf8')
    expect(stempelLaden(projekt)).toEqual({ karten: {}, kaputt: true })
  })

  it('meldet kaputt, wenn die Datei zwar JSON ist, aber keine Kartenablage', () => {
    setzen(KARTE_A)
    fs.writeFileSync(stempelDatei(), '[1,2,3]', 'utf8')
    expect(stempelLaden(projekt).kaputt).toBe(true)
  })

  // Sonst könnte FlowForge nach einem einzigen kaputten Schreibvorgang nie
  // wieder stempeln — jede neue Karte wäre für immer „nicht abspielbar".
  it('lässt sich von einer kaputten Datei nicht dauerhaft blockieren', () => {
    fs.mkdirSync(path.dirname(stempelDatei()), { recursive: true })
    fs.writeFileSync(stempelDatei(), 'kaputt', 'utf8')
    expect(setzen(KARTE_A)).toEqual({ ok: true, beiseite: true })
    const geladen = stempelLaden(projekt)
    expect(geladen.kaputt).toBe(false)
    expect(Object.keys(geladen.karten)).toEqual([KARTE_A])
  })

  // Gemessen (22.08.2026): Zwei gestempelte Karten, Datei auf „{kaputt" gesetzt,
  // dann EINE Karte gestempelt — danach stand nur noch diese eine darin. Die
  // gemerkten Startbefehle aller übrigen Karten waren fort, ohne eigene Meldung.
  it('legt die unlesbare Datei zur Seite, statt die übrigen Stempel spurlos zu verlieren', () => {
    setzen(KARTE_A)
    setzen(KARTE_B)
    fs.writeFileSync(stempelDatei(), '{kaputt', 'utf8')
    expect(setzen(KARTE_A)).toEqual({ ok: true, beiseite: true })
    // Der Neuanfang bleibt …
    expect(Object.keys(stempelLaden(projekt).karten)).toEqual([KARTE_A])
    // … aber der Verlust ist belegbar, und Georg erfährt davon.
    expect(fs.readFileSync(stempelDatei() + '.kaputt', 'utf8')).toBe('{kaputt')
    expect(texte.ticker.kartenStempelBeiseite).toContain('stempel.json.kaputt')
  })

  it('legt bei einer heilen Datei nichts zur Seite', () => {
    setzen(KARTE_A)
    expect(setzen(KARTE_B)).toEqual({ ok: true })
    expect(fs.existsSync(stempelDatei() + '.kaputt')).toBe(false)
  })
})
