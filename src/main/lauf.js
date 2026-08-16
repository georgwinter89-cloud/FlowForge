// Lauf-Verwaltung: führt das Workflow-Schaubild eines Projekts über die
// Motor-Schnittstelle aus, reicht Ereignisse an die Oberfläche weiter und
// legt Laufberichte ab (SPEC §3.2, §4, §6).
//
// Parallele Zweige (SPEC §4.1, BAUPLAN 13): Ein Block startet, sobald alle
// seine Vorgänger fertig sind. Mehrere nur-lesende Blöcke dürfen gleichzeitig
// laufen, aber höchstens ein schreibender (SPEC §5) — ein Block mit mehreren
// Vorgängern führt die Zweige zusammen, weil er auf alle wartet.
//
// Fehlschlag-Rückführung (SPEC §4.1): Meldet ein Prüfer-Block „nicht bestanden",
// laufen die Blöcke zwischen Ziel und Prüfer erneut — so oft, wie Reparatur-
// Runden eingestellt sind. Danach hält der Lauf an und stellt die Folgen-Frage:
// weitermachen, zurückstellen oder Stand wiederherstellen.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { BrowserWindow, Notification } from 'electron'
import { texte } from '../shared/texte.js'
import {
  blockDefinition,
  blockModellKlasse,
  blockAnzeigeName,
  pruefOrdnerFuer,
  zusatznameBereinigen,
  sdkModell,
  unterModellFuer,
  UEBERTRAG_GRENZE_STANDARD
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
  rueckfuehrungsZiel,
  zwischenBloecke,
  budgetNehmen,
  laufstandPasst
} from '../shared/kettenRegeln.js'
import { prueferKritik, mitteGekuerzt } from '../shared/kantenRegeln.js'
import { fehlerZeilen, neueFehler, grundsaetzlicheKritik } from '../shared/torRegeln.js'
import { diffTextBauen, diffBilanz } from '../shared/laufDiff.js'
import { einstellungenLaden, ABO_MODUS_ERLAUBT } from './einstellungen.js'
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
  pruefungenArchivieren,
  pruefkarteAusErgebnis
} from './pruefkarten.js'
import { starteLaufMotor } from './motor/claudeCodeMotor.js'
import {
  lokaleHelferPruefen,
  lokalReparieren,
  beanstandungenEinstufen,
  LOKALE_REPARATUR_VERSUCHE
} from './motor/lokaleHelfer.js'
import {
  KONTEXT_FENSTER_STANDARD,
  FORTSETZUNG_WAECHTER_PROZENT
} from './motor/schnittstelle.js'
import { startanleitungVorhanden } from './startanleitung.js'
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
  letzterPunktId,
  standWeichtAb,
  punkteVergleichen
} from './sicherungspunkte.js'
import { workflowLaden } from './workflow.js'
import { laufstandSpeichern, laufstandLaden, laufstandLoeschen } from './laufstand.js'
import { laufVorschlagSpeichern, laufVorschlagLoeschen } from './naechsterLauf.js'
import { kartenZuteilungPruefen, paketMeldungPruefen } from './motor/kartenZuteilungWerkzeuge.js'
import { chatBeschaeftigt, chatLaufBeginnt, laufZustandQuelleSetzen } from './chat.js'
import { metrikUrteilSchreiben } from './metriken.js'
import { prozessgruppeAnlegen, prozessgruppeAbraeumen } from './prozesse.js'

const BERICHTE_ORDNER = 'laufberichte'

// Kontingent-Pause (SPEC §5): so lange wartet FlowForge zwischen zwei
// Versuchen, wenn das Abo-Kontingent erschöpft ist.
const KONTINGENT_PAUSE_MS = 10 * 60 * 1000

// Parallelität (SPEC §5, BAUPLAN 12): bis zu 3 Läufe gleichzeitig, aber nur in
// verschiedenen Projekten — pro Projekt schreibt immer nur ein Agent. Weitere
// Starts landen in der Warteschlange und laufen automatisch an.
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

// Prüfer-Urteil aus dem Abschlusstext lesen: die letzte Marke zählt.
// true = bestanden, false = nicht bestanden, null = keine eindeutige Marke.
function pruefUrteil(ergebnisText) {
  const treffer = [...String(ergebnisText).matchAll(/PR(?:UE|Ü)FUNG:?\s*(BESTANDEN|FEHLGESCHLAGEN)/gi)]
  if (!treffer.length) return null
  return treffer[treffer.length - 1][1].toUpperCase() === 'BESTANDEN'
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
// Abschlusstext — Nachfahren entlang der Pfeile mit passendem „braucht"
// bekommen ihn in den Auftrag. Gekürzt, damit ein ausufernder Abschlusstext
// den Kontext des nächsten Blocks nicht flutet.
// Seit BAUPLAN 34 wird schema-bewusst gekürzt: in der MITTE, nicht hinten —
// die Marker-Zeilen am Ende (BEANSTANDUNG, PRUEFKARTE, PRUEFUNG) überleben,
// und die Kürzung steht sichtbar im Ticker (also auch im Laufbericht).
const LIEFERUNG_MAX = 8000

function gekuerzt(text) {
  return mitteGekuerzt(text, LIEFERUNG_MAX).text
}

// Tor ohne KI (BAUPLAN 35): So viel Befehls-Ausgabe geht als Tatsache in einen
// Auftrag — großzügig genug für ein echtes Testprotokoll, klein genug, dass es
// den Kontext des Bauers nicht flutet.
const TOR_PROTOKOLL_MAX = 6000
const BASELINE_MAX = 3000
// So viele Fehlerzeilen werden zu Beanstandungs-Zeilen; der Rest steht im
// Protokoll darunter (sonst wird aus einer kaputten Suite eine Bleiwüste).
const TOR_BEANSTANDUNGEN_MAX = 8

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
  if (einstellungen.motorModus === 'abo' && !ABO_MODUS_ERLAUBT)
    return { ok: false, fehler: texte.lauf.aboNichtErlaubt }
  if (einstellungen.motorModus === 'api' && !einstellungen.apiSchluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }

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
  // startet kein Lauf — ein Schreiber pro Projekt (SPEC §5). Ein untätiger
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
    aufschluesselung: { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
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

  // Folgen-Frage nach verbrauchten Reparatur-Runden (SPEC §4.1). Die Ergebnisse
  // werden nacheinander verarbeitet — es ist also höchstens eine offen.
  function entscheidungStellen(blockName, runden) {
    return new Promise((aufloesen) => {
      if (fenster.isDestroyed()) return aufloesen('zurueckstellen')
      tickern(texte.ticker.entscheidungGestellt)
      const frageId = crypto.randomUUID()
      lauf.entscheidungen.set(frageId, (wahl) => {
        lauf.entscheidungen.delete(frageId)
        lauf.offeneEntscheidung = null
        bericht.entscheidungen.push({ block: blockName, wahl })
        senden({ art: 'entscheidung-erledigt', frageId })
        aufloesen(wahl)
      })
      lauf.offeneEntscheidung = { frageId, blockName, runden }
      senden({ art: 'entscheidung', frageId, blockName, runden })
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
      lokaleHelfer = {
        modell: einstellungen.lokaleHelferModell,
        adresse: einstellungen.lokaleHelferAdresse,
        // Trefferquote (BAUPLAN 23): Standard an — ohne Quote ist die
        // Kosten-Wette der lokalen KI blind.
        bewerten: einstellungen.lokaleHelferQuote !== false,
        // Projektwissen (BAUPLAN 25): je lokalem Auftrag frisch gelesen —
        // die Kartenauswahl (ausgewaehlt) wächst mitten im Lauf. Seit der
        // Karten-Zuteilung (BAUPLAN 29) block-bezogen: Der Motor reicht die
        // Instanz-Kennung des laufenden Blocks herein — das 32k-Fenster
        // kleiner Modelle verträgt keine Kartenflut.
        projektwissen: (instanzId) =>
          projektwissenFuerHelfer(projektPfad, kartenFuerBlock(instanzId))
      }
      lokaleHelferHinweis = texte.ticker.lokaleHelferBereit(einstellungen.lokaleHelferModell)
    } else {
      lokaleHelferHinweis = texte.ticker.lokaleHelferNichtErreichbar
    }
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
  if (einstellungen.unteraufgabenModell !== 'wieBlock')
    tickern(texte.ticker.unteraufgabenSparsam(texte.kette.modellNamen.sparsam))
  if (lokaleHelferHinweis) tickern(lokaleHelferHinweis)
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
  // Sichtbarer Hinweis (SPEC §5, BAUPLAN 12): parallele Läufe vervielfachen den
  // Verbrauch — ehrlich im Ticker und damit auch im Laufbericht.
  if (aktiveLaeufe.size > 1) tickern(texte.lauf.parallelHinweis(aktiveLaeufe.size))

  // Der eigentliche Ablaufplaner — läuft im Hintergrund weiter, laufStarten
  // kehrt sofort zurück.
  ;(async () => {
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
          status: 'offen', // 'offen' | 'laeuft' | 'fertig'
          lieferung: null,
          rueckmeldung: '',
          // Reparatur-Runde beim Prüfer (Entscheidung Georg, 12.08.2026): seine
          // eigene Kritik der letzten Runde — er prüft dann nur diese Punkte nach.
          nachpruefung: '',
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
          // beanstandungNachforderung — der Prüfbeleg ohne Beanstandungs-Zeilen,
          //   den der Prüfer in der Nachforderung nachbessern soll;
          // fanOutGemeldet — je Etikett nur einmal „zusammengeführt" tickern;
          // verdraengungGemeldet — dasselbe für die verdrängte Lieferung
          //   (BAUPLAN 40).
          diffBasis: undefined,
          diffBasisVerschmutzt: false,
          diffAnfordern: false,
          diffText: '',
          vorFazit: '',
          beanstandungNachforderung: '',
          beanstandungNachgefordert: false,
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
          rauchtestRueckmeldung: ''
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

    // Karten-Zuteilung (BAUPLAN 29): instanzId → Karten-IDs, gefüllt vom
    // Werkzeug karten_zuteilen der Auftragsquellen-Blöcke. Nicht zugeteilte
    // Blöcke bekommen die volle Auswahl (Rückfall ohne Bruch).
    const kartenZuteilung = new Map()
    kartenFuerBlock = (instanzId) => kartenZuteilung.get(instanzId) ?? ausgewaehlt
    const nachfolgerVon = new Map(kettenIds.map((id) => [id, []]))
    for (const pfeil of workflow.pfeile) nachfolgerVon.get(pfeil.von)?.push(pfeil.nach)
    // Alle Nachfahren eines Blocks entlang der Pfeile, gruppiert nach
    // Blockname — zugeteilt wird per Name (so kennt der Agent die Blöcke).
    // Seit BAUPLAN 41 ist das der Anzeigename samt Zusatz: Zwei gleiche Blöcke
    // sind damit eindeutig adressierbar; ohne Zusatz bekommen wie bisher alle
    // gleichnamigen Instanzen dieselbe Zuteilung.
    function nachfahrenNamen(instanzId) {
      const namen = new Map()
      const offen = [...(nachfolgerVon.get(instanzId) ?? [])]
      const besucht = new Set()
      while (offen.length) {
        const id = offen.pop()
        if (besucht.has(id)) continue
        besucht.add(id)
        const name = knoten.get(id)?.name
        if (name) {
          if (!namen.has(name)) namen.set(name, [])
          namen.get(name).push(id)
        }
        for (const weiter of nachfolgerVon.get(id) ?? []) offen.push(weiter)
      }
      return namen
    }

    // Paket melden & Herkunft (BAUPLAN 30): Die Aufgaben-Karten, an denen
    // dieser Lauf arbeitet — gemeldet von Paket schneiden/Diagnose über
    // paket_melden (null = nicht gemeldet). Damit stempelt FlowForge jede im
    // Lauf angelegte oder geänderte Karte: Aufgabe(n) · Block · Lauf.
    let laufPaket = null
    function herkunftFuerBlock(instanzId) {
      const name = instanzId ? knoten.get(instanzId)?.name : null
      return {
        quelle: 'block',
        block: name ?? texte.laufberichte.unbekannterBlock,
        laufId: bericht.id,
        laufStart: bericht.gestartetAm,
        ...(laufPaket?.length ? { aufgaben: laufPaket } : {})
      }
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
      laufPaket = urteil.aufgaben
      bericht.paket = urteil.aufgaben.map((a) => a.titel)
      tickern(texte.ticker.paketGemeldet(urteil.aufgaben.map((a) => a.titel)))
      standSpeichern()
      return { ok: true, meldung: texte.agentenPaket.gemeldet(urteil.aufgaben.length) }
    }

    // Eine Motor-Session pro Lauf (BAUPLAN 19): Kennung und Füllstand der
    // Lauf-Session. Die Kennung wandert in den Laufstand — die Wiederaufnahme
    // nach einem App-Neustart setzt dieselbe Session fort statt neu zu starten.
    let laufSessionKennung =
      typeof fortsetzung?.laufSitzung?.kennung === 'string' ? fortsetzung.laufSitzung.kennung : null
    let laufSessionTokens = Number(fortsetzung?.laufSitzung?.tokens) || 0
    // Die Lauf-Session verarbeitet einen Block nach dem anderen — parallele
    // Zweige laufen als eigene Sessions (ehrlich im Ticker vermerkt).
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
    // Automatischer Übertrag (SPEC §5): Zähler gegen die Übertragsgrenze,
    // gemeinsam für alle Blöcke des Laufs.
    let uebertraege = 0
    // Kontingent-Pause: eine Windows-Benachrichtigung genügt, auch wenn
    // mehrere parallele Blöcke gleichzeitig pausieren.
    let pauseBenachrichtigt = false
    // Der Verbrauchs-Hinweis für parallele Blöcke kommt einmal pro Lauf.
    let parallelGemeldet = false
    const laufende = new Map() // instanzId → Promise<{ id, ergebnis }>

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
        rueckmeldungen: kettenIds
          .filter((id) => knoten.get(id).rueckmeldung)
          .map((id) => [id, knoten.get(id).rueckmeldung]),
        nachpruefungen: kettenIds
          .filter((id) => knoten.get(id).nachpruefung)
          .map((id) => [id, knoten.get(id).nachpruefung]),
        nachforderungen: kettenIds.filter((id) => knoten.get(id).startanleitungNachforderung),
        // Kanten-Ehrlichkeit (BAUPLAN 34): Diff-Basis, Vor-Fazit und eine
        // offene Beanstandungs-Nachforderung wandern mit — sonst stünde der
        // Bauer nach einem App-Neustart wieder ohne sie da. Der Diff-TEXT
        // selbst nicht: Er wird beim nächsten Anlauf ohnehin frisch gerechnet.
        kanten: kettenIds
          .filter((id) => {
            const nk = knoten.get(id)
            return (
              nk.diffBasis !== undefined ||
              nk.vorFazit ||
              nk.beanstandungNachforderung ||
              nk.beanstandungNachgefordert ||
              nk.torProtokoll ||
              nk.pruefbefehlNachforderung ||
              nk.rauchtestRueckmeldung
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
                beanstandungNachforderung: nk.beanstandungNachforderung,
                beanstandungNachgefordert: nk.beanstandungNachgefordert,
                // Tor ohne KI (BAUPLAN 35): Diese Zusätze sind teuer erarbeitet
                // (ein echter Befehlslauf) — nach einem App-Neustart stünde der
                // Bauer sonst wieder ohne Protokoll da. Der torGruenBefehl
                // wandert bewusst NICHT mit: Nach einer Unterbrechung ist die
                // Messung veraltet, das Tor läuft dann eben erneut.
                torProtokoll: nk.torProtokoll,
                pruefbefehlNachforderung: nk.pruefbefehlNachforderung,
                rauchtestRueckmeldung: nk.rauchtestRueckmeldung
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
        // die Herkunft stimmt auch nach einer Wiederaufnahme.
        paket: laufPaket,
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
        rauchtestNachgefordert: [...rauchtestNachgefordert]
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
      for (const [id, text] of Array.isArray(fortsetzung.rueckmeldungen) ? fortsetzung.rueckmeldungen : [])
        if (knoten.has(id) && typeof text === 'string') knoten.get(id).rueckmeldung = text
      for (const [id, text] of Array.isArray(fortsetzung.nachpruefungen) ? fortsetzung.nachpruefungen : [])
        if (knoten.has(id) && typeof text === 'string') knoten.get(id).nachpruefung = text
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
          if (typeof kante.beanstandungNachforderung === 'string')
            nk.beanstandungNachforderung = kante.beanstandungNachforderung
          nk.beanstandungNachgefordert = Boolean(kante.beanstandungNachgefordert)
          // Tor ohne KI (BAUPLAN 35): ebenso tolerant gegenüber alten
          // Laufständen — ohne Eintrag läuft alles wie vor diesem Schritt.
          if (typeof kante.torProtokoll === 'string') nk.torProtokoll = kante.torProtokoll
          if (typeof kante.pruefbefehlNachforderung === 'string')
            nk.pruefbefehlNachforderung = kante.pruefbefehlNachforderung
          if (typeof kante.rauchtestRueckmeldung === 'string')
            nk.rauchtestRueckmeldung = kante.rauchtestRueckmeldung
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
      const budgetUebernehmen = (wert, menge, gilt) => {
        if (Array.isArray(wert)) {
          for (const id of wert) if (knoten.has(id)) menge.add(id)
        } else if (wert === true) {
          for (const eintrag of kette) if (gilt(defVon(eintrag.blockId))) menge.add(eintrag.instanzId)
        }
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
      // Paket (BAUPLAN 30): tolerant gegenüber alten Laufständen.
      if (Array.isArray(fortsetzung.paket))
        laufPaket = fortsetzung.paket
          .filter((a) => a && typeof a.id === 'string')
          .map((a) => ({ id: a.id, titel: String(a.titel ?? '') }))
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
        nachfolger: nachfahrenNamen(instanzId)
      })
      if (urteil.fehler) return urteil
      for (const [id, ids] of urteil.zuteilung) kartenZuteilung.set(id, ids)
      // Der Bericht zeigt den Gesamtstand der Zuteilung — je Block mit
      // Kartenzahl; ein erneuter Aufruf ersetzt die erneut genannten Blöcke.
      bericht.kartenZuteilung = [...kartenZuteilung].map(([id, ids]) => ({
        block: knoten.get(id)?.name ?? '?',
        anzahl: ids.length
      }))
      const zeilen = urteil.jeBlock.map((e) => `${e.block} ${e.anzahl}`).join(', ')
      tickern(texte.ticker.kartenZuteilung(zeilen))
      standSpeichern()
      return { ok: true, meldung: texte.agentenKartenZuteilung.gespeichert(zeilen) }
    }

    // Baut einen Motor: den Lauf-Motor (mit Fortsetzung der Lauf-Session)
    // oder einen eigenen Motor für einen parallelen Zweig. Die Ereignis-
    // Zuordnung (welcher Block, welche Karte) liefern die Hol-Funktionen —
    // beim Lauf-Motor wechseln sie mit jedem Block.
    function motorBauen(fortsetzen, holeInstanz, holeName) {
      return starteLaufMotor({
        projektPfad,
        modus: einstellungen.motorModus,
        apiSchluessel: einstellungen.apiSchluessel,
        ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
        fortsetzen,
        lokaleHelfer,
        nurLesenBefehle: Boolean(einstellungen.nurLesenBefehle),
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
        holeHerkunft: herkunftFuerBlock
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
      const uebertrag = {
        aktiv: uebertragErlaubt,
        testModus: Boolean(einstellungen.uebertragTest),
        anweisung: texte.agentenLaufSession.uebertragAnweisung
      }
      let motor
      let haupt = false
      if (!laufMotorBelegt) {
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
          // Modellklasse je Block (BAUPLAN 37): die Wahl an der Blockkarte,
          // sonst die Voreinstellung des Blocks. Der Motor trägt sie beim
          // Agent-Aufruf ein; das Modell der Unteraufgaben hängt zusätzlich
          // an der Einstellung „Unteraufgaben der Block-Agenten".
          modell: sdkModell(blockModellKlasse(k.def, k.eintrag)),
          unterModell: unterModellFuer(
            k.def,
            blockModellKlasse(k.def, k.eintrag),
            einstellungen.unteraufgabenModell
          ),
          modellName: texte.kette.modellNamen[blockModellKlasse(k.def, k.eintrag)] ?? '',
          uebertrag
        })
        .catch((fehler) => ({
          zustand: 'fehlgeschlagen',
          fehlertext: String(fehler?.message ?? fehler),
          fehlerArt: null,
          ergebnisText: '',
          verbrauch: null
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

    // Welche Baseline gehört in den Auftrag dieses Blocks? Ein Prüfer sieht
    // seine eigene (er urteilt über seinen Zweig), ein Bau-Block alle.
    function baselineFuer(k) {
      if (k.def.prueft) {
        const eigen = baseline.get(k.eintrag.instanzId)
        return eigen ? [eigen] : []
      }
      return k.def.startanleitungPflicht ? [...baseline.values()] : []
    }

    // Führt einen Block vollständig aus: Auftrag bauen, Motor laufen lassen,
    // Überträge und Kontingent-/Server-Pausen durchstehen — bis ein endgültiges
    // Ergebnis da ist. Läuft für parallele Blöcke gleichzeitig.
    async function knotenAusfuehren(k) {
      // Verbrauch aller Sessions dieses Block-Anlaufs (auch über Überträge und
      // Pausen hinweg) — landet sichtbar am Block-Ergebnis im Laufbericht.
      let blockTokens = 0
      let blockKosten = null
      const blockAufschluesselung = { eingabe: 0, ausgabe: 0, cacheLesen: 0, cacheSchreiben: 0 }
      let blockHatAufschluesselung = false
      // Modell je Block (BAUPLAN 36): über alle Anläufe dieses Block-Anlaufs
      // hinweg (Übertrag, Kontingent-Pausen) — Modellkennung → Tokens.
      const blockModellTokens = new Map()
      // Diff der Reparatur-Runden (BAUPLAN 34): Beim ERSTEN Start eines
      // schreibenden Blocks halten wir fest, auf welchem Sicherungspunkt der
      // Projektordner steht — daraus rechnet FlowForge später „das hast du in
      // diesem Lauf bisher geändert" (kumulativ über alle Runden).
      if (!k.def.nurLesen && k.diffBasis === undefined) {
        k.diffBasis = await letzterPunktId(projektPfad)
        // Ehrliche Grenze: Hat vorher ein nur-lesender Block per Befehl Dateien
        // verändert, steckt das mit im Diff — dann sagt der Auftrag es dazu.
        // Nachsehen lohnt nur, wenn das überhaupt möglich war: Ohne die
        // Einstellung „Nur-lesende Blöcke dürfen Befehle ausführen" ändert kein
        // nur-lesender Block etwas, und der Blick über den ganzen Ordner entfällt.
        k.diffBasisVerschmutzt =
          Boolean(k.diffBasis) && einstellungen.nurLesenBefehle
            ? await standWeichtAb(projektPfad)
            : false
      }
      // Tor ohne KI (BAUPLAN 35): Steht eine Nachprüfung an und liegt ein
      // Prüfbefehl vor, prüft FlowForge zuerst selbst nach. Ist es rot, ist
      // dieser Block-Anlauf hier schon zu Ende — ohne Motor, ohne Tokens.
      if (k.def.prueft && k.nachpruefung) {
        const torErgebnis = await torAbspielen(k)
        if (torErgebnis) return torErgebnis
      }
      // Hängt die Verbrauchs-Summen dieses Blocks an ein endgültiges Ergebnis.
      function mitBlockVerbrauch(ergebnis) {
        const summe = [...blockModellTokens.values()].reduce((a, b) => a + b, 0)
        return {
          ...ergebnis,
          blockTokens,
          blockKosten,
          blockAufschluesselung: blockHatAufschluesselung ? { ...blockAufschluesselung } : null,
          // Modell je Block (BAUPLAN 36): null = kein Modell gemessen (alte
          // Berichte, Tor ohne KI) — das ist etwas anderes als „0 Tokens".
          blockModelle:
            summe > 0
              ? [...blockModellTokens]
                  .map(([modell, tokens]) => ({ modell, tokens, anteil: tokens / summe }))
                  .sort((a, b) => b.tokens - a.tokens)
              : null
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
        let auftrag =
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
          const namen = [...nachfahrenNamen(k.eintrag.instanzId).keys()]
          if (namen.length) auftrag += texte.agentenKartenZuteilung.auftragZusatz(namen)
          // Paket melden (BAUPLAN 30): auch im Ein-Block-Lauf — die Herkunft
          // der Karten hängt daran.
          auftrag += texte.agentenPaket.auftragZusatz
        }
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
              grundsaetzlicheKritik(k.nachpruefung) ?? k.nachpruefung
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
        // Kanten-Gate (BAUPLAN 34): Urteil ohne Beanstandungs-Zeile — der
        // Prüfer liefert sie nach, statt eine Reparatur-Runde zu verbrennen.
        if (k.beanstandungNachforderung)
          auftrag += texte.agentenUebergabe.beanstandungNachforderung(k.beanstandungNachforderung)
        // Prüfbefehl-Nachforderung (BAUPLAN 35): nur nachtragen, nichts neu
        // prüfen — dasselbe Muster wie die Startanleitungs-Nachforderung.
        if (k.pruefbefehlNachforderung)
          auftrag +=
            texte.agentenUebergabe.pruefbefehlNachforderung + k.pruefbefehlNachforderung
        if (k.startanleitungNachforderung)
          auftrag += texte.agentenUebergabe.startanleitungNachforderung
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
        const ergebnis = await blockAusfuehren(k, auftrag, uebertragErlaubt)
        if (ergebnis.verbrauch) {
          // Gezählt wird der ehrliche Anteil dieses Blocks: der Zuwachs des
          // Koordinator-Fadens plus der Verbrauch seiner Agenten (Block-Agent
          // und Helfer) — nicht die Historie der ganzen Lauf-Session.
          const zaehlTokens =
            (ergebnis.verbrauch.blockZuwachs ?? ergebnis.verbrauch.tokens ?? 0) +
            (ergebnis.verbrauch.unterTokens ?? 0)
          gesamtVerbrauch.tokens += zaehlTokens
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
          if (ergebnis.verbrauch.kontextFenster > 0)
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
          k.uebergabe = gekuerzt(text)
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
        return mitBlockVerbrauch(ergebnis)
      }
    }

    // Diff der bisherigen Runden (BAUPLAN 34): Was hat sich seit der
    // Diff-Basis dieses Blocks am Projekt geändert? Gerechnet aus zwei
    // Sicherungspunkten (kein git.exe nötig), ohne pruefung/ und
    // arbeitsablage/ — die Prüfer-Tests liegen beim Rückführen uncommittet im
    // Ordner und wanderten sonst als „Bauer-Änderung" mit.
    async function diffTextFuer(k) {
      const bis = await letzterPunktId(projektPfad)
      if (!k.diffBasis || !bis || k.diffBasis === bis) return ''
      const vergleich = await punkteVergleichen(projektPfad, k.diffBasis, bis)
      if (!vergleich.ok || vergleich.dateien.length === 0) return ''
      const text = diffTextBauen(vergleich.dateien, { verschmutzt: k.diffBasisVerschmutzt })
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
      // Je Prüf-Instanz ihr eigener Befehl und ihre eigene Prozessgruppe
      // (BAUPLAN 41): Sonst urteilte das Tor über einen fremden Zweig, und ein
      // fertiger Testlauf erschösse den laufenden des anderen.
      const befehl = pruefbefehlLaden(projektPfad, k.eintrag.instanzId)
      if (!befehl) return null
      tickern(texte.ticker.torSpielt(k.name, befehl))
      const messung = await befehlAbspielen(projektPfad, befehl, {
        gruppe: 'tor:' + projektPfad + ':' + k.eintrag.instanzId,
        abbrechen: () => lauf.sanft || lauf.hart
      })
      // Abgebrochen heißt: Georg hat den Lauf gestoppt, nicht „die Prüfung ist
      // rot" — daraus wird kein Urteil gebaut.
      if (messung.abgebrochen) return null
      if (messung.code === 0) {
        k.torGruenBefehl = befehl
        tickern(texte.ticker.torGruen)
        return null
      }
      // Baseline „vorher schon rot": Nur NEU Kaputtes zählt als Fehlschlag —
      // Altlasten sind schon als Aufgaben-Karte abgelegt und verbrennen keine
      // Reparatur-Runde. Ein Zeitlimit zählt dagegen immer als rot: Ein
      // Testlauf, der nicht endet, belegt gar nichts.
      const eigeneBaseline = baseline.get(k.eintrag.instanzId) ?? null
      const zeilen = eigeneBaseline
        ? neueFehler(eigeneBaseline.zeilen.join('\n'), messung.ausgabe)
        : fehlerZeilen(messung.ausgabe).map((f) => f.zeile)
      if (eigeneBaseline && zeilen.length === 0 && !messung.zeitlimit) {
        // Bewusst ohne torGruenBefehl: Der Befehl ist nicht grün, nur die
        // Fehler sind alt — der Prüfer prüft normal nach (er kennt die
        // Baseline aus seinem Auftrag), aber ohne Rückführung.
        tickern(texte.ticker.torAltlasten(eigeneBaseline.zeilen.length))
        return null
      }
      const genommen = zeilen.slice(0, TOR_BEANSTANDUNGEN_MAX)
      const beleg =
        (messung.zeitlimit
          ? texte.tor.belegKopfZeitlimit(befehl)
          : texte.tor.belegKopf(befehl, messung.code)) +
        '\n' +
        (genommen.length
          ? genommen.map((zeile) => texte.tor.beanstandung(zeile)).join('\n')
          : texte.tor.beanstandungOhneZeilen(befehl)) +
        (zeilen.length > genommen.length
          ? '\n' + texte.tor.weitere(zeilen.length - genommen.length)
          : '') +
        '\n\n' +
        texte.tor.urteil
      // Das volle Protokoll geht neben der Kritik an den Bauer — die
      // Beanstandungs-Zeilen allein sagen nicht, wo es klemmt.
      k.letztesTorProtokoll = mitteGekuerzt(messung.ausgabe, TOR_PROTOKOLL_MAX).text
      tickern(
        messung.zeitlimit ? texte.ticker.torRotZeitlimit : texte.ticker.torRot(zeilen.length)
      )
      // Ein vollwertiges Block-Ergebnis: Die Urteils-Auswertung, die
      // Rückführung und die Reparatur-Runden-Zählung greifen unverändert —
      // nur eben ohne einen einzigen Token.
      return {
        zustand: 'erfolgreich',
        ergebnisText: beleg,
        fehlertext: '',
        fehlerArt: null,
        verbrauch: null,
        blockTokens: 0,
        blockKosten: null,
        blockAufschluesselung: null,
        // Kein Modell hat gearbeitet — ehrlich „ohne Modell", nicht „0 Tokens
        // auf Opus" (BAUPLAN 36).
        blockModelle: null
      }
    }

    // Übergaben aus den Lieferungen der Vorfahren einsammeln — deterministisch
    // in topologischer Reihenfolge; entschieden wird in uebergabenAuswahl
    // (kettenRegeln), damit die braucht-Chips am Schaubild dasselbe zeigen.
    // Fan-out ohne Datenverlust (BAUPLAN 34): mehrere GLEICH nahe Vorfahren
    // kommen alle nummeriert an. Fan-in ohne stillen Verlust (BAUPLAN 40): Bei
    // ungleicher Distanz gewinnt weiter der nähere — die verdrängte Lieferung
    // steht jetzt aber im Ticker, statt wortlos zu verschwinden.
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
          text: vk.lieferung
        })
      }
      // Optionale Bedarfe (z.B. Angriffsliste beim Bauer) sind in den Gruppen
      // enthalten, wenn ein Vorfahre sie geliefert hat — verlangt werden sie nicht.
      const { gruppen } = uebergabenAuswahl(k.def, lieferungen)
      const bezeichnung = (l) => texte.ticker.blockBezeichnung(l.nummer, l.name)
      const eintraege = []
      for (const gruppe of gruppen) {
        gruppe.angekommen.forEach((lieferung, index) =>
          eintraege.push(
            gruppe.angekommen.length === 1
              ? texte.agentenUebergabe.eintrag(gruppe.etikett, lieferung.name, lieferung.text)
              : texte.agentenUebergabe.eintragMehrfach(
                  gruppe.etikett,
                  index + 1,
                  gruppe.angekommen.length,
                  lieferung.name,
                  lieferung.text
                )
          )
        )
        // Beide Meldungen einmal je Block und Etikett — uebergabenText läuft in
        // jeder Reparatur-Runde erneut und würde den Ticker sonst fluten.
        if (gruppe.angekommen.length > 1 && !k.fanOutGemeldet.has(gruppe.etikett)) {
          k.fanOutGemeldet.add(gruppe.etikett)
          tickern(
            texte.ticker.uebergabenZusammengefuehrt(gruppe.angekommen.length, gruppe.etikett)
          )
        }
        if (gruppe.verdraengt.length && !k.verdraengungGemeldet.has(gruppe.etikett)) {
          k.verdraengungGemeldet.add(gruppe.etikett)
          tickern(
            texte.ticker.uebergabeVerdraengt(
              gruppe.etikett,
              texte.ticker.blockBezeichnung(nummerVon.get(k.eintrag.instanzId), k.name),
              gruppe.angekommen.map(bezeichnung).join(' und '),
              gruppe.verdraengt.map(bezeichnung).join(', ')
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
    function warteGrundMelden(k, grund, worauf) {
      if (!worauf.length) return
      k.warteGemeldet ??= new Set()
      const schluessel = grund + ':' + worauf.join('|')
      if (k.warteGemeldet.has(schluessel)) return
      k.warteGemeldet.add(schluessel)
      tickern(
        grund === 'schreiber'
          ? texte.ticker.warteAufSchreiber(k.name, worauf[0])
          : texte.ticker.warteAufZweig(k.name, worauf)
      )
    }

    // Startet alle Blöcke, deren Vorgänger fertig sind — unter der Regel:
    // beliebig viele nur-lesende gleichzeitig, höchstens ein schreibender.
    function bereiteStarten() {
      if (endZustand || lauf.sanft || lauf.hart) return
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
        if (!k.def.nurLesen) {
          const schreiber = [...laufende.keys()].find((id) => !knoten.get(id).def.nurLesen)
          if (schreiber) {
            // pro Projekt schreibt nur ein Agent (SPEC §5) — und jetzt steht
            // auch im Ticker, auf wen dieser Block deshalb wartet.
            warteGrundMelden(k, 'schreiber', [knoten.get(schreiber).name])
            continue
          }
        }
        k.warteGemeldet?.clear()
        k.status = 'laeuft'
        lauf.aktiveInstanzen.add(eintrag.instanzId)
        senden({ art: 'block', instanzId: eintrag.instanzId })
        tickern(texte.ticker.blockStartet(nummerVon.get(eintrag.instanzId), kette.length, k.name))
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
      if (laufende.size > 1 && !parallelGemeldet) {
        parallelGemeldet = true
        tickern(texte.lauf.parallelBloeckeHinweis(laufende.size))
      }
    }

    // Prüfkarten (SPEC §3.1/§4.3, BAUPLAN 18): Nach jeder bestandenen Prüfung
    // entsteht automatisch eine Prüfkarte; dahinter bewahrt FlowForge die
    // frischen Prüfdateien dieses Laufs auf. Angepasste Fassungen eingelegter
    // alter Prüfungen ersetzen ihr Archiv — die Karte veraltet nicht.
    function pruefkarteNachBestandenerPruefung(instanzId, ergebnisText) {
      try {
        // Aufbewahrt wird ausschließlich der eigene Prüfordner (BAUPLAN 41) —
        // sonst nähme der erste bestehende Prüfer die Tests aller mit.
        const pruefOrdner = knoten.get(instanzId)?.pruefOrdner ?? ''
        const frisch = kartenLaden(projektPfad)
        const vorhandene = new Set(frisch.ok ? frisch.karten.map((karte) => karte.id) : [])
        for (const anhang of pruefkartenVonInstanz.get(instanzId) ?? [])
          if (vorhandene.has(anhang.id))
            pruefkartenArchivAuffrischen(projektPfad, anhang.id, pruefOrdner)
        const roh = pruefkarteAusErgebnis(ergebnisText)
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

    // Verarbeitet das endgültige Ergebnis eines Blocks — nacheinander, auch
    // wenn mehrere Blöcke gleichzeitig fertig werden.
    async function verarbeite(id, ergebnis) {
      const k = knoten.get(id)

      if (ergebnis.zustand === 'hart-abgebrochen') {
        // Der Abbruch samt Zurücksetzen wird nach dem Ende aller Motoren
        // einmal zentral erledigt.
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
          aufschluesselung: ergebnis.blockAufschluesselung ?? null,
          kostenUsd: ergebnis.blockKosten ?? null,
          modelle: ergebnis.blockModelle ?? null
        })
        if (!endZustand) {
          endZustand = 'fehlgeschlagen'
          fehlertext = ergebnis.fehlertext
        }
        return
      }

      // Block ist wirklich fertig: mitgeschleppte Zusätze für den nächsten
      // Anlauf sind damit erledigt.
      k.status = 'fertig'
      k.rueckmeldung = ''
      k.nachpruefung = ''
      k.startanleitungNachforderung = false
      k.uebergabe = ''
      k.uebergabeVerloren = false
      // Kanten-Zusätze dieses Anlaufs (BAUPLAN 34) sind damit ebenfalls erledigt.
      k.diffText = ''
      k.diffAnfordern = false
      k.vorFazit = ''
      k.beanstandungNachforderung = ''
      // Tor-Zusätze dieses Anlaufs (BAUPLAN 35) ebenso.
      k.torProtokoll = ''
      k.rauchtestRueckmeldung = ''
      k.pruefbefehlNachforderung = ''
      k.torGruenBefehl = ''

      // Abschlusstext als Lieferung für die Nachfahren ablegen und für die
      // Karten-Anzeige merken.
      const abschlusstext = String(ergebnis.ergebnisText ?? '')
      const lieferung = mitteGekuerzt(abschlusstext, LIEFERUNG_MAX)
      k.lieferung = lieferung.text
      // Kürzung sichtbar (BAUPLAN 34): Eine stillschweigend gestutzte Übergabe
      // ist genau die Art Kanten-Verlust, die dieser Schritt abstellt.
      if (lieferung.gekuerzt)
        tickern(texte.ticker.uebergabeGekuerzt(k.name, lieferung.von, lieferung.auf))
      const blockErgebnis = {
        instanzId: id,
        // Katalogname für die Metriken, Zusatzname daneben (BAUPLAN 41).
        block: k.def.name,
        zusatz: zusatznameBereinigen(k.eintrag.zusatz),
        zeit: jetztIso(),
        zustand: 'erfolgreich',
        ergebnisText: abschlusstext.slice(0, 4000),
        // Verbrauch dieses Anlaufs — so sieht Georg im Laufbericht, was jeder
        // Block gekostet hat (Koordinator-Zuwachs plus seine Agenten).
        tokens: ergebnis.blockTokens ?? null,
        // Token-Aufschlüsselung und theoretische API-Kosten je Block
        // (Wunsch Georg, 13.08.2026) — die Kosten rechnet der Motor selbst
        // aus den Preisen der genutzten Modelle.
        aufschluesselung: ergebnis.blockAufschluesselung ?? null,
        kostenUsd: ergebnis.blockKosten ?? null,
        // Modell je Block (BAUPLAN 36): welches Modell diesen Anlauf gearbeitet
        // hat (bei Mischung mit Anteilen) — Grundlage der Metrik Blocktyp × Modell.
        modelle: ergebnis.blockModelle ?? null
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
          k.status = 'offen'
          tickern(texte.ticker.startanleitungNachgefordert(k.name))
          return
        }
        tickern(texte.ticker.startanleitungWeiterOhne)
      }

      // Rauchtest der Startanleitung (BAUPLAN 35): FlowForge startet die
      // gebaute App einmal kurz und stoppt sie wieder — läuft sie gar nicht an,
      // erfährt das der Bauer sofort und ohne einen Token, statt dass der
      // Prüfer eine ganze Runde damit verbringt. Genau eine Nachbesserungs-
      // Runde pro Lauf; danach macht der Lauf ehrlich vermerkt weiter.
      if (
        k.def.startanleitungPflicht &&
        k.status === 'fertig' &&
        !lauf.sanft &&
        !lauf.hart &&
        !endZustand
      ) {
        const probe = await rauchtest(projektPfad, {
          // Eigene Prozessgruppe je Block-Instanz (BAUPLAN 41).
          gruppe: 'rauchtest:' + projektPfad + ':' + id,
          abbrechen: () => lauf.sanft || lauf.hart
        })
        if (probe.geprueft && probe.gruen) tickern(texte.ticker.rauchtestGruen)
        else if (probe.grund === 'appLaeuft') tickern(texte.ticker.rauchtestUebersprungen)
        else if (probe.geprueft && !probe.gruen) {
          blockErgebnis.zustand = 'startanleitung-laeuft-nicht'
          if (!rauchtestNachgefordert.has(id)) {
            rauchtestNachgefordert.add(id)
            k.rauchtestRueckmeldung = mitteGekuerzt(
              String(probe.ausgabe ?? '').trim() || texte.tor.rauchtestOhneAusgabe,
              TOR_PROTOKOLL_MAX
            ).text
            k.status = 'offen'
            tickern(texte.ticker.rauchtestRot(k.name))
            return
          }
          tickern(texte.ticker.rauchtestWeiterOhne)
        }
      }

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
          k.pruefbefehlNachforderung = gekuerzt(String(ergebnis.ergebnisText ?? ''))
          k.status = 'offen'
          tickern(texte.ticker.pruefbefehlNachgefordert(k.name))
          return
        }
        tickern(texte.ticker.pruefbefehlWeiterOhne)
      }

      // Prüfer-Blöcke: Urteil auswerten, ggf. Fehlschlag-Rückführung.
      if (k.def.prueft) {
        const bestanden = pruefUrteil(ergebnis.ergebnisText)
        blockErgebnis.zustand = bestanden === true ? 'pruefung-bestanden' : 'pruefung-nicht-bestanden'
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
          pruefkarteNachBestandenerPruefung(id, ergebnis.ergebnisText)
          // Tor ohne KI (BAUPLAN 35): Ein Prüfbefehl, der zu einer bestandenen
          // Prüfung gehört, taugt als Maßstab — aufbewahrt wird er außerhalb
          // des Projektordners und liefert beim nächsten Laufstart die
          // Baseline „vorher schon rot".
          pruefbefehlArchivieren(projektPfad, id)
        } else {
          tickern(bestanden === false ? texte.ticker.pruefungNichtBestanden : texte.ticker.pruefungOhneErgebnis)
          // Kanten-Gate (BAUPLAN 34): Ein Urteil FEHLGESCHLAGEN ohne eine
          // einzige Beanstandungs-Zeile ist für den Bauer wertlos — FlowForge
          // fordert einmal beim Prüfer nach (kostet KEINE Reparatur-Runde),
          // statt eine zu verbrennen. Bewusst nur bei einem eindeutigen
          // Fehlurteil: Ein Prüfer ganz ohne Urteils-Marke ist abgebrochen
          // oder verunglückt — da hilft Nachfordern nicht.
          const belegKritik = prueferKritik(ergebnis.ergebnisText)
          if (
            bestanden === false &&
            belegKritik.anzahl === 0 &&
            !k.beanstandungNachgefordert &&
            !lauf.sanft &&
            !lauf.hart &&
            !endZustand
          ) {
            k.beanstandungNachgefordert = true
            k.beanstandungNachforderung = gekuerzt(String(ergebnis.ergebnisText ?? ''))
            k.status = 'offen'
            tickern(texte.ticker.beanstandungenNachgefordert(k.name))
            return
          }
          if (belegKritik.anzahl === 0 && k.beanstandungNachgefordert)
            tickern(texte.ticker.beanstandungenOhneMarken(k.name))
          const zielId = rueckfuehrungsZiel(workflow.bloecke, workflow.pfeile, id)

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
            // lokalen KI verstehen müssen. Der neueste Punkt ist garantiert
            // „Stand vor lokaler Reparatur" (der Fehlschlag-Zweig legt keine an).
            tickern(
              texte.ticker.lokaleReparaturZurueckgerollt(k.lokaleVersuche, LOKALE_REPARATUR_VERSUCHE)
            )
            await aufLetztenPunktZuruecksetzen(projektPfad)
            metrikUrteil(k.lokaleReparaturBlock, 'reparatur', 'nicht-gehalten', k.lokaleReparaturSchritte)
            eskalationsKritik = k.lokaleKritik
          }
          const zielK = zielId ? knoten.get(zielId) : null
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
              beanstandungenEinstufen(ergebnis.ergebnisText) === 'mechanisch'
                ? belegKritik.text
                : null
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
              const punkt = await sicherungspunktAnlegen(
                projektPfad,
                texte.sicherungen.beschriftungVorLokalerReparatur
              )
              if (!punkt.ok) break
              tickern(
                texte.ticker.lokaleReparaturStart(
                  k.lokaleVersuche,
                  LOKALE_REPARATUR_VERSUCHE,
                  lokaleHelfer.modell
                )
              )
              const reparatur = await lokalReparieren({
                projektPfad,
                // Projektwissen (BAUPLAN 25) auch für die Vorreparatur — sie
                // läuft an den Helfer-Werkzeugen vorbei direkt über lauf.js.
                auftrag:
                  (lokaleHelfer.projektwissen?.(k.eintrag.instanzId) ?? '') +
                  texte.agentenLokaleHelfer.reparaturAuftrag(k.lokaleKritik),
                modell: lokaleHelfer.modell,
                adresse: lokaleHelfer.adresse,
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

          const kritik = eskalationsKritik ?? belegKritik.text
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
            // Erneut laufen alle Blöcke auf den Wegen vom Ziel zum Prüfer —
            // parallele Zweige außerhalb behalten ihr Ergebnis.
            for (const nochmalId of zwischenBloecke(workflow.bloecke, workflow.pfeile, zielId, id)) {
              const nk = knoten.get(nochmalId)
              if (nk.status === 'fertig') nk.status = 'offen'
            }
            const ziel = knoten.get(zielId)
            ziel.rueckmeldung = kritik
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
            // Für den Prüfer zählt ab jetzt „was sich seit meinem Urteil
            // geändert hat" — seine Nachprüfung bekommt denselben Dienst.
            k.diffBasis = await letzterPunktId(projektPfad)
            k.diffAnfordern = true
            // Der Prüfer selbst prüft in der nächsten Runde nur seine
            // Beanstandungen nach — keine erneute Vollprüfung.
            k.nachpruefung = kritik
            tickern(texte.ticker.rueckfuehrung(ziel.name, genutzt, rundenStandard))
            if (belegKritik.anzahl > 0)
              tickern(texte.ticker.beanstandungenUebergeben(belegKritik.anzahl, ziel.name))
            if (belegKritik.weggelassen > 0)
              tickern(texte.ticker.beanstandungenTeilweise(belegKritik.weggelassen))
            return
          }
          const wahl = await entscheidungStellen(k.name, rundenStandard)
          if (wahl === 'zurueckstellen') {
            tickern(texte.ticker.entscheidungZurueckgestellt)
            if (!endZustand) endZustand = 'zurueckgestellt'
            return
          }
          if (wahl === 'wiederherstellen') {
            tickern(texte.ticker.entscheidungWiederhergestellt)
            wiederherstellenNachLauf = true
            if (!endZustand) endZustand = 'wiederhergestellt'
            return
          }
          tickern(texte.ticker.entscheidungWeitermachen)
        }
      }

      // Sicherungspunkt nach jedem gelungenen schreibenden Block (SPEC §3.3).
      // Nur-lesende Blöcke ändern nichts — und ein Punkt, während parallel ein
      // Schreiber arbeitet, würde dessen halbfertige Änderungen einfrieren.
      if (!k.def.nurLesen) {
        const punkt = await sicherungspunktAnlegen(
          projektPfad,
          texte.sicherungen.beschriftungNachBlock(k.name)
        )
        if (punkt.ok && punkt.neu) tickern(texte.ticker.sicherungspunktAngelegt)
      }
    }

    standSpeichern()
    // Die Planer-Schleife: Bereites starten, auf den nächsten fertigen Block
    // warten, Ergebnis verarbeiten — bis nichts mehr läuft.
    while (true) {
      bereiteStarten()
      if (laufende.size === 0) break
      const { id, ergebnis } = await Promise.race(laufende.values())
      laufende.delete(id)
      lauf.aktiveInstanzen.delete(id)
      senden({ art: 'block-fertig', instanzId: id })
      await verarbeite(id, ergebnis)
      standSpeichern()
    }

    // Die Lauf-Session geordnet schließen — der Lauf ist zu Ende (BAUPLAN 19).
    lauf.laufMotor?.beenden()

    // Harter Stopp: alle Motoren sind tot — der Projektordner springt einmal
    // zentral auf den letzten Sicherungspunkt zurück (SPEC §6).
    if (lauf.hart && !wiederherstellenNachLauf) {
      const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad)
      if (zurueck.ok && zurueck.zurueckgesetzt) tickern(texte.ticker.zurueckgesetzt)
      endZustand = 'hart-abgebrochen'
    }
    if (!endZustand) {
      const alleFertig = kettenIds.every((id) => knoten.get(id).status === 'fertig')
      endZustand = alleFertig ? 'erfolgreich' : lauf.sanft ? 'sanft-gestoppt' : 'fehlgeschlagen'
    }
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
  const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad)
  if (!zurueck.ok) return zurueck
  // Sonderlauf (BAUPLAN 30): derselbe Ein-Block-Workflow wie beim Start.
  const sonderlauf =
    stand.sonderlauf && SONDERLAEUFE[stand.sonderlauf.art] && typeof stand.sonderlauf.instanzId === 'string'
      ? { art: stand.sonderlauf.art, instanzId: stand.sonderlauf.instanzId }
      : null
  return laufStarten(fenster, projektPfad, stand.kartenIds, stand, ausWarteschlange, sonderlauf)
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
    entscheidung: lauf.offeneEntscheidung,
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
