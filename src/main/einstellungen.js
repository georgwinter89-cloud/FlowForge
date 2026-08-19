// Globale Einstellungen (Motor-Modus, API-Schlüssel, Ausgaben-Obergrenze).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { texte } from '../shared/texte.js'
import { LOKAL_FEIN_VORLAGEN, lokalFeinBereinigen } from '../shared/lokalRegeln.js'

// Abo-Regel (SPEC §2, neu seit 0.46.4 — Entscheidung Georg, 19.08.2026): Der
// Abo-Modus bleibt auch in veröffentlichten Versionen an. Anthropic sagt seit
// dem 15.06.2026 selbst, dass Agent-SDK- und Drittanbieter-Nutzung bis auf
// Weiteres über das Abo-Kontingent läuft und Änderungen vorher angekündigt
// werden. Ein `false` hier wäre ein Schild, kein Schloss — statt Verstecken
// gibt es die Erststart-Wahl mit ehrlichem Abrechnungs-Hinweis (texte.js).
// Die Konstante bleibt als Notbremse, falls Anthropic den Weg wirklich sperrt.
export const ABO_MODUS_ERLAUBT = true

const MOTOR_MODI = ['abo', 'api']

const STANDARD = {
  // Kein stiller Standard (0.46.4): Bis der Nutzer beim ersten Start gewählt
  // hat, ist der Modus leer — Lauf, Chat und Block-Assistent verweigern dann
  // mit Klartext (motorBereit) statt still über das Abo zu laufen.
  motorModus: '',
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
  lokaleHelferAdresse: 'http://127.0.0.1:11434',
  // Kontext-Fenster der lokalen KI in Token (32k / 64k / 128k; Wunsch Georg
  // 18.08.2026 für ein 27B-Modell auf einer 32-GB-Karte). Die Werkzeug-Deckel
  // der lokalen KI wachsen mit (lokaleHelfer.js). Standard 64k: passt bei 27B
  // samt Gewichten in 32 GB; 128k nur, wenn die Karte es wirklich hergibt.
  lokaleHelferKontext: 65536,
  // Lokale KI als Block-Agent (BAUPLAN 49): Häkchen „als Block-Agent erlaubt".
  // Nur wirksam, wenn lokaleHelferAktiv an ist. Ohne dieses Häkchen lehnt der
  // Start einen Block der Klasse „lokal" mit Klartext ab — kein stiller
  // Rückfall auf Claude (sonst bezahlt Georg, was er lokal wollte).
  lokalBlockAgent: false,
  // Feineinstellungen der lokalen KI (Temperatur, Top-p/k, Min-p,
  // Wiederholungsstrafe, Antwortlänge, Entwurfs-Tokens): daraus legt FlowForge
  // ein abgeleitetes Ollama-Modell an (lokalRegeln.js). null = Ollama-Standard.
  // Basis-Modell, Adresse und Kontext sind die lokaleHelfer*-Felder oben.
  lokalFein: LOKAL_FEIN_VORLAGEN['ollama-standard'],
  // Kosten-Rückfrage „Extra (Fable 5)" (0.48.1): Beim ersten Lauf mit einem
  // Extra-Block fragt FlowForge einmal, ob der Lauf trotz möglicher
  // Guthaben-Abrechnung starten darf. true = Georg hat „trotzdem starten"
  // gewählt, die Frage kommt nicht wieder. Einziger Schreiber auf true ist
  // extraKostenBestaetigen() — der Einstellungen-Dialog kann den Wert weder
  // setzen noch zurücksetzen (einstellungenSpeichern liest ihn aus der Datei).
  extraKostenBestaetigt: false
}

const KONTEXT_WAHL = [32768, 65536, 131072]

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
  // Nur die zwei bekannten Modi zählen als Wahl — ein alter oder kaputter
  // Wert fällt auf „nicht gewählt" zurück und löst die Erststart-Wahl aus.
  if (!MOTOR_MODI.includes(daten.motorModus)) daten.motorModus = ''
  if (!ABO_MODUS_ERLAUBT && daten.motorModus === 'abo') daten.motorModus = ''
  // Feineinstellungen der lokalen KI (BAUPLAN 49) immer in der vollen Form —
  // eine ältere oder von Hand bearbeitete Datei darf keine halben Objekte
  // durchreichen.
  daten.lokalFein = lokalFeinBereinigen(daten.lokalFein)
  return {
    ok: true,
    einstellungen: daten,
    aboErlaubt: ABO_MODUS_ERLAUBT,
    motorGewaehlt: motorGewaehlt(daten)
  }
}

// Erststart-Wahl (0.46.4): Hat der Nutzer schon gesagt, wie sich der Motor
// anmelden soll? Erst dann zeigt FlowForge die Projektübersicht ohne den
// Erststart-Dialog.
export function motorGewaehlt(einstellungen) {
  return MOTOR_MODI.includes(einstellungen?.motorModus)
}

// Eine Stelle für „darf der Motor starten?" — Lauf, Chat und Block-Assistent
// fragen hier, statt die drei Bedingungen je für sich zu wiederholen.
export function motorBereit(einstellungen) {
  if (!motorGewaehlt(einstellungen))
    return { ok: false, fehler: texte.einstellungen.fehlerModusFehlt }
  if (einstellungen.motorModus === 'abo' && !ABO_MODUS_ERLAUBT)
    return { ok: false, fehler: texte.lauf.aboNichtErlaubt }
  if (einstellungen.motorModus === 'api' && !einstellungen.apiSchluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }
  return { ok: true }
}

// Gemerkte Antworten, die kein Dialog mitschickt (und keiner zurücksetzen
// darf): werden beim Speichern aus der Datei übernommen, nie aus `neu` —
// sonst vergäße jeder Einstellungen- oder Erststart-Dialog die Antwort (der
// Erststart schickt den kompletten geladenen Satz, also auch ein `false`).
function gemerkteAntworten() {
  const { einstellungen } = einstellungenLaden()
  return { extraKostenBestaetigt: einstellungen.extraKostenBestaetigt === true }
}

// Kosten-Rückfrage Extra (0.48.1): Georg hat „trotzdem starten" gewählt —
// merken, damit die Frage nicht bei jedem Lauf wiederkommt.
export function extraKostenBestaetigen() {
  const { einstellungen } = einstellungenLaden()
  const daten = { ...einstellungen, extraKostenBestaetigt: true }
  // Standardwerte, die noch nie gespeichert wurden, landen hier mit in der
  // Datei — harmlos, einstellungenLaden mischt ohnehin STANDARD darunter.
  dateiSchreiben(daten)
  return { ok: true }
}

function dateiSchreiben(daten) {
  const tmp = dateiPfad() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
  fs.renameSync(tmp, dateiPfad())
}

export function einstellungenSpeichern(neu) {
  const modus = MOTOR_MODI.includes(neu.motorModus) ? neu.motorModus : ''
  const schluessel = String(neu.apiSchluessel ?? '').trim()
  const obergrenze = Number(neu.ausgabenObergrenzeUsd)
  if (!modus || (modus === 'abo' && !ABO_MODUS_ERLAUBT))
    return { ok: false, fehler: texte.einstellungen.fehlerModusFehlt }
  if (modus === 'api' && !schluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }
  if (modus === 'api' && (!Number.isFinite(obergrenze) || obergrenze <= 0))
    return { ok: false, fehler: texte.einstellungen.fehlerObergrenze }

  const daten = {
    motorModus: modus,
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
    })(),
    // Nur die drei bekannten Fenster; alles andere (auch ein fehlendes Feld
    // älterer Aufrufer) fällt auf den Standard zurück.
    lokaleHelferKontext: KONTEXT_WAHL.includes(Number(neu.lokaleHelferKontext))
      ? Number(neu.lokaleHelferKontext)
      : STANDARD.lokaleHelferKontext,
    // Lokale KI als Block-Agent (BAUPLAN 49): Häkchen und Feineinstellungen.
    // Fehlt lokalFein (ältere Aufrufer), bleibt alles Ollama-Standard.
    lokalBlockAgent: Boolean(neu.lokalBlockAgent),
    lokalFein: lokalFeinBereinigen(neu.lokalFein),
    // NIE aus `neu` (siehe gemerkteAntworten).
    ...gemerkteAntworten()
  }
  dateiSchreiben(daten)
  return { ok: true, einstellungen: daten, aboErlaubt: ABO_MODUS_ERLAUBT, motorGewaehlt: true }
}
