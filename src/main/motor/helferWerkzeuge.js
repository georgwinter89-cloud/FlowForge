// Lokale Helfer-KI als Agenten-Werkzeug (Experiment, Wunsch Georg 13.08.2026):
// Block-Agenten delegieren reine Recherche-Aufträge an die lokale KI (Ollama)
// statt an eine Motor-Unteraufgabe — kostet kein Abo-Kontingent. Das Werkzeug
// ist rein lesend (die lokale KI kann nur auflisten, lesen, suchen — hart im
// Code begrenzt) und deshalb auch unter der Sperre „darf nur lesen" erlaubt.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { lokalRecherchieren } from './lokaleHelfer.js'

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

  return createSdkMcpServer({
    name: 'helfer',
    version: '1.0.0',
    instructions: texte.agentenLokaleHelfer.serverHinweis,
    tools: [recherchieren]
  })
}
