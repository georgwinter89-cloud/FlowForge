// Prüfungen zur gebündelten Rückführung (BAUPLAN 47): Stehen zwei Prüfer
// hinter EINEM Bauer und fallen beide durch, kostet das EINE Reparatur-Runde —
// der zweite Prüfer hängt seine Beanstandungen an die des ersten an, statt sie
// zu überschreiben, und der Bauer bekommt beide Kritiken mit Absender. Gemessen
// wird VERHALTEN: Der Ablaufplaner fährt echte Läufe mit einem Motor-Ersatz,
// der die Blöcke auf Kommando fertig werden lässt — Ticker, Aufträge, Runden-
// Zählung und Laufende sind echt.
//
// Rot vor Grün: Vor Bauschritt 47 nahm JEDER durchgefallene Prüfer seine eigene
// Reparatur-Runde (budgetNehmen) und setzte ziel.rueckmeldung = kritik — der
// zweite ÜBERSCHRIEB damit die Kritik des ersten. Der Bauer startete zwar nur
// einmal erneut (die Welle lässt ihn erst los, wenn kein Prüfer mehr läuft),
// sein Auftrag trug aber nur die Kritik des zweiten Prüfers und keinen
// Absender; der Ticker zeigte „Reparatur-Runde 1 von 2" UND „2 von 2" für ein
// und dieselbe Reparatur; und ein weiterer Fehlschlag in der Nachprüfung
// stellte die Folgen-Frage, weil das Budget leer war. Genau diese vier Punkte
// misst die erste Prüfung unten — gegen den alten Code gemessen rot: Der zweite
// Auftrag des Bauers trug nur „[grundsätzlich] Die Namen der Teile passen nicht
// zusammen." (B), kein „Von „Prüfer · A"", der Ticker zählte „Reparatur-Runde 2
// von 2", und der dritte Start des Bauers blieb aus (Folgen-Frage statt Runde).
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

// Nur die Enden sind Attrappe, die eine Prüfung nicht haben kann: der Motor
// (er meldet hier, was der Fall verlangt, und wird auf Kommando fertig), der
// Rauchtest (hier: keine Startanleitung) und das Tor (der Prüfbefehl läuft hier
// nicht wirklich — er gilt als grün, damit die Nachprüfung über den Motor-
// Ersatz geht und kein echter Prozess im Prüfordner startet). Prozess-Späher,
// Startanleitungs-Prüfung und Karten kommen ohne Fenster nicht zurecht und
// werden stillgelegt.
const steuerung = vi.hoisted(() => ({ bauen: null }))
vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async () => ({ geprueft: false, gruen: null, code: null, ausgabe: '', grund: 'keine' }),
  befehlAbspielen: async () => ({
    code: 0,
    ausgabe: 'alles grün\n',
    zeitlimit: false,
    abgebrochen: false,
    startFehler: false
  })
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

import { laufStarten, laufZustand } from '../src/main/lauf.js'
import { meldungPruefen, beanstandungenAusMeldungen } from '../src/shared/lieferschein.js'
import { prueferKritik } from '../src/shared/kantenRegeln.js'
import { pruefbefehlSetzen } from '../src/main/pruefbefehl.js'
import { texte } from '../src/shared/texte.js'

// ——— Helfer (Muster aus welle.test.js, dort nicht exportiert) ————————————————

let schreibSchritt = 0
function schreiben(wurzel, relativ, inhalt) {
  const ziel = path.join(wurzel, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  // Die Änderungs-Erkennung der Sicherungspunkte ist sekundengenau — der
  // Abstand wird künstlich hergestellt.
  const spaeter = new Date(Date.now() + 5000 + ++schreibSchritt * 1000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

function gitOrdner(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(app.getPath('userData'), 'sicherungen', schluessel)
}

function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-buendel-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(gitOrdner(wurzel), { recursive: true, force: true })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

// Ein Motor, der Blöcke auf Kommando fertig werden lässt. `bauen` liefert je
// Anlauf die Meldungen; `freigeben(instanzId)` beendet den Anlauf. Solange
// nicht freigegeben, „arbeitet" der Block.
function motorErsatz(ergebnisFuer) {
  const wartend = new Map() // instanzId → aufloesen
  const gestartet = []
  steuerung.bauen = (optionen) => ({
    sessionKennung: null,
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      // Der Auftrag wird beim START gemerkt — der Anlauf kann noch unbeendet
      // sein, wenn die Prüfung ihn schon lesen will.
      gestartet.push({ instanzId: block.instanzId, zeit: Date.now(), auftrag: block.auftrag })
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
      const bis = Date.now() + 5000
      while (!wartend.has(instanzId) && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
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
      const bis = Date.now() + 8000
      while (!pruefung() && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      if (!pruefung()) throw new Error('Nicht eingetreten: ' + was)
    }
  }
}

const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }
function paketMeldung(block, listen) {
  const pakete = block.ziele.map((ziel) => ({
    zielBlock: ziel.adresse,
    ziel: 'Teil ' + ziel.name,
    fertigKriterien: ['Läuft.'],
    erlaubteDateien: listen[ziel.instanzId]
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
function angriffsMeldung() {
  return [meldungPruefen('funde', { ...rahmen, funde: [] }, 'Angriffsliste').meldung]
}
// Je Prüfer eine eigene Beanstandung — nur so ist messbar, WESSEN Kritik beim
// Bauer ankommt.
function pruefMeldung(bestanden, beanstandung) {
  const roh = bestanden
    ? { ...rahmen, urteil: 'bestanden', beanstandungen: [], rotVorGruen: '', geprueft: [] }
    : {
        ...rahmen,
        urteil: 'fehlgeschlagen',
        beanstandungen: [{ einstufung: 'grundsaetzlich', text: beanstandung, fundort: '' }],
        rotVorGruen: '',
        geprueft: []
      }
  const ergebnis = meldungPruefen('pruefbeleg', roh, 'Prüfbeleg')
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}
// So baut FlowForge aus einem Prüfbeleg die Kritik für den Bauer.
const kritikAus = (meldungen) => prueferKritik(beanstandungenAusMeldungen(meldungen)).text

function workflowSchreiben(projekt, bloecke, pfeile, reparaturRunden = 0) {
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden, uebertragGrenze: 5, bloecke, pfeile }),
    'utf8'
  )
}

// Paket schneiden → Bauer → Prüfer · A und Bauer → Prüfer · B. Beide Prüfer
// laufen nebeneinander (Prüfer neben Prüfer ist seit 46 erlaubt), der Bauer
// darf erst wieder los, wenn keiner mehr prüft.
const bloecke = [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Ein Teil' } },
  { instanzId: 'b', blockId: 'bauer', zusatz: '' },
  { instanzId: 'pa', blockId: 'pruefer', zusatz: 'A' },
  { instanzId: 'pb', blockId: 'pruefer', zusatz: 'B' }
]
const pfeile = [
  { von: 'p', nach: 'b' },
  { von: 'b', nach: 'pa' },
  { von: 'b', nach: 'pb' }
]
const listen = { b: ['src/b/'] }
const KRITIK_A = 'Der Aufbau trägt nicht.'
const KRITIK_B = 'Die Namen der Teile passen nicht zusammen.'
const teilA = texte.agentenUebergabe.prueferRueckmeldungTeil('Prüfer · A', kritikAus(pruefMeldung(false, KRITIK_A)))
const teilB = texte.agentenUebergabe.prueferRueckmeldungTeil('Prüfer · B', kritikAus(pruefMeldung(false, KRITIK_B)))

// Ein Lauf mit diesem Schaubild (oder einem übergebenen); `urteile` sagt je
// Prüfer, wie sein n-ter Anlauf ausgeht. Liefert Motor und Sicht; freigegeben
// sind danach Paket schneiden und — falls vorhanden — der Angreifer und der
// erste Anlauf des Bauers, beide Prüfer sind gestartet.
async function laufAufbauen(name, urteile, schaubild = { bloecke, pfeile }) {
  const projekt = frischesProjekt(name)
  workflowSchreiben(projekt, schaubild.bloecke, schaubild.pfeile, 2)
  schreiben(projekt, 'src/b/y.js', 'b alt\n')
  const anlaeufe = {}
  const motor = motorErsatz(async (block, optionen) => {
    if (block.instanzId === 'p') {
      optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
      return paketMeldung(block, listen)
    }
    // Der Angreifer (nur lesend) meldet eine leere Angriffsliste.
    if (block.instanzId === 'a') return angriffsMeldung()
    if (block.instanzId === 'b') {
      schreiben(projekt, 'src/b/neu.js', 'gebaut ' + motor.starts('b') + '\n')
      return umsetzungsMeldung()
    }
    // Prüfer: schreibt einen Test in seine Prüfmappe und setzt den Prüfbefehl
    // (Pflicht); sein Urteil kommt aus dem Plan des Falls.
    schreiben(projekt, 'pruefung/' + block.pruefOrdner + '/probe.test.js', 'test\n')
    pruefbefehlSetzen(projekt, block.instanzId, 'npm test')
    anlaeufe[block.instanzId] = (anlaeufe[block.instanzId] ?? 0) + 1
    const bestanden = urteile[block.instanzId][anlaeufe[block.instanzId] - 1]
    if (bestanden === undefined) throw new Error('Kein Urteil geplant für ' + block.instanzId)
    return pruefMeldung(bestanden, block.instanzId === 'pa' ? KRITIK_A : KRITIK_B)
  })
  const sicht = fensterErsatz()
  expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
  await motor.freigeben('p')
  if (schaubild.bloecke.some((b) => b.instanzId === 'a')) await motor.freigeben('a')
  await motor.freigeben('b')
  await sicht.warteAuf(
    () => ['pa', 'pb'].every((id) => motor.starts(id) === 1),
    'beide Prüfer gestartet'
  )
  return { projekt, motor, sicht }
}

const zaehle = (zeilen, zeile) => zeilen.filter((z) => z === zeile).length

describe('BAUPLAN 47 · Zwei Prüfer hinter einem Bauer fallen durch — EINE Reparatur-Runde, beide Kritiken', () => {
  // Runde 1: A und B fallen durch. Nachprüfung: B besteht, A fällt noch einmal
  // durch (das misst, dass die zweite Runde noch da ist). Danach besteht A.
  let lauf
  beforeAll(async () => {
    lauf = await laufAufbauen('beide', { pa: [false, false, true], pb: [false, true] })
    const { motor, sicht } = lauf
    // A urteilt zuerst — und der Planer hat A verarbeitet, bevor B dran ist.
    await motor.freigeben('pa')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.rueckfuehrung('Bauer', 1, 2)),
      'Rückführung durch A'
    )
    // Der Bauer wartet derweil: B prüft noch.
    expect(motor.starts('b')).toBe(1)
    await motor.freigeben('pb')
    await sicht.warteAuf(() => motor.starts('b') === 2, 'Bauer ein zweites Mal gestartet')
  }, 30000)

  it('schickt den Bauer GENAU EINMAL zurück, mit beiden Kritiken unter ihrem Absender', () => {
    const { motor } = lauf
    expect(motor.starts('b')).toBe(2)
    const auftraege = motor.auftraege('b')
    const auftrag = auftraege[1]
    expect(auftrag).toContain(teilA)
    expect(auftrag).toContain(teilB)
    // A hat zuerst geurteilt — seine Kritik steht vorn; der Einleitungssatz
    // steht genau einmal davor.
    expect(auftrag.indexOf(teilA)).toBeLessThan(auftrag.indexOf(teilB))
    const einleitung = texte.agentenUebergabe.prueferRueckmeldung('')
    expect(auftrag.split(einleitung)).toHaveLength(2)
    // Der erste Auftrag des Bauers trug keine Rückmeldung.
    expect(auftraege[0]).not.toContain(einleitung)
  })

  it('zählt EINE Reparatur-Runde und sagt im Ticker, dass B gebündelt wurde', () => {
    const zeilen = lauf.sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 1, 2))).toBe(1)
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 2, 2))).toBe(0)
    expect(zaehle(zeilen, texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 1))).toBe(1)
    expect(zeilen.some((z) => z.startsWith('„Prüfer · A" schickt'))).toBe(false)
    // Beide Übergaben stehen im Ticker — je Prüfer eine Beanstandung.
    expect(zaehle(zeilen, texte.ticker.beanstandungenUebergeben(1, 'Bauer'))).toBe(2)
    // Der Bauer startet erst, nachdem B gebündelt hat — nie dazwischen.
    const startBauer = zeilen.lastIndexOf(texte.ticker.blockStartet(2, 4, 'Bauer'))
    const gebuendelt = zeilen.indexOf(texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 1))
    expect(gebuendelt).toBeGreaterThan(-1)
    expect(startBauer).toBeGreaterThan(gebuendelt)
  })

  it('lässt beide Prüfer nachprüfen — und die zweite Runde ist noch da, keine Folgen-Frage', async () => {
    const { motor, sicht } = lauf
    await motor.freigeben('b')
    await sicht.warteAuf(
      () => ['pa', 'pb'].every((id) => motor.starts(id) === 2),
      'beide Prüfer in der Nachprüfung'
    )
    // B besteht zuerst, dann fällt A noch einmal durch: Runde 2 von 2 — ehrlich
    // gezählt, statt der Folgen-Frage, die ein leeres Budget stellen würde.
    await motor.freigeben('pb')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.pruefungBestanden),
      'B bestanden'
    )
    await motor.freigeben('pa')
    await sicht.warteAuf(() => motor.starts('b') === 3, 'Bauer ein drittes Mal gestartet')
    const zeilen = sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 2, 2))).toBe(1)
    expect(sicht.ereignisse.some((e) => e.art === 'entscheidung')).toBe(false)
    expect(laufZustand(lauf.projekt).entscheidung ?? null).toBeNull()
    // Der dritte Auftrag trägt nur noch A's Kritik — B war zufrieden.
    expect(motor.auftraege('b')[2]).toContain(teilA)
    expect(motor.auftraege('b')[2]).not.toContain(teilB)
    // Kein Bündel mehr: B hat nichts mehr zurückgeschickt.
    expect(zaehle(zeilen, texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 1))).toBe(1)
    // Zu Ende: A prüft allein nach (B bleibt fertig) und besteht.
    await motor.freigeben('b')
    await sicht.warteAuf(() => motor.starts('pa') === 3, 'A prüft ein drittes Mal')
    expect(motor.starts('pb')).toBe(2)
    await motor.freigeben('pa')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
    expect(motor.starts('b')).toBe(3)
  }, 30000)
})

describe('BAUPLAN 47 · Nur ein Prüfer fällt durch — kein Bündel, der Bauer bekommt nur dessen Kritik', () => {
  let lauf
  beforeAll(async () => {
    lauf = await laufAufbauen('einer', { pa: [false, true], pb: [true] })
    const { motor, sicht } = lauf
    await motor.freigeben('pa')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.rueckfuehrung('Bauer', 1, 2)),
      'Rückführung durch A'
    )
    await motor.freigeben('pb')
    await sicht.warteAuf(() => motor.starts('b') === 2, 'Bauer ein zweites Mal gestartet')
  }, 30000)

  it('schreibt die Kritik mit Absender, aber ohne Bündel-Zeile', async () => {
    const { motor, sicht } = lauf
    const auftrag = motor.auftraege('b')[1]
    expect(auftrag).toContain(teilA)
    expect(auftrag).not.toContain('Von „Prüfer · B"')
    const zeilen = sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Bauer', 1, 2))).toBe(1)
    expect(zeilen.some((z) => z.includes('gebündelt'))).toBe(false)
    expect(zaehle(zeilen, texte.ticker.pruefungBestanden)).toBe(1)
    // Nur A prüft nach; B bleibt fertig.
    await motor.freigeben('b')
    await sicht.warteAuf(() => motor.starts('pa') === 2, 'A prüft nach')
    expect(motor.starts('pb')).toBe(1)
    await motor.freigeben('pa')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
    expect(sicht.ereignisse.find((e) => e.art === 'fertig').zustand).toBe('erfolgreich')
    expect(motor.starts('b')).toBe(2)
  }, 30000)
})

describe('BAUPLAN 47 · Nachgeholte Rückführung bei laufendem Ziel (Nacharbeit, Prüfer-Befund)', () => {
  // Paket schneiden → Angreifer → Bauer → Prüfer · A ∥ Prüfer · B, beide
  // schicken zum ANGREIFER zurück. Der ist nur-lesend und startet nach A's
  // Urteil sofort neben dem noch prüfenden B. Fällt B durch, während der
  // Angreifer läuft, hat der seine Rückmeldung schon gelesen — B nimmt ehrlich
  // Runde 2 und legt seine Kritik auf den LAUFENDEN Block. Rot vor Grün: Bis
  // zu dieser Nacharbeit wischte das Blockende diese Kritik mit (Runde
  // verbrannt, B's Beanstandung erreichte niemanden) — der Angreifer startete
  // genau 2×, kein dritter Anlauf, keine Zeile „lief schon, als diese
  // Rückmeldung kam" (so gemessen).
  const bloeckeA = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Ein Teil' } },
    { instanzId: 'a', blockId: 'angreifer', zusatz: '' },
    { instanzId: 'b', blockId: 'bauer', zusatz: '' },
    { instanzId: 'pa', blockId: 'pruefer', zusatz: 'A', zurueckZu: 'a' },
    { instanzId: 'pb', blockId: 'pruefer', zusatz: 'B', zurueckZu: 'a' }
  ]
  const pfeileA = [
    { von: 'p', nach: 'a' },
    { von: 'a', nach: 'b' },
    { von: 'b', nach: 'pa' },
    { von: 'b', nach: 'pb' }
  ]
  let lauf
  beforeAll(async () => {
    lauf = await laufAufbauen('nachgeholt', { pa: [false, true], pb: [false, true] }, {
      bloecke: bloeckeA,
      pfeile: pfeileA
    })
  }, 30000)

  it("nimmt Runde 2 auf den laufenden Angreifer — ohne Bündel —, und der läuft danach gleich noch einmal mit B's Kritik", async () => {
    const { motor, sicht } = lauf
    expect(motor.starts('a')).toBe(1)
    await motor.freigeben('pa')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.rueckfuehrung('Angreifer', 1, 2)),
      'Rückführung durch A'
    )
    // Der Angreifer startet sofort neben dem noch laufenden Prüfer · B.
    await sicht.warteAuf(() => motor.starts('a') === 2, 'Angreifer ein zweites Mal gestartet')
    expect(laufZustand(lauf.projekt).blockInstanzIds.sort()).toEqual(['a', 'pb'])
    expect(motor.auftraege('a')[1]).toContain(teilA)
    // B fällt durch, während der Angreifer läuft: Runde 2, kein Bündel.
    await motor.freigeben('pb')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.rueckfuehrung('Angreifer', 2, 2)),
      'Rückführung durch B'
    )
    expect(sicht.ticker().some((z) => z.includes('gebündelt'))).toBe(false)
    expect(motor.starts('a')).toBe(2)
    // Der Angreifer beendet Anlauf 2 — und läuft mit B's Kritik gleich noch einmal.
    await motor.freigeben('a')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.rueckfuehrungNachgeholt('Angreifer')),
      'nachgeholte Rückführung'
    )
    await sicht.warteAuf(() => motor.starts('a') === 3, 'Angreifer ein drittes Mal gestartet')
    const dritter = motor.auftraege('a')[2]
    expect(dritter).toContain(teilB)
    expect(dritter).not.toContain(teilA)
    const zeilen = sicht.ticker()
    expect(zaehle(zeilen, texte.ticker.rueckfuehrungNachgeholt('Angreifer'))).toBe(1)
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Angreifer', 1, 2))).toBe(1)
    expect(zaehle(zeilen, texte.ticker.rueckfuehrung('Angreifer', 2, 2))).toBe(1)
    expect(sicht.ereignisse.some((e) => e.art === 'entscheidung')).toBe(false)
  }, 30000)

  it('bringt den Lauf danach regulär zu Ende — Bauer, beide Prüfer bestehen', async () => {
    const { motor, sicht } = lauf
    await motor.freigeben('a')
    await sicht.warteAuf(() => motor.starts('b') === 2, 'Bauer ein zweites Mal gestartet')
    await motor.freigeben('b')
    await sicht.warteAuf(
      () => ['pa', 'pb'].every((id) => motor.starts(id) === 2),
      'beide Prüfer in der Nachprüfung'
    )
    await motor.freigeben('pa')
    await motor.freigeben('pb')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
    expect(motor.starts('a')).toBe(3)
    expect(motor.starts('b')).toBe(2)
    expect(motor.starts('pa')).toBe(2)
    expect(motor.starts('pb')).toBe(2)
    // Jeder Anlauf des Angreifers steht im Bericht — auch der nachgeholte.
    expect(ende.bericht.blockErgebnisse.filter((b) => b.instanzId === 'a')).toHaveLength(3)
  }, 30000)
})

describe('BAUPLAN 47 · Die neuen Zeilen sind für Georg geschrieben', () => {
  const zeilen = [
    texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 1),
    texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 3),
    texte.ticker.rueckfuehrungNachgeholt('Angreifer'),
    texte.agentenUebergabe.prueferRueckmeldungTeil('Prüfer · A', '[grundsätzlich] Der Aufbau trägt nicht.')
  ]

  it('kommen ohne Technik-Wörter aus und nennen die Beteiligten', () => {
    for (const zeile of zeilen) {
      expect(zeile).not.toMatch(/\b(Git|Branch|Commit|Merge|Repo|ref|Promise|Race)\b/i)
      expect(zeile.length).toBeGreaterThan(20)
    }
    expect(texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 1)).toContain('„Prüfer · B"')
    expect(texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 1)).toContain('„Bauer"')
    expect(texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 1)).toMatch(/1 Beanstandung\b/)
    expect(texte.ticker.rueckfuehrungGebuendelt('Prüfer · B', 'Bauer', 3)).toMatch(/3 Beanstandungen/)
    expect(texte.agentenUebergabe.prueferRueckmeldungTeil('Prüfer · A', 'x')).toMatch(/^Von „Prüfer · A":\n/)
    expect(texte.ticker.rueckfuehrungNachgeholt('Angreifer')).toContain('„Angreifer"')
  })
})
