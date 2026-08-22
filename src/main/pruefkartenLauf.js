// Prüfkarten laufen von selbst (BAUPLAN 52): der Messpunkt-Motor.
//
// FlowForge spielt archivierte Prüfungen aus früheren Läufen selbst ab — ohne
// KI, 0 Tokens —, direkt VOR und direkt NACH jedem schreibenden Block. Damit
// trennt sich „vorher schon rot" von „neu kaputt" von selbst, und die Zuordnung
// ist so scharf wie möglich: Es war genau dieser Bauer.
//
// Warum kein Agent entscheidet, welche Karte dran ist: Der Zugsimulator-Befund
// (12.08.2026) hat gemessen, dass eine Bitte im Auftrag nicht hält — „Die
// Prüfmappe wuchert weiter TROTZ Auftrags-Verbot". Ein Listenschnitt in
// FlowForge ist dagegen eine Regel; die Rechnung dazu steht als reine Funktion
// in src/shared/pruefkartenRegeln.js.
//
// Was hier NICHT geraten wird (gemessen am echten Archiv, 21.08.2026): kein
// Einstieg, keine Ordnertiefe, kein Port. Eine Karte ohne Stempel heißt „nicht
// abspielbar" und bekommt eine eigene Zahl im Ticker — von 38 archivierten
// Karten hatte keine einzige einen zuordenbaren Prüfbefehl, und aus 15 Karten
// mit Sammel-Skript, 4 Einzeldateien und 6 gleichrangigen Skripten lässt sich
// nichts ableiten, das nicht geraten wäre.
import fs from 'node:fs'
import path from 'node:path'
import { texte } from '../shared/texte.js'
import { mitteGekuerzt } from '../shared/kantenRegeln.js'
import {
  kartenOrdnerName,
  befehlUmschreiben,
  musterImBefehl,
  nameTrifftMuster,
  kartenAuswahl
} from '../shared/pruefkartenRegeln.js'
import { stempelLaden, stempelMessungVermerken } from './pruefkartenStempel.js'
import { pruefkarteEinlegen } from './pruefkarten.js'
import { kartenLaden } from './projekte.js'
import { befehlAbspielen } from './torProzess.js'
import { appLaeuft, aufPortFreiWarten } from './appProzess.js'
import { portBesitzer, prozessZugehoerigkeit, prozessBeenden } from './prozesse.js'
import { startanleitungLaden } from './startanleitung.js'
import { lokalerPort } from './prozessRegeln.js'

const PRUEFMAPPE = 'pruefung'

// Zeitlimit je Karte — deutlich kürzer als das des Prüfbefehls (5 Minuten):
// An einem Messpunkt laufen mehrere Karten nacheinander, und eine einzige
// hängende Prüfung darf den Bauer nicht minutenlang aufhalten. Ein gerissenes
// Zeitlimit ist NIE ein Rot (Vertrag G6) — ein Testlauf, der nicht endet,
// belegt gar nichts.
export const KARTE_ZEITLIMIT_MS = 90 * 1000

// So viel Fehlerausgabe einer roten Karte wandert weiter (in den Auftrag des
// Prüfers und in den Laufbericht). Der Gesamt-Deckel über alle Karten sitzt
// beim Aufrufer in lauf.js.
export const KARTE_AUSGABE_MAX = 800

// ——— Reine Rechnungen (in einer Prüfung fahrbar) ———————————————————————————

// Was eine abgespielte Karte bedeutet. Die eine Stelle, an der aus einer
// Prozess-Ausgabe ein Urteil wird — und die einzige, an der über „rot"
// entschieden wird.
//
// Fehlercode 0 ist allein KEIN Beleg (Vertrag G3, gemessen 21.08.2026):
// `node --test pruefung/gibtsnicht/*.test.mjs` endet mit Exit 0 und schreibt
// „tests 0". Eine Prüfung, die nichts ausgeführt hat, ist deshalb „nicht
// gemessen", nie grün. Umgekehrt sind Zeitlimit, Abbruch und ein belegter Port
// nie rot: Sie sagen etwas über die Umstände, nicht über den Code.
//
// Die „nichts gelaufen"-Regel gilt AUSSCHLIESSLICH bei Fehlercode 0 — das war
// ihr Anlass. Gemessen (22.08.2026): `node --test <ordner>/*.test.mjs` mit zwei
// fehlschlagenden Tests endet mit Exit 1 und schreibt „tests 2 / pass 0 /
// fail 2". Auf „pass 0" allein gelesen wurde daraus „ohne Urteil" statt ROT —
// und je schlimmer die Regression (ein Importfehler lässt ALLE Tests fallen),
// desto sicherer verschluckte FlowForge sie. Genau dafür ist der Messpunkt
// gebaut. Deshalb: Fehlercode ungleich 0 bleibt rot, egal was in der Ausgabe
// steht; und „pass 0" zählt nur zusammen mit „fail 0" als „nichts gelaufen".
// → { ausgang: 'gruen' | 'rot' | 'nichtGemessen', grund }
export function ausgangAusMessung(messung) {
  const ausgabe = String(messung?.ausgabe ?? '')
  if (messung?.abgebrochen) return { ausgang: 'nichtGemessen', grund: 'abgebrochen' }
  if (messung?.zeitlimit) return { ausgang: 'nichtGemessen', grund: 'zeitlimit' }
  // Die Shell ließ sich gar nicht erst starten (Einwand Bauer B): Das sagt über
  // den Code genauso wenig aus wie ein Zeitlimit — es ist ein Befund über den
  // Rechner, nicht über die Arbeit des Blocks. Ginge es als Rot in den Auftrag
  // des Prüfers, suchte der eine Regression, die es nicht gibt.
  if (messung?.startFehler) return { ausgang: 'nichtGemessen', grund: 'startFehler' }
  if (/EADDRINUSE/i.test(ausgabe)) return { ausgang: 'nichtGemessen', grund: 'portBelegt' }
  if (messung?.code !== 0) return { ausgang: 'rot', grund: '' }
  // \b hinter der 0, damit „tests 10" und „pass 07" nicht mitgelesen werden.
  const keinTest = /\btests\s+0\b/i.test(ausgabe)
  const keinDurchlauf = /\bpass\s+0\b/i.test(ausgabe) && /\bfail\s+0\b/i.test(ausgabe)
  if (keinTest || keinDurchlauf) return { ausgang: 'nichtGemessen', grund: 'nichtsGemessen' }
  return { ausgang: 'gruen', grund: '' }
}

// Darf diese Karte an diesem Messpunkt noch starten? (Notbremse, BAUPLAN 52.)
// Die Zusage ist „mindestens einmal je Lauf": Eine Karte, die in diesem Lauf
// noch NIE gelaufen ist, läuft auch dann, wenn beide Grenzen längst erreicht
// sind. Es ändert sich nur, wie OFT eine Prüfung läuft, nie OB.
// → { laeuft: true } | { laeuft: false, grund: 'messpunkt' | 'lauf' }
export function deckelUrteil({ verbrauchtMs, deckelMesspunktMs, restLaufMs, schonGelaufen }) {
  if (!schonGelaufen) return { laeuft: true }
  if (Number(restLaufMs) <= 0) return { laeuft: false, grund: 'lauf' }
  if (Number(verbrauchtMs) >= Number(deckelMesspunktMs)) return { laeuft: false, grund: 'messpunkt' }
  return { laeuft: true }
}

// Treffer-Vorprüfung (Vertrag G3): Spricht der Befehl im Kartenordner
// überhaupt eine Datei an? `dateien` sind die Namen im Kartenordner (auch aus
// Unterordnern, nur der Dateiname). Nennt der Befehl keine Datei, genügt
// „Ordner nicht leer" — dann führt er ein Sammel-Skript aus, das seine Dateien
// selbst sucht.
export function trefferVorpruefung(dateien, muster) {
  const liste = Array.isArray(dateien) ? dateien : []
  if (!muster?.length) return liste.length > 0
  return liste.some((name) => nameTrifftMuster(name, muster))
}

// Der Klartext-Grund für den Ticker und die Aufträge — nie eine leere Klammer,
// auch wenn ein künftiger Grund hier noch nicht steht.
//
// Der Rückfall greift auf BEIDEN Stufen. Gemessen (22.08.2026): Bei einer
// unbekannten GRUPPE lief die Rechnung auf `{}` und lieferte eine leere
// Zeichenkette — im Ticker stand dann „nicht abspielbar: ." und Georg las einen
// Satz ohne Inhalt.
export function grundText(gruppe, schluessel) {
  const tabelle = texte.pruefkarten[gruppe]
  if (!tabelle || typeof tabelle !== 'object') return texte.pruefkarten.grundUnbekannt
  return tabelle[schluessel] ?? tabelle.unbekannt ?? texte.pruefkarten.grundUnbekannt
}

// Wie der Messpunkt in Georgs Sprache heißt: „vor Runde 2" / „nach Runde 2".
export function phaseText(phase, runde) {
  return phase === 'nach'
    ? texte.pruefkarten.phaseNach(runde)
    : texte.pruefkarten.phaseVor(runde)
}

// ——— Der Messpunkt selbst ————————————————————————————————————————————————

// Leerer Ordnername heißt „kein Kartenordner" (siehe kartenOrdnerName): Dann
// gibt es keinen Pfad, und niemand darf einen bilden — er zeigte sonst auf die
// ganze Prüfmappe.
function kartenPfad(projektPfad, kartenId) {
  const ordner = kartenOrdnerName(kartenId)
  return ordner ? path.join(projektPfad, PRUEFMAPPE, ordner) : ''
}

// Alle Dateien unter dem Kartenordner — als PFADE RELATIV ZUM KARTENORDNER,
// mit / geschrieben (z.B. 'unter/pruefe.mjs').
//
// Nur die Basisnamen genügen nicht. Gemessen (22.08.2026): Lag die aufbewahrte
// Datei in einem Unterordner (unter/pruefe.mjs) und lautete der Befehl
// entsprechend „node pruefung/pruefer-abc/unter/pruefe.mjs", lieferte
// musterImBefehl ['unter/pruefe.mjs'], die Namensliste aber nur ['pruefe.mjs'] —
// die Treffer-Vorprüfung schlug fehl und die Karte galt als nicht abspielbar,
// obwohl derselbe Befehl von Hand grün durchlief. nameTrifftMuster kann Pfade:
// sein * springt keinen Schrägstrich, also trifft '*.test.mjs' weiterhin NICHT
// 'unter/a.test.mjs'.
function dateinamenUnter(ordner, praefix = '') {
  const namen = []
  let eintraege
  try {
    eintraege = fs.readdirSync(ordner, { withFileTypes: true })
  } catch {
    return namen
  }
  for (const e of eintraege) {
    if (e.isDirectory())
      namen.push(...dateinamenUnter(path.join(ordner, e.name), praefix + e.name + '/'))
    else namen.push(praefix + e.name)
  }
  return namen
}

// Den ausgelegten Kartenordner wieder wegräumen. Ein Fehlschlag wird
// zurückgemeldet statt verschluckt: Ein liegengebliebener Ordner sähe für den
// nächsten Block wie eine echte Prüfung dieses Laufs aus.
export function kartenOrdnerAbraeumen(projektPfad, kartenId) {
  const pfad = kartenPfad(projektPfad, kartenId)
  // Ohne Kartenkennung gibt es nichts abzuräumen — und vor allem nicht die
  // ganze Prüfmappe, auf die ein leerer Ordnername sonst zeigte.
  if (!pfad) return { ok: true }
  try {
    fs.rmSync(pfad, { recursive: true, force: true })
    return { ok: true }
  } catch (fehler) {
    return { ok: false, fehler: String(fehler?.message ?? fehler) }
  }
}


// Ein Messpunkt: Auswahl treffen, ausgewählte Karten strikt nacheinander
// abspielen, alles benennen, was ausfällt.
//
// `schonGelaufen` (Set) und `ausgelegt` (Map) gehören dem LAUF, nicht dem
// Messpunkt — sie werden hier gepflegt und vom Aufrufer über alle Messpunkte
// hinweg weitergereicht.
export async function kartenMesspunkt({
  projektPfad,
  phase,
  instanzId,
  runde,
  paketDateien = null,
  gezogen = [],
  // Karten, die einem Prüfer gerade zur Anpassung überlassen sind (rot an einem
  // früheren Messpunkt). Sie werden wie gezogene behandelt: Der Messpunkt fasst
  // ihren Ordner nicht an, sonst legte sich die Archivfassung über die gerade
  // angepasste Prüfung — gemessen am 22.08.2026, samt weggeworfener Freigabe.
  beimPruefer = [],
  schonGelaufen = new Set(),
  deckelMesspunktMs,
  restLaufMs,
  abbrechen = () => false,
  tickern = () => {},
  ausgelegt = new Map(),
  // Wessen Messpunkt das ist — bei der Nachher-Messung ALLE Schreiber der
  // Welle namentlich (Vertrag G5): Nach einer Welle sagt „nach Runde 1" allein
  // nicht, um wessen Arbeit herum gemessen wurde.
  wer = '',
  // Aufhol-Messpunkt beim sanften Stopp (BAUPLAN 52): Dann laufen NUR die
  // Karten, die in diesem Lauf kein einziges Mal dran waren — die Zusage
  // „mindestens einmal je Lauf" wird ein letztes Mal eingelöst, und was auch
  // dann nicht mehr passt, steht namentlich im Ticker statt gar nicht.
  nurNieGelaufen = false
}) {
  const begonnen = Date.now()
  const ergebnisse = []
  // Getrennte Köpfe statt einer Sammelzahl (gemessen 22.08.2026): „ausgeführt"
  // zählte auch abgebrochene Karten mit, und eine gezogene Karte stand unter
  // „nicht betroffen übersprungen" — beides las sich im Ticker wie etwas, das
  // gar nicht stattgefunden hat.
  const zahlen = {
    ausgewaehlt: 0,
    ausgefuehrt: 0,
    rot: 0,
    uebersprungen: 0,
    nichtBetroffen: 0,
    gezogen: 0,
    beimPruefer: 0,
    schonGelaufen: 0,
    nichtAbspielbar: 0,
    rotation: 0,
    zurueckgestellt: 0,
    nichtGemessen: 0
  }
  const was = phaseText(phase, runde)

  // Die Ergebnis-Zeile darf genau einmal kommen und nur dann, wenn es vorher
  // eine Plan-Zeile gab. Sie steht im finally der Schleife UND in fertig(),
  // damit sie auch bei Abbruch, bei einem belegten Port und bei einer Ausnahme
  // erscheint — sonst bliebe der Plan ohne Abrechnung stehen.
  let ergebnisOffen = false
  const planMelden = () => {
    tickern(texte.ticker.kartenPlan(was, wer, zahlen))
    ergebnisOffen = true
  }
  const ergebnisMelden = () => {
    if (!ergebnisOffen) return
    ergebnisOffen = false
    tickern(texte.ticker.kartenErgebnis(was, wer, zahlen))
  }
  const fertig = () => {
    ergebnisMelden()
    return { ergebnisse, zahlen, verbrauchtMs: Date.now() - begonnen }
  }
  // Jede Karte, die in diesem Messpunkt vorkam, bekommt einen Eintrag — auch
  // eine zurückgestellte oder abgebrochene. Sonst fiele sie aus dem Laufbericht
  // und aus jedem Auftrag heraus, und niemand erführe je, dass sie anstand.
  const notieren = (kartenId, titel, ausgang, ausgabe, dauerMs) =>
    ergebnisse.push({
      kartenId,
      titel,
      ausgang,
      ausgabe,
      dauerMs,
      ordner: kartenOrdnerName(kartenId)
    })
  // Was DIESER Messpunkt ausgelegt hat — nur das räumt das finally unten ab.
  // Rote Ordner früherer Messpunkte bleiben liegen, sie gehören einem Prüfer.
  const dieseRunde = new Set()

  // Ein Ordner, der beim letzten Mal nicht wegging (gesperrte Datei, offener
  // Editor), kommt hier noch einmal dran. Rote Ordner und solche, die einem
  // Prüfer gehören, bleiben unangetastet.
  for (const [alteKarte, eintrag] of ausgelegt) {
    if (eintrag?.rot || eintrag?.instanzId) continue
    if (kartenOrdnerAbraeumen(projektPfad, alteKarte).ok) ausgelegt.delete(alteKarte)
  }

  const geladen = kartenLaden(projektPfad)
  const karten = (geladen.ok ? geladen.karten : [])
    .filter((k) => k.sorte === 'pruefung')
    .map((k) => ({ id: k.id, titel: k.titel }))
  if (karten.length === 0) {
    tickern(texte.ticker.kartenKeine(was, wer))
    return fertig()
  }
  const titelVon = new Map(karten.map((k) => [k.id, k.titel]))

  // Frisch je Messpunkt: Eine Karte kann während des Laufs gelöscht worden
  // sein — dann ist ihr Stempel verwaist und darf nicht mehr mitspielen.
  const geladenerStempel = stempelLaden(
    projektPfad,
    karten.map((k) => k.id)
  )
  if (geladenerStempel.kaputt) tickern(texte.ticker.kartenStempelKaputt)
  const stempel = geladenerStempel.karten ?? {}

  // schonGelaufen entscheidet NICHT, OB eine Karte ausgewählt ist — nur bei
  // Gleichstand in der Rotation, damit ein blockierter Stempel nicht in jedem
  // Messpunkt dieselben zwei Karten zieht.
  const auswahl = kartenAuswahl({
    karten,
    stempel,
    paketDateien,
    gezogen,
    beimPruefer,
    schonGelaufen: [...schonGelaufen]
  })
  // Beim Aufholen zählen die schon gelaufenen Karten als übersprungen — sie
  // sind keine Auslassung, sondern die eingelöste Zusage.
  const laufListe = nurNieGelaufen
    ? auswahl.laeuft.filter((e) => !schonGelaufen.has(e.id))
    : auswahl.laeuft
  for (const e of auswahl.uebersprungen) {
    if (e.grund === 'gezogen') zahlen.gezogen++
    else if (e.grund === 'beimPruefer') zahlen.beimPruefer++
    else zahlen.nichtBetroffen++
  }
  zahlen.schonGelaufen = auswahl.laeuft.length - laufListe.length
  zahlen.uebersprungen =
    zahlen.nichtBetroffen + zahlen.gezogen + zahlen.beimPruefer + zahlen.schonGelaufen
  zahlen.nichtAbspielbar = auswahl.nichtAbspielbar.length
  zahlen.rotation = laufListe.filter((e) => e.grund === 'rotation').length
  zahlen.ausgewaehlt = laufListe.length

  // Die Plan-Zeile steht VOR dem ersten Abspielen: Sie ist der Beleg, dass
  // nichts still weggelassen wurde — auch wenn der Messpunkt gleich darauf an
  // einem belegten Port endet.
  planMelden()
  for (const e of auswahl.nichtAbspielbar)
    tickern(
      texte.ticker.kartenNichtAbspielbar(
        titelVon.get(e.id) ?? e.id,
        grundText('grundNichtAbspielbar', e.grund)
      )
    )
  for (const e of laufListe)
    if (e.grund === 'rotation') tickern(texte.ticker.kartenRotation(titelVon.get(e.id) ?? e.id))
  if (laufListe.length === 0) return fertig()

  // Alle noch anstehenden Karten in einem Rutsch als „ohne Urteil" abschließen —
  // namentlich. Gemessen (22.08.2026): Beim Abbruch zählte die Zahl alle drei
  // offenen Karten, im Ticker stand aber nur EINE davon, und die anderen tauchten
  // in keinem Ergebnis-Eintrag auf; sie fielen aus Auftrag und Laufbericht.
  const restAbschliessen = (rest, grundSchluessel) => {
    const grund = grundText('grundNichtGemessen', grundSchluessel)
    for (const e of rest) {
      const titel = titelVon.get(e.id) ?? e.id
      zahlen.nichtGemessen++
      notieren(e.id, titel, 'nichtGemessen', grund, 0)
      tickern(texte.ticker.kartenNichtGemessen(titel, grund))
    }
  }

  // Läuft die App gerade im App-Tab, nähme ihr jede Live-Prüfung den Port weg
  // und meldete ein falsches Rot — dieselbe Regel wie beim Rauchtest.
  if (appLaeuft(projektPfad)) {
    tickern(texte.ticker.kartenAppLaeuft(laufListe.length))
    restAbschliessen(laufListe, 'appLaeuft')
    return fertig()
  }
  // Port-Schutz in genau der Reihenfolge des Rauchtests: Besitzer feststellen,
  // Zugehörigkeit prüfen, eigene Reste abräumen, auf den freien Port warten.
  // Ein FREMDER Besitzer (Georgs eigener Server, ein Editor) führt zu „nicht
  // gemessen", nie zu einem Rot. Geprüft wird ausschließlich der Port der
  // Startanleitung: Ports aus Prüfdateien zu raten wird ausdrücklich nicht
  // gebaut — sie lesen ihren Port zur Laufzeit aus Projektkonfigurationen.
  const anleitung = startanleitungLaden(projektPfad).anleitung ?? null
  const port = anleitung?.adresse ? lokalerPort(anleitung.adresse) : null
  if (port) {
    const besitzer = await portBesitzer(port)
    if (besitzer) {
      const kurz = { pid: besitzer.pid, name: besitzer.name, befehl: besitzer.befehl }
      const zugehoerig = prozessZugehoerigkeit(besitzer.pid, besitzer.start, projektPfad)
      if (zugehoerig !== 'gruppe' && zugehoerig !== 'rest') {
        tickern(texte.ticker.kartenPortFremd(laufListe.length, port, kurz))
        restAbschliessen(laufListe, 'portBelegt')
        return fertig()
      }
      const beendet = await prozessBeenden(besitzer.pid, besitzer.start)
      if (beendet.ok) tickern(texte.ticker.kartenPortAbgeraeumt(kurz, port))
      if (!(await aufPortFreiWarten(port))) {
        tickern(texte.ticker.kartenPortFremd(laufListe.length, port, kurz))
        restAbschliessen(laufListe, 'portBelegt')
        return fertig()
      }
    }
  }

  // Ein einziger Hinweis je Messpunkt, wenn sich der Stempel nicht schreiben
  // lässt: Bei einer gesperrten Datei fällt jede Karte darauf herein, und
  // zwanzig gleichlautende Ticker-Zeilen sagen nicht mehr als eine.
  let stempelGemeldet = false

  try {
    for (let stelle = 0; stelle < laufListe.length; stelle++) {
      const eintrag = laufListe[stelle]
      if (abbrechen()) {
        restAbschliessen(laufListe.slice(stelle), 'abgebrochen')
        break
      }
      const kartenId = eintrag.id
      const titel = titelVon.get(kartenId) ?? kartenId
      const st = stempel[kartenId]
      const verbrauchtMs = Date.now() - begonnen
      const urteil = deckelUrteil({
        verbrauchtMs,
        deckelMesspunktMs,
        // Im Aufhol-Messpunkt gilt die Zeitgrenze auch für nie gelaufene
        // Karten: Ein „sanft anhalten" darf nicht doch noch zehn Minuten
        // dauern. Genau dafür steht dann eine eigene, namentliche Ticker-Zeile
        // — hier ist „später" nämlich „gar nicht mehr in diesem Lauf".
        restLaufMs: Number(restLaufMs) - verbrauchtMs,
        schonGelaufen: nurNieGelaufen || schonGelaufen.has(kartenId)
      })
      if (!urteil.laeuft) {
        const grund = grundText('grundZurueckgestellt', urteil.grund)
        zahlen.zurueckgestellt++
        notieren(kartenId, titel, 'nichtGemessen', grund, 0)
        tickern(
          nurNieGelaufen
            ? texte.ticker.kartenAufholenOffen(titel)
            : // Beim LAUF-Deckel wäre „läuft noch mindestens einmal" schlicht
              // falsch: Dann läuft nur noch, was in diesem Lauf NIE lief.
              urteil.grund === 'lauf'
              ? texte.ticker.kartenErstNaechsterLauf(titel, grund)
              : texte.ticker.kartenZurueckgestellt(titel, grund)
        )
        continue
      }

      const ordner = kartenOrdnerName(kartenId)
      const umgeschrieben = befehlUmschreiben(st?.befehl ?? '', st?.ordner ?? '', ordner)
      if (!umgeschrieben.ok) {
        const grund = grundText('grundNichtAbspielbar', umgeschrieben.grund)
        zahlen.nichtAbspielbar++
        notieren(kartenId, titel, 'nichtGemessen', grund, 0)
        tickern(texte.ticker.kartenNichtAbspielbar(titel, grund))
        continue
      }

      let eingelegt = false
      let einlegeFehler = ''
      try {
        eingelegt = pruefkarteEinlegen(projektPfad, kartenId)
      } catch (fehler) {
        // Kein leerer catch: Eine klemmende Kopie ist ein echter Ausfall und
        // bekommt ihren Namen im Ticker.
        einlegeFehler =
          grundText('grundNichtAbspielbar', 'einlegen') +
          ' (' + String(fehler?.message ?? fehler) + ')'
        tickern(texte.ticker.kartenNichtAbspielbar(titel, einlegeFehler))
      }
      if (!eingelegt) {
        const grund = einlegeFehler || grundText('grundNichtAbspielbar', 'ohneDateien')
        zahlen.nichtAbspielbar++
        notieren(kartenId, titel, 'nichtGemessen', grund, 0)
        if (!einlegeFehler) tickern(texte.ticker.kartenNichtAbspielbar(titel, grund))
        continue
      }
      // Die instanzId einer früheren Freigabe bleibt stehen. Sie auf null zu
      // setzen warf die Zusage „genau EIN Prüfer" weg — dieselbe Karte konnte
      // danach einem zweiten Prüfer freigegeben werden (gemessen 22.08.2026).
      ausgelegt.set(kartenId, {
        instanzId: ausgelegt.get(kartenId)?.instanzId ?? null,
        rot: false
      })
      dieseRunde.add(kartenId)

      // Treffer-Vorprüfung (G3) — rein rechnerisch, ohne einen Prozess zu
      // starten: Gäbe es hier nichts zu tun, endete der Lauf mit Exit 0 und
      // FlowForge hielte das für Grün.
      const dateien = dateinamenUnter(kartenPfad(projektPfad, kartenId))
      if (!trefferVorpruefung(dateien, musterImBefehl(umgeschrieben.befehl, ordner))) {
        const grund = grundText('grundNichtAbspielbar', 'keineDatei')
        abraeumen(projektPfad, kartenId, titel, ausgelegt, dieseRunde, tickern)
        zahlen.nichtAbspielbar++
        notieren(kartenId, titel, 'nichtGemessen', grund, 0)
        tickern(texte.ticker.kartenNichtAbspielbar(titel, grund))
        continue
      }

      const start = Date.now()
      // Eigene Prozessgruppe je Karte, Messpunkt und Block — NIEMALS die
      // Tor-Gruppe: Sonst räumte ein fertiges Kartenspiel den laufenden
      // Prüfbefehl eines anderen Zweigs ab.
      const messung = await befehlAbspielen(projektPfad, umgeschrieben.befehl, {
        zeitlimitMs: KARTE_ZEITLIMIT_MS,
        gruppe: 'pruefkarte:' + projektPfad + ':' + instanzId + ':' + kartenId + ':' + phase,
        abbrechen
      })
      const dauerMs = Date.now() - start
      const { ausgang, grund } = ausgangAusMessung(messung)
      // SOFORT vermerken, auch bei Rot: Die Rotationsmarke ist das einzige
      // Gedächtnis über Läufe hinweg — ein Absturz danach dürfte nicht dazu
      // führen, dass dieselbe Karte ewig als „am längsten nicht dran" gilt.
      // Der Rückgabewert wird ausgewertet: Ließ sich nichts merken, zieht die
      // Rotation beim nächsten Messpunkt wieder dieselben Karten (gemessen:
      // dreimal [1,2] statt [1,2], [3,4], [5,1]), und Georg soll erfahren,
      // warum.
      if (!stempelMessungVermerken(projektPfad, kartenId, { zuletztMs: Date.now(), dauerMs }))
        if (!stempelGemeldet) {
          stempelGemeldet = true
          tickern(texte.ticker.kartenStempelNichtGemerkt(titel))
        }
      schonGelaufen.add(kartenId)

      const ausgabe =
        ausgang === 'rot'
          ? mitteGekuerzt(String(messung.ausgabe ?? '').trim(), KARTE_AUSGABE_MAX).text
          : ausgang === 'nichtGemessen'
            ? grundText('grundNichtGemessen', grund)
            : ''
      notieren(kartenId, titel, ausgang, ausgabe, dauerMs)

      if (ausgang === 'nichtGemessen') {
        zahlen.nichtGemessen++
        tickern(texte.ticker.kartenNichtGemessen(titel, ausgabe))
      } else zahlen.ausgefuehrt++
      if (ausgang === 'rot') {
        zahlen.rot++
        // Der Ordner BLEIBT liegen: Der Prüfer soll hineinsehen und die alte
        // Prüfung anpassen können, wenn sie nur veraltet ist.
        ausgelegt.set(kartenId, {
          instanzId: ausgelegt.get(kartenId)?.instanzId ?? null,
          rot: true
        })
        dieseRunde.delete(kartenId)
        tickern(texte.ticker.kartenRot(titel, was))
      } else {
        abraeumen(projektPfad, kartenId, titel, ausgelegt, dieseRunde, tickern)
      }
    }
  } finally {
    // Bei jedem Abbruch (Stopp, Fehler): Was dieser Messpunkt ausgelegt hat und
    // nicht rot ist, verschwindet wieder — sonst hielte der nächste Block einen
    // Kartenordner für eine Prüfung dieses Laufs.
    for (const kartenId of [...dieseRunde]) {
      const eintrag = ausgelegt.get(kartenId)
      if (eintrag?.rot) continue
      const titel = titelVon.get(kartenId) ?? kartenId
      abraeumen(projektPfad, kartenId, titel, ausgelegt, dieseRunde, tickern)
    }
    // Auch bei einer Ausnahme steht am Ende die Abrechnung — sonst bliebe die
    // Plan-Zeile ohne Gegenstück, und Georg sähe nur, was vorgehabt war.
    ergebnisMelden()
  }
  return fertig()
}

// Den Kartenordner wegräumen und den Verlust benennen, wenn es nicht klappt.
//
// Ein misslungenes Abräumen ist KEIN „nicht abspielbar": Die Prüfung lief
// gerade grün durch (gemessen 22.08.2026 — die Zeile behauptete das Gegenteil).
// Der Eintrag in `ausgelegt` bleibt dann ausdrücklich stehen: Er hält den Ordner
// unter Schutz, damit ihn kein Rückrollen mitnimmt, und der nächste Messpunkt
// versucht es erneut.
function abraeumen(projektPfad, kartenId, titel, ausgelegt, dieseRunde, tickern) {
  const weg = kartenOrdnerAbraeumen(projektPfad, kartenId)
  dieseRunde.delete(kartenId)
  if (weg.ok) {
    ausgelegt.delete(kartenId)
    return
  }
  tickern(texte.ticker.kartenOrdnerBleibtLiegen(titel, weg.fehler))
}
