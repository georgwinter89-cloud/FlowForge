// Zusatzbauer-Definitionen (BAUPLAN 57): die internen Blockdefinitionen und der
// Ausnahme-Text für prüfende Blöcke — die Schnittstelle, gegen die die
// Lauf-Mechanik programmiert. Rot vor Grün: Vor dem Bauschritt existierte
// keiner der drei Exporte (Import undefined → TypeError), der Angreifer-Auftrag
// kannte kein soll, und das Sessionende nahm keine Angriffsliste.
import { describe, it, expect } from 'vitest'
import {
  zusatzbauerDefinition,
  zusatzAngreiferDefinition,
  zusatzAusnahmeTextFuerPruefer,
  fundeAusserhalbBereinigen,
  zusatzbauerMaxBereinigen,
  FUNDE_AUSSERHALB_WAHL,
  FUNDE_AUSSERHALB_STANDARD,
  ZUSATZBAUER_MAX_STANDARD,
  BLOCK_KATALOG,
  BEFEHLS_SPERRE_SATZ,
  BEFEHLS_ERLAUBNIS_SATZ,
  auftragMitBefehlsRecht,
  blockDefinition
} from '../src/shared/blockKatalog.js'
import { SCHWEREN, ZUSATZ_URTEILE, werkzeugeFuerBlock } from '../src/shared/lieferschein.js'

const FUND = {
  soll: 'Jede Rotation legt je Aufgabe eine eigene Karte an.',
  fundort: 'aufgabenRotieren() überschreibt die Karten',
  fundpfad: 'js/daten/aufgaben.js',
  melderName: 'Block 2 „Angreifer"',
  schwere: 'hoch'
}

describe('BAUPLAN 57 · zusatzbauerDefinition', () => {
  const def = zusatzbauerDefinition(FUND)

  it('ist ein schreibender Umsetzer mit Umsetzungsbericht — kein Katalog-Eintrag', () => {
    expect(def.name).toBe('Zusatzbauer')
    expect(def.liefert).toEqual(['Umsetzungsbericht'])
    expect(def.braucht).toEqual([])
    expect(def.nurLesen).toBe(false)
    expect(def.prueft).toBe(false)
    // Klasse wie der Bauer.
    expect(def.modell).toBe(blockDefinition('bauer').modell)
    // BEWUSST nicht im Katalog: keine Palette, keine Katalog-Invarianten.
    expect(BLOCK_KATALOG.some((b) => b.id === def.id)).toBe(false)
    // Und der Lieferschein gibt ihm sein Melde-Werkzeug.
    expect([...werkzeugeFuerBlock(def)]).toEqual(['melde_umsetzungsbericht'])
  })

  it('trägt soll, Fundort, fundpfad, Melder und Schwere wörtlich im Auftrag', () => {
    for (const stueck of [FUND.soll, FUND.fundort, FUND.fundpfad, FUND.melderName])
      expect(def.auftrag).toContain(stueck)
    expect(def.auftrag).toContain('Schwere: hoch')
  })

  it('macht das soll zum EINZIGEN Fertig-Kriterium und trägt die Umsetzer-Grundregeln', () => {
    expect(def.auftrag).toContain('EINZIGES Fertig-Kriterium')
    expect(def.auftrag).toContain('AUSSCHLIESSLICH')
    // Die Grundregeln, die jeder Umsetzer im fremden Projekt braucht — am
    // Bauer-Auftrag orientiert.
    expect(def.auftrag).toContain('arbeitsablage/')
    expect(def.auftrag).toContain('pruefung/')
    expect(def.auftrag).toContain('Projektkarten')
    expect(def.auftrag).toContain('Umsetzungsbericht')
  })

  it('nimmt die Angriffsliste eines Zusatz-Angreifers optional an', () => {
    // Ohne den optionalen Bedarf bildete uebergabenAuswahl keine Gruppe — die
    // Angriffsliste des Zusatz-Angreifers käme nie an (E17).
    expect(def.brauchtOptional).toEqual(['Angriffsliste'])
    const satz = def.brauchtWozu.Angriffsliste
    expect(typeof satz).toBe('string')
    expect(satz[0]).toBe(satz[0].toLowerCase())
    expect(satz.trim().endsWith('.')).toBe(false)
  })

  it('nennt den fundpfad nicht doppelt, wenn der Fundort ihn schon trägt', () => {
    const knapp = zusatzbauerDefinition({ ...FUND, fundort: 'js/daten/aufgaben.js:12' })
    expect(knapp.auftrag).not.toContain('(Datei: js/daten/aufgaben.js)')
    expect(def.auftrag).toContain('(Datei: js/daten/aufgaben.js)')
  })

  it('kennt jede Fundschwere wörtlich — die Werte bleiben mit lieferschein.js gleich', () => {
    // blockKatalog.js darf lieferschein.js nicht importieren (Kreis über
    // kettenRegeln.js) und trägt die Schweren deshalb wörtlich — diese Prüfung
    // hält beide Mengen gleich (Muster FESTE_ETIKETTEN).
    for (const schwere of SCHWEREN)
      expect(zusatzbauerDefinition({ ...FUND, schwere }).auftrag).toContain(`Schwere: ${schwere}`)
    expect(zusatzbauerDefinition({ ...FUND, schwere: 'quatsch' }).auftrag).not.toContain('Schwere:')
  })
})

describe('BAUPLAN 57 · zusatzAngreiferDefinition', () => {
  const def = zusatzAngreiferDefinition(FUND)

  it('ist nur lesend und liefert die Angriffsliste', () => {
    expect(def.nurLesen).toBe(true)
    expect(def.prueft).toBe(false)
    expect(def.liefert).toEqual(['Angriffsliste'])
    expect(def.braucht).toEqual([])
    expect(BLOCK_KATALOG.some((b) => b.id === def.id)).toBe(false)
  })

  it('greift den GEPLANTEN Fix an: soll und Fundstelle stehen wörtlich im Auftrag', () => {
    for (const stueck of [FUND.soll, FUND.fundort, FUND.fundpfad, FUND.melderName])
      expect(def.auftrag).toContain(stueck)
    expect(def.auftrag).toContain('GEPLANTEN Fix')
  })

  it('trägt den Standard-Sperr-Satz — das Befehls-Recht aus Bauschritt 56 greift', () => {
    expect(def.auftrag).toContain(BEFEHLS_SPERRE_SATZ)
    const { auftrag, zusatzNoetig } = auftragMitBefehlsRecht(def.auftrag, true)
    expect(zusatzNoetig).toBe(false)
    expect(auftrag).toContain(BEFEHLS_ERLAUBNIS_SATZ)
  })
})

describe('BAUPLAN 57 · zusatzAusnahmeTextFuerPruefer', () => {
  const eintrag = {
    name: 'Zusatzbauer',
    melderName: 'Block 2 „Angreifer"',
    soll: FUND.soll,
    fundpfad: FUND.fundpfad,
    dateien: ['js/daten/aufgaben.js', 'pruefungen/aufgaben.test.js']
  }

  it('ohne Zusatzbauer gibt es keinen Text', () => {
    expect(zusatzAusnahmeTextFuerPruefer({ zusatzbauerListe: [] })).toBe('')
    expect(zusatzAusnahmeTextFuerPruefer({ zusatzbauerListe: null })).toBe('')
  })

  it('nennt soll, fundpfad, die zusatzUrteile-Pflicht samt Beleg und die Dateizahl', () => {
    const text = zusatzAusnahmeTextFuerPruefer({ zusatzbauerListe: [eintrag] })
    expect(text).toContain(FUND.soll)
    expect(text).toContain(FUND.fundpfad)
    expect(text).toContain('zusatzUrteile')
    expect(text).toContain('beleg')
    expect(text).toContain('Pflicht')
    expect(text).toContain('2 Dateien')
    for (const datei of eintrag.dateien) expect(text).toContain(datei)
    // Die erlaubten Urteilswerte wörtlich — gleich mit lieferschein.js.
    for (const urteil of ZUSATZ_URTEILE) expect(text).toContain(urteil)
  })

  it('sagt beides: außerhalb des Paket-Urteils UND Diff bleibt beanstandbar', () => {
    const text = zusatzAusnahmeTextFuerPruefer({ zusatzbauerListe: [eintrag] })
    expect(text).toContain('NICHT ins Feld urteil')
    expect(text).toContain('beanstanden darfst du')
    expect(text).toContain('zählen nicht gegen')
  })

  it('zählt eine einzelne Datei in der Einzahl', () => {
    const text = zusatzAusnahmeTextFuerPruefer({
      zusatzbauerListe: [{ ...eintrag, dateien: ['js/daten/aufgaben.js'] }]
    })
    expect(text).toContain('1 Datei ')
  })

  it('ohne Urteilspflicht (urteilen: false) bleibt nur die Datei-Ausnahme', () => {
    const text = zusatzAusnahmeTextFuerPruefer({
      zusatzbauerListe: [{ ...eintrag, urteilen: false }]
    })
    expect(text).toContain('KEIN zusatzUrteil')
    expect(text).not.toContain('PFLICHTGEMÄSS')
    expect(text).toContain('zählen nicht gegen')
    for (const datei of eintrag.dateien) expect(text).toContain(datei)
  })
})

describe('BAUPLAN 57 · Angreifer-Auftrag und Sessionende', () => {
  it('der Angreifer-Auftrag erklärt das soll und lässt es ehrlich leer', () => {
    const auftrag = blockDefinition('angreifer').auftrag
    expect(auftrag).toContain('Feld soll')
    expect(auftrag).toContain('Dateipfad')
    expect(auftrag).toContain('Projektgedächtnis')
    // Der Sperr-/Erlaubnis-Mechanismus aus Bauschritt 56 bleibt ungestört.
    expect(auftrag).toContain(BEFEHLS_SPERRE_SATZ)
    expect(auftragMitBefehlsRecht(auftrag, true).zusatzNoetig).toBe(false)
  })

  it('das Sessionende nimmt die Angriffsliste optional an (E16)', () => {
    const def = blockDefinition('sessionende')
    expect(def.brauchtOptional).toContain('Angriffsliste')
    expect(typeof def.brauchtWozu.Angriffsliste).toBe('string')
  })
})

describe('BAUPLAN 57 · Einstellungs-Werte an einem Wohnort', () => {
  it('fundeAusserhalb: nur die drei Wege, alles andere fällt auf den Standard', () => {
    expect(FUNDE_AUSSERHALB_WAHL).toEqual(['karte', 'mitnehmen', 'bericht'])
    for (const wert of FUNDE_AUSSERHALB_WAHL) expect(fundeAusserhalbBereinigen(wert)).toBe(wert)
    expect(fundeAusserhalbBereinigen('ignorieren')).toBe(FUNDE_AUSSERHALB_STANDARD)
    expect(fundeAusserhalbBereinigen(undefined)).toBe('karte')
  })

  it('zusatzbauerMax: ganze Zahl ≥ 0; leer ist NICHT 0, sondern Standard', () => {
    expect(zusatzbauerMaxBereinigen(0)).toBe(0)
    expect(zusatzbauerMaxBereinigen(3)).toBe(3)
    expect(zusatzbauerMaxBereinigen('2')).toBe(2)
    expect(zusatzbauerMaxBereinigen('')).toBe(ZUSATZBAUER_MAX_STANDARD)
    expect(zusatzbauerMaxBereinigen(null)).toBe(ZUSATZBAUER_MAX_STANDARD)
    expect(zusatzbauerMaxBereinigen(undefined)).toBe(ZUSATZBAUER_MAX_STANDARD)
    expect(zusatzbauerMaxBereinigen(1.5)).toBe(ZUSATZBAUER_MAX_STANDARD)
    expect(zusatzbauerMaxBereinigen(-1)).toBe(ZUSATZBAUER_MAX_STANDARD)
    expect(zusatzbauerMaxBereinigen('quatsch')).toBe(ZUSATZBAUER_MAX_STANDARD)
  })
})
