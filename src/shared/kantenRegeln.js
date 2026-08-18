// Kanten-Ehrlichkeit (BAUPLAN 34/42): FlowForge steuert die Reihenfolge streng,
// war aber an den KANTEN stumpf — die Prüferkritik wurde mitten im Satz
// abgeschnitten, und eine zu lange Übergabe verlor genau die Marker-Zeilen am
// Ende, die FlowForge auswertete.
//
// Seit dem Lieferschein (BAUPLAN 42) gibt es diese Marker-Zeilen nicht mehr:
// Der Prüfer meldet seine Beanstandungen als Felder, und FlowForge baut daraus
// die Rückmeldung. Seit 0.46.1 (Entscheidung Georg, 18.08.2026) gibt es dabei
// auch keinen Deckel mehr: Alle Beanstandungen gehen vollständig weiter, und
// auch die Übergaben zwischen Blöcken werden nicht mehr gekürzt — die festen
// Grenzen scheiterten im Alltag mehrfach knapp und kosteten Runden. Gedeckelt
// bleiben nur Prozess-Ausgaben (Tor-Protokoll, Baseline, Rauchtest), für die
// mitteGekuerzt unten weiter da ist.
import { beanstandungZeile } from './lieferschein.js'

// Die Rückmeldung an den Reparatur-Bauer, an die Nachprüfung des Prüfers und
// an die lokale Vorreparatur: alle Beanstandungen des gemeldeten Prüfbelegs,
// vollständig und in der Reihenfolge, in der der Prüfer sie gemeldet hat —
// ohne Deckel. `beanstandungen` sind die geprüften Einträge aus dem
// Lieferschein. Liefert { text, anzahl }.
export function prueferKritik(beanstandungen) {
  const zeilen = (Array.isArray(beanstandungen) ? beanstandungen : []).map(beanstandungZeile)
  return { text: zeilen.join('\n'), anzahl: zeilen.length }
}

// Kürzung in der MITTE statt hinten: Der Anfang sagt, worum es geht, das Ende
// trägt das Fazit. Liefert immer { text, gekuerzt, von, auf }.
// Gilt nur für Prozess-Ausgaben (Tor-Protokolle, Baseline, Rauchtest-Ausgabe)
// — Übergaben und Prüferkritik werden seit 0.46.1 nicht mehr gekürzt.
export function mitteGekuerzt(roh, max) {
  const text = String(roh ?? '')
  if (text.length <= max) return { text, gekuerzt: false, von: text.length, auf: text.length }
  // Ein Zehntel des Platzes bleibt fürs Ende reserviert — dort steht das Fazit.
  const schwanz = text.slice(-Math.floor(max / 10))
  const hinweis = (weg) => `\n\n[… ${weg} Zeichen von FlowForge herausgekürzt …]\n\n`
  const platzKopf = Math.max(0, max - schwanz.length - hinweis(text.length).length)
  const kopf = text.slice(0, platzKopf)
  const weg = text.length - kopf.length - schwanz.length
  return {
    text: kopf + hinweis(weg) + schwanz,
    gekuerzt: true,
    von: text.length,
    auf: kopf.length + hinweis(weg).length + schwanz.length
  }
}
