// Prozess-Verwaltung (BAUPLAN 32): „Nichts läuft unsichtbar weiter."
//
// Ein Prüfer-Lauf startet einen Server und beendet ihn nie — der Port ist
// beim nächsten „App starten" belegt (Befund Georg, 15.08.2026). Ein Baumlauf
// ab dem Motor-Prozess reicht unter Windows nicht: Die Bash-Shell des Agenten
// stirbt sofort nach „npm start &", der Server behält nur eine tote
// Eltern-Kennung, und je Lauf gibt es mehrere Motor-Prozesse. Deshalb fragt
// FlowForge während eines Laufs alle paar Sekunden die Prozessliste ab (ein
// dauerhafter PowerShell-Späher, ~60–120 ms je Abfrage) und merkt sich je
// Gruppe (Lauf, Chat, App) transitiv jeden Prozess, dessen Elternteil zur
// bekannten Menge gehört — PID + Startzeit, gegen Wiederverwendung. Am Ende
// der Gruppe werden alle noch lebenden Mitglieder per taskkill /T /F beendet.
// FlowForge-Ende räumt alle Gruppen ab.
//
// Grenze (ehrlich): Lebt eine Zwischen-Shell kürzer als ein Abfrage-Abstand,
// sieht der Späher sie nie — ihr Kind bleibt unerkannt. Solche Prozesse
// (verwaist, während eines Laufs gestartet) zeigt der App-Tab als „vermutlich
// aus einem Lauf" mit Beenden-Knopf; automatisch beendet werden sie nicht.
import { spawn } from 'node:child_process'
import {
  nachkommenErweitern,
  wurzelAufnehmen,
  wurzelnNachtragen,
  verwaisteKandidaten
} from './prozessRegeln.js'

const ABFRAGE_ABSTAND_MS = 2000
const ABFRAGE_TIMEOUT_MS = 10000
const SENTINEL = '<<FLOWFORGE-ENDE>>'

// Abfrage-Skript des Spähers: die ganze Prozessliste als JSON, Startzeit als
// FILETIME-Zahl (eindeutig, vergleichbar).
const LISTEN_SKRIPT =
  "Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,CommandLine,CreationDate | " +
  "Select-Object ProcessId,ParentProcessId,Name,CommandLine,@{n='Start';e={if($_.CreationDate){$_.CreationDate.ToFileTimeUtc()}else{0}}} | " +
  'ConvertTo-Json -Compress'

// gruppen: schluessel → { schluessel, projektPfad, bekannt: Map<pid, eintrag>, angelegtAm }
const gruppen = new Map()
// Reste abgeräumter Gruppen, die sich nicht beenden ließen — bleiben in der
// Rückfall-Liste, bis sie tot sind.
const reste = new Map() // pid → eintrag (+ projektPfad)
// Zeitfenster aller Läufe (FILETIME-Zahlen), für die Verwaisten-Heuristik.
const laufFenster = [] // { von, bis|null, schluessel }
let letzterSchnappschuss = new Map()
let spaeher = null
let spaeherWarteschlange = Promise.resolve()
let takt = null
let wirdBeendet = false

// FILETIME (100-ns-Ticks seit 1601) ↔ Millisekunden seit 1970.
const FILETIME_EPOCHE_MS = 11644473600000
export function filetimeZuMs(filetime) {
  return Math.round(filetime / 10000) - FILETIME_EPOCHE_MS
}
function jetztFiletime() {
  return (Date.now() + FILETIME_EPOCHE_MS) * 10000
}

// ---------- Späher (dauerhafte PowerShell) ----------

function spaeherStarten() {
  if (spaeher) return spaeher
  const kind = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true
  })
  const zustand = { kind, puffer: '', warter: null }
  kind.stdout.setEncoding('utf8')
  kind.stdout.on('data', (stueck) => {
    zustand.puffer += stueck
    const idx = zustand.puffer.indexOf(SENTINEL)
    if (idx < 0 || !zustand.warter) return
    const antwort = zustand.puffer.slice(0, idx)
    zustand.puffer = zustand.puffer.slice(idx + SENTINEL.length)
    const warter = zustand.warter
    zustand.warter = null
    warter.aufloesen(antwort)
  })
  kind.on('exit', () => {
    if (spaeher === zustand) spaeher = null
    zustand.warter?.ablehnen(new Error('spaeher-tot'))
    zustand.warter = null
  })
  kind.on('error', () => {
    if (spaeher === zustand) spaeher = null
  })
  // UTF-8 nach außen, keine Fortschrittsbalken.
  kind.stdin.write(
    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $ProgressPreference='SilentlyContinue'\n"
  )
  spaeher = zustand
  return zustand
}

function spaeherBeenden() {
  if (!spaeher) return
  try {
    spaeher.kind.stdin.end()
    spaeher.kind.kill()
  } catch {
    // schon tot
  }
  spaeher = null
}

// Eine Abfrage an den Späher — nacheinander, nie zwei zugleich.
function spaeherFragen(skript) {
  const auftrag = () =>
    new Promise((aufloesen, ablehnen) => {
      let zustand
      try {
        zustand = spaeherStarten()
      } catch (fehler) {
        return ablehnen(fehler)
      }
      const wecker = setTimeout(() => {
        if (zustand.warter?.aufloesen === aufloesen) {
          zustand.warter = null
          spaeherBeenden()
          ablehnen(new Error('spaeher-timeout'))
        }
      }, ABFRAGE_TIMEOUT_MS)
      zustand.warter = {
        aufloesen: (antwort) => {
          clearTimeout(wecker)
          aufloesen(antwort)
        },
        ablehnen: (fehler) => {
          clearTimeout(wecker)
          ablehnen(fehler)
        }
      }
      try {
        zustand.kind.stdin.write(`${skript}; Write-Output '${SENTINEL}'\n`)
      } catch (fehler) {
        clearTimeout(wecker)
        zustand.warter = null
        ablehnen(fehler)
      }
    })
  const ergebnis = spaeherWarteschlange.then(auftrag, auftrag)
  spaeherWarteschlange = ergebnis.catch(() => {})
  ruheWeckerStellen()
  return ergebnis
}

// Ohne aktive Gruppe (nur Einzelabfragen wie Port-Prüfung oder Rückfall-Liste)
// wird der Späher nach einer halben Minute Ruhe beendet — keine untätige
// PowerShell im Hintergrund.
let ruheWecker = null
function ruheWeckerStellen() {
  if (ruheWecker) clearTimeout(ruheWecker)
  ruheWecker = setTimeout(() => {
    ruheWecker = null
    if (gruppen.size === 0) spaeherBeenden()
  }, 30000)
}

// Prozessliste als Schnappschuss (Map pid → { pid, eltern, name, befehl, start }).
export async function prozesslisteLesen() {
  const antwort = await spaeherFragen(LISTEN_SKRIPT)
  let roh
  try {
    roh = JSON.parse(antwort.trim())
  } catch {
    throw new Error('prozessliste-unlesbar')
  }
  const liste = Array.isArray(roh) ? roh : roh ? [roh] : []
  const schnappschuss = new Map()
  for (const p of liste) {
    const pid = Number(p.ProcessId)
    if (!Number.isInteger(pid)) continue
    schnappschuss.set(pid, {
      pid,
      eltern: Number(p.ParentProcessId) || 0,
      name: String(p.Name ?? ''),
      befehl: String(p.CommandLine ?? ''),
      start: Number(p.Start) || 0
    })
  }
  letzterSchnappschuss = schnappschuss
  return schnappschuss
}

// ---------- Gruppen ----------

function gruppeBesorgen(schluessel, projektPfad) {
  let gruppe = gruppen.get(schluessel)
  if (!gruppe) {
    gruppe = { schluessel, projektPfad, bekannt: new Map(), angelegtAm: jetztFiletime() }
    gruppen.set(schluessel, gruppe)
    if (schluessel.startsWith('lauf:'))
      laufFenster.push({ von: gruppe.angelegtAm, bis: null, schluessel })
    taktAnstossen()
  }
  return gruppe
}

// Gruppe anlegen (Laufstart) — die Überwachung beginnt sofort.
export function prozessgruppeAnlegen(schluessel, projektPfad) {
  gruppeBesorgen(schluessel, projektPfad)
}

// Wurzel melden: der eben gestartete Kind-Prozess eines Motors, Chats oder
// der App-Shell. Legt die Gruppe bei Bedarf an.
export function prozessWurzelMelden(schluessel, projektPfad, pid) {
  // FlowForge ist schon am Beenden: Was jetzt noch startet (z.B. ein
  // Motor-Neuanlauf nach dem Abräumen), stirbt sofort — nichts überlebt.
  if (wirdBeendet) {
    void taskkill(pid)
    return
  }
  const gruppe = gruppeBesorgen(schluessel, projektPfad)
  wurzelAufnehmen(gruppe.bekannt, pid, letzterSchnappschuss)
}

function taktAnstossen() {
  if (takt || wirdBeendet) return
  takt = setInterval(() => void abtasten(), ABFRAGE_ABSTAND_MS)
  void abtasten()
}

function taktPruefen() {
  if (gruppen.size > 0 || takt === null) return
  clearInterval(takt)
  takt = null
  spaeherBeenden()
}

let abtastungLaeuft = false
async function abtasten() {
  if (abtastungLaeuft || wirdBeendet) return
  abtastungLaeuft = true
  try {
    const schnappschuss = await prozesslisteLesen()
    for (const gruppe of gruppen.values()) {
      wurzelnNachtragen(gruppe.bekannt, schnappschuss)
      nachkommenErweitern(gruppe.bekannt, schnappschuss)
    }
    for (const [pid, eintrag] of reste) {
      const jetzt = schnappschuss.get(pid)
      if (!jetzt || jetzt.start !== eintrag.start) reste.delete(pid)
    }
  } catch {
    // Späher gestorben oder Antwort unlesbar — nächster Takt versucht es neu.
  } finally {
    abtastungLaeuft = false
  }
}

function taskkill(pid) {
  return new Promise((aufloesen) => {
    let kind
    try {
      kind = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } catch {
      return aufloesen(false)
    }
    kind.on('exit', (code) => aufloesen(code === 0))
    kind.on('error', () => aufloesen(false))
  })
}

// Lebt der Prozess noch — mit derselben Startzeit? (Schutz vor Wiederverwendung.)
function lebtNoch(schnappschuss, eintrag) {
  const jetzt = schnappschuss.get(eintrag.pid)
  if (!jetzt) return false
  if (eintrag.start === null) return true // Wurzel, nie gesehen: lieber beenden
  return jetzt.start === eintrag.start
}

// Gruppe abräumen (Lauf-Ende, Chat-Ende, App-Stopp): frischer Schnappschuss,
// letzte Erweiterung, dann alle lebenden Mitglieder beenden. Mit
// wurzelnSchonen bleiben die Wurzeln unangetastet (sie enden geordnet selbst).
// Liefert { beendet: [eintrag], uebrig: [eintrag] } — uebrig = ließen sich
// nicht beenden, landen in der Rückfall-Liste.
export async function prozessgruppeAbraeumen(schluessel, { wurzelnSchonen = false, schonen = new Set() } = {}) {
  const gruppe = gruppen.get(schluessel)
  if (!gruppe) return { beendet: [], uebrig: [] }
  const fensterEintrag = laufFenster.find((f) => f.schluessel === schluessel && f.bis === null)
  if (fensterEintrag) fensterEintrag.bis = jetztFiletime()
  let schnappschuss = letzterSchnappschuss
  try {
    schnappschuss = await prozesslisteLesen()
    wurzelnNachtragen(gruppe.bekannt, schnappschuss)
    nachkommenErweitern(gruppe.bekannt, schnappschuss)
  } catch {
    // Mit dem letzten Stand weiterarbeiten.
  }
  const ziele = [...gruppe.bekannt.values()].filter(
    (e) => !(wurzelnSchonen && e.wurzel) && !schonen.has(e.pid) && lebtNoch(schnappschuss, e)
  )
  await Promise.all(ziele.map((e) => taskkill(e.pid)))
  gruppen.delete(schluessel)
  taktPruefen()
  if (ziele.length === 0) return { beendet: [], uebrig: [] }
  // Nachprüfen, was wirklich weg ist.
  await new Promise((r) => setTimeout(r, 400))
  let danach = schnappschuss
  try {
    danach = await prozesslisteLesen()
  } catch {
    // dann gilt der Wunsch als erfüllt
  }
  const beendet = []
  const uebrig = []
  for (const e of ziele) {
    if (danach !== schnappschuss && lebtNoch(danach, e)) {
      uebrig.push(e)
      reste.set(e.pid, { ...e, projektPfad: gruppe.projektPfad })
    } else beendet.push(e)
  }
  return { beendet, uebrig }
}

// Alle Mitglieder einer Gruppe (für Ausschlüsse: die App-Shell samt Kindern
// steht nicht in der Verwaisten-Liste).
export function prozessgruppeMitglieder(schluessel) {
  const gruppe = gruppen.get(schluessel)
  return gruppe ? [...gruppe.bekannt.values()] : []
}

export function prozessgruppeAktiv(schluessel) {
  return gruppen.has(schluessel)
}

// Rückfall-Liste für den App-Tab: (a) Reste abgeräumter Gruppen, die noch
// leben; (b) verwaiste Prozesse, die während eines Laufs gestartet wurden und
// zu keiner aktiven Gruppe gehören („vermutlich aus einem Lauf"). Aktive
// Gruppen (laufender Motor, laufende App) sind ausgenommen.
export async function verwaisteListe() {
  let schnappschuss = letzterSchnappschuss
  try {
    schnappschuss = await prozesslisteLesen()
  } catch {
    // letzter Stand
  }
  const ausgeschlossen = new Set()
  for (const gruppe of gruppen.values()) for (const pid of gruppe.bekannt.keys()) ausgeschlossen.add(pid)
  const liste = []
  for (const [pid, eintrag] of reste) {
    const jetzt = schnappschuss.get(pid)
    if (!jetzt || jetzt.start !== eintrag.start) {
      reste.delete(pid)
      continue
    }
    ausgeschlossen.add(pid)
    liste.push({
      pid,
      start: eintrag.start,
      name: jetzt.name,
      befehl: jetzt.befehl,
      gestartetAm: new Date(filetimeZuMs(jetzt.start)).toISOString(),
      sicher: true
    })
  }
  const kandidaten = verwaisteKandidaten(schnappschuss, {
    fenster: laufFenster,
    eigenePid: process.pid,
    ausgeschlossen
  })
  for (const p of kandidaten) {
    liste.push({
      pid: p.pid,
      start: p.start,
      name: p.name,
      befehl: p.befehl,
      gestartetAm: new Date(filetimeZuMs(p.start)).toISOString(),
      sicher: false
    })
  }
  liste.sort((a, b) => b.start - a.start)
  return liste
}

// Einzelnen Prozess beenden (Beenden-Knopf der Rückfall-Liste) — nur, wenn
// PID und Startzeit noch zusammenpassen.
export async function prozessBeenden(pid, start) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return { ok: false }
  let schnappschuss = letzterSchnappschuss
  try {
    schnappschuss = await prozesslisteLesen()
  } catch {
    // letzter Stand
  }
  const jetzt = schnappschuss.get(pid)
  if (!jetzt) {
    reste.delete(pid)
    return { ok: true, schonWeg: true }
  }
  if (Number(start) && jetzt.start !== Number(start)) return { ok: false, wiederverwendet: true }
  const gelungen = await taskkill(pid)
  reste.delete(pid)
  return { ok: gelungen }
}

// Besitzer eines belegten lokalen Ports (Port-Prüfung vor dem App-Start):
// { pid, name, befehl } oder null, wenn frei.
export async function portBesitzer(port) {
  const skript =
    `$c = Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess; ` +
    'if ($c) { Write-Output $c } else { Write-Output 0 }'
  let pid = 0
  try {
    pid = Number((await spaeherFragen(skript)).trim())
  } catch {
    return null
  }
  if (!pid) return null
  let schnappschuss = letzterSchnappschuss
  try {
    schnappschuss = await prozesslisteLesen()
  } catch {
    // letzter Stand
  }
  const p = schnappschuss.get(pid)
  return { pid, start: p?.start ?? 0, name: p?.name ?? '', befehl: p?.befehl ?? '' }
}

// FlowForge-Ende (before-quit): alle Gruppen samt Wurzeln beenden, Späher
// aus. Bounded — das Beenden darf nicht hängen.
export async function alleProzesseAbraeumen() {
  wirdBeendet = true
  if (takt) {
    clearInterval(takt)
    takt = null
  }
  const schluessel = [...gruppen.keys()]
  const arbeit = Promise.all(schluessel.map((s) => prozessgruppeAbraeumen(s)))
  await Promise.race([arbeit, new Promise((r) => setTimeout(r, 4000))])
  // Was ohne Schnappschuss noch bekannt ist: sicherheitshalber alles killen.
  const rest = []
  for (const gruppe of gruppen.values()) for (const e of gruppe.bekannt.values()) rest.push(e.pid)
  await Promise.race([Promise.all(rest.map(taskkill)), new Promise((r) => setTimeout(r, 1500))])
  spaeherBeenden()
}
