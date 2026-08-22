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
//
// Vorschlagsart „thema" (BAUPLAN 30, Sammelform): Der Sortiermodus „Themen
// sortieren" schlägt viele Themen in EINEM Aufruf vor — ein Sammel-Dialog
// statt 60 pausierender Einzeldialoge. Thema setzen ist kein Umformulieren:
// auch Entscheidungs-Karten dürfen ein Thema vorgeschlagen bekommen.
import { z } from 'zod'
import { liste } from './werkzeugSchema.js'
import { texte } from '../../shared/texte.js'
import {
  TITEL_MAX,
  TEXT_MAX,
  THEMA_MAX,
  THEMEN_SORTEN,
  themaNormalisieren,
  themaSchluessel,
  kanonischesThema,
  vorhandeneThemen,
  kennungFuerLeitplanke
} from '../../shared/kartenRegeln.js'
import { kartenLaden } from '../projekte.js'

// Leitplanken je Art — abgewiesene Vorschläge erreichen den Nutzer nie.
// Reine Funktion, exportiert, damit sich die Regeln ohne Motor prüfen lassen:
// liefert { fehler } oder { ok, titel, text, thema } (ggf. normalisiert).
// karten (alle Projektkarten) braucht nur „anlegen" — fürs kanonische Thema.
export function vorschlagLeitplanken({ art, kartenId, karte, titel, text, thema, karten = [] }) {
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
    // Neue Karten tragen ein Thema (BAUPLAN 30) — die Ablehnung nennt die
    // vorhandenen, damit der Agent sofort einsortieren kann.
    const neuesThema = themaNormalisieren(thema)
    if (!neuesThema) return { fehler: texte.kartenRegeln.themaFehlt(vorhandeneThemen(karten)) }
    if (neuesThema.length > THEMA_MAX)
      return { fehler: texte.kartenRegeln.themaZuLang(THEMA_MAX, neuesThema.length) }
    return { ok: true, titel: neuerTitel, text: neuerText, thema: kanonischesThema(karten, neuesThema) }
  }
  return { ok: true, titel: titel ?? null, text: text ?? null }
}

// Sammel-Leitplanken für „thema" (BAUPLAN 30): liefert { fehler } oder
// { ok, eintraege: [{ kartenId, titel, sorte, altesThema, thema }] }. Geprüft:
// echte Karten-IDs, nur Themen-Sorten (Status/Prüfkarten tragen keins),
// Thema gefüllt und in der Längengrenze, keine Dublette je Karte, kein
// wortgleiches Thema (nichts zu ändern). Themen werden kanonisiert — auch
// gegen die anderen Vorschläge desselben Aufrufs (der erste bestimmt die
// Schreibweise).
export function themenVorschlagLeitplanken({ themen, karten }) {
  const tv = texte.agentenVorschlag
  const liste = Array.isArray(themen) ? themen : []
  if (liste.length === 0) return { fehler: tv.themenLeer }
  const nachId = new Map((Array.isArray(karten) ? karten : []).map((k) => [k.id, k]))
  const bekannt = vorhandeneThemen(karten)
  const eintraege = []
  const gesehen = new Set()
  const alleKarten = Array.isArray(karten) ? karten : []
  for (const roh of liste) {
    // Kurz-Kennung → volle id (BAUPLAN 53): Der Eintrag wird erst nach Georgs
    // Klick angewandt (karteThemaSetzen) — eine Kurzform scheiterte dort
    // Zeile für Zeile im schon offenen Sammel-Dialog.
    const treffer = kennungFuerLeitplanke(alleKarten, roh?.kartenId)
    if (treffer.fehler) return { fehler: treffer.fehler }
    const kartenId = treffer.id
    const karte = nachId.get(kartenId)
    if (!karte) return { fehler: tv.unbekannteId(kartenId || '?') }
    if (gesehen.has(kartenId)) return { fehler: tv.themaDoppelt(kartenId) }
    gesehen.add(kartenId)
    if (!THEMEN_SORTEN.includes(karte.sorte)) return { fehler: tv.themaFalscheSorte(karte.titel) }
    const eingabe = themaNormalisieren(roh?.thema)
    if (!eingabe) return { fehler: tv.themaLeer(karte.titel) }
    if (eingabe.length > THEMA_MAX)
      return { fehler: texte.kartenRegeln.themaZuLang(THEMA_MAX, eingabe.length) }
    const schluessel = themaSchluessel(eingabe)
    const kanonisch = bekannt.find((t) => themaSchluessel(t) === schluessel) ?? eingabe
    if (!bekannt.some((t) => themaSchluessel(t) === schluessel)) bekannt.push(kanonisch)
    if (typeof karte.thema === 'string' && themaSchluessel(karte.thema) === schluessel)
      return { fehler: tv.themaGleich(karte.titel) }
    eintraege.push({
      kartenId,
      titel: karte.titel,
      sorte: karte.sorte,
      altesThema: karte.thema ?? null,
      thema: kanonisch
    })
  }
  return { ok: true, eintraege }
}

// Baut den In-Prozess-Werkzeugkasten „vorschlaege" für einen Motor-Lauf.
// aufKartenVorschlag(vorschlag) kommt aus der Lauf-Verwaltung und löst mit
// { wahl: 'uebernommen' | 'bearbeitet' | 'abgelehnt', titel?, text? } auf —
// oder mit null, wenn der Lauf angehalten wurde. Bei art 'thema' löst sie mit
// { wahl: 'thema', uebernommen, abgelehnt } auf.
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
        .enum(['aktualisieren', 'erledigen', 'oeffnen', 'anlegen', 'loeschen', 'thema'])
        .describe(
          'aktualisieren = Titel/Inhalt einer Karte richtigstellen · erledigen = offene ' +
            'Aufgabe abhaken · oeffnen = abgehakte Aufgabe wieder öffnen · anlegen = neue ' +
            'Aufgaben-Karte (z.B. bei Widerspruch zwischen Code und Entscheidungs-Karte) · ' +
            'loeschen = gegenstandslose Karte entfernen · thema = Themen für mehrere Karten ' +
            'auf einmal vorschlagen (Sammelform über das Feld themen — nur Thema, kein Umformulieren)'
        ),
      kartenId: z
        .string()
        .optional()
        .describe(
          'Kennung der betroffenen Karte aus karten_uebersicht (Kurzform oder volle id) — ' +
            'entfällt bei anlegen und thema'
        ),
      titel: z
        .string()
        .optional()
        .describe(`Vorgeschlagener Titel (aktualisieren/anlegen), höchstens ${TITEL_MAX} Zeichen`),
      text: z
        .string()
        .optional()
        .describe(`Vorgeschlagener Inhalt (aktualisieren/anlegen), höchstens ${TEXT_MAX} Zeichen`),
      thema: z
        .string()
        .optional()
        .describe(
          `Thema der neuen Karte (anlegen, Pflicht): kurzes Schlagwort, höchstens ${THEMA_MAX} Zeichen — bevorzugt ein vorhandenes`
        ),
      themen: liste(
          z.object({
            kartenId: z
              .string()
              .describe('Kennung der Karte aus karten_uebersicht (Kurzform oder volle id)'),
            thema: z.string().describe(`Vorgeschlagenes Thema, höchstens ${THEMA_MAX} Zeichen`)
          })
        )
        .optional()
        .describe('Nur bei art thema: alle Karten mit ihrem vorgeschlagenen Thema — in EINEM Aufruf'),
      begruendung: z
        .string()
        .describe(
          'Kurze Begründung mit Beleg aus dem Code (Datei) — warum die Karte veraltet ist; ' +
            'bei thema: nach welchem Muster du einsortiert hast'
        )
    },
    async ({ art, kartenId, titel, text, thema, themen, begruendung }) => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return fehler(geladen.fehler)
      const kurzeBegruendung = String(begruendung ?? '').trim().slice(0, 500)

      // Sammelform „thema" (BAUPLAN 30): ein Dialog, viele Zeilen.
      if (art === 'thema') {
        const urteil = themenVorschlagLeitplanken({ themen, karten: geladen.karten })
        if (urteil.fehler) return fehler(urteil.fehler)
        const antwort = await aufKartenVorschlag({
          art: 'thema',
          eintraege: urteil.eintraege,
          begruendung: kurzeBegruendung
        })
        if (antwort == null) return fehler(tv.keineAntwort)
        return {
          content: [
            { type: 'text', text: tv.themenErgebnis(antwort.uebernommen ?? 0, antwort.abgelehnt ?? 0) }
          ]
        }
      }

      // Kurz-Kennung → Karte (BAUPLAN 53). Bleibt sie unauflösbar, gilt wie
      // bisher „unbekannte id" aus den Leitplanken; mehrdeutig wird ehrlich
      // gemeldet, statt eine der beiden Karten zu raten.
      let karte = null
      if (kartenId) {
        const treffer = kennungFuerLeitplanke(geladen.karten, kartenId)
        if (treffer.fehler) return fehler(treffer.fehler)
        kartenId = treffer.id
        karte = geladen.karten.find((k) => k.id === kartenId) ?? null
      }
      const urteil = vorschlagLeitplanken({
        art,
        kartenId,
        karte,
        titel,
        text,
        thema,
        karten: geladen.karten
      })
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
        thema: urteil.thema ?? null,
        begruendung: kurzeBegruendung
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
