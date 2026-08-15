// Agent-Karten-Brücke (BAUPLAN 7): Werkzeuge, mit denen der Agent Projektkarten
// liest und schreibt — im selben Prozess wie FlowForge, über dieselben Funktionen
// und mit denselben harten Regeln wie für Menschen (Längengrenze, genau eine
// Status-Karte, Themen-Pflicht). Jede Änderung wird im Liveticker sichtbar und
// sofort an die Oberfläche gemeldet.
//
// Herkunft (BAUPLAN 30): holeHerkunft() liefert, wer gerade schreibt (Block,
// Lauf, Paket-Aufgaben bzw. der Chat) — FlowForge stempelt damit jede angelegte
// oder geänderte Karte. Ohne Hol-Funktion gilt „vom Nutzer".
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { TITEL_MAX, TEXT_MAX, THEMA_MAX, vorhandeneThemen } from '../../shared/kartenRegeln.js'
import { kartenLaden, karteAnlegen, karteAendern, karteErledigtSetzen } from '../projekte.js'

function antwort(text) {
  return { content: [{ type: 'text', text }] }
}

function fehlerAntwort(text) {
  return { content: [{ type: 'text', text }], isError: true }
}

function sorteMarke(karte) {
  const sorte = texte.karten.sorten[karte.sorte] ?? karte.sorte
  const teile = [sorte]
  if (karte.sorte === 'aufgabe') teile.push(karte.erledigt ? texte.karten.erledigt : texte.karten.offen)
  // Themen (BAUPLAN 30) stehen in Übersicht und Auftrag — so kann der Agent
  // neue Karten einsortieren. Die Herkunft dagegen nie (Kontext).
  if (karte.thema) teile.push(texte.karten.themaMarke(karte.thema))
  return teile.join(' · ')
}

export function kartenZeile(karte) {
  return `[${sorteMarke(karte)}] ${karte.titel}: ${karte.text}`
}

// Baut den In-Prozess-Werkzeugkasten „karten" für einen Motor-Lauf.
export async function kartenWerkzeugServer({ projektPfad, aufEreignis, holeHerkunft = null }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')

  function herkunft() {
    return holeHerkunft?.() ?? undefined
  }

  // Erfolgreiche Änderung: Oberfläche sofort aktualisieren + Ticker-Zeile.
  function melden(karten, tickerText) {
    aufEreignis({ art: 'karten', karten })
    aufEreignis({ art: 'ticker', text: tickerText })
  }

  function abgelehnt(fehler) {
    aufEreignis({ art: 'ticker', text: texte.ticker.karteAbgelehnt(fehler) })
    return fehlerAntwort(fehler)
  }

  const uebersicht = tool(
    'karten_uebersicht',
    'Listet alle Projektkarten von FlowForge auf (Status, Aufgaben, Entscheidungen, Wissen, ' +
      'Prüfungen), mit der id für die anderen Karten-Werkzeuge und dem Thema jeder Karte.',
    {},
    async () => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return fehlerAntwort(geladen.fehler)
      const zeilen = geladen.karten.map((k) => `- id ${k.id} · ${kartenZeile(k)}`)
      const themen = vorhandeneThemen(geladen.karten)
      return antwort(
        zeilen.join('\n') + (themen.length ? '\n\n' + texte.agentenKarten.themenZeile(themen) : '')
      )
    },
    { alwaysLoad: true }
  )

  const anlegen = tool(
    'karte_anlegen',
    `Legt eine neue Projektkarte an. Harte Regeln: Titel höchstens ${TITEL_MAX} Zeichen, ` +
      `Inhalt höchstens ${TEXT_MAX} Zeichen — wer mehr zu sagen hat, legt mehrere fokussierte ` +
      'Karten an. Jede Karte braucht ein thema (kurzes Schlagwort zum Einsortieren): nimm ' +
      'bevorzugt ein vorhandenes Thema aus deinem Auftrag oder karten_uebersicht, ein neues ' +
      'nur, wenn keines passt. Eine Status-Karte kann nicht angelegt werden (es gibt genau eine).',
    {
      sorte: z
        .enum(['aufgabe', 'entscheidung', 'wissen'])
        .describe('Sorte der Karte: aufgabe, entscheidung oder wissen'),
      titel: z.string().describe(`Titel, höchstens ${TITEL_MAX} Zeichen`),
      text: z.string().describe(`Inhalt, höchstens ${TEXT_MAX} Zeichen (3–5 Sätze)`),
      // Bewusst optional im Schema, hart durchgesetzt im Handler: So bekommt der
      // Agent bei fehlendem Thema unsere Ablehnung samt Themenliste statt eines
      // nackten Schema-Fehlers (Rettungsanker, BAUPLAN 30).
      thema: z
        .string()
        .optional()
        .describe(
          `Thema (Pflicht): kurzes Schlagwort, höchstens ${THEMA_MAX} Zeichen — bevorzugt ein vorhandenes`
        )
    },
    async ({ sorte, titel, text, thema }) => {
      const ergebnis = karteAnlegen(projektPfad, { sorte, titel, text, thema }, herkunft())
      if (!ergebnis.ok) return abgelehnt(ergebnis.fehler)
      const karte = ergebnis.karten[ergebnis.karten.length - 1]
      melden(ergebnis.karten, texte.ticker.karteAngelegt(karte.titel))
      return antwort(texte.agentenKarten.angelegt(karte))
    },
    { alwaysLoad: true }
  )

  const aktualisieren = tool(
    'karte_aktualisieren',
    'Aktualisiert Titel und Inhalt einer bestehenden Karte (id aus karten_uebersicht). ' +
      'Bei der Status-Karte bleibt der Titel fest — nur der Inhalt ist änderbar. ' +
      'Es gelten dieselben Längengrenzen wie beim Anlegen. Optional lässt sich das thema ' +
      'mitändern (z.B. bei einer alten Karte ohne Thema).',
    {
      id: z.string().describe('id der Karte aus karten_uebersicht'),
      titel: z
        .string()
        .optional()
        .describe('Neuer Titel; weglassen, um den bisherigen Titel zu behalten'),
      text: z.string().describe(`Neuer Inhalt, höchstens ${TEXT_MAX} Zeichen`),
      thema: z
        .string()
        .optional()
        .describe(`Neues Thema (höchstens ${THEMA_MAX} Zeichen); weglassen, um das bisherige zu behalten`)
    },
    async ({ id, titel, text, thema }) => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return fehlerAntwort(geladen.fehler)
      const bisher = geladen.karten.find((k) => k.id === id)
      if (!bisher) return fehlerAntwort(texte.agentenKarten.unbekannteId(id))
      // Prüfkarten pflegt FlowForge selbst (BAUPLAN 18) — würde der Agent sie
      // umschreiben, passte der Kartentext nicht mehr zum aufbewahrten Archiv.
      if (bisher.sorte === 'pruefung')
        return abgelehnt(texte.kartenRegeln.pruefkarteNurFlowForge)
      const ergebnis = karteAendern(
        projektPfad,
        id,
        { titel: titel ?? bisher.titel, text, ...(thema !== undefined ? { thema } : {}) },
        herkunft()
      )
      if (!ergebnis.ok) return abgelehnt(ergebnis.fehler)
      const karte = ergebnis.karten.find((k) => k.id === id)
      melden(ergebnis.karten, texte.ticker.karteAktualisiert(karte.titel))
      return antwort(texte.agentenKarten.aktualisiert(karte))
    },
    { alwaysLoad: true }
  )

  const erledigen = tool(
    'karte_erledigen',
    'Markiert eine Aufgaben-Karte als erledigt (oder öffnet sie mit erledigt=false wieder). ' +
      'Nur Aufgaben-Karten können erledigt werden.',
    {
      id: z.string().describe('id der Aufgaben-Karte aus karten_uebersicht'),
      erledigt: z
        .boolean()
        .optional()
        .describe('true = erledigt (Standard), false = wieder öffnen')
    },
    async ({ id, erledigt }) => {
      const wert = erledigt ?? true
      const ergebnis = karteErledigtSetzen(projektPfad, id, wert, herkunft())
      if (!ergebnis.ok) return abgelehnt(ergebnis.fehler)
      const karte = ergebnis.karten.find((k) => k.id === id)
      melden(
        ergebnis.karten,
        wert ? texte.ticker.aufgabeErledigt(karte.titel) : texte.ticker.aufgabeGeoeffnet(karte.titel)
      )
      return antwort(texte.agentenKarten.erledigtGesetzt(karte, wert))
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'karten',
    version: '1.0.0',
    instructions:
      'Projektkarten sind das Gedächtnis dieses FlowForge-Projekts. Lies und schreibe sie ' +
      'ausschließlich über diese Werkzeuge — niemals über direkte Dateizugriffe. Jede neue ' +
      'Karte bekommt ein Thema: bevorzugt ein vorhandenes, ein neues nur, wenn keines passt.',
    tools: [uebersicht, anlegen, aktualisieren, erledigen]
  })
}
