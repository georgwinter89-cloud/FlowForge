// Härte der Websuche (Nacharbeit A zu 0.51.2): die Nachstellwege der zwei
// Prüfer als Regel-Prüfungen — Laufzeit der Entkernung, Deckel auf Titel und
// Adresse, HTTP-Fehlerseiten, Gesamtfrist je Werkzeugaufruf, fehlende
// content-type-Kopfzeile, gemerkte Sperre und der kurze Grund im
// Rückgabeobjekt.
//
// Netzfrei wie websucheQuelle.test.js: Die Prüfer haben mit eigenen Servern auf
// 127.0.0.1 gemessen (und die searxngAdresse als Ausnahme missbraucht, um sie
// überhaupt abrufen zu dürfen). Hier tut es eine fetch-Attrappe — sie führt
// durch DENSELBEN Modulkörper, und die Abruf-Prüfungen laufen gegen literale
// Adressen aus dem Dokumentationsbereich 203.0.113.x, für die adressePruefen
// gar nicht erst im Namensdienst nachschlägt.
//
// ROT VOR GRÜN, gemessen am Stand 0418733 (Kopie des alten Moduls, node 24,
// 21.08.2026): Die Laufzeit-Prüfungen liefen mit 232.849 ms (1 MB „<!--"),
// 114.862 ms (900 kB „<a>") und über zehn Minuten (1 MB „<") ins Timeout; die
// Deckel-, Status-, Frist-, content-type- und grund-Prüfungen schlugen fehl,
// weil es die geprüfte Eigenschaft schlicht nicht gab (Titel 40.000 Zeichen,
// 404 als ok=true, 114 s Gesamtdauer, „keine Textseite (?)", grund undefined).
import { describe, it, expect, afterEach } from 'vitest'
import {
  WEB_DECKEL,
  htmlZuText,
  ddgZustand,
  ddgLiteTreffer,
  ddgHtmlTreffer,
  searxngTreffer,
  webseiteLesen,
  websucheDurchfuehren
} from '../src/main/motor/websuche.js'
import { texte } from '../src/shared/texte.js'

const w = texte.agentenWebsuche

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const echtesFetch = globalThis.fetch

// Attrappe mit Mitschrift. `antworten` ist eine Liste oder eine Funktion
// (adresse, nummer, signal) → Response. Das Zeitlimit-Signal wird
// durchgereicht, damit die Frist-Prüfungen einen echten langsamen Server
// nachstellen können.
function fetchAttrappe(antworten) {
  const rufe = []
  globalThis.fetch = async (adresse, optionen) => {
    rufe.push({ adresse: String(adresse), optionen })
    const naechste =
      typeof antworten === 'function'
        ? antworten(String(adresse), rufe.length, optionen?.signal)
        : antworten.shift()
    if (typeof naechste === 'function') return naechste()
    return naechste
  }
  return rufe
}

// Antwortet erst nach `verzoegerungMs` und bricht ab, sobald das Signal feuert
// — so verhält sich ein echter langsamer Server. `verzoegerungMs = Infinity`
// ist der Nachstellweg des Prüfers: ein Server, der NIE antwortet.
function verzoegert(bauen, verzoegerungMs) {
  return (adresse, nummer, signal) =>
    new Promise((fertig, scheitern) => {
      const uhr = Number.isFinite(verzoegerungMs)
        ? setTimeout(() => fertig(bauen(adresse, nummer)), verzoegerungMs)
        : null
      signal?.addEventListener('abort', () => {
        if (uhr) clearTimeout(uhr)
        scheitern(Object.assign(new Error('abgebrochen'), { name: 'TimeoutError' }))
      })
    })
}

// art === null heißt: GAR KEINE content-type-Kopfzeile. Ein String-Rumpf
// bekommt vom Response-Bau automatisch „text/plain" verpasst — deshalb muss er
// dafür als Bytes hineingehen (gemessen 21.08.2026).
function antwortMit(koerper, art, status = 200) {
  if (art === null)
    return new Response(
      typeof koerper === 'string' ? new TextEncoder().encode(koerper) : koerper,
      { status }
    )
  return new Response(koerper, { status, headers: { 'content-type': art } })
}

function schnell(fn) {
  const a = Date.now()
  const wert = fn()
  return { ms: Date.now() - a, wert }
}

afterEach(() => {
  globalThis.fetch = echtesFetch
})

// Setzt Deckel für die Dauer einer Prüfung um und stellt sie sicher zurück.
async function mitDeckel(werte, arbeit) {
  const alt = {}
  for (const [name, wert] of Object.entries(werte)) {
    alt[name] = WEB_DECKEL[name]
    WEB_DECKEL[name] = wert
  }
  try {
    return await arbeit()
  } finally {
    Object.assign(WEB_DECKEL, alt)
  }
}

// ---------------------------------------------------------------------------
// Fund 8: Eine feindselige Seite darf den Hauptprozess nicht einfrieren
// ---------------------------------------------------------------------------

// Der Stillstand ist reine Rechenzeit NACH dem Abruf. Kein Zeitlimit und kein
// Wächter kann dagegen helfen: Der Prüfer maß im echten Electron-Hauptprozess
// 0 von 1.964 erwarteten Timer-Takten. Deshalb wird hier die Laufzeit selbst
// geprüft. Die Grenze von 2.000 ms liegt gemessen rund 50-fach über dem
// heutigen Wert (4-36 ms) und rund 100-fach unter dem alten (232.849 ms).
const LAUFZEIT_GRENZE_MS = 2000

describe('0.51.2 · Entkernen bleibt auch bei bösartigem HTML linear (Fund 8)', () => {
  it('1 MB aus lauter Kommentar-ANFÄNGEN ohne Ende', () => {
    const rumpf = '<!--'.repeat(250000)
    const { ms, wert } = schnell(() => htmlZuText(rumpf))
    expect(ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    // Unverändert: Ohne „-->" ist da kein Kommentar, den man entfernen könnte.
    expect(wert.length).toBe(rumpf.length)
  })

  it('1 MB aus lauter „<" ohne jedes „>" — die teuerste Stelle, in keinem Befund', () => {
    const rumpf = '<'.repeat(1000000)
    const { ms, wert } = schnell(() => htmlZuText(rumpf))
    expect(ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    expect(wert.length).toBe(rumpf.length)
  })

  it('1 MB Rahmen-Marken ohne Ende (<script>, <title>)', () => {
    expect(schnell(() => htmlZuText('<script>'.repeat(125000))).ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    expect(schnell(() => htmlZuText('<title>'.repeat(140000))).ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    expect(schnell(() => htmlZuText('<script'.repeat(142857))).ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
  })

  it('der Kurztext eines Suchtreffers — er stammt von einer fremden Seite', () => {
    const boese = '<!-- ok -->' + '<!--'.repeat(60000) + 'x'.repeat(200000)
    const { ms, wert } = schnell(() =>
      searxngTreffer({ results: [{ title: boese, url: 'https://beispiel.de/', content: boese }] })
    )
    expect(ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    expect(wert).toHaveLength(1)
  })

  it('die Antwort der Suchquelle selbst (900 kB „<a>" ohne Ende)', () => {
    const rumpf = '<a>'.repeat(300000)
    expect(schnell(() => ddgZustand(rumpf)).ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    expect(schnell(() => ddgLiteTreffer(rumpf)).ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    expect(schnell(() => ddgHtmlTreffer(rumpf)).ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
  })

  it('viele offene Kurztext-Marken in einer Trefferliste', () => {
    // Eigene, engere Grenze: Dieser Weg war vorher „nur" 1.895 ms teuer (und
    // wäre unter 2.000 ms durchgerutscht), heute sind es 9 ms.
    const rumpf =
      "<a href='https://b.de/' class='result-link'>t</a>".repeat(2000) +
      "<td class='result-snippet'>x".repeat(20000)
    const { ms, wert } = schnell(() => ddgLiteTreffer(rumpf))
    expect(ms).toBeLessThan(500)
    expect(wert).toHaveLength(WEB_DECKEL.treffer)
  })

  it('Gegenprobe: eine harmlose 1-MB-Seite kommt unverändert und schnell durch', () => {
    const rumpf = '<html><body><p>' + 'Harmloser Text. '.repeat(62500) + '</p></body></html>'
    const { ms, wert } = schnell(() => htmlZuText(rumpf))
    expect(ms).toBeLessThan(LAUFZEIT_GRENZE_MS)
    expect(wert.startsWith('Harmloser Text.')).toBe(true)
    expect(wert).not.toMatch(/<|>/)
  })

  it('und das Entkernen tut weiter genau dasselbe wie vorher', () => {
    expect(htmlZuText('<!-- weg --><p>Da</p>')).toBe('Da')
    expect(htmlZuText('<p>a</p><!-- x --><p>b</p><!-- offen')).toBe('a\nb\n<!-- offen')
    // Ein Kommentaranfang ohne Ende beendet die Suche — der Rest bleibt Text.
    expect(htmlZuText('<!-- offen <p>Text</p>')).toBe('Text')
    expect(htmlZuText('<SCRIPT>geheim</SCRIPT><P>Gross</P>')).toBe('Gross')
    expect(htmlZuText('<script >x</script >y')).toBe('y')
    expect(htmlZuText('<scriptx>kein script</scriptx>')).toBe('kein script')
  })
})

// ---------------------------------------------------------------------------
// Fund 9: Der Deckel galt nur für den Kurztext
// ---------------------------------------------------------------------------

describe('0.51.2 · Titel und Adresse eines Treffers sind gedeckelt (Fund 9)', () => {
  const riesenTitel = 'T'.repeat(50000)
  const riesenKurztext = 'K'.repeat(50000)

  const liteRumpf = `<table><tr><td>
<a href="https://beispiel.de/eins" class='result-link'>${riesenTitel}</a></td></tr>
<tr><td class='result-snippet'>${riesenKurztext}</td></tr></table>`
  const htmlRumpf = `<div class="result"><h2><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fbeispiel.de%2Feins">${riesenTitel}</a></h2>
<a class="result__snippet">${riesenKurztext}</a></div>`
  const searxDaten = {
    results: [{ title: riesenTitel, url: 'https://beispiel.de/eins', content: riesenKurztext }]
  }

  it.each([
    ['lite/', () => ddgLiteTreffer(liteRumpf)],
    ['html/', () => ddgHtmlTreffer(htmlRumpf)],
    ['SearXNG', () => searxngTreffer(searxDaten)]
  ])('%s kürzt den Titel wie den Kurztext', (_name, holen) => {
    const treffer = holen()
    expect(treffer).toHaveLength(1)
    expect(treffer[0].titel.length).toBeLessThanOrEqual(WEB_DECKEL.titelZeichen + 1)
    expect(treffer[0].kurztext.length).toBeLessThanOrEqual(WEB_DECKEL.kurztextZeichen + 1)
    expect(treffer[0].adresse).toBe('https://beispiel.de/eins')
  })

  it('eine übermäßig lange Adresse lässt den Treffer weg statt sie abzuschneiden', () => {
    // Eine mit „…" gekürzte Adresse wäre für den nächsten webseite_lesen-Aufruf
    // unbrauchbar — der Deckel erzeugte dann bloß einen stillen Folgefehler.
    const lang = 'https://beispiel.de/' + 'u'.repeat(WEB_DECKEL.adresseZeichen)
    const treffer = searxngTreffer({
      results: [
        { title: 'Zu lang', url: lang, content: 'x' },
        { title: 'Kurz', url: 'https://beispiel.de/zwei', content: 'y' }
      ]
    })
    expect(treffer).toHaveLength(1)
    expect(treffer[0].adresse).toBe('https://beispiel.de/zwei')
    for (const t of treffer) expect(t.adresse).not.toMatch('…')
  })

  it('sechs bösartige Treffer sprengen kein 64k-Fenster mehr', () => {
    // Gemessen vor der Nacharbeit: 481.553 Zeichen tool_result ≈ 137.587
    // geschätzte Token — 210 % von Georgs Fenster in EINER Nachricht.
    const treffer = searxngTreffer({
      results: Array.from({ length: 20 }, (_, i) => ({
        title: riesenTitel,
        url: 'https://beispiel.de/' + i,
        content: riesenKurztext
      }))
    })
    const text = w.treffer(treffer)
    expect(treffer).toHaveLength(WEB_DECKEL.treffer)
    expect(text.length).toBeLessThan(6000)
  })

  it('der Seitentitel wird ebenfalls gedeckelt und zählt in zeichen mit', async () => {
    // Zweiter, direkterer Weg desselben Lochs: Die Zielseite gehört dem
    // Angreifer, ihr <title> ist frei wählbar. Gemessen vorher: tool_result
    // 300.109 Zeichen, Ticker meldete „(20 Zeichen)".
    fetchAttrappe([
      antwortMit(
        '<html><title>' + 'X'.repeat(300000) + '</title><body><p>Kurzer Inhalt.</p></body></html>',
        'text/html'
      )
    ])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/titel' })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.titel.length).toBeLessThanOrEqual(WEB_DECKEL.seitentitelZeichen + 1)
    expect(ergebnis.zeichen).toBe(ergebnis.titel.length + ergebnis.text.length)
    expect(ergebnis.titel.length + ergebnis.text.length).toBeLessThanOrEqual(WEB_DECKEL.seiteZeichen)
  })

  it('der Titel teilt sich das Zeichenbudget mit dem Text', async () => {
    fetchAttrappe([
      antwortMit('<html><title>Titel</title><body><p>' + 'y'.repeat(9000) + '</p></body></html>', 'text/html')
    ])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/lang', zeichenDeckel: 500 })
    expect(ergebnis.titel).toBe('Titel')
    expect(ergebnis.zeichen).toBe(500)
    expect(ergebnis.text.length).toBe(495)
  })
})

// ---------------------------------------------------------------------------
// Fund 10: HTTP-Fehlerseiten liefen als Erfolg durch
// ---------------------------------------------------------------------------

describe('0.51.2 · Der Server-Status wird ehrlich gemeldet (Fund 10)', () => {
  const seite = (code) =>
    `<html><title>Fehler ${code}</title><body><p>Diese Seite gibt es nicht (${code}).</p></body></html>`

  it.each([404, 403, 410, 500, 503])('%s ist keine gelesene Seite', async (code) => {
    fetchAttrappe([antwortMit(seite(code), 'text/html', code)])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/seite' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('statusFehler')
    expect(ergebnis.status).toBe(code)
    expect(ergebnis.fehlertext).toMatch(String(code))
    // Der vorhandene Seitentext bleibt als Zusatz erhalten — manche
    // Fehlerseiten tragen Brauchbares.
    expect(ergebnis.fehlertext).toMatch('Diese Seite gibt es nicht')
    expect(ergebnis.fehlertext).not.toMatch(/^Fremdtext von/)
  })

  it('429 bekommt den eigenen Satz „drosselt gerade", nicht „gibt es nicht"', async () => {
    fetchAttrappe([antwortMit(seite(429), 'text/html', 429)])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/viel' })
    expect(ergebnis.fehlerArt).toBe('statusFehler')
    expect(ergebnis.fehlertext).toMatch(/drosselt gerade/)
    expect(ergebnis.fehlertext).toMatch(/KEIN/)
  })

  it('ein Fehlerstatus ohne Textseite meldet trotzdem den Code', async () => {
    fetchAttrappe([antwortMit('%PDF-1.4', 'application/pdf', 404)])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/weg.pdf' })
    expect(ergebnis.fehlerArt).toBe('statusFehler')
    expect(ergebnis.fehlertext).toMatch('404')
  })

  it('200 bleibt ein Erfolg — der Statuscode entscheidet nur beim Seitenlesen', async () => {
    fetchAttrappe([antwortMit(seite(200), 'text/html', 200)])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/gut' })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.fehlerArt).toBe('')
    expect(ergebnis.status).toBe(200)
  })

  it('die Sperrseite der Suche bleibt am RUMPF erkannt, nicht am Status 202', async () => {
    // Gegenprobe zur Hausregel: Für die SUCHE gilt der Statuscode weiterhin
    // nicht — die DuckDuckGo-Sperrseite kommt gemessen mit HTTP 202.
    // Die gemerkte Sperre gilt modulweit; sie wird deshalb hier kurz gehalten
    // und ausgesessen, damit sie keine spätere Prüfung dieser Datei verfälscht.
    await mitDeckel({ drosselPauseMs: 50 }, async () => {
      fetchAttrappe([
        antwortMit(
          '<html><body><div class="anomaly-modal">Select all squares</div></body></html>',
          'text/html',
          202
        )
      ])
      const ergebnis = await websucheDurchfuehren({ suchbegriff: 'status gegenprobe' })
      expect(ergebnis.fehlerArt).toBe('gesperrt')
      await new Promise((fertig) => setTimeout(fertig, 70))
    })
  })

  it('eine Seite ganz ohne lesbaren Text ist kein Erfolg (JS-gerendert)', async () => {
    fetchAttrappe([antwortMit('<html><body><div id="app"></div><script>los()</script></body></html>', 'text/html')])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/app' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('leereSeite')
    expect(ergebnis.fehlertext).toMatch(/keinen lesbaren Text/)
  })
})

// ---------------------------------------------------------------------------
// Fund 13: Seite ohne content-type-Kopfzeile
// ---------------------------------------------------------------------------

describe('0.51.2 · Fehlende content-type-Kopfzeile heißt nicht „kein Text" (Fund 13)', () => {
  it('ohne Kopfzeile gilt HTML — kleine Server liefern echten Seitentext', async () => {
    fetchAttrappe([antwortMit('<html><title>Ohne</title><body><p>Echter Text.</p></body></html>', null)])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/ohnectype' })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.text).toBe('Echter Text.')
    expect(ergebnis.titel).toBe('Ohne')
  })

  it('wirkliche Binärdaten ohne Kopfzeile werden am Rumpfanfang erkannt', async () => {
    fetchAttrappe([antwortMit(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0x01]), null)])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/still.pdf' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('keineTextseite')
    // Und der Klartext nennt keinen erfundenen Grund mehr („keine Textseite (?)").
    expect(ergebnis.fehlertext).not.toMatch('(?)')
    expect(ergebnis.fehlertext).toMatch(/keine Art/)
  })
})

// ---------------------------------------------------------------------------
// Fund 1: Der kurze Grund reist im Rückgabeobjekt mit
// ---------------------------------------------------------------------------

describe('0.51.2 · Jede Ablehnung trägt ihren eigenen kurzen Grund (Fund 1)', () => {
  it('Weiterleitungsschleife: „zu viele Weiterleitungen", nicht „eigenes Netz"', async () => {
    fetchAttrappe((adresse, nummer) =>
      new Response('', { status: 302, headers: { location: `https://203.0.113.10/schleife${nummer}` } })
    )
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/schleife' })
    expect(ergebnis.fehlerArt).toBe('abgelehnt')
    expect(ergebnis.grund).toBe(w.grund.spruenge)
    expect(ergebnis.grund).not.toBe(w.grund.privat)
    // Der lange Satz an den Agenten und der kurze Grund sagen dasselbe.
    expect(ergebnis.fehlertext).toMatch(w.grund.spruenge)
  })

  it('unlesbare Weiterleitungsadresse: „die Adresse ist nicht lesbar"', async () => {
    fetchAttrappe([new Response('', { status: 302, headers: { location: 'http://[::1' } })])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/kaputt' })
    expect(ergebnis.fehlerArt).toBe('abgelehnt')
    expect(ergebnis.grund).toBe(w.grund.unlesbar)
  })

  it('eine echte Heimnetz-Adresse behält ihren Grund', async () => {
    fetchAttrappe([])
    const ergebnis = await webseiteLesen({ adresse: 'http://127.0.0.1:11434/api/tags' })
    expect(ergebnis.grund).toBe(w.grund.privat)
  })

  it('auch die übrigen Fehlerarten führen einen Grund mit', async () => {
    fetchAttrappe([antwortMit('%PDF-1.4', 'application/pdf')])
    expect((await webseiteLesen({ adresse: 'https://203.0.113.10/a.pdf' })).grund).toMatch('application/pdf')

    fetchAttrappe([antwortMit('<html><body><p>Weg</p></body></html>', 'text/html', 404)])
    expect((await webseiteLesen({ adresse: 'https://203.0.113.10/b' })).grund).toMatch('404')

    fetchAttrappe([
      () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
      }
    ])
    expect((await webseiteLesen({ adresse: 'https://203.0.113.10/c' })).grund).toBe(w.grund.namelos)
  })
})

// ---------------------------------------------------------------------------
// Fund 5 und 2: Wortlaut im Lesepfad
// ---------------------------------------------------------------------------

describe('0.51.2 · Der Lesepfad redet über die Seite, nicht über die Suchquelle (Fund 5)', () => {
  it('ein Zertifikatsfehler nennt die Seite', async () => {
    fetchAttrappe([
      () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'CERT_HAS_EXPIRED' } })
      }
    ])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/abgelaufen' })
    expect(ergebnis.fehlerArt).toBe('nichtErreichbar')
    expect(ergebnis.fehlertext).not.toMatch(/Suchquelle/)
    expect(ergebnis.fehlertext).toMatch(/Seite ist nicht erreichbar/)
    expect(ergebnis.fehlertext).toMatch(/abgelaufen/)
  })

  it('die Suche redet weiterhin über die Suchquelle', () => {
    expect(w.quelleNichtErreichbar('grund')).toMatch(/Suchquelle/)
  })
})

describe('0.51.2 · Der Kürzungs-Anhang behauptet keine Vollständigkeit mehr (Fund 2)', () => {
  const angehaengt = w.seitentext('https://beispiel.de/', 'Anfang', true)

  it('er sagt nicht mehr, es gebe keinen weiteren Text', () => {
    expect(angehaengt).not.toMatch(/gibt es nicht/)
    expect(angehaengt).toMatch(/die Seite geht weiter/)
  })

  it('er trägt denselben Auftrag wie keineTreffer und quelleGesperrt', () => {
    expect(angehaengt).toMatch(/in dein Ergebnis/)
    expect(w.keineTreffer('x')).toMatch(/in dein Ergebnis/)
    expect(w.quelleGesperrt).toMatch(/in dein Ergebnis/)
  })

  it('ohne Kürzung hängt gar nichts an', () => {
    expect(w.seitentext('https://beispiel.de/', 'Anfang', false)).not.toMatch(/abgeschnitten/)
  })
})

// ---------------------------------------------------------------------------
// Fund 11: Gesamtfrist je Werkzeugaufruf
// ---------------------------------------------------------------------------

describe('0.51.2 · Ein Werkzeugaufruf hat ein Gesamtbudget, nicht nur je Versuch (Fund 11)', () => {
  it('die Frist ist kleiner als die Summe aller Einzellimits', () => {
    // Gemessen vorher: 6 Sprünge × 19 s = 114.082 ms Stille für EINEN Aufruf,
    // und 32.529 ms für eine Suche mit hängender eigener Such-Instanz.
    expect(WEB_DECKEL.seiteGesamtMs).toBeLessThan(
      WEB_DECKEL.seiteZeitlimitMs * (WEB_DECKEL.sprungDeckel + 1)
    )
    expect(WEB_DECKEL.sucheGesamtMs).toBeLessThan(WEB_DECKEL.sucheZeitlimitMs * 3)
    expect(WEB_DECKEL.seiteGesamtMs).toBeGreaterThanOrEqual(WEB_DECKEL.seiteZeitlimitMs)
  })

  it('eine Weiterleitungskette bricht an der Frist ab — mit dem Grund Zeitlimit', async () => {
    // Der Nachstellweg des Prüfers, nur in klein: jeder Sprung antwortet knapp
    // unter dem Einzellimit, keiner reißt es, die Summe läuft davon.
    await mitDeckel({ seiteGesamtMs: 400, seiteZeitlimitMs: 150 }, async () => {
      const rufe = fetchAttrappe(
        verzoegert(
          (_adresse, nummer) =>
            new Response('', {
              status: 302,
              headers: { location: `https://203.0.113.10/kette${nummer}` }
            }),
          120
        )
      )
      const start = Date.now()
      const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/kette0' })
      const dauer = Date.now() - start
      expect(ergebnis.ok).toBe(false)
      expect(ergebnis.fehlerArt).toBe('zeitlimit')
      expect(ergebnis.grund).toBe(w.grund.zeit)
      // Ohne Frist wären es sechs Sprünge geworden.
      expect(rufe.length).toBeLessThan(WEB_DECKEL.sprungDeckel + 1)
      expect(dauer).toBeLessThan(1500)
    })
  })

  it('die Suche wartet nicht zweimal das volle Einzellimit ab', async () => {
    // Nachstellweg des Prüfers: eine Quelle, die NIE antwortet, aber das
    // AbortSignal befolgt. Vorher summierte sich das zu 10 s + Mindestabstand
    // + 10 s = 22.518 ms für EINEN Aufruf (mit eigener Such-Instanz 32.529 ms).
    await mitDeckel({ sucheGesamtMs: 200, sucheZeitlimitMs: 200, mindestAbstandMs: 10 }, async () => {
      const rufe = fetchAttrappe(verzoegert(() => null, Infinity))
      const start = Date.now()
      const ergebnis = await websucheDurchfuehren({ suchbegriff: 'frist der suche' })
      const dauer = Date.now() - start
      expect(ergebnis.ok).toBe(false)
      expect(ergebnis.fehlertext).toMatch(/nicht rechtzeitig/)
      // Weg 2 wird gar nicht mehr angefasst, wenn die Frist schon weg ist.
      expect(rufe.length).toBe(1)
      expect(dauer).toBeLessThan(1500)
    })
  })

  it('eine schnelle Seite merkt von der Frist nichts', async () => {
    fetchAttrappe([antwortMit('<html><body><p>Schnell da.</p></body></html>', 'text/html')])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/flott' })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.text).toBe('Schnell da.')
  })
})

// ---------------------------------------------------------------------------
// Fund 14: Die gemerkte Sperre gilt auch für den, der schon wartet
// ---------------------------------------------------------------------------
//
// Diese Prüfung steht ZULETZT: gesperrtBis gilt modulweit, und nach ihr wäre
// jede weitere Suche in dieser Datei gesperrt.
describe('0.51.2 · Ein schon wartender Aufruf belastet die sperrende Quelle nicht (Fund 14)', () => {
  it('von drei gleichzeitigen Suchen geht genau EINE Abfrage ins Netz', async () => {
    await mitDeckel({ mindestAbstandMs: 30, drosselPauseMs: 200 }, async () => {
      const rufe = fetchAttrappe(() =>
        antwortMit(
          '<html><body><div class="anomaly-modal">Select all squares</div></body></html>',
          'text/html',
          202
        )
      )
      const alle = await Promise.all([
        websucheDurchfuehren({ suchbegriff: 'eins' }),
        websucheDurchfuehren({ suchbegriff: 'zwei' }),
        websucheDurchfuehren({ suchbegriff: 'drei' })
      ])
      for (const ergebnis of alle) expect(ergebnis.fehlerArt).toBe('gesperrt')
      // Vorher: 3 echte Abfragen (gemessen 0/2.532/5.048 ms) an eine Quelle,
      // die schon bei der ersten „gesperrt" gesagt hatte — genau das
      // Nachtreten, das die Sperre laut Modulkommentar verlängert.
      expect(rufe).toHaveLength(1)
      // Die Sperre danach auslaufen lassen, damit sie nicht in andere
      // Prüfungen dieser Datei hineinreicht.
      await new Promise((fertig) => setTimeout(fertig, 250))
    })
  })
})
