// Lieferschein-Werkzeuge (BAUPLAN 42): der einheitliche Rückkanal jedes Blocks.
// Ein Werkzeug je liefert-Etikett — beim Laufstart steht das Schaubild fest,
// also registriert FlowForge genau die Werkzeuge, die DIESE Kette braucht.
// Freigeschaltet ist je Block nur das zu seinem Etikett passende (pruefeWerkzeug
// im Motor); die anderen lösen die übliche Rechte-Rückfrage aus.
//
// Drei Durchsetzungs-Ebenen (BAUPLAN 42):
//   1. Schema — Struktur, Typen, Auswahlwerte (hier, über zod).
//   2. FlowForge im Code — Längen, Anzahl, Plausibilität (lieferschein.js).
//      Claudes strenger Schema-Modus kennt KEINE Längengrenzen, deshalb
//      reicht Ebene 1 nicht.
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
  if (art === 'arbeitspaket')
    return {
      ziel: z.string().describe(p.ziel),
      fertigKriterien: z.array(z.string()).describe(p.fertigKriterien),
      schritte: z.array(z.string()).optional().describe(p.schritte),
      fundstellen: z.array(z.string()).optional().describe(p.fundstellen),
      nichtDabei: z.array(z.string()).optional().describe(p.nichtDabei)
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
// Lauf-Verwaltung weiter.
export async function lieferscheinWerkzeugServer({
  werkzeuge,
  holeBlock,
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
        const geprueft = meldungPruefen(art, eingabe, etikett)
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
