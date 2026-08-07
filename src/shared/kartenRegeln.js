// Harte Regeln für Karten — gelten für Mensch und (später) Agent gleichermaßen.
// Geprüft wird im Hauptprozess; die Oberfläche zeigt die Grenzen nur zusätzlich an.
import { texte } from './texte.js'

export const TITEL_MAX = 80
export const TEXT_MAX = 400
export const SORTEN = ['aufgabe', 'entscheidung', 'wissen', 'status']

// Liefert null, wenn alles passt — sonst eine Fehlermeldung in Alltagssprache.
export function pruefeKarteneingabe({ titel, text }) {
  const t = (titel ?? '').trim()
  const x = (text ?? '').trim()
  if (!t) return texte.kartenRegeln.titelFehlt
  if (t.length > TITEL_MAX) return texte.kartenRegeln.titelZuLang(TITEL_MAX)
  if (!x) return texte.kartenRegeln.textFehlt
  if (x.length > TEXT_MAX) return texte.kartenRegeln.textZuLang(TEXT_MAX)
  return null
}
