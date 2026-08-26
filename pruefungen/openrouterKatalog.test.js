// Prüfungen zum OpenRouter-Modellkatalog (Bauschritt 60): EINE Hauptprozess-
// Quelle für Modellliste und Anzeige-Preise — gemessen mit echten HTTP-Runden
// gegen Stub-Anbieter: einen in OpenRouter-Form (context_length, top_provider,
// pricing-Strings) und einen in Ollama-Form (NUR id/object/created/owned_by —
// gemessen an Ollama 0.32.15 am 26.08.2026).
//
// Rot vor Grün: Vor Bauschritt 60 gab es das Modul nicht — die Einstellungen
// hatten weder Modellliste noch Preise, und ein falsch eingetipptes
// Kontextfenster fiel niemandem auf, bis der Anbieter still kappte.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import {
  KATALOG_TTL_MS,
  katalogHolen,
  katalogZuruecksetzen
} from '../src/main/motor/openrouterKatalog.js'

const aufraeumen = []
afterEach(async () => {
  while (aufraeumen.length) {
    const weg = aufraeumen.pop()
    try {
      await weg()
    } catch {
      // Beim Abräumen wird nichts mehr rot.
    }
  }
})
beforeEach(() => katalogZuruecksetzen())

// Ein Stub-Anbieter, der GET /v1/models nach Drehbuch beantwortet und seine
// Treffer zählt — damit ist der Zwischenspeicher MESSBAR (kein zweiter
// Netzabruf), statt nur behauptet.
function stubStarten(antwortRumpf, { status = 200 } = {}) {
  return new Promise((fertig) => {
    const zaehler = { treffer: 0 }
    const server = http.createServer((anfrage, antwort) => {
      zaehler.treffer++
      zaehler.letzterPfad = anfrage.url
      antwort.writeHead(status, { 'content-type': 'application/json' })
      antwort.end(typeof antwortRumpf === 'string' ? antwortRumpf : JSON.stringify(antwortRumpf))
    })
    server.listen(0, '127.0.0.1', () => {
      aufraeumen.push(
        () =>
          new Promise((zu) => {
            server.closeAllConnections?.()
            server.close(zu)
          })
      )
      fertig({ adresse: `http://127.0.0.1:${server.address().port}/v1`, zaehler })
    })
  })
}

// Die Rohliste in OpenRouter-Form — inklusive der Felder, die NICHT über IPC
// gehen dürfen (description wäre der 687-KB-Ballast der echten Liste).
const OPENROUTER_LISTE = {
  data: [
    {
      id: 'anbieter/gross',
      name: 'Großes Modell',
      description: 'x'.repeat(2000),
      context_length: 1048576,
      top_provider: { context_length: 262144 },
      pricing: { prompt: '0.000008', completion: '0.00002' }
    },
    {
      id: 'anbieter/frei',
      name: 'Freies Modell',
      context_length: 32768,
      pricing: { prompt: '0', completion: '0' }
    },
    {
      id: 'anbieter/luecken',
      // kein name, kein context_length, Preis-Unsinn: alles wird null/id.
      pricing: { prompt: 'kaputt', completion: null }
    },
    { name: 'ohne id — fällt heraus' }
  ]
}

describe('Bauschritt 60 · Katalog eindampfen (OpenRouter-Form)', () => {
  it('liefert je Modell genau die fünf Anzeige-Felder — der Ballast bleibt beim Anbieter', async () => {
    const stub = await stubStarten(OPENROUTER_LISTE)
    const ergebnis = await katalogHolen({ ziel: stub.adresse })
    expect(ergebnis.ok).toBe(true)
    expect(stub.zaehler.letzterPfad).toBe('/v1/models')
    expect(ergebnis.modelle).toHaveLength(3)
    expect(ergebnis.modelle[0]).toEqual({
      id: 'anbieter/gross',
      name: 'Großes Modell',
      // min(context_length, top_provider.context_length): Der Anbieter hinter
      // OpenRouter trägt oft weniger, als das Modell verspricht — und kappt
      // ein zu großes Fenster still (Angriffsfund 20).
      kontext: 262144,
      preisHinein: 0.000008,
      preisHeraus: 0.00002
    })
    // Kein Eintrag trägt mehr als die fünf Felder.
    for (const m of ergebnis.modelle) expect(Object.keys(m).sort()).toEqual(['id', 'kontext', 'name', 'preisHeraus', 'preisHinein'])
  })

  it('ein gemeldeter 0-Preis bleibt eine echte 0 — Preis-Unsinn wird null, nie NaN', async () => {
    const stub = await stubStarten(OPENROUTER_LISTE)
    const { modelle } = await katalogHolen({ ziel: stub.adresse })
    const frei = modelle.find((m) => m.id === 'anbieter/frei')
    expect(frei.preisHinein).toBe(0)
    expect(frei.preisHeraus).toBe(0)
    expect(frei.kontext).toBe(32768)
    const luecken = modelle.find((m) => m.id === 'anbieter/luecken')
    expect(luecken).toEqual({
      id: 'anbieter/luecken',
      name: 'anbieter/luecken',
      kontext: null,
      preisHinein: null,
      preisHeraus: null
    })
  })
})

describe('Bauschritt 60 · Ollama-Prüfstand: Felder fehlen, nichts stirbt (Angriffsfund 17)', () => {
  it('id/object/created/owned_by genügen — Kontext und Preise sind ehrlich null', async () => {
    const stub = await stubStarten({
      data: [
        { id: 'qwen2.5:7b', object: 'model', created: 1787479171, owned_by: 'library' },
        { id: 'flowforge-qwen2.5-7b:latest', object: 'model', created: 1787479171, owned_by: 'library' }
      ]
    })
    const ergebnis = await katalogHolen({ ziel: stub.adresse })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.modelle).toEqual([
      { id: 'qwen2.5:7b', name: 'qwen2.5:7b', kontext: null, preisHinein: null, preisHeraus: null },
      {
        id: 'flowforge-qwen2.5-7b:latest',
        name: 'flowforge-qwen2.5-7b:latest',
        kontext: null,
        preisHinein: null,
        preisHeraus: null
      }
    ])
  })
})

describe('Bauschritt 60 · Zwischenspeicher (TTL, gemessen am Treffer-Zähler)', () => {
  it('der zweite Abruf innerhalb der TTL trifft den Anbieter NICHT', async () => {
    const stub = await stubStarten(OPENROUTER_LISTE)
    await katalogHolen({ ziel: stub.adresse })
    const zweiter = await katalogHolen({ ziel: stub.adresse })
    expect(zweiter.ok).toBe(true)
    expect(stub.zaehler.treffer).toBe(1)
    expect(KATALOG_TTL_MS).toBe(10 * 60 * 1000)
  })

  it('neuLaden erzwingt den frischen Abruf trotz gültigem Zwischenspeicher', async () => {
    const stub = await stubStarten(OPENROUTER_LISTE)
    await katalogHolen({ ziel: stub.adresse })
    await katalogHolen({ ziel: stub.adresse, neuLaden: true })
    expect(stub.zaehler.treffer).toBe(2)
  })

  it('ein anderes Ziel bekommt nie die fremde Liste untergeschoben', async () => {
    const stubA = await stubStarten({ data: [{ id: 'a/eins' }] })
    const stubB = await stubStarten({ data: [{ id: 'b/zwei' }] })
    await katalogHolen({ ziel: stubA.adresse })
    const b = await katalogHolen({ ziel: stubB.adresse })
    expect(b.modelle.map((m) => m.id)).toEqual(['b/zwei'])
    expect(stubB.zaehler.treffer).toBe(1)
  })
})

describe('Bauschritt 60 · Ehrliche Fehler', () => {
  it('Anbieter-Fehlerstatus wird gemeldet, nie eine leere Liste erfunden', async () => {
    const stub = await stubStarten({ error: 'kaputt' }, { status: 503 })
    const ergebnis = await katalogHolen({ ziel: stub.adresse })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehler).toMatch(/503/)
  })

  it('kein Server, kaputtes JSON, Antwort ohne data, leeres Ziel — alles ein ehrliches Nein', async () => {
    expect((await katalogHolen({ ziel: 'http://127.0.0.1:1' })).ok).toBe(false)
    const kaputt = await stubStarten('kein json')
    expect((await katalogHolen({ ziel: kaputt.adresse })).ok).toBe(false)
    const ohneData = await stubStarten({ modelle: [] })
    const ergebnis = await katalogHolen({ ziel: ohneData.adresse })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehler).toMatch(/Modellliste/)
    expect((await katalogHolen({})).ok).toBe(false)
  })

  it('ein Fehler landet nie im Zwischenspeicher — der nächste Abruf versucht es frisch', async () => {
    const stub = await stubStarten({ error: 'kaputt' }, { status: 500 })
    await katalogHolen({ ziel: stub.adresse })
    await katalogHolen({ ziel: stub.adresse })
    expect(stub.zaehler.treffer).toBe(2)
  })
})
