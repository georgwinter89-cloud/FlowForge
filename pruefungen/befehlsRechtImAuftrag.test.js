// Der Sperr-Satz liest die Einstellung mit (Bauschritt 56).
//
// Fünf nur-lesende Katalog-Blöcke tragen wörtlich denselben Befehls-Sperr-Satz
// (BEFEHLS_SPERRE_SATZ). Ist die Einstellung „Nur-lesende Blöcke dürfen
// Befehle ausführen" an, ersetzt auftragMitBefehlsRecht diesen Satz im
// KATALOG-Auftrag durch die Erlaubnis (BEFEHLS_ERLAUBNIS_SATZ) — der Auftrag
// widerspricht sich dann nicht mehr selbst („gesperrt … aber abweichend
// erlaubt"). Aufträge ohne den Standard-Satz (eigene Blöcke sowie Audit und
// Karten-Prüfer mit eigener Formulierung) bleiben unverändert; für sie meldet
// zusatzNoetig=true, dass der bisherige Nachsatz
// (texte.agentenUebergabe.nurLesenBefehleZusatz) der Weg bleibt.
import { describe, it, expect } from 'vitest'
import {
  BEFEHLS_SPERRE_SATZ,
  BEFEHLS_ERLAUBNIS_SATZ,
  auftragMitBefehlsRecht,
  blockDefinition,
  BLOCK_KATALOG
} from '../src/shared/blockKatalog.js'

// Die fünf Katalog-Blöcke mit dem Standard-Sperr-Satz.
const MIT_SPERR_SATZ = [
  'kontext-laden',
  'paket-schneiden',
  'angreifer',
  'diagnose',
  'integrator-recherche'
]

// Nur-lesende Katalog-Blöcke mit eigener Formulierung — für sie bleibt der
// Nachsatz der Weg.
const EIGENE_FORMULIERUNG = ['audit', 'karten-pruefer']

function vorkommen(text, satz) {
  return text.split(satz).length - 1
}

describe('Bauschritt 56 · Der Sperr-Satz steht wörtlich im Katalog', () => {
  it.each(MIT_SPERR_SATZ)('der Auftrag von „%s" enthält den Sperr-Satz genau einmal', (id) => {
    const def = blockDefinition(id)
    expect(def, `Block ${id} fehlt im Katalog`).toBeTruthy()
    expect(vorkommen(def.auftrag, BEFEHLS_SPERRE_SATZ)).toBe(1)
  })
})

describe('Bauschritt 56 · auftragMitBefehlsRecht schaltet den Satz um', () => {
  it.each(MIT_SPERR_SATZ)('„%s": Erlaubnis ersetzt die Sperre, kein Zusatz nötig', (id) => {
    const original = blockDefinition(id).auftrag
    const ergebnis = auftragMitBefehlsRecht(original, true)
    expect(ergebnis.auftrag).toContain(BEFEHLS_ERLAUBNIS_SATZ)
    expect(ergebnis.auftrag).not.toContain(BEFEHLS_SPERRE_SATZ)
    expect(ergebnis.zusatzNoetig).toBe(false)
    // Nur der Satz wandert — der übrige Auftragstext bleibt Wort für Wort:
    // Rückersetzung ergibt wieder das Original.
    expect(ergebnis.auftrag.replaceAll(BEFEHLS_ERLAUBNIS_SATZ, BEFEHLS_SPERRE_SATZ)).toBe(
      original
    )
  })

  it.each(EIGENE_FORMULIERUNG)('„%s" bleibt unverändert — der Nachsatz bleibt der Weg', (id) => {
    const original = blockDefinition(id).auftrag
    const ergebnis = auftragMitBefehlsRecht(original, true)
    expect(ergebnis.auftrag).toBe(original)
    expect(ergebnis.zusatzNoetig).toBe(true)
  })

  it('ein freier Text ohne den Satz bleibt unverändert — Zusatz nötig', () => {
    const frei = 'Du bist ein eigener Block und liest nur. Antworte auf Deutsch.'
    const ergebnis = auftragMitBefehlsRecht(frei, true)
    expect(ergebnis.auftrag).toBe(frei)
    expect(ergebnis.zusatzNoetig).toBe(true)
  })

  it('bei ausgeschalteter Einstellung bleibt jeder Auftrag wörtlich stehen', () => {
    for (const id of [...MIT_SPERR_SATZ, ...EIGENE_FORMULIERUNG]) {
      const original = blockDefinition(id).auftrag
      const ergebnis = auftragMitBefehlsRecht(original, false)
      expect(ergebnis.auftrag).toBe(original)
      expect(ergebnis.zusatzNoetig).toBe(false)
    }
  })
})

describe('Bauschritt 56 · Die Erlaubnis nennt keinen Katalog-Blocknamen', () => {
  // Dieselbe Nennung-Regel wie in empfaengerTexte.test.js (BAUPLAN 43) — dort
  // wird nur der statische Katalog-Auftrag geprüft; die Erlaubnis landet erst
  // zur Laufzeit im Auftrag und braucht deshalb ihre eigene Inventur.
  function nennung(name) {
    const escapiert = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^A-Za-zÄÖÜäöüß-])${escapiert}(s|n|en)?(?![A-Za-zÄÖÜäöüß])`)
  }

  it('kein Blockname im Erlaubnis-Satz', () => {
    for (const block of BLOCK_KATALOG)
      expect(BEFEHLS_ERLAUBNIS_SATZ, `nennt „${block.name}"`).not.toMatch(nennung(block.name))
  })
})
