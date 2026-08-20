// Die IPC-Brücke gegen sich selbst geprüft (Zwischenschritt 0.51.2).
//
// Anlass (Fund 19e der Angriffsliste, gemessen 20.08.2026): Preload-Brücke und
// ipcMain-Handler wurden von KEINER Prüfung gegeneinander abgeglichen
// (`grep preload pruefungen/` = 0), und eine DOM-Testumgebung gibt es nicht —
// ein halb eingebautes Feature fiel deshalb nicht bei `npm test` auf, sondern
// erst, wenn Georg den Dialog öffnete und der Aufruf ins Leere lief.
//
// Was hier rot wird: ein Kanal, den die Oberfläche ruft, den aber niemand
// beantwortet (der Aufruf hinge für immer) — und ein Handler, den niemand
// rufen kann (toter Code, meist ein umbenannter Kanal). Beim Bau dieser
// Prüfung lief der Abgleich 63:63 ohne Waisen; mit dem Kanal der Websuche
// sind es 64:64.
//
// Bewusst am QUELLTEXT statt am Verhalten: Beide Dateien laufen nur im echten
// Electron (contextBridge bzw. app.whenReady), und genau die Zeichenkette des
// Kanalnamens ist der Vertrag zwischen ihnen.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (datei) => fs.readFileSync(path.join(WURZEL, datei), 'utf8')

const preload = lesen('src/preload/index.js')
const hauptprozess = lesen('src/main/index.js')

const namen = (quelle, muster) => [...quelle.matchAll(muster)].map((t) => t[1])

const gerufen = namen(preload, /ipcRenderer\.invoke\(\s*'([^']+)'/g)
const beantwortet = namen(hauptprozess, /ipcMain\.handle\(\s*'([^']+)'/g)
// Ereignisse laufen in die andere Richtung (Hauptprozess → Oberfläche) und
// haben deshalb keinen handle-Gegenpart.
const gehoert = namen(preload, /ipcRenderer\.on\(\s*'([^']+)'/g)

describe('0.51.2 · Preload-Brücke und Hauptprozess kennen dieselben Kanäle', () => {
  it('findet überhaupt Kanäle (sonst prüfte diese Prüfung nichts)', () => {
    expect(gerufen.length).toBeGreaterThan(50)
    expect(beantwortet.length).toBeGreaterThan(50)
  })

  it('kein Kanal wird zweimal beantwortet — der zweite Handler würfe beim Start', () => {
    const doppelt = beantwortet.filter((n, i) => beantwortet.indexOf(n) !== i)
    expect(doppelt, `doppelte Handler: ${doppelt.join(', ')}`).toEqual([])
  })

  it('jeder gerufene Kanal wird auch beantwortet — keine Waisen in der Oberfläche', () => {
    const waisen = [...new Set(gerufen)].filter((n) => !beantwortet.includes(n))
    expect(waisen, `ohne Handler: ${waisen.join(', ')}`).toEqual([])
  })

  it('jeder Handler ist über die Brücke erreichbar — kein toter Kanal', () => {
    const waisen = beantwortet.filter((n) => !gerufen.includes(n))
    expect(waisen, `unerreichbar: ${waisen.join(', ')}`).toEqual([])
  })

  it('beide Seiten meinen dieselbe Menge', () => {
    expect([...new Set(gerufen)].sort()).toEqual([...new Set(beantwortet)].sort())
  })

  it('Ereignis-Kanäle laufen andersherum und brauchen keinen Handler', () => {
    for (const name of gehoert) expect(beantwortet).not.toContain(name)
  })
})

describe('0.51.2 · Der Kanal der Websuche ist auf beiden Seiten da', () => {
  it('searxng-status: Brücke, Handler und benannte Funktion', () => {
    expect(gerufen).toContain('searxng-status')
    expect(beantwortet).toContain('searxng-status')
    expect(preload).toMatch(/searxngStatus:\s*\(adresse\)/)
    // Der Handler härtet die Eingabe selbst (String, leer = gar nicht prüfen) —
    // das Ollama-Vorbild daneben fiele bei leerer Adresse still auf eine
    // Standardadresse zurück.
    expect(hauptprozess).toMatch(/String\(adresse \?\? ''\)\.trim\(\)/)
  })
})
