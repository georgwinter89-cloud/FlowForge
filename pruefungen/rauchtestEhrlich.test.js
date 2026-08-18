// Prüfungen zum ehrlichen Rauchtest (Zwischenschritt 0.46.2) — mit ECHTEN
// Prozessen: Der Rauchtest sagt, warum er rot ist (Fehlercode + Ausgabe), und
// prüft den Port der Startanleitungs-Adresse VOR dem Start: Ein Besitzer aus
// diesem Lauf wird abgeräumt, ein fremder führt zu „übersprungen" statt zu Rot.
// Rot vor Grün: Bis 0.46.1 lieferte rauchtest() bei 'keine' nur { geprueft,
// grund } (kein code, keine ausgabe), kannte weder Port-Prüfung noch
// 'portFremd' — ein fremder Listener auf dem Port endete als EADDRINUSE-Rot mit
// Nachbesserungs-Runde für den Bauer (Life-OS-Lauf 18.08.2026, Port 3888), und
// prozessZugehoerigkeit gab es nicht (Import rot).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { rauchtest } from '../src/main/torProzess.js'
import { startanleitungSetzen } from '../src/main/startanleitung.js'
import {
  prozessWurzelMelden,
  prozessgruppeAbraeumen,
  prozessZugehoerigkeit
} from '../src/main/prozesse.js'

let projekt
const kinder = []

beforeEach(() => {
  projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-rauchtest-'))
})
afterEach(async () => {
  for (const kind of kinder.splice(0)) {
    try {
      kind.kill()
    } catch {
      // schon tot
    }
  }
  fs.rmSync(projekt, { recursive: true, force: true })
})

// Ein freier Port: kurz binden, ablesen, wieder freigeben.
function freierPort() {
  return new Promise((aufloesen, ablehnen) => {
    const server = net.createServer()
    server.on('error', ablehnen)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => aufloesen(port))
    })
  })
}

// Ein fremder Listener (Kind der Prüfung, keiner FlowForge-Gruppe bekannt),
// der auf dem Port lauscht — meldet 'lauscht', sobald er dran ist.
function listenerStarten(port) {
  return new Promise((aufloesen, ablehnen) => {
    const kind = spawn(
      process.execPath,
      ['-e', `require('http').createServer((q,r)=>r.end('alt')).listen(${port}, () => console.log('lauscht'))`],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
    )
    kinder.push(kind)
    let puffer = ''
    kind.stdout.on('data', (stueck) => {
      puffer += String(stueck)
      if (puffer.includes('lauscht')) aufloesen(kind)
    })
    kind.on('exit', () => ablehnen(new Error('Listener starb vor dem Lauschen')))
    kind.on('error', ablehnen)
  })
}

const serverBefehl = (port) =>
  `node -e "require('http').createServer((q,r)=>r.end('neu')).listen(${port}, () => console.log('Server lauscht auf ${port}'))"`

describe('0.46.2 · Rauchtest sagt, warum', () => {
  it('liefert auch ohne Startanleitung die volle Form — mit Grund, ohne Urteil', async () => {
    const probe = await rauchtest(projekt)
    expect(probe).toEqual({ geprueft: false, gruen: null, code: null, ausgabe: '', grund: 'keine' })
  }, 30000)

  // Gemessen vor der Behebung: Nach dem Anlauf räumte FlowForge die noch
  // laufende App ab (taskkill /F), Windows meldete dafür Fehlercode 1, und der
  // Rauchtest hielt das für „stirbt mit Fehlercode" — jede App, die einfach
  // weiterlief, war rot. Jetzt zählt der Stand VOR dem Abräumen: code null.
  it('wertet eine App, die ohne Adresse einfach weiterläuft, als grün — ohne den Fehlercode des eigenen Abräumens', async () => {
    expect(
      startanleitungSetzen(projekt, {
        beschreibung: 'Dauerläufer',
        befehl: 'node -e "setInterval(()=>{}, 1000); console.log(\'läuft\')"'
      }).ok
    ).toBe(true)
    const probe = await rauchtest(projekt)
    expect(probe.geprueft).toBe(true)
    expect(probe.gruen).toBe(true)
    expect(probe.code).toBeNull()
    expect(probe.ausgabe).toContain('läuft')
  }, 60000)

  it('reicht Fehlercode und Ausgabe eines Startversuchs durch, der an EADDRINUSE stirbt', async () => {
    const port = await freierPort()
    await listenerStarten(port)
    // Ohne Adresse gibt es keine Port-Prüfung — der Befehl läuft und stirbt.
    expect(startanleitungSetzen(projekt, { beschreibung: 'Server', befehl: serverBefehl(port) }).ok).toBe(true)
    const probe = await rauchtest(projekt)
    expect(probe.geprueft).toBe(true)
    expect(probe.gruen).toBe(false)
    expect(probe.code).toBe(1)
    expect(probe.ausgabe).toContain('EADDRINUSE')
    expect(probe.grund).toBeNull()
  }, 60000)
})

describe('0.46.2 · Port-Prüfung vor dem Rauchtest', () => {
  it('überspringt bei einem fremden Listener mit Grund portFremd und nennt den Besitzer — kein Rot', async () => {
    const port = await freierPort()
    const fremd = await listenerStarten(port)
    expect(prozessZugehoerigkeit(fremd.pid, 0, projekt)).toBeNull()
    expect(
      startanleitungSetzen(projekt, {
        beschreibung: 'Web-App',
        befehl: serverBefehl(port),
        adresse: `http://127.0.0.1:${port}`
      }).ok
    ).toBe(true)
    const probe = await rauchtest(projekt)
    expect(probe.geprueft).toBe(false)
    expect(probe.gruen).toBeNull()
    expect(probe.grund).toBe('portFremd')
    expect(probe.port).toBe(port)
    expect(probe.besitzer?.pid).toBe(fremd.pid)
    expect(probe.besitzer?.name.toLowerCase()).toContain('node')
    // Der fremde Server lebt noch — FlowForge hat ihn nicht angefasst.
    expect(fremd.exitCode).toBeNull()
  }, 60000)

  it('räumt einen Listener ab, der als Wurzel dieses Laufs gemeldet ist, wartet auf den Port und misst dann grün', async () => {
    const port = await freierPort()
    const waise = await listenerStarten(port)
    const gruppe = 'lauf:' + projekt
    prozessWurzelMelden(gruppe, projekt, waise.pid)
    expect(prozessZugehoerigkeit(waise.pid, 0, projekt)).toBe('gruppe')
    try {
      expect(
        startanleitungSetzen(projekt, {
          beschreibung: 'Web-App',
          befehl: serverBefehl(port),
          adresse: `http://127.0.0.1:${port}`
        }).ok
      ).toBe(true)
      const probe = await rauchtest(projekt, { gruppe: 'rauchtest:' + projekt + ':bauer' })
      expect(probe.grund).toBeNull()
      expect(probe.abgeraeumt?.map((p) => p.pid)).toEqual([waise.pid])
      expect(probe.port).toBe(port)
      expect(probe.geprueft).toBe(true)
      expect(probe.gruen).toBe(true)
      // Der Server lief noch, als der Rauchtest ihn stoppte — kein Fehlercode.
      expect(probe.code).toBeNull()
      expect(probe.ausgabe).toContain('Server lauscht auf ' + port)
      // Der Waise ist wirklich weg.
      await new Promise((r) => setTimeout(r, 300))
      expect(waise.exitCode !== null || waise.signalCode !== null).toBe(true)
    } finally {
      await prozessgruppeAbraeumen(gruppe)
    }
  }, 90000)
})
