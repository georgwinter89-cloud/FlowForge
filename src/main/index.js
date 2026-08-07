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
import { einstellungenLaden, einstellungenSpeichern } from './einstellungen.js'
import {
  laufStarten,
  laufSanftStoppen,
  laufHartStoppen,
  laufFrageAntworten,
  laufEntscheidungAntworten,
  laufMenschAntworten,
  laufZustand,
  laufberichteLaden
} from './lauf.js'
import { workflowLaden, workflowSpeichern } from './workflow.js'
import {
  sicherungspunkteLaden,
  wiederherstellenVorschau,
  wiederherstellen
} from './sicherungspunkte.js'
import { startanleitungLaden, appStarten } from './startanleitung.js'

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

  ipcMain.handle('einstellungen-laden', () => einstellungenLaden())
  ipcMain.handle('einstellungen-speichern', (_e, neu) => einstellungenSpeichern(neu))

  ipcMain.handle('workflow-laden', (_e, pfad) => workflowLaden(pfad))
  ipcMain.handle('workflow-speichern', (_e, { pfad, workflow }) => {
    // Kein Umbau eines Workflows, während er läuft (SPEC §10).
    if (laufZustand(pfad).aktiv) return { ok: false, fehler: texte.kette.fehlerWaehrendLauf }
    return workflowSpeichern(pfad, workflow)
  })

  ipcMain.handle('lauf-starten', (ereignis, { pfad, kartenIds }) =>
    laufStarten(BrowserWindow.fromWebContents(ereignis.sender), pfad, kartenIds)
  )
  ipcMain.handle('lauf-sanft-stoppen', (_e, pfad) => laufSanftStoppen(pfad))
  ipcMain.handle('lauf-hart-stoppen', (_e, pfad) => laufHartStoppen(pfad))
  ipcMain.handle('lauf-frage-antworten', (_e, { frageId, erlaubt }) =>
    laufFrageAntworten(frageId, erlaubt)
  )
  ipcMain.handle('lauf-entscheidung-antworten', (_e, { frageId, wahl }) =>
    laufEntscheidungAntworten(frageId, wahl)
  )
  ipcMain.handle('lauf-mensch-antworten', (_e, { frageId, antwort }) =>
    laufMenschAntworten(frageId, antwort)
  )
  ipcMain.handle('lauf-zustand', (_e, pfad) => laufZustand(pfad))
  ipcMain.handle('laufberichte-laden', (_e, pfad) => laufberichteLaden(pfad))

  // Startanleitung & „App starten"-Knopf (SPEC §8, BAUPLAN 10).
  ipcMain.handle('startanleitung-laden', (_e, pfad) => startanleitungLaden(pfad))
  ipcMain.handle('app-starten', (_e, pfad) => appStarten(pfad))

  ipcMain.handle('sicherungspunkte-laden', (_e, pfad) => sicherungspunkteLaden(pfad))
  ipcMain.handle('wiederherstellen-vorschau', (_e, { pfad, punktId }) => {
    if (laufZustand(pfad).aktiv) return { ok: false, fehler: texte.sicherungen.fehlerWaehrendLauf }
    return wiederherstellenVorschau(pfad, punktId)
  })
  ipcMain.handle('wiederherstellen', (_e, { pfad, punktId }) => {
    // Während ein Agent im Projekt schreibt, wird nichts zurückgesetzt.
    if (laufZustand(pfad).aktiv) return { ok: false, fehler: texte.sicherungen.fehlerWaehrendLauf }
    return wiederherstellen(pfad, punktId)
  })
}

app.whenReady().then(() => {
  // Ohne gesetzte App-ID zeigt Windows keine Benachrichtigungen von FlowForge
  // (SPEC §6: Frage-Blöcke melden sich per Windows-Benachrichtigung).
  app.setAppUserModelId('de.georgwinter.flowforge')
  registriereIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
