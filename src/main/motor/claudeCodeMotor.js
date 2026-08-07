// Erster Motor (SPEC §2): die offizielle Claude-Code-CLI, headless im Hintergrund.
// Das Agent-SDK bringt eine eigene claude.exe mit — fester, absoluter Pfad, kein
// Shell-Aufruf, kein aufblitzendes Konsolenfenster (Windows-Härtung laut BAUPLAN).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { texte } from '../../shared/texte.js'
import { KONTEXT_FENSTER_STANDARD, kontextBand } from './schnittstelle.js'

const laden = createRequire(import.meta.url)

function claudeExePfad() {
  const roh = laden.resolve('@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe')
  // Im installierten Zustand liegt die exe neben dem asar-Archiv im „unpacked"-Ordner.
  return roh.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
}

// Werkzeuge, die nur lesen oder rein intern arbeiten — laut SPEC §7 ohne Rückfrage.
const OHNE_RUECKFRAGE = new Set([
  'Read',
  'Glob',
  'Grep',
  'TodoWrite',
  'Task',
  'BashOutput',
  'KillShell',
  'ExitPlanMode',
  'NotebookRead'
])

const SCHREIB_WERKZEUGE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

function liegtImProjekt(datei, projektPfad) {
  if (!datei) return false
  // Windows vergleicht Pfade ohne Groß/Klein-Unterscheidung.
  const wurzel = path.resolve(projektPfad).toLowerCase()
  const ziel = path.resolve(projektPfad, String(datei)).toLowerCase()
  const relativ = path.relative(wurzel, ziel)
  return relativ === '' || (!relativ.startsWith('..') && !path.isAbsolute(relativ))
}

// Rechte-Durchsetzung (SPEC §7): entscheidet pro Werkzeugaufruf, ob er ohne
// Rückfrage laufen darf oder Georg gefragt werden muss. Alles Unbekannte fragt.
function pruefeWerkzeug(name, eingabe, projektPfad) {
  if (OHNE_RUECKFRAGE.has(name)) return { erlaubt: true }
  if (SCHREIB_WERKZEUGE.has(name)) {
    const datei = eingabe.file_path ?? eingabe.notebook_path
    if (liegtImProjekt(datei, projektPfad)) return { erlaubt: true }
    return { frage: texte.rechteFrage.schreibenAusserhalb(String(datei ?? '?')) }
  }
  if (name === 'Bash' || name === 'PowerShell')
    return { frage: texte.rechteFrage.befehl(String(eingabe.command ?? '?')) }
  if (name === 'WebFetch' || name === 'WebSearch')
    return { frage: texte.rechteFrage.internet(String(eingabe.url ?? eingabe.query ?? '?')) }
  return { frage: texte.rechteFrage.unbekanntesWerkzeug(name) }
}

function kurzerPfad(datei, projektPfad) {
  if (!datei) return '?'
  const voll = path.resolve(projektPfad, String(datei))
  return liegtImProjekt(datei, projektPfad) ? path.relative(projektPfad, voll) || '.' : voll
}

function kuerzen(text, max = 160) {
  const einzeilig = String(text).replace(/\s+/g, ' ').trim()
  return einzeilig.length > max ? einzeilig.slice(0, max) + ' …' : einzeilig
}

// Übersetzt eine SDK-Nachricht in Klartext-Zeilen für den Liveticker.
function tickerZeilen(nachricht, projektPfad) {
  const t = texte.ticker
  if (nachricht.type === 'system' && nachricht.subtype === 'init')
    return [t.motorGestartet(nachricht.model ?? 'Claude')]
  if (nachricht.type !== 'assistant') return []
  const zeilen = []
  for (const block of nachricht.message?.content ?? []) {
    if (block.type === 'text' && block.text?.trim()) zeilen.push(block.text.trim())
    if (block.type !== 'tool_use') continue
    const e = block.input ?? {}
    switch (block.name) {
      case 'Write':
        zeilen.push(t.schreibtDatei(kurzerPfad(e.file_path, projektPfad)))
        break
      case 'Edit':
      case 'MultiEdit':
      case 'NotebookEdit':
        zeilen.push(t.aendertDatei(kurzerPfad(e.file_path ?? e.notebook_path, projektPfad)))
        break
      case 'Read':
        zeilen.push(t.liestDatei(kurzerPfad(e.file_path, projektPfad)))
        break
      case 'Glob':
      case 'Grep':
        zeilen.push(t.durchsucht)
        break
      case 'TodoWrite':
        zeilen.push(t.plant)
        break
      case 'Task':
        zeilen.push(t.unteraufgabe)
        break
      case 'Bash':
      case 'PowerShell':
        zeilen.push(t.befehl(kuerzen(e.command ?? '')))
        break
      case 'WebFetch':
      case 'WebSearch':
        zeilen.push(t.internet(kuerzen(e.url ?? e.query ?? '')))
        break
      default:
        zeilen.push(t.werkzeug(block.name))
    }
  }
  return zeilen
}

function fehlertextAusErgebnis(ergebnis, stderrRest) {
  const teile = []
  // Bei is_error steckt die eigentliche Meldung im result-Text.
  if (ergebnis?.is_error && typeof ergebnis.result === 'string' && ergebnis.result)
    teile.push(ergebnis.result)
  if (Array.isArray(ergebnis?.errors)) teile.push(...ergebnis.errors.map(String))
  if (!teile.length && ergebnis?.subtype && ergebnis.subtype !== 'success')
    teile.push(ergebnis.subtype)
  if (!teile.length && stderrRest) teile.push(kuerzen(stderrRest, 400))
  const text = teile.join(' · ')
  if (/log ?in|logged|authent|api key|credentials/i.test(text))
    return texte.lauf.motorNichtAngemeldet
  if (/budget/i.test(text)) return texte.lauf.obergrenzeErreicht
  return text || texte.fehler.unbekannt
}

export function starteMotorLauf(optionen) {
  const {
    projektPfad,
    auftrag,
    modus,
    apiSchluessel,
    ausgabenObergrenzeUsd,
    aufEreignis,
    aufRechteFrage
  } = optionen

  let kindProzess = null
  let sanftAngefordert = false
  let hartAngefordert = false
  let stderrPuffer = ''
  let abfrage = null
  const abbruch = new AbortController()

  // Die Eingabe bleibt offen, bis das Ergebnis da ist — sonst könnte der Motor
  // keine Unterbrechung (sanfter Stopp) mehr über die Steuerleitung empfangen.
  let eingabeSchliessen
  const eingabeOffen = new Promise((r) => (eingabeSchliessen = r))
  async function* eingabe() {
    yield { type: 'user', message: { role: 'user', content: auftrag }, parent_tool_use_id: null }
    await eingabeOffen
  }

  const verbrauch = {
    tokens: 0,
    kontextProzentVon: 0,
    kontextProzentBis: 5,
    kostenUsd: null,
    kontextFenster: KONTEXT_FENSTER_STANDARD
  }

  function verbrauchMelden() {
    const band = kontextBand(verbrauch.tokens, verbrauch.kontextFenster)
    verbrauch.kontextProzentVon = band.von
    verbrauch.kontextProzentBis = band.bis
    aufEreignis({ art: 'verbrauch', verbrauch: { ...verbrauch } })
  }

  const fertig = (async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    // Saubere Umgebung: Alle ANTHROPIC_*/CLAUDE*-Variablen fliegen raus — sie
    // könnten Anmeldung oder Verhalten des Motors umleiten (z.B. wenn FlowForge
    // selbst aus einer Claude-Code-Session heraus gestartet wurde). Im Abo-Modus
    // meldet sich der Motor dann über Georgs gespeichertes Claude-Login an.
    const umgebung = {}
    for (const [name, wert] of Object.entries(process.env)) {
      if (name.toUpperCase().startsWith('ANTHROPIC') || name.toUpperCase().startsWith('CLAUDE'))
        continue
      umgebung[name] = wert
    }
    if (modus === 'api') umgebung.ANTHROPIC_API_KEY = apiSchluessel

    abfrage = query({
      prompt: eingabe(),
      options: {
        cwd: projektPfad,
        env: umgebung,
        abortController: abbruch,
        pathToClaudeCodeExecutable: claudeExePfad(),
        // Georgs persönliche Claude-Einstellungen bleiben außen vor:
        // der Motor läuft nur mit dem, was FlowForge ihm mitgibt.
        settingSources: [],
        maxTurns: 50,
        ...(modus === 'api' && ausgabenObergrenzeUsd > 0
          ? { maxBudgetUsd: ausgabenObergrenzeUsd }
          : {}),
        stderr: (text) => {
          stderrPuffer = (stderrPuffer + text).slice(-4000)
        },
        spawnClaudeCodeProcess: (w) => {
          kindProzess = spawn(w.command, w.args, {
            cwd: w.cwd,
            env: w.env,
            signal: w.signal,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
          })
          return kindProzess
        },
        canUseTool: async (name, eingabeDaten) => {
          const urteil = pruefeWerkzeug(name, eingabeDaten ?? {}, projektPfad)
          if (urteil.erlaubt) return { behavior: 'allow', updatedInput: eingabeDaten }
          aufEreignis({ art: 'ticker', text: texte.ticker.rechteFrageGestellt })
          const erlaubt = await aufRechteFrage({ beschreibung: urteil.frage })
          aufEreignis({
            art: 'ticker',
            text: erlaubt ? texte.ticker.rechteFrageErlaubt : texte.ticker.rechteFrageAbgelehnt
          })
          if (erlaubt) return { behavior: 'allow', updatedInput: eingabeDaten }
          return { behavior: 'deny', message: texte.rechteFrage.abgelehntFuerAgent }
        }
      }
    })

    let ergebnis = null
    try {
      for await (const nachricht of abfrage) {
        aufEreignis({ art: 'roh', zeile: JSON.stringify(nachricht) })
        for (const zeile of tickerZeilen(nachricht, projektPfad))
          aufEreignis({ art: 'ticker', text: zeile })

        if (nachricht.type === 'assistant' && nachricht.message?.usage) {
          const u = nachricht.message.usage
          verbrauch.tokens =
            (u.input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0) +
            (u.output_tokens ?? 0)
          verbrauchMelden()
        }

        if (nachricht.type === 'result') {
          ergebnis = nachricht
          if (typeof nachricht.total_cost_usd === 'number')
            verbrauch.kostenUsd = nachricht.total_cost_usd
          for (const m of Object.values(nachricht.modelUsage ?? {}))
            if (m.contextWindow > 0) verbrauch.kontextFenster = m.contextWindow
          verbrauchMelden()
          if (typeof nachricht.duration_ms === 'number')
            aufEreignis({
              art: 'ticker',
              text: texte.ticker.fertigIn(Math.round(nachricht.duration_ms / 1000))
            })
          eingabeSchliessen()
        }
      }
    } catch (fehler) {
      // Nach einem harten Abbruch ist ein Prozessfehler erwartet — kein echter Fehler.
      if (!hartAngefordert && !ergebnis)
        return {
          zustand: sanftAngefordert ? 'sanft-gestoppt' : 'fehlgeschlagen',
          fehlertext: fehlertextAusErgebnis(null, stderrPuffer || String(fehler?.message ?? '')),
          verbrauch
        }
    } finally {
      eingabeSchliessen()
    }

    if (hartAngefordert)
      return { zustand: 'hart-abgebrochen', fehlertext: '', verbrauch }
    if (sanftAngefordert) return { zustand: 'sanft-gestoppt', fehlertext: '', verbrauch }
    // Achtung: subtype 'success' heißt nur „sauber durchgelaufen" — Fehler wie
    // eine fehlende Anmeldung kommen trotzdem mit is_error zurück.
    if (ergebnis?.subtype === 'success' && !ergebnis.is_error)
      return { zustand: 'erfolgreich', fehlertext: '', verbrauch }
    return {
      zustand: 'fehlgeschlagen',
      fehlertext: fehlertextAusErgebnis(ergebnis, stderrPuffer),
      verbrauch
    }
  })()

  return {
    fertig,
    sanftStoppen() {
      if (sanftAngefordert || hartAngefordert) return
      sanftAngefordert = true
      aufEreignis({ art: 'ticker', text: texte.ticker.sanftAngefordert })
      abfrage?.interrupt().catch(() => {})
    },
    hartStoppen() {
      if (hartAngefordert) return
      hartAngefordert = true
      aufEreignis({ art: 'ticker', text: texte.ticker.hartAbgebrochen })
      // BAUPLAN Schritt 3: harter Stopp = kompletter Prozessbaum, sofort.
      if (kindProzess?.pid)
        spawn('taskkill', ['/PID', String(kindProzess.pid), '/T', '/F'], { windowsHide: true })
      setTimeout(() => abbruch.abort(), 1500)
      eingabeSchliessen()
    }
  }
}
