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
    bibliothekTitel: 'Blockbibliothek',
    bibliothekHinweis: 'Zieh einen Block mit der Maus auf die Leinwand.',
    vorlagenTitel: 'Vorlagen',
    vorlageHinweis: 'Zieh die Vorlage auf die leere Leinwand — sie legt die ganze Kette fertig verbunden ab.',
    arbeitsbloeckeTitel: 'Arbeitsblöcke',
    uebungsbloeckeTitel: 'Übungs-Blöcke'
  },
  kette: {
    starten: 'Workflow starten',
    leerHinweis:
      'Dein Schaubild ist noch leer. Zieh Blöcke aus der Bibliothek rechts hierher, schieb sie zurecht und verbinde sie mit Pfeilen — die Pfeile bestimmen die Reihenfolge.',
    pfeilZiehenHinweis: 'Pfeil ziehen: hier drücken und zum nächsten Block ziehen',
    pfeilLoeschen: 'Diesen Pfeil löschen',
    einPfadAusgehend: (name) =>
      `Von „${name}" geht schon ein Pfeil aus. Ein Workflow ist vorerst ein einziger durchgehender Pfad — parallele Zweige kommen in einem späteren Bauschritt. Lösch den vorhandenen Pfeil, wenn du neu verbinden willst.`,
    einPfadEingehend: (name) =>
      `Bei „${name}" kommt schon ein Pfeil an. Ein Workflow ist vorerst ein einziger durchgehender Pfad — parallele Zweige kommen in einem späteren Bauschritt. Lösch den vorhandenen Pfeil, wenn du neu verbinden willst.`,
    fehlerKreis:
      'Diese Pfeile ergeben einen Kreis — der Workflow hätte kein Ende. Bitte lösch einen der Pfeile.',
    fehlerPfeilUngueltig: 'Dieser Pfeil lässt sich nicht setzen.',
    fehlerNichtVerbunden: (name) =>
      `„${name}" hängt noch nicht am Pfad. Verbinde alle Blöcke mit Pfeilen zu einem durchgehenden Pfad — oder entferne den Block.`,
    entfernen: 'Entfernen',
    reparaturRundenLabel: 'Reparatur-Runden',
    reparaturRundenHinweis:
      'So oft darf ein Prüfer den Lauf zur Reparatur zurückschicken, bevor du gefragt wirst.',
    zurueckZuLabel: 'Bei Fehlschlag zurück zu:',
    brauchtLabel: 'braucht',
    liefertLabel: 'liefert',
    nurLesenMarke: 'darf nur lesen',
    prueftMarke: 'Prüfer',
    fehlerBraucht: (blockName, bedarf) =>
      `„${blockName}" braucht „${bedarf}" — aber kein Block davor liefert das.`,
    fehlerLeereKette: 'Die Kette ist noch leer. Zieh zuerst Blöcke aus der Bibliothek auf die Leinwand.',
    fehlerPflichtfeld: (blockName, feld) =>
      `Beim Block „${blockName}" ist das Pflichtfeld „${feld}" leer. Bitte ausfüllen — sonst startet der Lauf nicht.`,
    fehlerAuftragsquelle: (blockName, feld) =>
      `Beim Block „${blockName}" ist das Feld „${feld}" leer, und in der Kartenauswahl ist keine offene Aufgaben-Karte. Trag einen Wunsch ins Feld ein — oder leg links eine Aufgaben-Karte an. Sonst wüsste der Agent nicht, was gebaut werden soll.`,
    fehlerWaehrendLauf: 'Während ein Lauf läuft, kann die Kette nicht verändert werden.',
    unbekannterBlock: 'Diesen Block kennt FlowForge nicht.',
    vorlageNurLeer:
      'Eine Vorlage lässt sich nur auf eine leere Leinwand legen. Entferne erst die vorhandenen Blöcke — oder steck die Kette von Hand zusammen.'
  },
  entscheidung: {
    ueberschrift: 'Der Prüfer ist weiterhin nicht zufrieden',
    einleitung: (block, runden) =>
      runden > 0
        ? `„${block}" hat die Prüfung auch nach ${runden === 1 ? 'einer Reparatur-Runde' : runden + ' Reparatur-Runden'} nicht bestanden. Wie soll es weitergehen?`
        : `„${block}" hat die Prüfung nicht bestanden, und Reparatur-Runden sind keine eingestellt. Wie soll es weitergehen?`,
    weitermachen: 'Weitermachen',
    weitermachenHinweis:
      'Der Lauf macht trotz der nicht bestandenen Prüfung mit dem nächsten Block weiter.',
    zurueckstellen: 'Zurückstellen',
    zurueckstellenHinweis:
      'Der Lauf hält hier an. Alles bisher Gebaute bleibt bestehen — du kannst später neu starten.',
    wiederherstellen: 'Stand wiederherstellen',
    wiederherstellenHinweis:
      'Der Projektordner wird auf den Stand von vor diesem Lauf zurückgesetzt.'
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
  kartenAuswahl: {
    ueberschrift: 'Karten für den Lauf',
    hinweis:
      'Diese Karten bekommt der Agent zu Beginn jedes Blocks mit. Status-Karte und offene Aufgaben sind vorausgewählt — weitere Karten ziehst du aus der Seitenleiste hierher, rauswerfen per ×.',
    immerDabei: 'immer dabei',
    entfernen: 'Aus der Auswahl nehmen'
  },
  // Texte, die an den Agenten gehen (nicht an Georg) — zentral wie alle anderen.
  agentenKarten: {
    kontext: (liste) =>
      'Aktuelle Projektkarten (von FlowForge für diesen Lauf ausgewählt):\n' +
      liste +
      '\n\nWeitere Karten kannst du über die karten-Werkzeuge lesen, anlegen, aktualisieren und erledigen.\n\n',
    angelegt: (karte) => `Karte angelegt: „${karte.titel}" (${karte.sorte}, id ${karte.id}).`,
    aktualisiert: (karte) => `Karte aktualisiert: „${karte.titel}" (id ${karte.id}).`,
    erledigtGesetzt: (karte, erledigt) =>
      erledigt
        ? `Aufgabe „${karte.titel}" ist jetzt als erledigt markiert.`
        : `Aufgabe „${karte.titel}" ist wieder offen.`,
    unbekannteId: (id) =>
      `Keine Karte mit der id ${id} gefunden. Hol dir die aktuellen ids mit karten_uebersicht.`
  },
  // Übergaben zwischen Blöcken (SPEC §4.3): Der Abschlusstext eines Blocks wird
  // Folgeblöcken mit passendem „braucht" in den Auftrag gereicht.
  agentenUebergabe: {
    ueberschrift: 'Übergaben aus den vorherigen Blöcken dieses Laufs:\n\n',
    eintrag: (etikett, blockName, text) => `### ${etikett} — von Block „${blockName}"\n${text}\n\n`,
    auftragEinleitung: 'Dein Arbeitsauftrag:\n',
    prueferRueckmeldung: (kritik) =>
      '\n\nRückmeldung des Prüfers aus der letzten Runde (bitte beheben):\n' + kritik
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
    laeuft: 'läuft …',
    sanftStoppen: 'Sanft anhalten',
    sanftStoppenHinweis: 'Der laufende Block macht fertig, dann hält der Lauf an.',
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
      'hart-abgebrochen': 'Sofort abgebrochen',
      zurueckgestellt: 'Zurückgestellt',
      wiederhergestellt: 'Stand wiederhergestellt'
    },
    fertigErfolgreich: 'Der Lauf ist fertig — alle Blöcke sind durch.',
    fertigFehlgeschlagen: 'Der Lauf ist fehlgeschlagen.',
    fertigSanft: 'Der Lauf wurde sanft angehalten. Der Stand ist am letzten Sicherungspunkt.',
    fertigHart:
      'Der Lauf wurde sofort abgebrochen. Der laufende Block gilt als nicht gelaufen; angefangene Änderungen wurden auf den letzten Sicherungspunkt zurückgesetzt.',
    fertigZurueckgestellt:
      'Der Lauf wurde zurückgestellt. Alles bisher Gebaute bleibt bestehen — du kannst später neu starten.',
    fertigWiederhergestellt:
      'Der Projektordner wurde auf den Stand von vor dem Lauf zurückgesetzt.',
    okKnopf: 'Alles klar',
    schonAktiv: 'Es läuft schon ein Workflow. Bitte warte, bis er fertig ist.',
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
      'Git ist in FlowForge-Projekten gesperrt: Die App verwaltet Sicherungspunkte selbst. Arbeite ohne Git weiter.',
    nurLesenGesperrtFuerAgent:
      'Dieser Block darf nur lesen. Schreiben, Befehle und Internet sind hier gesperrt. Beende den Auftrag nur mit Lese-Werkzeugen.',
    verwaltungGesperrtFuerAgent:
      'Diese Datei verwaltet FlowForge selbst — sie ist für direkte Änderungen gesperrt. Karten liest und schreibst du über die karten-Werkzeuge.'
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
    sanftAngefordert: 'Sanftes Anhalten angefordert — der laufende Block macht fertig.',
    hartAbgebrochen: 'Sofort abgebrochen.',
    gitGesperrt: 'Git-Befehl gesperrt — Sicherungspunkte übernimmt FlowForge.',
    nurLesenGesperrt: 'Schreib-Versuch gestoppt — dieser Block darf nur lesen.',
    verwaltungGesperrt: 'Schreib-Versuch auf eine FlowForge-Verwaltungsdatei gestoppt.',
    liestKarten: 'Liest die Projektkarten.',
    karteAngelegt: (titel) => `Karte angelegt: „${titel}"`,
    karteAktualisiert: (titel) => `Karte aktualisiert: „${titel}"`,
    aufgabeErledigt: (titel) => `Aufgabe abgehakt: „${titel}"`,
    aufgabeGeoeffnet: (titel) => `Aufgabe wieder geöffnet: „${titel}"`,
    karteAbgelehnt: (grund) => `Karten-Änderung abgelehnt: ${grund}`,
    sicherungspunktAngelegt: 'Sicherungspunkt angelegt.',
    zurueckgesetzt: 'Projektordner auf den letzten Sicherungspunkt zurückgesetzt.',
    fertigIn: (sekunden) => `Fertig nach ${sekunden} Sekunden.`,
    blockStartet: (nr, gesamt, name) => `Block ${nr} von ${gesamt}: „${name}" startet.`,
    pruefungBestanden: 'Prüfung bestanden.',
    pruefungNichtBestanden: 'Prüfung nicht bestanden.',
    pruefungOhneErgebnis:
      'Der Prüfer hat kein eindeutiges Ergebnis geliefert — das gilt als nicht bestanden.',
    rueckfuehrung: (name, runde, gesamt) =>
      `Zurück zu „${name}" — Reparatur-Runde ${runde} von ${gesamt}.`,
    entscheidungGestellt: 'Folgen-Frage an dich — bitte im Fenster beantworten.',
    entscheidungWeitermachen: 'Du hast entschieden: weitermachen.',
    entscheidungZurueckgestellt: 'Du hast entschieden: zurückstellen.',
    entscheidungWiederhergestellt: 'Du hast entschieden: Stand von vor dem Lauf wiederherstellen.'
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
    blockErgebnis: 'Letzter Lauf',
    blockZustaende: {
      erfolgreich: 'erledigt',
      fehlgeschlagen: 'fehlgeschlagen',
      'pruefung-bestanden': 'Prüfung bestanden',
      'pruefung-nicht-bestanden': 'Prüfung nicht bestanden'
    },
    details: 'Einzelheiten',
    schliessen: 'Zuklappen',
    fehlertextLabel: 'Fehler',
    rechteFragenLabel: 'Rechte-Rückfragen',
    entscheidungenLabel: 'Folgen-Fragen',
    erlaubt: 'erlaubt',
    abgelehnt: 'abgelehnt',
    verlaufLabel: 'Verlauf'
  }
}
