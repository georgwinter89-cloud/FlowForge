// Harte Regeln für eigene Blöcke (SPEC §4.5, BAUPLAN 14) — dieselbe Idee wie
// kartenRegeln.js: Die Oberfläche zeigt Zeichenzähler, durchgesetzt wird im
// Hauptprozess. Ein eigener Block folgt der Block-Anatomie (SPEC §4.2):
// Name · Symbol · Arbeitsauftrag · braucht/liefert · Sperre „darf nur lesen" ·
// Kennzeichen „führt zusammen" (BAUPLAN 47).
import { texte } from './texte.js'
import {
  BEREICHE,
  BEREICH_EIGENE,
  MODELL_KLASSE_STANDARD,
  modellKlasseGueltig
} from './blockKatalog.js'

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
// Block wirklich braucht — sonst wüchsen beim Umbenennen eines Etiketts stille
// Karteileichen mit. Leere Angaben fallen raus; dort greift im Vorspann der
// ehrliche Rückfall-Satz. Der Schlusspunkt wird abgeschnitten, weil FlowForge
// ihn selbst setzt („Er misst …."). Liefert { fehler } oder { brauchtWozu }.
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
  // Führt zusammen (BAUPLAN 47, „Kein Kennzeichen ohne Editor-Feld"): Das
  // Häkchen ohne ein einziges Pflicht-Etikett liefe ins Leere — es gäbe nichts,
  // was mehrfach ankommen könnte, und die Steck-Prüfung hätte nichts zu zählen.
  const fuehrtZusammen = Boolean(roh?.fuehrtZusammen)
  if (fuehrtZusammen && braucht.etiketten.length === 0)
    return { fehler: texte.blockRegeln.fuehrtZusammenOhneBraucht }
  const liefert = pruefeEtiketten(roh?.liefert, texte.kette.liefertLabel)
  if (liefert.fehler) return { fehler: liefert.fehler }
  // Bereich (BAUPLAN 30): Altbestand ohne Feld landet unter „Eigene".
  const bereich = pruefeBereich(roh?.bereich)
  if (bereich.fehler) return { fehler: bereich.fehler }
  // Empfänger im Auftrag (BAUPLAN 43): das „wozu" je braucht-Etikett.
  const wozu = pruefeBrauchtWozu(roh?.brauchtWozu, braucht.etiketten)
  if (wozu.fehler) return { fehler: wozu.fehler }
  return {
    block: {
      name,
      symbol,
      beschreibung,
      auftrag,
      braucht: braucht.etiketten,
      brauchtWozu: wozu.brauchtWozu,
      liefert: liefert.etiketten,
      bereich: bereich.bereich,
      // Modellklasse (BAUPLAN 37): Voreinstellung des eigenen Blocks — die
      // Blockkarte im Schaubild darf sie überschreiben. Unbekanntes oder
      // fehlendes Feld (Altbestand) fällt auf Standard zurück, nie auf ein
      // stilles Billigmodell.
      modell: modellKlasseGueltig(roh?.modell) ?? MODELL_KLASSE_STANDARD,
      nurLesen: Boolean(roh?.nurLesen),
      // Führt zusammen (BAUPLAN 47): Altbestand ohne Feld ist false — der
      // Block bekommt dann wie bisher nur die nächstgelegene Lieferung.
      fuehrtZusammen,
      // Fest verdrahtet: kein Prüfer, keine Übung, keine Formularfelder —
      // viele Stellen (Leinwand, Regeln, Lauf) verlassen sich darauf.
      prueft: false,
      uebung: false,
      eigen: true,
      felder: []
    }
  }
}
