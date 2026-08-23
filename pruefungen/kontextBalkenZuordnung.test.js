// Prüfungen zu Fund 9 (Abendlauf am Haushaltsplaner, 22.08.2026): Der
// Kontext-Balken zeigte den Falschen.
//
// Kein Rechenfehler — die Anzeige rechnete richtig. Falsch war die Zuordnung:
// Vier Angaben nebeneinander, vier verschiedene Bezugsgrößen.
//   blauer Balken, 20–25 %   → Füllstand des KOORDINATORS gegen sein Fenster
//   Strich bei 85 %          → UEBERTRAG_SCHWELLE_PROZENT (Koordinator)
//   „Block-Agent … 40–45 %"  → der ARBEITENDE Agent gegen sein eigenes Fenster
//   „111.811 Tokens"         → alle Fäden zusammen
//
// Zwei Dinge daran waren irreführend:
// 1. Bei einem lokalen Lauf zeigte der große Balken den Untätigen. Der
//    Koordinator startet Blöcke und wartet; gearbeitet wird im Agenten. Der
//    Agent hat seinen EIGENEN Wächter mit eigener Schwelle (lokalWaechter,
//    LOKAL_WAECHTER_PROZENT) — ausgerechnet dessen Zahl stand klein als
//    Fließtext, während Balken und rote Marke den Koordinator zeigten.
// 2. Die Textzeile klebte zwei Maßstäbe mit einem Mittelpunkt aneinander
//    („Kontext: etwa 20–25 % gefüllt · 111.811 Tokens") — das las sich wie eine
//    Gleichung. Die Prozente galten dem Koordinator, die Tokens allen Fäden.
//
// Belastbarkeit: Zwei Leser hintereinander sind darauf hereingefallen — Georg,
// der die Anzeige beauftragt hat, und die Session, die danach in die falsche
// Richtung grub.
//
// Ausdrücklich in Ordnung und hier mitgeprüft: Es gibt ZWEI Wächter, nicht
// einen. Der lokale Block-Agent ist bewacht.
//
// Rot vor Grün, so gemessen: Vor der Reparatur gab es balkenWahl nicht (Import
// rot). Nachgebaut mit der alten Zuordnung — Balken immer auf
// kontextProzent*, Marke immer UEBERTRAG_SCHWELLE_PROZENT — melden alle
// Prüfungen des lokalen Falls rot:
//   AssertionError: expected 25 to be 42
import { describe, it, expect } from 'vitest'
import { balkenWahl } from '../src/renderer/src/VerbrauchZeile.jsx'
import { LOKAL_WAECHTER_PROZENT } from '../src/shared/lokalRegeln.js'
import { UEBERTRAG_SCHWELLE_PROZENT } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

// Die Zahlen aus dem gemessenen Lauf.
const lokalerLauf = {
  lokal: true,
  kontextProzentVon: 20,
  kontextProzentBis: 25,
  agentProzentVon: 40,
  agentProzentBis: 45,
  tokens: 100_000,
  unterTokens: 11_811
}
const claudeLauf = { ...lokalerLauf, lokal: false }

describe('Fund 9 · Bei einem lokalen Lauf gehört der Balken dem Arbeitenden', () => {
  it('füllt den Balken mit dem Block-Agenten, nicht mit dem Koordinator', () => {
    const balken = balkenWahl(lokalerLauf)
    expect(balken.von).toBe(40)
    expect(balken.bis).toBe(45)
  })

  it('setzt die rote Marke auf die Schwelle, die für diesen Faden wirklich gilt', () => {
    expect(balkenWahl(lokalerLauf).marke).toBe(LOKAL_WAECHTER_PROZENT)
    expect(LOKAL_WAECHTER_PROZENT).not.toBe(UEBERTRAG_SCHWELLE_PROZENT)
  })

  it('beschriftet den Balken, damit niemand raten muss, wen er misst', () => {
    expect(balkenWahl(lokalerLauf).label).toBe(texte.lauf.kontextBlockAgent)
  })

  it('verschweigt den Koordinator nicht — er wird zur Nebenzeile mit seiner Schwelle', () => {
    const zeile = balkenWahl(lokalerLauf).nebenzeile
    expect(zeile).toContain('20–25 %')
    expect(zeile).toContain('wartet')
    expect(zeile).toContain(String(UEBERTRAG_SCHWELLE_PROZENT))
  })
})

describe('Fund 9 · Bei einem Claude-Lauf bleibt alles, wie es war', () => {
  // Dort hat der Koordinator den einzigen Wächter, und die Übertrags-Schwelle
  // ist die einzige Schwelle — die Umstellung wäre hier eine Verschlechterung.
  it('füllt den Balken weiter mit dem Koordinator', () => {
    const balken = balkenWahl(claudeLauf)
    expect(balken.von).toBe(20)
    expect(balken.bis).toBe(25)
  })

  it('lässt die Marke auf der Übertrags-Schwelle — null heißt „die voreingestellte"', () => {
    expect(balkenWahl(claudeLauf).marke).toBe(null)
  })

  it('nennt den Block-Agenten weiter als Nebenzeile', () => {
    expect(balkenWahl(claudeLauf).nebenzeile).toBe(texte.lauf.verbrauchAgent(40, 45))
  })
})

describe('Fund 9 · Die Zahlen tragen ihren Maßstab selbst', () => {
  it('sagt bei den Tokens dazu, dass sie alle Fäden zusammenzählen', () => {
    expect(texte.lauf.verbrauchTokens(111811)).toContain('alle Fäden zusammen')
  })
})

describe('Fund 9 · Ohne Daten wird nichts behauptet', () => {
  it('zeigt keinen Balken, solange kein Füllstand vorliegt', () => {
    expect(balkenWahl({ lokal: true, tokens: 5 })).toBe(null)
    expect(balkenWahl(null)).toBe(null)
  })

  it('fällt bei einem lokalen Lauf ohne Agenten-Zahl auf den Koordinator zurück', () => {
    // Der Zustand kurz nach dem Start: Der Block-Agent hat noch keinen Zug
    // gemacht. Ein leerer Balken wäre schlechter als der wahre Koordinator.
    const balken = balkenWahl({ lokal: true, kontextProzentVon: 3, kontextProzentBis: 5 })
    expect(balken.bis).toBe(5)
    expect(balken.marke).toBe(null)
  })

  it('behandelt einen alten Laufbericht ohne das Feld lokal wie einen Claude-Lauf', () => {
    const { lokal: _weg, ...ohneFeld } = lokalerLauf
    expect(balkenWahl(ohneFeld).bis).toBe(25)
  })
})
