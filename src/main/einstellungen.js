// Globale Einstellungen (Motor-Modus, API-Schlüssel, Ausgaben-Obergrenze).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { texte } from '../shared/texte.js'

// Fest verdrahtete Regel (SPEC §2): Abo-Login nur für den privaten Eigengebrauch.
// In jeder weitergegebenen Version wird diese Konstante auf false gesetzt —
// dann läuft FlowForge ausschließlich mit API-Schlüssel.
export const ABO_MODUS_ERLAUBT = true

const STANDARD = {
  motorModus: 'abo',
  apiSchluessel: '',
  ausgabenObergrenzeUsd: 5,
  // Automodus (Feedback Georg, 07.08.2026): Rechte-Rückfragen automatisch
  // erlauben statt jedes Mal zu fragen. Harte Sperren bleiben unberührt.
  rechteAutomatisch: false
}

function dateiPfad() {
  return path.join(app.getPath('userData'), 'einstellungen.json')
}

export function einstellungenLaden() {
  let gespeichert = {}
  try {
    gespeichert = JSON.parse(fs.readFileSync(dateiPfad(), 'utf8'))
  } catch {
    // Noch keine Datei — Standardwerte gelten.
  }
  const daten = { ...STANDARD, ...gespeichert }
  if (!ABO_MODUS_ERLAUBT) daten.motorModus = 'api'
  return { ok: true, einstellungen: daten, aboErlaubt: ABO_MODUS_ERLAUBT }
}

export function einstellungenSpeichern(neu) {
  const modus = neu.motorModus === 'api' ? 'api' : 'abo'
  const schluessel = String(neu.apiSchluessel ?? '').trim()
  const obergrenze = Number(neu.ausgabenObergrenzeUsd)
  if (modus === 'api' && !schluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }
  if (modus === 'api' && (!Number.isFinite(obergrenze) || obergrenze <= 0))
    return { ok: false, fehler: texte.einstellungen.fehlerObergrenze }

  const daten = {
    motorModus: !ABO_MODUS_ERLAUBT ? 'api' : modus,
    apiSchluessel: schluessel,
    ausgabenObergrenzeUsd: Number.isFinite(obergrenze) && obergrenze > 0 ? obergrenze : STANDARD.ausgabenObergrenzeUsd,
    rechteAutomatisch: Boolean(neu.rechteAutomatisch)
  }
  const tmp = dateiPfad() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
  fs.renameSync(tmp, dateiPfad())
  return { ok: true, einstellungen: daten, aboErlaubt: ABO_MODUS_ERLAUBT }
}
