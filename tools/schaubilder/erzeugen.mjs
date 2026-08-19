// Rendert die gestalteten Schaubilder fürs README (jede *.html in diesem Ordner)
// als PNG nach docs/bilder/<name>.png — in einem unsichtbaren Electron-Fenster,
// mit den Schriften und Farben der App (Archivo, JetBrains Mono, stil.css-Töne).
// Jede Seite meldet ihre Größe über den Titel „FERTIG BxH". Aufruf:
// `npm run schaubilder` (alle) oder `npm run schaubilder -- ueberblick` (eins).
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Eigener Datenordner — nicht der von FlowForge, nicht Roaming\Electron.
app.setPath('userData', path.join(os.tmpdir(), 'flowforge-schaubilder'))

const hier = path.dirname(fileURLToPath(import.meta.url))
const zielOrdner = path.join(hier, '..', '..', 'docs', 'bilder')
const SKALA = 1.5

const warten = (ms) => new Promise((r) => setTimeout(r, ms))

// Ein Fenster für alle Seiten — ein zweites Offscreen-Fenster nach destroy()
// lädt file:// nicht mehr (ERR_FAILED); nacheinander laden geht.
async function rendern(fenster, name) {
  fenster.webContents.setZoomFactor(1)
  await fenster.loadURL(pathToFileURL(path.join(hier, `${name}.html`)).href)
  const start = Date.now()
  let titel = ''
  while (Date.now() - start < 30000) {
    titel = fenster.getTitle()
    if (titel.startsWith('FERTIG') || titel.startsWith('FEHLER')) break
    await warten(200)
  }
  if (!titel.startsWith('FERTIG')) throw new Error(`${name}: ${titel || 'Zeitüberschreitung'}`)
  const [breite, hoehe] = titel.slice(7).split('x').map(Number)
  // Zoom = Skala: so kommt ein scharfes Bild in doppelter Auflösung heraus.
  fenster.webContents.setZoomFactor(SKALA)
  fenster.setSize(breite * SKALA, hoehe * SKALA)
  await warten(800)
  const bild = await fenster.webContents.capturePage({ x: 0, y: 0, width: breite * SKALA, height: hoehe * SKALA })
  if (bild.isEmpty()) throw new Error(`${name}: leeres Bild`)
  fs.mkdirSync(zielOrdner, { recursive: true })
  const datei = path.join(zielOrdner, `${name}.png`)
  fs.writeFileSync(datei, bild.toPNG())
  console.log('geschrieben', path.relative(process.cwd(), datei), `${breite}x${hoehe} @${SKALA}`, fs.statSync(datei).size, 'Bytes')
}

app.whenReady().then(async () => {
  const alle = fs.readdirSync(hier).filter((d) => d.endsWith('.html')).map((d) => d.slice(0, -5))
  const nur = process.argv.slice(2).filter((a) => alle.includes(a))
  const fenster = new BrowserWindow({
    show: false,
    width: 1800,
    height: 1400,
    backgroundColor: '#0a0e18',
    webPreferences: { offscreen: true, zoomFactor: 1 }
  })
  let fehler = 0
  for (const name of nur.length ? nur : alle) {
    try {
      await rendern(fenster, name)
    } catch (e) {
      fehler++
      console.error('FEHLER', e.message)
    }
  }
  fenster.destroy()
  app.exit(fehler ? 1 : 0)
})
