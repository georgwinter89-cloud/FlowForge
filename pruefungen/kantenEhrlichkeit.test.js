// Prüfungen zur Kanten-Ehrlichkeit (BAUPLAN 34).
// Rot-vor-Grün: Die ersten beiden Fälle schlugen mit der alten Regel fehl —
// prueferKritik schnitt bei 600 Zeichen ab, und die Beanstandungen stehen laut
// Prüfer-Auftrag am ENDE des Belegs; der Bauer bekam einen Torso ohne
// Beanstandung. Der Kürzungs-Fall schlug fehl, weil hinten abgeschnitten wurde
// und damit genau die Marker-Zeilen verschwanden, die FlowForge auswertet.
import { describe, it, expect } from 'vitest'
import {
  beanstandungenHerausziehen,
  prueferKritik,
  mitteGekuerzt
} from '../src/shared/kantenRegeln.js'
import { vorfahrenDistanzen } from '../src/shared/kettenRegeln.js'
import { zeilenVergleich, dateiUnterschied, diffTextBauen, inZeilen } from '../src/shared/laufDiff.js'

const langerVorspann = 'Ich habe die Fertig-Kriterien einzeln geprüft. '.repeat(30)
const beleg =
  langerVorspann +
  '\nRot-vor-Grün: Test rot mit verfälschter Erwartung, danach grün.\n' +
  'BEANSTANDUNG (mechanisch): In js/render.js Zeile 42 steht 0.5 statt 0.05.\n' +
  'BEANSTANDUNG (grundsätzlich): Die Tunnel-Logik braucht einen Umbau.\n' +
  'PRUEFKARTE-TITEL: Tunnelfahrt\n' +
  'PRUEFKARTE: Geprüft wird, dass der Zug im Tunnel abdunkelt.\n' +
  'PRUEFUNG: FEHLGESCHLAGEN'

describe('BAUPLAN 34 · Prüferkritik vollständig statt 600 Zeichen', () => {
  it('zieht alle Beanstandungen heraus, auch weit hinter Zeichen 600', () => {
    expect(beleg.indexOf('BEANSTANDUNG')).toBeGreaterThan(600)
    const kritik = prueferKritik(beleg)
    expect(kritik.anzahl).toBe(2)
    expect(kritik.rueckfall).toBe(false)
    expect(kritik.text).toContain('0.5 statt 0.05')
    expect(kritik.text).toContain('Tunnel-Logik braucht einen Umbau')
  })

  it('hält eine umgebrochene Beanstandung zusammen', () => {
    const funde = beanstandungenHerausziehen(
      'BEANSTANDUNG (mechanisch): Der Wert in\n  js/render.js ist falsch.\n\nsonstiger Text'
    )
    expect(funde).toEqual(['BEANSTANDUNG (mechanisch): Der Wert in js/render.js ist falsch.'])
  })

  it('erkennt Aufzählungszeichen vor der Marke', () => {
    expect(beanstandungenHerausziehen('- BEANSTANDUNG (mechanisch): Tippfehler.')).toHaveLength(1)
    expect(beanstandungenHerausziehen('1. BEANSTANDUNG (grundsätzlich): Umbau.')).toHaveLength(1)
  })

  it('meldet den Rückfall, wenn der Beleg keine einzige Marke enthält', () => {
    const kritik = prueferKritik('Der Test lief nicht durch.\nPRUEFUNG: FEHLGESCHLAGEN')
    expect(kritik.anzahl).toBe(0)
    expect(kritik.rueckfall).toBe(true)
    expect(kritik.text).toContain('Der Test lief nicht durch.')
    // Das Kanten-Gate hängt genau an dieser Null — sonst würde eine
    // Reparatur-Runde ohne Auftrag verbrannt.
    expect(kritik.text).not.toContain('FEHLGESCHLAGEN')
  })

  it('kürzt bei sehr vielen Beanstandungen sichtbar, statt still zu schneiden', () => {
    const viele = Array.from(
      { length: 40 },
      (_, i) => `BEANSTANDUNG (mechanisch): Fundstelle ${i} — ` + 'x'.repeat(200)
    ).join('\n')
    const kritik = prueferKritik(viele)
    expect(kritik.anzahl).toBe(40)
    expect(kritik.weggelassen).toBeGreaterThan(0)
    expect(kritik.text).toContain('weitere Beanstandung')
  })
})

describe('BAUPLAN 34 · Kürzung schema-bewusst (in der Mitte, nicht hinten)', () => {
  it('lässt die Marker-Zeilen am Ende überleben', () => {
    const lang = 'A'.repeat(9000) + '\nBEANSTANDUNG (mechanisch): letzte Zeile zählt.\nPRUEFUNG: FEHLGESCHLAGEN'
    const gekuerzt = mitteGekuerzt(lang, 8000)
    expect(gekuerzt.gekuerzt).toBe(true)
    expect(gekuerzt.auf).toBeLessThanOrEqual(8000)
    expect(gekuerzt.text).toContain('PRUEFUNG: FEHLGESCHLAGEN')
    expect(gekuerzt.text).toContain('BEANSTANDUNG (mechanisch): letzte Zeile zählt.')
    expect(gekuerzt.text.startsWith('AAA')).toBe(true)
    expect(gekuerzt.text).toContain('herausgekürzt')
  })

  it('lässt kurze Texte unangetastet', () => {
    const kurz = 'Alles erledigt.\nPRUEFUNG: BESTANDEN'
    expect(mitteGekuerzt(kurz, 8000)).toEqual({
      text: kurz,
      gekuerzt: false,
      von: kurz.length,
      auf: kurz.length
    })
  })

  it('behält auch ohne Marken ein Stück vom Ende', () => {
    const lang = 'A'.repeat(5000) + 'ENDE-DES-TEXTES'
    const gekuerzt = mitteGekuerzt(lang, 1000)
    expect(gekuerzt.text).toContain('ENDE-DES-TEXTES')
    expect(gekuerzt.auf).toBeLessThanOrEqual(1000)
  })
})

describe('BAUPLAN 34 · Fan-out ohne Datenverlust', () => {
  const bloecke = [
    { instanzId: 'paket' },
    { instanzId: 'angreifer1' },
    { instanzId: 'angreifer2' },
    { instanzId: 'bauer' }
  ]
  const pfeile = [
    { von: 'paket', nach: 'angreifer1' },
    { von: 'paket', nach: 'angreifer2' },
    { von: 'angreifer1', nach: 'bauer' },
    { von: 'angreifer2', nach: 'bauer' }
  ]

  it('gibt beiden parallelen Angreifern dieselbe Distanz zum Bauer', () => {
    const distanz = vorfahrenDistanzen(bloecke, pfeile, 'bauer')
    expect(distanz.get('angreifer1')).toBe(1)
    expect(distanz.get('angreifer2')).toBe(1)
    // Der gemeinsame Vorfahre ist weiter weg — dort gilt weiter
    // „näherer Vorfahre gewinnt".
    expect(distanz.get('paket')).toBe(2)
  })

  it('nimmt in einer geraden Kette immer die kürzeste Distanz', () => {
    const kette = [{ instanzId: 'a' }, { instanzId: 'b' }, { instanzId: 'c' }]
    const kanten = [
      { von: 'a', nach: 'b' },
      { von: 'b', nach: 'c' }
    ]
    const distanz = vorfahrenDistanzen(kette, kanten, 'c')
    expect(distanz.get('b')).toBe(1)
    expect(distanz.get('a')).toBe(2)
  })
})

describe('BAUPLAN 34 · Diff der bisherigen Runden', () => {
  it('zählt geänderte Zeilen und zeigt die Stelle mit Umgebung', () => {
    const alt = inZeilen('eins\nzwei\ndrei\nvier\nfuenf\nsechs')
    const neu = inZeilen('eins\nzwei\nDREI\nvier\nfuenf\nsechs')
    const vergleich = zeilenVergleich(alt, neu)
    expect(vergleich.plus).toBe(1)
    expect(vergleich.minus).toBe(1)
    expect(vergleich.stellen).toHaveLength(1)
    const zeilen = vergleich.stellen[0].zeilen.map((z) => z.art + z.text)
    expect(zeilen).toContain('-drei')
    expect(zeilen).toContain('+DREI')
    expect(zeilen).toContain(' zwei')
    expect(vergleich.stellen[0].abZeile).toBe(1)
  })

  it('meldet eine unveränderte Datei als leer', () => {
    const gleich = inZeilen('eins\nzwei')
    expect(zeilenVergleich(gleich, gleich)).toMatchObject({ plus: 0, minus: 0, stellen: [] })
  })

  it('kennzeichnet neue, geänderte und gelöschte Dateien', () => {
    expect(dateiUnterschied('a.js', null, { text: 'neu' })).toMatchObject({ art: 'neu', plus: 1 })
    expect(dateiUnterschied('b.js', { text: 'weg' }, null)).toMatchObject({
      art: 'geloescht',
      minus: 1
    })
    expect(dateiUnterschied('c.js', { binaer: true }, { binaer: true })).toMatchObject({
      art: 'geaendert',
      binaer: true,
      stellen: []
    })
  })

  it('baut einen gedeckelten Text mit Dateiliste und Ausschnitten', () => {
    const dateien = [
      dateiUnterschied('js/render.js', { text: 'a\nb\nc' }, { text: 'a\nB\nc' }),
      dateiUnterschied('js/neu.js', null, { text: 'hallo' })
    ]
    const text = diffTextBauen(dateien, { deckel: 6000 })
    expect(text).toContain('- js/render.js — geändert (+1/−1)')
    expect(text).toContain('- js/neu.js — neu (+1)')
    expect(text).toContain('Die geänderten Stellen:')
    expect(text).toContain('+B')
  })

  it('hält den Deckel ein und sagt, was weggelassen wurde', () => {
    const gross = Array.from({ length: 200 }, (_, i) => 'zeile ' + i).join('\n')
    const dateien = [dateiUnterschied('gross.txt', { text: gross }, { text: gross.toUpperCase() })]
    const text = diffTextBauen(dateien, { deckel: 400 })
    expect(text.length).toBeLessThan(900)
    expect(text).toContain('zu groß für')
  })

  it('vermerkt einen schon beim Start veränderten Ordner ehrlich', () => {
    const text = diffTextBauen([dateiUnterschied('a.js', { text: 'x' }, { text: 'y' })], {
      verschmutzt: true
    })
    expect(text).toContain('schon\nverändert'.replace('\n', ' '))
  })
})
