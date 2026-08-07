import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { texte } from '../shared/texte.js'
import {
  projektAnlegen,
  projekteLaden,
  projektOeffnen,
  projektVergessen,
  karteAnlegen,
  karteAendern,
  karteErledigtSetzen,
  karteLoeschen
} from './projekte.js'

function createWindow() {
  const fenster = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: texte.fensterTitel,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    fenster.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    fenster.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registriereIpc() {
  ipcMain.handle('ablageort-waehlen', async (ereignis) => {
    const fenster = BrowserWindow.fromWebContents(ereignis.sender)
    const ergebnis = await dialog.showOpenDialog(fenster, {
      title: texte.neuesProjekt.ablageortFeld,
      properties: ['openDirectory', 'createDirectory']
    })
    return ergebnis.canceled ? { ok: false } : { ok: true, pfad: ergebnis.filePaths[0] }
  })

  ipcMain.handle('projekt-anlegen', (_e, { name, ablageort }) => projektAnlegen(name, ablageort))
  ipcMain.handle('projekte-laden', () => projekteLaden())
  ipcMain.handle('projekt-oeffnen', (_e, pfad) => projektOeffnen(pfad))
  ipcMain.handle('projekt-vergessen', (_e, pfad) => projektVergessen(pfad))
  ipcMain.handle('karte-anlegen', (_e, { pfad, karte }) => karteAnlegen(pfad, karte))
  ipcMain.handle('karte-aendern', (_e, { pfad, id, aenderung }) => karteAendern(pfad, id, aenderung))
  ipcMain.handle('karte-erledigt-setzen', (_e, { pfad, id, erledigt }) =>
    karteErledigtSetzen(pfad, id, erledigt)
  )
  ipcMain.handle('karte-loeschen', (_e, { pfad, id }) => karteLoeschen(pfad, id))
}

app.whenReady().then(() => {
  registriereIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
