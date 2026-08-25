// Der wartende Prüfer (Bauschritt 58) — gemessen am ECHTEN Ablaufplaner mit
// Motor-Ersatz (Muster aus zusatzbauerLauf): Aufträge, Ticker, Laufstand,
// Sicherungsstränge und Laufbericht sind echt; Motor, Rauchtest, Prozesse und
// Karten-Speicher sind Attrappe.
//
// Gemessen wird das Verhalten, nicht der Quelltext: Der Prüfer meldet einen
// Fund außerhalb der Dateilisten über auf_zusatzbauer_warten, der Zusatzbauer
// startet NEBEN dem laufenden (wartenden) Prüfer, das Werkzeug-Ergebnis trägt
// Umsetzungsbericht, Diff-Kopf und Urteilspflicht, und der Prüfer urteilt
// danach in zusatzUrteile. Dazu die Gegenproben: Einstellung „karte",
// Rückfallweg ohne Werkzeug (bestanden und fehlgeschlagen), harter Stopp
// mitten im Warten, normaler Weg und Obergrenze.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const steuerung = vi.hoisted(() => ({ bauen: null }))
const einstellungSteuerung = vi.hoisted(() => ({ fundeAusserhalb: 'mitnehmen', zusatzbauerMax: 1 }))
const kartenSpeicher = vi.hoisted(() => ({ karten: [] }))

vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async () => ({ geprueft: false, gruen: null, code: null, ausgabe: '', grund: 'keine' }),
  befehlAbspielen: async () => ({ code: 0, ausgabe: '', abgebrochen: false })
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
// Kein Prüfbefehl im Spiel: vorhanden (keine Nachforderungs-Runde), aber
// nichts zu laden (das Vor-Tor spielt nichts ab).
vi.mock('../src/main/pruefbefehl.js', async (importOriginal) => ({
  ...(await importOriginal()),
  pruefbefehlVorhanden: () => true,
  pruefbefehlLaden: () => '',
  pruefbefehlArchivieren: () => {}
}))
// Karten im Speicher statt auf der Platte (Muster zusatzbauerLauf.test.js).
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: kartenSpeicher.karten }),
  karteAnlegen: (_pfad, { sorte, titel, text, thema }, herkunft) => {
    const karte = {
      id: 'karte-' + (kartenSpeicher.karten.length + 1),
      sorte,
      titel,
      text,
      thema,
      erledigt: false,
      angelegtVon: herkunft
    }
    kartenSpeicher.karten.push(karte)
    return { ok: true, karten: kartenSpeicher.karten, id: karte.id }
  },
  karteErledigtSetzen: (_pfad, id, erledigt) => {
    const karte = kartenSpeicher.karten.find((k) => k.id === id)
    if (!karte) return { ok: false, fehler: 'Karte fehlt' }
    karte.erledigt = Boolean(erledigt)
    return { ok: true, karten: kartenSpeicher.karten }
  }
}))
vi.mock('../src/main/einstellungen.js', async (importOriginal) => {
  const orig = await importOriginal()
  return {
    ...orig,
    einstellungenLaden: () => {
      const geladen = orig.einstellungenLaden()
      return {
        ...geladen,
        einstellungen: {
          ...geladen.einstellungen,
          fundeAusserhalb: einstellungSteuerung.fundeAusserhalb,
          zusatzbauerMax: einstellungSteuerung.zusatzbauerMax
        }
      }
    }
  }
})

import { laufStarten, laufHartStoppen, wellenStartRegel } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }

// Motor-Ersatz wie in zusatzbauerLauf.test.js — plus ein hartStoppen, das wie
// der echte Motor jeden noch offenen Block-Anlauf als 'hart-abgebrochen'
// auflöst (Fall „harter Stopp, während der Prüfer wartet").
function motorErsatz(ergebnisFuer) {
  const wartend = new Map() // instanzId → { name, los, abbrechen }
  const auftraege = new Map() // instanzId → [Auftragstexte je Anlauf]
  const namen = new Map() // blockName → instanzId (zuletzt gesehen)
  let letzteOptionen = null
  steuerung.bauen = (optionen) => {
    letzteOptionen = optionen
    return {
      sessionKennung: null,
      tokens: 0,
      istTot: () => false,
      beenden() {},
      hartStoppen() {
        for (const eintrag of [...wartend.values()]) eintrag.abbrechen()
      },
      blockAusfuehren(block) {
        if (!auftraege.has(block.instanzId)) auftraege.set(block.instanzId, [])
        auftraege.get(block.instanzId).push(block.auftrag)
        namen.set(block.blockName, block.instanzId)
        return new Promise((aufloesen) => {
          wartend.set(block.instanzId, {
            name: block.blockName,
            abbrechen: () =>
              aufloesen({
                zustand: 'hart-abgebrochen',
                ergebnisText: '',
                fehlertext: '',
                fehlerArt: null,
                verbrauch: null
              }),
            los: async () => {
              const meldungen = await ergebnisFuer(block, optionen)
              aufloesen({
                zustand: 'erfolgreich',
                ergebnisText: '',
                meldungen,
                fehlertext: '',
                fehlerArt: null,
                verbrauch: null
              })
            }
          })
        })
      }
    }
  }
  const passt = (w, name) => w.name === name || w.name.startsWith(name + ' ·')
  async function warteAufStart(name) {
    const bis = Date.now() + 8000
    while (Date.now() < bis) {
      if ([...wartend.values()].some((w) => passt(w, name))) return
      await new Promise((r) => setTimeout(r, 10))
    }
    throw new Error('Block nie gestartet: ' + name)
  }
  return {
    auftraege,
    namen,
    warteAufStart,
    holeOptionen: () => letzteOptionen,
    async freigeben(name) {
      await warteAufStart(name)
      const [id, eintrag] = [...wartend.entries()].find(([, w]) => passt(w, name))
      wartend.delete(id)
      await eintrag.los()
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
      const bis = Date.now() + 15000
      while (!pruefung() && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      if (!pruefung()) throw new Error('Nicht eingetreten: ' + was)
    }
  }
}

function gitOrdner(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
  return path.join(os.tmpdir(), 'flowforge-git', schluessel)
}
function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-zbwarten-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(gitOrdner(wurzel), { recursive: true, force: true })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}
let schreibSchritt = 0
function schreiben(wurzel, relativ, inhalt) {
  const ziel = path.join(wurzel, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  const spaeter = new Date(Date.now() + 5000 + ++schreibSchritt * 1000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

function paketMeldung(block, liste) {
  const pakete = block.ziele.map((ziel) => ({
    zielBlock: ziel.adresse,
    kurzname: 'Teil ' + ziel.nummer,
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
  const ergebnis = meldungPruefen('umsetzungsbericht', { ...rahmen }, 'Umsetzungsbericht')
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}
function angriffsMeldung(funde) {
  const ergebnis = meldungPruefen('funde', { ...rahmen, funde }, 'Angriffsliste')
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}
// Prüfbeleg über die ECHTE Ebene 2 — mit urteil, beanstandungen, funde
// (Bauer A, Bauschritt 58) und zusatzUrteile nach Bedarf.
function pruefMeldung(fazit, { urteil = 'bestanden', beanstandungen = [], funde, zusatzUrteile } = {}) {
  const ergebnis = meldungPruefen(
    'pruefbeleg',
    {
      ...rahmen,
      fazit,
      urteil,
      beanstandungen,
      rotVorGruen: '',
      geprueft: [],
      ...(funde ? { funde } : {}),
      ...(zusatzUrteile ? { zusatzUrteile } : {})
    },
    'Prüfbeleg'
  )
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}

const bloecke = [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Ein Teil' } },
  { instanzId: 'a', blockId: 'angreifer', zusatz: '' },
  { instanzId: 'b', blockId: 'bauer', zusatz: '' },
  { instanzId: 'pe', blockId: 'pruefer', zusatz: '' },
  { instanzId: 's', blockId: 'sessionende', zusatz: '' }
]
const pfeile = [
  { von: 'p', nach: 'a' },
  { von: 'a', nach: 'b' },
  { von: 'b', nach: 'pe' },
  { von: 'pe', nach: 's' },
  { von: 'b', nach: 's' }
]
// Kette ohne Angreifer für den Rückfallweg — der Prüfer ist dort der einzige
// mögliche Melder.
const bloeckeOhneAngreifer = bloecke.filter((b) => b.instanzId !== 'a')
const pfeileOhneAngreifer = [
  { von: 'p', nach: 'b' },
  { von: 'b', nach: 'pe' },
  { von: 'pe', nach: 's' },
  { von: 'b', nach: 's' }
]

const KERN_FUND = {
  text: 'Die Rotation hebelt die Entscheidungs-Karte aus.',
  fundort: 'js/daten/kern.js:3',
  soll: 'Die Rotation lässt die Entscheidungs-Karte unangetastet.'
}

function projektAnlegen(name, workflowBloecke, workflowPfeile) {
  const projekt = frischesProjekt(name)
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden: 2, uebertragGrenze: 5, bloecke: workflowBloecke, pfeile: workflowPfeile }),
    'utf8'
  )
  schreiben(projekt, 'src/innen.js', 'alt\n')
  schreiben(projekt, 'js/daten/kern.js', 'kaputt\n')
  return projekt
}

function neuesterBericht(projekt) {
  const ordner = path.join(projekt, 'laufberichte')
  const dateien = fs.readdirSync(ordner).filter((d) => d.endsWith('.json')).sort()
  return JSON.parse(fs.readFileSync(path.join(ordner, dateien[dateien.length - 1]), 'utf8'))
}

describe('Bauschritt 58 · Der wartende Prüfer: Werkzeug-Weg mit „jetzt mitnehmen"', () => {
  const projekt = projektAnlegen('werkzeug', bloecke, pfeile)
  let sicht
  let motor
  const antworten = {}

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'mitnehmen'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'a') return angriffsMeldung([])
      if (block.blockName === 'Zusatzbauer') {
        schreiben(projekt, 'js/daten/kern.js', 'repariert\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') {
        // Fund IM Revier des Bauers → normaler Weg, sofortige Antwort.
        antworten.normal = await optionen.aufZusatzbauerWarten({
          text: 'Kleinigkeit im eigenen Revier.',
          fundort: 'src/innen.js',
          soll: 'Die Kleinigkeit ist behoben.',
          schwere: 'niedrig'
        })
        // Fund AUSSERHALB → der Prüfer wartet auf den Zusatzbauer.
        // schwere fehlt absichtlich: der Rückfall ist „mittel".
        antworten.werkzeug = await optionen.aufZusatzbauerWarten({ ...KERN_FUND })
        // Dieselbe Fundstelle noch einmal → „schon vorhanden", kein zweiter.
        antworten.vorhanden = await optionen.aufZusatzbauerWarten({ ...KERN_FUND })
        // Eine weitere Fundstelle → Obergrenze (1) erreicht, Karte.
        antworten.obergrenze = await optionen.aufZusatzbauerWarten({
          text: 'Zweiter Fund außerhalb.',
          fundort: 'js/daten/zweite.js',
          soll: 'Der zweite Fund ist behoben.'
        })
        return pruefMeldung('Alles in Ordnung.', {
          zusatzUrteile: [
            {
              fundpfad: 'js/daten/kern.js',
              urteil: 'erfüllt',
              beleg: 'Gemessen: die Karte bleibt nach der Rotation stehen.'
            }
          ]
        })
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Angreifer')
    await motor.freigeben('Bauer')
    // Der Prüfer bleibt im Werkzeug hängen — NICHT abwarten, sondern den
    // Zusatzbauer freigeben, der neben ihm startet.
    const prueferFertig = motor.freigeben('Prüfer')
    await motor.freigeben('Zusatzbauer')
    await prueferFertig
    await motor.freigeben('Sessionende')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('der Zusatzbauer startet, WÄHREND der Prüfer läuft und wartet', () => {
    const zeilen = sicht.ticker()
    const prueferStart = zeilen.indexOf(texte.ticker.blockStartet(4, 5, 'Prüfer'))
    const ruft = zeilen.indexOf(texte.ticker.prueferRuftZusatzbauer('Prüfer'))
    const zbStart = zeilen.indexOf(texte.ticker.zusatzbauerStartet('Zusatzbauer', 'Prüfer'))
    const aufgeloest = zeilen.indexOf(texte.ticker.prueferWartenAufgeloest('Prüfer'))
    expect(prueferStart).toBeGreaterThanOrEqual(0)
    expect(ruft).toBeGreaterThan(prueferStart)
    expect(zbStart).toBeGreaterThan(ruft)
    expect(aufgeloest).toBeGreaterThan(zbStart)
    // Der Prüfer läuft genau EINMAL — er urteilt im selben Anlauf.
    expect(motor.auftraege.get('pe')).toHaveLength(1)
  })

  it('das Werkzeug-Ergebnis trägt Umsetzungsbericht, Diff-Kopf, Dateiliste, Karten-Stand und Urteilspflicht', () => {
    const text = antworten.werkzeug.text
    expect(text).toContain(texte.zusatzWarten.ergebnisKopf('Zusatzbauer'))
    // Der Umsetzungsbericht des Zusatzbauers (Fazit des Lieferscheins).
    expect(text).toContain('Erledigt.')
    expect(text).toContain(texte.zusatzWarten.ergebnisDiffKopf)
    // Die gemessene Dateiliste steht vollständig dabei.
    expect(text).toContain('js/daten/kern.js')
    expect(text).toContain(texte.zusatzWarten.ergebnisUrteilspflicht('js/daten/kern.js'))
    expect(text).toContain(
      texte.zusatzWarten.ergebnisKarteAbgehakt('Die Rotation hebelt die Entscheidungs-Karte aus.')
    )
  })

  it('Fund im Revier des Rückführungs-Ziels: normaler Weg, keine Karte', () => {
    expect(antworten.normal.text).toContain('darf diese Stelle ohnehin anfassen')
    expect(kartenSpeicher.karten.some((k) => k.titel.includes('Kleinigkeit'))).toBe(false)
    const bericht = neuesterBericht(projekt)
    const zeile = bericht.zusatzbauer.find((z) => z.weg === 'normal')
    expect(zeile).toMatchObject({ melderName: 'Prüfer', melderTyp: 'pruefer' })
  })

  it('dieselbe Fundstelle ein zweites Mal: „schon vorhanden", kein zweiter Zusatzbauer', () => {
    expect(antworten.vorhanden.text).toBe(texte.zusatzWarten.schonVorhanden('Zusatzbauer'))
    expect(kartenSpeicher.karten.filter((k) => k.thema === 'Funde')).toHaveLength(2)
  })

  it('Obergrenze erreicht: obergrenze-Antwort, der Fund wird eine offene Karte', () => {
    expect(antworten.obergrenze.text).toBe(texte.zusatzWarten.obergrenze(1))
    const karte = kartenSpeicher.karten.find((k) => k.titel === 'Zweiter Fund außerhalb.')
    expect(karte).toBeTruthy()
    expect(karte.erledigt).toBe(false)
  })

  it('der Prüfer urteilt danach in zusatzUrteile — Karte abgehakt, Bericht trägt melderTyp', () => {
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.zusatzbauerSollErfuellt('Zusatzbauer', 'Prüfer'))
    const karte = kartenSpeicher.karten.find(
      (k) => k.titel === 'Die Rotation hebelt die Entscheidungs-Karte aus.'
    )
    expect(karte.erledigt).toBe(true)
    const bericht = neuesterBericht(projekt)
    const zusatz = bericht.zusatzbauer.find((z) => z.weg === 'zusatzbauer')
    expect(zusatz).toMatchObject({
      name: 'Zusatzbauer',
      melderName: 'Prüfer',
      melderTyp: 'pruefer',
      urteil: 'erfüllt',
      karteOffen: false
    })
    expect(zusatz.dateien).toBeGreaterThanOrEqual(1)
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})

describe('Bauschritt 58 · Gegenprobe: Einstellung „karte" baut nichts', () => {
  const projekt = projektAnlegen('karte', bloecke, pfeile)
  let sicht
  let motor
  const antworten = {}

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'karte'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'a') return angriffsMeldung([])
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') {
        antworten.karte = await optionen.aufZusatzbauerWarten({ ...KERN_FUND })
        return pruefMeldung('Alles in Ordnung.')
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Angreifer')
    await motor.freigeben('Bauer')
    await motor.freigeben('Prüfer')
    await motor.freigeben('Sessionende')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('sofortige alsKarte-Antwort, kein Zusatz-Knoten, die Karte bleibt offen', () => {
    expect(antworten.karte.text).toBe(
      texte.zusatzWarten.alsKarte('Die Rotation hebelt die Entscheidungs-Karte aus.')
    )
    expect(motor.namen.has('Zusatzbauer')).toBe(false)
    const karte = kartenSpeicher.karten.find((k) => k.thema === 'Funde')
    expect(karte).toBeTruthy()
    expect(karte.erledigt).toBe(false)
    const bericht = neuesterBericht(projekt)
    const zeile = bericht.zusatzbauer.find((z) => z.weg === 'karte')
    expect(zeile).toMatchObject({ melderName: 'Prüfer', melderTyp: 'pruefer', karteOffen: true })
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})

describe('Bauschritt 58 · Rückfallweg: funde im Beleg ohne Werkzeug, Paket bestanden', () => {
  const projekt = projektAnlegen('rueckfall', bloeckeOhneAngreifer, pfeileOhneAngreifer)
  let sicht
  let motor
  let prueferAnlauf = 0

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'mitnehmen'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.blockName === 'Zusatzbauer') {
        schreiben(projekt, 'js/daten/kern.js', 'repariert\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') {
        prueferAnlauf++
        if (prueferAnlauf === 1)
          // Der Prüfer ruft das Werkzeug NICHT — er meldet den Fund nur im Beleg.
          return pruefMeldung('Paket in Ordnung, Fund daneben.', {
            funde: [{ ...KERN_FUND, schwere: 'mittel' }]
          })
        return pruefMeldung('Alles in Ordnung.', {
          zusatzUrteile: [
            {
              fundpfad: 'js/daten/kern.js',
              urteil: 'erfüllt',
              beleg: 'Gemessen: die Karte bleibt nach der Rotation stehen.'
            }
          ]
        })
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Bauer')
    await motor.freigeben('Prüfer') // Anlauf 1: meldet funde, ohne zu warten
    await motor.freigeben('Zusatzbauer')
    await motor.freigeben('Prüfer') // Anlauf 2: Nachprüfung mit Urteilspflicht
    await motor.freigeben('Sessionende')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('der Zusatzbauer läuft NACH dem Prüfer, der Prüfer wird erneut gerufen', () => {
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.prueferFundRueckfall('Prüfer'))
    const zbFertig = zeilen.indexOf(texte.ticker.zusatzbauerFertig('Zusatzbauer'))
    const zweiterAnlauf = zeilen.lastIndexOf(texte.ticker.blockStartet(3, 4, 'Prüfer'))
    expect(zbFertig).toBeGreaterThanOrEqual(0)
    expect(zweiterAnlauf).toBeGreaterThan(zbFertig)
    expect(motor.auftraege.get('pe')).toHaveLength(2)
  })

  it('auch ohne Angreifer in der Kette sind die Melde-Werkzeuge der Zusatz-Knoten registriert', () => {
    // Befund P2 (25.08.2026): In einer Kette ohne Angriffslisten-Lieferanten
    // fehlte melde_angriffsliste — der Zusatz-Angreifer eines hohen
    // Prüfer-Fundes wich auf den Freitext aus und wurde abgewiesen.
    const werkzeuge = motor.holeOptionen().lieferscheinWerkzeuge
    expect(werkzeuge).toContain('melde_umsetzungsbericht')
    expect(werkzeuge).toContain('melde_angriffsliste')
  })

  it('sein zweiter Auftrag trägt die benannte Ausnahme samt Urteilspflicht', () => {
    const auftrag = motor.auftraege.get('pe')[1]
    expect(auftrag).toContain('zusatzUrteile')
    expect(auftrag).toContain(KERN_FUND.soll)
    expect(auftrag).toContain('js/daten/kern.js')
  })

  it('das Urteil wird verarbeitet, die Karte ist am Ende abgehakt', () => {
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.zusatzbauerSollErfuellt('Zusatzbauer', 'Prüfer'))
    const karte = kartenSpeicher.karten.find((k) => k.thema === 'Funde')
    expect(karte.erledigt).toBe(true)
    const bericht = neuesterBericht(projekt)
    const zusatz = bericht.zusatzbauer.find((z) => z.weg === 'zusatzbauer')
    expect(zusatz).toMatchObject({ melderName: 'Prüfer', melderTyp: 'pruefer', urteil: 'erfüllt' })
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})

describe('Bauschritt 58 · Rückfallweg: Paket fehlgeschlagen — Karten-Weg, kein Zusatzbauer', () => {
  const projekt = projektAnlegen('fehlgeschlagen', bloeckeOhneAngreifer, pfeileOhneAngreifer)
  let sicht
  let motor
  let prueferAnlauf = 0

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'mitnehmen'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut ' + Date.now() + '\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') {
        prueferAnlauf++
        if (prueferAnlauf === 1)
          return pruefMeldung('Paket kaputt, Fund daneben.', {
            urteil: 'fehlgeschlagen',
            beanstandungen: [
              { text: 'Der neue Teil startet nicht.', einstufung: 'mechanisch', fundort: 'src/neu.js' }
            ],
            funde: [{ ...KERN_FUND, schwere: 'mittel' }]
          })
        return pruefMeldung('Jetzt in Ordnung.')
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Bauer')
    await motor.freigeben('Prüfer') // Anlauf 1: fehlgeschlagen + Fund
    await motor.freigeben('Bauer') // Reparatur-Runde
    await motor.freigeben('Prüfer') // Anlauf 2: bestanden
    await motor.freigeben('Sessionende')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('kein Zusatzbauer entsteht — der Fund wird eine offene Karte mit Bericht-Zeile', () => {
    expect(motor.namen.has('Zusatzbauer')).toBe(false)
    const karte = kartenSpeicher.karten.find((k) => k.thema === 'Funde')
    expect(karte).toBeTruthy()
    expect(karte.erledigt).toBe(false)
    const bericht = neuesterBericht(projekt)
    const zeile = bericht.zusatzbauer.find((z) => z.weg === 'karte')
    expect(zeile).toMatchObject({ melderName: 'Prüfer', melderTyp: 'pruefer', karteOffen: true })
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})

describe('Bauschritt 58 · Harter Stopp, während der Prüfer wartet', () => {
  const projekt = projektAnlegen('hart', bloeckeOhneAngreifer, pfeileOhneAngreifer)
  let sicht
  let motor
  const antworten = {}

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'mitnehmen'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') {
        antworten.hart = await optionen.aufZusatzbauerWarten({ ...KERN_FUND })
        return pruefMeldung('Kam nicht mehr dazu.')
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Bauer')
    const prueferFertig = motor.freigeben('Prüfer')
    // Der Zusatzbauer ist registriert und gestartet — JETZT hart stoppen,
    // OHNE ihn freizugeben: Der Prüfer darf trotzdem nicht hängen.
    await motor.warteAufStart('Zusatzbauer')
    laufHartStoppen(projekt)
    // Der echte Hart-Rückroll setzt die karten.json auf den Stand VOR dem
    // Lauf zurück — die im Lauf angelegte Fund-Karte verschwindet (gemessen,
    // Befund P2-2). Hier nachgestellt, BEVOR das Laufende aufräumt.
    kartenSpeicher.karten.length = 0
    await prueferFertig
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('der Handler löst mit laufEndet auf — kein Hänger, die Karte bleibt offen', () => {
    expect(antworten.hart.text).toBe(texte.zusatzWarten.laufEndet)
    const karte = kartenSpeicher.karten.find((k) => k.thema === 'Funde')
    expect(karte).toBeTruthy()
    expect(karte.erledigt).toBe(false)
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('hart-abgebrochen')
  })

  it('die vom Rückroll gerissene Fund-Karte wird neu angelegt — Bericht und Ticker sagen es (Befund P2-2)', () => {
    const karte = kartenSpeicher.karten.find((k) => k.thema === 'Funde')
    expect(karte.titel).toBe('Die Rotation hebelt die Entscheidungs-Karte aus.')
    expect(sicht.ticker()).toContain(texte.ticker.zusatzbauerKarteNeuAngelegt(karte.titel))
    const bericht = neuesterBericht(projekt)
    const zeile = bericht.zusatzbauer.find((z) => z.weg === 'zusatzbauer')
    expect(zeile.karteId).toBe(karte.id)
    expect(zeile.karteOffen).toBe(true)
  })
})

describe('Bauschritt 58 · Überlappender Doppel-Aufruf des Warte-Werkzeugs (Befund P1-B1)', () => {
  // Ruft der Prüfer das Werkzeug zweimal, BEVOR die erste Antwort da ist
  // (paralleles Tool-Calling), darf das finally des ersten Aufrufs den
  // Wartezustand nicht löschen: wartetImWerkzeug ist ein Zähler, kein
  // Boolean — sonst startete der zweite Zusatzbauer nie und der Prüfer
  // hinge bis zum harten Stopp (gemessen, 25.08.2026).
  const projekt = projektAnlegen('doppel', bloeckeOhneAngreifer, pfeileOhneAngreifer)
  let sicht
  let motor
  const antworten = {}
  const ZWEITER_FUND = {
    text: 'Zweiter Fund außerhalb.',
    fundort: 'js/daten/zweite.js',
    soll: 'Der zweite Fund ist behoben.'
  }

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'mitnehmen'
    einstellungSteuerung.zusatzbauerMax = 2
    kartenSpeicher.karten.length = 0
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.blockName === 'Zusatzbauer') {
        schreiben(projekt, 'js/daten/kern.js', 'repariert\n')
        return umsetzungsMeldung()
      }
      if (block.blockName === 'Zusatzbauer 2') {
        schreiben(projekt, 'js/daten/zweite.js', 'repariert\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') {
        // Beide Aufrufe ÜBERLAPPEND — genau der Fall aus dem Befund.
        const [erste, zweite] = await Promise.all([
          optionen.aufZusatzbauerWarten({ ...KERN_FUND }),
          optionen.aufZusatzbauerWarten({ ...ZWEITER_FUND })
        ])
        antworten.erste = erste
        antworten.zweite = zweite
        return pruefMeldung('Alles in Ordnung.', {
          zusatzUrteile: [
            { fundpfad: 'js/daten/kern.js', urteil: 'erfüllt', beleg: 'Gemessen am ersten Fix.' },
            { fundpfad: 'js/daten/zweite.js', urteil: 'erfüllt', beleg: 'Gemessen am zweiten Fix.' }
          ]
        })
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Bauer')
    const prueferFertig = motor.freigeben('Prüfer')
    await motor.freigeben('Zusatzbauer')
    // Der zweite startet erst NACH dem ersten (er läuft allein) — aber er
    // MUSS starten, obwohl das finally des ersten Aufrufs schon durch ist.
    await motor.freigeben('Zusatzbauer 2')
    await prueferFertig
    await motor.freigeben('Sessionende')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('beide Zusatzbauer laufen, beide Antworten tragen die je richtige Urteilspflicht', () => {
    expect(antworten.erste.text).toContain(texte.zusatzWarten.ergebnisUrteilspflicht('js/daten/kern.js'))
    expect(antworten.zweite.text).toContain(
      texte.zusatzWarten.ergebnisUrteilspflicht('js/daten/zweite.js')
    )
    // Der Prüfer lief genau einmal — kein Hänger, kein zweiter Anlauf.
    expect(motor.auftraege.get('pe')).toHaveLength(1)
  })

  it('beide Karten sind abgehakt, der Lauf endet erfolgreich', () => {
    const kartenFunde = kartenSpeicher.karten.filter((k) => k.thema === 'Funde')
    expect(kartenFunde).toHaveLength(2)
    expect(kartenFunde.every((k) => k.erledigt)).toBe(true)
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})

describe('Bauschritt 58 · wellenStartRegel: der wartende Prüfer ist nur für Zusatz-Kandidaten unsichtbar', () => {
  const prueferWartet = {
    instanzId: 'pe',
    name: 'Prüfer',
    def: { nurLesen: false, prueft: true },
    wartetImWerkzeug: true,
    dateiListe: null
  }
  const prueferLaeuft = { ...prueferWartet, wartetImWerkzeug: false }
  const zusatz = {
    instanzId: 'z',
    name: 'Zusatzbauer',
    def: { nurLesen: false, prueft: false },
    dateiListe: null,
    zusatz: true
  }
  const bauer = {
    instanzId: 'b',
    name: 'Bauer',
    def: { nurLesen: false, prueft: false },
    dateiListe: ['src/']
  }

  it('der Zusatz-Kandidat startet neben dem wartenden Prüfer', () => {
    expect(wellenStartRegel(zusatz, [prueferWartet]).darf).toBe(true)
  })

  it('läuft der Prüfer OHNE zu warten, wartet auch der Zusatz-Kandidat', () => {
    const urteil = wellenStartRegel(zusatz, [prueferLaeuft])
    expect(urteil.darf).toBe(false)
    expect(urteil.grund).toBe('umsetzerWartet')
  })

  it('ein NICHT-Zusatz-Umsetzer startet NICHT neben dem wartenden Prüfer', () => {
    const urteil = wellenStartRegel(bauer, [prueferWartet])
    expect(urteil.darf).toBe(false)
    expect(urteil.grund).toBe('umsetzerWartet')
  })
})
