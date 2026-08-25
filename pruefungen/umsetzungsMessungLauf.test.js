// Gemessen statt geglaubt (Bauschritt 55), Lauf-Seite: Die Dateiliste des
// Umsetzungsberichts wird an den Sicherungspunkten nachgemessen — hier laufen
// die lauf-nahen Rechnungen als reine, exportierte Helfer (ohne Motor, ohne
// JSX): der Verwaltungsdateien-Filter, das arbeitsablage-Abbild samt Diff, der
// Zusammenbau von m.gemessen und die Ticker-/Anzeige-Wortlaute. Dazu die
// Laufstand-Runde (speichern → laden) für die vereinigte Messung und
// Quelltext-Zusicherungen, dass die Messung an JEDER Schließstelle des
// Strangs hängt (dasselbe Muster wie rollbackWirkbereich.test.js).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'
import {
  messungVerwaltungAusfiltern,
  arbeitsablageAbbild,
  gemessenErgebnisBauen
} from '../src/main/lauf.js'
import { arbeitsablageAbgleich } from '../src/shared/lieferschein.js'
import { laufstandSpeichern, laufstandLaden } from '../src/main/laufstand.js'
import { texte } from '../src/shared/texte.js'

const hier = path.dirname(url.fileURLToPath(import.meta.url))
const laufQuelle = fs.readFileSync(path.join(hier, '..', 'src', 'main', 'lauf.js'), 'utf8')

function scratchOrdner() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-messung-'))
}

describe('Verwaltungsdateien fallen aus der Messung', () => {
  it('filtert FlowForges eigene Dateien und alles unter laufberichte/, den Rest nicht', () => {
    const gemessen = messungVerwaltungAusfiltern([
      { pfad: 'laufstand.json', art: 'geaendert' },
      { pfad: 'karten.json', art: 'geaendert' },
      { pfad: 'laufberichte/lauf-2026.json', art: 'neu' },
      { pfad: 'src/app.js', art: 'geaendert' },
      { pfad: 'projekt.json', art: 'geaendert' },
      { pfad: 'workflow.json', art: 'geaendert' },
      { pfad: 'startanleitung.json', art: 'neu' },
      { pfad: 'naechster-lauf.json', art: 'neu' },
      { pfad: 'chat.json', art: 'geaendert' },
      { pfad: 'pruefbefehl.json', art: 'neu' },
      { pfad: 'doku/projekt.json', art: 'neu' }
    ])
    expect(gemessen.map((e) => e.pfad)).toEqual(['src/app.js', 'doku/projekt.json'])
  })

  it('vergleicht auf normalisierten Pfaden (Backslash, ./, Großschreibung)', () => {
    const gemessen = messungVerwaltungAusfiltern([
      { pfad: '.\\Laufberichte\\bericht.json', art: 'neu' },
      { pfad: './LAUFSTAND.JSON', art: 'geaendert' },
      { pfad: 'src\\haupt.js', art: 'neu' }
    ])
    expect(gemessen.map((e) => e.pfad)).toEqual(['src\\haupt.js'])
  })
})

describe('arbeitsablage-Abbild und Diff', () => {
  it('fehlender Ordner ergibt still ein leeres Abbild', () => {
    const projekt = scratchOrdner()
    expect(arbeitsablageAbbild(projekt)).toEqual({})
  })

  it('erkennt neu, geändert und gelöscht über zwei Abbilder — rekursiv', () => {
    const projekt = scratchOrdner()
    const ablage = path.join(projekt, 'arbeitsablage')
    fs.mkdirSync(path.join(ablage, 'unter'), { recursive: true })
    fs.writeFileSync(path.join(ablage, 'bleibt.txt'), 'unverändert')
    fs.writeFileSync(path.join(ablage, 'waechst.txt'), 'kurz')
    fs.writeFileSync(path.join(ablage, 'unter', 'faellt.txt'), 'weg damit')
    const vorher = arbeitsablageAbbild(projekt)
    expect(Object.keys(vorher).sort()).toEqual(['bleibt.txt', 'unter/faellt.txt', 'waechst.txt'])
    // Größe ODER Zeitstempel zählen — die Größenänderung reicht, keine
    // Sub-Sekunden-Wette auf mtime (siehe laufDiffPunkte.test.js).
    fs.writeFileSync(path.join(ablage, 'waechst.txt'), 'deutlich länger als vorher')
    fs.rmSync(path.join(ablage, 'unter', 'faellt.txt'))
    fs.writeFileSync(path.join(ablage, 'frisch.txt'), 'neu hier')
    const nachher = arbeitsablageAbbild(projekt)
    const diff = arbeitsablageAbgleich(vorher, nachher)
    expect(diff).toEqual([
      { pfad: 'frisch.txt', art: 'neu' },
      { pfad: 'unter/faellt.txt', art: 'geloescht' },
      { pfad: 'waechst.txt', art: 'geaendert' }
    ])
  })
})

describe('m.gemessen-Zusammenbau (gemessenErgebnisBauen)', () => {
  it('trennt Kern- und arbeitsablage-Einträge und gleicht gegen die Meldung ab', () => {
    const gemessen = gemessenErgebnisBauen({
      vereinigt: [
        { pfad: 'src/app.js', art: 'geaendert' },
        { pfad: 'src/neu.js', art: 'neu' },
        { pfad: 'arbeitsablage/probe.mjs', art: 'neu' }
      ],
      gemeldet: [
        { pfad: 'src/app.js', art: 'geaendert' },
        { pfad: 'src/erfunden.js', art: 'neu' },
        { pfad: 'arbeitsablage/probe.mjs', art: 'neu' }
      ]
    })
    expect(gemessen.ok).toBe(true)
    expect(gemessen.dateien).toEqual([
      { pfad: 'src/app.js', art: 'geaendert' },
      { pfad: 'src/neu.js', art: 'neu' }
    ])
    expect(gemessen.arbeitsablage).toEqual([{ pfad: 'arbeitsablage/probe.mjs', art: 'neu' }])
    expect(gemessen.arbeitsablageGrund).toBeUndefined()
    // Die beiden Abweichungszeilen: erfunden ist nur gemeldet, neu.js nur gemessen.
    expect(gemessen.nurGemeldet).toEqual(['src/erfunden.js'])
    expect(gemessen.nurGemessen).toEqual(['src/neu.js'])
    // Kein Integrator: das Flag wird gar nicht erst geschrieben.
    expect('uebernimmtFremdes' in gemessen).toBe(false)
  })

  it('Überlappung: arbeitsablage wird null mit Grund, die Kern-Messung bleibt', () => {
    const gemessen = gemessenErgebnisBauen({
      vereinigt: [{ pfad: 'src/app.js', art: 'geaendert' }],
      arbeitsablageUnzuordenbar: true,
      gemeldet: [
        { pfad: 'src/app.js', art: 'geaendert' },
        { pfad: 'arbeitsablage/probe.mjs', art: 'neu' }
      ]
    })
    expect(gemessen.ok).toBe(true)
    expect(gemessen.arbeitsablage).toBeNull()
    expect(gemessen.arbeitsablageGrund).toBe('parallel liefen weitere schreibende Blöcke')
    expect(gemessen.dateien).toEqual([{ pfad: 'src/app.js', art: 'geaendert' }])
    // Der gemeldete arbeitsablage-Pfad fliegt aus dem Abgleich: „gemeldet,
    // aber nicht angefasst" wäre ein Urteil ohne Messung.
    expect(gemessen.nurGemeldet).toEqual([])
    expect(gemessen.nurGemessen).toEqual([])
  })

  it('Integrator: uebernimmtFremdes wird an der Meldung persistiert', () => {
    const gemessen = gemessenErgebnisBauen({
      vereinigt: [],
      gemeldet: [{ pfad: 'src/fremd.js', art: 'neu' }],
      uebernimmtFremdes: true
    })
    expect(gemessen.uebernimmtFremdes).toBe(true)
    expect(gemessen.nurGemeldet).toEqual(['src/fremd.js'])
  })

  it('das ok:false-Datenmodell trägt die Vertrags-Gründe wörtlich', () => {
    // Der ok:false-Zusammenbau selbst ist eine Zeile im Ablaufplaner —
    // gemessen wird hier, dass die gespeicherten Gründe wörtlich stimmen:
    // Sie stehen später als m.gemessen.grund im Laufbericht.
    expect(texte.lieferschein.gemessen.gruende.keinStrang).toBe('kein eigener Sicherungsstrang')
    expect(texte.lieferschein.gemessen.gruende.diffGescheitert).toBe(
      'der Vergleich der Sicherungspunkte ist fehlgeschlagen'
    )
    expect(texte.lieferschein.gemessen.gruende.nichtZusammengefuehrt).toBe(
      'der Sicherungsstrang ließ sich nicht mit dem gemeinsamen Stand zusammenführen'
    )
  })
})

describe('Laufstand-Runde: gemessenDateien überleben speichern → laden', () => {
  it('die vereinigte Messung samt Unzuordenbar-Flag kommt unverändert zurück', () => {
    const projekt = scratchOrdner()
    laufstandSpeichern(projekt, {
      kettenIds: ['block-1'],
      fertigIds: [],
      gemessenDateien: [
        [
          'block-1',
          {
            dateien: [
              { pfad: 'src/app.js', art: 'geaendert' },
              { pfad: 'arbeitsablage/probe.mjs', art: 'neu' }
            ],
            arbeitsablageUnzuordenbar: false
          }
        ]
      ]
    })
    const geladen = laufstandLaden(projekt)
    expect(geladen.gemessenDateien).toEqual([
      [
        'block-1',
        {
          dateien: [
            { pfad: 'src/app.js', art: 'geaendert' },
            { pfad: 'arbeitsablage/probe.mjs', art: 'neu' }
          ],
          arbeitsablageUnzuordenbar: false
        }
      ]
    ])
  })

  it('alte Laufstände ohne das Feld bleiben ladbar — die Messung beginnt leer', () => {
    const projekt = scratchOrdner()
    laufstandSpeichern(projekt, { kettenIds: ['block-1'], fertigIds: [] })
    const geladen = laufstandLaden(projekt)
    expect(geladen).not.toBeNull()
    expect(geladen.gemessenDateien).toBeUndefined()
    // Und die Wiederaufnahme liest das Feld tolerant (Quelltext-Zusicherung).
    expect(laufQuelle).toMatch(/Array\.isArray\(fortsetzung\.gemessenDateien\)/)
  })

  it('kaputte Einträge im Feld werfen die Wiederaufnahme nicht (Befund Prüfer 1)', () => {
    // Ein von Hand korrumpierter Laufstand darf die Destrukturierung nicht
    // treffen: [null] und [42] wären bei `for (const [id, wert] of …)` ein
    // TypeError — der Leser überspringt Nicht-Paare deshalb ausdrücklich.
    expect(laufQuelle).toMatch(/if \(!Array\.isArray\(paar\)\) continue/)
  })
})

describe('Ticker-Wortlaute', () => {
  it('Messzeile ohne Abweichung', () => {
    expect(texte.ticker.dateilisteGemessen('Block 2 „Bauer"', 3, 0, 0)).toBe(
      'Block 2 „Bauer": Dateiliste gemessen: 3 Dateien angefasst.'
    )
    expect(texte.ticker.dateilisteGemessen('Block 2 „Bauer"', 1, 0, 0)).toBe(
      'Block 2 „Bauer": Dateiliste gemessen: 1 Datei angefasst.'
    )
  })

  it('Messzeile mit beiden Abweichungen', () => {
    expect(texte.ticker.dateilisteGemessen('Block 2 „Bauer"', 4, 2, 1)).toBe(
      'Block 2 „Bauer": Dateiliste gemessen: 4 Dateien angefasst · Abweichung: ' +
        '2 gemeldet, aber nicht angefasst · 1 angefasst, aber nicht gemeldet.'
    )
  })

  it('Messzeile mit nur einer Abweichung nennt nur diese', () => {
    expect(texte.ticker.dateilisteGemessen('Block 2 „Bauer"', 4, 0, 1)).toBe(
      'Block 2 „Bauer": Dateiliste gemessen: 4 Dateien angefasst · Abweichung: ' +
        '1 angefasst, aber nicht gemeldet.'
    )
  })

  it('Ungemessen-Zeile trägt den Grund — kein stilles Weglassen', () => {
    expect(
      texte.ticker.dateilisteUngemessen('Block 2 „Bauer"', texte.lieferschein.gemessen.gruende.keinStrang)
    ).toBe('Block 2 „Bauer": Dateiliste ungemessen — kein eigener Sicherungsstrang.')
  })
})

describe('Anzeige-Zeilen (reine Rechnung, kein JSX)', () => {
  it('gemessene Liste: Art je Datei, arbeitsablage-Einträge markiert', () => {
    const zeilen = texte.lieferschein.gemessen.zeilenFuer({
      ok: true,
      dateien: [
        { pfad: 'src/app.js', art: 'geaendert' },
        { pfad: 'src/neu.js', art: 'neu' }
      ],
      arbeitsablage: [{ pfad: 'arbeitsablage/probe.mjs', art: 'neu' }]
    })
    expect(zeilen).toEqual([
      'src/app.js (geändert)',
      'src/neu.js (neu)',
      'arbeitsablage/probe.mjs (neu) — arbeitsablage, verschwindet nach dem Lauf'
    ])
  })

  it('leere Messung heißt ausdrücklich „keine Datei angefasst" — nicht nichts', () => {
    expect(
      texte.lieferschein.gemessen.zeilenFuer({ ok: true, dateien: [], arbeitsablage: [] })
    ).toEqual(['Keine Datei angefasst.'])
    // arbeitsablage: null (unzuordenbar) lässt die Kern-Zeilen unberührt.
    expect(
      texte.lieferschein.gemessen.zeilenFuer({
        ok: true,
        dateien: [{ pfad: 'a.js', art: 'neu' }],
        arbeitsablage: null
      })
    ).toEqual(['a.js (neu)'])
  })

  it('die ungemessen-Zeile und die Abschnitts-Überschriften stehen fest', () => {
    const tg = texte.lieferschein.gemessen
    expect(tg.ungemessen('kein eigener Sicherungsstrang')).toBe(
      'Dateiliste ungemessen — kein eigener Sicherungsstrang.'
    )
    expect(tg.label).toBe('Gemessen (aus den Sicherungspunkten)')
    expect(tg.nurGemeldet).toBe('Gemeldet, aber nicht angefasst')
    expect(tg.nurGemessen).toBe('Angefasst, aber nicht gemeldet')
    expect(tg.nurGemeldetUebernommen).toBe(
      'Aus den gelieferten Berichten übernommen, nicht selbst angefasst'
    )
  })
})

describe('Quelltext-Zusicherungen: die Messung hängt an jeder Schließstelle', () => {
  it('beide Schließ-Wrapper messen nach der Zusammenführung', () => {
    // Dasselbe Muster wie rollbackWirkbereich.test.js: Die Planer-Schleife,
    // der Nachlauf und das Sicherheitsnetz am Laufende rufen alle
    // strangSchliessenFuer/strangEndgueltigSchliessenFuer — hängt die Messung
    // dort, hängt sie an ALLEN Aufrufstellen der Zusammenführung.
    expect(laufQuelle).toMatch(
      /async function strangSchliessenFuer\(k\) \{[\s\S]{0,400}?\}\)\s*\n\s*await umsetzungNachmessenFuer\(k\)/
    )
    expect(laufQuelle).toMatch(
      /async function strangEndgueltigSchliessenFuer\(k\) \{[\s\S]{0,400}?\}\)\s*\n\s*await umsetzungNachmessenFuer\(k\)/
    )
  })

  it('strangSchliessenAn legt beide Enden der Zusammenführung am Knoten ab', () => {
    expect(laufQuelle).toMatch(
      /k\.strangZusammengefuehrtInfo = \{ id: ergebnis\.id \?\? null, basisId: ergebnis\.basisId \?\? null \}/
    )
  })

  it('ohne Strang wird die Meldung als ungemessen gestempelt, nie still gelassen', () => {
    expect(laufQuelle).toMatch(/gruende\.keinStrang/)
    expect(laufQuelle).toMatch(/gruende\.nichtZusammengefuehrt/)
    expect(laufQuelle).toMatch(/gruende\.diffGescheitert/)
  })

  it('der Laufstand speichert die Messung neben den Meldungen', () => {
    expect(laufQuelle).toMatch(/gemessenDateien: kettenIds/)
  })

  it('diffBasis bleibt unangetastet — die Messung läuft über basisId je Anlauf', () => {
    // Kein neuer Schreibzugriff auf k.diffBasis durch die Messung: Die
    // einzigen Zuweisungen sind die bestehenden (erster Start, Prüfer-Reset,
    // Wiederaufnahme) plus der Prüfer-Reset der Zusatzbauer-Nachprüfung
    // (Bauschritt 57, E9) — derselbe „seit meinem Urteil"-Reset, nur für das
    // erneute soll-Urteil nach der Nacharbeit des Zusatzbauers.
    const zuweisungen = laufQuelle.match(/k\.diffBasis = |nk\.diffBasis = /g) ?? []
    expect(zuweisungen.length).toBeLessThanOrEqual(4)
    expect(laufQuelle).not.toMatch(/umsetzungNachmessenFuer[\s\S]{0,3000}\.diffBasis\s*=/)
  })
})
