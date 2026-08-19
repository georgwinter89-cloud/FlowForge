# FlowForge — Bauplan V1

Grundlage: [SPEC.md](SPEC.md) (die einzige Beschreibung der Gegenwart). Fertige
Schritte erkennt man am Commit „Bauschritt N: …"; die Version in package.json ist 0.N.0.

**Regeln:** Jeder Bauschritt endet mit etwas, das Georg selbst anfassen und prüfen kann
(Alltagstest). Nach jedem Schritt gibt es eine installierbare Version. Ein Schritt pro
Bausession, nichts stapeln. Jeder Block-Arbeitsauftrag gilt erst als fertig, wenn er
einzeln im Ein-Block-Workflow erprobt wurde (nie im Ernstfall zum ersten Mal).
**Kein Kennzeichen ohne Editor-Feld** (Entscheidung Georg, 16.08.2026): Jede neue
Block-Fähigkeit ist ein Kennzeichen, kein Sonderfall — und wird im selben Bauschritt
im Block-Editor wählbar gemacht. Prüfstein: Kann Georg den Block nachbauen? Kann ein
Katalog-Block etwas, das ein selbstgebauter nicht kann, ist es ein Sonderfall und
gehört repariert (Rückstand aus 14: heute darf ein eigener Block von 12 Kennzeichen
nur `nurLesen` setzen — aufgeholt in Schritt 48).

Bauschritte 1–32 sind abgeschlossen und stehen im [BAUPLAN-ARCHIV.md](BAUPLAN-ARCHIV.md)
— Verweise wie „BAUPLAN 19" zeigen dorthin.

## Bauschritte

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
  dahin nur die vorbereiteten, auskommentierten Zeilen).
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
  nicht zusammenpasst — und „Integrator (Recherche)". Eigene baut Georg selbst
  (Schritt 48).
- Er baut **keine Features nach** (was ein Bauer schuldig blieb, geht als
  Beanstandung zurück) und wirft **keine Festlegungen um** (der Vertrag steht).
- **Gebündelte Rückführung, ohne Agent:** Schicken zwei Prüfer denselben Bauer
  zurück, sammelt FlowForge ihre Beanstandungen (die seit 42 als Felder vorliegen)
  und schickt ihn **einmal** mit allen zurück — eine Reparatur-Runde statt zwei.
  Reine Mechanik, 0 Tokens, wie das Tor aus Schritt 35.
- Nachzuziehen: SPEC §4.3 (Integrator), §4.1 (gebündelte Rückführung).
**Alltagstest:** Georg lässt drei Bauer an einem Feature arbeiten und dahinter einen
Integrator: Im Abschlussbericht steht, welche Nähte er geprüft und was er angepasst
hat. Zwei Prüfer, die denselben Bauer beanstanden, lösen **eine** Reparatur-Runde aus.

### 48 — Block-Editor holt auf, Etiketten-Bibliothek
(Wunsch Georg, 16.08.2026: Alle neuen Mechaniken müssen auch selbstgebauten Blöcken
offenstehen — und Etiketten sollen bearbeitbar sein wie Blöcke.)
- **Der Rückstand:** Der Katalog kennt 12 Kennzeichen (plus `modell` aus 37,
  `fuehrtZusammen` aus 47); ein eigener Block darf nur `nurLesen` setzen —
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
- Nachzuziehen: SPEC §4.5 (Editor mit allen Kennzeichen, Etiketten-Bibliothek),
  §4.2 (Etikett mit Form).
**Alltagstest:** Georg baut sich per Assistent einen eigenen Prüf-Block und ein
eigenes Etikett „Marktanalyse" mit drei Feldern, steckt beides in eine Kette und lässt
sie laufen: Sein Block meldet über den Lieferschein wie ein Katalog-Block, und eine
unvollständige Marktanalyse wird sichtbar zurückgewiesen.

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
