// Harte Regeln für Etiketten (SPEC §4.2/§4.5, BAUPLAN 48) — dieselbe Idee wie
// blockRegeln.js: Die Oberfläche zeigt Zähler und Vorschau, durchgesetzt wird
// im Hauptprozess. Ein Etikett ist seit Bauschritt 48 ein eigener Eintrag mit
// Kennung, eindeutigem Namen und OPTIONALER Form:
//   { id, name, beschreibung, felder: [{ schluessel, bezeichnung, art, werte,
//     pflicht, hinweis }], werkzeug }
// Ohne Felder bleibt es ein Name — der Agent meldet über den Rahmen
// (melde_ergebnis, Freitext). Mit Feldern bekommt es ein eigenes Melde-Werkzeug
// (melde_<slug>), und FlowForge weist eine unvollständige Meldung sichtbar ab.
//
// Import-Richtung (K7): Diese Datei DARF lieferschein.js und blockKatalog.js
// importieren; lieferschein.js importiert sie NICHT (die Feldprüfung für
// Meldungen der Art 'eigen' wohnt dort und liest nur eigenesEtikett() aus
// blockKatalog.js). Browser-tauglich: kein node:-Baustein, keine uuid — die id
// vergibt der Hauptprozess (eigeneEtiketten.js).
import { texte } from './texte.js'
import { ETIKETT_MAX } from './blockRegeln.js'
import {
  FESTE_ETIKETTEN,
  etikettNameSchluessel,
  eigeneEtikettenListe,
  katalogEtiketten
} from './blockKatalog.js'
import { RAHMEN_WERKZEUG, FESTE_TEILE } from './lieferschein.js'

export { etikettNameSchluessel }

// Der Name folgt derselben Grenze wie ein Etikett am Block (K23: importiert,
// nicht gespiegelt — sonst liefen zwei Zahlen auseinander).
export const ETIKETT_NAME_MAX = ETIKETT_MAX
export const ETIKETT_BESCHREIBUNG_MAX = 200
// Flach und klein: Mehr als acht Felder ist ein Formular, kein Etikett — was
// darüber hinausgeht, gehört in die Anmerkung (Formular-Falle, BAUPLAN 42).
export const FELDER_MAX = 8
export const FELD_BEZEICHNUNG_MAX = 60
export const FELD_SCHLUESSEL_MAX = 30
export const FELD_HINWEIS_MAX = 200
export const AUSWAHL_WERTE_MIN = 2
export const AUSWAHL_WERTE_MAX = 12
export const AUSWAHL_WERT_MAX = 40
export const FELD_ARTEN = ['text', 'langtext', 'liste', 'auswahl']
// Der gemeinsame Rahmen jeder Meldung (lieferschein.js rahmenPruefen plus die
// beiden Rahmen-Felder) — ein eigenes Feld gleichen Namens überschriebe im
// Werkzeug-Schema das Rahmenfeld, und das Fazit käme nie an (K3).
export const RESERVIERTE_SCHLUESSEL = ['fazit', 'getan', 'offen', 'anmerkung', 'etikett', 'inhalt']
// Slug ≤ 30 → Werkzeugname ≤ 37 („melde_" + 30 + „_99"), mit dem Präfix
// mcp__lieferschein__ (19) höchstens 56 Zeichen — unter der 64-Zeichen-Grenze
// für Werkzeugnamen (K13).
export const WERKZEUG_SLUG_MAX = 30
const WERKZEUG_RUECKFALL = 'melde_etikett'

// Klein, Umlaute ausgeschrieben, nur [a-z0-9_], keine doppelten oder
// randständigen Unterstriche, gekürzt auf `max`.
function slug(roh, max) {
  let text = String(roh ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (text.length > max) text = text.slice(0, max).replace(/_+$/, '')
  return text
}

// Der Feld-Schlüssel im Werkzeug, abgeleitet aus der Bezeichnung: „Zielgruppe
// (Kern)" → „zielgruppe_kern". Führende Ziffern und Unterstriche fallen weg —
// ein Schlüssel soll mit einem Buchstaben beginnen.
export function feldSchluesselBereinigen(roh) {
  const ohneFuehrung = String(roh ?? '').replace(/^[\s0-9_\-.]+/, '')
  return slug(ohneFuehrung, FELD_SCHLUESSEL_MAX)
}

// Die Werkzeugnamen, die ein eigenes Etikett nie bekommen darf: der Rahmen und
// die fünf festen Werkzeuge (Import aus lieferschein.js, K7).
function festeWerkzeugNamen() {
  return [RAHMEN_WERKZEUG, ...Object.values(FESTE_TEILE).map((t) => t.werkzeug)]
}

// Werkzeugname eines Etiketts mit Feldern: 'melde_' + slug(name); bei Kollision
// mit dem Rahmen, den festen Werkzeugen oder `vergeben` (die Werkzeuge der
// ANDEREN eigenen Etiketten — nie das eigene bisherige, K13) ein Suffix _2, _3 …
// Leerer Slug (Name nur aus Sonderzeichen) → 'melde_etikett'.
export function etikettWerkzeugName(name, vergeben = []) {
  const basisSlug = slug(name, WERKZEUG_SLUG_MAX)
  const basis = basisSlug ? 'melde_' + basisSlug : WERKZEUG_RUECKFALL
  const belegt = new Set([...festeWerkzeugNamen(), ...(vergeben ?? []).filter(Boolean)])
  if (!belegt.has(basis)) return basis
  for (let n = 2; ; n++) {
    const kandidat = `${basis}_${n}`
    if (!belegt.has(kandidat)) return kandidat
  }
}

// Bleibt das bisherige Werkzeug gültig? Ja, wenn es zum aktuellen Namen gehört
// (gleicher Slug, mit oder ohne Suffix) und niemand anderes es trägt — dann
// behält das Etikett seinen Namen über ein erneutes Speichern hinweg (K13).
function werkzeugBehalten(bisher, name, vergeben) {
  if (typeof bisher !== 'string' || !bisher) return null
  if ((vergeben ?? []).includes(bisher)) return null
  const basisSlug = slug(name, WERKZEUG_SLUG_MAX)
  const basis = basisSlug ? 'melde_' + basisSlug : WERKZEUG_RUECKFALL
  if (bisher === basis || new RegExp('^' + basis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_\\d+$').test(bisher))
    return bisher
  return null
}

function einzeilig(wert) {
  return String(wert ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Eine Auswahlwerte-Liste säubern: Strings, getrimmt, ohne Doppelte (ohne
// Groß/Klein). Nimmt Array ODER komma-getrennten Text (Editor-Eingabe).
export function auswahlWerteBereinigen(roh) {
  const liste = Array.isArray(roh) ? roh : String(roh ?? '').split(',')
  const werte = []
  for (const eintrag of liste) {
    const wert = einzeilig(eintrag)
    if (!wert) continue
    if (werte.some((w) => w.toLowerCase() === wert.toLowerCase())) continue
    werte.push(wert)
  }
  return werte
}

// Ein Feld prüfen und normalisieren — liefert { fehler } oder { feld }.
function pruefeFeld(roh, nummer, belegteSchluessel) {
  const tr = texte.etikettRegeln
  const bezeichnung = einzeilig(roh?.bezeichnung)
  if (!bezeichnung) return { fehler: tr.feldBezeichnungFehlt(nummer) }
  if (bezeichnung.length > FELD_BEZEICHNUNG_MAX)
    return { fehler: tr.feldBezeichnungZuLang(bezeichnung, FELD_BEZEICHNUNG_MAX) }
  const art = String(roh?.art ?? 'text')
    .trim()
    .toLowerCase()
  if (!FELD_ARTEN.includes(art)) return { fehler: tr.feldArtUnbekannt(bezeichnung, FELD_ARTEN) }
  // Schlüssel: ein mitgelieferter bleibt (bereinigt) — er ist der Name im
  // Werkzeug und soll ein Umbenennen der Bezeichnung überleben; ohne einen
  // wird er aus der Bezeichnung abgeleitet (Muster K5 der Formularfelder).
  const schluessel = feldSchluesselBereinigen(
    einzeilig(roh?.schluessel) ? roh.schluessel : bezeichnung
  )
  if (!schluessel) return { fehler: tr.feldSchluesselLeer(bezeichnung) }
  if (RESERVIERTE_SCHLUESSEL.includes(schluessel))
    return { fehler: tr.feldSchluesselReserviert(bezeichnung, schluessel) }
  if (belegteSchluessel.has(schluessel))
    return { fehler: tr.feldSchluesselDoppelt(bezeichnung, schluessel) }
  let werte = []
  if (art === 'auswahl') {
    werte = auswahlWerteBereinigen(roh?.werte)
    if (werte.length < AUSWAHL_WERTE_MIN || werte.length > AUSWAHL_WERTE_MAX)
      return { fehler: tr.auswahlWerte(bezeichnung, AUSWAHL_WERTE_MIN, AUSWAHL_WERTE_MAX) }
    if (werte.some((w) => w.length > AUSWAHL_WERT_MAX))
      return { fehler: tr.auswahlWertZuLang(bezeichnung, AUSWAHL_WERT_MAX) }
  }
  const hinweis = einzeilig(roh?.hinweis)
  if (hinweis.length > FELD_HINWEIS_MAX)
    return { fehler: tr.feldHinweisZuLang(bezeichnung, FELD_HINWEIS_MAX) }
  return {
    feld: { schluessel, bezeichnung, art, werte, pflicht: Boolean(roh?.pflicht), hinweis }
  }
}

// Prüft und normalisiert ein Etikett — liefert { fehler } oder { etikett }
// (ohne id; die vergibt der Hauptprozess). `vorhandene` sind die eigenen
// Etiketten (das bearbeitete, erkannt an roh.id, zählt nicht gegen sich
// selbst), `katalogNamen` die Namen des Katalogs — beide ohne Angabe aus der
// Registry. Ein Katalog-Name ist tabu: Vorlagen bauen auf ihm auf, und ein
// eigenes Etikett gleichen Namens überschriebe still, was der Katalog liefert.
export function pruefeEtikett(roh, { vorhandene, katalogNamen } = {}) {
  const tr = texte.etikettRegeln
  const andere = (Array.isArray(vorhandene) ? vorhandene : eigeneEtikettenListe()).filter(
    (e) => !(typeof roh?.id === 'string' && e?.id === roh.id)
  )
  const katalog = Array.isArray(katalogNamen) ? katalogNamen : katalogEtiketten().map((e) => e.name)
  const name = einzeilig(roh?.name)
  if (!name) return { fehler: tr.nameFehlt }
  if (name.length > ETIKETT_NAME_MAX) return { fehler: tr.nameZuLang(ETIKETT_NAME_MAX) }
  const schluessel = etikettNameSchluessel(name)
  const katalogTreffer = katalog.find((k) => etikettNameSchluessel(k) === schluessel)
  // Bei den fünf festen Etiketten führt der Rat „kopiere es" ins Leere — die
  // sind nicht kopierbar (K9); der Satz sagt dann nur „anderer Name".
  if (katalogTreffer)
    return { fehler: tr.nameKatalog(katalogTreffer, FESTE_ETIKETTEN.includes(katalogTreffer)) }
  const doppelt = andere.find((e) => etikettNameSchluessel(e?.name) === schluessel)
  if (doppelt) return { fehler: tr.nameVergeben(doppelt.name) }
  const beschreibung = einzeilig(roh?.beschreibung)
  if (beschreibung.length > ETIKETT_BESCHREIBUNG_MAX)
    return { fehler: tr.beschreibungZuLang(ETIKETT_BESCHREIBUNG_MAX) }
  const rohFelder = Array.isArray(roh?.felder) ? roh.felder : []
  if (rohFelder.length > FELDER_MAX) return { fehler: tr.zuVieleFelder(FELDER_MAX) }
  const felder = []
  const belegt = new Set()
  for (let i = 0; i < rohFelder.length; i++) {
    const geprueft = pruefeFeld(rohFelder[i], i + 1, belegt)
    if (geprueft.fehler) return geprueft
    belegt.add(geprueft.feld.schluessel)
    felder.push(geprueft.feld)
  }
  // Werkzeugname nur mit Feldern — ohne Felder läuft das Etikett über den
  // Rahmen. Er wird beim Speichern berechnet und am Etikett PERSISTIERT; ein
  // bisheriger Name bleibt, solange er zum Namen passt (K13).
  let werkzeug = null
  if (felder.length > 0) {
    const vergeben = andere.map((e) => e?.werkzeug).filter(Boolean)
    werkzeug = werkzeugBehalten(roh?.werkzeug, name, vergeben) ?? etikettWerkzeugName(name, vergeben)
  }
  return { etikett: { name, beschreibung, felder, werkzeug } }
}

// Das Etikett in Alltagssprache, EIN Absatz — dieselbe Fassung im Editor
// (Vorschau „So liest es der Agent"), in der Bibliothek und in der Werkzeug-
// Beschreibung, die der Agent bekommt. Eine Quelle, damit Georg genau das
// liest, was der Agent liest.
export function etikettKlartext(etikett) {
  const tk = texte.etiketten.klartext
  const name = String(etikett?.name ?? '').trim() || '…'
  const felder = Array.isArray(etikett?.felder) ? etikett.felder : []
  if (felder.length === 0) return tk.ohneFelder(name)
  const teile = felder.map((feld) => {
    const art =
      feld?.art === 'auswahl'
        ? tk.arten.auswahl(Array.isArray(feld.werte) ? feld.werte : [])
        : (tk.arten[feld?.art] ?? tk.arten.text)
    const zusatz = feld?.pflicht ? `${art}; ${tk.pflicht}` : art
    return `${feld?.bezeichnung ?? ''} (${zusatz})`
  })
  return tk.mitFeldern(name, teile)
}
