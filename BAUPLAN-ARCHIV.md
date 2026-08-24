# FlowForge — Bauplan-Archiv: Bauschritte 1–49

Abgeschlossene Bauschritte, ausgelagert am 17.08.2026 (1–32) und am 24.08.2026 (33–49),
jeweils auf Entscheidung Georgs. Abgeschlossen sind auch 50–54 — die stehen noch in
[BAUPLAN.md](BAUPLAN.md). Dies ist kein Verlauf — es sind die ursprünglichen Vorgaben, auf die SPEC.md, Code-Kommentare
und Commits weiter per Nummer verweisen („BAUPLAN 19"). Was heute gilt, steht allein
in [SPEC.md](SPEC.md); die offenen und jüngsten Schritte stehen in [BAUPLAN.md](BAUPLAN.md).

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

## Reihenfolge-Begründung der frühen Schritte
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

---

## Bauschritte 33–49 (ausgelagert am 24.08.2026)

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
- **Diff der bisherigen Runden + Vor-Fazit (Retained Reasoning light; Entscheidung
  Georg 15.08.2026 für die Diff-Alternative, geprüft am Code):** Der frische Bauer
  einer Reparatur-Runde bekommt neben der Kritik den **exakten Unterschied** „Das
  hast du in diesem Lauf bisher geändert" — von FlowForge aus den Sicherungspunkten
  gerechnet (Punkt beim ersten Start des Bauers ↔ Punkt „nach Bauer" der letzten
  Runde; `git.walk` mit zwei TREE-Bäumen wie die Wiederherstellen-Vorschau, dazu ein
  eigener kleiner Zeilen-Vergleich; kein git.exe nötig): Dateiliste (neu/geändert/
  gelöscht, +n/−m Zeilen) plus Ausschnitte der geänderten Stellen mit Umgebung,
  gedeckelt (~6.000 Zeichen; große Dateien nur „geändert ab Zeile N"), kumulativ
  über alle Runden des Laufs. `pruefung/` und `arbeitsablage/` bleiben draußen —
  die Prüfer-Tests liegen beim Rückführen uncommittet im Ordner (die Rückführung
  kehrt vor dem „nach Prüfer"-Punkt zurück, lauf.js) und wanderten sonst als
  „Bauer-Änderung" in den Diff. Dazu das **eigene Fazit aus der letzten Runde**
  (liegt als k.lieferung vor) als das „warum". Der Bauer erkundet nicht neu und
  trifft keine anderen Entwurfsentscheidungen; das Frische-Prinzip bleibt (kein
  Arbeitsgedächtnis). Ticker: „Änderungen der letzten Runde an den Bauer
  übergeben: 4 Dateien, 120 Zeilen"; bei Überlänge sichtbar gekürzt. Ehrliche
  Grenze: hat vorher ein nur-lesender Block per Befehl Dateien verändert
  (Einstellung „darf Befehle ausführen"), zählt das im Diff mit — FlowForge
  vermerkt „Ordner war beim Start des Bauers schon verändert". Ebenso für andere
  Rückführungs-Ziele; der Prüfer bekommt in der Nachprüfung denselben Diff
  (was sich seit seinem Urteil geändert hat).
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
  (Übergaben: gleiche Etiketten, Kürzung), §5 (Reparatur-Runde mit Diff + Vor-Fazit),
  §3.3 (Sicherungspunkte liefern den Diff).
**Alltagstest:** Georg fährt „Feature hinzufügen" mit einem absichtlich lückenhaften
Wunsch: Der Prüfer fällt durch, im Ticker steht „3 Beanstandungen an den Bauer
übergeben" und „Änderungen der letzten Runde an den Bauer übergeben: N Dateien";
im Laufbericht enthält der Auftrag der zweiten Runde die Dateiliste mit Ausschnitten
(ohne pruefung/) und das Vor-Fazit, und der Bauer bezieht sich erkennbar darauf,
statt neu zu erkunden; ein Prüfbeleg ohne Beanstandungs-Zeile löst eine sichtbare
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
**Reihenfolge geändert (Entscheidung Georg, 16.08.2026): Dieser Schritt läuft NACH
Schritt 42.** Die Follow-Up-Karten entstehen „aus den offenen Beanstandungen" — die
liest FlowForge heute per Textsuche aus dem Prüfbeleg (`beanstandungenHerausziehen`).
Schritt 42 ersetzt dieses Format mit hartem Schnitt durch gemeldete Felder; würde 38
vorher gebaut, wäre es sofort danach umzubauen. Nach 42 liegen die Beanstandungen
ohnehin einzeln vor (mit Einstufung und Fundort) — die Karten-Erzeugung wird dadurch
einfacher, nicht schwerer.
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

### 39 — gestrichen (Entscheidung Georg, 16.08.2026)
Geplant waren Häkchen, mit denen sich die drei Blickwinkel des Audits einzeln
abwählen lassen. Wird nicht gebaut: Wer einen Teil-Blickwinkel will, stellt sich
mehrere Prüf-Blöcke parallel ins Schaubild — das Paket 40–48 macht genau das
tragfähig. Die Nummer bleibt vergeben (Versionen sind an Bauschritte gekoppelt);
Version 0.39.0 gibt es nicht.

## Erweiterungspaket 40–48: Feste Form, Zuschnitt, Parallelität

(Planungs-Runde 16.08.2026 nach Abschluss von Schritt 35. Ausgangspunkt: Georgs
Alltagsbefund, dass „Paket schneiden" Aufgaben liegen lässt, und der Wunsch, den
Zuschnitt selbst vorzugeben. Grundlage: eine Prompt-Inventur des ganzen Projekts,
eine Web-Recherche zur 2026er Schema-Praxis [n8n, Copilot Studio, Claude Structured
Outputs] und eine Angriffsliste mit 24 Funden gegen den Entwurf — davon 6
blockierende, die die Reihenfolge unten bestimmen. Drei Entscheidungen Georgs gegen
die Empfehlung des Entwurfs: **volle Parallelität** statt sequenziellem Zuschnitt,
**harter Schnitt** bei den Marker-Formaten statt Übergangsphase, und die
Vollständigkeitsprüfung **gegen das gemeldete Paket** statt gegen die Kartenauswahl.
Leitgedanke des Pakets: Die Leinwand gibt die Struktur vor, der Agent füllt sie aus,
und FlowForge prüft das Ergebnis — statt es aus Fließtext zu erraten.)

### 40 — Kanten ohne Verlust: Fan-in unabhängig von der Distanz
(Angriffsfund 1 von 6, blockierend: Bauschritt 34 hat den Fan-out repariert, den
Fan-in nur halb.)
- `uebergabenText` (lauf.js) sammelt gleiche Etiketten nur bei **exakt gleicher
  Distanz**; ein näherer Vorfahre **ersetzt still** einen entfernteren. Setzt Georg
  einen Angreifer nur auf einen von drei Zweigen, ist dessen Bauer zwei Schritte vom
  Zusammenführungs-Block entfernt, die anderen einen — und seine Lieferung
  verschwindet **ohne Ticker-Zeile**. Genau der Verlust, den 34 abstellen sollte.
- Neu: Verdrängt eine Lieferung eine andere gleichen Etiketts, steht das im Ticker
  („Prüfbeleg von X wurde durch den näheren von Y verdrängt"). Für Blöcke mit dem
  Kennzeichen `fuehrtZusammen` (Schritt 47) gilt die Distanz-Regel gar nicht: sie
  bekommen **alle** Vorfahren mit passendem Etikett nummeriert.
- Muss zuerst: Schritt 43 (Empfänger im Auftrag) würde dem Block sonst zusagen, wohin
  seine Lieferung geht, während der Code sie wegwirft — ein stiller Fehlschlag, den
  SPEC durchgängig verbietet.
- Nachzuziehen: SPEC §4.3 (Übergaben: Verdrängung sichtbar, Ausnahme fuehrtZusammen).
**Alltagstest:** Georg baut zwei Zweige unterschiedlicher Länge, die beide dasselbe
liefern, und führt sie zusammen: Im Ticker steht, dass beide angekommen sind — heute
verschwindet einer wortlos.

### 41 — Instanz-Identität: Zusatznamen, und alles je Instanz statt je Projekt
(Angriffsfunde 2–4 von 6, blockierend. Der Sammelschritt, ohne den mehrere gleiche
Blöcke in einem Lauf nicht auseinanderzuhalten sind.)
- **Zusatzname an der Block-Karte:** freies Feld auf der Leinwand, die Sorte bleibt.
  Aus „Bauer" wird „Bauer · Datenbank". Der Name macht zwei Dinge: Er macht Instanzen
  unterscheidbar (technisch nötig) und sagt dem Zuschnitt, wonach zu schneiden ist
  (fachlich der Gewinn). Er wird **überall durchgereicht**, wo heute nur der
  Katalogname steht: Übergaben (`eintragMehrfach`), `nachfahrenNamen`, Ticker,
  Block-Ergebnisse, Laufbericht.
- **Metriken bleiben vergleichbar:** Katalogname und Zusatzname stehen **getrennt** im
  Bericht — sonst zerfällt „Blocktyp" in beliebig viele Typen und der Wochenverlauf
  vergleicht ab dann Äpfel mit Birnen (SPEC §3.4 verbietet Rückrechnung).
- **Was heute je Projekt oder je Lauf zählt, zählt künftig je Instanz:** der
  Prüfbefehl (`pruefbefehl.json` → je Prüf-Instanz, samt Pflichtprüfung und Archiv —
  sonst besteht ein Prüfer die Pflicht, weil ein anderer gesetzt hat, und das Tor aus
  35 urteilt über einen fremden Zweig), die Prozessgruppen von Tor und Rauchtest
  (`'tor:' + projektPfad` → je Instanz, sonst erschießt ein fertiger Testlauf den
  laufenden des anderen und erzeugt ein falsches Rot), die Prüfmappen-Unterordner
  (je Prüfer einer — **und `pruefungenArchivieren` muss auf den eigenen Unterordner
  eingeschränkt werden**, sonst archiviert jeder Prüfer die Tests aller hinter seiner
  Prüfkarte), das Reparatur-Runden-Budget (heute ein Zähler für den ganzen Lauf → je
  Rückführungs-Ziel) und die Nachforderungs-Budgets für Startanleitung und Rauchtest
  (heute je Lauf → je Block).
- Ein geänderter Zusatzname muss den Laufstand ungültig machen (heute prüft die
  Wiederaufnahme nur Ketten-IDs und Pfeile).
- Nachzuziehen: SPEC §4.1 (Zusatzname), §3.4 (Metriken getrennt), §4.3 (Prüfbefehl
  je Instanz), §5 (Runden-Budget je Ziel).
**Alltagstest:** Georg legt zwei Prüfer hinter einen Bauer, benennt sie verschieden
und lässt laufen: Im Ticker und im Laufbericht sind beide unterscheidbar, jeder hat
seinen eigenen Prüfordner, und die Metriken zeigen weiterhin einen Blocktyp „Prüfer".

### 42 — Lieferschein: Blockergebnisse als geprüfte Felder (harter Schnitt)
(Entscheidung Georg, 16.08.2026: harter Schnitt statt Übergangsphase. Grundlage:
2026er Schema-First-Praxis; Angriffsfund 5 von 6 hat die Bauform erzwungen.)
- **Der Rückkanal wird einheitlich.** Heute meldet ein Agent teils über Werkzeuge
  (21 Stück, hart validiert) und teils über drei Marker-Zeilen im Abschlusstext
  (`PRUEFUNG:`, `BEANSTANDUNG (…):`, `PRUEFKARTE:`), die FlowForge per Textsuche
  liest. An diesen drei Zeilen hängen vier tragende Mechaniken — Urteil,
  Reparatur-Runde, lokale Vorreparatur und das Prüfkarten-Archiv. Vergisst das Modell
  eine Zeile, fehlt sie einfach. Bauschritt 34 und 35 waren beide Reparaturen an
  dieser Naht.
- **Ein Werkzeug je liefert-Etikett**, nicht je Blocksorte: Die MCP-Server werden
  einmal je Motor gebaut und ein Lauf-Motor bedient alle Blöcke (BAUPLAN 19) — ein
  Werkzeug, das sein Schema je Block wechselt, ist damit unmöglich. Beim Laufstart
  steht das Schaubild fest, also registriert FlowForge genau die Werkzeuge, die
  **diese Kette** braucht. Freigeschaltet ist je Block nur das zu seinem Etikett
  passende; die anderen lösen die übliche Rechte-Rückfrage aus.
- **Gemeinsamer Rahmen für alle:** `fazit` (ein Satz für Ticker und Karte), `getan`,
  `offen`, `anmerkung` (das Freifeld gegen die Formular-Falle — was in kein Feld
  passt und der nächste Block trotzdem wissen sollte). Darunter je Etikett ein
  eigener Teil: Arbeitspaket (Ziel, Fertig-Kriterien, Fundstellen, nicht dabei),
  Prüfbeleg (Urteil als Auswahl, Beanstandungen mit Einstufung und Fundort,
  Rot-vor-Grün, geprüfte Kriterien, Prüfkarte), Umsetzungsbericht (je Kriterium wie
  umgesetzt, Dateiliste mit Art, Angriffsliste behandelt), Angriffs-/Befundliste
  (Funde mit Schwere und Fundort).
- **Drei Durchsetzungs-Ebenen:** Schema (Struktur, Typen, Auswahlwerte — Claudes
  strenger Modus kennt **keine** Längengrenzen, deshalb reicht es nicht), FlowForge
  im Code (Längen, Anzahl, Plausibilität — z.B. Urteil „fehlgeschlagen" ohne eine
  einzige Beanstandung), Kanten-Prüfung (deckt die Lieferung den Bedarf des
  Nachfolgers — ein Arbeitspaket ohne Fertig-Kriterien ist keins).
- **Bewusst locker bleiben** Spec-Interview, Kontext laden und Frage an den Menschen:
  Rahmen plus ein Freitext-Feld. Enge Schemata kosten Nuance bei explorativer Arbeit
  (mehrfach belegt in der Recherche); das Spec-Interview legt sein Ergebnis ohnehin
  als hart validierte Karten an.
- **Harter Schnitt:** Die Marker-Erkennung in `kantenRegeln.js` und
  `pruefkarten.js` entfällt, `pruefUrteil` und `beanstandungenEinstufen` lesen Felder,
  der synthetische Tor-Beleg aus Schritt 35 meldet direkt strukturiert. **Vorher
  umzustellen:** die Übungs-Prüfer (`pruefer-fair`, `pruefer-streng`) und jeder
  selbstgebaute Prüf-Block — sonst melden sie ins Leere. Ehrliche Folge: Läufe aus
  der Zeit davor lassen sich nicht mehr nachlesen wie heute.
- **Meldet ein Block nichts**, greift das erprobte Nachforderungs-Muster (einmal je
  Block), danach gilt der Block als fehlgeschlagen — es gibt keinen Rückfall mehr auf
  den Abschlusstext. Nach einem Übertrag ersetzt die Meldung des Nachfolgers die des
  unterbrochenen Vorgängers.
- Nachzuziehen: SPEC §4.3 (Übergaben als Felder), §4.1 (Rückführung aus Feldern),
  §3.1 (Prüfkarte aus Feld), §6 (Anzeige strukturierter Ergebnisse).
**Alltagstest:** Georg fährt „Feature hinzufügen": Im Laufbericht steht der Prüfbeleg
als gegliederte Abschnitte statt als Textblock, jede Beanstandung mit Fundort. Ein
Prüfer, der sein Urteil vergisst, wird sichtbar nachgefordert statt still übergangen.

### 43 — Empfänger im Auftrag
(Setzt 40 und 41 voraus: Ohne verlustfreies Fan-in wäre die Zusage an den Block
unwahr, ohne Zusatznamen nicht eindeutig.)
- Acht Stellen im Blockkatalog nennen heute andere Blöcke namentlich („Dein
  Abschlusstext ist die Übergabe an den Prüfer", „das übernimmt der
  Sessionende-Block") — Annahmen über ein Schaubild, das dem Nutzer gehört. Liegt ein
  Bauer ohne Prüfer auf der Leinwand, schreibt er trotzdem für ihn.
- Neu: FlowForge stellt jedem Auftrag drei aus dem Schaubild gerechnete Angaben
  voran — die **Empfänger** (Block, Etikett, wozu), die **Kette** in einer Zeile und
  die **Position**. Quelle ist das Schaubild, nicht der Koordinator (der bleibt
  schlank, BAUPLAN 19). Kommt niemand, steht genau das da.
- **Formulierungsregel, verbindlich:** immer aus der Empfängersicht („Er misst deine
  Arbeit an den Fertig-Kriterien — schreib den Bericht so, dass er jedes bei dir
  findet"), nie als „danach kommt noch wer" — sonst schiebt der Agent Verantwortung
  weiter. Die Aufträge anderer Blöcke werden **nicht** mitgegeben (lädt zum
  Vorwegnehmen fremder Arbeit ein).
- **Nicht ersetzt werden Zuständigkeits-Grenzen:** „Projektkarten fasst du nicht an"
  ist keine Empfänger-Angabe und bleibt im Auftrag — sonst pflegen Bauer und Prüfer
  plötzlich Karten.
- Nachzuziehen: SPEC §4.3 (Auftrags-Vorspann).
**Alltagstest:** Georg baut einen Bauer ohne Prüfer dahinter und lässt ihn laufen: Im
Laufbericht steht im Auftrag „geht an niemanden — du bist der letzte Schritt", nicht
mehr die Behauptung, ein Prüfer käme.

### 44 — Zuschnitt: benannte Ziele, Datenvertrag, Vollständigkeit
(Georgs Ausgangsproblem. Entscheidung Georg: Vollständigkeit gegen das **gemeldete
Paket**, nicht gegen die Kartenauswahl — sonst feuerte die Prüfung bei jedem Lauf mit
vielen offenen Karten, obwohl Paket schneiden laut SPEC §4.3 bewusst nur
Zusammengehöriges nimmt.)
- **Zuteilung je Instanz:** `karten_zuteilen` adressiert heute per Blockname und gibt
  bei mehreren gleichnamigen Instanzen allen dieselbe Zuteilung. Mit den Zusatznamen
  aus 41 wird die Adressierung eindeutig.
- **Ein Paket je benanntem Ziel:** Paket schneiden liefert nicht mehr ein
  Arbeitspaket, sondern je Nachfolger eines — mit eigenen Fertig-Kriterien.
- **Datenvertrag als Teil des Pakets:** welche Dateien angefasst werden dürfen,
  welche Bausteine entstehen, was rein- und rausgeht. Derselbe Gedanke wie die
  festgenagelten Schnittstellen für lokale Teilaufträge (Schritt 22), eine Ebene
  höher. Die Dateiliste wird sofort als **Schreibsperre** durchgesetzt (Muster:
  Prüfmappe, Verwaltungsdateien) — auch solange noch nichts parallel läuft.
  Ehrliche Grenze, die in die SPEC gehört: Die Sperre greift an den
  Schreib-Werkzeugen, **nicht** an ausgeführten Befehlen (`npm run build` schreibt,
  wohin es will) und nicht am eigenen Schreibpfad der lokalen KI. Erst Schritt 46
  schließt diese Lücke.
- **Vollständigkeit:** FlowForge prüft, ob jede Aufgabe aus dem **gemeldeten Paket**
  (`paket_melden`) in mindestens einem Zuschnitt vorkommt und ob jedes benannte Ziel
  eines bekommen hat. Fehlt etwas, greift das Nachforderungs-Muster: Der Block läuft
  einmal kurz erneut und trägt nur nach.
- **Mitzunehmen aus Schritt 43:** Die Empfänger-Liste des Auftrags-Vorspanns ist als
  einzige seiner Angaben ungedeckelt (Kettenzeile und Nachfahren-Aufzählung sind es).
  Solange ein Block wenige Empfänger hat, ist das wahrer Inhalt; mit mehreren benannten
  Zielen hinter Paket schneiden wächst sie spürbar (gemessen: 15 Empfänger desselben
  Etiketts ≈ 3.600 Zeichen, in jedem Anlauf). Naheliegend ist, gleiche „wozu"-Sätze
  zusammenzufassen statt Empfänger wegzulassen — sie tragen die Verantwortungssprache.
- Nachzuziehen: SPEC §4.3 (Zuschnitt je Ziel, Datenvertrag), §4.1 (Vollständigkeit),
  §7 (Dateiliste als Sperre, samt Grenze).
**Alltagstest:** Georg legt drei benannte Bauer hinter Paket schneiden und startet:
Jeder bekommt sein eigenes Paket mit Dateiliste. Er nimmt eine Aufgabe ins Paket, die
der Agent übergeht — FlowForge fordert sichtbar nach. Ein Bauer, der außerhalb seiner
Dateiliste schreiben will, wird gestoppt.

### 45 — Sicherungspunkte je Schreiber
(Angriffsfund 6 von 6, blockierend — und die eigentliche Voraussetzung für 46. Der
Grund für die Ein-Schreiber-Regel ist nicht die Dateikollision, sondern der
**projektweite Rollback**.)
- `aufLetztenPunktZuruecksetzen` setzt den ganzen Ordner zurück, und ausgelöst wird
  das nicht nur bei Fehlschlägen: **jedes verworfene lokale Teilstück** rollt zurück
  (Schritt 20/22). Zwei parallele Bauer mit lokaler Helfer-KI zerstören sich damit
  gegenseitig — A verwirft ein Teilstück, B verliert seine seitdem geschriebene
  Arbeit, ohne Meldung. Disjunkte Dateilisten helfen dagegen **nicht**: Das
  Sicherungspunkt-System kennt keine Teilbäume.
- Neu: Ein Schreiber mit **Wirkbereich** (Dateiliste des Datenvertrags; beim Prüfer
  sein Prüfordner) bekommt seinen **eigenen Punkt-Strang** (eigener Zweig im
  versteckten Git-Verzeichnis). Der Strang ist ein reiner Zeiger — der Projektordner
  wird nie ausgecheckt und bleibt die Wahrheit. Am Blockende wird zu einem gemeinsamen
  Punkt zusammengeführt: ein Punkt mit mehreren Eltern und dem Baum des jetzigen
  Ordners, ohne Merge-Algorithmus und damit strukturell konfliktfrei. (Angreifer-
  Befund der Bausession: Ein echter Git-Merge wäre **nicht** konfliktfrei, weil alle
  Stränge sich einen Index teilen — die Disjunktheit der Dateilisten sagt nichts über
  den Inhalt der Strang-Bäume.) Ein Schreiber ohne Wirkbereich (altes Paket ohne
  Dateiliste) bekommt keinen Strang, ehrlich im Ticker.
- **Rollback als Umkehrung, nicht als Beschränkung:** Der Rückroll fasst alles an
  **außer** den Wirkbereichen der anderen Block-Instanzen. Eine Beschränkung auf die
  eigene Dateiliste ließe genau das stehen, was der Rückroll aufräumen soll — Befehle
  und der Schreibpfad der lokalen KI schreiben laut Schritt 44 an der Sperre vorbei.
- Der Diff aus Schritt 34 wird auf die eigene Dateiliste gefiltert, mit ehrlicher
  Zeile über das Weggelassene; der Prüfer bekommt ihn ungefiltert (sein Wirkbereich
  ist vom Diff ausgenommen).
- Nachgezogen: SPEC §3.3 (Punkt-Strang je Schreiber, Wirkbereich, Rückroll ohne
  fremdes Revier, Zusammenführung am Blockende).
**Alltagstest** (geändert in der Bausession — der ursprüngliche „zwei Bauer
nacheinander" wäre schon vorher grün gewesen, weil die Ein-Schreiber-Regel nie zwei
Bauer gleichzeitig laufen lässt und der Punkt vor jedem Teilstück den ganzen Ordner
sichert; der beschriebene Verlust setzt Gleichzeitigkeit voraus, die erst 46 bringt):
Georg fährt Bauer → Prüfer mit eingeschalteter lokaler KI und einer mechanischen
Beanstandung. Scheitert die Nachprüfung nach der lokalen Vorreparatur, bleiben die
Testdateien, die der Prüfer in der Nachprüfung frisch geschrieben hat, erhalten, und
der Ticker sagt, dass sie beim Zurückrollen unberührt blieben — vor 0.45.0 verschwanden
sie wortlos. Der Zwei-Bauer-Fall bleibt als Regressionsprüfung erhalten.

### 46 — Parallel bauen: die Ein-Schreiber-Regel öffnen
(Entscheidung Georg, 16.08.2026, gegen die Empfehlung des Entwurfs: voller Umbau
statt sequenziellem Zuschnitt. Der Entwurf riet zu 44 ohne Parallelität, weil dort
schon der ganze fachliche Nutzen liegt und die Parallelität nur Zeit spart.)
- SPEC §5 ist **bedingt** geöffnet: mehrere schreibende Blöcke gleichzeitig (Welle),
  wenn ihre Dateilisten aus dem Datenvertrag überschneidungsfrei sind. Überschneiden
  sie sich, weist `paket_melden` das schon beim Zuschnitt zurück — bevor ein Token
  fließt (nur für Ziele, die nebenläufig sind; Bauer A → Bauer B dürfen dieselbe Datei
  nennen). Die Überschneidungsrechnung ist das dritte Ende der Dateilisten-Rechnung
  (`dateilistenUeberschneidung`, browsertauglich in lieferschein.js).
- **Zwei Auslegungen der Bausession (Angriffsliste, 24 Funde):** (a) **Bauer und Prüfer
  laufen nie gleichzeitig** — nur Bauer∥Bauer (getrennte Listen) und Prüfer∥Prüfer
  (getrennte Prüfordner). Ein Prüfer, dessen Tests über den ganzen Ordner laufen,
  urteilte sonst über den Halbstand des Nachbarn und schickte den falschen Bauer
  zurück — derselbe Grund, aus dem der Bauplan Tor und Rauchtest hinter die Welle
  stellt. (b) **Ohne Datenvertrag keine Welle:** Ein Bauer ohne Dateiliste wartet, bis
  er allein schreibt (kein Vertrag, keine Trennung); der Ticker sagt jeden Warte-Grund
  samt überlappender Einträge.
- **Die Lücke aus 44 ist geschlossen — mit ehrlicher Grenze:** Für Blöcke in einer
  Welle werden sonst rückfragefreie Befehle (Entwickler-Werkzeuge) zur Rechte-Rückfrage
  (rein lesende bleiben frei); im Automodus wird sie automatisch erlaubt und steht so
  im Ticker — dort ist das eine sichtbare Meldung, keine Bremse (SPEC §7 sagt es).
  Der Schreibpfad der lokalen Helfer-KI (`lokal_bauen`, lokale Vorreparatur) hält die
  Dateiliste jetzt immer als Tabu-Liste, nicht nur in der Welle. Geschützte Bereiche
  werden je Werkzeugaufruf frisch gerechnet (vorher ein Schnappschuss vom Blockstart —
  der zweite Schreiber existierte für den ersten nicht).
- **Körnung Laufstand/Sicherungspunkt:** gebaut als Block-Körnung, nicht als
  „Welle als Ganzes": Der Punkt am Blockende sammelt das Revier der anderen noch
  laufenden oder nachlaufenden Schreiber **nicht** aus dem Arbeitsordner ein, sondern
  nimmt dort den Basis-Stand — „Nach Block A" trägt genau A's Arbeit, und B startet
  nach einem Absturz sauber auf „vor B". Fertig gilt ein Block erst, wenn Nachlauf und
  Zusammenführung durch sind (`fertigIds` folgen dem). Alle Sicherungspunkt-Operationen
  laufen je Projekt in einer Warteschlange (zwei Blöcke teilten sich sonst verschränkt
  einen Git-Index — gemessen: halber Punkt).
- **Folgen-Frage je Zweig:** Die Frage blockiert den Planer nicht mehr (sie ist ein
  Race-Teilnehmer wie ein Blockergebnis; mehrere können nacheinander offen sein).
  „Zurückstellen" endet nur diesen Zweig; „Stand wiederherstellen" setzt sofort und nur
  die Wirkbereiche der Zweig-Blöcke zurück (`wiederherstellenBereich`); ohne
  Datenvertrag im Zweig bleibt es beim ganzen Ordner am Laufende — der Dialog sagt
  vorher, was er trifft. Eine offene Frage belegt ihren Zweig: Ein überschneidender
  Bauer aus einer anderen Auftragsquelle wartet, bis sie beantwortet ist (Prüfer-Fund
  der Bausession — sonst setzte „wiederherstellen" seinen Halbstand still zurück). Ein
  harter Stopp mit mehreren Schreibern rollt jeden auf seinem Strang zurück.
- **Rauchtest nach der Welle:** Nachlauf-Phase — der Block wartet mit Status
  „nachlauf", FlowForge holt den Rauchtest nach, sobald kein Bauer mehr schreibt, vor
  dem nächsten Start; ein Nachlauf-Block belegt sein Revier weiter. Das Tor läuft
  ohnehin erst beim Start des Prüfers, und der startet nur ohne laufende Bauer.
- Nachgezogen: SPEC §5 (Welle, Nachlauf, Körnung), §4.1 (Folgen-Frage je Zweig,
  Warte-Gründe), §7 (Befehle in der Welle, Tabu-Liste), §8 (Rauchtest nach der Welle),
  §3.3 (Punkt ohne fremdes Revier, Bereichs-Wiederherstellung, Warteschlange), §4.3
  (Zuschnitt-Ablehnung).
**Alltagstest:** Georg legt hinter „Paket schneiden" drei Bauer mit Zusatznamen (etwa
„Bauer · UI", „Bauer · Daten", „Bauer · Doku") und lässt „Feature hinzufügen" laufen:
Im Liveticker steht „Welle: 3 Blöcke schreiben gleichzeitig", alle drei sind auf der
Leinwand gleichzeitig hervorgehoben, der Lauf ist deutlich kürzer als nacheinander.
Meldet Paket schneiden zwei Zuschnitte mit derselben Datei, weist FlowForge die
Meldung sichtbar ab, bevor ein Bauer startet; ein Bauer ohne Dateiliste wartet mit
Begründung. Ein Prüfer, der durchfällt, stellt seine Folgen-Frage, während der andere
Zweig weiterläuft; „Stand wiederherstellen" nennt vorher, was es trifft, und lässt den
anderen Zweig stehen.

### Zwischenschritt 0.46.2 — Rauchtest ehrlich, Startanleitung in der Welle, Prüfbeleg-Weiterreichung
(Befund Georg + Auswertung des Life-OS-Laufs vom 18.08.2026, 13:07 [Laufbericht
`2026-08-18T11-07-58-083Z.json`]: Beide Bauer der Welle bekamen „Startanleitung lief
nicht an", obwohl der Code lief — Port 3888 war durch Waisenprozesse aus den eigenen
Bauer-Tests belegt, die Startanleitung wurde in der Welle gegenseitig überschrieben,
und der Prüfbeleg des ersten Prüfers „kam bei niemandem an", obwohl ein Zweitaudit
dahinter stand. Gebaut in 0.46.2.)
- **Rauchtest sagt, warum:** `rauchtest()` liefert immer `{ geprueft, gruen, code,
  ausgabe, grund }`; bei Rot steht Fehlercode + letzte Ausgabezeile im Ticker
  („Rauchtest: rot (Code 1) — Error: listen EADDRINUSE … — „Bauer · UI" bekommt eine
  Nachbesserungs-Runde"), jedes Überspringen mit Grund; am Block-Ergebnis im
  Laufbericht `rauchtest: { gruen, code, ausgabe, zeile, grund, gemessenAn? }`, in der
  Berichts-Ansicht als Zeile mit aufklappbarer Ausgabe. **Nebenbefund beim Messen mit
  echten Prozessen:** Der Fehlercode des eigenen Abräumens (taskkill → 1) galt bisher als
  „stirbt mit Fehlercode" — jede weiterlaufende App war rot. Behoben: Der Stand VOR dem
  Abräumen zählt, `code === null` = „lief noch".
- **Port-Prüfung vor dem Rauchtest** (SPEC §8): `prozessZugehoerigkeit(pid, start,
  projektPfad)` (prozesse.js) → 'gruppe' | 'rest' | 'vermutlich' | null; 'gruppe'/'rest'
  desselben Projekts werden beendet (`aufPortFreiWarten` aus appProzess.js), getickert
  („Waisenprozess node.exe (PID …, „…") aus diesem Lauf beendet — Port 3888 war belegt")
  und als `abgeraeumt` gemeldet; 'vermutlich', fremd und FlowForge selbst → Grund
  `portFremd` mit Besitzer, kein Rot, keine Runde.
- **Startanleitung in der Welle:** `startanleitungSetzen(pfad, eingabe, { gesetztVon })`
  speichert `gesetztVon` in startanleitung.json (Laden reicht es durch) und liefert
  `vorher`; das Werkzeug bekommt `holeInstanz` (Chat: null) und meldet
  `{ art: 'startanleitung', anleitung, gesetztVon, vorher }`; lauf.js tickert das
  Überschreiben, wenn `vorher.gesetztVon` ein anderer Block ist, der gerade Revier belegt
  („„Bauer · UI" hat die Startanleitung von „Bauer · Daten" ersetzt: „npm start" → „node
  server.js""). Der Rauchtest läuft **einmal je Welle**: Jeder Bauer geht in den Nachlauf,
  `nachlaeufeAbarbeiten` misst einen Test für alle Wartenden; bei Rot bekommt der Setzer
  (`gesetztVon` ∈ Welle) die Runde, Rückfall der zuletzt fertig gewordene Bauer mit
  Ticker-Zeile; die übrigen bleiben „erledigt" ohne Etikett und Runde. Ein Bauer allein:
  wie bisher.
- **Prüfbeleg-Weiterreichung durch Logik (Entscheidung Georg, 18.08.2026):** Der
  Katalog-Prüfer (`pruefer`, nicht `gesamtpruefung`) hat `brauchtOptional: ['Prüfbeleg']`
  mit wozu-Satz („prüft eine vorliegende Prüfung nach, statt sie zu wiederholen
  (Zweitaudit) — nenne Stichproben und Fundorte so, dass er sie nachvollziehen kann")
  und einen Auftragssatz fürs Zweitaudit (Beleg nachprüfen statt alles wiederholen);
  damit erreicht der Prüfbeleg eines Prüfers den nächsten Prüfer dahinter (nummeriert,
  wenn mehrere), Chip und Vorspann sagen es. **Verdrängung durch Weiterverarbeitung** in
  `uebergabenAuswahl` (kettenRegeln.js), Reihenfolge: (1) `fuehrtZusammen` nimmt alles,
  (2) Weiterverarbeitung, (3) Distanz unter den Übrigen. Lieferungen tragen dafür
  optional `instanzId`, `braucht` (braucht + brauchtOptional des Lieferanten) und
  `vorfahrenIds` — ohne sie exakt das alte Verhalten; `verdraengt`-Einträge sind die
  Lieferung plus `grund: 'distanz' | 'weiterverarbeitung'` und `verdraengtVon`. Alle
  Aufrufer liefern die Felder (kettenRegeln `brauchtHerkunft`/`empfaengerLage`, lauf.js
  `uebergabenText`/`dateiListeFuer`). Ticker je Block und Etikett einmal („„Prüfbeleg"
  von Block 7 „Prüfer" ging in Block 9 „Zweitaudit" ein — bei Block 10 „Sessionende"
  zählt der von Block 9 „Zweitaudit"."); „näher im Schaubild" nur noch bei Distanz.
  Laufzeit-Grenze: Nur wer geliefert hat, verdrängt. Prüfungen:
  pruefbelegWeiterreichung.test.js (Regel, Regressionen, Chips/Vorspann, Ticker-Text),
  pruefbelegWeiterreichungLauf.test.js (Prüfer → Zweitaudit → Sessionende im echten Lauf).
- Nachgezogen: SPEC §8 (Rauchtest: Grund sichtbar, Abräum-Fehlercode kein Urteil,
  Port-Prüfung, einmal je Welle), §5 (Startanleitung in der Welle, `gesetztVon`,
  Überschreiben-Ticker), §4.3 (Prüfer brauchtOptional Prüfbeleg/Zweitaudit; Übergaben:
  Verdrängung durch Weiterverarbeitung), §3.2 (Rauchtest am Blockergebnis).
**Alltagstest:** Georg lässt den Life-OS-Workflow (zwei Bauer, zwei Prüfer, Zweitaudit,
Sessionende) noch einmal laufen. Vorher zwei Handgriffe am Schaubild: Am Zweitaudit
„Bei Fehlschlag zurück zu" auf einen Bauer stellen (ohne Wahl geht die Kritik an den
letzten Vorfahren — das wäre ein Prüfer); jede Prüfer-Karte zeigt jetzt den blassen Chip
„braucht: Prüfbeleg (falls da)" — am Zweitaudit steht daran „← Prüfer · A + Prüfer · B",
an den ersten Prüfern „← liefert keiner" (kein Mangel). Im Lauf: Kein Bauer trägt mehr
„Startanleitung lief nicht an", solange die App startet (auch nicht, wenn sie einfach
weiterläuft, bis FlowForge sie stoppt); schlägt der Rauchtest doch fehl, steht der Grund
mit Fehlercode im Ticker und am Blockergebnis, und nur ein Bauer bekommt die Runde. Der
Vorspann des ersten Prüfers nennt das Zweitaudit als Empfänger seines Prüfbelegs, das
Zweitaudit bekommt beide Prüfbelege nummeriert, und das Sessionende bekommt nur den des
Zweitaudits — mit Ticker-Zeile, warum.

### Zwischenschritt 0.46.4 — Veröffentlichung auf GitHub: Abo-Regel, README, Lizenz
(Entscheidung Georg, 19.08.2026, nach Recherche der Anthropic-Regeln. Befund: Die
Regel aus SPEC §2 vom 07.08. — „in jeder weitergegebenen Version ist der Abo-Modus
deaktiviert" — ist von der Lage überholt. Chronologie: Jan/Feb 2026 sperrt Anthropic
Abo-Token, die außerhalb der Claude-CLI direkt gegen die API laufen; 04.04.2026 wirft
es Drittanbieter-Harnesses wie OpenClaw aus dem Abo; im Mai kündigt es ein separates
SDK-Guthaben an, ausdrücklich auch für „third-party apps that authenticate with your
Claude subscription through the Agent SDK"; am 15.06.2026 pausiert es das mit dem Satz
„For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage
still draw from your subscription's usage limits. […] When we have an update, we'll
share it before anything takes effect." [Anthropic-Hilfeartikel „Use the Claude Agent
SDK with your Claude plan"]. FlowForge startet die offizielle CLI über das Agent SDK —
genau dieser Weg. Der ältere Satz der Legal-Doku [„does not permit third-party
developers to offer claude.ai login … including agents built on the Claude Agent SDK",
code.claude.com/docs/en/legal-and-compliance und agent-sdk/overview] steht noch, ist
aber durch die schriftliche Duldung vom 15.06. faktisch überholt. Restrisiko ist ein
Abrechnungs-, kein Verbotsrisiko: Anthropic will den SDK-Weg irgendwann getrennt
abrechnen [angekündigt: 200 $/Monat bei Max 20x] — mit Vorankündigung; der API-Modus
bleibt der Rückfall. Ehrlicher Zusatz: „Läuft" ist nicht „ist erlaubt" — aber hier
sagt der Anbieter selbst, dass es läuft und bis auf Weiteres so bleibt. Gebaut am
19.08.2026 — **nächste Session: 47.**)
- **Abo-Regel neu (SPEC §2):** Beide Modi bleiben; die Konstante `ABO_MODUS_ERLAUBT`
  bleibt `true`, auch in veröffentlichten Versionen. Statt der Deaktivierung: Beim
  ersten Start wählt der Nutzer den Motor-Modus (Abo-Login oder API-Schlüssel) — kein
  stiller Standard —, und beim Abo steht der ehrliche Satz dabei: „Läuft über dein
  Abo-Kontingent. Anthropic hat angekündigt, Agent-SDK-Nutzung künftig getrennt
  abzurechnen, und will vorher Bescheid geben — dann ist der API-Schlüssel der Weg."
  Die Einstellungen zeigen denselben Satz. Kein Verstecken, kein Schalter-Theater
  (Georg: „Jemand Cleveres würde einem Coding-Agenten sagen, er soll es im Code auf
  true setzen" — ein `false` wäre ein Schild, kein Schloss). Gebaut: `motorModus`
  ist bis zur Wahl leer (`STANDARD.motorModus: ''`); `einstellungenLaden` liefert
  `motorGewaehlt`, `motorBereit(einstellungen)` ist die eine Stelle für „darf der
  Motor starten?" (Lauf, Co-Pilot-Chat, Block-Assistent — vorher hatte der Chat gar
  keine Prüfung); `einstellungenSpeichern` lehnt eine leere Wahl ab
  (`fehlerModusFehlt`). Renderer: `Erststart.jsx` (über App.jsx, solange
  `motorGewaehlt` false; kein Abbrechen), Einstellungen ohne vorgewähltes Radio.
  Prüfung: pruefungen/erststartWahl.test.js.
- **README.md (Deutsch, kurz):** Was FlowForge ist und für wen (Nicht-Programmierer
  bauen Workflows aus Blöcken, die ein KI-Agent mit harten Sperren ausführt), was es
  nicht ist (Ein-Personen-Projekt, Windows, kein Support, keine Beiträge erwartet),
  wie man startet (Installer aus Releases; Motor = Claude Code CLI, gebündelt), der
  Abschnitt „Abo oder API-Schlüssel" mit der Chronologie oben und den zwei Zitaten
  (Legal-Doku und 15.-Juni-Update, mit Links), Verweis auf SPEC.md als Produktbeschreibung
  und BAUPLAN.md als Bauweg. Kein zweites Bedien-Dokument (Doku-Regel) — das README
  verweist, es erklärt nicht.
- **Lizenz:** MIT (Entscheidung Georg, 19.08.2026, nach Abwägung gegen PolyForm
  Noncommercial: Eine Nicht-Kommerziell-Lizenz wäre ohne Anwalt kaum durchsetzbar, und
  mit KI ist das Konzept ohnehin in Tagen nachbaubar — was bleibt, sind Entscheidungen,
  Prüfungen und die Person dahinter, nicht der Code. Ehrlich benannt: unter MIT einmal
  Veröffentlichtes ist nicht rückholbar, V1 bleibt für immer frei — auch für andere; ein
  späteres kommerzielles V2 bleibt möglich, muss aber über API-Schlüssel oder eigene
  Abrechnung laufen, nicht über den Abo-Login der Nutzer). `package.json`: `license` auf
  `MIT`, `private` bleibt `true` (kein npm-Paket). LICENSE-Datei.
- **Unterstützen:** `.github/FUNDING.yml` (GitHub Sponsors bzw. Ko-fi — Konto legt Georg
  selbst an) und ein kurzer Absatz „Unterstützen" im README. Ehrliche Erwartung: Kaffeegeld,
  keine Einnahmequelle; der Wert ist das Signal „hier steht ein Mensch dahinter".
- **Repo:** zuerst privat auf GitHub anlegen (Backup sofort, kein Risiko), `main`
  pushen; öffentlich stellen entscheidet Georg danach von Hand. Vorher prüfen: keine
  Schlüssel, IPs, Datenordner-Pfade oder Laufberichte im Repo (Stand 19.08.: sauber —
  `arbeitsablage/`, `dist/`, `out/` sind ignoriert; die persönlichen Bezüge in SPEC/
  BAUPLAN bleiben bewusst — sie zeigen, wie das Projekt entstanden ist). Ehrliche
  Grenze der Bausession 19.08.: Auf dem Rechner gibt es kein `gh` und keinen
  GitHub-Zugang für Claude — das private Repo legt Georg an (drei Befehle stehen in
  der Sessionanleitung), ebenso das Sponsors-/Ko-fi-Konto (FUNDING.yml enthält bis
  dahin nur die vorbereiteten, auskommentierten Zeilen). Nachtrag 19.08.: Repo
  `georgwinter89-cloud/FlowForge` privat angelegt und gepusht, Sponsors-Profil
  freigeschaltet und in FUNDING.yml eingetragen.
- Nachzuziehen: SPEC §2 (Abo-Regel neu, Erststart-Wahl), §9 (Erststart-Dialog),
  README.md, LICENSE, .github/FUNDING.yml, package.json.
**Alltagstest:** Georg installiert die frisch gebaute Version auf einem sauberen
Benutzerprofil (oder löscht einmal die Einstellungsdatei): Beim ersten Start fragt
FlowForge nach dem Motor-Modus, beim Abo steht der Abrechnungs-Hinweis dabei; das
README auf GitHub erklärt in zwei Minuten, was das Projekt ist und wie es mit dem Abo
steht; das Repo ist privat sichtbar und enthält keine Geheimnisse.

### 47 — Integrator: die Nähte zwischen parallel gebauten Teilen
(Entscheidung Georg: eigene **Blockart**, nicht ein fester Block — eine geteilte
Recherche zusammenzuführen ist etwas anderes als Code.)
- Neues Kennzeichen `fuehrtZusammen`: Der Block erwartet **mehrere** Lieferungen
  desselben Etiketts und macht eine daraus. Das ändert drei Dinge in FlowForge — die
  Distanz-Regel gilt nicht (Schritt 40), die Übergaben kommen vollständig an (kein
  Übergabe-Deckel mehr seit 0.46.1), und die Steck-Prüfung verlangt
  **mindestens zwei** eingehende Lieferungen des Etiketts (sonst „führt zusammen",
  was nie geteilt war).
- Der Inhalt steckt im Auftragstext wie bei jedem Block: Der Katalog liefert
  „Integrator (Code)" — prüft jede Naht gegen die Datenverträge und repariert, was
  nicht zusammenpasst — und „Integrator (Recherche)". Eigene baut Georg im
  Block-Editor (Häkchen „Führt zusammen", Regel „Kein Kennzeichen ohne Editor-Feld" —
  gebaut in 47, nicht erst in 48; der Editor lehnt das Häkchen ohne braucht-Etikett ab).
- Er baut **keine Features nach** (was ein Bauer schuldig blieb, steht als
  Beanstandung im Feld `offen` seines Berichts — Block, Fundort, was fehlt; die
  Rückführung bleibt Sache eines Prüf-Blocks dahinter, FlowForge stellt sie nicht
  selbst zu) und wirft **keine Festlegungen um** (der Vertrag steht).
- **Funde aus Angriffsliste und Prüfung, gebaut:** Ein „führt zusammen"-Block ist
  kein benanntes Ziel des Zuschnitts (sonst hätte Paket schneiden ihm ein eigenes
  Paket schneiden müssen), und die Zustellregel gibt ihm die Zuschnitte **aller**
  Umsetzer-Vorfahren auch bei ungleicher Entfernung (Bauer → Prüfer → Integrator
  neben Bauer → Integrator) — sonst träfe die Dateilisten-Sperre ihn genau an der Naht;
  ein Prüfer hinter ihm erbt dieselben Zuschnitte (gleicher Maßstab). Als
  schreibender Block bekommt er alle Baselines „vorher schon rot". Die Steck-Regel
  ≥ 2 gilt streng beim Start; beim Zeichnen ist ein Lieferant ein erlaubter
  Zwischenstand (Prüfer-Fund: sonst ließ sich „zwei Bauer → Integrator" in keiner
  Pfeil-Reihenfolge stecken), der Chip sagt „nur einer — zwei nötig".
- **Gebündelte Rückführung, ohne Agent:** Schicken zwei Prüfer denselben Bauer
  zurück, sammelt FlowForge ihre Beanstandungen (die seit 42 als Felder vorliegen)
  und schickt ihn **einmal** mit allen zurück — eine Reparatur-Runde statt zwei.
  Reine Mechanik, 0 Tokens, wie das Tor aus Schritt 35. Gebündelt wird, solange die
  erste Rückmeldung beim Ziel **unverbraucht** liegt (Merkmal am Knoten, nicht der
  Status — ein nur-lesendes Ziel startet sofort, dann nimmt der zweite Prüfer ehrlich
  seine eigene Runde, und das Ziel läuft nach dem Anlauf mit dieser Kritik gleich noch
  einmal: „nachgeholte Rückführung", Prüfer-Fund — vorher war die Runde genommen und
  die Kritik trotzdem weg); jede Kritik steht unter ihrem Absender, ein rotes Tor-Protokoll
  des zweiten Prüfers wird angehängt, und der zweite Prüfer bekommt keine lokale
  Vorreparatur mehr (der erste hat den Weg festgelegt).
- Nachgezogen: SPEC §4.3 (Integrator), §4.1 (Steck-Regel ≥ 2, gebündelte
  Rückführung), §4.2 (Kennzeichen), §4.5 (Editor-Häkchen).
**Alltagstest:** Georg lässt drei Bauer an einem Feature arbeiten und dahinter einen
Integrator: Im Abschlussbericht steht, welche Nähte er geprüft und was er angepasst
hat. Zwei Prüfer, die denselben Bauer beanstanden, lösen **eine** Reparatur-Runde aus.

### 48 — Block-Editor holt auf, Etiketten-Bibliothek
(Wunsch Georg, 16.08.2026: Alle neuen Mechaniken müssen auch selbstgebauten Blöcken
offenstehen — und Etiketten sollen bearbeitbar sein wie Blöcke.)
- **Der Rückstand:** Der Katalog kennt 12 Kennzeichen (plus `modell` aus 37,
  `fuehrtZusammen` aus 47 — das hat sein Editor-Häkchen schon); ein eigener Block
  darf sonst nur `nurLesen` setzen —
  `prueft`, `uebung` und Formularfelder sind fest verdrahtet (blockRegeln.js). Die
  Vorsicht stammt aus Schritt 14 und ist überholt: Seit Schritt 19 sitzen die Sperren
  am Werkzeugaufruf und kennen den laufenden Block, ein eigener Prüfer bekäme also
  dieselben Schranken wie der Katalog-Prüfer.
- **Verträglichkeitsprüfung statt zwölf freier Häkchen:** Manche Kombinationen sind
  strukturell unerfüllbar — `prueft` mit `nurLesen` (kann keine Tests schreiben),
  `startanleitungPflicht` mit `nurLesen` (Werkzeug gesperrt, Nachforderung nie
  erfüllbar), `pruefbefehlPflicht` ohne `prueft` (löst bei jedem Setzen eine
  Rechte-Rückfrage aus). Der Editor lehnt sie mit Klartext-Begründung ab. Der
  KI-Assistent schlägt die Kennzeichen vor und begründet jedes in Folgen-Sprache;
  die Häkchen selbst stehen zugeklappt unter „Feinheiten".
- **Etiketten-Bibliothek:** Etiketten (braucht/liefert) werden bearbeitbar wie Blöcke
  — global im Datenordner, mit **optionalem** Schema. Ein Etikett anzulegen bleibt
  Tippen; erst wer Struktur will, definiert eine (flach, höchstens ~8 Felder, per
  Assistent gebaut und in Alltagssprache gegengelesen). Ohne Schema greift der
  gemeinsame Rahmen aus 42 plus Freitext.
- Katalog-Etiketten sind **kopierbar, nicht überschreibbar** (sonst brechen die
  Vorlagen still). Etiketten brauchen eine eigene Kennung und Namens-Eindeutigkeit —
  heute sind sie überall reine Zeichenketten — und eine Lösch-Sperre, solange ein
  Block sie nutzt (Muster: `projekteMitBlock`).
- **Gebaut, Entscheidungen aus Angriffsliste und Prüfung:** Elf Kennzeichen für eigene
  Blöcke — drei als Rolle (nur lesen, prüft, führt zusammen), acht zugeklappt als
  Feinheiten; `uebung` bleibt Katalog-Sache (kein Können), `darfKartenAnlegen` folgt aus
  „legt Aufgaben-Karten an" (ein Häkchen, zwei Flags — so arbeitet das Audit). Die
  Verträglichkeit prüft eine reine Funktion (sieben Regeln, Klartext), der Editor zieht beim
  Anhaken nur nach, nie zurück. Formularfelder (≤ 3) mit eingefrorener Kennung nach dem
  Speichern (sonst verwürfe workflow.js eingetippte Werte stumm); fremde `{{x}}` sind nur ein
  Hinweis, weil ein Hauptprozess-Fehler Altbestand beim App-Start stumm verwerfen würde.
  Etiketten: Speicher-Reihenfolge kanonisieren → prüfen → anlegen; Auto-Anlage und
  Schreibweisen-Angleich werden nach dem Speichern gesagt (Hinweis-Dialog, Marke
  „automatisch"); Kopieren nur für lockere Katalog-Etiketten (eine Kopie des Prüfbelegs
  wäre eine Falle: kein Prüfer, keine Reparatur-Runde); Rahmen-Namen als Feld-Schlüssel
  gesperrt; Auswahlwerte nur in Ebene 2 geprüft (eine Schema-Ablehnung liefe am Ticker
  vorbei); Meldungen eigener Etiketten sind selbsttragend (Bezeichnung + Wert), damit der
  Laufbericht ein späteres Umbauen des Etiketts überlebt.
- Nachgezogen: SPEC §4.5 (Editor mit allen Kennzeichen, Etiketten-Bibliothek),
  §4.2 (Etikett mit Form), §4.3 (Lieferschein: eigenes Werkzeug je Etikett mit Feldern).
**Alltagstest:** Georg baut sich per Assistent einen eigenen Prüf-Block und ein
eigenes Etikett „Marktanalyse" mit drei Feldern, steckt beides in eine Kette und lässt
sie laufen: Sein Block meldet über den Lieferschein wie ein Katalog-Block, und eine
unvollständige Marktanalyse wird sichtbar zurückgewiesen.

### Zwischenschritt 0.48.1 — Modellklasse „Extra (Fable 5)" und Denktiefe je Block
(Wunsch Georg, 19.08.2026: „Fable 5 für Extrapower freigeben" und „den Effort bei den
Cloud-Modellen einstellen können". Recherche-Stand 19.08.2026, Claude-Code-Doku
„Model configuration" und Agent-SDK 0.3.224 `sdk.d.ts`:)
- **Fable 5 ist im SDK da:** Alias `fable` / ID `claude-fable-5`, auch als `model` einer
  programmatisch definierten Unteraufgabe (`AgentDefinition.model`) — genau der Weg, auf dem
  FlowForge heute die Klasse je Block setzt (Hook → `model`). Braucht Claude Code ≥ 2.1.170
  (unser SDK bündelt eine neuere CLI). **Kosten-Wahrheit, die in die Oberfläche MUSS:** Laut
  Doku kann Fable 5 je nach Abo „to usage credits instead of drawing on your plan's included
  limits" abrechnen — und „through the Agent SDK, Claude Code never shows the consent prompt.
  When a Fable 5 request there would bill to usage credits, Claude Code bills it without
  asking." Also: Die Klasse „Extra" trägt an Karte und Editor einen Kosten-Hinweis, der
  Erststart/Einstellungen-Text zum Abo nennt es, und beim ersten Lauf mit einem Extra-Block
  fragt FlowForge einmal nach (Folgen-Frage: „kann Guthaben statt Kontingent kosten — trotzdem
  starten?", Antwort merkbar). Kein stiller Billig- oder Teuer-Rückfall: Ist Fable für das
  Konto nicht verfügbar (Ticker-/Fehlertext der CLI), bleibt der Block stehen und FlowForge
  sagt es; Fable-Inhaltsfilter (Cyber/Biologie) fallen laut Doku von selbst auf Opus zurück —
  der Ticker nennt den Wechsel, wenn die CLI ihn meldet.
- **Vierte Cloud-Klasse „Extra (Fable 5)"** neben Standard/sparsam/sehr sparsam: an der
  Blockkarte, im Block-Editor als Voreinstellung, im Katalog nirgends vorbelegt. Regel
  „Unteraufgaben nie verteuern" bleibt (Extra-Block mit Unteraufgaben „wie der Block" → Fable
  auch für seine Helfer, bewusst). Metriken führen „Extra" als eigene Klasse.
- **Denktiefe (Effort) je Block:** Das SDK kennt `effort: low | medium | high | xhigh | max`
  (auch als Zahl) **je AgentDefinition** — FlowForge definiert seinen Block-Agenten deshalb
  je Denktiefe einmal (`block`, `block-low` … `block-max`) und wählt im Hook den Typ nach der
  Karte; so bleibt der Koordinator unberührt. Unterstützt von Fable 5, Opus 5, Sonnet 5
  (+ Opus 4.8/4.7); Haiku 4.5 kennt keine Denktiefe — die Wahl wird dort ignoriert, der
  Editor sagt es. Standard = „Modell-Standard" (laut Doku `high`). Folgen-Texte aus der Doku:
  low „kurz, klar umrissen, nicht intelligenz-kritisch", medium „spart Tokens, etwas
  weniger Klugheit", high „Standard", xhigh „tiefer, teurer", max „kann bei harten Aufgaben
  helfen, neigt zum Überdenken — vorher testen". An der Karte als Zusatz zur Modellklasse
  (ein Auswahlfeld „Denktiefe"), im Editor als Voreinstellung, Ticker/Laufbericht/Metriken
  nennen sie (Reparatur-Runden je Denktiefe — das ist die Zahl, an der Georg sie einstellt).
- **In der Session gemessen (19.08.2026, SDK 0.3.224 / CLI 2.1.224):** Der Hook für
  Unteraufgaben (`subagent_type`) reicht die `effort`-Definition wirklich durch — eine
  SDK-Probe mit zwei programmatischen Agenten (`effort: 'low'` / `'xhigh'`, Modell Sonnet)
  lieferte im PreToolUse-Hook `agent_type: 'probe-low'` mit `effort.level: 'low'` bzw.
  `'xhigh'`; der Haiku-Hauptfaden meldet kein `effort` (kennt keine Denktiefe). Damit ist
  die wirksame Denktiefe im Ticker nachweisbar. `CLAUDE_CODE_EFFORT_LEVEL` in der Umgebung
  würde alles übersteuern — der Motor räumt alle CLAUDE*-Variablen beim Start ohnehin weg.
  Nicht gemessen (bewusst, kostet Guthaben): ein echter Fable-Lauf — der Fehlertext
  „Fable 5 requires usage credits" stammt aus `sdk.d.ts` (USAGE_LIMIT_ERROR_PREFIXES).
- Nachzuziehen: SPEC §2 (Klasse Extra mit Kosten-Wahrheit, Denktiefe), §4.1 (Karte), §4.5
  (Editor), §3.4 (Metriken), §6 (Ticker), §9 (Erststart/Einstellungen-Text).
**Alltagstest:** Georg stellt den Integrator auf „Extra (Fable 5)" und den Prüfer auf
Denktiefe „xhigh", startet — FlowForge fragt einmal wegen des Guthabens, der Ticker nennt
beim Integrator „Extra (Fable 5)" und beim Prüfer „Denktiefe xhigh", der Laufbericht und die
Metriken zeigen beides getrennt.

### 49 — Modellklasse „lokal": Block-Agent über Ollama im Anthropic-Modus
- **Machbarkeitsprobe — Befund (19.08.2026, gemessen auf Georgs Gaming-PC im Heimnetz,
  Ollama 0.32.14, qwen3.8:27b-mtp-q4_K_M):**
  - Start: Agent-SDK gegen Ollama mit `ANTHROPIC_BASE_URL=<adresse>`, `ANTHROPIC_AUTH_TOKEN=ollama`,
    `ANTHROPIC_API_KEY=""`, Modell = Ollama-Modellname; dazu `ANTHROPIC_DEFAULT_HAIKU/SONNET/OPUS_MODEL`
    und `ANTHROPIC_SMALL_FAST_MODEL` = Modellname (jeder Alias landet lokal),
    `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `CLAUDE_CODE_MAX_CONTEXT_TOKENS=<kontext>`.
  - (a) **bestanden:** MCP-Werkzeuge (createSdkMcpServer) kommen als ECHTE tool_use an
    (karten_lesen, mensch_fragen, melde_urteil), ebenso Read/Edit/Bash; der PreToolUse-Hook
    sieht alles. 7 Turns = 99 s.
  - (b) **bestanden:** Agent-Werkzeug mit `subagent_type` funktioniert, Hook sieht `agent_type`. 124 s.
  - (c) **bestanden:** Bauer-Auftrag mit Zuschnitt + Übergabe + Tests: 8 Turns, 109 s, Ergebnis
    korrekt, melde_urteil aufgerufen.
  - Die CLI meldet für das fremde Modell `contextWindow: 200000` und erfundene `costUSD` (~0,6 $ je
    Probe) → der Motor nimmt für lokale Instanzen das Fenster aus den Einstellungen, füttert das
    Motor-Wissen nicht mit 200000, setzt Kosten auf 0 und setzt `maxBudgetUsd` NICHT (sonst bricht
    die API-Obergrenze lokale Läufe ab).
  - Ohne abgeleitetes Modell lädt Ollama das Modell mit Maximalkontext (262k) → spillt aus dem
    VRAM. Abgeleitetes Modell per `POST /api/create {model, from, parameters:{num_ctx,…}}`
    (NDJSON-Stream, letzte Zeile `{"status":"success"}`) — 64k → 19,9 GB voll im VRAM. Erneutes
    Anlegen mit gleichen Parametern lädt NICHT neu. Kein Prompt-Cache (cache_read 0) — jeder
    Turn verarbeitet den vollen Kontext neu.
  - **Denken-Schalter entfällt (gemessen, nicht steuerbar über die CLI):** `thinking:{type:'disabled'}`
    am Endpunkt wirkt, aber die CLI sendet das nie (MAX_THINKING_TOKENS=0, maxThinkingTokens:0,
    CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING — alle ohne Wirkung); `/no_think` und Modelfile-`think`
    wirken bei Qwen3.8 nicht. Einstellungen sagen ehrlich „Denken bleibt an".
  - Modelfile-Parameter, die es gibt: num_ctx, temperature, top_p, top_k, min_p, repeat_penalty,
    num_predict, draft_num_predict. `presence_penalty` gibt es NICHT.
  - **Zuschnitt:** (a), (b), (c) bestanden → 49 gibt den Bauer frei, Unteraufgaben erlaubt.
- **Fünfte Modellklasse „lokal"** (§2): an jeder Blockkarte wählbar, im Block-Editor als
  Voreinstellung, im Katalog nirgends Voreinstellung; der KI-Assistent schlägt sie nie vor.
  Übersetzung in den Modellnamen kommt aus den Einstellungen (Ollama-Adresse und Modell gibt es
  seit Bauschritt 20/31; neu: Häkchen „als Block-Agent erlaubt", Kontextfenster aus 0.46.3 gilt
  mit). Ohne eingeschaltete und erreichbare lokale KI lehnt der Start einen lokalen Block mit
  Klartext ab (kein stiller Rückfall auf Claude — sonst bezahlt Georg, was er lokal wollte).
- **Eigene Motor-Instanz je lokalem Block:** Umgebung aus der Probe (oben), ohne Abo-Anmeldung;
  die Umgebungs-Bereinigung beim Motorstart bekommt die Ausnahme. Koordinator dieser Instanz =
  das lokale Modell (kein Haiku). Sperren, Lieferschein, Rechte-Rückfragen, Sicherungspunkte,
  Dateilisten-Sperre, Tor: unverändert — sie sitzen am Werkzeugaufruf und im Hauptprozess,
  nicht im Modell. Übertrag: der lokale Motor misst seinen eigenen Faden. Welle (46): ein
  lokaler Block zur Zeit je Ollama-Adresse (eine GPU), der Planer weiß das (Warte-Grund im
  Ticker).
- **Sichtbar und messbar:** Ticker und Laufbericht nennen „lokal (<Modellname>)" wie heute die
  Klasse; Metriken (§3.4) führen „lokal" als eigene Klasse — Erstläufe, Reparatur-Runden,
  Dauer, Tokens (Ollama liefert usage), Kosten 0 — damit Georg sieht, ob sich die Karte rechnet.
- **Feineinstellungen der lokalen KI** (Wunsch Georg, 19.08.2026): Die Claude-CLI schickt über
  den Anthropic-Modus keine Temperatur und keine Ollama-Optionen mit (nur `max_tokens`,
  `thinking`, `tools`). Der **wirksame Hebel sind die Standardwerte am Modell**: FlowForge legt
  aus Georgs Einstellungen ein **abgeleitetes Ollama-Modell** an (`flowforge-<basis>` über
  `POST /api/create`, Regeln in src/shared/lokalRegeln.js) und nutzt es als Block-Agent-Modell.
  Einstellbar im Abschnitt „Lokale KI als Block-Agent" (Folgen-Erklärung und Empfehlung je
  Feld): **Kontextfenster** (`num_ctx`, besteht seit 0.46.3), **Temperatur**, **Top-p / Top-k /
  Min-p**, **Wiederholungsstrafe** (`repeat_penalty`), **Antwortlänge** (`num_predict`),
  **Entwurfs-Tokens/MTP** (`draft_num_predict`, spekulatives Dekodieren — wirkt nur bei Modellen
  mit eingebautem Entwurfskopf, z.B. Qwen3.8-MTP-Fassungen: ~2,0× Durchsatz laut Hugging Face;
  ob es wirkt, zeigen Dauer und Tokens im Ticker/Laufbericht). Vorlagen-Knöpfe mit den
  Herstellerempfehlungen (Qwen3.8-Modellkarte, Stand August 2026: Denken `temperature 1.0,
  top_p 0.95, top_k 20, min_p 0`; Coding laut Unsloth eher `temperature 0.6`; Wiederholungsstrafe
  1.0) und „Ollama-Standard" (alle Felder leer). Denken: kein Schalter (Befund oben).
  `ollama create` läuft über die API des Ollama-Rechners; ein geändertes abgeleitetes Modell
  lädt neu in den VRAM — nur beim Ändern der Werte, nicht je Lauf (gemessen).
- Nachgezogen: SPEC §2 (fünfte Klasse, V2-Satz ersetzt, Feineinstellungen, Denken bleibt an),
  §5 (Motor-Instanz je lokalem Block, ein lokaler Block je Adresse), §3.4 (Klasse „lokal"),
  §4.1 (Karte), §4.5 (Editor-Voreinstellung), §9 (Einstellungen).
- **Messwerte der Bausession (19.08.2026, zwei Prüfer, gebaute App, eigener Datenordner):**
  - Ende-zu-Ende: Paket schneiden (Sonnet) → Bauer **lokal** (qwen3.8:27b, 64k) → Prüfer
    (Sonnet): Bauer erfolgreich in 291 s, Prüfer bestanden, Lauf erfolgreich; Kosten des
    lokalen Blocks 0, Ticker/Bericht „lokal (flowforge-…)".
  - Welle mit zwei lokalen Bauern (getrennte Dateilisten): 1523 s gesamt, beide erfolgreich;
    der zweite wartete mit Ticker-Grund „die lokale KI bearbeitet einen Block zur Zeit", keine
    Überschneidungs-Zeile; je Bauer eigene Motor-Instanz mit Ollama-Umgebung, kein Dollar,
    keine Ausgaben-Obergrenze im Lauf.
  - Befund: Listen-Argumente der Melde-Werkzeuge kommen über Ollama als JSON-TEXT an, sobald ein
    Eintrag typografische Anführungszeichen „ " trägt (reproduziert gegen /v1/messages; Schema
    lehnte ab, 3–4 Anläufe je Meldung, ~150–350 s verloren). Lösung:
    src/main/motor/werkzeugSchema.js — Listen-Felder nehmen zusätzlich JSON-Text an
    (lieferschein-/kartenZuteilungs-/vorschlag-/menschWerkzeuge; Test werkzeugSchema.test.js).
  - Befund: Das Agent-Werkzeug nimmt im Feld `model` nur die Claude-Aliase (Schema-Fehler bei
    einem Ollama-Namen) → lokale Instanzen setzen beim Block-Start und bei Unteraufgaben KEIN
    model-Feld; der Agent erbt das Ollama-Modell seiner Definition.
  - Denktiefe bei lokal nicht gemessen (die CLI meldete ihr eigenes „high", das Ollama nie
    erreicht): `denktiefeGemessen` null, Bericht „Denktiefe: gilt hier nicht", Kosten-Zeile
    „Kosten: keine — lief auf deiner lokalen KI".
  - Negativstarts ohne Motorstart (1–14 ms): Helfer-KI aus / Häkchen aus → lokalNichtErlaubt;
    Adresse tot → nicht erreichbar (Schwarzes Loch: 3 s); Basis-Modell fehlt → Klartext.
  - lokalesModellBereitstellen: gültig 55 ms, erneutes Anlegen mit gleichen Werten lädt nicht
    neu (VRAM/expires_at unverändert); Netzfehler < 11 s, unter der 60-s-Grenze.
  - Offen (kosmetisch, bewusst gelassen): Qwen schreibt Zwischenmeldungen teils englisch;
    Kartenüberlappung im Vorlagen-Layout bei hohen Karten (vorbestehend); Fehlerzeile des
    Einstellungs-Dialogs markiert das betroffene Feld nicht.
**Alltagstest:** Georg stellt in „Feature hinzufügen" den Bauer auf „lokal", lässt den
Workflow am Moorhuhn laufen: Paket schneiden (Opus) schneidet, der lokale Bauer baut im
Datenvertrag, meldet über den Lieferschein, der Opus-Prüfer urteilt; im Laufbericht steht
beim Bauer „lokal (qwen…)" und in den Metriken eine eigene Zeile dafür.

## Reihenfolge-Begründung (Paket 40–48)
Im Paket 40–48 bestimmt die Angriffsliste die Reihenfolge, nicht der Nutzen: Die
Kanten müssen verlustfrei sein (40), bevor ein Auftrag verspricht, wohin eine
Lieferung geht (43); Instanzen müssen unterscheidbar sein (41), bevor mehrere gleiche
Blöcke in einem Lauf stehen (44); der Lieferschein (42) muss die Beanstandungen als
Felder liefern, bevor FlowForge sie bündeln (47) oder zu Karten machen kann (38); und
die Sicherungspunkte müssen je Schreiber getrennt sein (45), bevor zwei gleichzeitig
schreiben dürfen (46) — sonst rollt der eine die Arbeit des anderen weg. 44 bringt
den fachlichen Nutzen (Zuschnitt, Datenvertrag, Vollständigkeit) schon vollständig;
46 fügt nur Geschwindigkeit hinzu — wer das Paket abkürzen will, hört nach 44 auf.
