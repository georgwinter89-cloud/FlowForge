// Prüfungen zur Befehls-Ausführung des Tors (BAUPLAN 35).
// Diese hier fahren echte Prozesse — sie belegen, dass FlowForge einen
// Prüfbefehl überhaupt selbst abspielen kann: Rückgabecode, Ausgabe und
// Zeitlimit. Ohne diesen Beleg wäre das ganze Tor Theorie.
// Rot-vor-Grün: Vor dem Bauschritt gab es torProzess.js nicht (Import rot);
// beim Nachbauen wurde zusätzlich die Erwartung an den Rückgabecode
// verfälscht (0 statt 3) und lief nachweislich rot.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { befehlAbspielen } from '../src/main/torProzess.js'

let projekt

beforeEach(() => {
  projekt = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-torlauf-'))
})
afterEach(() => {
  fs.rmSync(projekt, { recursive: true, force: true })
})

describe('BAUPLAN 35 · Prüfbefehl wirklich abspielen', () => {
  it('meldet einen sauberen Durchlauf als grün', async () => {
    const messung = await befehlAbspielen(projekt, 'node -e "console.log(\'alles gut\')"')
    expect(messung.code).toBe(0)
    expect(messung.ausgabe).toContain('alles gut')
    expect(messung.zeitlimit).toBe(false)
  }, 30000)

  // Der Rückgabecode ist das ganze Urteil des Tors — ein Prüfbefehl MUSS bei
  // einem Fehlschlag mit Fehlercode enden, sonst hält FlowForge Rot für Grün.
  it('reicht den Fehlercode und die Fehlerausgabe durch', async () => {
    const messung = await befehlAbspielen(
      projekt,
      'node -e "console.error(\'FAIL tunnel.test.js\'); process.exit(3)"'
    )
    expect(messung.code).toBe(3)
    expect(messung.ausgabe).toContain('FAIL tunnel.test.js')
  }, 30000)

  it('läuft im Projektordner', async () => {
    fs.writeFileSync(path.join(projekt, 'beleg.txt'), 'da', 'utf8')
    const messung = await befehlAbspielen(projekt, 'node -e "console.log(require(\'fs\').existsSync(\'beleg.txt\'))"')
    expect(messung.ausgabe).toContain('true')
  }, 30000)

  // Ein hängender Testlauf darf den ganzen Lauf nicht anhalten — nach dem
  // Zeitlimit wird der Prozessbaum abgeräumt und das Ergebnis gilt als rot.
  it('bricht einen hängenden Befehl am Zeitlimit ab und wertet ihn als rot', async () => {
    const messung = await befehlAbspielen(projekt, 'node -e "setTimeout(()=>{}, 60000)"', {
      zeitlimitMs: 2000
    })
    expect(messung.zeitlimit).toBe(true)
    expect(messung.code).not.toBe(0)
  }, 30000)
})
