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

  // Diese zwei Prüfungen hielten bis zur Nacharbeit B genau das fest, was der
  // Prüfer als Befund meldete: „gaming-pc:8080" wurde still verworfen. Das war
  // eine Bauer-Entscheidung, keine Vorgabe — sie ist jetzt umgedreht (Befund 3,
  // Prüfungen dazu weiter unten). Übrig bleibt die Zusage für das, was
  // FlowForge wirklich nicht retten kann.
  it('eine unbrauchbare Eingabe lässt die alte Adresse stehen — ohne Fehler', () => {
    schreiben({ searxngAdresse: 'http://gaming-pc:8080' })
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: 'file:///C:/geheim' })
    expect(e.ok).toBe(true)
    expect(e.einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
  })

  it('eine unbrauchbare Eingabe ohne gespeicherte Adresse bleibt leer', () => {
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: 'data:text/plain,geheim' })
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

// ——— Nacharbeit B ——————————————————————————————————————————————————————————

const { adresseBereinigen, searxngAdresseBereinigen } = await import(
  '../src/shared/lokalRegeln.js'
)
const { texte } = await import('../src/shared/texte.js')

const projektWurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (datei) => fs.readFileSync(path.join(projektWurzel, datei), 'utf8')

// ROT VOR GRÜN, gemessen 21.08.2026: Die Quelldateien dieser Nacharbeit wurden
// weggenommen (git stash über src/) und genau diese Prüfdatei gegen die alte
// Fassung gefahren. Ergebnis: 13 der 14 neuen Prüfungen rot — der Reihen-Test
// meldete für jede der fünf Schreibweisen „http://ALT:1" statt der ergänzten
// Adresse, die Großschreibungs-Prüfung dasselbe, searxngAdresseBereinigen gab
// es nicht, der Hinweistext trug noch „für ein bis zwei Minuten", und im
// Dialog fehlten sowohl die Zeile „Wird gespeichert als" als auch der Hinweis
// zum Block-Agenten. GRÜN war genau eine: die SPEC-Prüfung — der Integrator
// hatte §4.3 schon korrigiert, und dieser Abschnitt zieht den Einstellungstext
// nach. (Die zwei umgeschriebenen Prüfungen oben — file:// und data: — waren
// vorher wie nachher grün.)
describe('Nacharbeit B · Eine Adresse ohne Schema verschwindet nicht mehr still (Befund 3)', () => {
  // Nachstellweg des Prüfers, Hauptprozess-Hälfte: einstellungenSpeichern mit
  // genau der Schreibweise, die Georg im Browser tippt. Gemessen 20.08.2026
  // blieb der alte Wert stehen, ok=true, fehler=null — und ohne alten Wert
  // stand in der Datei "" ; jede Suche lief ab da still über die eingebaute
  // Quelle.
  it('„gaming-pc:8080" wird angenommen und mit http:// gespeichert', () => {
    schreiben({ searxngAdresse: 'http://ALT:1' })
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: 'gaming-pc:8080' })
    expect(e.ok).toBe(true)
    expect(e.einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
    expect(ausDatei().searxngAdresse).toBe('http://gaming-pc:8080')
  })

  it('der frische Fall: ohne gespeicherte Adresse bleibt das Feld nicht mehr leer', () => {
    const e = einstellungenSpeichern({ ...basis, searxngAdresse: 'gaming-pc:8080' })
    expect(e.einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
    expect(einstellungenLaden().einstellungen.searxngAdresse).toBe('http://gaming-pc:8080')
  })

  // Die Reihenmessung des Prüfers: fünf Schreibweisen, alle fielen still auf
  // „http://ALT:1" zurück.
  it('die Reihenmessung des Prüfers kommt jetzt vollständig durch', () => {
    const erwartet = {
      'gaming-pc:8080': 'http://gaming-pc:8080',
      '10.0.0.50:8080': 'http://10.0.0.50:8080',
      'localhost:8080': 'http://localhost:8080',
      '//gaming-pc:8080': 'http://gaming-pc:8080',
      'gaming-pc': 'http://gaming-pc'
    }
    for (const [eingabe, ziel] of Object.entries(erwartet)) {
      schreiben({ searxngAdresse: 'http://ALT:1' })
      const e = einstellungenSpeichern({ ...basis, searxngAdresse: eingabe })
      expect(e.einstellungen.searxngAdresse, eingabe).toBe(ziel)
    }
  })

  // Präzisierung (b) des Prüfers: Auch die Großschreibung fiel durch, weil die
  // Hausregel case-sensitive war.
  it('die Großschreibung des Schemas fällt nicht mehr durch', () => {
    for (const eingabe of ['HTTP://gaming-pc:8080', 'Http://gaming-pc:8080']) {
      schreiben({ searxngAdresse: 'http://ALT:1' })
      const e = einstellungenSpeichern({ ...basis, searxngAdresse: eingabe })
      expect(e.einstellungen.searxngAdresse, eingabe).toBe('http://gaming-pc:8080')
    }
  })

  it('eine öffentliche Instanz ohne Port bekommt https, ein Rechner im Netz http', () => {
    expect(searxngAdresseBereinigen('searx.example')).toBe('https://searx.example')
    expect(searxngAdresseBereinigen('searx.example/suche')).toBe('https://searx.example/suche')
    expect(searxngAdresseBereinigen('10.0.0.50')).toBe('http://10.0.0.50')
    expect(searxngAdresseBereinigen('gaming-pc:8080/searx')).toBe('http://gaming-pc:8080/searx')
  })

  it('was FlowForge nicht will, wird auch nicht ergänzt — file:, data:, ftp: bleiben ungültig', () => {
    for (const eingabe of ['file:///C:/geheim', 'data:text/plain,geheim', 'ftp://x', '   '])
      expect(searxngAdresseBereinigen(eingabe), eingabe).toBeNull()
  })

  it('die Ollama-Adressliste verwirft Unsinn weiter — nur die Schreibweise des Schemas ist egal', () => {
    // Die Liste darf NICHT mitziehen: Dort wäre eine still ergänzte
    // Fantasieadresse ein Fehler, der erst einen Lauf später auffällt
    // (Zusicherungen in einstellungenAdressen.test.js).
    expect(adresseBereinigen('quatsch')).toBeNull()
    expect(adresseBereinigen('gaming-pc:11434')).toBeNull()
    expect(adresseBereinigen('HTTP://gaming-pc:11434')).toBe('http://gaming-pc:11434')
  })

  it('der Dialog rechnet mit derselben Regel und verweigert Unbrauchbares mit Klartext', () => {
    const quelle = lesen('src/renderer/src/Einstellungen.jsx')
    // Live-Status und Speichern müssen dieselbe Adresse meinen — sonst fragt
    // der Status eine andere ab als die, die gespeichert wird.
    expect(quelle).toMatch(/searxngAdresseBereinigen\(searxngAdresse\)/)
    expect(quelle).toContain('t.fehlerSearxngAdresse')
    expect(quelle).toContain('t.searxngErgaenzt')
  })
})

describe('Nacharbeit B · Der Einstellungstext verspricht keine zu kurze Sperre mehr (Befund 4)', () => {
  // Gemessen 20./21.08.2026: Der Text sagte „sperrt sie für ein bis zwei
  // Minuten". Schon die dritte Suche war dicht; in einer Messung hielt die
  // Sperre über 18 Minuten, in einer zweiten über 96 Minuten an — davon eine
  // belegte 50-Minuten-Strecke völliger Funkstille. Georg hätte nach zwei
  // Minuten nachgesehen und die Quelle immer noch dicht gefunden.
  const hinweis = () => texte.einstellungen.searxngHinweis

  it('die widerlegte Zusage „ein bis zwei Minuten" steht nicht mehr da', () => {
    expect(hinweis()).not.toMatch(/ein bis\s+zwei Minuten/)
    expect(hinweis()).not.toMatch(/zwei Minuten/)
  })

  it('stattdessen steht dort, was gemessen ist: zeitweise, meist Minuten, auch über eine Stunde', () => {
    expect(hinweis()).toContain('zeitweise')
    expect(hinweis()).toContain('Minuten')
    expect(hinweis()).toContain('Stunde')
  })

  it('und der Ausweg steht dabei: Ticker statt „nichts gefunden", eigene Instanz für Dauerbetrieb', () => {
    expect(hinweis()).toContain('Ticker')
    expect(hinweis()).toContain('nichts gefunden')
    expect(hinweis()).toMatch(/regelmäßig/)
    expect(hinweis()).toContain('SearXNG')
  })

  it('SPEC und Einstellungstext widersprechen sich nicht mehr', () => {
    const spec = lesen('SPEC.md')
    const abschnitt = spec.slice(spec.indexOf('**Websuche der lokalen Blöcke**'))
    expect(abschnitt.slice(0, 3000)).toContain('über eine Stunde')
    expect(abschnitt.slice(0, 3000)).not.toMatch(/45–241 s/)
  })
})

describe('Nacharbeit B · Das SearXNG-Feld sagt, wann es wirkt (Befund 6)', () => {
  // Gemessen 20.08.2026 in der gebauten App: Bei eingeschalteter Helfer-KI und
  // ausgeschaltetem Block-Agenten war der Abschnitt sichtbar, fragte die
  // Adresse wirklich ab (1 HTTP-Anfrage am Zählserver) und zeigte Grün — aber
  // keine einzige Suche konnte je stattfinden, weil es gar keine lokalen
  // Blöcke gab. Entschieden im Hausgeist „Rückfrage statt Sperre": sichtbar
  // lassen, ehrlich dazuschreiben.
  it('der Dialog zeigt den Hinweis genau dann, wenn der Block-Agent aus ist', () => {
    const quelle = lesen('src/renderer/src/Einstellungen.jsx')
    expect(quelle).toContain('t.websucheNurMitBlockAgent')
    expect(quelle).toMatch(/!lokalBlockAgent && \(/)
  })

  it('der Hinweis nennt das Häkchen beim Namen und nimmt das Feld nicht weg', () => {
    const text = texte.einstellungen.websucheNurMitBlockAgent
    expect(text).toContain('Lokale KI darf ganze Blöcke übernehmen')
    expect(text).toMatch(/trotzdem/)
  })
})
