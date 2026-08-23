// Prüfungen zur Zählstelle (Bauschritt 54) — die Werkstatt misst die lokale KI.
//
// Rot vor Grün: Vor diesem Schritt gab es keine Zählstelle, keinen
// zaehlRegeln-Baustein und keine einzige Stelle, an der FlowForge den Verkehr
// zur lokalen KI zu Gesicht bekam. Der Füllstand eines lokalen Blocks war
// ausschließlich geschätzt (0.51.1), und wie gut die Schätzung ist, war nicht
// gemessen.
//
// Die Pflicht-Prüfung des Bauplans steht ganz unten: Ein großer Antwortstrom
// geht durch, und die zusätzliche Verzögerung wird gemessen und festgenagelt.
// Der Grund ist gemessen und steht im Bauplan: 0.51.2 hat ein schlecht gebautes
// Textfilter den ganzen Hauptprozess 232 Sekunden stillgelegt (1 MB Eingabe).
// Dieselbe Bauart in einer Zählstelle hieße: Kein lokaler Block redet mehr mit
// Ollama.
import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import {
  ZAEHL_PFADE,
  fuellstandVergleich,
  pfadOhneAbfrage,
  pfadZaehlt,
  prozentGanz,
  tokenJeSekunde,
  usageAusZeile
} from '../src/shared/zaehlRegeln.js'
import {
  VERBINDUNGS_KOPFZEILEN,
  ZEILEN_DECKEL,
  anfragePfad,
  antwortZaehlbar,
  kopfzeilenWeiterreichen,
  tokenStrom,
  zaehlstelleStarten
} from '../src/main/motor/zaehlstelle.js'
import { ZEICHEN_JE_TOKEN } from '../src/shared/lokalRegeln.js'

// Alles, was eine Prüfung geöffnet hat, wird wieder geschlossen — ein
// liegengebliebener Server hielte den vitest-Prozess offen.
const aufraeumen = []
afterEach(async () => {
  while (aufraeumen.length) {
    const weg = aufraeumen.pop()
    try {
      await weg()
    } catch {
      // Beim Abräumen wird nichts mehr rot.
    }
  }
})

// Ein Stub-Ollama: nimmt entgegen, was kommt, und antwortet nach Bauplan.
function stubStarten(behandeln) {
  return new Promise((fertig) => {
    const server = http.createServer(behandeln)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      aufraeumen.push(
        () =>
          new Promise((zu) => {
            server.closeAllConnections?.()
            server.close(zu)
          })
      )
      fertig({ adresse: `http://127.0.0.1:${port}`, server })
    })
  })
}

async function stelleStarten(ziel, extra = {}) {
  const stelle = await zaehlstelleStarten({ ziel, ...extra })
  if (stelle.ok) aufraeumen.push(() => stelle.schliessen())
  return stelle
}

// Eine Anfrage über den einfachsten Weg — bewusst node:http statt fetch, damit
// die Prüfung dieselbe Schicht fährt wie die Zählstelle selbst.
function anfragen(adresse, pfad, { methode = 'POST', rumpf = '', kopf = {} } = {}) {
  return new Promise((fertig, scheitern) => {
    const url = new URL(pfad, adresse)
    const anfrage = http.request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: methode,
        headers: { 'content-type': 'application/json', ...kopf }
      },
      (antwort) => {
        let text = ''
        let bytes = 0
        const kacheln = []
        antwort.on('data', (s) => {
          bytes += s.length
          text += s.toString('utf8')
          kacheln.push(Date.now())
        })
        antwort.on('end', () => fertig({ status: antwort.statusCode, text, bytes, kacheln, kopf: antwort.headers }))
      }
    )
    anfrage.on('error', scheitern)
    if (rumpf) anfrage.write(rumpf)
    anfrage.end()
  })
}

describe('Bauschritt 54 · was die Zählstelle als Gesprächswechsel zählt', () => {
  it('zählt genau die zwei Schnittstellen, über die wirklich geredet wird', () => {
    expect(ZAEHL_PFADE).toEqual(['/v1/messages', '/api/chat'])
    expect(pfadZaehlt('/v1/messages')).toBe(true)
    expect(pfadZaehlt('/api/chat')).toBe(true)
  })

  it('zählt count_tokens NICHT — dieselbe Unterhaltung, aber kein Turn', () => {
    // Die Anfrage trägt denselben Gesprächsverlauf und überschriebe den
    // gemessenen Füllstand mit etwas, das gar keine Antwort erzeugt.
    expect(pfadZaehlt('/v1/messages/count_tokens')).toBe(false)
  })

  it('zählt Zustandsfragen nicht mit (die Werkstatt fragt sie selbst ab)', () => {
    expect(pfadZaehlt('/api/tags')).toBe(false)
    expect(pfadZaehlt('/api/ps')).toBe(false)
    expect(pfadZaehlt('/api/create')).toBe(false)
  })

  it('lässt sich von einer Abfrage nicht abschütteln', () => {
    expect(pfadOhneAbfrage('/v1/messages?beta=true')).toBe('/v1/messages')
    expect(pfadZaehlt('/v1/messages?beta=true')).toBe(true)
  })
})

describe('Bauschritt 54 · nur das EINE zugeteilte Ziel', () => {
  it('schneidet aus einer absoluten Anfragezeile alles außer Pfad und Abfrage heraus', () => {
    // Ein Client darf „POST http://fremd/v1/messages HTTP/1.1" schicken. Ohne
    // diese Regel stünde in der Weiterleitung eine fremde Adresse — genau das,
    // was „kein frei wählbares Ziel" ausschließt.
    expect(anfragePfad('http://fremder-rechner:1234/v1/messages?x=1')).toBe('/v1/messages?x=1')
    expect(anfragePfad('/v1/messages')).toBe('/v1/messages')
    expect(anfragePfad('')).toBe('/')
    expect(anfragePfad('kein-pfad-und-keine-adresse')).toBe('/')
  })

  it('reicht auch in echt nur an das eigene Ziel weiter', async () => {
    let gesehen = null
    const stub = await stubStarten((a, b) => {
      gesehen = { pfad: a.url, host: a.headers.host }
      b.writeHead(200, { 'content-type': 'application/json' })
      b.end('{}')
    })
    const stelle = await stelleStarten(stub.adresse)
    expect(stelle.ok).toBe(true)
    // Absolute Form von Hand — genau die Kante aus der Regel oben.
    await new Promise((fertig, scheitern) => {
      const url = new URL(stelle.adresse)
      const anfrage = http.request(
        { host: url.hostname, port: url.port, method: 'POST', path: 'http://fremder-rechner:9/v1/messages' },
        (antwort) => {
          antwort.resume()
          antwort.on('end', fertig)
        }
      )
      anfrage.on('error', scheitern)
      anfrage.end()
    })
    expect(gesehen.pfad).toBe('/v1/messages')
    // Der host-Kopf zeigt auf das echte Ziel, nicht auf die Zählstelle.
    expect(gesehen.host).toBe(new URL(stub.adresse).host)
  })
})

describe('Bauschritt 54 · Kopfzeilen', () => {
  it('lässt verbindungsbezogene Kopfzeilen nicht durch', () => {
    const raus = kopfzeilenWeiterreichen(
      { host: 'zaehlstelle', connection: 'keep-alive', 'transfer-encoding': 'chunked', 'x-api-key': 'ollama' },
      'ollama-rechner:11434'
    )
    for (const name of VERBINDUNGS_KOPFZEILEN) expect(raus[name]).toBeUndefined()
    expect(raus.host).toBe('ollama-rechner:11434')
    expect(raus['x-api-key']).toBe('ollama')
  })

  it('bittet ausdrücklich um ungepackte Antworten — sonst wäre nichts zu zählen', () => {
    const raus = kopfzeilenWeiterreichen({ 'accept-encoding': 'gzip, deflate' }, 'x:1')
    expect(raus['accept-encoding']).toBe('identity')
  })

  it('erkennt eine trotzdem gepackte Antwort als nicht zählbar', () => {
    expect(antwortZaehlbar({})).toBe(true)
    expect(antwortZaehlbar({ 'content-encoding': 'identity' })).toBe(true)
    expect(antwortZaehlbar({ 'content-encoding': 'gzip' })).toBe(false)
  })
})

describe('Bauschritt 54 · Tokens aus einer Zeile', () => {
  it('liest den Anthropic-Ereignisstrom', () => {
    const start =
      'data: {"type":"message_start","message":{"usage":{"input_tokens":23500,"cache_read_input_tokens":0,"output_tokens":1}}}'
    expect(usageAusZeile(start)).toEqual({ hinein: 23500, heraus: 1 })
    const delta = 'data: {"type":"message_delta","usage":{"output_tokens":812}}'
    expect(usageAusZeile(delta)).toEqual({ hinein: null, heraus: 812 })
  })

  it('liest Ollamas eigenen Dialekt (die Helfer-KI spricht ihn)', () => {
    const zeile = '{"model":"x","done":true,"prompt_eval_count":1200,"eval_count":340}'
    expect(usageAusZeile(zeile)).toEqual({ hinein: 1200, heraus: 340 })
  })

  it('liefert null für alles, was keine Zählzahlen trägt', () => {
    expect(usageAusZeile('event: content_block_delta')).toBeNull()
    expect(usageAusZeile('data: {"type":"ping"}')).toBeNull()
    expect(usageAusZeile('data: kein json')).toBeNull()
    expect(usageAusZeile('')).toBeNull()
    expect(usageAusZeile(null)).toBeNull()
  })
})

describe('Bauschritt 54 · der Strom-Zähler sammelt nichts', () => {
  it('findet die Zahlen auch, wenn sie mitten in einer Kachel zerschnitten sind', () => {
    const strom = tokenStrom()
    const text =
      'data: {"type":"message_start","message":{"usage":{"input_tokens":100}}}\n' +
      'data: {"type":"content_block_delta","delta":{"text":"Hallo"}}\n' +
      'data: {"type":"message_delta","usage":{"output_tokens":42}}\n'
    // Byte für Byte hereingeben — die härteste Zerschneidung, die es gibt.
    for (const byte of Buffer.from(text, 'utf8')) strom.schub(Buffer.from([byte]))
    strom.abschluss()
    expect(strom.stand()).toEqual({ hinein: 100, heraus: 42 })
  })

  it('nimmt die letzte Zeile auch ohne abschließenden Umbruch (Ollama liefert so)', () => {
    const strom = tokenStrom()
    strom.schub('{"prompt_eval_count":7,"eval_count":9}')
    expect(strom.stand()).toEqual({ hinein: null, heraus: null })
    strom.abschluss()
    expect(strom.stand()).toEqual({ hinein: 7, heraus: 9 })
  })

  it('verwirft eine überlange Zeile, statt sie zu sammeln — und zählt danach weiter', () => {
    const strom = tokenStrom()
    // Eine Zeile über dem Deckel: Sie darf NICHT im Speicher wachsen.
    strom.schub(Buffer.alloc(ZEILEN_DECKEL + 1000, 0x61))
    strom.schub('\n')
    strom.schub('data: {"type":"message_delta","usage":{"output_tokens":5}}\n')
    strom.abschluss()
    expect(strom.stand()).toEqual({ hinein: null, heraus: 5 })
  })

  it('nimmt bei mehreren Meldungen den zuletzt gemeldeten Stand (er ist kumuliert)', () => {
    const strom = tokenStrom()
    strom.schub('data: {"type":"message_delta","usage":{"output_tokens":10}}\n')
    strom.schub('data: {"type":"message_delta","usage":{"output_tokens":250}}\n')
    strom.abschluss()
    expect(strom.stand().heraus).toBe(250)
  })
})

describe('Bauschritt 54 · die Zählstelle im Betrieb', () => {
  it('bindet nur an 127.0.0.1 und nimmt den Port vom Betriebssystem', async () => {
    const stub = await stubStarten((_a, b) => b.end('{}'))
    const stelle = await stelleStarten(stub.adresse)
    expect(stelle.ok).toBe(true)
    expect(stelle.adresse).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    // Keine feste Nummer: zwei Zählstellen nebeneinander vertragen sich.
    const zweite = await stelleStarten(stub.adresse)
    expect(zweite.ok).toBe(true)
    expect(zweite.adresse).not.toBe(stelle.adresse)
  })

  it('reicht Anfrage und Antwort unverändert durch und zählt dabei mit', async () => {
    let empfangen = ''
    const stub = await stubStarten((a, b) => {
      a.on('data', (s) => (empfangen += s.toString('utf8')))
      a.on('end', () => {
        b.writeHead(200, { 'content-type': 'text/event-stream' })
        b.write('data: {"type":"message_start","message":{"usage":{"input_tokens":1234}}}\n\n')
        b.write('data: {"type":"content_block_delta","delta":{"text":"Grüße"}}\n\n')
        b.write('data: {"type":"message_delta","usage":{"output_tokens":77}}\n\n')
        b.end()
      })
    })
    const stelle = await stelleStarten(stub.adresse)
    const rumpf = JSON.stringify({ model: 'flowforge-qwen', messages: [{ role: 'user', content: 'Süßes Ölfaß' }] })
    const antwort = await anfragen(stelle.adresse, '/v1/messages', { rumpf })

    expect(empfangen).toBe(rumpf)
    expect(antwort.status).toBe(200)
    expect(antwort.text).toContain('Grüße')

    const stand = stelle.stand()
    expect(stand.anfragen).toBe(1)
    expect(stand.tokenHinein).toBe(1234)
    expect(stand.tokenHeraus).toBe(77)
    // Zeichen, nicht Bytes: „Süßes Ölfaß" hat Umlaute, und der Füllstands-
    // Vergleich rechnet in Zeichen (die Schätzung im Motor tut es auch).
    expect(stand.block.letzteAnfrageZeichen).toBe(rumpf.length)
    expect(stand.anfrageBytes).toBe(Buffer.byteLength(rumpf, 'utf8'))
    expect(stand.anfrageBytes).toBeGreaterThan(stand.block.letzteAnfrageZeichen)
  })

  it('reicht auch durch, was NICHT gezählt wird', async () => {
    const stub = await stubStarten((a, b) => {
      b.writeHead(200, { 'content-type': 'application/json' })
      b.end(JSON.stringify({ pfad: a.url, models: [] }))
    })
    const stelle = await stelleStarten(stub.adresse)
    const antwort = await anfragen(stelle.adresse, '/api/tags', { methode: 'GET' })
    expect(JSON.parse(antwort.text).pfad).toBe('/api/tags')
    expect(stelle.stand().anfragen).toBe(0)
  })

  it('gibt den Strom weiter, während er läuft — nicht erst am Ende', async () => {
    let weiter = null
    const stub = await stubStarten((_a, b) => {
      b.writeHead(200, { 'content-type': 'text/event-stream' })
      b.write('data: {"type":"content_block_delta","delta":{"text":"erste"}}\n\n')
      weiter = () => {
        b.write('data: {"type":"message_delta","usage":{"output_tokens":3}}\n\n')
        b.end()
      }
    })
    const stelle = await stelleStarten(stub.adresse)
    const url = new URL(stelle.adresse)
    const ersteKachel = await new Promise((fertig, scheitern) => {
      const anfrage = http.request(
        { host: url.hostname, port: url.port, method: 'POST', path: '/v1/messages' },
        (antwort) => {
          antwort.once('data', (s) => fertig(s.toString('utf8')))
          antwort.resume()
        }
      )
      anfrage.on('error', scheitern)
      anfrage.end('{}')
    })
    // Die erste Kachel ist da, obwohl der Stub die Antwort noch gar nicht
    // beendet hat: Es wird durchgereicht, nicht gesammelt.
    expect(ersteKachel).toContain('erste')
    weiter()
  })

  // Fund aus dem Probelauf am 23.08.2026 (mit echtem Ollama, echtem Motor):
  // Die Werkstatt stand 137 Sekunden auf „0 Gesprächswechsel, 0 Tokens",
  // während eine Verbindung zu Ollama nachweislich offen war. Gebucht wurde
  // alles erst am ENDE der Antwort — bei einem lokalen Block sind das Minuten.
  // Ausgerechnet der gemessene Füllstand fehlte dabei, obwohl er feststeht,
  // sobald die Anfrage draußen ist: Genau dafür gibt es die Zählstelle.
  describe('eine LAUFENDE Anfrage ist sichtbar, nicht erst die fertige', () => {
    it('kennt Anfrage-Zeichen und Zwischenstand, während Ollama noch arbeitet', async () => {
      let weiter = null
      const stub = await stubStarten((a, b) => {
        a.resume()
        a.on('end', () => {
          b.writeHead(200, { 'content-type': 'text/event-stream' })
          b.write('data: {"type":"message_start","message":{"usage":{"input_tokens":4321}}}\n\n')
          weiter = () => {
            b.write('data: {"type":"message_delta","usage":{"output_tokens":99}}\n\n')
            b.end()
          }
        })
      })
      const stelle = await stelleStarten(stub.adresse)
      const rumpf = JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(500) }] })
      const url = new URL(stelle.adresse)
      const laeuft = new Promise((fertig, scheitern) => {
        const anfrage = http.request(
          { host: url.hostname, port: url.port, method: 'POST', path: '/v1/messages' },
          (antwort) => {
            antwort.once('data', () => fertig())
            antwort.resume()
          }
        )
        anfrage.on('error', scheitern)
        anfrage.end(rumpf)
      })
      await laeuft

      const stand = stelle.stand()
      // Die Antwort läuft noch — trotzdem steht schon alles da, was feststeht.
      expect(stand.offeneAnfragen).toBe(1)
      expect(stand.anfragen).toBe(0)
      expect(stand.block.groessteAnfrageZeichen).toBe(rumpf.length)
      expect(stand.block.tokenHinein).toBe(4321)

      weiter()
      await new Promise((r) => setTimeout(r, 120))
      const fertig = stelle.stand()
      expect(fertig.offeneAnfragen).toBe(0)
      expect(fertig.anfragen).toBe(1)
      // Nach dem Ende genau EINMAL gezählt — kein Doppel aus Zwischenstand
      // plus Summe.
      expect(fertig.tokenHinein).toBe(4321)
      expect(fertig.tokenHeraus).toBe(99)
    })

    it('lässt eine abgebrochene Anfrage nicht als „läuft noch" hängen', async () => {
      const stub = await stubStarten((a, b) => {
        a.resume()
        a.on('end', () => {
          b.writeHead(200, { 'content-type': 'text/event-stream' })
          b.write('data: {"type":"message_start","message":{"usage":{"input_tokens":7}}}\n\n')
          // Absichtlich nie beenden — der Client bricht ab.
        })
      })
      const stelle = await stelleStarten(stub.adresse)
      const url = new URL(stelle.adresse)
      await new Promise((fertig, scheitern) => {
        const anfrage = http.request(
          { host: url.hostname, port: url.port, method: 'POST', path: '/v1/messages' },
          (antwort) => {
            antwort.once('data', () => {
              anfrage.destroy()
              fertig()
            })
            antwort.resume()
          }
        )
        anfrage.on('error', () => {})
        anfrage.end('{}')
      })
      await new Promise((r) => setTimeout(r, 200))
      expect(stelle.stand().offeneAnfragen).toBe(0)
    })
  })

  it('sagt ehrlich Nein, wenn die Ziel-Adresse unbrauchbar ist — statt sich ein Ziel auszudenken', async () => {
    expect((await zaehlstelleStarten({ ziel: '' })).ok).toBe(false)
    expect((await zaehlstelleStarten({ ziel: 'quatsch' })).ok).toBe(false)
    expect((await zaehlstelleStarten({ ziel: 'file:///etc/passwd' })).ok).toBe(false)
  })

  it('antwortet mit Klartext, wenn das Ziel gar nicht da ist — der Block bleibt nicht stumm', async () => {
    // Ein Ziel, das sicher niemand bedient: Port 1 auf dem eigenen Rechner.
    const stelle = await stelleStarten('http://127.0.0.1:1')
    const antwort = await anfragen(stelle.adresse, '/v1/messages', { rumpf: '{}' })
    expect(antwort.status).toBe(502)
    expect(antwort.text).toContain('FlowForge-Zählstelle')
    expect(stelle.stand().fehler).toBeGreaterThan(0)
  })

  it('schneidet die Block-Zahlen beim Blockbeginn ab, behält aber die Summe des Laufs', async () => {
    const stub = await stubStarten((a, b) => {
      a.resume()
      a.on('end', () => {
        b.writeHead(200, { 'content-type': 'text/event-stream' })
        b.end('data: {"type":"message_delta","usage":{"output_tokens":10}}\n\n')
      })
    })
    const stelle = await stelleStarten(stub.adresse)
    await anfragen(stelle.adresse, '/v1/messages', { rumpf: '{"a":1}' })
    expect(stelle.stand().block.tokenHeraus).toBe(10)
    stelle.blockBeginnt()
    expect(stelle.stand().block.tokenHeraus).toBe(0)
    expect(stelle.stand().block.groessteAnfrageZeichen).toBe(0)
    // Die Lauf-Summe bleibt — sie gehört der Zählstelle, nicht dem Block.
    expect(stelle.stand().tokenHeraus).toBe(10)
  })
})

describe('Bauschritt 54 · Pflicht-Messung: was die Zählstelle kostet', () => {
  // Der Bauplan verlangt sie ausdrücklich: „Ein großer Antwortstrom geht durch,
  // und die zusätzliche Verzögerung wird gemessen und festgenagelt."
  //
  // Zwei Größen, damit nicht nur ein Absolutwert festgenagelt ist, sondern die
  // FORM der Kurve: Achtmal so viel Strom darf nicht überproportional länger
  // dauern. Genau daran wäre 0.51.2 gescheitert (quadratisches Verhalten:
  // 1 MB = 232 s).
  const KACHEL = 'data: {"type":"content_block_delta","delta":{"text":"' + 'x'.repeat(200) + '"}}\n\n'

  function stromStub(kacheln) {
    return stubStarten((a, b) => {
      a.resume()
      a.on('end', () => {
        b.writeHead(200, { 'content-type': 'text/event-stream' })
        b.write('data: {"type":"message_start","message":{"usage":{"input_tokens":1000}}}\n\n')
        for (let i = 0; i < kacheln; i++) b.write(KACHEL)
        b.write('data: {"type":"message_delta","usage":{"output_tokens":' + kacheln + '}}\n\n')
        b.end()
      })
    })
  }

  async function messen(kacheln) {
    const stub = await stromStub(kacheln)
    const stelle = await stelleStarten(stub.adresse)
    // Je zweimal, die zweite Messung zählt: Die erste bezahlt den TCP-Aufbau.
    await anfragen(stub.adresse, '/v1/messages', { rumpf: '{}' })
    await anfragen(stelle.adresse, '/v1/messages', { rumpf: '{}' })

    const t0 = Date.now()
    const direkt = await anfragen(stub.adresse, '/v1/messages', { rumpf: '{}' })
    const direktMs = Date.now() - t0

    stelle.blockBeginnt()
    const t1 = Date.now()
    const durch = await anfragen(stelle.adresse, '/v1/messages', { rumpf: '{}' })
    const durchMs = Date.now() - t1

    expect(durch.bytes).toBe(direkt.bytes)
    expect(stelle.stand().block.tokenHeraus).toBe(kacheln)
    return { direktMs, durchMs, bytes: durch.bytes }
  }

  it('reicht einen großen Antwortstrom durch, ohne ihn zu sammeln', async () => {
    const klein = await messen(4_000)
    const gross = await messen(32_000)

    // Rund 1 MB und rund 8 MB — die Größenordnung des Befunds aus 0.51.2.
    expect(klein.bytes).toBeGreaterThan(900_000)
    expect(gross.bytes).toBeGreaterThan(7_000_000)

    // 1. Festgenagelt als Absolutwert: Der Aufschlag durch die Zählstelle
    //    bleibt bei 8 MB unter einer Sekunde. Großzügig gewählt, weil auf einer
    //    beliebig belasteten Maschine gemessen wird — eine Zählstelle, die
    //    sammelt oder zeichenweise sucht, liegt um Größenordnungen darüber.
    const aufschlag = gross.durchMs - gross.direktMs
    expect(aufschlag).toBeLessThan(1000)

    // 2. Festgenagelt als FORM: achtmal so viel Strom darf höchstens rund
    //    achtmal so lange dauern (24-fach als Luft für Messrauschen bei sehr
    //    kurzen Zeiten). Quadratisches Verhalten wie 0.51.2 wäre 64-fach.
    expect(gross.durchMs).toBeLessThan(Math.max(klein.durchMs, 20) * 24)
  }, 60_000)
})

describe('Bauschritt 54 · gemessen neben geschätzt', () => {
  it('rechnet beide Zahlen mit derselben Regel und nennt den Abstand', () => {
    // 350.000 Zeichen gingen wirklich hinaus, 140.000 hat FlowForge vermutet.
    const v = fuellstandVergleich(350_000, 140_000, 65_536)
    expect(v.gemessen).toBe(100_000)
    expect(v.geschaetzt).toBe(40_000)
    expect(v.abstand).toBe(60_000)
    expect(Math.round(v.abweichung * 100)).toBe(60)
    expect(ZEICHEN_JE_TOKEN).toBe(3.5)
  })

  it('nennt beide Füllstände in Prozent des Fensters — auch über 100', () => {
    const v = fuellstandVergleich(350_000, 140_000, 65_536)
    // Genau die Aussage, für die es die Zählstelle gibt: Was hinausging, passte
    // gar nicht mehr ins Fenster — Ollama hat still gekappt.
    expect(prozentGanz(v.gemessenProzent)).toBe(153)
    expect(prozentGanz(v.geschaetztProzent)).toBe(61)
  })

  it('erfindet keinen Vergleich, wenn nichts gemessen wurde', () => {
    expect(fuellstandVergleich(0, 140_000, 65_536)).toBeNull()
  })

  it('kommt ohne Fenster aus, statt eine Prozentzahl zu erfinden', () => {
    const v = fuellstandVergleich(35_000, 35_000, 0)
    expect(v.abstand).toBe(0)
    expect(v.gemessenProzent).toBeNull()
  })

  it('nennt Tokens je Sekunde als abgeleitete Zahl — und null statt einer erfundenen 0', () => {
    expect(tokenJeSekunde(100, 5000)).toBe(20)
    expect(tokenJeSekunde(0, 5000)).toBeNull()
    expect(tokenJeSekunde(100, 0)).toBeNull()
  })
})
