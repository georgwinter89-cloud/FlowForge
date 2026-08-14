// Electron-Ersatz für die Prüfskripte: Die Motor-Module importieren { app }
// aus 'electron' (userData-Pfad). Für die Regel-Prüfungen reicht ein
// Wegwerf-Ordner im Temp-Verzeichnis.
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const datenOrdner = path.join(os.tmpdir(), 'flowforge-pruefungen')
fs.mkdirSync(datenOrdner, { recursive: true })

export const app = {
  getPath: () => datenOrdner,
  isPackaged: false
}

export default { app }
