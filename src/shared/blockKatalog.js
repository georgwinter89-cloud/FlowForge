// Blockbibliothek V1, Bauschritt 5: bewusst triviale Übungs-Blöcke (BAUPLAN 5) —
// die echten Arbeitsaufträge (Kontext laden, Angreifer, Bauer, Prüfer …) kommen in
// Schritt 7/8. Anatomie eines Blocks laut SPEC §4.2: Name · Symbol · Arbeitsauftrag ·
// braucht/liefert · Sperren (nur lesen, Pflichtfelder).
//
// Prüfer-Blöcke (prueft: true) müssen ihr Urteil als letzte Zeile ausgeben:
// „PRUEFUNG: BESTANDEN" oder „PRUEFUNG: FEHLGESCHLAGEN" — FlowForge wertet das aus.

export const REPARATUR_RUNDEN_STANDARD = 2
export const REPARATUR_RUNDEN_MAX = 9

export const BLOCK_KATALOG = [
  {
    id: 'spaeher',
    name: 'Späher',
    symbol: '🔍',
    beschreibung:
      'Sieht sich den Projektordner an und fasst zusammen, was drin liegt. Darf nichts verändern.',
    braucht: [],
    liefert: ['Projekt-Überblick'],
    nurLesen: true,
    prueft: false,
    felder: [],
    auftrag:
      'Sieh dich im Projektordner um (Dateien und deren Inhalte) und fasse auf Deutsch ' +
      'in drei bis fünf Sätzen zusammen, was in diesem Projekt liegt. ' +
      'Du darfst nichts verändern — nur lesen.'
  },
  {
    id: 'mini-bauer',
    name: 'Mini-Bauer',
    symbol: '🔨',
    beschreibung:
      'Legt eine kleine Textdatei im Projektordner an — oder verbessert sie, wenn es sie schon gibt.',
    braucht: [],
    liefert: ['Textdatei'],
    nurLesen: false,
    prueft: false,
    felder: [
      {
        id: 'dateiname',
        label: 'Dateiname der Textdatei',
        platzhalter: 'z.B. gruss.txt',
        pflicht: true
      }
    ],
    auftrag:
      'Lege im Projektordner eine Textdatei namens {{dateiname}} an. ' +
      'Inhalt: eine freundliche Begrüßung auf Deutsch (2–3 Sätze) und das heutige Datum. ' +
      'Falls die Datei schon existiert, verbessere den Text ein wenig und hänge eine neue ' +
      'Zeile mit Datum und Uhrzeit an. Arbeite ausschließlich im Projektordner und fasse ' +
      'am Ende in zwei Sätzen zusammen, was du getan hast.'
  },
  {
    id: 'pruefer-fair',
    name: 'Übungs-Prüfer (fair)',
    symbol: '✅',
    beschreibung:
      'Prüft die Textdatei und lässt sie durch, wenn sie in Ordnung ist. Darf nichts verändern.',
    braucht: ['Textdatei'],
    liefert: ['Prüfbeleg'],
    nurLesen: true,
    prueft: true,
    felder: [],
    auftrag:
      'Du bist der Prüfer. Sieh dir die zuletzt geänderte Textdatei (.txt) im Projektordner an. ' +
      'Die Prüfung ist bestanden, wenn sie eine freundliche Begrüßung auf Deutsch und ein Datum ' +
      'enthält. Du darfst nichts verändern — nur lesen. Begründe dein Urteil auf Deutsch in ein ' +
      'bis zwei Sätzen. Deine allerletzte Zeile muss exakt lauten: ' +
      'PRUEFUNG: BESTANDEN oder PRUEFUNG: FEHLGESCHLAGEN'
  },
  {
    id: 'pruefer-streng',
    name: 'Übungs-Prüfer (streng)',
    symbol: '🧐',
    beschreibung:
      'Findet absichtlich immer etwas zu meckern — zum Ausprobieren der Reparatur-Runden.',
    braucht: ['Textdatei'],
    liefert: ['Prüfbeleg'],
    nurLesen: true,
    prueft: true,
    felder: [],
    auftrag:
      'Du bist ein absichtlich strenger Übungs-Prüfer — dein einziger Zweck ist, die ' +
      'Reparatur-Runden von FlowForge vorzuführen. Sieh dir die zuletzt geänderte Textdatei ' +
      '(.txt) im Projektordner an und finde genau einen Kritikpunkt, gern auch einen ' +
      'kleinlichen (Stil, Wortwahl, fehlender Schwung). Nenne ihn auf Deutsch in ein bis zwei ' +
      'Sätzen. Diese Prüfung fällt grundsätzlich immer durch — egal wie gut die Datei ist. ' +
      'Du darfst nichts verändern — nur lesen. Deine allerletzte Zeile muss exakt lauten: ' +
      'PRUEFUNG: FEHLGESCHLAGEN'
  },
  {
    id: 'rechte-probe',
    name: 'Rechte-Probe',
    symbol: '🛡️',
    beschreibung:
      'Versucht absichtlich, außerhalb des Projektordners zu schreiben — damit du die Rechte-Rückfrage siehst.',
    braucht: [],
    liefert: [],
    nurLesen: false,
    prueft: false,
    felder: [],
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
]

export function blockDefinition(blockId) {
  return BLOCK_KATALOG.find((b) => b.id === blockId) ?? null
}

// Farb-Kategorie eines Blocks für Leinwand und Bibliothek:
// Prüfer blau, nur-lesende Blöcke grün, schreibende (Bauer) rot.
export function blockKategorie(def) {
  if (def.prueft) return 'pruefer'
  if (def.nurLesen) return 'leser'
  return 'bauer'
}
