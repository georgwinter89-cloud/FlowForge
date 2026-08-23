// Die Zählstelle (Bauschritt 54): ein HTTP-Weiterleiter zwischen FlowForge und
// Ollama, damit die Werkstatt die lokale KI wirklich messen kann.
//
// Warum das geht, ohne dass Georg etwas installiert (gemessen 22.08.2026):
// Es gibt genau EINE Stelle, an der der Weg zur lokalen KI festgelegt wird —
// `umgebung.ANTHROPIC_BASE_URL = lokal.adresse` in claudeCodeMotor.js. Trägt
// FlowForge dort seine eigene Adresse ein, läuft der ganze Verkehr des
// Block-Agenten durch FlowForge: ohne Python, ohne Fremdprozess, ohne
// zusätzlichen Port auf dem Ollama-Rechner. Die Helfer-KI (lokaleHelfer.js)
// spricht mit eigenem fetch an dieser Stelle vorbei, nimmt ihre Adresse aber
// als Parameter — sie wird deshalb in lauf.js ABSICHTLICH ebenfalls hierher
// gelenkt, sonst zeigte die Werkstatt die halbe Wahrheit.
//
// Die Regeln, die nicht verhandelbar sind (BAUPLAN 54):
//  - Nur an 127.0.0.1 gebunden, Port vom Betriebssystem (Port 0), je Motor
//    frisch. NIE eine feste Nummer: Ein belegter Port legte sonst jeden
//    lokalen Lauf lahm — genau der Befund, der 0.46.2 den Port-Schutz des
//    Rauchtests eingebracht hat.
//  - Anfrage und Antwort gehen DURCH — Strom an Strom, ohne zu sammeln, ohne
//    umzuformen. Gezählt wird aus dem, was ohnehin vorbeikommt.
//  - Die Gegenprobe steht im Bauplan: 0.51.2 hat gemessen, dass ein schlecht
//    gebautes Textfilter den ganzen Hauptprozess 232 Sekunden stilllegt (1 MB
//    Eingabe, kein Timer lief). Dieselbe Bauart hier hieße: Kein lokaler Block
//    redet mehr mit Ollama. Deshalb hält diese Datei nie mehr als den Rest
//    hinter dem letzten Zeilenumbruch (ZEILEN_DECKEL), und die Suche läuft
//    über Buffer.indexOf statt über eine Regex auf gesammeltem Text.
//  - Fällt die Zählstelle aus, fällt nicht der Lauf aus: Lässt sie sich nicht
//    binden, sagt es der Ticker im Klartext, und der Block bekommt die echte
//    Ollama-Adresse wie bisher.
//  - Sie reicht ausschließlich an die EINE zugeteilte Adresse weiter. Ein
//    Client darf die Anfragezeile auch in der absoluten Form schicken
//    („POST http://fremd/v1/messages") — davon überlebt hier nur Pfad und
//    Abfrage (anfragePfad).
//
// Keine Electron-Abhängigkeit: node:http und die Regeln aus src/shared/ —
// damit die Prüfskripte eine echte Zählstelle gegen einen echten Stub fahren
// können, inklusive der Pflicht-Messung der zusätzlichen Verzögerung.
import http from 'node:http'
import https from 'node:https'
import { StringDecoder } from 'node:string_decoder'
import { pfadZaehlt, usageAusZeile, ZAEHL_MARKEN } from '../../shared/zaehlRegeln.js'

// Verbindungsbezogene Kopfzeilen gehören der EINEN Verbindung und dürfen nicht
// weitergereicht werden — ein durchgereichtes „transfer-encoding: chunked"
// neben der von Node selbst gesetzten Rahmung ergibt einen kaputten Strom.
export const VERBINDUNGS_KOPFZEILEN = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]

// Deckel je Zeile. Eine Zeile, die länger wird, wird NICHT ausgewertet und
// NICHT gesammelt — sie geht (wie alles) durch, zählt aber nicht mit. Das ist
// die eine Stelle, die verhindert, dass ein Antwortstrom ohne Zeilenumbruch die
// Zählstelle zum Sammelbecken macht.
export const ZEILEN_DECKEL = 262144

// Der angefragte Pfad, unabhängig davon, in welcher Form die Anfragezeile kam.
export function anfragePfad(rohUrl) {
  const roh = String(rohUrl ?? '')
  if (!roh) return '/'
  if (roh.startsWith('/')) return roh
  try {
    const url = new URL(roh)
    return (url.pathname || '/') + (url.search || '')
  } catch {
    return '/'
  }
}

// Kopfzeilen fürs Weiterreichen: verbindungsbezogene raus, `host` auf das echte
// Ziel. `content-length` bleibt stehen — der Rumpf geht unverändert durch, die
// Länge stimmt also weiter.
//
// `accept-encoding: identity` ist die EINE bewusste Änderung am Verkehr, und
// sie gehört benannt: Käme die Antwort gepackt zurück, sähe die Zählstelle nur
// Kompressat und könnte kein einziges Token zählen — die Werkstatt zeigte dann
// eine leere Tabelle, ohne dass jemand den Grund erführe. Über 127.0.0.1 bzw.
// das eigene Netz kostet ungepackt nichts, was zählt. Kommt trotzdem eine
// gepackte Antwort (ein Ollama, das sich nicht daran hält), wird sie ehrlich
// NICHT gezählt statt falsch gezählt.
export function kopfzeilenWeiterreichen(kopfzeilen, zielHost) {
  const raus = {}
  for (const [name, wert] of Object.entries(kopfzeilen ?? {})) {
    const klein = name.toLowerCase()
    if (VERBINDUNGS_KOPFZEILEN.includes(klein) || klein === 'host') continue
    if (klein === 'accept-encoding') continue
    raus[name] = wert
  }
  raus['accept-encoding'] = 'identity'
  if (zielHost) raus.host = zielHost
  return raus
}

// Trägt die Antwort eine Packung, ist sie nicht auswertbar — dann zählt diese
// Antwort ehrlich gar nicht mit, statt aus Kompressat Zahlen zu erfinden.
export function antwortZaehlbar(kopfzeilen) {
  const wert = String(kopfzeilen?.['content-encoding'] ?? '').trim().toLowerCase()
  return wert === '' || wert === 'identity'
}

// Zeilenweiser Zähler über den durchlaufenden Antwortstrom.
//
// Bauart und ihre Begründung:
//  - Es wird NUR der Rest hinter dem letzten Zeilenumbruch gehalten, nie der
//    Strom. Der Speicherbedarf ist durch ZEILEN_DECKEL gedeckelt, egal ob
//    10 KB oder 100 MB durchgehen.
//  - Gesucht wird mit indexOf über Bytes (eine C++-Schleife), nicht mit einer
//    Regex über gesammelten Text. Der Aufwand ist linear in der Strommenge.
//  - Zu Text gemacht wird eine Zeile nur, wenn sie eine Zählmarke trägt.
export function tokenStrom() {
  let rest = null
  let hinein = null
  let heraus = null
  let ueberlang = false

  function zeileAuswerten(puffer) {
    let marke = false
    for (const m of ZAEHL_MARKEN)
      if (puffer.includes(m)) {
        marke = true
        break
      }
    if (!marke) return
    const treffer = usageAusZeile(puffer.toString('utf8'))
    if (!treffer) return
    // Kumulierte Stände: die zuletzt gemeldete Zahl gilt. `message_start`
    // meldet die Eingabe, `message_delta` die bis dahin erzeugte Ausgabe.
    if (treffer.hinein !== null) hinein = treffer.hinein
    if (treffer.heraus !== null) heraus = treffer.heraus
  }

  return {
    schub(stueck) {
      if (stueck === null || stueck === undefined) return
      const puffer = Buffer.isBuffer(stueck) ? stueck : Buffer.from(String(stueck), 'utf8')
      if (puffer.length === 0) return
      let ab = 0
      while (true) {
        const umbruch = puffer.indexOf(10, ab)
        if (umbruch < 0) break
        const stueckchen = puffer.subarray(ab, umbruch)
        ab = umbruch + 1
        if (ueberlang) {
          // Die überlange Zeile ist zu Ende — ab hier zählt wieder normal.
          ueberlang = false
          rest = null
          continue
        }
        const zeile = rest ? Buffer.concat([rest, stueckchen]) : stueckchen
        rest = null
        if (zeile.length > 0) zeileAuswerten(zeile)
      }
      const schwanz = puffer.subarray(ab)
      if (schwanz.length === 0) return
      if (ueberlang) return
      const neu = rest ? Buffer.concat([rest, schwanz]) : Buffer.from(schwanz)
      if (neu.length > ZEILEN_DECKEL) {
        // Zu lang: verwerfen und bis zum nächsten Umbruch nicht mehr auswerten.
        // Nicht sammeln ist die Zusage — nicht „später vielleicht doch".
        rest = null
        ueberlang = true
        return
      }
      rest = neu
    },
    // Die letzte Zeile eines Stroms trägt bei Ollama (stream:false) die Zahlen
    // und endet oft OHNE Zeilenumbruch — ohne diesen Abschluss zählte genau die
    // Antwort nicht, die alles enthält.
    abschluss() {
      const zeile = rest
      rest = null
      if (ueberlang || !zeile) return
      zeileAuswerten(zeile)
    },
    stand() {
      return { hinein, heraus }
    }
  }
}

function zielZerlegen(adresse) {
  const roh = String(adresse ?? '').trim().replace(/\/+$/, '')
  if (!roh) return null
  let url
  try {
    url = new URL(roh)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return {
    sicher: url.protocol === 'https:',
    rechner: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    // Der Pfad-Vorsatz einer Adresse wie „http://rechner:11434/ollama" bleibt
    // erhalten — sonst spränge die Weiterleitung an ihm vorbei.
    vorsatz: url.pathname.replace(/\/+$/, ''),
    host: url.host
  }
}

// Startet eine Zählstelle vor genau einer Ollama-Adresse.
//
// Rückgabe:
//   { ok: true, adresse, ziel, stand(), blockBeginnt(), schliessen() }
//   { ok: false, fehler }   — dann NIE ein Ersatz-Ziel erfinden: Der Aufrufer
//                             nimmt die echte Adresse und sagt es im Ticker.
export async function zaehlstelleStarten({ ziel, art = 'block', name = '' } = {}) {
  const z = zielZerlegen(ziel)
  if (!z) return { ok: false, fehler: 'Ziel-Adresse unbrauchbar' }

  const treiber = z.sicher ? https : http
  // Eigener Verbindungspool mit Dauerverbindungen: Jeder Turn eines lokalen
  // Blocks ist eine neue Anfrage, und ein frischer TCP-Aufbau je Turn wäre
  // genau die Verzögerung, die dieser Schritt messen und klein halten will.
  const pool = new treiber.Agent({ keepAlive: true, maxSockets: 16 })

  // Kumulierte Stände dieser Zählstelle (Lebensdauer = ein Motor).
  // Bytes und Zeichen getrennt geführt, weil sie zwei verschiedene Fragen
  // beantworten: Bytes sind der Verkehr, Zeichen sind der Maßstab, in dem
  // FlowForge den Füllstand schätzt (Zeichen ÷ 3,5). Wer beides in einen Topf
  // wirft, vergleicht am Ende Umlaute mit Tokens.
  const gesamt = {
    anfragen: 0,
    tokenHinein: 0,
    tokenHeraus: 0,
    anfrageBytes: 0,
    antwortBytes: 0,
    nichtZaehlbar: 0,
    fehler: 0
  }
  // Fenster des GERADE laufenden Blocks — der Motor setzt es bei jedem
  // Blockbeginn zurück. Ohne diesen Schnitt trüge der Vergleich am Blockende
  // die Spitze eines Vorgänger-Blocks derselben Motor-Instanz.
  let fenster = neuesFenster()
  let letzteErsteKachelMs = null
  // Die gerade LAUFENDEN Anfragen (Bauschritt 54, im Probelauf am 23.08.2026
  // gemessen): Ein Gesprächswechsel eines lokalen Blocks dauert Minuten. Würde
  // erst beim Ende der Antwort gebucht, sähe die Werkstatt die ganze Zeit tot
  // aus — und ausgerechnet der gemessene Füllstand fehlte, obwohl er in dem
  // Moment feststeht, in dem die Anfrage draußen ist. Genau das ist der Zweck
  // der Zählstelle: Sie sieht die Anfrage, BEVOR Ollama sie beschneidet.
  // Der Probelauf zeigte es schwarz auf weiß: offene Verbindung zu Ollama,
  // Anzeige 0 Anfragen / 0 Tokens.
  const laufend = new Set()

  function neuesFenster() {
    return {
      beginn: Date.now(),
      anfragen: 0,
      tokenHinein: 0,
      tokenHeraus: 0,
      letzteAnfrageZeichen: 0,
      groessteAnfrageZeichen: 0,
      letzteAntwortZeit: 0
    }
  }

  const server = http.createServer()
  // Wartezeiten, die zu FlowForge passen statt zu einem Webserver im Internet:
  // Ein lokaler Block wartet bis zu einer Stunde auf eine Antwort (Einstellung
  // „Wartezeit auf Antworten der lokalen KI"). Nodes Vorgaben (5 min für die
  // Anfrage, 5 s Dauerverbindung) würden mitten im Lauf zuschlagen.
  // keepAliveTimeout deutlich ÜBER der Vorgabe des Clients (undici: 4 s), damit
  // immer der Client die Verbindung schließt — sonst gibt es das bekannte
  // Wettrennen, bei dem eine gerade abgeschickte POST-Anfrage auf eine soeben
  // geschlossene Verbindung trifft.
  server.requestTimeout = 0
  server.timeout = 0
  server.keepAliveTimeout = 60_000
  server.headersTimeout = 65_000

  server.on('request', (anfrage, antwort) => {
    const pfad = anfragePfad(anfrage.url)
    const zaehlt = pfadZaehlt(pfad)
    const beginn = Date.now()
    let anfrageZeichen = 0
    let ersteAntwortMs = null
    let strom = zaehlt ? tokenStrom() : null
    // Zeichen statt Bytes für den Füllstands-Vergleich: Die Schätzung im Motor
    // zählt Zeichen (String.length), also muss die Messung dieselbe Einheit
    // liefern — sonst wären Umlaute allein schon ein „Abstand". Der Decoder
    // wandelt Stück für Stück und behält nichts: Der umgewandelte Text wird
    // sofort auf seine Länge reduziert und fallengelassen.
    const zeichenLeser = zaehlt ? new StringDecoder('utf8') : null
    // Der Platz dieser Anfrage in der Liste der laufenden — sie steht dort vom
    // Absenden bis zum Ende der Antwort und liefert der Werkstatt so lange
    // Zwischenstände. `strom` wird als Funktion gehalten, weil er bei einer
    // gepackten Antwort noch auf null fallen kann.
    const platz = zaehlt ? { zeichen: 0, holeStrom: () => strom } : null

    // Verzögerung klein halten: Ohne setNoDelay sammelt das Betriebssystem
    // kleine Pakete (Nagle) — bei einem Ereignisstrom sind das genau die
    // Kacheln, die sofort ankommen sollen.
    anfrage.socket?.setNoDelay?.(true)

    const hinaus = treiber.request(
      {
        agent: pool,
        protocol: z.sicher ? 'https:' : 'http:',
        host: z.rechner,
        port: z.port,
        method: anfrage.method,
        path: z.vorsatz + pfad,
        headers: kopfzeilenWeiterreichen(anfrage.headers, z.host)
      },
      (herein) => {
        herein.socket?.setNoDelay?.(true)
        ersteAntwortMs = Date.now() - beginn
        const kopf = {}
        for (const [name, wert] of Object.entries(herein.headers))
          if (!VERBINDUNGS_KOPFZEILEN.includes(name.toLowerCase())) kopf[name] = wert
        // Gepackte Antwort: ehrlich nicht zählen statt falsch zählen.
        if (strom && !antwortZaehlbar(herein.headers)) {
          strom = null
          gesamt.nichtZaehlbar++
        }
        antwort.writeHead(herein.statusCode ?? 502, kopf)
        herein.on('data', (stueck) => {
          gesamt.antwortBytes += stueck.length
          strom?.schub(stueck)
          // Rückstau ehrlich weiterreichen: Schreibt die Gegenseite langsamer,
          // als Ollama liefert, wird der Zulauf angehalten statt im Speicher
          // aufgetürmt.
          if (!antwort.write(stueck)) {
            herein.pause()
            antwort.once('drain', () => herein.resume())
          }
        })
        herein.on('end', () => {
          strom?.abschluss()
          antwort.end()
          abschliessen()
        })
        herein.on('aborted', () => {
          laufend.delete(platz)
          antwort.destroy()
          gesamt.fehler++
        })
        herein.on('error', () => {
          laufend.delete(platz)
          antwort.destroy()
          gesamt.fehler++
        })
      }
    )

    function abschliessen() {
      if (!zaehlt) return
      // Aus der Liste der laufenden heraus, BEVOR gebucht wird — sonst zählte
      // diese Antwort für einen Augenblick doppelt (einmal als Zwischenstand,
      // einmal als Summe).
      laufend.delete(platz)
      const stand = strom ? strom.stand() : { hinein: null, heraus: null }
      const dauer = Date.now() - beginn
      gesamt.anfragen++
      fenster.anfragen++
      // Die gemeldeten Zahlen sind KUMULIERTE Stände EINER Antwort — für die
      // Summe über den Lauf zählt jede Antwort einmal.
      if (stand.hinein !== null) {
        gesamt.tokenHinein += stand.hinein
        fenster.tokenHinein += stand.hinein
      }
      if (stand.heraus !== null) {
        gesamt.tokenHeraus += stand.heraus
        fenster.tokenHeraus += stand.heraus
      }
      // Die Anfrage-Zeichen stehen schon seit dem Absenden (anfrage.on('end'))
      // — hier werden sie bewusst NICHT noch einmal gesetzt: Ein zweiter
      // Wohnort für dieselbe Zahl ist genau die Sorte Doppelbuchung, an der
      // später niemand mehr erkennt, welche gilt.
      fenster.letzteAntwortZeit = Date.now()
      // Die eigene Verzögerung, ehrlich getrennt: Wie lange lag zwischen dem
      // Eintreffen der Anfrage und der ersten Kachel der Antwort, ABZÜGLICH
      // dessen, was Ollama selbst gebraucht hat, lässt sich von hier aus nicht
      // sagen — gemerkt wird deshalb nur die Zeit bis zur ersten Kachel und die
      // Gesamtdauer. Was die Zählstelle KOSTET, misst die Prüfung mit einem
      // Stub-Ollama gegen den direkten Weg.
      letzteErsteKachelMs = ersteAntwortMs ?? dauer
    }

    anfrage.on('data', (stueck) => {
      gesamt.anfrageBytes += stueck.length
      if (zeichenLeser) anfrageZeichen += zeichenLeser.write(stueck).length
      if (!hinaus.write(stueck)) {
        anfrage.pause()
        hinaus.once('drain', () => anfrage.resume())
      }
    })
    anfrage.on('end', () => {
      if (zeichenLeser) anfrageZeichen += zeichenLeser.end().length
      // JETZT steht der gemessene Füllstand fest — nicht erst, wenn Ollama
      // fertig geantwortet hat. Die Anfrage ist vollständig durchgereicht.
      if (platz) {
        platz.zeichen = anfrageZeichen
        laufend.add(platz)
        fenster.letzteAnfrageZeichen = anfrageZeichen
        fenster.groessteAnfrageZeichen = Math.max(fenster.groessteAnfrageZeichen, anfrageZeichen)
      }
      hinaus.end()
    })
    anfrage.on('error', () => hinaus.destroy())
    // Bricht der Client ab (Übertrag, harter Stopp), stirbt auch die Anfrage
    // an Ollama — sonst rechnet die Karte an einer Antwort weiter, die niemand
    // mehr abholt.
    antwort.on('close', () => {
      if (antwort.writableEnded) return
      laufend.delete(platz)
      hinaus.destroy()
    })

    hinaus.on('error', (fehler) => {
      laufend.delete(platz)
      gesamt.fehler++
      if (antwort.headersSent) {
        antwort.destroy()
        return
      }
      // Ehrlicher Fehlertext statt stiller Stille: Die CLI zeigt ihn an, und
      // der Klartext-Übersetzer im Motor bekommt etwas zu übersetzen.
      const rumpf = JSON.stringify({
        type: 'error',
        error: { type: 'api_error', message: 'FlowForge-Zählstelle: ' + String(fehler?.message ?? fehler) }
      })
      antwort.writeHead(502, { 'content-type': 'application/json' })
      antwort.end(rumpf)
    })
  })

  const gebunden = await new Promise((fertig) => {
    server.once('error', (fehler) => fertig({ ok: false, fehler: String(fehler?.message ?? fehler) }))
    // NUR 127.0.0.1 und Port 0: keine Erreichbarkeit von außen, keine feste
    // Nummer, die belegt sein könnte.
    server.listen(0, '127.0.0.1', () => fertig({ ok: true }))
  })
  if (!gebunden.ok) {
    try {
      server.close()
    } catch {
      // Ein Server, der nicht binden konnte, muss auch nicht schließen.
    }
    pool.destroy()
    return { ok: false, fehler: gebunden.fehler }
  }

  const port = server.address()?.port
  if (!port) {
    server.close()
    pool.destroy()
    return { ok: false, fehler: 'kein Port' }
  }

  let offen = true
  return {
    ok: true,
    art,
    name,
    ziel: String(ziel),
    adresse: `http://127.0.0.1:${port}`,
    // Schnitt je Block: Der Motor ruft das beim Blockbeginn — danach gehören
    // Spitze und Laufzeit diesem Block.
    blockBeginnt() {
      fenster = neuesFenster()
    },
    stand() {
      // Zwischenstände der GERADE laufenden Anfragen dazurechnen. Die Zahlen
      // im Antwortstrom sind kumulierte Stände EINER Antwort — der aktuelle
      // Stand einer laufenden Antwort ist also genau das, was sie bis jetzt
      // gekostet hat, und darf zur Summe der fertigen addiert werden. Ohne das
      // stünde die Werkstatt minutenlang auf Null, während Ollama arbeitet
      // (gemessen im Probelauf am 23.08.2026).
      let laufendHinein = 0
      let laufendHeraus = 0
      for (const platz of laufend) {
        const s = platz.holeStrom()?.stand()
        if (!s) continue
        laufendHinein += s.hinein ?? 0
        laufendHeraus += s.heraus ?? 0
      }
      return {
        art,
        name,
        ziel: String(ziel),
        offen,
        // Offene Anfragen gehören sichtbar dazu: „arbeitet gerade" ist eine
        // Aussage, „0 Gesprächswechsel" wäre eine falsche.
        offeneAnfragen: laufend.size,
        anfragen: gesamt.anfragen,
        tokenHinein: gesamt.tokenHinein + laufendHinein,
        tokenHeraus: gesamt.tokenHeraus + laufendHeraus,
        anfrageBytes: gesamt.anfrageBytes,
        antwortBytes: gesamt.antwortBytes,
        nichtZaehlbar: gesamt.nichtZaehlbar,
        fehler: gesamt.fehler,
        ersteKachelMs: letzteErsteKachelMs,
        block: {
          beginn: fenster.beginn,
          dauerMs: Date.now() - fenster.beginn,
          anfragen: fenster.anfragen,
          offeneAnfragen: laufend.size,
          tokenHinein: fenster.tokenHinein + laufendHinein,
          tokenHeraus: fenster.tokenHeraus + laufendHeraus,
          letzteAnfrageZeichen: fenster.letzteAnfrageZeichen,
          groessteAnfrageZeichen: fenster.groessteAnfrageZeichen,
          letzteAntwortZeit: fenster.letzteAntwortZeit
        }
      }
    },
    schliessen() {
      if (!offen) return
      offen = false
      try {
        server.closeAllConnections?.()
        server.close()
      } catch {
        // Ein Messgerät, das beim Abbauen klemmt, darf keinen Lauf aufhalten.
      }
      pool.destroy()
    }
  }
}
