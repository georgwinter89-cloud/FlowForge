// Workflow-Verwaltung (SPEC §4): pro Projekt eine gerade Kette von Blöcken,
// gespeichert als workflow.json im Projektordner. Die harten Regeln
// (braucht/liefert, Pflichtfelder) setzt kettenRegeln.js durch.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import {
  blockDefinition,
  REPARATUR_RUNDEN_STANDARD,
  REPARATUR_RUNDEN_MAX
} from '../shared/blockKatalog.js'
import { pruefeKette } from '../shared/kettenRegeln.js'

const WORKFLOW_DATEI = 'workflow.json'

function leererWorkflow() {
  return { reparaturRunden: REPARATUR_RUNDEN_STANDARD, bloecke: [] }
}

// Nur Bekanntes übernehmen — die Datei liegt im Projektordner und könnte
// von außen verändert worden sein.
function bereinigen(roh) {
  const sauber = leererWorkflow()
  const runden = Number(roh?.reparaturRunden)
  if (Number.isInteger(runden) && runden >= 0 && runden <= REPARATUR_RUNDEN_MAX)
    sauber.reparaturRunden = runden
  if (!Array.isArray(roh?.bloecke)) return sauber
  for (const eintrag of roh.bloecke) {
    const def = blockDefinition(eintrag?.blockId)
    if (!def) continue
    const feldWerte = {}
    for (const feld of def.felder) {
      const wert = eintrag?.feldWerte?.[feld.id]
      if (typeof wert === 'string') feldWerte[feld.id] = wert
    }
    sauber.bloecke.push({
      instanzId: typeof eintrag?.instanzId === 'string' ? eintrag.instanzId : crypto.randomUUID(),
      blockId: def.id,
      feldWerte,
      zurueckZu: typeof eintrag?.zurueckZu === 'string' ? eintrag.zurueckZu : null
    })
  }
  return sauber
}

export function workflowLaden(projektPfad) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  try {
    const roh = JSON.parse(fs.readFileSync(path.join(projektPfad, WORKFLOW_DATEI), 'utf8'))
    return { ok: true, workflow: bereinigen(roh) }
  } catch {
    // Keine oder kaputte Datei: leere Kette — der nächste Speichervorgang heilt das.
    return { ok: true, workflow: leererWorkflow() }
  }
}

export function workflowSpeichern(projektPfad, roh) {
  if (!fs.existsSync(projektPfad)) return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const workflow = bereinigen(roh)
  // braucht/liefert-Prüfung beim Zusammenstecken — eine unpassende Kette wird
  // gar nicht erst gespeichert (die Oberfläche zeigt denselben Fehler sofort an).
  const fehler = pruefeKette(workflow.bloecke)
  if (fehler) return { ok: false, fehler }
  const datei = path.join(projektPfad, WORKFLOW_DATEI)
  const tmp = datei + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(workflow, null, 2), 'utf8')
  fs.renameSync(tmp, datei)
  return { ok: true, workflow }
}
