// Prüfungen zum Übersetzer (Bauschritt 59) — Anthropic hinein, OpenAI hinaus.
//
// Rot vor Grün: Vor diesem Schritt gab es keinen Übersetzer — ein
// OpenRouter-Modell war für die Claude-CLI schlicht unerreichbar. Diese
// Prüfungen decken die vier gemessenen Fehler des Vorbilds (anthropic-proxy)
// ab, die usage-Ehrlichkeit, an der FlowForges Übertrag hängt, und eine ECHTE
// HTTP-Runde gegen einen Stub-Anbieter — streamend wie am Stück.
import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import { ZEICHEN_JE_TOKEN } from '../src/shared/lokalRegeln.js'
import {
  ANFRAGE_DECKEL_MINDEST,
  SSE_ZEILEN_DECKEL,
  anfrageDeckel,
  anfrageUebersetzen,
  antwortUebersetzer,
  fehlerArt,
  fehlerRumpf,
  ganzeAntwortUebersetzen,
  schemaPutzen,
  sseZeilen,
  stopGrund,
  uebersetzerStarten,
  werkzeugErgebnisFalten
} from '../src/main/motor/uebersetzer.js'

// Alles, was eine Prüfung geöffnet hat, wird wieder geschlossen — ein
// liegengebliebener Server hielte den vitest-Prozess offen.
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

// Ein Stub-Anbieter: nimmt /chat/completions entgegen und antwortet nach
// Drehbuch — dieselbe Schicht, die auch OpenRouter fährt.
function stubStarten(behandeln) {
  return new Promise((fertig) => {
    const server = http.createServer(behandeln)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      aufraeumen.push(
        () =>
          new Promise((zu) => {
            server.closeAllConnections?.()
            server.close(zu)
          })
      )
      fertig({ adresse: `http://127.0.0.1:${port}`, server })
    })
  })
}

async function starten(extra = {}) {
  const stelle = await uebersetzerStarten({ schluessel: 'test-schluessel', modell: 'stealth/ox-alpha', kontext: 200_000, ...extra })
  if (stelle.ok) aufraeumen.push(() => stelle.schliessen())
  return stelle
}

// Eine Anfrage über node:http — dieselbe Schicht wie der Übersetzer selbst.
function anfragen(adresse, pfad, { methode = 'POST', rumpf = '', kopf = {} } = {}) {
  return new Promise((fertig, scheitern) => {
    const url = new URL(pfad, adresse)
    const anfrage = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: methode,
        headers: { 'content-type': 'application/json', ...kopf }
      },
      (antwort) => {
        let text = ''
        antwort.on('data', (s) => (text += s.toString('utf8')))
        antwort.on('end', () => fertig({ status: antwort.statusCode, text, kopf: antwort.headers }))
      }
    )
    anfrage.on('error', scheitern)
    if (rumpf) anfrage.write(rumpf)
    anfrage.end()
  })
}

// Aus einem SSE-Text die Daten-Objekte in Empfangsreihenfolge.
function ereignisseAusText(text) {
  return text
    .split('\n')
    .filter((zeile) => zeile.startsWith('data: '))
    .map((zeile) => JSON.parse(zeile.slice(6)))
}

describe('Bauschritt 59 · Anfrage-Übersetzung', () => {
  it('ersetzt das model-Feld IMMER durch das konfigurierte Modell', () => {
    const raus = anfrageUebersetzen({ model: 'claude-sonnet-4-5', messages: [] }, 'stealth/ox-alpha')
    expect(raus.model).toBe('stealth/ox-alpha')
  })

  it('nimmt system als String', () => {
    const raus = anfrageUebersetzen({ system: 'Du bist ein Bauer.', messages: [] }, 'm')
    expect(raus.messages[0]).toEqual({ role: 'system', content: 'Du bist ein Bauer.' })
  })

  it('nimmt system als Array von Blöcken — und streift cache_control ab', () => {
    const raus = anfrageUebersetzen(
      {
        system: [
          { type: 'text', text: 'Erster Teil.', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'Zweiter Teil.' }
        ],
        messages: []
      },
      'm'
    )
    expect(raus.messages[0]).toEqual({ role: 'system', content: 'Erster Teil.\nZweiter Teil.' })
    expect(JSON.stringify(raus)).not.toContain('cache_control')
  })

  it('streift metadata, thinking und context_management ab', () => {
    const raus = anfrageUebersetzen(
      {
        metadata: { user_id: 'georg' },
        thinking: { type: 'enabled', budget_tokens: 1000 },
        context_management: { edits: [] },
        messages: [{ role: 'user', content: 'Hallo' }]
      },
      'm'
    )
    const text = JSON.stringify(raus)
    expect(text).not.toContain('metadata')
    expect(text).not.toContain('thinking')
    expect(text).not.toContain('context_management')
  })

  it('übersetzt assistant-tool_use in die OpenAI-Form mit arguments als JSON-STRING (Korrektur 1)', () => {
    // Das Vorbild baute { function: { type, id, function: { name, parameters:
    // <Objekt> } } } — verschachtelten Unsinn, den kein Anbieter versteht.
    const raus = anfrageUebersetzen(
      {
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Ich lese die Datei.' },
              { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'a.txt' } }
            ]
          }
        ]
      },
      'm'
    )
    expect(raus.messages[0]).toEqual({
      role: 'assistant',
      content: 'Ich lese die Datei.',
      tool_calls: [
        { id: 'toolu_1', type: 'function', function: { name: 'Read', arguments: '{"file_path":"a.txt"}' } }
      ]
    })
  })

  it('faltet tool_result-Arrays zu Text und stellt sie VOR den Nutzertext (Korrektur 2)', () => {
    const raus = anfrageUebersetzen(
      {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Und weiter?' },
              {
                type: 'tool_result',
                tool_use_id: 'toolu_1',
                content: [
                  { type: 'text', text: 'Zeile eins' },
                  { type: 'text', text: 'Zeile zwei' },
                  { type: 'bild', daten: 'x' }
                ]
              }
            ]
          }
        ]
      },
      'm'
    )
    // tool-Nachrichten antworten auf die vorige assistant-Nachricht — sie
    // müssen vor dem Nutzertext stehen, sonst weist der Anbieter die
    // Historie zurück.
    expect(raus.messages[0].role).toBe('tool')
    expect(raus.messages[0].tool_call_id).toBe('toolu_1')
    expect(raus.messages[0].content).toBe('Zeile eins\nZeile zwei\n' + JSON.stringify({ type: 'bild', daten: 'x' }))
    expect(raus.messages[1]).toEqual({ role: 'user', content: 'Und weiter?' })
  })

  it('nimmt tool_result-Inhalt auch als schlichten String', () => {
    expect(werkzeugErgebnisFalten('fertig')).toBe('fertig')
    expect(werkzeugErgebnisFalten(null)).toBe('')
  })

  it('putzt Werkzeug-Schemata rekursiv: format und $schema weg, const wird enum', () => {
    const geputzt = schemaPutzen({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        adresse: { type: 'string', format: 'uri' },
        art: { const: 'lesen' },
        liste: { type: 'array', items: { type: 'string', format: 'date-time' } },
        wahl: { anyOf: [{ const: 1 }, { type: 'number' }] },
        // Ein Feld, das zufällig „format" heißt, ist KEIN Schlüsselwort.
        format: { type: 'string', format: 'email' }
      }
    })
    expect(geputzt.$schema).toBeUndefined()
    expect(geputzt.properties.adresse).toEqual({ type: 'string' })
    expect(geputzt.properties.art).toEqual({ enum: ['lesen'] })
    expect(geputzt.properties.liste.items).toEqual({ type: 'string' })
    expect(geputzt.properties.wahl.anyOf[0]).toEqual({ enum: [1] })
    expect(geputzt.properties.format).toEqual({ type: 'string' })
  })

  it('bildet tool_choice ab: auto, any→required, tool→function, none', () => {
    const basis = { messages: [] }
    expect(anfrageUebersetzen({ ...basis, tool_choice: { type: 'auto' } }, 'm').tool_choice).toBe('auto')
    expect(anfrageUebersetzen({ ...basis, tool_choice: { type: 'any' } }, 'm').tool_choice).toBe('required')
    expect(anfrageUebersetzen({ ...basis, tool_choice: { type: 'none' } }, 'm').tool_choice).toBe('none')
    expect(anfrageUebersetzen({ ...basis, tool_choice: { type: 'tool', name: 'Read' } }, 'm').tool_choice).toEqual({
      type: 'function',
      function: { name: 'Read' }
    })
    expect(anfrageUebersetzen(basis, 'm').tool_choice).toBeUndefined()
  })

  it('fordert include_usage nur bei stream:true an — daran hängt der Übertrag', () => {
    const streamend = anfrageUebersetzen({ stream: true, messages: [] }, 'm')
    expect(streamend.stream).toBe(true)
    expect(streamend.stream_options).toEqual({ include_usage: true })
    const amStueck = anfrageUebersetzen({ stream: false, messages: [] }, 'm')
    expect(amStueck.stream).toBe(false)
    expect(amStueck.stream_options).toBeUndefined()
  })

  it('reicht max_tokens, temperature und stop_sequences weiter', () => {
    const raus = anfrageUebersetzen(
      { max_tokens: 4096, temperature: 0.2, stop_sequences: ['ENDE'], messages: [] },
      'm'
    )
    expect(raus.max_tokens).toBe(4096)
    expect(raus.temperature).toBe(0.2)
    expect(raus.stop).toEqual(['ENDE'])
  })
})

describe('Bauschritt 59 · Antwort-Übersetzung als Ereignisstrom', () => {
  it('trägt in message_start IMMER usage {0, 0} — das Feld darf nie fehlen', () => {
    const ue = antwortUebersetzer('m')
    const ereignisse = ue.stueck({ choices: [{ delta: { role: 'assistant', content: '' } }] })
    expect(ereignisse[0].type).toBe('message_start')
    expect(ereignisse[0].message.usage).toEqual({ input_tokens: 0, output_tokens: 0 })
    // Genau EINMAL — nicht bei jedem Chunk wieder.
    expect(ue.stueck({ choices: [{ delta: { content: 'Hallo' } }] }).some((e) => e.type === 'message_start')).toBe(false)
  })

  it('übersetzt Text: Block-Index 0, text_delta, sauberer Abschluss', () => {
    const ue = antwortUebersetzer('m')
    const ereignisse = [
      ...ue.stueck({ choices: [{ delta: { content: 'Hal' } }] }),
      ...ue.stueck({ choices: [{ delta: { content: 'lo' } }] }),
      ...ue.stueck({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ...ue.abschluss()
    ]
    expect(ereignisse.map((e) => e.type)).toEqual([
      'message_start',
      'content_block_start',
      'content_block_delta',
      'content_block_delta',
      'content_block_stop',
      'message_delta',
      'message_stop'
    ])
    expect(ereignisse[1].index).toBe(0)
    expect(ereignisse[1].content_block).toEqual({ type: 'text', text: '' })
    expect(ereignisse[2].delta).toEqual({ type: 'text_delta', text: 'Hal' })
    expect(ereignisse[5].delta.stop_reason).toBe('end_turn')
  })

  it('vergibt Indizes selbst: Text 0, Werkzeuge fortlaufend danach (Korrektur 4)', () => {
    // Das Vorbild nahm den OpenAI-tool_call-Index roh — dessen erstes
    // Werkzeug hat Index 0 und kollidierte mit dem Textblock.
    const ue = antwortUebersetzer('m')
    const ereignisse = [
      ...ue.stueck({ choices: [{ delta: { content: 'Ich rufe zwei Werkzeuge.' } }] }),
      ...ue.stueck({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'call_a', function: { name: 'Read', arguments: '{"a":1}' } }]
            }
          }
        ]
      }),
      ...ue.stueck({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 1, id: 'call_b', function: { name: 'Write', arguments: '{"b":2}' } }]
            }
          }
        ]
      }),
      ...ue.abschluss()
    ]
    const starts = ereignisse.filter((e) => e.type === 'content_block_start')
    expect(starts.map((e) => [e.index, e.content_block.type])).toEqual([
      [0, 'text'],
      [1, 'tool_use'],
      [2, 'tool_use']
    ])
    // Der Textblock schließt vor dem ersten Werkzeug; die Werkzeug-Blöcke
    // schließen am Stromende — jedes mit seinem EINEN Argument-Delta direkt
    // vor dem Stop (Befund K1: nie ein Delta nach dem Stop).
    const folge = ereignisse.filter((e) => e.type.startsWith('content_block')).map((e) => `${e.type}:${e.index}`)
    expect(folge).toEqual([
      'content_block_start:0',
      'content_block_delta:0',
      'content_block_stop:0',
      'content_block_start:1',
      'content_block_start:2',
      'content_block_delta:1',
      'content_block_stop:1',
      'content_block_delta:2',
      'content_block_stop:2'
    ])
  })

  it('übersteht verschränkte Argument-Deltas zweier Werkzeuge — kein Delta nach Stop (Befund K1)', () => {
    // Gemessen von Prüfer 1: Bei sofortigem Emittieren traf ein
    // input_json_delta (Position 9) einen Block, der schon content_block_stop
    // (Position 6) bekommen hatte — die CLI dürfte das Stück verwerfen und
    // bekäme verstümmelte Argumente. Deltas in der Reihenfolge 0, 0, 1, 0, 1:
    const ue = antwortUebersetzer('m')
    const alle = [
      ...ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'Read', arguments: '{"a":' } }] } }] }),
      ...ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '1' } }] } }] }),
      ...ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 1, id: 'call_b', function: { name: 'Write', arguments: '{"b":' } }] } }] }),
      ...ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '}' } }] } }] }),
      ...ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 1, function: { arguments: '2}' } }] } }] }),
      ...ue.abschluss()
    ]
    // Beide Blöcke korrekt geöffnet …
    const starts = alle.filter((e) => e.type === 'content_block_start')
    expect(starts.map((e) => [e.index, e.content_block.id])).toEqual([
      [0, 'call_a'],
      [1, 'call_b']
    ])
    // … je Werkzeug GENAU EIN Delta mit den vollständigen Argumenten …
    const deltas = alle.filter((e) => e.type === 'content_block_delta')
    expect(deltas.map((e) => [e.index, e.delta.partial_json])).toEqual([
      [0, '{"a":1}'],
      [1, '{"b":2}']
    ])
    // … und je Index: Delta VOR Stop, nie ein Delta nach dem Stop.
    for (const index of [0, 1]) {
      const positionen = alle
        .map((e, position) => ({ e, position }))
        .filter(({ e }) => e.index === index && e.type.startsWith('content_block'))
      const stop = positionen.findIndex(({ e }) => e.type === 'content_block_stop')
      expect(stop).toBe(positionen.length - 1)
    }
    // Protokollkonforme Klammer außenherum.
    expect(alle[0].type).toBe('message_start')
    expect(alle.at(-2).type).toBe('message_delta')
    expect(alle.at(-1).type).toBe('message_stop')
  })

  it('sammelt stückweise Werkzeug-Argumente (OpenRouter) und gibt sie als EIN Delta vor dem Stop aus', () => {
    const ue = antwortUebersetzer('m')
    ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'Read', arguments: '' } }] } }] })
    // Die Stücke werden gesammelt, nicht sofort emittiert (Befund K1).
    expect(ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"pfad":' } }] } }] })).toEqual([])
    expect(ue.stueck({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a.txt"}' } }] } }] })).toEqual([])
    const schluss = ue.abschluss()
    const deltas = schluss.filter((e) => e.type === 'content_block_delta')
    expect(deltas).toEqual([
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"pfad":"a.txt"}' } }
    ])
    // Das Delta steht unmittelbar VOR dem Stop des Blocks.
    const arten = schluss.map((e) => e.type)
    expect(arten.indexOf('content_block_delta')).toBe(arten.indexOf('content_block_stop') - 1)
  })

  it('nimmt Werkzeug-Argumente auch als EIN einziges Delta (Ollama)', () => {
    const ue = antwortUebersetzer('m')
    ue.stueck({
      choices: [
        { delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'Read', arguments: '{"pfad":"a.txt"}' } }] } }
      ]
    })
    const deltas = ue.abschluss().filter((e) => e.type === 'content_block_delta')
    expect(deltas).toHaveLength(1)
    expect(deltas[0].delta).toEqual({ type: 'input_json_delta', partial_json: '{"pfad":"a.txt"}' })
  })

  it('übersetzt reasoning-Chunks als thinking_delta in einem eigenen Block', () => {
    const ue = antwortUebersetzer('m')
    const ereignisse = [
      ...ue.stueck({ choices: [{ delta: { reasoning: 'Erst denken.' } }] }),
      ...ue.stueck({ choices: [{ delta: { content: 'Dann reden.' } }] }),
      ...ue.abschluss()
    ]
    const starts = ereignisse.filter((e) => e.type === 'content_block_start')
    // Das Denken kam zuerst und bekommt Index 0 — der Text folgt auf 1.
    // Kollidieren kann nichts: Die Indizes werden selbst vergeben.
    expect(starts.map((e) => [e.index, e.content_block.type])).toEqual([
      [0, 'thinking'],
      [1, 'text']
    ])
    const denkDelta = ereignisse.find((e) => e.delta?.type === 'thinking_delta')
    expect(denkDelta.delta.thinking).toBe('Erst denken.')
  })

  it('trägt in message_delta die ECHTEN Zahlen aus dem include_usage-Schlussstück', () => {
    const ue = antwortUebersetzer('m')
    ue.stueck({ choices: [{ delta: { content: 'Hallo' } }] })
    ue.stueck({ choices: [{ delta: {}, finish_reason: 'stop' }] })
    // Das Schlussstück von OpenRouter: usage, aber keine choices mehr.
    ue.stueck({ usage: { prompt_tokens: 1234, completion_tokens: 56 }, choices: [] })
    const delta = ue.abschluss().find((e) => e.type === 'message_delta')
    expect(delta.usage).toEqual({ input_tokens: 1234, output_tokens: 56 })
    expect(ue.stand()).toEqual({ hinein: 1234, heraus: 56 })
  })

  it('meldet ehrlich null statt erfundener 0, wenn kein Anbieter-usage kam', () => {
    const ue = antwortUebersetzer('m')
    ue.stueck({ choices: [{ delta: { content: 'x' } }] })
    expect(ue.stand()).toEqual({ hinein: null, heraus: null })
    // In message_delta steht dann 0 — das Feld selbst darf nie fehlen.
    expect(ue.abschluss().find((e) => e.type === 'message_delta').usage).toEqual({
      input_tokens: 0,
      output_tokens: 0
    })
  })

  it('bildet die stop_reason-Gründe ab — und lässt Werkzeuge über „stop" gewinnen', () => {
    expect(stopGrund('tool_calls')).toBe('tool_use')
    expect(stopGrund('stop')).toBe('end_turn')
    expect(stopGrund('length')).toBe('max_tokens')
    expect(stopGrund('irgendwas')).toBe('end_turn')
    // Ollama meldet auch bei Werkzeug-Rufen finish_reason 'stop' — die CLI
    // führte die Werkzeuge dann nie aus.
    const ue = antwortUebersetzer('m')
    ue.stueck({
      choices: [
        {
          delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'Read', arguments: '{}' } }] },
          finish_reason: 'stop'
        }
      ]
    })
    expect(ue.abschluss().find((e) => e.type === 'message_delta').delta.stop_reason).toBe('tool_use')
  })

  it('liefert auch für einen leeren Strom eine gültige Klammer — und ist danach fertig', () => {
    const ue = antwortUebersetzer('m')
    const ereignisse = ue.abschluss()
    expect(ereignisse.map((e) => e.type)).toEqual(['message_start', 'message_delta', 'message_stop'])
    expect(ue.abschluss()).toEqual([])
    expect(ue.stueck({ choices: [{ delta: { content: 'zu spät' } }] })).toEqual([])
  })
})

describe('Bauschritt 59 · komplette Antwort (stream:false-Rückfall der CLI)', () => {
  it('übersetzt Text, Werkzeuge und usage in ein Anthropic-Message-JSON', () => {
    const anthropic = ganzeAntwortUebersetzen(
      {
        id: 'chatcmpl-abc123',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Ich schreibe jetzt.',
              tool_calls: [{ id: 'call_9', type: 'function', function: { name: 'Write', arguments: '{"x":1}' } }]
            },
            finish_reason: 'tool_calls'
          }
        ],
        usage: { prompt_tokens: 50, completion_tokens: 7 }
      },
      'stealth/ox-alpha'
    )
    expect(anthropic.type).toBe('message')
    expect(anthropic.id).toBe('msg-abc123')
    expect(anthropic.model).toBe('stealth/ox-alpha')
    expect(anthropic.content).toEqual([
      { type: 'text', text: 'Ich schreibe jetzt.' },
      { type: 'tool_use', id: 'call_9', name: 'Write', input: { x: 1 } }
    ])
    expect(anthropic.stop_reason).toBe('tool_use')
    expect(anthropic.usage).toEqual({ input_tokens: 50, output_tokens: 7 })
  })

  it('baut KEINEN Textblock mit leerem Text, wenn nur Werkzeuge gerufen wurden', () => {
    // Das Vorbild schob immer { text: null, type: 'text' } an den Anfang —
    // die CLI stolperte über den Nicht-Text.
    const anthropic = ganzeAntwortUebersetzen(
      {
        choices: [
          {
            message: { role: 'assistant', content: null, tool_calls: [{ id: 'c', function: { name: 'Read', arguments: '{}' } }] },
            finish_reason: 'tool_calls'
          }
        ]
      },
      'm'
    )
    expect(anthropic.content).toHaveLength(1)
    expect(anthropic.content[0].type).toBe('tool_use')
  })

  it('übersteht kaputte Werkzeug-Argumente mit leerer Eingabe statt Absturz', () => {
    const anthropic = ganzeAntwortUebersetzen(
      { choices: [{ message: { tool_calls: [{ id: 'c', function: { name: 'Read', arguments: '{kaputt' } }] } }] },
      'm'
    )
    expect(anthropic.content[0].input).toEqual({})
  })
})

describe('Bauschritt 59 · SSE-Zeilenpuffer nach Zählstellen-Muster', () => {
  it('setzt Zeilen zusammen, egal wie der Strom zerschnitten ist', () => {
    const puffer = sseZeilen()
    const text = 'data: {"a":1}\r\ndata: {"b":2}\n\ndata: [DONE]\n'
    const zeilen = []
    // Byte für Byte — die härteste Zerschneidung, die es gibt.
    for (const byte of Buffer.from(text, 'utf8')) {
      const { zeilen: neue, ueberlauf } = puffer.schub(Buffer.from([byte]))
      expect(ueberlauf).toBe(false)
      zeilen.push(...neue)
    }
    zeilen.push(...puffer.abschluss())
    expect(zeilen).toEqual(['data: {"a":1}', 'data: {"b":2}', 'data: [DONE]'])
  })

  it('meldet eine Zeile über dem Deckel als Überlauf statt sie still zu sammeln', () => {
    const puffer = sseZeilen()
    const { ueberlauf } = puffer.schub(Buffer.alloc(SSE_ZEILEN_DECKEL + 1, 0x61))
    expect(ueberlauf).toBe(true)
  })
})

describe('Bauschritt 59 · Fehlerform und Deckel', () => {
  it('spricht die Anthropic-Fehlerform mit passender Art je Status', () => {
    expect(JSON.parse(fehlerRumpf(401, 'kein Schlüssel'))).toEqual({
      type: 'error',
      error: { type: 'authentication_error', message: 'kein Schlüssel' }
    })
    expect(fehlerArt(400)).toBe('invalid_request_error')
    expect(fehlerArt(413)).toBe('request_too_large')
    expect(fehlerArt(429)).toBe('rate_limit_error')
    expect(fehlerArt(500)).toBe('api_error')
  })

  it('bemisst den Anfrage-Deckel am Kontextfenster, fällt aber nie unter das Mindestmaß', () => {
    expect(anfrageDeckel(0)).toBe(ANFRAGE_DECKEL_MINDEST)
    expect(anfrageDeckel(undefined)).toBe(ANFRAGE_DECKEL_MINDEST)
    expect(anfrageDeckel(200_000)).toBe(ANFRAGE_DECKEL_MINDEST)
    expect(anfrageDeckel(1_000_000)).toBe(20_000_000)
  })
})

describe('Bauschritt 59 · der Übersetzer im Betrieb (echte HTTP-Runde)', () => {
  it('sagt ehrlich Nein ohne Modell oder mit unbrauchbarem Ziel', async () => {
    expect((await uebersetzerStarten({ schluessel: 'x' })).ok).toBe(false)
    expect((await uebersetzerStarten({ schluessel: 'x', modell: 'm', ziel: 'quatsch' })).ok).toBe(false)
    expect((await uebersetzerStarten({ schluessel: 'x', modell: 'm', ziel: 'file:///etc/passwd' })).ok).toBe(false)
  })

  it('bindet nur an 127.0.0.1 und nimmt den Port vom Betriebssystem', async () => {
    const stelle = await starten()
    expect(stelle.ok).toBe(true)
    expect(stelle.adresse).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })

  it('streamt eine Werkzeug-Antwort komplett übersetzt durch — samt Schlüssel, Modell und include_usage', async () => {
    let gesehen = null
    const stub = await stubStarten((anfrage, antwort) => {
      let text = ''
      anfrage.on('data', (s) => (text += s))
      anfrage.on('end', () => {
        gesehen = { pfad: anfrage.url, kopf: anfrage.headers, rumpf: JSON.parse(text) }
        antwort.writeHead(200, { 'content-type': 'text/event-stream' })
        antwort.write('data: {"id":"chatcmpl-1","choices":[{"delta":{"role":"assistant","content":""}}]}\n\n')
        antwort.write(': OPENROUTER PROCESSING\n\n')
        antwort.write('data: {"choices":[{"delta":{"content":"Ich lese."}}]}\n\n')
        antwort.write(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"Read","arguments":""}}]}}]}\n\n'
        )
        antwort.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"pfad\\":"}}]}}]}\n\n')
        antwort.write('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"a.txt\\"}"}}]}}]}\n\n')
        antwort.write('data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n')
        antwort.write('data: {"usage":{"prompt_tokens":123,"completion_tokens":45},"choices":[]}\n\n')
        antwort.write('data: [DONE]\n\n')
        antwort.end()
      })
    })
    const stelle = await starten({ ziel: stub.adresse + '/v1' })
    const antwort = await anfragen(stelle.adresse, '/v1/messages?beta=true', {
      rumpf: JSON.stringify({
        model: 'claude-sonnet-4-5',
        stream: true,
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Lies a.txt' }]
      }),
      kopf: { 'anthropic-version': '2023-06-01', 'x-api-key': 'platzhalter' }
    })

    // Hinweg: richtiger Pfad hinter dem Vorsatz, Bearer-Schlüssel, ersetztes
    // Modell, include_usage — und KEINE anthropic-Kopfzeilen beim Anbieter.
    expect(gesehen.pfad).toBe('/v1/chat/completions')
    expect(gesehen.kopf.authorization).toBe('Bearer test-schluessel')
    expect(gesehen.kopf['anthropic-version']).toBeUndefined()
    expect(gesehen.kopf['x-api-key']).toBeUndefined()
    expect(gesehen.rumpf.model).toBe('stealth/ox-alpha')
    expect(gesehen.rumpf.stream_options).toEqual({ include_usage: true })

    // Rückweg: ein sauberer Anthropic-Ereignisstrom.
    expect(antwort.status).toBe(200)
    expect(antwort.kopf['content-type']).toContain('text/event-stream')
    const ereignisse = ereignisseAusText(antwort.text)
    expect(ereignisse.map((e) => e.type)).toEqual([
      'message_start',
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
      'content_block_start',
      'content_block_delta',
      'content_block_stop',
      'message_delta',
      'message_stop'
    ])
    expect(ereignisse[0].message.usage).toEqual({ input_tokens: 0, output_tokens: 0 })
    expect(ereignisse[1].content_block.type).toBe('text')
    expect(ereignisse[4].content_block).toEqual({ type: 'tool_use', id: 'call_1', name: 'Read', input: {} })
    // Die zwei Anbieter-Stücke kommen gesammelt als EIN Delta vor dem Stop.
    expect(ereignisse[5].delta.partial_json).toBe('{"pfad":"a.txt"}')
    const delta = ereignisse.find((e) => e.type === 'message_delta')
    expect(delta.delta.stop_reason).toBe('tool_use')
    expect(delta.usage).toEqual({ input_tokens: 123, output_tokens: 45 })

    expect(stelle.stand()).toEqual({ anfragen: 1, tokenHinein: 123, tokenHeraus: 45, fehler: 0 })
  })

  it('beantwortet den stream:false-Rückfall mit einem kompletten Anthropic-Message-JSON', async () => {
    const stub = await stubStarten((anfrage, antwort) => {
      anfrage.resume()
      anfrage.on('end', () => {
        antwort.writeHead(200, { 'content-type': 'application/json' })
        antwort.end(
          JSON.stringify({
            id: 'chatcmpl-99',
            choices: [{ message: { role: 'assistant', content: 'Fertig.' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 11, completion_tokens: 3 }
          })
        )
      })
    })
    const stelle = await starten({ ziel: stub.adresse })
    const antwort = await anfragen(stelle.adresse, '/v1/messages', {
      rumpf: JSON.stringify({ model: 'claude-x', stream: false, messages: [{ role: 'user', content: 'Hallo' }] })
    })
    expect(antwort.status).toBe(200)
    const nachricht = JSON.parse(antwort.text)
    expect(nachricht.type).toBe('message')
    expect(nachricht.content).toEqual([{ type: 'text', text: 'Fertig.' }])
    expect(nachricht.stop_reason).toBe('end_turn')
    expect(nachricht.usage).toEqual({ input_tokens: 11, output_tokens: 3 })
    expect(stelle.stand()).toEqual({ anfragen: 1, tokenHinein: 11, tokenHeraus: 3, fehler: 0 })
  })

  it('reicht einen Ziel-Fehler als Anthropic-Fehlerform mit dem Status des Ziels durch', async () => {
    const stub = await stubStarten((anfrage, antwort) => {
      anfrage.resume()
      anfrage.on('end', () => {
        antwort.writeHead(400, { 'content-type': 'application/json' })
        antwort.end(JSON.stringify({ error: { message: 'Modell unbekannt', code: 400 } }))
      })
    })
    const stelle = await starten({ ziel: stub.adresse })
    const antwort = await anfragen(stelle.adresse, '/v1/messages', {
      rumpf: JSON.stringify({ stream: true, messages: [] })
    })
    expect(antwort.status).toBe(400)
    const fehler = JSON.parse(antwort.text)
    expect(fehler.type).toBe('error')
    expect(fehler.error.type).toBe('invalid_request_error')
    expect(fehler.error.message).toContain('Modell unbekannt')
    expect(stelle.stand().fehler).toBe(1)
    expect(stelle.stand().anfragen).toBe(1)
  })

  it('antwortet mit Klartext-502, wenn der Anbieter gar nicht erreichbar ist', async () => {
    // Ein Ziel, das sicher niemand bedient: Port 1 auf dem eigenen Rechner.
    const stelle = await starten({ ziel: 'http://127.0.0.1:1' })
    const antwort = await anfragen(stelle.adresse, '/v1/messages', { rumpf: '{"messages":[]}' })
    expect(antwort.status).toBe(502)
    expect(JSON.parse(antwort.text).error.message).toContain('FlowForge-Übersetzer')
    expect(stelle.stand().fehler).toBe(1)
  })

  it('schätzt count_tokens mit Zeichen ÷ 3,5 statt einen 404 zu riskieren', async () => {
    const stelle = await starten()
    const rumpf = JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(331) }] })
    const antwort = await anfragen(stelle.adresse, '/v1/messages/count_tokens', { rumpf })
    expect(antwort.status).toBe(200)
    expect(JSON.parse(antwort.text)).toEqual({ input_tokens: Math.ceil(rumpf.length / ZEICHEN_JE_TOKEN) })
    // Zählen ist kein Gesprächswechsel.
    expect(stelle.stand().anfragen).toBe(0)
  })

  it('grüßt auf HEAD /api/hello mit 200 — der Gesundheits-Gruß der CLI', async () => {
    const stelle = await starten()
    const antwort = await anfragen(stelle.adresse, '/api/hello', { methode: 'HEAD' })
    expect(antwort.status).toBe(200)
  })

  it('weist unbekannte Pfade in der Anthropic-Fehlerform ab', async () => {
    const stelle = await starten()
    const antwort = await anfragen(stelle.adresse, '/v1/irgendwas', { rumpf: '{}' })
    expect(antwort.status).toBe(404)
    expect(JSON.parse(antwort.text).error.type).toBe('not_found_error')
  })

  it('weist kaputtes JSON mit 400 ab statt es zu raten', async () => {
    const stelle = await starten()
    const antwort = await anfragen(stelle.adresse, '/v1/messages', { rumpf: 'kein json' })
    expect(antwort.status).toBe(400)
    expect(JSON.parse(antwort.text).error.type).toBe('invalid_request_error')
    expect(stelle.stand().fehler).toBe(1)
  })

  it('deckelt den Anfrage-Rumpf hart: 413 statt stillem Abschnitt', async () => {
    const stelle = await starten()
    // Ein Byte über dem Mindest-Deckel (kontext 200.000 hebt ihn nicht an).
    const zuGross = Buffer.alloc(ANFRAGE_DECKEL_MINDEST + 1, 0x61)
    const antwort = await anfragen(stelle.adresse, '/v1/messages', { rumpf: zuGross })
    expect(antwort.status).toBe(413)
    expect(JSON.parse(antwort.text).error.type).toBe('request_too_large')
    expect(stelle.stand().fehler).toBe(1)
  }, 30_000)

  it('schließt einen Anbieter-Strom ohne [DONE] trotzdem sauber ab', async () => {
    const stub = await stubStarten((anfrage, antwort) => {
      anfrage.resume()
      anfrage.on('end', () => {
        antwort.writeHead(200, { 'content-type': 'text/event-stream' })
        antwort.write('data: {"choices":[{"delta":{"content":"halb"}}]}\n\n')
        antwort.end()
      })
    })
    const stelle = await starten({ ziel: stub.adresse })
    const antwort = await anfragen(stelle.adresse, '/v1/messages', {
      rumpf: JSON.stringify({ stream: true, messages: [] })
    })
    const arten = ereignisseAusText(antwort.text).map((e) => e.type)
    expect(arten[arten.length - 1]).toBe('message_stop')
    expect(arten).toContain('message_delta')
  })

  it('übersetzt auch dann, wenn ein Anbieter trotz stream:true am Stück antwortet', async () => {
    const stub = await stubStarten((anfrage, antwort) => {
      anfrage.resume()
      anfrage.on('end', () => {
        antwort.writeHead(200, { 'content-type': 'application/json' })
        antwort.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Am Stück.',
                  tool_calls: [{ id: 'call_x', function: { name: 'Read', arguments: '{"p":1}' } }]
                },
                finish_reason: 'stop'
              }
            ],
            usage: { prompt_tokens: 9, completion_tokens: 2 }
          })
        )
      })
    })
    const stelle = await starten({ ziel: stub.adresse })
    const antwort = await anfragen(stelle.adresse, '/v1/messages', {
      rumpf: JSON.stringify({ stream: true, messages: [] })
    })
    expect(antwort.kopf['content-type']).toContain('text/event-stream')
    const ereignisse = ereignisseAusText(antwort.text)
    expect(ereignisse[0].type).toBe('message_start')
    expect(ereignisse.find((e) => e.content_block?.type === 'tool_use').content_block.id).toBe('call_x')
    expect(ereignisse.find((e) => e.type === 'message_delta').usage).toEqual({ input_tokens: 9, output_tokens: 2 })
    expect(stelle.stand()).toEqual({ anfragen: 1, tokenHinein: 9, tokenHeraus: 2, fehler: 0 })
  })

  it('summiert stand() über mehrere Gesprächswechsel', async () => {
    const stub = await stubStarten((anfrage, antwort) => {
      anfrage.resume()
      anfrage.on('end', () => {
        antwort.writeHead(200, { 'content-type': 'application/json' })
        antwort.end(
          JSON.stringify({
            choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5 }
          })
        )
      })
    })
    const stelle = await starten({ ziel: stub.adresse })
    await anfragen(stelle.adresse, '/v1/messages', { rumpf: '{"messages":[]}' })
    await anfragen(stelle.adresse, '/v1/messages', { rumpf: '{"messages":[]}' })
    expect(stelle.stand()).toEqual({ anfragen: 2, tokenHinein: 20, tokenHeraus: 10, fehler: 0 })
  })

  it('schließt idempotent — zweimal schliessen tut nicht weh', async () => {
    const stelle = await starten()
    stelle.schliessen()
    stelle.schliessen()
    // Nach dem Schließen nimmt niemand mehr ab.
    await expect(anfragen(stelle.adresse, '/v1/messages', { rumpf: '{}' })).rejects.toThrow()
  })
})
