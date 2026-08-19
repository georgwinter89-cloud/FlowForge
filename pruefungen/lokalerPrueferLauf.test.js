// Lokaler Prüfer mit Opus-Abnahme im ECHTEN Lauf (BAUPLAN 50) — gemessen am
// Ablaufplaner mit Motor-Ersatz (Muster pruefbelegWeiterreichungLauf.test.js
// und gebuendelteRueckfuehrung.test.js): Aufträge, Ticker, Rückführung und der
// gespeicherte Laufbericht sind echt; Attrappe sind nur der Motor (auch der
// lokale — starteLaufMotor bekommt die lokal-Option und wird gemessen), das Tor
// (befehlAbspielen liefert, was der Fall verlangt), Rauchtest, Späher, Karten,
// die Einstellungen (lokale KI eingeschaltet, als Block-Agent erlaubt) und die
// Ollama-Erreichbarkeit samt Modell-Ableitung.
//
// Kette: Paket schneiden → Bauer (lokal) → Prüfer · lokal (lokal) →
// Prüfer · Abnahme (Standard, zurueckZu = Bauer) → Sessionende.
//
// Rot-vor-Grün: Vor Bauschritt 50 spielte FlowForge nach einem „bestanden" des
// lokalen Prüfers nichts nach (Tor nur VOR Nachprüfungen) — ein rotes Tor
// drehte nichts, im Bericht fehlten torBestaetigung/urteilLokal; die Abnahme
// bekam den Beleg ohne den Zusatz „du bist die Abnahme" und ohne
// abnahmeFuer/abnahme im Bericht; die Ticker-Zeilen torBestaetigtLokal,
// torDrehtLokal, torKeinBefehlLokal, abnahmeBestaetigt und abnahmeWiderspricht
// gab es nicht.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

const steuerung = vi.hoisted(() => ({ bauen: null, tor: null }))
vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async () => ({ geprueft: false, gruen: null, code: null, ausgabe: '', grund: 'keine' }),
  befehlAbspielen: async (projektPfad, befehl, optionen) => steuerung.tor(befehl, optionen)
}))
vi.mock('../src/main/prozesse.js', async (importOriginal) => ({
  ...(await importOriginal()),
  prozessgruppeAnlegen: () => {},
  prozessgruppeAbraeumen: async () => ({ beendet: [], uebrig: [] })
}))
vi.mock('../src/main/startanleitung.js', async (importOriginal) => ({
  ...(await importOriginal()),
  startanleitungVorhanden: () => true
}))
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: [] })
}))
// Einstellungen als Attrappe statt Datei: Die Prüfdateien teilen sich sonst
// die einstellungen.json im Stub-Ordner (modellklasseLokal.test.js löscht sie).
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
          apiSchluessel: 'sk-ant-pruefung',
          lokaleHelferAktiv: true,
          lokalBlockAgent: true,
          lokaleHelferModell: 'qwen3.8:27b',
          lokaleHelferAdresse: 'http://127.0.0.1:11434'
        }
      }
    },
    motorBereit: () => ({ ok: true })
  }
})
vi.mock('../src/main/motor/lokaleHelfer.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lokaleHelferPruefen: async () => ({ erreichbar: true, modellDa: true }),
  // Die lokale Vorreparatur (BAUPLAN 20, Helfer-KI) darf hier nie anlaufen —
  // Tor- und Abnahme-Beanstandungen sind grundsätzlich, nicht mechanisch.
  lokalReparieren: async () => {
    throw new Error('lokalReparieren darf in dieser Prüfung nicht laufen')
  }
}))
vi.mock('../src/main/motor/lokalesModell.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lokalesModellBereitstellen: async () => ({ ok: true, modell: 'flowforge-qwen3-8-27b' })
}))

import { laufStarten, laufberichteLaden } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { pruefbefehlSetzen } from '../src/main/pruefbefehl.js'
import { texte } from '../src/shared/texte.js'

const LOKAL_MODELL = texte.kette.lokalModellName('flowforge-qwen3-8-27b')
const NAME_LOKAL = 'Prüfer · lokal'
const NAME_ABNAHME = 'Prüfer · Abnahme'
const ROT_AUSGABE = 'FAIL pruefung/lokal/probe.test.js > der lokale Prüfer hat etwas übersehen\n'

// ——— Helfer (Muster aus gebuendelteRueckfuehrung.test.js) ———————————————————

let schreibSchritt = 0
function schreiben(wurzel, relativ, inhalt) {
  const ziel = path.join(wurzel, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  const spaeter = new Date(Date.now() + 5000 + ++schreibSchritt * 1000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

function projektSchluessel(projektPfad) {
  return crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
}
function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-lokalpruefer-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(path.join(app.getPath('userData'), 'sicherungen', projektSchluessel(wurzel)), {
    recursive: true,
    force: true
  })
  // Ein altes Prüfbefehl-Archiv wäre eine Baseline — die soll es hier nicht geben.
  fs.rmSync(path.join(app.getPath('userData'), 'pruefbefehl', projektSchluessel(wurzel) + '.json'), {
    force: true
  })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

function motorErsatz(ergebnisFuer) {
  const wartend = new Map()
  const gestartet = [] // { instanzId, auftrag, lokal }
  steuerung.bauen = (optionen) => ({
    sessionKennung: null,
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      gestartet.push({
        instanzId: block.instanzId,
        auftrag: block.auftrag,
        // Was der Motor über seine Herkunft weiß: die lokal-Option (BAUPLAN 49)
        // und der Modell-Platzhalter am Block.
        lokal: optionen.lokal ?? null,
        modell: block.modell
      })
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, async () => {
          const meldungen = await ergebnisFuer(block, optionen)
          aufloesen({
            zustand: 'erfolgreich',
            ergebnisText: '',
            meldungen,
            fehlertext: '',
            fehlerArt: null,
            verbrauch: null
          })
        })
      })
    }
  })
  return {
    gestartet,
    starts: (instanzId) => gestartet.filter((g) => g.instanzId === instanzId).length,
    auftraege: (instanzId) =>
      gestartet.filter((g) => g.instanzId === instanzId).map((g) => g.auftrag),
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

const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }
function paketMeldung(block, liste) {
  const pakete = block.ziele.map((ziel) => ({
    zielBlock: ziel.adresse,
    ziel: 'Teil ' + ziel.name,
    fertigKriterien: ['Läuft.'],
    erlaubteDateien: liste
  }))
  const ergebnis = meldungPruefen('arbeitspaket', { ...rahmen, pakete }, 'Arbeitspaket', {
    ziele: block.ziele
  })
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}
function umsetzungsMeldung() {
  return [meldungPruefen('umsetzungsbericht', { ...rahmen }, 'Umsetzungsbericht').meldung]
}
function pruefMeldung(bestanden, fazit, beanstandung = 'Die Prüfung trägt nicht.') {
  const roh = bestanden
    ? { ...rahmen, fazit, urteil: 'bestanden', beanstandungen: [], rotVorGruen: '', geprueft: [] }
    : {
        ...rahmen,
        fazit,
        urteil: 'fehlgeschlagen',
        beanstandungen: [{ einstufung: 'grundsaetzlich', text: beanstandung, fundort: '' }],
        rotVorGruen: '',
        geprueft: []
      }
  const ergebnis = meldungPruefen('pruefbeleg', roh, 'Prüfbeleg')
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}

const gruen = { code: 0, ausgabe: 'alles grün\n', zeitlimit: false, abgebrochen: false, startFehler: false }
const rot = { code: 1, ausgabe: ROT_AUSGABE, zeitlimit: false, abgebrochen: false, startFehler: false }
const instanzAusGruppe = (optionen) => String(optionen?.gruppe ?? '').split(':').at(-1)

const bloecke = [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Ein Teil' } },
  { instanzId: 'b', blockId: 'bauer', zusatz: '', modell: 'lokal' },
  { instanzId: 'pl', blockId: 'pruefer', zusatz: 'lokal', modell: 'lokal' },
  { instanzId: 'pa', blockId: 'pruefer', zusatz: 'Abnahme', modell: 'standard', zurueckZu: 'b' },
  { instanzId: 's', blockId: 'sessionende', zusatz: '' }
]
const pfeile = [
  { von: 'p', nach: 'b' },
  { von: 'b', nach: 'pl' },
  { von: 'pl', nach: 'pa' },
  { von: 'pa', nach: 's' }
]

// Ein Lauf mit dieser Kette. `plan.urteile` sagt je Prüfer, wie sein n-ter
// Anlauf ausgeht; `plan.tor(instanzId, nummer)` liefert die Tor-Messung für
// den n-ten Prüfbefehl-Lauf dieser Instanz; `plan.ohnePruefbefehl` lässt den
// lokalen Prüfer keinen Prüfbefehl setzen. Reparatur-Runden 2 — sonst hinge
// nach einer Rückführung die Folgen-Frage.
async function laufAufbauen(name, plan) {
  const projekt = frischesProjekt(name)
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden: 2, uebertragGrenze: 5, bloecke, pfeile }),
    'utf8'
  )
  schreiben(projekt, 'src/x.js', 'alt\n')
  const torLaeufe = {}
  const torAufrufe = []
  steuerung.tor = async (befehl, optionen) => {
    const instanzId = instanzAusGruppe(optionen)
    torLaeufe[instanzId] = (torLaeufe[instanzId] ?? 0) + 1
    torAufrufe.push({ instanzId, befehl, nummer: torLaeufe[instanzId] })
    return plan.tor(instanzId, torLaeufe[instanzId])
  }
  const anlaeufe = {}
  const motor = motorErsatz(async (block, optionen) => {
    if (block.instanzId === 'p') {
      optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
      return paketMeldung(block, ['src/'])
    }
    if (block.instanzId === 'b') {
      schreiben(projekt, 'src/neu.js', 'gebaut ' + motor.starts('b') + '\n')
      return umsetzungsMeldung()
    }
    if (block.instanzId === 'pl' || block.instanzId === 'pa') {
      schreiben(projekt, 'pruefung/' + block.pruefOrdner + '/probe.test.js', 'test\n')
      if (!(plan.ohnePruefbefehl && block.instanzId === 'pl'))
        pruefbefehlSetzen(projekt, block.instanzId, 'npm test')
      anlaeufe[block.instanzId] = (anlaeufe[block.instanzId] ?? 0) + 1
      const bestanden = plan.urteile[block.instanzId][anlaeufe[block.instanzId] - 1]
      if (bestanden === undefined) throw new Error('Kein Urteil geplant für ' + block.instanzId)
      return pruefMeldung(
        bestanden,
        block.instanzId === 'pl' ? 'Lokal geprüft.' : 'Abnahme geprüft.',
        block.instanzId === 'pl' ? 'Lokal: trägt nicht.' : 'Abnahme: die Prüfung war zu dünn.'
      )
    }
    return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
  })
  const sicht = fensterErsatz()
  expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
  return { projekt, motor, sicht, torAufrufe }
}

// Der gespeicherte Bericht (JSON-Rundreise) — so liest ihn der Laufbericht.
function gespeicherterBericht(projekt) {
  const { berichte } = laufberichteLaden(projekt)
  expect(berichte).toHaveLength(1)
  return berichte[0]
}
const eintraegeVon = (bericht, instanzId) =>
  bericht.blockErgebnisse.filter((e) => e.instanzId === instanzId)
const zaehle = (zeilen, zeile) => zeilen.filter((z) => z === zeile).length

// ——— (a) lokal bestanden, Tor grün, Abnahme bestanden ——————————————————————

describe('BAUPLAN 50 · (a) lokaler Prüfer bestanden, Tor grün, Abnahme bestätigt', () => {
  let lauf
  let bericht
  beforeAll(async () => {
    lauf = await laufAufbauen('gruen', {
      urteile: { pl: [true], pa: [true] },
      tor: () => gruen
    })
    const { motor, sicht } = lauf
    for (const id of ['p', 'b', 'pl', 'pa', 's']) await motor.freigeben(id)
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    bericht = gespeicherterBericht(lauf.projekt)
  }, 60000)

  it('Bauer und lokaler Prüfer laufen auf der lokalen Motor-Instanz, die Abnahme auf Claude', () => {
    const { motor } = lauf
    const start = (id) => motor.gestartet.find((g) => g.instanzId === id)
    expect(start('b').lokal).toEqual(expect.objectContaining({ modell: 'flowforge-qwen3-8-27b' }))
    expect(start('pl').lokal).toEqual(expect.objectContaining({ modell: 'flowforge-qwen3-8-27b' }))
    expect(start('pl').modell).toBe('lokal')
    expect(start('pa').lokal).toBeNull()
    expect(start('pa').modell).not.toBe('lokal')
  })

  it('das Tor spielt den Prüfbefehl des lokalen Prüfers NACH seinem „bestanden" — einmal, nicht den der Abnahme', () => {
    expect(lauf.torAufrufe).toEqual([{ instanzId: 'pl', befehl: 'npm test', nummer: 1 }])
    const zeilen = lauf.sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.torSpielt(NAME_LOKAL, 'npm test'))).toBe(1)
    expect(zaehle(zeilen, texte.ticker.torBestaetigtLokal(NAME_LOKAL))).toBe(1)
    // Der Anker steht VOR dem Urteil im Ticker: erst bestätigt, dann „Prüfung bestanden".
    const anker = zeilen.indexOf(texte.ticker.torBestaetigtLokal(NAME_LOKAL))
    const urteil = zeilen.indexOf(texte.ticker.pruefungBestanden)
    expect(anker).toBeGreaterThan(-1)
    expect(urteil).toBeGreaterThan(anker)
  })

  it('der Eintrag des lokalen Prüfers trägt torBestaetigung „gruen", urteilLokal „bestanden" und die nachgetragene Abnahme', () => {
    const [lokal] = eintraegeVon(bericht, 'pl')
    expect(lokal.klasse).toBe('lokal')
    expect(lokal.zustand).toBe('pruefung-bestanden')
    expect(lokal.torBestaetigung).toBe('gruen')
    expect(lokal.urteilLokal).toBe('bestanden')
    expect(lokal.abnahme).toEqual({
      instanzId: 'pa',
      block: 'Prüfer',
      zusatz: 'Abnahme',
      urteil: 'bestanden',
      widerspruch: false
    })
  })

  it('der Eintrag der Abnahme trägt abnahmeFuer mit dem Paar — ohne Widerspruch, nicht durchs Tor', () => {
    const [abnahme] = eintraegeVon(bericht, 'pa')
    expect(abnahme.zustand).toBe('pruefung-bestanden')
    expect(abnahme.torBestaetigung).toBeNull()
    expect(abnahme.urteilLokal).toBeNull()
    expect(abnahme.abnahmeFuer).toEqual([
      {
        instanzId: 'pl',
        block: 'Prüfer',
        zusatz: 'lokal',
        modell: LOKAL_MODELL,
        urteilLokal: 'bestanden',
        torBestaetigung: 'gruen',
        urteilAbnahme: 'bestanden',
        widerspruch: false,
        durchTor: false
      }
    ])
    // Nicht-Prüfer und das Sessionende tragen keines der Felder.
    const [bauer] = eintraegeVon(bericht, 'b')
    expect(bauer.abnahmeFuer).toBeUndefined()
    expect(bauer.abnahme).toBeUndefined()
    expect(bauer.torBestaetigung).toBeNull()
  })

  it('der Auftrag der Abnahme trägt hinter dem Beleg den Zusatz „du bist die Abnahme" mit Modell und Tor-Ergebnis', () => {
    const [auftrag] = lauf.motor.auftraege('pa')
    const zusatz = texte.agentenUebergabe.abnahmeLokalerPruefer(
      NAME_LOKAL,
      LOKAL_MODELL,
      texte.tor.bestaetigungFuerAbnahme('gruen')
    )
    expect(auftrag).toContain(zusatz)
    const beleg = texte.agentenUebergabe.eintrag('Prüfbeleg', NAME_LOKAL, '').split('\n')[0]
    expect(auftrag.indexOf(beleg)).toBeGreaterThan(-1)
    expect(auftrag.indexOf(zusatz)).toBeGreaterThan(auftrag.indexOf(beleg))
    // Der lokale Prüfer selbst bekommt keinen Abnahme-Zusatz — er IST keine Abnahme.
    const [auftragLokal] = lauf.motor.auftraege('pl')
    expect(auftragLokal).not.toContain('Du bist seine ABNAHME')
  })

  it('der Ticker sagt, dass die Abnahme das lokale Urteil bestätigt', () => {
    const zeilen = lauf.sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.abnahmeBestaetigt(NAME_ABNAHME, NAME_LOKAL, 'bestanden'))).toBe(1)
    expect(zeilen.some((z) => z.startsWith('Abnahme: „' + NAME_ABNAHME + '" widerspricht'))).toBe(false)
  })
})

// ——— (b) Tor rot → Urteil gedreht, Rückführung zum Bauer ————————————————————

describe('BAUPLAN 50 · (b) Tor rot dreht das lokale „bestanden" — Rückführung zum Bauer', () => {
  let lauf
  let bericht
  beforeAll(async () => {
    // Erster Prüfbefehl-Lauf des lokalen Prüfers rot, danach grün (Vor-Tor der
    // Nachprüfung). Der lokale Prüfer meldet beide Male „bestanden".
    lauf = await laufAufbauen('rot', {
      urteile: { pl: [true, true], pa: [true] },
      tor: (instanzId, nummer) => (instanzId === 'pl' && nummer === 1 ? rot : gruen)
    })
    const { motor, sicht } = lauf
    await motor.freigeben('p')
    await motor.freigeben('b')
    await motor.freigeben('pl')
    await sicht.warteAuf(() => motor.starts('b') === 2, 'Bauer ein zweites Mal gestartet')
    await motor.freigeben('b')
    await motor.freigeben('pl')
    await motor.freigeben('pa')
    await motor.freigeben('s')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    bericht = gespeicherterBericht(lauf.projekt)
  }, 60000)

  it('dreht das Urteil mechanisch: Zustand nicht bestanden, urteilLokal „bestanden", torBestaetigung „rot"', () => {
    const [erster, zweiter] = eintraegeVon(bericht, 'pl')
    expect(erster.zustand).toBe('pruefung-nicht-bestanden')
    expect(erster.urteilLokal).toBe('bestanden')
    expect(erster.torBestaetigung).toBe('rot')
    // Lieferschein und Text des Eintrags kommen aus der Tor-Meldung — EINE Quelle.
    const beleg = erster.meldungen.find((m) => m.art === 'pruefbeleg')
    expect(beleg.urteil).toBe('fehlgeschlagen')
    expect(beleg.beanstandungen.length).toBeGreaterThan(0)
    expect(beleg.beanstandungen[0].text).toContain('der lokale Prüfer hat etwas übersehen')
    expect(erster.ergebnisText).toContain(texte.tor.belegKopf('npm test', 1))
    // Die Nachprüfung: Vor-Tor grün, Agent bestanden — bestätigt ohne zweites Abspielen.
    expect(zweiter.zustand).toBe('pruefung-bestanden')
    expect(zweiter.urteilLokal).toBe('bestanden')
    expect(zweiter.torBestaetigung).toBe('gruen')
    expect(lauf.torAufrufe.filter((t) => t.instanzId === 'pl')).toHaveLength(2)
  })

  it('führt zum Bauer zurück (Reparatur-Runde 1 von 2) mit Tor-Protokoll und Kritik des Tors', () => {
    const { motor, sicht } = lauf
    const zeilen = sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.torDrehtLokal(NAME_LOKAL, 1))).toBe(1)
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 1, 2))).toBe(1)
    expect(motor.starts('b')).toBe(2)
    expect(motor.starts('pl')).toBe(2)
    const [, zweiterAuftrag] = motor.auftraege('b')
    expect(zweiterAuftrag).toContain(texte.agentenUebergabe.prueferRueckmeldung('').split('\n')[0])
    expect(zweiterAuftrag).toContain('der lokale Prüfer hat etwas übersehen')
    expect(zweiterAuftrag).toContain(texte.agentenUebergabe.torProtokoll(ROT_AUSGABE.trim()).split('\n')[0])
    // Die Abnahme startet erst, als das Urteil steht — genau einmal.
    expect(motor.starts('pa')).toBe(1)
  })

  it('die Abnahme liest den bestätigten zweiten Beleg — Paar ohne Widerspruch, Tor „gruen"', () => {
    const [abnahme] = eintraegeVon(bericht, 'pa')
    expect(abnahme.abnahmeFuer).toHaveLength(1)
    expect(abnahme.abnahmeFuer[0]).toMatchObject({
      instanzId: 'pl',
      urteilLokal: 'bestanden',
      torBestaetigung: 'gruen',
      urteilAbnahme: 'bestanden',
      widerspruch: false,
      durchTor: false
    })
    const [erster, zweiter] = eintraegeVon(bericht, 'pl')
    expect(erster.abnahme).toBeUndefined()
    expect(zweiter.abnahme).toMatchObject({ instanzId: 'pa', urteil: 'bestanden', widerspruch: false })
    const [auftrag] = lauf.motor.auftraege('pa')
    expect(auftrag).toContain(texte.tor.bestaetigungFuerAbnahme('gruen'))
  })
})

// ——— (c) Abnahme widerspricht → Rückführung zum BAUER (zurueckZu) ———————————

describe('BAUPLAN 50 · (c) Abnahme widerspricht dem lokalen „bestanden" — zurück zum Bauer, nicht zum lokalen Prüfer', () => {
  let lauf
  let bericht
  beforeAll(async () => {
    lauf = await laufAufbauen('widerspruch', {
      urteile: { pl: [true, true], pa: [false, true] },
      tor: () => gruen
    })
    const { motor, sicht } = lauf
    await motor.freigeben('p')
    await motor.freigeben('b')
    await motor.freigeben('pl')
    await motor.freigeben('pa')
    await sicht.warteAuf(() => motor.starts('b') === 2, 'Bauer ein zweites Mal gestartet')
    await motor.freigeben('b')
    await motor.freigeben('pl')
    await motor.freigeben('pa')
    await motor.freigeben('s')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    bericht = gespeicherterBericht(lauf.projekt)
  }, 60000)

  it('vermerkt den Widerspruch am Abnahme-Eintrag und am lokalen Eintrag', () => {
    const [ersteAbnahme, zweiteAbnahme] = eintraegeVon(bericht, 'pa')
    expect(ersteAbnahme.zustand).toBe('pruefung-nicht-bestanden')
    expect(ersteAbnahme.abnahmeFuer).toEqual([
      {
        instanzId: 'pl',
        block: 'Prüfer',
        zusatz: 'lokal',
        modell: LOKAL_MODELL,
        urteilLokal: 'bestanden',
        torBestaetigung: 'gruen',
        urteilAbnahme: 'fehlgeschlagen',
        widerspruch: true,
        durchTor: false
      }
    ])
    const [ersterLokal, zweiterLokal] = eintraegeVon(bericht, 'pl')
    expect(ersterLokal.abnahme).toEqual({
      instanzId: 'pa',
      block: 'Prüfer',
      zusatz: 'Abnahme',
      urteil: 'fehlgeschlagen',
      widerspruch: true
    })
    // Zweite Runde: lokal erneut bestanden (Tor wieder grün), Abnahme bestätigt.
    expect(zweiterLokal.torBestaetigung).toBe('gruen')
    expect(zweiterLokal.abnahme).toMatchObject({ urteil: 'bestanden', widerspruch: false })
    expect(zweiteAbnahme.zustand).toBe('pruefung-bestanden')
    expect(zweiteAbnahme.abnahmeFuer[0]).toMatchObject({ widerspruch: false, durchTor: false })
  })

  it('der Ticker sagt Widerspruch, danach Bestätigung', () => {
    const zeilen = lauf.sicht.ticker()
    const widerspruch = texte.ticker.abnahmeWiderspricht(NAME_ABNAHME, NAME_LOKAL, 'bestanden', 'fehlgeschlagen')
    const bestaetigt = texte.ticker.abnahmeBestaetigt(NAME_ABNAHME, NAME_LOKAL, 'bestanden')
    expect(zaehle(zeilen, widerspruch)).toBe(1)
    expect(zaehle(zeilen, bestaetigt)).toBe(1)
    expect(zeilen.indexOf(widerspruch)).toBeLessThan(zeilen.indexOf(bestaetigt))
  })

  it('die Rückführung der Abnahme zielt auf den BAUER (zurueckZu) — der lokale Prüfer läuft im Korridor mit', () => {
    const { motor, sicht } = lauf
    const zeilen = sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 1, 2))).toBe(1)
    expect(zeilen.some((z) => z.startsWith('Zurück zu „' + NAME_LOKAL + '"'))).toBe(false)
    expect(motor.starts('b')).toBe(2)
    expect(motor.starts('pl')).toBe(2)
    expect(motor.starts('pa')).toBe(2)
    // Die Kritik der Abnahme kommt beim Bauer an — mit Absender.
    const [, zweiterAuftrag] = motor.auftraege('b')
    expect(zweiterAuftrag).toContain('Von „' + NAME_ABNAHME + '"')
    expect(zweiterAuftrag).toContain('Abnahme: die Prüfung war zu dünn.')
  })
})

// ——— (d) kein Prüfbefehl → „keine" ————————————————————————————————————————

describe('BAUPLAN 50 · (d) lokaler Prüfer ohne Prüfbefehl — keine mechanische Bestätigung, ehrlich gesagt', () => {
  let lauf
  let bericht
  beforeAll(async () => {
    // Ohne Prüfbefehl greift zusätzlich die Prüfbefehl-Pflicht (BAUPLAN 35):
    // genau eine Nachforderung, dann „weiter ohne" — der lokale Prüfer läuft
    // also zweimal, und beide Anläufe enden mit torBestaetigung „keine".
    lauf = await laufAufbauen('keinbefehl', {
      urteile: { pl: [true, true], pa: [true] },
      ohnePruefbefehl: true,
      tor: () => gruen
    })
    const { motor, sicht } = lauf
    for (const id of ['p', 'b', 'pl', 'pl', 'pa', 's']) await motor.freigeben(id)
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    bericht = gespeicherterBericht(lauf.projekt)
  }, 60000)

  it('spielt nichts ab und trägt torBestaetigung „keine" — Urteil bleibt „bestanden"', () => {
    expect(lauf.torAufrufe.filter((t) => t.instanzId === 'pl')).toHaveLength(0)
    const eintraege = eintraegeVon(bericht, 'pl')
    expect(eintraege).toHaveLength(2)
    for (const e of eintraege) {
      expect(e.torBestaetigung).toBe('keine')
      expect(e.urteilLokal).toBe('bestanden')
    }
    expect(eintraege.at(-1).zustand).toBe('pruefung-bestanden')
    const zeilen = lauf.sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.torKeinBefehlLokal(NAME_LOKAL))).toBe(2)
    expect(zaehle(zeilen, texte.ticker.pruefbefehlNachgefordert(NAME_LOKAL))).toBe(1)
  })

  it('die Abnahme erfährt im Auftrag, dass keine mechanische Bestätigung möglich war', () => {
    const [auftrag] = lauf.motor.auftraege('pa')
    expect(auftrag).toContain(texte.tor.bestaetigungFuerAbnahme('keine'))
    const [abnahme] = eintraegeVon(bericht, 'pa')
    expect(abnahme.abnahmeFuer[0]).toMatchObject({
      urteilLokal: 'bestanden',
      torBestaetigung: 'keine',
      urteilAbnahme: 'bestanden',
      widerspruch: false
    })
  })
})

// ——— (e) Urteil der Abnahme vom eigenen Vor-Tor → durchTor ————————————————

describe('BAUPLAN 50 · (e) fällt das Urteil der Abnahme am eigenen Vor-Tor, trägt das Paar durchTor', () => {
  let lauf
  let bericht
  beforeAll(async () => {
    // Runde 1: Abnahme-Agent widerspricht. Runde 2: das Vor-Tor der Abnahme ist
    // rot — kein Agent, Urteil vom Tor (durchTor). Runde 3: Vor-Tor grün, Agent
    // bestätigt. Der lokale Prüfer besteht jedes Mal (sein Tor immer grün).
    lauf = await laufAufbauen('durchtor', {
      urteile: { pl: [true, true, true], pa: [false, true] },
      tor: (instanzId, nummer) => (instanzId === 'pa' && nummer === 1 ? rot : gruen)
    })
    const { motor, sicht } = lauf
    await motor.freigeben('p')
    await motor.freigeben('b')
    await motor.freigeben('pl')
    await motor.freigeben('pa')
    await sicht.warteAuf(() => motor.starts('b') === 2, 'Bauer zum zweiten Mal')
    await motor.freigeben('b')
    await motor.freigeben('pl')
    await sicht.warteAuf(() => motor.starts('b') === 3, 'Bauer zum dritten Mal')
    await motor.freigeben('b')
    await motor.freigeben('pl')
    await motor.freigeben('pa')
    await motor.freigeben('s')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    bericht = gespeicherterBericht(lauf.projekt)
  }, 60000)

  it('das Tor-Urteil der Abnahme ist als durchTor markiert, die Agenten-Urteile nicht', () => {
    const [erste, zweite, dritte] = eintraegeVon(bericht, 'pa')
    expect(lauf.motor.starts('pa')).toBe(2)
    expect(erste.abnahmeFuer[0]).toMatchObject({ urteilAbnahme: 'fehlgeschlagen', widerspruch: true, durchTor: false })
    expect(zweite.zustand).toBe('pruefung-nicht-bestanden')
    expect(zweite.modelle).toBeNull()
    expect(zweite.abnahmeFuer[0]).toMatchObject({ urteilAbnahme: 'fehlgeschlagen', widerspruch: true, durchTor: true })
    expect(dritte.abnahmeFuer[0]).toMatchObject({ urteilAbnahme: 'bestanden', widerspruch: false, durchTor: false })
    const lokal = eintraegeVon(bericht, 'pl')
    expect(lokal).toHaveLength(3)
    expect(lokal[1].abnahme).toMatchObject({ urteil: 'fehlgeschlagen', widerspruch: true })
    expect(lokal[2].abnahme).toMatchObject({ urteil: 'bestanden', widerspruch: false })
    const zeilen = lauf.sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 1, 2))).toBe(1)
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 2, 2))).toBe(1)
  })
})

// ——— Texte (Namensräume von Bauer B) ———————————————————————————————————————

describe('BAUPLAN 50 · Texte ticker/agentenUebergabe/tor', () => {
  it('sind vorhanden und lesbar', () => {
    const tt = texte.ticker
    for (const name of ['torBestaetigtLokal', 'torAltlastenLokal', 'torKeinBefehlLokal', 'torAbgebrochenLokal', 'lokalerPrueferOhneAbnahme'])
      expect(typeof tt[name]('Prüfer · lokal')).toBe('string')
    expect(tt.torDrehtLokal('Prüfer · lokal', 1)).toContain('Fehlerzeile')
    expect(tt.torDrehtLokal('Prüfer · lokal', 2)).toContain('Fehlerzeilen')
    expect(tt.abnahmeBestaetigt('A', 'L', 'bestanden')).toContain('bestätigt')
    expect(tt.abnahmeWiderspricht('A', 'L', 'bestanden', 'fehlgeschlagen')).toContain('widerspricht')
    expect(typeof texte.agentenUebergabe.abnahmeLokalerPruefer('L', 'lokal (x)', 'grün')).toBe('string')
    for (const zustand of ['gruen', 'altlasten', 'rot', 'keine', 'abgebrochen', null])
      expect(typeof texte.tor.bestaetigungFuerAbnahme(zustand)).toBe('string')
    // texte.tor.einstufung bleibt eine Konstante (angriff.md Punkt 8).
    expect(texte.tor.einstufung).toBe('grundsaetzlich')
  })
})
