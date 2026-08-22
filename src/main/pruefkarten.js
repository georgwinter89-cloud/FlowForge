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
import { istMappenErklaerung, istKartenOrdner } from './pruefmappe.js'
import { kartenOrdnerName } from '../shared/pruefkartenRegeln.js'

const PRUEFMAPPE = 'pruefung'

// Gleicher Schlüssel-Mechanismus wie bei den Sicherungspunkten: ein kurzer,
// stabiler Ordnername je Projektpfad.
// Exportiert seit BAUPLAN 52: Der Stempel der Prüfkarten (pruefkartenStempel.js)
// wohnt im selben Projektordner des verwalteten Bereichs. Die Rechnung wird von
// dort IMPORTIERT statt kopiert — zwei Fassungen desselben Schlüssels wären
// genau die Sorte Fehler, die erst auffällt, wenn ein Archiv nicht mehr
// gefunden wird.
export function projektSchluessel(projektPfad) {
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
//
// Seit BAUPLAN 52 OHNE Prüfordner, direkt in der Mappe. Von BAUPLAN 41 bis
// dahin lag er IM Prüfordner der Instanz — eine Ebene tiefer, als die Dateien
// geschrieben worden waren. Gemessen am echten Archiv (22.08.2026): 89 von 135
// aufbewahrten Prüfdateien rechnen sich den Projektordner über feste
// Aufwärts-Schritte aus (resolve(HIER, "..", "..")); für sie alle zeigte er
// damit auf pruefung/ statt aufs Projekt. Die Wiederholungsprüfung war also für
// die Mehrzahl der Karten schon kaputt — nur nie aufgefallen, weil sie nie
// benutzt wurde.
//
// Der Grund von damals fällt mit weg: Dieselbe Karte an zwei Prüfern braucht
// keine zwei Kopien mehr, weil FlowForge die Karte seit BAUPLAN 52 selbst
// ausführt, statt sie einem Agenten hinzulegen. Die Regel „gewinnt die zuletzt
// bestandene Fassung" bleibt.
//
// Der Name selbst wird in src/shared/pruefkartenRegeln.js gerechnet: Die
// Laufzeit muss denselben Ordnernamen bilden können, ohne diese Datei (und mit
// ihr Electron) zu laden.
export function pruefkartenOrdner(kartenId) {
  return kartenOrdnerName(kartenId)
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
export function pruefkarteEinlegen(projektPfad, kartenId) {
  // Ohne Kartenkennung gibt es keinen Kartenordner (kartenOrdnerName liefert
  // dann einen leeren Namen). Der Pfad zeigte sonst auf die ganze Prüfmappe —
  // und das Archiv landete lose zwischen den Prüfungen dieses Laufs.
  const ordner = pruefkartenOrdner(kartenId)
  if (!ordner) return false
  const quelle = archivPfad(projektPfad, kartenId)
  if (!hatDateien(quelle)) return false
  const ziel = mappenPfad(projektPfad, ordner)
  fs.mkdirSync(ziel, { recursive: true })
  fs.cpSync(quelle, ziel, { recursive: true })
  return true
}

// Nach einer bestandenen Prüfung: Die Fassung im Unterordner ersetzt die
// aufbewahrte — die Karte veraltet nicht. Ist der Unterordner leer oder weg,
// bleibt das Archiv unangetastet. Hängt dieselbe Karte an zwei Prüfern, gewinnt
// die zuletzt bestandene Fassung — ehrliche Grenze, dafür nie ein Mischmasch.
export function pruefkartenArchivAuffrischen(projektPfad, kartenId) {
  // Wie beim Einlegen: Ohne Kartenkennung gibt es keinen Ordner. Hier wöge der
  // Fehler schwerer — die ganze Prüfmappe wanderte hinter die Karte ins Archiv.
  const ordner = pruefkartenOrdner(kartenId)
  if (!ordner) return
  const quelle = mappenPfad(projektPfad, ordner)
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
//
// Seit BAUPLAN 52 liegen die Ordner eingelegter Prüfkarten in der WURZEL der
// Mappe, nicht mehr im Prüfordner. Der Verzeichnis-Zweig deckt beides ab: Ohne
// Prüfordner zählen ohnehin nur lose Dateien (jeder Ordner in der Wurzel bleibt
// draußen — also auch pruefkarte-*), mit Prüfordner bleibt die Ausnahme als
// Gürtel-und-Hosenträger stehen, falls dort doch je einer auftaucht. Sonst
// wanderten FlowForges eigene abgespielte Karten hinter die frische Prüfkarte
// und würden beim nächsten Lauf als „Prüfung dieses Laufs" wieder eingelegt.
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
      ? Boolean(pruefOrdner) && !istKartenOrdner(e.name)
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
