// Frage an den Menschen (BAUPLAN 9): Werkzeug, mit dem der Agent dem Nutzer
// mitten im Lauf eine Frage stellt — der Lauf pausiert, FlowForge zeigt die
// Frage im Gespräch an (plus Windows-Benachrichtigung) und reicht die Antwort
// als Werkzeug-Ergebnis zurück. Trägt Einzelfragen genauso wie das mehrrundige
// Spec-Interview.
import { z } from 'zod'
import { liste } from './werkzeugSchema.js'
import { texte } from '../../shared/texte.js'

// Baut den In-Prozess-Werkzeugkasten „mensch" für einen Motor-Lauf.
// aufMenschFrage({ frage, optionen }) kommt aus der Lauf-Verwaltung und löst
// mit dem Antwort-Text auf — oder mit null, wenn der Lauf angehalten wurde.
export async function menschWerkzeugServer({ aufMenschFrage }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')

  const fragen = tool(
    'mensch_fragen',
    'Stellt dem Nutzer eine Frage und wartet auf seine Antwort. Eine Frage pro Aufruf. ' +
      'Formuliere Folgen-Fragen in Alltagssprache (was bedeutet die Wahl für den Nutzer), ' +
      'keine Technik-Fragen — und sprich immer eine Empfehlung aus.',
    {
      frage: z
        .string()
        .describe('Die Frage an den Nutzer — Alltagssprache, Folgen statt Technik'),
      optionen: liste(z.string(), 4)
        .optional()
        .describe(
          '2 bis 4 kurze Antwort-Optionen, die Empfehlung zuerst und als solche benannt. ' +
            'Der Nutzer kann immer auch frei antworten.'
        )
    },
    async ({ frage, optionen }) => {
      const antwortText = await aufMenschFrage({ frage, optionen: optionen ?? [] })
      if (antwortText == null)
        return {
          content: [{ type: 'text', text: texte.agentenMensch.keineAntwort }],
          isError: true
        }
      return { content: [{ type: 'text', text: texte.agentenMensch.antwort(antwortText) }] }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'mensch',
    version: '1.0.0',
    instructions:
      'Mit mensch_fragen erreichst du den Nutzer dieses Projekts. Nutze es, wenn dein ' +
      'Arbeitsauftrag Fragen an den Menschen vorsieht — eine Frage pro Aufruf.',
    tools: [fragen]
  })
}
