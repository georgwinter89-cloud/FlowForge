// Prüfungen zu Bauschritt 30: Themen (Normalisierung, Pflicht, kanonische
// Schreibweise), Sammel-Vorschlag „thema", paket_melden und die
// Rechte-Freischaltung von paket_melden am selben Server wie karten_zuteilen.
import { describe, it, expect } from 'vitest'
import {
  themaNormalisieren,
  themaSchluessel,
  vorhandeneThemen,
  kanonischesThema,
  pruefeThema,
  THEMA_MAX
} from '../src/shared/kartenRegeln.js'
import {
  vorschlagLeitplanken,
  themenVorschlagLeitplanken
} from '../src/main/motor/vorschlagWerkzeuge.js'
import { paketMeldungPruefen } from '../src/main/motor/kartenZuteilungWerkzeuge.js'
import { pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

const karten = [
  { id: 's1', sorte: 'status', titel: 'Status', text: 'x' },
  { id: 'a1', sorte: 'aufgabe', titel: 'Login bauen', text: 'x', thema: 'Login', erledigt: false },
  { id: 'a2', sorte: 'aufgabe', titel: 'Logout', text: 'x', thema: 'login', erledigt: false },
  { id: 'a3', sorte: 'aufgabe', titel: 'Alt ohne Thema', text: 'x', erledigt: false },
  { id: 'a4', sorte: 'aufgabe', titel: 'Erledigt', text: 'x', thema: 'Login', erledigt: true },
  { id: 'e1', sorte: 'entscheidung', titel: 'Motor', text: 'x', thema: 'Technik' },
  { id: 'p1', sorte: 'pruefung', titel: 'Prüfung 1', text: 'x' }
]

describe('Bauschritt 30 · Themen-Regeln', () => {
  it('normalisiert Leerzeichen, vergleicht ohne Groß-/Kleinschreibung', () => {
    expect(themaNormalisieren('  Login   Seite ')).toBe('Login Seite')
    expect(themaSchluessel('LOGIN')).toBe(themaSchluessel('login'))
  })
  it('vorhandene Themen: kanonisch = zuerst angelegte Schreibweise, ohne Dubletten', () => {
    expect(vorhandeneThemen(karten)).toEqual(['Login', 'Technik'])
    expect(kanonischesThema(karten, 'LOGIN')).toBe('Login')
    expect(kanonischesThema(karten, 'Neu')).toBe('Neu')
  })
  it('Pflicht beim Anlegen: Ablehnung nennt die vorhandenen Themen', () => {
    const urteil = pruefeThema(karten, '', { pflicht: true })
    expect(urteil.fehler).toBe(texte.kartenRegeln.themaFehlt(['Login', 'Technik']))
    expect(urteil.fehler).toContain('Login')
  })
  it('ohne Pflicht (alte Karte bearbeiten) bleibt leer erlaubt', () => {
    expect(pruefeThema(karten, '', { pflicht: false })).toEqual({ thema: '' })
  })
  it('Längengrenze greift', () => {
    const lang = 'x'.repeat(THEMA_MAX + 1)
    expect(pruefeThema(karten, lang, { pflicht: true }).fehler).toBe(
      texte.kartenRegeln.themaZuLang(THEMA_MAX, THEMA_MAX + 1)
    )
  })
})

describe('Bauschritt 30 · Vorschlagsart „thema" (Sammelform)', () => {
  it('nimmt Entscheidungs-Karten an (Thema setzen ist kein Umformulieren) und kanonisiert', () => {
    const urteil = themenVorschlagLeitplanken({
      themen: [
        { kartenId: 'a3', thema: 'login' },
        { kartenId: 'e1', thema: 'Architektur' }
      ],
      karten
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.eintraege[0]).toMatchObject({ kartenId: 'a3', thema: 'Login', altesThema: null })
    expect(urteil.eintraege[1]).toMatchObject({ kartenId: 'e1', thema: 'Architektur', altesThema: 'Technik' })
  })
  it('weist Status- und Prüfkarten, Dubletten, leere und wortgleiche Themen ab', () => {
    const tv = texte.agentenVorschlag
    expect(themenVorschlagLeitplanken({ themen: [], karten }).fehler).toBe(tv.themenLeer)
    expect(themenVorschlagLeitplanken({ themen: [{ kartenId: 'p1', thema: 'X' }], karten }).fehler).toBe(
      tv.themaFalscheSorte('Prüfung 1')
    )
    expect(
      themenVorschlagLeitplanken({
        themen: [{ kartenId: 'a3', thema: 'X' }, { kartenId: 'a3', thema: 'Y' }],
        karten
      }).fehler
    ).toBe(tv.themaDoppelt('a3'))
    expect(themenVorschlagLeitplanken({ themen: [{ kartenId: 'a3', thema: '  ' }], karten }).fehler).toBe(
      tv.themaLeer('Alt ohne Thema')
    )
    expect(themenVorschlagLeitplanken({ themen: [{ kartenId: 'a1', thema: 'LOGIN' }], karten }).fehler).toBe(
      tv.themaGleich('Login bauen')
    )
  })
  it('„anlegen" verlangt jetzt ein Thema und kanonisiert es', () => {
    const ohne = vorschlagLeitplanken({ art: 'anlegen', titel: 'T', text: 'X', karten })
    expect(ohne.fehler).toBe(texte.kartenRegeln.themaFehlt(['Login', 'Technik']))
    const mit = vorschlagLeitplanken({ art: 'anlegen', titel: 'T', text: 'X', thema: 'technik', karten })
    expect(mit.ok).toBe(true)
    expect(mit.thema).toBe('Technik')
  })
})

describe('Bauschritt 30 · paket_melden', () => {
  const ausgewaehlt = ['a1', 'a3']
  it('nimmt nur offene Aufgaben-Karten aus der Kartenauswahl', () => {
    const tp = texte.agentenPaket
    expect(paketMeldungPruefen({ aufgabenIds: ['a1', 'a3'], karten, ausgewaehlt, feldGefuellt: false })).toEqual({
      ok: true,
      aufgaben: [
        { id: 'a1', titel: 'Login bauen' },
        { id: 'a3', titel: 'Alt ohne Thema' }
      ]
    })
    expect(paketMeldungPruefen({ aufgabenIds: ['a4'], karten, ausgewaehlt, feldGefuellt: false }).fehler).toBe(
      tp.keineOffeneAufgabe('Erledigt')
    )
    expect(paketMeldungPruefen({ aufgabenIds: ['a2'], karten, ausgewaehlt, feldGefuellt: false }).fehler).toBe(
      tp.nichtInAuswahl('Logout')
    )
    expect(paketMeldungPruefen({ aufgabenIds: ['zzz'], karten, ausgewaehlt, feldGefuellt: false }).fehler).toBe(
      tp.unbekannteId('zzz')
    )
  })
  it('leer nur erlaubt, wenn das Wunsch-/Fehlerbild-Feld gefüllt war', () => {
    expect(paketMeldungPruefen({ aufgabenIds: [], karten, ausgewaehlt, feldGefuellt: true })).toEqual({
      ok: true,
      aufgaben: []
    })
    expect(paketMeldungPruefen({ aufgabenIds: [], karten, ausgewaehlt, feldGefuellt: false }).fehler).toBe(
      texte.agentenPaket.leerOhneFeld
    )
  })
  it('paket_melden ist am selben Server frei wie karten_zuteilen — sonst Rückfrage', () => {
    const frei = pruefeWerkzeug('mcp__zuteilung__paket_melden', {}, 'D:\\p', true, false, true, false, false, false, false, true)
    expect(frei.erlaubt).toBe(true)
    const fremd = pruefeWerkzeug('mcp__zuteilung__paket_melden', {}, 'D:\\p', true, false, true, false, false, false, false, false)
    expect(fremd.frage).toBe(texte.rechteFrage.kartenZuteilung)
  })
})
