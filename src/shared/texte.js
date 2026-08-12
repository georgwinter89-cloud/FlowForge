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
    // Tabs der Mittelspalte (Feedback Georg, 07.08.2026): Schaubild, Lauf,
    // Berichte und Sicherungspunkte gestapelt wurden unübersichtlich.
    tabSchaubild: 'Schaubild',
    tabLauf: 'Lauf',
    tabBerichte: 'Laufberichte',
    tabPunkte: 'Sicherungspunkte',
    tabLaufLeer: 'Noch kein Lauf in dieser Sitzung. Starte den Workflow im Schaubild-Tab.',
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
  // Gespräch mit dem Agenten (BAUPLAN 9): Frage-Blöcke und das Spec-Interview
  // stellen Fragen über das mensch-Werkzeug — beantwortet wird hier.
  gespraech: {
    ueberschrift: 'Der Agent hat eine Frage an dich',
    verlaufUeberschrift: 'Gespräch',
    antwortPlatzhalter: 'Deine Antwort …',
    antworten: 'Antworten',
    freitextHinweis: 'Du kannst eine Option anklicken — oder frei antworten.'
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
    startanleitungNachforderung:
      '\n\nNachforderung von FlowForge: Dieser Auftrag ist schon umgesetzt, aber die ' +
      'Startanleitung des Projekts fehlt noch. Lege sie jetzt mit dem Werkzeug ' +
      'startanleitung_setzen an (beschreibung, dazu befehl und/oder adresse). ' +
      'Ändere sonst nichts am Projekt.',
    // Automatischer Übertrag (SPEC §5, BAUPLAN 11): Anweisung an den laufenden
    // Agenten, wenn sein Kontext fast voll ist …
    uebertragAnweisung: (nurLesen) =>
      'WICHTIG — Anweisung von FlowForge: Dein Kontextfenster ist fast voll. Beende die ' +
      'Arbeit JETZT sauber an dieser Stelle — fang nichts Neues mehr an. ' +
      (nurLesen
        ? ''
        : 'Aktualisiere zuerst über die karten-Werkzeuge die Status-Karte (wo genau stehst ' +
          'du, was ist der nächste Schritt) und lege für offen Gebliebenes kurze ' +
          'Aufgaben-Karten an. ') +
      'Schreibe dann als Abschlusstext eine Übergabe an deinen Nachfolger — er bekommt ' +
      'denselben Auftrag mit frischem Kontext und soll nahtlos weitermachen: ' +
      '1. Was ist schon erledigt (mit den betroffenen Dateien)? ' +
      '2. Was ist der nächste konkrete Schritt? ' +
      '3. Was muss er wissen, um ohne Neuanfang weiterzuarbeiten?',
    // … und die Übergabe an seinen Nachfolger in der frischen Session.
    uebertragFortsetzung: (uebergabe) =>
      '\n\nÜbergabe deines Vorgängers: Genau dieser Auftrag lief schon in einer früheren ' +
      'Session, deren Kontext voll wurde. Setze die Arbeit nahtlos fort — beginne NICHT ' +
      'von vorn und wiederhole keine erledigten Schritte. Die Übergabe:\n' + uebergabe,
    uebertragOhneUebergabe:
      '\n\nHinweis von FlowForge: Genau dieser Auftrag lief schon in einer früheren Session, ' +
      'deren Kontext voll wurde — eine Übergabe liegt leider nicht vor. Prüfe zuerst den ' +
      'Stand im Projektordner und an den Karten, und setze die Arbeit dann fort, ohne ' +
      'Erledigtes zu wiederholen.'
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
    rechteAutomatischErlaubt: (beschreibung) => `Automodus — automatisch erlaubt: ${beschreibung}`,
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
      `Wiederaufnahme am letzten Sicherungspunkt — weiter mit Block ${nummer} von ${gesamt}: „${name}".`
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
    fehlerWaehrendLauf: 'Während ein Workflow läuft, kann nichts wiederhergestellt werden.',
    fehlerWaehrendWarteschlange:
      'Dieses Projekt wartet in der Warteschlange auf einen Lauf — solange kann nichts wiederhergestellt werden.'
  },
  laufberichte: {
    ueberschrift: 'Laufberichte',
    keine: 'Noch keine Laufberichte.',
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
    erlaubt: 'erlaubt',
    abgelehnt: 'abgelehnt',
    automatischErlaubt: 'automatisch erlaubt (Automodus)',
    verlaufLabel: 'Verlauf'
  }
}
