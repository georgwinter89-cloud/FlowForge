// Prüfungen zur Befehls-Einstufung (Zweit-Audit C-01, C-02, C-03).
// Rot-vor-Grün: Jeder Befund-Fall schlug vor seiner Behebung nachweislich fehl.
import { describe, it, expect } from 'vitest'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'

const projekt = 'D:\\pruefungen-uebungsprojekt'

function bash(befehl, { nurLesen = false } = {}) {
  return pruefeWerkzeug('Bash', { command: befehl }, projekt, nurLesen, false)
}

describe('C-01 · Befehls-Zerlegung: &, $(…), Backticks, <(…)', () => {
  it('sperrt das einzelne & unter „darf nur lesen"', () => {
    expect(bash('dir & del wichtig.js', { nurLesen: true }).gesperrt).toBeTruthy()
  })
  it('sperrt $(…)-Unterausführung unter „darf nur lesen"', () => {
    expect(bash('cat $(rm -rf x)', { nurLesen: true }).gesperrt).toBeTruthy()
  })
  it('sperrt Backtick-Unterausführung unter „darf nur lesen"', () => {
    expect(bash('cat `rm -rf x`', { nurLesen: true }).gesperrt).toBeTruthy()
  })
  it('sperrt <(…)-Prozess-Substitution unter „darf nur lesen"', () => {
    expect(bash('cat <(rm -rf x)', { nurLesen: true }).gesperrt).toBeTruthy()
  })
  it('lässt auch Git in einer Unterausführung nicht als „rein lesend" durch', () => {
    expect(bash('cat $(git push origin main)', { nurLesen: true }).gesperrt).toBeTruthy()
  })
  it('gibt das einzelne & im Bauer-Pfad nicht rückfragefrei durch', () => {
    const urteil = bash('dir & del wichtig.js')
    expect(urteil.erlaubt).toBeUndefined()
    expect(urteil.frage).toBeTruthy()
  })
  it('Gegenprobe: && trennt weiterhin, beide Teile werden eingestuft', () => {
    expect(bash('dir && del wichtig.js', { nurLesen: true }).gesperrt).toBeTruthy()
    expect(bash('dir && type a.txt', { nurLesen: true }).erlaubt).toBe(true)
  })
  it('Gegenprobe: 2>&1 bleibt eine harmlose Umleitung, kein &-Trenner', () => {
    expect(bash('dir 2>&1', { nurLesen: true }).erlaubt).toBe(true)
  })
})

describe('C-02 · Ausgabe-Umleitung gegen die Projektgrenze', () => {
  it('fragt bei Umleitung außerhalb des Projektordners (relativer Pfad)', () => {
    const urteil = bash('echo geheim > ..\\..\\ausserhalb.txt')
    expect(urteil.erlaubt).toBeUndefined()
    expect(urteil.frage).toBeTruthy()
  })
  it('fragt bei Umleitung außerhalb des Projektordners (absoluter Pfad)', () => {
    const urteil = bash('echo geheim >> C:\\ausserhalb.txt')
    expect(urteil.erlaubt).toBeUndefined()
    expect(urteil.frage).toBeTruthy()
  })
  it('Gegenprobe: Umleitung ins Projekt bleibt rückfragefrei', () => {
    expect(bash('echo hallo > notiz.txt').erlaubt).toBe(true)
    expect(bash('npm test > protokoll.txt').erlaubt).toBe(true)
  })
  it('Gegenprobe: Wegwerf-Ziele (nul, /dev/null) bleiben rückfragefrei', () => {
    expect(bash('dir > nul').erlaubt).toBe(true)
    expect(bash('ls > /dev/null 2>&1').erlaubt).toBe(true)
  })
})

describe('C-03 · Bash-Umgebungsvorsilbe VAR=wert', () => {
  it('stuft den eigentlichen Befehl hinter der Vorsilbe ein (keine Rückfrage)', () => {
    expect(bash('NODE_ENV=test npm test').erlaubt).toBe(true)
  })
  it('mehrere Vorsilben hintereinander', () => {
    expect(bash('NODE_ENV=test CI=1 npm test').erlaubt).toBe(true)
  })
  it('Gegenprobe: gefährliche Variablen (PATH) bleiben rückfragepflichtig', () => {
    expect(bash('PATH=C:\\boese npm test').erlaubt).toBeUndefined()
  })
  it('Gegenprobe: NODE_OPTIONS kann Code einschleusen und bleibt rückfragepflichtig', () => {
    expect(bash('NODE_OPTIONS=--require=boese.js npm test').erlaubt).toBeUndefined()
  })
  it('Gegenprobe: Vorsilbe mit Unterausführung bleibt gesperrt bzw. fragt', () => {
    expect(bash('X=$(rm -rf x) dir', { nurLesen: true }).gesperrt).toBeTruthy()
  })
})
