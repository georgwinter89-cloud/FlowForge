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

### 3.2 Laufberichte

Jeder Workflow-Lauf hinterlässt automatisch einen kompakten, strukturierten Bericht (Workflow,
Blöcke, Ergebnisse, Fehlschläge). Reines Nachschlagewerk in der App — wird **niemals automatisch
in den Kontext künftiger Sessions geladen** und nie von Hand gepflegt.

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

- Ein Workflow ist eine **gerade Kette** von Blöcken. Parallelität existiert **innerhalb** von
  Blöcken (z.B. Audit-Block startet intern zwei Prüfer) — die Leinwand bleibt übersichtlich.
- **Fehlschlag-Rückführung:** „bei Fehlschlag zurück zu Block X" (braucht der Prüfer sofort).
  Standard **2 Reparatur-Runden** (pro Workflow verstellbar); danach hält der Lauf an und stellt
  eine Folgen-Frage („Weitermachen, zurückstellen oder Stand wiederherstellen?").
- Freie Verzweigungen auf der Leinwand: bewusst nicht in V1.

### 4.2 Anatomie eines Blocks

Name · Symbol · **Arbeitsauftrag** (Anweisung an den Agenten) · **braucht / liefert**
(z.B. „braucht: Angriffsliste, liefert: geprüften Code") · optionale **Sperren**
(„darf nur lesen", „Pflichtfeld leer = Lauf hält an").

Kernprinzip (Life-OS-Lehre): **Blöcke erzwingen, statt zu bitten** — Sperren und Pflichtfelder
blockieren den Weiterlauf, Regeln stehen nicht nur als Text im Prompt.

### 4.3 Blockbibliothek V1

Kontext laden · Spec-Interview · Paket schneiden · Angreifer (nur lesend) · Bauer ·
Prüfer (schreibt eigene Tests, liefert Rot-vor-Grün-Beleg; „≠ Bauer" heißt technisch:
frische Session ohne das Arbeitswissen des Bauers) · Diagnose ·
Frage an den Menschen (Folgen-Fragen, keine Technik-Fragen) · Audit · Sessionende.

### 4.4 Vorlagen-Workflows

| Vorlage | Kette |
|---|---|
| **Neue App starten** | Spec-Interview (grillt den Nutzer, erzeugt erste Karten) → Paket schneiden → Angreifer → Bauer → Prüfer → Sessionende |
| **Feature hinzufügen** | Kontext laden → Paket schneiden → Angreifer → Bauer → Prüfer → Sessionende |
| **Bug jagen** | Kontext laden → Diagnose (Ursache belegen, bevor etwas angefasst wird) → Bauer (minimaler Fix) → Prüfer mit Rot-vor-Grün → Sessionende |

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
- **Kontext-Zuführung:** Beim Start wählt die App relevante Karten automatisch vor (Status-Karte
  immer); der Nutzer kann per Drag & Drop hinzufügen/rauswerfen, dann Start.
- **Parallelität:** Bis zu **3 Workflows gleichzeitig, aber nur in verschiedenen Projekten.**
  Pro Projekt schreibt immer nur **ein** Agent (mehrere lesende erlaubt). Weitere Starts landen
  in einer Warteschlange und laufen automatisch an.

## 6. Live-Ansicht & Eingriff

- **Klartext-Liveticker** + hervorgehobener laufender Block auf der Leinwand.
- **Rohprotokoll** einklappbar für den Blick hinter die Kulissen.
- **Stopp in zwei Stufen:** „Sanft anhalten" (laufender Block macht fertig, Halt am
  Sicherungspunkt) und „Sofort abbrechen" (Block gilt als nicht gelaufen; der Projektordner
  springt automatisch auf den letzten Sicherungspunkt zurück).
- **Frage-an-den-Menschen-Blöcke** pausieren den Lauf; Windows-Benachrichtigung, Antwort in der App.

## 7. Rechte des Agenten (Standard, später pro Projekt verstellbar)

| Ohne Rückfrage | Mit Rückfrage |
|---|---|
| Im Projektordner schreiben/löschen | Alles außerhalb des Projektordners |
| Programmbibliotheken installieren (offizielle Quellen) | Sonstige Internetzugriffe |
| Tests ausführen | Alles Unumkehrbare |

Übergangsregel, bis die echten Arbeitsauftrags-Blöcke stehen (Bauschritt 7): Kommandozeilen-
Befehle lösen **immer** eine Rückfrage aus — auch Tests und Installationen. Sicherer Standard,
solange die Blöcke die Befehle noch nicht einordnen können.

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
- Freie Verzweigungen/Parallelstränge auf der Leinwand
- Umbau eines Workflows, während er läuft
- Jede Form von Prozess-Selbstvermessung (Bestandslisten, Nachweis-Register o.ä.)
