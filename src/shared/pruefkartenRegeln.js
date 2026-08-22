// Prüfkarten laufen von selbst (BAUPLAN 52): Hier stehen die reinen Rechnungen
// dahinter — welcher Ordner, welcher Befehl, welche Karte. Ohne Dateisystem,
// ohne Uhr, ohne Prozesse, damit die Prüfskripte sie direkt fahren können; der
// Ablaufplaner (lauf.js) lässt sich in einer Prüfung nicht fahren.
//
// Diese Datei muss browser-tauglich bleiben (pruefungen/sharedBrowsertauglich.test.js):
// kein node:fs, kein node:path. Muster und Namen werden deshalb rein textlich
// gerechnet — der Dateisystem-Teil (existiert der Ordner? welche Dateien liegen
// darin?) gehört in den Hauptprozess.
import { pruefbefehlPruefen } from './torRegeln.js'
import { dateilistenUeberschneidung } from './lieferschein.js'

// Ordnername einer eingelegten Prüfkarte in der Prüfmappe — OHNE Prüfordner.
//
// Gemessen am echten Archiv (22.08.2026): 89 von 135 aufbewahrten Prüfdateien
// rechnen sich den Projektordner über feste Aufwärts-Schritte aus
// (resolve(HIER, "..", "..")). Geschrieben wurden sie in
// pruefung/pruefer-<Kennung>/ — zwei Ebenen unter dem Projekt. Legte FlowForge
// sie in den Prüfordner HINEIN zurück (so war es bis BAUPLAN 52), lägen sie
// eine Ebene tiefer und jeder dieser Pfade zeigte auf pruefung/ statt aufs
// Projekt. Dieselbe Tiefe ist deshalb keine Kosmetik, sondern die Bedingung
// dafür, dass eine wiederholte Prüfung überhaupt grün werden kann.
// Ein leerer Schlüssel ergibt KEINEN Namen. Gemessen (22.08.2026):
// kartenOrdnerName(undefined) und kartenOrdnerName('') lieferten den nackten
// Rumpf „pruefkarte-", auf den istKartenOrdner ebenfalls passt. Daraus wurde
// ein Pfad, der auf die ganze Prüfmappe zeigt — ein Abräumen darauf hätte die
// Mappe des Laufs geleert. Der leere Name ist deshalb das Signal an jeden
// Aufrufer (Einlegen, Abräumen, Schutzbereiche), gar nichts zu tun.
export function kartenOrdnerName(kartenId) {
  const kurz = String(kartenId ?? '')
    .trim()
    .slice(0, 8)
  return kurz ? 'pruefkarte-' + kurz : ''
}

// Ein Ordnername darf keine Wegstrecke sein: Der gestempelte Ordner geht in
// eine Textersetzung im Prüfbefehl ein; ein Eintrag mit Schrägstrich (oder ein
// leerer) würde dort ganze Pfadstücke treffen statt genau eines Segments.
function ordnerUnbrauchbar(ordner) {
  const name = String(ordner ?? '').trim()
  return !name || /[\\/]/.test(name)
}

function fuerRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Den gestempelten Befehl auf den Kartenordner umschreiben:
// „node pruefung/pruefer-6c746d22/pruefe.mjs" → „node pruefung/pruefkarte-0049e5aa/pruefe.mjs".
//
// Ersetzt wird das Pfad-SEGMENT, nicht die Zeichenkette irgendwo: Ein
// Ordnername ist auch ein möglicher Namensteil (pruefer-6c746d22-alt), und ein
// halb ersetzter Pfad wäre schlimmer als gar keiner. Grenzen sind Schrägstrich
// (beide Richtungen — Windows), Leerraum, Anführungszeichen und Anfang/Ende;
// Groß-/Kleinschreibung zählt nicht, weil das Windows-Dateisystem sie nicht
// unterscheidet und ein Agent den Befehl frei geschrieben hat.
//
// Danach läuft pruefbefehlPruefen erneut über das ERGEBNIS: FlowForge spielt
// diesen Befehl ohne Rechte-Rückfrage ab (0 Tokens, kein Agent), also muss die
// kurze Leine aus SPEC §4.3 auch für die umgeschriebene Fassung gelten — die
// Ersetzung kann den Befehl über PRUEFBEFEHL_MAX schieben.
export function befehlUmschreiben(befehl, alterOrdner, neuerOrdner) {
  const roh = String(befehl ?? '').trim()
  if (!roh) return { ok: false, grund: 'ohneBefehl' }
  if (ordnerUnbrauchbar(alterOrdner)) return { ok: false, grund: 'ordnerLeer' }
  const alt = String(alterOrdner).trim()
  const neu = String(neuerOrdner ?? '').trim()
  const muster = new RegExp(
    '(^|[\\s"\'\\\\/])' + fuerRegex(alt) + '(?=[\\s"\'\\\\/]|$)',
    'gi'
  )
  let treffer = 0
  const umgeschrieben = roh.replace(muster, (_ganz, vorzeichen) => {
    treffer++
    return vorzeichen + neu
  })
  // Der Befehl nennt den Ordner nicht (klassisch: „npm test" liest ein Skript
  // aus package.json). Dann ist die Karte nicht allein abspielbar — das sagt
  // FlowForge im Klartext, statt sich eine Ersatzregel auszudenken.
  if (treffer === 0) return { ok: false, grund: 'ordnerNichtImBefehl' }
  const geprueft = pruefbefehlPruefen(umgeschrieben)
  if (geprueft.fehlerArt) return { ok: false, grund: 'ungueltig' }
  return { ok: true, befehl: geprueft.befehl }
}

// Welche Datei-Muster spricht der Befehl IM Kartenordner an?
//
// Anlass ist eine Messung (21.08.2026): `node --test pruefung/gibtsnicht/*.test.mjs`
// endet mit Fehlercode 0 und der Ausgabe „tests 0". Ein Fehlercode allein ist
// also kein Beleg dafür, dass etwas gelaufen ist. Vor dem Abspielen rechnet
// FlowForge deshalb nach, ob überhaupt eine Datei angesprochen wird.
//
// Geliefert werden die Muster OHNE Ordnerteil — also der Rest hinter
// „<ordner>/", z.B. ['*.test.mjs'] oder ['pruefe.mjs']. Leere Liste heißt: Der
// Befehl nennt keine Datei im Ordner; dann genügt „Ordner nicht leer".
// Gemessen an den 11 archivierten Prüfbefehlen des echten Datenordners: vier
// Formen, alle von dieser Rechnung abgedeckt (pruefe.mjs, pruefe-alles.mjs,
// sammel.mjs, *.test.mjs).
export function musterImBefehl(befehl, ordner) {
  const roh = String(befehl ?? '').trim()
  if (!roh || ordnerUnbrauchbar(ordner)) return []
  const gesucht = String(ordner).trim().toLowerCase()
  const muster = []
  for (const wort of roh.split(/\s+/)) {
    const teil = wort.replace(/^["']|["']$/g, '').replace(/\\/g, '/')
    const stuecke = teil.split('/')
    const stelle = stuecke.findIndex((s) => s.toLowerCase() === gesucht)
    if (stelle === -1) continue
    const rest = stuecke.slice(stelle + 1).join('/')
    // Der Ordner allein (ohne Datei dahinter) ist kein Muster: `node --test
    // pruefung/pruefkarte-x` sagt „nimm alles darin" — dafür genügt später
    // „Ordner nicht leer".
    if (rest && !muster.includes(rest)) muster.push(rest)
  }
  return muster
}

// Passt ein Dateiname auf eines der Muster? Nimmt einen einzelnen Namen oder
// eine Liste entgegen.
//
// Nur `*` wird unterstützt, und es überspringt keinen Schrägstrich — genau wie
// in einer Shell. Mehr kommt in echten Prüfbefehlen nicht vor (gemessen an den
// 11 archivierten Befehlen), und ein halb verstandenes Muster, das zu viel
// trifft, machte die Vorprüfung wertlos.
// Groß-/Kleinschreibung zählt nicht (Windows-Dateisystem).
export function nameTrifftMuster(name, muster) {
  const klar = String(name ?? '')
    .replace(/\\/g, '/')
    .toLowerCase()
  if (!klar) return false
  const liste = Array.isArray(muster) ? muster : [muster]
  return liste.some((eines) => {
    const text = String(eines ?? '').replace(/\\/g, '/')
    if (!text) return false
    const regex = new RegExp(
      '^' + text.split('*').map(fuerRegex).join('[^/]*') + '$',
      'i'
    )
    return regex.test(klar)
  })
}

// Die Auswahl eines Messpunkts: Welche Prüfkarten spielt FlowForge jetzt ab?
//
// REIN — kein Dateisystem, keine Uhr. Alles, was von außen kommt, kommt als
// Argument; damit ist die Auswahl in einer Prüfung vollständig nachfahrbar.
//
// Die Haltung dahinter (Entscheidung Georg, 21.08.2026): Im Zweifel wird
// ausgeführt. Übersprungen wird nur, was nachweislich nichts mit dem laufenden
// Paket zu tun hat. Und weil ein Listenschnitt strukturell blind ist für
// indirekte Wirkungen (eine Live-Prüfung misst über HTTP den halben Server,
// ihre gestempelte Dateiliste kennt davon nichts), laufen zusätzlich die zwei
// am längsten nicht gelaufenen Karten als Gegenprobe mit.
//
// karten          [{ id, titel }] in Kartenreihenfolge
// stempel         { [kartenId]: { dateiListe, befehl, ordner, instanzId, zuletztMs, dauerMs } }
// paketDateien    string[] | null — Dateiliste des laufenden Pakets (null = unbekannt)
// gezogen         string[] — von Hand auf einen Prüfer gezogene Karten
// beimPruefer     string[] — Karten, die schon einem Prüfer zur Anpassung freigegeben sind
// schonGelaufen   string[] — Karten, die in DIESEM Lauf schon einmal gemessen wurden
// rotationAnzahl  wie viele Karten als Gegenprobe mitlaufen
//
// `schonGelaufen` entscheidet NICHT, OB eine Karte ausgewählt ist — das bleibt
// Sache der Relevanz-Rechnung und der Zeit-Notbremse. Es entscheidet nur bei
// GLEICHSTAND in der Rotation. Anlass ist eine Messung (22.08.2026): Ließ sich
// der Stempel nicht schreiben (Datei gesperrt), blieb zuletztMs bei allen
// Karten auf 0, und drei Messpunkte hintereinander zogen dieselben zwei Karten
// ([1,2], [1,2], [1,2]). Mit dem Gleichstand-Ausschlag kommen wenigstens
// innerhalb eines Laufs die anderen dran.
export function kartenAuswahl({
  karten,
  stempel,
  paketDateien,
  gezogen,
  beimPruefer,
  schonGelaufen,
  rotationAnzahl = 2
}) {
  const laeuft = []
  const uebersprungen = []
  const nichtAbspielbar = []
  const gezogeneIds = new Set((Array.isArray(gezogen) ? gezogen : []).map((id) => String(id)))
  const beimPrueferIds = new Set(
    (Array.isArray(beimPruefer) ? beimPruefer : []).map((id) => String(id))
  )
  const gelaufeneIds = new Set(
    (Array.isArray(schonGelaufen) ? schonGelaufen : [...(schonGelaufen ?? [])]).map((id) =>
      String(id)
    )
  )
  const stempelSatz = stempel && typeof stempel === 'object' ? stempel : {}
  const offen = []

  for (const karte of Array.isArray(karten) ? karten : []) {
    const id = String(karte?.id ?? '')
    if (!id) continue
    const eintrag = stempelSatz[id]
    // ZUERST die gezogene Karte, VOR jeder Stempel-Prüfung (Einwand Bauer A):
    // Sie liegt schon beim Prüfer und wird von ihm bearbeitet — der Messpunkt
    // darf ihre (evtl. bereits angepasste) Fassung nicht überkopieren. Stünde
    // die Abfrage hinter dem Stempel, meldete der Ticker über genau die Prüfung,
    // die gerade beim Prüfer läuft, „ohne Stempel — nicht abspielbar". Das wäre
    // schlicht falsch, und heute wäre es der Normalfall: Alle Karten im echten
    // Archiv sind stempellos.
    if (gezogeneIds.has(id)) {
      uebersprungen.push({ id, grund: 'gezogen' })
      continue
    }
    // Genauso eine Karte, die schon bei einem Prüfer liegt, weil sie an einem
    // früheren Messpunkt ROT war. Gemessen (22.08.2026): Ohne diese Zeile rief
    // der nächste Messpunkt pruefkarteEinlegen unbedingt auf — die Archivfassung
    // legte sich über die gerade angepasste Prüfung, die Notiz des Prüfers blieb
    // verwaist daneben stehen, die Karte blieb für immer rot, und die Freigabe
    // („genau EIN Prüfer", Vertrag 3.6) wurde durch ein instanzId: null wieder
    // weggeworfen, sodass ein zweiter Prüfer denselben Ordner bekommen konnte.
    if (beimPrueferIds.has(id)) {
      uebersprungen.push({ id, grund: 'beimPruefer' })
      continue
    }
    // Ohne Stempel ist nichts zu raten (gemessen: keine der 38 heutigen Karten
    // im echten Archiv hat einen zuordenbaren Prüfbefehl, und ein Einstieg
    // lässt sich auch nicht ableiten — mal alle.mjs, mal sammel.mjs, mal zwei
    // gleichrangige Skripte nebeneinander). Solche Karten heißen „nicht
    // abspielbar" und bekommen im Ticker eine eigene Zahl; sie verschwinden
    // NICHT unter „nicht betroffen".
    if (!eintrag || typeof eintrag !== 'object') {
      nichtAbspielbar.push({ id, grund: 'ohneStempel' })
      continue
    }
    if (!String(eintrag.befehl ?? '').trim()) {
      nichtAbspielbar.push({ id, grund: 'ohneBefehl' })
      continue
    }
    if (ordnerUnbrauchbar(eintrag.ordner)) {
      nichtAbspielbar.push({ id, grund: 'ordnerLeer' })
      continue
    }
    offen.push({ id, eintrag })
  }

  const gewaehlt = new Set()
  for (const { id, eintrag } of offen) {
    const gestempelteListe = Array.isArray(eintrag.dateiListe) ? eintrag.dateiListe : []
    const paket = Array.isArray(paketDateien) ? paketDateien : []
    // Keine Liste auf einer der beiden Seiten heißt: Der Schnitt kann die Frage
    // nicht beantworten. Dann läuft die Prüfung — dieselbe Haltung wie bei der
    // VRAM-Prüfung, die lieber schweigt, als aus einer misslungenen Messung zu
    // warnen.
    if (paket.length === 0 || gestempelteListe.length === 0) {
      laeuft.push({ id, grund: 'imZweifel' })
      gewaehlt.add(id)
      continue
    }
    if (dateilistenUeberschneidung(paket, gestempelteListe).ueberschneidet) {
      laeuft.push({ id, grund: 'betroffen' })
      gewaehlt.add(id)
    }
  }

  // Rotation als Gegenprobe: die am längsten nicht gelaufenen Karten zuerst.
  // Fehlender Zeitstempel zählt als 0 — eine nie gelaufene Karte ist genau die,
  // die am dringendsten drankommen muss.
  //
  // Bei Gleichstand kommt zuerst, was in DIESEM Lauf noch nicht dran war, und
  // erst danach entscheidet die Kartenreihenfolge (damit die Auswahl über Läufe
  // hinweg vorhersagbar bleibt). Der Zwischenschritt ist die Notbremse für den
  // Fall, dass der Stempel sich nicht schreiben lässt: Dann steht zuletztMs bei
  // allen auf 0, und ohne diesen Ausschlag zöge jeder Messpunkt wieder dieselben
  // zwei Karten (gemessen: dreimal [1,2] statt [1,2], [3,4], [5,1]).
  const anzahl = Number.isFinite(rotationAnzahl) && rotationAnzahl > 0 ? rotationAnzahl : 0
  const uebrig = offen.filter(({ id }) => !gewaehlt.has(id))
  const nachAlter = uebrig
    .map((eintrag, reihe) => ({ ...eintrag, reihe }))
    .sort((a, b) => {
      const alt = (Number(a.eintrag.zuletztMs) || 0) - (Number(b.eintrag.zuletztMs) || 0)
      if (alt !== 0) return alt
      const frisch = Number(gelaufeneIds.has(a.id)) - Number(gelaufeneIds.has(b.id))
      return frisch !== 0 ? frisch : a.reihe - b.reihe
    })
    .slice(0, anzahl)
  for (const { id } of nachAlter) {
    laeuft.push({ id, grund: 'rotation' })
    gewaehlt.add(id)
  }
  for (const { id } of uebrig) if (!gewaehlt.has(id)) uebersprungen.push({ id, grund: 'nichtBetroffen' })

  // Reihenfolge: die schnellsten zuerst. Reißt der Deckel je Messpunkt, trifft
  // die Notbremse damit die langsamsten Karten und nicht die zufällig letzten —
  // sonst hinge es vom Alphabet ab, welche Prüfung seltener läuft.
  const dauerVon = (id) => Number(stempelSatz[id]?.dauerMs) || 0
  laeuft.sort((a, b) => dauerVon(a.id) - dauerVon(b.id))

  return { laeuft, uebersprungen, nichtAbspielbar }
}

// Deckel je Messpunkt (BAUPLAN 52): Wie lange darf die Summe aller Kartenläufe
// VOR bzw. NACH einem schreibenden Block dauern? Reißt der Deckel, rutschen die
// langsamsten Karten von „je schreibendem Block" auf „einmal je Lauf" — er
// ändert also nie, OB eine Prüfung läuft, nur wie oft.
//
// Die Stufenliste steht hier und nicht im Dialog: Die Lehre aus 0.51.3 ist,
// dass Dialog und Speichern dieselbe Liste sehen müssen — sonst nimmt der eine
// einen Wert an, den der andere still auf den Standard zurücksetzt.
export const PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD = 600000
export const PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL = [300000, 600000, 1200000]

export function pruefkartenDeckelMesspunktBereinigen(roh) {
  const wert = Number(roh)
  return PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL.includes(wert)
    ? wert
    : PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD
}

// Deckel je Lauf: die harte Obergrenze über alle Messpunkte zusammen. Ist er
// verbraucht, läuft nur noch, was in diesem Lauf NIE lief — die Zusage „jede
// ausgewählte Karte mindestens einmal je Lauf" steht über dem Deckel.
export const PRUEFKARTEN_DECKEL_LAUF_STANDARD = 1800000
export const PRUEFKARTEN_DECKEL_LAUF_WAHL = [900000, 1800000, 3600000]

export function pruefkartenDeckelLaufBereinigen(roh) {
  const wert = Number(roh)
  return PRUEFKARTEN_DECKEL_LAUF_WAHL.includes(wert) ? wert : PRUEFKARTEN_DECKEL_LAUF_STANDARD
}
