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
  },
  einstellungen: {
    ueberschrift: 'Einstellungen',
    knopf: 'Einstellungen',
    motorUeberschrift: 'KI-Motor',
    modusFeld: 'Wie soll sich der Motor anmelden?',
    modusAbo: 'Mit meinem Claude-Abo (empfohlen)',
    modusAboHinweis:
      'Nutzt dein bestehendes Claude-Login und dein Abo-Kontingent. Nur für den eigenen Gebrauch.',
    modusApi: 'Mit API-Schlüssel',
    modusApiHinweis: 'Abrechnung pro Verbrauch über dein Anthropic-Konto.',
    apiSchluesselFeld: 'API-Schlüssel',
    apiSchluesselPlatzhalter: 'sk-ant-…',
    obergrenzeFeld: 'Ausgaben-Obergrenze pro Lauf (US-Dollar)',
    obergrenzeHinweis: 'Erreicht ein Lauf diese Grenze, hält der Motor von selbst an.',
    speichern: 'Speichern',
    abbrechen: 'Abbrechen',
    fehlerApiSchluesselFehlt: 'Für den API-Modus brauchst du einen API-Schlüssel.',
    fehlerObergrenze: 'Die Ausgaben-Obergrenze muss eine Zahl größer als 0 sein.'
  },
  lauf: {
    uebungsHinweis:
      'Die richtige Leinwand mit Drag & Drop kommt in einem späteren Bauschritt. Zum Ausprobieren des Motors gibt es zwei Übungs-Workflows:',
    starten: 'Starten',
    laeuft: 'läuft …',
    sanftStoppen: 'Sanft anhalten',
    sanftStoppenHinweis: 'Der laufende Schritt macht fertig, dann hält der Lauf an.',
    hartStoppen: 'Sofort abbrechen',
    hartStoppenBestaetigung:
      'Sofort abbrechen? Der Block gilt dann als nicht gelaufen — angefangene Änderungen werden auf den letzten Sicherungspunkt zurückgesetzt.',
    rohProtokollZeigen: 'Rohprotokoll einblenden',
    rohProtokollVerbergen: 'Rohprotokoll ausblenden',
    tickerUeberschrift: 'Liveticker',
    verbrauchKontext: (von, bis) => `Kontext: etwa ${von}–${bis} % gefüllt`,
    verbrauchTokens: (tokens) => `${tokens.toLocaleString('de-DE')} Tokens`,
    verbrauchKosten: (usd) => `Kosten bisher: ${usd.toFixed(2).replace('.', ',')} $`,
    verbrauchKostenAbo: 'im Abo enthalten',
    zustandLabels: {
      erfolgreich: 'Erfolgreich',
      fehlgeschlagen: 'Fehlgeschlagen',
      'sanft-gestoppt': 'Sanft gestoppt',
      'hart-abgebrochen': 'Sofort abgebrochen'
    },
    fertigErfolgreich: 'Der Lauf ist fertig.',
    fertigFehlgeschlagen: 'Der Lauf ist fehlgeschlagen.',
    fertigSanft: 'Der Lauf wurde sanft angehalten.',
    fertigHart:
      'Der Lauf wurde sofort abgebrochen. Der Block gilt als nicht gelaufen; angefangene Änderungen wurden auf den letzten Sicherungspunkt zurückgesetzt.',
    okKnopf: 'Alles klar',
    schonAktiv: 'Es läuft schon ein Workflow. Bitte warte, bis er fertig ist.',
    workflowUnbekannt: 'Diesen Workflow gibt es nicht.',
    aboNichtErlaubt:
      'Diese FlowForge-Version läuft nur mit API-Schlüssel. Bitte hinterlege einen in den Einstellungen.',
    motorNichtAngemeldet:
      'Der Motor ist nicht angemeldet. Bitte melde dich einmal in der Claude-App bzw. mit „claude" an — oder hinterlege einen API-Schlüssel in den Einstellungen.',
    obergrenzeErreicht: 'Die Ausgaben-Obergrenze für diesen Lauf wurde erreicht.'
  },
  rechteFrage: {
    ueberschrift: 'Der Agent bittet um Erlaubnis',
    folgenHinweis:
      'Wenn du ablehnst, sucht der Agent einen anderen Weg innerhalb des Projektordners — oder beendet den Auftrag mit einer Erklärung.',
    erlauben: 'Erlauben',
    ablehnen: 'Ablehnen',
    schreibenAusserhalb: (pfad) =>
      `Der Agent möchte außerhalb des Projektordners schreiben:\n${pfad}`,
    befehl: (befehl) => `Der Agent möchte einen Kommandozeilen-Befehl ausführen:\n${befehl}`,
    internet: (ziel) => `Der Agent möchte aufs Internet zugreifen:\n${ziel}`,
    unbekanntesWerkzeug: (name) =>
      `Der Agent möchte ein Werkzeug nutzen, das FlowForge nicht kennt: ${name}`,
    abgelehntFuerAgent:
      'Der Nutzer hat das nicht erlaubt. Suche einen anderen Weg innerhalb des Projektordners — oder beende den Auftrag mit einer kurzen Erklärung.',
    gitGesperrtFuerAgent:
      'Git ist in FlowForge-Projekten gesperrt: Die App verwaltet Sicherungspunkte selbst. Arbeite ohne Git weiter.'
  },
  ticker: {
    motorGestartet: (modell) => `Motor gestartet (${modell}).`,
    schreibtDatei: (pfad) => `Schreibt Datei: ${pfad}`,
    aendertDatei: (pfad) => `Ändert Datei: ${pfad}`,
    liestDatei: (pfad) => `Liest: ${pfad}`,
    durchsucht: 'Durchsucht das Projekt.',
    plant: 'Plant die Arbeitsschritte.',
    unteraufgabe: 'Startet eine Unteraufgabe.',
    befehl: (befehl) => `Kommandozeile: ${befehl}`,
    internet: (ziel) => `Internetzugriff: ${ziel}`,
    werkzeug: (name) => `Nutzt Werkzeug: ${name}`,
    rechteFrageGestellt: 'Rechte-Rückfrage an dich — bitte oben beantworten.',
    rechteFrageErlaubt: 'Du hast es erlaubt.',
    rechteFrageAbgelehnt: 'Du hast es abgelehnt.',
    sanftAngefordert: 'Sanftes Anhalten angefordert — der laufende Schritt macht fertig.',
    hartAbgebrochen: 'Sofort abgebrochen.',
    gitGesperrt: 'Git-Befehl gesperrt — Sicherungspunkte übernimmt FlowForge.',
    sicherungspunktAngelegt: 'Sicherungspunkt angelegt.',
    zurueckgesetzt: 'Projektordner auf den letzten Sicherungspunkt zurückgesetzt.',
    fertigIn: (sekunden) => `Fertig nach ${sekunden} Sekunden.`
  },
  sicherungen: {
    ueberschrift: 'Sicherungspunkte',
    keine: 'Noch keine Sicherungspunkte.',
    hinweis: 'FlowForge sichert den Projektordner automatisch — vor jedem Lauf und nach jedem gelungenen Block.',
    wiederherstellen: 'Wiederherstellen',
    vorschauUeberschrift: 'Diesen Stand wiederherstellen?',
    vorschauEinleitung: (zeit) => `Das Projekt wird auf den Stand von ${zeit} zurückgesetzt.`,
    identisch: 'Der jetzige Stand ist mit diesem Sicherungspunkt identisch — es gibt nichts zurückzusetzen.',
    gruppeAnders: 'Wird zurückgesetzt:',
    gruppeVerschwindet: 'Verschwindet:',
    gruppeKommtZurueck: 'Kommt zurück:',
    laufberichteBleiben: 'Laufberichte bleiben in jedem Fall erhalten. Vorher wird der jetzige Stand automatisch gesichert — du kannst also auch das Wiederherstellen rückgängig machen.',
    jetztWiederherstellen: 'Jetzt wiederherstellen',
    abbrechen: 'Abbrechen',
    erledigt: (zeit) => `Stand von ${zeit} wiederhergestellt.`,
    beschriftungProjektAngelegt: 'Projekt angelegt',
    beschriftungVorLauf: (block) => `Stand vor „${block}"`,
    beschriftungNachBlock: (block) => `„${block}" fertig`,
    beschriftungVorWiederherstellung: 'Stand vor der Wiederherstellung',
    beschriftungWiederhergestellt: (zeit) => `Zurückgeholt: Stand von ${zeit}`,
    fehlerAnlegen: 'Der Sicherungspunkt konnte nicht angelegt werden. Der Lauf wurde sicherheitshalber nicht gestartet.',
    fehlerVorschau: 'Die Vorschau konnte nicht erstellt werden.',
    fehlerWiederherstellen: 'Das Wiederherstellen hat nicht geklappt. Der Projektordner wurde nicht verändert.',
    fehlerWaehrendLauf: 'Während ein Workflow läuft, kann nichts wiederhergestellt werden.'
  },
  laufberichte: {
    ueberschrift: 'Laufberichte',
    keine: 'Noch keine Laufberichte.',
    details: 'Einzelheiten',
    schliessen: 'Zuklappen',
    fehlertextLabel: 'Fehler',
    rechteFragenLabel: 'Rechte-Rückfragen',
    erlaubt: 'erlaubt',
    abgelehnt: 'abgelehnt',
    verlaufLabel: 'Verlauf'
  }
}
