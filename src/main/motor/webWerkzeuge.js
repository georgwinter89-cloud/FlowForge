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

// Ticker-Zeile zum Ausgang einer Suche — je Fehlerart eine eigene, damit
// „Quelle sperrt gerade" nie wie „nichts gefunden" aussieht (genau das Raten
// soll dieser Schritt abschaffen).
function sucheFehlerZeile(fehlerArt) {
  if (fehlerArt === 'gesperrt') return texte.ticker.websucheGesperrt
  if (fehlerArt === 'unverstanden') return texte.ticker.websucheUnverstanden
  return texte.ticker.websucheNichtErreichbar
}

function seiteFehlerZeile(fehlerArt, adresse) {
  if (fehlerArt === 'abgelehnt') return texte.ticker.webseiteAbgelehnt(adresse)
  if (fehlerArt === 'keineTextseite') return texte.ticker.webseiteKeineTextseite(adresse)
  if (fehlerArt === 'zeitlimit') return texte.ticker.webseiteZeitlimit(adresse)
  return texte.ticker.webseiteNichtErreichbar(adresse)
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
      aufEreignis({
        art: 'ticker',
        text: texte.ticker.websucheTreffer(
          ergebnis.treffer.length,
          quelleName(ergebnis.quelle, searxngAdresse)
        )
      })
      return {
        content: [{ type: 'text', text: ausweichHinweis + w.treffer(ergebnis.treffer) }]
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
          text: seiteFehlerZeile(ergebnis.fehlerArt, ergebnis.adresse || ziel)
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
