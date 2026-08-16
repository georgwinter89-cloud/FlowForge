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
  // Unteraufgaben-Modell (BAUPLAN 37): Späher des Angreifers und die
  // Einlese-Helfer von Bauer, Prüfer und Diagnose sind Zuarbeit — sie lesen,
  // suchen und fassen zusammen. 'sparsam' gibt ihnen das kleinere Modell (der
  // Motor-Zwilling der lokalen Helfer-KI), 'wieBlock' lässt sie auf der Klasse
  // ihres Blocks laufen. Standard sparsam: Zuarbeit ist der billigste Ort zum
  // Sparen, und die Abnahme des Block-Agenten bleibt der Schiedsrichter.
  unteraufgabenModell: 'sparsam',
  // Test-Schalter (BAUPLAN 11): Übertrag schon nach ~10 Prozentpunkten
  // Kontext-Verbrauch statt erst bei 85 % — nur zum Ausprobieren.
  uebertragTest: false,
  // Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026): Recherche-
  // Unteraufgaben laufen über eine lokale KI (Ollama) statt über den Motor —
  // kostet kein Kontingent. Nur aktiv, wenn Ollama beim Laufstart erreichbar ist.
  lokaleHelferAktiv: false,
  // Trefferquote (BAUPLAN 23): Nach jeder lokalen Recherche meldet der
  // Block-Agent, ob er das Fazit übernommen oder verworfen hat (minimaler
  // Token-Mehrverbrauch). Standard an, solange die lokale KI ein Experiment
  // ist — ohne Quote ist die Kosten-Wette blind.
  lokaleHelferQuote: true,
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
    // Nur die zwei bekannten Werte; alles andere (auch ein fehlendes Feld
    // älterer Aufrufer) fällt auf den Standard zurück.
    unteraufgabenModell: neu.unteraufgabenModell === 'wieBlock' ? 'wieBlock' : 'sparsam',
    uebertragTest: Boolean(neu.uebertragTest),
    lokaleHelferAktiv: Boolean(neu.lokaleHelferAktiv),
    // Fehlt das Feld (ältere Aufrufer), bleibt der Standard an — sonst fiele
    // die Quote beim Speichern still auf aus.
    lokaleHelferQuote:
      neu.lokaleHelferQuote == null ? STANDARD.lokaleHelferQuote : Boolean(neu.lokaleHelferQuote),
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
