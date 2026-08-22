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
import { liste } from './werkzeugSchema.js'
import { texte } from '../../shared/texte.js'
import { kennungFuerLeitplanke } from '../../shared/kartenRegeln.js'
import { kartenLaden } from '../projekte.js'

export const EMPFEHLUNG_MAX = 300

// Reine Prüf-Funktion, exportiert für die Regel-Prüfungen: liefert { fehler }
// oder { ok, kartenIds, empfehlung, begruendung, kartenTitel }.
export function laufVorschlagPruefen({ kartenIds, empfehlung, begruendung, karten }) {
  const tl = texte.agentenLaufVorschlag
  const alleKarten = Array.isArray(karten) ? karten : []
  const nachId = new Map(alleKarten.map((k) => [k.id, k]))
  // Kurz-Kennungen (BAUPLAN 53) auflösen, bevor irgendetwas verglichen oder
  // gespeichert wird: Die ids wandern in naechster-lauf.json und werden beim
  // Anzeigen mit .filter(Boolean) verworfen — eine Kurzform ergäbe eine
  // Vorschlagszeile ganz ohne Karten, und niemand bekäme eine Meldung.
  const ids = []
  for (const roh of Array.isArray(kartenIds) ? kartenIds : []) {
    const eingabe = String(roh ?? '').trim()
    if (!eingabe) continue
    const treffer = kennungFuerLeitplanke(alleKarten, eingabe)
    if (treffer.fehler) return { fehler: treffer.fehler }
    if (!ids.includes(treffer.id)) ids.push(treffer.id)
  }
  const unbekannt = ids.filter((id) => !nachId.has(id))
  if (unbekannt.length) return { fehler: tl.unbekannteIds(unbekannt.join(', ')) }
  if (ids.some((id) => nachId.get(id).sorte === 'pruefung')) return { fehler: tl.pruefkartenTabu }
  // Vorgeschlagen werden nur noch AUFGABEN-Karten (BAUPLAN 53): Wissen,
  // Entscheidungen und die Status-Karte kommen ohnehin automatisch mit (als
  // Index im Auftrag) — sie hier zu nennen, füllte die Auswahl mit dem, was
  // dieser Schritt aus ihr herausgenommen hat. Sie fallen still heraus, wie
  // die Status-Karte es schon immer tat. Prüfkarten bleiben eine harte
  // Ablehnung: Sie haben ihren eigenen Weg über den Prüfer.
  const gefiltert = ids.filter((id) => nachId.get(id).sorte === 'aufgabe')
  // Nennt der Agent AUSSCHLIESSLICH Karten, die herausfallen, ist das kein
  // leerer Vorschlag, sondern ein Missverständnis (Befund Prüfer 1): Ohne
  // diese Zeile bekäme er „Vorschlag gespeichert (0 Karten)" und Georg eine
  // Vorschlagszeile ohne eine einzige Karte. Ein absichtlich leerer Vorschlag
  // (gar keine ids) bleibt erlaubt — es gibt Läufe, nach denen nichts ansteht.
  if (ids.length && gefiltert.length === 0) return { fehler: tl.nurAufgaben }
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
      // liste() statt z.array (Befund Prüfer 1): Über Ollamas Schnittstelle
      // kommt ein Listen-Argument als JSON-TEXT an (BAUPLAN 49) — und seit
      // BAUPLAN 53 nennt das Sessionende hier Kurz-Kennungen aus dem
      // Verzeichnis. Ohne die tolerante Form fiele es als Einziges heraus.
      kartenIds: liste(z.string())
        .describe(
          'Kennungen aus karten_uebersicht (Kurzform oder volle id) der offenen Aufgaben-Karten, ' +
            'die der nächste Lauf bekommen sollte — Wissen und Entscheidungen kommen automatisch mit'
        ),
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
