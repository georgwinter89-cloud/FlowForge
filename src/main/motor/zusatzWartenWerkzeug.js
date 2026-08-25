// Auf den Zusatzbauer warten (Bauschritt 58): das Werkzeug des Prüfers für
// einen Fund AUSSERHALB der Dateilisten seines Auftrags. Der Prüfer ist der
// Letzte in der Kette — hinter ihm urteilt niemand mehr. Deshalb wartet er
// selbst: Der Aufruf blockiert, bis der Zusatzbauer fertig ist (das Vorbild
// ist lokal_recherchieren — ein async-Handler, in dem der Agent hängt und
// nichts kostet), und das Ergebnis trägt Umsetzungsbericht und Diff. Danach
// urteilt der Prüfer über einen fertigen Stand — im Feld zusatzUrteile seines
// Prüfbelegs, getrennt vom Urteil über sein Paket.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { SCHWEREN } from '../../shared/lieferschein.js'

// Baut den In-Prozess-Werkzeugkasten „zusatz" für einen Motor-Lauf.
// aufZusatzbauerWarten({ text, fundort, soll, schwere }) kommt aus der
// Lauf-Verwaltung (lauf.js) und löst IMMER mit { text } auf — auch in den
// Fehlschlag-Pfaden (Zusatzbauer stürzt ab, Lauf wird abgebrochen): Der
// wartende Prüfer hängt nie. Deshalb hier bewusst kein eigenes Timeout und
// kein Fangnetz; das einzige Ehrlichkeits-Netz ist der fehlende Callback.
export async function zusatzWartenWerkzeugServer({ aufZusatzbauerWarten = null }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const tz = texte.zusatzWarten

  const warten = tool(
    'auf_zusatzbauer_warten',
    tz.werkzeug,
    {
      text: z.string().describe(tz.param.text),
      fundort: z.string().describe(tz.param.fundort),
      soll: z.string().describe(tz.param.soll),
      schwere: z.enum(SCHWEREN).optional().describe(tz.param.schwere)
    },
    async ({ text, fundort, soll, schwere }) => {
      if (!aufZusatzbauerWarten)
        return { content: [{ type: 'text', text: tz.nichtVerdrahtet }], isError: true }
      const ergebnis = await aufZusatzbauerWarten({ text, fundort, soll, schwere })
      return { content: [{ type: 'text', text: String(ergebnis?.text ?? '') }] }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'zusatz',
    version: '1.0.0',
    instructions: tz.serverHinweis,
    tools: [warten]
  })
}
