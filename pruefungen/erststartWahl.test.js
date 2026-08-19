// Prüfungen zur Erststart-Wahl und Abo-Regel (0.46.4, SPEC §2/§9): kein stiller
// Motor-Modus — ohne Wahl liefert einstellungenLaden motorGewaehlt=false, motorBereit
// verweigert mit Klartext, Speichern lehnt eine leere Wahl ab; ABO_MODUS_ERLAUBT
// bleibt true; derselbe ehrliche Abo-Satz steht im Erststart wie in den
// Einstellungen; README, LICENSE (MIT), FUNDING.yml und package.json passen zusammen.
// Rot-vor-Grün: mit `motorModus: 'abo'` in STANDARD wurde „ohne Datei nicht gewählt"
// rot; mit `neu.motorModus === 'api' ? 'api' : 'abo'` in einstellungenSpeichern wurde
// „leere Wahl abgelehnt" rot.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Eigener Datenordner: Die anderen Prüfdateien teilen sich den Stub-Ordner und
// schreiben dort einstellungen.json — hier darf nichts dazwischenfunken.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-erststart-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const { ABO_MODUS_ERLAUBT, einstellungenLaden, einstellungenSpeichern, motorBereit, motorGewaehlt } =
  await import('../src/main/einstellungen.js')
const { texte } = await import('../src/shared/texte.js')

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')

beforeEach(() => {
  fs.rmSync(path.join(datenOrdner, 'einstellungen.json'), { force: true })
})

describe('0.46.4 · Erststart-Wahl', () => {
  it('ohne Einstellungsdatei ist kein Motor-Modus gewählt', () => {
    const e = einstellungenLaden()
    expect(e.motorGewaehlt).toBe(false)
    expect(e.einstellungen.motorModus).toBe('')
    expect(motorGewaehlt(e.einstellungen)).toBe(false)
  })

  it('ein alter oder kaputter Wert in der Datei zählt nicht als Wahl', () => {
    fs.writeFileSync(path.join(datenOrdner, 'einstellungen.json'), JSON.stringify({ motorModus: 'egal' }))
    expect(einstellungenLaden().motorGewaehlt).toBe(false)
    fs.writeFileSync(path.join(datenOrdner, 'einstellungen.json'), JSON.stringify({ motorModus: 'abo' }))
    expect(einstellungenLaden().motorGewaehlt).toBe(true)
  })

  it('motorBereit verweigert ohne Wahl mit Klartext — und lässt Abo/API mit Schlüssel durch', () => {
    const ohne = motorBereit(einstellungenLaden().einstellungen)
    expect(ohne.ok).toBe(false)
    expect(ohne.fehler).toBe(texte.einstellungen.fehlerModusFehlt)
    expect(ohne.fehler).toMatch(/Wähle zuerst/)
    expect(motorBereit({ motorModus: 'abo', apiSchluessel: '' }).ok).toBe(true)
    expect(motorBereit({ motorModus: 'api', apiSchluessel: 'sk-ant-x' }).ok).toBe(true)
    expect(motorBereit({ motorModus: 'api', apiSchluessel: '' })).toEqual({
      ok: false,
      fehler: texte.einstellungen.fehlerApiSchluesselFehlt
    })
  })

  it('Speichern lehnt eine leere Wahl ab und macht sie nicht still zum Abo', () => {
    const leer = einstellungenSpeichern({ apiSchluessel: '', ausgabenObergrenzeUsd: 5 })
    expect(leer.ok).toBe(false)
    expect(leer.fehler).toBe(texte.einstellungen.fehlerModusFehlt)
    expect(fs.existsSync(path.join(datenOrdner, 'einstellungen.json'))).toBe(false)
    const unsinn = einstellungenSpeichern({ motorModus: 'egal', apiSchluessel: '', ausgabenObergrenzeUsd: 5 })
    expect(unsinn.ok).toBe(false)
  })

  it('nach der Wahl ist der Modus gewählt — Abo wie API', () => {
    const abo = einstellungenSpeichern({ motorModus: 'abo', apiSchluessel: '', ausgabenObergrenzeUsd: 5 })
    expect(abo.ok).toBe(true)
    expect(abo.motorGewaehlt).toBe(true)
    expect(einstellungenLaden().motorGewaehlt).toBe(true)
    expect(einstellungenLaden().einstellungen.motorModus).toBe('abo')
    const api = einstellungenSpeichern({ motorModus: 'api', apiSchluessel: 'sk-ant-x', ausgabenObergrenzeUsd: 5 })
    expect(api.ok).toBe(true)
    expect(einstellungenLaden().einstellungen.motorModus).toBe('api')
  })

  it('die Erststart-Wahl lässt die übrigen Einstellungen unangetastet', () => {
    // Was der Dialog mitgibt (…einstellungen, motorModus), kommt so wieder heraus.
    const vorher = einstellungenLaden().einstellungen
    const nachher = einstellungenSpeichern({ ...vorher, motorModus: 'abo' }).einstellungen
    for (const feld of Object.keys(vorher).filter((f) => f !== 'motorModus'))
      expect(nachher[feld], feld).toEqual(vorher[feld])
  })
})

describe('0.46.4 · Abo-Regel neu', () => {
  it('der Abo-Modus bleibt an — auch in veröffentlichten Versionen', () => {
    expect(ABO_MODUS_ERLAUBT).toBe(true)
    expect(einstellungenLaden().aboErlaubt).toBe(true)
  })

  it('der ehrliche Abrechnungs-Satz steht in den Einstellungen und im Erststart — derselbe Schlüssel', () => {
    const satz = texte.einstellungen.modusAboHinweis
    expect(satz).toMatch(/Abo-Kontingent/)
    expect(satz).toMatch(/getrennt abzurechnen/)
    expect(satz).toMatch(/vorher Bescheid/)
    expect(satz).toMatch(/API-Schlüssel der Weg/)
    expect(texte.einstellungen.modusAbo).not.toMatch(/empfohlen/)
    expect(satz).not.toMatch(/Nur für den eigenen Gebrauch/)
    const erststart = lesen('src/renderer/src/Erststart.jsx')
    expect(erststart).toMatch(/t\.modusAboHinweis/)
    expect(lesen('src/renderer/src/Einstellungen.jsx')).toMatch(/t\.modusAboHinweis/)
    // Kein Abbrechen, kein vorgewähltes Radio im Erststart.
    expect(erststart).not.toMatch(/t\.abbrechen|knopf-sekundaer/)
    expect(erststart).toMatch(/useState\(''\)/)
    // App.jsx zeigt den Dialog nur, solange nicht gewählt ist.
    expect(lesen('src/renderer/src/App.jsx')).toMatch(/motorGewaehlt === false && <Erststart/)
  })

  it('Lauf, Chat und Block-Assistent fragen motorBereit', () => {
    for (const datei of ['src/main/lauf.js', 'src/main/chat.js', 'src/main/blockAssistent.js']) {
      const quelle = lesen(datei)
      expect(quelle, datei).toMatch(/motorBereit\(/)
      expect(quelle, datei).not.toMatch(/ABO_MODUS_ERLAUBT/)
    }
  })
})

describe('0.46.4 · Veröffentlichung', () => {
  it('package.json: MIT, private, Version 0.46.4', () => {
    const paket = JSON.parse(lesen('package.json'))
    expect(paket.license).toBe('MIT')
    expect(paket.private).toBe(true)
    expect(paket.version).toBe('0.46.4')
  })

  it('LICENSE ist die MIT-Lizenz auf Georg Winter', () => {
    const lizenz = lesen('LICENSE')
    expect(lizenz).toMatch(/^MIT License/)
    expect(lizenz).toMatch(/Copyright \(c\) 2026 Georg Winter/)
  })

  it('README verweist auf SPEC und BAUPLAN, erklärt Abo/API mit beiden Zitaten und die Lizenz', () => {
    const readme = lesen('README.md')
    expect(readme).toMatch(/\[SPEC\.md\]\(SPEC\.md\)/)
    expect(readme).toMatch(/\[BAUPLAN\.md\]\(BAUPLAN\.md\)/)
    expect(readme).toMatch(/## Abo oder API-Schlüssel/)
    expect(readme).toMatch(/including agents built\s+on the Claude Agent SDK/)
    expect(readme).toMatch(/still draw from your subscription's usage limits/)
    expect(readme).toMatch(/15\. Juni 2026/)
    expect(readme).toMatch(/legal-and-compliance/)
    expect(readme).toMatch(/\[MIT\]\(LICENSE\)/)
    expect(readme).toMatch(/## Unterstützen/)
    expect(readme).toMatch(/Ein-Personen-Projekt/)
  })

  it('FUNDING.yml zeigt auf Georgs Sponsors-Profil — und auf kein fremdes', () => {
    const funding = lesen('.github/FUNDING.yml')
    // Ein falscher Name würde den Sponsor-Knopf auf ein fremdes Profil lenken.
    const aktiv = funding.split(/\r?\n/).filter((z) => z.trim() && !z.trim().startsWith('#'))
    expect(aktiv).toEqual(['github: [georgwinter89-cloud]'])
  })

  it('kein Geheimnis im getrackten Repo (Schlüssel, Heimnetz-IP, Nutzerpfad)', () => {
    const dateien = execSync('git ls-files', { cwd: wurzel, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((d) => d && !d.endsWith('.ttf') && !d.endsWith('.png') && d !== 'package-lock.json')
    for (const datei of dateien) {
      const inhalt = fs.readFileSync(path.join(wurzel, datei), 'utf8')
      expect(inhalt, datei).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/)
      expect(inhalt, datei).not.toMatch(/192\.168\.\d+\.\d+/)
      expect(inhalt, datei).not.toMatch(/Users[\\/]+(?!Georg[\\/])[A-Za-z0-9._-]+[\\/]+AppData/)
    }
  })
})
