// Prüfungen zu den Vorschlags-Leitplanken (Zweit-Audit D-08).
// Rot-vor-Grün: Der Status-Karten-Fall schlug vor der Behebung fehl
// (falsche Begründung „Entscheidungs-Karten …" statt Status-Karten-Text).
import { describe, it, expect } from 'vitest'
import { vorschlagLeitplanken } from '../src/main/motor/vorschlagWerkzeuge.js'
import { texte } from '../src/shared/texte.js'

const tv = texte.agentenVorschlag
const statusKarte = { id: 's1', sorte: 'status', titel: 'Status', text: 'Wo stehen wir', erledigt: false }
const wissensKarte = { id: 'w1', sorte: 'wissen', titel: 'Aufbau', text: 'Electron-App', erledigt: false }
const entscheidungsKarte = { id: 'e1', sorte: 'entscheidung', titel: 'Motor', text: 'Abo-Modus', erledigt: false }

describe('D-08 · Leitplanken der Karten-Vorschläge', () => {
  it('lehnt Löschen der Status-Karte mit eigener, sachlich richtiger Begründung ab', () => {
    const urteil = vorschlagLeitplanken({ art: 'loeschen', kartenId: 's1', karte: statusKarte })
    expect(urteil.fehler).toBe(tv.statusNurAktualisierbar)
  })
  it('Gegenprobe: Löschen einer Entscheidungs-Karte nennt weiterhin die Entscheidungs-Begründung', () => {
    const urteil = vorschlagLeitplanken({ art: 'loeschen', kartenId: 'e1', karte: entscheidungsKarte })
    expect(urteil.fehler).toBe(tv.entscheidungTabu)
  })
  it('Gegenprobe: Löschen einer Wissens-Karte bleibt erlaubt', () => {
    const urteil = vorschlagLeitplanken({ art: 'loeschen', kartenId: 'w1', karte: wissensKarte })
    expect(urteil.fehler).toBeUndefined()
    expect(urteil.ok).toBe(true)
  })
  it('Gegenprobe: Status-Karte aktualisieren bleibt erlaubt (fester Titel)', () => {
    const urteil = vorschlagLeitplanken({
      art: 'aktualisieren',
      kartenId: 's1',
      karte: statusKarte,
      text: 'Neuer Stand'
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.titel).toBe('Status')
  })
})
