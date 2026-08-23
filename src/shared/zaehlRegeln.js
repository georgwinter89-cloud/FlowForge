// Rechenregeln der Werkstatt (Bauschritt 54) — was die Zählstelle aus dem
// vorbeilaufenden Verkehr macht.
//
// Hier steht nur, was der Renderer (Werkstatt-Tab) UND der Hauptprozess
// (Zählstelle) brauchen: die Auswertung EINER Zeile, die abgeleiteten Zahlen
// und der Vergleich gemessen/geschätzt. Die byteweise Strom-Zerlegung wohnt
// bewusst NICHT hier, sondern in src/main/motor/zaehlstelle.js — sie hantiert
// mit Buffer, und src/shared/ bleibt browser-tauglich (Nacharbeit Bauschritt 45).
import { ZEICHEN_JE_TOKEN, lokaleKontextSchaetzung } from './lokalRegeln.js'

export { ZEICHEN_JE_TOKEN, lokaleKontextSchaetzung }

// ---------------------------------------------------------------------------
// Was die Zählstelle überhaupt als „Gesprächswechsel" zählt
// ---------------------------------------------------------------------------
// Durchgereicht wird ALLES (die Zählstelle ist ein Weiterleiter, kein Filter).
// Gezählt wird nur, was wirklich ein Turn ist:
//   /v1/messages  — die Anthropic-Schnittstelle, über die der Block-Agent läuft
//   /api/chat     — Ollamas eigene Schnittstelle, über die die Helfer-KI läuft
// Ausdrücklich NICHT /v1/messages/count_tokens: Diese Anfrage trägt denselben
// Gesprächsverlauf und würde den „gemessenen Füllstand" mit einer Anfrage
// überschreiben, die gar keine Antwort erzeugt. Ebenso wenig /api/tags,
// /api/ps oder /api/create — die fragen nur nach Zustand.
export const ZAEHL_PFADE = ['/v1/messages', '/api/chat']

// Nur der Pfad ohne Abfrage — dafür entscheidet pfadZaehlt.
export function pfadOhneAbfrage(pfad) {
  const wert = String(pfad ?? '/')
  const schnitt = wert.indexOf('?')
  return schnitt < 0 ? wert : wert.slice(0, schnitt)
}

export function pfadZaehlt(pfad) {
  return ZAEHL_PFADE.includes(pfadOhneAbfrage(pfad))
}

// ---------------------------------------------------------------------------
// Tokens aus EINER Zeile des Antwortstroms
// ---------------------------------------------------------------------------
// Zwei Dialekte, beide zeilenweise:
//  - Anthropic-Ereignisstrom (`/v1/messages`, stream): Zeilen „data: {…}".
//    `message_start` trägt usage.input_tokens, `message_delta` trägt
//    usage.output_tokens — beide als KUMULIERTER Stand dieser Antwort, nicht
//    als Zuwachs.
//  - Ollama-eigene Antwort (`/api/chat`): eine JSON-Zeile mit
//    prompt_eval_count / eval_count.
// Liefert null, wenn die Zeile keine Zählzahlen trägt — das ist der Normalfall
// (jede Text-Kachel einer Antwort ist so eine Zeile).
export function usageAusZeile(zeile) {
  const text = String(zeile ?? '').trim()
  if (!text) return null
  const roh = text.startsWith('data:') ? text.slice(5).trim() : text
  if (!roh.startsWith('{')) return null
  let daten
  try {
    daten = JSON.parse(roh)
  } catch {
    return null
  }
  if (!daten || typeof daten !== 'object') return null
  // Ollama-Dialekt.
  const hineinOllama = zahlOderNull(daten.prompt_eval_count)
  const herausOllama = zahlOderNull(daten.eval_count)
  if (hineinOllama !== null || herausOllama !== null)
    return { hinein: hineinOllama, heraus: herausOllama }
  // Anthropic-Dialekt: usage steht je nach Ereignis eine Ebene tiefer.
  const usage = daten.usage ?? daten.message?.usage ?? null
  if (!usage || typeof usage !== 'object') return null
  const hinein = summeOderNull([
    usage.input_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens
  ])
  const heraus = zahlOderNull(usage.output_tokens)
  if (hinein === null && heraus === null) return null
  return { hinein, heraus }
}

// Trägt diese Zeile überhaupt eine Zählmarke? Der Schnelltest VOR dem
// Umwandeln in Text — die Textkacheln einer Antwort (die große Mehrheit aller
// Zeilen) kosten damit nur einen Bytes-Vergleich statt eine JSON-Zerlegung.
export const ZAEHL_MARKEN = ['usage', '_eval_count']

function zahlOderNull(wert) {
  const zahl = Number(wert)
  return Number.isFinite(zahl) && zahl >= 0 ? zahl : null
}

function summeOderNull(werte) {
  let summe = null
  for (const wert of werte) {
    const zahl = zahlOderNull(wert)
    if (zahl === null) continue
    summe = (summe ?? 0) + zahl
  }
  return summe
}

// ---------------------------------------------------------------------------
// Abgeleitete Zahlen — ehrlich als abgeleitet benannt
// ---------------------------------------------------------------------------
// Tokens je Sekunde: Ollama meldet das NICHT, FlowForge rechnet es. null, wenn
// die Rechnung nichts hergibt (keine Zeit vergangen, keine Tokens) — eine
// erfundene 0 sähe aus wie eine Messung.
export function tokenJeSekunde(tokens, dauerMs) {
  const t = Number(tokens)
  const ms = Number(dauerMs)
  if (!Number.isFinite(t) || t <= 0) return null
  if (!Number.isFinite(ms) || ms <= 0) return null
  return t / (ms / 1000)
}

// Der Kern des Schrittes: gemessener Füllstand neben geschätztem.
//
// Beide Zahlen kommen aus DERSELBEN Rechnung (Zeichen ÷ ZEICHEN_JE_TOKEN) —
// verglichen wird also nicht Rechnung gegen Rechnung, sondern was FlowForge im
// Arbeitsgedächtnis des Block-Agenten VERMUTET gegen das, was wirklich an
// Ollama hinausgegangen ist. Der Unterschied ist genau das, was die Schätzung
// nicht wissen kann: Werkzeug-Definitionen, CLI-Vorspann, Formatierung.
//
// `abstand` ist gemessen minus geschätzt (positiv = die Schätzung war zu
// niedrig, die gefährliche Richtung). `abweichung` ist derselbe Abstand als
// Anteil des gemessenen Wertes. null, wenn nichts gemessen wurde — dann steht
// im Bericht „nicht gemessen" und keine 0 %.
export function fuellstandVergleich(gemessenZeichen, geschaetztZeichen, fenster) {
  const gemessen = lokaleKontextSchaetzung(gemessenZeichen)
  const geschaetzt = lokaleKontextSchaetzung(geschaetztZeichen)
  if (gemessen <= 0) return null
  const abstand = gemessen - geschaetzt
  const f = Number(fenster)
  const fensterDa = Number.isFinite(f) && f > 0
  return {
    gemessen,
    geschaetzt,
    abstand,
    abweichung: abstand / gemessen,
    gemessenProzent: fensterDa ? (gemessen / f) * 100 : null,
    geschaetztProzent: fensterDa ? (geschaetzt / f) * 100 : null
  }
}

// Prozent als ganze Zahl fürs Anzeigen — nicht bei 100 gekappt: Ein gemessener
// Füllstand ÜBER dem Fenster ist die wichtigste Aussage, die diese Zahl je
// machen kann (dann kappt Ollama still, genau der Befund aus 0.51.1).
export function prozentGanz(anteil) {
  const zahl = Number(anteil)
  if (!Number.isFinite(zahl)) return null
  return Math.round(zahl)
}
