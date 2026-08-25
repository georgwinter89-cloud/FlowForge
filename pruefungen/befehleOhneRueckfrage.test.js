// Prüfungen zu BEFEHLE_OHNE_RUECKFRAGE (Bauschritt 56): Die Testbefehle, die
// FlowForge SELBST ohne Rückfrage abspielt (PRUEFBEFEHL_WERKZEUGE, die kürzere
// Leine), dürfen einem Agenten-Block nie eine Rechte-Rückfrage auslösen — sonst
// steht ein Rust-/Java-/.NET-/PHP-Projekt beim Alltagsfall „Tests laufen lassen".
// Die Listen bleiben bewusst getrennt (keine Ableitung); diese Prüfung hält
// stattdessen fest, dass die zweite Liste nie enger ist als die erste.
import { describe, it, expect } from 'vitest'
import { pruefeWerkzeug, BEFEHLE_OHNE_RUECKFRAGE } from '../src/main/motor/claudeCodeMotor.js'
import { PRUEFBEFEHL_WERKZEUGE } from '../src/shared/torRegeln.js'

const projekt = 'D:\\pruefungen-uebungsprojekt'

function bash(befehl, { nurLesen = false } = {}) {
  return pruefeWerkzeug('Bash', { command: befehl }, projekt, nurLesen, false)
}

describe('Obermengen-Invariante · Agenten-Liste nie enger als die Tor-Liste', () => {
  it('jedes Werkzeug aus PRUEFBEFEHL_WERKZEUGE steht in BEFEHLE_OHNE_RUECKFRAGE', () => {
    for (const werkzeug of PRUEFBEFEHL_WERKZEUGE)
      expect(BEFEHLE_OHNE_RUECKFRAGE.has(werkzeug), `fehlt: ${werkzeug}`).toBe(true)
  })
})

describe('Testbefehle ohne Rückfrage · der Alltagsfall fremder Ökosysteme', () => {
  it('lässt Testläufe von Go, Rust, .NET, Java und make rückfragefrei durch', () => {
    for (const befehl of [
      'go test ./...',
      'cargo test',
      'make test',
      'dotnet test',
      'mvn -q test'
    ])
      expect(bash(befehl).erlaubt, `fragte nach: ${befehl}`).toBe(true)
  })

  it('lässt die Projekt-Wrapper gradlew/gradlew.bat durch (Fund D-4)', () => {
    // befehlsNamen schneidet Pfad-Vorspann und .bat ab — beide Schreibweisen
    // landen auf dem nackten Namen „gradlew".
    expect(bash('.\\gradlew.bat test').erlaubt).toBe(true)
    expect(bash('./gradlew test').erlaubt).toBe(true)
  })
})

describe('Gegenprobe · „darf nur lesen" bleibt die härtere Regel (Fund D-5)', () => {
  it('sperrt go test unter nurLesen ohne die Einstellung nurLesenBefehle hart', () => {
    // Rein lesend ist nur LESE_BEFEHLE — ein Testlauf kann alles Mögliche
    // schreiben und bleibt deshalb ein hartes Nein, keine Rückfrage.
    const urteil = bash('go test', { nurLesen: true })
    expect(urteil.gesperrt).toBeTruthy()
    expect(urteil.erlaubt).toBeUndefined()
  })
})
