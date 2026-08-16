// Lieferschein (BAUPLAN 42): Blockergebnisse als geprüfte Felder statt als
// Marker-Zeilen im Abschlusstext. Bis Bauschritt 41 meldete ein Agent teils
// über Werkzeuge und teils über drei Zeilen im Fließtext („PRUEFUNG:",
// „BEANSTANDUNG (…):", „PRUEFKARTE:"), die FlowForge per Textsuche las — an
// diesen Zeilen hingen Urteil, Reparatur-Runde, lokale Vorreparatur und das
// Prüfkarten-Archiv. Vergaß das Modell eine Zeile, fehlte sie einfach.
//
// Hier stehen die reinen Regeln (ohne Motor, ohne Electron), damit die
// Prüfskripte sie direkt fahren können:
//   - welches Werkzeug zu welchem liefert-Etikett gehört,
//   - was eine Meldung enthalten muss (Ebene 2: Längen, Anzahl, Plausibilität —
//     Claudes strenger Schema-Modus kennt keine Längengrenzen),
//   - ob die Lieferung den Bedarf des Nachfolgers deckt (Ebene 3, Kanten-Prüfung),
//   - wie eine Meldung als lesbarer Text aussieht (Übergabe und Laufbericht).
// Die Schema-Ebene (Ebene 1) steht im Werkzeug selbst (lieferscheinWerkzeuge.js).
import { texte } from './texte.js'
import { TITEL_MAX, TEXT_MAX } from './kartenRegeln.js'

// Ein Werkzeug je liefert-Etikett, nicht je Blocksorte: Die MCP-Server werden
// einmal je Motor gebaut und ein Lauf-Motor bedient alle Blöcke (BAUPLAN 19) —
// ein Werkzeug, das sein Schema je Block wechselt, ist damit unmöglich.
export const FESTE_TEILE = {
  Arbeitspaket: { werkzeug: 'melde_arbeitspaket', art: 'arbeitspaket' },
  Prüfbeleg: { werkzeug: 'melde_pruefbeleg', art: 'pruefbeleg' },
  Umsetzungsbericht: { werkzeug: 'melde_umsetzungsbericht', art: 'umsetzungsbericht' },
  Angriffsliste: { werkzeug: 'melde_angriffsliste', art: 'funde' },
  Befundliste: { werkzeug: 'melde_befundliste', art: 'funde' }
}

// Der gemeinsame Rahmen allein — für Blöcke, die nichts liefern (Sessionende)
// und für die bewusst locker gehaltenen Etiketten (Projekt-Überblick, Antwort
// des Menschen, Kartenbericht, alles Selbstgebaute): Rahmen plus ein
// Freitext-Feld. Enge Schemata kosten Nuance bei explorativer Arbeit.
export const RAHMEN_WERKZEUG = 'melde_ergebnis'
export const WERKZEUG_PRAEFIX = 'mcp__lieferschein__'

// Harte Grenzen (Ebene 2). Bewusst großzügig genug für echte Arbeit und eng
// genug, dass ein Lieferschein den Kontext des nächsten Blocks nicht flutet.
export const FAZIT_MAX = 300
export const ZEILE_MAX = 300
export const LISTE_MAX = 20
export const ANMERKUNG_MAX = 1500
export const FUNDORT_MAX = 200
export const BEANSTANDUNG_MAX = 400
export const BELEG_MAX = 1200
export const INHALT_MAX = 6000

export const EINSTUFUNGEN = ['mechanisch', 'grundsaetzlich']
export const URTEILE = ['bestanden', 'fehlgeschlagen']
export const SCHWEREN = ['hoch', 'mittel', 'niedrig']
export const DATEI_ARTEN = ['neu', 'geaendert', 'geloescht']

export function teilFuerEtikett(etikett) {
  return FESTE_TEILE[etikett] ?? null
}

// Die Etiketten dieses Blocks ohne eigenes Werkzeug — sie laufen über den
// Rahmen (melde_ergebnis) mit Freitext.
export function lockereEtiketten(def) {
  return (def?.liefert ?? []).filter((etikett) => !teilFuerEtikett(etikett))
}

// Welche Lieferschein-Werkzeuge darf DIESER Block nutzen? Alles andere löst die
// übliche Rechte-Rückfrage aus (Freischalt-Muster wie karte_vorschlagen).
export function werkzeugeFuerBlock(def) {
  const namen = new Set()
  const etiketten = def?.liefert ?? []
  let brauchtRahmen = etiketten.length === 0
  for (const etikett of etiketten) {
    const teil = teilFuerEtikett(etikett)
    if (teil) namen.add(teil.werkzeug)
    else brauchtRahmen = true
  }
  if (brauchtRahmen) namen.add(RAHMEN_WERKZEUG)
  return namen
}

// Beim Laufstart steht das Schaubild fest — FlowForge registriert genau die
// Werkzeuge, die DIESE Kette braucht. `defs` sind die Blockdefinitionen der
// Kette (auch mehrfach; doppelte schaden nicht).
export function werkzeugeFuerKette(defs) {
  const namen = new Set()
  for (const def of defs ?? []) for (const name of werkzeugeFuerBlock(def)) namen.add(name)
  return [...namen]
}

// Welche Art Teil gehört zu diesem Werkzeug?
export function artFuerWerkzeug(werkzeug) {
  if (werkzeug === RAHMEN_WERKZEUG) return 'rahmen'
  for (const teil of Object.values(FESTE_TEILE)) if (teil.werkzeug === werkzeug) return teil.art
  return null
}

// Welches Etikett meldet dieser Block mit dem festen Werkzeug? Es gilt genau
// das Etikett des Blocks, das zu diesem Werkzeug gehört — so kann ein Angreifer
// keine Befundliste melden und umgekehrt.
export function etikettFuerWerkzeug(def, werkzeug) {
  for (const etikett of def?.liefert ?? [])
    if (teilFuerEtikett(etikett)?.werkzeug === werkzeug) return etikett
  return null
}

// Rahmen-Werkzeug: Zu welchem Etikett gehört diese Meldung? Bei genau einem
// lockeren Etikett ist die Zuordnung eindeutig; bei mehreren muss der Agent es
// nennen. Liefert { etikett } (null = Block liefert nichts) oder { fehler }.
export function rahmenEtikett(def, roh) {
  const locker = lockereEtiketten(def)
  const gewaehlt = String(roh ?? '').trim()
  if (locker.length === 0) {
    if (gewaehlt) return { fehler: texte.lieferschein.etikettUnbekannt(gewaehlt, locker) }
    return { etikett: null }
  }
  if (!gewaehlt) {
    if (locker.length === 1) return { etikett: locker[0] }
    return { fehler: texte.lieferschein.etikettFehlt(locker) }
  }
  const treffer = locker.find((e) => e.toLowerCase() === gewaehlt.toLowerCase())
  if (!treffer) return { fehler: texte.lieferschein.etikettUnbekannt(gewaehlt, locker) }
  return { etikett: treffer }
}

// --- Ebene 2: FlowForge prüft im Code ---------------------------------------

function einzeilig(wert) {
  return String(wert ?? '').replace(/\s+/g, ' ').trim()
}

function mehrzeilig(wert) {
  return String(wert ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

// Ein Pflicht-Textfeld: gefüllt und in der Längengrenze (die Ablehnung nennt
// die Ist-Länge — dieselbe Ehrlichkeit wie bei den Karten).
function pflichtText(wert, max, feld, einzeilen = true) {
  const text = einzeilen ? einzeilig(wert) : mehrzeilig(wert)
  if (!text) return { fehler: texte.lieferschein.feldFehlt(feld) }
  if (text.length > max) return { fehler: texte.lieferschein.feldZuLang(feld, max, text.length) }
  return { text }
}

function freierText(wert, max, feld, einzeilen = true) {
  const text = einzeilen ? einzeilig(wert) : mehrzeilig(wert)
  if (!text) return { text: '' }
  if (text.length > max) return { fehler: texte.lieferschein.feldZuLang(feld, max, text.length) }
  return { text }
}

// Eine Liste kurzer Zeilen: leere Einträge fliegen raus, Anzahl und Länge sind
// gedeckelt.
function zeilenListe(roh, feld, { max = LISTE_MAX, zeileMax = ZEILE_MAX } = {}) {
  const zeilen = []
  for (const eintrag of Array.isArray(roh) ? roh : []) {
    const text = einzeilig(eintrag)
    if (!text) continue
    if (text.length > zeileMax)
      return { fehler: texte.lieferschein.eintragZuLang(feld, zeileMax, text.length) }
    zeilen.push(text)
  }
  if (zeilen.length > max) return { fehler: texte.lieferschein.zuVieleEintraege(feld, max, zeilen.length) }
  return { zeilen }
}

// Der gemeinsame Rahmen aller Meldungen (BAUPLAN 42): fazit · getan · offen ·
// anmerkung. Das Freifeld ist die Antwort auf die Formular-Falle — was in kein
// Feld passt und der nächste Block trotzdem wissen sollte.
function rahmenPruefen(roh) {
  const tl = texte.lieferschein
  const fazit = pflichtText(roh?.fazit, FAZIT_MAX, tl.felder.fazit)
  if (fazit.fehler) return fazit
  const getan = zeilenListe(roh?.getan, tl.felder.getan)
  if (getan.fehler) return getan
  const offen = zeilenListe(roh?.offen, tl.felder.offen)
  if (offen.fehler) return offen
  const anmerkung = freierText(roh?.anmerkung, ANMERKUNG_MAX, tl.felder.anmerkung, false)
  if (anmerkung.fehler) return anmerkung
  return {
    rahmen: {
      fazit: fazit.text,
      getan: getan.zeilen,
      offen: offen.zeilen,
      anmerkung: anmerkung.text
    }
  }
}

function arbeitspaketPruefen(roh) {
  const tl = texte.lieferschein
  const ziel = pflichtText(roh?.ziel, ZEILE_MAX, tl.felder.ziel)
  if (ziel.fehler) return ziel
  const kriterien = zeilenListe(roh?.fertigKriterien, tl.felder.fertigKriterien)
  if (kriterien.fehler) return kriterien
  // Kanten-Prüfung im Kleinen: Ein Arbeitspaket ohne Fertig-Kriterien ist keins
  // — der Prüfer hätte keinen Maßstab und der Bauer kein Ziel.
  if (kriterien.zeilen.length === 0) return { fehler: tl.arbeitspaketOhneKriterien }
  const schritte = zeilenListe(roh?.schritte, tl.felder.schritte)
  if (schritte.fehler) return schritte
  const fundstellen = zeilenListe(roh?.fundstellen, tl.felder.fundstellen)
  if (fundstellen.fehler) return fundstellen
  const nichtDabei = zeilenListe(roh?.nichtDabei, tl.felder.nichtDabei)
  if (nichtDabei.fehler) return nichtDabei
  return {
    teil: {
      ziel: ziel.text,
      fertigKriterien: kriterien.zeilen,
      schritte: schritte.zeilen,
      fundstellen: fundstellen.zeilen,
      nichtDabei: nichtDabei.zeilen
    }
  }
}

function pruefbelegPruefen(roh) {
  const tl = texte.lieferschein
  const urteil = String(roh?.urteil ?? '').trim().toLowerCase()
  if (!URTEILE.includes(urteil)) return { fehler: tl.urteilFehlt(URTEILE) }
  const beanstandungen = []
  for (const eintrag of Array.isArray(roh?.beanstandungen) ? roh.beanstandungen : []) {
    const text = einzeilig(eintrag?.text)
    if (!text) continue
    if (text.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.beanstandungen, BEANSTANDUNG_MAX, text.length) }
    const einstufung = String(eintrag?.einstufung ?? '').trim().toLowerCase()
    if (!EINSTUFUNGEN.includes(einstufung)) return { fehler: tl.einstufungFehlt(EINSTUFUNGEN) }
    const fundort = einzeilig(eintrag?.fundort)
    if (fundort.length > FUNDORT_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.fundort, FUNDORT_MAX, fundort.length) }
    beanstandungen.push({ einstufung, text, fundort })
  }
  if (beanstandungen.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.beanstandungen, LISTE_MAX, beanstandungen.length) }
  // Plausibilität (Ebene 2): Ein Fehlurteil ohne eine einzige Beanstandung ist
  // für den Bauer wertlos; ein bestandenes Urteil mit offenen Beanstandungen
  // führt zu nichts — beides wird sofort abgewiesen statt still übernommen.
  if (urteil === 'fehlgeschlagen' && beanstandungen.length === 0)
    return { fehler: tl.urteilOhneBeanstandung }
  if (urteil === 'bestanden' && beanstandungen.length > 0)
    return { fehler: tl.bestandenMitBeanstandung }
  const rotVorGruen = freierText(roh?.rotVorGruen, BELEG_MAX, tl.felder.rotVorGruen, false)
  if (rotVorGruen.fehler) return rotVorGruen
  const geprueft = zeilenListe(roh?.geprueft, tl.felder.geprueft)
  if (geprueft.fehler) return geprueft
  // Prüfkarte: dieselben harten Längengrenzen wie für jede andere Karte —
  // FlowForge legt sie nach bestandener Prüfung selbst an (BAUPLAN 18).
  let pruefkarte = null
  const kartenTitel = einzeilig(roh?.pruefkarteTitel)
  const kartenText = einzeilig(roh?.pruefkarteText)
  if (kartenTitel || kartenText) {
    if (!kartenTitel || !kartenText) return { fehler: tl.pruefkarteUnvollstaendig }
    if (kartenTitel.length > TITEL_MAX)
      return { fehler: tl.feldZuLang(tl.felder.pruefkarteTitel, TITEL_MAX, kartenTitel.length) }
    if (kartenText.length > TEXT_MAX)
      return { fehler: tl.feldZuLang(tl.felder.pruefkarteText, TEXT_MAX, kartenText.length) }
    pruefkarte = { titel: kartenTitel, text: kartenText }
  }
  return {
    teil: {
      urteil,
      beanstandungen,
      rotVorGruen: rotVorGruen.text,
      geprueft: geprueft.zeilen,
      pruefkarte
    }
  }
}

function umsetzungsberichtPruefen(roh) {
  const tl = texte.lieferschein
  const kriterien = []
  for (const eintrag of Array.isArray(roh?.kriterien) ? roh.kriterien : []) {
    const kriterium = einzeilig(eintrag?.kriterium)
    const wieUmgesetzt = einzeilig(eintrag?.wieUmgesetzt)
    if (!kriterium && !wieUmgesetzt) continue
    if (!kriterium || !wieUmgesetzt) return { fehler: tl.kriteriumUnvollstaendig }
    if (kriterium.length > ZEILE_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.kriterien, ZEILE_MAX, kriterium.length) }
    if (wieUmgesetzt.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.kriterien, BEANSTANDUNG_MAX, wieUmgesetzt.length) }
    kriterien.push({ kriterium, wieUmgesetzt })
  }
  if (kriterien.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.kriterien, LISTE_MAX, kriterien.length) }
  const dateien = []
  for (const eintrag of Array.isArray(roh?.dateien) ? roh.dateien : []) {
    const pfad = einzeilig(eintrag?.pfad)
    if (!pfad) continue
    if (pfad.length > FUNDORT_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.dateien, FUNDORT_MAX, pfad.length) }
    const art = String(eintrag?.art ?? '').trim().toLowerCase()
    if (!DATEI_ARTEN.includes(art)) return { fehler: tl.dateiArtFehlt(DATEI_ARTEN) }
    dateien.push({ pfad, art })
  }
  if (dateien.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.dateien, LISTE_MAX, dateien.length) }
  const angriffsliste = []
  for (const eintrag of Array.isArray(roh?.angriffsliste) ? roh.angriffsliste : []) {
    const fund = einzeilig(eintrag?.fund)
    const umgang = einzeilig(eintrag?.umgang)
    if (!fund && !umgang) continue
    if (!fund || !umgang) return { fehler: tl.fundUnvollstaendig }
    if (fund.length > ZEILE_MAX || umgang.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.angriffsliste, BEANSTANDUNG_MAX, Math.max(fund.length, umgang.length)) }
    angriffsliste.push({ fund, umgang })
  }
  if (angriffsliste.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.angriffsliste, LISTE_MAX, angriffsliste.length) }
  return { teil: { kriterien, dateien, angriffsliste } }
}

function fundePruefen(roh) {
  const tl = texte.lieferschein
  const funde = []
  for (const eintrag of Array.isArray(roh?.funde) ? roh.funde : []) {
    const text = einzeilig(eintrag?.text)
    if (!text) continue
    if (text.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.funde, BEANSTANDUNG_MAX, text.length) }
    const schwere = String(eintrag?.schwere ?? '').trim().toLowerCase()
    if (!SCHWEREN.includes(schwere)) return { fehler: tl.schwereFehlt(SCHWEREN) }
    const fundort = einzeilig(eintrag?.fundort)
    if (fundort.length > FUNDORT_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.fundort, FUNDORT_MAX, fundort.length) }
    funde.push({ schwere, text, fundort })
  }
  if (funde.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.funde, LISTE_MAX, funde.length) }
  // Eine leere Fundliste ist ein gutes Ergebnis, kein Fehler — der Auftrag
  // verlangt ausdrücklich Ehrlichkeit statt erfundener Funde.
  return { teil: { funde } }
}

function rahmenTeilPruefen(roh) {
  const tl = texte.lieferschein
  const inhalt = freierText(roh?.inhalt, INHALT_MAX, tl.felder.inhalt, false)
  if (inhalt.fehler) return inhalt
  return { teil: { inhalt: inhalt.text } }
}

const TEIL_PRUEFER = {
  rahmen: rahmenTeilPruefen,
  arbeitspaket: arbeitspaketPruefen,
  pruefbeleg: pruefbelegPruefen,
  umsetzungsbericht: umsetzungsberichtPruefen,
  funde: fundePruefen
}

// Die eine Stelle, an der eine Meldung geprüft wird — für Werkzeug und
// Prüfskripte gleichermaßen. Liefert { fehler } oder { meldung }.
export function meldungPruefen(art, roh, etikett = null) {
  const pruefer = TEIL_PRUEFER[art]
  if (!pruefer) return { fehler: texte.lieferschein.unbekannteArt(String(art)) }
  const rahmen = rahmenPruefen(roh)
  if (rahmen.fehler) return rahmen
  const teil = pruefer(roh)
  if (teil.fehler) return teil
  return { meldung: { art, etikett: etikett ?? null, ...rahmen.rahmen, ...teil.teil } }
}

// --- Ebene 3: Kanten-Prüfung -------------------------------------------------

// Deckt die Lieferung dieses Blocks, was er laut Schaubild liefert? Ein Block
// mit zwei Etiketten, der nur eines meldet, fällt hier auf.
export function fehlendeLieferungen(def, meldungen) {
  const gemeldet = new Set((meldungen ?? []).map((m) => m?.etikett).filter(Boolean))
  return (def?.liefert ?? []).filter((etikett) => !gemeldet.has(etikett))
}

// Hat dieser Block vollständig gemeldet? Blöcke ohne liefert-Etikett brauchen
// mindestens den Rahmen — sonst wüsste weder Ticker noch Bericht, was war.
export function meldungVollstaendig(def, meldungen) {
  if (!Array.isArray(meldungen) || meldungen.length === 0) return false
  return fehlendeLieferungen(def, meldungen).length === 0
}

// --- Lesbare Fassung ---------------------------------------------------------

function abschnitt(label, zeilen) {
  if (!zeilen?.length) return ''
  return `${label}:\n` + zeilen.map((z) => '- ' + z).join('\n') + '\n'
}

// Eine Beanstandung in einer Zeile — dieselbe Fassung im Auftrag des Bauers,
// im Ticker-Umfeld und im Laufbericht.
export function beanstandungZeile(b) {
  const tl = texte.lieferschein
  const kopf = tl.einstufungen[b?.einstufung] ?? b?.einstufung ?? ''
  const ort = b?.fundort ? ` (${b.fundort})` : ''
  return `[${kopf}]${ort} ${b?.text ?? ''}`.trim()
}

export function fundZeile(f) {
  const tl = texte.lieferschein
  const kopf = tl.schweren[f?.schwere] ?? f?.schwere ?? ''
  const ort = f?.fundort ? ` (${f.fundort})` : ''
  return `[${kopf}]${ort} ${f?.text ?? ''}`.trim()
}

// Der Lieferschein als lesbarer Text: geht als Übergabe an die Nachfolger und
// steht so im Laufbericht. Gegliedert — nicht mehr als Fließtext, aus dem
// FlowForge sich etwas heraussucht.
export function lieferscheinText(meldung) {
  const tl = texte.lieferschein
  if (!meldung) return ''
  let text = `${tl.labels.fazit}: ${meldung.fazit}\n`
  if (meldung.art === 'arbeitspaket') {
    text += `${tl.labels.ziel}: ${meldung.ziel}\n`
    text += abschnitt(tl.labels.fertigKriterien, meldung.fertigKriterien)
    text += abschnitt(tl.labels.schritte, meldung.schritte)
    text += abschnitt(tl.labels.fundstellen, meldung.fundstellen)
    text += abschnitt(tl.labels.nichtDabei, meldung.nichtDabei)
  } else if (meldung.art === 'pruefbeleg') {
    text += `${tl.labels.urteil}: ${tl.urteile[meldung.urteil] ?? meldung.urteil}\n`
    text += abschnitt(tl.labels.geprueft, meldung.geprueft)
    text += abschnitt(tl.labels.beanstandungen, meldung.beanstandungen.map(beanstandungZeile))
    if (meldung.rotVorGruen) text += `${tl.labels.rotVorGruen}:\n${meldung.rotVorGruen}\n`
  } else if (meldung.art === 'umsetzungsbericht') {
    text += abschnitt(
      tl.labels.kriterien,
      meldung.kriterien.map((k) => `${k.kriterium} → ${k.wieUmgesetzt}`)
    )
    text += abschnitt(
      tl.labels.dateien,
      meldung.dateien.map((d) => `${d.pfad} (${tl.dateiArten[d.art] ?? d.art})`)
    )
    text += abschnitt(
      tl.labels.angriffsliste,
      meldung.angriffsliste.map((a) => `${a.fund} → ${a.umgang}`)
    )
  } else if (meldung.art === 'funde') {
    text += meldung.funde.length
      ? abschnitt(tl.labels.funde, meldung.funde.map(fundZeile))
      : tl.keineFunde + '\n'
  } else if (meldung.inhalt) {
    text += meldung.inhalt + '\n'
  }
  text += abschnitt(tl.labels.getan, meldung.getan)
  text += abschnitt(tl.labels.offen, meldung.offen)
  if (meldung.anmerkung) text += `${tl.labels.anmerkung}:\n${meldung.anmerkung}\n`
  return text.trim()
}

// --- Was FlowForge aus einer Meldung liest -----------------------------------

// Prüfer-Urteil (früher die Marker-Zeile „PRUEFUNG: BESTANDEN"):
// true = bestanden, false = nicht bestanden, null = kein Prüfbeleg gemeldet.
export function urteilAusMeldungen(meldungen) {
  const beleg = pruefbelegAusMeldungen(meldungen)
  if (!beleg) return null
  return beleg.urteil === 'bestanden'
}

export function pruefbelegAusMeldungen(meldungen) {
  const treffer = (meldungen ?? []).filter((m) => m?.art === 'pruefbeleg')
  return treffer.length ? treffer[treffer.length - 1] : null
}

export function beanstandungenAusMeldungen(meldungen) {
  return pruefbelegAusMeldungen(meldungen)?.beanstandungen ?? []
}

// Opus sortiert vor (BAUPLAN 20): Nur wenn ALLE Beanstandungen mechanisch sind,
// lohnt die lokale Wette — sonst muss der Motor-Bauer ohnehin ran. Ohne
// Beanstandungen wird sicher eskaliert.
export function beanstandungenEinstufen(beanstandungen) {
  const liste = Array.isArray(beanstandungen) ? beanstandungen : []
  if (liste.length === 0) return 'unmarkiert'
  return liste.every((b) => b?.einstufung === 'mechanisch') ? 'mechanisch' : 'grundsaetzlich'
}

// Grün-Fall des Tors (BAUPLAN 35): Der Prüfbefehl lief durch — mechanische, von
// Tests gedeckte Beanstandungen gelten damit als erledigt. Übrig bleiben die
// grundsätzlichen; ist keine dabei, prüft der Prüfer nur noch formal nach.
export function grundsaetzlicheBeanstandungen(beanstandungen) {
  return (Array.isArray(beanstandungen) ? beanstandungen : []).filter(
    (b) => b?.einstufung === 'grundsaetzlich'
  )
}

// Prüfkarte (BAUPLAN 18): aus dem Feld statt aus zwei Marker-Zeilen.
export function pruefkarteAusMeldungen(meldungen) {
  return pruefbelegAusMeldungen(meldungen)?.pruefkarte ?? null
}
