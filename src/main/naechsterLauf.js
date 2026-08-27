// Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): Das Sessionende benennt
// die Karten, die der nächste Lauf bekommen sollte, plus einen Satz Empfehlung.
// Gespeichert als Vorschlag, nie als Auswahl — eine eigene Verwaltungsdatei im
// Projektordner (für Agenten-Dateizugriffe gesperrt wie alle
// Verwaltungsdateien; beschreibbar nur über das Werkzeug). Sie überlebt
// App-Neustarts; ein Lauf-Start räumt sie ab (übernommen oder nicht), ein
// neues Sessionende ersetzt sie. Von Sicherungspunkten ausgenommen
// (sicherungspunkte.js) — sonst holte eine Wiederherstellung alte Vorschläge
// zurück.
import fs from 'node:fs'
import path from 'node:path'
import { kartenLaden } from './projekte.js'

const VORSCHLAG_DATEI = 'naechster-lauf.json'

export function laufVorschlagSpeichern(projektPfad, vorschlag) {
  try {
    const datei = path.join(projektPfad, VORSCHLAG_DATEI)
    const tmp = datei + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(vorschlag, null, 2), 'utf8')
    fs.renameSync(tmp, datei)
    return true
  } catch {
    // Ein nicht speicherbarer Vorschlag darf den Lauf nicht stören — dann
    // fehlt schlimmstenfalls die Vorschlags-Zeile an der Kartenauswahl.
    return false
  }
}

export function laufVorschlagLoeschen(projektPfad) {
  try {
    fs.rmSync(path.join(projektPfad, VORSCHLAG_DATEI), { force: true })
  } catch {
    // Nicht löschbar: schlimmstenfalls bleibt eine überflüssige Vorschlags-Zeile.
  }
}

// Reine Auflösung fürs Anzeigen, exportiert für die Regel-Prüfungen:
// Nur existierende Karten-IDs zählen — inzwischen gelöschte fallen still
// heraus (SPEC §5).
export function laufVorschlagAufloesen(roh, karten) {
  if (!roh || typeof roh.empfehlung !== 'string' || !Array.isArray(roh.kartenIds)) return null
  const nachId = new Map((Array.isArray(karten) ? karten : []).map((k) => [k.id, k]))
  const aufgeloest = roh.kartenIds
    .map((id) => nachId.get(id))
    .filter(Boolean)
    .map((k) => ({ id: k.id, sorte: k.sorte, titel: k.titel }))
  return { empfehlung: roh.empfehlung, karten: aufgeloest }
}

export function laufVorschlagLaden(projektPfad) {
  let roh
  try {
    roh = JSON.parse(fs.readFileSync(path.join(projektPfad, VORSCHLAG_DATEI), 'utf8'))
  } catch {
    return null
  }
  const geladen = kartenLaden(projektPfad)
  return laufVorschlagAufloesen(roh, geladen.ok ? geladen.karten : [])
}

// Roh-Leser für den Serienlauf (Bauschritt 61): Die IDs müssen aus der DATEI
// kommen — bericht.naechsterLauf trägt nur Titel, und laufVorschlagLaden gibt
// die fürs Anzeigen aufgelöste Form ohne erledigt-Kennzeichen zurück.
export function laufVorschlagRohLaden(projektPfad) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projektPfad, VORSCHLAG_DATEI), 'utf8'))
  } catch {
    return null
  }
}

// Serienlauf (Bauschritt 61): Was aus einem Vorschlag mechanisch in die
// nächste Runde übernommen wird. Strenger als der Übernehmen-Knopf des
// Renderers: Der zieht erledigte Karten bewusst mit herein (Georg sieht sie),
// die Serie darf das NICHT — der Startprüfer zählt nur offene Aufgaben, eine
// erledigte Karte in der Auswahl erzeugte einen Fehlstart mitten in der Nacht.
// Leeres Ergebnis oder ungültiges roh → null = normale Vorauswahl (ein
// absichtlich leerer Vorschlag ist laut Werkzeug erlaubt).
export function serienKartenAusVorschlag(roh, karten) {
  if (!roh || !Array.isArray(roh.kartenIds)) return null
  const nachId = new Map((Array.isArray(karten) ? karten : []).map((k) => [k.id, k]))
  const offene = roh.kartenIds
    .map((id) => nachId.get(id))
    .filter((k) => k && k.sorte === 'aufgabe' && !k.erledigt)
  if (offene.length === 0) return null
  return { ids: offene.map((k) => k.id), titel: offene.map((k) => k.titel) }
}
