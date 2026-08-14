// Startanleitung (SPEC §8): das maschinenlesbare Pflicht-Artefakt jedes
// Bau-Workflows. Der Agent legt sie über das start-Werkzeug an (nie direkt als
// Datei — startanleitung.json ist für ihn gesperrt wie alle Verwaltungsdateien),
// und der „App starten"-Knopf führt sie aus: Befehl → eigenes Konsolenfenster,
// Adresse → Browser (bei Web-Apps erst, wenn die Adresse erreichbar ist).
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import { spawn } from 'node:child_process'
import { shell } from 'electron'
import { texte } from '../shared/texte.js'

export const STARTANLEITUNG_DATEI = 'startanleitung.json'

const BESCHREIBUNG_MAX = 200
const BEFEHL_MAX = 500
const ADRESSE_MAX = 500
// Web-Apps brauchen Anlaufzeit: so lange wartet FlowForge höchstens, bis die
// Adresse antwortet, bevor der Browser trotzdem geöffnet wird.
const WARTE_HOECHSTENS_MS = 30000
const WARTE_ABSTAND_MS = 700

function istWebAdresse(adresse) {
  return /^https?:\/\//i.test(adresse)
}

// Datei-Adressen müssen im Projektordner bleiben — kein Ausbruch per „.." oder
// absolutem Pfad (gleiche Regel wie bei den Schreib-Werkzeugen des Motors).
function dateiImProjekt(projektPfad, adresse) {
  if (path.isAbsolute(adresse)) return false
  const wurzel = path.resolve(projektPfad).toLowerCase()
  const ziel = path.resolve(projektPfad, adresse).toLowerCase()
  const relativ = path.relative(wurzel, ziel)
  return relativ !== '' && !relativ.startsWith('..') && !path.isAbsolute(relativ)
}

// Harte Validierung — dieselbe für Werkzeug und Datei-Ladung. Liefert
// { anleitung } mit bereinigten Werten oder { fehler } mit Agenten-Text.
function pruefeAnleitung(projektPfad, eingabe) {
  const beschreibung = String(eingabe?.beschreibung ?? '').trim()
  const befehl = String(eingabe?.befehl ?? '').trim()
  const adresse = String(eingabe?.adresse ?? '').trim()
  if (!beschreibung || beschreibung.length > BESCHREIBUNG_MAX)
    return { fehler: texte.agentenStart.fehlerBeschreibung(BESCHREIBUNG_MAX, beschreibung.length) }
  if (!befehl && !adresse) return { fehler: texte.agentenStart.fehlerQuelleFehlt }
  if (befehl.length > BEFEHL_MAX || adresse.length > ADRESSE_MAX)
    return { fehler: texte.agentenStart.fehlerZuLang }
  if (adresse && !istWebAdresse(adresse) && !dateiImProjekt(projektPfad, adresse))
    return { fehler: texte.agentenStart.fehlerAdresse }
  return { anleitung: { beschreibung, befehl, adresse } }
}

export function startanleitungSetzen(projektPfad, eingabe) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const geprueft = pruefeAnleitung(projektPfad, eingabe)
  if (geprueft.fehler) return { ok: false, fehler: geprueft.fehler }
  const anleitung = { ...geprueft.anleitung, geaendertAm: new Date().toISOString() }
  const datei = path.join(projektPfad, STARTANLEITUNG_DATEI)
  const tmp = datei + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(anleitung, null, 2), 'utf8')
  fs.renameSync(tmp, datei)
  return { ok: true, anleitung }
}

// Liefert die gültige Startanleitung — oder anleitung: null, wenn keine da ist.
// Eine kaputte oder ungültige Datei zählt als „keine": die Pflicht-Prüfung im
// Lauf fordert sie dann erneut ein.
export function startanleitungLaden(projektPfad) {
  let roh
  try {
    roh = JSON.parse(fs.readFileSync(path.join(projektPfad, STARTANLEITUNG_DATEI), 'utf8'))
  } catch {
    return { ok: true, anleitung: null }
  }
  const geprueft = pruefeAnleitung(projektPfad, roh)
  if (geprueft.fehler) return { ok: true, anleitung: null }
  return { ok: true, anleitung: geprueft.anleitung }
}

export function startanleitungVorhanden(projektPfad) {
  return startanleitungLaden(projektPfad).anleitung !== null
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

async function aufAdresseWarten(adresse) {
  const schluss = Date.now() + WARTE_HOECHSTENS_MS
  while (Date.now() < schluss) {
    if (await einmalAnfragen(adresse)) return
    await new Promise((r) => setTimeout(r, WARTE_ABSTAND_MS))
  }
  // Nicht erreichbar geworden: Browser trotzdem öffnen — Georg sieht dann die
  // Meldung der Seite und kann neu laden, statt dass gar nichts passiert.
}

export async function appStarten(projektPfad) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const { anleitung } = startanleitungLaden(projektPfad)
  if (!anleitung) return { ok: false, fehler: texte.startanleitung.fehlerKeine }

  if (anleitung.befehl) {
    // Eigenes, sichtbares Konsolenfenster über „start": cmd /k hält das Fenster
    // nach dem Befehl offen. Der leere Titel '' wird von Node als "" übergeben —
    // ohne gequoteten Titel würde „start" das nächste Wort als Titel schlucken.
    const kind = spawn('cmd.exe', ['/c', 'start', '', 'cmd', '/k', anleitung.befehl], {
      cwd: projektPfad,
      detached: true
    })
    kind.unref()
  }

  if (anleitung.adresse) {
    try {
      if (istWebAdresse(anleitung.adresse)) {
        // Erst warten, bis der eben gestartete Server antwortet — sonst zeigt
        // der Browser „Seite nicht erreichbar".
        if (anleitung.befehl) await aufAdresseWarten(anleitung.adresse)
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
  }

  return { ok: true }
}
