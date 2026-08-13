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
import { kartenLaden, kontingentVerhaltenLaden } from './projekte.js'
import { starteMotorLauf } from './motor/claudeCodeMotor.js'
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
            lauf.offeneEntscheidung)
      ),
      wartet: warteschlange.some((eintrag) => eintrag.projektPfad === pfad),
      letzterLauf: letzterBericht(pfad)
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

  // Projekt sofort belegen, damit ein Doppelklick auf „Starten" während der
  // Sicherung keinen zweiten Lauf startet.
  const lauf = {
    projektPfad,
    // Bei parallelen Zweigen laufen mehrere Motoren gleichzeitig —
    // „Sofort abbrechen" muss jeden einzelnen töten.
    motoren: new Map(), // instanzId → Motor
    aktiveInstanzen: new Set(),
    fragen: new Map(),
    entscheidungen: new Map(),
    menschFragen: new Map(),
    sanft: false,
    hart: false,
    // Offene Dialoge als Warteschlangen: Zwei parallele Blöcke können
    // gleichzeitig fragen — die Ansicht zeigt eine Frage nach der anderen.
    offeneFragen: [],
    offeneMenschFragen: [],
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

  const gesamtVerbrauch = { tokens: 0, kostenUsd: null }
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

  // Lauf-Start sofort melden — noch vor der ersten Ticker-Zeile, damit die
  // Ansicht die Anzeige des vorigen Laufs sauber leeren kann.
  senden({ art: 'zustand', zustand: 'laeuft' })
  if (pruefmappeGeleert) tickern(texte.ticker.pruefmappeGeleert)
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
          // Session-Fortsetzung bei Wiederholungen (BAUPLAN 16): Kennung und
          // Füllstand der letzten Motor-Session dieses Blocks — läuft er mit
          // einem Zusatz erneut, setzt er seine EIGENE Session fort.
          sessionKennung: null,
          sessionTokens: 0
        }
      ])
    )
    const nummerVon = new Map(kettenIds.map((id, idx) => [id, idx + 1]))
    const vorgaengerVon = new Map(kettenIds.map((id) => [id, []]))
    for (const pfeil of workflow.pfeile) vorgaengerVon.get(pfeil.nach)?.push(pfeil.von)
    const vorfahrenVon = new Map(
      kettenIds.map((id) => [id, vorfahrenSortiert(workflow.bloecke, workflow.pfeile, id)])
    )

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
        // Session-Kennungen wandern mit in den Laufstand (BAUPLAN 16) — nach
        // einem App-Neustart kann eine Wiederholung trotzdem fortsetzen.
        sitzungen: kettenIds
          .filter((id) => knoten.get(id).sessionKennung)
          .map((id) => [
            id,
            { kennung: knoten.get(id).sessionKennung, tokens: knoten.get(id).sessionTokens }
          ]),
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
      for (const [id, s] of Array.isArray(fortsetzung.sitzungen) ? fortsetzung.sitzungen : [])
        if (knoten.has(id) && typeof s?.kennung === 'string' && s.kennung) {
          knoten.get(id).sessionKennung = s.kennung
          knoten.get(id).sessionTokens = Number(s.tokens) || 0
        }
      if (Number.isInteger(fortsetzung.rundenUebrig)) rundenUebrig = fortsetzung.rundenUebrig
      if (Number.isInteger(fortsetzung.uebertraege)) uebertraege = fortsetzung.uebertraege
      startanleitungNachgefordert = Boolean(fortsetzung.startanleitungNachgefordert)
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

    // Ein Motor-Durchlauf eines Blocks. Ticker-Zeilen bekommen den Blocknamen
    // vorangestellt, sobald mehrere Motoren gleichzeitig laufen — sonst wäre
    // der Liveticker nicht zuzuordnen.
    function blockAusfuehren(k, auftrag, uebertragErlaubt, fortsetzen = null) {
      const instanzId = k.eintrag.instanzId
      const motor = starteMotorLauf({
        projektPfad,
        auftrag,
        modus: einstellungen.motorModus,
        apiSchluessel: einstellungen.apiSchluessel,
        ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
        nurLesen: k.def.nurLesen,
        // Session-Fortsetzung bei Wiederholungen (BAUPLAN 16): der Block setzt
        // seine eigene frühere Session fort statt kalt zu starten.
        fortsetzen,
        // Nur Prüf-Blöcke dürfen die Prüfmappe verändern (Entscheidung Georg,
        // 12.08.2026) — der Bauer weicht sonst Prüfungen auf, statt zu reparieren.
        darfPruefen: Boolean(k.def.prueft),
        // Automatischer Übertrag (SPEC §5): läuft der Kontext voll, übergibt der
        // Agent an eine frische Session — sofern die Übertragsgrenze es erlaubt.
        uebertrag: {
          aktiv: uebertragErlaubt,
          testModus: Boolean(einstellungen.uebertragTest),
          anweisung: texte.agentenUebergabe.uebertragAnweisung(k.def.nurLesen)
        },
        ...(bekanntesKontextFenster > 0 ? { kontextFenster: bekanntesKontextFenster } : {}),
        aufEreignis(e) {
          const daten =
            e.art === 'ticker' && lauf.motoren.size > 1
              ? { ...e, text: `${k.def.name}: ${e.text}` }
              : e
          if (daten.art === 'ticker') bericht.ticker.push({ zeit: jetztIso(), text: daten.text })
          senden({ instanzId, ...daten })
        },
        aufRechteFrage: rechteFrageStellen,
        aufMenschFrage: (daten) => menschFrageStellen(daten, k.def.name)
      })
      lauf.motoren.set(instanzId, motor)
      return motor.fertig
        .catch((fehler) => ({
          zustand: 'fehlgeschlagen',
          fehlertext: String(fehler?.message ?? fehler),
          fehlerArt: null,
          ergebnisText: '',
          verbrauch: null
        }))
        .finally(() => lauf.motoren.delete(instanzId))
    }

    // Führt einen Block vollständig aus: Auftrag bauen, Motor laufen lassen,
    // Überträge und Kontingent-/Server-Pausen durchstehen — bis ein endgültiges
    // Ergebnis da ist. Läuft für parallele Blöcke gleichzeitig.
    async function knotenAusfuehren(k) {
      // Verbrauch aller Sessions dieses Block-Anlaufs (auch über Überträge und
      // Pausen hinweg) — landet sichtbar am Block-Ergebnis im Laufbericht.
      let blockTokens = 0
      let fortgesetztImLauf = false
      while (true) {
        standSpeichern()
        // Session-Fortsetzung bei Wiederholungen (BAUPLAN 16): Läuft derselbe
        // Block nur wegen eines Zusatzes erneut (Prüferkritik, Nachprüfung,
        // Startanleitungs-Nachforderung), setzt er seine eigene frühere Session
        // fort — er kennt seine Arbeit noch, nur der Zusatz wird nachgereicht.
        // Nicht bei Übertrags-Fortsetzungen: deren alte Session ist voll.
        const zusatzFall =
          Boolean(k.rueckmeldung || k.nachpruefung || k.startanleitungNachforderung) &&
          !k.uebergabe &&
          !k.uebergabeVerloren
        let fortsetzen = null
        if (zusatzFall && k.sessionKennung) {
          // Füllstands-Wächter: nahe der Übertrags-Schwelle lohnt Fortsetzen
          // nicht — die Wiederholung liefe sofort in den Übertrag. Dann Kaltstart.
          const fenster =
            bekanntesKontextFenster > 0 ? bekanntesKontextFenster : KONTEXT_FENSTER_STANDARD
          if ((k.sessionTokens / fenster) * 100 < FORTSETZUNG_WAECHTER_PROZENT)
            fortsetzen = k.sessionKennung
        }

        // Rückmeldung, Nachforderung und Übergabe bleiben am Knoten, bis der
        // Block wirklich fertig ist — kommt er per Übertrag oder Pause erneut
        // dran, gehören sie wieder in den Auftrag.
        let auftrag
        if (fortsetzen) {
          // Nur der Zusatz: Karten-Kontext, Übergaben und Arbeitsauftrag
          // stehen schon in der fortgesetzten Session.
          auftrag = ''
          if (k.rueckmeldung) auftrag += texte.agentenFortsetzung.rueckmeldung(k.rueckmeldung)
          if (k.nachpruefung) auftrag += texte.agentenFortsetzung.nachpruefung(k.nachpruefung)
          if (k.startanleitungNachforderung) auftrag += texte.agentenFortsetzung.startanleitung
          tickern(texte.ticker.sessionFortgesetzt(k.def.name))
        } else {
          auftrag =
            kartenKontext(projektPfad, ausgewaehlt) +
            uebergabenText(k) +
            texte.agentenUebergabe.auftragEinleitung +
            auftragMitFeldern(k.def, k.eintrag.feldWerte)
          if (k.rueckmeldung) auftrag += texte.agentenUebergabe.prueferRueckmeldung(k.rueckmeldung)
          if (k.nachpruefung) auftrag += texte.agentenUebergabe.prueferNachpruefung(k.nachpruefung)
          if (k.startanleitungNachforderung)
            auftrag += texte.agentenUebergabe.startanleitungNachforderung
          if (k.uebergabe) auftrag += texte.agentenUebergabe.uebertragFortsetzung(k.uebergabe)
          else if (k.uebergabeVerloren) auftrag += texte.agentenUebergabe.uebertragOhneUebergabe
        }

        const uebertragErlaubt =
          workflow.uebertragGrenze == null || uebertraege < workflow.uebertragGrenze
        const ergebnis = await blockAusfuehren(k, auftrag, uebertragErlaubt, fortsetzen)
        if (ergebnis.verbrauch) {
          // Bei einer fortgesetzten Session steckt der alte Kontext schon in der
          // Messung — gezählt wird ehrlich nur der Zuwachs gegenüber dem alten
          // Session-Ende, sonst sähe die billige Reparatur-Runde teuer aus.
          // Unteraufgaben (BAUPLAN 17) zählen ehrlich mit — sie sind Verbrauch,
          // auch wenn sie den Füllstand der Hauptsession nicht belasten.
          const zaehlTokens =
            (fortsetzen
              ? Math.max(0, (ergebnis.verbrauch.tokens ?? 0) - k.sessionTokens)
              : ergebnis.verbrauch.tokens ?? 0) + (ergebnis.verbrauch.unterTokens ?? 0)
          gesamtVerbrauch.tokens += zaehlTokens
          blockTokens += zaehlTokens
          if (ergebnis.verbrauch.kostenUsd != null)
            gesamtVerbrauch.kostenUsd = (gesamtVerbrauch.kostenUsd ?? 0) + ergebnis.verbrauch.kostenUsd
          if (ergebnis.verbrauch.kontextFenster > 0)
            bekanntesKontextFenster = ergebnis.verbrauch.kontextFenster
        }
        // Kennung und Füllstand der letzten Session dieses Blocks merken —
        // damit kann eine spätere Wiederholung genau diese Session fortsetzen.
        if (ergebnis.sessionKennung && (ergebnis.verbrauch?.tokens ?? 0) > 0) {
          k.sessionKennung = ergebnis.sessionKennung
          k.sessionTokens = ergebnis.verbrauch.tokens
        }
        if (fortsetzen && ergebnis.zustand !== 'fortsetzung-gescheitert') fortgesetztImLauf = true

        // Fortsetzen hat nicht geklappt (Kennung ungültig, Session weg) —
        // stiller Rückfall auf den Kaltstart, ehrlich im Ticker vermerkt.
        if (ergebnis.zustand === 'fortsetzung-gescheitert') {
          k.sessionKennung = null
          k.sessionTokens = 0
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
            return { ...ergebnis, blockTokens, fortgesetztImLauf }
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
              return { ...ergebnis, zustand: 'hart-abgebrochen', blockTokens, fortgesetztImLauf }
            if (lauf.sanft)
              return { ...ergebnis, zustand: 'sanft-gestoppt', blockTokens, fortgesetztImLauf }
            tickern(texte.ticker.kontingentVersuch)
            continue
          }
        }
        return { ...ergebnis, blockTokens, fortgesetztImLauf }
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
          sessionFortgesetzt: Boolean(ergebnis.fortgesetztImLauf)
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
        // Verbrauch dieses Anlaufs (BAUPLAN 16): So sieht Georg im Laufbericht,
        // dass eine fortgesetzte Reparatur-Runde deutlich weniger kostet.
        tokens: ergebnis.blockTokens ?? null,
        sessionFortgesetzt: Boolean(ergebnis.fortgesetztImLauf)
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
          tickern(texte.ticker.pruefungBestanden)
        } else {
          tickern(bestanden === false ? texte.ticker.pruefungNichtBestanden : texte.ticker.pruefungOhneErgebnis)
          const zielId = rueckfuehrungsZiel(workflow.bloecke, workflow.pfeile, id)
          if (rundenUebrig > 0 && zielId && !lauf.sanft && !lauf.hart && !endZustand) {
            rundenUebrig--
            const genutzt = workflow.reparaturRunden - rundenUebrig
            // Erneut laufen alle Blöcke auf den Wegen vom Ziel zum Prüfer —
            // parallele Zweige außerhalb behalten ihr Ergebnis.
            for (const nochmalId of zwischenBloecke(workflow.bloecke, workflow.pfeile, zielId, id)) {
              const nk = knoten.get(nochmalId)
              if (nk.status === 'fertig') nk.status = 'offen'
            }
            knoten.get(zielId).rueckmeldung = prueferKritik(ergebnis.ergebnisText)
            // Der Prüfer selbst prüft in der nächsten Runde nur seine
            // Beanstandungen nach — keine erneute Vollprüfung.
            k.nachpruefung = prueferKritik(ergebnis.ergebnisText)
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
  // Eine offene Mensch-Frage würde den Werkzeug-Aufruf im FlowForge-Prozess
  // ewig hängen lassen — sofort auflösen.
  for (const antworten of [...lauf.menschFragen.values()]) antworten(null)
  // Bei parallelen Zweigen laufen mehrere Motoren — alle sofort töten.
  if (lauf.motoren.size > 0)
    for (const motor of [...lauf.motoren.values()]) motor.hartStoppen()
  else lauf.tickern?.(texte.ticker.hartAbgebrochen)
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
    gespraech: lauf.gespraech
  }
}
