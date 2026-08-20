// Prüfungen zur SearXNG-Adresse (Zwischenschritt 0.51.2, Bauvertrag Bauer A).
//
// Anlass, gemessen 20.08.2026: einstellungenSpeichern schreibt eine
// Positivliste aus namentlich gelisteten Feldern. Ein neues Feld, das dort
// fehlt, verschwindet beim ersten Speichern still — auch beim Erststart-Muster
// mit vollem Spread ({ ...geladen, motorModus }). Und die naheliegenden
// Wert-Muster des Hauses greifen hier alle daneben: Boolean(neu.X) verliert ein
// gespeichertes true, das ==-null-Muster kann ein bewusstes Leeren nie halten,
// und eine Weißliste fällt beim fehlenden Feld auf den Standard zurück.
// Tragfähig ist allein das Muster der Adress-Liste: Wert aus der DATEI
// übernehmen, wenn der Aufrufer ihn nicht schickt.
//
// Der wichtigste Nachstellweg steht deshalb unten: „Speichern OHNE das Feld".
// Die vorhandene Prüfung erststartWahl fängt nur die STANDARD-Hälfte —
// gemessen rot bei fehlender Positivliste, aber GRÜN bei stillem Datei-Verlust.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Eigener Datenordner: Die anderen Prüfdateien teilen sich den Stub-Ordner und
// schreiben dort einstellungen.json — hier darf nichts dazwischenfunken.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-websuche-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const { einstellungenLaden, einstellungenSpeichern } = await import('../src/main/einstellungen.js')

const dateiPfad = path.join(datenOrdner, 'einstellungen.json')
const schreiben = (daten) => fs.writeFileSync(dateiPfad, JSON.stringify(daten), 'utf8')
const ausDatei = () => JSON.parse(fs.readFileSync(dateiPfad, 'utf8'))
const basis = { motorModus: 'abo' }

beforeEach(() => {
  fs.rmSync(dateiPfad, { force: true })
})

describe('0.51.2 · SearXNG-Adresse: Standard', () => {
  it('ohne Datei ist das Feld leer — leer heißt „eingebaute Quelle"', () => {
    const { einstellungen } = einstellungenLaden()
    expect(einstellungen.searxngAdresse).toBe('')
  })

  it('eine ältere Datei ohne das Feld bekommt den leeren Standard', () => {
    schreiben({ motorModus: 'abo', lokaleHelferAktiv: true })
    expect(einstellungenLaden().einstellungen.searxngAdresse).toBe('')
  })
})

describe('0.51.2 · SearXNG-Adresse: Speichern', () => {
  it('eine eingetragene Adresse überlebt das Speichern — bereinigt', () => {
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: ' http://gaming-pc:8080/ ' })
    expect(e.ok).toBe(true)
    expect(e.einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
    expect(ausDatei().searxngAdresse).toBe('http://gaming-pc:8080')
    expect(einstellungenLaden().einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
  })

  // DER Nachstellweg (Fund 4): Jeder Dialog, der das Feld nicht kennt, würde
  // Georgs Adresse sonst beim nächsten Öffnen/Schließen still löschen.
  it('Speichern OHNE das Feld übernimmt die Adresse aus der Datei', () => {
    schreiben({ searxngAdresse: 'http://gaming-pc:8080' })
    const e = einstellungenSpeichern({ ...basis })
    expect(e.einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
    expect(ausDatei().searxngAdresse).toBe('http://gaming-pc:8080')
  })

  it('Speichern mit Leerstring leert bewusst — zurück zur eingebauten Quelle', () => {
    schreiben({ searxngAdresse: 'http://gaming-pc:8080' })
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: '' })
    expect(e.einstellungen.searxngAdresse).toBe('')
    expect(ausDatei().searxngAdresse).toBe('')
  })

  it('eine ungültige Eingabe lässt die alte Adresse stehen — ohne Fehler', () => {
    schreiben({ searxngAdresse: 'http://gaming-pc:8080' })
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: 'gaming-pc:8080' })
    expect(e.ok).toBe(true)
    expect(e.einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
  })

  it('eine ungültige Eingabe ohne gespeicherte Adresse bleibt leer', () => {
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: 'quatsch' })
    expect(e.ok).toBe(true)
    expect(e.einstellungen.searxngAdresse).toBe('')
  })

  it('Laden → Speichern des kompletten Satzes verliert die Adresse nicht (Erststart-Muster)', () => {
    schreiben({ searxngAdresse: 'http://gaming-pc:8080' })
    const geladen = einstellungenLaden().einstellungen
    const e = einstellungenSpeichern({ ...geladen, motorModus: 'abo' })
    expect(e.einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
  })

  it('das Feld überlebt auch mehrere Speichervorgänge hintereinander', () => {
    einstellungenSpeichern({ ...basis, searxngAdresse: 'http://gaming-pc:8080' })
    einstellungenSpeichern({ ...basis, lokaleHelferAktiv: true })
    einstellungenSpeichern({ ...basis, uebertragTest: true })
    expect(einstellungenLaden().einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
  })
})

describe('0.51.2 · Der Einstellungen-Dialog schickt das Feld wirklich mit', () => {
  const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const lesen = (datei) => fs.readFileSync(path.join(wurzel, datei), 'utf8')

  it('die handgeschriebene Feldliste in speichern() trägt searxngAdresse', () => {
    // Von keiner anderen Prüfung bewacht: Vergisst der Dialog das Feld, ist
    // der Hauptprozess-Rückfall zwar da — aber ein bewusstes Leeren käme nie
    // an, und der Fehler fiele erst im Alltag auf.
    const quelle = lesen('src/renderer/src/Einstellungen.jsx')
    expect(quelle).toMatch(/einstellungenSpeichern\(\{[\s\S]*searxngAdresse[\s\S]*\}\)/)
    expect(quelle).toMatch(/setSearxngAdresse\(e\.einstellungen\.searxngAdresse/)
  })

  it('Feld, Statuszeilen und Hinweis werden im Dialog auch angezeigt', () => {
    const quelle = lesen('src/renderer/src/Einstellungen.jsx')
    for (const schluessel of [
      't.websucheUeberschrift',
      't.searxngAdresse',
      't.searxngHinweis',
      't.searxngStatusBereit',
      't.searxngStatusKeinJson',
      't.searxngStatusGedrosselt',
      't.searxngStatusAus'
    ])
      expect(quelle, schluessel).toContain(schluessel)
  })

  it('die Status-Abfragen sind entprellt und räumen ihre Uhr wieder ab', () => {
    const quelle = lesen('src/renderer/src/Einstellungen.jsx')
    expect(quelle).toMatch(/STATUS_ENTPRELLUNG_MS/)
    expect(quelle).toMatch(/clearTimeout\(uhr\)/)
    // Renderer und Hauptprozess putzen die Adresse mit derselben Regel — sonst
    // fragt der Status eine andere Adresse ab als die, die gespeichert wird.
    expect(quelle).toMatch(/adresseBereinigen/)
    expect(quelle).not.toMatch(/helferStatusJeAdresse\[adresse\.trim\(\)\]/)
  })

  it('der Handgriff für „kein JSON" nennt formats und die offizielle Anleitung', async () => {
    const { texte } = await import('../src/shared/texte.js')
    expect(texte.einstellungen.searxngStatusKeinJson).toMatch(/settings\.yml/)
    expect(texte.einstellungen.searxngStatusKeinJson).toMatch(/formats/)
    expect(texte.einstellungen.searxngStatusKeinJson).toMatch(/json/)
    expect(texte.einstellungen.searxngStatusKeinJson).toMatch(
      'docs.searxng.org/admin/installation-docker.html'
    )
  })
})
