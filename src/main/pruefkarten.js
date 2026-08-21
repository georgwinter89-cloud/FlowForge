// Prüfkarten-Archiv (SPEC §3.1/§4.3, BAUPLAN 18): Nach jeder bestandenen
// Prüfung bewahrt FlowForge die Prüfdateien des Laufs hinter einer Prüfkarte
// auf — im verwalteten Bereich außerhalb des Projektordners (wie die
// Sicherungspunkte): kein Agent sieht das Archiv, es kostet keinen Lauf
// Kontext. Zieht der Nutzer eine Prüfkarte auf einen Prüf-Block, legt
// FlowForge die aufbewahrten Dateien beim Laufstart zurück in die Prüfmappe.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { istMappenErklaerung } from './pruefmappe.js'

const PRUEFMAPPE = 'pruefung'

// Gleicher Schlüssel-Mechanismus wie bei den Sicherungspunkten: ein kurzer,
// stabiler Ordnername je Projektpfad.
function projektSchluessel(projektPfad) {
  return crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
}

function archivPfad(projektPfad, kartenId) {
  return path.join(app.getPath('userData'), 'pruefkarten', projektSchluessel(projektPfad), kartenId)
}

// Unterordner in der Prüfmappe, in dem die Dateien einer eingelegten Prüfkarte
// liegen — je Karte ein eigener, damit nichts kollidiert und die (evtl. vom
// Prüfer angepasste) Fassung nach dem Lauf eindeutig zurück ins Archiv wandert.
// Seit BAUPLAN 41 liegt er im Prüfordner der Instanz, auf die der Nutzer die
// Karte gezogen hat: Dieselbe Karte darf an zwei Prüfern hängen, und jeder
// arbeitet dann mit seiner eigenen Kopie.
export function pruefkartenOrdner(kartenId, pruefOrdner = '') {
  const eigen = 'pruefkarte-' + kartenId.slice(0, 8)
  return pruefOrdner ? pruefOrdner + '/' + eigen : eigen
}

function mappenPfad(projektPfad, unterordner) {
  return unterordner
    ? path.join(projektPfad, PRUEFMAPPE, ...unterordner.split('/'))
    : path.join(projektPfad, PRUEFMAPPE)
}

function hatDateien(ordner) {
  try {
    return fs.readdirSync(ordner).length > 0
  } catch {
    return false
  }
}

export function pruefkartenArchivHatDateien(projektPfad, kartenId) {
  return hatDateien(archivPfad(projektPfad, kartenId))
}

// Beim Laufstart (nach der automatischen Leerung): die aufbewahrten Dateien
// einer gezogenen Prüfkarte in den Prüfordner ihres Prüfers legen.
export function pruefkarteEinlegen(projektPfad, kartenId, pruefOrdner = '') {
  const quelle = archivPfad(projektPfad, kartenId)
  if (!hatDateien(quelle)) return false
  const ziel = mappenPfad(projektPfad, pruefkartenOrdner(kartenId, pruefOrdner))
  fs.mkdirSync(ziel, { recursive: true })
  fs.cpSync(quelle, ziel, { recursive: true })
  return true
}

// Nach einer bestandenen Prüfung: Die Fassung im Unterordner ersetzt die
// aufbewahrte — die Karte veraltet nicht. Ist der Unterordner leer oder weg,
// bleibt das Archiv unangetastet. Hängt dieselbe Karte an zwei Prüfern, gewinnt
// die zuletzt bestandene Fassung — ehrliche Grenze, dafür nie ein Mischmasch.
export function pruefkartenArchivAuffrischen(projektPfad, kartenId, pruefOrdner = '') {
  const quelle = mappenPfad(projektPfad, pruefkartenOrdner(kartenId, pruefOrdner))
  if (!hatDateien(quelle)) return
  const ziel = archivPfad(projektPfad, kartenId)
  fs.rmSync(ziel, { recursive: true, force: true })
  fs.mkdirSync(ziel, { recursive: true })
  fs.cpSync(quelle, ziel, { recursive: true })
}

// Nach einer bestandenen Prüfung: die frischen Prüfungen dieses Laufs hinter
// der neu angelegten Prüfkarte aufbewahren — seit BAUPLAN 41 nur die aus dem
// EIGENEN Prüfordner. Vorher nahm der erste bestehende Prüfer die Tests aller
// mit ins Archiv, und die Wiederholungsprüfung fuhr fremde Zweige mit.
// Ausgenommen bleiben die Unterordner eingelegter Prüfkarten (sie haben ihr
// eigenes Archiv). Ohne Prüfordner (nur-lesende Übungs-Prüfer, Altbestand)
// zählen allein die losen Dateien direkt in der Mappe — ohne die Erklärung,
// die FlowForge beim Leeren dort zurücklässt (0.51.6): Sie ist keine Prüfung
// und würde sonst als einzige „Prüfung" hinter der Karte aufbewahrt und beim
// nächsten Lauf wieder eingelegt.
export function pruefungenArchivieren(projektPfad, kartenId, pruefOrdner = '') {
  const mappe = mappenPfad(projektPfad, pruefOrdner)
  let eintraege = []
  try {
    eintraege = fs.readdirSync(mappe, { withFileTypes: true })
  } catch {
    return
  }
  const eigene = eintraege.filter((e) =>
    e.isDirectory()
      ? Boolean(pruefOrdner) && !e.name.startsWith('pruefkarte-')
      : !istMappenErklaerung(pruefOrdner ? pruefOrdner + '/' + e.name : e.name)
  )
  if (eigene.length === 0) return
  const ziel = archivPfad(projektPfad, kartenId)
  fs.mkdirSync(ziel, { recursive: true })
  for (const e of eigene)
    fs.cpSync(path.join(mappe, e.name), path.join(ziel, e.name), { recursive: true })
}

// Löschen einer Prüfkarte räumt ihre aufbewahrten Prüfdateien mit weg.
export function pruefkartenArchivLoeschen(projektPfad, kartenId) {
  try {
    fs.rmSync(archivPfad(projektPfad, kartenId), { recursive: true, force: true })
  } catch {
    // Ein klemmendes Archiv blockiert nicht das Löschen der Karte.
  }
}

// Titel und Text der Prüfkarte kommen seit dem Lieferschein (BAUPLAN 42) aus
// den gemeldeten Feldern pruefkarteTitel/pruefkarteText — die Regel dafür
// steht in lieferschein.js (pruefkarteAusMeldungen), die harten Längengrenzen
// setzt pruefkarteAnlegen durch. Fehlen die Felder, greift der Ersatz aus
// texte.pruefkarten.
