// Laufstand (SPEC §3.3, BAUPLAN 11): Während ein Workflow läuft, hält FlowForge
// den Zwischenstand als laufstand.json im Projektordner fest — Blockposition,
// Kartenauswahl, Übergaben. Endet der Lauf normal, verschwindet die Datei.
// Bleibt sie liegen (App-/Rechner-Neustart mitten im Lauf), bietet die App an,
// am letzten Sicherungspunkt weiterzumachen.
//
// Die Datei ist eine Verwaltungsdatei: für den Agenten gesperrt (Motor) und von
// Sicherungspunkten ausgenommen (sicherungspunkte.js) — sonst würde eine
// Wiederherstellung einen veralteten „unterbrochenen Lauf" zurückholen.
import fs from 'node:fs'
import path from 'node:path'

const LAUFSTAND_DATEI = 'laufstand.json'

export function laufstandSpeichern(projektPfad, stand) {
  try {
    const datei = path.join(projektPfad, LAUFSTAND_DATEI)
    const tmp = datei + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(stand, null, 2), 'utf8')
    fs.renameSync(tmp, datei)
  } catch {
    // Ein nicht speicherbarer Laufstand darf den Lauf selbst nicht stören —
    // dann fehlt schlimmstenfalls das Wiederaufnahme-Angebot.
  }
}

export function laufstandLaden(projektPfad) {
  try {
    const stand = JSON.parse(
      fs.readFileSync(path.join(projektPfad, LAUFSTAND_DATEI), 'utf8')
    )
    if (!stand || !Array.isArray(stand.kettenIds)) return null
    // Seit den parallelen Zweigen (BAUPLAN 13) hält der Laufstand die fertigen
    // Blöcke statt einer Position. Das alte Positions-Format wird noch geladen,
    // damit das Wiederaufnahme-Angebot erscheint — fortsetzen lässt es sich
    // nicht mehr (die Prüfung in laufStarten lehnt es sauber ab).
    if (!Array.isArray(stand.fertigIds) && !Number.isInteger(stand.index)) return null
    return stand
  } catch {
    return null
  }
}

export function laufstandLoeschen(projektPfad) {
  try {
    fs.rmSync(path.join(projektPfad, LAUFSTAND_DATEI), { force: true })
  } catch {
    // Nicht löschbar: schlimmstenfalls ein überflüssiges Wiederaufnahme-Angebot.
  }
}
