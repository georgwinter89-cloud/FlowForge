// Die zwei Nachschlage-Werkzeuge lokaler Blöcke (0.51.2): Bau, Schema,
// Abweisungen im Werkzeugkörper, Platz im Arbeitsgedächtnis — und die Frage,
// WELCHE Motor-Instanz sie überhaupt bekommt.
//
// Gemessen wird am echten Modul: Die Werkzeug-Körper werden wirklich
// aufgerufen. Netzfrei bleibt das, weil jeder hier geprüfte Weg VOR dem ersten
// fetch entscheidet (leeres Feld, kein Platz mehr).
//
// Rot-vor-Grün (Stand vor diesem Schritt): webWerkzeuge.js gab es nicht;
// starteLaufMotor kannte weder die Option websuche noch einen web-Server, und
// der System-Zusatz für Nachschlage-Werkzeuge hing in der Vorlage am
// Helfer-Server — also gemessen in JEDEM Claude-Block und in KEINEM lokalen.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { z } from 'zod'

// Das Agenten-SDK ist die einzige Attrappe (Muster etikettenLieferschein/
// rollbackWirkbereich): Sie sammelt Werkzeuge und Session-Optionen ein, damit
// die Prüfung die echten Körper aufrufen kann. Schema, Texte und Deckel sind
// echt.
const sdk = vi.hoisted(() => ({ laeufe: [] }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name, beschreibung, schema, handler, optionen) => ({
    name,
    beschreibung,
    schema,
    handler,
    optionen
  }),
  createSdkMcpServer: (aufbau) => aufbau,
  query: (aufruf) => {
    // query({ prompt, options }) — geprüft werden die Session-Optionen.
    sdk.laeufe.push(aufruf.options)
    return {
      async *[Symbol.asyncIterator]() {},
      interrupt: async () => {}
    }
  }
}))

const { webWerkzeugServer } = await import('../src/main/motor/webWerkzeuge.js')
const { WEB_DECKEL } = await import('../src/main/motor/websuche.js')
const { starteLaufMotor } = await import('../src/main/motor/claudeCodeMotor.js')
const { texte } = await import('../src/shared/texte.js')

// Baut den Server und liefert Werkzeuge plus mitgeschriebene Ticker-Zeilen.
async function serverBauen({ luft = null, searxngAdresse = '' } = {}) {
  const ticker = []
  const server = await webWerkzeugServer({
    searxngAdresse,
    aufEreignis: (e) => {
      if (e.art === 'ticker') ticker.push(e.text)
    },
    holeLuft: () => luft
  })
  return {
    server,
    ticker,
    werkzeug: (name) => server.tools.find((t) => t.name === name)
  }
}

describe('0.51.2 · Der Werkzeugkasten „web" baut netzfrei und trägt genau zwei Werkzeuge', () => {
  it('heißt web, hat Hinweistext und genau web_suche + webseite_lesen', async () => {
    const { server } = await serverBauen()
    expect(server.name).toBe('web')
    expect(server.instructions).toBe(texte.agentenWebsuche.anweisungen)
    expect(server.tools.map((t) => t.name)).toEqual(['web_suche', 'webseite_lesen'])
  })

  it('lädt beide Werkzeuge immer mit — die Werkzeugsuche würde den Reflex zerstören', async () => {
    const { server } = await serverBauen()
    for (const werkzeug of server.tools) expect(werkzeug.optionen).toEqual({ alwaysLoad: true })
  })
})

describe('0.51.2 · Das Schema bleibt so lose wie möglich (Fund 12)', () => {
  // Gemessen 20.08.2026: Das SDK wirft .url()/.int()/.min() aus dem
  // JSON-Schema heraus, prüft sie zur Laufzeit aber trotzdem — die Ablehnung
  // kommt dann englisch, der Körper läuft nie und der Ticker bleibt stumm.
  it('web_suche hat genau ein Textfeld mit Beschreibung, keine Einschränkung', async () => {
    const { werkzeug } = await serverBauen()
    const schema = werkzeug('web_suche').schema
    expect(Object.keys(schema)).toEqual(['begriff'])
    const json = z.toJSONSchema(z.object(schema), { io: 'input' })
    expect(json.properties.begriff.type).toBe('string')
    expect(json.properties.begriff.format).toBeUndefined()
    expect(json.properties.begriff.minLength).toBeUndefined()
    expect(json.properties.begriff.maxLength).toBeUndefined()
    expect(json.properties.begriff.description).toBe(texte.agentenWebsuche.begriffParam)
  })

  it('webseite_lesen ebenso — kein .url(), kein Zahlenfeld für den Deckel', async () => {
    const { werkzeug } = await serverBauen()
    const schema = werkzeug('webseite_lesen').schema
    expect(Object.keys(schema)).toEqual(['adresse'])
    const json = z.toJSONSchema(z.object(schema), { io: 'input' })
    expect(json.properties.adresse.type).toBe('string')
    expect(json.properties.adresse.format).toBeUndefined()
    expect(json.properties.adresse.description).toBe(texte.agentenWebsuche.adresseParam)
  })

  it('kein einziges Feld beider Werkzeuge ist eine Zahl', async () => {
    const { server } = await serverBauen()
    for (const werkzeug of server.tools) {
      const json = z.toJSONSchema(z.object(werkzeug.schema), { io: 'input' })
      for (const feld of Object.values(json.properties ?? {})) {
        expect(feld.type).not.toBe('number')
        expect(feld.type).not.toBe('integer')
      }
    }
  })
})

describe('0.51.2 · Leere Eingaben werden im Körper abgewiesen — deutsch und sichtbar', () => {
  it('web_suche ohne Begriff: deutscher Klartext plus eigene Ticker-Zeile', async () => {
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('web_suche').handler({ begriff: '   ' })
    expect(ergebnis.isError).toBe(true)
    expect(ergebnis.content[0].text).toBe(texte.agentenWebsuche.begriffFehlt)
    expect(ergebnis.content[0].text).not.toMatch(/validation|Invalid|MCP error/i)
    expect(ticker).toEqual([texte.ticker.websucheOhneBegriff])
  })

  it('webseite_lesen ohne Adresse: deutscher Klartext plus eigene Ticker-Zeile', async () => {
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('webseite_lesen').handler({ adresse: '' })
    expect(ergebnis.isError).toBe(true)
    expect(ergebnis.content[0].text).toBe(texte.agentenWebsuche.adresseFehlt)
    expect(ergebnis.content[0].text).not.toMatch(/validation|Invalid|MCP error/i)
    expect(ticker).toEqual([texte.ticker.webseiteOhneAdresse])
  })
})

describe('0.51.2 · Kein Platz mehr im Arbeitsgedächtnis (Fund 17)', () => {
  it('gibt statt Seitentext den Klartext zurück und tickert es — ohne Netzabruf', async () => {
    const { werkzeug, ticker } = await serverBauen({ luft: 0 })
    const ergebnis = await werkzeug('webseite_lesen').handler({
      adresse: 'https://www.electronjs.org/docs'
    })
    expect(ergebnis.isError).toBe(true)
    expect(ergebnis.content[0].text).toBe(texte.agentenWebsuche.keinPlatzMehr)
    expect(ticker).toEqual([texte.ticker.webseiteKeinPlatz])
  })

  it('auch bei negativer Restluft — der Wächter zählt über die Schwelle hinaus weiter', async () => {
    const { werkzeug, ticker } = await serverBauen({ luft: -50000 })
    const ergebnis = await werkzeug('webseite_lesen').handler({ adresse: 'https://a.example' })
    expect(ergebnis.content[0].text).toBe(texte.agentenWebsuche.keinPlatzMehr)
    expect(ticker).toEqual([texte.ticker.webseiteKeinPlatz])
  })

  it('ein klemmender Getter blockiert den Abruf nicht — dann gilt der Standard-Deckel', async () => {
    const ticker = []
    const server = await webWerkzeugServer({
      searxngAdresse: '',
      aufEreignis: (e) => ticker.push(e.text),
      holeLuft: () => {
        throw new Error('kaputt')
      }
    })
    const werkzeug = server.tools.find((t) => t.name === 'webseite_lesen')
    // Ohne Adresse steigt der Körper aus, bevor irgendetwas ins Netz geht —
    // geprüft ist damit, dass der Wurf des Getters nicht durchschlägt.
    const ergebnis = await werkzeug.handler({ adresse: '' })
    expect(ergebnis.content[0].text).toBe(texte.agentenWebsuche.adresseFehlt)
  })

  it('der Standard-Deckel je Seite ist absolut, nicht am Kontextfenster skaliert', () => {
    expect(WEB_DECKEL.seiteZeichen).toBe(6000)
    expect(WEB_DECKEL.seiteZeichenMax).toBe(12000)
    expect(WEB_DECKEL.treffer).toBe(6)
  })
})

// ——— Wer bekommt die Werkzeuge? ————————————————————————————————————————————

// Startet den echten starteLaufMotor mit abgefangenem query und liefert die
// Session-Optionen, die die CLI bekommen hätte.
async function motorOptionen(zusatz) {
  const vorher = sdk.laeufe.length
  const motor = starteLaufMotor({
    projektPfad: 'C:\\Projekte\\Beispiel',
    modus: 'api',
    apiSchluessel: 'pruef',
    ausgabenObergrenzeUsd: 0,
    aufEreignis: () => {},
    aufRechteFrage: async () => false,
    aufMenschFrage: async () => null,
    aufKartenVorschlag: async () => null,
    aufLaufVorschlag: () => {},
    aufKartenZuteilung: () => {},
    ...zusatz
  })
  const bis = Date.now() + 10000
  while (sdk.laeufe.length === vorher && Date.now() < bis)
    await new Promise((r) => setTimeout(r, 5))
  motor.beenden?.()
  if (sdk.laeufe.length === vorher) throw new Error('Der Motor hat nie eine Session geöffnet.')
  return sdk.laeufe[vorher]
}

describe('0.51.2 · Nur die Motor-Instanz eines lokalen Blocks bekommt die Websuche', () => {
  let lokal
  let claude
  beforeAll(async () => {
    lokal = await motorOptionen({
      lokal: { adresse: 'http://127.0.0.1:11434', modell: 'flowforge-qwen', kontext: 65536 },
      websuche: { searxngAdresse: '' }
    })
    claude = await motorOptionen({})
  }, 30000)

  it('der lokale Motor hängt den Server „web" ein, der Claude-Motor nicht', () => {
    expect(lokal.mcpServers.web).toBeTruthy()
    expect(lokal.mcpServers.web.tools.map((t) => t.name)).toEqual(['web_suche', 'webseite_lesen'])
    expect(claude.mcpServers.web).toBeUndefined()
  })

  it('der System-Zusatz steht im Block-Agenten des lokalen Motors — und in keinem Claude-Block', () => {
    const zusatz = texte.agentenWebsuche.systemZusatz
    const lokalerText = Object.values(lokal.agents)[0].prompt
    const claudeText = Object.values(claude.agents)[0].prompt
    expect(lokalerText).toContain(zusatz)
    expect(claudeText).not.toContain(zusatz)
  })

  it('der Hinweistext des Servers wird NICHT in den Block-Systemtext kopiert', () => {
    // Gemessen: Die MCP-instructions stehen nur in der Koordinator-Anfrage und
    // kosten den Block heute null — hineinkopiert bürdeten sie ihm ~88 Token auf.
    for (const definition of Object.values(lokal.agents))
      expect(definition.prompt).not.toContain(texte.agentenWebsuche.anweisungen)
  })

  it('bekommt der lokale Motor keine websuche-Option, gilt eben die eingebaute Quelle', async () => {
    // Fund 4: Das lokal-Literal in lauf.js wird von Hand gefüllt. Geht das Feld
    // unterwegs verloren, darf der Block nicht still ohne Werkzeuge dastehen.
    const ohne = await motorOptionen({
      lokal: { adresse: 'http://127.0.0.1:11434', modell: 'flowforge-qwen', kontext: 65536 }
    })
    expect(ohne.mcpServers.web).toBeTruthy()
    expect(Object.values(ohne.agents)[0].prompt).toContain(texte.agentenWebsuche.systemZusatz)
  }, 30000)
})
