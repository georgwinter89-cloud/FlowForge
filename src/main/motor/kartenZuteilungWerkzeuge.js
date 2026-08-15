// Karten-Zuteilung (BAUPLAN 29): Das Werkzeug der Auftragsquellen-Blöcke
// (Paket schneiden, Diagnose). Der Agent teilt je nachfolgendem Block die
// Karten zu, die dieser wirklich braucht — jeder Block bekommt dann nur noch
// seine zugeteilten Karten in den Auftrag (die Status-Karte immer), dasselbe
// gilt fürs Projektwissen der lokalen Helfer-KI. Rückfall ohne Bruch: Wird
// das Werkzeug nicht benutzt oder ein Block nicht genannt, bekommt er wie
// bisher die volle Auswahl.
//
// Harte Leitplanken im Code: nur Karten-IDs aus der Kartenauswahl des Laufs,
// nur echte Nachfolger im Schaubild — Fantasie-IDs und fremde Blöcke werden
// mit klarer Meldung abgewiesen. Die Status-Karte fällt still heraus (sie ist
// ohnehin immer dabei).
import { z } from 'zod'
import { texte } from '../../shared/texte.js'

// Reine Prüf-Funktion, exportiert für die Regel-Prüfungen.
// zuteilung: [{ block, kartenIds }], karten: alle Projektkarten,
// ausgewaehlt: Karten-IDs der Kartenauswahl des Laufs,
// nachfolger: Map Blockname → [instanzIds] der Nachfahren des rufenden Blocks.
// Liefert { fehler } oder { ok, zuteilung: [instanzId, kartenIds][], jeBlock }.
export function kartenZuteilungPruefen({ zuteilung, karten, ausgewaehlt, nachfolger }) {
  const tz = texte.agentenKartenZuteilung
  const eintraege = (Array.isArray(zuteilung) ? zuteilung : []).filter(
    (e) => e && typeof e.block === 'string' && e.block.trim()
  )
  if (eintraege.length === 0) return { fehler: tz.leereZuteilung }
  if (!nachfolger || nachfolger.size === 0) return { fehler: tz.keineNachfolger }
  const unbekannt = [...new Set(eintraege.map((e) => e.block.trim()))].filter(
    (name) => !nachfolger.has(name)
  )
  if (unbekannt.length)
    return {
      fehler: tz.unbekannteBloecke(unbekannt.join(', '), [...nachfolger.keys()].join(', '))
    }
  const nachId = new Map((Array.isArray(karten) ? karten : []).map((k) => [k.id, k]))
  const auswahl = new Set(Array.isArray(ausgewaehlt) ? ausgewaehlt : [])
  // Je Block eine Karten-Liste — nennt der Agent denselben Block mehrfach,
  // gewinnt der letzte Eintrag (ein erneuter Aufruf ersetzt, kein Rätselraten).
  const jeName = new Map()
  for (const eintrag of eintraege) {
    const ids = [
      ...new Set((Array.isArray(eintrag.kartenIds) ? eintrag.kartenIds : []).map((id) => String(id)))
    ]
    // Die Status-Karte ist bei jedem Block ohnehin dabei — still herausfiltern.
    const ohneStatus = ids.filter((id) => nachId.get(id)?.sorte !== 'status')
    const fremd = ohneStatus.filter((id) => !auswahl.has(id))
    if (fremd.length) return { fehler: tz.fremdeKarten(fremd.join(', ')) }
    jeName.set(eintrag.block.trim(), ohneStatus)
  }
  const paare = []
  const jeBlock = []
  for (const [name, ids] of jeName) {
    for (const instanzId of nachfolger.get(name)) paare.push([instanzId, ids])
    jeBlock.push({ block: name, anzahl: ids.length })
  }
  return { ok: true, zuteilung: paare, jeBlock }
}

// Paket melden (BAUPLAN 30, Herkunft): Die Auftragsquellen-Blöcke melden
// strukturiert, an welchen Aufgaben-Karten der Lauf arbeitet — FlowForge
// stempelt damit jede im Lauf angelegte oder geänderte Karte. Reine
// Prüf-Funktion, exportiert für die Regel-Prüfungen: nur offene
// Aufgaben-Karten aus der Kartenauswahl; leer erlaubt, wenn das Wunsch-/
// Fehlerbild-Feld des Blocks die Quelle war (feldGefuellt). Liefert
// { fehler } oder { ok, aufgaben: [{ id, titel }] }.
export function paketMeldungPruefen({ aufgabenIds, karten, ausgewaehlt, feldGefuellt }) {
  const tp = texte.agentenPaket
  const ids = [
    ...new Set((Array.isArray(aufgabenIds) ? aufgabenIds : []).map((id) => String(id ?? '').trim()))
  ].filter(Boolean)
  if (ids.length === 0) {
    if (feldGefuellt) return { ok: true, aufgaben: [] }
    return { fehler: tp.leerOhneFeld }
  }
  const nachId = new Map((Array.isArray(karten) ? karten : []).map((k) => [k.id, k]))
  const auswahl = new Set(Array.isArray(ausgewaehlt) ? ausgewaehlt : [])
  const aufgaben = []
  for (const id of ids) {
    const karte = nachId.get(id)
    if (!karte) return { fehler: tp.unbekannteId(id) }
    if (karte.sorte !== 'aufgabe' || karte.erledigt) return { fehler: tp.keineOffeneAufgabe(karte.titel) }
    if (!auswahl.has(id)) return { fehler: tp.nichtInAuswahl(karte.titel) }
    aufgaben.push({ id, titel: karte.titel })
  }
  return { ok: true, aufgaben }
}

// Baut den In-Prozess-Werkzeugkasten „zuteilung" für einen Motor-Lauf.
// aufKartenZuteilung({ zuteilung }) kommt aus der Lauf-Verwaltung (der Motor
// reicht die Instanz-Kennung des rufenden Blocks mit hinein): Sie validiert,
// merkt sich die Zuteilung und vermerkt sie in Ticker und Laufbericht —
// zurück kommt { fehler } oder { ok, meldung } als Werkzeug-Ergebnis.
// aufPaketMeldung({ aufgabenIds }) genauso für paket_melden (BAUPLAN 30).
export async function kartenZuteilungWerkzeugServer({ aufKartenZuteilung, aufPaketMeldung = null }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const tz = texte.agentenKartenZuteilung
  const tp = texte.agentenPaket

  const paketMelden = tool(
    'paket_melden',
    tp.werkzeugBeschreibung,
    {
      aufgabenIds: z
        .array(z.string())
        .describe(
          'ids der offenen Aufgaben-Karten aus der Kartenauswahl, die dieses Paket bearbeitet — ' +
            'leer, wenn der Auftrag allein aus dem Wunsch-/Fehlerbild-Feld kam'
        )
    },
    async ({ aufgabenIds }) => {
      if (!aufPaketMeldung)
        return { content: [{ type: 'text', text: texte.fehler.unbekannt }], isError: true }
      const ergebnis = aufPaketMeldung({ aufgabenIds })
      if (ergebnis.fehler)
        return { content: [{ type: 'text', text: ergebnis.fehler }], isError: true }
      return { content: [{ type: 'text', text: ergebnis.meldung }] }
    },
    { alwaysLoad: true }
  )

  const zuteilen = tool(
    'karten_zuteilen',
    tz.werkzeugBeschreibung,
    {
      zuteilung: z
        .array(
          z.object({
            block: z.string().describe('Name des nachfolgenden Blocks im Schaubild'),
            kartenIds: z
              .array(z.string())
              .describe(
                'ids der Karten aus der Kartenauswahl, die dieser Block bekommen soll — leer heißt „nur die Status-Karte"'
              )
          })
        )
        .describe('Je nachfolgendem Block die Karten, die er wirklich braucht')
    },
    async ({ zuteilung }) => {
      const ergebnis = aufKartenZuteilung({ zuteilung })
      if (ergebnis.fehler)
        return { content: [{ type: 'text', text: ergebnis.fehler }], isError: true }
      return { content: [{ type: 'text', text: ergebnis.meldung }] }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'zuteilung',
    version: '1.0.0',
    instructions: tz.serverHinweis + ' ' + tp.serverHinweis,
    tools: [zuteilen, paketMelden]
  })
}
