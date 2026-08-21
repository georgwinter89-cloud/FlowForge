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
gehört repariert (der Rückstand aus 14 — eigene Blöcke durften nur `nurLesen` und
`fuehrtZusammen` setzen — ist seit Schritt 48 aufgeholt; einzig `uebung` bleibt Katalog-Sache,
weil es kein Können ist, sondern „Demo-Block").

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

## Paket 49–51: Lokale Block-Agenten — Opus an den Enden, die lokale KI in der Mitte

(Planungs-Entscheidung Georg, 19.08.2026, nach Abschluss von 48. Zielbild: Paket schneiden,
Integrator und ein Abnahme-Prüfer laufen auf Opus; Bauer und — in zweiter Stufe — der erste
Prüfer laufen auf Georgs lokaler KI. Grundlage: Ollama spricht seit Ende 2025 die
Anthropic-Schnittstelle nativ, und die Claude-CLI bzw. das Agent-SDK lässt sich per Umgebung
dorthin umbiegen — `ANTHROPIC_BASE_URL=http://<ollama>:11434`, `ANTHROPIC_AUTH_TOKEN=ollama`,
`ANTHROPIC_API_KEY=""`, Modell = Ollama-Modellname; Ollama-Doku „Claude Code", Empfehlung
Kontext ≥ 64k. Folge für FlowForge: **kein eigener Agenten-Kreislauf** nötig — ein lokaler
Block ist derselbe Motor mit denselben Werkzeugen, Lieferschein-Meldungen, Sperren und Hooks,
nur mit anderer Umgebung. Die SPEC-Zeile „V2: vollwertiger lokaler Motor" schrumpft damit auf
„zweite Motor-Instanz mit Ollama-Umgebung".)

Leitgedanken: (1) Die Umgebung gilt **je Motor-Prozess** — eine Lauf-Session kann nicht je
Unteraufgabe zwischen Anthropic und Ollama wechseln. Deshalb bekommt ein lokaler Block seine
**eigene Motor-Instanz** (den Mechanismus gibt es seit 46 für parallele Zweige); der Haiku-
Koordinator der Hauptsession sieht ihn nicht, FlowForge reicht danach normal weiter.
(2) Die lokale Helfer-KI (Bauschritt 20–22, `lokal_*`-Werkzeuge) bleibt, was sie ist — ein
lokaler Block-Agent darf sie genauso nutzen wie ein Claude-Block. (3) Was die lokale KI taugt,
entscheiden die Metriken (Reparatur-Runden, Tor-Urteile, Teilstück-Quoten), nicht die Planung.

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

### 50 — Lokaler Prüfer mit Opus-Abnahme
- Prüfer-Block auf „lokal" freigeben — aber die Vorlagen bekommen hinter einem lokalen
  Prüfer eine **Pflicht-Abnahme durch einen Claude-Prüfer** (Zweitaudit-Muster aus 0.46.2:
  die Prüfung der Prüfung ersetzt die Prüfung); die Steck-Prüfung sagt es, wenn ein lokaler
  Prüfer allein vor dem Sessionende steht (Hinweis, keine Sperre — „Rückfrage statt Sperre").
- Das Tor ohne KI (35) ist hier der Anker: Der Prüfbefehl des lokalen Prüfers wird mechanisch
  nachgespielt, das Urteil hängt nicht allein an seiner Urteilskraft.
- Metrik „Urteil lokal vs. Abnahme Opus" (wie oft widerspricht die Abnahme?) — das ist die
  Zahl, an der Georg entscheidet, ob der lokale Prüfer bleibt.
- **Gebaut (19.08.2026):** Tor-Anker in knotenAusfuehren (Messung torMessen aus torAbspielen
  herausgelöst; Rot dreht das Urteil mechanisch, die Tor-Meldung ersetzt den Beleg; kein
  doppeltes Abspielen nach grünem Vor-Tor, außer der Prüfer hat einen NEUEN Prüfbefehl
  gesetzt); Abnahme-Erkennung beim Auftragsbau (abnahmeQuellen aus uebergabenAuswahl, Zusatz
  „du bist die Abnahme" hinter dem Beleg, vor einem durchTor-Anlauf frisch gelesen); Bericht-
  Felder urteilLokal/torBestaetigung/abnahme/abnahmeFuer (wandern in den Laufstand); Steck-
  Hinweis ohne Sperre (kettenRegeln.schaubildHinweise, Karte + Schaubild-Kopf + Start-Ticker,
  Knopf „Abnahme-Prüfer einfügen" = abnahmeKarteEinfuegen); rueckfuehrungsZiel-Standard =
  nächster NICHT-prüfender Vorfahre; Vorlage „Feature hinzufügen · lokal" (Vorlagen-Glieder
  tragen jetzt modell/zusatz/zurueckZu); Metrik abnahmeAuswerten (zwei Kacheln + Tabelle
  lokales Modell × Abnahme-Modell; je Paar zählt nur das erste Agenten-Urteil der Abnahme,
  durchTor zählt nicht).
- **Messwerte der Bausession (19.08.2026, 1 Angreifer, 2 Bauer mit Vertrag, 2 Prüfer, Integrator):**
  - Prüfer 1 (Mechanik, 24 Wegwerf-Prüfungen am echten Ablaufplaner): Drehung, Altlasten,
    kein Prüfbefehl, Fan-in (zwei lokale Prüfer vor einer Abnahme → 2 Paare), Rückführung
    der Abnahme zum Bauer (auch ohne gespeicherte Wahl), Verdrängung am Sessionende — alles
    bestanden; 3 Befunde nachgearbeitet (neuer Prüfbefehl nach grünem Vor-Tor wird jetzt
    gespielt; abnahmeQuellen vor dem Vor-Tor frisch; urteilLokal/torBestaetigung im Laufstand,
    eigener Ticker-Text abnahmeDurchTor).
  - Prüfer 2 (Ende-zu-Ende, gebaute App, eigener Datenordner): Vorlage per Drag & Drop korrekt;
    Hinweis + Knopf an der Karte, Einfügen hängt Pfeile um; echter Lauf Paket schneiden →
    Bauer (lokal) → Prüfer (lokal) → Prüfer · Abnahme (Sonnet) → Sessionende: 1457 s
    (33/422/914/56/28), Tor-Anker grün, Abnahme bestätigt, beide Urteile im Bericht und in
    den Metrik-Kacheln, lokale Blöcke Kosten 0.
  - **Kritischer Fund (Prüfer 2): 0.49.0 war im Installer funktionsunfähig** — das in
    Bauschritt 49 eingeführte `liste(z.string()).max(4)` (menschWerkzeuge) warf beim
    Server-Aufbau einen TypeError VOR dem try des Motors, schleife.catch verschluckte ihn:
    kein Motor startete, jeder Lauf hing still am ersten Block (die 49er-Messläufe liefen
    vor diesem Commit). Behoben: liste(element, deckel); die Motor-Schleife löst den offenen
    Block bei einem Schleifen-Fehler jetzt als Fehlschlag auf (Lauf- und Chat-Motor); neue
    Prüfung baut jeden Werkzeug-Server wirklich. **Georg muss 0.50.0 installieren — 0.49.0
    startet keine Läufe.**
  - Offen (bewusst, Schwere 3): In der Kette lokal → lokal → Abnahme trägt der ERSTE lokale
    Prüfer immer den Hinweis (sein Beleg wird vom zweiten verdrängt — konsistent mit dem
    Lauf); Bibliothek-Klappentitel überlappt beim Scrollen (vorbestehend, kosmetisch).
**Alltagstest:** Kette Bauer (lokal) → Prüfer (lokal) → Prüfer (Opus) → Sessionende; der
Laufbericht zeigt beide Urteile nebeneinander.

### 51 — Lokale Blöcke in der Welle und im Alltag
- Mehrere lokale Bauer parallel, sobald mehrere Ollama-Adressen/GPUs eingetragen sind
  (Einstellungen: Liste statt eine Adresse); sonst nacheinander mit ehrlichem Ticker-Grund.
- Kosten-/Kontingent-Sicht: Metriken zeigen je Lauf „davon lokal" (Tokens, Dauer) neben dem
  Abo-Verbrauch; Empfehlung im Co-Pilot, welche Blöcke lokal gut liefen.
- **Gebaut (20.08.2026):** Einstellungen führen `lokaleHelferAdressen` als Liste (Migration
  nur in einstellungenLaden, Einzelfeld bleibt Spiegel von Element 0 und Anker für Helfer-KI/
  Vorreparatur; Listeneditor mit Live-Status je Zeile); Ablaufplaner baut je Lauf einen
  Adress-Pool (parallel geprüft/bereitgestellt, nicht bereite Adressen sichtbar ausgeklammert,
  leerer Pool = Fehlschlag), reine `lokaleStartRegel` neben der wellenStartRegel (Zuteilung
  `k.lokalZuteilung` erst nach Adress- UND Wellenregel, gilt für alle Anläufe, Nachlauf hält
  keine Adresse); Ticker-Grund mehradressen-fähig („alle N lokalen KI-Adressen belegt" mit
  Halter-Namen); `bericht.verbrauch.lokal` (Tokens, Dauer) im Hauptprozess geführt,
  Block-Dauer an allen vier Bericht-Pfaden; Metriken mit „davon lokal" je Kette/Projekt/Woche
  und Ø-Dauer in Blocktyp × Modell; reine `lokaleBilanz` (Schwellen 5/0.7/0.2, Deckel 15) als
  Datenblock im Co-Pilot-Systemtext (SPEC-Präzisierung: das Metriken-Verbot zielt auf
  Lauf-Agenten). **Dazu behoben: 49er-Altfehler Kontextfenster-Vergiftung** — ein lokaler
  Block drückte die gelernte Fenstergröße aller folgenden Claude-Blöcke auf sein
  Ollama-Fenster (Überträge kämen ~3× zu früh); gelernt wird jetzt nur von Claude-Sessions.
- **Messwerte der Bausession (20.08.2026, Workflows: 4 Leser + Angreifer, 2 Bauer mit
  Vertrag in Worktrees, 2 Prüfer, Integrator):** Angriffsliste 12 Funde (3 blockierend, alle
  ausgeräumt). Prüfer 1 (Mechanik, 38 Wegwerf-Prüfungen): 36 grün; Befund B1 nachgearbeitet
  (Speichern ohne Adressfelder verlor die Liste — übernimmt sie jetzt aus der Datei,
  Einzelfeld ersetzt nur den Anker). Prüfer 2 (Ende-zu-Ende, gebaute App, eigener
  Datenordner): Migration/Listeneditor/Nacheinander-mit-Grund/Ausklammern/Ø-Dauer bestätigt,
  Ticker-Wortlaute gemessen; nachgearbeitet: lokale Tokens zählen aus der
  Modell-Aufschlüsselung, wenn der Faden-Zuwachs 0 meldet (gemessen 0 vs. 48.419);
  Ausklammer-Text ohne „starte den Lauf neu"; api_retry-Zeile nennt beim lokalen Motor die
  Ollama-Adresse. Ehrliche Grenze der Prüfung: Der echte Durchlauf scheiterte am
  Testrechner-Modell qwen2.5:7b (liefert als Block-Agent kein Fazit — kein 51er-Fehler; die
  49/50-Läufe fuhren auf flowforge-qwen3.8-27b, das derzeit nicht installiert ist). Der
  Parallel-Fall mit zwei echten GPUs blieb ungemessen (nur eine vorhanden) — mechanisch von
  Regel- und Verhaltens-Tests gedeckt (2 Adressen → getrennte Zuteilungen, Dritter erbt).
**Alltagstest:** Zwei lokale Bauer in einer Welle (oder nacheinander mit Grund im Ticker),
Metriken weisen den lokalen Anteil des Laufs aus.

### Zwischenschritt 0.51.1 — Lokale Blöcke überleben lange Arbeit
(Geplant 20.08.2026 aus der Analyse von Georgs erstem fast-komplett-lokalen Lauf
[Life OS, Laufbericht `D:\Projekte\Erweiterung Life OS\laufberichte\2026-08-20T05-54-58-099Z.json`,
Denk-Export `C:\Users\Patro\Downloads\Lokal Thinking.JSON`]. Befund: 4h13m, fehlgeschlagen;
Bauer 3 starb nach 87 min mit rohem „Prompt is too long" [410k Eingabe gegen 128k-Fenster,
`uebertraege: []`, `zusammenfassungen: []`], Bauer 4 nach 109 min mit „[Request interrupted
by user for tool use]" als Fehlertext, obwohl Georg nichts unterbrochen hat [11 min Stille
nach automatisch erlaubter Rechte-Frage, dann Abbruch aus der Werkzeug-Schicht]. Die
51er-Zählung selbst stimmte aufs Token [davon lokal = Summe der lokalen Blöcke, Wächter
hielt die Lauf-Session auf 200k]. Wurzel-Diagnose, in 49 schon gemessen: Die CLI hält
fremde Modelle für 200k-Fenster — ihre eigene Zusammenfassung [Compaction] rechnet gegen
die geglaubten 200k und feuert nie, bevor Ollama bei real 64k/128k ablehnt. Lokale Blöcke
haben damit KEINE der drei Schutzschichten der Claude-Blöcke [großes Fenster, Compaction,
Prompt-Cache]. Der 85%-Übertrag hilft nicht — er misst den Koordinator-Faden, nicht den
Block-Agenten [Klarstellung Georg, 20.08.2026]. Dazu: Die Helfer-Aufrufe des lokalen
Block-Agenten liefen gegen dieselbe belegte GPU — 48 Timeout-Meldungen, 57
lokal_bauen-Versuche, der Agent fiel aufs Selbermachen zurück und blähte den Kontext.)
- **Wahres Fenster für lokale Instanzen:** In der Ollama-Umgebung der lokalen Motor-Instanz
  (claudeCodeMotor.js, bei ANTHROPIC_BASE_URL/Alias-Setzung ~Z.1536-1551)
  `CLAUDE_CODE_MAX_CONTEXT_TOKENS` = Kontextfenster aus den Einstellungen setzen. Offiziell
  dokumentiert (code.claude.com/docs model-config, „Correct the window for a gateway or
  custom model ID"; geprüft 20.08.2026, SDK 0.3.224): gilt für Modellkennungen, die nicht
  mit „claude-" beginnen — unsere `flowforge-…` passt. Damit feuert die CLI-eigene
  Zusammenfassung am echten Fenster; die Ticker-Zeile dafür existiert seit Schritt 36.
  `CLAUDE_CODE_AUTO_COMPACT_WINDOW` hat laut Doku Untergrenze 100.000 — nur setzen, wenn
  Kontext ≥ 128k, sonst weglassen. ACHTUNG: Die Umgebungs-Bereinigung des Motors muss die
  neue Variable durchlassen (bekannte Stolperstelle, wie damals ANTHROPIC_*). Ehrliche
  Grenze in die SPEC: Die Zusammenfassung schreibt das lokale Modell selbst — Qualität
  beim ersten echten Lauf messen.
- **Deutsche Klartexte statt roher CLI-Fehler:** „Prompt is too long" (stand roh im Ticker
  und als ergebnisText) → Alltagssprache mit Ursache („Das Arbeitsgedächtnis des lokalen
  Blocks ist übergelaufen …"); „[Request interrupted by user for tool use]" →
  Text OHNE Nutzer-Beschuldigung (der Abbruch kam aus der Werkzeug-Schicht/Ollama, nicht
  von Georg). Einstiegspunkte: fehlerAusErgebnis (claudeCodeMotor.js:917) und die Stellen,
  die ergebnisText/fehlertext aus dem CLI-Ergebnis übernehmen.
- **Helfer-Werkzeuge lokaler Blöcke stummschalten:** Ein lokaler Block-Agent IST die lokale
  KI — Delegieren an dieselbe GPU ist sinnlos und im Lauf gemessen schädlich. Für Blöcke
  der Klasse „lokal": lokale Helfer-Werkzeuge nicht freischalten und die Auftrags-Zusätze
  (bauenAuftragZusatz, lokal_recherchieren-Hinweise) weglassen. Bewusst NICHT: Helfer auf
  eine zweite Pool-Adresse legen (bräuchte zweite GPU; eigener Schritt, falls je nötig).
- **Systemtext im abgeleiteten Modell — GESTRICHEN (Messung 20.08.2026):** Die Vorab-Messung
  fiel negativ aus: Sobald die Anfrage einen eigenen Systemtext trägt (die CLI schickt immer
  einen), ersetzt Ollamas Anthropic-Endpunkt den Modelfile-SYSTEM vollständig — er wird nicht
  einmal in die input_tokens gezählt (gemessen an qwen2.5:7b: Marker-SYSTEM wirkt ohne
  request-system, verschwindet mit; 35 vs. 50 Tokens). Der Punkt ist wirkungslos und fliegt
  raus, wie oben vorentschieden. Wer das lokale Modell deutsch und sparsam arbeiten lassen
  will, muss es über den Auftrag tun (Auftrags-Diät, siehe Kleinmessung).
- **Kleinmessung:** Die Eingabe-Token-Zahl des ersten Ollama-Turns eines lokalen Blocks als
  Ticker-Zeile („Start-Prompt des lokalen Blocks: ~15.400 Tokens von 65.536") — macht die
  Auftrags-Diät-Frage später mit Zahlen entscheidbar (Rechnung 20.08.: Start ≈ 14–17k von
  64k, größter steuerbarer Posten sind die zwei 8.000-Zeichen-Übergaben).
- **Automatische Zusatznamen aus dem Zuschnitt (Wunsch Georg, 20.08.2026):** `paket_melden`
  bekommt im Schema je Ziel ein Pflichtfeld **Kurzname** (2–3 Wörter, Längendeckel;
  FlowForge validiert und nummeriert Dopplungen mechanisch nach). FlowForge heftet den
  Kurznamen an die Ziel-Instanz, sobald der Zuschnitt gemeldet ist — er läuft überall mit,
  wo der Zusatzname durchgereicht wird (Ticker, Warte-Gründe, Laufbericht,
  Block-Ergebnisse; Metriken führen Katalogname/Zusatz ohnehin getrennt, Schritt 41).
  Zwei Regeln: Georgs eigener Zusatzname an der Karte GEWINNT immer (automatisch nur bei
  leerem Feld); der automatische Name gilt NUR für den Lauf, die Leinwand-Karte bleibt
  unangetastet (Entscheidungsgrund: die Leinwand gehört dem Nutzer, und ein geänderter
  Karten-Zusatzname macht seit Schritt 41 den Laufstand ungültig — der Laufzeit-Name
  umgeht beides). Er darf im Laufstand mitwandern (kommt aus den Paket-Daten, die dort
  ohnehin liegen), die Wiederaufnahme-Prüfung bleibt unberührt.
- Nachzuziehen: SPEC §2 (Klasse lokal: wahres Fenster, Zusammenfassung durch das lokale
  Modell, keine Helfer-Werkzeuge), §5 (lokale Blöcke: Compaction statt Übertrag, Grenze
  ehrlich), §4.3 (Helfer-KI: gilt nicht für Blöcke der Klasse lokal; Zuschnitt:
  Kurzname je Ziel, Laufzeit-Zusatzname), §4.1 (Zusatzname: automatische Laufzeit-Namen).
- Empfehlung an Georg (kein Code): Kontextfenster zurück auf 64k — 128k-KV-Cache sprengt
  die 32-GB-Karte (RAM-Kriechgang war die zweite Todesursache des Laufs); Blöcken
  Zusatznamen geben („Bauer · Server"), sonst heißt es „«Bauer» wartet auf «Bauer»".
**Alltagstest:** Georg wiederholt den Life-OS-Lauf mit 64k: kein „Prompt is too long",
stattdessen bei Bedarf sichtbar „Der Motor hat das Arbeitsgedächtnis … zusammengefasst"
oder der FlowForge-Wächter übergibt an einen frischen Anlauf;
keine Helfer-Timeout-Kaskade bei lokalen Blöcken; scheitert doch etwas, steht die Ursache
auf Deutsch im Bericht und beschuldigt nicht den Nutzer. Im Ticker heißen die zwei
unbenannten Bauer nach dem Zuschnitt automatisch z. B. „Bauer · Server-Briefing" und
„Bauer · Ruheanzeige Web" — die Karten auf der Leinwand bleiben unverändert.
- **Gebaut (20.08.2026):** Kernbefund der Angriffsliste: `CLAUDE_CODE_MAX_CONTEXT_TOKENS`
  war seit Schritt 49 gesetzt und die CLI honoriert es (im CLI-Binary belegt; Auto-
  Zusammenfassung gilt auch für Block-Agenten) — aber sie misst den Füllstand allein an
  Ollamas usage-Meldung, und die ist GEMESSEN nur unterhalb der Fensterkante ehrlich:
  Übersteigt ein Prompt das Fenster, kappt Ollama still (HTTP 200, Modell sieht Müll) und
  meldet dauerhaft ~die Fensterhälfte. Ein großer Werkzeug-Ergebnis-Sprung überspringt so
  die CLI-Schwelle für immer — exakt der Life-OS-Tod. Deshalb (Entscheidung Georg):
  **FlowForge-eigener Lokal-Wächter** — Zeichen-basierte Füllstands-Schätzung des
  Block-Agenten (reine Funktionen, Faktor 3,5 Zeichen/Token, Selbst-Kalibrierung an der
  ehrlichen Erstmeldung mit 90-%-Deckel), löst bei 80 % den vorhandenen Übertrag aus;
  Schwelle wird nach JEDER Nachricht geprüft (auch direkt nach tool_result). Dazu:
  Start-Prompt-Messzeile je lokalem Block (gemeldet vs. eigener Anteil, gemessen Faktor
  6–20 durch den Werkzeug-Vorspann der CLI); deutsche Klartexte für „Prompt is too long"
  und „[Request interrupted by user for tool use]" an Ticker, Blockergebnis (toter Block
  läuft nie mehr als „erfolgreich" durch) und fehlerAusErgebnis (vor der Kontingent-Regel,
  neue Arten kontext-voll/werkzeug-abbruch; kein Abbruch-Echo nach eigenem Stopp/Übertrag);
  gemeinsame `umgebungBereinigen`-Funktion für alle drei Motor-Sessions inkl. präfixloser
  CLI-Schalter (DISABLE_*, API_TIMEOUT_MS, MCP_*, BASH_*, MAX_* — geerbte Schalter einer
  Claude-Code-Elternsession änderten sonst still Compaction und Timeouts); Helfer-Werkzeuge
  lokaler Blöcke stumm (lokale Motor-Instanz ohne lokaleHelfer, kein bauenAuftragZusatz,
  Katalog-Hinweis ersetzt, keine lokale Vorreparatur nach lokalem Prüfer); Kurzname je
  benanntem Ziel in melde_arbeitspaket (Schema optional, Pflicht in Ebene 2 nur bei
  zielBlock, Auftragstexte von Paket schneiden/Angreifer), Laufzeit-Zusatzname an der
  Ziel-Instanz (Georgs Karten-Name gewinnt, erster Melder gewinnt, Dopplungen nummeriert,
  eigenes Laufstand-Feld laufzeitZusaetze neben zusaetze), Warnzeile bei Kontextfenster
  unter 48k (CLI-Reserve ~33k; 32k läuft im ersten Turn über, gemessen: Start-Prompt allein
  ~23k = 69 % von 32k).
- **Messwerte der Bausession (20.08.2026, 1 Angreifer, 2 Bauer mit Vertrag in Worktrees,
  2 Prüfer, Integrator; Agents auf Opus 5, Ansage Georg):** Angriffsliste 10 Funde (3
  blockierend: Punkt 1 war schon gebaut und wirkungslos aus anderem Grund; Klartexte am
  falschen Einstiegspunkt geplant; Kurzname am falschen Werkzeug geplant — paket_melden hat
  keine Ziele). Prüfer 1 (Mechanik, 102 Wegwerf-Prüfungen): 6 wichtige Befunde
  nachgearbeitet (Schwelle nach jeder Nachricht, Selbst-Kalibrierung, Abbruch-Echo,
  Zuschnitt-Zeile mit frischen Namen, Schalterliste, umhüllte Marken). Prüfer 2
  (Ende-zu-Ende, gebaute App, CDP, eigener Datenordner, Ersatzserver für Georgs 27B):
  Wächter übergab zweimal sauber bei 64k („~54.206 von 65.536 geschätzt"), Klartexte in
  Ticker und Bericht, 35 Werkzeuge ohne ein einziges mcp__lokal__*, Kurzname-Abweisung
  sichtbar mit Nachtrag, workflow.json bytegleich, Georgs Karten-Name gewinnt; eine
  Regression meiner P1-Nacharbeit gefunden und behoben (Abbruch-Text verlor Ollama-Fassung
  und Ticker-Zeile). Bewusst offen (klein): „Fertig nach N Sekunden" auch bei Fehlschlag
  (vorbestehend, alle Blockarten); Berichtskopf (workflow/bloecke) ohne Zusatznamen
  (vorbestehend); Auftrags-Vorspann nennt Ziele mit Karten-Namen statt Laufzeit-Namen
  (Vorspann entsteht vor dem Lauf aus der Leinwand); Nummerierung deckelt bei 99;
  529-Meldung schlägt kontext-voll. Ehrliche Grenze: qwen2.5:7b ruft das Agent-Werkzeug
  nie — der volle lokale E2E-Beleg braucht Georgs 27B (Start-Prompt-Zeile liefert dafür
  jetzt die Zahlen).

### Zwischenschritt 0.51.2 — Websuche für lokale Blöcke
(Wunsch Georg, 20.08.2026. Anlass: Georgs Hinweis, dass die Qwen3.8-Generation darauf
trainiert ist, bei erkannter Unsicherheit selbständig zu suchen — **gemessen am 20.08.2026**
an qwen3.8-davidau:27b über Ollamas Anthropic-Endpunkt: Frage nach der „diese Woche
aktuellen" Electron-Version mit angebotenem web_suche-Werkzeug → Denkspur wörtlich „Da ich
keinen Echtzeit-Zugriff auf das Internet habe, kann ich nicht verifizieren …", dann sauberer
tool_use-Aufruf. Der Reflex ist da; ihm fehlt nur der Stecker: Die WebSearch der CLI läuft
über Anthropics Server und existiert für den lokalen Motor nicht. Entscheidung Georg gegen
Chrome MCP (Dutzende Werkzeug-Definitionen im ohnehin ~23k schweren Start-Prompt, falsches
Kaliber fürs Nachschlagen) und für zwei schlanke Werkzeuge mit wählbarer Quelle.)
- **Zwei rein lesende Werkzeuge** im bestehenden MCP-Muster, registriert NUR an der
  lokalen Motor-Instanz (Opus-Blöcke haben WebSearch/WebFetch der CLI und bleiben
  unverändert): `web_suche` (Suchbegriff → Titel, Adresse, Kurztext je Treffer, Anzahl
  gedeckelt) und `webseite_lesen` (Adresse → Seitentext, hart gedeckelt — der
  Lokal-Wächter aus 0.51.1 zählt die geladenen Texte ohnehin mit).
- **Wählbare Quelle (Entscheidung Georg):** Standard „eingebaut, kostenlos" (Abfrage ohne
  Konto, ehrliche Ticker-Zeile, wenn die Quelle nichts liefert — geduldet, nicht
  garantiert); dazu in den Einstellungen ein Feld **„SearXNG-Adresse"** (eigene Instanz,
  JSON-Format, Live-Status wie bei den Ollama-Adressen). Umstieg = Adresse eintragen,
  kein Umbau. Die SearXNG-Einrichtung selbst (Docker auf dem Gaming-PC) ist Georgs
  Nachmittagsprojekt mit geführter Anleitung, kein FlowForge-Code.
- **Ehrliche Grenze in die SPEC:** Webseiten sind Fremdtext an einem schreibberechtigten
  Agenten (Anweisungs-Einschleusung möglich; ein lokales Modell ist leichter reinzulegen
  als Opus). Mechanische Gegenmittel benennen: harte Größendeckel, Datenvertrag- und
  Verwaltungsdatei-Sperren greifen unabhängig vom Gelesenen; Ticker macht jeden
  Internet-Zugriff sichtbar.
- Nachzuziehen: SPEC §2/§4.3 (Werkzeuge der Klasse lokal), §7 (Einstufung rein lesend,
  wie die Internet-Werkzeuge der CLI), §9 (Einstellungs-Feld SearXNG-Adresse).
**Alltagstest:** Georg gibt einem lokalen Bauer eine Aufgabe mit einer Wissenslücke
(z. B. „nutze die aktuelle Version von X"): Im Ticker erscheint die Such-Zeile, danach
das Lesen eines Treffers, und das Ergebnis stimmt. Ohne erreichbare Quelle steht eine
ehrliche Fehlzeile im Ticker statt stillen Ratens. Trägt er seine SearXNG-Adresse ein,
zeigt der Live-Status grün und die Suche läuft darüber.
**Gebaut, und was dabei gemessen wurde (21.08.2026)** — für die nächsten Schritte wichtig:
Die eingebaute Quelle ist **schwächer als beim Planen angenommen**: schon die dritte Suche
hintereinander lief in die Sperre, und die hielt in einer Messung über 96 Minuten trotz
Funkstille. Sie trägt Gelegenheits-Nachschlagen; für Dauerrecherche ist die eigene
SearXNG-Instanz keine Kür, sondern Voraussetzung — und die liefert im Auslieferungszustand
**kein JSON** (`settings.yml`, `search: formats: [html, json]`). Zwei Fallen, die erst die
Prüfer fanden und die für jedes künftige Fremdtext-Werkzeug gelten: (a) Das Entkernen von
HTML mit fauler Regex-Wiederholung ist quadratisch und blockiert den **ganzen**
Electron-Hauptprozess — gemessen 232 s bei 1 MB, dabei läuft kein Timer, also hilft kein
Zeitlimit; jetzt lineare Helfer (4 ms). (b) Ein Deckel, der nur auf einem Feld sitzt, ist
kein Deckel: Titel und Adresse eines Treffers waren ungedeckelt (481.553 Zeichen in einer
Suche). Ehrliche Grenze, unverändert offen: kein Lauf gegen Georgs qwen3.8-davidau:27b und
keine echte SearXNG-Instanz mit JSON — der Alltagsweg selbst ist damit ungeprüft.

### Zwischenschritt 0.51.3 — Speicher-Ehrlichkeit der lokalen KI
(Wunsch Georg, 20.08.2026; Reihenfolge-Entscheidung Georg: NACH der Websuche [0.51.2],
weil an der bereits eine andere Session arbeitet. Aus der Analyse des Wiederholungslaufs Life OS
[2026-08-20T16-24-42-941Z]: Alle 0.51.1-Bauten griffen — Kurznamen, Start-Prompt-Zeile
23.539/8.361 von 131.072, Helfer stumm, deutscher Abbruch-Text, Block ehrlich
fehlgeschlagen —, aber der lokale Bauer starb nach 72 min am Zeitlimit der
Werkzeug-Schicht: Kontextfenster stand auf 128k, dessen KV-Cache [~30 GB beim 27B]
sprengt die 32-GB-Karte, Ollama lagert in den System-RAM aus [Georg gemessen: 7,5 →
42 GB], jeder Gesprächswechsel rechnet das volle Gespräch im RAM-Kriechgang neu durch,
und ab der Zeitlimit-Kante wird „langsam" zu „tot" — 11 min Stille, dann Abbruch. Der
Lokal-Wächter feuerte korrekt nicht: Es war kein Kontext-Überlauf, sondern Speicherdruck,
den FlowForge bisher nicht sehen kann.)
- **VRAM-Passt-Prüfung:** Nach dem ersten Turn des ersten lokalen Blocks je Adresse
  (das Modell ist dann sicher geladen; derselbe Einmal-Moment wie die
  Start-Prompt-Zeile) fragt FlowForge Ollamas Prozessliste ab (`/api/ps`: `size` vs.
  `size_vram` des abgeleiteten Modells). Liegt das Modell nicht (nahezu) vollständig
  in der Grafikkarte, eine Warnzeile in Ticker und Laufbericht in Alltagssprache:
  Anteil in der Karte, Ursache (Fenster zu groß für den Grafikspeicher), Empfehlung
  (Kontextfenster verkleinern), ehrliche Folge (sonst drohen Zeitüberschreitungen).
  Warnung, keine Sperre (Rückfrage-statt-Sperre-Regel). Je Adresse einmal je Lauf.
- **Geduld der Werkzeug-Schicht als Einstellung (Entscheidung Georg):** Neues Feld in
  den Einstellungen (Bereich lokale KI): „Wartezeit auf Antworten der lokalen KI" —
  Standard (CLI-Vorgabe) / verlängerte Stufen. Wirkt NUR auf die Umgebung der lokalen
  Motor-Instanzen (API_TIMEOUT_MS wird dort gesetzt — die Bereinigung aus 0.51.1
  entfernt weiterhin nur GEERBTE Werte; die Helfer-KI behält ihr eigenes 5-min-Limit).
  Ehrlicher Hinweistext an der Einstellung: Mehr Geduld verhindert den Abbruch, macht
  aber aus einem Speicherproblem kriechende Läufe — die eigentliche Lösung ist ein
  Fenster, das in die Karte passt (siehe Warnzeile).
- **96k-Zwischenstufe bei der Fensterwahl:** Die Auswahl in den Einstellungen (heute
  32k/64k/128k, lokaleHelferKontextWahl) bekommt 96k als Mittelweg — bei 64k bleiben
  nach dem gemessenen Start-Prompt (~23,5k) nur ~28k Arbeitsraum bis zur
  Wächter-Marke, 128k sprengt unkomprimiert die 32-GB-Karte. Mitzuziehen: die
  Werkzeug-/Runden-Deckel (lokaleHelfer.js grenzenFuer — 96k fällt heute in die
  64k-Stufe, bewusst prüfen, welche Stufe fair ist) und die Prüfungen in
  lokaleHelferKontext.test.js.
- **KV-Cache-Kompression als dokumentierter Weg zu 128k:** Georg hat am 20.08.2026
  auf dem Gaming-PC `OLLAMA_FLASH_ATTENTION=1` und `OLLAMA_KV_CACHE_TYPE=q8_0` als
  Benutzervariablen gesetzt (halbiert grob den Zwischenspeicher-Bedarf — 128k passt
  damit voraussichtlich in die 32-GB-Karte; Messung stand beim Planen noch aus, und
  die Verträglichkeit mit der MTP-Beschleunigung ist ungetestet — erster Verdächtiger,
  falls Läufe danach zicken). FlowForge-Anteil: Die Empfehlung gehört als Satz in den
  Hinweistext der Fensterwahl (SPEC §9) — es sind Ollama-Servervariablen, KEINE
  FlowForge-Einstellung (FlowForge kann fremde Server-Umgebungen nicht setzen; die
  VRAM-Passt-Prüfung oben ist der ehrliche Beleg, ob die Kompression wirkt).
- Nachzuziehen: SPEC §2 (Klasse lokal: Speicher-Grenze sichtbar), §9 (neue
  Einstellung, 96k-Stufe, Kompressions-Hinweis), §3.2 (Warnzeile im Laufbericht).
**Alltagstest:** Georg stellt absichtlich ein Fenster ein, das nicht in die Karte
passt, und startet einen lokalen Ein-Block-Lauf: Kurz nach dem Blockstart steht die
Warnzeile mit dem In-der-Karte-Anteil im Ticker; mit passendem Fenster (bzw. dank
KV-Kompression) keine Warnzeile. In der Fensterwahl gibt es 96k. Die neue
Geduld-Einstellung steht in den Einstellungen mit ehrlichem Hinweis und wirkt
nur auf lokale Blöcke.
**Gebaut, und was dabei entschieden wurde (21.08.2026)** — für die nächsten Schritte
wichtig: (a) Die Stufenliste des Kontextfensters stand an **drei** Stellen
(Hauptprozess-Einstellungen, Helfer-Grenzen, Auswahlfeld im Dialog); eine neue Stufe an
nur zwei davon hieße „der Dialog bietet 96k an, das Speichern dreht es still auf 64k
zurück". Sie hat jetzt genau einen Wohnort (`src/shared/lokalRegeln.js`) — dieselbe Falle
lauert bei jeder künftigen Auswahl, die Renderer und Hauptprozess beide kennen müssen.
(b) Die 96k-Runden bekamen eine **eigene** Stufe (80): 96k fiel sonst in die 64k-Stufe und
hätte ein Drittel mehr Fenster ohne einen einzigen Zug mehr bekommen. (c) Die Geduld wird
nach dem Muster der SearXNG-Adresse gespeichert (`undefined` → Wert aus der Datei halten),
nicht nach dem des Kontextfensters — ein Aufrufer, der das Feld nicht kennt, holte sonst
genau den Abbruch zurück, gegen den die Einstellung gebaut ist (gemessen als
Rot-vor-Grün-Fall). (d) Die VRAM-Prüfung schweigt, wenn sie **nicht messen kann**
(Prozessliste weg, Modell nicht in der Liste, Ollama-Fassung ohne `size`/`size_vram`):
Eine Warnung aus einer misslungenen Messung wäre ein Fehlalarm, der Georg genau das
Fenster verstellen ließe, das richtig war. **Gemessen** (21.08.2026, echte HTTP-Runde gegen
einen nachgebauten Ollama in Antwortform von `/api/ps`): halb ausgelagert (18,3 von 30,5 GB)
→ Warnung mit „59 %", ganz in der Karte → still, stummer Server → nach 4 Sekunden still,
ohne den Hauptprozess aufzuhalten. Der Dialog wurde in der gebauten App ferngesteuert
geprüft (Fensterwahl bietet 32k/64k/96k/128k, die Geduld-Stufen stehen mit ehrlichem
Hinweis, beide Werte überleben Speichern und Neuladen). Ehrliche Grenzen, unverändert
offen: kein Lauf gegen Georgs echten Ollama mit halb ausgelagertem 27B-Modell;
die 99-%-Schwelle und die drei Geduld-Stufen
(15/30/60 min) sind gesetzte Werte, keine Messung; und die Vorgabe der Motor-Software für
`API_TIMEOUT_MS` ist nicht dokumentiert — deshalb heißt die Stufe „Standard (Vorgabe des
Motors)" und nennt keine Zahl. Ob die KV-Kompression auf dem Gaming-PC wirklich 128k in
die Karte bringt, beantwortet erst Georgs erster Lauf — die Warnzeile ist genau dafür da.

### Zwischenschritt 0.51.4 — Ein Block, der geliefert hat, wird nicht mehr weggeworfen
(gebaut 21.08.2026, Anlass: Life-OS-Lauf `2026-08-21T06-52-05-704Z`, der nach 2 h 15 min
bei Block 2 von 5 starb, ohne dass etwas gebaut wurde.)
- **Schonung nach abgegebener Lieferung:** Hat ein Block seinen Lieferschein abgegeben,
  steigt die Übertrags-Marke von 80 auf 95 % (`schwelleNachLieferung`, beide Schwellen,
  Testmodus ausgenommen). Der Angreifer hatte seine fertige Angriffsliste in derselben
  Sekunde abgegeben, in der die 80-%-Marke zuschlug — die fertige Session wurde verworfen,
  der frische Anlauf wiederholte 43 Minuten Arbeit und starb dabei.
- **Wartezeit auf lokale Antworten: 30 Minuten als Standard**, Stufe „gar nicht setzen"
  entfallen samt Wanderung beim Laden. Gemessen: Abbruch nach 9 min 59 s bei laufendem
  Server; die Grenze zählt **Stille**, nicht Dauer.
- **Abbruch-Klartext ehrlich gemacht** — er behauptet nicht mehr, Ollama sei überlastet.
- **Widerlegte Speicher-Faustregel raus** (nicht 250 KB je Token, sondern gemessene
  64 KiB bei Hybrid-Bauart; 128k passt unkomprimiert), Systemvariablen statt
  Benutzervariablen im KV-Hinweis, EPERM-Wiederholung beim Schreiben der Einstellungen.
- Ergebnis: Der Wiederholungslauf lief mit 3 h 23 min über **alle fünf Blöcke** durch,
  Prüfer bestanden, 4,88 Mio. Tokens, 0 $, null Überträge.

## Paket 52–53: Projektgedächtnis, das sich selbst bedient

(Gespräch mit Georg, 21.08.2026: „Ich weiß nie so richtig, welche Karten ich einem Lauf
mitgeben soll. Die Karten wurden ja alle automatisch in den Läufen erstellt und nie von
mir." Dasselbe bei den Prüfkarten: „Habe ich noch nie gemacht. Alleine schon weil ich
nicht einschätzen kann, wann welche Prüfung nötig wäre.")

**Die gemeinsame Wurzel:** FlowForge fragt Georg an mehreren Stellen nach **Relevanz** —
welches Wissen ein Lauf braucht, welche alte Prüfung nötig ist. Relevanz ist aber genau
das, was er nicht beurteilen kann: Die Karten haben Agenten geschrieben, er kennt sie
nicht, und mit wachsendem Bestand sinkt seine Trefferquote, während die eines Agenten mit
Index steigt. Seine Entscheidungen sind *was gebaut wird* und *ob es gut genug ist* —
nicht, welche Datei dafür gelesen werden muss.

**Messgrundlage** (Projekt „Erweiterung Life OS", 21.08.2026, 69 Karten): Volltext aller
Karten 8.253 Tokens = 6,3 % eines 128k-Fensters; davon Wissen 2.887, Aufgaben 2.379,
Entscheidungen 1.731, Prüfungen 1.147, Status 110. Reiner Index (Titel, Thema, Sorte)
**1.544 Tokens** — 22 je Karte gegen 120 im Volltext. Wachstum: 64 Karten beim
Projektstart, danach **~5 je erfolgreichem Lauf**, davon 2 dauerhafte.

### Zwischenschritt 0.51.5 — Kartenauswahl: nur noch die Aufgabe wählen
- **Die Auswahl zeigt nur offene Aufgaben-Karten.** Wissen, Entscheidungen und die
  Status-Karte kommen automatisch mit (heute 4.728 Tokens = 3,6 % des Fensters);
  Prüfkarten und erledigte Aufgaben bleiben draußen (heute 18 von 69 Karten, also 26 %
  totes Gewicht, das nur Kontext kostet).
- **Rückfall bei nicht zugeteilten Blöcken** wird „nur Status-Karte" statt wie bisher
  „volle Kartenauswahl". Bisher harmlos, weil Georg die Auswahl klein hält — nach der
  Umstellung landeten sonst Tausende Tokens bei einem Block, der sie nie brauchte.
- Der Vorschlag des Sessionende schrumpft damit auf das, was er ist: **ein Satz
  Empfehlung**, welche Aufgabe dran wäre. Die Karten-Chips daneben entfallen.
- **Alltagstest:** Lauf starten — in der Auswahl stehen nur offene Aufgaben. Eine
  anhaken, starten. Der Bauer kennt trotzdem die Entscheidungs-Karten des Projekts.
- **Ehrliche Grenze:** trägt bis etwa 150 Karten. Danach greift Schritt 53.

### Zwischenschritt 0.51.6 — Die leere Prüfmappe erklärt sich
(Befund Georg: „Mir ist aufgefallen, dass sich die Agents oft darüber wundern, dass dort
keine Prüfungen sind." Beleg im Ticker vom 21.08.2026, 06:58:02: Block 1 meldet „ein
fehlendes `pruefung/`-Verzeichnis" als Fund; der Angreifer sieht um 07:27:38 eigens nach.)
- **Nur 3 von 24 Blocksorten** bekommen heute die Erklärung, dass die Mappe am Laufstart
  geleert wird (Bauer, Prüfer, Gesamtprüfung) — ausgerechnet die umsehenden Blöcke
  **Paket schneiden, Angreifer, Diagnose, Audit** nicht.
- Der Satz, den der Bauer schon hat, kommt in deren Aufträge, ergänzt um den Halbsatz:
  *das Gedächtnis der Prüfungen steckt in den Prüfkarten, nicht im Ordner.*
- **Gürtel und Hosenträger:** FlowForge lässt beim Leeren eine kurze `LIESMICH.md` in der
  Mappe zurück (von der Prüfmappen-Ansicht und der Dateizählung ausgenommen). Dann findet
  auch ein Block die Erklärung, dessen Auftrag den Satz nicht trägt.
- **Alltagstest:** Lauf starten, im Ticker nachsehen — kein Block meldet die leere Mappe
  mehr als Fund.

### 52 — Prüfkarten laufen von selbst
(Georgs Entwurf, 21.08.2026: „Was ist, wenn der Prüfer nur entscheidet, welche Karte
relevant ist, und das FlowForge meldet, und FlowForge die Tests dann deterministisch
laufen lässt?" — im Gespräch verschärft zu: FlowForge entscheidet auch das selbst.)

**Das Problem:** Der Prüfbefehl ist ein Gedächtnis von **genau einem Lauf Tiefe** — er
läuft am Tor und einmal als Baseline beim nächsten Laufstart. Die Prüfkarten sind das
volle Archiv (bei Georg 9 Prüfungen, 1,3 MB), werden aber nur benutzt, wenn Georg eine
Karte auf einen Prüfer zieht. Das hat er nie getan. Zwischen Lauf N und Lauf N+2 prüft
also niemand mehr, ob das Alte noch hält.

- **Dateiliste an der Prüfkarte:** Beim Anlegen stempelt FlowForge die Prüfkarte mit der
  Dateiliste des Pakets, das damals geprüft wurde — die kennt es bereits, sie ist der
  Datenvertrag aus dem Zuschnitt und wird schon als Schreibsperre durchgesetzt. Kein
  neues Agentenfeld nötig.
- **Optionales Feld im Prüfbeleg** für Dateien, die der Prüfer über sein Paket hinaus
  geprüft hat („alte Wege antworten unverändert" stand so in seinem Beleg vom 21.08.).
- **FlowForge schneidet die Listen selbst** — Dateien des neuen Pakets gegen Dateien jeder
  Prüfkarte — und führt die Treffer **deterministisch aus, ohne KI, null Tokens**, am
  Tor-Anker. Dieselbe Mechanik läuft heute schon für den Prüfbefehl: im Lauf vom 21.08.
  zwei Sekunden, ausdrücklich „0 Tokens" im Ticker.
- **Bei Rot** bekommt der Prüfer nur die Fehlerausgabe, nicht die Datei, und trennt echte
  Regression von veralteter Prüfung. Passt er sie an, ersetzt die angepasste Fassung die
  aufbewahrte (das kann die Mechanik heute schon).
- **Ausbaustufe:** dieselbe Messung auch am Laufanfang, wie beim Prüfbefehl. Dann trennt
  sich „vorher schon rot" von „neu kaputt" von selbst, Altlasten werden zur Aufgaben-Karte
  statt eine Reparatur-Runde zu verbrennen — und die in SPEC §4.3 als ehrliche Grenze
  genannte Lücke („Prüfdateien gezogener Prüfkarten kommen erst nach der Messung in die
  Mappe und zählen nicht mit") ist zu.
- **Ziehen per Hand bleibt**, für den Fall, dass Georg gezielt etwas wiederholen will.
- **Warum nicht der Agent entscheidet:** Der Zugsimulator-Befund (12.08.2026) zeigt, dass
  eine Bitte im Auftrag nicht hält — „Die Prüfmappe wuchert weiter TROTZ Auftrags-Verbot …
  Der Auftrag bittet, nichts erzwingt". Lehre daraus: konkrete Wenn-dann-Regeln wirken,
  Appelle nicht. Ein Listenschnitt in FlowForge ist eine Regel, kein Appell.
- **Alltagstest:** Ein Paket bauen lassen, das eine Datei anfasst, die eine ältere
  Prüfkarte nennt. Im Ticker muss stehen, dass FlowForge diese Prüfung mitlaufen ließ.
- **Ehrliche Grenze:** Der Stempel ist eine Näherung — ein Prüfer prüft manchmal über sein
  Paket hinaus. Deshalb das optionale Feld; vollständig ist die Zuordnung nie.

### 53 — Karten-Index statt Volltext
(Auslöser, nicht Termin: wenn `karten_uebersicht` die **15.000 Tokens** reißt — bei
Georgs Tempo grob 125 Karten, also etwa elf weitere Läufe.)

**Der Befund:** `karten_uebersicht` liefert heute den **Volltext** aller Karten
(`kartenZeile` = `[sorte] titel: text`). Ein einziger Aufruf holt den kompletten Bestand
ins Fenster. Ein Index-Werkzeug gibt es nicht.

- `karten_uebersicht` liefert künftig nur `id · [sorte] titel · thema` (22 statt 120
  Tokens je Karte) — plus die Dateiliste bei Prüfkarten, die Schritt 52 anlegt.
- **Neu `karten_lesen(ids)`** holt den Volltext bestimmter Karten.
- **Beide Werkzeugbeschreibungen müssen sagen, dass der Text fehlt** — sonst merkt der
  Agent es nicht und schlägt blind Korrekturen vor.
- **Blockauftrag:** Index von allem plus Volltext der zugeteilten Karten.
- **Anweisung an die Auftragsquellen-Blöcke** (Paket schneiden, Diagnose): Index ansehen,
  passende lesen, dann `karten_zuteilen`. Sie sind der Engpass — sie müssen alles sehen,
  laufen lokal mit 131k, und „Paket schneiden" ist ohnehin der schwerste Block
  (21.08.: 1.941 s, 943.000 Tokens).
- **Der Karten-Prüfer bleibt unverändert.** Er läuft auf `sparsam` (Sonnet, ~200k Fenster);
  23.000 Tokens Karten wären dort 11 %. Wird er je auf `lokal` gestellt, kommt der
  Portionsbetrieb doch — deshalb bewusst auf `sparsam` lassen.
- **Alltagstest:** Bei über 125 Karten einen Lauf starten und die Start-Prompt-Zeile im
  Ticker vergleichen — sie muss deutlich kleiner sein als vorher.

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
