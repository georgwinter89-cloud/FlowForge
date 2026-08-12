// Harte Regeln für Workflow-Schaubilder (SPEC §4.1): Karten + Pfeile als
// gerichteter Graph mit parallelen Zweigen (seit Bauschritt 13), Kreis-Verbot,
// braucht/liefert-Prüfung entlang der Vorfahren, Pflichtfelder vor dem Start,
// Arbeitsauftrag mit Feldwerten. Geprüft wird im Hauptprozess; die Oberfläche
// nutzt dieselben Regeln für sofortige Rückmeldung beim Verbinden.
import { texte } from './texte.js'
import { blockDefinition } from './blockKatalog.js'

function blockName(bloecke, instanzId) {
  const eintrag = bloecke.find((b) => b.instanzId === instanzId)
  return blockDefinition(eintrag?.blockId)?.name ?? '?'
}

// Nachbar-Listen des Graphen: wer zeigt auf wen?
function nachbarn(bloecke, pfeile) {
  const vorgaenger = new Map(bloecke.map((b) => [b.instanzId, []]))
  const nachfolger = new Map(bloecke.map((b) => [b.instanzId, []]))
  for (const pfeil of pfeile) {
    nachfolger.get(pfeil.von)?.push(pfeil.nach)
    vorgaenger.get(pfeil.nach)?.push(pfeil.von)
  }
  return { vorgaenger, nachfolger }
}

// Topologische Reihenfolge (Kahn): bestimmt Nummerierung und Lauf-Reihenfolge.
// Deterministisch: Unter den startbereiten Karten gewinnt immer die früheste in
// der bloecke-Liste. Liefert weniger Karten als bloecke ⇒ die Pfeile enthalten
// einen Kreis.
function topologisch(bloecke, pfeile) {
  const { vorgaenger, nachfolger } = nachbarn(bloecke, pfeile)
  const offenerGrad = new Map(
    bloecke.map((b) => [b.instanzId, vorgaenger.get(b.instanzId).length])
  )
  const aufgenommen = new Set()
  const reihenfolge = []
  let gefunden = true
  while (gefunden) {
    gefunden = false
    for (const block of bloecke) {
      if (aufgenommen.has(block.instanzId) || offenerGrad.get(block.instanzId) > 0) continue
      aufgenommen.add(block.instanzId)
      reihenfolge.push(block)
      for (const nach of nachfolger.get(block.instanzId))
        offenerGrad.set(nach, offenerGrad.get(nach) - 1)
      gefunden = true
      break
    }
  }
  return reihenfolge
}

// Hängen alle Karten (über Pfeile in beliebiger Richtung) zusammen?
// Liefert null oder die erste Karte, die nicht am Schaubild hängt.
function nichtVerbundeneKarte(bloecke, pfeile) {
  if (bloecke.length === 0) return null
  const { vorgaenger, nachfolger } = nachbarn(bloecke, pfeile)
  const erreicht = new Set([bloecke[0].instanzId])
  const stapel = [bloecke[0].instanzId]
  while (stapel.length) {
    const id = stapel.pop()
    for (const nachbar of [...vorgaenger.get(id), ...nachfolger.get(id)])
      if (!erreicht.has(nachbar)) {
        erreicht.add(nachbar)
        stapel.push(nachbar)
      }
  }
  return bloecke.find((b) => !erreicht.has(b.instanzId)) ?? null
}

// Alle Vorfahren einer Karte entlang der Pfeile, topologisch sortiert (der
// letzte Eintrag ist der nächste Vorfahre) — Grundlage für Übergaben,
// braucht-Prüfung und die Auswahl „bei Fehlschlag zurück zu".
export function vorfahrenSortiert(bloecke, pfeile, instanzId) {
  const { vorgaenger } = nachbarn(bloecke, pfeile)
  const gefunden = new Set()
  const stapel = [...(vorgaenger.get(instanzId) ?? [])]
  while (stapel.length) {
    const id = stapel.pop()
    if (gefunden.has(id)) continue
    gefunden.add(id)
    stapel.push(...(vorgaenger.get(id) ?? []))
  }
  return topologisch(bloecke, pfeile).filter((b) => gefunden.has(b.instanzId))
}

// Schaubild-Regeln beim Bearbeiten — liefert null oder eine Fehlermeldung.
// Parallele Zweige (SPEC §4.1, seit Bauschritt 13): Aus einer Karte dürfen
// mehrere Pfeile ausgehen, und mehrere dürfen an einer ankommen (Zusammenführen).
// Kreise sind verboten. braucht/liefert wird erst geprüft, wenn die Pfeile alle
// Karten zu EINEM zusammenhängenden Schaubild verbinden — vorher ist das
// Schaubild ein Zwischenstand beim Umbauen (z.B. einen Block herausnehmen), und
// Lücken sind ausdrücklich erlaubt; spätestens der Start prüft streng.
export function pruefeSchaubild(bloecke, pfeile) {
  const ids = new Set(bloecke.map((b) => b.instanzId))
  for (const block of bloecke)
    if (!blockDefinition(block.blockId)) return texte.kette.unbekannterBlock
  const gesehen = new Set()
  for (const pfeil of pfeile) {
    if (!ids.has(pfeil.von) || !ids.has(pfeil.nach) || pfeil.von === pfeil.nach)
      return texte.kette.fehlerPfeilUngueltig
    const schluessel = pfeil.von + '→' + pfeil.nach
    if (gesehen.has(schluessel)) return texte.kette.fehlerPfeilDoppelt
    gesehen.add(schluessel)
  }
  if (topologisch(bloecke, pfeile).length < bloecke.length) return texte.kette.fehlerKreis
  // braucht/liefert nur am zusammenhängenden Schaubild: Solange Stücke fehlen,
  // könnte jedes Stück noch einen Vorfahren bekommen, der das Fehlende liefert.
  // Karten ohne eingehenden Pfeil bleiben auch dann ausgenommen — sie könnten
  // beim Weiterbauen noch einen Vorgänger bekommen; der Start prüft streng.
  if (nichtVerbundeneKarte(bloecke, pfeile)) return null
  const { vorgaenger } = nachbarn(bloecke, pfeile)
  for (const block of bloecke) {
    if (vorgaenger.get(block.instanzId).length === 0) continue
    const fehler = brauchtFehler(bloecke, pfeile, block)
    if (fehler) return fehler
  }
  return null
}

// Deckt die Lieferungen der Vorfahren den Bedarf dieser Karte? null oder Fehlermeldung.
function brauchtFehler(bloecke, pfeile, block) {
  const def = blockDefinition(block.blockId)
  const geliefert = new Set()
  for (const vorfahre of vorfahrenSortiert(bloecke, pfeile, block.instanzId))
    for (const gabe of blockDefinition(vorfahre.blockId).liefert) geliefert.add(gabe)
  for (const bedarf of def.braucht)
    if (!geliefert.has(bedarf)) return texte.kette.fehlerBraucht(def.name, bedarf)
  return null
}

// Reihenfolge für Nummerierung und Lauf: die Pfeile müssen alle Karten zu genau
// einem zusammenhängenden, kreisfreien Schaubild verbinden.
// Liefert { reihenfolge } (topologisch) oder { fehler }.
export function schaubildReihenfolge(bloecke, pfeile) {
  if (bloecke.length === 0) return { fehler: texte.kette.fehlerLeereKette }
  const reihenfolge = topologisch(bloecke, pfeile)
  if (reihenfolge.length < bloecke.length) return { fehler: texte.kette.fehlerKreis }
  const fehlend = nichtVerbundeneKarte(bloecke, pfeile)
  if (fehlend) return { fehler: texte.kette.fehlerNichtVerbunden(blockName(bloecke, fehlend.instanzId)) }
  return { reihenfolge }
}

// Strenge Versorgungs-Prüfung beim Start: JEDE Karte (auch die erste) muss
// alles, was sie braucht, von ihren Vorfahren geliefert bekommen.
export function pruefeVersorgung(bloecke, pfeile) {
  for (const block of bloecke) {
    if (!blockDefinition(block.blockId)) return texte.kette.unbekannterBlock
    const fehler = brauchtFehler(bloecke, pfeile, block)
    if (fehler) return fehler
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
// wenn sie ein Vorfahre des Prüfers ist — sonst der nächste Vorfahre.
// null = der Prüfer hat keine Vorfahren.
export function rueckfuehrungsZiel(bloecke, pfeile, prueferInstanzId) {
  const vorfahren = vorfahrenSortiert(bloecke, pfeile, prueferInstanzId)
  if (vorfahren.length === 0) return null
  const gewaehlt = bloecke.find((b) => b.instanzId === prueferInstanzId)?.zurueckZu
  if (gewaehlt && vorfahren.some((b) => b.instanzId === gewaehlt)) return gewaehlt
  return vorfahren[vorfahren.length - 1].instanzId
}

// Alle Karten auf den Wegen von „von" nach „bis" (beide einschließlich):
// Nachfahren-oder-selbst von „von" ∩ Vorfahren-oder-selbst von „bis".
// Das ist die Menge, die eine Reparatur-Runde erneut laufen lässt — parallele
// Zweige außerhalb dieses Korridors behalten ihr Ergebnis.
export function zwischenBloecke(bloecke, pfeile, vonId, bisId) {
  const { nachfolger } = nachbarn(bloecke, pfeile)
  const nachfahren = new Set([vonId])
  const stapel = [vonId]
  while (stapel.length) {
    const id = stapel.pop()
    for (const nach of nachfolger.get(id) ?? [])
      if (!nachfahren.has(nach)) {
        nachfahren.add(nach)
        stapel.push(nach)
      }
  }
  const ergebnis = new Set()
  if (nachfahren.has(bisId)) ergebnis.add(bisId)
  for (const vorfahre of vorfahrenSortiert(bloecke, pfeile, bisId))
    if (nachfahren.has(vorfahre.instanzId)) ergebnis.add(vorfahre.instanzId)
  return ergebnis
}
