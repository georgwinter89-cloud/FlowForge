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
import { blockDefinition } from '../shared/blockKatalog.js'
import {
  pruefeSchaubild,
  pruefeVersorgung,
  schaubildReihenfolge,
  pruefePflichtfelder,
  auftragMitFeldern,
  vorfahrenSortiert,
  rueckfuehrungsZiel,
  zwischenBloecke
} from '../shared/kettenRegeln.js'
import { einstellungenLaden, ABO_MODUS_ERLAUBT } from './einstellungen.js'
import {
  kartenLaden,
  kontingentVerhaltenLaden,
  pruefkarteAnlegen,
  karteAnlegen,
  karteAendern,
  karteErledigtSetzen,
  karteLoeschen
} from './projekte.js'
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
import { kartenZeile } from './motor/kartenWerkzeuge.js'
import {
  sicherungspunktAnlegen,
  aufLetztenPunktZuruecksetzen,
  wiederherstellen
} from './sicherungspunkte.js'
import { workflowLaden } from './workflow.js'
import { laufstandSpeichern, laufstandLaden, laufstandLoeschen } from './laufstand.js'
import { laufVorschlagSpeichern, laufVorschlagLoeschen } from './naechsterLauf.js'
import { kartenZuteilungPruefen } from './motor/kartenZuteilungWerkzeuge.js'
import { chatBeschaeftigt, chatSchliessen } from './nachlaufChat.js'

const BERICHTE_ORDNER = 'laufberichte'

// Kontingent-Pause (SPEC §5): so lange wartet FlowForge zwischen zwei
// Versuchen, wenn das Abo-Kontingent erschöpft ist.
const KONTINGENT_PAUSE_MS = 10 * 60 * 1000

// Parallelität (SPEC §5, BAUPLAN 12): bis zu 3 Läufe gleichzeitig, aber nur in
// verschiedenen Projekten — pro Projekt schreibt immer nur ein Agent. Weitere
// Starts landen in der Warteschlange und laufen automatisch an.
const MAX_PARALLEL_LAEUFE = 3
const aktiveLaeufe = new Map() // projektPfad → Lauf
const warteschlange = [] // { fenster, projektPfad, kartenIds, fortsetzen }
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

function inWarteschlangeStellen(fenster, projektPfad, kartenIds, fortsetzen) {
  if (warteschlange.some((eintrag) => eintrag.projektPfad === projektPfad))
    return { ok: false, fehler: texte.lauf.schonInWarteschlange }
  warteschlange.push({ fenster, projektPfad, kartenIds, fortsetzen })
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
        : await laufStarten(eintrag.fenster, eintrag.projektPfad, eintrag.kartenIds, null, true)
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

// Die Begründung des Prüfers (ohne die Urteils-Marke) — geht als Rückmeldung
// an den Block, zu dem die Reparatur-Runde zurückspringt.
function prueferKritik(ergebnisText) {
  const ohneMarke = String(ergebnisText)
    .replace(/PR(?:UE|Ü)FUNG:?\s*(BESTANDEN|FEHLGESCHLAGEN)/gi, '')
    .trim()
  return ohneMarke.length > 600 ? ohneMarke.slice(0, 600) + ' …' : ohneMarke
}

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
  return texte.agentenKarten.kontext(gewaehlt.map((k) => '- ' + kartenZeile(k)).join('\n'))
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
const LIEFERUNG_MAX = 8000

function gekuerzt(text) {
  return text.length > LIEFERUNG_MAX ? text.slice(0, LIEFERUNG_MAX) + ' …' : text
}

// fortsetzung (BAUPLAN 11): gespeicherter Laufstand einer Unterbrechung — die
// dort fertigen Blöcke laufen nicht erneut, ihre Lieferungen sind wieder da.
// Kommt nur über laufFortsetzen() herein.
// ausWarteschlange (BAUPLAN 12): Start durch den automatischen Anlauf — dann
// wird bei belegtem Platz nicht erneut eingereiht, sondern ehrlich abgelehnt.
export async function laufStarten(fenster, projektPfad, kartenIds, fortsetzung = null, ausWarteschlange = false) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }

  // Ohne ausdrückliche Auswahl gilt die festgenagelte Vorauswahl:
  // Status-Karte (immer) + offene Aufgaben-Karten.
  let ausgewaehlt = Array.isArray(kartenIds) ? kartenIds.filter((id) => typeof id === 'string') : null
  if (!ausgewaehlt) {
    const geladen = kartenLaden(projektPfad)
    ausgewaehlt = geladen.ok
      ? geladen.karten.filter((k) => k.sorte === 'aufgabe' && !k.erledigt).map((k) => k.id)
      : []
  }

  const geladen = workflowLaden(projektPfad)
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
  if (fortsetzung) {
    const pfeilMenge = new Set(workflow.pfeile.map((p) => p.von + '→' + p.nach))
    const idMenge = new Set(kettenIds)
    const passt =
      Array.isArray(fortsetzung.fertigIds) &&
      Array.isArray(fortsetzung.kettenIds) &&
      fortsetzung.kettenIds.length === kette.length &&
      kette.every((eintrag, idx) => eintrag.instanzId === fortsetzung.kettenIds[idx]) &&
      Array.isArray(fortsetzung.pfeile) &&
      fortsetzung.pfeile.length === pfeilMenge.size &&
      fortsetzung.pfeile.every(
        (paar) => Array.isArray(paar) && pfeilMenge.has(paar[0] + '→' + paar[1])
      ) &&
      fortsetzung.fertigIds.every((id) => idMenge.has(id))
    if (!passt) {
      laufstandLoeschen(projektPfad)
      return { ok: false, fehler: texte.wiederaufnahme.fehlerVeraendert }
    }
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
    const def = blockDefinition(eintrag.blockId)
    for (const feld of def.felder) {
      if (!feld.oderOffeneAufgaben) continue
      if ((eintrag.feldWerte?.[feld.id] ?? '').trim()) continue
      // Ein Vorfahre, der selbst Aufgaben-Karten erzeugt (Spec-Interview),
      // zählt als Auftragsquelle — bei „Neue App starten" gibt es beim Start
      // noch keine Karten, die Aufgaben entstehen erst im Lauf.
      if (
        vorfahrenSortiert(workflow.bloecke, workflow.pfeile, eintrag.instanzId).some(
          (v) => blockDefinition(v.blockId).erzeugtAufgaben
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
        return { ok: false, fehler: texte.kette.fehlerAuftragsquelle(def.name, feld.label) }
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
    return inWarteschlangeStellen(fenster, projektPfad, kartenIds, Boolean(fortsetzung))
  }
  if (!ausWarteschlange && plaetzeBelegt() >= MAX_PARALLEL_LAEUFE)
    return inWarteschlangeStellen(fenster, projektPfad, kartenIds, Boolean(fortsetzung))

  // Nachlauf-Chat (BAUPLAN 27): Arbeitet der Chat gerade in diesem Projekt,
  // startet kein Lauf — ein Schreiber pro Projekt (SPEC §5). Ein untätiger
  // Chat wird geschlossen: Er gehört zum vorigen Lauf, der neue bringt einen
  // neuen Chat mit frischem Kontext.
  if (chatBeschaeftigt(projektPfad))
    return { ok: false, fehler: texte.chat.fehlerLaufWaehrendChat }
  chatSchliessen(projektPfad)

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
    gespraech: []
  }
  aktiveLaeufe.set(projektPfad, lauf)
  laeufeMelden()

  // Lauf-Mappe statt Projekt-Mappe (Entscheidung Georg, 13.08.2026, BAUPLAN 17):
  // Die Prüfmappe pruefung/ gehört zum Lauf — ein neuer Lauf startet mit leerer
  // Mappe, der Prüfer baut seine Prüfungen frisch fürs aktuelle Paket. Geleert
  // wird VOR dem Sicherungspunkt „Stand vor Lauf", damit auch „Sofort abbrechen"
  // die alten Prüfungen nicht zurückholt. Die Wiederaufnahme eines
  // unterbrochenen Laufs leert nicht — dessen Prüfungen gehören ja zu ihm.
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
    const schonEingelegt = new Set()
    for (const eintrag of kette) {
      if (!blockDefinition(eintrag.blockId)?.prueft) continue
      const liste = []
      for (const kartenId of eintrag.pruefKarten ?? []) {
        const karte = pruefkartenNachId.get(kartenId)
        if (!karte) continue // Karte inzwischen gelöscht — still ignorieren
        const anhang = {
          id: kartenId,
          titel: karte.titel,
          text: karte.text,
          ordner: pruefkartenOrdner(kartenId),
          dateien: pruefkartenArchivHatDateien(projektPfad, kartenId)
        }
        if (!fortsetzung && anhang.dateien && !schonEingelegt.has(kartenId)) {
          schonEingelegt.add(kartenId)
          try {
            if (pruefkarteEinlegen(projektPfad, kartenId)) pruefkartenEingelegt++
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
  const namen = kette.map((b) => blockDefinition(b.blockId).name)
  const sicherung = await sicherungspunktAnlegen(
    projektPfad,
    texte.sicherungen.beschriftungVorLauf(namen[0])
  )
  if (!sicherung.ok) {
    aktiveLaeufe.delete(projektPfad)
    laeufeMelden()
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
    // Wiederaufnahme nach Unterbrechung (BAUPLAN 11).
    fortgesetzt: Boolean(fortsetzung),
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
  function vorschlagStellen(vorschlag) {
    return new Promise((aufloesen) => {
      if (fenster.isDestroyed()) return aufloesen(null)
      const artLabel = texte.vorschlag.artLabels[vorschlag.art] ?? vorschlag.art
      const kartenTitel = vorschlag.alteKarte?.titel ?? vorschlag.titel ?? ''
      tickern(texte.ticker.kartenVorschlagGestellt(artLabel, kartenTitel))
      if (!fenster.isFocused() && Notification.isSupported())
        new Notification({
          title: texte.benachrichtigung.vorschlagTitel,
          body: `${artLabel}: ${kartenTitel}`
        }).show()
      const frageId = crypto.randomUUID()
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
        let ergebnis
        if (vorschlag.art === 'aktualisieren')
          ergebnis = karteAendern(projektPfad, vorschlag.kartenId, { titel, text })
        else if (vorschlag.art === 'erledigen')
          ergebnis = karteErledigtSetzen(projektPfad, vorschlag.kartenId, true)
        else if (vorschlag.art === 'oeffnen')
          ergebnis = karteErledigtSetzen(projektPfad, vorschlag.kartenId, false)
        else if (vorschlag.art === 'anlegen')
          ergebnis = karteAnlegen(projektPfad, { sorte: 'aufgabe', titel, text })
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

  // Lauf-Start sofort melden — noch vor der ersten Ticker-Zeile, damit die
  // Ansicht die Anzeige des vorigen Laufs sauber leeren kann.
  senden({ art: 'zustand', zustand: 'laeuft' })
  // Ehrlichkeit (Entscheidung Georg, 14.08.2026): Ist die Auf-eigene-Gefahr-
  // Einstellung aktiv, steht das sichtbar am Laufstart — im Ticker und damit
  // auch im Laufbericht.
  if (einstellungen.nurLesenBefehle) tickern(texte.ticker.nurLesenBefehleAktiv)
  if (lokaleHelferHinweis) tickern(lokaleHelferHinweis)
  if (pruefmappeGeleert) tickern(texte.ticker.pruefmappeGeleert)
  if (pruefkartenEingelegt > 0) tickern(texte.ticker.pruefkartenEingelegt(pruefkartenEingelegt))
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
          def: blockDefinition(eintrag.blockId),
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
          lokaleNachpruefung: false
        }
      ])
    )
    const nummerVon = new Map(kettenIds.map((id, idx) => [id, idx + 1]))
    const vorgaengerVon = new Map(kettenIds.map((id) => [id, []]))
    for (const pfeil of workflow.pfeile) vorgaengerVon.get(pfeil.nach)?.push(pfeil.von)
    const vorfahrenVon = new Map(
      kettenIds.map((id) => [id, vorfahrenSortiert(workflow.bloecke, workflow.pfeile, id)])
    )

    // Karten-Zuteilung (BAUPLAN 29): instanzId → Karten-IDs, gefüllt vom
    // Werkzeug karten_zuteilen der Auftragsquellen-Blöcke. Nicht zugeteilte
    // Blöcke bekommen die volle Auswahl (Rückfall ohne Bruch).
    const kartenZuteilung = new Map()
    kartenFuerBlock = (instanzId) => kartenZuteilung.get(instanzId) ?? ausgewaehlt
    const nachfolgerVon = new Map(kettenIds.map((id) => [id, []]))
    for (const pfeil of workflow.pfeile) nachfolgerVon.get(pfeil.von)?.push(pfeil.nach)
    // Alle Nachfahren eines Blocks entlang der Pfeile, gruppiert nach
    // Blockname — zugeteilt wird per Name (so kennt der Agent die Blöcke);
    // tragen mehrere Instanzen denselben Namen, bekommen alle die Zuteilung.
    function nachfahrenNamen(instanzId) {
      const namen = new Map()
      const offen = [...(nachfolgerVon.get(instanzId) ?? [])]
      const besucht = new Set()
      while (offen.length) {
        const id = offen.pop()
        if (besucht.has(id)) continue
        besucht.add(id)
        const name = knoten.get(id)?.def.name
        if (name) {
          if (!namen.has(name)) namen.set(name, [])
          namen.get(name).push(id)
        }
        for (const weiter of nachfolgerVon.get(id) ?? []) offen.push(weiter)
      }
      return namen
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
    let rundenUebrig = workflow.reparaturRunden
    // Startanleitungs-Pflicht (SPEC §8): genau eine Nachbesserungs-Runde pro
    // Lauf — unabhängig von den Reparatur-Runden des Prüfers.
    let startanleitungNachgefordert = false
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
        rundenUebrig,
        uebertraege,
        startanleitungNachgefordert
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
      for (const [id, u] of Array.isArray(fortsetzung.uebergaben) ? fortsetzung.uebergaben : [])
        if (knoten.has(id)) {
          knoten.get(id).uebergabe = typeof u?.text === 'string' ? u.text : ''
          knoten.get(id).uebergabeVerloren = Boolean(u?.verloren)
        }
      if (Number.isInteger(fortsetzung.rundenUebrig)) rundenUebrig = fortsetzung.rundenUebrig
      if (Number.isInteger(fortsetzung.uebertraege)) uebertraege = fortsetzung.uebertraege
      startanleitungNachgefordert = Boolean(fortsetzung.startanleitungNachgefordert)
      // Karten-Zuteilung (BAUPLAN 29): tolerant gegenüber alten Laufständen —
      // ohne Eintrag gilt schlicht die volle Auswahl.
      for (const [id, ids] of Array.isArray(fortsetzung.kartenZuteilung)
        ? fortsetzung.kartenZuteilung
        : [])
        if (knoten.has(id) && Array.isArray(ids))
          kartenZuteilung.set(id, ids.filter((kartenId) => typeof kartenId === 'string'))
      const naechster = kette.find((eintrag) => knoten.get(eintrag.instanzId).status !== 'fertig')
      if (naechster)
        tickern(
          texte.ticker.wiederaufnahme(
            nummerVon.get(naechster.instanzId),
            kette.length,
            blockDefinition(naechster.blockId).name
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
        block: knoten.get(id)?.def.name ?? '?',
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
          if (daten.art === 'lokale-helfer') {
            bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
            bericht.lokaleHelfer.recherchen++
            bericht.lokaleHelfer.schritte += daten.schritte ?? 0
            if (daten.gescheitert) bericht.lokaleHelfer.gescheitert++
            return
          }
          // Lokale Entwürfe (BAUPLAN 21): Entwürfe und ihre Abnahme
          // (übernommen/verworfen) landen ehrlich in der Helfer-Zeile.
          // Trefferquote (BAUPLAN 23): je Recherche-Fazit, ob der Agent es
          // übernommen oder verworfen hat — die Quote steht im Bericht.
          if (daten.art === 'lokale-helfer-recherche-urteil') {
            bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
            if (daten.uebernommen)
              bericht.lokaleHelfer.recherchenUebernommen =
                (bericht.lokaleHelfer.recherchenUebernommen ?? 0) + 1
            else
              bericht.lokaleHelfer.recherchenVerworfen =
                (bericht.lokaleHelfer.recherchenVerworfen ?? 0) + 1
            return
          }
          if (daten.art === 'lokale-helfer-entwurf') {
            bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
            bericht.lokaleHelfer.schritte += daten.schritte ?? 0
            if (daten.entwurf)
              bericht.lokaleHelfer.entwuerfe = (bericht.lokaleHelfer.entwuerfe ?? 0) + 1
            else
              bericht.lokaleHelfer.entwuerfeGescheitert =
                (bericht.lokaleHelfer.entwuerfeGescheitert ?? 0) + 1
            return
          }
          if (daten.art === 'lokale-helfer-entwurf-urteil') {
            bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
            if (daten.uebernommen)
              bericht.lokaleHelfer.entwuerfeUebernommen =
                (bericht.lokaleHelfer.entwuerfeUebernommen ?? 0) + 1
            else
              bericht.lokaleHelfer.entwuerfeVerworfen =
                (bericht.lokaleHelfer.entwuerfeVerworfen ?? 0) + 1
            return
          }
          // Lokaler Bauer (BAUPLAN 22): Bau-Versuche und die Abnahme je
          // Teilstück (gehalten / vom Agenten selbst gebaut) in der Helfer-Zeile.
          if (daten.art === 'lokale-helfer-bauen') {
            bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
            bericht.lokaleHelfer.schritte += daten.schritte ?? 0
            if (daten.gescheitert)
              bericht.lokaleHelfer.teilstueckeGescheitert =
                (bericht.lokaleHelfer.teilstueckeGescheitert ?? 0) + 1
            return
          }
          if (daten.art === 'lokale-helfer-teilstueck-urteil') {
            bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
            if (daten.gehalten)
              bericht.lokaleHelfer.teilstueckeGehalten =
                (bericht.lokaleHelfer.teilstueckeGehalten ?? 0) + 1
            else
              bericht.lokaleHelfer.teilstueckeVerworfen =
                (bericht.lokaleHelfer.teilstueckeVerworfen ?? 0) + 1
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
        aufKartenVorschlag: vorschlagStellen,
        aufLaufVorschlag: laufVorschlagAnnehmen,
        aufKartenZuteilung: kartenZuteilungAnnehmen
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
        hauptMotorBlockName = k.def.name
      } else {
        // Parallele Zweige (BAUPLAN 19): Die Lauf-Session verarbeitet einen
        // Block nach dem anderen — parallele Blöcke laufen ehrlich vermerkt
        // in eigenen Sessions.
        tickern(texte.ticker.parallelEigeneSession(k.def.name))
        motor = motorBauen(
          null,
          () => instanzId,
          () => k.def.name
        )
      }
      lauf.motoren.set(instanzId, motor)
      return motor
        .blockAusfuehren({
          auftrag,
          blockName: k.def.name,
          // Karten-Zuteilung (BAUPLAN 29): Die Instanz-Kennung ordnet
          // Zuteilung und Projektwissen dem laufenden Block zu.
          instanzId,
          nurLesen: k.def.nurLesen,
          // Nur Prüf-Blöcke dürfen die Prüfmappe verändern (Entscheidung Georg,
          // 12.08.2026) — der Bauer weicht sonst Prüfungen auf, statt zu reparieren.
          darfPruefen: Boolean(k.def.prueft),
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
      // Hängt die Verbrauchs-Summen dieses Blocks an ein endgültiges Ergebnis.
      function mitBlockVerbrauch(ergebnis) {
        return {
          ...ergebnis,
          blockTokens,
          blockKosten,
          blockAufschluesselung: blockHatAufschluesselung ? { ...blockAufschluesselung } : null
        }
      }
      while (true) {
        standSpeichern()
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
        if (k.def.kartenZuteilung) {
          const namen = [...nachfahrenNamen(k.eintrag.instanzId).keys()]
          if (namen.length) auftrag += texte.agentenKartenZuteilung.auftragZusatz(namen)
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
        if (k.nachpruefung)
          auftrag += k.lokaleNachpruefung
            ? texte.agentenUebergabe.lokaleNachpruefung(k.nachpruefung)
            : texte.agentenUebergabe.prueferNachpruefung(k.nachpruefung)
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
            block: k.def.name,
            text: k.uebergabeVerloren
              ? texte.laufberichte.uebertragOhneUebergabeZeile(k.def.name)
              : texte.laufberichte.uebertragZeile(
                  k.def.name,
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

    // Übergaben aus den Lieferungen der Vorfahren einsammeln — deterministisch
    // in topologischer Reihenfolge (bei gleichem Etikett gewinnt der spätere,
    // also nähere Vorfahre).
    function uebergabenText(k) {
      const geliefert = new Map()
      for (const vorfahre of vorfahrenVon.get(k.eintrag.instanzId)) {
        const vk = knoten.get(vorfahre.instanzId)
        if (vk.lieferung == null) continue
        for (const etikett of vk.def.liefert)
          geliefert.set(etikett, { block: vk.def.name, text: vk.lieferung })
      }
      const eintraege = []
      // Optionale Bedarfe (z.B. Angriffsliste beim Bauer) werden mitgereicht,
      // wenn ein Vorfahre sie geliefert hat — verlangt werden sie nicht.
      for (const etikett of [...k.def.braucht, ...(k.def.brauchtOptional ?? [])]) {
        const lieferung = geliefert.get(etikett)
        if (lieferung)
          eintraege.push(texte.agentenUebergabe.eintrag(etikett, lieferung.block, lieferung.text))
      }
      if (eintraege.length === 0) return ''
      return texte.agentenUebergabe.ueberschrift + eintraege.join('')
    }

    // Startet alle Blöcke, deren Vorgänger fertig sind — unter der Regel:
    // beliebig viele nur-lesende gleichzeitig, höchstens ein schreibender.
    function bereiteStarten() {
      if (endZustand || lauf.sanft || lauf.hart) return
      for (const eintrag of kette) {
        const k = knoten.get(eintrag.instanzId)
        if (k.status !== 'offen') continue
        const vorgaenger = vorgaengerVon.get(eintrag.instanzId)
        if (!vorgaenger.every((id) => knoten.get(id).status === 'fertig')) continue
        if (!k.def.nurLesen) {
          const schreiberLaeuft = [...laufende.keys()].some((id) => !knoten.get(id).def.nurLesen)
          if (schreiberLaeuft) continue // pro Projekt schreibt nur ein Agent (SPEC §5)
        }
        k.status = 'laeuft'
        lauf.aktiveInstanzen.add(eintrag.instanzId)
        senden({ art: 'block', instanzId: eintrag.instanzId })
        tickern(
          texte.ticker.blockStartet(nummerVon.get(eintrag.instanzId), kette.length, k.def.name)
        )
        // Audit (BAUPLAN 25): volle Lesetiefe, bewusst teuer — die
        // Kosten-Folge steht sichtbar am Start im Ticker.
        if (k.def.audit) tickern(texte.ticker.auditKostenHinweis)
        // Zusammenführung sichtbar machen (BAUPLAN 13): dieser Block hat auf
        // mehrere Zweige gewartet.
        if (vorgaenger.length > 1)
          tickern(texte.ticker.zweigeZusammengefuehrt(k.def.name, vorgaenger.length))
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
        const frisch = kartenLaden(projektPfad)
        const vorhandene = new Set(frisch.ok ? frisch.karten.map((karte) => karte.id) : [])
        for (const anhang of pruefkartenVonInstanz.get(instanzId) ?? [])
          if (vorhandene.has(anhang.id)) pruefkartenArchivAuffrischen(projektPfad, anhang.id)
        const roh = pruefkarteAusErgebnis(ergebnisText)
        const zeitText = new Date().toLocaleString('de-DE', {
          dateStyle: 'short',
          timeStyle: 'short'
        })
        const angelegt = pruefkarteAnlegen(projektPfad, {
          titel: roh.titel ?? texte.pruefkarten.ersatzTitel(zeitText),
          text: roh.text ?? texte.pruefkarten.ersatzText
        })
        if (!angelegt.ok) return
        pruefungenArchivieren(projektPfad, angelegt.karte.id)
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
          block: k.def.name,
          zeit: jetztIso(),
          zustand: 'fehlgeschlagen',
          ergebnisText: String(ergebnis.fehlertext ?? '').slice(0, 4000),
          tokens: ergebnis.blockTokens ?? null,
          aufschluesselung: ergebnis.blockAufschluesselung ?? null,
          kostenUsd: ergebnis.blockKosten ?? null
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

      // Abschlusstext als Lieferung für die Nachfahren ablegen und für die
      // Karten-Anzeige merken.
      const abschlusstext = String(ergebnis.ergebnisText ?? '')
      k.lieferung = gekuerzt(abschlusstext)
      const blockErgebnis = {
        instanzId: id,
        block: k.def.name,
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
        kostenUsd: ergebnis.blockKosten ?? null
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
        if (!startanleitungNachgefordert && !lauf.sanft && !lauf.hart && !endZustand) {
          startanleitungNachgefordert = true
          k.startanleitungNachforderung = true
          k.status = 'offen'
          tickern(texte.ticker.startanleitungNachgefordert(k.def.name))
          return
        }
        tickern(texte.ticker.startanleitungWeiterOhne)
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
            bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
            bericht.lokaleHelfer.reparaturenGehalten =
              (bericht.lokaleHelfer.reparaturenGehalten ?? 0) + 1
            tickern(texte.ticker.lokaleReparaturGehalten)
          }
          tickern(texte.ticker.pruefungBestanden)
          pruefkarteNachBestandenerPruefung(id, ergebnis.ergebnisText)
        } else {
          tickern(bestanden === false ? texte.ticker.pruefungNichtBestanden : texte.ticker.pruefungOhneErgebnis)
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
                ? prueferKritik(ergebnis.ergebnisText)
                : null
            if (!k.lokaleKritik) tickern(texte.ticker.lokaleReparaturNichtMechanisch(zielK.def.name))
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
              bericht.lokaleHelfer ??= { recherchen: 0, schritte: 0, gescheitert: 0 }
              bericht.lokaleHelfer.reparaturen = (bericht.lokaleHelfer.reparaturen ?? 0) + 1
              bericht.lokaleHelfer.schritte += reparatur.schritte ?? 0
              if (reparatur.ok && reparatur.ersetzungen > 0) {
                // Die Nachprüfung des Prüfers ist der Schiedsrichter: nur die
                // Beanstandungen, als frischer Agent in der Lauf-Session.
                tickern(texte.ticker.lokaleReparaturFertig(reparatur.ersetzungen))
                k.nachpruefung = k.lokaleKritik
                k.lokaleNachpruefung = true
                k.status = 'offen'
                return
              }
              // Nichts ersetzt (oder Ollama gescheitert): nichts zurückzurollen
              // und keine Nachprüfung nötig — der Versuch ist trotzdem verbraucht.
              tickern(
                reparatur.ok
                  ? texte.ticker.lokaleReparaturNichtsErsetzt
                  : texte.ticker.lokaleReparaturGescheitert(reparatur.fehler)
              )
            }
            // Budget aufgebraucht: der Motor-Bauer übernimmt mit der
            // Original-Kritik. Der Zähler gilt je Rückführung — bei der
            // nächsten frischen Beanstandung darf die lokale KI wieder ran.
            tickern(texte.ticker.lokaleReparaturOpusUebernimmt(zielK.def.name))
            eskalationsKritik = eskalationsKritik ?? k.lokaleKritik
            k.lokaleVersuche = 0
            k.lokaleKritik = null
          }

          const kritik = eskalationsKritik ?? prueferKritik(ergebnis.ergebnisText)
          if (rundenUebrig > 0 && zielId && !lauf.sanft && !lauf.hart && !endZustand) {
            rundenUebrig--
            const genutzt = workflow.reparaturRunden - rundenUebrig
            // Erneut laufen alle Blöcke auf den Wegen vom Ziel zum Prüfer —
            // parallele Zweige außerhalb behalten ihr Ergebnis.
            for (const nochmalId of zwischenBloecke(workflow.bloecke, workflow.pfeile, zielId, id)) {
              const nk = knoten.get(nochmalId)
              if (nk.status === 'fertig') nk.status = 'offen'
            }
            knoten.get(zielId).rueckmeldung = kritik
            // Der Prüfer selbst prüft in der nächsten Runde nur seine
            // Beanstandungen nach — keine erneute Vollprüfung.
            k.nachpruefung = kritik
            const zielName = knoten.get(zielId).def.name
            tickern(texte.ticker.rueckfuehrung(zielName, genutzt, workflow.reparaturRunden))
            return
          }
          const wahl = await entscheidungStellen(k.def.name, workflow.reparaturRunden)
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
          texte.sicherungen.beschriftungNachBlock(k.def.name)
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
  const geladen = workflowLaden(projektPfad)
  if (geladen.ok) {
    const eintrag = geladen.workflow.bloecke.find((block) => block.instanzId === naechsteId)
    if (eintrag) blockName = blockDefinition(eintrag.blockId)?.name ?? ''
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
  return laufStarten(fenster, projektPfad, stand.kartenIds, stand, ausWarteschlange)
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
    gespraech: lauf.gespraech
  }
}
