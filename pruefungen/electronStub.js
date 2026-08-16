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

// Damit sich auch lauf.js laden lässt (Ladbarkeits-Prüfung seit BAUPLAN 42):
// Es importiert BrowserWindow und Notification, ruft sie beim Laden aber nicht.
export const BrowserWindow = { getAllWindows: () => [] }
export function Notification() {}
Notification.isSupported = () => false
export const ipcMain = { handle: () => {}, on: () => {} }
export const dialog = {}
export const shell = {}

export default { app, BrowserWindow, Notification, ipcMain, dialog, shell }
