// KI-Assistent des Etikett-Editors (SPEC §4.5, BAUPLAN 48): Georg beschreibt
// in normaler Sprache, was unter einem Etikett gemeldet werden soll — die KI
// schlägt Name, Beschreibung und Felder vor. Der Vorschlag landet im Editor
// und bleibt dort von Hand änderbar; die harten Regeln greifen erst beim
// Speichern (eigeneEtiketten.js). Muster: blockAssistent.js (Einmal-Frage ohne
// Werkzeuge, billigstes Modell, neutraler Arbeitsordner).
import { app } from 'electron'
import { texte } from '../shared/texte.js'
import {
  ETIKETT_NAME_MAX,
  ETIKETT_BESCHREIBUNG_MAX,
  FELDER_MAX,
  FELD_BEZEICHNUNG_MAX,
  FELD_HINWEIS_MAX,
  FELD_ARTEN,
  AUSWAHL_WERTE_MAX,
  AUSWAHL_WERT_MAX,
  feldSchluesselBereinigen,
  auswahlWerteBereinigen
} from '../shared/etikettRegeln.js'
import { einstellungenLaden, motorBereit } from './einstellungen.js'
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

function einzeilig(wert, max) {
  return String(wert ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

// Vorschlag weichspülen statt ablehnen: Georg sieht und korrigiert alles im
// Formular — zu Langes wird gekappt, Unbrauchbares fällt weg, eine unbekannte
// Art wird zu „text", Auswahlwerte gibt es nur bei „auswahl". Das Ergebnis
// passt 1:1 in den Editor-State; pruefeEtikett nimmt es ohne Nacharbeit an
// (bis auf eine Auswahl mit zu wenigen Werten — die zeigt der Editor als
// Fehler, statt sie still zu verwerfen).
export function vorschlagSaeubern(roh) {
  const felder = []
  const belegt = new Set()
  for (const eintrag of Array.isArray(roh?.felder) ? roh.felder : []) {
    if (felder.length >= FELDER_MAX) break
    const bezeichnung = einzeilig(eintrag?.bezeichnung, FELD_BEZEICHNUNG_MAX)
    if (!bezeichnung) continue
    const schluessel = feldSchluesselBereinigen(bezeichnung)
    if (!schluessel || belegt.has(schluessel)) continue
    belegt.add(schluessel)
    const artRoh = String(eintrag?.art ?? '')
      .trim()
      .toLowerCase()
    const art = FELD_ARTEN.includes(artRoh) ? artRoh : 'text'
    const werte =
      art === 'auswahl'
        ? auswahlWerteBereinigen(eintrag?.werte)
            .map((w) => w.slice(0, AUSWAHL_WERT_MAX))
            .slice(0, AUSWAHL_WERTE_MAX)
        : []
    felder.push({
      schluessel,
      bezeichnung,
      art,
      werte,
      pflicht: Boolean(eintrag?.pflicht),
      hinweis: einzeilig(eintrag?.hinweis, FELD_HINWEIS_MAX)
    })
  }
  return {
    name: einzeilig(roh?.name, ETIKETT_NAME_MAX),
    beschreibung: einzeilig(roh?.beschreibung, ETIKETT_BESCHREIBUNG_MAX),
    felder
  }
}

// Die Feld-Arten mit Klartext-Namen — so kennt der Assistent die Bedeutung der
// Schlüssel (texte.etiketten.artNamen).
function artenFuerAssistent() {
  return FELD_ARTEN.map((schluessel) => ({
    schluessel,
    name: texte.etiketten.artNamen[schluessel] ?? schluessel
  }))
}

export async function etikettVorschlagErstellen({ beschreibung, name } = {}) {
  const wunsch = String(beschreibung ?? '').trim()
  if (!wunsch) return { ok: false, fehler: texte.etikettRegeln.fehlerBeschreibungFehlt }
  const { einstellungen } = einstellungenLaden()
  const bereit = motorBereit(einstellungen)
  if (!bereit.ok) return { ok: false, fehler: bereit.fehler }

  const antwort = await starteMotorFrage({
    frage: texte.agentenEtikettAssistent.auftrag(
      wunsch,
      String(name ?? '').trim(),
      artenFuerAssistent(),
      FELDER_MAX
    ),
    modus: einstellungen.motorModus,
    apiSchluessel: einstellungen.apiSchluessel,
    ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
    // Neutraler Arbeitsordner — der Assistent gehört zu keinem Projekt.
    arbeitsOrdner: app.getPath('userData')
  })
  if (!antwort.ok) return antwort

  const roh = jsonAusText(antwort.text)
  if (!roh) return { ok: false, fehler: texte.etikettRegeln.fehlerKeinVorschlag }
  const vorschlag = vorschlagSaeubern(roh)
  if (!vorschlag.name) return { ok: false, fehler: texte.etikettRegeln.fehlerKeinVorschlag }
  return { ok: true, vorschlag }
}
