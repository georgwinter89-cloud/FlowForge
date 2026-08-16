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

// Kürzeste Distanz jedes Vorfahren zu dieser Karte entlang der Pfeile
// (BAUPLAN 34): 1 = direkter Vorgänger. Grundlage für Übergaben — liefern
// mehrere Vorfahren GLEICHER Distanz dasselbe Etikett (zwei Angreifer vor dem
// Bauer), gewinnt keiner still, alle werden übergeben; bei ungleicher Distanz
// gilt weiter „näherer Vorfahre gewinnt".
export function vorfahrenDistanzen(bloecke, pfeile, instanzId) {
  const { vorgaenger } = nachbarn(bloecke, pfeile)
  const distanz = new Map()
  let welle = [...(vorgaenger.get(instanzId) ?? [])]
  let stufe = 1
  while (welle.length) {
    const naechste = []
    for (const id of welle) {
      if (distanz.has(id)) continue
      distanz.set(id, stufe)
      naechste.push(...(vorgaenger.get(id) ?? []))
    }
    welle = naechste
    stufe++
  }
  return distanz
}

// Welche Lieferungen der Vorfahren kommen im Auftrag dieses Blocks an?
// (BAUPLAN 34/40) Die eine Stelle, an der über Ankommen und Verdrängen
// entschieden wird — Lauf (Übergabe-Text) und Schaubild (braucht-Chips) fragen
// beide hier, sonst zeigen die Chips etwas anderes, als der Lauf tut.
//
// `lieferungen` sind die Vorfahren mit Abschlusstext, topologisch sortiert:
//   { name, nummer, naehe, liefert: [etikett], text }
// Regel: Der nähere Vorfahre gewinnt; mehrere GLEICH nahe kommen alle an
// (BAUPLAN 34 — früher gewann still einer). Neu in BAUPLAN 40: Was dabei
// verdrängt wird, verschwindet nicht mehr wortlos, sondern steht als
// `verdraengt` in der Gruppe — der Lauf tickert es. Blöcke mit dem Kennzeichen
// `fuehrtZusammen` (BAUPLAN 47) nehmen alles: Für sie gilt die Distanz-Regel
// gar nicht, denn Zusammenführen ist ihre Aufgabe.
//
// Gruppen entstehen nur für Etiketten, die dieser Block wirklich braucht
// (braucht + brauchtOptional) — Lieferungen, die ihn nichts angehen, sind
// keine Verdrängung, sondern Lärm im Ticker.
export function uebergabenAuswahl(def, lieferungen) {
  const fuehrtZusammen = Boolean(def?.fuehrtZusammen)
  const gesammelt = new Map()
  for (const lieferung of lieferungen) {
    for (const etikett of lieferung.liefert ?? []) {
      const bisher = gesammelt.get(etikett)
      if (!bisher) {
        gesammelt.set(etikett, {
          naehe: lieferung.naehe,
          angekommen: [lieferung],
          verdraengt: []
        })
        continue
      }
      if (fuehrtZusammen || lieferung.naehe === bisher.naehe) {
        bisher.angekommen.push(lieferung)
        continue
      }
      // Beide Richtungen zählen: Der spätere nähere verdrängt die bisherigen
      // (unten), der frühere nähere schluckt den späteren entfernteren
      // (else-Zweig) — genau dieser zweite Fall lief bisher ohne jede Spur.
      if (lieferung.naehe < bisher.naehe) {
        bisher.verdraengt.push(...bisher.angekommen)
        bisher.angekommen = [lieferung]
        bisher.naehe = lieferung.naehe
      } else bisher.verdraengt.push(lieferung)
    }
  }
  const gruppen = []
  for (const etikett of [...(def?.braucht ?? []), ...(def?.brauchtOptional ?? [])]) {
    const treffer = gesammelt.get(etikett)
    if (!treffer) continue
    gruppen.push({ etikett, angekommen: treffer.angekommen, verdraengt: treffer.verdraengt })
  }
  return { gruppen }
}

// Sicht-Hilfe am Schaubild (BAUPLAN 36): Woher bekommt dieser Block, was er
// braucht? Für jedes Etikett (braucht und brauchtOptional) die Namen der
// liefernden Vorfahren — leer heißt „fehlt". Dieselbe Entscheidung wie im Lauf
// (uebergabenAuswahl), damit die Chips nicht etwas anderes behaupten.
export function brauchtHerkunft(bloecke, pfeile, instanzId) {
  const eintrag = bloecke.find((b) => b.instanzId === instanzId)
  const def = blockDefinition(eintrag?.blockId)
  const herkunft = new Map()
  if (!def) return herkunft
  const distanz = vorfahrenDistanzen(bloecke, pfeile, instanzId)
  const lieferungen = []
  for (const vorfahre of vorfahrenSortiert(bloecke, pfeile, instanzId)) {
    const vDef = blockDefinition(vorfahre.blockId)
    if (!vDef) continue
    lieferungen.push({
      name: vDef.name,
      naehe: distanz.get(vorfahre.instanzId) ?? Number.MAX_SAFE_INTEGER,
      liefert: vDef.liefert
    })
  }
  for (const etikett of [...def.braucht, ...(def.brauchtOptional ?? [])]) herkunft.set(etikett, [])
  for (const gruppe of uebergabenAuswahl(def, lieferungen).gruppen)
    herkunft.set(
      gruppe.etikett,
      gruppe.angekommen.map((l) => l.name)
    )
  return herkunft
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
