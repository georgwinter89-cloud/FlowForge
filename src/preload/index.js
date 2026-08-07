// Brücke zwischen Oberfläche und Hauptprozess.
// Ab Bauschritt 2 werden hier gezielt Funktionen freigegeben (z.B. Projekt anlegen).
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('flowforge', {})
