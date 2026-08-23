// Prüfungen zur Werkstatt (Bauschritt 54).
//
// Rot vor Grün: Vor diesem Schritt gab es weder ein Register laufender
// Zählstellen noch eine Stelle, an der FlowForge den Zustand der Ollama-Rechner
// beantwortet hätte — Georg erfuhr erst mitten im Lauf im Ticker, ob eine
// Adresse überhaupt trägt.
//
// Zwei Sorten Prüfung, bewusst getrennt:
//  1. VERHALTEN — Register und Rechner-Abfrage laufen hier wirklich (mit einem
//     Stub-Ollama bzw. gestubbtem fetch).
//  2. QUELLTEXT — die Einbaustellen im Motor. Der echte Motor startet nur mit
//     der Claude-CLI; was hier zählt, ist aber genau die REIHENFOLGE der
//     Zeilen (Zählstelle vor der Umgebung, Schnitt beim Blockbeginn, Abbau im
//     finally) — und die ist am Quelltext ehrlich prüfbar. Dasselbe Muster wie
//     motorUmgebung.test.js und lokaleSpeicherEhrlichkeit.test.js.
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  werkstattAnmelden,
  werkstattStand,
  werkstattRegisterLeeren,
  rechnerZustand,
  rechnerZustandFuerEinstellungen
} from '../src/main/werkstatt.js'
import { zaehlstelleStarten } from '../src/main/motor/zaehlstelle.js'
import { einstellungenLaden } from '../src/main/einstellungen.js'
import { fuellstandVergleich } from '../src/shared/zaehlRegeln.js'
import { lokalesModellName } from '../src/shared/lokalRegeln.js'
import { texte } from '../src/shared/texte.js'

const hier = path.dirname(fileURLToPath(import.meta.url))
const lesen = (...teile) => fs.readFileSync(path.join(hier, '..', ...teile), 'utf8')
const motorQuelle = lesen('src', 'main', 'motor', 'claudeCodeMotor.js')
const laufQuelle = lesen('src', 'main', 'lauf.js')

afterEach(() => {
  werkstattRegisterLeeren()
  vi.unstubAllGlobals()
})

describe('Bauschritt 54 · Register der laufenden Zählstellen', () => {
  it('meldet an und wieder ab — die Rückgabe IST die Abmeldung', () => {
    expect(werkstattStand().stellen).toEqual([])
    const ab = werkstattAnmelden({ holeStand: () => ({ art: 'block', blockName: 'Bauer' }) })
    expect(werkstattStand().stellen).toHaveLength(1)
    ab()
    expect(werkstattStand().stellen).toEqual([])
  })

  it('lässt eine klemmende Messstelle still heraus, statt die ganze Ansicht zu kippen', () => {
    werkstattAnmelden({
      holeStand: () => {
        throw new Error('kaputt')
      }
    })
    werkstattAnmelden({ holeStand: () => ({ art: 'block', blockName: 'heil' }) })
    const stellen = werkstattStand().stellen
    expect(stellen).toHaveLength(1)
    expect(stellen[0].blockName).toBe('heil')
  })

  it('nimmt keine Anmeldung ohne Stand-Funktion an', () => {
    werkstattAnmelden({})
    werkstattAnmelden(null)
    expect(werkstattStand().stellen).toEqual([])
  })

  it('stellt das Jüngste nach oben', () => {
    werkstattAnmelden({ holeStand: () => ({ blockName: 'alt', beginn: 1000 }) })
    werkstattAnmelden({ holeStand: () => ({ blockName: 'neu', beginn: 5000 }) })
    expect(werkstattStand().stellen.map((s) => s.blockName)).toEqual(['neu', 'alt'])
  })

  it('zeigt die Zahlen einer echten Zählstelle live', async () => {
    // Genau die Kette, die im Betrieb läuft: Zählstelle → Register → Tab.
    const stelle = await zaehlstelleStarten({ ziel: 'http://127.0.0.1:11434' })
    expect(stelle.ok).toBe(true)
    werkstattAnmelden({
      holeStand: () => {
        const stand = stelle.stand()
        return {
          art: 'block',
          blockName: 'Bauer',
          ziel: stand.ziel,
          dauerMs: stand.block.dauerMs,
          tokenHinein: stand.block.tokenHinein,
          tokenHeraus: stand.block.tokenHeraus,
          vergleich: fuellstandVergleich(stand.block.groessteAnfrageZeichen, 0, 65_536)
        }
      }
    })
    const eintrag = werkstattStand().stellen[0]
    expect(eintrag.ziel).toBe('http://127.0.0.1:11434')
    expect(eintrag.tokenHinein).toBe(0)
    // Noch nichts gemessen: kein erfundener Vergleich.
    expect(eintrag.vergleich).toBeNull()
    stelle.schliessen()
  })
})

describe('Bauschritt 54 · Zustand der Rechner', () => {
  // Ein Ollama-Ersatz, der genau die drei Fragen beantwortet, die die Werkstatt
  // stellt: /api/tags (welche Modelle liegen da), /api/ps (was ist geladen).
  function fetchErsatz({ tags = null, ps = null, kaputt = false } = {}) {
    vi.stubGlobal('fetch', async (adresse) => {
      if (kaputt) throw new Error('nicht erreichbar')
      const pfad = String(adresse)
      if (pfad.endsWith('/api/tags'))
        return { ok: true, json: async () => (tags === null ? {} : { models: tags }) }
      if (pfad.endsWith('/api/ps'))
        return ps === null
          ? { ok: false, json: async () => ({}) }
          : { ok: true, json: async () => ({ models: ps }) }
      return { ok: false, json: async () => ({}) }
    })
  }

  it('sagt bei einem nicht erreichbaren Rechner „nein" statt zu raten', async () => {
    fetchErsatz({ kaputt: true })
    const zustand = await rechnerZustand({
      adressen: ['http://gaming-pc:11434'],
      basisModell: 'qwen3.8:27b'
    })
    expect(zustand.adressen[0]).toMatchObject({ erreichbar: false, basisDa: false, abgeleitetDa: false })
  })

  it('nennt Basis-Modell und abgeleitetes Modell getrennt — beide zählen', async () => {
    const abgeleitet = lokalesModellName('qwen3.8:27b')
    fetchErsatz({
      tags: [{ name: 'qwen3.8:27b' }, { name: abgeleitet + ':latest' }],
      ps: [{ name: abgeleitet, size: 100, size_vram: 100 }]
    })
    const zustand = await rechnerZustand({
      adressen: ['http://gaming-pc:11434'],
      basisModell: 'qwen3.8:27b'
    })
    expect(zustand.abgeleitetesModell).toBe(abgeleitet)
    expect(zustand.adressen[0]).toMatchObject({ erreichbar: true, basisDa: true, abgeleitetDa: true })
    expect(zustand.adressen[0].speicher).toMatchObject({ ok: true, prozent: 100, passt: true })
  })

  it('meldet ein fehlendes abgeleitetes Modell — vor dem ersten lokalen Lauf ist das normal', async () => {
    fetchErsatz({ tags: [{ name: 'qwen3.8:27b' }], ps: [] })
    const zustand = await rechnerZustand({
      adressen: ['http://gaming-pc:11434'],
      basisModell: 'qwen3.8:27b'
    })
    expect(zustand.adressen[0]).toMatchObject({ basisDa: true, abgeleitetDa: false })
    expect(zustand.adressen[0].geladen).toEqual([])
  })

  it('unterscheidet „nichts geladen" von „nicht beantwortbar"', async () => {
    // Prozessliste nicht erreichbar → null, NICHT die leere Liste. Sonst
    // behauptete der Tab „nichts geladen", wo er schlicht nichts weiß.
    fetchErsatz({ tags: [{ name: 'qwen3.8:27b' }], ps: null })
    const zustand = await rechnerZustand({
      adressen: ['http://gaming-pc:11434'],
      basisModell: 'qwen3.8:27b'
    })
    expect(zustand.adressen[0].geladen).toBeNull()
    expect(zustand.adressen[0].speicher).toEqual({ ok: false })
  })

  it('warnt, wenn das Modell nicht ganz in der Grafikkarte liegt — dieselbe Rechnung wie der Ticker', async () => {
    const abgeleitet = lokalesModellName('qwen3.8:27b')
    fetchErsatz({
      tags: [{ name: 'qwen3.8:27b' }, { name: abgeleitet }],
      ps: [{ name: abgeleitet, size: 40_000_000_000, size_vram: 30_000_000_000 }]
    })
    const zustand = await rechnerZustand({
      adressen: ['http://gaming-pc:11434'],
      basisModell: 'qwen3.8:27b'
    })
    expect(zustand.adressen[0].speicher).toMatchObject({ ok: true, prozent: 75, passt: false })
  })

  it('kommt ohne Adressen und ohne Modell zurecht, statt zu werfen', async () => {
    expect((await rechnerZustand()).adressen).toEqual([])
    expect((await rechnerZustand({ adressen: [], basisModell: '' })).abgeleitetesModell).toBe('')
  })

  // Diese Prüfung gibt es, weil genau sie beim Bauen rot gewesen wäre: Der
  // erste Anlauf las `einstellungenLaden().lokaleHelferAdressen` statt
  // `einstellungenLaden().einstellungen.lokaleHelferAdressen`. Die Werkstatt
  // sagte daraufhin „keine Ollama-Adresse eingetragen", obwohl die Liste nie
  // leer sein kann (SPEC §9). Gefahren wird mit dem ECHTEN Lader — sonst
  // prüfte die Prüfung nur ihre eigene Annahme über dessen Form.
  it('nimmt die Adressen wirklich aus den Einstellungen (die Liste ist nie leer)', async () => {
    fetchErsatz({ kaputt: true })
    const zustand = await rechnerZustandFuerEinstellungen(einstellungenLaden)
    expect(zustand.ok).toBe(true)
    expect(zustand.adressen.length).toBeGreaterThan(0)
    expect(zustand.basisModell).toBe(einstellungenLaden().einstellungen.lokaleHelferModell)
  })
})

describe('Bauschritt 54 · Einbau im Motor (Reihenfolge zählt)', () => {
  it('baut die Zählstelle NUR für lokale Motoren und VOR der Umgebung auf', () => {
    const aufbau = motorQuelle.indexOf('if (lokal) await zaehlstelleAufbauen()')
    expect(aufbau).toBeGreaterThan(0)
    const url = motorQuelle.indexOf('umgebung.ANTHROPIC_BASE_URL =')
    expect(aufbau).toBeLessThan(url)
  })

  it('schneidet die Block-Zahlen beim Blockbeginn ab', () => {
    // Ohne diesen Schnitt trüge die Vergleichszeile des zweiten Blocks die
    // Spitze des ersten — eine „Messung", die eine Verwechslung wäre.
    expect(motorQuelle).toContain('zaehlstelle?.blockBeginnt()')
  })

  it('meldet den Vergleich, SOLANGE der Block noch da ist', () => {
    // blockAufloesen setzt `block = null`. Stünde die Meldung dahinter, wäre
    // der geschätzte Wert weg und die Zeile immer leer.
    const meldung = motorQuelle.indexOf('fuellstandVergleichMelden()\n    const verbrauch')
    expect(meldung).toBeGreaterThan(0)
  })

  it('baut die Zählstelle an JEDEM Ausgang wieder ab', () => {
    // Zwei Stellen: das finally der Schleife (alle normalen Enden) und der
    // Fänger davor (Fehler, bevor das try überhaupt beginnt).
    expect((motorQuelle.match(/zaehlstelleAbbauen\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})

describe('Bauschritt 54 · Einbau im Lauf (die Helfer-KI zählt mit)', () => {
  it('lenkt die Adresse der Helfer-KI auf die Zählstelle', () => {
    // Messung 2 am Code (22.08.2026): Die Helfer-KI spricht mit eigenem fetch
    // an der Motor-Zählstelle vorbei. Ohne diesen Handgriff zeigte die
    // Werkstatt die halbe Wahrheit — und niemand merkte es.
    expect(laufQuelle).toContain('lokaleHelfer.adresse = helferStelle.adresse')
  })

  it('schließt sie am Laufende — an zwei Stellen, damit kein Ausgang sie vergisst', () => {
    expect((laufQuelle.match(/lauf\.helferZaehlstelle\?\.schliessen\(\)/g) ?? []).length).toBe(2)
  })
})

describe('Bauschritt 54 · die Vergleichszeile im Laufbericht', () => {
  it('nennt beide Zahlen und die Richtung des Irrtums', () => {
    const v = fuellstandVergleich(350_000, 140_000, 65_536)
    const zeile = texte.ticker.lokalFuellstandVergleich('Bauer', v)
    expect(zeile).toContain('Bauer')
    expect(zeile).toContain('100.000')
    expect(zeile).toContain('40.000')
    expect(zeile).toContain('ZU NIEDRIG')
  })

  it('sagt bei einer zu hohen Schätzung ehrlich die andere Richtung', () => {
    const v = fuellstandVergleich(100_000, 200_000, 65_536)
    const zeile = texte.ticker.lokalFuellstandVergleich('Prüfer', v)
    expect(zeile).toContain('zu hoch')
    expect(zeile).not.toContain('ZU NIEDRIG')
  })

  // Fund aus dem Probelauf am 23.08.2026: Solange der Koordinator seinen ersten
  // Turn fährt, hat der Block-Agent nicht angefangen — `schaetzZeichen` steht
  // auf 0. Die Werkstatt zeigte „gemessen 29.638 · geschätzt 0 · 100 % daneben".
  // Das liest sich wie ein katastrophaler Schätzfehler und ist in Wahrheit ein
  // Vergleich gegen etwas, das es noch nicht gibt.
  it('vergleicht nur, wenn es eine Schätzung GIBT — sonst steht die Messung allein', () => {
    // Die Weiche im Motor: kein Vergleich ohne geschätzte Zeichen.
    expect(motorQuelle).toContain('geschaetztZeichen > 0')
    expect(motorQuelle).toContain('lokalFuellstandOhneSchaetzung')
    const zeile = texte.ticker.lokalFuellstandOhneSchaetzung('Kontext laden', 29_638, 90.4)
    expect(zeile).toContain('29.638')
    expect(zeile).toContain('90 %')
    expect(zeile).toContain('kam nicht zum Zug')
    // Und in der Werkstatt derselbe Satz statt eines Balkens „geschätzt 0 %".
    expect(texte.werkstatt.nurGemessen(29_638, 90)).toContain('noch nicht angefangen')
  })

  it('sagt beim Ausfall der Zählstelle, dass der Block trotzdem weiterarbeitet', () => {
    const zeile = texte.ticker.zaehlstelleAus('kein Port')
    expect(zeile).toContain('kein Port')
    expect(zeile).toContain('weiter')
  })
})

describe('Bauschritt 54 · die Seite nennt ihre Grenzen', () => {
  it('führt genau die vier Grenzen, die der Bauplan verlangt', () => {
    const grenzen = texte.werkstatt.grenzen.join(' ')
    // Seit dem Probelauf am 23.08.2026 gehört dazu, dass die Messung den
    // Koordinator mitzählt — er redet über dieselbe Leitung.
    expect(grenzen).toContain('Koordinator')
    expect(texte.werkstatt.grenzen).toHaveLength(5)
    // Der zusätzliche Sprung kostet Zeit — messbar klein, aber nicht null.
    expect(grenzen).toContain('nicht null')
    // Tokens je Sekunde ist abgeleitet, keine Angabe von Ollama.
    expect(grenzen).toContain('abgeleitete Zahl')
    // Was an der Messstelle vorbei läuft, sieht sie nicht.
    expect(grenzen).toContain('vorbei')
    // Ausfall der Messstelle tötet keinen Block.
    expect(grenzen).toContain('trotzdem weiter')
  })

  it('trägt den Knopf in der Titelleiste', () => {
    expect(texte.kopfleiste.werkstattKnopf).toBe('Werkstatt')
  })
})
