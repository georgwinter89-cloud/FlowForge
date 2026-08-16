// Alle Oberflächen-Texte zentral an einem Ort (Deutsch; weitere Sprachen in V2).
export const texte = {
  fensterTitel: 'FlowForge',
  // Kopfleiste = Titelleiste der dunklen Werkbank (Mockup-Runden 3+4).
  kopfleiste: {
    werkbank: 'WERKBANK',
    zuProjekten: 'Projekte',
    // Metriken (BAUPLAN 31): Knopf in der Titelleiste → globale Seite.
    metrikenKnopf: 'Metriken',
    // Co-Pilot (BAUPLAN 33): Knopf in der Titelleiste → seitliches Chat-Fenster.
    chatKnopf: 'Co-Pilot'
  },
  // Metriken (BAUPLAN 31): lokale KI und Motor über alle Läufe hinweg — nur
  // Nachschlagewerk; nichts davon wandert je in einen Auftrag.
  metriken: {
    ueberschrift: 'Metriken',
    untertitel:
      'Was die lokale KI taugt und was der Motor kostet — über alle Läufe hinweg. Nur zum Nachschlagen; kein Agent bekommt diese Zahlen zu sehen.',
    aktualisieren: 'Aktualisieren',
    laedt: 'Metriken werden gelesen …',
    filterAlle: 'Alle Projekte',
    fehlendeProjekte: (pfade) =>
      `Nur bekannte Projekte: ${pfade.length} ${pfade.length === 1 ? 'Projekt fehlt' : 'Projekte fehlen'} (Ordner nicht gefunden) — ${pfade.join(' · ')}`,
    // Abschnitt 1: lokale KI.
    lokaleUeberschrift: 'Lokale KI',
    lokaleErklaerung:
      'Jedes Urteil über lokale Arbeit zählt: Recherche-Fazit übernommen oder verworfen, Entwurf übernommen oder verworfen, Reparatur gehalten oder nicht, Teilstück gehalten oder nicht — dazu Kreisläufe, die ohne Ergebnis gescheitert sind. Gezählt seit Bauschritt 31; ältere Läufe stehen hier nicht.',
    lokaleLeer: 'Noch keine Urteile — die lokale KI war seit Bauschritt 31 noch nicht im Einsatz.',
    lokaleLeerGefiltert: 'Für dieses Projekt gibt es noch keine Urteile über die lokale KI.',
    spalteModell: 'Modell',
    spalteBereich: 'Bereich',
    spalteAnzahl: 'Urteile',
    spalteQuote: 'Quote',
    spaltePositiv: 'übernommen / gehalten',
    spalteNegativ: 'verworfen / nicht gehalten',
    spalteGescheitert: 'gescheitert',
    spalteSchritte: 'Ø Schritte',
    spalteZeitraum: 'Zeitraum',
    bereiche: { recherche: 'Recherche', entwurf: 'Entwurf', reparatur: 'Reparatur', bauen: 'Bauen' },
    keineQuote: '—',
    quoteHinweis: 'Quote = Anteil übernommen/gehalten an allen beurteilten (gescheiterte Kreisläufe zählen nicht mit).',
    // Abschnitt 2: Motor.
    motorUeberschrift: 'Motor',
    motorErklaerung:
      'Aus den Laufberichten aller bekannten Projekte — die Zahlen liegen dort exakt vor, auch für alte Läufe. Kosten sind theoretische API-Kosten; im Abo-Modus nur zur Einordnung.',
    motorLeer: 'Noch keine Laufberichte.',
    gesamtZeile: (g) =>
      `${g.anzahl} ${g.anzahl === 1 ? 'Lauf' : 'Läufe'} · ${g.tokens.toLocaleString('de-DE')} Tokens` +
      (g.mitKosten > 0 ? ` · ${g.kostenUsd.toFixed(2).replace('.', ',')} $ theoretische Kosten` : '') +
      (g.ohneKosten > 0 ? ` (${g.ohneKosten} ${g.ohneKosten === 1 ? 'Lauf' : 'Läufe'} ohne Kostenangabe)` : ''),
    ohneKosten: 'ohne Kosten',
    ohneVerbrauch: 'ohne Verbrauch',
    ohneAngabe: (n, was) => `${n} ${was}`,
    jeBlockUeberschrift: 'Je Blocktyp',
    jeBlockErklaerung:
      'Erstlauf = der erste Anlauf eines Blocks im Lauf. Wiederholungen (Reparatur-Runden, Nachprüfungen, Nachforderungen) stehen getrennt — sonst verzerren sie den Durchschnitt.',
    spalteBlock: 'Block',
    spalteErstlaeufe: 'Erstläufe',
    spalteTokensDurchschnitt: 'Ø Tokens',
    spalteKostenDurchschnitt: 'Ø Kosten',
    spalteWiederholungen: 'Wiederholungen',
    jeKetteUeberschrift: 'Je Workflow-Kette',
    spalteKette: 'Kette',
    spalteLaeufe: 'Läufe',
    spalteTokensGesamt: 'Tokens gesamt',
    spalteKostenGesamt: 'Kosten gesamt',
    jeProjektUeberschrift: 'Je Projekt',
    spalteProjekt: 'Projekt',
    jeWocheUeberschrift: 'Zeitverlauf je Woche',
    jeWocheErklaerung: 'Wird es billiger? Tokens je Kalenderwoche als Balken; darunter Läufe und Kosten.',
    wocheLabel: (nummer, von, bis) => `KW ${nummer} (${von}–${bis})`,
    wocheZeile: (w) =>
      `${w.anzahl} ${w.anzahl === 1 ? 'Lauf' : 'Läufe'} · ${w.tokens.toLocaleString('de-DE')} Tokens` +
      (w.mitKosten > 0 ? ` · ${w.kostenUsd.toFixed(2).replace('.', ',')} $` : '') +
      (w.ohneKosten > 0 ? ` (${w.ohneKosten} ohne Kosten)` : ''),
    sonderlaufMarke: 'Sonderlauf',
    // Harness-Kennzahlen (BAUPLAN 36): Wie gut trägt das Gerüst? Score UND
    // Kosten messen. Alles rückwirkend aus den Laufberichten gerechnet.
    harnessUeberschrift: 'Wie gut trägt das Gerüst',
    harnessErklaerung:
      'Nicht was es kostet, sondern was es taugt: Wie oft besteht der Prüfer beim ersten Mal, wie viele Reparatur-Runden braucht ein Lauf, wie oft muss FlowForge dich fragen. Aus denselben Laufberichten wie oben — auch rückwirkend.',
    harnessErstbestehen: 'Prüfer besteht beim ersten Mal',
    harnessErstbestehenHinweis: (mit, gesamt) =>
      `Anteil der Läufe, in denen jede Prüfung ihr erstes Urteil bestanden hat — gezählt über ${mit} von ${gesamt} ${gesamt === 1 ? 'Lauf' : 'Läufen'} mit Prüfung.`,
    harnessReparatur: 'Ø Reparatur-Runden je Lauf',
    harnessReparaturHinweis:
      'Gezählt als Prüf-Urteile „nicht bestanden" — jedes schickt den Lauf zurück zum Bauer oder löst die Folgen-Frage aus.',
    harnessRechte: 'Ø Rechte-Rückfragen je Lauf',
    harnessFolgen: 'Ø Folgen-Fragen je Lauf',
    harnessUebertraege: 'Ø Überträge je Lauf',
    harnessZusammenfassungen: 'Ø Zusammenfassungen je Lauf',
    harnessZusammenfassungenHinweis: (ohne) =>
      ohne > 0
        ? `Der Motor dampft sein Arbeitsgedächtnis selbst ein — erst seit Bauschritt 36 im Bericht; ${ohne} ältere ${ohne === 1 ? 'Lauf zählt' : 'Läufe zählen'} nicht mit.`
        : 'Der Motor dampft sein Arbeitsgedächtnis selbst ein — gezählt seit Bauschritt 36.',
    harnessJeKetteUeberschrift: 'Je Kette',
    harnessJeWocheUeberschrift: 'Je Kalenderwoche',
    spalteErstbestehen: 'Erstbestehen',
    spalteWoche: 'Woche',
    spalteReparaturRunden: 'Ø Reparatur-Runden',
    spalteFragen: 'Ø Fragen an dich',
    spalteAusgang: 'Ausgang',
    ausgangZeile: (ausgaenge, label) =>
      ausgaenge.length === 0 ? '—' : ausgaenge.map((a) => `${label(a.zustand)} ${a.anzahl}`).join(' · '),
    // Modell je Block (BAUPLAN 36).
    jeModellUeberschrift: 'Je Blocktyp × Modell',
    jeModellErklaerung:
      'Welches Modell hat den Block wirklich gearbeitet — und schafft es die Arbeit? Wiederholungen und Erstbestehen sind das „schafft es"-Signal. Läufe vor Bauschritt 36 (und Prüf-Runden, die FlowForge ohne Motor entschieden hat) stehen ehrlich als „ohne Modell".',
    keinModellHinweis: 'ohne Modell',
    // Compaction sichtbar (BAUPLAN 36).
    zusammenfassungenLabel: 'Zusammenfassungen des Motors'
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
    // Metriken (BAUPLAN 31): dieselbe Seite wie in der Titelleiste, aufs Projekt vorgefiltert.
    tabMetriken: 'Metriken',
    // App-Tab (BAUPLAN 32): die Startanleitung läuft in FlowForge.
    tabApp: 'App',
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
    uebungsbloeckeTitel: 'Übungs-Blöcke',
    // Klappen der Blockbibliothek (BAUPLAN 30): Anzeigenamen der festen
    // Bereiche aus blockKatalog.BEREICHE plus „Eigene" und „Übung".
    bereiche: {
      auftrag: 'Auftrag finden',
      bauen: 'Bauen',
      pruefen: 'Prüfen',
      gedaechtnis: 'Gedächtnis',
      eigene: 'Eigene',
      uebung: 'Übung'
    }
  },
  // Block-Editor mit KI-Assistent (SPEC §4.5, BAUPLAN 14).
  blockEditor: {
    neuerBlock: 'Neuer Block',
    ueberschriftNeu: 'Eigenen Block erstellen',
    ueberschriftBearbeiten: 'Block bearbeiten',
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
      'Der Block darf dann nichts verändern: kein Schreiben, keine verändernden Befehle (rein lesende laufen durch), kein Internet — nur lesen. Die sichere Wahl für alles, was nur ansehen und berichten soll. Nur-lesende Blöcke dürfen außerdem parallel zu einem schreibenden laufen.',
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
      'Die KI hat kein brauchbares Formular geliefert. Versuch es noch einmal — oder füll die Felder von Hand aus.',
    // Kategorie / Bereich des Blocks (BAUPLAN 30): Klappe in der Bibliothek.
    bereichFeld: 'Kategorie in der Bibliothek',
    bereichPlatzhalter: 'z.B. Prüfen — oder eine neue Kategorie eintippen',
    bereichHinweis:
      'Unter dieser Klappe liegt der Block in der Bibliothek. Wähle eine vorhandene Kategorie oder tipp eine neue ein — leer heißt „Eigene".',
    bereichVorschau: (name) => `Kategorie: ${name}`
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
    zuVieleEtiketten: (label, max) => `Höchstens ${max} Etiketten bei „${label}".`,
    bereichZuLang: (max) => `Der Kategorie-Name ist zu lang (höchstens ${max} Zeichen).`
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
    // Sicht-Hilfen am Schaubild (BAUPLAN 36): Woher kommt, was der Block
    // braucht — und was fehlt.
    kommtVon: (namen) => `← ${namen.join(' + ')}`,
    fehltMarke: '← fehlt',
    kommtNichtAn: '← liefert keiner',
    rueckpfeilLabel: (runden) =>
      `bei Fehlschlag, ${runden} ${runden === 1 ? 'Runde' : 'Runden'}`,
    rueckpfeilOhneRunden: 'bei Fehlschlag: keine Runde — es folgt sofort die Folgen-Frage',
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
    keineKarten: 'Keine Karten in dieser Ansicht.',
    // Themen & Gruppen (BAUPLAN 30).
    themaMarke: (thema) => `Thema: ${thema}`,
    gruppen: {
      arbeit: 'Arbeit',
      wissen: 'Wissen',
      geprueft: 'Geprüft',
      erledigt: 'Erledigt'
    },
    sonstiges: 'Sonstiges',
    themaUmbenennen: 'Thema umbenennen',
    themaUmbenennenFrage: (thema) =>
      `Neuer Name für das Thema „${thema}" — alle seine Karten wandern mit. Ein vorhandener Name legt die Themen zusammen.`,
    themaUmbenennenKnopf: 'Umbenennen',
    themaZielHinweis: 'Karte hierher ziehen, um sie in dieses Thema zu verschieben.',
    // Aufräum-Knöpfe (Entscheidung Georg, 15.08.2026): Sonderläufe aus der
    // Karten-Seitenleiste — Lauf-Tab, Ticker und Abnahme wie bei jedem Lauf,
    // die Leinwand bleibt unangetastet.
    aufraeumenTitel: 'Aufräumen',
    kartenPruefenKnopf: 'Karten am Code prüfen',
    kartenPruefenHinweis:
      'Startet den Karten-Prüfer als Sonderlauf im Hintergrund: Er misst am Code nach, ob die Karten noch wahr sind, und schlägt Korrekturen vor — du entscheidest jede einzeln im Lauf-Tab. Die Leinwand bleibt unverändert.',
    themenSortierenKnopf: 'Themen sortieren',
    themenSortierenHinweis:
      'Startet einen Sonderlauf, der alle Karten ohne oder mit offensichtlich falschem Thema einsortiert — ohne Code-Nachmessen. Du bekommst EINE Tabelle mit Vorschlägen im Lauf-Tab: je Zeile änderbar, „Alle übernehmen" oder einzeln ablehnen.',
    sonderlaufGesperrt: 'Solange in diesem Projekt ein Lauf läuft oder wartet, ist Aufräumen gesperrt.',
    // Herkunft je Karte (BAUPLAN 30): kompakte Kopfzeile unter dem Titel.
    herkunft: {
      angelegt: 'angelegt',
      geaendert: 'zuletzt geändert',
      vonDir: 'von dir',
      vomChat: 'vom Chat',
      vomKartenPruefer: 'vom Karten-Prüfer',
      vonFlowForge: 'von FlowForge',
      vonBlock: (block) => `von ${block}`,
      bei: (aufgaben) => `bei „${aufgaben.join('“, „')}"`,
      lauf: (zeit) => `Lauf ${zeit}`,
      zumBericht: 'Zum Laufbericht springen',
      geradeEben: 'gerade eben',
      vorMinuten: (n) => `vor ${n} Min.`,
      vorStunden: (n) => `vor ${n} Std.`,
      vorTagen: (n) => `vor ${n} Tag${n === 1 ? '' : 'en'}`
    }
  },
  kartenFormular: {
    ueberschriftNeu: 'Neue Karte',
    ueberschriftBearbeiten: 'Karte bearbeiten',
    sorteFeld: 'Sorte',
    titelFeld: 'Titel',
    textFeld: 'Inhalt',
    // Themen (BAUPLAN 30).
    themaFeld: 'Thema (Pflicht)',
    themaFeldOptional: 'Thema (optional — alte Karte ohne Thema)',
    themaPlatzhalter: 'z.B. Login, Datenbank, Oberfläche',
    themaHinweis: (themen) => `Vorhandene Themen: ${themen.join(', ')} — ein neues nur, wenn keins passt.`,
    themaHinweisLeer: 'Ein kurzes Schlagwort, unter dem die Karte in der Seitenleiste einsortiert wird.',
    zeichenUebrig: (n) => `noch ${n} Zeichen`,
    zeichenZuViel: (n) => `${n} Zeichen zu viel`,
    speichern: 'Speichern',
    abbrechen: 'Abbrechen'
  },
  kartenRegeln: {
    titelFehlt: 'Bitte gib der Karte einen Titel.',
    titelZuLang: (max, ist) =>
      `Der Titel ist zu lang: ${ist} von höchstens ${max} Zeichen.`,
    textFehlt: 'Bitte schreib etwas in die Karte.',
    // Mit Ist-Länge (Befund 14.08.2026): Ohne die Zahl kürzte der Agent
    // blind und lief mehrfach in dieselbe Ablehnung.
    textZuLang: (max, ist) =>
      `Der Inhalt ist zu lang: ${ist} von höchstens ${max} Zeichen — kürze um ` +
      `mindestens ${ist - max} Zeichen oder teile den Inhalt auf mehrere fokussierte Karten auf.`,
    statusUnantastbar: 'Die Status-Karte gibt es genau einmal — sie kann nicht gelöscht oder neu angelegt werden.',
    nurAufgabenErledigbar: 'Nur Aufgaben-Karten können erledigt werden.',
    // Prüfkarten (BAUPLAN 18): legt und pflegt ausschließlich FlowForge.
    pruefkarteNurFlowForge:
      'Prüfkarten legt FlowForge selbst an — automatisch nach jeder bestandenen Prüfung. Sie lassen sich nicht anlegen oder über die Karten-Werkzeuge ändern.',
    // Themen (BAUPLAN 30): Pflicht beim Anlegen — die Ablehnung nennt die
    // vorhandenen Themen, damit auch ein Agent, der nichts vom Thema weiß,
    // sofort einsortieren kann (Rettungsanker, kein Block darf daran scheitern).
    themaFehlt: (vorhanden) =>
      'Bitte gib der Karte ein Thema (ein kurzes Schlagwort, unter dem sie einsortiert wird). ' +
      (vorhanden.length
        ? `Vorhandene Themen: ${vorhanden.join(', ')} — nimm eins davon; ein neues Thema nur, wenn keines passt.`
        : 'Es gibt noch keine Themen — wähle ein passendes Schlagwort.'),
    themaZuLang: (max, ist) =>
      `Das Thema ist zu lang: ${ist} von höchstens ${max} Zeichen — ein Schlagwort, kein Satz.`,
    keinThemaFuerSorte: 'Status- und Prüfkarten tragen kein Thema.'
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
    entfernen: 'Aus der Auswahl nehmen',
    // Alle Karten laden (BAUPLAN 29): ein Knopf lädt alles Wissenswerte in
    // die Auswahl — Paket schneiden teilt dann zu, wer was bekommt.
    alleHinzufuegen: 'Alle Karten hinzufügen',
    alleHinzufuegenHinweis:
      'Lädt Status-Karte, alle Entscheidungs- und Wissens-Karten und alle offenen Aufgaben in die Auswahl. Erledigte Aufgaben und Prüfkarten bleiben draußen. Paket schneiden bzw. Diagnose teilt den Folgeblöcken dann nur die Karten zu, die sie wirklich brauchen.',
    standardAuswahl: 'Standard-Auswahl',
    standardAuswahlHinweis:
      'Springt zurück auf die übliche Vorauswahl: Status-Karte und offene Aufgaben.',
    // Prüfkarten per Drag & Drop (BAUPLAN 30, Kleinkram): freundlich abgelehnt.
    pruefkarteAbgelehnt:
      'Prüfkarten gehören nicht in die Kartenauswahl — zieh sie stattdessen auf einen Prüfer-Block im Schaubild, dann führt er die aufbewahrte Prüfung erneut aus.'
  },
  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): die Vorschlags-Zeile an
  // der Kartenauswahl im Schaubild-Tab — eine Einladung, kein neuer Standard.
  laufVorschlag: {
    ueberschrift: 'Aus dem letzten Lauf empfohlen',
    hinweis:
      'Das Sessionende des letzten Laufs schlägt diese Karten für den nächsten Lauf vor. „Übernehmen" stellt die Kartenauswahl genau darauf um — danach wie gewohnt änderbar. Du kannst den Vorschlag auch verwerfen oder einfach ignorieren.',
    uebernehmen: 'Übernehmen',
    verwerfen: 'Verwerfen',
    ohneKarten: 'ohne Karten'
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
  // Karten-Vorschläge (BAUPLAN 26): der Abnahme-Dialog des Karten-Prüfers —
  // du entscheidest je Karte: übernehmen, Vorschlag bearbeiten, ablehnen.
  vorschlag: {
    ueberschrift: 'Der Karten-Prüfer schlägt eine Änderung vor',
    artLabels: {
      aktualisieren: 'Karte aktualisieren',
      erledigen: 'Aufgabe abhaken',
      oeffnen: 'Aufgabe wieder öffnen',
      anlegen: 'Neue Aufgaben-Karte anlegen',
      loeschen: 'Karte löschen',
      thema: 'Themen sortieren'
    },
    // Sammel-Dialog „Themen sortieren" (BAUPLAN 30).
    themenAnzahl: (n) => `${n} Karte${n === 1 ? '' : 'n'}`,
    themenUeberschrift: 'Der Sortierer schlägt Themen vor',
    themenHinweis:
      'Je Zeile kannst du das Thema ändern oder die Zeile ablehnen. „Alle übernehmen" setzt alle nicht abgelehnten Themen auf einmal — nur das Thema ändert sich, kein Kartentext.',
    themenSpalteKarte: 'Karte',
    themenSpalteBisher: 'bisher',
    themenSpalteNeu: 'Thema',
    themenAblehnenZeile: 'ablehnen',
    themenAlleUebernehmen: 'Alle übernehmen',
    themenAlleAblehnen: 'Alle ablehnen',
    themenKeins: '—',
    themaFeld: 'Thema',
    bisher: 'So steht es auf der Karte:',
    neu: 'Vorschlag:',
    begruendungLabel: 'Begründung:',
    loeschenHinweis: 'Die Karte würde ersatzlos gelöscht.',
    erledigenHinweis: 'Die Aufgabe würde als erledigt abgehakt.',
    oeffnenHinweis: 'Die Aufgabe würde wieder als offen markiert.',
    uebernehmen: 'Übernehmen',
    bearbeiten: 'Vorschlag bearbeiten',
    ablehnen: 'Ablehnen',
    soUebernehmen: 'So übernehmen',
    zurueck: 'Zurück',
    titelFeld: 'Titel',
    textFeld: 'Inhalt'
  },
  // Co-Pilot (BAUPLAN 33, vorher Nachlauf-Chat BAUPLAN 27): EIN Chat für
  // Bedienung und Projekt — im Projekt hängt er an der Lauf-Session, in der
  // Übersicht beantwortet er Bedienfragen. Standard nur-lesend (Karten
  // anlegen erlaubt), auf Zuruf „Chat darf reparieren".
  chat: {
    titel: 'Co-Pilot',
    untertitelProjekt: (name) => `Projekt „${name}"`,
    untertitelUebersicht: 'Bedienung von FlowForge',
    einleitung:
      'Frag zum Projekt oder zur Bedienung von FlowForge — der Co-Pilot kennt die Karten, Laufberichte, die Startanleitung und die App-Ausgabe; nach einem Lauf kennt er auch dessen Blöcke, Fazite und Verlauf. Auf „leg das als Aufgabe an" legt er eine Karte an; der nächste Bau-Lauf arbeitet sie mit Sicherungspunkt und Prüfer ab.',
    einleitungUebersicht:
      'Frag, wie etwas in FlowForge geht — der Co-Pilot schlägt in der Produktbeschreibung nach. Für Fragen zu einem Projekt öffne das Projekt und frag dort.',
    eingabePlatzhalter: 'Deine Frage … (Strg+V fügt einen Screenshot ein)',
    senden: 'Senden',
    stoppen: 'Antwort abbrechen',
    schliessen: 'Chat schließen',
    neuesGespraech: 'Neues Gespräch',
    neuesGespraechHinweis:
      'Leert den Verlauf und verwirft die Session — die nächste Frage startet frisch (im Projekt wieder an der jüngsten Lauf-Session).',
    neuesGespraechFrage:
      'Neues Gespräch beginnen? Der bisherige Verlauf wird geleert und die KI vergisst ihn — die nächste Frage startet frisch.',
    beschaeftigt: 'Der Chat arbeitet …',
    arbeitetSchritt: (text) => `Der Chat arbeitet … ${text}`,
    laufAktivHinweis:
      'Im Projekt läuft (oder wartet) gerade ein Lauf — der Chat ist so lange nur lesend: Bedienfragen und „was macht der Bauer gerade" gehen, Reparieren ist gesperrt.',
    reparierenLabel: 'Chat darf reparieren',
    reparierenHinweis:
      'Angeschaltet schreibt der Chat wie ein Bauer und führt Befehle für dich aus (z.B. npm install): Vor der ersten Änderung entsteht ein Sicherungspunkt; Git, Prüfmappe und Verwaltungsdateien bleiben tabu. Ausgeschaltet liest er nur und darf Karten anlegen.',
    reparierenAn: 'Chat darf jetzt reparieren — vor der ersten Änderung entsteht ein Sicherungspunkt.',
    reparierenAus: 'Chat ist wieder nur-lesend (Karten anlegen bleibt erlaubt).',
    reparierenWaehrendLauf:
      'Solange in diesem Projekt ein Lauf läuft oder wartet, darf der Chat nicht reparieren — pro Projekt schreibt nur ein Agent.',
    reparierenUebersicht: 'In der Projektübersicht gibt es nichts zu reparieren — öffne dafür ein Projekt.',
    // Marke im Verlauf (Entscheidung Georg): Nach jedem Lauf hängt der Chat an
    // der neuen Lauf-Session — der ältere Teil bleibt zum Nachlesen, die KI
    // kennt ihn nicht mehr.
    marke: (datum, zeit) => `ab hier: neue Lauf-Session vom ${datum}, ${zeit}`,
    markeOhneZeit: 'ab hier: neue Lauf-Session',
    markeHinweis: 'Was darüber steht, kennt die KI nicht mehr — es bleibt zum Nachlesen.',
    bildKnopf: 'Bild anhängen',
    bildEntfernen: 'Bild entfernen',
    bildMarker: (n) => (n === 1 ? '[1 Bild angehängt]' : `[${n} Bilder angehängt]`),
    bildZuGross: 'Das Bild ist zu groß (höchstens 5 MB) — bitte kleiner zuschneiden.',
    bildZuViele: 'Höchstens 4 Bilder je Nachricht.',
    bildFormat: 'Dieses Dateiformat kann der Motor nicht lesen — nutze PNG, JPEG, GIF oder WebP.',
    // Ehrlichkeit: Woher der Chat seinen Kontext hat, steht sichtbar im Verlauf.
    hinweisFortgesetzt:
      'Dieser Chat setzt die Lauf-Session fort — der Agent kennt Blöcke, Fazite und Verlauf des Laufs.',
    hinweisFrisch:
      'Die Lauf-Session ist nicht mehr nutzbar (weg oder Kontext zu voll) — dieser Chat ist eine frische Session mit dem Laufbericht als Kontext.',
    hinweisFortsetzungGescheitert:
      'Die Lauf-Session ließ sich nicht fortsetzen — der Chat läuft jetzt als frische Session mit dem Laufbericht als Kontext.',
    hinweisChatSessionWeg:
      'Die vorige Chat-Session ließ sich nicht fortsetzen — die KI kennt den älteren Verlauf nicht mehr (er bleibt hier zum Nachlesen).',
    hinweisOhneLauf:
      'Noch kein Lauf in diesem Projekt — dieser Chat ist eine frische Session mit Projekt- und FlowForge-Wissen (Karten, Dateien, Startanleitung, Produktbeschreibung).',
    hinweisUebersicht:
      'Kein Projekt offen — der Co-Pilot beantwortet hier nur Bedienfragen zu FlowForge (aus der Produktbeschreibung). Der Datenordner ist für ihn gesperrt.',
    verbrauchHinweis: 'Chat-Nachrichten kosten Kontingent.',
    fehlerLaufWaehrendChat:
      'Der Chat arbeitet gerade in diesem Projekt — warte, bis seine Antwort da ist (oder brich sie ab), bevor du einen Lauf startest.',
    antwortAbgebrochen: 'Antwort abgebrochen.',
    denkAbsender: 'Chat'
  },
  benachrichtigung: {
    frageTitel: 'FlowForge — der Agent hat eine Frage',
    vorschlagTitel: 'FlowForge — ein Karten-Vorschlag wartet auf dich',
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
  // Karten-Vorschläge (BAUPLAN 26): Texte an den Karten-Prüfer-Agenten.
  agentenVorschlag: {
    werkzeugBeschreibung:
      'Schlägt dem Nutzer eine Karten-Korrektur vor und wartet auf seine Entscheidung ' +
      '(übernehmen, bearbeiten, ablehnen) — FlowForge wendet sie an, du änderst nie ' +
      'selbst. Ein Vorschlag pro Aufruf, jeder mit Begründung und Beleg aus dem Code.',
    serverHinweis:
      'Mit karte_vorschlagen schlägst du dem Nutzer Karten-Korrekturen vor — er ' +
      'entscheidet jede einzeln, FlowForge wendet sie an. Karten änderst du nie direkt.',
    unbekannteId: (id) =>
      `Keine Karte mit der id ${id} — hol dir die ids mit karten_uebersicht.`,
    pruefkarteTabu:
      'Prüfkarten pflegt FlowForge selbst — zu ihnen gibt es keine Vorschläge. Erwähne ' +
      'Auffälliges stattdessen in deinem Kartenbericht.',
    entscheidungTabu:
      'Entscheidungs-Karten sind Festlegungen des Nutzers — sie werden nie umformuliert ' +
      'oder gelöscht. Widerspricht der Code der Festlegung, schlage stattdessen mit ' +
      'art "anlegen" eine Aufgaben-Karte vor, die den Widerspruch benennt.',
    statusNurAktualisierbar:
      'Die Status-Karte wird nie gelöscht — sie ist nur aktualisierbar. Ist ihr Inhalt ' +
      'veraltet, schlage mit art "aktualisieren" einen neuen Inhalt vor (ihr Titel bleibt fest).',
    felderUngueltig: (titelMax, textMax) =>
      `Abgelehnt: titel (höchstens ${titelMax} Zeichen) und text (höchstens ${textMax} ` +
      'Zeichen) müssen beide gefüllt sein. Bei der Status-Karte zählt nur der text — ' +
      'ihr Titel bleibt fest.',
    nichtsGeaendert:
      'Abgelehnt: Der Vorschlag ist wortgleich mit der Karte — nichts zu korrigieren.',
    nurAufgaben: 'Abhaken und Wiederöffnen gibt es nur bei Aufgaben-Karten.',
    schonErledigt: 'Diese Aufgabe ist schon abgehakt.',
    schonOffen: 'Diese Aufgabe ist schon offen.',
    keineAntwort:
      'Der Lauf wurde angehalten — dieser Vorschlag wird nicht mehr entschieden. ' +
      'Beende deinen Auftrag ohne weitere Vorschläge.',
    abgelehnt:
      'Der Nutzer hat den Vorschlag ABGELEHNT — die Karte bleibt unverändert. Vermerke ' +
      'das in deinem Kartenbericht und mach mit der nächsten Karte weiter.',
    uebernommen: 'Der Nutzer hat den Vorschlag übernommen — FlowForge hat ihn angewendet.',
    bearbeitetUebernommen: (titel, text) =>
      'Der Nutzer hat den Vorschlag BEARBEITET übernommen. Angewendet wurde seine ' +
      `Fassung — Titel: „${titel ?? ''}", Inhalt: „${text ?? ''}". Diese Fassung gilt; ` +
      'vermerke sie in deinem Kartenbericht.',
    // Sammelform „thema" (BAUPLAN 30).
    themenLeer: 'Abgelehnt: Bei art "thema" muss das Feld themen mindestens einen Eintrag enthalten.',
    themaDoppelt: (id) => `Abgelehnt: Die Karte ${id} kommt in themen mehrfach vor.`,
    themaFalscheSorte: (titel) =>
      `Abgelehnt: „${titel}" ist eine Status- oder Prüfkarte — die tragen kein Thema.`,
    themaLeer: (titel) => `Abgelehnt: Für „${titel}" fehlt das Thema.`,
    themaGleich: (titel) =>
      `Abgelehnt: „${titel}" trägt dieses Thema schon — lass die Karte weg.`,
    themenErgebnis: (uebernommen, abgelehnt) =>
      `Der Nutzer hat entschieden: ${uebernommen} Thema-Vorschlag${uebernommen === 1 ? '' : 'e'} ` +
      `übernommen (ggf. mit seinen Änderungen), ${abgelehnt} abgelehnt. FlowForge hat die ` +
      'übernommenen angewendet — vermerke das in deinem Kartenbericht.'
  },
  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): Texte an den
  // Sessionende-Agenten für naechster_lauf_vorschlagen.
  agentenLaufVorschlag: {
    werkzeugBeschreibung:
      'Schlägt die Kartenauswahl für den NÄCHSTEN Lauf vor: Karten-IDs plus ein Satz ' +
      'Empfehlung in Alltagssprache, was als Nächstes ansteht. FlowForge speichert das ' +
      'nur als Vorschlag — der Nutzer entscheidet selbst; nichts wird umgebaut oder gestartet.',
    serverHinweis:
      'Mit naechster_lauf_vorschlagen deckst du den Tisch für den nächsten Lauf — ein ' +
      'Vorschlag an den Nutzer, keine Automatik. Ein erneuter Aufruf ersetzt den alten Vorschlag.',
    unbekannteIds: (ids) =>
      `Keine Karte(n) mit diesen ids: ${ids} — nimm nur ids aus karten_uebersicht.`,
    pruefkartenTabu:
      'Prüfkarten gehören nicht in die Kartenauswahl — sie haben ihren eigenen Weg über ' +
      'den Prüfer. Lass sie aus dem Vorschlag weg.',
    empfehlungUngueltig: (max) =>
      `Abgelehnt: empfehlung muss gefüllt sein — ein Satz in Alltagssprache, höchstens ${max} Zeichen.`,
    gespeichert: (anzahl) =>
      `Vorschlag gespeichert (${anzahl} Karte${anzahl === 1 ? '' : 'n'}). Der Nutzer sieht ` +
      'ihn an der Kartenauswahl und entscheidet selbst — ein erneuter Aufruf ersetzt ihn.'
  },
  // Karten-Zuteilung (BAUPLAN 29): Texte an die Auftragsquellen-Agenten
  // (Paket schneiden, Diagnose) für karten_zuteilen.
  agentenKartenZuteilung: {
    werkzeugBeschreibung:
      'Teilt den nachfolgenden Blöcken dieses Laufs die Karten zu, die sie wirklich ' +
      'brauchen — je Eintrag ein Blockname und die Karten-IDs aus der Kartenauswahl. ' +
      'Nicht genannte Blöcke bekommen wie bisher die volle Kartenauswahl; die ' +
      'Status-Karte ist immer dabei.',
    serverHinweis:
      'Mit karten_zuteilen bekommt jeder nachfolgende Block nur die Karten in den ' +
      'Auftrag, die er wirklich braucht — Kontext ist der teuerste Teil des Laufs. ' +
      'Ein erneuter Aufruf ersetzt die Zuteilung der erneut genannten Blöcke.',
    auftragZusatz: (namen) =>
      '\nZum Schluss: Teil mit dem Werkzeug karten_zuteilen den nachfolgenden Blöcken ' +
      'dieses Laufs die Karten aus der Kartenauswahl zu, die sie für ihre Arbeit ' +
      'wirklich brauchen (je Eintrag: block = Blockname, kartenIds = ids aus der ' +
      'Kartenauswahl oben). Die nachfolgenden Blöcke sind: ' +
      namen.join(', ') +
      '. Sei sparsam — Kontext ist der teuerste Teil des Laufs: Jeder Block bekommt ' +
      'nur, was er wirklich braucht (die Status-Karte ist immer dabei; eine leere ' +
      'Liste heißt „nur die Status-Karte"). Blöcke, die du nicht nennst, bekommen ' +
      'wie bisher die volle Auswahl.',
    leereZuteilung:
      'Abgelehnt: zuteilung muss mindestens einen Eintrag mit Blockname enthalten.',
    keineNachfolger:
      'Dieser Block hat keine nachfolgenden Blöcke im Schaubild — es gibt nichts zuzuteilen.',
    unbekannteBloecke: (namen, gueltig) =>
      `Keine nachfolgenden Blöcke mit diesen Namen: ${namen}. ` +
      `Zuteilen kannst du an: ${gueltig}.`,
    fremdeKarten: (ids) =>
      `Diese Karten gehören nicht zur Kartenauswahl dieses Laufs: ${ids} — ` +
      'zuteilen kannst du nur Karten aus der Kartenauswahl in deinem Auftrag.',
    gespeichert: (zeilen) =>
      `Zuteilung gespeichert: ${zeilen}. Nicht genannte Blöcke bekommen die volle Auswahl.`
  },
  // Paket melden (BAUPLAN 30, Herkunft): Die Auftragsquellen-Blöcke melden,
  // an welchen Aufgaben-Karten der Lauf arbeitet — FlowForge stempelt damit
  // jede Karte, die im Lauf entsteht oder sich ändert.
  agentenPaket: {
    werkzeugBeschreibung:
      'Meldet FlowForge, welche offenen Aufgaben-Karten dieses Arbeitspaket bearbeitet ' +
      '(ids aus der Kartenauswahl). FlowForge vermerkt damit an jeder Karte, die in diesem ' +
      'Lauf entsteht oder sich ändert, bei welcher Aufgabe das geschah. Leer, wenn der ' +
      'Auftrag allein aus dem Wunsch- bzw. Fehlerbild-Feld kam.',
    serverHinweis:
      'Mit paket_melden benennst du die Aufgaben-Karten deines Pakets — ein erneuter Aufruf ersetzt die Meldung.',
    auftragZusatz:
      '\nSobald feststeht, welche Aufgaben-Karte(n) das Paket bearbeitet, melde sie mit dem ' +
      'Werkzeug paket_melden (aufgabenIds = ids der offenen Aufgaben-Karten aus der ' +
      'Kartenauswahl oben; leer, wenn dein Auftrag allein aus dem Feld kam). FlowForge ' +
      'vermerkt damit an jeder Karte, die dieser Lauf anlegt oder ändert, aus welcher ' +
      'Aufgabe sie entstand.',
    leerOhneFeld:
      'Abgelehnt: aufgabenIds ist leer, aber das Wunsch-/Fehlerbild-Feld dieses Blocks ist ' +
      'auch leer — die offenen Aufgaben-Karten der Kartenauswahl sind dein Auftrag; nenne die, ' +
      'die du dir vornimmst.',
    unbekannteId: (id) => `Keine Karte mit der id ${id} — nimm nur ids aus der Kartenauswahl.`,
    keineOffeneAufgabe: (titel) => `„${titel}" ist keine offene Aufgaben-Karte.`,
    nichtInAuswahl: (titel) => `„${titel}" gehört nicht zur Kartenauswahl dieses Laufs.`,
    gemeldet: (anzahl) =>
      anzahl === 0
        ? 'Gemeldet: Das Paket kommt allein aus dem Feld — keine Aufgaben-Karten.'
        : `Gemeldet: ${anzahl} Aufgaben-Karte${anzahl === 1 ? '' : 'n'} für dieses Paket. FlowForge vermerkt sie als Herkunft.`
  },
  agentenKarten: {
    kontext: (liste, themen = []) =>
      'Aktuelle Projektkarten (von FlowForge für diesen Lauf ausgewählt):\n' +
      liste +
      '\n\nWeitere Karten kannst du über die karten-Werkzeuge lesen, anlegen, aktualisieren und erledigen. ' +
      texte.agentenKarten.themenRegel(themen) +
      '\n\n',
    // Themen (BAUPLAN 30): Die vorhandenen Themen stehen im Auftrag — bewusst
    // NICHT in der Werkzeugbeschreibung (je Turn geänderte Beschreibungen
    // brächen den Prompt-Cache).
    themenRegel: (themen) =>
      (themen.length
        ? `Vorhandene Themen: ${themen.join(', ')}. `
        : 'Es gibt noch keine Themen. ') +
      'Jede neue Karte braucht ein thema: sortiere sie primär in ein vorhandenes Thema ein — ' +
      'ein neues Thema nur, wenn wirklich keines passt.',
    themenZeile: (themen) => `Vorhandene Themen: ${themen.join(', ')}.`,
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
    // Fan-out ohne Datenverlust (BAUPLAN 34): Liefern mehrere gleich nahe
    // Vorfahren dasselbe Etikett (zwei Angreifer vor dem Bauer), bekommt der
    // Nachfolger alle nummeriert — früher gewann still einer.
    eintragMehrfach: (etikett, nummer, gesamt, blockName, text) =>
      `### ${etikett} (${nummer} von ${gesamt}) — von Block „${blockName}"\n${text}\n\n`,
    auftragEinleitung: 'Dein Arbeitsauftrag:\n',
    // Einstellung „Nur-lesende Blöcke dürfen Befehle ausführen" (Zweit-Audit
    // D-01): Die Blockaufträge verbieten Befehle kategorisch — ohne diesen
    // Zusatz versucht der Agent es auftragsgemäß gar nicht erst, obwohl die
    // Sperre im Motor längst gelockert ist.
    nurLesenBefehleZusatz:
      '\n\nZusatz von FlowForge: Die Einstellung „Nur-lesende Blöcke dürfen Befehle ' +
      'ausführen" ist an — abweichend von deinem Auftrag darfst du in diesem Lauf ' +
      'Befehle ausführen (z.B. Prüfskripte oder Tests, um deine Funde zu belegen). ' +
      'Es gelten die normalen Befehls-Regeln: Git und die Prüfmappe bleiben gesperrt, ' +
      'Unbekanntes löst eine Rückfrage aus. Die Schreib-Werkzeuge für Dateien bleiben ' +
      'für diesen Block gesperrt; für Karten gilt weiter, was dein Auftrag sagt.',
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
    // Diff der bisherigen Runden (BAUPLAN 34, Retained Reasoning light): Der
    // frische Bauer soll nicht neu erkunden, sondern dort weitermachen, wo er
    // aufgehört hat — FlowForge rechnet den Unterschied aus den Sicherungspunkten.
    eigeneAenderungen: (diff) =>
      '\n\nDas hast du (derselbe Block) in diesem Lauf bisher am Projekt geändert — von ' +
      'FlowForge aus den Sicherungspunkten gerechnet, nicht von dir erzählt. Nimm es als ' +
      'gegeben: Erkunde diese Stellen nicht neu und triff keine anderen ' +
      'Entwurfsentscheidungen als beim letzten Mal — behebe nur die Beanstandungen.\n' +
      diff,
    // Diff für den Prüfer in der Nachprüfung: was sich seit seinem Urteil getan hat.
    aenderungenSeitUrteil: (diff) =>
      '\n\nDas hat sich am Projekt geändert, seit du dein Urteil gefällt hast — von ' +
      'FlowForge aus den Sicherungspunkten gerechnet (die Prüfmappe pruefung/ ist ' +
      'ausgenommen, deine eigenen Tests stehen also nicht darin):\n' + diff,
    // Das eigene Fazit der letzten Runde ist das „warum" zum Diff.
    vorFazit: (fazit) =>
      '\n\nDein eigenes Fazit aus der letzten Runde (so hast du es damals begründet):\n' + fazit,
    // Kanten-Gate (BAUPLAN 34): Ein Urteil FEHLGESCHLAGEN ohne eine einzige
    // Beanstandungs-Zeile ist wertlos — der Bauer wüsste nicht, was zu tun ist.
    // FlowForge fordert kurz nach, statt eine Reparatur-Runde zu verbrennen.
    beanstandungNachforderung: (belegVorher) =>
      '\n\nNachforderung von FlowForge: Du hast in diesem Lauf schon geprüft und mit ' +
      '„PRUEFUNG: FEHLGESCHLAGEN" geurteilt — aber dein Prüfbeleg enthält keine einzige ' +
      'Zeile im Muster „BEANSTANDUNG (mechanisch): …" oder „BEANSTANDUNG ' +
      '(grundsätzlich): …". Ohne diese Zeilen weiß der Bauer nicht, was er beheben soll. ' +
      'Prüfe jetzt NICHTS neu und führe keine Tests erneut aus: Formuliere allein aus ' +
      'deinem Beleg unten jede Beanstandung als eigene Zeile in genau diesem Muster ' +
      '(mit Fundort; im Zweifel „grundsätzlich"), und wiederhole danach unverändert die ' +
      'Prüfkarten-Zeilen und als allerletzte Zeile PRUEFUNG: FEHLGESCHLAGEN. Findest du ' +
      'beim Lesen, dass es in Wahrheit nichts zu beanstanden gibt, urteile ehrlich ' +
      'PRUEFUNG: BESTANDEN. Dein Prüfbeleg von eben:\n' + belegVorher,
    startanleitungNachforderung:
      '\n\nNachforderung von FlowForge: Dieser Auftrag ist schon umgesetzt, aber die ' +
      'Startanleitung des Projekts fehlt noch. Lege sie jetzt mit dem Werkzeug ' +
      'startanleitung_setzen an (beschreibung, dazu befehl und/oder adresse). ' +
      'Ändere sonst nichts am Projekt.',
    // Tor ohne KI (BAUPLAN 35): Der Prüfbefehl ist das Pflicht-Artefakt des
    // Prüfers — ohne ihn kann FlowForge in Reparatur-Runden nicht selbst
    // nachprüfen und muss jedes Mal einen Prüfer-Agenten bezahlen.
    pruefbefehlNachforderung:
      '\n\nNachforderung von FlowForge: Du hast in diesem Lauf schon geprüft, aber keinen ' +
      'gültigen Prüfbefehl hinterlegt. Prüfe jetzt NICHTS neu und führe keine Tests erneut ' +
      'aus: Lege allein den Startbefehl deiner Prüfmappe mit dem Werkzeug pruefbefehl_setzen ' +
      'fest (ein einzelner Aufruf, der alle deine Prüfungen ausführt und bei einem Fehlschlag ' +
      'mit Fehlercode endet). Wiederhole danach deinen Prüfbeleg von eben unverändert — ' +
      'dieselben Beanstandungs- und Prüfkarten-Zeilen und dasselbe Urteil in der letzten ' +
      'Zeile. Dein Prüfbeleg von eben:\n',
    // Rot-Fall des Tors: Das Protokoll geht neben der Kritik an den Bauer —
    // die Beanstandungs-Zeilen allein sagen nicht, wo es klemmt.
    torProtokoll: (protokoll) =>
      '\n\nDas hat FlowForge selbst gemessen: Der Prüfbefehl des Prüfers wurde ohne Agenten ' +
      'abgespielt und ist rot. Nimm dieses Protokoll als Tatsache — es stammt aus einem ' +
      'echten Lauf, nicht aus einer Einschätzung:\n' + protokoll,
    // Grün-Fall des Tors: Der Prüfer-Agent prüft nur noch, was seine Tests
    // nicht abdecken — der Rest ist deterministisch belegt.
    torGruenNachpruefung: (befehl, kritik) =>
      '\n\nDies ist eine Nachprüfung — und FlowForge hat deinen Prüfbefehl vorher selbst ' +
      `abgespielt: „${befehl}" läuft GRÜN durch. Alle Beanstandungen, die deine Prüfungen ` +
      'abdecken, gelten damit als behoben; führe sie nicht erneut aus. Prüfe in dieser Runde ' +
      'NUR die Beanstandungen nach, die deine Prüfungen NICHT abdecken — keine erneute ' +
      'Vollprüfung, keine neuen Prüffelder. Ist damit alles erledigt, urteile ' +
      'PRUEFUNG: BESTANDEN. Deine Beanstandungen von letzter Runde:\n' + kritik,
    // Rauchtest (BAUPLAN 35): Die Startanleitung startet nicht — das merkt
    // FlowForge selbst, bevor der Prüfer eine Runde kostet.
    rauchtestRueckmeldung: (ausgabe) =>
      '\n\nNachforderung von FlowForge: Dein Auftrag ist umgesetzt, aber die Startanleitung ' +
      'des Projekts läuft nicht an — FlowForge hat sie selbst einmal kurz gestartet und wieder ' +
      'gestoppt. Bring das in Ordnung: Entweder der Code startet nicht (dann repariere ihn) ' +
      'oder die Startanleitung stimmt nicht mehr (dann setze sie mit startanleitung_setzen neu). ' +
      'Baue sonst nichts Neues. Die Ausgabe des Startversuchs:\n' + ausgabe,
    // Baseline (BAUPLAN 35): ehrlich, was schon vor dem Lauf kaputt war —
    // damit niemand Altlasten für seine eigene Arbeit hält.
    baselineRot: (befehl, ausgabe) =>
      `\n\nStand vor diesem Lauf: FlowForge hat den aufbewahrten Prüfbefehl „${befehl}" vor ` +
      'dem Start abgespielt — er war schon damals ROT. Diese Fehlschläge sind Altlasten, nicht ' +
      'deine: Du musst sie in diesem Paket nicht beheben (FlowForge legt sie als Aufgaben-Karte ' +
      'ab), und sie zählen nicht als Fehlschlag deiner Arbeit. Was neu dazukommt, zählt sehr ' +
      'wohl. Das war vorher schon rot:\n' + ausgabe,
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
  // Nachlauf-Chat (BAUPLAN 27): Systemtexte des Chat-Motors. Der Chat ist die
  // fortgesetzte Lauf-Session — der Koordinator-Drill („antworte nur mit OK")
  // steckt noch im Verlauf und wird hier ausdrücklich aufgehoben.
  agentenChat: {
    // Kurzregeln der Bedienung (BAUPLAN 33): das Nötigste im Systemtext — für
    // alles Weitere liest der Chat gezielt in der SPEC.md (Index unten).
    kurzregeln:
      'Kurzregeln von FlowForge: Ein Projekt = ein Ordner mit Karten (Aufgabe, Entscheidung, ' +
      'Wissen, genau eine Status-Karte, Prüfkarten — höchstens 400 Zeichen Inhalt, Themen als ' +
      'zweite Ebene), Workflows (Schaubild aus Block-Karten und Pfeilen), Laufberichten und ' +
      'Sicherungspunkten (automatisch vor jedem Lauf und nach jedem schreibenden Block; ' +
      'Wiederherstellen mit Vorschau). Die Projektansicht hat links die Karten-Seitenleiste ' +
      '(Gruppen Arbeit · Wissen · Geprüft · Erledigt, Aufräum-Knöpfe „Karten am Code prüfen" ' +
      'und „Themen sortieren"), in der Mitte Tabs (Schaubild · Lauf · Laufberichte · ' +
      'Sicherungspunkte · Metriken · App) und rechts die Blockbibliothek in Kategorien ' +
      '(Vorlagen · Auftrag finden · Bauen · Prüfen · Gedächtnis · Eigene · Übung). Blöcke zieht ' +
      'man aufs Schaubild und verbindet sie mit Pfeilen; Prüfkarten zieht man auf einen ' +
      'Prüfer-Block; Karten zieht man in die Kartenauswahl unter dem Schaubild; „Lauf starten" ' +
      'wechselt in den Lauf-Tab (Liveticker, Denk-Bereich, Fragen des Agenten, Stopp in zwei ' +
      'Stufen). Vorlagen: „Neue App starten" (nur Spec-Interview), „Feature hinzufügen" (Paket ' +
      'schneiden → Angreifer → Bauer → Prüfer → Sessionende), „Bug jagen" (Diagnose → Bauer → ' +
      'Prüfer → Sessionende). Der App-Tab startet die gebaute App über ihre Startanleitung und ' +
      'zeigt die Ausgabe live. Titelleiste rechts: „Co-Pilot" (dieser Chat), „Metriken", ' +
      '„Einstellungen" (Motor-Modus, Automodus, lokale Helfer-KI).',
    system: ({ projektPfad, datenordner, titelMax, textMax, specPfad, specIndex }) =>
      'Du bist der Co-Pilot von FlowForge — ein Chat, der dem Nutzer bei der Bedienung von ' +
      'FlowForge und bei seinem Projekt hilft. Falls du vorher der Koordinator eines Laufs ' +
      'warst: Diese Rolle ist beendet — die Koordinator-Regeln (nur delegieren, nur mit OK ' +
      'antworten) gelten NICHT mehr. Antworte frei, hilfreich und auf Deutsch; deine Antwort ' +
      'geht direkt an den Nutzer, der kein Programmierer ist — erkläre in Alltagssprache, ' +
      'fasse dich kompakt. Die Antwort wird als reiner Text angezeigt: kein Markdown ' +
      '(keine Überschriften, Tabellen oder Code-Blöcke; höchstens **fett** für Knopfnamen), ' +
      'Absätze und einfache Listen mit „-" oder „1." sind gut.\n' +
      texte.agentenChat.kurzregeln +
      '\n' +
      (specPfad
        ? 'FlowForges Produktbeschreibung (SPEC.md) beschreibt die Gegenwart der App vollständig ' +
          `— lies sie GEZIELT mit dem Read-Werkzeug (offset/limit) aus dieser Datei: ${specPfad}\n` +
          'Abschnitts-Index (Zeilennummern):\n' +
          specIndex +
          '\nBei Bedienfragen: zuerst den passenden Abschnitt lesen, dann antworten — erfinde ' +
          'keine Knöpfe oder Abläufe.\n'
        : 'Die Produktbeschreibung liegt dieser Installation nicht bei — sag bei ' +
          'Bedienfragen ehrlich, was du aus den Kurzregeln weißt und was nicht.\n') +
      (projektPfad
        ? `Das offene Projekt liegt in: ${projektPfad}\n` +
          'Du darfst selbst Dateien lesen und suchen (auch über Unteraufgaben mit dem ' +
          'Agent-Werkzeug). Standardmäßig bist du nur-lesend: Der Normalweg für Erkenntnisse ist ' +
          'eine Aufgaben-Karte („leg das als Aufgabe an") — der nächste Bau-Lauf arbeitet sie mit ' +
          'Sicherungspunkt und Prüfer ab. Nur wenn der Nutzer den Schalter „Chat darf reparieren" ' +
          'anschaltet, darfst du Dateien ändern und Befehle für ihn ausführen (npm install, eine ' +
          'Erstanmeldung anlegen …); FlowForge legt vor deiner ersten Änderung selbst einen ' +
          'Sicherungspunkt an. Git, die Prüfmappe pruefung/ und FlowForges Verwaltungsdateien ' +
          'sind immer tabu. Läuft im Projekt gerade ein Workflow-Lauf, bist du hart nur-lesend ' +
          '(die Werkzeugantwort sagt es dir) — beantworte dann Fragen aus dem, was du lesen kannst.\n' +
          'Verwende bei Datei-Werkzeugen ausschließlich Pfade relativ zum Projektordner oder ' +
          'diesen absoluten Windows-Pfad — niemals POSIX-Pfade wie /tmp/… oder /c/….\n' +
          'Projektkarten liest und schreibst du ausschließlich über die karten-Werkzeuge ' +
          '(karten_uebersicht, karte_anlegen, karte_aktualisieren, karte_erledigen) — niemals ' +
          `über die Datei karten.json. Harte Regeln: Titel höchstens ${titelMax} Zeichen, Inhalt ` +
          `höchstens ${textMax} Zeichen; wer mehr zu sagen hat, legt mehrere fokussierte Karten an.\n` +
          'Die gebaute App des Projekts bedienst du über die app-Werkzeuge (app_starten, ' +
          'app_stoppen, app_neustarten, app_ausgabe) — derselbe Prozess, den der Nutzer im ' +
          'App-Tab sieht. Starte Server NIE über einen Befehl (er würde deinen Aufruf blockieren ' +
          'und beim nächsten Lauf sterben). Fragt der Nutzer, warum die App nicht startet: erst ' +
          'app_ausgabe lesen, dann antworten — beziehe dich erkennbar auf die Ausgabe. ' +
          'Laufberichte liegen im Ordner laufberichte/ (lesbar); die Startanleitung nennt Befehl ' +
          'und Adresse (startanleitung.json ist lesbar, gesetzt wird sie nur über startanleitung_setzen).'
        : 'Es ist KEIN Projekt offen (Projektübersicht): Du beantwortest nur Bedienfragen zu ' +
          'FlowForge. Dein Arbeitsordner ist FlowForges Datenordner ' +
          `(${datenordner}) — der ist für deine Werkzeuge gesperrt; Befehle und Schreiben ` +
          'sind hier gesperrt. Lies bei Bedarf ausschließlich die Produktbeschreibung über ihren ' +
          'absoluten Pfad. Fragt der Nutzer etwas zu einem konkreten Projekt, bitte ihn, das ' +
          'Projekt zu öffnen und dort zu fragen.'),
    // Während eines Laufs (BAUPLAN 33): Notiz vor der Nutzer-Nachricht — sonst
    // weiß die KI nicht, dass sie gerade hart nur-lesend ist.
    laufAktivNotiz:
      '[Notiz von FlowForge: Im Projekt läuft (oder wartet) gerade ein Workflow-Lauf. Du bist ' +
      'so lange hart nur-lesend — Karten anlegen, Dateien ändern, Befehle und Reparieren gehen ' +
      'erst nach dem Lauf. Beantworte die Frage aus dem, was du lesen kannst.]',
    // Frische Session statt Fortsetzung: der Laufbericht ist der Kontext.
    laufKontext: (text) =>
      '\nDie ursprüngliche Lauf-Session ist nicht mehr verfügbar. Hier der Laufbericht des ' +
      'Laufs, über den der Nutzer mit dir sprechen will:\n' + text,
    berichtKopf: (workflow, zeit, zustand) =>
      `Workflow: ${workflow} · gestartet ${zeit} · Ausgang: ${zustand}`,
    berichtBlock: (name, zustand, text) => `\n### Block „${name}" (${zustand}):\n${text}`,
    berichtFehler: (text) => `\nFehler des Laufs: ${text}`
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
    // Trefferquote (BAUPLAN 23): nur wenn der Schalter „Trefferquote erfassen"
    // an ist — sonst gibt es weder Werkzeug noch Hinweis (kein Mehrverbrauch).
    // Die Abnahmen bei Entwürfen und Teilstücken bleiben davon unberührt
    // (sie steuern Übernahme und Rückrollen — Mechanik, keine Messung).
    bewertenAufforderung:
      '\n\nBewerte dieses Fazit jetzt mit recherche_bewerten: uebernommen (es fließt in ' +
      'deine Arbeit ein) oder verworfen (du recherchierst selbst nach) — mit einem Satz ' +
      'Begründung.',
    bewertenBeschreibung:
      'Meldet, was aus dem Fazit einer lokalen Recherche wurde: übernommen (es fließt in ' +
      'deine Arbeit ein) oder verworfen (du recherchierst selbst nach) — mit einem Satz ' +
      'Begründung. Pflicht nach jedem lokal_recherchieren.',
    bewertenSystemZusatz:
      'Nach jedem lokal_recherchieren bewertest du das Fazit mit recherche_bewerten: ' +
      'übernommen oder verworfen, mit einem Satz Begründung — FlowForge misst damit die ' +
      'Trefferquote der lokalen KI.\n',
    bewertet: (uebernommen) =>
      uebernommen
        ? 'Bewertung vermerkt: Fazit übernommen.'
        : 'Bewertung vermerkt: Fazit verworfen — recherchiere selbst nach, was du brauchst.',
    // Projektwissen (BAUPLAN 25): FlowForge stellt die Kartenauswahl des Laufs
    // jedem lokalen Auftrag voran — die lokale KI kann keine Rückfragen
    // stellen; was nicht im Auftrag steht, existiert für sie nicht.
    projektwissen: (liste) =>
      'Projektwissen (aktuelle Projektkarten, von FlowForge vorangestellt — Festlegungen ' +
      'aus Entscheidungs-Karten gelten verbindlich, rolle sie nicht neu auf):\n' +
      liste +
      '\n\nDein Auftrag:\n',
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
      'Kleinst-Änderungen erledigst du direkt selbst. Ein verworfenes Teilstück ist KEIN ' +
      'Urteil über die übrigen: Versuche jedes Teilstück zuerst lokal — erst wenn mehrere ' +
      'hintereinander nicht halten, bau den Rest selbst.'
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
      'prüfen, berichten) — im Zweifel die sichere Wahl.',
    // Kategorie-Zusatz (BAUPLAN 30): wird an den Auftrag angehängt; die KI
    // wählt eine der vorhandenen Bibliotheks-Klappen, Standard „eigene".
    bereichZusatz: (bereiche) =>
      '\n- Zusätzlich ein Feld "bereich": die Kategorie (Klappe) der Blockbibliothek, ' +
      'in der der Block liegen soll. Erlaubte Werte, jeweils mit ihrer Bedeutung: ' +
      bereiche.map((b) => `"${b.schluessel}" (${b.name})`).join(', ') +
      '. Wähle die passende — passt keine wirklich, nimm "eigene". Erfinde keinen neuen Wert.'
  },
  // Startanleitung & „App starten"-Knopf (SPEC §8, BAUPLAN 10).
  // App-Tab (BAUPLAN 32, SPEC §8): Ausgabe der laufenden App in FlowForge,
  // Start/Stopp/Neustart, Port-Prüfung, Rückfall-Liste verwaister Prozesse.
  app: {
    ueberschrift: 'Deine App',
    keineAnleitung:
      'Noch keine Startanleitung. Ein Bau-Workflow (z.B. „Feature hinzufügen") legt sie an — danach startet deine App hier mit einem Klick, und du siehst ihre Ausgabe live.',
    beschreibungLabel: 'Was die App tut',
    befehlLabel: 'Befehl',
    adresseLabel: 'Adresse',
    keinBefehl: 'Diese Startanleitung hat keinen Befehl — nur eine Adresse bzw. Datei. „Starten" öffnet sie direkt.',
    starten: 'Starten',
    stoppen: 'Stoppen',
    neustarten: 'Neu starten',
    adresseOeffnen: 'Adresse im Browser öffnen',
    wartetAufAdresse: 'wartet, bis die Adresse antwortet …',
    zustandAus: 'nicht gestartet',
    zustandStartet: 'startet …',
    zustandLaeuft: (seit) => `läuft seit ${seit}`,
    zustandBeendet: (code, wann) =>
      code === 0 ? `beendet (Code 0) um ${wann}` : `beendet mit Code ${code ?? '?'} um ${wann}`,
    zustandGestoppt: (wann) => `gestoppt um ${wann}`,
    zustandNurAdresse: 'geöffnet (kein eigener Prozess)',
    ausgabeTitel: 'Ausgabe',
    ausgabeLeer: 'Noch keine Ausgabe. Wenn deine App etwas schreibt, steht es hier — mit Umlauten.',
    ausgabeHinweis:
      'Standard- und Fehlerausgabe der App, live. Eingaben sind nicht möglich: Die Startanleitung muss ohne Tastatur auskommen.',
    startZeile: (befehl) => `▶ ${befehl}`,
    endeZeile: (code) => (code === 0 ? '■ Die App hat sich beendet (Code 0).' : `■ Die App hat sich beendet — Code ${code ?? '?'}.`),
    stoppZeile: '■ Gestoppt über FlowForge.',
    fehlerLaeuftSchon: 'Die App läuft schon — stopp sie zuerst oder nimm „Neu starten".',
    fehlerKeineAdresse: 'Diese Startanleitung hat keine Adresse.',
    fehlerAdresseNichtErreichbar:
      'Die App hat sich beendet, bevor die Adresse geantwortet hat — sieh in die Ausgabe.',
    fehlerStart: (grund) => `Die App ließ sich nicht starten${grund ? `: ${grund}` : '.'}`,
    fehlerPortFlowForge: (port) => `Port ${port} gehört FlowForge selbst — das kann ich nicht beenden.`,
    fehlerPortNichtFrei: (port) =>
      `Port ${port} ist immer noch belegt. Sieh in der Liste „noch laufende Prozesse" nach oder warte einen Moment.`,
    // Port-Prüfung vor dem Start: Dialog mit dem Besitzer-Prozess.
    portBelegtTitel: 'Port ist belegt',
    portBelegtFrage: (port, name, pid) =>
      `Port ${port} ist schon belegt — von „${name || 'unbekannt'}" (Prozess ${pid}). Meist ist das ein Server, den ein früherer Lauf gestartet und nie beendet hat. Soll ich ihn beenden und deine App dann starten?`,
    portBelegtBefehl: 'Befehlszeile',
    portBelegtKnopf: 'Beenden und starten',
    // Rückfall-Liste (BAUPLAN 32): falls doch einmal etwas hängen bleibt.
    verwaisteTitel: 'Noch laufende Prozesse aus Läufen',
    verwaisteHinweis:
      'Normalerweise beendet FlowForge am Ende jedes Laufs alles, was der Lauf gestartet hat. Diese Liste ist der Rückfall: Prozesse, die sich nicht beenden ließen, und verwaiste Prozesse, die während eines Laufs entstanden sind (vermutlich aus einem Lauf — kann aber auch etwas sein, das du selbst gestartet hast; sieh auf die Befehlszeile).',
    verwaisteLeer: 'Nichts hängt — alles sauber.',
    verwaisteAktualisieren: 'Liste aktualisieren',
    verwaisteSicher: 'aus einem Lauf',
    verwaisteVermutlich: 'vermutlich aus einem Lauf',
    verwaisteGestartet: (wann) => `gestartet ${wann}`,
    prozessBeenden: 'Beenden',
    prozessBeendenFrage: (name, pid) =>
      `Prozess „${name || 'unbekannt'}" (${pid}) beenden? Das geht sofort und ohne Rückfrage an das Programm.`,
    prozessWiederverwendet: 'Dieser Prozess ist inzwischen ein anderer — die Liste wird neu geladen.',
    prozessNichtBeendet: 'Der Prozess ließ sich nicht beenden — vielleicht braucht er Administratorrechte.'
  },
  startanleitung: {
    knopf: 'App starten',
    knopfLaeuft: 'App läuft',
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
    fehlerBeschreibung: (max, ist = 0) =>
      `Die beschreibung fehlt oder ist zu lang (höchstens ${max} Zeichen${ist > max ? `, deine hat ${ist}` : ''}) — ein Satz in Alltagssprache genügt.`,
    fehlerQuelleFehlt:
      'Gib mindestens eines an: befehl (Kommandozeile im Projektordner) und/oder adresse (http(s)-Adresse oder Datei im Projektordner).',
    fehlerZuLang: 'befehl oder adresse ist zu lang — halte beides kurz und konkret.',
    fehlerAdresse:
      'Die adresse muss mit http:// oder https:// beginnen — oder eine Datei im Projektordner sein (relativer Pfad, kein Ausbruch per „..").'
  },
  // Prüfbefehl-Werkzeug (BAUPLAN 35): Texte an den Agenten.
  agentenPruefbefehl: {
    anweisungen:
      'Mit pruefbefehl_setzen hinterlegst du den Startbefehl deiner Prüfmappe. FlowForge spielt ' +
      'ihn in Reparatur-Runden selbst ab — ohne dich zu starten und ohne Kontingent zu kosten. ' +
      'Nutze es, wenn dein Arbeitsauftrag den Prüfbefehl verlangt — niemals über die Datei ' +
      'pruefbefehl.json.',
    werkzeugBeschreibung:
      'Hinterlegt den Befehl, mit dem sich die Prüfungen in pruefung/ von außen starten lassen — ' +
      'Pflicht-Artefakt jedes Prüf-Auftrags. FlowForge führt ihn in Reparatur-Runden selbst aus, ' +
      'bevor es dich erneut startet: Bleibt er rot, geht das Fehlerprotokoll ohne dich zurück an ' +
      'den Bauer. Genau EIN Befehl, der ohne Rückfrage und ohne Tastatureingabe durchläuft.',
    befehlParam:
      'Der Befehl, der im Projektordner alle deine Prüfungen ausführt und bei einem Fehlschlag ' +
      'mit einem Fehlercode endet (z.B. „npx vitest run pruefung" oder „python pruefung/pruefe.py"). ' +
      'Ein einzelner Befehl — keine Verkettung mit &, |, ; und keine Unterausführung.',
    gesetzt: (befehl) =>
      `Prüfbefehl festgelegt: ${befehl} — FlowForge spielt ihn in Reparatur-Runden selbst ab.`,
    fehlerLeer: 'Der befehl fehlt. Gib genau einen Befehl an, der deine Prüfungen ausführt.',
    fehlerZuLang:
      'Der befehl ist zu lang. Halte ihn kurz und konkret — ein Aufruf, der alle Prüfungen startet.',
    fehlerVerkettung:
      'Der befehl darf nur ein einzelner Aufruf sein: keine Verkettung (&, &&, |, ;), keine ' +
      'Umleitung (>, <) und keine Unterausführung ($(…), Backticks). Braucht deine Prüfung ' +
      'mehrere Schritte, lege ein Skript in pruefung/ ab und rufe nur dieses auf.',
    fehlerWerkzeug: (werkzeug) =>
      `„${werkzeug}" ist als Prüfbefehl nicht zugelassen. FlowForge führt den Prüfbefehl ohne ` +
      'Rückfrage aus und lässt deshalb nur Test-Werkzeuge zu (node, npm, npx, pnpm, yarn, ' +
      'vitest, jest, mocha, tsc, python, py, pytest, deno, bun, go, cargo, dotnet, mvn, gradle, ' +
      'make, rspec, phpunit). Rufe deine Prüfungen über eines davon auf.'
  },
  // Tor ohne KI (BAUPLAN 35): FlowForge spielt Prüfbefehl und Rauchtest selbst
  // ab. Diese Texte gehen als Beleg bzw. Rückmeldung in den Lauf — sie müssen
  // dieselben Marken tragen wie ein echter Prüfbeleg (BEANSTANDUNG, PRUEFUNG).
  tor: {
    belegKopf: (befehl, code) =>
      `Prüfbefehl von FlowForge abgespielt (ohne Prüfer-Agent): ${befehl}\n` +
      `Ergebnis: rot — der Befehl endete mit Rückgabecode ${code}.\n`,
    belegKopfZeitlimit: (befehl) =>
      `Prüfbefehl von FlowForge abgespielt (ohne Prüfer-Agent): ${befehl}\n` +
      'Ergebnis: rot — der Befehl lief in das Zeitlimit und wurde abgebrochen.\n',
    // Bewusst „grundsätzlich": FlowForge kann ein Fehlerprotokoll nicht
    // einstufen — nur der Prüfer kann das. Damit bleibt die lokale
    // Vorreparatur (BAUPLAN 20) hier außen vor, statt blind zu raten.
    beanstandung: (zeile) => `BEANSTANDUNG (grundsätzlich): ${zeile}`,
    beanstandungOhneZeilen: (befehl) =>
      `BEANSTANDUNG (grundsätzlich): Der Prüfbefehl „${befehl}" schlägt fehl, ohne eine ` +
      'erkennbare Fehlerzeile auszugeben — sieh im vollständigen Protokoll nach.',
    weitere: (anzahl) =>
      `(${anzahl} weitere Fehlerzeile${anzahl === 1 ? '' : 'n'} stehen im Protokoll unten.)`,
    urteil: 'PRUEFUNG: FEHLGESCHLAGEN',
    protokoll: (ausgabe) => `\n\nVollständige Ausgabe des Prüfbefehls:\n${ausgabe}`,
    rauchtestDateiFehlt: (adresse) =>
      `Die Startanleitung zeigt auf die Datei „${adresse}" — die gibt es im Projektordner nicht.`,
    rauchtestKeineAntwort: (adresse) =>
      `Der Befehl lief an, aber unter ${adresse} antwortete nichts.`,
    rauchtestOhneAusgabe:
      'Der Startversuch schlug fehl, ohne eine Ausgabe zu hinterlassen — der Befehl der Startanleitung läuft so nicht an.',
    // Altlast-Karte (BAUPLAN 35): War der Prüfbefehl schon vor dem Lauf rot,
    // wird daraus eine offene Aufgaben-Karte statt einer Reparatur-Runde.
    // Der Titel bleibt bewusst stabil (ohne Datum), damit derselbe Befund
    // nicht bei jedem Lauf eine neue Karte anlegt.
    altlastTitel: 'Altlast: Prüfungen waren schon vor dem Lauf rot',
    altlastThema: 'Altlasten',
    // Die Karten-Längengrenze (400 Zeichen) ist hart — deshalb wird hier
    // gedeckelt, statt die Karte am Ende abgewiesen zu bekommen.
    altlastText: (befehl, zeilen) => {
      const kopf =
        `Der aufbewahrte Prüfbefehl „${befehl}" war schon vor dem Lauf rot — das stammt nicht ` +
        'aus dem aktuellen Paket. Rot war: '
      const platz = Math.max(0, 400 - kopf.length)
      const rest = String(zeilen ?? '').replace(/\s+/g, ' ').trim()
      return kopf + (rest.length > platz ? rest.slice(0, Math.max(0, platz - 1)) + '…' : rest)
    }
  },
  // App-Werkzeuge des Co-Piloten (BAUPLAN 33): Texte an den Agenten.
  agentenApp: {
    anweisungen:
      'Mit den app-Werkzeugen bedienst du die gebaute App des Projekts über FlowForges App-Tab: ' +
      'app_starten / app_stoppen / app_neustarten steuern den Prozess, app_ausgabe liefert Zustand ' +
      'und die letzte Ausgabe. Es ist derselbe Prozess, den der Nutzer im App-Tab sieht.',
    startenBeschreibung:
      'Startet die App des Projekts nach ihrer Startanleitung im App-Tab von FlowForge (sichtbar ' +
      'für den Nutzer). Liefert Zustand und die ersten Zeilen der Ausgabe. Ist der Port belegt, ' +
      'nennt die Antwort den Besitzer-Prozess — beenden lässt er sich nur mit port_freimachen ' +
      '(löst eine Rückfrage beim Nutzer aus).',
    portFreimachenParam:
      'true = einen fremden Prozess, der den Port der Startanleitung belegt, vorher beenden (Rückfrage beim Nutzer)',
    stoppenBeschreibung: 'Stoppt die im App-Tab laufende App (ganzer Prozessbaum).',
    neustartenBeschreibung:
      'Stoppt die App und startet sie neu nach ihrer Startanleitung; liefert Zustand und die ersten Zeilen der Ausgabe.',
    ausgabeBeschreibung:
      'Liest Zustand („läuft seit …", „beendet mit Code …") und die letzte Ausgabe der App aus dem ' +
      'App-Tab (Standard- und Fehlerausgabe). Erst lesen, dann über Fehler sprechen.',
    zeichenParam: (standard, max) =>
      `Wie viele Zeichen vom Ende der Ausgabe (Standard ${standard}, höchstens ${max})`,
    gestartet: 'App gestartet.',
    neuGestartet: 'App neu gestartet.',
    gestoppt: 'App gestoppt.',
    zustand: (text) => `Zustand: ${text}`,
    ausgabe: (text) => `Ausgabe (Ende):\n${text}`,
    keineAusgabe: 'Noch keine Ausgabe.',
    portBelegt: (port, name, pid, befehl) =>
      `Port ${port} ist belegt — von „${name || 'unbekannt'}" (Prozess ${pid}${befehl ? `, Befehlszeile: ${befehl}` : ''}). ` +
      'Meist ein Server, den ein früherer Lauf gestartet und nie beendet hat. Erkläre es dem Nutzer; ' +
      'beenden kannst du ihn nur mit app_starten(port_freimachen: true) — das fragt den Nutzer.'
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
    // Trefferquote (BAUPLAN 23): Standard an, solange die lokale KI ein
    // Experiment ist — ohne Quote ist die Kosten-Wette blind.
    lokaleHelferQuote: 'Trefferquote der lokalen KI erfassen',
    lokaleHelferQuoteHinweis:
      'Nach jeder lokalen Recherche meldet der Agent, ob er das Fazit übernommen oder ' +
      'verworfen hat (minimaler Token-Mehrverbrauch). Ticker und Laufbericht zählen mit — ' +
      'so siehst du, ob sich die lokale KI lohnt.',
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
    // Befehle trotz „darf nur lesen" (Entscheidung Georg, 14.08.2026):
    // Auf-eigene-Gefahr-Schalter, Standard aus.
    nurLesenBefehle: 'Nur-lesende Blöcke dürfen Befehle ausführen (auf eigene Gefahr)',
    nurLesenBefehleHinweis:
      'Angreifer und Diagnose dürfen dann z.B. Prüfskripte laufen lassen, um ihre Funde zu ' +
      'belegen — mit denselben Regeln wie beim Bauer (Git bleibt gesperrt, Unbekanntes ' +
      'fragt). Achtung: Ein ausgeführtes Skript kann Dateien verändern — die Garantie ' +
      '„nur-lesende Blöcke fassen nichts an" gilt dann nicht mehr. Schreib-Werkzeuge ' +
      'bleiben für diese Blöcke gesperrt.',
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
    // Denk-Ansicht statt Rohprotokoll (BAUPLAN 24): sichtbares Denken der
    // gerade arbeitenden KI — JSON-Zeilen sieht kein Mensch durch.
    denkenZeigen: 'Denken einblenden',
    denkenVerbergen: 'Denken ausblenden',
    denkenLeer: 'Noch kein Denken zu sehen — sobald die KI nachdenkt, steht es hier.',
    denkenKoordinator: 'Koordinator',
    denkenUnteraufgabe: 'Unteraufgabe',
    denkenLokaleKi: 'lokale KI',
    verbrauchKontext: (von, bis) => `Kontext: etwa ${von}–${bis} % gefüllt`,
    // Füllstand des Block-Agenten (BAUPLAN 36): der Balken misst den
    // Koordinator, gearbeitet wird aber im Agenten.
    verbrauchAgent: (von, bis) =>
      `Der arbeitende Block-Agent hat sein eigenes Fenster: etwa ${von}–${bis} % gefüllt.`,
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
    // Karten-Vorschläge (BAUPLAN 26, gelockert 14.08.2026): rückfragefrei nur
    // im Karten-Prüfer — andere Blöcke fragen nach dem üblichen Verfahren.
    vorschlag:
      'Der Agent möchte dir einen Karten-Vorschlag machen — üblich ist das nur im Karten-Prüfer-Block. Erlaubst du es, entscheidest du den Vorschlag danach trotzdem Karte für Karte.',
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): rückfragefrei nur im
    // Sessionende — andere Blöcke fragen nach dem üblichen Verfahren.
    laufVorschlag:
      'Der Agent möchte eine Kartenauswahl für den nächsten Lauf vorschlagen — üblich ist das nur im Sessionende-Block. Erlaubst du es, bleibt es trotzdem nur ein Vorschlag, den du an der Kartenauswahl übernimmst oder verwirfst.',
    // Karten-Zuteilung (BAUPLAN 29): rückfragefrei nur in Auftragsquellen-
    // Blöcken (Paket schneiden, Diagnose) — andere fragen nach dem üblichen
    // Verfahren.
    kartenZuteilung:
      'Der Agent möchte den nachfolgenden Blöcken Karten zuteilen — üblich ist das nur in Paket schneiden und Diagnose. Erlaubst du es, bekommen die genannten Blöcke nur ihre zugeteilten Karten in den Auftrag (die Status-Karte immer).',
    // Prüfbefehl (BAUPLAN 35): rückfragefrei nur in Prüf-Blöcken — er gehört
    // zur Prüfmappe, und FlowForge spielt ihn später ohne Rückfrage ab.
    pruefbefehl:
      'Der Agent möchte den Prüfbefehl des Projekts festlegen — den Befehl, den FlowForge in Reparatur-Runden selbst abspielt, um ohne KI nachzuprüfen. Üblich ist das nur im Prüfer. Erlaubst du es, wird der Befehl trotzdem hart geprüft: nur ein einzelnes Test-Werkzeug, keine Verkettung.',
    abgelehntFuerAgent:
      'Der Nutzer hat das nicht erlaubt. Suche einen anderen Weg innerhalb des Projektordners — oder beende den Auftrag mit einer kurzen Erklärung.',
    gitGesperrtFuerAgent:
      'Git ist in FlowForge-Projekten gesperrt: Die App verwaltet Sicherungspunkte selbst. Arbeite ohne Git weiter.',
    nurLesenGesperrtFuerAgent:
      'Dieser Block darf nur lesen. Schreiben, verändernde Befehle und Internet sind hier gesperrt. Beende den Auftrag nur mit Lese-Werkzeugen.',
    // Verfeinerte Lese-Sperre (Feedback Georg, 12.08.2026): rein lesende
    // Befehle laufen durch — für alles andere sagt die Meldung ehrlich, warum.
    nurLesenBefehlFuerAgent:
      'Dieser Block darf nur lesen. Rein lesende Befehle (z.B. dir, ls, type, cat, findstr, grep, where, echo, pwd, head, tail, wc — auch die PowerShell-Gegenstücke wie Get-ChildItem, Get-Content, Select-String) laufen durch — dieser Befehl gehört nicht dazu, auch Ausführen von Programmen oder Tests zählt nicht als Lesen. Nutze die Lese-Werkzeuge oder einen rein lesenden Befehl.',
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
      'Die lokale Helfer-KI ist für diesen Block abgeschaltet (Häkchen an der Block-Karte). Nutze für Unteraufgaben das Agent-Werkzeug.',
    // Co-Pilot (BAUPLAN 33): App bedienen im nur-lesenden Chat fragt nach;
    // einen fremden Port-Besitzer beenden fragt immer.
    appBedienen:
      'Der Chat möchte deine App starten oder stoppen (über den App-Tab). Im nur-lesenden Chat fragt er dafür — mit „Chat darf reparieren" ginge es ohne Rückfrage.',
    appPortFreimachen:
      'Der Chat möchte einen fremden Prozess beenden, der den Port deiner App belegt, und die App dann starten. Das geht sofort und ohne Rückfrage an das Programm.',
    // Übersichts-Chat: Datenordner und alles außer Lesen gesperrt.
    datenordnerGesperrtFuerAgent:
      'FlowForges Datenordner ist für dich gesperrt (dort liegen Einstellungen und Schlüssel). Ohne offenes Projekt liest du nur die Produktbeschreibung über ihren absoluten Pfad.',
    uebersichtGesperrtFuerAgent:
      'Ohne offenes Projekt beantwortest du nur Bedienfragen zu FlowForge — Befehle, Schreiben und Projektzugriffe sind hier gesperrt. Bitte den Nutzer, das Projekt zu öffnen, wenn es um sein Projekt geht.',
    chatWaehrendLaufFuerAgent:
      'Im Projekt läuft gerade ein Workflow-Lauf — der Chat ist so lange hart nur-lesend (ein Schreiber pro Projekt). Beantworte die Frage aus dem, was du lesen kannst; Änderungen gehen erst nach dem Lauf.'
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
    // Detail-Zeilen je Schritt (BAUPLAN 23): der Ticker nennt das Ziel —
    // welche Datei (samt Startzeile), welches Suchmuster, welcher Ordner.
    // Die Eingaben kommen vom kleinen Modell und können fehlen oder wuchern:
    // defensiv lesen und kürzen.
    lokaleHelferSchritt: (werkzeug, eingabe) => {
      const kurz = (wert, max) => {
        const einzeilig = String(wert ?? '').replace(/\s+/g, ' ').trim()
        return einzeilig.length > max ? einzeilig.slice(0, max) + '…' : einzeilig
      }
      if (werkzeug === 'aufruf_uebersetzt')
        return 'Lokale KI · Werkzeugaufruf kam als Text getarnt — FlowForge hat ihn übersetzt und führt ihn aus.'
      if (werkzeug === 'datei_lesen') {
        const pfad = kurz(eingabe?.pfad, 80)
        if (!pfad) return 'Lokale KI · liest eine Datei.'
        const von = Number(eingabe?.vonZeile)
        return von > 1
          ? `Lokale KI · liest ${pfad} ab Zeile ${von}.`
          : `Lokale KI · liest ${pfad}.`
      }
      if (werkzeug === 'suchen') {
        const muster = kurz(eingabe?.muster, 60)
        return muster
          ? `Lokale KI · durchsucht das Projekt nach „${muster}".`
          : 'Lokale KI · durchsucht das Projekt.'
      }
      if (werkzeug === 'ordner_auflisten') {
        const pfad = kurz(eingabe?.pfad, 80)
        return pfad && pfad !== '.'
          ? `Lokale KI · sieht sich ${pfad} an.`
          : 'Lokale KI · sieht sich den Projektordner an.'
      }
      return `Lokale KI · nutzt Werkzeug ${kurz(werkzeug, 40) || '?'}.`
    },
    lokaleHelferFertig: (schritte) =>
      `Lokale KI fertig — Fazit nach ${schritte} ${schritte === 1 ? 'Schritt' : 'Schritten'}.`,
    // Trefferquote (BAUPLAN 23): sichtbar, ob der Agent das Fazit wirklich
    // berücksichtigt hat — samt seiner Begründung.
    rechercheUebernommen: (begruendung) =>
      `Agent übernimmt das Fazit der lokalen KI${begruendung ? ': ' + begruendung : '.'}`,
    rechercheVerworfen: (begruendung) =>
      `Agent verwirft das Fazit der lokalen KI${begruendung ? ': ' + begruendung : '.'}`,
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
    // Ziel der Unteraufgabe sichtbar (BAUPLAN 25) — z.B. die drei
    // Blickwinkel-Prüfer des Audits.
    unteraufgabeMitZiel: (ziel) => `Startet Unteraufgabe: ${ziel}`,
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
    nurLesenBefehleAktiv:
      'Einstellung aktiv: Nur-lesende Blöcke dürfen Befehle ausführen (auf eigene Gefahr).',
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
    // Prozess-Hygiene (BAUPLAN 32): am Lauf-Ende ehrlich vermerkt.
    verwaisteBeendet: (n, namen = []) => {
      const liste = [...new Set(namen.filter(Boolean))].slice(0, 4).join(', ')
      return (
        (n === 1 ? '1 verwaister Prozess' : `${n} verwaiste Prozesse`) +
        ` aus dem Lauf beendet${liste ? ` (${liste})` : ''}.`
      )
    },
    verwaisteUebrig: (n) =>
      `${n} ${n === 1 ? 'Prozess aus dem Lauf ließ' : 'Prozesse aus dem Lauf ließen'} sich nicht beenden — siehe App-Tab, Liste „noch laufende Prozesse".`,
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
    // Tor ohne KI (BAUPLAN 35): Prüfbefehl, Rauchtest und Baseline laufen ohne
    // Motor — jede Zeile hier steht für gesparte Tokens und ist deshalb
    // sichtbar im Ticker und damit im Laufbericht.
    pruefbefehlGesetzt: (befehl) =>
      `Prüfbefehl festgelegt: ${befehl} — FlowForge kann jetzt ohne KI nachprüfen.`,
    pruefbefehlAbgelehnt: (grund) => `Prüfbefehl abgelehnt: ${grund}`,
    pruefbefehlNachgefordert: (block) =>
      `Der Prüfbefehl fehlt — „${block}" bekommt eine Nachbesserungs-Runde (er prüft nichts neu).`,
    pruefbefehlWeiterOhne:
      'Der Prüfbefehl fehlt weiterhin — Reparatur-Runden brauchen wieder einen Prüfer-Agenten.',
    torSpielt: (befehl) => `Prüfbefehl wird abgespielt (ohne KI, 0 Tokens): ${befehl}`,
    torRot: (anzahl) =>
      `Prüfbefehl abgespielt: rot (${anzahl} ${anzahl === 1 ? 'Fehlerzeile' : 'Fehlerzeilen'}) — zurück zum Bauer ohne Prüfer-Agent.`,
    torRotZeitlimit:
      'Prüfbefehl abgespielt: rot (Zeitlimit überschritten) — zurück zum Bauer ohne Prüfer-Agent.',
    torGruen:
      'Prüfbefehl abgespielt: grün — der Prüfer prüft nur noch die grundsätzlichen Beanstandungen.',
    torAltlasten: (anzahl) =>
      `Prüfbefehl abgespielt: rot, aber nur mit ${anzahl === 1 ? 'dem Fehlschlag' : `den ${anzahl} Fehlschlägen`}, ${anzahl === 1 ? 'der' : 'die'} schon vor dem Lauf da ${anzahl === 1 ? 'war' : 'waren'} — das zählt nicht als neuer Fehlschlag.`,
    baselineSpielt: (befehl) => `Stand vor dem Lauf wird gemessen (ohne KI): ${befehl}`,
    baselineGruen: 'Stand vor dem Lauf: alle aufbewahrten Prüfungen grün.',
    baselineRot: (anzahl) =>
      `Stand vor dem Lauf: schon rot (${anzahl} ${anzahl === 1 ? 'Fehlerzeile' : 'Fehlerzeilen'}) — das sind Altlasten, keine Fehlschläge dieses Laufs.`,
    baselineAltlastKarte: (titel) => `Altlast als Aufgaben-Karte abgelegt: „${titel}"`,
    rauchtestGruen: 'Rauchtest der Startanleitung: die App läuft an.',
    rauchtestRot: (block) =>
      `Rauchtest der Startanleitung: die App läuft NICHT an — „${block}" bekommt eine Nachbesserungs-Runde, bevor der Prüfer etwas kostet.`,
    rauchtestWeiterOhne:
      'Die Startanleitung läuft weiterhin nicht an — der Lauf macht ehrlich vermerkt weiter.',
    rauchtestUebersprungen:
      'Rauchtest übersprungen: Die App läuft gerade im App-Tab — FlowForge nimmt ihr den Port nicht weg.',
    sicherungspunktAngelegt: 'Sicherungspunkt angelegt.',
    zurueckgesetzt: 'Projektordner auf den letzten Sicherungspunkt zurückgesetzt.',
    fertigIn: (sekunden) => `Fertig nach ${sekunden} Sekunden.`,
    blockStartet: (nr, gesamt, name) => `Block ${nr} von ${gesamt}: „${name}" startet.`,
    // Karten-Vorschläge (BAUPLAN 26): Vorschlag und Ausgang sichtbar im Ticker.
    kartenVorschlagGestellt: (artLabel, titel) =>
      `Karten-Vorschlag wartet auf dich: ${artLabel} — „${titel}".`,
    kartenVorschlagUebernommen: (titel) => `Karten-Vorschlag übernommen: „${titel}".`,
    kartenVorschlagBearbeitet: (titel) =>
      `Karten-Vorschlag mit deinen Änderungen übernommen: „${titel}".`,
    kartenVorschlagAbgelehnt: (titel) => `Karten-Vorschlag abgelehnt: „${titel}".`,
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): sichtbar im Ticker
    // und damit auch im Laufbericht des erzeugenden Laufs.
    laufVorschlagGespeichert: (anzahl, empfehlung) =>
      `Vorschlag fürs nächste Paket: ${anzahl} Karte${anzahl === 1 ? '' : 'n'} — ${empfehlung}`,
    // Karten-Zuteilung (BAUPLAN 29): sichtbar im Ticker und damit im Laufbericht.
    kartenZuteilung: (zeilen) => `Karten verteilt: ${zeilen}`,
    // Paket melden & Themen (BAUPLAN 30).
    paketGemeldet: (titel) =>
      titel.length
        ? `Paket gemeldet: ${titel.length} Aufgabe${titel.length === 1 ? '' : 'n'} — „${titel.join('“, „')}". Karten aus diesem Lauf tragen das als Herkunft.`
        : 'Paket gemeldet: allein aus dem Feld — keine Aufgaben-Karten.',
    themenUebernommen: (uebernommen, abgelehnt) =>
      `Themen sortiert: ${uebernommen} übernommen, ${abgelehnt} abgelehnt.`,
    // Audit (BAUPLAN 25): volle Lesetiefe, bewusst teuer — die Kosten-Folge
    // steht sichtbar am Start (Entscheidung Georg, 14.08.2026).
    auditKostenHinweis:
      'Rundum-Blick mit voller Lesetiefe: Die drei Blickwinkel-Prüfer lesen das ganze Projekt — ein Audit-Lauf kann mehrere hunderttausend Tokens kosten.',
    zweigeZusammengefuehrt: (name, anzahl) =>
      `„${name}" führt ${anzahl} Zweige zusammen — alle Vorgänger sind fertig.`,
    // Warte-Grund (BAUPLAN 36): Eine stille Pause im Verzweigten sieht aus wie
    // ein Hänger — hier steht, worauf gewartet wird.
    warteAufSchreiber: (name, schreiber) =>
      `„${name}" wartet — „${schreiber}" schreibt gerade (im Projekt schreibt immer nur einer).`,
    warteAufZweig: (name, offene) =>
      `„${name}" wartet auf ${offene.map((n) => `„${n}"`).join(' und ')} — der andere Zweig ist schon fertig.`,
    // Compaction sichtbar (BAUPLAN 36): Der Motor dampft sein Arbeitsgedächtnis
    // selbst ein — das erklärt später, warum ein Agent Details vergessen hat.
    zusammengefasst: ({ wer, istKoordinator, vorher, nachher, automatisch }) =>
      `Der Motor hat das Arbeitsgedächtnis ${istKoordinator ? 'des Koordinators' : `von „${wer}"`} zusammengefasst` +
      (automatisch ? ' (der Kontext lief voll)' : '') +
      (vorher != null
        ? ` — vorher ${vorher.toLocaleString('de-DE')} Tokens${nachher != null ? `, danach ${nachher.toLocaleString('de-DE')}` : ''}.`
        : '.'),
    pruefungBestanden: 'Prüfung bestanden.',
    pruefungNichtBestanden: 'Prüfung nicht bestanden.',
    pruefungOhneErgebnis:
      'Der Prüfer hat kein eindeutiges Ergebnis geliefert — das gilt als nicht bestanden.',
    rueckfuehrung: (name, runde, gesamt) =>
      `Zurück zu „${name}" — Reparatur-Runde ${runde} von ${gesamt}.`,
    // Kanten-Ehrlichkeit (BAUPLAN 34): Was an den Kanten passiert, steht im
    // Ticker — und damit im Laufbericht.
    beanstandungenUebergeben: (anzahl, name) =>
      `${anzahl} ${anzahl === 1 ? 'Beanstandung' : 'Beanstandungen'} an „${name}" übergeben.`,
    beanstandungenNachgefordert: (name) =>
      `Urteil „nicht bestanden" ohne eine einzige Beanstandungs-Zeile — „${name}" liefert sie ` +
      'nach, bevor eine Reparatur-Runde verbraucht wird.',
    beanstandungenOhneMarken: (name) =>
      `„${name}" hat auch nach der Nachforderung keine Beanstandungs-Zeilen geliefert — ` +
      'weitergereicht wird der ganze Prüfbeleg.',
    beanstandungenTeilweise: (weggelassen) =>
      `${weggelassen} ${weggelassen === 1 ? 'Beanstandung passte' : 'Beanstandungen passten'} ` +
      'nicht mehr in die Rückmeldung — sie kommen in der nächsten Runde dran.',
    diffUebergeben: (name, dateien, zeilen) =>
      `Änderungen der letzten Runde an „${name}" übergeben: ${dateien} ` +
      `${dateien === 1 ? 'Datei' : 'Dateien'}, ${zeilen} ${zeilen === 1 ? 'Zeile' : 'Zeilen'}.`,
    diffGekuerzt: 'Der Änderungs-Überblick war zu lang — FlowForge hat ihn sichtbar gekürzt.',
    uebergabenZusammengefuehrt: (anzahl, etikett) =>
      `${anzahl} Lieferungen „${etikett}" zusammengeführt — der Block bekommt alle, ` +
      'keine geht still verloren.',
    uebergabeGekuerzt: (name, von, auf) =>
      `Übergabe von „${name}" gekürzt: ${von.toLocaleString('de-DE')} → ` +
      `${auf.toLocaleString('de-DE')} Zeichen (in der Mitte, das Ende bleibt vollständig).`,
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
      'Die Lauf-Session ließ sich nicht fortsetzen — es geht mit einer frischen Session weiter.',
    // Nachlauf-Chat (BAUPLAN 27): Chat-Zeilen im Ticker klar gekennzeichnet —
    // Reparaturen des Chats sind damit sichtbar wie jede Agenten-Arbeit.
    chatZeile: (text) => `Chat · ${text}`,
    // Co-Pilot (BAUPLAN 33): App-Werkzeuge und Sperren des Übersichts-Chats.
    appGestartet: 'App über den App-Tab gestartet.',
    appNeuGestartet: 'App über den App-Tab neu gestartet.',
    appGestoppt: 'App über den App-Tab gestoppt.',
    appPortBelegt: (port) => `App nicht gestartet — Port ${port} ist belegt (siehe App-Tab).`,
    appStartFehler: (grund) => `App nicht gestartet: ${grund}`,
    datenordnerGesperrt: 'Zugriff auf den Datenordner gestoppt — er ist für den Chat gesperrt.',
    uebersichtGesperrt: 'Werkzeug gestoppt — ohne offenes Projekt beantwortet der Chat nur Bedienfragen.'
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
    // Nachlauf-Chat (BAUPLAN 27): vor der ersten Änderung des Chats.
    beschriftungVorChatReparatur: 'Stand vor Chat-Reparatur',
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
  // Sonderläufe (BAUPLAN 30): Aufräum-Knöpfe der Karten-Seitenleiste.
  sonderlauf: {
    themenSortierenName: 'Themen sortieren',
    berichtMarke: 'Sonderlauf'
  },
  // Sortiermodus des Karten-Prüfers (BAUPLAN 30): klassifiziert alle Karten
  // ohne oder mit offensichtlich falschem Thema — ohne Code-Nachmessen — und
  // schlägt sie in EINEM Sammel-Dialog vor.
  agentenThemenSortieren: {
    auftrag:
      'Du bist der Themen-Sortierer: Du bringst Ordnung in die Themen der Projektkarten — ' +
      'ohne am Code nachzumessen und ohne Karten umzuformulieren. Antworte auf Deutsch. ' +
      'Du selbst veränderst NICHTS: keine Dateien, keine Programme oder Tests, keine ' +
      'direkten Kartenänderungen. Hol dir mit karten_uebersicht alle Karten samt ihren ' +
      'Themen (Karten ohne Themen-Marke haben noch keins). Jede Aufgaben-, Entscheidungs- ' +
      'und Wissens-Karte soll unter EINEM kurzen Thema stehen (Schlagwort, kein Satz). ' +
      'Bevorzuge die vorhandenen Themen — ein neues Thema nur, wenn wirklich keines ' +
      'passt; halte die Zahl der Themen klein (lieber sechs klare als zwanzig feine). ' +
      'Nimm dir vor: (1) alle Karten OHNE Thema, (2) Karten, deren Thema offensichtlich ' +
      'nicht zum Inhalt passt (nur bei klarem Fehlgriff, nicht bei Geschmacksfragen). ' +
      'Status- und Prüfkarten tragen kein Thema — lass sie weg. Dateien im Projektordner ' +
      'brauchst du dafür nicht zu lesen; die Kartentexte reichen. Schlage dann ALLE ' +
      'betroffenen Karten in EINEM einzigen Aufruf von karte_vorschlagen mit art "thema" ' +
      'vor (Feld themen: je Karte kartenId und thema; begruendung: nach welchem Muster du ' +
      'sortiert hast). Der Nutzer bekommt eine Tabelle, ändert oder lehnt einzelne Zeilen ' +
      'ab, und FlowForge wendet seine Entscheidung an. Gibt es nichts zu sortieren, machst ' +
      'du keinen Vorschlag und sagst das ehrlich. ' +
      'Dein Abschlusstext (3 bis 6 Sätze): welche Themen es jetzt gibt, wie viele Karten ' +
      'du vorgeschlagen hast und was der Nutzer davon übernommen oder abgelehnt hat.'
  },
  laufberichte: {
    ueberschrift: 'Laufberichte',
    keine: 'Noch keine Laufberichte.',
    unbekannterBlock: 'Block',
    // Paket & Sonderlauf (BAUPLAN 30).
    paketZeile: (titel) => `Paket dieses Laufs: „${titel.join('“, „')}"`,
    paketLeerZeile: 'Paket dieses Laufs: allein aus dem Feld — keine Aufgaben-Karten.',
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
      'startanleitung-fehlt': 'Startanleitung fehlte',
      // Rauchtest (BAUPLAN 35): Die App ließ sich nicht starten — kein
      // Fehlschlag des Bauers, aber auch kein sauberes „erledigt".
      'startanleitung-laeuft-nicht': 'Startanleitung lief nicht an'
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
    // Karten-Vorschläge (Zweit-Audit D-03): Die gespeicherte Zählung des
    // Karten-Prüfers steht sichtbar im Bericht — nicht nur in Ticker-Zeilen.
    kartenVorschlaegeZeile: (z) =>
      `Karten-Vorschläge: ${z.uebernommen ?? 0} übernommen · ${z.bearbeitet ?? 0} bearbeitet · ${z.abgelehnt ?? 0} abgelehnt`,
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): der Vorschlag des
    // Sessionendes samt Empfehlung und Begründung im Bericht.
    naechsterLaufZeile: (v) =>
      `Vorschlag fürs nächste Paket: ${v.empfehlung}` +
      (v.karten?.length ? ` — Karten: ${v.karten.join(', ')}` : ' — ohne Karten') +
      (v.begruendung ? ` (${v.begruendung})` : ''),
    // Karten-Zuteilung (BAUPLAN 29): wie die Karten verteilt wurden — je
    // Block mit Kartenzahl, wie im Ticker.
    kartenZuteilungZeile: (eintraege) =>
      'Karten verteilt: ' + eintraege.map((e) => `${e.block} ${e.anzahl}`).join(' · '),
    // Lokale Helfer-KI (Wunsch Georg, 13.08.2026): ihr Anteil im Bericht.
    // Seit BAUPLAN 20 zählen auch die Vorreparatur-Versuche mit — samt der
    // Frage, wie viele davon die Nachprüfung bestanden haben.
    // Seit BAUPLAN 31 mit dem Modell — die Zahlen gehören zu einem Modell.
    lokaleHelferZeile: (l) =>
      `Lokale Helfer-KI${l.modell ? ` (${l.modell})` : ''}: ${l.recherchen} ${l.recherchen === 1 ? 'Recherche' : 'Recherchen'} · ` +
      `${l.schritte} ${l.schritte === 1 ? 'Schritt' : 'Schritte'} übernommen — ohne Kontingent` +
      (l.gescheitert > 0 ? ` (${l.gescheitert} davon gescheitert)` : '') +
      // Trefferquote (BAUPLAN 23): wie viele Recherche-Fazite der Agent
      // wirklich übernommen hat — nur gezählt, wenn der Schalter an war.
      ((l.recherchenUebernommen ?? 0) + (l.recherchenVerworfen ?? 0) > 0
        ? ` · Fazite: ${l.recherchenUebernommen ?? 0} übernommen, ${l.recherchenVerworfen ?? 0} verworfen`
        : '') +
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
    // Modell je Block (BAUPLAN 36): welches Modell diesen Anlauf gearbeitet hat
    // — bei Mischung mit Anteilen, sonst schlicht der Name.
    modellZeile: (modelle) =>
      'Modell: ' +
      (modelle.length === 1
        ? modelle[0].modell
        : modelle
            .map((m) => `${m.modell} ${Math.round(m.anteil * 100)} %`)
            .join(' · ')),
    modellUnbekannt:
      'Modell: nicht vermerkt — ein Lauf vor Bauschritt 36 oder ein Anlauf ganz ohne Motor (Tor ohne KI).',
    // Compaction sichtbar (BAUPLAN 36): eigener Abschnitt im Bericht.
    zusammenfassungenLabel: 'Zusammenfassungen des Motors',
    erlaubt: 'erlaubt',
    abgelehnt: 'abgelehnt',
    automatischErlaubt: 'automatisch erlaubt (Automodus)',
    verlaufLabel: 'Verlauf',
    // Nachlauf-Chat (BAUPLAN 27): der Chat-Verlauf als eigener Abschnitt.
    chatLabel: 'Nachlauf-Chat',
    chatRolleDu: 'Du',
    chatRolleKi: 'Chat'
  }
}
