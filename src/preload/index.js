// Brücke zwischen Oberfläche und Hauptprozess: nur diese Funktionen sind freigegeben.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('flowforge', {
  ablageortWaehlen: () => ipcRenderer.invoke('ablageort-waehlen'),
  projektAnlegen: (name, ablageort) => ipcRenderer.invoke('projekt-anlegen', { name, ablageort }),
  projekteLaden: () => ipcRenderer.invoke('projekte-laden'),
  projektOeffnen: (pfad) => ipcRenderer.invoke('projekt-oeffnen', pfad),
  projektVergessen: (pfad) => ipcRenderer.invoke('projekt-vergessen', pfad),
  projektZustaende: (pfade) => ipcRenderer.invoke('projekt-zustaende', pfade),
  karteAnlegen: (pfad, karte) => ipcRenderer.invoke('karte-anlegen', { pfad, karte }),
  karteAendern: (pfad, id, aenderung) => ipcRenderer.invoke('karte-aendern', { pfad, id, aenderung }),
  karteErledigtSetzen: (pfad, id, erledigt) =>
    ipcRenderer.invoke('karte-erledigt-setzen', { pfad, id, erledigt }),
  karteLoeschen: (pfad, id) => ipcRenderer.invoke('karte-loeschen', { pfad, id }),
  karteThemaSetzen: (pfad, id, thema) => ipcRenderer.invoke('karte-thema-setzen', { pfad, id, thema }),
  themaUmbenennen: (pfad, alt, neu) => ipcRenderer.invoke('thema-umbenennen', { pfad, alt, neu }),
  sonderlaufStarten: (pfad, art) => ipcRenderer.invoke('sonderlauf-starten', { pfad, art }),

  einstellungenLaden: () => ipcRenderer.invoke('einstellungen-laden'),
  einstellungenSpeichern: (neu) => ipcRenderer.invoke('einstellungen-speichern', neu),
  lokaleHelferStatus: (modell, adresse) =>
    ipcRenderer.invoke('lokale-helfer-status', { modell, adresse }),

  eigeneBloeckeLaden: () => ipcRenderer.invoke('eigene-bloecke-laden'),
  eigenenBlockSpeichern: (block) => ipcRenderer.invoke('eigener-block-speichern', block),
  eigenenBlockLoeschen: (id) => ipcRenderer.invoke('eigener-block-loeschen', id),
  blockAssistent: (beschreibung) => ipcRenderer.invoke('block-assistent', beschreibung),
  klappenLaden: (pfad) => ipcRenderer.invoke('klappen-laden', pfad),
  klappenSpeichern: (pfad, zustaende) => ipcRenderer.invoke('klappen-speichern', { pfad, zustaende }),

  workflowLaden: (pfad) => ipcRenderer.invoke('workflow-laden', pfad),
  workflowSpeichern: (pfad, workflow) => ipcRenderer.invoke('workflow-speichern', { pfad, workflow }),

  laufStarten: (pfad, kartenIds) => ipcRenderer.invoke('lauf-starten', { pfad, kartenIds }),
  laufstandInfo: (pfad) => ipcRenderer.invoke('laufstand-info', pfad),
  laufstandVerwerfen: (pfad) => ipcRenderer.invoke('laufstand-verwerfen', pfad),
  laufFortsetzen: (pfad) => ipcRenderer.invoke('lauf-fortsetzen', pfad),
  kontingentVerhaltenSetzen: (pfad, verhalten) =>
    ipcRenderer.invoke('kontingent-verhalten-setzen', { pfad, verhalten }),
  laufSanftStoppen: (pfad) => ipcRenderer.invoke('lauf-sanft-stoppen', pfad),
  laufHartStoppen: (pfad) => ipcRenderer.invoke('lauf-hart-stoppen', pfad),
  laufWarteschlangeVerlassen: (pfad) => ipcRenderer.invoke('lauf-warteschlange-verlassen', pfad),
  laufFrageAntworten: (frageId, erlaubt) =>
    ipcRenderer.invoke('lauf-frage-antworten', { frageId, erlaubt }),
  laufEntscheidungAntworten: (frageId, wahl) =>
    ipcRenderer.invoke('lauf-entscheidung-antworten', { frageId, wahl }),
  laufMenschAntworten: (frageId, antwort) =>
    ipcRenderer.invoke('lauf-mensch-antworten', { frageId, antwort }),
  laufVorschlagAntworten: (frageId, wahl, felder) =>
    ipcRenderer.invoke('lauf-vorschlag-antworten', { frageId, wahl, felder }),
  laufZustand: (pfad) => ipcRenderer.invoke('lauf-zustand', pfad),
  naechsterLaufLaden: (pfad) => ipcRenderer.invoke('naechster-lauf-laden', pfad),
  naechsterLaufVerwerfen: (pfad) => ipcRenderer.invoke('naechster-lauf-verwerfen', pfad),
  chatZustand: (pfad) => ipcRenderer.invoke('chat-zustand', pfad),
  chatSenden: (pfad, text, bilder) => ipcRenderer.invoke('chat-senden', { pfad, text, bilder }),
  chatReparierenSetzen: (pfad, an) => ipcRenderer.invoke('chat-reparieren', { pfad, an }),
  chatAbbrechen: (pfad) => ipcRenderer.invoke('chat-abbrechen', pfad),
  laufberichteLaden: (pfad) => ipcRenderer.invoke('laufberichte-laden', pfad),
  metrikenLaden: () => ipcRenderer.invoke('metriken-laden'),
  pruefmappeLesen: (pfad) => ipcRenderer.invoke('pruefmappe-lesen', pfad),
  startanleitungLaden: (pfad) => ipcRenderer.invoke('startanleitung-laden', pfad),
  appStarten: (pfad) => ipcRenderer.invoke('app-starten', pfad),
  sicherungspunkteLaden: (pfad) => ipcRenderer.invoke('sicherungspunkte-laden', pfad),
  wiederherstellenVorschau: (pfad, punktId) =>
    ipcRenderer.invoke('wiederherstellen-vorschau', { pfad, punktId }),
  wiederherstellen: (pfad, punktId) => ipcRenderer.invoke('wiederherstellen', { pfad, punktId }),
  aufLaufEreignis: (rueckruf) => {
    const empfaenger = (_ereignis, daten) => rueckruf(daten)
    ipcRenderer.on('lauf-ereignis', empfaenger)
    return () => ipcRenderer.removeListener('lauf-ereignis', empfaenger)
  }
})
