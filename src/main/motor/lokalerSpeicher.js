// VRAM-Passt-Prüfung der lokalen KI (0.51.3).
//
// Warum es das gibt (Wiederholungslauf Life OS, 20.08.2026): Ein lokaler Bauer
// lief 72 Minuten und starb dann am Zeitlimit der Werkzeug-Schicht — nicht,
// weil sein Arbeitsgedächtnis übergelaufen wäre (der Lokal-Wächter aus 0.51.1
// feuerte korrekt nicht), sondern weil das Kontextfenster auf 128k stand.
// Dessen Zwischenspeicher braucht beim 27B-Modell rund 30 GB und passt damit
// nicht neben die Gewichte in die 32-GB-Karte; Ollama lagert dann still in den
// Arbeitsspeicher aus (Georg gemessen: 7,5 → 42 GB), und jeder Gesprächswechsel
// rechnet das volle Gespräch im RAM-Kriechgang neu durch. FlowForge konnte
// diesen Speicherdruck bis dahin nicht sehen — Ollamas Prozessliste sagt es.
//
// Keine Electron-Abhängigkeit, nur fetch — damit Motor und Prüfskripte die
// Funktion direkt aufrufen können. Wirft nie: Diese Prüfung ist ein Hinweis,
// sie darf keinen Lauf aufhalten.
import { vramBefundAus } from '../../shared/lokalRegeln.js'

// 4 s: Die Prüfung läuft NEBEN dem arbeitenden Block (der Motor wartet nicht
// auf sie). Ein Ollama, das die Prozessliste nicht binnen Sekunden liefert,
// hat größere Sorgen — dann gibt es eben keine Warnzeile statt einer späten.
const ZEITGRENZE_MS = 4000

function adresseBereinigen(adresse) {
  return String(adresse ?? '')
    .trim()
    .replace(/\/+$/, '')
}

// Liefert { ok:true, anteil, passt, gesamt, imVram } — oder { ok:false }, wenn
// die Frage nicht beantwortbar ist (Ollama nicht erreichbar, Modell steht nicht
// in der Liste, Felder fehlen). „Nicht beantwortbar" ist bewusst NICHT
// „passt nicht": Eine Warnung aus einer fehlgeschlagenen Messung wäre ein
// Fehlalarm, und Georg würde daraufhin genau die Einstellung verstellen, die
// richtig war.
export async function ollamaSpeicherStand({ adresse, modell }) {
  const basis = adresseBereinigen(adresse)
  if (!basis || !String(modell ?? '').trim()) return { ok: false }
  try {
    const antwort = await fetch(basis + '/api/ps', {
      signal: AbortSignal.timeout(ZEITGRENZE_MS)
    })
    if (!antwort.ok) return { ok: false }
    const daten = await antwort.json()
    const befund = vramBefundAus(daten?.models, modell)
    return befund ? { ok: true, ...befund } : { ok: false }
  } catch {
    return { ok: false }
  }
}
