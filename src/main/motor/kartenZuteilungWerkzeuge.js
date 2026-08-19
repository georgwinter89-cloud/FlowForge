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
import { liste } from './werkzeugSchema.js'
import { texte } from '../../shared/texte.js'
import { zielFuerAdresse } from '../../shared/kettenRegeln.js'

// Reine Prüf-Funktion, exportiert für die Regel-Prüfungen.
// zuteilung: [{ block, kartenIds }], karten: alle Projektkarten,
// ausgewaehlt: Karten-IDs der Kartenauswahl des Laufs,
// ziele: die Nachfahren des rufenden Blocks als Adressen
//   [{ instanzId, nummer, name, adresse, bezeichnung }].
//
// Adressiert wird seit BAUPLAN 44 über die Blocknummer und trifft GENAU EINE
// Instanz. Vorher war der Schlüssel der Anzeigename: Zwei Bauer ohne
// Zusatznamen verschmolzen zu einem Eintrag und bekamen beide dieselbe
// Zuteilung — mit einem eigenen Paket je Ziel wäre das ein stiller Fehlschlag.
// Liefert { fehler } oder { ok, zuteilung: [instanzId, kartenIds][], jeBlock }.
export function kartenZuteilungPruefen({ zuteilung, karten, ausgewaehlt, ziele }) {
  const tz = texte.agentenKartenZuteilung
  const liste = Array.isArray(ziele) ? ziele : []
  const eintraege = (Array.isArray(zuteilung) ? zuteilung : []).filter(
    (e) => e && typeof e.block === 'string' && e.block.trim()
  )
  if (eintraege.length === 0) return { fehler: tz.leereZuteilung }
  if (liste.length === 0) return { fehler: tz.keineNachfolger }
  const unbekannt = [
    ...new Set(
      eintraege.map((e) => e.block.trim()).filter((adresse) => !zielFuerAdresse(liste, adresse))
    )
  ]
  if (unbekannt.length)
    return {
      fehler: tz.unbekannteBloecke(
        unbekannt.join(', '),
        liste.map((z) => z.bezeichnung).join(' | ')
      )
    }
  const nachId = new Map((Array.isArray(karten) ? karten : []).map((k) => [k.id, k]))
  const auswahl = new Set(Array.isArray(ausgewaehlt) ? ausgewaehlt : [])
  // Je Instanz eine Karten-Liste — nennt der Agent dieselbe Adresse mehrfach,
  // gewinnt der letzte Eintrag (ein erneuter Aufruf ersetzt, kein Rätselraten).
  const jeInstanz = new Map()
  for (const eintrag of eintraege) {
    const ids = [
      ...new Set((Array.isArray(eintrag.kartenIds) ? eintrag.kartenIds : []).map((id) => String(id)))
    ]
    // Die Status-Karte ist bei jedem Block ohnehin dabei — still herausfiltern.
    const ohneStatus = ids.filter((id) => nachId.get(id)?.sorte !== 'status')
    const fremd = ohneStatus.filter((id) => !auswahl.has(id))
    if (fremd.length) return { fehler: tz.fremdeKarten(fremd.join(', ')) }
    jeInstanz.set(zielFuerAdresse(liste, eintrag.block).instanzId, ohneStatus)
  }
  const paare = []
  const jeBlock = []
  for (const [instanzId, ids] of jeInstanz) {
    paare.push([instanzId, ids])
    jeBlock.push({
      block: liste.find((z) => z.instanzId === instanzId)?.bezeichnung ?? instanzId,
      anzahl: ids.length
    })
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
  // Keine Anzahl-Grenze (seit 0.46.1) — wie im Zuschnitt (lieferschein.js,
  // aufgabenIds): Beide Enden derselben Rechnung reichen gleich weit, sonst
  // entstünde ein Paket, dessen Vollständigkeit niemand mehr erfüllen kann.
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
      aufgabenIds: liste(z.string())
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
      zuteilung: liste(
          z.object({
            block: z
              .string()
              .describe(
                'Die Blocknummer des nachfolgenden Blocks im Schaubild (z.B. „3") — dein ' +
                  'Auftrag listet sie; zwei Blöcke können gleich heißen, die Nummer ist eindeutig'
              ),
            kartenIds: liste(z.string())
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
