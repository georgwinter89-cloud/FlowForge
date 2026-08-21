// Die leere Prüfmappe erklärt sich (Zwischenschritt 0.51.6): FlowForge leert
// pruefung/ beim Start jedes Laufs. Blöcke, die den Projektordner ansehen,
// meldeten den leeren — oder beim allerersten Lauf gar nicht vorhandenen —
// Ordner regelmäßig als Fund: Er sieht aus wie eine vergessene Testabdeckung.
//
// Gürtel und Hosenträger: Der Auftragstext sagt es den Blöcken vorher
// (PRUEFMAPPE_HINWEIS in shared/blockKatalog.js), diese Datei sagt es dem, der
// trotzdem nachsieht.
//
// Die Erklärung ist KEINE Prüfung. Überall, wo FlowForge Prüfdateien zählt,
// muss sie draußen bleiben — sonst gälte eine Mappe, in der nur sie liegt, als
// „hat Prüfungen" (Baseline-Scheinbefund, Prüfmappen-Ansicht), und sie selbst
// würde als einzige „Prüfung" hinter einer Prüfkarte archiviert. Deshalb steht
// die Ausnahme genau einmal hier und wird von allen drei Zählstellen benutzt.
import fs from 'node:fs'
import path from 'node:path'
import { texte } from '../shared/texte.js'

const PRUEFMAPPE = 'pruefung'
export const MAPPEN_ERKLAERUNG = 'LIESMICH.md'

// Ist dieser Eintrag die Erklärung? Erwartet den Pfad RELATIV zur Prüfmappe
// (also 'LIESMICH.md', nicht 'pruefer-abc/LIESMICH.md'): Nur die Datei direkt
// in pruefung/ stammt von FlowForge — was ein Prüf-Block in seinen eigenen
// Ordner schreibt, ist seine Prüfung und zählt.
// Groß-/Kleinschreibung wird ignoriert: Windows-Dateisysteme unterscheiden sie
// nicht, ein Verzeichnis-Eintrag kann also 'liesmich.md' heißen.
export function istMappenErklaerung(pfadInDerMappe) {
  return String(pfadInDerMappe ?? '').toLowerCase() === MAPPEN_ERKLAERUNG.toLowerCase()
}

// Beim Laufstart: die Erklärung in die frisch geleerte Mappe legen — und auch
// dann, wenn es pruefung/ noch gar nicht gab: Genau beim allerersten Lauf eines
// Projekts wundert sich der erste Block am ehesten.
// Zeitpunkt: VOR dem Sicherungspunkt „Stand vor Lauf". Die Prüfmappe ist nur
// vom Diff der Reparatur-Runden ausgenommen, nicht vom Sicherungspunkt selbst —
// ein Rollback mitten im Lauf würde die Erklärung sonst wieder entfernen.
export function mappenErklaerungSchreiben(projektPfad) {
  try {
    const mappe = path.join(projektPfad, PRUEFMAPPE)
    fs.mkdirSync(mappe, { recursive: true })
    fs.writeFileSync(
      path.join(mappe, MAPPEN_ERKLAERUNG),
      texte.agentenPruefordner.erklaerung,
      'utf8'
    )
    return true
  } catch {
    // Eine klemmende Datei darf den Laufstart nicht verhindern — dann fehlt
    // eben die Erklärung in der Mappe; die Aufträge sagen dasselbe.
    return false
  }
}

// Hat der Prüfordner dieser Instanz überhaupt Prüfungen? Ohne sie misst ein
// aufbewahrter Prüfbefehl nichts Sinnvolles (die Baseline bliebe ein
// Scheinbefund). Ohne eigenen Ordner (Übungs-Prüfer) zählt die ganze Mappe —
// und dort liegt die Erklärung, die nicht mitzählt.
export function pruefmappeHatDateien(projektPfad, pruefOrdner = '') {
  try {
    const eintraege = fs.readdirSync(
      path.join(projektPfad, PRUEFMAPPE, ...(pruefOrdner ? [pruefOrdner] : []))
    )
    return eintraege.some((name) => !istMappenErklaerung(pruefOrdner ? pruefOrdner + '/' + name : name))
  } catch {
    return false
  }
}
