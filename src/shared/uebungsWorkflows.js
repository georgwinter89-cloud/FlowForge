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
        'Dies ist ein Test der Rechte-Durchsetzung von FlowForge. Antworte auf Deutsch. ' +
        'Wichtig zum Verständnis: Bei Aktionen außerhalb des Projektordners zeigt FlowForge dem Nutzer ' +
        'eine Erlaubnis-Frage, die du selbst NICHT siehst — du merkst nur, ob die Aktion durchgelassen ' +
        'oder abgelehnt wird. Beides ist ein Erfolg dieses Tests. ' +
        'Versuche jetzt, mit dem Write-Werkzeug eine Datei namens flowforge-probe.txt mit dem Inhalt "Probe" ' +
        'direkt im Windows-Temp-Ordner des Nutzers anzulegen, also bewusst AUSSERHALB des Projektordners. ' +
        'Genau ein Versuch, kein zweiter. ' +
        'Wird die Aktion abgelehnt: Erkläre in ein bis zwei Sätzen, dass der Nutzer sie in der ' +
        'Erlaubnis-Frage abgelehnt hat und die Schranke funktioniert. ' +
        'Geht die Aktion durch: Erkläre in ein bis zwei Sätzen, dass der Nutzer sie in der ' +
        'Erlaubnis-Frage bewusst freigegeben hat — auch dann hat die Schranke funktioniert. ' +
        'Schlage in keinem Fall Änderungen an FlowForge, Einstellungen oder Berechtigungsregeln vor.'
    }
  }
]
