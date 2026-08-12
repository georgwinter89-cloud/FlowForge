// KI-Assistent des Block-Editors (SPEC §4.5, BAUPLAN 14): Der Nutzer
// beschreibt in normaler Sprache, was der Block tun soll — die KI füllt das
// Formular aus. Der Vorschlag landet im Editor und bleibt dort von Hand
// änderbar; die harten Regeln greifen erst beim Speichern (eigeneBloecke.js).
import { app } from 'electron'
import { texte } from '../shared/texte.js'
import { bekannteEtiketten } from '../shared/blockKatalog.js'
import {
  BLOCK_NAME_MAX,
  BLOCK_BESCHREIBUNG_MAX,
  BLOCK_AUFTRAG_MAX,
  BLOCK_SYMBOL_MAX,
  BLOCK_SYMBOL_STANDARD,
  ETIKETT_MAX,
  ETIKETTEN_MAX
} from '../shared/blockRegeln.js'
import { einstellungenLaden, ABO_MODUS_ERLAUBT } from './einstellungen.js'
import { starteMotorFrage } from './motor/claudeCodeMotor.js'

// Das erste vollständige JSON-Objekt aus der Antwort ziehen — Motoren packen
// gern noch Erklärtext oder ```-Zäune drumherum.
function jsonAusText(text) {
  const anfang = text.indexOf('{')
  const ende = text.lastIndexOf('}')
  if (anfang === -1 || ende <= anfang) return null
  try {
    return JSON.parse(text.slice(anfang, ende + 1))
  } catch {
    return null
  }
}

// Vorschlag weichspülen statt ablehnen: Der Nutzer sieht und korrigiert alles
// im Formular — zu Langes wird gekappt, Unbrauchbares fällt weg.
function vorschlagSaeubern(roh) {
  const etiketten = (liste) =>
    (Array.isArray(liste) ? liste : [])
      .map((e) => String(e ?? '').trim().slice(0, ETIKETT_MAX))
      .filter((e, i, alle) => e && alle.indexOf(e) === i)
      .slice(0, ETIKETTEN_MAX)
  return {
    name: String(roh.name ?? '').trim().slice(0, BLOCK_NAME_MAX),
    symbol: String(roh.symbol ?? '').trim().slice(0, BLOCK_SYMBOL_MAX) || BLOCK_SYMBOL_STANDARD,
    beschreibung: String(roh.beschreibung ?? '').trim().slice(0, BLOCK_BESCHREIBUNG_MAX),
    auftrag: String(roh.auftrag ?? '').trim().slice(0, BLOCK_AUFTRAG_MAX),
    braucht: etiketten(roh.braucht),
    liefert: etiketten(roh.liefert),
    nurLesen: Boolean(roh.nurLesen)
  }
}

export async function blockVorschlagErstellen(beschreibung) {
  const wunsch = String(beschreibung ?? '').trim()
  if (!wunsch) return { ok: false, fehler: texte.blockEditor.fehlerBeschreibungFehlt }
  const { einstellungen } = einstellungenLaden()
  if (einstellungen.motorModus === 'abo' && !ABO_MODUS_ERLAUBT)
    return { ok: false, fehler: texte.lauf.aboNichtErlaubt }
  if (einstellungen.motorModus === 'api' && !einstellungen.apiSchluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }

  const antwort = await starteMotorFrage({
    frage: texte.agentenBlockAssistent.auftrag(wunsch, bekannteEtiketten()),
    modus: einstellungen.motorModus,
    apiSchluessel: einstellungen.apiSchluessel,
    ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
    // Neutraler Arbeitsordner — der Assistent gehört zu keinem Projekt.
    arbeitsOrdner: app.getPath('userData')
  })
  if (!antwort.ok) return antwort

  const roh = jsonAusText(antwort.text)
  if (!roh) return { ok: false, fehler: texte.blockEditor.fehlerKeinVorschlag }
  const vorschlag = vorschlagSaeubern(roh)
  if (!vorschlag.name || !vorschlag.auftrag)
    return { ok: false, fehler: texte.blockEditor.fehlerKeinVorschlag }
  return { ok: true, vorschlag }
}
