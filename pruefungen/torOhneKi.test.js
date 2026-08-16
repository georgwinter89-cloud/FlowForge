// Prüfungen zum Tor ohne KI (BAUPLAN 35).
// Rot-vor-Grün: Alle Fälle hier schlugen vor dem Bauschritt fehl — es gab
// weder torRegeln.js noch pruefbefehl.js, und pruefeWerkzeug ließ ein
// mcp__pruefbefehl__-Werkzeug als „unbekanntes Werkzeug" durch die
// Rückfrage-Schleife statt es dem Prüfer zuzuordnen. Beim Nachbauen wurden die
// Erwartungen zusätzlich einzeln verfälscht (z.B. „npm test" als unzulässig
// erwartet) und liefen dann nachweislich rot.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  pruefbefehlPruefen,
  fehlerZeilen,
  neueFehler,
  PRUEFBEFEHL_MAX
} from '../src/shared/torRegeln.js'
import { grundsaetzlicheBeanstandungen } from '../src/shared/lieferschein.js'
import {
  pruefbefehlSetzen,
  pruefbefehlLaden,
  pruefbefehlLeeren,
  pruefbefehlArchivieren,
  pruefbefehlArchivLaden,
  PRUEFBEFEHL_DATEI
} from '../src/main/pruefbefehl.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'

describe('BAUPLAN 35 · Prüfbefehl an kurzer Leine', () => {
  it('lässt einen einfachen Testlauf zu', () => {
    expect(pruefbefehlPruefen('npm test').befehl).toBe('npm test')
    expect(pruefbefehlPruefen('npx vitest run pruefung').befehl).toBe('npx vitest run pruefung')
    expect(pruefbefehlPruefen('python pruefung/pruefe.py').befehl).toBe('python pruefung/pruefe.py')
  })

  // Der Kern der Sicherheitsfrage: FlowForge führt diesen Befehl später OHNE
  // Rechte-Rückfrage aus. Käme hier eine Verkettung durch, wäre die
  // Befehls-Einstufung des Motors (SPEC §7) über die Hintertür ausgehebelt.
  it('weist Verkettung, Umleitung und Unterausführung ab', () => {
    for (const befehl of [
      'npm test && del wichtig.js',
      'npm test & rmdir /s /q src',
      'npm test | findstr x',
      'npm test; rm -rf .',
      'npm test > ausgabe.txt',
      'npm test `rm -rf x`',
      'node $(echo boese.js)'
    ])
      expect(pruefbefehlPruefen(befehl).fehlerArt, befehl).toBe('verkettung')
  })

  it('lässt nur Test-Werkzeuge als ersten Befehl zu', () => {
    expect(pruefbefehlPruefen('git push origin main').fehlerArt).toBe('werkzeug')
    expect(pruefbefehlPruefen('powershell -c Get-Content x').fehlerArt).toBe('werkzeug')
    expect(pruefbefehlPruefen('cmd /c npm test').fehlerArt).toBe('werkzeug')
    expect(pruefbefehlPruefen('curl http://boese.example').fehlerArt).toBe('werkzeug')
  })

  it('erkennt das Werkzeug auch mit Pfad und Endung', () => {
    expect(pruefbefehlPruefen('C:\\nodejs\\npm.cmd test').befehl).toContain('npm.cmd')
  })

  // Ehrliche Grenze, bewusst so: Ein Pfad mit Leerzeichen lässt sich nicht
  // zuverlässig vom Befehl trennen — und ein Prüfbefehl braucht keinen
  // absoluten Pfad, er läuft ohnehin im Projektordner. Lieber eine Ablehnung
  // mit klarer Begründung als ein Befehl, dessen erstes Wort geraten ist.
  it('lehnt einen Pfad mit Leerzeichen ab', () => {
    expect(pruefbefehlPruefen('"C:\\Program Files\\nodejs\\npm.cmd" test').fehlerArt).toBe(
      'werkzeug'
    )
  })

  it('weist Leeres und Überlanges ab', () => {
    expect(pruefbefehlPruefen('   ').fehlerArt).toBe('leer')
    expect(pruefbefehlPruefen('npm test ' + 'x'.repeat(PRUEFBEFEHL_MAX)).fehlerArt).toBe('zuLang')
  })
})

describe('BAUPLAN 35 · Baseline „vorher schon rot"', () => {
  const rot = [
    'FAIL pruefung/tunnel.test.js > Zug dunkelt ab',
    '  AssertionError: expected 0.5 to be 0.05',
    'Tests  1 failed | 4 passed (5)'
  ].join('\n')

  it('erkennt Fehlerzeilen und lässt harmlose Zeilen liegen', () => {
    const funde = fehlerZeilen(rot + '\nDuration 812ms\nRUN v4.1.10')
    expect(funde.map((f) => f.zeile)).toContain('FAIL pruefung/tunnel.test.js > Zug dunkelt ab')
    expect(funde.some((f) => f.zeile.includes('Duration'))).toBe(false)
  })

  // Das ist die eigentliche Zusage des Schritts: Altlasten verbrennen keine
  // Reparatur-Runde. Ohne Zahlen-Normalisierung würde schon eine geänderte
  // Laufzeit oder Testzahl jede Altlast als „neu kaputt" melden.
  it('meldet nichts Neues, wenn dieselben Fehler schon vorher da waren', () => {
    const spaeter = rot.replace('812ms', '907ms').replace('(5)', '(7)')
    expect(neueFehler(rot, spaeter)).toEqual([])
  })

  it('meldet einen hinzugekommenen Fehlschlag', () => {
    const spaeter = rot + '\nFAIL pruefung/weiche.test.js > Weiche stellt um'
    const neu = neueFehler(rot, spaeter)
    expect(neu).toHaveLength(1)
    expect(neu[0]).toContain('weiche.test.js')
  })

  it('meldet ohne Baseline schlicht alle Fehlerzeilen', () => {
    expect(neueFehler('', rot).length).toBeGreaterThan(0)
  })
})

describe('BAUPLAN 35/42 · Grün-Fall: nur noch die grundsätzlichen Beanstandungen', () => {
  // Seit dem Lieferschein (BAUPLAN 42) steht die Einstufung als Feld in der
  // Meldung — gefiltert wird danach, nicht nach einer Marker-Zeile im Text.
  const beanstandungen = [
    { einstufung: 'mechanisch', text: 'In js/render.js Zeile 42 steht 0.5 statt 0.05.', fundort: '' },
    { einstufung: 'grundsaetzlich', text: 'Die Tunnel-Logik braucht einen Umbau.', fundort: '' }
  ]

  it('filtert die mechanischen heraus, wenn der Prüfbefehl grün ist', () => {
    const uebrig = grundsaetzlicheBeanstandungen(beanstandungen)
    expect(uebrig).toHaveLength(1)
    expect(uebrig[0].text).toContain('Tunnel-Logik')
  })

  it('liefert eine leere Liste, wenn nur mechanische Beanstandungen offen waren', () => {
    expect(grundsaetzlicheBeanstandungen([beanstandungen[0]])).toHaveLength(0)
  })

  it('kommt mit fehlender Liste zurecht', () => {
    expect(grundsaetzlicheBeanstandungen(undefined)).toEqual([])
  })
})

describe('BAUPLAN 35 · Ablage und Archiv des Prüfbefehls', () => {
  let projekt

  beforeEach(() => {
    projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-tor-'))
  })
  afterEach(() => {
    fs.rmSync(projekt, { recursive: true, force: true })
  })

  // Seit BAUPLAN 41 gehört jeder Prüfbefehl einer Prüf-Instanz — die Aufrufe
  // tragen deshalb deren Kennung.
  const prueferA = 'instanz-a'

  it('legt den Prüfbefehl ab und liest ihn zurück', () => {
    expect(pruefbefehlSetzen(projekt, prueferA, 'npm test').ok).toBe(true)
    expect(fs.existsSync(path.join(projekt, PRUEFBEFEHL_DATEI))).toBe(true)
    expect(pruefbefehlLaden(projekt, prueferA)).toBe('npm test')
  })

  it('lehnt einen unzulässigen Befehl mit Begründung ab, ohne etwas abzulegen', () => {
    const ergebnis = pruefbefehlSetzen(projekt, prueferA, 'npm test && del x')
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehler).toBeTruthy()
    expect(fs.existsSync(path.join(projekt, PRUEFBEFEHL_DATEI))).toBe(false)
  })

  // Eine Datei, die auf anderem Weg entstanden ist (Wiederherstellung eines
  // alten Stands, Handarbeit), darf das Tor nicht mit einem Befehl füttern,
  // den die Validierung heute ablehnen würde.
  it('behandelt eine unzulässig gewordene Datei wie „kein Prüfbefehl"', () => {
    fs.writeFileSync(
      path.join(projekt, PRUEFBEFEHL_DATEI),
      JSON.stringify({ befehle: { [prueferA]: { befehl: 'npm test && del x' } } }),
      'utf8'
    )
    expect(pruefbefehlLaden(projekt, prueferA)).toBeNull()
  })

  it('leert den Prüfbefehl beim Laufstart, behält aber das Archiv', () => {
    pruefbefehlSetzen(projekt, prueferA, 'npm test')
    pruefbefehlArchivieren(projekt, prueferA)
    pruefbefehlLeeren(projekt)
    expect(pruefbefehlLaden(projekt, prueferA)).toBeNull()
    expect(pruefbefehlArchivLaden(projekt, prueferA)).toBe('npm test')
  })
})

describe('BAUPLAN 35 · Sperren rund um den Prüfbefehl', () => {
  const projekt = 'D:\\pruefungen-uebungsprojekt'
  const werkzeug = (darfPruefen) =>
    pruefeWerkzeug(
      'mcp__pruefbefehl__pruefbefehl_setzen',
      { befehl: 'npm test' },
      projekt,
      false,
      darfPruefen
    )

  it('gibt das Werkzeug im Prüfer frei', () => {
    expect(werkzeug(true).erlaubt).toBe(true)
  })

  it('fragt in anderen Blöcken nach, statt hart zu sperren', () => {
    const urteil = werkzeug(false)
    expect(urteil.erlaubt).toBeUndefined()
    expect(urteil.gesperrt).toBeUndefined()
    expect(urteil.frage).toBeTruthy()
  })

  // pruefbefehl.json ist eine Verwaltungsdatei: Direktes Schreiben würde die
  // Validierung umgehen — und damit die einzige Schranke vor einem Befehl,
  // den FlowForge ungefragt ausführt.
  it('sperrt das direkte Schreiben der Verwaltungsdatei', () => {
    const urteil = pruefeWerkzeug(
      'Write',
      { file_path: path.join(projekt, 'pruefbefehl.json') },
      projekt,
      false,
      true
    )
    expect(urteil.gesperrt).toBeTruthy()
  })
})
