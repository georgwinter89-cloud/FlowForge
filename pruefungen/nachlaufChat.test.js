// Prüfungen zum Nachlauf-Chat (BAUPLAN 27): Startplan (fortsetzen oder frisch),
// Laufbericht-Kontext, Bild-Deckel und die Rechte der beiden Betriebsarten.
import { describe, it, expect } from 'vitest'
import { chatStartplan, laufberichtKontext, bildBloecke } from '../src/main/nachlaufChat.js'
import { chatAenderung, pruefeWerkzeug } from '../src/main/motor/claudeCodeMotor.js'
import { texte } from '../src/shared/texte.js'

const PROJEKT = 'D:\\Projekte\\Uebungsprojekt'

function bericht(extra = {}) {
  return {
    workflow: 'Paket schneiden → Bauer → Prüfer',
    gestartetAm: '2026-08-14T10:00:00.000Z',
    zustand: 'erfolgreich',
    fehlertext: '',
    blockErgebnisse: [
      { block: 'Bauer', zustand: 'erfolgreich', ergebnisText: 'Feature gebaut.' },
      { block: 'Prüfer', zustand: 'pruefung-bestanden', ergebnisText: 'PRUEFUNG: BESTANDEN' }
    ],
    ...extra
  }
}

describe('Nachlauf-Chat · Startplan (fortsetzen oder frisch)', () => {
  it('setzt die Lauf-Session fort, wenn Kennung da und Füllstand unter der Wächter-Schwelle', () => {
    const plan = chatStartplan(
      bericht({ laufSitzung: { kennung: 'sitz-1', tokens: 50000, kontextFenster: 200000 } })
    )
    expect(plan.fortsetzen).toBe('sitz-1')
    expect(plan.hinweis).toBe(texte.chat.hinweisFortgesetzt)
  })
  it('startet frisch, wenn der Füllstand über der Wächter-Schwelle liegt — ehrlich vermerkt', () => {
    const plan = chatStartplan(
      bericht({ laufSitzung: { kennung: 'sitz-1', tokens: 190000, kontextFenster: 200000 } })
    )
    expect(plan.fortsetzen).toBeNull()
    expect(plan.hinweis).toBe(texte.chat.hinweisFrisch)
  })
  it('startet frisch, wenn der Laufbericht keine Session-Kennung trägt (alte Läufe)', () => {
    const plan = chatStartplan(bericht())
    expect(plan.fortsetzen).toBeNull()
    expect(plan.hinweis).toBe(texte.chat.hinweisFrisch)
  })
  it('rechnet ohne gemerkte Fenstergröße mit dem Standardfenster', () => {
    // 150.000 von 200.000 = 75 % → genau auf der Wächter-Schwelle → frisch.
    const plan = chatStartplan(bericht({ laufSitzung: { kennung: 'sitz-1', tokens: 150000 } }))
    expect(plan.fortsetzen).toBeNull()
  })
})

describe('Nachlauf-Chat · Laufbericht als Kontext der frischen Session', () => {
  it('enthält Workflow, Ausgang und die Block-Ergebnisse', () => {
    const kontext = laufberichtKontext(bericht())
    expect(kontext).toContain('Paket schneiden → Bauer → Prüfer')
    expect(kontext).toContain('Bauer')
    expect(kontext).toContain('Feature gebaut.')
    expect(kontext).toContain(texte.lauf.zustandLabels.erfolgreich)
  })
  it('kürzt ausufernde Block-Ergebnisse, statt den Kontext zu fluten', () => {
    const lang = 'x'.repeat(10000)
    const kontext = laufberichtKontext(
      bericht({ blockErgebnisse: [{ block: 'Bauer', zustand: 'erfolgreich', ergebnisText: lang }] })
    )
    expect(kontext.length).toBeLessThan(3000)
  })
  it('nennt den Fehlertext eines fehlgeschlagenen Laufs', () => {
    const kontext = laufberichtKontext(
      bericht({ zustand: 'fehlgeschlagen', fehlertext: 'Motor nicht angemeldet' })
    )
    expect(kontext).toContain('Motor nicht angemeldet')
  })
})

describe('Nachlauf-Chat · Bild-Anhänge (Strg+V / Datei-Knopf)', () => {
  const png = 'data:image/png;base64,' + 'A'.repeat(400)
  it('übersetzt eine gültige PNG-data-URL in einen Motor-Bildblock', () => {
    const geprueft = bildBloecke([png])
    expect(geprueft.ok).toBe(true)
    expect(geprueft.bloecke[0].source.media_type).toBe('image/png')
  })
  it('lehnt unbekannte Formate ab', () => {
    const geprueft = bildBloecke(['data:image/tiff;base64,AAAA'])
    expect(geprueft.ok).toBe(false)
    expect(geprueft.fehler).toBe(texte.chat.bildFormat)
  })
  it('lehnt mehr als 4 Bilder je Nachricht ab', () => {
    const geprueft = bildBloecke([png, png, png, png, png])
    expect(geprueft.ok).toBe(false)
    expect(geprueft.fehler).toBe(texte.chat.bildZuViele)
  })
  it('lehnt zu große Bilder ab (über 5 MB)', () => {
    const riesig = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024)
    const geprueft = bildBloecke([riesig])
    expect(geprueft.ok).toBe(false)
    expect(geprueft.fehler).toBe(texte.chat.bildZuGross)
  })
  it('ohne Bilder: leere Blockliste, kein Fehler', () => {
    expect(bildBloecke([]).ok).toBe(true)
    expect(bildBloecke(undefined).ok).toBe(true)
  })
})

describe('Nachlauf-Chat · Sicherungspunkt-Auslöser (erste Änderung)', () => {
  it('Schreib-Werkzeuge und verändernde Befehle zählen als Änderung', () => {
    expect(chatAenderung('Write', { file_path: 'a.js' })).toBe(true)
    expect(chatAenderung('Edit', { file_path: 'a.js' })).toBe(true)
    expect(chatAenderung('Bash', { command: 'npm test' })).toBe(true)
    expect(chatAenderung('mcp__start__startanleitung_setzen', {})).toBe(true)
  })
  it('Lesen und rein lesende Befehle zählen nicht', () => {
    expect(chatAenderung('Read', { file_path: 'a.js' })).toBe(false)
    expect(chatAenderung('Grep', {})).toBe(false)
    expect(chatAenderung('Bash', { command: 'dir' })).toBe(false)
    // Karten laufen über FlowForges harte Kartenregeln — kein Datei-Risiko.
    expect(chatAenderung('mcp__karten__karte_anlegen', {})).toBe(false)
  })
})

describe('Nachlauf-Chat · Rechte der beiden Betriebsarten', () => {
  // Nur-lesender Chat: wie ein Lese-Block mit darfKartenAnlegen (Audit-Muster).
  function nurLesen(name, eingabe) {
    return pruefeWerkzeug(name, eingabe, PROJEKT, true, false, true, false, true, false)
  }
  // „Chat darf reparieren": Rechte wie ein Bauer.
  function reparieren(name, eingabe) {
    return pruefeWerkzeug(name, eingabe, PROJEKT, false, false, true, false, true, false)
  }
  it('nur-lesend: Karte anlegen erlaubt, Datei ändern gesperrt', () => {
    expect(nurLesen('mcp__karten__karte_anlegen', {}).erlaubt).toBe(true)
    expect(nurLesen('Edit', { file_path: 'a.js' }).gesperrt).toBeTruthy()
  })
  it('nur-lesend: Karte aktualisieren bleibt gesperrt (nur Anlegen ist frei)', () => {
    expect(nurLesen('mcp__karten__karte_aktualisieren', {}).gesperrt).toBeTruthy()
  })
  it('reparieren: Datei im Projektordner ändern erlaubt', () => {
    expect(reparieren('Edit', { file_path: 'a.js' }).erlaubt).toBe(true)
  })
  it('reparieren: Git, Prüfmappe und Verwaltungsdateien bleiben tabu', () => {
    expect(reparieren('Bash', { command: 'git status' }).gesperrt).toBeTruthy()
    expect(reparieren('Write', { file_path: 'pruefung\\test.js' }).gesperrt).toBeTruthy()
    expect(reparieren('Write', { file_path: 'karten.json' }).gesperrt).toBeTruthy()
  })
  it('reparieren: Schreiben außerhalb des Projektordners löst die Rückfrage aus', () => {
    expect(reparieren('Write', { file_path: 'C:\\Windows\\a.txt' }).frage).toBeTruthy()
  })
})
