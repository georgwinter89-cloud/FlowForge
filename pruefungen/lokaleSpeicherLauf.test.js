// Speicher-Ehrlichkeit im ECHTEN Lauf (Zwischenschritt 0.51.3) — gemessen am
// Ablaufplaner mit Motor-Ersatz (Muster pruefungen/lokalerPoolLauf.test.js):
// Ticker, Zuteilungen und Blockreihenfolge sind echt; Attrappe sind nur der
// Motor (starteLaufMotor bekommt die lokal-Option und wird gemessen), die
// Einstellungen und die Ollama-Erreichbarkeit samt Modell-Ableitung.
//
// Gemessen wird genau das, was der Motor an der lokalen Instanz vorfindet:
//   - `lokal.geduldMs` trägt Georgs Einstellung an die Motor-Instanz (dort
//     wird daraus API_TIMEOUT_MS) und steht als Zeile am Laufanfang.
//   - `lokal.speicherPruefen()` liefert je Adresse GENAU EINMAL je Lauf true —
//     auch wenn dieselbe Adresse nacheinander mehrere Blöcke trägt. Der Zähler
//     gehört dem Lauf; der Motor lebt je Block und könnte ihn nicht führen.
//
// Rot vor Grün: Vor diesem Schritt gab es weder geduldMs noch speicherPruefen
// an der lokal-Option; die Warnzeile hätte bei jedem Block derselben Adresse
// neu gestanden, und die Geduld-Einstellung wäre nie im Motor angekommen.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

const steuerung = vi.hoisted(() => ({
  bauen: null,
  einstellungenZusatz: {},
  pruefen: () => ({ erreichbar: true, modellDa: true })
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
  lokalesModellBereitstellen: async () => ({ ok: true, modell: 'flowforge-qwen3-8-27b' })
}))

import { laufStarten } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const ADRESSE_1 = 'http://127.0.0.1:11434'
const ADRESSE_2 = 'http://ollama-zweitrechner:11434'

function projektSchluessel(projektPfad) {
  return crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
}
function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-lokalspeicher-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(path.join(app.getPath('userData'), 'sicherungen', projektSchluessel(wurzel)), {
    recursive: true,
    force: true
  })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

// Motor-Ersatz: hält jeden Block an, bis die Prüfung ihn freigibt. Beim
// Blockstart fragt er genau einmal `speicherPruefen()` — an derselben Stelle,
// an der der echte Motor nach dem ersten Turn misst — und merkt sich Antwort,
// Adresse und Geduld.
function motorErsatz() {
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
        adresse: optionen.lokal?.adresse ?? null,
        geduldMs: optionen.lokal?.geduldMs ?? null,
        darfMessen: optionen.lokal ? optionen.lokal.speicherPruefen() : null
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

function laufAufbauen(name, bloecke, pfeile) {
  const projekt = frischesProjekt(name)
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden: 2, uebertragGrenze: 5, bloecke, pfeile }),
    'utf8'
  )
  return { projekt, motor: motorErsatz(), sicht: fensterErsatz() }
}

const BLOECKE_ZWEI_LOKAL = [
  { instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' },
  { instanzId: 'b', blockId: 'spaeher', zusatz: 'B', modell: 'lokal' },
  { instanzId: 's', blockId: 'integrator-recherche', zusatz: '' }
]
const PFEILE_ZWEI_LOKAL = [
  { von: 'a', nach: 's' },
  { von: 'b', nach: 's' }
]

describe('0.51.3 · eine Adresse, zwei lokale Blöcke: gemessen wird genau einmal', () => {
  let lauf
  beforeAll(async () => {
    steuerung.einstellungenZusatz = {
      lokaleHelferAdressen: [ADRESSE_1],
      // 30 Minuten Geduld: die mittlere Stufe.
      lokaleAntwortGeduldMs: 1800000
    }
    steuerung.pruefen = () => ({ erreichbar: true, modellDa: true })
    lauf = laufAufbauen('eine-adresse', BLOECKE_ZWEI_LOKAL, PFEILE_ZWEI_LOKAL)
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('a')
    await motor.freigeben('b')
    await motor.freigeben('s')
    expect((await sicht.warteAufEnde()).zustand).toBe('erfolgreich')
  }, 60000)

  it('misst beim ERSTEN Block dieser Adresse, beim zweiten nicht mehr', () => {
    const { motor } = lauf
    expect(motor.start('a').adresse).toBe(ADRESSE_1)
    expect(motor.start('b').adresse).toBe(ADRESSE_1)
    expect(motor.start('a').darfMessen).toBe(true)
    expect(motor.start('b').darfMessen).toBe(false)
    // Der Claude-Block bekommt gar keine lokal-Option — er hat keine GPU.
    expect(motor.start('s').adresse).toBeNull()
    expect(motor.start('s').darfMessen).toBeNull()
  })

  it('reicht Georgs Geduld an jede lokale Motor-Instanz durch', () => {
    expect(lauf.motor.start('a').geduldMs).toBe(1800000)
    expect(lauf.motor.start('b').geduldMs).toBe(1800000)
    expect(lauf.motor.start('s').geduldMs).toBeNull()
  })

  it('sagt am Laufanfang einmal, welche Wartezeit gilt', () => {
    const zeilen = lauf.sicht.ticker()
    const zeile = texte.ticker.lokalGeduldGesetzt(30)
    expect(zeilen.filter((z) => z === zeile)).toHaveLength(1)
  })
})

describe('0.51.3 · zwei Adressen: jede wird für sich gemessen', () => {
  let lauf
  beforeAll(async () => {
    steuerung.einstellungenZusatz = {
      lokaleHelferAdressen: [ADRESSE_1, ADRESSE_2]
      // Kein Geduld-Feld: Standard — seit 0.51.4 sind das 30 Minuten, nicht
      // mehr „gar nicht setzen".
    }
    steuerung.pruefen = () => ({ erreichbar: true, modellDa: true })
    lauf = laufAufbauen('zwei-adressen', BLOECKE_ZWEI_LOKAL, PFEILE_ZWEI_LOKAL)
    const { projekt, motor, sicht } = lauf
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('a')
    await motor.freigeben('b')
    await motor.freigeben('s')
    expect((await sicht.warteAufEnde()).zustand).toBe('erfolgreich')
  }, 60000)

  it('gibt jeder Adresse ihre eigene Messung — zwei Blöcke, zwei Messungen', () => {
    const { motor } = lauf
    const lokale = motor.gestartet.filter((g) => g.adresse)
    expect(lokale.map((g) => g.adresse).sort()).toEqual([ADRESSE_1, ADRESSE_2].sort())
    expect(lokale.every((g) => g.darfMessen === true)).toBe(true)
  })

  // 0.51.4 — umgedreht: Vorher hieß dieser Fall „gar keine Geduld setzen, und
  // dann auch nichts tickern". Genau das hat den Life-OS-Lauf vom 21.08.2026
  // getötet (Abbruch nach 9 min 59 s bei laufendem Server), und im Ticker
  // stand nichts, was darauf gezeigt hätte. Ohne Wahl gilt jetzt der
  // FlowForge-Standard — und er steht sichtbar am Laufanfang.
  it('setzt ohne Georgs Wahl den Standard von 30 Minuten — und sagt es', () => {
    expect(
      lauf.motor.gestartet.filter((g) => g.adresse).every((g) => g.geduldMs === 1800000)
    ).toBe(true)
    const zeilen = lauf.sicht.ticker()
    expect(zeilen.filter((z) => z === texte.ticker.lokalGeduldGesetzt(30))).toHaveLength(1)
  })
})
