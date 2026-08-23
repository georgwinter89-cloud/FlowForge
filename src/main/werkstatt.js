// Werkstatt (Bauschritt 54): der Tab, der die lokale KI live zeigt und wirklich
// misst — und die Stelle, an der die Zählstellen aller laufenden Motoren
// zusammenkommen.
//
// Zwei Ansichten, zwei Datenquellen — bewusst getrennt, weil sie ganz
// verschieden teuer sind:
//
//  1. OHNE LAUF — Zustand der Rechner (Entscheidung Georg): je Ollama-Adresse
//     erreichbar? welches Modell liegt geladen? passt es auf die Karte? liegt
//     das abgeleitete `flowforge-<basis>` überhaupt vor? Das sind echte
//     Anfragen an fremde Rechner und kosten Netz. Damit beantwortet FlowForge
//     VOR dem Start die Frage „kann ich jetzt lokal bauen"; heute erfährt Georg
//     das erst mitten im Lauf im Ticker.
//
//  2. WÄHREND EINES LAUFS — je arbeitendem lokalen Block: Adresse, Modell,
//     Laufzeit, Tokens hinein und heraus (gemessen), Tokens je Sekunde und der
//     Füllstand gemessen NEBEN geschätzt. Das kostet gar nichts: Die Zahlen
//     liegen im eigenen Prozess, weil der Verkehr ohnehin durch die Zählstelle
//     läuft.
//
// Kein Electron hier — die Einstellungen reicht der Aufrufer (index.js) herein.
// So bleibt das Modul einzeln erprobbar, wie es die Bauplan-Regel verlangt.
import { lokaleHelferPruefen } from './motor/lokaleHelfer.js'
import { ollamaSpeicherStand } from './motor/lokalerSpeicher.js'
import { lokalesModellName, vramProzent } from '../shared/lokalRegeln.js'

// ---------------------------------------------------------------------------
// Register der laufenden Zählstellen
// ---------------------------------------------------------------------------
// Wer sich anmeldet, meldet sich auch wieder ab — die Rückgabe von
// `werkstattAnmelden` IST die Abmeldung. Gehalten wird eine Funktion, kein
// eingefrorener Wert: Der Stand ändert sich mit jeder Antwort, und die
// Werkstatt fragt ihn ab, wenn jemand hinsieht.
const angemeldet = new Set()

export function werkstattAnmelden(eintrag) {
  const platz = { holeStand: eintrag?.holeStand }
  if (typeof platz.holeStand !== 'function') return () => {}
  angemeldet.add(platz)
  return () => angemeldet.delete(platz)
}

// Der Stand aller angemeldeten Zählstellen. Eine Zählstelle, deren Stand sich
// nicht abfragen lässt, fällt still heraus statt die ganze Ansicht zu kippen —
// ein Messinstrument darf nie mehr kaputtmachen, als es misst.
export function werkstattStand() {
  const stellen = []
  for (const platz of angemeldet) {
    try {
      const stand = platz.holeStand()
      if (stand) stellen.push(stand)
    } catch {
      // still übergehen
    }
  }
  // Jüngste zuerst: Was gerade arbeitet, steht oben.
  stellen.sort((a, b) => (b.beginn ?? 0) - (a.beginn ?? 0))
  return { stellen }
}

// Nur für Prüfungen und den geordneten App-Schluss: Das Register leeren.
export function werkstattRegisterLeeren() {
  angemeldet.clear()
}

// ---------------------------------------------------------------------------
// Zustand der Rechner (ohne Lauf)
// ---------------------------------------------------------------------------
// Ehrlichkeit wie bei `ollamaSpeicherStand`: Eine Frage, die sich nicht
// beantworten lässt, wird als „nicht beantwortbar" gemeldet — nie geraten. Eine
// Warnung aus einer misslungenen Messung wäre ein Fehlalarm, und Georg würde
// daraufhin genau die Einstellung verstellen, die richtig war.
const PS_ZEITGRENZE_MS = 4000

async function prozesslisteHolen(adresse) {
  try {
    const antwort = await fetch(String(adresse).replace(/\/+$/, '') + '/api/ps', {
      signal: AbortSignal.timeout(PS_ZEITGRENZE_MS)
    })
    if (!antwort.ok) return null
    const daten = await antwort.json()
    return Array.isArray(daten?.models) ? daten.models : null
  } catch {
    return null
  }
}

// Ein Eintrag je Adresse. `basisModell` ist Georgs eingestelltes Ollama-Modell,
// `abgeleitet` der daraus gebaute Name `flowforge-<basis>` — die Werkstatt
// fragt beides, weil ein lokaler Lauf beides braucht: das Basis-Modell, damit
// FlowForge daraus ableiten kann, und das abgeleitete, damit der Block ohne
// Wartezeit startet.
export async function rechnerZustand({ adressen = [], basisModell = '' } = {}) {
  const basis = String(basisModell ?? '').trim()
  const abgeleitet = basis ? lokalesModellName(basis) : ''
  const liste = await Promise.all(
    (Array.isArray(adressen) ? adressen : [])
      .filter((a) => typeof a === 'string' && a.trim())
      .map(async (adresse) => {
        const status = await lokaleHelferPruefen(basis, adresse)
        if (!status.erreichbar)
          return {
            adresse,
            erreichbar: false,
            basisDa: false,
            abgeleitetDa: false,
            geladen: [],
            speicher: null
          }
        const namen = Array.isArray(status.modelle) ? status.modelle : []
        const abgeleitetDa = abgeleitet
          ? namen.some((n) => n === abgeleitet || n === abgeleitet + ':latest')
          : false
        // Was liegt gerade geladen? Ollamas Prozessliste sagt es — und
        // gleichzeitig, wie viel davon in der Grafikkarte liegt.
        const prozesse = await prozesslisteHolen(adresse)
        const geladen = (prozesse ?? []).map((m) => ({
          name: String(m?.name ?? m?.model ?? ''),
          anteil: anteilAus(m)
        }))
        // Der VRAM-Befund für das abgeleitete Modell — dieselbe Rechnung wie
        // die Warnzeile im Ticker (0.51.3), damit Tab und Lauf nie zwei
        // verschiedene Wahrheiten erzählen.
        const speicher = abgeleitet
          ? await ollamaSpeicherStand({ adresse, modell: abgeleitet })
          : { ok: false }
        return {
          adresse,
          erreichbar: true,
          basisDa: Boolean(status.modellDa),
          abgeleitetDa,
          // Prozessliste nicht erreichbar heißt „nicht beantwortbar", nicht
          // „nichts geladen" — deshalb null statt einer leeren Liste.
          geladen: prozesse === null ? null : geladen,
          speicher: speicher.ok
            ? { ok: true, anteil: speicher.anteil, prozent: vramProzent(speicher.anteil), passt: speicher.passt }
            : { ok: false }
        }
      })
  )
  return { basisModell: basis, abgeleitetesModell: abgeleitet, adressen: liste }
}

// Der komplette Weg, den der Werkstatt-Tab geht: Einstellungen lesen, daraus
// Adressen und Modell nehmen, die Rechner fragen.
//
// Bewusst als eigene Funktion mit dem LADER als Parameter, nicht als drei
// Zeilen im IPC-Handler: Genau diese drei Zeilen waren im ersten Anlauf falsch
// (`einstellungenLaden()` liefert `{ ok, einstellungen, … }` — die Werte liegen
// eine Ebene tiefer). Der Tab sagte daraufhin „keine Ollama-Adresse
// eingetragen", obwohl drei eingetragen waren, und keine Prüfung konnte es
// sehen, weil die Zusammensetzung im Handler wohnte. Jetzt wohnt sie hier und
// wird mit dem echten Lader gefahren.
export async function rechnerZustandFuerEinstellungen(laden) {
  const { einstellungen: e } = laden()
  const adressen = Array.isArray(e?.lokaleHelferAdressen) ? e.lokaleHelferAdressen : []
  return {
    ok: true,
    aktiv: Boolean(e?.lokaleHelferAktiv),
    blockAgent: Boolean(e?.lokalBlockAgent),
    kontext: Number(e?.lokaleHelferKontext) || 0,
    ...(await rechnerZustand({ adressen, basisModell: e?.lokaleHelferModell }))
  }
}

function anteilAus(eintrag) {
  const gesamt = Number(eintrag?.size)
  const imVram = Number(eintrag?.size_vram)
  if (!Number.isFinite(gesamt) || gesamt <= 0) return null
  if (!Number.isFinite(imVram) || imVram < 0) return null
  return Math.min(1, imVram / gesamt)
}
