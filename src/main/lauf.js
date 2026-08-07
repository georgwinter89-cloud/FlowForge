// Lauf-Verwaltung: führt die Workflow-Kette eines Projekts Block für Block über
// die Motor-Schnittstelle aus, reicht Ereignisse an die Oberfläche weiter und
// legt Laufberichte ab (SPEC §3.2, §4, §6).
//
// Fehlschlag-Rückführung (SPEC §4.1): Meldet ein Prüfer-Block „nicht bestanden",
// springt der Lauf zurück zu Block X (Standard: der Block davor) — so oft, wie
// Reparatur-Runden eingestellt sind. Danach hält der Lauf an und stellt die
// Folgen-Frage: weitermachen, zurückstellen oder Stand wiederherstellen.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Notification } from 'electron'
import { texte } from '../shared/texte.js'
import { blockDefinition } from '../shared/blockKatalog.js'
import {
  pruefeKette,
  pruefeSchaubild,
  schaubildReihenfolge,
  pruefePflichtfelder,
  auftragMitFeldern,
  rueckfuehrungsZiel
} from '../shared/kettenRegeln.js'
import { einstellungenLaden, ABO_MODUS_ERLAUBT } from './einstellungen.js'
import { kartenLaden } from './projekte.js'
import { starteMotorLauf } from './motor/claudeCodeMotor.js'
import { kartenZeile } from './motor/kartenWerkzeuge.js'
import {
  sicherungspunktAnlegen,
  aufLetztenPunktZuruecksetzen,
  wiederherstellen
} from './sicherungspunkte.js'
import { workflowLaden } from './workflow.js'

const BERICHTE_ORDNER = 'laufberichte'

// V1 Schritt 5: höchstens ein Lauf gleichzeitig. Parallelität kommt in Schritt 11.
let aktiverLauf = null

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
// Abschlusstext — Folgeblöcke mit passendem „braucht" bekommen ihn in den
// Auftrag. Gekürzt, damit ein ausufernder Abschlusstext den Kontext des
// nächsten Blocks nicht flutet.
const LIEFERUNG_MAX = 8000

function uebergabenText(def, lieferungen) {
  const eintraege = []
  // Optionale Bedarfe (z.B. Angriffsliste beim Bauer) werden mitgereicht,
  // wenn ein Block davor sie geliefert hat — verlangt werden sie nicht.
  for (const etikett of [...def.braucht, ...(def.brauchtOptional ?? [])]) {
    const lieferung = lieferungen.get(etikett)
    if (lieferung)
      eintraege.push(texte.agentenUebergabe.eintrag(etikett, lieferung.block, lieferung.text))
  }
  if (eintraege.length === 0) return ''
  return texte.agentenUebergabe.ueberschrift + eintraege.join('')
}

export async function laufStarten(fenster, projektPfad, kartenIds) {
  if (aktiverLauf) return { ok: false, fehler: texte.lauf.schonAktiv }
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
  // Reihenfolge aus dem Schaubild ableiten (SPEC §4.1): die Pfeile müssen alle
  // Karten zu genau einem durchgehenden Pfad verbinden.
  const schaubildFehler = pruefeSchaubild(workflow.bloecke, workflow.pfeile)
  if (schaubildFehler) return { ok: false, fehler: schaubildFehler }
  const geordnet = schaubildReihenfolge(workflow.bloecke, workflow.pfeile)
  if (geordnet.fehler) return { ok: false, fehler: geordnet.fehler }
  const kette = geordnet.reihenfolge
  // Beim Start streng: auch der erste Block muss versorgt sein.
  const ketteFehler = pruefeKette(kette)
  if (ketteFehler) return { ok: false, fehler: ketteFehler }
  // Sperren-Mechanik „Pflichtfeld leer = Lauf hält an" (SPEC §4.2).
  const feldFehler = pruefePflichtfelder(kette)
  if (feldFehler) return { ok: false, fehler: feldFehler }
  // Auftragsquelle „Feld oder offene Aufgaben-Karten" (Entscheidung Georg,
  // 07.08.2026): Sind Feld und Kartenauswahl leer, wüsste der Block nicht,
  // was gebaut werden soll — der Lauf startet gar nicht erst.
  for (const [kettenIndex, eintrag] of kette.entries()) {
    const def = blockDefinition(eintrag.blockId)
    for (const feld of def.felder) {
      if (!feld.oderOffeneAufgaben) continue
      if ((eintrag.feldWerte?.[feld.id] ?? '').trim()) continue
      // Ein früherer Block, der selbst Aufgaben-Karten erzeugt (Spec-Interview),
      // zählt als Auftragsquelle — bei „Neue App starten" gibt es beim Start
      // noch keine Karten, die Aufgaben entstehen erst im Lauf.
      if (
        kette
          .slice(0, kettenIndex)
          .some((e) => blockDefinition(e.blockId).erzeugtAufgaben)
      )
        continue
      const geladen = kartenLaden(projektPfad)
      const offene = geladen.ok
        ? geladen.karten.filter(
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

  // Projekt sofort belegen, damit ein Doppelklick auf „Starten" während der
  // Sicherung keinen zweiten Lauf startet.
  aktiverLauf = {
    projektPfad,
    motor: null,
    fragen: new Map(),
    entscheidungen: new Map(),
    menschFragen: new Map(),
    sanft: false,
    hart: false,
    aktuelleInstanzId: null,
    offeneFrage: null,
    offeneEntscheidung: null,
    offeneMenschFrage: null,
    // Gesprächsverlauf dieses Laufs (Fragen des Agenten + Antworten) — die
    // Ansicht stellt ihn nach einem Wechsel daraus wieder her.
    gespraech: []
  }
  const lauf = aktiverLauf

  // Sicherheitsnetz vor dem Lauf: der Stand von jetzt ist immer wiederholbar —
  // und die Folgen-Frage kann genau hierauf zurücksetzen.
  const namen = kette.map((b) => blockDefinition(b.blockId).name)
  const sicherung = await sicherungspunktAnlegen(
    projektPfad,
    texte.sicherungen.beschriftungVorLauf(namen[0])
  )
  if (!sicherung.ok) {
    aktiverLauf = null
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

  const gesamtVerbrauch = { tokens: 0, kostenUsd: null }

  function rechteFrageStellen(frage) {
    return new Promise((antworten) => {
      if (fenster.isDestroyed()) return antworten(false)
      const frageId = crypto.randomUUID()
      lauf.fragen.set(frageId, (erlaubt) => {
        lauf.fragen.delete(frageId)
        lauf.offeneFrage = null
        bericht.rechteFragen.push({ beschreibung: frage.beschreibung, erlaubt })
        senden({ art: 'frage-erledigt', frageId })
        antworten(erlaubt)
      })
      lauf.offeneFrage = { frageId, beschreibung: frage.beschreibung }
      senden({ art: 'frage', frageId, beschreibung: frage.beschreibung })
    })
  }

  // Frage an den Menschen (BAUPLAN 9, SPEC §6): pausiert den Lauf, bis die
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
        lauf.offeneMenschFrage = null
        if (antwortText != null) {
          bericht.gespraech.push({ block: blockName, frage, antwort: antwortText })
          lauf.gespraech.push({ frage, optionen, antwort: antwortText })
          tickern(texte.ticker.menschGeantwortet)
        }
        senden({ art: 'mensch-frage-erledigt', frageId, frage, antwort: antwortText })
        antworten(antwortText)
      })
      lauf.offeneMenschFrage = { frageId, frage, optionen }
      senden({ art: 'mensch-frage', frageId, frage, optionen })
    })
  }

  // Folgen-Frage nach verbrauchten Reparatur-Runden (SPEC §4.1).
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

  function blockAusfuehren(auftrag, def) {
    const motor = starteMotorLauf({
      projektPfad,
      auftrag,
      modus: einstellungen.motorModus,
      apiSchluessel: einstellungen.apiSchluessel,
      ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
      nurLesen: def.nurLesen,
      aufEreignis(e) {
        if (e.art === 'ticker') bericht.ticker.push({ zeit: jetztIso(), text: e.text })
        senden(e)
      },
      aufRechteFrage: rechteFrageStellen,
      aufMenschFrage: (daten) => menschFrageStellen(daten, def.name)
    })
    lauf.motor = motor
    return motor.fertig.catch((fehler) => ({
      zustand: 'fehlgeschlagen',
      fehlertext: String(fehler?.message ?? fehler),
      ergebnisText: '',
      verbrauch: null
    }))
  }

  // Die eigentliche Ketten-Schleife — läuft im Hintergrund weiter, laufStarten
  // kehrt sofort zurück.
  ;(async () => {
    let i = 0
    let rundenUebrig = workflow.reparaturRunden
    let rueckmeldung = ''
    let endZustand = null
    let fehlertext = ''
    // Übergaben dieses Laufs: liefert-Etikett → Abschlusstext des Blocks.
    // Läuft ein Block erneut (Reparatur-Runde), ersetzt er seine Lieferung.
    const lieferungen = new Map()

    while (i < kette.length && !endZustand) {
      // Harter Stopp zwischen zwei Blöcken (Motor war gerade fertig): der
      // nächste Block darf nicht mehr starten.
      if (lauf.hart) {
        const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad)
        if (zurueck.ok && zurueck.zurueckgesetzt) tickern(texte.ticker.zurueckgesetzt)
        endZustand = 'hart-abgebrochen'
        break
      }

      const eintrag = kette[i]
      const def = blockDefinition(eintrag.blockId)
      lauf.aktuelleInstanzId = eintrag.instanzId
      senden({ art: 'block', instanzId: eintrag.instanzId, index: i })
      tickern(texte.ticker.blockStartet(i + 1, kette.length, def.name))

      let auftrag =
        kartenKontext(projektPfad, ausgewaehlt) +
        uebergabenText(def, lieferungen) +
        texte.agentenUebergabe.auftragEinleitung +
        auftragMitFeldern(def, eintrag.feldWerte)
      if (rueckmeldung) {
        auftrag += texte.agentenUebergabe.prueferRueckmeldung(rueckmeldung)
        rueckmeldung = ''
      }

      const ergebnis = await blockAusfuehren(auftrag, def)
      lauf.motor = null
      if (ergebnis.verbrauch) {
        gesamtVerbrauch.tokens += ergebnis.verbrauch.tokens ?? 0
        if (ergebnis.verbrauch.kostenUsd != null)
          gesamtVerbrauch.kostenUsd = (gesamtVerbrauch.kostenUsd ?? 0) + ergebnis.verbrauch.kostenUsd
      }

      if (ergebnis.zustand === 'hart-abgebrochen') {
        const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad)
        if (zurueck.ok && zurueck.zurueckgesetzt) tickern(texte.ticker.zurueckgesetzt)
        endZustand = 'hart-abgebrochen'
        break
      }
      if (ergebnis.zustand === 'sanft-gestoppt') {
        endZustand = 'sanft-gestoppt'
        break
      }
      if (ergebnis.zustand === 'fehlgeschlagen') {
        bericht.blockErgebnisse.push({
          instanzId: eintrag.instanzId,
          block: def.name,
          zeit: jetztIso(),
          zustand: 'fehlgeschlagen',
          ergebnisText: String(ergebnis.fehlertext ?? '').slice(0, 4000)
        })
        endZustand = 'fehlgeschlagen'
        fehlertext = ergebnis.fehlertext
        break
      }

      // Block ist normal durchgelaufen: Abschlusstext als Lieferung für
      // Folgeblöcke ablegen und für die Karten-Anzeige merken.
      const abschlusstext = String(ergebnis.ergebnisText ?? '')
      for (const etikett of def.liefert)
        lieferungen.set(etikett, {
          block: def.name,
          text:
            abschlusstext.length > LIEFERUNG_MAX
              ? abschlusstext.slice(0, LIEFERUNG_MAX) + ' …'
              : abschlusstext
        })
      const blockErgebnis = {
        instanzId: eintrag.instanzId,
        block: def.name,
        zeit: jetztIso(),
        zustand: 'erfolgreich',
        ergebnisText: String(ergebnis.ergebnisText ?? '').slice(0, 4000)
      }
      bericht.blockErgebnisse.push(blockErgebnis)

      // Hat der Block Aufgaben-Karten erzeugt (Spec-Interview), gehören seine
      // neuen offenen Aufgaben ab jetzt zur Kartenauswahl des Laufs — die
      // Folgeblöcke arbeiten ja genau damit (festgenagelte Vorauswahl, SPEC §5).
      if (def.erzeugtAufgaben) {
        const frisch = kartenLaden(projektPfad)
        if (frisch.ok)
          for (const karte of frisch.karten)
            if (karte.sorte === 'aufgabe' && !karte.erledigt && !ausgewaehlt.includes(karte.id))
              ausgewaehlt.push(karte.id)
      }

      // Prüfer-Blöcke: Urteil auswerten, ggf. Fehlschlag-Rückführung.
      if (def.prueft) {
        const bestanden = pruefUrteil(ergebnis.ergebnisText)
        blockErgebnis.zustand = bestanden === true ? 'pruefung-bestanden' : 'pruefung-nicht-bestanden'
        if (bestanden === true) {
          tickern(texte.ticker.pruefungBestanden)
        } else {
          tickern(bestanden === false ? texte.ticker.pruefungNichtBestanden : texte.ticker.pruefungOhneErgebnis)
          const ziel = rueckfuehrungsZiel(kette, i)
          if (rundenUebrig > 0 && ziel !== null && !lauf.sanft && !lauf.hart) {
            rundenUebrig--
            const genutzt = workflow.reparaturRunden - rundenUebrig
            const zielName = blockDefinition(kette[ziel].blockId).name
            rueckmeldung = prueferKritik(ergebnis.ergebnisText)
            tickern(texte.ticker.rueckfuehrung(zielName, genutzt, workflow.reparaturRunden))
            i = ziel
            continue
          }
          const wahl = await entscheidungStellen(def.name, workflow.reparaturRunden)
          if (wahl === 'zurueckstellen') {
            tickern(texte.ticker.entscheidungZurueckgestellt)
            endZustand = 'zurueckgestellt'
            break
          }
          if (wahl === 'wiederherstellen') {
            tickern(texte.ticker.entscheidungWiederhergestellt)
            const zurueck = await wiederherstellen(projektPfad, punktVorLauf)
            if (zurueck.ok) tickern(texte.ticker.zurueckgesetzt)
            endZustand = 'wiederhergestellt'
            break
          }
          tickern(texte.ticker.entscheidungWeitermachen)
        }
      }

      // Block erfolgreich: Sicherungspunkt nach jedem gelungenen Block (SPEC §3.3).
      const punkt = await sicherungspunktAnlegen(
        projektPfad,
        texte.sicherungen.beschriftungNachBlock(def.name)
      )
      if (punkt.ok && punkt.neu) tickern(texte.ticker.sicherungspunktAngelegt)

      // Sanftes Anhalten: der laufende Block hat fertig gemacht — Halt am
      // Sicherungspunkt (SPEC §6).
      if (lauf.sanft) {
        endZustand = 'sanft-gestoppt'
        break
      }
      i++
    }

    if (!endZustand) endZustand = 'erfolgreich'

    // Offene Fragen auflösen, damit nichts ewig hängt.
    for (const antworten of [...lauf.fragen.values()]) antworten(false)
    for (const aufloesen of [...lauf.entscheidungen.values()]) aufloesen('zurueckstellen')
    for (const antworten of [...lauf.menschFragen.values()]) antworten(null)

    bericht.beendetAm = jetztIso()
    bericht.zustand = endZustand
    bericht.fehlertext = fehlertext
    bericht.verbrauch = { ...gesamtVerbrauch }
    try {
      berichtSpeichern(projektPfad, bericht)
    } catch {
      // Ein nicht speicherbarer Bericht darf das Laufende nicht verschlucken.
    }
    aktiverLauf = null
    senden({
      art: 'fertig',
      zustand: bericht.zustand,
      fehlertext: bericht.fehlertext,
      bericht
    })
  })()

  senden({ art: 'zustand', zustand: 'laeuft' })
  return { ok: true }
}

export function laufSanftStoppen(projektPfad) {
  if (!aktiverLauf || aktiverLauf.projektPfad !== projektPfad)
    return { ok: false, fehler: texte.fehler.unbekannt }
  if (!aktiverLauf.sanft && !aktiverLauf.hart) {
    aktiverLauf.sanft = true
    aktiverLauf.tickern?.(texte.ticker.sanftAngefordert)
  }
  return { ok: true }
}

export function laufHartStoppen(projektPfad) {
  if (!aktiverLauf || aktiverLauf.projektPfad !== projektPfad)
    return { ok: false, fehler: texte.fehler.unbekannt }
  aktiverLauf.hart = true
  // Eine offene Mensch-Frage würde den Werkzeug-Aufruf im FlowForge-Prozess
  // ewig hängen lassen — sofort auflösen.
  for (const antworten of [...aktiverLauf.menschFragen.values()]) antworten(null)
  if (aktiverLauf.motor) aktiverLauf.motor.hartStoppen()
  else aktiverLauf.tickern?.(texte.ticker.hartAbgebrochen)
  return { ok: true }
}

export function laufFrageAntworten(frageId, erlaubt) {
  const antworten = aktiverLauf?.fragen.get(frageId)
  if (!antworten) return { ok: false, fehler: texte.fehler.unbekannt }
  antworten(Boolean(erlaubt))
  return { ok: true }
}

export function laufMenschAntworten(frageId, antwortText) {
  const antworten = aktiverLauf?.menschFragen.get(frageId)
  if (!antworten) return { ok: false, fehler: texte.fehler.unbekannt }
  const text = String(antwortText ?? '').trim()
  if (!text) return { ok: false, fehler: texte.fehler.unbekannt }
  antworten(text)
  return { ok: true }
}

export function laufEntscheidungAntworten(frageId, wahl) {
  const aufloesen = aktiverLauf?.entscheidungen.get(frageId)
  if (!aufloesen) return { ok: false, fehler: texte.fehler.unbekannt }
  if (!['weitermachen', 'zurueckstellen', 'wiederherstellen'].includes(wahl))
    return { ok: false, fehler: texte.fehler.unbekannt }
  aufloesen(wahl)
  return { ok: true }
}

// Für die Oberfläche: Läuft in diesem Projekt gerade etwas — und wo steht es?
// Offene Fragen kommen mit, damit die Ansicht sie nach einem Wechsel zur
// Projektübersicht und zurück wieder anzeigen kann.
export function laufZustand(projektPfad) {
  const aktiv = Boolean(aktiverLauf && aktiverLauf.projektPfad === projektPfad)
  if (!aktiv) return { ok: true, aktiv: false }
  return {
    ok: true,
    aktiv: true,
    blockInstanzId: aktiverLauf.aktuelleInstanzId,
    frage: aktiverLauf.offeneFrage,
    entscheidung: aktiverLauf.offeneEntscheidung,
    menschFrage: aktiverLauf.offeneMenschFrage,
    gespraech: aktiverLauf.gespraech
  }
}
