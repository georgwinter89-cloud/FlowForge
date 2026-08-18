// Startanleitungs-Werkzeug (SPEC §8, BAUPLAN 10): Der Agent legt die
// Startanleitung des Projekts ausschließlich hierüber fest — mit harter
// Validierung im FlowForge-Prozess, wie bei den Karten-Werkzeugen. Die Datei
// startanleitung.json selbst ist für direkte Schreibzugriffe gesperrt.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { startanleitungSetzen } from '../startanleitung.js'

// holeInstanz (0.46.2): Die Kennung des Blocks, der gerade setzt — wie beim
// Prüfbefehl. Sie steht als gesetztVon in der Datei und im Ereignis, damit der
// Lauf in der Welle sagen kann, wer wessen Anleitung ersetzt hat, und wem der
// Rauchtest die Nachbesserungs-Runde gibt. Ohne sie (Chat) bleibt es null.
export async function startWerkzeugServer({ projektPfad, aufEreignis, holeInstanz = null }) {
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
          'Kommandozeilen-Befehl, der die App startet — läuft im Projektordner in FlowForge ' +
            'mit sichtbarer Ausgabe, aber OHNE Tastatureingabe: er darf nichts abfragen und ' +
            'muss von allein laufen (z.B. „npm start" oder „node app.js")'
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
      const gesetztVon = holeInstanz?.() ?? null
      const ergebnis = startanleitungSetzen(projektPfad, { beschreibung, befehl, adresse }, { gesetztVon })
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: texte.ticker.startanleitungAbgelehnt(ergebnis.fehler) })
        return { content: [{ type: 'text', text: ergebnis.fehler }], isError: true }
      }
      // Oberfläche sofort nachziehen: der „App starten"-Knopf wird aktiv.
      // gesetztVon + vorher (0.46.2): der Lauf baut daraus den Überschreiben-
      // Ticker der Welle.
      aufEreignis({ art: 'startanleitung', anleitung: ergebnis.anleitung, gesetztVon, vorher: ergebnis.vorher })
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
