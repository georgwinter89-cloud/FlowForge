// Rechte-Einstufung, Ticker-Zeilen und die Kette bis zum Motor: Websuche
// lokaler Blöcke (0.51.2).
//
// Gemessen wird VERHALTEN an der echten pruefeWerkzeug und der echten
// tickerZeilen — nicht die Anwesenheit von Codezeilen.
//
// Rot-vor-Grün (gemessen 20.08.2026 am Stand vor diesem Schritt):
//   pruefeWerkzeug('mcp__web__web_suche', …, nurLesen=true)
//     → { gesperrt: 'Dieser Block darf nur lesen …',
//         tickerText: 'Schreib-Versuch gestoppt …' }   — unwahre Begründung
//   pruefeWerkzeug('mcp__web__web_suche', …, nurLesen=false)
//     → { frage: '… Werkzeug, das FlowForge nicht kennt: mcp__web__web_suche' }
//   tickerZeilen(<Aufruf von mcp__web__web_suche>)
//     → ['Nutzt Werkzeug: mcp__web__web_suche']        — Maschinen-Kennung
//
// Warum BEIDE nurLesen-Fälle geprüft werden: Der Web-Zweig steht in
// pruefeWerkzeug bewusst VOR dem nur-lesen-Auffangnetz. Rutscht er bei einer
// späteren Umsortierung dahinter, fällt genau der nurLesen=true-Fall wieder um
// — und wäre ohne diese Prüfung unsichtbar.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

// Attrappen nur für den zweiten Teil (die Kette lauf.js → Motor). Der Motor
// wird ersetzt, pruefeWerkzeug und tickerZeilen bleiben die echten (Muster
// lokalerPoolLauf.test.js / lokalHelferStumm.test.js).
const steuerung = vi.hoisted(() => ({ bauen: null, searxngAdresse: '' }))
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
          lokaleHelferAdresse: 'http://127.0.0.1:11434',
          searxngAdresse: steuerung.searxngAdresse
        }
      }
    },
    motorBereit: () => ({ ok: true })
  }
})
vi.mock('../src/main/motor/lokaleHelfer.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lokaleHelferPruefen: async () => ({ erreichbar: true, modellDa: true })
}))
vi.mock('../src/main/motor/lokalesModell.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lokalesModellBereitstellen: async () => ({ ok: true, modell: 'flowforge-qwen3-8-27b' })
}))

import { pruefeWerkzeug, tickerZeilen } from '../src/main/motor/claudeCodeMotor.js'
import { laufStarten } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const PROJEKT = 'C:\\Projekte\\Beispiel'

// Aufruf der echten pruefeWerkzeug in der Stellung, in der der Motor sie ruft.
function pruefen(name, eingabe, nurLesen) {
  return pruefeWerkzeug(name, eingabe, PROJEKT, nurLesen, false)
}

// Eine SDK-Nachricht, wie der Block-Agent sie erzeugt: assistant mit
// parent_tool_use_id (der Hauptfaden wäre der Koordinator und bliebe draußen).
function agentAufruf(name, eingabe) {
  return {
    type: 'assistant',
    parent_tool_use_id: 'block-1',
    message: { content: [{ type: 'tool_use', name, input: eingabe }] }
  }
}

const blockIds = new Set(['block-1'])

describe('0.51.2 · Die zwei Nachschlage-Werkzeuge sind rein lesend eingestuft', () => {
  it('web_suche ist erlaubt — mit der Sperre „darf nur lesen" UND ohne sie', () => {
    expect(pruefen('mcp__web__web_suche', { begriff: 'electron version' }, true)).toEqual({
      erlaubt: true
    })
    expect(pruefen('mcp__web__web_suche', { begriff: 'electron version' }, false)).toEqual({
      erlaubt: true
    })
  })

  it('webseite_lesen ebenso — in beiden Stellungen ohne Rückfrage', () => {
    expect(pruefen('mcp__web__webseite_lesen', { adresse: 'https://a.example' }, true)).toEqual({
      erlaubt: true
    })
    expect(pruefen('mcp__web__webseite_lesen', { adresse: 'https://a.example' }, false)).toEqual({
      erlaubt: true
    })
  })

  it('meldet nie „Schreib-Versuch gestoppt" — das wäre eine unwahre Begründung', () => {
    for (const nurLesen of [true, false]) {
      const urteil = pruefen('mcp__web__web_suche', { begriff: 'x' }, nurLesen)
      expect(urteil.gesperrt).toBeUndefined()
      expect(urteil.tickerText).toBeUndefined()
      expect(urteil.frage).toBeUndefined()
    }
  })

  it('trägt die Namen NICHT in die Nur-Lesen-Liste nach — der eigene Zweig entscheidet', async () => {
    // Ein anderes, unbekanntes mcp-Werkzeug bleibt unverändert im
    // Auffangnetz: Der Web-Zweig hängt am Präfix, nicht an einer Namensliste.
    const fremd = pruefen('mcp__fremd__irgendwas', {}, true)
    expect(fremd.erlaubt).toBeUndefined()
    expect(fremd.gesperrt).toBe(texte.rechteFrage.nurLesenGesperrtFuerAgent)
  })
})

describe('0.51.2 · Regressionsanker: WebSearch und WebFetch der CLI bleiben, wie sie waren', () => {
  it('fragen weiterhin nach, wenn der Block schreiben darf', () => {
    expect(pruefen('WebSearch', { query: 'electron version' }, false)).toEqual({
      frage: texte.rechteFrage.internet('electron version')
    })
    expect(pruefen('WebFetch', { url: 'https://a.example' }, false)).toEqual({
      frage: texte.rechteFrage.internet('https://a.example')
    })
  })

  it('bleiben unter der Sperre „darf nur lesen" gesperrt', () => {
    for (const name of ['WebSearch', 'WebFetch']) {
      const urteil = pruefen(name, { query: 'x', url: 'https://a.example' }, true)
      expect(urteil.gesperrt).toBe(texte.rechteFrage.nurLesenGesperrtFuerAgent)
      expect(urteil.erlaubt).toBeUndefined()
    }
  })
})

describe('0.51.2 · Der Ticker zeigt das Ziel, nicht die Maschinen-Kennung', () => {
  it('ein web_suche-Aufruf ergibt genau EINE Zeile mit dem Suchbegriff darin', () => {
    const zeilen = tickerZeilen(
      agentAufruf('mcp__web__web_suche', { begriff: 'electron 43 release notes' }),
      PROJEKT,
      blockIds
    )
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toContain('electron 43 release notes')
    expect(zeilen[0]).not.toContain('mcp__web__')
    expect(zeilen[0]).not.toBe(texte.ticker.werkzeug('mcp__web__web_suche'))
  })

  it('ein webseite_lesen-Aufruf ergibt genau EINE Zeile mit der Adresse darin', () => {
    const zeilen = tickerZeilen(
      agentAufruf('mcp__web__webseite_lesen', { adresse: 'https://www.electronjs.org/docs' }),
      PROJEKT,
      blockIds
    )
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]).toContain('https://www.electronjs.org/docs')
    expect(zeilen[0]).not.toContain('mcp__web__')
  })

  it('kürzt sehr lange Ziele, statt den Ticker zu fluten', () => {
    const zeilen = tickerZeilen(
      agentAufruf('mcp__web__web_suche', { begriff: 'a'.repeat(500) }),
      PROJEKT,
      blockIds
    )
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].length).toBeLessThan(300)
  })

  it('Regressionsanker: WebSearch der CLI tickert unverändert weiter', () => {
    expect(tickerZeilen(agentAufruf('WebSearch', { query: 'electron' }), PROJEKT, blockIds)).toEqual(
      [texte.ticker.internet('electron')]
    )
  })
})

// ——— Die Kette lauf.js → Motor (Fund 4) ————————————————————————————————————
//
// Fund 4 der Angriffsliste, gemessen: Das lokal-Literal in motorBauen ist ein
// NEUES Objekt aus einzeln aufgezählten Feldern, kein Spread — ein vergessenes
// Feld kommt im Motor still nie an (Beweis am Bestand: die Pool-Einträge
// tragen `basis`, im ganzen Motor gibt es dafür null Fundstellen). Deshalb
// wird die Kette hier am ECHTEN Ablaufplaner durchgefahren, nicht am Quelltext.

function projektSchluessel(projektPfad) {
  return crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
}

function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-webkette-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(path.join(app.getPath('userData'), 'sicherungen', projektSchluessel(wurzel)), {
    recursive: true,
    force: true
  })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

// Motor-Ersatz: merkt sich je Block die lokal- UND die websuche-Option.
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
        lokal: optionen.lokal ?? null,
        websuche: optionen.websuche ?? null
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
    start: (instanzId) => gestartet.find((g) => g.instanzId === instanzId),
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
    fenster: {
      isDestroyed: () => false,
      isFocused: () => true,
      webContents: { send: (_kanal, daten) => ereignisse.push(daten) }
    },
    ticker: () => ereignisse.filter((e) => e.art === 'ticker').map((e) => e.text),
    async warteAufEnde() {
      const bis = Date.now() + 15000
      while (!ereignisse.some((e) => e.art === 'fertig') && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      if (!ereignisse.some((e) => e.art === 'fertig'))
        throw new Error(['Der Lauf endete nie.', ...this.ticker()].join('\n'))
    }
  }
}

// Zwei lokale Blöcke (an EINER Adresse laufen sie nacheinander) und ein
// Claude-Block — genau die Aufstellung, an der sich „eine Zeile je Laufstart,
// nicht je Block" messen lässt.
async function ketteFahren(name, searxngAdresse) {
  steuerung.searxngAdresse = searxngAdresse
  const projekt = frischesProjekt(name)
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({
      reparaturRunden: 0,
      uebertragGrenze: 5,
      bloecke: [
        { instanzId: 'a', blockId: 'spaeher', zusatz: 'A', modell: 'lokal' },
        { instanzId: 'b', blockId: 'spaeher', zusatz: 'B', modell: 'lokal' },
        { instanzId: 'c', blockId: 'spaeher', zusatz: 'C' },
        { instanzId: 's', blockId: 'integrator-recherche', zusatz: '' }
      ],
      // Ein Sammelblock am Ende: Das Schaubild muss zusammenhängen, sonst
      // lehnt FlowForge den Start ab.
      pfeile: [
        { von: 'a', nach: 's' },
        { von: 'b', nach: 's' },
        { von: 'c', nach: 's' }
      ]
    }),
    'utf8'
  )
  const motor = motorErsatz()
  const sicht = fensterErsatz()
  expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
  await motor.freigeben('a')
  await motor.freigeben('b')
  await motor.freigeben('c')
  await motor.freigeben('s')
  await sicht.warteAufEnde()
  return { motor, sicht }
}

describe('0.51.2 · Die SearXNG-Adresse kommt wirklich am lokalen Motor an', () => {
  let lauf
  beforeAll(async () => {
    lauf = await ketteFahren('searxng', 'http://gaming-pc:8080')
  }, 60000)

  it('reicht sie jedem lokalen Motor als websuche-Option durch', () => {
    for (const id of ['a', 'b']) {
      const start = lauf.motor.start(id)
      expect(start.lokal).toMatchObject({ adresse: 'http://127.0.0.1:11434' })
      expect(start.websuche).toEqual({ searxngAdresse: 'http://gaming-pc:8080' })
    }
  })

  it('der Claude-Motor bekommt keine — er hat WebSearch/WebFetch der CLI', () => {
    const claude = lauf.motor.start('c')
    expect(claude.lokal).toBeNull()
    expect(claude.websuche).toBeNull()
  })

  it('nennt die eigene Such-Instanz genau EINMAL im Ticker — nicht je Block', () => {
    const zeile = texte.ticker.websucheQuelleAmStartEigene('http://gaming-pc:8080')
    const zeilen = lauf.sicht.ticker()
    expect(zeilen.filter((z) => z === zeile)).toHaveLength(1)
    expect(zeilen).not.toContain(texte.ticker.websucheQuelleAmStartEingebaut)
  })
})

describe('0.51.2 · Ohne eingetragene Adresse gilt die eingebaute Quelle — und das steht da', () => {
  let lauf
  beforeAll(async () => {
    lauf = await ketteFahren('eingebaut', '')
  }, 60000)

  it('gibt dem lokalen Motor eine leere Adresse mit (leer = eingebaute Quelle)', () => {
    expect(lauf.motor.start('a').websuche).toEqual({ searxngAdresse: '' })
  })

  it('sagt am Laufstart genau einmal, dass die eingebaute Quelle gilt', () => {
    const zeilen = lauf.sicht.ticker()
    expect(zeilen.filter((z) => z === texte.ticker.websucheQuelleAmStartEingebaut)).toHaveLength(1)
  })
})

describe('0.51.2 · Die Warnung bei zu knappem Fenster nennt jetzt auch die Seitentexte', () => {
  it('erklärt, dass nachgeschlagene Seiten denselben Platz brauchen', () => {
    const zeile = texte.ticker.lokalFensterKnapp(32768)
    expect(zeile).toMatch(/Seitentext|Webseite/)
    // Gewarnt, nicht gesperrt — die Zeile bleibt ein Hinweis mit Rat.
    expect(zeile).toContain('Stell in den Einstellungen 64k oder mehr ein')
  })
})
