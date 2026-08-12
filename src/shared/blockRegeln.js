// Harte Regeln für eigene Blöcke (SPEC §4.5, BAUPLAN 14) — dieselbe Idee wie
// kartenRegeln.js: Die Oberfläche zeigt Zeichenzähler, durchgesetzt wird im
// Hauptprozess. Ein eigener Block folgt der Block-Anatomie (SPEC §4.2):
// Name · Symbol · Arbeitsauftrag · braucht/liefert · Sperre „darf nur lesen".
import { texte } from './texte.js'

export const BLOCK_NAME_MAX = 40
export const BLOCK_SYMBOL_MAX = 8
export const BLOCK_BESCHREIBUNG_MAX = 200
export const BLOCK_AUFTRAG_MAX = 4000
export const ETIKETT_MAX = 40
export const ETIKETTEN_MAX = 5
export const BLOCK_SYMBOL_STANDARD = '🧱'

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
  const liefert = pruefeEtiketten(roh?.liefert, texte.kette.liefertLabel)
  if (liefert.fehler) return { fehler: liefert.fehler }
  return {
    block: {
      name,
      symbol,
      beschreibung,
      auftrag,
      braucht: braucht.etiketten,
      liefert: liefert.etiketten,
      nurLesen: Boolean(roh?.nurLesen),
      // Fest verdrahtet: kein Prüfer, keine Übung, keine Formularfelder —
      // viele Stellen (Leinwand, Regeln, Lauf) verlassen sich darauf.
      prueft: false,
      uebung: false,
      eigen: true,
      felder: []
    }
  }
}
