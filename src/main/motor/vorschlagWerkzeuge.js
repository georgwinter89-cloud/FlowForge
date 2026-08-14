// Karten-Vorschläge (BAUPLAN 26): Das Werkzeug des Karten-Prüfers. Der Agent
// ändert Karten nie selbst — er schlägt vor, FlowForge zeigt den Vorschlag im
// Lauf-Tab, und der Nutzer entscheidet je Karte: übernehmen, Vorschlag
// bearbeiten oder ablehnen. Angewendet wird ausschließlich von FlowForge über
// die normalen Kartenfunktionen (lauf.js); das Werkzeug wartet — wie
// mensch_fragen — bis die Entscheidung da ist, und meldet dem Agenten ehrlich
// den Ausgang für seinen Kartenbericht.
//
// Harte Leitplanken im Code (nicht per Bitte): Entscheidungs-Karten werden nie
// umformuliert oder gelöscht (nur eine neue Aufgaben-Karte darf den
// Widerspruch benennen), Prüfkarten pflegt FlowForge (keine Vorschläge), die
// Status-Karte ist nur aktualisierbar, neue Karten sind immer Aufgaben.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { TITEL_MAX, TEXT_MAX } from '../../shared/kartenRegeln.js'
import { kartenLaden } from '../projekte.js'

// Leitplanken je Art — abgewiesene Vorschläge erreichen den Nutzer nie.
// Reine Funktion, exportiert, damit sich die Regeln ohne Motor prüfen lassen:
// liefert { fehler } oder { ok, titel, text } (titel/text ggf. normalisiert).
export function vorschlagLeitplanken({ art, kartenId, karte, titel, text }) {
  const tv = texte.agentenVorschlag
  if (art !== 'anlegen' && !karte) return { fehler: tv.unbekannteId(String(kartenId ?? '?')) }
  if (karte?.sorte === 'pruefung') return { fehler: tv.pruefkarteTabu }
  if (karte?.sorte === 'entscheidung' && art !== 'erledigen' && art !== 'oeffnen')
    return { fehler: tv.entscheidungTabu }
  if (art === 'aktualisieren') {
    if (!['status', 'wissen', 'aufgabe'].includes(karte.sorte))
      return { fehler: tv.entscheidungTabu }
    const neuerTitel = karte.sorte === 'status' ? karte.titel : String(titel ?? '').trim()
    const neuerText = String(text ?? '').trim()
    if (!neuerTitel || !neuerText || neuerTitel.length > TITEL_MAX || neuerText.length > TEXT_MAX)
      return { fehler: tv.felderUngueltig(TITEL_MAX, TEXT_MAX) }
    if (neuerTitel === karte.titel && neuerText === karte.text)
      return { fehler: tv.nichtsGeaendert }
    return { ok: true, titel: neuerTitel, text: neuerText }
  }
  if (art === 'erledigen' || art === 'oeffnen') {
    if (karte.sorte !== 'aufgabe') return { fehler: tv.nurAufgaben }
    if (art === 'erledigen' && karte.erledigt) return { fehler: tv.schonErledigt }
    if (art === 'oeffnen' && !karte.erledigt) return { fehler: tv.schonOffen }
  }
  if (art === 'loeschen' && !['wissen', 'aufgabe'].includes(karte.sorte))
    // Die Status-Karte bekommt ihre eigene, sachlich richtige Begründung
    // (Zweit-Audit D-08) — sie ist keine Festlegung, sondern nur fest verbaut.
    return { fehler: karte.sorte === 'status' ? tv.statusNurAktualisierbar : tv.entscheidungTabu }
  if (art === 'anlegen') {
    const neuerTitel = String(titel ?? '').trim()
    const neuerText = String(text ?? '').trim()
    if (!neuerTitel || !neuerText || neuerTitel.length > TITEL_MAX || neuerText.length > TEXT_MAX)
      return { fehler: tv.felderUngueltig(TITEL_MAX, TEXT_MAX) }
    return { ok: true, titel: neuerTitel, text: neuerText }
  }
  return { ok: true, titel: titel ?? null, text: text ?? null }
}

// Baut den In-Prozess-Werkzeugkasten „vorschlaege" für einen Motor-Lauf.
// aufKartenVorschlag(vorschlag) kommt aus der Lauf-Verwaltung und löst mit
// { wahl: 'uebernommen' | 'bearbeitet' | 'abgelehnt', titel?, text? } auf —
// oder mit null, wenn der Lauf angehalten wurde.
export async function vorschlagWerkzeugServer({ projektPfad, aufKartenVorschlag }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const tv = texte.agentenVorschlag

  function fehler(text) {
    return { content: [{ type: 'text', text }], isError: true }
  }

  const vorschlagen = tool(
    'karte_vorschlagen',
    tv.werkzeugBeschreibung,
    {
      art: z
        .enum(['aktualisieren', 'erledigen', 'oeffnen', 'anlegen', 'loeschen'])
        .describe(
          'aktualisieren = Titel/Inhalt einer Karte richtigstellen · erledigen = offene ' +
            'Aufgabe abhaken · oeffnen = abgehakte Aufgabe wieder öffnen · anlegen = neue ' +
            'Aufgaben-Karte (z.B. bei Widerspruch zwischen Code und Entscheidungs-Karte) · ' +
            'loeschen = gegenstandslose Karte entfernen'
        ),
      kartenId: z
        .string()
        .optional()
        .describe('id der betroffenen Karte aus karten_uebersicht (entfällt bei anlegen)'),
      titel: z
        .string()
        .optional()
        .describe(`Vorgeschlagener Titel (aktualisieren/anlegen), höchstens ${TITEL_MAX} Zeichen`),
      text: z
        .string()
        .optional()
        .describe(`Vorgeschlagener Inhalt (aktualisieren/anlegen), höchstens ${TEXT_MAX} Zeichen`),
      begruendung: z
        .string()
        .describe('Kurze Begründung mit Beleg aus dem Code (Datei) — warum die Karte veraltet ist')
    },
    async ({ art, kartenId, titel, text, begruendung }) => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return fehler(geladen.fehler)
      const karte = kartenId ? geladen.karten.find((k) => k.id === kartenId) : null

      const urteil = vorschlagLeitplanken({ art, kartenId, karte, titel, text })
      if (urteil.fehler) return fehler(urteil.fehler)
      titel = urteil.titel
      text = urteil.text

      const antwort = await aufKartenVorschlag({
        art,
        kartenId: karte?.id ?? null,
        // Schnappschuss der Karte für die Anzeige „so steht es".
        alteKarte: karte
          ? { sorte: karte.sorte, titel: karte.titel, text: karte.text, erledigt: karte.erledigt }
          : null,
        titel: titel ?? null,
        text: text ?? null,
        begruendung: String(begruendung ?? '').trim().slice(0, 500)
      })
      if (antwort == null) return fehler(tv.keineAntwort)
      if (antwort.wahl === 'abgelehnt')
        return { content: [{ type: 'text', text: tv.abgelehnt }] }
      if (antwort.wahl === 'bearbeitet')
        return {
          content: [
            { type: 'text', text: tv.bearbeitetUebernommen(antwort.titel, antwort.text) }
          ]
        }
      return { content: [{ type: 'text', text: tv.uebernommen }] }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'vorschlaege',
    version: '1.0.0',
    instructions: tv.serverHinweis,
    tools: [vorschlagen]
  })
}
