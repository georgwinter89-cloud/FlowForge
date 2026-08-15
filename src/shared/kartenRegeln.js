// Harte Regeln für Karten — gelten für Mensch und Agent gleichermaßen.
// Geprüft wird im Hauptprozess; die Oberfläche zeigt die Grenzen nur zusätzlich an.
import { texte } from './texte.js'

export const TITEL_MAX = 80
export const TEXT_MAX = 400
// Themen (BAUPLAN 30): ein freies Schlagwort je Karte als zweite Ordnungsebene
// unter den festen Gruppen — Pflicht beim Anlegen von Aufgaben-, Entscheidungs-
// und Wissens-Karten (Status- und Prüfkarten tragen keins).
export const THEMA_MAX = 30
// 'pruefung' (BAUPLAN 18) legt ausschließlich FlowForge selbst an — nach
// jeder bestandenen Prüfung; Mensch-Formular und Agenten-Werkzeuge nicht.
export const SORTEN = ['aufgabe', 'entscheidung', 'wissen', 'status', 'pruefung']
// Sorten, die ein Thema tragen.
export const THEMEN_SORTEN = ['aufgabe', 'entscheidung', 'wissen']

// Liefert null, wenn alles passt — sonst eine Fehlermeldung in Alltagssprache.
export function pruefeKarteneingabe({ titel, text }) {
  const t = (titel ?? '').trim()
  const x = (text ?? '').trim()
  if (!t) return texte.kartenRegeln.titelFehlt
  if (t.length > TITEL_MAX) return texte.kartenRegeln.titelZuLang(TITEL_MAX, t.length)
  if (!x) return texte.kartenRegeln.textFehlt
  if (x.length > TEXT_MAX) return texte.kartenRegeln.textZuLang(TEXT_MAX, x.length)
  return null
}

// Schreibweise eines Themas säubern: Rand-Leerzeichen weg, Mehrfach-Leerzeichen
// zusammenziehen. Groß-/Kleinschreibung bleibt — die kanonische Schreibweise
// bestimmt kanonischesThema() aus dem Bestand.
export function themaNormalisieren(thema) {
  return String(thema ?? '').replace(/\s+/g, ' ').trim()
}

// Vergleichsschlüssel: „Login", „login" und „LOGIN " sind dasselbe Thema.
export function themaSchluessel(thema) {
  return themaNormalisieren(thema).toLocaleLowerCase('de')
}

// Vorhandene Themen eines Projekts in kanonischer Schreibweise — die Schreibweise
// der zuerst angelegten Karte gewinnt (Reihenfolge = Anlege-Reihenfolge).
export function vorhandeneThemen(karten) {
  const gesehen = new Map()
  for (const karte of Array.isArray(karten) ? karten : []) {
    if (typeof karte?.thema !== 'string') continue
    const schluessel = themaSchluessel(karte.thema)
    if (!schluessel || gesehen.has(schluessel)) continue
    gesehen.set(schluessel, themaNormalisieren(karte.thema))
  }
  return [...gesehen.values()]
}

// Kanonische Schreibweise für ein eingegebenes Thema: Gibt es das Thema schon
// (bis auf Groß-/Kleinschreibung), gilt die vorhandene Schreibweise — sonst die
// normalisierte Eingabe. Leere Eingabe → ''.
export function kanonischesThema(karten, thema) {
  const eingabe = themaNormalisieren(thema)
  if (!eingabe) return ''
  const schluessel = themaSchluessel(eingabe)
  return vorhandeneThemen(karten).find((t) => themaSchluessel(t) === schluessel) ?? eingabe
}

// Prüft ein Thema fürs Anlegen/Ändern: liefert { fehler } oder { thema } (kanonisch).
// pflicht: beim Anlegen ist ein Thema Pflicht — beim Bearbeiten alter Karten
// ohne Thema bleibt es erlaubt, keins zu setzen (BAUPLAN 30).
export function pruefeThema(karten, thema, { pflicht }) {
  const eingabe = themaNormalisieren(thema)
  if (!eingabe) {
    if (pflicht) return { fehler: texte.kartenRegeln.themaFehlt(vorhandeneThemen(karten)) }
    return { thema: '' }
  }
  if (eingabe.length > THEMA_MAX)
    return { fehler: texte.kartenRegeln.themaZuLang(THEMA_MAX, eingabe.length) }
  return { thema: kanonischesThema(karten, eingabe) }
}
