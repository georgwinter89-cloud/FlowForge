// Startanleitung (SPEC §8): das maschinenlesbare Pflicht-Artefakt jedes
// Bau-Workflows. Der Agent legt sie über das start-Werkzeug an (nie direkt als
// Datei — startanleitung.json ist für ihn gesperrt wie alle Verwaltungsdateien);
// ausgeführt wird sie im App-Tab (appProzess.js, BAUPLAN 32): Befehl als
// Prozess mit sichtbarer Ausgabe, Adresse → Browser, sobald sie antwortet.
import fs from 'node:fs'
import path from 'node:path'
import { texte } from '../shared/texte.js'

export const STARTANLEITUNG_DATEI = 'startanleitung.json'

const BESCHREIBUNG_MAX = 200
const BEFEHL_MAX = 500
const ADRESSE_MAX = 500

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
  // gesetztVon (0.46.2): die Block-Instanz, die die Anleitung zuletzt gesetzt
  // hat — wird durchgereicht, nicht geprüft (Kennung, kein Nutzertext). null,
  // wenn sie fehlt (alte Dateien, Chat).
  const gesetztVon =
    typeof eingabe?.gesetztVon === 'string' && eingabe.gesetztVon.trim() ? eingabe.gesetztVon.trim() : null
  return { anleitung: { beschreibung, befehl, adresse, gesetztVon } }
}

// gesetztVon (0.46.2): Der Block, der die Anleitung setzt, wird in der Datei
// vermerkt — in der Welle überschreiben sich Bauer sonst wortlos, und der
// Rauchtest wüsste nicht, wem er eine Nachbesserungs-Runde geben soll.
// Liefert zusätzlich `vorher`: die vorher gültige Anleitung (samt gesetztVon)
// oder null — daraus baut der Lauf den Überschreiben-Ticker.
export function startanleitungSetzen(projektPfad, eingabe, { gesetztVon = null } = {}) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const geprueft = pruefeAnleitung(projektPfad, { ...eingabe, gesetztVon })
  if (geprueft.fehler) return { ok: false, fehler: geprueft.fehler }
  const vorher = startanleitungLaden(projektPfad).anleitung
  const anleitung = { ...geprueft.anleitung, geaendertAm: new Date().toISOString() }
  const datei = path.join(projektPfad, STARTANLEITUNG_DATEI)
  const tmp = datei + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(anleitung, null, 2), 'utf8')
  fs.renameSync(tmp, datei)
  return { ok: true, anleitung, vorher }
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
