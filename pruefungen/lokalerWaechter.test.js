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
  WAECHTER_NOTBREMSE_PROZENT,
  ZEICHEN_JE_TOKEN,
  blockAgentZeichen,
  lokaleKontextSchaetzung,
  schwelleNachLieferung,
  lokaleRestluftZeichen
} from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

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

// Nacharbeit nach Prüfer 1 (0.51.1): Der Wächter prüfte die Schwelle nur nach
// Assistent-Nachrichten — der eine große Werkzeug-Ergebnis-Sprung, für den er
// gebaut wurde, ging so noch einmal ungebremst an Ollama. Und die
// Startschätzung kannte nur Auftrag + Systemtext; die Differenz zur ehrlichen
// Erstmeldung Ollamas wird jetzt einmalig als Aufschlag übernommen.
describe('Nacharbeit Prüfer 1 · Sofortprüfung und Selbst-Kalibrierung', () => {
  const motorQuelle = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main', 'motor', 'claudeCodeMotor.js'),
    'utf8'
  )
  const waechter = motorQuelle.slice(
    motorQuelle.indexOf('function lokalWaechter('),
    motorQuelle.indexOf('function blockAufloesen(')
  )

  it('kein früher Ausstieg mehr vor der Schwellenprüfung', () => {
    // Die Schwelle wird nach JEDER Nachricht geprüft — ein Rücksprung nur für
    // Nicht-Assistent-Nachrichten stünde ZWISCHEN Summierung und Schwelle.
    expect(waechter).not.toMatch(/if \(nachricht\.type !== 'assistant'\) return/)
    // 0.51.4: Die Marke heißt jetzt `schwelle` — sie kommt aus
    // schwelleNachLieferung(LOKAL_WAECHTER_PROZENT, …) und ist ohne Lieferung
    // unverändert LOKAL_WAECHTER_PROZENT.
    expect(waechter).toMatch(/geschaetzt < \(fenster \* schwelle\) \/ 100/)
    expect(waechter).toMatch(/schwelleNachLieferung\(LOKAL_WAECHTER_PROZENT, block\.meldungen\)/)
  })

  it('Start-Prompt-Zeile bleibt an die erste Assistent-Nachricht gebunden', () => {
    expect(waechter).toMatch(/nachricht\.type === 'assistant' &&\s*\n\s*!block\.startPromptGemeldet/)
  })

  it('Selbst-Kalibrierung: Aufschlag nur bei ehrlicher Erstmeldung unter 90 % des Fensters', () => {
    expect(waechter).toMatch(/gemeldet > geschaetztStart && gemeldet < fensterJetzt \* 0\.9/)
    expect(waechter).toMatch(/\(gemeldet - geschaetztStart\) \* ZEICHEN_JE_TOKEN/)
  })
})

// ── Schonung nach abgegebener Lieferung (0.51.4) ─────────────────────────────
// Rot-vor-Grün: Vor diesem Zwischenschritt gab es schwelleNachLieferung und
// WAECHTER_NOTBREMSE_PROZENT nicht (Import rot), und der Wächter fragte den
// Lieferschein nie — genau daran ist der Life-OS-Lauf vom 21.08.2026
// gestorben: Der Block „Angreifer" gab um 08:23:15Z seine fertige
// Angriffsliste ab, in derselben Sekunde schlug die 80-%-Marke zu, die fertige
// Session wurde weggeworfen, und der frische Anlauf wiederholte 43 Minuten
// Arbeit, bevor er starb. Der Lauf endete bei Block 2 von 5.
describe('0.51.4 · Wer schon geliefert hat, wird nicht mehr weggeworfen', () => {
  const meldung = { etikett: 'Angriffsliste', art: 'angriffsliste', fazit: 'acht Funde' }

  it('lässt die normale Marke unangetastet, solange nichts geliefert ist', () => {
    expect(schwelleNachLieferung(LOKAL_WAECHTER_PROZENT, [])).toBe(LOKAL_WAECHTER_PROZENT)
    expect(schwelleNachLieferung(LOKAL_WAECHTER_PROZENT, null)).toBe(LOKAL_WAECHTER_PROZENT)
    expect(schwelleNachLieferung(85, undefined)).toBe(85)
  })

  it('hebt die Marke, sobald eine Lieferung angekommen ist', () => {
    expect(schwelleNachLieferung(LOKAL_WAECHTER_PROZENT, [meldung])).toBe(
      WAECHTER_NOTBREMSE_PROZENT
    )
    expect(schwelleNachLieferung(85, [meldung])).toBe(WAECHTER_NOTBREMSE_PROZENT)
  })

  it('hebt den Schutz nicht auf — die Notbremse liegt unter der Fensterkante', () => {
    expect(WAECHTER_NOTBREMSE_PROZENT).toBeGreaterThan(LOKAL_WAECHTER_PROZENT)
    expect(WAECHTER_NOTBREMSE_PROZENT).toBeLessThan(100)
  })

  it('senkt eine ohnehin höhere Marke nicht ab', () => {
    // Eine Notbremse, die unter der normalen Marke läge, wäre keine.
    expect(schwelleNachLieferung(99, [meldung])).toBe(99)
  })

  it('rechnet für den gemessenen Fall: 105.406 von 131.072 hätten gereicht', () => {
    const fenster = 131_072
    const gemessen = 105_406
    // So war es: über 80 % → Übertrag, fertige Arbeit weg.
    expect(gemessen).toBeGreaterThanOrEqual((fenster * LOKAL_WAECHTER_PROZENT) / 100)
    // So ist es jetzt: die Lieferung lag vor, also läuft der Block zu Ende.
    const schwelle = schwelleNachLieferung(LOKAL_WAECHTER_PROZENT, [meldung])
    expect(gemessen).toBeLessThan((fenster * schwelle) / 100)
  })

  it('gilt genauso für die Schwelle des Koordinators — nur nicht im Übertrags-Test', () => {
    // Der Testmodus existiert, um einen Übertrag vorzuführen; eine Schonung
    // nähme ihm genau das Vorzuführende.
    expect(motorQuelle).toMatch(
      /: schwelleNachLieferung\(UEBERTRAG_SCHWELLE_PROZENT, block\.meldungen\)/
    )
    expect(motorQuelle).toMatch(/block\.uebertrag\.testModus\s*\n?\s*\?\s*Math\.min\(/)
    expect(motorQuelle).toMatch(/else if \(!block\.uebertrag\.testModus\)/)
  })

  it('sagt einmal je Block, warum es oberhalb der Marke ruhig bleibt', () => {
    const zeile = texte.ticker.uebertragNachLieferungGeschont('Angreifer')
    expect(zeile).toMatch(/Angreifer/)
    expect(zeile).toMatch(/schon abgegeben/)
    // Und verspricht nicht, dass gar nichts mehr passieren kann.
    expect(zeile).toMatch(/übergibt FlowForge trotzdem/)
    expect(motorQuelle).toMatch(/if \(!block \|\| block\.schonungGemeldet\) return/)
    expect(motorQuelle).toMatch(/schonungGemeldet: false/)
  })
})

// ── Restluft der Websuche folgt der geltenden Marke (0.51.5) ─────────────────
// Rot-vor-Grün: Bis 0.51.4 rechnete der Werkzeug-Aufbau der Websuche mit der
// FESTEN Marke von 80 % (`(fenster * LOKAL_WAECHTER_PROZENT) / 100`), während
// der Wächter selbst seit der Schonung bis 95 % laufen lässt. Ein Block, der
// seinen Lieferschein abgegeben hatte und zwischen beiden Marken weiterarbeitete,
// bekam damit eine NEGATIVE Restluft — und webWerkzeuge.js brach jede Suche mit
// „kein Platz mehr" ab, obwohl 15 Prozentpunkte frei waren. Die Funktion
// lokaleRestluftZeichen gab es nicht (Import rot).
describe('0.51.5 · Die Websuche eines Blocks, der geliefert hat', () => {
  const meldung = { etikett: 'Angriffsliste', art: 'angriffsliste', fazit: 'acht Funde' }
  const fenster = 131_072
  // Füllstand zwischen beiden Marken: über 80 %, unter 95 %.
  const zwischenBeiden = Math.round(fenster * 0.87) * ZEICHEN_JE_TOKEN

  it('ohne Lieferung bleibt die 80-%-Marke die Grenze', () => {
    expect(lokaleRestluftZeichen(fenster, Math.round(fenster * 0.5) * ZEICHEN_JE_TOKEN, [])).toBeGreaterThan(0)
    // Über der Marke ist die Restluft negativ — das ist die Sperre, so gewollt.
    expect(lokaleRestluftZeichen(fenster, zwischenBeiden, [])).toBeLessThan(0)
  })

  it('mit abgegebener Lieferung ist zwischen den Marken wieder Platz', () => {
    // Genau der Fall, der vorher „kein Platz mehr" meldete.
    expect(lokaleRestluftZeichen(fenster, zwischenBeiden, [meldung])).toBeGreaterThan(0)
  })

  it('hebt den Schutz nicht auf — oberhalb der Notbremse ist Schluss', () => {
    const ueberNotbremse = Math.round(fenster * 0.97) * ZEICHEN_JE_TOKEN
    expect(lokaleRestluftZeichen(fenster, ueberNotbremse, [meldung])).toBeLessThan(0)
  })

  it('der Abstand zwischen beiden Marken ist genau die Schonung', () => {
    // Was die Lieferung an Platz freigibt, sind die Prozentpunkte zwischen
    // normaler Marke und Notbremse — in Zeichen gerechnet.
    const ohne = lokaleRestluftZeichen(fenster, zwischenBeiden, [])
    const mit = lokaleRestluftZeichen(fenster, zwischenBeiden, [meldung])
    const erwartet =
      ((fenster * (WAECHTER_NOTBREMSE_PROZENT - LOKAL_WAECHTER_PROZENT)) / 100) * ZEICHEN_JE_TOKEN
    // Bis auf die Rundung eines Tokens — die Schätzung rundet bewusst auf.
    expect(Math.abs(mit - ohne - erwartet)).toBeLessThan(ZEICHEN_JE_TOKEN)
  })

  it('die feste Marke steht nicht mehr im Werkzeug-Aufbau', () => {
    // umgebungBereinigen kommt im Motor mehrfach vor — ab dem Werkzeug-Aufbau
    // suchen, sonst liegt das Ende vor dem Anfang und der Ausschnitt ist leer.
    const von = motorQuelle.indexOf('const webServer = lokal')
    const aufbau = motorQuelle.slice(von, motorQuelle.indexOf('const umgebung = umgebungBereinigen(', von))
    expect(aufbau.length).toBeGreaterThan(0)
    expect(aufbau).not.toMatch(/fenster \* LOKAL_WAECHTER_PROZENT/)
    expect(aufbau).toMatch(/lokaleRestluftZeichen\(/)
  })
})
