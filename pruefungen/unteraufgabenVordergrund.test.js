// Prüfungen zu den Funden 1, 2, 3 und 6 (Läufe am Haushaltsplaner, 22.08.2026):
// Eine Unteraufgabe eines Block-Agenten läuft IMMER im Vordergrund, und ihr
// Auftrag trägt immer eine Längengrenze.
//
// Was gemessen wurde (Abendlauf, Block „Bauer · Wochenplan-Ansicht"):
//   18:45:28  Unteraufgabe gestartet
//   18:46:21  Der Block hat schon wieder einen Zug und führt `ls` aus
//             → der Aufruf hat NICHT blockiert
//   18:54:05  Das Ergebnis der Unteraufgabe steht in der Laufanzeige
//   18:54:44  Der Block schreibt „Now I'll wait for the sub-agent's report"
//             → bekommen hat er es nie
//   18:55–19:08  zehn sleep-Befehle (30/45/60/90/120/60/90/100/60/120)
//   19:10:50  gibt auf und liest die Dateien selbst
// Kosten: 24 Minuten in einem Block, für ein Ergebnis, das längst dalag.
//
// Die Gegenprobe steht im selben Lauf: Der Prüfer (20:11) und der
// Invarianten-Prüfer (21:04) haben ebenfalls Unteraufgaben gestartet, beide
// haben geliefert, und in ihren Protokollen steht kein einziger sleep-Befehl.
// Gleicher Lauf, gleiches Modell, gleicher Harness — der Unterschied war allein
// run_in_background. Das Modell trifft diese Wahl also je Aufruf neu und in
// einem von drei Fällen falsch, und die Folge kann es nicht beheben:
// TaskOutput steht in keiner Werkzeugliste (Fund 2), ist unter „darf nur lesen"
// hart gesperrt und fragt sonst nach. Was nicht abgeholt werden kann, darf
// nicht gestartet werden können — deshalb nimmt FlowForge die Wahl weg.
//
// Rot vor Grün, so gemessen: Vor der Reparatur gab es unteraufgabenEingabe
// nicht (Import rot). Nachgebaut mit der alten Rechnung — dem Zweig für lokale
// Blöcke, der nur das Modellfeld entfernte — melden alle Erwartungen an
// run_in_background rot:
//   AssertionError: expected true to be false
import { describe, it, expect } from 'vitest'
import { unteraufgabenEingabe } from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

const grenze = texte.agentenLaufSession.unteraufgabeGrenze

describe('Fund 1 · Eine Unteraufgabe läuft nie im Hintergrund', () => {
  it('überschreibt die Wahl des Modells bei einem lokalen Block', () => {
    const eingabe = unteraufgabenEingabe(
      { prompt: 'Lies die Datenschicht ein', run_in_background: true },
      { lokal: true }
    )
    expect(eingabe.run_in_background).toBe(false)
  })

  it('überschreibt sie auch bei einem Claude-Block — die Sackgasse ist dieselbe', () => {
    expect(
      unteraufgabenEingabe({ prompt: 'Späh voraus', run_in_background: true }, { lokal: false })
        .run_in_background
    ).toBe(false)
    expect(
      unteraufgabenEingabe(
        { prompt: 'Späh voraus', run_in_background: true },
        { lokal: false, unterModell: 'sonnet' }
      ).run_in_background
    ).toBe(false)
  })

  it('setzt den Vordergrund auch dann, wenn das Modell gar nichts gesagt hat', () => {
    expect(unteraufgabenEingabe({ prompt: 'x' }).run_in_background).toBe(false)
    expect(unteraufgabenEingabe({}).run_in_background).toBe(false)
    expect(unteraufgabenEingabe(null).run_in_background).toBe(false)
  })
})

describe('BAUPLAN 37/49 · Das Modellfeld bleibt, wie es war', () => {
  it('nimmt lokalen Unteraufgaben das Modellfeld weg — es kennt nur Claude-Aliase', () => {
    const eingabe = unteraufgabenEingabe({ prompt: 'x', model: 'opus' }, { lokal: true })
    expect('model' in eingabe).toBe(false)
  })

  it('trägt sonst das eingestellte Unteraufgaben-Modell ausdrücklich ein', () => {
    expect(unteraufgabenEingabe({ prompt: 'x' }, { unterModell: 'sonnet' }).model).toBe('sonnet')
  })

  it('lässt alles andere unangetastet — description, subagent_type, eigene Felder', () => {
    const eingabe = unteraufgabenEingabe({
      prompt: 'x',
      description: 'Einlesen',
      subagent_type: 'general-purpose'
    })
    expect(eingabe.description).toBe('Einlesen')
    expect(eingabe.subagent_type).toBe('general-purpose')
  })
})

describe('Fund 6 · Der Auftrag der Unteraufgabe trägt eine Längengrenze', () => {
  // Gemessen: sechs Dateien in 11 Sekunden gelesen, dann acht Minuten für einen
  // Bericht, der keine Zusammenfassung war, sondern eine Neuausgabe — komplette
  // Codeblöcke, die ganze index.html, volle API-Listen. Rund 700 Zeilen
  // Quelltext wurden zu einem Bericht vergleichbarer Größe. Die Unteraufgabe
  // sparte damit nichts.
  it('hängt die Grenze an den Auftrag, den der Block-Agent geschrieben hat', () => {
    const eingabe = unteraufgabenEingabe({ prompt: 'Lies die Datenschicht ein' })
    expect(eingabe.prompt).toBe('Lies die Datenschicht ein' + grenze)
    expect(eingabe.prompt).toContain('höchstens 40 Zeilen')
  })

  it('hängt sie bei lokalen Blöcken genauso an', () => {
    expect(unteraufgabenEingabe({ prompt: 'A' }, { lokal: true }).prompt).toBe('A' + grenze)
  })

  it('hängt sie kein zweites Mal an denselben Auftrag', () => {
    const einmal = unteraufgabenEingabe({ prompt: 'A' }).prompt
    expect(unteraufgabenEingabe({ prompt: einmal }).prompt).toBe(einmal)
  })

  it('erfindet keinen Auftrag, wo keiner steht', () => {
    expect('prompt' in unteraufgabenEingabe({ description: 'x' })).toBe(false)
  })
})

describe('Fund 3 · Der Block-Agent erfährt, dass Warten nicht sein Verfahren ist', () => {
  // Primär ist Fund 1 die Reparatur — dieser Satz macht das Wissen überflüssig,
  // statt es zu verlangen. Bewusst OHNE Wartelimit: Das Modell kann nicht
  // wissen, ob eine Unteraufgabe noch rechnet oder tot ist, und die
  // erfolgreiche brauchte im selben Lauf acht Minuten.
  const system = texte.agentenLaufSession.blockAgentSystem('C:/Projekte/Beispiel', 60, 2000)

  it('sagt im Systemtext, dass eine Unteraufgabe blockiert', () => {
    expect(system).toContain('blockiert, bis sie fertig ist')
  })

  it('verbietet die eigene Warteschleife und sleep-Befehle', () => {
    expect(system).toContain('keine sleep-Befehle')
    expect(system).toContain('Warteschleife')
  })

  it('nennt kein Wartelimit', () => {
    expect(system).not.toMatch(/(warte|höchstens|maximal)[^.]{0,40}(minute|sekunde)/i)
  })
})
