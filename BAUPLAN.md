# FlowForge — Bauplan V1

Stand: 07.08.2026 · Grundlage: [SPEC.md](SPEC.md) · Status: nach Angreifer-Prüfung
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
**Alltagstest:** Georg fährt ein Paket, bei dem der Prüfer eine mechanische
Beanstandung findet: Im Ticker erscheint „lokale Reparatur, Versuch 1", die
Nachprüfung besteht, und der Laufbericht zeigt, dass keine Opus-Reparatur
nötig war. Ein Gegenlauf mit dem strengen Übungs-Prüfer zeigt die Eskalation:
zwei lokale Versuche, dann übernimmt sichtbar der Opus-Bauer.

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
