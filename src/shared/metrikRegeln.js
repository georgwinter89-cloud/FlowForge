// Metriken (BAUPLAN 31): reine Rechenregeln — ohne Electron, ohne Dateien,
// deshalb im geteilten Bereich und per Prüfskript nachmessbar. Zwei Quellen:
//
// 1. Lokale KI: Jedes Urteil über lokale Arbeit (übernommen/verworfen,
//    gehalten/nicht gehalten, gescheitert) landet als Zeile in der globalen
//    Metrik-Datei (Hauptprozess, metriken.js). Hier: Tabelle Modell × Bereich.
// 2. Motor: Die Laufberichte aller bekannten Projekte — die Daten liegen dort
//    exakt vor, auch für alte Läufe. Hier: der schmale Extrakt je Bericht
//    (nur Zahlen, kein Ticker) und die Schnitte je Blocktyp, Kette, Projekt
//    und Woche.
//
// Ehrlichkeit: Alte Berichte haben teils keine Kosten und teils keine
// Block-Tokens — solche Einträge zählen als „ohne Kosten"/„ohne Verbrauch"
// und fallen aus den Durchschnitten heraus, statt sie zu verfälschen.

import { klasseIstLokal, klasseKenntDenktiefe } from './blockKatalog.js'

export const BEREICHE = ['recherche', 'entwurf', 'reparatur', 'bauen']
export const AUSGAENGE = ['uebernommen', 'verworfen', 'gehalten', 'nicht-gehalten', 'gescheitert']

// Ein Urteil aus der Metrik-Datei auf die Pflichtfelder prüfen — kaputte
// oder fremde Zeilen fallen still heraus.
export function urteilPruefen(roh) {
  if (!roh || typeof roh !== 'object') return null
  if (!BEREICHE.includes(roh.bereich) || !AUSGAENGE.includes(roh.ausgang)) return null
  const zeit = String(roh.zeit ?? '')
  if (!Number.isFinite(new Date(zeit).getTime())) return null
  return {
    zeit,
    projektPfad: String(roh.projektPfad ?? ''),
    laufId: String(roh.laufId ?? ''),
    block: String(roh.block ?? ''),
    modell: String(roh.modell ?? '').trim() || '?',
    bereich: roh.bereich,
    ausgang: roh.ausgang,
    schritte: Number.isFinite(Number(roh.schritte)) ? Math.max(0, Math.round(Number(roh.schritte))) : 0
  }
}

// Positive Urteile: der Agent hat die lokale Arbeit übernommen bzw. sie hat
// die Nachprüfung gehalten. Negative: verworfen / nicht gehalten. Gescheitert
// (Kreislauf ohne Ergebnis) zählt gesondert — er ist kein Urteil über die
// Qualität, aber ehrlich Teil der Bilanz.
function istPositiv(ausgang) {
  return ausgang === 'uebernommen' || ausgang === 'gehalten'
}
function istNegativ(ausgang) {
  return ausgang === 'verworfen' || ausgang === 'nicht-gehalten'
}

// Tabelle Modell × Bereich → Anzahl, Quote, Schritte, Fehlschläge, Zeitraum.
// Zeilen sortiert nach Modell, dann Bereich in fester Reihenfolge.
export function lokaleKiAuswerten(urteile) {
  const zellen = new Map()
  for (const u of urteile) {
    // Trennzeichen als Escape-Folge, nie als rohes Zeichen: Ein echtes
    // NUL-Byte in der Quelldatei macht sie für git und die Projektsuche zur
    // Binärdatei — der Diff zeigt dann nur „Bin …", und kein Grep findet die
    // Stelle mehr. Zur Laufzeit ist es dasselbe Zeichen.
    const schluessel = `${u.modell}\u0000${u.bereich}`
    let z = zellen.get(schluessel)
    if (!z) {
      z = {
        modell: u.modell,
        bereich: u.bereich,
        anzahl: 0,
        positiv: 0,
        negativ: 0,
        gescheitert: 0,
        schritte: 0,
        von: u.zeit,
        bis: u.zeit
      }
      zellen.set(schluessel, z)
    }
    z.anzahl++
    if (istPositiv(u.ausgang)) z.positiv++
    else if (istNegativ(u.ausgang)) z.negativ++
    else z.gescheitert++
    z.schritte += u.schritte
    if (u.zeit < z.von) z.von = u.zeit
    if (u.zeit > z.bis) z.bis = u.zeit
  }
  const zeilen = [...zellen.values()].map((z) => ({
    ...z,
    // Quote = Anteil positiver Urteile an allen beurteilten (ohne gescheiterte).
    quote: z.positiv + z.negativ > 0 ? z.positiv / (z.positiv + z.negativ) : null,
    schritteDurchschnitt: z.anzahl > 0 ? z.schritte / z.anzahl : 0
  }))
  zeilen.sort(
    (a, b) =>
      a.modell.localeCompare(b.modell, 'de') || BEREICHE.indexOf(a.bereich) - BEREICHE.indexOf(b.bereich)
  )
  return { zeilen, anzahl: urteile.length }
}

// ISO-Woche (Montag bis Sonntag) eines Zeitpunkts in Ortszeit:
// { schluessel: '2026-W33', montag: Date, sonntag: Date }.
export function wocheVon(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const tag = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const wochentag = (tag.getDay() + 6) % 7 // Montag = 0
  const montag = new Date(tag)
  montag.setDate(tag.getDate() - wochentag)
  const sonntag = new Date(montag)
  sonntag.setDate(montag.getDate() + 6)
  // ISO-Wochennummer: der Donnerstag der Woche entscheidet übers Jahr.
  const donnerstag = new Date(montag)
  donnerstag.setDate(montag.getDate() + 3)
  const jahr = donnerstag.getFullYear()
  const ersterJan = new Date(jahr, 0, 1)
  // Tag im Jahr des Donnerstags (gerundet — Sommerzeit-Sprünge kürzen einen Tag um eine Stunde).
  const tagImJahr = Math.round((donnerstag - ersterJan) / 86400000) + 1
  const nummer = Math.ceil(tagImJahr / 7)
  return {
    schluessel: `${jahr}-W${String(nummer).padStart(2, '0')}`,
    nummer,
    jahr,
    montag,
    sonntag
  }
}

// Der schmale Extrakt eines Laufberichts — nur, was die Metriken brauchen.
// Wiederholung: Läuft dieselbe Schaubild-Karte (instanzId) im selben Lauf
// erneut, ist das eine Reparatur-Runde, Nachprüfung oder Nachforderung —
// getrennt gezählt, sonst verzerrt sie den Durchschnitt des Erstlaufs.
// Modell je Block (BAUPLAN 36): Aus den Anteilen eines Block-Eintrags wird das
// führende Modell (die Tabelle Blocktyp × Modell wäre sonst unlesbar zerfasert).
// Fehlt die Angabe ganz — alte Berichte, oder das Tor ohne KI, bei dem gar kein
// Modell lief —, zählt der Eintrag ehrlich als „ohne Modell".
export const OHNE_MODELL = '(ohne Modell)'
export function modellVonEintrag(e) {
  const liste = Array.isArray(e?.modelle) ? e.modelle : []
  let bestes = null
  for (const m of liste) {
    const name = String(m?.modell ?? '').trim()
    if (!name) continue
    const tokens = Number.isFinite(m?.tokens) ? m.tokens : 0
    if (!bestes || tokens > bestes.tokens) bestes = { modell: name, tokens }
  }
  return bestes ? bestes.modell : OHNE_MODELL
}

// Zählt ein Feld, das es in alten Berichten noch nicht gab: Länge oder null.
function laengeOderNull(wert) {
  return Array.isArray(wert) ? wert.length : null
}

export function wirksameDenktiefe(e) {
  const gemessen = typeof e?.denktiefeGemessen === 'string' ? e.denktiefeGemessen.trim() : ''
  if (gemessen) return gemessen
  const gewaehlt = typeof e?.denktiefe === 'string' ? e.denktiefe.trim() : ''
  if (!gewaehlt || gewaehlt === 'standard') return ''
  return klasseKenntDenktiefe(e?.klasse) ? gewaehlt : ''
}

// Abnahme-Paare am Eintrag eines Abnahme-Prüfers (BAUPLAN 50, Felder aus
// lauf.js): je lokalem Partner beide Urteile, Tor-Nachspiel, Widerspruch und
// ob das Abnahme-Urteil aus dem eigenen Vor-Tor kam. Nur vollständige Einträge
// zählen — eine Zeile ohne Urteil ist kein Paar.
const URTEILE = ['bestanden', 'fehlgeschlagen']
function abnahmeFuerAusEintrag(e) {
  if (!Array.isArray(e?.abnahmeFuer)) return []
  const paare = []
  for (const a of e.abnahmeFuer) {
    if (!a || typeof a !== 'object') continue
    if (!URTEILE.includes(a.urteilLokal) || !URTEILE.includes(a.urteilAbnahme)) continue
    paare.push({
      instanzId: String(a.instanzId ?? ''),
      block: String(a.block ?? ''),
      zusatz: String(a.zusatz ?? ''),
      modell: String(a.modell ?? '').trim() || OHNE_MODELL,
      urteilLokal: a.urteilLokal,
      torBestaetigung: typeof a.torBestaetigung === 'string' ? a.torBestaetigung : null,
      urteilAbnahme: a.urteilAbnahme,
      widerspruch: a.urteilLokal !== a.urteilAbnahme,
      durchTor: Boolean(a.durchTor)
    })
  }
  return paare
}

export function laufExtraktAusBericht(bericht, projektPfad) {
  if (!bericht || typeof bericht !== 'object') return null
  const gestartetAm = String(bericht.gestartetAm ?? '')
  if (!Number.isFinite(new Date(gestartetAm).getTime())) return null
  const gesehen = new Set()
  // Erstbestehen (BAUPLAN 36): Es zählt nicht der erste Anlauf einer
  // Prüferkarte, sondern ihr erstes echtes Urteil — ein Anlauf, den FlowForge
  // wegen eines fehlenden Prüfbefehls abgebrochen hat, trägt noch keines.
  const mitUrteil = new Set()
  const bloecke = []
  for (const e of Array.isArray(bericht.blockErgebnisse) ? bericht.blockErgebnisse : []) {
    if (!e || typeof e !== 'object') continue
    const block = String(e.block ?? '').trim()
    if (!block) continue
    const schluessel = String(e.instanzId ?? block)
    const zustand = String(e.zustand ?? '')
    const istUrteil = zustand === 'pruefung-bestanden' || zustand === 'pruefung-nicht-bestanden'
    bloecke.push({
      block,
      zustand,
      tokens: Number.isFinite(e.tokens) ? e.tokens : null,
      kostenUsd: Number.isFinite(e.kostenUsd) ? e.kostenUsd : null,
      // Block-Dauer (BAUPLAN 51): Summe der Wanduhrzeiten aller Anläufe des
      // Blocks (je Anlauf Motorstart bis Ergebnis; Wartezeiten ZWISCHEN
      // Anläufen zählen nicht). Alte Berichte haben das Feld nicht — null,
      // fällt aus den Durchschnitten, nie 0.
      dauerMs: Number.isFinite(e.dauerMs) ? e.dauerMs : null,
      modell: modellVonEintrag(e),
      // Denktiefe (0.48.1): die WIRKSAME Stufe — gemessen (effort.level aus dem
      // Hook) schlägt die Wahl; ohne Messung zählt die Wahl nur, wenn die
      // Klasse Denktiefe überhaupt kennt (Haiku ignoriert sie — eine ignorierte
      // Wahl ist keine Denktiefe) und sie nicht Modell-Standard ist. Sonst ''.
      denktiefe: wirksameDenktiefe(e),
      wiederholung: gesehen.has(schluessel),
      erstesUrteil: istUrteil && !mitUrteil.has(schluessel),
      // Lokaler Prüfer mit Abnahme (BAUPLAN 50): Kennung, Klasse, Tor-Nachspiel
      // und die Abnahme-Paare dieses Anlaufs — damit abnahmeAuswerten Paare
      // und Widersprüche zählen kann. Alte Berichte: '' / null / [].
      instanzId: schluessel,
      klasse: typeof e.klasse === 'string' ? e.klasse : '',
      torBestaetigung: typeof e.torBestaetigung === 'string' ? e.torBestaetigung : null,
      abnahmeFuer: abnahmeFuerAusEintrag(e)
    })
    gesehen.add(schluessel)
    if (istUrteil) mitUrteil.add(schluessel)
  }
  const verbrauch = bericht.verbrauch && typeof bericht.verbrauch === 'object' ? bericht.verbrauch : null
  // „Davon lokal" je Lauf (BAUPLAN 51): bevorzugt bericht.verbrauch.lokal —
  // im Hauptprozess an gesamtVerbrauch geführt, zählt also auch Anläufe, die
  // kein blockErgebnis gepusht haben (kontingent-erschöpft). Rückfall für
  // 0.49/0.50-Berichte (lokale Blöcke, aber kein verbrauch.lokal): Summe der
  // Blöcke mit Klasse „lokal". Die Dauer gibt es rückwirkend nicht — dann
  // null („ohne Angabe", fällt aus Durchschnitten, nie 0). Berichte ganz ohne
  // lokale Blöcke haben ehrlich 0 lokal.
  const verbrauchLokal =
    verbrauch && verbrauch.lokal && typeof verbrauch.lokal === 'object' ? verbrauch.lokal : null
  let lokalTokens
  let lokalDauerMs
  if (verbrauchLokal && Number.isFinite(verbrauchLokal.tokens)) {
    lokalTokens = verbrauchLokal.tokens
    lokalDauerMs = Number.isFinite(verbrauchLokal.dauerMs) ? verbrauchLokal.dauerMs : null
  } else {
    const lokalBloecke = bloecke.filter((b) => klasseIstLokal(b.klasse))
    lokalTokens = 0
    for (const b of lokalBloecke) if (b.tokens != null) lokalTokens += b.tokens
    if (lokalBloecke.length === 0) lokalDauerMs = 0
    else if (lokalBloecke.every((b) => b.dauerMs != null))
      lokalDauerMs = lokalBloecke.reduce((summe, b) => summe + b.dauerMs, 0)
    else lokalDauerMs = null
  }
  return {
    id: String(bericht.id ?? gestartetAm),
    projektPfad: String(projektPfad ?? ''),
    workflow: String(bericht.workflow ?? '').trim() || '?',
    sonderlauf: bericht.sonderlauf ? String(bericht.sonderlauf) : null,
    gestartetAm,
    beendetAm: bericht.beendetAm ? String(bericht.beendetAm) : null,
    zustand: String(bericht.zustand ?? ''),
    tokens: verbrauch && Number.isFinite(verbrauch.tokens) ? verbrauch.tokens : null,
    kostenUsd: verbrauch && Number.isFinite(verbrauch.kostenUsd) ? verbrauch.kostenUsd : null,
    lokalTokens,
    lokalDauerMs,
    lokaleHelfer: Boolean(bericht.lokaleHelfer),
    // Harness-Kennzahlen (BAUPLAN 36): Diese Zahlen liegen in jedem Bericht
    // schon vor — auch rückwirkend. Nur die Zusammenfassungen sind neu; ältere
    // Berichte liefern dafür null statt 0 (keine Angabe ≠ keine Zusammenfassung).
    rechteFragen: laengeOderNull(bericht.rechteFragen) ?? 0,
    folgenFragen: laengeOderNull(bericht.entscheidungen) ?? 0,
    uebertraege: laengeOderNull(bericht.uebertraege) ?? 0,
    zusammenfassungen: laengeOderNull(bericht.zusammenfassungen),
    bloecke
  }
}

// Ein Sammel-Eimer für Zahlen mit ehrlicher Lücken-Zählung.
function eimer(extra = {}) {
  return {
    anzahl: 0,
    tokens: 0,
    mitTokens: 0,
    ohneTokens: 0,
    kostenUsd: 0,
    mitKosten: 0,
    ohneKosten: 0,
    // Block-Dauer (BAUPLAN 51): nach dem Muster mitTokens/ohneTokens — alte
    // Einträge ohne Angabe fallen aus dem Durchschnitt, statt ihn zu drücken.
    dauerMs: 0,
    mitDauer: 0,
    ohneDauer: 0,
    // „Davon lokal" je Lauf (BAUPLAN 51): Tokens der lokalen Blöcke plus
    // Dauer-Summe, mit ehrlicher Lücke für 0.49/0.50-Läufe ohne Dauer-Felder.
    lokalTokens: 0,
    lokalLaeufe: 0,
    lokalDauerMs: 0,
    mitLokalDauer: 0,
    ohneLokalDauer: 0,
    ...extra
  }
}
function einwerfen(e, tokens, kostenUsd) {
  e.anzahl++
  if (tokens != null) {
    e.tokens += tokens
    e.mitTokens++
  } else e.ohneTokens++
  if (kostenUsd != null) {
    e.kostenUsd += kostenUsd
    e.mitKosten++
  } else e.ohneKosten++
}
// Block-Dauer in den Eimer — getrennt von einwerfen, weil die Dauer nur an
// Block-Eimern sinnvoll ist (die Lauf-Dauer rechnet die Oberfläche aus
// gestartetAm/beendetAm).
function dauerEinwerfen(e, dauerMs) {
  if (dauerMs != null) {
    e.dauerMs += dauerMs
    e.mitDauer++
  } else e.ohneDauer++
}
// „Davon lokal" eines Laufs in den Eimer. Läufe ohne lokale Arbeit zählen
// nicht als Dauer-Lücke — nur Läufe MIT lokalen Tokens, deren Dauer fehlt.
function lokalEinwerfen(e, lauf) {
  const tokens = Number.isFinite(lauf.lokalTokens) ? lauf.lokalTokens : 0
  e.lokalTokens += tokens
  if (tokens > 0) {
    e.lokalLaeufe++
    if (lauf.lokalDauerMs != null) {
      e.lokalDauerMs += lauf.lokalDauerMs
      e.mitLokalDauer++
    } else e.ohneLokalDauer++
  }
}
function mitDurchschnitt(e) {
  return {
    ...e,
    tokensDurchschnitt: e.mitTokens > 0 ? e.tokens / e.mitTokens : null,
    kostenDurchschnitt: e.mitKosten > 0 ? e.kostenUsd / e.mitKosten : null,
    dauerDurchschnitt: e.mitDauer > 0 ? e.dauerMs / e.mitDauer : null
  }
}

// Motor-Schnitte über eine (ggf. schon gefilterte) Liste von Lauf-Extrakten.
export function motorAuswerten(extrakte) {
  const gesamt = eimer()
  const jeKette = new Map()
  const jeProjekt = new Map()
  const jeWoche = new Map()
  const jeBlock = new Map()
  for (const lauf of extrakte) {
    einwerfen(gesamt, lauf.tokens, lauf.kostenUsd)
    lokalEinwerfen(gesamt, lauf)
    const kettenName = lauf.workflow
    if (!jeKette.has(kettenName)) jeKette.set(kettenName, eimer({ kette: kettenName }))
    einwerfen(jeKette.get(kettenName), lauf.tokens, lauf.kostenUsd)
    lokalEinwerfen(jeKette.get(kettenName), lauf)
    if (!jeProjekt.has(lauf.projektPfad))
      jeProjekt.set(lauf.projektPfad, eimer({ projektPfad: lauf.projektPfad }))
    einwerfen(jeProjekt.get(lauf.projektPfad), lauf.tokens, lauf.kostenUsd)
    lokalEinwerfen(jeProjekt.get(lauf.projektPfad), lauf)
    const woche = wocheVon(lauf.gestartetAm)
    if (woche) {
      if (!jeWoche.has(woche.schluessel))
        jeWoche.set(
          woche.schluessel,
          eimer({
            schluessel: woche.schluessel,
            nummer: woche.nummer,
            jahr: woche.jahr,
            montag: woche.montag.toISOString(),
            sonntag: woche.sonntag.toISOString()
          })
        )
      einwerfen(jeWoche.get(woche.schluessel), lauf.tokens, lauf.kostenUsd)
      lokalEinwerfen(jeWoche.get(woche.schluessel), lauf)
    }
    for (const b of lauf.bloecke) {
      if (!jeBlock.has(b.block))
        jeBlock.set(b.block, { block: b.block, erstlauf: eimer(), wiederholung: eimer() })
      const ziel = b.wiederholung ? jeBlock.get(b.block).wiederholung : jeBlock.get(b.block).erstlauf
      einwerfen(ziel, b.tokens, b.kostenUsd)
      dauerEinwerfen(ziel, b.dauerMs)
    }
  }
  const nachAnzahl = (a, b) => b.anzahl - a.anzahl
  return {
    gesamt: mitDurchschnitt(gesamt),
    jeBlock: [...jeBlock.values()]
      .map((z) => ({
        block: z.block,
        erstlauf: mitDurchschnitt(z.erstlauf),
        wiederholung: mitDurchschnitt(z.wiederholung)
      }))
      .sort((a, b) => b.erstlauf.anzahl - a.erstlauf.anzahl || a.block.localeCompare(b.block, 'de')),
    jeKette: [...jeKette.values()].map(mitDurchschnitt).sort(nachAnzahl),
    jeProjekt: [...jeProjekt.values()].map(mitDurchschnitt).sort(nachAnzahl),
    // Zeitverlauf: chronologisch, für Balken „wird es billiger?".
    jeWoche: [...jeWoche.values()]
      .map(mitDurchschnitt)
      .sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1))
  }
}

// Blocktyp × Modell (BAUPLAN 36): dieselbe Tabellen-Idee wie Modell × Bereich
// bei der lokalen KI — nur eben für den Motor. Neben Anzahl und Ø-Verbrauch
// steht das „schafft es"-Signal: Wiederholungen (Reparatur-Runden,
// Nachprüfungen, Nachforderungen) und bei Prüf-Blöcken die Erstbestehen-Quote.
export function blockModellAuswerten(extrakte) {
  const zellen = new Map()
  for (const lauf of extrakte)
    for (const b of lauf.bloecke) {
      // Trennzeichen als Escape-Folge, nie als rohes Zeichen: Ein echtes
      // NUL-Byte in der Quelldatei macht sie für git und die Projektsuche zur
      // Binärdatei — der Diff zeigt dann nur „Bin …", und kein Grep findet die
      // Stelle mehr. Zur Laufzeit ist es dasselbe Zeichen.
      // Seit 0.48.1 teilt die Denktiefe die Zeilen (Reparatur-Runden je
      // Denktiefe — die Zahl, an der Georg sie einstellt); alte Extrakte ohne
      // Feld zählen als ''.
      const denktiefe = typeof b.denktiefe === 'string' ? b.denktiefe : ''
      const schluessel = b.block + '\u0000' + b.modell + '\u0000' + denktiefe
      let z = zellen.get(schluessel)
      if (!z) {
        z = {
          block: b.block,
          modell: b.modell,
          denktiefe,
          erstlauf: eimer(),
          wiederholung: eimer(),
          ersteUrteile: 0,
          erstBestanden: 0
        }
        zellen.set(schluessel, z)
      }
      const ziel = b.wiederholung ? z.wiederholung : z.erstlauf
      einwerfen(ziel, b.tokens, b.kostenUsd)
      // Ø-Dauer je Zeile (BAUPLAN 51) — löst die SPEC-Zusage §3.4 ein, dass
      // die lokale Zeile Dauer zeigt; ältere Einträge zählen als „ohne Angabe".
      dauerEinwerfen(ziel, b.dauerMs)
      if (b.erstesUrteil) {
        z.ersteUrteile++
        if (b.zustand === 'pruefung-bestanden') z.erstBestanden++
      }
    }
  return [...zellen.values()]
    .map((z) => ({
      block: z.block,
      modell: z.modell,
      denktiefe: z.denktiefe,
      erstlauf: mitDurchschnitt(z.erstlauf),
      wiederholung: mitDurchschnitt(z.wiederholung),
      ersteUrteile: z.ersteUrteile,
      erstBestanden: z.erstBestanden,
      // null = kein Prüf-Block (oder noch nie geurteilt) — keine Quote erfinden.
      erstbestehenQuote: z.ersteUrteile > 0 ? z.erstBestanden / z.ersteUrteile : null
    }))
    .sort(
      (a, b) =>
        b.erstlauf.anzahl - a.erstlauf.anzahl ||
        a.block.localeCompare(b.block, 'de') ||
        a.modell.localeCompare(b.modell, 'de') ||
        a.denktiefe.localeCompare(b.denktiefe, 'de')
    )
}

// Ein Sammel-Eimer für die Harness-Kennzahlen eines Ausschnitts (gesamt, je
// Kette, je Woche). Zusammenfassungen sind erst ab Bauschritt 36 im Bericht —
// deshalb wird getrennt gezählt, wie viele Läufe dazu überhaupt etwas sagen.
function harnessEimer(extra = {}) {
  return {
    laeufe: 0,
    mitPruefung: 0,
    erstBestanden: 0,
    reparaturRunden: 0,
    rechteFragen: 0,
    folgenFragen: 0,
    uebertraege: 0,
    zusammenfassungen: 0,
    mitZusammenfassungsAngabe: 0,
    ausgaenge: new Map(),
    ...extra
  }
}
function harnessEinwerfen(e, lauf) {
  e.laeufe++
  const ersteUrteile = lauf.bloecke.filter((b) => b.erstesUrteil)
  if (ersteUrteile.length > 0) {
    e.mitPruefung++
    // „Beim ersten Mal bestanden" heißt: JEDE Prüferkarte des Laufs hat ihr
    // erstes Urteil bestanden — ein Lauf mit zwei Prüfern, von denen einer
    // zurückschickt, hat nicht beim ersten Mal bestanden.
    if (ersteUrteile.every((b) => b.zustand === 'pruefung-bestanden')) e.erstBestanden++
  }
  // Reparatur-Runde = ein Prüf-Urteil „nicht bestanden": Jedes schickt den Lauf
  // zurück zum Bauer — oder löst, wenn die Runden verbraucht sind, die
  // Folgen-Frage aus. Aus den Berichten ist genau das ablesbar.
  e.reparaturRunden += lauf.bloecke.filter((b) => b.zustand === 'pruefung-nicht-bestanden').length
  e.rechteFragen += lauf.rechteFragen
  e.folgenFragen += lauf.folgenFragen
  e.uebertraege += lauf.uebertraege
  if (lauf.zusammenfassungen != null) {
    e.mitZusammenfassungsAngabe++
    e.zusammenfassungen += lauf.zusammenfassungen
  }
  e.ausgaenge.set(lauf.zustand, (e.ausgaenge.get(lauf.zustand) ?? 0) + 1)
}
function harnessAbschluss(e) {
  const jeLauf = (summe) => (e.laeufe > 0 ? summe / e.laeufe : null)
  return {
    ...e,
    ausgaenge: [...e.ausgaenge]
      .map(([zustand, anzahl]) => ({ zustand, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl),
    erstbestehenQuote: e.mitPruefung > 0 ? e.erstBestanden / e.mitPruefung : null,
    reparaturJeLauf: jeLauf(e.reparaturRunden),
    rechteJeLauf: jeLauf(e.rechteFragen),
    folgenJeLauf: jeLauf(e.folgenFragen),
    uebertraegeJeLauf: jeLauf(e.uebertraege),
    zusammenfassungenJeLauf:
      e.mitZusammenfassungsAngabe > 0 ? e.zusammenfassungen / e.mitZusammenfassungsAngabe : null,
    ohneZusammenfassungsAngabe: e.laeufe - e.mitZusammenfassungsAngabe
  }
}

// Harness-Kennzahlen (BAUPLAN 36): Wie gut trägt das Gerüst? Score UND Kosten
// messen, nicht nur Kosten — Erstbestehen, Reparatur-Runden, Rückfragen,
// Folgen-Fragen, Überträge, Zusammenfassungen und der Lauf-Ausgang, gesamt
// sowie je Kette und Kalenderwoche.
export function harnessAuswerten(extrakte) {
  const gesamt = harnessEimer()
  const jeKette = new Map()
  const jeWoche = new Map()
  for (const lauf of extrakte) {
    harnessEinwerfen(gesamt, lauf)
    if (!jeKette.has(lauf.workflow)) jeKette.set(lauf.workflow, harnessEimer({ kette: lauf.workflow }))
    harnessEinwerfen(jeKette.get(lauf.workflow), lauf)
    const woche = wocheVon(lauf.gestartetAm)
    if (woche) {
      if (!jeWoche.has(woche.schluessel))
        jeWoche.set(
          woche.schluessel,
          harnessEimer({
            schluessel: woche.schluessel,
            nummer: woche.nummer,
            jahr: woche.jahr,
            montag: woche.montag.toISOString(),
            sonntag: woche.sonntag.toISOString()
          })
        )
      harnessEinwerfen(jeWoche.get(woche.schluessel), lauf)
    }
  }
  return {
    gesamt: harnessAbschluss(gesamt),
    jeKette: [...jeKette.values()].map(harnessAbschluss).sort((a, b) => b.laeufe - a.laeufe),
    jeWoche: [...jeWoche.values()]
      .map(harnessAbschluss)
      .sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1))
  }
}

// Urteil lokal vs. Abnahme (BAUPLAN 50): Wie oft widerspricht der Claude-
// Prüfer dahinter dem lokalen Prüfer — die Zahl, an der Georg entscheidet, ob
// der lokale Prüfer bleibt. Dazu das Tor-Nachspiel: Wie oft dreht der eigene
// Prüfbefehl ein lokales „bestanden"?
//
// Zählregel: Je (Lauf, lokaler Prüfer, Abnahme-Prüfer) zählt nur das ERSTE
// Urteil der Abnahme, das vom Agenten kam (durchTor === false). Reparatur-
// Runden danach sind Wiederholungen desselben Paars, und ein Urteil aus dem
// Vor-Tor der Abnahme (Prüfbefehl rot vor dem Agentenstart) ist kein Opus-
// Widerspruch — sonst zählte jede mechanische Nachprüfung als „Abnahme
// widerspricht". Ehrlich: null statt 0, wo es keine Paare/Nachspiele gibt.
const TOR_NACHSPIELE = ['gruen', 'altlasten', 'rot']
export function abnahmeAuswerten(extrakte) {
  const gesamt = { paare: 0, widersprueche: 0, torNachspiele: 0, torWidersprueche: 0 }
  const zellen = new Map()
  for (const lauf of extrakte) {
    const gezaehlt = new Set()
    for (const b of lauf.bloecke) {
      if (klasseIstLokal(b.klasse) && TOR_NACHSPIELE.includes(b.torBestaetigung)) {
        gesamt.torNachspiele++
        if (b.torBestaetigung === 'rot') gesamt.torWidersprueche++
      }
      for (const a of b.abnahmeFuer ?? []) {
        if (a.durchTor) continue
        const paarSchluessel = a.instanzId + '\u0000' + b.instanzId
        if (gezaehlt.has(paarSchluessel)) continue
        gezaehlt.add(paarSchluessel)
        const schluessel = a.modell + '\u0000' + b.modell
        let z = zellen.get(schluessel)
        if (!z) {
          z = { lokalModell: a.modell, abnahmeModell: b.modell, paare: 0, einig: 0, widersprueche: 0 }
          zellen.set(schluessel, z)
        }
        z.paare++
        gesamt.paare++
        if (a.widerspruch) {
          z.widersprueche++
          gesamt.widersprueche++
        } else z.einig++
      }
    }
  }
  return {
    gesamt: {
      ...gesamt,
      quote: gesamt.paare > 0 ? gesamt.widersprueche / gesamt.paare : null,
      torQuote: gesamt.torNachspiele > 0 ? gesamt.torWidersprueche / gesamt.torNachspiele : null
    },
    zeilen: [...zellen.values()]
      .map((z) => ({ ...z, quote: z.paare > 0 ? z.widersprueche / z.paare : null }))
      .sort(
        (a, b) =>
          b.paare - a.paare ||
          a.lokalModell.localeCompare(b.lokalModell, 'de') ||
          a.abnahmeModell.localeCompare(b.abnahmeModell, 'de')
      )
  }
}

// Lokale Bilanz (BAUPLAN 51): Welche Blöcke liefen lokal gut? Reine
// Rechenfunktion für den Datenblock im Co-Pilot-Systemtext — per Prüfskript
// messbar. Drei Quellen, alle vorhanden: die Urteile der lokalen Zuarbeit
// (lokale-ki.jsonl, Modell × Bereich), die lokalen Block-Anläufe der
// Laufberichte (Blocktyp × Modell, Erstbestehen bei Prüfern) und die
// Abnahme-Paare aus Bauschritt 50 (lokaler Prüfer vs. Claude-Abnahme).
//
// Ehrlichkeits-Regeln (Bauvertrag V3): Ein Urteil „lief gut" gibt es NUR ab
// BILANZ_MIN_FAELLE Fällen und Quote ≥ BILANZ_GUT_QUOTE (bei Prüfer-Paaren:
// Widerspruchsquote ≤ BILANZ_WIDERSPRUCH_GUT) — sonst würde der Chat aus zwei
// Urteilen „lief gut" machen. Zeilen „(ohne Modell)" erscheinen nie. Deckel
// BILANZ_MAX_ZEILEN, sortiert nach Fallzahl — der Systemtext darf nicht
// aufblähen.
export const BILANZ_MIN_FAELLE = 5
export const BILANZ_GUT_QUOTE = 0.7
export const BILANZ_SCHLECHT_QUOTE = 0.3
export const BILANZ_WIDERSPRUCH_GUT = 0.2
export const BILANZ_WIDERSPRUCH_SCHLECHT = 0.5
export const BILANZ_MAX_ZEILEN = 15

// Urteil aus Fallzahl und Quote: 'zuWenig' unter der Mindestfallzahl, sonst
// 'gut'/'schlecht'/'offen'. hochIstGut=false für Widerspruchsquoten.
function bilanzUrteil(faelle, quote, hochIstGut = true) {
  if (faelle < BILANZ_MIN_FAELLE) return 'zuWenig'
  if (quote == null) return 'offen'
  if (hochIstGut) {
    if (quote >= BILANZ_GUT_QUOTE) return 'gut'
    if (quote <= BILANZ_SCHLECHT_QUOTE) return 'schlecht'
    return 'offen'
  }
  if (quote <= BILANZ_WIDERSPRUCH_GUT) return 'gut'
  if (quote >= BILANZ_WIDERSPRUCH_SCHLECHT) return 'schlecht'
  return 'offen'
}

export function lokaleBilanz(urteile, extrakte) {
  const zeilen = []
  // 1) Lokale Zuarbeit (Helfer-Kreisläufe): Modell × Bereich. Der
  //    Gescheitert-Anteil steht neben der Quote — er zählt nicht in die
  //    Quote, aber ein Modell mit 6 von 10 gescheiterten Kreisläufen ist
  //    keine Empfehlung.
  for (const z of lokaleKiAuswerten(urteile).zeilen) {
    if (z.modell === OHNE_MODELL || z.modell === '?') continue
    const faelle = z.positiv + z.negativ
    zeilen.push({
      art: 'zuarbeit',
      modell: z.modell,
      bereich: z.bereich,
      faelle,
      quote: z.quote,
      gescheitert: z.gescheitert,
      urteil: bilanzUrteil(faelle, z.quote)
    })
  }
  // 2) Lokale Block-Anläufe: Blocktyp × Modell über die Klasse „lokal"
  //    (seit 0.49 tragen alle lokalen Anläufe die Klasse). Qualitätssignal
  //    ist das Erstbestehen — nur Prüf-Blöcke haben eines; Bau-/Lese-Blöcke
  //    stehen mit Läufen und Wiederholungen als nackte Zahlen da ('offen').
  const zellen = new Map()
  for (const lauf of extrakte)
    for (const b of lauf.bloecke) {
      if (!klasseIstLokal(b.klasse) || b.modell === OHNE_MODELL) continue
      const schluessel = b.block + '\u0000' + b.modell
      let z = zellen.get(schluessel)
      if (!z) {
        z = { block: b.block, modell: b.modell, erstlaeufe: 0, wiederholungen: 0, ersteUrteile: 0, erstBestanden: 0 }
        zellen.set(schluessel, z)
      }
      if (b.wiederholung) z.wiederholungen++
      else z.erstlaeufe++
      if (b.erstesUrteil) {
        z.ersteUrteile++
        if (b.zustand === 'pruefung-bestanden') z.erstBestanden++
      }
    }
  for (const z of zellen.values()) {
    const quote = z.ersteUrteile > 0 ? z.erstBestanden / z.ersteUrteile : null
    const faelle = z.ersteUrteile > 0 ? z.ersteUrteile : z.erstlaeufe
    zeilen.push({
      art: 'block',
      block: z.block,
      modell: z.modell,
      erstlaeufe: z.erstlaeufe,
      wiederholungen: z.wiederholungen,
      ersteUrteile: z.ersteUrteile,
      erstBestanden: z.erstBestanden,
      faelle,
      quote,
      urteil: quote == null ? (faelle < BILANZ_MIN_FAELLE ? 'zuWenig' : 'offen') : bilanzUrteil(faelle, quote)
    })
  }
  // 3) Lokaler Prüfer × Abnahme (BAUPLAN 50): Widerspruchsquote — niedrig
  //    ist gut. Das Tor-Nachspiel kommt als Gesamtzahl mit.
  const abnahme = abnahmeAuswerten(extrakte)
  for (const z of abnahme.zeilen) {
    if (z.lokalModell === OHNE_MODELL || z.abnahmeModell === OHNE_MODELL) continue
    zeilen.push({
      art: 'abnahme',
      lokalModell: z.lokalModell,
      abnahmeModell: z.abnahmeModell,
      faelle: z.paare,
      widersprueche: z.widersprueche,
      quote: z.quote,
      urteil: bilanzUrteil(z.paare, z.quote, false)
    })
  }
  zeilen.sort((a, b) => b.faelle - a.faelle)
  const gedeckelt = zeilen.slice(0, BILANZ_MAX_ZEILEN)
  return {
    vorhanden: zeilen.length > 0,
    zeilen: gedeckelt,
    weggelassen: zeilen.length - gedeckelt.length,
    torNachspiele: abnahme.gesamt.torNachspiele,
    torWidersprueche: abnahme.gesamt.torWidersprueche,
    torQuote: abnahme.gesamt.torQuote
  }
}

