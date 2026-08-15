// Metriken (BAUPLAN 31): lokale KI und Motor über alle Läufe hinweg.
//
// 1. Metrik-Datei statt Karten: Jedes Urteil über lokale Arbeit (übernommen/
//    verworfen, gehalten/nicht gehalten, gescheitert) schreibt FlowForge als
//    eine JSON-Zeile in eine globale Datei im verwalteten Bereich —
//    userData/metriken/lokale-ki.jsonl. Anhänge-Format, weil bis zu 3 Läufe
//    parallel schreiben (eine Zeile je appendFileSync; tmp+rename würde sich
//    gegenseitig überschreiben). Kaputte Zeilen fallen beim Lesen still heraus.
//    Erst ab diesem Schritt gezählt (Entscheidung Georg) — keine Rückrechnung
//    aus Ticker-Texten alter Berichte.
//
// 2. Motor-Auswertung: liest die Laufberichte aller bekannten Projekte — die
//    Daten liegen dort exakt vor, auch für alte Läufe. Weil allein ein Projekt
//    mehrere MB Berichte hat, wird je Datei nur der schmale Extrakt behalten
//    (metrikRegeln.laufExtraktAusBericht) und nach Änderungszeit
//    zwischengespeichert; Projekte, deren Ordner fehlt, werden mit Hinweis
//    übersprungen. Nur Nachschlagewerk — nichts davon wandert je in einen
//    Auftrag (SPEC §10: kein Agenten-Selbstvermessen, wohl aber das
//    Messinstrument des Nutzers).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { laufExtraktAusBericht, urteilPruefen } from '../shared/metrikRegeln.js'
import { projekteLaden } from './projekte.js'

const BERICHTE_ORDNER = 'laufberichte'

function metrikOrdner() {
  return path.join(app.getPath('userData'), 'metriken')
}
function urteilDatei() {
  return path.join(metrikOrdner(), 'lokale-ki.jsonl')
}

// Ein Urteil anhängen. Metriken sind Nebensache: Ein Schreibfehler darf
// keinen Lauf stören — deshalb still verschluckt.
export function metrikUrteilSchreiben({ projektPfad, laufId, block, modell, bereich, ausgang, schritte }) {
  const zeile = urteilPruefen({
    zeit: new Date().toISOString(),
    projektPfad,
    laufId,
    block,
    modell,
    bereich,
    ausgang,
    schritte
  })
  if (!zeile) return false
  try {
    fs.mkdirSync(metrikOrdner(), { recursive: true })
    fs.appendFileSync(urteilDatei(), JSON.stringify(zeile) + '\n', 'utf8')
    return true
  } catch {
    return false
  }
}

export function metrikUrteileLesen() {
  let text = ''
  try {
    text = fs.readFileSync(urteilDatei(), 'utf8')
  } catch {
    return []
  }
  const urteile = []
  for (const zeile of text.split('\n')) {
    if (!zeile.trim()) continue
    try {
      const geprueft = urteilPruefen(JSON.parse(zeile))
      if (geprueft) urteile.push(geprueft)
    } catch {
      // Halbe Zeile (Absturz mitten im Schreiben) — überspringen.
    }
  }
  return urteile
}

// Zwischenspeicher der Extrakte: Dateipfad → { mtimeMs, extrakt }.
const extraktCache = new Map()

function laufExtrakteEinesProjekts(projektPfad) {
  const ordner = path.join(projektPfad, BERICHTE_ORDNER)
  let dateien = []
  try {
    dateien = fs.readdirSync(ordner).filter((d) => d.endsWith('.json'))
  } catch {
    return []
  }
  const extrakte = []
  for (const datei of dateien) {
    const voll = path.join(ordner, datei)
    try {
      const mtimeMs = fs.statSync(voll).mtimeMs
      const alt = extraktCache.get(voll)
      if (alt && alt.mtimeMs === mtimeMs) {
        if (alt.extrakt) extrakte.push(alt.extrakt)
        continue
      }
      const extrakt = laufExtraktAusBericht(JSON.parse(fs.readFileSync(voll, 'utf8')), projektPfad)
      extraktCache.set(voll, { mtimeMs, extrakt })
      if (extrakt) extrakte.push(extrakt)
    } catch {
      // Kaputte Einzeldatei blockiert nicht die Auswertung.
    }
  }
  return extrakte
}

// Alles, was die Metriken-Seite braucht: bekannte Projekte (mit Hinweis auf
// fehlende Ordner), die Lauf-Extrakte und die Urteile der lokalen KI. Die
// Schnitte rechnet der Renderer nach dem Filtern (metrikRegeln.js) —
// die Extrakte sind schmal genug dafür.
export function metrikenLaden() {
  const projekte = projekteLaden().projekte
  const laeufe = []
  for (const projekt of projekte) {
    if (!projekt.gefunden) continue
    laeufe.push(...laufExtrakteEinesProjekts(projekt.pfad))
  }
  laeufe.sort((a, b) => (a.gestartetAm < b.gestartetAm ? -1 : 1))
  return {
    ok: true,
    projekte,
    fehlendeProjekte: projekte.filter((p) => !p.gefunden).map((p) => p.pfad),
    laeufe,
    urteile: metrikUrteileLesen()
  }
}
