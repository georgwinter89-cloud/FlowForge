// Prüfungen zum Lieferschein (BAUPLAN 42): Blockergebnisse als geprüfte Felder,
// harter Schnitt bei den Marker-Zeilen.
// Rot-vor-Grün: Alle Fälle hier schlugen vor dem Bauschritt fehl — es gab
// weder src/shared/lieferschein.js noch das Melde-Werkzeug, und pruefeWerkzeug
// ließ ein mcp__lieferschein__-Werkzeug als „unbekanntes Werkzeug" durch die
// Rückfrage-Schleife. Beim Nachbauen wurden die Erwartungen zusätzlich einzeln
// verfälscht (z.B. „Urteil fehlgeschlagen ohne Beanstandung wird angenommen")
// und liefen dann nachweislich rot.
import { describe, it, expect } from 'vitest'
import {
  FESTE_TEILE,
  RAHMEN_WERKZEUG,
  WERKZEUG_PRAEFIX,
  FAZIT_MAX,
  BEANSTANDUNG_MAX,
  LISTE_MAX,
  werkzeugeFuerBlock,
  werkzeugeFuerKette,
  etikettFuerWerkzeug,
  rahmenEtikett,
  meldungPruefen,
  meldungVollstaendig,
  fehlendeLieferungen,
  lieferscheinText,
  urteilAusMeldungen,
  beanstandungenAusMeldungen,
  beanstandungenEinstufen,
  pruefkarteAusMeldungen
} from '../src/shared/lieferschein.js'
import { blockDefinition, BLOCK_KATALOG } from '../src/shared/blockKatalog.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'

const rahmen = { fazit: 'Alles erledigt.', getan: ['Datei angelegt'], offen: [], anmerkung: '' }

describe('BAUPLAN 42 · Ein Werkzeug je liefert-Etikett', () => {
  it('gibt dem Prüfer sein Prüfbeleg-Werkzeug und sonst keines', () => {
    const werkzeuge = werkzeugeFuerBlock(blockDefinition('pruefer'))
    expect([...werkzeuge]).toEqual([FESTE_TEILE['Prüfbeleg'].werkzeug])
  })

  it('gibt Blöcken ohne festes Etikett den Rahmen', () => {
    // Sessionende liefert nichts, Spec-Interview liefert den bewusst locker
    // gehaltenen Projekt-Überblick — beide melden über den Rahmen.
    expect([...werkzeugeFuerBlock(blockDefinition('sessionende'))]).toEqual([RAHMEN_WERKZEUG])
    expect([...werkzeugeFuerBlock(blockDefinition('spec-interview'))]).toEqual([RAHMEN_WERKZEUG])
  })

  it('registriert für eine Kette genau die Werkzeuge, die sie braucht', () => {
    const kette = ['paket-schneiden', 'angreifer', 'bauer', 'pruefer', 'sessionende'].map(
      blockDefinition
    )
    const werkzeuge = werkzeugeFuerKette(kette)
    expect(werkzeuge).toContain('melde_arbeitspaket')
    expect(werkzeuge).toContain('melde_angriffsliste')
    expect(werkzeuge).toContain('melde_umsetzungsbericht')
    expect(werkzeuge).toContain('melde_pruefbeleg')
    expect(werkzeuge).toContain(RAHMEN_WERKZEUG)
    // Kein Audit in der Kette → auch kein Befundlisten-Werkzeug.
    expect(werkzeuge).not.toContain('melde_befundliste')
  })

  it('ordnet die Meldung dem Etikett des Blocks zu, nicht dem Namen des Werkzeugs', () => {
    expect(etikettFuerWerkzeug(blockDefinition('angreifer'), 'melde_angriffsliste')).toBe(
      'Angriffsliste'
    )
    // Der Angreifer darf keine Befundliste melden — dafür liefert er sie nicht.
    expect(etikettFuerWerkzeug(blockDefinition('angreifer'), 'melde_befundliste')).toBeNull()
  })

  it('erkennt beim Rahmen das Etikett eindeutig, ohne dass der Agent es nennt', () => {
    expect(rahmenEtikett(blockDefinition('spec-interview'), '')).toEqual({
      etikett: 'Projekt-Überblick'
    })
    expect(rahmenEtikett(blockDefinition('sessionende'), '')).toEqual({ etikett: null })
  })

  it('verlangt bei mehreren lockeren Etiketten eine Angabe und weist Unbekanntes ab', () => {
    const eigen = { liefert: ['Notizen', 'Skizze'] }
    expect(rahmenEtikett(eigen, '').fehler).toBeTruthy()
    expect(rahmenEtikett(eigen, 'Skizze')).toEqual({ etikett: 'Skizze' })
    expect(rahmenEtikett(eigen, 'Erfundenes').fehler).toBeTruthy()
  })
})

describe('BAUPLAN 42 · Ebene 2: FlowForge prüft im Code', () => {
  it('nimmt einen vollständigen Prüfbeleg an', () => {
    const ergebnis = meldungPruefen(
      'pruefbeleg',
      {
        ...rahmen,
        urteil: 'fehlgeschlagen',
        beanstandungen: [
          { text: 'Wert falsch.', einstufung: 'mechanisch', fundort: 'js/render.js:42' }
        ]
      },
      'Prüfbeleg'
    )
    expect(ergebnis.fehler).toBeUndefined()
    expect(ergebnis.meldung.urteil).toBe('fehlgeschlagen')
    expect(ergebnis.meldung.etikett).toBe('Prüfbeleg')
  })

  // Genau die Plausibilität, die BAUPLAN 42 als Beispiel nennt.
  it('weist ein Urteil „fehlgeschlagen" ohne eine einzige Beanstandung ab', () => {
    const ergebnis = meldungPruefen(
      'pruefbeleg',
      { ...rahmen, urteil: 'fehlgeschlagen', beanstandungen: [] },
      'Prüfbeleg'
    )
    expect(ergebnis.fehler).toBeTruthy()
    expect(ergebnis.meldung).toBeUndefined()
  })

  it('weist ein bestandenes Urteil mit offenen Beanstandungen ab', () => {
    const ergebnis = meldungPruefen(
      'pruefbeleg',
      {
        ...rahmen,
        urteil: 'bestanden',
        beanstandungen: [{ text: 'Rest.', einstufung: 'mechanisch' }]
      },
      'Prüfbeleg'
    )
    expect(ergebnis.fehler).toBeTruthy()
  })

  it('weist eine unbekannte Einstufung ab — sie steuert die lokale Vorreparatur', () => {
    const ergebnis = meldungPruefen(
      'pruefbeleg',
      {
        ...rahmen,
        urteil: 'fehlgeschlagen',
        beanstandungen: [{ text: 'Wert falsch.', einstufung: 'egal' }]
      },
      'Prüfbeleg'
    )
    expect(ergebnis.fehler).toBeTruthy()
  })

  it('weist ein Arbeitspaket ohne Fertig-Kriterien ab (Kanten-Prüfung)', () => {
    const ohne = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, ziel: 'Etwas bauen', fertigKriterien: [] },
      'Arbeitspaket'
    )
    expect(ohne.fehler).toBeTruthy()
    const mit = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, ziel: 'Etwas bauen', fertigKriterien: ['Die Datei existiert.'] },
      'Arbeitspaket'
    )
    expect(mit.meldung.fertigKriterien).toHaveLength(1)
  })

  // Claudes strenger Schema-Modus kennt KEINE Längengrenzen — deshalb muss
  // FlowForge sie selbst durchsetzen, und die Ablehnung nennt die Ist-Länge.
  it('setzt die Längengrenzen durch, die das Schema nicht kennt', () => {
    const zuLang = meldungPruefen(
      'rahmen',
      { ...rahmen, fazit: 'x'.repeat(FAZIT_MAX + 1) },
      null
    )
    expect(zuLang.fehler).toContain(String(FAZIT_MAX + 1))
    const beanstandungZuLang = meldungPruefen(
      'pruefbeleg',
      {
        ...rahmen,
        urteil: 'fehlgeschlagen',
        beanstandungen: [{ text: 'y'.repeat(BEANSTANDUNG_MAX + 1), einstufung: 'mechanisch' }]
      },
      'Prüfbeleg'
    )
    expect(beanstandungZuLang.fehler).toBeTruthy()
  })

  it('deckelt die Anzahl der Einträge', () => {
    const zuViele = meldungPruefen(
      'funde',
      {
        ...rahmen,
        funde: Array.from({ length: LISTE_MAX + 1 }, (_, i) => ({
          text: 'Fund ' + i,
          schwere: 'mittel'
        }))
      },
      'Angriffsliste'
    )
    expect(zuViele.fehler).toBeTruthy()
  })

  it('lässt eine leere Fundliste zu — nichts gefunden ist ein gutes Ergebnis', () => {
    const leer = meldungPruefen('funde', { ...rahmen, funde: [] }, 'Angriffsliste')
    expect(leer.fehler).toBeUndefined()
    expect(leer.meldung.funde).toEqual([])
  })

  it('verlangt ein Fazit — es ist die Zeile im Ticker und am Block', () => {
    expect(meldungPruefen('rahmen', { fazit: '   ' }, null).fehler).toBeTruthy()
  })

  it('nimmt die Prüfkarte nur vollständig an', () => {
    const halb = meldungPruefen(
      'pruefbeleg',
      { ...rahmen, urteil: 'bestanden', pruefkarteTitel: 'Tunnelfahrt' },
      'Prüfbeleg'
    )
    expect(halb.fehler).toBeTruthy()
    const ganz = meldungPruefen(
      'pruefbeleg',
      {
        ...rahmen,
        urteil: 'bestanden',
        pruefkarteTitel: 'Tunnelfahrt',
        pruefkarteText: 'Geprüft wird, dass der Zug im Tunnel abdunkelt.'
      },
      'Prüfbeleg'
    )
    expect(ganz.meldung.pruefkarte.titel).toBe('Tunnelfahrt')
  })
})

describe('BAUPLAN 42 · Ebene 3: deckt die Lieferung den Bedarf?', () => {
  const bauer = blockDefinition('bauer')

  it('erkennt einen Block, der nichts gemeldet hat', () => {
    expect(meldungVollstaendig(bauer, [])).toBe(false)
    expect(fehlendeLieferungen(bauer, [])).toEqual(['Umsetzungsbericht'])
  })

  it('erkennt eine unvollständige Lieferung bei mehreren Etiketten', () => {
    const zwei = { liefert: ['Arbeitspaket', 'Angriffsliste'] }
    const nurEins = [{ art: 'arbeitspaket', etikett: 'Arbeitspaket', fazit: 'ok' }]
    expect(meldungVollstaendig(zwei, nurEins)).toBe(false)
    expect(fehlendeLieferungen(zwei, nurEins)).toEqual(['Angriffsliste'])
  })

  it('lässt einen Block ohne Etikett mit dem blanken Rahmen durchgehen', () => {
    const sessionende = blockDefinition('sessionende')
    expect(meldungVollstaendig(sessionende, [{ art: 'rahmen', etikett: null, fazit: 'ok' }])).toBe(
      true
    )
    // Aber gar nichts zu melden reicht auch dort nicht.
    expect(meldungVollstaendig(sessionende, [])).toBe(false)
  })
})

describe('BAUPLAN 42 · Was FlowForge aus der Meldung liest', () => {
  const beleg = {
    art: 'pruefbeleg',
    etikett: 'Prüfbeleg',
    fazit: 'Zwei Punkte offen.',
    getan: [],
    offen: [],
    anmerkung: '',
    urteil: 'fehlgeschlagen',
    beanstandungen: [
      { einstufung: 'mechanisch', text: 'Wert falsch.', fundort: 'js/render.js:42' },
      { einstufung: 'grundsaetzlich', text: 'Umbau nötig.', fundort: 'js/tunnel.js' }
    ],
    rotVorGruen: 'rot: 1 failed — grün: 3 passed',
    geprueft: ['Kriterium 1'],
    pruefkarte: { titel: 'Tunnelfahrt', text: 'Der Zug dunkelt ab.' }
  }

  it('liest das Urteil aus dem Feld', () => {
    expect(urteilAusMeldungen([beleg])).toBe(false)
    expect(urteilAusMeldungen([{ ...beleg, urteil: 'bestanden', beanstandungen: [] }])).toBe(true)
    // Kein Prüfbeleg gemeldet ist etwas anderes als „nicht bestanden".
    expect(urteilAusMeldungen([{ art: 'rahmen', fazit: 'x' }])).toBeNull()
  })

  it('liest Beanstandungen, Einstufung und Prüfkarte aus den Feldern', () => {
    expect(beanstandungenAusMeldungen([beleg])).toHaveLength(2)
    expect(beanstandungenEinstufen(beleg.beanstandungen)).toBe('grundsaetzlich')
    expect(beanstandungenEinstufen([beleg.beanstandungen[0]])).toBe('mechanisch')
    expect(beanstandungenEinstufen([])).toBe('unmarkiert')
    expect(pruefkarteAusMeldungen([beleg]).titel).toBe('Tunnelfahrt')
  })

  it('macht daraus einen lesbaren, gegliederten Text mit Fundorten', () => {
    const text = lieferscheinText(beleg)
    expect(text).toContain('Zwei Punkte offen.')
    expect(text).toContain('fehlgeschlagen')
    expect(text).toContain('js/render.js:42')
    expect(text).toContain('Umbau nötig.')
    // Die alten Marker-Zeilen sind weg — harter Schnitt.
    expect(text).not.toContain('PRUEFUNG:')
    expect(text).not.toContain('BEANSTANDUNG (')
  })
})

describe('BAUPLAN 42 · Sperren rund um die Melde-Werkzeuge', () => {
  const projekt = 'D:\\pruefungen-uebungsprojekt'
  const urteil = (werkzeug, frei) =>
    pruefeWerkzeug(
      WERKZEUG_PRAEFIX + werkzeug,
      {},
      projekt,
      // nurLesen: true — Melden ändert nichts am Projekt und muss auch für
      // nur-lesende Blöcke (Angreifer, Audit) durchgehen.
      true,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      '',
      frei
    )

  it('gibt dem Block sein eigenes Melde-Werkzeug frei — auch unter „darf nur lesen"', () => {
    expect(urteil('melde_pruefbeleg', ['melde_pruefbeleg']).erlaubt).toBe(true)
  })

  it('fragt bei einem fremden Melde-Werkzeug nach, statt hart zu sperren', () => {
    const fremd = urteil('melde_arbeitspaket', ['melde_pruefbeleg'])
    expect(fremd.erlaubt).toBeUndefined()
    expect(fremd.gesperrt).toBeUndefined()
    expect(fremd.frage).toBeTruthy()
  })
})

describe('BAUPLAN 42 · die Lauf-Verwaltung lädt mit dem Lieferschein', () => {
  // Billige Ladbarkeits-Prüfung: lauf.js hängt an einem Dutzend Exporte aus
  // lieferschein.js, kantenRegeln.js und torRegeln.js. Ein Tippfehler in einem
  // Import fällt sonst erst im echten Lauf auf — und dann mitten in der Arbeit.
  it('importiert lauf.js ohne fehlende Exporte', async () => {
    const modul = await import('../src/main/lauf.js')
    expect(typeof modul.laufStarten).toBe('function')
    expect(typeof modul.laufberichteLaden).toBe('function')
  })

  it('importiert den Werkzeug-Server ohne fehlende Exporte', async () => {
    const modul = await import('../src/main/motor/lieferscheinWerkzeuge.js')
    expect(typeof modul.lieferscheinWerkzeugServer).toBe('function')
  })
})

describe('BAUPLAN 42 · harter Schnitt in den Blockaufträgen', () => {
  it('lässt keinen Katalog-Auftrag mehr auf Marker-Zeilen bestehen', () => {
    for (const block of BLOCK_KATALOG) {
      expect(block.auftrag, block.id).not.toMatch(/PRUEFUNG:\s*(BESTANDEN|FEHLGESCHLAGEN)/)
      expect(block.auftrag, block.id).not.toContain('BEANSTANDUNG (')
      expect(block.auftrag, block.id).not.toContain('PRUEFKARTE')
    }
  })

  it('stellt auch die Übungs-Prüfer um — sonst melden sie ins Leere', () => {
    for (const id of ['pruefer-fair', 'pruefer-streng']) {
      const def = blockDefinition(id)
      expect(def.liefert).toContain('Prüfbeleg')
      expect([...werkzeugeFuerBlock(def)]).toEqual(['melde_pruefbeleg'])
      expect(def.auftrag).toMatch(/urteil/)
    }
  })
})
