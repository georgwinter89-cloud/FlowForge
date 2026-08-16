// Kanten-Ehrlichkeit (BAUPLAN 34/42): FlowForge steuert die Reihenfolge streng,
// war aber an den KANTEN stumpf — die Prüferkritik wurde mitten im Satz
// abgeschnitten, und eine zu lange Übergabe verlor genau die Marker-Zeilen am
// Ende, die FlowForge auswertete.
//
// Seit dem Lieferschein (BAUPLAN 42) gibt es diese Marker-Zeilen nicht mehr:
// Der Prüfer meldet seine Beanstandungen als Felder, und FlowForge baut daraus
// die Rückmeldung. Was hier bleibt, ist die reine Mengen-Frage — wie viel
// Kritik passt in eine Rückmeldung, und wie wird ein zu langer Text gekürzt,
// ohne dass jemand es merkt (nämlich gar nicht: die Kürzung steht im Ticker).
import { beanstandungZeile } from './lieferschein.js'
import { texte } from './texte.js'

// So viel Platz bekommt die Prüferkritik in der Rückmeldung — großzügig, weil
// der Bauer sonst einen Torso ohne Beanstandung bekäme (das Anti-Pattern
// „Runde je Beanstandung" durch die Hintertür).
export const KRITIK_MAX = 3000

// Die Rückmeldung an den Reparatur-Bauer, an die Nachprüfung des Prüfers und
// an die lokale Vorreparatur: alle Beanstandungen des gemeldeten Prüfbelegs,
// vollständig und in der Reihenfolge, in der der Prüfer sie gemeldet hat.
// `beanstandungen` sind die geprüften Einträge aus dem Lieferschein.
export function prueferKritik(beanstandungen, max = KRITIK_MAX) {
  const zeilen = (Array.isArray(beanstandungen) ? beanstandungen : []).map(beanstandungZeile)
  const genommen = []
  let laenge = 0
  for (const zeile of zeilen) {
    if (genommen.length && laenge + zeile.length + 1 > max) break
    genommen.push(zeile)
    laenge += zeile.length + 1
  }
  const weggelassen = zeilen.length - genommen.length
  let text = genommen.join('\n')
  if (weggelassen) text += '\n' + texte.kette.kritikWeggelassen(weggelassen)
  return { text, anzahl: zeilen.length, weggelassen }
}

// Kürzung in der MITTE statt hinten: Der Anfang sagt, worum es geht, das Ende
// trägt das Fazit. Liefert immer { text, gekuerzt, von, auf }.
// Gilt seit BAUPLAN 42 nur noch für frei gewachsene Texte (Übertrags-Übergabe,
// Tor-Protokolle, Baseline-Ausgaben) — die Lieferscheine selbst sind durch
// ihre Feldgrenzen ohnehin klein.
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
