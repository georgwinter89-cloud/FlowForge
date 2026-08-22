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
import { liste } from './werkzeugSchema.js'
import { texte } from '../../shared/texte.js'
import {
  TITEL_MAX,
  TEXT_MAX,
  THEMA_MAX,
  vorhandeneThemen,
  kurzKennung,
  kennungenFuer,
  kennungAufloesen
} from '../../shared/kartenRegeln.js'
import { kartenLaden, karteAnlegen, karteAendern, karteErledigtSetzen } from '../projekte.js'

// Karten-Index (BAUPLAN 53): Höchstzahl der Kennungen je karten_lesen-Aufruf.
// Es ist der EINZIGE Deckel — einen zweiten auf der Zeichenzahl braucht es
// nicht: Der Kartentext ist FlowForges eigener und durch TEXT_MAX (400
// Zeichen) hart begrenzt, 25 Karten sind damit höchstens rund 12.500 Zeichen.
// (Anders als bei Fremdtext aus dem Netz, siehe webWerkzeuge.js.)
export const KARTEN_LESEN_MAX = 25

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

// Zwei Darstellungen, nicht eine (BAUPLAN 53): Der Blockauftrag und das
// Projektwissen der lokalen Helfer-KI brauchen den Volltext weiter — die
// Übersicht bekommt die kurze Zeile. Dieselbe Sortenmarke wie oben, nur
// ohne „: text": Der Index ist kein neues Format, es fällt nur der Text weg.
export function kartenIndexZeile(karte) {
  return `[${sorteMarke(karte)}] ${karte.titel}`
}

// Der Index, wie ihn karten_uebersicht ausliefert — als reine Funktion
// exportiert, damit die Regel-Prüfungen ihn ohne Motor fahren können.
// Sortierung und Kartenmenge bleiben unverändert (auch Prüfkarten stehen
// drin); die Themenzeile bleibt am Ende wie bisher.
export function uebersichtText(karten) {
  const alle = Array.isArray(karten) ? karten : []
  const kennung = kennungenFuer(alle)
  const zeilen = alle.map((k) => `- ${kennung.get(k.id) ?? kurzKennung(k.id)} · ${kartenIndexZeile(k)}`)
  const themen = vorhandeneThemen(alle)
  return (
    zeilen.join('\n') + (themen.length ? '\n\n' + texte.agentenKarten.themenZeile(themen) : '')
  )
}

// Der Volltext bestimmter Karten (karten_lesen) — ebenfalls rein, ebenfalls
// für die Prüfungen exportiert. Liefert { text, anzahl } oder { fehler }.
// Doppelte Kennungen fallen still heraus (auch Kurzform und volle id
// derselben Karte); eine unbekannte oder mehrdeutige Kennung ist dagegen eine
// ehrliche Ablehnung: Ein stilles Weglassen ließe den Agenten glauben, die
// Karte sei leer.
export function kartenLesenErgebnis(karten, ids) {
  const t = texte.agentenKarten
  const roh = (Array.isArray(ids) ? ids : []).map((id) => String(id ?? '').trim()).filter(Boolean)
  const gesehen = new Set()
  const eindeutig = []
  for (const eingabe of roh) {
    const schluessel = eingabe.toLowerCase()
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    eindeutig.push(eingabe)
  }
  if (eindeutig.length === 0) return { fehler: t.keineIds }
  // Der Deckel steht NUR hier, nicht im Schema (gemessen Prüfer 1): Ein
  // `liste(…, 25)` greift vor dem Handler und schickt dem Agenten englisches
  // Roh-JSON („Too big: expected array to have <=25 items") — der deutsche
  // Satz, der ihm sagt, was zu tun ist, käme nie an. Dieselbe Aufteilung wie
  // beim Lieferschein (lieferscheinWerkzeuge.js): Listen-Felder ohne
  // Schema-Deckel, die Grenze im Klartext. Gezählt wird nach dem Entdoppeln —
  // 26 Kennungen mit einer Dublette sind 25 Karten.
  if (eindeutig.length > KARTEN_LESEN_MAX)
    return { fehler: t.zuVieleIds(KARTEN_LESEN_MAX, eindeutig.length) }
  const treffer = []
  const schonDa = new Set()
  for (const eingabe of eindeutig) {
    const aufgeloest = kennungAufloesen(karten, eingabe)
    if (aufgeloest.fehler) return { fehler: aufgeloest.fehler }
    if (schonDa.has(aufgeloest.karte.id)) continue
    schonDa.add(aufgeloest.karte.id)
    treffer.push(aufgeloest.karte)
  }
  const kennung = kennungenFuer(karten)
  return {
    text: treffer
      .map((k) => `- ${kennung.get(k.id) ?? kurzKennung(k.id)} · ${kartenZeile(k)}`)
      .join('\n'),
    anzahl: treffer.length
  }
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
    texte.agentenKarten.uebersichtBeschreibung,
    {},
    async () => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return fehlerAntwort(geladen.fehler)
      return antwort(uebersichtText(geladen.karten))
    },
    { alwaysLoad: true }
  )

  // Die Ergänzung zur Übersicht (BAUPLAN 53): Sie nennt nur Titel, dieses
  // Werkzeug holt den Text der Karten, die der Agent wirklich braucht. Das
  // Listen-Feld bleibt bewusst OHNE Schema-Deckel — sonst lehnte zod ab, bevor
  // der Handler zu Wort kommt, und der Agent bekäme englisches Roh-JSON statt
  // des Satzes, der ihm sagt, wie er die Anfrage aufteilt (gemessen Prüfer 1).
  const lesen = tool(
    'karten_lesen',
    texte.agentenKarten.lesenBeschreibung(KARTEN_LESEN_MAX),
    {
      ids: liste(z.string()).describe(
        `Kennungen aus karten_uebersicht (Kurzform oder volle id), höchstens ${KARTEN_LESEN_MAX} je Aufruf`
      )
    },
    async ({ ids }) => {
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return fehlerAntwort(geladen.fehler)
      const ergebnis = kartenLesenErgebnis(geladen.karten, ids)
      // Kein Ticker-Eintrag hier: Lesen ändert nichts — die Zeile
      // („Liest N Karten im Volltext") setzt der Motor am Werkzeugaufruf,
      // wie bei der Übersicht auch.
      if (ergebnis.fehler) return fehlerAntwort(ergebnis.fehler)
      return antwort(ergebnis.text)
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
      // Die Kurz-Kennung gleich mitmelden (BAUPLAN 53): Der Agent will die
      // neue Karte oft sofort zuteilen oder melden — sonst müsste er dafür
      // die ganze Übersicht neu holen.
      return antwort(texte.agentenKarten.angelegt(karte, kurzKennung(karte.id)))
    },
    { alwaysLoad: true }
  )

  const aktualisieren = tool(
    'karte_aktualisieren',
    'Aktualisiert Titel und Inhalt einer bestehenden Karte (Kennung aus karten_uebersicht). ' +
      'Bei der Status-Karte bleibt der Titel fest — nur der Inhalt ist änderbar. ' +
      'Es gelten dieselben Längengrenzen wie beim Anlegen. Optional lässt sich das thema ' +
      'mitändern (z.B. bei einer alten Karte ohne Thema).',
    {
      id: z.string().describe('Kennung der Karte aus karten_uebersicht (Kurzform oder volle id)'),
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
      // Ab hier zählt nur noch die VOLLE id (BAUPLAN 53): Der Agent nennt die
      // Kurz-Kennung aus dem Index, gespeichert wird gegen die echte id —
      // sonst schriebe karteAendern still ins Leere.
      const aufgeloest = kennungAufloesen(geladen.karten, id)
      if (aufgeloest.fehler) return fehlerAntwort(aufgeloest.fehler)
      const bisher = aufgeloest.karte
      // Prüfkarten pflegt FlowForge selbst (BAUPLAN 18) — würde der Agent sie
      // umschreiben, passte der Kartentext nicht mehr zum aufbewahrten Archiv.
      if (bisher.sorte === 'pruefung')
        return abgelehnt(texte.kartenRegeln.pruefkarteNurFlowForge)
      const ergebnis = karteAendern(
        projektPfad,
        bisher.id,
        { titel: titel ?? bisher.titel, text, ...(thema !== undefined ? { thema } : {}) },
        herkunft()
      )
      if (!ergebnis.ok) return abgelehnt(ergebnis.fehler)
      const karte = ergebnis.karten.find((k) => k.id === bisher.id)
      melden(ergebnis.karten, texte.ticker.karteAktualisiert(karte.titel))
      return antwort(texte.agentenKarten.aktualisiert(karte, kurzKennung(karte.id)))
    },
    { alwaysLoad: true }
  )

  const erledigen = tool(
    'karte_erledigen',
    'Markiert eine Aufgaben-Karte als erledigt (oder öffnet sie mit erledigt=false wieder). ' +
      'Nur Aufgaben-Karten können erledigt werden.',
    {
      id: z
        .string()
        .describe('Kennung der Aufgaben-Karte aus karten_uebersicht (Kurzform oder volle id)'),
      erledigt: z
        .boolean()
        .optional()
        .describe('true = erledigt (Standard), false = wieder öffnen')
    },
    async ({ id, erledigt }) => {
      const wert = erledigt ?? true
      // Erst laden und auflösen (BAUPLAN 53), dann setzen: Bis hierher kam die
      // rohe Eingabe durch — eine Kurz-Kennung fände karteErledigtSetzen nicht
      // und meldete „unbekannt", obwohl die Karte im Index steht.
      const geladen = kartenLaden(projektPfad)
      if (!geladen.ok) return fehlerAntwort(geladen.fehler)
      const aufgeloest = kennungAufloesen(geladen.karten, id)
      if (aufgeloest.fehler) return fehlerAntwort(aufgeloest.fehler)
      const ergebnis = karteErledigtSetzen(projektPfad, aufgeloest.karte.id, wert, herkunft())
      if (!ergebnis.ok) return abgelehnt(ergebnis.fehler)
      const karte = ergebnis.karten.find((k) => k.id === aufgeloest.karte.id)
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
      'ausschließlich über diese Werkzeuge — niemals über direkte Dateizugriffe. ' +
      'karten_uebersicht zeigt das Verzeichnis (Kennung, Sorte, Thema, Titel — ohne Text), ' +
      'karten_lesen holt den Text der Karten, die du wirklich brauchst. Jede neue ' +
      'Karte bekommt ein Thema: bevorzugt ein vorhandenes, ein neues nur, wenn keines passt.',
    tools: [uebersicht, lesen, anlegen, aktualisieren, erledigen]
  })
}
