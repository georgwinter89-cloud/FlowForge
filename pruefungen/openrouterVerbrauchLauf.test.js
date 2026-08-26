// OpenRouter-Verbrauch im ECHTEN Lauf (Bauschritt 60, Befund C1 Prüfer 2) —
// gemessen am Ablaufplaner mit Motor-Ersatz (Muster lokalerPoolLauf.test.js):
// Startprüfung, Verbrauchs-Zufluss und der gespeicherte Laufbericht sind echt;
// Attrappe sind nur der Motor und die Einstellungen.
//
// Der Befund aus der gebauten App: Ein OpenRouter-Anlauf meldete Faden-Zuwachs
// (blockZuwachs) 0, die Modell-Aufschlüsselung aber 165 echte Anbieter-Tokens —
// verbrauch.openrouter.tokens und blockErgebnis.tokens standen auf 0, die
// „davon OpenRouter"-Zeile fehlte, und die gemessenen Kosten tauchten in den
// Metriken nie auf. Exakt das „Faden-Zuwachs 0"-Muster der lokalen Blöcke
// (BAUPLAN 51, Befund Prüfer 2): Die Ehrlichkeits-Korrektur
// max(zaehlTokens, modelleSumme) galt nur für knotenLokal.
//
// Rot vor Grün: Mit der Korrektur nur für knotenLokal ist diese Datei rot
// (tokens 0 statt 165) — grün wird sie erst, wenn auch OpenRouter-Blöcke aus
// der Modell-Aufschlüsselung zählen.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

const steuerung = vi.hoisted(() => ({ bauen: null, einstellungenZusatz: {} }))
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
          openRouterAktiv: true,
          openRouterSchluessel: 'sk-or-pruef',
          openRouterModell: 'stealth/ox-alpha',
          openRouterKontext: 200000,
          ...steuerung.einstellungenZusatz
        }
      }
    },
    motorBereit: () => ({ ok: true })
  }
})

import { laufStarten, laufberichteLaden } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'

// ——— Helfer (Muster lokalerPoolLauf.test.js) ————————————————————————————————

function projektSchluessel(projektPfad) {
  return crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
}
function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-orverbrauch-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(path.join(app.getPath('userData'), 'sicherungen', projektSchluessel(wurzel)), {
    recursive: true,
    force: true
  })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

function motorErsatz(verbrauchFuer) {
  const wartend = new Map()
  steuerung.bauen = () => ({
    sessionKennung: 'pruef-session',
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, () => {
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
    async freigeben(instanzId) {
      const bis = Date.now() + 8000
      while (!wartend.has(instanzId) && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
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
    async warteAufEnde() {
      const bis = Date.now() + 10000
      while (!ereignisse.some((e) => e.art === 'fertig') && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      const ende = ereignisse.find((e) => e.art === 'fertig')
      if (!ende) throw new Error('Lauf nie fertig geworden')
      return ende
    }
  }
}

describe('Bauschritt 60 · OpenRouter-Tokens aus der Modell-Aufschlüsselung, wenn der Faden-Zuwachs 0 meldet (Befund C1)', () => {
  let bericht
  beforeAll(async () => {
    const projekt = frischesProjekt('c1')
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({
        reparaturRunden: 2,
        uebertragGrenze: 5,
        bloecke: [
          { instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'openrouter' },
          { instanzId: 'c', blockId: 'spaeher', zusatz: 'C' },
          { instanzId: 's', blockId: 'integrator-recherche', zusatz: '' }
        ],
        pfeile: [
          { von: 'a', nach: 's' },
          { von: 'c', nach: 's' }
        ]
      }),
      'utf8'
    )
    // Der gemessene Fall der gebauten App: Faden-Zuwachs 0, aber die
    // Aufschlüsselung trägt 120+45=165 echte Anbieter-Tokens und der
    // Übersetzer hat 0,0042 $ gemessen. Daneben ein Claude-Block mit
    // theoretischen API-Kosten — er nagelt die Kosten-Weiche fest.
    const verbrauch = {
      a: {
        blockZuwachs: 0,
        unterTokens: 0,
        kostenUsd: 0.0042,
        kontextFenster: 200000,
        openrouter: true,
        modelle: [{ modell: 'stealth/ox-alpha', tokens: 165 }]
      },
      c: {
        blockZuwachs: 700,
        unterTokens: 0,
        kostenUsd: 0.5,
        kontextFenster: 200000,
        modelle: [{ modell: 'claude-opus-4', tokens: 700 }]
      }
    }
    const motor = motorErsatz((id) => verbrauch[id] ?? null)
    const sicht = fensterErsatz()
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('a')
    await motor.freigeben('c')
    await motor.freigeben('s')
    const ende = await sicht.warteAufEnde()
    expect(ende.zustand).toBe('erfolgreich')
    const { berichte } = laufberichteLaden(projekt)
    expect(berichte).toHaveLength(1)
    bericht = berichte[0]
  }, 60000)

  it('zählt die Anbieter-Tokens in Gesamt UND OpenRouter-Topf, obwohl blockZuwachs 0 ist', () => {
    expect(bericht.verbrauch.openrouter.tokens).toBe(165)
    // Die Gesamtsumme enthält die OpenRouter-Tokens weiter — der Abo-Anteil
    // rechnet „gesamt − lokal − openrouter" und hinge sonst schief.
    expect(bericht.verbrauch.tokens).toBe(865)
    expect(Number.isFinite(bericht.verbrauch.openrouter.dauerMs)).toBe(true)
    expect(bericht.verbrauch.openrouter.dauerMs).toBeGreaterThanOrEqual(0)
  })

  it('das Block-Ergebnis trägt die korrigierte Zahl — die Blockkarte sagt nie mehr „0 Tokens"', () => {
    const a = bericht.blockErgebnisse.find((e) => e.zusatz === 'A')
    expect(a.tokens).toBe(165)
    expect(a.klasse).toBe('openrouter')
  })

  it('die gemessenen Kosten stehen NUR im OpenRouter-Topf — die theoretischen API-Kosten daneben bleiben sauber', () => {
    expect(bericht.verbrauch.openrouter.kostenUsd).toBeCloseTo(0.0042, 10)
    // Der Claude-Block liefert 0,50 $ theoretische Kosten — und NUR die.
    expect(bericht.verbrauch.kostenUsd).toBeCloseTo(0.5, 10)
    const a = bericht.blockErgebnisse.find((e) => e.zusatz === 'A')
    expect(a.kostenUsd).toBeCloseTo(0.0042, 10)
  })
})
