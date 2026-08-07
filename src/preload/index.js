// Brücke zwischen Oberfläche und Hauptprozess: nur diese Funktionen sind freigegeben.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('flowforge', {
  ablageortWaehlen: () => ipcRenderer.invoke('ablageort-waehlen'),
  projektAnlegen: (name, ablageort) => ipcRenderer.invoke('projekt-anlegen', { name, ablageort }),
  projekteLaden: () => ipcRenderer.invoke('projekte-laden'),
  projektOeffnen: (pfad) => ipcRenderer.invoke('projekt-oeffnen', pfad),
  projektVergessen: (pfad) => ipcRenderer.invoke('projekt-vergessen', pfad),
  karteAnlegen: (pfad, karte) => ipcRenderer.invoke('karte-anlegen', { pfad, karte }),
  karteAendern: (pfad, id, aenderung) => ipcRenderer.invoke('karte-aendern', { pfad, id, aenderung }),
  karteErledigtSetzen: (pfad, id, erledigt) =>
    ipcRenderer.invoke('karte-erledigt-setzen', { pfad, id, erledigt }),
  karteLoeschen: (pfad, id) => ipcRenderer.invoke('karte-loeschen', { pfad, id }),

  einstellungenLaden: () => ipcRenderer.invoke('einstellungen-laden'),
  einstellungenSpeichern: (neu) => ipcRenderer.invoke('einstellungen-speichern', neu),

  laufStarten: (pfad, workflowId) => ipcRenderer.invoke('lauf-starten', { pfad, workflowId }),
  laufSanftStoppen: (pfad) => ipcRenderer.invoke('lauf-sanft-stoppen', pfad),
  laufHartStoppen: (pfad) => ipcRenderer.invoke('lauf-hart-stoppen', pfad),
  laufFrageAntworten: (frageId, erlaubt) =>
    ipcRenderer.invoke('lauf-frage-antworten', { frageId, erlaubt }),
  laufZustand: (pfad) => ipcRenderer.invoke('lauf-zustand', pfad),
  laufberichteLaden: (pfad) => ipcRenderer.invoke('laufberichte-laden', pfad),
  aufLaufEreignis: (rueckruf) => {
    const empfaenger = (_ereignis, daten) => rueckruf(daten)
    ipcRenderer.on('lauf-ereignis', empfaenger)
    return () => ipcRenderer.removeListener('lauf-ereignis', empfaenger)
  }
})
