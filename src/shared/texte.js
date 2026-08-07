// Alle Oberflächen-Texte zentral an einem Ort (Deutsch; weitere Sprachen in V2).
export const texte = {
  appName: 'FlowForge',
  fensterTitel: 'FlowForge',
  projektuebersicht: {
    ueberschrift: 'Projekte',
    leerHinweis: 'Noch keine Projekte.',
    leerUntertitel: 'Hier erscheinen deine Projekte als Kacheln, sobald du das erste anlegst.',
    neuesProjekt: 'Neues Projekt',
    oeffnen: 'Öffnen',
    nichtGefunden: 'Ordner nicht gefunden',
    nichtGefundenHinweis: 'Der Projektordner wurde verschoben oder gelöscht.',
    ausListeEntfernen: 'Aus der Übersicht entfernen'
  },
  neuesProjekt: {
    ueberschrift: 'Neues Projekt',
    nameFeld: 'Wie soll das Projekt heißen?',
    namePlatzhalter: 'z.B. Haushaltsplaner',
    ablageortFeld: 'Wo soll das Projekt gespeichert werden?',
    ablageortWaehlen: 'Ordner wählen …',
    ablageortHinweis: 'FlowForge legt dort einen eigenen Ordner mit dem Projektnamen an.',
    anlegen: 'Projekt anlegen',
    abbrechen: 'Abbrechen',
    fehlerKeinName: 'Bitte gib dem Projekt einen Namen.',
    fehlerKeinOrt: 'Bitte wähle einen Speicherort.',
    fehlerOrdnerExistiert: (pfad) =>
      `Dort gibt es schon einen Ordner mit diesem Namen (${pfad}). Bitte wähle einen anderen Namen oder Speicherort.`,
    fehlerNameUnbrauchbar: 'Aus diesem Namen lässt sich kein Ordnername machen. Bitte wähle einen anderen Namen.'
  },
  projektansicht: {
    zurueck: 'Zur Übersicht',
    leinwandTitel: 'Leinwand',
    leinwandHinweis:
      'Hier baust du später deine Workflows aus Blöcken zusammen. Das kommt in einem späteren Bauschritt.',
    bibliothekTitel: 'Blockbibliothek',
    bibliothekHinweis:
      'Hier erscheinen die Blöcke, die du auf die Leinwand ziehen kannst. Das kommt in einem späteren Bauschritt.'
  },
  karten: {
    ueberschrift: 'Karten',
    neueKarte: 'Neue Karte',
    filterAlle: 'Alle',
    sorten: {
      aufgabe: 'Aufgabe',
      entscheidung: 'Entscheidung',
      wissen: 'Wissen',
      status: 'Status'
    },
    offen: 'offen',
    erledigt: 'erledigt',
    erledigen: 'Erledigen',
    wiederOeffnen: 'Wieder öffnen',
    bearbeiten: 'Bearbeiten',
    loeschen: 'Löschen',
    loeschenBestaetigung: 'Diese Karte wirklich löschen?',
    keineKarten: 'Keine Karten in dieser Ansicht.'
  },
  kartenFormular: {
    ueberschriftNeu: 'Neue Karte',
    ueberschriftBearbeiten: 'Karte bearbeiten',
    sorteFeld: 'Sorte',
    titelFeld: 'Titel',
    textFeld: 'Inhalt',
    zeichenUebrig: (n) => `noch ${n} Zeichen`,
    zeichenZuViel: (n) => `${n} Zeichen zu viel`,
    speichern: 'Speichern',
    abbrechen: 'Abbrechen'
  },
  kartenRegeln: {
    titelFehlt: 'Bitte gib der Karte einen Titel.',
    titelZuLang: (max) => `Der Titel ist zu lang (höchstens ${max} Zeichen).`,
    textFehlt: 'Bitte schreib etwas in die Karte.',
    textZuLang: (max) =>
      `Der Inhalt ist zu lang (höchstens ${max} Zeichen). Bitte kürzen — oder den Inhalt auf mehrere Karten aufteilen.`,
    statusUnantastbar: 'Die Status-Karte gibt es genau einmal — sie kann nicht gelöscht oder neu angelegt werden.',
    nurAufgabenErledigbar: 'Nur Aufgaben-Karten können erledigt werden.'
  },
  statusKarte: {
    titel: 'Status',
    startText: 'Projekt frisch angelegt. Noch nichts gebaut.'
  },
  fehler: {
    projektNichtGefunden: 'Der Projektordner ist nicht mehr da. Wurde er verschoben oder gelöscht?',
    kartenDateiKaputt:
      'Die Kartendatei dieses Projekts ist beschädigt und konnte nicht gelesen werden.',
    unbekannt: 'Das hat leider nicht geklappt. Bitte versuch es noch einmal.'
  }
}
