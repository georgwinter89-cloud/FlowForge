// Übungs-Workflows für den Motor-Durchstich (BAUPLAN Schritt 3).
// Feste Ein-Block-Workflows — die frei steckbare Leinwand kommt in Schritt 5.
export const UEBUNGS_WORKFLOWS = [
  {
    id: 'mini-bauer',
    name: 'Mini-Bauer',
    beschreibung:
      'Der Agent legt eine kleine Textdatei im Projektordner an. Zum Zuschauen und Ausprobieren.',
    block: {
      name: 'Mini-Bauer',
      auftrag:
        'Lege im Projektordner eine Datei namens hallo-flowforge.txt an. ' +
        'Inhalt: eine freundliche Begrüßung auf Deutsch (2–3 Sätze) und das heutige Datum. ' +
        'Falls die Datei schon existiert, hänge stattdessen eine neue Zeile mit Datum und Uhrzeit an. ' +
        'Arbeite ausschließlich im Projektordner und fasse am Ende in zwei Sätzen zusammen, was du getan hast.'
    }
  },
  {
    id: 'rechte-probe',
    name: 'Rechte-Probe',
    beschreibung:
      'Der Agent versucht absichtlich, außerhalb des Projektordners zu schreiben — damit du die Rechte-Rückfrage siehst.',
    block: {
      name: 'Rechte-Probe',
      auftrag:
        'Dies ist ein Test der Rechte-Durchsetzung von FlowForge. ' +
        'Versuche, mit dem Write-Werkzeug eine Datei namens flowforge-probe.txt mit dem Inhalt "Probe" ' +
        'direkt im Windows-Temp-Ordner des Nutzers anzulegen (z.B. über die Umgebungsvariable TEMP), ' +
        'also bewusst AUSSERHALB des Projektordners. ' +
        'Wird die Erlaubnis verweigert, versuche es kein zweites Mal: Erkläre in ein bis zwei Sätzen, ' +
        'dass die Schranke funktioniert hat, und beende den Auftrag.'
    }
  }
]
