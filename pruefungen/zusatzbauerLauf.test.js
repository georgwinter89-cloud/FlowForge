// Zusatzbauer für Funde des Angreifers (Bauschritt 57) — gemessen am ECHTEN
// Ablaufplaner mit Motor-Ersatz (Muster aus pruefbelegWeiterreichungLauf):
// Aufträge, Ticker, Laufstand, Sicherungsstränge und Laufbericht sind echt;
// Motor, Rauchtest, Prozesse und Karten-Speicher sind Attrappe.
//
// Gemessen wird der ganze Lebenslauf: Der Angreifer meldet einen Fund
// außerhalb der Bauer-Dateiliste → Karte + Zusatzbauer (er startet allein,
// vor dem Bauer nichts, neben ihm nichts); der Prüfer wartet auf ihn, bekommt
// die benannte Ausnahme mit GEMESSENER Dateiliste, verfehlt das soll einmal
// (Reparatur-Runde, Karte wieder offen), bestätigt dann — Karte abgehakt,
// Bericht nennt jeden Fund und seinen Weg. Gegenprobe: Einstellung „karte"
// baut nichts, die Karte bleibt offen.
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
// Karten im Speicher statt auf der Platte: Das Temp-Projekt ist kein
// „bekanntes Projekt", die echten Karten-Funktionen wiesen es ab. Die
// id-Rückgabe von karteAnlegen (Bauschritt 57) wird hier nachgebildet und in
// projekteKarteAnlegen.test-Manier vom echten Code erwartet.
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
// Bis Bauer B die Schnittstellen-Funktionen in blockKatalog.js einbaut,
// stehen hier Stubs — die Originale gewinnen, sobald es sie gibt (Vertrag:
// Stub im Test, nie im Produktivcode).
vi.mock('../src/shared/blockKatalog.js', async (importOriginal) => {
  const orig = await importOriginal()
  const zusatzbauerDefinition = ({ soll, fundort, fundpfad, melderName, schwere }) => ({
    id: 'zusatzbauer',
    modell: 'standard',
    name: 'Zusatzbauer',
    symbol: '🧰',
    beschreibung: '',
    braucht: [],
    brauchtOptional: ['Angriffsliste'],
    liefert: ['Umsetzungsbericht'],
    nurLesen: false,
    prueft: false,
    uebung: false,
    bereich: 'bauen',
    felder: [],
    auftrag: `STUB-AUFTRAG Zusatzbauer (${schwere}, von ${melderName}): ${fundort} — fertig, wenn: ${soll}`
  })
  const zusatzAngreiferDefinition = ({ soll, fundort, melderName }) => ({
    id: 'zusatz-angreifer',
    modell: 'standard',
    name: 'Zusatz-Angreifer',
    symbol: '⚔️',
    beschreibung: '',
    braucht: [],
    liefert: ['Angriffsliste'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    bereich: 'pruefen',
    felder: [],
    auftrag: `STUB-AUFTRAG Zusatz-Angreifer (von ${melderName}): ${fundort} — ${soll}`
  })
  const zusatzAusnahmeTextFuerPruefer = ({ zusatzbauerListe }) =>
    '\n\nSTUB-AUSNAHMEN: ' +
    zusatzbauerListe
      .map(
        (z) =>
          `${z.name}<${z.fundpfad}>[${z.dateien.join('|')}]${z.urteilen ? '(URTEILSPFLICHT)' : ''}`
      )
      .join(' ')
  return {
    ...orig,
    zusatzbauerDefinition: orig.zusatzbauerDefinition ?? zusatzbauerDefinition,
    zusatzAngreiferDefinition: orig.zusatzAngreiferDefinition ?? zusatzAngreiferDefinition,
    zusatzAusnahmeTextFuerPruefer: orig.zusatzAusnahmeTextFuerPruefer ?? zusatzAusnahmeTextFuerPruefer
  }
})

import { laufStarten, wellenStartRegel } from '../src/main/lauf.js'
import { sdkModell } from '../src/shared/blockKatalog.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }

function motorErsatz(ergebnisFuer) {
  const wartend = new Map() // instanzId → { name, los }
  const auftraege = new Map() // instanzId → [Auftragstexte je Anlauf]
  const namen = new Map() // blockName → instanzId (zuletzt gesehen)
  const modelle = new Map() // instanzId → SDK-Modell des Anlaufs (P2-3)
  steuerung.bauen = (optionen) => ({
    sessionKennung: null,
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      if (!auftraege.has(block.instanzId)) auftraege.set(block.instanzId, [])
      auftraege.get(block.instanzId).push(block.auftrag)
      namen.set(block.blockName, block.instanzId)
      modelle.set(block.instanzId, block.modell)
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, {
          name: block.blockName,
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
  })
  // Treffer über den ANZEIGE-Namen — auch mit Laufzeit-Zusatz („Bauer ·
  // Teil 3"): Die instanzId eines Zusatz-Knotens vergibt der Lauf selbst,
  // der Test kennt sie vorher nicht.
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
    modelle,
    warteAufStart,
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
  const wurzel = path.join(os.tmpdir(), `flowforge-zusatzbauer-${name}-${process.pid}`)
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
// Angriffsliste mit Funden — `soll` geht durch die ECHTE Ebene 2 (E15); der
// Rückfall heftet es an, falls das Schema es (noch) nicht durchreicht.
function angriffsMeldung(funde) {
  const ergebnis = meldungPruefen('funde', { ...rahmen, funde }, 'Angriffsliste')
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  ergebnis.meldung.funde.forEach((fund, i) => {
    if (!fund.soll && funde[i].soll) fund.soll = funde[i].soll
  })
  return [ergebnis.meldung]
}
// Prüfbeleg — zusatzUrteile gehen durch die ECHTE Ebene 2 (E9); der Rückfall
// heftet sie an, falls das Schema sie (noch) nicht durchreicht.
function pruefMeldung(fazit, zusatzUrteile) {
  const ergebnis = meldungPruefen(
    'pruefbeleg',
    {
      ...rahmen,
      fazit,
      urteil: 'bestanden',
      beanstandungen: [],
      rotVorGruen: '',
      geprueft: [],
      ...(zusatzUrteile ? { zusatzUrteile } : {})
    },
    'Prüfbeleg'
  )
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  if (zusatzUrteile && !ergebnis.meldung.zusatzUrteile?.length)
    ergebnis.meldung.zusatzUrteile = zusatzUrteile
  return [ergebnis.meldung]
}

const bloecke = [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Ein Teil' } },
  { instanzId: 'a', blockId: 'angreifer', zusatz: '', modell: 'sparsam' },
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

function neuesterBericht(projekt) {
  const ordner = path.join(projekt, 'laufberichte')
  const dateien = fs.readdirSync(ordner).filter((d) => d.endsWith('.json')).sort()
  return JSON.parse(fs.readFileSync(path.join(ordner, dateien[dateien.length - 1]), 'utf8'))
}

describe('Bauschritt 57 · Fund außerhalb der Dateiliste, Einstellung „jetzt mitnehmen"', () => {
  const projekt = frischesProjekt('mitnehmen')
  let sicht
  let motor
  let laufstandWaehrendZusatzbauer = null
  let prueferAnlauf = 0
  let zusatzbauerAnlauf = 0

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'mitnehmen'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({ reparaturRunden: 2, uebertragGrenze: 5, bloecke, pfeile }),
      'utf8'
    )
    schreiben(projekt, 'src/innen.js', 'alt\n')
    schreiben(projekt, 'js/daten/kern.js', 'kaputt\n')
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'a')
        return angriffsMeldung([
          {
            text: 'Die Rotation hebelt die Entscheidungs-Karte aus.',
            schwere: 'mittel',
            fundort: 'js/daten/kern.js:3',
            soll: 'Die Rotation lässt die Entscheidungs-Karte unangetastet.'
          },
          {
            text: 'Kleinigkeit im eigenen Revier.',
            schwere: 'niedrig',
            fundort: 'src/innen.js'
          }
        ])
      if (block.blockName === 'Zusatzbauer') {
        zusatzbauerAnlauf++
        schreiben(projekt, 'js/daten/kern.js', `repariert ${zusatzbauerAnlauf}\n`)
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') {
        prueferAnlauf++
        return pruefMeldung(
          prueferAnlauf === 1 ? 'Paket in Ordnung, Fund nicht behoben.' : 'Alles in Ordnung.',
          [
            {
              fundpfad: 'js/daten/kern.js',
              urteil: prueferAnlauf === 1 ? 'verfehlt' : 'erfüllt',
              beleg:
                prueferAnlauf === 1
                  ? 'Gemessen: die Rotation überschreibt die Karte weiter.'
                  : 'Gemessen: die Karte bleibt nach der Rotation stehen.'
            }
          ]
        )
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Angreifer')
    // Der Zusatzbauer ist registriert und gestartet — JETZT den Laufstand
    // lesen (am Laufende ist er gelöscht).
    await motor.warteAufStart('Zusatzbauer')
    laufstandWaehrendZusatzbauer = JSON.parse(
      fs.readFileSync(path.join(projekt, 'laufstand.json'), 'utf8')
    )
    await motor.freigeben('Zusatzbauer')
    await motor.freigeben('Bauer')
    await motor.freigeben('Prüfer') // Anlauf 1: soll verfehlt → Reparatur-Runde
    await motor.freigeben('Zusatzbauer') // Nacharbeit
    await motor.freigeben('Prüfer') // Anlauf 2: soll erfüllt
    await motor.freigeben('Sessionende')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('der Lauf endet erfolgreich — ein verfehltes soll kippt das Paket nie', () => {
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })

  it('Ticker: eigene Zusatzbauer-Zeile ohne Blocknummer, sie nennt den Melder', () => {
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.zusatzbauerStartet('Zusatzbauer', 'Angreifer'))
    expect(
      zeilen.some((z) => z.includes('Aufgaben-Karte zum Fund von „Angreifer" angelegt'))
    ).toBe(true)
  })

  it('„Block n von gesamt" zählt den Zusatzbauer nicht mit', () => {
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.blockStartet(3, 5, 'Bauer · Teil 3'))
    expect(zeilen).toContain(texte.ticker.blockStartet(4, 5, 'Prüfer'))
    expect(zeilen.some((z) => z.includes('von 6'))).toBe(false)
  })

  it('der Zusatzbauer läuft allein: der Bauer startet erst nach ihm', () => {
    const zeilen = sicht.ticker()
    const zusatzStart = zeilen.indexOf(texte.ticker.zusatzbauerStartet('Zusatzbauer', 'Angreifer'))
    const bauerStart = zeilen.indexOf(texte.ticker.blockStartet(3, 5, 'Bauer · Teil 3'))
    const zusatzFertig = zeilen.indexOf(texte.ticker.zusatzbauerFertig('Zusatzbauer'))
    expect(zusatzStart).toBeGreaterThanOrEqual(0)
    expect(zusatzFertig).toBeGreaterThan(zusatzStart)
    expect(bauerStart).toBeGreaterThan(zusatzFertig)
  })

  it('der Zusatzbauer erbt die Modellklasse seines Melders (Befund P2-3)', () => {
    const id = motor.namen.get('Zusatzbauer')
    // Der Melder 'a' steht auf „sparsam" — ohne Erbschaft liefe der
    // Zusatzbauer still auf der Standard-Klasse (Opus) der Definition.
    expect(motor.modelle.get(id)).toBe(motor.modelle.get('a'))
    expect(motor.modelle.get(id)).toBe(sdkModell('sparsam'))
  })

  it('sein Auftrag trägt das soll als Fertig-Kriterium und die Angriffsliste als Übergabe', () => {
    const id = motor.namen.get('Zusatzbauer')
    const auftrag = motor.auftraege.get(id)[0]
    expect(auftrag).toContain('Die Rotation lässt die Entscheidungs-Karte unangetastet.')
    expect(auftrag).toContain('Die Rotation hebelt die Entscheidungs-Karte aus.')
    expect(auftrag).toContain('js/daten/kern.js')
  })

  it('Laufstand: Zusatz-Knoten NIE in kettenIds/zusaetze/fertigIds, sondern im eigenen Feld', () => {
    const stand = laufstandWaehrendZusatzbauer
    expect(stand.kettenIds).toEqual(['p', 'a', 'b', 'pe', 's'])
    expect(stand.zusaetze.map(([id]) => id)).toEqual(['p', 'a', 'b', 'pe', 's'])
    expect(stand.fertigIds).toEqual(['p', 'a'])
    expect(Array.isArray(stand.zusatzbauer)).toBe(true)
    expect(stand.zusatzbauer).toHaveLength(1)
    const z = stand.zusatzbauer[0]
    expect(z.name).toBe('Zusatzbauer')
    expect(z.melderName).toBe('Angreifer')
    expect(z.fundpfad).toBe('js/daten/kern.js')
    expect(z.soll).toBe('Die Rotation lässt die Entscheidungs-Karte unangetastet.')
    expect(z.status).toBe('laeuft')
    expect(z.karteId).toBe('karte-1')
    expect(stand.kettenIds).not.toContain(z.instanzId)
  })

  it('der Prüfer wartet auf den Zusatzbauer und bekommt die benannte Ausnahme mit gemessener Dateiliste und Urteilspflicht', () => {
    const anlaeufe = motor.auftraege.get('pe')
    expect(anlaeufe.length).toBe(2)
    // Urteilspflicht im eigenen Feld — außerhalb des Paket-Urteils (E8/E9)
    expect(anlaeufe[0]).toContain('zusatzUrteile')
    expect(anlaeufe[0]).toContain('Die Rotation lässt die Entscheidungs-Karte unangetastet.')
    // Die GEMESSENE Dateiliste des Zusatzbauers steht als Ausnahme dabei —
    // die wirklich angefasste Datei, nicht eine Vorhersage.
    expect(anlaeufe[0]).toContain('js/daten/kern.js')
    expect(anlaeufe[0].split('js/daten/kern.js').length).toBeGreaterThan(2)
  })

  it('verfehltes soll: Karte wieder offen, Reparatur-Runde, danach erneutes Urteil — Karte am Ende abgehakt', () => {
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.zusatzbauerSollVerfehlt('Zusatzbauer', 'Prüfer'))
    expect(zeilen).toContain(texte.ticker.zusatzbauerReparatur('Zusatzbauer', 1, 2))
    expect(zeilen).toContain(texte.ticker.zusatzbauerSollErfuellt('Zusatzbauer', 'Prüfer'))
    // Die Nacharbeit trägt die Kritik des Prüfers in den Auftrag
    const id = motor.namen.get('Zusatzbauer')
    expect(motor.auftraege.get(id)[1]).toContain('die Rotation überschreibt die Karte weiter.')
    // Karte: angelegt → abgehakt → wieder offen → abgehakt (Endstand: erledigt)
    const karte = kartenSpeicher.karten.find((k) => k.thema === 'Funde')
    expect(karte).toBeTruthy()
    expect(karte.erledigt).toBe(true)
  })

  it('der Laufbericht nennt JEDEN Fund und seinen Weg (E13)', () => {
    const bericht = neuesterBericht(projekt)
    expect(Array.isArray(bericht.zusatzbauer)).toBe(true)
    const zusatz = bericht.zusatzbauer.find((z) => z.weg === 'zusatzbauer')
    expect(zusatz).toMatchObject({
      name: 'Zusatzbauer',
      melderName: 'Angreifer',
      soll: 'Die Rotation lässt die Entscheidungs-Karte unangetastet.',
      urteil: 'erfüllt',
      angriffsliste: false,
      karteId: 'karte-1',
      karteOffen: false
    })
    expect(zusatz.beleg).toContain('die Karte bleibt nach der Rotation stehen.')
    expect(zusatz.dateien).toBeGreaterThanOrEqual(1)
    const normal = bericht.zusatzbauer.find((z) => z.weg === 'normal')
    expect(normal).toBeTruthy()
    expect(normal.fundort).toBe('src/innen.js')
  })
})

describe('Bauschritt 57 · Gegenprobe: Einstellung „karte" baut nichts', () => {
  const projekt = frischesProjekt('karte')
  let sicht
  let motor

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'karte'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({ reparaturRunden: 2, uebertragGrenze: 5, bloecke, pfeile }),
      'utf8'
    )
    schreiben(projekt, 'src/innen.js', 'alt\n')
    schreiben(projekt, 'js/daten/kern.js', 'kaputt\n')
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'a')
        return angriffsMeldung([
          {
            text: 'Die Rotation hebelt die Entscheidungs-Karte aus.',
            schwere: 'mittel',
            fundort: 'js/daten/kern.js:3',
            soll: 'Die Rotation lässt die Entscheidungs-Karte unangetastet.'
          }
        ])
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe') return pruefMeldung('Alles in Ordnung.')
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

  it('kein Zusatzbauer startet — die Karte wird angelegt und bleibt offen', () => {
    expect(motor.namen.has('Zusatzbauer')).toBe(false)
    const zeilen = sicht.ticker()
    expect(zeilen.some((z) => z.includes('Zusatzbauer „'))).toBe(false)
    const karte = kartenSpeicher.karten.find((k) => k.thema === 'Funde')
    expect(karte).toBeTruthy()
    expect(karte.erledigt).toBe(false)
    expect(karte.text).toContain('Woran man erkennt, dass es behoben ist')
  })

  it('der Prüfer bekommt keine benannte Ausnahme — es gibt keinen Zusatzbauer', () => {
    expect(motor.auftraege.get('pe')[0]).not.toContain('zusatzUrteile')
  })

  it('der Laufbericht führt den Fund mit Weg „karte" und offener Karte', () => {
    const bericht = neuesterBericht(projekt)
    const zeile = bericht.zusatzbauer.find((z) => z.weg === 'karte')
    expect(zeile).toBeTruthy()
    expect(zeile.karteId).toBe('karte-1')
    expect(zeile.karteOffen).toBe(true)
    expect(zeile.urteil).toBe('ungeprüft')
  })

  it('der Lauf endet erfolgreich', () => {
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})

describe('Bauschritt 57 · Fundschwere „hoch": ein Zusatz-Angreifer schaut zuerst (E17)', () => {
  const projekt = frischesProjekt('hoch')
  let sicht
  let motor

  beforeAll(async () => {
    einstellungSteuerung.fundeAusserhalb = 'mitnehmen'
    einstellungSteuerung.zusatzbauerMax = 1
    kartenSpeicher.karten.length = 0
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({ reparaturRunden: 2, uebertragGrenze: 5, bloecke, pfeile }),
      'utf8'
    )
    schreiben(projekt, 'src/innen.js', 'alt\n')
    schreiben(projekt, 'js/daten/kern.js', 'kaputt\n')
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'a')
        return angriffsMeldung([
          {
            text: 'Die Rotation zerstört Daten.',
            schwere: 'hoch',
            fundort: 'js/daten/kern.js',
            soll: 'Die Rotation verliert keine Daten mehr.'
          }
        ])
      if (block.blockName === 'Zusatz-Angreifer')
        return angriffsMeldung([
          {
            text: 'Der geplante Fix übersieht den Leer-Fall.',
            schwere: 'mittel',
            fundort: 'js/daten/kern.js'
          }
        ])
      if (block.blockName === 'Zusatzbauer') {
        schreiben(projekt, 'js/daten/kern.js', 'repariert\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'pe')
        return pruefMeldung('Alles in Ordnung.', [
          { fundpfad: 'js/daten/kern.js', urteil: 'erfüllt', beleg: 'Gemessen: kein Datenverlust.' }
        ])
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('Paket schneiden')
    await motor.freigeben('Angreifer')
    // Der nur-lesende Zusatz-Angreifer blockiert die Welle nicht — der Bauer
    // läuft neben ihm an; der SCHREIBENDE Zusatzbauer wartet, bis der Bauer
    // fertig ist (er läuft allein).
    await motor.freigeben('Zusatz-Angreifer')
    await motor.freigeben('Bauer')
    await motor.freigeben('Zusatzbauer')
    await motor.freigeben('Prüfer')
    await motor.freigeben('Sessionende')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('der Zusatz-Angreifer läuft VOR dem Zusatzbauer, mit eigener Ticker-Zeile', () => {
    const zeilen = sicht.ticker()
    const zaStart = zeilen.indexOf(texte.ticker.zusatzAngreiferStartet('Zusatz-Angreifer', 'Angreifer'))
    const zbStart = zeilen.indexOf(texte.ticker.zusatzbauerStartet('Zusatzbauer', 'Angreifer'))
    expect(zaStart).toBeGreaterThanOrEqual(0)
    expect(zbStart).toBeGreaterThan(zaStart)
  })

  it('seine Angriffsliste erreicht den Zusatzbauer über die normale Übergabe (E17)', () => {
    const id = motor.namen.get('Zusatzbauer')
    expect(motor.auftraege.get(id)[0]).toContain('Der geplante Fix übersieht den Leer-Fall.')
  })

  it('der Bericht vermerkt die Angriffsliste am Zusatzbauer, der Lauf endet erfolgreich', () => {
    const bericht = neuesterBericht(projekt)
    const zeile = bericht.zusatzbauer.find((z) => z.weg === 'zusatzbauer')
    expect(zeile.angriffsliste).toBe(true)
    expect(zeile.urteil).toBe('erfüllt')
    expect(zeile.karteOffen).toBe(false)
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})

describe('Bauschritt 57 · E10: Der Alleinlauf kommt aus der BESTEHENDEN Wellenregel', () => {
  // Ein Zusatzbauer ist ein Schreiber ohne Dateiliste — genau dafür trägt die
  // wellenStartRegel „läuft allein" schon heute; sie wird nicht angefasst.
  const zusatz = { instanzId: 'z', name: 'Zusatzbauer', def: { nurLesen: false, prueft: false }, dateiListe: null }
  const bauer = { instanzId: 'b', name: 'Bauer', def: { nurLesen: false, prueft: false }, dateiListe: ['src/'] }
  const pruefer = { instanzId: 'pr', name: 'Prüfer', def: { nurLesen: false, prueft: true }, dateiListe: null }

  it('er startet erst, wenn nichts schreibt', () => {
    expect(wellenStartRegel(zusatz, []).darf).toBe(true)
    expect(wellenStartRegel(zusatz, [bauer]).darf).toBe(false)
    expect(wellenStartRegel(zusatz, [pruefer]).darf).toBe(false)
  })

  it('neben ihm startet kein Umsetzer und kein Prüfer', () => {
    expect(wellenStartRegel(bauer, [zusatz]).darf).toBe(false)
    expect(wellenStartRegel(pruefer, [zusatz]).darf).toBe(false)
  })
})
