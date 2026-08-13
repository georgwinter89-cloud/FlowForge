// Lokale Helfer-KI als Agenten-Werkzeug (Experiment, Wunsch Georg 13.08.2026):
// Block-Agenten delegieren reine Recherche-Aufträge an die lokale KI (Ollama)
// statt an eine Motor-Unteraufgabe — kostet kein Abo-Kontingent. Das Werkzeug
// ist rein lesend (die lokale KI kann nur auflisten, lesen, suchen — hart im
// Code begrenzt) und deshalb auch unter der Sperre „darf nur lesen" erlaubt.
//
// Lokale Entwürfe (BAUPLAN 21): Dazu kommen lokal_entwerfen (schablonenhafte
// Schreibarbeit mit Vorbild — der Entwurf landet ausschließlich in der
// arbeitsablage/) und entwurf_abnehmen (die ausdrückliche Abnahme-Meldung des
// Block-Agenten: übernommen oder verworfen — ungeprüft zählt nichts). Beide
// sind Schreibarbeit und unter „darf nur lesen" gesperrt (claudeCodeMotor).
//
// Lokaler Bauer (BAUPLAN 22): lokal_bauen delegiert einen eng umrissenen,
// einzeln prüfbaren Bau-Teilauftrag an die lokale KI — mit echtem Schreibrecht
// im Projektordner. FlowForge legt vor jedem Teilauftrag einen Sicherungspunkt
// an; die Abnahme meldet der Block-Agent mit teilstueck_abnehmen, und bei
// „nicht gehalten" rollt FlowForge den Stand zurück, BEVOR der Agent selbst
// baut (Mechanik aus Bauschritt 20 wiederverwendet). Die Reihenfolge ist
// erzwungen: erst abnehmen, dann das nächste Teilstück — sonst wäre der
// Rückroll-Punkt nicht mehr eindeutig.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { lokalBauen, lokalEntwerfen, lokalRecherchieren } from './lokaleHelfer.js'
import { sicherungspunktAnlegen, aufLetztenPunktZuruecksetzen } from '../sicherungspunkte.js'

export async function helferWerkzeugServer({ projektPfad, modell, adresse, aufEreignis }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')

  const recherchieren = tool(
    'lokal_recherchieren',
    texte.agentenLokaleHelfer.werkzeugBeschreibung,
    {
      auftrag: z
        .string()
        .describe(
          'Der Recherche-Auftrag in Alltagssprache: was gesucht/gelesen werden soll und welche Fragen das Fazit beantworten muss.'
        )
    },
    async ({ auftrag }) => {
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferStart(modell) })
      const ergebnis = await lokalRecherchieren({
        projektPfad,
        auftrag,
        modell,
        adresse,
        aufSchritt: (name) =>
          aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferSchritt(name) })
      })
      // Zähl-Ereignis für den Laufbericht (Wunsch Georg, 13.08.2026): So steht
      // der Anteil der lokalen KI schwarz auf weiß im Bericht.
      aufEreignis({
        art: 'lokale-helfer',
        schritte: ergebnis.schritte ?? 0,
        gescheitert: !ergebnis.ok
      })
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferGescheitert(ergebnis.fehler) })
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.gescheitert(ergebnis.fehler) }],
          isError: true
        }
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferFertig(ergebnis.schritte) })
      return {
        content: [{ type: 'text', text: texte.agentenLokaleHelfer.fazit(ergebnis.fazit) }]
      }
    },
    { alwaysLoad: true }
  )

  // Lokale Entwürfe (BAUPLAN 21): Entwurf lokal, Abnahme beim Block-Agenten.
  const entwerfen = tool(
    'lokal_entwerfen',
    texte.agentenLokaleHelfer.entwerfenBeschreibung,
    {
      auftrag: z
        .string()
        .describe(
          'Der Schreibauftrag in Alltagssprache: was der Entwurf leisten muss — und das Vorbild (Datei), an dem er sich orientieren soll.'
        )
    },
    async ({ auftrag }) => {
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfStart(modell) })
      const ergebnis = await lokalEntwerfen({
        projektPfad,
        auftrag,
        modell,
        adresse,
        aufSchritt: (name, eingabe) =>
          aufEreignis({
            art: 'ticker',
            text:
              name === 'entwurf_schreiben'
                ? texte.ticker.lokaleEntwurfSchritt(eingabe?.pfad)
                : texte.ticker.lokaleHelferSchritt(name)
          })
      })
      const dateien = ergebnis.dateien ?? []
      // Zähl-Ereignis für die Lokale-Helfer-Zeile des Laufberichts (BAUPLAN 21):
      // ein Entwurf zählt nur, wenn wirklich eine Entwurfsdatei entstand.
      aufEreignis({
        art: 'lokale-helfer-entwurf',
        schritte: ergebnis.schritte ?? 0,
        entwurf: ergebnis.ok && dateien.length > 0,
        gescheitert: !ergebnis.ok
      })
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfGescheitert(ergebnis.fehler) })
        return {
          content: [
            { type: 'text', text: texte.agentenLokaleHelfer.entwerfenGescheitert(ergebnis.fehler) }
          ],
          isError: true
        }
      }
      if (!dateien.length) {
        aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfKeineDatei })
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.entwurfKeineDatei }],
          isError: true
        }
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfFertig(dateien, ergebnis.schritte) })
      return {
        content: [
          { type: 'text', text: texte.agentenLokaleHelfer.entwurfFazit(ergebnis.fazit, dateien) }
        ]
      }
    },
    { alwaysLoad: true }
  )

  // Die ausdrückliche Abnahme (BAUPLAN 21): Der Block-Agent meldet je Entwurf,
  // ob er ihn übernommen oder verworfen hat — der Laufbericht zählt mit.
  const abnehmen = tool(
    'entwurf_abnehmen',
    texte.agentenLokaleHelfer.abnehmenBeschreibung,
    {
      entwurf: z
        .string()
        .describe('Die Entwurfsdatei in der arbeitsablage/, um die es geht.'),
      uebernommen: z
        .boolean()
        .describe('true = gegengelesen und selbst an den Zielort übernommen; false = verworfen.')
    },
    async ({ entwurf, uebernommen }) => {
      aufEreignis({ art: 'lokale-helfer-entwurf-urteil', uebernommen: Boolean(uebernommen) })
      aufEreignis({
        art: 'ticker',
        text: uebernommen
          ? texte.ticker.entwurfUebernommen(entwurf)
          : texte.ticker.entwurfVerworfen(entwurf)
      })
      return {
        content: [{ type: 'text', text: texte.agentenLokaleHelfer.abgenommen(entwurf, uebernommen) }]
      }
    },
    { alwaysLoad: true }
  )

  // Lokaler Bauer (BAUPLAN 22): das offene Teilstück dieses Motors — gesetzt
  // von lokal_bauen, aufgelöst von teilstueck_abnehmen. Solange es offen ist,
  // ist der neueste Sicherungspunkt garantiert „Stand vor lokalem Teilstück"
  // — nur darum darf die Abnahme mit dem letzten Punkt zurückrollen.
  let offenesTeilstueck = null

  const bauen = tool(
    'lokal_bauen',
    texte.agentenLokaleHelfer.bauenBeschreibung,
    {
      teilstueck: z
        .string()
        .describe('Kurzname des Teilstücks für Ticker und Abnahme, z.B. "2 von 5: Speichern-Knopf".'),
      auftrag: z
        .string()
        .describe(
          'Der Teilauftrag: Fundstellen oder Vorbild, feste Schnittstellen (welche Datei, welcher Funktionsname, was rein, was raus) und das Fertig-Kriterium.'
        )
    },
    async ({ teilstueck, auftrag }) => {
      if (offenesTeilstueck != null)
        return {
          content: [
            { type: 'text', text: texte.agentenLokaleHelfer.bauenErstAbnehmen(offenesTeilstueck) }
          ],
          isError: true
        }
      // Sicherungspunkt vor jedem Teilauftrag — ohne Rückroll-Punkt baut die
      // lokale KI nicht (dieselbe Regel wie bei der Vorreparatur).
      const punkt = await sicherungspunktAnlegen(
        projektPfad,
        texte.sicherungen.beschriftungVorLokalemTeilstueck
      )
      if (!punkt.ok)
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.bauenKeinSicherungspunkt }],
          isError: true
        }
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleBauenStart(teilstueck, modell) })
      const ergebnis = await lokalBauen({
        projektPfad,
        auftrag,
        modell,
        adresse,
        aufSchritt: (name, eingabe) =>
          aufEreignis({
            art: 'ticker',
            text:
              name === 'datei_schreiben'
                ? texte.ticker.lokaleBauenSchritt(eingabe?.pfad)
                : name === 'ersetzen'
                  ? texte.ticker.lokaleReparaturSchritt(eingabe?.pfad)
                  : texte.ticker.lokaleHelferSchritt(name)
          })
      })
      const aenderungen = (ergebnis.ersetzungen ?? 0) + (ergebnis.dateien?.length ?? 0)
      // Zähl-Ereignis für die Lokale-Helfer-Zeile des Laufberichts (BAUPLAN 22).
      aufEreignis({
        art: 'lokale-helfer-bauen',
        schritte: ergebnis.schritte ?? 0,
        gescheitert: !ergebnis.ok || aenderungen === 0
      })
      if (!ergebnis.ok || aenderungen === 0) {
        // Ein gescheiterter Versuch mit halben Änderungen wird sofort
        // zurückgerollt — der Agent baut auf sauberem Stand, nicht auf Gebastel.
        if (aenderungen > 0) {
          await aufLetztenPunktZuruecksetzen(projektPfad)
          aufEreignis({ art: 'ticker', text: texte.ticker.lokaleBauenZurueckgerollt })
        }
        aufEreignis({
          art: 'ticker',
          text: ergebnis.ok
            ? texte.ticker.lokaleBauenNichtsGebaut
            : texte.ticker.lokaleBauenGescheitert(ergebnis.fehler)
        })
        return {
          content: [
            {
              type: 'text',
              text: ergebnis.ok
                ? texte.agentenLokaleHelfer.bauenKeineAenderung
                : texte.agentenLokaleHelfer.bauenGescheitert(ergebnis.fehler)
            }
          ],
          isError: true
        }
      }
      offenesTeilstueck = teilstueck
      aufEreignis({
        art: 'ticker',
        text: texte.ticker.lokaleBauenFertig(aenderungen, ergebnis.schritte)
      })
      return {
        content: [
          {
            type: 'text',
            text: texte.agentenLokaleHelfer.bauenFazit(
              ergebnis.fazit,
              ergebnis.dateien ?? [],
              ergebnis.ersetzungen ?? 0
            )
          }
        ]
      }
    },
    { alwaysLoad: true }
  )

  // Die Abnahme je Teilstück (BAUPLAN 22): gehalten = der Agent hat
  // gegengelesen und übernimmt; nicht gehalten = FlowForge rollt den Stand
  // auf den Punkt vor dem Teilstück zurück, der Agent baut selbst.
  const teilstueckAbnehmen = tool(
    'teilstueck_abnehmen',
    texte.agentenLokaleHelfer.abnehmenTeilstueckBeschreibung,
    {
      teilstueck: z.string().describe('Das Teilstück aus dem lokal_bauen-Aufruf, um das es geht.'),
      gehalten: z
        .boolean()
        .describe('true = gegengelesen und übernommen; false = verworfen, der Stand wird zurückgerollt.')
    },
    async ({ teilstueck, gehalten }) => {
      if (offenesTeilstueck == null)
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.teilstueckOhneOffenes }]
        }
      offenesTeilstueck = null
      aufEreignis({ art: 'lokale-helfer-teilstueck-urteil', gehalten: Boolean(gehalten) })
      if (!gehalten) {
        await aufLetztenPunktZuruecksetzen(projektPfad)
        aufEreignis({ art: 'ticker', text: texte.ticker.teilstueckVerworfen(teilstueck) })
        return {
          content: [
            { type: 'text', text: texte.agentenLokaleHelfer.teilstueckVerworfenText(teilstueck) }
          ]
        }
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.teilstueckGehalten(teilstueck) })
      return {
        content: [
          { type: 'text', text: texte.agentenLokaleHelfer.teilstueckGehaltenText(teilstueck) }
        ]
      }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'helfer',
    version: '1.0.0',
    instructions: texte.agentenLokaleHelfer.serverHinweis,
    tools: [recherchieren, entwerfen, abnehmen, bauen, teilstueckAbnehmen]
  })
}
