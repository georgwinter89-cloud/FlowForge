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
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
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
const { starteLaufMotor, pruefeWerkzeug } = await import('../src/main/motor/claudeCodeMotor.js')
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

// ——— Nacharbeit B: was Georg im Ticker liest ————————————————————————————————

// Netzfrei wie der Rest der Datei: eine fetch-Attrappe führt durch DENSELBEN
// Modulkörper. Die Prüfer haben mit eigenen Servern auf 127.0.0.1 gemessen und
// dafür die searxngAdresse als Ausnahme missbraucht; die Abruf-Prüfungen hier
// laufen gegen literale Adressen aus dem Dokumentationsbereich 203.0.113.x,
// für die adressePruefen gar nicht erst im Namensdienst nachschlägt.
const echtesFetch = globalThis.fetch

function fetchAttrappe(antworten) {
  const rufe = []
  globalThis.fetch = async (adresse, optionen) => {
    rufe.push({ adresse: String(adresse), optionen })
    const naechste =
      typeof antworten === 'function' ? antworten(String(adresse), rufe.length) : antworten.shift()
    return typeof naechste === 'function' ? naechste() : naechste
  }
  return rufe
}

afterEach(() => {
  globalThis.fetch = echtesFetch
})

const w = texte.agentenWebsuche
const seite = (inhalt, status = 200, art = 'text/html') =>
  new Response(inhalt, { status, headers: { 'content-type': art } })

// ROT VOR GRÜN, gemessen 21.08.2026: Die Quelldateien dieser Nacharbeit wurden
// weggenommen (git stash über src/) und genau diese Prüfdatei gegen die alte
// Fassung gefahren. Ergebnis: 19 der 26 neuen Prüfungen rot. Grün waren nur
// die sieben Gegenproben, die vorher wie nachher halten müssen — der
// Rückfalltext ohne Grund bleibt der alte Sammelsatz, eine normale Seite bleibt
// „Webseite gelesen", mit reichlich Luft bleibt die Suche unverändert, „Write"
// bleibt ein Schreib-Versuch, WebSearch/WebFetch ohne die Sperre bleiben eine
// Rückfrage, und die zwei Nachschlage-Werkzeuge bleiben erlaubt.
describe('Nacharbeit B · Der Ticker nennt den echten Grund (Befund 1)', () => {
  // Nachstellweg des Prüfers: ein Server, der jede /schleife-Adresse auf die
  // nächste weiterleitet. Gemessen stand im Ticker „erlaubt sind nur
  // öffentliche Seiten im Internet (http/https), nicht dieser Rechner und
  // nicht das eigene Netz", während der Agent daneben korrekt „zu viele
  // Weiterleitungen hintereinander" las — auch bei httpbin.org, also bei einer
  // glasklar öffentlichen https-Adresse. Über lauf.js landet diese Zeile
  // dauerhaft im Laufbericht.
  it('Weiterleitungsschleife: Ticker und Werkzeug-Text tragen denselben Grund', async () => {
    fetchAttrappe(
      (adresse, nummer) =>
        new Response('', {
          status: 302,
          headers: { location: 'http://203.0.113.5/schleife' + nummer }
        })
    )
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('webseite_lesen').handler({
      adresse: 'http://203.0.113.5/schleife'
    })
    expect(ergebnis.isError).toBe(true)
    expect(ergebnis.content[0].text).toContain(w.grund.spruenge)
    expect(ticker).toHaveLength(1)
    expect(ticker[0]).toContain(w.grund.spruenge)
    expect(ticker[0]).not.toContain('eigene Netz')
  })

  it('unlesbare Weiterleitungsadresse: derselbe Grund in beiden Zeilen', async () => {
    fetchAttrappe([new Response('', { status: 302, headers: { location: 'http://[::1' } })])
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('webseite_lesen').handler({
      adresse: 'http://203.0.113.6/weiter'
    })
    expect(ergebnis.content[0].text).toContain(w.grund.unlesbar)
    expect(ticker[0]).toContain(w.grund.unlesbar)
    expect(ticker[0]).not.toContain('eigene Netz')
  })

  // Keine reine Gegenprobe: Vorher stand der Netz-Grund NUR im Text an den
  // Agenten und im Ticker als fest verdrahteter Sammelsatz. Jetzt tragen beide
  // denselben kurzen Grund — für den Heimnetz-Fall wird die Aussage dadurch
  // nicht anders, aber sie kommt aus derselben Quelle (gemessen rot am alten
  // Stand, weil der Ticker den Grund-Wortlaut noch nicht enthielt).
  it('eine echte Heimnetz-Adresse trägt weiterhin den Netz-Grund', async () => {
    const rufe = fetchAttrappe([])
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('webseite_lesen').handler({ adresse: 'http://10.0.0.1/' })
    expect(rufe).toHaveLength(0)
    expect(ergebnis.content[0].text).toContain(w.grund.privat)
    expect(ticker[0]).toContain(w.grund.privat)
  })

  it('GEGENPROBE: ohne mitgelieferten Grund bleibt der alte Sammelsatz stehen', () => {
    expect(texte.ticker.webseiteAbgelehnt('http://a.example')).toContain('das eigene Netz')
  })

  it('auch der Grund einer nicht erreichbaren Seite steht im Ticker', async () => {
    fetchAttrappe([
      () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'CERT_HAS_EXPIRED' } })
      }
    ])
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('webseite_lesen').handler({
      adresse: 'https://203.0.113.7/seite'
    })
    expect(ergebnis.content[0].text).toContain(w.grund.zertifikatAbgelaufen)
    expect(ticker[0]).toContain(w.grund.zertifikatAbgelaufen)
  })
})

describe('Nacharbeit B · HTTP-Fehlerseiten und leere Seiten im Ticker (Befund 10)', () => {
  // Gemessen 20.08.2026: Bei einem 404 stand im Ticker „Webseite gelesen".
  // Nach der Nacharbeit A liest der Agent korrekt „Der Server hat den Fehler
  // 404 gemeldet", die Ticker-Zeile fiel aber in den Rückfall „Nicht
  // erreichbar" — erreichbar war die Seite ja gerade.
  for (const code of [404, 403, 410, 500, 503]) {
    it('Status ' + code + ': die Ticker-Zeile nennt den Code, nicht „gelesen"', async () => {
      fetchAttrappe([seite('<html><body><p>Weg.</p></body></html>', code)])
      const { werkzeug, ticker } = await serverBauen()
      const ergebnis = await werkzeug('webseite_lesen').handler({
        adresse: 'http://203.0.113.8/seite'
      })
      expect(ergebnis.isError).toBe(true)
      expect(ticker).toHaveLength(1)
      expect(ticker[0]).toContain(String(code))
      expect(ticker[0]).not.toContain('Webseite gelesen')
      expect(ticker[0]).not.toContain('Nicht erreichbar')
    })
  }

  it('429 bekommt die eigene Drossel-Zeile — das ist kein „gibt es nicht"', async () => {
    fetchAttrappe([seite('<html><body><p>Später.</p></body></html>', 429)])
    const { werkzeug, ticker } = await serverBauen()
    await werkzeug('webseite_lesen').handler({ adresse: 'http://203.0.113.8/seite' })
    expect(ticker[0]).toBe(texte.ticker.webseiteGedrosselt('http://203.0.113.8/seite', 429))
    expect(ticker[0]).toContain('drosselt')
  })

  it('eine Seite ohne lesbaren Text bekommt eine eigene Zeile statt „(0 Zeichen)"', async () => {
    fetchAttrappe([seite('<html><body><div id="app"></div><script>los()</script></body></html>')])
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('webseite_lesen').handler({
      adresse: 'http://203.0.113.9/app'
    })
    expect(ergebnis.isError).toBe(true)
    expect(ticker[0]).toBe(texte.ticker.webseiteLeer('http://203.0.113.9/app'))
    expect(ticker[0]).not.toContain('Webseite gelesen')
  })

  it('GEGENPROBE: eine ganz normale Seite meldet weiter „Webseite gelesen"', async () => {
    fetchAttrappe([seite('<html><title>Da</title><body><p>Echter Text.</p></body></html>')])
    const { werkzeug, ticker } = await serverBauen()
    const ergebnis = await werkzeug('webseite_lesen').handler({
      adresse: 'http://203.0.113.10/gut'
    })
    expect(ergebnis.isError).toBeUndefined()
    expect(ticker[0]).toContain('Webseite gelesen')
  })
})

// Gespielte SearXNG-Instanz: Sie geht bewusst an der Drossel der eingebauten
// Quelle vorbei (Georgs eigene Instanz braucht keinen Schutz vor Georgs
// eigenen Blöcken) — deshalb laufen diese Prüfungen ohne die 2,5-s-Pause.
const SEARX = 'http://203.0.113.20:8080'
function searxAntwort(anzahl = 6, kurztextLaenge = 200) {
  const results = Array.from({ length: anzahl }, (_, i) => ({
    title: 'Treffer ' + (i + 1) + ' ' + 'T'.repeat(50),
    url: 'https://beispiel.example/seite' + i,
    content: 'K'.repeat(kurztextLaenge)
  }))
  return new Response(JSON.stringify({ results }), {
    headers: { 'content-type': 'application/json' }
  })
}

describe('Nacharbeit B · web_suche kennt den Lokal-Wächter (Befund 12)', () => {
  // Gemessen 20.08.2026 (Prüfer, über den echten MCP-Weg): web_suche lieferte
  // bei Restluft 6000, 100, 0, -1 und -99999 identisch 2.501 Zeichen, isError
  // false und dieselbe Ticker-Zeile — vollkommen unempfindlich. webseite_lesen
  // verhielt sich am SELBEN Getter korrekt. Zehn Suchen ohne Luft schoben
  // 25.010 Zeichen = 7.146 Token nach, Faktor 24 gegenüber webseite_lesen.
  for (const luft of [0, -1, -99999]) {
    it('ohne Restluft (' + luft + ') gibt es Klartext statt Treffer — und keine Abfrage', async () => {
      const rufe = fetchAttrappe(() => searxAntwort())
      const { werkzeug, ticker } = await serverBauen({ luft, searxngAdresse: SEARX })
      const ergebnis = await werkzeug('web_suche').handler({ begriff: 'electron version' })
      expect(rufe).toHaveLength(0)
      expect(ergebnis.isError).toBe(true)
      expect(ergebnis.content[0].text).toBe(w.keinPlatzMehr)
      expect(ticker).toEqual([texte.ticker.websucheKeinPlatz])
    })
  }

  it('die Leckrate ist null: zehn Suchen ohne Luft kosten keine 25.010 Zeichen mehr', async () => {
    const rufe = fetchAttrappe(() => searxAntwort())
    const { werkzeug } = await serverBauen({ luft: -99999, searxngAdresse: SEARX })
    let zeichen = 0
    for (let i = 0; i < 10; i++)
      zeichen += (await werkzeug('web_suche').handler({ begriff: 'zod 4' })).content[0].text.length
    expect(rufe).toHaveLength(0)
    expect(zeichen).toBe(10 * w.keinPlatzMehr.length)
    expect(zeichen).toBeLessThan(2000)
  })

  it('bei knapper Luft wird die Trefferliste gedeckelt — nie länger als die Restluft', async () => {
    for (const luft of [4000, 2000, 1200, 800, 500, 300]) {
      const rufe = fetchAttrappe(() => searxAntwort())
      const { werkzeug, ticker } = await serverBauen({ luft, searxngAdresse: SEARX })
      const ergebnis = await werkzeug('web_suche').handler({ begriff: 'electron' })
      expect(rufe, String(luft)).toHaveLength(1)
      expect(ergebnis.content[0].text.length, String(luft)).toBeLessThanOrEqual(luft)
      // Der Ticker zählt, was wirklich beim Block ankommt — keine geschönte 6.
      const gezaehlt = (ergebnis.content[0].text.match(/beispiel\.example\/seite/g) ?? []).length
      if (gezaehlt) expect(ticker[0], String(luft)).toContain(gezaehlt + ' Treffer')
    }
  })

  it('reicht es nicht einmal für einen Treffer, sagt FlowForge das ehrlich', async () => {
    // 200 Zeichen tragen zwar den Rahmen der Trefferliste, aber keinen
    // einzigen Treffer — hier ist die Abfrage schon gelaufen (gemessen
    // 21.08.2026: 1 Abruf, 106 Zeichen Klartext statt 1.967 Zeichen Treffer).
    const rufe = fetchAttrappe(() => searxAntwort())
    const { werkzeug, ticker } = await serverBauen({ luft: 200, searxngAdresse: SEARX })
    const ergebnis = await werkzeug('web_suche').handler({ begriff: 'electron' })
    expect(rufe).toHaveLength(1)
    expect(ergebnis.isError).toBe(true)
    expect(ergebnis.content[0].text).toBe(w.keinPlatzMehr)
    expect(ticker).toEqual([texte.ticker.websucheKeinPlatz])
  })

  it('unter dem Rahmen der Trefferliste wird gar nicht erst gefragt', async () => {
    // Der Rahmen (Fremdtext-Hinweis + „Zum Weiterlesen …") kostet konstant 148
    // Zeichen. Wer weniger Luft hat, kann selbst eine leere Liste nicht mehr
    // aufnehmen — dann belastet FlowForge die Quelle nicht mit einer Abfrage,
    // deren Ergebnis ohnehin nirgendwo hinpasst (die eingebaute sperrt bei
    // Häufung).
    for (const luft of [148, 60, 1]) {
      const rufe = fetchAttrappe(() => searxAntwort())
      const { werkzeug, ticker } = await serverBauen({ luft, searxngAdresse: SEARX })
      const ergebnis = await werkzeug('web_suche').handler({ begriff: 'electron' })
      expect(rufe, String(luft)).toHaveLength(0)
      expect(ergebnis.content[0].text, String(luft)).toBe(w.keinPlatzMehr)
      expect(ticker, String(luft)).toEqual([texte.ticker.websucheKeinPlatz])
    }
  })

  it('GEGENPROBE: mit reichlich Luft (und ohne Getter) bleibt alles wie vorher', async () => {
    for (const luft of [null, 100000]) {
      fetchAttrappe(() => searxAntwort())
      const { werkzeug, ticker } = await serverBauen({ luft, searxngAdresse: SEARX })
      const ergebnis = await werkzeug('web_suche').handler({ begriff: 'electron' })
      expect(ergebnis.isError).toBeUndefined()
      expect((ergebnis.content[0].text.match(/beispiel\.example\/seite/g) ?? []).length).toBe(
        WEB_DECKEL.treffer
      )
      expect(ticker[0]).toBe(
        texte.ticker.websucheTreffer(WEB_DECKEL.treffer, texte.ticker.websucheQuelleEigene(SEARX))
      )
    }
  })
})

describe('Nacharbeit B · WebSearch/WebFetch sind kein Schreib-Versuch (Befund 7)', () => {
  // Nachstellweg des Prüfers: pruefeWerkzeug('WebSearch', { query: 'x' },
  // 'D:/p', true). Gemessen 20.08.2026 lautete die Ticker-Zeile
  // „Schreib-Versuch gestoppt — dieser Block darf nur lesen", während der Text
  // an den Agenten seit 0.51.2 ehrlich von „freien Internetzugriffen" spricht.
  // Die Einstufung selbst bleibt unverändert — daran hängt der Regressionsanker
  // des Prüfers.
  for (const [name, eingabe] of [
    ['WebSearch', { query: 'x' }],
    ['WebFetch', { url: 'https://a.de' }]
  ]) {
    it(name + ' unter „darf nur lesen": gesperrt bleibt gesperrt, die Zeile wird wahr', () => {
      const urteil = pruefeWerkzeug(name, eingabe, 'D:/p', true)
      expect(urteil.gesperrt).toBe(texte.rechteFrage.nurLesenGesperrtFuerAgent)
      expect(urteil.tickerText).toBe(texte.ticker.nurLesenInternetGesperrt)
      expect(urteil.tickerText).not.toContain('Schreib-Versuch')
    })

    it(name + ' ohne die Sperre bleibt eine Rückfrage — die Einstufung ändert sich nicht', () => {
      const urteil = pruefeWerkzeug(name, eingabe, 'D:/p', false)
      expect(urteil.frage).toBeTruthy()
      expect(urteil.gesperrt).toBeUndefined()
    })
  }

  it('GEGENPROBE: ein echter Schreib-Versuch heißt weiter Schreib-Versuch', () => {
    const urteil = pruefeWerkzeug('Write', { file_path: 'D:/p/a.js' }, 'D:/p', true)
    expect(urteil.tickerText).toBe(texte.ticker.nurLesenGesperrt)
  })

  it('GEGENPROBE: die zwei Nachschlage-Werkzeuge lokaler Blöcke bleiben erlaubt', () => {
    for (const name of ['mcp__web__web_suche', 'mcp__web__webseite_lesen'])
      expect(pruefeWerkzeug(name, {}, 'D:/p', true)).toEqual({ erlaubt: true })
  })
})
