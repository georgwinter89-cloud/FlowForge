// App-Werkzeuge des Co-Piloten (BAUPLAN 33, SPEC §6/§8): app_starten,
// app_stoppen, app_neustarten, app_ausgabe bedienen den App-Tab — es ist
// derselbe Prozess, den der Nutzer im Tab sieht (Entscheidung Georg): er
// überlebt das Chat-Schließen und wird nicht von der Prozess-Hygiene der Läufe
// abgeräumt. Ein per Befehl gestarteter Server würde dagegen den Aufruf
// blockieren und beim nächsten Lauf sterben. Die Rechte entscheidet
// pruefeWerkzeug (Ausgabe lesen frei; Starten/Stoppen im Reparatur-Modus frei,
// sonst Rückfrage; Port freimachen fragt immer).
import { z } from 'zod'
import { texte } from '../../shared/texte.js'

const AUSGABE_STANDARD = 4000
const AUSGABE_MAX = 20000
// Nach Start/Neustart kurz warten, damit die ersten Zeilen der App schon in
// der Antwort stehen (Fehler beim Hochfahren sieht der Chat so sofort).
const ANLAUF_MS = 1500

function zustandsText(z) {
  const ta = texte.app
  if (!z || z.zustand === 'aus') return ta.zustandAus
  if (z.zustand === 'startet') return ta.zustandStartet
  if (z.zustand === 'laeuft') return ta.zustandLaeuft(new Date(z.gestartetAm).toLocaleTimeString('de-DE'))
  if (z.zustand === 'nur-adresse') return ta.zustandNurAdresse
  if (z.gestoppt) return ta.zustandGestoppt(new Date(z.beendetAm).toLocaleTimeString('de-DE'))
  return ta.zustandBeendet(z.code, new Date(z.beendetAm).toLocaleTimeString('de-DE'))
}

function ausgabeSchwanz(ausgabe, zeichen) {
  const text = String(ausgabe ?? '')
  const n = Math.min(AUSGABE_MAX, Math.max(200, Number(zeichen) || AUSGABE_STANDARD))
  return text.length > n ? '…' + text.slice(-n) : text
}

export async function appWerkzeugServer({ projektPfad, aufEreignis }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  // Erst hier laden: appProzess.js braucht Electron (Fenster, Shell) — die
  // Regel-Prüfungen laden diese Datei ohne Electron.
  const { appStarten, appStoppen, appNeustarten, appZustand } = await import('../appProzess.js')
  const tw = texte.agentenApp

  function antwort(text, isError = false) {
    return { content: [{ type: 'text', text }], isError }
  }

  async function nachAnlauf(vorspann) {
    await new Promise((r) => setTimeout(r, ANLAUF_MS))
    const z = appZustand(projektPfad)
    return antwort(
      `${vorspann}\n${tw.zustand(zustandsText(z))}\n${tw.ausgabe(ausgabeSchwanz(z.ausgabe, AUSGABE_STANDARD))}`
    )
  }

  const starten = tool(
    'app_starten',
    tw.startenBeschreibung,
    {
      port_freimachen: z
        .boolean()
        .optional()
        .describe(tw.portFreimachenParam)
    },
    async ({ port_freimachen }) => {
      const ergebnis = await appStarten(projektPfad, { portFreimachen: Boolean(port_freimachen) })
      if (!ergebnis.ok) {
        if (ergebnis.portBelegt) {
          const b = ergebnis.portBelegt
          aufEreignis({ art: 'ticker', text: texte.ticker.appPortBelegt(b.port) })
          return antwort(tw.portBelegt(b.port, b.name, b.pid, b.befehl), true)
        }
        aufEreignis({ art: 'ticker', text: texte.ticker.appStartFehler(ergebnis.fehler) })
        return antwort(ergebnis.fehler, true)
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.appGestartet })
      return nachAnlauf(tw.gestartet)
    },
    { alwaysLoad: true }
  )

  const stoppen = tool(
    'app_stoppen',
    tw.stoppenBeschreibung,
    {},
    async () => {
      await appStoppen(projektPfad)
      aufEreignis({ art: 'ticker', text: texte.ticker.appGestoppt })
      const z = appZustand(projektPfad)
      return antwort(`${tw.gestoppt}\n${tw.zustand(zustandsText(z))}`)
    },
    { alwaysLoad: true }
  )

  const neustarten = tool(
    'app_neustarten',
    tw.neustartenBeschreibung,
    {},
    async () => {
      const ergebnis = await appNeustarten(projektPfad)
      if (!ergebnis.ok) {
        if (ergebnis.portBelegt) {
          const b = ergebnis.portBelegt
          return antwort(tw.portBelegt(b.port, b.name, b.pid, b.befehl), true)
        }
        aufEreignis({ art: 'ticker', text: texte.ticker.appStartFehler(ergebnis.fehler) })
        return antwort(ergebnis.fehler, true)
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.appNeuGestartet })
      return nachAnlauf(tw.neuGestartet)
    },
    { alwaysLoad: true }
  )

  const ausgabe = tool(
    'app_ausgabe',
    tw.ausgabeBeschreibung,
    {
      zeichen: z.number().int().optional().describe(tw.zeichenParam(AUSGABE_STANDARD, AUSGABE_MAX))
    },
    async ({ zeichen }) => {
      const z = appZustand(projektPfad)
      const text = ausgabeSchwanz(z.ausgabe, zeichen)
      return antwort(
        `${tw.zustand(zustandsText(z))}\n${text ? tw.ausgabe(text) : tw.keineAusgabe}`
      )
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'app',
    version: '1.0.0',
    instructions: tw.anweisungen,
    tools: [starten, stoppen, neustarten, ausgabe]
  })
}
