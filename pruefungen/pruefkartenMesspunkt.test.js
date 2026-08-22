// Prüfkarten laufen von selbst (BAUPLAN 52) — die Entscheidungen der
// Messpunkte in Alltagssprache: Wann ist eine abgespielte alte Prüfung ROT,
// wann heißt es ehrlich „kein Urteil", wer wartet im Nachlauf, und was darf
// FlowForge einem Prüfer überhaupt als Fehlschlag melden?
//
// Warum als reine Funktionen und nicht am laufenden Lauf: Der Ablaufplaner in
// lauf.js lässt sich in einer Prüfung nicht fahren (er braucht Motor, Electron
// und einen echten Projektordner). Eine Zusicherung, die nur den Quelltext
// abklopft, bliebe dagegen grün, während FlowForge einem Prüfer ein Rot meldet,
// das gar keins ist — genau der Fehler, der hier ausgeschlossen wird.
//
// Rot vor Grün — so gemessen (Stand vor Bauschritt 52, Commit 2644469):
//   - ausgangAusMessung, deckelUrteil, trefferVorpruefung, nachlaufNoetig,
//     vorherMesspunktRegel, kartenPaarAusgang und kartenFuerAuftrag gab es
//     nicht; jeder Aufruf hier lief in einen TypeError.
//   - Der Fall „Exit 0, aber tests 0" ist die teuerste Falle: `node --test
//     pruefung/gibtsnicht/*.test.mjs` endet auf Windows gemessen mit Exit 0.
//     Ohne die Zeile in ausgangAusMessung hätte FlowForge das als Grün
//     verbucht und der Rotation eine Karte weggenommen, die nie etwas prüft.
//
// Der zweite Teil dieser Datei FÄHRT den Messpunkt wirklich — mit echtem
// Archiv, echtem Stempel und echten Ordnern im Temp-Verzeichnis; nur der
// Kartenspeicher, die Prozesse und der App-Zustand sind ersetzt. Anlass ist
// eine Messung (22.08.2026): Die Zahlen-Zeile im Ticker meldete in acht
// Messpunkten „0 abgespielt, 0 ohne Urteil, 0 zurückgestellt", weil sie VOR der
// Schleife stand, in der die Zahlen erst entstehen. Die alte Prüfung fütterte
// die Textfunktion von Hand mit erfundenen Zahlen und blieb dabei grün.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { texte } from '../src/shared/texte.js'
import {
  ausgangAusMessung,
  deckelUrteil,
  trefferVorpruefung,
  grundText,
  phaseText,
  kartenMesspunkt,
  KARTE_ZEITLIMIT_MS
} from '../src/main/pruefkartenLauf.js'
import { stempelSetzen } from '../src/main/pruefkartenStempel.js'
import { projektSchluessel } from '../src/main/pruefkarten.js'
import { kartenOrdnerName } from '../src/shared/pruefkartenRegeln.js'
import {
  nachlaufNoetig,
  vorherMesspunktRegel,
  kartenPaarAusgang,
  kartenFuerAuftrag,
  kartenBeimPruefer
} from '../src/main/lauf.js'

// Der Prüfstand: Was der Messpunkt von außen sieht. Alles andere (Archiv,
// Stempel, Kartenordner) ist echt — sonst prüfte diese Datei nur sich selbst.
const stand = vi.hoisted(() => ({
  karten: [],
  antworten: [],
  befehle: [],
  appLaeuft: false,
  stempelBlockiert: false
}))

vi.mock('../src/main/projekte.js', async (echtes) => ({
  ...(await echtes()),
  kartenLaden: () => ({ ok: true, karten: stand.karten })
}))
vi.mock('../src/main/torProzess.js', async (echtes) => ({
  ...(await echtes()),
  befehlAbspielen: async (_projektPfad, befehl) => {
    stand.befehle.push(befehl)
    return stand.antworten.shift() ?? { code: 0, ausgabe: 'ℹ tests 3\nℹ pass 3\nℹ fail 0\n' }
  }
}))
vi.mock('../src/main/appProzess.js', async (echtes) => ({
  ...(await echtes()),
  appLaeuft: () => stand.appLaeuft,
  aufPortFreiWarten: async () => true
}))
vi.mock('../src/main/startanleitung.js', async (echtes) => ({
  ...(await echtes()),
  startanleitungLaden: () => ({ anleitung: null })
}))
// Nur das Vermerken lässt sich blockieren — Laden und Setzen bleiben echt,
// damit die Auswahl auf einem wirklichen Stempel rechnet.
vi.mock('../src/main/pruefkartenStempel.js', async (echtes) => {
  const modul = await echtes()
  return {
    ...modul,
    stempelMessungVermerken: (...args) =>
      stand.stempelBlockiert ? false : modul.stempelMessungVermerken(...args)
  }
})

const gruen = { code: 0, ausgabe: '# tests 12\n# pass 12\n', zeitlimit: false, abgebrochen: false }

describe('Was eine abgespielte alte Prüfung bedeutet', () => {
  it('zählt einen sauberen Durchlauf als grün', () => {
    expect(ausgangAusMessung(gruen).ausgang).toBe('gruen')
  })

  it('zählt einen Fehlercode als rot', () => {
    expect(ausgangAusMessung({ ...gruen, code: 1, ausgabe: '# tests 12\n# fail 1\n' }).ausgang).toBe(
      'rot'
    )
  })

  it('wertet „Exit 0, aber gar kein Test gelaufen" NICHT als grün', () => {
    // Gemessen: node --test auf einen leeren Ordner endet mit Exit 0.
    const messung = { code: 0, ausgabe: '# tests 0\n# pass 0\n# fail 0\n' }
    expect(ausgangAusMessung(messung).ausgang).toBe('nichtGemessen')
    expect(ausgangAusMessung(messung).grund).toBe('nichtsGemessen')
  })

  it('verwechselt „tests 10" nicht mit „tests 0"', () => {
    expect(ausgangAusMessung({ code: 0, ausgabe: '# tests 10\n# pass 10\n' }).ausgang).toBe('gruen')
  })

  // Der teuerste Fall überhaupt, gemessen am 22.08.2026: `node --test
  // <ordner>/*.test.mjs` mit zwei fehlschlagenden Tests endet mit Fehlercode 1
  // und schreibt WÖRTLICH diese Zeilen. Auf „pass 0" allein gelesen wurde daraus
  // „ohne Urteil" — je schlimmer die Regression (ein Importfehler lässt ALLE
  // Tests fallen), desto sicherer verschluckte FlowForge sie. Genau dafür ist
  // der Messpunkt gebaut.
  it('meldet ROT, wenn kein einziger Test durchkam — „pass 0" verschluckt das nicht', () => {
    const messung = {
      code: 1,
      ausgabe:
        'ℹ tests 2\nℹ suites 0\nℹ pass 0\nℹ fail 2\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\n'
    }
    expect(ausgangAusMessung(messung).ausgang).toBe('rot')
  })

  it('bleibt bei einem Fehlercode auch dann rot, wenn „tests 0" dasteht', () => {
    expect(ausgangAusMessung({ code: 1, ausgabe: 'ℹ tests 0\nℹ pass 0\nℹ fail 0\n' }).ausgang).toBe(
      'rot'
    )
  })

  it('nennt nur den Fehlercode 0 mit leerer Bilanz „nichts gemessen"', () => {
    // Gemessen: node --test auf einen Ordner ohne Treffer, Fehlercode 0.
    expect(ausgangAusMessung({ code: 0, ausgabe: 'ℹ tests 0\nℹ pass 0\nℹ fail 0\n' })).toEqual({
      ausgang: 'nichtGemessen',
      grund: 'nichtsGemessen'
    })
  })

  it('macht aus einem Zeitlimit nie ein Rot', () => {
    const messung = { code: -1, ausgabe: 'irgendwas', zeitlimit: true }
    expect(ausgangAusMessung(messung).ausgang).toBe('nichtGemessen')
    expect(ausgangAusMessung(messung).grund).toBe('zeitlimit')
  })

  it('macht aus einem gestoppten Lauf nie ein Rot', () => {
    const messung = { code: -1, ausgabe: '', abgebrochen: true }
    expect(ausgangAusMessung(messung).ausgang).toBe('nichtGemessen')
    expect(ausgangAusMessung(messung).grund).toBe('abgebrochen')
  })

  it('macht aus einem belegten Port nie ein Rot', () => {
    const messung = { code: 1, ausgabe: 'Error: listen EADDRINUSE: address already in use :::3888' }
    expect(ausgangAusMessung(messung).ausgang).toBe('nichtGemessen')
    expect(ausgangAusMessung(messung).grund).toBe('portBelegt')
  })

  it('hat für jeden Grund einen Satz in Alltagssprache', () => {
    for (const grund of ['abgebrochen', 'zeitlimit', 'portBelegt', 'nichtsGemessen'])
      expect(grundText('grundNichtGemessen', grund).length).toBeGreaterThan(10)
    // Auch ein Grund, den es noch nicht gibt, bleibt lesbar statt leer.
    expect(grundText('grundNichtGemessen', 'gibtsnicht')).toBe(
      texte.pruefkarten.grundNichtGemessen.unbekannt
    )
  })

  // Gemessen (22.08.2026): Bei einer unbekannten GRUPPE lief die Rechnung auf
  // eine leere Tabelle und lieferte eine leere Zeichenkette — im Ticker stand
  // dann „nicht abspielbar: ." Der versprochene Rückfall griff nur eine Stufe
  // tief.
  it('bleibt auch bei einer unbekannten Gruppe ein ganzer Satz', () => {
    expect(grundText('gibtDieseGruppeNicht', 'egal')).toBe(texte.pruefkarten.grundUnbekannt)
    expect(grundText('gibtDieseGruppeNicht', 'egal').length).toBeGreaterThan(10)
  })

  it('nennt den Messpunkt bei der Runde', () => {
    expect(phaseText('vor', 2)).toContain('2')
    expect(phaseText('nach', 2)).toContain('2')
    expect(phaseText('vor', 2)).not.toBe(phaseText('nach', 2))
  })

  it('gibt einer einzelnen Karte deutlich weniger Zeit als dem Prüfbefehl', () => {
    expect(KARTE_ZEITLIMIT_MS).toBeLessThan(5 * 60 * 1000)
  })
})

describe('Die Zeit-Notbremse ändert nur, wie oft geprüft wird', () => {
  const voll = { verbrauchtMs: 999999, deckelMesspunktMs: 1000, restLaufMs: -1 }

  it('lässt eine Karte, die in diesem Lauf noch nie lief, auch bei erschöpfter Zeit laufen', () => {
    expect(deckelUrteil({ ...voll, schonGelaufen: false }).laeuft).toBe(true)
  })

  it('stellt eine Karte zurück, die in diesem Lauf schon dran war', () => {
    const urteil = deckelUrteil({ ...voll, schonGelaufen: true })
    expect(urteil.laeuft).toBe(false)
    expect(urteil.grund).toBe('lauf')
  })

  it('unterscheidet die Grenze des Messpunkts von der des Laufs', () => {
    const urteil = deckelUrteil({
      verbrauchtMs: 60000,
      deckelMesspunktMs: 10000,
      restLaufMs: 500000,
      schonGelaufen: true
    })
    expect(urteil.grund).toBe('messpunkt')
    expect(grundText('grundZurueckgestellt', 'messpunkt')).not.toBe('')
  })

  it('lässt laufen, solange beide Grenzen Luft haben', () => {
    expect(
      deckelUrteil({
        verbrauchtMs: 1000,
        deckelMesspunktMs: 600000,
        restLaufMs: 1800000,
        schonGelaufen: true
      }).laeuft
    ).toBe(true)
  })
})

describe('Vor dem Abspielen wird gezählt, nicht gehofft', () => {
  it('braucht mindestens eine passende Datei', () => {
    expect(trefferVorpruefung(['pruefe.mjs', 'hilfe.js'], ['*.test.mjs'])).toBe(false)
    expect(trefferVorpruefung(['a.test.mjs', 'hilfe.js'], ['*.test.mjs'])).toBe(true)
  })

  it('nimmt bei einem Befehl ohne Dateinamen einen nicht leeren Ordner', () => {
    expect(trefferVorpruefung(['sammel.mjs'], [])).toBe(true)
    expect(trefferVorpruefung([], [])).toBe(false)
  })
})

describe('Wer im Nachlauf wartet', () => {
  const bauer = { nurLesen: false, prueft: false }
  const bauerMitApp = { nurLesen: false, prueft: false, startanleitungPflicht: true }
  const pruefer = { nurLesen: false, prueft: true }
  const leser = { nurLesen: true, prueft: false }

  it('lässt JEDEN fertigen Schreiber warten, nicht nur den mit Startanleitung', () => {
    expect(nachlaufNoetig(bauer, 'fertig', false)).toBe(true)
    expect(nachlaufNoetig(bauerMitApp, 'fertig', false)).toBe(true)
  })

  it('lässt nur-lesende Blöcke durchlaufen', () => {
    expect(nachlaufNoetig(leser, 'fertig', false)).toBe(false)
  })

  it('lässt einen Prüfer nur wegen seiner Startanleitung warten', () => {
    expect(nachlaufNoetig(pruefer, 'fertig', false)).toBe(false)
    expect(nachlaufNoetig({ ...pruefer, startanleitungPflicht: true }, 'fertig', false)).toBe(true)
  })

  it('hält niemanden auf, wenn der Lauf gestoppt ist', () => {
    expect(nachlaufNoetig(bauer, 'fertig', true)).toBe(false)
  })

  it('wartet nicht auf einen Block, der gar nicht fertig ist', () => {
    expect(nachlaufNoetig(bauer, 'laeuft', false)).toBe(false)
  })
})

describe('Wann vor einem Block gemessen wird', () => {
  it('misst vor einem Bauer, dessen Stand sich geändert hat', () => {
    expect(
      vorherMesspunktRegel({
        def: { nurLesen: false, prueft: false },
        andererSchreibt: false,
        standGeaendert: true
      }).messen
    ).toBe(true)
  })

  it('misst nicht vor einem Prüfer — der hat mit dem Tor schon seine eigene Messung', () => {
    const regel = vorherMesspunktRegel({
      def: { prueft: true },
      andererSchreibt: false,
      standGeaendert: true
    })
    expect(regel.messen).toBe(false)
    expect(regel.grund).toBe('keinSchreiber')
  })

  it('misst nicht, solange nebenan noch jemand schreibt', () => {
    const regel = vorherMesspunktRegel({
      def: { nurLesen: false, prueft: false },
      andererSchreibt: true,
      standGeaendert: true
    })
    expect(regel.messen).toBe(false)
    expect(regel.grund).toBe('welle')
  })

  it('misst nicht zweimal denselben Stand', () => {
    const regel = vorherMesspunktRegel({
      def: { nurLesen: false, prueft: false },
      andererSchreibt: false,
      standGeaendert: false
    })
    expect(regel.messen).toBe(false)
    expect(regel.grund).toBe('unveraendert')
  })
})

describe('Ein „nachher" ohne „vorher" ist kein Fehlschlag', () => {
  it('meldet neu Kaputtes als neu kaputt', () => {
    expect(kartenPaarAusgang('gruen', 'rot')).toBe('neuRot')
  })

  it('meldet eine Altlast als Altlast', () => {
    expect(kartenPaarAusgang('rot', 'rot')).toBe('schonVorherRot')
  })

  it('meldet ohne Vergleichswert „nicht vergleichbar" statt rot', () => {
    expect(kartenPaarAusgang(null, 'rot')).toBe('nichtVergleichbar')
    expect(kartenPaarAusgang('nichtGemessen', 'rot')).toBe('nichtVergleichbar')
  })

  it('lässt Grünes und Ungemessenes durch, wie es ist', () => {
    expect(kartenPaarAusgang(null, 'gruen')).toBe('gruen')
    expect(kartenPaarAusgang('gruen', 'nichtGemessen')).toBe('nichtGemessen')
  })
})

describe('Was von den roten Karten in den Auftrag passt', () => {
  const karte = (n, laenge) => ({ titel: 'K' + n, ausgabe: 'x'.repeat(laenge) })

  it('nimmt alles, solange der Deckel reicht', () => {
    const ergebnis = kartenFuerAuftrag([karte(1, 100), karte(2, 100)], 3000)
    expect(ergebnis.eintraege).toHaveLength(2)
    expect(ergebnis.weggelassen).toBe(0)
  })

  it('zählt, was nicht mehr passt, statt es still fallen zu lassen', () => {
    const ergebnis = kartenFuerAuftrag([karte(1, 2000), karte(2, 2000), karte(3, 2000)], 3000)
    expect(ergebnis.eintraege).toHaveLength(1)
    expect(ergebnis.weggelassen).toBe(2)
    expect(texte.ticker.kartenAuftragGekuerzt('Prüfer', 2)).toContain('2')
  })

  it('nimmt mindestens eine Karte, auch wenn sie allein schon zu groß ist', () => {
    // Sonst verschwände ausgerechnet die eine rote Prüfung, um die es geht.
    const ergebnis = kartenFuerAuftrag([karte(1, 99999)], 3000)
    expect(ergebnis.eintraege).toHaveLength(1)
    expect(ergebnis.weggelassen).toBe(0)
  })
})

describe('Georg liest überall Klartext', () => {
  it('nennt in der Plan-Zeile jede Sorte Karte getrennt', () => {
    const zeile = texte.ticker.kartenPlan('vor Runde 1', 'Bauer · Motor', {
      ausgewaehlt: 3,
      rotation: 2,
      nichtBetroffen: 12,
      gezogen: 1,
      beimPruefer: 1,
      schonGelaufen: 0,
      nichtAbspielbar: 4
    })
    for (const zahl of ['3', '2', '12', '4']) expect(zeile).toContain(zahl)
    expect(zeile).toContain('vor Runde 1')
    // Nach einer Welle ist „um wen herum wurde gemessen" nicht mehr eine Person
    // — der Ticker nennt sie deshalb namentlich (Vertrag G5).
    expect(zeile).toContain('Bauer · Motor')
  })

  it('rechnet in der Ergebnis-Zeile ab, was wirklich lief', () => {
    const zeile = texte.ticker.kartenErgebnis('nach Runde 2', 'Bauer · Motor', {
      ausgefuehrt: 3,
      rot: 1,
      nichtGemessen: 2,
      zurueckgestellt: 4
    })
    for (const zahl of ['3', '1', '2', '4']) expect(zeile).toContain(zahl)
    expect(zeile).toContain('nach Runde 2')
  })

  it('sagt beim Auftrag des Prüfers dazu, wenn nebenan geschrieben wurde', () => {
    const eintrag = [{ titel: 'Alte Prüfung', was: 'nach Runde 1', ordner: 'pruefkarte-1', ausgabe: 'rums' }]
    expect(texte.agentenUebergabe.kartenRot(eintrag, false)).not.toContain('nebenan')
    expect(texte.agentenUebergabe.kartenRot(eintrag, true)).toContain('nebenan')
  })

  it('nennt dem Prüfer die freigegebenen Kartenordner namentlich', () => {
    const ohne = texte.agentenPruefordner.zusatz('pruefer-abc', [])
    const mit = texte.agentenPruefordner.zusatz('pruefer-abc', ['pruefkarte-0049e5aa'])
    expect(ohne).not.toContain('pruefkarte-')
    expect(mit).toContain('pruefung/pruefkarte-0049e5aa/')
  })

  it('erklärt in der Prüfmappe beide Sorten Unterordner', () => {
    expect(texte.agentenPruefordner.erklaerung).toContain('pruefer-')
    expect(texte.agentenPruefordner.erklaerung).toContain('pruefkarte-')
  })
})

// ——— Der Messpunkt wird gefahren, nicht nachgelesen ————————————————————————
//
// Rot vor Grün, gemessen am 22.08.2026 an genau diesem Prüfstand (Stand vor
// der Nacharbeit):
//   - Die eine Zahlen-Zeile meldete „0 abgespielt, 0 ohne Urteil, 0
//     zurückgestellt" und dazu „davon 2 reihum mitgenommen" — sie stand vor der
//     Schleife, in der die Zahlen erst entstehen.
//   - Eine Karte in einem Unterordner galt als „nicht abspielbar", obwohl
//     derselbe Befehl von Hand grün durchlief.
//   - Eine Karte, die schon beim Prüfer lag, wurde überkopiert; seine Notiz
//     blieb verwaist stehen und die Freigabe war weg.
//   - Beim Abbruch wurde genau EINE der drei offenen Karten namentlich genannt,
//     gezählt wurden alle drei; die anderen zwei standen in keinem Ergebnis.
describe('Ein Messpunkt, gefahren wie im Lauf', () => {
  let projekt
  let zeilen
  let ausgelegt
  let schonGelaufen

  const KARTEN = ['karte-01-aaaa', 'karte-02-bbbb', 'karte-03-cccc']

  function archivWurzel(kartenId) {
    return path.join(
      os.tmpdir(),
      'flowforge-pruefungen',
      'pruefkarten',
      projektSchluessel(projekt),
      kartenId
    )
  }

  // Eine gestempelte Prüfkarte mit aufbewahrten Dateien — so, wie sie nach einer
  // bestandenen Prüfung im echten Datenordner liegt.
  function karteAnlegen(kartenId, { dateien = { 'pruefe.mjs': '// leer\n' }, befehlDatei } = {}) {
    for (const [name, inhalt] of Object.entries(dateien)) {
      const ziel = path.join(archivWurzel(kartenId), ...name.split('/'))
      fs.mkdirSync(path.dirname(ziel), { recursive: true })
      fs.writeFileSync(ziel, inhalt, 'utf8')
    }
    stand.karten.push({ id: kartenId, titel: 'Prüfung ' + kartenId, sorte: 'pruefung' })
    stempelSetzen(projekt, kartenId, {
      dateiListe: [],
      befehl: 'node pruefung/pruefer-abc/' + (befehlDatei ?? 'pruefe.mjs'),
      ordner: 'pruefer-abc',
      instanzId: 'block-1'
    })
  }

  function fahren(zusatz = {}) {
    return kartenMesspunkt({
      projektPfad: projekt,
      phase: 'vor',
      instanzId: 'block-1',
      runde: 1,
      paketDateien: null,
      gezogen: [],
      beimPruefer: [],
      schonGelaufen,
      deckelMesspunktMs: 600000,
      restLaufMs: 600000,
      tickern: (text) => zeilen.push(text),
      ausgelegt,
      wer: 'Bauer · Motor',
      ...zusatz
    })
  }

  const kartenPfad = (kartenId) => path.join(projekt, 'pruefung', kartenOrdnerName(kartenId))

  beforeEach(() => {
    projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-messpunkt-'))
    zeilen = []
    ausgelegt = new Map()
    schonGelaufen = new Set()
    stand.karten = []
    stand.antworten = []
    stand.befehle = []
    stand.appLaeuft = false
    stand.stempelBlockiert = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(
      path.join(os.tmpdir(), 'flowforge-pruefungen', 'pruefkarten', projektSchluessel(projekt)),
      { recursive: true, force: true }
    )
    fs.rmSync(projekt, { recursive: true, force: true })
  })

  it('meldet erst den Plan und am Ende das Ergebnis — mit den Zahlen, die wirklich herauskamen', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    const erg = await fahren()

    expect(erg.zahlen.ausgefuehrt).toBe(3)
    // Die Plan-Zeile steht vorn und nennt, was vorgehabt ist.
    expect(zeilen[0]).toBe(texte.ticker.kartenPlan('vor Runde 1', 'Bauer · Motor', erg.zahlen))
    expect(zeilen[0]).toContain('3 ausgewählt')
    // Die Ergebnis-Zeile steht hinten und rechnet ab.
    expect(zeilen.at(-1)).toBe(
      texte.ticker.kartenErgebnis('vor Runde 1', 'Bauer · Motor', erg.zahlen)
    )
    expect(zeilen.at(-1)).toContain('3 abgespielt')
    // Der gemessene Fehler: „0 abgespielt" bei jedem Block.
    expect(zeilen.some((z) => z.includes('0 abgespielt'))).toBe(false)
  })

  it('bringt die Ergebnis-Zeile auch dann, wenn der Messpunkt abgebrochen wird', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    const erg = await fahren({ abbrechen: () => true })
    expect(zeilen.at(-1)).toBe(
      texte.ticker.kartenErgebnis('vor Runde 1', 'Bauer · Motor', erg.zahlen)
    )
    expect(erg.zahlen.ausgefuehrt).toBe(0)
  })

  it('nennt beim Abbruch JEDE offene Karte namentlich, nicht nur die erste', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    const erg = await fahren({ abbrechen: () => true })
    expect(erg.zahlen.nichtGemessen).toBe(3)
    // Gezählt wurden schon vorher alle drei — genannt wurde nur eine.
    for (const id of KARTEN) expect(zeilen.some((z) => z.includes('Prüfung ' + id))).toBe(true)
    // Und keine fällt aus dem Laufbericht: jede hat ihren Eintrag.
    expect(erg.ergebnisse.map((e) => e.kartenId).sort()).toEqual([...KARTEN].sort())
    expect(erg.ergebnisse.every((e) => e.ausgang === 'nichtGemessen')).toBe(true)
  })

  // Gemessen (22.08.2026): Wurde mitten im Abspielen gestoppt, stand
  // zahlen.ausgefuehrt trotzdem auf 1 — der Ticker meldete eine Prüfung, die es
  // nie zu einem Urteil gebracht hat.
  it('zählt eine mitten im Abspielen gestoppte Karte nicht als ausgeführt', async () => {
    karteAnlegen(KARTEN[0])
    stand.antworten = [{ code: -1, ausgabe: '', abgebrochen: true }]
    const erg = await fahren()
    expect(erg.ergebnisse[0].ausgang).toBe('nichtGemessen')
    expect(erg.zahlen.ausgefuehrt).toBe(0)
    expect(erg.zahlen.nichtGemessen).toBe(1)
  })

  it('zählt eine vor dem Start abgebrochene Karte nicht als ausgeführt', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    const erg = await fahren({ abbrechen: () => true })
    expect(erg.zahlen.ausgefuehrt).toBe(0)
    expect(erg.zahlen.rot).toBe(0)
  })

  it('spielt eine Prüfung ab, die in einem Unterordner liegt', async () => {
    // Gemessen: Die Namensliste enthielt nur „pruefe.mjs", das Muster aber
    // „unter/pruefe.mjs" — die Karte galt als nicht abspielbar, obwohl derselbe
    // Befehl von Hand grün durchlief.
    karteAnlegen(KARTEN[0], {
      dateien: { 'unter/pruefe.mjs': '// leer\n' },
      befehlDatei: 'unter/pruefe.mjs'
    })
    const erg = await fahren()
    expect(erg.zahlen.nichtAbspielbar).toBe(0)
    expect(erg.zahlen.ausgefuehrt).toBe(1)
    expect(stand.befehle).toEqual([
      'node pruefung/' + kartenOrdnerName(KARTEN[0]) + '/unter/pruefe.mjs'
    ])
  })

  it('lässt eine Karte, die beim Prüfer liegt, unangetastet — samt seiner Anpassung', async () => {
    karteAnlegen(KARTEN[0])
    // So sieht es aus, nachdem die Karte rot war und der Prüfer sie bearbeitet:
    fs.mkdirSync(kartenPfad(KARTEN[0]), { recursive: true })
    fs.writeFileSync(path.join(kartenPfad(KARTEN[0]), 'pruefe.mjs'), '// angepasst\n', 'utf8')
    fs.writeFileSync(path.join(kartenPfad(KARTEN[0]), 'notiz-des-pruefers.md'), 'gesehen\n', 'utf8')
    ausgelegt.set(KARTEN[0], { instanzId: 'pruefer-1', rot: true })

    const erg = await fahren({ beimPruefer: [KARTEN[0]] })

    expect(erg.zahlen.beimPruefer).toBe(1)
    expect(erg.zahlen.ausgefuehrt).toBe(0)
    // Die Anpassung steht noch da, die Archivfassung hat sie nicht überschrieben.
    expect(fs.readFileSync(path.join(kartenPfad(KARTEN[0]), 'pruefe.mjs'), 'utf8')).toBe(
      '// angepasst\n'
    )
    expect(fs.existsSync(path.join(kartenPfad(KARTEN[0]), 'notiz-des-pruefers.md'))).toBe(true)
    // Und die Freigabe an GENAU EINEN Prüfer ist nicht weggeworfen.
    expect(ausgelegt.get(KARTEN[0])).toEqual({ instanzId: 'pruefer-1', rot: true })
    expect(zeilen[0]).toContain('einem Prüfer')
  })

  it('behält die Freigabe eines Prüfers, wenn es dieselbe Karte erneut auslegt', async () => {
    karteAnlegen(KARTEN[0])
    stand.antworten = [{ code: 1, ausgabe: 'tests 2\npass 0\nfail 2\n' }]
    ausgelegt.set(KARTEN[0], { instanzId: 'pruefer-1', rot: true })
    await fahren()
    expect(ausgelegt.get(KARTEN[0])).toEqual({ instanzId: 'pruefer-1', rot: true })
  })

  it('sagt beim verbrauchten Lauf-Deckel ehrlich, dass erst der nächste Lauf dran ist', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    for (const id of KARTEN) schonGelaufen.add(id)
    const erg = await fahren({ restLaufMs: 0 })
    expect(erg.zahlen.zurueckgestellt).toBe(3)
    // Gemessen: Dreimal stand „Sie läuft in diesem Lauf noch mindestens einmal"
    // — bei verbrauchtem Lauf-Deckel läuft aber nur noch, was NIE lief.
    expect(zeilen.some((z) => z.includes('in diesem Lauf noch mindestens einmal'))).toBe(false)
    expect(zeilen.filter((z) => z.includes('erst im nächsten')).length).toBe(3)
  })

  it('verspricht beim Messpunkt-Deckel weiterhin den zweiten Anlauf in diesem Lauf', async () => {
    karteAnlegen(KARTEN[0])
    schonGelaufen.add(KARTEN[0])
    await fahren({ deckelMesspunktMs: 0, restLaufMs: 600000 })
    expect(zeilen.some((z) => z.includes('in diesem Lauf noch mindestens einmal'))).toBe(true)
  })

  it('sagt es, wenn sich das Gelaufen-Sein nicht merken ließ — aber nur einmal', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    stand.stempelBlockiert = true
    await fahren()
    const gemeldet = zeilen.filter((z) => z.includes('ließ sich nicht merken'))
    expect(gemeldet).toHaveLength(1)
    expect(gemeldet[0]).toContain('Reihum-Auswahl')
  })

  it('meldet einen liegengebliebenen Ordner als das, was er ist — nicht als „nicht abspielbar"', async () => {
    karteAnlegen(KARTEN[0])
    const echtesRmSync = fs.rmSync
    vi.spyOn(fs, 'rmSync').mockImplementation((ziel, optionen) => {
      if (String(ziel).includes(kartenOrdnerName(KARTEN[0])))
        throw new Error('EBUSY: resource busy or locked')
      return echtesRmSync(ziel, optionen)
    })

    const erg = await fahren()

    expect(erg.zahlen.ausgefuehrt).toBe(1)
    expect(erg.zahlen.nichtAbspielbar).toBe(0)
    // Gemessen: Die Zeile behauptete „nicht abspielbar", obwohl die Prüfung
    // gerade grün durchgelaufen war.
    expect(zeilen.some((z) => z.includes('Prüfung ' + KARTEN[0] + '" nicht abspielbar'))).toBe(
      false
    )
    expect(zeilen.some((z) => z.includes('bleibt geschützt liegen'))).toBe(true)
    // Der Eintrag bleibt stehen: Er hält den Ordner unter Schutz, und der
    // nächste Messpunkt räumt ihn erneut ab.
    expect(ausgelegt.has(KARTEN[0])).toBe(true)
  })

  it('räumt einen liegengebliebenen Ordner beim nächsten Messpunkt erneut ab', async () => {
    karteAnlegen(KARTEN[0])
    fs.mkdirSync(kartenPfad(KARTEN[0]), { recursive: true })
    fs.writeFileSync(path.join(kartenPfad(KARTEN[0]), 'rest.mjs'), '// Rest\n', 'utf8')
    ausgelegt.set(KARTEN[0], { instanzId: null, rot: false })
    await fahren({ gezogen: [KARTEN[0]] })
    expect(fs.existsSync(kartenPfad(KARTEN[0]))).toBe(false)
    expect(ausgelegt.has(KARTEN[0])).toBe(false)
  })

  it('zählt eine gezogene Karte nicht als „nicht betroffen"', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    const erg = await fahren({ gezogen: [KARTEN[1]] })
    expect(erg.zahlen.gezogen).toBe(1)
    expect(erg.zahlen.nichtBetroffen).toBe(0)
    expect(zeilen[0]).toContain('bei einem Prüfer auf dem Schaubild')
  })

  it('zählt im Aufhol-Messpunkt die schon gelaufenen Karten als solche', async () => {
    for (const id of KARTEN) karteAnlegen(id)
    schonGelaufen.add(KARTEN[0])
    const erg = await fahren({ nurNieGelaufen: true })
    expect(erg.zahlen.schonGelaufen).toBe(1)
    expect(erg.zahlen.nichtBetroffen).toBe(0)
    expect(erg.zahlen.ausgewaehlt).toBe(2)
  })

  it('lässt bei einer roten Karte den Ordner liegen und zählt sie getrennt', async () => {
    karteAnlegen(KARTEN[0])
    stand.antworten = [{ code: 1, ausgabe: 'tests 2\npass 0\nfail 2\n' }]
    const erg = await fahren()
    expect(erg.zahlen.rot).toBe(1)
    expect(erg.zahlen.ausgefuehrt).toBe(1)
    expect(erg.ergebnisse[0].ausgang).toBe('rot')
    expect(fs.existsSync(kartenPfad(KARTEN[0]))).toBe(true)
    expect(ausgelegt.get(KARTEN[0])?.rot).toBe(true)
  })

  it('räumt den Ordner einer grünen Karte wieder weg', async () => {
    karteAnlegen(KARTEN[0])
    const erg = await fahren()
    expect(erg.ergebnisse[0].ausgang).toBe('gruen')
    expect(fs.existsSync(kartenPfad(KARTEN[0]))).toBe(false)
    expect(ausgelegt.has(KARTEN[0])).toBe(false)
  })

  // Die Liste der Karten „beim Prüfer" entsteht im Lauf NICHT von Hand,
  // sondern aus dem Laufzustand. Gemessen am 22.08.2026: Der Messpunkt kannte
  // die Schonung, aber lauf.js füllte den Wert nicht — im echten Lauf war die
  // Liste immer leer, und die Archivfassung legte sich weiter über die
  // Anpassung des Prüfers.
  it('schont die Karten beim Prüfer auch dann, wenn die Liste aus dem Laufzustand kommt', async () => {
    karteAnlegen(KARTEN[0])
    karteAnlegen(KARTEN[1])
    fs.mkdirSync(kartenPfad(KARTEN[0]), { recursive: true })
    fs.writeFileSync(path.join(kartenPfad(KARTEN[0]), 'pruefe.mjs'), '// angepasst\n', 'utf8')
    // So steht es im Lauf: Die rote Karte ist genau einem Prüfer freigegeben.
    ausgelegt.set(KARTEN[0], { instanzId: 'pruefer-1', rot: true })

    // Genau die Rechnung, die lauf.js am Messpunkt einsetzt — keine Handliste.
    expect(kartenBeimPruefer(ausgelegt)).toEqual([KARTEN[0]])
    const erg = await fahren({ beimPruefer: kartenBeimPruefer(ausgelegt) })

    expect(erg.zahlen.beimPruefer).toBe(1)
    expect(fs.readFileSync(path.join(kartenPfad(KARTEN[0]), 'pruefe.mjs'), 'utf8')).toBe(
      '// angepasst\n'
    )
    expect(ausgelegt.get(KARTEN[0])).toEqual({ instanzId: 'pruefer-1', rot: true })
    // Die zweite Karte läuft ganz normal weiter.
    expect(erg.zahlen.ausgefuehrt).toBe(1)
  })
})

// Die Naht zwischen Lauf und Messpunkt (Nacharbeit Bauschritt 52).
//
// Rot vor Grün, gemessen am 22.08.2026:
//   - kartenBeimPruefer gab es nicht; lauf.js reichte den Parameter gar nicht
//     durch, und die Schonung der Karten beim Prüfer lief ins Leere.
//   - agentenUebergabe.kartenRot forderte JEDEN Prüfer auf, „die Dateien in
//     ihrem Kartenordner" anzupassen — freigegeben wird der Ordner aber nur
//     EINEM. Der zweite Prüfer lief damit in die harte Motor-Sperre „fremder
//     Prüfordner", verbrannte einen Anlauf und sah im Ticker aus, als hätte er
//     sich nicht an die Regeln gehalten.
describe('Die Naht: Was der Lauf dem Messpunkt und dem Prüfer mitgibt', () => {
  it('nennt genau die ausgelegten Karten, die einem Prüfer gehören', () => {
    const ausgelegt = new Map([
      ['karte-frei', { instanzId: null, rot: true }],
      ['karte-gezogen', { instanzId: 'pruefer-1', rot: false }],
      ['karte-freigegeben', { instanzId: 'pruefer-2', rot: true }]
    ])
    expect(kartenBeimPruefer(ausgelegt)).toEqual(['karte-gezogen', 'karte-freigegeben'])
  })

  it('kommt mit einem leeren Laufzustand zurecht', () => {
    expect(kartenBeimPruefer(new Map())).toEqual([])
    expect(kartenBeimPruefer(null)).toEqual([])
    expect(kartenBeimPruefer(new Map([['k', null]]))).toEqual([])
  })

  it('reicht die Rechnung im Lauf auch wirklich an den Messpunkt durch', () => {
    // Warum hier die Quelle gelesen wird: Der Ablaufplaner lässt sich in einer
    // Prüfung nicht fahren. Ein vergessener Parameter fiele sonst nirgends auf
    // — er wäre einfach leer, und alles bliebe grün.
    const quelle = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(quelle).toMatch(/beimPruefer: kartenBeimPruefer\(kartenAusgelegt\)/)
  })

  it('fordert nur bei den freigegebenen Karten zum Anpassen auf', () => {
    const text = texte.agentenUebergabe.kartenRot(
      [
        {
          titel: 'Meine',
          was: 'vor Runde 1',
          ordner: 'pruefkarte-aaaa',
          ausgabe: 'fail 1',
          darfAnpassen: true
        },
        {
          titel: 'Fremde',
          was: 'vor Runde 1',
          ordner: 'pruefkarte-bbbb',
          ausgabe: 'fail 2',
          darfAnpassen: false
        }
      ],
      false
    )
    // Beide Karten stehen mit ihrer Ausgabe da — der Befund geht an alle.
    expect(text).toContain('Meine')
    expect(text).toContain('fail 1')
    expect(text).toContain('Fremde')
    expect(text).toContain('fail 2')
    // Die Aufforderung zum Anpassen steht nur vor der eigenen Karte; hinter der
    // fremden steht das Gegenteil.
    const anpassen = text.indexOf('passe die Dateien in ihrem Kartenordner an')
    const gesperrt = text.indexOf('Ihre Ordner sind für dich')
    expect(anpassen).toBeGreaterThan(-1)
    expect(gesperrt).toBeGreaterThan(anpassen)
    expect(text.indexOf('Meine')).toBeGreaterThan(anpassen)
    expect(text.indexOf('Meine')).toBeLessThan(gesperrt)
    expect(text.indexOf('Fremde')).toBeGreaterThan(gesperrt)
  })

  it('lässt die Aufforderung ganz weg, wenn dieser Prüfer keine Karte anfassen darf', () => {
    const text = texte.agentenUebergabe.kartenRot(
      [
        {
          titel: 'Fremde',
          was: 'nach Runde 2',
          ordner: 'pruefkarte-bbbb',
          ausgabe: 'fail 2',
          darfAnpassen: false
        }
      ],
      false
    )
    expect(text).not.toContain('passe die Dateien')
    expect(text).toContain('Ihre Ordner sind für dich')
    expect(text).toContain('echte Regression')
  })

  it('nennt die Unschärfe der Welle weiterhin', () => {
    const text = texte.agentenUebergabe.kartenRot(
      [
        {
          titel: 'Meine',
          was: 'vor Runde 1',
          ordner: 'pruefkarte-aaaa',
          ausgabe: 'fail 1',
          darfAnpassen: true
        }
      ],
      true
    )
    expect(text).toContain('nebenan noch ein anderer')
  })

  it('holt die Freigabe im Lauf aus derselben Liste, die der Motor durchsetzt', () => {
    const quelle = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(quelle).toMatch(/darfAnpassen: k\.freieKartenOrdner\.includes\(e\.ordner\)/)
  })

  // Der Stempel legt eine unlesbare Datei zur Seite und fängt neu an
  // (Nacharbeit A). Das ist ein Verlust: Die gemerkten Startbefehle aller
  // übrigen Karten sind erst einmal fort. Ohne diese Zeile stünde er nirgends —
  // gemessen: stempelSetzen meldete { beiseite: true }, und niemand las es.
  it('sagt es im Ticker, wenn der Stempel die unlesbare Datei zur Seite gelegt hat', () => {
    const quelle = fs.readFileSync('src/main/lauf.js', 'utf8')
    expect(quelle).toMatch(/gesetzt\.beiseite\) tickern\(texte\.ticker\.kartenStempelBeiseite\)/)
    // Und der Satz sagt in Georgs Sprache, was verloren ist.
    expect(texte.ticker.kartenStempelBeiseite).toContain('stempel.json.kaputt')
    expect(texte.ticker.kartenStempelBeiseite).toContain('übrigen Prüfkarten')
  })
})
