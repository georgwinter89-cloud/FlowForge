// src/shared/ bleibt browser-tauglich (Nacharbeit Bauschritt 45).
//
// Der Anlass ist gemessen: stehtInDateiliste zog beim ersten Anlauf ein
// `import path from 'node:path'` nach src/shared/lieferschein.js — und der
// Renderer importiert diese Schicht breit (App.jsx, Leinwand.jsx,
// BlockEditor.jsx). `npm run build` quittierte das mit
//   [plugin vite:resolve] Module "node:path" has been externalized for browser
//   compatibility, imported by ".../src/shared/lieferschein.js"
// Kaputt war nichts: Rollup schüttelt einen unbenutzten Export wieder heraus.
// Gefallen war die GRENZE — der erste Aufruf aus dem Renderer stürbe erst zur
// Laufzeit, und keine Prüfung könnte das finden, weil vitest in Node läuft, wo
// node:path selbstverständlich funktioniert.
//
// Deshalb wird die Grenze hier direkt geprüft, am Quelltext statt am Verhalten:
// Ein Baustein des Betriebssystems in src/shared/ ist verboten, egal ob heute
// jemand ihn ruft. Der richtige Wohnort für so etwas ist der Hauptprozess
// (src/main/dateilistenPfade.js ist das Beispiel).
//
// Rot vor Grün, so gemessen: Die Zeile `import path from 'node:path'` wurde
// versuchsweise wieder in src/shared/lieferschein.js gesetzt, dann
// `npx vitest run pruefungen/sharedBrowsertauglich.test.js`:
//   AssertionError: src/shared/lieferschein.js zieht node:path:
//   expected [ 'node:path' ] to deeply equal []
// Ohne die Zeile ist die Prüfung grün.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHARED = path.join(WURZEL, 'src', 'shared')

// Die Bausteine, die ein Browser nicht hat. Die bare-Schreibweise („from 'fs'")
// zählt mit: Sie ist dieselbe Abhängigkeit, nur ohne Vorsatz — und bis heute
// kommt sie in src/shared/ kein einziges Mal vor.
const NODE_BAUSTEINE =
  /(?:from|import|require\()\s*['"](node:[a-z_/]+|fs|fs\/promises|path|os|crypto|child_process|worker_threads|net|http|https|zlib|stream|readline|module|process)['"]/g

function dateienUnter(ordner) {
  const liste = []
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const voll = path.join(ordner, eintrag.name)
    if (eintrag.isDirectory()) liste.push(...dateienUnter(voll))
    else if (/\.(js|jsx|mjs)$/.test(eintrag.name)) liste.push(voll)
  }
  return liste
}

describe('BAUPLAN 45 · src/shared/ trägt nichts, was ein Browser nicht hat', () => {
  const dateien = dateienUnter(SHARED)

  it('findet die Dateien überhaupt (sonst prüfte diese Prüfung nichts)', () => {
    expect(dateien.length).toBeGreaterThan(5)
  })

  it.each(dateien.map((voll) => [path.relative(WURZEL, voll).replace(/\\/g, '/'), voll]))(
    '%s zieht keinen Baustein des Betriebssystems',
    (name, voll) => {
      const treffer = [...fs.readFileSync(voll, 'utf8').matchAll(NODE_BAUSTEINE)].map((t) => t[1])
      // Die Meldung nennt den Fund beim Namen — wer das hier rot sieht, soll
      // nicht erst suchen müssen, sondern gleich den Wohnort ändern können.
      expect(treffer, `${name} zieht ${treffer.join(', ')}`).toEqual([])
    }
  )
})
