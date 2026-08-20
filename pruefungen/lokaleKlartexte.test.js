// Prüfungen zu den deutschen Klartexten statt roher CLI-Fehler
// (Zwischenschritt 0.51.1). Gemessen im Life-OS-Lauf 20.08.2026:
//  - „Prompt is too long" stand roh als ergebnisText eines Blocks, der als
//    ERFOLG durchlief (410k Eingabe-Summe, Zustand 'ohne-meldung').
//  - „[Request interrupted by user for tool use]" stand als ergebnisText UND
//    als bericht.fehlertext — Georg hat nichts unterbrochen, der Abbruch kam
//    aus der Werkzeug-Schicht. Ein Text, der ihm die Schuld gibt, ist eine
//    Lüge und schickt ihn auf die falsche Fährte.
//
// Rot-vor-Grün: Vor dem Schritt gab es rohenCliFehlerUebersetzen nicht;
// fehlerAusErgebnis kannte beide Marken nicht (der Rohtext wanderte
// unverändert durch), und ein Fazit „Prompt is too long" führte zu
// 'erfolgreich' mit der Marke als Ergebnis für die Folgeblöcke.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fehlerAusErgebnis, rohenCliFehlerUebersetzen } from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

const hier = path.dirname(fileURLToPath(import.meta.url))
const motorQuelle = fs.readFileSync(
  path.join(hier, '..', 'src', 'main', 'motor', 'claudeCodeMotor.js'),
  'utf8'
)

const lokalInfo = { lokal: true, fenster: 65_536, adresse: 'http://ollama-zweitrechner:11434' }

describe('0.51.1 · Marke „Prompt is too long"', () => {
  it('wird zu deutschem Klartext mit Art kontext-voll', () => {
    const urteil = rohenCliFehlerUebersetzen('Prompt is too long', {
      ...lokalInfo,
      nurGanzerText: true
    })
    expect(urteil?.fehlerArt).toBe('kontext-voll')
    expect(urteil.fehlertext).toMatch(/Arbeitsgedächtnis/)
    expect(urteil.fehlertext).toMatch(/übergelaufen/)
    expect(urteil.fehlertext).toMatch(/65\.536/)
    expect(urteil.fehlertext).not.toMatch(/Prompt is too long/)
  })

  it('erkennt auch die zweite Formulierung derselben Sache', () => {
    const urteil = rohenCliFehlerUebersetzen(
      'input length and `max_tokens` exceed context limit',
      lokalInfo
    )
    expect(urteil?.fehlerArt).toBe('kontext-voll')
  })

  it('nennt bei einem Claude-Motor keine Ollama-Eigenheiten', () => {
    const urteil = rohenCliFehlerUebersetzen('Prompt is too long', { nurGanzerText: true })
    expect(urteil?.fehlerArt).toBe('kontext-voll')
    expect(urteil.fehlertext).not.toMatch(/lokal|Ollama|Grafikkarte/i)
  })
})

describe('0.51.1 · Marke „[Request interrupted by user …]"', () => {
  it('wird zu Klartext OHNE Nutzer-Beschuldigung, Art werkzeug-abbruch', () => {
    const urteil = rohenCliFehlerUebersetzen('[Request interrupted by user for tool use]', {
      ...lokalInfo,
      nurGanzerText: true
    })
    expect(urteil?.fehlerArt).toBe('werkzeug-abbruch')
    expect(urteil.fehlertext).toMatch(/Werkzeug-Schicht/)
    expect(urteil.fehlertext).toMatch(/kam nicht von dir/)
    expect(urteil.fehlertext).toMatch(/ollama-zweitrechner/)
    expect(urteil.fehlertext).not.toMatch(/interrupted/i)
  })

  it('erkennt auch die kurze Präfix-Variante', () => {
    const urteil = rohenCliFehlerUebersetzen('[Request interrupted by user]', {
      ...lokalInfo,
      nurGanzerText: true
    })
    expect(urteil?.fehlerArt).toBe('werkzeug-abbruch')
  })
})

describe('0.51.1 · Ein Agent, der über den Fehler REDET, ist kein Fehler', () => {
  it('lässt einen Bericht, der die Marke nur erwähnt, unangetastet', () => {
    const bericht =
      'Der dritte Anlauf endete mit „Prompt is too long" — ich habe die Datei deshalb in Häppchen gelesen.'
    expect(rohenCliFehlerUebersetzen(bericht, { ...lokalInfo, nurGanzerText: true })).toBe(null)
  })

  it('lässt auch eine Erklärung zum Werkzeug-Abbruch unangetastet', () => {
    const bericht =
      'Im Protokoll steht [Request interrupted by user for tool use]; das kam aus der Werkzeug-Schicht.'
    expect(rohenCliFehlerUebersetzen(bericht, { ...lokalInfo, nurGanzerText: true })).toBe(null)
  })

  it('erkennt die Marke, wenn sie allein im Feld steht (auch mit Leerraum)', () => {
    expect(
      rohenCliFehlerUebersetzen('  [Request interrupted by user for tool use]\n', {
        nurGanzerText: true
      })?.fehlerArt
    ).toBe('werkzeug-abbruch')
    expect(rohenCliFehlerUebersetzen('Prompt is too long.', { nurGanzerText: true })?.fehlerArt).toBe(
      'kontext-voll'
    )
  })

  it('gibt für Leeres und Unsinn null zurück', () => {
    expect(rohenCliFehlerUebersetzen('', lokalInfo)).toBe(null)
    expect(rohenCliFehlerUebersetzen(null, lokalInfo)).toBe(null)
    expect(rohenCliFehlerUebersetzen('Alles erledigt.', lokalInfo)).toBe(null)
  })
})

describe('0.51.1 · fehlerAusErgebnis (Lauf-Ebene und catch-Pfad)', () => {
  it('übersetzt „Prompt is too long" aus dem Motor-Ergebnis', () => {
    const { fehlertext, fehlerArt } = fehlerAusErgebnis(
      { is_error: true, result: 'API Error: Prompt is too long' },
      '',
      { fenster: 65_536, adresse: 'http://ollama-zweitrechner:11434' }
    )
    expect(fehlerArt).toBe('kontext-voll')
    expect(fehlertext).toMatch(/Arbeitsgedächtnis/)
  })

  it('übersetzt den Werkzeug-Abbruch aus dem stderr-Rest (catch-Pfad)', () => {
    const { fehlertext, fehlerArt } = fehlerAusErgebnis(
      null,
      '[Request interrupted by user for tool use]',
      { fenster: 65_536, adresse: 'http://ollama-zweitrechner:11434' }
    )
    expect(fehlerArt).toBe('werkzeug-abbruch')
    expect(fehlertext).toMatch(/kam nicht von dir/)
  })

  it('bleibt ohne Lokal-Angabe deutsch, aber neutral', () => {
    const { fehlertext, fehlerArt } = fehlerAusErgebnis(
      { is_error: true, result: 'Prompt is too long' },
      ''
    )
    expect(fehlerArt).toBe('kontext-voll')
    expect(fehlertext).toBe(texte.lauf.kontextVoll(0))
  })

  it('macht aus einem vollen Arbeitsgedächtnis KEINE Kontingent-Pause', () => {
    const { fehlerArt } = fehlerAusErgebnis({ is_error: true, result: 'Prompt is too long' }, '')
    expect(fehlerArt).not.toBe('kontingent')
  })

  it('lässt die bisherigen Einstufungen unangetastet', () => {
    expect(fehlerAusErgebnis({ is_error: true, result: 'rate limit reached' }, '').fehlerArt).toBe(
      'kontingent'
    )
    expect(fehlerAusErgebnis({ is_error: true, result: 'Overloaded' }, '').fehlerArt).toBe(
      'ueberlastet'
    )
    expect(
      fehlerAusErgebnis({ is_error: true, result: 'out of usage credits' }, '').fehlerArt
    ).toBe('extra-nicht-verfuegbar')
  })
})

describe('0.51.1 · Einsatzstellen im Quelltext festgenagelt', () => {
  it('der Ticker übersetzt rohe Marken statt sie roh zu zeigen', () => {
    const anfang = motorQuelle.indexOf("if (block.type === 'text' && block.text?.trim()")
    expect(anfang).toBeGreaterThan(0)
    const rumpf = motorQuelle.slice(anfang, anfang + 900)
    expect(rumpf).toMatch(/rohenCliFehlerUebersetzen\(/)
    expect(rumpf).toMatch(/nurGanzerText: true/)
    expect(rumpf).toMatch(/klartext \? klartext\.fehlertext : rohText/)
  })

  it('ein Fazit, das nur die Marke ist, macht den Block fehlgeschlagen — VOR dem Erfolg', () => {
    const marke = motorQuelle.indexOf('const rohMarke =')
    const erfolg = motorQuelle.indexOf("if (block.fazit) return blockAufloesen('erfolgreich'")
    expect(marke).toBeGreaterThan(0)
    expect(marke).toBeLessThan(erfolg)
    const rumpf = motorQuelle.slice(marke, erfolg)
    expect(rumpf).toMatch(/block\.agentFehler/)
    expect(rumpf).toMatch(/block\.fazit/)
    expect(rumpf).toMatch(/rohMarkenInfo\(\)/)
    expect(rumpf).toMatch(/blockAufloesen\('fehlgeschlagen', rohMarke\)/)
  })

  it('die strenge Prüfung gilt für Agenten-Text (Ticker, Fazit)', () => {
    const anfang = motorQuelle.indexOf('const rohMarkenInfo = () => ({')
    expect(anfang).toBeGreaterThan(0)
    expect(motorQuelle.slice(anfang, anfang + 300)).toMatch(/nurGanzerText: true/)
  })

  it('die Übersetzung steht VOR der Kontingent-Regel in fehlerAusErgebnis', () => {
    const roh = motorQuelle.indexOf('const roh = rohenCliFehlerUebersetzen(text, {')
    const kontingent = motorQuelle.indexOf('texte.lauf.kontingentErschoepft')
    expect(roh).toBeGreaterThan(0)
    expect(roh).toBeLessThan(kontingent)
  })
})

// Nacharbeit nach den Nachstellwegen von Prüfer 1 (0.51.1).
describe('Nacharbeit Prüfer 1 · Umhüllte Marken und erwartete Abbrüche', () => {
  const motorQuelle = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main', 'motor', 'claudeCodeMotor.js'),
    'utf8'
  )

  it('streng: eine kurz umhüllte Marke zählt noch als Marke', () => {
    for (const text of [
      'API Error: Prompt is too long',
      'Error: Prompt is too long',
      'error Prompt is too long'
    ])
      expect(rohenCliFehlerUebersetzen(text, { nurGanzerText: true })?.fehlerArt).toBe('kontext-voll')
    expect(
      rohenCliFehlerUebersetzen('API Error: [Request interrupted by user for tool use]', {
        nurGanzerText: true
      })?.fehlerArt
    ).toBe('werkzeug-abbruch')
  })

  it('streng: Erzähltext über die Marke bleibt weiterhin unangetastet', () => {
    for (const text of [
      'Der vorige Lauf endete mit „Prompt is too long" — ich prüfe den Stand.',
      'Prompt is too long (see logs)',
      'The situation is clear: the previous run ended with "Prompt is too long".'
    ])
      expect(rohenCliFehlerUebersetzen(text, { nurGanzerText: true })).toBeNull()
  })

  it('agentFehler wird nicht-streng geprüft (is_error ist nie Erzähltext)', () => {
    const marke = motorQuelle.indexOf('const rohMarke =')
    const rumpf = motorQuelle.slice(marke, marke + 400)
    expect(rumpf).toMatch(/rohenCliFehlerUebersetzen\(block\.agentFehler, lokalFehlerInfo\(\)\)/)
    expect(rumpf).toMatch(/rohenCliFehlerUebersetzen\(block\.fazit, rohMarkenInfo\(\)\)/)
  })

  it('erwarteter Abbruch (Stopp, Wächter-Übertrag) erzeugt keine Abbruch-Ticker-Zeile', () => {
    expect(motorQuelle).toMatch(/abbruchErwartet = false/)
    expect(motorQuelle).toMatch(/'werkzeug-abbruch' && abbruchErwartet\) continue/)
    expect(motorQuelle).toMatch(
      /sanftAngefordert \|\| hartAngefordert \|\| block\?\.uebertragPhase != null/
    )
  })
})
