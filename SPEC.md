# FlowForge — Produkt-Spezifikation V1

Stand: 07.08.2026 · Ergebnis der Grilling-Session (5 Runden) · Status: **wartet auf Freigabe durch Georg**

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
  - **V2-Motoren:** eigene Agenten-Kreisläufe gegen beliebige Anbieter-APIs sowie lokale KI
    (z.B. Ollama). Die restliche App merkt nicht, welcher Motor dranhängt.

## 3. Projekte

- Jede gebaute App = ein Projektordner. **Ablageort frei wählbar in der App.**
- Ein Projekt enthält: App-Code, Karten, Workflows, Laufberichte, Sicherungspunkte.
- **Keine Prosa-Chronik, nirgends.** (Lehre aus Life OS: wuchernde Markdown-Dateien ohne Mehrwert.)

### 3.1 Karten (ersetzen jede Prosa-Dokumentation)

Vier Sorten, als strukturierte Datensätze in der App — nicht als Textdateien gepflegt:

| Sorte | Zweck |
|---|---|
| **Aufgabe** | Offen/erledigt; erscheint in der Seitenleiste, wird in Workflows gezogen |
| **Entscheidung** | „X festgelegt, weil Y" — verhindert, dass der Agent Entscheidungen wieder aufrollt |
| **Wissen** | Fakten übers Projekt |
| **Status** | Genau **eine** pro Projekt: „Wo stehen wir gerade" |

**Harte Längengrenze pro Karte (Richtwert 3–5 Sätze; durchgesetzt als 400 Zeichen Inhalt,
80 Zeichen Titel) — gilt auch für den Agenten.** Wer mehr zu
sagen hat, legt mehrere fokussierte Karten an. Die Status-Karte wird beim Anlegen des Projekts
automatisch erzeugt und kann weder gelöscht noch doppelt angelegt werden. Weitere Sorten erst, wenn der Alltag sie einfordert.

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

### 3.3 Sicherungspunkte

- Automatische Sicherungspunkte des Projektordners: beim Anlegen des Projekts, **vor jedem
  Lauf** und **nach jedem erfolgreichen Block** (technisch Git, für den Nutzer unsichtbar —
  sichtbar nur als Liste: „14:32 — Prüfer bestanden").
- Technik-Absicherung: Die Verwaltung nutzt ein eigenes, verstecktes Git-Verzeichnis
  **außerhalb** des Projektordners — das Projekt darf selbst ein Git-Repo sein oder werden.
  Dem Agenten ist Git-Benutzung per Sperre untersagt (hartes Nein, keine Rückfrage).
- Ausgenommen von Sicherung und Wiederherstellung: Laufberichte (bleiben immer erhalten)
  und `node_modules` (per Installation wiederherstellbar).
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
- **Ein-Pfad-Regel bis zur Freischaltung paralleler Zweige** (BAUPLAN Schritt 13): Ein
  Workflow ist ein durchgehender Pfad — ein zweiter Pfeil aus derselben Karte wird mit
  freundlichem Hinweis abgelehnt. Danach sind **parallele Zweige** erlaubt: gleichzeitig
  laufen dürfen mehrere lesende Blöcke, aber höchstens ein schreibender (§5); Zweige werden
  vor dem nächsten gemeinsamen Schritt zusammengeführt. Parallelität existiert außerdem
  **innerhalb** von Blöcken (z.B. Audit-Block startet intern zwei Prüfer).
- **Fehlschlag-Rückführung:** „bei Fehlschlag zurück zu Block X" (braucht der Prüfer sofort).
  Standard **2 Reparatur-Runden** (pro Workflow verstellbar); danach hält der Lauf an und stellt
  eine Folgen-Frage („Weitermachen, zurückstellen oder Stand wiederherstellen?").

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
(bringt die Karten auf Stand). Noch ausstehend: Audit (parallele Prüfer,
Bauschritt 13).
Auftragsquelle von Paket schneiden und Diagnose (Entscheidung Georg,
07.08.2026): das Wunsch- bzw. Fehlerbild-Feld am Block **oder**, wenn es leer
ist, die offenen Aufgaben-Karten der Kartenauswahl — sind beide leer, startet
der Lauf gar nicht erst (freundlicher Hinweis). Ein früherer Block, der selbst
Aufgaben-Karten erzeugt (Spec-Interview), zählt dabei als Quelle; seine neuen
offenen Aufgaben rutschen nach seinem Lauf automatisch in die Kartenauswahl.

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
liefert-Etiketten gespeichert und jedem Folgeblock mit passendem braucht in den
Auftrag gereicht (gekürzt auf 8.000 Zeichen je Übergabe). Daneben gibt es
**optionale Bedarfe** („falls da"): Der Bauer verlangt nur das Arbeitspaket;
eine Angriffsliste wird mitgereicht und muss eingearbeitet werden, wenn ein
Block davor eine liefert — so kommt „Bug jagen" ohne Angreifer aus.

**Prüfer:** schreibt eigene Tests als Testdateien im Projekt, führt sie aus und
liefert einen Rot-vor-Grün-Beleg: mindestens ein Test wird einmal mit absichtlich
verfälschter Erwartung ausgeführt (Rot) und danach unverändert echt (Grün) — ein
Test, der nie rot war, beweist nichts. Ehrlichkeits-Notiz: „Prüfer ≠ Bauer" heißt
technisch „frische Session ohne das Arbeitswissen des Bauers" — jeder Block läuft
ohnehin als frische Motor-Session; es ist kein anderes Gehirn. Prüfer-Blöcke melden
ihr Urteil als letzte Zeile ihres Abschlusstexts („PRUEFUNG: BESTANDEN/FEHLGESCHLAGEN").

**Übungs-Blöcke** bleiben für Probeläufe in der Bibliothek (eigener Abschnitt):
Späher, Mini-Bauer, fairer und strenger Übungs-Prüfer, Karten-Probe, Rechte-Probe.

### 4.4 Vorlagen-Workflows

| Vorlage | Kette |
|---|---|
| **Neue App starten** | Spec-Interview (grillt den Nutzer, erzeugt erste Karten) → Paket schneiden → Angreifer → Bauer → Prüfer → Sessionende |
| **Feature hinzufügen** | Kontext laden → Paket schneiden → Angreifer → Bauer → Prüfer → Sessionende |
| **Bug jagen** | Kontext laden → Diagnose (Ursache belegen, bevor etwas angefasst wird) → Bauer (minimaler Fix) → Prüfer mit Rot-vor-Grün → Sessionende |

Alle drei Vorlagen sind verfügbar (seit Bauschritt 9) — als ziehbare Vorlagen
in der Blockbibliothek, ablegbar nur auf der leeren Leinwand. „Neue App
starten" beginnt mit dem Spec-Interview statt Kontext laden (das Projekt ist
noch leer); „Bug jagen" ersetzt Paket schneiden + Angreifer durch die Diagnose.

### 4.5 Block-Editor

- Nutzer kann Blöcke **erstellen, bearbeiten, löschen** — als Formular entlang der Block-Anatomie.
- **KI-Assistent:** Nutzer beschreibt in normaler Sprache, KI füllt das Formular.
- **Erstellungsassistent in 4 Schritten:** Was soll der Block tun? → Was braucht/liefert er? →
  Welche Sperren gelten? → Probelauf-Vorschau.
- Import/Export von Blöcken: V2.

## 5. Sessions & Autonomie

- **Session = Abschnitt eines Workflow-Laufs.** Das **Sessionende** (Karten aktualisieren,
  Laufbericht schreiben) ist fest eingebaut, kein optionaler Block.
- **Automatischer Übertrag:** Die App misst den echten Kontext-Füllstand. Bei ~85 % aktualisiert
  der Agent die Karten, notiert die exakte Workflow-Position, die App startet automatisch eine
  frische Session (Status-Karte + relevante Karten + Position) und arbeitet nahtlos weiter —
  bis der Workflow fertig ist. Kein zu frühes Stoppen mehr.
- **Übertrags-Grenze pro Workflow einstellbar:** Zahl (z.B. „max. 5") oder „unbegrenzt".
- **Abo-Kontingent erschöpft** (bzw. Ausgaben-Obergrenze erreicht im API-Modus):
  Verhalten in den **Projekteinstellungen** wählbar —
  (a) automatisch pausieren, bei Fenster-Erneuerung selbstständig weitermachen (+ Benachrichtigung)
  oder (b) stoppen und auf manuellen Neustart warten.
- **Kontext-Zuführung:** Beim Start wählt die App Karten automatisch vor — festgenagelt auf
  **Status-Karte (immer) + offene Aufgaben-Karten**; der Nutzer kann weitere Karten per
  Drag & Drop in die Auswahl ziehen und vorausgewählte per Klick rauswerfen, dann Start.
  Die gewählten Karten bekommt der Agent zu Beginn **jedes Blocks** frisch mit.
- **Parallelität:** Bis zu **3 Workflows gleichzeitig, aber nur in verschiedenen Projekten.**
  Pro Projekt schreibt immer nur **ein** Agent (mehrere lesende erlaubt). Weitere Starts landen
  in einer Warteschlange und laufen automatisch an.

## 6. Live-Ansicht & Eingriff

- **Klartext-Liveticker** + hervorgehobener laufender Block auf der Leinwand.
- **Rohprotokoll** einklappbar für den Blick hinter die Kulissen.
- **Stopp in zwei Stufen:** „Sanft anhalten" (laufender Block macht fertig, Halt am
  Sicherungspunkt) und „Sofort abbrechen" (Block gilt als nicht gelaufen; der Projektordner
  springt automatisch auf den letzten Sicherungspunkt zurück).
- **Gespräch** (seit Bauschritt 9): Stellt der Agent eine Frage (Frage-Block,
  Spec-Interview — über das eingebaute mensch-Werkzeug), pausiert der Lauf und
  die Lauf-Ansicht zeigt eine Chat-Ansicht: Verlauf aus Fragen und Antworten,
  Antwort per Options-Klick oder Freitext. Ist das Fenster nicht im Vordergrund,
  kommt eine Windows-Benachrichtigung. Das Gespräch steht auch im Laufbericht.
  Fragen stellen ist auch unter der Sperre „darf nur lesen" erlaubt.

## 7. Rechte des Agenten (Standard, später pro Projekt verstellbar)

| Ohne Rückfrage | Mit Rückfrage |
|---|---|
| Im Projektordner schreiben/löschen | Alles außerhalb des Projektordners |
| Programmbibliotheken installieren (offizielle Quellen) | Sonstige Internetzugriffe |
| Tests ausführen | Alles Unumkehrbare |

Befehls-Einstufung (seit Bauschritt 8): Kommandozeilen-Befehle, die mit einem bekannten
Entwickler-Werkzeug beginnen (node, npm, npx, pnpm, yarn, tsc, vitest, jest, python,
pip, pytest), laufen ohne Rückfrage — das deckt „Tests ausführen" und „Programm-
bibliotheken installieren" ab. Rein lesende Befehle (dir, type, findstr …) ebenso.
Verkettete Befehle laufen nur durch, wenn jedes Teilstück bekannt ist. Alle anderen
Befehle lösen eine Rückfrage aus; Git bleibt hart gesperrt (§3.3). Die Sperre „darf
nur lesen" (§4.2) steht darüber: Sie stoppt jeden nicht rein lesenden Werkzeugaufruf
hart, ohne Rückfrage — Kommandozeilen-Befehle sind dann ganz gesperrt.

## 8. Ergebnis erleben

Jeder Bau-Workflow muss eine **Startanleitung** als Pflicht-Artefakt hinterlassen. Pro Projekt
gibt es einen **„App starten"-Knopf**, der genau diese Anleitung ausführt (Web-App → Browser
öffnet sich; Kommandozeilen-Programm → Fenster mit laufendem Programm; usw.).

## 9. GUI-Grundaufbau

- **Projektübersicht** beim Start: Projekte als Kacheln mit Zustand („läuft", „wartet auf
  Antwort", „letzter Lauf erfolgreich") + „Neues Projekt".
- **Projektansicht** dreigeteilt: links **Karten-Seitenleiste** (filterbar), Mitte **Leinwand**
  (Workflow; wird während eines Laufs zur Live-Ansicht), rechts **Blockbibliothek**
  (Vorlagen + eigene Blöcke).

## 10. Bewusst NICHT in V1

- Anbieterneutralität, API-Betrieb, lokale KI (→ V2, durch Motor-Anschluss vorbereitet)
- Englische Oberfläche (→ V2, durch zentrale Texte vorbereitet)
- Import/Export von Blöcken, Mehrbenutzer/Accounts, Auto-Update-Mechanismus
- Umbau eines Workflows, während er läuft
- Jede Form von Prozess-Selbstvermessung (Bestandslisten, Nachweis-Register o.ä.)
