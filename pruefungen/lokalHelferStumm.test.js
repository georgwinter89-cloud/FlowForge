// Helfer-Werkzeuge lokaler Blöcke sind stumm (Zwischenschritt 0.51.1, Punkt 3).
//
// Der Befund aus Georgs Life-OS-Lauf vom 20.08.2026: Ein Block der Klasse
// „lokal" läuft in einer eigenen Motor-Instanz gegen dieselbe GPU wie die
// lokale Helfer-KI. Seine Helfer-Aufrufe liefen also gegen die Karte, die ihn
// selbst gerade rechnen ließ — gemessen 48 Timeouts à 5 Minuten, danach machte
// der Agent alles selbst und blähte dabei seinen Kontext. Ein lokaler Block IST
// die lokale KI; Delegieren an dieselbe GPU ist sinnlos.
//
// Gemessen wird VERHALTEN am echten Ablaufplaner mit Motor-Ersatz (Muster:
// lokalerPoolLauf.test.js): Was der Motor an Optionen bekommt, was im Auftrag
// des Agenten steht und was der Ticker sagt.
//
// Rot vor Grün: Vor diesem Schritt bekam JEDER Motor die lokaleHelfer-Option,
// der Zerlege-Zusatz hing auch am lokalen Bauer, der Katalog-Hinweis auf
// lokal_recherchieren blieb bei lokalen Blöcken stehen, und nach dem Urteil
// eines lokalen Prüfers startete FlowForge eine lokale Vorreparatur.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

const steuerung = vi.hoisted(() => ({ bauen: null, reparaturen: [] }))
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
vi.mock('../src/main/startanleitung.js', async (importOriginal) => ({
  ...(await importOriginal()),
  startanleitungVorhanden: () => true
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
  // Die Vorreparatur wird nur GEZÄHLT — sie ersetzt nichts, damit der Lauf
  // danach den gewohnten Weg zum Motor-Bauer nimmt.
  lokalReparieren: async (optionen) => {
    steuerung.reparaturen.push(optionen)
    return { ok: true, ersetzungen: 0, schritte: 1 }
  }
}))
vi.mock('../src/main/motor/lokalesModell.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lokalesModellBereitstellen: async () => ({ ok: true, modell: 'flowforge-qwen3-8-27b' })
}))

import { laufStarten } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }

// ——— Helfer (Muster aus lokalerPoolLauf.test.js) ————————————————————————————

function projektSchluessel(projektPfad) {
  return crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
}

function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-lokalstumm-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(path.join(app.getPath('userData'), 'sicherungen', projektSchluessel(wurzel)), {
    recursive: true,
    force: true
  })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

// Merkt sich je Anlauf die Motor-Optionen (lokaleHelfer! lokal!) und den
// Auftragstext — genau daran hängt die Stummschaltung.
function motorErsatz(meldungenFuer) {
  const wartend = new Map()
  const gestartet = []
  steuerung.bauen = (optionen) => ({
    sessionKennung: 'pruef-session',
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      gestartet.push({
        instanzId: block.instanzId,
        auftrag: block.auftrag,
        lokaleHelfer: optionen.lokaleHelfer ?? null,
        lokal: optionen.lokal ?? null
      })
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, async () => {
          aufloesen({
            zustand: 'erfolgreich',
            ergebnisText: '',
            meldungen: await meldungenFuer(block, optionen),
            fehlertext: '',
            fehlerArt: null,
            verbrauch: null,
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
      const bis = Date.now() + 10000
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
      // Der Ticker liegt bei, wenn etwas nicht eintritt — sonst rät der
      // nächste Leser, warum ein Block nie gestartet ist.
      if (!pruefung())
        throw new Error(['Nicht eingetreten: ' + was, ...this.ticker()].join('\n'))
    },
    async warteAufEnde() {
      await this.warteAuf(() => ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
      return ereignisse.find((e) => e.art === 'fertig')
    }
  }
}

function laufAufbauen(name, bloecke, pfeile, meldungenFuer, reparaturRunden = 0) {
  const projekt = frischesProjekt(name)
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden, uebertragGrenze: 5, bloecke, pfeile }),
    'utf8'
  )
  return { projekt, motor: motorErsatz(meldungenFuer), sicht: fensterErsatz() }
}

function paketMeldung(block, listen, kurzNamen) {
  const pakete = block.ziele.map((ziel) => ({
    zielBlock: ziel.adresse,
    kurzname: kurzNamen[ziel.instanzId],
    ziel: 'Teil ' + ziel.instanzId,
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

function pruefMeldung(bestanden) {
  const roh = bestanden
    ? { ...rahmen, urteil: 'bestanden', beanstandungen: [], rotVorGruen: '', geprueft: [] }
    : {
        ...rahmen,
        urteil: 'fehlgeschlagen',
        // Rein mechanisch — genau der Fall, in dem die lokale Vorreparatur
        // sonst anspringt.
        beanstandungen: [
          { einstufung: 'mechanisch', text: 'Ein Tippfehler in der Zeile 12.', fundort: 'src/bl/x.js' }
        ],
        rotVorGruen: '',
        geprueft: []
      }
  const ergebnis = meldungPruefen('pruefbeleg', roh, 'Prüfbeleg')
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}

// ——— (1) Motor-Optionen und Auftrag ————————————————————————————————————————

describe('0.51.1 · Ein lokaler Block bekommt keine Helfer-KI — er IST sie', () => {
  let lauf
  beforeAll(async () => {
    lauf = laufAufbauen(
      'motor',
      [
        { instanzId: 'p', blockId: 'paket-schneiden', zusatz: 'Quelle', feldWerte: { wunsch: 'Zwei Teile' } },
        { instanzId: 'bl', blockId: 'bauer', zusatz: 'Lokal', modell: 'lokal' },
        { instanzId: 'bc', blockId: 'bauer', zusatz: 'Claude' }
      ],
      [
        { von: 'p', nach: 'bl' },
        { von: 'p', nach: 'bc' }
      ],
      async (block, optionen) => {
        if (block.instanzId === 'p') {
          // Ohne gemeldetes Paket fordert FlowForge einmal nach — der Lauf käme
          // sonst gar nicht bis zu den Bauern.
          optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
          return paketMeldung(
            block,
            { bl: ['src/bl/'], bc: ['src/bc/'] },
            { bl: 'Lokaler Teil', bc: 'Claude-Teil' }
          )
        }
        return umsetzungsMeldung()
      }
    )
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('p')
    await sicht.warteAuf(() => motor.start('bl') && motor.start('bc'), 'beide Bauer gestartet')
    await motor.freigeben('bl')
    await motor.freigeben('bc')
    await sicht.warteAufEnde()
  }, 60000)

  it('reicht dem lokalen Motor KEINE Helfer-Option durch — dem Claude-Motor sehr wohl', () => {
    const lokal = lauf.motor.start('bl')
    expect(lokal.lokal).toMatchObject({ adresse: 'http://127.0.0.1:11434' })
    expect(lokal.lokaleHelfer).toBeNull()
    const claude = lauf.motor.start('bc')
    expect(claude.lokal).toBeNull()
    expect(claude.lokaleHelfer).toMatchObject({
      modell: 'qwen3.8:27b',
      adresse: 'http://127.0.0.1:11434'
    })
  })

  it('hängt dem lokalen Bauer die Zerlege-Anweisung nicht an — dem Claude-Bauer schon', () => {
    const zusatz = texte.agentenLokaleHelfer.bauenAuftragZusatz
    expect(lauf.motor.start('bl').auftrag).not.toContain(zusatz)
    expect(lauf.motor.start('bc').auftrag).toContain(zusatz)
  })

  it('ersetzt den Katalog-Hinweis auf lokal_recherchieren im Auftrag des lokalen Bauers', () => {
    const lokalerAuftrag = lauf.motor.start('bl').auftrag
    expect(lokalerAuftrag).not.toContain('lokal_recherchieren')
    expect(lokalerAuftrag).toContain('(Agent-Werkzeug)')
    // Der Claude-Bauer liest den Hinweis unverändert — sein Helfer gibt es.
    expect(lauf.motor.start('bc').auftrag).toContain('lokal_recherchieren')
  })
})

// ——— (2) Keine lokale Vorreparatur nach dem Urteil eines lokalen Prüfers ————

const prueferBloecke = (prueferLokal) => [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: 'Quelle', feldWerte: { wunsch: 'Ein Teil' } },
  { instanzId: 'b', blockId: 'bauer', zusatz: 'Ziel' },
  {
    instanzId: 'pr',
    blockId: 'pruefer',
    zusatz: prueferLokal ? 'lokal' : 'Claude',
    ...(prueferLokal ? { modell: 'lokal' } : {})
  }
]
const prueferPfeile = [
  { von: 'p', nach: 'b' },
  { von: 'b', nach: 'pr' }
]
// Ohne aufbewahrten Prüfbefehl bekommt der Prüfer eine Nachbesserungs-Runde
// (er soll einen setzen) — sein erster Anlauf zählt also noch nicht. Erst der
// ZWEITE trägt das Urteil, das die Rückführung auslöst, der dritte bestätigt.
const prueferMeldungen = () => {
  const anlaeufe = {}
  const urteile = [true, false, true]
  return async (block, optionen) => {
    if (block.instanzId === 'p') {
      optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
      return paketMeldung(block, { b: ['src/b/'] }, { b: 'Ein Teil' })
    }
    if (block.instanzId === 'b') return umsetzungsMeldung()
    anlaeufe.pr = (anlaeufe.pr ?? 0) + 1
    return pruefMeldung(urteile[anlaeufe.pr - 1] ?? true)
  }
}

// Ein Lauf Paket schneiden → Bauer → Prüfer, bis er fertig ist: Nachbesserung
// wegen fehlendem Prüfbefehl, dann das Urteil „fehlgeschlagen", dann die
// Reparatur-Runde des Bauers und die bestandene Nachprüfung.
async function prueferLaufFahren(lauf) {
  const { projekt, motor, sicht } = lauf
  expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
  await motor.freigeben('p')
  await motor.freigeben('b')
  await motor.freigeben('pr')
  await sicht.warteAuf(() => motor.starts('pr') === 2, 'Prüfer nach der Nachforderung erneut')
  await motor.freigeben('pr')
  await sicht.warteAuf(() => motor.starts('b') === 2, 'Bauer ein zweites Mal gestartet')
  await motor.freigeben('b')
  await sicht.warteAuf(() => motor.starts('pr') === 3, 'Prüfer prüft nach')
  await motor.freigeben('pr')
  await sicht.warteAufEnde()
}

describe('0.51.1 · Nach dem Urteil eines lokalen Prüfers läuft keine lokale Vorreparatur', () => {
  let lauf
  beforeAll(async () => {
    steuerung.reparaturen = []
    lauf = laufAufbauen(
      'pruefer-lokal',
      prueferBloecke(true),
      prueferPfeile,
      prueferMeldungen(),
      2
    )
    await prueferLaufFahren(lauf)
  }, 60000)

  it('startet keine lokale Reparatur und sagt im Ticker, warum', () => {
    expect(steuerung.reparaturen).toHaveLength(0)
    const zeilen = lauf.sicht.ticker()
    expect(zeilen).toContain(texte.ticker.lokaleVorreparaturUebersprungen('Prüfer · lokal'))
    expect(zeilen.some((z) => z.startsWith('Lokale Reparatur, Versuch'))).toBe(false)
  })

  it('führt stattdessen sofort zum Bauer zurück — die Reparatur-Runde wird ganz normal genommen', () => {
    expect(lauf.motor.starts('b')).toBe(2)
    expect(lauf.sicht.ticker()).toContain(texte.ticker.rueckfuehrung('Bauer · Ziel', 1, 2))
  })
})

describe('0.51.1 · Ein nicht-lokaler Prüfer behält seine lokale Vorreparatur', () => {
  let lauf
  beforeAll(async () => {
    steuerung.reparaturen = []
    lauf = laufAufbauen(
      'pruefer-claude',
      prueferBloecke(false),
      prueferPfeile,
      prueferMeldungen(),
      2
    )
    await prueferLaufFahren(lauf)
  }, 60000)

  it('lässt die lokale KI zuerst ran — und schweigt von einem Überspringen', () => {
    expect(steuerung.reparaturen.length).toBeGreaterThan(0)
    const zeilen = lauf.sicht.ticker()
    expect(zeilen).not.toContain(texte.ticker.lokaleVorreparaturUebersprungen('Prüfer · Claude'))
    expect(zeilen.some((z) => z.startsWith('Lokale Reparatur, Versuch'))).toBe(true)
  })
})
