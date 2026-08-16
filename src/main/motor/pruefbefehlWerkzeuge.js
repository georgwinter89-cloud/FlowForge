// Prüfbefehl-Werkzeug (SPEC §4.3, BAUPLAN 35): Der Prüfer hinterlegt hierüber
// den Startbefehl seiner Prüfmappe — Pflicht-Artefakt wie die Startanleitung
// beim Bauer. FlowForge spielt ihn in Reparatur-Runden selbst ab (Tor ohne KI).
// Harte Validierung im FlowForge-Prozess: Der Befehl läuft später OHNE
// Rechte-Rückfrage, deshalb liegt er an kurzer Leine (ein Test-Werkzeug, keine
// Verkettung). Die Datei pruefbefehl.json selbst ist für den Agenten gesperrt.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { pruefbefehlSetzen } from '../pruefbefehl.js'

// holeInstanz (BAUPLAN 41): Der Befehl gehört der Prüf-Instanz, die ihn setzt —
// nicht dem Projekt. Der Motor reicht die Kennung des gerade laufenden Blocks
// herein; ohne sie bestünde ein zweiter Prüfer seine Pflicht, weil der erste
// gesetzt hat, und das Tor urteilte über einen fremden Zweig.
export async function pruefbefehlWerkzeugServer({ projektPfad, aufEreignis, holeInstanz = null }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')

  const setzen = tool(
    'pruefbefehl_setzen',
    texte.agentenPruefbefehl.werkzeugBeschreibung,
    {
      befehl: z.string().describe(texte.agentenPruefbefehl.befehlParam)
    },
    async ({ befehl }) => {
      const ergebnis = pruefbefehlSetzen(projektPfad, holeInstanz?.() ?? null, befehl)
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: texte.ticker.pruefbefehlAbgelehnt(ergebnis.fehler) })
        return { content: [{ type: 'text', text: ergebnis.fehler }], isError: true }
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.pruefbefehlGesetzt(ergebnis.befehl) })
      return {
        content: [{ type: 'text', text: texte.agentenPruefbefehl.gesetzt(ergebnis.befehl) }]
      }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'pruefbefehl',
    version: '1.0.0',
    instructions: texte.agentenPruefbefehl.anweisungen,
    tools: [setzen]
  })
}
