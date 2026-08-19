// Prüfungen zur Startregel der lokalen Klasse (BAUPLAN 51): Darf ein lokaler
// Kandidat starten, oder sind alle Adressen des Ollama-Pools belegt? Die Regel
// ist eine reine Rechnung neben wellenStartRegel — hier wird sie ohne
// Ablaufplaner gemessen, samt der zwei Fallen aus der Angriffsliste:
//   - Fund 5: Ein lokaler Block im NACHLAUF hält keine GPU (sein Motor ist
//     beendet) — die Regel darf nicht die schreiberBelegt-Semantik der Welle
//     kopieren, sonst serialisiert sie lokale Blöcke grundlos.
//   - Fund 4: Doppelstart-Schutz in derselben Planer-Runde — sobald der erste
//     Kandidat status 'laeuft' und eine Zuteilung trägt, muss die Regel den
//     zweiten bei nur einer Adresse abweisen.
// Dazu die Ticker-Texte (warteGrundLokal mehradressen-fähig, lokalBereit mit
// Adress-Anzahl) mit abwärtskompatibler Signatur.
//
// Rot vor Grün: Vor Bauschritt 51 gab es lokaleStartRegel nicht — der
// Inline-Check in bereiteStarten kannte genau EINEN lokalen Block, keine
// Pool-Größe, und texte.ticker.warteGrundLokal behauptete fest „eine
// Grafikkarte".
import { describe, it, expect } from 'vitest'
import { lokaleStartRegel } from '../src/main/lauf.js'
import { texte } from '../src/shared/texte.js'

const zuteilung = (adresse) => ({
  adresse,
  modell: 'flowforge-qwen3-8-27b',
  kontext: 65536,
  basis: 'qwen3.8:27b'
})

function knoten(name, status, adresse = null) {
  return { name, status, lokalZuteilung: adresse ? zuteilung(adresse) : null }
}

describe('lokaleStartRegel (BAUPLAN 51)', () => {
  it('lässt den Kandidaten starten, wenn niemand läuft', () => {
    const kandidat = knoten('Bauer · A', 'offen')
    expect(lokaleStartRegel(kandidat, [], 1)).toEqual({ darf: true })
    expect(lokaleStartRegel(kandidat, [kandidat], 1)).toEqual({ darf: true })
  })

  it('weist bei einer Adresse den zweiten Kandidaten ab — mit Grund, Halter-Namen und Anzahl', () => {
    const kandidat = knoten('Bauer · B', 'offen')
    const halter = knoten('Bauer · A', 'laeuft', 'http://127.0.0.1:11434')
    const urteil = lokaleStartRegel(kandidat, [halter, kandidat], 1)
    expect(urteil.darf).toBe(false)
    expect(urteil.grund).toBe('lokalBelegt')
    // worauf ist nie leer, solange belegt ist — warteGrundMelden verschluckt
    // leere Listen, der ehrliche Ticker-Grund ginge sonst verloren (Fund 6).
    expect(urteil.worauf).toEqual(['Bauer · A'])
    expect(urteil.anzahl).toBe(1)
  })

  it('Fund 5: ein lokaler Block im Nachlauf hält keine Adresse — die Regel weicht bewusst von schreiberBelegt ab', () => {
    const kandidat = knoten('Bauer · B', 'offen')
    const nachlaeufer = knoten('Bauer · A', 'nachlauf', 'http://127.0.0.1:11434')
    expect(lokaleStartRegel(kandidat, [nachlaeufer, kandidat], 1)).toEqual({ darf: true })
    // Auch schreibtGerade (lokale Vorreparatur) zählt nicht — nur 'laeuft'.
    const schreibend = { ...knoten('Bauer · C', 'offen', 'http://127.0.0.1:11434'), schreibtGerade: true }
    expect(lokaleStartRegel(kandidat, [schreibend], 1)).toEqual({ darf: true })
  })

  it('zählt nur Knoten MIT Zuteilung — ein laufender Claude-Block belegt keine GPU', () => {
    const kandidat = knoten('Bauer · B', 'offen')
    const claude = knoten('Bauer · Claude', 'laeuft') // ohne lokalZuteilung
    expect(lokaleStartRegel(kandidat, [claude], 1)).toEqual({ darf: true })
  })

  it('zwei Adressen: der zweite lokale Block darf parallel, der dritte wartet mit ALLEN Halter-Namen', () => {
    const a = knoten('Bauer · A', 'laeuft', 'http://127.0.0.1:11434')
    const b = knoten('Bauer · B', 'laeuft', 'http://ollama-zweitrechner:11434')
    const dritter = knoten('Bauer · C', 'offen')
    expect(lokaleStartRegel(dritter, [a], 2)).toEqual({ darf: true })
    const urteil = lokaleStartRegel(dritter, [a, b, dritter], 2)
    expect(urteil.darf).toBe(false)
    expect(urteil.worauf).toEqual(['Bauer · A', 'Bauer · B'])
    expect(urteil.anzahl).toBe(2)
  })

  it('Fund 4: Doppelstart-Schutz in derselben Planer-Runde — der eben gestartete Halter zählt sofort mit', () => {
    // bereiteStarten startet mehrere Blöcke je Runde: Kandidat 1 bekommt
    // status 'laeuft' + Zuteilung, BEVOR Kandidat 2 geprüft wird. Genau diese
    // Reihenfolge stellt die Prüfung nach.
    const erster = knoten('Bauer · A', 'offen')
    const zweiter = knoten('Bauer · B', 'offen')
    const alle = [erster, zweiter]
    expect(lokaleStartRegel(erster, alle, 1)).toEqual({ darf: true })
    erster.status = 'laeuft'
    erster.lokalZuteilung = zuteilung('http://127.0.0.1:11434')
    const urteil = lokaleStartRegel(zweiter, alle, 1)
    expect(urteil.darf).toBe(false)
    expect(urteil.worauf).toEqual(['Bauer · A'])
  })

  it('Wiederaufnahme: nach dem Rücksprung auf offen hält der Knoten nichts mehr', () => {
    // Nach App-Neustart gehen Läufer auf 'offen' zurück — eine noch
    // anhängende alte Zuteilung darf nicht zählen (frische Vergabe in
    // bereiteStarten, Fund 3).
    const kandidat = knoten('Bauer · B', 'offen')
    const alter = knoten('Bauer · A', 'offen', 'http://127.0.0.1:11434')
    expect(lokaleStartRegel(kandidat, [alter], 1)).toEqual({ darf: true })
  })
})

describe('Ticker-Texte zum Adress-Pool (Namensraum ticker, Bauer B)', () => {
  const tt = texte.ticker

  it('warteGrundLokal bleibt mit alter Signatur lesbar (abwärtskompatibel)', () => {
    expect(typeof tt.warteGrundLokal('Bauer · A')).toBe('string')
    expect(tt.warteGrundLokal('B', 'A')).toContain('„A"')
    expect(tt.warteGrundLokal('B', 'A')).toContain('einen Block zur Zeit')
    // Keine feste Grafikkarten-Behauptung mehr — eine Adresse muss keine
    // eigene Karte sein.
    expect(tt.warteGrundLokal('B', 'A')).not.toContain('Grafikkarte')
  })

  it('warteGrundLokal nennt bei mehreren Adressen die ehrliche Anzahl und alle Halter', () => {
    const zeile = tt.warteGrundLokal('Bauer · C', 'Bauer · A", „Bauer · B', 2)
    expect(zeile).toContain('alle 2 lokalen KI-Adressen sind belegt')
    expect(zeile).toContain('„Bauer · A", „Bauer · B"')
  })

  it('lokalBereit bleibt bei einer Adresse wortgleich und nennt ab zwei die Anzahl', () => {
    const eine = tt.lokalBereit('flowforge-qwen', 65536)
    expect(eine).not.toContain('Adressen')
    expect(tt.lokalBereit('flowforge-qwen', 65536, 1)).toBe(eine)
    expect(tt.lokalBereit('flowforge-qwen', 65536, 2)).toContain('2 Adressen')
  })

  it('lokalAdresseAusgeklammert nennt Adresse und Grund', () => {
    const zeile = tt.lokalAdresseAusgeklammert('http://ollama-zweitrechner:11434', 'nicht erreichbar')
    expect(zeile).toContain('http://ollama-zweitrechner:11434')
    expect(zeile).toContain('nicht erreichbar')
  })

  it('lauf.lokalOhneZuteilung (Wächter-Text) ist vorhanden', () => {
    expect(texte.lauf.lokalOhneZuteilung('Bauer · A')).toContain('„Bauer · A"')
  })
})
