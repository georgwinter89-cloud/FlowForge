// Karten-Index im echten Lauf (BAUPLAN 53): Gemessen am Ablaufplaner mit
// Motor-Ersatz (Muster: pruefmappeErklaerungLauf.test.js) — echt sind
// laufStarten, die Kartenauswahl, der Auftragsbau und die Karten-Zuteilung;
// Attrappe sind nur Motor, Rauchtest, Prozessgruppe und Startanleitung.
//
// Drei Dinge, die vorher niemand festhielt und die alle drei still brechen
// können — ein Block ohne Karten meldet keinen Fehler, er arbeitet schlechter:
// 1. Der Auftrag trägt Volltext NUR für die gewählte Arbeit; Wissen und
//    Entscheidungen stehen im Verzeichnis, mit Titel, ohne Text.
// 2. Wissen und Entscheidungen stehen trotzdem in der Auswahl-Menge des Laufs
//    (Laufstand) — sonst könnte die Auftragsquelle sie niemandem zuteilen.
// 3. Der Rückfall ist zweigeteilt: „nie zugeteilt" heißt weiter „die gewählten
//    Aufgaben", „zugeteilt und übergangen" heißt „nur die Status-Karte".
//
// Rot-vor-Grün: Vor diesem Bauschritt gab kartenKontext nur eine Liste aus
// (kein Verzeichnis), und kartenFuerBlock kannte einen einzigen Rückfall auf
// die volle Auswahl — Prüfung 1, 3 und 4 liefen rot, Prüfung 2 ebenfalls
// (Wissens-Karten landeten nur über den Knopf „Alle Karten hinzufügen" in der
// Auswahl).
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const steuerung = vi.hoisted(() => ({ bauen: null, auftraege: new Map(), zuteilen: null }))
const KARTEN = vi.hoisted(() => [
  {
    id: '11111111-aaaa-4000-8000-000000000001',
    sorte: 'status',
    titel: 'Stand',
    text: 'Wir stehen bei null.'
  },
  {
    id: '22222222-bbbb-4000-8000-000000000002',
    sorte: 'aufgabe',
    erledigt: false,
    thema: 'Motor',
    titel: 'Ticker aufräumen',
    text: 'Die doppelten Zeilen im Ticker müssen weg.'
  },
  {
    id: '33333333-cccc-4000-8000-000000000003',
    sorte: 'entscheidung',
    thema: 'Motor',
    titel: 'Deutsch bleibt Pflicht',
    text: 'Alle Klartexte der App sind auf Deutsch.'
  },
  {
    id: '44444444-dddd-4000-8000-000000000004',
    sorte: 'wissen',
    thema: 'Aufbau',
    titel: 'Der Motor lebt in src/main',
    text: 'Der Hauptprozess liegt unter src/main, die Oberfläche unter src/renderer.'
  },
  // Totes Gewicht im Verzeichnis (Befund Prüfer 2): An diesen beiden arbeitet
  // kein Block dieses Laufs, und karten_zuteilen weist sie hart ab — gemessen
  // waren das 33 von 83 Zeilen, 842 Tokens je Block.
  {
    id: '55555555-eeee-4000-8000-000000000005',
    sorte: 'aufgabe',
    erledigt: true,
    thema: 'Motor',
    titel: 'Alter Absturz behoben',
    text: 'War ein Tippfehler im Ticker.'
  },
  {
    id: '66666666-ffff-4000-8000-000000000006',
    sorte: 'pruefung',
    titel: 'Ticker geprüft',
    text: 'Hält seit dem 20.08.'
  }
])
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
// liest (projekte.json im Datenordner) — geprüft wird hier der Auftragsbau,
// nicht das Laden.
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: KARTEN })
}))

import { laufStarten, volltextKarten } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { kurzKennung } from '../src/shared/kartenRegeln.js'

const [status, aufgabe, entscheidung, wissen, erledigt, pruefkarte] = KARTEN

function motorErsatz() {
  const wartend = new Map()
  steuerung.bauen = (optionen) => {
    steuerung.zuteilen = optionen.aufKartenZuteilung
    return {
      sessionKennung: 'karten-session',
      tokens: 0,
      istTot: () => false,
      beenden() {},
      hartStoppen() {},
      blockAusfuehren(block) {
        steuerung.auftraege.set(block.instanzId, block.auftrag)
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
    }
  }
  return {
    async freigeben(instanzId, vorher = null) {
      const bis = Date.now() + 8000
      while (!wartend.has(instanzId) && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      const los = wartend.get(instanzId)
      if (!los) throw new Error('Block nie gestartet: ' + instanzId)
      wartend.delete(instanzId)
      if (vorher) vorher()
      los()
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

describe('BAUPLAN 53 · Volltext für die Arbeit, Verzeichnis für den Rest', () => {
  const projekt = path.join(os.tmpdir(), `flowforge-kartenindex-${process.pid}`)
  let auftraege
  let laufstand
  let zuteilungsErgebnis

  beforeAll(async () => {
    fs.rmSync(projekt, { recursive: true, force: true })
    fs.mkdirSync(projekt, { recursive: true })
    fs.writeFileSync(path.join(projekt, 'karten.json'), JSON.stringify(KARTEN), 'utf8')
    // Drei Späher hintereinander: a teilt zu (das darf im Motor nur eine
    // Auftragsquelle, hier ruft die Prüfung die Annahme-Funktion direkt auf —
    // geprüft wird der RÜCKFALL, nicht das Rederecht), b wird genannt, c nicht.
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({
        reparaturRunden: 0,
        uebertragGrenze: 5,
        bloecke: [
          { instanzId: 'a', blockId: 'spaeher', zusatz: '' },
          { instanzId: 'b', blockId: 'spaeher', zusatz: '' },
          { instanzId: 'c', blockId: 'spaeher', zusatz: '' }
        ],
        pfeile: [
          { von: 'a', nach: 'b' },
          { von: 'b', nach: 'c' }
        ]
      }),
      'utf8'
    )
    const motor = motorErsatz()
    const sicht = fensterErsatz()
    // Die Oberfläche schickt nur die gewählte ARBEIT — Wissen und
    // Entscheidungen legt der Hauptprozess selbst dazu.
    expect(await laufStarten(sicht.fenster, projekt, [aufgabe.id], null, false, null)).toEqual({
      ok: true
    })
    // a läuft: Sein Auftrag ist gebaut, bevor er zuteilt.
    await motor.freigeben('a', () => {
      zuteilungsErgebnis = steuerung.zuteilen({
        instanzId: 'a',
        zuteilung: [{ block: '2', kartenIds: [wissen.id] }]
      })
      laufstand = JSON.parse(fs.readFileSync(path.join(projekt, 'laufstand.json'), 'utf8'))
    })
    await motor.freigeben('b')
    await motor.freigeben('c')
    expect((await sicht.warteAufEnde()).zustand).toBe('erfolgreich')
    auftraege = steuerung.auftraege
  }, 60000)

  it('gibt die gewählte Aufgabe im Volltext und die Status-Karte dazu', () => {
    const auftrag = auftraege.get('a')
    expect(auftrag).toContain(`${kurzKennung(aufgabe.id)} · [`)
    expect(auftrag).toContain(aufgabe.text)
    expect(auftrag).toContain(status.text)
  })

  it('nennt Wissen und Entscheidungen nur im Verzeichnis — Titel ja, Text nein', () => {
    const auftrag = auftraege.get('a')
    expect(auftrag).toContain(entscheidung.titel)
    expect(auftrag).toContain(wissen.titel)
    expect(auftrag).not.toContain(entscheidung.text)
    expect(auftrag).not.toContain(wissen.text)
    expect(auftrag).toContain(kurzKennung(entscheidung.id))
    expect(auftrag).toContain(kurzKennung(wissen.id))
  })

  it('legt Wissen und Entscheidungen trotzdem in die Auswahl-Menge des Laufs', () => {
    // Sonst weist karten_zuteilen sie als „gehört nicht zu diesem Lauf" ab —
    // die Zuteilung unten wäre gar nicht möglich gewesen.
    expect(laufstand.kartenIds).toContain(aufgabe.id)
    expect(laufstand.kartenIds).toContain(entscheidung.id)
    expect(laufstand.kartenIds).toContain(wissen.id)
    expect(zuteilungsErgebnis.ok).toBe(true)
  })

  it('gibt dem zugeteilten Block genau seine Karte im Volltext', () => {
    const auftrag = auftraege.get('b')
    expect(auftrag).toContain(wissen.text)
    // Die Aufgabe stand NICHT in seiner Zuteilung — nur im Verzeichnis.
    expect(auftrag).not.toContain(aufgabe.text)
    expect(auftrag).toContain(aufgabe.titel)
  })

  it('gibt dem übergangenen Block nur die Status-Karte im Volltext', () => {
    const auftrag = auftraege.get('c')
    expect(auftrag).toContain(status.text)
    expect(auftrag).not.toContain(aufgabe.text)
    expect(auftrag).not.toContain(wissen.text)
    // Sehen kann er weiterhin alles — er muss nur selbst nachlesen.
    expect(auftrag).toContain(aufgabe.titel)
    expect(auftrag).toContain(wissen.titel)
  })

  it('merkt sich die Reichweite der Zuteilung im Laufstand', () => {
    // Ohne sie fiele c nach einem App-Neustart wieder auf die gewählten
    // Aufgaben zurück — dieselbe Kette verhielte sich vor und nach der
    // Unterbrechung verschieden.
    expect(laufstand.zuteilungsBereich ?? []).toEqual(expect.arrayContaining(['b', 'c']))
  })
})

// Die drei Fälle einzeln — im ganzen Lauf oben ist nur der häufigste zu sehen.
describe('BAUPLAN 53 · Der Rückfall unterscheidet drei Lagen', () => {
  const aufgaben = ['auf-1', 'auf-2']

  it('zugeteilt heißt zugeteilt — auch eine leere Zuteilung ist eine Aussage', () => {
    expect(
      volltextKarten({
        zugeteilt: ['w-1'],
        imBereich: true,
        istAuftragsquelle: false,
        gewaehlteAufgaben: aufgaben
      })
    ).toEqual(['w-1'])
    expect(
      volltextKarten({
        zugeteilt: [],
        imBereich: true,
        istAuftragsquelle: false,
        gewaehlteAufgaben: aufgaben
      })
    ).toEqual([])
  })

  it('hat nie jemand zugeteilt, gelten die gewählten Aufgaben', () => {
    expect(
      volltextKarten({
        zugeteilt: undefined,
        imBereich: false,
        istAuftragsquelle: false,
        gewaehlteAufgaben: aufgaben
      })
    ).toEqual(aufgaben)
  })

  it('übergangen im Bereich einer Zuteilung heißt: nur die Status-Karte', () => {
    expect(
      volltextKarten({
        zugeteilt: undefined,
        imBereich: true,
        istAuftragsquelle: false,
        gewaehlteAufgaben: aufgaben
      })
    ).toEqual([])
  })

  it('eine Auftragsquelle behält ihre Grundlage, auch im Bereich einer anderen', () => {
    // Der Fall aus der Vorlage „Bug jagen": Die zweite Auftragsquelle ist
    // Nachfahre der ersten. Ohne diese Ausnahme stünde ausgerechnet der Block,
    // der zuteilen soll, mit einer einzigen Karte da — und dasselbe träfe jede
    // Reparatur-Runde der ersten Auftragsquelle.
    expect(
      volltextKarten({
        zugeteilt: undefined,
        imBereich: true,
        istAuftragsquelle: true,
        gewaehlteAufgaben: aufgaben
      })
    ).toEqual(aufgaben)
  })
})

// Nacharbeit nach den Messungen von Prüfer 2 (22.08.2026): Der Schritt sparte
// im Alltag NICHT — das Verzeichnis steht jetzt in jedem Auftrag, und vier
// Aufträge befahlen zusätzlich karten_uebersicht, also dieselbe Liste doppelt.
// Gemessen an 83 echten Karten: 33 Zeilen (40 %) waren Prüfkarten und
// erledigte Aufgaben — 842 Tokens je Block, an denen kein Block arbeitet und
// die karten_zuteilen hart abweist.
describe('BAUPLAN 53 · Das Verzeichnis im Auftrag trägt nur lebende Karten', () => {
  const projekt = path.join(os.tmpdir(), `flowforge-verzeichnis-${process.pid}`)
  let auftrag
  let zuteilungNeueKarte

  beforeAll(async () => {
    fs.rmSync(projekt, { recursive: true, force: true })
    fs.mkdirSync(projekt, { recursive: true })
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({
        reparaturRunden: 0,
        uebertragGrenze: 5,
        bloecke: [
          { instanzId: 'x', blockId: 'spaeher', zusatz: '' },
          { instanzId: 'y', blockId: 'spaeher', zusatz: '' }
        ],
        pfeile: [{ von: 'x', nach: 'y' }]
      }),
      'utf8'
    )
    const motor = motorErsatz()
    const sicht = fensterErsatz()
    expect(await laufStarten(sicht.fenster, projekt, [aufgabe.id], null, false, null)).toEqual({
      ok: true
    })
    await motor.freigeben('x', () => {
      // Eine Karte, die MITTEN IM LAUF entsteht (Spec-Interview, Audit, Chat):
      // Sie steht sofort im Verzeichnis der Auftragsquelle — und wurde bis zur
      // Nacharbeit mit „gehört nicht zu diesem Lauf" abgewiesen, von einer
      // Meldung, die im selben Satz Wissens-Karten als zuteilbar nannte.
      KARTEN.push({
        id: '77777777-0000-4000-8000-000000000007',
        sorte: 'wissen',
        thema: 'Aufbau',
        titel: 'Frisch entstanden',
        text: 'Diese Karte gab es beim Laufstart noch nicht.'
      })
      zuteilungNeueKarte = steuerung.zuteilen({
        instanzId: 'x',
        zuteilung: [{ block: '2', kartenIds: ['77777777'] }]
      })
    })
    await motor.freigeben('y')
    expect((await sicht.warteAufEnde()).zustand).toBe('erfolgreich')
    auftrag = steuerung.auftraege.get('x')
    KARTEN.pop()
  }, 60000)

  it('lässt erledigte Aufgaben und Prüfkarten aus dem Auftrag heraus', () => {
    expect(auftrag).not.toContain(erledigt.titel)
    expect(auftrag).not.toContain(pruefkarte.titel)
    expect(auftrag).not.toContain(erledigt.text)
    expect(auftrag).not.toContain(pruefkarte.text)
  })

  it('zeigt die lebenden Karten weiterhin vollständig', () => {
    expect(auftrag).toContain(entscheidung.titel)
    expect(auftrag).toContain(wissen.titel)
    expect(auftrag).toContain(aufgabe.text)
  })

  it('sagt dem Block, dass er karten_uebersicht dafür NICHT braucht', () => {
    // Sonst holt er dieselbe Liste ein zweites Mal — gemessen 2.092 Tokens
    // Dopplung je Aufruf.
    expect(auftrag).toContain('brauchst dafür karten_uebersicht nicht aufzurufen')
    // Und er erfährt ehrlich, was im Verzeichnis fehlt.
    expect(auftrag).toContain('erledigte Aufgaben und Prüfkarten stehen')
  })

  it('lässt eine mitten im Lauf entstandene Wissens-Karte zuteilen', () => {
    expect(zuteilungNeueKarte.fehler).toBeUndefined()
    expect(zuteilungNeueKarte.ok).toBe(true)
  })
})
