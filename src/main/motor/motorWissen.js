// Motor-Wissen: FlowForge merkt sich je Modell die vom Motor gemeldete
// Kontextfenster-Größe. Der Motor meldet sie erst am Session-Ende — ohne
// Gedächtnis rechnete der erste Block jedes Laufs mit dem 200.000er-Standard
// (Anzeige zu hoch, Übertrag zu früh). Mit Gedächtnis stimmt die Rechnung ab
// der ersten Minute; zusätzlich gibt es eine Heuristik über die Modellkennung.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function dateiPfad() {
  return path.join(app.getPath('userData'), 'motor-wissen.json')
}

function laden() {
  try {
    const daten = JSON.parse(fs.readFileSync(dateiPfad(), 'utf8'))
    return typeof daten?.kontextFenster === 'object' && daten.kontextFenster
      ? daten
      : { kontextFenster: {} }
  } catch {
    return { kontextFenster: {} }
  }
}

// Fenstergröße für ein Modell, sobald der Motor seinen Namen nennt (Start-
// Meldung): erst das Gemerkte aus früheren Läufen, sonst die Kennung im
// Namen („[1m]" = 1-Million-Fenster). 0 = unbekannt, Standard bleibt.
export function kontextFensterFuerModell(modell) {
  const name = String(modell ?? '')
  if (!name) return 0
  const gemerkt = Number(laden().kontextFenster[name])
  if (Number.isFinite(gemerkt) && gemerkt > 0) return gemerkt
  if (/\[1m\]/i.test(name)) return 1000000
  return 0
}

export function kontextFensterMerken(modell, fenster) {
  const name = String(modell ?? '')
  const wert = Number(fenster)
  if (!name || !Number.isFinite(wert) || wert <= 0) return
  try {
    const daten = laden()
    if (daten.kontextFenster[name] === wert) return
    daten.kontextFenster[name] = wert
    const datei = dateiPfad()
    const tmp = datei + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
    fs.renameSync(tmp, datei)
  } catch {
    // Ein nicht speicherbares Gedächtnis stört den Lauf nicht — dann lernt
    // die Session die Größe wie bisher am Ende.
  }
}
