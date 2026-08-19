// Prüfungen zur Lieferschein-Anbindung eigener Etiketten (BAUPLAN 48, Teil B):
// Ein eigenes Etikett MIT Feldern bekommt ein eigenes Melde-Werkzeug, FlowForge
// prüft die Felder (Ebene 2) und weist eine unvollständige Meldung sichtbar ab.
//
// Rot vor Grün — so gemessen: Vor dem Bauschritt lieferte teilFuerEtikett
// für jedes Nicht-Katalog-Etikett null (werkzeugeFuerBlock → nur melde_
// ergebnis), artFuerWerkzeug('melde_marktanalyse') → null, meldungPruefen
// ('eigen', …) → „Unbekannte Meldungsart „eigen"", und der Werkzeug-Server
// baute für ein gewünschtes melde_marktanalyse gar kein Werkzeug (gebaut.length
// 0 → null). Jede dieser vier Erwartungen schlug einzeln fehl; die Handler-
// Aufrufe unten liefen erst, als der Server das Werkzeug wirklich registrierte.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Das Agenten-SDK ist die einzige Attrappe: Es sammelt nur die Handler ein,
// damit die Prüfung das Werkzeug WIRKLICH aufrufen kann (Muster
// rollbackWirkbereich.test.js) — Schema, Prüfung und Antworten sind echt.
const sdk = vi.hoisted(() => ({ werkzeuge: new Map() }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name, beschreibung, schema, handler) => {
    sdk.werkzeuge.set(name, { beschreibung, schema, handler })
    return { name, handler }
  },
  createSdkMcpServer: (aufbau) => aufbau
}))

import {
  teilFuerEtikett,
  artFuerWerkzeug,
  etikettFuerWerkzeug,
  werkzeugeFuerBlock,
  werkzeugeFuerKette,
  lockereEtiketten,
  meldungPruefen,
  lieferscheinText,
  eigeneFelderZeilen,
  fehlendeLieferungen,
  RAHMEN_WERKZEUG
} from '../src/shared/lieferschein.js'
import { eigeneEtikettenSetzen, blockDefinition } from '../src/shared/blockKatalog.js'
import { pruefeEtikett, etikettKlartext } from '../src/shared/etikettRegeln.js'
import { lieferscheinWerkzeugServer } from '../src/main/motor/lieferscheinWerkzeuge.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

const tl = texte.lieferschein
const te = texte.lieferscheinEtiketten

// Das Etikett „Marktanalyse" mit drei Feldern — so, wie eigeneEtiketten.js es
// nach pruefeEtikett speichern würde (mit id und persistiertem Werkzeug).
const marktanalyse = {
  id: 'etikett-markt',
  ...pruefeEtikett(
    {
      name: 'Marktanalyse',
      beschreibung: 'Zielgruppe, Wettbewerber, Preisniveau',
      felder: [
        { bezeichnung: 'Zielgruppe', art: 'text', pflicht: true, hinweis: 'Für wen das Produkt ist' },
        { bezeichnung: 'Wettbewerber', art: 'liste', pflicht: false },
        { bezeichnung: 'Preisniveau', art: 'auswahl', werte: ['niedrig', 'mittel', 'hoch'], pflicht: true }
      ]
    },
    { vorhandene: [], katalogNamen: [] }
  ).etikett
}
const notizen = { id: 'etikett-notizen', name: 'Notizen', beschreibung: '', felder: [], werkzeug: null }

// Ein eigener Block, der die Marktanalyse liefert, und einer, der sie braucht.
const analyst = { id: 'eigen-analyst', name: 'Analyst', braucht: [], liefert: ['Marktanalyse'] }
const verwerter = { id: 'eigen-verwerter', name: 'Verwerter', braucht: ['Marktanalyse'], liefert: ['Notizen'] }

const rahmen = { fazit: 'Markt ist eng.', getan: ['Drei Anbieter verglichen'], offen: [], anmerkung: '' }

beforeAll(() => eigeneEtikettenSetzen([marktanalyse, notizen]))
afterAll(() => eigeneEtikettenSetzen([]))

describe('BAUPLAN 48 · eigenes Etikett mit Feldern hat einen Teil', () => {
  it('teilFuerEtikett liefert Werkzeug, Art eigen und die Form — ohne Felder nichts', () => {
    const teil = teilFuerEtikett('Marktanalyse')
    expect(teil.werkzeug).toBe('melde_marktanalyse')
    expect(teil.art).toBe('eigen')
    expect(teil.felder.map((f) => f.schluessel)).toEqual(['zielgruppe', 'wettbewerber', 'preisniveau'])
    // Schlüsselvergleich: andere Schreibweise, dasselbe Etikett.
    expect(teilFuerEtikett('marktanalyse')?.werkzeug).toBe('melde_marktanalyse')
    expect(teilFuerEtikett('Notizen')).toBeNull()
    expect(teilFuerEtikett('Prüfbeleg').art).toBe('pruefbeleg')
  })

  it('gibt dem liefernden Block sein Werkzeug statt des Rahmens', () => {
    expect([...werkzeugeFuerBlock(analyst)]).toEqual(['melde_marktanalyse'])
    expect(lockereEtiketten(analyst)).toEqual([])
    // Ein Etikett ohne Felder bleibt locker → Rahmen.
    expect([...werkzeugeFuerBlock(verwerter)]).toEqual([RAHMEN_WERKZEUG])
    expect(lockereEtiketten(verwerter)).toEqual(['Notizen'])
    const kette = werkzeugeFuerKette([analyst, verwerter, blockDefinition('pruefer')])
    expect(kette).toContain('melde_marktanalyse')
    expect(kette).toContain('melde_pruefbeleg')
    expect(kette).toContain(RAHMEN_WERKZEUG)
  })

  it('löst Art und Etikett des Werkzeugs auf', () => {
    expect(artFuerWerkzeug('melde_marktanalyse')).toBe('eigen')
    expect(artFuerWerkzeug('melde_unbekannt')).toBeNull()
    expect(etikettFuerWerkzeug(analyst, 'melde_marktanalyse')).toBe('Marktanalyse')
    expect(etikettFuerWerkzeug(verwerter, 'melde_marktanalyse')).toBeNull()
  })

  it('schaltet das eigene Werkzeug wie ein festes frei (Rechte-Rückfrage sonst)', () => {
    const frei = pruefeWerkzeug('mcp__lieferschein__melde_marktanalyse', {}, 'D:/x', false, false, true, false, false, false, false, false, '', ['melde_marktanalyse'])
    expect(frei.erlaubt).toBe(true)
    const fremd = pruefeWerkzeug('mcp__lieferschein__melde_marktanalyse', {}, 'D:/x', false, false, true, false, false, false, false, false, '', [RAHMEN_WERKZEUG])
    expect(fremd.frage).toBeTruthy()
  })
})

describe('BAUPLAN 48 · Ebene 2 prüft die eigene Form', () => {
  it('weist ein fehlendes Pflichtfeld ab', () => {
    const erg = meldungPruefen('eigen', { ...rahmen, preisniveau: 'hoch' }, 'Marktanalyse')
    // Fehlertext nennt Schlüssel UND Bezeichnung (Prüfer-Befund 48): der Agent
    // kennt den Schlüssel, Georg im Ticker die Bezeichnung.
    expect(erg.fehler).toBe(tl.feldFehlt('zielgruppe („Zielgruppe")'))
    const leer = meldungPruefen('eigen', { ...rahmen, zielgruppe: 'KMU', preisniveau: '' }, 'Marktanalyse')
    expect(leer.fehler).toBe(tl.feldFehlt('preisniveau („Preisniveau")'))
  })

  it('weist einen falschen Auswahlwert ab und speichert sonst den kanonischen (K12)', () => {
    const falsch = meldungPruefen('eigen', { ...rahmen, zielgruppe: 'KMU', preisniveau: 'teuer' }, 'Marktanalyse')
    expect(falsch.fehler).toBe(te.auswahlUngueltig('preisniveau („Preisniveau")', ['niedrig', 'mittel', 'hoch']))
    const ok = meldungPruefen('eigen', { ...rahmen, zielgruppe: 'KMU', preisniveau: 'HOCH' }, 'Marktanalyse')
    expect(ok.fehler).toBeUndefined()
    expect(ok.meldung.felder.find((f) => f.schluessel === 'preisniveau').wert).toBe('hoch')
  })

  it('nimmt eine vollständige Meldung an — selbsttragend mit Bezeichnung, Art und Wert je Feld', () => {
    const erg = meldungPruefen(
      'eigen',
      { ...rahmen, zielgruppe: '  kleine   Handwerksbetriebe ', wettbewerber: ['Alpha', '', 'Beta'], preisniveau: 'mittel' },
      'Marktanalyse'
    )
    expect(erg.fehler).toBeUndefined()
    expect(erg.meldung).toEqual({
      art: 'eigen',
      etikett: 'Marktanalyse',
      fazit: 'Markt ist eng.',
      getan: ['Drei Anbieter verglichen'],
      offen: [],
      anmerkung: '',
      felder: [
        { schluessel: 'zielgruppe', bezeichnung: 'Zielgruppe', art: 'text', wert: 'kleine Handwerksbetriebe' },
        { schluessel: 'wettbewerber', bezeichnung: 'Wettbewerber', art: 'liste', wert: ['Alpha', 'Beta'] },
        { schluessel: 'preisniveau', bezeichnung: 'Preisniveau', art: 'auswahl', wert: 'mittel' }
      ]
    })
    // Ebene 3 unverändert: Die Lieferung deckt das Etikett des Blocks.
    expect(fehlendeLieferungen(analyst, [erg.meldung])).toEqual([])
  })

  it('weist die Art eigen für ein Etikett ohne Form ab', () => {
    expect(meldungPruefen('eigen', { ...rahmen }, 'Notizen').fehler).toBe(te.etikettOhneForm('Notizen'))
  })

  it('rendert die Felder im Text und in den Anzeige-Zeilen — leere optionale weg', () => {
    const meldung = meldungPruefen(
      'eigen',
      { ...rahmen, zielgruppe: 'KMU', wettbewerber: [], preisniveau: 'hoch' },
      'Marktanalyse'
    ).meldung
    const text = lieferscheinText(meldung)
    expect(text).toContain('Zielgruppe: KMU')
    expect(text).toContain('Preisniveau: hoch')
    expect(text).not.toContain('Wettbewerber')
    expect(text).toContain(`${tl.labels.getan}:\n- Drei Anbieter verglichen`)
    expect(eigeneFelderZeilen(meldung)).toEqual([
      { bezeichnung: 'Zielgruppe', zeilen: ['KMU'] },
      { bezeichnung: 'Preisniveau', zeilen: ['hoch'] }
    ])
    // Eine Liste wird zum Abschnitt, ein mehrzeiliger Text zu Zeilen.
    const mitListe = { ...meldung, felder: [{ schluessel: 'w', bezeichnung: 'Wettbewerber', art: 'liste', wert: ['A', 'B'] }, { schluessel: 'l', bezeichnung: 'Lage', art: 'langtext', wert: 'Zeile 1\nZeile 2' }] }
    expect(lieferscheinText(mitListe)).toContain('Wettbewerber:\n- A\n- B')
    expect(eigeneFelderZeilen(mitListe)).toEqual([
      { bezeichnung: 'Wettbewerber', zeilen: ['A', 'B'] },
      { bezeichnung: 'Lage', zeilen: ['Zeile 1', 'Zeile 2'] }
    ])
  })
})

describe('BAUPLAN 48 · der Werkzeug-Server baut das eigene Werkzeug', () => {
  let block = analyst
  const meldungen = []
  const abweisungen = []

  beforeAll(async () => {
    sdk.werkzeuge.clear()
    await lieferscheinWerkzeugServer({
      werkzeuge: ['melde_marktanalyse', RAHMEN_WERKZEUG, 'melde_unbekannt'],
      holeBlock: () => ({ liefert: block.liefert }),
      aufMeldung: (m) => meldungen.push(m),
      aufAbweisung: (text) => abweisungen.push(text)
    })
  })

  it('registriert das Werkzeug mit Klartext-Beschreibung und den Feldern der Form', () => {
    expect(sdk.werkzeuge.has('melde_marktanalyse')).toBe(true)
    expect(sdk.werkzeuge.has('melde_unbekannt')).toBe(false)
    const { beschreibung, schema } = sdk.werkzeuge.get('melde_marktanalyse')
    expect(beschreibung).toBe(te.werkzeugEigen('Marktanalyse', etikettKlartext(marktanalyse)))
    expect(Object.keys(schema)).toEqual(
      expect.arrayContaining(['fazit', 'getan', 'offen', 'anmerkung', 'zielgruppe', 'wettbewerber', 'preisniveau'])
    )
    // Pflicht/optional im Schema, Auswahlwerte nur in der Beschreibung (K12).
    expect(schema.zielgruppe.isOptional()).toBe(false)
    expect(schema.wettbewerber.isOptional()).toBe(true)
    expect(schema.preisniveau.description).toContain('Auswahl: niedrig, mittel, hoch')
    expect(schema.zielgruppe.description).toContain('Für wen das Produkt ist')
  })

  it('weist eine unvollständige Eingabe sichtbar ab (isError + aufAbweisung)', async () => {
    const { handler } = sdk.werkzeuge.get('melde_marktanalyse')
    const antwort = await handler({ ...rahmen, zielgruppe: 'KMU', preisniveau: 'teuer' })
    expect(antwort.isError).toBe(true)
    expect(antwort.content[0].text).toBe(te.auswahlUngueltig('preisniveau („Preisniveau")', ['niedrig', 'mittel', 'hoch']))
    expect(abweisungen).toEqual([te.auswahlUngueltig('preisniveau („Preisniveau")', ['niedrig', 'mittel', 'hoch'])])
    expect(meldungen).toEqual([])
  })

  it('nimmt eine vollständige Eingabe an und reicht die Meldung weiter (aufMeldung)', async () => {
    const { handler } = sdk.werkzeuge.get('melde_marktanalyse')
    const antwort = await handler({ ...rahmen, zielgruppe: 'KMU', wettbewerber: ['Alpha'], preisniveau: 'hoch' })
    expect(antwort.isError).toBeUndefined()
    expect(antwort.content[0].text).toBe(tl.angenommen('Marktanalyse'))
    expect(meldungen.length).toBe(1)
    expect(meldungen[0].art).toBe('eigen')
    expect(meldungen[0].etikett).toBe('Marktanalyse')
    expect(meldungen[0].felder.map((f) => f.wert)).toEqual(['KMU', ['Alpha'], 'hoch'])
  })

  it('ordnet das Werkzeug nur einem Block zu, der das Etikett liefert', async () => {
    block = verwerter
    const { handler } = sdk.werkzeuge.get('melde_marktanalyse')
    const antwort = await handler({ ...rahmen, zielgruppe: 'KMU', preisniveau: 'hoch' })
    expect(antwort.isError).toBe(true)
    block = analyst
  })
})
