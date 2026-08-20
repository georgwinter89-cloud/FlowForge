// Lieferschein-Werkzeuge (BAUPLAN 42): der einheitliche Rückkanal jedes Blocks.
// Ein Werkzeug je liefert-Etikett — beim Laufstart steht das Schaubild fest,
// also registriert FlowForge genau die Werkzeuge, die DIESE Kette braucht.
// Freigeschaltet ist je Block nur das zu seinem Etikett passende (pruefeWerkzeug
// im Motor); die anderen lösen die übliche Rechte-Rückfrage aus.
//
// Drei Durchsetzungs-Ebenen (BAUPLAN 42):
//   1. Schema — Struktur, Typen, Auswahlwerte (hier, über zod).
//   2. FlowForge im Code — Pflichtfelder, Auswahlwerte, Plausibilität
//      (lieferschein.js). Längen- und Anzahl-Grenzen gibt es seit 0.46.1
//      bewusst nicht mehr — auch nicht im Schema (kein .max/.maxLength).
//   3. Kanten-Prüfung — deckt die Lieferung den Bedarf des Nachfolgers
//      (lauf.js, nach dem Block).
// Seit der Etiketten-Bibliothek (BAUPLAN 48) bekommt auch ein EIGENES Etikett
// mit Feldern sein Werkzeug — Name und Form kommen aus der Registry
// (blockKatalog.eigenesEtikett), der Aufbau ist derselbe wie bei den festen.
import { z } from 'zod'
import { liste } from './werkzeugSchema.js'
import { texte } from '../../shared/texte.js'
import {
  RAHMEN_WERKZEUG,
  FESTE_TEILE,
  EINSTUFUNGEN,
  URTEILE,
  SCHWEREN,
  DATEI_ARTEN,
  artFuerWerkzeug,
  etikettFuerWerkzeug,
  eigenesEtikettFuerWerkzeug,
  rahmenEtikett,
  meldungPruefen
} from '../../shared/lieferschein.js'
import { etikettKlartext } from '../../shared/etikettRegeln.js'

// Der gemeinsame Rahmen — identisch in jedem Werkzeug.
function rahmenFelder() {
  const p = texte.lieferschein.param
  return {
    fazit: z.string().describe(p.fazit),
    getan: liste(z.string()).optional().describe(p.getan),
    offen: liste(z.string()).optional().describe(p.offen),
    anmerkung: z.string().optional().describe(p.anmerkung)
  }
}

function teilFelder(art) {
  const p = texte.lieferschein.param
  // Zuschnitt je benanntem Ziel (BAUPLAN 44): ALLE Pakete in EINEM Aufruf. Der
  // Sammel-Schlüssel der Meldungen ist (etikett, art) — bei mehreren Aufrufen
  // löschte der zweite den ersten, und von drei Paketen überlebte nur das
  // dritte. Ein Aufruf ist zugleich atomar: Er übersteht einen Übertrag mitten
  // in der Meldung.
  if (art === 'arbeitspaket')
    return {
      pakete: liste(
          z.object({
            zielBlock: z.string().optional().describe(p.zielBlock),
            // Kurzname je Ziel (Zwischenschritt 0.51.1): BEWUSST optional im
            // Schema, obwohl er bei benanntem Ziel Pflicht ist. Ein
            // Zod-Pflichtfeld bräche jede Meldung aus der Zeit davor mit einem
            // rohen Schema-Fehler — die Pflicht sitzt deshalb in Ebene 2
            // (lieferschein.zuschnittPruefen) und antwortet in Klartext.
            kurzname: z.string().optional().describe(p.kurzname),
            ziel: z.string().describe(p.ziel),
            fertigKriterien: liste(z.string()).describe(p.fertigKriterien),
            schritte: liste(z.string()).optional().describe(p.schritte),
            fundstellen: liste(z.string()).optional().describe(p.fundstellen),
            nichtDabei: liste(z.string()).optional().describe(p.nichtDabei),
            aufgabenIds: liste(z.string()).optional().describe(p.paketAufgabenIds),
            erlaubteDateien: liste(z.string()).optional().describe(p.erlaubteDateien),
            bausteine: liste(z.string()).optional().describe(p.bausteine),
            schnittstellen: liste(z.string()).optional().describe(p.schnittstellen)
          })
        )
        .describe(p.pakete)
    }
  if (art === 'pruefbeleg')
    return {
      urteil: z.enum(URTEILE).describe(p.urteil),
      beanstandungen: liste(
          z.object({
            text: z.string().describe(p.beanstandungText),
            einstufung: z.enum(EINSTUFUNGEN).describe(p.beanstandungEinstufung),
            fundort: z.string().optional().describe(p.fundort)
          })
        )
        .optional()
        .describe(p.beanstandungen),
      rotVorGruen: z.string().optional().describe(p.rotVorGruen),
      geprueft: liste(z.string()).optional().describe(p.geprueft),
      pruefkarteTitel: z.string().optional().describe(p.pruefkarteTitel),
      pruefkarteText: z.string().optional().describe(p.pruefkarteText)
    }
  if (art === 'umsetzungsbericht')
    return {
      kriterien: liste(
          z.object({
            kriterium: z.string().describe(p.kriterium),
            wieUmgesetzt: z.string().describe(p.wieUmgesetzt)
          })
        )
        .optional()
        .describe(p.kriterien),
      dateien: liste(
          z.object({
            pfad: z.string().describe(p.dateiPfad),
            art: z.enum(DATEI_ARTEN).describe(p.dateiArt)
          })
        )
        .optional()
        .describe(p.dateien),
      angriffsliste: liste(
          z.object({
            fund: z.string().describe(p.fund),
            umgang: z.string().describe(p.umgang)
          })
        )
        .optional()
        .describe(p.angriffsliste)
    }
  if (art === 'funde')
    return {
      funde: liste(
          z.object({
            text: z.string().describe(p.fundText),
            schwere: z.enum(SCHWEREN).describe(p.schwere),
            fundort: z.string().optional().describe(p.fundort)
          })
        )
        .describe(p.funde)
    }
  // Rahmen: bewusst locker — ein Freitext-Feld plus (nur bei mehreren
  // Lieferungen nötig) das Etikett.
  return {
    inhalt: z.string().optional().describe(p.inhalt),
    etikett: z.string().optional().describe(p.etikett)
  }
}

// Eigenes Etikett mit Feldern (BAUPLAN 48): die Form, die Georg in der
// Etiketten-Bibliothek gebaut hat, als Schema — Satz und mehrzeiliger Text als
// Zeichenkette, Liste als Zeichenketten-Liste, Auswahl ebenfalls als
// Zeichenkette mit den erlaubten Werten in der Beschreibung (K12): Die Werte
// prüft allein Ebene 2 (lieferschein.js), damit die Abweisung sichtbar im
// Ticker steht statt in einer stummen Schema-Ablehnung. Pflicht/optional
// steht im Schema, die Feldbeschreibung ist der Hinweis des Etiketts, sonst
// die Bezeichnung.
function eigeneFelder(etikett) {
  const te = texte.lieferscheinEtiketten
  const felder = {}
  for (const feld of etikett?.felder ?? []) {
    let schema = feld.art === 'liste' ? liste(z.string()) : z.string()
    if (!feld.pflicht) schema = schema.optional()
    // Bezeichnung voran, dann der Hinweis als Satz (Satzende ergänzen, sonst
    // klebt „Pflicht" an einen halben Satz) — der Agent sieht nur diesen Text.
    let beschreibung = feld.bezeichnung
    const hinweis = String(feld.hinweis ?? '').trim()
    if (hinweis) beschreibung += ': ' + hinweis + (/[.!?]$/.test(hinweis) ? '' : '.')
    else beschreibung += '.'
    if (feld.art === 'auswahl') beschreibung += ' ' + te.auswahlBeschreibung(feld.werte ?? [])
    if (feld.pflicht) beschreibung += te.pflichtZusatz
    felder[feld.schluessel] = schema.describe(beschreibung)
  }
  return felder
}

// holeBlock() liefert die Blockdefinition (liefert-Etiketten) des gerade
// laufenden Blocks; aufMeldung(meldung) reicht die geprüfte Meldung an die
// Lauf-Verwaltung weiter. holeZiele() liefert die benannten Ziele des laufenden
// Blocks (BAUPLAN 44) — gegen sie wird die Zieladresse eines Zuschnitts hart
// validiert, sonst träfe eine erfundene Adresse niemanden. holePaket() liefert
// die mit paket_melden gemeldeten Aufgaben-Karten (BAUPLAN 44) — gegen sie
// werden die aufgabenIds eines Zuschnitts hart geprüft, sonst wäre die
// Vollständigkeitsprüfung wieder ein Textvergleich.
export async function lieferscheinWerkzeugServer({
  werkzeuge,
  holeBlock,
  holeZiele = null,
  holePaket = null,
  aufMeldung,
  aufAbweisung = null
}) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const tl = texte.lieferschein

  // Eine abgewiesene Meldung steht im Ticker: Georg sieht, dass FlowForge
  // widersprochen hat, statt dass der Agent still ein zweites Mal ruft.
  function fehler(text) {
    aufAbweisung?.(text)
    return { content: [{ type: 'text', text }], isError: true }
  }

  // `teilSchema`: die Felder des Teils — fest je Art, bei einem eigenen
  // Etikett (BAUPLAN 48) aus seiner Form.
  function bauen(name, beschreibung, art, teilSchema = teilFelder(art)) {
    return tool(
      name,
      beschreibung,
      { ...rahmenFelder(), ...teilSchema },
      async (eingabe) => {
        const def = holeBlock?.() ?? null
        // Welches Etikett trägt diese Meldung? Beim festen Werkzeug ergibt es
        // sich aus dem Block, beim Rahmen aus seinem Feld (oder eindeutig).
        let etikett = null
        if (art === 'rahmen') {
          const zuordnung = rahmenEtikett(def, eingabe?.etikett)
          if (zuordnung.fehler) return fehler(zuordnung.fehler)
          etikett = zuordnung.etikett
        } else {
          etikett = etikettFuerWerkzeug(def, name)
          if (!etikett) return fehler(tl.etikettUnbekannt(name, def?.liefert ?? []))
        }
        // Das Umfeld reicht durch, was nur der Lauf weiß. Ein Schlüssel steht
        // nur drin, wenn der Lauf ihn liefern kann — fehlt er, prüft
        // lieferschein.js ihn gar nicht erst (Prüfskripte, selbstgebaute Wege).
        const ziele = holeZiele?.() ?? null
        const umfeld = {}
        if (ziele) umfeld.ziele = ziele
        if (holePaket) umfeld.paket = holePaket() ?? null
        const geprueft = meldungPruefen(
          art,
          eingabe,
          etikett,
          Object.keys(umfeld).length ? umfeld : null
        )
        if (geprueft.fehler) return fehler(geprueft.fehler)
        aufMeldung(geprueft.meldung)
        return { content: [{ type: 'text', text: tl.angenommen(etikett) }] }
      },
      { alwaysLoad: true }
    )
  }

  const gewuenscht = new Set(werkzeuge ?? [])
  const gebaut = []
  if (gewuenscht.has(RAHMEN_WERKZEUG))
    gebaut.push(bauen(RAHMEN_WERKZEUG, tl.werkzeuge.rahmen, 'rahmen'))
  for (const teil of Object.values(FESTE_TEILE)) {
    if (!gewuenscht.has(teil.werkzeug)) continue
    const schluessel = teil.werkzeug.replace(/^melde_/, '')
    gebaut.push(
      bauen(
        teil.werkzeug,
        tl.werkzeuge[schluessel] ?? tl.werkzeuge.rahmen,
        artFuerWerkzeug(teil.werkzeug)
      )
    )
  }
  // Eigene Etiketten mit Feldern (BAUPLAN 48): je gewünschtem Werkzeug, das
  // zu einem eigenen Etikett gehört, ein Werkzeug mit Rahmen plus seiner Form.
  // Die Beschreibung ist der Klartext, den auch Georg im Editor liest — so
  // liest der Agent genau das, was Georg beim Bauen gegengelesen hat (K14:
  // eigener Schlüssel, nicht tl.werkzeuge[…], sonst träfe ein Etikett „Eigen"
  // den Rahmen-Eintrag).
  const festeNamen = new Set([RAHMEN_WERKZEUG, ...Object.values(FESTE_TEILE).map((t) => t.werkzeug)])
  for (const name of gewuenscht) {
    if (festeNamen.has(name)) continue
    const eigen = eigenesEtikettFuerWerkzeug(name)
    if (!eigen) continue
    gebaut.push(
      bauen(
        name,
        texte.lieferscheinEtiketten.werkzeugEigen(eigen.name, etikettKlartext(eigen)),
        'eigen',
        eigeneFelder(eigen)
      )
    )
  }

  if (gebaut.length === 0) return null
  return createSdkMcpServer({
    name: 'lieferschein',
    version: '1.0.0',
    instructions: tl.serverHinweis,
    tools: gebaut
  })
}
