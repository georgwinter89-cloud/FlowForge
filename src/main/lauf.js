// Lauf-Verwaltung: startet Workflow-Läufe über die Motor-Schnittstelle, reicht
// Ereignisse an die Oberfläche weiter und legt Laufberichte ab (SPEC §3.2, §6).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import { UEBUNGS_WORKFLOWS } from '../shared/uebungsWorkflows.js'
import { einstellungenLaden, ABO_MODUS_ERLAUBT } from './einstellungen.js'
import { starteMotorLauf } from './motor/claudeCodeMotor.js'

const BERICHTE_ORDNER = 'laufberichte'

// V1 Schritt 3: höchstens ein Lauf gleichzeitig. Parallelität kommt in Schritt 11.
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

export function laufStarten(fenster, projektPfad, workflowId) {
  if (aktiverLauf) return { ok: false, fehler: texte.lauf.schonAktiv }
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const workflow = UEBUNGS_WORKFLOWS.find((w) => w.id === workflowId)
  if (!workflow) return { ok: false, fehler: texte.lauf.workflowUnbekannt }

  const { einstellungen } = einstellungenLaden()
  if (einstellungen.motorModus === 'abo' && !ABO_MODUS_ERLAUBT)
    return { ok: false, fehler: texte.lauf.aboNichtErlaubt }
  if (einstellungen.motorModus === 'api' && !einstellungen.apiSchluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }

  const bericht = {
    id: crypto.randomUUID(),
    workflow: workflow.name,
    block: workflow.block.name,
    modus: einstellungen.motorModus,
    gestartetAm: jetztIso(),
    beendetAm: null,
    zustand: 'laeuft',
    fehlertext: '',
    verbrauch: null,
    rechteFragen: [],
    ticker: []
  }

  function senden(ereignis) {
    if (!fenster.isDestroyed())
      fenster.webContents.send('lauf-ereignis', { projektPfad, ...ereignis })
  }

  const fragen = new Map()

  const motor = starteMotorLauf({
    projektPfad,
    auftrag: workflow.block.auftrag,
    modus: einstellungen.motorModus,
    apiSchluessel: einstellungen.apiSchluessel,
    ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
    aufEreignis(e) {
      if (e.art === 'ticker') bericht.ticker.push({ zeit: jetztIso(), text: e.text })
      if (e.art === 'verbrauch') bericht.verbrauch = e.verbrauch
      senden(e)
    },
    aufRechteFrage(frage) {
      return new Promise((antworten) => {
        if (fenster.isDestroyed()) return antworten(false)
        const frageId = crypto.randomUUID()
        fragen.set(frageId, (erlaubt) => {
          fragen.delete(frageId)
          bericht.rechteFragen.push({ beschreibung: frage.beschreibung, erlaubt })
          senden({ art: 'frage-erledigt', frageId })
          antworten(erlaubt)
        })
        senden({ art: 'frage', frageId, beschreibung: frage.beschreibung })
      })
    }
  })

  aktiverLauf = { projektPfad, motor, fragen }

  motor.fertig
    .catch((fehler) => ({
      zustand: 'fehlgeschlagen',
      fehlertext: String(fehler?.message ?? fehler),
      verbrauch: bericht.verbrauch
    }))
    .then((ergebnis) => {
      // Offene Fragen auflösen, damit nichts ewig hängt.
      for (const antworten of [...fragen.values()]) antworten(false)
      bericht.beendetAm = jetztIso()
      bericht.zustand = ergebnis.zustand
      bericht.fehlertext = ergebnis.fehlertext ?? ''
      bericht.verbrauch = ergebnis.verbrauch ?? bericht.verbrauch
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
    })

  senden({ art: 'zustand', zustand: 'laeuft', workflowId, blockName: workflow.block.name })
  return { ok: true, workflowId, blockName: workflow.block.name }
}

export function laufSanftStoppen(projektPfad) {
  if (!aktiverLauf || aktiverLauf.projektPfad !== projektPfad)
    return { ok: false, fehler: texte.fehler.unbekannt }
  aktiverLauf.motor.sanftStoppen()
  return { ok: true }
}

export function laufHartStoppen(projektPfad) {
  if (!aktiverLauf || aktiverLauf.projektPfad !== projektPfad)
    return { ok: false, fehler: texte.fehler.unbekannt }
  aktiverLauf.motor.hartStoppen()
  return { ok: true }
}

export function laufFrageAntworten(frageId, erlaubt) {
  const antworten = aktiverLauf?.fragen.get(frageId)
  if (!antworten) return { ok: false, fehler: texte.fehler.unbekannt }
  antworten(Boolean(erlaubt))
  return { ok: true }
}

// Für die Oberfläche: Läuft in diesem Projekt gerade etwas?
export function laufZustand(projektPfad) {
  return { ok: true, aktiv: Boolean(aktiverLauf && aktiverLauf.projektPfad === projektPfad) }
}
