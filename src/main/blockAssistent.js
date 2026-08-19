// KI-Assistent des Block-Editors (SPEC §4.5, BAUPLAN 14): Der Nutzer
// beschreibt in normaler Sprache, was der Block tun soll — die KI füllt das
// Formular aus. Der Vorschlag landet im Editor und bleibt dort von Hand
// änderbar; die harten Regeln greifen erst beim Speichern (eigeneBloecke.js).
//
// Seit BAUPLAN 48 schlägt die KI auch die Kennzeichen des Blocks vor (prueft,
// kartenZuteilung, …) und begründet jedes gesetzte in Folgen-Sprache — der
// Editor zeigt den Satz neben dem Häkchen. Dazu brauchtOptional und bis zu
// drei Formularfelder. Name und Hinweis je Kennzeichen kommen aus derselben
// texte-Quelle wie im Editor (texte.blockEditor.kennzeichen).
import { app } from 'electron'
import { texte } from '../shared/texte.js'
import {
  bekannteEtiketten,
  BEREICHE,
  BEREICH_EIGENE,
  MODELL_KLASSEN,
  MODELL_KLASSE_STANDARD,
  modellKlasseGueltig
} from '../shared/blockKatalog.js'
import {
  BLOCK_NAME_MAX,
  BLOCK_BESCHREIBUNG_MAX,
  BLOCK_AUFTRAG_MAX,
  BLOCK_SYMBOL_MAX,
  BLOCK_SYMBOL_STANDARD,
  ETIKETT_MAX,
  ETIKETTEN_MAX,
  FORMULARFELDER_MAX,
  FELD_LABEL_MAX,
  FELD_PLATZHALTER_MAX,
  KENNZEICHEN,
  feldIdBereinigen,
  kennzeichenAngleichen
} from '../shared/blockRegeln.js'
import { einstellungenLaden, motorBereit } from './einstellungen.js'
import { starteMotorFrage } from './motor/claudeCodeMotor.js'

// Begründung je Kennzeichen (BAUPLAN 48): ein Satz, der neben dem Häkchen
// steht — länger wäre kein Satz mehr.
export const KI_BEGRUENDUNG_MAX = 200

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
// im Formular — zu Langes wird gekappt, Unbrauchbares fällt weg. Das Ergebnis
// passt 1:1 in den Editor-State (flache Kennzeichen wie im gespeicherten
// Block) und ist so gebaut, dass pruefeEigenenBlock es annimmt.
export function vorschlagSaeubern(roh) {
  const etiketten = (liste) =>
    (Array.isArray(liste) ? liste : [])
      .map((e) => String(e ?? '').trim().slice(0, ETIKETT_MAX))
      .filter((e, i, alle) => e && alle.indexOf(e) === i)
      .slice(0, ETIKETTEN_MAX)
  const braucht = etiketten(roh.braucht)
  // brauchtOptional (BAUPLAN 48) wie braucht — ohne die Etiketten, die schon
  // Pflicht sind (ein Etikett ist entweder Pflicht oder „falls da").
  const brauchtOptional = etiketten(roh.brauchtOptional).filter((e) => !braucht.includes(e))

  // Kennzeichen (BAUPLAN 48): alle als Boolean. Die KI liefert sie im Objekt
  // `kennzeichen`; ein flaches Feld (nurLesen/fuehrtZusammen wie vor 48) zählt
  // als Rückfall, damit auch eine ältere Antwortform nicht still verloren geht.
  const kennzeichen = {}
  for (const { schluessel } of KENNZEICHEN)
    kennzeichen[schluessel] = Boolean(roh.kennzeichen?.[schluessel] ?? roh[schluessel])
  // Führt zusammen ohne braucht liefe ins Leere — die harte Regel lehnte den
  // Block ab, der Nutzer sähe nur einen Fehler. Säubern statt ablehnen.
  if (braucht.length === 0) kennzeichen.fuehrtZusammen = false

  // Formularfelder (BAUPLAN 48): höchstens drei, id aus dem Label abgeleitet
  // (eine mitgelieferte id wird bereinigt), doppelte ids fallen weg.
  const felder = []
  for (const eintrag of Array.isArray(roh.felder) ? roh.felder : []) {
    if (felder.length >= FORMULARFELDER_MAX) break
    const label = String(eintrag?.label ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, FELD_LABEL_MAX)
    const id = feldIdBereinigen(String(eintrag?.id ?? '').trim() || label)
    if (!label || !id || felder.some((f) => f.id === id)) continue
    felder.push({
      id,
      label,
      platzhalter: String(eintrag?.platzhalter ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, FELD_PLATZHALTER_MAX),
      pflicht: Boolean(eintrag?.pflicht)
    })
  }
  // Korrektur K20: Ein Feld, dessen {{id}} im Auftrag fehlt, bekommt eine
  // angehängte Zeile „Label: {{id}}" — nie still verwerfen; sonst tippte man
  // es ein, und nichts passierte damit. Ein fremdes {{x}} im Auftrag bleibt
  // stehen (Editor-Hinweis, K6).
  let auftrag = String(roh.auftrag ?? '').trim()
  const nachtrag = felder
    .filter((f) => !auftrag.includes('{{' + f.id + '}}'))
    .map((f) => `${f.label}: {{${f.id}}}`)
    .join('\n')
  if (nachtrag) {
    auftrag = auftrag.slice(0, Math.max(0, BLOCK_AUFTRAG_MAX - nachtrag.length - 2)).trimEnd()
    auftrag = auftrag ? auftrag + '\n\n' + nachtrag : nachtrag
  }
  auftrag = auftrag.slice(0, BLOCK_AUFTRAG_MAX)

  // Komfort-Angleichung wie beim Anhaken im Editor: prueft ⇒ nurLesen aus und
  // „Prüfbeleg" in liefert usw. — damit der Vorschlag speicherbar ist.
  const liefertRoh = etiketten(roh.liefert)
  const angeglichen = kennzeichenAngleichen({ ...kennzeichen, liefert: liefertRoh })
  // Die ergänzten Pflicht-Etiketten gewinnen gegen die Obergrenze — sonst
  // fiele genau das Etikett weg, ohne das der Block nicht speicherbar ist.
  const ergaenzt = angeglichen.liefert.filter((e) => !liefertRoh.includes(e))
  const liefert = [...liefertRoh.slice(0, ETIKETTEN_MAX - ergaenzt.length), ...ergaenzt]

  // Begründungen (BAUPLAN 48): nur zu den Kennzeichen, die am Ende gesetzt
  // SIND (nach der Angleichung), je ein Satz; „Kein Vorschlag ohne
  // Begründung" — fehlt der Satz, steht der ehrliche Rückfall neben dem
  // Häkchen, statt dass der Grund stumm fehlt.
  const begruendungen = {}
  for (const { schluessel } of KENNZEICHEN) {
    if (!angeglichen[schluessel]) continue
    const satz = String(roh.begruendungen?.[schluessel] ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, KI_BEGRUENDUNG_MAX)
    begruendungen[schluessel] = satz || texte.blockEditor.kiBegruendungFehlt
  }
  return {
    name: String(roh.name ?? '').trim().slice(0, BLOCK_NAME_MAX),
    symbol: String(roh.symbol ?? '').trim().slice(0, BLOCK_SYMBOL_MAX) || BLOCK_SYMBOL_STANDARD,
    beschreibung: String(roh.beschreibung ?? '').trim().slice(0, BLOCK_BESCHREIBUNG_MAX),
    auftrag,
    braucht,
    brauchtOptional,
    liefert,
    // Bereich (BAUPLAN 30): nur bekannte Klappen-Schlüssel — alles andere
    // fällt auf „eigene" zurück; einen freien Namen tippt der Nutzer selbst.
    bereich: bereichSaeubern(roh.bereich),
    // Modellklasse (BAUPLAN 37): nur die drei bekannten Klassen — alles
    // andere fällt auf Standard zurück, nie auf ein stilles Billigmodell.
    modell: modellKlasseGueltig(roh.modell) ?? MODELL_KLASSE_STANDARD,
    ...Object.fromEntries(KENNZEICHEN.map(({ schluessel }) => [schluessel, angeglichen[schluessel]])),
    felder,
    begruendungen
  }
}

function bereichSaeubern(roh) {
  const wert = String(roh ?? '')
    .trim()
    .toLowerCase()
  return BEREICHE.includes(wert) ? wert : BEREICH_EIGENE
}

// Die Klappen der Bibliothek mit Anzeigename — so kennt der Assistent die
// Bedeutung der Schlüssel (texte.projektansicht.bereiche).
function bereicheFuerAssistent() {
  const namen = texte.projektansicht.bereiche
  return [...BEREICHE, BEREICH_EIGENE].map((schluessel) => ({
    schluessel,
    name: namen[schluessel] ?? schluessel
  }))
}

// Die Modellklassen mit ihrem Klartext-Namen — so kennt der Assistent die
// Bedeutung der Schlüssel (texte.kette.modellNamen).
function modellKlassenFuerAssistent() {
  return MODELL_KLASSEN.map((schluessel) => ({
    schluessel,
    name: texte.kette.modellNamen[schluessel] ?? schluessel
  }))
}

// Die Kennzeichen mit Name und Folgen-Hinweis (BAUPLAN 48) — dieselben Sätze,
// die der Editor neben den Häkchen zeigt.
export function kennzeichenFuerAssistent() {
  return KENNZEICHEN.map(({ schluessel, gruppe }) => ({
    schluessel,
    gruppe,
    name: texte.blockEditor.kennzeichen[schluessel]?.name ?? schluessel,
    hinweis: texte.blockEditor.kennzeichen[schluessel]?.hinweis ?? ''
  }))
}

export async function blockVorschlagErstellen(beschreibung) {
  const wunsch = String(beschreibung ?? '').trim()
  if (!wunsch) return { ok: false, fehler: texte.blockEditor.fehlerBeschreibungFehlt }
  const { einstellungen } = einstellungenLaden()
  const bereit = motorBereit(einstellungen)
  if (!bereit.ok) return { ok: false, fehler: bereit.fehler }

  const antwort = await starteMotorFrage({
    frage:
      texte.agentenBlockAssistent.auftrag(wunsch, bekannteEtiketten()) +
      texte.agentenBlockAssistent.kennzeichenZusatz(kennzeichenFuerAssistent()) +
      texte.agentenBlockAssistent.felderZusatz(FORMULARFELDER_MAX) +
      texte.agentenBlockAssistent.bereichZusatz(bereicheFuerAssistent()) +
      texte.agentenBlockAssistent.modellZusatz(modellKlassenFuerAssistent()),
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
