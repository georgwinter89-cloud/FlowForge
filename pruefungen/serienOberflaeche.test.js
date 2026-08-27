// Prüfungen zur Serienlauf-Oberfläche (Bauschritt 61): Die Renderer-Dateien
// lassen sich hier nicht rendern, aber ihre Regeln sind als Quelltext
// greifbar — festgenagelt wird, was ein späterer Umbau still verlieren
// könnte: die ehrliche Kosten-Frage VOR dem Serien-Start, der verdrahtete
// „Serie beenden"-Knopf und die Vorschlags-Knöpfe, die während einer Serie
// verschwinden müssen (sonst drückt Georg im Rundenwechsel-Fenster genau den
// Vorschlag weg, den die Serie gleich liest — Race). Muster wie in
// denktiefeOberflaeche.test.js.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { texte } from '../src/shared/texte.js'

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')

describe('Bauschritt 61 · Texte, auf die die Serien-Oberfläche baut', () => {
  it('alle Serien-Texte existieren und nennen die Rundenzahl', () => {
    expect(typeof texte.serie.wahlLabel).toBe('string')
    expect(typeof texte.serie.wahlEinzeln).toBe('string')
    expect(texte.serie.wahlRunden(3)).toContain('3')
    expect(texte.serie.startFrage(5)).toContain('5')
    expect(typeof texte.serie.startKnopf).toBe('string')
    expect(texte.serie.stand(2, 4)).toContain('2')
    expect(texte.serie.stand(2, 4)).toContain('4')
    expect(typeof texte.serie.beenden).toBe('string')
    expect(typeof texte.serie.beendenHinweis).toBe('string')
    expect(typeof texte.serie.beendetVormerkung).toBe('string')
    expect(texte.serie.fehler('kaputt')).toContain('kaputt')
    expect(texte.serie.berichtVermerk(1, 3)).toContain('1')
    expect(typeof texte.lauf.serieLaeuft).toBe('string')
  })
})

describe('Bauschritt 61 · Leinwand: Serien-Start, Beenden-Knopf, Vorschlags-Race', () => {
  const leinwand = lesen('src/renderer/src/Leinwand.jsx')

  it('der Serien-Start läuft über die Bestätigung: startFrage VOR laufStarten mit Rundenzahl', () => {
    const start = leinwand.indexOf('async function starten()')
    expect(start).toBeGreaterThan(-1)
    const rumpf = leinwand.slice(start, leinwand.indexOf('async function warteschlangeVerlassen'))
    const frage = rumpf.indexOf('texte.serie.startFrage(runden)')
    const aufruf = rumpf.indexOf('window.flowforge.laufStarten(pfad, kartenIds, runden)')
    expect(frage).toBeGreaterThan(-1)
    expect(aufruf).toBeGreaterThan(frage)
    expect(rumpf).toMatch(/knopf: texte\.serie\.startKnopf/)
    // Die Bestätigung startet von selbst neu — Georg klickt nicht zweimal.
    expect(rumpf).toMatch(/serieBestaetigtRef\.current = true\s*\n\s*starten\(\)/)
    // Einzellauf bleibt Einzellauf: ohne Wahl > 1 geht kein drittes Argument mit.
    expect(rumpf).toMatch(/serienRunden > 1 \? serienRunden : undefined/)
  })

  it('„Serie beenden" ist verdrahtet und kippt die Anzeige auf die Vormerkung', () => {
    expect(leinwand).toMatch(/window\.flowforge\.serieBeenden\(pfad\)/)
    expect(leinwand).toMatch(/beendenAngefordert: true/)
    expect(leinwand).toMatch(/texte\.serie\.beendetVormerkung/)
    expect(leinwand).toMatch(/texte\.serie\.beendenHinweis/)
  })

  it('die Serien-Zeile hängt am serie-Feld, nicht am Laufzustand-String', () => {
    expect(leinwand).toMatch(/tab === 'lauf' && serie && \(/)
    expect(leinwand).toMatch(/texte\.serie\.stand\(serie\.runde, serie\.gesamt\)/)
  })

  it('die Vorschlags-Knöpfe hängen an der Serien-Bedingung — der Satz bleibt sichtbar', () => {
    // Übernehmen/Verwerfen nur ohne Serie; die Empfehlung selbst steht davor
    // und bleibt ungeschützt sichtbar (Zusage: angezeigt, nie ausgeführt).
    expect(leinwand).toMatch(/!serie && \([\s\S]{0,600}laufVorschlagUebernehmen[\s\S]{0,300}laufVorschlagVerwerfen/)
    const zeile = leinwand.indexOf('laufVorschlag.empfehlung')
    const schutz = leinwand.indexOf('{!serie && (')
    expect(zeile).toBeGreaterThan(-1)
    expect(schutz).toBeGreaterThan(zeile)
  })

  it('der Start-Knopf ist während einer Serie aus und sagt warum', () => {
    expect(leinwand).toMatch(/wartePosition > 0 \|\| Boolean\(serie\)/)
    expect(leinwand).toMatch(/texte\.lauf\.serieLaeuft/)
  })

  it('Serie kommt über beide Kanäle an: laufZustand und das laeufe-Ereignis', () => {
    expect(leinwand).toMatch(/setSerie\(e\.serie \?\? null\)/)
    expect(leinwand).toMatch(/\(ereignis\.serien \?\? \[\]\)\.find\(\(\[p\]\) => p === pfad\)/)
  })

  it('serie-fehler wird behandelt wie warteschlange-fehler', () => {
    expect(leinwand).toMatch(/ereignis\.art === 'serie-fehler'/)
    expect(leinwand).toMatch(/texte\.serie\.fehler\(ereignis\.fehler\)/)
  })

  it('der Bericht-Vermerk ist null-sicher — alte Berichte rendern unverändert', () => {
    expect(leinwand).toMatch(/bericht\.serie && \(/)
    expect(leinwand).toMatch(/texte\.serie\.berichtVermerk\(bericht\.serie\.runde, bericht\.serie\.gesamt\)/)
  })
})

describe('Bauschritt 61 · Projektübersicht: Serien-Stand auf der Kachel', () => {
  it('die Kachel zeigt den Serien-Stand nur, wenn es ihn gibt', () => {
    const uebersicht = lesen('src/renderer/src/Projektuebersicht.jsx')
    expect(uebersicht).toMatch(/zustand\.serie && \(/)
    expect(uebersicht).toMatch(/texte\.serie\.stand\(zustand\.serie\.runde, zustand\.serie\.gesamt\)/)
  })
})
