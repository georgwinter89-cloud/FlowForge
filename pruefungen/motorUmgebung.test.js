// Prüfungen zur Umgebungs-Bereinigung des Motors (Zwischenschritt 0.51.1).
// Bisher warfen drei Kopien derselben Schleife nur ANTHROPIC*/CLAUDE*-Variablen
// weg. Die CLI kennt aber präfixlose Schalter, die Verhalten UND Messungen
// kippen — in der Bausession vom 20.08.2026 waren DISABLE_MICROCOMPACT und
// DISABLE_AUTOUPDATER real von der Eltern-Session geerbt. Ein geerbtes
// DISABLE_MICROCOMPACT ändert still die Zusammenfassungs-Politik des Motors.
//
// Rot-vor-Grün: Vor dem Schritt gab es umgebungBereinigen nicht; die drei
// Schleifen ließen jeden DISABLE_*-Schalter der Eltern-Umgebung durch.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLI_SCHALTER_WEG, umgebungBereinigen } from '../src/main/motor/claudeCodeMotor.js'

const hier = path.dirname(fileURLToPath(import.meta.url))
const motorQuelle = fs.readFileSync(
  path.join(hier, '..', 'src', 'main', 'motor', 'claudeCodeMotor.js'),
  'utf8'
)

describe('0.51.1 · umgebungBereinigen', () => {
  it('wirft jeden Schalter der Liste weg', () => {
    const quelle = {}
    for (const name of CLI_SCHALTER_WEG) quelle[name] = '1'
    const sauber = umgebungBereinigen(quelle)
    expect(Object.keys(sauber)).toEqual([])
  })

  it('kennt die real geerbten Schalter der Bausession', () => {
    for (const name of [
      'DISABLE_MICROCOMPACT',
      'DISABLE_AUTOUPDATER',
      'DISABLE_COMPACT',
      'DISABLE_AUTO_COMPACT',
      'DISABLE_PROMPT_CACHING',
      'DISABLE_PROMPT_CACHING_OPUS',
      'DISABLE_PROMPT_CACHING_SONNET',
      'DISABLE_PROMPT_CACHING_HAIKU',
      'DISABLE_PROMPT_CACHING_FABLE',
      'DISABLE_TELEMETRY',
      'DISABLE_ERROR_REPORTING',
      'DISABLE_COST_WARNINGS',
      'DISABLE_INTERLEAVED_THINKING'
    ])
      expect(CLI_SCHALTER_WEG.has(name)).toBe(true)
  })

  it('wirft ANTHROPIC*- und CLAUDE*-Variablen weiterhin weg', () => {
    const sauber = umgebungBereinigen({
      ANTHROPIC_API_KEY: 'geheim',
      ANTHROPIC_BASE_URL: 'http://irgendwo',
      CLAUDE_CODE_EFFORT_LEVEL: 'max',
      CLAUDE_CODE_MAX_CONTEXT_TOKENS: '200000',
      CLAUDECODE: '1'
    })
    expect(sauber).toEqual({})
  })

  it('erkennt die Namen unabhängig von der Schreibweise', () => {
    const sauber = umgebungBereinigen({
      anthropic_api_key: 'geheim',
      Disable_Microcompact: '1',
      claude_code_entrypoint: 'cli'
    })
    expect(sauber).toEqual({})
  })

  it('lässt alles andere unangetastet — der Motor braucht seine Umgebung', () => {
    const quelle = {
      PATH: 'C:\\Windows',
      TEMP: 'C:\\Temp',
      USERPROFILE: 'C:\\Users\\Georg',
      SystemRoot: 'C:\\Windows',
      NODE_ENV: 'production',
      OLLAMA_HOST: 'http://127.0.0.1:11434'
    }
    expect(umgebungBereinigen(quelle)).toEqual(quelle)
  })

  it('verträgt eine leere Quelle und nimmt ohne Angabe die echte Umgebung', () => {
    expect(umgebungBereinigen(null)).toEqual({})
    const echt = umgebungBereinigen()
    for (const name of Object.keys(echt)) {
      expect(name.toUpperCase().startsWith('ANTHROPIC')).toBe(false)
      expect(name.toUpperCase().startsWith('CLAUDE')).toBe(false)
      expect(CLI_SCHALTER_WEG.has(name.toUpperCase())).toBe(false)
    }
  })

  it('gibt eine Kopie zurück, nicht die Quelle selbst', () => {
    const quelle = { PATH: 'C:\\Windows' }
    const sauber = umgebungBereinigen(quelle)
    sauber.PATH = 'verbogen'
    expect(quelle.PATH).toBe('C:\\Windows')
  })
})

describe('0.51.1 · alle drei Motor-Sessions benutzen dieselbe Bereinigung', () => {
  it('drei Aufrufe von umgebungBereinigen(process.env) — Lauf, Einmal-Frage, Chat', () => {
    const treffer = motorQuelle.match(/umgebungBereinigen\(process\.env\)/g) ?? []
    expect(treffer.length).toBe(3)
  })

  it('keine handgeschriebene Präfix-Schleife mehr im Motor', () => {
    // Die Präfix-Prüfung steht genau einmal — in umgebungBereinigen selbst.
    expect((motorQuelle.match(/startsWith\('ANTHROPIC'\)/g) ?? []).length).toBe(1)
    expect((motorQuelle.match(/startsWith\('CLAUDE'\)/g) ?? []).length).toBe(1)
    expect(motorQuelle).not.toMatch(/for \(const \[name, wert\] of Object\.entries\(process\.env\)\)/)
  })

  it('die Ollama-Umgebung wird NACH der Bereinigung gesetzt', () => {
    const ollama = motorQuelle.indexOf('umgebung.ANTHROPIC_BASE_URL = lokal.adresse')
    expect(ollama).toBeGreaterThan(0)
    const bereinigt = motorQuelle.lastIndexOf('umgebungBereinigen(process.env)', ollama)
    expect(bereinigt).toBeGreaterThan(0)
    expect(bereinigt).toBeLessThan(ollama)
  })
})
