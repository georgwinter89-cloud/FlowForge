// Der Übersetzer (Bauschritt 59): Anthropic hinein, OpenAI hinaus — FlowForges
// Brücke zwischen der Claude-CLI und OpenAI-sprachigen Anbietern (OpenRouter).
//
// Warum es ihn gibt (BAUPLAN Paket 59–60): FlowForge hat nur EINEN Motor, die
// Claude-CLI, und die spricht ausschließlich Anthropic /v1/messages. OpenRouter
// spricht OpenAI /chat/completions — sein eigener Anthropic-Endpunkt trägt nur
// Anthropic-Modelle. Statt eines zweiten Motors gibt es deshalb diesen
// In-Process-Weiterleiter nach dem Muster der Zählstelle (54): nur 127.0.0.1,
// Port vom Betriebssystem (Port 0), je Motor frisch, keine Electron-
// Abhängigkeit — prüfbar gegen einen Stub-Anbieter. Der Schlüssel wohnt NUR
// hier im Hauptprozess, nie in der Umgebung des Motor-Kindprozesses.
//
// Herkunftsvermerk: eigenständige Neuimplementierung. Vorbild der
// Übersetzungs-Idee ist anthropic-proxy (MIT © Max Nowack,
// github.com/maxnowack/anthropic-proxy). Vier gemessene Fehler des Vorbilds
// sind hier absichtlich anders gebaut:
//  1. tool_use in der Historie wird als { id, type: 'function', function:
//     { name, arguments: <JSON-String> } } zurückübersetzt — das Vorbild baut
//     ein verschachteltes Gebilde mit `parameters`-Objekt, das kein Anbieter
//     versteht.
//  2. tool_result-Inhalte kommen von der CLI als ARRAY von Blöcken und werden
//     zu Text gefaltet — das Vorbild reicht das Array roh weiter.
//  3. `system` darf String ODER Array sein — das Vorbild kennt nur das Array.
//  4. Die Block-Indizes der Anthropic-Ereignisse werden hier selbst vergeben —
//     Text und Werkzeuge kollidieren nie auf demselben Index, und Fehler NACH
//     Streambeginn gehen als SSE-error-Ereignis hinaus, nie als 500 in einen
//     offenen Strom.
//
// Die Zählstellen-Lehren gelten wörtlich: zeilenweise lesen mit Deckel über
// Buffer.indexOf (nie quadratisch sammeln — die 232-s-Blockade aus 0.51.2 ist
// die Gegenprobe), Rückstau ehrlich weiterreichen (write → pause/drain).
// Einzige bewusste Ausnahme: Die ANFRAGE muss vollständig gelesen werden,
// bevor sie übersetzt werden kann (JSON) — dafür gibt es den harten
// Größendeckel, bemessen am Kontextfenster. Überschreitung ist ein ehrlicher
// 413, niemals ein stiller Abschnitt.
import http from 'node:http'
import https from 'node:https'
import { pfadOhneAbfrage } from '../../shared/zaehlRegeln.js'
import { ZEICHEN_JE_TOKEN } from '../../shared/lokalRegeln.js'
import { anfragePfad } from './zaehlstelle.js'

// Mindest-Deckel für den Anfrage-Rumpf. Der wirksame Deckel wächst mit dem
// Kontextfenster (20 Bytes je Token sind reichlich Luft über den ~3,5 Zeichen
// je Token), fällt aber nie darunter. JSON.parse großer Rümpfe ist gemessen
// unkritisch (9 ms bei 7,7 MB) — der Deckel schützt den Speicher, nicht die CPU.
export const ANFRAGE_DECKEL_MINDEST = 16 * 1024 * 1024

export function anfrageDeckel(kontext) {
  const fenster = Number(kontext)
  const ausKontext = Number.isFinite(fenster) && fenster > 0 ? fenster * 20 : 0
  return Math.max(ANFRAGE_DECKEL_MINDEST, ausKontext)
}

// Deckel je SSE-Zeile des Anbieters. Anders als bei der Zählstelle darf hier
// KEINE Zeile stillschweigend verworfen werden — jede trägt Nutzdaten. Eine
// Zeile über dem Deckel ist deshalb ein ehrlicher Stromfehler, kein Loch.
export const SSE_ZEILEN_DECKEL = 8 * 1024 * 1024

// ---------------------------------------------------------------------------
// Anfrage-Übersetzung: Anthropic /v1/messages → OpenAI /chat/completions
// ---------------------------------------------------------------------------

// Rekursiver Schema-Putz über input_schema der Werkzeuge. Manche Anbieter
// (bzw. deren strikte Schema-Prüfung) stolpern über `format`, `$schema` und
// `const`. Wichtig: `properties` ist eine Landkarte von NAMEN — ein Feld, das
// zufällig „format" oder „const" heißt, bleibt erhalten; nur die
// Schlüsselwörter in Schema-Position werden behandelt.
export function schemaPutzen(knoten) {
  if (Array.isArray(knoten)) return knoten.map(schemaPutzen)
  if (!knoten || typeof knoten !== 'object') return knoten
  const raus = {}
  for (const [name, wert] of Object.entries(knoten)) {
    if (name === 'format' || name === '$schema') continue
    if (name === 'const') {
      // `const: X` sagen manche Anbieter nichts — `enum: [X]` sagt dasselbe.
      raus.enum = [wert]
      continue
    }
    if (name === 'properties' && wert && typeof wert === 'object' && !Array.isArray(wert)) {
      const felder = {}
      for (const [feldName, feldSchema] of Object.entries(wert)) felder[feldName] = schemaPutzen(feldSchema)
      raus[name] = felder
      continue
    }
    raus[name] = schemaPutzen(wert)
  }
  return raus
}

// tool_result-Inhalt der CLI zu Text falten: Die CLI schickt ein Array von
// Blöcken (meist text), OpenAI erwartet in einer tool-Nachricht schlichten
// Text. Nicht-Text-Blöcke werden als JSON-Text mitgenommen statt verschluckt.
export function werkzeugErgebnisFalten(inhalt) {
  if (typeof inhalt === 'string') return inhalt
  if (!Array.isArray(inhalt)) return inhalt == null ? '' : JSON.stringify(inhalt)
  return inhalt
    .map((block) => (block?.type === 'text' ? String(block.text ?? '') : JSON.stringify(block)))
    .join('\n')
}

// Die Anfrage wird NEU AUFGEBAUT, nicht kopiert und beschnitten: Dadurch sind
// `metadata`, `thinking`, `context_management` und `cache_control` (auch tief
// in system-Blöcken und Nachrichten) von selbst weg — es gibt keine Stelle,
// die sie mitnähme. Das model-Feld wird IMMER durch das konfigurierte Modell
// ersetzt: Die CLI schickt sonst Claude-Alias-Namen, die kein Anbieter kennt.
export function anfrageUebersetzen(rumpf, modell) {
  const nachrichten = []

  // `system` darf String ODER Array von Blöcken sein (Korrektur 3).
  const system = rumpf?.system
  if (typeof system === 'string' && system) {
    nachrichten.push({ role: 'system', content: system })
  } else if (Array.isArray(system)) {
    const text = system
      .map((block) => (typeof block === 'string' ? block : String(block?.text ?? '')))
      .filter(Boolean)
      .join('\n')
    if (text) nachrichten.push({ role: 'system', content: text })
  }

  for (const nachricht of Array.isArray(rumpf?.messages) ? rumpf.messages : []) {
    const rolle = nachricht?.role
    const inhalt = nachricht?.content
    if (typeof inhalt === 'string') {
      if (inhalt) nachrichten.push({ role: rolle, content: inhalt })
      continue
    }
    if (!Array.isArray(inhalt)) continue

    if (rolle === 'assistant') {
      const text = inhalt
        .filter((block) => block?.type === 'text')
        .map((block) => String(block.text ?? ''))
        .join('')
      // Korrektur 1: OpenAI-Form ist { id, type: 'function', function:
      // { name, arguments: <JSON-String> } } — arguments als STRING.
      const werkzeugRufe = inhalt
        .filter((block) => block?.type === 'tool_use')
        .map((block) => ({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) }
        }))
      // thinking-Blöcke der Historie werden nicht zurückübersetzt: OpenAI hat
      // keine Stelle dafür, und der Anbieter braucht sie nicht.
      const neu = { role: 'assistant' }
      if (text) neu.content = text
      if (werkzeugRufe.length > 0) neu.tool_calls = werkzeugRufe
      if (neu.content || neu.tool_calls) nachrichten.push(neu)
      continue
    }

    // user-Nachricht: tool_result-Blöcke werden zu eigenen tool-Nachrichten —
    // ZUERST, denn sie antworten auf die tool_calls der vorigen assistant-
    // Nachricht (OpenAI verlangt diese Reihenfolge). Danach der Text.
    for (const block of inhalt) {
      if (block?.type !== 'tool_result') continue
      nachrichten.push({
        role: 'tool',
        tool_call_id: block.tool_use_id,
        // Korrektur 2: Array von Blöcken zu Text falten.
        content: werkzeugErgebnisFalten(block.content)
      })
    }
    const text = inhalt
      .filter((block) => block?.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('\n')
    const nurErgebnisse = inhalt.every((block) => block?.type === 'tool_result')
    if (text) {
      nachrichten.push({ role: 'user', content: text })
    } else if (!nurErgebnisse && inhalt.length > 0) {
      // Ehrliche Grenze: Bild- und andere Sonderblöcke sind nicht übersetzbar
      // (base64 als Text wäre nur Ballast). Der Zug bleibt aber erhalten,
      // damit die Gesprächsstruktur nicht kippt.
      nachrichten.push({ role: 'user', content: '[Inhalt nicht übersetzbar, z. B. Bild]' })
    }
  }

  const raus = {
    model: String(modell ?? ''),
    messages: nachrichten,
    stream: rumpf?.stream === true
  }
  if (typeof rumpf?.max_tokens === 'number') raus.max_tokens = rumpf.max_tokens
  if (typeof rumpf?.temperature === 'number') raus.temperature = rumpf.temperature
  if (typeof rumpf?.top_p === 'number') raus.top_p = rumpf.top_p
  if (Array.isArray(rumpf?.stop_sequences) && rumpf.stop_sequences.length > 0) raus.stop = rumpf.stop_sequences
  // Nur streamend: das Schlussstück mit den echten Token-Zahlen anfordern.
  // Daran hängt FlowForges Übertrag bei vollem Kontext — ohne include_usage
  // stünde in message_delta eine erfundene Zahl.
  if (raus.stream) raus.stream_options = { include_usage: true }
  // Gemessene Kosten (Bauschritt 60): OpenRouter meldet den echten USD-Betrag
  // je Antwort NUR, wenn die Anfrage dieses Zusatzfeld trägt — streamend im
  // include_usage-Schlussstück als usage.cost, bei stream:false in usage.cost
  // der Antwort. Immer mitschicken, auch stream:false: Eine Basispreis-
  // Rechnung wäre bei Cache-Rabatt und Tageszeit-Staffeln systematisch falsch.
  // Fremde OpenAI-Endpunkte ignorieren das Feld (gemessen am Ollama-Prüfstand
  // 0.32.15, 26.08.2026: Status 200, usage kommt ohne cost — dann bleibt es
  // ehrlich bei „nicht gemessen").
  raus.usage = { include: true }

  const werkzeuge = (Array.isArray(rumpf?.tools) ? rumpf.tools : []).map((werkzeug) => ({
    type: 'function',
    function: {
      name: werkzeug?.name,
      description: werkzeug?.description,
      parameters: schemaPutzen(werkzeug?.input_schema ?? {})
    }
  }))
  if (werkzeuge.length > 0) raus.tools = werkzeuge

  const wahl = rumpf?.tool_choice
  if (wahl?.type === 'auto') raus.tool_choice = 'auto'
  else if (wahl?.type === 'any') raus.tool_choice = 'required'
  else if (wahl?.type === 'none') raus.tool_choice = 'none'
  else if (wahl?.type === 'tool' && wahl?.name) raus.tool_choice = { type: 'function', function: { name: wahl.name } }

  return raus
}

// ---------------------------------------------------------------------------
// Antwort-Übersetzung: OpenAI → Anthropic
// ---------------------------------------------------------------------------

export function stopGrund(finishReason) {
  if (finishReason === 'tool_calls') return 'tool_use'
  if (finishReason === 'length') return 'max_tokens'
  return 'end_turn'
}

function neueKennung() {
  return 'msg_' + Math.random().toString(36).slice(2, 26)
}

// Zustandsbehafteter Übersetzer für den Streaming-Rückweg: nimmt GEPARSTE
// OpenAI-Chunks entgegen und liefert je Aufruf die fälligen Anthropic-
// Ereignisse (als Objekte; serialisiert wird beim Schreiben).
//
// Die Regeln, an denen die CLI hängt (gemessen, Angriffsliste 59):
//  - message_start trägt IMMER usage { input_tokens: 0, output_tokens: 0 } —
//    das Feld darf nie fehlen, der CLI-Accumulator liest es unkonditioniert.
//  - message_delta am Ende trägt usage aus dem include_usage-Schlussstück
//    (input_tokens = prompt_tokens, output_tokens = completion_tokens).
//  - Block-Indizes werden selbst vergeben (Korrektur 4): jeder Block bekommt
//    in der Reihenfolge seines Auftretens die nächste Nummer. Ohne
//    reasoning heißt das Text = 0 und Werkzeuge fortlaufend danach; mit
//    reasoning geht das Denken vor — kollidieren kann nichts.
//  - Werkzeug-Argumente kommen inkrementell (OpenRouter, stückweise) ODER als
//    ein einziges Delta (Ollama): beide Formen laufen über einen Akkumulator
//    je tool_call-Index. Hinaus geht je Werkzeug EIN input_json_delta
//    unmittelbar vor seinem content_block_stop am Stromende (Befund K1,
//    Prüfer 1): Verschränkt ein Anbieter die Deltas zweier Werkzeuge, träfe
//    ein sofort emittiertes Stück sonst einen schon geschlossenen Block —
//    Delta nach Stop ist protokollwidrig. Text-Deltas bleiben sofort, die
//    trägt die Streaming-Anzeige; Werkzeug-Argumente zeigt niemand live an.
export function antwortUebersetzer(modell) {
  let gestartet = false
  let beendet = false
  let naechsterIndex = 0
  let offener = null // { index, art: 'text' | 'denken' } — nur Fließ-Blöcke
  const werkzeuge = new Map() // OpenAI-tool_call-Index → { index, argumente }
  let verbrauch = null
  let endeGrund = null
  const kennung = neueKennung()

  function starten(ereignisse) {
    if (gestartet) return
    gestartet = true
    ereignisse.push({
      type: 'message_start',
      message: {
        id: kennung,
        type: 'message',
        role: 'assistant',
        model: modell,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    })
  }

  function offenenSchliessen(ereignisse) {
    if (!offener) return
    ereignisse.push({ type: 'content_block_stop', index: offener.index })
    offener = null
  }

  // Werkzeug-Blöcke schließen — erst am Stromende, mit den KOMPLETTEN
  // Argumenten als EINEM input_json_delta unmittelbar vor dem Stop. So kann
  // auch ein Anbieter, der die Deltas zweier Werkzeuge verschränkt, keinem
  // schon geschlossenen Block mehr schreiben (Befund K1).
  function werkzeugeSchliessen(ereignisse) {
    for (const platz of werkzeuge.values()) {
      if (platz.argumente) {
        ereignisse.push({
          type: 'content_block_delta',
          index: platz.index,
          delta: { type: 'input_json_delta', partial_json: platz.argumente }
        })
      }
      ereignisse.push({ type: 'content_block_stop', index: platz.index })
    }
  }

  function blockOeffnen(ereignisse, art, block) {
    offenenSchliessen(ereignisse)
    const index = naechsterIndex++
    ereignisse.push({ type: 'content_block_start', index, content_block: block })
    offener = { index, art }
    return index
  }

  return {
    // Ein geparster OpenAI-Chunk hinein, die fälligen Anthropic-Ereignisse
    // heraus.
    stueck(chunk) {
      const ereignisse = []
      if (beendet) return ereignisse
      starten(ereignisse)
      if (chunk?.usage) verbrauch = chunk.usage
      const wahl = chunk?.choices?.[0]
      if (wahl?.finish_reason) endeGrund = wahl.finish_reason
      const delta = wahl?.delta
      if (!delta) return ereignisse

      const denken = typeof delta.reasoning === 'string' ? delta.reasoning : delta.reasoning_content
      if (typeof denken === 'string' && denken !== '') {
        if (offener?.art !== 'denken') blockOeffnen(ereignisse, 'denken', { type: 'thinking', thinking: '' })
        ereignisse.push({
          type: 'content_block_delta',
          index: offener.index,
          delta: { type: 'thinking_delta', thinking: denken }
        })
      }

      if (typeof delta.content === 'string' && delta.content !== '') {
        if (offener?.art !== 'text') blockOeffnen(ereignisse, 'text', { type: 'text', text: '' })
        ereignisse.push({
          type: 'content_block_delta',
          index: offener.index,
          delta: { type: 'text_delta', text: delta.content }
        })
      }

      for (const ruf of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
        const openaiIndex = typeof ruf?.index === 'number' ? ruf.index : 0
        let platz = werkzeuge.get(openaiIndex)
        if (!platz) {
          // Mit dem ersten Werkzeug-Ruf ist ein laufender Text-/Denk-Block zu
          // Ende. Der Werkzeug-Block selbst bleibt bis zum Stromende offen —
          // geschlossen wird er in werkzeugeSchliessen().
          offenenSchliessen(ereignisse)
          const index = naechsterIndex++
          ereignisse.push({
            type: 'content_block_start',
            index,
            content_block: {
              type: 'tool_use',
              id: ruf?.id || `${kennung}_werkzeug_${openaiIndex}`,
              name: ruf?.function?.name ?? '',
              input: {}
            }
          })
          platz = { index, argumente: '' }
          werkzeuge.set(openaiIndex, platz)
        }
        // Befund K1 (Prüfer 1): NICHT sofort emittieren. Verschränkt ein
        // Anbieter die Argument-Deltas zweier Werkzeuge, träfe ein sofortiges
        // input_json_delta einen Block, der schon content_block_stop bekommen
        // hat — Delta nach Stop ist protokollwidrig, die CLI dürfte das Stück
        // verwerfen. Der Akkumulator sammelt; hinaus geht am Stromende je
        // Werkzeug EIN input_json_delta direkt vor seinem Stop.
        const stueckchen = ruf?.function?.arguments
        if (typeof stueckchen === 'string' && stueckchen !== '') platz.argumente += stueckchen
      }

      return ereignisse
    },

    // Strom zu Ende ([DONE] oder Verbindungsende): offene Blöcke schließen,
    // message_delta mit stop_reason und den ECHTEN Zahlen, message_stop.
    // Idempotent — ein zweiter Abschluss liefert nichts mehr.
    abschluss() {
      const ereignisse = []
      if (beendet) return ereignisse
      beendet = true
      // Auch ein leerer Strom ergibt eine gültige Nachricht — die CLI braucht
      // die Klammer aus message_start und message_stop.
      starten(ereignisse)
      offenenSchliessen(ereignisse)
      werkzeugeSchliessen(ereignisse)
      // Ollama meldet auch bei Werkzeug-Rufen gern finish_reason 'stop' —
      // die CLI führte die Werkzeuge dann nie aus. Werkzeuge gewinnen,
      // solange der Anbieter nicht 'length' (abgeschnitten) gemeldet hat.
      let grund = endeGrund
      if (werkzeuge.size > 0 && grund !== 'length') grund = 'tool_calls'
      ereignisse.push({
        type: 'message_delta',
        delta: { stop_reason: stopGrund(grund), stop_sequence: null },
        usage: {
          input_tokens: verbrauch?.prompt_tokens ?? 0,
          output_tokens: verbrauch?.completion_tokens ?? 0
        }
      })
      ereignisse.push({ type: 'message_stop' })
      return ereignisse
    },

    // Für das Zählwerk: null heißt ehrlich „nicht gemeldet", nie erfundene 0.
    // kostenUsd (Bauschritt 60): der vom Anbieter GEMESSENE Betrag aus
    // usage.cost — eine gemeldete 0 ist eine echte Messung („gratis") und
    // bleibt 0; nur ein fehlendes Feld ist null („nicht gemessen").
    stand() {
      return {
        hinein: verbrauch?.prompt_tokens ?? null,
        heraus: verbrauch?.completion_tokens ?? null,
        kostenUsd: typeof verbrauch?.cost === 'number' ? verbrauch.cost : null
      }
    }
  }
}

// Nicht-Streaming-Rückweg (Pflicht: die CLI wiederholt bei Stream-Fehlern mit
// stream:false und erwartet ein komplettes Anthropic-Message-JSON).
export function ganzeAntwortUebersetzen(daten, modell) {
  const wahl = daten?.choices?.[0] ?? {}
  const nachricht = wahl.message ?? {}
  const inhalt = []
  if (typeof nachricht.reasoning === 'string' && nachricht.reasoning) {
    inhalt.push({ type: 'thinking', thinking: nachricht.reasoning, signature: '' })
  }
  // Anders als das Vorbild: KEIN Textblock mit text:null, wenn der Anbieter
  // nur Werkzeuge gerufen hat.
  if (typeof nachricht.content === 'string' && nachricht.content) {
    inhalt.push({ type: 'text', text: nachricht.content })
  }
  for (const ruf of Array.isArray(nachricht.tool_calls) ? nachricht.tool_calls : []) {
    let eingabe = {}
    try {
      eingabe = JSON.parse(ruf?.function?.arguments ?? '{}')
    } catch {
      // Kaputte Argumente sind ein Anbieter-Fehler — leere Eingabe ist
      // ehrlicher als ein geplatzter Rückweg.
      eingabe = {}
    }
    inhalt.push({
      type: 'tool_use',
      id: ruf?.id || neueKennung() + '_werkzeug',
      name: ruf?.function?.name ?? '',
      input: eingabe
    })
  }
  // Dieselbe Ollama-Regel wie im Strom: Werkzeuge gewinnen über 'stop'.
  let grund = wahl.finish_reason ?? null
  if (inhalt.some((block) => block.type === 'tool_use') && grund !== 'length') grund = 'tool_calls'
  return {
    id:
      typeof daten?.id === 'string' && daten.id
        ? daten.id.replace('chatcmpl', 'msg')
        : neueKennung(),
    type: 'message',
    role: 'assistant',
    model: modell,
    content: inhalt,
    stop_reason: stopGrund(grund),
    stop_sequence: null,
    usage: {
      input_tokens: daten?.usage?.prompt_tokens ?? 0,
      output_tokens: daten?.usage?.completion_tokens ?? 0
    }
  }
}

// ---------------------------------------------------------------------------
// SSE-Zeilenpuffer nach Zählstellen-Muster: Buffer.indexOf, nur der Rest
// hinter dem letzten Umbruch wird gehalten. Anders als dort darf keine Zeile
// verlorengehen — Überlauf ist deshalb ein gemeldeter Fehler, kein Loch.
// ---------------------------------------------------------------------------
export function sseZeilen() {
  let rest = null
  function zuText(puffer) {
    const text = puffer.toString('utf8')
    return text.endsWith('\r') ? text.slice(0, -1) : text
  }
  return {
    // → { zeilen: [<string>...], ueberlauf: boolean }
    schub(stueck) {
      const puffer = Buffer.isBuffer(stueck) ? stueck : Buffer.from(String(stueck ?? ''), 'utf8')
      const zeilen = []
      let ab = 0
      while (true) {
        const umbruch = puffer.indexOf(10, ab)
        if (umbruch < 0) break
        const stueckchen = puffer.subarray(ab, umbruch)
        ab = umbruch + 1
        const zeile = rest ? Buffer.concat([rest, stueckchen]) : stueckchen
        rest = null
        if (zeile.length > 0) zeilen.push(zuText(zeile))
      }
      const schwanz = puffer.subarray(ab)
      if (schwanz.length > 0) {
        const neu = rest ? Buffer.concat([rest, schwanz]) : Buffer.from(schwanz)
        if (neu.length > SSE_ZEILEN_DECKEL) {
          rest = null
          return { zeilen, ueberlauf: true }
        }
        rest = neu
      }
      return { zeilen, ueberlauf: false }
    },
    abschluss() {
      const zeile = rest
      rest = null
      return zeile && zeile.length > 0 ? [zuText(zeile)] : []
    }
  }
}

// ---------------------------------------------------------------------------
// Anthropic-Fehlerform — die CLI versteht nur diese Gestalt.
// ---------------------------------------------------------------------------
export function fehlerArt(status) {
  if (status === 400) return 'invalid_request_error'
  if (status === 401) return 'authentication_error'
  if (status === 403) return 'permission_error'
  if (status === 404) return 'not_found_error'
  if (status === 413) return 'request_too_large'
  if (status === 429) return 'rate_limit_error'
  if (status === 529) return 'overloaded_error'
  return 'api_error'
}

export function fehlerRumpf(status, nachricht) {
  return JSON.stringify({ type: 'error', error: { type: fehlerArt(status), message: String(nachricht ?? '') } })
}

function zielZerlegen(adresse) {
  const roh = String(adresse ?? '').trim().replace(/\/+$/, '')
  if (!roh) return null
  let url
  try {
    url = new URL(roh)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return {
    sicher: url.protocol === 'https:',
    rechner: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    // Der Pfad-Vorsatz („https://openrouter.ai/api/v1") bleibt erhalten —
    // /chat/completions wird dahinter angehängt.
    vorsatz: url.pathname.replace(/\/+$/, ''),
    host: url.host
  }
}

// Anfrage-Rumpf vollständig lesen, mit hartem Deckel. Über dem Deckel wird
// nichts mehr gesammelt (nur noch abgetropft, damit die Antwort ankommt).
function rumpfLesen(anfrage, deckel) {
  return new Promise((fertig) => {
    const stuecke = []
    let laenge = 0
    let vorbei = false
    anfrage.on('data', (stueck) => {
      if (vorbei) return
      laenge += stueck.length
      if (laenge > deckel) {
        vorbei = true
        stuecke.length = 0
        fertig({ ok: false, zuGross: true })
        return
      }
      stuecke.push(stueck)
    })
    anfrage.on('end', () => {
      if (vorbei) return
      vorbei = true
      fertig({ ok: true, text: Buffer.concat(stuecke).toString('utf8') })
    })
    anfrage.on('error', () => {
      if (vorbei) return
      vorbei = true
      fertig({ ok: false, zuGross: false })
    })
  })
}

// Eine Anbieter-Antwort vollständig sammeln (Fehlerrümpfe, stream:false) —
// mit demselben Deckel, aus demselben Grund.
function stromSammeln(strom, deckel) {
  return new Promise((fertig) => {
    const stuecke = []
    let laenge = 0
    let vorbei = false
    strom.on('data', (stueck) => {
      if (vorbei) return
      laenge += stueck.length
      if (laenge > deckel) {
        vorbei = true
        strom.destroy()
        fertig({ ok: false, zuGross: true })
        return
      }
      stuecke.push(stueck)
    })
    strom.on('end', () => {
      if (vorbei) return
      vorbei = true
      fertig({ ok: true, text: Buffer.concat(stuecke).toString('utf8') })
    })
    strom.on('error', () => {
      if (vorbei) return
      vorbei = true
      fertig({ ok: false, zuGross: false })
    })
  })
}

function ereignisText(ereignisse) {
  let text = ''
  for (const ereignis of ereignisse) text += `event: ${ereignis.type}\ndata: ${JSON.stringify(ereignis)}\n\n`
  return text
}

// Fehler NACH Streambeginn: als SSE-error-Ereignis, nie als 500 in den
// offenen Strom (Korrektur 4).
function sseFehlerText(nachricht) {
  return ereignisText([{ type: 'error', error: { type: 'api_error', message: String(nachricht ?? '') } }])
}

// ---------------------------------------------------------------------------
// Der Server: startet je Motor frisch, nimmt Anthropic an, spricht OpenAI.
//
// Rückgabe:
//   { ok: true, adresse: 'http://127.0.0.1:<port>', stand(), schliessen() }
//   { ok: false, fehler: '<text>' }
// stand() → { anfragen, tokenHinein, tokenHeraus, fehler } (kumulierte
// Lauf-Summen); schliessen() ist idempotent.
// ---------------------------------------------------------------------------
export async function uebersetzerStarten({
  schluessel,
  modell,
  kontext,
  ziel = 'https://openrouter.ai/api/v1'
} = {}) {
  if (typeof modell !== 'string' || !modell.trim()) return { ok: false, fehler: 'kein Modell' }
  const z = zielZerlegen(ziel)
  if (!z) return { ok: false, fehler: 'Ziel-Adresse unbrauchbar' }

  const treiber = z.sicher ? https : http
  // Dauerverbindungen wie in der Zählstelle: jeder Turn ist eine neue Anfrage,
  // ein frischer TLS-Aufbau je Turn wäre unnötige Wartezeit.
  const pool = new treiber.Agent({ keepAlive: true, maxSockets: 16 })
  const deckel = anfrageDeckel(kontext)

  // kostenUsd (Bauschritt 60): Summe der vom Anbieter GEMELDETEN usage.cost-
  // Beträge — null, solange keiner kam (nie erfundene 0; eine gemeldete 0 ist
  // eine echte Messung und macht aus null eine 0).
  const gesamt = { anfragen: 0, tokenHinein: 0, tokenHeraus: 0, fehler: 0, kostenUsd: null }
  function kostenBuchen(betrag) {
    if (typeof betrag !== 'number' || !Number.isFinite(betrag)) return
    gesamt.kostenUsd = (gesamt.kostenUsd ?? 0) + betrag
  }
  // Lebensbeginn der Instanz — Werkstatt-Laufzeit. Ein blockBeginnt-Pendant
  // wie bei der Zählstelle gibt es bewusst NICHT (Angriffsfund 16): Je
  // OpenRouter-Block-ANLAUF baut der Motor einen frischen Motor samt frischem
  // Übersetzer (lauf.js) — die Instanz-Summen SIND also schon das
  // Block-Fenster, ein zweites Fenster wäre dieselbe Zahl mit zweitem Namen.
  const beginn = Date.now()
  // Die gerade LAUFENDEN Anfragen (Muster Zählstelle, Angriffsfund 13): Ohne
  // sie bucht buchen() erst am Stromende, und die Werkstatt stünde während
  // eines minutenlangen Gesprächswechsels auf 0 und sähe tot aus.
  const laufend = new Set()

  const server = http.createServer()
  // Wartezeiten wie in der Zählstelle begründet: Ein Turn darf Minuten dauern
  // (requestTimeout/timeout 0); keepAliveTimeout deutlich über der Vorgabe des
  // Clients, damit immer der Client die Verbindung schließt.
  server.requestTimeout = 0
  server.timeout = 0
  server.keepAliveTimeout = 60_000
  server.headersTimeout = 65_000

  function jsonAntwort(antwort, status, rumpf, extraKopf) {
    antwort.writeHead(status, { 'content-type': 'application/json', ...extraKopf })
    antwort.end(rumpf)
  }

  async function nachrichtBehandeln(anfrage, antwort) {
    const gelesen = await rumpfLesen(anfrage, deckel)
    if (!gelesen.ok) {
      gesamt.fehler++
      if (gelesen.zuGross) {
        // Ehrlicher 413 statt stillem Abschnitt. connection: close, damit die
        // halb gesendete Anfrage nicht auf einer Dauerverbindung weiterlebt.
        jsonAntwort(
          antwort,
          413,
          fehlerRumpf(413, `FlowForge-Übersetzer: Anfrage größer als der Deckel (${deckel} Bytes)`),
          { connection: 'close' }
        )
      } else {
        antwort.destroy()
      }
      return
    }

    let rumpf
    try {
      rumpf = JSON.parse(gelesen.text)
    } catch {
      gesamt.fehler++
      jsonAntwort(antwort, 400, fehlerRumpf(400, 'FlowForge-Übersetzer: Anfrage ist kein JSON'))
      return
    }

    // Zählweise wie in der Zählstelle: `anfragen` sind ABGESCHLOSSENE
    // Gesprächswechsel, die laufenden stehen getrennt in offeneAnfragen —
    // sonst zeigte die Werkstatt „1 (+1 läuft)" für eine einzige Anfrage.
    // holeStand wird im Streaming-Zweig auf den laufenden antwortUebersetzer
    // gelegt; bis dahin gibt es ehrlich keinen Zwischenstand.
    const platz = { holeStand: () => null }
    laufend.add(platz)
    let abgeschlossen = false
    function anfrageAbschliessen() {
      if (abgeschlossen) return
      abgeschlossen = true
      // Aus der Liste heraus, BEVOR gebucht wird — sonst zählte dieselbe
      // Antwort einen Augenblick doppelt (als Zwischenstand und als Summe).
      laufend.delete(platz)
      gesamt.anfragen++
    }
    const openaiRumpf = anfrageUebersetzen(rumpf, modell)
    const streamend = openaiRumpf.stream === true
    const rumpfBytes = Buffer.from(JSON.stringify(openaiRumpf), 'utf8')

    // Kopfzeilen werden FRISCH gebaut — `anthropic-*`-Kopfzeilen (Version,
    // Beta-Schalter, x-api-key) erreichen den Anbieter nie. accept-encoding
    // identity, weil die Antwort hier gelesen, nicht durchgereicht wird.
    const kopf = {
      'content-type': 'application/json',
      'content-length': rumpfBytes.length,
      accept: 'application/json, text/event-stream',
      'accept-encoding': 'identity',
      host: z.host
    }
    if (typeof schluessel === 'string' && schluessel) kopf.authorization = `Bearer ${schluessel}`

    let stromLaeuft = false

    const hinaus = treiber.request(
      {
        agent: pool,
        protocol: z.sicher ? 'https:' : 'http:',
        host: z.rechner,
        port: z.port,
        method: 'POST',
        path: z.vorsatz + '/chat/completions',
        headers: kopf
      },
      (herein) => {
        herein.socket?.setNoDelay?.(true)
        const status = herein.statusCode ?? 502

        if (status !== 200) {
          // Fehler vom Ziel VOR Antwortbeginn: Anthropic-Fehlerform mit dem
          // Status des Ziels; das Fehler-JSON von OpenRouter wird, soweit
          // lesbar, durchgereicht statt verschluckt.
          gesamt.fehler++
          stromSammeln(herein, deckel).then((ergebnis) => {
            const roh = ergebnis.ok ? ergebnis.text : ''
            let nachricht = `Anbieter antwortete ${status}`
            const auszug = roh.slice(0, 2000)
            try {
              const geparst = JSON.parse(roh)
              const kern = geparst?.error?.message ?? geparst?.error
              nachricht += ': ' + (typeof kern === 'string' ? kern : auszug)
            } catch {
              if (auszug) nachricht += ': ' + auszug
            }
            jsonAntwort(antwort, status, fehlerRumpf(status, nachricht))
          })
          return
        }

        const inhaltsArt = String(herein.headers['content-type'] ?? '')

        if (!streamend || !inhaltsArt.includes('text/event-stream')) {
          // Komplette Antwort (stream:false — oder ein Anbieter, der trotz
          // stream:true am Stück antwortet): sammeln, übersetzen, antworten.
          stromSammeln(herein, deckel).then((ergebnis) => {
            if (!ergebnis.ok) {
              gesamt.fehler++
              jsonAntwort(antwort, 502, fehlerRumpf(502, 'FlowForge-Übersetzer: Anbieter-Antwort unlesbar oder über dem Deckel'))
              return
            }
            let daten
            try {
              daten = JSON.parse(ergebnis.text)
            } catch {
              gesamt.fehler++
              jsonAntwort(antwort, 502, fehlerRumpf(502, 'FlowForge-Übersetzer: Anbieter-Antwort ist kein JSON: ' + ergebnis.text.slice(0, 2000)))
              return
            }
            if (daten?.error) {
              // Mancher Anbieter meldet Fehler mit Status 200 im Rumpf.
              gesamt.fehler++
              const kern = daten.error?.message ?? JSON.stringify(daten.error).slice(0, 2000)
              jsonAntwort(antwort, 502, fehlerRumpf(502, 'Anbieter meldet: ' + kern))
              return
            }
            anfrageAbschliessen()
            gesamt.tokenHinein += daten?.usage?.prompt_tokens ?? 0
            gesamt.tokenHeraus += daten?.usage?.completion_tokens ?? 0
            // usage.cost (Bauschritt 60): nur ein ECHT gemeldeter Betrag wird
            // gebucht — fehlt er (Ollama-Prüfstand), bleibt kostenUsd null.
            kostenBuchen(daten?.usage?.cost)

            if (!streamend) {
              jsonAntwort(antwort, 200, JSON.stringify(ganzeAntwortUebersetzen(daten, modell)))
              return
            }
            // stream:true angefragt, aber JSON am Stück bekommen: die ganze
            // Antwort als EIN synthetischer Chunk durch den Strom-Übersetzer —
            // die CLI sieht einen normalen, nur kurzen Ereignisstrom.
            const wahl = daten?.choices?.[0] ?? {}
            const nachricht = wahl.message ?? {}
            const ue = antwortUebersetzer(modell)
            const synthetisch = {
              usage: daten?.usage,
              choices: [
                {
                  finish_reason: wahl.finish_reason,
                  delta: {
                    content: typeof nachricht.content === 'string' ? nachricht.content : undefined,
                    reasoning: typeof nachricht.reasoning === 'string' ? nachricht.reasoning : undefined,
                    tool_calls: Array.isArray(nachricht.tool_calls)
                      ? nachricht.tool_calls.map((ruf, index) => ({
                          index,
                          id: ruf?.id,
                          function: { name: ruf?.function?.name, arguments: ruf?.function?.arguments }
                        }))
                      : undefined
                  }
                }
              ]
            }
            antwort.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
            antwort.end(ereignisText(ue.stueck(synthetisch).concat(ue.abschluss())))
          })
          return
        }

        // Streaming-Rückweg: Zeile für Zeile lesen, ereignisweise übersetzen,
        // mit Rückstau schreiben.
        stromLaeuft = true
        antwort.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
        const zeilen = sseZeilen()
        const ue = antwortUebersetzer(modell)
        // Zwischenstand für die Werkstatt (Angriffsfund 13): Solange der Strom
        // läuft, liefert der laufende antwortUebersetzer, was er schon weiß.
        platz.holeStand = () => ue.stand()
        let zuEnde = false
        let gebucht = false

        function buchen() {
          if (gebucht) return
          gebucht = true
          anfrageAbschliessen()
          const stand = ue.stand()
          gesamt.tokenHinein += stand.hinein ?? 0
          gesamt.tokenHeraus += stand.heraus ?? 0
          kostenBuchen(stand.kostenUsd)
        }

        function zeilenVerarbeiten(neueZeilen) {
          let text = ''
          for (const zeile of neueZeilen) {
            if (zuEnde) break
            // Kommentar-Zeilen („: OPENROUTER PROCESSING") und Leerzeilen
            // tragen nichts — nur data:-Zeilen zählen.
            if (!zeile.startsWith('data:')) continue
            const daten = zeile.slice(5).trim()
            if (daten === '[DONE]') {
              text += ereignisText(ue.abschluss())
              zuEnde = true
              break
            }
            let geparst
            try {
              geparst = JSON.parse(daten)
            } catch {
              // Eine kaputte Daten-Zeile reißt nicht den Strom — halbe Zeilen
              // kann es nicht geben (es wird zeilenweise gelesen), also ist
              // das ein Anbieter-Schluckauf, der übersprungen wird.
              continue
            }
            if (geparst?.error) {
              gesamt.fehler++
              const kern = geparst.error?.message ?? JSON.stringify(geparst.error).slice(0, 2000)
              text += sseFehlerText('Anbieter meldet: ' + kern)
              zuEnde = true
              break
            }
            text += ereignisText(ue.stueck(geparst))
          }
          return text
        }

        herein.on('data', (stueck) => {
          if (zuEnde) return
          const { zeilen: neueZeilen, ueberlauf } = zeilen.schub(stueck)
          let text = zeilenVerarbeiten(neueZeilen)
          if (ueberlauf && !zuEnde) {
            gesamt.fehler++
            text += sseFehlerText(`FlowForge-Übersetzer: Antwortzeile über dem Deckel (${SSE_ZEILEN_DECKEL} Bytes)`)
            zuEnde = true
          }
          if (text && !antwort.write(text)) {
            herein.pause()
            antwort.once('drain', () => herein.resume())
          }
          if (zuEnde) {
            buchen()
            antwort.end()
            herein.destroy()
          }
        })
        herein.on('end', () => {
          if (zuEnde) return
          // Strom ohne [DONE] (mancher Anbieter beendet einfach): Restzeile
          // verarbeiten und ehrlich abschließen — die CLI braucht die Klammer.
          let text = zeilenVerarbeiten(zeilen.abschluss())
          if (!zuEnde) text += ereignisText(ue.abschluss())
          zuEnde = true
          buchen()
          antwort.end(text)
        })
        herein.on('error', () => {
          if (zuEnde) return
          zuEnde = true
          gesamt.fehler++
          buchen()
          antwort.end(sseFehlerText('FlowForge-Übersetzer: Verbindung zum Anbieter abgerissen'))
        })
        herein.on('aborted', () => herein.emit('error', new Error('abgerissen')))
      }
    )

    hinaus.on('error', (fehler) => {
      gesamt.fehler++
      const nachricht = 'FlowForge-Übersetzer: ' + String(fehler?.message ?? fehler)
      if (stromLaeuft) {
        // Nach Streambeginn: SSE-error-Ereignis statt kaputtem Status.
        try {
          antwort.end(sseFehlerText(nachricht))
        } catch {
          antwort.destroy()
        }
        return
      }
      if (antwort.headersSent) {
        antwort.destroy()
        return
      }
      jsonAntwort(antwort, 502, fehlerRumpf(502, nachricht))
    })

    // Bricht der Client ab (Übertrag, harter Stopp), stirbt auch die Anfrage
    // an den Anbieter — sonst liefe dort eine Antwort weiter, die niemand
    // mehr abholt (und bei OpenRouter kostete sie Geld). `close` feuert auch
    // beim normalen Ende — der letzte gemeinsame Punkt, an dem jede Anfrage
    // sicher aus der Laufend-Liste kommt (Fehlerpfade eingeschlossen).
    antwort.on('close', () => {
      anfrageAbschliessen()
      if (!antwort.writableEnded) hinaus.destroy()
    })

    anfrage.socket?.setNoDelay?.(true)
    hinaus.end(rumpfBytes)
  }

  server.on('request', (anfrage, antwort) => {
    anfrage.socket?.setNoDelay?.(true)
    const pfad = pfadOhneAbfrage(anfragePfad(anfrage.url))

    // Der Gesundheits-Gruß der CLI — 200 genügt.
    if (pfad === '/api/hello' && (anfrage.method === 'HEAD' || anfrage.method === 'GET')) {
      anfrage.resume()
      antwort.writeHead(200, { 'content-type': 'application/json' })
      antwort.end(anfrage.method === 'GET' ? '{}' : undefined)
      return
    }

    if (pfad === '/v1/messages/count_tokens' && anfrage.method === 'POST') {
      // Zeichen-Schätzung statt 404: Der Anbieter hat keinen Zähl-Endpunkt,
      // und die CLI braucht nur eine Größenordnung. Dieselbe Regel wie
      // FlowForges eigene Schätzung: Zeichen ÷ 3,5.
      rumpfLesen(anfrage, deckel).then((gelesen) => {
        if (!gelesen.ok) {
          gesamt.fehler++
          jsonAntwort(antwort, 413, fehlerRumpf(413, 'FlowForge-Übersetzer: Anfrage über dem Deckel'), {
            connection: 'close'
          })
          return
        }
        const tokens = Math.max(1, Math.ceil(gelesen.text.length / ZEICHEN_JE_TOKEN))
        jsonAntwort(antwort, 200, JSON.stringify({ input_tokens: tokens }))
      })
      return
    }

    if (pfad === '/v1/messages' && anfrage.method === 'POST') {
      nachrichtBehandeln(anfrage, antwort)
      return
    }

    anfrage.resume()
    jsonAntwort(antwort, 404, fehlerRumpf(404, `FlowForge-Übersetzer: unbekannter Pfad ${anfrage.method} ${pfad}`))
  })

  const gebunden = await new Promise((fertig) => {
    server.once('error', (fehler) => fertig({ ok: false, fehler: String(fehler?.message ?? fehler) }))
    // NUR 127.0.0.1 und Port 0: keine Erreichbarkeit von außen, keine feste
    // Nummer, die belegt sein könnte.
    server.listen(0, '127.0.0.1', () => fertig({ ok: true }))
  })
  if (!gebunden.ok) {
    try {
      server.close()
    } catch {
      // Ein Server, der nicht binden konnte, muss auch nicht schließen.
    }
    pool.destroy()
    return { ok: false, fehler: gebunden.fehler }
  }

  const port = server.address()?.port
  if (!port) {
    server.close()
    pool.destroy()
    return { ok: false, fehler: 'kein Port' }
  }

  let offen = true
  return {
    ok: true,
    adresse: `http://127.0.0.1:${port}`,
    stand() {
      // Zwischenstände der GERADE laufenden Anfragen dazurechnen (Muster
      // Zählstelle): Die usage-Zahlen einer Antwort sind ihr kumulierter
      // Stand — bei laufenden Strömen meist noch null (include_usage kommt
      // erst im Schlussstück), aber offeneAnfragen sagt der Werkstatt schon
      // jetzt „hier arbeitet etwas".
      let laufendHinein = 0
      let laufendHeraus = 0
      for (const platz of laufend) {
        const s = platz.holeStand()
        if (!s) continue
        laufendHinein += s.hinein ?? 0
        laufendHeraus += s.heraus ?? 0
      }
      return {
        anfragen: gesamt.anfragen,
        tokenHinein: gesamt.tokenHinein + laufendHinein,
        tokenHeraus: gesamt.tokenHeraus + laufendHeraus,
        fehler: gesamt.fehler,
        // Gemessene Kosten (Bauschritt 60): Summe der gemeldeten usage.cost;
        // null = im ganzen Fenster kam nie ein Betrag („nicht gemessen").
        kostenUsd: gesamt.kostenUsd,
        offeneAnfragen: laufend.size,
        beginn,
        dauerMs: Date.now() - beginn,
        // Das EFFEKTIVE Ziel (inklusive einer Prüfstands-Umleitung) — die
        // Werkstatt zeigt es, statt es aus der Umgebung zu erraten.
        ziel: String(ziel)
      }
    },
    schliessen() {
      if (!offen) return
      offen = false
      try {
        server.closeAllConnections?.()
        server.close()
      } catch {
        // Ein Übersetzer, der beim Abbauen klemmt, darf keinen Lauf aufhalten.
      }
      pool.destroy()
    }
  }
}
