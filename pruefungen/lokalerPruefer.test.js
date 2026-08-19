// Prüfungen zu „Lokaler Prüfer mit Opus-Abnahme" (BAUPLAN 50), Teil Regeln,
// Oberfläche und Metriken: die Steck-Regel „lokaler Prüfer ohne Abnahme"
// (Hinweis, keine Sperre), die Schaubild-Hinweise, das Einfügen einer
// Abnahme-Karte, das neue Standard-Rückführungsziel (nächster NICHT-prüfender
// Vorfahre), das erweiterte Vorlagen-Format samt Vorlage „Feature hinzufügen ·
// lokal", die Metrik „Urteil lokal vs. Abnahme" aus dem Laufbericht und die
// Texte, auf die Leinwand, Bibliothek und Metriken bauen — dazu am Quelltext
// die Stellen, die sie sichtbar machen.
//
// Rot-vor-Grün: Vor Bauschritt 50 gab es lokalerPrueferOhneAbnahme,
// schaubildHinweise, abnahmeKarteEinfuegen, vorlagenKette und abnahmeAuswerten
// nicht; rueckfuehrungsZiel nahm blind den nächsten Vorfahren (bei Bauer →
// Prüfer → Prüfer also den ersten Prüfer, der nichts repariert); VORLAGEN
// kannten nur blockId-Strings; der Metrik-Extrakt trug weder instanzId noch
// klasse, torBestaetigung oder abnahmeFuer; die texte-Schlüssel fehlten.
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  abnahmeKarteEinfuegen,
  lokalerPrueferOhneAbnahme,
  pruefeSchaubild,
  pruefeVersorgung,
  rueckfuehrungsZiel,
  schaubildHinweise
} from '../src/shared/kettenRegeln.js'
import {
  VORLAGEN,
  blockDefinition,
  eigeneBloeckeSetzen,
  klasseIstLokal,
  vorlageDefinition,
  vorlagenKette
} from '../src/shared/blockKatalog.js'
import { abnahmeAuswerten, laufExtraktAusBericht } from '../src/shared/metrikRegeln.js'
import { texte } from '../src/shared/texte.js'

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')

function block(instanzId, blockId, rest = {}) {
  return {
    instanzId,
    blockId,
    zusatz: '',
    feldWerte: {},
    zurueckZu: null,
    position: { x: 0, y: 0 },
    ...rest
  }
}
const pfeil = (von, nach) => ({ von, nach })
// Eine gerade Kette: jede Karte zeigt auf die nächste.
const kette = (bloecke) => bloecke.slice(1).map((b, i) => pfeil(bloecke[i].instanzId, b.instanzId))

afterEach(() => eigeneBloeckeSetzen([]))

describe('BAUPLAN 50 · lokalerPrueferOhneAbnahme', () => {
  it('lokal → Claude-Prüfer: die Abnahme ist da, kein Hinweis', () => {
    const bloecke = [
      block('p', 'paket-schneiden'),
      block('b', 'bauer', { modell: 'lokal' }),
      block('t', 'pruefer', { modell: 'lokal' }),
      block('a', 'pruefer', { zusatz: 'Abnahme' }),
      block('s', 'sessionende')
    ]
    const pfeile = kette(bloecke)
    expect(lokalerPrueferOhneAbnahme(bloecke, pfeile, 't')).toBe(false)
    // Der Bauer prüft nicht — nie ein Hinweis, auch lokal.
    expect(lokalerPrueferOhneAbnahme(bloecke, pfeile, 'b')).toBe(false)
    expect(schaubildHinweise(bloecke, pfeile)).toEqual([])
  })

  it('lokal → Sessionende: Hinweis (Sessionende nimmt nichts ab)', () => {
    const bloecke = [
      block('p', 'paket-schneiden'),
      block('b', 'bauer'),
      block('t', 'pruefer', { modell: 'lokal' }),
      block('s', 'sessionende')
    ]
    expect(lokalerPrueferOhneAbnahme(bloecke, kette(bloecke), 't')).toBe(true)
  })

  it('lokal → lokal → Sessionende: lokal hinter lokal ist keine Abnahme — beide Hinweis', () => {
    const bloecke = [
      block('p', 'paket-schneiden'),
      block('b', 'bauer'),
      block('t1', 'pruefer', { modell: 'lokal' }),
      block('t2', 'pruefer', { modell: 'lokal', zusatz: 'Zwei' }),
      block('s', 'sessionende')
    ]
    const pfeile = kette(bloecke)
    expect(lokalerPrueferOhneAbnahme(bloecke, pfeile, 't1')).toBe(true)
    expect(lokalerPrueferOhneAbnahme(bloecke, pfeile, 't2')).toBe(true)
    const hinweise = schaubildHinweise(bloecke, pfeile)
    expect(hinweise.map((h) => h.instanzId)).toEqual(['t1', 't2'])
    expect(hinweise[1].name).toBe('Prüfer · Zwei')
    expect(hinweise[1].nummer).toBe(4)
    expect(hinweise[1].art).toBe('lokalerPrueferOhneAbnahme')
    expect(hinweise[1].text).toBe(texte.kette.hinweisLokalerPrueferOhneAbnahme('Prüfer · Zwei'))
  })

  it('lokal → Gesamtprüfung: Hinweis (die Gesamtprüfung nimmt keinen Prüfbeleg)', () => {
    const bloecke = [
      block('p', 'paket-schneiden'),
      block('b', 'bauer'),
      block('t', 'pruefer', { modell: 'lokal' }),
      block('g', 'gesamtpruefung'),
      block('s', 'sessionende')
    ]
    expect(lokalerPrueferOhneAbnahme(bloecke, kette(bloecke), 't')).toBe(true)
  })

  it('auch ohne Sessionende dahinter: ein lokaler Prüfer am Ende bleibt ohne Abnahme', () => {
    const bloecke = [block('p', 'paket-schneiden'), block('b', 'bauer'), block('t', 'pruefer', { modell: 'lokal' })]
    expect(lokalerPrueferOhneAbnahme(bloecke, kette(bloecke), 't')).toBe(true)
  })

  it('ein nicht-lokaler Prüfer bekommt nie einen Hinweis — auch allein vor dem Sessionende', () => {
    const bloecke = [block('p', 'paket-schneiden'), block('b', 'bauer'), block('t', 'pruefer'), block('s', 'sessionende')]
    const pfeile = kette(bloecke)
    expect(lokalerPrueferOhneAbnahme(bloecke, pfeile, 't')).toBe(false)
    expect(schaubildHinweise(bloecke, pfeile)).toEqual([])
    for (const klasse of ['extra', 'standard', 'sparsam', 'sehr-sparsam'])
      expect(lokalerPrueferOhneAbnahme(bloecke.map((b) => (b.instanzId === 't' ? { ...b, modell: klasse } : b)), pfeile, 't')).toBe(false)
  })

  it('ein eigener Prüf-Block mit Prüfbeleg in brauchtOptional zählt als Abnahme', () => {
    eigeneBloeckeSetzen([
      {
        id: 'eigen-abnahme',
        name: 'Eigene Abnahme',
        auftrag: 'Prüfe nach.',
        braucht: [],
        brauchtOptional: ['Prüfbeleg'],
        liefert: ['Prüfbeleg'],
        prueft: true,
        nurLesen: false,
        felder: []
      }
    ])
    const bloecke = [
      block('p', 'paket-schneiden'),
      block('b', 'bauer'),
      block('t', 'pruefer', { modell: 'lokal' }),
      block('e', 'eigen-abnahme'),
      block('s', 'sessionende')
    ]
    expect(lokalerPrueferOhneAbnahme(bloecke, kette(bloecke), 't')).toBe(false)
    // Stellt Georg den eigenen Prüf-Block selbst auf lokal, ist er keine Abnahme mehr.
    const lokalHinten = bloecke.map((b) => (b.instanzId === 'e' ? { ...b, modell: 'lokal' } : b))
    expect(lokalerPrueferOhneAbnahme(lokalHinten, kette(bloecke), 't')).toBe(true)
  })
})

describe('BAUPLAN 50 · rueckfuehrungsZiel — nächster NICHT-prüfender Vorfahre', () => {
  const bloecke = [block('p', 'paket-schneiden'), block('b', 'bauer'), block('t1', 'pruefer'), block('t2', 'pruefer')]
  const pfeile = kette(bloecke)

  it('Bauer → Prüfer → Prüfer: der zweite Prüfer zielt auf den Bauer, nicht auf den ersten Prüfer', () => {
    expect(rueckfuehrungsZiel(bloecke, pfeile, 't2')).toBe('b')
    expect(rueckfuehrungsZiel(bloecke, pfeile, 't1')).toBe('b')
  })

  it('die gespeicherte Wahl gewinnt weiter — auch wenn sie ein Prüfer ist', () => {
    const gewaehlt = bloecke.map((b) => (b.instanzId === 't2' ? { ...b, zurueckZu: 'p' } : b))
    expect(rueckfuehrungsZiel(gewaehlt, pfeile, 't2')).toBe('p')
    const aufPruefer = bloecke.map((b) => (b.instanzId === 't2' ? { ...b, zurueckZu: 't1' } : b))
    expect(rueckfuehrungsZiel(aufPruefer, pfeile, 't2')).toBe('t1')
    // Eine Wahl, die kein Vorfahre ist, zählt nicht.
    const fremd = bloecke.map((b) => (b.instanzId === 't1' ? { ...b, zurueckZu: 't2' } : b))
    expect(rueckfuehrungsZiel(fremd, pfeile, 't1')).toBe('b')
  })

  it('Rückfall: nur Prüfer davor → nächster Vorfahre; keine Vorfahren → null', () => {
    const nurPruefer = [block('t1', 'pruefer'), block('t2', 'pruefer')]
    expect(rueckfuehrungsZiel(nurPruefer, kette(nurPruefer), 't2')).toBe('t1')
    expect(rueckfuehrungsZiel(nurPruefer, kette(nurPruefer), 't1')).toBe(null)
  })
})

describe('BAUPLAN 50 · abnahmeKarteEinfuegen', () => {
  const bloecke = [
    block('p', 'paket-schneiden'),
    block('b', 'bauer', { modell: 'lokal' }),
    block('t', 'pruefer', { modell: 'lokal', position: { x: 340, y: 420 } }),
    block('s', 'sessionende')
  ]
  const pfeile = kette(bloecke)

  it('hängt die Pfeile um, setzt Zusatz/Klasse/Rückführung, und der Hinweis verschwindet', () => {
    expect(lokalerPrueferOhneAbnahme(bloecke, pfeile, 't')).toBe(true)
    const neu = abnahmeKarteEinfuegen(bloecke, pfeile, 't', 'neu-1')
    expect(neu.neueInstanzId).toBe('neu-1')
    const karte = neu.bloecke.find((b) => b.instanzId === 'neu-1')
    expect(karte).toMatchObject({
      blockId: 'pruefer',
      zusatz: texte.kette.abnahmeZusatzname,
      modell: 'standard',
      feldWerte: {},
      zurueckZu: 'b',
      position: { x: 340, y: 610 }
    })
    expect(klasseIstLokal(karte.modell)).toBe(false)
    expect(neu.pfeile).toEqual([pfeil('p', 'b'), pfeil('b', 't'), pfeil('neu-1', 's'), pfeil('t', 'neu-1')])
    expect(neu.bloecke.length).toBe(5)
    expect(pruefeSchaubild(neu.bloecke, neu.pfeile)).toBe(null)
    expect(pruefeVersorgung(neu.bloecke, neu.pfeile)).toBe(null)
    expect(lokalerPrueferOhneAbnahme(neu.bloecke, neu.pfeile, 't')).toBe(false)
    expect(schaubildHinweise(neu.bloecke, neu.pfeile)).toEqual([])
    // Die Abnahme führt zum Bauer zurück, nicht zum lokalen Prüfer.
    expect(rueckfuehrungsZiel(neu.bloecke, neu.pfeile, 'neu-1')).toBe('b')
    // Eingaben bleiben unangetastet.
    expect(pfeile.length).toBe(3)
    expect(bloecke.length).toBe(4)
  })

  it('vergibt ohne Vorgabe eine eindeutige Kennung; unbekannte Karte → unverändert', () => {
    const a = abnahmeKarteEinfuegen(bloecke, pfeile, 't')
    const b = abnahmeKarteEinfuegen(bloecke, pfeile, 't')
    expect(typeof a.neueInstanzId).toBe('string')
    expect(a.neueInstanzId.length).toBeGreaterThan(8)
    expect(a.neueInstanzId).not.toBe(b.neueInstanzId)
    expect(bloecke.some((k) => k.instanzId === a.neueInstanzId)).toBe(false)
    const nichts = abnahmeKarteEinfuegen(bloecke, pfeile, 'gibt-es-nicht')
    expect(nichts).toEqual({ bloecke, pfeile, neueInstanzId: null })
  })
})

describe('BAUPLAN 50 · Vorlagen-Format und Vorlage „Feature hinzufügen · lokal"', () => {
  it('vorlagenKette liefert immer Objekte — Strings wie Objekte, Ungültiges fällt auf null', () => {
    expect(vorlagenKette({ kette: ['bauer'] })).toEqual([{ blockId: 'bauer', modell: null, zusatz: '', zurueckZu: null }])
    expect(
      vorlagenKette({ kette: ['bauer', { blockId: 'pruefer', modell: 'lokal', zusatz: '  Ab  nahme ', zurueckZu: 0 }] })
    ).toEqual([
      { blockId: 'bauer', modell: null, zusatz: '', zurueckZu: null },
      { blockId: 'pruefer', modell: 'lokal', zusatz: 'Ab nahme', zurueckZu: 0 }
    ])
    // Klasse unbekannt, Index außerhalb der Kette, negativer Index → null.
    expect(vorlagenKette({ kette: [{ blockId: 'pruefer', modell: 'riesig', zurueckZu: 7 }] })[0]).toEqual({
      blockId: 'pruefer',
      modell: null,
      zusatz: '',
      zurueckZu: null
    })
    expect(vorlagenKette({ kette: [{ blockId: 'pruefer', zurueckZu: -1 }] })[0].zurueckZu).toBe(null)
    expect(vorlagenKette(null)).toEqual([])
  })

  it('jede Vorlage: jede blockId existiert; alte Vorlagen bleiben reine Ketten ohne Klasse', () => {
    for (const vorlage of VORLAGEN)
      for (const glied of vorlagenKette(vorlage)) expect(blockDefinition(glied.blockId), vorlage.id + ' / ' + glied.blockId).toBeTruthy()
    for (const id of ['neue-app-starten', 'feature-hinzufuegen', 'bug-jagen'])
      expect(vorlagenKette(vorlageDefinition(id)).every((g) => g.modell === null && g.zusatz === '' && g.zurueckZu === null)).toBe(true)
  })

  it('„Feature hinzufügen · lokal": lokal nur an Bauer und erstem Prüfer, Abnahme Standard mit Rückführung zum Bauer', () => {
    const vorlage = vorlageDefinition('feature-hinzufuegen-lokal')
    expect(vorlage).toMatchObject({ name: 'Feature hinzufügen · lokal', symbol: '🏠' })
    const glieder = vorlagenKette(vorlage)
    expect(glieder.map((g) => g.blockId)).toEqual(['paket-schneiden', 'angreifer', 'bauer', 'pruefer', 'pruefer', 'sessionende'])
    expect(glieder.map((g) => g.modell)).toEqual([null, null, 'lokal', 'lokal', 'standard', null])
    expect(glieder.map((g) => g.zusatz)).toEqual(['', '', '', '', 'Abnahme', ''])
    expect(glieder.map((g) => g.zurueckZu)).toEqual([null, null, null, null, 2, null])
    expect(glieder[4].zusatz).toBe(texte.kette.abnahmeZusatzname)
  })

  it('abgelegt wie in der Leinwand: Schaubild und Versorgung sauber, keine Hinweise, Abnahme zielt auf den Bauer', () => {
    const glieder = vorlagenKette(vorlageDefinition('feature-hinzufuegen-lokal'))
    const bloecke = glieder.map((g, i) => ({
      instanzId: 'k' + i,
      blockId: g.blockId,
      ...(g.modell ? { modell: g.modell } : {}),
      ...(g.zusatz ? { zusatz: g.zusatz } : {}),
      feldWerte: {},
      zurueckZu: null,
      position: { x: 0, y: i * 190 }
    }))
    for (const [i, g] of glieder.entries()) if (g.zurueckZu != null) bloecke[i].zurueckZu = bloecke[g.zurueckZu].instanzId
    const pfeile = kette(bloecke)
    expect(pruefeSchaubild(bloecke, pfeile)).toBe(null)
    expect(pruefeVersorgung(bloecke, pfeile)).toBe(null)
    expect(schaubildHinweise(bloecke, pfeile)).toEqual([])
    expect(lokalerPrueferOhneAbnahme(bloecke, pfeile, 'k3')).toBe(false)
    expect(rueckfuehrungsZiel(bloecke, pfeile, 'k4')).toBe('k2')
    // Ohne die Abnahme wäre der lokale Prüfer allein — die Vorlage ist der Schutz.
    const ohne = bloecke.filter((b) => b.instanzId !== 'k4')
    const ohnePfeile = [...kette(ohne)]
    expect(lokalerPrueferOhneAbnahme(ohne, ohnePfeile, 'k3')).toBe(true)
  })
})

// Ein Laufbericht, wie lauf.js ihn seit 50 schreibt: lokaler Prüfer (Klasse
// lokal, Tor-Nachspiel) und Abnahme-Prüfer mit abnahmeFuer; dazu eine
// Reparatur-Runde und ein Vor-Tor-Urteil der Abnahme, die NICHT zählen dürfen.
function laufMitAbnahme({ torBestaetigung = 'gruen', urteilAbnahme = 'fehlgeschlagen', extra = [] } = {}) {
  const lokal = (zustand) => ({
    instanzId: 'L',
    block: 'Prüfer',
    zusatz: '',
    zustand,
    tokens: 0,
    kostenUsd: 0,
    modelle: [{ modell: 'flowforge-qwen', tokens: 1000, anteil: 1 }],
    klasse: 'lokal',
    urteilLokal: 'bestanden',
    torBestaetigung
  })
  const abnahme = (zustand, urteil, durchTor = false) => ({
    instanzId: 'A',
    block: 'Prüfer',
    zusatz: 'Abnahme',
    zustand,
    tokens: durchTor ? 0 : 5000,
    kostenUsd: durchTor ? 0 : 0.5,
    modelle: durchTor ? null : [{ modell: 'claude-opus-5', tokens: 5000, anteil: 1 }],
    klasse: 'standard',
    abnahmeFuer: [
      {
        instanzId: 'L',
        block: 'Prüfer',
        zusatz: '',
        modell: 'lokal (flowforge-qwen)',
        urteilLokal: 'bestanden',
        torBestaetigung,
        urteilAbnahme: urteil,
        widerspruch: urteil !== 'bestanden',
        durchTor
      }
    ]
  })
  return {
    id: 'l-abnahme',
    workflow: 'Feature hinzufügen · lokal',
    gestartetAm: '2026-08-19T09:00:00.000Z',
    zustand: 'erfolgreich',
    verbrauch: { tokens: 6000, kostenUsd: 0.5 },
    rechteFragen: [],
    entscheidungen: [],
    uebertraege: [],
    zusammenfassungen: [],
    blockErgebnisse: [
      { instanzId: 'B', block: 'Bauer', zustand: 'erfolgreich', tokens: 0, kostenUsd: 0, modelle: [{ modell: 'flowforge-qwen', tokens: 1, anteil: 1 }], klasse: 'lokal' },
      lokal('pruefung-bestanden'),
      abnahme(urteilAbnahme === 'bestanden' ? 'pruefung-bestanden' : 'pruefung-nicht-bestanden', urteilAbnahme),
      ...extra
    ]
  }
}

describe('BAUPLAN 50 · Metrik-Extrakt und abnahmeAuswerten', () => {
  it('der Extrakt reicht instanzId, klasse, torBestaetigung und abnahmeFuer durch — alte Einträge ehrlich leer', () => {
    const e = laufExtraktAusBericht(laufMitAbnahme(), 'C:\\P')
    expect(e.bloecke[1]).toMatchObject({ instanzId: 'L', klasse: 'lokal', torBestaetigung: 'gruen', abnahmeFuer: [] })
    expect(e.bloecke[2]).toMatchObject({ instanzId: 'A', klasse: 'standard', torBestaetigung: null })
    expect(e.bloecke[2].abnahmeFuer).toEqual([
      {
        instanzId: 'L',
        block: 'Prüfer',
        zusatz: '',
        modell: 'lokal (flowforge-qwen)',
        urteilLokal: 'bestanden',
        torBestaetigung: 'gruen',
        urteilAbnahme: 'fehlgeschlagen',
        widerspruch: true,
        durchTor: false
      }
    ])
    const alt = laufExtraktAusBericht(
      { gestartetAm: '2026-08-01T09:00:00.000Z', blockErgebnisse: [{ block: 'Prüfer', zustand: 'pruefung-bestanden' }] },
      'C:\\P'
    )
    expect(alt.bloecke[0]).toMatchObject({ instanzId: 'Prüfer', klasse: '', torBestaetigung: null, abnahmeFuer: [] })
    // Unvollständige Paare (kein Urteil) sind keine Paare.
    const kaputt = laufExtraktAusBericht(
      { gestartetAm: '2026-08-01T09:00:00.000Z', blockErgebnisse: [{ block: 'Prüfer', abnahmeFuer: [{ instanzId: 'L' }, null, 'x'] }] },
      'C:\\P'
    )
    expect(kaputt.bloecke[0].abnahmeFuer).toEqual([])
  })

  it('lokal bestanden / Abnahme fehlgeschlagen = ein Widerspruch, Quote 100 %; Tor grün = Nachspiel ohne Widerspruch', () => {
    const a = abnahmeAuswerten([laufExtraktAusBericht(laufMitAbnahme(), 'C:\\P')])
    expect(a.gesamt).toEqual({ paare: 1, widersprueche: 1, quote: 1, torNachspiele: 1, torWidersprueche: 0, torQuote: 0 })
    expect(a.zeilen).toEqual([
      { lokalModell: 'lokal (flowforge-qwen)', abnahmeModell: 'claude-opus-5', paare: 1, einig: 0, widersprueche: 1, quote: 1 }
    ])
  })

  it('einig, Tor rot: kein Widerspruch der Abnahme, aber ein Tor-Widerspruch', () => {
    const a = abnahmeAuswerten([laufExtraktAusBericht(laufMitAbnahme({ torBestaetigung: 'rot', urteilAbnahme: 'bestanden' }), 'C:\\P')])
    expect(a.gesamt).toMatchObject({ paare: 1, widersprueche: 0, quote: 0, torNachspiele: 1, torWidersprueche: 1, torQuote: 1 })
    expect(a.zeilen[0]).toMatchObject({ paare: 1, einig: 1, widersprueche: 0, quote: 0 })
  })

  it('„keine"/„abgebrochen"/null sind keine Nachspiele — und ohne Paare gibt es keine Quote (null statt 0)', () => {
    for (const tor of ['keine', 'abgebrochen', null]) {
      const a = abnahmeAuswerten([laufExtraktAusBericht(laufMitAbnahme({ torBestaetigung: tor }), 'C:\\P')])
      expect(a.gesamt.torNachspiele).toBe(0)
      expect(a.gesamt.torQuote).toBe(null)
    }
    const leer = abnahmeAuswerten([laufExtraktAusBericht({ gestartetAm: '2026-08-01T09:00:00.000Z', blockErgebnisse: [] }, 'C:\\P')])
    expect(leer.gesamt).toEqual({ paare: 0, widersprueche: 0, quote: null, torNachspiele: 0, torWidersprueche: 0, torQuote: null })
    expect(leer.zeilen).toEqual([])
  })

  it('das zweite Urteil der Abnahme in der Reparatur-Runde zählt nicht — und ein Vor-Tor-Urteil (durchTor) auch nicht', () => {
    const bericht = laufMitAbnahme()
    const zweite = JSON.parse(JSON.stringify(bericht.blockErgebnisse[2]))
    zweite.zustand = 'pruefung-bestanden'
    zweite.abnahmeFuer[0].urteilAbnahme = 'bestanden'
    zweite.abnahmeFuer[0].widerspruch = false
    const vorTor = JSON.parse(JSON.stringify(bericht.blockErgebnisse[2]))
    vorTor.modelle = null
    vorTor.abnahmeFuer[0].durchTor = true
    // Reihenfolge im Lauf: Abnahme urteilt (Widerspruch) → Bauer repariert →
    // lokaler Prüfer → Vor-Tor der Abnahme rot → Abnahme-Agent bestanden.
    bericht.blockErgebnisse.push(
      { instanzId: 'B', block: 'Bauer', zustand: 'erfolgreich', klasse: 'lokal' },
      { ...bericht.blockErgebnisse[1] },
      vorTor,
      zweite
    )
    const a = abnahmeAuswerten([laufExtraktAusBericht(bericht, 'C:\\P')])
    expect(a.gesamt.paare).toBe(1)
    expect(a.gesamt.widersprueche).toBe(1)
    // Das Tor-Nachspiel des lokalen Prüfers zählt dagegen je Anlauf.
    expect(a.gesamt.torNachspiele).toBe(2)
    // Steht das Vor-Tor-Urteil ZUERST, zählt das erste Agenten-Urteil danach.
    const nurTorZuerst = laufMitAbnahme()
    nurTorZuerst.blockErgebnisse.splice(2, 0, vorTor)
    const b = abnahmeAuswerten([laufExtraktAusBericht(nurTorZuerst, 'C:\\P')])
    expect(b.gesamt).toMatchObject({ paare: 1, widersprueche: 1 })
  })

  it('Paare aus zwei Läufen und zwei Modellen landen in getrennten Zeilen, Sortierung nach Paaren', () => {
    const l1 = laufExtraktAusBericht(laufMitAbnahme(), 'C:\\P')
    const l2 = laufExtraktAusBericht({ ...laufMitAbnahme({ urteilAbnahme: 'bestanden' }), id: 'l2' }, 'C:\\P')
    const l3bericht = laufMitAbnahme({ urteilAbnahme: 'bestanden' })
    l3bericht.id = 'l3'
    l3bericht.blockErgebnisse[2].modelle = [{ modell: 'claude-sonnet-5', tokens: 1, anteil: 1 }]
    const l3 = laufExtraktAusBericht(l3bericht, 'C:\\P')
    const a = abnahmeAuswerten([l1, l2, l3])
    expect(a.gesamt).toMatchObject({ paare: 3, widersprueche: 1 })
    expect(a.gesamt.quote).toBeCloseTo(1 / 3)
    expect(a.zeilen.map((z) => [z.abnahmeModell, z.paare, z.einig, z.widersprueche])).toEqual([
      ['claude-opus-5', 2, 1, 1],
      ['claude-sonnet-5', 1, 1, 0]
    ])
  })
})

describe('BAUPLAN 50 · Texte', () => {
  it('kette, laufberichte und metriken kennen die neuen Schlüssel', () => {
    const tk = texte.kette
    expect(typeof tk.hinweisLokalerPrueferOhneAbnahme).toBe('function')
    expect(tk.hinweisLokalerPrueferOhneAbnahme('Prüfer')).toContain('„Prüfer"')
    expect(tk.hinweisLokalerPrueferOhneAbnahme('Prüfer')).toMatch(/startet trotzdem/)
    expect(typeof tk.abnahmeEinfuegenKnopf).toBe('string')
    expect(tk.abnahmeZusatzname).toBe('Abnahme')
    expect(typeof tk.vorlageErklaerungLokal).toBe('string')
    expect(tk.vorlageGliedName('Prüfer', 'Abnahme', '')).toBe('Prüfer · Abnahme')
    expect(tk.vorlageGliedName('Bauer', '', tk.vorlageKlasseKurzLokal)).toBe('Bauer (lokal)')
    const tb = texte.laufberichte
    for (const tor of ['gruen', 'altlasten', 'rot', 'keine', 'abgebrochen']) {
      const zeile = tb.torBestaetigungZeile(tor, 'bestanden')
      expect(zeile).toContain('Tor ohne KI')
      expect(zeile).toContain('„bestanden"')
      expect(zeile).not.toContain('undefined')
    }
    expect(tb.torBestaetigungZeile('rot', 'bestanden')).toMatch(/gedreht/)
    expect(tb.torBestaetigungZeile('keine', null)).toMatch(/kein Prüfbefehl/)
    expect(tb.abnahmeZeile({ instanzId: 'A', block: 'Prüfer', zusatz: 'Abnahme', urteil: 'fehlgeschlagen', widerspruch: true })).toMatch(
      /„Prüfer · Abnahme".*widerspricht.*„fehlgeschlagen"/
    )
    expect(tb.abnahmeZeile({ block: 'Prüfer', zusatz: '', urteil: 'bestanden', widerspruch: false })).toMatch(/„Prüfer".*bestätigt/)
    const zeile = tb.abnahmeFuerZeile({
      instanzId: 'L',
      block: 'Prüfer',
      zusatz: '',
      modell: 'lokal (flowforge-qwen)',
      urteilLokal: 'bestanden',
      torBestaetigung: 'gruen',
      urteilAbnahme: 'fehlgeschlagen',
      widerspruch: true,
      durchTor: false
    })
    expect(zeile).toContain('lokal (flowforge-qwen)')
    expect(zeile).toMatch(/lokal „bestanden" · Abnahme „fehlgeschlagen" — Widerspruch · Tor: grün/)
    expect(zeile).not.toMatch(/Vor-Tor/)
    expect(tb.abnahmeFuerZeile({ block: 'Prüfer', urteilLokal: 'bestanden', urteilAbnahme: 'bestanden', widerspruch: false, durchTor: true })).toMatch(/einig.*Vor-Tor/)
    const tm = texte.metriken
    for (const schluessel of [
      'abnahmeUeberschrift',
      'abnahmeErklaerung',
      'abnahmeLeer',
      'abnahmeKachelWiderspruch',
      'abnahmeKachelTor',
      'spalteLokalModell',
      'spalteAbnahmeModell',
      'spaltePaare',
      'spalteEinig',
      'spalteWidersprueche',
      'spalteWiderspruchQuote'
    ])
      expect(typeof tm[schluessel], schluessel).toBe('string')
    expect(tm.abnahmeKachelWiderspruchHinweis(1, 4)).toMatch(/1 von 4 Paaren/)
    expect(tm.abnahmeKachelWiderspruchHinweis(0, 0)).toMatch(/kein Paar/)
    expect(tm.abnahmeKachelTorHinweis(2, 5)).toMatch(/2 von 5 Nachspielen/)
    expect(tm.abnahmeKachelTorHinweis(0, 0)).toMatch(/kein Nachspiel/)
    expect(tm.abnahmeQuoteMitZahlen('25 %', 1, 4)).toBe('25 % (1/4)')
  })
})

describe('BAUPLAN 50 · Oberfläche (am Quelltext)', () => {
  it('Leinwand: Steck-Hinweis an der Karte und im Kopf, Knopf fügt die Abnahme ein, Laufbericht zeigt beide Urteile, Vorlagen über vorlagenKette', () => {
    const leinwand = lesen('src/renderer/src/Leinwand.jsx')
    expect(leinwand).toMatch(/lokalerPrueferOhneAbnahme\(bloecke, pfeile, eintrag\.instanzId\)/)
    expect(leinwand).toMatch(/abnahmeKarteEinfuegen\(/)
    expect(leinwand).toMatch(/schaubildHinweise\(bloecke, pfeile\)/)
    expect(leinwand).toMatch(/tk\.abnahmeEinfuegenKnopf/)
    expect(leinwand).toMatch(/tk\.hinweisLokalerPrueferOhneAbnahme\(/)
    expect(leinwand).toMatch(/tb\.torBestaetigungZeile\(/)
    expect(leinwand).toMatch(/tb\.abnahmeZeile\(/)
    expect(leinwand).toMatch(/tb\.abnahmeFuerZeile\(/)
    expect(leinwand).toMatch(/abnahme-widerspruch/)
    expect(leinwand).toMatch(/vorlagenKette\(vorlage\)/)
    // Standard-Rückführungsziel am Select kommt aus derselben Regel wie im Lauf.
    expect(leinwand).toMatch(/rueckfuehrungStandard/)
    expect(leinwand).toMatch(/rueckfuehrungsZiel\(bloecke, pfeile, eintrag\.instanzId\)/)
    // Der bestehende Hinweis-Block der Klasse lokal bleibt unangetastet (Regex aus modellklasseLokal.test.js).
    expect(leinwand).toMatch(/klasseIstLokal\(modellKlasse\) && \(/)
    expect(leinwand).toMatch(/tk\.modellLokalHinweis/)
  })

  it('Bibliothek: Vorlagen-Kette über vorlagenKette mit Klasse/Zusatz im Namen', () => {
    const bib = lesen('src/renderer/src/Blockbibliothek.jsx')
    expect(bib).toMatch(/vorlagenKette\(vorlage\)/)
    expect(bib).toMatch(/t\.vorlageGliedName\(/)
    expect(bib).toMatch(/t\.vorlageErklaerungLokal/)
    expect(bib).not.toMatch(/vorlage\.kette\.map/)
  })

  it('Metriken: abnahmeAuswerten, zwei Kacheln, Tabelle, Leer-Text — ohne Klassen-Literale', () => {
    const metriken = lesen('src/renderer/src/Metriken.jsx')
    expect(metriken).toMatch(/abnahmeAuswerten\(laeufe\)/)
    expect(metriken).toMatch(/function AbnahmeTabelle/)
    expect(metriken).toMatch(/t\.abnahmeKachelWiderspruch\b/)
    expect(metriken).toMatch(/t\.abnahmeKachelTor\b/)
    expect(metriken).toMatch(/t\.abnahmeLeer/)
    expect(metriken).not.toMatch(/'sehr-sparsam'|'sparsam'|'extra'|'standard'|'lokal'/)
    const css = lesen('src/renderer/src/stil.css')
    expect(css).toMatch(/\.abnahme-widerspruch/)
    expect(css).toMatch(/\.karte-abnahme-hinweis/)
  })
})
