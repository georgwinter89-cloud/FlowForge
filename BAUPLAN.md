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

**Abgeschlossen sind die Bauschritte 1–56** (39 wurde gestrichen); der jüngste Commit
ist „Bauschritt 56". Davon sind die Schritte **1–49 ausgelagert** ins
[BAUPLAN-ARCHIV.md](BAUPLAN-ARCHIV.md) — Verweise wie „BAUPLAN 19" oder „BAUPLAN 44"
zeigen dorthin. Hier stehen die fertigen Schritte 50–55 und alles Offene ab 56.

## Bauschritte

## Paket 49–51: Lokale Block-Agenten — Opus an den Enden, die lokale KI in der Mitte

*(Schritt 49 ist abgeschlossen und steht im Archiv; 50 und 51 folgen unten.)*

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
[Laufbericht `2026-08-20T05-54-58-099Z.json` samt Denk-Export desselben Laufs].
Befund: 4h13m, fehlgeschlagen;
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

## Paket 53 + 52: Projektgedächtnis, das sich selbst bedient
**Reihenfolge: erst 53, dann 52.** 52 stempelt Dateilisten an Prüfkarten; die
Karten-Übersicht muss vorher auf den Index umgestellt sein, damit dieser Stempel gar nicht
erst in einen Volltext wandert. Davor liegen die beiden Zwischenschritte 0.51.5 (ein
Fehler in ausgeliefertem Code) und 0.51.6.

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
Karten 8.254 Tokens = 6,3 % eines 128k-Fensters; davon Wissen 2.887, Aufgaben 2.379,
Entscheidungen 1.731, Prüfungen 1.147, Status 110. Reiner Index (Titel, Thema, Sorte —
**ohne** Kennungen, siehe 53) **1.544 Tokens** — 22 je Karte gegen 120 im Volltext.
Prüfkarten-Archiv desselben Projekts: 9 Karten, 402 KB. Wachstum: 64 Karten beim
Projektstart, danach **~5 je erfolgreichem Lauf**, davon 2 dauerhafte.

### Zwischenschritt 0.51.5 — Die Websuche eines Blocks, der geliefert hat
(Fehler in **ausgeliefertem** Code — gefunden am 21.08.2026, am 22.08.2026 selbst am Code
nachgemessen. Er stammt aus 0.51.4 und steckt in Georgs installierter Fassung.)

- **Der Fehler:** `claudeCodeMotor.js:2004` rechnet die Restluft für die Websuche mit der
  festen Marke von 80 % (`LOKAL_WAECHTER_PROZENT`), während die Schonung aus 0.51.4 an
  beiden anderen Stellen (`:1665` und `:2440`) über `schwelleNachLieferung` auf 95 % geht.
- **Die Wirkung:** Ein lokaler Block, der seinen Lieferschein abgegeben hat und dank der
  Schonung zwischen 80 % und 95 % weiterarbeitet, bekommt eine **negative** Restluft;
  `webWerkzeuge.js:154` bricht dann jede Suche mit „kein Platz mehr" ab, obwohl
  15 Prozentpunkte frei sind. Betroffen ist jeder lokale Block, der nach seiner Lieferung
  noch etwas nachschlägt.
- **Die Behebung:** dieselbe Rechnung wie an den anderen beiden Stellen —
  `schwelleNachLieferung(LOKAL_WAECHTER_PROZENT, block.meldungen)`. Eine Zeile.
- **Dazu eine Prüfung**, die genau das festhält: Block mit gemeldetem Lieferschein, Stand
  zwischen beiden Marken → Restluft größer als null.
- **Richtigstellung im Bauplan-Text von 0.51.4:** Dort steht „von 80 auf 95 %" für beide
  Schwellen. Der Lokal-Wächter steht bei 80 (`claudeCodeMotor.js:1092`), die
  Koordinator-Schwelle aber bei 85 (`blockKatalog.js:53`). „Beide Schwellen steigen auf 95"
  stimmt, die 80 gilt nur für eine davon.
- **Alltagstest:** Einen Lauf mit einem lokalen Block starten, der nach seiner Lieferung
  noch etwas im Netz nachschlägt. Im Ticker muss eine Web-Zeile stehen statt „kein Platz
  mehr für eine Suche".
### Zwischenschritt 0.51.6 — Die leere Prüfmappe erklärt sich
(Befund Georg: „Mir ist aufgefallen, dass sich die Agents oft darüber wundern, dass dort
keine Prüfungen sind." Beleg im Ticker vom 21.08.2026, 06:58:02: Block 1 meldet „ein
fehlendes `pruefung/`-Verzeichnis" als Fund; der Angreifer sieht um 07:27:38 eigens nach.)
- **Nur 3 von 20 Blocksorten** bekommen heute die Erklärung, dass die Mappe am Laufstart
  geleert wird (Bauer, Prüfer, Gesamtprüfung). Nachgezählt: `BLOCK_KATALOG` hat **20**
  Einträge, die vier `VORLAGEN` dahinter sind Workflow-Vorlagen, keine Blocksorten.
- Es fehlt bei mehr Blöcken als gedacht — nachgesehen, nicht geschätzt: **Paket schneiden,
  Angreifer, Diagnose, Audit**, dazu **Späher, Kontext laden, Integrator (Recherche),
  Karten-Prüfer und Sessionende**.
- Der Satz, den der Bauer schon hat, kommt in deren Aufträge, ergänzt um den Halbsatz:
  *das Gedächtnis der Prüfungen steckt in den Prüfkarten, nicht im Ordner.*
- **Gürtel und Hosenträger:** FlowForge lässt beim Leeren eine kurze `LIESMICH.md` in der
  Mappe zurück. Drei Stellen müssen sie ausnehmen, nicht eine: die Prüfmappen-Ansicht
  (`projekte.js:391`), die Baseline-Vorprüfung (`lauf.js:1094 pruefmappeHatDateien` —
  „ohne eigenen Ordner zählt die ganze Mappe") und das Archivieren
  (`pruefkarten.js:88-99` — ohne Prüfordner zählen „allein die losen Dateien direkt in der
  Mappe"). Sonst gälte eine Mappe, in der nur die Erklärung liegt, als „hat Prüfungen" —
  und die Erklärung selbst würde als einzige „Prüfung" hinter einer Prüfkarte archiviert.
- **Zeitpunkt:** Die `LIESMICH.md` muss **vor** dem Sicherungspunkt „Stand vor Lauf"
  geschrieben werden. `sicherungspunkte.js:866` nimmt `pruefung` nur vom **Diff** aus, nicht
  vom Sicherungspunkt (`AUSGESCHLOSSEN`, `:33`, kennt die Mappe nicht) — sonst verschwände
  die Erklärung bei einem Rollback mitten im Lauf.
- **Alltagstest:** Lauf starten, im Ticker nachsehen — kein Block meldet die leere Mappe
  mehr als Fund.

### 53 — Karten-Index statt Volltext, und die Auswahl wählt nur noch die Aufgabe
(Entscheidung Georg, 21.08.2026: kein Auslöser „ab 125 Karten", sondern gleich die
tragende Fassung — „Ich baue FlowForge ja nicht nur für dieses eine Projekt, sondern auch
für die Zukunft." Der frühere Zwischenschritt 0.51.5 „Wissen und Entscheidungen kommen
automatisch im **Volltext** mit" ist hier aufgegangen: Er hätte einen Mechanismus gebaut,
den dieser Schritt sofort wieder abschafft.)

**Der Befund:** `karten_uebersicht` liefert den **Volltext** aller Karten. Ein einziger
Aufruf holt den kompletten Bestand ins Fenster; ein Index-Werkzeug gibt es nicht.
Nachgemessen: `kartenWerkzeuge.js:33` baut `[sorte · offen/erledigt · Thema] titel: text`,
und `:64` stellt bereits `- id <uuid> · ` voran. Der Index ist also **kein neues Format** —
es fällt nur der Text weg.

**Zwei Darstellungen, nicht eine:** `kartenZeile` hat zwei weitere Abnehmer, die den
Volltext brauchen und behalten — den Blockauftrag (`lauf.js:1046`) und das Projektwissen
der lokalen Helfer-KI (`lauf.js:1065`). Nur die Übersicht bekommt die kurze Zeile.

- `karten_uebersicht` liefert künftig `Kennung · [sorte] titel · thema` (22 statt 120
  Tokens je Karte). **Neu `karten_lesen(ids)`** holt den Volltext bestimmter Karten.
- **Beide Werkzeugbeschreibungen müssen sagen, dass der Text fehlt** — sonst merkt der
  Agent es nicht und schlägt blind Korrekturen vor.
- **Blockauftrag:** Index von allem plus Volltext der zugeteilten Karten.
- **Anweisung an die Auftragsquellen-Blöcke** (Paket schneiden, Diagnose): Index ansehen,
  passende lesen, dann `karten_zuteilen`. Sie sind der Engpass — sie müssen alles sehen,
  laufen lokal mit 131k, und „Paket schneiden" ist ohnehin der schwerste Block
  (21.08.: 1.941 s, 943.000 Tokens).

**Zwei mechanische Blocker, die vor allem anderen fallen müssen:**
- **`karten_lesen` wäre unter „darf nur lesen" hart gesperrt.**
  `claudeCodeMotor.js:154` ist eine einzelne Zeichenkette
  (`KARTEN_NUR_LESEN = 'mcp__karten__karten_uebersicht'`), und `:697-703` macht aus allem
  anderen ein hartes Nein ohne Rückfrage. Paket schneiden, Diagnose, Angreifer, Audit,
  Karten-Prüfer und Späher tragen `nurLesen: true` — der Schritt scheiterte sofort im
  Betrieb. Aus der Zeichenkette wird ein **Satz** (Übersicht **und** Lesen), dazu die
  Ticker-Zeile bei `claudeCodeMotor.js:948`.
- **Fünf Aufträge nennen `karten_uebersicht` beim Namen** (selbst nachgemessen, es sind
  mehr als in der Angriffsliste stand): Kontext laden (`blockKatalog.js:261`), Karten-Prüfer
  (`:998`), Sessionende (`:1087`/`:1097`), Karten-Probe (`:1219`) und der Themen-Sortierer
  (`texte.js:4181`). Alle müssen mit — sonst arbeiten sie ab dem Umbau auf Titeln statt auf
  Inhalten.
- **Der Karten-Prüfer ist NICHT unverändert.** Sein Auftrag lautet „Prüfe dann Karte für
  Karte gegen den echten Stand", der Themen-Sortierer (derselbe Block, anderer Modus)
  „die Kartentexte reichen". Beide brauchen den Volltext und lesen ihn künftig **in
  Portionen** über `karten_lesen`. Er läuft auf `sparsam` (Sonnet, ~200k) — der
  Portionsbetrieb ist Vorsorge, nicht Not.

**Die Auswahl zeigt nur noch offene Aufgaben-Karten** (der Teil aus dem aufgelösten
0.51.5, jetzt in seiner tragenden Form):
- Georg wählt die **Aufgabe**, sonst nichts. Wissen, Entscheidungen und die Status-Karte
  kommen automatisch mit — **als Index**, nicht als Volltext. Das ist der ganze
  Unterschied zur kurzlebigen Zwischenfassung: Der Bauer sieht, dass es die
  Entscheidungs-Karte gibt, und liest sie, wenn er sie braucht.
- **Der Rückfall muss zwei Fälle unterscheiden.** Heute gilt
  `kartenFuerBlock = (instanzId) => kartenZuteilung.get(instanzId) ?? ausgewaehlt`
  (`lauf.js:2213`, benutzt in `:3385`) — ein einziger Rückfall für beides. Nötig sind:
  „es gab überhaupt keine Zuteilung" → volle Auswahl (wie bisher), und „es gab eine, dieser
  Block stand nicht darin" → nur die Status-Karte. Sonst trifft es ausgerechnet die
  **Auftragsquelle selbst**: „Paket schneiden" ist nie sein eigener Nachfahre, kann sich
  nichts zuteilen und bekäme genau eine Karte — obwohl der Startprüfer (`lauf.js:1174-1195`)
  den Lauf nur zulässt, weil offene Aufgaben in der Auswahl stehen
  (`oderOffeneAufgaben` an `blockKatalog.js:378` und `:511`).
- **`karten_zuteilen` weist ab, was nicht in der Auswahl steht**
  (`kartenZuteilungWerkzeuge.js:60-61`, dasselbe bei `paketMeldungPruefen`, `:102`).
  Karten, die automatisch mitkommen, müssen deshalb trotzdem in den `kartenIds` des
  Laufstarts landen — sonst kann die Auftragsquelle sie keinem Bauer zuteilen.
- **An der Oberfläche hängt mehr daran, als eine Zeile:** `kartenIds` ist Pflichtfeld im
  Schema (`laufVorschlagWerkzeuge.js:53-55`), steht im Sessionende-Auftrag
  (`blockKatalog.js:1096-1098`), in `naechster-lauf.json`, im Renderer
  (`Leinwand.jsx:1809`) und in SPEC §5. „Alle Karten hinzufügen" und „Standard-Auswahl"
  (`Leinwand.jsx:1837/1846`) werden durch die neue Regel sinnlos und fallen weg.
- **Richtigstellung:** Der frühere Satz „26 % totes Gewicht in der Auswahl" stimmt nicht.
  Prüfkarten und erledigte Aufgaben sind heute schon draußen (SPEC §5,
  `Leinwand.jsx:1780-1786`, `:1837`) — die 18 von 69 Karten belasten `karten_uebersicht`,
  nicht die Auswahl. Der Gewinn dieses Schritts liegt beim Werkzeug, nicht beim Dialog.

**Messgrundlage, ehrlich gemacht:** Der gemessene Index von **1.544 Tokens** (22 je Karte
gegen 120 im Volltext) enthält die **Kennungen nicht** — gemessen wurde „Titel, Thema,
Sorte". Karten-IDs sind UUIDs mit 36 Zeichen (`projekte.js:251 crypto.randomUUID()`), bei
69 Karten also rund 2.500 ungezählte Zeichen. Deshalb bekommt der Index eine **kurze
Anzeige-Kennung** statt der vollen UUID; die Werkzeuge nehmen beide an.

**Was dieser Schritt NICHT trägt:** Die Dateiliste, die Schritt 52 an Prüfkarten stempelt,
steht **nicht** im Index — sie liegt neben dem Archiv (`pruefkarten/<Projekt>/stempel.json`).
Sonst träfe genau hier zusammen, was 53 abschafft: eine Liste ohne Anzahl-Grenze
(SPEC §4.3) in einer Übersicht, die schlank werden soll.

**Alltagstest:** Den Karten-Prüfer als Ein-Block-Lauf starten — einmal vor dem Umbau,
einmal danach — und im Laufbericht die Tokens dieses Blocks vergleichen. (Nicht die
Start-Prompt-Zeile im Ticker: die gibt es nur bei Modellklasse „lokal", und sie zeigt den
**Auftrag**, nicht die Ausgabe von `karten_uebersicht`.) Zweiter Teil: einen Bau-Lauf
starten — in der Auswahl stehen nur offene Aufgaben; der Bauer nennt trotzdem die
Entscheidungs-Karte des Projekts, weil er sie im Index sieht und nachliest.

**Ehrliche Grenze:** Der Index kostet einen zweiten Werkzeugaufruf. Ein Agent, der ihn
nicht macht, urteilt über Titel — deshalb steht der Hinweis in **beiden**
Werkzeugbeschreibungen und nicht nur im Auftrag: Ein Appell im Auftragstext hält nicht
(Zugsimulator-Befund, 12.08.2026).

### 52 — Prüfkarten laufen von selbst
*(Ausgeliefert als **0.54.0**, nicht als 0.52.0 — Entscheidung Georg, 22.08.2026: Weil 53
vor 52 gebaut wurde, hätte eine 0.52.0 älter ausgesehen als die installierte 0.53.0. Die
Regel in CLAUDE.md ist entsprechend ergänzt: Die Nummer sinkt nie.)*
(Georgs Entwurf, 21.08.2026: „Was ist, wenn der Prüfer nur entscheidet, welche Karte
relevant ist, und das FlowForge meldet, und FlowForge die Tests dann deterministisch
laufen lässt?" — im Gespräch verschärft zu: FlowForge entscheidet auch das selbst, ohne
Agent. Und auf Georgs Einwand hin nach **Relevanz**, nicht nach Laufzeit: „Was bringt es,
wenn 100 Prüfungen innerhalb der Zeit laufen, die aber irgendwas prüfen, was schon ewig
nicht mehr angefasst wurde?")

**Das Problem:** Der Prüfbefehl ist ein Gedächtnis von **genau einem Lauf Tiefe** — er
läuft am Tor und einmal als Baseline beim nächsten Laufstart. Die Prüfkarten sind das
volle Archiv (bei Georg 9 Karten mit 402 KB im Life-OS-Projekt, im Zugsimulator schon 17),
werden aber nur benutzt, wenn Georg eine Karte auf einen Prüfer zieht. Das hat er nie
getan — er kann nicht beurteilen, welche Prüfung wann nötig wäre. Zwischen Lauf N und
Lauf N+2 prüft also niemand mehr, ob das Alte noch hält.

**Drei Messungen am Code und am echten Archiv (21.08.2026) — sie bestimmen die Bauart:**

1. **Das Archiv hat keinen Startbefehl.** `pruefkarten.js:88` bewahrt **Dateien** auf; der
   Prüfbefehl liegt getrennt je Prüf-Instanz (`pruefbefehl.js:45/132`) und wird bei jeder
   bestandenen Prüfung überschrieben. Und es gibt nichts zu raten: Die echten Befehle
   lauten `node pruefung/pruefer-6c746d22/pruefe.mjs` — ein **Sammel-Skript**, kein
   Ordnerlauf (SPEC §4.3 schreibt genau das vor). Die 38 archivierten Karten haben keinen
   einheitlichen Einstieg: mal `alle.mjs`, mal `sammel.mjs`, mal `pruefe.mjs`, mal zwei
   gleichrangige `pruefe_*.js` nebeneinander.
2. **Die Ordnertiefe entscheidet über Grün und Rot.** 89 von 135 archivierten Prüfdateien (beim Bauen am 22.08.2026 nachgemessen; die zuerst notierten 80 waren zu niedrig gezählt)
   rechnen sich den Projektordner über feste Aufwärts-Schritte aus
   (`resolve(HIER, "..", "..")`). Geschrieben wurden sie in `pruefung/pruefer-<Kennung>/`,
   zwei Ebenen unter dem Projekt. FlowForge legt eine gezogene Prüfkarte heute aber nach
   `pruefung/pruefer-<Kennung>/pruefkarte-…/` zurück (`pruefkarten.js:33`) — **eine Ebene
   tiefer**; jeder dieser Pfade zeigt dann auf `pruefung/` statt aufs Projekt.
   **Folge: Die Wiederholungsprüfung per Hand ist heute schon für die Mehrzahl der Karten
   kaputt.** Sie wurde nie benutzt, deshalb ist es nie aufgefallen. Das zu reparieren ist
   keine Zugabe von 52, sondern seine Voraussetzung.
3. **Der Listenschnitt ist eine Heuristik, kein Beweis.** Die Schreibsperre des
   Datenvertrags (SPEC §7) greift an Schreib-Werkzeugen und `>`-Umleitungen und nur bei
   umsetzenden Blöcken — nicht bei Umbenennen, Verschieben, Löschen, nicht bei sonst
   ausgeführten Befehlen (`npm run build` schreibt, wohin es will), nicht bei Prüfern, und
   „keine Dateiliste heißt keine Sperre". Der Schnitt bleibt richtig; der Bauplan darf ihn
   nur nicht als Beweis verkaufen. Die Gegenprobe dazu ist die Rotation (unten).

**Der Stempel — beim Anlegen, aus dem, was FlowForge ohnehin hat:**
- Beim Anlegen der Prüfkarte (`lauf.js:4670`) merkt sich FlowForge drei Dinge:
  **Dateiliste** des Pakets, das damals geprüft wurde, **Prüfbefehl** der Prüf-Instanz und
  den **Ordnernamen**, auf den er zeigte.
- Der Stempel steht **neben dem Archiv im verwalteten Bereich**, nicht an der Karte:
  `pruefkarten/<Projekt>/stempel.json`. Damit kein neues Agentenfeld, kein Kartentext, der
  wächst, und kein Ballast im Karten-Index, den Schritt 53 gerade schlank macht (die
  Dateiliste hat bewusst keine Anzahl-Grenze, SPEC §4.3 — an der Karte wäre sie ein Fass
  ohne Boden). Löschen einer Karte räumt ihren Stempel mit weg.
- Für den Prüfer rechnet `dateiListeFuer` heute **nichts** (`lauf.js:4042`, früher
  Rückgabewert bei `prueft`). Gebraucht wird eine zweite Funktion ohne diesen Ausstieg:
  die Vereinigung der Pakete, die beim Prüfer angekommen sind — dieselbe Auswahlregel
  (`uebergabenAuswahl` + `zuschnittRouting`), nur ohne die Sperr-Absicht.

**Ausführen — an der richtigen Tiefe, mit dem mitgestempelten Befehl:**
- FlowForge legt die aufbewahrten Dateien nach `pruefung/pruefkarte-<kurz>/` — **auf die
  Ebene, auf der sie geschrieben wurden**, nicht in den Prüfordner hinein.
- Im gestempelten Befehl wird der alte Ordnername durch den neuen ersetzt
  (`pruefung/pruefer-6c746d22` → `pruefung/pruefkarte-0049e5aa`). Abgespielt wird mit
  derselben Mechanik wie das Tor (`befehlAbspielen`): ohne KI, **0 Tokens**, mit
  Zeitlimit, mit eigener Prozessgruppe und Aufräumen danach.
- **Enthält der gestempelte Befehl den Ordnernamen nicht** (`npm test` liest ein Skript
  aus `package.json`), ist die Karte nicht allein abspielbar. Dann sagt der Ticker das —
  kein stilles Überspringen, keine erfundene Ersatzregel.
- **Port-Schutz wie beim Rauchtest:** Live-Prüfungen binden feste Ports (Georgs Prüfungen
  laufen gegen `127.0.0.1:3888`). Vor dem Abspielen greift dieselbe Besitzer-Prüfung wie
  in `torProzess.js` (`portBesitzer`/`aufPortFreiWarten`): eigene Reste werden abgeräumt,
  ein **fremder** Besitzer (Georgs eigener Server, der App-Tab) führt zu „nicht gemessen"
  statt zu einem falschen Rot.

**Die Auswahl — eine Regel, kein Appell:**
- **Relevanz = Schnittmenge:** Dateiliste des laufenden Pakets ∩ gestempelte Dateiliste
  der Karte ≠ leer.
- **Im Zweifel ausführen.** Karten ohne Stempel (alle heutigen), Läufe ohne Dateiliste,
  jede Unklarheit → die Prüfung läuft. Übersprungen wird nur, was nachweislich nichts mit
  dem Paket zu tun hat — dieselbe Haltung wie bei der VRAM-Prüfung, die lieber schweigt,
  als aus einer misslungenen Messung zu warnen. **Entscheidung Georg 21.08.2026:** Die
  9 stempellosen Altkarten laufen wie gestempelte mit, nicht in einem Schonprogramm.
  **Richtigstellung beim Bauen (22.08.2026, am echten Archiv gemessen):** Diese Entscheidung
  gilt für die **Auswahl** — stempellose Karten werden nie als „nicht betroffen"
  weggefiltert. **Ausführen** lassen sie sich trotzdem nicht: Der Kartenordner heißt nach
  der Karten-Kennung, der aufbewahrte Prüfbefehl ist nach der Instanz-Kennung geschlüsselt,
  und die Herkunft einer Prüfkarte trägt keine Instanz-Kennung — Überschneidung 0 von 38
  Karten. Ein Einstieg lässt sich auch nicht ableiten (15 Karten mit Sammler, 4 Einzeldatei,
  13 nur `*.test.*`, 6 mehrere gleichrangige Skripte). Sie heißen deshalb „ohne Stempel —
  nicht abspielbar" und bekommen im Ticker eine **eigene Zahl**, getrennt von „nicht
  betroffen". Ab der ersten neu angelegten Prüfkarte wird gestempelt. Eine einmalige
  Rettung des Altbestands wäre ein eigener kleiner Schritt nach 52 — sie steckt bewusst
  nicht hier drin, sonst hinge der Alltagstest an einer Reparatur, die selbst schiefgehen kann.
- **Rotation als Gegenprobe** (Entscheidung Georg 21.08.2026): Zusätzlich laufen je Lauf
  die **zwei am längsten nicht gelaufenen** Karten mit, auch wenn sie nicht betroffen
  sind. Das deckt die indirekten Fälle ab, die ein Listenschnitt strukturell nicht sieht,
  und ist zugleich die eingebaute Kontrolle: Findet eine Rotationskarte etwas, das die
  Auswahl übersehen hat, ist die Auswahl zu eng — gemessen statt vermutet. Über die Läufe
  kommt jede Karte dran, ohne dass je alles auf einmal läuft.
- **Warum kein Agent entscheidet:** Der Zugsimulator-Befund (12.08.2026) zeigt, dass eine
  Bitte im Auftrag nicht hält — „Die Prüfmappe wuchert weiter TROTZ Auftrags-Verbot … Der
  Auftrag bittet, nichts erzwingt". Ein Listenschnitt in FlowForge ist eine Regel. Ein
  Agent, der eine Prüfdatei überfliegt und schätzt, was sie abdeckt, wäre eine Vermutung
  im Gewand einer Antwort.

**Wann — vor und nach jedem schreibenden Block** (Entscheidung Georg 21.08.2026):
- **Vorher-Messung statt Nebenordner:** Die ausgewählten Prüfungen laufen **direkt bevor**
  ein schreibender Block startet und **direkt nachdem** er fertig ist — im echten
  Projektordner. Damit trennt sich „vorher schon rot" von „neu kaputt" von selbst, und die
  Zuordnung ist so scharf wie möglich: Es war genau dieser Bauer. Ein Sicherungspunkt in
  einem Nebenordner (`git worktree`) entfällt damit — und mit ihm die beiden Stolpersteine,
  die dort gedroht hätten: fehlende Fremdpakete im frischen Worktree (`node_modules` steht
  in `.gitignore`; ein Verzeichnis-Link statt einer Kopie hat schon einmal still einen
  Installer zerschossen) und ein zweiter Server auf demselben Port.
- **Nicht, während ein anderer Schreiber läuft.** Dieselbe Regel, die die SPEC für
  Sicherungspunkte schon kennt („würde dessen halbfertige Änderungen einfrieren"). In
  einer Welle (Bauschritt 46) misst FlowForge erst, wenn der Ordner wieder still ist.
- **Zeit-Notbremse, die nie etwas weglässt:** Jede ausgewählte Karte läuft **mindestens
  einmal je Lauf**. Reißt die Summe der Messungen den Deckel je Messpunkt (Vorschlag:
  10 Minuten, in den Einstellungen verstellbar), rutschen die
  langsamsten Karten von „je schreibendem Block" auf „einmal je Lauf" — und der Ticker
  nennt sie namentlich. Das ist kein Zeitbudget für die Relevanz (das hat Georg zu Recht
  verworfen): Es ändert nur, wie **oft** eine Prüfung läuft, nie **ob**.
- **Melden, nicht urteilen:** FlowForge merkt sich das Ergebnis je Block und gibt es dem
  Prüfer in den Auftrag — genau wie heute die Baseline („vorher schon rot: …",
  `lauf.js:3246`). Eine Reparatur-Runde löst es **nicht** aus: Zwischen Bauer 1 und
  Bauer 2 kann Rot legitim sein.
- **Bei Rot bekommt der Prüfer die Fehlerausgabe und den Ordner** der Karte und trennt
  echte Regression von veralteter Prüfung. Passt er sie an, ersetzt die angepasste Fassung
  die aufbewahrte (`pruefkartenArchivAuffrischen`, gibt es schon). Dafür muss die
  Prüfmappen-Sperre die Kartenordner für Prüfer freigeben — heute darf ein Prüfer nur in
  seinen eigenen Ordner schreiben (SPEC §4.3, Bauschritt 41).

**Was FlowForge ausdrücklich NICHT tut:**
- **Keine Karte automatisch löschen, keine automatisch in eine Aufgaben-Karte verwandeln.**
  Der frühere Entwurf wollte das für Karten, deren gestempelte Dateien es nicht mehr gibt.
  Das trägt nicht: `erlaubteDateien` nennt ausdrücklich „auch die, die erst entstehen", und
  Dateilisten werden „als Pfade **und Ordner**" genannt — eine erlaubte, nie angelegte
  Datei macht die Prüfung nicht wertlos. Dazu SPEC §3.1: „**Der Nutzer** kann Prüfkarten
  bearbeiten und löschen." Der Stempel entscheidet, **ob gemessen wird**, nie, **ob
  gelöscht wird**.
- **Die Gesamtprüfung spielt nichts ab.** Georgs Entscheidung vom 13.08.2026 bleibt: „du
  schreibst dir deine Prüfungen frisch, statt alte abzuspielen" (SPEC §4.3,
  `blockKatalog.js:881`). Die Gegenprobe leistet die Rotation, innerhalb derselben
  Mechanik.
- **Ziehen per Hand bleibt** — für den Fall, dass Georg gezielt etwas wiederholen will.
  Auch die von Hand gezogene Karte landet künftig auf der richtigen Ebene; damit ist der
  zweite Messbefund oben mitrepariert. Dieselbe Karte an zwei Prüfern bekommt dann **eine**
  Kopie statt zweier (FlowForge führt sie aus, nicht der Prüfer) — die bisherige Regel
  „gewinnt die zuletzt bestandene Fassung" bleibt gültig.

**Kein stilles Weglassen:** Eine Ticker-Zeile je Messpunkt nennt, wie viele archivierte
Prüfungen ausgeführt wurden, wie viele als nicht betroffen übersprungen wurden, wie viele
als nicht abspielbar galten und welche aus der Rotation dabei waren.

**Ehrliche Grenzen — bewusst nicht gelöst:**
- **Sicherheit, ausdrücklich benannt:** Heute laufen alte, von Agenten geschriebene
  Prüfdateien nur, wenn Georg eine Karte zieht. Ab 52 führt FlowForge sie **von selbst**
  aus, ohne Rechte-Rückfrage. Die kurze Leine des Prüfbefehls (SPEC §4.3: genau ein
  Test-Werkzeug, keine Verkettung, keine Umleitung) gilt dem **Befehl**, nicht dem, was die
  gestartete Datei tut. Das ist eine echte Ausweitung. Sie ist vertretbar, weil die Dateien
  aus dem eigenen Projekt stammen und beim Anlegen einmal grün gelaufen sind — sie gehört
  aber sichtbar in die SPEC, nicht in eine Fußnote.
- **Der Stempel kennt nur, was das damalige Paket geschrieben hat.** Eine Live-Prüfung, die
  über HTTP den halben Server durchmisst, deckt mehr ab als ihre Dateiliste. Eine statisch
  geparste Import-Hülle scheiterte daran ebenfalls — die Prüfdatei importiert nichts, sie
  macht eine HTTP-Anfrage. Deshalb bleibt der Stempel das Hauptsignal und die Rotation die
  Gegenprobe.
- **Der Prüfer darf alte Prüfungen anpassen.** Auf Dauer kann er sie damit auch aufweichen.
  Gegengewicht: Er passt nur an, was rot ist, und jede angepasste Karte steht namentlich im
  Ticker.

**Alltagstest — zweistufig** (die Zweistufigkeit ist keine Bequemlichkeit, sondern die Folge
der Richtigstellung oben: Am Tag der Auslieferung gibt es noch keine einzige gestempelte
Karte, ein Stempel entsteht erst mit der nächsten bestandenen Prüfung):
1. **Erster Lauf** — irgendein normaler Lauf mit einem Prüfer. Erwartung im Ticker: an jedem
   Messpunkt eine Zahlen-Zeile, in der die alten Karten als „ohne Stempel — nicht
   abspielbar" mit eigener Zahl stehen. Am Ende, nach der bestandenen Prüfung, entsteht
   eine neue Prüfkarte — die ist gestempelt.
2. **Zweiter Lauf** — ein Paket bauen lassen, das eine Datei anfasst, die genau diese neue
   Prüfkarte gestempelt hat. Im Ticker muss stehen: dass FlowForge diese Prüfung vor dem
   Bauer und nach dem Bauer gemessen hat, wie viele es als nicht betroffen übersprungen hat
   und welche Karten aus der Rotation mitgelaufen sind. Danach im Laufbericht nachsehen, ob
   das Ergebnis im Auftrag des Prüfers steht — und dass keine Reparatur-Runde davon
   ausgelöst wurde.

### 54 — Werkstatt-Tab: die lokale KI live sehen und wirklich messen
*(Version **0.55.0** — 0.54.0 ist von Bauschritt 52 belegt, siehe CLAUDE.md.)*

(Wunsch Georg, 22.08.2026, aus dem Brainstorming über
`github.com/TiniLLM/ollama-token-monitor`. **Entscheidungen Georg:** beide Stufen — Überblick
UND echte Messung — in **einem** Schritt; ohne laufenden Lauf zeigt der Tab den **Zustand der
Rechner**. Der Hinweis, dass ein Ausfall der Zählstelle dann zusammen mit dem Tab in Betrieb
geht und die Fehlersuche verdoppelt, lag vor der Entscheidung auf dem Tisch.)

**Warum das Fremdwerkzeug nicht übernommen wird, seine Bauart aber schon:** `otop` ist ein
Terminal-Dashboard in Python, das sich als Zwischenstation auf Port 11435 vor Ollama setzt
und mitzählt. Als Werkzeug verworfen — 1 Commit, 1 Stern, kein Release, auf macOS/Apple
Silicon zugeschnitten (die GPU-Anzeige, der interessanteste Teil, greift auf Georgs
Windows-Karte nicht), und es stünde als Fremdprozess im Weg jedes lokalen Blocks. Die
**Bauart** ist dagegen genau richtig, weil FlowForge sie ohne Fremdprozess haben kann.

**Drei Messungen am Code (22.08.2026) — sie tragen den Schritt:**
1. **Es gibt genau eine Stelle, an der der Weg zur lokalen KI festgelegt wird:**
   `claudeCodeMotor.js:2130` setzt `umgebung.ANTHROPIC_BASE_URL = lokal.adresse`. Trägt
   FlowForge dort seine eigene Adresse ein, läuft der ganze Verkehr des Block-Agenten durch
   FlowForge — ohne Python, ohne zusätzlichen Port auf dem Ollama-Rechner, ohne dass Georg
   etwas installiert.
2. **Die Helfer-KI läuft an dieser Stelle vorbei.** `lokaleHelfer.js` spricht mit eigenem
   `fetch` direkt gegen `adresse` (`:151`, `:662`, `:675`, `:697`). Sie ist aber FlowForges
   eigener Code und nimmt die Adresse als Parameter — sie lässt sich also genauso durch die
   Zählstelle führen. Das muss **absichtlich** gebaut werden, sonst zeigt der Tab die halbe
   Wahrheit und niemand merkt es.
3. **Der Füllstand ist heute geschätzt, nicht gemessen.** `LOKAL_WAECHTER_PROZENT = 80`
   (`claudeCodeMotor.js:1174`), nach abgegebenem Lieferschein 95 über
   `schwelleNachLieferung` (`:1223`, `:1762`). Die Schätzung existiert, weil Ollama oberhalb
   der Fensterkante still kappt und gedeckelte `usage` meldet (0.51.1) — deshalb die
   Selbst-Kalibrierung. **Wie gut sie ist, ist bis heute nicht gemessen.** Genau das
   beantwortet eine Zählstelle: Sie sieht die Anfrage, bevor Ollama sie beschneidet.

**Was der Tab zeigt** (eigener Tab in der Titelleiste, neben „Metriken"):
- **Ohne Lauf — Zustand der Rechner** (Entscheidung Georg): je Adresse aus der Adress-Liste
  (§9) — erreichbar? welches Modell liegt geladen (`/api/ps`)? passt es auf die Karte
  (VRAM-Anteil, und bei misslungener Messung ehrlich „nicht beantwortbar" statt geraten —
  dieselbe Haltung wie `ollamaSpeicherStand`)? liegt das abgeleitete `flowforge-<basis>`
  überhaupt vor (`/api/tags`)? Damit beantwortet FlowForge **vor** dem Start die Frage „kann
  ich jetzt lokal bauen"; heute erfährt Georg das erst mitten im Lauf im Ticker.
- **Während eines Laufs — je arbeitendem lokalen Block:** Adresse, Modell, Laufzeit, Tokens
  hinein und heraus (**gemessen**), Tokens je Sekunde, VRAM-Stand — und der Füllstand
  **gemessen neben geschätzt**, mit der geltenden Wächter-Marke daneben.

**Die Zählstelle — Bauart und die Regeln, die nicht verhandelbar sind:**
- Ein HTTP-Weiterleiter im Hauptprozess, gebunden **nur an 127.0.0.1**, Port vom
  Betriebssystem vergeben (Port 0), je Lauf frisch. **Nie eine feste Nummer:** Ein belegter
  Port legte sonst jeden lokalen Lauf lahm — genau der Befund, der 0.46.2 den Port-Schutz
  des Rauchtests eingebracht hat.
- Er reicht Anfrage und Antwort **durch** — Strom an Strom, ohne zu sammeln, ohne umzuformen.
  Gezählt wird aus dem, was ohnehin vorbeikommt: Größe der Anfrage beim Senden, `usage` aus
  dem Antwortstrom.
- **Die Gegenprobe steht schon im Bauplan:** 0.51.2 hat gemessen, dass ein schlecht gebautes
  Textfilter den **ganzen Hauptprozess 232 Sekunden** stilllegt (1 MB Eingabe, kein Timer
  lief). Eine Zählstelle, die den Strom sammelt oder zeichenweise durchsucht, wäre derselbe
  Fehler an einer schlimmeren Stelle: Dann redet kein lokaler Block mehr mit Ollama.
  **Pflicht-Prüfung:** ein großer Antwortstrom geht durch, und die zusätzliche Verzögerung
  wird gemessen und festgenagelt.
- **Fällt die Zählstelle aus, fällt nicht der Lauf aus:** Lässt sie sich nicht binden, sagt
  der Ticker es im Klartext, und der Block bekommt die echte Ollama-Adresse wie bisher. Kein
  stiller Ausfall — aber auch kein toter Lauf wegen eines Messgeräts.
- Sie reicht ausschließlich an die **eine** für diesen Block zugeteilte Adresse weiter (kein
  frei wählbares Ziel), und sie gilt nur für lokale Motor-Instanzen und die lokale Helfer-KI.
  Claude-Blöcke reden unverändert direkt mit Anthropic.

**Der eigentliche Zweck — die Gegenprobe zur Schätzung:** Eine Zeile je lokalem Block im
Laufbericht stellt den geschätzten Füllstand neben den gemessenen und nennt den Abstand.
Liegt die Schätzung systematisch daneben, ist das die belastbare Grundlage, die Marke zu
korrigieren, statt weiter zu raten. Ohne diese Zeile wäre die Zählstelle nur Schaufenster.

**Ehrliche Grenzen — bewusst benannt:**
- Ein zusätzlicher Sprung kostet Zeit. Messbar klein, aber nicht null — die Messung gehört
  in den Schritt, nicht in eine Behauptung.
- Tokens je Sekunde ist eine **abgeleitete** Zahl, keine Angabe von Ollama.
- Der Tab zeigt nur, was durch die Zählstelle geht. Was ein Agent an ihr vorbei tut (ein
  ausgeführter Befehl, der selbst Ollama anspricht), sieht sie nicht.

**Alltagstest:** Vor dem Start den Tab öffnen, ohne dass ein Lauf läuft — es muss je
Ollama-Adresse dastehen, ob sie erreichbar ist und ob das Modell auf die Karte passt.
Dann einen Lauf mit einem lokalen Block starten und im Tab zusehen: Tokens müssen steigen,
Tokens je Sekunde eine plausible Zahl zeigen, und der Füllstand muss **zweimal** dastehen —
gemessen und geschätzt. Danach im Laufbericht die Vergleichszeile suchen: Wie weit lag die
Schätzung daneben?

### 55 — Gemessen statt geglaubt: die Dateiliste des Umsetzungsberichts
*(Version **0.56.0**.)*

(Funde 7 und 8 aus den beiden Läufen am Haushaltsplaner, 22.08.2026. Die Reparaturen
1–6 und 9 aus derselben Fundliste sind in 0.54.1 erledigt; diese beiden brauchen neue
Mechanik und stehen deshalb hier.)

**Der Befund:** FlowForge nimmt die Meldung eines Blocks, wie sie kommt. Nichts wird
gegen die tatsächlichen Vorgänge gemessen — obwohl FlowForge die Tatsachen zum Teil
schon hat.

Zwei Belege aus zwei Läufen:
1. **Dateiliste (Vormittagslauf).** Der Integrator meldete **neun** angelegte oder
   geänderte Dateien. Angefasst hatte er **zwei** (`index.html`, `js/app.js`); vier
   stammten von den Bauern vor ihm, drei lagen in `arbeitsablage/` und werden nach dem
   Lauf gelöscht. In seiner eigenen Anmerkung stand es sogar richtig: „Die Datenmodule
   selbst habe ich nicht geändert." Wer nur die Liste liest, glaubt das Gegenteil.
2. **Maßstab (Abendlauf).** Der Bauer nannte seine Prüfarbeit eine „Stichprobe".
   Tatsächlich waren es vier selbstgebaute Prüfgerüste in `arbeitsablage/`, 31 + 8
   Prüfungen und rund 30 Minuten. Das Wort stammt aus seinem eigenen Auftrag
   („schnelle Stichproben") — also trägt alles dieses Etikett, unabhängig vom Umfang.

**Was FlowForge schon hat:** Jeder Block hat seit Bauschritt 45 einen eigenen
Sicherungsstrang, und `punkteVergleichen(projektPfad, diffBasis, letzterPunkt,
{nurDateien: wirkbereich})` liefert daraus die Liste der wirklich geänderten Dateien —
dieselbe Rechnung, aus der schon der Diff für die Reparatur-Runde entsteht
(`diffTextFuer` in `lauf.js`). Es fehlt nur, sie an dieser Stelle zu benutzen.

**Was gebaut wird:**
- Beim Annehmen eines Umsetzungsberichts misst FlowForge die Dateien, die dieser Block
  auf seinem eigenen Strang wirklich angefasst hat — angelegt, geändert, gelöscht sind
  aus dem Vergleich ablesbar, das Etikett muss also nicht geglaubt werden.
- Im Laufbericht und in der Block-Karte steht die **gemessene** Liste. Die gemeldete
  wird **nicht** ersetzt, sondern danebengestellt, wenn sie abweicht — sonst
  verschwände genau die Information, dass der Block sich geirrt hat.
- Zwei Abweichungen werden benannt, je als eigene Zeile: gemeldet, aber nicht
  angefasst · angefasst, aber nicht gemeldet. Die zweite ist die gefährlichere.
- Für den Rest (Maßstab, Aufwand) genügt, dass der Bericht nicht behauptet, was
  FlowForge nicht deckt: Das Wort „Stichprobe" gehört aus der Auftragsvorlage heraus,
  weil es dort jede Prüfarbeit einfärbt, egal wie groß sie war.

**Ehrliche Grenzen — vorher benennen:**
- Ein Block ohne Sicherungsstrang (Nur-Lese-Blöcke, wiederaufgenommene Läufe von vor
  Bauschritt 45) hat nichts zu messen. Dann steht die gemeldete Liste allein da — und
  der Bericht sagt, dass sie ungemessen ist. Kein stiller Rückfall.
- Gemessen wird der **Strang**, nicht die Absicht. Ein Bauer, der eine Datei ändert
  und wieder zurückändert, taucht nicht auf. Das ist richtig so, aber es heißt: Die
  Messung deckt das Ergebnis, nicht den Weg.
- `arbeitsablage/` gehört in die Messung hinein und wird als solche markiert — sie ist
  echte Arbeit, verschwindet aber nach dem Lauf.

**Fund 8 — bewusst zurückgestellt, hier festgehalten.** Im selben Umsetzungsbericht
standen wenige Zeilen auseinander zwei Aussagen zu derselben Sache: `angriffsliste`
sagte „überfällig, da Mo verstrichen", `anmerkung` sagte „am Montag rot und am
Mittwoch (heute) neutral". Im Code ist **beides richtig** — es gibt zwei Ebenen
(`istUeberfaellig` je Aufgabe, ein Flag je Tag). Im Bericht liest es sich als
Selbstwiderlegung. Schaden ist keiner entstanden: Der Prüfer ist in den Code gegangen,
hat beide Ebenen verstanden und richtig aufgelöst. Deshalb **niedrig**.
Der Grund fürs Zurückstellen ist ehrlich: FlowForge kann Text nicht gegen Text messen.
Übrig blieben ein Appell im Auftrag (hält nicht — Zugsimulator-Befund, 12.08.2026)
oder eine kleine KI-Kohärenzprüfung über die Felder EINER Meldung, bevor sie
angenommen wird. Letzteres ist machbar und billig (es geht um wenige hundert Zeichen),
aber es ist ein eigener Mechanismus mit eigenem Fehlalarm-Risiko und gehört nicht in
denselben Schritt wie eine Messung, die nicht raten muss. Entscheidung für Georg,
wenn 55 steht.

**Alltagstest:** Einen Lauf mit zwei Bauern und einem Integrator fahren. Danach im
Laufbericht beim Integrator nachsehen: Die Dateiliste muss die zwei Dateien nennen,
die **er** angefasst hat — und wenn er mehr gemeldet hat, muss darunter stehen, welche
davon nicht von ihm stammen. Gegenprobe: Bei einem Bauer, der genau meldet, was er
getan hat, darf keine Abweichungszeile erscheinen.

- **Gebaut (24.08.2026):** Gemessen wird **nach jeder Strang-Zusammenführung** eines
  Blocks, nicht am Melde-Werkzeug — Kernfund der Angriffsliste: Beim Eintreffen der
  Meldung existiert der Punkt des Blocks noch gar nicht (blockendePunktFuer legt für
  Blöcke mit Strang nichts an), die im Bauplan skizzierte Rechnung hätte **lautlos immer
  leer** gemessen. Stattdessen liefert strangZusammenfuehren jetzt auf allen drei
  Erfolgs-Pfaden zusätzlich die **basisId** (Haupt-Spitze unmittelbar vor dem Merge);
  gemessen wird der Diff basisId → entstandener Punkt (messungNachZusammenfuehrung) —
  fertige Nachbararbeit steckt in der Basis und misst sich nicht als eigene. Je Anlauf
  gemessen, am Knoten zur **Netto-Wirkung vereinigt** (messungVereinen: neu+gelöscht →
  war nie da usw.), damit die kumulativ gemeldete Liste denselben Bezugszeitraum hat;
  die vereinigte Messung überlebt die Wiederaufnahme im Laufstand. `m.gemessen` an der
  umsetzungsbericht-Meldung (dateien · arbeitsablage · nurGemeldet · nurGemessen ·
  ok:false mit Grund), Abgleich nur über **normalisierte Pfade** mit
  Ordner-Präfix-Deckung, nie über die Art (eine Umbenennung ist keine Falschmeldung);
  FlowForges Verwaltungsdateien (karten.json, startanleitung.json …) zählen nicht mit.
  **arbeitsablage/** liegt in KEINEM Sicherungspunkt (zweiter Kernfund — AUSGESCHLOSSEN
  greift schon beim Einsammeln, nicht erst beim Diff) und wird per
  Dateisystem-Momentaufnahme je Anlauf gemessen; überlappen sich schreibende Anläufe,
  ist der Anteil ehrlich „nicht zuzuordnen" statt falsch zugeordnet. Ticker-Zeile je
  Messung, ungemessen immer mit Grund („kein eigener Sicherungsstrang" …) — nie als
  „nichts angefasst" dargestellt. Anzeige in Laufbericht UND Block-Karte (eine
  Komponente), „Angefasst, aber nicht gemeldet" im Warnton. Der **Integrator** behält
  seinen Auftrag (die kumulierte Liste ist für die Nachfolger, dritter Kernfund) —
  seine Abweichungszeile heißt neutral „Aus den gelieferten Berichten übernommen, nicht
  selbst angefasst". „Schnelle Stichproben" ist aus Bauer- und Integrator-Auftrag
  heraus; die Prüfer-Stellen („Stichproben nachstellen") bleiben bewusst — dort ist es
  eine Handlungsanweisung ans Zweitaudit, kein Etikett auf eigener Arbeit.
- **Messwerte der Bausession (24.08.2026, 1 Angreifer, 2 Bauer mit Vertrag, 2 Prüfer,
  Integrator):** Angriffsliste 13 Funde, davon 3 blockierend (alle vor dem Bauen in den
  Vertrag eingearbeitet, siehe oben). Prüfer 1 (Mechanik, 35 Wegwerf-Prüfungen an
  echten Sicherungspunkten + 198 Regressionsläufe): bestanden, 4 kleine Befunde, 2
  nachgearbeitet (Wiederaufnahme übersteht korrupte gemessenDateien-Einträge; der
  Abgleich dedupliziert über den normalisierten Pfad statt der Roh-Schreibweise).
  Prüfer 2 (Ende-zu-Ende, gebaute App, CDP, eigener Datenordner, 3 echte Läufe auf
  Opus, 1:52–5:44 min, 0,65–1,40 $ theoretisch): Eine bestellte Falschmeldung wurde
  gemessen und beanstandet — Ticker wörtlich „Block 2 ‚Bauer · Messprobe-Bau':
  Dateiliste gemessen: 2 Dateien angefasst · Abweichung: 1 gemeldet, aber nicht
  angefasst · 1 angefasst, aber nicht gemeldet." —, die Gegenprobe (ehrliche Meldung)
  blieb ohne Abweichungszeile, Alt-Berichte ohne gemessen-Feld bleiben unverändert
  lesbar. npm test: 1727 Prüfungen grün. Ehrliche Grenzen: Die Integrator-Neutralzeile
  ist am Code belegt und regelgeprüft, aber nicht Ende-zu-Ende erzeugt (bräuchte einen
  echten Mehrzweig-Lauf); Fund 8 (Text-gegen-Text-Kohärenz) bleibt wie geplant
  zurückgestellt. Nebenbefund außerhalb von 55, für eine eigene kleine Session
  vorgemerkt: laufStarten mit Schrägstrich-Pfad legt die Karten-Werkzeuge lahm („Der
  Projektordner ist nicht mehr da"), über die Oberfläche nie erreichbar.

## Paket 56–58: Funde außerhalb der Dateilisten im selben Lauf reparieren

**Der Entwurf, aus dem diese drei Schritte kommen — vor dem Bauen lesen:**
`D:\FlowForge_Testprojekte\_lifeos-ernte\entwurf-zusatzbauer-v3.md`.
Dort steht jede Entscheidung **mit ihrer Begründung**; ohne die werden sie beim Bauen
neu aufgerollt. Dieselbe Mechanik als Bild — der schnellste Zugang und zugleich der
Vollständigkeits-Test:
`…\_lifeos-ernte\zusatzbauer-ablauf.png` und `…\_lifeos-ernte\zusatzbauer-kriterien.png`.

Der Entwurf ist durch zwei Angriffsrunden mit je drei unabhängigen Angreifern gegangen
und mit Georg durchgesprochen. **Nichts davon ist gemessen** — die Stellenangaben sind
am Code nachgelesen. Zwei Befunde entstanden dort, weil eine Reparatur auf Mechanik
gebaut war, die es nicht gibt: Wer hier eine Codestelle zitiert, öffnet sie vorher.

**Die Reihenfolge ist nicht beliebig.** 56 hat eigenen Nutzen und ist Voraussetzung für
57 (ohne die Werkzeugliste hält der Pflichtbeleg den Lauf in vier Sprachen an). 57
liefert den Fall, aus dem alles entstand, und braucht **keine** neue Mechanik im Motor.
58 setzt allein auf 57 auf und trägt das einzige echte Risiko des Pakets.

*(Nummerierung setzt voraus, dass 55 vorher gebaut wird. Wird 57 vorgezogen, gilt die
Regel aus CLAUDE.md: Die Versionsnummer sinkt nie.)*

### 56 — Testbefehle ohne Rückfrage, und ein Angreifer, der messen darf
*(Version **0.57.0**.)*

**Der Befund:** Zwei kleine Lücken, die denselben Effekt haben — FlowForge hält an,
wo es nicht müsste.

1. **Die Werkzeugliste ist historisch, nicht begründet.** `PRUEFBEFEHL_WERKZEUGE`
   (`torRegeln.js:16-21`) enthält `go, cargo, dotnet, mvn, gradle, make, rspec,
   phpunit, mocha, deno, bun` — FlowForge spielt diese Befehle also selbst ab, ohne
   jede Rückfrage. `BEFEHLE_OHNE_RUECKFRAGE` (`claudeCodeMotor.js:286-291`) enthält
   **keinen davon**: nur `node, npm, npx, pnpm, yarn, tsc, vitest, jest, python,
   python3, py, pip, pip3, pytest`. Ein Agent, der in einem Rust-, Java-, .NET- oder
   PHP-Projekt seine Tests laufen lässt, löst deshalb eine Rechte-Rückfrage aus. `npm`
   steht längst drin und kann über Projekt-Skripte genau dasselbe — die Lücke ist
   gewachsen, nicht entschieden.
2. **Die Einstellung erreicht den Angreifer nicht.** Seit dem 14.08.2026 gibt es
   `nurLesenBefehle` (`claudeCodeMotor.js:714-717`, im Code „auf eigene Gefahr"):
   Nur-lesende Blöcke dürfen dann Befehle ausführen wie der Bauer, mit normaler
   Einstufung, Git-Sperre und Rückfragen; die Schreib-Werkzeuge bleiben gesperrt. Der
   Angreifer-Auftrag sagt ihm aber **unbedingt** (`blockKatalog.js:479-482`):
   „Programme oder Tests auszuführen ist für diesen Block gesperrt — versuche es gar
   nicht erst." Georg kann den Schalter also umlegen, und der Angreifer probiert es nie.

**Was gebaut wird:**
- Die elf Werkzeuge aus `PRUEFBEFEHL_WERKZEUGE`, die in `BEFEHLE_OHNE_RUECKFRAGE`
  fehlen, kommen dort hinein. Beide Listen bleiben getrennt — sie beantworten
  verschiedene Fragen —, aber die zweite darf nicht enger sein als die erste.
- Der Satz im Angreifer-Auftrag liest die Einstellung mit: Ist `nurLesenBefehle` aus,
  bleibt er wie er ist. Ist sie an, sagt er stattdessen, dass Befehle laufen dürfen und
  Schreiben weiterhin nicht.

**Ehrliche Grenzen — vorher benennen:**
- `make` und `gradle` führen aus, was das Zielprojekt in ihre Dateien geschrieben hat.
  Das gilt für `npm run` genauso und ist der Grund, warum die Git-Sperre und die
  Einstufung der übrigen Befehle unangetastet bleiben.
- Der Angreifer bleibt für **Schreib**-Werkzeuge gesperrt. Dieser Schritt lockert
  ausschließlich das Ausführen.

**Alltagstest:** In einem Projekt mit einem Testbefehl, der nicht `npm test` ist
(genügt: ein winziges Python- oder Go-Projekt), einen Lauf mit Prüfer fahren. Der
Prüfer muss seinen Testbefehl ausführen können, ohne dass FlowForge fragt. Zweitens:
Die Einstellung „Nur-lesende Blöcke dürfen Befehle ausführen" einschalten und einen
Lauf mit Angreifer fahren — im Liveticker muss zu sehen sein, dass der Angreifer einen
Befehl ausführt. Gegenprobe: Einstellung aus, derselbe Lauf — dann führt er keinen aus
und schreibt in keinem Fall eine Datei.
*(Richtigstellung beim Bauen: Ein Python-Projekt beweist für Teil 1 nichts —
`python`/`pytest` liefen schon vorher ohne Rückfrage. Die echte Gegenprobe ist Go,
Rust, Java, .NET oder Make.)*

- **Gebaut (25.08.2026):** Kernfund der Angriffsliste: **Punkt 2 war funktional schon
  gebaut** — seit Zweitaudit D-01 (14.08.2026) hängt bei aktiver Einstellung ein
  Nachsatz an jedem nur-lesenden Block, der „abweichend von deinem Auftrag" erlaubt,
  was der Auftrag vorn kategorisch verbietet; der Bauplan-Punkt war gegen einen Stand
  von davor geschrieben. Und der Sperr-Satz steht nicht nur im Angreifer, sondern in
  **fünf** Blöcken (Kontext laden, Paket schneiden, Angreifer, Diagnose,
  Integrator-Recherche). Deshalb umgesetzt als: gemeinsame Konstante
  `BEFEHLS_SPERRE_SATZ` in allen fünf (Muster PRUEFMAPPE_HINWEIS), reine Funktion
  `auftragMitBefehlsRecht` ersetzt sie bei aktiver Einstellung durch
  `BEFEHLS_ERLAUBNIS_SATZ` — angewandt auf das KATALOG-Teilstück vor der Verkettung,
  damit ein zitierter Sperr-Satz in Übergaben/Kartentexten stehen bleibt; der
  D-01-Nachsatz bleibt Rückfallweg für eigene nur-lesende Blöcke und die
  Katalog-Blöcke mit eigener Formulierung (Audit, Karten-Prüfer, Späher, Frage an den
  Menschen, Übungs-Prüfer), nie beides zugleich. Punkt 1: elf Werkzeuge plus die
  Projekt-Wrapper `gradlew`/`mvnw` (Angriffsfund: in Java-Projekten ist der Wrapper
  der Alltagsfall) in `BEFEHLE_OHNE_RUECKFRAGE`; die Listen bleiben getrennt —
  eine Ableitung ließe jede Erweiterung der kürzeren Leine (FlowForge führt selbst
  aus) still auf die laxere durchschlagen —, stattdessen nagelt eine neue Prüfung die
  Obermengen-Invariante fest. SPEC §7 an beiden Stellen nachgezogen.
- **Messwerte der Bausession (25.08.2026, 1 Angreifer, 2 Bauer mit Vertrag, 2 Prüfer,
  Integrator):** Angriffsliste 20 Funde, davon 3 blockierend (alle vor dem Bauen in
  die Verträge eingearbeitet). Prüfer 1 (Mechanik, 38 Wegwerf-Prüfungen +
  1753 Regressionsprüfungen): bestanden; 5 kleine Befunde, 3 nachgearbeitet
  (auftragMitBefehlsRecht wirft nicht mehr bei fehlendem Auftrag; SPEC-Aufzählung der
  Nachsatz-Blöcke vervollständigt; python3/py/pip3 in der SPEC-Liste ergänzt).
  Bewusst offen: Ein wörtlich in ein Feld ({{wunsch}}/{{fehlerbild}}) geschriebener
  Sperr-Satz würde mit umgeschaltet — rein textlich, die Rechte setzt der Motor durch.
  Prüfer 2 (Ende-zu-Ende, gebaute App, CDP, eigener Datenordner, 3 echte Läufe):
  Einstellung an → beide Aufträge tragen den Erlaubnis-Satz (kein Sperr-Satz, kein
  Nachsatz), der Angreifer belegt seinen Fund per Skriptlauf, `rechteFragen: []`;
  Einstellung aus → Sperr-Satz, null Befehle, nichts geschrieben; `go version`/
  `cargo --version` laufen ohne Rückfrage und scheitern ehrlich mit „nicht gefunden"
  (vorher/nachher an pruefeWerkzeug gemessen: alt Rückfrage, neu erlaubt; Unbekanntes
  fragt in beiden Ständen). Ehrliche Grenzen: Der Nachsatz-Rückfallweg ist mechanisch
  gemessen, nicht Ende-zu-Ende; keines der neuen Werkzeuge ist auf dem Testrechner
  installiert — der volle Beleg „echter Testlauf in einem Go-Projekt" ist Georgs
  Alltagstest.

### 57 — Zusatzbauer für Funde des Angreifers
*(Version **0.58.0**.)*

**Der Befund** (gemessen im Nachstellungs-Lauf vom 23.08.2026, Saatkorn 3): Der
Angreifer meldet, dass `aufgabenRotieren()` eine Entscheidungs-Karte aushebelt — mit
Fundort. Der Bauer kann nicht ran: die Datei liegt außerhalb seiner Dateiliste, ein
Fertig-Kriterium verlangt sogar ausdrücklich, dass dort nichts verändert wird. Der
Prüfer schreibt den Fund ins Feld `offen`, das Sessionende bekommt alles wörtlich in
seinen Auftrag — und legt keine Karte an. Zwei Löcher: Eine Reparatur-Runde zeigt auf
jemanden, der ausgesperrt ist. Und der Fund fällt aus dem Gedächtnis.

**Was FlowForge schon hat:** Sicherungspunkte je Block (Bauschritt 45), die
Wellen-Startregel, `karteAnlegen`/`karteErledigtSetzen` (`projekte.js`), die
Empfänger-Auswahl `empfaengerLage` (`kettenRegeln.js:370-379`) und den ungefilterten
Prüfer-Diff (`lauf.js:190-193`). Es fehlt fast nur die Verdrahtung.

**Was gebaut wird** — Einzelheiten und Begründungen in `entwurf-zusatzbauer-v3.md`:
- **Auslöser:** ein Fund des Angreifers mit Fundstelle und `soll`. Fehlt eines von
  beiden, wird er eine Aufgaben-Karte. Kein Fund wird je abgewiesen.
- **Auslöse-Regel:** Ein Zusatzbauer entsteht nur, wenn die Empfänger der Angriffsliste
  die Fundstelle **nicht ohnehin anfassen dürfen** — vorwärts gerechnet über
  `empfaengerLage`, nicht über `rueckfuehrungsZiel` (das läuft rückwärts und träfe beim
  Angreifer den Paketschneider).
- **Die Karte entsteht sofort**, mechanisch und ohne Agent, und wird abgehakt, sobald
  das `soll` erfüllt ist. Trifft ein Rückroll seine Dateien, wird sie wieder geöffnet.
  Zu jedem Zeitpunkt sagt sie die Wahrheit.
- **Der Zusatzbauer:** keine Dateiliste und keine Schreibsperre — er läuft ohnehin
  allein, und die Sperre trennt nur Reviere. Aber ein **eigener Strang**, damit er einen
  eigenen Punkt bekommt; dafür wird die Strangvergabe von `wirkbereichVon` entkoppelt.
  Fertig-Kriterium ist ausschließlich sein `soll`. Eigene Blockdefinition mit
  Auftragstext. Er steht in `kette` **und** `knoten`, als Eintrag ohne Nummer.
- **Abnahme:** Der Prüfer der Kette urteilt — er läuft ohnehin später, **niemand
  wartet**. Das `soll` geht als benannte Ausnahme neben dem Arbeitspaket an ihn,
  **nie** als Paket-Kriterium. Sein Urteil dazu steht in einem eigenen Listenfeld des
  Prüfbelegs, außerhalb der Urteil/Beanstandungs-Plausibilität — sonst reißt ein
  verfehltes `soll` das ganze Paket in die Reparatur-Runde des Ausgesperrten.
- **Grenz-Kriterien werden nicht umformuliert.** FlowForge reicht dem Prüfer die
  Dateien des Zusatzbauers als benannte Ausnahme mit; die Liste ist **gemessen** (aus
  seinen Punkten), nicht vorhergesagt.
- **Einstellungen:** „Funde außerhalb der Dateilisten" (als Karte *(Standard)* · jetzt
  mitnehmen · nur im Laufbericht nennen) und „Höchstzahl Zusatzbauer je Lauf"
  *(Standard 1)*. Nacharbeits-Runden an der Kette, nicht in den Einstellungen.
- **Ticker und Bericht:** eigene Zeile ohne Blocknummer, die ihn benennt und sagt, aus
  wessen Fund er entstand. Im Bericht je Zusatzbauer: sein `soll` (in Alltagssprache,
  nicht als Feldname), Urteil, Beleg, ob eine Angriffsliste dabei war, die Zahl der
  angefassten Dateien und die Kosten.

**Ehrliche Grenzen — vorher benennen:**
- **Er läuft ohne Schreibsperre.** Entscheidung Georg, 24.08.2026. Kontrolle gibt es
  später statt früher: schmales Fertig-Kriterium, ungefilterter Prüfer-Diff, gemessene
  Dateizahl im Bericht.
- **Der Lauf wird länger**, weil er allein läuft und sich in keine Lücke schiebt.
- **Kein Prüfer in der Kette:** Er arbeitet trotzdem, seine Arbeit steht im Bericht als
  ungeprüft, die Karte wird normal abgehakt. Der Nutzer entscheidet und wird nicht
  bevormundet.
- **Die früh angelegte Karte** steht im Karten-Verzeichnis, das jeder folgende
  Block-Agent bekommt — auch der Prüfer, der über dieselbe Sache urteilen soll. Eine
  kleine Vorwegnahme; bleibt so, wird nur benannt.

**Alltagstest:** Eine Kette „Paket schneiden → Angreifer → Bauer → Prüfer →
Sessionende" auf ein kleines Projekt, mit einer Dateiliste für den Bauer, die eine
Datei ausdrücklich **nicht** enthält, in der ein echter Fehler steckt. Die Einstellung
auf „jetzt mitnehmen". Erwartung: Im Liveticker startet nach dem Angreifer ein
Zusatzbauer mit eigener Zeile; im Projektgedächtnis erscheint sofort eine Aufgaben-Karte
dazu und ist am Ende abgehakt; der Fehler ist behoben; im Laufbericht steht, woran man
das erkennt, wer es geurteilt hat und wie viele Dateien angefasst wurden. Gegenprobe
eins: Dieselbe Kette mit Einstellung „als Karte" — nichts wird gebaut, die Karte bleibt
offen. Gegenprobe zwei: Dieselbe Kette, aber die fehlerhafte Datei **steht** in der
Dateiliste des Bauers — dann darf kein Zusatzbauer entstehen.

### 58 — Der wartende Prüfer: Zusatzbauer auch für Funde des Prüfers
*(Version **0.59.0**.)*

**Der Befund:** 57 deckt nur die Hälfte. Meldet der **Prüfer** einen Fund außerhalb der
Dateilisten, kann sein Zusatzbauer nicht wie in 57 abgenommen werden — der Prüfer ist
der Letzte in der Kette, hinter ihm urteilt niemand mehr. Er müsste über einen Stand
urteilen, den es zum Zeitpunkt seines Urteils noch nicht gibt.

**Was FlowForge schon hat:** Genau dieses Muster läuft bereits — `lokal_recherchieren`
(`helferWerkzeuge.js:188`) ist ein `async`-Handler, der eine lange Operation abwartet,
während der Agent im Werkzeugaufruf hängt und nichts kostet. Der Systemtext nennt das
ausdrücklich den richtigen Weg (`texte.js:1736-1738`): „Eine Unteraufgabe blockiert, bis
sie fertig ist — ihr Ergebnis steht im Ergebnis des Werkzeugaufrufs." Verboten ist die
selbstgebaute Warteschleife, nicht das blockierende Werkzeug.

**Was gebaut wird:**
- **Ein Werkzeug** (Arbeitsname `auf_zusatzbauer_warten`): Der auslösende Prüfer ruft
  es, FlowForge lässt den Zusatzbauer laufen und gibt Umsetzungsbericht **und Diff** als
  Werkzeug-Ergebnis zurück. Danach urteilt der Prüfer über einen fertigen Stand.
- **Ein Wartezustand**, bei dem drei Stellen getrennt antworten, die heute denselben
  Status lesen:
  · `wellenStartRegel` (`lauf.js:414-452`) — darf der Zusatzbauer starten? **ja**, der
  Prüfer schreibt gerade nichts.
  · `schreiberBelegt` (`lauf.js:353-356`) — ist sein Revier geschützt? **ja**, seine
  Prüfmappe gehört ihm weiter.
  · `inWelleVon` (`lauf.js:365-372`) — muss der Zusatzbauer rückfragen? **ja**, nebenan
  lebt ein Agent.
- **Kein Neu-Ansetzen des Strangs.** Ein Strang ist eine Punktelinie, kein eigener
  Arbeitsordner (`sicherungspunkte.js:301-325`) — die geänderten Dateien liegen ohnehin
  vor dem Prüfer, es fehlt nur die Mitteilung, und die kommt im Werkzeug-Ergebnis.
- **Zwei Fehlschlag-Pfade**, beide Pflicht: Das Werkzeug löst auch auf, wenn der
  Zusatzbauer abstürzt oder der Lauf abgebrochen wird — der Prüfer hängt nie. Und ruft
  der Prüfer das Werkzeug gar nicht (ein Auftragssatz hält nicht — Zugsimulator-Befund, 12.08.2026),
  fällt FlowForge auf eine **Nachprüfungs-Runde** zurück: Der Zusatzbauer läuft danach,
  der Prüfer wird neu gerufen.

**Ehrliche Grenzen — vorher benennen:**
- Solange der Prüfer im Werkzeug hängt, bleibt der Haupt-Motor belegt
  (`lauf.js:3444-3448`, Freigabe erst im `finally`). Der Zusatzbauer bekommt deshalb
  eine **eigene Session** — der normale, im Ticker vermerkte Weg für parallel geführte
  Blöcke. Das ist gewollt und gehört so in den Bericht, nicht als Panne.
- Nachgerechnet und **kein** Problem: Die Übertrags-Schwelle wird nicht befragt, solange
  eine Session lebt (`laufMotorBesorgen` steigt vorher aus), und eine Session, die in
  einem Werkzeugaufruf hängt, erzeugt keine Tokens — es gibt nichts falsch
  Zuzurechnendes.
- Ein lokaler Prüfer mit Abnahme im Schaubild: Die Abnahme bekommt das `soll` ebenfalls.

**Alltagstest:** Dieselbe Kette wie in 57, aber der Fehler steckt in einer Datei, die
erst der **Prüfer** findet — also einer, die weder Angreifer noch Bauer genannt haben.
Erwartung: Der Prüfer meldet den Fund, im Ticker startet ein Zusatzbauer, danach urteilt
**derselbe** Prüfer über das Ergebnis, und im Laufbericht stehen sein Urteil und sein
Beleg zum `soll` getrennt vom Urteil über sein Paket. Gegenprobe: Denselben Lauf mitten
im Zusatzbauer hart stoppen — der Prüfer darf nicht hängenbleiben, und die Karte muss
offen sein.

