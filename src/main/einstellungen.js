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
  rechteAutomatisch: false,
  // Befehle trotz „darf nur lesen" (Entscheidung Georg, 14.08.2026): Auf
  // eigene Gefahr dürfen nur-lesende Blöcke (Angreifer, Diagnose) Befehle
  // ausführen wie der Bauer — z.B. Prüfskripte, um Annahmen zu messen. Die
  // Garantie „ein Skriptlauf kann nichts verändern" fällt damit; deshalb
  // Standard aus. Schreib-Werkzeuge bleiben unter der Sperre.
  nurLesenBefehle: false,
  // Test-Schalter (BAUPLAN 11): Übertrag schon nach ~10 Prozentpunkten
  // Kontext-Verbrauch statt erst bei 85 % — nur zum Ausprobieren.
  uebertragTest: false,
  // Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026): Recherche-
  // Unteraufgaben laufen über eine lokale KI (Ollama) statt über den Motor —
  // kostet kein Kontingent. Nur aktiv, wenn Ollama beim Laufstart erreichbar ist.
  lokaleHelferAktiv: false,
  lokaleHelferModell: 'qwen2.5:7b',
  // Adresse des Ollama-Servers — localhost oder ein anderer Rechner im
  // Heimnetz (z.B. der Gaming-PC mit richtiger Grafikkarte).
  lokaleHelferAdresse: 'http://127.0.0.1:11434'
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
    rechteAutomatisch: Boolean(neu.rechteAutomatisch),
    nurLesenBefehle: Boolean(neu.nurLesenBefehle),
    uebertragTest: Boolean(neu.uebertragTest),
    lokaleHelferAktiv: Boolean(neu.lokaleHelferAktiv),
    lokaleHelferModell:
      String(neu.lokaleHelferModell ?? '').trim() || STANDARD.lokaleHelferModell,
    lokaleHelferAdresse: (() => {
      const roh = String(neu.lokaleHelferAdresse ?? '').trim().replace(/\/+$/, '')
      return /^https?:\/\/.+/.test(roh) ? roh : STANDARD.lokaleHelferAdresse
    })()
  }
  const tmp = dateiPfad() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
  fs.renameSync(tmp, dateiPfad())
  return { ok: true, einstellungen: daten, aboErlaubt: ABO_MODUS_ERLAUBT }
}
