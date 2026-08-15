// Einklapp-Zustände je Projekt (BAUPLAN 30): Karten-Gruppen, Themen und
// Bibliotheks-Klappen merken sich offen/zu — im Datenordner je Projektpfad,
// NICHT in projekt.json (die ist Teil der Sicherungspunkte: jedes Auf-/
// Zuklappen machte sonst die Wiederherstellen-Vorschau schmutzig).
//
// Datei: userData/klappen.json = { [projektPfad]: { [schluessel]: offen } }.
// Schlüssel sind freie Strings der Oberfläche (z.B. 'karten:erledigt',
// 'thema:Login', 'bib:uebung'); Werte sind Booleans (true = offen).
// Unbekannte oder kaputte Datei → leer; geschrieben wird atomar (tmp + rename,
// wie projekte.js).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function dateiPfad() {
  return path.join(app.getPath('userData'), 'klappen.json')
}

function alleLaden() {
  try {
    const roh = JSON.parse(fs.readFileSync(dateiPfad(), 'utf8'))
    return roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {}
  } catch {
    // Noch keine Datei oder kaputt — keine gemerkten Zustände.
    return {}
  }
}

// Nur Booleans unter String-Schlüsseln durchlassen — der Renderer schickt das
// ganze Objekt, die Datei soll trotzdem sauber bleiben.
function zustaendeSaeubern(roh) {
  const sauber = {}
  if (!roh || typeof roh !== 'object') return sauber
  for (const [schluessel, wert] of Object.entries(roh)) {
    if (typeof schluessel === 'string' && schluessel && typeof wert === 'boolean')
      sauber[schluessel] = wert
  }
  return sauber
}

export function klappenLaden(projektPfad) {
  const pfad = String(projektPfad ?? '')
  if (!pfad) return { ok: true, zustaende: {} }
  return { ok: true, zustaende: zustaendeSaeubern(alleLaden()[pfad]) }
}

export function klappenSpeichern(projektPfad, zustaende) {
  const pfad = String(projektPfad ?? '')
  if (!pfad) return { ok: false }
  const alle = alleLaden()
  alle[pfad] = zustaendeSaeubern(zustaende)
  try {
    const tmp = dateiPfad() + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(alle, null, 2), 'utf8')
    fs.renameSync(tmp, dateiPfad())
    return { ok: true }
  } catch {
    // Klappen-Zustände sind Komfort — ein Schreibfehler darf nichts blockieren.
    return { ok: false }
  }
}
