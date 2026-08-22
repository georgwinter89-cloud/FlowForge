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

// Kurz-Kennung (BAUPLAN 53): Karten-IDs sind UUIDs mit 36 Zeichen. Im
// Verzeichnis aller Karten wären das bei 69 Karten rund 2.500 Zeichen, die
// dem Agenten nichts erklären — er sieht deshalb nur die ersten 8 und darf
// sie überall dort einsetzen, wo bisher die volle id stand.
export const KENNUNG_LAENGE = 8
// Ehrliche Grenze: Zwei ids mit gleichen ersten 8 Zeichen sind möglich
// (rechnerisch selten, aber nicht ausgeschlossen). Dann rät FlowForge NICHT,
// sondern meldet „mehrdeutig" mit den vollen ids — der Agent nimmt eine davon.
// Unter 4 Zeichen wird gar nicht erst gesucht: „a" träfe beliebig viele Karten.
export const KENNUNG_MIN = 4

export function kurzKennung(id) {
  return String(id ?? '').slice(0, KENNUNG_LAENGE)
}

// Die Kennungen, die ein Agent ZU SEHEN bekommt (Verzeichnis, Volltext-Liste
// im Auftrag, Antwort von karten_lesen). Kollidieren zwei Karten in ihren
// ersten 8 Zeichen, bekommen GENAU DIESE beiden ihre volle id — sonst stünde
// dieselbe Kennung zweimal untereinander, der Agent nähme eine davon, und erst
// der Fehlversuch nennte ihm die vollen ids (gemessen Prüfer 1). Alle anderen
// Karten behalten die kurze Form; die Rechnung kostet nichts, weil sie ohnehin
// je Ausgabe einmal läuft. Liefert eine Map id → Anzeige-Kennung.
export function kennungenFuer(karten) {
  const alle = (Array.isArray(karten) ? karten : []).map((k) => String(k?.id ?? ''))
  const wieOft = new Map()
  for (const id of alle) {
    const kurz = kurzKennung(id).toLowerCase()
    wieOft.set(kurz, (wieOft.get(kurz) ?? 0) + 1)
  }
  return new Map(
    alle.map((id) => [id, wieOft.get(kurzKennung(id).toLowerCase()) > 1 ? id : kurzKennung(id)])
  )
}

// Reine Auflösung gegen eine ID-Liste — ohne Karten-Objekte, damit auch die
// Zuschnitt-Deckung (shared/lieferschein.js) sie benutzen kann, die nur die
// gemeldeten Aufgaben-IDs kennt. Liefert { id } oder { fehler } (bei
// Mehrdeutigkeit zusätzlich mehrdeutig: true).
// Reihenfolge: exakter Treffer zuerst, dann Präfix — sonst könnte eine volle
// id, die zufällig Präfix einer anderen ist, als „mehrdeutig" gelten.
export function idAusKennung(ids, eingabe) {
  const roh = String(eingabe ?? '').trim()
  const liste = (Array.isArray(ids) ? ids : []).map((id) => String(id ?? ''))
  const klein = roh.toLowerCase()
  if (!klein) return { fehler: texte.agentenKarten.unbekannteId(roh) }
  const genau = liste.find((id) => id.toLowerCase() === klein)
  if (genau) return { id: genau }
  if (klein.length < KENNUNG_MIN) return { fehler: texte.agentenKarten.unbekannteId(roh) }
  const anfang = liste.filter((id) => id.toLowerCase().startsWith(klein))
  if (anfang.length === 1) return { id: anfang[0] }
  if (anfang.length > 1)
    return {
      fehler: texte.agentenKarten.mehrdeutigeKennung(roh, anfang.join(', ')),
      mehrdeutig: true
    }
  return { fehler: texte.agentenKarten.unbekannteId(roh) }
}

// Dasselbe mit Karten-Objekten: liefert { karte } oder { fehler }.
export function kennungAufloesen(karten, eingabe) {
  const liste = Array.isArray(karten) ? karten : []
  const treffer = idAusKennung(
    liste.map((k) => k?.id),
    eingabe
  )
  if (treffer.fehler) return treffer
  return { karte: liste.find((k) => String(k?.id) === treffer.id) }
}

// Für die Leitplanken (BAUPLAN 53, §3): Sie nehmen ab jetzt Kurz-Kennungen an,
// haben für „gibt es nicht" aber ihre eigene, genauere Ablehnung („nicht in
// der Auswahl", „keine offene Aufgabe"). Deshalb drei Ausgänge:
// auflösbar → volle id · mehrdeutig → Fehler (Raten wäre hier schlimmer als
// Abweisen) · unbekannt → die Eingabe unverändert, die Leitplanke urteilt.
export function kennungFuerLeitplanke(karten, eingabe) {
  const treffer = kennungAufloesen(karten, eingabe)
  if (treffer.karte) return { id: treffer.karte.id }
  if (treffer.mehrdeutig) return { fehler: treffer.fehler }
  return { id: String(eingabe ?? '').trim() }
}
