// Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): Das Werkzeug des
// Sessionende-Blocks. Der Agent kennt den Lauf gerade am besten (was fertig
// wurde, was offen blieb) und benennt die Karten-IDs für den nächsten Lauf
// plus einen Satz Empfehlung in Alltagssprache. FlowForge speichert das nur
// als Vorschlag — die Kartenauswahl springt nie von selbst um, es wird nichts
// umgebaut und nichts gestartet: Die Leinwand gehört dem Nutzer.
//
// Harte Leitplanken im Code: nur existierende Karten-IDs (Fantasie-IDs werden
// mit klarer Meldung abgewiesen), keine Prüfkarten (die haben ihren eigenen
// Weg über den Prüfer), die Status-Karte fällt still heraus (sie ist ohnehin
// immer dabei).
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { kartenLaden } from '../projekte.js'

export const EMPFEHLUNG_MAX = 300

// Reine Prüf-Funktion, exportiert für die Regel-Prüfungen: liefert { fehler }
// oder { ok, kartenIds, empfehlung, begruendung, kartenTitel }.
export function laufVorschlagPruefen({ kartenIds, empfehlung, begruendung, karten }) {
  const tl = texte.agentenLaufVorschlag
  const nachId = new Map((Array.isArray(karten) ? karten : []).map((k) => [k.id, k]))
  const ids = [...new Set((Array.isArray(kartenIds) ? kartenIds : []).map((id) => String(id)))]
  const unbekannt = ids.filter((id) => !nachId.has(id))
  if (unbekannt.length) return { fehler: tl.unbekannteIds(unbekannt.join(', ')) }
  if (ids.some((id) => nachId.get(id).sorte === 'pruefung')) return { fehler: tl.pruefkartenTabu }
  // Die Status-Karte ist bei jedem Lauf ohnehin dabei — still herausfiltern.
  const gefiltert = ids.filter((id) => nachId.get(id).sorte !== 'status')
  const emp = String(empfehlung ?? '').trim()
  if (!emp || emp.length > EMPFEHLUNG_MAX) return { fehler: tl.empfehlungUngueltig(EMPFEHLUNG_MAX) }
  return {
    ok: true,
    kartenIds: gefiltert,
    empfehlung: emp,
    begruendung: String(begruendung ?? '').trim().slice(0, 500),
    kartenTitel: gefiltert.map((id) => nachId.get(id).titel)
  }
}

// Baut den In-Prozess-Werkzeugkasten „naechsterlauf" für einen Motor-Lauf.
// aufLaufVorschlag({ kartenIds, empfehlung, begruendung, kartenTitel }) kommt
// aus der Lauf-Verwaltung: Sie speichert die Verwaltungsdatei und vermerkt den
// Vorschlag in Ticker und Laufbericht. Kein Warten auf den Nutzer — der
// Vorschlag ist eine Einladung, kein Dialog.
export async function laufVorschlagWerkzeugServer({ projektPfad, aufLaufVorschlag }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const tl = texte.agentenLaufVorschlag

  const vorschlagen = tool(
    'naechster_lauf_vorschlagen',
    tl.werkzeugBeschreibung,
    {
      kartenIds: z
        .array(z.string())
        .describe('ids der Karten aus karten_uebersicht, die der nächste Lauf bekommen sollte'),
      empfehlung: z
        .string()
        .describe(
          `EIN Satz in Alltagssprache, was als Nächstes ansteht (höchstens ${EMPFEHLUNG_MAX} Zeichen) — darf eine Vorlage nennen, z.B. „als Nächstes ‚Bug jagen‘"`
        ),
      begruendung: z
        .string()
        .describe('Kurz: warum genau diese Karten für den nächsten Lauf')
    },
    async ({ kartenIds, empfehlung, begruendung }) => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return { content: [{ type: 'text', text: geladen.fehler }], isError: true }
      const urteil = laufVorschlagPruefen({
        kartenIds,
        empfehlung,
        begruendung,
        karten: geladen.karten
      })
      if (urteil.fehler)
        return { content: [{ type: 'text', text: urteil.fehler }], isError: true }
      aufLaufVorschlag({
        kartenIds: urteil.kartenIds,
        empfehlung: urteil.empfehlung,
        begruendung: urteil.begruendung,
        kartenTitel: urteil.kartenTitel
      })
      return { content: [{ type: 'text', text: tl.gespeichert(urteil.kartenIds.length) }] }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'naechsterlauf',
    version: '1.0.0',
    instructions: tl.serverHinweis,
    tools: [vorschlagen]
  })
}
