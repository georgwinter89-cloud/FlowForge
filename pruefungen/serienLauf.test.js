// Serienlauf im echten Lauf (Bauschritt 61): Gemessen am Ablaufplaner mit
// Motor-Ersatz (Muster: kartenAuswahlAufgaben.test.js) — echt sind laufStarten,
// der Serien-Hook am Laufende, die Übernahme des Vorschlags, Wiederholung,
// Sperren und Laufstand; Attrappe sind nur Motor, Rauchtest, Prozessgruppe,
// Startanleitung und das Kartenladen.
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es keine Serie — nach einem
// erfolgreichen Lauf startete NIE von selbst ein zweiter (Prüfung 1 und 2
// liefen rot: kein zweiter Auftrag, kein bericht.serie), ein Fehlschlag wurde
// nie wiederholt (Prüfung 3), laufStarten kannte weder die Sperre
// serieLaeuft noch das 7. Argument (Prüfung 5), und der Laufstand trug kein
// serie-Feld (Prüfung 7). serieBeenden existierte nicht (Prüfung 4).
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const steuerung = vi.hoisted(() => ({ bauen: null, auftraege: [] }))
// Mutabler Kartenbestand: Die Prüfungen stellen ihn je Szenario neu und
// dürfen mitten im „Lauf" Karten erledigen — genau wie ein echtes Sessionende.
const KARTEN = vi.hoisted(() => [])
vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async () => ({ geprueft: true, gruen: true })
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
// Die Karten sind Attrappe, weil kartenLaden nur für REGISTRIERTE Projekte
// liest (projekte.json im Datenordner) — geprüft wird hier die Serien-Mechanik,
// nicht das Laden.
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: KARTEN })
}))

import {
  laufStarten,
  laufZustand,
  laufstandInfo,
  laufberichteLaden,
  serieBeenden
} from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { eigeneBloeckeSetzen, DENKTIEFE_STANDARD } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const status = { id: '11111111-aaaa-4000-8000-000000000001', sorte: 'status', titel: 'Stand', text: 'Wir stehen bei null.', erledigt: false }
const aufgabe1 = { id: '22222222-bbbb-4000-8000-000000000002', sorte: 'aufgabe', erledigt: false, thema: 'Motor', titel: 'Ticker aufräumen', text: 'Die doppelten Zeilen im Ticker müssen weg.' }
const aufgabe2 = { id: '33333333-cccc-4000-8000-000000000003', sorte: 'aufgabe', erledigt: false, thema: 'Motor', titel: 'Absturz beheben', text: 'Der Start bricht mit Fehlercode ab.' }

function kartenStellen(...karten) {
  KARTEN.length = 0
  // Flache Kopien — die Szenarien dürfen erledigt setzen, ohne dass ein
  // späteres describe den veränderten Zustand erbt.
  KARTEN.push(...karten.map((k) => ({ ...k })))
}

function projektAnlegen(name, workflow) {
  const projekt = path.join(os.tmpdir(), `flowforge-serie-${name}-${process.pid}`)
  fs.rmSync(projekt, { recursive: true, force: true })
  fs.mkdirSync(projekt, { recursive: true })
  fs.writeFileSync(path.join(projekt, 'workflow.json'), JSON.stringify(workflow), 'utf8')
  return projekt
}

const spaeherWorkflow = {
  reparaturRunden: 0,
  uebertragGrenze: 5,
  bloecke: [{ instanzId: 'a', blockId: 'spaeher', zusatz: '' }],
  pfeile: []
}

// Der „Werkzeug-Ersatz" fürs Sessionende: legt den Vorschlag genau so ab, wie
// laufVorschlagSpeichern es täte — die Serie liest die DATEI, nicht den Bericht.
function vorschlagAblegen(projekt, kartenIds) {
  fs.writeFileSync(
    path.join(projekt, 'naechster-lauf.json'),
    JSON.stringify({ kartenIds, empfehlung: 'Weiter damit.', begruendung: '', erstelltAm: new Date().toISOString() }),
    'utf8'
  )
}

function motorErsatz() {
  const wartend = new Map()
  steuerung.bauen = () => ({
    sessionKennung: 'serie-session',
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      steuerung.auftraege.push({ instanzId: block.instanzId, auftrag: block.auftrag })
      return new Promise((aufloesen) => wartend.set(block.instanzId, aufloesen))
    }
  })
  return {
    // Wartet, bis der Planer den Block wirklich gestartet hat — die
    // Synchronisation über die Runden hinweg: Runde n+1 registriert denselben
    // Block erneut, nachdem freigeben den alten Auflöser verbraucht hat.
    async warteAufStart(instanzId) {
      const bis = Date.now() + 15000
      while (!wartend.has(instanzId) && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      if (!wartend.has(instanzId)) throw new Error('Block nie gestartet: ' + instanzId)
    },
    async freigeben(instanzId, { rot = false } = {}) {
      await this.warteAufStart(instanzId)
      const los = wartend.get(instanzId)
      wartend.delete(instanzId)
      los(
        rot
          ? {
              zustand: 'fehlgeschlagen',
              ergebnisText: '',
              meldungen: [],
              fehlertext: 'Absichtlich rot für die Prüfung.',
              fehlerArt: null,
              verbrauch: null,
              denktiefeGemessen: null
            }
          : {
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
              verbrauch: null,
              denktiefeGemessen: null
            }
      )
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
    async warteAufFertig(anzahl) {
      const bis = Date.now() + 40000
      while (ereignisse.filter((e) => e.art === 'fertig').length < anzahl && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      const fertige = ereignisse.filter((e) => e.art === 'fertig')
      if (fertige.length < anzahl) throw new Error('Nicht genug Läufe fertig geworden')
      return fertige
    }
  }
}

// Der Laufstand wird nach jedem Blockergebnis geschrieben und am Laufende
// gelöscht — gelesen wird deshalb im Fenster dazwischen (Prüfung 7).
async function laufstandMitSerieLesen(projekt) {
  const bis = Date.now() + 5000
  while (Date.now() < bis) {
    try {
      const stand = JSON.parse(fs.readFileSync(path.join(projekt, 'laufstand.json'), 'utf8'))
      if (stand.serie) return stand
    } catch {
      // Datei gerade nicht (mehr) da — weiter versuchen.
    }
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error('Kein Laufstand mit serie-Feld gefunden')
}

describe('Bauschritt 61 · Serie mit Vorschlag: drei Runden laufen von selbst', () => {
  const projekt = projektAnlegen('vorschlag', spaeherWorkflow)
  let sicht
  let berichte
  let fremdstart
  let zustandRunde1
  let laufstandRunde1
  let standRunde2

  beforeAll(async () => {
    kartenStellen(status, aufgabe1, aufgabe2)
    steuerung.auftraege = []
    const motor = motorErsatz()
    sicht = fensterErsatz()
    expect(
      await laufStarten(sicht.fenster, projekt, [aufgabe1.id], null, false, null, { runden: 3 })
    ).toEqual({ ok: true })
    // Runde 1 läuft — jetzt gilt die Sperre gegen fremde Starts,
    // laufZustand trägt das serie-Feld und die Wiederaufnahme schweigt.
    await motor.warteAufStart('a')
    fremdstart = await laufStarten(sicht.fenster, projekt, null)
    zustandRunde1 = laufZustand(projekt)
    laufstandRunde1 = laufstandInfo(projekt)
    // Der „Werkzeug-Ersatz" des Sessionendes: Vorschlag für Runde 2 ablegen.
    vorschlagAblegen(projekt, [aufgabe2.id])
    await motor.freigeben('a')
    // Runde 2 startet von selbst — mit den Vorschlags-Karten.
    await motor.warteAufStart('a')
    await motor.freigeben('a')
    // Direkt nach dem Blockergebnis schreibt der Planer den Laufstand von
    // Runde 2 — das Zeitfenster bis zur Löschung am Laufende ist breit (der
    // Aufräum-Schlaf am Laufende hält es offen).
    standRunde2 = await laufstandMitSerieLesen(projekt)
    // Runde 3 (kein Vorschlag mehr — der Start von Runde 2 hat ihn abgeräumt).
    await motor.warteAufStart('a')
    await motor.freigeben('a')
    await sicht.warteAufFertig(3)
    // Kein vierter Lauf: kurz warten, dann muss Ruhe sein.
    await new Promise((r) => setTimeout(r, 400))
    berichte = laufberichteLaden(projekt).berichte
  }, 90000)

  it('sperrt fremde Starts über die ganze Serie', () => {
    expect(fremdstart).toEqual({ ok: false, fehler: texte.lauf.serieLaeuft })
  })

  it('meldet die Serie in laufZustand und schweigt bei der Wiederaufnahme', () => {
    expect(zustandRunde1.serie).toEqual({ runde: 1, gesamt: 3, beendenAngefordert: false })
    expect(laufstandRunde1).toEqual({ ok: true, vorhanden: false })
  })

  it('startet Runde 2 von selbst mit den Vorschlags-Karten', () => {
    expect(steuerung.auftraege).toHaveLength(3)
    const auftragRunde2 = steuerung.auftraege[1].auftrag
    expect(auftragRunde2).toContain(aufgabe2.text)
    expect(auftragRunde2).not.toContain(aufgabe1.text)
  })

  it('tickert die Vorschlags-Zeile in Runde 2 und verweist auf die Vorrunde', () => {
    const [b3, b2, b1] = berichte
    expect(b1.serie).toEqual({ runde: 1, gesamt: 3, vorigerLaufId: null })
    expect(b1.ticker.some((z) => z.text === texte.ticker.serieErsteRunde(3))).toBe(true)
    expect(b1.ticker.some((z) => z.text === texte.ticker.serieWeiter(1, 3))).toBe(true)
    expect(b2.serie).toEqual({ runde: 2, gesamt: 3, vorigerLaufId: b1.id })
    expect(
      b2.ticker.some((z) => z.text === texte.ticker.serieRundeVorschlag(2, 3, [aufgabe2.titel]))
    ).toBe(true)
    expect(b3.serie).toEqual({ runde: 3, gesamt: 3, vorigerLaufId: b2.id })
  })

  it('fällt ohne Vorschlag auf die normale Vorauswahl zurück (Runde 3)', () => {
    const [b3] = berichte
    expect(b3.ticker.some((z) => z.text === texte.ticker.serieRundeVorauswahl(3, 3))).toBe(true)
    // Vorauswahl = alle offenen Aufgaben, beide Texte im Volltext.
    const auftragRunde3 = steuerung.auftraege[2].auftrag
    expect(auftragRunde3).toContain(aufgabe1.text)
    expect(auftragRunde3).toContain(aufgabe2.text)
  })

  it('endet nach der letzten Runde — kein vierter Lauf, Abschluss im Bericht', () => {
    const [b3] = berichte
    expect(b3.ticker.some((z) => z.text === texte.ticker.serieEndeAbgeschlossen(3))).toBe(true)
    expect(berichte).toHaveLength(3)
    expect(steuerung.auftraege).toHaveLength(3)
    expect(laufZustand(projekt).serie).toBeNull()
    expect(laufZustand(projekt).wartet).toBe(false)
    expect(sicht.ereignisse.some((e) => e.art === 'serie-fehler')).toBe(false)
  })

  it('trägt den Serienstand im Laufstand von Runde 2 (Prüfung 7)', () => {
    expect(standRunde2.serie).toEqual({
      gesamt: 3,
      runde: 2,
      wiederholungVerbraucht: false,
      beendenAngefordert: false
    })
  })
})

describe('Bauschritt 61 · Fehlschlag: genau eine Wiederholung mit denselben Karten', () => {
  const projekt = projektAnlegen('fehlschlag', spaeherWorkflow)
  let berichte

  beforeAll(async () => {
    kartenStellen(status, aufgabe1, aufgabe2)
    steuerung.auftraege = []
    const motor = motorErsatz()
    const sicht = fensterErsatz()
    expect(
      await laufStarten(sicht.fenster, projekt, [aufgabe1.id], null, false, null, { runden: 3 })
    ).toEqual({ ok: true })
    await motor.freigeben('a', { rot: true })
    // Die Wiederholung startet von selbst — und scheitert wieder.
    await motor.warteAufStart('a')
    await motor.freigeben('a', { rot: true })
    await sicht.warteAufFertig(2)
    await new Promise((r) => setTimeout(r, 400))
    berichte = laufberichteLaden(projekt).berichte
  }, 90000)

  it('wiederholt mit denselben Karten und tickert die Wiederholungs-Zeile', () => {
    expect(steuerung.auftraege).toHaveLength(2)
    expect(steuerung.auftraege[1].auftrag).toContain(aufgabe1.text)
    // „Dieselben Karten" heißt NICHT „die Vorauswahl": aufgabe2 ist offen und
    // stünde bei einem stillen Rückfall auf die Vorauswahl im Volltext — die
    // Gegenprobe hält den Namen der Wiederholung fest (Befund Prüfer 1: ohne
    // sie blieb ein auf null verstümmeltes letzteKarten unbemerkt grün).
    expect(steuerung.auftraege[1].auftrag).not.toContain(aufgabe2.text)
    const [b2, b1] = berichte
    expect(b1.ticker.some((z) => z.text === texte.ticker.serieWeiter(1, 3))).toBe(true)
    expect(b2.ticker.some((z) => z.text === texte.ticker.serieRundeWiederholung(2, 3))).toBe(true)
    expect(b2.serie).toEqual({ runde: 2, gesamt: 3, vorigerLaufId: b1.id })
  })

  it('endet nach dem zweiten Fehlschlag — kein dritter Lauf trotz n=3', () => {
    expect(berichte).toHaveLength(2)
    const [b2] = berichte
    expect(b2.zustand).toBe('fehlgeschlagen')
    expect(b2.ticker.some((z) => z.text === texte.ticker.serieEndeFehlschlag)).toBe(true)
    expect(laufZustand(projekt).serie).toBeNull()
  })
})

describe('Bauschritt 61 · „Serie beenden": der Lauf endet normal, keine Runde 2', () => {
  const projekt = projektAnlegen('beenden', spaeherWorkflow)
  let berichte
  let beendet
  let zustandDanachAngefordert

  beforeAll(async () => {
    kartenStellen(status, aufgabe1)
    steuerung.auftraege = []
    const motor = motorErsatz()
    const sicht = fensterErsatz()
    expect(
      await laufStarten(sicht.fenster, projekt, [aufgabe1.id], null, false, null, { runden: 3 })
    ).toEqual({ ok: true })
    await motor.warteAufStart('a')
    beendet = serieBeenden(projekt)
    zustandDanachAngefordert = laufZustand(projekt).serie
    await motor.freigeben('a')
    await sicht.warteAufFertig(1)
    await new Promise((r) => setTimeout(r, 400))
    berichte = laufberichteLaden(projekt).berichte
  }, 90000)

  it('nimmt den Wunsch an und zeigt ihn im serie-Feld', () => {
    expect(beendet).toEqual({ ok: true })
    expect(zustandDanachAngefordert).toEqual({ runde: 1, gesamt: 3, beendenAngefordert: true })
  })

  it('lässt Runde 1 zu Ende laufen und startet keine Runde 2', () => {
    expect(berichte).toHaveLength(1)
    expect(berichte[0].zustand).toBe('erfolgreich')
    expect(berichte[0].ticker.some((z) => z.text === texte.ticker.serieEndeGewuenscht)).toBe(true)
    expect(steuerung.auftraege).toHaveLength(1)
    expect(laufZustand(projekt).serie).toBeNull()
  })

  it('lehnt „Serie beenden" ohne Serie ehrlich ab', () => {
    expect(serieBeenden(projekt).ok).toBe(false)
  })
})

// Ein eigener Block mit Auftragsquellen-Feld (oderOffeneAufgaben), aber OHNE
// die Zuschnitt-Pflichten der Katalog-Auftragsquellen — so bleibt der
// Motor-Ersatz beim erprobten Meldungs-Muster.
const QUELLEN_BLOCK = {
  id: 'eigen-serien-quelle',
  name: 'Serien-Quelle',
  symbol: '🧪',
  beschreibung: 'Prüfblock für die Auftragsquellen-Vorabprüfung der Serie.',
  auftrag: 'Sieh dich um und melde dich.',
  braucht: [],
  brauchtOptional: [],
  brauchtWozu: {},
  liefert: ['Projekt-Überblick'],
  bereich: 'auftrag',
  modell: 'standard',
  denktiefe: DENKTIEFE_STANDARD,
  nurLesen: true,
  prueft: false,
  erzeugtAufgaben: false,
  darfKartenAnlegen: false,
  uebung: false,
  eigen: true,
  felder: [
    {
      id: 'wunsch',
      label: 'Was soll gebaut werden?',
      platzhalter: '',
      pflicht: false,
      oderOffeneAufgaben: true
    }
  ]
}

describe('Bauschritt 61 · Keine offenen Aufgaben mehr: Klartext statt Fehlstart', () => {
  const projekt = projektAnlegen('keineaufgaben', {
    reparaturRunden: 0,
    uebertragGrenze: 5,
    bloecke: [{ instanzId: 'q', blockId: QUELLEN_BLOCK.id, zusatz: '' }],
    pfeile: []
  })
  let sicht
  let berichte

  beforeAll(async () => {
    eigeneBloeckeSetzen([QUELLEN_BLOCK])
    kartenStellen(status, aufgabe1)
    steuerung.auftraege = []
    const motor = motorErsatz()
    sicht = fensterErsatz()
    expect(
      await laufStarten(sicht.fenster, projekt, [aufgabe1.id], null, false, null, { runden: 3 })
    ).toEqual({ ok: true })
    await motor.warteAufStart('q')
    // Das Sessionende schlägt die eben erledigte Aufgabe und eine längst
    // gelöschte Karte vor — beide fallen bei der Übernahme heraus, und offen
    // ist danach nichts mehr.
    vorschlagAblegen(projekt, [aufgabe1.id, '99999999-0000-4000-8000-000000000009'])
    KARTEN.find((k) => k.id === aufgabe1.id).erledigt = true
    await motor.freigeben('q')
    await sicht.warteAufFertig(1)
    await new Promise((r) => setTimeout(r, 400))
    berichte = laufberichteLaden(projekt).berichte
  }, 90000)

  afterAll(() => {
    eigeneBloeckeSetzen([])
  })

  it('beendet die Serie mit Klartext, bevor der Startprüfer einen Fehlstart baut', () => {
    expect(berichte).toHaveLength(1)
    expect(berichte[0].zustand).toBe('erfolgreich')
    expect(
      berichte[0].ticker.some((z) => z.text === texte.ticker.serieEndeKeineAufgaben)
    ).toBe(true)
    expect(steuerung.auftraege).toHaveLength(1)
    expect(laufZustand(projekt).serie).toBeNull()
    // Kein Fehlstart heißt auch: kein serie-fehler-Ereignis an die Ansicht.
    expect(sicht.ereignisse.some((e) => e.art === 'serie-fehler')).toBe(false)
  })
})

describe('Bauschritt 61 · Die Rundenzahl hat harte Grenzen', () => {
  it('weist Unsinn ab, bevor irgendetwas startet', async () => {
    const projekt = projektAnlegen('runden', spaeherWorkflow)
    kartenStellen(status, aufgabe1)
    const sicht = fensterErsatz()
    for (const runden of [1, 100, 2.5, '3', 0, -2])
      expect(
        await laufStarten(sicht.fenster, projekt, [aufgabe1.id], null, false, null, { runden })
      ).toEqual({ ok: false, fehler: texte.lauf.serieRundenUngueltig })
  })
})
