// Die Erklärung im echten Lauf (Zwischenschritt 0.51.6): Gemessen am
// Ablaufplaner mit Motor-Ersatz (Muster: lokalerPoolLauf.test.js) — echt sind
// laufStarten, die Leerung der Prüfmappe und der Sicherungspunkt „Stand vor
// Lauf"; Attrappe sind nur Motor, Rauchtest, Prozessgruppe, Startanleitung und
// die Karten.
//
// Der Zeitpunkt ist der Kern: Die Prüfmappe ist nur vom DIFF der
// Reparatur-Runden ausgenommen (sicherungspunkte.js DIFF_AUSGESCHLOSSEN), nicht
// vom Sicherungspunkt selbst. Entstünde die Erklärung erst NACH dem Punkt
// „Stand vor Lauf", nähme sie der erste Rückroll mitten im Lauf wieder weg.
//
// Rot-vor-Grün: Vor diesem Zwischenschritt schrieb laufStarten überhaupt keine
// LIESMICH.md — beide Prüfungen unten liefen rot. Anschließend wurde der Aufruf
// probeweise HINTER den Sicherungspunkt verschoben: Dann blieb „nach dem Lauf
// vorhanden" grün, und genau die Zeitpunkt-Prüfung wurde rot.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const steuerung = vi.hoisted(() => ({ bauen: null, punkte: [] }))
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
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: [] })
}))
// Der Sicherungspunkt bleibt echt — er wird nur beim Anlegen befragt: Lag die
// Erklärung in diesem Augenblick schon in der Mappe?
vi.mock('../src/main/sicherungspunkte.js', async (importOriginal) => {
  const orig = await importOriginal()
  return {
    ...orig,
    sicherungspunktAnlegen: async (projektPfad, beschriftung) => {
      steuerung.punkte.push({
        beschriftung,
        erklaerungDa: fs.existsSync(path.join(projektPfad, 'pruefung', 'LIESMICH.md'))
      })
      return orig.sicherungspunktAnlegen(projektPfad, beschriftung)
    }
  }
})

import { laufStarten } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { MAPPEN_ERKLAERUNG } from '../src/main/pruefmappe.js'
import { texte } from '../src/shared/texte.js'

function motorErsatz() {
  const wartend = new Map()
  steuerung.bauen = () => ({
    sessionKennung: 'pruef-session',
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, () =>
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
        )
      })
    }
  })
  return {
    async freigeben(instanzId) {
      const bis = Date.now() + 8000
      while (!wartend.has(instanzId) && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      const los = wartend.get(instanzId)
      if (!los) throw new Error('Block nie gestartet: ' + instanzId)
      wartend.delete(instanzId)
      los()
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
    async warteAufEnde() {
      const bis = Date.now() + 20000
      while (!ereignisse.some((e) => e.art === 'fertig') && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      const ende = ereignisse.find((e) => e.art === 'fertig')
      if (!ende) throw new Error('Der Lauf ist nicht fertig geworden')
      return ende
    }
  }
}

describe('0.51.6 · Der Laufstart lässt die Erklärung in der Prüfmappe zurück', () => {
  const projekt = path.join(os.tmpdir(), `flowforge-erklaerung-lauf-${process.pid}`)
  let sicht
  let ticker

  beforeAll(async () => {
    fs.rmSync(projekt, { recursive: true, force: true })
    fs.mkdirSync(path.join(projekt, 'pruefung'), { recursive: true })
    // Ein Rest aus dem vorigen Lauf — er muss verschwinden.
    fs.writeFileSync(path.join(projekt, 'pruefung', 'alt.test.js'), 'alt', 'utf8')
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({
        reparaturRunden: 0,
        uebertragGrenze: 5,
        bloecke: [{ instanzId: 'a', blockId: 'spaeher', zusatz: '' }],
        pfeile: []
      }),
      'utf8'
    )
    const motor = motorErsatz()
    sicht = fensterErsatz()
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('a')
    expect((await sicht.warteAufEnde()).zustand).toBe('erfolgreich')
    ticker = sicht.ticker()
  }, 60000)

  it('leert die Mappe und legt die Erklärung hinein', () => {
    expect(fs.readdirSync(path.join(projekt, 'pruefung'))).toEqual([MAPPEN_ERKLAERUNG])
    expect(fs.readFileSync(path.join(projekt, 'pruefung', MAPPEN_ERKLAERUNG), 'utf8')).toBe(
      texte.agentenPruefordner.erklaerung
    )
  })

  it('meldet die Leerung weiterhin im Ticker', () => {
    expect(ticker).toContain(texte.ticker.pruefmappeGeleert)
  })

  it('schreibt sie VOR dem Sicherungspunkt „Stand vor Lauf" — sonst nähme ein Rückroll sie weg', () => {
    const vorLauf = steuerung.punkte.find(
      (p) => p.beschriftung === texte.sicherungen.beschriftungVorLauf('Späher')
    )
    expect(vorLauf, 'Sicherungspunkt „Stand vor Lauf" nicht angelegt').toBeTruthy()
    expect(vorLauf.erklaerungDa).toBe(true)
  })
})
