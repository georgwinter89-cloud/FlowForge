# FlowForge — Bauplan V1

Ursprung: 07.08.2026, fortlaufend gepflegt · Grundlage: [SPEC.md](SPEC.md) · Status: nach Angreifer-Prüfung
(2 Angriffslisten eingearbeitet; 21 Funde, davon 3 blockierend — alle aufgelöst.
Motor-Entscheidung durch Georg am 07.08.2026: Abo-Modus für Eigengebrauch, Details SPEC §2.
Leinwand-Entscheidung durch Georg am 07.08.2026: Schaubild aus Karten + Pfeilen als
Schritt 6 vorgezogen, parallele Zweige als Schritt 13 — Details SPEC §4.1)

**Regeln:** Jeder Bauschritt endet mit etwas, das Georg selbst anfassen und prüfen kann
(Alltagstest). Nach jedem Schritt gibt es eine installierbare Version. Ein Schritt pro
Bausession, nichts stapeln. Jeder Block-Arbeitsauftrag gilt erst als fertig, wenn er
einzeln im Ein-Block-Workflow erprobt wurde (nie im Ernstfall zum ersten Mal).

## Bauschritte

### 1 — App-Gerüst & Installer
Electron-App mit eigenem Fenster, deutsche Oberflächen-Hülle (Texte zentral), leere
Projektübersicht, Setup-Datei wird automatisch gebaut.
Bekannt & akzeptiert für V1: Der Installer ist unsigniert — Windows SmartScreen zeigt
eine Warnung, die Georg einmalig wegklickt (Signierung: V2).
**Alltagstest:** Georg installiert FlowForge per Setup-Datei (inkl. dokumentiertem
SmartScreen-Klick) und sieht die Projektübersicht.

### 2 — Projekte & Karten
Projekt anlegen mit freier Ordnerwahl; Projektansicht dreigeteilt (Karten links, Leinwand
Mitte, Bibliothek rechts — Leinwand/Bibliothek noch als Platzhalter); Karten aller vier
Sorten anlegen/bearbeiten/erledigen; harte Längengrenze; genau eine Status-Karte.
**Alltagstest:** Projekt anlegen, Karten pflegen; eine zu lange Karte wird abgelehnt.

### 3 — Motor-Anschluss & Durchstich
Motor-Schnittstelle definiert; erster Motor angebunden: die offizielle Claude-Code-CLI,
headless gestartet unter Georgs Login, mit **Umschalter Abo-Login/API-Schlüssel** von
Anfang an (SPEC §2). Von Anfang an Teil der Schnittstelle — nicht Deko, sondern
durchgesetzt:
- **Rechte-Durchsetzung:** Schreiben nur im Projektordner; alles außerhalb, sonstiges
  Internet und Unumkehrbares → Rückfrage (SPEC §7). Kein Agent läuft je ohne Schranken.
- **Verbrauchs-Messung:** Kontext-Füllstand wird aus den Token-Verbrauchsdaten des Motors
  berechnet (Fenstergröße ist bekannt; Anzeige als Toleranzbereich, nicht Punktwert).
  Dazu Kosten-/Kontingent-Zähler pro Lauf.
- **Stopp-Mechanik:** Sanft über die Unterbrechungs-Funktion des Motors; hart über
  Prozessbaum-Abbruch (Windows: `taskkill /T /F`) + danach automatisch zurück auf den
  letzten Sicherungspunkt.
- **Windows-Härtung:** absoluter Pfad zur CLI, Shell-Aufruf korrekt (.cmd-Shim),
  keine aufblitzenden Konsolenfenster.
Ein Ein-Block-Workflow (Mini-Bauer) läuft: Klartext-Liveticker, einklappbares
Rohprotokoll; Laufberichte werden abgelegt und als **einfache Liste** angezeigt.
**Alltagstest:** Georg startet den Mini-Workflow (erzeugt eine kleine Datei im
Projektordner), verfolgt den Liveticker, stoppt einmal sanft und einmal hart, und
provoziert eine Rechte-Rückfrage (Agent soll außerhalb des Projektordners schreiben).

### 4 — Sicherungspunkte & Wiederherstellen
Automatischer Sicherungspunkt nach jedem erfolgreichen Block; Liste in Alltagssprache;
Wiederherstellen-Knopf mit Vorschau.
Kollisionsschutz: Die Checkpoint-Verwaltung nutzt ein **eigenes, verstecktes Git-Verzeichnis
außerhalb des Projektordners** (Projekt darf selbst ein Git-Repo sein/werden); dem Agenten
ist Git-Benutzung per Sperre untersagt.
**Alltagstest:** Georg lässt den Mini-Bauer etwas ändern, stellt den Stand von vorher
wieder her und sieht die Änderung verschwinden — auch nachdem er zwischendurch die App
neu gestartet hat.

### 5 — Leinwand & Blockbibliothek
Blöcke per Drag & Drop zur geraden Kette stecken; braucht/liefert-Prüfung beim
Zusammenstecken; laufender Block wird auf der Leinwand hervorgehoben; Sperren-Mechanik
(nur-lesen, Pflichtfeld leer = Halt); Fehlschlag-Rückführung „zurück zu Block X" mit
Standard 2 Runden, danach Folgen-Frage (inkl. Option „Stand wiederherstellen" — die
Sicherungspunkte aus Schritt 4 existieren dann schon).
Getestet wird mit **bewusst trivialen Übungs-Blöcken** (Dummy-Arbeitsaufträge) — die
echten Arbeitsaufträge kommen in Schritt 8/9.
**Alltagstest:** Georg steckt selbst eine 3-Block-Kette und lässt sie laufen; ein
absichtlich strenger Übungs-Prüfer schickt den Lauf zweimal zurück, dann kommt die
Folgen-Frage.

### 6 — Leinwand als Schaubild
Die Kette wird zum Schaubild (SPEC §4.1): gerahmte Block-Karten, frei auf der Leinwand
platzierbar (Positionen werden gespeichert); Pfeile werden von Karte zu Karte gezogen
und bestimmen die Reihenfolge. Datenformat: Karten + Pfeile — vorbereitet auf spätere
Verzweigungen. Ein-Pfad-Regel: ein zweiter Pfeil aus derselben Karte wird mit
freundlichem Hinweis abgelehnt (parallele Zweige: Schritt 13). braucht/liefert-Prüfung,
Sperren, Rückführung und Lauf-Anzeige (laufende Karte hervorgehoben) funktionieren
unverändert.
**Alltagstest:** Georg ordnet seine Blöcke frei an, verbindet sie mit Pfeilen und lässt
den Workflow laufen; ein zweiter Pfeil aus einer Karte wird freundlich abgelehnt; nach
einem App-Neustart liegen alle Karten noch da, wo er sie hingeschoben hat.

### 7 — Agent-Karten-Brücke
Der Agent bekommt Werkzeuge, um Karten zu **lesen und zu schreiben** (anlegen, erledigen,
aktualisieren) — mit denselben harten Regeln wie für Menschen: Längengrenze durchgesetzt,
genau eine Status-Karte. Kartenvorauswahl beim Lauf-Start festgenagelt auf: **Status-Karte
+ offene Aufgaben-Karten, alles Weitere manuell per Drag & Drop.**
**Alltagstest:** Ein Ein-Block-Workflow liest die Status-Karte vor und legt eine
Aufgaben-Karte an; eine zu lange Agenten-Karte wird sichtbar abgelehnt.

### 8 — Erste echte Kette: „Feature hinzufügen"
Die Arbeitsaufträge Kontext laden, Paket schneiden, Angreifer (nur lesend), Bauer,
Prüfer (frische Session ohne Bauer-Kontext, eigene Tests, Rot-vor-Grün-Beleg) und
Sessionende — **jeder einzeln im Ein-Block-Workflow erprobt**, dann als Kette.
Ehrlichkeits-Notiz zur SPEC: „Prüfer ≠ Bauer" heißt technisch „frische Session ohne
Bauer-Kontext", nicht „anderes Gehirn" — wird in SPEC §4.3 so präzisiert.
**Alltagstest:** Georg lässt an einem Übungsprojekt ein kleines Feature bauen; im
Laufbericht sind Angriffsliste, Prüfbeleg und Rot-vor-Grün-Nachweis sichtbar.

### 9 — Spec-Interview, Diagnose & Frage an den Menschen
Gesprächsoberfläche für mehrrundige Dialoge (das Spec-Interview „grillt" wie eine Chat-
Ansicht innerhalb des Laufs); Frage-an-den-Menschen-Block (Einzelfrage, Folgen-Sprache);
Diagnose-Arbeitsauftrag (Ursache belegen, bevor etwas angefasst wird). Damit stehen die
Vorlagen **„Neue App starten"** und **„Bug jagen"**.
**Alltagstest:** Georg startet „Neue App starten", wird in mehreren Runden gegrillt, und
am Ende liegen Entscheidungs-, Aufgaben- und Status-Karten im Projekt.

### 10 — Startanleitung & „App starten"-Knopf
Startanleitung als Pflichtartefakt jedes Bau-Workflows (maschinenlesbar); „App starten"-
Knopf führt sie aus (Web-App → Browser; Kommandozeilen-Programm → Fenster; usw.).
**Alltagstest:** Georg baut mit „Neue App starten" eine Mini-App von der Idee bis zum
Klick auf „App starten" — ohne Kommandozeile.

### 11 — Sessions & automatischer Übertrag
Kontext-Füllstand live anzeigen; Übertrag bei ~85 % (bevorzugt an Blockgrenzen: Karten
aktualisieren, Workflow-Position samt Teilschritt notieren, frische Session, nahtlos
weiter); Übertragsgrenze pro Workflow (Zahl/unbegrenzt); Kontingent-/Kostenpausen-
Verhalten in Projekteinstellungen; Windows-Benachrichtigungen; Wiederaufnahme-Angebot
nach App-/Rechner-Neustart mitten im Lauf.
**Testbarkeit eingebaut:** Test-Schalter „Übertrag schon bei 10 %", und jeder Übertrag
hinterlässt ein Übertrags-Protokoll in Alltagssprache im Laufbericht.
**Alltagstest:** Georg setzt den Test-Schalter, startet einen mittelgroßen Auftrag, sieht
mindestens zwei Überträge im Protokoll und ein fertiges Ergebnis — ohne einzugreifen.

### 12 — Parallelität & Warteschlange
Bis zu 3 Läufe gleichzeitig in verschiedenen Projekten; pro Projekt nur ein schreibender
Agent; Warteschlange mit automatischem Anlauf. Sichtbarer Hinweis: parallele Läufe
vervielfachen den Verbrauch.
**Alltagstest:** Zwei Läufe in zwei Projekten parallel; ein dritter Start im selben
Projekt wartet sichtbar und startet von allein.

### 13 — Parallele Zweige auf der Leinwand
Verzweigen und Zusammenführen (SPEC §4.1): Von einer Karte dürfen mehrere Pfeile
ausgehen; gleichzeitig laufen dürfen mehrere lesende Blöcke, aber höchstens ein
schreibender (SPEC §5). Vor dem nächsten gemeinsamen Schritt werden Zweige
zusammengeführt (warten, bis alle fertig sind). Fehlschlag-Rückführung und Folgen-Frage
funktionieren auch im Verzweigten; die Live-Ansicht zeigt mehrere gleichzeitig laufende
Karten. Sichtbarer Hinweis: parallele Blöcke vervielfachen den Verbrauch.
**Alltagstest:** Georg lässt einen lesenden Block parallel zum Bauer laufen, sieht beide
gleichzeitig im Liveticker, und der Workflow führt danach beide Ergebnisse zusammen.

### 14 — Block-Editor mit KI-Assistent
Formular entlang der Block-Anatomie; Erstellungsassistent in 4 Schritten (inkl.
Probelauf-Vorschau); eigene Blöcke in der Bibliothek, bearbeiten/löschen.
**Alltagstest:** Georg erstellt per Assistent einen eigenen Block und nutzt ihn in
einer Kette.

### 15 — V1-Feinschliff
Zustände auf der Projektübersicht („läuft", „wartet auf Antwort", …); Laufberichte-
Ansicht ausgebaut (Filter, Details); Rechte-Standard sichtbar in Projekteinstellungen;
Politur.
**Alltagstest:** Georg führt einen kompletten Projektlebenslauf durch (neue App →
Feature → Bug) und findet keine Stelle, an der er Kommandozeile oder Dateisystem-
Handarbeit braucht.

### 16 — Session-Fortsetzung bei Wiederholungen
(Entscheidung Georg, 12.08.2026: Wiederholungsfälle desselben Blocks starten nicht
mehr kalt — der Kaltstart war Bauweise-Erbe, kein Prinzip, und kostet pro
Reparatur-Runde zwei volle Sessions Grundaufwand samt Neu-Einlesen des Projekts.)
Die Motor-Schnittstelle lernt **Fortsetzen**: Jede Motor-Session bekommt eine
Kennung; läuft derselbe Block erneut, setzt er seine **eigene** frühere Session
fort und bekommt nur den Zusatz nachgereicht. Genau drei Fälle:
- **Reparatur-Runde des Bauers** (Prüferkritik nachgereicht — er weiß noch, was
  er wo gebaut hat),
- **Nachprüfung des Prüfers** (nur die Beanstandungen — er kennt seine Tests noch),
- **Startanleitungs-Nachforderung**.
Leitplanken: Kein Block setzt je die Session eines **anderen** Blocks fort — der
erste Prüfer-Durchlauf bleibt frisch ohne Bauer-Wissen (SPEC §4.3). Ein
**Füllstands-Wächter** prüft vor dem Fortsetzen: Liegt die alte Session schon nahe
der Übertrags-Schwelle, lohnt Fortsetzen nicht → Kaltstart wie bisher. Kann eine
Session nicht wiederaufgenommen werden (App-Neustart, Kennung ungültig), fällt der
Fall still auf Kaltstart zurück; die Kennungen wandern dafür mit in den Laufstand.
Jede Fortsetzung ist ehrlich im Ticker und Laufbericht vermerkt („Session
fortgesetzt statt neu gestartet"). Der Karten-Kontext wird bei Fortsetzung nicht
erneut eingespeist (steht dort schon). Bewusst NICHT Teil dieses Schritts:
verschiedene Blöcke in einer Session zusammenlegen (z.B. Paket schneiden → Bauer)
— das berührt das Frische-Prinzip und wird danach getrennt entschieden.
**Alltagstest:** Georg provoziert mit dem strengen Übungs-Prüfer eine
Reparatur-Runde und sieht im Ticker „Session fortgesetzt statt neu gestartet" —
und im Laufbericht, dass die Reparatur-Runde deutlich weniger verbraucht hat als
der erste Durchlauf des Blocks.

### 17 — Kontext-Sparsamkeit der Agenten
(Entscheidung Georg, 13.08.2026. Befund aus dem Zugsimulator: Ein sauberer
Paket-Lauf kostete ~830.000 Tokens — nicht wegen des Briefings [das ist schlank],
sondern weil die Agenten alles selbst Gelesene und Geschriebene im
Arbeitsgedächtnis der einen Session anhäufen: der Bauer machte ~125
Werkzeug-Schritte, der Prüfer ~98, und im ganzen Lauf kam **keine einzige
Unteraufgabe** vor. Georgs Ansatz: Agenten sollen nur den Kontext tragen, den
sie wirklich brauchen — wie beim Delegieren an Unteragenten üblich.)
- **Unteraufgaben-Delegation in den Blockaufträgen:** Erkundungslastige Blöcke
  (Angreifer, Diagnose, Prüfer, Bauer beim Einlesen) werden angewiesen, Suchen
  und Lesen an Unteraufgaben zu delegieren — der Wegwerf-Helfer wühlt in seinem
  eigenen Kontext und liefert nur sein Fazit zurück. Jeder Auftrag erprobt im
  Ein-Block-Workflow (Bauplan-Regel); der Verbrauchseffekt wird am
  Zugsimulator-Projekt nachgemessen.
- **Lauf-Mappe statt Projekt-Mappe** (Entscheidung Georg, 13.08.2026): Die
  Prüfmappe `pruefung/` gehört zum Lauf, nicht zum Projekt — beim Start eines
  neuen Laufs leert FlowForge sie automatisch (wie die Arbeitsablage; die
  Wiederaufnahme eines unterbrochenen Laufs leert nicht). Der Prüfer baut
  seine Prüfungen frisch fürs aktuelle Paket, ohne Alttest-Ballast und ohne
  Anpass-Arbeit; Bilddateien in der Mappe sind verboten (hartes Nein). Die
  Gesamtprüfung schreibt sich ihre Prüfungen bei Bedarf frisch, statt alte
  abzuspielen. Wuchern wird damit strukturell unmöglich; ein Größen-Deckel
  ist nicht mehr nötig. Gezielte Wiederholungsprüfung alter Features: über
  Prüfkarten (Schritt 18).
- **Prüfmappen-Ansicht an der Prüferkarte** (Wunsch Georg, 13.08.2026): An
  jeder Prüf-Blockkarte auf der Leinwand ein aufklappbarer Bereich „Prüfmappe"
  (dasselbe Muster wie das Block-Ergebnis an der Karte), in Alltagssprache:
  welche Prüfungen der letzte Lauf hinterlassen hat — je Prüfung Name, Größe
  und Zuletzt-geändert. Alle Prüf-Blockkarten zeigen dieselbe Mappe; liegt
  kein Prüf-Block auf der Leinwand, gibt es keinen Blick hinein (bewusst
  akzeptiert — die Bau-Vorlagen enthalten immer einen Prüfer).
  Ehrlichkeits-Notiz: gezählt werden Prüf-Dateien, nicht einzelne Testfälle
  darin. Nur zum Nachlesen — bearbeiten darf die Mappe weiterhin nur der Prüfer.
**Alltagstest:** Georg lässt am Zugsimulator ein Paket bauen und vergleicht im
Laufbericht den Verbrauch je Block mit dem 830.000er-Lauf vom 12.08. — deutlich
weniger, und im Ticker tauchen Unteraufgaben auf. Ein Prüfer-Versuch, ein
Bild in die Prüfmappe zu legen, wird sichtbar abgelehnt. Nach einem zweiten
Lauf zeigt die Prüfmappen-Ansicht nur noch dessen Prüfungen — die alten sind
weg.

### 18 — Prüfkarten: gezielte Wiederholungsprüfung
(Idee Georg, 13.08.2026: Statt einer wachsenden Projekt-Prüfmappe entscheidet
der Nutzer selbst, was erneut geprüft wird — er zieht Prüfkarten auf den Prüfer.)
- **Neue Kartensorte „Prüfung":** Nach jeder bestandenen Prüfung legt FlowForge
  automatisch eine Prüfkarte an — Text in Alltagssprache: was geprüft wurde
  und woran „in Ordnung" erkennbar ist (übliche Längengrenzen). Dahinter
  bewahrt FlowForge die Prüfdateien dieses Laufs auf — im verwalteten Bereich
  **außerhalb des Projektordners** (wie die Sicherungspunkte): kein Agent
  sieht das Archiv, es kostet keinen Lauf Kontext.
- **Ziehen auf den Prüfer:** Der Nutzer zieht Prüfkarten auf eine
  Prüf-Blockkarte im Schaubild; sie hängen dort sichtbar an. Beim Lauf-Start
  legt FlowForge — **nach** der automatischen Leerung aus Schritt 17 — die
  aufbewahrten Prüfdateien der gezogenen Karten in die Prüfmappe, und der
  Prüfer führt sie zusätzlich zu seinen Paket-Prüfungen aus. Die Mappe ist
  damit nur die Werkbank des Laufs; das Gedächtnis ist das Archiv hinter den
  Prüfkarten, das die Leerung nie berührt. Passt eine alte Prüfung
  nicht mehr zum heutigen Code, passt der Prüfer sie an — die angepasste
  Fassung ersetzt die aufbewahrte, die Karte veraltet nicht.
- Prüfkarten erscheinen in der Karten-Seitenleiste (filterbar): „Was ist in
  diesem Projekt alles geprüft" ist ohne Dateiblick sichtbar. Löschen einer
  Prüfkarte räumt ihre aufbewahrten Prüfdateien mit weg.
**Alltagstest:** Georg baut ein Feature — die Prüfkarte erscheint von allein.
Beim nächsten Paket zieht er sie auf den Prüfer und sieht im Laufbericht, dass
Paket UND alte Prüfung geprüft wurden. Dann löscht er die Karte — sie
verschwindet samt aufbewahrter Prüfungen.

### 19 — Ein Lauf, eine Session: Blöcke als Agenten
(Entscheidung Georg, 13.08.2026. Anlass: der Kostenbefund am Zugsimulator —
ein Paket-Lauf kostete theoretisch ~21 $ [755.000 gezählte Tokens, 17,5 Mio.
Cache-Lesungen], vor allem durch fünf Session-Kaltstarts und Blöcke, die mit
wachsendem Kontext alles selbst erledigen. Georgs Klarstellung: „Jeder Block
sollte eigentlich nur ein neuer Agent sein" — die Frische-Session je Block war
Bauweise-Erbe aus Schritt 3, nie die gewollte Architektur. Ein Modell-Schalter
[Sonnet statt Opus] ist bewusst NICHT gewünscht.)
- **Eine Motor-Session pro Lauf:** Die Session bleibt über den ganzen Lauf
  offen (die Nachschiebe-Mechanik des Übertrags existiert schon). FlowForge
  bleibt der Steuerer: Es reicht Block für Block als Auftrag nach und behält
  Reihenfolge, Sicherungspunkte, Prüfer-Urteile, Reparatur-Runden,
  Startanleitungs-Pflicht und Folgen-Fragen fest in der Hand — der
  Koordinator in der Session verteilt nur Aufträge und sammelt Fazite ein.
- **Jeder Block = ein neuer Agent:** Der Koordinator erledigt selbst nichts,
  sondern startet je Block genau einen frischen Agenten (Unteraufgabe) mit
  dem Arbeitsauftrag; dessen Fazit ist der Abschlusstext des Blocks
  (Lieferungen/Übergaben wie bisher entlang der Pfeile durch FlowForge).
  Das Frische-Prinzip bleibt: Agenten erben kein Arbeitsgedächtnis — der
  Prüfer-Agent kennt das Bauer-Wissen weiterhin nicht (SPEC §4.3).
- **Harte Sperren pro Block-Agent:** „darf nur lesen", Prüfmappen-Besitz,
  Git- und Verwaltungsdatei-Sperren gelten heute pro Session — künftig
  erkennt FlowForge am Werkzeugaufruf (Unteraufgaben-Kennung), welcher
  Block-Agent zugreift, und setzt dessen Regeln durch. Der Koordinator
  selbst bekommt die engsten Rechte (nur delegieren, nichts anfassen).
  Diese Stelle wird einzeln erprobt, bevor die Kette umgestellt wird —
  ein Bauer mit Prüfer-Rechten wäre der schlimmste stille Fehler.
- **Bestehende Mechaniken:** Übertrag misst den Füllstand der Lauf-Session
  (der Koordinator bleibt schlank, Überträge werden selten). Reparatur-
  Runden laufen als neuer Agent mit der Prüferkritik im Auftrag — die
  Session-Fortsetzung aus Schritt 16 wird dadurch weitgehend überflüssig
  (die Lauf-Session läuft ja ohnehin weiter) und bleibt nur für die
  Wiederaufnahme nach App-Neustart. Parallele Zweige starten parallele
  Agenten; hakt das im Einzeltest, bleiben parallele Zweige übergangsweise
  getrennte Sessions (ehrlich im Ticker vermerkt).
- **Nachgeschärft im selben Schritt:** Die Blockaufträge verlieren die
  Kaltstart-Prosa („frische Session", eigenes Einlesen des Projekts) und
  werden auf kurze, fokussierte Agenten-Arbeit zugeschnitten; der
  Verbrauchseffekt wird am Zugsimulator nachgemessen.
**Alltagstest:** Georg fährt denselben Paket-Lauf am Zugsimulator wie am
13.08. und vergleicht die beiden Laufberichte: deutlich weniger Verbrauch und
theoretische Kosten als die ~21 $. Im Ticker ist sichtbar, dass der Motor nur
einmal startet und die Blöcke als Agenten laufen. Ein Sperren-Test (z.B.
Bauer-Agent versucht, in die Prüfmappe zu schreiben) wird weiterhin sichtbar
abgelehnt, und der Prüfer liefert unverändert seinen Rot-vor-Grün-Beleg.

### 20 — Lokale Vorreparatur: Reparatur-Runden erst lokal
(Idee Georg, 13.08.2026: Scheitert eine Prüfung, repariert zuerst die lokale
Helfer-KI nach den Hinweisen des Prüfers — erst wenn das zweimal scheitert,
übernimmt der Opus-Bauer. Reparatur-Runden sind die bestgeeignete
Schreibaufgabe für ein kleines Modell: Der Auftrag ist eng und konkret, und
die Nachprüfung des Prüfers ist der eingebaute Schiedsrichter.)
- **Opus sortiert vor:** Der Prüfer markiert je Beanstandung, ob sie
  „mechanisch reparierbar" ist (Tippfehler, falscher Wert, vergessener
  Randfall). Nur solche gehen an die lokale KI; Architektur-Probleme
  eskalieren sofort zum Opus-Bauer. Die Kosten-Wette lohnt nur bei
  ausreichender Trefferquote — jeder lokale Versuch kostet eine
  Opus-Nachprüfung; die Vorsortierung schützt vor teuren Fehlwetten.
- **Sicherungspunkt + Rückrollen:** Vor jedem lokalen Versuch legt FlowForge
  einen Sicherungspunkt an; scheitert die Nachprüfung, wird der Stand
  zurückgerollt, BEVOR Opus übernimmt — Opus soll reparieren, nicht erst das
  Gebastel der lokalen KI verstehen müssen.
- **Erstes Schreib-Werkzeug der lokalen KI, an kurzer Leine:** gezieltes
  Ersetzen (kein freies Datei-Schreiben), unter denselben harten Sperren wie
  der Bauer — nur Projektordner, Prüfmappe und Verwaltungsdateien tabu,
  durchgesetzt im FlowForge-Code. Eigenes Versuchs-Budget (2 je Rückführung);
  lokale Versuche verbrauchen KEINE regulären Reparatur-Runden des Workflows.
- **Ehrlichkeit:** Jeder Versuch steht im Ticker und im Laufbericht („lokale
  Reparatur, Versuch 1 von 2"), samt Ausgang der Nachprüfung. Nur aktiv, wenn
  die lokale Helfer-KI eingeschaltet und beim Laufstart erreichbar ist —
  sonst läuft die Rückführung wie heute.
- **Häkchen je Block** (Idee Georg, 13.08.2026): An jeder Block-Karte im
  Schaubild ein Abwahl-Häkchen „lokale KI erlaubt" (Standard: an, erbt den
  globalen Schalter). Abgewählt wird es als echte Sperre durchgesetzt —
  FlowForge lehnt lokal_recherchieren für diesen Block hart ab (erkennbar am
  laufenden Block, Mechanik aus Schritt 19) und streicht den Hinweis aus dem
  Auftrag. Ein Block ohne lokale KI bekommt auch keine lokale Vorreparatur.
  Keine Gegenrichtung (global aus, einzeln an) — ein Vorzeichen genügt.
**Alltagstest:** Georg fährt ein Paket, bei dem der Prüfer eine mechanische
Beanstandung findet: Im Ticker erscheint „lokale Reparatur, Versuch 1", die
Nachprüfung besteht, und der Laufbericht zeigt, dass keine Opus-Reparatur
nötig war. Ein Gegenlauf mit dem strengen Übungs-Prüfer zeigt die Eskalation:
zwei lokale Versuche, dann übernimmt sichtbar der Opus-Bauer.

### 21 — Lokale Entwürfe: einfache Schreibarbeit mit Opus-Abnahme
(Idee Georg, 13.08.2026: Die lokale KI soll auch einfache, wiederkehrende
Schreibarbeit übernehmen. Leitplanke aus der Brainstorming-Runde: Entwurf
lokal, Abnahme bei Opus — ungeprüft zählt nichts. Die Ersparnis kommt daher,
dass Gegenlesen [Eingabe-Tokens] deutlich billiger ist als Selberschreiben
[Ausgabe-Tokens]; sie trägt nur bei schablonenhafter Arbeit mit Vorbild.)
- **Neues Werkzeug `lokal_entwerfen`:** Der Block-Agent delegiert eng
  umrissene, schablonenhafte Schreibarbeit (der Auftrag nennt ein Vorbild —
  z.B. „eine weitere Prüfdatei nach dem Muster von X") an die lokale KI.
- **Entwürfe landen ausschließlich in der Arbeitsablage:** Das
  Schreibwerkzeug der lokalen KI ist hart auf `arbeitsablage/` begrenzt —
  die Wegwerf-Fläche, von Sicherungspunkten ausgenommen, am Laufende geleert.
  In Projektdateien oder die Prüfmappe schreibt sie hier nie (die gezielte
  Vorreparatur aus Schritt 20 bleibt der einzige direkte Eingriff, mit
  eigenen Leitplanken).
- **Abnahme durch den Block-Agenten:** Der Opus-Agent liest den Entwurf
  gegen und übernimmt ihn selbst an den Zielort — oder verwirft ihn und
  schreibt selbst. Sein Auftrag verlangt die ausdrückliche Abnahme; ein
  unbrauchbarer Entwurf ist ehrlich billiger Ausschuss, kein Schaden.
- **Ehrlichkeit:** „Lokale KI entwirft …" im Ticker; der Laufbericht zählt
  Entwürfe (übernommen/verworfen) in der Lokale-Helfer-Zeile mit. Das
  Häkchen je Block (Schritt 20) gilt auch fürs Entwerfen.
**Alltagstest:** Georg fährt ein Paket mit schablonenhafter Arbeit (z.B.
eine weitere Prüfung nach vorhandenem Muster): Im Ticker steht „Lokale KI
entwirft", der Block-Agent übernimmt den Entwurf nach Gegenlesen, und der
Laufbericht weist den Entwurf als übernommen aus.

### 22 — Lokaler Bauer: kleine Teilaufträge lokal bauen, Opus dirigiert
(Idee Georg, 13.08.2026: Wenn die lokale KI gut genug ist, übernimmt sie das
Coding — Opus bleibt Direktor: Verstehen, Zerlegen, Abnahme. Georgs
Kerngedanke: alles in möglichst kleine Aufträge für die lokale KI zerlegen —
kleine Aufträge heben die Trefferquote UND machen Fehlschläge billig, weil
jedes Teilstück sofort einzeln abgenommen wird statt erst am Ende aufzufallen.
Vorbedingung: Die Quoten aus Schritt 20/21 [Entwürfe übernommen, Reparaturen
gehalten] zeigen über mehrere echte Läufe, dass lokale Arbeit überwiegend
hält — sonst frisst das Prüf-Pingpong die Ersparnis. Stärkere Hardware
[z.B. zweite Grafikkarte, größeres Modell] verbessert die Quote, ersetzt
aber weder Messung noch Schiedsrichter.)
- **Lokale Subagents in Opus' Hand** (Klarstellung Georg, 13.08.2026): Der
  lokale Bauer ist KEIN von FlowForge gesteuerter Sonder-Kreislauf, sondern
  ein Werkzeug `lokal_bauen` des Opus-Agenten — dasselbe Muster wie
  lokal_recherchieren und lokal_entwerfen: Opus startet lokale Unteraufgaben,
  wann und wofür er es für richtig hält, wie heute seine Motor-Unteraufgaben.
  Jeder Aufruf ist ein frischer lokaler Agent; FlowForge setzt die harten
  Sperren wie immer am Werkzeugaufruf durch.
- **Opus zerlegt, lokal wird gebaut:** Der Bauer-Auftrag weist Opus an, das
  Arbeitspaket in möglichst kleine, einzeln prüfbare Teilaufträge zu
  zerlegen — jeder mit Fundstellen/Vorbild, eigenem Fertig-Kriterium und
  vorher festgenagelten Schnittstellen (welche Datei, welcher Funktionsname,
  was rein, was raus), damit die Teile zusammenstecken wie Blöcke
  (braucht/liefert nach innen gewendet) — und je Teilauftrag lokal_bauen zu
  rufen. Die Lehre aus 20/21 gilt als Regel: eng und konkret gewinnt.
- **Ehrliche Grenze der Kleinteiligkeit:** Einen trivialen Auftrag präzise zu
  beschreiben kostet fast so viel Opus-Arbeit, wie ihn selbst zu erledigen.
  Der Zerleger bündelt deshalb nach Zusammengehörigkeit (dieselbe Lehre wie
  bei der Paketgröße, SPEC §4.3) und behält Kleinst-Änderungen selbst.
- **Schreibrecht an derselben kurzen Leine wie der Bauer:** Die lokale KI
  baut Teilaufträge mit echtem Schreibrecht im Projektordner — unter den
  unveränderten harten Sperren (Prüfmappe, Verwaltungsdateien, Git). Vor
  jedem Teilauftrag ein Sicherungspunkt; scheitert die Abnahme, wird
  zurückgerollt (Mechanik aus Schritt 20 wiederverwendet).
- **Abnahme je Teilstück, Eskalation ohne Pingpong:** Opus liest jedes
  Teilstück sofort gegen (Gegenlesen ist billiger als Selberschreiben).
  Hält ein Teilauftrag nach 2 lokalen Anläufen nicht, baut Opus GENAU
  dieses Teilstück selbst und macht mit dem nächsten weiter. Der
  Prüfer-Block bleibt unverändert der Schluss-Schiedsrichter
  (Rot-vor-Grün fürs ganze Paket).
- **Ehrlichkeit:** Ticker je Teilauftrag („Lokale KI baut Teilstück 2 von
  5 …"); der Laufbericht zählt lokal gehaltene und von Opus übernommene
  Teilstücke in der Lokale-Helfer-Zeile — die theoretischen API-Kosten
  zeigen, ob sich die Wette rechnet. Häkchen je Block (Schritt 20) gilt;
  aktiv nur, wenn die lokale KI eingeschaltet und erreichbar ist.
**Alltagstest:** Georg fährt ein kleines Paket: Im Ticker ist sichtbar, wie
Opus zerlegt und die lokale KI Teilstück für Teilstück baut; der Laufbericht
zeigt, wie viele Teilstücke lokal gehalten haben — und an den theoretischen
Kosten, was der Lauf gegenüber reiner Opus-Arbeit gespart hat.

### 23 — Gläserner Helfer: lokale KI im Ticker nachvollziehbar
(Wunsch Georg, 14.08.2026: Im Liveticker sehen, was die lokale KI gerade
liest und tut — und ob Opus ihr Fazit wirklich berücksichtigt hat.)
- **Detail-Zeilen je Schritt:** Die Schritt-Meldungen der Helfer-Kreisläufe
  tragen Werkzeug UND Eingabe (lokaleHelfer.js reicht beides schon an
  aufSchritt durch) — der Ticker nennt künftig das Ziel: „Lokale KI · liest
  js/render.js ab Zeile 1200", „… durchsucht nach ‚tunnelDunkel'", „… sieht
  sich js/ an" (Pfade und Muster gekürzt). Gilt für Recherche, Entwurf,
  Reparatur und Bauen gleichermaßen; nur texte.js und die vier
  aufSchritt-Aufrufer werden angefasst.
- **Fazit-Annahme sichtbar — dasselbe Abnahme-Muster wie bei Entwürfen und
  Teilstücken, hinter eigenem Schalter** (Wunsch Georg, 14.08.2026): Neue
  Einstellung im Lokale-KI-Abschnitt, etwa „Trefferquote der lokalen KI
  erfassen (minimaler Token-Mehrverbrauch)". Ist sie an, bekommt der
  Block-Agent das Pflicht-Werkzeug `recherche_bewerten` nach jedem
  lokal_recherchieren: übernommen (Fazit fließt in seine Arbeit ein) oder
  verworfen (selbst nachrecherchiert), mit einem Satz Begründung. Ticker
  („Agent übernimmt das Fazit: …" / „Agent verwirft das Fazit: …") und
  Laufbericht (Lokale-Helfer-Zeile: Recherchen übernommen/verworfen) zählen
  mit — erst damit ist die Kosten-Wette der lokalen KI über alle drei
  Helfer-Arten ehrlich messbar (wichtig für die Hardware-Entscheidung
  2× RTX 5070 Ti). Ist der Schalter aus, gibt es weder Werkzeug noch
  Auftrags-Hinweis — kein Mehrverbrauch. Die Abnahmen bei Entwürfen und
  Teilstücken bleiben immer Pflicht (sie steuern Übernahme und Rückrollen,
  sind also Mechanik, keine Messung). Vorschlag Standard: an, solange die
  lokale KI ein Experiment ist — ohne Quote ist die Wette blind; Georg kann
  ihn jederzeit abwählen.
- **Bauer-Zusatz nachschärfen: ein Fehlschlag ist kein Urteil über alle**
  (Befund 14.08.2026, erster echter Lauf mit lokalem Bauer: Opus zerlegte in
  6 Teilstücke, gab genau eines lokal — Abnahme scheiterte am unmechanischsten
  Teilstück (Farbdesign) — und versuchte die übrigen 5 gar nicht mehr lokal.
  Quote damit unmessbar.) In den bauenAuftragZusatz: „Ein verworfenes
  Teilstück ist kein Urteil über die übrigen — versuche jedes Teilstück
  zuerst lokal; erst wenn mehrere hintereinander nicht halten, bau den Rest
  selbst." Erst damit entstehen echte Teilstück-Quoten für die
  Hardware-Entscheidung.
**Alltagstest:** Georg startet einen Lauf mit lokaler Recherche und liest im
Ticker Datei für Datei mit, was die lokale KI tut; danach steht sichtbar, ob
der Agent das Fazit übernommen hat, und der Laufbericht zählt beides. Im
Bauer-Lauf ist sichtbar, dass nach einem verworfenen Teilstück das nächste
trotzdem lokal versucht wird.

### 24 — Denk-Ansicht statt Rohprotokoll
(Wunsch Georg, 14.08.2026: Das Rohprotokoll aus JSON-Zeilen sieht kein Mensch
durch — an seine Stelle tritt das sichtbare Denken der gerade arbeitenden KI,
wie in Claude Code. Der Diagnose-Verlust der Rohdaten ist bewusst akzeptiert.)
- **Rohprotokoll entfällt:** das Ereignis art:'roh' (claudeCodeMotor.js),
  die Anzeige in Leinwand.jsx und die Knöpfe in texte.js; SPEC §6 wird
  nachgezogen.
- **Denk-Bereich im Lauf-Tab** (einklappbar wie bisher das Rohprotokoll):
  zeigt live die Denk-Texte der gerade arbeitenden KI, je Absatz mit
  Absender (Blockname, „Unteraufgabe" oder „lokale KI"), in gedämpfter
  Mono-Schrift. Neues Ereignis art:'denken' statt art:'roh'.
  - **Motor:** Denk-Blöcke der Assistent-Nachrichten aus dem SDK-Strom; das
    SDK kann Denk-Blöcke auch der Block-Agenten/Unteraufgaben weiterreichen
    (Option im Agent-SDK vorhanden, sdk.d.ts „Forward subagent text and
    thinking blocks"). Die Angriffsliste des Schritts klärt, ob dafür eine
    Option gesetzt werden muss und was sie kostet (Denk-Budget/Verbrauch —
    Denken ist Ausgabe-Tokens; im Zweifel Standardverhalten belassen und
    nur zeigen, was ohnehin im Strom liegt).
  - **Lokale KI:** das thinking-Feld der Ollama-Antworten (Denk-Modelle wie
    gpt-oss); Modelle ohne Denkfeld zeigen stattdessen ihren Antworttext,
    bevor die Werkzeuge ausgeführt werden — das „laute Denken" kleiner
    Modelle.
  - Nur live, nicht im Laufbericht (wie heute das Rohprotokoll).
**Alltagstest:** Georg klappt im Lauf den Denk-Bereich auf und liest mit, wie
Opus über den nächsten Schritt nachdenkt und was die lokale KI überlegt —
JSON-Zeilen gibt es nirgends mehr.

### 25 — Audit-Block: Rundum-Blick mit parallelen Prüfern
(Entscheidung Georg, 14.08.2026 — Planungs-Runde nach Abschluss von Schritt 24.
Der Audit-Block ist der letzte noch ausstehende Arbeitsblock aus SPEC §4.3 und
schließt die Lücke „Parallelität innerhalb von Blöcken" aus SPEC §4.1.)
- **Rundum-Blick übers ganze Projekt:** Das Audit ist ein manueller
  Ein-Block-Lauf zwischendurch (wie die Gesamtprüfung) — es beurteilt das
  Projekt als Ganzes, nicht das aktuelle Paket (dafür gibt es den Prüfer).
  Nicht Teil der Bau-Vorlagen; liefert „Befundliste", falls es doch in eine
  Kette gesteckt wird.
- **Drei feste Blickwinkel, intern parallel:** Der Audit-Agent startet drei
  Blickwinkel-Prüfer als Unteraufgaben — Fehler & Randfälle · Verständlichkeit
  & Wildwuchs · Sicherheit & Datenverlust — und bündelt ihre Funde. Dasselbe
  Muster wie alle Unteraufgaben (Sperren am Werkzeugaufruf, Schritt 19); die
  Angriffsliste der Bausession klärt, ob der Motor parallele Unteraufgaben
  eines Agenten wirklich gleichzeitig ausführt — falls nicht, laufen die drei
  nacheinander (ehrlich im Ticker), das Ergebnis ist dasselbe.
- **Volle Lesetiefe, bewusst teuer** (Entscheidung Georg, 14.08.2026 — gegen
  die Zügel-Empfehlung): Jeder Blickwinkel-Prüfer darf alles lesen, keine
  Stichproben-Zügel wie beim Angreifer. Dafür steht die Kosten-Folge sichtbar
  am Start im Ticker (ein Audit-Lauf kann mehrere hunderttausend Tokens
  kosten). Die lokale Helfer-KI bleibt als Recherche-Entlastung erlaubt
  (Häkchen je Block gilt wie überall).
- **Befunde werden Aufgaben-Karten:** Je wesentlichem Befund legt das Audit
  eine offene Aufgaben-Karte an (übliche Längengrenzen; Kleinkram bleibt im
  Abschlussbericht) — die Befunde rutschen damit automatisch in die
  Kartenauswahl der nächsten Bau-Läufe, Paket schneiden nimmt sie als
  Auftragsquelle. Mechanik: Das Audit ist nur-lesend für Dateien und Befehle,
  darf aber Karten anlegen — ein eigenes Kennzeichen am Block (analog
  „darfPruefen"), durchgesetzt am Werkzeugaufruf; die vollständige Befundliste
  steht im Abschlusstext.
- **Projektwissen für die lokale KI** (Idee Georg, 14.08.2026): FlowForge
  stellt jedem lokalen Auftrag (Recherche, Entwurf, Reparatur, Bauen)
  automatisch die Kartenauswahl des Laufs voran — Status-Karte, offene
  Aufgaben, manuell Gewählte — als Abschnitt „Projektwissen" im Auftragstext.
  Grund: Die lokale KI kann keine Rückfragen stellen (Einweg-Kreisläufe seit
  14.08.2026); was der Block-Agent nicht in den Auftrag schreibt, existiert
  für sie sonst nicht — Festlegungen aus Entscheidungs-Karten könnten
  übergangen werden. Kostet kein Kontingent, nur lokale Tokens (Karten sind
  auf 400 Zeichen gedeckelt — auch zehn Karten passen locker ins
  32k-Fenster). Bewusst KEIN direkter Blick in karten.json
  (Maschinenformat, Verwaltungsdatei-Tabu, Halluzinationsgefahr kleiner
  Modelle).
**Alltagstest:** Georg fährt ein Audit am Zugsimulator: Im Ticker sind die
drei Blickwinkel-Prüfer und der Kosten-Hinweis sichtbar; danach liegen neue
Aufgaben-Karten mit den wesentlichen Befunden in der Seitenleiste, und der
Laufbericht enthält die volle Befundliste. Ein Versuch des Audits, eine Datei
zu ändern, wird sichtbar abgelehnt. Zusätzlich startet Georg einen Lauf mit
lokaler Recherche in einem Projekt mit Entscheidungs-Karten und sieht am
Fazit (oder im Denk-Bereich), dass die lokale KI die Festlegungen aus den
Karten kennt.

### 26 — Karten-Prüfer: Projektgedächtnis am Code nachmessen
(Wunsch Georg, 14.08.2026 — direkt nach Schritt 25. Entscheidung Georg: Der
Block stellt keine Karte selbst richtig — jede Korrektur ist ein VORSCHLAG,
den der Nutzer je Karte einzeln entscheidet: „Übernehmen", „Vorschlag
bearbeiten", „Ablehnen".)
- **Neuer Arbeitsblock „Karten-Prüfer"** (nur lesend): liest alle Karten und
  misst jede am Code nach (Delegation wie üblich, lokale KI bevorzugt) — jedes
  Urteil braucht einen Beleg aus dem Code. Je veralteter Karte ein Vorschlag
  über das neue Werkzeug `karte_vorschlagen`: aktualisieren, abhaken, wieder
  öffnen, löschen — oder, bei Widerspruch zwischen Code und
  Entscheidungs-Karte, eine neue Aufgaben-Karte. Entscheidungs-Karten
  formuliert er nie um (Festlegungen trifft der Nutzer); Prüfkarten pflegt
  FlowForge — dazu gibt es keine Vorschläge (im Code abgewiesen).
- **Abnahme-Dialog im Lauf-Tab** (dasselbe Warte-Muster wie das Gespräch, samt
  Windows-Benachrichtigung und „wartet auf deine Antwort"): alter Kartentext,
  Vorschlag und Begründung nebeneinander; drei Knöpfe. „Vorschlag bearbeiten"
  öffnet die Felder zum Ändern (harte Längengrenzen), erst „So übernehmen"
  wendet an. Angewendet wird ausschließlich von FlowForge über die normalen
  Kartenfunktionen — der Agent ändert nie selbst; das Vorschlags-Werkzeug ist
  nur im Karten-Prüfer erlaubt (durchgesetzt am Werkzeugaufruf, Mechanik aus
  Schritt 19).
- **Ehrlichkeit:** Jeder Vorschlag samt Ausgang steht im Ticker; der
  Laufbericht zählt übernommen/bearbeitet/abgelehnt. Der Abschlusstext ist der
  Kartenbericht (liefert „Kartenbericht") — je Karte Urteil und Beleg.
**Alltagstest:** Georg macht in einem Übungsprojekt eine Wissens-Karte
absichtlich falsch, hakt eine erledigte Aufgabe ab, die es nie gab, und lässt
den Karten-Prüfer laufen: Für jede unwahre Karte erscheint ein Vorschlag mit
Beleg. Er übernimmt einen, bearbeitet einen vor dem Übernehmen und lehnt einen
ab — die Karten in der Seitenleiste ändern sich genau entsprechend, und der
Laufbericht zählt alle drei Ausgänge.

### 27 — Nachlauf-Chat: Gespräch mit der Lauf-Session
(Wunsch Georg, 14.08.2026. Entscheidung Georg: zwei Betriebsarten, im Chat
umschaltbar — Standard „nur lesen + Karten anlegen", auf Zuruf „darf
reparieren".)
- **Chat-Fenster nach dem Lauf** (im Lauf-Tab): ein normales Chat-Fenster mit
  dem Kontext des letzten Laufs — technisch die **fortgesetzte Lauf-Session**
  (resume über die Session-Kennung, Mechanik aus Schritt 16/19): Der Agent
  kennt Blöcke, Fazite und Verlauf des Laufs, ohne dass etwas nacherzählt
  werden muss. Ist die Session weg oder ihr Kontext über der
  Übertrags-Schwelle, startet stattdessen eine frische Session mit dem
  Laufbericht als Kontext — ehrlich im Chat vermerkt, kein stiller Ausweichpfad.
- **Eingaben:** mehrzeiliger Text (z.B. eine ganze Fehlermeldung) und
  **Screenshots** — einfügen per Strg+V aus der Zwischenablage (PowerShell,
  Terminal, App-Fenster …) oder über einen Datei-Knopf; Bilder gehen als Bild
  an den Motor, der sie selbst liest.
- **Zwei Betriebsarten, Schalter im Chat:** Standard ist nur-lesend (übliche
  Lese-Regeln; Karten anlegen erlaubt — „leg das als Aufgabe an" ist der
  Normalweg, der nächste Bau-Lauf arbeitet sie mit Sicherungspunkt und Prüfer
  ab). Mit dem Schalter **„Chat darf reparieren"** schreibt der Chat wie ein
  Bauer: Sicherungspunkt vor der ersten Änderung, übliche Rückfragen und
  Befehls-Einstufung; Git, Prüfmappe und Verwaltungsdateien bleiben tabu.
  Der Schalter gilt je Chat und steht sichtbar über dem Eingabefeld.
- **Ehrlichkeit:** Chat-Nachrichten kosten Kontingent — der Verbrauch steht
  sichtbar am Chat (dasselbe Muster wie im Lauf). Der Chat-Verlauf wandert als
  eigener Abschnitt in den Laufbericht des Laufs; Reparaturen erscheinen im
  Ticker und in der Sicherungspunkt-Liste. Läuft gerade ein Lauf im Projekt,
  ist der Chat gesperrt (ein Schreiber pro Projekt, SPEC §5).
**Alltagstest:** Georg fährt einen kleinen Lauf und öffnet danach den Chat. Er
fragt „warum hat der Prüfer gemeckert?" — die Antwort nimmt erkennbar auf den
Lauf Bezug, ohne dass er ihn nacherzählt. Er fügt mit Strg+V einen
PowerShell-Screenshot mit einer Fehlermeldung ein; der Chat erklärt die
Ursache und legt auf Zuruf eine Aufgaben-Karte an (sichtbar in der
Seitenleiste). Dann schaltet er „Chat darf reparieren" ein und lässt einen
Kleinstfehler direkt beheben: Vorher entsteht ein Sicherungspunkt, die
Änderung steht im Ticker, und der Chat-Verlauf steht am Ende im Laufbericht.

### 28 — Karten-Vorschlag fürs nächste Paket: Das Sessionende deckt den Tisch
(Idee Georg, 14.08.2026: Die Kartenauswahl für den nächsten Lauf kann die KI
vorschlagen — als Aufgabe des Sessionendes des vorherigen Laufs. Der Nutzer
entscheidet selbst: Vorschlag übernehmen, bearbeiten oder etwas Eigenes machen.)
- **Neues Werkzeug `naechster_lauf_vorschlagen`** (nur im Sessionende-Block
  erlaubt — dasselbe Freischalt-Muster wie karte_vorschlagen, durchgesetzt am
  Werkzeugaufruf): Der Sessionende-Agent kennt den Lauf gerade am besten (was
  fertig wurde, was offen blieb) und benennt die Karten-IDs, die der nächste
  Lauf bekommen sollte, plus **einen Satz Empfehlung in Alltagssprache**, was
  als Nächstes ansteht. Bewusst KEINE Automatik über Workflows: Der Satz darf
  eine Vorlage nennen („als Nächstes ‚Bug jagen'"), aber FlowForge baut nichts
  um und startet nichts — die Leinwand gehört dem Nutzer.
- **Gespeichert als Vorschlag, nie als Auswahl:** FlowForge legt den Vorschlag
  als eigene Verwaltungsdatei im Projektordner ab (für Agenten-Dateizugriffe
  gesperrt wie alle Verwaltungsdateien; nur über das Werkzeug beschreibbar) —
  er überlebt App-Neustarts. Nur existierende Karten-IDs zählen; inzwischen
  gelöschte fallen beim Anzeigen still heraus. Die festgenagelte
  Standard-Vorauswahl (Status-Karte + offene Aufgaben, SPEC §5) bleibt
  unverändert der Normalfall — der Vorschlag ist eine Einladung, kein neuer
  Standard.
- **Anzeige an der Kartenauswahl im Schaubild-Tab** (kein blockierender
  Dialog): eine Vorschlags-Zeile „Aus dem letzten Lauf empfohlen: …" mit der
  Empfehlung und den vorgeschlagenen Karten als Chips, dazu zwei Knöpfe —
  **„Übernehmen"** (die Kartenauswahl über dem Schaubild springt exakt auf den
  Vorschlag; danach wie gewohnt per Drag & Drop und × änderbar — das IST das
  Bearbeiten) und **„Verwerfen"**. Dritter Weg: einfach ignorieren und wie
  bisher selbst wählen — nichts zwingt.
- **Verfall statt Pflege:** Der Vorschlag gilt genau für den nächsten Lauf —
  ein Lauf-Start räumt ihn ab (übernommen oder nicht), ein neues Sessionende
  ersetzt ihn. Läufe ohne Sessionende (Ein-Block-Läufe, Audit, Karten-Prüfer)
  erzeugen keinen Vorschlag; alles läuft wie bisher.
- **Ehrlichkeit:** Der Vorschlag samt Empfehlung steht im Ticker und im
  Laufbericht des erzeugenden Laufs; der Sessionende-Auftrag verlangt eine
  kurze Begründung je Vorschlag (warum genau diese Karten).
**Alltagstest:** Georg fährt ein Paket mit Sessionende. Danach steht im
Schaubild-Tab die Vorschlags-Zeile mit Empfehlung und Karten-Chips. Er klickt
„Übernehmen" — die Kartenauswahl zeigt genau die vorgeschlagenen Karten —,
wirft eine per × raus und startet den Lauf; der Vorschlag ist danach weg. Beim
nächsten Mal klickt er „Verwerfen" und wählt selbst — die Standard-Vorauswahl
verhält sich exakt wie vor diesem Bauschritt.

### 29 — Alle Karten laden, Paket schneiden teilt zu
(Idee Georg, 14.08.2026: Ein Knopf lädt alle verfügbaren Karten in die
Kartenauswahl — und der Paket-Schneider entscheidet dann, welcher Agent
welche Karten bekommt. Heute bekommt jeder Block die komplette Auswahl in
den Auftrag; bei „alle Karten" würde das jeden Agenten und jeden lokalen
Helfer fluten. Beides gehört deshalb zusammen in einen Schritt.)
- **Knopf „Alle Karten hinzufügen"** an der Kartenauswahl im Schaubild-Tab:
  lädt Status-Karte, alle Entscheidungs- und Wissens-Karten und alle offenen
  Aufgaben in die Auswahl (erledigte Aufgaben und Prüfkarten bleiben draußen —
  Historie liefert der Laufbericht, Prüfkarten haben ihren eigenen Weg über
  den Prüfer). Daneben ein kleiner Knopf **„Standard-Auswahl"**, der auf die
  festgenagelte Vorauswahl zurückspringt; einzelne Chips bleiben wie gewohnt
  per × und Drag & Drop änderbar.
- **Neues Werkzeug `karten_zuteilen`** (nur in Auftragsquellen-Blöcken erlaubt
  — Paket schneiden und Diagnose; eigenes Kennzeichen am Block, durchgesetzt
  am Werkzeugaufruf wie immer): Der Agent teilt je nachfolgendem Block die
  Karten zu, die dieser wirklich braucht (Kartenliste je Blockname). FlowForge
  validiert hart: nur Karten-IDs aus der Kartenauswahl des Laufs, nur echte
  Nachfolger im Schaubild — Fantasie-IDs und fremde Blöcke werden mit klarer
  Meldung abgewiesen.
- **Wirkung ab der Zuteilung:** Jeder nachfolgende Block bekommt nur noch
  seine zugeteilten Karten in den Auftrag (die Status-Karte immer). Dasselbe
  gilt für das Projektwissen der lokalen Helfer-KI — das 32k-Fenster kleiner
  Modelle verträgt keine Kartenflut. **Rückfall ohne Bruch:** Wird das
  Werkzeug nicht benutzt oder ein Block nicht genannt, bekommt er wie bisher
  die volle Auswahl — kein Block steht plötzlich ohne Wissen da. Die
  Zuteilung wandert in den Laufstand (Wiederaufnahme nach Neustart).
- **Ehrlichkeit:** Die Zuteilung steht im Ticker und im Laufbericht
  („Karten verteilt: Bauer 4, Prüfer 2, Sessionende 3"), je Block mit
  Kartenzahl; der Auftrag von Paket schneiden/Diagnose erklärt das Werkzeug
  und verlangt sparsame Zuteilung (nur, was der Block wirklich braucht —
  Kontext ist der teuerste Teil des Laufs, Lehre aus Schritt 17).
**Alltagstest:** Georg klickt „Alle Karten hinzufügen" — die Auswahl über dem
Schaubild zeigt alle Karten — und startet „Feature hinzufügen". Im Ticker und
im Laufbericht steht sichtbar, wie Paket schneiden die Karten verteilt hat,
und die Folgeblöcke arbeiten mit ihrer Teilmenge. Ein Gegenlauf ohne den
Knopf verhält sich exakt wie vor diesem Bauschritt; „Standard-Auswahl"
springt jederzeit auf die alte Vorauswahl zurück.

### 30 — Ordnung: Karten-Gruppen & Themen, Herkunft, Blockbibliothek
(Erweiterungspaket 30–33, Planungs-Runde 15.08.2026 [Grilling + Angreifer-
Agent gegen den Entwurf, 25 Funde eingearbeitet]. Georgs Befund: Die
Karten-Seitenleiste ist bei echten Projekten zum endlosen Scrollen geworden —
keine Übersicht mehr; dasselbe droht der Blockbibliothek. Und man sieht einer
Karte nicht an, warum sie da ist. Entscheidung Georg: V1 wird weiter für den
Eigengebrauch vertieft; V2 kommt später als sauberer Neubau.)
- **Feste Karten-Gruppen, ausklappbar:** „Arbeit" (Status-Karte + offene
  Aufgaben) · „Wissen" (Entscheidungen + Wissen) · „Geprüft" (Prüfkarten) ·
  „Erledigt" (erledigte Aufgaben, standardmäßig eingeklappt). Ergibt sich aus
  der Sorte — kein neues Feld, nichts zu pflegen. Der bisherige Sorten-Filter
  bleibt.
- **Themen als zweite Ebene** in „Arbeit" und „Wissen": ein freies Schlagwort
  je Karte (**Pflicht** beim Anlegen — für den Nutzer im Formular, für den
  Agenten als Parameter `thema` von `karte_anlegen`, hart durchgesetzt;
  Längengrenze in kartenRegeln.js; Status- und Prüfkarten tragen kein Thema;
  das Bearbeiten alter Karten ohne Thema bleibt möglich). Die **vorhandenen
  Themen** stehen im Blockauftrag und in der Ablehnungsmeldung („thema fehlt
  — vorhanden: …") — bewusst NICHT in der Werkzeugbeschreibung (die ist je
  Motor statisch, und je Turn geänderte Beschreibungen brächen den
  Prompt-Cache). Regel für alle Agenten: primär einsortieren, ein neues Thema
  nur, wenn keines passt (Entscheidung Georg: kein 20. Thema); das
  Spec-Interview, das die ersten Karten anlegt, bekommt den Deckel „3–6
  Themen". Neue Karten aus dem Karten-Prüfer (Vorschlagsart „anlegen") und
  aus dem Chat tragen ebenfalls ein Thema. FlowForge normalisiert Groß-/
  Kleinschreibung und Leerzeichen (kanonische Schreibweise = die zuerst
  angelegte). Bestandskarten ohne Thema landen unter „Sonstiges". Der Nutzer
  kann ein **Thema umbenennen** (alle Karten des Themas; Umbenennen auf einen
  vorhandenen Namen legt zusammen) und eine **Karte per Drag & Drop** in eine
  andere Themengruppe ziehen. Angreifer-Fund: Themen-Pflicht trifft auch
  Agenten, die nichts davon wissen (Sessionende, Audit, eigene Blöcke) — die
  Ablehnungsmeldung mit Themenliste ist der Rettungsanker, kein Block darf
  daran scheitern.
- **Aufräum-Knöpfe in der Karten-Seitenleiste** (Entscheidung Georg,
  15.08.2026: Aufräumen gehört zu den Karten, nicht aufs Schaubild): zwei
  Knöpfe starten je einen **Sonderlauf** mit einem festen Ein-Block-Workflow
  im Hintergrund — Lauf-Tab, Ticker, Abnahme-Dialog, Sperren wie bei jedem
  Lauf, aber die Leinwand bleibt unangetastet. (1) **„Karten am Code
  prüfen"** = der Karten-Prüfer aus Schritt 26 (Einzeldialog je Vorschlag —
  Inhalts-Korrekturen entscheidet man einzeln). (2) **„Themen sortieren"** =
  neuer nur-lesender Sortiermodus des Karten-Prüfers (Kennzeichen am
  Sonderlauf): klassifiziert alle Karten ohne oder mit offensichtlich
  falschem Thema **ohne Code-Nachmessen** (bevorzugt vorhandene Themen) und
  schlägt sie in **einem Sammel-Dialog** vor: Tabelle aller betroffenen
  Karten mit vorgeschlagenem Thema, je Zeile änderbar, „Alle übernehmen" /
  je Zeile ablehnen — Angreifer-Fund: 60 Karten im Einzeldialog wären 60
  Recherchen und 60 pausierende Dialoge. Neue Vorschlagsart „thema" für
  `karte_vorschlagen` (Sammelform); Leitplanke ausdrücklich: **Thema setzen
  ist kein Umformulieren** — auch Entscheidungs-Karten dürfen ein Thema
  vorgeschlagen bekommen (SPEC §4.3 klarstellen; vorschlagWerkzeuge.js weist
  heute alles außer erledigen/öffnen für Entscheidungen ab). Der
  Karten-Prüfer-Block bleibt in der Bibliothek für Ketten. Notiz: Dieselbe
  Sonderlauf-Mechanik könnte später Audit und Gesamtprüfung als Knopf dienen.
- **Herkunft je Karte** (Wunsch Georg: „aus welchem Zweck ist sie
  entstanden"): FlowForge stempelt jede über die Karten-Werkzeuge angelegte
  oder geänderte Karte mit **Aufgabe(n) · Block · Lauf** — die Aufgaben sind
  die Aufgaben-Karten, an denen der Lauf gerade arbeitet (ein Paket kann
  mehrere umfassen → Liste; Titel als Schnappschuss gespeichert, falls die
  Aufgabe später gelöscht wird). Woher FlowForge das weiß: Die
  Auftragsquellen-Blöcke (Paket schneiden, Diagnose) **melden die
  Aufgaben-Karten ihres Pakets strukturiert** über ein kleines Werkzeug
  `paket_melden` (nur dort rückfragefrei — Freischalt-Muster aus Schritt
  28/29, im selben Werkzeug-Server wie `karten_zuteilen`; hart validiert: nur
  offene Aufgaben-Karten der Kartenauswahl; leer erlaubt, wenn das Wunsch-/
  Fehlerbild-Feld die Quelle war — der Validator kennt dafür die Feldwerte
  des Blocks), FlowForge merkt sie am Lauf und im **Laufstand** (Wiederaufnahme
  wie die Karten-Zuteilung). Der Karten-Server braucht dafür eine
  Hol-Funktion für den laufenden Block (wie der Zuteilungs-Server). Vom Nutzer
  angelegte Karten tragen „von dir", Karten aus dem Chat „vom Chat",
  übernommene Vorschläge „vom Karten-Prüfer", Prüfkarten „von FlowForge".
  Anzeige als **kompakte Kopfzeile** unter dem Titel: „geändert vor 2 Std. ·
  angelegt von Sessionende bei ‚Login bauen' (Lauf 14.08., 11:08)", klickbar
  zum Laufbericht; Änderungen zeigen „zuletzt geändert von …". Bei
  Ein-Block-Läufen ohne Paket steht nur Block + Lauf; alte Karten ohne
  Herkunft zeigen nur das Datum (angelegtAm/geaendertAm gibt es schon). Die
  Herkunft wandert **nie** in Aufträge oder karten_uebersicht (Kontext).
- **Blockbibliothek in Kategorien**, ausklappbar, nach der Aufgabe im Ablauf:
  Vorlagen · **Auftrag finden** (Spec-Interview, Paket schneiden, Diagnose,
  Frage an den Menschen) · **Bauen** (Bauer, Kontext laden) · **Prüfen**
  (Angreifer, Prüfer, Gesamtprüfung, Audit) · **Gedächtnis** (Sessionende,
  Karten-Prüfer) · Eigene · Übung (standardmäßig eingeklappt). Katalog-Blöcke
  sitzen fest in ihrer Kategorie (neues Feld am Katalog — nicht `kategorie`,
  das ist schon die Farbkategorie in blockKategorie()); **eigene Blöcke
  wählen im Block-Editor eine Kategorie** — eine vorhandene oder eine neue,
  global gespeichert wie die eigenen Blöcke (blockRegeln.js validiert und
  normalisiert das Feld; Altbestand ohne Feld → „Eigene"; Stepper und
  KI-Assistent kennen es); eigene Kategorien erscheinen als eigene Klappen.
- **Einklapp-Zustände** (Karten-Gruppen, Themen, Bibliotheks-Klappen) werden
  **je Projekt** gemerkt — im Datenordner je Projektpfad, NICHT in
  projekt.json (die ist Teil der Sicherungspunkte: jedes Auf-/Zuklappen machte
  sonst die Wiederherstellen-Vorschau schmutzig); Standard: „Erledigt" und
  „Übung" zu.
- **Kleinkram im selben Schritt:** (1) eigenes App-Icon (Blitz) statt des
  Electron-Standard-Icons — der Blitz existiert nur als Inline-SVG, also
  256-px-PNG erzeugen, `icon:` in electron-builder.yml, dazu BrowserWindow-Icon
  für die Taskleiste; (2) Prüfkarten per Drag & Drop in die Kartenauswahl
  werden freundlich abgelehnt (kontextAufnehmen prüft heute die Sorte nicht).
  Der automatische Übertrag hat in 47 Läufen nie ausgelöst — bewusst so
  gelassen; Georg testet ihn selbst per Test-Schalter.
- **Kein FlowForge-Fehler, aber ein Befund für die Testpraxis** (Angreifer,
  15.08.2026, verifiziert): Der vermeintliche Einstellungs-Verlust war ein
  Phantom — Claude-Code-Sessions laufen im Container der Claude-Desktop-App
  und sehen nur eine eingefrorene Kopie von Georgs Datenordner (Stand 13.08.).
  Georgs echte Einstellungen waren aktuell. Folge: Alles, was aus einer Session
  heraus gestartet wird (dev, CDP-Test, installierte exe), schreibt in einen
  Schatten-Datenordner — Alltagstests der Session und Georgs Welt sind getrennt.
  Für Schritt 31 (globale Metrik-Datei) heißt das: Georgs Zahlen entstehen nur
  in Georgs Instanz.
**Alltagstest:** Georg öffnet den Zugsimulator: Die Karten stehen in vier
Klappen, „Erledigt" ist zu; er klickt „Themen sortieren", bekommt die Tabelle
mit Vorschlägen, ändert eine Zeile und übernimmt alle — die Karten sortieren
sich unter Themen ein; er benennt ein Thema um und zieht eine Karte in ein
anderes. Nach einem Bau-Lauf zeigt jede neue Karte in der Kopfzeile, bei
welcher Aufgabe und welchem Block sie entstand, und der Klick springt zum
Laufbericht. Die Bibliothek zeigt die Blöcke in Klappen; ein eigener Block
bekommt eine neue Kategorie. Der Installer trägt das Blitz-Icon.

### 31 — Metriken: lokale KI und Motor über alle Läufe hinweg
(Idee Georg, 15.08.2026: Die Annahmequoten der lokalen KI je Modell und
Bereich sichtbar machen — als Grundlage für die Hardware- und Modellfrage —
und gleich dazu, was der Motor kostet. Befund 15.08.: 47 Läufe in 8 Tagen,
~13 Mio. Tokens, ~332 $ theoretische Kosten; lokale KI in 8 Läufen, null
Entwürfe, null Vorreparaturen — die Datenlage ist zu dünn für Entscheidungen.)
- **Metrik-Datei statt Karten:** FlowForge schreibt jedes Urteil über lokale
  Arbeit strukturiert in eine **globale Metrik-Datei im verwalteten Bereich**
  (nicht im Projektordner; Anhänge-Format, weil bis zu 3 Läufe parallel
  schreiben): Zeitpunkt, Projekt, Lauf, **Modell**, **Bereich** (Recherche ·
  Entwurf · Reparatur · Bauen), Ausgang (übernommen/verworfen, gehalten/nicht
  gehalten, gescheitert), Schritte. Die Urteile fallen ohnehin mechanisch
  (`recherche_bewerten`, `entwurf_abnehmen`, `teilstueck_abnehmen`,
  Nachprüfung) — Karten wären der falsche Ort (400 Zeichen, projektgebunden).
  Der Laufbericht bekommt zusätzlich das Modell in seiner Lokale-Helfer-Zeile.
  **Erst ab diesem Schritt** gezählt (Entscheidung Georg — keine Rückrechnung
  aus Ticker-Texten alter Berichte).
- **Motor-Auswertung** liest die Laufberichte aller bekannten Projekte (die
  Daten liegen dort exakt vor, auch für alte Läufe) — im Hauptprozess mit
  Zwischenspeicher (allein der Zugsimulator hat ~4 MB Berichte); Projekte,
  deren Ordner fehlt, werden mit Hinweis übersprungen („nur bekannte
  Projekte"). Schnitte: je **Blocktyp** (Anzahl, Ø Tokens, Ø theoretische
  Kosten — Reparatur-Runden und Nachprüfungen getrennt gezählt, sonst
  verzerrt der Durchschnitt), je **Workflow-Kette**, je **Projekt**, dazu ein
  **Zeitverlauf je Woche** als einfache Balken („wird es billiger?"). Berichte
  vor dem 13.08. haben keine Kostenangabe → ehrlich als „ohne Kosten"
  ausgewiesen. Im Abo-Modus als theoretische Kosten wie überall.
- **Zugang:** Knopf **„Metriken" in der Titelleiste** → globale Seite über
  alle Projekte (Filter nach Projekt); im Projekt ein **Tab „Metriken"**, der
  dieselbe Seite vorgefiltert zeigt — als eigener Baustein, nicht in
  Leinwand.jsx. Abschnitt 1: lokale KI (Tabelle Modell × Bereich → Anzahl,
  Quote, Schritte, Fehlschläge, Zeitraum). Abschnitt 2: Motor. Nur
  Nachschlagewerk — nichts davon wandert je in einen Auftrag. **SPEC §10
  klarstellen:** „keine Prozess-Selbstvermessung" meint das Life-OS-Übel im
  Agentenprozess (Bestandslisten, Nachweis-Register), nicht das
  Messinstrument des Nutzers.
**Alltagstest:** Georg fährt zwei Läufe mit lokaler KI (verschiedene Modelle)
und öffnet „Metriken": Die Tabelle zeigt je Modell und Bereich die Quote; der
Motor-Abschnitt zeigt, was ein „Feature hinzufügen"-Lauf im Schnitt kostet
und wie sich der Wochenverbrauch seit dem 07.08. entwickelt hat.

### 32 — App-Tab: Ausgabe in FlowForge und Prozess-Hygiene
(Befund Georg, 15.08.2026, Projekt Smarthome-Zentrale: Beim Serverstart
über „App starten" zeigte das Konsolenfenster Zeichensalat [kein UTF-8], und
der Port war belegt, weil ein Prüfer-Lauf einen Server gestartet und nie
beendet hatte — der lief unsichtbar weiter. Georg fühlte sich aufgeschmissen.
Dieser Schritt ist zugleich die Voraussetzung für den Co-Pilot [33], der die
Ausgabe der App lesen und die App bedienen können muss.)
- **Tab „App"** im Projekt (neben Schaubild · Lauf · Laufberichte ·
  Sicherungspunkte; eigener Baustein, nicht in Leinwand.jsx): zeigt die
  Startanleitung, **Start/Stopp/Neustart**, die **Ausgabe der laufenden App
  live** (Standard- und Fehlerausgabe; ANSI-Farbcodes gestrippt), Zustand
  (läuft seit … / beendet mit Code …), „Adresse im Browser öffnen" (mit dem
  heutigen Warten, bis die Adresse antwortet). Der „App starten"-Knopf im
  Kopf springt in den Tab und startet. Das externe Konsolenfenster entfällt
  (Entscheidung Georg) — damit auch die Eingabe für interaktive Programme:
  Startanleitungen müssen ohne Tastatureingabe auskommen (SPEC §8
  nachziehen). UTF-8-Realität (Angreifer): Node schreibt im Tab von selbst
  richtig; FlowForge setzt für den Kind-Prozess `PYTHONUTF8=1`/
  `PYTHONIOENCODING=utf-8` und startet Befehle über eine Shell mit `chcp
  65001`. Stopp immer per `taskkill /PID /T /F` (ein einfaches Beenden trifft
  nur die Shell, nicht den Server). **Port-Prüfung vor dem Start** (direkter
  Treffer fürs Symptom): Ist der Port der Startanleitungs-Adresse belegt,
  nennt FlowForge den Besitzer-Prozess und bietet an, ihn zu beenden.
- **Prozess-Hygiene nach Läufen:** Am Ende jedes Laufs — erfolgreich, sanft
  gestoppt oder hart abgebrochen — beendet FlowForge alle noch lebenden
  Prozesse, die aus dem Lauf heraus gestartet wurden, und vermerkt es ehrlich
  im Ticker („2 verwaiste Prozesse aus dem Lauf beendet"). Mechanik
  (Angreifer-Fund: ein Baumlauf ab dem Motor-Prozess reicht unter Windows
  nicht — die Bash-Shell des Agenten stirbt sofort nach `npm start &`, der
  Server behält nur eine tote Eltern-Kennung, und je Lauf gibt es mehrere
  Motor-Prozesse [Zweige, Übertrag]): FlowForge fragt **während des Laufs
  alle paar Sekunden** die Prozessliste ab und merkt sich transitiv jeden
  Prozess, dessen Elternteil zur bekannten Menge gehört — auch wenn der
  Elternteil längst tot ist —, je Prozess PID + Startzeit (gegen
  PID-Wiederverwendung); Rückfall-Heuristik: Befehlszeile enthält den
  Projektpfad. Dasselbe für den Chat (Schritt 33) bei „Neues Gespräch",
  Laufstart und App-Ende. **FlowForge-Ende räumt ab** (heute gibt es keinen
  before-quit-Handler; Node beendet unter Windows keine Kinder): laufende
  Motoren, Chats, die gestartete App und die Verwaisten-Liste werden beim
  normalen Beenden mit beendet — „nichts läuft unsichtbar weiter" gilt fürs
  normale Beenden, nicht für einen Absturz.
- **Sichtbarkeit als Rückfall:** Im App-Tab eine Liste „noch laufende Prozesse
  aus Läufen" (Name, Befehl, gestartet wann) mit Beenden-Knopf (Abgleich
  PID + Startzeit) — falls doch einmal etwas hängen bleibt. Die per „App
  starten" gestartete App steht dort nicht (sie hat ihren eigenen Stopp-Knopf).
**Alltagstest:** Georg startet die Smarthome-Zentrale über den App-Tab, liest
die Ausgabe mit korrekten Umlauten, öffnet die Adresse im Browser und stoppt
sie. Dann fährt er einen Lauf, in dem der Prüfer einen Server startet: Am
Lauf-Ende steht im Ticker, dass der Prozess beendet wurde, und der Port ist
frei — „App starten" funktioniert sofort danach. Beendet er FlowForge, während
die App läuft, ist danach kein FlowForge-Prozess mehr da.

### 33 — Co-Pilot: ein Chat für Bedienung und Projekt
(Wunsch Georg, 15.08.2026: „Einen Co-Pilot, den man immer fragen kann und der
darauf spezialisiert ist, dem Nutzer bei der Bedienung von FlowForge und
kleineren Problemen zu helfen." Entscheidung Georg: Der Nachlauf-Chat [27]
und der Co-Pilot werden **ein** Chat — kein zweites Chat-Fenster, kein
Code-Rattenschwanz.)
- **Ein Chat-Ort, überall:** Knopf in der Titelleiste öffnet ein seitliches
  Chat-Fenster (bei schmalem Fenster als Überlagerung — drei Spalten plus
  Chat passen nicht in 800 px) — in der Projektübersicht wie im Projekt. Im
  Projekt kennt er das offene Projekt; liegt ein Laufbericht vor, **setzt er
  die Lauf-Session fort** (heutiges Nachlauf-Verhalten samt aller
  Ausweichregeln aus Schritt 27; „frisch" heißt: der jüngste Bericht des
  Projekts), sonst startet er eine frische Session mit Projekt- und
  FlowForge-Wissen — welche Grundlage gilt, steht ehrlich im Chat. In der
  Projektübersicht (kein Projekt offen) beantwortet er nur Bedienfragen; sein
  Arbeitsordner ist dann der Datenordner, und der ist für seine Werkzeuge
  gesperrt (dort liegen die Einstellungen samt API-Schlüssel — heute wäre
  `Read` darauf rückfragefrei).
- **Was er weiß:** (a) **FlowForge-Bedienung** — die SPEC.md wird mit der App
  gebündelt (sie ist heute nicht im Build; als Extra-Ressource außerhalb des
  asar, Pfad je nach Paketierung) und dem Chat als **lesbare Datei**
  bereitgestellt — nicht als Systemtext (28.000 Tokens je frischer Session
  wären Verschwendung); der Systemtext trägt einen **beim Bauen erzeugten
  Abschnitts-Index mit Zeilenbereichen** und die Kurzregeln, damit er gezielt
  liest; kein zweites Bedien-Dokument (Doku-Regel). (b) **Das Projekt** —
  Dateien, Karten, Laufberichte, Startanleitung und die **App-Ausgabe aus dem
  App-Tab**; zur Not forscht er im Projektordner nach.
- **Was er darf:** dieselben zwei Betriebsarten wie der Nachlauf-Chat —
  Standard **nur lesen + Karten anlegen** (mit Thema, Herkunft „vom Chat");
  mit **„Chat darf reparieren"** schreibt er wie ein Bauer und **führt Befehle
  für dich aus** (`npm install`, eine Erstanmeldung anlegen …) —
  Sicherungspunkt vor der ersten Änderung, übliche Befehls-Einstufung und
  Rückfragen; Git, Prüfmappe und Verwaltungsdateien bleiben tabu. **Die App
  bedient er über eigene Werkzeuge** `app_starten` / `app_stoppen` /
  `app_ausgabe`, die den App-Tab aus Schritt 32 benutzen (Entscheidung Georg:
  derselbe Prozess, den du im Tab siehst — er überlebt das Chat-Schließen und
  wird nicht von der Prozess-Hygiene abgeräumt; ein per Befehl gestarteter
  Server würde den Aufruf zwei Minuten blockieren und beim nächsten Lauf
  sterben). **Während ein Lauf läuft:** lesend erlaubt (Bedienfragen, „was
  macht der Bauer gerade") — wirklich lesend: die Einstellung „nur-lesende
  Blöcke dürfen Befehle ausführen" gilt für den Chat dann NICHT, und es
  entsteht kein Sicherungspunkt mitten im Lauf (der fröre halbfertige
  Bauer-Änderungen ein); Reparieren gesperrt — ein Schreiber pro Projekt. Die
  heutige harte Chat-Sperre bei laufendem/wartendem Lauf und das Schließen
  des Chats beim Laufstart werden entsprechend umgebaut.
- **Verlauf je Projekt gespeichert** (eigene Verwaltungsdatei: in die
  Sperrliste des Motors und die Sicherungspunkt-Ausnahmen aufnehmen),
  überlebt Neustarts; Knopf „Neues Gespräch". Nach jedem Lauf hängt der Chat
  an einer neuen Lauf-Session — der Verlauf zeigt dann eine **sichtbare Marke**
  („ab hier: neue Lauf-Session vom 15.08., 14:32"; Entscheidung Georg): der
  ältere Teil bleibt zum Nachlesen, die KI kennt ihn nicht mehr und sagt das
  ehrlich, wenn man danach fragt. Gespräche nach einem Lauf wandern zusätzlich
  wie heute in den Laufbericht. Bilder per Strg+V/Knopf wie in Schritt 27.
- **Ehrlichkeit & Motor:** Chat-Nachrichten kosten Kontingent — Verbrauch
  sichtbar am Chat. Es antwortet das **Standard-Modell des Motors** (FlowForge
  setzt kein Modell — „Opus" wäre eine Behauptung); die lokale KI bleibt
  draußen (sie führt Werkzeuge nicht zuverlässig, Befund 14.08.2026) — V2.
- Nachzuziehen: SPEC §3.1 (Dateiliste), §6 (Chat-Ort, Sperre während Lauf),
  §9 (Titelleiste, Tabs); pruefungen/nachlaufChat.test.js.
**Alltagstest:** Georg öffnet in der Projektübersicht den Chat und fragt „Wie
ziehe ich eine Prüfkarte auf den Prüfer?" — die Antwort stimmt mit der
Oberfläche überein. Im Smarthome-Projekt startet er die App im App-Tab, sie
meldet einen Fehler; er fragt den Chat „warum startet das nicht?" — die
Antwort bezieht sich erkennbar auf die Ausgabe. Er schaltet „Chat darf
reparieren" ein und sagt „leg mir die Erstanmeldung an und starte neu" — der
Chat tut es (Sicherungspunkt, Ticker), die App läuft sichtbar im App-Tab.
Nach einem Bau-Lauf fragt er „warum hat der Prüfer gemeckert?" — die Antwort
kennt den Lauf; im Verlauf steht die Marke der neuen Lauf-Session.

### 34 — Kanten-Ehrlichkeit: vollständige Prüferkritik, Vor-Fazit, Fan-out ohne Verlust
(Erweiterungspaket 34–39, Planungs-Runde 15.08.2026: Auswertung des Videos „Die AI
Bubble findet gerade Graphentheorie für sich" [The Morpheus Tutorials — Harness
Engineering = Graphentheorie] durch 7 Bewertungs-Agents je Themenblock [Aufwand ×
Nützlichkeit gegen Code + SPEC, Stichworte Parallelität und Agents], einen Thinking
Agent [2 Alternativen je Punkt] und ein Interview mit Georg [7 Use-Case-Entscheidungen].
Grundlage waren die 14 Original-Diagramme des Autors, der OpenAI-Artikel zu Retained
Reasoning & Compaction und die Cline-Quelle — das Video hatte am 15.08. noch keine
Untertitel. Kernbefund: FlowForge IST schon der Harness aus dem Video [Graph mit
typisierten Kanten, frischer Agent je Block, harte Sperren, Versuchszähler, Follow-Up
über Karten, Audit als Review-Panel]; bewusst NICHT gebaut werden if-Weichen,
Verschachtelung, automatische Parallelisierung aus braucht/liefert, ein
selbstverbessernder Harness und ein Mehrheits-Controller — Programmierer-Konstruktionen,
teils gegen Georgs Entscheidung „Pfeile bestimmen die Reihenfolge". Reihenfolge des
Pakets: Entscheidung Georg — erst Kanten-Ehrlichkeit, dann Tor, Metriken, Modelle,
Runden-Ende, Audit.)
Befund (dreimal unabhängig gefunden, im Code bestätigt): FlowForge steuert die
Reihenfolge streng, ist aber an den KANTEN stumpf.
- **Prüferkritik vollständig statt 600 Zeichen:** `prueferKritik()` (lauf.js) schneidet
  heute den ganzen Prüfbeleg bei 600 Zeichen ab — die Beanstandungen stehen laut
  Prüfer-Auftrag aber am ENDE (nach „was geprüft" und Rot-vor-Grün-Beleg). Der
  Reparatur-Bauer, die Nachprüfung des Prüfers und die lokale Vorreparatur bekommen
  damit oft einen Torso ohne Beanstandung — das Anti-Pattern „Runde je Beanstandung"
  durch die Hintertür. Neu: FlowForge zieht **alle `BEANSTANDUNG (…)`-Zeilen**
  vollständig heraus (großzügige Grenze, z.B. 3.000 Zeichen) und reicht genau die
  weiter; ohne Marken Rückfall auf den bisherigen Text plus Ticker-Hinweis.
- **Kanten-Gate mit Nachforderung:** Urteil FEHLGESCHLAGEN ohne eine einzige
  Beanstandungs-Zeile → FlowForge fordert beim Prüfer kurz nach (dasselbe Muster wie
  die Startanleitungs-Nachforderung), statt eine Reparatur-Runde zu verbrennen.
- **Vor-Fazit in der Reparatur-Runde (Retained Reasoning light):** Der frische
  Bauer der Runde 2 bekommt neben der Kritik sein eigenes Fazit aus Runde 1 in den
  Auftrag („Dein Fazit aus der letzten Runde: was du wo gebaut hast und warum") —
  er erkundet nicht neu und trifft keine anderen Entwurfsentscheidungen; das
  Frische-Prinzip bleibt (kein Arbeitsgedächtnis, nur das Fazit). Ebenso für andere
  Rückführungs-Ziele.
- **Fan-out ohne Datenverlust:** Liefern mehrere parallele Vorfahren dasselbe
  Etikett (zwei Angreifer, Prüfer neben Angreifer), gewinnt heute still der
  nächstgelegene (`uebergabenText`). Neu (Entscheidung Georg): der Nachfolger bekommt
  **alle** Lieferungen gleicher Distanz nummeriert („Angriffsliste (1 von 2) von
  …"), der Ticker sagt es („2 Angriffslisten zusammengeführt"); die Regel „näherer
  Vorfahre gewinnt" bleibt für ungleiche Distanz. Kein eigener Synthese-Block —
  erst bei Bedarf.
- **Kürzung sichtbar und schema-bewusst:** Reißt eine Übergabe die 8.000 Zeichen,
  steht das im Ticker und Laufbericht („Übergabe von Prüfer gekürzt: 12.400 →
  8.000 Zeichen"), und die Marker-Zeilen am Ende (BEANSTANDUNG, PRUEFKARTE,
  PRUEFUNG) überleben — gekürzt wird in der Mitte, nicht hinten.
- Nachzuziehen: SPEC §4.1 (Rückführung: was die Rückmeldung enthält), §4.3
  (Übergaben: gleiche Etiketten, Kürzung), §5 (Reparatur-Runde mit Vor-Fazit).
**Alltagstest:** Georg fährt „Feature hinzufügen" mit einem absichtlich lückenhaften
Wunsch: Der Prüfer fällt durch, im Ticker steht „3 Beanstandungen an den Bauer
übergeben", der Bauer der zweiten Runde nennt in seinem Fazit erkennbar seine
Änderungen aus Runde 1; ein Prüfbeleg ohne Beanstandungs-Zeile löst eine sichtbare
Nachforderung aus. Zwei Angreifer parallel vor dem Bauer: der Ticker meldet „2
Angriffslisten zusammengeführt", der Bauer-Auftrag im Laufbericht enthält beide.

### 35 — Tor ohne KI: Prüfbefehl abspielen, Rauchtest, Baseline (0 Tokens)
(Entscheidung Georg: „von allein" — er trägt nichts ein; kein eigener Tor-Block auf
der Leinwand.)
- **Prüfbefehl je Lauf:** Der Prüfer hinterlässt neben seinen Tests einen
  maschinenlesbaren Startbefehl für die Prüfmappe über ein neues Werkzeug
  `pruefbefehl_setzen` (Vorbild `startanleitung_setzen`; Ablage als
  Verwaltungsdatei je Lauf, in Sperrlisten und Sicherungspunkt-Ausnahmen; der
  Prüfer-Auftrag verlangt es als Pflicht-Artefakt wie die Startanleitung beim Bauer).
- **Deterministische Nachprüfung:** In jeder Reparatur-Runde und nach jeder lokalen
  Vorreparatur führt FlowForge den Prüfbefehl **selbst** aus (Mechanik aus dem
  App-Tab: Shell mit UTF-8, ohne Eingabe, Zeitlimit, Prozess-Hygiene), bevor ein
  Prüfer-Agent startet: bleibt es rot, geht das Fehlerprotokoll sofort als
  Rückmeldung an den Bauer (0 Tokens); erst bei grün startet der Prüfer-Agent für
  die Nachprüfung der grundsätzlichen Beanstandungen (mechanische, testgedeckte
  gelten mit grün als erledigt). Ticker: „Prüfbefehl abgespielt: rot (2 Tests) —
  zurück zum Bauer ohne Prüfer-Agent".
- **Rauchtest der Startanleitung:** Nach dem Bauer startet FlowForge die
  Startanleitung einmal kurz (Befehl läuft an, Adresse antwortet — die Warte-Logik
  aus §8) und stoppt sie wieder; scheitert das, geht die Ausgabe als Rückmeldung an
  den Bauer, bevor der Prüfer eine Runde kostet.
- **Baseline „vorher schon rot":** Gibt es aus einem früheren Lauf einen
  aufbewahrten Prüfbefehl (analog Prüfkarten-Archiv), spielt FlowForge ihn vor dem
  Sicherungspunkt „Stand vor Lauf" einmal ab und merkt sich das Ergebnis; Bauer und
  Prüfer bekommen „vorher schon rot: …" als Übergabe, das Tor meldet nur NEU
  Kaputtes als Fehlschlag — Altlasten werden Aufgaben-Karte (Herkunft FlowForge),
  keine Reparatur-Runde.
- Nachzuziehen: SPEC §4.1 (Rückführung: Tor vor dem Prüfer-Agenten), §4.3
  (Prüfer-Artefakt Prüfbefehl, Baseline), §8 (Rauchtest), §3.1 (Dateiliste).
**Alltagstest:** Ein Bau-Lauf mit absichtlichem Fehler: Nach dem Bauer der zweiten
Runde steht im Ticker „Prüfbefehl abgespielt: grün — Prüfer prüft nur noch die
grundsätzlichen Beanstandungen" (oder „rot — zurück zum Bauer ohne Prüfer-Agent");
die Metriken zeigen weniger Wiederholungs-Tokens je Prüfer. Eine kaputte
Startanleitung wird vom Rauchtest gemeldet, bevor der Prüfer läuft.

### 36 — Sehen & Messen: Harness-Kennzahlen, Modell je Block, Sicht-Hilfen
(Entscheidung Georg: Kennzahlen UND Sicht-Hilfen; die Metriken sind sein
Messinstrument und die Voraussetzung für die Modell-Entscheidungen in Schritt 37.)
- **Harness-Kennzahlen auf der Metriken-Seite** (Abschnitt „Motor", Rohdaten
  liegen in den Laufberichten schon vor — rückwirkend auswertbar): Anteil der
  Läufe, in denen der Prüfer beim ersten Mal bestand; Reparatur-Runden je Lauf und
  je Kette; Rechte-Rückfragen und Folgen-Fragen je Lauf; Überträge je Lauf;
  Lauf-Ausgang je Kette und Kalenderwoche. Wie im Video: Score UND Kosten messen,
  nicht nur Kosten.
- **Modell je Block:** Der Motor summiert modelUsage heute über alle Modelle —
  künftig steht je Block das genutzte Modell im Laufbericht (Anteile bei
  Mischung), und die Metriken zeigen **Blocktyp × Modell** (Anzahl, Ø Tokens, Ø
  Kosten, Erstbestehen/Wiederholungen als „schafft es"-Signal) — dieselbe Tabelle
  wie für die lokale KI (Modell × Bereich). Alte Berichte zählen ehrlich als „ohne
  Modell".
- **Compaction sichtbar (Kleinkram im selben Schritt):** Der Motor wertet die
  Zusammenfassungs-Meldung des SDK (compact_boundary) aus — Ticker- und
  Bericht-Zeile in Alltagssprache („Der Motor hat das Arbeitsgedächtnis des Bauers
  zusammengefasst"), gezählt in den Kennzahlen; der Füllstand des gerade
  arbeitenden Block-Agenten erscheint als Hinweis neben dem Koordinator-Balken.
- **Sicht-Hilfen am Schaubild (kein Ablauf-Umbau):** die Fehlschlag-Rückführung
  als gestrichelter Rückpfeil vom Prüfer zum Ziel („bei Fehlschlag, 2 Runden");
  an den braucht-Chips „kommt von <Block>" bzw. „fehlt"; im Lauf der Warte-Grund
  im Ticker („Angreifer wartet — Bauer schreibt gerade" / „wartet auf Audit").
- Nachzuziehen: SPEC §3.2 (Modell je Block im Bericht), §3.4 (neue Schnitte),
  §4.1/§9 (Sicht-Hilfen), §6 (Compaction-Zeile).
**Alltagstest:** Georg öffnet „Metriken": Er sieht je Kette die Erstbestehen-Quote
und Ø Reparatur-Runden, je Blocktyp das Modell mit Kosten; im Schaubild führt ein
roter Rückpfeil vom Prüfer zum Bauer, am Bauer steht „Arbeitspaket ← Paket
schneiden"; während eines Laufs mit parallelen Zweigen erklärt der Ticker, worauf
ein Block wartet.

### 37 — Modellklasse je Block: frei wählbar, Voreinstellung im Katalog
(Entscheidung Georg: frei je Block wählbar — auch Bauer und Prüfer; Empfehlung
war „nur Nebenrollen fest". Folge, sichtbar gemacht: bei falscher Wahl mehr
Reparatur-Runden — die Kennzahlen aus Schritt 36 zeigen es.)
- **Feld `modell` je Katalog-Block** mit Voreinstellung (Bauer, Prüfer, Diagnose,
  Paket schneiden, Angreifer, Audit = Standard-Modell des Motors; Sessionende,
  Frage an den Menschen, Karten-Prüfer inkl. Sortiermodus, Kontext laden = sparsam)
  und **Auswahl an der Blockkarte** im Schaubild wie das Häkchen „lokale KI erlaubt"
  („Modell: Standard / sparsam (Sonnet) / sehr sparsam (Haiku)"; gespeichert je Karte
  in workflow.json neben lokaleKi); eigene Blöcke wählen ihre Klasse im Block-Editor
  (Validierung in blockRegeln/eigeneBloecke, Stepper und KI-Assistent kennen das
  Feld). FlowForge trägt die Wahl beim Agent-Aufruf ein (updatedInput.model im
  PreToolUse-Hook; SDK-Werte sonnet/opus/haiku/fable). Ticker: „Bauer läuft
  sparsam (Sonnet)"; Modell je Block im Laufbericht (Schritt 36).
- **Unteraufgaben-Modell** als Einstellung („Unteraufgaben der Block-Agenten: wie
  Block / sparsam"): Späher des Angreifers, Einlese-Helfer von Bauer/Prüfer/
  Diagnose bekommen im Hook ein billigeres Modell eingetragen — der Motor-Zwilling
  der lokalen Helfer-KI (Rückfall, wenn Ollama fehlt oder das Häkchen aus ist).
  Die drei Audit-Blickwinkel folgen der Klasse des Audit-Blocks (Georgs
  „bewusst teuer" betraf die Lesetiefe, das Modell wählt er jetzt selbst).
- **Nebenrollen billigst:** Der Koordinator der Lauf-Session (schreibt nur
  AUFTRAG/OK) läuft auf Haiku — dabei zwingend `agents.block.model` auf die
  gewählte Blockklasse setzen, sonst erben alle Blöcke das Billigmodell; die
  Fenster-Merk-Logik (kontextFensterFuerModell, modelUsage) muss das
  Koordinator-Modell vom Block-Modell trennen. Die Einmal-Frage des Block-Editors
  läuft auf Sonnet.
- Grenzen ehrlich: Im Abo-Modus zählt Kontingent, keine Dollar — Sonnet/Haiku
  entlasten es trotzdem; die lokale KI bleibt V2 als Vollmotor. Reihenfolge nach
  Schritt 36, damit die Wirkung messbar ist.
- Nachzuziehen: SPEC §2 (Modellwahl), §4.2 (Anatomie: Modell), §4.5 (Block-Editor),
  §5 (Koordinator-Modell), §6 (Chat unverändert: Standard-Modell).
**Alltagstest:** Georg stellt das Sessionende auf „sparsam", lässt einen Bau-Lauf
laufen: Ticker nennt „Sessionende läuft sparsam (Sonnet)", der Laufbericht zeigt je
Block das Modell, die Metriken zeigen Sessionende × Sonnet mit Kosten; ein eigener
Block bekommt im Editor die Klasse „sparsam" und läuft so.

### 38 — Runden-Ende: Follow-Up-Karten und „Paket zerlegen"
(Entscheidung Georg: Karte + Paket zerlegen; die Kleinkram-Regel [Stil-Funde als
Hinweis statt Runde] wurde nicht gewählt.)
- **Follow-Up-Karten mechanisch:** Kommt nach verbrauchten Reparatur-Runden die
  Folgen-Frage, legt FlowForge — ohne Agent — aus den offenen Beanstandungen
  Aufgaben-Karten an (je Beanstandung eine, 400-Zeichen-Grenze, Herkunft „von
  FlowForge", Thema aus dem gemeldeten Paket, Lauf-Verweis) — bei JEDER Wahl, auch
  Zurückstellen und Wiederherstellen (heute läuft dort kein Sessionende, die
  Beanstandungen stehen nur im Laufbericht, den nie eine Session liest). Der
  Dialog sagt es („der Rest ist als Aufgaben gesichert") und empfiehlt Weitermachen,
  wenn alle Rest-Beanstandungen mechanisch sind, sonst Zurückstellen.
- **Vierte Wahl „Paket zerlegen":** FlowForge stellt den Stand von vor dem Lauf
  wieder her und startet als **Sonderlauf** einen Paket-schneiden-Agenten mit
  Zusatzauftrag: „Dieses Paket ist an diesen Beanstandungen N-mal gescheitert —
  zerlege es in 2–4 unabhängige, einzeln prüfbare Aufgaben-Karten und lege sie an"
  (Karten anlegen freigeschaltet wie beim Audit; Prüferkritik + Arbeitspaket als
  Text im Auftrag; Reihenfolge: Lauf endet → wiederherstellen → Sonderlauf über
  die Warteschlange). Die neuen Karten liegen für den nächsten „Feature
  hinzufügen"-Lauf bereit; die Original-Aufgabe(n) werden mit Vermerk erledigt.
- Nachzuziehen: SPEC §4.1 (Folgen-Frage mit vier Wahlen, Karten-Sicherung),
  §3.1 (Herkunft FlowForge für Follow-Up-Karten), §4.3 (Sonderlauf paket-zerlegen).
**Alltagstest:** Ein Lauf scheitert zweimal am Prüfer; Georg wählt „Paket
zerlegen": Der Projektordner ist wieder wie vor dem Lauf, ein Sonderlauf legt 2–4
kleinere Aufgaben an (Herkunft sichtbar), die alte Aufgabe ist erledigt vermerkt;
wählt er stattdessen „Zurückstellen", stehen die offenen Beanstandungen als
Aufgaben-Karten in „Arbeit".

### 39 — Audit-Blickwinkel einzeln an/aus
(Entscheidung Georg: Häkchen je Blickwinkel — günstiger auf Wunsch, aber weniger
Rundumblick; die volle Lesetiefe je Blickwinkel bleibt.)
- Die drei Blickwinkel-Prüfer des Audits (Fehler & Randfälle · Verständlichkeit &
  Wildwuchs · Sicherheit & Datenverlust) sind heute fest im Auftragstext. Neu: **drei
  Häkchen an der Audit-Blockkarte** (Standard: alle an; mindestens eines muss an
  sein — Start-Prüfung), FlowForge setzt den Auftrag aus den gewählten Blickwinkeln
  zusammen (Feld-Mechanik mit Platzhaltern), der Ticker nennt beim Start, welche
  Blickwinkel laufen, und der Kosten-Hinweis am Start passt sich an; im
  Laufbericht steht die Auswahl. Ankreuz-Felder sind eine neue Feld-Art (bisher nur
  Text-Felder) — im Block-Editor nicht nötig (Katalog-Block).
- Nachzuziehen: SPEC §4.3 (Audit), §4.2 (Feld-Arten).
**Alltagstest:** Georg wählt am Audit nur „Sicherheit & Datenverlust" ab, startet:
Ticker „Audit mit 2 Blickwinkeln: Fehler & Randfälle, Verständlichkeit & Wildwuchs",
der Lauf ist sichtbar günstiger; mit allen drei Häkchen läuft es wie bisher.

## Reihenfolge-Begründung (kurz)
Motor-Durchstich früh (3), weil dort das größte technische Risiko liegt — inklusive
Rechte-Durchsetzung und Verbrauchs-Messung, den zwei größten Adapter-Risiken.
Sicherungspunkte (4) vor der ersten selbstgebauten Kette (5), damit das Sicherheitsnetz
existiert, bevor Georg den Agenten frei laufen lässt. Die Schaubild-Leinwand (6) direkt
danach, weil Georg täglich auf ihr arbeitet — je früher, desto weniger gewöhnt er sich
an eine Oberfläche, die wieder verschwindet. Erst die Brücke Agent↔Karten (7), dann
echte Arbeitsaufträge (8/9) — jede Vorlage steht auf einzeln erprobten Blöcken.
Parallele Zweige (13) erst nach echten Blöcken und Projekt-Parallelität (12): Der
Ablaufplaner für gleichzeitige Blöcke zahlt sich erst aus, wenn es Blöcke gibt, deren
Parallel-Lauf echte Zeit spart.
