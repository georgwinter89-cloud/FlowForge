# FlowForge — Zweit-Audit: Befundliste

Erstellt am 14.08.2026 nach der Prozedur in [ZWEITAUDIT.md](ZWEITAUDIT.md). Stand des
Projekts: Bauschritt 26 (package.json 0.26.0). Zwei parallele, rein lesende Auditoren
(Doku-Widersprüche · Code-Nähte/Sicherheit); jeder Befund von der Hauptsession selbst
nachgemessen (Repro, Grep oder Codelesung). Dazu echte Motor-Läufe im Wegwerf-
Übungsprojekt (Georgs Freigabe am 14.08.2026 eingeholt). Behoben wird NICHTS in dieser
Session — das ist Sache eigener Bausessions, die Georg einzeln anstößt. Jede solche
Session streicht ihre erledigten Befunde hier heraus; die leere Liste wird gelöscht.

**Behebungs-Regel (aus der Prozedur):** Doku-Befunde an ALLEN Fundstellen beheben (nach
der veralteten Zahl/Phrase greppen, nicht nur die gemeldete Stelle). Jeder Code-Befund
bekommt in seiner Bausession eine Prüfung, die ohne den Fix nachweislich fehlschlägt.

---

## Befunde nach Schwere

### KRITISCH

**[C-01] · Befehls-Zerlegung übersieht `&`, `$(…)`, Backticks, `<(…)` — Ausführungs-Sperre umgehbar**
`src/main/motor/claudeCodeMotor.js:141` (`befehlsNamen`, Trenner-Regex `&&|\|\||[;|\n]`),
Wirkung an `:319` (nur-lesen-Pfad) und `:353` (Bauer-Pfad).
Die Zerlegung trennt nur an `&&`, `||`, `;`, `|`, Zeilenumbruch. Das **einzelne `&`**
fehlt, und Kommando-Substitutionen in Argumenten (`$(…)`, Backticks, `<(…)`) werden nie
als eigenes Teilstück erkannt — eingestuft wird jeweils nur das erste, harmlose Wort.
Nachgemessen (verbatim-Repro der Funktionen `befehlsNamen`/`befehlNurLesend`/
`befehlOhneRueckfrage`):

| Befehl | erkannte Namen | nurLesend | ohneRückfrage |
|---|---|---|---|
| `dir & del wichtig.js` | `["dir"]` | true | true |
| `cat $(rm -rf x)` | `["cat"]` | true | true |
| `` cat `rm -rf x` `` | `["cat"]` | true | true |
| `cat <(rm -rf x)` | `["cat"]` | true | true |
| `dir && del wichtig.js` (Gegenprobe) | `["dir","del"]` | false | false |

`nurLesend=true` heißt: `pruefeWerkzeug` gibt unter der Sperre „darf nur lesen" (`:319`)
**erlaubt** zurück. Damit kann ein nur-lesender Block (Angreifer, Diagnose, Audit,
Karten-Prüfer, Gesamtprüfung) beliebige verändernde Befehle ausführen (`del`, `rm`,
`remove-item`, `curl … | sh`), **ohne dass die 14.08.-Einstellung „Nur-lesende Blöcke
dürfen Befehle ausführen" überhaupt an ist.** `ohneRückfrage=true` heißt zusätzlich: der
Trick umgeht bei jedem Block die Rückfrage für Unumkehrbares/Internet.
**Verschärfung (selbst nachgemessen):** Unter „darf nur lesen" greift der Schnellpfad in
`:319` (`if (befehlNurLesend(...)) return erlaubt`) **vor** der Git-Sperre in `:345` und
der Prüfmappen-Sperre in `:351`. Für nur-lesende Blöcke hält deshalb auch die Git-Sperre
den Trick nicht auf: `cat $(git push …)` wird als rein lesend durchgewinkt. (Im
Bauer-Pfad, `nurLesen=false`, fängt die Ganzstring-Git-Regex `:345` solche Fälle dagegen
noch ab — dort ist der Ausbruch auf Nicht-Git-Schaden begrenzt.)
**Kleinster Korrekturvorschlag:** In der Trenner-Regex `&(?!&)` ergänzen und vor der
Einstufung jedes Teilstücks prüfen, ob es `$(`, `` ` `` oder `<(` enthält — wenn ja, das
Teilstück als unbekannt behandeln (Rückfrage bzw. unter „nur lesen" hartes Nein), analog
zur schon vorhandenen `$(…)`/Backtick-Ausnahme bei cd/Zuweisung (`:155`, `:163`).
**Rot-vor-Grün für die Bausession:** Ein Test, der `pruefeWerkzeug('Bash',
{command:'dir & del x'}, …, /*nurLesen*/true, …)` aufruft und `erlaubt` erwartet zu
**scheitern** (Soll: gesperrt) — er ist heute grün und muss nach dem Fix rot→grün kippen.

### HOCH

**[D-01] · Nur-lesende Blockaufträge verbieten Befehle kategorisch — die 14.08.-Einstellung läuft für sie ins Leere**
`src/shared/blockKatalog.js:57, 152, 195, 237, 439, 485` gegen `SPEC.md §7 (Z. 620–628)`.
SPEC verspricht: Ist die Einstellung „Nur-lesende Blöcke dürfen Befehle ausführen (auf
eigene Gefahr)" an, „können [Angreifer und Diagnose] so z.B. Prüfskripte laufen lassen,
um ihre Funde zu belegen". Die Arbeitsaufträge genau dieser Blöcke sagen aber kategorisch:
„Programme oder Tests auszuführen ist für diesen Block gesperrt — **versuche es gar nicht
erst**" (Kontext laden, Paket schneiden, Angreifer, Diagnose; Audit: „nichts ausführen").
Nachgemessen: `nurLesenBefehle` wird in `lauf.js` nur am Ticker (`:749`) und in der
Durchsetzung (`:920`) genutzt, **nie** beim Bau des Auftragstexts — kein Code lockert den
Auftrag, wenn die Einstellung an ist. Wirkung: Die harte Sperre fällt zwar weg, aber der
Agent versucht es auftragsgemäß gar nicht erst; das Feature ist für alle Katalog-Blöcke
wirkungslos.
**Kleinster Korrekturvorschlag:** Bei aktiver Einstellung einen Auftrags-Zusatz einsetzen
(dasselbe Muster wie `bauenAuftragZusatz`, texte.js), z.B. „Zusatz von FlowForge: Du
darfst in diesem Lauf Befehle ausführen (normale Einstufung, Git/Prüfmappe bleiben tabu)."

### MITTEL

**[C-02] · Ausgabe-Umleitung schreibt ohne Rückfrage außerhalb des Projektordners**
`claudeCodeMotor.js:341–354` (Bash-Pfad) gegen `:328–339` (Schreib-Werkzeuge mit
`liegtImProjekt`-Grenze). Die Projekt-Grenze („außerhalb → Rückfrage", SPEC §7) wird nur
an `Write`/`Edit` erzwungen. Bei Befehlen bleibt das Umleitungsziel ungeprüft:
`echo geheim > ../../ausserhalb.txt` → erstes Wort `echo` (Lese-Befehl) →
`befehlOhneRueckfrage=true` → erlaubt ohne Rückfrage. `>` wird nur gegen die Prüfmappe und
für „rein lesend" ausgewertet, nicht gegen die Projektgrenze. Teilweise systemimmanent
(erlaubte `node`/`python`-Läufe dürfen ohnehin überallhin schreiben) — daher MITTEL.
**Kleinster Korrekturvorschlag:** Enthält ein sonst rückfragefreier Befehl eine
Datei-Umleitung (`>`/`>>` auf ein echtes Ziel), dieselbe `liegtImProjekt`-Prüfung auf das
Umleitungsziel anwenden bzw. Rückfrage auslösen.

**[D-02] · SPEC-Garantien „nur-lesende Blöcke ändern nichts" nicht für die 14.08.-Einstellung relativiert**
`SPEC.md §3.3 (Z. 94–96)` und `§4.1 (Z. 119–121)` gegen `§7 (Z. 620–628)`.
Zwei unrelativierte Garantie-Sätze: „Nur-lesende Blöcke ändern nichts und erzeugen deshalb
keinen Punkt" (§3.3) und „Gleichzeitig laufen dürfen mehrere lesende Blöcke, aber höchstens
ein schreibender" (§4.1). §7 räumt seit 14.08. selbst ein: „ein ausgeführtes Skript kann
aber Dateien verändern". Nachgemessen im Code: Der Planer startet nur-lesende Blöcke
unabhängig von der Einstellung parallel neben einem Schreiber (`lauf.js:1314–1316`), und
nach ihnen entsteht kein Sicherungspunkt (`lauf.js:1648`). Bei aktiver Einstellung kann
also ein „nur-lesender" Block parallel zum Bauer Dateien verändern, ohne Sicherungspunkt —
und friert damit potenziell die halbfertigen Änderungen des Schreibers ein oder verliert
die eigenen.
**Kleinster Korrekturvorschlag:** In §3.3 und §4.1 je einen Halbsatz ergänzen („gilt
nicht, wenn die Einstellung ‚Nur-lesende Blöcke dürfen Befehle ausführen' an ist") — oder,
konsequenter, bei aktiver Einstellung nur-lesende Blöcke im Planer und bei den
Sicherungspunkten wie schreibende behandeln.

**[D-03] · SPEC verspricht „Laufbericht zählt Karten-Vorschläge" — die Zählung wird gespeichert, aber nie angezeigt**
`SPEC.md §4.3 (Z. 258–259)` und `BAUPLAN 26 (Z. 553–554)` gegen `Leinwand.jsx` (Laufbericht-
Ansicht). Zusage: „Ticker und Laufbericht zählen übernommen/bearbeitet/abgelehnt."
Nachgemessen: Der Laufbericht-Datensatz enthält `kartenVorschlaege` mit
`uebernommen`/`abgelehnt` (im echten Karten-Prüfer-Lauf verifiziert:
`laufberichte/…json` trägt die Zählung), aber die Laufbericht-Ansicht rendert sie
nirgends — `grep kartenVorschlaege src/renderer` liefert null Treffer, und `texte.laufberichte`
hat keinen Beschriftungs-Eintrag dafür. Georg sieht die Zählung nur indirekt über
einzelne Ticker-Zeilen im Verlauf.
**Kleinster Korrekturvorschlag:** Eine Anzeige-Zeile in der Laufbericht-Ansicht plus
texte-Eintrag (z.B. `laufberichte.kartenVorschlaegeZeile`).

**[D-04] · Block-Editor-Hinweis „keine Befehle" beschreibt den Stand vor dem 12.08.**
`src/shared/texte.js:102` gegen `SPEC.md §7 (Z. 615–619)`. Der Sperren-Hinweis im
Block-Editor: „Der Block darf dann nichts verändern: kein Schreiben, keine Befehle, kein
Internet — nur lesen." SPEC seit 12.08.: „Rein lesende Befehle laufen auch unter der Sperre
durch"; Code entsprechend (`claudeCodeMotor.js:318–323`). Genau die Irreführung, die am
12.08. an der Abweisungs-Meldung schon korrigiert wurde.
**Kleinster Korrekturvorschlag:** „keine Befehle" → „keine verändernden Befehle (rein
lesende laufen durch)".

### KLEIN

**[C-03] · Bash-Umgebungspräfix `VAR=wert cmd` löst unnötige Rückfrage aus**
`claudeCodeMotor.js:162` (Zuweisungs-Ausnahme nur für PowerShell-`$var=`).
`NODE_ENV=test npm test` → erstes Wort `node_env=test` (unbekannt) → Rückfrage, obwohl der
eigentliche Befehl `npm` bekannt ist. Kein Sicherheitsproblem (fragt), nur Reibung —
Gegenstück zu den seit 14.08. bewusst weggeräumten cd-/Zuweisungs-Rückfragen.
**Kleinster Korrekturvorschlag:** Führende `WORT=wert`-Präfixe (ohne `$(`/Backtick) analog
zur PowerShell-Zuweisung überspringen und den Rest einstufen.

**[C-04] · `fazitStutzen` kann ein legitimes Fazit auf leer stutzen**
`claudeCodeMotor.js:680–685`. Beginnt der Agenten-Text zufällig mit `agentId:`, ist
`marke = 0` → `slice(0,0)` → leeres Fazit → Block gilt als „ohne Fazit". Sehr
unwahrscheinlich, aber ein stiller Fehlausgang.
**Kleinster Korrekturvorschlag:** Nur stutzen, wenn die `agentId:`-Marke am Zeilenanfang
nach vorhandenem Text steht (`marke > 0`), sonst den Text unverändert lassen.

**[D-05] · Gesamtprüfung fehlt in der Arbeitsblock-Aufzählung**
`SPEC.md §4.3 (Z. 151–155)` gegen `§4.3 (Z. 217–221)` und `blockKatalog.js:377`. Die
Aufzählung „Kontext laden · Spec-Interview · … · Sessionende" lässt die Gesamtprüfung aus,
obwohl derselbe Abschnitt sie wenige Absätze später als eigenen Block beschreibt und sie im
Katalog als Arbeitsblock (nicht Übung) liegt.
**Kleinster Korrekturvorschlag:** „Gesamtprüfung" in die Aufzählung aufnehmen.

**[D-06] · Audit-Garantie „nur-lesend für Befehle" ohne Querverweis auf die 14.08.-Einstellung**
`SPEC.md §4.3 (Z. 237–239)` und `blockKatalog.js:438–439` gegen `§7` /
`claudeCodeMotor.js:318`. „Das Audit ist nur-lesend für Dateien und Befehle" bzw. im
Auftrag „nichts ausführen". Die 14.08.-Einstellung gilt aber für alle nur-lesenden Blöcke —
`pruefeWerkzeug` macht keine Audit-Ausnahme. Garantie und Einstellung am selben Tag
geschrieben, ohne Querverweis. (Verwandt mit C-01/D-01 — dieselbe Naht.)
**Kleinster Korrekturvorschlag:** Halbsatz in §4.3 („Befehls-Ausführung nur, falls die
§7-Einstellung an ist") — oder das Audit im Code von der Einstellung ausnehmen, wenn die
Garantie absolut gemeint ist.

**[D-07] · Drei verwaiste texte.js-Einträge**
`texte.js:3` (`appName`), `:75` (`blockEditor.schrittAnzeige`), `:836`
(`lauf.tickerUeberschrift`). Automatisierte Prüfung aller Blattnamen gegen `src/`: nirgends
aufgerufen (Fenstertitel kommt aus `fensterTitel`; der Stepper zeigt Schritt-Titel;
„Liveticker" wird nirgends gerendert).
**Kleinster Korrekturvorschlag:** Die drei Einträge löschen (oder bewusst verwenden).

**[D-08] · Irreführende Ablehnungsmeldung beim Lösch-Vorschlag zur Status-Karte**
`src/main/motor/vorschlagWerkzeuge.js:85` (Zweig `art === 'loeschen'`) mit Fehlertext
`entscheidungTabu` (`texte.js`). Ein Lösch-Vorschlag zur Status-Karte wird korrekt
abgewiesen, aber mit „Entscheidungs-Karten sind Festlegungen des Nutzers …" — für eine
Status-Karte sachlich falsch begründet.
**Kleinster Korrekturvorschlag:** Eigener Fehlertext „Die Status-Karte ist nur
aktualisierbar" für diesen Zweig.

**[D-09] · BAUPLAN-Kopf trägt veraltetes Datum**
`BAUPLAN.md:3` — „Stand: 07.08.2026", obwohl die Schritte 16–26 laut git bis 14.08.2026
ergänzt wurden.
**Kleinster Korrekturvorschlag:** Kopf wie in SPEC formulieren („Ursprung: 07.08.2026,
fortlaufend gepflegt") oder Datum nachziehen.

**[D-10] · Agenten-Meldung listet die erlaubten Lese-Befehle scheinbar abschließend**
`texte.js:917` (`nurLesenBefehlFuerAgent`) gegen `claudeCodeMotor.js:116–120`
(`LESE_BEFEHLE`). Die Meldung zählt „dir, ls, type, cat, findstr, grep, where, echo, pwd,
head, tail, wc" auf; der Code erlaubt zusätzlich `printf, tr, sort, uniq, cut` und die
PowerShell-Cmdlets (`get-childitem, get-content, select-string, …`). Ein Agent, der der
Liste glaubt, nutzt erlaubte Befehle nicht.
**Kleinster Korrekturvorschlag:** „z.B." vor die Liste setzen oder Liste an `LESE_BEFEHLE`
angleichen.

---

## Entwarnungen (geprüft, NICHT bestätigt — ersparen der nächsten Session dieselben Verdachte)

- **Sperren-Durchreichung (schlimmster stiller Fehler):** `pruefeWerkzeug` wird an beiden
  Aufrufstellen mit identischer Argumentreihenfolge aufgerufen — PreToolUse-Hook
  (`claudeCodeMotor.js:731–741`) und `canUseTool` (`:866–876`); alle sechs Flaggen
  (nurLesen, darfPruefen, lokaleKi, nurLesenBefehle, darfKartenAnlegen, darfVorschlagen)
  kommen an beiden korrekt an. Selbst nachgelesen und bestätigt.
- **darfKartenAnlegen (Audit):** Unter „nur lesen" ist ausschließlich `karte_anlegen`
  frei (`:304–311`) — `karte_aktualisieren`/`karte_erledigen` bleiben gesperrt.
- **darfVorschlagen (Karten-Prüfer):** `mcp__vorschlaege__*` ohne die Flagge hart gesperrt
  (`:272–276`); Leitplanken am Werkzeug UND beim Anwenden doppelt durchgesetzt
  (Entscheidungs-/Prüfkarten tabu, Status nur aktualisierbar mit festem Titel, neue Karten
  immer `aufgabe`, Längengrenzen in `vorschlagWerkzeuge.js` und erneut in
  `projekte.js`). Im Live-Lauf bestätigt (s.u.).
- **Getarnte lokale Werkzeugaufrufe:** Übersetzte Aufrufe laufen durch dasselbe
  `werkzeugAusfuehren` und damit dieselben harten Sperren wie echte (`lokaleHelfer.js`).
- **Lokale-Helfer-Pfadgrenzen:** `imProjekt` fängt `..` und absolute Pfade ab (case-
  insensitiv); `schreibTabu` deckt Prüfmappe/Verwaltungsdateien/`.git`/`laufberichte` ab;
  Entwürfe hart auf `arbeitsablage/`.
- **Lokale Vorreparatur/Rückrollen:** Sicherungspunkt vor jedem Versuch, „nichts ersetzt"
  zählt als verbraucht ohne Nachprüfung, gescheiterte Nachprüfung rollt zurück, bevor der
  Motor-Bauer übernimmt.
- **UI-Nähte:** Alle `lauf-ereignis`-Arten in `Leinwand.jsx` behandelt (`denken`
  inklusive); kein `roh`-Rest im Renderer; offene Dialoge (Frage, Entscheidung, Gespräch,
  Mensch-Frage, Karten-Vorschlag) werden nach Ansichtswechsel über `laufZustand`
  wiederhergestellt und am Laufende/harten Stopp aufgelöst.
- **Harte Grenzen SPEC ↔ Code:** Alle deckungsgleich — Karten 80/400, Übergabe 8.000,
  Übertrag 85 %, Fortsetzungs-Wächter 75 %, Reparatur-Runden 2, Übertragsgrenze 5, lokale
  Reparatur-Versuche 2, max. 3 parallele Läufe, Block-Editor 40/200/4.000/5×40.
- **Bauschritt-Verweise, §-Verweise, Versionskopplung:** Alle „Bauschritt N"-Angaben in
  SPEC/Code haben einen echten Commit; alle §-Verweise zeigen auf existierende Abschnitte;
  package.json 0.26.0 = Bauschritt 26; genau eine CLAUDE.md; keine Prosa-Chronik-Dateien;
  keine halb ersetzten Pfadvarianten.
- **Zielbild-Abdeckung:** Jede SPEC-Zusage ließ sich einem gebauten Bauschritt, einer
  belegten Zwischen-Session oder einem §10-Nicht-Ziel zuordnen — nichts hängt
  zuordnungslos.

---

## Gefahrene Läufe & Proben (Wegwerf-Übungsprojekt, echte Motor-Läufe)

Projekt „Audit-Übung" (im Scratch-Bereich, nach dem Audit aus der Projektliste entfernt).
Motor im Abo-Modus, Steuerung per CDP-Fernsteuerung (`--remote-debugging-port`). Georgs
Einstellungen (Automodus, lokale KI) NICHT verändert.

1. **Faire Übungs-Kette glatt durch** (Späher → Mini-Bauer → Übungs-Prüfer fair): lief
   sauber; jeder Block als frischer Agent in EINER Lauf-Session (Bauschritt 19 bestätigt);
   `gruss.txt` angelegt; Prüfung bestanden; FlowForge legte automatisch eine Prüfkarte an
   (Bauschritt 18 bestätigt).
2. **Rechte-Probe (Rückfrage abgelehnt):** Der Schreibversuch außerhalb des Projektordners
   löste die Rechte-Rückfrage aus; nach Ablehnung wurde die Datei NICHT angelegt
   (`Test-Path` = false). SPEC §7 live bestätigt.
3. **Karten-Probe (Längengrenze):** Der Versuch, eine 758-Zeichen-Karte anzulegen, wurde
   mit der korrekten Ist-Längen-Meldung („758 von höchstens 400 Zeichen") abgelehnt; die
   gültige Karte entstand; Sicherungspunkt danach gesetzt.
4. **Strenger Prüfer bis Folgen-Frage** (Mini-Bauer → Übungs-Prüfer streng, 1 Runde): 1
   Reparatur-Runde lief, danach kam die Folgen-Frage; mit „zurückstellen" beantwortet. Am
   Rande live bestätigt: Der Bauer wollte per `Add-Content` in eine Projektdatei schreiben
   und bekam korrekt eine Rückfrage (Shell-Schreibbefehle sind nicht auto-erlaubt, nur die
   Write/Edit-Werkzeuge).
5. **Harter Stopp mit Rückrollen:** Mini-Bauer beim Schreiben an `gruss.txt` hart
   abgebrochen → „Projektordner auf den letzten Sicherungspunkt zurückgesetzt"; MD5-Hash
   von `gruss.txt` identisch zum Stand vor dem Lauf — die mittendrin geschriebene Änderung
   wurde zurückgerollt.
6. **Karten-Prüfer (Bauschritt 26, jüngste Naht):** Falsche Wissens-Karte („in Rust
   geschrieben, nutzt PostgreSQL") angelegt; der Karten-Prüfer maß am Code nach (grep nach
   `*.rs`, `Cargo.toml`, `*.sql` — null Treffer) und schlug fundiert das Löschen vor. Der
   Vorschlags-Dialog erschien korrekt; „Übernehmen" löschte die Karte. Weitere Vorschläge
   (Status aktualisieren — Titel blieb fix „Status"; Aufgabe abhaken) mit „Ablehnen" und
   „Übernehmen" durchgespielt. Vorschlags-Arten löschen/aktualisieren/erledigen live
   gesehen; Laufbericht speichert die Zählung (siehe D-03).

**Abweichungen von der Prozedur (ehrlich vermerkt, nicht in der Stille):**
- **C-01 wurde am Einheiten-Niveau bewiesen** (verbatim-Repro der Zerlegungs-Funktionen),
  nicht per Live-Lauf — ein Live-Beweis bräuchte einen eigens gebauten bösartigen Block;
  der Funktions-Repro ist eindeutig.
- **Der Audit-Block (Bauschritt 25) wurde NICHT live gefahren.** Er ist per Entwurf „bewusst
  teuer" (ein Lauf kann mehrere hunderttausend Tokens kosten, SPEC §4.3); der Kontingent-
  Aufwand stand außer Verhältnis zum Prüfgewinn. Seine Mechanik (nur-lesend +
  `darfKartenAnlegen`, genau `karte_anlegen` frei) ist am Code bestätigt (Entwarnungen
  oben). Alltagstest steht damit noch aus.
- **Die Gesamtprüfung** (eigener Prüf-Block) wurde nicht separat gefahren.
- Die lokale Helfer-KI war (Georgs Standard) global aus — die lokalen Kreisläufe
  (Vorreparatur, Entwürfe, lokaler Bauer) liefen deshalb nicht live; sie sind nur am Code
  geprüft.

---

## Empfehlung für die erste Behebungs-Session

**C-01 zuerst** — der einzige kritische Fund: ein stiller Vollzugriff auf die
Befehlsausführung selbst unter „darf nur lesen", weil die Zerlegung `&`/`$(…)`/Backtick/
`<(…)` nicht als Trenner kennt. Klein zu beheben (Trenner-Regex + Teilstück-Prüfung),
groß in der Wirkung, mit klarem Rot-vor-Grün-Test.

**Danach die 14.08.-Naht als Ganzes** (D-01 HOCH, dazu D-02/D-04/D-06): Die Einstellung
„Nur-lesende Blöcke dürfen Befehle ausführen" hat mehrere Kanten offen gelassen — die
Blockaufträge verbieten Befehle weiter kategorisch (Feature wirkungslos), und zwei
SPEC-Garantien sind nicht nachgezogen. Eine Session, die C-01 und diese Naht zusammen
aufräumt, schließt das ganze Thema.

Die übrigen KLEIN-Befunde (C-03, C-04, D-05, D-07, D-08, D-09, D-10) sind reine
Aufräumarbeiten und passen gebündelt in eine spätere Politur-Session.
