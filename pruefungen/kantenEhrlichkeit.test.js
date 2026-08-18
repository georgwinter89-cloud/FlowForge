// Prüfungen zur Kanten-Ehrlichkeit (BAUPLAN 34), seit BAUPLAN 42 auf den
// Lieferschein umgestellt: Die Beanstandungen stehen nicht mehr als
// Marker-Zeilen im Fließtext, sondern als geprüfte Felder — prueferKritik baut
// die Rückmeldung daraus. Seit 0.46.1 ohne Deckel: alle Beanstandungen gehen
// vollständig weiter, gekürzt werden nur noch Prozess-Ausgaben (mitteGekuerzt).
import { describe, it, expect } from 'vitest'
import { prueferKritik, mitteGekuerzt } from '../src/shared/kantenRegeln.js'
import { vorfahrenDistanzen } from '../src/shared/kettenRegeln.js'
import { zeilenVergleich, dateiUnterschied, diffTextBauen, inZeilen } from '../src/shared/laufDiff.js'

const beanstandungen = [
  {
    einstufung: 'mechanisch',
    text: 'In js/render.js Zeile 42 steht 0.5 statt 0.05.',
    fundort: 'js/render.js:42'
  },
  { einstufung: 'grundsaetzlich', text: 'Die Tunnel-Logik braucht einen Umbau.', fundort: 'js/tunnel.js' }
]

describe('BAUPLAN 34/42 · Prüferkritik vollständig aus den gemeldeten Feldern', () => {
  it('reicht alle Beanstandungen mit Einstufung und Fundort weiter', () => {
    const kritik = prueferKritik(beanstandungen)
    expect(kritik.anzahl).toBe(2)
    expect(kritik.text).toContain('0.5 statt 0.05')
    expect(kritik.text).toContain('Tunnel-Logik braucht einen Umbau')
    // Einstufung und Fundort stehen mit in der Zeile — ohne sie wüsste der
    // Bauer nicht, wo er ansetzen soll.
    expect(kritik.text).toContain('mechanisch')
    expect(kritik.text).toContain('js/render.js:42')
  })

  it('meldet null Beanstandungen bei leerer Liste', () => {
    const kritik = prueferKritik([])
    expect(kritik.anzahl).toBe(0)
    expect(kritik.text).toBe('')
  })

  // 0.46.1 (Entscheidung Georg, 18.08.2026): kein Deckel mehr. Rot vor Grün:
  // Bis 0.46.0 schnitt prueferKritik bei 3.000 Zeichen ab und hängte eine
  // „(… weitere Beanstandungen passten nicht …)"-Zeile an — hier kamen von 40
  // Beanstandungen à 2.000 Zeichen nur zwei durch.
  it('reicht 40 Beanstandungen à 2.000 Zeichen vollständig weiter — ohne Kürzungszeile', () => {
    const viele = Array.from({ length: 40 }, (_, i) => ({
      einstufung: 'mechanisch',
      text: `Fundstelle ${i + 1} — ` + 'x'.repeat(2000),
      fundort: `src/datei${i + 1}.js`
    }))
    const kritik = prueferKritik(viele)
    expect(kritik.anzahl).toBe(40)
    expect(kritik.text.split('\n')).toHaveLength(40)
    for (let i = 1; i <= 40; i++) expect(kritik.text).toContain(`Fundstelle ${i} — `)
    expect(kritik.text).not.toContain('weitere Beanstandung')
    expect(kritik.text).not.toContain('gekürzt')
    expect(kritik.text.length).toBeGreaterThan(80000)
  })
})

describe('BAUPLAN 34 · Kürzung in der Mitte, nicht hinten (nur Prozess-Ausgaben)', () => {
  it('behält Anfang und Ende und sagt, wie viel wegfiel', () => {
    const lang = 'A'.repeat(9000) + 'ENDE-DES-TEXTES'
    const gekuerzt = mitteGekuerzt(lang, 8000)
    expect(gekuerzt.gekuerzt).toBe(true)
    expect(gekuerzt.auf).toBeLessThanOrEqual(8000)
    expect(gekuerzt.text.startsWith('AAA')).toBe(true)
    expect(gekuerzt.text).toContain('ENDE-DES-TEXTES')
    expect(gekuerzt.text).toContain('herausgekürzt')
  })

  it('lässt kurze Texte unangetastet', () => {
    const kurz = 'Alles erledigt.'
    expect(mitteGekuerzt(kurz, 8000)).toEqual({
      text: kurz,
      gekuerzt: false,
      von: kurz.length,
      auf: kurz.length
    })
  })

  it('hält den Deckel auch bei kleinem Platz ein', () => {
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
