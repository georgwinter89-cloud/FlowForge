// Prüfungen zu „Block-Editor holt auf" (BAUPLAN 48, Teil A): Ein eigener
// Block darf alle Kennzeichen des Katalogs tragen, dazu brauchtOptional und
// bis zu drei Formularfelder — und eine Verträglichkeitsprüfung lehnt die
// strukturell unerfüllbaren Kombinationen mit Klartext ab.
//
// Rot-vor-Grün, gegen den Stand vor diesem Bauschritt gemessen:
// - pruefeEigenenBlock nagelte `prueft: false` und `felder: []` fest (alte
//   Zeilen 140–143) und warf jedes andere Kennzeichen still weg: Der Rundlauf
//   „prueft gesetzt → prueft true" ergab false, „felder gesetzt → felder
//   zurück" ergab []. brauchtOptional kam gar nicht zurück (undefined).
// - KENNZEICHEN, pruefeVertraeglichkeit, feldIdBereinigen, fremdePlatzhalter,
//   kennzeichenAngleichen, PRUEFBELEG_ETIKETT existierten nicht — die Importe
//   dieser Datei schlugen fehl.
// - blockAssistent.js exportierte vorschlagSaeubern nicht, und der Säuberer
//   kannte weder kennzeichen noch felder noch begruendungen.
// - texte.blockEditor.kennzeichen gab es nicht (Name + Hinweis lagen als vier
//   Einzelschlüssel nur für nurLesen/fuehrtZusammen vor).
import { describe, it, expect, afterEach } from 'vitest'
import {
  KENNZEICHEN,
  KENNZEICHEN_ROLLE,
  KENNZEICHEN_FEINHEITEN,
  PRUEFBELEG_ETIKETT,
  FORMULARFELDER_MAX,
  FELD_ID_MAX,
  FELD_LABEL_MAX,
  feldIdBereinigen,
  fremdePlatzhalter,
  kennzeichenAngleichen,
  pruefeEigenenBlock,
  pruefeVertraeglichkeit
} from '../src/shared/blockRegeln.js'
import {
  ARBEITSPAKET_ETIKETT,
  auftragMitFeldern,
  pruefePflichtfelder
} from '../src/shared/kettenRegeln.js'
import {
  blockDefinition,
  blockKategorie,
  eigeneBloeckeSetzen,
  pruefOrdnerFuer
} from '../src/shared/blockKatalog.js'
import { werkzeugeFuerBlock } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'
import { vorschlagSaeubern, kennzeichenFuerAssistent } from '../src/main/blockAssistent.js'

const tr = texte.blockRegeln
const te = texte.blockEditor

// Ein schlichter, gültiger eigener Block als Ausgangspunkt.
const grund = {
  name: 'Test',
  auftrag: 'Tu was. Antworte auf Deutsch.',
  braucht: [],
  liefert: []
}

// Je Kennzeichen ein roher Block, der es setzt UND verträglich ist.
function vertraeglichMit(schluessel) {
  const roh = { ...grund, nurLesen: true, [schluessel]: true }
  if (schluessel === 'prueft' || schluessel === 'pruefbefehlPflicht') {
    roh.prueft = true
    roh.nurLesen = false
    roh.liefert = [PRUEFBELEG_ETIKETT]
  }
  if (schluessel === 'startanleitungPflicht') roh.nurLesen = false
  if (schluessel === 'kartenZuteilung') roh.liefert = [ARBEITSPAKET_ETIKETT]
  if (schluessel === 'fuehrtZusammen') roh.braucht = ['Umsetzungsbericht']
  return roh
}

afterEach(() => eigeneBloeckeSetzen([]))

describe('BAUPLAN 48 · Kennzeichen-Katalog eigener Blöcke', () => {
  it('kennt elf Kennzeichen in zwei Gruppen, jedes mit Name und Hinweis', () => {
    expect(KENNZEICHEN.map((k) => k.schluessel)).toEqual([
      'nurLesen',
      'prueft',
      'fuehrtZusammen',
      'pruefbefehlPflicht',
      'startanleitungPflicht',
      'kartenZuteilung',
      'erzeugtAufgaben',
      'kartenVorschlaege',
      'laufVorschlag',
      'unteraufgabenWieBlock',
      'audit'
    ])
    expect(KENNZEICHEN_ROLLE).toEqual(['nurLesen', 'prueft', 'fuehrtZusammen'])
    expect(KENNZEICHEN_FEINHEITEN).toHaveLength(8)
    for (const { schluessel } of KENNZEICHEN) {
      expect(typeof te.kennzeichen[schluessel]?.name, schluessel).toBe('string')
      expect(te.kennzeichen[schluessel].hinweis.length, schluessel).toBeGreaterThan(20)
    }
    // uebung ist kein Kennzeichen für eigene Blöcke.
    expect(KENNZEICHEN.some((k) => k.schluessel === 'uebung')).toBe(false)
  })

  it('Rundlauf: jedes gesetzte Kennzeichen kommt aus pruefeEigenenBlock zurück', () => {
    for (const { schluessel } of KENNZEICHEN) {
      const urteil = pruefeEigenenBlock(vertraeglichMit(schluessel))
      expect(urteil.fehler, schluessel).toBeUndefined()
      expect(urteil.block[schluessel], schluessel).toBe(true)
      // Und ein zweiter Durchlauf über das Ergebnis bleibt stabil.
      expect(pruefeEigenenBlock(urteil.block).block[schluessel], schluessel).toBe(true)
    }
  })

  it('Altbestand ohne Felder: alle Kennzeichen false, Listen leer, uebung/eigen fest', () => {
    const block = pruefeEigenenBlock(grund).block
    for (const { schluessel } of KENNZEICHEN) expect(block[schluessel], schluessel).toBe(false)
    expect(block.brauchtOptional).toEqual([])
    expect(block.felder).toEqual([])
    expect(block.uebung).toBe(false)
    expect(block.eigen).toBe(true)
    expect(block.darfKartenAnlegen).toBe(false)
  })

  it('darfKartenAnlegen folgt erzeugtAufgaben — auch bei „nur lesen"', () => {
    const block = pruefeEigenenBlock({ ...grund, nurLesen: true, erzeugtAufgaben: true }).block
    expect(block.erzeugtAufgaben).toBe(true)
    expect(block.darfKartenAnlegen).toBe(true)
    expect(block.nurLesen).toBe(true)
    expect(pruefeEigenenBlock({ ...grund, darfKartenAnlegen: true }).block.darfKartenAnlegen).toBe(
      false
    )
  })
})

describe('BAUPLAN 48 · Verträglichkeitsprüfung', () => {
  const ok = (block) => expect(pruefeVertraeglichkeit(block)).toBeNull()

  it('1 · führt zusammen braucht ein Pflicht-Etikett', () => {
    expect(pruefeVertraeglichkeit({ fuehrtZusammen: true, braucht: [], liefert: [] })).toBe(
      tr.fuehrtZusammenOhneBraucht
    )
    ok({ fuehrtZusammen: true, braucht: ['X'], liefert: [] })
  })

  it('2 · Prüfer darf nicht „nur lesen"', () => {
    expect(
      pruefeVertraeglichkeit({ prueft: true, nurLesen: true, liefert: [PRUEFBELEG_ETIKETT] })
    ).toBe(tr.prueftNurLesen)
    ok({ prueft: true, nurLesen: false, liefert: [PRUEFBELEG_ETIKETT] })
  })

  it('3 · Prüfer muss „Prüfbeleg" liefern', () => {
    expect(pruefeVertraeglichkeit({ prueft: true, nurLesen: false, liefert: ['Bericht'] })).toBe(
      tr.prueftOhnePruefbeleg(PRUEFBELEG_ETIKETT)
    )
    ok({ prueft: true, nurLesen: false, liefert: ['Bericht', PRUEFBELEG_ETIKETT] })
  })

  it('4 · Prüfbefehl-Pflicht nur für Prüfer', () => {
    expect(pruefeVertraeglichkeit({ pruefbefehlPflicht: true, prueft: false, liefert: [] })).toBe(
      tr.pruefbefehlOhnePrueft
    )
    ok({ pruefbefehlPflicht: true, prueft: true, nurLesen: false, liefert: [PRUEFBELEG_ETIKETT] })
  })

  it('5 · Startanleitungs-Pflicht nicht bei „nur lesen"', () => {
    expect(pruefeVertraeglichkeit({ startanleitungPflicht: true, nurLesen: true, liefert: [] })).toBe(
      tr.startanleitungNurLesen
    )
    ok({ startanleitungPflicht: true, nurLesen: false, liefert: [] })
  })

  it('6 · Karten zuteilen verlangt „Arbeitspaket" in liefert', () => {
    expect(pruefeVertraeglichkeit({ kartenZuteilung: true, liefert: ['Plan'] })).toBe(
      tr.kartenZuteilungOhneArbeitspaket(ARBEITSPAKET_ETIKETT)
    )
    ok({ kartenZuteilung: true, liefert: [ARBEITSPAKET_ETIKETT] })
  })

  it('7 · jedes Formularfeld muss als {{id}} im Auftrag stehen', () => {
    const felder = [{ id: 'wunsch', label: 'Wunsch' }]
    expect(pruefeVertraeglichkeit({ auftrag: 'Bau das.', felder, liefert: [] })).toBe(
      tr.feldOhnePlatzhalter('Wunsch', 'wunsch')
    )
    ok({ auftrag: 'Bau das: {{wunsch}}', felder, liefert: [] })
  })

  it('greift auch über pruefeEigenenBlock — nach der Feldprüfung', () => {
    expect(pruefeEigenenBlock({ ...grund, prueft: true, nurLesen: true }).fehler).toBe(
      tr.prueftNurLesen
    )
    // Feld-Formfehler kommt VOR der Verträglichkeit.
    expect(
      pruefeEigenenBlock({ ...grund, prueft: true, nurLesen: true, felder: [{ label: '' }] }).fehler
    ).toBe(tr.feldLabelFehlt)
  })

  it('kennzeichenAngleichen zieht die Komfort-Folgen nach, entfernt aber nichts', () => {
    const neu = kennzeichenAngleichen({ prueft: true, nurLesen: true, liefert: ['Bericht'] })
    expect(neu.nurLesen).toBe(false)
    expect(neu.liefert).toEqual(['Bericht', PRUEFBELEG_ETIKETT])
    const zuteilung = kennzeichenAngleichen({ kartenZuteilung: true, liefert: [] })
    expect(zuteilung.liefert).toEqual([ARBEITSPAKET_ETIKETT])
    const pflicht = kennzeichenAngleichen({ pruefbefehlPflicht: true, nurLesen: true, liefert: [] })
    expect(pflicht.prueft).toBe(true)
    expect(pflicht.nurLesen).toBe(false)
    expect(pflicht.liefert).toEqual([PRUEFBELEG_ETIKETT])
    expect(kennzeichenAngleichen({ startanleitungPflicht: true, nurLesen: true }).nurLesen).toBe(false)
    // fuehrtZusammen ohne braucht bleibt stehen — die harte Regel begründet.
    expect(kennzeichenAngleichen({ fuehrtZusammen: true, braucht: [] }).fuehrtZusammen).toBe(true)
    // Ohne Anlass ändert sich nichts.
    const still = kennzeichenAngleichen({ nurLesen: true, liefert: ['X'] })
    expect(still.nurLesen).toBe(true)
    expect(still.liefert).toEqual(['X'])
  })
})

describe('BAUPLAN 48 · brauchtOptional', () => {
  it('kommt normalisiert zurück und darf nicht zugleich Pflicht sein', () => {
    const block = pruefeEigenenBlock({
      ...grund,
      braucht: ['Arbeitspaket'],
      brauchtOptional: [' Angriffsliste ', 'Angriffsliste', '']
    }).block
    expect(block.brauchtOptional).toEqual(['Angriffsliste'])
    expect(
      pruefeEigenenBlock({ ...grund, braucht: ['Arbeitspaket'], brauchtOptional: ['Arbeitspaket'] })
        .fehler
    ).toBe(tr.brauchtOptionalDoppelt('Arbeitspaket'))
  })

  it('das „wozu" gilt für Pflicht UND optional, Sätze zu fremden Etiketten fallen weg', () => {
    const block = pruefeEigenenBlock({
      ...grund,
      braucht: ['Arbeitspaket'],
      brauchtOptional: ['Angriffsliste'],
      brauchtWozu: {
        Arbeitspaket: 'misst daran.',
        Angriffsliste: 'arbeitet sie zuerst ein',
        Altlast: 'gibt es nicht mehr'
      }
    }).block
    expect(block.brauchtWozu).toEqual({
      Arbeitspaket: 'misst daran',
      Angriffsliste: 'arbeitet sie zuerst ein'
    })
  })
})

describe('BAUPLAN 48 · Formularfelder', () => {
  it('feldIdBereinigen: klein, Umlaute, nur a-z0-9_, Länge, keine führenden Ziffern', () => {
    expect(feldIdBereinigen('Was soll gebaut werden?')).toBe('was_soll_gebaut_werden')
    expect(feldIdBereinigen('Größe & Maße (ungefähr)')).toBe('groesse_masse_ungefaehr')
    expect(feldIdBereinigen('  123 Zahl ')).toBe('zahl')
    expect(feldIdBereinigen('___')).toBe('')
    expect(feldIdBereinigen('x'.repeat(50)).length).toBe(FELD_ID_MAX)
    expect(feldIdBereinigen('a'.repeat(FELD_ID_MAX - 1) + ' b')).toBe('a'.repeat(FELD_ID_MAX - 1))
    expect(feldIdBereinigen(null)).toBe('')
  })

  it('leitet die id aus dem Label ab und übernimmt eine mitgelieferte id eingefroren (K5)', () => {
    const roh = {
      ...grund,
      auftrag: 'Bau {{was_soll_gebaut_werden}} und beachte {{alt_id}}.',
      felder: [
        { label: 'Was soll gebaut werden?', platzhalter: ' z.B.  eine App ', pflicht: 'ja' },
        { id: 'alt_id', label: 'Umbenanntes Feld', pflicht: false }
      ]
    }
    const block = pruefeEigenenBlock(roh).block
    expect(block.felder).toEqual([
      {
        id: 'was_soll_gebaut_werden',
        label: 'Was soll gebaut werden?',
        platzhalter: 'z.B. eine App',
        pflicht: true
      },
      { id: 'alt_id', label: 'Umbenanntes Feld', platzhalter: '', pflicht: false }
    ])
  })

  it('weist Formfehler mit Klartext ab', () => {
    const mit = (felder, auftrag = grund.auftrag) =>
      pruefeEigenenBlock({ ...grund, auftrag, felder }).fehler
    expect(mit([{ label: '' }])).toBe(tr.feldLabelFehlt)
    expect(mit([{ label: 'x'.repeat(FELD_LABEL_MAX + 1) }])).toBe(tr.feldLabelZuLang(FELD_LABEL_MAX))
    expect(mit([{ label: '???' }])).toBe(tr.feldIdLeer('???'))
    expect(mit([{ label: 'Wunsch' }, { label: 'wunsch!' }])).toBe(tr.feldIdDoppelt('wunsch'))
    const vier = Array.from({ length: FORMULARFELDER_MAX + 1 }, (_, i) => ({ label: 'Feld ' + i }))
    expect(mit(vier)).toBe(tr.zuVieleFelder(FORMULARFELDER_MAX))
    // Feld ohne {{id}} im Auftrag: hart.
    expect(mit([{ label: 'Wunsch' }], 'Bau das.')).toBe(tr.feldOhnePlatzhalter('Wunsch', 'wunsch'))
  })

  it('fremde {{x}} im Auftrag sind KEIN Fehler (K6), nur ein Editor-Hinweis', () => {
    const roh = { ...grund, auftrag: 'Bau {{kunde}} mit {{wunsch}}.', felder: [{ label: 'Wunsch' }] }
    const urteil = pruefeEigenenBlock(roh)
    expect(urteil.fehler).toBeUndefined()
    expect(fremdePlatzhalter(roh.auftrag, urteil.block.felder)).toEqual(['kunde'])
    expect(fremdePlatzhalter('ohne Platzhalter', [])).toEqual([])
    expect(te.fremderPlatzhalter(['kunde'])).toContain('{{kunde}}')
  })

  it('Pflicht-Feld eines eigenen Blocks hält den Start an (pruefePflichtfelder) und wird eingesetzt', () => {
    const block = {
      id: 'eigen-felder',
      ...pruefeEigenenBlock({
        ...grund,
        name: 'Wunschblock',
        auftrag: 'Bau {{wunsch}}.',
        felder: [{ label: 'Wunsch', pflicht: true }]
      }).block
    }
    eigeneBloeckeSetzen([block])
    expect(blockDefinition('eigen-felder')).toBe(block)
    const leer = [{ instanzId: 'a', blockId: 'eigen-felder', feldWerte: {} }]
    expect(pruefePflichtfelder(leer)).toBe(texte.kette.fehlerPflichtfeld('Wunschblock', 'Wunsch'))
    const voll = [{ instanzId: 'a', blockId: 'eigen-felder', feldWerte: { wunsch: 'eine App' } }]
    expect(pruefePflichtfelder(voll)).toBeNull()
    expect(auftragMitFeldern(block, { wunsch: 'eine App' })).toBe('Bau eine App.')
  })
})

describe('BAUPLAN 48 · eigener Prüf-Block im Lauf-Gefüge', () => {
  it('zählt als Prüfer: Farbe, Prüfordner, Lieferschein-Werkzeug', () => {
    const urteil = pruefeEigenenBlock({
      ...grund,
      name: 'Mein Prüfer',
      prueft: true,
      nurLesen: false,
      pruefbefehlPflicht: true,
      liefert: [PRUEFBELEG_ETIKETT]
    })
    expect(urteil.fehler).toBeUndefined()
    const def = { id: 'eigen-pruefer', ...urteil.block }
    eigeneBloeckeSetzen([def])
    expect(blockKategorie(def)).toBe('pruefer')
    expect(pruefOrdnerFuer(def, { instanzId: 'ABC-123-xyz' })).toBe('pruefer-abc123xy')
    expect(werkzeugeFuerBlock(def).has('melde_pruefbeleg')).toBe(true)
    expect(def.pruefbefehlPflicht).toBe(true)
  })
})

describe('BAUPLAN 48 · KI-Assistent: vorschlagSaeubern', () => {
  it('macht aus einem rohen Vorschlag etwas, das pruefeEigenenBlock annimmt', () => {
    const vorschlag = vorschlagSaeubern({
      name: 'Marktprüfer',
      symbol: '🔍',
      beschreibung: 'Prüft die Marktanalyse.',
      auftrag: 'Du bist der Marktprüfer. Antworte auf Deutsch.',
      braucht: ['Marktanalyse'],
      brauchtOptional: ['Marktanalyse', 'Angriffsliste'],
      liefert: ['Bericht'],
      kennzeichen: { prueft: true, kartenZuteilung: true, nurLesen: true, fuehrtZusammen: 'ja' },
      begruendungen: { prueft: ' Er urteilt,  ob die Analyse vollständig ist. ' },
      felder: [
        { label: 'Zielgruppe', platzhalter: 'z.B. Handwerker', pflicht: true },
        { label: 'Zielgruppe', pflicht: false },
        { label: '' }
      ]
    })
    // Kennzeichen flach und Boolean, Komfort-Folgen gezogen.
    for (const { schluessel } of KENNZEICHEN) expect(typeof vorschlag[schluessel]).toBe('boolean')
    expect(vorschlag.prueft).toBe(true)
    expect(vorschlag.nurLesen).toBe(false)
    expect(vorschlag.kartenZuteilung).toBe(true)
    expect(vorschlag.fuehrtZusammen).toBe(true)
    expect(vorschlag.liefert).toEqual(['Bericht', PRUEFBELEG_ETIKETT, ARBEITSPAKET_ETIKETT])
    // brauchtOptional ohne die Pflicht-Etiketten.
    expect(vorschlag.brauchtOptional).toEqual(['Angriffsliste'])
    // Felder: doppelte id weg, leeres Label weg, id abgeleitet.
    expect(vorschlag.felder).toEqual([
      { id: 'zielgruppe', label: 'Zielgruppe', platzhalter: 'z.B. Handwerker', pflicht: true }
    ])
    // K20: fehlender Platzhalter wird als Zeile angehängt.
    expect(vorschlag.auftrag).toMatch(/\nZielgruppe: \{\{zielgruppe\}\}$/)
    // Begründungen: gekürzt/getrimmt, fehlende mit Rückfall-Satz, nur für gesetzte.
    expect(vorschlag.begruendungen.prueft).toBe('Er urteilt, ob die Analyse vollständig ist.')
    expect(vorschlag.begruendungen.kartenZuteilung).toBe(te.kiBegruendungFehlt)
    expect(vorschlag.begruendungen.fuehrtZusammen).toBe(te.kiBegruendungFehlt)
    expect(vorschlag.begruendungen.nurLesen).toBeUndefined()
    expect(vorschlag.begruendungen.audit).toBeUndefined()
    // Und der Hauptprozess nimmt das Ergebnis an.
    const { begruendungen, ...fuerEditor } = vorschlag
    const urteil = pruefeEigenenBlock(fuerEditor)
    expect(urteil.fehler).toBeUndefined()
    expect(urteil.block.felder).toEqual(vorschlag.felder)
  })

  it('alte Antwortform (flaches nurLesen) und fehlende Felder brechen nichts', () => {
    const vorschlag = vorschlagSaeubern({ name: 'Leser', auftrag: 'Lies.', nurLesen: true })
    expect(vorschlag.nurLesen).toBe(true)
    expect(vorschlag.prueft).toBe(false)
    expect(vorschlag.brauchtOptional).toEqual([])
    expect(vorschlag.felder).toEqual([])
    expect(vorschlag.begruendungen).toEqual({ nurLesen: te.kiBegruendungFehlt })
    expect(pruefeEigenenBlock(vorschlag).fehler).toBeUndefined()
  })

  it('fuehrtZusammen ohne braucht wird still false — statt Fehler beim Speichern', () => {
    const vorschlag = vorschlagSaeubern({
      name: 'X',
      auftrag: 'Y',
      kennzeichen: { fuehrtZusammen: true },
      begruendungen: { fuehrtZusammen: 'führt zusammen' }
    })
    expect(vorschlag.fuehrtZusammen).toBe(false)
    expect(vorschlag.begruendungen).toEqual({})
  })

  it('der Prompt-Zusatz nutzt dieselben Namen und Hinweise wie der Editor', () => {
    const liste = kennzeichenFuerAssistent()
    expect(liste.map((k) => k.schluessel)).toEqual(KENNZEICHEN.map((k) => k.schluessel))
    for (const k of liste) {
      expect(k.name).toBe(te.kennzeichen[k.schluessel].name)
      expect(k.hinweis).toBe(te.kennzeichen[k.schluessel].hinweis)
    }
    const zusatz = texte.agentenBlockAssistent.kennzeichenZusatz(liste)
    expect(zusatz).toContain('"kartenZuteilung"')
    expect(zusatz).toContain(te.kennzeichen.audit.hinweis)
    expect(zusatz).toContain('begruendungen')
  })
})
