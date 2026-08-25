// Zusatzbauer für Funde des Angreifers (Bauschritt 57): die reinen Regeln —
// Fundpfad aus dem Freitext, die Weg-Entscheidung je Fund (E5/E6) und der
// mechanische Karteninhalt (E7). Alles ohne Lauf, ohne Motor, ohne Electron.
import { describe, it, expect } from 'vitest'
import {
  fundpfadAus,
  zusatzbauerEntscheidung,
  angriffsFundeAus,
  fundKartenInhalt,
  gekuerzt
} from '../src/shared/zusatzbauerRegeln.js'
import { TITEL_MAX, TEXT_MAX } from '../src/shared/kartenRegeln.js'

describe('fundpfadAus — der Dateipfad aus dem Freitext-Fundort (E4)', () => {
  it('zieht einen einfachen Pfad und schreibt ihn klein', () => {
    expect(fundpfadAus('js/Daten/Kern.js')).toBe('js/daten/kern.js')
  })
  it('nimmt das längste Pfad-Token, wenn mehrere dastehen', () => {
    expect(fundpfadAus('siehe js/app.js und js/daten/aufgabenRotieren.js')).toBe(
      'js/daten/aufgabenrotieren.js'
    )
  })
  it('kappt Zeilenangaben und Satzzeichen am Rand', () => {
    expect(fundpfadAus('(in „src/app.js:123", Zeile 123).')).toBe('src/app.js')
    expect(fundpfadAus('src/app.js:12:5,')).toBe('src/app.js')
  })
  it('vereinheitlicht Rückwärts-Schrägstriche', () => {
    expect(fundpfadAus('js\\daten\\kern.js')).toBe('js/daten/kern.js')
  })
  it('ohne Schrägstrich oder ohne Datei-Endung: kein Pfad', () => {
    expect(fundpfadAus('app.js allein')).toBe(null)
    expect(fundpfadAus('im Ordner js/daten')).toBe(null)
    expect(fundpfadAus('die Rotation ist kaputt')).toBe(null)
    expect(fundpfadAus('')).toBe(null)
    expect(fundpfadAus(null)).toBe(null)
  })
  it('Pfade aus dem Projekt hinaus zählen nicht', () => {
    expect(fundpfadAus('C:\\fremd\\datei.js')).toBe(null)
    expect(fundpfadAus('../draussen/datei.js')).toBe(null)
  })
  it('URLs und Schemata sind keine Fundpfade (Befund P1-1)', () => {
    expect(fundpfadAus('siehe https://beispiel.de/skript.js')).toBe(null)
    expect(fundpfadAus('http://a.de/x.js und file:/tmp/x.js')).toBe(null)
    // Ein echter Pfad daneben gewinnt trotzdem.
    expect(fundpfadAus('https://beispiel.de/doku.js erklärt js/kern.js')).toBe('js/kern.js')
  })
})

describe('zusatzbauerEntscheidung — die Reihenfolge der Regeln je Fund (E6)', () => {
  const fund = (fundort, soll = 'Der Test läuft grün.', schwere = 'mittel') => ({
    text: 'Etwas ist kaputt.',
    fundort,
    schwere,
    soll
  })
  const bauer = { instanzId: 'b', dateiListe: ['src/'] }

  it('zuständiger Empfänger → normaler Weg (Ordner decken Inhalte)', () => {
    const { wege } = zusatzbauerEntscheidung({
      funde: [fund('src/app.js')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(wege[0].weg).toBe('normal')
  })

  it('Empfänger ohne Dateiliste darf alles anfassen → normaler Weg', () => {
    const { wege } = zusatzbauerEntscheidung({
      funde: [fund('js/daten/kern.js')],
      empfaenger: [{ instanzId: 'b', dateiListe: null }],
      einstellung: 'mitnehmen',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(wege[0].weg).toBe('normal')
  })

  it('keine Empfänger → Karte, unabhängig von der Einstellung (E5)', () => {
    for (const einstellung of ['karte', 'mitnehmen', 'bericht']) {
      const { wege, zusatzbauer } = zusatzbauerEntscheidung({
        funde: [fund('js/daten/kern.js')],
        empfaenger: [],
        einstellung,
        obergrenze: 1,
        bereitsAngelegt: []
      })
      expect(wege[0].weg).toBe('karte')
      expect(zusatzbauer).toHaveLength(0)
    }
  })

  it('Einstellung „karte" (Standard) → Karte, kein Zusatzbauer', () => {
    const { wege, zusatzbauer } = zusatzbauerEntscheidung({
      funde: [fund('js/daten/kern.js')],
      empfaenger: [bauer],
      einstellung: 'karte',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(wege[0].weg).toBe('karte')
    expect(zusatzbauer).toHaveLength(0)
  })

  it('unbekannte Einstellung fällt auf „karte" zurück', () => {
    const { wege } = zusatzbauerEntscheidung({
      funde: [fund('js/daten/kern.js')],
      empfaenger: [bauer],
      einstellung: 'unsinn',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(wege[0].weg).toBe('karte')
  })

  it('Einstellung „bericht" → nur Laufbericht', () => {
    const { wege } = zusatzbauerEntscheidung({
      funde: [fund('js/daten/kern.js')],
      empfaenger: [bauer],
      einstellung: 'bericht',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(wege[0].weg).toBe('bericht')
  })

  it('„mitnehmen" ohne soll oder ohne Fundpfad → Karte (E6 Schritt 3)', () => {
    const { wege } = zusatzbauerEntscheidung({
      funde: [fund('js/daten/kern.js', ''), fund('kein Pfad hier')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 2,
      bereitsAngelegt: []
    })
    expect(wege.map((w) => w.weg)).toEqual(['karte', 'karte'])
  })

  it('„mitnehmen" mit Fundpfad und soll → Zusatzbauer', () => {
    const { wege, zusatzbauer } = zusatzbauerEntscheidung({
      funde: [fund('js/daten/kern.js')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(wege[0].weg).toBe('zusatzbauer')
    expect(zusatzbauer).toHaveLength(1)
    expect(zusatzbauer[0].fundpfad).toBe('js/daten/kern.js')
  })

  it('gleicher Fundpfad → EIN Zusatzbauer, soll-Sätze je Zeile, höchste Schwere', () => {
    const { wege, zusatzbauer } = zusatzbauerEntscheidung({
      funde: [
        fund('js/daten/kern.js', 'Satz eins.', 'niedrig'),
        fund('JS\\Daten\\kern.js:44', 'Satz zwei.', 'hoch')
      ],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(zusatzbauer).toHaveLength(1)
    expect(zusatzbauer[0].soll).toBe('Satz eins.\nSatz zwei.')
    expect(zusatzbauer[0].schwere).toBe('hoch')
    expect(wege.map((w) => w.weg)).toEqual(['zusatzbauer', 'zusatzbauer'])
  })

  it('Obergrenze erreicht → Karte; bereits Angelegte zählen mit (E6 Schritt 4)', () => {
    const { wege, zusatzbauer } = zusatzbauerEntscheidung({
      funde: [fund('js/a.js'), fund('js/b.js')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(zusatzbauer).toHaveLength(1)
    expect(wege.map((w) => w.weg)).toEqual(['zusatzbauer', 'karte'])

    const zweiter = zusatzbauerEntscheidung({
      funde: [fund('js/c.js')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 1,
      bereitsAngelegt: [{ fundpfad: 'js/a.js' }]
    })
    expect(zweiter.wege[0].weg).toBe('karte')
    expect(zweiter.zusatzbauer).toHaveLength(0)
  })

  it('Obergrenze 0 → nie ein Zusatzbauer, immer Karte', () => {
    const { wege, zusatzbauer } = zusatzbauerEntscheidung({
      funde: [fund('js/a.js')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 0,
      bereitsAngelegt: []
    })
    expect(zusatzbauer).toHaveLength(0)
    expect(wege[0].weg).toBe('karte')
  })

  it('für denselben Fundpfad läuft schon einer → „vorhanden", nichts Neues', () => {
    const { wege, zusatzbauer } = zusatzbauerEntscheidung({
      funde: [fund('js/a.js')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 5,
      bereitsAngelegt: [{ fundpfad: 'js/a.js' }]
    })
    expect(wege[0].weg).toBe('vorhanden')
    expect(zusatzbauer).toHaveLength(0)
  })

  it('kein Fund wird je abgewiesen: jeder Fund bekommt genau einen Weg', () => {
    const { wege } = zusatzbauerEntscheidung({
      funde: [fund('src/app.js'), fund('js/a.js'), fund('ohne Pfad'), fund('js/a.js', '')],
      empfaenger: [bauer],
      einstellung: 'mitnehmen',
      obergrenze: 1,
      bereitsAngelegt: []
    })
    expect(wege).toHaveLength(4)
    for (const w of wege) expect(['normal', 'karte', 'bericht', 'zusatzbauer', 'vorhanden']).toContain(w.weg)
  })
})

describe('angriffsFundeAus — Funde tolerant aus den Meldungen (E15)', () => {
  it('liest die letzte funde-Meldung, soll optional', () => {
    const funde = angriffsFundeAus([
      { art: 'funde', funde: [{ text: 'alt', schwere: 'hoch', fundort: '' }] },
      {
        art: 'funde',
        funde: [
          { text: 'Rotation hebelt Karte aus', schwere: 'hoch', fundort: 'js/x.js', soll: 'Soll-Satz' },
          { text: 'ohne soll', schwere: 'niedrig', fundort: '' }
        ]
      }
    ])
    expect(funde).toHaveLength(2)
    expect(funde[0].soll).toBe('Soll-Satz')
    expect(funde[1].soll).toBe('')
  })
  it('ohne funde-Meldung: leere Liste', () => {
    expect(angriffsFundeAus([{ art: 'umsetzungsbericht' }])).toEqual([])
    expect(angriffsFundeAus(null)).toEqual([])
  })
})

describe('fundKartenInhalt — mechanisch gekürzte Karte statt Abweisung (E7)', () => {
  it('Titel aus dem Fundtext, Text mit Fundort und Erkenn-Satz', () => {
    const inhalt = fundKartenInhalt({
      text: 'Die Rotation hebelt die Entscheidungs-Karte aus.',
      fundort: 'js/daten/kern.js',
      soll: 'Die Karte gilt nach der Rotation weiter.'
    })
    expect(inhalt.titel).toBe('Die Rotation hebelt die Entscheidungs-Karte aus.')
    expect(inhalt.text).toContain('Fundort: js/daten/kern.js')
    expect(inhalt.text).toContain('Woran man erkennt, dass es behoben ist: Die Karte gilt nach der Rotation weiter.')
    expect(inhalt.text).not.toContain('soll:')
  })
  it('kürzt mit Ellipse auf die Karten-Grenzen', () => {
    const lang = 'x'.repeat(1000)
    const inhalt = fundKartenInhalt({ text: lang, fundort: lang, soll: lang })
    expect(inhalt.titel.length).toBeLessThanOrEqual(TITEL_MAX)
    expect(inhalt.titel.endsWith('…')).toBe(true)
    expect(inhalt.text.length).toBeLessThanOrEqual(TEXT_MAX)
    expect(inhalt.text.endsWith('…')).toBe(true)
  })
  it('gekuerzt lässt kurze Texte unangetastet', () => {
    expect(gekuerzt('kurz', 10)).toBe('kurz')
  })
})
