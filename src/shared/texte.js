// Alle Oberflächen-Texte zentral an einem Ort (Deutsch; weitere Sprachen in V2).
export const texte = {
  appName: 'FlowForge',
  fensterTitel: 'FlowForge',
  // Kopfleiste = Titelleiste der dunklen Werkbank (Mockup-Runden 3+4).
  kopfleiste: {
    werkbank: 'WERKBANK',
    zuProjekten: 'Projekte'
  },
  projektuebersicht: {
    ueberschrift: 'Projekte',
    leerHinweis: 'Noch keine Projekte.',
    leerUntertitel: 'Hier erscheinen deine Projekte als Kacheln, sobald du das erste anlegst.',
    neuesProjekt: 'Neues Projekt',
    oeffnen: 'Öffnen',
    nichtGefunden: 'Ordner nicht gefunden',
    nichtGefundenHinweis: 'Der Projektordner wurde verschoben oder gelöscht.',
    ausListeEntfernen: 'Aus der Übersicht entfernen',
    // Zustände auf den Kacheln (SPEC §9, BAUPLAN 15).
    kachelLaeuft: 'läuft …',
    kachelWartetAntwort: 'wartet auf deine Antwort',
    kachelWarteschlange: 'wartet in der Warteschlange',
    kachelLetzterLauf: (zeit) => `Letzter Lauf: ${zeit} —`,
    kachelKeinLauf: 'Noch kein Lauf.',
    // Hero-Kachel für den laufenden Lauf (Mockup 3a).
    heroLaeuft: 'Läuft',
    zumLauf: 'Zum Lauf →',
    zumGespraech: 'Zum Gespräch',
    kontextLabel: 'Kontext-Füllstand',
    verbrauchsHinweis: (aktiv, wartend) =>
      `Parallele Läufe vervielfachen den Verbrauch — ${aktiv} ${aktiv === 1 ? 'Lauf' : 'Läufe'} aktiv` +
      (wartend > 0 ? `, ${wartend} in der Warteschlange.` : '.')
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
    leinwandTitel: 'Leinwand',
    // Tabs der Mittelspalte (Feedback Georg, 07.08.2026): Schaubild, Lauf,
    // Berichte und Sicherungspunkte gestapelt wurden unübersichtlich.
    tabSchaubild: 'Schaubild',
    tabLauf: 'Lauf',
    tabBerichte: 'Laufberichte',
    tabPunkte: 'Sicherungspunkte',
    tabLaufLeer: 'Noch kein Lauf in dieser Sitzung. Starte den Workflow im Schaubild-Tab.',
    einstellungenKnopf: 'Projekt-Einstellungen',
    bibliothekTitel: 'Blockbibliothek',
    bibliothekHinweis: 'Zieh einen Block mit der Maus auf die Leinwand.',
    vorlagenTitel: 'Vorlagen',
    vorlageHinweis: 'Zieh die Vorlage auf die leere Leinwand — sie legt die ganze Kette fertig verbunden ab.',
    arbeitsbloeckeTitel: 'Arbeitsblöcke',
    eigeneBloeckeTitel: 'Eigene Blöcke',
    eigeneBloeckeHinweis:
      'Deine selbst gebauten Blöcke — sie stehen in allen Projekten zur Verfügung.',
    eigeneBloeckeLeer: 'Noch keine eigenen Blöcke. Bau dir einen mit dem Knopf oben.',
    uebungsbloeckeTitel: 'Übungs-Blöcke'
  },
  // Block-Editor mit KI-Assistent (SPEC §4.5, BAUPLAN 14).
  blockEditor: {
    neuerBlock: 'Neuer Block',
    ueberschriftNeu: 'Eigenen Block erstellen',
    ueberschriftBearbeiten: 'Block bearbeiten',
    schrittAnzeige: (nr, gesamt) => `Schritt ${nr} von ${gesamt}`,
    schritt1Titel: 'Was soll der Block tun?',
    schritt2Titel: 'Was braucht und liefert er?',
    schritt3Titel: 'Welche Sperren gelten?',
    schritt4Titel: 'Probelauf-Vorschau',
    kiFeld: 'Beschreib in deinen Worten, was der Block tun soll',
    kiPlatzhalter: 'z.B. Ein Block, der alle Texte im Projekt auf Rechtschreibfehler durchsieht',
    kiKnopf: 'KI füllt das Formular aus',
    kiLaeuft: 'Die KI füllt das Formular aus …',
    kiHinweis:
      'Die KI füllt alle Formularfelder für dich aus — du kannst danach noch alles von Hand ändern. Oder du füllst die Felder gleich selbst aus.',
    nameFeld: 'Name',
    symbolFeld: 'Symbol (ein Emoji)',
    beschreibungFeld: 'Kurzbeschreibung für die Bibliothek',
    auftragFeld: 'Arbeitsauftrag an den Agenten',
    auftragHinweis:
      'Das ist die Anweisung, die der Agent bekommt. Sag klar, was er tun soll, was nicht — und was am Ende in seinem Abschlusstext stehen soll.',
    brauchtFeld: 'braucht — Übergaben, die der Block von vorherigen Blöcken benötigt',
    brauchtHinweis:
      'Nur eintragen, was wirklich nötig ist: Der Block lässt sich dann nur hinter Blöcke stecken, die das liefern. Ohne „braucht" kann er auch am Anfang stehen.',
    liefertFeld: 'liefert — Etikett für den Abschlusstext dieses Blocks',
    liefertHinweis:
      'Unter diesem Etikett bekommen spätere Blöcke den Abschlusstext gereicht. Nutze möglichst die vorgeschlagenen Etiketten — dann passt der Block zu den vorhandenen.',
    etikettPlatzhalter: 'Etikett eintippen oder Vorschlag wählen …',
    etikettHinzufuegen: 'Hinzufügen',
    nurLesenFeld: 'Sperre „darf nur lesen"',
    nurLesenHinweis:
      'Der Block darf dann nichts verändern: kein Schreiben, keine Befehle, kein Internet — nur lesen. Die sichere Wahl für alles, was nur ansehen und berichten soll. Nur-lesende Blöcke dürfen außerdem parallel zu einem schreibenden laufen.',
    vorschauHinweis:
      'So liegt der Block in der Bibliothek — und genau diesen Arbeitsauftrag bekommt der Agent. Passt alles? Dann speichern.',
    vorschauAuftrag: 'Arbeitsauftrag an den Agenten',
    vorschauTitel: 'Vorschau — so liegt er in der Bibliothek',
    zurueck: 'Zurück',
    weiter: 'Weiter',
    speichern: 'Block speichern',
    abbrechen: 'Abbrechen',
    bearbeiten: 'Bearbeiten',
    loeschen: 'Löschen',
    loeschenBestaetigung: (name) => `Den Block „${name}" wirklich löschen?`,
    fehlerNochVerwendet: (namen) =>
      `Dieser Block liegt noch auf der Leinwand von: ${namen.join(', ')}. Nimm ihn dort erst vom Schaubild — dann lässt er sich löschen.`,
    fehlerWaehrendLauf: (name) =>
      `Im Projekt „${name}" läuft oder wartet gerade ein Workflow mit diesem Block. Warte, bis er fertig ist — dann kannst du den Block ändern.`,
    fehlerBeschreibungFehlt: 'Beschreib zuerst in ein paar Worten, was der Block tun soll.',
    fehlerKeinVorschlag:
      'Die KI hat kein brauchbares Formular geliefert. Versuch es noch einmal — oder füll die Felder von Hand aus.'
  },
  blockRegeln: {
    nameFehlt: 'Bitte gib dem Block einen Namen.',
    nameZuLang: (max) => `Der Name ist zu lang (höchstens ${max} Zeichen).`,
    symbolZuLang: 'Als Symbol genügt ein einzelnes Emoji.',
    beschreibungZuLang: (max) => `Die Kurzbeschreibung ist zu lang (höchstens ${max} Zeichen).`,
    auftragFehlt: 'Der Arbeitsauftrag fehlt — ohne ihn wüsste der Agent nicht, was er tun soll.',
    auftragZuLang: (max) => `Der Arbeitsauftrag ist zu lang (höchstens ${max} Zeichen).`,
    etikettZuLang: (label, max) =>
      `Ein „${label}"-Etikett ist zu lang (höchstens ${max} Zeichen).`,
    zuVieleEtiketten: (label, max) => `Höchstens ${max} Etiketten bei „${label}".`
  },
  kette: {
    starten: 'Workflow starten',
    // Kategorie-Kicker auf den Blockkarten (Mockup 3b).
    kickerArbeit: 'Arbeitsblock',
    kickerPruef: 'Prüf-Block',
    kickerEigen: 'Eigener Block',
    leerHinweis:
      'Dein Schaubild ist noch leer. Zieh Blöcke aus der Bibliothek rechts hierher, schieb sie zurecht und verbinde sie mit Pfeilen — die Pfeile bestimmen die Reihenfolge. Von einer Karte dürfen auch mehrere Pfeile ausgehen: Solche Zweige laufen parallel und werden am nächsten gemeinsamen Block wieder zusammengeführt.',
    pfeilZiehenHinweis: 'Pfeil ziehen: hier drücken und zum nächsten Block ziehen',
    pfeilLoeschen: 'Diesen Pfeil löschen',
    fehlerKreis:
      'Diese Pfeile ergeben einen Kreis — der Workflow hätte kein Ende. Bitte lösch einen der Pfeile.',
    fehlerPfeilUngueltig: 'Dieser Pfeil lässt sich nicht setzen.',
    fehlerPfeilDoppelt: 'Diese Verbindung gibt es schon.',
    fehlerNichtVerbunden: (name) =>
      `„${name}" hängt noch nicht am Schaubild. Verbinde alle Blöcke mit Pfeilen zu einem zusammenhängenden Schaubild — oder entferne den Block.`,
    entfernen: 'Entfernen',
    reparaturRundenLabel: 'Reparatur-Runden',
    reparaturRundenHinweis:
      'So oft darf ein Prüfer den Lauf zur Reparatur zurückschicken, bevor du gefragt wirst.',
    zurueckZuLabel: 'Bei Fehlschlag zurück zu:',
    brauchtLabel: 'braucht',
    liefertLabel: 'liefert',
    nurLesenMarke: 'darf nur lesen',
    prueftMarke: 'Prüfer',
    fallsDaZusatz: 'falls da',
    fehlerBraucht: (blockName, bedarf) =>
      `„${blockName}" braucht „${bedarf}" — aber keiner seiner Vorgänger entlang der Pfeile liefert das.`,
    fehlerLeereKette: 'Die Kette ist noch leer. Zieh zuerst Blöcke aus der Bibliothek auf die Leinwand.',
    fehlerPflichtfeld: (blockName, feld) =>
      `Beim Block „${blockName}" ist das Pflichtfeld „${feld}" leer. Bitte ausfüllen — sonst startet der Lauf nicht.`,
    fehlerAuftragsquelle: (blockName, feld) =>
      `Beim Block „${blockName}" ist das Feld „${feld}" leer, und in der Kartenauswahl ist keine offene Aufgaben-Karte. Trag einen Wunsch ins Feld ein — oder leg links eine Aufgaben-Karte an. Sonst wüsste der Agent nicht, was gebaut werden soll.`,
    fehlerWaehrendLauf: 'Während ein Lauf läuft, kann die Kette nicht verändert werden.',
    fehlerWaehrendWarteschlange:
      'Dieser Workflow wartet in der Warteschlange auf seinen Start. Nimm ihn erst aus der Warteschlange, wenn du ihn ändern willst.',
    unbekannterBlock: 'Diesen Block kennt FlowForge nicht.',
    // Häkchen je Block (BAUPLAN 20): Abwahl der lokalen KI als echte Sperre.
    lokaleKiLabel: 'lokale KI erlaubt',
    lokaleKiHinweis:
      'Abgewählt: Dieser Block nutzt die lokale Helfer-KI nicht — weder für Recherchen noch für die lokale Vorreparatur. Wirkt nur, wenn die lokale KI in den Einstellungen überhaupt eingeschaltet ist.',
    uebertragGrenzeLabel: 'Überträge höchstens',
    uebertragGrenzeHinweis:
      'Läuft der Kontext eines Blocks voll (~85 %), übergibt der Agent an eine frische Session und arbeitet nahtlos weiter. So oft darf das pro Lauf passieren — Feld leer lassen heißt: unbegrenzt.',
    uebertragUnbegrenzt: 'leer = unbegrenzt',
    kontingentLabel: 'Kontingent erschöpft:',
    kontingentHinweis:
      'Was passieren soll, wenn dein Abo-Kontingent mitten im Lauf aufgebraucht ist. „Pausieren": FlowForge wartet und macht von selbst weiter, sobald es wieder Kontingent gibt. „Anhalten": der Lauf stoppt, du startest später selbst neu.',
    kontingentPausieren: 'pausieren, von selbst weitermachen',
    kontingentStoppen: 'anhalten, ich starte selbst neu',
    vorlageErsetzenBestaetigung:
      'Auf der Leinwand liegen schon Blöcke. Soll die Vorlage das vorhandene Schaubild ersetzen? Feldwerte und Verbindungen des alten Schaubilds gehen dabei verloren.'
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
      status: 'Status',
      pruefung: 'Prüfung'
    },
    offen: 'offen',
    erledigt: 'erledigt',
    erledigen: 'Erledigen',
    wiederOeffnen: 'Wieder öffnen',
    bearbeiten: 'Bearbeiten',
    loeschen: 'Löschen',
    loeschenBestaetigung: 'Diese Karte wirklich löschen?',
    loeschenBestaetigungPruefung:
      'Diese Prüfkarte wirklich löschen? Ihre aufbewahrten Prüfdateien werden mitgelöscht — diese Prüfung lässt sich dann nicht mehr auf einen Prüfer ziehen.',
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
    nurAufgabenErledigbar: 'Nur Aufgaben-Karten können erledigt werden.',
    // Prüfkarten (BAUPLAN 18): legt und pflegt ausschließlich FlowForge.
    pruefkarteNurFlowForge:
      'Prüfkarten legt FlowForge selbst an — automatisch nach jeder bestandenen Prüfung. Sie lassen sich nicht anlegen oder über die Karten-Werkzeuge ändern.'
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
  // Gespräch mit dem Agenten (BAUPLAN 9): Frage-Blöcke und das Spec-Interview
  // stellen Fragen über das mensch-Werkzeug — beantwortet wird hier.
  gespraech: {
    ueberschrift: 'Der Agent hat eine Frage an dich',
    verlaufUeberschrift: 'Gespräch',
    antwortPlatzhalter: 'Deine Antwort …',
    antworten: 'Antworten',
    freitextHinweis: 'Du kannst eine Option anklicken — oder frei antworten.',
    empfohlen: 'Empfohlen'
  },
  benachrichtigung: {
    frageTitel: 'FlowForge — der Agent hat eine Frage',
    fertigTitel: 'FlowForge — der Lauf ist beendet',
    pauseTitel: 'FlowForge — Kontingent erschöpft',
    pauseText:
      'Dein Abo-Kontingent ist im Moment aufgebraucht. FlowForge pausiert und macht von selbst weiter, sobald es wieder Kontingent gibt.',
    pauseGestopptText:
      'Dein Abo-Kontingent ist im Moment aufgebraucht. Der Lauf hat angehalten — starte ihn neu, sobald dein Kontingent wieder da ist.',
    weiterTitel: 'FlowForge — es geht weiter',
    weiterText: 'Der Motor arbeitet wieder — der Lauf macht von selbst weiter.',
    serverTitel: 'FlowForge — KI-Server überlastet',
    serverText:
      'Die KI-Server sind im Moment überlastet. FlowForge pausiert und macht von selbst weiter, sobald sie wieder erreichbar sind.'
  },
  // Wiederaufnahme nach App-/Rechner-Neustart mitten im Lauf (SPEC §3.3, BAUPLAN 11).
  wiederaufnahme: {
    ueberschrift: 'Ein Lauf wurde unterbrochen',
    einleitung: (zeit, blockName) =>
      `Beim letzten Mal wurde ein Lauf mitten in „${blockName}" unterbrochen (gestartet ${zeit}) — vermutlich durch einen Neustart. FlowForge kann den Projektordner auf den letzten Sicherungspunkt zurücksetzen und dort weitermachen.`,
    weitermachen: 'Am letzten Sicherungspunkt weitermachen',
    verwerfen: 'Nicht weitermachen',
    verwerfenHinweis:
      'Bei „Nicht weitermachen" bleibt alles wie es ist — du kannst den Workflow später ganz normal neu starten.',
    fehlerVeraendert:
      'Das Schaubild wurde seit der Unterbrechung verändert — der Lauf kann nicht fortgesetzt werden. Starte den Workflow einfach neu.',
    fehlerKeinStand: 'Es gibt keinen unterbrochenen Lauf mehr, der fortgesetzt werden könnte.'
  },
  // Texte, die an den Agenten gehen (nicht an Georg) — zentral wie alle anderen.
  agentenMensch: {
    antwort: (text) => `Antwort des Nutzers:\n${text}`,
    keineAntwort:
      'Der Lauf wurde angehalten — auf diese Frage kommt keine Antwort mehr. ' +
      'Beende deinen Auftrag ohne weitere Fragen.'
  },
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
      '\n\nRückmeldung des Prüfers aus der letzten Runde (bitte beheben):\n' + kritik,
    // Reparatur-Runde beim Prüfer (Entscheidung Georg, 12.08.2026): nur die
    // Beanstandungen der letzten Runde nachprüfen, keine erneute Vollprüfung.
    prueferNachpruefung: (kritik) =>
      '\n\nDies ist eine Reparatur-Runde: Der Bauer hat deine Beanstandungen aus der letzten ' +
      'Runde behoben. Prüfe in dieser Runde NUR diese Beanstandungen nach — keine erneute ' +
      'Vollprüfung, keine neuen Prüffelder. Deine Beanstandungen von letzter Runde:\n' + kritik,
    // Lokale Vorreparatur (BAUPLAN 20): ehrlich gesagt, WER repariert hat.
    lokaleNachpruefung: (kritik) =>
      '\n\nDies ist eine Nachprüfung: Eine kleine lokale KI hat versucht, deine ' +
      'Beanstandungen aus der letzten Runde mechanisch zu beheben. Prüfe in dieser Runde ' +
      'NUR diese Beanstandungen nach — keine erneute Vollprüfung, keine neuen Prüffelder. ' +
      'Sei streng: Ein kleines Modell macht Fehler, übernimm nichts ungeprüft. ' +
      'Deine Beanstandungen von letzter Runde:\n' + kritik,
    startanleitungNachforderung:
      '\n\nNachforderung von FlowForge: Dieser Auftrag ist schon umgesetzt, aber die ' +
      'Startanleitung des Projekts fehlt noch. Lege sie jetzt mit dem Werkzeug ' +
      'startanleitung_setzen an (beschreibung, dazu befehl und/oder adresse). ' +
      'Ändere sonst nichts am Projekt.',
    // Übergabe an den nächsten Anlauf desselben Blocks nach einem Übertrag.
    uebertragFortsetzung: (uebergabe) =>
      '\n\nÜbergabe deines Vorgängers: Genau dieser Auftrag lief schon in einem früheren ' +
      'Anlauf, dessen Kontext voll wurde. Setze die Arbeit nahtlos fort — beginne NICHT ' +
      'von vorn und wiederhole keine erledigten Schritte. Die Übergabe:\n' + uebergabe,
    uebertragOhneUebergabe:
      '\n\nHinweis von FlowForge: Genau dieser Auftrag lief schon in einem früheren Anlauf, ' +
      'dessen Kontext voll wurde — eine Übergabe liegt leider nicht vor. Prüfe zuerst den ' +
      'Stand im Projektordner und an den Karten, und setze die Arbeit dann fort, ohne ' +
      'Erledigtes zu wiederholen.'
  },
  // Eine Motor-Session pro Lauf (BAUPLAN 19): Der Koordinator in der Session
  // verteilt nur Aufträge — jeder Block läuft als frischer Agent. Den echten
  // Arbeitsauftrag setzt FlowForge beim Agent-Aufruf selbst ein, damit der
  // Koordinator schlank bleibt und nichts verfälschen kann.
  agentenLaufSession: {
    koordinatorSystem:
      'Du bist der Koordinator eines FlowForge-Laufs. Du erledigst niemals selbst Arbeit, ' +
      'liest keine Dateien und nutzt ausschließlich das Agent-Werkzeug. Wenn FlowForge dir ' +
      'einen Block ankündigt, startest du GENAU EINEN Block-Agenten: Rufe das Agent-Werkzeug ' +
      'auf mit subagent_type "block" und run_in_background false; als prompt genügt das Wort ' +
      'AUFTRAG — FlowForge setzt den echten Arbeitsauftrag beim Aufruf selbst ein. Wenn der ' +
      'Agent fertig ist, antwortest du nur mit: OK — das Fazit liest FlowForge selbst mit. ' +
      'Antworte auf Deutsch.',
    dispatch: (blockName) =>
      `FlowForge: Der Block „${blockName}" steht an. Starte jetzt genau einen Block-Agenten ` +
      '(Agent-Werkzeug, subagent_type "block", run_in_background false, prompt: AUFTRAG). ' +
      'Antworte danach nur mit: OK',
    blockAgentSystem: (projektPfad, titelMax, textMax) =>
      'Du bist ein Block-Agent von FlowForge und führst genau den Arbeitsauftrag aus, den ' +
      'du bekommst — nicht mehr und nicht weniger. Antworte auf Deutsch. Dein Abschlusstext ' +
      'ist das Fazit, das FlowForge als Ergebnis dieses Blocks übernimmt.\n' +
      'Halte dein Arbeitsgedächtnis schlank — es ist der teuerste Teil des Laufs: Breites ' +
      'Suchen und Einlesen delegierst du an Unteraufgaben (Agent-Werkzeug), die dir nur ihr ' +
      'kompaktes Fazit zurückgeben. Lies keine Datei doppelt und nichts auf Vorrat.\n' +
      `Der Projektordner ist: ${projektPfad}\n` +
      'Verwende bei Datei-Werkzeugen (Read/Write/Edit) ausschließlich Pfade relativ zum ' +
      'Projektordner oder diesen absoluten Windows-Pfad. Niemals POSIX-Pfade wie /tmp/… ' +
      'oder /c/… verwenden — sie zeigen auf Windows auf falsche Orte.\n' +
      'Projektkarten: FlowForge verwaltet strukturierte Karten (Status, Aufgabe, ' +
      'Entscheidung, Wissen) als Gedächtnis des Projekts. Lies und schreibe sie ' +
      'ausschließlich über die karten-Werkzeuge (karten_uebersicht, karte_anlegen, ' +
      'karte_aktualisieren, karte_erledigen) — niemals über die Datei karten.json. ' +
      `Harte Regeln: Titel höchstens ${titelMax} Zeichen, Inhalt höchstens ${textMax} ` +
      'Zeichen; wer mehr zu sagen hat, legt mehrere fokussierte Karten an. Es gibt genau ' +
      'eine Status-Karte — sie kann weder gelöscht noch neu angelegt werden.',
    nurEinAgent:
      'FlowForge: Für diesen Block lief bereits ein Agent. Starte keinen weiteren — ' +
      'antworte nur mit: OK',
    koordinatorGesperrt:
      'FlowForge: Als Koordinator erledigst du nichts selbst — die Arbeit erledigen die ' +
      'Block-Agenten. Antworte nur mit: OK',
    // Automatischer Übertrag (SPEC §5): Die Lauf-Session ist fast voll — der
    // Koordinator schreibt die Übergabe, der Block läuft frisch erneut an.
    uebertragAnweisung:
      'WICHTIG — Anweisung von FlowForge: Das Kontextfenster dieser Lauf-Session ist fast ' +
      'voll; der laufende Block-Agent wurde unterbrochen, sein Block wird in einer frischen ' +
      'Session neu angestoßen. Starte KEINEN weiteren Agenten. Schreibe als Antwort eine ' +
      'kurze Übergabe für den nächsten Anlauf dieses Blocks: 1. Was in diesem Lauf bisher ' +
      'erledigt wurde (die Fazite kennst du). 2. Was der unterbrochene Block zuletzt tun ' +
      'sollte. 3. Was der nächste Anlauf wissen muss, um nahtlos weiterzumachen.'
  },
  // Prüfkarten im Prüfer-Auftrag (BAUPLAN 18): Der Nutzer hat alte Prüfungen
  // auf diesen Prüf-Block gezogen — sie werden zusätzlich geprüft.
  agentenPruefkarten: {
    einleitung:
      '\n\nZusätzlich von FlowForge — Wiederholungsprüfung: Der Nutzer hat die folgenden ' +
      'Prüfkarten auf diesen Prüf-Block gezogen. Führe deren Prüfungen ZUSÄTZLICH zu deiner ' +
      'eigentlichen Prüfung aus; die aufbewahrten Prüfdateien liegen schon in der Prüfmappe ' +
      '(je Karte ein eigener Unterordner). Passt eine alte Prüfung nicht mehr zum heutigen ' +
      'Code (verschobene Dateien, umgebaute Stellen, geänderte Pfade), passe sie in ihrem ' +
      'Unterordner an, statt sie zu verwerfen — FlowForge bewahrt die angepasste Fassung ' +
      'hinter der Karte auf. Scheitert eine dieser Prüfungen zu Recht, zählt das als nicht ' +
      'bestanden und gehört in deine Beanstandungen. Die Prüfkarten:\n',
    eintrag: (titel, text, ordner) => `- „${titel}" (Dateien in pruefung/${ordner}/): ${text}\n`,
    eintragOhneDateien: (titel, text) =>
      `- „${titel}" (keine aufbewahrten Prüfdateien — prüfe das Beschriebene mit frisch geschriebenen Prüfungen): ${text}\n`
  },
  // Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026): Recherche über
  // Ollama statt über Motor-Unteraufgaben — kostet kein Kontingent. Das kleine
  // Modell kann erfinden — deshalb trägt jedes Fazit einen ehrlichen
  // Warnhinweis, und die Agenten prüfen wichtige Fundorte selbst nach.
  agentenLokaleHelfer: {
    werkzeugBeschreibung:
      'Delegiert einen rein lesenden Recherche-Auftrag (Dateien auflisten, lesen, ' +
      'durchsuchen) an die lokale Helfer-KI — sie kostet kein Kontingent. Liefert ein ' +
      'kompaktes Fazit mit Fundorten. Achtung: kleines Modell — nutze es für Überblick ' +
      'und Vorarbeit; die Stellen, auf die du deine Arbeit stützt, liest du selbst nach.',
    serverHinweis:
      'Die lokale Helfer-KI recherchiert rein lesend im Projektordner. Nutze sie ' +
      'bevorzugt für Einlese- und Suchaufträge, statt eine Unteraufgabe des Motors zu starten.',
    fazit: (text) =>
      'Fazit der lokalen Helfer-KI (kleines Modell — prüfe Fundorte, auf die du deine ' +
      'Arbeit stützt, selbst nach):\n' + text,
    gescheitert: (fehler) =>
      'Die lokale Helfer-KI konnte nicht recherchieren: ' +
      fehler +
      ' Erledige die Recherche stattdessen mit einer Unteraufgabe (Agent-Werkzeug) oder selbst.',
    // Lokale Vorreparatur (BAUPLAN 20): der Auftrag an das lokale Modell —
    // eng umrissen, nur die mechanischen Beanstandungen des Prüfers.
    reparaturAuftrag: (kritik) =>
      'Ein Prüfer hat in diesem Projekt Beanstandungen gefunden, die als mechanisch ' +
      'reparierbar eingestuft sind (Tippfehler, falscher Wert, vergessener Randfall). ' +
      'Behebe GENAU diese Beanstandungen — nichts anderes:\n\n' +
      kritik,
    // Zusatz im Systemtext der Block-Agenten, wenn die lokale KI bereitsteht.
    systemZusatz:
      'Für Einlese- und Suchaufträge steht dir das Werkzeug lokal_recherchieren bereit ' +
      '(lokale KI, kostet kein Kontingent) — nutze es bevorzugt für Recherche: sowohl ' +
      'dort, wo dein Auftrag Unteraufgaben fürs Einlesen vorsieht, als auch für dein ' +
      'eigenes Umsehen im Projekt. Es ist ein kleines Modell: gut für Überblick und ' +
      'Fundstellen; die Stellen, auf die du deine Arbeit stützt, liest du selbst nach. ' +
      'Scheitert es, nutze wie gewohnt das Agent-Werkzeug.\n' +
      'Für eng umrissene, schablonenhafte Schreibarbeit mit klarem Vorbild (z.B. „eine ' +
      'weitere Prüfdatei nach dem Muster von X") steht dir lokal_entwerfen bereit: Die ' +
      'lokale KI schreibt einen Entwurf in die arbeitsablage/ — nie an den Zielort. Du ' +
      'liest den Entwurf gegen, übernimmst ihn selbst an den Zielort (oder verwirfst ihn ' +
      'und schreibst selbst — ungeprüft zählt nichts) und meldest die Entscheidung mit ' +
      'entwurf_abnehmen. Für Neues ohne Vorbild schreibst du direkt selbst.\n' +
      'Für eng umrissene, einzeln prüfbare Umsetzungs-Teilaufträge steht dir lokal_bauen ' +
      'bereit: Die lokale KI baut das Teilstück direkt im Projekt (FlowForge legt vorher ' +
      'einen Sicherungspunkt an). Du liest jedes Teilstück SOFORT gegen und meldest die ' +
      'Abnahme mit teilstueck_abnehmen — bei „nicht gehalten" rollt FlowForge den Stand ' +
      'automatisch zurück und du baust selbst. Höchstens 2 lokale Anläufe je Teilstück, ' +
      'dann baust du es selbst — kein Pingpong.\n',
    // Lokale Entwürfe (BAUPLAN 21): schablonenhafte Schreibarbeit lokal
    // entwerfen lassen, Abnahme beim Block-Agenten — ungeprüft zählt nichts.
    entwerfenBeschreibung:
      'Delegiert eng umrissene, schablonenhafte Schreibarbeit mit klarem Vorbild an die ' +
      'lokale Helfer-KI — sie kostet kein Kontingent und schreibt einen ENTWURF in die ' +
      'arbeitsablage/, nie an den Zielort. Danach liest du den Entwurf gegen, übernimmst ' +
      'ihn selbst an den Zielort oder verwirfst ihn, und meldest die Entscheidung mit ' +
      'entwurf_abnehmen. Nur für Schablonen-Arbeit mit Vorbild — Neues schreibst du selbst.',
    entwurfFazit: (fazit, dateien) =>
      'Entwurf der lokalen Helfer-KI (kleines Modell — ungeprüft zählt nichts):\n' +
      'Entwurfsdateien: ' +
      dateien.join(', ') +
      '\n' +
      fazit +
      '\n\nLies den Entwurf jetzt vollständig gegen. Übernimm ihn selbst an den Zielort ' +
      '(gern mit Korrekturen) oder verwirf ihn und schreibe selbst — und melde deine ' +
      'Entscheidung mit entwurf_abnehmen.',
    entwurfKeineDatei:
      'Die lokale Helfer-KI hat keinen Entwurf geschrieben. Erledige die Schreibarbeit selbst.',
    entwerfenGescheitert: (fehler) =>
      'Die lokale Helfer-KI konnte nicht entwerfen: ' + fehler + ' Erledige die Schreibarbeit selbst.',
    abnehmenBeschreibung:
      'Meldet die Abnahme-Entscheidung zu einem Entwurf der lokalen Helfer-KI: übernommen ' +
      '(du hast ihn gegengelesen und selbst an den Zielort gebracht) oder verworfen (du ' +
      'schreibst selbst). Pflicht nach jedem lokal_entwerfen.',
    abgenommen: (entwurf, uebernommen) =>
      uebernommen
        ? `Abnahme vermerkt: Entwurf „${entwurf}" übernommen.`
        : `Abnahme vermerkt: Entwurf „${entwurf}" verworfen — du schreibst selbst.`,
    // Lokaler Bauer (BAUPLAN 22): kleine Teilaufträge baut die lokale KI
    // direkt im Projekt — Opus zerlegt, liest jedes Teilstück sofort gegen
    // und bleibt der Schiedsrichter. Ungeprüft zählt nichts.
    bauenBeschreibung:
      'Delegiert einen eng umrissenen, einzeln prüfbaren Bau-Teilauftrag an die lokale ' +
      'Helfer-KI — sie baut mit Schreibrecht direkt im Projektordner (Prüfmappe und ' +
      'FlowForge-Verwaltungsdateien bleiben gesperrt; FlowForge legt vorher automatisch ' +
      'einen Sicherungspunkt an). Nenne im Auftrag Fundstellen oder Vorbild, feste ' +
      'Schnittstellen (Datei, Funktionsname, was rein, was raus) und das Fertig-Kriterium. ' +
      'Danach liest du das Teilstück sofort gegen und meldest die Abnahme mit ' +
      'teilstueck_abnehmen — Pflicht, bevor du das nächste Teilstück baust.',
    bauenFazit: (fazit, dateien, ersetzungen) =>
      'Teilstück der lokalen Helfer-KI (kleines Modell — ungeprüft zählt nichts):\n' +
      (dateien.length ? 'Geschriebene Dateien: ' + dateien.join(', ') + '\n' : '') +
      (ersetzungen > 0
        ? `Gezielte Ersetzungen: ${ersetzungen}\n`
        : '') +
      fazit +
      '\n\nLies das Teilstück jetzt vollständig gegen — die geänderten Stellen selbst, ' +
      'nicht nur den Bericht. Dann melde deine Abnahme mit teilstueck_abnehmen: gehalten ' +
      '(du übernimmst es; kleine Korrekturen machst du danach selbst) oder nicht gehalten ' +
      '(FlowForge rollt den Stand auf den Sicherungspunkt zurück und du baust selbst).',
    bauenErstAbnehmen: (teilstueck) =>
      `Zuerst die Abnahme: Melde das offene Teilstück „${teilstueck}" mit ` +
      'teilstueck_abnehmen, bevor du das nächste baust — sonst ist der Rückroll-Punkt ' +
      'nicht mehr eindeutig.',
    bauenKeinSicherungspunkt:
      'Es ließ sich kein Sicherungspunkt anlegen — ohne Rückroll-Punkt baut die lokale KI ' +
      'nicht. Baue dieses Teilstück selbst.',
    bauenGescheitert: (fehler) =>
      'Die lokale Helfer-KI konnte das Teilstück nicht bauen: ' +
      fehler +
      ' Der Projektstand ist sauber (halbe Änderungen wurden zurückgerollt). Baue dieses ' +
      'Teilstück selbst — oder versuche es einmal mit einem präziseren Teilauftrag erneut ' +
      '(höchstens 2 lokale Anläufe je Teilstück).',
    bauenKeineAenderung:
      'Die lokale Helfer-KI hat nichts gebaut (keine Änderung im Projekt). Baue dieses ' +
      'Teilstück selbst — oder versuche es einmal mit einem präziseren Teilauftrag erneut ' +
      '(höchstens 2 lokale Anläufe je Teilstück).',
    abnehmenTeilstueckBeschreibung:
      'Meldet die Abnahme zu einem mit lokal_bauen gebauten Teilstück: gehalten ' +
      '(gegengelesen und übernommen) oder nicht gehalten (FlowForge rollt den Stand auf ' +
      'den Sicherungspunkt vor dem Teilstück zurück — danach baust du es selbst). ' +
      'Pflicht nach jedem lokal_bauen, bevor das nächste Teilstück gebaut wird.',
    teilstueckGehaltenText: (teilstueck) =>
      `Abnahme vermerkt: Teilstück „${teilstueck}" gehalten.`,
    teilstueckVerworfenText: (teilstueck) =>
      `Abnahme vermerkt: Teilstück „${teilstueck}" nicht gehalten — der Stand ist auf den ` +
      'Punkt vor dem Teilstück zurückgerollt. Baue es jetzt selbst (oder gib der lokalen ' +
      'KI genau einen präziseren zweiten Anlauf, falls sie noch keinen hatte).',
    teilstueckOhneOffenes:
      'Kein offenes Teilstück — nichts abzunehmen und nichts zurückzurollen. (Ein ' +
      'gescheiterter lokal_bauen-Versuch ist schon aufgeräumt.)',
    // Zusatz im Bauer-Auftrag (nur wenn die lokale KI bereitsteht und das
    // Häkchen am Block an ist — eingesetzt von der Lauf-Verwaltung).
    bauenAuftragZusatz:
      '\n\nZusatz von FlowForge — lokaler Bauer (die lokale KI steht bereit): Zerlege das ' +
      'Arbeitspaket in möglichst kleine, einzeln prüfbare Teilaufträge — jeder mit ' +
      'Fundstellen oder Vorbild, eigenem Fertig-Kriterium und vorher festgelegten ' +
      'Schnittstellen (welche Datei, welcher Funktionsname, was rein, was raus), damit die ' +
      'Teile zusammenstecken. Rufe je Teilauftrag lokal_bauen und lies das Teilstück ' +
      'SOFORT gegen — Gegenlesen ist billiger als Selberschreiben; melde jede Abnahme mit ' +
      'teilstueck_abnehmen, bevor du das nächste Teilstück baust. Hält ein Teilauftrag ' +
      'nach 2 lokalen Anläufen nicht, baue GENAU dieses Teilstück selbst und mach mit dem ' +
      'nächsten weiter — kein Pingpong. Bündle nach Zusammengehörigkeit: Einen trivialen ' +
      'Auftrag präzise zu beschreiben kostet fast so viel, wie ihn selbst zu erledigen — ' +
      'Kleinst-Änderungen erledigst du direkt selbst.'
  },
  // KI-Assistent des Block-Editors (SPEC §4.5, BAUPLAN 14) — Texte an den Motor.
  agentenBlockAssistent: {
    keineWerkzeuge:
      'Für diese Aufgabe gibt es keine Werkzeuge. Antworte direkt mit dem geforderten JSON.',
    auftrag: (beschreibung, etiketten) =>
      'Du hilfst im Block-Editor von FlowForge, einer App, in der ein Nicht-Programmierer ' +
      'Coding-Workflows aus Blöcken baut. Ein Block ist ein Arbeitsauftrag an einen ' +
      'KI-Agenten, der in einem Projektordner arbeitet. Der Nutzer hat beschrieben, was ' +
      'sein neuer Block tun soll — du füllst daraus das Block-Formular aus.\n\n' +
      'Beschreibung des Nutzers:\n' +
      beschreibung +
      '\n\n' +
      'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Erklärtext und ohne ' +
      'Markdown-Zäune, mit genau diesen Feldern:\n' +
      '{"name": "...", "symbol": "...", "beschreibung": "...", "auftrag": "...", ' +
      '"braucht": ["..."], "liefert": ["..."], "nurLesen": true}\n\n' +
      'Regeln:\n' +
      '- name: kurzer deutscher Name (höchstens 40 Zeichen).\n' +
      '- symbol: genau ein passendes Emoji.\n' +
      '- beschreibung: ein Satz für die Blockbibliothek, verständlich für einen ' +
      'Nicht-Programmierer (höchstens 200 Zeichen).\n' +
      '- auftrag: der Arbeitsauftrag an den Agenten, auf Deutsch, in Du-Form (höchstens ' +
      '4000 Zeichen). Sag klar, was er tun soll und was ausdrücklich nicht. Beginne mit ' +
      'seiner Rolle („Du bist …"), verlange „Antworte auf Deutsch", und beende den ' +
      'Auftrag mit einer Anweisung für den Abschlusstext: kompakt (höchstens etwa 25 ' +
      'Zeilen), denn er ist die Übergabe an die folgenden Blöcke. Ist nurLesen true, ' +
      'schreibe ausdrücklich hinein: „Du darfst nichts verändern — nur lesen."\n' +
      '- braucht: Etiketten der Übergaben, die dieser Block von vorherigen Blöcken ' +
      'zwingend benötigt (höchstens 5, je höchstens 40 Zeichen). Nur was wirklich nötig ' +
      'ist — ein Block ohne braucht kann am Anfang des Workflows stehen.\n' +
      '- liefert: Etiketten für den Abschlusstext dieses Blocks, wenn spätere Blöcke ihn ' +
      'nutzen sollen (höchstens 5).\n' +
      '- Verwende bei braucht/liefert möglichst diese vorhandenen Etiketten, statt neue ' +
      'zu erfinden: ' +
      etiketten.join(', ') +
      '.\n' +
      '- nurLesen: true, wenn der Block nichts am Projekt verändern muss (ansehen, ' +
      'prüfen, berichten) — im Zweifel die sichere Wahl.'
  },
  // Startanleitung & „App starten"-Knopf (SPEC §8, BAUPLAN 10).
  startanleitung: {
    knopf: 'App starten',
    startet: 'startet …',
    keineHinweis:
      'Noch keine Startanleitung. Ein Bau-Workflow (z.B. „Feature hinzufügen") legt sie an — danach startet deine App hier mit einem Klick.',
    fehlerKeine:
      'Es gibt noch keine Startanleitung. Lass zuerst einen Bau-Workflow laufen — er legt sie als Pflicht-Artefakt an.',
    fehlerDateiFehlt: (datei) =>
      `Die Startanleitung zeigt auf „${datei}" — diese Datei gibt es nicht (mehr). Lass einen Bau-Workflow die Anleitung erneuern.`,
    fehlerOeffnen: 'Die App ließ sich nicht öffnen. Bitte versuch es noch einmal.'
  },
  // Texte des start-Werkzeugs an den Agenten.
  agentenStart: {
    gesetzt: (anleitung) =>
      `Startanleitung festgelegt: ${anleitung.beschreibung}` +
      (anleitung.befehl ? ` · Befehl: ${anleitung.befehl}` : '') +
      (anleitung.adresse ? ` · Adresse: ${anleitung.adresse}` : ''),
    fehlerBeschreibung: (max) =>
      `Die beschreibung fehlt oder ist zu lang (höchstens ${max} Zeichen) — ein Satz in Alltagssprache genügt.`,
    fehlerQuelleFehlt:
      'Gib mindestens eines an: befehl (Kommandozeile im Projektordner) und/oder adresse (http(s)-Adresse oder Datei im Projektordner).',
    fehlerZuLang: 'befehl oder adresse ist zu lang — halte beides kurz und konkret.',
    fehlerAdresse:
      'Die adresse muss mit http:// oder https:// beginnen — oder eine Datei im Projektordner sein (relativer Pfad, kein Ausbruch per „..").'
  },
  // Eigener Bestätigungs-Dialog statt nativer Windows-Fenster (Bugfix 13.08.2026).
  bestaetigung: {
    abbrechen: 'Abbrechen',
    ja: 'Ja',
    ok: 'Alles klar',
    loeschen: 'Löschen',
    ersetzen: 'Vorlage übernehmen',
    sofortAbbrechen: 'Sofort abbrechen'
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
    // Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026).
    lokaleHelferUeberschrift: 'Lokale Helfer-KI (Experiment)',
    lokaleHelferAktiv: 'Recherche-, Entwurfs- und kleine Bau-Aufträge an eine lokale KI (Ollama) geben',
    lokaleHelferHinweis:
      'Die Block-Agenten geben Einlesen, Suchen, schablonenhafte Entwürfe und kleine ' +
      'Bau-Teilaufträge an eine kleine KI auf deinem Rechner ab — das kostet kein ' +
      'Abo-Kontingent, nur Rechenzeit. Schreiben darf die lokale KI nur an kurzer Leine: ' +
      'Entwürfe landen in der Wegwerf-Ablage und werden vom Motor gegengelesen, die ' +
      'Vorreparatur ersetzt gezielt nach Prüfer-Beanstandungen, und jedes gebaute ' +
      'Teilstück wird sofort abgenommen — immer mit Sicherungspunkt und automatischem ' +
      'Zurückrollen, wenn es nicht hält. ' +
      'Achtung: Kleine Modelle arbeiten langsamer und ungenauer; wichtige Fundorte ' +
      'prüft der Agent selbst nach. Voraussetzung: Ollama läuft und das Modell ist ' +
      'heruntergeladen.',
    lokaleHelferModell: 'Modellname bei Ollama',
    lokaleHelferAdresse: 'Adresse des Ollama-Rechners',
    lokaleHelferAdresseHinweis:
      'Leer lassen bzw. http://127.0.0.1:11434 = dieser Rechner. Es geht auch ein anderer ' +
      'Rechner im Heimnetz, z.B. ein Gaming-PC: http://192.168.x.x:11434 — dort muss ' +
      'Ollama laufen und für das Netzwerk freigegeben sein.',
    lokaleHelferStatusBereit: (modell) => `Ollama läuft, Modell „${modell}" ist da.`,
    lokaleHelferStatusKeinModell: (modell) =>
      `Ollama läuft, aber das Modell „${modell}" ist nicht heruntergeladen.`,
    lokaleHelferStatusVorhandene: (modelle) => `Vorhanden: ${modelle.join(', ')}.`,
    lokaleHelferStatusAus: 'Ollama ist unter dieser Adresse gerade nicht erreichbar.',
    uebertragUeberschrift: 'Sessions & Übertrag',
    uebertragTest: 'Test-Schalter: Übertrag schon bei etwa 10 %',
    uebertragTestHinweis:
      'Nur zum Ausprobieren des automatischen Übertrags: Er greift dann schon, sobald ein Block ' +
      'etwa 10 Prozentpunkte Kontext verbraucht hat — statt erst bei 85 %. Im Alltag ausschalten, ' +
      'sonst wird unnötig oft übergeben.',
    rechteUeberschrift: 'Rechte-Rückfragen',
    rechteFragen: 'Jedes Mal fragen (Standard)',
    rechteFragenHinweis:
      'Bei allem außerhalb des Projektordners, Internet und unbekannten Befehlen wirst du gefragt.',
    rechteAutomatisch: 'Automodus: automatisch erlauben',
    rechteAutomatischHinweis:
      'Rückfragen werden ohne Nachfrage erlaubt und im Laufbericht vermerkt. Die harten Sperren ' +
      '(Git, FlowForge-Verwaltungsdateien, „darf nur lesen") gelten weiterhin. Der Agent darf dann ' +
      'aber z.B. außerhalb des Projektordners schreiben und ins Internet — nutze das nur, wenn du ' +
      'dem Auftrag vertraust.',
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
    // Lauf-Tab zeigt, welcher Block gerade arbeitet (Wunsch Georg, 13.08.2026).
    geradeArbeitet: (n) => (n === 1 ? 'Gerade arbeitet:' : 'Gerade arbeiten:'),
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
      wiederhergestellt: 'Stand wiederhergestellt',
      'kontingent-erschoepft': 'Kontingent erschöpft — angehalten'
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
    fertigKontingent:
      'Dein Abo-Kontingent ist im Moment erschöpft. Der Lauf hat angehalten — alles bisher Gebaute bleibt bestehen. Starte den Workflow neu, sobald dein Kontingent wieder da ist.',
    okKnopf: 'Alles klar',
    schonAktiv: 'Es läuft schon ein Workflow. Bitte warte, bis er fertig ist.',
    // Eine Motor-Session pro Lauf (BAUPLAN 19): Ohne Fazit des Block-Agenten
    // gilt der Block ehrlich als fehlgeschlagen — statt ein leeres Ergebnis
    // an die Folgeblöcke weiterzureichen.
    blockOhneFazit:
      'Der Block-Agent hat kein Fazit geliefert — der Block gilt als fehlgeschlagen.',
    // Parallelität & Warteschlange (SPEC §5, BAUPLAN 12).
    schonInWarteschlange: 'Dieser Workflow steht schon in der Warteschlange.',
    wartetMarke: 'wartet',
    wartetHinweis: (position) =>
      'Der Lauf wartet in der Warteschlange' +
      (position > 1 ? ` (Platz ${position})` : '') +
      ' und startet von allein, sobald Platz ist — höchstens 3 Workflows laufen gleichzeitig, und pro Projekt nur einer.',
    warteschlangeVerlassen: 'Aus der Warteschlange nehmen',
    warteschlangeFehler: (fehler) => `Der wartende Lauf konnte nicht starten: ${fehler}`,
    folgelaufWartet:
      'Ein weiterer Lauf ist vorgemerkt und startet von allein, sobald dieser fertig ist.',
    parallelHinweis: (anzahl) =>
      `${anzahl} Workflows laufen gleichzeitig — parallele Läufe vervielfachen den Verbrauch deines Kontingents.`,
    parallelStartHinweis: (anzahl) =>
      anzahl === 1
        ? 'In einem anderen Projekt läuft gerade ein Workflow — ein weiterer Lauf vervielfacht den Verbrauch deines Kontingents.'
        : `In anderen Projekten laufen gerade ${anzahl} Workflows — ein weiterer Lauf vervielfacht den Verbrauch deines Kontingents.`,
    // Parallele Zweige (SPEC §4.1, BAUPLAN 13): sichtbarer Verbrauchs-Hinweis.
    parallelBloeckeHinweis: (anzahl) =>
      `${anzahl} Blöcke laufen jetzt gleichzeitig — parallele Blöcke vervielfachen den Verbrauch deines Kontingents.`,
    aboNichtErlaubt:
      'Diese FlowForge-Version läuft nur mit API-Schlüssel. Bitte hinterlege einen in den Einstellungen.',
    motorNichtAngemeldet:
      'Der Motor ist nicht angemeldet. Bitte melde dich einmal in der Claude-App bzw. mit „claude" an — oder hinterlege einen API-Schlüssel in den Einstellungen.',
    obergrenzeErreicht: 'Die Ausgaben-Obergrenze für diesen Lauf wurde erreicht.',
    kontingentErschoepft: 'Dein Abo-Kontingent ist im Moment aufgebraucht.',
    serverUeberlastet: 'Die KI-Server sind im Moment überlastet.'
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
      'Dieser Block darf nur lesen. Schreiben, verändernde Befehle und Internet sind hier gesperrt. Beende den Auftrag nur mit Lese-Werkzeugen.',
    // Verfeinerte Lese-Sperre (Feedback Georg, 12.08.2026): rein lesende
    // Befehle laufen durch — für alles andere sagt die Meldung ehrlich, warum.
    nurLesenBefehlFuerAgent:
      'Dieser Block darf nur lesen. Rein lesende Befehle (dir, ls, type, cat, findstr, grep, where, echo, pwd, head, tail, wc) laufen durch — dieser Befehl gehört nicht dazu, auch Ausführen von Programmen oder Tests zählt nicht als Lesen. Nutze die Lese-Werkzeuge oder einen rein lesenden Befehl.',
    // Prüfmappen-Sperre (Feedback Georg, 12.08.2026): die Testdateien im
    // Prüfordner gehören dem Prüfer — kein anderer Block ändert sie.
    pruefmappeGesperrtFuerAgent:
      'Der Prüfordner „pruefung" gehört dem Prüfer: Nur Prüf-Blöcke dürfen dort Dateien anlegen oder ändern. Lass die Prüfmappe unverändert — wenn eine Prüfung deiner Meinung nach falsch ist, schreibe das in deinen Abschlusstext.',
    // Bilder-Verbot in der Prüfmappe (BAUPLAN 17): hartes Nein, auch für Prüfer.
    pruefmappeBildFuerAgent:
      'Bilddateien sind im Prüfordner „pruefung" verboten (hartes Nein, auch für Prüfer): Prüfungen sind kleine Textdateien und Skripte. Prüfe ohne Bildvergleiche — die blockieren künftige, völlig erlaubte Änderungen.',
    verwaltungGesperrtFuerAgent:
      'Diese Datei verwaltet FlowForge selbst — sie ist für direkte Änderungen gesperrt. Karten liest und schreibst du über die karten-Werkzeuge.',
    // Häkchen je Block (BAUPLAN 20): abgewählt = echte Sperre, kein Hinweis.
    lokaleKiGesperrtFuerAgent:
      'Die lokale Helfer-KI ist für diesen Block abgeschaltet (Häkchen an der Block-Karte). Nutze für Unteraufgaben das Agent-Werkzeug.'
  },
  ticker: {
    // Eine Motor-Session pro Lauf (BAUPLAN 19): Der Motor startet einmal,
    // die Blöcke laufen darin als frische Agenten.
    laufSessionGestartet: (modell) =>
      `Motor gestartet (${modell}) — eine Lauf-Session für den ganzen Lauf; jeder Block läuft darin als eigener Agent.`,
    laufSessionFortgesetzt: 'Lauf-Session fortgesetzt statt neu gestartet.',
    blockAgentGestartet: (name) => `„${name}" läuft als frischer Agent in der Lauf-Session.`,
    koordinatorGestoppt:
      'Werkzeug-Versuch des Koordinators gestoppt — Arbeit erledigen nur die Block-Agenten.',
    parallelEigeneSession: (name) =>
      `„${name}" läuft parallel in einer eigenen Session — die Lauf-Session ist gerade beschäftigt.`,
    // Lokale Helfer-KI (Experiment): sichtbar, wenn die lokale KI recherchiert.
    lokaleHelferBereit: (modell) =>
      `Lokale Helfer-KI bereit (${modell}) — Recherche-Aufträge kosten kein Kontingent.`,
    lokaleHelferNichtErreichbar:
      'Lokale Helfer-KI ist eingeschaltet, aber Ollama ist nicht erreichbar (oder das Modell fehlt) — Unteraufgaben laufen normal über den Motor.',
    lokaleHelferStart: (modell) => `Lokale KI recherchiert (${modell}) …`,
    lokaleHelferSchritt: (werkzeug) =>
      werkzeug === 'aufruf_uebersetzt'
        ? 'Lokale KI · Werkzeugaufruf kam als Text getarnt — FlowForge hat ihn übersetzt und führt ihn aus.'
        : werkzeug === 'datei_lesen'
          ? 'Lokale KI · liest eine Datei.'
          : werkzeug === 'suchen'
            ? 'Lokale KI · durchsucht das Projekt.'
            : 'Lokale KI · sieht sich einen Ordner an.',
    lokaleHelferFertig: (schritte) =>
      `Lokale KI fertig — Fazit nach ${schritte} ${schritte === 1 ? 'Schritt' : 'Schritten'}.`,
    lokaleHelferGescheitert: (fehler) => `Lokale KI gescheitert: ${fehler}`,
    lokaleKiGesperrt:
      'lokal_recherchieren gestoppt — die lokale KI ist für diesen Block abgeschaltet.',
    // Lokale Entwürfe (BAUPLAN 21): sichtbar, wenn die lokale KI entwirft —
    // und was aus dem Entwurf wurde (Abnahme durch den Block-Agenten).
    lokaleEntwurfStart: (modell) => `Lokale KI entwirft (${modell}) …`,
    lokaleEntwurfSchritt: (pfad) =>
      pfad ? `Lokale KI · schreibt Entwurf ${pfad}.` : 'Lokale KI · schreibt einen Entwurf.',
    lokaleEntwurfFertig: (dateien, schritte) =>
      `Lokale KI fertig — ${dateien.length === 1 ? 'ein Entwurf' : dateien.length + ' Entwürfe'} in der Arbeitsablage ` +
      `(${schritte} ${schritte === 1 ? 'Schritt' : 'Schritte'}). Der Agent liest gegen.`,
    lokaleEntwurfKeineDatei:
      'Lokale KI hat keinen Entwurf geschrieben — der Agent schreibt selbst.',
    lokaleEntwurfGescheitert: (fehler) => `Lokaler Entwurf gescheitert: ${fehler}`,
    entwurfUebernommen: (entwurf) => `Entwurf übernommen: ${entwurf}.`,
    entwurfVerworfen: (entwurf) => `Entwurf verworfen: ${entwurf} — der Agent schreibt selbst.`,
    // Lokaler Bauer (BAUPLAN 22): jedes Teilstück ehrlich im Ticker —
    // Zerlegen, Bauen, Abnahme und Rückrollen sind sichtbar.
    lokaleBauenStart: (teilstueck, modell) =>
      `Lokale KI baut Teilstück „${teilstueck}" (${modell}) — Sicherungspunkt liegt an.`,
    lokaleBauenSchritt: (pfad) =>
      pfad ? `Lokale KI · schreibt ${pfad}.` : 'Lokale KI · schreibt eine Datei.',
    lokaleBauenFertig: (aenderungen, schritte) =>
      `Lokale KI fertig — ${aenderungen} ${aenderungen === 1 ? 'Änderung' : 'Änderungen'} im Projekt ` +
      `(${schritte} ${schritte === 1 ? 'Schritt' : 'Schritte'}). Der Agent liest gegen.`,
    lokaleBauenNichtsGebaut:
      'Lokale KI hat nichts gebaut — der Agent baut dieses Teilstück selbst.',
    lokaleBauenGescheitert: (fehler) => `Lokales Bauen gescheitert: ${fehler}`,
    lokaleBauenZurueckgerollt:
      'Halbfertige Änderungen des gescheiterten Bau-Versuchs zurückgerollt — der Stand ist wieder sauber.',
    teilstueckGehalten: (teilstueck) =>
      `Teilstück „${teilstueck}" gehalten — Abnahme bestanden.`,
    teilstueckVerworfen: (teilstueck) =>
      `Teilstück „${teilstueck}" nicht gehalten — Stand zurückgerollt, der Agent baut selbst.`,
    // Lokale Vorreparatur (BAUPLAN 20): jeder Versuch ehrlich im Ticker.
    lokaleReparaturNichtMechanisch: (zielName) =>
      `Keine rein mechanischen Beanstandungen — die Reparatur geht direkt an „${zielName}" (Motor).`,
    lokaleReparaturStart: (versuch, max, modell) =>
      `Lokale Reparatur, Versuch ${versuch} von ${max} (${modell}) — Sicherungspunkt liegt an.`,
    lokaleReparaturSchritt: (pfad) =>
      pfad ? `Lokale KI · ersetzt gezielt in ${pfad}.` : 'Lokale KI · ersetzt gezielt eine Stelle.',
    lokaleReparaturFertig: (ersetzungen) =>
      `Lokale Reparatur fertig — ${ersetzungen} ${ersetzungen === 1 ? 'Stelle' : 'Stellen'} ersetzt. Der Prüfer prüft nach.`,
    lokaleReparaturNichtsErsetzt:
      'Lokale Reparatur ohne Ergebnis — nichts ersetzt, der Versuch zählt trotzdem.',
    lokaleReparaturGescheitert: (fehler) => `Lokale Reparatur gescheitert: ${fehler}`,
    lokaleReparaturZurueckgerollt: (versuch, max) =>
      `Nachprüfung nicht bestanden — der Stand wurde auf den Punkt vor der lokalen Reparatur zurückgerollt (Versuch ${versuch} von ${max}).`,
    lokaleReparaturGehalten:
      'Nachprüfung bestanden — die lokale Reparatur hat gehalten, keine Motor-Reparatur nötig.',
    lokaleReparaturOpusUebernimmt: (zielName) =>
      `Die lokale Reparatur hat nicht gereicht — jetzt übernimmt „${zielName}" über den Motor.`,
    schreibtDatei: (pfad) => `Schreibt Datei: ${pfad}`,
    aendertDatei: (pfad) => `Ändert Datei: ${pfad}`,
    liestDatei: (pfad) => `Liest: ${pfad}`,
    durchsucht: 'Durchsucht das Projekt.',
    plant: 'Plant die Arbeitsschritte.',
    unteraufgabe: 'Startet eine Unteraufgabe.',
    // Zeilen aus Unteraufgaben (BAUPLAN 17): der Wegwerf-Helfer wühlt in
    // seinem eigenen Kontext — im Ticker klar gekennzeichnet.
    unteraufgabeZeile: (text) => `Unteraufgabe · ${text}`,
    befehl: (befehl) => `Kommandozeile: ${befehl}`,
    internet: (ziel) => `Internetzugriff: ${ziel}`,
    werkzeug: (name) => `Nutzt Werkzeug: ${name}`,
    rechteFrageGestellt: 'Rechte-Rückfrage an dich — bitte oben beantworten.',
    rechteAutomatischErlaubt: (beschreibung) => `Automodus — automatisch erlaubt: ${beschreibung}`,
    rechteFrageErlaubt: 'Du hast es erlaubt.',
    rechteFrageAbgelehnt: 'Du hast es abgelehnt.',
    sanftAngefordert: 'Sanftes Anhalten angefordert — der laufende Block macht fertig.',
    hartAbgebrochen: 'Sofort abgebrochen.',
    gitGesperrt: 'Git-Befehl gesperrt — Sicherungspunkte übernimmt FlowForge.',
    nurLesenGesperrt: 'Schreib-Versuch gestoppt — dieser Block darf nur lesen.',
    nurLesenBefehlGesperrt:
      'Befehl gestoppt — dieser Block darf nur lesen (rein lesende Befehle laufen durch).',
    pruefmappeGesperrt:
      'Änderung an der Prüfmappe gestoppt — die Prüfdateien gehören dem Prüfer.',
    pruefmappeBildGesperrt:
      'Bilddatei in der Prüfmappe gestoppt — Bilder sind dort verboten, auch für den Prüfer.',
    // Lauf-Mappe statt Projekt-Mappe (BAUPLAN 17).
    pruefmappeGeleert:
      'Prüfmappe geleert — der Prüfer baut seine Prüfungen frisch fürs aktuelle Paket.',
    // Prüfkarten (BAUPLAN 18).
    pruefkartenEingelegt: (n) =>
      n === 1
        ? 'Eine Prüfkarte liegt am Prüfer — ihre aufbewahrten Prüfungen sind wieder in der Prüfmappe.'
        : `${n} Prüfkarten liegen an Prüfern — ihre aufbewahrten Prüfungen sind wieder in der Prüfmappe.`,
    pruefkarteAngelegt: (titel) => `Prüfung bestanden und aufbewahrt — neue Prüfkarte: „${titel}"`,
    arbeitsablageGeleert: 'Arbeitsablage geleert.',
    verwaltungGesperrt: 'Schreib-Versuch auf eine FlowForge-Verwaltungsdatei gestoppt.',
    liestKarten: 'Liest die Projektkarten.',
    karteAngelegt: (titel) => `Karte angelegt: „${titel}"`,
    karteAktualisiert: (titel) => `Karte aktualisiert: „${titel}"`,
    aufgabeErledigt: (titel) => `Aufgabe abgehakt: „${titel}"`,
    aufgabeGeoeffnet: (titel) => `Aufgabe wieder geöffnet: „${titel}"`,
    karteAbgelehnt: (grund) => `Karten-Änderung abgelehnt: ${grund}`,
    startanleitungGesetzt: 'Startanleitung festgelegt — „App starten" ist bereit.',
    startanleitungAbgelehnt: (grund) => `Startanleitung abgelehnt: ${grund}`,
    startanleitungNachgefordert: (block) =>
      `Die Startanleitung fehlt — „${block}" bekommt eine Nachbesserungs-Runde.`,
    startanleitungWeiterOhne:
      'Die Startanleitung fehlt weiterhin — der Lauf macht weiter, „App starten" bleibt aus.',
    sicherungspunktAngelegt: 'Sicherungspunkt angelegt.',
    zurueckgesetzt: 'Projektordner auf den letzten Sicherungspunkt zurückgesetzt.',
    fertigIn: (sekunden) => `Fertig nach ${sekunden} Sekunden.`,
    blockStartet: (nr, gesamt, name) => `Block ${nr} von ${gesamt}: „${name}" startet.`,
    zweigeZusammengefuehrt: (name, anzahl) =>
      `„${name}" führt ${anzahl} Zweige zusammen — alle Vorgänger sind fertig.`,
    pruefungBestanden: 'Prüfung bestanden.',
    pruefungNichtBestanden: 'Prüfung nicht bestanden.',
    pruefungOhneErgebnis:
      'Der Prüfer hat kein eindeutiges Ergebnis geliefert — das gilt als nicht bestanden.',
    rueckfuehrung: (name, runde, gesamt) =>
      `Zurück zu „${name}" — Reparatur-Runde ${runde} von ${gesamt}.`,
    entscheidungGestellt: 'Folgen-Frage an dich — bitte im Fenster beantworten.',
    menschFrageGestellt: 'Frage an dich — bitte im Gespräch antworten.',
    menschGeantwortet: 'Deine Antwort ist beim Agenten.',
    entscheidungWeitermachen: 'Du hast entschieden: weitermachen.',
    entscheidungZurueckgestellt: 'Du hast entschieden: zurückstellen.',
    entscheidungWiederhergestellt: 'Du hast entschieden: Stand von vor dem Lauf wiederherstellen.',
    uebertragAngefordert: (von, bis) =>
      `Der Kontext ist zu etwa ${von}–${bis} % gefüllt — Übertrag: Der Agent notiert den Zwischenstand und übergibt.`,
    uebertragWeiter: (nummer, grenze) =>
      `Übergabe angekommen — eine frische Session macht nahtlos weiter (Übertrag ${nummer}${grenze != null ? ' von höchstens ' + grenze : ''}).`,
    uebertragGrenzeErreicht: (grenze) =>
      `Die Übertragsgrenze (${grenze}) ist erreicht — dieser Block läuft ohne weiteren Übertrag zu Ende.`,
    kontingentPause:
      'Dein Abo-Kontingent ist im Moment aufgebraucht — der Lauf pausiert und probiert es alle 10 Minuten von selbst wieder.',
    serverPause:
      'Die KI-Server sind überlastet — der Lauf pausiert und probiert es alle 10 Minuten von selbst wieder.',
    kontingentVersuch: 'Pause vorbei: FlowForge versucht es jetzt wieder.',
    kontingentWeiter: 'Es geht weiter — der Motor arbeitet wieder.',
    ausWarteschlangeGestartet:
      'Der Platz war frei — dieser Lauf startet jetzt von allein aus der Warteschlange.',
    motorWartet: (versuch, max) =>
      `Die KI-Server sind gerade überlastet — der Motor versucht es weiter (Versuch ${versuch} von ${max}).`,
    wiederaufnahme: (nummer, gesamt, name) =>
      `Wiederaufnahme am letzten Sicherungspunkt — weiter mit Block ${nummer} von ${gesamt}: „${name}".`,
    sessionFortsetzenGescheitert:
      'Die Lauf-Session ließ sich nicht fortsetzen — es geht mit einer frischen Session weiter.'
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
    // Lokale Vorreparatur (BAUPLAN 20): auf genau diesen Punkt wird
    // zurückgerollt, wenn die Nachprüfung scheitert.
    beschriftungVorLokalerReparatur: 'Stand vor lokaler Reparatur',
    // Lokaler Bauer (BAUPLAN 22): auf genau diesen Punkt wird zurückgerollt,
    // wenn die Abnahme des Teilstücks scheitert.
    beschriftungVorLokalemTeilstueck: 'Stand vor lokalem Teilstück',
    beschriftungWiederhergestellt: (zeit) => `Zurückgeholt: Stand von ${zeit}`,
    fehlerAnlegen: 'Der Sicherungspunkt konnte nicht angelegt werden. Der Lauf wurde sicherheitshalber nicht gestartet.',
    fehlerVorschau: 'Die Vorschau konnte nicht erstellt werden.',
    fehlerWiederherstellen: 'Das Wiederherstellen hat nicht geklappt. Der Projektordner wurde nicht verändert.',
    fehlerWaehrendLauf: 'Während ein Workflow läuft, kann nichts wiederhergestellt werden.',
    fehlerWaehrendWarteschlange:
      'Dieses Projekt wartet in der Warteschlange auf einen Lauf — solange kann nichts wiederhergestellt werden.'
  },
  // Rechte-Standard sichtbar in den Projekt-Einstellungen (SPEC §7, BAUPLAN 15).
  projektEinstellungen: {
    ueberschrift: 'Projekt-Einstellungen',
    rechteUeberschrift: 'Rechte des Agenten',
    rechteEinleitung:
      'Diese Regeln gelten für jeden Agenten, der in diesem Projekt arbeitet. Sie sind in V1 fest eingebaut — pro Projekt verstellbar werden sie in einer späteren Version.',
    ohneRueckfrageTitel: 'Ohne Rückfrage erlaubt',
    ohneRueckfrage: [
      'Im Projektordner lesen, schreiben und löschen',
      'Programmbibliotheken aus offiziellen Quellen installieren',
      'Tests und bekannte Entwickler-Werkzeuge ausführen (node, npm, python …)',
      'Rein lesende Kommandozeilen-Befehle (dir, type, findstr …)'
    ],
    mitRueckfrageTitel: 'Nur mit deiner Erlaubnis',
    mitRueckfrage: [
      'Alles außerhalb des Projektordners',
      'Sonstige Internetzugriffe',
      'Unbekannte Kommandozeilen-Befehle und alles Unumkehrbare'
    ],
    gesperrtTitel: 'Immer gesperrt (hartes Nein)',
    gesperrt: [
      'Git — Sicherungspunkte verwaltet FlowForge selbst',
      'FlowForge-Verwaltungsdateien (Karten, Workflow, Laufberichte) — Karten pflegt der Agent über die Karten-Werkzeuge',
      'Bei Blöcken mit Sperre „darf nur lesen": jede Veränderung'
    ],
    hinweisAutomodus:
      'Ob Rückfragen automatisch erlaubt werden (Automodus), stellst du oben rechts unter „Einstellungen" ein — das gilt für alle Projekte. Die harten Sperren gelten auch im Automodus.',
    kontingentHinweis:
      'Das Verhalten bei erschöpftem Abo-Kontingent und die Übertragsgrenze stellst du direkt im Schaubild-Tab über dem Schaubild ein.',
    schliessen: 'Schließen'
  },
  // Prüfmappen-Ansicht an der Prüferkarte (BAUPLAN 17): nur zum Nachlesen —
  // bearbeiten darf die Mappe weiterhin nur der Prüfer.
  pruefmappe: {
    titel: 'Prüfmappe',
    anzahl: (n) => (n === 1 ? '1 Prüfung' : `${n} Prüfungen`),
    leer: 'Die Prüfmappe ist leer. Der Prüfer legt hier während des Laufs seine Prüfungen fürs aktuelle Paket ab — beim Start des nächsten Laufs wird sie geleert.',
    hinweis:
      'Gezählt werden Prüf-Dateien, nicht einzelne Testfälle darin. Nur zum Nachlesen — bearbeiten darf die Mappe nur der Prüfer.',
    groesseBytes: (bytes) => `${bytes} Byte`,
    groesseKb: (kb) => `${kb} KB`
  },
  // Prüfkarten (SPEC §3.1/§4.3, BAUPLAN 18): gezielte Wiederholungsprüfung —
  // der Nutzer zieht Prüfkarten auf einen Prüf-Block, FlowForge legt deren
  // aufbewahrte Prüfdateien beim Laufstart in die Prüfmappe.
  pruefkarten: {
    anhangTitel: 'Prüfkarten für diesen Lauf',
    ziehHinweis:
      'Zieh eine Prüfkarte aus der Seitenleiste hierher — der Prüfer prüft sie dann beim nächsten Lauf zusätzlich.',
    entfernen: 'Von diesem Prüfer nehmen',
    nurPruefkarten:
      'Auf einen Prüfer lassen sich nur Prüfkarten ziehen (die grünen Häkchen-Karten legt FlowForge nach jeder bestandenen Prüfung an). Andere Karten ziehst du in die Kartenauswahl über dem Schaubild.',
    ersatzTitel: (zeit) => `Geprüft am ${zeit}`,
    ersatzText:
      'Diese Prüfung wurde bestanden. Einzelheiten stehen im Laufbericht dieses Laufs.'
  },
  laufberichte: {
    ueberschrift: 'Laufberichte',
    keine: 'Noch keine Laufberichte.',
    keineZumFilter: 'Kein Laufbericht mit diesem Ausgang.',
    filterAlle: 'Alle',
    dauerSekunden: (s) => `Dauer: ${s} Sekunden`,
    dauerMinuten: (m) => `Dauer: etwa ${m} ${m === 1 ? 'Minute' : 'Minuten'}`,
    blockErgebnisseLabel: 'Blöcke dieses Laufs',
    blockErgebnis: 'Letzter Lauf',
    blockZustaende: {
      erfolgreich: 'erledigt',
      fehlgeschlagen: 'fehlgeschlagen',
      'pruefung-bestanden': 'Prüfung bestanden',
      'pruefung-nicht-bestanden': 'Prüfung nicht bestanden',
      'startanleitung-fehlt': 'Startanleitung fehlte'
    },
    details: 'Einzelheiten',
    schliessen: 'Zuklappen',
    fehlertextLabel: 'Fehler',
    rechteFragenLabel: 'Rechte-Rückfragen',
    entscheidungenLabel: 'Folgen-Fragen',
    gespraechLabel: 'Gespräch',
    uebertraegeLabel: 'Überträge (Kontext war voll)',
    // Übertrags-Protokoll in Alltagssprache (BAUPLAN 11).
    uebertragZeile: (block, von, bis, nummer, grenze) =>
      `Der Kontext von „${block}" war zu etwa ${von}–${bis} % gefüllt. Der Agent hat den Zwischenstand notiert und übergeben; eine frische Session hat nahtlos weitergearbeitet (Übertrag ${nummer}${grenze != null ? ' von höchstens ' + grenze : ''}).`,
    uebertragOhneUebergabeZeile: (block) =>
      `Der Kontext von „${block}" war voll, aber die Übergabe ging verloren — die frische Session hat den Stand selbst aus Projektordner und Karten gelesen.`,
    fortgesetztHinweis: 'Dieser Lauf wurde nach einer Unterbrechung am letzten Sicherungspunkt fortgesetzt.',
    blockTokens: (tokens) => `Verbrauch: ${tokens.toLocaleString('de-DE')} Tokens`,
    // Lokale Helfer-KI (Wunsch Georg, 13.08.2026): ihr Anteil im Bericht.
    // Seit BAUPLAN 20 zählen auch die Vorreparatur-Versuche mit — samt der
    // Frage, wie viele davon die Nachprüfung bestanden haben.
    lokaleHelferZeile: (l) =>
      `Lokale Helfer-KI: ${l.recherchen} ${l.recherchen === 1 ? 'Recherche' : 'Recherchen'} · ` +
      `${l.schritte} ${l.schritte === 1 ? 'Schritt' : 'Schritte'} übernommen — ohne Kontingent` +
      (l.gescheitert > 0 ? ` (${l.gescheitert} davon gescheitert)` : '') +
      ((l.reparaturen ?? 0) > 0
        ? ` · ${l.reparaturen} Reparatur-${l.reparaturen === 1 ? 'Versuch' : 'Versuche'}, ${l.reparaturenGehalten ?? 0} ${(l.reparaturenGehalten ?? 0) === 1 ? 'hat' : 'haben'} gehalten`
        : '') +
      // Lokale Entwürfe (BAUPLAN 21): übernommen/verworfen ehrlich gezählt —
      // gescheiterte Entwurfs-Versuche extra, nicht bei den Recherchen.
      ((l.entwuerfe ?? 0) > 0
        ? ` · ${l.entwuerfe} ${l.entwuerfe === 1 ? 'Entwurf' : 'Entwürfe'} (${l.entwuerfeUebernommen ?? 0} übernommen, ${l.entwuerfeVerworfen ?? 0} verworfen${(l.entwuerfeGescheitert ?? 0) > 0 ? `, ${l.entwuerfeGescheitert} ${l.entwuerfeGescheitert === 1 ? 'Versuch' : 'Versuche'} gescheitert` : ''})`
        : (l.entwuerfeGescheitert ?? 0) > 0
          ? ` · ${l.entwuerfeGescheitert} Entwurfs-${l.entwuerfeGescheitert === 1 ? 'Versuch' : 'Versuche'} gescheitert`
          : '') +
      // Lokaler Bauer (BAUPLAN 22): lokal gehaltene und vom Agenten selbst
      // gebaute Teilstücke — daran sieht Georg, ob sich die Wette rechnet.
      ((l.teilstueckeGehalten ?? 0) + (l.teilstueckeVerworfen ?? 0) > 0 ||
      (l.teilstueckeGescheitert ?? 0) > 0
        ? ` · Teilstücke: ${l.teilstueckeGehalten ?? 0} lokal gebaut und gehalten, ${l.teilstueckeVerworfen ?? 0} hat der Agent selbst gebaut` +
          ((l.teilstueckeGescheitert ?? 0) > 0
            ? `, ${l.teilstueckeGescheitert} Bau-${l.teilstueckeGescheitert === 1 ? 'Versuch' : 'Versuche'} ohne Ergebnis`
            : '')
        : ''),
    // Token-Aufschlüsselung & theoretische API-Kosten (Wunsch Georg, 13.08.2026).
    aufschluesselungZeile: (a) =>
      `Eingabe ${a.eingabe.toLocaleString('de-DE')} · Ausgabe ${a.ausgabe.toLocaleString('de-DE')} · ` +
      `Cache gelesen ${a.cacheLesen.toLocaleString('de-DE')} · Cache geschrieben ${a.cacheSchreiben.toLocaleString('de-DE')}`,
    apiKosten: (usd) => `Theoretische API-Kosten: ${usd.toFixed(2).replace('.', ',')} $`,
    apiKostenAboZusatz: ' — bei dir im Abo enthalten, nur zur Einordnung',
    erlaubt: 'erlaubt',
    abgelehnt: 'abgelehnt',
    automatischErlaubt: 'automatisch erlaubt (Automodus)',
    verlaufLabel: 'Verlauf'
  }
}
