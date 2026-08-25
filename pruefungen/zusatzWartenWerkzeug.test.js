// Prüfungen zum wartenden Prüfer (Bauschritt 58): Das Werkzeug
// auf_zusatzbauer_warten reicht den Fund an die Lauf-Verwaltung durch und gibt
// deren Antwort als Werkzeug-Ergebnis zurück; ohne angeschlossenen
// Warte-Auflöser antwortet es ehrlich statt zu hängen. pruefeWerkzeug gibt es
// nur Prüf-Blöcken frei — auch nur-lesenden — und stoppt alle anderen hart.
// Dazu der neue Fund-Kanal im Prüfbeleg: funde koppeln nie ans Urteil.
//
// Rot vor Grün: Vor dem Bauschritt existierte zusatzWartenWerkzeug.js nicht
// (Import rot), pruefeWerkzeug ließ mcp__zusatz__… in die unbekannte-Werkzeuge-
// Rückfrage laufen (erlaubt undefined, frage gesetzt — statt des harten Nein),
// pruefbelegPruefen warf das Feld funde stumm weg und pruefbelegAusMeldungen
// kannte kein funde-Array. Beim Nachbauen wurde je Erwartung einmal verfälscht
// (z.B. „bestanden mit funde wird abgewiesen") und rot gesehen.
import { describe, it, expect, vi } from 'vitest'

// Das Agenten-SDK ist die einzige Attrappe: Es sammelt nur die Handler ein,
// damit die Prüfung das Werkzeug WIRKLICH aufrufen kann (Muster
// etikettenLieferschein.test.js) — Schema, Prüfung und Antworten sind echt.
const sdk = vi.hoisted(() => ({ werkzeuge: new Map() }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name, beschreibung, schema, handler) => {
    sdk.werkzeuge.set(name, { beschreibung, schema, handler })
    return { name, handler }
  },
  createSdkMcpServer: (aufbau) => aufbau
}))

import { zusatzWartenWerkzeugServer } from '../src/main/motor/zusatzWartenWerkzeug.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import {
  meldungPruefen,
  pruefbelegAusMeldungen,
  SCHWEREN
} from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const projekt = 'D:\\pruefungen-uebungsprojekt'
const WERKZEUG = 'mcp__zusatz__auf_zusatzbauer_warten'
const rahmen = { fazit: 'Geprüft.' }

describe('Bauschritt 58 · das Werkzeug auf_zusatzbauer_warten', () => {
  it('baut den Server „zusatz" mit genau diesem einen Werkzeug', async () => {
    const server = await zusatzWartenWerkzeugServer({
      aufZusatzbauerWarten: async () => ({ text: 'egal' })
    })
    expect(server.name).toBe('zusatz')
    expect(server.tools.map((w) => w.name)).toEqual(['auf_zusatzbauer_warten'])
    // Beschreibungen kommen aus texte.js — der Agent liest genau diese Sätze.
    const gebaut = sdk.werkzeuge.get('auf_zusatzbauer_warten')
    expect(gebaut.beschreibung).toBe(texte.zusatzWarten.werkzeug)
  })

  it('reicht den Fund an den Warte-Auflöser durch und gibt dessen Text zurück', async () => {
    const rufe = []
    const server = await zusatzWartenWerkzeugServer({
      aufZusatzbauerWarten: async (fund) => {
        rufe.push(fund)
        return { text: 'Der Zusatzbauer ist fertig — hier der Bericht.' }
      }
    })
    const antwort = await server.tools[0].handler({
      text: 'Der Umsatz wird doppelt gezählt.',
      fundort: 'src/kasse.js, Zeile 40',
      soll: 'Ein Verkauf erscheint genau einmal in der Summe.',
      schwere: 'hoch'
    })
    expect(rufe).toEqual([
      {
        text: 'Der Umsatz wird doppelt gezählt.',
        fundort: 'src/kasse.js, Zeile 40',
        soll: 'Ein Verkauf erscheint genau einmal in der Summe.',
        schwere: 'hoch'
      }
    ])
    expect(antwort.content).toEqual([
      { type: 'text', text: 'Der Zusatzbauer ist fertig — hier der Bericht.' }
    ])
    expect(antwort.isError).toBeUndefined()
  })

  it('antwortet ehrlich, wenn kein Warte-Auflöser angeschlossen ist', async () => {
    const server = await zusatzWartenWerkzeugServer({})
    const antwort = await server.tools[0].handler({
      text: 'x',
      fundort: 'src/a.js',
      soll: 'y'
    })
    expect(antwort.isError).toBe(true)
    expect(antwort.content[0].text).toBe(texte.zusatzWarten.nichtVerdrahtet)
  })
})

describe('Bauschritt 58 · pruefeWerkzeug: nur Prüf-Blöcke warten', () => {
  it('erlaubt das Warten einem Prüf-Block ohne Rückfrage — auch nur-lesend', () => {
    // Der echte Prüfer ist nurLesen UND darfPruefen: Der Zweig muss VOR der
    // harten nurLesen-Sperre greifen, sonst hieße es „Schreib-Versuch gestoppt".
    expect(pruefeWerkzeug(WERKZEUG, {}, projekt, true, true).erlaubt).toBe(true)
    // Und auch ein (hypothetisch) schreibender Prüf-Block bleibt frei.
    expect(pruefeWerkzeug(WERKZEUG, {}, projekt, false, true).erlaubt).toBe(true)
  })

  it('stoppt jeden Block ohne prueft hart — Klartext statt Rückfrage', () => {
    const bauer = pruefeWerkzeug(WERKZEUG, {}, projekt, false, false)
    expect(bauer.frage).toBeUndefined()
    expect(bauer.gesperrt).toBe(texte.zusatzWarten.nurPruefer)
    expect(bauer.tickerText).toBe(texte.ticker.zusatzWartenGesperrt)
    // Auch ein nur-lesender Nicht-Prüfer (Angreifer) bekommt den ehrlichen
    // Grund, nicht die allgemeine nurLesen-Sperre.
    const angreifer = pruefeWerkzeug(WERKZEUG, {}, projekt, true, false)
    expect(angreifer.gesperrt).toBe(texte.zusatzWarten.nurPruefer)
  })
})

describe('Bauschritt 58 · funde im Prüfbeleg — der Fund-Kanal des Prüfers', () => {
  const fund = {
    text: 'Die Konfigurationsdatei enthält einen toten Schlüssel.',
    schwere: 'niedrig',
    fundort: 'config/app.json',
    soll: 'Der Schlüssel altModus kommt in config/app.json nicht mehr vor.'
  }

  it('nimmt „bestanden" MIT funde an — funde koppeln nie ans Urteil', () => {
    const ergebnis = meldungPruefen('pruefbeleg', {
      ...rahmen,
      urteil: 'bestanden',
      funde: [fund]
    })
    expect(ergebnis.fehler).toBeUndefined()
    expect(ergebnis.meldung.funde).toEqual([
      {
        text: fund.text,
        schwere: 'niedrig',
        fundort: fund.fundort,
        soll: fund.soll
      }
    ])
  })

  it('weist „bestanden" mit Beanstandungen weiterhin ab — die Kopplung bleibt', () => {
    const ergebnis = meldungPruefen('pruefbeleg', {
      ...rahmen,
      urteil: 'bestanden',
      beanstandungen: [{ text: 'kaputt', einstufung: 'mechanisch' }],
      funde: [fund]
    })
    expect(ergebnis.fehler).toBe(texte.lieferschein.bestandenMitBeanstandung)
  })

  it('weist eine unbekannte schwere in funde mit Klartext ab — wie im funde-Teil', () => {
    const ergebnis = meldungPruefen('pruefbeleg', {
      ...rahmen,
      urteil: 'bestanden',
      funde: [{ ...fund, schwere: 'katastrophal' }]
    })
    expect(ergebnis.fehler).toBe(texte.lieferschein.schwereFehlt(SCHWEREN))
  })

  it('überliest Einträge ohne Text und trimmt die Felder — tolerant wie der funde-Teil', () => {
    const ergebnis = meldungPruefen('pruefbeleg', {
      ...rahmen,
      urteil: 'bestanden',
      funde: [{ text: '   ' }, { text: '  Echter Fund.  ', schwere: 'mittel' }]
    })
    expect(ergebnis.fehler).toBeUndefined()
    expect(ergebnis.meldung.funde).toEqual([
      { text: 'Echter Fund.', schwere: 'mittel', fundort: '', soll: '' }
    ])
  })

  it('pruefbelegAusMeldungen liefert die funde normalisiert — leer, wenn die Meldung keine trägt', () => {
    const mitFunden = meldungPruefen('pruefbeleg', {
      ...rahmen,
      urteil: 'bestanden',
      funde: [fund]
    }).meldung
    expect(pruefbelegAusMeldungen([mitFunden]).funde).toEqual([
      { text: fund.text, fundort: fund.fundort, schwere: 'niedrig', soll: fund.soll }
    ])
    // Meldung von vor dem Feld (alter Laufstand): kein funde-Schlüssel.
    const alt = { art: 'pruefbeleg', urteil: 'bestanden', beanstandungen: [] }
    expect(pruefbelegAusMeldungen([alt]).funde).toEqual([])
    // Fremd zusammengebaute Meldung mit unbekannter schwere: Rückfall mittel —
    // dieselbe Toleranz wie angriffsFundeAus (zusatzbauerRegeln.js).
    const fremd = {
      art: 'pruefbeleg',
      urteil: 'bestanden',
      funde: [{ text: ' x ', schwere: 'egal' }]
    }
    expect(pruefbelegAusMeldungen([fremd]).funde).toEqual([
      { text: 'x', fundort: '', schwere: 'mittel', soll: '' }
    ])
  })
})
