// Harte Regeln für Workflow-Ketten (SPEC §4): braucht/liefert-Prüfung beim
// Zusammenstecken, Pflichtfelder vor dem Start, Arbeitsauftrag mit Feldwerten.
// Geprüft wird im Hauptprozess; die Oberfläche nutzt dieselben Regeln für
// sofortige Rückmeldung beim Stecken.
import { texte } from './texte.js'
import { blockDefinition } from './blockKatalog.js'

// Liefert null, wenn die Kette zusammenpasst — sonst eine Fehlermeldung.
// Regel: Alles, was ein Block braucht, muss ein Block davor liefern.
export function pruefeKette(bloecke) {
  const geliefert = new Set()
  for (const eintrag of bloecke) {
    const def = blockDefinition(eintrag.blockId)
    if (!def) return texte.kette.unbekannterBlock
    for (const bedarf of def.braucht)
      if (!geliefert.has(bedarf)) return texte.kette.fehlerBraucht(def.name, bedarf)
    for (const gabe of def.liefert) geliefert.add(gabe)
  }
  return null
}

// Sperren-Mechanik „Pflichtfeld leer = Lauf hält an" (SPEC §4.2):
// liefert null, wenn alle Pflichtfelder gefüllt sind — sonst eine Fehlermeldung.
export function pruefePflichtfelder(bloecke) {
  for (const eintrag of bloecke) {
    const def = blockDefinition(eintrag.blockId)
    if (!def) return texte.kette.unbekannterBlock
    for (const feld of def.felder) {
      const wert = (eintrag.feldWerte?.[feld.id] ?? '').trim()
      if (feld.pflicht && !wert) return texte.kette.fehlerPflichtfeld(def.name, feld.label)
    }
  }
  return null
}

// Setzt die Feldwerte in den Arbeitsauftrag ein ({{feldId}}-Platzhalter).
export function auftragMitFeldern(def, feldWerte) {
  let auftrag = def.auftrag
  for (const feld of def.felder)
    auftrag = auftrag.replaceAll('{{' + feld.id + '}}', (feldWerte?.[feld.id] ?? '').trim())
  return auftrag
}

// Ziel der Fehlschlag-Rückführung „zurück zu Block X": die gespeicherte Wahl,
// wenn sie vor dem Prüfer liegt — sonst der Block direkt davor. null = keiner da.
export function rueckfuehrungsZiel(bloecke, prueferIndex) {
  if (prueferIndex <= 0) return null
  const gewaehlt = bloecke[prueferIndex].zurueckZu
  if (gewaehlt) {
    const ziel = bloecke.findIndex((b) => b.instanzId === gewaehlt)
    if (ziel !== -1 && ziel < prueferIndex) return ziel
  }
  return prueferIndex - 1
}
