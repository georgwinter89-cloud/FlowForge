// Prüfungen zu den Sperren in einer Welle (BAUPLAN 46) in Alltagssprache:
// Sobald mehrere Schreiber gleichzeitig laufen, muss der Code die Zusage
// „parallel, weil disjunkt" auch halten — an den zwei Stellen, an denen die
// Dateiliste bis Bauschritt 45 ehrlich vorbeiließ (SPEC §7, „ehrliche Grenze"):
//   (1) Befehle: Ein Block IN einer Welle darf sonst rückfragefreie
//       Entwickler-Werkzeuge (npm, npx, node …) nur noch nach Rückfrage
//       ausführen — sie schreiben an der Dateiliste vorbei und lesen den
//       Halbstand des Nachbarn. Rein lesende Befehle bleiben frei; die harten
//       Sperren (Git, Dateiliste bei Umleitung) gehen wie bisher vor.
//   (2) Lokale Helfer-KI: lokal_bauen und die Vorreparatur bekommen die
//       Dateiliste als Tabu-Liste — Schreiben außerhalb wird abgelehnt,
//       arbeitsablage/ bleibt frei, ohne Liste sperrt nichts.
//
// Gemessen wird Verhalten, nicht Code: (1) am Urteil von pruefeWerkzeug,
// (2) an dem, was die lokale KI wirklich auf die Platte schreibt — mit einem
// nachgestellten Ollama (fetch-Stub), das genau die Werkzeugaufrufe abgibt.
//
// Rot vor Grün: Vor dem Bauschritt hatte pruefeWerkzeug 14 Parameter — der
// 15. wurde ignoriert, `npm run build` lief in der Welle rückfragefrei durch;
// lokalBauen kannte kein dateiListe und schrieb src/fremd.js anstandslos.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pruefeWerkzeug, stehtInDateiliste } from '../src/main/motor/claudeCodeMotor.js'
import { lokalBauen, lokalReparieren } from '../src/main/motor/lokaleHelfer.js'
import { dateilistenUeberschneidung } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const projekt = path.resolve('C:/Projekte/Beispiel')
const liste = ['src/main/lauf.js', 'src/shared/']

// Ein Bauer mit Dateiliste, wahlweise in einer Welle — die volle Argumentliste,
// wie der Motor sie stellt (15 Positionsparameter).
function bauer(name, eingabe, { inWelle = false, dateiListe = liste } = {}) {
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
    '', // pruefOrdner
    [], // lieferscheinFrei
    dateiListe,
    inWelle
  )
}

describe('BAUPLAN 46 · Befehle in einer Welle fragen nach', () => {
  it('macht aus sonst freien Entwickler-Werkzeugen eine Rückfrage, die die Welle nennt', () => {
    for (const befehl of ['npm run build', 'npx vitest run', 'node skript.js', 'pip install x']) {
      const urteil = bauer('Bash', { command: befehl }, { inWelle: true })
      expect(urteil.erlaubt).toBeUndefined()
      expect(urteil.gesperrt).toBeUndefined()
      expect(urteil.frage).toBe(texte.rechteFrage.befehlInWelle(befehl))
      expect(urteil.frage).toMatch(/parallel ein anderer Block schreibt/)
    }
    expect(bauer('PowerShell', { command: 'npm test' }, { inWelle: true }).frage).toBeDefined()
  })

  it('lässt rein lesende Befehle auch in der Welle frei', () => {
    for (const befehl of ['dir src', 'type src\\main\\lauf.js', 'grep -rn "todo" src/', 'Get-ChildItem'])
      expect(bauer('Bash', { command: befehl }, { inWelle: true }).erlaubt).toBe(true)
  })

  it('hält die harten Sperren: Git und Dateiliste bei Umleitung gehen vor', () => {
    const gitUrteil = bauer('Bash', { command: 'git status' }, { inWelle: true })
    expect(gitUrteil.gesperrt).toBe(texte.rechteFrage.gitGesperrtFuerAgent)
    const umleitung = bauer('Bash', { command: 'echo x > src/fremd.js' }, { inWelle: true })
    expect(umleitung.gesperrt).toBe(
      texte.rechteFrage.ausserhalbDateilisteFuerAgent('src/fremd.js', liste)
    )
    // Und ein Schreib-Werkzeug außerhalb der Liste bleibt hart gesperrt — nicht
    // etwa zur Rückfrage aufgeweicht.
    expect(bauer('Write', { file_path: 'src/fremd.js' }, { inWelle: true }).gesperrt).toBeDefined()
  })

  it('ohne Welle bleibt alles wie vor dem Bauschritt', () => {
    expect(bauer('Bash', { command: 'npm run build' }).erlaubt).toBe(true)
    expect(bauer('Bash', { command: 'npx vitest run' }, { inWelle: false }).erlaubt).toBe(true)
    // Ein unbekannter Befehl fragt wie immer — mit dem alten Text, nicht dem Wellen-Text.
    expect(bauer('Bash', { command: 'make all' }, { inWelle: true }).frage).toBe(
      texte.rechteFrage.befehl('make all')
    )
  })

  it('zählt nur ein echtes true als Welle — kein Zufallswert schaltet die Rückfrage an', () => {
    expect(bauer('Bash', { command: 'npm test' }, { inWelle: 'ja' }).erlaubt).toBe(true)
    expect(bauer('Bash', { command: 'npm test' }, { inWelle: 1 }).erlaubt).toBe(true)
  })
})

// ── (2) Lokale Helfer-KI: Tabu-Liste ────────────────────────────────────────

// Ollama nachgestellt: Jede Antwort ist eine Nachricht des lokalen Modells —
// erst Werkzeugaufrufe, zuletzt das Fazit. Die Anfragen (samt Werkzeug-
// Ergebnissen, die FlowForge zurückgibt) werden mitgeschrieben.
function ollamaStub(antworten) {
  const anfragen = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, { body }) => {
      anfragen.push(JSON.parse(body))
      const naechste = antworten.shift() ?? { message: { role: 'assistant', content: 'Fertig.' } }
      return { ok: true, status: 200, json: async () => naechste }
    })
  )
  return anfragen
}

function aufruf(name, eingabe) {
  return { function: { name, arguments: eingabe } }
}

function antwortMit(...aufrufe) {
  return { message: { role: 'assistant', content: '', tool_calls: aufrufe } }
}

const fazit = { message: { role: 'assistant', content: 'Fertig: alles gemeldet.' } }

// Was FlowForge der lokalen KI als Werkzeug-Ergebnis zurückgab — steht in den
// FOLGENDEN Anfragen als tool-Nachricht; die letzte Anfrage trägt den ganzen
// Verlauf, also alle Ergebnisse in Reihenfolge.
function werkzeugErgebnisse(anfragen) {
  const letzte = anfragen[anfragen.length - 1]
  return letzte.messages.filter((m) => m.role === 'tool').map((m) => m.content)
}

describe('BAUPLAN 46 · Die lokale Helfer-KI hält die Dateiliste', () => {
  let projektPfad
  beforeEach(() => {
    projektPfad = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-tabu-'))
    fs.mkdirSync(path.join(projektPfad, 'src/shared'), { recursive: true })
    fs.writeFileSync(path.join(projektPfad, 'src/shared/texte.js'), 'const a = 1\n')
    fs.writeFileSync(path.join(projektPfad, 'src/fremd.js'), 'const fremd = 1\n')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    fs.rmSync(projektPfad, { recursive: true, force: true })
  })

  it('lokal_bauen: außerhalb der Liste abgelehnt, innerhalb und unter arbeitsablage/ erlaubt', async () => {
    const anfragen = ollamaStub([
      antwortMit(aufruf('datei_schreiben', { pfad: 'src/neu.js', inhalt: 'nicht erlaubt\n' })),
      antwortMit(aufruf('ersetzen', { pfad: 'src/fremd.js', alt: 'fremd = 1', neu: 'fremd = 2' })),
      antwortMit(aufruf('datei_schreiben', { pfad: 'src/shared/neu.js', inhalt: 'erlaubt\n' })),
      antwortMit(aufruf('datei_schreiben', { pfad: 'arbeitsablage/notiz.txt', inhalt: 'frei\n' })),
      fazit
    ])
    const ergebnis = await lokalBauen({
      projektPfad,
      auftrag: 'egal',
      modell: 'stub',
      adresse: 'http://stub',
      dateiListe: liste
    })
    expect(ergebnis.ok).toBe(true)
    // Auf der Platte: nur, was die Liste (und arbeitsablage/) erlaubt.
    expect(fs.existsSync(path.join(projektPfad, 'src/neu.js'))).toBe(false)
    expect(fs.readFileSync(path.join(projektPfad, 'src/fremd.js'), 'utf8')).toBe('const fremd = 1\n')
    expect(fs.readFileSync(path.join(projektPfad, 'src/shared/neu.js'), 'utf8')).toBe('erlaubt\n')
    expect(fs.readFileSync(path.join(projektPfad, 'arbeitsablage/notiz.txt'), 'utf8')).toBe('frei\n')
    expect(ergebnis.dateien).toEqual(['src/shared/neu.js', 'arbeitsablage/notiz.txt'])
    expect(ergebnis.ersetzungen).toBe(0)
    // Die Ablehnung nennt die Liste und den Weg über anmerkung.
    const ergebnisse = werkzeugErgebnisse(anfragen)
    expect(ergebnisse[0]).toBe(texte.agentenLokaleHelfer.ausserhalbDateiliste('src/neu.js', liste))
    expect(ergebnisse[0]).toMatch(/src\/shared\//)
    expect(ergebnisse[0]).toMatch(/anmerkung/)
    expect(ergebnisse[1]).toBe(texte.agentenLokaleHelfer.ausserhalbDateiliste('src/fremd.js', liste))
  })

  it('lokalReparieren: ersetzen außerhalb der Liste abgelehnt', async () => {
    ollamaStub([
      antwortMit(aufruf('ersetzen', { pfad: 'src/fremd.js', alt: 'fremd = 1', neu: 'fremd = 2' })),
      antwortMit(aufruf('ersetzen', { pfad: 'src/shared/texte.js', alt: 'a = 1', neu: 'a = 2' })),
      fazit
    ])
    const ergebnis = await lokalReparieren({
      projektPfad,
      auftrag: 'egal',
      modell: 'stub',
      adresse: 'http://stub',
      dateiListe: liste
    })
    expect(ergebnis.ersetzungen).toBe(1)
    expect(fs.readFileSync(path.join(projektPfad, 'src/fremd.js'), 'utf8')).toBe('const fremd = 1\n')
    expect(fs.readFileSync(path.join(projektPfad, 'src/shared/texte.js'), 'utf8')).toBe('const a = 2\n')
  })

  it('ohne Liste (null oder leer) schreibt sie wie zuvor überall im Projekt', async () => {
    for (const dateiListe of [null, []]) {
      ollamaStub([
        antwortMit(aufruf('datei_schreiben', { pfad: 'src/neu.js', inhalt: 'ohne Sperre\n' })),
        fazit
      ])
      const ergebnis = await lokalBauen({
        projektPfad,
        auftrag: 'egal',
        modell: 'stub',
        adresse: 'http://stub',
        dateiListe
      })
      expect(ergebnis.dateien).toEqual(['src/neu.js'])
      expect(fs.readFileSync(path.join(projektPfad, 'src/neu.js'), 'utf8')).toBe('ohne Sperre\n')
      fs.rmSync(path.join(projektPfad, 'src/neu.js'))
      vi.unstubAllGlobals()
    }
  })

  it('die spezifischeren Sperren gehen vor: Prüfmappe und Verwaltungsdateien nennen ihren Grund', async () => {
    const anfragen = ollamaStub([
      antwortMit(aufruf('datei_schreiben', { pfad: 'pruefung/p1/t.js', inhalt: 'x\n' })),
      antwortMit(aufruf('datei_schreiben', { pfad: 'karten.json', inhalt: '{}\n' })),
      fazit
    ])
    await lokalBauen({
      projektPfad,
      auftrag: 'egal',
      modell: 'stub',
      adresse: 'http://stub',
      dateiListe: ['pruefung/', 'karten.json']
    })
    const ergebnisse = werkzeugErgebnisse(anfragen)
    expect(ergebnisse[0]).toMatch(/pruefung/)
    expect(ergebnisse[0]).not.toMatch(/Dateiliste/)
    expect(ergebnisse[1]).toMatch(/Verwaltungsdateien/)
    expect(fs.existsSync(path.join(projektPfad, 'pruefung/p1/t.js'))).toBe(false)
  })
})

// ── Beide Enden derselben Rechnung antworten gleich ──────────────────────────
// stehtInDateiliste (Schreibsperre, Hauptprozess, path.resolve) und
// dateilistenUeberschneidung (Melden und Wellen-Startregel, reine Zeichen)
// müssen für „liegt Datei d in Liste A?" dieselbe Antwort geben — sonst sagt
// das Melden „disjunkt", die Welle „darf gleichzeitig", und die Sperre lässt
// beide Bauer auf dieselbe Datei (Prüferbefund zu Bauschritt 46, gemessen an
// „src/./api" gegen „src/api/x.js": 8 divergierende Paare). Rot vor Grün: Vor
// der Kanonisierung in dateiEintragNormalisieren fielen die Fälle mit innerem
// „./", „//" und „/." hier auseinander.
describe('BAUPLAN 46 · Schreibsperre und Überschneidung rechnen gleich', () => {
  const faelle = [
    // [Liste A, Datei d]
    [['src/./api'], 'src/api/x.js'],
    [['src//api'], 'src/api/x.js'],
    [['src/api/./'], 'src/api/x.js'],
    [['src/api/.'], 'src/api/x.js'],
    [['src/api/x.js'], 'src/api/./x.js'],
    [['src/api/x.js'], 'src//api/x.js'],
    // (Die Datei d steht hier in Listen-Schreibweise — relativ zum Projekt; ein
    // Schreib-Werkzeug-Pfad kann auch absolut sein, das ist keine Listen-Frage.)
    [['./src/api/'], 'src/api/tief/y.js'],
    [['SRC/API/'], 'src/api/x.js'],
    [['src\\api\\'], 'src/api/x.js'],
    [['src/api'], 'src/api/x.js'],
    [['src/api/'], 'src/api2/x.js'],
    [['src/.hidden'], 'src/hidden'],
    [['src/api/x.js'], 'src/api/x.jsx'],
    [['Makefile'], 'Makefile/x.txt'],
    [['src/api/x.js'], 'src/api/x.js'],
    [['src/'], 'src/a/b/c.js'],
    [['src/a/'], 'src/b/c.js']
  ]
  it.each(faelle)('Liste %j gegen Datei %s', (listeA, datei) => {
    const sperre = stehtInDateiliste(datei, projekt, listeA)
    const ueberschneidung = dateilistenUeberschneidung(listeA, [datei]).ueberschneidet
    expect(ueberschneidung).toBe(sperre)
  })

  it('deckt beide Antworten ab — mindestens ein Treffer und ein Fehlschlag in der Liste', () => {
    const antworten = faelle.map(([listeA, datei]) => stehtInDateiliste(datei, projekt, listeA))
    expect(antworten).toContain(true)
    expect(antworten).toContain(false)
  })
})
