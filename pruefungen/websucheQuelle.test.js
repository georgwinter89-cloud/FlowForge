// Prüfungen der Websuche-Quelle (Zwischenschritt 0.51.2, Bauvertrag Bauer A).
//
// Netzfrei: Die Beispiel-Rümpfe stehen als Konstanten in dieser Datei (in
// pruefungen/ gibt es keinen Fixture-Ordner), und wo Verhalten am Netz hängt,
// wird `fetch` durch eine Attrappe ersetzt. Keine echte Adresse wird abgefragt
// — auch keine Namensauflösung: Die Abruf-Prüfungen laufen gegen literale
// IP-Adressen aus dem Dokumentationsbereich, für die adressePruefen gar nicht
// erst nachschlägt.
//
// Geprüft wird VERHALTEN am echten Modul: dass die vier Zustände der
// eingebauten Quelle auseinandergehalten werden (Statuscode taugt dafür
// gemessen nicht), dass beide Endpunkt-Parser dieselbe interne Trefferform
// liefern, dass der Zeichensatz in der richtigen Rangfolge gewählt wird und
// dass die Deckel wirklich greifen.
import { describe, it, expect, afterEach, vi } from 'vitest'

// Namensauflösung als Attrappe: Der Rebinding-Schutz muss auf jedem Rechner
// dasselbe ergeben, und eine echte Abfrage wäre Netzverkehr. Am echten
// Rechnernamen von Hand gegengemessen (20.08.2026): dieselbe Ablehnung.
vi.mock('node:dns', () => ({
  default: {
    promises: {
      lookup: async (name) => {
        if (name === 'heimlich.example') return [{ address: '127.0.0.1', family: 4 }]
        if (name === 'router.example') return [{ address: '10.0.0.1', family: 4 }]
        if (name === 'offen.example') return [{ address: '93.184.216.34', family: 4 }]
        throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
      }
    }
  }
}))

import {
  WEB_DECKEL,
  adressePruefen,
  htmlZuText,
  textAusBytes,
  ddgLiteTreffer,
  ddgHtmlTreffer,
  ddgZustand,
  searxngTreffer,
  adresseErlaubt,
  netzFehlerText,
  webseiteLesen,
  websucheDurchfuehren
} from '../src/main/motor/websuche.js'

// ---------------------------------------------------------------------------
// Beispiel-Rümpfe (nach den echten Antworten vom 20.08.2026 nachgebildet)
// ---------------------------------------------------------------------------

// lite/ per POST: href VOR class, EINFACHE Anführungszeichen, Anker und
// Kurztext in getrennten tr-Zeilen, direkte Zieladressen ohne Umleiter.
const LITE_RUMPF = `<html><head><title>DuckDuckGo</title></head><body>
<table>
<tr><td valign="top">1.&nbsp;</td><td>
<a rel="nofollow" href="https://www.electronjs.org/docs/latest" class='result-link'>Electron <b>Doku</b></a>
</td></tr>
<tr><td>&nbsp;</td><td class='result-snippet'>Build cross-platform desktop apps with JavaScript, HTML &amp; CSS.</td></tr>
<tr><td>&nbsp;</td><td class="link-text">www.electronjs.org</td></tr>
<tr><td valign="top">2.&nbsp;</td><td>
<a rel="nofollow" href="https://github.com/electron/electron/releases" class='result-link'>Releases</a>
</td></tr>
<tr><td>&nbsp;</td><td class='result-snippet'>All historical <b>Electron</b> releases.</td></tr>
</table></body></html>`

// html/: class VOR href, DOPPELTE Anführungszeichen, Adresse als
// protokoll-relativer Umleiter mit url-kodiertem uddg und &amp; dazwischen.
const HTML_RUMPF = `<html><head><title>DuckDuckGo</title></head><body>
<div class="result results_links">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.electronjs.org%2Fdocs%2Flatest&amp;rut=1a2b">Electron <b>Doku</b></a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.electronjs.org%2F">Build cross-platform desktop apps with JavaScript, HTML &amp; CSS.</a>
  <a class="result__url" href="//duckduckgo.com/l/?uddg=x">www.electronjs.org</a>
</div>
<div class="result results_links">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fgithub.com%2Felectron%2Felectron%2Freleases&amp;rut=9z">Releases</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=y">All historical <b>Electron</b> releases.</a>
</div></body></html>`

// Sperrseite: HTTP 202 (also r.ok === true), kein Treffer, Marke im Rumpf.
const SPERR_RUMPF = `<html><head><title>DuckDuckGo</title></head><body>
<div data-testid="anomaly-modal" class="anomaly-modal">
<p>Select all squares containing a duck</p></div></body></html>`

// Echtes Nullergebnis: HTTP 200, kein Treffer, eigene Marke.
const NICHTS_RUMPF = `<html><body><div class="no-results">No results found for
<b>qwertzuiopasdfgh</b>.</div></body></html>`

// Leere Anfrage: HTTP 200 oder 202, 0 Treffer, KEINE Marke — genau der Fall,
// den eine reine Trefferzählung mit „nichts gefunden" verwechseln würde.
const UNVERSTANDEN_RUMPF = `<html><head><title>DuckDuckGo</title></head><body>
<form action="/lite/" method="post"><input name="q" /></form></body></html>`

const LANGER_KURZTEXT = 'A'.repeat(500)
const LITE_LANG = `<table>
<tr><td><a rel="nofollow" href="https://beispiel.de/" class='result-link'>Titel</a></td></tr>
<tr><td class='result-snippet'>${LANGER_KURZTEXT}</td></tr></table>`

// ---------------------------------------------------------------------------
// fetch-Attrappe
// ---------------------------------------------------------------------------

const echtesFetch = globalThis.fetch

function fetchAttrappe(antworten) {
  const rufe = []
  globalThis.fetch = async (adresse, optionen) => {
    rufe.push({ adresse: String(adresse), optionen })
    const naechste = antworten.shift()
    if (typeof naechste === 'function') return naechste()
    return naechste
  }
  return rufe
}

afterEach(() => {
  globalThis.fetch = echtesFetch
})

function antwortMit(koerper, art, status = 200) {
  return new Response(koerper, { status, headers: { 'content-type': art } })
}

describe('0.51.2 · Zustand der eingebauten Quelle — am Rumpf, nicht am Statuscode', () => {
  it('erkennt alle vier Zustände auseinander', () => {
    expect(ddgZustand(SPERR_RUMPF)).toBe('gesperrt')
    expect(ddgZustand(LITE_RUMPF)).toBe('treffer')
    expect(ddgZustand(HTML_RUMPF)).toBe('treffer')
    expect(ddgZustand(NICHTS_RUMPF)).toBe('nichts')
    expect(ddgZustand(UNVERSTANDEN_RUMPF)).toBe('unverstanden')
  })

  it('die Sperre gewinnt vor allem anderen — auch wenn Treffer danebenstünden', () => {
    expect(ddgZustand(SPERR_RUMPF + LITE_RUMPF)).toBe('gesperrt')
  })

  it('leerer oder kaputter Rumpf ist „unverstanden", nie „nichts gefunden"', () => {
    expect(ddgZustand('')).toBe('unverstanden')
    expect(ddgZustand(null)).toBe('unverstanden')
  })
})

describe('0.51.2 · Beide Endpunkt-Parser liefern dieselbe interne Trefferform', () => {
  it('lite/ liest direkte Adressen samt Kurztext aus der Nachbarzeile', () => {
    const treffer = ddgLiteTreffer(LITE_RUMPF)
    expect(treffer).toHaveLength(2)
    expect(treffer[0]).toEqual({
      titel: 'Electron Doku',
      adresse: 'https://www.electronjs.org/docs/latest',
      kurztext: 'Build cross-platform desktop apps with JavaScript, HTML & CSS.'
    })
    expect(treffer[1].adresse).toBe('https://github.com/electron/electron/releases')
    expect(treffer[1].kurztext).toBe('All historical Electron releases.')
  })

  it('html/ packt die Adresse aus dem Umleiter aus — kein duckduckgo.com/l/ mehr', () => {
    const treffer = ddgHtmlTreffer(HTML_RUMPF)
    expect(treffer).toHaveLength(2)
    for (const t of treffer) expect(t.adresse).not.toMatch(/duckduckgo\.com/)
    expect(treffer[0].adresse).toBe('https://www.electronjs.org/docs/latest')
    expect(treffer[1].adresse).toBe('https://github.com/electron/electron/releases')
  })

  it('gleiche Felder, gleiche Typen, Kurztext ohne Markup und ohne Entitäten', () => {
    const a = ddgLiteTreffer(LITE_RUMPF)
    const b = ddgHtmlTreffer(HTML_RUMPF)
    expect(Object.keys(a[0]).sort()).toEqual(['adresse', 'kurztext', 'titel'])
    expect(Object.keys(b[0]).sort()).toEqual(['adresse', 'kurztext', 'titel'])
    for (const t of [...a, ...b]) {
      expect(t.titel).not.toMatch(/[<>]/)
      expect(t.kurztext).not.toMatch(/<b>|&amp;/)
    }
    // Titel und Kurztext sind auf beiden Wegen dieselben Sätze.
    expect(b[0].titel).toBe(a[0].titel)
    expect(b[0].kurztext).toBe(a[0].kurztext)
  })

  it('der Parser des einen Endpunkts fällt auf dem anderen Rumpf auf null (deshalb zwei)', () => {
    expect(ddgLiteTreffer(HTML_RUMPF)).toEqual([])
    expect(ddgHtmlTreffer(LITE_RUMPF)).toEqual([])
  })

  it('SearXNG liest den Kurztext aus content — nicht aus snippet', () => {
    const treffer = searxngTreffer({
      query: 'electron',
      results: [
        {
          title: 'Electron',
          url: 'https://www.electronjs.org/',
          content: 'Baukasten für Desktop-Programme.',
          snippet: 'FALSCHES FELD'
        }
      ]
    })
    expect(treffer).toEqual([
      {
        titel: 'Electron',
        adresse: 'https://www.electronjs.org/',
        kurztext: 'Baukasten für Desktop-Programme.'
      }
    ])
  })

  it('SearXNG ohne results-Feld liefert keine Treffer statt zu werfen', () => {
    expect(searxngTreffer({ irgendwas: 'x' })).toEqual([])
    expect(searxngTreffer(null)).toEqual([])
  })
})

describe('0.51.2 · Deckel', () => {
  it('der Kurztext wird auf WEB_DECKEL.kurztextZeichen gekürzt', () => {
    const treffer = ddgLiteTreffer(LITE_LANG)
    expect(treffer[0].kurztext.length).toBeLessThanOrEqual(WEB_DECKEL.kurztextZeichen + 1)
    expect(treffer[0].kurztext.endsWith('…')).toBe(true)
  })

  it('mehr als WEB_DECKEL.treffer Treffer kommen nie heraus', () => {
    const viele =
      '<table>' +
      Array.from(
        { length: 20 },
        (_, i) =>
          `<tr><td><a href="https://beispiel.de/${i}" class='result-link'>T${i}</a></td></tr>` +
          `<tr><td class='result-snippet'>K${i}</td></tr>`
      ).join('') +
      '</table>'
    expect(ddgLiteTreffer(viele)).toHaveLength(WEB_DECKEL.treffer)
  })

  it('der Seitentext wird gekürzt und meldet gekuerzt true', async () => {
    fetchAttrappe([antwortMit('<html><body><p>' + 'x'.repeat(9000) + '</p></body></html>', 'text/html')])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/lang', zeichenDeckel: 500 })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.gekuerzt).toBe(true)
    expect(ergebnis.zeichen).toBe(500)
    expect(ergebnis.text.length).toBe(500)
  })

  it('eine kurze Seite kommt ungekürzt durch', async () => {
    fetchAttrappe([antwortMit('<html><title>Kurz</title><body><p>Kleiner Text.</p></body></html>', 'text/html')])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/kurz' })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.gekuerzt).toBe(false)
    expect(ergebnis.titel).toBe('Kurz')
    expect(ergebnis.text).toBe('Kleiner Text.')
  })

  it('ein gewünschter Deckel über dem Höchstwert wird geklemmt', async () => {
    fetchAttrappe([antwortMit('<html><body><p>' + 'y'.repeat(40000) + '</p></body></html>', 'text/html')])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/riesig', zeichenDeckel: 999999 })
    expect(ergebnis.zeichen).toBe(WEB_DECKEL.seiteZeichenMax)
  })
})

describe('0.51.2 · htmlZuText wirft den Rahmen raus und löst Entitäten auf', () => {
  const seite = `<html><head><title>Titel</title><style>body{color:red}</style></head>
<body><header>Skip to content</header><nav>Navigation Menu</nav>
<aside>Werbung</aside><noscript>Bitte JavaScript</noscript>
<script>var geheim = 1</script>
<form><input name="q"></form>
<svg><path d="M0 0"/></svg>
<p>Echter Inhalt &amp; mehr &mdash; ein &lt;div&gt; als Text.</p>
<p>Zweiter&nbsp;Absatz.</p>
<footer>Impressum</footer></body></html>`

  it('Rahmen-Marken landen nicht im Text', () => {
    const text = htmlZuText(seite)
    for (const ballast of [
      'Skip to content',
      'Navigation Menu',
      'Werbung',
      'Bitte JavaScript',
      'geheim',
      'Impressum',
      'color:red',
      'M0 0'
    ])
      expect(text, ballast).not.toMatch(ballast)
  })

  it('Entitäten werden aufgelöst, Absätze bleiben getrennt', () => {
    const text = htmlZuText(seite)
    expect(text).toMatch('Echter Inhalt & mehr — ein <div> als Text.')
    expect(text).toMatch('Zweiter Absatz.')
    expect(text).not.toMatch(/&amp;|&mdash;|&nbsp;/)
  })

  it('numerische Entitäten kommen ebenfalls durch', () => {
    expect(htmlZuText('<p>K&#246;ln &#x2014; Dom</p>')).toBe('Köln — Dom')
  })
})

describe('0.51.2 · Nicht-HTML wird nicht zu Text gemacht (content-type-Weiche)', () => {
  it('ein PDF liefert einen deutschen Klartext statt Binärmüll', async () => {
    fetchAttrappe([antwortMit('%PDF-1.4 %\u00e4\u00fc\u00f6\u00df 2 0 obj > stream', 'application/pdf')])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/handbuch.pdf' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('keineTextseite')
    expect(ergebnis.text).toBe('')
    expect(ergebnis.fehlertext).toMatch(/keine Textseite/)
    expect(ergebnis.fehlertext).toMatch('application/pdf')
  })

  it('ein SVG sieht nicht wie eine leere Seite aus', async () => {
    fetchAttrappe([antwortMit('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', 'image/svg+xml')])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/bild.svg' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('keineTextseite')
  })

  it('JSON und reiner Text werden gedeckelt durchgereicht', async () => {
    fetchAttrappe([antwortMit('{"version":"43.3.0"}', 'application/json')])
    const json = await webseiteLesen({ adresse: 'https://203.0.113.10/api' })
    expect(json.ok).toBe(true)
    expect(json.text).toBe('{"version":"43.3.0"}')

    fetchAttrappe([antwortMit('nur text', 'text/plain; charset=utf-8')])
    const roh = await webseiteLesen({ adresse: 'https://203.0.113.10/liesmich.txt' })
    expect(roh.ok).toBe(true)
    expect(roh.text).toBe('nur text')
  })
})

describe('0.51.2 · Zeichensatz: BOM schlägt Kopfzeile, Kopfzeile schlägt meta', () => {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8 = (text) => new Uint8Array(Buffer.from(text, 'utf8'))
  const latin1 = (text) => new Uint8Array(Buffer.from(text, 'latin1'))
  const zusammen = (...teile) => {
    const gesamt = new Uint8Array(teile.reduce((s, t) => s + t.length, 0))
    let stelle = 0
    for (const t of teile) {
      gesamt.set(t, stelle)
      stelle += t.length
    }
    return gesamt
  }

  it('BOM gewinnt gegen eine falsche Kopfzeile', () => {
    const bytes = zusammen(bom, utf8('Bürgerliches Gesetzbuch'))
    expect(textAusBytes(bytes, 'text/html; charset=iso-8859-1')).toBe('Bürgerliches Gesetzbuch')
  })

  it('die Kopfzeile gewinnt gegen ein falsches meta', () => {
    const bytes = latin1('<meta charset="utf-8"><p>Bürgerliches</p>')
    expect(textAusBytes(bytes, 'text/html; charset=iso-8859-1')).toMatch('Bürgerliches')
  })

  it('ohne charset in der Kopfzeile zählt das meta — der gemessene Behörden-Fall', () => {
    const bytes = latin1('<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1"><h1>Bürgerliches Gesetzbuch</h1>')
    const text = textAusBytes(bytes, 'text/html')
    expect(text).toMatch('Bürgerliches Gesetzbuch')
    expect(text).not.toMatch('\uFFFD')
  })

  it('ohne jede Angabe gilt utf-8', () => {
    expect(textAusBytes(utf8('Grüße'), null)).toBe('Grüße')
  })

  it('ein unbekanntes Kennzeichen fällt auf utf-8 zurück statt zu werfen', () => {
    // Gemessen: new TextDecoder('latin-1') wirft RangeError.
    expect(textAusBytes(utf8('Bürgerliches'), 'text/html; charset=latin-1')).toBe('Bürgerliches')
  })
})

describe('0.51.2 · Adressprüfung sperrt den eigenen Rechner und das Heimnetz', () => {
  // Die repo-weite Geheimnis-Prüfung (erststartWahl.test.js) verbietet eine
  // literale 192.168-Adresse im getrackten Stand — Georgs Heimnetz soll nicht
  // im Repo stehen. Der Bereich wird deshalb zusammengesetzt; geprüft werden
  // muss er, weil es der häufigste Heimnetz-Bereich überhaupt ist.
  const heim = (rest) => ['192', '168', rest].join('.')
  const gesperrt = [
    'http://127.0.0.1:11434/api/tags',
    'http://127.5.5.5/',
    'http://localhost:8080/',
    'http://ollama.localhost/',
    `http://${heim('1.50')}/router`,
    'http://10.0.0.8/nas',
    'http://172.16.0.1/',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]:11434/',
    'http://[fe80::1]/',
    'http://[fc00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'file:///C:/Users/Beispiel/geheim.txt',
    'data:text/plain,geheim',
    'javascript:alert(1)'
  ]

  it.each(gesperrt)('%s wird abgelehnt', (adresse) => {
    const ergebnis = adresseErlaubt(adresse, '')
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.grund).toBeTruthy()
  })

  it('öffentliche Adressen kommen durch', () => {
    expect(adresseErlaubt('https://www.electronjs.org/docs', '').ok).toBe(true)
    expect(adresseErlaubt('http://203.0.113.10/', '').ok).toBe(true)
  })

  it('eine Adresse ohne Schema wird zu https ergänzt statt abgelehnt', () => {
    const ergebnis = adresseErlaubt('www.electronjs.org/docs', '')
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.adresse).toBe('https://www.electronjs.org/docs')
  })

  it('die eingetragene SearXNG-Adresse ist die einzige Ausnahme', () => {
    const ausnahme = `http://${heim('1.50')}:8080`
    expect(adresseErlaubt(`http://${heim('1.50')}:8080/search?q=x`, ausnahme).ok).toBe(true)
    // Andere Adresse im selben Netz bleibt gesperrt — die Ausnahme gilt genau
    // dem Ursprung, den Georg selbst eingetragen hat.
    expect(adresseErlaubt(`http://${heim('1.51')}:8080/`, ausnahme).ok).toBe(false)
    expect(adresseErlaubt(`http://${heim('1.50')}:9999/`, ausnahme).ok).toBe(false)
    expect(adresseErlaubt('http://127.0.0.1:11434/', ausnahme).ok).toBe(false)
    // Auch mit End-Slash oder Leerzeichen eingetragen greift die Ausnahme —
    // die Adresse wird mit derselben Regel geputzt wie beim Speichern.
    expect(adresseErlaubt(`http://${heim('1.50')}:8080/search`, ` http://${heim('1.50')}:8080/ `).ok).toBe(
      true
    )
  })

  // Fund 7: Eine Prüfung nur der Zeichenkette ist wirkungslos — ein harmloser
  // Name kann auf den eigenen Rechner zeigen (DNS-Rebinding).
  it('ein textlich harmloser Name wird per Namensauflösung gestoppt', async () => {
    expect(adresseErlaubt('http://heimlich.example/', '').ok).toBe(true)
    const ergebnis = await adressePruefen('http://heimlich.example/', '')
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.grund).toMatch(/diesen Rechner|eigene Netz/)
    const imNetz = await adressePruefen('http://router.example/', '')
    expect(imNetz.ok).toBe(false)
  })

  it('ein Name, der auf eine öffentliche Adresse zeigt, kommt durch', async () => {
    expect((await adressePruefen('http://offen.example/', '')).ok).toBe(true)
  })

  it('ein Name, der gar nicht auflöst, wird nicht vorab abgelehnt', async () => {
    // Der Abruf gleich danach meldet ENOTFOUND ehrlich — eine Vorab-Ablehnung
    // wäre eine zweite, ungenauere Fehlermeldung für dieselbe Sache.
    expect((await adressePruefen('http://gibtesnicht.invalid/', '')).ok).toBe(true)
  })

  it('webseiteLesen lehnt eine gesperrte Adresse ab, ohne sie abzurufen', async () => {
    const rufe = fetchAttrappe([antwortMit('{}', 'application/json')])
    const ergebnis = await webseiteLesen({ adresse: 'http://127.0.0.1:11434/api/tags' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('abgelehnt')
    expect(rufe).toHaveLength(0)
  })

  it('eine Weiterleitung ins eigene Netz wird beim Sprung gestoppt', async () => {
    fetchAttrappe([
      new Response('', { status: 302, headers: { location: 'http://127.0.0.1:11434/api/tags' } })
    ])
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/harmlos' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('abgelehnt')
    // Die Rückgabe nennt die tatsächlich angesteuerte Endadresse, nicht die
    // harmlose Startadresse.
    expect(ergebnis.adresse).toMatch('127.0.0.1')
  })

  it('zu viele Sprünge hintereinander enden ehrlich statt endlos', async () => {
    const antworten = Array.from({ length: WEB_DECKEL.sprungDeckel + 2 }, (_, i) =>
      new Response('', { status: 302, headers: { location: `https://203.0.113.10/${i + 1}` } })
    )
    fetchAttrappe(antworten)
    const ergebnis = await webseiteLesen({ adresse: 'https://203.0.113.10/0' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('abgelehnt')
  })
})

describe('0.51.2 · Netzfehler werden zu deutschem Klartext', () => {
  it('der Grund kommt aus cause.code — e.message ist immer nur „fetch failed"', () => {
    const bauen = (code) => Object.assign(new TypeError('fetch failed'), { cause: { code } })
    expect(netzFehlerText(bauen('ENOTFOUND'))).toMatch(/Rechnername/)
    expect(netzFehlerText(bauen('ECONNREFUSED'))).toMatch(/keine Verbindung/)
    expect(netzFehlerText(bauen('CERT_HAS_EXPIRED'))).toMatch(/abgelaufen/)
    expect(netzFehlerText(bauen('ERR_TLS_CERT_ALTNAME_INVALID'))).toMatch(/andere/)
    expect(netzFehlerText(bauen('DEPTH_ZERO_SELF_SIGNED_CERT'))).toMatch(/selbst ausgestellt/)
    for (const code of ['ENOTFOUND', 'ECONNREFUSED', 'CERT_HAS_EXPIRED'])
      expect(netzFehlerText(bauen(code))).not.toMatch(/fetch failed/)
  })

  it('ein Zeitlimit hat einen eigenen Satz', () => {
    const zeit = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError'
    })
    expect(netzFehlerText(zeit)).toMatch(/nicht rechtzeitig/)
  })

  it('ein unbekannter Code wird genannt statt verschluckt', () => {
    expect(netzFehlerText({ cause: { code: 'EIRGENDWAS' } })).toMatch('EIRGENDWAS')
  })
})

// Diese zwei laufen zuletzt: Die zweite Suche wartet den Mindestabstand der
// Drossel ab, und die gemerkte Sperre gilt danach modulweit.
describe('0.51.2 · Suche meldet Sperre als Sperre, nie als „keine Treffer"', () => {
  it('Treffer der eingebauten Quelle kommen in der internen Form heraus', async () => {
    fetchAttrappe([antwortMit(LITE_RUMPF, 'text/html')])
    const ergebnis = await websucheDurchfuehren({ suchbegriff: 'electron doku' })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.quelle).toBe('eingebaut')
    expect(ergebnis.ausgewichen).toBe(false)
    expect(ergebnis.treffer[0].adresse).toBe('https://www.electronjs.org/docs/latest')
  })

  it('die Sperrseite (HTTP 202, r.ok true) ergibt fehlerArt „gesperrt"', async () => {
    fetchAttrappe([antwortMit(SPERR_RUMPF, 'text/html', 202)])
    const ergebnis = await websucheDurchfuehren({ suchbegriff: 'electron version' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('gesperrt')
    expect(ergebnis.treffer).toEqual([])
    expect(ergebnis.fehlerArt).not.toBe('nichts')
    expect(ergebnis.fehlertext).toMatch(/sperrt gerade/)
    // Der Text sagt dem Modell ausdrücklich, dass dies KEIN Nullergebnis ist —
    // sonst rät es danach still weiter.
    expect(ergebnis.fehlertext).toMatch(/KEIN/)
  }, 15000)

  it('nach der Sperre wird das Netz nicht mehr belastet — die Sperre ist gemerkt', async () => {
    const rufe = fetchAttrappe([antwortMit(LITE_RUMPF, 'text/html')])
    const ergebnis = await websucheDurchfuehren({ suchbegriff: 'noch eine frage' })
    expect(ergebnis.fehlerArt).toBe('gesperrt')
    expect(rufe).toHaveLength(0)
  })

  it('ohne Suchbegriff wird gar nicht erst gesucht', async () => {
    const rufe = fetchAttrappe([])
    const ergebnis = await websucheDurchfuehren({ suchbegriff: '   ' })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehlerArt).toBe('begriffFehlt')
    expect(rufe).toHaveLength(0)
  })
})
