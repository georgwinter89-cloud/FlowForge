// Adress-Pool der lokalen Klasse im ECHTEN Lauf (BAUPLAN 51) — gemessen am
// Ablaufplaner mit Motor-Ersatz (Muster pruefungen/lokalerPrueferLauf.test.js):
// Ticker, Startregeln, Zuteilungen und der gespeicherte Laufbericht sind echt;
// Attrappe sind nur der Motor (starteLaufMotor bekommt die lokal-Option samt
// Adresse und wird gemessen), die Einstellungen und die Ollama-Erreichbarkeit
// samt Modell-Ableitung (je Adresse steuerbar).
//
// Gemessen werden die Ausräumungen der Angriffsliste 51:
//   - Fund 1: Das feste Ollama-Fenster eines lokalen Blocks vergiftet nicht
//     die Übertrags-Schwelle der folgenden Claude-Blöcke.
//   - Fund 4/5/6: eine Adresse → nacheinander mit ehrlichem Ticker-Grund
//     (dedupliziert); zwei Adressen → parallel mit getrennten Zuteilungen,
//     der dritte wartet mit „alle 2 Adressen belegt" und allen Halter-Namen.
//   - Fund 7/8: bericht.verbrauch.lokal { tokens, dauerMs } im Hauptprozess
//     geführt, dauerMs an jedem Block-Eintrag.
//   - Provisionierung je Adresse, Ausklammern nicht bereiter Adressen mit
//     Klartext, leerer Pool = Fehlschlag wie bisher.
//
// Rot vor Grün: Vor Bauschritt 51 kannte lauf.js genau EINE Adresse
// (einstellungen.lokaleHelferAdresse), zwei lokale Blöcke liefen nie
// parallel, bekanntesKontextFenster übernahm auch das 64k-Fenster lokaler
// Blöcke, und weder verbrauch.lokal noch dauerMs existierten im Bericht.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

const steuerung = vi.hoisted(() => ({
  bauen: null,
  // Je Prüffall gesetzt: zusätzliche Einstellungs-Felder (Adressliste bzw.
  // nur das alte Einzelfeld), Erreichbarkeit je Adresse, Modell-Ableitung.
  einstellungenZusatz: {},
  pruefen: () => ({ erreichbar: true, modellDa: true }),
  bereitstellen: null,
  bereitgestellt: []
}))
vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async () => ({ geprueft: false, gruen: null, code: null, ausgabe: '', grund: 'keine' })
}))
vi.mock('../src/main/prozesse.js', async (importOriginal) => ({
  ...(await importOriginal()),
  prozessgruppeAnlegen: () => {},
  prozessgruppeAbraeumen: async () => ({ beendet: [], uebrig: [] })
}))
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: [] })
}))
vi.mock('../src/main/einstellungen.js', async (importOriginal) => {
  const orig = await importOriginal()
  return {
    ...orig,
    einstellungenLaden: () => {
      const { einstellungen } = orig.einstellungenLaden()
      return {
        ok: true,
        einstellungen: {
          ...einstellungen,
          motorModus: 'api',
          apiSchluessel: 'pruef-schluessel',
          lokaleHelferAktiv: true,
          lokalBlockAgent: true,
          lokaleHelferModell: 'qwen3.8:27b',
          ...steuerung.einstellungenZusatz
        }
      }
    },
    motorBereit: () => ({ ok: true })
  }
})
vi.mock('../src/main/motor/lokaleHelfer.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lokaleHelferPruefen: async (_modell, adresse) => steuerung.pruefen(adresse),
  lokalReparieren: async () => {
    throw new Error('lokalReparieren darf in dieser Prüfung nicht laufen')
  }
}))
vi.mock('../src/main/motor/lokalesModell.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lokalesModellBereitstellen: async ({ adresse }) => {
    steuerung.bereitgestellt.push(adresse)
    return steuerung.bereitstellen
      ? steuerung.bereitstellen(adresse)
      : { ok: true, modell: 'flowforge-qwen3-8-27b' }
  }
}))

import { laufStarten, laufberichteLaden } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const ADRESSE_1 = 'http://127.0.0.1:11434'
const ADRESSE_2 = 'http://ollama-zweitrechner:11434'

// ——— Helfer (Muster aus lokalerPrueferLauf.test.js) —————————————————————————

function projektSchluessel(projektPfad) {
  return crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
}
function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-lokalpool-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(path.join(app.getPath('userData'), 'sicherungen', projektSchluessel(wurzel)), {
    recursive: true,
    force: true
  })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

// Motor-Ersatz: hält jeden Block an, bis die Prüfung ihn freigibt, und merkt
// sich je Start die lokal-Option (Adresse!) und das Kontextfenster der
// Motor-Optionen — daran wird die Zuteilung und der Fenster-Wächter gemessen.
function motorErsatz(verbrauchFuer) {
  const wartend = new Map()
  const gestartet = [] // { instanzId, lokal, kontextFenster }
  steuerung.bauen = (optionen) => ({
    sessionKennung: 'pruef-session',
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      gestartet.push({
        instanzId: block.instanzId,
        lokal: optionen.lokal ?? null,
        kontextFenster: optionen.kontextFenster
      })
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, async () => {
          aufloesen({
            zustand: 'erfolgreich',
            ergebnisText: '',
            meldungen: [
              meldungPruefen(
                'rahmen',
                { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' },
                'Projekt-Überblick'
              ).meldung
            ],
            fehlertext: '',
            fehlerArt: null,
            verbrauch: verbrauchFuer?.(block.instanzId) ?? null,
            denktiefeGemessen: null
          })
        })
      })
    }
  })
  return {
    gestartet,
    start: (instanzId) => gestartet.find((g) => g.instanzId === instanzId),
    starts: (instanzId) => gestartet.filter((g) => g.instanzId === instanzId).length,
    async freigeben(instanzId) {
      const bis = Date.now() + 8000
      while (!wartend.has(instanzId) && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      const los = wartend.get(instanzId)
      if (!los) throw new Error('Block nie gestartet: ' + instanzId)
      wartend.delete(instanzId)
      await los()
    }
  }
}

function fensterErsatz() {
  const ereignisse = []
  return {
    ereignisse,
    fenster: {
      isDestroyed: () => false,
      isFocused: () => true,
      webContents: { send: (_kanal, daten) => ereignisse.push(daten) }
    },
    ticker: () => ereignisse.filter((e) => e.art === 'ticker').map((e) => e.text),
    async warteAuf(pruefung, was = 'Ereignis') {
      const bis = Date.now() + 10000
      while (!pruefung() && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      if (!pruefung()) throw new Error('Nicht eingetreten: ' + was)
    },
    async warteAufEnde() {
      await this.warteAuf(() => ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
      return ereignisse.find((e) => e.art === 'fertig')
    }
  }
}

function laufAufbauen(name, bloecke, pfeile, verbrauchFuer) {
  const projekt = frischesProjekt(name)
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden: 2, uebertragGrenze: 5, bloecke, pfeile }),
    'utf8'
  )
  const motor = motorErsatz(verbrauchFuer)
  const sicht = fensterErsatz()
  return { projekt, motor, sicht }
}

function gespeicherterBericht(projekt) {
  const { berichte } = laufberichteLaden(projekt)
  expect(berichte).toHaveLength(1)
  return berichte[0]
}
const zaehle = (zeilen, zeile) => zeilen.filter((z) => z === zeile).length

// ——— (a) eine Adresse (altes Einzelfeld): nacheinander, ehrlicher Grund, Dedupe ———

describe('BAUPLAN 51 · (a) eine Adresse: lokale Blöcke laufen nacheinander mit ehrlichem, deduplizierten Ticker-Grund', () => {
  let lauf
  let bericht
  beforeAll(async () => {
    // Bewusst NUR das alte Einzelfeld (kein Adressen-Array): ältere gemockte
    // Einstellungs-Ketten müssen weiter tragen (Rückfall in lauf.js).
    steuerung.einstellungenZusatz = { lokaleHelferAdresse: ADRESSE_1 }
    steuerung.pruefen = () => ({ erreichbar: true, modellDa: true })
    steuerung.bereitstellen = null
    steuerung.bereitgestellt = []
    const verbrauch = {
      a: { blockZuwachs: 100, kostenUsd: null, kontextFenster: 65536, modelle: [{ modell: 'flowforge-qwen3-8-27b', tokens: 100 }] },
      b: { blockZuwachs: 50, kostenUsd: null, kontextFenster: 65536, modelle: [{ modell: 'flowforge-qwen3-8-27b', tokens: 50 }] },
      c: { blockZuwachs: 200, kostenUsd: null, kontextFenster: 200000, modelle: [{ modell: 'claude-opus-4', tokens: 200 }] }
    }
    lauf = laufAufbauen(
      'einzeln',
      [
        { instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' },
        { instanzId: 'b', blockId: 'spaeher', zusatz: 'B', modell: 'lokal' },
        { instanzId: 'c', blockId: 'spaeher', zusatz: 'C' },
        { instanzId: 's', blockId: 'integrator-recherche', zusatz: '' }
      ],
      [
        { von: 'a', nach: 's' },
        { von: 'b', nach: 's' },
        { von: 'c', nach: 's' }
      ],
      (id) => verbrauch[id] ?? null
    )
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    // Runde 1: „A" (lokal) und „C" (Claude) starten, „B" wartet auf die eine
    // Adresse. Erst wird „C" fertig — der Planer läuft erneut, „B" wartet
    // WEITER mit unveränderter Belegung: die Zeile darf nicht erneut tickern.
    await motor.freigeben('c')
    await sicht.warteAuf(
      () => sicht.ereignisse.some((e) => e.art === 'block-fertig' && e.instanzId === 'c'),
      '„C" fertig'
    )
    await motor.freigeben('a')
    await motor.freigeben('b')
    await motor.freigeben('s')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    bericht = gespeicherterBericht(projekt)
  }, 60000)

  it('startet „B" erst nach „A" — beide auf derselben (einzigen) Adresse, Claude läuft daneben', () => {
    const { motor } = lauf
    expect(motor.gestartet.map((g) => g.instanzId)).toEqual(['a', 'c', 'b', 's'])
    expect(motor.start('a').lokal).toEqual(expect.objectContaining({ adresse: ADRESSE_1 }))
    expect(motor.start('b').lokal).toEqual(expect.objectContaining({ adresse: ADRESSE_1 }))
    expect(motor.start('c').lokal).toBeNull()
    expect(steuerung.bereitgestellt).toEqual([ADRESSE_1])
  })

  it('tickert den ehrlichen Grund im heutigen Wortlaut — und bei unveränderter Belegung nur EINMAL (Dedupe)', () => {
    const zeilen = lauf.sicht.ticker()
    const grund = texte.ticker.warteGrundLokal('Späher · B', 'Späher · A', 1)
    expect(zaehle(zeilen, grund)).toBe(1)
    // Der Planer lief nach „C" nachweislich erneut (sonst wäre „B" nie
    // gestartet) — die zweite Runde hat die Zeile also wirklich unterdrückt.
    expect(zeilen.some((z) => z.includes('alle') && z.includes('Adressen'))).toBe(false)
  })

  it('Fund 1: das 64k-Fenster der lokalen Blöcke vergiftet die gelernte Fenstergröße nicht — Claude-Meldung gewinnt', () => {
    // „C" (Claude) meldete 200000, „A" und „B" (lokal) meldeten 65536 DANACH.
    // Ohne Wächter stünde hier 65536 — die Übertrags-Schwelle aller weiteren
    // Claude-Sessions wäre gedrittelt.
    expect(bericht.laufSitzung.kontextFenster).toBe(200000)
  })

  it('Fund 7/8: bericht.verbrauch.lokal führt Tokens und Dauer der lokalen Blöcke, jeder Eintrag trägt dauerMs', () => {
    expect(bericht.verbrauch.tokens).toBe(350)
    expect(bericht.verbrauch.lokal).toBeDefined()
    expect(bericht.verbrauch.lokal.tokens).toBe(150)
    expect(Number.isFinite(bericht.verbrauch.lokal.dauerMs)).toBe(true)
    expect(bericht.verbrauch.lokal.dauerMs).toBeGreaterThanOrEqual(0)
    for (const eintrag of bericht.blockErgebnisse) {
      expect(Number.isFinite(eintrag.dauerMs)).toBe(true)
      expect(eintrag.dauerMs).toBeGreaterThanOrEqual(0)
    }
  })
})

// ——— (b) Kontextfenster-Wächter am Motor-Argument ———————————————————————————

describe('BAUPLAN 51 · (b) Fund 1: der Claude-Motor nach einem lokalen Block bekommt KEIN Ollama-Fenster', () => {
  it('startet den Claude-Block ohne kontextFenster-Option, obwohl der lokale Block 65536 gemeldet hat', async () => {
    steuerung.einstellungenZusatz = { lokaleHelferAdressen: [ADRESSE_1], lokaleHelferAdresse: ADRESSE_1 }
    steuerung.pruefen = () => ({ erreichbar: true, modellDa: true })
    steuerung.bereitstellen = null
    steuerung.bereitgestellt = []
    const lauf = laufAufbauen(
      'waechter',
      [
        { instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' },
        { instanzId: 'c', blockId: 'spaeher', zusatz: 'C' }
      ],
      [{ von: 'a', nach: 'c' }],
      (id) =>
        id === 'a'
          ? { blockZuwachs: 100, kostenUsd: null, kontextFenster: 65536, modelle: [{ modell: 'flowforge-qwen3-8-27b', tokens: 100 }] }
          : null
    )
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('a')
    await motor.freigeben('c')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    // Rot vor Grün: ohne Wächter trüge der Claude-Motor hier 65536.
    expect(motor.start('c').kontextFenster).toBeUndefined()
    // Und der Lauf hat nie ein Fenster „gelernt": kein Claude-Block meldete eines.
    expect(gespeicherterBericht(projekt).laufSitzung.kontextFenster).toBeNull()
  }, 60000)
})

// ——— (c) zwei Adressen: parallel mit getrennten Zuteilungen —————————————————

describe('BAUPLAN 51 · (c) zwei Adressen: zwei lokale Blöcke parallel, der dritte wartet mit ehrlicher Anzahl', () => {
  let lauf
  beforeAll(async () => {
    steuerung.einstellungenZusatz = {
      lokaleHelferAdressen: [ADRESSE_1, ADRESSE_2],
      lokaleHelferAdresse: ADRESSE_1
    }
    steuerung.pruefen = () => ({ erreichbar: true, modellDa: true })
    steuerung.bereitstellen = null
    steuerung.bereitgestellt = []
    lauf = laufAufbauen(
      'parallel',
      [
        { instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' },
        { instanzId: 'b', blockId: 'spaeher', zusatz: 'B', modell: 'lokal' },
        { instanzId: 'd', blockId: 'spaeher', zusatz: 'D', modell: 'lokal' },
        { instanzId: 'z', blockId: 'integrator-recherche', zusatz: '' }
      ],
      [
        { von: 'a', nach: 'z' },
        { von: 'b', nach: 'z' },
        { von: 'd', nach: 'z' }
      ],
      () => null
    )
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    // Runde 1: „A" und „B" starten PARALLEL (beide warten im Motor-Ersatz),
    // „D" wartet. Erst als „A" fertig ist, übernimmt „D" dessen Adresse.
    await sicht.warteAuf(() => motor.starts('a') === 1 && motor.starts('b') === 1, 'A und B parallel')
    expect(motor.starts('d')).toBe(0)
    await motor.freigeben('a')
    await motor.freigeben('d')
    await motor.freigeben('b')
    await motor.freigeben('z')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
  }, 60000)

  it('provisioniert das abgeleitete Modell auf JEDER Adresse und meldet den Pool im Ticker', () => {
    expect([...steuerung.bereitgestellt].sort()).toEqual([ADRESSE_1, ADRESSE_2].sort())
    const zeilen = lauf.sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.lokalBereit('flowforge-qwen3-8-27b', 65536, 2))).toBe(1)
  })

  it('teilt den beiden parallelen Blöcken VERSCHIEDENE Adressen zu', () => {
    const { motor } = lauf
    const a = motor.start('a').lokal
    const b = motor.start('b').lokal
    expect([a.adresse, b.adresse].sort()).toEqual([ADRESSE_1, ADRESSE_2].sort())
    expect(a.adresse).not.toBe(b.adresse)
  })

  it('der dritte wartet mit „alle 2 Adressen belegt" samt beider Halter — und erbt dann die frei gewordene Adresse', () => {
    const zeilen = lauf.sicht.ticker()
    const grund = texte.ticker.warteGrundLokal('Späher · D', 'Späher · A", „Späher · B', 2)
    expect(zaehle(zeilen, grund)).toBe(1)
    // „D" bekommt genau die Adresse, die „A" freigegeben hat.
    expect(lauf.motor.start('d').lokal.adresse).toBe(lauf.motor.start('a').lokal.adresse)
  })
})

// ——— (d) Ausklammern und leerer Pool ————————————————————————————————————————

describe('BAUPLAN 51 · (d) nicht bereite Adressen: ausklammern mit Klartext, leerer Pool bleibt Fehlschlag', () => {
  it('klammert eine tote Adresse sichtbar aus und fährt auf der bereiten weiter', async () => {
    steuerung.einstellungenZusatz = {
      lokaleHelferAdressen: [ADRESSE_1, ADRESSE_2],
      lokaleHelferAdresse: ADRESSE_1
    }
    steuerung.pruefen = (adresse) =>
      adresse === ADRESSE_2 ? { erreichbar: false, modellDa: false } : { erreichbar: true, modellDa: true }
    steuerung.bereitstellen = null
    steuerung.bereitgestellt = []
    const lauf = laufAufbauen(
      'ausklammern',
      [{ instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' }],
      [],
      () => null
    )
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('a')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    expect(motor.start('a').lokal.adresse).toBe(ADRESSE_1)
    expect(steuerung.bereitgestellt).toEqual([ADRESSE_1])
    const zeilen = sicht.ticker()
    // Kurzer Grund statt des vollen Fehlertexts (Befund Prüfer 2): Der volle
    // Text rät „starte den Lauf neu" — verwirrend, der Lauf läuft ja weiter.
    const ausgeklammert = texte.ticker.lokalAdresseAusgeklammert(
      ADRESSE_2,
      texte.ticker.lokalGrundNichtErreichbar
    )
    expect(zaehle(zeilen, ausgeklammert)).toBe(1)
    expect(zeilen.some((z) => z.includes('ausgeklammert') && z.includes('starte den Lauf neu'))).toBe(false)
    // Bei nur EINER bereiten Adresse bleibt die Bereit-Zeile wortgleich wie bisher.
    expect(zaehle(zeilen, texte.ticker.lokalBereit('flowforge-qwen3-8-27b', 65536))).toBe(1)
  }, 60000)

  it('leerer Pool (Modell-Ableitung scheitert): der Lauf endet als Fehlschlag mit Klartext — kein stiller Claude-Rückfall', async () => {
    steuerung.einstellungenZusatz = { lokaleHelferAdressen: [ADRESSE_1], lokaleHelferAdresse: ADRESSE_1 }
    steuerung.pruefen = () => ({ erreichbar: true, modellDa: true })
    steuerung.bereitstellen = () => ({ ok: false, fehler: 'Ollama hat das Anlegen abgelehnt (Prüffall).' })
    steuerung.bereitgestellt = []
    const lauf = laufAufbauen(
      'leer',
      [{ instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' }],
      [],
      () => null
    )
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('fehlgeschlagen')
    expect(motor.starts('a')).toBe(0)
    expect(sicht.ticker()).toContain('Ollama hat das Anlegen abgelehnt (Prüffall).')
  }, 60000)

  it('sind ALLE Adressen tot, startet der Lauf gar nicht erst — Klartext nennt die ganze Liste', async () => {
    steuerung.einstellungenZusatz = {
      lokaleHelferAdressen: [ADRESSE_1, ADRESSE_2],
      lokaleHelferAdresse: ADRESSE_1
    }
    steuerung.pruefen = () => ({ erreichbar: false, modellDa: false })
    steuerung.bereitstellen = null
    steuerung.bereitgestellt = []
    const lauf = laufAufbauen(
      'tot',
      [{ instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' }],
      [],
      () => null
    )
    const start = await laufStarten(lauf.sicht.fenster, lauf.projekt, [], null, false, null)
    expect(start).toEqual({
      ok: false,
      fehler: texte.lauf.lokalNichtErreichbar(ADRESSE_1 + ', ' + ADRESSE_2)
    })
  }, 60000)
})

// ——— (e) Lokale Token-Ehrlichkeit (Befund Prüfer 2, Bausession 51) ——————————

describe('BAUPLAN 51 · (e) lokale Tokens aus der Modell-Aufschlüsselung, wenn der Faden-Zuwachs 0 meldet', () => {
  it('zählt die Ollama-Tokens in Gesamt UND Lokal-Topf, obwohl blockZuwachs 0 ist', async () => {
    // Gemessen an der gebauten App: Ein lokaler Anlauf ohne Fazit meldete
    // blockZuwachs 0, die Aufschlüsselung aber 48.419 echte Ollama-Tokens —
    // verbrauch.lokal stand auf 0 und die „Davon lokal"-Zeile fehlte.
    steuerung.einstellungenZusatz = { lokaleHelferAdressen: [ADRESSE_1], lokaleHelferAdresse: ADRESSE_1 }
    steuerung.pruefen = () => ({ erreichbar: true, modellDa: true })
    steuerung.bereitstellen = null
    steuerung.bereitgestellt = []
    const lauf = laufAufbauen(
      'tokenehrlich',
      [{ instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' }],
      [],
      () => ({
        blockZuwachs: 0,
        unterTokens: 0,
        kostenUsd: null,
        kontextFenster: 65536,
        modelle: [{ modell: 'flowforge-qwen3-8-27b', tokens: 48419 }]
      })
    )
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('a')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    const bericht = gespeicherterBericht(projekt)
    expect(bericht.verbrauch.tokens).toBe(48419)
    expect(bericht.verbrauch.lokal.tokens).toBe(48419)
  }, 60000)
})
