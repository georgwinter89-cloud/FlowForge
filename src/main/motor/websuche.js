// Websuche und Seitenabruf für lokale Block-Agenten (Zwischenschritt 0.51.2).
//
// Warum es dieses Modul gibt: Die WebSearch/WebFetch der Claude-CLI laufen über
// Anthropics Server und existieren für einen lokalen Motor (Ollama) nicht. Der
// Reflex des Modells ist da — gemessen am 20.08.2026 an qwen3.8-davidau:27b:
// bei erkannter Unsicherheit greift es von selbst zum angebotenen Suchwerkzeug
// — ihm fehlt nur der Stecker. Dieses Modul ist der Stecker: zwei rein lesende
// Wege ins Netz, hart gedeckelt.
//
// Wohnort Hauptprozess, bewusst als Singleton: Die Drossel und die gemerkte
// Sperre müssen für ALLE lokalen Blöcke gemeinsam gelten. Der Werkzeug-Server
// wird je lokalem Block NEU gebaut (gemessen 20.08.2026: derselbe Fabrik-Aufruf
// liefert zweimal verschiedene Instanzen) — eine Drossel als Closure dort
// drinnen wäre je Block eine eigene und damit wirkungslos. Direkt gemessen:
// 6 Abfragen seriell mit 5 s Abstand → 6/6 grün; dieselben 6 als zwei Wellen zu
// je 3 gleichzeitigen → 0/6 grün.
//
// Ohne Fremdbibliothek: fetch, TextDecoder und URL sind global vorhanden, die
// Entkernung von HTML macht eine schlanke eigene Funktion. Ein neues Paket wäre
// zusätzlich ein Installer-Thema (electron-builder), ohne dass Build oder
// npm test etwas sagen würden.
//
// Kein User-Agent-Theater: Gemessen 20.08.2026 hängt die DuckDuckGo-Sperre an
// der Rate, nicht am Kennzeichen — im gesperrten Zustand sind Chrome-Kennung,
// „FlowForge/0.51.2", curl und „ohne Kennung" gleichermaßen dicht, auf ruhiger
// Leitung kommt jede durch. Nodes Vorgabe genügt; alles andere erzeugte nur
// falsche Sicherheit.
//
// KEIN AUSWEG ist der offizielle JSON-Dienst api.duckduckgo.com mit
// format=json: gemessen 20.08.2026 mit drei echten Fragen („electron latest
// version", „Köln Einwohner", „zod 4 discriminatedUnion") jeweils HTTP 200,
// aber AbstractText leer, RelatedTopics 0, Results 0. Wer diesen Weg später
// „entdeckt", verliert einen halben Tag — er liefert für Sachfragen nichts.
import dns from 'node:dns'
import { texte } from '../../shared/texte.js'
import { adresseBereinigen } from '../../shared/lokalRegeln.js'

const w = texte.agentenWebsuche

// Alle Deckel an einer Stelle. Absolute Werte, bewusst NICHT über
// grenzenFuer(kontext) mitskaliert (Fund 3e, gerechnet 20.08.2026): Mit festem
// 24k-Deckel schafft ein 64k-Fenster 4,19 Seiten, mit mitskaliertem nur 2,10
// (128k: 11,82 gegen 2,96) — der Start-Prompt wächst eben nicht mit. Ein
// mitskalierter Deckel wirkte also genau verkehrt herum.
//
// rumpfBytes ist der Deckel am ROHEN Strom, nicht am extrahierten Text:
// Content-Length taugt nicht als Maß (Wikipedia „World War II" meldet 321.974
// und liefert 2.055.659 Zeichen, Faktor 6,4; ein 199-kB-gzip-Rumpf ergab
// 209.715.200 Zeichen und +656 MB Arbeitsspeicher, gemessen 20.08.2026).
export const WEB_DECKEL = {
  treffer: 6,
  kurztextZeichen: 200,
  seiteZeichen: 6000,
  seiteZeichenMax: 12000,
  rumpfBytes: 1000000,
  sucheZeitlimitMs: 10000,
  seiteZeitlimitMs: 20000,
  sprungDeckel: 5,
  drosselPauseMs: 60000,
  mindestAbstandMs: 2500
}

const LITE_ADRESSE = 'https://lite.duckduckgo.com/lite/'
const HTML_ADRESSE = 'https://html.duckduckgo.com/html/'

// ---------------------------------------------------------------------------
// Reine Textarbeit (netzfrei — genau diese Funktionen sind hart geprüft)
// ---------------------------------------------------------------------------

// Rahmen einer Seite, der nie Inhalt ist. Gemessen 20.08.2026 an echten
// Seiten: Ohne diese Marken bestehen die ersten 380 Zeichen einer GitHub-Seite
// aus „Skip to content Navigation Menu Sign in …" — reiner Ballast, der beim
// lokalen Modell 1:1 Platz im Arbeitsgedächtnis kostet.
const RAHMEN_MARKEN = [
  'script',
  'style',
  'head',
  // Der Seitentitel wird eigens gelesen und gehört nicht noch einmal in den
  // Fließtext — manche Seiten setzen ihn außerhalb von <head>.
  'title',
  'header',
  'footer',
  'nav',
  'aside',
  'form',
  'svg',
  'noscript'
]

const ENTITAETEN = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  shy: '',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  bdquo: '„',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  euro: '€',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  szlig: 'ß',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü'
}

function entitaetenLoesen(text) {
  return String(text ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (ganz, kern) => {
    if (kern[0] === '#') {
      const zahl =
        kern[1] === 'x' || kern[1] === 'X' ? parseInt(kern.slice(2), 16) : parseInt(kern.slice(1), 10)
      if (!Number.isFinite(zahl) || zahl < 9 || zahl > 0x10ffff) return ganz
      try {
        return String.fromCodePoint(zahl)
      } catch {
        return ganz
      }
    }
    const treffer = ENTITAETEN[kern] ?? ENTITAETEN[kern.toLowerCase()]
    return treffer === undefined ? ganz : treffer
  })
}

// Markup aus einem kurzen Stück (Titel, Kurztext) entfernen und zu einer Zeile
// zusammenziehen. Gemessen: Kurztexte tragen Markup und Entitäten („All
// historical <b>Electron</b> releases.").
function entmarkupt(roh) {
  return entitaetenLoesen(
    String(roh ?? '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function kuerzen(text, deckel) {
  const t = String(text ?? '')
  return t.length > deckel ? t.slice(0, deckel).trimEnd() + '…' : t
}

// HTML zu lesbarem Text. Reihenfolge zählt: erst Rahmen samt Inhalt raus, dann
// Blockenden zu Zeilenumbrüchen, dann Marken weg, ERST DANN Entitäten lösen —
// andersherum würde ein „&lt;script&gt;" im Fließtext hinterher wie eine Marke
// aussehen.
export function htmlZuText(html) {
  let roh = String(html ?? '').replace(/<!--[\s\S]*?-->/g, ' ')
  for (const marke of RAHMEN_MARKEN)
    roh = roh.replace(new RegExp(`<${marke}\\b[^>]*>[\\s\\S]*?<\\/${marke}\\s*>`, 'gi'), ' ')
  roh = roh
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table|blockquote|pre)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
  return entitaetenLoesen(roh)
    .replace(/\r/g, '')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((zeile) => zeile.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Bytes → Text in der WHATWG-Rangfolge BOM > Kopfzeile > meta. Gemessen
// 20.08.2026 an gesetze-im-internet.de: content-type OHNE charset, ISO-8859-1
// nur im meta — r.text() liefert dort 6× U+FFFD („B<?>rgerliches"). Deshalb
// immer Bytes holen und selbst dekodieren.
export function textAusBytes(bytes, contentType) {
  const roh =
    bytes instanceof Uint8Array
      ? bytes
      : bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : new Uint8Array(bytes ?? [])
  // 1) BOM schlägt alles — es steht in den Daten selbst.
  if (roh.length >= 3 && roh[0] === 0xef && roh[1] === 0xbb && roh[2] === 0xbf)
    return dekodieren(roh, 'utf-8')
  if (roh.length >= 2 && roh[0] === 0xff && roh[1] === 0xfe) return dekodieren(roh, 'utf-16le')
  if (roh.length >= 2 && roh[0] === 0xfe && roh[1] === 0xff) return dekodieren(roh, 'utf-16be')
  // 2) Kopfzeile.
  const ausKopf = /charset\s*=\s*["']?\s*([a-z0-9_\-:.+]+)/i.exec(String(contentType ?? ''))
  if (ausKopf) return dekodieren(roh, ausKopf[1])
  // 3) meta charset aus dem Anfang — im LATIN1-ROHTEXT gesucht, nicht im schon
  //    kaputt dekodierten Text.
  const anfang = dekodieren(roh.subarray(0, 2048), 'iso-8859-1')
  const ausMeta = /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_\-:.+]+)/i.exec(anfang)
  if (ausMeta) return dekodieren(roh, ausMeta[1])
  return dekodieren(roh, 'utf-8')
}

// Ein unbekanntes Kennzeichen wirft im Konstruktor (gemessen: 'latin-1' →
// RangeError, während 'ISO8859-1' und 'gb2312' gültig sind). Lieber utf-8 als
// ein geworfener Fehler mitten im Seitenabruf.
function dekodieren(bytes, kennzeichen) {
  try {
    return new TextDecoder(kennzeichen).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

// Alle <a>-Marken mit einer bestimmten class. Der Marken-Kopf wird als Ganzes
// gelesen, statt einer festen Attributreihenfolge zu vertrauen: Gemessen
// 20.08.2026 schreibt lite/ per POST `href` VOR `class` in EINFACHEN
// Anführungszeichen, html/ genau andersherum in doppelten — die naheliegende
// Regex `class=['"]result-link['"][^>]*href=` traf auf lite/ null von zehn.
function ankerMitKlasse(html, klasse) {
  const gefunden = []
  const marken = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi
  let treffer
  while ((treffer = marken.exec(String(html ?? '')))) {
    if (!hatKlasse(treffer[1], klasse)) continue
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(treffer[1])
    if (!href) continue
    gefunden.push({ href: href[1], anker: treffer[2] })
  }
  return gefunden
}

function hatKlasse(kopf, klasse) {
  const wert = /class\s*=\s*["']([^"']*)["']/i.exec(String(kopf ?? ''))
  return wert ? wert[1].trim().split(/\s+/).includes(klasse) : false
}

// Inhalt aller Marken mit einer bestimmten class (Kurztexte liegen je nach
// Endpunkt in <td> oder <a>). Gesucht wird ab jeder ÖFFNENDEN Marke einzeln:
// Ein Regex über ganze Elemente überspringt verschachtelte Treffer, weil die
// umgebende <div class="result"> zuerst passt und den Kurztext darin
// verschluckt (gemessen an der echten html/-Antwort).
function elementeMitKlasse(html, klasse) {
  const roh = String(html ?? '')
  const gefunden = []
  const marken = /<(a|td|div|span|p)\b([^>]*)>/gi
  let treffer
  while ((treffer = marken.exec(roh))) {
    if (!hatKlasse(treffer[2], klasse)) continue
    const ende = new RegExp(`</${treffer[1]}\\s*>`, 'i').exec(roh.slice(marken.lastIndex))
    gefunden.push(ende ? roh.slice(marken.lastIndex, marken.lastIndex + ende.index) : '')
  }
  return gefunden
}

function absolut(roh, basis) {
  try {
    return new URL(String(roh ?? '').trim(), basis).toString()
  } catch {
    return null
  }
}

// Treffer des lite/-Endpunkts (POST). Gemessen: direkte Zieladressen, kein
// uddg-Umleiter — dafür liegen Anker und Kurztext in GETRENNTEN tr-Zeilen, ein
// Ein-Anker-Regex bekäme den Kurztext nie zu fassen. Deshalb zwei Listen, nach
// Reihenfolge gepaart.
export function ddgLiteTreffer(html) {
  const anker = ankerMitKlasse(html, 'result-link')
  const kurztexte = elementeMitKlasse(html, 'result-snippet')
  const liste = []
  for (let i = 0; i < anker.length && liste.length < WEB_DECKEL.treffer; i++) {
    const adresse = absolut(entitaetenLoesen(anker[i].href), LITE_ADRESSE)
    if (!adresse || !/^https?:/i.test(adresse)) continue
    liste.push({
      titel: entmarkupt(anker[i].anker) || adresse,
      adresse,
      kurztext: kuerzen(entmarkupt(kurztexte[i] ?? ''), WEB_DECKEL.kurztextZeichen)
    })
  }
  return liste
}

// Treffer des html/-Endpunkts. Gemessen: Das href ist NICHT die Zieladresse,
// sondern ein protokoll-relativer Umleiter //duckduckgo.com/l/?uddg=…&amp;rut=…
// (30 von 30 sauber nach Entschärfung von &amp; plus Auspacken). result__url
// ist nur Anzeigetext ohne Schema und taugt nicht als Adresse.
export function ddgHtmlTreffer(html) {
  const anker = ankerMitKlasse(html, 'result__a')
  const kurztexte = elementeMitKlasse(html, 'result__snippet')
  const liste = []
  for (let i = 0; i < anker.length && liste.length < WEB_DECKEL.treffer; i++) {
    const adresse = uddgAuspacken(anker[i].href)
    if (!adresse) continue
    liste.push({
      titel: entmarkupt(anker[i].anker) || adresse,
      adresse,
      kurztext: kuerzen(entmarkupt(kurztexte[i] ?? ''), WEB_DECKEL.kurztextZeichen)
    })
  }
  return liste
}

function uddgAuspacken(roh) {
  const entschaerft = entitaetenLoesen(String(roh ?? '').trim())
  const voll = absolut(entschaerft, HTML_ADRESSE)
  if (!voll) return null
  let url
  try {
    url = new URL(voll)
  } catch {
    return null
  }
  if (/(^|\.)duckduckgo\.com$/i.test(url.hostname) && /^\/l\/?$/.test(url.pathname)) {
    const ziel = url.searchParams.get('uddg')
    if (!ziel) return null
    const sauber = absolut(ziel, HTML_ADRESSE)
    return sauber && /^https?:/i.test(sauber) ? sauber : null
  }
  return /^https?:/i.test(voll) ? voll : null
}

// Zustand einer Antwort der eingebauten Quelle — am RUMPF, nie am Statuscode.
// Gemessen 20.08.2026: Die Sperrseite kommt mit HTTP 202, und
// `new Response('', { status: 202 }).ok` ist true; dieselbe Anfrage kam einmal
// als 200 und einmal als 202. Zustandstabelle: echte Treffer 200 / ~25-33 kB /
// 10 Anker; echtes Nullergebnis 200 / ~9,4 kB / Marke „no-results"; Sperre
// 202 / ~14,2 kB / Marke „anomaly-modal" (im Text „Select all squares
// containing a duck" — für einen Agenten unlösbar). Der <title> der Sperrseite
// ist nur „DuckDuckGo", taugt also als Erkennung nicht.
export function ddgZustand(html) {
  const roh = String(html ?? '')
  if (/anomaly-modal/i.test(roh)) return 'gesperrt'
  if (ddgLiteTreffer(roh).length > 0 || ddgHtmlTreffer(roh).length > 0) return 'treffer'
  if (/no-results/i.test(roh)) return 'nichts'
  return 'unverstanden'
}

// Treffer einer SearXNG-Antwort. Der Kurztext heißt dort `content`, NICHT
// `snippet` (Vertrag aus searx/result_types/_base.py) — ein Griff nach
// `snippet` liefert stumm Treffer ohne Kurztext.
export function searxngTreffer(daten) {
  const roh = Array.isArray(daten?.results) ? daten.results : []
  const liste = []
  for (const eintrag of roh) {
    if (liste.length >= WEB_DECKEL.treffer) break
    const adresse = String(eintrag?.url ?? '').trim()
    if (!/^https?:\/\//i.test(adresse)) continue
    liste.push({
      titel: entmarkupt(eintrag?.title) || adresse,
      adresse,
      kurztext: kuerzen(entmarkupt(eintrag?.content), WEB_DECKEL.kurztextZeichen)
    })
  }
  return liste
}

// ---------------------------------------------------------------------------
// Adressprüfung (Fund 7)
// ---------------------------------------------------------------------------

// Zeigt diese IP auf diesen Rechner oder ins eigene Netz? Gemessen im echten
// Hauptprozess: http://127.0.0.1:11434/api/tags antwortet mit der vollständigen
// Ollama-Modellliste, data: und file: sind ebenfalls erreichbar bzw. sichtbar.
function gesperrteIp(roh) {
  const ip = String(roh ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 127) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    return false
  }
  if (ip.includes(':')) {
    if (ip === '::' || ip === '::1') return true
    // IPv4-eingebettet (::ffff:…) zählt immer als gesperrt: In dieser
    // Schreibweise kommt sonst 127.0.0.1 durch die v4-Prüfung hindurch.
    if (ip.startsWith('::ffff:')) return true
    if (/^fe[89ab]/.test(ip)) return true
    if (/^f[cd]/.test(ip)) return true
    return false
  }
  return false
}

function gesperrterName(hostname) {
  const name = String(hostname ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
  return name === 'localhost' || name.endsWith('.localhost')
}

// Ursprung (Schema + Rechnername + Port) der von Georg selbst eingetragenen
// SearXNG-Adresse. Genau dieser eine Ursprung darf ins eigene Netz zeigen —
// die Adresse stammt aus den Einstellungen, nicht aus einer gelesenen Seite.
// Verglichen wird der Ursprung und nicht die ganze Zeichenkette, weil die
// Abfrage auf <adresse>/search geht.
function ausnahmeUrsprung(ausnahme) {
  const sauber = adresseBereinigen(ausnahme)
  if (!sauber) return null
  try {
    return new URL(sauber).origin.toLowerCase()
  } catch {
    return null
  }
}

// Darf diese Adresse überhaupt abgerufen werden? Rein textlich, ohne Netz —
// die Namensauflösung macht adressePruefen darüber.
export function adresseErlaubt(adresse, ausnahme) {
  const roh = String(adresse ?? '').trim()
  if (!roh) return { ok: false, adresse: '', grund: w.grund.unlesbar }
  // Fehlendes Schema ergänzen statt zu scheitern: Georg schreibt „www.…" in
  // Blockaufträge, und das Modell echot seine Wortwahl (gemessen 20.08.2026).
  // Ein Schema, das FlowForge nicht will (file:, data:), wird dabei NICHT
  // ergänzt — es steht schon da und fällt gleich durch die Schema-Prüfung.
  const mitSchema = /^[a-z][a-z0-9+.-]*:/i.test(roh) ? roh : 'https://' + roh
  let url
  try {
    url = new URL(mitSchema)
  } catch {
    return { ok: false, adresse: roh, grund: w.grund.unlesbar }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    return { ok: false, adresse: roh, grund: w.grund.schema }
  const ursprung = ausnahmeUrsprung(ausnahme)
  if (ursprung && url.origin.toLowerCase() === ursprung)
    return { ok: true, adresse: url.toString(), grund: '' }
  if (gesperrterName(url.hostname) || gesperrteIp(url.hostname))
    return { ok: false, adresse: url.toString(), grund: w.grund.privat }
  return { ok: true, adresse: url.toString(), grund: '' }
}

// Dasselbe, zusätzlich mit Namensauflösung: Ein harmloser Name kann auf
// 127.0.0.1 zeigen (DNS-Rebinding). Gemessen: Ein Server mit
// 302 Location: http://127.0.0.1:11434/api/tags liefert per einfachem fetch die
// Modellliste, und r.url zeigt das interne Ziel erst hinterher — deshalb wird
// jede Adresse VOR dem Abruf geprüft, auch jeder Weiterleitungssprung.
export async function adressePruefen(adresse, ausnahme) {
  const vor = adresseErlaubt(adresse, ausnahme)
  if (!vor.ok) return vor
  const ursprung = ausnahmeUrsprung(ausnahme)
  let url
  try {
    url = new URL(vor.adresse)
  } catch {
    return { ok: false, adresse: vor.adresse, grund: w.grund.unlesbar }
  }
  if (ursprung && url.origin.toLowerCase() === ursprung) return vor
  const name = url.hostname.replace(/^\[/, '').replace(/\]$/, '')
  // Literale IPs hat adresseErlaubt schon geprüft — für sie gibt es nichts
  // aufzulösen.
  if (/^[\d.]+$/.test(name) || name.includes(':')) return vor
  try {
    const eintraege = await dns.promises.lookup(name, { all: true })
    for (const eintrag of eintraege)
      if (gesperrteIp(eintrag.address))
        return { ok: false, adresse: vor.adresse, grund: w.grund.privat }
  } catch {
    // Der Name löst nicht auf — der Abruf gleich darauf meldet das ehrlich
    // (ENOTFOUND), hier wird deshalb nicht vorab abgelehnt.
  }
  return vor
}

// ---------------------------------------------------------------------------
// Netzfehler in deutschen Klartext
// ---------------------------------------------------------------------------

// e.message ist bei Nodes fetch IMMER nur „fetch failed" (gemessen) — der
// Grund steckt in e.cause.code.
const FEHLER_CODES = {
  ENOTFOUND: 'namelos',
  EAI_AGAIN: 'namelos',
  ECONNREFUSED: 'verweigert',
  ECONNRESET: 'abgebrochen',
  EPIPE: 'abgebrochen',
  ETIMEDOUT: 'zeit',
  UND_ERR_CONNECT_TIMEOUT: 'zeit',
  UND_ERR_HEADERS_TIMEOUT: 'zeit',
  UND_ERR_BODY_TIMEOUT: 'zeit',
  CERT_HAS_EXPIRED: 'zertifikatAbgelaufen',
  ERR_TLS_CERT_ALTNAME_INVALID: 'zertifikatFremd',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'zertifikatSelbst',
  SELF_SIGNED_CERT_IN_CHAIN: 'zertifikatSelbst',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'zertifikatSelbst'
}

export function netzFehlerText(fehler) {
  const name = String(fehler?.name ?? '')
  if (name === 'TimeoutError' || name === 'AbortError') return w.grund.zeit
  const code = String(fehler?.cause?.code ?? fehler?.code ?? '')
  const schluessel = FEHLER_CODES[code]
  if (schluessel) return w.grund[schluessel]
  return code ? w.grund.unbekannt(code) : w.grund.unbekannt(String(fehler?.message ?? '?'))
}

// ---------------------------------------------------------------------------
// Drossel und gemerkte Sperre — app-weit, weil das Modul ein Singleton ist
// ---------------------------------------------------------------------------

let schlange = Promise.resolve()
let letzteAbfrage = 0
let gesperrtBis = 0

function pause(ms) {
  return new Promise((fertig) => setTimeout(fertig, ms))
}

// Abfragen der eingebauten Quelle laufen NACHEINANDER mit Mindestabstand.
// Kein automatischer Wiederholversuch: Die Sperre erholt sich gemessen erst
// nach 45 bis 241 Sekunden, ein Retry-After schickt die Quelle nicht (gemessen
// null) — sofort noch einmal fragen verlängert die Sperre nur.
function anstellen(arbeit) {
  const lauf = schlange.then(async () => {
    const rest = WEB_DECKEL.mindestAbstandMs - (Date.now() - letzteAbfrage)
    if (rest > 0) await pause(rest)
    try {
      return await arbeit()
    } finally {
      letzteAbfrage = Date.now()
    }
  })
  schlange = lauf.then(
    () => {},
    () => {}
  )
  return lauf
}

// ---------------------------------------------------------------------------
// Abruf (Strom-Deckel, Zeitlimit, Zeichensatz)
// ---------------------------------------------------------------------------

// Rumpf strömend lesen und bei rumpfBytes abbrechen. Bewusst über
// body.getReader() und reader.cancel(): `for await (…body)` mit body.cancel()
// wirft ERR_INVALID_STATE (gemessen). cancel() bricht die Leitung wirklich ab
// (gemessen gegen den vollen Abruf: 212.992 Bytes in 15-40 ms statt 2 MB).
async function rumpfLesen(antwort, deckel) {
  const koerper = antwort.body
  if (!koerper) return { bytes: new Uint8Array(0), abgeschnitten: false }
  const leser = koerper.getReader()
  const stuecke = []
  let gelesen = 0
  let abgeschnitten = false
  try {
    for (;;) {
      const { done, value } = await leser.read()
      if (done) break
      if (!value) continue
      stuecke.push(value)
      gelesen += value.length
      if (gelesen >= deckel) {
        abgeschnitten = true
        break
      }
    }
  } finally {
    try {
      await leser.cancel()
    } catch {
      // Der Strom war schon zu Ende — nichts abzubrechen.
    }
  }
  const alles = new Uint8Array(gelesen)
  let stelle = 0
  for (const stueck of stuecke) {
    alles.set(stueck, stelle)
    stelle += stueck.length
  }
  return { bytes: alles, abgeschnitten }
}

// Jeder fetch bekommt ein FRISCHES Zeitlimit-Signal. Gegenbeispiel im Haus
// (lokalesModell.js): ein Signal für zwei Aufrufe teilt sich das Budget.
// Gemessen: ohne Signal läuft ein Abruf gegen einen Server, der den Rumpf nie
// beendet, auch nach zehn Minuten noch; mit Signal bricht er nach 2009 ms mit
// TimeoutError ab.
//
// Zur Vorgabe `umleitung: 'follow'`: Sie gilt nur für die zwei fest im Code
// stehenden Suchadressen und für Georgs eigene SearXNG-Adresse — beide sind
// keine Ziele aus Fremdtext, und beide leiten im Normalbetrieb um (Schrägstrich
// am Ende, Sprachfassung). Der Seitenabruf, dessen Adresse aus einem Suchtreffer
// oder aus dem Modell stammt, ruft ausdrücklich mit 'manual' auf und prüft
// jeden Sprung einzeln.
async function holen(adresse, { methode = 'GET', koerper = null, kopfzeilen = {}, zeitlimitMs, umleitung = 'follow' }) {
  return fetch(adresse, {
    method: methode,
    body: koerper,
    headers: kopfzeilen,
    redirect: umleitung,
    signal: AbortSignal.timeout(zeitlimitMs)
  })
}

// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

function suchFehler(art, text) {
  return {
    ok: false,
    treffer: [],
    quelle: 'eingebaut',
    ausgewichen: false,
    ausweichGrund: '',
    fehlerArt: art,
    fehlertext: text
  }
}

async function ddgAbfragen(adresse, begriff, perPost) {
  const antwort = await holen(perPost ? adresse : adresse + '?q=' + encodeURIComponent(begriff), {
    methode: perPost ? 'POST' : 'GET',
    koerper: perPost ? new URLSearchParams({ q: begriff }).toString() : null,
    kopfzeilen: perPost ? { 'content-type': 'application/x-www-form-urlencoded' } : {},
    zeitlimitMs: WEB_DECKEL.sucheZeitlimitMs
  })
  const { bytes } = await rumpfLesen(antwort, WEB_DECKEL.rumpfBytes)
  return textAusBytes(bytes, antwort.headers.get('content-type'))
}

async function eingebauteSuche(begriff) {
  if (Date.now() < gesperrtBis) return suchFehler('gesperrt', w.quelleGesperrt)
  return anstellen(async () => {
    // Weg 1: lite/ per POST — liefert direkte Adressen ohne Umleiter.
    // Weg 2: html/ mit uddg-Auspacken. Weg 2 ist KEINE Ausweichquelle bei
    // Sperre: Beide Endpunkte teilen sie (gemessen: alle Wege binnen Sekunden
    // 202). Er greift nur, wenn Weg 1 unverstanden antwortet.
    const wege = [
      { adresse: LITE_ADRESSE, perPost: true },
      { adresse: HTML_ADRESSE, perPost: false }
    ]
    let letzterFehler = null
    for (let i = 0; i < wege.length; i++) {
      if (i > 0) await pause(WEB_DECKEL.mindestAbstandMs)
      let html
      try {
        html = await ddgAbfragen(wege[i].adresse, begriff, wege[i].perPost)
      } catch (fehler) {
        letzterFehler = fehler
        continue
      }
      const zustand = ddgZustand(html)
      if (zustand === 'gesperrt') {
        gesperrtBis = Date.now() + WEB_DECKEL.drosselPauseMs
        return suchFehler('gesperrt', w.quelleGesperrt)
      }
      if (zustand === 'treffer') {
        const treffer = wege[i].perPost ? ddgLiteTreffer(html) : ddgHtmlTreffer(html)
        return {
          ok: true,
          treffer,
          quelle: 'eingebaut',
          ausgewichen: false,
          ausweichGrund: '',
          fehlerArt: '',
          fehlertext: ''
        }
      }
      if (zustand === 'nichts')
        return {
          ok: true,
          treffer: [],
          quelle: 'eingebaut',
          ausgewichen: false,
          ausweichGrund: '',
          fehlerArt: '',
          fehlertext: ''
        }
      // 'unverstanden' → nächster Weg.
    }
    return letzterFehler
      ? suchFehler('nichtErreichbar', w.quelleNichtErreichbar(netzFehlerText(letzterFehler)))
      : suchFehler('unverstanden', w.quelleNichtErreichbar(w.grund.unverstanden))
  })
}

// SearXNG geht an der Drossel vorbei: Es ist Georgs eigene Instanz, sie
// braucht keinen Schutz vor Georgs eigenen Blöcken.
async function searxngSuche(begriff, adresse) {
  const basis = adresseBereinigen(adresse)
  if (!basis) return { ok: false, treffer: [], grund: w.grund.unlesbar }
  try {
    const antwort = await holen(
      basis + '/search?q=' + encodeURIComponent(begriff) + '&format=json',
      { kopfzeilen: { accept: 'application/json' }, zeitlimitMs: WEB_DECKEL.sucheZeitlimitMs }
    )
    if (antwort.status === 429) return { ok: false, treffer: [], grund: w.grund.gedrosselt }
    const { bytes } = await rumpfLesen(antwort, WEB_DECKEL.rumpfBytes)
    if (!antwort.ok) return { ok: false, treffer: [], grund: w.grund.keinJson }
    let daten
    try {
      daten = JSON.parse(textAusBytes(bytes, antwort.headers.get('content-type')))
    } catch {
      return { ok: false, treffer: [], grund: w.grund.keinJson }
    }
    if (!Array.isArray(daten?.results)) return { ok: false, treffer: [], grund: w.grund.keinJson }
    return { ok: true, treffer: searxngTreffer(daten), grund: '' }
  } catch (fehler) {
    return { ok: false, treffer: [], grund: netzFehlerText(fehler) }
  }
}

// Sucht — über SearXNG, wenn eine Adresse eingetragen ist, sonst über die
// eingebaute Quelle. Antwortet SearXNG nicht brauchbar, weicht FlowForge auf
// die eingebaute Quelle aus und SAGT es (Entscheidung Georg, 20.08.2026: kein
// stiller Wechsel). Eine Sperre der eingebauten Quelle ist ein ehrlicher
// Fehler, nie „keine Treffer" — genau das Raten soll dieser Schritt abschaffen.
export async function websucheDurchfuehren({ suchbegriff, searxngAdresse } = {}) {
  const begriff = String(suchbegriff ?? '').trim()
  if (!begriff) return suchFehler('begriffFehlt', w.begriffFehlt)
  const searx = String(searxngAdresse ?? '').trim()
  if (!searx) return eingebauteSuche(begriff)
  const versuch = await searxngSuche(begriff, searx)
  if (versuch.ok)
    return {
      ok: true,
      treffer: versuch.treffer,
      quelle: 'searxng',
      ausgewichen: false,
      ausweichGrund: '',
      fehlerArt: '',
      fehlertext: ''
    }
  const ersatz = await eingebauteSuche(begriff)
  return { ...ersatz, ausgewichen: true, ausweichGrund: versuch.grund }
}

// ---------------------------------------------------------------------------
// Seite lesen
// ---------------------------------------------------------------------------

function seitenFehler(adresse, art, text) {
  return {
    ok: false,
    adresse,
    titel: '',
    text: '',
    gekuerzt: false,
    zeichen: 0,
    fehlerArt: art,
    fehlertext: text
  }
}

function deckelWaehlen(roh) {
  const zahl = Number(roh)
  if (!Number.isFinite(zahl) || zahl <= 0) return WEB_DECKEL.seiteZeichen
  return Math.min(Math.round(zahl), WEB_DECKEL.seiteZeichenMax)
}

const UMLEITUNGEN = new Set([301, 302, 303, 307, 308])

// Holt den Text einer Seite. Jeder Weiterleitungssprung wird EINZELN geprüft
// (redirect: 'manual'), und die Rückgabe trägt immer die tatsächlich gelesene
// ENDADRESSE — der Ticker soll nicht die harmlose Startadresse zeigen, während
// in Wahrheit eine Router-Oberfläche im Arbeitsgedächtnis landet.
export async function webseiteLesen({ adresse, zeichenDeckel, searxngAdresse } = {}) {
  const roh = String(adresse ?? '').trim()
  if (!roh) return seitenFehler('', 'adresseFehlt', w.adresseFehlt)
  const deckel = deckelWaehlen(zeichenDeckel)
  let ziel = roh
  for (let sprung = 0; sprung <= WEB_DECKEL.sprungDeckel; sprung++) {
    const geprueft = await adressePruefen(ziel, searxngAdresse)
    if (!geprueft.ok)
      return seitenFehler(geprueft.adresse, 'abgelehnt', w.adresseAbgelehnt(geprueft.grund))
    let antwort
    try {
      antwort = await holen(geprueft.adresse, {
        zeitlimitMs: WEB_DECKEL.seiteZeitlimitMs,
        umleitung: 'manual'
      })
    } catch (fehler) {
      const name = String(fehler?.name ?? '')
      if (name === 'TimeoutError' || name === 'AbortError')
        return seitenFehler(geprueft.adresse, 'zeitlimit', w.zeitlimit)
      return seitenFehler(
        geprueft.adresse,
        'nichtErreichbar',
        w.quelleNichtErreichbar(netzFehlerText(fehler))
      )
    }
    const weiter = antwort.headers.get('location')
    if (UMLEITUNGEN.has(antwort.status) && weiter) {
      try {
        await antwort.body?.cancel()
      } catch {
        // Umleitungen haben meist gar keinen Rumpf.
      }
      const naechste = absolut(weiter, geprueft.adresse)
      if (!naechste) return seitenFehler(geprueft.adresse, 'abgelehnt', w.adresseAbgelehnt(w.grund.unlesbar))
      ziel = naechste
      continue
    }
    return await antwortLesen(antwort, geprueft.adresse, deckel)
  }
  return seitenFehler(ziel, 'abgelehnt', w.adresseAbgelehnt(w.grund.spruenge))
}

async function antwortLesen(antwort, adresse, deckel) {
  const art = String(antwort.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  // Nach content-type verzweigen, BEVOR irgendetwas entkernt wird. Gemessen
  // 20.08.2026: Eine Standard-Entkernung macht aus einem PDF 6.701 Zeichen
  // „%PDF-1.4 %äüöß 2 0 obj > stream x…" (2.588 Ersatzzeichen — der auf
  // Überschätzung ausgelegte Wächter unterschätzt diesen Müll sogar), und aus
  // einem SVG 0 Zeichen, was wie eine leere Seite aussieht.
  const istHtml = art === 'text/html' || art === 'application/xhtml+xml'
  const istText = art.startsWith('text/') || art === 'application/json' || art.endsWith('+json')
  if (!istHtml && !istText) {
    try {
      await antwort.body?.cancel()
    } catch {
      // Nichts abzubrechen.
    }
    return seitenFehler(adresse, 'keineTextseite', w.keineTextseite(art || '?'))
  }
  let bytes
  try {
    ;({ bytes } = await rumpfLesen(antwort, WEB_DECKEL.rumpfBytes))
  } catch (fehler) {
    const name = String(fehler?.name ?? '')
    if (name === 'TimeoutError' || name === 'AbortError')
      return seitenFehler(adresse, 'zeitlimit', w.zeitlimit)
    return seitenFehler(adresse, 'nichtErreichbar', w.quelleNichtErreichbar(netzFehlerText(fehler)))
  }
  const roh = textAusBytes(bytes, antwort.headers.get('content-type'))
  const titel = istHtml ? entmarkupt(/<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(roh)?.[1] ?? '') : ''
  const voll = istHtml ? htmlZuText(roh) : roh.trim()
  const gekuerzt = voll.length > deckel
  const text = gekuerzt ? voll.slice(0, deckel).trimEnd() : voll
  return {
    ok: true,
    adresse,
    titel,
    text,
    gekuerzt,
    zeichen: text.length,
    fehlerArt: '',
    fehlertext: ''
  }
}

// ---------------------------------------------------------------------------
// Live-Status der SearXNG-Adresse (Einstellungen)
// ---------------------------------------------------------------------------

// Drei Zustände, an der JSON-ANTWORT SELBST unterschieden. Warum nicht am
// Statuscode: Gemessen 20.08.2026 an zehn öffentlichen Instanzen liefern fünf
// auf ?format=json ein 403 (SearXNG erlaubt im Auslieferungszustand unter
// search: nur `formats: - html`), zwei antworten mit HTTP 200 und einer
// HTML-Bot-Prüfseite, eine mit 429. Und die WURZELADRESSE antwortet auf allen
// 403-Instanzen mit 200 — eine naive Erreichbarkeitsprüfung zeigt Grün,
// während jede Suche scheitert. /healthz taugt nur als Vorabprobe (text/plain
// „OK") und darf NIE durch den JSON-Parser.
export async function searxngStatus(adresse) {
  const basis = adresseBereinigen(adresse)
  if (!basis) return { erreichbar: false, jsonDa: false, gedrosselt: false }
  try {
    const antwort = await holen(basis + '/search?q=flowforge&format=json', {
      kopfzeilen: { accept: 'application/json' },
      zeitlimitMs: WEB_DECKEL.sucheZeitlimitMs
    })
    if (antwort.status === 429) {
      try {
        await antwort.body?.cancel()
      } catch {
        // Nichts abzubrechen.
      }
      return { erreichbar: true, jsonDa: false, gedrosselt: true }
    }
    const { bytes } = await rumpfLesen(antwort, WEB_DECKEL.rumpfBytes)
    if (!antwort.ok) return { erreichbar: true, jsonDa: false, gedrosselt: false }
    let daten
    try {
      daten = JSON.parse(textAusBytes(bytes, antwort.headers.get('content-type')))
    } catch {
      return { erreichbar: true, jsonDa: false, gedrosselt: false }
    }
    return { erreichbar: true, jsonDa: Array.isArray(daten?.results), gedrosselt: false }
  } catch {
    return { erreichbar: false, jsonDa: false, gedrosselt: false }
  }
}
