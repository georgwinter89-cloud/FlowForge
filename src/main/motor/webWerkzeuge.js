// Websuche als Agenten-Werkzeug (Zwischenschritt 0.51.2): Zwei rein lesende
// Nachschlage-Werkzeuge — web_suche findet Adressen, webseite_lesen holt den
// Text einer Seite. Registriert wird dieser Werkzeugkasten AUSSCHLIESSLICH an
// der Motor-Instanz eines lokalen Blocks: Claude-Blöcke haben WebSearch und
// WebFetch der CLI, ein lokaler Motor (Ollama) hat dort nichts.
//
// Rein lesend im Code erzwungen (nicht per Bitte): Beide Wege gehen über
// websuche.js, das nur http/https kennt, Privat- und Schleifenadressen sperrt
// (Ausnahme: Georgs eigene SearXNG-Adresse), jeden Weiterleitungssprung neu
// prüft und den Rumpf hart deckelt. Deshalb laufen sie ohne Rückfrage und auch
// unter der Sperre „darf nur lesen" (Entscheidung Georg, 20.08.2026) — und
// deshalb steht JEDER Zugriff im Ticker.
//
// Schema so lose wie möglich (Fund 12, gemessen 20.08.2026): Das SDK wirft
// zod-Einschränkungen wie .url(), .min() oder .int() aus dem JSON-Schema
// heraus, prüft sie zur Laufzeit aber trotzdem — die Ablehnung kommt dann
// ENGLISCH („MCP error -32602: Input validation error"), der Werkzeugkörper
// läuft nie, und im Ticker steht nur „Nutzt Werkzeug: …". Also nur z.string(),
// kein Zahlenfeld; die Grenzen stehen als Prosa in der Beschreibung, und jede
// Prüfung passiert hier im Körper mit deutschem Klartext plus eigener
// Ticker-Zeile.
//
// Ticker, bewusst hybrid (Fund 8): Die AUFRUF-Zeile (wonach gesucht, welche
// Seite) kommt aus tickerZeilen im Motor. Das ERGEBNIS meldet dieser Server
// selbst — gemessen erreicht ein tool_result den Ticker NIE (tickerZeilen
// verwirft alles, was nicht type 'assistant' ist), die ehrliche Fehlzeile kann
// also nur von hier kommen. Je Anlass genau eine inhaltlich neue Zeile: nie
// eine Wiederholung der Aufruf-Zeile, aber sehr wohl eine eigene Zeile für das
// Ausweichen auf die eingebaute Quelle — das ist eine eigene Tatsache, und
// Georgs Entscheidung vom 20.08.2026 lautet ausdrücklich „kein stiller
// Wechsel".
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { WEB_DECKEL, websucheDurchfuehren, webseiteLesen } from './websuche.js'

const w = texte.agentenWebsuche

// Wie viel Platz hat der laufende lokale Block noch, bis der Lokal-Wächter
// übergibt? (Fund 17.) holeLuft liefert die verbleibenden ZEICHEN oder null,
// wenn es niemand weiß (Claude-Motor, kein laufender Block). Ein klemmender
// Getter darf den Abruf nicht verhindern — dann gilt eben der Standard-Deckel.
function luftJetzt(holeLuft) {
  try {
    const roh = holeLuft?.()
    return Number.isFinite(roh) ? Number(roh) : null
  } catch {
    return null
  }
}

// Kurzer Name der genutzten Quelle für die Ticker-Zeile.
function quelleName(quelle, searxngAdresse) {
  return quelle === 'searxng'
    ? texte.ticker.websucheQuelleEigene(searxngAdresse)
    : texte.ticker.websucheQuelleEingebaut
}

// Der Rahmen um die Trefferliste (Fremdtext-Hinweis + „Zum Weiterlesen …")
// kostet konstant so viele Zeichen — gemessen 21.08.2026: 148. Wer weniger
// Restluft hat als diesen Rahmen, kann selbst mit null Treffern nichts mehr
// aufnehmen; dann wird gar nicht erst gefragt.
const TREFFER_RAHMEN = w.treffer([]).length

// Trefferliste an der Restluft des Lokal-Wächters deckeln (Nacharbeit Befund
// 12). Gemessen wird am FERTIGEN Text (Rahmen inbegriffen), nicht an einer
// Schätzung — nur der fertige Text landet im Arbeitsgedächtnis.
//
// Reihenfolge mit Absicht: ERST Treffer weglassen, und zwar von hinten. Ein
// Treffer ist die kleinste brauchbare Einheit — Titel, Adresse, Kurztext
// gehören zusammen, und eine halbe Adresse ist für webseite_lesen wertlos
// (denselben Grund nennt trefferBauen in websuche.js für Übergrößen-Adressen).
// Der letzte Treffer ist der schwächste, beide Quellen liefern nach Relevanz
// sortiert. ERST wenn nicht einmal der erste Treffer passt, wird sein Kurztext
// gekürzt: Titel und Adresse bleiben dann ganz, sonst bliebe ein Treffer
// übrig, mit dem der Block nichts anfangen kann.
function trefferAnLuft(treffer, platz) {
  if (platz === null || w.treffer(treffer).length <= platz)
    return { liste: treffer, gedeckelt: false }
  for (let anzahl = treffer.length - 1; anzahl >= 1; anzahl--) {
    const liste = treffer.slice(0, anzahl)
    if (w.treffer(liste).length <= platz) return { liste, gedeckelt: true }
  }
  const erster = treffer[0]
  const rest = platz - w.treffer([{ ...erster, kurztext: '' }]).length
  if (rest <= 0) return { liste: [], gedeckelt: true }
  return { liste: [{ ...erster, kurztext: erster.kurztext.slice(0, rest) }], gedeckelt: true }
}

// Ticker-Zeile zum Ausgang einer Suche — je Fehlerart eine eigene, damit
// „Quelle sperrt gerade" nie wie „nichts gefunden" aussieht (genau das Raten
// soll dieser Schritt abschaffen).
function sucheFehlerZeile(fehlerArt) {
  if (fehlerArt === 'gesperrt') return texte.ticker.websucheGesperrt
  if (fehlerArt === 'unverstanden') return texte.ticker.websucheUnverstanden
  return texte.ticker.websucheNichtErreichbar
}

// Ticker-Zeile zum Ausgang eines Seitenabrufs. Der KURZE Grund und der
// HTTP-Code kommen aus dem Rückgabeobjekt von webseiteLesen — hier wird nichts
// mehr erfunden (Nacharbeit Befund 1): Bei einer Weiterleitungsschleife auf
// httpbin.org stand im Ticker gemessen „nicht dieser Rechner und nicht das
// eigene Netz", während der Agent daneben „zu viele Weiterleitungen
// hintereinander" las — und über lauf.js landete die falsche Zeile dauerhaft
// im Laufbericht. Ticker-Zeile und Werkzeug-Text tragen jetzt denselben Grund.
//
// statusFehler und leereSeite sind eigene Ausgänge (Nacharbeit Befund 10):
// Beide fielen bis hierher in den Rückfall „Nicht erreichbar" — erreichbar war
// die Seite aber gerade, sie hat nur eine Fehlerseite oder gar keinen Text
// geliefert.
function seiteFehlerZeile(fehlerArt, adresse, grund = '', status = 0) {
  if (fehlerArt === 'abgelehnt') return texte.ticker.webseiteAbgelehnt(adresse, grund)
  if (fehlerArt === 'keineTextseite') return texte.ticker.webseiteKeineTextseite(adresse)
  if (fehlerArt === 'zeitlimit') return texte.ticker.webseiteZeitlimit(adresse)
  if (fehlerArt === 'statusFehler')
    return status === 429
      ? texte.ticker.webseiteGedrosselt(adresse, status)
      : texte.ticker.webseiteStatusFehler(adresse, status)
  if (fehlerArt === 'leereSeite') return texte.ticker.webseiteLeer(adresse)
  return texte.ticker.webseiteNichtErreichbar(adresse, grund)
}

// searxngAdresse: leer = eingebaute Quelle (Entscheidung Georg: kein eigenes
// Quellen-Wahlfeld, das durch die Einstellungs-Siebe verlorengehen kann).
// holeLuft: Getter auf die Restluft des GERADE laufenden Blocks — je Aufruf
// frisch abgelesen, wie holeSicherung/holeDateiListe beim Helfer-Server.
export async function webWerkzeugServer({ searxngAdresse = '', aufEreignis, holeLuft = null }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')

  const suchen = tool(
    'web_suche',
    w.sucheBeschreibung,
    {
      begriff: z.string().describe(w.begriffParam)
    },
    async ({ begriff }) => {
      const gesucht = String(begriff ?? '').trim()
      // Leeres Feld im Körper abfangen, nicht per Schema (Fund 12): So steht
      // die Abweisung auf Deutsch im Werkzeug-Ergebnis UND im Ticker.
      if (!gesucht) {
        aufEreignis({ art: 'ticker', text: texte.ticker.websucheOhneBegriff })
        return { content: [{ type: 'text', text: w.begriffFehlt }], isError: true }
      }
      // Platz im Arbeitsgedächtnis — dieselbe Bremse wie bei webseite_lesen
      // (Nacharbeit Befund 12). Bis dahin kannte nur der Lesepfad den
      // Lokal-Wächter: Bei aufgebrauchter Übertragsgrenze durfte der Block
      // keine Seite mehr lesen, suchte aber munter weiter und schob je Aufruf
      // 400-600 Token nach (gemessen: 10 Suchen = 7.146 Token in 0,1 s, Faktor
      // 24 gegenüber demselben Lauf mit webseite_lesen). Geprüft wird VOR dem
      // Netzabruf: Eine Suche, die ohnehin nicht mehr ankommt, soll die Quelle
      // nicht belasten — die eingebaute sperrt bei Häufung. Die Schwelle ist
      // deshalb nicht 0, sondern der konstante Rahmen um die Trefferliste:
      // Darunter passt selbst eine leere Liste nicht mehr hinein.
      const luft = luftJetzt(holeLuft)
      if (luft !== null && luft <= TREFFER_RAHMEN) {
        aufEreignis({ art: 'ticker', text: texte.ticker.websucheKeinPlatz })
        return { content: [{ type: 'text', text: w.keinPlatzMehr }], isError: true }
      }
      const ergebnis = await websucheDurchfuehren({
        suchbegriff: gesucht,
        searxngAdresse
      })
      // Ausweichen ist eine eigene Tatsache und bekommt eine eigene Zeile —
      // sonst wäre der Wechsel still (Entscheidung Georg, 20.08.2026).
      const ausweichHinweis = ergebnis.ausgewichen
        ? w.ausgewichen(ergebnis.ausweichGrund) + '\n\n'
        : ''
      if (ergebnis.ausgewichen)
        aufEreignis({ art: 'ticker', text: texte.ticker.websucheAusgewichen })
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: sucheFehlerZeile(ergebnis.fehlerArt) })
        return {
          content: [{ type: 'text', text: ausweichHinweis + ergebnis.fehlertext }],
          isError: true
        }
      }
      // ok mit leerer Liste ist ein ECHTES Nullergebnis — die Quelle hat
      // verstanden geantwortet und kennt nichts dazu.
      if (!ergebnis.treffer.length) {
        aufEreignis({ art: 'ticker', text: texte.ticker.websucheNichts(gesucht) })
        return { content: [{ type: 'text', text: ausweichHinweis + w.keineTreffer(gesucht) }] }
      }
      // Der Ausweich-Hinweis ist eine Tatsache und bleibt — er zählt deshalb
      // gegen die Restluft, statt sie zu überziehen.
      const platz = luft === null ? null : luft - ausweichHinweis.length
      const { liste, gedeckelt } = trefferAnLuft(ergebnis.treffer, platz)
      if (!liste.length) {
        aufEreignis({ art: 'ticker', text: texte.ticker.websucheKeinPlatz })
        return {
          content: [{ type: 'text', text: ausweichHinweis + w.keinPlatzMehr }],
          isError: true
        }
      }
      aufEreignis({
        art: 'ticker',
        text: gedeckelt
          ? texte.ticker.websucheTrefferGedeckelt(
              liste.length,
              quelleName(ergebnis.quelle, searxngAdresse)
            )
          : texte.ticker.websucheTreffer(
              liste.length,
              quelleName(ergebnis.quelle, searxngAdresse)
            )
      })
      return {
        content: [{ type: 'text', text: ausweichHinweis + w.treffer(liste) }]
      }
    },
    { alwaysLoad: true }
  )

  const lesen = tool(
    'webseite_lesen',
    w.seiteBeschreibung,
    {
      adresse: z.string().describe(w.adresseParam)
    },
    async ({ adresse }) => {
      const ziel = String(adresse ?? '').trim()
      if (!ziel) {
        aufEreignis({ art: 'ticker', text: texte.ticker.webseiteOhneAdresse })
        return { content: [{ type: 'text', text: w.adresseFehlt }], isError: true }
      }
      // Platz im Arbeitsgedächtnis (Fund 17): Ist die Übertragsgrenze des
      // Laufs aufgebraucht, zählt der Wächter zwar weiter, bremst aber nicht
      // mehr — ein voller Seitentext kippt den Block dann ins stille Kappen
      // von Ollama. Deshalb deckelt das Werkzeug seinen eigenen Wunsch an der
      // verbleibenden Luft, und ohne Luft gibt es Klartext statt Seitentext.
      const luft = luftJetzt(holeLuft)
      if (luft !== null && luft <= 0) {
        aufEreignis({ art: 'ticker', text: texte.ticker.webseiteKeinPlatz })
        return { content: [{ type: 'text', text: w.keinPlatzMehr }], isError: true }
      }
      const deckel = luft === null ? WEB_DECKEL.seiteZeichen : Math.min(WEB_DECKEL.seiteZeichen, luft)
      const ergebnis = await webseiteLesen({
        adresse: ziel,
        zeichenDeckel: deckel,
        searxngAdresse
      })
      // Immer die ENDADRESSE nach allen Weiterleitungen (Fund 7) — der Ticker
      // soll nicht die harmlose Startadresse zeigen, während in Wahrheit eine
      // andere Seite im Arbeitsgedächtnis landet.
      if (!ergebnis.ok) {
        aufEreignis({
          art: 'ticker',
          text: seiteFehlerZeile(
            ergebnis.fehlerArt,
            ergebnis.adresse || ziel,
            ergebnis.grund,
            ergebnis.status
          )
        })
        return { content: [{ type: 'text', text: ergebnis.fehlertext }], isError: true }
      }
      aufEreignis({
        art: 'ticker',
        text: ergebnis.gekuerzt
          ? texte.ticker.webseiteGekuerzt(ergebnis.adresse, ergebnis.zeichen)
          : texte.ticker.webseiteGelesen(ergebnis.adresse, ergebnis.zeichen)
      })
      return {
        content: [
          {
            type: 'text',
            // Der Fremdtext-Rahmen steckt in seitentext (Fund 6). Der
            // Seitentitel wird beim Entkernen mit dem Rahmen entfernt und
            // gehört deshalb hier wieder davor — er ist oft die einzige
            // Auskunft darüber, was für eine Seite das überhaupt ist.
            text: w.seitentext(
              ergebnis.adresse,
              (ergebnis.titel ? ergebnis.titel + '\n\n' : '') + ergebnis.text,
              ergebnis.gekuerzt
            )
          }
        ]
      }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'web',
    version: '1.0.0',
    // Gemessen 20.08.2026: Dieser Hinweistext steht NUR in der
    // Koordinator-Anfrage, nie beim Block-Agenten — er kostet den lokalen
    // Block also nichts und darf niemals in den Block-Systemtext kopiert
    // werden (das bürdete ihm ~88 Token neu auf).
    instructions: w.anweisungen,
    tools: [suchen, lesen]
  })
}
