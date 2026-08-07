// Harte Regeln für Workflow-Schaubilder (SPEC §4.1): Karten + Pfeile, Ein-Pfad-Regel,
// braucht/liefert-Prüfung, Pflichtfelder vor dem Start, Arbeitsauftrag mit Feldwerten.
// Geprüft wird im Hauptprozess; die Oberfläche nutzt dieselben Regeln für
// sofortige Rückmeldung beim Verbinden.
import { texte } from './texte.js'
import { blockDefinition } from './blockKatalog.js'

function blockName(bloecke, instanzId) {
  const eintrag = bloecke.find((b) => b.instanzId === instanzId)
  return blockDefinition(eintrag?.blockId)?.name ?? '?'
}

// Schaubild-Regeln beim Bearbeiten — liefert null oder eine Fehlermeldung.
// Ein-Pfad-Regel (SPEC §4.1): höchstens ein Pfeil aus und in jede Karte
// (parallele Zweige: BAUPLAN Schritt 13). Kreise sind verboten. braucht/liefert
// wird erst geprüft, wenn die Pfeile alle Karten zu einem durchgehenden Pfad
// verbinden — vorher ist das Schaubild ein Zwischenstand beim Umbauen (z.B.
// einen Block aus der Mitte nehmen), und Lücken sind ausdrücklich erlaubt;
// spätestens der Start prüft streng.
export function pruefeSchaubild(bloecke, pfeile) {
  const ids = new Set(bloecke.map((b) => b.instanzId))
  for (const block of bloecke)
    if (!blockDefinition(block.blockId)) return texte.kette.unbekannterBlock
  const ausgehend = new Map()
  const eingehend = new Map()
  for (const pfeil of pfeile) {
    if (!ids.has(pfeil.von) || !ids.has(pfeil.nach) || pfeil.von === pfeil.nach)
      return texte.kette.fehlerPfeilUngueltig
    if (ausgehend.has(pfeil.von)) return texte.kette.einPfadAusgehend(blockName(bloecke, pfeil.von))
    if (eingehend.has(pfeil.nach)) return texte.kette.einPfadEingehend(blockName(bloecke, pfeil.nach))
    ausgehend.set(pfeil.von, pfeil.nach)
    eingehend.set(pfeil.nach, pfeil.von)
  }
  // Kreis-Prüfung: Bei höchstens einem Pfeil pro Richtung ist jede Karte, die von
  // keinem Pfad-Anfang aus erreichbar ist, aber einen eingehenden Pfeil hat, Teil
  // eines Kreises.
  const erreichbar = new Set()
  for (const block of bloecke) {
    if (eingehend.has(block.instanzId)) continue
    let id = block.instanzId
    while (id && !erreichbar.has(id)) {
      erreichbar.add(id)
      id = ausgehend.get(id)
    }
  }
  for (const block of bloecke)
    if (!erreichbar.has(block.instanzId)) return texte.kette.fehlerKreis
  // braucht/liefert nur am vollständigen Pfad: Erst wenn ein Pfad-Stück alle
  // Karten umfasst, steht fest, wer wirklich vor wem liegt — vorher könnte
  // jedes Stück noch einen Vorgänger bekommen, der das Fehlende liefert.
  const proId = new Map(bloecke.map((b) => [b.instanzId, b]))
  for (const block of bloecke) {
    if (eingehend.has(block.instanzId)) continue
    const stueck = []
    let id = block.instanzId
    while (id) {
      stueck.push(proId.get(id))
      id = ausgehend.get(id)
    }
    if (stueck.length < bloecke.length) continue
    const geliefert = new Set()
    let anfang = true
    for (const eintrag of stueck) {
      const def = blockDefinition(eintrag.blockId)
      if (!anfang)
        for (const bedarf of def.braucht)
          if (!geliefert.has(bedarf)) return texte.kette.fehlerBraucht(def.name, bedarf)
      for (const gabe of def.liefert) geliefert.add(gabe)
      anfang = false
    }
  }
  return null
}

// Reihenfolge für den Lauf: die Pfeile müssen alle Karten zu genau einem
// durchgehenden Pfad verbinden. Liefert { reihenfolge } oder { fehler }.
export function schaubildReihenfolge(bloecke, pfeile) {
  if (bloecke.length === 0) return { fehler: texte.kette.fehlerLeereKette }
  const ausgehend = new Map(pfeile.map((p) => [p.von, p.nach]))
  const eingehend = new Set(pfeile.map((p) => p.nach))
  const proId = new Map(bloecke.map((b) => [b.instanzId, b]))
  let beste = []
  for (const start of bloecke) {
    if (eingehend.has(start.instanzId)) continue
    const pfad = []
    const besucht = new Set()
    let id = start.instanzId
    while (id && proId.has(id) && !besucht.has(id)) {
      besucht.add(id)
      pfad.push(proId.get(id))
      id = ausgehend.get(id)
    }
    if (pfad.length > beste.length) beste = pfad
  }
  if (beste.length === 0) return { fehler: texte.kette.fehlerKreis }
  if (beste.length < bloecke.length) {
    const imPfad = new Set(beste.map((b) => b.instanzId))
    const fehlend = bloecke.find((b) => !imPfad.has(b.instanzId))
    return { fehler: texte.kette.fehlerNichtVerbunden(blockName(bloecke, fehlend.instanzId)) }
  }
  return { reihenfolge: beste }
}

// Alle Vorfahren einer Karte entlang der Pfeile, vom Pfad-Anfang bis zum
// direkten Vorgänger — die Auswahl für „bei Fehlschlag zurück zu".
export function vorfahrenImPfad(bloecke, pfeile, instanzId) {
  const eingehend = new Map(pfeile.map((p) => [p.nach, p.von]))
  const proId = new Map(bloecke.map((b) => [b.instanzId, b]))
  const kette = []
  const besucht = new Set([instanzId])
  let id = eingehend.get(instanzId)
  while (id && proId.has(id) && !besucht.has(id)) {
    besucht.add(id)
    kette.unshift(proId.get(id))
    id = eingehend.get(id)
  }
  return kette
}

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
