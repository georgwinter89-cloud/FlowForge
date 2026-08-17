// Harte Regeln für Workflow-Schaubilder (SPEC §4.1): Karten + Pfeile als
// gerichteter Graph mit parallelen Zweigen (seit Bauschritt 13), Kreis-Verbot,
// braucht/liefert-Prüfung entlang der Vorfahren, Pflichtfelder vor dem Start,
// Arbeitsauftrag mit Feldwerten. Geprüft wird im Hauptprozess; die Oberfläche
// nutzt dieselben Regeln für sofortige Rückmeldung beim Verbinden.
import { texte } from './texte.js'
import { blockDefinition, blockAnzeigeName, zusatznameBereinigen } from './blockKatalog.js'

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
      // Anzeigename statt Katalogname (BAUPLAN 43): Zwei Prüfer hießen im Chip
      // wie im Vorspann beide „Prüfer" — mit Zusatznamen sind sie unterscheidbar
      // („Prüfer · UI"). Die Signatur bleibt gleich, Leinwand.jsx merkt nur den
      // besseren Namen.
      name: blockAnzeigeName(vDef, vorfahre),
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

// ── Empfänger im Auftrag (BAUPLAN 43) ───────────────────────────────────────
// FlowForge stellt jedem Blockauftrag drei aus dem Schaubild gerechnete Angaben
// voran: WER bekommt, was dieser Block liefert (Block, Etikett, wozu), die Kette
// in einer Zeile und die Position. Quelle sind ausschließlich Blöcke und Pfeile
// — kein Laufstatus, keine Lieferung, kein Koordinator: Der Auftrag wird bei
// JEDEM Anlauf desselben Blocks neu gebaut (Reparatur-Runde, Nachforderung,
// Übertrag), und er muss Wort für Wort gleich bleiben. Deshalb sind die
// Funktionen hier rein und ausschließlich aus (bloecke, pfeile, instanzId).

// Alle Nachfahren einer Karte entlang der Pfeile, topologisch sortiert.
// Gegenstück zu vorfahrenSortiert.
function nachfahrenSortiert(bloecke, pfeile, instanzId) {
  const { nachfolger } = nachbarn(bloecke, pfeile)
  const gefunden = new Set()
  const stapel = [...(nachfolger.get(instanzId) ?? [])]
  while (stapel.length) {
    const id = stapel.pop()
    if (gefunden.has(id)) continue
    gefunden.add(id)
    stapel.push(...(nachfolger.get(id) ?? []))
  }
  return topologisch(bloecke, pfeile).filter((b) => gefunden.has(b.instanzId))
}

// Nummer und Anzeigename jeder Karte — die eine Stelle, an der beides zusammen
// gerechnet wird. Die Nummer ist die topologische Reihenfolge (dieselbe, die der
// Lauf und der Ticker verwenden), der Name der Anzeigename samt Zusatz
// (BAUPLAN 41) — sonst hießen zwei Prüfer im Vorspann beide „Prüfer".
function kennungen(bloecke, pfeile) {
  const reihenfolge = topologisch(bloecke, pfeile)
  const kennung = new Map(
    reihenfolge.map((b, idx) => [
      b.instanzId,
      { instanzId: b.instanzId, nummer: idx + 1, name: blockAnzeigeName(blockDefinition(b.blockId), b) }
    ])
  )
  return kennung
}

// Wer bekommt wirklich, was dieser Block liefert? Reine Daten, keine Texte.
//
// Nicht „alle Nachfahren mit passendem braucht": Die Distanz-Regel wirft
// Lieferungen weg (uebergabenAuswahl) — liegt ein zweiter Lieferant desselben
// Etiketts näher am Nachfahren, kommt diese Lieferung dort NICHT an. Deshalb
// wird für JEDEN Nachfahren einmal dieselbe Auswahl über den statischen Graphen
// gefahren und geprüft, ob dieser Block in `angekommen` oder in `verdraengt`
// steht. Nur so sagt der Vorspann dasselbe, was der Lauf später tut.
//
// Liefert:
//   nummer, gesamt          — Ort im Schaubild (topologische Reihenfolge)
//   empfaenger[]            — { instanzId, nummer, name, etikett, optional, wozu }
//   verdraengt[]            — { etikett, gewinner: [{ nummer, name }] }
//   nachfahren[]            — { instanzId, nummer, name } (für den Fall
//                             „niemand braucht deine Etiketten, obwohl da wer ist")
export function empfaengerLage(bloecke, pfeile, instanzId) {
  const kennungVon = kennungen(bloecke, pfeile)
  const kennung = (id) => kennungVon.get(id) ?? { instanzId: id, nummer: 0, name: '?' }
  const lage = {
    nummer: kennungVon.get(instanzId)?.nummer ?? 0,
    gesamt: bloecke.length,
    empfaenger: [],
    verdraengt: [],
    nachfahren: []
  }
  const eintrag = bloecke.find((b) => b.instanzId === instanzId)
  const def = blockDefinition(eintrag?.blockId)
  if (!def) return lage
  const nachfahren = nachfahrenSortiert(bloecke, pfeile, instanzId)
  lage.nachfahren = nachfahren.map((b) => kennung(b.instanzId))
  // Etikett → instanzId → Gewinner-Kennung. Gesammelt wird über ALLE Nachfahren,
  // gemeldet nur, was nirgends angekommen ist (siehe unten).
  const verdraengtVon = new Map()
  const angekommen = new Set()
  for (const nachfahre of nachfahren) {
    const nDef = blockDefinition(nachfahre.blockId)
    if (!nDef) continue
    const distanz = vorfahrenDistanzen(bloecke, pfeile, nachfahre.instanzId)
    const lieferungen = []
    for (const vorfahre of vorfahrenSortiert(bloecke, pfeile, nachfahre.instanzId)) {
      const vDef = blockDefinition(vorfahre.blockId)
      if (!vDef) continue
      lieferungen.push({
        ...kennung(vorfahre.instanzId),
        naehe: distanz.get(vorfahre.instanzId) ?? Number.MAX_SAFE_INTEGER,
        liefert: vDef.liefert
      })
    }
    for (const gruppe of uebergabenAuswahl(nDef, lieferungen).gruppen) {
      if (gruppe.angekommen.some((l) => l.instanzId === instanzId)) {
        angekommen.add(gruppe.etikett)
        lage.empfaenger.push({
          ...kennung(nachfahre.instanzId),
          etikett: gruppe.etikett,
          // Optionale Bedarfe brauchen eine eigene Sprache: Der Empfänger
          // verlangt nichts — „er misst deine Arbeit daran" wäre gelogen.
          optional: !(nDef.braucht ?? []).includes(gruppe.etikett),
          wozu: nDef.brauchtWozu?.[gruppe.etikett] ?? null
        })
      } else if (gruppe.verdraengt.some((l) => l.instanzId === instanzId)) {
        if (!verdraengtVon.has(gruppe.etikett)) verdraengtVon.set(gruppe.etikett, new Map())
        for (const gewinner of gruppe.angekommen)
          verdraengtVon.get(gruppe.etikett).set(gewinner.instanzId, kennung(gewinner.instanzId))
      }
    }
  }
  // Verdrängung nur melden, wenn dieses Etikett bei KEINEM Nachfahren ankommt —
  // sonst behauptete der Vorspann „kommt bei niemandem an", obwohl es das tut.
  for (const [etikett, gewinner] of verdraengtVon)
    if (!angekommen.has(etikett)) lage.verdraengt.push({ etikett, gewinner: [...gewinner.values()] })
  return lage
}

// ── Benannte Ziele des Zuschnitts (BAUPLAN 44) ──────────────────────────────
// Bis Bauschritt 43 schnitt „Paket schneiden" EIN Arbeitspaket für alle. Seit 44
// schneidet es je benanntem Ziel eines. Ein „benanntes Ziel" ist NICHT jeder
// Empfänger des Etiketts (Entscheidung Georg, 16.08.2026), sondern nur der
// Empfänger, der das Paket UMSETZT (!nurLesen && !prueft — heute genau der
// Bauer). Der Grund ist ein stiller Maßstab-Bruch: Bekäme der Prüfer ein eigenes
// Paket, misst er die Arbeit des Bauers an anderen Fertig-Kriterien, als der
// Bauer sie gebaut hat. Angreifer und Prüfer bekommen deshalb kein eigenes
// Paket, sondern das ihres nächstgelegenen Umsetzers (zuschnittRouting).
export const ARBEITSPAKET_ETIKETT = 'Arbeitspaket'

// Adressiert wird über die BLOCKNUMMER, nicht über den Zusatznamen
// (Entscheidung Georg, 16.08.2026): Zwei Bauer ohne Zusatznamen wären über den
// Namen gar nicht adressierbar, und eine Zusatznamen-Pflicht hielte jedes schon
// gespeicherte Schaubild an. Die Nummer ist dieselbe, die Vorspann und Ticker
// nennen („Block 3 „Bauer · UI"").
export function zielAdresse(nummer) {
  return String(nummer)
}

// Die Adresse eines Ziels aus dem, was das Modell geschrieben hat — tolerant:
// „3", „Block 3", „3 Bauer · UI", „Block 3 „Bauer · UI"" meinen dasselbe. Passt
// keine Nummer, gilt der eindeutige Anzeigename noch als Adresse (bequem, wenn
// es nur einen gibt); mehrdeutige Namen liefern null, damit die Abweisung die
// gültigen Adressen nennen kann, statt still den falschen Block zu treffen.
//
// Die Zahl zählt NUR am Anfang (optional hinter „Block"), nie irgendwo im Text:
// Ein Zusatzname mit Ziffer („Bauer · Phase 2") traf sonst still den Block mit
// dieser Nummer statt den gemeinten — ohne Abweisung und ohne Ticker-Zeile,
// also genau die stille Fehlzustellung, die Bauschritt 44 abstellt.
export function zielFuerAdresse(ziele, roh) {
  const liste = Array.isArray(ziele) ? ziele : []
  const text = String(roh ?? '').trim()
  if (!text || liste.length === 0) return null
  const zahl = text.match(/^(?:block\s*)?(\d+)\b/i)
  if (zahl) return liste.find((z) => String(z.adresse) === zahl[1]) ?? null
  const gleich = liste.filter((z) => String(z.name ?? '').toLowerCase() === text.toLowerCase())
  return gleich.length === 1 ? gleich[0] : null
}

// Die benannten Ziele dieses Blocks: die Umsetzer unter den Empfängern seines
// Arbeitspakets. Reine Funktion aus (bloecke, pfeile) wie vorspannText — sie
// liest nichts aus dem Laufstatus, damit der Auftrag in jedem Anlauf Wort für
// Wort derselbe bleibt. Liefert
// [{ instanzId, nummer, name, adresse, bezeichnung, nebenlaeufigZu }].
//
// `nebenlaeufigZu` (BAUPLAN 46): die Instanz-Kennungen der ANDEREN Ziele
// derselben Quelle, die weder Vorfahr noch Nachfahr dieses Ziels sind — also
// die, die im Lauf gleichzeitig mit ihm schreiben können. Nur für solche Paare
// muss der Zuschnitt überschneidungsfrei sein: Eine Kette Bauer A → Bauer B
// darf dieselbe Datei nacheinander anfassen, ein Fächer nicht gleichzeitig.
// Die Rechnung steht hier und nicht im Melde-Werkzeug, weil nur das Schaubild
// weiß, wer hinter wem liegt — das Melde-Werkzeug sieht nur Adressen.
export function zielListe(bloecke, pfeile, instanzId) {
  const lage = empfaengerLage(bloecke, pfeile, instanzId)
  const ziele = []
  const gesehen = new Set()
  for (const empfaenger of lage.empfaenger) {
    if (empfaenger.etikett !== ARBEITSPAKET_ETIKETT) continue
    if (gesehen.has(empfaenger.instanzId)) continue
    const eintrag = bloecke.find((b) => b.instanzId === empfaenger.instanzId)
    const def = blockDefinition(eintrag?.blockId)
    if (!def || def.nurLesen || def.prueft) continue
    gesehen.add(empfaenger.instanzId)
    ziele.push({
      instanzId: empfaenger.instanzId,
      nummer: empfaenger.nummer,
      name: empfaenger.name,
      adresse: zielAdresse(empfaenger.nummer),
      bezeichnung: texte.ticker.blockBezeichnung(empfaenger.nummer, empfaenger.name),
      nebenlaeufigZu: []
    })
  }
  // Vorfahren je Ziel einmal rechnen; „X ist Vorfahr von Y" heißt: X liegt in
  // Ys Vorfahrenmenge. Weder das eine noch das andere → nebenläufig.
  const vorfahrenVon = new Map(
    ziele.map((z) => [
      z.instanzId,
      new Set(vorfahrenSortiert(bloecke, pfeile, z.instanzId).map((b) => b.instanzId))
    ])
  )
  for (const ziel of ziele)
    for (const anderes of ziele) {
      if (anderes.instanzId === ziel.instanzId) continue
      if (vorfahrenVon.get(ziel.instanzId).has(anderes.instanzId)) continue
      if (vorfahrenVon.get(anderes.instanzId).has(ziel.instanzId)) continue
      ziel.nebenlaeufigZu.push(anderes.instanzId)
    }
  return ziele
}

// Der Auftragszusatz zum Zuschnitt (BAUPLAN 44) — ZWEIGETEILT
// (Abschlussprüfung Bauschritt 44): Ziel-Adressierung und erlaubteDateien gehen
// an JEDEN Block, der ein Arbeitspaket liefert; der Zuschnitt je Ziel ist auch
// ohne Aufgaben-Karten sinnvoll. Die Sätze zu aufgabenIds und zur Nachforderung
// gehen NUR an Blöcke mit dem Kennzeichen kartenZuteilung — nur sie dürfen
// paket_melden rufen (Werkzeug-Gate im Motor), und nur sie werden auf
// Vollständigkeit geprüft.
//
// Im Katalog fallen beide zusammen, bei einem im Block-Editor gebauten Block
// nicht: liefert-Etiketten sind dort freie Eingabe. Ein solcher Block bekam
// vorher das Versprechen „FlowForge prüft das und fordert sonst nach" — folgte
// er ihm, wies ihn die Meldungsprüfung ab („noch kein Paket gemeldet"), und
// paket_melden löste für ihn eine Rechte-Rückfrage aus. Er saß fest.
export function zuschnittAuftragZusatz(ziele, kartenZuteilung) {
  const tz = texte.agentenZuschnitt
  const liste = Array.isArray(ziele) ? ziele : []
  const zusatz =
    liste.length > 1
      ? tz.auftragZusatz(liste.map((z) => z.bezeichnung))
      : liste.length === 1
        ? tz.auftragZusatzEines(liste[0].bezeichnung)
        : tz.auftragZusatzKeines
  return kartenZuteilung ? zusatz + tz.aufgabenZusatz : zusatz
}

// Welcher Zuschnitt gilt für DIESEN Empfänger? Die eine Stelle, an der das
// entschieden wird — Lauf, Auftrags-Vorspann und braucht-Chips fragen alle hier,
// sonst behaupten sie etwas anderes, als der Lauf tut (der Zweck von
// Bauschritt 40).
//
// `zielSchluessel` sind die Schlüssel der vorliegenden Pakete: die instanzId des
// adressierten Ziels, '' für ein Paket ohne Ziel. Die Regel unter den
// ADRESSIERTEN Paketen, von oben nach unten:
//   1. Ist der Empfänger selbst adressiert, gilt sein eigenes Paket.
//   2. Sonst das Paket seines nächstgelegenen adressierten Vorfahren (gleich
//      nahe gelten alle) — so bekommt der Prüfer das Paket SEINES Bauers.
//   3. Sonst alle adressierten Pakete. Das trifft die Blöcke VOR den Umsetzern
//      (der Angreifer sitzt zwischen Paket schneiden und Bauer): Er soll alles
//      angreifen, was gebaut wird — ihm gar nichts zu geben wäre ein stiller
//      Verlust, den es vor 44 nicht gab.
// Das Paket OHNE Adresse kommt immer ZUSÄTZLICH dazu — „ein Zuschnitt ohne
// Adresse gilt für alle" (SPEC §4.1). Als bloßer Rückfall hinter den
// adressierten Paketen erreichte es genau die Blöcke nie, die eines haben:
// Bauer und Prüfer verlören still, was für alle gemeint war. Meldet ein Agent
// wie vor 44 EIN Paket ohne Adresse, ist es das einzige — Rückfall ohne Bruch.
export function zuschnittRouting(bloecke, pfeile, empfaengerId, zielSchluessel) {
  const vorhanden = []
  for (const schluessel of zielSchluessel ?? [])
    if (!vorhanden.includes(schluessel)) vorhanden.push(schluessel)
  if (vorhanden.length === 0) return []
  const adressiert = vorhanden.filter((schluessel) => schluessel)
  const ergebnis = []
  if (adressiert.includes(empfaengerId)) ergebnis.push(empfaengerId)
  else if (adressiert.length) {
    const distanz = vorfahrenDistanzen(bloecke, pfeile, empfaengerId)
    let naechste = null
    for (const schluessel of adressiert) {
      if (!distanz.has(schluessel)) continue
      const naehe = distanz.get(schluessel)
      if (naechste === null || naehe < naechste) {
        naechste = naehe
        ergebnis.length = 0
        ergebnis.push(schluessel)
      } else if (naehe === naechste) ergebnis.push(schluessel)
    }
    if (ergebnis.length === 0) ergebnis.push(...adressiert)
  }
  if (vorhanden.includes('')) ergebnis.push('')
  return ergebnis
}

// Deckel für die Kettenzeile: Ein Schaubild mit 40 Blöcken ergäbe sonst eine
// Zeile, die niemand liest — und sie stünde in JEDEM Auftrag.
export const KETTE_MAX_BLOECKE = 12

// Die Kette in EINER Zeile — verzweigungstreu.
//
// Die topologische Reihenfolge allein wäre eine Lüge: Aus zwei parallelen
// Prüfern würde „Prüfer → Prüfer", also einer, der den anderen prüft. Gerechnet
// wird deshalb die Ebene aus dem LÄNGSTEN Weg von vorn; Blöcke derselben Ebene
// stehen nebeneinander in geschweiften Klammern:
//   1 Paket schneiden → 2 Bauer → {3 Prüfer · UI | 4 Prüfer · Motor} → 5 Sessionende
// Bei mehr als KETTE_MAX_BLOECKE Blöcken bleiben Anfang und Ende stehen, die
// Mitte wird zu „…" — der Sprung in den Blocknummern sagt genau, was fehlt.
// Auch eine EINZELNE Ebene kann zu breit sein (zwanzig parallele Prüfer, oder
// acht Blöcke nebeneinander gleich am Anfang): Dann wird sie in sich gekürzt,
// statt den Rest zu fressen oder selbst wegzufallen — sonst hielte der Deckel
// genau dort nicht, wo man ihn braucht.
//
// `instanzId` ist der Block, der diese Zeile LIEST. Er darf in seiner eigenen
// Kette nie fehlen: Vorher konnte im Auftrag „… → 11 → … → 20" stehen, während
// eine Zeile tiefer „Du bist Block 15 von 20" behauptet wurde. Seine Ebene
// bleibt deshalb immer stehen, und das übrige Budget geht zuerst an die Ebenen
// in seiner Nähe. Das allein reicht nicht: Ist seine Ebene selbst zu breit
// (sechs parallele Bauer), wird sie in sich gekürzt — deshalb bekommt auch
// ebeneGekuerzt den eigenen Eintrag mit und behält ihn wie Anfang und Ende.
// Ohne instanzId (Vorschau, Prüfung) wird wie bisher von vorn aufgefüllt.
export function kettenZeile(bloecke, pfeile, instanzId = null) {
  const reihenfolge = topologisch(bloecke, pfeile)
  if (reihenfolge.length === 0) return ''
  const kennungVon = kennungen(bloecke, pfeile)
  const { vorgaenger } = nachbarn(bloecke, pfeile)
  const ebeneVon = new Map()
  // Topologisch heißt: Alle Vorgänger sind schon gerechnet, wenn der Block dran ist.
  for (const block of reihenfolge) {
    const vor = vorgaenger.get(block.instanzId) ?? []
    const ebene = vor.length ? Math.max(...vor.map((id) => ebeneVon.get(id) ?? 0)) + 1 : 0
    ebeneVon.set(block.instanzId, ebene)
  }
  // Ein Eintrag ist „Nummer Name" — die Nummern sind eindeutig, ein Eintrag also
  // auch. Deshalb genügt der Eintrag des lesenden Blocks, um ihn beim Kürzen
  // innerhalb seiner Ebene wiederzufinden.
  const eintragVon = (kennung) => `${kennung.nummer} ${kennung.name}`
  const ebenen = []
  for (const block of reihenfolge) {
    const ebene = ebeneVon.get(block.instanzId)
    if (!ebenen[ebene]) ebenen[ebene] = []
    ebenen[ebene].push(eintragVon(kennungVon.get(block.instanzId)))
  }
  const stueck = (ebene) => (ebene.length === 1 ? ebene[0] : `{${ebene.join(' | ')}}`)
  if (reihenfolge.length <= KETTE_MAX_BLOECKE) return ebenen.map(stueck).join(' → ')
  // Gesetzte Ebenen: die erste, die letzte und die des lesenden Blocks. Sie
  // stehen immer — jede höchstens mit ihrem gleichen Anteil am Deckel, in sich
  // gekürzt. Ohne diese Grenze fraß eine breite Ebene das ganze Budget, die
  // Schleife brach ab, und ausgerechnet die Blöcke, die den Ort erklären,
  // fielen weg — in beide Richtungen (BAUPLAN 43).
  const eigeneEbene = ebeneVon.has(instanzId) ? ebeneVon.get(instanzId) : null
  const eigenerEintrag =
    eigeneEbene === null ? null : eintragVon(kennungVon.get(instanzId))
  const gesetzt = [...new Set([0, ebenen.length - 1, ...(eigeneEbene === null ? [] : [eigeneEbene])])]
  const anteil = Math.max(2, Math.floor(KETTE_MAX_BLOECKE / gesetzt.length))
  const gezeigt = new Map()
  let budget = KETTE_MAX_BLOECKE
  for (const i of gesetzt) {
    // Der eigene Eintrag geht mit: Seine Ebene stehen zu lassen genügt nicht,
    // wenn sie in sich gekürzt wird — genau dann fiel der lesende Block wieder
    // heraus (BAUPLAN 43).
    const gekuerzt = ebeneGekuerzt(ebenen[i], anteil, eigenerEintrag)
    gezeigt.set(i, gekuerzt.eintraege)
    budget -= gekuerzt.anzahl
  }
  budget = Math.max(0, budget)
  // Der Rest des Budgets geht an die Ebenen um den lesenden Block herum (ohne
  // ihn: an die vorderen). Passt eine nicht mehr, hören wir auf — die
  // dahinter liegenden sind noch weiter weg und noch weniger wert.
  const uebrige = ebenen.map((_, i) => i).filter((i) => !gezeigt.has(i))
  if (eigeneEbene !== null)
    uebrige.sort((a, b) => Math.abs(a - eigeneEbene) - Math.abs(b - eigeneEbene) || a - b)
  for (const i of uebrige) {
    if (ebenen[i].length > budget) break
    budget -= ebenen[i].length
    gezeigt.set(i, ebenen[i])
  }
  // Ausgegeben wird in Schaubild-Reihenfolge; jede Lücke wird zu genau einem
  // „…". Eine bloß in sich gekürzte Ebene trägt ihr eigenes „…" schon mit.
  const teile = []
  let luecke = false
  for (let i = 0; i < ebenen.length; i++) {
    if (!gezeigt.has(i)) {
      luecke = true
      continue
    }
    if (luecke) teile.push('…')
    luecke = false
    teile.push(stueck(gezeigt.get(i)))
  }
  return teile.join(' → ')
}

// Eine Ebene, die allein schon breiter ist als ihr Anteil am Deckel, wird in
// sich gekürzt: Anfang und Ende bleiben stehen, die Mitte wird zu „…" — genau
// die Zusage, die die Kettenzeile für das Ganze macht. `anzahl` zählt die echten
// Blöcke (ohne das „…"), damit das Budget der vorderen Ebenen stimmt.
//
// `eigen` ist der Eintrag des lesenden Blocks, falls er auf dieser Ebene steht.
// Er bleibt wie Anfang und Ende IMMER stehen: Die Ebene bloß nicht wegzuwerfen
// reichte nicht — stand der Lesende in ihrer Mitte, kürzte ihn genau diese
// Funktion wieder heraus, während die Positionszeile darunter seine Nummer
// nannte (BAUPLAN 43). Was danach vom Anteil übrig ist, geht an seine Nachbarn:
// Wer neben ihm steht, erklärt seinen Ort am besten.
function ebeneGekuerzt(ebene, max, eigen = null) {
  if (ebene.length <= max) return { eintraege: ebene, anzahl: ebene.length }
  const eigenerIndex = eigen === null ? -1 : ebene.indexOf(eigen)
  const behalten = new Set([0, ebene.length - 1])
  if (eigenerIndex >= 0) behalten.add(eigenerIndex)
  const uebrige = ebene
    .map((_, i) => i)
    .filter((i) => !behalten.has(i))
    .sort((a, b) =>
      eigenerIndex >= 0 ? Math.abs(a - eigenerIndex) - Math.abs(b - eigenerIndex) || a - b : a - b
    )
  for (const i of uebrige) {
    if (behalten.size >= max) break
    behalten.add(i)
  }
  // Ausgegeben wird in Ebenen-Reihenfolge; jede Lücke wird zu genau einem „…".
  const eintraege = []
  let luecke = false
  for (let i = 0; i < ebene.length; i++) {
    if (!behalten.has(i)) {
      luecke = true
      continue
    }
    if (luecke) eintraege.push('…')
    luecke = false
    eintraege.push(ebene[i])
  }
  return { eintraege, anzahl: behalten.size }
}

// Aufzählung in Alltagssprache: „A", „A und B", „A, B und C".
function aufzaehlung(stuecke) {
  if (stuecke.length <= 1) return stuecke[0] ?? ''
  return stuecke.slice(0, -1).join(', ') + ' und ' + stuecke[stuecke.length - 1]
}

// Deckel für die Nachfahren-Aufzählung im Vorspann: So viele Namen werden
// genannt, der Rest nur gezählt.
export const NACHFAHREN_MAX_NAMEN = 4

// Dieselbe Aufzählung, aber gedeckelt: „A, B, C, D und 35 weitere". Ohne den
// Deckel wuchs dieser eine Satz mit dem Schaubild (bei 40 Blöcken 39 Namen,
// rund 1.100 Zeichen) — und er steht in JEDEM Anlauf des Blocks erneut im
// Auftrag. Genannt werden die ersten Namen; die Zahl dahinter ist ehrlich, es
// verschwindet nichts stillschweigend (BAUPLAN 43).
function aufzaehlungGedeckelt(stuecke, max = NACHFAHREN_MAX_NAMEN) {
  if (stuecke.length <= max) return aufzaehlung(stuecke)
  return aufzaehlung([
    ...stuecke.slice(0, max),
    texte.agentenVorspann.weitereBloecke(stuecke.length - max)
  ])
}

// Empfänger mit identischem Etikett, identischer Verbindlichkeit und
// identischem „wozu" zu je einer Gruppe (BAUPLAN 44). empfaengerLage selbst
// gruppiert bewusst NICHT: Bauschritt 44 braucht die vollständige Liste als
// Daten (zielListe) — die Bündelung ist reine Darstellung.
// Fehlt dem Empfänger-Block ein brauchtWozu zu diesem Etikett (selbstgebaute
// Blöcke ohne Angabe), greift der ehrliche Rückfall — erfunden wird nichts.
function empfaengerGruppen(empfaenger, v) {
  const gruppen = []
  const nachSchluessel = new Map()
  for (const einer of empfaenger) {
    const wozu = einer.wozu ?? v.wozuRueckfall(einer.etikett)
    // Der Trenner steht als Escape da, nie als rohes Zeichen: Ein NUL-Byte im
    // Quelltext macht diese Datei für die Projektsuche zur Binärdatei — dann
    // findet in der zentralen Regeldatei niemand mehr etwas (BAUPLAN 44).
    const schluessel = [einer.etikett, einer.optional ? 'o' : 'p', wozu].join('\u0000')
    let gruppe = nachSchluessel.get(schluessel)
    if (!gruppe) {
      gruppe = { etikett: einer.etikett, optional: einer.optional, wozu, wer: [] }
      nachSchluessel.set(schluessel, gruppe)
      gruppen.push(gruppe)
    }
    gruppe.wer.push(einer)
  }
  return gruppen
}

// Der fertige Vorspann eines Blockauftrags — aus den Bausteinen in
// texte.agentenVorspann zusammengesetzt.
//
// Formulierungsregel, verbindlich: Die Verantwortungssprache steckt
// ausschließlich in den Empfänger-Zeilen („Er misst deine Arbeit an …"). Kette
// und Position sind reine Ortsangaben — nie „danach kommt noch wer", sonst
// schiebt der Agent seine Verantwortung weiter. Bei genau EINEM Block im
// Schaubild (Ein-Block-Lauf, Sonderlauf) entfallen Kette und Position ganz.
export function vorspannText(bloecke, pfeile, instanzId) {
  const eintrag = bloecke.find((b) => b.instanzId === instanzId)
  const def = blockDefinition(eintrag?.blockId)
  if (!def) return ''
  const v = texte.agentenVorspann
  const bezeichnung = (k) => texte.ticker.blockBezeichnung(k.nummer, k.name)
  const lage = empfaengerLage(bloecke, pfeile, instanzId)
  let text = v.ueberschrift + v.empfaengerUeberschrift
  if (lage.empfaenger.length)
    // Gleiche Empfänger-Zeilen zusammenfassen (BAUPLAN 44, mitgenommen aus 43):
    // Die Empfänger-Liste ist die einzige ungedeckelte Angabe des Vorspanns, und
    // sie steht in JEDEM Anlauf im Auftrag. Mit mehreren benannten Zielen hinter
    // „Paket schneiden" stünde derselbe „wozu"-Satz mehrfach da. Gebündelt wird
    // deshalb der SATZ, nie ein Empfänger — sie tragen die
    // Verantwortungssprache. Erst ab ZWEI Empfängern mit identischem
    // etikett + optional + wozu greift die Bündelung; darunter bleibt der
    // Wortlaut Zeichen für Zeichen der bisherige.
    for (const gruppe of empfaengerGruppen(lage.empfaenger, v)) {
      if (gruppe.wer.length === 1) {
        const zeile = gruppe.optional ? v.empfaengerOptional : v.empfaenger
        text += zeile(bezeichnung(gruppe.wer[0]), gruppe.etikett, gruppe.wozu)
      } else {
        const zeile = gruppe.optional ? v.empfaengerMehrereOptional : v.empfaengerMehrere
        text += zeile(gruppe.wer.map(bezeichnung), gruppe.etikett, gruppe.wozu)
      }
    }
  // Ohne Empfänger: Verdrängung erklärt sich selbst und schlägt alle anderen
  // Sätze — „keiner davon verlangt eines deiner Etiketten" wäre dort schlicht
  // falsch, denn verlangt wird es sehr wohl, nur von einem Näheren geliefert.
  else if (!lage.verdraengt.length) {
    // Drei verschiedene Wahrheiten, und nur die Reihenfolge hier hält sie
    // auseinander:
    //   kein Nachfahre       → „du bist der letzte Schritt" (stimmt).
    //   keine liefert-Etiketten (Sessionende, Karten-Probe, Rechte-Probe, jeder
    //     selbstgebaute Block ohne Etikett), aber es liegt noch etwas dahinter →
    //     der Tippfehler-Hinweis wäre eine Schnitzeljagd nach einem Etikett, das
    //     es gar nicht gibt.
    //   Etiketten da, Nachfahren da, keiner will sie → genau der Tippfehler-Fall
    //     selbstgebauter Blöcke (BAUPLAN 43, KLEIN 15).
    if (!lage.nachfahren.length) text += v.keiner
    else if (!(def.liefert ?? []).length) text += v.ohneEtiketten
    // Gedeckelt: Der Satz soll ein vertipptes Etikett sichtbar machen, nicht das
    // halbe Schaubild abschreiben — bei 40 Blöcken standen hier 39 Namen, in
    // JEDEM Anlauf dieses Blocks erneut.
    else text += v.keinerTrotzNachfahren(aufzaehlungGedeckelt(lage.nachfahren.map(bezeichnung)))
  }
  for (const verloren of lage.verdraengt)
    text += v.verdraengt(verloren.etikett, aufzaehlung(verloren.gewinner.map(bezeichnung)))
  // Vierte Angabe für Prüf-Blöcke: Wohin die Kritik bei „fehlgeschlagen" geht,
  // weiß nur das Schaubild — die gespeicherte Wahl „zurück zu", sonst der
  // nächste Vorfahre. Kein Katalogtext kann das wissen.
  if (def.prueft) {
    const zielId = rueckfuehrungsZiel(bloecke, pfeile, instanzId)
    if (zielId) text += v.rueckfuehrung(bezeichnung(kennungen(bloecke, pfeile).get(zielId)))
  }
  if (bloecke.length <= 1) text += v.einzelblock
  // Die Kette bekommt den lesenden Block mit: Sonst konnte sie ihn wegkürzen,
  // während die Positionszeile darunter seine Nummer nennt (BAUPLAN 43).
  else
    text += v.kette(kettenZeile(bloecke, pfeile, instanzId)) + v.position(lage.nummer, lage.gesamt)
  // Die Bausteine sind Zeilen (je ein \n) — der Auftrag trennt seine Abschnitte
  // durch eine Leerzeile. Nur Fuge, kein Text: Der Karten-Kontext klebte sonst
  // an der Positionszeile.
  return text + '\n'
}

// Derselbe Vorspann als EINE Zeile — für den Ticker und damit für den
// Laufbericht: Dessen Verlauf IST der Ticker.
//
// Ohne das steht der Vorspann ausschließlich im Prompt des Agenten, und den
// bewahrt niemand auf: Der zusammengesetzte Auftrag geht an den Motor, das
// Berichtsobjekt kennt ihn nicht, und die Block-Vorschau zeigt nur den
// Katalog-Auftrag. Georg könnte das gebaute Verhalten dann nur am Verhalten des
// Agenten erraten — der Alltagstest dieses Bauschritts („im Laufbericht steht
// ‚geht an niemanden — du bist der letzte Schritt'") wäre nicht durchführbar.
// Kein eigener Wortlaut: exakt die Bausteine aus texte.agentenVorspann, nur
// ohne Zeilenumbrüche — eine Ticker-Zeile ist eine Zeile.
export function vorspannZeile(bloecke, pfeile, instanzId) {
  return vorspannText(bloecke, pfeile, instanzId).replace(/\s+/g, ' ').trim()
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

// Reparatur-Runden je Rückführungs-Ziel (SPEC §5, BAUPLAN 41): Bis Bauschritt
// 40 gab es EINEN Zähler für den ganzen Lauf. Liegen zwei Prüfer hinter zwei
// Bauern, aß der eine Zweig dem anderen die Runden weg — der zweite Bauer bekam
// die Folgen-Frage, ohne je repariert zu haben. Gezählt wird deshalb je Ziel.
// budget ist eine Map zielInstanzId → verbleibende Runden; standard sind die im
// Workflow eingestellten Runden. Liefert, ob eine Runde gewährt wurde, und die
// wievielte es für dieses Ziel ist (für Ticker und Folgen-Frage).
export function budgetNehmen(budget, zielId, standard) {
  const uebrig = budget.get(zielId) ?? standard
  if (!zielId || uebrig <= 0) return { erlaubt: false, uebrig: 0, genutzt: standard }
  budget.set(zielId, uebrig - 1)
  return { erlaubt: true, uebrig: uebrig - 1, genutzt: standard - uebrig + 1 }
}

// Verbrauchte Nachforderungs-Budgets aus dem Laufstand zurücklesen (BAUPLAN 41,
// seit 44 als reine Funktion, damit die Regel-Prüfungen sie ohne Lauf fahren
// können). Ohne diesen Weg gewährte jeder App-Neustart jede Nachforderung
// erneut — der Grundsatz ist „lieber eine Nachforderung zu wenig als eine
// Endlosschleife".
//
// `wert` ist der gespeicherte Eintrag: eine Liste von Instanz-Kennungen (das
// heutige Format), `true` aus einem Stand von vor Bauschritt 41 (gilt dann
// vorsichtshalber für JEDEN Block, auf den `gilt` zutrifft) oder nichts.
// `eintraege` ist die Kette als [{ instanzId, def }]. Liefert die Kennungen,
// deren Budget verbraucht ist.
export function budgetAusStand(wert, eintraege, gilt) {
  const kette = Array.isArray(eintraege) ? eintraege : []
  if (Array.isArray(wert)) {
    const bekannt = new Set(kette.map((e) => e.instanzId))
    return wert.filter((id) => bekannt.has(id))
  }
  if (wert === true) return kette.filter((e) => gilt(e.def)).map((e) => e.instanzId)
  return []
}

// Wiederaufnahme (BAUPLAN 11/41): Passt ein gespeicherter Laufstand noch zum
// heutigen Schaubild? Blöcke, Reihenfolge und Pfeile müssen dieselben sein —
// und seit Bauschritt 41 auch die Zusatznamen: Sie stecken in Übergaben,
// Zuteilungen und Berichten des unterbrochenen Laufs, ein geänderter Name
// machte den Stand also unwahr. kette ist die topologische Reihenfolge der
// Schaubild-Karten (mit ihrem Feld zusatz), stand der geladene Laufstand.
export function laufstandPasst(kette, pfeile, stand) {
  if (!Array.isArray(stand?.fertigIds) || !Array.isArray(stand?.kettenIds)) return false
  if (stand.kettenIds.length !== kette.length) return false
  if (!kette.every((eintrag, idx) => eintrag.instanzId === stand.kettenIds[idx])) return false
  const pfeilMenge = new Set(pfeile.map((p) => p.von + '→' + p.nach))
  if (!Array.isArray(stand.pfeile) || stand.pfeile.length !== pfeilMenge.size) return false
  if (!stand.pfeile.every((paar) => Array.isArray(paar) && pfeilMenge.has(paar[0] + '→' + paar[1])))
    return false
  const idMenge = new Set(kette.map((eintrag) => eintrag.instanzId))
  if (!stand.fertigIds.every((id) => idMenge.has(id))) return false
  const alteZusaetze = new Map(Array.isArray(stand.zusaetze) ? stand.zusaetze : [])
  return kette.every(
    (eintrag) => (alteZusaetze.get(eintrag.instanzId) ?? '') === zusatznameBereinigen(eintrag.zusatz)
  )
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
