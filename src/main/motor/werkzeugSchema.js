// Tolerante Listen-Felder der Werkzeug-Schemata (BAUPLAN 49, gemessen
// 19.08.2026): Über Ollamas Anthropic-Schnittstelle kommt ein Listen-Argument
// als JSON-TEXT statt als Array an, sobald ein Element typografische
// Anführungszeichen („ ") enthält — und FlowForges Systemtexte geben genau
// diesen Stil vor. Das Schema lehnte dann ab („expected array, received
// string"), der lokale Block-Agent brauchte drei bis vier Anläufe je Meldung
// (Minuten) und kam nur durch, weil das Modell auf ASCII auswich. Deshalb
// nehmen Listen-Felder zusätzlich einen JSON-Text an, der eine Liste ergibt;
// alles andere bleibt ein Schema-Fehler wie bisher. Das JSON-Schema, das der
// Agent sieht, bleibt „array" — die Vorverarbeitung ist für ihn unsichtbar.
import { z } from 'zod'

export function listeAusText(wert) {
  if (typeof wert !== 'string') return wert
  const text = wert.trim()
  if (!text.startsWith('[')) return wert
  try {
    const geparst = JSON.parse(text)
    return Array.isArray(geparst) ? geparst : wert
  } catch {
    return wert
  }
}

// deckel (optional): Höchstzahl der Einträge. Er MUSS hier hinein, denn die
// Rückgabe ist ein ZodPipe — `.max()` gibt es dort nicht, und genau so ein
// nachgestelltes `liste(...).max(4)` warf beim Server-Aufbau einen TypeError,
// der jeden Motorstart der gebauten App still verschluckte (Befund Prüfer 2,
// Bauschritt 50; der Wurf lag vor dem try des Motors).
export function liste(element, deckel = null) {
  const feld = deckel ? z.array(element).max(deckel) : z.array(element)
  return z.preprocess(listeAusText, feld)
}
