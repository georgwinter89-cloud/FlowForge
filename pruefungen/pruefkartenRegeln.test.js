// Prüfkarten laufen von selbst (BAUPLAN 52) — die reinen Rechnungen dahinter.
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es src/shared/pruefkartenRegeln.js
// nicht (Import rot). Danach wurde jede Zusage einzeln rot gesehen, indem die
// frisch gebaute Regel wieder herausgenommen wurde:
//   - ohne die Segment-Grenzen in befehlUmschreiben traf die Ersetzung auch
//     „pruefer-6c746d22-alt" und lieferte einen Pfad, den es nicht gibt;
//   - ohne den erneuten pruefbefehlPruefen kam ein Befehl über PRUEFBEFEHL_MAX
//     als { ok: true } zurück — FlowForge hätte ihn ohne Rückfrage abgespielt;
//   - ohne die Rotation lieferte kartenAuswahl für ein Paket, das keine Karte
//     berührt, eine leere Laufliste (die Gegenprobe fiel still aus);
//   - ohne die Sortierung nach dauerMs stand die Laufliste in Kartenreihenfolge.
//
// Die Befehlsformen unten sind nicht ausgedacht: Sie stehen so in
// %APPDATA%\flowforge\pruefbefehl\*.json (11 archivierte Prüfbefehle, gelesen
// am 22.08.2026) — Sammel-Skript, Sammel-Skript mit Bindestrich, anders
// benanntes Sammel-Skript und der Ordnerlauf mit Muster.
import { describe, it, expect } from 'vitest'
import {
  kartenOrdnerName,
  befehlUmschreiben,
  musterImBefehl,
  nameTrifftMuster,
  kartenAuswahl,
  PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD,
  PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL,
  pruefkartenDeckelMesspunktBereinigen,
  PRUEFKARTEN_DECKEL_LAUF_STANDARD,
  PRUEFKARTEN_DECKEL_LAUF_WAHL,
  pruefkartenDeckelLaufBereinigen
} from '../src/shared/pruefkartenRegeln.js'
import { PRUEFBEFEHL_MAX } from '../src/shared/torRegeln.js'

const KARTE = '0049e5aa-1111-2222-3333-444455556666'

describe('BAUPLAN 52 · Der Kartenordner liegt auf der Ebene, auf der geschrieben wurde', () => {
  it('bildet den Namen aus den ersten acht Zeichen der Kartenkennung', () => {
    expect(kartenOrdnerName(KARTE)).toBe('pruefkarte-0049e5aa')
  })

  it('trägt keinen Prüfordner mehr im Namen — sonst läge er eine Ebene zu tief', () => {
    expect(kartenOrdnerName(KARTE)).not.toContain('/')
  })

  // Gemessen (22.08.2026): Ohne Kennung kam der nackte Rumpf „pruefkarte-"
  // heraus, auf den istKartenOrdner ebenfalls passt. Der Pfad dazu zeigte auf
  // die ganze Prüfmappe — ein Abräumen hätte die Arbeit des Laufs geleert.
  it('liefert ohne Kartenkennung gar keinen Namen', () => {
    expect(kartenOrdnerName(undefined)).toBe('')
    expect(kartenOrdnerName('')).toBe('')
    expect(kartenOrdnerName('   ')).toBe('')
    expect(kartenOrdnerName(null)).toBe('')
  })
})

describe('BAUPLAN 52 · Der gestempelte Befehl wird auf den Kartenordner umgeschrieben', () => {
  const neu = kartenOrdnerName(KARTE)

  it('schreibt das Sammel-Skript um — die häufigste Form im echten Archiv', () => {
    expect(befehlUmschreiben('node pruefung/pruefer-6c746d22/pruefe.mjs', 'pruefer-6c746d22', neu)).toEqual({
      ok: true,
      befehl: 'node pruefung/pruefkarte-0049e5aa/pruefe.mjs'
    })
  })

  it('schreibt den Ordnerlauf mit Muster um', () => {
    expect(
      befehlUmschreiben('node --test pruefung/pruefer-bc701360/*.test.mjs', 'pruefer-bc701360', neu)
    ).toEqual({ ok: true, befehl: 'node --test pruefung/pruefkarte-0049e5aa/*.test.mjs' })
  })

  it('schreibt auch die anders benannten Sammel-Skripte um', () => {
    expect(
      befehlUmschreiben('node pruefung/pruefer-9f2edf01/sammel.mjs', 'pruefer-9f2edf01', neu).befehl
    ).toBe('node pruefung/pruefkarte-0049e5aa/sammel.mjs')
    expect(
      befehlUmschreiben('node pruefung/pruefer-2cfaaeb6/pruefe-alles.mjs', 'pruefer-2cfaaeb6', neu)
        .befehl
    ).toBe('node pruefung/pruefkarte-0049e5aa/pruefe-alles.mjs')
  })

  it('ersetzt ALLE Vorkommen', () => {
    expect(
      befehlUmschreiben(
        'node pruefung/pruefer-6c746d22/pruefe.mjs pruefung/pruefer-6c746d22/mehr.mjs',
        'pruefer-6c746d22',
        neu
      ).befehl
    ).toBe('node pruefung/pruefkarte-0049e5aa/pruefe.mjs pruefung/pruefkarte-0049e5aa/mehr.mjs')
  })

  it('kommt mit Rückwärts-Schrägstrichen zurecht (Windows-Schreibweise)', () => {
    expect(
      befehlUmschreiben('node pruefung\\pruefer-6c746d22\\pruefe.mjs', 'pruefer-6c746d22', neu).befehl
    ).toBe('node pruefung\\pruefkarte-0049e5aa\\pruefe.mjs')
  })

  it('ignoriert die Groß- und Kleinschreibung (Windows-Dateisystem)', () => {
    expect(
      befehlUmschreiben('node pruefung/Pruefer-6C746D22/pruefe.mjs', 'pruefer-6c746d22', neu).befehl
    ).toBe('node pruefung/pruefkarte-0049e5aa/pruefe.mjs')
  })

  // Der Ordnername ist auch ein möglicher Namensteil. Eine Ersetzung ohne
  // Segment-Grenzen machte aus „pruefer-6c746d22-alt" ein
  // „pruefkarte-0049e5aa-alt" — ein Pfad, den es nirgends gibt.
  it('ersetzt nur das ganze Pfad-Segment, nicht jeden Namensteil', () => {
    expect(
      befehlUmschreiben('node pruefung/pruefer-6c746d22-alt/pruefe.mjs', 'pruefer-6c746d22', neu)
    ).toEqual({ ok: false, grund: 'ordnerNichtImBefehl' })
  })

  it('sagt es, wenn der Befehl den Ordner gar nicht nennt („npm test")', () => {
    expect(befehlUmschreiben('npm test', 'pruefer-6c746d22', neu)).toEqual({
      ok: false,
      grund: 'ordnerNichtImBefehl'
    })
  })

  it('nimmt einen leeren Befehl nicht an', () => {
    expect(befehlUmschreiben('', 'pruefer-6c746d22', neu)).toEqual({ ok: false, grund: 'ohneBefehl' })
    expect(befehlUmschreiben(null, 'pruefer-6c746d22', neu)).toEqual({
      ok: false,
      grund: 'ohneBefehl'
    })
  })

  it('nimmt einen leeren oder wegstrecken-artigen Ordner nicht an', () => {
    const befehl = 'node pruefung/pruefer-6c746d22/pruefe.mjs'
    expect(befehlUmschreiben(befehl, '', neu)).toEqual({ ok: false, grund: 'ordnerLeer' })
    expect(befehlUmschreiben(befehl, '   ', neu)).toEqual({ ok: false, grund: 'ordnerLeer' })
    expect(befehlUmschreiben(befehl, 'pruefung/pruefer-6c746d22', neu)).toEqual({
      ok: false,
      grund: 'ordnerLeer'
    })
    expect(befehlUmschreiben(befehl, 'pruefung\\pruefer-6c746d22', neu)).toEqual({
      ok: false,
      grund: 'ordnerLeer'
    })
  })

  // FlowForge spielt den umgeschriebenen Befehl OHNE Rechte-Rückfrage ab. Also
  // muss die kurze Leine aus SPEC §4.3 für das ERGEBNIS gelten, nicht nur für
  // das, was einmal gestempelt wurde.
  it('weist ab, wenn die Ersetzung den Befehl über die Längengrenze schiebt', () => {
    const lang = 'node pruefung/x/' + 'a'.repeat(280) + '.mjs'
    expect(lang.length).toBe(PRUEFBEFEHL_MAX)
    expect(befehlUmschreiben(lang, 'x', neu)).toEqual({ ok: false, grund: 'ungueltig' })
  })

  it('weist ab, was kein Test-Werkzeug startet', () => {
    expect(
      befehlUmschreiben('curl pruefung/pruefer-6c746d22/pruefe.mjs', 'pruefer-6c746d22', neu)
    ).toEqual({ ok: false, grund: 'ungueltig' })
  })

  it('weist ab, wenn der neue Ordnername eine Verkettung einschleusen würde', () => {
    expect(
      befehlUmschreiben('node pruefung/pruefer-6c746d22/pruefe.mjs', 'pruefer-6c746d22', 'x && rm')
    ).toEqual({ ok: false, grund: 'ungueltig' })
  })
})

describe('BAUPLAN 52 · Welche Datei spricht der Befehl an?', () => {
  const ordner = 'pruefkarte-0049e5aa'

  it('findet das Sammel-Skript', () => {
    expect(musterImBefehl('node pruefung/pruefkarte-0049e5aa/pruefe.mjs', ordner)).toEqual([
      'pruefe.mjs'
    ])
  })

  it('findet das Muster des Ordnerlaufs', () => {
    expect(musterImBefehl('node --test pruefung/pruefkarte-0049e5aa/*.test.mjs', ordner)).toEqual([
      '*.test.mjs'
    ])
  })

  it('findet mehrere gleichrangige Skripte und nennt jedes einmal', () => {
    expect(
      musterImBefehl(
        'node pruefung/pruefkarte-0049e5aa/a.mjs pruefung/pruefkarte-0049e5aa/b.mjs pruefung/pruefkarte-0049e5aa/a.mjs',
        ordner
      )
    ).toEqual(['a.mjs', 'b.mjs'])
  })

  it('liefert nichts, wenn der Befehl nur den Ordner nennt — dann genügt „Ordner nicht leer"', () => {
    expect(musterImBefehl('node --test pruefung/pruefkarte-0049e5aa', ordner)).toEqual([])
  })

  it('liefert nichts, wenn der Ordner im Befehl nicht vorkommt', () => {
    expect(musterImBefehl('npm test', ordner)).toEqual([])
  })

  it('kommt mit Rückwärts-Schrägstrichen und Anführungszeichen zurecht', () => {
    expect(musterImBefehl('node "pruefung\\pruefkarte-0049e5aa\\pruefe.mjs"', ordner)).toEqual([
      'pruefe.mjs'
    ])
  })
})

describe('BAUPLAN 52 · Passt eine Datei auf das Muster?', () => {
  it('trifft den geraden Namen', () => {
    expect(nameTrifftMuster('pruefe.mjs', ['pruefe.mjs'])).toBe(true)
    expect(nameTrifftMuster('sammel.mjs', ['pruefe.mjs'])).toBe(false)
  })

  it('trifft den Stern', () => {
    expect(nameTrifftMuster('kanten.test.mjs', ['*.test.mjs'])).toBe(true)
    expect(nameTrifftMuster('kanten.mjs', ['*.test.mjs'])).toBe(false)
  })

  it('nimmt auch ein einzelnes Muster statt einer Liste', () => {
    expect(nameTrifftMuster('kanten.test.mjs', '*.test.mjs')).toBe(true)
  })

  it('trifft, wenn eines von mehreren Mustern passt', () => {
    expect(nameTrifftMuster('b.mjs', ['a.mjs', 'b.mjs'])).toBe(true)
  })

  it('ignoriert die Groß- und Kleinschreibung', () => {
    expect(nameTrifftMuster('Pruefe.MJS', ['pruefe.mjs'])).toBe(true)
  })

  // Der Stern einer Shell springt nicht über Ordnergrenzen. Täte er es hier,
  // hielte die Vorprüfung eine Datei in einem Unterordner für einen Treffer und
  // FlowForge spielte einen Befehl ab, der nachweislich nichts findet.
  it('lässt den Stern keinen Schrägstrich überspringen', () => {
    expect(nameTrifftMuster('unter/kanten.test.mjs', ['*.test.mjs'])).toBe(false)
    expect(nameTrifftMuster('unter/kanten.test.mjs', ['unter/*.test.mjs'])).toBe(true)
  })

  it('trifft mit leerem Namen oder leerem Muster nichts', () => {
    expect(nameTrifftMuster('', ['*.mjs'])).toBe(false)
    expect(nameTrifftMuster('a.mjs', [''])).toBe(false)
    expect(nameTrifftMuster('a.mjs', [])).toBe(false)
  })
})

// Bequemlichkeit für die Auswahl-Prüfungen: eine Karte samt gültigem Stempel.
function stempelEintrag(zusatz = {}) {
  return {
    dateiListe: ['src/api/nutzer.js'],
    befehl: 'node pruefung/pruefer-aaaaaaaa/pruefe.mjs',
    ordner: 'pruefer-aaaaaaaa',
    instanzId: 'aaaaaaaa-1111',
    zuletztMs: 1000,
    dauerMs: 1000,
    ...zusatz
  }
}

describe('BAUPLAN 52 · Die Auswahl eines Messpunkts', () => {
  it('spielt eine Karte ohne Stempel nicht ab — und versteckt sie auch nicht', () => {
    const erg = kartenAuswahl({
      karten: [{ id: 'alt', titel: 'Altkarte' }],
      stempel: {},
      paketDateien: ['src/api/nutzer.js'],
      gezogen: []
    })
    expect(erg.nichtAbspielbar).toEqual([{ id: 'alt', grund: 'ohneStempel' }])
    expect(erg.laeuft).toEqual([])
    expect(erg.uebersprungen).toEqual([])
  })

  it('nennt einen Stempel ohne Befehl und einen ohne brauchbaren Ordner beim Namen', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'a', titel: 'A' },
        { id: 'b', titel: 'B' },
        { id: 'c', titel: 'C' }
      ],
      stempel: {
        a: stempelEintrag({ befehl: '' }),
        b: stempelEintrag({ ordner: '' }),
        c: stempelEintrag({ ordner: 'pruefung/pruefer-aaaaaaaa' })
      },
      paketDateien: ['src/api/nutzer.js'],
      gezogen: []
    })
    expect(erg.nichtAbspielbar).toEqual([
      { id: 'a', grund: 'ohneBefehl' },
      { id: 'b', grund: 'ordnerLeer' },
      { id: 'c', grund: 'ordnerLeer' }
    ])
  })

  // Eine von Hand gezogene Karte liegt beim Prüfer und wird von ihm bearbeitet.
  // Spielte der Messpunkt sie zusätzlich ab, überkopierte er dessen Fassung.
  it('lässt eine von Hand gezogene Karte in Ruhe', () => {
    const erg = kartenAuswahl({
      karten: [{ id: 'a', titel: 'A' }],
      stempel: { a: stempelEintrag() },
      paketDateien: ['src/api/nutzer.js'],
      gezogen: ['a']
    })
    expect(erg.uebersprungen).toEqual([{ id: 'a', grund: 'gezogen' }])
    expect(erg.laeuft).toEqual([])
  })

  // Eine Karte, die an einem früheren Messpunkt rot war, liegt beim Prüfer und
  // wird von ihm angepasst. Gemessen (22.08.2026): Ohne diese Regel legte der
  // nächste Messpunkt die Archivfassung darüber, die Notiz des Prüfers blieb
  // verwaist daneben stehen, und die Freigabe („genau EIN Prüfer") war weg.
  it('lässt eine Karte in Ruhe, die schon einem Prüfer überlassen ist', () => {
    const erg = kartenAuswahl({
      karten: [{ id: 'a', titel: 'A' }],
      stempel: { a: stempelEintrag() },
      paketDateien: ['src/api/nutzer.js'],
      gezogen: [],
      beimPruefer: ['a']
    })
    expect(erg.uebersprungen).toEqual([{ id: 'a', grund: 'beimPruefer' }])
    expect(erg.laeuft).toEqual([])
    expect(erg.nichtAbspielbar).toEqual([])
  })

  it('spielt ab, was die Dateiliste des Pakets berührt', () => {
    const erg = kartenAuswahl({
      karten: [{ id: 'a', titel: 'A' }],
      stempel: { a: stempelEintrag({ dateiListe: ['src/api/nutzer.js'] }) },
      paketDateien: ['src/api/nutzer.js'],
      gezogen: []
    })
    expect(erg.laeuft).toEqual([{ id: 'a', grund: 'betroffen' }])
  })

  it('überspringt, was das Paket nachweislich nicht berührt', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'a', titel: 'A' },
        { id: 'b', titel: 'B' },
        { id: 'c', titel: 'C' }
      ],
      stempel: {
        a: stempelEintrag({ dateiListe: ['src/api/nutzer.js'] }),
        b: stempelEintrag({ dateiListe: ['src/api/nutzer.js'] }),
        c: stempelEintrag({ dateiListe: ['src/api/nutzer.js'] })
      },
      paketDateien: ['src/oberflaeche/App.jsx'],
      gezogen: [],
      // Ohne die Rotation abzuschalten liefen zwei der drei als Gegenprobe mit.
      rotationAnzahl: 0
    })
    expect(erg.laeuft).toEqual([])
    expect(erg.uebersprungen.map((e) => e.grund)).toEqual([
      'nichtBetroffen',
      'nichtBetroffen',
      'nichtBetroffen'
    ])
  })

  it('führt im Zweifel aus: kein Paket, leeres Paket oder leere gestempelte Liste', () => {
    const karten = [{ id: 'a', titel: 'A' }]
    const stempel = { a: stempelEintrag() }
    expect(
      kartenAuswahl({ karten, stempel, paketDateien: null, gezogen: [] }).laeuft
    ).toEqual([{ id: 'a', grund: 'imZweifel' }])
    expect(kartenAuswahl({ karten, stempel, paketDateien: [], gezogen: [] }).laeuft).toEqual([
      { id: 'a', grund: 'imZweifel' }
    ])
    expect(
      kartenAuswahl({
        karten,
        stempel: { a: stempelEintrag({ dateiListe: [] }) },
        paketDateien: ['src/api/nutzer.js'],
        gezogen: []
      }).laeuft
    ).toEqual([{ id: 'a', grund: 'imZweifel' }])
  })

  it('nimmt die zwei am längsten nicht gelaufenen Karten als Gegenprobe mit', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'neu', titel: 'gerade gelaufen' },
        { id: 'alt', titel: 'lange her' },
        { id: 'nie', titel: 'noch nie' },
        { id: 'mittel', titel: 'dazwischen' }
      ],
      stempel: {
        neu: stempelEintrag({ zuletztMs: 9000 }),
        alt: stempelEintrag({ zuletztMs: 10 }),
        nie: stempelEintrag({ zuletztMs: 0 }),
        mittel: stempelEintrag({ zuletztMs: 500 })
      },
      paketDateien: ['src/oberflaeche/App.jsx'],
      gezogen: []
    })
    expect(erg.laeuft.map((e) => e.id).sort()).toEqual(['alt', 'nie'])
    expect(erg.laeuft.every((e) => e.grund === 'rotation')).toBe(true)
    expect(erg.uebersprungen.map((e) => e.id).sort()).toEqual(['mittel', 'neu'])
  })

  it('zählt einen fehlenden Zeitstempel als „noch nie gelaufen"', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'mit', titel: 'mit' },
        { id: 'ohne', titel: 'ohne' }
      ],
      stempel: {
        mit: stempelEintrag({ zuletztMs: 5 }),
        ohne: stempelEintrag({ zuletztMs: undefined })
      },
      paketDateien: ['src/oberflaeche/App.jsx'],
      gezogen: [],
      rotationAnzahl: 1
    })
    expect(erg.laeuft).toEqual([{ id: 'ohne', grund: 'rotation' }])
  })

  // Die Notbremse für den blockierten Stempel. Gemessen (22.08.2026): Ließ sich
  // stempel.json nicht schreiben, blieb zuletztMs bei allen Karten auf 0, und
  // drei Messpunkte hintereinander zogen dieselben zwei Karten — [1,2], [1,2],
  // [1,2] statt [1,2], [3,4], [5,1].
  it('stellt bei Gleichstand die Karten hintan, die in diesem Lauf schon liefen', () => {
    const alleGleich = {
      erste: stempelEintrag({ zuletztMs: 0 }),
      zweite: stempelEintrag({ zuletztMs: 0 }),
      dritte: stempelEintrag({ zuletztMs: 0 }),
      vierte: stempelEintrag({ zuletztMs: 0 })
    }
    const karten = ['erste', 'zweite', 'dritte', 'vierte'].map((id) => ({ id, titel: id }))
    const erg = kartenAuswahl({
      karten,
      stempel: alleGleich,
      paketDateien: ['src/oberflaeche/App.jsx'],
      gezogen: [],
      schonGelaufen: ['erste', 'zweite']
    })
    expect(erg.laeuft.map((e) => e.id)).toEqual(['dritte', 'vierte'])
  })

  it('lässt schon Gelaufenes nicht vor eine wirklich ältere Karte springen', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'alt', titel: 'alt' },
        { id: 'frisch', titel: 'frisch' }
      ],
      stempel: {
        alt: stempelEintrag({ zuletztMs: 10 }),
        frisch: stempelEintrag({ zuletztMs: 9000 })
      },
      paketDateien: ['src/oberflaeche/App.jsx'],
      gezogen: [],
      schonGelaufen: ['alt'],
      rotationAnzahl: 1
    })
    expect(erg.laeuft).toEqual([{ id: 'alt', grund: 'rotation' }])
  })

  it('entscheidet bei Gleichstand nach der Kartenreihenfolge', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'erste', titel: 'erste' },
        { id: 'zweite', titel: 'zweite' }
      ],
      stempel: {
        erste: stempelEintrag({ zuletztMs: 100 }),
        zweite: stempelEintrag({ zuletztMs: 100 })
      },
      paketDateien: ['src/oberflaeche/App.jsx'],
      gezogen: [],
      rotationAnzahl: 1
    })
    expect(erg.laeuft).toEqual([{ id: 'erste', grund: 'rotation' }])
  })

  it('zieht keine Karte in die Rotation, die schon betroffen ist', () => {
    const erg = kartenAuswahl({
      karten: [{ id: 'a', titel: 'A' }],
      stempel: { a: stempelEintrag({ zuletztMs: 0 }) },
      paketDateien: ['src/api/nutzer.js'],
      gezogen: []
    })
    expect(erg.laeuft).toEqual([{ id: 'a', grund: 'betroffen' }])
  })

  it('zieht keine nicht abspielbare Karte in die Rotation', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'kaputt', titel: 'ohne Stempel' },
        { id: 'gut', titel: 'gestempelt' }
      ],
      stempel: { gut: stempelEintrag({ zuletztMs: 9000 }) },
      paketDateien: ['src/oberflaeche/App.jsx'],
      gezogen: []
    })
    expect(erg.laeuft).toEqual([{ id: 'gut', grund: 'rotation' }])
    expect(erg.nichtAbspielbar).toEqual([{ id: 'kaputt', grund: 'ohneStempel' }])
  })

  // Die Notbremse je Messpunkt schneidet hinten ab. Stünde die Laufliste in
  // Kartenreihenfolge, entschiede das Alphabet, welche Prüfung seltener läuft —
  // gewollt ist, dass es die langsamsten trifft.
  it('stellt die schnellsten Karten nach vorn', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'langsam', titel: 'langsam' },
        { id: 'schnell', titel: 'schnell' },
        { id: 'mittel', titel: 'mittel' }
      ],
      stempel: {
        langsam: stempelEintrag({ dauerMs: 60000 }),
        schnell: stempelEintrag({ dauerMs: 200 }),
        mittel: stempelEintrag({ dauerMs: 5000 })
      },
      paketDateien: ['src/api/nutzer.js'],
      gezogen: []
    })
    expect(erg.laeuft.map((e) => e.id)).toEqual(['schnell', 'mittel', 'langsam'])
  })

  it('zählt eine fehlende Dauer als schnellste (sie wurde noch nie gemessen)', () => {
    const erg = kartenAuswahl({
      karten: [
        { id: 'gemessen', titel: 'gemessen' },
        { id: 'unbekannt', titel: 'unbekannt' }
      ],
      stempel: {
        gemessen: stempelEintrag({ dauerMs: 500 }),
        unbekannt: stempelEintrag({ dauerMs: undefined })
      },
      paketDateien: ['src/api/nutzer.js'],
      gezogen: []
    })
    expect(erg.laeuft.map((e) => e.id)).toEqual(['unbekannt', 'gemessen'])
  })

  it('kommt mit fehlenden Angaben zurecht, statt zu werfen', () => {
    expect(kartenAuswahl({ karten: null, stempel: null, paketDateien: null, gezogen: null })).toEqual(
      { laeuft: [], uebersprungen: [], nichtAbspielbar: [] }
    )
  })
})

describe('BAUPLAN 52 · Die Deckel sind eine Stufenliste, keine Freitextzahl', () => {
  it('kennt den Standard und hat ihn in der Auswahl', () => {
    expect(PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD).toBe(10 * 60 * 1000)
    expect(PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL).toContain(PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD)
    expect(PRUEFKARTEN_DECKEL_LAUF_STANDARD).toBe(30 * 60 * 1000)
    expect(PRUEFKARTEN_DECKEL_LAUF_WAHL).toContain(PRUEFKARTEN_DECKEL_LAUF_STANDARD)
  })

  // Dieselbe Liste für Dialog und Speichern — die Lehre aus 0.51.3: Sonst nimmt
  // der eine einen Wert an, den der andere still auf den Standard zurücksetzt.
  it('nimmt jede Stufe an und setzt alles andere auf den Standard', () => {
    for (const stufe of PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL)
      expect(pruefkartenDeckelMesspunktBereinigen(stufe)).toBe(stufe)
    expect(pruefkartenDeckelMesspunktBereinigen(7)).toBe(PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD)
    expect(pruefkartenDeckelMesspunktBereinigen('viel')).toBe(PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD)
    expect(pruefkartenDeckelMesspunktBereinigen(undefined)).toBe(
      PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD
    )

    for (const stufe of PRUEFKARTEN_DECKEL_LAUF_WAHL)
      expect(pruefkartenDeckelLaufBereinigen(stufe)).toBe(stufe)
    expect(pruefkartenDeckelLaufBereinigen(7)).toBe(PRUEFKARTEN_DECKEL_LAUF_STANDARD)
    expect(pruefkartenDeckelLaufBereinigen(null)).toBe(PRUEFKARTEN_DECKEL_LAUF_STANDARD)
  })

  it('nimmt eine als Text geschriebene Stufe an (der Dialog liefert Zeichenketten)', () => {
    expect(pruefkartenDeckelMesspunktBereinigen(String(PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL[0]))).toBe(
      PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL[0]
    )
  })
})
