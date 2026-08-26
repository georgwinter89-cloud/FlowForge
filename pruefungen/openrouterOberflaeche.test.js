// Prüfungen zur Oberfläche von Bauschritt 60 (OpenRouter im Alltag).
//
// Zwei Sorten, wie in denktiefeOberflaeche.test.js:
//  1. MESSEN — wo die Regel als reine Funktion greifbar ist (Kosten-Text der
//     Verbrauchszeile, Katalog-Treffer und Status-Zeilen der Einstellungen,
//     die Metrik-Texte mit Beispieldaten), läuft sie hier wirklich.
//  2. QUELLTEXT-PINS — die Einbaustellen im Renderer lassen sich nicht
//     rendern; festgenagelt wird, was die Angriffsliste als Bruchstelle sah
//     (Fund 1: „im Abo enthalten" für echtes Geld, Fund 2: „nicht gemessen"
//     trotz gemessener Zahl, Fund 20: stehengebliebenes Kontextfenster).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { texte } from '../src/shared/texte.js'
import { kostenTeil } from '../src/renderer/src/VerbrauchZeile.jsx'
import {
  katalogEintragFuer,
  katalogStatusZeilen,
  katalogVorschlaege
} from '../src/renderer/src/Einstellungen.jsx'

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')

describe('Bauschritt 60 · Verbrauchszeile: OpenRouter ist echtes Geld (Fund 1)', () => {
  it('zeigt bei einem OpenRouter-Block mit gemeldetem Betrag die Zahl — nie den Abo-Text', () => {
    const zeile = kostenTeil({ kostenUsd: 0.42, openrouter: true }, 'abo')
    expect(zeile).toBe(texte.lauf.verbrauchKostenOpenrouter(0.42))
    expect(zeile).toContain('echtes Geld')
    expect(zeile).not.toBe(texte.lauf.verbrauchKostenAbo)
  })

  it('sagt ohne gemeldeten Betrag „nicht gemeldet" — die Zeile fehlt nicht einfach', () => {
    expect(kostenTeil({ kostenUsd: null, openrouter: true }, 'abo')).toBe(
      texte.lauf.verbrauchKostenOpenrouterUnbekannt
    )
  })

  it('nimmt 0 als ECHTE Meldung, nicht als „nicht gemeldet"', () => {
    expect(kostenTeil({ kostenUsd: 0, openrouter: true }, 'api')).toBe(
      texte.lauf.verbrauchKostenOpenrouter(0)
    )
  })

  it('lässt Claude-Verbrauch unangetastet: Abo-Text im Abo, Zahl im API-Modus', () => {
    expect(kostenTeil({ kostenUsd: 1.5 }, 'abo')).toBe(texte.lauf.verbrauchKostenAbo)
    expect(kostenTeil({ kostenUsd: 1.5 }, 'api')).toBe(texte.lauf.verbrauchKosten(1.5))
    expect(kostenTeil({ kostenUsd: null }, 'abo')).toBeNull()
  })

  it('fällt auf den Laufbericht-Topf NICHT herein — dort ist openrouter ein Objekt', () => {
    // Am Laufbericht heißt verbrauch.openrouter der Sammel-Topf
    // {tokens, dauerMs, kostenUsd} und ist auch bei einem reinen Claude-Lauf
    // da (truthy). Eine lasche Wahrheitsprüfung erklärte die theoretischen
    // Abo-Kosten des ganzen Laufs zu echtem OpenRouter-Geld.
    const bericht = { kostenUsd: 3.5, openrouter: { tokens: 0, dauerMs: 0, kostenUsd: null } }
    expect(kostenTeil(bericht, 'abo')).toBe(texte.lauf.verbrauchKostenAbo)
  })
})

describe('Bauschritt 60 · Leinwand: gemessene Kosten gewinnen (Fund 2)', () => {
  const leinwand = lesen('src/renderer/src/Leinwand.jsx')

  it('verzweigt an der Blockkarte: Betrag da → openrouterKostenGemessen, sonst der Rückfall', () => {
    // Vorher gewann die Klasse VOR kostenUsd — auch ein Bericht MIT gemessener
    // Zahl behauptete „nicht gemessen".
    expect(leinwand).toMatch(
      /klasseIstOpenRouter\(eintrag\.klasse\)\s*\?\s*eintrag\.kostenUsd != null\s*\?\s*tb\.openrouterKostenGemessen\(eintrag\.kostenUsd\)\s*:\s*tb\.openrouterKosten/
    )
  })

  it('führt die „Davon OpenRouter"-Zeile im Lauf-Gesamt — nach dem Muster der Lokal-Zeile', () => {
    expect(leinwand).toMatch(
      /bericht\.verbrauch\?\.openrouter != null && bericht\.verbrauch\.openrouter\.tokens > 0/
    )
    expect(leinwand).toMatch(/texte\.metriken\.davonOpenrouterZeile\(bericht\.verbrauch\.openrouter\)/)
  })

  it('die Bericht-Texte dahinter sagen, was sie sollen', () => {
    expect(texte.laufberichte.openrouterKosten).toContain('nicht gemessen')
    expect(texte.laufberichte.openrouterKostenGemessen(0.12)).toContain('0,12')
    // Kleinstbeträge (übliche OpenRouter-Größenordnung) mit vier Stellen —
    // sonst stünde da „0,00 $" und läse sich wie gratis.
    expect(texte.laufberichte.openrouterKostenGemessen(0.0042)).toContain('0,0042')
    expect(texte.metriken.davonOpenrouterZeile({ tokens: 1234, dauerMs: 5000, kostenUsd: null })).toContain(
      'nicht gemeldet'
    )
    expect(
      texte.metriken.davonOpenrouterZeile({ tokens: 1234, dauerMs: 5000, kostenUsd: 0.5 })
    ).not.toContain('nicht gemeldet')
  })
})

describe('Bauschritt 60 · Werkstatt: eigene Art, kein erfundener Balken', () => {
  const werkstatt = lesen('src/renderer/src/Werkstatt.jsx')

  it('beschriftet die drei Arten als Abbildung — openrouter heißt nicht mehr „Block"', () => {
    expect(typeof texte.werkstatt.artOpenrouter).toBe('string')
    expect(werkstatt).toMatch(/s\.art === 'openrouter' \? t\.artOpenrouter : t\.artBlock/)
  })

  it('hält OpenRouter-Einträge aus dem Füllstand-Abschnitt heraus', () => {
    // Der Übersetzer meldet weder vergleich noch gemessen (es gibt keine
    // Schätzung) — genau dieser Filter lässt seine Einträge deshalb draußen.
    // Der Pin hält fest, dass niemand den Filter aufweicht, ohne es zu merken.
    expect(werkstatt).toContain('stellen.filter((s) => s.vergleich || s.gemessen != null)')
    // Dieselbe Regel, wirklich ausgeführt am Vertrags-Eintrag des Übersetzers:
    const eintrag = {
      art: 'openrouter',
      projektPfad: 'D:/x',
      ziel: 'https://openrouter.ai/api/v1',
      modell: 'anbieter/modell',
      blockName: 'Bauer',
      beginn: 1,
      dauerMs: 2,
      anfragen: 3,
      offeneAnfragen: 0,
      tokenHinein: 4,
      tokenHeraus: 5
    }
    expect([eintrag].filter((s) => s.vergleich || s.gemessen != null)).toEqual([])
  })

  it('der Spaltenkopf heißt neutral „Ziel"', () => {
    expect(texte.werkstatt.spalteZiel).toBe('Ziel')
  })
})

describe('Bauschritt 60 · Metriken: „davon OpenRouter" neben „davon lokal"', () => {
  const metriken = lesen('src/renderer/src/Metriken.jsx')

  it('die Ketten-/Projekt-Tabellen tragen die Spalte, mit „—" bei 0', () => {
    expect(metriken).toMatch(/t\.spalteDavonOpenrouter/)
    expect(metriken).toMatch(/\(z\.openrouterTokens \?\? 0\) > 0 \? tokensText\(z\.openrouterTokens\) : '—'/)
  })

  it('gesamtZeile rechnet den Abo-Anteil ohne lokale UND ohne OpenRouter-Tokens', () => {
    const g = {
      anzahl: 2,
      tokens: 1_000_000,
      mitKosten: 1,
      kostenUsd: 12,
      ohneKosten: 0,
      lokalTokens: 200_000,
      mitLokalDauer: 1,
      lokalDauerMs: 60_000,
      ohneLokalDauer: 0,
      openrouterTokens: 300_000,
      mitOpenrouterDauer: 1,
      openrouterDauerMs: 30_000,
      openrouterKostenUsd: 1.23
    }
    const zeile = texte.metriken.gesamtZeile(g)
    expect(zeile).toContain('davon lokal: 200.000')
    expect(zeile).toContain('davon OpenRouter: 300.000')
    // 1.000.000 − 200.000 lokal − 300.000 OpenRouter = 500.000 Abo — und der
    // Abo-Anteil steht genau EINMAL da (die OpenRouter-Zeile wiederholt ihn
    // nur, wenn es keine lokale gibt).
    expect(zeile).toContain('Abo-Anteil: 500.000')
    expect(zeile.match(/Abo-Anteil/g)).toHaveLength(1)
  })

  it('ohne lokale Tokens trägt die OpenRouter-Zeile den Abo-Anteil selbst', () => {
    const g = {
      anzahl: 1,
      tokens: 500_000,
      mitKosten: 0,
      kostenUsd: null,
      ohneKosten: 0,
      lokalTokens: 0,
      openrouterTokens: 300_000,
      mitOpenrouterDauer: 0,
      openrouterDauerMs: 0,
      openrouterKostenUsd: null
    }
    const zeile = texte.metriken.gesamtZeile(g)
    expect(zeile).toContain('Abo-Anteil: 200.000')
    expect(zeile.match(/Abo-Anteil/g)).toHaveLength(1)
  })

  it('alte Eimer ohne die neuen Felder brechen nicht', () => {
    const g = { anzahl: 1, tokens: 100, mitKosten: 0, kostenUsd: null, ohneKosten: 1, lokalTokens: 0 }
    expect(() => texte.metriken.gesamtZeile(g)).not.toThrow()
    expect(texte.metriken.gesamtZeile(g)).not.toContain('OpenRouter')
  })

  it('die Wochen-Zeile nennt den OpenRouter-Anteil, sobald es ihn gibt', () => {
    const w = { anzahl: 1, tokens: 1000, mitKosten: 0, ohneKosten: 0, lokalTokens: 0, openrouterTokens: 400 }
    expect(texte.metriken.wocheZeile(w)).toContain('davon OpenRouter: 400')
    expect(texte.metriken.wocheZeile({ ...w, openrouterTokens: 0 })).not.toContain('OpenRouter')
  })
})

describe('Bauschritt 60 · Einstellungen: Katalog, Auswahlliste, Kontext-Automatik', () => {
  const dialog = lesen('src/renderer/src/Einstellungen.jsx')

  it('findet einen Katalog-Eintrag nur bei exaktem (getrimmtem) Treffer', () => {
    const katalog = {
      ok: true,
      ziel: 'https://openrouter.ai/api/v1',
      umgeleitet: false,
      modelle: [
        { id: 'anbieter/modell', name: 'Modell', kontext: 128_000, preisHinein: 1e-6, preisHeraus: 2e-6 },
        { id: 'anbieter/anders', name: 'Anders', kontext: null, preisHinein: null, preisHeraus: null }
      ]
    }
    expect(katalogEintragFuer(katalog, 'anbieter/modell')?.kontext).toBe(128_000)
    expect(katalogEintragFuer(katalog, '  anbieter/modell  ')?.kontext).toBe(128_000)
    // Halber Name ist KEIN Treffer — das Feld bleibt ehrlicher Freitext.
    expect(katalogEintragFuer(katalog, 'anbieter')).toBeNull()
    expect(katalogEintragFuer(katalog, '')).toBeNull()
    expect(katalogEintragFuer(null, 'anbieter/modell')).toBeNull()
    expect(katalogEintragFuer({ ok: false, fehler: 'x' }, 'anbieter/modell')).toBeNull()
  })

  it('kennt die drei Status-Zustände — und zeigt die Prüfstand-Umleitung an', () => {
    expect(katalogStatusZeilen(null)).toEqual([texte.einstellungen.openRouterKatalogLaedt])
    expect(katalogStatusZeilen({ ok: false, fehler: 'Zeitüberschreitung' }).join(' ')).toContain(
      'Zeitüberschreitung'
    )
    // Leerer Fehler (kaputte Brücke) → trotzdem ein lesbarer Satz.
    expect(katalogStatusZeilen({ ok: false, fehler: '' }).join(' ')).toContain('unbekannter Fehler')
    const da = katalogStatusZeilen({ ok: true, ziel: 'x', umgeleitet: false, modelle: [{}, {}, {}] })
    expect(da).toHaveLength(1)
    expect(da[0]).toContain('3 Modelle')
    const umgeleitet = katalogStatusZeilen({
      ok: true,
      ziel: 'http://127.0.0.1:11434/v1',
      umgeleitet: true,
      modelle: []
    })
    expect(umgeleitet).toHaveLength(2)
    expect(umgeleitet[1]).toContain('http://127.0.0.1:11434/v1')
  })

  // 0.61.1 (Bugbefund Georg, 26.08.2026): datalist → eigene Aufklapp-Liste.
  // Die native filterte am Feldinhalt — nach einer Auswahl wirkte die Liste
  // beim erneuten Öffnen leer. Die Vorschlags-Regel ist die reine Funktion
  // katalogVorschlaege und wird unten GEMESSEN, nicht gelesen.
  it('das Modellfeld hängt an der eigenen Aufklapp-Liste aus dem Katalog — Freitext bleibt', () => {
    expect(dialog).not.toContain('<datalist')
    expect(dialog).toContain('katalogVorschlaege(openRouterKatalog, openRouterModell)')
    expect(dialog).toContain('modellwahl-liste')
    // Kein select: Die Liste ist Angebot, nicht Zwang — getippt wird weiter
    // über openRouterModellSetzen (Kontext-Automatik hängt daran).
    expect(dialog).toContain('openRouterModellSetzen(e.target.value)')
    // Der Klick auf einen Eintrag wählt über dieselbe Funktion (Automatik
    // gilt auch für die Maus-Auswahl).
    expect(dialog).toContain('openRouterModellSetzen(m.id)')
  })

  it('die Vorschlags-Regel zeigt nach einer Auswahl wieder ALLE Modelle (Bugbefund 26.08.2026)', () => {
    const katalog = {
      ok: true,
      modelle: [
        { id: 'anbieter/gross', name: 'Großes Modell' },
        { id: 'anbieter/klein', name: 'Kleines Modell' },
        { id: 'andere/mini', name: 'Mini' }
      ]
    }
    // Leeres Feld: alle.
    expect(katalogVorschlaege(katalog, '').length).toBe(3)
    // GENAU das gewählte Modell im Feld (der Zustand nach jeder Auswahl):
    // wieder alle — genau das konnte die datalist nicht.
    expect(katalogVorschlaege(katalog, 'anbieter/gross').length).toBe(3)
    expect(katalogVorschlaege(katalog, '  anbieter/gross  ').length).toBe(3)
    // Beim Tippen (kein exakter Treffer): Teiltext-Filter über Kennung UND
    // Namen, Groß-/Kleinschreibung egal.
    expect(katalogVorschlaege(katalog, 'anbieter/').map((m) => m.id)).toEqual([
      'anbieter/gross',
      'anbieter/klein'
    ])
    expect(katalogVorschlaege(katalog, 'MINI').map((m) => m.id)).toEqual(['andere/mini'])
    expect(katalogVorschlaege(katalog, 'gibtsnicht').length).toBe(0)
    // Ohne Katalog keine Vorschläge — das Feld ist dann ehrlicher Freitext.
    expect(katalogVorschlaege({ ok: false, fehler: 'weg' }, 'x').length).toBe(0)
    expect(katalogVorschlaege(null, 'x').length).toBe(0)
  })

  it('die Kontext-Automatik setzt das Feld HART auf den Katalogwert (Fund 20) — und sperrt es nie', () => {
    expect(dialog).toContain('setOpenRouterKontext(String(eintrag.kontext))')
    expect(dialog).toMatch(/t\.openRouterKontextAusListe\(openRouterKontextInfo\.kontext\)/)
    expect(dialog).toMatch(/t\.openRouterKontextUnbekannt/)
    // kontext null → KEIN Hart-Setzen, nur der Hinweis; das steht vor dem Setzen.
    const setzen = dialog.slice(dialog.indexOf('function openRouterModellSetzen'))
    expect(setzen.indexOf("setOpenRouterKontextInfo({ art: 'unbekannt' })")).toBeLessThan(
      setzen.indexOf('setOpenRouterKontext(String(eintrag.kontext))')
    )
    // Rückfrage statt Sperre: Das Kontextfeld trägt kein disabled/readOnly.
    const kontextFeld = dialog.slice(
      dialog.indexOf('t.openRouterKontextFeld'),
      dialog.indexOf('t.openRouterKontextHinweis')
    )
    expect(kontextFeld).not.toMatch(/disabled|readOnly/)
  })

  it('holt den Katalog nur bei sichtbarem OpenRouter-Abschnitt und speichert KEIN neues Feld', () => {
    expect(dialog).toMatch(/window\.flowforge\?\.openrouterKatalog\?\.\(\)/)
    const effekt = dialog.slice(dialog.indexOf('// Modellkatalog holen'))
    expect(effekt.indexOf('if (!openRouterAktiv) return')).toBeGreaterThan(-1)
    expect(effekt.indexOf('if (!openRouterAktiv) return')).toBeLessThan(
      effekt.indexOf('openrouterKatalog?.()')
    )
    // Die Automatik schreibt in das VORHANDENE openRouterKontext-Feld — die
    // handgeschriebene Speicherliste wächst nicht (die drei Siebe im
    // Hauptprozess blieben sonst blind für das neue Feld).
    const speichern = dialog.slice(
      dialog.indexOf('async function speichern()'),
      dialog.indexOf('if (!ergebnis.ok)')
    )
    expect(speichern).toContain('einstellungenSpeichern({')
    expect(speichern).not.toContain('openRouterKatalog')
    expect(speichern).not.toContain('openRouterKontextInfo')
  })
})

describe('Bauschritt 60 · preload: die Katalog-Brücke', () => {
  it('reicht openrouter-katalog als invoke durch — Muster searxngStatus', () => {
    const preload = lesen('src/preload/index.js')
    expect(preload).toMatch(/openrouterKatalog: \(\) => ipcRenderer\.invoke\('openrouter-katalog'\)/)
  })
})
