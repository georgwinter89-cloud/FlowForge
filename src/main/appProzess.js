// App-Tab (BAUPLAN 32, SPEC §8): Die Startanleitung läuft IN FlowForge —
// kein externes Konsolenfenster mehr. Der Befehl startet über eine Shell mit
// UTF-8-Codepage, die Ausgabe (Standard + Fehler, ANSI-Farbcodes gestrippt)
// landet live im Tab, dazu Zustand (läuft seit … / beendet mit Code …),
// Stopp/Neustart, „Adresse im Browser öffnen". Der Prozess hat keine
// Eingabe: Startanleitungen müssen ohne Tastatureingabe auskommen.
//
// Port-Prüfung vor dem Start: Ist der Port der Startanleitungs-Adresse belegt,
// nennt FlowForge den Besitzer und bietet an, ihn zu beenden — der direkte
// Treffer fürs Symptom „Port belegt vom vergessenen Prüfer-Server".
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { spawn } from 'node:child_process'
import { BrowserWindow, shell } from 'electron'
import { texte } from '../shared/texte.js'
import { startanleitungLaden } from './startanleitung.js'
import { ausgabeAnhaengen, lokalerPort } from './prozessRegeln.js'
import {
  prozessWurzelMelden,
  prozessgruppeAbraeumen,
  portBesitzer,
  prozessBeenden
} from './prozesse.js'

const AUSGABE_MAX_ZEICHEN = 120000
const AUSGABE_TAKT_MS = 200
// Web-Apps brauchen Anlaufzeit: so lange wartet FlowForge höchstens, bis die
// Adresse antwortet, bevor der Browser trotzdem geöffnet wird.
const WARTE_HOECHSTENS_MS = 30000
const WARTE_ABSTAND_MS = 700
const PORT_FREI_WARTEN_MS = 4000

// projektPfad → { kind, pid, anleitung, zustand, gestartetAm, beendetAm, code,
//   ausgabe, sendeWecker, adresseGeoeffnet }
const apps = new Map()

export function appGruppenSchluessel(projektPfad) {
  return 'app:' + projektPfad
}

function istWebAdresse(adresse) {
  return /^https?:\/\//i.test(adresse)
}

function senden(projektPfad, ereignis) {
  const daten = { projektPfad, ...ereignis }
  for (const fenster of BrowserWindow.getAllWindows())
    if (!fenster.isDestroyed()) fenster.webContents.send('app-ereignis', daten)
}

function zustandVon(app) {
  return {
    laeuft: app.zustand === 'laeuft',
    startet: app.zustand === 'startet',
    zustand: app.zustand,
    pid: app.pid,
    gestartetAm: app.gestartetAm,
    beendetAm: app.beendetAm,
    code: app.code,
    adresse: app.anleitung?.adresse ?? '',
    befehl: app.anleitung?.befehl ?? '',
    adresseGeoeffnet: app.adresseGeoeffnet,
    gestoppt: Boolean(app.gestoppt)
  }
}

function zustandMelden(app) {
  senden(app.projektPfad, { art: 'app-zustand', ...zustandVon(app) })
}

// Ausgabe gebündelt weiterreichen (höchstens alle 200 ms der ganze Puffer —
// so bleibt auch das \r-Überschreiben von Fortschrittsbalken korrekt).
function ausgabeMelden(app) {
  if (app.sendeWecker) return
  app.sendeWecker = setTimeout(() => {
    app.sendeWecker = null
    senden(app.projektPfad, { art: 'app-ausgabe', ausgabe: app.ausgabe })
  }, AUSGABE_TAKT_MS)
}

function ausgabeSofortMelden(app) {
  if (app.sendeWecker) {
    clearTimeout(app.sendeWecker)
    app.sendeWecker = null
  }
  senden(app.projektPfad, { art: 'app-ausgabe', ausgabe: app.ausgabe })
}

// Zustand für die Oberfläche (Tab öffnen, Projekt wechseln).
export function appZustand(projektPfad) {
  const app = apps.get(projektPfad)
  if (!app) return { ok: true, laeuft: false, startet: false, zustand: 'aus', ausgabe: '' }
  return { ok: true, ...zustandVon(app), ausgabe: app.ausgabe }
}

export function appLaeuft(projektPfad) {
  const app = apps.get(projektPfad)
  return Boolean(app && (app.zustand === 'laeuft' || app.zustand === 'startet'))
}

// Eine Anfrage an die Adresse — jede Antwort (auch ein Fehlercode) heißt:
// der Server ist da und der Browser kann öffnen.
function einmalAnfragen(adresse) {
  return new Promise((aufloesen) => {
    const modul = adresse.toLowerCase().startsWith('https') ? https : http
    let anfrage
    try {
      anfrage = modul.get(adresse, (antwort) => {
        antwort.destroy()
        aufloesen(true)
      })
    } catch {
      return aufloesen(false)
    }
    anfrage.on('error', () => aufloesen(false))
    anfrage.setTimeout(1500, () => {
      anfrage.destroy()
      aufloesen(false)
    })
  })
}

// Warten, bis die Adresse antwortet — oder die App vorher stirbt / die
// Höchstdauer um ist. Liefert true, wenn sie antwortete.
async function aufAdresseWarten(adresse, app) {
  const schluss = Date.now() + WARTE_HOECHSTENS_MS
  while (Date.now() < schluss) {
    if (app && app.zustand !== 'laeuft') return false
    if (await einmalAnfragen(adresse)) return true
    await new Promise((r) => setTimeout(r, WARTE_ABSTAND_MS))
  }
  return false
}

// Adresse öffnen: Web → Browser (bei laufendem Befehl erst, wenn sie
// antwortet — sonst zeigt der Browser „Seite nicht erreichbar"); Datei →
// Standardprogramm.
export async function appAdresseOeffnen(projektPfad, { warten = true } = {}) {
  const { anleitung } = startanleitungLaden(projektPfad)
  if (!anleitung?.adresse) return { ok: false, fehler: texte.app.fehlerKeineAdresse }
  const app = apps.get(projektPfad)
  try {
    if (istWebAdresse(anleitung.adresse)) {
      if (warten && anleitung.befehl) {
        if (app) senden(projektPfad, { art: 'app-wartet-adresse', wartet: true })
        const antwortet = await aufAdresseWarten(anleitung.adresse, app)
        if (app) senden(projektPfad, { art: 'app-wartet-adresse', wartet: false })
        // Ist die App inzwischen tot, öffnet der Browser nur eine Fehlerseite.
        if (!antwortet && app && app.zustand !== 'laeuft')
          return { ok: false, fehler: texte.app.fehlerAdresseNichtErreichbar }
      }
      await shell.openExternal(anleitung.adresse)
    } else {
      const voll = path.resolve(projektPfad, anleitung.adresse)
      if (!fs.existsSync(voll))
        return { ok: false, fehler: texte.startanleitung.fehlerDateiFehlt(anleitung.adresse) }
      const fehler = await shell.openPath(voll)
      if (fehler) return { ok: false, fehler: texte.startanleitung.fehlerOeffnen }
    }
  } catch {
    return { ok: false, fehler: texte.startanleitung.fehlerOeffnen }
  }
  if (app) {
    app.adresseGeoeffnet = true
    zustandMelden(app)
  }
  return { ok: true }
}

// Port der Startanleitung frei? Sonst { port, pid, name, befehl } des Besitzers.
async function portPruefen(anleitung) {
  const port = anleitung.adresse ? lokalerPort(anleitung.adresse) : null
  if (!port) return null
  const besitzer = await portBesitzer(port)
  if (!besitzer) return null
  return { port, ...besitzer }
}

async function aufPortFreiWarten(port) {
  const schluss = Date.now() + PORT_FREI_WARTEN_MS
  while (Date.now() < schluss) {
    if (!(await portBesitzer(port))) return true
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

// App starten. portFreimachen = true: der Besitzer des belegten Ports wird
// vorher beendet (Georg hat es im Dialog bestätigt). Rückgabe bei belegtem
// Port ohne Freigabe: { ok: false, portBelegt: { port, pid, name, befehl } }.
export async function appStarten(projektPfad, { portFreimachen = false } = {}) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const { anleitung } = startanleitungLaden(projektPfad)
  if (!anleitung) return { ok: false, fehler: texte.startanleitung.fehlerKeine }
  if (appLaeuft(projektPfad)) return { ok: false, fehler: texte.app.fehlerLaeuftSchon }

  // Nur Adresse/Datei, kein Befehl: nichts zu starten — direkt öffnen.
  if (!anleitung.befehl) {
    const app = {
      projektPfad,
      kind: null,
      pid: null,
      anleitung,
      zustand: 'nur-adresse',
      gestartetAm: new Date().toISOString(),
      beendetAm: null,
      code: null,
      ausgabe: '',
      sendeWecker: null,
      adresseGeoeffnet: false
    }
    apps.set(projektPfad, app)
    zustandMelden(app)
    return appAdresseOeffnen(projektPfad, { warten: false })
  }

  // Port-Prüfung vor dem Start (BAUPLAN 32).
  const belegt = await portPruefen(anleitung)
  if (belegt) {
    if (belegt.pid === process.pid) return { ok: false, fehler: texte.app.fehlerPortFlowForge(belegt.port) }
    if (!portFreimachen) return { ok: false, portBelegt: belegt }
    await prozessBeenden(belegt.pid, belegt.start)
    if (!(await aufPortFreiWarten(belegt.port)))
      return { ok: false, fehler: texte.app.fehlerPortNichtFrei(belegt.port) }
  }

  const app = {
    projektPfad,
    kind: null,
    pid: null,
    anleitung,
    zustand: 'startet',
    gestartetAm: new Date().toISOString(),
    beendetAm: null,
    code: null,
    ausgabe: '',
    sendeWecker: null,
    adresseGeoeffnet: false
  }
  apps.set(projektPfad, app)

  // Shell mit UTF-8-Codepage; Python-Kinder schreiben per Umgebung UTF-8;
  // Farbcodes werden vorn abgestellt (und hinten sicherheitshalber gestrippt).
  // Keine Eingabe (stdin ignoriert) — interaktive Programme laufen hier nicht.
  const umgebung = {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    FORCE_COLOR: '0',
    NO_COLOR: '1'
  }
  let kind
  try {
    kind = spawn('cmd.exe', ['/d', '/s', '/c', `"chcp 65001 >nul && ${anleitung.befehl}"`], {
      cwd: projektPfad,
      env: umgebung,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      windowsVerbatimArguments: true
    })
  } catch (fehler) {
    apps.delete(projektPfad)
    return { ok: false, fehler: texte.app.fehlerStart(String(fehler?.message ?? '')) }
  }
  app.kind = kind
  app.pid = kind.pid ?? null
  app.zustand = kind.pid ? 'laeuft' : 'startet'
  if (kind.pid) prozessWurzelMelden(appGruppenSchluessel(projektPfad), projektPfad, kind.pid)
  app.ausgabe = ausgabeAnhaengen('', texte.app.startZeile(anleitung.befehl) + '\n', AUSGABE_MAX_ZEICHEN)
  zustandMelden(app)
  ausgabeSofortMelden(app)

  // Ausgabe stückweise als UTF-8 dekodieren (Mehrbyte-Zeichen können auf zwei
  // Stücke fallen) — Standard- und Fehlerausgabe in einem Strom.
  const dekoder = { stdout: new TextDecoder('utf-8'), stderr: new TextDecoder('utf-8') }
  const aufnehmen = (quelle) => (stueck) => {
    const text = dekoder[quelle].decode(stueck, { stream: true })
    app.ausgabe = ausgabeAnhaengen(app.ausgabe, text, AUSGABE_MAX_ZEICHEN)
    ausgabeMelden(app)
  }
  kind.stdout.on('data', aufnehmen('stdout'))
  kind.stderr.on('data', aufnehmen('stderr'))
  kind.on('error', (fehler) => {
    app.ausgabe = ausgabeAnhaengen(app.ausgabe, texte.app.fehlerStart(String(fehler?.message ?? '')) + '\n', AUSGABE_MAX_ZEICHEN)
    ausgabeMelden(app)
  })
  kind.on('exit', (code, signal) => {
    if (apps.get(projektPfad) !== app) return
    app.zustand = 'beendet'
    app.code = code ?? (signal ? -1 : null)
    app.beendetAm = new Date().toISOString()
    // Nach einem Stopp über FlowForge steht die Stopp-Zeile schon da.
    if (!app.gestoppt)
      app.ausgabe = ausgabeAnhaengen(app.ausgabe, '\n' + texte.app.endeZeile(app.code) + '\n', AUSGABE_MAX_ZEICHEN)
    ausgabeSofortMelden(app)
    zustandMelden(app)
    // Was die Shell hinterließ (verwaiste Kinder), räumt die Gruppe ab.
    void prozessgruppeAbraeumen(appGruppenSchluessel(projektPfad))
  })

  // Web-Adresse: im Hintergrund warten, bis sie antwortet, dann Browser —
  // wie bisher, nur ohne den Knopf so lange zu blockieren.
  if (anleitung.adresse && istWebAdresse(anleitung.adresse))
    void appAdresseOeffnen(projektPfad, { warten: true })

  return { ok: true, ...zustandVon(app) }
}

// App stoppen: immer der ganze Baum per taskkill /T /F (ein einfaches
// Beenden trifft nur die Shell, nicht den Server), dazu alle vom Späher
// gemerkten Nachkommen. Wartet kurz auf das Ende.
export async function appStoppen(projektPfad) {
  const app = apps.get(projektPfad)
  if (!app || !app.kind || app.zustand === 'beendet') {
    // Nichts (mehr) zu stoppen — die Gruppe trotzdem abräumen.
    await prozessgruppeAbraeumen(appGruppenSchluessel(projektPfad))
    return { ok: true }
  }
  app.gestoppt = true
  app.ausgabe = ausgabeAnhaengen(app.ausgabe, '\n' + texte.app.stoppZeile + '\n', AUSGABE_MAX_ZEICHEN)
  ausgabeSofortMelden(app)
  const ende = new Promise((r) => {
    if (app.kind.exitCode !== null) return r()
    app.kind.once('exit', () => r())
    setTimeout(r, 3000)
  })
  await prozessgruppeAbraeumen(appGruppenSchluessel(projektPfad))
  await ende
  if (app.zustand !== 'beendet') {
    app.zustand = 'beendet'
    app.code = app.code ?? -1
    app.beendetAm = new Date().toISOString()
    zustandMelden(app)
  }
  return { ok: true }
}

export async function appNeustarten(projektPfad) {
  await appStoppen(projektPfad)
  const { anleitung } = startanleitungLaden(projektPfad)
  const port = anleitung?.adresse ? lokalerPort(anleitung.adresse) : null
  if (port) await aufPortFreiWarten(port)
  return appStarten(projektPfad)
}

// FlowForge-Ende / Projekt vergessen: alle Apps stoppen.
export async function alleAppsStoppen() {
  await Promise.all([...apps.keys()].map((pfad) => appStoppen(pfad)))
}
