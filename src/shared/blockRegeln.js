// Harte Regeln für eigene Blöcke (SPEC §4.5, BAUPLAN 14) — dieselbe Idee wie
// kartenRegeln.js: Die Oberfläche zeigt Zeichenzähler, durchgesetzt wird im
// Hauptprozess. Ein eigener Block folgt der Block-Anatomie (SPEC §4.2):
// Name · Symbol · Arbeitsauftrag · braucht/liefert · Sperre „darf nur lesen" ·
// Kennzeichen „führt zusammen" (BAUPLAN 47).
//
// Seit BAUPLAN 48 („Kein Kennzeichen ohne Editor-Feld") darf ein eigener Block
// ALLE Kennzeichen des Katalogs tragen, dazu ein zweites Etiketten-Feld
// brauchtOptional und bis zu drei Formularfelder. Statt zwölf freier Häkchen
// gilt eine Verträglichkeitsprüfung (pruefeVertraeglichkeit): Manche
// Kombinationen sind strukturell unerfüllbar — ein Prüfer, der nichts schreiben
// darf, kann keine Tests anlegen; eine Startanleitungs-Pflicht bei „nur lesen"
// wäre nie erfüllbar. Die Regeln stehen hier als reine Funktionen, damit sie
// einzeln prüfbar bleiben und Editor wie Assistent dieselben Sätze zeigen.
import { texte } from './texte.js'
import {
  BEREICHE,
  BEREICH_EIGENE,
  MODELL_KLASSE_STANDARD,
  PRUEFBELEG_ETIKETT,
  modellKlasseGueltig
} from './blockKatalog.js'
import { ARBEITSPAKET_ETIKETT } from './kettenRegeln.js'

export const BLOCK_NAME_MAX = 40
export const BLOCK_SYMBOL_MAX = 8
export const BLOCK_BESCHREIBUNG_MAX = 200
export const BLOCK_AUFTRAG_MAX = 4000
export const ETIKETT_MAX = 40
export const ETIKETTEN_MAX = 5
export const BLOCK_SYMBOL_STANDARD = '🧱'
// Bereich (Bibliotheks-Klappe, BAUPLAN 30): Katalog-Schlüssel, „eigene" oder
// ein frei eingetippter Name — die Länge gilt für den freien Namen.
export const BEREICH_MAX = 30
// Empfänger im Auftrag (BAUPLAN 43, „Kein Kennzeichen ohne Editor-Feld"):
// je braucht-Etikett ein Satz aus der Sicht dieses Blocks. Er steht später im
// Auftrag des LIEFERNDEN Blocks hinter „Er …" — deshalb ein Satz, nicht mehr.
export const BRAUCHT_WOZU_MAX = 200

// Formularfelder eigener Blöcke (BAUPLAN 48): Felder an der Blockkarte, deren
// Inhalt per {{id}} in den Auftrag gesetzt wird (kettenRegeln.auftragMitFeldern).
// Drei genügen — der Katalog braucht je Block höchstens zwei.
export const FORMULARFELDER_MAX = 3
export const FELD_LABEL_MAX = 60
export const FELD_PLATZHALTER_MAX = 120
export const FELD_ID_MAX = 30

// Der Name des Prüfbeleg-Etiketts (BAUPLAN 42): Darüber kommt das Urteil eines
// Prüfers bei FlowForge an — Reparatur-Runde, Tor und Prüfkarte hängen daran.
// Die eine Quelle ist blockKatalog.js (FESTE_ETIKETTEN); hier nur durchgereicht,
// weil der Block-Editor ihn zusammen mit den Kennzeichen-Regeln importiert.
// „Arbeitspaket" kommt schon aus kettenRegeln.
export { PRUEFBELEG_ETIKETT }

// Die Kennzeichen, die ein eigener Block tragen darf (BAUPLAN 48) — Reihenfolge
// = Anzeige im Editor. Gruppe „rolle" steht sichtbar in Schritt 3, Gruppe
// „feinheiten" zugeklappt darunter. Name und Folgen-Hinweis je Kennzeichen
// stehen EINMAL in texte.blockEditor.kennzeichen — Editor und KI-Assistent
// lesen beide dort. Nicht dabei: `uebung` (kein Können, sondern „Demo-Block",
// bleibt fest false) und `darfKartenAnlegen` — das ist kein eigenes Häkchen,
// sondern folgt aus `erzeugtAufgaben`: Ein Block, der Aufgaben-Karten anlegen
// soll, braucht das Werkzeug auch bei „nur lesen" (so arbeitet das Audit).
export const KENNZEICHEN = [
  { schluessel: 'nurLesen', gruppe: 'rolle' },
  { schluessel: 'prueft', gruppe: 'rolle' },
  { schluessel: 'fuehrtZusammen', gruppe: 'rolle' },
  { schluessel: 'pruefbefehlPflicht', gruppe: 'feinheiten' },
  { schluessel: 'startanleitungPflicht', gruppe: 'feinheiten' },
  { schluessel: 'kartenZuteilung', gruppe: 'feinheiten' },
  { schluessel: 'erzeugtAufgaben', gruppe: 'feinheiten' },
  { schluessel: 'kartenVorschlaege', gruppe: 'feinheiten' },
  { schluessel: 'laufVorschlag', gruppe: 'feinheiten' },
  { schluessel: 'unteraufgabenWieBlock', gruppe: 'feinheiten' },
  { schluessel: 'audit', gruppe: 'feinheiten' }
]
export const KENNZEICHEN_ROLLE = KENNZEICHEN.filter((k) => k.gruppe === 'rolle').map(
  (k) => k.schluessel
)
export const KENNZEICHEN_FEINHEITEN = KENNZEICHEN.filter((k) => k.gruppe === 'feinheiten').map(
  (k) => k.schluessel
)

// Bereich normalisieren: trimmen, Mehrfach-Leerzeichen zusammenziehen;
// leer/fehlend → BEREICH_EIGENE. Tippt der Nutzer den Anzeigenamen einer
// festen Klappe („Prüfen", „Eigene"), wird daraus der Schlüssel — sonst gäbe
// es zwei Klappen mit demselben Namen. Liefert { fehler } oder { bereich }.
export function pruefeBereich(roh) {
  const bereich = String(roh ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!bereich) return { bereich: BEREICH_EIGENE }
  if (bereich.length > BEREICH_MAX)
    return { fehler: texte.blockRegeln.bereichZuLang(BEREICH_MAX) }
  const klein = bereich.toLowerCase()
  for (const schluessel of [...BEREICHE, BEREICH_EIGENE]) {
    const name = texte.projektansicht.bereiche[schluessel] ?? schluessel
    if (klein === schluessel || klein === name.toLowerCase()) return { bereich: schluessel }
  }
  return { bereich }
}

// Eine braucht/liefert-Liste säubern: Strings, getrimmt, ohne Doppelte.
// Liefert { fehler } oder { etiketten }.
function pruefeEtiketten(roh, label) {
  const etiketten = []
  for (const eintrag of Array.isArray(roh) ? roh : []) {
    const wert = String(eintrag ?? '').trim()
    if (!wert || etiketten.includes(wert)) continue
    if (wert.length > ETIKETT_MAX)
      return { fehler: texte.blockRegeln.etikettZuLang(label, ETIKETT_MAX) }
    etiketten.push(wert)
  }
  if (etiketten.length > ETIKETTEN_MAX)
    return { fehler: texte.blockRegeln.zuVieleEtiketten(label, ETIKETTEN_MAX) }
  return { etiketten }
}

// Das „wozu" je braucht-Etikett (BAUPLAN 43): Nur Sätze zu Etiketten, die der
// Block wirklich braucht (Pflicht ODER optional, BAUPLAN 48) — sonst wüchsen
// beim Umbenennen eines Etiketts stille Karteileichen mit. Leere Angaben fallen
// raus; dort greift im Vorspann der ehrliche Rückfall-Satz. Der Schlusspunkt
// wird abgeschnitten, weil FlowForge ihn selbst setzt („Er misst …."). Liefert
// { fehler } oder { brauchtWozu }.
function pruefeBrauchtWozu(roh, etiketten) {
  const brauchtWozu = {}
  for (const etikett of etiketten) {
    const satz = String(roh?.[etikett] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.+$/, '')
      .trim()
    if (!satz) continue
    if (satz.length > BRAUCHT_WOZU_MAX)
      return { fehler: texte.blockRegeln.brauchtWozuZuLang(etikett, BRAUCHT_WOZU_MAX) }
    brauchtWozu[etikett] = satz
  }
  return { brauchtWozu }
}

// Feld-Kennung aus dem Label (BAUPLAN 48): klein, Umlaute ausgeschrieben, nur
// a-z 0-9 _, höchstens FELD_ID_MAX, keine führenden Ziffern oder Unterstriche.
// „Deine Idee in einem Satz" → „deine_idee_in_einem_satz". Leer, wenn nichts
// Brauchbares übrig bleibt — der Aufrufer macht daraus einen Klartext-Fehler.
// Die Kennung steht als {{id}} im Auftrag und als Schlüssel der Feldwerte im
// Schaubild (workflow.js) — deshalb schlicht und ohne Sonderzeichen.
export function feldIdBereinigen(roh) {
  return String(roh ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[0-9_]+/, '')
    .slice(0, FELD_ID_MAX)
    .replace(/_+$/, '')
}

// Alle {{…}}-Platzhalter eines Auftrags, wie sie dastehen (ohne Klammern).
export function platzhalterImAuftrag(auftrag) {
  const namen = []
  for (const treffer of String(auftrag ?? '').matchAll(/\{\{([^{}]*)\}\}/g)) {
    const name = treffer[1]
    if (!namen.includes(name)) namen.push(name)
  }
  return namen
}

// Platzhalter im Auftrag, zu denen kein Feld gehört (BAUPLAN 48, Korrektur K6):
// Sie blieben im Auftrag roh stehen („{{kunde}}"). Bewusst KEIN Fehler des
// Hauptprozesses — der würde beim App-Start stillen Altbestand verwerfen —,
// sondern nur ein Hinweis im Editor unter dem Auftrag.
export function fremdePlatzhalter(auftrag, felder) {
  const ids = new Set((Array.isArray(felder) ? felder : []).map((f) => f?.id))
  return platzhalterImAuftrag(auftrag).filter((name) => !ids.has(name))
}

// Formularfelder prüfen und normalisieren (BAUPLAN 48). Die Kennung ist
// EINGEFROREN, sobald das Feld gespeichert ist (Korrektur K5): Eine
// mitgelieferte id wird bereinigt übernommen, nur ohne id wird sie aus dem
// Label abgeleitet. Sonst würde ein späteres Umbenennen des Labels die im
// Schaubild eingetippten Werte stumm verwerfen (workflow.js liest die Feldwerte
// über die id). Liefert { fehler } oder { felder }.
function pruefeFelder(roh) {
  const felder = []
  const liste = Array.isArray(roh) ? roh : []
  if (liste.length > FORMULARFELDER_MAX)
    return { fehler: texte.blockRegeln.zuVieleFelder(FORMULARFELDER_MAX) }
  for (const eintrag of liste) {
    const label = String(eintrag?.label ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!label) return { fehler: texte.blockRegeln.feldLabelFehlt }
    if (label.length > FELD_LABEL_MAX)
      return { fehler: texte.blockRegeln.feldLabelZuLang(FELD_LABEL_MAX) }
    const platzhalter = String(eintrag?.platzhalter ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (platzhalter.length > FELD_PLATZHALTER_MAX)
      return { fehler: texte.blockRegeln.feldPlatzhalterZuLang(label, FELD_PLATZHALTER_MAX) }
    const mitgeliefert = String(eintrag?.id ?? '').trim()
    const id = feldIdBereinigen(mitgeliefert || label)
    if (!id) return { fehler: texte.blockRegeln.feldIdLeer(label) }
    if (felder.some((f) => f.id === id))
      return { fehler: texte.blockRegeln.feldIdDoppelt(id) }
    felder.push({ id, label, platzhalter, pflicht: Boolean(eintrag?.pflicht) })
  }
  return { felder }
}

// Verträglichkeit der Kennzeichen (BAUPLAN 48) — reine Funktion über einen
// schon normalisierten Block (Booleans, Listen, felder, auftrag). null = passt,
// sonst ein Klartext-Fehler aus texte.blockRegeln. Jede Regel nennt die Folge,
// nicht die Mechanik: Was ginge im Lauf kaputt, stünde die Kombination so da?
export function pruefeVertraeglichkeit(block) {
  const braucht = Array.isArray(block?.braucht) ? block.braucht : []
  const liefert = Array.isArray(block?.liefert) ? block.liefert : []
  // 1. Führt zusammen ohne Pflicht-Etikett (BAUPLAN 47): Es gäbe nichts, was
  //    mehrfach ankommen könnte, und die Steck-Prüfung hätte nichts zu zählen.
  if (block?.fuehrtZusammen && braucht.length === 0)
    return texte.blockRegeln.fuehrtZusammenOhneBraucht
  // 2. Prüfer bei „nur lesen": Ein Prüfer schreibt Tests in die Prüfmappe und
  //    führt sie aus — gesperrt liefe jede Prüfung ins Leere.
  if (block?.prueft && block?.nurLesen) return texte.blockRegeln.prueftNurLesen
  // 3. Prüfer ohne Prüfbeleg: Sein Urteil käme nie bei FlowForge an — keine
  //    Reparatur-Runde, kein Tor, keine Prüfkarte. Der Editor trägt das Etikett
  //    beim Anhaken selbst ein; die Regel bleibt als Gürtel.
  if (block?.prueft && !liefert.includes(PRUEFBELEG_ETIKETT))
    return texte.blockRegeln.prueftOhnePruefbeleg(PRUEFBELEG_ETIKETT)
  // 4. Prüfbefehl-Pflicht ohne Prüfer: Das Werkzeug ist nur für Prüfer frei —
  //    jedes Setzen löste eine Rechte-Rückfrage aus.
  if (block?.pruefbefehlPflicht && !block?.prueft)
    return texte.blockRegeln.pruefbefehlOhnePrueft
  // 5. Startanleitungs-Pflicht bei „nur lesen": Die Nachforderung wäre nie
  //    erfüllbar, der Lauf drehte sich im Kreis.
  if (block?.startanleitungPflicht && block?.nurLesen)
    return texte.blockRegeln.startanleitungNurLesen
  // 6. Karten zuteilen ohne Arbeitspaket: Zuteilen heißt Paket schneiden; das
  //    Paket IST das Arbeitspaket — sonst prüft FlowForge eine Vollständigkeit,
  //    die der Block nie melden kann.
  if (block?.kartenZuteilung && !liefert.includes(ARBEITSPAKET_ETIKETT))
    return texte.blockRegeln.kartenZuteilungOhneArbeitspaket(ARBEITSPAKET_ETIKETT)
  // 7. Jedes Formularfeld muss als {{id}} im Auftrag vorkommen — sonst tippt
  //    man es ein, und nichts passiert damit. (Die Gegenrichtung, ein fremdes
  //    {{x}} im Auftrag, ist nur ein Editor-Hinweis — Korrektur K6.)
  const auftrag = String(block?.auftrag ?? '')
  for (const feld of Array.isArray(block?.felder) ? block.felder : [])
    if (!auftrag.includes('{{' + feld.id + '}}'))
      return texte.blockRegeln.feldOhnePlatzhalter(feld.label, feld.id)
  return null
}

// Komfort-Angleichung (BAUPLAN 48): dieselben Folgen, die der Editor beim
// Anhaken zieht, als reine Funktion — für den KI-Vorschlag (säubern statt
// ablehnen) und den Editor. Nur Hinzufügen, nie Entfernen: prueft ⇒ nurLesen
// aus und „Prüfbeleg" in liefert; kartenZuteilung ⇒ „Arbeitspaket" in liefert;
// pruefbefehlPflicht ⇒ prueft; startanleitungPflicht ⇒ nurLesen aus.
// fuehrtZusammen ohne braucht bleibt absichtlich stehen — das lehnt die harte
// Regel mit Begründung ab, statt das Häkchen still zu kippen.
export function kennzeichenAngleichen(werte) {
  const neu = { ...werte }
  if (neu.pruefbefehlPflicht) neu.prueft = true
  if (neu.prueft || neu.startanleitungPflicht) neu.nurLesen = false
  const liefert = [...(Array.isArray(neu.liefert) ? neu.liefert : [])]
  if (neu.prueft && !liefert.includes(PRUEFBELEG_ETIKETT)) liefert.push(PRUEFBELEG_ETIKETT)
  if (neu.kartenZuteilung && !liefert.includes(ARBEITSPAKET_ETIKETT))
    liefert.push(ARBEITSPAKET_ETIKETT)
  neu.liefert = liefert
  return neu
}

// Prüft und normalisiert einen eigenen Block — liefert { fehler } oder
// { block } (ohne id; die vergibt der Hauptprozess). Alle Felder, über die
// Leinwand, Regeln und Lauf iterieren, sind danach garantiert gesetzt.
export function pruefeEigenenBlock(roh) {
  const name = String(roh?.name ?? '').trim()
  if (!name) return { fehler: texte.blockRegeln.nameFehlt }
  if (name.length > BLOCK_NAME_MAX)
    return { fehler: texte.blockRegeln.nameZuLang(BLOCK_NAME_MAX) }
  const symbol = String(roh?.symbol ?? '').trim() || BLOCK_SYMBOL_STANDARD
  if (symbol.length > BLOCK_SYMBOL_MAX)
    return { fehler: texte.blockRegeln.symbolZuLang }
  const beschreibung = String(roh?.beschreibung ?? '').trim()
  if (beschreibung.length > BLOCK_BESCHREIBUNG_MAX)
    return { fehler: texte.blockRegeln.beschreibungZuLang(BLOCK_BESCHREIBUNG_MAX) }
  const auftrag = String(roh?.auftrag ?? '').trim()
  if (!auftrag) return { fehler: texte.blockRegeln.auftragFehlt }
  if (auftrag.length > BLOCK_AUFTRAG_MAX)
    return { fehler: texte.blockRegeln.auftragZuLang(BLOCK_AUFTRAG_MAX) }
  const braucht = pruefeEtiketten(roh?.braucht, texte.kette.brauchtLabel)
  if (braucht.fehler) return { fehler: braucht.fehler }
  // brauchtOptional (BAUPLAN 48): Übergaben, die der Block nutzt, wenn ein
  // Block davor sie liefert — die Steck-Regel prüft nur braucht. Ein Etikett
  // kann nicht zugleich Pflicht und „falls da" sein.
  const brauchtOptional = pruefeEtiketten(
    roh?.brauchtOptional,
    texte.blockEditor.brauchtOptionalLabel
  )
  if (brauchtOptional.fehler) return { fehler: brauchtOptional.fehler }
  for (const etikett of brauchtOptional.etiketten)
    if (braucht.etiketten.includes(etikett))
      return { fehler: texte.blockRegeln.brauchtOptionalDoppelt(etikett) }
  const liefert = pruefeEtiketten(roh?.liefert, texte.kette.liefertLabel)
  if (liefert.fehler) return { fehler: liefert.fehler }
  // Bereich (BAUPLAN 30): Altbestand ohne Feld landet unter „Eigene".
  const bereich = pruefeBereich(roh?.bereich)
  if (bereich.fehler) return { fehler: bereich.fehler }
  // Empfänger im Auftrag (BAUPLAN 43): das „wozu" je braucht-Etikett — seit
  // BAUPLAN 48 auch für die optionalen.
  const wozu = pruefeBrauchtWozu(roh?.brauchtWozu, [
    ...braucht.etiketten,
    ...brauchtOptional.etiketten
  ])
  if (wozu.fehler) return { fehler: wozu.fehler }
  // Formularfelder (BAUPLAN 48).
  const felder = pruefeFelder(roh?.felder)
  if (felder.fehler) return { fehler: felder.fehler }
  // Kennzeichen (BAUPLAN 48): alle als Boolean — Altbestand ohne Feld ist
  // false, und der Block bekommt dann genau das Verhalten von vorher.
  const kennzeichen = {}
  for (const { schluessel } of KENNZEICHEN) kennzeichen[schluessel] = Boolean(roh?.[schluessel])
  const block = {
    name,
    symbol,
    beschreibung,
    auftrag,
    braucht: braucht.etiketten,
    brauchtOptional: brauchtOptional.etiketten,
    brauchtWozu: wozu.brauchtWozu,
    liefert: liefert.etiketten,
    bereich: bereich.bereich,
    // Modellklasse (BAUPLAN 37): Voreinstellung des eigenen Blocks — die
    // Blockkarte im Schaubild darf sie überschreiben. Unbekanntes oder
    // fehlendes Feld (Altbestand) fällt auf Standard zurück, nie auf ein
    // stilles Billigmodell.
    modell: modellKlasseGueltig(roh?.modell) ?? MODELL_KLASSE_STANDARD,
    ...kennzeichen,
    // Kein eigenes Häkchen (siehe KENNZEICHEN): Wer Aufgaben-Karten anlegen
    // soll, braucht das Werkzeug — auch bei „nur lesen" (Muster Audit).
    darfKartenAnlegen: kennzeichen.erzeugtAufgaben,
    // Fest verdrahtet: Übungs-Blöcke sind Demo-Blöcke des Katalogs, kein Können.
    uebung: false,
    eigen: true,
    felder: felder.felder
  }
  // Verträglichkeit zuletzt — über den fertig normalisierten Block, damit die
  // Regeln dieselben Werte sehen, die gespeichert würden.
  const unvertraeglich = pruefeVertraeglichkeit(block)
  if (unvertraeglich) return { fehler: unvertraeglich }
  return { block }
}
