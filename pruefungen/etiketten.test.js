// Prüfungen zur Etiketten-Bibliothek (BAUPLAN 48, Teil B): Etiketten als
// eigene Einträge mit Kennung, eindeutigem Namen und optionaler Form.
//
// Rot vor Grün — so gemessen: Vor dem Bauschritt gab es weder
// src/shared/etikettRegeln.js noch die Registry eigeneEtikettenSetzen/
// eigenesEtikett in blockKatalog.js — jeder Import unten schlug mit „does not
// provide an export named …" fehl. Beim Nachbauen wurden einzelne Erwartungen
// zusätzlich verfälscht (z.B. „ein Katalog-Name wird als eigenes Etikett
// angenommen", „fazit ist als Feld-Schlüssel erlaubt", „zwei Etiketten mit
// gleichem Slug bekommen dasselbe Werkzeug") und liefen nachweislich rot.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  pruefeEtikett,
  etikettWerkzeugName,
  etikettKlartext,
  feldSchluesselBereinigen,
  ETIKETT_NAME_MAX,
  FELDER_MAX,
  RESERVIERTE_SCHLUESSEL,
  WERKZEUG_SLUG_MAX
} from '../src/shared/etikettRegeln.js'
import {
  FESTE_ETIKETTEN,
  etikettNameSchluessel,
  eigeneEtikettenSetzen,
  eigeneEtikettenListe,
  eigenesEtikett,
  katalogEtiketten,
  bekannteEtiketten
} from '../src/shared/blockKatalog.js'
import { FESTE_TEILE, RAHMEN_WERKZEUG, WERKZEUG_PRAEFIX } from '../src/shared/lieferschein.js'
import { ETIKETT_MAX } from '../src/shared/blockRegeln.js'
import { texte } from '../src/shared/texte.js'

const tr = texte.etikettRegeln

beforeEach(() => eigeneEtikettenSetzen([]))
afterEach(() => eigeneEtikettenSetzen([]))

describe('BAUPLAN 48 · feste Etiketten an einer Stelle', () => {
  it('FESTE_ETIKETTEN in blockKatalog.js und FESTE_TEILE in lieferschein.js sind dieselbe Menge', () => {
    expect([...FESTE_ETIKETTEN].sort()).toEqual(Object.keys(FESTE_TEILE).sort())
  })

  it('zählt die Übungs-Etiketten zur Katalogmenge (K22), nicht zum Wortschatz', () => {
    const katalog = katalogEtiketten()
    const textdatei = katalog.find((e) => e.name === 'Textdatei')
    expect(textdatei).toBeTruthy()
    expect(textdatei.uebung).toBe(true)
    expect(bekannteEtiketten()).not.toContain('Textdatei')
    const pruefbeleg = katalog.find((e) => e.name === 'Prüfbeleg')
    expect(pruefbeleg.fest).toBe(true)
    expect(pruefbeleg.uebung).toBe(false)
    expect(pruefbeleg.blockNamen.length).toBeGreaterThan(0)
  })
})

describe('BAUPLAN 48 · Name und Eindeutigkeit', () => {
  it('vergleicht Namen ohne Groß/Klein und Mehrfach-Leerzeichen', () => {
    expect(etikettNameSchluessel('  Markt   Analyse ')).toBe('markt analyse')
    expect(etikettNameSchluessel('MARKTANALYSE')).toBe(etikettNameSchluessel('marktanalyse'))
  })

  it('nimmt ein schlichtes Etikett ohne Felder an — ohne Werkzeug', () => {
    const erg = pruefeEtikett({ name: ' Notizen ', beschreibung: 'Lose Gedanken' })
    expect(erg.fehler).toBeUndefined()
    expect(erg.etikett).toEqual({
      name: 'Notizen',
      beschreibung: 'Lose Gedanken',
      felder: [],
      werkzeug: null
    })
  })

  it('lehnt leere und zu lange Namen ab — die Grenze ist die der Block-Etiketten (K23)', () => {
    expect(ETIKETT_NAME_MAX).toBe(ETIKETT_MAX)
    expect(pruefeEtikett({ name: '  ' }).fehler).toBe(tr.nameFehlt)
    expect(pruefeEtikett({ name: 'x'.repeat(ETIKETT_NAME_MAX + 1) }).fehler).toBe(
      tr.nameZuLang(ETIKETT_NAME_MAX)
    )
  })

  it('lehnt einen Katalog-Namen ab — auch in anderer Schreibweise und bei Übungs-Etiketten', () => {
    // Feste Etiketten (Prüfer-Befund 48): kein „kopiere es" — sie sind nicht kopierbar.
    expect(pruefeEtikett({ name: 'Prüfbeleg' }).fehler).toBe(tr.nameKatalog('Prüfbeleg', true))
    expect(pruefeEtikett({ name: 'prüfbeleg' }).fehler).toBe(tr.nameKatalog('Prüfbeleg', true))
    expect(pruefeEtikett({ name: 'textdatei' }).fehler).toBe(tr.nameKatalog('Textdatei'))
  })

  it('lehnt einen schon vergebenen eigenen Namen ab, lässt aber das Etikett selbst durch', () => {
    eigeneEtikettenSetzen([{ id: 'etikett-1', name: 'Marktanalyse', felder: [], werkzeug: null }])
    expect(pruefeEtikett({ name: 'marktanalyse' }).fehler).toBe(tr.nameVergeben('Marktanalyse'))
    // Bearbeiten unter derselben id: kein Konflikt mit sich selbst.
    expect(pruefeEtikett({ id: 'etikett-1', name: 'Marktanalyse' }).fehler).toBeUndefined()
  })
})

describe('BAUPLAN 48 · Felder und Form', () => {
  const marktanalyse = {
    name: 'Marktanalyse',
    felder: [
      { bezeichnung: 'Zielgruppe', art: 'text', pflicht: true, hinweis: 'Für wen das Produkt ist' },
      { bezeichnung: 'Wettbewerber', art: 'liste' },
      { bezeichnung: 'Preisniveau', art: 'auswahl', werte: 'niedrig, mittel, hoch', pflicht: true }
    ]
  }

  it('leitet Schlüssel aus Bezeichnungen ab (Umlaute, Sonderzeichen, Länge, führende Ziffern)', () => {
    expect(feldSchluesselBereinigen('Zielgruppe')).toBe('zielgruppe')
    expect(feldSchluesselBereinigen('Größe (Äußere Maße)')).toBe('groesse_aeussere_masse')
    expect(feldSchluesselBereinigen('3. Punkt')).toBe('punkt')
    expect(feldSchluesselBereinigen('__ 12 ! ?')).toBe('')
    expect(feldSchluesselBereinigen('a'.repeat(50)).length).toBe(30)
  })

  it('normalisiert eine vollständige Form und vergibt ein Werkzeug', () => {
    const erg = pruefeEtikett(marktanalyse)
    expect(erg.fehler).toBeUndefined()
    expect(erg.etikett.werkzeug).toBe('melde_marktanalyse')
    expect(erg.etikett.felder).toEqual([
      {
        schluessel: 'zielgruppe',
        bezeichnung: 'Zielgruppe',
        art: 'text',
        werte: [],
        pflicht: true,
        hinweis: 'Für wen das Produkt ist'
      },
      { schluessel: 'wettbewerber', bezeichnung: 'Wettbewerber', art: 'liste', werte: [], pflicht: false, hinweis: '' },
      {
        schluessel: 'preisniveau',
        bezeichnung: 'Preisniveau',
        art: 'auswahl',
        werte: ['niedrig', 'mittel', 'hoch'],
        pflicht: true,
        hinweis: ''
      }
    ])
  })

  it('behält einen mitgelieferten Schlüssel (bereinigt), auch wenn die Bezeichnung sich ändert', () => {
    const erg = pruefeEtikett({
      name: 'Marktanalyse',
      felder: [{ schluessel: 'zielgruppe', bezeichnung: 'Kunden', art: 'text' }]
    })
    expect(erg.etikett.felder[0].schluessel).toBe('zielgruppe')
  })

  it('lehnt reservierte Rahmen-Schlüssel ab (K3)', () => {
    for (const reserviert of RESERVIERTE_SCHLUESSEL) {
      const erg = pruefeEtikett({ name: 'X', felder: [{ bezeichnung: reserviert, art: 'text' }] })
      expect(erg.fehler, reserviert).toBe(tr.feldSchluesselReserviert(reserviert, reserviert))
    }
    // Auch über den Umweg der Bereinigung: „Fazit" → fazit.
    expect(pruefeEtikett({ name: 'X', felder: [{ bezeichnung: 'Fazit' }] }).fehler).toBe(
      tr.feldSchluesselReserviert('Fazit', 'fazit')
    )
  })

  it('lehnt zu viele, unbezeichnete, doppelte und unbrauchbare Felder ab', () => {
    const viele = Array.from({ length: FELDER_MAX + 1 }, (_, i) => ({ bezeichnung: 'F' + i }))
    expect(pruefeEtikett({ name: 'X', felder: viele }).fehler).toBe(tr.zuVieleFelder(FELDER_MAX))
    expect(pruefeEtikett({ name: 'X', felder: [{ bezeichnung: ' ' }] }).fehler).toBe(
      tr.feldBezeichnungFehlt(1)
    )
    expect(
      pruefeEtikett({ name: 'X', felder: [{ bezeichnung: 'Ziel' }, { bezeichnung: 'ziel!' }] }).fehler
    ).toBe(tr.feldSchluesselDoppelt('ziel!', 'ziel'))
    expect(pruefeEtikett({ name: 'X', felder: [{ bezeichnung: 'Ziel', art: 'zahl' }] }).fehler).toBe(
      tr.feldArtUnbekannt('Ziel', ['text', 'langtext', 'liste', 'auswahl'])
    )
    expect(pruefeEtikett({ name: 'X', felder: [{ bezeichnung: '123' }] }).fehler).toBe(
      tr.feldSchluesselLeer('123')
    )
  })

  it('verlangt bei einer Auswahl 2 bis 12 Werte und kürzere Werte', () => {
    expect(
      pruefeEtikett({ name: 'X', felder: [{ bezeichnung: 'Stufe', art: 'auswahl', werte: ['hoch'] }] })
        .fehler
    ).toBe(tr.auswahlWerte('Stufe', 2, 12))
    expect(
      pruefeEtikett({
        name: 'X',
        felder: [{ bezeichnung: 'Stufe', art: 'auswahl', werte: ['a', 'b'.repeat(41)] }]
      }).fehler
    ).toBe(tr.auswahlWertZuLang('Stufe', 40))
    // Doppelte Werte (ohne Groß/Klein) fallen still weg.
    const erg = pruefeEtikett({
      name: 'X',
      felder: [{ bezeichnung: 'Stufe', art: 'auswahl', werte: ['Hoch', 'hoch', 'tief'] }]
    })
    expect(erg.etikett.felder[0].werte).toEqual(['Hoch', 'tief'])
  })
})

describe('BAUPLAN 48 · Werkzeugname', () => {
  it('bildet melde_ + Slug, Umlaute ausgeschrieben, ohne doppelte Unterstriche', () => {
    expect(etikettWerkzeugName('Marktanalyse')).toBe('melde_marktanalyse')
    expect(etikettWerkzeugName('Größen-Übersicht  (neu)')).toBe('melde_groessen_uebersicht_neu')
    expect(etikettWerkzeugName('!!!')).toBe('melde_etikett')
  })

  it('weicht festen Werkzeugen, dem Rahmen und vergebenen Namen mit Suffix aus', () => {
    // Ein eigenes Etikett darf „Prüfbeleg" nicht heißen — aber „Prüfbeleg!"
    // hätte denselben Slug; das Werkzeug darf trotzdem nicht kollidieren.
    expect(etikettWerkzeugName('Prüfbeleg!')).toBe('melde_pruefbeleg_2')
    expect(etikettWerkzeugName('Ergebnis')).toBe('melde_ergebnis_2')
    expect(etikettWerkzeugName('Notizen', ['melde_notizen', 'melde_notizen_2'])).toBe(
      'melde_notizen_3'
    )
    expect(RAHMEN_WERKZEUG).toBe('melde_ergebnis')
  })

  it('hält den vollen Werkzeugnamen unter 64 Zeichen (K13)', () => {
    const name = etikettWerkzeugName('ä'.repeat(80), ['melde_' + 'ae'.repeat(15)])
    expect(name.length).toBeLessThanOrEqual(6 + WERKZEUG_SLUG_MAX + 3)
    expect((WERKZEUG_PRAEFIX + name).length).toBeLessThan(64)
  })

  it('behält beim erneuten Speichern das bisherige Werkzeug, wenn der Slug passt (K13)', () => {
    const andere = [{ id: 'etikett-9', name: 'Notizen', felder: [{ schluessel: 'a' }], werkzeug: 'melde_notizen' }]
    // Beim ersten Speichern wich das Etikett „Notizen" (Kollision) auf _2 aus.
    const erst = pruefeEtikett(
      { id: 'etikett-1', name: 'Notizen ', felder: [{ bezeichnung: 'Thema' }] },
      { vorhandene: [...andere], katalogNamen: [] }
    )
    // Ein zweites Etikett gleichen Namens ist verboten — hier geht es nur um
    // den Werkzeugnamen, deshalb anderer Name mit gleichem Slug-Stamm:
    expect(erst.fehler).toBeTruthy()
    const a = pruefeEtikett(
      { id: 'etikett-1', name: 'Notizen!', felder: [{ bezeichnung: 'Thema' }] },
      { vorhandene: andere, katalogNamen: [] }
    )
    expect(a.etikett.werkzeug).toBe('melde_notizen_2')
    // Erneut speichern mit bisherigem Werkzeug, andere Kollision weg: bleibt.
    const b = pruefeEtikett(
      { id: 'etikett-1', name: 'Notizen!', werkzeug: 'melde_notizen_2', felder: [{ bezeichnung: 'Thema' }] },
      { vorhandene: [], katalogNamen: [] }
    )
    expect(b.etikett.werkzeug).toBe('melde_notizen_2')
    // Neuer Name → neuer Slug.
    const c = pruefeEtikett(
      { id: 'etikett-1', name: 'Protokoll', werkzeug: 'melde_notizen_2', felder: [{ bezeichnung: 'Thema' }] },
      { vorhandene: [], katalogNamen: [] }
    )
    expect(c.etikett.werkzeug).toBe('melde_protokoll')
    // Ohne Felder kein Werkzeug — auch wenn eines mitkommt.
    const d = pruefeEtikett({ name: 'Protokoll', werkzeug: 'melde_protokoll', felder: [] }, { vorhandene: [], katalogNamen: [] })
    expect(d.etikett.werkzeug).toBeNull()
  })
})

describe('BAUPLAN 48 · Klartext — eine Quelle für Editor, Bibliothek und Werkzeug', () => {
  it('liest eine Form in Alltagssprache vor', () => {
    const text = etikettKlartext({
      name: 'Marktanalyse',
      felder: [
        { bezeichnung: 'Zielgruppe', art: 'text', pflicht: true },
        { bezeichnung: 'Wettbewerber', art: 'liste', pflicht: false },
        { bezeichnung: 'Preisniveau', art: 'auswahl', werte: ['niedrig', 'mittel', 'hoch'], pflicht: true }
      ]
    })
    expect(text).toBe(
      'Wer „Marktanalyse" liefert, gibt an: Zielgruppe (ein Satz; Pflicht) · Wettbewerber (Liste) · ' +
        'Preisniveau (Auswahl: niedrig, mittel, hoch; Pflicht). Dazu immer Fazit, Erledigt, Offen und eine Anmerkung.'
    )
  })

  it('sagt bei einem Etikett ohne Felder, dass frei gemeldet wird', () => {
    expect(etikettKlartext({ name: 'Notizen', felder: [] })).toBe(
      'Wer „Notizen" liefert, meldet frei: Fazit, Erledigt, Offen, Anmerkung und einen Freitext.'
    )
  })
})

describe('BAUPLAN 48 · Registry und Wortschatz', () => {
  it('findet ein eigenes Etikett über den Namensschlüssel und reichert den Wortschatz an', () => {
    expect(bekannteEtiketten()).not.toContain('Marktanalyse')
    eigeneEtikettenSetzen([{ id: 'etikett-1', name: 'Marktanalyse', felder: [], werkzeug: null }])
    expect(eigeneEtikettenListe().length).toBe(1)
    expect(eigenesEtikett(' marktanalyse ')?.id).toBe('etikett-1')
    expect(eigenesEtikett('Unbekannt')).toBeNull()
    expect(bekannteEtiketten()).toContain('Marktanalyse')
  })
})
