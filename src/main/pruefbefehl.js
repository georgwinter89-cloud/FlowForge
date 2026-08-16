// Prüfbefehl (BAUPLAN 35/41, SPEC §4.3): Der Prüfer hinterlässt neben seinen
// Tests einen maschinenlesbaren Startbefehl für seinen Prüfordner — damit
// FlowForge in einer Reparatur-Runde selbst nachprüfen kann, ohne einen
// Prüfer-Agenten zu bezahlen (das „Tor ohne KI"). Angelegt wird er
// ausschließlich über das Werkzeug pruefbefehl_setzen (wie die Startanleitung);
// die Datei pruefbefehl.json ist für den Agenten gesperrt wie alle
// Verwaltungsdateien.
//
// Je Prüf-Instanz einer (BAUPLAN 41): Liegen zwei Prüfer im Schaubild, hätte
// ein gemeinsamer Befehl zwei stille Fehler — der zweite Prüfer bestünde seine
// Pflicht, weil der erste gesetzt hat, und das Tor urteilte über einen fremden
// Zweig. Geschlüsselt wird nach der Instanz-Kennung der Blockkarte.
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

// Ein Lauf ohne Instanz-Kennung (Ein-Block-Sonderfälle, Altbestand) landet
// unter einem festen Ersatzschlüssel — Setzen und Laden sehen denselben.
function schluesselVon(instanzId) {
  return String(instanzId ?? '').trim() || 'ohne-instanz'
}

function fehlerText(urteil) {
  if (urteil.fehlerArt === 'werkzeug')
    return texte.agentenPruefbefehl.fehlerWerkzeug(urteil.werkzeug)
  return texte.agentenPruefbefehl[
    urteil.fehlerArt === 'zuLang' ? 'fehlerZuLang' : urteil.fehlerArt === 'verkettung' ? 'fehlerVerkettung' : 'fehlerLeer'
  ]
}

// Alle Befehle einer Datei als Map instanzId → befehl. Tolerant gegenüber dem
// Format vor Bauschritt 41 ({ befehl }): Ein solcher Eintrag gilt für jede
// Instanz — sonst verlöre jedes Projekt beim Umstieg seine Baseline.
function alleAusDatei(pfad) {
  try {
    const roh = JSON.parse(fs.readFileSync(pfad, 'utf8'))
    const eintraege = new Map()
    if (roh?.befehle && typeof roh.befehle === 'object')
      for (const [schluessel, wert] of Object.entries(roh.befehle)) {
        const urteil = pruefbefehlPruefen(wert?.befehl)
        if (!urteil.fehlerArt) eintraege.set(schluessel, urteil.befehl)
      }
    const alt = pruefbefehlPruefen(roh?.befehl)
    return { eintraege, fuerAlle: alt.fehlerArt ? null : alt.befehl }
  } catch {
    return { eintraege: new Map(), fuerAlle: null }
  }
}

// Liefert den gültigen Prüfbefehl dieser Instanz — oder null. Eine kaputte oder
// inzwischen unzulässige Datei zählt als „keiner": das Tor bleibt dann einfach
// zu, und die Pflicht-Prüfung im Lauf fordert ihn erneut ein.
function ausDatei(pfad, instanzId) {
  const { eintraege, fuerAlle } = alleAusDatei(pfad)
  return eintraege.get(schluesselVon(instanzId)) ?? fuerAlle
}

function schreiben(pfad, eintraege) {
  const inhalt = { befehle: Object.fromEntries(eintraege) }
  fs.mkdirSync(path.dirname(pfad), { recursive: true })
  const tmp = pfad + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(inhalt, null, 2), 'utf8')
  fs.renameSync(tmp, pfad)
}

export function pruefbefehlSetzen(projektPfad, instanzId, roh) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const urteil = pruefbefehlPruefen(roh)
  if (urteil.fehlerArt) return { ok: false, fehler: fehlerText(urteil) }
  // Die Befehle der anderen Prüf-Instanzen bleiben stehen — jeder Prüfer setzt
  // nur seinen eigenen.
  const { eintraege } = alleAusDatei(datei(projektPfad))
  const bestand = new Map(
    [...eintraege].map(([schluessel, befehl]) => [schluessel, { befehl, geaendertAm: null }])
  )
  bestand.set(schluesselVon(instanzId), {
    befehl: urteil.befehl,
    geaendertAm: new Date().toISOString()
  })
  schreiben(datei(projektPfad), bestand)
  return { ok: true, befehl: urteil.befehl }
}

export function pruefbefehlLaden(projektPfad, instanzId) {
  return ausDatei(datei(projektPfad), instanzId)
}

export function pruefbefehlVorhanden(projektPfad, instanzId) {
  return pruefbefehlLaden(projektPfad, instanzId) !== null
}

// Laufstart: Die Prüfbefehle des vorigen Laufs gehören nicht zu diesem — sie
// zeigen auf Prüfungen, die gleich geleert werden.
export function pruefbefehlLeeren(projektPfad) {
  try {
    fs.rmSync(datei(projektPfad), { force: true })
  } catch {
    // Eine klemmende Datei darf den Start nicht verhindern.
  }
}

// Nach bestandener Prüfung: den Prüfbefehl DIESER Instanz aufbewahren — daraus
// wird beim nächsten Laufstart ihre Baseline „vorher schon rot". Die Einträge
// der anderen Prüfer bleiben unangetastet (sonst löschte der zweite Prüfer die
// Baseline des ersten).
export function pruefbefehlArchivieren(projektPfad, instanzId) {
  const befehl = pruefbefehlLaden(projektPfad, instanzId)
  if (!befehl) return
  try {
    const ziel = archivDatei(projektPfad)
    const { eintraege } = alleAusDatei(ziel)
    const bestand = new Map(
      [...eintraege].map(([schluessel, alterBefehl]) => [
        schluessel,
        { befehl: alterBefehl, geaendertAm: null }
      ])
    )
    bestand.set(schluesselVon(instanzId), { befehl, geaendertAm: new Date().toISOString() })
    schreiben(ziel, bestand)
  } catch {
    // Ein klemmendes Archiv kostet nur die Baseline des nächsten Laufs.
  }
}

export function pruefbefehlArchivLaden(projektPfad, instanzId) {
  return ausDatei(archivDatei(projektPfad), instanzId)
}
