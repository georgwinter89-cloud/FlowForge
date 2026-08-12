// Erster Motor (SPEC §2): die offizielle Claude-Code-CLI, headless im Hintergrund.
// Das Agent-SDK bringt eine eigene claude.exe mit — fester, absoluter Pfad, kein
// Shell-Aufruf, kein aufblitzendes Konsolenfenster (Windows-Härtung laut BAUPLAN).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { texte } from '../../shared/texte.js'
import { TITEL_MAX, TEXT_MAX } from '../../shared/kartenRegeln.js'
import {
  KONTEXT_FENSTER_STANDARD,
  kontextBand,
  UEBERTRAG_SCHWELLE_PROZENT,
  UEBERTRAG_TEST_AUFSCHLAG_PUNKTE
} from './schnittstelle.js'
import { kartenWerkzeugServer } from './kartenWerkzeuge.js'
import { menschWerkzeugServer } from './menschWerkzeuge.js'
import { startWerkzeugServer } from './startWerkzeuge.js'

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

// Sperre „darf nur lesen" (SPEC §4.2): nur diese Werkzeuge sind dann erlaubt.
// Bewusst ohne Task (Unteraufgaben könnten indirekt schreiben) und ohne Bash.
const NUR_LESEN_ERLAUBT = new Set([
  'Read',
  'Glob',
  'Grep',
  'TodoWrite',
  'NotebookRead',
  'BashOutput',
  'KillShell',
  'ExitPlanMode'
])

// Karten-Werkzeuge (BAUPLAN 7): in-Prozess-Werkzeuge des „karten"-Servers.
// Sie setzen die harten Kartenregeln selbst durch — keine Rückfrage nötig.
const KARTEN_PRAEFIX = 'mcp__karten__'
const KARTEN_NUR_LESEN = 'mcp__karten__karten_uebersicht'

// Mensch-Werkzeuge (BAUPLAN 9): eine Frage stellen verändert nichts am Projekt —
// erlaubt ohne Rückfrage, auch unter der Sperre „darf nur lesen" (der
// Frage-Block ist selbst nur-lesend).
const MENSCH_PRAEFIX = 'mcp__mensch__'

// Startanleitungs-Werkzeug (BAUPLAN 10): schreibt validiert ins Projekt —
// unter der Sperre „darf nur lesen" deshalb tabu.
const START_PRAEFIX = 'mcp__start__'

// FlowForges eigene Verwaltungsdateien im Projektordner: direkte Änderungen
// würden die harten Regeln umgehen (z.B. die Karten-Längengrenze oder die
// Startanleitungs-Validierung) — hartes Nein, der Agent nutzt die Werkzeuge.
const VERWALTUNGS_DATEIEN = new Set([
  'projekt.json',
  'karten.json',
  'workflow.json',
  'startanleitung.json',
  'laufstand.json'
])
const BERICHTE_ORDNER = 'laufberichte'

// Befehls-Einstufung (SPEC §7, seit Bauschritt 8): Befehle bekannter
// Entwickler-Werkzeuge decken „Tests ausführen" und „Programmbibliotheken
// installieren (offizielle Quellen)" ab und laufen ohne Rückfrage — ebenso rein
// lesende Befehle. Alles andere fragt weiterhin; Git bleibt hart gesperrt.
// Rein lesende Befehle: erlaubt auch unter der Sperre „darf nur lesen"
// (Feedback Georg, 12.08.2026 — vorher wurden Lese-Blöcke schon beim
// Ordner-Auflisten abgewiesen). Ausführen von Programmen (node, python …)
// zählt bewusst nicht als Lesen: ein Skriptlauf kann alles Mögliche schreiben.
const LESE_BEFEHLE = new Set([
  'dir', 'ls', 'type', 'cat', 'findstr', 'grep', 'where', 'echo', 'printf', 'pwd', 'head', 'tail', 'wc',
  'tr', 'sort', 'uniq', 'cut',
  'get-childitem', 'get-content', 'select-string', 'get-location', 'measure-object', 'select-object', 'sort-object'
])

const BEFEHLE_OHNE_RUECKFRAGE = new Set([
  // Entwickler-Werkzeuge: bauen, testen, installieren
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'tsc', 'vitest', 'jest',
  'python', 'python3', 'py', 'pip', 'pip3', 'pytest',
  ...LESE_BEFEHLE
])

// Shell-Gerüstwörter: `do`/`then`/`else` leiten nur den eigentlichen Befehl
// ein, `if`/`while`/`until`/`elif` prüfen den Befehl dahinter — eingestuft
// wird jeweils, was danach kommt.
const GERUEST_VORSILBEN = new Set(['do', 'then', 'else', 'if', 'while', 'until', 'elif'])

// Zerlegt einen verketteten Befehl in seine Teilstücke und liefert die
// Werkzeugnamen (cd-Vorspann wird übersprungen — er wechselt nur den Ordner).
// Lese-Schleifen wie `for f in a.js b.js; do head $f; done` (Feedback Georg,
// 12.08.2026): Das Schleifen-Gerüst führt selbst nichts aus und wird
// übersprungen — eingestuft werden die Befehle im Schleifenkörper.
function befehlsNamen(befehl) {
  const namen = []
  for (const teil of String(befehl).split(/&&|\|\||[;|\n]/)) {
    // Reine Text-Ausgaben wie "ExitCode=$LASTEXITCODE" (übliches
    // PowerShell-Anhängsel des Motors) führen nichts aus — außer sie enthalten
    // eine $(…)-Unterausführung oder Backticks, dann zählen sie als Befehl.
    const getrimmt = teil.trim()
    if (/^"[^"`]*"$/.test(getrimmt) && !getrimmt.includes('$(')) continue
    // `for f in <feste Wörter>` führt nichts aus — aber nur ohne
    // $(…)-Unterausführung und Backticks; sonst normal einstufen.
    if (/^for\s+\S+\s+in\s[^$`]*$/i.test(getrimmt)) continue
    if (/^(done|fi|esac)$/i.test(getrimmt)) continue
    const woerter = getrimmt.split(/\s+/)
    while (woerter.length > 0 && GERUEST_VORSILBEN.has(woerter[0].toLowerCase())) woerter.shift()
    const erster = woerter[0]
    if (!erster) continue
    namen.push(
      erster
        .replace(/^["']|["']$/g, '')
        .toLowerCase()
        .split(/[\\/]/)
        .pop()
        .replace(/\.(exe|cmd|bat)$/, '')
    )
  }
  return namen
}

// Ein verketteter Befehl läuft nur dann ohne Rückfrage, wenn jedes Teilstück
// mit einem bekannten Werkzeug beginnt — sonst entscheidet Georg.
function befehlOhneRueckfrage(befehl) {
  const namen = befehlsNamen(befehl)
  return namen.length > 0 && namen.every((name) => BEFEHLE_OHNE_RUECKFRAGE.has(name))
}

// Rein lesender Befehl: jedes Teilstück ist ein Lese-Werkzeug (cd davor ist
// erlaubt), und nichts wird in eine Datei umgeleitet. `2>&1` und Umleitungen
// ins Nichts (NUL, /dev/null) verändern keine Datei und bleiben erlaubt.
function befehlNurLesend(befehl) {
  const ohneHarmloseUmleitung = String(befehl)
    .replace(/2>&1/g, '')
    .replace(/>+\s*(\/dev\/null|nul)\b/gi, '')
  if (ohneHarmloseUmleitung.includes('>')) return false
  const namen = befehlsNamen(befehl).filter((name) => name !== 'cd')
  return namen.length > 0 && namen.every((name) => LESE_BEFEHLE.has(name))
}

// Der Prüfordner (SPEC §4.3, Entscheidung Georg, 12.08.2026): Die Prüfmappe
// gehört dem Prüfer — andere Blöcke dürfen dort nichts anlegen oder ändern,
// sonst weicht der Bauer die Prüfungen auf, statt den Code zu reparieren.
const PRUEF_ORDNER = 'pruefung'

function liegtInPruefmappe(datei, projektPfad) {
  if (!datei) return false
  const relativ = path
    .relative(path.resolve(projektPfad), path.resolve(projektPfad, String(datei)))
    .toLowerCase()
  return relativ === PRUEF_ORDNER || relativ.startsWith(PRUEF_ORDNER + path.sep)
}

// Befehle, die die Prüfmappe verändern könnten: Der Befehl nennt den Prüfordner
// UND enthält ein veränderndes Werkzeug oder eine Datei-Umleitung. Das ist eine
// Faustregel (Befehlstexte sind nicht sicher zerlegbar) — sie trifft genau die
// beobachteten Aufweich-Versuche (sed -i auf Prüfdateien); reine Testläufe wie
// „node pruefung/test.js" bleiben erlaubt.
function befehlAendertPruefmappe(befehl) {
  const text = String(befehl)
  if (!new RegExp('\\b' + PRUEF_ORDNER + '\\b', 'i').test(text)) return false
  const ohneHarmloseUmleitung = text
    .replace(/2>&1/g, '')
    .replace(/>+\s*(\/dev\/null|nul)\b/gi, '')
  if (ohneHarmloseUmleitung.includes('>')) return true
  return /\b(sed\s+-i|rm|del|mv|move|cp|copy|tee|touch|remove-item|set-content|add-content|out-file)\b/i.test(
    text
  )
}

function istVerwaltungsdatei(datei, projektPfad) {
  if (!datei) return false
  const relativ = path
    .relative(path.resolve(projektPfad), path.resolve(projektPfad, String(datei)))
    .toLowerCase()
  return VERWALTUNGS_DATEIEN.has(relativ) || relativ.startsWith(BERICHTE_ORDNER + path.sep)
}

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
// Mit Sperre „darf nur lesen": hartes Nein für alles außer Lese-Werkzeugen und
// rein lesenden Befehlen. Die Prüfmappe dürfen nur Prüf-Blöcke verändern.
// Exportiert, damit sich die Einstufung ohne laufenden Motor prüfen lässt.
export function pruefeWerkzeug(name, eingabe, projektPfad, nurLesen, darfPruefen) {
  if (name.startsWith(MENSCH_PRAEFIX)) return { erlaubt: true }
  // Startanleitung setzen schreibt ins Projekt — validiert im Werkzeug selbst,
  // aber unter der Sperre „darf nur lesen" gesperrt.
  if (name.startsWith(START_PRAEFIX)) {
    if (nurLesen)
      return { gesperrt: texte.rechteFrage.nurLesenGesperrtFuerAgent, tickerText: texte.ticker.nurLesenGesperrt }
    return { erlaubt: true }
  }
  // Karten-Werkzeuge zuerst: die Übersicht ist rein lesend, alles andere
  // schreibt — und fällt damit unter die Sperre „darf nur lesen".
  if (name.startsWith(KARTEN_PRAEFIX)) {
    if (nurLesen && name !== KARTEN_NUR_LESEN)
      return { gesperrt: texte.rechteFrage.nurLesenGesperrtFuerAgent, tickerText: texte.ticker.nurLesenGesperrt }
    return { erlaubt: true }
  }
  // Unter „darf nur lesen" sind rein lesende Befehle erlaubt (Feedback Georg,
  // 12.08.2026) — alles andere an Befehlen wird ehrlich als Befehl gestoppt,
  // nicht fälschlich als „Schreib-Versuch" gemeldet.
  if (nurLesen && (name === 'Bash' || name === 'PowerShell')) {
    if (befehlNurLesend(String(eingabe.command ?? ''))) return { erlaubt: true }
    return {
      gesperrt: texte.rechteFrage.nurLesenBefehlFuerAgent,
      tickerText: texte.ticker.nurLesenBefehlGesperrt
    }
  }
  if (nurLesen && !NUR_LESEN_ERLAUBT.has(name))
    return { gesperrt: texte.rechteFrage.nurLesenGesperrtFuerAgent, tickerText: texte.ticker.nurLesenGesperrt }
  if (OHNE_RUECKFRAGE.has(name)) return { erlaubt: true }
  if (SCHREIB_WERKZEUGE.has(name)) {
    const datei = eingabe.file_path ?? eingabe.notebook_path
    if (istVerwaltungsdatei(datei, projektPfad))
      return { gesperrt: texte.rechteFrage.verwaltungGesperrtFuerAgent, tickerText: texte.ticker.verwaltungGesperrt }
    // Die Prüfmappe gehört dem Prüfer (Entscheidung Georg, 12.08.2026).
    if (!darfPruefen && liegtInPruefmappe(datei, projektPfad))
      return { gesperrt: texte.rechteFrage.pruefmappeGesperrtFuerAgent, tickerText: texte.ticker.pruefmappeGesperrt }
    if (liegtImProjekt(datei, projektPfad)) return { erlaubt: true }
    return { frage: texte.rechteFrage.schreibenAusserhalb(String(datei ?? '?')) }
  }
  if (name === 'Bash' || name === 'PowerShell') {
    const befehl = String(eingabe.command ?? '?')
    // BAUPLAN 4: Git ist dem Agenten per Sperre untersagt — es würde mit der
    // Sicherungspunkt-Verwaltung von FlowForge kollidieren. Keine Rückfrage, hartes Nein.
    if (/\bgit\b/i.test(befehl))
      return { gesperrt: texte.rechteFrage.gitGesperrtFuerAgent, tickerText: texte.ticker.gitGesperrt }
    if (!darfPruefen && befehlAendertPruefmappe(befehl))
      return { gesperrt: texte.rechteFrage.pruefmappeGesperrtFuerAgent, tickerText: texte.ticker.pruefmappeGesperrt }
    if (befehlOhneRueckfrage(befehl)) return { erlaubt: true }
    return { frage: texte.rechteFrage.befehl(befehl) }
  }
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
  // Überlastete KI-Server: die CLI wiederholt selbst — ohne diese Zeile sähe
  // Georg nur eine stumme App.
  if (nachricht.type === 'system' && nachricht.subtype === 'api_retry')
    return [t.motorWartet(nachricht.attempt ?? '?', nachricht.max_retries ?? '?')]
  if (nachricht.type !== 'assistant') return []
  const zeilen = []
  for (const block of nachricht.message?.content ?? []) {
    if (block.type === 'text' && block.text?.trim()) zeilen.push(block.text.trim())
    if (block.type !== 'tool_use') continue
    const e = block.input ?? {}
    // Karten-Werkzeuge: die Übersicht meldet sich hier, Änderungen melden ihr
    // Ergebnis selbst aus dem Werkzeug heraus (angelegt/abgelehnt).
    if (block.name.startsWith(KARTEN_PRAEFIX)) {
      if (block.name === KARTEN_NUR_LESEN) zeilen.push(t.liestKarten)
      continue
    }
    // Mensch-Fragen melden sich aus der Lauf-Verwaltung heraus (Frage + Antwort
    // stehen im Gespräch) — keine doppelte Ticker-Zeile. Das Startanleitungs-
    // Werkzeug meldet sein Ergebnis ebenfalls selbst (festgelegt/abgelehnt).
    if (block.name.startsWith(MENSCH_PRAEFIX)) continue
    if (block.name.startsWith(START_PRAEFIX)) continue
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

// Fehlermeldung des Motors in Klartext übersetzen und einstufen — an der
// fehlerArt entscheidet die Lauf-Verwaltung z.B. über die Kontingent-Pause.
function fehlerAusErgebnis(ergebnis, stderrRest) {
  const teile = []
  // Bei is_error steckt die eigentliche Meldung im result-Text.
  if (ergebnis?.is_error && typeof ergebnis.result === 'string' && ergebnis.result)
    teile.push(ergebnis.result)
  if (Array.isArray(ergebnis?.errors)) teile.push(...ergebnis.errors.map(String))
  if (!teile.length && ergebnis?.subtype && ergebnis.subtype !== 'success')
    teile.push(ergebnis.subtype)
  if (!teile.length && stderrRest) teile.push(kuerzen(stderrRest, 400))
  const text = teile.join(' · ')
  // Server-Überlastung (529) — vorübergehend; die Lauf-Verwaltung pausiert dann.
  if (/overloaded|\b529\b/i.test(text))
    return { fehlertext: texte.lauf.serverUeberlastet, fehlerArt: 'ueberlastet' }
  // Abo-Kontingent erschöpft (SPEC §5) — die typischen Formulierungen der CLI.
  if (/usage limit|limit reached|rate.?limit|quota|out of extra usage/i.test(text))
    return { fehlertext: texte.lauf.kontingentErschoepft, fehlerArt: 'kontingent' }
  if (/log ?in|logged|authent|api key|credentials/i.test(text))
    return { fehlertext: texte.lauf.motorNichtAngemeldet, fehlerArt: 'anmeldung' }
  if (/budget/i.test(text))
    return { fehlertext: texte.lauf.obergrenzeErreicht, fehlerArt: 'obergrenze' }
  return { fehlertext: text || texte.fehler.unbekannt, fehlerArt: null }
}

// Einmal-Frage an den Motor (SPEC §4.5, BAUPLAN 14): eine einzelne Frage ohne
// Projekt, ohne Werkzeuge, ohne Liveticker — die Antwort ist reiner Text.
// Der KI-Assistent des Block-Editors füllt damit das Formular aus.
export async function starteMotorFrage({ frage, modus, apiSchluessel, ausgabenObergrenzeUsd, arbeitsOrdner }) {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  let stderrPuffer = ''
  // Saubere Umgebung wie beim Lauf: keine ANTHROPIC_*/CLAUDE*-Reste.
  const umgebung = {}
  for (const [name, wert] of Object.entries(process.env)) {
    if (name.toUpperCase().startsWith('ANTHROPIC') || name.toUpperCase().startsWith('CLAUDE'))
      continue
    umgebung[name] = wert
  }
  if (modus === 'api') umgebung.ANTHROPIC_API_KEY = apiSchluessel

  const abfrage = query({
    prompt: frage,
    options: {
      cwd: arbeitsOrdner,
      env: umgebung,
      pathToClaudeCodeExecutable: claudeExePfad(),
      settingSources: [],
      // Ein paar Runden Spielraum: Versucht der Motor doch ein Werkzeug, wird
      // es abgelehnt und er antwortet danach direkt.
      maxTurns: 4,
      ...(modus === 'api' && ausgabenObergrenzeUsd > 0
        ? { maxBudgetUsd: ausgabenObergrenzeUsd }
        : {}),
      stderr: (text) => {
        stderrPuffer = (stderrPuffer + text).slice(-4000)
      },
      spawnClaudeCodeProcess: (w) =>
        spawn(w.command, w.args, {
          cwd: w.cwd,
          env: w.env,
          signal: w.signal,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        }),
      canUseTool: async () => ({
        behavior: 'deny',
        message: texte.agentenBlockAssistent.keineWerkzeuge
      })
    }
  })

  let ergebnis = null
  try {
    for await (const nachricht of abfrage) {
      if (nachricht.type === 'result') ergebnis = nachricht
    }
  } catch (fehler) {
    const { fehlertext } = fehlerAusErgebnis(null, stderrPuffer || String(fehler?.message ?? ''))
    return { ok: false, fehler: fehlertext }
  }
  if (ergebnis?.subtype === 'success' && !ergebnis.is_error)
    return { ok: true, text: typeof ergebnis.result === 'string' ? ergebnis.result : '' }
  const { fehlertext } = fehlerAusErgebnis(ergebnis, stderrPuffer)
  return { ok: false, fehler: fehlertext }
}

export function starteMotorLauf(optionen) {
  const {
    projektPfad,
    auftrag,
    modus,
    apiSchluessel,
    ausgabenObergrenzeUsd,
    nurLesen = false,
    // Prüf-Blöcke (prueft: true) dürfen als einzige die Prüfmappe verändern.
    darfPruefen = false,
    // Session-Fortsetzung bei Wiederholungen (BAUPLAN 16): Kennung der eigenen
    // früheren Session dieses Blocks — der auftrag ist dann nur der Zusatz.
    fortsetzen = null,
    uebertrag = { aktiv: false, testModus: false, anweisung: '' },
    // Die echte Fenstergröße meldet der Motor erst am Session-Ende — ein
    // Vorwissen aus früheren Blöcken desselben Laufs macht die
    // Übertrags-Schwelle von Anfang an richtig.
    kontextFenster = KONTEXT_FENSTER_STANDARD,
    aufEreignis,
    aufRechteFrage,
    aufMenschFrage
  } = optionen

  let kindProzess = null
  let sanftAngefordert = false
  let hartAngefordert = false
  let stderrPuffer = ''
  let abfrage = null
  const abbruch = new AbortController()

  // Die Eingabe ist eine Warteschlange und bleibt offen, bis das Ergebnis da
  // ist — so kann der Motor Unterbrechungen empfangen und beim Übertrag die
  // Übergabe-Anweisung als weitere Nachricht in dieselbe Session bekommen.
  const eingabeSchlange = []
  let eingabeEnde = false
  let eingabeWecker = null
  function eingabeNachschieben(text) {
    eingabeSchlange.push(text)
    eingabeWecker?.()
  }
  function eingabeSchliessen() {
    eingabeEnde = true
    eingabeWecker?.()
  }
  async function* eingabe() {
    yield { type: 'user', message: { role: 'user', content: auftrag }, parent_tool_use_id: null }
    while (true) {
      if (eingabeSchlange.length) {
        const text = eingabeSchlange.shift()
        yield { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null }
        continue
      }
      if (eingabeEnde) return
      await new Promise((wecken) => (eingabeWecker = wecken))
    }
  }

  // Automatischer Übertrag (SPEC §5): null | 'angefordert' | 'uebergabe' | 'fertig'.
  let uebertragPhase = null
  // Füllstand der ersten Messung dieser Session — Bezugspunkt für den Testmodus.
  let startProzent = null
  // Session-Kennung dieses Laufs (BAUPLAN 16) — jede SDK-Nachricht trägt sie.
  let sessionKennung = null
  // Kam überhaupt eine Nachricht an? Scheitert ein Fortsetzen-Versuch schon
  // beim Start (Kennung ungültig, Session weg), bleibt das false.
  let nachrichtEmpfangen = false

  const verbrauch = {
    tokens: 0,
    kontextProzentVon: 0,
    kontextProzentBis: 5,
    kostenUsd: null,
    kontextFenster: kontextFenster > 0 ? kontextFenster : KONTEXT_FENSTER_STANDARD,
    // Beim Übertrag: der Füllstand im Moment der Auslösung — die endgültige
    // Fenstergröße kommt erst später und würde ihn sonst verfälschen.
    uebertragBand: null
  }

  function verbrauchMelden() {
    const band = kontextBand(verbrauch.tokens, verbrauch.kontextFenster)
    verbrauch.kontextProzentVon = band.von
    verbrauch.kontextProzentBis = band.bis
    aufEreignis({ art: 'verbrauch', verbrauch: { ...verbrauch } })
  }

  const fertig = (async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    // Agent-Karten-Brücke (BAUPLAN 7): Karten lesen/schreiben mit denselben
    // harten Regeln wie für Menschen — läuft im FlowForge-Prozess selbst.
    const kartenServer = await kartenWerkzeugServer({ projektPfad, aufEreignis })
    // Frage an den Menschen (BAUPLAN 9): pausiert den Lauf, bis der Nutzer
    // im Gespräch geantwortet hat.
    const menschServer = await menschWerkzeugServer({ aufMenschFrage })
    // Startanleitung (BAUPLAN 10): das Pflicht-Artefakt der Bau-Blöcke wird
    // ausschließlich über dieses validierende Werkzeug geschrieben.
    const startServer = await startWerkzeugServer({ projektPfad, aufEreignis })

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
        // Session-Fortsetzung (BAUPLAN 16): dieselbe Session weiterführen —
        // der Agent kennt seine bisherige Arbeit noch.
        ...(fortsetzen ? { resume: fortsetzen } : {}),
        mcpServers: { karten: kartenServer, mensch: menschServer, start: startServer },
        // Windows-Härtung: Die Shell des Motors zeigt POSIX-Pfade (/tmp/…, /c/…) an —
        // als Datei-Werkzeug-Pfade landen die auf Windows aber am falschen Ort und
        // lösen unnötige Rechte-Rückfragen aus.
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append:
            `Der Projektordner ist: ${projektPfad}\n` +
            'Verwende bei Datei-Werkzeugen (Read/Write/Edit) ausschließlich Pfade relativ ' +
            'zum Projektordner oder diesen absoluten Windows-Pfad. Niemals POSIX-Pfade ' +
            'wie /tmp/… oder /c/… verwenden — sie zeigen auf Windows auf falsche Orte.\n' +
            'Projektkarten: FlowForge verwaltet strukturierte Karten (Status, Aufgabe, ' +
            'Entscheidung, Wissen) als Gedächtnis des Projekts. Lies und schreibe sie ' +
            'ausschließlich über die karten-Werkzeuge (karten_uebersicht, karte_anlegen, ' +
            'karte_aktualisieren, karte_erledigen) — niemals über die Datei karten.json. ' +
            `Harte Regeln: Titel höchstens ${TITEL_MAX} Zeichen, Inhalt höchstens ${TEXT_MAX} ` +
            'Zeichen; wer mehr zu sagen hat, legt mehrere fokussierte Karten an. Es gibt ' +
            'genau eine Status-Karte — sie kann weder gelöscht noch neu angelegt werden.'
        },
        // Echte Bau- und Prüf-Blöcke (BAUPLAN 8) brauchen deutlich mehr Runden
        // als die Übungs-Blöcke — die echte Grenze ist das Kontextfenster.
        maxTurns: 200,
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
          const urteil = pruefeWerkzeug(name, eingabeDaten ?? {}, projektPfad, nurLesen, darfPruefen)
          if (urteil.erlaubt) return { behavior: 'allow', updatedInput: eingabeDaten }
          if (urteil.gesperrt) {
            aufEreignis({ art: 'ticker', text: urteil.tickerText })
            return { behavior: 'deny', message: urteil.gesperrt }
          }
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
        nachrichtEmpfangen = true
        if (typeof nachricht.session_id === 'string' && nachricht.session_id)
          sessionKennung = nachricht.session_id
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

          // Übertrags-Schwelle (SPEC §5): läuft der Kontext voll, wird der
          // Agent unterbrochen und zur Übergabe aufgefordert — genau einmal.
          if (uebertrag.aktiv && uebertragPhase === null && !sanftAngefordert && !hartAngefordert) {
            const fenster = verbrauch.kontextFenster || KONTEXT_FENSTER_STANDARD
            const prozent = (verbrauch.tokens / fenster) * 100
            if (startProzent === null) startProzent = prozent
            const schwelle = uebertrag.testModus
              ? Math.min(startProzent + UEBERTRAG_TEST_AUFSCHLAG_PUNKTE, UEBERTRAG_SCHWELLE_PROZENT)
              : UEBERTRAG_SCHWELLE_PROZENT
            if (prozent >= schwelle) {
              uebertragPhase = 'angefordert'
              verbrauch.uebertragBand = {
                von: verbrauch.kontextProzentVon,
                bis: verbrauch.kontextProzentBis
              }
              aufEreignis({
                art: 'ticker',
                text: texte.ticker.uebertragAngefordert(
                  verbrauch.kontextProzentVon,
                  verbrauch.kontextProzentBis
                )
              })
              abfrage?.interrupt().catch(() => {})
            }
          }
        }

        if (nachricht.type === 'result') {
          if (typeof nachricht.total_cost_usd === 'number')
            verbrauch.kostenUsd = nachricht.total_cost_usd
          for (const m of Object.values(nachricht.modelUsage ?? {}))
            if (m.contextWindow > 0) verbrauch.kontextFenster = m.contextWindow
          verbrauchMelden()

          if (uebertragPhase === 'angefordert' && !sanftAngefordert && !hartAngefordert) {
            if (nachricht.subtype === 'success' && !nachricht.is_error) {
              // Wettlauf: Der Block war beim Erreichen der Schwelle ohnehin
              // fertig — dann ist das ein normales Ende, kein Übertrag.
              uebertragPhase = null
              ergebnis = nachricht
            } else {
              // Das ist das Ende des unterbrochenen Auftrags — jetzt bekommt
              // dieselbe Session (voller Kontext!) die Übergabe-Anweisung.
              uebertragPhase = 'uebergabe'
              eingabeNachschieben(uebertrag.anweisung)
            }
          } else if (uebertragPhase === 'uebergabe' && !sanftAngefordert && !hartAngefordert) {
            uebertragPhase = 'fertig'
            ergebnis = nachricht
          } else {
            ergebnis = nachricht
          }

          if (ergebnis) {
            if (typeof nachricht.duration_ms === 'number')
              aufEreignis({
                art: 'ticker',
                text: texte.ticker.fertigIn(Math.round(nachricht.duration_ms / 1000))
              })
            eingabeSchliessen()
          }
        }
      }
    } catch (fehler) {
      // Nach einem harten Abbruch ist ein Prozessfehler erwartet — kein echter Fehler.
      if (!hartAngefordert && !ergebnis) {
        if (sanftAngefordert)
          return { zustand: 'sanft-gestoppt', fehlertext: '', fehlerArt: null, ergebnisText: '', verbrauch, sessionKennung }
        // Stirbt die Session mitten im Übertrag, geht nur die Übergabe verloren —
        // die frische Session liest den Stand dann selbst aus Ordner und Karten.
        if (uebertragPhase)
          return { zustand: 'uebertrag', fehlertext: '', fehlerArt: null, ergebnisText: '', verbrauch, sessionKennung }
        // Fortsetzen-Versuch, der schon vor der ersten Nachricht stirbt: die
        // alte Session ist nicht wiederaufnehmbar — still auf Kaltstart zurück.
        if (fortsetzen && !nachrichtEmpfangen)
          return { zustand: 'fortsetzung-gescheitert', fehlertext: '', fehlerArt: null, ergebnisText: '', verbrauch, sessionKennung: null }
        const { fehlertext, fehlerArt } = fehlerAusErgebnis(
          null,
          stderrPuffer || String(fehler?.message ?? '')
        )
        return { zustand: 'fehlgeschlagen', fehlertext, fehlerArt, ergebnisText: '', verbrauch, sessionKennung }
      }
    } finally {
      eingabeSchliessen()
    }

    // Der Abschlusstext des Agenten — daraus liest FlowForge z.B. Prüfer-Urteile.
    const ergebnisText = typeof ergebnis?.result === 'string' ? ergebnis.result : ''

    if (hartAngefordert)
      return { zustand: 'hart-abgebrochen', fehlertext: '', fehlerArt: null, ergebnisText: '', verbrauch, sessionKennung }
    if (sanftAngefordert)
      return { zustand: 'sanft-gestoppt', fehlertext: '', fehlerArt: null, ergebnisText, verbrauch, sessionKennung }
    // Übertrag (SPEC §5): der Abschlusstext ist die Übergabe an die frische Session.
    if (uebertragPhase === 'fertig' || uebertragPhase === 'uebergabe')
      return { zustand: 'uebertrag', fehlertext: '', fehlerArt: null, ergebnisText, verbrauch, sessionKennung }
    // Achtung: subtype 'success' heißt nur „sauber durchgelaufen" — Fehler wie
    // eine fehlende Anmeldung kommen trotzdem mit is_error zurück.
    if (ergebnis?.subtype === 'success' && !ergebnis.is_error)
      return { zustand: 'erfolgreich', fehlertext: '', fehlerArt: null, ergebnisText, verbrauch, sessionKennung }
    {
      const { fehlertext, fehlerArt } = fehlerAusErgebnis(ergebnis, stderrPuffer)
      // Fortsetzen-Versuch, den die CLI mit „Session nicht gefunden" ablehnt
      // (real beobachtet: „No conversation found with session ID: …"): kein
      // echter Fehler des Blocks — still auf Kaltstart zurück. Echte Fehler
      // mit Einstufung (Kontingent, Anmeldung …) bleiben, was sie sind.
      if (
        fortsetzen &&
        fehlerArt === null &&
        (!nachrichtEmpfangen ||
          /no conversation|session id|session.*not found|(could not|cannot|unable to) resume/i.test(
            fehlertext
          ))
      )
        return { zustand: 'fortsetzung-gescheitert', fehlertext: '', fehlerArt: null, ergebnisText: '', verbrauch, sessionKennung: null }
      return { zustand: 'fehlgeschlagen', fehlertext, fehlerArt, ergebnisText, verbrauch, sessionKennung }
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
