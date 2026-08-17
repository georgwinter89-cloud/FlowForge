// Prüfungen zur Welle (BAUPLAN 46): mehrere Schreiber gleichzeitig, wenn ihre
// Dateilisten getrennt sind — die Startregel, die geschützten Bereiche im
// Nachlauf, der harte Stopp mit mehreren Schreibern und die Folgen-Frage je
// Zweig. Gemessen wird VERHALTEN: Die Regeln laufen als reine Rechnungen, und
// der Ablaufplaner fährt echte Läufe mit einem Motor-Ersatz, der die Blöcke
// auf Kommando fertig werden lässt — Ticker, Sicherungspunkte, Laufstand und
// die Folgen-Frage sind echt.
//
// Rot vor Grün: Vor dem Bauschritt stand in bereiteStarten genau eine Zeile —
// „gibt es schon einen Schreiber, dann warte" —, die Prüfung „drei Bauer laufen
// gleichzeitig" wäre also mit zwei Wartenden rot gewesen; die Folgen-Frage hielt
// den ganzen Planer per await an, ein zweiter Prüfer daneben wäre nie fertig
// geworden, solange die Frage offen war.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

// Nur die beiden Enden sind Attrappe, die eine Prüfung nicht haben kann: der
// Motor (er meldet hier, was der Fall verlangt, und wird auf Kommando fertig)
// und der Rauchtest (er startet keine App, sagt aber, wann er gefragt wurde).
// Prozess-Späher, Startanleitungs-Prüfung und Karten kommen ohne Fenster nicht
// zurecht und werden stillgelegt.
const steuerung = vi.hoisted(() => ({
  bauen: null,
  rauchtests: [],
  rauchtestErgebnis: { geprueft: true, gruen: true }
}))
vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async (projektPfad, { gruppe }) => {
    steuerung.rauchtests.push({ zeit: Date.now(), gruppe })
    return steuerung.rauchtestErgebnis
  }
}))
vi.mock('../src/main/prozesse.js', async (importOriginal) => ({
  ...(await importOriginal()),
  prozessgruppeAnlegen: () => {},
  prozessgruppeAbraeumen: async () => ({ beendet: [], uebrig: [] })
}))
vi.mock('../src/main/startanleitung.js', async (importOriginal) => ({
  ...(await importOriginal()),
  startanleitungVorhanden: () => true
}))
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: [] })
}))

import {
  wellenStartRegel,
  schreiberBelegt,
  inWelleVon,
  welleStehtVon,
  geschuetzteBereicheVon,
  endzustandAus,
  hartAbgebrocheneBloecke,
  hartZurueckrollenAn,
  laufStarten,
  laufZustand,
  laufEntscheidungAntworten
} from '../src/main/lauf.js'
import {
  sicherungspunktAnlegen,
  strangOeffnen,
  sicherungspunkteLaden
} from '../src/main/sicherungspunkte.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { pruefbefehlSetzen } from '../src/main/pruefbefehl.js'
import { texte } from '../src/shared/texte.js'

const umsetzer = { nurLesen: false, prueft: false }
const pruefer = { nurLesen: false, prueft: true }
const leser = { nurLesen: true, prueft: false }
const knoten = (instanzId, def, dateiListe = null, weiteres = {}) => ({
  instanzId,
  name: instanzId,
  def,
  status: 'laeuft',
  dateiListe,
  ...weiteres
})

describe('BAUPLAN 46 · Die Startregel der Welle', () => {
  it('lässt einen nur-lesenden Block immer starten', () => {
    expect(wellenStartRegel(knoten('leser', leser), [knoten('bauer', umsetzer)]).darf).toBe(true)
    expect(wellenStartRegel(knoten('leser', leser), [knoten('pruefer', pruefer)]).darf).toBe(true)
  })

  it('lässt den ersten Schreiber starten, wenn nur Leser laufen', () => {
    expect(wellenStartRegel(knoten('bauer', umsetzer), [knoten('leser', leser)]).darf).toBe(true)
    // Auch ohne Datenvertrag: Allein schreibt er wie vor Bauschritt 46.
    expect(wellenStartRegel(knoten('bauer', umsetzer, null), []).darf).toBe(true)
  })

  it('lässt zwei Umsetzer mit getrennten Dateilisten nebeneinander', () => {
    const laufend = [knoten('a', umsetzer, ['src/a/', 'src/gemeinsam/a.js'])]
    expect(wellenStartRegel(knoten('b', umsetzer, ['src/b/']), laufend)).toEqual({ darf: true })
  })

  it('hält einen Umsetzer zurück, dessen Liste sich mit einer laufenden überschneidet — und nennt die Paare', () => {
    const laufend = [
      knoten('a', umsetzer, ['src/a/']),
      knoten('c', umsetzer, ['src/c/'])
    ]
    const urteil = wellenStartRegel(knoten('d', umsetzer, ['src/a/x.js', 'src/d/']), laufend)
    expect(urteil.darf).toBe(false)
    expect(urteil.grund).toBe('ueberschneidung')
    expect(urteil.worauf).toEqual(['a'])
    expect(urteil.paare).toEqual([{ a: 'src/a/x.js', b: 'src/a/' }])
  })

  it('hält einen Umsetzer ohne Datenvertrag zurück, sobald ein anderer schreibt', () => {
    const urteil = wellenStartRegel(knoten('b', umsetzer, null), [knoten('a', umsetzer, ['src/a/'])])
    expect(urteil).toMatchObject({ darf: false, grund: 'ohneVertrag', worauf: ['a'], selbstOhne: true })
  })

  it('hält einen Umsetzer zurück, wenn der LAUFENDE keinen Datenvertrag hat', () => {
    const urteil = wellenStartRegel(knoten('b', umsetzer, ['src/b/']), [knoten('a', umsetzer, null)])
    expect(urteil).toMatchObject({ darf: false, grund: 'ohneVertrag', worauf: ['a'], selbstOhne: false })
  })

  it('lässt Prüfer neben Prüfern — jeder hat seine eigene Prüfmappe', () => {
    expect(wellenStartRegel(knoten('p2', pruefer), [knoten('p1', pruefer)])).toEqual({ darf: true })
  })

  it('lässt Umsetzer und Prüfer NIE gleichzeitig laufen — in beide Richtungen', () => {
    expect(wellenStartRegel(knoten('p', pruefer), [knoten('a', umsetzer, ['src/a/'])])).toEqual({
      darf: false,
      grund: 'prueferWartet',
      worauf: ['a']
    })
    expect(wellenStartRegel(knoten('a', umsetzer, ['src/a/']), [knoten('p', pruefer)])).toEqual({
      darf: false,
      grund: 'umsetzerWartet',
      worauf: ['p']
    })
  })

  it('zählt sich selbst nicht als laufenden Nachbarn', () => {
    const a = knoten('a', umsetzer, ['src/a/'])
    expect(wellenStartRegel(a, [a]).darf).toBe(true)
  })

  // Nacharbeit (Prüfer-Befund): Solange für einen Prüfer die Folgen-Frage
  // offen ist, könnte „Stand wiederherstellen" die Wirkbereiche seines Zweigs
  // zurücksetzen — ein Umsetzer, der dort hineinschriebe, verlöre seinen
  // Halbstand still. Der Zweig zählt deshalb als belegt.
  it('hält einen Umsetzer zurück, dessen Liste einen Zweig mit offener Folgen-Frage trifft', () => {
    const offen = [{ name: 'Prüfer · A', pfade: ['src/a/', 'pruefung/pruefer-pa/'] }]
    expect(wellenStartRegel(knoten('b', umsetzer, ['src/a/x.js']), [], offen)).toEqual({
      darf: false,
      grund: 'frageOffen',
      worauf: ['Prüfer · A']
    })
    // Ohne Datenvertrag könnte er überall schreiben — er wartet ebenfalls.
    expect(wellenStartRegel(knoten('b', umsetzer, null), [], offen).grund).toBe('frageOffen')
    // Getrennt davon darf er; ein Prüfer und ein Leser sind ohnehin frei.
    expect(wellenStartRegel(knoten('b', umsetzer, ['src/b/']), [], offen)).toEqual({ darf: true })
    expect(wellenStartRegel(knoten('p', pruefer), [], offen)).toEqual({ darf: true })
    expect(wellenStartRegel(knoten('l', leser), [], offen)).toEqual({ darf: true })
  })
})

describe('BAUPLAN 46 · Wer belegt Revier, wer ist in der Welle, wann steht sie', () => {
  it('zählt Laufen, Nachlauf und die schreibende Vorreparatur als belegt — nur bei Schreibern', () => {
    expect(schreiberBelegt(knoten('a', umsetzer, null, { status: 'laeuft' }))).toBe(true)
    expect(schreiberBelegt(knoten('a', umsetzer, null, { status: 'nachlauf' }))).toBe(true)
    expect(schreiberBelegt(knoten('a', umsetzer, null, { status: 'fertig', schreibtGerade: true }))).toBe(true)
    expect(schreiberBelegt(knoten('a', umsetzer, null, { status: 'fertig' }))).toBe(false)
    expect(schreiberBelegt(knoten('a', umsetzer, null, { status: 'offen' }))).toBe(false)
    expect(schreiberBelegt(knoten('l', leser, null, { status: 'laeuft' }))).toBe(false)
  })

  it('schützt die Dateiliste eines Umsetzers auch im Nachlauf und während die Vorreparatur für ihn schreibt', () => {
    // Genau die Lücke aus der Angriffsliste: Ein Block, der fertig gebaut hat,
    // dessen Arbeit aber noch nicht gemeinsamer Stand ist, hinterlässt Revier —
    // ein Rückroll des Nachbarn nähme sie sonst mit.
    const liste = [
      knoten('a', umsetzer, ['src/a/'], { status: 'nachlauf', pruefOrdner: '' }),
      knoten('b', umsetzer, ['src/b/'], { status: 'fertig', schreibtGerade: true, pruefOrdner: '' }),
      knoten('c', umsetzer, ['src/c/'], { status: 'fertig', pruefOrdner: '' }),
      knoten('d', umsetzer, ['src/d/'], { status: 'offen', pruefOrdner: '' })
    ]
    const bereiche = geschuetzteBereicheVon(
      'x',
      liste.map((k) => ({ ...k, laeuft: schreiberBelegt(k) }))
    )
    expect(bereiche).toEqual(['src/a/', 'src/b/'])
  })

  it('ist in der Welle, solange ein ANDERER Schreiber läuft oder die Vorreparatur schreibt', () => {
    const a = knoten('a', umsetzer, null, { status: 'laeuft' })
    expect(inWelleVon('a', [a, knoten('b', umsetzer, null, { status: 'laeuft' })])).toBe(true)
    expect(inWelleVon('a', [a, knoten('b', umsetzer, null, { status: 'fertig', schreibtGerade: true })])).toBe(true)
    // Nachlauf schreibt nicht mehr, ein Leser auch nicht — keine Welle.
    expect(inWelleVon('a', [a, knoten('b', umsetzer, null, { status: 'nachlauf' })])).toBe(false)
    expect(inWelleVon('a', [a, knoten('l', leser, null, { status: 'laeuft' })])).toBe(false)
    expect(inWelleVon('a', [a])).toBe(false)
  })

  it('die Welle steht, wenn kein Umsetzer mehr läuft — Prüfer und Leser zählen nicht', () => {
    expect(welleStehtVon('a', [knoten('b', umsetzer, null, { status: 'laeuft' })])).toBe(false)
    expect(welleStehtVon('a', [knoten('b', umsetzer, null, { status: 'fertig', schreibtGerade: true })])).toBe(false)
    expect(welleStehtVon('a', [knoten('b', umsetzer, null, { status: 'nachlauf' })])).toBe(true)
    expect(welleStehtVon('a', [knoten('p', pruefer, null, { status: 'laeuft' })])).toBe(true)
    expect(welleStehtVon('a', [knoten('l', leser, null, { status: 'laeuft' })])).toBe(true)
    // Der eigene Block zählt nicht — sonst stünde die Welle für ihn nie.
    expect(welleStehtVon('a', [knoten('a', umsetzer, null, { status: 'laeuft' })])).toBe(true)
  })
})

describe('BAUPLAN 46 · Die neuen Zeilen sind für Georg geschrieben', () => {
  const zeilen = [
    texte.ticker.warteAufUeberschneidung('Bauer · D', 'Bauer · A', 'src/a/x.js ↔ src/a/'),
    texte.ticker.warteOhneDatenvertrag('Bauer · D', 'Bauer · A', true),
    texte.ticker.warteOhneDatenvertrag('Bauer · D', 'Bauer · A', false),
    texte.ticker.prueferWartetAufUmsetzer('Prüfer', 'Bauer'),
    texte.ticker.umsetzerWartetAufPruefer('Bauer', 'Prüfer'),
    texte.ticker.warteAufFolgenFrage('Bauer', 'Prüfer'),
    texte.ticker.welleGestartet(3),
    texte.ticker.nachlaufWartet('Bauer'),
    texte.ticker.zweigWiederhergestellt('Prüfer', 2),
    texte.ticker.zweigWiederherstellenGescheitert('Prüfer'),
    texte.ticker.zurueckgesetztBlock('Bauer'),
    texte.ticker.entscheidungGestellt('Prüfer'),
    texte.ticker.entscheidungWeitermachen('Prüfer'),
    texte.ticker.entscheidungZurueckgestellt('Prüfer'),
    texte.ticker.entscheidungWiederhergestellt('Prüfer'),
    texte.ticker.entscheidungWiederhergestelltGanz('Prüfer'),
    texte.entscheidung.trifftBereiche([texte.entscheidung.trifftDateien('Bauer', 4)]),
    texte.entscheidung.trifftGanzerOrdner('Bauer'),
    texte.entscheidung.zurueckstellenHinweis,
    texte.entscheidung.wiederherstellenHinweis
  ]

  it('kommen ohne Technik-Wörter aus und nennen den Block', () => {
    for (const zeile of zeilen) {
      expect(zeile).not.toMatch(/\b(Git|Branch|Commit|Merge|Repo|ref|Promise|Race)\b/i)
      expect(zeile.length).toBeGreaterThan(20)
    }
    expect(texte.ticker.warteAufUeberschneidung('D', 'A', 'x ↔ y')).toContain('x ↔ y')
    expect(texte.ticker.warteOhneDatenvertrag('D', 'A', true)).toMatch(/„D" hat keinen Datenvertrag/)
    expect(texte.ticker.warteOhneDatenvertrag('D', 'A', false)).toMatch(/„A" hat keinen Datenvertrag/)
    expect(texte.entscheidung.trifftGanzerOrdner('Bauer')).toMatch(/ganzen Projektordner/)
  })

  it('sagt „nur einer" nirgends mehr, wo es die Welle betrifft', () => {
    expect(texte.ticker.warteAufSchreiber).toBeUndefined()
    expect(texte.entscheidung.zurueckstellenHinweis).not.toMatch(/Der Lauf hält/)
    expect(texte.entscheidung.wiederherstellenHinweis).toMatch(/Zweig/)
  })
})

describe('BAUPLAN 46 · Der Ausgang eines Laufs mit zweigbezogenen Wahlen', () => {
  const k = (status) => ({ status })
  it('rangiert wiederhergestellt vor zurückgestellt vor erfolgreich', () => {
    expect(endzustandAus([k('fertig'), k('fertig')])).toBe('erfolgreich')
    expect(endzustandAus([k('fertig'), k('zurueckgestellt')])).toBe('zurueckgestellt')
    expect(endzustandAus([k('wiederhergestellt'), k('zurueckgestellt'), k('fertig')])).toBe(
      'wiederhergestellt'
    )
  })
  it('bleibt bei sanft gestoppt bzw. fehlgeschlagen, wenn Blöcke offen blieben', () => {
    expect(endzustandAus([k('fertig'), k('offen')], { sanft: true })).toBe('sanft-gestoppt')
    expect(endzustandAus([k('fertig'), k('offen')])).toBe('fehlgeschlagen')
  })
})

// ——— Echte Sicherungspunkte für den harten Stopp mit zwei Schreibern ————————

let schreibSchritt = 0
function schreiben(wurzel, relativ, inhalt) {
  const ziel = path.join(wurzel, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  // Die Änderungs-Erkennung der Sicherungspunkte ist sekundengenau (siehe
  // laufDiffPunkte.test.js) — der Abstand wird künstlich hergestellt.
  const spaeter = new Date(Date.now() + 5000 + ++schreibSchritt * 1000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

function gitOrdner(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(app.getPath('userData'), 'sicherungen', schluessel)
}

function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-welle-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(gitOrdner(wurzel), { recursive: true, force: true })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

describe('BAUPLAN 46 · Harter Stopp mit mehreren laufenden Schreibern', () => {
  it('kennt alle Abgebrochenen, nicht nur den ersten', () => {
    const a = { hartAbgebrochen: true, status: 'offen' }
    const b = { hartAbgebrochen: true, status: 'offen' }
    const c = { status: 'fertig' }
    expect(hartAbgebrocheneBloecke([c, a, b])).toEqual([a, b])
    // Ohne Vermerk die alte Rechnung: der erste, der nicht fertig wurde.
    expect(hartAbgebrocheneBloecke([c, { status: 'offen' }])).toHaveLength(1)
    expect(hartAbgebrocheneBloecke([c])).toEqual([])
  })

  it('rollt jeden Abgebrochenen auf seinem Strang zurück und sagt es je Block', async () => {
    const projekt = frischesProjekt('hart-zwei')
    schreiben(projekt, 'src/a/x.js', 'a sauber\n')
    schreiben(projekt, 'src/b/y.js', 'b sauber\n')
    schreiben(projekt, 'pruefung/pruefer-p/frisch.test.js', 'fremd\n')
    await sicherungspunktAnlegen(projekt, 'Stand vor dem Lauf')
    await strangOeffnen(projekt, 'strang/a')
    await strangOeffnen(projekt, 'strang/b')
    schreiben(projekt, 'src/a/x.js', 'a halb\n')
    schreiben(projekt, 'src/b/y.js', 'b halb\n')
    schreiben(projekt, 'pruefung/pruefer-p/frisch.test.js', 'fremd geändert\n')
    const a = {
      name: 'Bauer · A',
      def: umsetzer,
      status: 'offen',
      strang: 'strang/a',
      wirkbereich: ['src/a/'],
      hartAbgebrochen: true
    }
    const b = {
      name: 'Bauer · B',
      def: umsetzer,
      status: 'offen',
      strang: 'strang/b',
      wirkbereich: ['src/b/'],
      hartAbgebrochen: true
    }
    const zeilen = []
    const geschuetzt = []
    const zurueck = await hartZurueckrollenAn(projekt, {
      knotenListe: [a, b],
      geschuetztFuer: (k) => {
        geschuetzt.push(k?.name)
        return ['pruefung/pruefer-p/']
      },
      tickern: (t) => zeilen.push(t)
    })
    expect(zurueck.ok).toBe(true)
    // Beide Reviere stehen wieder auf dem Stand vor dem Lauf, das fremde bleibt.
    expect(fs.readFileSync(path.join(projekt, 'src/a/x.js'), 'utf8')).toBe('a sauber\n')
    expect(fs.readFileSync(path.join(projekt, 'src/b/y.js'), 'utf8')).toBe('b sauber\n')
    expect(fs.readFileSync(path.join(projekt, 'pruefung/pruefer-p/frisch.test.js'), 'utf8')).toBe(
      'fremd geändert\n'
    )
    expect(geschuetzt).toEqual(['Bauer · A', 'Bauer · B'])
    expect(zeilen).toContain(texte.ticker.zurueckgesetztBlock('Bauer · A'))
    expect(zeilen).toContain(texte.ticker.zurueckgesetztBlock('Bauer · B'))
  })
})

// ——— Der Ablaufplaner mit Motor-Ersatz ———————————————————————————————————————

// Ein Motor, der Blöcke auf Kommando fertig werden lässt. `bauen` liefert je
// Instanz die Meldungen (und darf nebenbei Dateien schreiben, wie ein echter
// Bauer); `freigeben(instanzId)` beendet den Anlauf. Solange nicht freigegeben,
// „arbeitet" der Block — genau das braucht die Messung, wer gleichzeitig läuft.
function motorErsatz(ergebnisFuer) {
  const wartend = new Map() // instanzId → aufloesen
  const gestartet = []
  const beendet = []
  steuerung.bauen = (optionen) => ({
    sessionKennung: null,
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      gestartet.push({ instanzId: block.instanzId, zeit: Date.now() })
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, async () => {
          const meldungen = await ergebnisFuer(block, optionen)
          beendet.push({ instanzId: block.instanzId, zeit: Date.now() })
          aufloesen({
            zustand: 'erfolgreich',
            ergebnisText: '',
            meldungen,
            fehlertext: '',
            fehlerArt: null,
            verbrauch: null
          })
        })
      })
    }
  })
  return {
    gestartet,
    beendet,
    async freigeben(instanzId) {
      const bis = Date.now() + 5000
      while (!wartend.has(instanzId) && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
      const los = wartend.get(instanzId)
      if (!los) throw new Error('Block nie gestartet: ' + instanzId)
      wartend.delete(instanzId)
      await los()
    }
  }
}

function fensterErsatz() {
  const ereignisse = []
  return {
    ereignisse,
    fenster: {
      isDestroyed: () => false,
      isFocused: () => true,
      webContents: { send: (_kanal, daten) => ereignisse.push(daten) }
    },
    ticker: () => ereignisse.filter((e) => e.art === 'ticker').map((e) => e.text),
    async warteAuf(pruefung, was = 'Ereignis') {
      const bis = Date.now() + 8000
      while (!pruefung() && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      if (!pruefung()) throw new Error('Nicht eingetreten: ' + was)
    }
  }
}

const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }
function paketMeldung(block, listen) {
  const pakete = block.ziele.map((ziel) => ({
    zielBlock: ziel.adresse,
    ziel: 'Teil ' + ziel.name,
    fertigKriterien: ['Läuft.'],
    erlaubteDateien: listen[ziel.instanzId]
  }))
  const ergebnis = meldungPruefen('arbeitspaket', { ...rahmen, pakete }, 'Arbeitspaket', {
    ziele: block.ziele
  })
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}
function umsetzungsMeldung() {
  return [meldungPruefen('umsetzungsbericht', { ...rahmen }, 'Umsetzungsbericht').meldung]
}
function pruefMeldung(bestanden) {
  const roh = bestanden
    ? { ...rahmen, urteil: 'bestanden', beanstandungen: [], rotVorGruen: '', geprueft: [] }
    : {
        ...rahmen,
        urteil: 'fehlgeschlagen',
        beanstandungen: [{ einstufung: 'grundsaetzlich', text: 'Der Aufbau trägt nicht.', fundort: '' }],
        rotVorGruen: '',
        geprueft: []
      }
  const ergebnis = meldungPruefen('pruefbeleg', roh, 'Prüfbeleg')
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}

function workflowSchreiben(projekt, bloecke, pfeile, reparaturRunden = 0) {
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden, uebertragGrenze: 5, bloecke, pfeile }),
    'utf8'
  )
}

describe('BAUPLAN 46 · Ein Lauf mit drei getrennten Bauern schreibt als Welle', () => {
  // Paket schneiden → Bauer · A, · B, · C (getrennte Listen) und daneben ein
  // zweites Paket schneiden → Bauer · D, dessen Liste sich mit A überschneidet.
  // Innerhalb EINER Meldung weist paket_melden überschneidende Zuschnitte schon
  // ab (Vertrag F10) — die Überschneidung, die der Planer abfangen muss, kommt
  // deshalb aus zwei Auftragsquellen. D muss warten, bis A fertig ist.
  const projekt = frischesProjekt('welle-drei')
  const bloecke = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Drei Teile bauen' } },
    { instanzId: 'ba', blockId: 'bauer', zusatz: 'A' },
    { instanzId: 'bb', blockId: 'bauer', zusatz: 'B' },
    { instanzId: 'bc', blockId: 'bauer', zusatz: 'C' },
    { instanzId: 'p2', blockId: 'paket-schneiden', zusatz: 'D', feldWerte: { wunsch: 'Teil D' } },
    { instanzId: 'bd', blockId: 'bauer', zusatz: 'D' }
  ]
  const pfeile = [
    { von: 'p', nach: 'ba' },
    { von: 'p', nach: 'bb' },
    { von: 'p', nach: 'bc' },
    { von: 'p', nach: 'p2' },
    { von: 'p2', nach: 'bd' }
  ]
  // Das erste Paket schneiden schneidet getrennt (falls es D überhaupt als Ziel
  // sieht, bekommt D dort eine unverfängliche Liste); das zweite, nähere gibt D
  // die Liste, die sich mit A überschneidet — und die nähere gilt.
  const listen = {
    p: { ba: ['src/a/'], bb: ['src/b/'], bc: ['src/c/'], bd: ['src/d/'] },
    p2: { bd: ['src/a/x.js', 'src/d/'] }
  }
  let sicht
  let motor

  beforeAll(async () => {
    workflowSchreiben(projekt, bloecke, pfeile)
    schreiben(projekt, 'src/a/x.js', 'alt\n')
    steuerung.rauchtests.length = 0
    steuerung.rauchtestErgebnis = { geprueft: true, gruen: true }
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p' || block.instanzId === 'p2') {
        optionen.aufPaketMeldung({ instanzId: block.instanzId, aufgabenIds: [] })
        return paketMeldung(block, listen[block.instanzId])
      }
      // Ein Bauer schreibt in sein Revier — genau die Liste, die FlowForge ihm
      // als Sperre mitgibt.
      const erster = block.dateiListe[0]
      schreiben(projekt, erster.endsWith('/') ? erster + 'neu.js' : erster, 'gebaut von ' + block.instanzId + '\n')
      return umsetzungsMeldung()
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('p')
    await motor.freigeben('p2')
  }, 30000)

  it('startet A, B und C gleichzeitig — D wartet wegen der Überschneidung mit A, und der Ticker sagt es', async () => {
    await sicht.warteAuf(
      () => ['ba', 'bb', 'bc'].every((id) => motor.gestartet.some((g) => g.instanzId === id)),
      'A, B, C gestartet'
    )
    await sicht.warteAuf(
      () => sicht.ticker().some((z) => z.startsWith('„Bauer · D" wartet')),
      'D wartet'
    )
    expect(laufZustand(projekt).blockInstanzIds.sort()).toEqual(['ba', 'bb', 'bc'])
    expect(motor.gestartet.some((g) => g.instanzId === 'bd')).toBe(false)
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.welleGestartet(3))
    expect(zeilen).toContain(
      texte.ticker.warteAufUeberschneidung('Bauer · D', 'Bauer · A', 'src/a/x.js ↔ src/a/')
    )
    // Der Verbrauchs-Hinweis für parallele Blöcke bleibt (BAUPLAN 13) — er
    // zählt alle vier Gleichzeitigen, auch das nur-lesende zweite Paket schneiden.
    expect(zeilen).toContain(texte.lauf.parallelBloeckeHinweis(4))
  }, 20000)

  it('hält D auch nach A\'s Anlauf noch zurück — A ist im Nachlauf, sein Revier gilt noch', async () => {
    await motor.freigeben('ba')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.nachlaufWartet('Bauer · A')),
      'A im Nachlauf'
    )
    // Kurz Luft lassen: Würde D jetzt starten, wäre das hier zu sehen.
    await new Promise((r) => setTimeout(r, 150))
    expect(motor.gestartet.some((g) => g.instanzId === 'bd')).toBe(false)
    // Kein Rauchtest, solange B und C schreiben.
    expect(steuerung.rauchtests).toHaveLength(0)
    // A ist NICHT fertig — sein Punkt entsteht erst nach dem Nachlauf.
    expect(sicht.ticker()).not.toContain(
      texte.ticker.strangZusammengefuehrt(texte.ticker.blockBezeichnung(2, 'Bauer · A'))
    )
    expect(laufZustand(projekt).blockInstanzIds.sort()).toEqual(['bb', 'bc'])
  }, 20000)

  it('misst die Rauchtests, sobald die Welle steht, führt zusammen — und erst dann läuft D an', async () => {
    await motor.freigeben('bb')
    await motor.freigeben('bc')
    await sicht.warteAuf(() => motor.gestartet.some((g) => g.instanzId === 'bd'), 'D gestartet')
    // Drei Rauchtests (A, B, C) — jeder zu einer Zeit, zu der KEIN Bauer lief.
    expect(steuerung.rauchtests).toHaveLength(3)
    const laeuftUm = (zeit) =>
      motor.gestartet.some((g) => {
        if (!g.instanzId.startsWith('b')) return false
        const ende = motor.beendet.find((b) => b.instanzId === g.instanzId)
        return g.zeit <= zeit && (!ende || ende.zeit > zeit)
      })
    for (const probe of steuerung.rauchtests) expect(laeuftUm(probe.zeit)).toBe(false)
    // Körnung (Vertrag F6): Erst nach A's Zusammenführung („Nach Block") war
    // A's Revier frei — D startet danach, nicht davor.
    const zeilen = sicht.ticker()
    const startD = zeilen.findIndex((z) => z === texte.ticker.blockStartet(6, 6, 'Bauer · D'))
    const mergeA = zeilen.findIndex(
      (z) => z === texte.ticker.strangZusammengefuehrt(texte.ticker.blockBezeichnung(2, 'Bauer · A'))
    )
    expect(mergeA).toBeGreaterThan(-1)
    expect(startD).toBeGreaterThan(mergeA)
    // D wartet jetzt allein: kein Warte-Grund mehr, kein zweiter Schreiber.
    expect(laufZustand(projekt).blockInstanzIds).toEqual(['bd'])
  }, 20000)

  it('wird erfolgreich fertig — je Bauer genau ein „fertig"-Punkt in Georgs Liste', async () => {
    await motor.freigeben('bd')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
    expect(steuerung.rauchtests).toHaveLength(4)
    const zeilen = sicht.ticker()
    expect(zeilen.filter((z) => z === texte.ticker.rauchtestGruen)).toHaveLength(4)
    const punkte = (await sicherungspunkteLaden(projekt)).punkte.map((p) => p.beschriftung)
    for (const name of ['Bauer · A', 'Bauer · B', 'Bauer · C', 'Bauer · D'])
      expect(punkte.filter((b) => b === texte.sicherungen.beschriftungNachBlock(name))).toHaveLength(1)
    // Der Laufstand ist am Ende weg, und der Bericht zählt sechs erfolgreiche
    // Anläufe (zwei Auftragsquellen, vier Bauer).
    expect(fs.existsSync(path.join(projekt, 'laufstand.json'))).toBe(false)
    expect(ende.bericht.blockErgebnisse.filter((b) => b.zustand === 'erfolgreich')).toHaveLength(6)
  }, 30000)
})

describe('BAUPLAN 46 · Die Folgen-Frage gilt je Zweig und hält den Planer nicht an', () => {
  // Paket schneiden → Bauer · A → Prüfer · A und → Bauer · B → Prüfer · B.
  // Keine Reparatur-Runden: Der erste Fehlschlag stellt sofort die Frage.
  const projekt = frischesProjekt('welle-frage')
  const bloecke = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Zwei Teile' } },
    { instanzId: 'ba', blockId: 'bauer', zusatz: 'A' },
    { instanzId: 'pa', blockId: 'pruefer', zusatz: 'A' },
    { instanzId: 'bb', blockId: 'bauer', zusatz: 'B' },
    { instanzId: 'pb', blockId: 'pruefer', zusatz: 'B' }
  ]
  const pfeile = [
    { von: 'p', nach: 'ba' },
    { von: 'ba', nach: 'pa' },
    { von: 'p', nach: 'bb' },
    { von: 'bb', nach: 'pb' }
  ]
  const listen = { ba: ['src/a/'], bb: ['src/b/'] }
  let sicht
  let motor

  beforeAll(async () => {
    workflowSchreiben(projekt, bloecke, pfeile, 0)
    schreiben(projekt, 'src/a/x.js', 'a alt\n')
    schreiben(projekt, 'src/b/y.js', 'b alt\n')
    steuerung.rauchtests.length = 0
    steuerung.rauchtestErgebnis = { geprueft: false, grund: 'keine' }
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, listen)
      }
      if (block.instanzId === 'ba' || block.instanzId === 'bb') {
        schreiben(projekt, listen[block.instanzId][0] + 'neu.js', 'gebaut\n')
        return umsetzungsMeldung()
      }
      // Prüfer: schreibt einen Test in seine Prüfmappe und setzt den
      // Prüfbefehl (Pflicht) — A fällt durch, B besteht.
      schreiben(projekt, 'pruefung/' + block.pruefOrdner + '/probe.test.js', 'test\n')
      pruefbefehlSetzen(projekt, block.instanzId, 'npm test')
      return pruefMeldung(block.instanzId === 'pb')
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('p')
    await motor.freigeben('ba')
    await motor.freigeben('bb')
  }, 30000)

  it('lässt beide Prüfer nebeneinander laufen und stellt die Frage, während der andere Prüfer weiterarbeitet', async () => {
    await sicht.warteAuf(
      () => ['pa', 'pb'].every((id) => motor.gestartet.some((g) => g.instanzId === id)),
      'beide Prüfer gestartet'
    )
    expect(laufZustand(projekt).blockInstanzIds.sort()).toEqual(['pa', 'pb'])
    await motor.freigeben('pa')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'entscheidung'), 'Folgen-Frage')
    const zustand = laufZustand(projekt)
    expect(zustand.entscheidung?.blockName).toBe('Prüfer · A')
    // Der Dialog sagt vorher, was „Stand wiederherstellen" trifft: die
    // Dateiliste des Bauers und die Prüfmappe des Prüfers — sonst nichts.
    expect(zustand.entscheidung.trifft).toBe(
      texte.entscheidung.trifftBereiche([
        texte.entscheidung.trifftDateien('Bauer · A', 1),
        texte.entscheidung.trifftPruefordner('pruefung/pruefer-pa/')
      ])
    )
    // Prüfer · B arbeitet derweil weiter — der Planer steht nicht.
    expect(zustand.blockInstanzIds).toEqual(['pb'])
    expect(sicht.ticker()).toContain(texte.ticker.entscheidungGestellt('Prüfer · A'))
  }, 20000)

  it('lässt den anderen Zweig zu Ende laufen, während die Frage offen ist', async () => {
    await motor.freigeben('pb')
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.pruefungBestanden),
      'Prüfer · B bestanden'
    )
    // Die Frage ist noch offen, der Lauf läuft noch.
    expect(laufZustand(projekt).aktiv).toBe(true)
    expect(laufZustand(projekt).entscheidung?.blockName).toBe('Prüfer · A')
    expect(sicht.ereignisse.some((e) => e.art === 'fertig')).toBe(false)
  }, 20000)

  it('setzt bei „Stand wiederherstellen" nur den Zweig zurück — der andere bleibt', async () => {
    const frageId = laufZustand(projekt).entscheidung.frageId
    expect(laufEntscheidungAntworten(frageId, 'wiederherstellen')).toEqual({ ok: true })
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('wiederhergestellt')
    // A's Zweig steht wieder auf dem Stand vor dem Lauf …
    expect(fs.existsSync(path.join(projekt, 'src/a/neu.js'))).toBe(false)
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-pa/probe.test.js'))).toBe(false)
    // … B's Zweig ist unberührt.
    expect(fs.readFileSync(path.join(projekt, 'src/b/neu.js'), 'utf8')).toBe('gebaut\n')
    expect(fs.existsSync(path.join(projekt, 'pruefung/pruefer-pb/probe.test.js'))).toBe(true)
    const zeilen = sicht.ticker()
    expect(zeilen).toContain(texte.ticker.entscheidungWiederhergestellt('Prüfer · A'))
    expect(zeilen).toContain(texte.ticker.zweigWiederhergestellt('Prüfer · A', 2))
    expect(ende.bericht.entscheidungen).toEqual([{ block: 'Prüfer · A', wahl: 'wiederherstellen' }])
  }, 20000)
})

describe('BAUPLAN 46 · Eine offene Folgen-Frage belegt ihren Zweig (Nacharbeit, Prüfer-Befund)', () => {
  // Paket schneiden → Bauer · A → Prüfer · A (fällt durch, 0 Runden) und ein
  // zweites Paket schneiden → Bauer · B, dessen Liste in A's Revier greift.
  // Vor der Nacharbeit startete B, sobald A's Zweig auf die Frage wartete —
  // und „Stand wiederherstellen" nahm B's Halbstand still mit, während der
  // Ticker „andere Zweige unberührt" sagte (so gemessen).
  const projekt = frischesProjekt('welle-frage-belegt')
  const bloecke = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Teil A' } },
    { instanzId: 'ba', blockId: 'bauer', zusatz: 'A' },
    { instanzId: 'pa', blockId: 'pruefer', zusatz: 'A' },
    { instanzId: 'p2', blockId: 'paket-schneiden', zusatz: 'B', feldWerte: { wunsch: 'Teil B' } },
    { instanzId: 'bb', blockId: 'bauer', zusatz: 'B' }
  ]
  const pfeile = [
    { von: 'p', nach: 'ba' },
    { von: 'ba', nach: 'pa' },
    { von: 'p', nach: 'p2' },
    { von: 'p2', nach: 'bb' }
  ]
  const listen = { p: { ba: ['src/a/'], bb: ['src/b/'] }, p2: { bb: ['src/a/x.js'] } }
  let sicht
  let motor

  beforeAll(async () => {
    workflowSchreiben(projekt, bloecke, pfeile, 0)
    schreiben(projekt, 'src/a/x.js', 'a alt\n')
    steuerung.rauchtests.length = 0
    steuerung.rauchtestErgebnis = { geprueft: false, grund: 'keine' }
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p' || block.instanzId === 'p2') {
        optionen.aufPaketMeldung({ instanzId: block.instanzId, aufgabenIds: [] })
        return paketMeldung(block, listen[block.instanzId])
      }
      if (block.instanzId === 'ba') {
        schreiben(projekt, 'src/a/neu.js', 'gebaut von A\n')
        return umsetzungsMeldung()
      }
      if (block.instanzId === 'bb') {
        schreiben(projekt, 'src/a/x.js', 'a von b\n')
        return umsetzungsMeldung()
      }
      schreiben(projekt, 'pruefung/' + block.pruefOrdner + '/probe.test.js', 'test\n')
      pruefbefehlSetzen(projekt, block.instanzId, 'npm test')
      return pruefMeldung(false)
    })
    sicht = fensterErsatz()
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('p')
    await motor.freigeben('p2')
    await motor.freigeben('ba')
    await motor.freigeben('pa')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'entscheidung'), 'Folgen-Frage')
  }, 30000)

  it('lässt B nicht in den offenen Zweig hineinschreiben — und sagt, worauf B wartet', async () => {
    await sicht.warteAuf(
      () => sicht.ticker().includes(texte.ticker.warteAufFolgenFrage('Bauer · B', 'Prüfer · A')),
      'B wartet auf die Folgen-Frage'
    )
    await new Promise((r) => setTimeout(r, 150))
    expect(motor.gestartet.some((g) => g.instanzId === 'bb')).toBe(false)
    expect(laufZustand(projekt).blockInstanzIds).toEqual([])
    expect(laufZustand(projekt).entscheidung?.blockName).toBe('Prüfer · A')
  }, 20000)

  it('setzt bei „Stand wiederherstellen" nur A\'s Zweig zurück — B startet erst danach und schreibt unbehelligt', async () => {
    const frageId = laufZustand(projekt).entscheidung.frageId
    expect(laufEntscheidungAntworten(frageId, 'wiederherstellen')).toEqual({ ok: true })
    await sicht.warteAuf(() => motor.gestartet.some((g) => g.instanzId === 'bb'), 'B gestartet')
    // Der Rückroll war durch, BEVOR B anlief …
    const zeilen = sicht.ticker()
    const rueckroll = zeilen.findIndex((z) => z === texte.ticker.zweigWiederhergestellt('Prüfer · A', 2))
    const startB = zeilen.findIndex((z) => z === texte.ticker.blockStartet(5, 5, 'Bauer · B'))
    expect(rueckroll).toBeGreaterThan(-1)
    expect(startB).toBeGreaterThan(rueckroll)
    expect(fs.existsSync(path.join(projekt, 'src/a/neu.js'))).toBe(false)
    expect(fs.readFileSync(path.join(projekt, 'src/a/x.js'), 'utf8')).toBe('a alt\n')
    // … und was B danach schreibt, bleibt.
    await motor.freigeben('bb')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
    expect(fs.readFileSync(path.join(projekt, 'src/a/x.js'), 'utf8')).toBe('a von b\n')
    expect(sicht.ereignisse.find((e) => e.art === 'fertig').zustand).toBe('wiederhergestellt')
  }, 20000)
})
