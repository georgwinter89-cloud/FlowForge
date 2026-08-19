// Lauf-Verwaltung: führt das Workflow-Schaubild eines Projekts über die
// Motor-Schnittstelle aus, reicht Ereignisse an die Oberfläche weiter und
// legt Laufberichte ab (SPEC §3.2, §4, §6).
//
// Parallele Zweige (SPEC §4.1, BAUPLAN 13): Ein Block startet, sobald alle
// seine Vorgänger fertig sind. Mehrere nur-lesende Blöcke dürfen immer
// gleichzeitig laufen; Schreiber seit BAUPLAN 46 als WELLE, wenn ihre
// Dateilisten aus dem Datenvertrag getrennt sind (wellenStartRegel, SPEC §5) —
// ein Block mit mehreren Vorgängern führt die Zweige zusammen, weil er auf
// alle wartet.
//
// Fehlschlag-Rückführung (SPEC §4.1): Meldet ein Prüfer-Block „nicht bestanden",
// laufen die Blöcke zwischen Ziel und Prüfer erneut — so oft, wie Reparatur-
// Runden eingestellt sind. Danach stellt der Lauf die Folgen-Frage für DIESEN
// Zweig (weitermachen, zurückstellen oder Stand wiederherstellen); andere
// Zweige laufen derweil weiter (BAUPLAN 46).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { BrowserWindow, Notification } from 'electron'
import { texte } from '../shared/texte.js'
import {
  blockDefinition,
  blockDenktiefe,
  blockModellKlasse,
  blockAnzeigeName,
  klasseHatKostenHinweis,
  klasseIstLokal,
  pruefOrdnerFuer,
  zusatznameBereinigen,
  sdkModell,
  unterModellFuer,
  DENKTIEFE_STANDARD,
  UEBERTRAG_GRENZE_STANDARD,
  PRUEFBELEG_ETIKETT
} from '../shared/blockKatalog.js'
import {
  pruefeSchaubild,
  pruefeVersorgung,
  schaubildReihenfolge,
  pruefePflichtfelder,
  auftragMitFeldern,
  vorfahrenSortiert,
  vorfahrenDistanzen,
  uebergabenAuswahl,
  vorspannText,
  vorspannZeile,
  rueckfuehrungsZiel,
  schaubildHinweise,
  zwischenBloecke,
  budgetNehmen,
  budgetAusStand,
  laufstandPasst,
  zielListe,
  zielAdresse,
  zuschnittAuftragZusatz,
  zuschnittRouting,
  ARBEITSPAKET_ETIKETT
} from '../shared/kettenRegeln.js'
import { prueferKritik, mitteGekuerzt } from '../shared/kantenRegeln.js'
import {
  werkzeugeFuerKette,
  werkzeugeFuerBlock,
  meldungVollstaendig,
  fehlendeLieferungen,
  lieferscheinText,
  urteilAusMeldungen,
  beanstandungenAusMeldungen,
  beanstandungenEinstufen,
  grundsaetzlicheBeanstandungen,
  pruefkarteAusMeldungen,
  zuschnitteAusMeldung,
  zuschnitteAusMeldungen,
  zuschnittSchluessel,
  zuschnittDeckung,
  dateiListeVereinigen,
  dateilistenUeberschneidung,
  RAHMEN_WERKZEUG
} from '../shared/lieferschein.js'
import { fehlerZeilen, neueFehler } from '../shared/torRegeln.js'
import { diffTextBauen, diffBilanz } from '../shared/laufDiff.js'
import { einstellungenLaden, motorBereit } from './einstellungen.js'
import {
  kartenLaden,
  kontingentVerhaltenLaden,
  pruefkarteAnlegen,
  karteAnlegen,
  karteAendern,
  karteErledigtSetzen,
  karteLoeschen,
  karteThemaSetzen
} from './projekte.js'
import { vorhandeneThemen } from '../shared/kartenRegeln.js'
import {
  pruefkartenOrdner,
  pruefkarteEinlegen,
  pruefkartenArchivHatDateien,
  pruefkartenArchivAuffrischen,
  pruefungenArchivieren
} from './pruefkarten.js'
import { starteLaufMotor } from './motor/claudeCodeMotor.js'
import { lokalesModellBereitstellen } from './motor/lokalesModell.js'
import {
  lokaleHelferPruefen,
  lokaleHelferKontextSetzen,
  lokalReparieren,
  LOKALE_REPARATUR_VERSUCHE
} from './motor/lokaleHelfer.js'
import {
  KONTEXT_FENSTER_STANDARD,
  FORTSETZUNG_WAECHTER_PROZENT
} from './motor/schnittstelle.js'
import { startanleitungVorhanden, startanleitungLaden } from './startanleitung.js'
import {
  pruefbefehlLaden,
  pruefbefehlVorhanden,
  pruefbefehlLeeren,
  pruefbefehlArchivieren,
  pruefbefehlArchivLaden
} from './pruefbefehl.js'
import { befehlAbspielen, rauchtest } from './torProzess.js'
import { kartenZeile } from './motor/kartenWerkzeuge.js'
import {
  sicherungspunktAnlegen,
  aufLetztenPunktZuruecksetzen,
  wiederherstellen,
  wiederherstellenBereich,
  letzterPunktId,
  standWeichtAb,
  punkteVergleichen,
  strangOeffnen,
  strangZusammenfuehren,
  straengeAufraeumen,
  sicherungspunkteLaden
} from './sicherungspunkte.js'
import { workflowLaden } from './workflow.js'
import { laufstandSpeichern, laufstandLaden, laufstandLoeschen } from './laufstand.js'
import { laufVorschlagSpeichern, laufVorschlagLoeschen } from './naechsterLauf.js'
import { kartenZuteilungPruefen, paketMeldungPruefen } from './motor/kartenZuteilungWerkzeuge.js'
import { chatBeschaeftigt, chatLaufBeginnt, laufZustandQuelleSetzen } from './chat.js'
import { metrikUrteilSchreiben } from './metriken.js'
import { prozessgruppeAnlegen, prozessgruppeAbraeumen } from './prozesse.js'

const BERICHTE_ORDNER = 'laufberichte'
const PRUEFMAPPE = 'pruefung'

// ——— Wirkbereich je Block-Instanz (BAUPLAN 45) ————————————————————————————
// „Welche Dateien gehören diesem Schreiber?" — die eine Antwort, aus der
// Punkt-Strang, gefilterter Rollback und gefilterter Diff gerechnet werden:
//   Prüfer          → sein eigener Prüfordner (je Instanz seit BAUPLAN 41). Er
//                     bekommt per Definition keine Dateiliste; sein Ordner IST
//                     sein Vertrag.
//   Umsetzer        → die Dateiliste aus dem Datenvertrag (BAUPLAN 44).
//   alles andere    → null (nur-lesend, Schreiber ohne Arbeitspaket, alter
//                     Laufstand). null heißt: kein Strang, kein Filter, exakt
//                     das Verhalten von vor Bauschritt 45 — und genau das steht
//                     dann auch im Ticker, damit niemand eine Trennung annimmt,
//                     die es nicht gibt.
// Reine Rechnung und exportiert, damit sich die Regel ohne laufenden Lauf
// prüfen lässt.
export function wirkbereichVon(def, pruefOrdner, dateiListe) {
  if (def?.prueft) return pruefOrdner ? [PRUEFMAPPE + '/' + pruefOrdner + '/'] : null
  if (def?.nurLesen) return null
  return dateiListe?.length ? [...dateiListe] : null
}

// Womit der Änderungs-Überblick gefiltert wird (BAUPLAN 45) — mit dem
// Wirkbereich, aber NUR beim Umsetzer. Der Wirkbereich eines Prüfers ist seine
// Prüfmappe, und die ist im Diff ohnehin ausgeschlossen (BAUPLAN 34: Seine
// eigenen Tests sind keine Bauer-Änderung). Filterte man seinen Diff darauf,
// bliebe von „das hat sich seit deinem Urteil geändert" nichts übrig — und der
// Prüfer ginge blind in die Nachprüfung, ohne dass irgendwo etwas rot würde.
export function diffFilterVon(def, wirkbereich) {
  if (def?.prueft) return null
  return wirkbereich?.length ? wirkbereich : null
}

// Was aus einem Punkte-Vergleich in den Auftrag geht (BAUPLAN 45). Eigene
// Rechenstelle, weil der wichtigste Fall genau der unscheinbarste ist: Hat der
// Block in dieser Runde AUSSCHLIESSLICH außerhalb seiner Dateiliste gewirkt
// (ausgeführte Befehle schreiben an der Sperre vorbei, BAUPLAN 44), bleibt nach
// dem Filtern keine einzige Datei übrig. Ein leerer Rückgabewert hieße dann für
// den Agenten „nichts hat sich geändert" — der Hinweis muss auch ohne Diff-Rumpf
// mit, sonst ist der Filter wieder ein stiller Verlust.
export function diffAuftragsText(dateien, ausserhalb, { verschmutzt = false } = {}) {
  const zusatz = ausserhalb > 0 ? texte.agentenUebergabe.diffAusserhalb(ausserhalb) : ''
  if (!dateien?.length) return zusatz
  return diffTextBauen(dateien, { verschmutzt }) + zusatz
}

// Wie der Punkt am Blockende heißt (BAUPLAN 45). Eigene, ausdrücklich geprüfte
// Rechenstelle: Die Beschriftung folgt dem tatsächlichen Ausgang, nicht der
// Absicht — „fertig" nur, wenn der Block auch fertig wurde; ein Prüfer, der
// zurückweist, ist es nicht. Im Rumpf des Ablaufplaners ließe sich diese Zusage
// nur nachlesen, nicht ausführen.
export function blockendeBeschriftung(status, name) {
  return status === 'fertig'
    ? texte.sicherungen.beschriftungNachBlock(name)
    : texte.sicherungen.beschriftungRundeBeendet(name)
}

// Die GESCHÜTZTEN Bereiche eines Blocks: die Wirkbereiche der ANDEREN
// Instanzen des Laufs. Bewusst die Umkehrung (BAUPLAN 45): Den Rollback auf die
// eigene Dateiliste zu beschränken wäre falsch, weil ausgeführte Befehle und der
// Schreibpfad der lokalen KI an der Dateilisten-Sperre vorbeischreiben
// (BAUPLAN 44) — deren Gebastel bliebe sonst liegen und der Agent baute darauf
// weiter. Der Rollback fasst also alles an, nur nicht das Revier der anderen.
//
// Prüfordner zählen IMMER: Dort liegt die aufbewahrte Arbeit eines fremden
// Prüfers, auch wenn er gerade nicht läuft. Die Dateiliste eines Umsetzers zählt
// nur, solange er WIRKLICH gleichzeitig schreibt — sonst schützte sie genau das
// Gebastel, das ein Rollback wegräumen soll. Seit der Welle (BAUPLAN 46) ist
// das der Alltag: `laeuft` liefert der Aufrufer aus schreiberBelegt — es meint
// „arbeitet oder ist fertig, aber noch nicht gemeinsamer Stand" (Nachlauf),
// nicht nur den Motor-Anlauf.
// andere: [{ instanzId, def, pruefOrdner, dateiListe, laeuft }]
export function geschuetzteBereicheVon(eigeneInstanzId, andere) {
  const bereiche = []
  for (const eintrag of andere ?? []) {
    if (eintrag.instanzId === eigeneInstanzId) continue
    if (!eintrag.def?.prueft && !eintrag.laeuft) continue
    bereiche.push(...(wirkbereichVon(eintrag.def, eintrag.pruefOrdner, eintrag.dateiListe) ?? []))
  }
  return [...new Set(bereiche)]
}

// ——— Welle: mehrere Schreiber gleichzeitig (BAUPLAN 46) —————————————————————
// Die Regeln der Welle stehen als reine Rechnungen hier oben, aus demselben
// Grund wie die Nähte der Stränge: Der Ablaufplaner lässt sich in einer
// Prüfung nicht fahren, und eine Zusicherung, die nur den Quelltext abklopft,
// bliebe grün, während zwei Bauer sich still in dieselbe Datei schreiben.
// Ein Knoten hier ist ein einfaches Objekt: { instanzId, name, def: { nurLesen,
// prueft }, status, schreibtGerade, dateiListe }.

// Wer belegt gerade Revier? Ein Schreiber, der läuft (Motor-Anlauf), der im
// Nachlauf steht (fertig gebaut, Rauchtest wartet, Strang noch nicht
// zusammengeführt) oder für den gerade die lokale Vorreparatur schreibt.
// Alle drei sind für Rückroll und Blockende-Punkt der anderen „fremdes Revier".
export function schreiberBelegt(k) {
  if (!k || k.def?.nurLesen) return false
  return k.status === 'laeuft' || k.status === 'nachlauf' || k.schreibtGerade === true
}

// „Bin ich gerade in einer Welle?" — die Frage, die der Motor je Werkzeugaufruf
// stellt (Vertrag F3): Neben mir läuft ein ANDERER Schreiber, oder die lokale
// Vorreparatur schreibt gerade für einen. Der Nachlauf zählt hier NICHT — dort
// schreibt niemand mehr, und die Frage entscheidet nur, ob ein Befehl zur
// Rückfrage wird (SPEC §7).
export function inWelleVon(eigeneInstanzId, knotenListe) {
  return (knotenListe ?? []).some(
    (k) =>
      k &&
      k.instanzId !== eigeneInstanzId &&
      !k.def?.nurLesen &&
      (k.status === 'laeuft' || k.schreibtGerade === true)
  )
}

// „Steht die Welle?" — dann darf der Rauchtest messen (Vertrag F3/F7): kein
// UMSETZER läuft mehr, und keine lokale Vorreparatur schreibt. Prüfer zählen
// nicht: Ein Prüfer läuft ohnehin nie neben einem Umsetzer (wellenStartRegel),
// und ein Prüfer neben einem Prüfer schreibt nur in seine eigene Prüfmappe.
export function welleStehtVon(eigeneInstanzId, knotenListe) {
  return !(knotenListe ?? []).some(
    (k) =>
      k &&
      k.instanzId !== eigeneInstanzId &&
      !k.def?.nurLesen &&
      !k.def?.prueft &&
      (k.status === 'laeuft' || k.schreibtGerade === true)
  )
}

// Die Startregel der Welle (Vertrag F2, SPEC §5): Darf `kandidat` neben den
// gerade laufenden Blöcken starten?
//   nur-lesend                → immer.
//   Prüfer                    → wenn alle laufenden Schreiber Prüfer sind (jeder
//                               hat seine eigene Prüfmappe).
//   Umsetzer                  → wenn alle laufenden Schreiber Umsetzer sind, er
//                               selbst eine Dateiliste (Datenvertrag) hat, jeder
//                               laufende Umsetzer eine hat und sich keine zwei
//                               Listen überschneiden (dateilistenUeberschneidung).
// Umsetzer und Prüfer laufen NIE gleichzeitig: Ein Prüfer, dessen Tests über
// den ganzen Ordner laufen, urteilte sonst über den Halbstand des Nachbarn —
// dieselbe Begründung, mit der Tor und Rauchtest hinter die Welle gehören.
// Ohne Datenvertrag gibt es keine Trennung, also auch keine Welle.
//
// `offeneZweige` (Nacharbeit BAUPLAN 46): [{ name, pfade }] — die Wirkbereiche
// der Zweige, für die gerade eine Folgen-Frage offen ist. „Stand
// wiederherstellen" setzt genau diese Pfade zurück; ein Umsetzer, dessen Liste
// sich damit überschneidet (oder der gar keine hat), darf solange nicht
// hineinschreiben — sonst nähme die Wahl seinen Halbstand still mit, während
// der Ticker „andere Zweige unberührt" sagt (gemessen). grund 'frageOffen'.
//
// Rückgabe: { darf: true } oder { darf: false, grund, worauf: [Namen], … } —
// grund ∈ 'ueberschneidung' (dazu paare: [{a,b}]) | 'ohneVertrag' (dazu
// selbstOhne: fehlt die Liste dem Kandidaten selbst?) | 'prueferWartet' |
// 'umsetzerWartet' | 'frageOffen'. Der Ablaufplaner macht daraus die Ticker-Zeile.
export function wellenStartRegel(kandidat, laufende, offeneZweige = []) {
  if (!kandidat || kandidat.def?.nurLesen) return { darf: true }
  const namen = (liste) => liste.map((l) => l.name ?? l.instanzId ?? '?')
  if (!kandidat.def?.prueft) {
    const belegt = (offeneZweige ?? []).filter(
      (zweig) =>
        zweig?.pfade?.length &&
        (!kandidat.dateiListe?.length ||
          dateilistenUeberschneidung(kandidat.dateiListe, zweig.pfade).ueberschneidet)
    )
    if (belegt.length) return { darf: false, grund: 'frageOffen', worauf: namen(belegt) }
  }
  const schreiber = (laufende ?? []).filter(
    (l) => l && !l.def?.nurLesen && l.instanzId !== kandidat.instanzId
  )
  if (schreiber.length === 0) return { darf: true }
  if (kandidat.def?.prueft) {
    const umsetzer = schreiber.filter((l) => !l.def?.prueft)
    if (umsetzer.length) return { darf: false, grund: 'prueferWartet', worauf: namen(umsetzer) }
    return { darf: true }
  }
  const pruefer = schreiber.filter((l) => l.def?.prueft)
  if (pruefer.length) return { darf: false, grund: 'umsetzerWartet', worauf: namen(pruefer) }
  if (!kandidat.dateiListe?.length)
    return { darf: false, grund: 'ohneVertrag', worauf: namen(schreiber), selbstOhne: true }
  const ohne = schreiber.filter((l) => !l.dateiListe?.length)
  if (ohne.length)
    return { darf: false, grund: 'ohneVertrag', worauf: namen(ohne), selbstOhne: false }
  const worauf = []
  const paare = []
  for (const l of schreiber) {
    const lage = dateilistenUeberschneidung(kandidat.dateiListe, l.dateiListe)
    if (!lage.ueberschneidet) continue
    worauf.push(l.name ?? l.instanzId ?? '?')
    paare.push(...lage.paare)
  }
  if (worauf.length) return { darf: false, grund: 'ueberschneidung', worauf, paare }
  return { darf: true }
}

// Die Startregel der lokalen Klasse (BAUPLAN 51): Darf ein lokaler Kandidat
// starten, oder sind alle Adressen des Ollama-Pools belegt? Eine Adresse hält
// genau, wer gerade läuft (status 'laeuft') UND eine Zuteilung trägt.
//
// AUSDRÜCKLICH NICHT schreiberBelegt: Die Welle zählt Revier-Belegung
// inklusive Nachlauf und schreibtGerade — richtig für Dateilisten, falsch für
// GPUs. Im Nachlauf ist der Motor eines lokalen Blocks längst beendet
// (blockAusfuehren-finally), Ollama ist frei; zählte der Nachlauf mit,
// serialisierte die Regel lokale Blöcke grundlos — bei einer Adresse wäre das
// die stille Rücknahme des heutigen Verhaltens, bei zweien fräße es genau die
// Parallelität, die der Schritt verspricht.
//
// Die Freiheit ist ABGELEITET statt verwaltet: frei = adressenAnzahl minus
// Halter. Jeder Ausgang eines Blocks (fertig, Nachlauf, offen, Abbruch,
// wartet-entscheidung) wechselt den Status — damit kann keine Adresse lecken.
// Rückgabe: { darf: true } oder { darf: false, grund: 'lokalBelegt',
// worauf: [Namen ALLER Halter], anzahl } — worauf ist nie leer, solange
// belegt ist (warteGrundMelden verschluckt leere Listen).
export function lokaleStartRegel(kandidat, laufende, adressenAnzahl) {
  const halter = (laufende ?? []).filter(
    (nk) => nk && nk !== kandidat && nk.status === 'laeuft' && nk.lokalZuteilung
  )
  if (halter.length < adressenAnzahl) return { darf: true }
  return {
    darf: false,
    grund: 'lokalBelegt',
    worauf: halter.map((nk) => nk.name ?? nk.instanzId ?? '?'),
    anzahl: adressenAnzahl
  }
}

// Die Adressliste der lokalen KI (BAUPLAN 51, Vertrag V1): einstellungenLaden
// garantiert `lokaleHelferAdressen` als nicht-leeres Array bereinigter
// Adressen, Element 0 ist die alte Einzeladresse. Der Rückfall aufs alte
// Einzelfeld deckt ältere gemockte Einstellungs-Ketten in pruefungen/ ab —
// im echten Betrieb greift er nie.
function lokaleAdressenVon(einstellungen) {
  const liste = Array.isArray(einstellungen?.lokaleHelferAdressen)
    ? einstellungen.lokaleHelferAdressen.filter((a) => typeof a === 'string' && a.trim())
    : []
  return liste.length ? liste : [einstellungen?.lokaleHelferAdresse]
}

// Der Ausgang eines Laufs, dessen Planer-Schleife zu Ende ist und dem noch kein
// Ausgang zugewiesen wurde (Fehlschlag, Kontingent, harter Stopp setzen ihn
// früher). Seit der Folgen-Frage je Zweig (BAUPLAN 46) kann ein Lauf zu Ende
// laufen, obwohl ein Zweig zurückgestellt oder wiederhergestellt wurde — die
// Rangfolge: wiederhergestellt > zurückgestellt > erfolgreich (alle fertig)
// > sanft gestoppt > fehlgeschlagen.
export function endzustandAus(knotenListe, { sanft = false } = {}) {
  const liste = knotenListe ?? []
  if (liste.some((k) => k?.status === 'wiederhergestellt')) return 'wiederhergestellt'
  if (liste.some((k) => k?.status === 'zurueckgestellt')) return 'zurueckgestellt'
  if (liste.every((k) => k?.status === 'fertig')) return 'erfolgreich'
  return sanft ? 'sanft-gestoppt' : 'fehlgeschlagen'
}

// Die drei Nähte, an denen die Stränge am Lauf hängen (BAUPLAN 45). Sie stehen
// als eigene, exportierte Stellen hier oben und nicht im Rumpf des
// Ablaufplaners — und das ist keine Ordnungsliebe: Der Rumpf braucht Fenster,
// Schaubild und laufende Motoren, ausführen lässt er sich in einer Prüfung
// nicht. Eine Zusicherung, die stattdessen nur den Quelltext abklopft, bleibt
// grün, während der Ticker eine Trennung behauptet, die es gar nicht gibt —
// genau die Lage, die dieser Bauschritt verhindern soll. Hier greift eine
// Prüfung die echten Sicherungspunkte ab und liest denselben Ticker wie Georg.
//
// `k` ist der Knoten des Laufs; er wird an Ort und Stelle fortgeschrieben
// (k.wirkbereich, k.strang, k.strangGemeldet), genau wie im Ablaufplaner.

// Kennt der gemeinsame Stand die Spitze dieses Strangs schon? Dann hält der
// Strang nichts mehr fest, was verlorengehen könnte — er ist ein
// liegengebliebener Zeiger, genau wie die Stränge, die straengeAufraeumen beim
// Laufstart wegräumt. Gemessen an der Liste, die Georg sieht: Sie wandert von
// 'haupt' aus über ALLE Elternpfade, Zusammenführungen eingeschlossen — steht
// die Spitze darin, ist sie eingeholt.
//
// Im Zweifel „nicht eingeholt": Ein Strang zu viel kostet nichts, ein
// abgeschnittener Rückroll-Punkt ist verlorene Arbeit.
export async function strangEingeholt(projektPfad, strang) {
  if (!strang) return true
  const spitze = await letzterPunktId(projektPfad, strang)
  if (!spitze) return true
  if (spitze === (await letzterPunktId(projektPfad))) return true
  const liste = await sicherungspunkteLaden(projektPfad)
  return liste.punkte.some((punkt) => punkt.id === spitze)
}

// Ein Schreiber mit Wirkbereich bekommt seinen eigenen Strang; alle seine
// Sicherungspunkte laufen darauf, Rückroll und Änderungs-Überblick werten nur
// ihn aus. Der Zweigname trägt NUR die Instanz-Kennung — der Zusatzname
// (BAUPLAN 41) ist ein freies Feld („Bauer · Datenbank") und ergäbe keine
// gültige Referenz; er steht in der Beschriftung des Punkts.
//
// Der Strang endet am Blockende — mit EINER Ausnahme: Schickt eine lokale
// Vorreparatur ihren Prüfer sofort in die Nachprüfung, bleibt er über das
// Blockende hinweg offen (k.strangOffenHalten), weil sein Ankerpunkt das Ziel
// des Rückrolls ist, den die Nachprüfung womöglich auslöst. Dadurch können
// mehrere Stränge gleichzeitig offen liegen: Ein wartender Prüfer belegt den
// Schreiber-Platz nicht, ein anderer Block fährt inzwischen seine Runde. Das ist
// zulässig, weil ein Strang nur ein Zeiger ist und der Projektordner die
// Wahrheit bleibt. Entsprechend können nach einem Absturz auch mehrere Stränge
// liegenbleiben — straengeAufraeumen holt beim nächsten Laufstart jeden davon
// ein und sagt es im Ticker.
export async function strangOeffnenAn(projektPfad, k, { instanzId, bezeichnung, dateiListe, tickern }) {
  // Je Anlauf frisch: Zwischen zwei Runden kann eine Lieferung angekommen sein,
  // die den Datenvertrag erst füllt.
  k.wirkbereich = wirkbereichVon(k.def, k.pruefOrdner, dateiListe)
  // Die Bitte „lass meinen Strang über das Blockende hinaus offen" gilt immer
  // nur für den EINEN Anlauf, der sie gestellt hat. Ein neuer Anlauf beginnt
  // hier — ab jetzt endet der Strang wieder ganz normal am Blockende. Für DIESES
  // Öffnen zählt sie aber noch: Sie ist der Grund, warum der Strang überhaupt
  // noch dasteht.
  const wartete = k.strangOffenHalten === true
  k.strangOffenHalten = false
  if (k.def?.nurLesen) return k.strang ?? null
  // Ein Strang, der aus dem vorigen Anlauf desselben Blocks noch offen liegt,
  // wird NICHT neu geöffnet: strangOeffnen setzt den Zweig mit force auf den
  // gemeinsamen Stand — und schnitte damit genau den Rückroll-Punkt ab, den
  // dieser Anlauf noch braucht (die gescheiterte Nachprüfung nach lokaler
  // Vorreparatur rollt auf ihn zurück).
  //
  // Das gilt ausdrücklich AUCH, wenn der Strang gar keinen eigenen Punkt trägt
  // und deshalb als eingeholt gilt: Hat der Prüfer in seinem Anlauf nichts
  // geschrieben, entsteht kein neuer Ankerpunkt, der Strang zeigt auf den
  // gemeinsamen Stand von damals — und sobald ein anderer Block danach
  // zusammenführt, sieht er aus wie ein liegengebliebener Zeiger. Neu angesetzt
  // stünde er dann auf der Spitze MIT dem Gebastel, und der Rückroll fände
  // nichts mehr zurückzunehmen. Gemessen genau so. Stehengelassen greift
  // stattdessen die Bremse für den überholten Anker: Zurückgenommen wird nur der
  // eigene Wirkbereich, die fertige Arbeit des anderen Blocks bleibt, und der
  // Ticker sagt beides.
  //
  // Nur ein Strang, den KEIN wartender Anlauf mehr braucht (sein Zusammenführen
  // ist gescheitert) und den der gemeinsame Stand längst eingeholt hat, wird neu
  // angesetzt — dieselbe Lage, die straengeAufraeumen beim Laufstart wegräumt.
  // Sonst läse der Änderungs-Überblick dieses Blocks „bis" von einem überholten
  // Punkt, und ein Rückroll nähme die inzwischen zusammengeführte Arbeit fremder
  // Blöcke mit.
  if (k.strang && (wartete || !(await strangEingeholt(projektPfad, k.strang)))) return k.strang
  // Die Ticker-Zeile kommt einmal je Block, nicht in jeder Reparatur-Runde
  // erneut — wie bei der Dateilisten-Zeile. Gemerkt wird aber, WAS gemeldet
  // wurde: Trägt eine Lieferung den Datenvertrag erst in einer späteren Runde
  // nach, kippt die Lage, und das gehört gesagt.
  function melden(lage, text) {
    if (k.strangGemeldet === lage) return
    k.strangGemeldet = lage
    tickern(text)
  }
  if (!k.wirkbereich) {
    // Verschwindet der Datenvertrag in einer späteren Runde wieder, bleibt ein
    // schon offener Strang stehen — er ist ein Zeiger, kein Zustand, und den
    // Block jetzt mitten im Lauf ohne Trennung weiterlaufen zu lassen brächte
    // niemandem etwas.
    if (k.strang) return k.strang
    melden('ohne', texte.ticker.strangOhneWirkbereich(bezeichnung))
    return null
  }
  const strang = 'strang/' + instanzId
  const geoeffnet = await strangOeffnen(projektPfad, strang)
  // Klemmt das Öffnen, läuft der Block ohne Trennung weiter — wie vor
  // Bauschritt 45. Das wird GESAGT: Ein stummer Fehlschlag wäre genau die
  // Annahme einer Trennung, die es nicht gibt. Der nächste Anlauf versucht es
  // erneut; 'ohne' als gemeldete Lage lässt die Zeile dann wieder zu, sobald
  // es klappt. Klemmt dagegen das NEU-Ansetzen eines eingeholten Strangs,
  // bleibt der alte in Gebrauch: Er ist eingeholt, also verliert er nichts.
  if (!geoeffnet.ok) {
    if (k.strang) return k.strang
    melden('ohne', texte.ticker.strangNichtGeoeffnet(bezeichnung))
    return null
  }
  k.strang = strang
  melden('mit', texte.ticker.strangGeoeffnet(bezeichnung))
  return strang
}

// Zusammenführung am Blockende: EIN Punkt auf dem gemeinsamen Stand, der den
// Strang einholt. Dieser Punkt IST der Punkt des Blocks — deshalb trägt er
// dessen Beschriftung, und deshalb legt der Fertig-Zweig im Ablaufplaner keinen
// zweiten mehr an: Beide hielten denselben Ordnerstand, und Georgs
// Wiederherstellen-Liste wäre je Lauf doppelt so lang, ohne dass es zwischen
// den Paaren etwas zu wählen gäbe. Die Beschriftung folgt dem tatsächlichen
// Ausgang — ein Prüfer, der zurückweist, ist nicht „fertig".
//
// Getickert wird nur, wenn der Block wirklich fertig ist — die stillen
// Zusammenführungen zwischen zwei Reparatur-Runden sind Buchführung und würden
// den Ticker zuschütten. Ein FEHLSCHLAG dagegen wird immer gesagt: Solange der
// Strang nicht eingeholt ist, hängen seine Punkte am gemeinsamen Stand vorbei.
//
// EINE Ausnahme hält den Strang über das Blockende hinweg offen: die
// unmittelbar folgende Nachprüfung einer lokalen Vorreparatur (k.strangOffenHalten).
// Zusammenführen heißt, den jetzigen Arbeitsordner als neue gemeinsame Spitze
// einzufrieren. Steht darin gerade das Gebastel der lokalen KI, wäre genau das
// ab sofort „der Stand vor der Reparatur" — der Rückroll der gescheiterten
// Nachprüfung fände nichts mehr zurückzunehmen und meldete es nicht einmal.
// Gemessen genau so, bevor diese Bedingung dazukam.
//
// Warum die Ausnahme so eng ist und nicht schlicht am Status 'offen' hängt:
// Jeder ANDERE Weg zurück auf 'offen' (Reparatur-Runde, Nachforderung) beginnt
// einen wirklich neuen Anlauf, und an dessen Startpunkt steht der Arbeitsordner
// auf einem Stand, der eingefroren werden DARF — bei der Eskalation ist das
// genau der Ankerpunkt, auf den eben zurückgerollt wurde. Bliebe der Strang
// auch dort liegen, zeigte er in den nächsten Anlauf hinein auf einen Punkt aus
// dem Anlauf davor: Der Änderungs-Überblick des Prüfers läse beide Enden auf
// demselben Punkt und fiele lautlos auf leer, und ein Rückroll (harter Stopp)
// zielte auf einen Stand, der die inzwischen fertige Arbeit anderer Blöcke gar
// nicht kennt. Beides gemessen, bevor die Ausnahme eng gefasst wurde.
//
// Seit der Welle (BAUPLAN 46) bleibt der Strang außerdem offen, solange der
// Block im NACHLAUF steht (fertig gebaut, der Rauchtest wartet, bis die Welle
// steht) oder auf die Folgen-Frage seines Zweigs wartet: Sein Anlauf ist dann
// noch nicht zu Ende — erst wenn er wirklich 'fertig' wird, entsteht der Punkt
// „Nach Block X". So haben Fertig-Meldung, Punkt und der Laufstand (fertigIds)
// dieselbe Körnung (Vertrag F6): Nach einem Absturz gilt kein Block als fertig,
// dessen Arbeit noch nicht gemeinsamer Stand war.
//
// `ausgenommen` (Vertrag F6/S3) sind die Wirkbereiche der anderen, gerade noch
// laufenden bzw. noch nicht zusammengeführten Schreiber: Für sie nimmt der
// Punkt nicht den Arbeitsordner, sondern den Stand der Basis — „Nach Block A"
// enthält genau A's Arbeit, nicht den Halbstand von B.
//
// `endgueltig` ist das Sicherheitsnetz am Laufende: Dort wird ALLES geschlossen,
// auch was noch auf 'offen' steht — dann läuft nichts mehr nach, und ein
// liegengebliebener Strang wäre beim nächsten Laufstart nur noch Aufräumarbeit.
export async function strangSchliessenAn(
  projektPfad,
  k,
  { bezeichnung, tickern, endgueltig = false, ausgenommen = [] }
) {
  if (!k.strang) return true
  if (!endgueltig && k.strangOffenHalten) return true
  if (!endgueltig && (k.status === 'nachlauf' || k.status === 'wartet-entscheidung')) return true
  const ergebnis = await strangZusammenfuehren(
    projektPfad,
    k.strang,
    blockendeBeschriftung(k.status, k.name),
    { ausgenommen: ausgenommen ?? [] }
  )
  // Erst NACH dem Gelingen vergessen: Bliebe der Strang hier auch im Fehlerfall
  // los, öffnete der nächste Anlauf denselben Namen neu (mit force) und
  // schnitte genau die Arbeit ab, die der Strang festhalten sollte — und das
  // Sicherheitsnetz am Laufende versuchte es nie erneut.
  if (!ergebnis.ok) {
    tickern(texte.ticker.strangNichtZusammengefuehrt(bezeichnung))
    return false
  }
  k.strang = null
  if (k.status === 'fertig') tickern(texte.ticker.strangZusammengefuehrt(bezeichnung))
  return true
}

// Ein Rückroll und seine ehrlichen Folgen an einer Stelle: Der Rückgabewert
// wurde bis Bauschritt 45 an drei Stellen weggeworfen — der Ticker meldete
// „zurückgerollt", auch wenn nichts zurückging.
//
// `nichtsMelden` schaltet den Gegenzweig zum Erfolgs-Satz frei: Ein Rückroll,
// der NICHTS zurückgenommen hat, blieb für Georg still — der Ticker sprang
// wortlos zur nächsten Zeile, während der Agent den Hinweis sehr wohl bekam.
// Die Entscheidung kommt bewusst vom Aufrufer: Am harten Stopp ist „nichts
// zurückzunehmen" der Normalfall (der Ordner steht schon auf dem Punkt), und die
// Zeile wäre dort unerwünscht laut.
//
// WELCHER der beiden Sätze fällt, entscheidet sich dagegen hier — nur hier sind
// die Zahlen bekannt. `zurueckgesetzt: false` meint zwei sehr verschiedene
// Lagen: „es war wirklich nichts zu tun" und „es gab etwas, es blieb aber alles
// stehen" (fremdes Revier, überholter Anker). Gemessen, bevor das getrennt
// wurde: Der Ticker versprach einen Ordner, der „schon genau auf dem
// Sicherungspunkt" stehe, und sagte in der Zeile darunter, was liegengeblieben
// ist. Maßstab ist bewusst die Zahl der übersprungenen Dateien und nicht
// `standUeberholt` allein: Ein überholter Anker, bei dem gar nichts zu tun war,
// überspringt nichts — dort wäre „liegengeblieben" genauso falsch herum.
//
// `eigenerBereich` ist die ehrliche Grenze dieses Rückrolls (Nacharbeit zu
// BAUPLAN 45): der Wirkbereich des Blocks, dessen Arbeit hier fällt. Er greift
// NUR, wenn der Rückroll-Punkt inzwischen überholt ist — wenn also ein ANDERER
// Block seit diesem Punkt seine fertige Runde zusammengeführt hat. Dann nähme
// ein voller Rückroll dessen Arbeit mit aus dem Projektordner, obwohl sie
// fertig und abgenommen ist; zurückgenommen wird deshalb nur noch, was
// FlowForge dem betroffenen Block selbst zuordnen kann. Was dabei stehenbleibt,
// sagt der Ticker — stumm wäre es genau der Verlust, den dieser Bauschritt
// abschafft. Gemessen genau so, bevor die Grenze dazukam: Die Datei des
// zweiten Bauers stand wieder auf ihrem Ausgangsstand, während ihr
// Sicherungspunkt weiter in Georgs Liste stand und kein Wort davon fiel.
export async function zurueckrollenAn(
  projektPfad,
  { strang, geschuetzt, eigenerBereich, erfolgsText, nichtsMelden = false, tickern }
) {
  const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad, {
    strang: strang ?? null,
    geschuetzt: geschuetzt ?? [],
    eigenerBereich: eigenerBereich ?? null
  })
  if (!zurueck.ok) {
    tickern(texte.ticker.rollbackGescheitert)
    return zurueck
  }
  if (zurueck.zurueckgesetzt === false) {
    if (nichtsMelden)
      tickern(
        (zurueck.geschuetztUebersprungen ?? 0) + (zurueck.fremdUebersprungen ?? 0) > 0
          ? texte.ticker.rollbackNichtsAngefasst
          : texte.ticker.rollbackNichtsZurueckgenommen
      )
  } else if (erfolgsText) tickern(erfolgsText)
  if (zurueck.geschuetztUebersprungen > 0)
    tickern(texte.ticker.rollbackGeschuetzt(zurueck.geschuetztUebersprungen))
  if (zurueck.standUeberholt && zurueck.fremdUebersprungen > 0)
    tickern(texte.ticker.rollbackStandUeberholt(zurueck.fremdUebersprungen))
  return zurueck
}

// Welcher Block ist beim harten Stopp wirklich mitten im Anlauf abgebrochen?
// (Nacharbeit zu BAUPLAN 45) Der Status taugt dafür allein nicht mehr: Ein
// abgebrochener Block steht danach auf 'offen' — und ein Prüfer, der auf seine
// Nachprüfung wartet, ebenfalls. Wer in der Liste zuerst steht, entschied dann
// über den Rückroll, und das konnte der Falsche sein. Deshalb merkt sich der
// Ablaufplaner den Abbruch am Knoten und fragt hier danach.
//
// Kein Treffer (Abbruch, bevor überhaupt ein Block lief): die alte Rechnung —
// der erste, der nicht fertig wurde.
export function hartAbgebrochenerBlock(knotenListe) {
  const liste = knotenListe ?? []
  return (
    liste.find((k) => k?.hartAbgebrochen && k.strang) ??
    liste.find((k) => k?.hartAbgebrochen) ??
    liste.find((k) => k?.status !== 'fertig') ??
    null
  )
}

// Seit der Welle (BAUPLAN 46) können MEHRERE Blöcke mitten im Anlauf abbrechen.
// Alle Abgebrochenen, in Kettenreihenfolge; ohne Vermerk der eine aus der
// alten Rechnung.
export function hartAbgebrocheneBloecke(knotenListe) {
  const liste = knotenListe ?? []
  const abgebrochen = liste.filter((k) => k?.hartAbgebrochen)
  if (abgebrochen.length) return abgebrochen
  const einer = hartAbgebrochenerBlock(liste)
  return einer ? [einer] : []
}

// Der zentrale Rückroll des harten Stopps (SPEC §6) als eigene, ausführbare
// Stelle — im Rumpf des Ablaufplaners ließe sich nur nachlesen, worauf er zielt.
//
// Der Maßstab ist der Strang des ABGEBROCHENEN Blocks — nie der eines fremden.
// Ein fremder offener Strang gehört zu einem Anlauf, der hier gar nicht
// abbricht; vorher lieh sich der harte Stopp den erstbesten und rollte damit auf
// einen Punkt zurück, der die fertige Arbeit anderer Blöcke nicht kennt.
// Zeigt der eigene Strang auf einen überholten Punkt, bremst die Grenze in
// zurueckrollenAn: Zurückgenommen wird dann nur noch der eigene Wirkbereich,
// und der Ticker sagt, was stehenblieb. Die Wirkbereiche der anderen Instanzen
// bleiben ohnehin unangetastet.
//
// Mehrere Abgebrochene (Welle, BAUPLAN 46, Vertrag F9): jeder wird der Reihe
// nach auf SEINEM Strang zurückgerollt — sein eigener Wirkbereich als
// Notbremse für den überholten Anker, die Wirkbereiche der übrigen
// Abgebrochenen zusätzlich zu den fremden Revieren geschützt. Ehrliche Grenze:
// Was außerhalb aller Wirkbereiche liegt (Befehle schreiben an der Dateiliste
// vorbei), landet auf dem Stand des zuletzt zurückgerollten Strangs — der
// Unterbau kann „nur den eigenen Bereich" nicht erzwingen, solange der Anker
// nicht überholt ist (siehe aufLetztenPunktZuruecksetzen).
export async function hartZurueckrollenAn(projektPfad, { knotenListe, geschuetztFuer, tickern }) {
  const abgebrochene = hartAbgebrocheneBloecke(knotenListe)
  if (abgebrochene.length <= 1) {
    const abgebrochen = abgebrochene[0] ?? null
    return zurueckrollenAn(projektPfad, {
      strang: abgebrochen?.strang ?? null,
      geschuetzt: geschuetztFuer(abgebrochen),
      eigenerBereich: abgebrochen?.wirkbereich ?? null,
      erfolgsText: texte.ticker.zurueckgesetzt,
      tickern
    })
  }
  let letztes = null
  for (const k of abgebrochene) {
    const uebrige = abgebrochene
      .filter((anderer) => anderer !== k)
      .flatMap((anderer) => anderer.wirkbereich ?? [])
    letztes = await zurueckrollenAn(projektPfad, {
      strang: k.strang ?? null,
      geschuetzt: [...new Set([...(geschuetztFuer(k) ?? []), ...uebrige])],
      eigenerBereich: k.wirkbereich ?? null,
      erfolgsText: texte.ticker.zurueckgesetztBlock(k.name),
      tickern
    })
    if (!letztes.ok) return letztes
  }
  return letztes
}

// Was der Laufstart mit den Strängen macht, die ein Absturz hinterlassen hat
// (BAUPLAN 45) — genauer: was Georg davon erfährt. Auch das steht als eigene
// Stelle hier, aus demselben Grund wie oben: Der Laufstart selbst lässt sich in
// einer Prüfung nicht fahren, ohne echte Motoren anzuwerfen, und ausgerechnet
// die Fehlerlage (das Aufräumen klemmt) wäre dann nie gemessen.
//
// Drei Ausgänge, drei Zeilen — und keiner davon darf verschwiegen werden:
// weggeräumt wurde, was der gemeinsame Stand längst kennt; eingeholt wurde, was
// er noch nicht kannte (erst damit steht es in Georgs Liste); stehen bleibt nur
// das, wo auch das Einholen geklemmt hat.
export async function straengeMeldenBeimStart(projektPfad, tickern) {
  const aufgeraeumt = await straengeAufraeumen(projektPfad)
  // Die einzige Fehlerlage dieses Bauschritts, die bis zur Nacharbeit stumm
  // blieb: Klemmt das Aufräumen, bleiben die alten Stränge liegen. Für den Lauf
  // folgenlos, aber verschwiegen wäre es ein Bruch mit SPEC §3.3.
  if (!aufgeraeumt.ok) {
    tickern(texte.ticker.straengeNichtAufgeraeumt)
    return aufgeraeumt
  }
  if (aufgeraeumt.entfernt > 0) tickern(texte.ticker.straengeAufgeraeumt(aufgeraeumt.entfernt))
  if (aufgeraeumt.eingeholt > 0) tickern(texte.ticker.straengeGerettet(aufgeraeumt.eingeholt))
  if (aufgeraeumt.behalten > 0) tickern(texte.ticker.straengeBehalten(aufgeraeumt.behalten))
  return aufgeraeumt
}

// Kontingent-Pause (SPEC §5): so lange wartet FlowForge zwischen zwei
// Versuchen, wenn das Abo-Kontingent erschöpft ist.
const KONTINGENT_PAUSE_MS = 10 * 60 * 1000

// Parallelität (SPEC §5, BAUPLAN 12): bis zu 3 Läufe gleichzeitig, aber nur in
// verschiedenen Projekten — pro Projekt höchstens EIN Lauf (innerhalb eines
// Laufs schreiben seit BAUPLAN 46 mehrere Blöcke als Welle, siehe
// wellenStartRegel). Weitere Starts landen in der Warteschlange und laufen
// automatisch an.
const MAX_PARALLEL_LAEUFE = 3
const aktiveLaeufe = new Map() // projektPfad → Lauf
const warteschlange = [] // { fenster, projektPfad, kartenIds, fortsetzen, sonderlauf }

// Sonderläufe (BAUPLAN 30, Entscheidung Georg, 15.08.2026): Die Aufräum-Knöpfe
// der Karten-Seitenleiste starten je einen festen Ein-Block-Workflow im
// Hintergrund — Lauf-Tab, Ticker, Abnahme-Dialog und Sperren wie bei jedem
// Lauf, aber die Leinwand bleibt unangetastet. 'karten-pruefen' = der
// Karten-Prüfer (Einzeldialog je Vorschlag); 'themen-sortieren' = sein
// nur-lesender Sortiermodus (Sammel-Dialog, kein Code-Nachmessen).
export const SONDERLAEUFE = {
  'karten-pruefen': { blockId: 'karten-pruefer' },
  'themen-sortieren': { blockId: 'karten-pruefer', themenSortieren: true }
}

// Die Blockdefinition eines Sonderlaufs: der Katalog-Block, im Sortiermodus
// mit eigenem Namen und Auftrag (Kennzeichen themenSortieren).
function sonderlaufDefinition(sonderlauf) {
  const vorlage = SONDERLAEUFE[sonderlauf?.art]
  if (!vorlage) return null
  const def = blockDefinition(vorlage.blockId)
  if (!def) return null
  if (!vorlage.themenSortieren) return def
  return {
    ...def,
    name: texte.sonderlauf.themenSortierenName,
    auftrag: texte.agentenThemenSortieren.auftrag,
    themenSortieren: true
  }
}

// Ad-hoc-Workflow eines Sonderlaufs: genau ein Block, keine Pfeile, keine
// Reparatur-Runden. Die Instanz-Kennung kommt aus dem Sonderlauf-Objekt —
// eine Wiederaufnahme baut damit denselben Workflow wieder auf.
function sonderlaufWorkflow(sonderlauf) {
  const vorlage = SONDERLAEUFE[sonderlauf.art]
  return {
    reparaturRunden: 0,
    uebertragGrenze: UEBERTRAG_GRENZE_STANDARD,
    bloecke: [
      {
        instanzId: sonderlauf.instanzId,
        blockId: vorlage.blockId,
        zusatz: '',
        feldWerte: {},
        zurueckZu: null,
        lokaleKi: true,
        pruefKarten: [],
        position: { x: 40, y: 40 }
      }
    ],
    pfeile: []
  }
}
// Läufe, die gerade aus der Warteschlange anlaufen, aber noch keinen Eintrag in
// aktiveLaeufe haben — sonst könnten zwei gleichzeitig endende Läufe die
// 3er-Grenze überschießen.
let startendeLaeufe = 0

function plaetzeBelegt() {
  return aktiveLaeufe.size + startendeLaeufe
}

// Aktive Läufe und Warteschlange an alle Fenster melden — daraus speist sich
// der sichtbare Hinweis, dass parallele Läufe den Verbrauch vervielfachen.
function laeufeMelden() {
  const daten = {
    art: 'laeufe',
    aktive: [...aktiveLaeufe.keys()],
    warteschlange: warteschlange.map((eintrag) => eintrag.projektPfad)
  }
  for (const fenster of BrowserWindow.getAllWindows())
    if (!fenster.isDestroyed()) fenster.webContents.send('lauf-ereignis', daten)
}

function inWarteschlangeStellen(fenster, projektPfad, kartenIds, fortsetzen, sonderlauf = null) {
  if (warteschlange.some((eintrag) => eintrag.projektPfad === projektPfad))
    return { ok: false, fehler: texte.lauf.schonInWarteschlange }
  warteschlange.push({ fenster, projektPfad, kartenIds, fortsetzen, sonderlauf })
  laeufeMelden()
  return { ok: true, wartet: true, position: warteschlange.length }
}

// Automatischer Anlauf (SPEC §5): sobald ein Platz frei wird, startet der
// nächste wartende Lauf, dessen Projekt frei ist — von allein.
async function warteschlangeAnstossen() {
  let idx = 0
  while (idx < warteschlange.length) {
    if (plaetzeBelegt() >= MAX_PARALLEL_LAEUFE) break
    const eintrag = warteschlange[idx]
    if (aktiveLaeufe.has(eintrag.projektPfad)) {
      idx++
      continue
    }
    warteschlange.splice(idx, 1)
    startendeLaeufe++
    let ergebnis
    try {
      ergebnis = eintrag.fortsetzen
        ? await laufFortsetzen(eintrag.fenster, eintrag.projektPfad, true)
        : await laufStarten(
            eintrag.fenster,
            eintrag.projektPfad,
            eintrag.kartenIds,
            null,
            true,
            eintrag.sonderlauf
          )
    } catch (fehler) {
      ergebnis = { ok: false, fehler: String(fehler?.message ?? fehler) }
    } finally {
      startendeLaeufe--
    }
    // Klappt der automatische Start nicht (z.B. Schaubild inzwischen leer),
    // erfährt Georg das sichtbar — der Eintrag verschwindet aus der Schlange.
    if (!ergebnis.ok && !eintrag.fenster.isDestroyed())
      eintrag.fenster.webContents.send('lauf-ereignis', {
        projektPfad: eintrag.projektPfad,
        art: 'warteschlange-fehler',
        fehler: ergebnis.fehler
      })
  }
  laeufeMelden()
}

function jetztIso() {
  return new Date().toISOString()
}

function berichtSpeichern(projektPfad, bericht) {
  const ordner = path.join(projektPfad, BERICHTE_ORDNER)
  fs.mkdirSync(ordner, { recursive: true })
  const datei = path.join(ordner, bericht.gestartetAm.replace(/[:.]/g, '-') + '.json')
  const tmp = datei + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(bericht, null, 2), 'utf8')
  fs.renameSync(tmp, datei)
}

export function laufberichteLaden(projektPfad) {
  const ordner = path.join(projektPfad, BERICHTE_ORDNER)
  let dateien = []
  try {
    dateien = fs.readdirSync(ordner).filter((d) => d.endsWith('.json'))
  } catch {
    return { ok: true, berichte: [] }
  }
  const berichte = []
  for (const datei of dateien) {
    try {
      berichte.push(JSON.parse(fs.readFileSync(path.join(ordner, datei), 'utf8')))
    } catch {
      // Kaputte Einzeldatei blockiert nicht die ganze Liste.
    }
  }
  berichte.sort((a, b) => (a.gestartetAm < b.gestartetAm ? 1 : -1))
  return { ok: true, berichte }
}

// Für die Kacheln der Projektübersicht (BAUPLAN 15): nur der jüngste Bericht
// zählt — und nur sein Ausgang. Die Dateinamen sind Zeitstempel, die neueste
// Datei ist also die alphabetisch letzte; so bleibt der Blick billig, auch
// wenn sich viele Berichte angesammelt haben.
function letzterBericht(projektPfad) {
  const ordner = path.join(projektPfad, BERICHTE_ORDNER)
  let dateien = []
  try {
    dateien = fs.readdirSync(ordner).filter((d) => d.endsWith('.json'))
  } catch {
    return null
  }
  if (dateien.length === 0) return null
  dateien.sort()
  try {
    const bericht = JSON.parse(
      fs.readFileSync(path.join(ordner, dateien[dateien.length - 1]), 'utf8')
    )
    return { zustand: bericht.zustand, gestartetAm: bericht.gestartetAm }
  } catch {
    return null
  }
}

// Zustände für die Projektübersicht (SPEC §9, BAUPLAN 15): läuft, wartet auf
// Antwort, wartet in der Warteschlange — und der Ausgang des letzten Laufs.
export function projektZustaende(pfade) {
  const zustaende = {}
  for (const pfad of Array.isArray(pfade) ? pfade : []) {
    if (typeof pfad !== 'string') continue
    const lauf = aktiveLaeufe.get(pfad)
    zustaende[pfad] = {
      laeuft: Boolean(lauf),
      brauchtAntwort: Boolean(
        lauf &&
          (lauf.offeneFragen.length > 0 ||
            lauf.offeneMenschFragen.length > 0 ||
            lauf.offeneVorschlaege.length > 0 ||
            lauf.offeneEntscheidung)
      ),
      wartet: warteschlange.some((eintrag) => eintrag.projektPfad === pfad),
      letzterLauf: letzterBericht(pfad),
      // Für die Hero-Kachel der Projektübersicht (Mockup 3a) — alles
      // null-sicher, ein Lauf ohne diese Felder bleibt gültig.
      workflow: lauf?.bericht?.workflow ?? null,
      letzteZeile: lauf?.bericht?.ticker?.at(-1)?.text ?? null,
      kontext: lauf?.kontext ?? null
    }
  }
  return { ok: true, zustaende }
}

// Prüfer-Urteil (BAUPLAN 42): aus dem gemeldeten Feld statt aus einer
// Marker-Zeile im Fließtext. true = bestanden, false = nicht bestanden,
// null = kein Prüfbeleg gemeldet.

// Alle Meldungen eines Blocks als ein lesbarer Text — für den Laufbericht, die
// Anzeige an der Blockkarte und die Wiederhol-Vorlage in Nachforderungen.
function meldungenText(meldungen) {
  return (meldungen ?? []).map((m) => lieferscheinText(m)).join('\n\n')
}

// Die Lieferungen eines Blocks je Etikett — genau das, was ein Nachfolger mit
// passendem braucht in seinen Auftrag bekommt. Meldungen ohne Etikett (Blöcke,
// die nichts liefern) tauchen hier bewusst nicht auf.
//
// Zuschnitt je Ziel (BAUPLAN 44): Je Etikett steht hier nicht mehr EIN Text,
// sondern ein Text JE ZIEL — Schlüssel ist die instanzId des benannten Ziels,
// '' das Paket ohne Ziel (gilt für alle). Ohne diese Ebene gäbe es keinen Ort,
// an dem stünde, welches Paket für wen ist: Alle Bauer bekämen denselben Text.
// Die Zuordnung steckt IN der Meldung, nicht in einer Nebenstruktur — sonst
// wäre sie nach einer Wiederaufnahme weg.
function lieferungenAusMeldungen(meldungen) {
  const je = {}
  for (const meldung of meldungen ?? []) {
    if (!meldung?.etikett) continue
    const zuschnitte = meldung.art === 'arbeitspaket' ? zuschnitteAusMeldung(meldung) : []
    if (zuschnitte.length === 0) {
      je[meldung.etikett] = { '': lieferscheinText(meldung) }
      continue
    }
    const jeZiel = {}
    for (const paket of zuschnitte)
      jeZiel[zuschnittSchluessel(paket)] = lieferscheinText(meldung, zuschnittSchluessel(paket))
    je[meldung.etikett] = jeZiel
  }
  return je
}

// Neue Meldungen eines Anlaufs über die bisherigen legen: Nach einem Übertrag
// ersetzt die Meldung des Nachfolgers die des unterbrochenen Vorgängers
// (BAUPLAN 42) — je Etikett gewinnt die jüngste.
function meldungenZusammenfuehren(bisher, neue) {
  if (!neue?.length) return bisher
  const zusammen = [...bisher]
  for (const meldung of neue) {
    const idx = zusammen.findIndex(
      (m) => m.etikett === meldung.etikett && m.art === meldung.art
    )
    if (idx >= 0) zusammen[idx] = meldung
    else zusammen.push(meldung)
  }
  return zusammen
}

// Die Begründung des Prüfers geht als Rückmeldung an den Block, zu dem die
// Reparatur-Runde zurückspringt — seit BAUPLAN 34 als vollständige
// Beanstandungs-Zeilen statt als 600-Zeichen-Torso (die Beanstandungen stehen
// laut Prüfer-Auftrag am ENDE des Belegs und fielen darum regelmäßig weg).
// Die Regel selbst steht in kantenRegeln.js und ist einzeln geprüft.

// Kartenvorauswahl (BAUPLAN 7, SPEC §5): Status-Karte immer + die beim Start
// gewählten Karten. Wird vor jedem Block frisch gelesen — der Agent kann Karten
// ja mitten im Lauf ändern.
function kartenKontext(projektPfad, kartenIds) {
  const geladen = kartenLaden(projektPfad)
  if (!geladen.ok) return ''
  const gewaehlt = geladen.karten.filter(
    (k) => k.sorte === 'status' || kartenIds.includes(k.id)
  )
  if (gewaehlt.length === 0) return ''
  // Themen (BAUPLAN 30): Die vorhandenen Themen stehen im Auftrag — bewusst
  // nicht in der Werkzeugbeschreibung (Prompt-Cache).
  return texte.agentenKarten.kontext(
    gewaehlt.map((k) => '- ' + kartenZeile(k)).join('\n'),
    vorhandeneThemen(geladen.karten)
  )
}

// Projektwissen für die lokale KI (BAUPLAN 25): Die Kartenauswahl des Laufs
// (Status-Karte, offene Aufgaben, manuell Gewählte) wird jedem lokalen Auftrag
// vorangestellt. Grund: Die lokale KI kann keine Rückfragen stellen — was der
// Auftrag nicht nennt, existiert für sie nicht; Festlegungen aus
// Entscheidungs-Karten würden sonst übergangen. Bewusst KEIN direkter Blick in
// karten.json (Verwaltungsdatei-Tabu, Halluzinationsgefahr kleiner Modelle).
function projektwissenFuerHelfer(projektPfad, kartenIds) {
  const geladen = kartenLaden(projektPfad)
  if (!geladen.ok) return ''
  const gewaehlt = geladen.karten.filter(
    (k) => k.sorte === 'status' || kartenIds.includes(k.id)
  )
  if (gewaehlt.length === 0) return ''
  return texte.agentenLokaleHelfer.projektwissen(
    gewaehlt.map((k) => '- ' + kartenZeile(k)).join('\n')
  )
}

// Übergaben zwischen Blöcken (SPEC §4.3): Was ein Block „liefert", ist sein
// geprüfter Lieferschein — Nachfahren entlang der Pfeile mit passendem
// „braucht" bekommen ihn vollständig in den Auftrag. Einen Übergabe-Deckel
// (bis 0.46.0: 8.000 Zeichen, in der Mitte gekürzt) gibt es seit 0.46.1 nicht
// mehr (Entscheidung Georg, 18.08.2026): Er riss im Alltag mehrfach knapp und
// kostete Runden. Dasselbe gilt für die Übertrags-Übergabe, die Wiederhol-
// Vorlage und den Nachforderungs-Beleg — alles Übergaben, keine Prozess-Ausgaben.

// Tor ohne KI (BAUPLAN 35): So viel Befehls-Ausgabe geht als Tatsache in einen
// Auftrag — großzügig genug für ein echtes Testprotokoll, klein genug, dass es
// den Kontext des Bauers nicht flutet. Das sind Prozess-Ausgaben, keine
// Übergaben — sie bleiben gedeckelt.
const TOR_PROTOKOLL_MAX = 6000
const BASELINE_MAX = 3000
// So viele Fehlerzeilen werden zu Beanstandungs-Zeilen; der Rest steht im
// Protokoll darunter (sonst wird aus einer kaputten Suite eine Bleiwüste).
const TOR_BEANSTANDUNGEN_MAX = 8
// So lang darf eine Fehlerzeile als Beanstandungs-Zeile werden — eine
// Testausgabe kann eine Zeile mit einem ganzen Stack-Trace füllen; das volle
// Protokoll steht ohnehin daneben.
const TOR_BEANSTANDUNG_ZEILE_MAX = 400

// Hat der Prüfordner dieser Instanz überhaupt Dateien? Ohne sie misst ein
// aufbewahrter Prüfbefehl nichts Sinnvolles (die Baseline bliebe ein
// Scheinbefund). Ohne eigenen Ordner (Übungs-Prüfer) zählt die ganze Mappe.
function pruefmappeHatDateien(projektPfad, pruefOrdner = '') {
  try {
    return (
      fs.readdirSync(path.join(projektPfad, 'pruefung', ...(pruefOrdner ? [pruefOrdner] : [])))
        .length > 0
    )
  } catch {
    return false
  }
}

// fortsetzung (BAUPLAN 11): gespeicherter Laufstand einer Unterbrechung — die
// dort fertigen Blöcke laufen nicht erneut, ihre Lieferungen sind wieder da.
// Kommt nur über laufFortsetzen() herein.
// ausWarteschlange (BAUPLAN 12): Start durch den automatischen Anlauf — dann
// wird bei belegtem Platz nicht erneut eingereiht, sondern ehrlich abgelehnt.
// sonderlauf (BAUPLAN 30): { art, instanzId } — statt des Schaubilds läuft ein
// fester Ein-Block-Workflow (SONDERLAEUFE); die Leinwand bleibt unangetastet.
export async function laufStarten(fenster, projektPfad, kartenIds, fortsetzung = null, ausWarteschlange = false, sonderlauf = null) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  if (sonderlauf && !SONDERLAEUFE[sonderlauf.art])
    return { ok: false, fehler: texte.fehler.unbekannt }
  // Blockdefinition je Block dieses Laufs — bei Sonderläufen ggf. mit
  // eigenem Namen und Auftrag (Sortiermodus des Karten-Prüfers).
  const defVon = (blockId) =>
    sonderlauf && blockId === SONDERLAEUFE[sonderlauf.art].blockId
      ? sonderlaufDefinition(sonderlauf)
      : blockDefinition(blockId)
  // Zusatzname je Blockkarte (BAUPLAN 41): Überall, wo Georg einen Blocknamen
  // liest — Ticker, Aufträge, Übergaben, Laufbericht —, steht der Anzeigename
  // („Prüfer · Datenbank"). Für die Metriken bleibt der Katalogname getrennt
  // erhalten (SPEC §3.4).
  const anzeigeVon = (eintrag) => blockAnzeigeName(defVon(eintrag.blockId), eintrag)
  // Prüfordner je Prüf-Instanz (BAUPLAN 41).
  const ordnerVon = (eintrag) => pruefOrdnerFuer(defVon(eintrag.blockId), eintrag)

  // Ohne ausdrückliche Auswahl gilt die festgenagelte Vorauswahl:
  // Status-Karte (immer) + offene Aufgaben-Karten.
  let ausgewaehlt = Array.isArray(kartenIds) ? kartenIds.filter((id) => typeof id === 'string') : null
  if (!ausgewaehlt) {
    const geladen = kartenLaden(projektPfad)
    ausgewaehlt = geladen.ok
      ? geladen.karten.filter((k) => k.sorte === 'aufgabe' && !k.erledigt).map((k) => k.id)
      : []
  }

  const geladen = sonderlauf
    ? { ok: true, workflow: sonderlaufWorkflow(sonderlauf) }
    : workflowLaden(projektPfad)
  if (!geladen.ok) return geladen
  const workflow = geladen.workflow
  // Schaubild prüfen (SPEC §4.1): kreisfrei, zusammenhängend — die topologische
  // Reihenfolge liefert Nummerierung und Laufordnung.
  const schaubildFehler = pruefeSchaubild(workflow.bloecke, workflow.pfeile)
  if (schaubildFehler) return { ok: false, fehler: schaubildFehler }
  const geordnet = schaubildReihenfolge(workflow.bloecke, workflow.pfeile)
  if (geordnet.fehler) return { ok: false, fehler: geordnet.fehler }
  const kette = geordnet.reihenfolge
  const kettenIds = kette.map((eintrag) => eintrag.instanzId)
  // Beim Start streng: auch der erste Block muss versorgt sein.
  const versorgungsFehler = pruefeVersorgung(workflow.bloecke, workflow.pfeile)
  if (versorgungsFehler) return { ok: false, fehler: versorgungsFehler }
  // Wiederaufnahme nur, wenn das Schaubild noch dasselbe ist wie beim
  // unterbrochenen Lauf — sonst passen Blöcke und Lieferungen nicht mehr.
  // Ein Laufstand aus einer FlowForge-Version vor den parallelen Zweigen
  // (Positions- statt Blockliste) ist ebenfalls nicht fortsetzbar.
  // Seit BAUPLAN 41 gehört auch der Zusatzname dazu (laufstandPasst) — er
  // steckt in Übergaben, Zuteilungen und Berichten des unterbrochenen Laufs.
  if (fortsetzung && !laufstandPasst(kette, workflow.pfeile, fortsetzung)) {
    laufstandLoeschen(projektPfad)
    return { ok: false, fehler: texte.wiederaufnahme.fehlerVeraendert }
  }
  // Sperren-Mechanik „Pflichtfeld leer = Lauf hält an" (SPEC §4.2).
  const feldFehler = pruefePflichtfelder(kette)
  if (feldFehler) return { ok: false, fehler: feldFehler }
  // Auftragsquelle „Feld oder offene Aufgaben-Karten" (Entscheidung Georg,
  // 07.08.2026): Sind Feld und Kartenauswahl leer, wüsste der Block nicht,
  // was gebaut werden soll — der Lauf startet gar nicht erst. Bei einer
  // Wiederaufnahme entfällt die Prüfung: frühere Blöcke sind schon gelaufen,
  // ihre Aufgaben können bereits abgehakt sein.
  for (const eintrag of fortsetzung ? [] : kette) {
    const def = defVon(eintrag.blockId)
    for (const feld of def.felder) {
      if (!feld.oderOffeneAufgaben) continue
      if ((eintrag.feldWerte?.[feld.id] ?? '').trim()) continue
      // Ein Vorfahre, der selbst Aufgaben-Karten erzeugt (Spec-Interview),
      // zählt als Auftragsquelle — bei „Neue App starten" gibt es beim Start
      // noch keine Karten, die Aufgaben entstehen erst im Lauf.
      if (
        vorfahrenSortiert(workflow.bloecke, workflow.pfeile, eintrag.instanzId).some(
          (v) => defVon(v.blockId).erzeugtAufgaben
        )
      )
        continue
      const frisch = kartenLaden(projektPfad)
      const offene = frisch.ok
        ? frisch.karten.filter(
            (k) => ausgewaehlt.includes(k.id) && k.sorte === 'aufgabe' && !k.erledigt
          )
        : []
      if (offene.length === 0)
        return { ok: false, fehler: texte.kette.fehlerAuftragsquelle(anzeigeVon(eintrag), feld.label) }
    }
  }

  const { einstellungen } = einstellungenLaden()
  const bereit = motorBereit(einstellungen)
  if (!bereit.ok) return { ok: false, fehler: bereit.fehler }

  // Lokale Klasse (BAUPLAN 49): Trägt die Kette einen Block der Klasse
  // „lokal", startet der Lauf NUR, wenn die lokale KI eingeschaltet, als
  // Block-Agent erlaubt UND erreichbar ist (mit dem Basis-Modell). Kein
  // stiller Rückfall auf Claude — sonst bezahlt Georg, was er lokal wollte.
  // Geprüft hier, beim Start: Georg sieht den Klartext sofort statt nach
  // einem halben Lauf. Im Lauf selbst wird das abgeleitete Modell angelegt
  // (lokalBereitstellen unten) — auch das endet bei Fehler als Fehlschlag.
  if (kette.some((e) => klasseIstLokal(blockModellKlasse(defVon(e.blockId), e)))) {
    if (!einstellungen.lokaleHelferAktiv || !einstellungen.lokalBlockAgent)
      return { ok: false, fehler: texte.lauf.lokalNichtErlaubt }
    // Adress-Pool (BAUPLAN 51): Es reicht, wenn MINDESTENS EINE Adresse der
    // Liste erreichbar ist und das Basis-Modell vorhält — nicht bereite
    // Adressen klammert der Lauf später sichtbar aus. Parallel geprüft,
    // sonst hinge der Start je toter Adresse im 3-Sekunden-Timeout.
    const adressen = lokaleAdressenVon(einstellungen)
    const stati = await Promise.all(
      adressen.map((adresse) => lokaleHelferPruefen(einstellungen.lokaleHelferModell, adresse))
    )
    if (!stati.some((s) => s.erreichbar && s.modellDa)) {
      if (stati.some((s) => s.erreichbar))
        return { ok: false, fehler: texte.lauf.lokalModellFehlt(einstellungen.lokaleHelferModell) }
      return { ok: false, fehler: texte.lauf.lokalNichtErreichbar(adressen.join(', ')) }
    }
  }

  // Kosten-Rückfrage „Extra (Fable 5)" (0.48.1): Im Abo-Modus kann Fable je
  // nach Abo Guthaben statt Kontingent kosten — über den Motor ohne
  // Einwilligungs-Dialog. Deshalb fragt FlowForge beim ersten Start mit einem
  // Extra-Block selbst einmal nach (Folgen-Frage, Antwort merkbar). Nur beim
  // Start von Hand: Wiederaufnahme, Warteschlange und Sonderläufe sind
  // entweder schon bestätigt oder tragen keine Karten-Wahl. Im API-Modus
  // entfällt sie — dort zahlt ohnehin jeder Block pro Verbrauch.
  if (
    !fortsetzung &&
    !ausWarteschlange &&
    !sonderlauf &&
    einstellungen.motorModus === 'abo' &&
    !einstellungen.extraKostenBestaetigt &&
    kette.some((e) => klasseHatKostenHinweis(blockModellKlasse(defVon(e.blockId), e)))
  )
    return { ok: false, rueckfrage: 'extra-kosten', fehler: texte.lauf.extraRueckfrage }

  // Parallelität (SPEC §5, BAUPLAN 12): Ist das Projekt belegt oder sind alle
  // 3 Plätze vergeben, wartet der Start in der Warteschlange und läuft von
  // allein an. Die Prüfungen oben sind trotzdem schon gelaufen — offensichtliche
  // Fehler (leeres Schaubild, leeres Pflichtfeld) kommen sofort zurück.
  // Ein Start aus der Warteschlange zählt in plaetzeBelegt() schon selbst mit —
  // seine Platz-Prüfung hat der Anstoßer vor dem Herausnehmen gemacht.
  if (aktiveLaeufe.has(projektPfad)) {
    if (ausWarteschlange) return { ok: false, fehler: texte.lauf.schonAktiv }
    return inWarteschlangeStellen(fenster, projektPfad, kartenIds, Boolean(fortsetzung), sonderlauf)
  }
  if (!ausWarteschlange && plaetzeBelegt() >= MAX_PARALLEL_LAEUFE)
    return inWarteschlangeStellen(fenster, projektPfad, kartenIds, Boolean(fortsetzung), sonderlauf)

  // Co-Pilot (BAUPLAN 27/33): Arbeitet der Chat gerade in diesem Projekt,
  // startet kein Lauf — der Chat kennt weder Datenvertrag noch Strang und
  // passt darum in keine Welle (SPEC §5). Ein untätiger
  // Chat bleibt, ist ab jetzt nur lesend und räumt ab, was er gestartet hat;
  // nach dem Lauf hängt er an der neuen Lauf-Session (sichtbare Marke).
  if (chatBeschaeftigt(projektPfad))
    return { ok: false, fehler: texte.chat.fehlerLaufWaehrendChat }
  chatLaufBeginnt(projektPfad)

  // Projekt sofort belegen, damit ein Doppelklick auf „Starten" während der
  // Sicherung keinen zweiten Lauf startet.
  const lauf = {
    projektPfad,
    // Eine Motor-Session pro Lauf (BAUPLAN 19): der Lauf-Motor hält die
    // Session über alle Blöcke offen. Parallele Zweige bekommen zusätzlich
    // eigene Motoren — „Sofort abbrechen" muss jeden einzelnen töten.
    laufMotor: null,
    motoren: new Map(), // instanzId → Motor
    aktiveInstanzen: new Set(),
    fragen: new Map(),
    entscheidungen: new Map(),
    menschFragen: new Map(),
    // Karten-Vorschläge (BAUPLAN 26): der Abnahme-Dialog des Karten-Prüfers.
    vorschlaege: new Map(),
    sanft: false,
    hart: false,
    // Offene Dialoge als Warteschlangen: Zwei parallele Blöcke können
    // gleichzeitig fragen — die Ansicht zeigt eine Frage nach der anderen.
    offeneFragen: [],
    offeneMenschFragen: [],
    offeneVorschlaege: [],
    // Folgen-Fragen je Zweig (BAUPLAN 46): mehrere können gleichzeitig offen
    // sein — die Liste ist die Warteschlange, offeneEntscheidung die gerade
    // sichtbare (immer die erste der Liste).
    offeneEntscheidungen: [],
    offeneEntscheidung: null,
    // Gesprächsverlauf dieses Laufs (Fragen des Agenten + Antworten) — die
    // Ansicht stellt ihn nach einem Wechsel daraus wieder her.
    gespraech: [],
    // Sonderlauf (BAUPLAN 30): Kennzeichen für die Ansicht.
    sonderlauf: sonderlauf?.art ?? null
  }
  aktiveLaeufe.set(projektPfad, lauf)
  laeufeMelden()
  // Prozess-Hygiene (BAUPLAN 32): Ab jetzt beobachtet der Späher, was aus
  // diesem Lauf heraus gestartet wird — die Motor-Prozesse melden sich als
  // Wurzeln, ihre Nachkommen werden transitiv gemerkt und am Lauf-Ende beendet.
  prozessgruppeAnlegen('lauf:' + projektPfad, projektPfad)

  // Baseline „vorher schon rot" (BAUPLAN 35): Gibt es aus einem früheren Lauf
  // einen aufbewahrten Prüfbefehl, spielt FlowForge ihn EINMAL ab, bevor
  // irgendetwas passiert — 0 Tokens, aber die Antwort auf die teuerste Frage
  // einer Reparatur-Runde: „war das schon vorher kaputt?" Was hier rot ist,
  // zählt später nicht als Fehlschlag dieses Laufs.
  // Der Zeitpunkt ist entscheidend: VOR der Leerung der Prüfmappe — der
  // aufbewahrte Befehl zeigt ja genau auf die Prüfungen, die gleich weg sind.
  // Ehrliche Grenze: Ist die Mappe leer (voriger Lauf abgebrochen), misst die
  // Baseline nichts Sinnvolles; dann bleibt sie aus. Ebenso bei einer
  // Wiederaufnahme (der Stand vor dem Lauf ist längst gemessen) und in Läufen
  // ohne Prüf-Block (Sonderläufe, reine Lese-Ketten) — da gäbe es kein Tor,
  // für das sie zählen könnte.
  // Je Prüf-Instanz eine eigene Baseline (BAUPLAN 41): Jeder Prüfer hat seinen
  // eigenen aufbewahrten Prüfbefehl und seinen eigenen Prüfordner — eine
  // gemeinsame Messung urteilte über einen fremden Zweig.
  const baseline = new Map() // instanzId → { befehl, ausgabe, zeilen }
  const baselineTicker = []
  if (!fortsetzung) {
    // Denselben Befehl misst FlowForge nur einmal — zwei Prüfer dürfen sich
    // denselben aufbewahrten Befehl teilen (Altbestand aus einem Format ohne
    // Instanz-Kennung).
    const gemessen = new Map() // befehl → messung
    for (const eintrag of kette) {
      if (!defVon(eintrag.blockId)?.prueft) continue
      if (!pruefmappeHatDateien(projektPfad, ordnerVon(eintrag))) continue
      const alterBefehl = pruefbefehlArchivLaden(projektPfad, eintrag.instanzId)
      if (!alterBefehl) continue
      let messung = gemessen.get(alterBefehl)
      if (!messung) {
        messung = await befehlAbspielen(projektPfad, alterBefehl, {
          gruppe: 'tor:' + projektPfad + ':' + eintrag.instanzId,
          abbrechen: () => lauf.sanft || lauf.hart
        })
        gemessen.set(alterBefehl, messung)
        if (messung.abgebrochen) {
          // Georg hat gestoppt, bevor die Messung durch war — dann gibt es
          // keine Baseline, statt einer erfundenen.
        } else if (messung.code === 0) {
          baselineTicker.push(texte.ticker.baselineSpielt(alterBefehl), texte.ticker.baselineGruen)
        } else {
          baselineTicker.push(
            texte.ticker.baselineSpielt(alterBefehl),
            texte.ticker.baselineRot(fehlerZeilen(messung.ausgabe).length)
          )
        }
      }
      if (messung.abgebrochen || messung.code === 0) continue
      // Für den späteren Vergleich genügen die Fehlerzeilen — die volle
      // Ausgabe wandert nur gedeckelt in die Aufträge und den Laufstand.
      baseline.set(eintrag.instanzId, {
        befehl: alterBefehl,
        ausgabe: mitteGekuerzt(messung.ausgabe, BASELINE_MAX).text,
        zeilen: fehlerZeilen(messung.ausgabe).map((f) => f.zeile)
      })
    }
  }

  // Lauf-Mappe statt Projekt-Mappe (Entscheidung Georg, 13.08.2026, BAUPLAN 17):
  // Die Prüfmappe pruefung/ gehört zum Lauf — ein neuer Lauf startet mit leerer
  // Mappe, der Prüfer baut seine Prüfungen frisch fürs aktuelle Paket. Geleert
  // wird VOR dem Sicherungspunkt „Stand vor Lauf", damit auch „Sofort abbrechen"
  // die alten Prüfungen nicht zurückholt. Die Wiederaufnahme eines
  // unterbrochenen Laufs leert nicht — dessen Prüfungen gehören ja zu ihm.
  // Der Prüfbefehl (BAUPLAN 35) gehört genauso zum Lauf: Er zeigt auf genau
  // diese Prüfungen und wird mit ihnen zusammen geleert; sein Gedächtnis über
  // Läufe hinweg ist das Archiv, aus dem eben die Baseline kam.
  if (!fortsetzung) pruefbefehlLeeren(projektPfad)
  let pruefmappeGeleert = false
  if (!fortsetzung) {
    try {
      const mappe = path.join(projektPfad, 'pruefung')
      if (fs.existsSync(mappe)) {
        fs.rmSync(mappe, { recursive: true, force: true })
        pruefmappeGeleert = true
      }
    } catch {
      // Eine klemmende Datei darf den Start nicht verhindern — der Prüfer
      // arbeitet dann eben mit dem, was liegen blieb.
    }
  }

  // Prüfkarten (SPEC §4.3, BAUPLAN 18): NACH der Leerung legt FlowForge die
  // aufbewahrten Prüfdateien der auf Prüf-Blöcke gezogenen Karten zurück in
  // die Mappe — noch vor dem Sicherungspunkt „Stand vor Lauf", damit auch
  // „Sofort abbrechen" sie korrekt zurückholt. Die Mappe ist nur die Werkbank
  // des Laufs; das Gedächtnis ist das Archiv hinter den Prüfkarten. Bei einer
  // Wiederaufnahme liegen die Dateien schon in der Mappe (der Sicherungspunkt
  // kam nach dem Einlegen) — dann wird nur die Zuordnung neu aufgebaut.
  const pruefkartenVonInstanz = new Map() // instanzId → [{ id, titel, text, ordner, dateien }]
  let pruefkartenEingelegt = 0
  {
    const geladeneKarten = kartenLaden(projektPfad)
    const pruefkartenNachId = new Map(
      geladeneKarten.ok
        ? geladeneKarten.karten.filter((k) => k.sorte === 'pruefung').map((k) => [k.id, k])
        : []
    )
    // Je Prüfordner einmal einlegen (BAUPLAN 41): Dieselbe Prüfkarte darf an
    // zwei Prüfern hängen — dann bekommt jeder seine eigene Kopie.
    const schonEingelegt = new Set()
    for (const eintrag of kette) {
      if (!defVon(eintrag.blockId)?.prueft) continue
      const pruefOrdner = ordnerVon(eintrag)
      const liste = []
      for (const kartenId of eintrag.pruefKarten ?? []) {
        const karte = pruefkartenNachId.get(kartenId)
        if (!karte) continue // Karte inzwischen gelöscht — still ignorieren
        const anhang = {
          id: kartenId,
          titel: karte.titel,
          text: karte.text,
          ordner: pruefkartenOrdner(kartenId, pruefOrdner),
          dateien: pruefkartenArchivHatDateien(projektPfad, kartenId)
        }
        const schluessel = kartenId + '@' + pruefOrdner
        if (!fortsetzung && anhang.dateien && !schonEingelegt.has(schluessel)) {
          schonEingelegt.add(schluessel)
          try {
            if (pruefkarteEinlegen(projektPfad, kartenId, pruefOrdner)) pruefkartenEingelegt++
          } catch {
            // Eine klemmende Kopie verhindert den Start nicht — der Prüfer
            // bekommt die Karte dann ohne Dateien genannt.
            anhang.dateien = false
          }
        }
        liste.push(anhang)
      }
      if (liste.length) pruefkartenVonInstanz.set(eintrag.instanzId, liste)
    }
  }

  // Sicherheitsnetz vor dem Lauf: der Stand von jetzt ist immer wiederholbar —
  // und die Folgen-Frage kann genau hierauf zurücksetzen.
  // namen = Katalognamen (Metriken, SPEC §3.4), anzeigen = mit Zusatznamen.
  const namen = kette.map((b) => defVon(b.blockId).name)
  const anzeigen = kette.map(anzeigeVon)
  const sicherung = await sicherungspunktAnlegen(
    projektPfad,
    texte.sicherungen.beschriftungVorLauf(anzeigen[0])
  )
  if (!sicherung.ok) {
    aktiveLaeufe.delete(projektPfad)
    laeufeMelden()
    void prozessgruppeAbraeumen('lauf:' + projektPfad)
    return { ok: false, fehler: sicherung.fehler }
  }
  const punktVorLauf = sicherung.id

  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): Der Vorschlag gilt genau
  // für den nächsten Lauf — dieser Start räumt ihn ab (übernommen oder nicht).
  // Erst jetzt, wo der Lauf wirklich startet: Ein gescheiterter Startversuch
  // soll die Vorschlags-Zeile nicht kosten.
  laufVorschlagLoeschen(projektPfad)

  const bericht = {
    id: crypto.randomUUID(),
    workflow: namen.join(' → '),
    bloecke: namen,
    modus: einstellungen.motorModus,
    gestartetAm: jetztIso(),
    beendetAm: null,
    zustand: 'laeuft',
    fehlertext: '',
    verbrauch: null,
    rechteFragen: [],
    entscheidungen: [],
    // Gespräch mit dem Agenten (BAUPLAN 9): jede Frage samt Antwort.
    gespraech: [],
    // Übertrags-Protokoll in Alltagssprache (SPEC §5, BAUPLAN 11).
    uebertraege: [],
    // Zusammenfassungen des Motors (BAUPLAN 36): Wann hat der Motor selbst ein
    // Arbeitsgedächtnis eingedampft? Erklärt Gedächtnislücken und zählt in den
    // Harness-Kennzahlen mit. Alte Berichte haben das Feld nicht — sie zählen
    // dort ehrlich als „ohne Angabe", nicht als null Zusammenfassungen.
    zusammenfassungen: [],
    // Wiederaufnahme nach Unterbrechung (BAUPLAN 11).
    fortgesetzt: Boolean(fortsetzung),
    // Sonderlauf (BAUPLAN 30): Kennzeichen für Bericht und Ansicht — die
    // Leinwand war nicht beteiligt.
    ...(sonderlauf ? { sonderlauf: sonderlauf.art } : {}),
    // Abschlusstext jedes gelaufenen Blocks — die Leinwand zeigt ihn direkt
    // an der jeweiligen Karte an.
    blockErgebnisse: [],
    ticker: []
  }
  // Die Projektübersicht (Hero-Kachel, Mockup 3a) liest Workflow-Name und
  // letzte Tickerzeile des laufenden Berichts über projektZustaende mit.
  lauf.bericht = bericht

  function senden(ereignis) {
    if (!fenster.isDestroyed())
      fenster.webContents.send('lauf-ereignis', { projektPfad, ...ereignis })
  }

  function tickern(text) {
    bericht.ticker.push({ zeit: jetztIso(), text })
    senden({ art: 'ticker', text })
  }
  lauf.tickern = tickern

  // Windows-Benachrichtigungen (SPEC §5/§6): standardmäßig nur, wenn Georg
  // gerade nicht im Fenster ist — Kontingent-Pausen melden sich immer.
  function benachrichtigen(titel, inhalt, { immer = false } = {}) {
    if (!immer && !fenster.isDestroyed() && fenster.isFocused()) return
    if (Notification.isSupported()) new Notification({ title: titel, body: inhalt }).show()
  }

  const gesamtVerbrauch = {
    tokens: 0,
    kostenUsd: null,
    // Token-Aufschlüsselung (Wunsch Georg, 13.08.2026): Eingabe, Ausgabe,
    // Cache gelesen/geschrieben — über alle Blöcke und Sessions des Laufs.
    aufschluesselung: { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 },
    // „Davon lokal" (BAUPLAN 51, Vertrag V2): Tokens und Wanduhrzeit aller
    // lokalen Block-Anläufe — geführt HIER am Lauf statt im Renderer aus den
    // Blockeinträgen gerechnet: Kontingent-erschöpfte und hart abgebrochene
    // Anläufe pushen kein blockErgebnis, ihre Tokens stehen aber längst hier.
    // Die Trennung läuft über TOKENS (Abo-Währung), nicht über Dollar —
    // lokale Kosten sind ehrlich 0.
    lokal: { tokens: 0, dauerMs: 0 }
  }
  // Die echte Kontextfenster-Größe lernt der Lauf aus der ersten Motor-Session
  // und reicht sie an alle weiteren durch — für eine richtige Übertrags-Schwelle.
  let bekanntesKontextFenster = 0

  function rechteFrageStellen(frage) {
    // Automodus (Feedback Georg, 07.08.2026): Rückfragen automatisch erlauben —
    // sichtbar im Ticker und im Laufbericht. Harte Sperren (Git, Verwaltungs-
    // dateien, „darf nur lesen") kommen hier gar nicht erst an.
    if (einstellungen.rechteAutomatisch) {
      bericht.rechteFragen.push({ beschreibung: frage.beschreibung, erlaubt: true, automatisch: true })
      tickern(texte.ticker.rechteAutomatischErlaubt(frage.beschreibung.replace(/\s+/g, ' ').slice(0, 160)))
      return Promise.resolve(true)
    }
    return new Promise((antworten) => {
      if (fenster.isDestroyed()) return antworten(false)
      const frageId = crypto.randomUUID()
      lauf.fragen.set(frageId, (erlaubt) => {
        lauf.fragen.delete(frageId)
        lauf.offeneFragen = lauf.offeneFragen.filter((f) => f.frageId !== frageId)
        bericht.rechteFragen.push({ beschreibung: frage.beschreibung, erlaubt })
        senden({ art: 'frage-erledigt', frageId })
        // Wartet schon die nächste Rechte-Frage eines parallelen Blocks,
        // rückt sie sofort nach.
        const naechste = lauf.offeneFragen[0]
        if (naechste) senden({ art: 'frage', ...naechste })
        antworten(erlaubt)
      })
      lauf.offeneFragen.push({ frageId, beschreibung: frage.beschreibung })
      if (lauf.offeneFragen.length === 1)
        senden({ art: 'frage', frageId, beschreibung: frage.beschreibung })
    })
  }

  // Frage an den Menschen (BAUPLAN 9, SPEC §6): pausiert den Block, bis die
  // Antwort aus dem Gespräch kommt. Löst mit dem Antwort-Text auf — oder mit
  // null, wenn der Lauf vorher endet (das Werkzeug meldet das dem Agenten).
  function menschFrageStellen({ frage, optionen }, blockName) {
    return new Promise((antworten) => {
      if (fenster.isDestroyed()) return antworten(null)
      tickern(texte.ticker.menschFrageGestellt)
      // Windows-Benachrichtigung (SPEC §6) — nur wenn Georg gerade woanders ist.
      if (!fenster.isFocused() && Notification.isSupported())
        new Notification({
          title: texte.benachrichtigung.frageTitel,
          body: frage.length > 200 ? frage.slice(0, 200) + ' …' : frage
        }).show()
      const frageId = crypto.randomUUID()
      lauf.menschFragen.set(frageId, (antwortText) => {
        lauf.menschFragen.delete(frageId)
        lauf.offeneMenschFragen = lauf.offeneMenschFragen.filter((f) => f.frageId !== frageId)
        if (antwortText != null) {
          bericht.gespraech.push({ block: blockName, frage, antwort: antwortText })
          lauf.gespraech.push({ frage, optionen, antwort: antwortText })
          tickern(texte.ticker.menschGeantwortet)
        }
        senden({ art: 'mensch-frage-erledigt', frageId, frage, antwort: antwortText })
        const naechste = lauf.offeneMenschFragen[0]
        if (naechste) senden({ art: 'mensch-frage', ...naechste })
        antworten(antwortText)
      })
      lauf.offeneMenschFragen.push({ frageId, frage, optionen })
      if (lauf.offeneMenschFragen.length === 1)
        senden({ art: 'mensch-frage', frageId, frage, optionen })
    })
  }

  // Karten-Vorschläge (BAUPLAN 26): Der Karten-Prüfer schlägt vor, der Nutzer
  // entscheidet je Karte — übernehmen, mit Änderungen übernehmen, ablehnen.
  // Angewendet wird hier, von FlowForge selbst, über die normalen
  // Kartenfunktionen; der Agent wartet derweil auf sein Werkzeug-Ergebnis.
  // Löst mit der Entscheidung auf — oder mit null, wenn der Lauf endet.
  // Herkunft (BAUPLAN 30) für übernommene Vorschläge: „vom Karten-Prüfer".
  function vorschlagHerkunft(blockName) {
    return {
      quelle: 'kartenpruefer',
      block: blockName,
      laufId: bericht.id,
      laufStart: bericht.gestartetAm
    }
  }

  function vorschlagStellen(vorschlag, blockName = '') {
    return new Promise((aufloesen) => {
      if (fenster.isDestroyed()) return aufloesen(null)
      const artLabel = texte.vorschlag.artLabels[vorschlag.art] ?? vorschlag.art
      const kartenTitel =
        vorschlag.art === 'thema'
          ? texte.vorschlag.themenAnzahl(vorschlag.eintraege?.length ?? 0)
          : (vorschlag.alteKarte?.titel ?? vorschlag.titel ?? '')
      tickern(texte.ticker.kartenVorschlagGestellt(artLabel, kartenTitel))
      if (!fenster.isFocused() && Notification.isSupported())
        new Notification({
          title: texte.benachrichtigung.vorschlagTitel,
          body: `${artLabel}: ${kartenTitel}`
        }).show()
      const frageId = crypto.randomUUID()
      const herkunft = vorschlagHerkunft(blockName)
      lauf.vorschlaege.set(frageId, (wahl, felder) => {
        function abschliessen(ergebnisFuerAgent) {
          lauf.vorschlaege.delete(frageId)
          lauf.offeneVorschlaege = lauf.offeneVorschlaege.filter((v) => v.frageId !== frageId)
          senden({ art: 'vorschlag-erledigt', frageId })
          const naechster = lauf.offeneVorschlaege[0]
          if (naechster) senden({ art: 'vorschlag', ...naechster })
          aufloesen(ergebnisFuerAgent)
        }
        // wahl null = der Lauf endet, ohne dass entschieden wurde.
        if (wahl == null) {
          abschliessen(null)
          return { ok: true }
        }
        // Sammelform „thema" (BAUPLAN 30): felder.eintraege = die Zeilen, die
        // der Nutzer übernimmt (ggf. mit geändertem Thema); alles andere gilt
        // als abgelehnt. „Ablehnen" ohne Felder = alle abgelehnt.
        if (vorschlag.art === 'thema') {
          const gewollt =
            wahl === 'ablehnen'
              ? []
              : Array.isArray(felder?.eintraege)
                ? felder.eintraege
                : vorschlag.eintraege
          let uebernommen = 0
          let letzteKarten = null
          for (const zeile of gewollt) {
            const ergebnis = karteThemaSetzen(projektPfad, zeile.kartenId, zeile.thema, herkunft)
            // Eine unbrauchbare Zeile (z.B. zu langes Thema nach dem Bearbeiten)
            // hält den ganzen Dialog offen — die Ansicht zeigt den Fehler.
            if (!ergebnis.ok) return ergebnis
            uebernommen++
            letzteKarten = ergebnis.karten
          }
          if (letzteKarten) senden({ art: 'karten', karten: letzteKarten })
          const abgelehnt = (vorschlag.eintraege?.length ?? 0) - uebernommen
          bericht.kartenVorschlaege ??= { uebernommen: 0, bearbeitet: 0, abgelehnt: 0 }
          bericht.kartenVorschlaege.uebernommen += uebernommen
          bericht.kartenVorschlaege.abgelehnt += Math.max(0, abgelehnt)
          tickern(texte.ticker.themenUebernommen(uebernommen, Math.max(0, abgelehnt)))
          abschliessen({ wahl: 'thema', uebernommen, abgelehnt: Math.max(0, abgelehnt) })
          return { ok: true }
        }
        if (wahl === 'ablehnen') {
          bericht.kartenVorschlaege ??= { uebernommen: 0, bearbeitet: 0, abgelehnt: 0 }
          bericht.kartenVorschlaege.abgelehnt++
          tickern(texte.ticker.kartenVorschlagAbgelehnt(kartenTitel))
          abschliessen({ wahl: 'abgelehnt' })
          return { ok: true }
        }
        // Übernehmen — mit den Feldern des Vorschlags oder Georgs Bearbeitung.
        const bearbeitet = felder != null
        const titel = bearbeitet ? String(felder.titel ?? vorschlag.titel ?? '') : vorschlag.titel
        const text = bearbeitet ? String(felder.text ?? vorschlag.text ?? '') : vorschlag.text
        // Thema (BAUPLAN 30): bei „anlegen" das vorgeschlagene bzw. bearbeitete.
        const thema = bearbeitet && felder.thema != null ? String(felder.thema) : vorschlag.thema
        let ergebnis
        if (vorschlag.art === 'aktualisieren')
          ergebnis = karteAendern(projektPfad, vorschlag.kartenId, { titel, text }, herkunft)
        else if (vorschlag.art === 'erledigen')
          ergebnis = karteErledigtSetzen(projektPfad, vorschlag.kartenId, true, herkunft)
        else if (vorschlag.art === 'oeffnen')
          ergebnis = karteErledigtSetzen(projektPfad, vorschlag.kartenId, false, herkunft)
        else if (vorschlag.art === 'anlegen')
          ergebnis = karteAnlegen(projektPfad, { sorte: 'aufgabe', titel, text, thema }, herkunft)
        else if (vorschlag.art === 'loeschen')
          ergebnis = karteLoeschen(projektPfad, vorschlag.kartenId)
        else ergebnis = { ok: false, fehler: texte.fehler.unbekannt }
        // Scheitert das Anwenden (z.B. Längengrenze nach dem Bearbeiten),
        // bleibt der Vorschlag offen — die Ansicht zeigt den Fehler an.
        if (!ergebnis.ok) return ergebnis
        if (ergebnis.karten) senden({ art: 'karten', karten: ergebnis.karten })
        bericht.kartenVorschlaege ??= { uebernommen: 0, bearbeitet: 0, abgelehnt: 0 }
        if (bearbeitet) bericht.kartenVorschlaege.bearbeitet++
        else bericht.kartenVorschlaege.uebernommen++
        tickern(
          bearbeitet
            ? texte.ticker.kartenVorschlagBearbeitet(kartenTitel)
            : texte.ticker.kartenVorschlagUebernommen(kartenTitel)
        )
        abschliessen(bearbeitet ? { wahl: 'bearbeitet', titel, text } : { wahl: 'uebernommen' })
        return { ok: true }
      })
      lauf.offeneVorschlaege.push({ frageId, vorschlag })
      if (lauf.offeneVorschlaege.length === 1) senden({ art: 'vorschlag', frageId, vorschlag })
    })
  }

  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): Das Sessionende benennt
  // die Karten für den nächsten Lauf. Gespeichert wird nur ein Vorschlag —
  // angezeigt an der Kartenauswahl im Schaubild-Tab, entschieden vom Nutzer;
  // ein erneuter Aufruf (oder ein späteres Sessionende) ersetzt den alten.
  function laufVorschlagAnnehmen({ kartenIds, empfehlung, begruendung, kartenTitel }) {
    laufVorschlagSpeichern(projektPfad, { kartenIds, empfehlung, begruendung, erstelltAm: jetztIso() })
    bericht.naechsterLauf = { empfehlung, begruendung, karten: kartenTitel }
    tickern(texte.ticker.laufVorschlagGespeichert(kartenTitel.length, empfehlung))
  }

  // Folgen-Frage nach verbrauchten Reparatur-Runden (SPEC §4.1) — seit
  // BAUPLAN 46 JE ZWEIG und ohne den Planer anzuhalten: Die Frage wird
  // eingereiht (Warteschlange wie offeneFragen; die Ansicht zeigt eine nach der
  // anderen), und das Promise löst mit einem Race-Ergebnis für die Planer-
  // Schleife auf — der Prüfer steht solange auf 'wartet-entscheidung', andere
  // Zweige laufen weiter. `trifft` sagt vorher, was „Stand wiederherstellen"
  // treffen würde (Vertrag F8).
  function entscheidungEinreihen({ instanzId, blockName, zielId, runden, trifft }) {
    const antwort = (wahl) => ({ zustand: 'entscheidung', instanzId, zielId, wahl })
    return new Promise((aufloesen) => {
      if (fenster.isDestroyed()) return aufloesen(antwort('zurueckstellen'))
      tickern(texte.ticker.entscheidungGestellt(blockName))
      const frageId = crypto.randomUUID()
      const eintrag = { frageId, blockName, runden, trifft }
      lauf.entscheidungen.set(frageId, (wahl) => {
        lauf.entscheidungen.delete(frageId)
        lauf.offeneEntscheidungen = lauf.offeneEntscheidungen.filter((e) => e.frageId !== frageId)
        lauf.offeneEntscheidung = lauf.offeneEntscheidungen[0] ?? null
        bericht.entscheidungen.push({ block: blockName, wahl })
        senden({ art: 'entscheidung-erledigt', frageId })
        // Wartet schon die Folgen-Frage eines anderen Zweigs, rückt sie nach.
        if (lauf.offeneEntscheidung) senden({ art: 'entscheidung', ...lauf.offeneEntscheidung })
        aufloesen(antwort(wahl))
      })
      lauf.offeneEntscheidungen.push(eintrag)
      if (lauf.offeneEntscheidungen.length === 1) {
        lauf.offeneEntscheidung = eintrag
        senden({ art: 'entscheidung', ...eintrag })
      }
    })
  }

  // Karten-Zuteilung (BAUPLAN 29): Welche Karten ein Block in den Auftrag
  // bekommt — die volle Auswahl, oder seine Teilmenge, sobald Paket schneiden/
  // Diagnose zugeteilt hat. Gefüllt im Ablaufplaner; hier nur der Rückfall,
  // damit das Projektwissen der lokalen KI (unten) sie schon kennen darf.
  let kartenFuerBlock = () => ausgewaehlt

  // Lokale Helfer-KI (Experiment, 13.08.2026): nur nutzen, wenn Ollama jetzt
  // wirklich läuft und das Modell da ist — sonst ehrlicher Hinweis und alles
  // läuft wie gewohnt über den Motor.
  let lokaleHelfer = null
  let lokaleHelferHinweis = null
  if (einstellungen.lokaleHelferAktiv) {
    const status = await lokaleHelferPruefen(
      einstellungen.lokaleHelferModell,
      einstellungen.lokaleHelferAdresse
    )
    if (status.erreichbar && status.modellDa) {
      // Kontext-Fenster aus den Einstellungen (32k/64k/128k, seit 0.46.3) —
      // gilt für alle lokalen Kreisläufe dieses Laufs; die Werkzeug-Deckel
      // der lokalen KI wachsen damit mit.
      const grenzen = lokaleHelferKontextSetzen(einstellungen.lokaleHelferKontext)
      lokaleHelfer = {
        modell: einstellungen.lokaleHelferModell,
        adresse: einstellungen.lokaleHelferAdresse,
        kontext: grenzen.kontext,
        // Trefferquote (BAUPLAN 23): Standard an — ohne Quote ist die
        // Kosten-Wette der lokalen KI blind.
        bewerten: einstellungen.lokaleHelferQuote !== false,
        // Projektwissen (BAUPLAN 25): je lokalem Auftrag frisch gelesen —
        // die Kartenauswahl (ausgewaehlt) wächst mitten im Lauf. Seit der
        // Karten-Zuteilung (BAUPLAN 29) block-bezogen: Der Motor reicht die
        // Instanz-Kennung des laufenden Blocks herein — das Fenster
        // kleiner Modelle verträgt keine Kartenflut.
        projektwissen: (instanzId) =>
          projektwissenFuerHelfer(projektPfad, kartenFuerBlock(instanzId))
      }
      lokaleHelferHinweis = texte.ticker.lokaleHelferBereit(
        einstellungen.lokaleHelferModell,
        grenzen.kontext
      )
    } else {
      lokaleHelferHinweis = texte.ticker.lokaleHelferNichtErreichbar
    }
  }
  // Lokaler Block-Agent (BAUPLAN 49/51): Trägt die Kette einen Block der
  // Klasse „lokal", legt FlowForge das abgeleitete Ollama-Modell an (Kontext-
  // fenster + Feineinstellungen als Standardwerte am Modell; unverändert =
  // kein Neuladen) — seit BAUPLAN 51 je Adresse der Liste, denn jede
  // Ollama-Instanz hält ihren eigenen Modell-Speicher. Geprüft und
  // bereitgestellt wird PARALLEL (sequentiell hinge der Laufstart je toter
  // Adresse bis zu 63 Sekunden). Nur bereite Adressen kommen in den Pool
  // `lokalPool` (je Eintrag { adresse, modell, kontext, basis }); nicht
  // bereite werden mit Klartext-Ticker ausgeklammert — nie still. Bleibt der
  // Pool leer, endet der Lauf als Fehlschlag mit Klartext — nie stiller
  // Rückfall auf Claude. Der Pool gilt je Lauf; die Helfer-KI (oben) und die
  // lokale Vorreparatur bleiben fest auf Adresse 1 der Liste.
  let lokalPool = []
  let lokalAusgefallene = []
  let lokalFehler = null
  if (kette.some((e) => klasseIstLokal(blockModellKlasse(defVon(e.blockId), e)))) {
    const kontext = Number(einstellungen.lokaleHelferKontext) > 0
      ? Number(einstellungen.lokaleHelferKontext)
      : KONTEXT_FENSTER_STANDARD
    const befunde = await Promise.all(
      lokaleAdressenVon(einstellungen).map(async (adresse) => {
        const status = await lokaleHelferPruefen(einstellungen.lokaleHelferModell, adresse)
        if (!status.erreichbar) return { adresse, fehler: texte.lauf.lokalNichtErreichbar(adresse) }
        if (!status.modellDa)
          return { adresse, fehler: texte.lauf.lokalModellFehlt(einstellungen.lokaleHelferModell) }
        const bereit = await lokalesModellBereitstellen({
          adresse,
          basis: einstellungen.lokaleHelferModell,
          kontext,
          fein: einstellungen.lokalFein
        })
        if (!bereit.ok) return { adresse, fehler: bereit.fehler }
        return {
          adresse,
          eintrag: { adresse, modell: bereit.modell, kontext, basis: einstellungen.lokaleHelferModell }
        }
      })
    )
    lokalPool = befunde.filter((b) => b.eintrag).map((b) => b.eintrag)
    lokalAusgefallene = befunde.filter((b) => b.fehler)
    // Leerer Pool: exakt der heutige Fehlschlag-Pfad — der Klartext der
    // ersten Adresse wird der Fehlertext des Laufs.
    if (!lokalPool.length) lokalFehler = lokalAusgefallene[0]?.fehler ?? null
  }
  // Die Lokale-Helfer-Zeile des Berichts — seit BAUPLAN 31 mit dem Modell,
  // damit die Zahlen einem Modell zuzuordnen sind.
  function helferZaehler() {
    bericht.lokaleHelfer ??= {
      recherchen: 0,
      schritte: 0,
      gescheitert: 0,
      ...(lokaleHelfer ? { modell: lokaleHelfer.modell } : {})
    }
    return bericht.lokaleHelfer
  }
  // Metriken (BAUPLAN 31): jedes Urteil über lokale Arbeit in die globale
  // Metrik-Datei — Projekt, Lauf, Block, Modell, Bereich, Ausgang, Schritte.
  function metrikUrteil(block, bereich, ausgang, schritte) {
    metrikUrteilSchreiben({
      projektPfad,
      laufId: bericht.id,
      block: block ?? '',
      modell: lokaleHelfer?.modell ?? '',
      bereich,
      ausgang,
      schritte: schritte ?? 0
    })
  }

  // Lauf-Start sofort melden — noch vor der ersten Ticker-Zeile, damit die
  // Ansicht die Anzeige des vorigen Laufs sauber leeren kann.
  senden({ art: 'zustand', zustand: 'laeuft' })
  // Ehrlichkeit (Entscheidung Georg, 14.08.2026): Ist die Auf-eigene-Gefahr-
  // Einstellung aktiv, steht das sichtbar am Laufstart — im Ticker und damit
  // auch im Laufbericht.
  if (einstellungen.nurLesenBefehle) tickern(texte.ticker.nurLesenBefehleAktiv)
  // Unteraufgaben-Modell (BAUPLAN 37): Stuft FlowForge die Zuarbeit herab,
  // steht das sichtbar am Laufstart — im Ticker und damit im Laufbericht.
  // Lokale Blöcke (BAUPLAN 49) haben in ihrer Instanz kein Sonnet — ihre
  // Unteraufgaben laufen auf dem Ollama-Modell; der Zusatz sagt es ehrlich.
  if (einstellungen.unteraufgabenModell !== 'wieBlock')
    tickern(
      texte.ticker.unteraufgabenSparsam(texte.kette.modellNamen.sparsam) +
        (lokalPool.length ? ' ' + texte.ticker.unteraufgabenLokalZusatz : '')
    )
  if (lokaleHelferHinweis) tickern(lokaleHelferHinweis)
  // Lokaler Block-Agent (BAUPLAN 49/51): bereit (mit Adress-Anzahl des Pools)
  // — oder der Grund, warum nicht (der Lauf endet dann gleich als Fehlschlag,
  // s. Planer). Nicht bereite Adressen stehen sichtbar im Ticker, solange
  // wenigstens eine trägt (Ausklammern statt stillem Rückfall).
  if (lokalPool.length) {
    for (const ausfall of lokalAusgefallene)
      tickern(texte.ticker.lokalAdresseAusgeklammert(ausfall.adresse, ausfall.fehler))
    tickern(texte.ticker.lokalBereit(lokalPool[0].modell, lokalPool[0].kontext, lokalPool.length))
  } else if (lokalFehler) tickern(lokalFehler)
  // Lokaler Prüfer ohne Claude-Abnahme (BAUPLAN 50): Hinweis, keine Sperre
  // („Rückfrage statt Sperre") — steht im Ticker und damit im Laufbericht,
  // derselbe Befund wie an der Karte und im Schaubild-Kopf (schaubildHinweise).
  for (const hinweis of schaubildHinweise(workflow.bloecke, workflow.pfeile))
    tickern(texte.ticker.lokalerPrueferOhneAbnahme(hinweis.name))
  if (pruefmappeGeleert) tickern(texte.ticker.pruefmappeGeleert)
  if (pruefkartenEingelegt > 0) tickern(texte.ticker.pruefkartenEingelegt(pruefkartenEingelegt))
  // Baseline (BAUPLAN 35): schon vor dem ersten Block gemessen, hier erst
  // sichtbar — den Ticker gibt es erst ab jetzt.
  for (const zeile of baselineTicker) tickern(zeile)
  // Altlasten werden Aufgaben-Karte, keine Reparatur-Runde: Der Befund landet
  // dort, wo Georg ihn wiederfindet, und rutscht über die Kartenauswahl in die
  // nächsten Bau-Läufe. Der Titel ist bewusst stabil — derselbe Befund soll
  // nicht bei jedem Lauf eine neue Karte anlegen.
  if (baseline.size > 0) {
    try {
      const vorhanden = kartenLaden(projektPfad)
      const schonDa =
        vorhanden.ok &&
        vorhanden.karten.some(
          (karte) =>
            karte.sorte === 'aufgabe' && !karte.erledigt && karte.titel === texte.tor.altlastTitel
        )
      if (!schonDa) {
        // Mehrere Prüfer, mehrere Baselines: EINE Karte mit stabilem Titel —
        // derselbe Befund soll nicht bei jedem Lauf eine neue anlegen.
        const ersteRote = [...baseline.values()][0]
        const alleZeilen = [...new Set([...baseline.values()].flatMap((b) => b.zeilen))]
        const angelegt = karteAnlegen(
          projektPfad,
          {
            sorte: 'aufgabe',
            titel: texte.tor.altlastTitel,
            text: texte.tor.altlastText(ersteRote.befehl, alleZeilen.slice(0, 3).join(' · ')),
            thema: texte.tor.altlastThema
          },
          { quelle: 'flowforge', laufId: bericht.id, laufStart: bericht.gestartetAm }
        )
        if (angelegt.ok) {
          senden({ art: 'karten', karten: angelegt.karten })
          tickern(texte.ticker.baselineAltlastKarte(angelegt.karte.titel))
        }
      }
    } catch {
      // Eine Karte, die nicht entsteht, darf den Lauf nicht aufhalten — der
      // Baseline-Hinweis geht ohnehin in die Aufträge.
    }
  }
  if (ausWarteschlange) tickern(texte.ticker.ausWarteschlangeGestartet)
  // Die Wiederaufnahme hat schon zurückgerollt, bevor es diesen Ticker gab
  // (laufFortsetzen) — was sie dabei absichtlich stehen ließ, erfährt Georg
  // hier, mit demselben Wortlaut wie an den drei Rückroll-Stellen im Lauf.
  if (fortsetzung?.rollbackGeschuetzt > 0)
    tickern(texte.ticker.rollbackGeschuetzt(fortsetzung.rollbackGeschuetzt))
  // Sichtbarer Hinweis (SPEC §5, BAUPLAN 12): parallele Läufe vervielfachen den
  // Verbrauch — ehrlich im Ticker und damit auch im Laufbericht.
  if (aktiveLaeufe.size > 1) tickern(texte.lauf.parallelHinweis(aktiveLaeufe.size))

  // Der eigentliche Ablaufplaner — läuft im Hintergrund weiter, laufStarten
  // kehrt sofort zurück.
  ;(async () => {
    // Punkt-Stränge je Schreiber (BAUPLAN 45): Liegen aus einem Absturz noch
    // Stränge herum, wird jetzt reiner Tisch gemacht — weggeräumt, was der
    // gemeinsame Stand schon kennt, eingeholt, was er noch nicht kennt. Beides
    // MUSS hier passieren, bevor dieser Lauf eigene Stränge anlegt: Ein Strang
    // trägt den Namen seiner Instanz, und der nächste Anlauf desselben Blocks
    // setzt ihn neu — der gerettete Punkt hinge danach an keinem Zeiger mehr.
    await straengeMeldenBeimStart(projektPfad, tickern)

    // Ein Knoten pro Schaubild-Karte: Zustand, Lieferung und die Zusätze, die
    // beim nächsten Anlauf desselben Blocks in den Auftrag gehören.
    const knoten = new Map(
      kette.map((eintrag) => [
        eintrag.instanzId,
        {
          eintrag,
          def: defVon(eintrag.blockId),
          // Anzeigename (BAUPLAN 41): Katalogname plus Zusatzname — alles, was
          // Georg liest. Der Katalogname bleibt an def.name für die Metriken.
          name: anzeigeVon(eintrag),
          // Prüfordner dieser Instanz (BAUPLAN 41) — leer bei allen, die keine
          // Prüfungen schreiben.
          pruefOrdner: ordnerVon(eintrag),
          // 'offen' | 'laeuft' | 'fertig' — seit BAUPLAN 46 dazu 'nachlauf'
          // (fertig gebaut, Rauchtest wartet, bis die Welle steht),
          // 'wartet-entscheidung' (Prüfer wartet auf die Folgen-Frage seines
          // Zweigs), 'zurueckgestellt' und 'wiederhergestellt' (die Wahl hat
          // diesen Zweig beendet). Nur 'fertig' zählt für Nachfolger, Punkt und
          // Laufstand.
          status: 'offen',
          lieferung: null,
          // Lieferschein (BAUPLAN 42):
          // meldungen — die geprüften Meldungen des laufenden/letzten Anlaufs;
          // meldungenVorher — die des Anlaufs davor (Vorlage für Nachforderungen,
          //   damit nichts neu erarbeitet werden muss);
          // lieferungen — je liefert-Etikett der lesbare Text für die Übergabe;
          // meldungWiederholen — dieser Anlauf läuft nur wegen einer
          //   Nachforderung: Der Auftrag legt die eigene Meldung von eben bei.
          meldungen: [],
          meldungenVorher: [],
          lieferungen: {},
          meldungWiederholen: false,
          // Hat der Block gar nichts gemeldet, liegt sein freier Abschlusstext
          // der Nachforderung bei — daraus trägt er nach, ohne die Arbeit zu
          // wiederholen.
          nachforderungBeleg: '',
          rueckmeldung: '',
          // Gebündelte Rückführung (BAUPLAN 47): true, solange eine Rückmeldung
          // am Block liegt, die sein nächster Anlauf noch nicht gelesen hat.
          // Fällt in dieser Zeit ein ZWEITER Prüfer mit demselben Ziel durch,
          // hängt er seine Kritik an, statt eine zweite Runde zu nehmen. Bewusst
          // nicht am Status festgemacht: Ein nur-lesendes oder prüfendes Ziel
          // startet neben Prüfern sofort — dann ist die Rückmeldung verbraucht.
          rueckmeldungOffen: false,
          // Reparatur-Runde beim Prüfer (Entscheidung Georg, 12.08.2026): seine
          // eigene Kritik der letzten Runde — er prüft dann nur diese Punkte
          // nach. Seit BAUPLAN 42 daneben die Beanstandungen als Felder: Der
          // Grün-Fall des Tors filtert daraus die grundsätzlichen heraus.
          nachpruefung: '',
          nachpruefungBeanstandungen: [],
          startanleitungNachforderung: false,
          uebergabe: '',
          uebergabeVerloren: false,
          warPausiert: false,
          // Lokale Vorreparatur (BAUPLAN 20), nur an Prüf-Knoten genutzt:
          // Versuchszähler (Budget je Rückführung), die Original-Kritik der
          // mechanischen Beanstandungen und ob der nächste Anlauf dieses
          // Prüfers die Nachprüfung eines lokalen Versuchs ist.
          lokaleVersuche: 0,
          lokaleKritik: null,
          lokaleNachpruefung: false,
          // Metriken (BAUPLAN 31): Aufwand und Ziel-Block des laufenden
          // lokalen Reparatur-Versuchs — das Urteil fällt erst in der Nachprüfung.
          lokaleReparaturSchritte: 0,
          lokaleReparaturBlock: null,
          // Kanten-Ehrlichkeit (BAUPLAN 34):
          // diffBasis — Sicherungspunkt, ab dem „das hast du bisher geändert"
          //   gerechnet wird (beim ersten Start des Blocks gemerkt; beim Prüfer
          //   bei jeder Rückführung neu, denn für ihn zählt „seit meinem Urteil");
          // diffBasisVerschmutzt — der Ordner wich beim ersten Start schon ab;
          // diffAnfordern/diffText — der Diff für den nächsten Anlauf;
          // vorFazit — das eigene Fazit der letzten Runde als das „warum";
          // fanOutGemeldet — je Etikett nur einmal „zusammengeführt" tickern;
          // verdraengungGemeldet — dasselbe für die verdrängte Lieferung
          //   (BAUPLAN 40).
          // Das Kanten-Gate „Urteil ohne Beanstandung" aus BAUPLAN 34 ist mit
          // dem Lieferschein (42) entfallen: Diese Meldung weist FlowForge schon
          // am Werkzeug ab, der Prüfer korrigiert sofort — es kostet keinen
          // zweiten Anlauf mehr.
          diffBasis: undefined,
          diffBasisVerschmutzt: false,
          diffAnfordern: false,
          diffText: '',
          vorFazit: '',
          fanOutGemeldet: new Set(),
          verdraengungGemeldet: new Set(),
          // Tor ohne KI (BAUPLAN 35):
          // torProtokoll — die Ausgabe eines roten Prüfbefehls, die dieser
          //   Block im nächsten Anlauf als Tatsache in den Auftrag bekommt;
          // letztesTorProtokoll — am Prüf-Knoten gemerkt, damit die
          //   Rückführung sie an ihr Ziel weiterreichen kann;
          // torGruenBefehl — der Prüfbefehl lief vor diesem Anlauf grün durch:
          //   der Prüfer prüft dann nur noch die grundsätzlichen Punkte nach;
          // pruefbefehlNachforderung — der Prüfbeleg, den der Prüfer beim
          //   Nachtragen des Prüfbefehls unverändert wiederholen soll;
          // rauchtestRueckmeldung — die Startanleitung lief nicht an.
          torProtokoll: '',
          letztesTorProtokoll: '',
          torGruenBefehl: '',
          pruefbefehlNachforderung: '',
          rauchtestRueckmeldung: '',
          // Lokaler Prüfer (BAUPLAN 50), nur an Prüf-Knoten der Klasse lokal:
          // urteilLokal — das selbst gemeldete Urteil des letzten Anlaufs VOR
          //   einer Tor-Drehung ('bestanden'|'fehlgeschlagen'|null);
          // torBestaetigung — Ausgang des Tor-Ankers ('gruen'|'altlasten'|'rot'|
          //   'keine'|'abgebrochen'), null = kein Nachspiel. Beides lesen die
          //   Abnahme-Quellen (abnahmeQuelleVon) beim Auftragsbau der Abnahme.
          // An Prüf-Knoten, die Abnahme sind: abnahmeQuellen — je Anlauf frisch
          //   die lokalen Prüfer, deren Beleg im Auftrag ankam (Paar-Bildung
          //   BEIM Auftragsbau, nicht am Ende — dazwischen kann der lokale
          //   Prüfer erneut laufen und seine Meldung verlieren);
          //   anlaufDurchTor — der letzte Anlauf endete am Vor-Tor (kein Agent).
          urteilLokal: null,
          torBestaetigung: null,
          abnahmeQuellen: [],
          anlaufDurchTor: false,
          // Vollständigkeit des Zuschnitts (BAUPLAN 44):
          // zuschnittNachforderung — der fertige Nachtrag-Text, den dieser
          //   Block im nächsten Anlauf bekommt (er nennt die nicht abgedeckten
          //   Aufgaben und die unbedienten Ziele NAMENTLICH). Er hängt am
          //   Knoten, nicht im Auftragstext: Der wird bei jedem Anlauf
          //   vollständig neu gebaut;
          // dateilisteGemeldet — die Ticker-Zeile zum Datenvertrag kommt einmal
          //   je Block, nicht in jeder Reparatur-Runde erneut.
          zuschnittNachforderung: '',
          dateilisteGemeldet: false,
          // Sicherungspunkte je Schreiber (BAUPLAN 45):
          // strang — der eigene Punkt-Strang dieses Block-Anlaufs (null = keiner,
          //   dann zählt der gemeinsame Stand wie vor Bauschritt 45);
          // wirkbereich — welche Dateien diesem Block gehören (null = unbekannt),
          //   Grundlage für Strang, gefilterten Diff und die geschützten
          //   Bereiche der anderen;
          // strangGemeldet — welche Lage zuletzt getickert wurde ('mit'/'ohne'),
          //   damit dieselbe Zeile nicht in jeder Runde erneut kommt, ein
          //   Umschwung aber sehr wohl.
          strang: null,
          wirkbereich: null,
          strangGemeldet: null,
          // Welle (BAUPLAN 46):
          // dateiListeAktiv — die beim Start gemerkte Dateiliste (Datenvertrag);
          //   dateiListeFuer kostet einen Übergaben-Durchlauf und würde sonst
          //   bei jedem Werkzeugaufruf der Nachbarn neu gerechnet;
          // schreibtGerade — die lokale Vorreparatur schreibt gerade in die
          //   Dateien dieses (Ziel-)Blocks: ein unsichtbarer Schreiber, der für
          //   Welle und geschützte Bereiche wie ein laufender zählt;
          // nachlaufErgebnis — der Berichts-Eintrag des Anlaufs, den der
          //   Rauchtest im Nachlauf noch fortschreibt;
          // nachlaufReihe (0.46.2) — Reihenfolge, in der die Blöcke einer Welle
          //   in den Nachlauf gingen: der zuletzt fertig gewordene ist der
          //   Rückfall der Rauchtest-Attribution, wenn niemand die
          //   Startanleitung gesetzt hat.
          dateiListeAktiv: null,
          schreibtGerade: false,
          nachlaufErgebnis: null,
          nachlaufReihe: 0,
          // entscheidungZielId — solange die Folgen-Frage dieses Prüfers offen
          //   ist: sein Rückführungs-Ziel, aus dem der belegte Zweig gerechnet
          //   wird (offeneFragenZweige).
          entscheidungZielId: null
        }
      ])
    )
    const nummerVon = new Map(kettenIds.map((id, idx) => [id, idx + 1]))
    const vorgaengerVon = new Map(kettenIds.map((id) => [id, []]))
    for (const pfeil of workflow.pfeile) vorgaengerVon.get(pfeil.nach)?.push(pfeil.von)
    const vorfahrenVon = new Map(
      kettenIds.map((id) => [id, vorfahrenSortiert(workflow.bloecke, workflow.pfeile, id)])
    )
    // Kürzeste Distanz jedes Vorfahren (BAUPLAN 34) — entscheidet bei
    // gleichem Etikett, wer übergibt: der nähere allein, gleich nahe alle.
    const distanzVon = new Map(
      kettenIds.map((id) => [id, vorfahrenDistanzen(workflow.bloecke, workflow.pfeile, id)])
    )
    // Empfänger im Auftrag (BAUPLAN 43): Der Vorspann jedes Blocks — Empfänger,
    // Kette, Position — wird EINMAL je Lauf gerechnet, nicht je Anlauf. Er ist
    // eine reine Funktion aus Blöcken und Pfeilen; einmal gerechnet macht das
    // sichtbar, statt es nur zu behaupten: Reparatur-Runde, Nachforderung und
    // Übertrag lesen Wort für Wort denselben Text wie der erste Anlauf.
    const vorspannVon = new Map(
      kettenIds.map((id) => [id, vorspannText(workflow.bloecke, workflow.pfeile, id)])
    )
    // Dieselbe Angabe als eine Zeile für den Ticker — und damit für den
    // Laufbericht, dessen Verlauf der Ticker ist. Der zusammengesetzte Auftrag
    // geht nur an den Motor und wird nirgends aufbewahrt; ohne diese Zeile
    // könnte Georg nie nachsehen, was FlowForge gerechnet hat, sondern nur aus
    // dem Verhalten des Agenten raten (Alltagstest BAUPLAN 43).
    const vorspannZeileVon = new Map(
      kettenIds.map((id) => [id, vorspannZeile(workflow.bloecke, workflow.pfeile, id)])
    )
    // Wie fanOutGemeldet: je Block genau einmal. Der Block-Start läuft nach
    // sanftem Stopp und Wiederaufnahme erneut durch — der Vorspann ändert sich
    // dabei nicht und flutete den Ticker sonst mit demselben Text.
    const vorspannGemeldet = new Set()

    // Karten-Zuteilung (BAUPLAN 29): instanzId → Karten-IDs, gefüllt vom
    // Werkzeug karten_zuteilen der Auftragsquellen-Blöcke. Nicht zugeteilte
    // Blöcke bekommen die volle Auswahl (Rückfall ohne Bruch).
    const kartenZuteilung = new Map()
    kartenFuerBlock = (instanzId) => kartenZuteilung.get(instanzId) ?? ausgewaehlt
    const nachfolgerVon = new Map(kettenIds.map((id) => [id, []]))
    for (const pfeil of workflow.pfeile) nachfolgerVon.get(pfeil.von)?.push(pfeil.nach)
    // Alle Nachfahren eines Blocks entlang der Pfeile, je Instanz eine ADRESSE
    // (BAUPLAN 44). Bis Bauschritt 43 war der Schlüssel der Anzeigename: Zwei
    // Blöcke ohne (oder mit gleichem) Zusatznamen verschmolzen zu EINEM Eintrag,
    // der Agent sah sie als einen und konnte sie weder getrennt beliefern noch
    // getrennt zuteilen. Adressiert wird deshalb über die Blocknummer — sie ist
    // immer eindeutig, auch ohne Zusatznamen, und hält damit jedes schon
    // gespeicherte Schaubild am Laufen.
    // Seit BAUPLAN 43 in der Reihenfolge der Kette statt in der zufälligen
    // Reihenfolge der Tiefensuche: Derselbe Auftrag trägt zwei Listen — vorn im
    // Vorspann die Empfänger (nur wer wirklich etwas bekommt), hinten hier alle
    // Nachfahren (alle bekommen Karten). Gleiche Bezeichnungen und gleiche
    // Reihenfolge sind das Einzige, was sie mechanisch aufeinander beziehbar macht.
    function nachfahrenAdressen(instanzId) {
      const nachfahren = new Set()
      const offen = [...(nachfolgerVon.get(instanzId) ?? [])]
      while (offen.length) {
        const id = offen.pop()
        if (nachfahren.has(id)) continue
        nachfahren.add(id)
        for (const weiter of nachfolgerVon.get(id) ?? []) offen.push(weiter)
      }
      const liste = []
      for (const id of kettenIds) {
        if (!nachfahren.has(id)) continue
        const name = knoten.get(id)?.name
        if (!name) continue
        const nummer = nummerVon.get(id)
        liste.push({
          instanzId: id,
          nummer,
          name,
          adresse: zielAdresse(nummer),
          bezeichnung: texte.ticker.blockBezeichnung(nummer, name)
        })
      }
      return liste
    }

    // Benannte Ziele je Auftragsquelle (BAUPLAN 44) — reine Funktion aus
    // Blöcken und Pfeilen, deshalb wie der Vorspann EINMAL je Lauf gerechnet:
    // Der Agent liest in jeder Reparatur-Runde dieselben Adressen.
    const zieleVon = new Map(
      kettenIds.map((id) => [id, zielListe(workflow.bloecke, workflow.pfeile, id)])
    )

    // Paket melden & Herkunft (BAUPLAN 30): Die Aufgaben-Karten, an denen
    // dieser Lauf arbeitet — gemeldet von Paket schneiden/Diagnose über
    // paket_melden. Seit BAUPLAN 44 JE AUFTRAGSQUELLE statt einmal je Lauf:
    // Zwei Auftragsquellen im Schaubild (Paket schneiden und Diagnose)
    // überschrieben sich vorher wortlos, und die Herkunft jeder Karte trug nur
    // das zuletzt gemeldete Paket — derselbe Fehlertyp, den Bauschritt 41
    // überall sonst beseitigt hat.
    const laufPakete = new Map()
    // Der Maßstab der Vollständigkeitsprüfung (BAUPLAN 44): die ERSTE Meldung
    // je Auftragsquelle, die danach nicht mehr wandert. Ohne sie wäre die
    // Prüfung eine Selbstauskunft: Der billigste Weg, eine Nachforderung zu
    // bestehen, wäre nicht ein zusätzlicher Zuschnitt, sondern ein zweiter
    // paket_melden-Aufruf mit weniger Aufgaben — der Server-Hinweis sagt dem
    // Agenten sogar ausdrücklich, dass ein erneuter Aufruf ersetzt.
    const laufPaketeMassstab = new Map()
    // Rückfall ohne Bruch: Ein Laufstand von vor Bauschritt 44 trägt EINE Liste
    // ohne Block — sie gilt dann wie bisher für alle.
    let laufPaketRueckfall = null
    // Das Paket des nächstgelegenen Auftragsquellen-Vorfahren dieses Blocks —
    // er hat den Auftrag geschnitten, an dem hier gearbeitet wird.
    function paketFuerBlock(instanzId) {
      if (!instanzId) return laufPaketRueckfall
      if (laufPakete.has(instanzId)) return laufPakete.get(instanzId)
      const distanz = distanzVon.get(instanzId)
      let naechste = null
      let treffer = null
      for (const [id, aufgaben] of laufPakete) {
        const naehe = distanz?.get(id)
        if (naehe == null) continue
        if (naechste === null || naehe < naechste) {
          naechste = naehe
          treffer = aufgaben
        }
      }
      return treffer ?? laufPaketRueckfall
    }
    function herkunftFuerBlock(instanzId) {
      const name = instanzId ? knoten.get(instanzId)?.name : null
      const paket = paketFuerBlock(instanzId)
      return {
        quelle: 'block',
        block: name ?? texte.laufberichte.unbekannterBlock,
        laufId: bericht.id,
        laufStart: bericht.gestartetAm,
        ...(paket?.length ? { aufgaben: paket } : {})
      }
    }
    // Der Laufbericht führt das Paket je meldendem Block — sonst zeigte er bei
    // zwei Auftragsquellen nur eines von zweien.
    function paketBerichtSetzen() {
      // Nichts gemeldet heißt: keine Zeile. Eine leere Liste hieße im Bericht
      // „gemeldet, aber leer" — das wäre eine andere Aussage.
      if (laufPakete.size === 0) return
      bericht.paket = [...laufPakete].map(([id, aufgaben]) => ({
        block: texte.ticker.blockBezeichnung(nummerVon.get(id), knoten.get(id)?.name ?? '?'),
        aufgaben: aufgaben.map((a) => a.titel)
      }))
    }
    function paketMeldungAnnehmen({ instanzId, aufgabenIds }) {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return { fehler: geladen.fehler }
      const k = knoten.get(instanzId)
      // Der Validator kennt die Feldwerte des Blocks: Ist das Wunsch-/
      // Fehlerbild-Feld gefüllt, darf die Meldung leer sein.
      const feldGefuellt = (k?.def.felder ?? []).some(
        (feld) => feld.oderOffeneAufgaben && (k.eintrag.feldWerte?.[feld.id] ?? '').trim()
      )
      const urteil = paketMeldungPruefen({
        aufgabenIds,
        karten: geladen.karten,
        ausgewaehlt,
        feldGefuellt
      })
      if (urteil.fehler) return urteil
      const bezeichnung = texte.ticker.blockBezeichnung(
        nummerVon.get(instanzId),
        k?.name ?? '?'
      )
      // Gemessen wird gegen die ERSTE Meldung (BAUPLAN 44). Ein späteres
      // Schrumpfen besteht die Vollständigkeitsprüfung deshalb nicht — und es
      // steht sichtbar im Ticker, statt sich als zweite „Paket gemeldet"-Zeile
      // zu tarnen.
      const massstab = laufPaketeMassstab.get(instanzId)
      if (!massstab) laufPaketeMassstab.set(instanzId, urteil.aufgaben)
      else if (urteil.aufgaben.length < massstab.length)
        tickern(
          texte.ticker.paketGeschrumpft(bezeichnung, massstab.length, urteil.aufgaben.length)
        )
      laufPakete.set(instanzId, urteil.aufgaben)
      paketBerichtSetzen()
      tickern(texte.ticker.paketGemeldet(bezeichnung, urteil.aufgaben.map((a) => a.titel)))
      standSpeichern()
      return { ok: true, meldung: texte.agentenPaket.gemeldet(urteil.aufgaben.length) }
    }

    // Was die Vollständigkeitsprüfung als SOLL-Menge nimmt: der eingefrorene
    // Maßstab dieser Auftragsquelle. Ein Laufstand von vor Bauschritt 44 kennt
    // ihn nicht — dort gilt die zurückgelesene Meldung (Rückfall ohne Bruch).
    // null heißt „noch gar nichts gemeldet" und ist etwas anderes als eine leere
    // Liste („kommt allein aus dem Feld").
    function gemeldetesPaketVon(instanzId) {
      if (laufPaketeMassstab.has(instanzId)) return laufPaketeMassstab.get(instanzId)
      if (laufPakete.has(instanzId)) return laufPakete.get(instanzId)
      return laufPaketRueckfall
    }

    // Und wogegen die aufgabenIds eines Zuschnitts geprüft werden: die AKTUELLE
    // Meldung. Bewusst nicht der Maßstab — korrigiert ein Agent seine
    // Paket-Meldung nach oben, wäre die neue Karte sonst „unbekannt", obwohl er
    // sie gerade erst gemeldet hat. Das Schrumpfen bleibt trotzdem wirkungslos:
    // Gemessen wird oben gegen den Maßstab.
    function aktuellesPaketVon(instanzId) {
      if (laufPakete.has(instanzId)) return laufPakete.get(instanzId)
      return laufPaketRueckfall
    }

    // Eine Motor-Session pro Lauf (BAUPLAN 19): Kennung und Füllstand der
    // Lauf-Session. Die Kennung wandert in den Laufstand — die Wiederaufnahme
    // nach einem App-Neustart setzt dieselbe Session fort statt neu zu starten.
    let laufSessionKennung =
      typeof fortsetzung?.laufSitzung?.kennung === 'string' ? fortsetzung.laufSitzung.kennung : null
    let laufSessionTokens = Number(fortsetzung?.laufSitzung?.tokens) || 0
    // Die Lauf-Session verarbeitet einen Block nach dem anderen — parallele
    // Zweige und die weiteren Schreiber einer Welle laufen als eigene Sessions
    // (ehrlich im Ticker vermerkt).
    let laufMotorBelegt = false
    // Für die Ereignis-Zuordnung des Lauf-Motors: welcher Block gerade in der
    // Lauf-Session arbeitet (Ticker-Zeilen, Mensch-Fragen, Karten-Ereignisse).
    let hauptMotorInstanz = null
    let hauptMotorBlockName = ''

    let endZustand = null
    let fehlertext = ''
    // „Stand wiederherstellen" aus der Folgen-Frage: erst ausführen, wenn alle
    // noch laufenden Blöcke fertig sind — sonst schreibt einer in den
    // zurückgesetzten Ordner hinein.
    let wiederherstellenNachLauf = false
    // Reparatur-Runden je Rückführungs-Ziel (BAUPLAN 41): Bis Bauschritt 40
    // zählte EIN Zähler für den ganzen Lauf — zwei Prüfer hinter zwei Bauern
    // aßen sich gegenseitig die Runden weg. rundenStandard ist die Einstellung
    // des Workflows (ein alter Laufstand kann sie überschreiben).
    const rundenUebrig = new Map() // zielInstanzId → verbleibende Runden
    let rundenStandard = workflow.reparaturRunden
    // Startanleitungs-Pflicht (SPEC §8): genau eine Nachbesserungs-Runde pro
    // Block — unabhängig von den Reparatur-Runden des Prüfers.
    // Tor ohne KI (BAUPLAN 35): Auch der Prüfbefehl und der Rauchtest bekommen
    // je genau EINE Nachbesserungs-Runde. Ohne dieses Budget liefe ein Projekt,
    // dessen App grundsätzlich nicht startet, endlos im Kreis. Seit BAUPLAN 41
    // je Block statt je Lauf: Sonst verbrauchte der erste Prüfer die
    // Nachforderung, und der zweite bekäme nie eine.
    const startanleitungNachgefordert = new Set()
    const pruefbefehlNachgefordert = new Set()
    const rauchtestNachgefordert = new Set()
    // Lieferschein (BAUPLAN 42): dasselbe erprobte Muster — meldet ein Block
    // sein Ergebnis nicht, wird genau einmal nachgefordert; danach gilt er als
    // fehlgeschlagen. Einen Rückfall auf den Abschlusstext gibt es nicht mehr.
    const meldungNachgefordert = new Set()
    // Vollständigkeit des Zuschnitts (BAUPLAN 44): ein EIGENES Set neben den
    // vier vorhandenen. Hinge sie an meldungNachgefordert, schlössen sich beide
    // aus — ein Block, der erst gar nichts meldete und dann unvollständig
    // zuschnitt, gälte sofort als fehlgeschlagen, obwohl er nur nachtragen
    // müsste.
    const zuschnittNachgefordert = new Set()
    // Automatischer Übertrag (SPEC §5): Zähler gegen die Übertragsgrenze,
    // gemeinsam für alle Blöcke des Laufs.
    let uebertraege = 0
    // Kontingent-Pause: eine Windows-Benachrichtigung genügt, auch wenn
    // mehrere parallele Blöcke gleichzeitig pausieren.
    let pauseBenachrichtigt = false
    // Der Verbrauchs-Hinweis für parallele Blöcke kommt einmal pro Lauf.
    let parallelGemeldet = false
    // Die Wellen-Zeile (BAUPLAN 46) kommt einmal je Welle.
    let welleGemeldet = false
    // instanzId → Promise<{ id, ergebnis }> — seit BAUPLAN 46 hängen daneben die
    // offenen Folgen-Fragen ('entscheidung:' + instanzId): Sie sind Teilnehmer
    // desselben Race, damit die Frage den Planer nicht mehr anhält.
    const laufende = new Map()

    // Laufstand festhalten (BAUPLAN 11): Bleibt die App mitten im Lauf stehen
    // (Absturz, Neustart), kann FlowForge an den fertigen Blöcken wieder aufsetzen.
    function standSpeichern() {
      laufstandSpeichern(projektPfad, {
        gestartetAm: bericht.gestartetAm,
        kettenIds,
        // Zusatznamen (BAUPLAN 41): Ein geänderter Name macht den Stand
        // ungültig — die Wiederaufnahme prüft ihn mit (laufstandPasst).
        zusaetze: kette.map((eintrag) => [
          eintrag.instanzId,
          zusatznameBereinigen(eintrag.zusatz)
        ]),
        pfeile: workflow.pfeile.map((p) => [p.von, p.nach]),
        kartenIds: ausgewaehlt,
        fertigIds: kettenIds.filter((id) => knoten.get(id).status === 'fertig'),
        lieferungen: kettenIds
          .filter((id) => knoten.get(id).lieferung != null)
          .map((id) => [id, knoten.get(id).lieferung]),
        // Lieferschein (BAUPLAN 42): Die geprüften Meldungen wandern mit — an
        // ihnen hängen Urteil, Beanstandungen und die Übergaben je Etikett.
        // Ohne sie stünde ein wiederaufgenommener Lauf mit fertigen Blöcken
        // da, deren Lieferung niemand mehr lesen kann.
        meldungen: kettenIds
          .filter((id) => knoten.get(id).meldungen.length > 0)
          .map((id) => [id, knoten.get(id).meldungen]),
        rueckmeldungen: kettenIds
          .filter((id) => knoten.get(id).rueckmeldung)
          .map((id) => [id, knoten.get(id).rueckmeldung]),
        nachpruefungen: kettenIds
          .filter((id) => knoten.get(id).nachpruefung)
          .map((id) => [id, knoten.get(id).nachpruefung]),
        // Lieferschein (BAUPLAN 42): Die Beanstandungen als Felder — daraus
        // filtert der Grün-Fall des Tors die grundsätzlichen heraus.
        nachpruefungFelder: kettenIds
          .filter((id) => knoten.get(id).nachpruefungBeanstandungen.length > 0)
          .map((id) => [id, knoten.get(id).nachpruefungBeanstandungen]),
        nachforderungen: kettenIds.filter((id) => knoten.get(id).startanleitungNachforderung),
        // Kanten-Ehrlichkeit (BAUPLAN 34): Diff-Basis und Vor-Fazit wandern mit
        // — sonst stünde der Bauer nach einem App-Neustart wieder ohne sie da.
        // Der Diff-TEXT selbst nicht: Er wird beim nächsten Anlauf ohnehin
        // frisch gerechnet.
        kanten: kettenIds
          .filter((id) => {
            const nk = knoten.get(id)
            return (
              nk.diffBasis !== undefined ||
              nk.vorFazit ||
              nk.meldungWiederholen ||
              nk.meldungenVorher.length > 0 ||
              nk.torProtokoll ||
              nk.pruefbefehlNachforderung ||
              nk.rauchtestRueckmeldung ||
              nk.zuschnittNachforderung
            )
          })
          .map((id) => {
            const nk = knoten.get(id)
            return [
              id,
              {
                diffBasis: nk.diffBasis ?? null,
                diffBasisVerschmutzt: nk.diffBasisVerschmutzt,
                diffAnfordern: nk.diffAnfordern || Boolean(nk.diffText),
                vorFazit: nk.vorFazit,
                // Lieferschein (BAUPLAN 42): Die Vorlage für eine offene
                // Nachforderung wandert mit — sonst müsste der Block sein
                // Ergebnis nach einem App-Neustart neu erarbeiten.
                meldungWiederholen: nk.meldungWiederholen,
                meldungenVorher: nk.meldungenVorher,
                nachforderungBeleg: nk.nachforderungBeleg,
                // Tor ohne KI (BAUPLAN 35): Diese Zusätze sind teuer erarbeitet
                // (ein echter Befehlslauf) — nach einem App-Neustart stünde der
                // Bauer sonst wieder ohne Protokoll da. Der torGruenBefehl
                // wandert bewusst NICHT mit: Nach einer Unterbrechung ist die
                // Messung veraltet, das Tor läuft dann eben erneut.
                torProtokoll: nk.torProtokoll,
                pruefbefehlNachforderung: nk.pruefbefehlNachforderung,
                rauchtestRueckmeldung: nk.rauchtestRueckmeldung,
                // Tor-Anker des lokalen Prüfers (BAUPLAN 50): Urteil und
                // Tor-Ausgang überleben die Wiederaufnahme — die Abnahme liest
                // sonst „kein Nachspiel", obwohl nachgespielt wurde.
                urteilLokal: nk.urteilLokal ?? null,
                torBestaetigung: nk.torBestaetigung ?? null,
                // Vollständigkeit des Zuschnitts (BAUPLAN 44): Ein offener
                // Nachtrag überlebt den App-Neustart — sonst liefe der Block
                // erneut, ohne zu erfahren, was ihm fehlt.
                zuschnittNachforderung: nk.zuschnittNachforderung
              }
            ]
          }),
        uebergaben: kettenIds
          .filter((id) => knoten.get(id).uebergabe || knoten.get(id).uebergabeVerloren)
          .map((id) => [
            id,
            { text: knoten.get(id).uebergabe, verloren: knoten.get(id).uebergabeVerloren }
          ]),
        // Die Kennung der Lauf-Session wandert mit in den Laufstand
        // (BAUPLAN 19) — die Wiederaufnahme nach einem App-Neustart setzt
        // dieselbe Session fort statt neu zu starten.
        laufSitzung: laufSessionKennung
          ? { kennung: laufSessionKennung, tokens: laufSessionTokens }
          : null,
        // Karten-Zuteilung (BAUPLAN 29): wandert mit in den Laufstand —
        // nach einer Wiederaufnahme arbeiten die Folgeblöcke weiter mit
        // ihrer Teilmenge.
        kartenZuteilung: [...kartenZuteilung],
        // Paket (BAUPLAN 30): die gemeldeten Aufgaben-Karten wandern mit —
        // die Herkunft stimmt auch nach einer Wiederaufnahme. Seit BAUPLAN 44
        // je Auftragsquelle statt einmal je Lauf.
        pakete: [...laufPakete],
        // Sonderlauf (BAUPLAN 30): die Wiederaufnahme baut denselben
        // Ein-Block-Workflow wieder auf.
        sonderlauf,
        // Budgets je Ziel bzw. je Block (BAUPLAN 41) — als Listen, damit sie
        // eine Unterbrechung überstehen.
        rundenUebrig: [...rundenUebrig],
        rundenStandard,
        uebertraege,
        startanleitungNachgefordert: [...startanleitungNachgefordert],
        // Tor ohne KI (BAUPLAN 35): Baseline und verbrauchte Nachforderungen
        // wandern mit — sonst würde nach einem App-Neustart neu gemessen und
        // eine schon verbrauchte Nachbesserungs-Runde erneut gewährt.
        baseline: [...baseline],
        pruefbefehlNachgefordert: [...pruefbefehlNachgefordert],
        rauchtestNachgefordert: [...rauchtestNachgefordert],
        // Lieferschein (BAUPLAN 42): eine verbrauchte Meldungs-Nachforderung
        // wird nach einem Neustart nicht erneut gewährt.
        meldungNachgefordert: [...meldungNachgefordert],
        // Vollständigkeit des Zuschnitts (BAUPLAN 44): ebenso — ohne diesen
        // Eintrag gewährte jeder App-Neustart die Runde erneut.
        zuschnittNachgefordert: [...zuschnittNachgefordert],
        // Und der eingefrorene Maßstab wandert mit: Sonst hieße ein Neustart,
        // dass die geschrumpfte Meldung plötzlich als erste gilt.
        paketeMassstab: [...laufPaketeMassstab]
      })
    }

    // Wartet die Kontingent-Pause ab — im Sekundentakt unterbrechbar, damit
    // „Sanft anhalten" und „Sofort abbrechen" nicht 10 Minuten hängen.
    async function kontingentWarten() {
      const bis = Date.now() + KONTINGENT_PAUSE_MS
      while (Date.now() < bis && !lauf.sanft && !lauf.hart)
        await new Promise((weiter) => setTimeout(weiter, 1000))
    }

    // Wiederaufnahme (BAUPLAN 11): fertige Blöcke samt Lieferungen übernehmen,
    // alles andere läuft erneut.
    if (fortsetzung) {
      for (const id of fortsetzung.fertigIds)
        if (knoten.has(id)) knoten.get(id).status = 'fertig'
      for (const [id, text] of Array.isArray(fortsetzung.lieferungen) ? fortsetzung.lieferungen : [])
        if (knoten.has(id) && typeof text === 'string') knoten.get(id).lieferung = text
      // Lieferschein (BAUPLAN 42): Die geprüften Meldungen kommen zurück —
      // daran hängen Urteil, Beanstandungen und die Übergaben je Etikett.
      for (const [id, liste] of Array.isArray(fortsetzung.meldungen) ? fortsetzung.meldungen : [])
        if (knoten.has(id) && Array.isArray(liste)) {
          const k = knoten.get(id)
          k.meldungen = liste
          k.lieferungen = lieferungenAusMeldungen(liste)
        }
      // Eine wiederhergestellte Rückmeldung ist unverbraucht (BAUPLAN 47): Der
      // Block startet nach der Wiederaufnahme frisch und liest sie erst dann —
      // bis dahin darf ein weiterer Prüfer seine Kritik daran anhängen.
      for (const [id, text] of Array.isArray(fortsetzung.rueckmeldungen) ? fortsetzung.rueckmeldungen : [])
        if (knoten.has(id) && typeof text === 'string') {
          knoten.get(id).rueckmeldung = text
          knoten.get(id).rueckmeldungOffen = text.length > 0
        }
      for (const [id, text] of Array.isArray(fortsetzung.nachpruefungen) ? fortsetzung.nachpruefungen : [])
        if (knoten.has(id) && typeof text === 'string') knoten.get(id).nachpruefung = text
      for (const [id, liste] of Array.isArray(fortsetzung.nachpruefungFelder)
        ? fortsetzung.nachpruefungFelder
        : [])
        if (knoten.has(id) && Array.isArray(liste))
          knoten.get(id).nachpruefungBeanstandungen = liste
      for (const id of Array.isArray(fortsetzung.nachforderungen) ? fortsetzung.nachforderungen : [])
        if (knoten.has(id)) knoten.get(id).startanleitungNachforderung = true
      // Kanten-Ehrlichkeit (BAUPLAN 34): tolerant gegenüber alten Laufständen —
      // ohne Eintrag läuft alles wie vor diesem Schritt, nur ohne Diff.
      for (const [id, kante] of Array.isArray(fortsetzung.kanten) ? fortsetzung.kanten : [])
        if (knoten.has(id) && kante && typeof kante === 'object') {
          const nk = knoten.get(id)
          if (typeof kante.diffBasis === 'string') nk.diffBasis = kante.diffBasis
          nk.diffBasisVerschmutzt = Boolean(kante.diffBasisVerschmutzt)
          nk.diffAnfordern = Boolean(kante.diffAnfordern)
          if (typeof kante.vorFazit === 'string') nk.vorFazit = kante.vorFazit
          // Lieferschein (BAUPLAN 42): offene Nachforderung samt Vorlage.
          nk.meldungWiederholen = Boolean(kante.meldungWiederholen)
          if (Array.isArray(kante.meldungenVorher)) nk.meldungenVorher = kante.meldungenVorher
          if (typeof kante.nachforderungBeleg === 'string')
            nk.nachforderungBeleg = kante.nachforderungBeleg
          // Tor ohne KI (BAUPLAN 35): ebenso tolerant gegenüber alten
          // Laufständen — ohne Eintrag läuft alles wie vor diesem Schritt.
          if (typeof kante.torProtokoll === 'string') nk.torProtokoll = kante.torProtokoll
          // Tor-Anker (BAUPLAN 50) — tolerant: alte Laufstände haben die Felder nicht.
          if (typeof kante.urteilLokal === 'string') nk.urteilLokal = kante.urteilLokal
          if (typeof kante.torBestaetigung === 'string') nk.torBestaetigung = kante.torBestaetigung
          // Seit BAUPLAN 42 ein Ja/Nein: Der Prüfbeleg, den der Prüfer beim
          // Nachtragen wiederholen soll, steckt in meldungenVorher.
          nk.pruefbefehlNachforderung = Boolean(kante.pruefbefehlNachforderung)
          if (typeof kante.rauchtestRueckmeldung === 'string')
            nk.rauchtestRueckmeldung = kante.rauchtestRueckmeldung
          // Vollständigkeit des Zuschnitts (BAUPLAN 44) — ebenso tolerant:
          // Ohne Eintrag läuft alles wie vor diesem Schritt.
          if (typeof kante.zuschnittNachforderung === 'string')
            nk.zuschnittNachforderung = kante.zuschnittNachforderung
        }
      for (const [id, u] of Array.isArray(fortsetzung.uebergaben) ? fortsetzung.uebergaben : [])
        if (knoten.has(id)) {
          knoten.get(id).uebergabe = typeof u?.text === 'string' ? u.text : ''
          knoten.get(id).uebergabeVerloren = Boolean(u?.verloren)
        }
      // Budgets (BAUPLAN 41): Listen sind das heutige Format. Ein alter Stand
      // trägt eine Zahl (Runden für den ganzen Lauf) bzw. ein Ja/Nein je
      // Nachforderung — die Zahl wird zur Vorgabe für jedes Ziel, ein
      // verbrauchtes Ja gilt vorsichtshalber für alle Blöcke (lieber eine
      // Nachforderung zu wenig als eine Endlosschleife).
      if (Array.isArray(fortsetzung.rundenUebrig))
        for (const [id, uebrig] of fortsetzung.rundenUebrig)
          if (knoten.has(id) && Number.isInteger(uebrig)) rundenUebrig.set(id, uebrig)
      if (Number.isInteger(fortsetzung.rundenStandard)) rundenStandard = fortsetzung.rundenStandard
      else if (Number.isInteger(fortsetzung.rundenUebrig)) rundenStandard = fortsetzung.rundenUebrig
      if (Number.isInteger(fortsetzung.uebertraege)) uebertraege = fortsetzung.uebertraege
      // Seit BAUPLAN 44 über die reine Regel budgetAusStand — sie lässt sich
      // ohne Lauf prüfen („ein Neustart gewährt die Runde nicht erneut").
      const kettenEintraege = kette.map((eintrag) => ({
        instanzId: eintrag.instanzId,
        def: defVon(eintrag.blockId)
      }))
      const budgetUebernehmen = (wert, menge, gilt) => {
        for (const id of budgetAusStand(wert, kettenEintraege, gilt)) menge.add(id)
      }
      budgetUebernehmen(
        fortsetzung.startanleitungNachgefordert,
        startanleitungNachgefordert,
        (def) => def?.startanleitungPflicht
      )
      budgetUebernehmen(
        fortsetzung.pruefbefehlNachgefordert,
        pruefbefehlNachgefordert,
        (def) => def?.pruefbefehlPflicht
      )
      budgetUebernehmen(
        fortsetzung.rauchtestNachgefordert,
        rauchtestNachgefordert,
        (def) => def?.startanleitungPflicht
      )
      // Lieferschein (BAUPLAN 42): gilt für jeden Block.
      budgetUebernehmen(fortsetzung.meldungNachgefordert, meldungNachgefordert, () => true)
      // Vollständigkeit des Zuschnitts (BAUPLAN 44): gilt für die
      // Auftragsquellen — sie sind die einzigen, die ein Paket schneiden.
      budgetUebernehmen(
        fortsetzung.zuschnittNachgefordert,
        zuschnittNachgefordert,
        (def) => def?.kartenZuteilung
      )
      // Tor ohne KI (BAUPLAN 35): Die Baseline wurde beim ursprünglichen Start
      // gemessen — sie gilt für den ganzen Lauf und wird nicht neu erhoben.
      // Seit BAUPLAN 41 je Prüf-Instanz; ein alter Stand trug genau eine, die
      // dann für jeden Prüfer gilt.
      const baselineEintrag = (roh) => ({
        befehl: String(roh.befehl),
        ausgabe: String(roh.ausgabe ?? ''),
        zeilen: Array.isArray(roh.zeilen) ? roh.zeilen.filter((z) => typeof z === 'string') : []
      })
      if (Array.isArray(fortsetzung.baseline)) {
        for (const [id, roh] of fortsetzung.baseline)
          if (knoten.has(id) && typeof roh?.befehl === 'string')
            baseline.set(id, baselineEintrag(roh))
      } else if (typeof fortsetzung.baseline?.befehl === 'string') {
        for (const eintrag of kette)
          if (defVon(eintrag.blockId)?.prueft)
            baseline.set(eintrag.instanzId, baselineEintrag(fortsetzung.baseline))
      }
      // Karten-Zuteilung (BAUPLAN 29): tolerant gegenüber alten Laufständen —
      // ohne Eintrag gilt schlicht die volle Auswahl.
      for (const [id, ids] of Array.isArray(fortsetzung.kartenZuteilung)
        ? fortsetzung.kartenZuteilung
        : [])
        if (knoten.has(id) && Array.isArray(ids))
          kartenZuteilung.set(id, ids.filter((kartenId) => typeof kartenId === 'string'))
      // Paket (BAUPLAN 30/44): tolerant gegenüber alten Laufständen — ein Stand
      // von vor Bauschritt 44 trägt EINE Liste ohne Block; sie gilt dann wie
      // bisher für alle. Ein alter Laufstand wird dadurch nicht ungültig.
      const paketEintraege = (liste) =>
        (Array.isArray(liste) ? liste : [])
          .filter((a) => a && typeof a.id === 'string')
          .map((a) => ({ id: a.id, titel: String(a.titel ?? '') }))
      if (Array.isArray(fortsetzung.pakete))
        for (const [id, liste] of fortsetzung.pakete)
          if (knoten.has(id)) laufPakete.set(id, paketEintraege(liste))
      if (Array.isArray(fortsetzung.paket)) laufPaketRueckfall = paketEintraege(fortsetzung.paket)
      // Der eingefrorene Maßstab (BAUPLAN 44) kommt zurück; ein Stand von vor
      // diesem Bauschritt kennt ihn nicht — dann gilt die gespeicherte Meldung
      // als Maßstab, genau wie in einem Lauf ohne zweiten Aufruf.
      if (Array.isArray(fortsetzung.paketeMassstab))
        for (const [id, liste] of fortsetzung.paketeMassstab)
          if (knoten.has(id)) laufPaketeMassstab.set(id, paketEintraege(liste))
      paketBerichtSetzen()
      const naechster = kette.find((eintrag) => knoten.get(eintrag.instanzId).status !== 'fertig')
      if (naechster)
        tickern(
          texte.ticker.wiederaufnahme(
            nummerVon.get(naechster.instanzId),
            kette.length,
            anzeigeVon(naechster)
          )
        )
      bericht.ticker.push({ zeit: jetztIso(), text: texte.laufberichte.fortgesetztHinweis })
    }

    // Karten-Zuteilung (BAUPLAN 29): Das Werkzeug karten_zuteilen der
    // Auftragsquellen-Blöcke landet hier — hart validiert (nur Karten aus der
    // Kartenauswahl, nur echte Nachfahren im Schaubild), dann gemerkt und
    // ehrlich in Ticker und Laufbericht vermerkt. Der Rückgabewert wird das
    // Werkzeug-Ergebnis des Agenten.
    function kartenZuteilungAnnehmen({ instanzId, zuteilung }) {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return { fehler: geladen.fehler }
      const urteil = kartenZuteilungPruefen({
        zuteilung,
        karten: geladen.karten,
        ausgewaehlt,
        ziele: nachfahrenAdressen(instanzId)
      })
      if (urteil.fehler) return urteil
      for (const [id, ids] of urteil.zuteilung) kartenZuteilung.set(id, ids)
      // Der Bericht zeigt den Gesamtstand der Zuteilung — je Block mit
      // Kartenzahl; ein erneuter Aufruf ersetzt die erneut genannten Blöcke.
      // Mit der Blocknummer (BAUPLAN 44): Zwei namensgleiche Ziele ergaben
      // vorher zwei identische Zeilen, und Georg konnte im Laufbericht nicht
      // nachsehen, wer was bekommen hat.
      bericht.kartenZuteilung = [...kartenZuteilung].map(([id, ids]) => ({
        block: texte.ticker.blockBezeichnung(nummerVon.get(id), knoten.get(id)?.name ?? '?'),
        anzahl: ids.length
      }))
      const zeilen = urteil.jeBlock.map((e) => `${e.block} ${e.anzahl}`).join(' | ')
      tickern(texte.ticker.kartenZuteilung(zeilen))
      standSpeichern()
      return { ok: true, meldung: texte.agentenKartenZuteilung.gespeichert(zeilen) }
    }

    // Baut einen Motor: den Lauf-Motor (mit Fortsetzung der Lauf-Session)
    // oder einen eigenen Motor für einen parallelen Zweig. Die Ereignis-
    // Zuordnung (welcher Block, welche Karte) liefern die Hol-Funktionen —
    // beim Lauf-Motor wechseln sie mit jedem Block.
    // lokalOption (BAUPLAN 49): { adresse, modell, kontext } — dann läuft
    // dieser Motor gegen Georgs lokale KI (Ollama) statt gegen Claude; nur für
    // Blöcke der Klasse „lokal", immer als eigene Instanz, nie die Lauf-Session.
    function motorBauen(fortsetzen, holeInstanz, holeName, lokalOption = null) {
      return starteLaufMotor({
        projektPfad,
        modus: einstellungen.motorModus,
        apiSchluessel: einstellungen.apiSchluessel,
        ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
        fortsetzen,
        lokaleHelfer,
        ...(lokalOption
          ? { lokal: { adresse: lokalOption.adresse, modell: lokalOption.modell, kontext: lokalOption.kontext } }
          : {}),
        nurLesenBefehle: Boolean(einstellungen.nurLesenBefehle),
        // Lieferschein (BAUPLAN 42): Beim Laufstart steht das Schaubild fest —
        // registriert werden genau die Melde-Werkzeuge dieser Kette.
        lieferscheinWerkzeuge: werkzeugeFuerKette(kette.map((eintrag) => defVon(eintrag.blockId))),
        ...(bekanntesKontextFenster > 0 ? { kontextFenster: bekanntesKontextFenster } : {}),
        aufEreignis(e) {
          // Ticker-Zeilen bekommen den Blocknamen vorangestellt, sobald
          // mehrere Blöcke gleichzeitig laufen — sonst nicht zuzuordnen.
          const daten =
            e.art === 'ticker' && lauf.aktiveInstanzen.size > 1 && holeName()
              ? { ...e, text: `${holeName()}: ${e.text}` }
              : e
          if (daten.art === 'ticker') bericht.ticker.push({ zeit: jetztIso(), text: daten.text })
          // Lokale Helfer-KI: Recherchen und Schritte für den Laufbericht
          // zählen (Wunsch Georg, 13.08.2026) — der Effekt steht damit
          // schwarz auf weiß im Bericht statt nur verstreut im Ticker.
          // Metriken (BAUPLAN 31): Jedes Urteil (und jeder gescheiterte
          // Kreislauf) geht zusätzlich in die globale Metrik-Datei — je Modell
          // und Bereich, über alle Läufe hinweg auswertbar.
          if (daten.art === 'lokale-helfer') {
            const l = helferZaehler()
            l.recherchen++
            l.schritte += daten.schritte ?? 0
            if (daten.gescheitert) {
              l.gescheitert++
              metrikUrteil(holeName(), 'recherche', 'gescheitert', daten.schritte)
            }
            return
          }
          // Lokale Entwürfe (BAUPLAN 21): Entwürfe und ihre Abnahme
          // (übernommen/verworfen) landen ehrlich in der Helfer-Zeile.
          // Trefferquote (BAUPLAN 23): je Recherche-Fazit, ob der Agent es
          // übernommen oder verworfen hat — die Quote steht im Bericht.
          if (daten.art === 'lokale-helfer-recherche-urteil') {
            const l = helferZaehler()
            if (daten.uebernommen) l.recherchenUebernommen = (l.recherchenUebernommen ?? 0) + 1
            else l.recherchenVerworfen = (l.recherchenVerworfen ?? 0) + 1
            metrikUrteil(
              holeName(),
              'recherche',
              daten.uebernommen ? 'uebernommen' : 'verworfen',
              daten.schritte
            )
            return
          }
          if (daten.art === 'lokale-helfer-entwurf') {
            const l = helferZaehler()
            l.schritte += daten.schritte ?? 0
            if (daten.entwurf) l.entwuerfe = (l.entwuerfe ?? 0) + 1
            else {
              l.entwuerfeGescheitert = (l.entwuerfeGescheitert ?? 0) + 1
              metrikUrteil(holeName(), 'entwurf', 'gescheitert', daten.schritte)
            }
            return
          }
          if (daten.art === 'lokale-helfer-entwurf-urteil') {
            const l = helferZaehler()
            if (daten.uebernommen) l.entwuerfeUebernommen = (l.entwuerfeUebernommen ?? 0) + 1
            else l.entwuerfeVerworfen = (l.entwuerfeVerworfen ?? 0) + 1
            metrikUrteil(
              holeName(),
              'entwurf',
              daten.uebernommen ? 'uebernommen' : 'verworfen',
              daten.schritte
            )
            return
          }
          // Lokaler Bauer (BAUPLAN 22): Bau-Versuche und die Abnahme je
          // Teilstück (gehalten / vom Agenten selbst gebaut) in der Helfer-Zeile.
          if (daten.art === 'lokale-helfer-bauen') {
            const l = helferZaehler()
            l.schritte += daten.schritte ?? 0
            if (daten.gescheitert) {
              l.teilstueckeGescheitert = (l.teilstueckeGescheitert ?? 0) + 1
              metrikUrteil(holeName(), 'bauen', 'gescheitert', daten.schritte)
            }
            return
          }
          if (daten.art === 'lokale-helfer-teilstueck-urteil') {
            const l = helferZaehler()
            if (daten.gehalten) l.teilstueckeGehalten = (l.teilstueckeGehalten ?? 0) + 1
            else l.teilstueckeVerworfen = (l.teilstueckeVerworfen ?? 0) + 1
            metrikUrteil(
              holeName(),
              'bauen',
              daten.gehalten ? 'gehalten' : 'nicht-gehalten',
              daten.schritte
            )
            return
          }
          // Compaction sichtbar (BAUPLAN 36): Der Motor hat ein Arbeits-
          // gedächtnis zusammengefasst — Ticker-Zeile in Alltagssprache und
          // ein Eintrag im Laufbericht, damit spätere Gedächtnislücken
          // erklärbar bleiben.
          if (daten.art === 'zusammenfassung') {
            const zeile = texte.ticker.zusammengefasst(daten)
            bericht.zusammenfassungen.push({ zeit: jetztIso(), wer: daten.wer, text: zeile })
            tickern(zeile)
            return
          }
          // Startanleitung in der Welle (0.46.2): Das Werkzeug meldet, wer
          // gesetzt hat und was vorher galt. Ersetzt ein Block die Anleitung
          // eines ANDEREN Blocks dieses Laufs, der gerade Revier belegt, sagt
          // der Ticker es mit beiden Befehlen — sonst gewann der letzte
          // Schreiber still. Derselbe Block (Nachbesserungs-Runde) tickert
          // nicht. Das Ereignis geht danach unverändert an die Oberfläche.
          if (daten.art === 'startanleitung') {
            const wer = daten.gesetztVon ?? holeInstanz()
            const vorherVon = daten.vorher?.gesetztVon ?? null
            const anderer = vorherVon && vorherVon !== wer ? knoten.get(vorherVon) : null
            if (anderer && schreiberBelegt(wellenKnoten(anderer))) {
              const kurz = (a) => a?.befehl || a?.adresse || ''
              tickern(
                texte.ticker.startanleitungErsetzt(
                  knoten.get(wer)?.name ?? holeName() ?? wer,
                  anderer.name,
                  kurz(daten.vorher),
                  kurz(daten.anleitung)
                )
              )
            }
          }
          // Letzter Kontext-Stand am Lauf gespiegelt — der Kontext-Balken der
          // Projektübersicht braucht ihn außerhalb der Lauf-Ansicht.
          if (daten.art === 'verbrauch' && daten.verbrauch?.kontextProzentBis != null)
            lauf.kontext = {
              von: daten.verbrauch.kontextProzentVon ?? 0,
              bis: daten.verbrauch.kontextProzentBis
            }
          senden({ instanzId: holeInstanz(), ...daten })
        },
        aufRechteFrage: rechteFrageStellen,
        aufMenschFrage: (daten) => menschFrageStellen(daten, holeName()),
        aufKartenVorschlag: (vorschlag) => vorschlagStellen(vorschlag, holeName()),
        aufLaufVorschlag: laufVorschlagAnnehmen,
        aufKartenZuteilung: kartenZuteilungAnnehmen,
        // Paket melden & Herkunft (BAUPLAN 30).
        aufPaketMeldung: paketMeldungAnnehmen,
        holeHerkunft: herkunftFuerBlock,
        // Vollständigkeit (BAUPLAN 44): Gegen das gemeldete Paket werden die
        // aufgabenIds eines Zuschnitts hart geprüft — ohne diese Verbindung
        // wäre die Vollständigkeit wieder Textraten.
        holePaket: aktuellesPaketVon
      })
    }

    // Besorgt den Lauf-Motor — bei Bedarf neu (erster Block, Prozess-Tod,
    // Übertrag). Eine noch brauchbare frühere Lauf-Session wird über ihre
    // Kennung fortgesetzt; der Fortsetzungs-Wächter erzwingt eine frische
    // Session, wenn die alte schon nahe der Übertrags-Schwelle liegt.
    function laufMotorBesorgen() {
      if (lauf.laufMotor && !lauf.laufMotor.istTot()) return lauf.laufMotor
      let fortsetzen = laufSessionKennung
      const fenster =
        bekanntesKontextFenster > 0 ? bekanntesKontextFenster : KONTEXT_FENSTER_STANDARD
      if (fortsetzen && (laufSessionTokens / fenster) * 100 >= FORTSETZUNG_WAECHTER_PROZENT)
        fortsetzen = null
      lauf.laufMotor = motorBauen(
        fortsetzen,
        () => hauptMotorInstanz,
        () => hauptMotorBlockName
      )
      return lauf.laufMotor
    }

    // Führt einen Block als frischen Agenten aus — in der Lauf-Session, oder
    // (wenn dort gerade ein anderer Block arbeitet) als eigene Session.
    function blockAusfuehren(k, auftrag, uebertragErlaubt) {
      const instanzId = k.eintrag.instanzId
      // Datenvertrag als Schreibsperre (BAUPLAN 44): Dass sie gilt, sagt der
      // Ticker EINMAL je Block — nicht in jeder Reparatur-Runde erneut.
      // Frisch gerechnet und am Knoten gemerkt (BAUPLAN 46): Die Nachbarn in der
      // Welle fragen bei jedem Werkzeugaufruf nach den geschützten Bereichen —
      // dort zählt diese Liste, ohne den Übergaben-Durchlauf zu wiederholen.
      const dateiListe = dateiListeFuer(k)
      k.dateiListeAktiv = dateiListe
      if (dateiListe && !k.dateilisteGemeldet) {
        k.dateilisteGemeldet = true
        tickern(
          texte.ticker.dateilisteAktiv(
            texte.ticker.blockBezeichnung(nummerVon.get(instanzId), k.name),
            dateiListe.length
          )
        )
      }
      const uebertrag = {
        aktiv: uebertragErlaubt,
        testModus: Boolean(einstellungen.uebertragTest),
        anweisung: texte.agentenLaufSession.uebertragAnweisung
      }
      const klasse = blockModellKlasse(k.def, k.eintrag)
      const istLokal = klasseIstLokal(klasse)
      let motor
      let haupt = false
      if (istLokal) {
        // Lokale Klasse (BAUPLAN 49/51): IMMER eine eigene Motor-Instanz mit
        // Ollama-Umgebung — nie die Lauf-Session (die läuft gegen Claude und
        // ihr Koordinator auf Haiku), nie `haupt`. Nach dem Block wird sie
        // geschlossen wie ein Zweig-Motor. Die Adresse kommt aus der
        // Zuteilung des Knotens (bereiteStarten, Adress-Pool BAUPLAN 51) —
        // sie gilt für alle Anläufe dieses Blocks. Fehlt sie, ist das ein
        // harter Fehler: nie ein stiller Griff zur ersten Adresse, der führe
        // zwei Motoren auf eine GPU.
        if (!k.lokalZuteilung)
          return Promise.resolve({
            zustand: 'fehlgeschlagen',
            fehlertext: texte.lauf.lokalOhneZuteilung(k.name),
            fehlerArt: null,
            ergebnisText: '',
            verbrauch: null,
            denktiefeGemessen: null
          })
        tickern(texte.ticker.lokalEigeneSession(k.name, k.lokalZuteilung.modell))
        motor = motorBauen(
          null,
          () => instanzId,
          () => k.name,
          k.lokalZuteilung
        )
      } else if (!laufMotorBelegt) {
        motor = laufMotorBesorgen()
        haupt = true
        laufMotorBelegt = true
        hauptMotorInstanz = instanzId
        hauptMotorBlockName = k.name
      } else {
        // Parallele Zweige (BAUPLAN 19): Die Lauf-Session verarbeitet einen
        // Block nach dem anderen — parallele Blöcke laufen ehrlich vermerkt
        // in eigenen Sessions.
        tickern(texte.ticker.parallelEigeneSession(k.name))
        motor = motorBauen(
          null,
          () => instanzId,
          () => k.name
        )
      }
      lauf.motoren.set(instanzId, motor)
      return motor
        .blockAusfuehren({
          auftrag,
          blockName: k.name,
          // Karten-Zuteilung (BAUPLAN 29): Die Instanz-Kennung ordnet
          // Zuteilung und Projektwissen dem laufenden Block zu.
          instanzId,
          nurLesen: k.def.nurLesen,
          // Nur Prüf-Blöcke dürfen die Prüfmappe verändern (Entscheidung Georg,
          // 12.08.2026) — der Bauer weicht sonst Prüfungen auf, statt zu reparieren.
          darfPruefen: Boolean(k.def.prueft),
          // Und jeder Prüfer nur seinen eigenen Unterordner (BAUPLAN 41).
          pruefOrdner: k.pruefOrdner,
          // Audit (BAUPLAN 25): nur-lesend für Dateien und Befehle, darf aber
          // Karten anlegen — Befunde werden Aufgaben-Karten.
          darfKartenAnlegen: Boolean(k.def.darfKartenAnlegen),
          // Karten-Prüfer (BAUPLAN 26): darf Karten-Vorschläge machen —
          // entschieden wird jeder vom Nutzer, angewendet von FlowForge.
          darfVorschlagen: Boolean(k.def.kartenVorschlaege),
          // Sessionende (BAUPLAN 28): darf die Kartenauswahl für den
          // nächsten Lauf vorschlagen — nur ein Vorschlag, nie eine Automatik.
          darfLaufVorschlag: Boolean(k.def.laufVorschlag),
          // Auftragsquellen (BAUPLAN 29): dürfen den Nachfolgern Karten
          // zuteilen — nicht Genannte bekommen die volle Auswahl.
          darfZuteilen: Boolean(k.def.kartenZuteilung),
          // Häkchen je Block (BAUPLAN 20): abgewählt = lokal_recherchieren
          // wird für die Agenten dieses Blocks hart abgelehnt.
          lokaleKi: k.eintrag.lokaleKi !== false,
          // Lieferschein (BAUPLAN 42): was dieser Block liefert — daraus ergibt
          // sich das Etikett seiner Meldung — und welches Melde-Werkzeug für
          // ihn freigeschaltet ist. Fremde lösen die Rechte-Rückfrage aus.
          liefert: k.def.liefert ?? [],
          lieferscheinFrei: [...werkzeugeFuerBlock(k.def)],
          // Zuschnitt je benanntem Ziel (BAUPLAN 44): die Umsetzer hinter
          // diesem Block — gegen sie validiert das Melde-Werkzeug die
          // Zieladresse eines Zuschnitts.
          ziele: zieleVon.get(instanzId) ?? [],
          // Datenvertrag als Schreibsperre (BAUPLAN 44): die erlaubten Dateien
          // der bei diesem Block angekommenen Arbeitspakete — null heißt „keine
          // Sperre" (kein Paket, kein Vertrag, alter Laufstand).
          dateiListe,
          // Welle (BAUPLAN 46, Vertrag S5): Der Motor fragt bei jedem
          // Werkzeugaufruf, ob neben diesem Block gerade ein anderer Schreiber
          // arbeitet — dann werden sonst rückfragefreie Befehle zur Rückfrage
          // (SPEC §7). Dynamisch, weil die Welle mitten im Anlauf beginnen und
          // enden kann.
          inWelle: () => andererSchreiberLaeuft(k),
          // Sicherungspunkte je Schreiber (BAUPLAN 45): Strang und geschützte
          // Bereiche DIESES Blocks. Die lokalen Helfer-Werkzeuge legen ihre
          // Punkte darauf an und rollen nur darauf zurück — bis hierher hing
          // dieser Zustand an der Motor-Session, die alle Blöcke nacheinander
          // bedient (BAUPLAN 19), und der nächste Block rollte die Arbeit des
          // vorigen zurück.
          sicherung: {
            kennung: instanzId,
            bezeichnung: texte.ticker.blockBezeichnung(nummerVon.get(instanzId), k.name),
            strang: k.strang ?? null,
            geschuetzt: geschuetzteBereicheFuer(k),
            // Seit der Welle (BAUPLAN 46) frisch je Aufruf: Ein Nachbar kann
            // nach dem Start dieses Blocks anlaufen oder in den Nachlauf gehen —
            // der Startwert oben bliebe dann falsch. `geschuetzt` bleibt als
            // Rückfall für einen Motor ohne holeGeschuetzt.
            holeGeschuetzt: () => geschuetzteBereicheFuer(k),
            // Sein EIGENER Wirkbereich (Nacharbeit zu BAUPLAN 45): die Notbremse
            // für den Fall, dass der Rückroll-Punkt eines Teilstücks inzwischen
            // von der Zusammenführung eines anderen Blocks überholt wurde.
            eigenerBereich: k.wirkbereich ?? null
          },
          // Modellklasse je Block (BAUPLAN 37): die Wahl an der Blockkarte,
          // sonst die Voreinstellung des Blocks. Der Motor trägt sie beim
          // Agent-Aufruf ein; das Modell der Unteraufgaben hängt zusätzlich
          // an der Einstellung „Unteraufgaben der Block-Agenten".
          // Lokal (BAUPLAN 49): Platzhalter 'lokal' — der lokale Motor setzt
          // den Ollama-Namen selbst ein; der Klartext nennt ihn schon hier.
          modell: istLokal ? 'lokal' : sdkModell(klasse),
          unterModell: istLokal
            ? 'lokal'
            : unterModellFuer(k.def, klasse, einstellungen.unteraufgabenModell),
          modellName: istLokal
            ? texte.kette.lokalModellName(k.lokalZuteilung.modell)
            : (texte.kette.modellNamen[klasse] ?? ''),
          uebertrag,
          // Denktiefe (0.48.1): die Wahl an der Karte (sonst Voreinstellung des
          // Blocks), ihr Kurzname für den Ticker — nur genannt, was Georg
          // gewählt hat, Modell-Standard bleibt stumm — und die Klasse, damit
          // der Motor bei Haiku keine effort-Definition wählt.
          denktiefe: blockDenktiefe(k.def, k.eintrag),
          denktiefeName:
            blockDenktiefe(k.def, k.eintrag) === DENKTIEFE_STANDARD
              ? ''
              : (texte.kette.denktiefeKurz[blockDenktiefe(k.def, k.eintrag)] ?? ''),
          klasse
        })
        .catch((fehler) => ({
          zustand: 'fehlgeschlagen',
          fehlertext: String(fehler?.message ?? fehler),
          fehlerArt: null,
          ergebnisText: '',
          verbrauch: null,
          denktiefeGemessen: null
        }))
        .finally(() => {
          lauf.motoren.delete(instanzId)
          if (haupt) {
            laufMotorBelegt = false
            hauptMotorInstanz = null
            hauptMotorBlockName = ''
            if (motor.sessionKennung) {
              laufSessionKennung = motor.sessionKennung
              laufSessionTokens = motor.tokens
            }
          } else {
            // Der Zweig-Motor hat seine Aufgabe erledigt — Session schließen.
            motor.beenden()
          }
        })
    }

    // Lieferschein (BAUPLAN 42): der Werkzeug-Hinweis für genau diesen Block.
    // Er hängt NICHT im Blockkatalog, sondern kommt von FlowForge — nur so
    // meldet auch ein selbstgebauter Block, ohne dass sein Autor das Werkzeug
    // kennen muss (Prüfstein „Kein Kennzeichen ohne Editor-Feld", BAUPLAN-Regel).
    function lieferscheinZusatz(k) {
      const werkzeuge = [...werkzeugeFuerBlock(k.def)]
      if (werkzeuge.length === 0) return ''
      // Der Rahmen trägt bei genau einem lockeren Etikett dessen Namen — bei
      // mehreren sagt der Zusatz, dass das Etikett mitgegeben werden muss.
      const etiketten = k.def.liefert ?? []
      const einzeln =
        werkzeuge.length === 1 && etiketten.length === 1 ? etiketten[0] : null
      let zusatz = texte.lieferschein.auftragZusatz(werkzeuge[0], einzeln)
      if (werkzeuge.length > 1) zusatz += texte.lieferschein.mehrereWerkzeuge(werkzeuge)
      else if (werkzeuge[0] === RAHMEN_WERKZEUG && etiketten.length > 1)
        zusatz += texte.lieferschein.etikettFehlt(etiketten)
      return zusatz
    }

    // Welche Baseline gehört in den Auftrag dieses Blocks? Ein Prüfer sieht
    // seine eigene (er urteilt über seinen Zweig), ein Bau-Block alle.
    // Ein zusammenführender Block, der Code anfasst (BAUPLAN 47, Integrator
    // (Code)), ebenfalls alle: Er prüft die Nähte zwischen gelieferten Teilen
    // und soll Altlasten nicht als Naht-Fehler melden.
    function baselineFuer(k) {
      if (k.def.prueft) {
        const eigen = baseline.get(k.eintrag.instanzId)
        return eigen ? [eigen] : []
      }
      return k.def.startanleitungPflicht || (k.def.fuehrtZusammen && !k.def.nurLesen)
        ? [...baseline.values()]
        : []
    }

    // Führt einen Block vollständig aus: Auftrag bauen, Motor laufen lassen,
    // Überträge und Kontingent-/Server-Pausen durchstehen — bis ein endgültiges
    // Ergebnis da ist. Läuft für parallele Blöcke gleichzeitig.
    async function knotenAusfuehren(k) {
      // Punkt-Strang je Schreiber (BAUPLAN 45): VOR allem anderen — ab hier
      // laufen alle Sicherungspunkte dieses Blocks auf seinen Strang, und der
      // Diff unten braucht seinen Wirkbereich.
      await strangOeffnenFuer(k)
      // Lieferschein (BAUPLAN 42): Ein neuer Anlauf des Blocks (Reparatur-Runde,
      // Nachforderung) beginnt ohne Meldung — sonst gälte still das Urteil des
      // letzten Anlaufs weiter. Die alte bleibt als Vorlage erhalten. Ein
      // ÜBERTRAG verlässt diese Funktion nicht: Dort bleibt die Meldung stehen
      // und wird vom Nachfolger je Etikett überschrieben.
      if (k.meldungen.length) k.meldungenVorher = k.meldungen
      k.meldungen = []
      // Lokaler Prüfer (BAUPLAN 50): Urteil und Tor-Anker gehören zum Anlauf —
      // ein neuer Anlauf beginnt ohne (sonst läse die Abnahme den alten Stand,
      // wenn dieser Anlauf schon am Vor-Tor endet).
      k.urteilLokal = null
      k.torBestaetigung = null
      // Verbrauch aller Sessions dieses Block-Anlaufs (auch über Überträge und
      // Pausen hinweg) — landet sichtbar am Block-Ergebnis im Laufbericht.
      let blockTokens = 0
      let blockKosten = null
      // Block-Dauer (BAUPLAN 51, Vertrag V2): Summe der Wanduhrzeiten aller
      // Anläufe dieses Blocks — je Anlauf von Motorstart bis Ergebnis,
      // gemessen unten um den blockAusfuehren-Aufruf. Rechte-Rückfragen
      // MITTEN in einem Anlauf zählen mit; Wartezeiten ZWISCHEN Anläufen
      // (Warteschlange, Kontingent-Pause, Folgen-Frage) zählen nicht —
      // die Grenze steht ehrlich in SPEC §3.4.
      let blockDauerMs = 0
      // Die Klasse dieses Knotens einmal je Anlauf: Verbrauchs-Zufluss
      // („davon lokal") und Kontextfenster-Wächter unten brauchen sie je
      // Schleifenrunde.
      const knotenLokal = klasseIstLokal(blockModellKlasse(k.def, k.eintrag))
      const blockAufschluesselung = { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
      let blockHatAufschluesselung = false
      // Modell je Block (BAUPLAN 36): über alle Anläufe dieses Block-Anlaufs
      // hinweg (Übertrag, Kontingent-Pausen) — Modellkennung → Tokens.
      const blockModellTokens = new Map()
      // Denktiefe gemessen (0.48.1): die vom Motor gemeldete wirksame Stufe —
      // der letzte gemessene Wert über alle Anläufe/Überträge dieses Blocks;
      // null, solange keine CLI eine gemeldet hat (Haiku, Tor ohne KI).
      let blockDenktiefeGemessen = null
      // Diff der Reparatur-Runden (BAUPLAN 34): Beim ERSTEN Start eines
      // schreibenden Blocks halten wir fest, auf welchem Sicherungspunkt der
      // Projektordner steht — daraus rechnet FlowForge später „das hast du in
      // diesem Lauf bisher geändert" (kumulativ über alle Runden).
      if (!k.def.nurLesen && k.diffBasis === undefined) {
        // Basis und Spitze müssen auf DEMSELBEN Strang gelesen werden
        // (BAUPLAN 45) — sonst zeigen beide auf den gemeinsamen Stand, sind
        // dieselbe id, und der Diff fällt lautlos auf leer zurück.
        k.diffBasis = await letzterPunktId(projektPfad, k.strang ?? null)
        // Ehrliche Grenze: Hat vorher ein nur-lesender Block per Befehl Dateien
        // verändert, steckt das mit im Diff — dann sagt der Auftrag es dazu.
        // Nachsehen lohnt nur, wenn das überhaupt möglich war: Ohne die
        // Einstellung „Nur-lesende Blöcke dürfen Befehle ausführen" ändert kein
        // nur-lesender Block etwas, und der Blick über den ganzen Ordner entfällt.
        // Bewusst NICHT durch die Welle ausgelöst (BAUPLAN 46): Dass nebenan ein
        // anderer Schreiber gerade seine eigenen Dateien ändert, ist keine
        // Verschmutzung — sein Wirkbereich fällt beim Diff dieses Blocks ohnehin
        // durch den Dateilisten-Filter (diffFilterVon), und der Hinweis „der
        // Ordner war schon verändert" wäre in jeder Welle dauerhaft an.
        k.diffBasisVerschmutzt =
          Boolean(k.diffBasis) && einstellungen.nurLesenBefehle
            ? await standWeichtAb(projektPfad, k.strang ?? null)
            : false
      }
      // Tor ohne KI (BAUPLAN 35): Steht eine Nachprüfung an und liegt ein
      // Prüfbefehl vor, prüft FlowForge zuerst selbst nach. Ist es rot, ist
      // dieser Block-Anlauf hier schon zu Ende — ohne Motor, ohne Tokens.
      if (k.def.prueft && k.nachpruefung) {
        // Abnahme (BAUPLAN 50): Endet dieser Anlauf schon am Vor-Tor, baut
        // niemand den Auftrag neu — die Quellen des letzten Auftragsbaus
        // trügen dann einen veralteten Tor-Ausgang des lokalen Partners.
        // Dieselben Partner, frisch gelesen.
        if (k.abnahmeQuellen?.length)
          k.abnahmeQuellen = k.abnahmeQuellen.map((q) => abnahmeQuelleVon(q.instanzId) ?? q)
        const torErgebnis = await torAbspielen(k)
        if (torErgebnis) {
          // Auch das Tor liefert eine Meldung — sie ersetzt die des letzten
          // Anlaufs, damit Urteil und Beanstandungen aus einer Quelle kommen.
          k.meldungen = meldungenZusammenfuehren(k.meldungen, torErgebnis.meldungen)
          return torErgebnis
        }
      }
      // Hängt die Verbrauchs-Summen dieses Blocks an ein endgültiges Ergebnis.
      function mitBlockVerbrauch(ergebnis) {
        const summe = [...blockModellTokens.values()].reduce((a, b) => a + b, 0)
        return {
          ...ergebnis,
          blockTokens,
          blockKosten,
          // Block-Dauer (BAUPLAN 51): die Summe der Anlauf-Wanduhrzeiten —
          // landet als dauerMs an allen vier Bericht-Einträgen.
          blockDauerMs,
          blockAufschluesselung: blockHatAufschluesselung ? { ...blockAufschluesselung } : null,
          // Modell je Block (BAUPLAN 36): null = kein Modell gemessen (alte
          // Berichte, Tor ohne KI) — das ist etwas anderes als „0 Tokens".
          blockModelle:
            summe > 0
              ? [...blockModellTokens]
                  .map(([modell, tokens]) => ({ modell, tokens, anteil: tokens / summe }))
                  .sort((a, b) => b.tokens - a.tokens)
              : null,
          blockDenktiefeGemessen
        }
      }
      while (true) {
        standSpeichern()
        // Diff für diesen Anlauf rechnen (BAUPLAN 34) — erst jetzt, denn beim
        // Prüfer zählt der Stand NACH der Reparatur-Runde des Bauers.
        if (k.diffAnfordern) {
          k.diffAnfordern = false
          k.diffText = await diffTextFuer(k)
        }
        // Jeder Anlauf ist ein frischer Agent in der Lauf-Session (BAUPLAN 19):
        // Auch Reparatur-Runden bekommen den vollen Auftrag samt Zusatz —
        // Rückmeldung, Nachforderung und Übergabe bleiben am Knoten, bis der
        // Block wirklich fertig ist.
        // Karten-Zuteilung (BAUPLAN 29): Ein zugeteilter Block bekommt nur
        // seine Teilmenge in den Auftrag (die Status-Karte immer) — sonst
        // wie bisher die volle Auswahl.
        // Empfänger im Auftrag (BAUPLAN 43): Der Vorspann steht GANZ vorn — vor
        // Karten-Kontext und Übergaben. Er ist die Ortsangabe („wo stehe ich,
        // wer bekommt meine Lieferung"), alles danach ist Inhalt: Karten,
        // Übergaben und der Katalog-Auftrag lesen sich erst richtig, wenn klar
        // ist, für wen gearbeitet wird. Weiter hinten stünde er zwischen zwei
        // Inhaltsblöcken und läse sich wie ein Nachtrag.
        let auftrag =
          (vorspannVon.get(k.eintrag.instanzId) ?? '') +
          kartenKontext(projektPfad, kartenFuerBlock(k.eintrag.instanzId)) +
          uebergabenText(k) +
          texte.agentenUebergabe.auftragEinleitung +
          auftragMitFeldern(k.def, k.eintrag.feldWerte)
        // Auftragsquellen-Blöcke (Kennzeichen kartenZuteilung) bekommen das
        // Werkzeug samt der Namen ihrer Nachfahren erklärt — ohne Nachfahren
        // (Ein-Block-Lauf) gibt es nichts zuzuteilen, der Zusatz entfällt.
        // Prüfordner je Prüf-Instanz (BAUPLAN 41): Der Auftrag nennt ihn — die
        // Sperre am Werkzeugaufruf setzt ihn durch, und der Prüfbefehl muss
        // genau ihn ausführen.
        if (k.pruefOrdner) auftrag += texte.agentenPruefordner.zusatz(k.pruefOrdner)
        if (k.def.kartenZuteilung) {
          const nachfahren = nachfahrenAdressen(k.eintrag.instanzId)
          if (nachfahren.length)
            auftrag += texte.agentenKartenZuteilung.auftragZusatz(
              nachfahren.map((z) => z.bezeichnung)
            )
          // Paket melden (BAUPLAN 30): auch im Ein-Block-Lauf — die Herkunft
          // der Karten hängt daran.
          auftrag += texte.agentenPaket.auftragZusatz
        }
        // Zuschnitt je benanntem Ziel (BAUPLAN 44): Wer das Arbeitspaket
        // liefert, bekommt seine Ziele mit Adresse genannt — je Zeile eine.
        // Bei genau einem Ziel bleibt es beim knappen Satz: Es gibt nichts
        // auseinanderzuhalten, und der Auftrag soll nicht wachsen. Der Teil zu
        // aufgabenIds hängt am Kennzeichen kartenZuteilung, nicht am Etikett —
        // sonst verspricht der Auftrag einem selbstgebauten Block etwas, das er
        // nicht einlösen darf (zuschnittAuftragZusatz).
        if ((k.def.liefert ?? []).includes(ARBEITSPAKET_ETIKETT))
          auftrag += zuschnittAuftragZusatz(
            zieleVon.get(k.eintrag.instanzId) ?? [],
            Boolean(k.def.kartenZuteilung)
          )
        // Prüfkarten (BAUPLAN 18): gezogene alte Prüfungen werden zusätzlich
        // zur Paket-Prüfung ausgeführt — der Zusatz gehört in jeden
        // Anlauf dieses Blocks (auch nach einem Übertrag).
        const pruefkarten = pruefkartenVonInstanz.get(k.eintrag.instanzId)
        if (pruefkarten)
          auftrag +=
            texte.agentenPruefkarten.einleitung +
            pruefkarten
              .map((anhang) =>
                anhang.dateien
                  ? texte.agentenPruefkarten.eintrag(anhang.titel, anhang.text, anhang.ordner)
                  : texte.agentenPruefkarten.eintragOhneDateien(anhang.titel, anhang.text)
              )
              .join('')
        if (k.rueckmeldung) auftrag += texte.agentenUebergabe.prueferRueckmeldung(k.rueckmeldung)
        // Ab hier ist die Rückmeldung gelesen (BAUPLAN 47): Ein Prüfer, der
        // jetzt noch durchfällt, nimmt ehrlich seine eigene Runde — an diesen
        // Anlauf kann er nichts mehr anhängen.
        k.rueckmeldungOffen = false
        // Nachprüfung: ehrlich unterschieden, ob der Bauer oder die lokale
        // Vorreparatur (BAUPLAN 20) die Beanstandungen behoben hat.
        // Tor ohne KI (BAUPLAN 35): Lief der Prüfbefehl vorher grün durch,
        // prüft der Prüfer nur noch die grundsätzlichen Beanstandungen nach —
        // die testgedeckten sind deterministisch belegt. Nach einer LOKALEN
        // Reparatur gilt das bewusst NICHT: Ein kleines Modell könnte den Test
        // statt des Codes angefasst haben, da bleibt die volle Nachprüfung.
        if (k.nachpruefung) {
          if (k.torGruenBefehl && !k.lokaleNachpruefung)
            auftrag += texte.agentenUebergabe.torGruenNachpruefung(
              k.torGruenBefehl,
              // Grün-Fall: nur noch die grundsätzlichen Beanstandungen — aus den
              // gemeldeten Feldern gefiltert (BAUPLAN 42), nicht aus Textzeilen.
              prueferKritik(grundsaetzlicheBeanstandungen(k.nachpruefungBeanstandungen)).text ||
                k.nachpruefung
            )
          else
            auftrag += k.lokaleNachpruefung
              ? texte.agentenUebergabe.lokaleNachpruefung(k.nachpruefung)
              : texte.agentenUebergabe.prueferNachpruefung(k.nachpruefung)
        }
        // Tor ohne KI (BAUPLAN 35): Was FlowForge selbst gemessen hat, geht als
        // Tatsache in den Auftrag — das Fehlerprotokoll eines roten Prüfbefehls
        // und der Startversuch einer Startanleitung, die nicht anläuft.
        if (k.torProtokoll) auftrag += texte.agentenUebergabe.torProtokoll(k.torProtokoll)
        if (k.rauchtestRueckmeldung)
          auftrag += texte.agentenUebergabe.rauchtestRueckmeldung(k.rauchtestRueckmeldung)
        // Baseline: Bauer und Prüfer erfahren, was schon vor dem Lauf rot war —
        // sonst hält jemand eine Altlast für sein eigenes Werk. Ein Prüfer
        // bekommt seine eigene Messung (BAUPLAN 41), der Bauer alle: Was vor
        // dem Lauf rot war, geht ihn unabhängig vom Zweig an.
        for (const b of baselineFuer(k))
          auftrag += texte.agentenUebergabe.baselineRot(b.befehl, b.ausgabe)
        // Diff + Vor-Fazit (BAUPLAN 34, Retained Reasoning light): Der frische
        // Agent erkundet nicht neu — er weiß, was in diesem Lauf schon
        // geschehen ist und warum. Das Frische-Prinzip bleibt: Er erbt kein
        // Arbeitsgedächtnis, nur diese von FlowForge gerechneten Tatsachen.
        if (k.diffText)
          auftrag += k.def.prueft
            ? texte.agentenUebergabe.aenderungenSeitUrteil(k.diffText)
            : texte.agentenUebergabe.eigeneAenderungen(k.diffText)
        if (k.vorFazit) auftrag += texte.agentenUebergabe.vorFazit(k.vorFazit)
        // Prüfbefehl-Nachforderung (BAUPLAN 35): nur nachtragen, nichts neu
        // prüfen — dasselbe Muster wie die Startanleitungs-Nachforderung.
        if (k.pruefbefehlNachforderung) auftrag += texte.agentenUebergabe.pruefbefehlNachforderung
        // Vollständigkeit des Zuschnitts (BAUPLAN 44): Der Nachtrag nennt die
        // nicht abgedeckten Aufgaben und die unbedienten Ziele NAMENTLICH — er
        // ist am Knoten fertig gebaut worden, denn der Auftragstext entsteht
        // hier bei jedem Anlauf neu.
        if (k.zuschnittNachforderung) auftrag += k.zuschnittNachforderung
        if (k.startanleitungNachforderung)
          auftrag += texte.agentenUebergabe.startanleitungNachforderung
        // Lieferschein (BAUPLAN 42): So meldet dieser Block sein Ergebnis —
        // FlowForge hängt den Zusatz an JEDEN Auftrag, auch an selbstgebaute
        // Blöcke, deren Autor das Werkzeug gar nicht kennen kann.
        auftrag += lieferscheinZusatz(k)
        // Läuft der Block nur wegen einer Nachforderung erneut, hat sich
        // inhaltlich meist nichts geändert: Seine eigene Meldung von eben liegt
        // bei, damit er sie nicht neu erarbeiten muss.
        if (k.meldungWiederholen && k.meldungenVorher.length)
          auftrag += texte.agentenUebergabe.meldungWiederholen(meldungenText(k.meldungenVorher))
        // Hat er gar nichts gemeldet, ist die Nachforderung deutlicher: sein
        // freier Abschlusstext liegt bei, mehr hat FlowForge nicht bekommen.
        else if (k.meldungWiederholen && k.nachforderungBeleg)
          auftrag += texte.lieferschein.nachforderung(
            [...werkzeugeFuerBlock(k.def)].join(' bzw. '),
            k.nachforderungBeleg
          )
        if (k.uebergabe) auftrag += texte.agentenUebergabe.uebertragFortsetzung(k.uebergabe)
        else if (k.uebergabeVerloren) auftrag += texte.agentenUebergabe.uebertragOhneUebergabe
        // Lokaler Bauer (BAUPLAN 22): Bau-Blöcke bekommen die Zerlege-Anweisung
        // — nur wenn die lokale KI bereitsteht und das Häkchen am Block an ist.
        if (lokaleHelfer && k.def.startanleitungPflicht && k.eintrag.lokaleKi !== false)
          auftrag += texte.agentenLokaleHelfer.bauenAuftragZusatz
        // Einstellung „Nur-lesende Blöcke dürfen Befehle ausführen" (Zweit-
        // Audit D-01): Die Katalog-Aufträge verbieten Befehle kategorisch
        // („versuche es gar nicht erst") — bei aktiver Einstellung lockert
        // dieser Zusatz den Auftrag, sonst bleibt die Sperre im Motor Theorie.
        if (einstellungen.nurLesenBefehle && k.def.nurLesen)
          auftrag += texte.agentenUebergabe.nurLesenBefehleZusatz
        // Häkchen je Block (BAUPLAN 20): Ist die lokale KI für diesen Block
        // abgewählt, fliegt ihr Hinweis aus dem Auftrag — die harte Sperre
        // für das Werkzeug selbst sitzt im Motor.
        if (k.eintrag.lokaleKi === false)
          auftrag = auftrag.replace(/\(bevorzugt[^()]*lokal_recherchieren[^()]*\)/g, '(Agent-Werkzeug)')

        const uebertragErlaubt =
          workflow.uebertragGrenze == null || uebertraege < workflow.uebertragGrenze
        // Block-Dauer (BAUPLAN 51, Vertrag V2): die Wanduhrzeit genau dieses
        // Anlaufs — Motorstart bis Ergebnis. Der Zähler läuft NUR um diesen
        // Aufruf, damit Kontingent-Pausen und Folgen-Fragen zwischen zwei
        // Anläufen nicht mitzählen. Für lokale Blöcke fließt sie zusätzlich
        // in den Lauf-Topf verbrauch.lokal (auch wenn der Anlauf später kein
        // blockErgebnis pusht, etwa bei erschöpftem Kontingent).
        const anlaufStart = Date.now()
        const ergebnis = await blockAusfuehren(k, auftrag, uebertragErlaubt)
        const anlaufDauerMs = Date.now() - anlaufStart
        blockDauerMs += anlaufDauerMs
        if (knotenLokal) gesamtVerbrauch.lokal.dauerMs += anlaufDauerMs
        // Denktiefe gemessen (0.48.1): der jüngste Messwert gewinnt.
        if (typeof ergebnis.denktiefeGemessen === 'string' && ergebnis.denktiefeGemessen)
          blockDenktiefeGemessen = ergebnis.denktiefeGemessen
        // Lieferschein (BAUPLAN 42): Die Meldungen dieses Anlaufs übernehmen —
        // je Etikett ersetzt die jüngste die ältere. Genau das ist die Regel
        // „nach einem Übertrag ersetzt die Meldung des Nachfolgers die des
        // unterbrochenen Vorgängers": Der Übertrag bleibt in dieser Schleife.
        k.meldungen = meldungenZusammenfuehren(k.meldungen, ergebnis.meldungen)
        // Zuschnitt je Ziel (BAUPLAN 44): Wer welches Paket bekommt, steht im
        // Ticker und damit im Laufbericht — die erste Stelle, an der Georg
        // nachsieht, wenn ein Bauer das Falsche gebaut hat.
        zuschnittTickern(k, ergebnis.meldungen)
        if (ergebnis.verbrauch) {
          // Gezählt wird der ehrliche Anteil dieses Blocks: der Zuwachs des
          // Koordinator-Fadens plus der Verbrauch seiner Agenten (Block-Agent
          // und Helfer) — nicht die Historie der ganzen Lauf-Session.
          const zaehlTokens =
            (ergebnis.verbrauch.blockZuwachs ?? ergebnis.verbrauch.tokens ?? 0) +
            (ergebnis.verbrauch.unterTokens ?? 0)
          gesamtVerbrauch.tokens += zaehlTokens
          // „Davon lokal" (BAUPLAN 51, Vertrag V2): lokale Tokens zusätzlich
          // in den eigenen Topf — die Gesamtsumme bleibt unangetastet, der
          // Ausweis steht daneben (Abo-Anteil = tokens − lokal.tokens).
          if (knotenLokal) gesamtVerbrauch.lokal.tokens += zaehlTokens
          blockTokens += zaehlTokens
          if (ergebnis.verbrauch.kostenUsd != null) {
            gesamtVerbrauch.kostenUsd = (gesamtVerbrauch.kostenUsd ?? 0) + ergebnis.verbrauch.kostenUsd
            blockKosten = (blockKosten ?? 0) + ergebnis.verbrauch.kostenUsd
          }
          // Aufschlüsselung: der Motor meldet den Anteil dieses Blocks.
          const auf = ergebnis.verbrauch.aufschluesselung
          if (auf) {
            blockHatAufschluesselung = true
            for (const feld of ['eingabe', 'ausgabe', 'cacheLesen', 'cacheSchreiben']) {
              blockAufschluesselung[feld] += auf[feld] ?? 0
              gesamtVerbrauch.aufschluesselung[feld] += auf[feld] ?? 0
            }
          }
          // Modell je Block (BAUPLAN 36): der Motor meldet die Anteile dieses
          // Anlaufs — über mehrere Anläufe (Übertrag) wird aufaddiert.
          for (const eintrag of ergebnis.verbrauch.modelle ?? [])
            blockModellTokens.set(
              eintrag.modell,
              (blockModellTokens.get(eintrag.modell) ?? 0) + (eintrag.tokens ?? 0)
            )
          // Kontextfenster-Wächter (BAUPLAN 51, Angriffsliste Fund 1): Der
          // lokale Motor meldet sein festes Ollama-Fenster (z. B. 64k) in
          // jedem Verbrauch. Übernähme der Lauf es, rechneten alle folgenden
          // Claude-Blöcke und Abnahmen ihre Übertrags-Schwelle mit dem
          // kleinen Fenster statt 200k — Überträge kämen rund dreimal zu
          // früh. Gelernt wird das Fenster darum NUR von Claude-Sessions.
          if (ergebnis.verbrauch.kontextFenster > 0 && !knotenLokal)
            bekanntesKontextFenster = ergebnis.verbrauch.kontextFenster
        }

        // Die Lauf-Session ließ sich nicht fortsetzen (Kennung ungültig,
        // Session weg) — stiller Rückfall auf eine frische Session.
        if (ergebnis.zustand === 'fortsetzung-gescheitert') {
          laufSessionKennung = null
          laufSessionTokens = 0
          tickern(texte.ticker.sessionFortsetzenGescheitert)
          continue
        }

        // Nach einer Kontingent-Pause: Der Motor arbeitet wieder — Bescheid geben.
        if (k.warPausiert && ergebnis.zustand !== 'fehlgeschlagen') {
          k.warPausiert = false
          pauseBenachrichtigt = false
          tickern(texte.ticker.kontingentWeiter)
          benachrichtigen(texte.benachrichtigung.weiterTitel, texte.benachrichtigung.weiterText, {
            immer: true
          })
        }

        // Automatischer Übertrag (SPEC §5): Der Kontext war voll, der Agent hat
        // übergeben — derselbe Block läuft sofort als frische Session weiter.
        if (ergebnis.zustand === 'uebertrag') {
          uebertraege++
          // Die volle Lauf-Session ist verbraucht — der nächste Anlauf startet
          // eine frische (die Übergabe wandert über den Auftrag mit).
          laufSessionKennung = null
          laufSessionTokens = 0
          const text = String(ergebnis.ergebnisText ?? '').trim()
          k.uebergabeVerloren = !text
          k.uebergabe = text
          bericht.uebertraege.push({
            zeit: jetztIso(),
            block: k.name,
            text: k.uebergabeVerloren
              ? texte.laufberichte.uebertragOhneUebergabeZeile(k.name)
              : texte.laufberichte.uebertragZeile(
                  k.name,
                  // Füllstand im Moment der Auslösung — nicht der am Session-Ende
                  // (die endgültige Fenstergröße würde ihn sonst kleinrechnen).
                  ergebnis.verbrauch?.uebertragBand?.von ?? ergebnis.verbrauch?.kontextProzentVon ?? '?',
                  ergebnis.verbrauch?.uebertragBand?.bis ?? ergebnis.verbrauch?.kontextProzentBis ?? '?',
                  uebertraege,
                  workflow.uebertragGrenze
                )
          })
          tickern(texte.ticker.uebertragWeiter(uebertraege, workflow.uebertragGrenze))
          if (workflow.uebertragGrenze != null && uebertraege >= workflow.uebertragGrenze)
            tickern(texte.ticker.uebertragGrenzeErreicht(workflow.uebertragGrenze))
          continue
        }

        if (ergebnis.zustand === 'fehlgeschlagen') {
          // Abo-Kontingent erschöpft (SPEC §5): je nach Projekt-Einstellung
          // pausieren und von selbst weitermachen — oder ehrlich anhalten.
          // Überlastete KI-Server (529) sind immer nur vorübergehend: da wird
          // grundsätzlich pausiert statt aufgegeben.
          const kontingentPause =
            ergebnis.fehlerArt === 'kontingent' && einstellungen.motorModus === 'abo'
          const serverPause = ergebnis.fehlerArt === 'ueberlastet'
          if (kontingentPause && kontingentVerhaltenLaden(projektPfad) === 'stoppen')
            // die Ergebnis-Verarbeitung hält den Lauf an
            return mitBlockVerbrauch(ergebnis)
          if (kontingentPause || serverPause) {
            if (!k.warPausiert) {
              k.warPausiert = true
              if (!pauseBenachrichtigt) {
                pauseBenachrichtigt = true
                benachrichtigen(
                  serverPause ? texte.benachrichtigung.serverTitel : texte.benachrichtigung.pauseTitel,
                  serverPause ? texte.benachrichtigung.serverText : texte.benachrichtigung.pauseText,
                  { immer: true }
                )
              }
            }
            tickern(serverPause ? texte.ticker.serverPause : texte.ticker.kontingentPause)
            await kontingentWarten()
            if (lauf.hart)
              return mitBlockVerbrauch({ ...ergebnis, zustand: 'hart-abgebrochen' })
            if (lauf.sanft)
              return mitBlockVerbrauch({ ...ergebnis, zustand: 'sanft-gestoppt' })
            tickern(texte.ticker.kontingentVersuch)
            continue
          }
        }
        // Tor-Anker (BAUPLAN 50): Erst jetzt ist der Anlauf eines lokalen
        // Prüfers wirklich zu Ende (kein Übertrag, keine Pause mehr) — sein
        // Urteil wird mechanisch verankert, bevor es irgendwer liest.
        if (
          ergebnis.zustand === 'erfolgreich' &&
          k.def.prueft &&
          klasseIstLokal(blockModellKlasse(k.def, k.eintrag))
        )
          return mitBlockVerbrauch(await torAnkerLokal(k, ergebnis))
        return mitBlockVerbrauch(ergebnis)
      }
    }

    // Diff der bisherigen Runden (BAUPLAN 34): Was hat sich seit der
    // Diff-Basis dieses Blocks am Projekt geändert? Gerechnet aus zwei
    // Sicherungspunkten (kein git.exe nötig), ohne pruefung/ und
    // arbeitsablage/ — die Prüfer-Tests liegen beim Rückführen uncommittet im
    // Ordner und wanderten sonst als „Bauer-Änderung" mit.
    async function diffTextFuer(k) {
      // Beide Enden auf dem Strang des Blocks (BAUPLAN 45): Alle seine Punkte
      // liegen dort; läse „bis" den gemeinsamen Stand, wäre es dieselbe id wie
      // die Basis und der Diff fiele lautlos auf leer zurück.
      const bis = await letzterPunktId(projektPfad, k.strang ?? null)
      if (!k.diffBasis || !bis || k.diffBasis === bis) return ''
      // Gefiltert auf den eigenen Wirkbereich (BAUPLAN 45): Jeder Umsetzer
      // sieht nur seine Änderungen — ein Block ohne Wirkbereich (und der
      // Prüfer, siehe diffFilterVon) sieht alles wie bisher.
      const vergleich = await punkteVergleichen(projektPfad, k.diffBasis, bis, {
        nurDateien: diffFilterVon(k.def, k.wirkbereich)
      })
      if (!vergleich.ok) return ''
      // Was der Filter weggenommen hat, wird gesagt statt verschwiegen — sonst
      // wäre es wieder ein stiller Verlust, und genau den verbietet SPEC
      // durchgängig. Auch dann, wenn danach nichts mehr übrig ist.
      const ausserhalb = vergleich.ausserhalb ?? 0
      if (ausserhalb > 0) tickern(texte.ticker.diffAusserhalb(ausserhalb))
      const text = diffAuftragsText(vergleich.dateien, ausserhalb, {
        verschmutzt: k.diffBasisVerschmutzt
      })
      // Nichts übrig nach dem Filter: Der Hinweis ist dann der ganze Text —
      // eine Bilanz-Zeile („n Dateien übergeben") wäre schlicht gelogen.
      if (vergleich.dateien.length === 0) return text
      tickern(
        texte.ticker.diffUebergeben(
          k.name,
          vergleich.dateien.length,
          diffBilanz(vergleich.dateien)
        )
      )
      if (vergleich.dateien.some((datei) => datei.zuGross)) tickern(texte.ticker.diffGekuerzt)
      return text
    }

    // Tor ohne KI (BAUPLAN 35): Vor JEDER Nachprüfung — der Reparatur-Runde des
    // Prüfers wie der Nachprüfung einer lokalen Vorreparatur — spielt FlowForge
    // den Prüfbefehl selbst ab, bevor ein Prüfer-Agent auch nur startet.
    // Liefert ein fertiges Block-Ergebnis, wenn das Tor rot ist (dann läuft
    // kein Agent, und der Block kostet 0 Tokens) — sonst null, dann prüft der
    // Agent wie bisher weiter.
    async function torAbspielen(k) {
      k.torGruenBefehl = ''
      if (lauf.sanft || lauf.hart || endZustand) return null
      const tor = await torMessen(k)
      // Kein Befehl: nichts zu spielen. Abgebrochen heißt: Georg hat den Lauf
      // gestoppt, nicht „die Prüfung ist rot" — daraus wird kein Urteil gebaut.
      if (tor.zustand === 'keinBefehl' || tor.zustand === 'abgebrochen') return null
      if (tor.zustand === 'gruen') {
        k.torGruenBefehl = tor.befehl
        tickern(texte.ticker.torGruen)
        return null
      }
      if (tor.zustand === 'altlasten') {
        // Bewusst ohne torGruenBefehl: Der Befehl ist nicht grün, nur die
        // Fehler sind alt — der Prüfer prüft normal nach (er kennt die
        // Baseline aus seinem Auftrag), aber ohne Rückführung.
        tickern(texte.ticker.torAltlasten(tor.altlasten))
        return null
      }
      // Das volle Protokoll geht neben der Kritik an den Bauer — die
      // Beanstandungs-Zeilen allein sagen nicht, wo es klemmt.
      k.letztesTorProtokoll = tor.protokoll
      tickern(tor.zeitlimit ? texte.ticker.torRotZeitlimit : texte.ticker.torRot(tor.zeilen))
      // Ein vollwertiges Block-Ergebnis: Die Urteils-Auswertung, die
      // Rückführung und die Reparatur-Runden-Zählung greifen unverändert —
      // nur eben ohne einen einzigen Token.
      return {
        zustand: 'erfolgreich',
        ergebnisText: lieferscheinText(tor.torMeldung),
        meldungen: [tor.torMeldung],
        fehlertext: '',
        fehlerArt: null,
        verbrauch: null,
        blockTokens: 0,
        blockKosten: null,
        blockAufschluesselung: null,
        // Kein Modell hat gearbeitet — ehrlich „ohne Modell", nicht „0 Tokens
        // auf Opus" (BAUPLAN 36).
        blockModelle: null,
        // … und damit auch keine Denktiefe gemessen (0.48.1).
        blockDenktiefeGemessen: null,
        // Abnahme (BAUPLAN 50): Dieses Urteil fiel am Vor-Tor, kein Agent hat
        // gelesen — ausdrücklich markiert, statt aus „kein Modell gemessen"
        // zurückgeschlossen (ein Motor ohne Verbrauchsmeldung sähe sonst aus
        // wie das Tor).
        durchTor: true
      }
    }

    // Die Messung hinter dem Tor (BAUPLAN 35, seit BAUPLAN 50 herausgelöst):
    // spielt den Prüfbefehl DIESER Prüf-Instanz ab und stuft das Ergebnis ein —
    // ohne ein Block-Ergebnis zu bauen, ohne k.torGruenBefehl oder das Tor-
    // Protokoll am Knoten anzufassen. Zwei Aufrufer mit zwei Folgen: das
    // Vor-Tor einer Nachprüfung (torAbspielen: Rot beendet den Anlauf ohne
    // Agenten) und der Tor-Anker eines lokalen Prüfers (torAnkerLokal: Rot
    // dreht sein „bestanden"). Liefert
    //   { zustand: 'keinBefehl'|'abgebrochen'|'gruen'|'altlasten'|'rot',
    //     befehl, torMeldung (nur rot), protokoll (nur rot), zeilen (rot: Zahl
    //     der neuen Fehlerzeilen), zeitlimit, altlasten (Zahl der alten Zeilen) }.
    async function torMessen(k) {
      const leer = { befehl: '', torMeldung: null, protokoll: '', zeilen: 0, zeitlimit: false, altlasten: 0 }
      // Je Prüf-Instanz ihr eigener Befehl und ihre eigene Prozessgruppe
      // (BAUPLAN 41): Sonst urteilte das Tor über einen fremden Zweig, und ein
      // fertiger Testlauf erschösse den laufenden des anderen.
      const befehl = pruefbefehlLaden(projektPfad, k.eintrag.instanzId)
      if (!befehl) return { ...leer, zustand: 'keinBefehl' }
      tickern(texte.ticker.torSpielt(k.name, befehl))
      const messung = await befehlAbspielen(projektPfad, befehl, {
        gruppe: 'tor:' + projektPfad + ':' + k.eintrag.instanzId,
        abbrechen: () => lauf.sanft || lauf.hart
      })
      if (messung.abgebrochen) return { ...leer, zustand: 'abgebrochen', befehl }
      if (messung.code === 0) return { ...leer, zustand: 'gruen', befehl }
      // Baseline „vorher schon rot": Nur NEU Kaputtes zählt als Fehlschlag —
      // Altlasten sind schon als Aufgaben-Karte abgelegt und verbrennen keine
      // Reparatur-Runde. Ein Zeitlimit zählt dagegen immer als rot: Ein
      // Testlauf, der nicht endet, belegt gar nichts.
      const eigeneBaseline = baseline.get(k.eintrag.instanzId) ?? null
      const zeilen = eigeneBaseline
        ? neueFehler(eigeneBaseline.zeilen.join('\n'), messung.ausgabe)
        : fehlerZeilen(messung.ausgabe).map((f) => f.zeile)
      if (eigeneBaseline && zeilen.length === 0 && !messung.zeitlimit)
        return { ...leer, zustand: 'altlasten', befehl, altlasten: eigeneBaseline.zeilen.length }
      const genommen = zeilen.slice(0, TOR_BEANSTANDUNGEN_MAX)
      const kopf = messung.zeitlimit
        ? texte.tor.belegKopfZeitlimit(befehl)
        : texte.tor.belegKopf(befehl, messung.code)
      // Lieferschein (BAUPLAN 42): Das Tor meldet direkt strukturiert — sonst
      // hielte FlowForge diesen Block für „hat nichts gemeldet" und forderte
      // bei einem Prüfer nach, der nie gestartet ist.
      const torMeldung = {
        art: 'pruefbeleg',
        etikett: PRUEFBELEG_ETIKETT,
        fazit: kopf,
        getan: [],
        offen: [],
        anmerkung:
          zeilen.length > genommen.length ? texte.tor.weitere(zeilen.length - genommen.length) : '',
        urteil: 'fehlgeschlagen',
        beanstandungen: (genommen.length
          ? genommen
          : [texte.tor.beanstandungOhneZeilen(befehl)]
        ).map((zeile) => ({
          einstufung: texte.tor.einstufung,
          text: zeile.slice(0, TOR_BEANSTANDUNG_ZEILE_MAX),
          fundort: texte.tor.beanstandungFundort(befehl)
        })),
        rotVorGruen: '',
        geprueft: [],
        pruefkarte: null
      }
      return {
        zustand: 'rot',
        befehl,
        torMeldung,
        // Das volle Protokoll, gekürzt — der Aufrufer legt es an den Knoten.
        protokoll: mitteGekuerzt(messung.ausgabe, TOR_PROTOKOLL_MAX).text,
        zeilen: zeilen.length,
        zeitlimit: Boolean(messung.zeitlimit),
        altlasten: 0
      }
    }

    // Tor-Anker des lokalen Prüfers (BAUPLAN 50): Ein Prüfer der Klasse
    // „lokal" darf prüfen, aber sein „bestanden" gilt nicht ungeprüft — FlowForge
    // spielt seinen Prüfbefehl einmal ohne KI ab. Rot → das Urteil wird
    // mechanisch auf „fehlgeschlagen" gedreht (die Tor-Meldung ersetzt seinen
    // Beleg: gleiches Etikett, gleiche Art), und die normale Rückführung greift
    // — sie verbraucht ehrlich eine Reparatur-Runde. Grün/Altlasten → bestätigt.
    // Kein Prüfbefehl → ehrlich „keine mechanische Bestätigung möglich".
    //
    // HIER in knotenAusfuehren, nicht in verarbeiteEnde: Dort wären Lieferung
    // (k.lieferung/k.lieferungen), der Lieferschein im Bericht und der
    // ergebnisText schon aus dem lokalen „bestanden" gebaut, und ein await des
    // Prüfbefehls hielte die Planer-Schleife an. Hier sind k.meldungen und das
    // Ergebnis noch dieselbe Quelle, und die Schleife dieses Blocks wartet ohnehin.
    //
    // Felder: urteilLokal = das vom lokalen Prüfer selbst gemeldete Urteil VOR
    // einer Drehung; torBestaetigung = 'gruen'|'altlasten'|'rot'|'keine'|
    // 'abgebrochen', null = kein Nachspiel (Urteil war nicht „bestanden").
    // War das Vor-Tor dieses Anlaufs (Nachprüfung) schon grün, wird NICHT noch
    // einmal gespielt — dieselbe Messung zweimal kostete nur Zeit —, aber das
    // Urteil gilt als 'gruen' bestätigt: Der Befehl lief in diesem Anlauf ohne
    // KI durch, das ist genau die mechanische Bestätigung. Beides geht ans
    // Ergebnis (→ blockErgebnis im Bericht) und an den Knoten (→ Auftrag der
    // Abnahme, abnahmeQuellen).
    async function torAnkerLokal(k, ergebnis) {
      const urteil = urteilAusMeldungen(k.meldungen)
      // Ohne Prüfbeleg gibt es nichts zu verankern — die Meldungspflicht in
      // verarbeite fordert nach.
      if (urteil === null) return ergebnis
      k.urteilLokal = urteil ? 'bestanden' : 'fehlgeschlagen'
      k.torBestaetigung = null
      if (!urteil) return { ...ergebnis, urteilLokal: k.urteilLokal, torBestaetigung: null }
      // Nur überspringen, wenn der Prüfer in diesem Anlauf keinen NEUEN
      // Prüfbefehl hinterlegt hat (Befund Prüfer 1, Bauschritt 50): Sonst
      // gälte ein nie gespielter Befehl als „mechanisch bestätigt".
      if (k.torGruenBefehl && pruefbefehlLaden(projektPfad, k.eintrag.instanzId) === k.torGruenBefehl) {
        k.torBestaetigung = 'gruen'
        tickern(texte.ticker.torBestaetigtLokal(k.name))
        return { ...ergebnis, urteilLokal: k.urteilLokal, torBestaetigung: 'gruen' }
      }
      let zustand
      if (lauf.sanft || lauf.hart || endZustand) zustand = 'abgebrochen'
      else {
        const tor = await torMessen(k)
        zustand = tor.zustand
        if (zustand === 'gruen') tickern(texte.ticker.torBestaetigtLokal(k.name))
        else if (zustand === 'altlasten') tickern(texte.ticker.torAltlastenLokal(k.name))
        else if (zustand === 'rot') {
          // Die Tor-Meldung ersetzt den lokalen Beleg — Urteil und
          // Beanstandungen kommen aus EINER Quelle (Meldungspflicht: eine
          // gedrehte Meldung trägt „fehlgeschlagen" und mindestens eine
          // Beanstandung, torMessen baut sie genau so).
          k.meldungen = meldungenZusammenfuehren(k.meldungen, [tor.torMeldung])
          k.letztesTorProtokoll = tor.protokoll
          tickern(texte.ticker.torDrehtLokal(k.name, tor.zeilen))
          ergebnis = {
            ...ergebnis,
            ergebnisText: lieferscheinText(tor.torMeldung),
            meldungen: k.meldungen
          }
        }
      }
      const torBestaetigung =
        zustand === 'keinBefehl' ? 'keine' : zustand === 'abgebrochen' ? 'abgebrochen' : zustand
      if (zustand === 'keinBefehl') tickern(texte.ticker.torKeinBefehlLokal(k.name))
      if (zustand === 'abgebrochen') tickern(texte.ticker.torAbgebrochenLokal(k.name))
      k.torBestaetigung = torBestaetigung
      return { ...ergebnis, urteilLokal: k.urteilLokal, torBestaetigung }
    }

    // Übergaben aus den Lieferungen der Vorfahren einsammeln — deterministisch
    // in topologischer Reihenfolge; entschieden wird in uebergabenAuswahl
    // (kettenRegeln), damit die braucht-Chips am Schaubild dasselbe zeigen.
    // Fan-out ohne Datenverlust (BAUPLAN 34): mehrere GLEICH nahe Vorfahren
    // kommen alle nummeriert an. Fan-in ohne stillen Verlust (BAUPLAN 40): Bei
    // ungleicher Distanz gewinnt weiter der nähere — die verdrängte Lieferung
    // steht jetzt aber im Ticker, statt wortlos zu verschwinden.
    // Welcher Text dieser Lieferung gilt für DIESEN Empfänger? (BAUPLAN 44)
    // Ein Etikett trägt seit 44 einen Text je Ziel; die Auswahl trifft
    // zuschnittRouting — ein an X adressiertes Paket geht an X und an dessen
    // Nachfahren ohne näheres Ziel, ein Paket ohne Ziel gilt für alle. Alte
    // Lieferungen (ein blanker Text je Etikett) laufen unverändert durch.
    function textFuerEmpfaenger(lieferung, etikett, k) {
      const jeZiel = lieferung.texte?.[etikett]
      if (typeof jeZiel === 'string') return jeZiel
      if (!jeZiel || typeof jeZiel !== 'object') return null
      const schluessel = zuschnittRouting(
        workflow.bloecke,
        workflow.pfeile,
        k.eintrag.instanzId,
        Object.keys(jeZiel)
      )
      const stuecke = schluessel.map((s) => jeZiel[s]).filter(Boolean)
      // Leer heißt „hier steht nichts" — dann greift der Gesamttext der
      // Lieferung als Rückfall, statt eine leere Übergabe zu schreiben.
      return stuecke.length ? stuecke.join('\n\n') : null
    }

    // Herkunfts-Felder einer Lieferung für uebergabenAuswahl (0.46.2): wer
    // liefert, was er selbst nimmt, wer vor ihm liegt. Damit greift die
    // Verdrängung durch Weiterverarbeitung — Prüfer → Zweitaudit → Sessionende:
    // beim Sessionende zählt nur der Beleg des Zweitaudits. Nur Vorfahren MIT
    // Lieferung stehen in der Kandidatenmenge (Aufrufer filtern vorher), also
    // gilt im Lauf: Nur wer geliefert hat, verdrängt — meldet das Zweitaudit
    // nichts, kommt der erste Beleg doch an. Gegenstück zu lieferungsHerkunft
    // in kettenRegeln.js (gleiche Form { instanzId, braucht, vorfahrenIds },
    // dort aus dem statischen Schaubild gerechnet — hier aus vorfahrenVon, der
    // einmal je Lauf gerechneten Map, damit Vorspann und Lauf dasselbe sagen).
    function herkunftVon(instanzId, vk) {
      return {
        instanzId,
        braucht: [...(vk.def.braucht ?? []), ...(vk.def.brauchtOptional ?? [])],
        vorfahrenIds: (vorfahrenVon.get(instanzId) ?? []).map((b) => b.instanzId)
      }
    }

    // Abnahme-Quelle (BAUPLAN 50): Ist der Lieferant eines angekommenen
    // Prüfbelegs ein Prüfer der Klasse „lokal", wird er zum Paar-Partner der
    // Abnahme — mit dem Urteil des Belegs, den die Abnahme jetzt liest (nach
    // einer Tor-Drehung ist das die Tor-Meldung; das selbst gemeldete Urteil
    // steht am Eintrag des lokalen Prüfers als urteilLokal daneben), und dem
    // Ausgang seines Tor-Ankers. null, wenn der Lieferant kein lokaler Prüfer
    // ist. Die Feldnamen sind die der Bericht-Einträge (abnahmeFuer/abnahme),
    // damit Anzeige und Metrik dieselben Namen lesen.
    function abnahmeQuelleVon(instanzId) {
      const vk = knoten.get(instanzId)
      if (!vk?.def.prueft || !klasseIstLokal(blockModellKlasse(vk.def, vk.eintrag))) return null
      return {
        instanzId,
        block: vk.def.name,
        zusatz: zusatznameBereinigen(vk.eintrag.zusatz),
        name: vk.name,
        // Der Modellname aus der Zuteilung des Partners (BAUPLAN 51) — alle
        // Pool-Einträge tragen dasselbe abgeleitete Modell, der Rückfall auf
        // den Pool deckt nur den nie gelaufenen Partner ab.
        modell: texte.kette.lokalModellName(vk.lokalZuteilung?.modell ?? lokalPool[0]?.modell ?? ''),
        urteilLokal: urteilAusMeldungen(vk.meldungen) === true ? 'bestanden' : 'fehlgeschlagen',
        torBestaetigung: vk.torBestaetigung ?? null
      }
    }

    // Der Datenvertrag, der für DIESEN Block gilt (BAUPLAN 44): die erlaubten
    // Dateien der Arbeitspakete, die bei ihm ankommen. Ausgewählt wird mit
    // genau derselben Regel wie der Übergabe-Text (uebergabenAuswahl plus
    // zuschnittRouting) — eine zweite, eigene Regel sperrte sonst etwas
    // anderes, als im Auftrag steht.
    //
    // Drei Festlegungen:
    //   - Nur UMSETZER-Blöcke (!nurLesen && !prueft, dieselbe Filterung wie die
    //     benannten Ziele). Der Prüfer bekommt das Paket seines Bauers mit und
    //     stünde sonst bei seiner eigenen, völlig legitimen Arbeit.
    //   - Mehrere Pakete: Es gilt die VEREINIGUNG ihrer Listen. Zwei
    //     Auftragsquellen vor einem Bauer sind legitim; die engere Auslegung
    //     stoppte ihn bei genau der Arbeit, die er tun soll. Ein Paket ohne
    //     Liste trägt dabei nichts bei, setzt die Sperre aber auch nicht aus —
    //     sonst schaltete ein einziges listenloses Paket die ganze Sperre
    //     lautlos ab, und Georg hielte sie für geltend.
    //   - Trägt KEINES der angekommenen Pakete eine Dateiliste, gibt es keine
    //     Sperre (null). Keine Liste heißt „kein Vertrag", nicht „nichts
    //     erlaubt" — sonst blockierte ein wiederaufgenommener Lauf mit einem
    //     Paket von vor Bauschritt 44 jeden Schreibversuch.
    function dateiListeFuer(k) {
      if (k.def.nurLesen || k.def.prueft) return null
      const distanz = distanzVon.get(k.eintrag.instanzId)
      const lieferungen = []
      for (const vorfahre of vorfahrenVon.get(k.eintrag.instanzId)) {
        const vk = knoten.get(vorfahre.instanzId)
        // Dieselbe Vorauswahl wie uebergabenText: Wer keine Lieferung abgelegt
        // hat, ist auch für die Distanz-Regel nicht da — sonst sperrte die
        // Sperre gegen einen anderen Stand, als im Auftrag steht.
        if (vk.lieferung == null || !vk.meldungen?.length) continue
        lieferungen.push({
          naehe: distanz.get(vorfahre.instanzId) ?? Number.MAX_SAFE_INTEGER,
          liefert: vk.def.liefert,
          zuschnitte: zuschnitteAusMeldungen(vk.meldungen),
          ...herkunftVon(vorfahre.instanzId, vk)
        })
      }
      const angekommene = []
      for (const gruppe of uebergabenAuswahl(k.def, lieferungen).gruppen) {
        if (gruppe.etikett !== ARBEITSPAKET_ETIKETT) continue
        for (const lieferung of gruppe.angekommen) {
          const schluessel = zuschnittRouting(
            workflow.bloecke,
            workflow.pfeile,
            k.eintrag.instanzId,
            lieferung.zuschnitte.map(zuschnittSchluessel)
          )
          for (const paket of lieferung.zuschnitte)
            if (schluessel.includes(zuschnittSchluessel(paket))) angekommene.push(paket)
        }
      }
      return dateiListeVereinigen(angekommene)
    }

    // Die geschützten Bereiche (BAUPLAN 45) für einen Knoten dieses Laufs — die
    // Regel selbst steht als reine Rechnung oben im Modul.
    //
    // k darf fehlen: Beim harten Stopp ist im Zweifel kein Block mehr als
    // „der abgebrochene" auszumachen. Dann zählt jede Instanz als fremd, und
    // geschützt sind die Prüfmappen aller — lieber eine zu viel stehen lassen
    // als fremde Arbeit löschen.
    function geschuetzteBereicheFuer(k) {
      const eigene = k?.eintrag?.instanzId ?? null
      // Ein offener Zweig (Folgen-Frage) ist belegtes Revier — Rückrolle und
      // Punkte der Nachbarn schonen ihn, bis die Wahl gefallen ist. Der eigene
      // Zweig zählt nicht: Für den fragenden Prüfer selbst wären das die
      // Dateien, die er gleich zurücksetzen soll.
      const offen = offeneFragenZweige(eigene).flatMap((zweig) => zweig.pfade)
      const bereiche = geschuetzteBereicheVon(
        eigene,
        kette.map((eintrag) => {
          const andere = knoten.get(eintrag.instanzId)
          // Belegt = läuft, steht im Nachlauf oder die lokale Vorreparatur
          // schreibt gerade für ihn (BAUPLAN 46, Vertrag F7) — die Regel steht
          // oben im Modul. Die Dateiliste kommt aus dem beim Start gemerkten
          // Wert: Diese Funktion läuft seit der Welle bei jedem Werkzeugaufruf
          // der Nachbarn, ein Übergaben-Durchlauf je Aufruf wäre zu teuer.
          const belegt = schreiberBelegt(andere)
          return {
            instanzId: eintrag.instanzId,
            def: andere.def,
            pruefOrdner: andere.pruefOrdner,
            dateiListe: belegt ? (andere.dateiListeAktiv ?? null) : null,
            laeuft: belegt
          }
        })
      )
      return offen.length ? [...new Set([...bereiche, ...offen])] : bereiche
    }

    // Die Zweige, für die gerade eine Folgen-Frage offen ist (Nacharbeit
    // BAUPLAN 46): je wartendem Prüfer die Wirkbereiche seines Zweigs. Sie
    // gelten als belegt — für die Startregel und die geschützten Bereiche —,
    // weil „Stand wiederherstellen" genau diese Pfade zurücksetzt. `ausser`
    // lässt den eigenen Zweig eines Prüfers weg.
    function offeneFragenZweige(ausser = null) {
      const zweige = []
      for (const nk of knoten.values()) {
        if (nk.status !== 'wartet-entscheidung' || nk.eintrag.instanzId === ausser) continue
        zweige.push({
          name: nk.name,
          pfade: zweigWirkbereiche(nk.entscheidungZielId, nk.eintrag.instanzId).pfade
        })
      }
      return zweige
    }

    // Läuft neben diesem Block gerade ein anderer Schreiber? (Welle, BAUPLAN 46;
    // die Regel steht oben im Modul, hier hängen nur die Knoten dran.)
    function andererSchreiberLaeuft(k) {
      return inWelleVon(k?.eintrag?.instanzId ?? null, [...knoten.values()].map(wellenKnoten))
    }

    // Steht die Welle — kein Umsetzer läuft, keine Vorreparatur schreibt?
    // (BAUPLAN 46, Vertrag F3/F7.) k darf fehlen: dann zählt jeder Umsetzer.
    function welleSteht(k) {
      return welleStehtVon(k?.eintrag?.instanzId ?? null, [...knoten.values()].map(wellenKnoten))
    }

    // Ein Knoten in der einfachen Form, die die Wellen-Regeln oben lesen.
    function wellenKnoten(nk) {
      return {
        instanzId: nk.eintrag.instanzId,
        name: nk.name,
        def: nk.def,
        status: nk.status,
        schreibtGerade: nk.schreibtGerade === true,
        dateiListe: nk.dateiListeAktiv ?? null
      }
    }

    // Wie ein Block im Ticker heißt: Blocknummer plus Anzeigename.
    function bezeichnungFuer(k) {
      return texte.ticker.blockBezeichnung(nummerVon.get(k.eintrag.instanzId), k.name)
    }

    // Punkt-Strang je Schreiber (BAUPLAN 45) — die Regeln selbst stehen oben im
    // Modul als eigene, ausführbare Stellen; hier hängen nur noch die Daten
    // dieses Laufs dran.
    async function strangOeffnenFuer(k) {
      await strangOeffnenAn(projektPfad, k, {
        instanzId: k.eintrag.instanzId,
        bezeichnung: bezeichnungFuer(k),
        dateiListe: dateiListeFuer(k),
        tickern
      })
    }

    // Ohne fremdes laufendes Revier (BAUPLAN 46, Vertrag F6): Der Punkt am
    // Blockende nimmt für die Wirkbereiche der anderen, noch laufenden bzw.
    // noch nicht zusammengeführten Schreiber den Stand der Basis — nicht den
    // Halbstand aus dem Arbeitsordner.
    async function strangSchliessenFuer(k) {
      await strangSchliessenAn(projektPfad, k, {
        bezeichnung: bezeichnungFuer(k),
        tickern,
        ausgenommen: geschuetzteBereicheFuer(k)
      })
    }

    // Das Sicherheitsnetz am Laufende: Hier wird JEDER Strang geschlossen, auch
    // der eines Blocks, der noch auf 'offen' steht. Zwischen den Blöcken bleibt
    // ein solcher Strang bewusst liegen (siehe strangSchliessenAn) — nach dem
    // Laufende läuft aber nichts mehr nach, das ihn noch bräuchte.
    async function strangEndgueltigSchliessenFuer(k) {
      await strangSchliessenAn(projektPfad, k, {
        bezeichnung: bezeichnungFuer(k),
        tickern,
        endgueltig: true,
        ausgenommen: geschuetzteBereicheFuer(k)
      })
    }

    // betroffen = der Block, dessen Arbeit fällt (bei der lokalen Vorreparatur
    // ist das nicht der Prüfer, sondern sein Rückführungs-Ziel); strang = der
    // Strang, auf dem der Rückroll-Punkt liegt. `nichtsMelden` nur dort, wo ein
    // Rückroll wirklich versprochen wurde — am harten Stopp ist „nichts
    // zurückzunehmen" der Normalfall und die Zeile wäre unerwünscht laut.
    async function zurueckrollen(betroffen, strang, erfolgsText, { nichtsMelden = false } = {}) {
      return zurueckrollenAn(projektPfad, {
        strang,
        geschuetzt: geschuetzteBereicheFuer(betroffen),
        // Der Wirkbereich DESSEN, dessen Arbeit hier fällt — die Notbremse für
        // den überholten Rückroll-Punkt (siehe zurueckrollenAn).
        eigenerBereich: betroffen?.wirkbereich ?? null,
        erfolgsText,
        nichtsMelden,
        tickern
      })
    }

    // Ein gemeldeter Zuschnitt als Ticker-Zeile: je Paket sein Ziel mit
    // Blocknummer und wie viele Dateien der Datenvertrag freigibt (BAUPLAN 44).
    function zuschnittTickern(k, meldungen) {
      for (const meldung of meldungen ?? []) {
        if (meldung?.art !== 'arbeitspaket') continue
        const zuschnitte = zuschnitteAusMeldung(meldung)
        if (zuschnitte.length === 0) continue
        tickern(
          texte.ticker.zuschnittGeschnitten(
            texte.ticker.blockBezeichnung(nummerVon.get(k.eintrag.instanzId), k.name),
            zuschnitte.map((p) =>
              p.zielBezeichnung
                ? texte.ticker.zuschnittZiel(p.zielBezeichnung, p.erlaubteDateien?.length ?? 0)
                : texte.ticker.zuschnittOhneZiel(p.erlaubteDateien?.length ?? 0)
            )
          )
        )
      }
    }

    function uebergabenText(k) {
      const distanz = distanzVon.get(k.eintrag.instanzId)
      const lieferungen = []
      for (const vorfahre of vorfahrenVon.get(k.eintrag.instanzId)) {
        const vk = knoten.get(vorfahre.instanzId)
        if (vk.lieferung == null) continue
        lieferungen.push({
          // Anzeigename (BAUPLAN 41): „von Block ‚Bauer · Datenbank'" — bei
          // zwei gleichen Blöcken sonst nicht auseinanderzuhalten.
          name: vk.name,
          nummer: nummerVon.get(vorfahre.instanzId),
          naehe: distanz.get(vorfahre.instanzId) ?? Number.MAX_SAFE_INTEGER,
          liefert: vk.def.liefert,
          text: vk.lieferung,
          // Lieferschein (BAUPLAN 42): je Etikett ein eigener Text. Ein Block
          // mit zwei Etiketten reichte bisher beiden Nachfolgern denselben
          // Abschlusstext — jetzt bekommt jeder genau seine Lieferung.
          // Seit BAUPLAN 44 je Etikett ein Text JE ZIEL (Schlüssel '' = ohne Ziel).
          texte: vk.lieferungen ?? {},
          // Herkunft (0.46.2): Grundlage der Verdrängung durch Weiterverarbeitung.
          ...herkunftVon(vorfahre.instanzId, vk)
        })
      }
      // Optionale Bedarfe (z.B. Angriffsliste beim Bauer) sind in den Gruppen
      // enthalten, wenn ein Vorfahre sie geliefert hat — verlangt werden sie nicht.
      const { gruppen } = uebergabenAuswahl(k.def, lieferungen)
      const bezeichnung = (l) => texte.ticker.blockBezeichnung(l.nummer, l.name)
      const bezeichnungVonId = (id) =>
        texte.ticker.blockBezeichnung(nummerVon.get(id), knoten.get(id)?.name ?? '?')
      // Weiterverarbeitung einmal je Block und Etikett — eigenes Set neben
      // verdraengungGemeldet, denn beide Gründe können am selben Etikett
      // zusammentreffen und jede Zeile sagt etwas anderes.
      k.weiterverarbeitungGemeldet ??= new Set()
      // Abnahme (BAUPLAN 50): Ist dieser Block ein nicht-lokaler Prüfer, sind
      // die lokalen Prüfer, deren Prüfbeleg hier ankommt, seine Abnahme-
      // Quellen — je Anlauf frisch festgehalten, denn genau DIESE Belege liest
      // der Agent; was der lokale Prüfer später noch meldet, gehört nicht dazu.
      const istAbnahme = k.def.prueft && !klasseIstLokal(blockModellKlasse(k.def, k.eintrag))
      if (istAbnahme) k.abnahmeQuellen = []
      const eintraege = []
      for (const gruppe of gruppen) {
        gruppe.angekommen.forEach((lieferung, index) => {
          // Zuschnitt je Ziel (BAUPLAN 44): Welcher der gelieferten Zuschnitte
          // für DIESEN Empfänger gilt, entscheidet die Routing-Regel in
          // kettenRegeln — dieselbe, die Vorspann und braucht-Chips lesen.
          const text = textFuerEmpfaenger(lieferung, gruppe.etikett, k) ?? lieferung.text
          eintraege.push(
            gruppe.angekommen.length === 1
              ? texte.agentenUebergabe.eintrag(gruppe.etikett, lieferung.name, text)
              : texte.agentenUebergabe.eintragMehrfach(
                  gruppe.etikett,
                  index + 1,
                  gruppe.angekommen.length,
                  lieferung.name,
                  text
                )
          )
          // Der Zusatz „du bist die Abnahme" steht direkt HINTER dem Beleg des
          // lokalen Prüfers — dort, wo der Agent ihn gerade gelesen hat.
          if (istAbnahme && gruppe.etikett === PRUEFBELEG_ETIKETT) {
            const quelle = abnahmeQuelleVon(lieferung.instanzId)
            if (quelle) {
              k.abnahmeQuellen.push(quelle)
              eintraege.push(
                texte.agentenUebergabe.abnahmeLokalerPruefer(
                  quelle.name,
                  quelle.modell,
                  texte.tor.bestaetigungFuerAbnahme(quelle.torBestaetigung)
                )
              )
            }
          }
        })
        // Beide Meldungen einmal je Block und Etikett — uebergabenText läuft in
        // jeder Reparatur-Runde erneut und würde den Ticker sonst fluten.
        if (gruppe.angekommen.length > 1 && !k.fanOutGemeldet.has(gruppe.etikett)) {
          k.fanOutGemeldet.add(gruppe.etikett)
          tickern(
            texte.ticker.uebergabenZusammengefuehrt(gruppe.angekommen.length, gruppe.etikett)
          )
        }
        // Zwei Gründe, zwei Zeilen (0.46.2): „näher im Schaubild" gilt nur noch
        // für die Distanz; was ins Zweitaudit eingegangen ist, ist nicht
        // verloren, sondern steckt in dessen Beleg — die Zeile sagt genau das.
        const durchDistanz = gruppe.verdraengt.filter((l) => l.grund !== 'weiterverarbeitung')
        const durchWeiterverarbeitung = gruppe.verdraengt.filter(
          (l) => l.grund === 'weiterverarbeitung'
        )
        if (durchDistanz.length && !k.verdraengungGemeldet.has(gruppe.etikett)) {
          k.verdraengungGemeldet.add(gruppe.etikett)
          tickern(
            texte.ticker.uebergabeVerdraengt(
              gruppe.etikett,
              texte.ticker.blockBezeichnung(nummerVon.get(k.eintrag.instanzId), k.name),
              gruppe.angekommen.map(bezeichnung).join(' und '),
              durchDistanz.map(bezeichnung).join(', ')
            )
          )
        }
        if (durchWeiterverarbeitung.length && !k.weiterverarbeitungGemeldet.has(gruppe.etikett)) {
          k.weiterverarbeitungGemeldet.add(gruppe.etikett)
          const weiterverarbeiter = [
            ...new Set(durchWeiterverarbeitung.flatMap((l) => l.verdraengtVon ?? []))
          ]
          tickern(
            texte.ticker.uebergabeWeiterverarbeitet(
              gruppe.etikett,
              durchWeiterverarbeitung.map(bezeichnung).join(' und '),
              weiterverarbeiter.map(bezeichnungVonId).join(' und '),
              texte.ticker.blockBezeichnung(nummerVon.get(k.eintrag.instanzId), k.name),
              gruppe.angekommen.map(bezeichnung).join(' und ')
            )
          )
        }
      }
      if (eintraege.length === 0) return ''
      return texte.agentenUebergabe.ueberschrift + eintraege.join('')
    }

    // Warte-Grund im Ticker (BAUPLAN 36): „Angreifer wartet — Bauer schreibt
    // gerade" statt einer stillen Pause. Je Block und Grund genau einmal —
    // bereiteStarten läuft nach jedem fertigen Block erneut und würde den
    // Ticker sonst mit derselben Zeile fluten.
    function warteGrundMelden(k, grund, worauf, zusatz = {}) {
      if (!worauf.length) return
      k.warteGemeldet ??= new Set()
      const schluessel = grund + ':' + worauf.join('|')
      if (k.warteGemeldet.has(schluessel)) return
      k.warteGemeldet.add(schluessel)
      // Die vier Gründe der Welle (BAUPLAN 46) kommen aus wellenStartRegel;
      // 'zweig' ist die Zusammenführung aus BAUPLAN 36.
      const anderer = worauf[0]
      if (grund === 'ueberschneidung')
        tickern(
          texte.ticker.warteAufUeberschneidung(
            k.name,
            worauf.join('", „'),
            (zusatz.paare ?? [])
              .slice(0, 3)
              .map((p) => `${p.a} ↔ ${p.b}`)
              .join(', ')
          )
        )
      else if (grund === 'ohneVertrag')
        tickern(texte.ticker.warteOhneDatenvertrag(k.name, anderer, zusatz.selbstOhne === true))
      else if (grund === 'prueferWartet')
        tickern(texte.ticker.prueferWartetAufUmsetzer(k.name, anderer))
      else if (grund === 'umsetzerWartet')
        tickern(texte.ticker.umsetzerWartetAufPruefer(k.name, anderer))
      else if (grund === 'frageOffen') tickern(texte.ticker.warteAufFolgenFrage(k.name, anderer))
      // Lokale Klasse (BAUPLAN 49/51): alle Adressen des Ollama-Pools belegt —
      // die Zeile nennt ALLE Halter und die ehrliche Adress-Anzahl.
      else if (grund === 'lokalBelegt')
        tickern(texte.ticker.warteGrundLokal(k.name, worauf.join('", „'), zusatz.anzahl ?? 1))
      else tickern(texte.ticker.warteAufZweig(k.name, worauf))
    }

    // Die Kennungen der Blöcke, deren Anlauf gerade läuft — ohne die
    // Folgen-Fragen, die seit BAUPLAN 46 als eigene Teilnehmer im selben Race
    // hängen ('entscheidung:…').
    function laufendeBloecke() {
      return [...laufende.keys()].filter((id) => knoten.has(id))
    }

    // Startet alle Blöcke, deren Vorgänger fertig sind — unter der Regel der
    // Welle (BAUPLAN 46, wellenStartRegel): beliebig viele nur-lesende
    // gleichzeitig; Schreiber nebeneinander nur mit getrennten Dateilisten,
    // Prüfer nur neben Prüfern.
    function bereiteStarten() {
      if (endZustand || lauf.sanft || lauf.hart) return
      // Einmal je Welle (nicht je Lauf): Georg soll jede Welle sehen. Zurück-
      // gesetzt, sobald kein Schreiber mehr läuft.
      if (!laufendeBloecke().some((id) => !knoten.get(id).def.nurLesen)) welleGemeldet = false
      for (const eintrag of kette) {
        const k = knoten.get(eintrag.instanzId)
        if (k.status !== 'offen') continue
        const vorgaenger = vorgaengerVon.get(eintrag.instanzId)
        if (!vorgaenger.every((id) => knoten.get(id).status === 'fertig')) {
          // Warte-Grund im Ticker (BAUPLAN 36): Nur an echten Zusammen-
          // führungen — ein Zweig ist fertig, der andere läuft noch. In der
          // geraden Kette ist „wartet auf den Vorgänger" keine Nachricht,
          // sondern der Normalfall, und würde den Ticker zuschütten.
          if (vorgaenger.length > 1 && vorgaenger.some((id) => knoten.get(id).status === 'fertig'))
            warteGrundMelden(
              k,
              'zweig',
              vorgaenger
                .filter((id) => knoten.get(id).status !== 'fertig')
                .map((id) => knoten.get(id).name)
            )
          continue
        }
        // Lokale Klasse (BAUPLAN 49/51): eine GPU je Ollama-Adresse — es
        // laufen höchstens so viele lokale Blöcke, wie der Adress-Pool
        // Einträge hat (lokaleStartRegel oben bei wellenStartRegel). Sind
        // alle Adressen belegt, wartet der Kandidat mit ehrlichem Grund im
        // Ticker. Bewusst VOR dem nurLesen-Zweig: Auch nur-lesende lokale
        // Blöcke belegen eine GPU.
        const kandidatLokal = klasseIstLokal(blockModellKlasse(k.def, k.eintrag))
        if (kandidatLokal) {
          const urteilLokal = lokaleStartRegel(
            k,
            laufendeBloecke().map((id) => knoten.get(id)),
            lokalPool.length
          )
          if (!urteilLokal.darf) {
            warteGrundMelden(k, urteilLokal.grund, urteilLokal.worauf, urteilLokal)
            continue
          }
        }
        if (!k.def.nurLesen) {
          // Der Kandidat mit seiner FRISCHEN Dateiliste (eine Lieferung kann
          // seit dem letzten Versuch angekommen sein); die Laufenden mit der
          // beim Start gemerkten.
          // Als „laufend" zählt jeder, der Revier belegt (schreiberBelegt) —
          // auch ein Block im Nachlauf: Sein Anlauf ist vorbei, aber seine
          // Arbeit ist noch nicht gemeinsamer Stand, und seine Dateiliste
          // ist noch sein Revier. Ließe man einen überschneidenden Nachbarn
          // jetzt schon los, schriebe der in genau dieses geschützte Revier
          // hinein — der Punkt „Nach Block D" nähme seine Arbeit dann nicht
          // auf, und der Punkt „Nach Block A" trüge sie fälschlich (gemessen).
          const kandidat = { ...wellenKnoten(k), dateiListe: dateiListeFuer(k) }
          const urteil = wellenStartRegel(
            kandidat,
            [...knoten.values()]
              .filter((nk) => nk.status === 'laeuft' || schreiberBelegt(nk))
              .map(wellenKnoten),
            // Und die Zweige mit offener Folgen-Frage: „Stand wiederherstellen"
            // könnte sie zurücksetzen — bis dahin schreibt dort niemand hinein.
            offeneFragenZweige()
          )
          if (!urteil.darf) {
            // Und jetzt steht im Ticker, auf wen und warum dieser Block wartet.
            warteGrundMelden(k, urteil.grund, urteil.worauf, urteil)
            continue
          }
          // Schon HIER merken, nicht erst im Motor-Aufruf: Der nächste Kandidat
          // derselben Runde liest die Liste dieses Blocks als „laufend" — und
          // hielte ihn ohne sie für einen Schreiber ohne Datenvertrag.
          k.dateiListeAktiv = kandidat.dateiListe
        }
        // Adress-Zuteilung (BAUPLAN 51): erst NACH lokaler Regel UND
        // wellenStartRegel, unmittelbar mit dem Statuswechsel — bekäme der
        // Kandidat die Adresse schon beim lokalen Check, hielte er eine GPU,
        // obwohl die Welle ihn danach ablehnen kann (continue). Die Zuteilung
        // gilt für ALLE Anläufe des Blocks (Reparatur-Runden, Überträge,
        // Tore) und wandert bewusst NICHT in den Laufstand (standSpeichern):
        // Nach einem App-Neustart geht ein Läufer auf 'offen' zurück und
        // bekommt hier eine frische Zuteilung — eine gespeicherte alte
        // Adresse könnte auf einen geschrumpften Pool zeigen. Frei ist, was
        // kein Knoten mit status 'laeuft' hält — dieselbe abgeleitete
        // Rechnung wie in lokaleStartRegel; weil k.status gleich darunter auf
        // 'laeuft' geht, zählt derselbe Planer-Durchgang (mehrere Starts je
        // Runde) die eben vergebene Adresse automatisch mit.
        if (kandidatLokal) {
          const belegt = new Set(
            [...knoten.values()]
              .filter((nk) => nk !== k && nk.status === 'laeuft' && nk.lokalZuteilung)
              .map((nk) => nk.lokalZuteilung.adresse)
          )
          k.lokalZuteilung = lokalPool.find((eintrag) => !belegt.has(eintrag.adresse)) ?? null
          // Nach bestandener lokaleStartRegel MUSS eine Adresse frei sein —
          // der Wächter fängt nur einen künftigen Umbaufehler ab, statt ohne
          // Zuteilung zu starten (blockAusfuehren bräche dann hart ab).
          if (!k.lokalZuteilung) continue
        }
        k.warteGemeldet?.clear()
        k.status = 'laeuft'
        lauf.aktiveInstanzen.add(eintrag.instanzId)
        senden({ art: 'block', instanzId: eintrag.instanzId })
        tickern(texte.ticker.blockStartet(nummerVon.get(eintrag.instanzId), kette.length, k.name))
        // Empfänger im Auftrag (BAUPLAN 43): Was FlowForge diesem Block über
        // seinen Platz im Schaubild sagt, steht damit auch im Ticker und im
        // Laufbericht — Wort für Wort derselbe Text, den der Agent vorn in
        // seinem Auftrag liest. Der Wortlaut kommt unverändert aus
        // texte.agentenVorspann; hier wird nichts formuliert.
        if (!vorspannGemeldet.has(eintrag.instanzId)) {
          vorspannGemeldet.add(eintrag.instanzId)
          const zeile = vorspannZeileVon.get(eintrag.instanzId)
          if (zeile) tickern(zeile)
        }
        // Audit (BAUPLAN 25): volle Lesetiefe, bewusst teuer — die
        // Kosten-Folge steht sichtbar am Start im Ticker.
        if (k.def.audit) tickern(texte.ticker.auditKostenHinweis)
        // Zusammenführung sichtbar machen (BAUPLAN 13): dieser Block hat auf
        // mehrere Zweige gewartet.
        if (vorgaenger.length > 1)
          tickern(texte.ticker.zweigeZusammengefuehrt(k.name, vorgaenger.length))
        laufende.set(
          eintrag.instanzId,
          knotenAusfuehren(k).then((ergebnis) => ({ id: eintrag.instanzId, ergebnis }))
        )
      }
      // Sichtbarer Hinweis (SPEC §4.1, BAUPLAN 13): parallele Blöcke
      // vervielfachen den Verbrauch — einmal pro Lauf.
      const laufendeIds = laufendeBloecke()
      if (laufendeIds.length > 1 && !parallelGemeldet) {
        parallelGemeldet = true
        tickern(texte.lauf.parallelBloeckeHinweis(laufendeIds.length))
      }
      // Welle (BAUPLAN 46): Sobald zwei Schreiber gleichzeitig laufen, steht das
      // im Ticker — einmal je Welle.
      const schreiber = laufendeIds.filter((id) => !knoten.get(id).def.nurLesen)
      if (schreiber.length > 1 && !welleGemeldet) {
        welleGemeldet = true
        tickern(texte.ticker.welleGestartet(schreiber.length))
      }
    }

    // Prüfkarten (SPEC §3.1/§4.3, BAUPLAN 18): Nach jeder bestandenen Prüfung
    // entsteht automatisch eine Prüfkarte; dahinter bewahrt FlowForge die
    // frischen Prüfdateien dieses Laufs auf. Angepasste Fassungen eingelegter
    // alter Prüfungen ersetzen ihr Archiv — die Karte veraltet nicht.
    function pruefkarteNachBestandenerPruefung(instanzId, meldungen) {
      try {
        // Aufbewahrt wird ausschließlich der eigene Prüfordner (BAUPLAN 41) —
        // sonst nähme der erste bestehende Prüfer die Tests aller mit.
        const pruefOrdner = knoten.get(instanzId)?.pruefOrdner ?? ''
        const frisch = kartenLaden(projektPfad)
        const vorhandene = new Set(frisch.ok ? frisch.karten.map((karte) => karte.id) : [])
        for (const anhang of pruefkartenVonInstanz.get(instanzId) ?? [])
          if (vorhandene.has(anhang.id))
            pruefkartenArchivAuffrischen(projektPfad, anhang.id, pruefOrdner)
        // Prüfkarte aus dem gemeldeten Feld (BAUPLAN 42) statt aus zwei
        // Marker-Zeilen im Fließtext. Fehlt sie, greift wie bisher der Ersatz.
        const roh = pruefkarteAusMeldungen(meldungen) ?? {}
        const zeitText = new Date().toLocaleString('de-DE', {
          dateStyle: 'short',
          timeStyle: 'short'
        })
        // Herkunft (BAUPLAN 30): Prüfkarten sind „von FlowForge" — mit dem
        // Prüf-Block, dem Lauf und dem gemeldeten Paket.
        const angelegt = pruefkarteAnlegen(
          projektPfad,
          {
            titel: roh.titel ?? texte.pruefkarten.ersatzTitel(zeitText),
            text: roh.text ?? texte.pruefkarten.ersatzText
          },
          { ...herkunftFuerBlock(instanzId), quelle: 'flowforge' }
        )
        if (!angelegt.ok) return
        pruefungenArchivieren(projektPfad, angelegt.karte.id, pruefOrdner)
        senden({ art: 'karten', karten: angelegt.karten })
        tickern(texte.ticker.pruefkarteAngelegt(angelegt.karte.titel))
      } catch {
        // Ein klemmendes Archiv darf das Laufende nicht stören — die Prüfung
        // selbst ist bestanden, nur die Aufbewahrung fiel aus.
      }
    }

    // Vollständigkeit des Zuschnitts (BAUPLAN 44): Prüft eine Auftragsquelle,
    // die eben gemeldet hat, und fordert genau EINMAL nach. Liefert true, wenn
    // der Block weiterlaufen darf, und false, wenn er dafür erneut startet.
    //
    // Verbraucht ist die Runde, macht der Lauf ehrlich vermerkt weiter — wie
    // bei Startanleitung, Rauchtest und Prüfbefehl, NICHT wie bei der
    // Meldungspflicht: Ein unvollständiger Zuschnitt ist ein zu enges Paket,
    // kein fehlendes Ergebnis; den ganzen Lauf dafür fallen zu lassen, kostete
    // Georg mehr, als es ihm brächte.
    function zuschnittGeprueft(k, id, ergebnis) {
      const bezeichnung = texte.ticker.blockBezeichnung(nummerVon.get(id), k.name)
      const nachfordern = (nachtrag, tickerZeile) => {
        // Auch dieser Anlauf steht im Bericht: Er hat Kontingent gekostet, und
        // Georg soll sehen, was FlowForge beanstandet hat.
        bericht.blockErgebnisse.push({
          instanzId: id,
          block: k.def.name,
          zusatz: zusatznameBereinigen(k.eintrag.zusatz),
          zeit: jetztIso(),
          zustand: 'zuschnitt-unvollstaendig',
          ergebnisText: String(ergebnis.ergebnisText ?? '').slice(0, 4000),
          meldungen: k.meldungen,
          tokens: ergebnis.blockTokens ?? null,
          // Block-Dauer (BAUPLAN 51, V2): Summe der Anlauf-Wanduhrzeiten.
          dauerMs: ergebnis.blockDauerMs ?? null,
          aufschluesselung: ergebnis.blockAufschluesselung ?? null,
          kostenUsd: ergebnis.blockKosten ?? null,
          modelle: ergebnis.blockModelle ?? null,
          // Klasse und Denktiefe (0.48.1): die Wahl an der Karte und die vom
          // Motor gemessene wirksame Stufe (null = keine Meldung).
          klasse: blockModellKlasse(k.def, k.eintrag),
          denktiefe: blockDenktiefe(k.def, k.eintrag),
          denktiefeGemessen: ergebnis.blockDenktiefeGemessen ?? null
        })
        zuschnittNachgefordert.add(id)
        // Der Nachtrag hängt am KNOTEN, nicht im Auftragstext — der wird bei
        // jedem Anlauf vollständig neu gebaut.
        k.zuschnittNachforderung = nachtrag
        // Seine eigene Meldung von eben liegt bei: Er soll nachtragen, nicht
        // neu erarbeiten.
        k.meldungWiederholen = true
        k.meldungenVorher = k.meldungen.length ? k.meldungen : k.meldungenVorher
        k.status = 'offen'
        tickern(tickerZeile)
      }
      const budgetFrei = () =>
        !zuschnittNachgefordert.has(id) && !lauf.sanft && !lauf.hart && !endZustand
      const paket = gemeldetesPaketVon(id)
      // paket_melden ist Pflicht für Auftragsquellen (BAUPLAN 44): Ohne die
      // Meldung trägt keine Karte dieses Laufs ihre Herkunft, und die
      // Vollständigkeitsprüfung liefe still leer — Georg sähe einen grünen Lauf
      // und hielte eine nicht gelaufene Prüfung für eine bestandene.
      if (!paket) {
        if (budgetFrei()) {
          nachfordern(
            texte.agentenZuschnitt.nachforderungPaket,
            texte.ticker.paketNachgefordert(bezeichnung)
          )
          return false
        }
        tickern(texte.ticker.paketFehltWeiter(bezeichnung))
        return true
      }
      const ziele = zieleVon.get(id) ?? []
      const deckung = zuschnittDeckung(ziele, paket, k.meldungen)
      const aufgaben = deckung.fehlendeAufgaben.map((a) => a.titel)
      const offeneZiele = deckung.unbedienteZiele.map((z) => z.bezeichnung)
      if (aufgaben.length || offeneZiele.length) {
        if (budgetFrei()) {
          nachfordern(
            texte.agentenZuschnitt.nachforderung(aufgaben, offeneZiele),
            texte.ticker.zuschnittNachgefordert(bezeichnung, aufgaben, offeneZiele)
          )
          return false
        }
        tickern(texte.ticker.zuschnittWeiterOhne(bezeichnung, aufgaben, offeneZiele))
        return true
      }
      // Die ehrliche Grenze (SPEC §4.1): Kommt der Auftrag allein aus dem
      // Wunsch-/Fehlerbild-Feld, gibt es keine Aufgaben-Karten, gegen die
      // gemessen werden könnte — dann sagt der Ticker das, statt eine nicht
      // gelaufene Prüfung wie eine bestandene aussehen zu lassen.
      if (paket.length === 0) tickern(texte.ticker.paketOhneAufgaben(bezeichnung))
      return true
    }

    // Verarbeitet das endgültige Ergebnis eines Blocks — nacheinander, auch
    // wenn mehrere Blöcke gleichzeitig fertig werden.
    async function verarbeite(id, ergebnis) {
      const k = knoten.get(id)

      if (ergebnis.zustand === 'hart-abgebrochen') {
        // Der Abbruch samt Zurücksetzen wird nach dem Ende aller Motoren
        // einmal zentral erledigt. Wer dabei WIRKLICH mitten im Anlauf stand,
        // wird hier vermerkt: Danach steht er auf 'offen' wie jeder wartende
        // Block, und der zentrale Rückroll unten könnte sonst den Strang eines
        // Blocks nehmen, der gar nicht abbricht.
        k.hartAbgebrochen = true
        k.status = 'offen'
        return
      }
      if (ergebnis.zustand === 'sanft-gestoppt') {
        k.status = 'offen'
        if (!endZustand) endZustand = 'sanft-gestoppt'
        return
      }
      if (ergebnis.zustand === 'fehlgeschlagen') {
        k.status = 'offen'
        // Kontingent erschöpft mit Einstellung „anhalten" (SPEC §5).
        if (ergebnis.fehlerArt === 'kontingent' && einstellungen.motorModus === 'abo') {
          benachrichtigen(
            texte.benachrichtigung.pauseTitel,
            texte.benachrichtigung.pauseGestopptText,
            { immer: true }
          )
          if (!endZustand) {
            endZustand = 'kontingent-erschoepft'
            fehlertext = ergebnis.fehlertext
          }
          return
        }
        bericht.blockErgebnisse.push({
          instanzId: id,
          // Katalogname und Zusatzname getrennt (BAUPLAN 41, SPEC §3.4): Sonst
          // zerfiele „Blocktyp" in den Metriken in beliebig viele Typen.
          block: k.def.name,
          zusatz: zusatznameBereinigen(k.eintrag.zusatz),
          zeit: jetztIso(),
          zustand: 'fehlgeschlagen',
          ergebnisText: String(ergebnis.fehlertext ?? '').slice(0, 4000),
          tokens: ergebnis.blockTokens ?? null,
          // Block-Dauer (BAUPLAN 51, V2): Summe der Anlauf-Wanduhrzeiten.
          dauerMs: ergebnis.blockDauerMs ?? null,
          aufschluesselung: ergebnis.blockAufschluesselung ?? null,
          kostenUsd: ergebnis.blockKosten ?? null,
          modelle: ergebnis.blockModelle ?? null,
          // Klasse und Denktiefe (0.48.1): die Wahl an der Karte und die vom
          // Motor gemessene wirksame Stufe (null = keine Meldung).
          klasse: blockModellKlasse(k.def, k.eintrag),
          denktiefe: blockDenktiefe(k.def, k.eintrag),
          denktiefeGemessen: ergebnis.blockDenktiefeGemessen ?? null
        })
        if (!endZustand) {
          endZustand = 'fehlgeschlagen'
          fehlertext = ergebnis.fehlertext
        }
        return
      }

      // Lieferschein (BAUPLAN 42): Ohne vollständige Meldung ist der Block
      // nicht fertig — es gibt keinen Rückfall auf den Abschlusstext. Genau
      // eine Nachforderung (erprobtes Muster wie Startanleitung und
      // Prüfbefehl), danach gilt der Block als fehlgeschlagen.
      if (!meldungVollstaendig(k.def, k.meldungen)) {
        const fehlende = fehlendeLieferungen(k.def, k.meldungen)
        // Auch der Anlauf ohne Meldung steht im Bericht: Er hat Kontingent
        // gekostet, und Georg soll sehen, woran es lag.
        bericht.blockErgebnisse.push({
          instanzId: id,
          block: k.def.name,
          zusatz: zusatznameBereinigen(k.eintrag.zusatz),
          zeit: jetztIso(),
          zustand: 'ohne-meldung',
          ergebnisText: String(ergebnis.ergebnisText ?? '').slice(0, 4000),
          meldungen: k.meldungen,
          tokens: ergebnis.blockTokens ?? null,
          // Block-Dauer (BAUPLAN 51, V2): Summe der Anlauf-Wanduhrzeiten.
          dauerMs: ergebnis.blockDauerMs ?? null,
          aufschluesselung: ergebnis.blockAufschluesselung ?? null,
          kostenUsd: ergebnis.blockKosten ?? null,
          modelle: ergebnis.blockModelle ?? null,
          // Klasse und Denktiefe (0.48.1): die Wahl an der Karte und die vom
          // Motor gemessene wirksame Stufe (null = keine Meldung).
          klasse: blockModellKlasse(k.def, k.eintrag),
          denktiefe: blockDenktiefe(k.def, k.eintrag),
          denktiefeGemessen: ergebnis.blockDenktiefeGemessen ?? null
        })
        k.status = 'offen'
        if (!meldungNachgefordert.has(id) && !lauf.sanft && !lauf.hart && !endZustand) {
          meldungNachgefordert.add(id)
          k.meldungWiederholen = true
          tickern(texte.ticker.meldungNachgefordert(k.name))
          // Der Auftrag legt den freien Abschlusstext bei — daraus trägt der
          // Agent die Meldung nach, ohne die Arbeit zu wiederholen.
          k.meldungenVorher = k.meldungen.length ? k.meldungen : k.meldungenVorher
          k.nachforderungBeleg = String(ergebnis.ergebnisText ?? '')
          return
        }
        tickern(texte.ticker.meldungFehlt(k.name, fehlende))
        if (!endZustand) {
          endZustand = 'fehlgeschlagen'
          fehlertext = texte.lieferschein.ohneMeldung
        }
        return
      }

      // Vollständigkeit des Zuschnitts (BAUPLAN 44): Deckt der geschnittene
      // Zuschnitt jede gemeldete Aufgabe ab, und hat jedes benannte Ziel ein
      // Paket bekommen? Eingehängt HINTER der Meldungspflicht und VOR
      // k.status='fertig' — dahinter wäre der Block schon verbucht, alle
      // Anlauf-Zusätze abgeräumt und er stünde zweimal im Bericht.
      // Nur Auftragsquellen (Kennzeichen kartenZuteilung) schneiden Pakete.
      if (k.def.kartenZuteilung && !zuschnittGeprueft(k, id, ergebnis)) return

      // Block ist wirklich fertig: mitgeschleppte Zusätze für den nächsten
      // Anlauf sind damit erledigt.
      k.status = 'fertig'
      // Abnahme (BAUPLAN 50): Ob DIESER Anlauf am Vor-Tor endete (kein Agent)
      // — liest abnahmeVermerken für durchTor.
      k.anlaufDurchTor = ergebnis.durchTor === true
      // Nachgeholte Rückführung (BAUPLAN 47): Kam WÄHREND dieses Anlaufs eine
      // Rückmeldung an (der Anlauf hatte seine beim Auftragsbau auf „gelesen"
      // gesetzt — steht sie jetzt wieder auf offen, hat ein Prüfer den laufenden
      // Block zurückgeschickt; ein nur-lesendes oder prüfendes Ziel startet neben
      // Prüfern sofort), dann gehört sie dem NÄCHSTEN Anlauf: Rückmeldung,
      // Diff-Anforderung, Vor-Fazit und Tor-Protokoll bleiben stehen, der Block
      // läuft gleich noch einmal (nachgeholteRueckfuehrung). Bis dahin wischte
      // das Blockende sie — die Runde war genommen, die Kritik erreichte niemanden.
      const nachgeholt = k.rueckmeldungOffen === true
      if (!nachgeholt) {
        k.rueckmeldung = ''
        k.rueckmeldungOffen = false
      }
      k.nachpruefung = ''
      k.nachpruefungBeanstandungen = []
      k.startanleitungNachforderung = false
      k.uebergabe = ''
      k.uebergabeVerloren = false
      // Kanten-Zusätze dieses Anlaufs (BAUPLAN 34) sind damit ebenfalls erledigt
      // — der Diff-Text immer (diffAnfordern rechnet ihn für den nächsten Anlauf neu).
      k.diffText = ''
      if (!nachgeholt) {
        k.diffAnfordern = false
        k.vorFazit = ''
      }
      // Lieferschein-Zusätze dieses Anlaufs (BAUPLAN 42) ebenso.
      k.meldungWiederholen = false
      k.nachforderungBeleg = ''
      // Zuschnitt-Nachtrag dieses Anlaufs (BAUPLAN 44) ebenso.
      k.zuschnittNachforderung = ''
      // Tor-Zusätze dieses Anlaufs (BAUPLAN 35) ebenso.
      if (!nachgeholt) k.torProtokoll = ''
      k.rauchtestRueckmeldung = ''
      k.pruefbefehlNachforderung = false
      k.torGruenBefehl = ''

      // Die gemeldeten Lieferungen für die Nachfahren ablegen und für die
      // Karten-Anzeige merken (BAUPLAN 42): Was der Nachfolger bekommt, ist der
      // geprüfte Lieferschein — nicht mehr ein Fließtext, aus dem FlowForge
      // sich etwas heraussucht.
      k.lieferungen = lieferungenAusMeldungen(k.meldungen)
      // Vollständig, ohne Deckel (seit 0.46.1) — was der Block gemeldet hat,
      // kommt genau so beim Nachfolger an.
      k.lieferung = meldungenText(k.meldungen)
      const blockErgebnis = {
        instanzId: id,
        // Katalogname für die Metriken, Zusatzname daneben (BAUPLAN 41).
        block: k.def.name,
        zusatz: zusatznameBereinigen(k.eintrag.zusatz),
        zeit: jetztIso(),
        zustand: 'erfolgreich',
        // Der lesbare Lieferschein — alte Berichte tragen hier den früheren
        // Abschlusstext, die Anzeige kommt mit beidem zurecht. (Nur die
        // Bericht-Anzeige ist gestutzt; die vollständigen Felder stehen in
        // `meldungen` darunter, und die Übergabe selbst ist ungekürzt.)
        ergebnisText: k.lieferung.slice(0, 4000),
        // Anzeige strukturierter Ergebnisse (SPEC §6, BAUPLAN 42): die Felder
        // selbst, damit der Laufbericht gegliederte Abschnitte zeigen kann.
        meldungen: k.meldungen,
        // Verbrauch dieses Anlaufs — so sieht Georg im Laufbericht, was jeder
        // Block gekostet hat (Koordinator-Zuwachs plus seine Agenten).
        tokens: ergebnis.blockTokens ?? null,
        // Block-Dauer (BAUPLAN 51, V2): Summe der Anlauf-Wanduhrzeiten dieses
        // Blocks (Motorstart bis Ergebnis je Anlauf; Pausen zwischen Anläufen
        // zählen nicht — SPEC §3.4). Alte Berichte tragen das Feld nicht;
        // Anzeige und Metrik lesen „fehlt" als „ohne Angabe", nie als 0.
        dauerMs: ergebnis.blockDauerMs ?? null,
        // Token-Aufschlüsselung und theoretische API-Kosten je Block
        // (Wunsch Georg, 13.08.2026) — die Kosten rechnet der Motor selbst
        // aus den Preisen der genutzten Modelle.
        aufschluesselung: ergebnis.blockAufschluesselung ?? null,
        kostenUsd: ergebnis.blockKosten ?? null,
        // Modell je Block (BAUPLAN 36): welches Modell diesen Anlauf gearbeitet
        // hat (bei Mischung mit Anteilen) — Grundlage der Metrik Blocktyp × Modell.
        modelle: ergebnis.blockModelle ?? null,
        // Klasse und Denktiefe (0.48.1): die Wahl an der Karte (Schlüssel aus
        // MODELL_KLASSEN/DENKTIEFEN) und die vom Motor gemessene wirksame Stufe
        // (null = keine Meldung) — Grundlage der Metrik-Spalte Denktiefe und
        // der Klasse-Zeile im Laufbericht.
        klasse: blockModellKlasse(k.def, k.eintrag),
        denktiefe: blockDenktiefe(k.def, k.eintrag),
        denktiefeGemessen: ergebnis.blockDenktiefeGemessen ?? null,
        // Lokaler Prüfer (BAUPLAN 50): Ausgang des Tor-Ankers und das selbst
        // gemeldete Urteil VOR einer Drehung — beide null, wenn dieser Anlauf
        // kein lokaler Prüfer war oder am Vor-Tor endete; torBestaetigung null
        // auch bei Urteil „fehlgeschlagen" (kein Nachspiel). Alte Berichte
        // tragen die Felder nicht; Anzeige und Metrik lesen „fehlt" wie null.
        torBestaetigung: ergebnis.torBestaetigung ?? null,
        urteilLokal: ergebnis.urteilLokal ?? null
      }
      bericht.blockErgebnisse.push(blockErgebnis)

      // Hat der Block Aufgaben-Karten erzeugt (Spec-Interview), gehören seine
      // neuen offenen Aufgaben ab jetzt zur Kartenauswahl des Laufs — die
      // Folgeblöcke arbeiten ja genau damit (festgenagelte Vorauswahl, SPEC §5).
      if (k.def.erzeugtAufgaben) {
        const frisch = kartenLaden(projektPfad)
        if (frisch.ok)
          for (const karte of frisch.karten)
            if (karte.sorte === 'aufgabe' && !karte.erledigt && !ausgewaehlt.includes(karte.id))
              ausgewaehlt.push(karte.id)
      }

      // Startanleitung als Pflicht-Artefakt (SPEC §8): Ein Bau-Block ist erst
      // fertig, wenn die maschinenlesbare Startanleitung existiert. Fehlt sie,
      // läuft derselbe Block genau einmal mit einer Nachforderung erneut;
      // fehlt sie danach immer noch, macht der Lauf ehrlich vermerkt weiter.
      if (k.def.startanleitungPflicht && !startanleitungVorhanden(projektPfad)) {
        blockErgebnis.zustand = 'startanleitung-fehlt'
        if (!startanleitungNachgefordert.has(id) && !lauf.sanft && !lauf.hart && !endZustand) {
          startanleitungNachgefordert.add(id)
          k.startanleitungNachforderung = true
          // Lieferschein (BAUPLAN 42): Der neue Anlauf meldet erneut — mit
          // seiner eigenen Meldung von eben als Vorlage.
          k.meldungWiederholen = true
          k.status = 'offen'
          tickern(texte.ticker.startanleitungNachgefordert(k.name))
          return
        }
        tickern(texte.ticker.startanleitungWeiterOhne)
      }

      // Rauchtest der Startanleitung (BAUPLAN 35) — seit der Welle (BAUPLAN 46,
      // Vertrag F7) NICHT mehr, solange nebenan ein anderer Umsetzer schreibt:
      // Der Test misste sonst einen Zwischenstand, in dem halb geschrieben
      // wurde. Der Block geht IMMER in den NACHLAUF (0.46.2); die Planer-
      // Schleife misst dort — sobald die Welle steht — GENAU EINEN Rauchtest
      // für alle wartenden Blöcke (nachlaeufeAbarbeiten), bevor sie Neues
      // startet. Ein Bauer allein sieht davon nichts: Die Welle steht sofort,
      // der Test läuft in derselben Planer-Runde. Die Wartezeile kommt nur,
      // wenn nebenan wirklich noch jemand schreibt.
      if (rauchtestSteht(k)) {
        k.status = 'nachlauf'
        k.nachlaufErgebnis = blockErgebnis
        k.nachlaufReihe = ++nachlaufZaehler
        if (!welleSteht(k)) tickern(texte.ticker.nachlaufWartet(k.name))
        return
      }
      await verarbeiteEnde(k, id, blockErgebnis)
      nachgeholteRueckfuehrung(k)
    }
    // Nachgeholte Rückführung (BAUPLAN 47): Der Block hat seinen Anlauf regulär
    // beendet (verarbeiteEnde ist durch — Lieferungen, Punkt und Bericht dieses
    // Anlaufs stehen), aber WÄHREND er lief, hat ein Prüfer ihn zurückgeschickt:
    // Die Rückmeldung liegt ungelesen am Knoten. Dann geht er sofort wieder auf
    // 'offen' und läuft mit ihr noch einmal — wie jede Rückführung eines
    // fertigen Blocks, nur eben nachgeholt. Ein Block, der in verarbeiteEnde
    // selbst auf 'offen' ging (Prüfer nach Rückführung, Nachforderung), ist nicht
    // 'fertig' und bleibt hier unberührt. Das Vor-Fazit ist das des EBEN
    // beendeten Anlaufs — die Rückführung hatte noch das ältere gemerkt.
    // Zusammenspiel mit dem Bündel-Zweig: Fällt P2 durch, während das Ziel
    // läuft (Rückmeldung gelesen, also nicht offen), nimmt er den Budget-Zweig
    // und setzt die Rückmeldung wieder auf offen — genau der Fall hier. Fällt
    // danach noch ein DRITTER Prüfer durch, solange das Ziel läuft, greift der
    // Bündel-Zweig (offen) und hängt an: Beide Kritiken kommen im nachgeholten
    // Anlauf an, eine Runde.
    function nachgeholteRueckfuehrung(k) {
      if (k.status !== 'fertig' || k.rueckmeldungOffen !== true) return
      k.status = 'offen'
      k.vorFazit = k.lieferung ?? ''
      tickern(texte.ticker.rueckfuehrungNachgeholt(k.name))
    }
    // Zählt, in welcher Reihenfolge Blöcke in den Nachlauf gehen (0.46.2) —
    // wird VOR der Planer-Schleife angelegt, verarbeite läuft erst dort.
    let nachlaufZaehler = 0

    // Steht für diesen Block ein Rauchtest an? Genau die Bedingung, die bis
    // Bauschritt 45 direkt vor dem Test stand.
    function rauchtestSteht(k) {
      return (
        k.def.startanleitungPflicht &&
        k.status === 'fertig' &&
        !lauf.sanft &&
        !lauf.hart &&
        !endZustand
      )
    }

    // Letzte nichtleere Zeile einer Prozess-Ausgabe, gedeckelt wie eine
    // Beanstandungs-Zeile — die Grund-Zeile des Rauchtests im Ticker (0.46.2).
    function letzteZeile(ausgabe) {
      const zeilen = String(ausgabe ?? '')
        .split('\n')
        .map((z) => z.trim())
        .filter(Boolean)
      const zeile = zeilen.length ? zeilen[zeilen.length - 1] : ''
      return zeile.length > TOR_BEANSTANDUNG_ZEILE_MAX ? zeile.slice(0, TOR_BEANSTANDUNG_ZEILE_MAX - 1) + '…' : zeile
    }

    // Der Rauchtest-Eintrag am Block-Ergebnis (0.46.2): für Grün, Rot UND
    // Übersprungen — Georg liest im Laufbericht, warum, nicht nur „lief nicht an".
    function rauchtestFuerBericht(probe, gemessenAn) {
      return {
        gruen: probe.geprueft ? probe.gruen === true : null,
        code: probe.code ?? null,
        ausgabe: mitteGekuerzt(String(probe.ausgabe ?? '').trim(), TOR_PROTOKOLL_MAX).text,
        zeile: letzteZeile(probe.ausgabe),
        grund: probe.grund ?? null,
        ...(probe.port ? { port: probe.port } : {}),
        ...(probe.besitzer ? { besitzer: probe.besitzer } : {}),
        ...(probe.abgeraeumt?.length ? { abgeraeumt: probe.abgeraeumt } : {}),
        ...(gemessenAn ? { gemessenAn } : {})
      }
    }

    // Der Rauchtest EINMAL je Welle (BAUPLAN 35, 46; seit 0.46.2 für alle
    // wartenden Blöcke zusammen): FlowForge startet die gebaute App einmal
    // kurz und stoppt sie wieder — läuft sie gar nicht an, erfährt das der
    // Bauer ohne einen Token, statt dass der Prüfer eine Runde damit verbringt.
    // Es gibt nur EINE Startanleitung je Projekt, also auch nur ein Urteil:
    // Die Nachbesserungs-Runde bekommt der Nachlauf-Block, der die Anleitung
    // ZULETZT gesetzt hat (gesetztVon in startanleitung.json); Rückfall, wenn
    // niemand aus der Welle sie gesetzt hat: der zuletzt fertig gewordene —
    // ehrlich getickert. Die übrigen Blöcke der Welle bleiben 'erfolgreich',
    // ohne Etikett und ohne Runde (im Lauf vom 18.08.2026 kosteten zwei
    // doppelte Runden ~190k Tokens für dieselbe Anleitung). Genau eine
    // Nachbesserungs-Runde je Block; danach macht der Lauf ehrlich vermerkt
    // weiter. Bei Rot steht der attribuierte Block danach auf 'offen'.
    // eintraege: [{ k, id, blockErgebnis }] — alle mit startanleitungPflicht.
    async function nachlaufFuerWelle(eintraege) {
      if (eintraege.length === 0) return
      const gesetztVon = startanleitungLaden(projektPfad).anleitung?.gesetztVon ?? null
      let ziel = eintraege.find((e) => e.id === gesetztVon) ?? null
      const rueckfall = !ziel && eintraege.length > 1
      if (!ziel) ziel = eintraege.reduce((a, b) => (b.k.nachlaufReihe > a.k.nachlaufReihe ? b : a))
      const probe = await rauchtest(projektPfad, {
        // Eigene Prozessgruppe je Rauchtest (BAUPLAN 41), benannt nach dem
        // attribuierten Block.
        gruppe: 'rauchtest:' + projektPfad + ':' + ziel.id,
        abbrechen: () => lauf.sanft || lauf.hart
      })
      for (const e of eintraege)
        if (e.blockErgebnis)
          e.blockErgebnis.rauchtest = rauchtestFuerBericht(probe, e === ziel ? null : bezeichnungFuer(ziel.k))
      for (const p of probe.abgeraeumt ?? []) tickern(texte.ticker.rauchtestWaiseBeendet(p, probe.port))

      if (probe.geprueft && probe.gruen) {
        tickern(texte.ticker.rauchtestGruen)
        return
      }
      if (!probe.geprueft) {
        if (probe.grund === 'appLaeuft') tickern(texte.ticker.rauchtestUebersprungen)
        else if (probe.grund === 'keine') tickern(texte.ticker.rauchtestKeineAnleitung)
        else if (probe.grund === 'nichtsZuStarten') tickern(texte.ticker.rauchtestNichtsZuStarten)
        else if (probe.grund === 'abgebrochen') tickern(texte.ticker.rauchtestAbgebrochen)
        else if (probe.grund === 'portFremd')
          tickern(
            probe.besitzer?.pid === process.pid
              ? texte.ticker.rauchtestPortFlowForge(probe.port)
              : texte.ticker.rauchtestPortFremd(
                  probe.port,
                  probe.besitzer ?? { pid: 0, name: '', befehl: '' },
                  probe.zugehoerigkeit === 'vermutlich'
                )
          )
        return
      }
      // Rot: nur der attribuierte Block trägt das Etikett und bekommt die Runde.
      const zeile = letzteZeile(probe.ausgabe)
      if (ziel.blockErgebnis) ziel.blockErgebnis.zustand = 'startanleitung-laeuft-nicht'
      if (rueckfall) tickern(texte.ticker.rauchtestRueckfall(ziel.k.name))
      if (!rauchtestNachgefordert.has(ziel.id)) {
        rauchtestNachgefordert.add(ziel.id)
        ziel.k.rauchtestRueckmeldung = mitteGekuerzt(
          String(probe.ausgabe ?? '').trim() || texte.tor.rauchtestOhneAusgabe,
          TOR_PROTOKOLL_MAX
        ).text
        ziel.k.meldungWiederholen = true
        ziel.k.status = 'offen'
        tickern(texte.ticker.rauchtestRotGrund(probe.code, zeile, ziel.k.name))
        return
      }
      tickern(texte.ticker.rauchtestWeiterOhneGrund(probe.code, zeile))
    }

    // Die ausstehenden Nachläufe abarbeiten (BAUPLAN 46, Vertrag F7): sobald
    // die Welle steht — kein Umsetzer läuft mehr, keine Vorreparatur schreibt —
    // und BEVOR die Planer-Schleife Neues startet. Erst EIN Rauchtest für alle
    // Wartenden (0.46.2), dann je Block das restliche Blockende (Prüfbefehl-
    // Pflicht, Urteil, Punkt) und die Zusammenführung des Strangs. Erst danach
    // ist der Block 'fertig' — für Nachfolger, Punkt und Laufstand gleichermaßen.
    //
    // Beim harten Stopp bleibt alles liegen: Ein Nachlauf-Block zählt dann
    // weiter als belegtes Revier, damit der zentrale Rückroll seine fertige
    // Arbeit nicht mitnimmt; sein Strang wird am Laufende geschlossen.
    async function nachlaeufeAbarbeiten() {
      if (lauf.hart) return
      if (!welleSteht(null)) return
      const eintraege = []
      for (const eintrag of kette) {
        const k = knoten.get(eintrag.instanzId)
        if (k.status !== 'nachlauf') continue
        eintraege.push({ k, id: eintrag.instanzId, blockErgebnis: k.nachlaufErgebnis })
        k.nachlaufErgebnis = null
      }
      if (eintraege.length === 0) return
      // Sanft gestoppt oder anderswo gescheitert: Der Test entfällt, wie er
      // auch sofort entfallen wäre — die Blöcke gelten als fertig.
      if (!lauf.sanft && !endZustand) await nachlaufFuerWelle(eintraege)
      // Erst jetzt, Block für Block, aus dem Nachlauf heraus: Wer noch wartet,
      // belegt sein Revier weiter — der Punkt „Nach Block A" nimmt B's und C's
      // Arbeit sonst schon mit, und B und C bekämen keinen eigenen Punkt mehr
      // (gemessen, als alle vorab auf 'fertig' standen).
      for (const { k, id, blockErgebnis } of eintraege) {
        if (k.status === 'nachlauf') k.status = 'fertig'
        if (k.status === 'fertig') await verarbeiteEnde(k, id, blockErgebnis)
        nachgeholteRueckfuehrung(k)
        await strangSchliessenFuer(k)
        standSpeichern()
      }
    }

    // Abnahme (BAUPLAN 50): Hat dieser Prüfer den Prüfbeleg eines lokalen
    // Prüfers bekommen (abnahmeQuellen, beim Auftragsbau festgehalten), stehen
    // jetzt beide Urteile nebeneinander — am Eintrag der Abnahme (abnahmeFuer,
    // je Partner) und nachgetragen am LETZTEN Bericht-Eintrag des lokalen
    // Prüfers (abnahme). Widerspruch = die Urteile weichen ab. durchTor = das
    // Urteil der Abnahme kam in diesem Anlauf vom eigenen Vor-Tor (torAbspielen
    // markiert sein Ergebnis, kein Agent hat gelesen; dann ist auch modelle
    // null), nicht vom Agenten — die Metrik zählt solche Paare nicht als
    // „Claude widerspricht". Der Ticker sagt je Partner, ob die Abnahme
    // bestätigt oder widerspricht.
    function abnahmeVermerken(k, id, blockErgebnis, urteilAbnahme) {
      const quellen = k.abnahmeQuellen ?? []
      if (!quellen.length) return
      const durchTor = k.anlaufDurchTor === true
      blockErgebnis.abnahmeFuer = quellen.map((q) => ({
        instanzId: q.instanzId,
        block: q.block,
        zusatz: q.zusatz,
        modell: q.modell,
        urteilLokal: q.urteilLokal,
        torBestaetigung: q.torBestaetigung,
        urteilAbnahme,
        widerspruch: q.urteilLokal !== urteilAbnahme,
        durchTor
      }))
      for (const paar of blockErgebnis.abnahmeFuer) {
        // Rückwärts: der jüngste Eintrag des Partners ist der, dessen Beleg die
        // Abnahme gelesen hat.
        const eintrag = [...bericht.blockErgebnisse]
          .reverse()
          .find((e) => e.instanzId === paar.instanzId)
        if (eintrag)
          eintrag.abnahme = {
            instanzId: id,
            block: k.def.name,
            zusatz: zusatznameBereinigen(k.eintrag.zusatz),
            urteil: urteilAbnahme,
            widerspruch: paar.widerspruch
          }
        const lokalName = knoten.get(paar.instanzId)?.name ?? paar.block
        // Kam das Urteil aus dem Vor-Tor der Abnahme, hat kein Agent gelesen —
        // der Ticker sagt es ehrlich statt „Abnahme widerspricht".
        tickern(
          durchTor
            ? texte.ticker.abnahmeDurchTor(k.name, lokalName, paar.urteilLokal, urteilAbnahme)
            : paar.widerspruch
              ? texte.ticker.abnahmeWiderspricht(k.name, lokalName, paar.urteilLokal, urteilAbnahme)
              : texte.ticker.abnahmeBestaetigt(k.name, lokalName, urteilAbnahme)
        )
      }
    }

    // Das Blockende hinter dem Rauchtest: Prüfbefehl-Pflicht, Prüfer-Urteil,
    // Punkt am Blockende. Eigene Stelle, weil beide Wege — sofort in verarbeite
    // und aus dem Nachlauf — hier ankommen müssen.
    async function verarbeiteEnde(k, id, blockErgebnis) {
      // Prüfbefehl als Pflicht-Artefakt (BAUPLAN 35): Ohne ihn muss FlowForge
      // jede Reparatur-Runde wieder mit einem Prüfer-Agenten bezahlen. Fehlt
      // er, läuft der Prüfer genau einmal mit einer Nachforderung erneut — er
      // prüft dabei nichts neu, sondern trägt nur nach und wiederholt sein
      // Urteil. Das steht bewusst VOR der Urteils-Auswertung: Sonst wäre die
      // Rückführung schon angestoßen, wenn die Nachforderung greift.
      if (
        k.def.pruefbefehlPflicht &&
        k.status === 'fertig' &&
        // Je Prüf-Instanz geprüft (BAUPLAN 41): Sonst bestünde der zweite
        // Prüfer die Pflicht, weil der erste gesetzt hat.
        !pruefbefehlVorhanden(projektPfad, id)
      ) {
        if (!pruefbefehlNachgefordert.has(id) && !lauf.sanft && !lauf.hart && !endZustand) {
          pruefbefehlNachgefordert.add(id)
          k.pruefbefehlNachforderung = true
          k.meldungWiederholen = true
          k.status = 'offen'
          tickern(texte.ticker.pruefbefehlNachgefordert(k.name))
          return
        }
        tickern(texte.ticker.pruefbefehlWeiterOhne)
      }

      // Prüfer-Blöcke: Urteil auswerten, ggf. Fehlschlag-Rückführung.
      // Seit BAUPLAN 42 kommt das Urteil aus dem gemeldeten Feld — ein Prüfer
      // ohne Prüfbeleg ist oben schon an der Meldungs-Pflicht hängengeblieben.
      if (k.def.prueft) {
        const bestanden = urteilAusMeldungen(k.meldungen)
        blockErgebnis.zustand = bestanden === true ? 'pruefung-bestanden' : 'pruefung-nicht-bestanden'
        abnahmeVermerken(k, id, blockErgebnis, bestanden === true ? 'bestanden' : 'fehlgeschlagen')
        if (bestanden === true) {
          // Bestandene Nachprüfung einer lokalen Reparatur (BAUPLAN 20):
          // die Wette hat gehalten — keine Motor-Reparatur nötig.
          if (k.lokaleNachpruefung) {
            k.lokaleNachpruefung = false
            k.lokaleVersuche = 0
            k.lokaleKritik = null
            const l = helferZaehler()
            l.reparaturenGehalten = (l.reparaturenGehalten ?? 0) + 1
            metrikUrteil(k.lokaleReparaturBlock, 'reparatur', 'gehalten', k.lokaleReparaturSchritte)
            tickern(texte.ticker.lokaleReparaturGehalten)
          }
          tickern(texte.ticker.pruefungBestanden)
          pruefkarteNachBestandenerPruefung(id, k.meldungen)
          // Tor ohne KI (BAUPLAN 35): Ein Prüfbefehl, der zu einer bestandenen
          // Prüfung gehört, taugt als Maßstab — aufbewahrt wird er außerhalb
          // des Projektordners und liefert beim nächsten Laufstart die
          // Baseline „vorher schon rot".
          pruefbefehlArchivieren(projektPfad, id)
        } else {
          tickern(bestanden === false ? texte.ticker.pruefungNichtBestanden : texte.ticker.pruefungOhneErgebnis)
          // Kanten-Ehrlichkeit (BAUPLAN 34/42): Die Beanstandungen kommen aus
          // den gemeldeten Feldern. Das Kanten-Gate „Urteil ohne Beanstandung"
          // braucht es nicht mehr — genau diese Meldung weist FlowForge schon
          // am Werkzeug ab, der Prüfer korrigiert sofort im selben Anlauf.
          const beanstandungen = beanstandungenAusMeldungen(k.meldungen)
          const belegKritik = prueferKritik(beanstandungen)
          const zielId = rueckfuehrungsZiel(workflow.bloecke, workflow.pfeile, id)
          // Weiter oben geholt als früher (BAUPLAN 45): Der Rollback unten
          // braucht den Ziel-Block schon — dessen Arbeit rollt er zurück.
          const zielK = zielId ? knoten.get(zielId) : null

          // Lokale Vorreparatur (BAUPLAN 20): Mechanische Beanstandungen
          // repariert zuerst die lokale KI — erst wenn das Budget (2 je
          // Rückführung) verbraucht ist, übernimmt der Motor-Bauer. Lokale
          // Versuche verbrauchen KEINE regulären Reparatur-Runden.
          const warLokaleNachpruefung = k.lokaleNachpruefung
          k.lokaleNachpruefung = false
          // Nach einem Rollback passt nur die Original-Kritik zum
          // wiederhergestellten Stand — nicht die der Nachprüfung.
          let eskalationsKritik = null
          if (warLokaleNachpruefung) {
            // Gescheiterte Nachprüfung: Stand zurückrollen, BEVOR es weitergeht
            // — der Motor-Bauer soll reparieren, nicht erst das Gebastel der
            // lokalen KI verstehen müssen. Der neueste Punkt auf dem Strang des
            // Prüfers ist garantiert „Stand vor lokaler Reparatur" (der
            // Fehlschlag-Zweig legt keinen an).
            //
            // Gefiltert (BAUPLAN 45): Zurückgerollt wird die Arbeit des
            // ZIEL-Blocks — die lokale KI hat in dessen Dateien repariert, nicht
            // in denen des Prüfers. Geschützt bleiben damit die Prüfmappen aller
            // Prüfer, auch die des gerade urteilenden: Er hat in der Nachprüfung
            // frische Tests hineingeschrieben, und bis Bauschritt 45 löschte
            // dieser Rollback sie wortlos mit.
            await zurueckrollen(
              zielK ?? k,
              k.strang,
              texte.ticker.lokaleReparaturZurueckgerollt(k.lokaleVersuche, LOKALE_REPARATUR_VERSUCHE),
              // Hier ist ein Rückroll ausdrücklich versprochen — bleibt er ohne
              // Wirkung, muss Georg genau das lesen statt gar nichts. Welcher
              // der beiden Sätze passt, entscheidet die Naht an den Zahlen.
              { nichtsMelden: true }
            )
            metrikUrteil(k.lokaleReparaturBlock, 'reparatur', 'nicht-gehalten', k.lokaleReparaturSchritte)
            eskalationsKritik = k.lokaleKritik
          }
          // Die Kritik, die ans Ziel geht — nach einem Rollback die Original-
          // Kritik, sonst die des Prüfbelegs. Schon HIER (BAUPLAN 47), weil der
          // Bündel-Zweig unten sie braucht. Für den Budget-Zweig ändert sich
          // nichts: Scheitert die lokale Vorreparatur weiter unten, ist ihre
          // Original-Kritik genau dieser Prüfbeleg-Text.
          const kritik = eskalationsKritik ?? belegKritik.text
          // Zwei Schritte, die jede Rückführung tut — ob sie eine Runde nimmt
          // (Budget-Zweig) oder sich an eine laufende hängt (Bündel-Zweig):
          // Erneut laufen alle Blöcke auf den Wegen vom Ziel zum Prüfer —
          // parallele Zweige außerhalb behalten ihr Ergebnis. Ein Block im
          // Nachlauf (BAUPLAN 46) auf diesem Weg geht ebenfalls zurück auf
          // 'offen': Sein Rauchtest wäre auf einen Stand gemessen worden, den
          // die Reparatur-Runde gleich ersetzt.
          const korridorOeffnen = () => {
            for (const nochmalId of zwischenBloecke(workflow.bloecke, workflow.pfeile, zielId, id)) {
              const nk = knoten.get(nochmalId)
              if (nk.status === 'fertig' || nk.status === 'nachlauf') {
                nk.status = 'offen'
                nk.nachlaufErgebnis = null
              }
            }
          }
          // Für den Prüfer zählt ab jetzt „was sich seit meinem Urteil geändert
          // hat" — seine Nachprüfung bekommt denselben Dienst. Vom eigenen
          // Strang gelesen (BAUPLAN 45): Dort liegen seine Punkte; der
          // gemeinsame Stand kennt sie erst nach der Zusammenführung. Und er
          // prüft in der nächsten Runde nur seine Beanstandungen nach — keine
          // erneute Vollprüfung. Die Felder wandern mit (BAUPLAN 42): Der
          // Grün-Fall des Tors filtert daraus die grundsätzlichen heraus.
          const nachpruefungMerken = async () => {
            k.diffBasis = await letzterPunktId(projektPfad, k.strang ?? null)
            k.diffAnfordern = true
            k.nachpruefung = kritik
            k.nachpruefungBeanstandungen = beanstandungen
          }

          // Gebündelte Rückführung (BAUPLAN 47, 0 Tokens): Liegt am Ziel schon
          // eine Rückmeldung, die sein nächster Anlauf noch nicht gelesen hat —
          // ein anderer Prüfer hat es in dieser Runde zurückgeschickt, und es
          // ist noch nicht wieder gestartet —, dann nimmt dieser Prüfer KEINE
          // zweite Runde und startet KEINE lokale Vorreparatur (der erste hat
          // den Weg schon festgelegt): Seine Kritik wird an die des ersten
          // ANGEHÄNGT, jede unter ihrem Absender, und der Bauer behebt beide in
          // derselben Runde. Bis Bauschritt 47 fraßen zwei Prüfer hinter EINEM
          // Bauer zwei Runden, und die Kritik des ersten war überschrieben.
          // Keine Sperre nötig: Der Planer verarbeitet Ergebnisse nacheinander
          // (Promise.race + await verarbeite in der Planer-Schleife) — zwei
          // Urteile kommen nie gleichzeitig hier an.
          // Ehrliche Grenzen: (a) Geht der erste Prüfer den Weg der lokalen
          // Vorreparatur, liegt am Ziel keine Rückmeldung — der zweite geht
          // seinen eigenen Weg wie heute (er setzt das Ziel auf 'offen', das
          // Ziel repariert; scheitert die lokale Nachprüfung des ersten danach,
          // rollt deren Rollback auf „vor lokaler Reparatur" — hinter die
          // frische Runde des Ziels; die Notbremse standUeberholt fängt das).
          // (b) Ist das Budget schon leer, stellt jeder Prüfer seine eigene
          // Folgen-Frage wie heute. (c) In der gemeinsamen Reparatur-Runde
          // spielen beide Prüfer ihr Tor — derselbe Projektordner, wie bei
          // Prüfer neben Prüfer seit Bauschritt 46.
          if (
            zielK?.rueckmeldungOffen === true &&
            !lauf.sanft &&
            !lauf.hart &&
            !endZustand
          ) {
            korridorOeffnen()
            zielK.rueckmeldung +=
              '\n\n' + texte.agentenUebergabe.prueferRueckmeldungTeil(k.name, kritik)
            zielK.rueckmeldungOffen = true
            // Tor-Protokoll ANHÄNGEN statt überschreiben — das des ersten
            // Prüfers beschreibt einen anderen Prüfbefehl. NICHT nach einer
            // gescheiterten lokalen Nachprüfung: Dort wurde eben zurückgerollt,
            // das Protokoll beschriebe einen Stand, den es nicht mehr gibt.
            // vorFazit und diffAnfordern bleiben, wie der erste Prüfer sie
            // gesetzt hat — es ist dieselbe Runde.
            if (!warLokaleNachpruefung && k.letztesTorProtokoll)
              zielK.torProtokoll = [zielK.torProtokoll, k.letztesTorProtokoll]
                .filter(Boolean)
                .join('\n\n')
            k.letztesTorProtokoll = ''
            await nachpruefungMerken()
            tickern(texte.ticker.rueckfuehrungGebuendelt(k.name, zielK.name, belegKritik.anzahl))
            if (belegKritik.anzahl > 0)
              tickern(texte.ticker.beanstandungenUebergeben(belegKritik.anzahl, zielK.name))
            return
          }
          // Nur aktiv, wenn die lokale KI beim Laufstart bereitstand und das
          // Häkchen am Ziel-Block (dessen Reparatur-Runde ersetzt würde) an ist.
          const lokalErlaubt =
            Boolean(lokaleHelfer) &&
            zielK != null &&
            zielK.eintrag.lokaleKi !== false &&
            !lauf.sanft &&
            !lauf.hart &&
            !endZustand
          if (lokalErlaubt && !warLokaleNachpruefung) {
            // Frischer Fehlschlag: Opus sortiert vor — nur wenn ALLE
            // Beanstandungen mechanisch markiert sind, lohnt die lokale Wette.
            k.lokaleVersuche = 0
            k.lokaleKritik =
              beanstandungenEinstufen(beanstandungen) === 'mechanisch' ? belegKritik.text : null
            if (!k.lokaleKritik) tickern(texte.ticker.lokaleReparaturNichtMechanisch(zielK.name))
          }
          if (lokalErlaubt && k.lokaleKritik) {
            while (
              k.lokaleVersuche < LOKALE_REPARATUR_VERSUCHE &&
              !lauf.sanft &&
              !lauf.hart &&
              !endZustand
            ) {
              k.lokaleVersuche++
              // Sicherungspunkt vor jedem Versuch — ohne Rückroll-Punkt läuft
              // kein lokaler Versuch.
              // Auf den Strang des Prüfers (BAUPLAN 45) — dorthin greift der
              // Rollback oben zurück, wenn die Nachprüfung scheitert.
              // Ohne fremdes laufendes Revier (BAUPLAN 46, Vertrag F6): auch
              // dieser Punkt nimmt für die Wirkbereiche laufender Nachbarn den
              // Stand der Basis.
              const punkt = await sicherungspunktAnlegen(
                projektPfad,
                texte.sicherungen.beschriftungVorLokalerReparatur,
                { strang: k.strang ?? null, ausgenommen: geschuetzteBereicheFuer(k) }
              )
              if (!punkt.ok) break
              tickern(
                texte.ticker.lokaleReparaturStart(
                  k.lokaleVersuche,
                  LOKALE_REPARATUR_VERSUCHE,
                  lokaleHelfer.modell
                )
              )
              // Die Vorreparatur ist ein unsichtbarer Schreiber (BAUPLAN 46): Sie
              // schreibt in die Dateien des ZIEL-Blocks, ohne dass der auf
              // 'laeuft' steht. Solange sie läuft, zählt das Ziel für Welle,
              // Nachlauf und geschützte Bereiche wie ein laufender Schreiber —
              // und seine Dateiliste ist ihre Tabu-Liste (Vertrag F5/S7).
              zielK.dateiListeAktiv = dateiListeFuer(zielK)
              zielK.schreibtGerade = true
              let reparatur
              try {
                reparatur = await lokalReparieren({
                  projektPfad,
                  // Projektwissen (BAUPLAN 25) auch für die Vorreparatur — sie
                  // läuft an den Helfer-Werkzeugen vorbei direkt über lauf.js.
                  auftrag:
                    (lokaleHelfer.projektwissen?.(k.eintrag.instanzId) ?? '') +
                    texte.agentenLokaleHelfer.reparaturAuftrag(k.lokaleKritik),
                  modell: lokaleHelfer.modell,
                  adresse: lokaleHelfer.adresse,
                  dateiListe: zielK.dateiListeAktiv,
                  aufSchritt: (name, eingabe) =>
                    tickern(
                      name === 'ersetzen'
                        ? texte.ticker.lokaleReparaturSchritt(eingabe?.pfad)
                        : texte.ticker.lokaleHelferSchritt(name, eingabe)
                    ),
                  // Denk-Ansicht (BAUPLAN 24): nur live, nie im Laufbericht —
                  // deshalb senden() statt tickern().
                  aufDenken: (text) =>
                    senden({ art: 'denken', absender: texte.lauf.denkenLokaleKi, text })
                })
              } finally {
                zielK.schreibtGerade = false
              }
              const l = helferZaehler()
              l.reparaturen = (l.reparaturen ?? 0) + 1
              l.schritte += reparatur.schritte ?? 0
              if (reparatur.ok && reparatur.ersetzungen > 0) {
                // Die Nachprüfung des Prüfers ist der Schiedsrichter: nur die
                // Beanstandungen, als frischer Agent in der Lauf-Session.
                tickern(texte.ticker.lokaleReparaturFertig(reparatur.ersetzungen))
                k.nachpruefung = k.lokaleKritik
                k.lokaleNachpruefung = true
                // Metriken (BAUPLAN 31): Das Urteil fällt erst mit der
                // Nachprüfung — Aufwand und Ziel-Block bis dahin am Knoten merken.
                k.lokaleReparaturSchritte = reparatur.schritte ?? 0
                k.lokaleReparaturBlock = zielK.name
                k.status = 'offen'
                // Der EINZIGE Fall, in dem der Strang über das Blockende hinweg
                // offen bleibt: Der Ankerpunkt von eben ist das Ziel des
                // Rückrolls, den die gleich folgende Nachprüfung womöglich
                // auslöst. Eine Zusammenführung fröre stattdessen das Gebastel
                // der lokalen KI als neue gemeinsame Spitze ein.
                k.strangOffenHalten = true
                return
              }
              // Nichts ersetzt (oder Ollama gescheitert): nichts zurückzurollen
              // und keine Nachprüfung nötig — der Versuch ist trotzdem verbraucht.
              metrikUrteil(zielK.name, 'reparatur', 'gescheitert', reparatur.schritte)
              tickern(
                reparatur.ok
                  ? texte.ticker.lokaleReparaturNichtsErsetzt
                  : texte.ticker.lokaleReparaturGescheitert(reparatur.fehler)
              )
            }
            // Budget aufgebraucht: der Motor-Bauer übernimmt mit der
            // Original-Kritik. Der Zähler gilt je Rückführung — bei der
            // nächsten frischen Beanstandung darf die lokale KI wieder ran.
            tickern(texte.ticker.lokaleReparaturOpusUebernimmt(zielK.name))
            eskalationsKritik = eskalationsKritik ?? k.lokaleKritik
            k.lokaleVersuche = 0
            k.lokaleKritik = null
          }

          // Reparatur-Runden je Rückführungs-Ziel (BAUPLAN 41): Der Zähler
          // hängt am Ziel, nicht am Lauf — zwei Zweige essen sich die Runden
          // nicht mehr gegenseitig weg. Genommen wird erst, wenn der Lauf
          // wirklich zurückführt.
          const budget =
            !lauf.sanft && !lauf.hart && !endZustand
              ? budgetNehmen(rundenUebrig, zielId, rundenStandard)
              : { erlaubt: false, genutzt: rundenStandard }
          if (budget.erlaubt) {
            const genutzt = budget.genutzt
            korridorOeffnen()
            const ziel = knoten.get(zielId)
            // Immer mit Absender (BAUPLAN 47): Hängt gleich ein zweiter Prüfer
            // seine Kritik an, tragen BEIDE Teile ihren Namen — der Bauer
            // sieht, wessen Beanstandung er behebt. Der Einleitungssatz steht
            // einmal vorn, an der Auftragsstelle. Und solange das Ziel diese
            // Rückmeldung nicht gelesen hat, darf angehängt werden.
            ziel.rueckmeldung = texte.agentenUebergabe.prueferRueckmeldungTeil(k.name, kritik)
            ziel.rueckmeldungOffen = true
            // Diff + Vor-Fazit (BAUPLAN 34): Der frische Bauer bekommt neben
            // der Kritik den exakten Unterschied „das hast du in diesem Lauf
            // bisher geändert" und sein eigenes Fazit der letzten Runde als
            // das „warum" — er erkundet nicht neu und entscheidet nicht anders.
            ziel.diffAnfordern = true
            ziel.vorFazit = ziel.lieferung ?? ''
            // Tor ohne KI (BAUPLAN 35): Kam das Urteil vom abgespielten
            // Prüfbefehl, bekommt das Ziel das volle Fehlerprotokoll dazu —
            // die Beanstandungs-Zeilen allein sagen nicht, wo es klemmt.
            // NICHT nach einer gescheiterten lokalen Nachprüfung: Dort wurde
            // eben zurückgerollt, das Protokoll beschriebe einen Stand, den es
            // nicht mehr gibt.
            ziel.torProtokoll = warLokaleNachpruefung ? '' : k.letztesTorProtokoll
            k.letztesTorProtokoll = ''
            await nachpruefungMerken()
            tickern(texte.ticker.rueckfuehrung(ziel.name, genutzt, rundenStandard))
            if (belegKritik.anzahl > 0)
              tickern(texte.ticker.beanstandungenUebergeben(belegKritik.anzahl, ziel.name))
            return
          }
          // Folgen-Frage je Zweig (BAUPLAN 46, Vertrag F8): Sie hält den
          // Planer nicht mehr an. Der Prüfer wartet auf 'wartet-entscheidung'
          // (seine Nachfolger starten nicht, andere Zweige laufen weiter), die
          // Frage hängt als eigener Teilnehmer im Race der Planer-Schleife, und
          // entscheidungVerarbeiten setzt die Wahl um. Der Dialog sagt vorher,
          // was „Stand wiederherstellen" treffen würde.
          k.status = 'wartet-entscheidung'
          // Solange die Frage offen ist, gilt der Zweig als belegt
          // (offeneFragenZweige) — dafür bleibt das Ziel am Knoten.
          k.entscheidungZielId = zielId ?? null
          const zweig = zweigWirkbereiche(zielId, id)
          laufende.set(
            'entscheidung:' + id,
            entscheidungEinreihen({
              instanzId: id,
              blockName: k.name,
              zielId,
              runden: rundenStandard,
              trifft: zweig.ohne.length
                ? texte.entscheidung.trifftGanzerOrdner(zweig.ohne[0])
                : texte.entscheidung.trifftBereiche(zweig.teile)
            }).then((ergebnis) => ({ id: 'entscheidung:' + id, ergebnis }))
          )
          return
        }
      }

      await blockendePunktFuer(k)
    }

    // Sicherungspunkt nach jedem gelungenen schreibenden Block (SPEC §3.3).
    // Nur-lesende Blöcke ändern nichts — und ein Punkt, während parallel ein
    // Schreiber arbeitet, würde dessen halbfertige Änderungen einfrieren; seit
    // der Welle (BAUPLAN 46) nimmt der Punkt für deren Wirkbereiche darum den
    // Stand der Basis (`ausgenommen`, Vertrag F6).
    //
    // Hat der Block einen eigenen Strang (BAUPLAN 45), legt hier NICHTS an:
    // Die Zusammenführung gleich danach hält denselben Ordnerstand fest und
    // trägt dieselbe Beschriftung. Zwei Punkte wären zwei Einträge in Georgs
    // Wiederherstellen-Liste, zwischen denen es sachlich nichts zu wählen
    // gibt. Es bleibt bei genau einem Punkt je schreibendem Block.
    async function blockendePunktFuer(k) {
      if (!k.def.nurLesen && !k.strang) {
        const punkt = await sicherungspunktAnlegen(
          projektPfad,
          texte.sicherungen.beschriftungNachBlock(k.name),
          { ausgenommen: geschuetzteBereicheFuer(k) }
        )
        if (punkt.ok && punkt.neu) tickern(texte.ticker.sicherungspunktAngelegt)
      }
    }

    // Was „Stand wiederherstellen" für den Zweig eines Prüfers träfe
    // (BAUPLAN 46, Vertrag F8): die Wirkbereiche aller Blöcke auf den Wegen vom
    // Rückführungs-Ziel zum Prüfer — Umsetzer ihre Dateiliste, Prüfer ihren
    // Prüfordner; nur-lesende Blöcke schreiben nichts und zählen nicht. Fehlt
    // einem Schreiber der Wirkbereich (kein Datenvertrag), geht es nicht
    // zweigbezogen: `ohne` nennt ihn, und der Dialog sagt es vorher.
    function zweigWirkbereiche(zielId, prueferId) {
      // In Kettenreihenfolge, damit der Text so liest, wie der Zweig läuft:
      // erst der Bauer, dann sein Prüfer.
      const menge = zielId
        ? zwischenBloecke(workflow.bloecke, workflow.pfeile, zielId, prueferId)
        : new Set([prueferId])
      const ids = kettenIds.filter((kid) => menge.has(kid))
      const pfade = []
      const teile = []
      const ohne = []
      for (const bid of ids) {
        const nk = knoten.get(bid)
        if (!nk || nk.def.nurLesen) continue
        const bereich = nk.def.prueft
          ? wirkbereichVon(nk.def, nk.pruefOrdner, null)
          : wirkbereichVon(nk.def, '', nk.dateiListeAktiv ?? dateiListeFuer(nk))
        if (!bereich) {
          ohne.push(nk.name)
          continue
        }
        pfade.push(...bereich)
        teile.push(
          nk.def.prueft
            ? texte.entscheidung.trifftPruefordner(bereich[0])
            : texte.entscheidung.trifftDateien(nk.name, bereich.length)
        )
      }
      return { pfade: [...new Set(pfade)], teile, ohne }
    }

    // Die Wahl aus der Folgen-Frage umsetzen (BAUPLAN 46, Vertrag F8) — je
    // Zweig, während andere Zweige weiterlaufen:
    //   weitermachen     → der Prüfer gilt als erledigt (wie bisher: 'fertig',
    //                      Punkt, Zusammenführung); seine Nachfolger starten.
    //   zurueckstellen   → nur dieser Zweig endet ('zurueckgestellt'), der Lauf
    //                      läuft weiter; am Ende heißt der Ausgang zurückgestellt,
    //                      wenn nichts Schlimmeres vorliegt.
    //   wiederherstellen → sind die Wirkbereiche ALLER Zweig-Blöcke bekannt,
    //                      werden genau sie sofort auf den Punkt „vor Lauf"
    //                      zurückgesetzt (wiederherstellenBereich) und der Zweig
    //                      endet ('wiederhergestellt'). Fehlt einer, trifft es
    //                      wie bisher den ganzen Ordner am Laufende — dann
    //                      startet nichts Neues mehr.
    async function entscheidungVerarbeiten({ instanzId, zielId, wahl }) {
      const k = knoten.get(instanzId)
      if (!k) return
      // Ab hier ist der Zweig nicht mehr „offen" — der Status wechselt unten,
      // und damit gibt offeneFragenZweige sein Revier frei.
      k.entscheidungZielId = null
      if (wahl === 'weitermachen') {
        tickern(texte.ticker.entscheidungWeitermachen(k.name))
        k.status = 'fertig'
        await blockendePunktFuer(k)
      } else if (wahl === 'zurueckstellen') {
        tickern(texte.ticker.entscheidungZurueckgestellt(k.name))
        k.status = 'zurueckgestellt'
      } else {
        const zweig = zweigWirkbereiche(zielId, instanzId)
        if (zweig.ohne.length === 0) {
          tickern(texte.ticker.entscheidungWiederhergestellt(k.name))
          const zurueck = await wiederherstellenBereich(projektPfad, punktVorLauf, {
            nurPfade: zweig.pfade,
            // Das Sicherheitsnetz vor dem Rückroll ist ein Punkt in der Welle
            // wie jeder andere: fremdes laufendes Revier auf dem Basis-Stand.
            ausgenommen: geschuetzteBereicheFuer(k)
          })
          tickern(
            zurueck.ok
              ? texte.ticker.zweigWiederhergestellt(k.name, zurueck.dateien ?? 0)
              : texte.ticker.zweigWiederherstellenGescheitert(k.name)
          )
        } else {
          tickern(texte.ticker.entscheidungWiederhergestelltGanz(k.name))
          wiederherstellenNachLauf = true
          if (!endZustand) endZustand = 'wiederhergestellt'
        }
        k.status = 'wiederhergestellt'
      }
      // Der Strang des Prüfers blieb offen, solange die Frage offen war — jetzt
      // ist der Anlauf zu Ende (beim harten Stopp räumt das Laufende auf).
      if (!lauf.hart) await strangSchliessenFuer(k)
    }

    standSpeichern()
    // Lokaler Block-Agent (BAUPLAN 49): Konnte das abgeleitete Ollama-Modell
    // nicht bereitgestellt werden, startet kein einziger Block — der Lauf
    // endet als Fehlschlag mit dem Klartext aus dem Ticker. Kein stiller
    // Rückfall auf Claude.
    if (lokalFehler) {
      endZustand = 'fehlgeschlagen'
      fehlertext = lokalFehler
    }
    // Die Planer-Schleife: Bereites starten, auf den nächsten fertigen Block
    // (oder die nächste beantwortete Folgen-Frage) warten, Ergebnis
    // verarbeiten, ausstehende Nachläufe abarbeiten — bis nichts mehr läuft.
    while (true) {
      bereiteStarten()
      if (laufende.size === 0) break
      const { id, ergebnis } = await Promise.race(laufende.values())
      laufende.delete(id)
      if (ergebnis?.zustand === 'entscheidung') {
        // Eine beantwortete Folgen-Frage (BAUPLAN 46) — kein Block-Ergebnis.
        await entscheidungVerarbeiten(ergebnis)
      } else {
        lauf.aktiveInstanzen.delete(id)
        senden({ art: 'block-fertig', instanzId: id })
        await verarbeite(id, ergebnis)
        // Zusammenführung am Blockende (BAUPLAN 45): Der Strang lebt nur
        // innerhalb EINES Block-Anlaufs — hier wird er auf den gemeinsamen Stand
        // geholt, bevor der nächste Block startet. Beim harten Stopp NICHT: Dort
        // setzt der zentrale Rollback unten erst zurück; erst danach ist der
        // Arbeitsordner die Wahrheit, die zusammengehört. Steht der Block im
        // Nachlauf oder wartet er auf seine Folgen-Frage (BAUPLAN 46), ist sein
        // Anlauf nicht zu Ende, und strangSchliessenAn lässt den Strang stehen.
        if (!lauf.hart) await strangSchliessenFuer(knoten.get(id))
      }
      // Nachlauf-Phase (BAUPLAN 46): Steht die Welle, kommt der EINE Rauchtest
      // für alle wartenden Blöcke dran (0.46.2) — VOR dem nächsten Start.
      await nachlaeufeAbarbeiten()
      standSpeichern()
    }

    // Die Lauf-Session geordnet schließen — der Lauf ist zu Ende (BAUPLAN 19).
    lauf.laufMotor?.beenden()

    // Harter Stopp: alle Motoren sind tot — der Projektordner springt einmal
    // zentral auf den letzten Sicherungspunkt zurück (SPEC §6).
    if (lauf.hart && !wiederherstellenNachLauf) {
      // Maßgeblich ist der Strang des ABGEBROCHENEN Blocks — und nur, solange er
      // noch taugt. Beide Regeln stehen oben im Modul als ausführbare Stellen;
      // hier hängen nur die Daten dieses Laufs dran. Sein Rückroll lässt die
      // Wirkbereiche der anderen Instanzen stehen (BAUPLAN 45); erst danach macht
      // die Zusammenführung den wiederhergestellten Stand zum gemeinsamen.
      await hartZurueckrollenAn(projektPfad, {
        knotenListe: kettenIds.map((kid) => knoten.get(kid)),
        geschuetztFuer: geschuetzteBereicheFuer,
        tickern
      })
      endZustand = 'hart-abgebrochen'
    }
    // Sicherheitsnetz: Kein Strang dieses Laufs bleibt offen — ein
    // liegengebliebener wäre beim nächsten Laufstart nur noch Aufräum-Arbeit,
    // und sein Punkt fehlte in Georgs Sicherungspunkt-Liste. Hier ZÄHLT der
    // Status nicht mehr: Auch ein Block, der noch auf 'offen' steht, bekommt
    // seinen Strang geschlossen — nach dem Laufende läuft nichts mehr nach.
    for (const kid of kettenIds) await strangEndgueltigSchliessenFuer(knoten.get(kid))
    // Der Ausgang (seit BAUPLAN 46 mit den zweigbezogenen Wahlen der
    // Folgen-Frage) — die Rangfolge steht oben im Modul als eigene Rechnung.
    if (!endZustand)
      endZustand = endzustandAus(
        kettenIds.map((id) => knoten.get(id)),
        { sanft: lauf.sanft }
      )
    // „Stand wiederherstellen" aus der Folgen-Frage — jetzt schreibt keiner mehr.
    if (wiederherstellenNachLauf) {
      const zurueck = await wiederherstellen(projektPfad, punktVorLauf)
      if (zurueck.ok) tickern(texte.ticker.zurueckgesetzt)
    }

    // Offene Fragen auflösen, damit nichts ewig hängt.
    for (const antworten of [...lauf.fragen.values()]) antworten(false)
    for (const aufloesen of [...lauf.entscheidungen.values()]) aufloesen('zurueckstellen')
    for (const antworten of [...lauf.menschFragen.values()]) antworten(null)
    for (const antworten of [...lauf.vorschlaege.values()]) antworten(null)

    // Prozess-Hygiene (BAUPLAN 32): Alles, was aus dem Lauf heraus gestartet
    // wurde und noch lebt (Server des Prüfers, vergessene Shells), wird jetzt
    // beendet — erfolgreich, sanft gestoppt oder hart abgebrochen, egal. Die
    // Motor-Prozesse selbst bekommen anderthalb Sekunden, um geordnet zu
    // enden; danach fallen auch sie. Ehrlich im Ticker vermerkt.
    try {
      await new Promise((r) => setTimeout(r, 1500))
      const { beendet, uebrig } = await prozessgruppeAbraeumen('lauf:' + projektPfad)
      const fremde = beendet.filter((e) => !e.wurzel)
      if (fremde.length) tickern(texte.ticker.verwaisteBeendet(fremde.length, fremde.map((e) => e.name)))
      if (uebrig.length) tickern(texte.ticker.verwaisteUebrig(uebrig.length))
    } catch {
      // Ein klemmender Späher darf das Laufende nicht stören.
    }

    // Arbeitsablage leeren (Entscheidung Georg, 12.08.2026): Der Ordner
    // arbeitsablage/ ist die Wegwerf-Fläche der Agenten für Hilfsskripte und
    // Probeläufe — FlowForge räumt ihn zuverlässig am Lauf-Ende, statt das dem
    // Agenten (und dessen Tokens) zu überlassen.
    try {
      const ablage = path.join(projektPfad, 'arbeitsablage')
      if (fs.existsSync(ablage)) {
        fs.rmSync(ablage, { recursive: true, force: true })
        tickern(texte.ticker.arbeitsablageGeleert)
      }
    } catch {
      // Eine klemmende Datei (z.B. noch geöffnet) darf das Laufende nicht stören.
    }

    bericht.beendetAm = jetztIso()
    bericht.zustand = endZustand
    bericht.fehlertext = fehlertext
    bericht.verbrauch = { ...gesamtVerbrauch }
    // Nachlauf-Chat (BAUPLAN 27): Kennung und Füllstand der Lauf-Session
    // wandern in den Laufbericht — der Chat setzt sie später fort. Nach hartem
    // Abbruch oder Wiederherstellung nicht: Der Projektordner wurde
    // zurückgesetzt, die Session „erinnert" sich an Änderungen, die es nicht
    // mehr gibt — der Chat startet dann ehrlich frisch mit dem Laufbericht.
    const sitzungsKennung = lauf.laufMotor?.sessionKennung ?? laufSessionKennung
    bericht.laufSitzung =
      sitzungsKennung && endZustand !== 'hart-abgebrochen' && endZustand !== 'wiederhergestellt'
        ? {
            kennung: sitzungsKennung,
            tokens: lauf.laufMotor?.tokens ?? laufSessionTokens,
            kontextFenster: bekanntesKontextFenster > 0 ? bekanntesKontextFenster : null
          }
        : null
    try {
      berichtSpeichern(projektPfad, bericht)
    } catch {
      // Ein nicht speicherbarer Bericht darf das Laufende nicht verschlucken.
    }
    // Der Lauf ist geordnet zu Ende — es gibt nichts mehr wiederaufzunehmen.
    laufstandLoeschen(projektPfad)
    aktiveLaeufe.delete(projektPfad)
    laeufeMelden()
    // Lauf-Ende melden, wenn Georg gerade woanders ist (SPEC §5).
    benachrichtigen(
      texte.benachrichtigung.fertigTitel,
      texte.lauf.zustandLabels[endZustand] ?? endZustand
    )
    senden({
      art: 'fertig',
      zustand: bericht.zustand,
      fehlertext: bericht.fehlertext,
      bericht
    })
    // Der Platz ist frei — der nächste wartende Lauf startet von allein.
    warteschlangeAnstossen()
  })()

  return { ok: true }
}

export function laufSanftStoppen(projektPfad) {
  const lauf = aktiveLaeufe.get(projektPfad)
  if (!lauf) return { ok: false, fehler: texte.fehler.unbekannt }
  if (!lauf.sanft && !lauf.hart) {
    lauf.sanft = true
    lauf.tickern?.(texte.ticker.sanftAngefordert)
  }
  return { ok: true }
}

export function laufHartStoppen(projektPfad) {
  const lauf = aktiveLaeufe.get(projektPfad)
  if (!lauf) return { ok: false, fehler: texte.fehler.unbekannt }
  lauf.hart = true
  // Eine offene Mensch-Frage oder ein offener Karten-Vorschlag würde den
  // Werkzeug-Aufruf im FlowForge-Prozess ewig hängen lassen — sofort auflösen.
  for (const antworten of [...lauf.menschFragen.values()]) antworten(null)
  for (const antworten of [...lauf.vorschlaege.values()]) antworten(null)
  // Ebenso eine offene Folgen-Frage (BAUPLAN 46): Sie hängt im Race der
  // Planer-Schleife — unbeantwortet käme der Lauf nie zum Rückroll des harten
  // Stopps. „Zurückstellen" ist die Wahl ohne eigene Wirkung; zurückgesetzt
  // wird ohnehin gleich zentral.
  for (const aufloesen of [...lauf.entscheidungen.values()]) aufloesen('zurueckstellen')
  // Bei parallelen Zweigen laufen mehrere Motoren — alle sofort töten. Auch
  // eine gerade unbeschäftigte Lauf-Session stirbt mit (BAUPLAN 19); doppelte
  // Aufrufe auf denselben Motor sind unschädlich.
  if (lauf.motoren.size === 0 && !lauf.laufMotor) lauf.tickern?.(texte.ticker.hartAbgebrochen)
  for (const motor of [...lauf.motoren.values()]) motor.hartStoppen()
  lauf.laufMotor?.hartStoppen()
  return { ok: true }
}

// Frage-IDs sind UUIDs — bei mehreren gleichzeitigen Läufen wird die passende
// Antwort-Funktion über alle Läufe hinweg gesucht.
function antwortSuchen(sammlung, frageId) {
  for (const lauf of aktiveLaeufe.values()) {
    const eintrag = lauf[sammlung].get(frageId)
    if (eintrag) return eintrag
  }
  return null
}

export function laufFrageAntworten(frageId, erlaubt) {
  const antworten = antwortSuchen('fragen', frageId)
  if (!antworten) return { ok: false, fehler: texte.fehler.unbekannt }
  antworten(Boolean(erlaubt))
  return { ok: true }
}

// Karten-Vorschläge (BAUPLAN 26): Georgs Entscheidung aus dem Abnahme-Dialog.
// wahl 'uebernehmen' (felder = bearbeitete Fassung oder null für „laut KI")
// oder 'ablehnen'. Scheitert das Anwenden (z.B. Längengrenze), bleibt der
// Vorschlag offen und der Fehler geht an die Ansicht zurück.
export function laufVorschlagAntworten(frageId, wahl, felder) {
  const antworten = antwortSuchen('vorschlaege', frageId)
  if (!antworten) return { ok: false, fehler: texte.fehler.unbekannt }
  if (!['uebernehmen', 'ablehnen'].includes(wahl))
    return { ok: false, fehler: texte.fehler.unbekannt }
  return antworten(wahl, felder && typeof felder === 'object' ? felder : null)
}

export function laufMenschAntworten(frageId, antwortText) {
  const antworten = antwortSuchen('menschFragen', frageId)
  if (!antworten) return { ok: false, fehler: texte.fehler.unbekannt }
  const text = String(antwortText ?? '').trim()
  if (!text) return { ok: false, fehler: texte.fehler.unbekannt }
  antworten(text)
  return { ok: true }
}

export function laufEntscheidungAntworten(frageId, wahl) {
  const aufloesen = antwortSuchen('entscheidungen', frageId)
  if (!aufloesen) return { ok: false, fehler: texte.fehler.unbekannt }
  if (!['weitermachen', 'zurueckstellen', 'wiederherstellen'].includes(wahl))
    return { ok: false, fehler: texte.fehler.unbekannt }
  aufloesen(wahl)
  return { ok: true }
}

// Warteschlange verlassen (BAUPLAN 12): Georg nimmt einen vorgemerkten Start
// wieder heraus, bevor er anläuft.
export function laufWarteschlangeVerlassen(projektPfad) {
  const idx = warteschlange.findIndex((eintrag) => eintrag.projektPfad === projektPfad)
  if (idx >= 0) {
    warteschlange.splice(idx, 1)
    laeufeMelden()
  }
  return { ok: true }
}

// Wiederaufnahme nach App-/Rechner-Neustart (SPEC §3.3, BAUPLAN 11): Liegt in
// diesem Projekt ein unterbrochener Lauf, den die App fortsetzen kann?
export function laufstandInfo(projektPfad) {
  // Läuft oder wartet das Projekt schon, gibt es nichts anzubieten.
  if (
    aktiveLaeufe.has(projektPfad) ||
    warteschlange.some((eintrag) => eintrag.projektPfad === projektPfad)
  )
    return { ok: true, vorhanden: false }
  const stand = laufstandLaden(projektPfad)
  if (!stand) return { ok: true, vorhanden: false }
  // Der nächste offene Block — beim alten Positions-Format die notierte Position.
  const naechsteId = Array.isArray(stand.fertigIds)
    ? stand.kettenIds.find((id) => !stand.fertigIds.includes(id))
    : stand.kettenIds[stand.index]
  let blockName = ''
  // Sonderlauf (BAUPLAN 30): Der Block stand nie auf der Leinwand — sein Name
  // kommt aus der Sonderlauf-Definition.
  if (stand.sonderlauf?.art) blockName = sonderlaufDefinition(stand.sonderlauf)?.name ?? ''
  else {
    const geladen = workflowLaden(projektPfad)
    if (geladen.ok) {
      const eintrag = geladen.workflow.bloecke.find((block) => block.instanzId === naechsteId)
      // Mit Zusatzname (BAUPLAN 41) — sonst hieße das Angebot bei zwei Prüfern
      // beide Male gleich.
      if (eintrag) blockName = blockAnzeigeName(blockDefinition(eintrag.blockId), eintrag)
    }
  }
  return { ok: true, vorhanden: true, gestartetAm: stand.gestartetAm, blockName }
}

// Geschützte Bereiche bei der Wiederaufnahme (BAUPLAN 45): die Prüfordner aller
// Instanzen des Schaubilds außer dem abgebrochenen Block. Sie sind der
// Wirkbereich fremder Prüfer — dort liegt aufbewahrte Arbeit, die der
// abgebrochene Block nicht mitreißen darf. Die Dateilisten der Umsetzer stehen
// hier nicht zur Verfügung (sie entstehen erst im Lauf aus den Lieferungen) —
// und sie gehören auch nicht dazu: Ein Umsetzer, dessen Arbeit fällt,
// hinterlässt kein zu schützendes Revier.
function fremdePruefbereiche(projektPfad, abgebrochenId) {
  const geladen = workflowLaden(projektPfad)
  if (!geladen.ok) return []
  const bereiche = []
  for (const eintrag of geladen.workflow.bloecke) {
    if (eintrag.instanzId === abgebrochenId) continue
    const ordner = pruefOrdnerFuer(blockDefinition(eintrag.blockId), eintrag)
    if (ordner) bereiche.push(PRUEFMAPPE + '/' + ordner + '/')
  }
  return [...new Set(bereiche)]
}

export function laufstandVerwerfen(projektPfad) {
  laufstandLoeschen(projektPfad)
  return { ok: true }
}

// Setzt einen unterbrochenen Lauf fort: Projektordner zurück auf den letzten
// Sicherungspunkt (halbfertige Änderungen der abgebrochenen Blöcke
// verschwinden), dann laufen alle noch offenen Blöcke erneut. Sind alle Plätze
// belegt, wartet auch die Wiederaufnahme in der Warteschlange — zurückgesetzt
// wird erst unmittelbar vor dem echten Start.
export async function laufFortsetzen(fenster, projektPfad, ausWarteschlange = false) {
  if (aktiveLaeufe.has(projektPfad)) return { ok: false, fehler: texte.lauf.schonAktiv }
  const stand = laufstandLaden(projektPfad)
  if (!stand) return { ok: false, fehler: texte.wiederaufnahme.fehlerKeinStand }
  // Ein Start aus der Warteschlange zählt in plaetzeBelegt() schon selbst mit
  // — seine Platz-Prüfung hat der Anstoßer vor dem Herausnehmen gemacht.
  if (!ausWarteschlange && plaetzeBelegt() >= MAX_PARALLEL_LAEUFE)
    return inWarteschlangeStellen(fenster, projektPfad, null, true)
  // Der nächste offene Block ist der abgebrochene — seine Arbeit fällt, die
  // Prüfmappen der anderen Instanzen nicht (BAUPLAN 45). Ein Strang aus dem
  // Absturz wird bewusst NICHT benutzt: Er hielte genau die Arbeit fest, die
  // hier fallen soll; der Laufstart räumt ihn gleich weg.
  // Seit der Welle (BAUPLAN 46) können MEHRERE Blöcke nicht fertig sein — der
  // Rückroll auf den gemeinsamen Stand genügt für alle: In fertigIds steht nur,
  // wessen Arbeit schon zusammengeführt war (Vertrag F6; Nachlauf und offene
  // Folgen-Frage zählen nicht als fertig), und alles andere startet wieder auf
  // 'offen'. Ehrliche Grenze: Die Prüfmappe eines zweiten abgebrochenen Prüfers
  // bleibt stehen wie ein fremdes Revier — sein neuer Anlauf schreibt sie neu.
  const abgebrochenId = Array.isArray(stand.fertigIds)
    ? stand.kettenIds.find((id) => !stand.fertigIds.includes(id))
    : stand.kettenIds[stand.index]
  const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad, {
    geschuetzt: fremdePruefbereiche(projektPfad, abgebrochenId)
  })
  if (!zurueck.ok) return zurueck
  // Sonderlauf (BAUPLAN 30): derselbe Ein-Block-Workflow wie beim Start.
  const sonderlauf =
    stand.sonderlauf && SONDERLAEUFE[stand.sonderlauf.art] && typeof stand.sonderlauf.instanzId === 'string'
      ? { art: stand.sonderlauf.art, instanzId: stand.sonderlauf.instanzId }
      : null
  return laufStarten(
    fenster,
    projektPfad,
    stand.kartenIds,
    // Was der Rückroll stehengelassen hat, gehört in den Ticker (SPEC §3.3) —
    // den gibt es hier noch nicht, laufFortsetzen läuft vor dem Laufstart. Die
    // Zahl reist deshalb im Laufstand mit und wird drüben einmal getickert;
    // ohne sie verschwiege ausgerechnet die Wiederaufnahme, dass fremde
    // Prüfmappen bewusst stehengeblieben sind.
    { ...stand, rollbackGeschuetzt: zurueck.geschuetztUebersprungen ?? 0 },
    ausWarteschlange,
    sonderlauf
  )
}

// Sonderlauf starten (BAUPLAN 30): Aufräum-Knöpfe der Karten-Seitenleiste.
// Kartenauswahl = Standard-Vorauswahl (kartenIds null); die Leinwand bleibt
// unangetastet. Läuft oder wartet das Projekt, wird ehrlich abgelehnt statt
// eingereiht — Aufräumen ist kein Lauf, der „gleich drankommen" soll.
export function sonderlaufStarten(fenster, projektPfad, art) {
  if (!SONDERLAEUFE[art]) return { ok: false, fehler: texte.fehler.unbekannt }
  const zustand = laufZustand(projektPfad)
  if (zustand.aktiv || zustand.wartet)
    return { ok: false, fehler: texte.karten.sonderlaufGesperrt }
  return laufStarten(fenster, projektPfad, null, null, false, {
    art,
    instanzId: 'sonderlauf-' + crypto.randomUUID()
  })
}

// Für die Oberfläche: Läuft in diesem Projekt gerade etwas — und wo steht es?
// Offene Fragen kommen mit, damit die Ansicht sie nach einem Wechsel zur
// Projektübersicht und zurück wieder anzeigen kann. Dazu (BAUPLAN 12): wie
// viele Läufe insgesamt aktiv sind und ob dieses Projekt in der Schlange wartet.
export function laufZustand(projektPfad) {
  const lauf = aktiveLaeufe.get(projektPfad)
  const wartePosition =
    warteschlange.findIndex((eintrag) => eintrag.projektPfad === projektPfad) + 1
  const rahmen = {
    laufAnzahl: aktiveLaeufe.size,
    wartet: wartePosition > 0,
    wartePosition
  }
  if (!lauf) return { ok: true, aktiv: false, ...rahmen }
  return {
    ok: true,
    aktiv: true,
    ...rahmen,
    // Bei parallelen Zweigen laufen mehrere Karten gleichzeitig (BAUPLAN 13).
    blockInstanzIds: [...lauf.aktiveInstanzen],
    frage: lauf.offeneFragen[0] ?? null,
    // Die erste offene Folgen-Frage (BAUPLAN 46: mehrere können warten).
    entscheidung: lauf.offeneEntscheidungen?.[0] ?? lauf.offeneEntscheidung ?? null,
    menschFrage: lauf.offeneMenschFragen[0] ?? null,
    vorschlag: lauf.offeneVorschlaege[0] ?? null,
    gespraech: lauf.gespraech,
    // Sonderlauf (BAUPLAN 30): die Ansicht weiß, dass die Leinwand nicht beteiligt ist.
    sonderlauf: lauf.sonderlauf ?? null
  }
}

// Co-Pilot (BAUPLAN 33): Der Chat fragt je Werkzeugaufruf, ob im Projekt ein
// Lauf läuft oder wartet (dann nur lesend) — eingehängt statt importiert,
// weil chat.js sonst lauf.js und lauf.js chat.js importieren würde.
laufZustandQuelleSetzen((projektPfad) => {
  const z = laufZustand(projektPfad)
  return { aktiv: z.aktiv, wartet: z.wartet }
})
