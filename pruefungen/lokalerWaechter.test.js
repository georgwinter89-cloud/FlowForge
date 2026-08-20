// Prüfungen zum Lokal-Wächter (Zwischenschritt 0.51.1): FlowForge schätzt den
// Füllstand des lokalen Block-Agenten selbst und löst bei 80 % den vorhandenen
// Übertrag aus — weil Ollama den Füllstand oberhalb der Fensterkante still
// falsch meldet (gemessen 20.08.2026, Life-OS-Lauf) und die Auto-Zusammenfassung
// der CLI genau an dieser Zahl hängt.
//
// Rot-vor-Grün: Vor dem Schritt gab es lokaleKontextSchaetzung, blockAgentZeichen
// und LOKAL_WAECHTER_PROZENT nicht; die Übertrags-Schwelle maß ausschließlich den
// Koordinator-Faden (hauptTokens) und wurde in einem lokalen Motor praktisch nie
// erreicht — der Block lief bis zum stillen Vergessen weiter.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LOKAL_WAECHTER_PROZENT,
  ZEICHEN_JE_TOKEN,
  blockAgentZeichen,
  lokaleKontextSchaetzung
} from '../src/main/motor/claudeCodeMotor.js'

const hier = path.dirname(fileURLToPath(import.meta.url))
const motorQuelle = fs.readFileSync(
  path.join(hier, '..', 'src', 'main', 'motor', 'claudeCodeMotor.js'),
  'utf8'
)

// Der Block-Agent dieses Blocks; „fremd" ist eine tiefere Unteraufgabe.
const meine = new Set(['task-block-1'])
const assistent = (inhalt, eltern = 'task-block-1') => ({
  type: 'assistant',
  parent_tool_use_id: eltern,
  message: { role: 'assistant', content: inhalt }
})
const nutzer = (inhalt, eltern = 'task-block-1') => ({
  type: 'user',
  parent_tool_use_id: eltern,
  message: { role: 'user', content: inhalt }
})

describe('0.51.1 · Schätzung des lokalen Füllstands', () => {
  it('rechnet Zeichen mit 3,5 in Tokens um — bewusst überschätzend', () => {
    expect(ZEICHEN_JE_TOKEN).toBe(3.5)
    expect(lokaleKontextSchaetzung(35_000)).toBe(10_000)
    expect(lokaleKontextSchaetzung(7)).toBe(2)
  })

  it('rundet auf: ein angefangenes Token zählt ganz', () => {
    expect(lokaleKontextSchaetzung(1)).toBe(1)
    expect(lokaleKontextSchaetzung(8)).toBe(3)
  })

  it('liefert für Unsinn 0 statt NaN — der Wächter darf nie stolpern', () => {
    expect(lokaleKontextSchaetzung(0)).toBe(0)
    expect(lokaleKontextSchaetzung(-500)).toBe(0)
    expect(lokaleKontextSchaetzung(undefined)).toBe(0)
    expect(lokaleKontextSchaetzung('viel')).toBe(0)
  })

  it('die Schwelle steht bei 80 % — deutlich unter der Fensterkante', () => {
    expect(LOKAL_WAECHTER_PROZENT).toBe(80)
    expect(LOKAL_WAECHTER_PROZENT).toBeLessThan(100)
  })
})

describe('0.51.1 · Zeichen des Block-Agenten zählen', () => {
  it('zählt Text, Denken und Werkzeugaufrufe einer Assistent-Nachricht', () => {
    const nachricht = assistent([
      { type: 'text', text: 'abcde' }, // 5
      { type: 'thinking', thinking: 'xyz' }, // 3
      { type: 'tool_use', name: 'Read', input: { a: 1 } } // 'Read' = 4 + '{"a":1}' = 7
    ])
    expect(blockAgentZeichen(nachricht, meine)).toBe(5 + 3 + 4 + 7)
  })

  it('zählt Werkzeug-Ergebnisse der Nutzer-Nachrichten — der große Brocken', () => {
    const text = 'x'.repeat(4000)
    const nachricht = nutzer([{ type: 'tool_result', tool_use_id: 'w1', content: text }])
    expect(blockAgentZeichen(nachricht, meine)).toBe(4000)
  })

  it('nimmt ein Werkzeug-Ergebnis auch als Teileliste', () => {
    const nachricht = nutzer([
      { type: 'tool_result', tool_use_id: 'w1', content: [{ type: 'text', text: 'hallo' }] }
    ])
    // Serialisiert gezählt (Liste) — mindestens der Inhalt, nie weniger.
    expect(blockAgentZeichen(nachricht, meine)).toBeGreaterThanOrEqual(5)
  })

  it('zählt den Koordinator-Faden NICHT mit (keine Eltern-Kennung)', () => {
    const nachricht = { ...assistent([{ type: 'text', text: 'OK' }]), parent_tool_use_id: null }
    expect(blockAgentZeichen(nachricht, meine)).toBe(0)
  })

  it('zählt tiefere Unteraufgaben NICHT mit — die tragen ihren eigenen Kontext', () => {
    const nachricht = assistent([{ type: 'text', text: 'a'.repeat(9000) }], 'task-helfer-7')
    expect(blockAgentZeichen(nachricht, meine)).toBe(0)
  })

  it('bleibt bei fehlenden oder krummen Nachrichten bei 0', () => {
    expect(blockAgentZeichen(null, meine)).toBe(0)
    expect(blockAgentZeichen(assistent(undefined), meine)).toBe(0)
    expect(blockAgentZeichen(assistent([{ type: 'text' }]), meine)).toBe(0)
    expect(blockAgentZeichen({ type: 'system', parent_tool_use_id: 'task-block-1' }, meine)).toBe(0)
    expect(blockAgentZeichen(assistent([{ type: 'text', text: 'a' }]), null)).toBe(0)
  })

  it('sprengt nicht an einem nicht serialisierbaren Werkzeug-Argument', () => {
    const ring = { name: 'ring' }
    ring.selbst = ring
    const nachricht = assistent([{ type: 'tool_use', name: 'Bash', input: ring }])
    expect(blockAgentZeichen(nachricht, meine)).toBe(4)
  })
})

describe('0.51.1 · Wächter-Verhalten (dieselbe Rechnung wie im Motor)', () => {
  // Der Motor summiert je Nachricht blockAgentZeichen auf den Startwert
  // (Auftrag + Systemtext) und vergleicht die Schätzung mit
  // fenster * LOKAL_WAECHTER_PROZENT / 100. Genau dieser Ablauf wird hier
  // nachgestellt — ohne CLI, ohne Ollama.
  const fenster = 65_536
  const schwelleErreicht = (zeichen) =>
    lokaleKontextSchaetzung(zeichen) >= (fenster * LOKAL_WAECHTER_PROZENT) / 100

  it('schlägt beim großen Werkzeug-Ergebnis an, das die CLI überspringen würde', () => {
    let zeichen = 4000 + 6000 // Auftrag + Systemtext
    expect(schwelleErreicht(zeichen)).toBe(false)
    // Ein einziger Sprung: 180.000 Zeichen Werkzeug-Ergebnis (~51k Tokens).
    zeichen += blockAgentZeichen(
      nutzer([{ type: 'tool_result', tool_use_id: 'w1', content: 'x'.repeat(180_000) }]),
      meine
    )
    expect(schwelleErreicht(zeichen)).toBe(true)
  })

  it('bleibt bei normaler Arbeit ruhig — kein Übertrag auf Verdacht', () => {
    let zeichen = 4000 + 6000
    for (let runde = 0; runde < 20; runde++)
      zeichen += blockAgentZeichen(assistent([{ type: 'text', text: 'y'.repeat(2000) }]), meine)
    expect(schwelleErreicht(zeichen)).toBe(false)
  })

  it('schlägt bei 80 % an, also mit Luft bis zur Fensterkante', () => {
    const grenzZeichen = Math.ceil(((fenster * LOKAL_WAECHTER_PROZENT) / 100) * ZEICHEN_JE_TOKEN)
    expect(schwelleErreicht(grenzZeichen)).toBe(true)
    expect(schwelleErreicht(grenzZeichen - ZEICHEN_JE_TOKEN * 2)).toBe(false)
    expect(lokaleKontextSchaetzung(grenzZeichen)).toBeLessThan(fenster)
  })
})

describe('0.51.1 · Regel im Quelltext festgenagelt', () => {
  it('der Wächter läuft NUR für lokale Motoren', () => {
    const anfang = motorQuelle.indexOf('function lokalWaechter(')
    expect(anfang).toBeGreaterThan(0)
    const rumpf = motorQuelle.slice(anfang, anfang + 400)
    expect(rumpf).toMatch(/if \(!lokal \|\| !block\) return/)
  })

  it('der Wächter wird in der Nachrichtenschleife aufgerufen, nicht im usage-Zweig', () => {
    const aufruf = motorQuelle.indexOf('\n        lokalWaechter(nachricht)')
    expect(aufruf).toBeGreaterThan(0)
    const usageZweig = motorQuelle.indexOf(
      "if (nachricht.type === 'assistant' && nachricht.message?.usage) {"
    )
    expect(aufruf).toBeLessThan(usageZweig)
  })

  it('der Wächter respektiert die Übertragsgrenze des Workflows', () => {
    const anfang = motorQuelle.indexOf('function lokalWaechter(')
    const rumpf = motorQuelle.slice(anfang, motorQuelle.indexOf('\n  }', anfang))
    expect(rumpf).toMatch(/if \(!block\.uebertrag\.aktiv \|\| block\.uebertragPhase !== null\) return/)
    expect(rumpf).toMatch(/uebertragPhase = 'angefordert'/)
    expect(rumpf).toMatch(/interrupt\(\)/)
  })

  it('die bestehende Schwelle des Koordinators bleibt unangetastet', () => {
    expect(motorQuelle).toMatch(/const messTokens = block\.uebertrag\.testModus/)
    expect(motorQuelle).toMatch(/UEBERTRAG_SCHWELLE_PROZENT/)
  })

  it('die Startschätzung nimmt Auftrag UND Systemtext des Block-Agenten', () => {
    expect(motorQuelle).toMatch(
      /block\.startZeichen = String\(block\.auftrag \?\? ''\)\.length \+ blockAgentSystemZeichen/
    )
    expect(motorQuelle).toMatch(/blockAgentSystemZeichen = blockAgentSystemText\.length/)
  })

  it('die Start-Prompt-Zeile kommt genau einmal je lokalem Block', () => {
    const anfang = motorQuelle.indexOf('function lokalWaechter(')
    const rumpf = motorQuelle.slice(anfang, motorQuelle.indexOf('\n  }', anfang))
    expect(rumpf).toMatch(/!block\.startPromptGemeldet/)
    expect(rumpf).toMatch(/block\.startPromptGemeldet = true/)
    expect(rumpf).toMatch(/texte\.ticker\.lokalStartPrompt\(/)
  })
})
