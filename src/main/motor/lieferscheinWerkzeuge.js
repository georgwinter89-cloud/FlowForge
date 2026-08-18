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
import { z } from 'zod'
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
  rahmenEtikett,
  meldungPruefen
} from '../../shared/lieferschein.js'

// Der gemeinsame Rahmen — identisch in jedem Werkzeug.
function rahmenFelder() {
  const p = texte.lieferschein.param
  return {
    fazit: z.string().describe(p.fazit),
    getan: z.array(z.string()).optional().describe(p.getan),
    offen: z.array(z.string()).optional().describe(p.offen),
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
      pakete: z
        .array(
          z.object({
            zielBlock: z.string().optional().describe(p.zielBlock),
            ziel: z.string().describe(p.ziel),
            fertigKriterien: z.array(z.string()).describe(p.fertigKriterien),
            schritte: z.array(z.string()).optional().describe(p.schritte),
            fundstellen: z.array(z.string()).optional().describe(p.fundstellen),
            nichtDabei: z.array(z.string()).optional().describe(p.nichtDabei),
            aufgabenIds: z.array(z.string()).optional().describe(p.paketAufgabenIds),
            erlaubteDateien: z.array(z.string()).optional().describe(p.erlaubteDateien),
            bausteine: z.array(z.string()).optional().describe(p.bausteine),
            schnittstellen: z.array(z.string()).optional().describe(p.schnittstellen)
          })
        )
        .describe(p.pakete)
    }
  if (art === 'pruefbeleg')
    return {
      urteil: z.enum(URTEILE).describe(p.urteil),
      beanstandungen: z
        .array(
          z.object({
            text: z.string().describe(p.beanstandungText),
            einstufung: z.enum(EINSTUFUNGEN).describe(p.beanstandungEinstufung),
            fundort: z.string().optional().describe(p.fundort)
          })
        )
        .optional()
        .describe(p.beanstandungen),
      rotVorGruen: z.string().optional().describe(p.rotVorGruen),
      geprueft: z.array(z.string()).optional().describe(p.geprueft),
      pruefkarteTitel: z.string().optional().describe(p.pruefkarteTitel),
      pruefkarteText: z.string().optional().describe(p.pruefkarteText)
    }
  if (art === 'umsetzungsbericht')
    return {
      kriterien: z
        .array(
          z.object({
            kriterium: z.string().describe(p.kriterium),
            wieUmgesetzt: z.string().describe(p.wieUmgesetzt)
          })
        )
        .optional()
        .describe(p.kriterien),
      dateien: z
        .array(
          z.object({
            pfad: z.string().describe(p.dateiPfad),
            art: z.enum(DATEI_ARTEN).describe(p.dateiArt)
          })
        )
        .optional()
        .describe(p.dateien),
      angriffsliste: z
        .array(
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
      funde: z
        .array(
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

  function bauen(name, beschreibung, art) {
    return tool(
      name,
      beschreibung,
      { ...rahmenFelder(), ...teilFelder(art) },
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

  if (gebaut.length === 0) return null
  return createSdkMcpServer({
    name: 'lieferschein',
    version: '1.0.0',
    instructions: tl.serverHinweis,
    tools: gebaut
  })
}
