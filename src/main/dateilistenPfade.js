// Die EINE Rechenstelle für „gehört DIESE Datei in DIESE Liste" (BAUPLAN 44/45).
// Drei Stellen rechnen damit: die Schreibsperre des Motors (Datenvertrag), der
// auf den Wirkbereich gefilterte Überblick und die geschützten Bereiche des
// Rückrolls. Ein liste.includes(pfad) an einer dieser Stellen träfe je nach
// Herkunft des Pfads mal alles und mal nichts.
//
// Warum eine eigene Datei im Hauptprozess und nicht neben dem Melden in
// src/shared/lieferschein.js, wo sie in Bauschritt 45 zuerst lag: Sie braucht
// node:path, und src/shared/ wird vom Renderer breit importiert (App.jsx,
// Leinwand.jsx, BlockEditor.jsx). Der Browser-Build quittierte das gemessen mit
// „Module 'node:path' has been externalized for browser compatibility" — heute
// folgenlos, weil im Renderer niemand diese Funktion ruft, aber die Grenze wäre
// gefallen: Der erste Aufruf von dort stürbe erst zur Laufzeit, und npm test
// könnte das nie finden, weil vitest in Node läuft, wo node:path
// selbstverständlich funktioniert. Also wohnt die Rechnung dort, wo sie
// gebraucht wird — im Hauptprozess, ohne Electron und ohne Motor, damit sowohl
// sicherungspunkte.js als auch claudeCodeMotor.js sie ziehen können, ohne sich
// gegenseitig ihren Unterbau mitzuschleppen.
// Gehütet wird die Grenze von pruefungen/sharedBrowsertauglich.test.js.
import path from 'node:path'
import { dateiEintragNormalisieren } from '../shared/lieferschein.js'

// Das andere Ende der Rechnung, deren erstes Ende dateiEintragNormalisieren ist
// (BAUPLAN 44): Beide müssen gleich normalisieren, sonst nimmt das eine an, was
// das andere nie trifft.
//
// Ein Eintrag gilt als ORDNER, wenn er auf einen Schrägstrich endet oder keine
// Datei-Endung trägt — dann deckt er alles darunter ab. Geprüft wird
// ausschließlich gegen den GENANNTEN Pfad, nie gegen den Dateibestand: Der
// Vertrag nennt ausdrücklich auch Dateien, die erst entstehen.
//
// `datei` darf kommen, wie sie anfällt: absolut aus dem Schreib-Werkzeug oder
// relativ mit Schrägstrichen vorwärts aus git.walk. Beides rechnet
// path.relative/resolve auf dieselbe Form herunter (Windows-Trenner, klein
// geschrieben) — genau dafür ist diese Funktion da.
export function stehtInDateiliste(datei, projektPfad, liste) {
  if (!datei || !Array.isArray(liste) || liste.length === 0) return false
  const relativ = path
    .relative(path.resolve(projektPfad), path.resolve(projektPfad, String(datei)))
    .toLowerCase()
  for (const roh of liste) {
    // Ein ausbrechender Eintrag trifft nie etwas im Projekt, und ein Eintrag auf
    // den Projektordner selbst („.") träfe alles — das Melde-Werkzeug weist
    // beide ab; hier werden sie übersprungen (alte Laufstände tragen noch
    // ungeprüfte Listen zurück). Beide Enden geben damit dieselbe Antwort.
    const eintrag = dateiEintragNormalisieren(roh).pfad ?? ''
    if (!eintrag) continue
    const ordner = /[/\\]$/.test(eintrag) || !/\.[^./\\]+$/.test(eintrag)
    const ziel = path
      .relative(path.resolve(projektPfad), path.resolve(projektPfad, eintrag))
      .toLowerCase()
    if (!ziel || ziel.startsWith('..')) continue
    if (relativ === ziel) return true
    if (ordner && relativ.startsWith(ziel + path.sep)) return true
  }
  return false
}
