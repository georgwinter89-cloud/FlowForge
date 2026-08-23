// Prüfungen zu Fund 4 (Abendlauf am Haushaltsplaner, 22.08.2026): Der Inhalt
// eines Heredocs ist Text, kein Befehl — die Umleitungs-Zerlegung darf ihn
// nicht mehr durchsuchen.
//
// Was im Ticker stand:
//   19:45:53  Schreiben an „-1)" gestoppt — die Datei steht nicht in der
//             Dateiliste des Arbeitspakets dieses Blocks.
// `-1)` ist kein Dateiname. Der Bauer schrieb per Heredoc nach
// `arbeitsablage/` — der ausdrücklich freien Wegwerf-Fläche —, und im
// geschriebenen Quelltext stand ein Vergleich der Form `i > -1`. Die Zerlegung
// las den Pfeil als Umleitung und das Folgewort als Ziel.
//
// Das Gewicht des Fehlgriffs: Die Dateilisten-Sperre ist eine HARTE Sperre
// ohne Rückfrage (im Automodus wäre eine Rückfrage wirkungslos). Der Bauer kam
// hier davon, weil er das Write-Werkzeug als Ausweg hatte (drei Minuten
// Verlust); ein nur-lesender Block hätte keinen.
//
// Was ausdrücklich NICHT betroffen war: Pfeilfunktionen. `=>` fängt die
// Zerlegung längst am Gleichheitszeichen ab. Die Auslöser sind Vergleiche und
// HTML-Fragmente.
//
// Rot vor Grün, so gemessen: Ohne ohneHeredocKoerper liefert
//   bauer('Bash', { command: "cat > arbeitsablage/x.js <<'EOF'\nif (i > -1) {}\nEOF" })
// ein `gesperrt` mit dem Ziel „-1)". Mit der Reparatur ist es erlaubt. Die
// Gegenrichtung wurde ebenso rot gesehen: Die Erwartung „ein Heredoc ohne
// Schlusszeile wird trotzdem geschnitten" schlägt fehl — genau so soll es sein.
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { pruefeWerkzeug, ohneHeredocKoerper } from '../src/main/motor/claudeCodeMotor.js'

const projekt = path.resolve('C:/Projekte/Beispiel')
const liste = ['js/wochenplan.js']

// Ein Bauer mit Datenvertrag — dieselbe Argumentliste, die der Motor stellt.
function bauer(befehl) {
  return pruefeWerkzeug(
    'Bash',
    { command: befehl },
    projekt,
    false, // nurLesen
    false, // darfPruefen
    true, // lokaleKi
    false, // nurLesenBefehle
    false, // darfKartenAnlegen
    false, // darfVorschlagen
    false, // darfLaufVorschlag
    false, // darfZuteilen
    '', // pruefOrdner
    [], // lieferscheinFrei
    liste,
    false // inWelle
  )
}

describe('Fund 4 · Der Körper eines Heredocs ist kein Befehlstext', () => {
  it('stoppt den gemessenen Fall nicht mehr — ein Vergleich im Quelltext', () => {
    const urteil = bauer("cat > arbeitsablage/pruef.js <<'EOF'\nif (i > -1) { ok() }\nEOF")
    expect(urteil.gesperrt).toBeUndefined()
  })

  it('lässt HTML im Körper durch — `<div>Text</div>` sah wie das Ziel „Text" aus', () => {
    expect(bauer('cat > arbeitsablage/x.html <<EOF\n<div>Text</div>\nEOF').gesperrt).toBeUndefined()
  })

  it('prüft die Umleitung der Kopfzeile weiterhin — sie steht außerhalb des Körpers', () => {
    // Genau das darf die Reparatur NICHT verlieren: Das Ziel des Heredocs
    // selbst ist eine echte Umleitung und muss gegen die Dateiliste laufen.
    expect(bauer("cat > js/fremd.js <<'EOF'\nharmlos\nEOF").gesperrt).toBeTruthy()
  })

  it('prüft weiter, was NACH der Schlusszeile kommt', () => {
    expect(
      bauer("cat > arbeitsablage/x.js <<'EOF'\ni > -1\nEOF\necho x > js/fremd.js").gesperrt
    ).toBeTruthy()
  })
})

describe('Fund 4 · Die Erkennung ist streng — ein Fehlschnitt machte die Sperre blind', () => {
  it('schneidet nichts ohne Schlusszeile', () => {
    const text = 'cat <<EOF\necho x > js/fremd.js'
    expect(ohneHeredocKoerper(text)).toBe(text)
    expect(bauer(text).gesperrt).toBeTruthy()
  })

  it('hält den Schiebe-Operator nicht für ein Heredoc', () => {
    // `1 << 3` hat kein Wort-Kennzeichen — sonst wäre jede Bit-Rechnung eine
    // Einladung, die Zeilen danach ungeprüft durchzulassen.
    const text = 'node -e "var a = 1 << 3"\necho x > js/fremd.js\n3'
    expect(ohneHeredocKoerper(text)).toBe(text)
    expect(bauer(text).gesperrt).toBeTruthy()
  })

  it('hält `<<<` (Hier-Zeichenkette) nicht für ein Heredoc', () => {
    const text = 'cat <<<EOF\necho x > js/fremd.js\nEOF'
    expect(ohneHeredocKoerper(text)).toBe(text)
    expect(bauer(text).gesperrt).toBeTruthy()
  })

  it('schneidet nicht, wenn eine Shell den Körper AUSFÜHRT', () => {
    // `bash <<'EOF' … EOF` führt die Zeilen darin wirklich aus — dort sind die
    // Pfeile echte Umleitungen. Ehrliche Grenze, ausdrücklich geprüft.
    expect(bauer("bash <<'EOF'\necho x > js/fremd.js\nEOF").gesperrt).toBeTruthy()
    expect(bauer("sh <<'EOF'\necho x > js/fremd.js\nEOF").gesperrt).toBeTruthy()
  })
})

describe('Fund 4 · Die Schreibweisen, die wirklich vorkommen', () => {
  const faelle = [
    ["cat > arbeitsablage/a.js <<'EOF'\ni > -1\nEOF", 'einfache Anführungszeichen'],
    ['cat > arbeitsablage/a.js <<"EOF"\ni > -1\nEOF', 'doppelte Anführungszeichen'],
    ['cat > arbeitsablage/a.js <<EOF\ni > -1\nEOF', 'ohne Anführungszeichen'],
    ['cat > arbeitsablage/a.js << EOF\ni > -1\nEOF', 'mit Leerzeichen'],
    ['cat > arbeitsablage/a.js <<-EOF\n\ti > -1\n\tEOF', 'mit Bindestrich-Kopf'],
    ['cat > arbeitsablage/a.js <<MARKE\ni > -1\nMARKE', 'eigenes Kennzeichen']
  ]
  for (const [befehl, wie] of faelle)
    it(`erkennt das Heredoc ${wie}`, () => {
      expect(bauer(befehl).gesperrt).toBeUndefined()
    })

  it('erkennt PowerShells Hier-Zeichenkette', () => {
    expect(
      bauer("Set-Content arbeitsablage/a.js @'\nif (i > -1) {}\n'@").gesperrt
    ).toBeUndefined()
  })

  it('kommt mit zwei Heredocs hintereinander zurecht', () => {
    const text =
      "cat > arbeitsablage/a.js <<'A'\ni > -1\nA\ncat > arbeitsablage/b.js <<'B'\nn > 0\nB"
    expect(bauer(text).gesperrt).toBeUndefined()
  })
})
