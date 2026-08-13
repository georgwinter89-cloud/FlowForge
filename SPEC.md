# FlowForge — Produkt-Spezifikation V1

Stand: 13.08.2026 · Ursprung: Grilling-Session vom 07.08.2026 (von Georg freigegeben) ·
fortlaufend gepflegt — dieses Dokument beschreibt die Gegenwart, Verhaltensänderungen
werden hier nachgezogen (Historie liefert git).

## 1. Was FlowForge ist

Eine Desktop-App, mit der Nicht-Programmierer per Drag & Drop Coding-Workflows aus Blöcken
zusammenbauen, die ein KI-Agent ausführt. FlowForge ist die Werkbank, auf der über viele
Sitzungen hinweg Software entsteht — ohne dass dem Agenten der Kontext überläuft.

**V1-Nutzer:** ausschließlich Georg. **Output:** beliebige Software (nicht auf Web-Apps begrenzt).
**Sprache:** Deutsch (Texte zentral gehalten; Englisch kommt in V2).

## 2. Plattform & Motor

- **Desktop-App mit eigenem Fenster und Installer ab V1** (Technik: Electron — wie VS Code, Slack).
- **Motor-Anschluss:** Eine feste Adapter-Schnittstelle trennt FlowForge vom ausführenden
  KI-Agenten. Die Schnittstelle liefert u.a. den **Kontext-Füllstand** (berechnet aus den
  Token-Verbrauchsdaten des Motors) als Messwert.
  - **V1-Motor:** Die offizielle Claude-Code-CLI, von FlowForge im Hintergrund gestartet,
    unter Georgs eigenem Login (Max-Abo-Kontingent). **Nur für den privaten Eigengebrauch
    des Kontoinhabers** — Anthropics Bedingungen erlauben Abo-Login nicht in Apps für
    Dritte. Fest verdrahtete Regel: In jeder weitergegebenen Version ist der Abo-Modus
    deaktiviert; Dritte nutzen eigene API-Schlüssel/Anbieter. Risiko bewusst akzeptiert
    (Entscheidung Georg, 07.08.2026): Sollte Anthropic die Abo-Nutzung technisch
    unterbinden, greift die Rückfalllinie.
  - **Rückfalllinie ab V1:** Derselbe Motor läuft wahlweise mit **API-Schlüssel**
    (Umschalter in den Einstellungen, kein Umbau). Im API-Modus gilt statt der
    Kontingent-Pause eine einstellbare **Ausgaben-Obergrenze** pro Lauf.
  - **Lokale KI schon in V1 — aber nur als Helfer** (Experiment, seit 13.08.2026): Die
    Block-Agenten können Recherche-Aufträge an eine lokale KI über Ollama abgeben
    (§4.3 „Lokale Helfer-KI") — ein eigener kleiner Recherche-Kreislauf von FlowForge,
    kein Motor. Der Motor selbst bleibt die Claude-CLI.
  - **V2-Motoren:** eigene Agenten-Kreisläufe gegen beliebige Anbieter-APIs sowie ein
    vollwertiger lokaler Motor (z.B. über Ollama). Die restliche App merkt nicht,
    welcher Motor dranhängt.

## 3. Projekte

- Jede gebaute App = ein Projektordner. **Ablageort frei wählbar in der App.**
- Ein Projekt enthält: App-Code, Karten, Workflows, Laufberichte, Sicherungspunkte.
- **Keine Prosa-Chronik, nirgends.** (Lehre aus Life OS: wuchernde Markdown-Dateien ohne Mehrwert.)

### 3.1 Karten (ersetzen jede Prosa-Dokumentation)

Fünf Sorten, als strukturierte Datensätze in der App — nicht als Textdateien gepflegt:

| Sorte | Zweck |
|---|---|
| **Aufgabe** | Offen/erledigt; erscheint in der Seitenleiste, wird in Workflows gezogen |
| **Entscheidung** | „X festgelegt, weil Y" — verhindert, dass der Agent Entscheidungen wieder aufrollt |
| **Wissen** | Fakten übers Projekt |
| **Status** | Genau **eine** pro Projekt: „Wo stehen wir gerade" |
| **Prüfung** | Legt FlowForge automatisch nach jeder bestandenen Prüfung an; dahinter bewahrt es die Prüfdateien des Laufs auf (§4.3) |

**Harte Längengrenze pro Karte (Richtwert 3–5 Sätze; durchgesetzt als 400 Zeichen Inhalt,
80 Zeichen Titel) — gilt auch für den Agenten.** Wer mehr zu
sagen hat, legt mehrere fokussierte Karten an. Die Status-Karte wird beim Anlegen des Projekts
automatisch erzeugt und kann weder gelöscht noch doppelt angelegt werden. Weitere Sorten erst, wenn der Alltag sie einfordert.

**Prüfkarten** (seit Bauschritt 18): legt ausschließlich FlowForge an — automatisch nach
jeder bestandenen Prüfung. Titel und Text kommen aus den Zeilen „PRUEFKARTE-TITEL:" und
„PRUEFKARTE:" des Prüfbelegs (Alltagssprache: was geprüft wurde, woran „in Ordnung"
erkennbar ist); fehlen sie, baut FlowForge einen Ersatz aus dem Prüfbeleg. Dahinter
bewahrt FlowForge die Prüfdateien dieses Laufs im verwalteten Bereich **außerhalb des
Projektordners** auf (wie die Sicherungspunkte) — kein Agent sieht das Archiv, es kostet
keinen Lauf Kontext. Der Nutzer kann Prüfkarten bearbeiten und löschen; **Löschen räumt
die aufbewahrten Prüfdateien mit weg.** Agenten können Prüfkarten weder anlegen noch
ändern (die Übersicht listet sie mit). Wiederholungsprüfung per Ziehen auf den Prüfer: §4.3.

Der Agent liest und schreibt Karten über eingebaute **Karten-Werkzeuge** (Übersicht, anlegen,
aktualisieren, erledigen) — dieselben Regeln, hart durchgesetzt; abgelehnte Versuche sind im
Liveticker sichtbar. FlowForges Verwaltungsdateien im Projektordner (projekt.json, karten.json,
workflow.json, Laufberichte) sind für direkte Dateizugriffe des Agenten gesperrt (hartes Nein,
keine Rückfrage) — sonst ließen sich die Kartenregeln umgehen.

### 3.2 Laufberichte

Jeder Workflow-Lauf hinterlässt automatisch einen kompakten, strukturierten Bericht (Workflow,
Blöcke, Ergebnisse, Fehlschläge). Reines Nachschlagewerk in der App — wird **niemals automatisch
in den Kontext künftiger Sessions geladen** und nie von Hand gepflegt. Zusätzlich ist das
Ergebnis des letzten Laufs direkt an jeder Block-Karte auf der Leinwand aufklappbar.
Der Verbrauch steht je Block und für den ganzen Lauf im Bericht — seit 13.08.2026 mit
**Token-Aufschlüsselung** (Eingabe, Ausgabe, Cache gelesen, Cache geschrieben) und den
**theoretischen API-Kosten**, die der Motor aus den Preisen der genutzten Modelle berechnet
(im Abo-Modus nur zur Einordnung ausgewiesen).

### 3.3 Sicherungspunkte

- Automatische Sicherungspunkte des Projektordners: beim Anlegen des Projekts, **vor jedem
  Lauf** und **nach jedem erfolgreichen schreibenden Block** (technisch Git, für den Nutzer
  unsichtbar — sichtbar nur als Liste: „14:32 — Prüfer bestanden"). Nur-lesende Blöcke
  ändern nichts und erzeugen deshalb keinen Punkt — ein Punkt, während parallel ein
  schreibender Block arbeitet, würde dessen halbfertige Änderungen einfrieren.
- Technik-Absicherung: Die Verwaltung nutzt ein eigenes, verstecktes Git-Verzeichnis
  **außerhalb** des Projektordners — das Projekt darf selbst ein Git-Repo sein oder werden.
  Dem Agenten ist Git-Benutzung per Sperre untersagt (hartes Nein, keine Rückfrage).
- Ausgenommen von Sicherung und Wiederherstellung: Laufberichte (bleiben immer erhalten),
  `node_modules` (per Installation wiederherstellbar) und `arbeitsablage`
  (Wegwerf-Fläche der Agenten, wird am Lauf-Ende geleert).
- **Wiederherstellen-Knopf** mit Vorschau (was ändert sich, was verschwindet, was kommt
  zurück): Projektstand von jedem Sicherungspunkt zurückholen. Vorher wird der jetzige
  Stand automatisch gesichert — eine Wiederherstellung ist selbst wieder rückgängig machbar.
  Während ein Lauf aktiv ist, ist Wiederherstellen gesperrt.
- Rechner-Neustart mitten im Lauf → App bietet an, am letzten Sicherungspunkt weiterzumachen.

## 4. Workflows & Blöcke

### 4.1 Form

- Die Leinwand ist ein **Schaubild** (Entscheidung Georg, 07.08.2026): gerahmte Block-Karten,
  **frei platzierbar** (Positionen werden gespeichert), verbunden durch von Hand gezogene
  **Pfeile**, die die Reihenfolge bestimmen. Datenformat: Karten + Pfeile.
- **Parallele Zweige** (seit Bauschritt 13): Von einer Karte dürfen mehrere Pfeile
  ausgehen und mehrere an einer ankommen; Kreise sind verboten. Ein Block startet,
  sobald alle seine Vorgänger fertig sind — ein Block mit mehreren eingehenden Pfeilen
  führt die Zweige zusammen (er wartet auf alle). Gleichzeitig laufen dürfen mehrere
  lesende Blöcke, aber höchstens ein schreibender (§5); ein sichtbarer Hinweis im
  Ticker warnt, dass parallele Blöcke den Verbrauch vervielfachen. braucht/liefert
  gilt entlang der Pfeile: Was ein Block braucht, muss einer seiner Vorfahren liefern.
  **Zwischenstände beim Umbauen sind erlaubt:** Beim Bearbeiten darf das Schaubild
  vorübergehend in Stücke zerfallen (z.B. um einen Block herauszunehmen); die
  braucht/liefert-Steck-Prüfung greift, sobald die Pfeile wieder alle Karten zu einem
  zusammenhängenden Schaubild verbinden — und spätestens beim Start, der immer streng
  prüft. Parallelität **innerhalb** von Blöcken (z.B. ein Audit-Block, der intern zwei
  Prüfer startet) gibt es noch nicht.
- **Fehlschlag-Rückführung:** „bei Fehlschlag zurück zu Block X" (braucht der Prüfer sofort).
  Sind alle Beanstandungen mechanisch, versucht zuerst die lokale Vorreparatur (§4.3) —
  ohne reguläre Runden zu verbrauchen.
  Standard **2 Reparatur-Runden** (pro Workflow verstellbar); danach hält der Lauf an und stellt
  eine Folgen-Frage („Weitermachen, zurückstellen oder Stand wiederherstellen?"). Im
  Verzweigten laufen genau die Blöcke auf den Wegen von X zum Prüfer erneut — parallele
  Zweige daneben behalten ihr Ergebnis; als Ziel wählbar sind alle Vorfahren des Prüfers.

### 4.2 Anatomie eines Blocks

Name · Symbol · **Arbeitsauftrag** (Anweisung an den Agenten) · **braucht / liefert**
(z.B. „braucht: Angriffsliste, liefert: geprüften Code") · optionale **Sperren**
(„darf nur lesen", „Pflichtfeld leer = Lauf hält an").

Kernprinzip (Life-OS-Lehre): **Blöcke erzwingen, statt zu bitten** — Sperren und Pflichtfelder
blockieren den Weiterlauf, Regeln stehen nicht nur als Text im Prompt.

### 4.3 Blockbibliothek V1

**Arbeitsblöcke** (echte Arbeitsaufträge, seit Bauschritt 8/9): Kontext laden ·
Spec-Interview · Paket schneiden · Angreifer (nur lesend) · Diagnose (nur
lesend) · Bauer · Prüfer · Frage an den Menschen (nur lesend) · Sessionende
(bringt die Karten auf Stand). Noch ausstehend: Audit (startet intern
parallele Prüfer; noch keinem Bauschritt zugeordnet).
Auftragsquelle von Paket schneiden und Diagnose (Entscheidung Georg,
07.08.2026): das Wunsch- bzw. Fehlerbild-Feld am Block **oder**, wenn es leer
ist, die offenen Aufgaben-Karten der Kartenauswahl — sind beide leer, startet
der Lauf gar nicht erst (freundlicher Hinweis). Ein früherer Block, der selbst
Aufgaben-Karten erzeugt (Spec-Interview), zählt dabei als Quelle; seine neuen
offenen Aufgaben rutschen nach seinem Lauf automatisch in die Kartenauswahl.

**Paketgröße** (Entscheidung Georg, 12.08.2026): Paket schneiden misst die Größe
an Zusammengehörigkeit und Prüfbarkeit, **nicht** an der Sitzungslänge — der
automatische Übertrag (§5) trägt lange Pakete, während jeder eigene Lauf mehrere
Sessions Grundaufwand kostet. Zusammengehörige Aufgaben-Karten dürfen zu einem
Paket gebündelt werden (Fertig-Kriterien je Teilstück); kleiner geschnitten wird
nur bei wirklich unabhängigen Baustellen oder wenn mittendrin eine Entscheidung
des Nutzers nötig wäre.

**Spec-Interview:** grillt den Nutzer über das Gespräch (§6) nach der
Entscheidungsbaum-Methode (Entscheidung Georg, 07.08.2026: originalgetreu nach
Matt Pococks Grilling-Vorgehen): Jede Festlegung verzweigt in Folge-Entscheidungen;
pro Runde kommt die komplette „Front" — alle Fragen, deren Voraussetzungen schon
geklärt sind — nummeriert auf einmal, jede mit Empfehlung (❓/➡️-Muster). Fakten
recherchiert der Agent selbst, nur Entscheidungen gehen an den Nutzer; Folgen-Fragen
in Alltagssprache, keine Technik-Fragen. Fertig erst, wenn keine Frage mehr offen
ist und der Nutzer das zusammengefasste Verständnis bestätigt hat; dann legt das
Interview das Ergebnis als erste Karten an (Entscheidungen, Aufgaben, Status);
der Abschlusstext ist der Projekt-Überblick für die Folgeblöcke.

**Diagnose:** belegt die Ursache eines Fehlers (nur lesend, mit Fundort und
Herleitung), bevor etwas angefasst wird, und liefert als Arbeitspaket den
minimalen Fix samt Fertig-Kriterien (inkl. Rot-vor-Grün-Test des Fehlers).

**Frage an den Menschen:** stellt genau eine Folgen-Frage mit Antwort-Optionen
und Empfehlung über das Gespräch (§6) und liefert die Antwort an die Folgeblöcke.

**Übergaben:** braucht/liefert ist nicht nur eine Steck-Regel, sondern die
Datenweitergabe im Lauf — der Abschlusstext eines Blocks wird unter seinen
liefert-Etiketten gespeichert und jedem Nachfahren entlang der Pfeile mit
passendem braucht in den Auftrag gereicht (gekürzt auf 8.000 Zeichen je
Übergabe; liefern mehrere Vorfahren dasselbe Etikett, gewinnt der nächstgelegene). Daneben gibt es
**optionale Bedarfe** („falls da"): Der Bauer verlangt nur das Arbeitspaket;
eine Angriffsliste wird mitgereicht und muss eingearbeitet werden, wenn ein
Block davor eine liefert — so kommt „Bug jagen" ohne Angreifer aus.

**Prüfer:** prüft **nur das aktuelle Arbeitspaket** gegen dessen Fertig-Kriterien
(Entscheidung Georg, 12.08.2026) — nicht das ganze Projekt. Schreibt wenige, robuste
Tests frisch fürs aktuelle Paket in den festen Ordner **`pruefung/`** (die Mappe ist
beim Laufstart geleert, §unten), führt sie aus und liefert einen Rot-vor-Grün-Beleg:
mindestens ein Test wird einmal mit absichtlich verfälschter Erwartung ausgeführt
(Rot) und danach unverändert echt (Grün) — ein Test, der nie rot war, beweist nichts.
Überstrenge Fallen (pixelgenaue Vergleiche, Wortverbote, Datei-Inventuren) sind per
Auftrag untersagt.
Jede Beanstandung markiert er als eigene Zeile „BEANSTANDUNG (mechanisch): …"
(Tippfehler, falscher Wert, vergessener Randfall) oder „BEANSTANDUNG
(grundsätzlich): …" (braucht Umbau oder Entscheidungen) — diese Vorsortierung
steuert die lokale Vorreparatur (§unten); im Zweifel gilt grundsätzlich.
In einer **Reparatur-Runde prüft er nur seine Beanstandungen der letzten Runde
nach** — keine erneute Vollprüfung. Ehrlichkeits-Notiz: „Prüfer ≠ Bauer" heißt
technisch „frischer Agent ohne das Arbeitswissen des Bauers" — jeder Block läuft
als frischer Agent in der Lauf-Session (§5); es ist kein anderes Gehirn.
Prüfer-Blöcke melden ihr Urteil als letzte Zeile ihres Abschlusstexts
(„PRUEFUNG: BESTANDEN/FEHLGESCHLAGEN").

**Gesamtprüfung** (seit 12.08.2026, umgebaut 13.08.2026): eigener Prüf-Block für
zwischendurch — prüft mit **frisch geschriebenen** Prüfungen, ob das Projekt als
Ganzes hält (Maßstab: Status-Karte, Entscheidungs-Karten, Startanleitung), statt
eine gewachsene Projekt-Mappe abzuspielen. Gedacht als manueller Ein-Block-Lauf,
nicht als Teil jeder Kette.

**Kontext-Sparsamkeit** (Entscheidung Georg, 13.08.2026): Erkundungslastige Blöcke
(Angreifer, Diagnose, Prüfer, Bauer) delegieren Suchen und Einlesen per Auftrag an
**Unteraufgaben** — der Wegwerf-Helfer wühlt in seinem eigenen Kontext und liefert
nur sein kompaktes Fazit zurück, statt dass der Block alles Gelesene im
Arbeitsgedächtnis anhäuft. Unteraufgaben laufen unter denselben Rechten und Sperren
wie ihr Block (auch „darf nur lesen" — deshalb ist das Unteraufgaben-Werkzeug dort
erlaubt); ihre Zeilen sind im Ticker als „Unteraufgabe" gekennzeichnet. Ihr
Verbrauch zählt ehrlich zum Laufbericht dazu, belastet aber nicht den
Kontext-Füllstand der Lauf-Session, der den automatischen Übertrag steuert.
**Gezügelter Angreifer** (Entscheidung Georg, 13.08.2026 — Befund: 425.000 Tokens
für eine Angriffsliste, weil vier Späher je das ganze Projekt einlasen): höchstens
zwei Unteraufgaben pro Angreifer-Lauf, jede eng umrissen; gelesen werden nur die im
Arbeitspaket genannten Stellen und ihre direkte Nachbarschaft, nicht das ganze Projekt.

**Lokale Helfer-KI** (Experiment, Wunsch Georg, 13.08.2026): In den Einstellungen
zuschaltbar (Standard: aus) — Recherche-Aufträge gehen dann an eine kleine KI über
Ollama (Modellname und Adresse einstellbar: der eigene Rechner oder ein anderer im
Heimnetz, z.B. ein Gaming-PC mit stärkerer Grafikkarte) statt an eine Motor-Unteraufgabe;
das kostet kein Kontingent, nur Rechenzeit. Die Block-Agenten bekommen dafür das
Werkzeug `lokal_recherchieren`; die lokale KI selbst hat genau drei rein lesende
Werkzeuge (Ordner auflisten, Datei lesen, suchen), hart im Code auf den Projektordner
begrenzt — schreiben, ausführen oder außerhalb lesen kann sie nicht, deshalb ist das
Werkzeug auch unter „darf nur lesen" erlaubt. Steht die lokale KI bereit, weisen die
Blockaufträge sie als **erste Wahl** fürs Delegieren aus (das Agent-Werkzeug ist der
Rückfall). Denk-Modelle (z.B. gpt-oss), die ihre Antwort leer lassen und alles ins
Denkfeld schreiben, werden einmal nachgehakt, bevor ein Fehlschlag gemeldet wird.
Ehrlichkeits-Vorkehrungen: Jedes Fazit
trägt den Warnhinweis „kleines Modell — Fundorte selbst nachprüfen" (in der Erprobung
erfand das 7B-Modell abgelehnte Dateiinhalte), Start/Schritte/Fazit stehen im Ticker,
der Laufbericht weist den Anteil der lokalen KI aus (Recherchen, Schritte,
Fehlschläge, Reparatur-Versuche), und ist Ollama beim Laufstart nicht erreichbar, sagt der Ticker das
ehrlich und alles läuft wie gewohnt über den Motor. V1-Experiment auf Georgs Wunsch —
der vollwertige lokale Motor bleibt V2 (§2).

**Lokale Vorreparatur** (seit Bauschritt 20): Scheitert eine Prüfung und sind
**alle** Beanstandungen als mechanisch markiert (Vorsortierung des Prüfers,
s.o. — ohne Marken wird sicher eskaliert), repariert zuerst die lokale KI:
höchstens **2 Versuche je Rückführung**, die keine regulären Reparatur-Runden
verbrauchen. Ihr einziges Schreib-Werkzeug ist **gezieltes Ersetzen** (der alte
Text muss zeichengenau und eindeutig sein — kein freies Datei-Schreiben), hart
im Code begrenzt auf den Projektordner; Prüfmappe und Verwaltungsdateien sind
tabu. Vor jedem Versuch legt FlowForge einen Sicherungspunkt „Stand vor lokaler
Reparatur" an; die **Nachprüfung des Prüfers** (nur die Beanstandungen) ist der
Schiedsrichter. Scheitert sie, wird der Stand zurückgerollt, BEVOR der
Motor-Bauer mit der Original-Kritik übernimmt — er repariert den sauberen
Stand, nicht das Gebastel. Ersetzt ein Versuch gar nichts, zählt er als
verbraucht, ohne eine Nachprüfung zu kosten. Jeder Versuch steht samt Ausgang
im Ticker („Lokale Reparatur, Versuch 1 von 2 …") und in der
Lokale-Helfer-Zeile des Laufberichts. Aktiv nur, wenn die lokale KI
eingeschaltet und beim Laufstart erreichbar war — sonst läuft die Rückführung
wie gehabt.

**Häkchen je Block** (seit Bauschritt 20): An jeder Block-Karte im Schaubild
sitzt ein Abwahl-Häkchen **„lokale KI erlaubt"** (Standard: an, erbt den
globalen Schalter). Abgewählt ist es eine echte Sperre: FlowForge lehnt
`lokal_recherchieren` für die Agenten dieses Blocks hart ab (erkannt am
laufenden Block, Mechanik aus Bauschritt 19) und streicht den Hinweis auf die
lokale KI aus dem Arbeitsauftrag. Ein Block ohne lokale KI bekommt auch keine
lokale Vorreparatur (maßgeblich ist das Häkchen des Rückführungs-Ziels, dessen
Reparatur-Runde ersetzt würde). Eine Gegenrichtung (global aus, einzeln an)
gibt es bewusst nicht.

**Prüfmappe & Arbeitsablage:** Der Ordner `pruefung/` gehört den Prüf-Blöcken —
für alle anderen Blöcke ist er schreibgesperrt (hartes Nein; der Bauer darf die
Prüfmappe höchstens einmal ganz am Ende laufen lassen, nicht als Dauerschleife).
**Lauf-Mappe statt Projekt-Mappe** (Entscheidung Georg, 13.08.2026): Die Prüfmappe
gehört zum Lauf, nicht zum Projekt — beim Start eines neuen Laufs leert FlowForge
sie automatisch (vor dem Sicherungspunkt „Stand vor Lauf"; die Wiederaufnahme eines
unterbrochenen Laufs leert nicht). Wuchern ist damit strukturell unmöglich.
**Gezielte Wiederholungsprüfung über Prüfkarten** (seit Bauschritt 18): Der Nutzer
zieht Prüfkarten (§3.1) auf eine Prüf-Blockkarte im Schaubild — sie hängen dort
sichtbar an (abnehmbar per ×). Beim Lauf-Start legt FlowForge — **nach** der
automatischen Leerung, noch vor dem Sicherungspunkt „Stand vor Lauf" — die
aufbewahrten Prüfdateien der gezogenen Karten in die Prüfmappe (je Karte ein eigener
Unterordner `pruefkarte-…/`), und der Prüfer führt sie zusätzlich zu seinen
Paket-Prüfungen aus. Die Mappe ist damit nur die Werkbank des Laufs; das Gedächtnis
ist das Archiv hinter den Prüfkarten, das die Leerung nie berührt. Passt eine alte
Prüfung nicht mehr zum heutigen Code, passt der Prüfer sie in ihrem Unterordner an —
nach bestandener Prüfung ersetzt die angepasste Fassung die aufbewahrte, die Karte
veraltet nicht.
**Bilddateien sind in der Prüfmappe verboten** (hartes Nein, auch für Prüf-Blöcke).
An jeder Prüf-Blockkarte auf der Leinwand hängt ein aufklappbarer Bereich
**„Prüfmappe"** (Wunsch Georg, 13.08.2026): je Prüfdatei Name, Größe und
Zuletzt-geändert, in Alltagssprache — nur zum Nachlesen; gezählt werden
Prüf-Dateien, nicht einzelne Testfälle. Alle Prüf-Blockkarten zeigen dieselbe
Mappe; ohne Prüf-Block auf der Leinwand gibt es keinen Blick hinein (bewusst
akzeptiert — die Bau-Vorlagen enthalten immer einen Prüfer).
Der Ordner `arbeitsablage/` ist die Wegwerf-Fläche aller Agenten für Hilfsskripte
und Probeläufe: von Sicherungspunkten ausgenommen, von FlowForge am Lauf-Ende
automatisch geleert.

**Übungs-Blöcke** bleiben für Probeläufe in der Bibliothek (eigener Abschnitt):
Späher, Mini-Bauer, fairer und strenger Übungs-Prüfer, Karten-Probe, Rechte-Probe.

### 4.4 Vorlagen-Workflows

| Vorlage | Kette |
|---|---|
| **Neue App starten** | Nur das Spec-Interview (grillt den Nutzer, erzeugt erste Karten) — Entscheidung Georg, 07.08.2026: Spec-Erfassung getrennt vom Bauen; gebaut wird danach mit „Feature hinzufügen" |
| **Feature hinzufügen** | Paket schneiden → Angreifer → Bauer → Prüfer → Sessionende |
| **Bug jagen** | Diagnose (Ursache belegen, bevor etwas angefasst wird) → Bauer (minimaler Fix) → Prüfer mit Rot-vor-Grün → Sessionende |

Ohne „Kontext laden" (Entscheidung Georg, 12.08.2026): Jeder Block liest ohnehin
selbst im Projekt — ein eigener Einlese-Block kostete nur eine volle Extra-Session.
Der Block bleibt in der Bibliothek; Paket schneiden und Diagnose verlangen den
Projekt-Überblick nicht mehr (nur noch „falls da", z.B. vom Spec-Interview).

Alle drei Vorlagen sind verfügbar (seit Bauschritt 9) — als ziehbare Vorlagen
in der Blockbibliothek. Liegt schon ein Schaubild auf der Leinwand, ersetzt die
Vorlage es nach einer Rückfrage — so folgt auf das Spec-Interview direkt die
Bau-Vorlage auf derselben Leinwand. „Bug jagen" ersetzt Paket schneiden +
Angreifer durch die Diagnose.

### 4.5 Block-Editor (seit Bauschritt 14)

- Nutzer kann eigene Blöcke **erstellen, bearbeiten, löschen** — als Formular entlang der
  Block-Anatomie (§4.2). Eigene Blöcke gelten **global** (Abschnitt „Eigene Blöcke" in der
  Bibliothek jedes Projekts); sie sind nie Prüfer und haben keine Formularfelder.
- **Erstellungsassistent in 4 Schritten:** Was soll der Block tun? → Was braucht/liefert er? →
  Welche Sperren gelten (nur „darf nur lesen")? → Probelauf-Vorschau (der exakte
  Arbeitsauftrag, den der Agent bekäme). Eine **Stepper-Leiste** zeigt die Schritte
  (erledigte sind anklickbar), und die Blockkarte liegt auf allen Schritten als
  **Live-Vorschau** rechts daneben — so, wie sie in der Bibliothek läge. Bearbeiten
  nutzt denselben Assistenten mit vorbefüllten Feldern.
- **KI-Assistent:** Nutzer beschreibt in normaler Sprache, die KI (der Motor, eine
  Einmal-Frage ohne Werkzeuge) füllt das Formular — alles bleibt von Hand änderbar; die
  harten Grenzen (Name 40, Beschreibung 200, Auftrag 4.000 Zeichen, je 5 Etiketten à 40)
  setzt der Hauptprozess beim Speichern durch. Der Assistent bekommt die vorhandenen
  braucht/liefert-Etiketten als Wortschatz, damit eigene Blöcke zu den vorhandenen stecken;
  das Formular schlägt dieselben Etiketten vor.
- **Schutz der Schaubilder:** Ein Block, der in irgendeinem bekannten Projekt auf der
  Leinwand liegt, lässt sich nicht löschen (Hinweis nennt die Projekte — sonst würde er
  beim nächsten Laden stillschweigend aus dem Schaubild fallen). Ändern ist gesperrt,
  solange ein Projekt mit diesem Block läuft oder in der Warteschlange wartet.
- Import/Export von Blöcken: V2.

## 5. Sessions & Autonomie

- **Eine Motor-Session pro Lauf, jeder Block ein frischer Agent** (seit Bauschritt 19,
  Entscheidung Georg, 13.08.2026 — die Frische-Session je Block war Bauweise-Erbe aus
  Schritt 3, nie die gewollte Architektur): Die Motor-Session bleibt über den ganzen
  Lauf offen. Auf ihrem Hauptfaden sitzt ein **Koordinator** mit den engsten Rechten —
  er erledigt selbst nichts, sondern startet je Block genau einen frischen Agenten
  (Unteraufgabe) und sammelt die Fazite ein. FlowForge bleibt der Steuerer: Es reicht
  Block für Block als Auftrag nach und behält Reihenfolge, Sicherungspunkte,
  Prüfer-Urteile, Reparatur-Runden, Startanleitungs-Pflicht und Folgen-Fragen fest in
  der Hand. Den echten Arbeitsauftrag setzt FlowForge beim Agent-Aufruf selbst ein
  (der Koordinator bleibt schlank und kann nichts verfälschen), und das Fazit liest es
  direkt aus dem Werkzeug-Ergebnis des Agent-Aufrufs — nicht aus dem Koordinator-Text.
  Das Frische-Prinzip bleibt: Agenten erben kein Arbeitsgedächtnis (§4.3). Die harten
  Sperren („darf nur lesen", Prüfmappen-Besitz, Git-/Verwaltungsdatei-Sperren) erkennt
  FlowForge am Werkzeugaufruf (Unteraufgaben-Kennung) und setzt die Regeln des gerade
  laufenden Blocks für dessen Agenten und Helfer durch; der Koordinator darf
  ausschließlich delegieren. Reparatur-Runden laufen als neuer Agent mit der
  Prüferkritik im Auftrag. **Parallele Zweige** laufen als eigene Sessions, weil die
  Lauf-Session einen Block nach dem anderen verarbeitet — ehrlich im Ticker vermerkt.
- **Session = ein Workflow-Lauf.** Das **Sessionende** (Karten aktualisieren,
  Laufbericht schreiben) ist fest eingebaut, kein optionaler Block.
- **Automatischer Übertrag** (seit Bauschritt 11): Die App misst den echten
  Kontext-Füllstand der Lauf-Session (den Koordinator-Faden — der wächst nur um
  Aufträge und Fazite, Überträge sind darum selten). Die Fenstergröße des Modells kennt
  FlowForge seit 13.08.2026 schon ab der Startmeldung des Motors (aus der Modellkennung
  bzw. der gemerkten Größe früherer Sessions). Bei ~85 % unterbricht sie den laufenden
  Block; der Koordinator schreibt eine Übergabe, und derselbe Block läuft sofort in
  einer frischen Lauf-Session als neuer Agent weiter (die Übergabe wandert über den
  Auftrag mit) — bis der Workflow fertig ist. Jeder Übertrag hinterlässt einen Eintrag
  in Alltagssprache im Laufbericht (Abschnitt „Überträge"). Test-Schalter in den
  Einstellungen: „Übertrag schon bei etwa 10 %" — greift beim Startfüllstand plus
  10 Prozentpunkte; im Testmodus zählt der Verbrauch der Block-Agenten mit, damit der
  Übertrag vorführbar bleibt (im Normalbetrieb zählt nur der Koordinator-Faden).
- **Übertrags-Grenze pro Workflow einstellbar** (im Schaubild-Kopf): Zahl (Standard 5) oder
  unbegrenzt (Feld leer). Ist die Grenze erreicht, läuft der Block ohne weiteren Übertrag zu
  Ende — ehrlich im Ticker vermerkt.
- **Fortsetzung der Lauf-Session** (Bauschritt 16, seit Bauschritt 19 nur noch für
  Unterbrechungen): Stirbt der Session-Prozess (App-Neustart, Absturz, Pause), setzt
  FlowForge dieselbe Lauf-Session über ihre Kennung fort, statt neu zu starten — die
  Kennung wandert dafür mit in den Laufstand. Ein Füllstands-Wächter erzwingt eine
  frische Session, wenn die alte schon nahe der Übertrags-Schwelle liegt (unter 75 %
  wird fortgesetzt); ist die Session nicht wiederaufnehmbar (Kennung ungültig), fällt
  der Fall still auf eine frische Session zurück. Jede Fortsetzung steht ehrlich im
  Ticker („Lauf-Session fortgesetzt statt neu gestartet"). Die frühere Fall-Liste
  (Reparatur-Runde, Nachprüfung, Startanleitungs-Nachforderung) ist damit überflüssig:
  Diese Wiederholungen laufen ohnehin als neue Agenten in der weiterlaufenden
  Lauf-Session. Der Laufbericht zeigt je Block den Token-Verbrauch (Koordinator-Zuwachs
  plus die Agenten des Blocks).
- **Abo-Kontingent erschöpft:** Verhalten pro Projekt wählbar (im Schaubild-Kopf) —
  (a) **pausieren** (Standard): Windows-Benachrichtigung, alle 10 Minuten ein neuer Versuch,
  selbstständiges Weiterarbeiten sobald wieder Kontingent da ist (+ Benachrichtigung), oder
  (b) **anhalten** und auf manuellen Neustart warten. Im API-Modus hält der Lauf bei erreichter
  Ausgaben-Obergrenze immer an — automatisches Weiterlaufen würde die Obergrenze aushebeln,
  weil jede frische Motor-Session sie neu zählt. Bei **überlasteten KI-Servern**
  (vorübergehende Störung) pausiert der Lauf immer automatisch im 10-Minuten-Takt, unabhängig
  von dieser Einstellung; Wiederholungsversuche des Motors sind im Liveticker sichtbar.
- **Lauf-Ende-Benachrichtigung:** Ist das Fenster beim Laufende nicht im Vordergrund, meldet
  sich FlowForge per Windows-Benachrichtigung.
- **Kontext-Zuführung:** Beim Start wählt die App Karten automatisch vor — festgenagelt auf
  **Status-Karte (immer) + offene Aufgaben-Karten**; der Nutzer kann weitere Karten per
  Drag & Drop in die Auswahl ziehen und vorausgewählte per Klick rauswerfen, dann Start.
  Die gewählten Karten bekommt der Agent zu Beginn **jedes Blocks** frisch mit.
- **Parallelität** (seit Bauschritt 12): Bis zu **3 Workflows gleichzeitig, aber nur in
  verschiedenen Projekten.** Pro Projekt schreibt immer nur **ein** Agent (mehrere lesende
  erlaubt). Weitere Starts landen in einer Warteschlange und laufen automatisch an: sichtbar
  im Lauf-Tab (samt Herausnehmen-Knopf), festgehalten im Ticker des anlaufenden Laufs.
  Solange ein Projekt läuft oder wartet, sind Schaubild-Umbau und Wiederherstellen gesperrt.
  **Sichtbarer Verbrauchs-Hinweis:** Läuft anderswo schon etwas, warnt FlowForge beim Start
  und im Lauf-Tab, dass parallele Läufe den Verbrauch vervielfachen.

## 6. Live-Ansicht & Eingriff

- **Klartext-Liveticker** + hervorgehobene laufende Blöcke auf der Leinwand (bei
  parallelen Zweigen mehrere gleichzeitig; Ticker-Zeilen tragen dann den Blocknamen).
- **Rohprotokoll** einklappbar für den Blick hinter die Kulissen.
- **Stopp in zwei Stufen:** „Sanft anhalten" (laufender Block macht fertig, Halt am
  Sicherungspunkt) und „Sofort abbrechen" (Block gilt als nicht gelaufen; der Projektordner
  springt automatisch auf den letzten Sicherungspunkt zurück).
- **Gespräch** (seit Bauschritt 9): Stellt der Agent eine Frage (Frage-Block,
  Spec-Interview — über das eingebaute mensch-Werkzeug), pausiert der Lauf und
  die Lauf-Ansicht zeigt eine Chat-Ansicht: Verlauf aus Fragen und Antworten,
  Antwort per Options-Klick oder Freitext. Die Optionen liegen als Auswahlkarten
  nebeneinander; benennt die erste Option ihre Empfehlung selbst („empfohlen …"),
  trägt sie ein grünes Empfohlen-Abzeichen. Ist das Fenster nicht im Vordergrund,
  kommt eine Windows-Benachrichtigung. Das Gespräch steht auch im Laufbericht.
  Fragen stellen ist auch unter der Sperre „darf nur lesen" erlaubt.

## 7. Rechte des Agenten (Standard, später pro Projekt verstellbar)

| Ohne Rückfrage | Mit Rückfrage |
|---|---|
| Im Projektordner schreiben/löschen | Alles außerhalb des Projektordners |
| Programmbibliotheken installieren (offizielle Quellen) | Sonstige Internetzugriffe |
| Tests ausführen | Alles Unumkehrbare |

Der Rechte-Standard ist sichtbar (seit Bauschritt 15): Der Knopf
**„Projekt-Einstellungen"** im Kopf der Projektansicht zeigt die drei Gruppen
(ohne Rückfrage · nur mit Erlaubnis · immer gesperrt) in Alltagssprache — in V1
nur zum Nachlesen, verstellbar pro Projekt in V2.

**Automodus** (Feedback Georg, 07.08.2026): In den Einstellungen wählbar —
„Jedes Mal fragen" (Standard) oder „Automodus: automatisch erlauben". Im
Automodus werden Rechte-Rückfragen ohne Nachfrage erlaubt und im Liveticker
sowie im Laufbericht als „automatisch erlaubt" vermerkt. Die harten Sperren
(Git, Verwaltungsdateien, „darf nur lesen") gelten unverändert — der Automodus
betrifft nur die Rückfrage-Fälle.

Befehls-Einstufung (seit Bauschritt 8): Kommandozeilen-Befehle, die mit einem bekannten
Entwickler-Werkzeug beginnen (node, npm, npx, pnpm, yarn, tsc, vitest, jest, python,
pip, pytest), laufen ohne Rückfrage — das deckt „Tests ausführen" und „Programm-
bibliotheken installieren" ab. Rein lesende Befehle (dir, type, findstr …) ebenso.
Verkettete Befehle laufen nur durch, wenn jedes Teilstück bekannt ist. Alle anderen
Befehle lösen eine Rückfrage aus; Git bleibt hart gesperrt (§3.3), und die Prüfmappe
`pruefung/` dürfen nur Prüf-Blöcke verändern (§4.3 — hartes Nein, auch für Befehle,
die erkennbar hineinschreiben). Die Sperre „darf nur lesen" (§4.2) steht darüber:
Sie stoppt jeden nicht rein lesenden Werkzeugaufruf hart, ohne Rückfrage. **Rein
lesende Befehle laufen auch unter der Sperre durch** (seit 12.08.2026 — vorher war
jeder Befehl gesperrt und die Abweisung hieß irreführend „Schreib-Versuch"); auch
Lese-Schleifen („für jede Datei: zeig den Anfang") gelten als lesend, solange jeder
Befehl darin ein Lese-Werkzeug ist. Programme oder Tests auszuführen zählt nicht
als Lesen und bleibt gesperrt.

## 8. Ergebnis erleben

Jeder Bau-Workflow muss eine **Startanleitung** als Pflicht-Artefakt hinterlassen (seit
Bauschritt 10): ein maschinenlesbarer Datensatz (startanleitung.json) aus **Beschreibung**
(ein Satz), **Befehl** (Kommandozeile im Projektordner) und/oder **Adresse** (http(s)-Adresse
oder Datei im Projektordner). Der Agent schreibt sie ausschließlich über das eingebaute
Werkzeug `startanleitung_setzen` (hart validiert; die Datei selbst ist für ihn gesperrt wie
alle Verwaltungsdateien, §3.1). Durchsetzung beim Bauer-Block: Fehlt die Startanleitung nach
seinem Lauf, bekommt er genau eine Nachbesserungs-Runde (unabhängig von den Reparatur-Runden);
fehlt sie danach immer noch, macht der Lauf weiter und vermerkt das ehrlich im Ticker und am
Block-Ergebnis.

Pro Projekt gibt es einen **„App starten"-Knopf** (im Kopf der Projektansicht), der genau
diese Anleitung ausführt: Befehl → eigenes sichtbares Konsolenfenster im Projektordner;
Adresse → Browser (bei Web-Apps mit eigenem Server wartet FlowForge bis zu 30 Sekunden,
bis die Adresse antwortet, und öffnet den Browser erst dann); Datei-Adresse → Standard-
programm der Datei. Ohne Startanleitung ist der Knopf grau und erklärt, wie sie entsteht.

## 9. GUI-Grundaufbau

**Erscheinungsbild „dunkle Werkbank"** (seit 13.08.2026, Mockup-Runden 3+4 aus Georgs
Design-Canvas): tiefdunkler Navy-Grund, Elektroblau als Marken- und Auswahlfarbe,
Signalrot für alles Lebendige (läuft, wartet auf Antwort, Lauf starten), Schrift
Archivo (lokal gebündelt), Zahlen und Protokolle in JetBrains Mono. Das Fenster hat
eine eigene dunkle Titelleiste (Blitz-Logo, „FlowForge WERKBANK", Brotkrume zum
Zurückspringen); Windows zeichnet nur die drei Fensterknöpfe. Der **Kontext-Füllstand**
erscheint als Balken mit roter Marke an der Übertrags-Schwelle — in der Lauf-Ansicht
und auf der Hero-Kachel.

- **Projektübersicht** beim Start: Läuft gerade ein Lauf, liegt er als große
  **Hero-Kachel** obenauf (Pulspunkt, Workflow, letzte Tickerzeile, Kontext-Balken,
  „Zum Lauf"); darunter die übrigen Projekte als Kacheln mit Zustands-Abzeichen (seit
  Bauschritt 15: „läuft", „wartet auf deine Antwort" — mit „Zum Gespräch", das direkt
  in den Lauf-Tab springt —, „wartet in der Warteschlange", sonst der Ausgang des
  letzten Laufs samt Zeitpunkt) + „Neues Projekt". Die Zustände aktualisieren sich
  live, während Läufe im Hintergrund weiterlaufen; sind mehrere Läufe aktiv oder
  eingereiht, erinnert eine Hinweisleiste an den vervielfachten Verbrauch.
- **Projektansicht** dreigeteilt: links **Karten-Seitenleiste** (filterbar), Mitte
  **Leinwand**, rechts **Blockbibliothek** (Vorlagen + eigene Blöcke).
- Die Mittelspalte hat **Tabs** (Feedback Georg, 07.08.2026 — vorher stapelte sich
  alles mit Scrollleisten): **Schaubild** (Workflow bearbeiten, Start,
  Kartenauswahl) · **Lauf** (Verbrauch, Stopp, Gespräch, Liveticker, Rohprotokoll,
  Ergebnis) · **Laufberichte** (seit Bauschritt 15 filterbar nach Ausgang; Details je
  Bericht mit Dauer und den Ergebnissen jedes Blocks) · **Sicherungspunkte**. Beim Lauf-Start wechselt
  die Ansicht automatisch zum Lauf-Tab; wartet dort eine Frage, zeigt der Tab
  einen roten Punkt. Die laufende Block-Karte bleibt im Schaubild-Tab hervorgehoben.

## 10. Bewusst NICHT in V1

- Anbieterneutralität und eigene Motoren gegen fremde Anbieter-APIs (→ V2, durch den
  Motor-Anschluss vorbereitet; der API-Schlüssel-Modus der Claude-CLI und die lokale
  Helfer-KI (§2, §4.3) existieren dagegen schon in V1)
- Englische Oberfläche (→ V2, durch zentrale Texte vorbereitet)
- Import/Export von Blöcken, Mehrbenutzer/Accounts, Auto-Update-Mechanismus
- Umbau eines Workflows, während er läuft
- Jede Form von Prozess-Selbstvermessung (Bestandslisten, Nachweis-Register o.ä.)
