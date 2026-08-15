// Prüfungen zur Prozess-Hygiene und zum App-Tab (BAUPLAN 32): transitive
// Nachkommen mit toten Eltern, PID-Wiederverwendung, Verwaisten-Heuristik,
// ANSI-Strippen und \r-Überschreiben der App-Ausgabe, lokaler Port.
import { describe, it, expect } from 'vitest'
import {
  nachkommenErweitern,
  wurzelAufnehmen,
  wurzelnNachtragen,
  verwaisteKandidaten,
  ansiEntfernen,
  ausgabeAnhaengen,
  lokalerPort
} from '../src/main/prozessRegeln.js'

function schnappschuss(liste) {
  return new Map(
    liste.map(([pid, eltern, start, name = 'x.exe', befehl = name]) => [
      pid,
      { pid, eltern, start, name, befehl }
    ])
  )
}

describe('Nachkommen transitiv merken', () => {
  it('nimmt Kinder und Enkel der Wurzel auf — auch wenn die Zwischen-Shell längst tot ist', () => {
    const bekannt = new Map()
    wurzelAufnehmen(bekannt, 100)
    // Runde 1: Motor 100 → bash 200 → node 300
    let s = schnappschuss([
      [1, 0, 1],
      [100, 1, 10, 'claude.exe'],
      [200, 100, 20, 'bash.exe'],
      [300, 200, 30, 'node.exe']
    ])
    wurzelnNachtragen(bekannt, s)
    expect(nachkommenErweitern(bekannt, s).map((e) => e.pid).sort()).toEqual([200, 300])
    expect(bekannt.get(100).start).toBe(10)
    // Runde 2: bash tot, node lebt mit toter Eltern-Kennung, neues Enkelkind 400
    s = schnappschuss([
      [1, 0, 1],
      [100, 1, 10, 'claude.exe'],
      [300, 200, 30, 'node.exe'],
      [400, 300, 40, 'node.exe']
    ])
    expect(nachkommenErweitern(bekannt, s).map((e) => e.pid)).toEqual([400])
    expect(bekannt.get(200).lebt).toBe(false)
    expect(bekannt.get(300).lebt).toBe(true)
  })

  it('erkennt wiederverwendete PIDs und nimmt deren Kinder nicht auf', () => {
    const bekannt = new Map()
    wurzelAufnehmen(bekannt, 100)
    let s = schnappschuss([
      [100, 1, 10],
      [200, 100, 20]
    ])
    wurzelnNachtragen(bekannt, s)
    nachkommenErweitern(bekannt, s)
    // PID 200 taucht mit neuer Startzeit auf (fremder Prozess) und hat ein Kind
    s = schnappschuss([
      [100, 1, 10],
      [200, 1, 99],
      [201, 200, 100]
    ])
    expect(nachkommenErweitern(bekannt, s)).toEqual([])
    expect(bekannt.get(200).wiederverwendet).toBe(true)
    expect(bekannt.get(200).lebt).toBe(false)
    expect(bekannt.has(201)).toBe(false)
  })

  it('lehnt Kinder ab, die älter sind als ihr vermeintlicher Elternteil', () => {
    const bekannt = new Map()
    wurzelAufnehmen(bekannt, 100)
    const s = schnappschuss([
      [100, 1, 50],
      [200, 100, 20] // startete VOR der Wurzel → die PID 100 wurde neu vergeben
    ])
    wurzelnNachtragen(bekannt, s)
    expect(nachkommenErweitern(bekannt, s)).toEqual([])
  })
})

describe('Verwaisten-Heuristik', () => {
  const fenster = [{ von: 100, bis: 200, schluessel: 'lauf:x' }]
  it('findet verwaiste Prozesse aus dem Lauf-Zeitfenster, keine Kinder von FlowForge, keine lebenden Familien', () => {
    const s = schnappschuss([
      [1, 0, 1, 'explorer.exe'],
      [7, 1, 5, 'flowforge.exe'],
      [8, 7, 6, 'claude.exe'],
      [300, 999, 150, 'node.exe', 'node server.js'], // Elternteil tot → Kandidat
      [301, 1, 150, 'Code.exe'], // Elternteil lebt → nein
      [302, 999, 50, 'node.exe'], // vor dem Fenster → nein
      [303, 999, 150, 'svchost.exe', ''] // ohne Befehlszeile → nein
    ])
    const treffer = verwaisteKandidaten(s, { fenster, eigenePid: 7, ausgeschlossen: new Set() })
    expect(treffer.map((p) => p.pid)).toEqual([300])
  })
  it('lässt ausgeschlossene (aktive Gruppen) weg', () => {
    const s = schnappschuss([[300, 999, 150, 'node.exe']])
    expect(
      verwaisteKandidaten(s, { fenster, eigenePid: 7, ausgeschlossen: new Set([300]) })
    ).toEqual([])
  })
})

describe('App-Ausgabe', () => {
  it('strippt ANSI-Farben und Cursor-Steuerung', () => {
    expect(ansiEntfernen('\x1b[32mgrün\x1b[0m und \x1b[2K\x1b[1Gzurück')).toBe('grün und zurück')
    expect(ansiEntfernen('\x1b]0;Titel\x07Text')).toBe('Text')
  })
  it('\\r überschreibt die aktuelle Zeile, \\r\\n bleibt Zeilenumbruch', () => {
    let p = ausgabeAnhaengen('', 'Lade 10%\rLade 50%\rLade 100%\r\nFertig\n', 1000)
    expect(p).toBe('Lade 100%\nFertig\n')
    p = ausgabeAnhaengen(p, 'Zeile ohne Ende', 1000)
    expect(p).toBe('Lade 100%\nFertig\nZeile ohne Ende')
  })
  it('hält die Obergrenze und schneidet vorn zeilenweise ab', () => {
    const p = ausgabeAnhaengen('', 'aaaa\nbbbb\ncccc\n', 9)
    expect(p).toBe('cccc\n')
  })
  it('behält Umlaute', () => {
    expect(ausgabeAnhaengen('', 'Server läuft auf Port 3000 — Grüße\n', 100)).toContain('Grüße')
  })
})

describe('Lokaler Port', () => {
  it('liest den Port lokaler Adressen, sonst null', () => {
    expect(lokalerPort('http://localhost:3000/')).toBe(3000)
    expect(lokalerPort('http://127.0.0.1:8080/api')).toBe(8080)
    expect(lokalerPort('https://localhost/')).toBe(443)
    expect(lokalerPort('http://0.0.0.0:5000')).toBe(5000)
    expect(lokalerPort('http://[::1]:4000')).toBe(4000)
    expect(lokalerPort('https://example.com:3000')).toBe(null)
    expect(lokalerPort('index.html')).toBe(null)
  })
})
