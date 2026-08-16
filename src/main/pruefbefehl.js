// Prüfbefehl (BAUPLAN 35, SPEC §4.3): Der Prüfer hinterlässt neben seinen Tests
// einen maschinenlesbaren Startbefehl für die Prüfmappe — damit FlowForge in
// einer Reparatur-Runde selbst nachprüfen kann, ohne einen Prüfer-Agenten zu
// bezahlen (das „Tor ohne KI"). Angelegt wird er ausschließlich über das
// Werkzeug pruefbefehl_setzen (wie die Startanleitung); die Datei
// pruefbefehl.json ist für den Agenten gesperrt wie alle Verwaltungsdateien.
//
// Die Datei gehört zum LAUF, nicht zum Projektstand: Der Laufstart leert sie
// (wie die Prüfmappe), und sie ist aus den Sicherungspunkten ausgenommen — eine
// Wiederherstellung soll keinen Prüfbefehl zurückholen, dessen Prüfungen es
// nicht mehr gibt. Das Gedächtnis über Läufe hinweg ist das Archiv im
// verwalteten Bereich außerhalb des Projektordners (wie bei den Prüfkarten):
// daraus speist sich die Baseline „vorher schon rot" beim nächsten Laufstart.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import { pruefbefehlPruefen } from '../shared/torRegeln.js'

export const PRUEFBEFEHL_DATEI = 'pruefbefehl.json'

function datei(projektPfad) {
  return path.join(projektPfad, PRUEFBEFEHL_DATEI)
}

// Gleicher Schlüssel-Mechanismus wie bei Sicherungspunkten und Prüfkarten.
function archivDatei(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(app.getPath('userData'), 'pruefbefehl', schluessel + '.json')
}

function fehlerText(urteil) {
  if (urteil.fehlerArt === 'werkzeug')
    return texte.agentenPruefbefehl.fehlerWerkzeug(urteil.werkzeug)
  return texte.agentenPruefbefehl[
    urteil.fehlerArt === 'zuLang' ? 'fehlerZuLang' : urteil.fehlerArt === 'verkettung' ? 'fehlerVerkettung' : 'fehlerLeer'
  ]
}

export function pruefbefehlSetzen(projektPfad, roh) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const urteil = pruefbefehlPruefen(roh)
  if (urteil.fehlerArt) return { ok: false, fehler: fehlerText(urteil) }
  const inhalt = { befehl: urteil.befehl, geaendertAm: new Date().toISOString() }
  const tmp = datei(projektPfad) + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(inhalt, null, 2), 'utf8')
  fs.renameSync(tmp, datei(projektPfad))
  return { ok: true, befehl: urteil.befehl }
}

// Liefert den gültigen Prüfbefehl — oder null. Eine kaputte oder inzwischen
// unzulässige Datei zählt als „keiner": das Tor bleibt dann einfach zu, und die
// Pflicht-Prüfung im Lauf fordert ihn erneut ein.
function ausDatei(pfad) {
  try {
    const roh = JSON.parse(fs.readFileSync(pfad, 'utf8'))
    const urteil = pruefbefehlPruefen(roh?.befehl)
    return urteil.fehlerArt ? null : urteil.befehl
  } catch {
    return null
  }
}

export function pruefbefehlLaden(projektPfad) {
  return ausDatei(datei(projektPfad))
}

export function pruefbefehlVorhanden(projektPfad) {
  return pruefbefehlLaden(projektPfad) !== null
}

// Laufstart: Der Prüfbefehl des vorigen Laufs gehört nicht zu diesem — er zeigt
// auf Prüfungen, die gleich geleert werden.
export function pruefbefehlLeeren(projektPfad) {
  try {
    fs.rmSync(datei(projektPfad), { force: true })
  } catch {
    // Eine klemmende Datei darf den Start nicht verhindern.
  }
}

// Nach bestandener Prüfung: den Prüfbefehl dieses Laufs aufbewahren — daraus
// wird beim nächsten Laufstart die Baseline „vorher schon rot".
export function pruefbefehlArchivieren(projektPfad) {
  const befehl = pruefbefehlLaden(projektPfad)
  if (!befehl) return
  try {
    const ziel = archivDatei(projektPfad)
    fs.mkdirSync(path.dirname(ziel), { recursive: true })
    fs.writeFileSync(ziel, JSON.stringify({ befehl, geaendertAm: new Date().toISOString() }, null, 2), 'utf8')
  } catch {
    // Ein klemmendes Archiv kostet nur die Baseline des nächsten Laufs.
  }
}

export function pruefbefehlArchivLaden(projektPfad) {
  return ausDatei(archivDatei(projektPfad))
}
