// Kanten-Ehrlichkeit (BAUPLAN 34): FlowForge steuert die Reihenfolge streng,
// war aber an den KANTEN stumpf — die Prüferkritik wurde mitten im Satz
// abgeschnitten, und eine zu lange Übergabe verlor genau die Marker-Zeilen am
// Ende, die FlowForge und der nächste Block auswerten. Hier stehen die reinen
// Regeln dafür; ausgewertet werden sie in lauf.js.

// Beanstandungen stehen laut Prüfer-Auftrag als eigene Zeile im Muster
// „BEANSTANDUNG (mechanisch): …" bzw. „BEANSTANDUNG (grundsätzlich): …" —
// Aufzählungszeichen davor sind erlaubt, Modelle setzen sie gern.
const BEANSTANDUNG_ANFANG = /^\s*(?:[-*•]\s*|\d+[.)]\s*)?BEANSTANDUNG\s*\(/i
// Diese Zeilen wertet FlowForge selbst aus — sie stehen am Ende eines
// Prüfbelegs und dürfen eine Kürzung niemals verlieren.
const MARKEN_ZEILE = /^\s*(?:[-*•]\s*|\d+[.)]\s*)?(?:BEANSTANDUNG\s*\(|PRUEFKARTE-TITEL\s*:|PRUEFKARTE\s*:|PR(?:UE|Ü)FUNG\s*:?\s*(?:BESTANDEN|FEHLGESCHLAGEN))/i
const URTEILS_MARKE = /PR(?:UE|Ü)FUNG:?\s*(BESTANDEN|FEHLGESCHLAGEN)/gi

// So viel Platz bekommt die Prüferkritik in der Rückmeldung — großzügig, weil
// der Bauer sonst einen Torso ohne Beanstandung bekäme (das Anti-Pattern
// „Runde je Beanstandung" durch die Hintertür).
export const KRITIK_MAX = 3000

// Alle Beanstandungen vollständig herausziehen — eine Beanstandung endet an
// der nächsten Beanstandung, an einer Marker-Zeile oder an einer Leerzeile;
// umgebrochene Fortsetzungszeilen bleiben also erhalten.
export function beanstandungenHerausziehen(pruefbeleg) {
  const zeilen = String(pruefbeleg ?? '').split(/\r?\n/)
  const funde = []
  let laufend = null
  for (const zeile of zeilen) {
    if (BEANSTANDUNG_ANFANG.test(zeile)) {
      laufend = [zeile.trim()]
      funde.push(laufend)
      continue
    }
    if (!laufend) continue
    if (zeile.trim() === '' || MARKEN_ZEILE.test(zeile)) {
      laufend = null
      continue
    }
    laufend.push(zeile.trim())
  }
  return funde.map((teile) => teile.join(' ').trim())
}

// Die Rückmeldung an den Reparatur-Bauer, an die Nachprüfung des Prüfers und
// an die lokale Vorreparatur: alle Beanstandungen vollständig. Ohne Marken
// fällt FlowForge auf den bisherigen Weg zurück (ganzer Beleg ohne
// Urteils-Zeile) — sichtbar gemacht über `rueckfall`.
export function prueferKritik(pruefbeleg, max = KRITIK_MAX) {
  const beanstandungen = beanstandungenHerausziehen(pruefbeleg)
  if (beanstandungen.length === 0) {
    const ohneMarke = String(pruefbeleg ?? '')
      .replace(URTEILS_MARKE, '')
      .trim()
    return {
      text: mitteGekuerzt(ohneMarke, max).text,
      anzahl: 0,
      rueckfall: true,
      weggelassen: 0
    }
  }
  const genommen = []
  let laenge = 0
  for (const eintrag of beanstandungen) {
    if (genommen.length && laenge + eintrag.length + 1 > max) break
    genommen.push(eintrag)
    laenge += eintrag.length + 1
  }
  const weggelassen = beanstandungen.length - genommen.length
  let text = genommen.join('\n')
  if (weggelassen)
    text +=
      `\n(${weggelassen} weitere Beanstandung${weggelassen === 1 ? '' : 'en'} passte nicht mehr ` +
      'in die Rückmeldung — sieh im Prüfbeleg nach, wenn diese hier behoben sind.)'
  return { text, anzahl: beanstandungen.length, rueckfall: false, weggelassen }
}

// Kürzung in der MITTE statt hinten: Der Anfang sagt, worum es geht, der
// Schluss trägt die Marker-Zeilen, die FlowForge und der nächste Block
// auswerten. Liefert immer { text, gekuerzt, von, auf }.
export function mitteGekuerzt(roh, max) {
  const text = String(roh ?? '')
  if (text.length <= max) return { text, gekuerzt: false, von: text.length, auf: text.length }
  const zeilen = text.split(/\r?\n/)
  // Der Schwanz beginnt bei der ersten Marker-Zeile; gibt es keine, bleibt
  // ein Zehntel des Platzes für das Ende reserviert (dort steht das Fazit).
  let schwanzAb = zeilen.findIndex((zeile) => MARKEN_ZEILE.test(zeile))
  let schwanz = schwanzAb >= 0 ? zeilen.slice(schwanzAb).join('\n') : ''
  const schwanzDeckel = Math.floor(max / 2)
  if (!schwanz) schwanz = text.slice(-Math.floor(max / 10))
  if (schwanz.length > schwanzDeckel) schwanz = schwanz.slice(-schwanzDeckel)
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
