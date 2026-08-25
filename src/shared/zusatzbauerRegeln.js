// Zusatzbauer für Funde des Angreifers (Bauschritt 57): die reinen Regeln.
// Hier steht die MECHANIK ohne Lauf — welcher Fund welchen Weg nimmt, wie aus
// einem Fundort ein Dateipfad wird und was auf der Aufgaben-Karte steht. Der
// Ablaufplaner (lauf.js) hängt nur noch seine Daten dran; die Wegwerf-
// Prüfbarkeit dieser Rechnungen ist der Zweck der Datei. Browser-tauglich wie
// alles unter src/shared (kein node:*).
import { dateiEintragNormalisieren, dateilistenUeberschneidung, SCHWEREN } from './lieferschein.js'
import { TITEL_MAX, TEXT_MAX } from './kartenRegeln.js'
import { texte } from './texte.js'

// Die Etiketten als Namen statt als Streu-Literale. Sie stehen bewusst HIER
// und nicht in blockKatalog.js (dessen FESTE_ETIKETTEN-Liste bleibt die eine
// Quelle; etiketten.test.js hält beide Enden gleich — diese zwei Namen sind
// Teil davon, wenn jemand sie umbenennt, bricht die Prüfung unten).
export const ANGRIFFSLISTE_ETIKETT = 'Angriffsliste'
export const UMSETZUNGSBERICHT_ETIKETT = 'Umsetzungsbericht'

// Die Wege, die ein Fund nehmen kann (E6): kein Fund wird je abgewiesen.
//   normal      — ein Empfänger der Angriffsliste darf die Fundstelle ohnehin
//                 anfassen; der Fund reist wie bisher in der Übergabe.
//   karte       — Aufgaben-Karte ins Projektgedächtnis (der einzige Endpunkt,
//                 der nichts verliert).
//   bericht     — nur im Laufbericht nennen (Einstellung).
//   zusatzbauer — Karte UND ein Zusatzbauer, der den Fund sofort behebt.
//   vorhanden   — für diesen fundpfad läuft in diesem Lauf schon ein
//                 Zusatzbauer (der Melder lief erneut); nichts Neues anlegen.
export const FUND_WEGE = ['normal', 'karte', 'bericht', 'zusatzbauer', 'vorhanden']

// Die Funde der Angriffsliste aus den geprüften Meldungen eines Blocks —
// dasselbe Zugriffs-Muster wie pruefbelegAusMeldungen: die letzte Meldung
// der Art gewinnt. `soll` ist optional (Schema-Erweiterung E15) und wird
// tolerant gelesen — eine Meldung von vor dem Feld trägt schlicht keins.
export function angriffsFundeAus(meldungen) {
  const treffer = (meldungen ?? []).filter((m) => m?.art === 'funde')
  const meldung = treffer.length ? treffer[treffer.length - 1] : null
  return (Array.isArray(meldung?.funde) ? meldung.funde : []).map((fund) => ({
    text: String(fund?.text ?? '').trim(),
    fundort: String(fund?.fundort ?? '').trim(),
    schwere: SCHWEREN.includes(fund?.schwere) ? fund.schwere : 'mittel',
    soll: String(fund?.soll ?? '').trim()
  }))
}

// Aus dem Freitext-Fundort den Dateipfad ziehen (E4): das längste Token, das
// wie ein Dateipfad aussieht — es enthält einen Schrägstrich (vorwärts oder
// rückwärts) und eine Datei-Endung. Normalisiert über die bestehende
// Pfad-Normalisierung (dateiEintragNormalisieren) und klein geschrieben, damit
// dieselbe Schreibweise herauskommt, mit der auch die Dateilisten verglichen
// werden. Ein Pfad, der aus dem Projekt hinausführt oder auf den Projektordner
// selbst zeigt, zählt nicht — gegen ihn ließe sich keine Dateiliste halten.
// Kein Pfad erkennbar → null (der Fund geht dann den Karten-Weg, E6 Schritt 3).
export function fundpfadAus(fundort) {
  const text = String(fundort ?? '')
  let bester = null
  for (const roh of text.split(/\s+/)) {
    // Satzzeichen und Klammern am Rand gehören zum Satz, nicht zum Pfad —
    // ein „(siehe src/app.js)." soll den Pfad trotzdem hergeben. Der Punkt
    // wird nur am ENDE gekappt (die Datei-Endung braucht ihren).
    let token = roh
      .replace(/^[„“"'`«»‚’(<\[{]+/, '')
      .replace(/[„“"'`«»‚’)>\]},;!?]+$/, '')
      .replace(/\.+$/, '')
    // Zeilenangaben wie „src/app.js:12" oder „src/app.js:12:5" abschneiden.
    token = token.replace(/(:\d+)+$/, '')
    if (!token.includes('/') && !token.includes('\\')) continue
    // Ein Doppelpunkt VOR dem ersten Schrägstrich ist ein Schema oder ein
    // Laufwerk („https://…", „file:…", „C:\…") — kein Projektpfad. Ohne die
    // Sperre würde „https://beispiel.de/skript.js" zu „https:/beispiel.de/…"
    // kanonisiert und ein bezahlter Zusatzbauer liefe gegen eine Nicht-Datei
    // (Befund P1-1, 25.08.2026).
    const doppelpunkt = token.indexOf(':')
    if (doppelpunkt >= 0 && doppelpunkt < token.search(/[/\\]/)) continue
    const eintrag = dateiEintragNormalisieren(token)
    if (!eintrag.pfad) continue
    const pfad = eintrag.pfad.toLowerCase()
    // Ordner-Regel wie überall: ohne Datei-Endung wäre es ein Ordner — der
    // Fundort eines Fundes meint eine Datei.
    if (!/\.[^./]+$/.test(pfad)) continue
    if (!bester || pfad.length > bester.length) bester = pfad
  }
  return bester
}

// Rangfolge der Schweren für die Zusammenlegung: die höchste gewinnt.
const SCHWERE_RANG = { hoch: 3, mittel: 2, niedrig: 1 }

function schwerereVon(a, b) {
  return (SCHWERE_RANG[a] ?? 0) >= (SCHWERE_RANG[b] ?? 0) ? a : b
}

// Darf dieser Empfänger die Fundstelle ohnehin anfassen (E5)? Er ist als
// schreibender Umsetzer schon vorausgewählt (der Aufrufer kennt die
// Definitionen); hier zählt nur die Dateiliste: keine Liste heißt „darf
// alles", sonst muss der fundpfad abgedeckt sein — die bestehende
// Überschneidungslogik, Ordner decken ihre Inhalte.
function darfAnfassen(empfaenger, fundpfad) {
  if (!empfaenger?.dateiListe?.length) return true
  if (!fundpfad) return false
  return dateilistenUeberschneidung(empfaenger.dateiListe, [fundpfad]).ueberschneidet
}

// Die Reihenfolge der Regeln je Fund (E6, wie das Ablauf-Schaubild):
//   1. zuständig? → normaler Weg. Gibt es GAR KEINE Empfänger, gibt es auch
//      niemanden, dem man den Fix zurechnen könnte → Karte (E5).
//   2. Einstellung: 'karte' → Karte; 'bericht' → nur Laufbericht;
//      'mitnehmen' → weiter.
//   3. fundpfad UND soll vorhanden? nein → Karte.
//   4. Obergrenze erreicht? ja → Karte.
//   5. Zusatzbauer (Karte kommt trotzdem — sie ist der Endpunkt, E7).
// Mehrere Funde mit gleichem normalisiertem fundpfad → EIN Zusatzbauer,
// soll-Sätze zusammengeführt (je Zeile eines). `bereitsAngelegt` sind die
// fundpfade der in DIESEM Lauf schon angelegten Zusatzbauer: Läuft der Melder
// erneut, entsteht kein zweiter für dieselbe Stelle ('vorhanden'), und die
// Obergrenze zählt weiter je Lauf.
//
// Reine Funktion, keine Seiteneffekte. Eingaben:
//   funde          — [{ text, fundort, schwere, soll }] (angriffsFundeAus)
//   empfaenger     — [{ instanzId?, dateiListe: [..]|null }], nur schreibende
//                    Umsetzer, die die Angriffsliste wirklich bekommen
//   einstellung    — 'karte'|'mitnehmen'|'bericht' (alles andere → 'karte')
//   obergrenze     — ganze Zahl ≥ 0 (alles andere → 1)
//   bereitsAngelegt— [{ fundpfad }]
// Rückgabe:
//   wege        — je Fund { fund, fundpfad, weg } in Eingabe-Reihenfolge
//   zusatzbauer — [{ fundpfad, fundort, text, soll, schwere, funde }]
export function zusatzbauerEntscheidung({
  funde,
  empfaenger,
  einstellung,
  obergrenze,
  bereitsAngelegt
} = {}) {
  const modus = ['karte', 'mitnehmen', 'bericht'].includes(einstellung) ? einstellung : 'karte'
  const max = Number.isInteger(obergrenze) && obergrenze >= 0 ? obergrenze : 1
  const angelegt = Array.isArray(bereitsAngelegt) ? bereitsAngelegt : []
  const vorhandenePfade = new Set(angelegt.map((e) => e?.fundpfad).filter(Boolean))
  const liste = Array.isArray(empfaenger) ? empfaenger : []
  const wege = []
  const kandidaten = []
  for (const fund of Array.isArray(funde) ? funde : []) {
    const fundpfad = fundpfadAus(fund?.fundort)
    const eintrag = { fund, fundpfad, weg: 'karte' }
    wege.push(eintrag)
    if (liste.some((e) => darfAnfassen(e, fundpfad))) {
      eintrag.weg = 'normal'
      continue
    }
    if (liste.length === 0) continue // keine Empfänger → Karte (E5)
    if (modus === 'karte') continue
    if (modus === 'bericht') {
      eintrag.weg = 'bericht'
      continue
    }
    if (!fundpfad || !fund?.soll) continue
    if (vorhandenePfade.has(fundpfad)) {
      eintrag.weg = 'vorhanden'
      continue
    }
    eintrag.weg = 'zusatzbauer' // vorläufig — die Obergrenze entscheidet unten
    kandidaten.push(eintrag)
  }
  // Zusammenlegung gleicher fundpfade, dann die Obergrenze über die GRUPPEN:
  // Zwei Funde an derselben Stelle sind ein Zusatzbauer, nicht zwei.
  const gruppen = new Map()
  for (const eintrag of kandidaten) {
    if (!gruppen.has(eintrag.fundpfad)) gruppen.set(eintrag.fundpfad, [])
    gruppen.get(eintrag.fundpfad).push(eintrag)
  }
  const frei = Math.max(0, max - angelegt.length)
  const zusatzbauer = []
  let genommen = 0
  for (const [fundpfad, eintraege] of gruppen) {
    if (genommen >= frei) {
      for (const eintrag of eintraege) eintrag.weg = 'karte'
      continue
    }
    genommen++
    zusatzbauer.push({
      fundpfad,
      fundort: eintraege[0].fund.fundort,
      text: eintraege.map((e) => e.fund.text).join('\n'),
      soll: eintraege.map((e) => e.fund.soll).join('\n'),
      schwere: eintraege.map((e) => e.fund.schwere).reduce(schwerereVon),
      funde: eintraege.map((e) => e.fund)
    })
  }
  return { wege, zusatzbauer }
}

// Kürzen mit Ellipse statt Abweisen (E7): Eine abgewiesene Karte wäre exakt
// das Loch, das dieser Schritt stopft.
export function gekuerzt(text, max) {
  const t = String(text ?? '').trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 1)).trimEnd() + '…'
}

// Titel und Text der Aufgaben-Karte zu einem Fund (oder einer zusammengelegten
// Fund-Gruppe): mechanisch aus den Feldern, mechanisch gekürzt. `soll` heißt
// auf der Karte nie „soll", sondern „Woran man erkennt, dass es behoben ist".
export function fundKartenInhalt({ text, fundort, soll } = {}) {
  const zeilen = [String(text ?? '').trim()]
  if (String(fundort ?? '').trim()) zeilen.push(texte.zusatzbauer.karteZeileFundort(fundort))
  if (String(soll ?? '').trim()) zeilen.push(texte.zusatzbauer.karteZeileErkennen(soll))
  return {
    titel: gekuerzt(String(text ?? '').split('\n')[0], TITEL_MAX),
    text: gekuerzt(zeilen.filter(Boolean).join('\n'), TEXT_MAX)
  }
}
