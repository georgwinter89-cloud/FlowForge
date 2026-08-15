// Prüfungen zum Co-Pilot (BAUPLAN 27/33): Startplan (Lauf-Session fortsetzen,
// frisch, ohne Lauf, Übersicht), Laufbericht-Kontext, Bild-Deckel, Marke und
// Verlaufs-Abschnitt, SPEC-Index, die Rechte der Betriebsarten (auch während
// eines Laufs), die App-Werkzeuge und die Datenordner-Sperre der Übersicht.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  chatStartplan,
  laufberichtKontext,
  bildBloecke,
  verlaufSeitMarke,
  markenText
} from '../src/main/chat.js'
import {
  chatAenderung,
  pruefeWerkzeug,
  pruefeWerkzeugUebersicht
} from '../src/main/motor/claudeCodeMotor.js'
import { specIndexErzeugen, specIndexText } from '../src/main/specWissen.js'
import { texte } from '../src/shared/texte.js'

const PROJEKT = 'D:\\Projekte\\Uebungsprojekt'
const DATENORDNER = 'C:\\Users\\Georg\\AppData\\Roaming\\flowforge'

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

describe('Co-Pilot · Startplan (fortsetzen, frisch, ohne Lauf, Übersicht)', () => {
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
  it('ohne Laufbericht: frisch mit Projekt- und FlowForge-Wissen — ehrlich vermerkt', () => {
    const plan = chatStartplan(null)
    expect(plan.fortsetzen).toBeNull()
    expect(plan.hinweis).toBe(texte.chat.hinweisOhneLauf)
  })
  it('in der Übersicht (kein Projekt): nur Bedienfragen, keine Fortsetzung', () => {
    const plan = chatStartplan(
      bericht({ laufSitzung: { kennung: 'sitz-1', tokens: 1 } }),
      undefined,
      false
    )
    expect(plan.fortsetzen).toBeNull()
    expect(plan.hinweis).toBe(texte.chat.hinweisUebersicht)
  })
})

describe('Co-Pilot · Laufbericht als Kontext der frischen Session', () => {
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

describe('Co-Pilot · Bild-Anhänge (Strg+V / Datei-Knopf)', () => {
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

describe('Co-Pilot · Marke und Verlaufs-Abschnitt (neue Lauf-Session)', () => {
  it('in den Laufbericht wandert nur der Abschnitt nach der letzten Marke', () => {
    const verlauf = [
      { rolle: 'mensch', text: 'alt' },
      { rolle: 'ki', text: 'alt-antwort' },
      { rolle: 'marke', text: 'ab hier …' },
      { rolle: 'hinweis', text: 'Grundlage' },
      { rolle: 'mensch', text: 'neu' }
    ]
    const abschnitt = verlaufSeitMarke(verlauf)
    expect(abschnitt.map((e) => e.text)).toEqual(['Grundlage', 'neu'])
  })
  it('ohne Marke ist der ganze Verlauf der Abschnitt', () => {
    expect(verlaufSeitMarke([{ rolle: 'mensch', text: 'a' }]).length).toBe(1)
    expect(verlaufSeitMarke(undefined)).toEqual([])
  })
  it('die Marke nennt Datum und Uhrzeit der neuen Lauf-Session', () => {
    const text = markenText('2026-08-15T12:32:00.000Z')
    expect(text).toContain('neue Lauf-Session')
    expect(text).toMatch(/\d\d\.\d\d\., \d\d:\d\d/)
  })
  it('eine unlesbare Zeit ergibt die Marke ohne Zeit — kein Absturz', () => {
    expect(markenText('kaputt')).toBe(texte.chat.markeOhneZeit)
  })
})

describe('Co-Pilot · SPEC-Index mit Zeilenbereichen', () => {
  const spec = [
    '# FlowForge — Produkt-Spezifikation',
    '',
    'Stand …',
    '## 1. Was FlowForge ist',
    'Text',
    'Text',
    '## 2. Plattform',
    '### 2.1 Motor',
    'a',
    '### 2.2 Rückfall',
    'b',
    '## 3. Projekte',
    'c'
  ].join('\n')
  it('findet die Abschnitte der Ebenen 2 und 3 mit richtigen Zeilenbereichen', () => {
    const eintraege = specIndexErzeugen(spec)
    expect(eintraege.map((e) => [e.titel, e.von, e.bis])).toEqual([
      ['1. Was FlowForge ist', 4, 6],
      ['2. Plattform', 7, 11],
      ['2.1 Motor', 8, 9],
      ['2.2 Rückfall', 10, 11],
      ['3. Projekte', 12, 13]
    ])
  })
  it('der Index-Text nennt je Abschnitt die Zeilen', () => {
    const text = specIndexText(specIndexErzeugen(spec))
    expect(text).toContain('Zeilen 4–6: 1. Was FlowForge ist')
    expect(text).toContain('  Zeilen 8–9: 2.1 Motor')
  })
  it('die echte SPEC.md liefert einen Index mit den Kern-Abschnitten', () => {
    const eintraege = specIndexErzeugen(fs.readFileSync('SPEC.md', 'utf8'))
    const titel = eintraege.map((e) => e.titel).join(' | ')
    expect(titel).toContain('Live-Ansicht & Eingriff')
    expect(titel).toContain('GUI-Grundaufbau')
  })
})

describe('Co-Pilot · Sicherungspunkt-Auslöser (erste Änderung)', () => {
  it('Schreib-Werkzeuge und verändernde Befehle zählen als Änderung', () => {
    expect(chatAenderung('Write', { file_path: 'a.js' })).toBe(true)
    expect(chatAenderung('Edit', { file_path: 'a.js' })).toBe(true)
    expect(chatAenderung('Bash', { command: 'npm test' })).toBe(true)
    expect(chatAenderung('mcp__start__startanleitung_setzen', {})).toBe(true)
  })
  it('Lesen, rein lesende Befehle, Karten und App-Werkzeuge zählen nicht', () => {
    expect(chatAenderung('Read', { file_path: 'a.js' })).toBe(false)
    expect(chatAenderung('Grep', {})).toBe(false)
    expect(chatAenderung('Bash', { command: 'dir' })).toBe(false)
    // Karten laufen über FlowForges harte Kartenregeln — kein Datei-Risiko.
    expect(chatAenderung('mcp__karten__karte_anlegen', {})).toBe(false)
    // Die App starten ändert keine Projektdatei (eigener Prozess im App-Tab).
    expect(chatAenderung('mcp__app__app_starten', {})).toBe(false)
  })
})

describe('Co-Pilot · Rechte der Betriebsarten (Projekt)', () => {
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
  it('nur-lesend während eines Laufs: Befehle ausführen bleibt gesperrt (Einstellung gilt nicht)', () => {
    // Die Einstellung „nur-lesende Blöcke dürfen Befehle ausführen" wird vom
    // Chat während eines Laufs als AUS übergeben — npm test ist dann gesperrt.
    expect(nurLesen('Bash', { command: 'npm test' }).gesperrt).toBeTruthy()
    expect(nurLesen('Bash', { command: 'dir src' }).erlaubt).toBe(true)
  })
  it('reparieren: Datei im Projektordner ändern und Befehle wie npm install erlaubt', () => {
    expect(reparieren('Edit', { file_path: 'a.js' }).erlaubt).toBe(true)
    expect(reparieren('Bash', { command: 'npm install' }).erlaubt).toBe(true)
  })
  it('reparieren: Git, Prüfmappe, Verwaltungsdateien und der Chat-Verlauf bleiben tabu', () => {
    expect(reparieren('Bash', { command: 'git status' }).gesperrt).toBeTruthy()
    expect(reparieren('Write', { file_path: 'pruefung\\test.js' }).gesperrt).toBeTruthy()
    expect(reparieren('Write', { file_path: 'karten.json' }).gesperrt).toBeTruthy()
    expect(reparieren('Write', { file_path: 'chat.json' }).gesperrt).toBeTruthy()
  })
  it('reparieren: Schreiben außerhalb des Projektordners löst die Rückfrage aus', () => {
    expect(reparieren('Write', { file_path: 'C:\\Windows\\a.txt' }).frage).toBeTruthy()
  })
  it('App-Werkzeuge: Ausgabe lesen immer frei; starten/stoppen im Reparatur-Modus frei, sonst Rückfrage', () => {
    expect(nurLesen('mcp__app__app_ausgabe', {}).erlaubt).toBe(true)
    expect(nurLesen('mcp__app__app_starten', {}).frage).toBe(texte.rechteFrage.appBedienen)
    expect(nurLesen('mcp__app__app_stoppen', {}).frage).toBe(texte.rechteFrage.appBedienen)
    expect(reparieren('mcp__app__app_starten', {}).erlaubt).toBe(true)
    expect(reparieren('mcp__app__app_neustarten', {}).erlaubt).toBe(true)
  })
  it('App-Werkzeuge: einen fremden Port-Besitzer beenden fragt immer — auch im Reparatur-Modus', () => {
    expect(reparieren('mcp__app__app_starten', { port_freimachen: true }).frage).toBe(
      texte.rechteFrage.appPortFreimachen
    )
  })
})

describe('Co-Pilot · Übersicht (kein Projekt): Datenordner gesperrt, nur Bedienfragen', () => {
  const u = (name, eingabe) => pruefeWerkzeugUebersicht(name, eingabe, DATENORDNER)
  it('liest die Produktbeschreibung über ihren absoluten Pfad', () => {
    expect(u('Read', { file_path: 'C:\\Programme\\FlowForge\\resources\\SPEC.md' }).erlaubt).toBe(true)
  })
  it('sperrt jeden Zugriff in den Datenordner — relativ wie absolut', () => {
    expect(u('Read', { file_path: 'einstellungen.json' }).gesperrt).toBeTruthy()
    expect(u('Read', { file_path: DATENORDNER + '\\einstellungen.json' }).gesperrt).toBeTruthy()
    expect(u('Grep', { pattern: 'apiSchluessel' }).gesperrt).toBeTruthy()
    expect(u('Glob', { pattern: '**/*.json', path: DATENORDNER }).gesperrt).toBeTruthy()
  })
  it('sperrt Befehle und Schreiben hart', () => {
    expect(u('Bash', { command: 'dir' }).gesperrt).toBeTruthy()
    expect(u('Write', { file_path: 'C:\\x.txt' }).gesperrt).toBeTruthy()
    expect(u('mcp__karten__karte_anlegen', {}).gesperrt).toBeTruthy()
  })
  it('Unteraufgaben sind erlaubt (ihre Aufrufe laufen durch dieselbe Prüfung), Internet fragt', () => {
    expect(u('Agent', {}).erlaubt).toBe(true)
    expect(u('WebFetch', { url: 'https://example.org' }).frage).toBeTruthy()
  })
})
