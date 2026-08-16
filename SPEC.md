# FlowForge — Produkt-Spezifikation V1

Stand: 15.08.2026 (Bauschritt 33) · Ursprung: Grilling-Session vom 07.08.2026 (von Georg freigegeben) ·
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
    Block-Agenten können Recherche-, Entwurfs- und kleine Bau-Aufträge an eine lokale KI
    über Ollama abgeben (§4.3 „Lokale Helfer-KI") — eigene kleine Helfer-Kreisläufe von
    FlowForge, kein Motor. Der Motor selbst bleibt die Claude-CLI.
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

**Ordnung in der Karten-Seitenleiste** (seit Bauschritt 30): Die Karten stehen in vier
festen, ausklappbaren **Gruppen**, die sich aus der Sorte ergeben (nichts zu pflegen):
„Arbeit" (Status-Karte obenauf + offene Aufgaben) · „Wissen" (Entscheidungen + Wissen) ·
„Geprüft" (Prüfkarten) · „Erledigt" (erledigte Aufgaben, standardmäßig eingeklappt). Der
Sorten-Filter bleibt. In „Arbeit" und „Wissen" gibt es **Themen als zweite Ebene**: ein
freies Schlagwort je Karte (höchstens 30 Zeichen), **Pflicht beim Anlegen** von Aufgaben-,
Entscheidungs- und Wissens-Karten — im Formular wie für den Agenten (Parameter `thema` von
`karte_anlegen`, hart durchgesetzt; Status- und Prüfkarten tragen kein Thema; das Bearbeiten
alter Karten ohne Thema bleibt möglich, sie liegen unter „Sonstiges"). FlowForge
normalisiert Groß-/Kleinschreibung und Leerzeichen; die kanonische Schreibweise ist die der
zuerst angelegten Karte. Die vorhandenen Themen stehen im Blockauftrag, in
`karten_uebersicht` und in der Ablehnungsmeldung („thema fehlt — vorhanden: …") — bewusst
NICHT in der Werkzeugbeschreibung (Prompt-Cache). Regel für alle Agenten: primär
einsortieren, ein neues Thema nur, wenn keines passt; das Spec-Interview bündelt seine
ersten Karten in 3–6 Themen. Der Nutzer kann ein **Thema umbenennen** (alle Karten wandern
mit; ein vorhandener Name legt zusammen) und eine **Karte per Drag & Drop** in eine andere
Themengruppe ziehen. Die Einklapp-Zustände (Gruppen, Themen, Bibliotheks-Klappen) merkt
FlowForge **je Projekt im Datenordner** — nicht in projekt.json, die ist Teil der
Sicherungspunkte.

**Aufräum-Knöpfe** in der Karten-Seitenleiste (Entscheidung Georg, 15.08.2026: Aufräumen
gehört zu den Karten, nicht aufs Schaubild): **„Karten am Code prüfen"** startet den
Karten-Prüfer (§4.3) und **„Themen sortieren"** seinen nur-lesenden Sortiermodus — jeweils
als **Sonderlauf**: ein fester Ein-Block-Workflow im Hintergrund mit Lauf-Tab, Ticker,
Abnahme-Dialog und Sperren wie bei jedem Lauf, aber die Leinwand bleibt unangetastet (der
Laufbericht trägt die Marke „Sonderlauf"). Läuft oder wartet das Projekt, sind die Knöpfe
gesperrt. Der Sortiermodus klassifiziert alle Karten ohne oder mit offensichtlich falschem
Thema **ohne Code-Nachmessen** (bevorzugt vorhandene Themen) und schlägt sie in **einem
Sammel-Dialog** vor (Vorschlagsart `thema` von `karte_vorschlagen`, Sammelform): Tabelle
aller betroffenen Karten mit vorgeschlagenem Thema, je Zeile änderbar oder ablehnbar,
„Alle übernehmen" / „Alle ablehnen". Thema setzen ist kein Umformulieren — auch
Entscheidungs-Karten dürfen ein Thema vorgeschlagen bekommen.

**Herkunft je Karte** (seit Bauschritt 30): FlowForge stempelt jede angelegte oder geänderte
Karte mit ihrer Herkunft — vom Nutzer („von dir"), vom Co-Pilot (Chat), vom Karten-Prüfer
(übernommener Vorschlag), von FlowForge (Prüfkarten) oder von einem Block-Agenten: dann
**Aufgabe(n) · Block · Lauf**. Die Aufgaben sind die Aufgaben-Karten, an denen der Lauf
gerade arbeitet — die Auftragsquellen-Blöcke (Paket schneiden, Diagnose) melden sie
strukturiert über das Werkzeug `paket_melden` (nur dort rückfragefrei — dasselbe
Freischalt-Muster wie `karten_zuteilen`, im selben Werkzeug-Server; hart validiert: nur
offene Aufgaben-Karten der Kartenauswahl, leer erlaubt, wenn das Wunsch-/Fehlerbild-Feld die
Quelle war); Titel als Schnappschuss, falls die Aufgabe später gelöscht wird; die Meldung
wandert in Laufstand, Ticker und Laufbericht („Paket dieses Laufs: …"). Anzeige als kompakte
Kopfzeile unter dem Titel („zuletzt geändert vor 2 Std. · angelegt von Sessionende bei
‚Login bauen' (Lauf 14.08., 11:08)"), klickbar zum Laufbericht; alte Karten ohne Herkunft
zeigen nur das Datum. Die Herkunft wandert **nie** in Aufträge oder `karten_uebersicht`.

Der Agent liest und schreibt Karten über eingebaute **Karten-Werkzeuge** (Übersicht, anlegen,
aktualisieren, erledigen) — dieselben Regeln, hart durchgesetzt; abgelehnte Versuche sind im
Liveticker sichtbar. FlowForges Verwaltungsdateien im Projektordner (projekt.json, karten.json,
workflow.json, startanleitung.json, laufstand.json, naechster-lauf.json, chat.json — der
Verlauf des Co-Piloten, §6 —, pruefbefehl.json — der Prüfbefehl des Tors, §4.3 — und die
Laufberichte) sind für direkte Schreibzugriffe des
Agenten gesperrt (hartes Nein, keine Rückfrage) — sonst ließen sich die Kartenregeln umgehen.

### 3.2 Laufberichte

Jeder Workflow-Lauf hinterlässt automatisch einen kompakten, strukturierten Bericht (Workflow,
Blöcke, Ergebnisse, Fehlschläge). Reines Nachschlagewerk in der App — wird **niemals automatisch
in den Kontext künftiger Sessions geladen** und nie von Hand gepflegt. Zusätzlich ist das
Ergebnis des letzten Laufs direkt an jeder Block-Karte auf der Leinwand aufklappbar.
Der Verbrauch steht je Block und für den ganzen Lauf im Bericht — seit 13.08.2026 mit
**Token-Aufschlüsselung** (Eingabe, Ausgabe, Cache gelesen, Cache geschrieben) und den
**theoretischen API-Kosten**, die der Motor aus den Preisen der genutzten Modelle berechnet
(im Abo-Modus nur zur Einordnung ausgewiesen). Die Lokale-Helfer-Zeile nennt seit
Bauschritt 31 das **Modell** der lokalen KI. Seit Bauschritt 27 vermerkt der Bericht
außerdem die **Session-Kennung des Laufs** (über sie setzt der Co-Pilot die
Lauf-Session fort, §6) und trägt den **Chat-Verlauf** des Co-Piloten (Abschnitt seit der letzten Marke) als eigenen
Abschnitt nach (Bilder als Marker, nicht als Daten). Seit Bauschritt 28 steht auch der
**Karten-Vorschlag fürs nächste Paket** (§5) samt Empfehlung und Begründung im Bericht
des erzeugenden Laufs.

### 3.3 Sicherungspunkte

- Automatische Sicherungspunkte des Projektordners: beim Anlegen des Projekts, **vor jedem
  Lauf** und **nach jedem erfolgreichen schreibenden Block** (technisch Git, für den Nutzer
  unsichtbar — sichtbar nur als Liste: „14:32 — Prüfer bestanden"). Nur-lesende Blöcke
  ändern nichts und erzeugen deshalb keinen Punkt — ein Punkt, während parallel ein
  schreibender Block arbeitet, würde dessen halbfertige Änderungen einfrieren. Die
  Garantie „ändern nichts" gilt nicht, wenn die Einstellung „Nur-lesende Blöcke dürfen
  Befehle ausführen" (§7) an ist: Ein ausgeführtes Skript kann dann Dateien verändern —
  einen Sicherungspunkt gibt es für solche Blöcke trotzdem nicht.
- Technik-Absicherung: Die Verwaltung nutzt ein eigenes, verstecktes Git-Verzeichnis
  **außerhalb** des Projektordners — das Projekt darf selbst ein Git-Repo sein oder werden.
  Dem Agenten ist Git-Benutzung per Sperre untersagt (hartes Nein, keine Rückfrage).
- Ausgenommen von Sicherung und Wiederherstellung: Laufberichte (bleiben immer erhalten),
  `node_modules` (per Installation wiederherstellbar), `arbeitsablage`
  (Wegwerf-Fläche der Agenten, wird am Lauf-Ende geleert) und `pruefbefehl.json`
  (der Prüfbefehl gehört zum Lauf und zeigt auf die Prüfmappe, die der nächste
  Laufstart leert — §4.3; sein Gedächtnis über Läufe hinweg ist das Archiv
  außerhalb des Projektordners).
- **Wiederherstellen-Knopf** mit Vorschau (was ändert sich, was verschwindet, was kommt
  zurück): Projektstand von jedem Sicherungspunkt zurückholen. Vorher wird der jetzige
  Stand automatisch gesichert — eine Wiederherstellung ist selbst wieder rückgängig machbar.
  Während ein Lauf aktiv ist, ist Wiederherstellen gesperrt.
- **Die Sicherungspunkte liefern den Diff** (seit Bauschritt 34): Aus zwei Punkten rechnet
  FlowForge den exakten Unterschied — Dateiliste (neu/geändert/gelöscht, +n/−m Zeilen) plus
  Ausschnitte der geänderten Stellen mit Umgebung. Dieselbe Technik wie die
  Wiederherstellen-Vorschau (zwei Bäume plus ein eigener kleiner Zeilen-Vergleich, kein
  externes Git nötig). Das speist die Reparatur-Runde (§5). Ausgenommen sind zusätzlich
  `pruefung/` (die Prüfer-Tests liegen beim Rückführen uncommittet im Ordner und wären
  sonst „Bauer-Änderungen") und `arbeitsablage/`.
- Rechner-Neustart mitten im Lauf → App bietet an, am letzten Sicherungspunkt weiterzumachen.

### 3.4 Metriken (seit Bauschritt 31)

Das Messinstrument des Nutzers — nur Nachschlagewerk, **nichts davon wandert je in einen
Auftrag** (das Verbot der Prozess-Selbstvermessung in §10 meint den Agentenprozess, nicht
dieses Instrument). Zugang: Knopf **„Metriken" in der Titelleiste** → globale Seite über alle
bekannten Projekte (Filter nach Projekt); im Projekt ein **Tab „Metriken"**, der dieselbe
Seite aufs Projekt vorgefiltert zeigt (eigener Baustein, nicht Teil der Leinwand).

- **Abschnitt 1 — Lokale KI:** FlowForge schreibt **jedes Urteil über lokale Arbeit**
  strukturiert in eine **globale Metrik-Datei im verwalteten Bereich** (Datenordner,
  `metriken/lokale-ki.jsonl` — Anhänge-Format, weil bis zu 3 Läufe parallel schreiben;
  nicht im Projektordner, keine Karten): Zeitpunkt, Projekt, Lauf, Block, **Modell**,
  **Bereich** (Recherche · Entwurf · Reparatur · Bauen), **Ausgang** (übernommen/verworfen
  bei Recherche-Fazit und Entwurf, gehalten/nicht gehalten bei Reparatur-Nachprüfung und
  Teilstück, gescheitert bei Kreisläufen ohne Ergebnis) und die **Schritte** des
  Kreislaufs. Die Urteile fallen ohnehin mechanisch (`recherche_bewerten`,
  `entwurf_abnehmen`, `teilstueck_abnehmen`, Nachprüfung der Vorreparatur). Anzeige als
  Tabelle **Modell × Bereich**: Urteile, Quote (Anteil übernommen/gehalten an allen
  beurteilten — gescheiterte zählen nicht in die Quote), Ø Schritte, Fehlschläge, Zeitraum.
  **Erst ab Bauschritt 31 gezählt** (Entscheidung Georg) — keine Rückrechnung aus
  Ticker-Texten alter Berichte. Ohne Trefferquoten-Schalter (§4.3) gibt es für Recherchen
  kein Urteil und damit keinen Eintrag; Entwürfe und Teilstücke werden immer abgenommen.
- **Abschnitt 2 — Motor:** liest die **Laufberichte aller bekannten Projekte** (die Daten
  liegen dort exakt vor, auch für alte Läufe) — im Hauptprozess mit Zwischenspeicher je
  Datei; Projekte, deren Ordner fehlt, werden mit Hinweis übersprungen („nur bekannte
  Projekte"). Schnitte: **je Blocktyp** (Erstläufe: Anzahl, Ø Tokens, Ø theoretische
  Kosten — **Wiederholungen** desselben Blocks im Lauf, also Reparatur-Runden,
  Nachprüfungen und Nachforderungen, stehen getrennt daneben, sonst verzerren sie den
  Durchschnitt), **je Workflow-Kette**, **je Projekt** (nur ungefiltert) und ein
  **Zeitverlauf je Kalenderwoche** als einfache Balken („wird es billiger?"). Ehrlichkeit:
  Berichte ohne Kostenangabe und Block-Einträge ohne Verbrauch (ältere Läufe) werden als
  „ohne Kosten"/„ohne Verbrauch" gezählt und fallen aus den Durchschnitten heraus, statt
  sie zu verfälschen. Im Abo-Modus sind es theoretische Kosten wie überall.

## 4. Workflows & Blöcke

### 4.1 Form

- Die Leinwand ist ein **Schaubild** (Entscheidung Georg, 07.08.2026): gerahmte Block-Karten,
  **frei platzierbar** (Positionen werden gespeichert), verbunden durch von Hand gezogene
  **Pfeile**, die die Reihenfolge bestimmen. Datenformat: Karten + Pfeile.
- **Parallele Zweige** (seit Bauschritt 13): Von einer Karte dürfen mehrere Pfeile
  ausgehen und mehrere an einer ankommen; Kreise sind verboten. Ein Block startet,
  sobald alle seine Vorgänger fertig sind — ein Block mit mehreren eingehenden Pfeilen
  führt die Zweige zusammen (er wartet auf alle). Gleichzeitig laufen dürfen mehrere
  lesende Blöcke, aber höchstens ein schreibender (§5) — Achtung: Ist die Einstellung
  „Nur-lesende Blöcke dürfen Befehle ausführen" (§7) an, kann auch ein „lesender"
  Block über ausgeführte Skripte Dateien verändern; die Parallel-Regel bleibt dann
  bewusst auf eigene Gefahr. Ein sichtbarer Hinweis im
  Ticker warnt, dass parallele Blöcke den Verbrauch vervielfachen. braucht/liefert
  gilt entlang der Pfeile: Was ein Block braucht, muss einer seiner Vorfahren liefern.
  **Zwischenstände beim Umbauen sind erlaubt:** Beim Bearbeiten darf das Schaubild
  vorübergehend in Stücke zerfallen (z.B. um einen Block herauszunehmen); die
  braucht/liefert-Steck-Prüfung greift, sobald die Pfeile wieder alle Karten zu einem
  zusammenhängenden Schaubild verbinden — und spätestens beim Start, der immer streng
  prüft. Parallelität **innerhalb** eines Blocks gibt es beim Audit (seit Bauschritt 25):
  Sein Agent startet die drei Blickwinkel-Prüfer als gleichzeitige Unteraufgaben —
  ob der Motor sie wirklich parallel ausführt, entscheidet das Modell; sonst laufen
  sie nacheinander (jede Unteraufgabe steht sichtbar im Ticker, seit Bauschritt 25
  samt ihrem Ziel), das Ergebnis ist dasselbe.
- **Fehlschlag-Rückführung:** „bei Fehlschlag zurück zu Block X" (braucht der Prüfer sofort).
  Die Rückmeldung an den Zielblock enthält seit Bauschritt 34 **alle Beanstandungs-Zeilen
  vollständig** (großzügig gedeckelt; passt eine nicht mehr hinein, steht das sichtbar
  dabei) statt eines abgeschnittenen Belegs — die Beanstandungen stehen im Prüfbeleg am
  Ende und fielen vorher regelmäßig weg. Urteilt ein Prüfer „nicht bestanden", **ohne
  eine einzige Beanstandungs-Zeile** zu liefern, fordert FlowForge sie einmal bei ihm
  nach (wie die Startanleitungs-Nachforderung, ohne Reparatur-Runde zu verbrauchen);
  bleibt sie aus, wandert ehrlich vermerkt der ganze Prüfbeleg weiter.
  Sind alle Beanstandungen mechanisch, versucht zuerst die lokale Vorreparatur (§4.3) —
  ohne reguläre Runden zu verbrauchen.
  **Tor ohne KI vor dem Prüfer-Agenten** (seit Bauschritt 35): Vor jeder Nachprüfung — der
  Reparatur-Runde des Prüfers wie der Nachprüfung einer lokalen Vorreparatur — spielt
  FlowForge den **Prüfbefehl** des Prüfers (§4.3) selbst ab, ohne Motor und ohne Tokens.
  Bleibt er rot, geht das Fehlerprotokoll sofort als Rückmeldung an den Rückführungs-Ziel-Block,
  ohne dass ein Prüfer-Agent startet (der Block-Anlauf steht mit 0 Tokens im Laufbericht) —
  eine reguläre Reparatur-Runde verbraucht er trotzdem, sonst liefe das Paar Bauer/Tor endlos.
  Erst bei Grün startet der Prüfer-Agent und prüft dann nur noch die **grundsätzlichen**
  Beanstandungen nach; was seine Tests abdecken, gilt mit Grün als erledigt. Nach einer
  lokalen Vorreparatur bleibt es bewusst bei der vollen Nachprüfung (ein kleines Modell
  könnte den Test statt des Codes angefasst haben). Ohne Prüfbefehl läuft alles wie zuvor.
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
lesend) · Bauer · Prüfer · Gesamtprüfung · Audit (nur lesend, legt Karten an) ·
Karten-Prüfer (nur lesend, macht Vorschläge) · Frage an den Menschen (nur
lesend) · Sessionende (bringt die Karten auf Stand und schlägt die
Kartenauswahl fürs nächste Paket vor, §5).
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
passendem braucht in den Auftrag gereicht. Liefern mehrere Vorfahren dasselbe
Etikett, gewinnt der nächstgelegene — liegen mehrere **gleich nah** (zwei Angreifer
vor dem Bauer), bekommt der Nachfolger seit Bauschritt 34 **alle** nummeriert
(„Angriffsliste (1 von 2) von …"), und der Ticker sagt es; früher gewann still einer
und die andere Arbeit war bezahlt und weg. Gekürzt wird auf 8.000 Zeichen je
Übergabe — seit Bauschritt 34 **in der Mitte statt hinten**, damit die Marker-Zeilen
am Ende (BEANSTANDUNG, PRUEFKARTE, PRUEFUNG) überleben; jede Kürzung steht sichtbar
im Ticker und damit im Laufbericht. Daneben gibt es
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

**Prüfbefehl — Pflicht-Artefakt des Prüfers** (seit Bauschritt 35; gilt auch für
die Gesamtprüfung): Neben seinen Tests hinterlegt der Prüfer über das Werkzeug
`pruefbefehl_setzen` **genau einen** Befehl, der alle seine Prüfungen ausführt und
bei einem Fehlschlag mit einem Fehlercode endet — damit FlowForge in
Reparatur-Runden ohne KI nachprüfen kann (§4.1). Fehlt er, läuft der Prüfer genau
**eine** Nachbesserungs-Runde erneut und trägt ihn nach, ohne etwas neu zu prüfen
(dasselbe Muster wie die Startanleitung beim Bauer, §8); fehlt er danach immer noch,
macht der Lauf ehrlich vermerkt weiter. Der Befehl liegt in der Verwaltungsdatei
`pruefbefehl.json` (für Agenten gesperrt, §3.1) und **gehört zum Lauf**: Der
Laufstart leert ihn zusammen mit der Prüfmappe, und er ist von Sicherungspunkten
ausgenommen (§3.3). Weil FlowForge ihn **ohne Rechte-Rückfrage** ausführt, liegt er
an kürzerer Leine als ein Agenten-Befehl (§7): ein einzelner Aufruf eines
Test-Werkzeugs (node, npm, npx, pnpm, yarn, vitest, jest, mocha, tsc, python, py,
pytest, deno, bun, go, cargo, dotnet, mvn, gradle, make, rspec, phpunit), **keine**
Verkettung (`&`, `&&`, `|`, `;`), Umleitung (`>`, `<`) oder Unterausführung
(`$(…)`, Backticks) — braucht eine Prüfung mehrere Schritte, gehört ein
Sammel-Skript nach `pruefung/`. Das Werkzeug ist rückfragefrei nur in Prüf-Blöcken;
andere Blöcke lösen die übliche Rechte-Rückfrage aus.

**Baseline „vorher schon rot"** (seit Bauschritt 35): Nach einer bestandenen Prüfung
bewahrt FlowForge den Prüfbefehl im verwalteten Bereich **außerhalb des
Projektordners** auf (wie die Prüfkarten). Beim nächsten Laufstart — noch vor dem
Leeren der Prüfmappe und vor dem Sicherungspunkt „Stand vor Lauf" — spielt FlowForge
ihn einmal ab und merkt sich das Ergebnis. Bauer und Prüfer bekommen „vorher schon
rot: …" in ihren Auftrag, und das Tor (§4.1) meldet nur **neu** Kaputtes als
Fehlschlag; Altlasten werden stattdessen zu einer offenen Aufgaben-Karte (Herkunft
FlowForge, stabiler Titel — derselbe Befund legt nicht bei jedem Lauf eine neue an)
und verbrennen keine Reparatur-Runde. Verglichen wird über die Fehlerzeilen beider
Ausgaben, normalisiert um Zahlen, Pfadtrenner und Leerraum — Laufzeiten und
Testzahlen sollen keinen Scheinbefund erzeugen. Ehrliche Grenzen: Ist die Prüfmappe
beim Laufstart leer (voriger Lauf abgebrochen), gibt es keine Baseline; Prüfdateien
gezogener Prüfkarten kommen erst nach der Messung in die Mappe und zählen nicht mit;
ein Lauf ohne Prüf-Block misst gar nichts.

**Gesamtprüfung** (seit 12.08.2026, umgebaut 13.08.2026): eigener Prüf-Block für
zwischendurch — prüft mit **frisch geschriebenen** Prüfungen, ob das Projekt als
Ganzes hält (Maßstab: Status-Karte, Entscheidungs-Karten, Startanleitung), statt
eine gewachsene Projekt-Mappe abzuspielen. Gedacht als manueller Ein-Block-Lauf,
nicht als Teil jeder Kette.

**Audit** (seit Bauschritt 25): der Rundum-Blick übers ganze Projekt — beurteilt
das Projekt als Ganzes, nicht das aktuelle Paket (dafür gibt es den Prüfer).
Manueller Ein-Block-Lauf für zwischendurch, nicht Teil der Bau-Vorlagen; liefert
„Befundliste", falls es doch in eine Kette gesteckt wird. Sein Agent startet
**drei feste Blickwinkel-Prüfer** als Unteraufgaben — Fehler & Randfälle ·
Verständlichkeit & Wildwuchs · Sicherheit & Datenverlust — möglichst gleichzeitig
(§4.1) und bündelt ihre Funde. **Volle Lesetiefe, bewusst teuer** (Entscheidung
Georg, 14.08.2026 — gegen die Zügel-Empfehlung): keine Stichproben-Zügel wie beim
Angreifer; dafür steht die Kosten-Folge sichtbar am Start im Ticker (ein
Audit-Lauf kann mehrere hunderttausend Tokens kosten). Die lokale Helfer-KI
bleibt als Recherche-Entlastung erlaubt (Häkchen je Block gilt). Je
**wesentlichem** Befund legt das Audit eine offene Aufgaben-Karte an (übliche
Längengrenzen; Kleinkram bleibt im Abschlussbericht) — die Befunde rutschen
damit automatisch in die Kartenauswahl der nächsten Bau-Läufe, Paket schneiden
nimmt sie als Auftragsquelle. Mechanik: Das Audit ist nur-lesend für Dateien und
Befehle (Befehls-Ausführung nur, falls die §7-Einstellung „Nur-lesende Blöcke
dürfen Befehle ausführen" an ist — sie gilt für alle nur-lesenden Blöcke, auch
das Audit), darf aber Karten anlegen — ein eigenes Kennzeichen am Block (analog
„darfPruefen"), durchgesetzt am Werkzeugaufruf; genau karte_anlegen ist
freigeschaltet. Die vollständige Befundliste steht im Abschlusstext.

**Karten-Prüfer** (seit Bauschritt 26): misst am Code nach, ob die
Projektkarten noch wahr sind — oder schon veraltet. Manueller Ein-Block-Lauf;
liefert „Kartenbericht". Der Block ist strikt nur-lesend und ändert Karten
**nie selbst**: Jede Korrektur ist ein Vorschlag über das Werkzeug
`karte_vorschlagen` (rückfragefrei nur in diesem Block, durchgesetzt am
Werkzeugaufruf; will ein anderer Block — etwa der Bauer — einen Vorschlag
machen, löst das die übliche Rechte-Rückfrage aus statt eines harten Neins,
Feedback Georg 14.08.2026 — erlaubt der Nutzer sie, folgt ohnehin der
Abnahme-Dialog je Karte) — aktualisieren, abhaken, wieder öffnen, löschen oder, bei
Widerspruch zwischen Code und Entscheidungs-Karte, eine neue Aufgaben-Karte.
Der Lauf pausiert wie beim Gespräch (§6), und der Nutzer entscheidet **jede
Karte einzeln** im Abnahme-Dialog des Lauf-Tabs: „Übernehmen" (Vorschlag
unverändert), „Vorschlag bearbeiten" (Felder ändern, harte Längengrenzen)
oder „Ablehnen". Angewendet wird ausschließlich von FlowForge über die
normalen Kartenfunktionen; der Ausgang geht als Werkzeug-Ergebnis an den
Agenten zurück, damit sein Kartenbericht stimmt. Harte Leitplanken im Code:
Entscheidungs-Karten werden nie umformuliert oder gelöscht (Festlegungen
trifft der Nutzer) — ein **Thema** dürfen sie aber vorgeschlagen bekommen
(Thema setzen ist kein Umformulieren, Bauschritt 30), Prüfkarten pflegt
FlowForge (keine Vorschläge), die Status-Karte ist nur aktualisierbar, neue
Karten sind immer Aufgaben (mit Thema). Jeder Vorschlag trägt eine Begründung
mit Beleg; Ticker und Laufbericht zählen übernommen/bearbeitet/abgelehnt. Der
Block bleibt in der Bibliothek für Ketten; als Knopf „Karten am Code prüfen"
startet er ohne Leinwand als Sonderlauf, und sein Sortiermodus „Themen
sortieren" (§3.1) nutzt dieselbe Mechanik mit Sammel-Dialog.

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
Werkzeug `lokal_recherchieren`; beim Recherchieren hat die lokale KI genau drei rein
lesende Werkzeuge (Ordner auflisten, Datei lesen, suchen), hart im Code auf den
Projektordner begrenzt — schreiben, ausführen oder außerhalb lesen kann sie dabei
nicht, deshalb ist das Werkzeug auch unter „darf nur lesen" erlaubt. Steht die lokale KI bereit, weisen die
Blockaufträge sie als **erste Wahl** fürs Delegieren aus (das Agent-Werkzeug ist der
Rückfall). Denk-Modelle (z.B. gpt-oss), die ihre Antwort leer lassen und alles ins
Denkfeld schreiben, werden einmal nachgehakt, bevor ein Fehlschlag gemeldet wird.
Modelle, die Werkzeugaufrufe als bloßen JSON-Text in die Antwort schreiben statt
ins Werkzeug-Format (Befund 14.08.2026: qwen2.5-coder), fängt FlowForge selbst
ab: Der Kreislauf erkennt solche getarnten Aufrufe (nur exakt passende
Werkzeugnamen, dieselben harten Sperren) und führt sie normal aus — ehrlich im
Ticker vermerkt („Werkzeugaufruf kam als Text getarnt — übersetzt").
Ehrlichkeits-Vorkehrungen: Jedes Fazit
trägt den Warnhinweis „kleines Modell — Fundorte selbst nachprüfen" (in der Erprobung
erfand das 7B-Modell abgelehnte Dateiinhalte), Start/Schritte/Fazit stehen im Ticker —
**jede Schritt-Zeile nennt ihr Ziel** (seit 14.08.2026: welche Datei ab welcher Zeile
gelesen, wonach gesucht, welcher Ordner angesehen wird; Pfade und Muster gekürzt, gilt
für Recherche, Entwurf, Reparatur und Bauen gleichermaßen) —,
der Laufbericht weist den Anteil der lokalen KI aus (Recherchen, Schritte,
Fehlschläge, Reparatur-Versuche, Entwürfe, Teilstücke), und ist Ollama beim Laufstart nicht erreichbar, sagt der Ticker das
ehrlich und alles läuft wie gewohnt über den Motor.
**Projektwissen** (seit Bauschritt 25): FlowForge stellt jedem lokalen Auftrag
(Recherche, Entwurf, Reparatur, Bauen) automatisch die Kartenauswahl des Laufs
voran — Status-Karte, offene Aufgaben, manuell Gewählte — als Abschnitt
„Projektwissen" im Auftragstext, je Aufruf frisch gelesen. Grund: Die lokale KI
kann keine Rückfragen stellen (Einweg-Kreisläufe); was der Auftrag nicht nennt,
existiert für sie nicht — Festlegungen aus Entscheidungs-Karten würden sonst
übergangen. Kostet kein Kontingent, nur lokale Tokens; bewusst KEIN direkter
Blick in karten.json (Verwaltungsdatei-Tabu, Halluzinationsgefahr kleiner
Modelle). V1-Experiment auf Georgs Wunsch —
der vollwertige lokale Motor bleibt V2 (§2).

**Trefferquote der lokalen KI** (seit Bauschritt 23): Im Lokale-KI-Abschnitt der
Einstellungen sitzt der Schalter **„Trefferquote der lokalen KI erfassen"** (Standard:
an, solange die lokale KI ein Experiment ist — minimaler Token-Mehrverbrauch). Ist er
an, bekommt der Block-Agent das Pflicht-Werkzeug `recherche_bewerten` nach jedem
`lokal_recherchieren`: übernommen (das Fazit fließt in seine Arbeit ein) oder verworfen
(er recherchiert selbst nach), mit einem Satz Begründung. Ticker („Agent übernimmt/
verwirft das Fazit der lokalen KI: …") und Laufbericht (Lokale-Helfer-Zeile: Fazite
übernommen/verworfen) zählen mit — erst damit ist die Kosten-Wette der lokalen KI über
alle drei Helfer-Arten ehrlich messbar. Ist der Schalter aus, gibt es weder Werkzeug
noch Auftrags-Hinweis — kein Mehrverbrauch. Die Abnahmen bei Entwürfen und Teilstücken
bleiben davon unberührt immer Pflicht (sie steuern Übernahme und Rückrollen — Mechanik,
keine Messung). Das Bewerten ist eine reine Meldung und deshalb wie die Recherche auch
unter „darf nur lesen" erlaubt; das Häkchen je Block (s.u.) sperrt es mit.

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

**Lokale Entwürfe** (seit Bauschritt 21): Eng umrissene, **schablonenhafte
Schreibarbeit mit klarem Vorbild** („eine weitere Prüfdatei nach dem Muster
von X") können die Block-Agenten über das Werkzeug `lokal_entwerfen` an die
lokale KI abgeben — die Ersparnis trägt, weil Gegenlesen (Eingabe) deutlich
billiger ist als Selberschreiben (Ausgabe). Das Schreibwerkzeug der lokalen KI
ist dabei hart auf die **Arbeitsablage** begrenzt (`arbeitsablage/`, die
Wegwerf-Fläche — am Laufende geleert, von Sicherungspunkten ausgenommen): In
Projektdateien oder die Prüfmappe schreibt sie hier nie; der einzige direkte
Eingriff bleibt die Vorreparatur (s.o.) mit eigenen Leitplanken. Die
**Abnahme** liegt beim Block-Agenten: Er liest den Entwurf gegen und übernimmt
ihn selbst an den Zielort — oder verwirft ihn und schreibt selbst; ungeprüft
zählt nichts. Seine Entscheidung meldet er ausdrücklich über das Werkzeug
`entwurf_abnehmen`; ein unbrauchbarer Entwurf ist ehrlich billiger Ausschuss,
kein Schaden. Ehrlichkeit: „Lokale KI entwirft …" steht im Ticker, der
Laufbericht zählt Entwürfe (übernommen/verworfen) in der Lokale-Helfer-Zeile.
Entwerfen und Abnehmen sind Schreibarbeit und unter „darf nur lesen" gesperrt;
das Häkchen je Block (s.u.) gilt auch fürs Entwerfen.

**Lokaler Bauer** (seit Bauschritt 22): Über das Werkzeug `lokal_bauen` delegiert
der Block-Agent eng umrissene, **einzeln prüfbare Bau-Teilaufträge** an die lokale
KI — sie baut mit echtem Schreibrecht direkt im Projektordner, unter den
unveränderten harten Sperren (Prüfmappe, Verwaltungsdateien, Git tabu; gezieltes
Ersetzen plus ganze Dateien schreiben, hart im Code begrenzt). Der Bauer-Auftrag
weist den Agenten an, das Arbeitspaket in möglichst kleine Teilaufträge zu
zerlegen — jeder mit Fundstellen/Vorbild, eigenem Fertig-Kriterium und vorher
festgenagelten Schnittstellen —, dabei aber nach Zusammengehörigkeit zu bündeln
und Kleinst-Änderungen selbst zu erledigen (einen trivialen Auftrag präzise zu
beschreiben kostet fast so viel wie ihn selbst zu erledigen). Vor jedem
Teilauftrag legt FlowForge einen Sicherungspunkt „Stand vor lokalem Teilstück"
an. Die **Abnahme je Teilstück** liegt beim Agenten: Er liest sofort gegen
(Gegenlesen ist billiger als Selberschreiben) und meldet mit
`teilstueck_abnehmen` gehalten oder nicht gehalten — bei „nicht gehalten" rollt
FlowForge den Stand automatisch zurück, BEVOR der Agent selbst baut; auch ein
gescheiterter Bau-Versuch mit halben Änderungen wird sofort zurückgerollt. Die
Reihenfolge ist erzwungen (erst abnehmen, dann das nächste Teilstück), damit der
Rückroll-Punkt eindeutig bleibt. Hält ein Teilauftrag nach 2 lokalen Anläufen
nicht, baut der Agent genau dieses Teilstück selbst und macht weiter — kein
Pingpong; der Prüfer-Block bleibt unverändert der Schluss-Schiedsrichter.
**Ein verworfenes Teilstück ist kein Urteil über die übrigen** (Befund 14.08.2026,
erster echter Lauf: nach einem einzigen verworfenen Teilstück versuchte der Agent
die restlichen fünf gar nicht mehr lokal — die Quote war unmessbar): Der
Bauer-Zusatz verlangt seitdem ausdrücklich, jedes Teilstück zuerst lokal zu
versuchen; erst wenn mehrere hintereinander nicht halten, baut der Agent den
Rest selbst.
Ehrlichkeit: jedes Teilstück im Ticker („Lokale KI baut Teilstück …", Abnahme,
Rückrollen), der Laufbericht zählt lokal gehaltene und vom Agenten selbst
gebaute Teilstücke in der Lokale-Helfer-Zeile. Bauen und Abnehmen sind
Schreibarbeit und unter „darf nur lesen" gesperrt; das Häkchen je Block (s.u.)
gilt auch hier.

**Häkchen je Block** (seit Bauschritt 20): An jeder Block-Karte im Schaubild
sitzt ein Abwahl-Häkchen **„lokale KI erlaubt"** (Standard: an, erbt den
globalen Schalter). Abgewählt ist es eine echte Sperre: FlowForge lehnt die
Werkzeuge der lokalen KI (`lokal_recherchieren`, `recherche_bewerten`,
`lokal_entwerfen`, `entwurf_abnehmen`, `lokal_bauen`, `teilstueck_abnehmen`)
für die Agenten dieses Blocks hart ab (erkannt am
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

**Prozess-Hygiene** (seit Bauschritt 32, Befund Georg 15.08.2026: ein Prüfer-Lauf
hatte einen Server gestartet und nie beendet — der lief unsichtbar weiter, der Port
war belegt): Am Ende jedes Laufs — erfolgreich, sanft gestoppt oder hart
abgebrochen — beendet FlowForge alle noch lebenden Prozesse, die aus dem Lauf
heraus gestartet wurden, und vermerkt es ehrlich im Ticker („2 verwaiste Prozesse
aus dem Lauf beendet (node.exe)"). Mechanik: Während eines Laufs (und eines Chats
oder einer laufenden App) fragt ein dauerhafter PowerShell-**Späher** alle 2
Sekunden die Prozessliste ab (~60–120 ms je Abfrage); die Motor-Prozesse melden
sich als Wurzeln, und FlowForge merkt sich je Lauf transitiv jeden Prozess, dessen
Elternteil zur bekannten Menge gehört — auch wenn der Elternteil längst tot ist
(die Bash-Shell des Agenten stirbt sofort nach `npm start &`) —, je Prozess PID +
Startzeit gegen Wiederverwendung. Die Motor-Prozesse selbst bekommen anderthalb
Sekunden, geordnet zu enden, dann fallen auch sie. Grenze (ehrlich): Eine
Zwischen-Shell, die kürzer als ein Abfrage-Abstand lebt, sieht der Späher nie —
ihr Kind wird nicht automatisch beendet, sondern erscheint im App-Tab (§8) als
„vermutlich aus einem Lauf" mit Beenden-Knopf. Der Chat räumt beim Schließen
(Laufstart) ebenso ab. Die per App-Tab gestartete App bleibt unangetastet (eigene
Gruppe, eigener Stopp-Knopf). **FlowForge-Ende räumt ab:** Beim normalen Beenden
werden laufende Motoren, Chats, die gestartete App und alle gemerkten Nachkommen
mit beendet (Node beendet unter Windows keine Kinder); ein unterbrochener Lauf
bleibt als Laufstand wiederaufnehmbar (§3.3). „Nichts läuft unsichtbar weiter"
gilt fürs normale Beenden, nicht für einen Absturz.

**Übungs-Blöcke** bleiben für Probeläufe in der Bibliothek (eigener Abschnitt):
Späher, Mini-Bauer, fairer und strenger Übungs-Prüfer, Karten-Probe, Rechte-Probe.

**Blockbibliothek in Kategorien** (seit Bauschritt 30), ausklappbar, nach der
Aufgabe im Ablauf: Vorlagen · **Auftrag finden** (Spec-Interview, Paket
schneiden, Diagnose, Frage an den Menschen) · **Bauen** (Bauer, Kontext laden) ·
**Prüfen** (Angreifer, Prüfer, Gesamtprüfung, Audit) · **Gedächtnis**
(Sessionende, Karten-Prüfer) · Eigene · Übung (standardmäßig eingeklappt).
Katalog-Blöcke sitzen fest in ihrer Kategorie; eigene Blöcke wählen im
Block-Editor eine Kategorie (§4.5) — vorhandene oder neue, die als eigene Klappe
erscheint. Die Einklapp-Zustände merkt FlowForge je Projekt im Datenordner (§3.1).

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
  Bibliothek jedes Projekts); sie sind nie Prüfer und haben keine Formularfelder. Seit
  Bauschritt 30 wählt jeder eigene Block eine **Kategorie** in der Bibliothek (eine der
  vier festen, „Eigene" oder eine frei benannte, höchstens 30 Zeichen — global gespeichert
  wie der Block selbst; Altbestand ohne Kategorie liegt unter „Eigene"); Stepper und
  KI-Assistent kennen das Feld.
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
- **Reparatur-Runde mit Diff und Vor-Fazit** (seit Bauschritt 34): Der frische Agent einer
  Reparatur-Runde bekommt neben der Prüferkritik zwei von FlowForge gerechnete Tatsachen —
  den **exakten Unterschied** „Das hast du in diesem Lauf bisher geändert" aus den
  Sicherungspunkten (§3.3; kumulativ über alle Runden, gedeckelt, große Dateien nur mit
  Zeilenbilanz) und sein **eigenes Fazit der letzten Runde** als das „warum". Der Prüfer
  bekommt in der Nachprüfung denselben Dienst: was sich seit seinem Urteil geändert hat.
  Damit erkundet der Bauer nicht neu und trifft keine anderen Entwurfsentscheidungen —
  das Frische-Prinzip bleibt unangetastet, er erbt kein Arbeitsgedächtnis. Ehrliche
  Grenze: War der Projektordner beim ersten Start des Blocks schon verändert (ein
  nur-lesender Block mit Befehlsrecht, §7), steht das als Hinweis im Auftrag.
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
  Die gewählten Karten bekommt der Agent zu Beginn **jedes Blocks** frisch mit. Seit
  Bauschritt 29 sitzen an der Kartenauswahl zwei Knöpfe: **„Alle Karten hinzufügen"**
  (lädt Status-Karte, alle Entscheidungs- und Wissens-Karten und alle offenen Aufgaben —
  erledigte Aufgaben und Prüfkarten bleiben draußen: Historie liefert der Laufbericht,
  Prüfkarten haben ihren eigenen Weg über den Prüfer) und **„Standard-Auswahl"** (springt
  auf die festgenagelte Vorauswahl zurück); einzelne Chips bleiben wie gewohnt änderbar.
  Prüfkarten per Drag & Drop in die Auswahl werden freundlich abgelehnt (seit Bauschritt 30).
- **Karten-Zuteilung** (seit Bauschritt 29): Damit „alle Karten" nicht jeden Agenten
  flutet, teilen die Auftragsquellen-Blöcke (Paket schneiden, Diagnose) über das
  Werkzeug `karten_zuteilen` je nachfolgendem Block die Karten zu, die er wirklich
  braucht (nur dort rückfragefrei — dasselbe Freischalt-Muster wie
  `naechster_lauf_vorschlagen`, durchgesetzt am Werkzeugaufruf; andere Blöcke lösen
  eine Rückfrage aus). Ihr Auftrag nennt die Namen der Nachfahren im Schaubild und
  verlangt sparsame Zuteilung — Kontext ist der teuerste Teil des Laufs. FlowForge
  validiert hart: nur Karten-IDs aus der Kartenauswahl des Laufs, nur echte Nachfahren
  im Schaubild — Fantasie-IDs und fremde Blöcke werden mit klarer Meldung abgewiesen,
  die Status-Karte fällt still heraus (sie ist immer dabei). Ab der Zuteilung bekommt
  jeder genannte Block nur noch seine Teilmenge in den Auftrag; dasselbe gilt fürs
  Projektwissen der lokalen Helfer-KI (das 32k-Fenster kleiner Modelle verträgt keine
  Kartenflut). **Rückfall ohne Bruch:** Wird das Werkzeug nicht benutzt oder ein Block
  nicht genannt, bekommt er wie bisher die volle Auswahl. Die Zuteilung wandert in den
  Laufstand (Wiederaufnahme nach Neustart) und steht mit Kartenzahl je Block im Ticker
  und im Laufbericht („Karten verteilt: Bauer 4, Prüfer 2 …").
- **Karten-Vorschlag fürs nächste Paket** (seit Bauschritt 28): Das Sessionende benennt
  über das Werkzeug `naechster_lauf_vorschlagen` (nur dort rückfragefrei — dasselbe
  Freischalt-Muster wie `karte_vorschlagen`, durchgesetzt am Werkzeugaufruf; andere
  Blöcke lösen eine Rückfrage aus) die Karten für den nächsten Lauf, dazu **einen Satz
  Empfehlung in Alltagssprache** samt kurzer Begründung. Der Satz darf eine Vorlage
  nennen, aber FlowForge baut nichts um und startet nichts — die Leinwand gehört dem
  Nutzer. Gespeichert als eigene Verwaltungsdatei im Projektordner (für
  Agenten-Dateizugriffe gesperrt, von Sicherungspunkten ausgenommen) — der Vorschlag
  überlebt App-Neustarts. Angezeigt als Vorschlags-Zeile an der Kartenauswahl im
  Schaubild-Tab (kein blockierender Dialog): Empfehlung plus Karten-Chips, dazu
  **„Übernehmen"** (die Auswahl springt exakt auf den Vorschlag; danach wie gewohnt
  änderbar — das ist das Bearbeiten) und **„Verwerfen"**; ignorieren geht immer. Nur
  existierende Karten-IDs zählen (gelöschte fallen beim Anzeigen still heraus,
  Prüfkarten und Fantasie-IDs weist das Werkzeug ab, die Status-Karte fällt still
  heraus — sie ist ohnehin immer dabei). Verfall statt Pflege: Ein Lauf-Start räumt
  den Vorschlag ab (übernommen oder nicht), ein neues Sessionende ersetzt ihn; Läufe
  ohne Sessionende erzeugen keinen. Die festgenagelte Standard-Vorauswahl bleibt der
  Normalfall. Ehrlichkeit: Vorschlag samt Empfehlung steht im Ticker und im
  Laufbericht des erzeugenden Laufs.
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
- **Denk-Bereich** einklappbar (seit Bauschritt 24, ersetzt das frühere
  Rohprotokoll aus JSON-Zeilen — Diagnose-Verlust bewusst akzeptiert): zeigt
  live die Denk-Texte der gerade arbeitenden KI, je Absatz mit Absender
  (Blockname, „Unteraufgabe", „lokale KI" oder der Koordinator), in gedämpfter
  Mono-Schrift. Beim Motor kommen die Denk-Blöcke aus dem SDK-Strom (die
  Weiterleitung aus den Block-Agenten ist nur Sichtbarkeit — Denk-Budget und
  Verbrauch bleiben unverändert); bei der lokalen KI das Denkfeld der
  Ollama-Antwort, bei Modellen ohne Denkfeld ihr Antworttext vor den
  Werkzeugaufrufen (das „laute Denken" kleiner Modelle). Nur live, nicht im
  Laufbericht.
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
- **Karten-Vorschläge** (seit Bauschritt 26): Schlägt der Karten-Prüfer eine
  Karten-Korrektur vor, pausiert der Lauf genauso — der Lauf-Tab zeigt den
  Abnahme-Dialog (alter Kartentext, Vorschlag, Begründung) mit „Übernehmen",
  „Vorschlag bearbeiten" und „Ablehnen" (§4.3). Ist das Fenster nicht im
  Vordergrund, kommt eine Windows-Benachrichtigung.
- **Co-Pilot** (seit Bauschritt 33; vorher Nachlauf-Chat, Bauschritt 27 —
  Entscheidung Georg, 15.08.2026: Nachlauf-Chat und Co-Pilot sind **ein** Chat,
  kein zweites Chat-Fenster): Der Knopf **„Co-Pilot" in der Titelleiste** öffnet ein
  **seitliches Chat-Fenster** rechts neben der Ansicht (unter 1300 px Fensterbreite
  als Überlagerung — drei Spalten plus Chat passen nicht in 800 px) — in der
  Projektübersicht wie im Projekt; das Fenster überlebt den Ansichtswechsel.
  **Im Projekt** kennt der Chat das offene Projekt (Karten über die
  Karten-Werkzeuge, Dateien, Laufberichte, Startanleitung, die App-Ausgabe aus dem
  App-Tab); liegt ein Laufbericht vor, **setzt er die Lauf-Session fort** —
  technisch resume über die Session-Kennung, die dafür im Laufbericht vermerkt
  wird („frisch" heißt: der jüngste Bericht des Projekts): Der Agent kennt Blöcke,
  Fazite und Verlauf, ohne dass etwas nacherzählt werden muss. Ist die Session weg,
  ihr Kontext über der Wächter-Schwelle (§5) oder wurde der Lauf hart abgebrochen
  bzw. wiederhergestellt (der Projektordner wurde zurückgesetzt — die Session
  „erinnert" sich an Änderungen, die es nicht mehr gibt), startet stattdessen eine
  **frische Session mit dem Laufbericht als Kontext**; ohne jeden Lauf eine frische
  Session mit Projekt- und FlowForge-Wissen — **welche Grundlage gilt, steht
  ehrlich im Chat**, kein stiller Ausweichpfad. **In der Projektübersicht** (kein
  Projekt offen) beantwortet er nur Bedienfragen; sein Arbeitsordner ist dann der
  Datenordner, und der ist für seine Werkzeuge hart gesperrt (dort liegen die
  Einstellungen samt API-Schlüssel) — lesen darf er nur die Produktbeschreibung,
  Befehle und Schreiben sind gesperrt.
  **Was er weiß:** (a) die **Bedienung von FlowForge** — diese SPEC.md wird mit der
  App gebündelt (Extra-Ressource neben der App, nicht im Archiv) und dem Chat als
  **lesbare Datei** bereitgestellt, nicht als Systemtext; sein Systemtext trägt
  Kurzregeln und einen **Abschnitts-Index mit Zeilenbereichen** (beim Start des
  Chats aus der gebündelten Datei erzeugt), damit er gezielt liest — kein zweites
  Bedien-Dokument (Doku-Regel); (b) **das Projekt** (s.o.).
  **Was er darf — zwei Betriebsarten**, Schalter sichtbar über dem Eingabefeld, je
  Chat und jederzeit umschaltbar: Standard ist **nur-lesend** (übliche Lese-Regeln;
  Karten anlegen erlaubt — „leg das als Aufgabe an" ist der Normalweg, der nächste
  Bau-Lauf arbeitet sie mit Sicherungspunkt und Prüfer ab; Karten tragen die
  Herkunft „vom Chat"). Mit **„Chat darf reparieren"** schreibt der Chat wie ein
  Bauer und **führt Befehle für dich aus** (`npm install`, eine Erstanmeldung
  anlegen …): Sicherungspunkt vor der ersten Änderung, übliche Rückfragen und
  Befehls-Einstufung (§7); Git, Prüfmappe und Verwaltungsdateien bleiben tabu.
  **Die App bedient er über eigene Werkzeuge** `app_starten` / `app_stoppen` /
  `app_neustarten` / `app_ausgabe`, die den App-Tab (§8) benutzen — derselbe
  Prozess, den du im Tab siehst (Entscheidung Georg): er überlebt das
  Chat-Schließen und wird nicht von der Prozess-Hygiene der Läufe abgeräumt; die
  Ausgabe lesen ist immer frei, Starten/Stoppen ist im Reparatur-Modus frei und
  fragt sonst nach, einen fremden Port-Besitzer beenden fragt immer.
  **Während ein Lauf läuft oder wartet:** lesend erlaubt (Bedienfragen, „was macht
  der Bauer gerade") — wirklich lesend: die Einstellung „nur-lesende Blöcke dürfen
  Befehle ausführen" gilt für den Chat dann NICHT, Karten anlegen und Reparieren
  sind gesperrt (Schalter ausgegraut), es entsteht kein Sicherungspunkt mitten im
  Lauf; die KI bekommt die Notiz „gerade läuft ein Lauf" mit. Ein Schreiber pro
  Projekt (§5): arbeitet der Chat gerade an einer Antwort, startet kein Lauf; ein
  Laufstart beendet den Chat-Motor (die nächste Nachricht setzt die Chat-Session
  fort) und räumt ab, was der Chat gestartet hatte.
  **Verlauf je Projekt gespeichert** (Verwaltungsdatei `chat.json` im Projektordner
  — für Agenten-Schreibzugriffe gesperrt, von Sicherungspunkten ausgenommen; der
  Übersichts-Chat im Datenordner) — überlebt Neustarts; Knopf **„Neues Gespräch"**
  leert Verlauf und Session (nach Rückfrage). Nach jedem Lauf hängt der Chat an
  der neuen Lauf-Session — der Verlauf zeigt eine **sichtbare Marke** („ab hier:
  neue Lauf-Session vom 15.08., 14:32"; Entscheidung Georg): der ältere Teil
  bleibt zum Nachlesen, die KI kennt ihn nicht mehr und sagt das ehrlich. Der
  Abschnitt nach der Marke wandert zusätzlich in den Laufbericht (§3.2).
  **Eingaben:** mehrzeiliger Text (z.B. eine ganze Fehlermeldung) und
  **Screenshots** — per Strg+V aus der Zwischenablage oder über den Bild-Knopf
  (höchstens 4 Bilder à 5 MB je Nachricht); Bilder gehen als Bild an den Motor,
  der sie selbst liest. **Ehrlichkeit & Motor:** Chat-Nachrichten kosten Kontingent
  — der Verbrauch steht sichtbar am Chat (dasselbe Muster wie im Lauf); es
  antwortet das Standard-Modell des Motors (FlowForge setzt kein Modell), die
  lokale KI bleibt draußen (V2). Werkzeug-Schritte und Reparaturen erscheinen als
  „Chat · …"-Zeilen im Ticker des Projekts, Chat-Sicherungspunkte in der
  Sicherungspunkt-Liste; Rechte-Rückfragen des Chats stellt das Chat-Fenster
  selbst.

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
Verkettete Befehle laufen nur durch, wenn jedes Teilstück bekannt ist — als
Trenner zählen `&&`, `||`, `;`, `|`, Zeilenumbruch und auch das **einzelne `&`**
(seit dem Zweit-Audit vom 14.08.2026). Enthält ein Teilstück eine
Kommando-Substitution (`$(…)`, Backticks, `<(…)`), zählt es als Ganzes als
unbekannter Befehl — Rückfrage bzw. unter „darf nur lesen" hartes Nein, denn in
solchen Argumenten können beliebige Befehle stecken. Ein
`cd`-Vorspann und PowerShell-Zuweisungen mit reiner Wert-Rechtsseite (`$x = "…"`,
`$env:X="1"`) führen selbst nichts aus und zählen nicht als Teilstück (seit
14.08.2026 — vorher lösten sie hunderte unnötige Rückfragen aus); steht rechts
der Zuweisung ein Befehl, wird genau der eingestuft. Bash-Umgebungsvorsilben
(`VAR=wert befehl`) werden übersprungen und der Befehl dahinter eingestuft —
außer bei gefährlichen Variablen (PATH, NODE_OPTIONS …), die den Befehl umleiten
oder Code einschleusen könnten. Eine Datei-Umleitung (`>`/`>>`) auf ein Ziel
**außerhalb des Projektordners** löst dieselbe Rückfrage aus wie ein
Schreib-Werkzeug außerhalb der Projektgrenze. Alle anderen
Befehle lösen eine Rückfrage aus; Git bleibt hart gesperrt (§3.3), und die Prüfmappe
`pruefung/` dürfen nur Prüf-Blöcke verändern (§4.3 — hartes Nein, auch für Befehle,
die erkennbar hineinschreiben). Die Sperre „darf nur lesen" (§4.2) steht darüber:
Sie stoppt jeden nicht rein lesenden Werkzeugaufruf hart, ohne Rückfrage. **Rein
lesende Befehle laufen auch unter der Sperre durch** (seit 12.08.2026 — vorher war
jeder Befehl gesperrt und die Abweisung hieß irreführend „Schreib-Versuch"); auch
Lese-Schleifen („für jede Datei: zeig den Anfang") gelten als lesend, solange jeder
Befehl darin ein Lese-Werkzeug ist. Programme oder Tests auszuführen zählt nicht
als Lesen und bleibt gesperrt — **außer** die Einstellung **„Nur-lesende Blöcke
dürfen Befehle ausführen (auf eigene Gefahr)"** ist an (Entscheidung Georg,
14.08.2026; Standard: aus): Dann durchlaufen Befehle nur-lesender Blöcke die
normale Befehls-Einstufung wie beim Bauer (Git und Prüfmappe bleiben gesperrt,
Unbekanntes fragt) — Angreifer und Diagnose können so z.B. Prüfskripte laufen
lassen, um ihre Funde zu belegen. Damit der Agent das auch versucht, bekommt
jeder nur-lesende Block bei aktiver Einstellung einen Auftrags-Zusatz, der das
kategorische Befehls-Verbot seines Katalog-Auftrags aufhebt (seit dem
Zweit-Audit vom 14.08.2026). Die Schreib-Werkzeuge (Dateien, Karten,
Startanleitung) bleiben für diese Blöcke gesperrt; ein ausgeführtes Skript kann
aber Dateien verändern — deshalb steht die aktive Einstellung sichtbar am
Laufstart im Ticker.

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

**Rauchtest nach dem Bauer** (seit Bauschritt 35): Direkt nach einem gelungenen Bau-Block
startet FlowForge die Startanleitung **selbst** einmal kurz und stoppt sie wieder — ohne
Motor, ohne Tokens und still (kein Eintrag im App-Tab, keine Zustandsanzeige, kein
Browser-Fenster). Geprüft wird nur „läuft an": Ein Befehl, der mit Fehlercode stirbt, ist rot;
bei einer Web-Adresse muss sie innerhalb von 25 Sekunden antworten; ohne Adresse genügt
„läuft noch oder sauber durchgelaufen" nach 6 Sekunden Anlauf; eine Datei-Adresse muss
existieren. Ist es rot, geht die Ausgabe als Rückmeldung an den Bauer und derselbe Block läuft
genau **eine** Nachbesserungs-Runde erneut — bevor der Prüfer eine ganze Runde damit
verbringt; danach macht der Lauf ehrlich vermerkt weiter. Läuft die App gerade im App-Tab,
entfällt der Rauchtest (FlowForge nimmt ihr den Port nicht weg), ebenso bei einer
Startanleitung ohne Befehl und Datei-Adresse.

Ausgeführt wird die Anleitung **im Tab „App"** der Projektansicht (seit Bauschritt 32; das
frühere externe Konsolenfenster gibt es nicht mehr — Entscheidung Georg, 15.08.2026). Der
Tab zeigt die Startanleitung, **Starten / Stoppen / Neu starten**, den Zustand („läuft
seit …", „gestoppt um …", „beendet mit Code …") und die **Ausgabe der laufenden App live**
(Standard- und Fehlerausgabe in einem Strom, ANSI-Farbcodes gestrippt, `\r`-Fortschritts-
zeilen werden überschrieben, Puffer ~120.000 Zeichen). Der Befehl läuft im Projektordner
über eine Shell mit UTF-8-Codepage (`chcp 65001`), Python-Kinder bekommen `PYTHONUTF8=1`/
`PYTHONIOENCODING=utf-8`, Farben sind per `NO_COLOR`/`FORCE_COLOR=0` abgestellt. **Der
Prozess hat keine Eingabe** — Startanleitungen müssen ohne Tastatureingabe auskommen.
Stoppen trifft immer den ganzen Prozessbaum (`taskkill /T /F`) samt den vom Späher (§5)
gemerkten Nachkommen. Adresse → „Adresse im Browser öffnen" (bei Web-Apps mit eigenem
Befehl wartet FlowForge bis zu 30 Sekunden, bis die Adresse antwortet, und öffnet den
Browser erst dann — auch automatisch nach dem Start); Datei-Adresse → Standardprogramm der
Datei; Anleitung ohne Befehl → „Starten" öffnet nur die Adresse/Datei.

**Port-Prüfung vor dem Start:** Ist der Port einer lokalen Startanleitungs-Adresse belegt,
nennt FlowForge den Besitzer-Prozess (Name, PID, Befehlszeile) und bietet an, ihn zu beenden
und die App dann zu starten — der direkte Treffer fürs Symptom „Port belegt vom vergessenen
Prüfer-Server".

Der **„App starten"-Knopf** im Kopf der Projektansicht springt in den App-Tab und startet
dort (läuft die App schon, springt er nur: „App läuft"). Ohne Startanleitung ist der Knopf
grau und erklärt, wie sie entsteht.

**Rückfall-Liste „noch laufende Prozesse aus Läufen"** unten im App-Tab: Prozesse, die sich
am Lauf-Ende nicht beenden ließen, und verwaiste Prozesse, die während eines Laufs
entstanden sind (Elternteil tot; ehrlich als „vermutlich aus einem Lauf" markiert — es kann
auch etwas Selbstgestartetes sein, deshalb steht die Befehlszeile dabei) — je Zeile ein
Beenden-Knopf mit Abgleich PID + Startzeit. Die per „Starten" gestartete App steht dort
nicht (sie hat ihren eigenen Stopp-Knopf), ebenso wenig Prozesse eines gerade laufenden
Laufs.

## 9. GUI-Grundaufbau

**Erscheinungsbild „dunkle Werkbank"** (seit 13.08.2026, Mockup-Runden 3+4 aus Georgs
Design-Canvas): tiefdunkler Navy-Grund, Elektroblau als Marken- und Auswahlfarbe,
Signalrot für alles Lebendige (läuft, wartet auf Antwort, Lauf starten), Schrift
Archivo (lokal gebündelt), Zahlen und Protokolle in JetBrains Mono. Das Fenster hat
eine eigene dunkle Titelleiste (Blitz-Logo, „FlowForge WERKBANK", Brotkrume zum
Zurückspringen, rechts die Knöpfe **„Co-Pilot"** (§6, öffnet das seitliche Chat-Fenster),
**„Metriken"** (§3.4) und „Einstellungen"); Windows zeichnet nur die drei Fensterknöpfe. Installer, Fenster und
Taskleiste tragen das **Blitz-Icon** (seit Bauschritt 30, aus dem Inline-SVG erzeugt). Der **Kontext-Füllstand**
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
  Kartenauswahl) · **Lauf** (Verbrauch, Stopp, Gespräch, Liveticker, Denk-Bereich,
  Ergebnis) · **Laufberichte** (seit Bauschritt 15 filterbar nach Ausgang; Details je
  Bericht mit Dauer und den Ergebnissen jedes Blocks) · **Sicherungspunkte** ·
  **Metriken** (seit Bauschritt 31, §3.4 — aufs Projekt vorgefiltert) · **App** (seit
  Bauschritt 32, §8 — Startanleitung ausführen, Ausgabe live, Prozess-Liste). Beim Lauf-Start wechselt
  die Ansicht automatisch zum Lauf-Tab; wartet dort eine Frage, zeigt der Tab
  einen roten Punkt. Die laufende Block-Karte bleibt im Schaubild-Tab hervorgehoben.

## 10. Bewusst NICHT in V1

- Anbieterneutralität und eigene Motoren gegen fremde Anbieter-APIs (→ V2, durch den
  Motor-Anschluss vorbereitet; der API-Schlüssel-Modus der Claude-CLI und die lokale
  Helfer-KI (§2, §4.3) existieren dagegen schon in V1)
- Englische Oberfläche (→ V2, durch zentrale Texte vorbereitet)
- Import/Export von Blöcken, Mehrbenutzer/Accounts, Auto-Update-Mechanismus
- Umbau eines Workflows, während er läuft
- Jede Form von Prozess-Selbstvermessung **im Agentenprozess** (Bestandslisten,
  Nachweis-Register o.ä. — das Life-OS-Übel). Nicht gemeint ist das Messinstrument des
  Nutzers: die Metriken-Seite (§3.4) ist Nachschlagewerk, das kein Agent je sieht.
