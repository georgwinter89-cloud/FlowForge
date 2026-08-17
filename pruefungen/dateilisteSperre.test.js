// Prüfungen zur Dateiliste als Schreibsperre (BAUPLAN 44) in Alltagssprache:
// Ein Bauer darf nur die Dateien anfassen, die der Datenvertrag seines
// Arbeitspakets nennt — Schreibversuche daneben werden hart gestoppt (keine
// Rückfrage: im Automodus wäre sie wirkungslos). Frei bleiben seine
// Wegwerf-Fläche arbeitsablage/ und der eigene Prüfordner; ohne Dateiliste
// sperrt gar nichts, damit ein wiederaufgenommener Lauf von vor dem Bauschritt
// nicht stehenbleibt.
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es stehtInDateiliste nicht (Import
// rot), pruefeWerkzeug hatte 13 Positionsparameter und kannte keinen
// Datenvertrag — jeder Schreibversuch lief durch, auch außerhalb des Pakets.
// Beim Nachbauen wurde zusätzlich je eine Erwartung verfälscht (z.B.
// „arbeitsablage/ ist gesperrt", „auch der Prüfer wird gesperrt") und rot
// gesehen, bevor sie richtiggestellt wurde.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { pruefeWerkzeug, stehtInDateiliste } from '../src/main/motor/claudeCodeMotor.js'
import { dateiListeVereinigen, meldungPruefen } from '../src/shared/lieferschein.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const projekt = path.resolve('C:/Projekte/Beispiel')
const liste = ['src/main/lauf.js', 'src/shared/texte.js', 'src/renderer/src/']

// Die volle Argumentliste eines Bau-Blocks, so wie der Motor sie stellt —
// Reihenfolge und Anzahl sind hier das Eigentliche (Fund 12 der Angriffsliste).
function bauer(name, eingabe, { dateiListe = liste, pruefOrdner = '' } = {}) {
  return pruefeWerkzeug(
    name,
    eingabe,
    projekt,
    false, // nurLesen
    false, // darfPruefen
    true, // lokaleKi
    false, // nurLesenBefehle
    false, // darfKartenAnlegen
    false, // darfVorschlagen
    false, // darfLaufVorschlag
    false, // darfZuteilen
    pruefOrdner,
    [], // lieferscheinFrei
    dateiListe,
    false // inWelle (BAUPLAN 46) — die Welle prüft wellenSperren.test.js
  )
}

describe('BAUPLAN 44 · Der Datenvertrag entscheidet, was ein Bauer schreiben darf', () => {
  it('lässt eine Datei aus der Liste durch', () => {
    expect(bauer('Write', { file_path: 'src/main/lauf.js' }).erlaubt).toBe(true)
    // Auch mit „./" davor und mit Schrägstrichen andersherum — die Liste kommt
    // als Modelltext, die Prüfung rechnet in Windows-Pfaden.
    expect(bauer('Edit', { file_path: './src/main/lauf.js' }).erlaubt).toBe(true)
    expect(bauer('Edit', { file_path: 'src\\main\\lauf.js' }).erlaubt).toBe(true)
  })

  it('lässt alles unter einem genannten Ordner durch — auch Dateien, die erst entstehen', () => {
    expect(bauer('Write', { file_path: 'src/renderer/src/NeueAnsicht.jsx' }).erlaubt).toBe(true)
    // Geprüft wird der gemeldete Pfad, nie der Dateibestand: Der Vertrag nennt
    // ausdrücklich auch neu anzulegende Dateien.
    expect(fs.existsSync(path.join(projekt, 'src/renderer/src/NeueAnsicht.jsx'))).toBe(false)
  })

  it('stoppt hart, was nicht in der Liste steht — mit Ticker-Zeile, ohne Rückfrage', () => {
    const urteil = bauer('Write', { file_path: 'src/main/projekte.js' })
    expect(urteil.frage).toBeUndefined()
    expect(urteil.gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('src/main/projekte.js', liste)
    )
    expect(urteil.tickerText).toBe(
      texte.ticker.ausserhalbDateilisteGesperrt('src/main/projekte.js')
    )
  })

  it('lässt die Wegwerf-Fläche arbeitsablage/ frei — der Katalog-Auftrag schreibt sie vor', () => {
    expect(bauer('Write', { file_path: 'arbeitsablage/probe.js' }).erlaubt).toBe(true)
  })

  it('KEINE Liste heißt KEINE Sperre — ein alter Laufstand blockiert nichts', () => {
    expect(bauer('Write', { file_path: 'src/main/projekte.js', }, { dateiListe: null }).erlaubt).toBe(
      true
    )
    expect(bauer('Write', { file_path: 'src/main/projekte.js' }, { dateiListe: [] }).erlaubt).toBe(
      true
    )
  })

  it('greift nicht an den Sperren, die davor liegen — Verwaltungsdatei und Prüfmappe bleiben ihre eigenen Fälle', () => {
    // Die Reihenfolge im Schreib-Zweig ist verbindlich: Verwaltungsdatei →
    // Prüfmappe → eigener Prüfordner → arbeitsablage → Dateiliste. Sonst
    // erklärte die Dateilisten-Meldung einen Fall, für den es eine
    // spezifischere gibt.
    expect(bauer('Write', { file_path: 'karten.json' }).gesperrt).toBe(
      texte.rechteFrage.verwaltungGesperrtFuerAgent
    )
    expect(bauer('Write', { file_path: 'pruefung/test.js' }).gesperrt).toBe(
      texte.rechteFrage.pruefmappeGesperrtFuerAgent
    )
  })

  it('lässt einem Prüfer seinen eigenen Prüfordner — die Sperre ist nur für Umsetzer gedacht', () => {
    // Ein Prüfer bekommt das Paket SEINES Bauers mitgeliefert; stünde er dabei
    // unter dessen Dateiliste, könnte er seine eigenen Tests nicht schreiben.
    const urteil = pruefeWerkzeug(
      'Write',
      { file_path: 'pruefung/pruefer-1a2b/test.js' },
      projekt,
      false,
      true, // darfPruefen
      true,
      false,
      false,
      false,
      false,
      false,
      'pruefer-1a2b',
      [],
      liste
    )
    expect(urteil.erlaubt).toBe(true)
  })

  it('lässt einen nur-lesenden Block an seiner eigenen Sperre scheitern, nicht an der Dateiliste', () => {
    const urteil = pruefeWerkzeug(
      'Write',
      { file_path: 'src/main/projekte.js' },
      projekt,
      true, // nurLesen
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      '',
      [],
      liste
    )
    expect(urteil.gesperrt).toBe(texte.rechteFrage.nurLesenGesperrtFuerAgent)
  })
})

describe('BAUPLAN 44 · Die ehrliche Grenze: Befehle laufen an der Sperre vorbei', () => {
  it('schließt das lauteste Loch — ein Umleitungsziel außerhalb der Liste', () => {
    const urteil = bauer('Bash', { command: 'echo x > src/main/projekte.js' })
    expect(urteil.gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('src/main/projekte.js', liste)
    )
  })

  it('lässt eine Umleitung in die eigene Liste und in die arbeitsablage durch', () => {
    expect(bauer('Bash', { command: 'node bauen.js > src/main/lauf.js' }).erlaubt).toBe(true)
    expect(bauer('Bash', { command: 'node bauen.js > arbeitsablage/log.txt' }).erlaubt).toBe(true)
  })

  it('stoppt einen ausgeführten Befehl NICHT an der Dateiliste — das ist die Grenze, die Schritt 46 schließt', () => {
    // `npm run build` schreibt, wohin es will. Das steht so in SPEC §7; hier
    // wird es festgehalten, damit niemand die Zusage für mehr hält, als sie ist.
    expect(bauer('Bash', { command: 'npm run build' }).erlaubt).toBe(true)
  })
})

describe('BAUPLAN 44 · Die Pfad-Rechnung selbst', () => {
  it('erkennt Ordner-Einträge an Schluss-Schrägstrich oder fehlender Endung', () => {
    expect(stehtInDateiliste('src/shared/texte.js', projekt, ['src/shared/'])).toBe(true)
    expect(stehtInDateiliste('src/shared/texte.js', projekt, ['src/shared'])).toBe(true)
    expect(stehtInDateiliste('src/sharedX/texte.js', projekt, ['src/shared'])).toBe(false)
  })

  it('vergleicht ohne Groß- und Kleinschreibung (Windows) und ohne leere Liste zu treffen', () => {
    expect(stehtInDateiliste('SRC/Main/Lauf.js', projekt, ['src/main/lauf.js'])).toBe(true)
    expect(stehtInDateiliste('src/main/lauf.js', projekt, [])).toBe(false)
    expect(stehtInDateiliste('src/main/lauf.js', projekt, null)).toBe(false)
  })

  it('lässt ein Ziel außerhalb des Projekts nicht über einen Listeneintrag hereinrutschen', () => {
    expect(stehtInDateiliste('../fremd/lauf.js', projekt, ['src/main/lauf.js'])).toBe(false)
    expect(stehtInDateiliste('src/main/lauf.js', projekt, ['../fremd/'])).toBe(false)
  })
})

// Rot vor Grün: Vorher setzte ein einziges Paket ohne Dateiliste die Sperre für
// den ganzen Block aus — lautlos, ohne Ticker-Zeile. Wer SPEC §4.1 las („Ihre
// Dateilisten zusammen beschreiben seinen Arbeitsbereich") rechnete mit einer
// geltenden Sperre, wo gar keine war. Diese Erwartungen liefen mit der alten
// Fassung rot.
describe('BAUPLAN 44 · Mehrere Pakete: die Vereinigung ihrer Dateilisten sperrt', () => {
  it('legt die Listen zusammen, ohne einen Eintrag doppelt zu führen', () => {
    expect(
      dateiListeVereinigen([
        { erlaubteDateien: ['src/main/lauf.js', 'src/shared/texte.js'] },
        { erlaubteDateien: ['src/shared/texte.js', 'src/renderer/src/'] }
      ])
    ).toEqual(['src/main/lauf.js', 'src/shared/texte.js', 'src/renderer/src/'])
  })

  it('ein Paket ohne Liste trägt nichts bei — und schaltet die Sperre nicht ab', () => {
    expect(
      dateiListeVereinigen([{ erlaubteDateien: ['src/main/lauf.js'] }, { erlaubteDateien: [] }])
    ).toEqual(['src/main/lauf.js'])
    expect(dateiListeVereinigen([{ erlaubteDateien: ['src/main/lauf.js'] }, {}])).toEqual([
      'src/main/lauf.js'
    ])
  })

  it('Rückfall ohne Bruch: trägt KEIN Paket eine Liste, gibt es keine Sperre', () => {
    expect(dateiListeVereinigen([{}, { erlaubteDateien: [] }])).toBe(null)
    expect(dateiListeVereinigen([])).toBe(null)
    expect(dateiListeVereinigen(null)).toBe(null)
  })
})

// Das Haus-Muster ist, eine harte Sperre VORHER anzusagen (so macht es der
// Auftrag längst für die Prüfmappe). Rot vor Grün: Vorher stand im
// Bauer-Auftrag nichts davon — er erfuhr vom Verbot erst, wenn ihn mitten in
// der Arbeit eine Abweisung stoppte.
describe('BAUPLAN 44 · Der Bauer erfährt vor der Arbeit, dass die Dateiliste sperrt', () => {
  const auftrag = blockDefinition('bauer').auftrag

  it('nennt die erlaubten Dateien als Arbeitsbereich und sagt, dass daneben gesperrt ist', () => {
    expect(auftrag).toMatch(/erlaubten Dateien/)
    expect(auftrag).toMatch(/gesperrt/)
  })

  it('nennt den freien Ordner und den Weg über anmerkung statt eines zweiten Versuchs', () => {
    expect(auftrag).toMatch(/arbeitsablage\//)
    expect(auftrag).toMatch(/anmerkung/)
  })
})

describe('BAUPLAN 44 · Alle Motor-Aufrufstellen reichen die Dateiliste durch', () => {
  // Fund 12 der Angriffsliste: pruefeWerkzeug hat 15 Positionsparameter (seit
  // BAUPLAN 46: inWelle als letzter) und drei
  // Aufrufstellen im Motor. Ein Neuzugang, der an einer davon vergessen wird,
  // rutscht still an die falsche Stelle — dann landet die Dateiliste z.B. auf
  // `lieferscheinFrei` und der Block kann sein Melde-Werkzeug nicht mehr rufen,
  // ohne dass irgendwo etwas rot wird. Deshalb wird hier die Quelle selbst
  // gelesen.
  const quelle = fs.readFileSync('src/main/motor/claudeCodeMotor.js', 'utf8')

  it('hat genau drei Aufrufstellen, und jede endet auf Dateiliste und Welle', () => {
    const stellen = [...quelle.matchAll(/pruefeWerkzeug\(\s*\n([\s\S]*?)\n\s*\)/g)]
    expect(stellen).toHaveLength(3)
    for (const stelle of stellen) {
      // Argumente zählen: Kommentarzeilen und Leerzeilen raus, dann die Zeilen
      // mit einem abschließenden Komma plus die letzte.
      const zeilen = stelle[1]
        .split('\n')
        .map((z) => z.trim())
        .filter((z) => z && !z.startsWith('//'))
      expect(zeilen).toHaveLength(15)
      expect(zeilen[13]).toMatch(/dateiListe|null/)
      // BAUPLAN 46: der 15. Parameter ist die Welle — im Lauf frisch abgefragt
      // (inWelleJetzt), im Chat ausdrücklich false.
      expect(zeilen[14]).toMatch(/^inWelleJetzt\(\)$|^false/)
    }
  })

  it('nimmt die Dateiliste in blockAusfuehren entgegen und legt sie am Block ab', () => {
    expect(quelle).toMatch(/blockAusfuehren\(\{[^}]*dateiListe = null/)
    expect(quelle).toMatch(/\n\s+dateiListe,\n/)
  })
})

describe('BAUPLAN 44 · Pfeile aus Code sind keine Umleitung', () => {
  // Seit die Dateiliste hart sperrt, ist ein Fehlgriff der Befehls-Zerlegung
  // nicht mehr nur eine überflüssige Rückfrage, sondern ein grundlos
  // gestoppter Bauer. Rot-vor-Grün: Mit der ersten Fassung (jedes „>" zählte)
  // wurden beide Fälle hier gesperrt.
  it('stoppt weder eine Pfeilfunktion noch einen Vergleich', () => {
    expect(bauer('Bash', { command: 'node -e "const f = x => x.pfad"' }).erlaubt).toBe(true)
    expect(bauer('Bash', { command: 'node -e "if (a >= b) run()"' }).erlaubt).toBe(true)
  })

  // Rot vor Grün: Die erste Fassung schloss NUR das Gleichheitszeichen aus und
  // sah jedes übrige „>" als Umleitung an — auch eines mitten in einem
  // Anführungszeichen-Argument. Alle vier Befehle hier wurden mit Dateiliste
  // hart gesperrt („Schreiben an „b)" gestoppt …"), und {gesperrt} ist
  // absichtlich keine Rückfrage: Georgs Automodus konnte den grundlos
  // gestoppten Bauer nicht durchwinken.
  it('sieht ein „>" innerhalb von Anführungszeichen nicht als Umleitung', () => {
    for (const befehl of [
      'node -e "if (a > b) console.log(1)"',
      'echo "Ergebnis > 0"',
      'npm test -- --grep "a > b"',
      'python -c "if x > y: print(1)"'
    ])
      expect(bauer('Bash', { command: befehl }).erlaubt).toBe(true)
  })

  // Rot-vor-Grün: Vorher kannte die Wegwerf-Liste nur die Bash-Schreibweisen
  // (NUL, /dev/null). FlowForge läuft auf Windows und ruft PowerShell — dort
  // ist „2>$null" dasselbe Idiom, und jeder dieser Alltagsbefehle wurde mit
  // Dateiliste hart gesperrt („Schreiben an „$null" gestoppt …"), ohne
  // Dateiliste dagegen erlaubt. Der harte Stopp entstand also erst durch die
  // Sperre selbst — und ist keine Rückfrage, die der Automodus lösen könnte.
  it('sieht PowerShells $null als Wegwerf-Ziel, nicht als Datei', () => {
    for (const befehl of [
      'npm test 2>$null',
      'npm test > $null',
      'npm test 1>$null',
      'npx vitest run pruefung/p1/x.test.js 2>$null'
    ])
      expect(bauer('Bash', { command: befehl }).erlaubt).toBe(true)
    // Nur der Name selbst ist ein Nichts-Ziel: eine echte Datei daneben bleibt gesperrt.
    expect(bauer('Bash', { command: 'npm test > $nullwert.txt' }).gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('$nullwert.txt', liste)
    )
  })

  it('erkennt ein zitiertes Ziel NACH dem Pfeil weiterhin — Leerzeichen im Pfad', () => {
    expect(bauer('Bash', { command: 'echo x > "src/mit leerzeichen.js"' }).gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('src/mit leerzeichen.js', liste)
    )
    expect(bauer('Bash', { command: "echo x > 'src/main/lauf.js'" }).erlaubt).toBe(true)
  })

  it('stoppt eine echte Umleitung daneben weiterhin', () => {
    expect(bauer('Bash', { command: 'echo x > src/fremd.js' }).gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('src/fremd.js', liste)
    )
    expect(bauer('Bash', { command: 'node bauen.js >> src/main/projekte.js' }).gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('src/main/projekte.js', liste)
    )
  })

  // Rot vor Grün: Beim Ausschließen der Code-Pfeile stand kurzzeitig auch der
  // Bindestrich in der Ausnahme — damit galt jedes „>" mit einem „-" davor
  // nicht mehr als Umleitung. `echo hallo -> ../draussen.txt` ist für die Shell
  // aber ein Argument „-" plus eine echte Umleitung: Projekt-Grenze (SPEC §7)
  // UND Dateilisten-Sperre liefen still daran vorbei, in JEDEM Projekt.
  it('lässt sich von einem Bindestrich vor dem Pfeil nicht täuschen', () => {
    // Ohne Dateiliste entscheidet die Projektgrenze mit ihrer Rückfrage …
    expect(
      bauer('Bash', { command: 'echo hallo -> ../draussen.txt' }, { dateiListe: null }).frage
    ).toBe(texte.rechteFrage.schreibenAusserhalb('../draussen.txt'))
    // … mit Dateiliste sperrt die Liste, drinnen wie draußen (siehe unten).
    expect(bauer('Bash', { command: 'echo hallo -> src/fremd.js' }).gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('src/fremd.js', liste)
    )
  })
})

// Rot vor Grün: Vorher stand die Projektgrenze VOR der Dateiliste und lieferte
// für ein Ziel außerhalb nur eine {frage} — und die erlaubt der Automodus ohne
// Nachfrage. Damit war der gefährlichere Schreibvorgang schwächer behandelt als
// der harmlosere: `echo x > ../draussen.txt` kam durch, während
// `echo x > src/fremd.js` hart gesperrt wurde. Zugleich versprach SPEC §7 eine
// Sperre „an Datei-Umleitungen", die für Ziele draußen gar nicht griff.
describe('BAUPLAN 44 · Ein Umleitungsziel außerhalb des Projekts steht in keiner Dateiliste', () => {
  it('sperrt es hart, sobald eine Dateiliste vorliegt — mit Ticker-Zeile, ohne Rückfrage', () => {
    const urteil = bauer('Bash', { command: 'echo x > ../draussen.txt' })
    expect(urteil.frage).toBeUndefined()
    expect(urteil.gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('../draussen.txt', liste)
    )
    expect(urteil.tickerText).toBe(texte.ticker.ausserhalbDateilisteGesperrt('../draussen.txt'))
  })

  it('fragt OHNE Dateiliste unverändert an der Projektgrenze', () => {
    // Wort für Wort dieselbe Rückfrage wie vor der Nachbesserung — Blöcke ohne
    // Dateiliste (alte Laufstände, Agent ohne Vertrag) merken nichts davon.
    expect(bauer('Bash', { command: 'echo x > ../draussen.txt' }, { dateiListe: null }).frage).toBe(
      texte.rechteFrage.schreibenAusserhalb('../draussen.txt')
    )
    expect(bauer('Bash', { command: 'echo x > ../draussen.txt' }, { dateiListe: [] }).frage).toBe(
      texte.rechteFrage.schreibenAusserhalb('../draussen.txt')
    )
  })

  it('lässt ein Umleitungsziel INNERHALB der Liste weiter durch', () => {
    expect(bauer('Bash', { command: 'node bauen.js > src/main/lauf.js' }).erlaubt).toBe(true)
  })
})

// Rot vor Grün: Vorher normalisierten die beiden Enden derselben Rechnung
// verschieden. Das Melden entfernte nur „./", der Motor rechnete
// „/src/main/lauf.js" über die Laufwerkswurzel und übersprang den Eintrag still.
// Folge: Die Liste war nicht leer (die Sperre galt also), traf aber nichts — der
// Schreibversuch auf genau diese Datei wurde mit der Begründung gestoppt, sie
// stehe nicht in der Liste, in der sie sichtbar stand. Für Georg nicht auflösbar.
describe('BAUPLAN 44 · Melden und Sperren rechnen mit derselben Schreibweise', () => {
  const rahmen = { fazit: 'Zugeschnitten.', getan: [], offen: [], anmerkung: '' }
  const tl = texte.lieferschein

  it('trifft mit führendem Schrägstrich dieselbe Datei wie ohne', () => {
    expect(stehtInDateiliste('src/main/lauf.js', projekt, ['/src/main/lauf.js'])).toBe(true)
    expect(stehtInDateiliste('src/main/lauf.js', projekt, ['\\src\\main\\lauf.js'])).toBe(true)
    expect(
      bauer('Write', { file_path: 'src/main/lauf.js' }, { dateiListe: ['/src/main/lauf.js'] })
        .erlaubt
    ).toBe(true)
  })

  // Rot vor Grün: „." wurde beim Melden ANGENOMMEN und gespeichert, traf in der
  // Sperre aber nichts (leerer relativer Pfad, Eintrag übersprungen). Die Liste
  // war damit nicht leer — die Sperre galt also, der Ticker meldete sogar
  // „1 erlaubte Datei" — und stoppte den Bauer an JEDEM Schreibversuch mit der
  // Begründung, die Datei stehe nicht in einer Liste, die „alles" sagt.
  // Nachgeschärft (Abschlussprüfung Bauschritt 44): Die beiden Wegkürzungen
  // liefen in fester Reihenfolge — ein Schrägstrich, den erst das Entfernen des
  // Punkt-Vorsatzes freilegte, blieb stehen. „.//" und „.\\" wurden deshalb
  // ANGENOMMEN und als „/" gespeichert; mit dieser Liste war genau der Zustand
  // zurück, den die Reparatur beseitigen sollte: Liste gilt als nicht leer,
  // trifft aber nichts, Bauer an jedem Schreibversuch gestoppt. Rot vor Grün:
  // Diese beiden Schreibweisen liefen mit der alten Fassung durch.
  it('weist einen Eintrag auf den Projektordner selbst beim Melden ab und nennt den Weg ohne Liste', () => {
    for (const eintrag of ['.', './', '.\\', '/', './/', '.\\\\', './././', '/./']) {
      const ergebnis = meldungPruefen(
        'arbeitspaket',
        {
          ...rahmen,
          pakete: [{ ziel: 'Etwas bauen', fertigKriterien: ['Läuft.'], erlaubteDateien: [eintrag] }]
        },
        'Arbeitspaket'
      )
      expect(ergebnis.fehler).toBe(tl.paketFehler(1, tl.dateiProjektordner(eintrag)))
    }
  })

  it('überspringt so einen Eintrag auch in der Sperre — beide Enden antworten gleich', () => {
    // Alte Laufstände tragen ungeprüfte Listen zurück: Der Eintrag darf dort
    // nichts treffen (und nicht etwa alles freigeben).
    for (const eintrag of ['.', './', '.\\', '/', './/', '.\\\\', './././', '/./'])
      expect(stehtInDateiliste('src/main/lauf.js', projekt, [eintrag])).toBe(false)
    expect(stehtInDateiliste('src/main/lauf.js', projekt, ['.', 'src/main/lauf.js'])).toBe(true)
  })

  it('weist einen ausbrechenden Eintrag schon beim Melden ab und nennt den Ist-Wert', () => {
    // „//" allein zählt hier mit: Zwei führende Schrägstriche sind der Anfang
    // einer UNC-Freigabe, also der Ausgang „zeigt hinaus" — abgewiesen wird er
    // so oder so, nur mit der anderen (spezifischeren) Begründung.
    for (const eintrag of ['../fremd.js', 'src/../../fremd.js', 'C:\\Windows\\notepad.exe', '//server/ablage/x.js', '//']) {
      const ergebnis = meldungPruefen(
        'arbeitspaket',
        {
          ...rahmen,
          pakete: [{ ziel: 'Etwas bauen', fertigKriterien: ['Läuft.'], erlaubteDateien: [eintrag] }]
        },
        'Arbeitspaket'
      )
      expect(ergebnis.fehler).toBe(tl.paketFehler(1, tl.dateiAusserhalb(eintrag)))
    }
  })
})
