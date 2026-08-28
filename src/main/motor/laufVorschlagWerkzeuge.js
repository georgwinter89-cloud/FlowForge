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
import { kennungFuerLeitplanke, istEigenpflege } from '../../shared/kartenRegeln.js'
import { kartenLaden, zielGesetzt } from '../projekte.js'

export const EMPFEHLUNG_MAX = 300
// Anker gegen das Kreisen (BAUPLAN 62).
export const ZIELSTAND_MAX = 300
// Höchstens so viele Eigenpflege-Karten je Vorschlag: Der Apparat hält sich
// sauber, frisst aber nicht mehr die halbe Runde.
export const EIGENPFLEGE_HOECHSTENS = 1

// Reine Prüf-Funktion, exportiert für die Regel-Prüfungen: liefert { fehler }
// oder { ok, kartenIds, empfehlung, begruendung, kartenTitel }.
// laufStart (ISO): Ab wann eine Karte „frisch" ist — alles, was dieser Lauf
// selbst angelegt hat. Fehlt der Wert (alte Aufrufer, Regel-Prüfungen), fällt
// die Frischware-Regel still weg statt falsch zu greifen.
export function laufVorschlagPruefen({
  kartenIds,
  empfehlung,
  begruendung,
  karten,
  laufStart = null,
  zielstand = '',
  zielErreicht = false,
  frischBegruendung = ''
}) {
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

  // --- Anker gegen das Kreisen (BAUPLAN 62) ---
  // Alle drei Leitplanken sitzen NACH der Kennungs-Auflösung: Vorher stünden
  // hier Kurz-Kennungen, und jeder Vergleich ginge ins Leere.

  // 1. Eigenpflege-Deckel. Harte Ablehnung statt stillem Kürzen — wer zwei
  // Karten wegwirft, speichert etwas anderes, als der Agent gemeint hat.
  const eigenpflege = gefiltert.filter((id) => istEigenpflege(nachId.get(id)))
  if (eigenpflege.length > EIGENPFLEGE_HOECHSTENS)
    return { fehler: tl.eigenpflegeDeckel(eigenpflege.length, EIGENPFLEGE_HOECHSTENS) }

  // 2. Frischware nachrangig: Karten aus DIESEM Lauf dürfen nicht an älteren
  // offenen Aufgaben vorbeiziehen, ohne dass jemand sagt, warum. Der Vorschlag
  // wird nicht umgeschrieben — der Agent entscheidet neu oder begründet.
  const istFrisch = (k) => Boolean(laufStart) && String(k.angelegtAm ?? '') >= laufStart
  if (laufStart && !String(frischBegruendung ?? '').trim()) {
    const frischeImVorschlag = gefiltert.filter((id) => istFrisch(nachId.get(id)))
    if (frischeImVorschlag.length) {
      const aeltereOffene = alleKarten
        .filter((k) => k.sorte === 'aufgabe' && !k.erledigt && !istFrisch(k) && !gefiltert.includes(k.id))
        .sort((a, b) => String(a.angelegtAm ?? '').localeCompare(String(b.angelegtAm ?? '')))
      if (aeltereOffene.length)
        return {
          fehler: tl.frischOhneBegruendung(
            aeltereOffene.slice(0, 3).map((k) => `„${k.titel}"`).join(', ')
          )
        }
    }
  }

  // 3. Zielstand: Pflicht, sobald das Projekt ein Ziel hat.
  const zs = String(zielstand ?? '').trim()
  const hatZiel = zielGesetzt(alleKarten)
  if (hatZiel && !zs) return { fehler: tl.zielstandFehlt(ZIELSTAND_MAX) }
  if (zs.length > ZIELSTAND_MAX) return { fehler: tl.zielstandZuLang(ZIELSTAND_MAX) }

  return {
    ok: true,
    kartenIds: gefiltert,
    empfehlung: emp,
    begruendung: String(begruendung ?? '').trim().slice(0, 500),
    kartenTitel: gefiltert.map((id) => nachId.get(id).titel),
    zielstand: zs,
    // Ohne gesetztes Ziel gibt es nichts zu erreichen — ein zielErreicht=true
    // dürfte sonst eine Serie beenden, die nie ein Ziel hatte.
    zielErreicht: hatZiel && zielErreicht === true,
    frischBegruendung: String(frischBegruendung ?? '').trim().slice(0, 300)
  }
}

// Baut den In-Prozess-Werkzeugkasten „naechsterlauf" für einen Motor-Lauf.
// aufLaufVorschlag({ kartenIds, empfehlung, begruendung, kartenTitel }) kommt
// aus der Lauf-Verwaltung: Sie speichert die Verwaltungsdatei und vermerkt den
// Vorschlag in Ticker und Laufbericht. Kein Warten auf den Nutzer — der
// Vorschlag ist eine Einladung, kein Dialog.
export async function laufVorschlagWerkzeugServer({ projektPfad, aufLaufVorschlag, laufStart = null }) {
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
          `EIN Satz in Alltagssprache, was als Nächstes ansteht (höchstens ${EMPFEHLUNG_MAX} Zeichen) — sag, was dem Projektziel als Nächstes näher kommt, statt die letzte Fundliste fortzuschreiben`
        ),
      begruendung: z
        .string()
        .describe('Kurz: warum genau diese Karten für den nächsten Lauf'),
      // BAUPLAN 62: optional im Schema, Pflicht im Handler — dieselbe Bauweise
      // wie der 25er-Deckel von karten_lesen (BAUPLAN 53). Lehnte das Schema
      // ab, bekäme der Agent englisches Roh-JSON statt des Satzes, der ihm
      // sagt, was zu tun ist.
      zielstand: z
        .string()
        .optional()
        .describe(
          `Wie nah das Projekt jetzt am Ziel der Karte „Projektziel" ist: was steht, was fehlt (höchstens ${ZIELSTAND_MAX} Zeichen) — Pflicht, sobald ein Ziel gesetzt ist`
        ),
      zielErreicht: z
        .boolean()
        .optional()
        .describe('true NUR, wenn nichts mehr zum Ziel fehlt — ein laufender Serienlauf endet dann'),
      frischBegruendung: z
        .string()
        .optional()
        .describe(
          'Nur nötig, wenn du Karten aus DIESEM Lauf vorschlägst, obwohl ältere offene Aufgaben liegen bleiben: warum die nicht warten können'
        )
    },
    async ({ kartenIds, empfehlung, begruendung, zielstand, zielErreicht, frischBegruendung }) => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return { content: [{ type: 'text', text: geladen.fehler }], isError: true }
      const urteil = laufVorschlagPruefen({
        kartenIds,
        empfehlung,
        begruendung,
        karten: geladen.karten,
        laufStart,
        zielstand,
        zielErreicht,
        frischBegruendung
      })
      if (urteil.fehler)
        return { content: [{ type: 'text', text: urteil.fehler }], isError: true }
      aufLaufVorschlag({
        kartenIds: urteil.kartenIds,
        empfehlung: urteil.empfehlung,
        begruendung: urteil.begruendung,
        kartenTitel: urteil.kartenTitel,
        zielstand: urteil.zielstand,
        zielErreicht: urteil.zielErreicht,
        frischBegruendung: urteil.frischBegruendung
      })
      return {
        content: [
          {
            type: 'text',
            text:
              tl.gespeichert(urteil.kartenIds.length) +
              (urteil.zielErreicht ? tl.zielErreichtVermerk : '')
          }
        ]
      }
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
