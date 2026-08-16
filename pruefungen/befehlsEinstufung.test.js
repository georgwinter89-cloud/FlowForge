// Prüfungen zur Befehls-Einstufung (Zweit-Audit C-01, C-02, C-03).
// Rot-vor-Grün: Jeder Befund-Fall schlug vor seiner Behebung nachweislich fehl.
import { describe, it, expect } from 'vitest'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

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
  // Rot-vor-Grün (BAUPLAN 44): Vor dieser Zeile kannte WEGWERF_ZIEL nur die
  // Bash-Schreibweisen. FlowForge läuft aber auf Windows und ruft PowerShell —
  // dort ist „2>$null" das übliche Idiom, und die Zerlegung las „$null" als
  // Pfad. Weil Dateilisten-Sperre, Prüfmappe und „darf nur lesen" über dieselbe
  // Rechnung entscheiden, stoppte ein Alltagsbefehl den Block gleich dreifach.
  it('Gegenprobe: PowerShells $null ist ebenso ein Wegwerf-Ziel wie NUL', () => {
    for (const befehl of ['npm test 2>$null', 'npm test > $null', 'npm test 1>$null'])
      expect(bash(befehl).erlaubt).toBe(true)
    expect(bash('Get-Content src/main/lauf.js 2>$null', { nurLesen: true }).erlaubt).toBe(true)
    expect(bash('Select-String "=>" src/main/lauf.js 2>$null', { nurLesen: true }).erlaubt).toBe(true)
  })
  it('nur der Name selbst zählt — ein Ziel, das bloß so anfängt, bleibt eine echte Datei', () => {
    expect(bash('npm test > $nullwert.txt', { nurLesen: true }).gesperrt).toBeTruthy()
    expect(bash('npm test > $null.txt', { nurLesen: true }).gesperrt).toBeTruthy()
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

// Abschlussprüfung Bauschritt 44: Zwei Nachbar-Funktionen entschieden dieselbe
// Frage („ist das eine Datei-Umleitung?") noch mit einem schlichten Test auf das
// Zeichen „>" — und gaben damit eine andere Antwort als der Rest des Motors, der
// dafür längst die vollständige Zerlegung (umleitungsZiele) hat. Beide Male war
// die Folge ein hart gestoppter Block ohne Ausweg: {gesperrt} ist absichtlich
// keine Rückfrage, Georgs Automodus kann sie also nicht durchwinken.
//
// Rot vor Grün: Mit der alten Fassung wurde JEDER Befehl in den ersten beiden
// Prüfungen gesperrt — allein wegen des Pfeils im Suchmuster.
describe('Prüfmappe · nur eine echte Umleitung ändert sie, kein Pfeil im Suchmuster', () => {
  it('lässt reines Lesen und den Prüflauf mit Pfeil im Muster durch', () => {
    // SPEC §7 sperrt, was „erkennbar hineinschreibt" — ein grep schreibt nicht.
    expect(bash('cat pruefung/p1/x.test.js | grep "=>"').erlaubt).toBe(true)
    expect(bash('grep -n "a => b" pruefung/p1/x.test.js').erlaubt).toBe(true)
    // SPEC §4.3 erlaubt dem Bauer den Prüflauf am Ende — auch mit „>" im Filter.
    expect(bash('npx vitest run pruefung/p1/x.test.js -t "a > b"').erlaubt).toBe(true)
  })

  it('stoppt eine echte Umleitung in die Prüfmappe weiterhin hart', () => {
    for (const befehl of [
      'echo x > pruefung/p1/x.test.js',
      'npm test >> pruefung/protokoll.txt',
      'sed -i "s/a/b/" pruefung/p1/x.test.js'
    ])
      expect(bash(befehl).gesperrt).toBe(texte.rechteFrage.pruefmappeGesperrtFuerAgent)
  })

  it('behält die harmlosen Umleitungen bei — die Zerlegung deckt sie selbst ab', () => {
    // Vorher zogen zwei replace-Vorstufen 2>&1 und die Wegwerf-Ziele ab; die
    // Zerlegung kennt beide (Kanal-Umleitung bzw. kein Ziel), die Vorstufen sind
    // damit überflüssig geworden.
    expect(bash('node pruefung/p1/x.test.js 2>&1').erlaubt).toBe(true)
    expect(bash('node pruefung/p1/x.test.js > nul').erlaubt).toBe(true)
    expect(bash('node pruefung/p1/x.test.js > /dev/null 2>&1').erlaubt).toBe(true)
    // Dieselbe Zusage in der PowerShell-Schreibweise: Genau der Prüflauf, den
    // SPEC §4.3 dem Bauer einmal am Ende erlaubt.
    expect(bash('npx vitest run pruefung/p1/x.test.js 2>$null').erlaubt).toBe(true)
  })
})

describe('„Darf nur lesen" · nach Pfeilen suchen ist Lesen', () => {
  it('lässt einen Lesebefehl mit Pfeil im Suchmuster durch', () => {
    // SPEC §7 sagt wörtlich zu: „Rein lesende Befehle laufen auch unter der
    // Sperre durch". Der Ticker behauptete das vorher, während er genau diese
    // Befehle stoppte.
    expect(bash('grep -rn "=>" src/', { nurLesen: true }).erlaubt).toBe(true)
    expect(bash('grep -rn "a > b" src/', { nurLesen: true }).erlaubt).toBe(true)
    expect(bash('findstr "a > b" src/main/lauf.js', { nurLesen: true }).erlaubt).toBe(true)
    expect(bash("grep -rn 'x >= y' src/", { nurLesen: true }).erlaubt).toBe(true)
  })

  it('sperrt jede ECHTE Datei-Umleitung weiterhin hart — das ist der Unterschied', () => {
    for (const befehl of [
      'grep x > out.txt',
      'type a.txt > b.txt',
      'grep x >> out.txt',
      'cat a.txt > "mit leerzeichen.txt"',
      'grep -rn "=>" src/ > treffer.txt'
    ]) {
      const urteil = bash(befehl, { nurLesen: true })
      expect(urteil.gesperrt).toBe(texte.rechteFrage.nurLesenBefehlFuerAgent)
      expect(urteil.tickerText).toBe(texte.ticker.nurLesenBefehlGesperrt)
    }
  })

  it('sperrt weiterhin jeden Befehl mit einem nicht-lesenden Teilstück', () => {
    for (const befehl of [
      'grep -rn "=>" src/ && del wichtig.js',
      'npm test',
      'grep -rn "=>" $(rm -rf x)',
      'node -e "console.log(1)"',
      'grep -rn "=>" src/ | sed -i "s/a/b/" x.js'
    ])
      expect(bash(befehl, { nurLesen: true }).gesperrt).toBe(
        texte.rechteFrage.nurLesenBefehlFuerAgent
      )
  })
})
