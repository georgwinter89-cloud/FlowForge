// Prüfungen zum Wirkbereich und zum gefilterten Zurückrollen (BAUPLAN 45) in
// Alltagssprache: Ein Schreiber bekommt seinen eigenen Sicherungsstrang;
// Zurückrollen und Änderungs-Überblick gelten nur für SEINE Dateien, und die
// Arbeitsbereiche der anderen Blöcke bleiben dabei unangetastet.
//
// Rot vor Grün — so gemessen: Der Kern-Fall unten wurde zuerst mit dem alten
// Aufruf gefahren (`aufLetztenPunktZuruecksetzen(projekt)` ohne Optionen, genau
// wie lauf.js und helferWerkzeuge.js ihn bis Bauschritt 44 stellten). Dabei
// verschwand die frisch geschriebene Prüfdatei wortlos, und die Erwartung
// „existiert noch" schlug fehl. Der zweite Fall („der ungefilterte Rückroll
// löscht sie") hält genau dieses alte Verhalten fest, damit der Unterschied
// nachweisbar bleibt und nicht nur behauptet ist.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import git from 'isomorphic-git'
import { app } from 'electron'

// Die Werkzeuge der lokalen Helfer werden hier WIRKLICH ausgeführt (Nacharbeit
// zu Bauschritt 45): Zusicherungen über ehrliche Ticker-Zeilen und ehrliche
// Werkzeug-Antworten hielten vorher schon, sobald der passende Textbaustein
// irgendwo in der Datei stand — gemessen wurde dabei nie, ob der Agent den
// Hinweis auch bekommt. Attrappe sind deshalb nur die beiden Enden, die eine
// Prüfung nicht haben kann: das Agenten-SDK (es sammelt hier bloß die Handler
// ein) und die lokale KI (sie schreibt hier, was der Fall verlangt).
// Sicherungspunkte, Rückroll, Ticker und Antworttexte sind echt.
const sdk = vi.hoisted(() => ({ werkzeuge: new Map() }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name, _beschreibung, _schema, handler) => {
    sdk.werkzeuge.set(name, handler)
    return { name, handler }
  },
  createSdkMcpServer: (aufbau) => aufbau
}))
const lokaleKi = vi.hoisted(() => ({ antwort: null, schreibt: null }))
vi.mock('../src/main/motor/lokaleHelfer.js', () => {
  const ausfuehren = async () => {
    if (lokaleKi.schreibt) await lokaleKi.schreibt()
    return lokaleKi.antwort ?? { ok: true, schritte: 1, ersetzungen: 0, dateien: [], fazit: '' }
  }
  return { lokalBauen: ausfuehren, lokalEntwerfen: ausfuehren, lokalRecherchieren: ausfuehren }
})

import { helferWerkzeugServer } from '../src/main/motor/helferWerkzeuge.js'
import {
  sicherungspunktAnlegen,
  strangOeffnen,
  strangZusammenfuehren,
  sicherungspunkteLaden,
  letzterPunktId,
  standWeichtAb,
  punkteVergleichen,
  aufLetztenPunktZuruecksetzen
} from '../src/main/sicherungspunkte.js'
import {
  wirkbereichVon,
  geschuetzteBereicheVon,
  diffFilterVon,
  diffAuftragsText,
  blockendeBeschriftung,
  strangOeffnenAn,
  strangSchliessenAn,
  strangEingeholt,
  hartAbgebrochenerBlock,
  hartZurueckrollenAn,
  zurueckrollenAn,
  straengeMeldenBeimStart,
  laufFortsetzen
} from '../src/main/lauf.js'
import { blockDefinition, pruefOrdnerFuer } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

// Bekannte Grenze der Sicherungspunkte (siehe laufDiffPunkte.test.js): Die
// Änderungs-Erkennung vergleicht Zeitstempel nur sekundengenau. Im Alltag
// liegen zwischen zwei Punkten Sekunden bis Minuten; die Prüfung stellt diesen
// Abstand künstlich her, statt eine Sub-Sekunden-Wette einzugehen. Der Zähler
// sorgt dafür, dass auch ZWEI Schreibvorgänge auf dieselbe Datei auseinander
// liegen — sonst hielte die Änderungs-Erkennung den zweiten für den ersten.
let schreibSchritt = 0
function schreiben(wurzel, relativ, inhalt) {
  const ziel = path.join(wurzel, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  const spaeter = new Date(Date.now() + 5000 + ++schreibSchritt * 1000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

// Das versteckte Git-Verzeichnis leitet sich allein aus dem Projektpfad ab
// (sha1 des kleingeschriebenen Pfads unter userData) und ÜBERLEBT das Löschen
// des Projektordners. Der Pfad trägt die Prozesskennung — vergibt das
// Betriebssystem sie ein zweites Mal, fände ein „frischer" Ordner die Punkte
// und Stränge von gestern vor. Genau so wurde diese Prüfmappe während der
// Nacharbeit einmal ohne Zutun rot. Deshalb wird das Git-Verzeichnis
// mitgelöscht, wie im Schwesterstück sicherungsstraenge.test.js.
function gitOrdner(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(app.getPath('userData'), 'sicherungen', schluessel)
}

function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-wirkbereich-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(gitOrdner(wurzel), { recursive: true, force: true })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

// Der Aufbau des Kern-Falls: ein Prüfer mit eigener Prüfmappe, ein Bauer, dann
// ein Punkt auf dem Strang des Prüfers („Stand vor lokaler Reparatur"). Danach
// verbastelt die lokale KI eine Bauer-Datei, und der Prüfer schreibt frische
// Tests in seine Mappe.
async function standVorLokalerReparatur(name, strang) {
  const projekt = frischesProjekt(name)
  schreiben(projekt, 'src/app.js', 'alt\n')
  schreiben(projekt, 'pruefung/pruefer-b/lauf.test.js', 'prueft die App\n')
  await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
  await strangOeffnen(projekt, strang)
  schreiben(projekt, 'src/hilfe.js', 'vom Bauer gebaut\n')
  await sicherungspunktAnlegen(projekt, 'Stand vor lokaler Reparatur', { strang })
  schreiben(projekt, 'src/app.js', 'von der lokalen KI verbastelt\n')
  schreiben(projekt, 'pruefung/pruefer-b/frisch.test.js', 'frisch in der Nachpruefung\n')
  return projekt
}

describe('BAUPLAN 45 · Der Rückroll lässt fremde Arbeitsbereiche stehen', () => {
  const strang = 'strang/pruefer-b'
  let projekt = null
  let ergebnis = null

  beforeAll(async () => {
    projekt = await standVorLokalerReparatur('kern', strang)
    ergebnis = await aufLetztenPunktZuruecksetzen(projekt, {
      strang,
      geschuetzt: ['pruefung/pruefer-b/']
    })
  })

  it('legt den Punkt auf den Strang, ohne den gemeinsamen Stand zu bewegen', async () => {
    const aufStrang = await letzterPunktId(projekt, strang)
    const gemeinsam = await letzterPunktId(projekt)
    expect(aufStrang).toBeTruthy()
    expect(gemeinsam).toBeTruthy()
    expect(aufStrang).not.toBe(gemeinsam)
  })

  it('rollt das Gebastel der lokalen KI zurück', () => {
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.zurueckgesetzt).toBe(true)
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('alt\n')
  })

  it('lässt die Arbeit des Blocks stehen, die schon in seinem Punkt steckt', () => {
    expect(fs.existsSync(path.join(projekt, 'src/hilfe.js'))).toBe(true)
  })

  // DAS ist der Fall, den dieser Bauschritt beweist.
  it('löscht die frisch geschriebenen Tests in der Prüfmappe NICHT — und sagt es', () => {
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-b/frisch.test.js'))).toBe(true)
    expect(ergebnis.geschuetztUebersprungen).toBe(1)
  })
})

describe('BAUPLAN 45 · Ohne geschützte Bereiche verschwindet sie — das war der Zustand vorher', () => {
  it('löscht die frischen Tests wortlos, wenn der Rückroll den ganzen Ordner fasst', async () => {
    const strang = 'strang/pruefer-ohne'
    const projekt = await standVorLokalerReparatur('ungefiltert', strang)
    const roh = await aufLetztenPunktZuruecksetzen(projekt, { strang })
    expect(roh.ok).toBe(true)
    expect(roh.geschuetztUebersprungen).toBe(0)
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-b/frisch.test.js'))).toBe(false)
  })

  // Ein schreibender Block OHNE Wirkbereich (kein Arbeitspaket mit Dateiliste,
  // alter Laufstand) bekommt keinen Strang — und muss sich Wort für Wort
  // verhalten wie vor Bauschritt 45.
  it('verhält sich ohne Strang und ohne Bereiche exakt wie vorher', async () => {
    const projekt = frischesProjekt('ohne-wirkbereich')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    schreiben(projekt, 'src/app.js', 'halbfertig geaendert\n')
    schreiben(projekt, 'pruefung/pruefer-b/frisch.test.js', 'frisch\n')
    const zurueck = await aufLetztenPunktZuruecksetzen(projekt)
    expect(zurueck.ok).toBe(true)
    expect(zurueck.zurueckgesetzt).toBe(true)
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('alt\n')
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-b/frisch.test.js'))).toBe(false)
  })
})

describe('BAUPLAN 45 · Der gefilterte Änderungs-Überblick sagt, was er weglässt', () => {
  let projekt = null
  let vorher = null
  let nachher = null

  beforeAll(async () => {
    projekt = frischesProjekt('diff')
    schreiben(projekt, 'src/meins.js', 'eins\nzwei\n')
    schreiben(projekt, 'src/fremd.js', 'eins\nzwei\n')
    await sicherungspunktAnlegen(projekt, 'vorher')
    vorher = await letzterPunktId(projekt)
    schreiben(projekt, 'src/meins.js', 'eins\nZWEI von mir\n')
    schreiben(projekt, 'src/fremd.js', 'eins\nZWEI von woanders\n')
    await sicherungspunktAnlegen(projekt, 'nachher')
    nachher = await letzterPunktId(projekt)
  })

  it('zeigt nur die eigene Dateiliste und zählt den Rest ehrlich mit', async () => {
    const vergleich = await punkteVergleichen(projekt, vorher, nachher, {
      nurDateien: ['src/meins.js']
    })
    expect(vergleich.ok).toBe(true)
    expect(vergleich.dateien.map((d) => d.pfad)).toEqual(['src/meins.js'])
    expect(vergleich.ausserhalb).toBe(1)
  })

  it('bleibt ohne Dateiliste ungefiltert — ein Block ohne Wirkbereich sieht alles', async () => {
    const vergleich = await punkteVergleichen(projekt, vorher, nachher)
    expect(vergleich.dateien.map((d) => d.pfad).sort()).toEqual(['src/fremd.js', 'src/meins.js'])
    expect(vergleich.ausserhalb).toBe(0)
  })

  it('hat für das Weggelassene einen Satz im Auftrag und eine Zeile im Ticker', () => {
    expect(texte.agentenUebergabe.diffAusserhalb(1)).toMatch(/außerhalb deiner Dateiliste/)
    expect(texte.ticker.diffAusserhalb(1)).toMatch(/außerhalb/)
  })

  // Bei genau EINER Datei brach die Grammatik: „1 geänderte Datei liegt … — sie
  // gehören anderen Blöcken." Ein Satz, den Georg im Ticker und der Agent im
  // Auftrag liest, darf nicht falsch gebeugt sein.
  it('beugt den Satz auch bei genau einer Datei richtig', () => {
    expect(texte.agentenUebergabe.diffAusserhalb(1)).toContain('sie gehört anderen Blöcken')
    expect(texte.agentenUebergabe.diffAusserhalb(2)).toContain('sie gehören anderen Blöcken')
    expect(texte.ticker.diffAusserhalb(1)).toContain('sie steht nicht')
    expect(texte.ticker.diffAusserhalb(2)).toContain('sie stehen nicht')
  })

  // Derselbe Bruch an einer zweiten Stelle, gemessen im Ticker einer echten
  // Rückroll-Messung: „1 Änderung blieb … sie liegen …". Genau eine fremde
  // Änderung ist der Regelfall, sobald ein einziger fremder Prüfer im Lauf steht.
  it('beugt auch die Zeile über stehengebliebene fremde Änderungen richtig', () => {
    expect(texte.ticker.rollbackGeschuetzt(1)).toContain('1 Änderung blieb')
    expect(texte.ticker.rollbackGeschuetzt(1)).toContain('sie liegt im Arbeitsbereich')
    expect(texte.ticker.rollbackGeschuetzt(1)).not.toContain('sie liegen')
    expect(texte.ticker.rollbackGeschuetzt(2)).toContain('2 Änderungen blieben')
    expect(texte.ticker.rollbackGeschuetzt(2)).toContain('sie liegen im Arbeitsbereich')
  })
})

describe('BAUPLAN 45 · Wem gehört welche Datei? (Wirkbereich)', () => {
  const prueferDef = { prueft: true, nurLesen: false }
  const bauerDef = { prueft: false, nurLesen: false }
  const angreiferDef = { prueft: false, nurLesen: true }

  it('gibt einem Prüfer seinen eigenen Prüfordner — er bekommt nie eine Dateiliste', () => {
    expect(wirkbereichVon(prueferDef, 'pruefer-1a2b', null)).toEqual(['pruefung/pruefer-1a2b/'])
  })

  it('gibt einem Umsetzer die Dateiliste seines Arbeitspakets', () => {
    expect(wirkbereichVon(bauerDef, '', ['src/main/lauf.js', 'src/shared/'])).toEqual([
      'src/main/lauf.js',
      'src/shared/'
    ])
  })

  it('gibt einem Schreiber OHNE Arbeitspaket gar nichts — dann gilt alles wie vorher', () => {
    expect(wirkbereichVon(bauerDef, '', null)).toBe(null)
    expect(wirkbereichVon(bauerDef, '', [])).toBe(null)
  })

  it('gibt nur-lesenden Blöcken nichts — auch einem nur-lesenden Prüfer ohne Ordner', () => {
    expect(wirkbereichVon(angreiferDef, '', ['src/main/lauf.js'])).toBe(null)
    expect(wirkbereichVon({ prueft: true, nurLesen: true }, '', null)).toBe(null)
  })

  // Beim Filtern des Änderungs-Überblicks zählt der Wirkbereich NUR beim
  // Umsetzer. Rot vor Grün: Mit der ersten Fassung bekam auch der Prüfer seinen
  // Wirkbereich als Filter — und weil die Prüfmappe im Diff ohnehin
  // ausgeschlossen ist (BAUPLAN 34), blieb von „das hat sich seit deinem Urteil
  // geändert" NICHTS übrig. Der Prüfer wäre blind in die Nachprüfung gegangen,
  // ohne dass irgendwo etwas rot geworden wäre.
  it('filtert den Änderungs-Überblick eines Prüfers NICHT — er prüft fremde Dateien nach', () => {
    expect(diffFilterVon(prueferDef, ['pruefung/pruefer-1a2b/'])).toBe(null)
  })

  it('filtert den Änderungs-Überblick eines Umsetzers auf seine Dateiliste', () => {
    expect(diffFilterVon(bauerDef, ['src/main/lauf.js'])).toEqual(['src/main/lauf.js'])
    expect(diffFilterVon(bauerDef, null)).toBe(null)
  })
})

describe('BAUPLAN 45 · Was ein Rückroll nicht anfassen darf (geschützte Bereiche)', () => {
  const bauer = {
    instanzId: 'bauer-1',
    def: { prueft: false, nurLesen: false },
    pruefOrdner: '',
    dateiListe: ['src/main/lauf.js'],
    laeuft: true
  }
  const prueferA = {
    instanzId: 'pruefer-a',
    def: { prueft: true, nurLesen: false },
    pruefOrdner: 'pruefer-a',
    dateiListe: null,
    laeuft: false
  }
  const prueferB = {
    instanzId: 'pruefer-b',
    def: { prueft: true, nurLesen: false },
    pruefOrdner: 'pruefer-b',
    dateiListe: null,
    laeuft: false
  }

  it('schützt die Prüfmappen der anderen Instanzen, auch wenn sie gerade nicht laufen', () => {
    expect(geschuetzteBereicheVon('bauer-1', [bauer, prueferA, prueferB])).toEqual([
      'pruefung/pruefer-a/',
      'pruefung/pruefer-b/'
    ])
  })

  it('nimmt den eigenen Bereich nie mit — sonst rollte gar nichts mehr zurück', () => {
    // Der urteilende Prüfer rollt die Arbeit seines Ziel-Blocks zurück; aus
    // dessen Sicht ist die Prüfmappe fremd und bleibt stehen.
    expect(geschuetzteBereicheVon('pruefer-a', [prueferA, prueferB])).toEqual([
      'pruefung/pruefer-b/'
    ])
  })

  it('schützt die Dateiliste eines Umsetzers nur, solange er WIRKLICH gleichzeitig schreibt', () => {
    // Heute läuft nie ein zweiter Schreiber (SPEC §5) — ein ruhender Umsetzer
    // hinterlässt kein Revier, sonst bliebe genau das Gebastel liegen, das der
    // Rückroll wegräumen soll (Befehle schreiben an der Dateiliste vorbei).
    expect(geschuetzteBereicheVon('pruefer-a', [bauer, prueferA])).toEqual(['src/main/lauf.js'])
    expect(geschuetzteBereicheVon('pruefer-a', [{ ...bauer, laeuft: false }, prueferA])).toEqual([])
  })
})

// Baut den echten Werkzeug-Server der lokalen Helfer auf und gibt die beiden
// Handler heraus, um die es hier geht — samt mitgeschriebenem Ticker.
async function helferAufbauen(projektPfad, sicherung) {
  const ereignisse = []
  lokaleKi.antwort = null
  lokaleKi.schreibt = null
  await helferWerkzeugServer({
    projektPfad,
    modell: 'testmodell',
    adresse: 'http://localhost:0',
    holeSicherung: () => sicherung,
    aufEreignis: (ereignis) => ereignisse.push(ereignis)
  })
  return {
    bauen: sdk.werkzeuge.get('lokal_bauen'),
    abnehmen: sdk.werkzeuge.get('teilstueck_abnehmen'),
    ticker: () => ereignisse.filter((e) => e.art === 'ticker').map((e) => e.text)
  }
}

const textVon = (antwort) => antwort.content.map((teil) => teil.text).join('')

describe('BAUPLAN 45 · Ein gescheitertes Zurückrollen wird nicht mehr verschwiegen', () => {
  // Die Bauform bleibt eine Quelltext-Zusicherung: „es gibt genau EINE
  // Rückroll-Stelle" lässt sich nicht ausführen, nur nachzählen.
  it('rollt in den lokalen Helfern nur noch an EINER Stelle zurück — mit Strang und Bereichen', () => {
    // Bis Bauschritt 44 gab es zwei Aufrufe, und beide warfen den Rückgabewert
    // weg. Eine einzige Stelle kann das nicht mehr je Aufrufer vergessen.
    const helfer = fs.readFileSync('src/main/motor/helferWerkzeuge.js', 'utf8')
    const stellen = [...helfer.matchAll(/aufLetztenPunktZuruecksetzen\(/g)]
    expect(stellen).toHaveLength(1)
    expect(helfer).toMatch(/aufLetztenPunktZuruecksetzen\(projektPfad, \{\s*\n\s*strang/)
    expect(helfer).toMatch(/geschuetzt: geschuetzt \?\? \[\]/)
  })

  // Fall 1: Der Rückroll greift. Dann — und nur dann — darf „wieder sauber"
  // im Ticker stehen, und der Agent darf ungewarnt weiterbauen.
  it('räumt das Gebastel weg, sagt es im Ticker und warnt den Agenten NICHT', async () => {
    const projekt = frischesProjekt('helfer-greift')
    const strang = 'strang/bauer-1'
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, strang)
    const helfer = await helferAufbauen(projekt, {
      kennung: 'bauer-1',
      bezeichnung: 'Block 1 „Bauer"',
      strang,
      geschuetzt: ['pruefung/pruefer-a/']
    })
    lokaleKi.schreibt = () => schreiben(projekt, 'src/app.js', 'gebastelt\n')
    lokaleKi.antwort = { ok: false, fehler: 'abgebrochen', schritte: 2, ersetzungen: 1, dateien: [] }
    const antwort = await helfer.bauen({ teilstueck: 'T1', auftrag: 'baue etwas' })
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('alt\n')
    expect(helfer.ticker()).toContain(texte.ticker.lokaleBauenZurueckgerollt)
    expect(textVon(antwort)).not.toMatch(/ACHTUNG/)
  })

  // Fall 2: Der Rückroll lässt geschützte Reste liegen. Genau hier stand vorher
  // „der Stand ist wieder sauber" im Ticker und „Der Projektstand ist sauber"
  // in der Antwort an den Agenten — während die Datei unberührt auf der Platte
  // lag. Rot vor Grün: mit `if (erfolgsText) …` statt der Prüfung auf
  // `zurueckgesetzt !== false` schlägt die erste Erwartung fehl, ohne den neuen
  // Hinweis die dritte.
  it('verschweigt dem Agenten nicht, dass Reste in fremden Arbeitsbereichen liegen', async () => {
    const projekt = frischesProjekt('helfer-geschuetzt')
    schreiben(projekt, 'src/app.js', 'alt\n')
    schreiben(projekt, 'pruefung/pruefer-a/lauf.test.js', 'prueft\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const helfer = await helferAufbauen(projekt, {
      kennung: 'bauer-1',
      bezeichnung: 'Block 1 „Bauer"',
      strang: null,
      geschuetzt: ['pruefung/pruefer-a/']
    })
    lokaleKi.schreibt = () => schreiben(projekt, 'pruefung/pruefer-a/gebastel.test.js', 'gebastelt\n')
    lokaleKi.antwort = { ok: false, fehler: 'abgebrochen', schritte: 2, ersetzungen: 1, dateien: [] }
    const antwort = await helfer.bauen({ teilstueck: 'T1', auftrag: 'baue etwas' })
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-a/gebastel.test.js'))).toBe(true)
    expect(helfer.ticker()).not.toContain(texte.ticker.lokaleBauenZurueckgerollt)
    expect(helfer.ticker()).toContain(texte.ticker.rollbackGeschuetzt(1))
    expect(textVon(antwort)).toContain(texte.agentenLokaleHelfer.rollbackGeschuetztHinweis(1))
    // Und der „nichts"-Satz trifft die Lage: Es GAB etwas zurückzunehmen (die
    // Datei liegt oben nachweislich noch da), es blieb nur alles stehen. Der
    // Zwilling in helferWerkzeuge.js wählt an denselben Zahlen wie lauf.js.
    expect(helfer.ticker()).toContain(texte.ticker.rollbackNichtsAngefasst)
    expect(helfer.ticker()).not.toContain(texte.ticker.rollbackNichtsZurueckgenommen)
  })

  // Derselbe Befund an der zweiten Tür: die ausdrückliche Abnahme mit
  // „nicht gehalten".
  it('sagt es auch bei der Abnahme, statt „zurückgerollt" zu behaupten', async () => {
    const projekt = frischesProjekt('helfer-abnahme')
    schreiben(projekt, 'pruefung/pruefer-a/lauf.test.js', 'AAA\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const helfer = await helferAufbauen(projekt, {
      kennung: 'bauer-1',
      bezeichnung: 'Block 1 „Bauer"',
      strang: null,
      geschuetzt: ['pruefung/pruefer-a/']
    })
    lokaleKi.schreibt = () => schreiben(projekt, 'pruefung/pruefer-a/lauf.test.js', 'BBB\n')
    lokaleKi.antwort = { ok: true, fehler: '', schritte: 1, ersetzungen: 1, dateien: [], fazit: 'gebaut' }
    await helfer.bauen({ teilstueck: 'T1', auftrag: 'baue etwas' })
    const antwort = await helfer.abnehmen({ teilstueck: 'T1', gehalten: false })
    expect(fs.readFileSync(path.join(projekt, 'pruefung/pruefer-a/lauf.test.js'), 'utf8')).toBe('BBB\n')
    expect(helfer.ticker()).not.toContain(texte.ticker.teilstueckVerworfen('T1'))
    expect(helfer.ticker()).toContain(texte.ticker.rollbackGeschuetzt(1))
    expect(textVon(antwort)).toMatch(/ACHTUNG/)
    expect(textVon(antwort)).toContain(texte.agentenLokaleHelfer.rollbackGeschuetztHinweis(1))
  })

  // Und der Fall, den erst die gleichzeitig offenen Stränge möglich machen: Ein
  // ANDERER Block hat seine fertige Runde zusammengeführt, seit dieses Teilstück
  // seinen Rückroll-Punkt bekam. Voll zurückzurollen nähme sie mit — also bleibt
  // stehen, was nicht sicher diesem Block gehört, und beide erfahren davon.
  it('nimmt fremde fertige Arbeit nicht mit — und sagt es Georg wie dem Agenten', async () => {
    const projekt = frischesProjekt('helfer-ueberholt')
    const strang = 'strang/bauer-1'
    schreiben(projekt, 'src/app.js', 'alt\n')
    schreiben(projekt, 'src/fremd.js', 'noch leer\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, strang)
    const helfer = await helferAufbauen(projekt, {
      kennung: 'bauer-1',
      bezeichnung: 'Block 1 „Bauer"',
      strang,
      geschuetzt: [],
      eigenerBereich: ['src/app.js']
    })
    lokaleKi.schreibt = () => schreiben(projekt, 'src/app.js', 'gebastelt\n')
    lokaleKi.antwort = { ok: true, fehler: '', schritte: 1, ersetzungen: 1, dateien: [], fazit: 'gebaut' }
    await helfer.bauen({ teilstueck: 'T1', auftrag: 'baue etwas' })
    // Dazwischen wird ein anderer Block fertig und führt zusammen.
    await strangOeffnen(projekt, 'strang/bauer-2')
    schreiben(projekt, 'src/fremd.js', 'FERTIGE ARBEIT DES ANDEREN\n')
    await sicherungspunktAnlegen(projekt, 'Zwischenstand', { strang: 'strang/bauer-2' })
    await strangZusammenfuehren(
      projekt,
      'strang/bauer-2',
      texte.sicherungen.beschriftungNachBlock('Bauer 2')
    )
    const antwort = await helfer.abnehmen({ teilstueck: 'T1', gehalten: false })
    // Das eigene Gebastel ist weg, die fremde fertige Arbeit steht noch da.
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('alt\n')
    expect(fs.readFileSync(path.join(projekt, 'src/fremd.js'), 'utf8')).toBe(
      'FERTIGE ARBEIT DES ANDEREN\n'
    )
    expect(helfer.ticker()).toContain(texte.ticker.rollbackStandUeberholt(1))
    expect(textVon(antwort)).toContain(texte.agentenLokaleHelfer.rollbackStandUeberholtHinweis(1))
  })

  // Der stille Gegenfall: Die lokale KI meldet Änderungen, der Rückroll findet
  // aber nichts zurückzunehmen. „Der Projektstand ist sauber" wäre dann eine
  // Behauptung ohne Deckung — auch das muss der Agent erfahren.
  it('sagt dem Agenten auch, wenn es gar nichts zurückzunehmen gab', async () => {
    const projekt = frischesProjekt('helfer-nichts')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const helfer = await helferAufbauen(projekt, {
      kennung: 'bauer-1',
      bezeichnung: 'Block 1 „Bauer"',
      strang: null,
      geschuetzt: []
    })
    lokaleKi.antwort = { ok: false, fehler: 'abgebrochen', schritte: 1, ersetzungen: 1, dateien: [] }
    const antwort = await helfer.bauen({ teilstueck: 'T1', auftrag: 'baue etwas' })
    expect(helfer.ticker()).not.toContain(texte.ticker.lokaleBauenZurueckgerollt)
    expect(textVon(antwort)).toContain(texte.agentenLokaleHelfer.rollbackNichtsGefundenHinweis)
  })

  // Fall 3: Der Rückroll-Punkt gehört zu einem früheren Anlauf desselben Blocks.
  // Zurückgerollt wird dann NICHTS — sonst fiele die Arbeit der laufenden Runde
  // mit —, und der Agent muss es lesen.
  it('rollt nichts zurück, wenn der Rückroll-Punkt zu einem früheren Anlauf gehört', async () => {
    const projekt = frischesProjekt('helfer-verschoben')
    const strang = 'strang/bauer-1'
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, strang)
    const helfer = await helferAufbauen(projekt, {
      kennung: 'bauer-1',
      bezeichnung: 'Block 1 „Bauer"',
      strang,
      geschuetzt: []
    })
    lokaleKi.schreibt = () => schreiben(projekt, 'src/app.js', 'vom Teilstück\n')
    lokaleKi.antwort = { ok: true, fehler: '', schritte: 1, ersetzungen: 1, dateien: [], fazit: 'gebaut' }
    await helfer.bauen({ teilstueck: 'T1', auftrag: 'baue etwas' })
    // Der zweite Anlauf desselben Blocks: frischer Punkt auf demselben Strang.
    schreiben(projekt, 'src/app.js', 'Arbeit der laufenden Runde\n')
    await sicherungspunktAnlegen(projekt, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang
    })
    const antwort = await helfer.abnehmen({ teilstueck: 'T1', gehalten: false })
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe(
      'Arbeit der laufenden Runde\n'
    )
    expect(helfer.ticker()).toContain(texte.ticker.rollbackPunktVerschoben)
    expect(textVon(antwort)).toContain(texte.agentenLokaleHelfer.rollbackPunktVerschobenHinweis)
  })

  it('hat für den gescheiterten Rückroll auch im Lauf selbst eine Zeile', () => {
    // Der Zwilling in lauf.js lässt sich ohne ganzen Lauf nicht ausführen;
    // gemessen wird hier deshalb nur, dass es die Zeilen überhaupt gibt.
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(lauf).toContain('texte.ticker.rollbackGescheitert')
    expect(lauf).toContain('texte.ticker.rollbackGeschuetzt')
    expect(texte.agentenLokaleHelfer.rollbackGescheitertHinweis).toMatch(/NICHT geklappt/)
    expect(texte.ticker.rollbackGeschuetzt(2)).toMatch(/unberührt/)
    expect(texte.ticker.rollbackPunktVerschoben).toMatch(/NICHTS/)
  })
})

// Spielt die Reihenfolge eines schreibenden Blocks aus lauf.js nach: Strang
// auf → lokale Reparatur mit Rückroll-Punkt → weiterarbeiten → Blockende.
// `mitZweitemPunkt` stellt die erste Fassung von Bauschritt 45 nach, die am
// Blockende NOCH einen eigenen Punkt auf den Strang legte.
async function blockDurchspielen(name, mitZweitemPunkt) {
  const projekt = frischesProjekt(name)
  const strang = 'strang/bauer-1'
  schreiben(projekt, 'src/app.js', 'alt\n')
  await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
  await strangOeffnen(projekt, strang)
  schreiben(projekt, 'src/app.js', 'halb gebaut\n')
  await sicherungspunktAnlegen(projekt, texte.sicherungen.beschriftungVorLokalerReparatur, {
    strang
  })
  schreiben(projekt, 'src/app.js', 'fertig gebaut\n')
  if (mitZweitemPunkt)
    await sicherungspunktAnlegen(projekt, texte.sicherungen.beschriftungNachBlock('Bauer'), {
      strang
    })
  await strangZusammenfuehren(projekt, strang, texte.sicherungen.beschriftungNachBlock('Bauer'))
  const geladen = await sicherungspunkteLaden(projekt)
  return { projekt, punkte: geladen.punkte }
}

describe('BAUPLAN 45 · Je schreibendem Block genau EIN Blockende-Punkt in Georgs Liste', () => {
  let jetzt = null
  let ersteFassung = null

  beforeAll(async () => {
    jetzt = await blockDurchspielen('ein-punkt', false)
    ersteFassung = await blockDurchspielen('zwei-punkte', true)
  })

  it('bietet den Stand nach dem Block genau einmal an', () => {
    const blockende = jetzt.punkte.filter((p) => p.beschriftung.includes('fertig'))
    expect(blockende).toHaveLength(1)
    expect(jetzt.punkte.map((p) => p.beschriftung).sort()).toEqual(
      ['Stand vor dem Lauf', 'Stand vor lokaler Reparatur', '„Bauer" fertig'].sort()
    )
  })

  it('hält im Zusammenführungs-Punkt den Ordner von jetzt fest', async () => {
    expect(await standWeichtAb(jetzt.projekt)).toBe(false)
    expect(fs.readFileSync(path.join(jetzt.projekt, 'src/app.js'), 'utf8')).toBe('fertig gebaut\n')
  })

  // Zweite Sicherung an derselben Zusage: Legte lauf.js am Blockende doch noch
  // einen eigenen Punkt auf den Strang, bliebe die Liste trotzdem bei einem
  // Eintrag — die Zusammenführung zieht 'haupt' dann nur auf die Strangspitze
  // vor, statt denselben Ordnerstand ein zweites Mal festzuhalten. Beide Wege
  // dürfen Georg nie zwei Einträge zur Wahl stellen, zwischen denen es sachlich
  // nichts zu wählen gibt.
  it('bleibt auch beim alten Ablauf bei einem Eintrag — auf keinem Weg zwei', () => {
    expect(ersteFassung.punkte.filter((p) => p.beschriftung.includes('fertig'))).toHaveLength(1)
    expect(ersteFassung.punkte.length).toBe(jetzt.punkte.length)
  })

  // Trotzdem schreibt lauf.js den zweiten Punkt gar nicht erst: Verlässt sich
  // das Blockende darauf, dass die Zusammenführung ihn wieder einfängt, kippt
  // die Liste, sobald das Vorziehen einmal nicht greift (bewegter gemeinsamer
  // Stand). Nicht angelegt ist verlässlicher als hinterher eingefangen.
  it('legt in lauf.js am Blockende nur noch ohne Strang einen eigenen Punkt an', () => {
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(lauf).toMatch(/if \(!k\.def\.nurLesen && !k\.strang\)/)
  })
})

describe('BAUPLAN 45 · Der Blockende-Punkt heißt nur „fertig", wenn der Block fertig wurde', () => {
  it('hat zwei Wortlaute — einen für fertig, einen für „Runde beendet"', () => {
    expect(texte.sicherungen.beschriftungNachBlock('Prüfer')).toMatch(/fertig/)
    expect(texte.sicherungen.beschriftungRundeBeendet('Prüfer')).not.toMatch(/fertig/)
    expect(texte.sicherungen.beschriftungRundeBeendet('Prüfer')).toContain('Prüfer')
  })

  // Ausgeführt statt nachgelesen: Die Auswahl ist eine eigene Rechenstelle,
  // damit diese Zusage nicht nur als Zeichenkette im Ablaufplaner steht.
  it('wählt nach dem tatsächlichen Ausgang aus', () => {
    expect(blockendeBeschriftung('fertig', 'Prüfer')).toBe(
      texte.sicherungen.beschriftungNachBlock('Prüfer')
    )
    for (const ausgang of ['laeuft', 'offen', 'abgebrochen', null, undefined])
      expect(blockendeBeschriftung(ausgang, 'Prüfer')).toBe(
        texte.sicherungen.beschriftungRundeBeendet('Prüfer')
      )
  })

  it('benutzt genau diese Stelle für den Punkt am Blockende', () => {
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(lauf).toMatch(
      /strangZusammenfuehren\([\s\S]{0,80}blockendeBeschriftung\(k\.status, k\.name\)/
    )
  })
})

describe('BAUPLAN 45 · Ein klemmender Sicherungsstrang wird gesagt, nicht verschluckt', () => {
  const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')

  it('meldet ein gescheitertes Anlegen, statt stumm ohne Trennung weiterzulaufen', () => {
    expect(lauf).toMatch(/if \(!geoeffnet\.ok\) \{[\s\S]{0,200}strangNichtGeoeffnet/)
    expect(texte.ticker.strangNichtGeoeffnet('Block 2 „Bauer"')).toMatch(/NICHT/)
    expect(texte.ticker.strangNichtGeoeffnet('Block 2 „Bauer"')).toMatch(/ganzen\s*\n?\s*Projektordner/)
  })

  it('meldet eine gescheiterte Zusammenführung', () => {
    expect(lauf).toContain('texte.ticker.strangNichtZusammengefuehrt')
    expect(texte.ticker.strangNichtZusammengefuehrt('Block 2 „Bauer"')).toMatch(/NICHT/)
  })

  // Der Kern des Fundes: Wurde der Strang schon vor dem Versuch losgelassen,
  // öffnete der nächste Anlauf denselben Namen neu — und schnitt damit genau
  // die Punkte ab, die der Strang festhalten sollte. Auch das Sicherheitsnetz
  // am Laufende versuchte es dann nie erneut.
  it('lässt den Strang erst NACH dem Gelingen los', () => {
    const zusammenfuehren = lauf.indexOf('await strangZusammenfuehren(')
    const losgelassen = lauf.indexOf('k.strang = null')
    expect(zusammenfuehren).toBeGreaterThan(-1)
    expect(losgelassen).toBeGreaterThan(zusammenfuehren)
  })

  // Nachgemessen statt behauptet: Bis zur Nacharbeit prüfte diese Stelle nur,
  // dass es die beiden Textbausteine GIBT — geliefert wurde im Fehlerfall
  // trotzdem der Satz vom Laufstart, und die Prüfung blieb grün. Jetzt klemmt
  // der Strang wirklich, und gemessen wird der Rückgabewert.
  it('liefert beim geklemmten Anlegen seinen eigenen Fehlertext — der alte sprach vom Laufstart', async () => {
    const projekt = frischesProjekt('strang-klemmt-oeffnen')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const spion = vi.spyOn(git, 'branch').mockRejectedValue(new Error('klemmt'))
    try {
      const ergebnis = await strangOeffnen(projekt, 'strang/bauer-1')
      expect(ergebnis.ok).toBe(false)
      expect(ergebnis.fehler).toBe(texte.sicherungen.fehlerStrangOeffnen)
      expect(ergebnis.fehler).not.toBe(texte.sicherungen.fehlerAnlegen)
    } finally {
      spion.mockRestore()
    }
    expect(texte.sicherungen.fehlerAnlegen).toMatch(/nicht gestartet/)
    expect(texte.sicherungen.fehlerStrangOeffnen).not.toMatch(/gestartet/)
  })

  it('liefert bei der geklemmten Zusammenführung seinen eigenen Fehlertext', async () => {
    const projekt = frischesProjekt('strang-klemmt-naht')
    const strang = 'strang/bauer-1'
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, strang)
    schreiben(projekt, 'src/app.js', 'vom Bauer\n')
    await sicherungspunktAnlegen(projekt, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang
    })
    const spion = vi.spyOn(git, 'commit').mockRejectedValue(new Error('klemmt'))
    try {
      const ergebnis = await strangZusammenfuehren(
        projekt,
        strang,
        texte.sicherungen.beschriftungNachBlock('Bauer')
      )
      expect(ergebnis.ok).toBe(false)
      expect(ergebnis.fehler).toBe(texte.sicherungen.fehlerStrangZusammenfuehren)
      expect(ergebnis.fehler).not.toBe(texte.sicherungen.fehlerAnlegen)
    } finally {
      spion.mockRestore()
    }
    expect(texte.sicherungen.fehlerStrangZusammenfuehren).not.toMatch(/gestartet/)
  })
})

describe('BAUPLAN 45 · Der gefilterte Überblick sagt es auch, wenn er ALLES weggelassen hat', () => {
  // Der Fall: Ein Umsetzer mit Dateiliste hat in dieser Runde nur außerhalb
  // gewirkt (ausgeführte Befehle schreiben an der Dateilisten-Sperre vorbei).
  // Nach dem Filtern bleibt keine Datei übrig — ein leerer Auftrag hieße für
  // den Agenten „nichts hat sich geändert", und das wäre gelogen.
  it('gibt den Hinweis auch ohne eine einzige Datei in den Auftrag', () => {
    expect(diffAuftragsText([], 2)).toBe(texte.agentenUebergabe.diffAusserhalb(2))
    expect(diffAuftragsText([], 2)).toMatch(/außerhalb deiner Dateiliste/)
  })

  // Nicht nur die Rechenstelle, sondern der ganze Weg: zwei Sicherungspunkte,
  // dazwischen wirkt der Block AUSSCHLIESSLICH außerhalb seiner Dateiliste —
  // genau das, was ausgeführte Befehle tun (BAUPLAN 44).
  it('meldet einen Block, der nur außerhalb gewirkt hat, statt ihn leer ausgehen zu lassen', async () => {
    const projekt = frischesProjekt('nur-ausserhalb')
    schreiben(projekt, 'src/main/lauf.js', 'meins\n')
    schreiben(projekt, 'dist/gebaut.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'vorher')
    const vorher = await letzterPunktId(projekt)
    schreiben(projekt, 'dist/gebaut.js', 'vom Befehl neu gebaut\n')
    schreiben(projekt, 'dist/neu.js', 'vom Befehl erzeugt\n')
    await sicherungspunktAnlegen(projekt, 'nachher')
    const nachher = await letzterPunktId(projekt)
    const vergleich = await punkteVergleichen(projekt, vorher, nachher, {
      nurDateien: ['src/main/lauf.js']
    })
    expect(vergleich.dateien).toEqual([])
    expect(vergleich.ausserhalb).toBe(2)
    // Bis zur Nacharbeit stieg lauf.js hier mit '' aus: Georg sah die Zeile im
    // Ticker, der Agent bekam nichts — sein Auftrag behauptete stumm, es habe
    // sich nichts geändert.
    expect(diffAuftragsText(vergleich.dateien, vergleich.ausserhalb)).not.toBe('')
    expect(diffAuftragsText(vergleich.dateien, vergleich.ausserhalb)).toMatch(/2 geänderte Dateien/)
  })

  it('bleibt leer, wenn wirklich nichts wegfiel', () => {
    expect(diffAuftragsText([], 0)).toBe('')
    expect(diffAuftragsText(null, 0)).toBe('')
  })

  it('hängt den Hinweis wie bisher an einen vorhandenen Überblick', () => {
    const datei = { pfad: 'src/meins.js', art: 'geaendert', plus: 1, minus: 0, stellen: [] }
    const text = diffAuftragsText([datei], 3)
    expect(text).toContain('src/meins.js')
    expect(text.endsWith(texte.agentenUebergabe.diffAusserhalb(3))).toBe(true)
  })

  it('führt in lauf.js beide Fälle über dieselbe Rechenstelle', () => {
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(lauf).toMatch(/const text = diffAuftragsText\(/)
    expect(lauf).toMatch(/if \(vergleich\.dateien\.length === 0\) return text/)
  })
})

describe('BAUPLAN 45 · Auch die Wiederaufnahme sagt, was sie stehengelassen hat', () => {
  it('lässt beim Zurückrollen vor dem Fortsetzen fremde Prüfmappen stehen — und zählt sie', async () => {
    // Genau der Aufruf, den laufFortsetzen stellt: ohne Strang (der aus dem
    // Absturz hielte die Arbeit fest, die hier gerade fallen soll), dafür mit
    // den Prüfmappen der anderen Instanzen als geschützte Bereiche.
    const projekt = frischesProjekt('wiederaufnahme')
    schreiben(projekt, 'src/a.js', 'start\n')
    schreiben(projekt, 'pruefung/pruefer-1/t.js', 'alter Test\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    schreiben(projekt, 'src/a.js', 'Gebastel des abgebrochenen Blocks\n')
    schreiben(projekt, 'pruefung/pruefer-1/t.js', 'frischer Test des Prüfers\n')
    const zurueck = await aufLetztenPunktZuruecksetzen(projekt, {
      geschuetzt: ['pruefung/pruefer-1/']
    })
    expect(zurueck.zurueckgesetzt).toBe(true)
    expect(zurueck.geschuetztUebersprungen).toBe(1)
    expect(fs.readFileSync(path.join(projekt, 'src/a.js'), 'utf8')).toBe('start\n')
    expect(fs.readFileSync(path.join(projekt, 'pruefung/pruefer-1/t.js'), 'utf8')).toBe(
      'frischer Test des Prüfers\n'
    )
  })

  it('reicht diese Zahl bis in den Ticker durch, statt sie wegzuwerfen', () => {
    // Die Zahl verlässt laufFortsetzen und wird am Laufstart mit demselben
    // Wortlaut gemeldet wie überall sonst. Der WEG dahin ist eine
    // Quelltext-Zusicherung; dass die Wiederaufnahme wirklich schützt, misst
    // der Fall darunter ausgeführt.
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(lauf).toMatch(/rollbackGeschuetzt: zurueck\.geschuetztUebersprungen/)
    expect(lauf).toMatch(
      /fortsetzung\?\.rollbackGeschuetzt > 0[\s\S]{0,120}texte\.ticker\.rollbackGeschuetzt\(fortsetzung\.rollbackGeschuetzt\)/
    )
  })
})

// laufFortsetzen ist die einzige Stelle der Lauf-Verdrahtung, die sich ohne
// Fenster und ohne Motor fahren lässt: Sie rollt zurück, BEVOR sie laufStarten
// ruft. Damit dabei kein echter Lauf anspringt, bekommt das Schaubild
// absichtlich keinen Pfeil — laufStarten steigt dann mit „nicht
// zusammenhängend" aus, lange vor jedem Motor. Bis zur Nacharbeit stand hier
// nur die Behauptung, das ginge nicht.
describe('BAUPLAN 45 · Die Wiederaufnahme — wirklich gefahren, nicht nachgelesen', () => {
  const BAUER = 'aaaaaaaa-1111-2222-3333-444444444444'
  const PRUEFER = 'bbbbbbbb-5555-6666-7777-888888888888'
  const ordner = pruefOrdnerFuer(blockDefinition('pruefer'), { instanzId: PRUEFER })

  function laufstandAufbauen(name, fertigIds) {
    const projekt = frischesProjekt(name)
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({
        reparaturRunden: 1,
        bloecke: [
          { instanzId: BAUER, blockId: 'bauer', feldWerte: {}, position: { x: 0, y: 0 } },
          { instanzId: PRUEFER, blockId: 'pruefer', feldWerte: {}, position: { x: 300, y: 0 } }
        ],
        pfeile: []
      }),
      'utf8'
    )
    return projekt
  }

  function laufstandSchreiben(projekt, fertigIds) {
    fs.writeFileSync(
      path.join(projekt, 'laufstand.json'),
      JSON.stringify({
        gestartetAm: Date.now(),
        kartenIds: [],
        kettenIds: [BAUER, PRUEFER],
        fertigIds
      }),
      'utf8'
    )
  }

  it('rollt das Gebastel des abgebrochenen Blocks zurück und lässt die fremde Prüfmappe stehen', async () => {
    const projekt = laufstandAufbauen('wiederaufnahme-echt')
    schreiben(projekt, 'src/app.js', 'alt\n')
    schreiben(projekt, `pruefung/${ordner}/lauf.test.js`, 'alter Test\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    // Absturz mitten im Bauer-Block: Sein Gebastel liegt herum, der Prüfer hat
    // in seiner Mappe frische Arbeit stehen.
    schreiben(projekt, 'src/app.js', 'halbfertiges Gebastel\n')
    schreiben(projekt, `pruefung/${ordner}/frisch.test.js`, 'frisch geschrieben\n')
    laufstandSchreiben(projekt, [])

    const antwort = await laufFortsetzen(null, projekt)
    // Vor jedem Motor ausgestiegen — gemessen wird nur der Rückroll davor.
    expect(antwort.ok).toBe(false)
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('alt\n')
    expect(fs.existsSync(path.join(projekt, 'pruefung', ordner, 'frisch.test.js'))).toBe(true)
  })

  it('räumt die halbfertige Arbeit des ABGEBROCHENEN Prüfers aber sehr wohl weg', async () => {
    // Die Gegenprobe: Geschützt ist fremdes Revier, nicht das eigene — sonst
    // bliebe von „zurückgerollt" nichts übrig.
    const projekt = laufstandAufbauen('wiederaufnahme-eigen')
    schreiben(projekt, 'src/app.js', 'alt\n')
    schreiben(projekt, `pruefung/${ordner}/lauf.test.js`, 'alter Test\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    schreiben(projekt, `pruefung/${ordner}/halbfertig.test.js`, 'halbfertig\n')
    // Der Bauer ist durch — abgebrochen ist der Prüfer selbst.
    laufstandSchreiben(projekt, [BAUER])

    await laufFortsetzen(null, projekt)
    expect(fs.existsSync(path.join(projekt, 'pruefung', ordner, 'halbfertig.test.js'))).toBe(false)
    expect(fs.readFileSync(path.join(projekt, 'pruefung', ordner, 'lauf.test.js'), 'utf8')).toBe(
      'alter Test\n'
    )
  })
})

// Die drei Nähte, an denen der Ablaufplaner hängt — hier WIRKLICH ausgeführt,
// mit echten Sicherungspunkten und demselben Ticker, den Georg liest. Vorher
// war die ganze Anbindung nur per Textsuche abgesichert: Eine Fassung, in der
// kein Block je einen Strang bekommt, während der Ticker weiter „Eigener
// Sicherungsstrang für Block N" behauptet, lief ohne eine einzige rote Zeile
// durch — genau die Lage, die dieser Bauschritt verhindern soll.
describe('BAUPLAN 45 · Der eigene Sicherungsstrang — ausgeführt statt abgeklopft', () => {
  const bezeichnung = 'Block 1 „Bauer"'

  function knoten(def = {}, zusatz = {}) {
    return { def, pruefOrdner: '', name: 'Bauer', status: 'laeuft', ...zusatz }
  }

  it('legt für einen Schreiber MIT Dateiliste wirklich einen Strang an und sagt es', async () => {
    const projekt = frischesProjekt('naht-mit-liste')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const zeilen = []
    const k = knoten()
    const strang = await strangOeffnenAn(projekt, k, {
      instanzId: 'bauer-1',
      bezeichnung,
      dateiListe: ['src/app.js'],
      tickern: (t) => zeilen.push(t)
    })
    expect(strang).toBe('strang/bauer-1')
    expect(k.strang).toBe('strang/bauer-1')
    // Nicht nur behauptet: Den Strang gibt es wirklich, und er steht auf dem
    // gemeinsamen Stand.
    expect(await letzterPunktId(projekt, 'strang/bauer-1')).toBe(await letzterPunktId(projekt))
    expect(zeilen).toEqual([texte.ticker.strangGeoeffnet(bezeichnung)])
  })

  it('gibt einem Schreiber OHNE Dateiliste keinen Strang — und behauptet auch keinen', async () => {
    const projekt = frischesProjekt('naht-ohne-liste')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const zeilen = []
    const k = knoten()
    const strang = await strangOeffnenAn(projekt, k, {
      instanzId: 'bauer-2',
      bezeichnung,
      dateiListe: null,
      tickern: (t) => zeilen.push(t)
    })
    expect(strang).toBe(null)
    expect(k.strang).toBeUndefined()
    expect(await letzterPunktId(projekt, 'strang/bauer-2')).toBe(null)
    expect(zeilen).toEqual([texte.ticker.strangOhneWirkbereich(bezeichnung)])
  })

  it('meldet den Wechsel, wenn der Datenvertrag erst in einer späteren Runde kommt', async () => {
    const projekt = frischesProjekt('naht-nachgereicht')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const zeilen = []
    const k = knoten()
    const tickern = (t) => zeilen.push(t)
    await strangOeffnenAn(projekt, k, { instanzId: 'bauer-3', bezeichnung, dateiListe: null, tickern })
    // Zweite Runde, dieselbe Lage: keine zweite Zeile.
    await strangOeffnenAn(projekt, k, { instanzId: 'bauer-3', bezeichnung, dateiListe: null, tickern })
    // Dritte Runde, Lieferung da: jetzt kippt es, und das gehört gesagt.
    await strangOeffnenAn(projekt, k, {
      instanzId: 'bauer-3',
      bezeichnung,
      dateiListe: ['src/app.js'],
      tickern
    })
    expect(zeilen).toEqual([
      texte.ticker.strangOhneWirkbereich(bezeichnung),
      texte.ticker.strangGeoeffnet(bezeichnung)
    ])
  })

  it('führt am Blockende wirklich zusammen — der Punkt steht danach in Georgs Liste', async () => {
    const projekt = frischesProjekt('naht-schliessen')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const zeilen = []
    const tickern = (t) => zeilen.push(t)
    const k = knoten()
    await strangOeffnenAn(projekt, k, {
      instanzId: 'bauer-4',
      bezeichnung,
      dateiListe: ['src/app.js'],
      tickern
    })
    schreiben(projekt, 'src/app.js', 'vom Bauer gebaut\n')
    await sicherungspunktAnlegen(projekt, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang: k.strang
    })
    k.status = 'fertig'
    expect(await strangSchliessenAn(projekt, k, { bezeichnung, tickern })).toBe(true)
    expect(k.strang).toBe(null)
    // Der Strang ist weg, sein Punkt aber angekommen.
    expect(await letzterPunktId(projekt, 'strang/bauer-4')).toBe(null)
    const liste = await sicherungspunkteLaden(projekt)
    expect(liste.punkte.map((p) => p.beschriftung)).toContain(
      texte.sicherungen.beschriftungNachBlock('Bauer')
    )
    expect(zeilen).toContain(texte.ticker.strangZusammengefuehrt(bezeichnung))
  })

  it('rollt auf dem Strang zurück, lässt fremdes Revier stehen und sagt beides', async () => {
    const projekt = frischesProjekt('naht-zurueckrollen')
    const strang = 'strang/bauer-5'
    schreiben(projekt, 'src/app.js', 'alt\n')
    schreiben(projekt, 'pruefung/pruefer-b/lauf.test.js', 'prueft die App\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, strang)
    await sicherungspunktAnlegen(projekt, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang
    })
    schreiben(projekt, 'src/app.js', 'von der lokalen KI verbastelt\n')
    schreiben(projekt, 'pruefung/pruefer-b/frisch.test.js', 'frisch in der Nachprüfung\n')
    const zeilen = []
    const zurueck = await zurueckrollenAn(projekt, {
      strang,
      geschuetzt: ['pruefung/pruefer-b/'],
      erfolgsText: texte.ticker.zurueckgesetzt,
      tickern: (t) => zeilen.push(t)
    })
    expect(zurueck.ok).toBe(true)
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('alt\n')
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-b/frisch.test.js'))).toBe(true)
    expect(zeilen).toContain(texte.ticker.zurueckgesetzt)
    expect(zeilen).toContain(texte.ticker.rollbackGeschuetzt(1))
    expect(zeilen).not.toContain(texte.ticker.rollbackGescheitert)
  })

  it('hängt den Ablaufplaner an genau diese Nähte', () => {
    // Die Naht selbst ist oben ausgeführt; hier wird nur nachgezählt, dass der
    // Ablaufplaner nichts Eigenes daneben stellt.
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(lauf).toMatch(/async function strangOeffnenFuer\(k\) \{\s*\n\s*await strangOeffnenAn\(/)
    expect(lauf).toMatch(
      /async function strangSchliessenFuer\(k\) \{\s*\n\s*await strangSchliessenAn\(/
    )
    expect(lauf).toMatch(/return zurueckrollenAn\(projektPfad, \{/)
  })
})

// Spielt den Ablauf des Prüfers in der ECHTEN Reihenfolge des Ablaufplaners
// durch — Naht für Naht so, wie lauf.js sie fährt:
//   Strang öffnen (lauf.js, knotenAusfuehren)
//   → Rückroll-Punkt AUF DEN STRANG (lokale Vorreparatur)
//   → die lokale KI verbastelt eine fremde Datei
//   → der Prüfer geht auf 'offen' und kehrt früh zurück (Nachprüfung folgt)
//   → Blockende-Naht in der Planer-Schleife
//   → Strang-Naht des NÄCHSTEN Anlaufs
//   → Rückroll der gescheiterten Nachprüfung.
//
// Genau die beiden mittleren Schritte fehlten der Prüfung bis hierher, und
// genau sie machten den Unterschied. Rot vor Grün, gemessen mit der Fassung
// von vorher (Kopie unter arbeitsablage/): Die Blockende-Naht führte auch nach
// dem frühen Rückkehren zusammen, fror damit das Gebastel als neue gemeinsame
// Spitze ein, das erneute Öffnen setzte den Strang genau darauf — und der
// Rückroll fand nichts mehr zurückzunehmen. Deshalb misst diese Prüfung den
// DATEIINHALT und nicht bloß Rückgabewerte.
function prueferKnoten() {
  return {
    def: { prueft: true, nurLesen: false },
    pruefOrdner: 'pruefer-b',
    name: 'Prüfer',
    status: 'laeuft'
  }
}

// Der ganze Weg bis zum Rückroll. `zusammenfuehrenTrotzOffen` stellt die alte
// Fassung nach: Blockende-Naht führt auch dann zusammen, wenn der Block gleich
// wieder läuft.
async function nachpruefungDurchspielen(name, { zusammenfuehrenTrotzOffen = false } = {}) {
  const bezeichnung = 'Block 2 „Prüfer"'
  const projekt = frischesProjekt(name)
  const zeilen = []
  const tickern = (t) => zeilen.push(t)
  const k = prueferKnoten()
  schreiben(projekt, 'src/app.js', 'sauberer Stand\n')
  schreiben(projekt, 'pruefung/pruefer-b/lauf.test.js', 'prüft die App\n')
  await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')

  const oeffnen = () =>
    strangOeffnenAn(projekt, k, { instanzId: 'pruefer-b', bezeichnung, dateiListe: null, tickern })
  await oeffnen()
  // Der Prüfer hat in seiner Mappe gearbeitet, bevor die lokale KI drankommt —
  // sonst hielte der Rückroll-Punkt nichts fest und entstünde gar nicht.
  schreiben(projekt, 'pruefung/pruefer-b/urteil.test.js', 'Beanstandung belegt\n')
  const anker = await sicherungspunktAnlegen(
    projekt,
    texte.sicherungen.beschriftungVorLokalerReparatur,
    { strang: k.strang }
  )
  // Die lokale KI repariert am Ziel-Block — und verbastelt dabei.
  schreiben(projekt, 'src/app.js', 'GEBASTEL\n')
  // Der Prüfer wird für die Nachprüfung wieder auf 'offen' gesetzt und kehrt
  // früh zurück; die Planer-Schleife läuft trotzdem über die Blockende-Naht.
  // `strangOffenHalten` ist genau das Kennzeichen, das lauf.js an dieser einen
  // Stelle setzt — nur damit überlebt der Ankerpunkt das Blockende.
  k.status = 'offen'
  k.strangOffenHalten = true
  await strangSchliessenAn(projekt, k, {
    bezeichnung,
    tickern,
    endgueltig: zusammenfuehrenTrotzOffen
  })
  // Der nächste Anlauf desselben Blocks: die Nachprüfung.
  k.status = 'laeuft'
  await oeffnen()
  // In der Nachprüfung schreibt der Prüfer frische Tests — sie liegen in SEINER
  // Mappe und sind aus Sicht des Ziel-Blocks fremdes Revier.
  schreiben(projekt, 'pruefung/pruefer-b/nachpruefung.test.js', 'frisch in der Nachprüfung\n')
  // Die Nachprüfung scheitert: Rückroll auf den Punkt vor der lokalen Reparatur.
  const zurueck = await zurueckrollenAn(projekt, {
    strang: k.strang,
    geschuetzt: ['pruefung/pruefer-b/'],
    erfolgsText: texte.ticker.lokaleReparaturZurueckgerollt(1, 2),
    nichtsMelden: true,
    tickern
  })
  return { projekt, k, anker, zurueck, zeilen }
}

describe('BAUPLAN 45 · Der Rückroll der gescheiterten Nachprüfung — echte Reihenfolge des Planers', () => {
  let lage = null

  beforeAll(async () => {
    lage = await nachpruefungDurchspielen('planer-reihenfolge')
  })

  it('nimmt das Gebastel der lokalen KI wirklich zurück — gemessen an der Datei', () => {
    expect(fs.readFileSync(path.join(lage.projekt, 'src/app.js'), 'utf8')).toBe('sauberer Stand\n')
    expect(lage.zurueck.ok).toBe(true)
    expect(lage.zurueck.zurueckgesetzt).toBe(true)
  })

  it('behält den Strang über den frühen Rückkehr-Punkt hinweg — samt seinem Anker', async () => {
    expect(lage.k.strang).toBe('strang/pruefer-b')
    expect(await letzterPunktId(lage.projekt, lage.k.strang)).toBe(lage.anker.id)
    // Der gemeinsame Stand steht noch dort, wo der Lauf ihn verlassen hat: Ein
    // Anlauf, der noch läuft, hat nichts einzufrieren.
    expect(await letzterPunktId(lage.projekt)).not.toBe(lage.anker.id)
  })

  it('lässt die frischen Tests der Nachprüfung stehen und sagt beides im Ticker', () => {
    expect(
      fs.existsSync(path.join(lage.projekt, 'pruefung/pruefer-b/nachpruefung.test.js'))
    ).toBe(true)
    expect(lage.zurueck.geschuetztUebersprungen).toBe(1)
    expect(lage.zeilen).toContain(texte.ticker.lokaleReparaturZurueckgerollt(1, 2))
    expect(lage.zeilen).toContain(texte.ticker.rollbackGeschuetzt(1))
    expect(lage.zeilen).not.toContain(texte.ticker.rollbackNichtsZurueckgenommen)
    expect(lage.zeilen).not.toContain(texte.ticker.rollbackNichtsAngefasst)
  })

  // Die Gegenprobe, die den Mechanismus festnagelt: Führt die Blockende-Naht
  // trotz 'offen' zusammen (die Fassung vor dieser Nacharbeit), friert der
  // Arbeitsordner MIT dem Gebastel als gemeinsame Spitze ein — und der Rückroll
  // läuft ins Leere. Genau dieser Fall stand vorher still im Ticker.
  it('läuft ins Leere, wenn am Blockende trotzdem zusammengeführt wird — und sagt DAS', async () => {
    const alt = await nachpruefungDurchspielen('planer-alte-reihenfolge', {
      zusammenfuehrenTrotzOffen: true
    })
    expect(fs.readFileSync(path.join(alt.projekt, 'src/app.js'), 'utf8')).toBe('GEBASTEL\n')
    expect(alt.zurueck.zurueckgesetzt).toBe(false)
    expect(alt.zeilen).not.toContain(texte.ticker.lokaleReparaturZurueckgerollt(1, 2))
    // Und zwar mit dem Satz, der zur Lage passt: Die frischen Tests der
    // Nachprüfung liegen in geschütztem Revier — es GAB also etwas
    // zurückzunehmen, es blieb nur alles stehen. „Der Projektordner stand schon
    // genau auf dem Sicherungspunkt" wäre hier gemessen falsch.
    expect(alt.zurueck.geschuetztUebersprungen).toBe(1)
    expect(alt.zeilen).toContain(texte.ticker.rollbackNichtsAngefasst)
    expect(alt.zeilen).not.toContain(texte.ticker.rollbackNichtsZurueckgenommen)
  })
})

describe('BAUPLAN 45 · Ein Rückroll, der nichts zurückgenommen hat, bleibt nicht still', () => {
  // Rot vor Grün: Ohne den Gegenzweig in zurueckrollenAn kam hier KEINE einzige
  // Zeile — der Ticker sprang wortlos weiter, während der Agent den Hinweis
  // sehr wohl bekam (helferWerkzeuge.js). Georg las von dem Versuch nichts.
  async function ohneWirkungZurueckrollen(name, nichtsMelden) {
    const projekt = frischesProjekt(name)
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const zeilen = []
    const zurueck = await zurueckrollenAn(projekt, {
      geschuetzt: [],
      erfolgsText: texte.ticker.lokaleReparaturZurueckgerollt(1, 2),
      nichtsMelden,
      tickern: (t) => zeilen.push(t)
    })
    return { projekt, zurueck, zeilen }
  }

  it('sagt es, wo ein Rückroll versprochen war', async () => {
    const { projekt, zurueck, zeilen } = await ohneWirkungZurueckrollen('nichts-mit-zeile', true)
    expect(zurueck.ok).toBe(true)
    expect(zurueck.zurueckgesetzt).toBe(false)
    // Hier stimmt der Satz auch wörtlich: Es war wirklich nichts zu tun.
    expect(await standWeichtAb(projekt)).toBe(false)
    expect(zurueck.geschuetztUebersprungen).toBe(0)
    expect(zurueck.fremdUebersprungen).toBe(0)
    expect(zeilen).toEqual([texte.ticker.rollbackNichtsZurueckgenommen])
    expect(texte.ticker.rollbackNichtsZurueckgenommen).toMatch(/nichts zurückzunehmen/)
  })

  it('bleibt still, wo „nichts zurückzunehmen" der Normalfall ist (harter Stopp)', async () => {
    const { zeilen } = await ohneWirkungZurueckrollen('nichts-ohne-zeile', false)
    expect(zeilen).toEqual([])
  })

  it('knüpft die Zeile im Lauf an den Aufrufer, nicht an die Naht', () => {
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    // Die Vorreparatur verspricht einen Rückroll — sie schaltet die Zeile frei.
    expect(lauf).toMatch(
      /lokaleReparaturZurueckgerollt\(k\.lokaleVersuche, LOKALE_REPARATUR_VERSUCHE\),[\s\S]{0,300}nichtsMelden: true/
    )
    // Der harte Stopp schaltet sie NICHT frei — seine Naht kennt kein nichtsMelden.
    expect(lauf).toMatch(
      /export async function hartZurueckrollenAn[\s\S]{0,900}erfolgsText: texte\.ticker\.zurueckgesetzt,\s*\n\s*tickern\s*\n\s*\}\)/
    )
  })

  it('sagt es auch in den lokalen Helfern — dort ist ein Rückroll immer versprochen', async () => {
    const projekt = frischesProjekt('helfer-nichts-ticker')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const helfer = await helferAufbauen(projekt, {
      kennung: 'bauer-1',
      bezeichnung: 'Block 1 „Bauer"',
      strang: null,
      geschuetzt: []
    })
    lokaleKi.antwort = { ok: false, fehler: 'abgebrochen', schritte: 1, ersetzungen: 1, dateien: [] }
    await helfer.bauen({ teilstueck: 'T1', auftrag: 'baue etwas' })
    expect(helfer.ticker()).toContain(texte.ticker.rollbackNichtsZurueckgenommen)
    expect(helfer.ticker()).not.toContain(texte.ticker.lokaleBauenZurueckgerollt)
  })
})

// Nacharbeit: „nichts zurückgenommen" ist ZWEIERLEI, und ein einziger Satz für
// beides war messbar falsch. Der Rückgabewert `zurueckgesetzt: false` fällt
// genauso, wenn es sehr wohl etwas zurückzunehmen gab und die Filter es
// stehenließen — dann behauptete der Ticker „der Projektordner stand schon genau
// auf dem Sicherungspunkt" und sagte in der Zeile direkt darunter, was
// liegengeblieben ist. Diese drei Prüfungen messen jede Lage am DATEIINHALT.
//
// Rot vor Grün, so gemessen: Gegen den Stand vor dieser Nacharbeit (eine Kopie
// von lauf.js/texte.js unter arbeitsablage/) fielen Fall A und Fall B, weil dort
// der Satz „stand schon genau auf dem Sicherungspunkt" kam.
describe('BAUPLAN 45 · Der „nichts"-Satz trifft die Lage, die wirklich vorliegt', () => {
  const erfolg = texte.ticker.lokaleReparaturZurueckgerollt(1, 2)

  it('Fall A · fremdes Revier: sagt, dass der verworfene Stand liegenbleibt', async () => {
    const projekt = frischesProjekt('nichts-fremdes-revier')
    schreiben(projekt, 'src/app.js', 'sauberer Stand\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    // Die einzige Änderung seit dem Punkt liegt in der Mappe eines anderen
    // Prüfers — der Rückroll darf sie nicht anfassen und fasst deshalb nichts an.
    schreiben(projekt, 'pruefung/pruefer-x/alt.test.js', 'FREMDE FRISCHE ARBEIT\n')
    const zeilen = []
    const zurueck = await zurueckrollenAn(projekt, {
      geschuetzt: ['pruefung/pruefer-x/'],
      erfolgsText: erfolg,
      nichtsMelden: true,
      tickern: (t) => zeilen.push(t)
    })
    expect(zurueck.zurueckgesetzt).toBe(false)
    // Es GAB etwas zurückzunehmen — genau eine Datei, und sie liegt unverändert da.
    expect(zurueck.geschuetztUebersprungen).toBe(1)
    expect(fs.readFileSync(path.join(projekt, 'pruefung/pruefer-x/alt.test.js'), 'utf8')).toBe(
      'FREMDE FRISCHE ARBEIT\n'
    )
    expect(zeilen).toContain(texte.ticker.rollbackNichtsAngefasst)
    expect(zeilen).toContain(texte.ticker.rollbackGeschuetzt(1))
    expect(zeilen).not.toContain(texte.ticker.rollbackNichtsZurueckgenommen)
    expect(zeilen).not.toContain(erfolg)
  })

  it('Fall B · überholter Anker ohne Wirkbereich: widerspricht sich nicht mehr', async () => {
    const projekt = frischesProjekt('nichts-ueberholter-anker')
    schreiben(projekt, 'src/app.js', 'sauberer Stand\n')
    schreiben(projekt, 'src/fremd.js', 'noch leer\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, 'strang/pruefer-x')
    schreiben(projekt, 'src/app.js', 'GEBASTEL\n')
    // Ein anderer Block wird fertig und führt zusammen: Der Anker des wartenden
    // Strangs kennt diese Runde nicht mehr.
    await strangOeffnen(projekt, 'strang/bauer-2')
    schreiben(projekt, 'src/fremd.js', 'FERTIGE ARBEIT DES ANDEREN\n')
    await sicherungspunktAnlegen(projekt, 'Zwischenstand', { strang: 'strang/bauer-2' })
    await strangZusammenfuehren(
      projekt,
      'strang/bauer-2',
      texte.sicherungen.beschriftungNachBlock('Bauer 2')
    )
    const zeilen = []
    const zurueck = await zurueckrollenAn(projekt, {
      strang: 'strang/pruefer-x',
      geschuetzt: [],
      // Ohne benannten Wirkbereich nimmt der Rückroll lieber GAR nichts zurück.
      eigenerBereich: null,
      erfolgsText: erfolg,
      nichtsMelden: true,
      tickern: (t) => zeilen.push(t)
    })
    expect(zurueck.zurueckgesetzt).toBe(false)
    expect(zurueck.standUeberholt).toBe(true)
    expect(zurueck.fremdUebersprungen).toBeGreaterThan(0)
    // Beide Stände liegen unverändert im Ordner — genau das sagt der neue Satz.
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('GEBASTEL\n')
    expect(fs.readFileSync(path.join(projekt, 'src/fremd.js'), 'utf8')).toBe(
      'FERTIGE ARBEIT DES ANDEREN\n'
    )
    expect(zeilen).toContain(texte.ticker.rollbackNichtsAngefasst)
    expect(zeilen).toContain(texte.ticker.rollbackStandUeberholt(zurueck.fremdUebersprungen))
    expect(zeilen).not.toContain(texte.ticker.rollbackNichtsZurueckgenommen)
  })

  it('Fall C · wirklich nichts zu tun: behält den alten Satz', async () => {
    const projekt = frischesProjekt('nichts-wirklich-nichts')
    schreiben(projekt, 'src/app.js', 'sauberer Stand\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const zeilen = []
    const zurueck = await zurueckrollenAn(projekt, {
      geschuetzt: ['pruefung/pruefer-x/'],
      erfolgsText: erfolg,
      nichtsMelden: true,
      tickern: (t) => zeilen.push(t)
    })
    expect(zurueck.zurueckgesetzt).toBe(false)
    expect(zurueck.geschuetztUebersprungen).toBe(0)
    expect(zurueck.fremdUebersprungen).toBe(0)
    expect(await standWeichtAb(projekt)).toBe(false)
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('sauberer Stand\n')
    expect(zeilen).toEqual([texte.ticker.rollbackNichtsZurueckgenommen])
  })

  it('sagt die beiden Lagen mit verschiedenen Worten — und keiner davon lügt', () => {
    // Der Satz für „wirklich nichts" behauptet einen Ordner auf dem Punkt; der
    // andere darf das gerade NICHT tun, sondern muss das Liegenbleiben sagen.
    expect(texte.ticker.rollbackNichtsZurueckgenommen).toMatch(/stand schon genau auf/)
    expect(texte.ticker.rollbackNichtsAngefasst).not.toMatch(/stand schon genau auf/)
    expect(texte.ticker.rollbackNichtsAngefasst).toMatch(/liegt unverändert im Projektordner/)
  })
})

// Die echte Kette aus dem Alltag, Naht für Naht gefahren: Der Prüfer weist
// zurück, die lokale KI repariert zweimal vergeblich, das Budget ist verbraucht,
// der Motor-Bauer übernimmt — und danach geht der Prüfer in die Nachprüfung.
// Genau in dieser Kette wartet ein Strang mit einem EIGENEN Punkt (dem Anker der
// Vorreparatur), und daran hing beides, was diese Nacharbeit richtigstellt:
// der Änderungs-Überblick des Prüfers und das Ziel eines späteren Rückrolls.
//
// `wieVorher` stellt die Fassung von vorher nach: Dort blieb der Strang bei
// JEDEM Weg zurück auf 'offen' liegen, also auch bei der Eskalation.
const bauerBez = 'Block 1 „Bauer"'
const prueferBez = 'Block 2 „Prüfer"'
const AUSGANG = 'Ausgangsstand des Projekts, Fassung eins\n'
const REPARIERT = 'Reparatur des Motor-Bauers, geprüft und deutlich anders als zuvor\n'

function bauerKnoten(name = 'Bauer') {
  return { def: { prueft: false, nurLesen: false }, pruefOrdner: '', name, status: 'laeuft' }
}

async function eskalationDurchspielen(name, { wieVorher = false } = {}) {
  const projekt = frischesProjekt(name)
  const zeilen = []
  const tickern = (t) => zeilen.push(t)
  const pruefer = prueferKnoten()
  const bauer = bauerKnoten()
  const prueferOeffnen = () =>
    strangOeffnenAn(projekt, pruefer, {
      instanzId: 'pruefer-b',
      bezeichnung: prueferBez,
      dateiListe: null,
      tickern
    })
  const bauerOeffnen = () =>
    strangOeffnenAn(projekt, bauer, {
      instanzId: 'bauer-1',
      bezeichnung: bauerBez,
      dateiListe: ['src/a.js'],
      tickern
    })

  schreiben(projekt, 'src/a.js', AUSGANG)
  schreiben(projekt, 'pruefung/pruefer-b/lauf.test.js', 'prüft die App\n')
  await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')

  // Anlauf 1 des Prüfers: Er weist zurück, die lokale KI bekommt ihren
  // Ankerpunkt auf SEINEM Strang und verbastelt die beanstandete Datei.
  await prueferOeffnen()
  schreiben(projekt, 'pruefung/pruefer-b/urteil.test.js', 'Beanstandung belegt\n')
  const anker = await sicherungspunktAnlegen(
    projekt,
    texte.sicherungen.beschriftungVorLokalerReparatur,
    { strang: pruefer.strang }
  )
  schreiben(projekt, 'src/a.js', 'GEBASTEL der lokalen KI\n')
  pruefer.status = 'offen'
  pruefer.strangOffenHalten = true
  await strangSchliessenAn(projekt, pruefer, { bezeichnung: prueferBez, tickern })

  // Anlauf 2: die Nachprüfung. Sie scheitert — Rückroll auf den Anker.
  pruefer.status = 'laeuft'
  await prueferOeffnen()
  await zurueckrollenAn(projekt, {
    strang: pruefer.strang,
    geschuetzt: ['pruefung/pruefer-b/'],
    eigenerBereich: ['src/a.js'],
    erfolgsText: texte.ticker.lokaleReparaturZurueckgerollt(2, 2),
    nichtsMelden: true,
    tickern
  })
  // Budget verbraucht: Eskalation zum Motor-Bauer. lauf.js merkt sich dabei die
  // Diff-Basis des Prüfers und setzt ihn auf 'offen' — sein Anlauf IST hier
  // beendet, die Nachprüfung folgt erst nach der Runde des Bauers.
  const diffBasis = await letzterPunktId(projekt, pruefer.strang ?? null)
  pruefer.status = 'offen'
  if (wieVorher) pruefer.strangOffenHalten = true
  await strangSchliessenAn(projekt, pruefer, { bezeichnung: prueferBez, tickern })

  // Der Motor-Bauer repariert wirklich und wird fertig; sein Strang kommt an.
  bauer.status = 'laeuft'
  await bauerOeffnen()
  schreiben(projekt, 'src/a.js', REPARIERT)
  bauer.status = 'fertig'
  await strangSchliessenAn(projekt, bauer, { bezeichnung: bauerBez, tickern })

  // Und der Prüfer geht in die Nachprüfung.
  pruefer.status = 'laeuft'
  await prueferOeffnen()
  const bis = await letzterPunktId(projekt, pruefer.strang ?? null)
  const gemeinsam = await letzterPunktId(projekt)
  return { projekt, zeilen, pruefer, bauer, anker, diffBasis, bis, gemeinsam }
}

describe('BAUPLAN 45 · Nach der Eskalation sieht der Prüfer die Reparatur des Bauers', () => {
  let lage = null
  let alt = null

  beforeAll(async () => {
    lage = await eskalationDurchspielen('eskalation-neu')
    alt = await eskalationDurchspielen('eskalation-alt', { wieVorher: true })
  })

  it('hat wirklich einen wartenden Strang MIT eigenem Punkt gebaut', () => {
    // Ohne diesen Anker misst der ganze Fall nichts: Erst ein Strang, der etwas
    // Eigenes festhält, kann hinter dem gemeinsamen Stand zurückbleiben.
    expect(lage.diffBasis).toBe(lage.anker.id)
    expect(alt.diffBasis).toBe(alt.anker.id)
  })

  it('rechnet den Änderungs-Überblick über zwei verschiedene Enden', async () => {
    expect(lage.bis).not.toBe(lage.diffBasis)
    const vergleich = await punkteVergleichen(lage.projekt, lage.diffBasis, lage.bis)
    expect(vergleich.ok).toBe(true)
    expect(vergleich.dateien.map((d) => d.pfad)).toContain('src/a.js')
  })

  it('lässt die Reparatur des Bauers im Projektordner stehen', () => {
    expect(fs.readFileSync(path.join(lage.projekt, 'src/a.js'), 'utf8')).toBe(REPARIERT)
  })

  // Die Gegenprobe, die den Mechanismus festnagelt: Blieb der Strang auch bei
  // der Eskalation liegen, zeigte er in die Nachprüfung hinein noch auf den
  // Anker — beide Diff-Enden derselbe Punkt, der Überblick fiel lautlos auf
  // leer, und der Prüfer ging blind in die Nachprüfung.
  it('Gegenprobe: mit liegengebliebenem Strang fallen beide Enden zusammen', async () => {
    expect(alt.bis).toBe(alt.diffBasis)
    expect(alt.gemeinsam).not.toBe(alt.bis)
    const vergleich = await punkteVergleichen(alt.projekt, alt.diffBasis, alt.bis)
    expect(vergleich.dateien).toEqual([])
    // Gegen den gemeinsamen Stand wäre sehr wohl etwas zu sehen gewesen.
    const echt = await punkteVergleichen(alt.projekt, alt.diffBasis, alt.gemeinsam)
    expect(echt.dateien.map((d) => d.pfad)).toContain('src/a.js')
  })

  it('gibt jedem beendeten Anlauf genau einen Punkt in Georgs Liste', async () => {
    const beschriftungen = (await sicherungspunkteLaden(lage.projekt)).punkte.map(
      (p) => p.beschriftung
    )
    // Der Prüfer wurde nie fertig — sein beendeter Anlauf heißt „Runde beendet".
    expect(beschriftungen).toContain(texte.sicherungen.beschriftungRundeBeendet('Prüfer'))
    expect(beschriftungen).toContain(texte.sicherungen.beschriftungNachBlock('Bauer'))
    // Und die Runde, nach der der Prüfer GLEICH wieder lief (die Nachprüfung der
    // lokalen Vorreparatur), hat keinen eigenen Eintrag: Sein Anlauf war da
    // nicht zu Ende.
    expect(
      beschriftungen.filter((b) => b === texte.sicherungen.beschriftungRundeBeendet('Prüfer'))
    ).toHaveLength(1)
    expect(fs.existsSync(path.join(lage.projekt, 'pruefung/pruefer-b/urteil.test.js'))).toBe(true)
  })
})

describe('BAUPLAN 45 · Der harte Stopp trifft den abgebrochenen Block, nicht den wartenden', () => {
  it('nimmt den Block, der wirklich mitten im Anlauf abgebrochen ist', () => {
    // Nach dem Abbruch stehen beide auf 'offen' — der Status allein sagt also
    // nicht mehr, wer abbricht. Der wartende Prüfer steht hier zuerst in der
    // Liste; genau daran ging die Auswahl vorher fehl.
    const wartend = { ...prueferKnoten(), status: 'offen', strang: 'strang/pruefer-b' }
    const abgebrochen = { ...bauerKnoten(), status: 'offen', strang: 'strang/bauer-1', hartAbgebrochen: true }
    expect(hartAbgebrochenerBlock([wartend, abgebrochen])).toBe(abgebrochen)
    // Ohne jeden Vermerk (Abbruch, bevor ein Block lief) gilt die alte Rechnung.
    expect(hartAbgebrochenerBlock([wartend, { ...bauerKnoten(), status: 'fertig' }])).toBe(wartend)
  })

  it('rollt auf den Strang des abgebrochenen Blocks zurück und holt die Reparatur zurück', async () => {
    const lage = await eskalationDurchspielen('hart-frischer-strang')
    const zeilen = []
    lage.pruefer.hartAbgebrochen = true
    schreiben(lage.projekt, 'src/a.js', 'halbfertige Arbeit der Nachprüfung\n')
    const zurueck = await hartZurueckrollenAn(lage.projekt, {
      knotenListe: [lage.bauer, lage.pruefer],
      geschuetztFuer: () => ['pruefung/pruefer-b/'],
      tickern: (t) => zeilen.push(t)
    })
    expect(zurueck.ok).toBe(true)
    // Der frisch angesetzte Strang steht auf dem gemeinsamen Stand: Die
    // Reparatur des Bauers kommt zurück, die halbfertige Arbeit fällt — und
    // nichts musste dafür stehenbleiben.
    expect(fs.readFileSync(path.join(lage.projekt, 'src/a.js'), 'utf8')).toBe(REPARIERT)
    expect(zurueck.standUeberholt).toBe(false)
    expect(zeilen).toContain(texte.ticker.zurueckgesetzt)
  })

  it('nimmt den Strang des WARTENDEN Prüfers nicht mehr als Maßstab', () => {
    // Der Kern des Funds: Vorher lieh sich der harte Stopp den erstbesten
    // offenen Strang, wenn der abgebrochene Block keinen hatte.
    const wartend = { ...prueferKnoten(), status: 'offen', strang: 'strang/pruefer-b' }
    const abgebrochen = { ...bauerKnoten(), status: 'offen', strang: null, hartAbgebrochen: true }
    expect(hartAbgebrochenerBlock([wartend, abgebrochen])).toBe(abgebrochen)
    expect(hartAbgebrochenerBlock([wartend, abgebrochen]).strang).toBe(null)
  })

  it('wirft die fertige Arbeit des Bauers NICHT weg, wenn der Strang veraltet ist', async () => {
    // Derselbe Aufbau, aber mit dem liegengebliebenen Strang von vorher: Seine
    // Spitze ist der Anker aus einem früheren Anlauf und kennt die Reparatur des
    // Bauers nicht. Der Rückroll nimmt deshalb nur noch den EIGENEN Wirkbereich
    // zurück — und sagt, was dabei stehenblieb.
    const lage = await eskalationDurchspielen('hart-alter-strang', { wieVorher: true })
    const zeilen = []
    lage.pruefer.hartAbgebrochen = true
    // Der Prüfer hat in seiner Mappe halbfertig weitergeschrieben; sein
    // Wirkbereich ist genau diese Mappe (von strangOeffnenAn gesetzt).
    expect(lage.pruefer.wirkbereich).toEqual(['pruefung/pruefer-b/'])
    schreiben(lage.projekt, 'pruefung/pruefer-b/halbfertig.test.js', 'halbfertig\n')
    const zurueck = await hartZurueckrollenAn(lage.projekt, {
      knotenListe: [lage.bauer, lage.pruefer],
      geschuetztFuer: () => [],
      tickern: (t) => zeilen.push(t)
    })
    // Die Reparatur des Bauers bleibt — sie gehört ihm, nicht dem Prüfer.
    expect(fs.readFileSync(path.join(lage.projekt, 'src/a.js'), 'utf8')).toBe(REPARIERT)
    // Seine eigene halbfertige Arbeit fällt sehr wohl: Genau dafür ist der
    // Wirkbereich da — die Bremse ist keine Total-Sperre.
    expect(fs.existsSync(path.join(lage.projekt, 'pruefung/pruefer-b/halbfertig.test.js'))).toBe(
      false
    )
    expect(zurueck.standUeberholt).toBe(true)
    expect(zurueck.fremdUebersprungen).toBeGreaterThan(0)
    expect(zeilen).toContain(texte.ticker.rollbackStandUeberholt(zurueck.fremdUebersprungen))
    expect(zeilen).toContain(texte.ticker.zurueckgesetzt)
  })
})

// Zwei Schreiber, zwei Stränge: Der Prüfer wartet mit seinem Ankerpunkt auf die
// Nachprüfung — er belegt den Schreiber-Platz nicht —, und ein ZWEITER Bauer
// fährt in der Zwischenzeit eine ganze Runde und führt sie zusammen. Rollt der
// Prüfer danach auf seinen Anker zurück, kennt der die fertige Runde des
// Zweiten nicht: Sie fiel bis zu dieser Nacharbeit lautlos aus dem Ordner.
describe('BAUPLAN 45 · Ein Rückroll wirft keine fremde fertige Arbeit weg', () => {
  const zweitBez = 'Block 3 „Bauer 2"'

  async function zweiSchreiberDurchspielen(name, { ohneGrenze = false } = {}) {
    const projekt = frischesProjekt(name)
    const zeilen = []
    const tickern = (t) => zeilen.push(t)
    const pruefer = prueferKnoten()
    const zweiter = bauerKnoten('Bauer 2')
    // Der Ziel-Block der Vorreparatur: Seine Dateien hat die lokale KI
    // angefasst, seine Arbeit rollt der Prüfer nach der Nachprüfung zurück.
    const ziel = { ...bauerKnoten('Bauer 1'), wirkbereich: ['src/app.js'] }

    schreiben(projekt, 'src/app.js', 'sauberer Stand\n')
    schreiben(projekt, 'src/zweiter-zweig.js', 'noch leer\n')
    schreiben(projekt, 'pruefung/pruefer-b/lauf.test.js', 'prüft die App\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')

    // 1. Der Prüfer legt seinen Ankerpunkt an; die lokale KI verbastelt.
    await strangOeffnenAn(projekt, pruefer, {
      instanzId: 'pruefer-b',
      bezeichnung: prueferBez,
      dateiListe: null,
      tickern
    })
    schreiben(projekt, 'pruefung/pruefer-b/urteil.test.js', 'Beanstandung belegt\n')
    await sicherungspunktAnlegen(projekt, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang: pruefer.strang
    })
    schreiben(projekt, 'src/app.js', 'GEBASTEL der lokalen KI\n')
    pruefer.status = 'offen'
    pruefer.strangOffenHalten = true
    await strangSchliessenAn(projekt, pruefer, { bezeichnung: prueferBez, tickern })

    // 2. Ein zweiter Schreiber bekommt den Platz, wird fertig und führt zusammen.
    await strangOeffnenAn(projekt, zweiter, {
      instanzId: 'bauer-2',
      bezeichnung: zweitBez,
      dateiListe: ['src/zweiter-zweig.js'],
      tickern
    })
    schreiben(projekt, 'src/zweiter-zweig.js', 'ECHTE ARBEIT DES ZWEITEN BAUERS\n')
    zweiter.status = 'fertig'
    await strangSchliessenAn(projekt, zweiter, { bezeichnung: zweitBez, tickern })

    // 3. Die Nachprüfung des Prüfers läuft an — sein Strang hält den Anker …
    pruefer.status = 'laeuft'
    await strangOeffnenAn(projekt, pruefer, {
      instanzId: 'pruefer-b',
      bezeichnung: prueferBez,
      dateiListe: null,
      tickern
    })
    // 4. … und scheitert: Rückroll wie in lauf.js nach der Vorreparatur — auf
    //    den Wirkbereich des ZIEL-Blocks als Notbremse.
    const zurueck = await zurueckrollenAn(projekt, {
      strang: pruefer.strang,
      geschuetzt: ['pruefung/pruefer-b/'],
      eigenerBereich: ohneGrenze ? null : ziel.wirkbereich,
      erfolgsText: texte.ticker.lokaleReparaturZurueckgerollt(1, 2),
      nichtsMelden: true,
      tickern
    })
    return { projekt, zurueck, zeilen, pruefer, zweiter, ziel }
  }

  let lage = null
  beforeAll(async () => {
    lage = await zweiSchreiberDurchspielen('zwei-schreiber')
  })

  it('lässt die fertige Runde des zweiten Bauers im Ordner stehen', () => {
    expect(fs.readFileSync(path.join(lage.projekt, 'src/zweiter-zweig.js'), 'utf8')).toBe(
      'ECHTE ARBEIT DES ZWEITEN BAUERS\n'
    )
  })

  it('nimmt das Gebastel im Wirkbereich des Ziel-Blocks trotzdem zurück', () => {
    expect(lage.zurueck.ok).toBe(true)
    expect(lage.zurueck.zurueckgesetzt).toBe(true)
    expect(fs.readFileSync(path.join(lage.projekt, 'src/app.js'), 'utf8')).toBe('sauberer Stand\n')
    expect(lage.zeilen).toContain(texte.ticker.lokaleReparaturZurueckgerollt(1, 2))
  })

  it('sagt Georg, was dabei stehenbleiben musste — und warum', () => {
    expect(lage.zurueck.standUeberholt).toBe(true)
    expect(lage.zurueck.fremdUebersprungen).toBeGreaterThan(0)
    expect(lage.zeilen).toContain(
      texte.ticker.rollbackStandUeberholt(lage.zurueck.fremdUebersprungen)
    )
    // Der Punkt des zweiten Bauers steht in Georgs Liste — und diesmal steht
    // sein Ordnerinhalt auch noch da. Genau daran war der Verlust vorher nicht
    // zu erkennen.
    expect(lage.zeilen).not.toContain(texte.ticker.rollbackNichtsZurueckgenommen)
    expect(lage.zeilen).not.toContain(texte.ticker.rollbackNichtsAngefasst)
  })

  it('nimmt ohne benannten Wirkbereich lieber GAR nichts zurück, statt fremdes mitzureißen', async () => {
    const ohne = await zweiSchreiberDurchspielen('zwei-schreiber-ohne', { ohneGrenze: true })
    expect(fs.readFileSync(path.join(ohne.projekt, 'src/zweiter-zweig.js'), 'utf8')).toBe(
      'ECHTE ARBEIT DES ZWEITEN BAUERS\n'
    )
    // Der Preis steht ehrlich im Ordner und im Ticker: Das Gebastel bleibt.
    expect(fs.readFileSync(path.join(ohne.projekt, 'src/app.js'), 'utf8')).toBe(
      'GEBASTEL der lokalen KI\n'
    )
    expect(ohne.zurueck.zurueckgesetzt).toBe(false)
    // Und der Ticker sagt genau DAS: nichts angefasst, der verworfene Stand
    // liegt weiter im Ordner. „Stand schon genau auf dem Sicherungspunkt" wäre
    // hier gemessen falsch — die Zeile darunter zählt ja auf, was blieb.
    expect(ohne.zeilen).toContain(texte.ticker.rollbackNichtsAngefasst)
    expect(ohne.zeilen).not.toContain(texte.ticker.rollbackNichtsZurueckgenommen)
    expect(ohne.zeilen).toContain(
      texte.ticker.rollbackStandUeberholt(ohne.zurueck.fremdUebersprungen)
    )
    const beschriftungen = (await sicherungspunkteLaden(ohne.projekt)).punkte.map(
      (p) => p.beschriftung
    )
    expect(beschriftungen).toContain(texte.sicherungen.beschriftungNachBlock('Bauer 2'))
  })
})

// Die Kante am wartenden Strang (Nacharbeit): Hat der Prüfer in seinem Anlauf
// nichts geschrieben, entsteht sein Ankerpunkt gar nicht neu — der Strang zeigt
// auf den gemeinsamen Stand von damals. Führt danach ein anderer Block zusammen,
// sieht er aus wie ein liegengebliebener Zeiger („eingeholt"), und genau daran
// wurde er vorher mit Gewalt neu angesetzt: auf die Spitze MIT dem Gebastel.
//
// Rot vor Grün, so gemessen: Gegen den Stand vor dieser Nacharbeit stand
// src/app.js danach auf 'GEBASTEL\n', die Spitze des Strangs auf dem gemeinsamen
// Stand, und zurueckgesetzt war false.
describe('BAUPLAN 45 · Der wartende Strang behält seinen Anker auch ohne eigenen Punkt', () => {
  const zweitBezeichnung = 'Block 3 „Bauer 2"'

  let lage = null
  beforeAll(async () => {
    const projekt = frischesProjekt('wartend-ohne-eigenen-punkt')
    const zeilen = []
    const tickern = (t) => zeilen.push(t)
    const pruefer = prueferKnoten()
    const zweiter = bauerKnoten('Bauer 2')
    // Der Ziel-Block der Vorreparatur: Seine Datei hat die lokale KI verbastelt.
    const ziel = { ...bauerKnoten('Bauer 1'), wirkbereich: ['src/app.js'] }

    schreiben(projekt, 'src/app.js', 'sauberer Stand\n')
    schreiben(projekt, 'src/zweiter-zweig.js', 'noch leer\n')
    schreiben(projekt, 'pruefung/pruefer-b/lauf.test.js', 'prüft die App\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')

    // 1. Der Prüfer öffnet seinen Strang — und schreibt in diesem Anlauf NICHTS.
    const prueferOeffnen = () =>
      strangOeffnenAn(projekt, pruefer, {
        instanzId: 'pruefer-b',
        bezeichnung: prueferBez,
        dateiListe: null,
        tickern
      })
    await prueferOeffnen()
    const anker = await sicherungspunktAnlegen(
      projekt,
      texte.sicherungen.beschriftungVorLokalerReparatur,
      { strang: pruefer.strang }
    )
    // 2. Die lokale KI verbastelt die Datei des Ziel-Blocks; der Prüfer geht in
    //    die Nachprüfung und hält seinen Strang offen.
    schreiben(projekt, 'src/app.js', 'GEBASTEL\n')
    pruefer.status = 'offen'
    pruefer.strangOffenHalten = true
    await strangSchliessenAn(projekt, pruefer, { bezeichnung: prueferBez, tickern })

    // 3. Dazwischen fährt ein zweiter Bauer eine ganze Runde und führt zusammen.
    await strangOeffnenAn(projekt, zweiter, {
      instanzId: 'bauer-2',
      bezeichnung: zweitBezeichnung,
      dateiListe: ['src/zweiter-zweig.js'],
      tickern
    })
    schreiben(projekt, 'src/zweiter-zweig.js', 'ECHTE ARBEIT DES ZWEITEN BAUERS\n')
    zweiter.status = 'fertig'
    await strangSchliessenAn(projekt, zweiter, { bezeichnung: zweitBezeichnung, tickern })
    const eingeholt = await strangEingeholt(projekt, pruefer.strang)

    // 4. Die Nachprüfung läuft an …
    pruefer.status = 'laeuft'
    await prueferOeffnen()
    const spitze = await letzterPunktId(projekt, pruefer.strang)
    const gemeinsam = await letzterPunktId(projekt)

    // 5. … und scheitert: Rückroll wie in lauf.js nach der Vorreparatur.
    const zurueck = await zurueckrollenAn(projekt, {
      strang: pruefer.strang,
      geschuetzt: ['pruefung/pruefer-b/'],
      eigenerBereich: ziel.wirkbereich,
      erfolgsText: texte.ticker.lokaleReparaturZurueckgerollt(1, 2),
      nichtsMelden: true,
      tickern
    })
    lage = { projekt, zeilen, anker, eingeholt, spitze, gemeinsam, zurueck }
  })

  it('hat wirklich die Kante gebaut: kein eigener Punkt, Strang gilt als eingeholt', () => {
    // Ohne diese beiden Messungen misst der Fall nichts — er wäre der schon
    // grüne Nachbarfall mit eigenem Ankerpunkt.
    expect(lage.anker.neu).toBe(false)
    expect(lage.eingeholt).toBe(true)
  })

  it('setzt den wartenden Strang NICHT neu an', () => {
    expect(lage.spitze).toBe(lage.anker.id)
    expect(lage.spitze).not.toBe(lage.gemeinsam)
  })

  it('holt den sauberen Stand zurück — gemessen an der Datei', () => {
    expect(fs.readFileSync(path.join(lage.projekt, 'src/app.js'), 'utf8')).toBe('sauberer Stand\n')
    expect(lage.zurueck.zurueckgesetzt).toBe(true)
  })

  it('lässt die fertige Runde des zweiten Bauers stehen und sagt es', () => {
    expect(fs.readFileSync(path.join(lage.projekt, 'src/zweiter-zweig.js'), 'utf8')).toBe(
      'ECHTE ARBEIT DES ZWEITEN BAUERS\n'
    )
    expect(lage.zurueck.standUeberholt).toBe(true)
    expect(lage.zurueck.fremdUebersprungen).toBeGreaterThan(0)
    expect(lage.zeilen).toContain(texte.ticker.lokaleReparaturZurueckgerollt(1, 2))
    expect(lage.zeilen).toContain(
      texte.ticker.rollbackStandUeberholt(lage.zurueck.fremdUebersprungen)
    )
  })
})

describe('BAUPLAN 45 · Das Sicherheitsnetz am Laufende schließt jeden Strang', () => {
  const prueferBezeichnung = 'Block 2 „Prüfer"'

  it('lässt einen Strang stehen, der noch eigene Arbeit festhält', async () => {
    // Die Gegenprobe zur Rechenstelle: Ein Strang mit einem eigenen, noch nicht
    // zusammengeführten Punkt gilt nicht als eingeholt — sonst schnitte das
    // Neu-Ansetzen genau den Rückroll-Punkt ab.
    const eigen = frischesProjekt('eingeholt-rechnung')
    schreiben(eigen, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(eigen, 'Stand vor dem Lauf')
    await strangOeffnen(eigen, 'strang/bauer-9')
    expect(await strangEingeholt(eigen, 'strang/bauer-9')).toBe(true)
    schreiben(eigen, 'src/app.js', 'eigene Arbeit\n')
    await sicherungspunktAnlegen(eigen, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang: 'strang/bauer-9'
    })
    expect(await strangEingeholt(eigen, 'strang/bauer-9')).toBe(false)
    // Und nach dem Zusammenführen gibt es ihn gar nicht mehr.
    await strangZusammenfuehren(
      eigen,
      'strang/bauer-9',
      texte.sicherungen.beschriftungNachBlock('Bauer')
    )
    expect(await strangEingeholt(eigen, 'strang/bauer-9')).toBe(true)
  })

  it('schließt am Laufende auch den Strang eines Blocks, der auf seine Nachprüfung wartet', async () => {
    const eigen = frischesProjekt('laufende-netz')
    const zeilen = []
    const tickern = (t) => zeilen.push(t)
    const k = prueferKnoten()
    schreiben(eigen, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(eigen, 'Stand vor dem Lauf')
    await strangOeffnenAn(eigen, k, {
      instanzId: 'pruefer-b',
      bezeichnung: prueferBezeichnung,
      dateiListe: null,
      tickern
    })
    schreiben(eigen, 'pruefung/pruefer-b/urteil.test.js', 'Beanstandung belegt\n')
    await sicherungspunktAnlegen(eigen, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang: k.strang
    })
    k.status = 'offen'
    k.strangOffenHalten = true
    // Zwischen den Blöcken bleibt er stehen …
    await strangSchliessenAn(eigen, k, { bezeichnung: prueferBezeichnung, tickern })
    expect(k.strang).toBe('strang/pruefer-b')
    // … am Laufende nicht mehr.
    await strangSchliessenAn(eigen, k, {
      bezeichnung: prueferBezeichnung,
      tickern,
      endgueltig: true
    })
    expect(k.strang).toBe(null)
    expect(await letzterPunktId(eigen, 'strang/pruefer-b')).toBe(null)
    const liste = await sicherungspunkteLaden(eigen)
    expect(liste.punkte.map((p) => p.beschriftung)).toContain(
      texte.sicherungen.beschriftungRundeBeendet('Prüfer')
    )
  })

  it('führt einen Block ohne dieses Kennzeichen ganz normal am Blockende zusammen', async () => {
    // Der Kern der Nacharbeit: 'offen' allein hält den Strang NICHT mehr offen.
    // Jeder andere Weg zurück auf 'offen' (Reparatur-Runde, Nachforderung)
    // beendet den Anlauf und führt zusammen.
    const eigen = frischesProjekt('offen-ohne-kennzeichen')
    const zeilen = []
    const tickern = (t) => zeilen.push(t)
    const k = prueferKnoten()
    schreiben(eigen, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(eigen, 'Stand vor dem Lauf')
    await strangOeffnenAn(eigen, k, {
      instanzId: 'pruefer-b',
      bezeichnung: prueferBezeichnung,
      dateiListe: null,
      tickern
    })
    schreiben(eigen, 'pruefung/pruefer-b/urteil.test.js', 'Beanstandung belegt\n')
    await sicherungspunktAnlegen(eigen, texte.sicherungen.beschriftungVorLokalerReparatur, {
      strang: k.strang
    })
    k.status = 'offen'
    await strangSchliessenAn(eigen, k, { bezeichnung: prueferBezeichnung, tickern })
    expect(k.strang).toBe(null)
  })

  it('vergisst das Kennzeichen beim nächsten Anlauf wieder', async () => {
    const eigen = frischesProjekt('kennzeichen-verfaellt')
    const k = prueferKnoten()
    k.strangOffenHalten = true
    schreiben(eigen, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(eigen, 'Stand vor dem Lauf')
    await strangOeffnenAn(eigen, k, {
      instanzId: 'pruefer-b',
      bezeichnung: prueferBezeichnung,
      dateiListe: null,
      tickern: () => {}
    })
    expect(k.strangOffenHalten).toBe(false)
  })

  it('verdrahtet den Ablaufplaner genau so — Schleife hält, Laufende schließt', () => {
    const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')
    // Die Blockende-Naht in der Planer-Schleife kennt kein `endgueltig` …
    expect(lauf).toMatch(/if \(!lauf\.hart\) await strangSchliessenFuer\(knoten\.get\(id\)\)/)
    // … das Sicherheitsnetz am Laufende schon.
    expect(lauf).toMatch(
      /for \(const kid of kettenIds\) await strangEndgueltigSchliessenFuer\(knoten\.get\(kid\)\)/
    )
    expect(lauf).toMatch(/endgueltig: true/)
    // Und das Kennzeichen wird an genau einer Stelle gesetzt: der Nachprüfung
    // einer lokalen Vorreparatur.
    expect([...lauf.matchAll(/k\.strangOffenHalten = true/g)]).toHaveLength(1)
  })
})

describe('BAUPLAN 45 · Auch der harte Stopp lässt fremdes Revier stehen', () => {
  // Der Fund der Nacharbeit: Hatte kein Block einen Strang offen — ein Umsetzer
  // ohne Arbeitspaket, ein nur-lesender Block, der per Befehl geschrieben hat —,
  // rollte der harte Stopp wieder projektweit zurück, und die Prüfmappe des
  // fremden Prüfers fiel mit.
  const lauf = fs.readFileSync('src/main/lauf.js', 'utf8')

  it('kennt im ganzen Lauf keinen Rückroll ohne geschützte Bereiche mehr', () => {
    const stellen = [...lauf.matchAll(/aufLetztenPunktZuruecksetzen\([^)]*/g)].map(([t]) => t)
    // Genau zwei: die eine Naht im Lauf und die Wiederaufnahme davor.
    expect(stellen).toHaveLength(2)
    for (const stelle of stellen) expect(stelle).toContain('geschuetzt')
    expect(lauf).not.toMatch(/aufLetztenPunktZuruecksetzen\(projektPfad\)/)
  })

  it('führt den harten Stopp über die ausgeführte Naht statt über eigene Rechnerei', () => {
    expect(lauf).toMatch(/await hartZurueckrollenAn\(projektPfad, \{/)
    // Kein zweiter Weg daneben: Der Planer leiht sich keinen fremden Strang mehr.
    expect(lauf).not.toMatch(/find\(\(kk\) => kk\.strang\)/)
  })

  it('rollt beim harten Stopp auch ohne Strang zurück und lässt fremdes Revier stehen', async () => {
    // Ein Umsetzer ohne Arbeitspaket (kein Strang) bricht ab, während ein
    // fremder Prüfer frische Tests in seiner Mappe liegen hat.
    const projekt = frischesProjekt('hart-ohne-strang')
    schreiben(projekt, 'src/app.js', 'sauberer Stand\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    schreiben(projekt, 'src/app.js', 'halbfertig\n')
    schreiben(projekt, 'pruefung/pruefer-b/frisch.test.js', 'frisch geschrieben\n')
    const zeilen = []
    const abgebrochen = {
      def: { prueft: false, nurLesen: false },
      pruefOrdner: '',
      name: 'Bauer',
      status: 'offen',
      strang: null,
      hartAbgebrochen: true
    }
    const zurueck = await hartZurueckrollenAn(projekt, {
      knotenListe: [abgebrochen],
      geschuetztFuer: () => ['pruefung/pruefer-b/'],
      tickern: (t) => zeilen.push(t)
    })
    expect(zurueck.ok).toBe(true)
    expect(fs.readFileSync(path.join(projekt, 'src/app.js'), 'utf8')).toBe('sauberer Stand\n')
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-b/frisch.test.js'))).toBe(true)
    expect(zeilen).toContain(texte.ticker.zurueckgesetzt)
    expect(zeilen).toContain(texte.ticker.rollbackGeschuetzt(1))
  })

  it('rechnet die geschützten Bereiche auch ohne bekannten Block', () => {
    // Fällt der abgebrochene Block gar nicht mehr zuzuordnen aus, gilt jede
    // Instanz als fremd — lieber eine Prüfmappe zu viel stehen lassen.
    const pruefer = { instanzId: 'p1', def: { prueft: true }, pruefOrdner: 'pruefer-1' }
    expect(geschuetzteBereicheVon(null, [pruefer])).toEqual(['pruefung/pruefer-1/'])
    expect(geschuetzteBereicheVon('p1', [pruefer])).toEqual([])
  })
})

describe('BAUPLAN 45 · Liegengebliebene Sicherungsstränge beim Laufstart', () => {
  it('sagt, dass die Arbeit eines abgebrochenen Laufs eingeholt wurde — und sie steht dann auch in Georgs Liste', async () => {
    // Der Fund der Nacharbeit: Ein „behaltener" Strang wurde Sekunden später
    // stillschweigend abgeschnitten — derselbe Block öffnet seinen Strang unter
    // demselben Namen neu. Eingeholt steht sein Punkt dagegen in der Liste.
    const projekt = frischesProjekt('start-rettung')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, 'strang/bauer-1')
    schreiben(projekt, 'src/app.js', 'Arbeit des abgestürzten Laufs\n')
    const blockende = await sicherungspunktAnlegen(projekt, 'Stand nach Runde „Bauer"', {
      strang: 'strang/bauer-1'
    })
    // Vor dem Einholen taucht der Punkt in Georgs Liste nicht auf.
    const vorher = await sicherungspunkteLaden(projekt)
    expect(vorher.punkte.map((p) => p.id)).not.toContain(blockende.id)

    const zeilen = []
    await straengeMeldenBeimStart(projekt, (t) => zeilen.push(t))
    const nachher = await sicherungspunkteLaden(projekt)
    expect(nachher.punkte.map((p) => p.beschriftung)).toContain('Stand nach Runde „Bauer"')
    expect(zeilen).toEqual([texte.ticker.straengeGerettet(1)])
    // Und danach ist der Strang los: Ein neuer Anlauf kann ihn gefahrlos öffnen.
    expect(await letzterPunktId(projekt, 'strang/bauer-1')).toBe(null)
  })

  it('räumt einen längst eingeholten Strang weg und sagt es', async () => {
    const projekt = frischesProjekt('start-aufraeumen')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    // Ein Strang ohne eigenen Punkt: Er zeigt auf den gemeinsamen Stand, ist
    // also längst enthalten.
    await strangOeffnen(projekt, 'strang/bauer-2')
    const zeilen = []
    const ergebnis = await straengeMeldenBeimStart(projekt, (t) => zeilen.push(t))
    expect(ergebnis.entfernt).toBe(1)
    expect(zeilen).toEqual([texte.ticker.straengeAufgeraeumt(1)])
  })

  it('verschweigt ein gescheitertes Aufräumen nicht', async () => {
    // Bis zur Nacharbeit die einzige stille Fehlerlage des ganzen Bauschritts:
    // Klemmte das Aufräumen, kam keine einzige Ticker-Zeile — Georg erfuhr
    // nichts, und die alten Stränge blieben liegen.
    const projekt = frischesProjekt('start-klemmt')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    const zeilen = []
    const spion = vi.spyOn(git, 'listBranches').mockRejectedValue(new Error('klemmt'))
    try {
      const ergebnis = await straengeMeldenBeimStart(projekt, (t) => zeilen.push(t))
      expect(ergebnis.ok).toBe(false)
    } finally {
      spion.mockRestore()
    }
    expect(zeilen).toEqual([texte.ticker.straengeNichtAufgeraeumt])
  })

  it('sagt beim wirklich stehengebliebenen Strang nichts von der Liste', async () => {
    // Nur wenn auch das Einholen klemmt, bleibt ein Strang stehen. Dann darf
    // die Zeile keine Erhaltung versprechen, die Georg nichts nützt.
    const projekt = frischesProjekt('start-behalten')
    schreiben(projekt, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, 'strang/bauer-3')
    schreiben(projekt, 'src/app.js', 'Arbeit des abgestürzten Laufs\n')
    await sicherungspunktAnlegen(projekt, 'Stand nach Runde „Bauer"', { strang: 'strang/bauer-3' })
    // Der Ordner steht nicht mehr genau auf dem Strang-Punkt — das Einholen
    // muss deshalb wirklich einen Punkt anlegen, und genau das klemmt gleich.
    schreiben(projekt, 'src/neu.js', 'nach dem Punkt\n')
    const zeilen = []
    const spion = vi.spyOn(git, 'commit').mockRejectedValue(new Error('klemmt'))
    try {
      const ergebnis = await straengeMeldenBeimStart(projekt, (t) => zeilen.push(t))
      expect(ergebnis.behalten).toBe(1)
    } finally {
      spion.mockRestore()
    }
    expect(zeilen).toEqual([texte.ticker.straengeBehalten(1)])
    expect(texte.ticker.straengeBehalten(1)).toMatch(/nicht in der Liste/)
    // Der Strang liegt wirklich noch da — die Zeile behauptet nichts Falsches.
    expect(await letzterPunktId(projekt, 'strang/bauer-3')).not.toBe(null)
  })
})

describe('BAUPLAN 45 · Die neuen Zeilen sind für Georg geschrieben, nicht für Programmierer', () => {
  const zeilen = [
    texte.ticker.strangGeoeffnet('Block 2 „Bauer"'),
    texte.ticker.strangOhneWirkbereich('Block 2 „Bauer"'),
    texte.ticker.strangNichtGeoeffnet('Block 2 „Bauer"'),
    texte.ticker.strangZusammengefuehrt('Block 2 „Bauer"'),
    texte.ticker.strangNichtZusammengefuehrt('Block 2 „Bauer"'),
    texte.ticker.straengeAufgeraeumt(1),
    texte.ticker.straengeAufgeraeumt(3),
    texte.ticker.straengeBehalten(1),
    texte.ticker.straengeBehalten(2),
    texte.ticker.straengeGerettet(1),
    texte.ticker.straengeGerettet(2),
    texte.ticker.straengeNichtAufgeraeumt,
    texte.ticker.rollbackGeschuetzt(1),
    texte.ticker.rollbackGescheitert,
    texte.ticker.rollbackNichtsZurueckgenommen,
    texte.ticker.rollbackNichtsAngefasst,
    texte.ticker.rollbackPunktVerschoben,
    texte.ticker.rollbackStandUeberholt(1),
    texte.ticker.teilstueckBeimBlockwechsel('Block 2 „Bauer"', '2 von 5'),
    texte.ticker.diffAusserhalb(2)
  ]

  it('kommt ohne Technik-Wörter aus', () => {
    for (const zeile of zeilen) expect(zeile).not.toMatch(/\b(Git|Branch|Commit|Merge|Repo|ref)\b/i)
  })

  it('sagt beim Block ohne eigenen Strang ehrlich, dass die Trennung NICHT gilt', () => {
    expect(texte.ticker.strangOhneWirkbereich('Block 2 „Bauer"')).toMatch(/KEINEN/)
    expect(texte.ticker.strangOhneWirkbereich('Block 2 „Bauer"')).toMatch(/ganzen Projektordner/)
  })
})
