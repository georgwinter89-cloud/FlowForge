// Der Stempel der Prüfkarten (BAUPLAN 52): Damit FlowForge eine archivierte
// Prüfung von selbst abspielen kann, braucht es drei Dinge, die es beim Anlegen
// der Karte ohnehin schon hat — die Dateiliste des damals geprüften Pakets, den
// Prüfbefehl der Prüf-Instanz und den Ordnernamen, auf den er zeigte.
//
// Der Stempel wohnt NEBEN dem Archiv im verwalteten Bereich, nicht an der
// Karte: <userData>/pruefkarten/<Projekt>/stempel.json. Damit kein neues
// Agentenfeld, kein wachsender Kartentext und kein Ballast im Karten-Index, den
// Bauschritt 53 gerade schlank gemacht hat — die Dateiliste hat bewusst keine
// Anzahl-Grenze (SPEC §4.3) und wäre an der Karte ein Fass ohne Boden.
//
// Format:
//   { karten: { "<kartenId>": { dateiListe, befehl, ordner, instanzId,
//                               zuletztMs, dauerMs } } }
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { projektSchluessel } from './pruefkarten.js'

const DATEI = 'stempel.json'

function stempelPfad(projektPfad) {
  return path.join(app.getPath('userData'), 'pruefkarten', projektSchluessel(projektPfad), DATEI)
}

// Ein Eintrag kommt aus einer Datei, die zwischen zwei Fassungen von FlowForge
// liegen kann — jedes Feld wird auf seine Form gebracht, statt darauf zu
// vertrauen. Ein halb gelesener Stempel würde sonst erst beim Abspielen
// auffallen, mit einem Fehler, der nach einer kaputten Prüfung aussieht.
function eintragLesen(roh) {
  if (!roh || typeof roh !== 'object') return null
  return {
    dateiListe: (Array.isArray(roh.dateiListe) ? roh.dateiListe : [])
      .map((wert) => String(wert ?? '').trim())
      .filter(Boolean),
    befehl: String(roh.befehl ?? '').trim(),
    ordner: String(roh.ordner ?? '').trim(),
    instanzId: String(roh.instanzId ?? ''),
    zuletztMs: Number.isFinite(Number(roh.zuletztMs)) ? Number(roh.zuletztMs) : 0,
    dauerMs: Number.isFinite(Number(roh.dauerMs)) ? Number(roh.dauerMs) : 0
  }
}

// Alle Stempel eines Projekts.
//
// Liefert IMMER { karten, kaputt } — nie null. `kaputt: true` heißt: Die Datei
// war da, ließ sich aber nicht lesen. Das ist keine Nebensache, die man
// verschlucken darf: Ohne Stempel gilt jede Karte als „nicht abspielbar", und
// ohne dieses Kennzeichen sähe das für Georg genauso aus wie ein Projekt, in
// dem noch nie eine Karte gestempelt wurde.
//
// gueltigeKartenIds !== null: Einträge ohne zugehörige Karte bleiben draußen —
// eine Karte kann mitten im Lauf gelöscht worden sein, und ein verwaister
// Stempel darf keine Messung mehr auslösen. Die Datei wird dabei NICHT
// geschrieben; das Aufräumen ist ein eigener, sichtbarer Schritt.
export function stempelLaden(projektPfad, gueltigeKartenIds = null) {
  let roh
  try {
    roh = fs.readFileSync(stempelPfad(projektPfad), 'utf8')
  } catch {
    // Noch nie gestempelt (oder das Projekt ist neu) — das ist kein Fehler.
    return { karten: {}, kaputt: false }
  }
  let daten
  try {
    daten = JSON.parse(roh)
  } catch {
    return { karten: {}, kaputt: true }
  }
  if (!daten || typeof daten !== 'object' || !daten.karten || typeof daten.karten !== 'object')
    return { karten: {}, kaputt: true }
  const erlaubt = gueltigeKartenIds === null ? null : new Set([...gueltigeKartenIds].map(String))
  const karten = {}
  for (const [kartenId, wert] of Object.entries(daten.karten)) {
    if (erlaubt && !erlaubt.has(kartenId)) continue
    const eintrag = eintragLesen(wert)
    if (eintrag) karten[kartenId] = eintrag
  }
  return { karten, kaputt: false }
}

// Der Rename ist der atomare Teil: Entweder steht die alte Datei da oder die
// neue, nie eine halbe. Auf Windows kann er vorübergehend mit EPERM scheitern,
// wenn ein Virenscanner oder der Suchindex die Zieldatei gerade offen hat (in
// den Prüfungen zu 0.51.4 reproduziert) — deshalb dieselben drei kurzen
// Anläufe wie in einstellungen.js.
const SCHREIB_ANLAEUFE = 3

function dateiSchreiben(projektPfad, daten) {
  const ziel = stempelPfad(projektPfad)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  const tmp = ziel + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
  for (let anlauf = 1; ; anlauf++) {
    try {
      fs.renameSync(tmp, ziel)
      return
    } catch (fehler) {
      const kurzfristig = fehler?.code === 'EPERM' || fehler?.code === 'EACCES'
      if (!kurzfristig || anlauf >= SCHREIB_ANLAEUFE) throw fehler
      // Kurz blockierend warten: Es geht um Millisekunden, nicht um eine
      // Wartezeit, die man sieht.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * anlauf)
    }
  }
}

// Die unlesbare Fassung wandert zur Seite, statt beim Neuanfang zu verschwinden.
//
// Gemessen (22.08.2026): Wurde die Datei auf „{kaputt" gesetzt und danach EINE
// Karte gestempelt, stand hinterher nur noch diese eine Karte darin — die
// gemerkten Startbefehle aller übrigen Karten waren fort, ohne eine eigene
// Meldung. Der Neuanfang muss bleiben (sonst könnte FlowForge nach einem
// einzigen kaputten Schreibvorgang nie wieder stempeln), aber der Verlust wird
// belegbar: Die alte Datei liegt danach als stempel.json.kaputt daneben.
const KAPUTT_ENDUNG = '.kaputt'

function kaputteDateiBeiseite(projektPfad) {
  const ziel = stempelPfad(projektPfad)
  try {
    fs.renameSync(ziel, ziel + KAPUTT_ENDUNG)
    return true
  } catch {
    // Ließ sich auch das nicht, bleibt der Neuanfang — mehr als benennen kann
    // FlowForge hier nicht, und ein blockierter Stempel wäre schlimmer.
    return false
  }
}

// Beim Anlegen einer Prüfkarte. Eine unlesbare Datei wird dabei ersetzt statt
// den Stempel scheitern zu lassen: Sonst könnte FlowForge nach einem einzigen
// kaputten Schreibvorgang nie wieder stempeln, und jede neue Karte wäre für
// immer „nicht abspielbar". Der Verlust ist sichtbar — `beiseite: true` sagt dem
// Aufrufer, dass er es im Ticker sagen muss.
export function stempelSetzen(projektPfad, kartenId, { dateiListe, befehl, ordner, instanzId }) {
  let beiseite = false
  try {
    const geladen = stempelLaden(projektPfad)
    if (geladen.kaputt) beiseite = kaputteDateiBeiseite(projektPfad)
    const karten = geladen.karten
    const vorher = karten[String(kartenId)]
    karten[String(kartenId)] = eintragLesen({
      dateiListe,
      befehl,
      ordner,
      instanzId,
      // Die Rotationsmarke gehört der Messung, nicht dem Anlegen: Wird eine
      // Karte neu gestempelt, ist sie deswegen nicht neu gelaufen.
      zuletztMs: vorher?.zuletztMs ?? 0,
      dauerMs: vorher?.dauerMs ?? 0
    })
    dateiSchreiben(projektPfad, { karten })
    return beiseite ? { ok: true, beiseite: true } : { ok: true }
  } catch {
    // Kein stilles Weglassen: Der Aufrufer sagt im Ticker, dass diese Karte
    // ohne Stempel bleibt — sonst ist sie von einer Altkarte nicht zu
    // unterscheiden.
    return { ok: false, fehler: 'schreiben' }
  }
}

// Sofort nach jedem Abspielen — auch bei Rot. Ohne diesen Vermerk zöge die
// Rotation immer wieder dieselben Karten: Sie wählt nach „am längsten nicht
// gelaufen", und eine Messung, die niemand notiert, hat nie stattgefunden.
//
// Ohne Stempel-Eintrag gibt es nichts zu vermerken (die Karte war dann gar
// nicht abspielbar) — das meldet der Rückgabewert, statt still einen Eintrag
// aus dem Nichts anzulegen.
export function stempelMessungVermerken(projektPfad, kartenId, { zuletztMs, dauerMs }) {
  try {
    const { karten } = stempelLaden(projektPfad)
    const vorher = karten[String(kartenId)]
    if (!vorher) return false
    karten[String(kartenId)] = {
      ...vorher,
      zuletztMs: Number.isFinite(Number(zuletztMs)) ? Number(zuletztMs) : vorher.zuletztMs,
      dauerMs: Number.isFinite(Number(dauerMs)) ? Number(dauerMs) : vorher.dauerMs
    }
    dateiSchreiben(projektPfad, { karten })
    return true
  } catch {
    return false
  }
}

// Löschen einer Prüfkarte räumt ihren Stempel mit weg — wie schon ihr Archiv.
// Wirft nie: Ein klemmender Stempel blockiert nicht das Löschen der Karte.
export function stempelLoeschen(projektPfad, kartenId) {
  try {
    const { karten } = stempelLaden(projektPfad)
    if (!(String(kartenId) in karten)) return
    delete karten[String(kartenId)]
    dateiSchreiben(projektPfad, { karten })
  } catch {
    // Siehe oben.
  }
}

// Verwaiste Stempel entfernen — Karten, die es nicht mehr gibt (gelöscht,
// während FlowForge nicht lief, oder aus einer Fassung vor dem sauberen
// Mitlöschen). Liefert die Anzahl der entfernten Einträge, damit der Aufrufer
// es sagen kann, statt still aufzuräumen.
export function stempelAufraeumen(projektPfad, gueltigeKartenIds) {
  try {
    const { karten } = stempelLaden(projektPfad)
    const erlaubt = new Set([...(gueltigeKartenIds ?? [])].map(String))
    const verwaist = Object.keys(karten).filter((id) => !erlaubt.has(id))
    if (verwaist.length === 0) return 0
    for (const id of verwaist) delete karten[id]
    dateiSchreiben(projektPfad, { karten })
    return verwaist.length
  } catch {
    return 0
  }
}
