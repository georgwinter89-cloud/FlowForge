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
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { lokalEntwerfen, lokalRecherchieren } from './lokaleHelfer.js'

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

  return createSdkMcpServer({
    name: 'helfer',
    version: '1.0.0',
    instructions: texte.agentenLokaleHelfer.serverHinweis,
    tools: [recherchieren, entwerfen, abnehmen]
  })
}
