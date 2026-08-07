// Startanleitungs-Werkzeug (SPEC §8, BAUPLAN 10): Der Agent legt die
// Startanleitung des Projekts ausschließlich hierüber fest — mit harter
// Validierung im FlowForge-Prozess, wie bei den Karten-Werkzeugen. Die Datei
// startanleitung.json selbst ist für direkte Schreibzugriffe gesperrt.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { startanleitungSetzen } from '../startanleitung.js'

export async function startWerkzeugServer({ projektPfad, aufEreignis }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')

  const setzen = tool(
    'startanleitung_setzen',
    'Legt die Startanleitung des Projekts fest oder ersetzt sie — die maschinenlesbare ' +
      'Anleitung, mit der FlowForge die gebaute App über den „App starten"-Knopf startet. ' +
      'Pflicht-Artefakt jedes Bau-Auftrags. Mindestens eines von befehl und adresse muss ' +
      'gesetzt sein; eine Web-App mit eigenem Server bekommt beides (FlowForge startet erst ' +
      'den Befehl und öffnet dann die Adresse im Browser, sobald sie erreichbar ist).',
    {
      beschreibung: z
        .string()
        .describe('Ein Satz in Alltagssprache: was beim Klick auf „App starten" passiert'),
      befehl: z
        .string()
        .optional()
        .describe(
          'Kommandozeilen-Befehl, der die App startet — läuft im Projektordner in einem ' +
            'eigenen, sichtbaren Konsolenfenster (z.B. „npm start" oder „node app.js")'
        ),
      adresse: z
        .string()
        .optional()
        .describe(
          'Was der Browser öffnet: eine http(s)-Adresse (z.B. http://localhost:3000) oder ' +
            'der relative Pfad einer Datei im Projektordner (z.B. index.html)'
        )
    },
    async ({ beschreibung, befehl, adresse }) => {
      const ergebnis = startanleitungSetzen(projektPfad, { beschreibung, befehl, adresse })
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: texte.ticker.startanleitungAbgelehnt(ergebnis.fehler) })
        return { content: [{ type: 'text', text: ergebnis.fehler }], isError: true }
      }
      // Oberfläche sofort nachziehen: der „App starten"-Knopf wird aktiv.
      aufEreignis({ art: 'startanleitung', anleitung: ergebnis.anleitung })
      aufEreignis({ art: 'ticker', text: texte.ticker.startanleitungGesetzt })
      return { content: [{ type: 'text', text: texte.agentenStart.gesetzt(ergebnis.anleitung) }] }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'start',
    version: '1.0.0',
    instructions:
      'Mit startanleitung_setzen hinterlegst du, wie die gebaute App dieses Projekts ' +
      'gestartet wird. Nutze es, wenn dein Arbeitsauftrag die Startanleitung verlangt — ' +
      'niemals über die Datei startanleitung.json.',
    tools: [setzen]
  })
}
