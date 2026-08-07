// Workflow-Verwaltung (SPEC §4.1): pro Projekt ein Schaubild aus frei platzierten
// Block-Karten und Pfeilen, gespeichert als workflow.json im Projektordner.
// Die Pfeile bestimmen die Reihenfolge; die harten Regeln (Ein-Pfad,
// braucht/liefert, Pflichtfelder) setzt kettenRegeln.js durch.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import {
  blockDefinition,
  REPARATUR_RUNDEN_STANDARD,
  REPARATUR_RUNDEN_MAX
} from '../shared/blockKatalog.js'
import { pruefeSchaubild } from '../shared/kettenRegeln.js'

const WORKFLOW_DATEI = 'workflow.json'

function leererWorkflow() {
  return { reparaturRunden: REPARATUR_RUNDEN_STANDARD, bloecke: [], pfeile: [] }
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
    const x = Number(eintrag?.position?.x)
    const y = Number(eintrag?.position?.y)
    sauber.bloecke.push({
      instanzId: typeof eintrag?.instanzId === 'string' ? eintrag.instanzId : crypto.randomUUID(),
      blockId: def.id,
      feldWerte,
      zurueckZu: typeof eintrag?.zurueckZu === 'string' ? eintrag.zurueckZu : null,
      position:
        Number.isFinite(x) && Number.isFinite(y)
          ? { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) }
          : // Ohne gespeicherte Position: untereinander stapeln.
            { x: 40, y: 40 + sauber.bloecke.length * 260 }
    })
  }
  const ids = new Set(sauber.bloecke.map((b) => b.instanzId))
  if (!Array.isArray(roh?.pfeile)) {
    // Altes Format (gerade Kette, Bauschritt 5): die Listen-Reihenfolge wird zu Pfeilen.
    for (let i = 1; i < sauber.bloecke.length; i++)
      sauber.pfeile.push({ von: sauber.bloecke[i - 1].instanzId, nach: sauber.bloecke[i].instanzId })
  } else {
    const gesehen = new Set()
    for (const pfeil of roh.pfeile) {
      if (typeof pfeil?.von !== 'string' || typeof pfeil?.nach !== 'string') continue
      if (!ids.has(pfeil.von) || !ids.has(pfeil.nach) || pfeil.von === pfeil.nach) continue
      const schluessel = pfeil.von + '→' + pfeil.nach
      if (gesehen.has(schluessel)) continue
      gesehen.add(schluessel)
      sauber.pfeile.push({ von: pfeil.von, nach: pfeil.nach })
    }
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
  // Schaubild-Regeln beim Verbinden (Ein-Pfad, Kreise, braucht/liefert entlang
  // der Pfeile) — ein unpassendes Schaubild wird gar nicht erst gespeichert
  // (die Oberfläche zeigt denselben Fehler sofort an).
  const fehler = pruefeSchaubild(workflow.bloecke, workflow.pfeile)
  if (fehler) return { ok: false, fehler }
  const datei = path.join(projektPfad, WORKFLOW_DATEI)
  const tmp = datei + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(workflow, null, 2), 'utf8')
  fs.renameSync(tmp, datei)
  return { ok: true, workflow }
}
