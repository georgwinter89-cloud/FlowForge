import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { texte } from '../shared/texte.js'
import {
  projektAnlegen,
  projekteLaden,
  projektOeffnen,
  projektVergessen,
  kontingentVerhaltenSetzen,
  pruefmappeUebersicht,
  karteAnlegen,
  karteAendern,
  karteErledigtSetzen,
  karteLoeschen,
  karteThemaSetzen,
  themaUmbenennen
} from './projekte.js'
import { einstellungenLaden, einstellungenSpeichern } from './einstellungen.js'
import { lokaleHelferPruefen } from './motor/lokaleHelfer.js'
import {
  laufStarten,
  sonderlaufStarten,
  laufFortsetzen,
  laufstandInfo,
  laufstandVerwerfen,
  laufSanftStoppen,
  laufHartStoppen,
  laufWarteschlangeVerlassen,
  laufFrageAntworten,
  laufEntscheidungAntworten,
  laufMenschAntworten,
  laufVorschlagAntworten,
  laufZustand,
  laufberichteLaden,
  projektZustaende
} from './lauf.js'
import { workflowLaden, workflowSpeichern } from './workflow.js'
import { laufVorschlagLaden, laufVorschlagLoeschen } from './naechsterLauf.js'
import {
  sicherungspunkteLaden,
  wiederherstellenVorschau,
  wiederherstellen
} from './sicherungspunkte.js'
import { startanleitungLaden } from './startanleitung.js'
import {
  appStarten,
  appStoppen,
  appNeustarten,
  appZustand,
  appAdresseOeffnen,
  alleAppsStoppen
} from './appProzess.js'
import { verwaisteListe, prozessBeenden, alleProzesseAbraeumen } from './prozesse.js'
import { eigeneBloeckeLaden, eigeneBloeckeListe, eigenenBlockLoeschen } from './eigeneBloecke.js'
import { blockVorschlagErstellen } from './blockAssistent.js'
import {
  eigeneEtikettenLaden,
  eigeneEtikettenListe,
  eigenesEtikettSpeichern,
  eigenesEtikettLoeschen,
  blockSpeichernMitEtiketten,
  etikettenAbgleichen
} from './eigeneEtiketten.js'
import { etikettVorschlagErstellen } from './etikettAssistent.js'
import { klappenLaden, klappenSpeichern } from './klappen.js'
import { metrikenLaden } from './metriken.js'
import {
  chatZustand,
  chatSenden,
  chatReparierenSetzen,
  chatAbbrechen,
  chatNeu,
  chatFrageAntworten
} from './chat.js'

// App-Icon (BAUPLAN 30) für Fenster und Taskleiste: verpackt liegt die PNG
// als extraResource neben der App (process.resourcesPath), im Dev im
// Projektordner unter build/ (out/main → ../../build).
function iconPfad() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '../../build/icon.png')
}

function createWindow() {
  const fenster = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPfad(),
    title: texte.fensterTitel,
    autoHideMenuBar: true,
    // Dunkle Werkbank (Mockup-Runden 3+4): das Fenster malt schon vor dem
    // ersten Renderer-Bild dunkel (kein weißer Blitz), die Titelleiste ist
    // die eigene Kopfleiste — Windows zeichnet nur ─ □ × passend dunkel.
    // Die Overlay-Höhe muss der CSS-Höhe der .kopfleiste entsprechen.
    backgroundColor: '#0a0e18',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0e18', symbolColor: '#c3cde0', height: 56 },
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
  // Themen (BAUPLAN 30): Karte per Drag & Drop in ein anderes Thema, Thema umbenennen.
  ipcMain.handle('karte-thema-setzen', (_e, { pfad, id, thema }) => karteThemaSetzen(pfad, id, thema))
  ipcMain.handle('thema-umbenennen', (_e, { pfad, alt, neu }) => themaUmbenennen(pfad, alt, neu))
  // Sonderläufe (BAUPLAN 30): Aufräum-Knöpfe der Karten-Seitenleiste.
  ipcMain.handle('sonderlauf-starten', (ereignis, { pfad, art }) =>
    sonderlaufStarten(BrowserWindow.fromWebContents(ereignis.sender), pfad, art)
  )

  ipcMain.handle('einstellungen-laden', () => einstellungenLaden())
  ipcMain.handle('einstellungen-speichern', (_e, neu) => einstellungenSpeichern(neu))
  // Lokale Helfer-KI (Experiment): Statusanzeige in den Einstellungen.
  ipcMain.handle('lokale-helfer-status', (_e, { modell, adresse } = {}) =>
    lokaleHelferPruefen(String(modell ?? ''), String(adresse ?? '') || undefined)
  )

  // Block-Editor mit KI-Assistent (SPEC §4.5, BAUPLAN 14).
  ipcMain.handle('eigene-bloecke-laden', () => eigeneBloeckeListe())
  // Block speichern MIT Etiketten-Abgleich (BAUPLAN 48, K2): kanonische
  // Schreibweise bekannter Etiketten, Auto-Anlage unbekannter — Rückgabe
  // { ok, bloecke, etiketten, hinweise }.
  ipcMain.handle('eigener-block-speichern', (_e, block) => blockSpeichernMitEtiketten(block))
  ipcMain.handle('eigener-block-loeschen', (_e, id) => eigenenBlockLoeschen(id))
  ipcMain.handle('block-assistent', (_e, beschreibung) => blockVorschlagErstellen(beschreibung))
  // Etiketten-Bibliothek (SPEC §4.5, BAUPLAN 48): Rückgaben immer der
  // Gesamtstand { ok, etiketten } bzw. { ok: false, fehler }.
  ipcMain.handle('eigene-etiketten-laden', () => eigeneEtikettenListe())
  ipcMain.handle('eigenes-etikett-speichern', (_e, etikett) => eigenesEtikettSpeichern(etikett))
  ipcMain.handle('eigenes-etikett-loeschen', (_e, id) => eigenesEtikettLoeschen(id))
  ipcMain.handle('etikett-assistent', (_e, eingabe) => etikettVorschlagErstellen(eingabe ?? {}))
  // Einklapp-Zustände je Projekt (BAUPLAN 30): Karten-Gruppen, Themen,
  // Bibliotheks-Klappen — im Datenordner, nicht in projekt.json.
  ipcMain.handle('klappen-laden', (_e, pfad) => klappenLaden(pfad))
  ipcMain.handle('klappen-speichern', (_e, { pfad, zustaende }) => klappenSpeichern(pfad, zustaende))

  ipcMain.handle('workflow-laden', (_e, pfad) => workflowLaden(pfad))
  ipcMain.handle('workflow-speichern', (_e, { pfad, workflow }) => {
    // Kein Umbau eines Workflows, während er läuft (SPEC §10) — oder während
    // er in der Warteschlange auf seinen automatischen Start wartet.
    const zustand = laufZustand(pfad)
    if (zustand.aktiv) return { ok: false, fehler: texte.kette.fehlerWaehrendLauf }
    if (zustand.wartet) return { ok: false, fehler: texte.kette.fehlerWaehrendWarteschlange }
    return workflowSpeichern(pfad, workflow)
  })

  ipcMain.handle('lauf-starten', (ereignis, { pfad, kartenIds }) =>
    laufStarten(BrowserWindow.fromWebContents(ereignis.sender), pfad, kartenIds)
  )
  // Wiederaufnahme nach Neustart mitten im Lauf (SPEC §3.3, BAUPLAN 11).
  ipcMain.handle('laufstand-info', (_e, pfad) => laufstandInfo(pfad))
  ipcMain.handle('laufstand-verwerfen', (_e, pfad) => laufstandVerwerfen(pfad))
  ipcMain.handle('lauf-fortsetzen', (ereignis, pfad) =>
    laufFortsetzen(BrowserWindow.fromWebContents(ereignis.sender), pfad)
  )
  // Kontingent-Verhalten pro Projekt (SPEC §5, BAUPLAN 11).
  ipcMain.handle('kontingent-verhalten-setzen', (_e, { pfad, verhalten }) =>
    kontingentVerhaltenSetzen(pfad, verhalten)
  )
  ipcMain.handle('lauf-sanft-stoppen', (_e, pfad) => laufSanftStoppen(pfad))
  ipcMain.handle('lauf-hart-stoppen', (_e, pfad) => laufHartStoppen(pfad))
  // Warteschlange (BAUPLAN 12): einen vorgemerkten Start wieder herausnehmen.
  ipcMain.handle('lauf-warteschlange-verlassen', (_e, pfad) => laufWarteschlangeVerlassen(pfad))
  ipcMain.handle('lauf-frage-antworten', (_e, { frageId, erlaubt }) => {
    // Rechte-Rückfragen kommen aus Läufen UND aus dem Nachlauf-Chat (BAUPLAN
    // 27) — beide nutzen denselben Dialog; die Frage-IDs sind UUIDs.
    const ergebnis = laufFrageAntworten(frageId, erlaubt)
    return ergebnis.ok ? ergebnis : chatFrageAntworten(frageId, erlaubt)
  })
  ipcMain.handle('lauf-entscheidung-antworten', (_e, { frageId, wahl }) =>
    laufEntscheidungAntworten(frageId, wahl)
  )
  ipcMain.handle('lauf-mensch-antworten', (_e, { frageId, antwort }) =>
    laufMenschAntworten(frageId, antwort)
  )
  // Karten-Vorschläge (BAUPLAN 26): die Entscheidung aus dem Abnahme-Dialog.
  ipcMain.handle('lauf-vorschlag-antworten', (_e, { frageId, wahl, felder }) =>
    laufVorschlagAntworten(frageId, wahl, felder)
  )
  ipcMain.handle('lauf-zustand', (_e, pfad) => laufZustand(pfad))
  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): die Vorschlags-Zeile an
  // der Kartenauswahl — gelöschte Karten fallen beim Laden still heraus.
  ipcMain.handle('naechster-lauf-laden', (_e, pfad) => ({
    ok: true,
    vorschlag: laufVorschlagLaden(pfad)
  }))
  ipcMain.handle('naechster-lauf-verwerfen', (_e, pfad) => {
    laufVorschlagLoeschen(pfad)
    return { ok: true }
  })
  // Co-Pilot (BAUPLAN 27/33): ein Chat für Bedienung und Projekt — pfad null
  // heißt Projektübersicht (nur Bedienfragen). Während eines Laufs ist der
  // Chat nur lesend (entscheidet chat.js je Werkzeugaufruf), nicht gesperrt.
  ipcMain.handle('chat-zustand', (ereignis, pfad) =>
    chatZustand(BrowserWindow.fromWebContents(ereignis.sender), pfad ?? null)
  )
  ipcMain.handle('chat-senden', (ereignis, { pfad, text, bilder }) =>
    chatSenden(BrowserWindow.fromWebContents(ereignis.sender), pfad ?? null, text, bilder)
  )
  ipcMain.handle('chat-reparieren', (_e, { pfad, an }) => chatReparierenSetzen(pfad ?? null, an))
  ipcMain.handle('chat-abbrechen', (_e, pfad) => chatAbbrechen(pfad ?? null))
  ipcMain.handle('chat-neu', (_e, pfad) => chatNeu(pfad ?? null))
  ipcMain.handle('laufberichte-laden', (_e, pfad) => laufberichteLaden(pfad))
  // Metriken (BAUPLAN 31): lokale KI und Motor über alle bekannten Projekte —
  // Extrakte und Urteile; die Schnitte rechnet die Oberfläche nach dem Filtern.
  ipcMain.handle('metriken-laden', () => metrikenLaden())
  // Prüfmappen-Ansicht an der Prüferkarte (BAUPLAN 17) — nur zum Nachlesen.
  // ordner (BAUPLAN 41): der Prüfordner dieser Prüf-Instanz.
  ipcMain.handle('pruefmappe-lesen', (_e, { pfad, ordner }) =>
    pruefmappeUebersicht(pfad, ordner ?? '')
  )
  // Zustände für die Kacheln der Projektübersicht (SPEC §9, BAUPLAN 15).
  ipcMain.handle('projekt-zustaende', (_e, pfade) => projektZustaende(pfade))

  // Startanleitung & App-Tab (SPEC §8, BAUPLAN 10/32): Start, Stopp, Neustart,
  // Zustand samt Ausgabe, Adresse öffnen; dazu die Rückfall-Liste noch
  // laufender Prozesse aus Läufen mit Beenden-Knopf.
  ipcMain.handle('startanleitung-laden', (_e, pfad) => startanleitungLaden(pfad))
  ipcMain.handle('app-starten', (_e, { pfad, portFreimachen }) =>
    appStarten(pfad, { portFreimachen: Boolean(portFreimachen) })
  )
  ipcMain.handle('app-stoppen', (_e, pfad) => appStoppen(pfad))
  ipcMain.handle('app-neustarten', (_e, pfad) => appNeustarten(pfad))
  ipcMain.handle('app-zustand', (_e, pfad) => appZustand(pfad))
  ipcMain.handle('app-adresse-oeffnen', (_e, pfad) => appAdresseOeffnen(pfad))
  ipcMain.handle('verwaiste-prozesse', async () => ({ ok: true, prozesse: await verwaisteListe() }))
  ipcMain.handle('prozess-beenden', (_e, { pid, start }) => prozessBeenden(Number(pid), Number(start)))

  ipcMain.handle('sicherungspunkte-laden', (_e, pfad) => sicherungspunkteLaden(pfad))
  ipcMain.handle('wiederherstellen-vorschau', (_e, { pfad, punktId }) => {
    const zustand = laufZustand(pfad)
    if (zustand.aktiv) return { ok: false, fehler: texte.sicherungen.fehlerWaehrendLauf }
    if (zustand.wartet)
      return { ok: false, fehler: texte.sicherungen.fehlerWaehrendWarteschlange }
    return wiederherstellenVorschau(pfad, punktId)
  })
  ipcMain.handle('wiederherstellen', (_e, { pfad, punktId }) => {
    // Während ein Agent im Projekt schreibt (oder gleich schreiben wird),
    // wird nichts zurückgesetzt.
    const zustand = laufZustand(pfad)
    if (zustand.aktiv) return { ok: false, fehler: texte.sicherungen.fehlerWaehrendLauf }
    if (zustand.wartet)
      return { ok: false, fehler: texte.sicherungen.fehlerWaehrendWarteschlange }
    return wiederherstellen(pfad, punktId)
  })
}

app.whenReady().then(() => {
  // Ohne gesetzte App-ID zeigt Windows keine Benachrichtigungen von FlowForge
  // (SPEC §6: Frage-Blöcke melden sich per Windows-Benachrichtigung).
  app.setAppUserModelId('de.georgwinter.flowforge')

  // Verpackt gibt es kein Menü — sonst schiebt die Alt-Taste das native Menü
  // über die versteckte Titelleiste. Im Dev bleiben F12/Strg+R über das Menü.
  if (app.isPackaged) Menu.setApplicationMenu(null)
  // Eigene Blöcke VOR der IPC-Registrierung laden: workflowLaden wirft Blöcke,
  // die es nicht auflösen kann, stillschweigend aus dem Schaubild.
  // Reihenfolge (BAUPLAN 48, K18): erst die Etiketten (der Lieferschein löst
  // eigene Etiketten mit Feldern über die Registry auf), dann die Blöcke, dann
  // der Abgleich des Altbestands — jedes Etikett eigener Blöcke existiert
  // danach in der Bibliothek und steht in kanonischer Schreibweise.
  eigeneEtikettenLaden()
  eigeneBloeckeLaden()
  etikettenAbgleichen()
  registriereIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// FlowForge-Ende räumt ab (BAUPLAN 32): Node beendet unter Windows keine
// Kinder — laufende Motoren, Chats, die gestartete App und alle gemerkten
// Nachkommen werden beim normalen Beenden mit beendet. „Nichts läuft
// unsichtbar weiter" gilt fürs normale Beenden, nicht für einen Absturz. Ein
// unterbrochener Lauf bleibt als Laufstand wiederaufnehmbar (SPEC §3.3).
let abgeraeumt = false
app.on('before-quit', (ereignis) => {
  if (abgeraeumt) return
  abgeraeumt = true
  ereignis.preventDefault()
  const aufraeumen = (async () => {
    try {
      await alleAppsStoppen()
    } catch {
      // weiter — der Rest räumt trotzdem
    }
    try {
      await alleProzesseAbraeumen()
    } catch {
      // nicht hängen bleiben
    }
  })()
  Promise.race([aufraeumen, new Promise((r) => setTimeout(r, 6000))]).then(() => app.quit())
})
