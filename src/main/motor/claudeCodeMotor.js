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
import { helferWerkzeugServer } from './helferWerkzeuge.js'
import { menschWerkzeugServer } from './menschWerkzeuge.js'
import { kontextFensterFuerModell, kontextFensterMerken } from './motorWissen.js'
import { startWerkzeugServer } from './startWerkzeuge.js'
import { pruefbefehlWerkzeugServer } from './pruefbefehlWerkzeuge.js'
import { appWerkzeugServer } from './appWerkzeuge.js'
import { vorschlagWerkzeugServer } from './vorschlagWerkzeuge.js'
import { laufVorschlagWerkzeugServer } from './laufVorschlagWerkzeuge.js'
import { kartenZuteilungWerkzeugServer } from './kartenZuteilungWerkzeuge.js'
import { prozessWurzelMelden } from '../prozesse.js'

const laden = createRequire(import.meta.url)

function claudeExePfad() {
  const roh = laden.resolve('@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe')
  // Im installierten Zustand liegt die exe neben dem asar-Archiv im „unpacked"-Ordner.
  return roh.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
}

// Werkzeuge, die nur lesen oder rein intern arbeiten — laut SPEC §7 ohne Rückfrage.
// „Task" und „Agent" sind zwei Namen desselben Unteraufgaben-Werkzeugs (die CLI
// nennt es inzwischen Agent); ToolSearch lädt nur Werkzeug-Beschreibungen nach.
const OHNE_RUECKFRAGE = new Set([
  'Read',
  'Glob',
  'Grep',
  'TodoWrite',
  'Task',
  'Agent',
  'ToolSearch',
  'BashOutput',
  'KillShell',
  'ExitPlanMode',
  'NotebookRead'
])

const SCHREIB_WERKZEUGE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])

// Sperre „darf nur lesen" (SPEC §4.2): nur diese Werkzeuge sind dann erlaubt.
// Task/Agent ist dabei (BAUPLAN 17/19): Unteraufgaben halten den Kontext
// schlank, und ihre eigenen Werkzeugaufrufe laufen durch dieselbe
// Rechte-Prüfung — schreiben kann eine Unteraufgabe unter der Sperre also
// genauso wenig. Bewusst ohne Bash.
const NUR_LESEN_ERLAUBT = new Set([
  'Read',
  'Glob',
  'Grep',
  'TodoWrite',
  'Task',
  'Agent',
  'ToolSearch',
  'NotebookRead',
  'BashOutput',
  'KillShell',
  'ExitPlanMode'
])

// Karten-Werkzeuge (BAUPLAN 7): in-Prozess-Werkzeuge des „karten"-Servers.
// Sie setzen die harten Kartenregeln selbst durch — keine Rückfrage nötig.
const KARTEN_PRAEFIX = 'mcp__karten__'
const KARTEN_NUR_LESEN = 'mcp__karten__karten_uebersicht'
// Audit (BAUPLAN 25): Karten anlegen ist die einzige Schreibarbeit des
// nur-lesenden Audit-Blocks — freigeschaltet über darfKartenAnlegen.
const KARTEN_ANLEGEN = 'mcp__karten__karte_anlegen'

// Mensch-Werkzeuge (BAUPLAN 9): eine Frage stellen verändert nichts am Projekt —
// erlaubt ohne Rückfrage, auch unter der Sperre „darf nur lesen" (der
// Frage-Block ist selbst nur-lesend).
const MENSCH_PRAEFIX = 'mcp__mensch__'

// Startanleitungs-Werkzeug (BAUPLAN 10): schreibt validiert ins Projekt —
// unter der Sperre „darf nur lesen" deshalb tabu.
const START_PRAEFIX = 'mcp__start__'

// Prüfbefehl-Werkzeug (BAUPLAN 35): hinterlegt den Startbefehl der Prüfmappe,
// den FlowForge in Reparatur-Runden selbst abspielt (Tor ohne KI). Er ändert
// keine Projektdatei — aber er ist ein Befehl, den FlowForge später ohne
// Rückfrage ausführt, und gehört deshalb dem Prüfer. Andere Blöcke lösen die
// übliche Rechte-Rückfrage aus (Rückfrage statt Sperre, Feedback Georg).
const PRUEFBEFEHL_PRAEFIX = 'mcp__pruefbefehl__'

// Lokale Helfer-KI (Experiment, 13.08.2026): rein lesende Recherche über
// Ollama — im Code auf Auflisten/Lesen/Suchen im Projektordner begrenzt,
// deshalb ohne Rückfrage und auch unter „darf nur lesen" erlaubt.
const HELFER_PRAEFIX = 'mcp__helfer__'

// Karten-Vorschläge (BAUPLAN 26): Der Karten-Prüfer schlägt vor, der Nutzer
// entscheidet, FlowForge wendet an — das Werkzeug selbst ändert nichts und
// ist deshalb unter „darf nur lesen" erlaubt. Frei ist es nur für Blöcke mit
// dem Kennzeichen kartenVorschlaege; andere Blöcke lösen die übliche
// Rechte-Rückfrage aus (Feedback Georg, 14.08.2026 — vorher hartes Nein).
const VORSCHLAG_PRAEFIX = 'mcp__vorschlaege__'

// Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): naechster_lauf_vorschlagen
// speichert nur einen Vorschlag — angewendet wird nie automatisch, deshalb ist
// es auch unter „darf nur lesen" unbedenklich. Frei nur für Blöcke mit dem
// Kennzeichen laufVorschlag (Sessionende); andere Blöcke lösen die übliche
// Rechte-Rückfrage aus (dasselbe Muster wie karte_vorschlagen).
const LAUF_VORSCHLAG_PRAEFIX = 'mcp__naechsterlauf__'

// Karten-Zuteilung (BAUPLAN 29): karten_zuteilen teilt den nachfolgenden
// Blöcken ihre Karten zu — nur eine Meldung an FlowForge, keine Datei-Änderung,
// deshalb auch unter „darf nur lesen" unbedenklich. Frei nur für Blöcke mit
// dem Kennzeichen kartenZuteilung (Paket schneiden, Diagnose); andere Blöcke
// lösen die übliche Rechte-Rückfrage aus (dasselbe Muster wie laufVorschlag).
const ZUTEILUNG_PRAEFIX = 'mcp__zuteilung__'

// FlowForges eigene Verwaltungsdateien im Projektordner: direkte Änderungen
// würden die harten Regeln umgehen (z.B. die Karten-Längengrenze oder die
// Startanleitungs-Validierung) — hartes Nein, der Agent nutzt die Werkzeuge.
const VERWALTUNGS_DATEIEN = new Set([
  'projekt.json',
  'karten.json',
  'workflow.json',
  'startanleitung.json',
  'laufstand.json',
  'naechster-lauf.json',
  // Verlauf des Co-Piloten (BAUPLAN 33): Verwaltungsdatei wie die anderen.
  'chat.json',
  // Prüfbefehl (BAUPLAN 35): FlowForge führt ihn selbst aus, ohne
  // Rechte-Rückfrage — geschrieben wird er ausschließlich über das hart
  // validierende Werkzeug pruefbefehl_setzen.
  'pruefbefehl.json'
])
const BERICHTE_ORDNER = 'laufberichte'

// App-Werkzeuge des Co-Piloten (BAUPLAN 33): app_starten / app_stoppen /
// app_neustarten / app_ausgabe bedienen den App-Tab — derselbe Prozess, den
// der Nutzer im Tab sieht. Die Ausgabe lesen ist rein lesend; Starten/Stoppen
// ist im Reparatur-Modus frei und fragt sonst nach (Rückfrage statt Sperre);
// einen fremden Port-Besitzer beenden fragt immer.
const APP_PRAEFIX = 'mcp__app__'
const APP_AUSGABE = APP_PRAEFIX + 'app_ausgabe'

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

// Umgebungsvariablen, die den Befehl dahinter umleiten oder Code einschleusen
// können — eine solche Vorsilbe wird NICHT übersprungen (Zweit-Audit C-03).
const GEFAEHRLICHE_UMGEBUNG =
  /^(path|pathext|comspec|shell|ifs|env|bash_env|psmodulepath|node_options|pythonpath|pythonhome|pythonstartup|ld_\w*|dyld_\w*)=/i

// Zerlegt einen verketteten Befehl in seine Teilstücke und liefert die
// Werkzeugnamen (cd-Vorspann wird übersprungen — er wechselt nur den Ordner).
// Lese-Schleifen wie `for f in a.js b.js; do head $f; done` (Feedback Georg,
// 12.08.2026): Das Schleifen-Gerüst führt selbst nichts aus und wird
// übersprungen — eingestuft werden die Befehle im Schleifenkörper.
function befehlsNamen(befehl) {
  const namen = []
  // Harmlose Zusammenführungs-Umleitungen (2>&1, 1>&2 …) vor der Zerlegung
  // entfernen — ihr & ist kein Befehls-Trenner (Zweit-Audit C-01).
  const bereinigt = String(befehl).replace(/\d*>&\d+/g, ' ')
  // Auch das EINZELNE & trennt Befehle (Hintergrund-Verkettung) — vorher
  // wurde bei „dir & del x" nur „dir" eingestuft (Zweit-Audit C-01).
  for (const teil of bereinigt.split(/&&|\|\||[;&|\n]/)) {
    // Reine Text-Ausgaben wie "ExitCode=$LASTEXITCODE" (übliches
    // PowerShell-Anhängsel des Motors) führen nichts aus — außer sie enthalten
    // eine $(…)-Unterausführung oder Backticks, dann zählen sie als Befehl.
    const getrimmt = teil.trim()
    if (/^"[^"`]*"$/.test(getrimmt) && !getrimmt.includes('$(')) continue
    // `for f in <feste Wörter>` führt nichts aus — aber nur ohne
    // $(…)-Unterausführung und Backticks; sonst normal einstufen.
    if (/^for\s+\S+\s+in\s[^$`]*$/i.test(getrimmt)) continue
    if (/^(done|fi|esac)$/i.test(getrimmt)) continue
    // Kommando-Substitution führt Befehle mitten im Argument aus: $(…),
    // Backticks und <(…) machen das ganze Teilstück zu einem unbekannten
    // Befehl (Zweit-Audit C-01) — Rückfrage bzw. unter „darf nur lesen"
    // hartes Nein, statt nur das erste, harmlose Wort einzustufen.
    if (getrimmt.includes('$(') || getrimmt.includes('`') || getrimmt.includes('<(')) {
      namen.push('kommando-substitution')
      continue
    }
    // `cd …` wechselt nur den Arbeitsordner und führt nichts aus (Befund
    // 14.08.2026: Der Motor stellt fast jedem Befehl ein `cd "<Projekt>" &&`
    // voran — das löste hunderte unnötige Rückfragen aus). Nur ohne
    // $(…)-Unterausführung und Backticks überspringen.
    if (/^cd(\s|$)/i.test(getrimmt) && !getrimmt.includes('$(') && !getrimmt.includes('`'))
      continue
    // PowerShell-Zuweisungen (`$edge = "…"`, `$env:X="1"`) führen selbst nichts
    // aus: Ist die rechte Seite nur ein Wert (Text in Anführungszeichen, Zahl
    // oder eine andere Variable), wird das Teilstück übersprungen — steht dort
    // ein Befehl (`$x = Get-Content …`), wird genau der eingestuft.
    let einzustufen = getrimmt
    const zuweisung = getrimmt.match(/^\$\{?[\w:.()-]*\}?\s*=(?![=~])\s*([\s\S]*)$/)
    if (zuweisung && !getrimmt.includes('$(') && !getrimmt.includes('`')) {
      const rechts = zuweisung[1].trim()
      if (/^(?:"[^"]*"|'[^']*'|-?\d[\d.]*|\$\{?[\w:.()-]+\}?|)$/.test(rechts)) continue
      einzustufen = rechts
    }
    const woerter = einzustufen.split(/\s+/)
    while (woerter.length > 0 && GERUEST_VORSILBEN.has(woerter[0].toLowerCase())) woerter.shift()
    // Bash-Umgebungsvorsilben `VAR=wert befehl` setzen die Variable nur für
    // genau diesen Aufruf — eingestuft wird der Befehl dahinter (Zweit-Audit
    // C-03). Gefährliche Variablen (PATH & Co. können den Befehl umleiten,
    // NODE_OPTIONS & Co. Code einschleusen) bleiben stehen und machen das
    // Teilstück zum unbekannten Befehl.
    while (
      woerter.length > 1 &&
      /^[A-Za-z_]\w*=/.test(woerter[0]) &&
      !GEFAEHRLICHE_UMGEBUNG.test(woerter[0])
    )
      woerter.shift()
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

// Datei-Umleitungen (>, >>) schreiben am Schreib-Werkzeug vorbei — die
// Projekt-Grenze (SPEC §7) gilt auch für sie (Zweit-Audit C-02): Zeigt ein
// Umleitungsziel aus dem Projektordner hinaus, wird gefragt. 2>&1 und
// Wegwerf-Ziele (NUL, /dev/null) verändern keine Datei und zählen nicht.
function umleitungsZielAusserhalb(befehl, projektPfad) {
  const text = String(befehl)
    .replace(/\d*>&\d+/g, ' ')
    .replace(/>+\s*(\/dev\/null|nul)\b/gi, ' ')
  for (const treffer of text.matchAll(/>+\s*("[^"]+"|'[^']+'|\S+)/g)) {
    const ziel = treffer[1].replace(/^["']|["']$/g, '')
    if (!liegtImProjekt(ziel, projektPfad)) return ziel
  }
  return null
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

// Bilddateien sind in der Prüfmappe verboten (BAUPLAN 17, hartes Nein — auch
// für Prüf-Blöcke): Prüfungen sind kleine Textdateien und Skripte; Bilder
// blähen die Mappe auf und laden zu pixelgenauen Vergleichen ein.
const BILD_ENDUNG = /\.(png|jpe?g|gif|bmp|webp|svg|ico|tiff?|heic|avif)$/i
const BILD_IM_BEFEHL = /\.(png|jpe?g|gif|bmp|webp|svg|ico|tiff?|heic|avif)\b/i

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
// nurLesenBefehle (Entscheidung Georg, 14.08.2026): Einstellung „auf eigene
// Gefahr" — nur-lesende Blöcke dürfen dann Befehle ausführen wie der Bauer
// (normale Befehls-Einstufung samt Git-Sperre und Rückfragen); die
// Schreib-Werkzeuge bleiben unter der Sperre.
// darfKartenAnlegen (BAUPLAN 25): Das Audit ist nur-lesend für Dateien und
// Befehle, darf aber Karten anlegen — genau karte_anlegen ist dann trotz
// „darf nur lesen" erlaubt (nicht aktualisieren, nicht erledigen).
// Exportiert, damit sich die Einstufung ohne laufenden Motor prüfen lässt.
// darfVorschlagen (BAUPLAN 26): karte_vorschlagen ist nur im Karten-Prüfer
// rückfragefrei — andere Blöcke fragen erst nach dem üblichen Verfahren
// (Feedback Georg, 14.08.2026), damit der Nutzer nicht ungefragt mit
// Vorschlägen unterbrochen wird, ein Bauer mit gutem Grund aber auch nicht
// ins Leere läuft.
export function pruefeWerkzeug(name, eingabe, projektPfad, nurLesen, darfPruefen, lokaleKi = true, nurLesenBefehle = false, darfKartenAnlegen = false, darfVorschlagen = false, darfLaufVorschlag = false, darfZuteilen = false) {
  if (name.startsWith(MENSCH_PRAEFIX)) return { erlaubt: true }
  if (name.startsWith(VORSCHLAG_PRAEFIX)) {
    if (!darfVorschlagen) return { frage: texte.rechteFrage.vorschlag }
    return { erlaubt: true }
  }
  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): nur ein Vorschlag, nie
  // eine Änderung — rückfragefrei nur im Sessionende (Kennzeichen laufVorschlag).
  if (name.startsWith(LAUF_VORSCHLAG_PRAEFIX)) {
    if (!darfLaufVorschlag) return { frage: texte.rechteFrage.laufVorschlag }
    return { erlaubt: true }
  }
  // Karten-Zuteilung (BAUPLAN 29): nur eine Meldung an FlowForge — rückfragefrei
  // nur in Auftragsquellen-Blöcken (Kennzeichen kartenZuteilung).
  if (name.startsWith(ZUTEILUNG_PRAEFIX)) {
    if (!darfZuteilen) return { frage: texte.rechteFrage.kartenZuteilung }
    return { erlaubt: true }
  }
  // Lokale Helfer-KI: erlaubt, außer das Häkchen „lokale KI erlaubt" ist am
  // laufenden Block abgewählt (BAUPLAN 20): dann ist das eine echte Sperre,
  // kein bloßer Hinweis. Rein lesend (im Code erzwungen) ist nur die
  // Recherche samt ihrer Bewertung (recherche_bewerten meldet nur die
  // Trefferquote, BAUPLAN 23 — gerade die nur-lesenden Blöcke recherchieren
  // am meisten). Entwerfen, Bauen und Abnehmen (BAUPLAN 21/22) sind
  // Schreibarbeit und fallen unter „darf nur lesen".
  if (name.startsWith(HELFER_PRAEFIX)) {
    if (!lokaleKi)
      return { gesperrt: texte.rechteFrage.lokaleKiGesperrtFuerAgent, tickerText: texte.ticker.lokaleKiGesperrt }
    if (
      nurLesen &&
      name !== HELFER_PRAEFIX + 'lokal_recherchieren' &&
      name !== HELFER_PRAEFIX + 'recherche_bewerten'
    )
      return { gesperrt: texte.rechteFrage.nurLesenGesperrtFuerAgent, tickerText: texte.ticker.nurLesenGesperrt }
    return { erlaubt: true }
  }
  // App-Werkzeuge des Co-Piloten (BAUPLAN 33): Ausgabe lesen ist frei; die
  // App starten/stoppen ändert keine Projektdatei, greift aber in laufende
  // Prozesse ein — im Reparatur-Modus frei, sonst Rückfrage; einen fremden
  // Port-Besitzer beenden ist unumkehrbar und fragt immer.
  if (name.startsWith(APP_PRAEFIX)) {
    if (name === APP_AUSGABE) return { erlaubt: true }
    if (eingabe.port_freimachen) return { frage: texte.rechteFrage.appPortFreimachen }
    if (nurLesen) return { frage: texte.rechteFrage.appBedienen }
    return { erlaubt: true }
  }
  // Prüfbefehl setzen (BAUPLAN 35): Pflicht-Artefakt des Prüfers — dort frei,
  // sonst Rückfrage. Der Befehl selbst ist im Werkzeug hart validiert (ein
  // Test-Werkzeug, keine Verkettung), denn FlowForge spielt ihn später ohne
  // Rückfrage ab.
  if (name.startsWith(PRUEFBEFEHL_PRAEFIX)) {
    if (!darfPruefen) return { frage: texte.rechteFrage.pruefbefehl }
    return { erlaubt: true }
  }
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
    if (
      nurLesen &&
      name !== KARTEN_NUR_LESEN &&
      !(darfKartenAnlegen && name === KARTEN_ANLEGEN)
    )
      return { gesperrt: texte.rechteFrage.nurLesenGesperrtFuerAgent, tickerText: texte.ticker.nurLesenGesperrt }
    return { erlaubt: true }
  }
  // Unter „darf nur lesen" sind rein lesende Befehle erlaubt (Feedback Georg,
  // 12.08.2026) — alles andere an Befehlen wird ehrlich als Befehl gestoppt,
  // nicht fälschlich als „Schreib-Versuch" gemeldet. Mit der Einstellung
  // nurLesenBefehle (s.o.) fällt der Stopp weg: Der Befehl läuft weiter unten
  // durch die normale Einstufung (Git gesperrt, Unbekanntes fragt).
  if (nurLesen && (name === 'Bash' || name === 'PowerShell') && !nurLesenBefehle) {
    if (befehlNurLesend(String(eingabe.command ?? ''))) return { erlaubt: true }
    return {
      gesperrt: texte.rechteFrage.nurLesenBefehlFuerAgent,
      tickerText: texte.ticker.nurLesenBefehlGesperrt
    }
  }
  if (nurLesen && name !== 'Bash' && name !== 'PowerShell' && !NUR_LESEN_ERLAUBT.has(name))
    return { gesperrt: texte.rechteFrage.nurLesenGesperrtFuerAgent, tickerText: texte.ticker.nurLesenGesperrt }
  if (OHNE_RUECKFRAGE.has(name)) return { erlaubt: true }
  if (SCHREIB_WERKZEUGE.has(name)) {
    const datei = eingabe.file_path ?? eingabe.notebook_path
    if (istVerwaltungsdatei(datei, projektPfad))
      return { gesperrt: texte.rechteFrage.verwaltungGesperrtFuerAgent, tickerText: texte.ticker.verwaltungGesperrt }
    // Bilddateien in der Prüfmappe: hartes Nein — auch für Prüf-Blöcke (BAUPLAN 17).
    if (liegtInPruefmappe(datei, projektPfad) && BILD_ENDUNG.test(String(datei)))
      return { gesperrt: texte.rechteFrage.pruefmappeBildFuerAgent, tickerText: texte.ticker.pruefmappeBildGesperrt }
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
    // Bild in die Prüfmappe kopieren/schreiben: hartes Nein, auch für Prüfer —
    // dieselbe Faustregel wie unten, verschärft um die Bild-Endung im Befehl.
    if (befehlAendertPruefmappe(befehl) && BILD_IM_BEFEHL.test(befehl))
      return { gesperrt: texte.rechteFrage.pruefmappeBildFuerAgent, tickerText: texte.ticker.pruefmappeBildGesperrt }
    if (!darfPruefen && befehlAendertPruefmappe(befehl))
      return { gesperrt: texte.rechteFrage.pruefmappeGesperrtFuerAgent, tickerText: texte.ticker.pruefmappeGesperrt }
    // Umleitungsziel außerhalb des Projektordners: dieselbe Grenze wie bei
    // den Schreib-Werkzeugen — Rückfrage statt stillem Schreiben (C-02).
    const umleitungsZiel = umleitungsZielAusserhalb(befehl, projektPfad)
    if (umleitungsZiel)
      return { frage: texte.rechteFrage.schreibenAusserhalb(umleitungsZiel) }
    if (befehlOhneRueckfrage(befehl)) return { erlaubt: true }
    return { frage: texte.rechteFrage.befehl(befehl) }
  }
  if (name === 'WebFetch' || name === 'WebSearch')
    return { frage: texte.rechteFrage.internet(String(eingabe.url ?? eingabe.query ?? '?')) }
  return { frage: texte.rechteFrage.unbekanntesWerkzeug(name) }
}

// Nachlauf-Chat (BAUPLAN 27): Verändert dieser Werkzeugaufruf den Projektordner?
// Vor der ersten Änderung des Chats legt FlowForge einen Sicherungspunkt an —
// Karten-Werkzeuge zählen nicht (sie sind der Normalweg des nur-lesenden Chats
// und laufen über FlowForges eigene, harte Kartenregeln).
// Exportiert, damit sich die Einstufung ohne laufenden Motor prüfen lässt.
export function chatAenderung(name, eingabe) {
  if (SCHREIB_WERKZEUGE.has(name)) return true
  if (name.startsWith(START_PRAEFIX)) return true
  if (name === 'Bash' || name === 'PowerShell')
    return !befehlNurLesend(String(eingabe?.command ?? ''))
  return false
}

// Co-Pilot in der Projektübersicht (BAUPLAN 33): kein Projekt offen — er
// beantwortet nur Bedienfragen. Sein Arbeitsordner ist der Datenordner, und
// der ist für seine Werkzeuge hart gesperrt (dort liegen die Einstellungen
// samt API-Schlüssel — Read wäre sonst rückfragefrei). Lesen darf er nur
// absolute Pfade außerhalb des Datenordners (die gebündelte SPEC.md); Befehle,
// Schreiben und alles Unbekannte sind gesperrt, Internet fragt wie üblich.
// Exportiert, damit sich die Einstufung ohne laufenden Motor prüfen lässt.
const UEBERSICHT_FREI = new Set(['TodoWrite', 'Task', 'Agent', 'ToolSearch'])
const UEBERSICHT_LESEN = new Set(['Read', 'Glob', 'Grep', 'NotebookRead'])
export function pruefeWerkzeugUebersicht(name, eingabe, datenordner) {
  if (UEBERSICHT_FREI.has(name)) return { erlaubt: true }
  if (UEBERSICHT_LESEN.has(name)) {
    const pfad = eingabe?.file_path ?? eingabe?.path ?? eingabe?.notebook_path ?? ''
    if (!pfad || !path.isAbsolute(String(pfad)))
      return { gesperrt: texte.rechteFrage.datenordnerGesperrtFuerAgent, tickerText: texte.ticker.datenordnerGesperrt }
    if (liegtImProjekt(pfad, datenordner))
      return { gesperrt: texte.rechteFrage.datenordnerGesperrtFuerAgent, tickerText: texte.ticker.datenordnerGesperrt }
    return { erlaubt: true }
  }
  if (name === 'WebFetch' || name === 'WebSearch')
    return { frage: texte.rechteFrage.internet(String(eingabe?.url ?? eingabe?.query ?? '?')) }
  return { gesperrt: texte.rechteFrage.uebersichtGesperrtFuerAgent, tickerText: texte.ticker.uebersichtGesperrt }
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

// Das Werkzeug-Ergebnis des Agent-Aufrufs trägt hinter dem Fazit noch
// Metadaten der CLI (agentId-Zeile, usage-Block) — die gehören nicht in
// Übergaben und Laufberichte. Gestutzt wird nur, wenn vor der agentId-Marke
// wirklich Text steht (Zweit-Audit C-04): Ein Fazit, das zufällig mit
// „agentId:" beginnt, bleibt unverändert, statt still auf leer zu schrumpfen.
// Exportiert, damit sich das Stutzen ohne laufenden Motor prüfen lässt.
export function fazitStutzen(text) {
  let t = String(text)
  const marke = t.lastIndexOf('\nagentId:')
  if (marke > 0) t = t.slice(0, marke)
  return t.replace(/<usage>[\s\S]*?<\/usage>\s*$/, '').trim()
}

// Übersetzt eine SDK-Nachricht in Klartext-Zeilen für den Liveticker.
// Seit BAUPLAN 19 laufen die Blöcke selbst als Agenten: Zeilen des
// Block-Agenten (parent in blockTaskIds) sind normale Ticker-Zeilen; nur
// Zeilen seiner tieferen Wegwerf-Helfer tragen den Unteraufgaben-Vorsatz.
// Der Hauptfaden ist der Koordinator — sein Geplauder („OK") bleibt draußen,
// sein Agent-Aufruf wird vom Hook gemeldet.
// mitHauptfaden (BAUPLAN 27): Im Nachlauf-Chat arbeitet der Hauptfaden selbst —
// seine Werkzeug-Zeilen gehören in den Ticker; sein Antworttext ist die
// Chat-Antwort und bleibt draußen.
function tickerZeilen(nachricht, projektPfad, blockTaskIds, mitHauptfaden = false) {
  const t = texte.ticker
  // Überlastete KI-Server: die CLI wiederholt selbst — ohne diese Zeile sähe
  // Georg nur eine stumme App.
  if (nachricht.type === 'system' && nachricht.subtype === 'api_retry')
    return [t.motorWartet(nachricht.attempt ?? '?', nachricht.max_retries ?? '?')]
  if (nachricht.type !== 'assistant') return []
  const hauptfaden = !nachricht.parent_tool_use_id
  const zeilen = []
  for (const block of nachricht.message?.content ?? []) {
    if (hauptfaden && !mitHauptfaden) continue
    if (block.type === 'text' && block.text?.trim() && !hauptfaden)
      zeilen.push(block.text.trim())
    if (block.type !== 'tool_use') continue
    if (block.name === 'ToolSearch') continue
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
    // App-Werkzeuge des Co-Piloten (BAUPLAN 33) melden ihr Ergebnis selbst.
    if (block.name.startsWith(APP_PRAEFIX)) continue
    // Karten-Vorschläge melden sich aus der Lauf-Verwaltung heraus
    // (Vorschlag + Entscheidung stehen im Ticker) — keine doppelte Zeile.
    if (block.name.startsWith(VORSCHLAG_PRAEFIX)) continue
    // Die lokale Helfer-KI meldet Start, Schritte und Fazit selbst.
    if (block.name.startsWith(HELFER_PRAEFIX)) continue
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
      case 'Agent':
        // Das Ziel der Unteraufgabe sichtbar machen (BAUPLAN 25) — so sind
        // z.B. die drei Blickwinkel-Prüfer des Audits im Ticker erkennbar.
        zeilen.push(
          e.description ? t.unteraufgabeMitZiel(kuerzen(e.description, 80)) : t.unteraufgabe
        )
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
  const vomBlockAgenten = Boolean(blockTaskIds?.has(nachricht.parent_tool_use_id))
  return !hauptfaden && !vomBlockAgenten ? zeilen.map((z) => t.unteraufgabeZeile(z)) : zeilen
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

// Eine Motor-Session pro Lauf (BAUPLAN 19): Die Session bleibt über den ganzen
// Lauf offen. Auf dem Hauptfaden sitzt ein Koordinator, der selbst nichts
// erledigt — je Block startet er genau einen frischen Agenten (Unteraufgabe).
// Den echten Arbeitsauftrag setzt FlowForge beim Agent-Aufruf selbst ein
// (PreToolUse-Hook, updatedInput): Der Koordinator sieht ihn nie, bleibt
// schlank und kann nichts verfälschen. Das Fazit des Agenten liest FlowForge
// direkt aus dem Werkzeug-Ergebnis des Agent-Aufrufs — nicht aus dem
// Koordinator-Text, der z.B. die Urteils-Marke des Prüfers verschlucken könnte.
// Die harten Sperren gelten pro Aufrufer: Werkzeugaufrufe mit agent_id gehören
// dem gerade laufenden Block-Agenten (oder seinen Helfern) und unterliegen
// dessen Regeln; der Koordinator selbst darf ausschließlich delegieren.
export function starteLaufMotor(optionen) {
  const {
    projektPfad,
    modus,
    apiSchluessel,
    ausgabenObergrenzeUsd,
    // Wiederaufnahme (BAUPLAN 16/19): Kennung der Lauf-Session eines
    // unterbrochenen Laufs — sie wird fortgesetzt statt neu gestartet.
    fortsetzen = null,
    // Die echte Fenstergröße meldet der Motor erst am Session-Ende — ein
    // Vorwissen aus früheren Sessions macht die Übertrags-Schwelle von
    // Anfang an richtig.
    kontextFenster = KONTEXT_FENSTER_STANDARD,
    // Lokale Helfer-KI (Experiment): { modell } — nur gesetzt, wenn der
    // Schalter an ist UND Ollama beim Laufstart erreichbar war.
    lokaleHelfer = null,
    // Einstellung „Befehle trotz nur-lesen" (Entscheidung Georg, 14.08.2026).
    nurLesenBefehle = false,
    aufEreignis,
    aufRechteFrage,
    aufMenschFrage,
    // Karten-Vorschläge (BAUPLAN 26): löst mit der Entscheidung des Nutzers
    // auf — oder mit null, wenn der Lauf angehalten wurde.
    aufKartenVorschlag,
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): speichert den
    // Vorschlag des Sessionendes — kein Warten, nur eine Meldung.
    aufLaufVorschlag,
    // Karten-Zuteilung (BAUPLAN 29): merkt sich, welche Karten die
    // nachfolgenden Blöcke bekommen — kein Warten, nur eine Meldung.
    aufKartenZuteilung,
    // Paket melden (BAUPLAN 30): die Aufgaben-Karten des Pakets — kein Warten.
    aufPaketMeldung = null,
    // Herkunft (BAUPLAN 30): holeHerkunft(instanzId) liefert Block · Lauf ·
    // Paket-Aufgaben für den Karten-Stempel des gerade laufenden Blocks.
    holeHerkunft = null
  } = optionen

  let kindProzess = null
  let sanftAngefordert = false
  let hartAngefordert = false
  // Tot = die Session nimmt keine Blöcke mehr an (Prozess beendet, Fehler,
  // beenden()). Die Lauf-Verwaltung startet dann bei Bedarf einen neuen Motor,
  // der die Session über ihre Kennung fortsetzt.
  let tot = false
  let stderrPuffer = ''
  let abfrage = null
  const abbruch = new AbortController()

  // Session-Kennung der Lauf-Session — jede SDK-Nachricht trägt sie.
  let sessionKennung = null
  // Die CLI meldet init bei jedem Turn erneut — getickert wird nur der erste.
  let initGemeldet = false
  // Kam überhaupt eine Nachricht an? Scheitert ein Fortsetzen-Versuch schon
  // beim Start (Kennung ungültig, Session weg), bleibt das false.
  let nachrichtEmpfangen = false

  // Die Eingabe ist eine offene Warteschlange: FlowForge reicht Block für
  // Block als Nachricht nach — die Session bleibt offen, bis beenden() sie
  // schließt. Auch Unterbrechungs-Anweisungen (Übertrag) kommen hier herein.
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

  // Kumulierte Stände der Lauf-Session — daraus rechnet der Motor die
  // ehrlichen Block-Anteile (Zuwachs des Hauptfadens, Kosten- und
  // Aufschlüsselungs-Deltas), damit kein Block die Historie der ganzen
  // Session mitzählt.
  let hauptTokens = 0
  let bekanntesFenster = kontextFenster > 0 ? kontextFenster : KONTEXT_FENSTER_STANDARD
  let kostenStand = null
  const aufschlStand = { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
  // Modell je Block (BAUPLAN 36): Die CLI meldet modelUsage als kumulierte
  // Stände des Prozesses, je Modellkennung. Gemerkt wird der Stand je Modell,
  // damit jeder Block nur seinen eigenen Zuwachs zugeschrieben bekommt — bei
  // Mischung (Block-Agent und Unteraufgabe auf verschiedenen Modellen) als
  // Anteile. Stände gehören zum Motor: Ein neuer Motor (paralleler Zweig,
  // frische Session nach Übertrag) fängt ehrlich wieder bei null an.
  const modellStand = new Map()

  // Der gerade laufende Block-Dispatch — es läuft höchstens einer zugleich.
  // Parallele Zweige bekommen eigene Motoren (lauf.js).
  let block = null

  function unterSumme() {
    return block ? [...block.unterVerbrauch.values()].reduce((a, b) => a + b, 0) : 0
  }

  // Füllstand des gerade arbeitenden Block-Agenten (BAUPLAN 36): sein eigener
  // kumulierter Stand — NICHT die Summe seiner Helfer (die tragen ihren
  // eigenen Kontext). Steuert nichts, ist nur Hinweis neben dem
  // Koordinator-Balken; der Übertrag misst weiter die Lauf-Session.
  function agentTokens() {
    if (!block) return 0
    let groesster = 0
    for (const id of block.blockTaskIds)
      groesster = Math.max(groesster, block.unterVerbrauch.get(id) ?? 0)
    return groesster
  }

  // Anteile je Modell an diesem Block, größter zuerst.
  function modellAnteile() {
    if (!block?.modellTokens?.size) return null
    const summe = [...block.modellTokens.values()].reduce((a, b) => a + b, 0)
    if (summe <= 0) return null
    return [...block.modellTokens]
      .map(([modell, tokens]) => ({ modell, tokens, anteil: tokens / summe }))
      .sort((a, b) => b.tokens - a.tokens)
  }

  function blockVerbrauch() {
    const band = kontextBand(hauptTokens, bekanntesFenster)
    return {
      // Füllstand der Lauf-Session (Hauptfaden = Koordinator) — steuert den Übertrag.
      tokens: hauptTokens,
      // Zuwachs des Hauptfadens in diesem Block — für die ehrliche Block-Zählung.
      blockZuwachs: block ? Math.max(0, hauptTokens - block.startTokens) : 0,
      // Verbrauch der Agenten dieses Blocks (Block-Agent + seine Helfer):
      // zählt zum ehrlichen Verbrauch, aber nicht zum Füllstand.
      unterTokens: unterSumme(),
      kontextProzentVon: band.von,
      kontextProzentBis: band.bis,
      kostenUsd: block?.kosten ?? null,
      aufschluesselung: block?.aufschluesselung ?? null,
      kontextFenster: bekanntesFenster,
      uebertragBand: block?.uebertragBand ?? null,
      // Modell je Block und Füllstand des Block-Agenten (BAUPLAN 36).
      modelle: modellAnteile(),
      ...(() => {
        const eigene = agentTokens()
        if (!eigene) return { agentTokens: 0, agentProzentVon: null, agentProzentBis: null }
        const agentBand = kontextBand(eigene, bekanntesFenster)
        return { agentTokens: eigene, agentProzentVon: agentBand.von, agentProzentBis: agentBand.bis }
      })()
    }
  }

  function verbrauchMelden() {
    aufEreignis({ art: 'verbrauch', verbrauch: blockVerbrauch() })
  }

  // Löst den laufenden Block-Dispatch mit einem endgültigen Ergebnis auf.
  function blockAufloesen(zustand, extra = {}) {
    if (!block) return
    const verbrauch = blockVerbrauch()
    const b = block
    block = null
    b.aufloesen({
      zustand,
      fehlertext: '',
      fehlerArt: null,
      ergebnisText: '',
      verbrauch,
      sessionKennung,
      ...extra
    })
  }

  // Harte Sperren pro Aufrufer (BAUPLAN 19), durchgesetzt VOR jedem
  // Werkzeugaufruf — auch für Werkzeuge, die nie eine Rechte-Frage auslösen
  // würden (der Agent-Aufruf selbst). Rückfrage-Fälle entscheidet weiterhin
  // canUseTool, denn dort darf die Frage an den Nutzer beliebig lange warten.
  async function vorWerkzeug(hookDaten) {
    const name = hookDaten.tool_name
    const eingabeDaten =
      hookDaten.tool_input && typeof hookDaten.tool_input === 'object' ? hookDaten.tool_input : {}
    const nein = (grund, tickerText) => {
      if (tickerText) aufEreignis({ art: 'ticker', text: tickerText })
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: grund
        }
      }
    }
    // Hauptfaden = Koordinator: engste Rechte — er darf nur delegieren.
    if (!hookDaten.agent_id) {
      if (name === 'Agent' || name === 'Task') {
        if (!block || block.auftragEingesetzt) return nein(texte.agentenLaufSession.nurEinAgent)
        block.auftragEingesetzt = true
        block.blockTaskIds.add(hookDaten.tool_use_id)
        aufEreignis({ art: 'ticker', text: texte.ticker.blockAgentGestartet(block.blockName) })
        // Der echte Arbeitsauftrag wird hier eingesetzt — der Koordinator
        // hat nur das Wort AUFTRAG geschrieben und bleibt schlank.
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            updatedInput: {
              description: block.blockName,
              subagent_type: 'block',
              run_in_background: false,
              prompt: block.auftrag
            }
          }
        }
      }
      return nein(texte.agentenLaufSession.koordinatorGesperrt, texte.ticker.koordinatorGestoppt)
    }
    // Aufruf aus dem Block-Agenten oder seinen Helfern: Es gelten die Sperren
    // des gerade laufenden Blocks (ohne laufenden Block: strengste Auslegung).
    const urteil = pruefeWerkzeug(
      name,
      eingabeDaten,
      projektPfad,
      block?.nurLesen ?? true,
      block?.darfPruefen ?? false,
      block?.lokaleKi ?? true,
      nurLesenBefehle,
      block?.darfKartenAnlegen ?? false,
      block?.darfVorschlagen ?? false,
      block?.darfLaufVorschlag ?? false,
      block?.darfZuteilen ?? false
    )
    if (urteil.gesperrt) return nein(urteil.gesperrt, urteil.tickerText)
    if (urteil.erlaubt)
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }
    return {}
  }

  const schleife = (async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    // Agent-Karten-Brücke (BAUPLAN 7): Karten lesen/schreiben mit denselben
    // harten Regeln wie für Menschen — läuft im FlowForge-Prozess selbst.
    const kartenServer = await kartenWerkzeugServer({
      projektPfad,
      aufEreignis,
      // Herkunft (BAUPLAN 30): der Karten-Server stempelt mit dem gerade
      // laufenden Block — der Motor reicht dessen Instanz-Kennung hinein.
      holeHerkunft: holeHerkunft ? () => holeHerkunft(block?.instanzId ?? null) : null
    })
    // Frage an den Menschen (BAUPLAN 9): pausiert den Lauf, bis der Nutzer
    // im Gespräch geantwortet hat.
    const menschServer = await menschWerkzeugServer({ aufMenschFrage })
    // Startanleitung (BAUPLAN 10): das Pflicht-Artefakt der Bau-Blöcke wird
    // ausschließlich über dieses validierende Werkzeug geschrieben.
    const startServer = await startWerkzeugServer({ projektPfad, aufEreignis })
    // Prüfbefehl (BAUPLAN 35): das Pflicht-Artefakt des Prüfers — hart
    // validiert, weil FlowForge ihn später selbst ohne Rückfrage abspielt.
    const pruefbefehlServer = await pruefbefehlWerkzeugServer({ projektPfad, aufEreignis })
    // Karten-Vorschläge (BAUPLAN 26): der Abnahme-Dialog des Karten-Prüfers —
    // freigeschaltet nur für Blöcke mit kartenVorschlaege (pruefeWerkzeug).
    const vorschlagServer = aufKartenVorschlag
      ? await vorschlagWerkzeugServer({ projektPfad, aufKartenVorschlag })
      : null
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): das Werkzeug des
    // Sessionendes — freigeschaltet nur für Blöcke mit laufVorschlag.
    const laufVorschlagServer = aufLaufVorschlag
      ? await laufVorschlagWerkzeugServer({ projektPfad, aufLaufVorschlag })
      : null
    // Karten-Zuteilung (BAUPLAN 29): das Werkzeug der Auftragsquellen-Blöcke —
    // freigeschaltet nur für Blöcke mit kartenZuteilung. Die Zuteilung braucht
    // den rufenden Block: Der Motor reicht dessen Instanz-Kennung mit hinein.
    const zuteilungServer = aufKartenZuteilung
      ? await kartenZuteilungWerkzeugServer({
          aufKartenZuteilung: (daten) =>
            aufKartenZuteilung({ ...daten, instanzId: block?.instanzId ?? null }),
          // Paket melden (BAUPLAN 30): derselbe Server, dieselbe Freischaltung.
          aufPaketMeldung: aufPaketMeldung
            ? (daten) => aufPaketMeldung({ ...daten, instanzId: block?.instanzId ?? null })
            : null
        })
      : null
    // Lokale Helfer-KI (Experiment): nur registriert, wenn beim Laufstart
    // bestätigt war, dass Ollama läuft und das Modell da ist.
    const helferServer = lokaleHelfer
      ? await helferWerkzeugServer({
          projektPfad,
          modell: lokaleHelfer.modell,
          adresse: lokaleHelfer.adresse,
          // Trefferquote (BAUPLAN 23): recherche_bewerten nur, wenn der
          // Schalter an ist — sonst kein Werkzeug, kein Mehrverbrauch.
          bewerten: Boolean(lokaleHelfer.bewerten),
          // Projektwissen (BAUPLAN 25): die Kartenauswahl des Laufs wird jedem
          // lokalen Auftrag vorangestellt — je Aufruf frisch gelesen. Seit der
          // Karten-Zuteilung (BAUPLAN 29) block-bezogen: Der Motor reicht die
          // Instanz-Kennung des gerade laufenden Blocks mit hinein.
          holeProjektwissen: lokaleHelfer.projektwissen
            ? () => lokaleHelfer.projektwissen(block?.instanzId)
            : null,
          aufEreignis
        })
      : null

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
        // Wiederaufnahme: dieselbe Lauf-Session weiterführen — der
        // Koordinator kennt die bisherigen Blöcke und Fazite noch.
        ...(fortsetzen ? { resume: fortsetzen } : {}),
        // Denk-Ansicht (BAUPLAN 24): Ohne diese Option kämen von den
        // Block-Agenten nur Werkzeug-Blöcke an — ihr Denken bliebe unsichtbar.
        // Die Option leitet nur weiter, was ohnehin entsteht: kein Denk-Budget,
        // kein Mehrverbrauch, das Denkverhalten des Motors bleibt Standard.
        forwardSubagentText: true,
        mcpServers: {
          karten: kartenServer,
          mensch: menschServer,
          start: startServer,
          pruefbefehl: pruefbefehlServer,
          ...(vorschlagServer ? { vorschlaege: vorschlagServer } : {}),
          ...(laufVorschlagServer ? { naechsterlauf: laufVorschlagServer } : {}),
          ...(zuteilungServer ? { zuteilung: zuteilungServer } : {}),
          ...(helferServer ? { helfer: helferServer } : {})
        },
        // Der Hauptfaden ist der Koordinator: schlanker eigener Systemtext
        // statt des vollen Werkzeug-Vorspanns — er arbeitet ja nicht selbst.
        systemPrompt: texte.agentenLaufSession.koordinatorSystem,
        // Jeder Block läuft als frischer Agent dieses Typs (BAUPLAN 19).
        // Sein Systemtext trägt die Projekt-Grundregeln (Windows-Pfade,
        // Karten-Werkzeuge) — den Arbeitsauftrag setzt der Hook ein. Steht
        // die lokale Helfer-KI bereit, wird sie dort angeboten (Experiment).
        agents: {
          block: {
            description: 'Führt genau einen Block-Arbeitsauftrag von FlowForge aus.',
            prompt:
              texte.agentenLaufSession.blockAgentSystem(projektPfad, TITEL_MAX, TEXT_MAX) +
              (helferServer
                ? '\n' +
                  texte.agentenLokaleHelfer.systemZusatz +
                  (lokaleHelfer.bewerten ? texte.agentenLokaleHelfer.bewertenSystemZusatz : '')
                : ''),
            maxTurns: 300
          }
        },
        // Eine Session für den ganzen Lauf: Die Koordinator-Runden aller
        // Blöcke zählen zusammen — die echte Grenze ist das Kontextfenster.
        maxTurns: 1000,
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
          // Prozess-Hygiene (BAUPLAN 32): der Motor-Prozess ist eine Wurzel —
          // alles, was der Agent daraus startet, gehört zum Lauf.
          if (kindProzess.pid) prozessWurzelMelden('lauf:' + projektPfad, projektPfad, kindProzess.pid)
          return kindProzess
        },
        // Harte Sperren pro Aufrufer — vor jedem Werkzeugaufruf, auch dem
        // Agent-Aufruf des Koordinators (der nie bei canUseTool ankommt).
        hooks: { PreToolUse: [{ hooks: [vorWerkzeug] }] },
        canUseTool: async (name, eingabeDaten, kontext) => {
          // Der Koordinator landet hier nur, wenn der Hook nichts entschieden
          // hat — sicherheitshalber dieselbe harte Linie.
          if (!kontext?.agentID)
            return { behavior: 'deny', message: texte.agentenLaufSession.koordinatorGesperrt }
          const urteil = pruefeWerkzeug(
            name,
            eingabeDaten ?? {},
            projektPfad,
            block?.nurLesen ?? true,
            block?.darfPruefen ?? false,
            block?.lokaleKi ?? true,
            nurLesenBefehle,
            block?.darfKartenAnlegen ?? false,
            block?.darfVorschlagen ?? false,
            block?.darfLaufVorschlag ?? false,
            block?.darfZuteilen ?? false
          )
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

    // Verarbeitet ein endgültiges Turn-Ergebnis für den laufenden Block.
    function blockErgebnisVerarbeiten(nachricht) {
      if (!block) return
      aufEreignis({
        art: 'ticker',
        text: texte.ticker.fertigIn(Math.round((Date.now() - block.startZeit) / 1000))
      })
      if (hartAngefordert) return blockAufloesen('hart-abgebrochen')
      if (sanftAngefordert)
        return blockAufloesen('sanft-gestoppt', { ergebnisText: block.fazit ?? '' })
      // Achtung: subtype 'success' heißt nur „sauber durchgelaufen" — Fehler
      // wie eine fehlende Anmeldung kommen trotzdem mit is_error zurück.
      if (nachricht.subtype === 'success' && !nachricht.is_error) {
        // Das Ergebnis des Blocks ist das Fazit des Block-Agenten — nicht der
        // Koordinator-Text, der z.B. die Prüfer-Urteils-Marke verlieren könnte.
        if (block.fazit) return blockAufloesen('erfolgreich', { ergebnisText: block.fazit })
        return blockAufloesen('fehlgeschlagen', {
          fehlertext: block.agentFehler
            ? kuerzen(block.agentFehler, 400)
            : texte.lauf.blockOhneFazit
        })
      }
      const { fehlertext, fehlerArt } = fehlerAusErgebnis(nachricht, stderrPuffer)
      // Fortsetzen-Versuch, den die CLI mit „Session nicht gefunden" ablehnt
      // (real beobachtet: „No conversation found with session ID: …"): kein
      // echter Fehler des Blocks — still auf frische Session zurück. Echte
      // Fehler mit Einstufung (Kontingent, Anmeldung …) bleiben, was sie sind.
      if (
        fortsetzen &&
        fehlerArt === null &&
        /no conversation|session id|session.*not found|(could not|cannot|unable to) resume/i.test(
          fehlertext
        )
      ) {
        tot = true
        eingabeSchliessen()
        return blockAufloesen('fortsetzung-gescheitert', { sessionKennung: null })
      }
      blockAufloesen('fehlgeschlagen', { fehlertext, fehlerArt })
    }

    try {
      for await (const nachricht of abfrage) {
        nachrichtEmpfangen = true
        if (typeof nachricht.session_id === 'string' && nachricht.session_id)
          sessionKennung = nachricht.session_id
        for (const zeile of tickerZeilen(nachricht, projektPfad, block?.blockTaskIds))
          aufEreignis({ art: 'ticker', text: zeile })

        // Denk-Ansicht (BAUPLAN 24): die Denk-Blöcke der Assistent-Nachrichten
        // wandern als Absätze in den Denk-Bereich des Lauf-Tabs — je Absatz mit
        // Absender (Blockname, Unteraufgabe oder Koordinator). Nur live, nie im
        // Laufbericht. redacted_thinking ist verschlüsselt und bleibt draußen.
        if (nachricht.type === 'assistant') {
          for (const teil of nachricht.message?.content ?? []) {
            if (teil?.type !== 'thinking' || !String(teil.thinking ?? '').trim()) continue
            const absender = !nachricht.parent_tool_use_id
              ? texte.lauf.denkenKoordinator
              : block?.blockTaskIds.has(nachricht.parent_tool_use_id)
                ? block.blockName
                : texte.lauf.denkenUnteraufgabe
            aufEreignis({ art: 'denken', absender, text: String(teil.thinking).trim() })
          }
        }

        // Compaction sichtbar (BAUPLAN 36): Fasst der Motor sein Arbeits-
        // gedächtnis zusammen, meldet das SDK eine compact_boundary. Kein
        // Fehler, aber ein wichtiges Ereignis — es erklärt, warum ein Agent
        // plötzlich weniger gefüllt ist und Details vergessen haben kann.
        // Wer zusammengefasst wurde, sagt die Herkunft der Nachricht: der
        // Block-Agent (Unteraufgaben-Kennung) oder der Koordinator.
        if (nachricht.type === 'system' && nachricht.subtype === 'compact_boundary') {
          const daten = nachricht.compact_metadata ?? {}
          const wer = !nachricht.parent_tool_use_id
            ? texte.lauf.denkenKoordinator
            : block?.blockTaskIds.has(nachricht.parent_tool_use_id)
              ? block.blockName
              : texte.lauf.denkenUnteraufgabe
          aufEreignis({
            art: 'zusammenfassung',
            wer,
            istKoordinator: !nachricht.parent_tool_use_id,
            automatisch: daten.trigger !== 'manual',
            vorher: Number.isFinite(daten.pre_tokens) ? daten.pre_tokens : null,
            nachher: Number.isFinite(daten.post_tokens) ? daten.post_tokens : null
          })
        }

        if (nachricht.type === 'system' && nachricht.subtype === 'init') {
          // Der Motor startet einmal pro Lauf — sichtbar im Ticker (BAUPLAN 19).
          // Die CLI meldet init bei JEDEM Turn erneut (gleiche Session-Kennung,
          // real erprobt) — gemeldet wird nur der erste.
          if (!initGemeldet) {
            initGemeldet = true
            aufEreignis({
              art: 'ticker',
              text: fortsetzen
                ? texte.ticker.laufSessionFortgesetzt
                : texte.ticker.laufSessionGestartet(nachricht.model ?? 'Claude')
            })
          }
          // Kontextfenster ab der Startmeldung (Befund Georg, 13.08.2026):
          // das Motor-Wissen liefert die gemerkte bzw. an der Modellkennung
          // erkennbare Größe. Vorwissen aus früheren Sessions geht vor.
          if (kontextFenster === KONTEXT_FENSTER_STANDARD) {
            const bekannt = kontextFensterFuerModell(nachricht.model)
            if (bekannt > 0) {
              bekanntesFenster = bekannt
              verbrauchMelden()
            }
          }
        }

        // Fazit des Block-Agenten: das Werkzeug-Ergebnis seines Agent-Aufrufs
        // auf dem Hauptfaden — die verlässliche Quelle für den Abschlusstext.
        if (
          nachricht.type === 'user' &&
          !nachricht.parent_tool_use_id &&
          block &&
          Array.isArray(nachricht.message?.content)
        ) {
          for (const teil of nachricht.message.content) {
            if (teil?.type !== 'tool_result' || !block.blockTaskIds.has(teil.tool_use_id)) continue
            const text = Array.isArray(teil.content)
              ? teil.content
                  .filter((c) => c?.type === 'text')
                  .map((c) => c.text)
                  .join('\n')
              : typeof teil.content === 'string'
                ? teil.content
                : ''
            if (teil.is_error) block.agentFehler = text
            else block.fazit = fazitStutzen(text)
          }
        }

        if (nachricht.type === 'assistant' && nachricht.message?.usage) {
          const u = nachricht.message.usage
          const kumuliert =
            (u.input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0) +
            (u.output_tokens ?? 0)
          // Nachrichten aus Agenten tragen den Füllstand des jeweiligen
          // Helfers, nicht der Lauf-Session — sie dürfen die Übertrags-
          // Schwelle nicht verfälschen. Ihr Verbrauch wird je Block getrennt
          // aufsummiert: je Agent der letzte kumulierte Stand.
          if (nachricht.parent_tool_use_id) {
            if (block) {
              block.unterVerbrauch.set(nachricht.parent_tool_use_id, kumuliert)
              verbrauchMelden()
            }
          } else {
            hauptTokens = kumuliert
            verbrauchMelden()
          }

          // Übertrags-Schwelle (SPEC §5): Läuft die Lauf-Session voll, wird
          // unterbrochen und der Koordinator zur Übergabe aufgefordert.
          // Der Koordinator wächst langsam (nur Aufträge und Fazite) — echte
          // Überträge sind selten. Im Testmodus zählt deshalb der Verbrauch
          // der Block-Agenten mit, damit der Übertrag vorführbar bleibt.
          if (
            block?.uebertrag.aktiv &&
            block.uebertragPhase === null &&
            !sanftAngefordert &&
            !hartAngefordert
          ) {
            const fenster = bekanntesFenster || KONTEXT_FENSTER_STANDARD
            const messTokens = block.uebertrag.testModus
              ? hauptTokens + unterSumme()
              : hauptTokens
            const prozent = (messTokens / fenster) * 100
            if (block.startProzent === null) block.startProzent = prozent
            const schwelle = block.uebertrag.testModus
              ? Math.min(block.startProzent + UEBERTRAG_TEST_AUFSCHLAG_PUNKTE, UEBERTRAG_SCHWELLE_PROZENT)
              : UEBERTRAG_SCHWELLE_PROZENT
            if (prozent >= schwelle) {
              block.uebertragPhase = 'angefordert'
              const band = kontextBand(messTokens, fenster)
              block.uebertragBand = { von: band.von, bis: band.bis }
              aufEreignis({
                art: 'ticker',
                text: texte.ticker.uebertragAngefordert(band.von, band.bis)
              })
              abfrage?.interrupt().catch(() => {})
            }
          }
        }

        if (nachricht.type === 'result') {
          // Kosten und Aufschlüsselung meldet die CLI als kumulierte Stände
          // des Prozesses — gezählt wird der Zuwachs dieses Blocks.
          if (typeof nachricht.total_cost_usd === 'number') {
            const delta =
              kostenStand === null
                ? nachricht.total_cost_usd
                : Math.max(0, nachricht.total_cost_usd - kostenStand)
            kostenStand = nachricht.total_cost_usd
            if (block && delta > 0) block.kosten = (block.kosten ?? 0) + delta
          }
          const summe = { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
          let hatModelUsage = false
          for (const [modell, m] of Object.entries(nachricht.modelUsage ?? {})) {
            hatModelUsage = true
            if (m.contextWindow > 0) {
              bekanntesFenster = m.contextWindow
              kontextFensterMerken(modell, m.contextWindow)
            }
            summe.eingabe += m.inputTokens ?? 0
            summe.ausgabe += m.outputTokens ?? 0
            summe.cacheLesen += m.cacheReadInputTokens ?? 0
            summe.cacheSchreiben += m.cacheCreationInputTokens ?? 0
            // Modell je Block (BAUPLAN 36): Zuwachs dieses Modells seit dem
            // letzten Stand — gemessen an allen Tokens (Eingabe, Ausgabe,
            // Cache), damit die Anteile zur Verbrauchszeile des Blocks passen.
            const stand =
              (m.inputTokens ?? 0) +
              (m.outputTokens ?? 0) +
              (m.cacheReadInputTokens ?? 0) +
              (m.cacheCreationInputTokens ?? 0)
            const zuwachs = Math.max(0, stand - (modellStand.get(modell) ?? 0))
            modellStand.set(modell, stand)
            if (block && zuwachs > 0) {
              block.modellTokens ??= new Map()
              block.modellTokens.set(modell, (block.modellTokens.get(modell) ?? 0) + zuwachs)
            }
          }
          if (hatModelUsage) {
            if (block) {
              block.aufschluesselung ??= { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
              for (const feld of ['eingabe', 'ausgabe', 'cacheLesen', 'cacheSchreiben'])
                block.aufschluesselung[feld] += Math.max(0, summe[feld] - aufschlStand[feld])
            }
            for (const feld of ['eingabe', 'ausgabe', 'cacheLesen', 'cacheSchreiben'])
              aufschlStand[feld] = summe[feld]
          }
          verbrauchMelden()

          if (!block) continue
          if (block.uebertragPhase === 'angefordert' && !sanftAngefordert && !hartAngefordert) {
            if (nachricht.subtype === 'success' && !nachricht.is_error && block.fazit) {
              // Wettlauf: Der Block war beim Erreichen der Schwelle ohnehin
              // fertig — dann ist das ein normales Ende, kein Übertrag.
              block.uebertragPhase = null
              blockErgebnisVerarbeiten(nachricht)
            } else {
              // Das ist das Ende des unterbrochenen Turns — jetzt bekommt
              // dieselbe Session die Übergabe-Anweisung an den Koordinator.
              block.uebertragPhase = 'uebergabe'
              eingabeNachschieben(block.uebertrag.anweisung)
            }
          } else if (block.uebertragPhase === 'uebergabe' && !sanftAngefordert && !hartAngefordert) {
            // Übertrag (SPEC §5): der Antworttext ist die Übergabe an den
            // nächsten Anlauf — die Lauf-Session ist danach verbraucht.
            block.uebertragPhase = 'fertig'
            tot = true
            eingabeSchliessen()
            blockAufloesen('uebertrag', {
              ergebnisText: typeof nachricht.result === 'string' ? nachricht.result : ''
            })
          } else {
            blockErgebnisVerarbeiten(nachricht)
          }
        }
      }
    } catch (fehler) {
      // Nach einem harten Abbruch ist ein Prozessfehler erwartet — kein echter Fehler.
      if (!hartAngefordert && block) {
        if (sanftAngefordert) blockAufloesen('sanft-gestoppt', { ergebnisText: '' })
        // Stirbt die Session mitten im Übertrag, geht nur die Übergabe
        // verloren — der nächste Anlauf liest den Stand selbst aus Ordner
        // und Karten.
        else if (block.uebertragPhase) blockAufloesen('uebertrag', { ergebnisText: '' })
        // Fortsetzen-Versuch, der schon vor der ersten Nachricht stirbt: die
        // alte Session ist nicht wiederaufnehmbar — still auf frisch zurück.
        else if (fortsetzen && !nachrichtEmpfangen)
          blockAufloesen('fortsetzung-gescheitert', { sessionKennung: null })
        else {
          const { fehlertext, fehlerArt } = fehlerAusErgebnis(
            null,
            stderrPuffer || String(fehler?.message ?? '')
          )
          blockAufloesen('fehlgeschlagen', { fehlertext, fehlerArt })
        }
      }
    } finally {
      tot = true
      eingabeSchliessen()
      // Ein noch offener Block darf nie ewig hängen — z.B. wenn der Prozess
      // nach einem harten Abbruch oder still von selbst endet.
      if (block) {
        if (hartAngefordert) blockAufloesen('hart-abgebrochen')
        else if (sanftAngefordert) blockAufloesen('sanft-gestoppt', { ergebnisText: '' })
        else blockAufloesen('fehlgeschlagen', { fehlertext: texte.fehler.unbekannt })
      }
    }
  })()
  // Fehler der Schleife selbst (z.B. beim Start) landen im offenen Block —
  // unbeobachtete Ablehnungen soll es nie geben.
  schleife.catch(() => {})

  return {
    // Führt genau einen Block in der Lauf-Session aus: Der Koordinator
    // bekommt den Dispatch, startet den Block-Agenten (der Hook setzt den
    // Auftrag ein), und das Fazit kommt als Ergebnis zurück.
    // lokaleKi (BAUPLAN 20): false = Häkchen „lokale KI erlaubt" ist an diesem
    // Block abgewählt — lokal_recherchieren wird für seine Agenten hart abgelehnt.
    // darfKartenAnlegen (BAUPLAN 25): das Audit darf trotz „nur lesen" Karten anlegen.
    // darfVorschlagen (BAUPLAN 26): karte_vorschlagen nur für den Karten-Prüfer.
    // darfLaufVorschlag (BAUPLAN 28): naechster_lauf_vorschlagen nur fürs Sessionende.
    // darfZuteilen + instanzId (BAUPLAN 29): karten_zuteilen nur für
    // Auftragsquellen-Blöcke; die Instanz-Kennung ordnet Zuteilung und
    // Projektwissen dem gerade laufenden Block zu.
    blockAusfuehren({ auftrag, blockName, instanzId = null, nurLesen = false, darfPruefen = false, lokaleKi = true, darfKartenAnlegen = false, darfVorschlagen = false, darfLaufVorschlag = false, darfZuteilen = false, uebertrag }) {
      if (tot)
        return Promise.resolve({
          zustand: 'fehlgeschlagen',
          fehlertext: texte.fehler.unbekannt,
          fehlerArt: null,
          ergebnisText: '',
          verbrauch: null,
          sessionKennung
        })
      return new Promise((aufloesen) => {
        block = {
          auftrag,
          blockName,
          instanzId,
          nurLesen,
          darfPruefen,
          lokaleKi,
          darfKartenAnlegen,
          darfVorschlagen,
          darfLaufVorschlag,
          darfZuteilen,
          uebertrag: uebertrag ?? { aktiv: false, testModus: false, anweisung: '' },
          aufloesen,
          blockTaskIds: new Set(),
          auftragEingesetzt: false,
          uebertragPhase: null,
          startProzent: null,
          uebertragBand: null,
          fazit: null,
          agentFehler: null,
          startTokens: hauptTokens,
          startZeit: Date.now(),
          kosten: null,
          aufschluesselung: null,
          // Modell je Block (BAUPLAN 36): Modellkennung → Tokens dieses Blocks.
          modellTokens: new Map(),
          unterVerbrauch: new Map()
        }
        eingabeNachschieben(texte.agentenLaufSession.dispatch(blockName))
      })
    },
    // Lebt die Session noch? Wenn nicht, startet die Lauf-Verwaltung einen
    // neuen Motor, der die Session über ihre Kennung fortsetzt.
    istTot: () => tot,
    get sessionKennung() {
      return sessionKennung
    },
    // Füllstand der Lauf-Session — für Laufstand und Fortsetzungs-Wächter.
    get tokens() {
      return hauptTokens
    },
    // Geordnetes Ende: Die Eingabe schließt, der Prozess läuft aus.
    beenden() {
      tot = true
      eingabeSchliessen()
    },
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

// Nachlauf-Chat (BAUPLAN 27): ein Chat-Motor über die fortgesetzte Lauf-Session
// (fortsetzen = Session-Kennung) oder als frische Session mit dem Laufbericht
// als Kontext (laufKontext). Anders als beim Lauf-Motor arbeitet der Hauptfaden
// hier selbst — es gibt keinen Koordinator und keinen Übertrag. Die Rechte
// entscheidet der Schalter „Chat darf reparieren": nur-lesend (Karten anlegen
// erlaubt, wie beim Audit) oder Schreibrechte wie ein Bauer — Git, Prüfmappe
// und Verwaltungsdateien bleiben in beiden Betriebsarten tabu (pruefeWerkzeug).
// Vor der ersten Änderung ruft der Motor vorErsterAenderung() auf — dort legt
// FlowForge den Sicherungspunkt an.
// Co-Pilot (BAUPLAN 33): Derselbe Motor trägt den Chat überall — im Projekt
// (projektPfad gesetzt: Karten-, Start- und App-Werkzeuge, Lauf-Session oder
// frisch) und in der Projektübersicht (projektPfad null: Arbeitsordner ist der
// Datenordner, gesperrt für seine Werkzeuge, nur Bedienfragen). Das
// FlowForge-Wissen kommt als lesbare Datei (SPEC.md) mit Abschnitts-Index im
// Systemtext. Während ein Lauf läuft (holeLaufAktiv), gelten die Getter:
// nur-lesend, keine Befehle über die „auf eigene Gefahr"-Einstellung.
export function starteChatMotor(optionen) {
  const {
    projektPfad = null,
    datenordner = '',
    modus,
    apiSchluessel,
    ausgabenObergrenzeUsd,
    fortsetzen = null,
    kontextFenster = KONTEXT_FENSTER_STANDARD,
    laufKontext = '',
    spec = null,
    // Einstellung „nur-lesende Blöcke dürfen Befehle ausführen" — je
    // Werkzeugaufruf frisch gelesen (während eines Laufs gilt sie NICHT).
    holeNurLesenBefehle = () => false,
    // Schalter „Chat darf reparieren" — je Werkzeugaufruf frisch gelesen,
    // damit das Umschalten mitten im Chat sofort gilt.
    holeReparieren,
    holeLaufAktiv = () => false,
    vorErsterAenderung,
    aufEreignis,
    aufRechteFrage,
    // Herkunft (BAUPLAN 30): Karten aus dem Chat tragen „vom Chat" samt Lauf.
    herkunft = null
  } = optionen
  const uebersicht = !projektPfad
  const arbeitsOrdner = projektPfad ?? datenordner
  const prozessgruppe = 'chat:' + (projektPfad ?? '@uebersicht')

  let kindProzess = null
  let hartAngefordert = false
  let abbrechenAngefordert = false
  let tot = false
  let stderrPuffer = ''
  let abfrage = null
  const abbruch = new AbortController()
  let sessionKennung = null
  let nachrichtEmpfangen = false

  // Eingabe-Warteschlange wie beim Lauf-Motor — nur dass hier ganze
  // Nachrichten-Inhalte (Text oder Blöcke mit Bildern) nachgeschoben werden.
  const eingabeSchlange = []
  let eingabeEnde = false
  let eingabeWecker = null
  function eingabeNachschieben(inhalt) {
    eingabeSchlange.push(inhalt)
    eingabeWecker?.()
  }
  function eingabeSchliessen() {
    eingabeEnde = true
    eingabeWecker?.()
  }
  async function* eingabe() {
    while (true) {
      if (eingabeSchlange.length) {
        const inhalt = eingabeSchlange.shift()
        yield { type: 'user', message: { role: 'user', content: inhalt }, parent_tool_use_id: null }
        continue
      }
      if (eingabeEnde) return
      await new Promise((wecken) => (eingabeWecker = wecken))
    }
  }

  // Verbrauch des Chats: Füllstand des Hauptfadens plus der Verbrauch seiner
  // Unteraufgaben; Kosten und Aufschlüsselung kumuliert über diesen Motor.
  let hauptTokens = 0
  let bekanntesFenster = kontextFenster > 0 ? kontextFenster : KONTEXT_FENSTER_STANDARD
  let kosten = null
  let kostenStand = null
  const aufschl = { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
  let hatAufschl = false
  const aufschlStand = { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
  const unterVerbrauch = new Map()

  function chatVerbrauch() {
    const band = kontextBand(hauptTokens, bekanntesFenster)
    return {
      tokens: hauptTokens,
      unterTokens: [...unterVerbrauch.values()].reduce((a, b) => a + b, 0),
      kontextProzentVon: band.von,
      kontextProzentBis: band.bis,
      kostenUsd: kosten,
      aufschluesselung: hatAufschl ? { ...aufschl } : null,
      kontextFenster: bekanntesFenster
    }
  }

  // Die gerade laufende Chat-Nachricht — es läuft höchstens eine zugleich.
  let offen = null
  function aufloesen(zustand, extra = {}) {
    if (!offen) return
    const o = offen
    offen = null
    o({
      zustand,
      text: '',
      fehlertext: '',
      fehlerArt: null,
      verbrauch: chatVerbrauch(),
      sessionKennung,
      ...extra
    })
  }

  // Sicherungspunkt vor der ersten Änderung (SPEC/BAUPLAN 27): einmalig,
  // BEVOR der erste verändernde Werkzeugaufruf durchgelassen wird.
  async function aenderungAnkuendigen(name, eingabeDaten) {
    if (uebersicht || !chatAenderung(name, eingabeDaten)) return
    await vorErsterAenderung?.()
  }

  function urteilFuer(name, eingabeDaten) {
    if (uebersicht) return pruefeWerkzeugUebersicht(name, eingabeDaten, datenordner)
    const reparieren = Boolean(holeReparieren?.())
    const laufAktiv = Boolean(holeLaufAktiv?.())
    const urteil = pruefeWerkzeug(
      name,
      eingabeDaten,
      projektPfad,
      !reparieren, // nur-lesend, solange „Chat darf reparieren" aus ist
      false, // die Prüfmappe gehört dem Prüfer — auch im Reparatur-Modus tabu
      true,
      Boolean(holeNurLesenBefehle?.()),
      // Karten anlegen ist der Normalweg des nur-lesenden Chats — außer während
      // eines Laufs: dann ist der Chat wirklich lesend (ein Schreiber pro Projekt).
      !laufAktiv,
      false
    )
    // Während ein Lauf läuft, sagt die Abweisung ehrlich, warum: nicht „dieser
    // Block darf nur lesen", sondern „im Projekt läuft gerade ein Lauf".
    if (urteil.gesperrt && laufAktiv)
      return { ...urteil, gesperrt: texte.rechteFrage.chatWaehrendLaufFuerAgent }
    return urteil
  }

  // Harte Sperren vor jedem Werkzeugaufruf — der Hauptfaden arbeitet hier
  // selbst, es gibt keinen Koordinator-Sonderweg.
  async function vorWerkzeug(hookDaten) {
    const name = hookDaten.tool_name
    const eingabeDaten =
      hookDaten.tool_input && typeof hookDaten.tool_input === 'object' ? hookDaten.tool_input : {}
    const urteil = urteilFuer(name, eingabeDaten)
    if (urteil.gesperrt) {
      if (urteil.tickerText) aufEreignis({ art: 'ticker', text: urteil.tickerText })
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: urteil.gesperrt
        }
      }
    }
    if (urteil.erlaubt) {
      await aenderungAnkuendigen(name, eingabeDaten)
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } }
    }
    return {}
  }

  const schleife = (async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    // Werkzeug-Server nur im Projekt: Karten („leg das als Aufgabe an" ist der
    // Normalweg; Herkunft „vom Chat" samt Lauf, BAUPLAN 30), Startanleitung
    // (im Reparatur-Modus erlaubt, sonst von der Sperre gestoppt) und die
    // App-Werkzeuge (BAUPLAN 33) — in der Übersicht gibt es kein Projekt.
    const mcpServers = {}
    if (!uebersicht) {
      mcpServers.karten = await kartenWerkzeugServer({
        projektPfad,
        aufEreignis,
        holeHerkunft: herkunft ? () => herkunft : null
      })
      mcpServers.start = await startWerkzeugServer({ projektPfad, aufEreignis })
      mcpServers.app = await appWerkzeugServer({ projektPfad, aufEreignis })
    }

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
        cwd: arbeitsOrdner,
        env: umgebung,
        abortController: abbruch,
        pathToClaudeCodeExecutable: claudeExePfad(),
        settingSources: [],
        // Fortsetzung der Lauf-Session (Mechanik aus BAUPLAN 16/19): der Chat
        // kennt Blöcke, Fazite und Verlauf, ohne dass etwas nacherzählt wird.
        ...(fortsetzen ? { resume: fortsetzen } : {}),
        forwardSubagentText: true,
        mcpServers,
        // Der Chat-Systemtext hebt die Koordinator-Regeln der Lauf-Session
        // ausdrücklich auf, trägt den SPEC-Index und die Kurzregeln; bei einer
        // frischen Session hängt der Laufbericht als Kontext dahinter.
        systemPrompt:
          texte.agentenChat.system({
            projektPfad,
            datenordner,
            titelMax: TITEL_MAX,
            textMax: TEXT_MAX,
            specPfad: spec?.vorhanden ? spec.pfad : '',
            specIndex: spec?.vorhanden ? spec.indexText : ''
          }) + (laufKontext ? texte.agentenChat.laufKontext(laufKontext) : ''),
        maxTurns: 1000,
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
          // Prozess-Hygiene (BAUPLAN 32): auch der Chat-Prozess ist eine Wurzel.
          if (kindProzess.pid) prozessWurzelMelden(prozessgruppe, projektPfad, kindProzess.pid)
          return kindProzess
        },
        hooks: { PreToolUse: [{ hooks: [vorWerkzeug] }] },
        canUseTool: async (name, eingabeDaten, _kontext) => {
          const urteil = urteilFuer(name, eingabeDaten ?? {})
          if (urteil.erlaubt) {
            await aenderungAnkuendigen(name, eingabeDaten ?? {})
            return { behavior: 'allow', updatedInput: eingabeDaten }
          }
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
          if (erlaubt) {
            await aenderungAnkuendigen(name, eingabeDaten ?? {})
            return { behavior: 'allow', updatedInput: eingabeDaten }
          }
          return { behavior: 'deny', message: texte.rechteFrage.abgelehntFuerAgent }
        }
      }
    })

    try {
      for await (const nachricht of abfrage) {
        nachrichtEmpfangen = true
        if (typeof nachricht.session_id === 'string' && nachricht.session_id)
          sessionKennung = nachricht.session_id
        for (const zeile of tickerZeilen(nachricht, arbeitsOrdner, null, true))
          aufEreignis({ art: 'ticker', text: zeile })

        // Denk-Bereich (BAUPLAN 24): auch das Denken des Chats ist sichtbar.
        if (nachricht.type === 'assistant') {
          for (const teil of nachricht.message?.content ?? []) {
            if (teil?.type !== 'thinking' || !String(teil.thinking ?? '').trim()) continue
            aufEreignis({ art: 'denken', text: String(teil.thinking).trim() })
          }
        }

        if (nachricht.type === 'system' && nachricht.subtype === 'init') {
          const bekannt = kontextFensterFuerModell(nachricht.model)
          if (bekannt > 0) bekanntesFenster = bekannt
        }

        if (nachricht.type === 'assistant' && nachricht.message?.usage) {
          const u = nachricht.message.usage
          const kumuliert =
            (u.input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0) +
            (u.output_tokens ?? 0)
          if (nachricht.parent_tool_use_id)
            unterVerbrauch.set(nachricht.parent_tool_use_id, kumuliert)
          else hauptTokens = kumuliert
          aufEreignis({ art: 'chat-verbrauch', verbrauch: chatVerbrauch() })
        }

        if (nachricht.type === 'result') {
          if (typeof nachricht.total_cost_usd === 'number') {
            const delta =
              kostenStand === null
                ? nachricht.total_cost_usd
                : Math.max(0, nachricht.total_cost_usd - kostenStand)
            kostenStand = nachricht.total_cost_usd
            if (delta > 0) kosten = (kosten ?? 0) + delta
          }
          const summe = { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
          let hatModelUsage = false
          for (const [modell, m] of Object.entries(nachricht.modelUsage ?? {})) {
            hatModelUsage = true
            if (m.contextWindow > 0) {
              bekanntesFenster = m.contextWindow
              kontextFensterMerken(modell, m.contextWindow)
            }
            summe.eingabe += m.inputTokens ?? 0
            summe.ausgabe += m.outputTokens ?? 0
            summe.cacheLesen += m.cacheReadInputTokens ?? 0
            summe.cacheSchreiben += m.cacheCreationInputTokens ?? 0
          }
          if (hatModelUsage) {
            hatAufschl = true
            for (const feld of ['eingabe', 'ausgabe', 'cacheLesen', 'cacheSchreiben']) {
              aufschl[feld] += Math.max(0, summe[feld] - aufschlStand[feld])
              aufschlStand[feld] = summe[feld]
            }
          }
          aufEreignis({ art: 'chat-verbrauch', verbrauch: chatVerbrauch() })

          if (!offen) continue
          if (hartAngefordert) {
            aufloesen('hart-abgebrochen')
            continue
          }
          if (abbrechenAngefordert) {
            abbrechenAngefordert = false
            aufloesen('abgebrochen')
            continue
          }
          if (nachricht.subtype === 'success' && !nachricht.is_error) {
            aufloesen('erfolgreich', {
              text: typeof nachricht.result === 'string' ? nachricht.result : ''
            })
            continue
          }
          const { fehlertext, fehlerArt } = fehlerAusErgebnis(nachricht, stderrPuffer)
          // Fortsetzen-Versuch, den die CLI ablehnt (Session weg): kein echter
          // Fehler — die Chat-Verwaltung startet ehrlich vermerkt frisch.
          if (
            fortsetzen &&
            fehlerArt === null &&
            /no conversation|session id|session.*not found|(could not|cannot|unable to) resume/i.test(
              fehlertext
            )
          ) {
            tot = true
            eingabeSchliessen()
            aufloesen('fortsetzung-gescheitert', { sessionKennung: null })
            continue
          }
          aufloesen('fehlgeschlagen', { fehlertext, fehlerArt })
        }
      }
    } catch (fehler) {
      if (offen) {
        if (hartAngefordert) aufloesen('hart-abgebrochen')
        else if (abbrechenAngefordert) aufloesen('abgebrochen')
        else if (fortsetzen && !nachrichtEmpfangen)
          aufloesen('fortsetzung-gescheitert', { sessionKennung: null })
        else {
          const { fehlertext, fehlerArt } = fehlerAusErgebnis(
            null,
            stderrPuffer || String(fehler?.message ?? '')
          )
          aufloesen('fehlgeschlagen', { fehlertext, fehlerArt })
        }
      }
    } finally {
      tot = true
      eingabeSchliessen()
      if (offen) {
        if (hartAngefordert) aufloesen('hart-abgebrochen')
        else aufloesen('fehlgeschlagen', { fehlertext: texte.fehler.unbekannt })
      }
    }
  })()
  schleife.catch(() => {})

  return {
    // Schickt eine Chat-Nachricht (Text oder Inhalts-Blöcke mit Bildern) und
    // löst mit der Antwort auf. Es läuft höchstens eine Nachricht zugleich.
    senden(inhalt) {
      if (tot)
        return Promise.resolve({
          zustand: 'fehlgeschlagen',
          text: '',
          fehlertext: texte.fehler.unbekannt,
          fehlerArt: null,
          verbrauch: chatVerbrauch(),
          sessionKennung
        })
      return new Promise((antworten) => {
        offen = antworten
        eingabeNachschieben(inhalt)
      })
    },
    // Bricht die laufende Antwort ab — die Session bleibt nutzbar.
    abbrechen() {
      if (!offen || abbrechenAngefordert || hartAngefordert) return
      abbrechenAngefordert = true
      abfrage?.interrupt().catch(() => {})
    },
    istTot: () => tot,
    get sessionKennung() {
      return sessionKennung
    },
    get tokens() {
      return hauptTokens
    },
    verbrauch: () => chatVerbrauch(),
    beenden() {
      tot = true
      eingabeSchliessen()
    },
    hartStoppen() {
      if (hartAngefordert) return
      hartAngefordert = true
      if (kindProzess?.pid)
        spawn('taskkill', ['/PID', String(kindProzess.pid), '/T', '/F'], { windowsHide: true })
      setTimeout(() => abbruch.abort(), 1500)
      eingabeSchliessen()
    }
  }
}
