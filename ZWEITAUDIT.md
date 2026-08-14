# FlowForge — Zweit-Audit (Prozedur)

Wiederholbares Vorgehen für einen gründlichen Rundum-Blick über das GANZE Projekt
durch eine eigene Session — angepasst aus der Life-OS-Audit-Prozedur (Georg,
14.08.2026). Es prüft, was Bausessions selbst nie prüfen: Nähte zwischen
Bauschritten, Widersprüche zwischen SPEC/BAUPLAN/Code/Texten und Randfälle, die
„vertragskonform, aber falsch" sind. Start auf Zuruf: **„Führe das Zweit-Audit aus."**

**Drei Festlegungen (Georg, 14.08.2026):**
1. **Nur Befundliste.** Die Audit-Session behebt NICHTS — kein Fix, keine
   Versionsänderung, kein Installer-Build. Einzige Schreibaktion ist die
   Befundliste `ZWEITAUDIT-BEFUNDE.md` (plus deren Commit). Behoben wird danach
   in eigenen Bausessions, die Georg einzeln anstößt; jede streicht ihre
   erledigten Befunde aus der Liste, die leere Liste wird gelöscht.
2. **Mit echten Motor-Läufen.** Der Code-Auditor darf echte Workflow-Läufe
   fahren (kostet Abo-Kontingent — Georg vorher Bescheid geben und Freigabe
   abwarten). Nur in einem eigens angelegten **Wegwerf-Übungsprojekt** — nie im
   Zugsimulator oder anderen echten Projekten, und Georgs Einstellungen
   (Automodus, lokale KI …) werden nie verstellt.
3. **Auditoren reparieren nie.** Sie finden, belegen, schlagen die kleinste
   Korrektur vor — mehr nicht.

**Faustregel (Life-OS-Lehre):** Die Risse liegen fast nie im neuesten
Bauschritt, sondern an den Nähten zu Bestand, der auf altem Stand stehen
geblieben ist.

## Vorbereitung (Hauptsession, Pflicht vor jedem Auditor-Start)

1. Sessionstart wie üblich: SPEC.md, BAUPLAN.md, `git log --oneline` lesen.
2. **Umgebung messen statt annehmen** — fehlt etwas, ist das eine Meldung an
   Georg, kein stiller Ausweichpfad: `npm run build` und `npm test` (die
   Regel-Prüfungen in `pruefungen/`, seit der Zweitaudit-Behebung 14.08.2026)
   laufen am unveränderten Stand durch; Electron-Prüfskripte laufen
   (`npx electron <skript>` im Scratch-Ordner); für Motor-Läufe: App aus `out/` startbar mit
   `--remote-debugging-port` (CDP-Fernsteuerung ist der Testweg, keine
   Desktop-Steuerung), Motor im Abo-Modus angemeldet.
3. **Verdachtsliste schreiben** — Verdacht schlägt Checkliste, ohne
   Verdachtsliste startet kein Auditor: aus `git log` die Nähte der letzten
   Bauschritte ableiten (wo wurde geschnitten, was war heikel, welche Naht ist
   neu) und mit den Standardverdachten unten zusammenführen.
4. **Mechanische Vorproben** selbst laufen lassen (FlowForge hat kein
   Prüfskript dafür — diese Greps ersetzen es; die Auditoren fangen an, wo die
   Greps enden):
   - `package.json`-Version = jüngster „Bauschritt N"-Commit (0.N.x)?
   - Alle „seit Bauschritt N"-/„BAUPLAN N"-Angaben in SPEC.md und im Code
     gegen `git log` (gibt es Commit „Bauschritt N: …" wirklich?).
   - Alle §-Verweise in SPEC.md und BAUPLAN.md zeigen auf existierende
     Abschnitte.
   - Genau eine CLAUDE.md im Repo; keine Prosa-Chronik-Dateien entstanden
     (CLAUDE.md-Doku-Regel).
   - Grep auf verdoppelte Pfadsegmente und halb ersetzte Varianten, falls
     zuletzt Massen-Ersetzungen liefen.

## Zwei Auditoren, parallel, beide nur lesend

Beide laufen als Unteraufgaben der Audit-Session, bekommen die Verdachtsliste
ins Briefing und liefern Befunde samt Entwarnungen zurück.
**Unteraufgaben-Befunde sind Berichte, keine Messungen:** Die Hauptsession
greppt/liest jeden Befund selbst nach, bevor er in die Liste kommt — und prüft
bei parallelen Werkzeug-Aufrufen jedes Einzelergebnis (ein übersehener
Tool-Fehler war im Life OS der schwerste Doku-Befund).

### Auditor 1 — Doku-Widersprüche

Liest SPEC.md, BAUPLAN.md, CLAUDE.md, `src/shared/blockKatalog.js` (die
Arbeitsaufträge sind die Verträge der Blöcke) und `src/shared/texte.js`
(Oberflächen- und Agenten-Texte). Sucht systematisch:

1. Fakten-Widersprüche SPEC ↔ BAUPLAN ↔ Code: Blocklisten und Vorlagen-Ketten,
   Werkzeugnamen, harte Grenzen (Kartenlängen, Übergabe-Kürzung,
   Übertrags-Schwelle, Versuchs-Budgets, Parallel-Grenzen), Standardwerte.
2. Widersprüche INNERHALB der SPEC: Garantie-Sätze („hartes Nein", „nur
   Prüf-Blöcke", „wird immer geleert", „nie ohne Rückfrage") gegen später
   ergänzte Features — je Garantie-Satz einmal gegenlesen.
3. Blockaufträge gegen SPEC: Verspricht ein Auftrag Werkzeuge oder Regeln, die
   es nicht (mehr) gibt? Fehlt einem Auftrag eine Regel, die die SPEC diesem
   Block zuschreibt? Passen braucht/liefert-Etiketten zu den Übergaben?
4. Texte gegen Verhalten: behaupten Ticker-/Dialog-Texte etwas, das der Code
   nicht (mehr) tut? Gibt es texte.js-Einträge, die nirgends mehr aufgerufen
   werden, oder Aufrufe auf fehlende Einträge?
5. Veraltete Handlungsanweisungen: BAUPLAN-Schritte, die als offen wirken, aber
   gebaut sind (oder umgekehrt); „bewusst NICHT in V1" (SPEC §10) noch stimmig;
   CLAUDE.md-Regeln, die zur heutigen Arbeitsweise passen.
6. Zielbild-Abdeckung: Jede SPEC-Zusage ist einem gebauten Bauschritt, einem
   offenen BAUPLAN-Schritt oder einem bewussten Nicht-Ziel zuzuordnen — nichts
   hängt zuordnungslos.

### Auditor 2 — Code-Nähte, Randfälle, Sicherheit

Arbeitet mit Verdachtsliste statt Checkliste; der wertvollste Fund ist
„vertragskonform, aber falsch". Jeder Verdacht braucht eine Mini-Repro oder
einen Beleg (Datei + Zeile) — sonst ist er Verdacht, kein Befund.

**Standardverdachte (Stand 14.08.2026 — je Audit um frische Nähte ergänzen):**

- **Sperren-Durchreichung:** `pruefeWerkzeug` (claudeCodeMotor.js) hat viele
  Positionsparameter und ZWEI Aufrufstellen (PreToolUse-Hook und canUseTool) —
  kommt jede Flagge (nurLesen, darfPruefen, lokaleKi, nurLesenBefehle,
  darfKartenAnlegen, darfVorschlagen) an beiden an, in der richtigen
  Reihenfolge? Ein Bauer mit Prüfer- oder Vorschlags-Rechten wäre der
  schlimmste stille Fehler.
- **Befehls-Einstufung** (Regex-Faustregeln in claudeCodeMotor.js):
  Umgehungswege für Git-Sperre, Prüfmappen-Schutz und nur-lesen — Verkettungen,
  `$(…)`-Unterausführungen, Backticks, PowerShell-Zuweisungen, Umleitungen,
  Groß/Klein, Pfad-Schreibweisen.
- **Pfad-Prüfungen:** `liegtImProjekt`/`istVerwaltungsdatei`/`liegtInPruefmappe`
  (claudeCodeMotor.js) und `imProjekt`/`schreibTabu` (lokaleHelfer.js) —
  Traversal, absolute Pfade, Groß/Klein, Tabu-Zonen, die arbeitsablage-Grenze
  der Entwürfe. Fix-Generalisierung als Standard-Verdacht: dieselbe Prüfung
  lebt an mehreren Stellen — sind alle auf demselben Stand?
- **Zustandsmaschinen in lauf.js:** Fehlschlag-Rückführung im Verzweigten,
  lokale Vorreparatur (wird vor der Eskalation wirklich zurückgerollt?),
  Übertrag (uebertragPhase-Übergänge, Wettlauf „Block fertig bei Schwelle"),
  Wiederaufnahme (passt das Laufstand-Format noch zu allen neuen Feldern?),
  Warteschlange und 3er-Grenze, Auflösung ALLER offenen Dialoge am Laufende
  und beim harten Stopp (hängt ein Promise?).
- **Naht Motor ↔ Lauf:** Fazit-Erkennung über blockTaskIds und fazitStutzen,
  Verbrauchs-Deltas (kostenStand/aufschlStand) über Session-Wechsel und
  Überträge, Kontextfenster-Lernen, Ereignis-Zuordnung bei parallelen Zweigen.
- **Lokale Helfer-KI:** Tabu-Durchsetzung in JEDEM Kreislauf — auch für
  getarnte (als Text gelieferte) Werkzeugaufrufe; Einweg-Regel (keine
  Rückfragen); Projektwissen-Voranstellung: kann ein bösartiger oder
  unglücklicher Karteninhalt den lokalen Auftrag umdeuten?
- **UI-Naht:** Wird jede `lauf-ereignis`-Art in Leinwand.jsx behandelt? Stellt
  laufZustand nach Ansichtswechsel alle offenen Dialoge wieder her (Frage,
  Entscheidung, Gespräch, Karten-Vorschlag)? Was passiert offenen Dialogen bei
  App-Neustart mitten im Lauf?

**Pflicht-Praxisteil (nach Georgs Freigabe wegen Kontingent):** Im
Wegwerf-Übungsprojekt echte Läufe über die gebaute App per CDP-Fernsteuerung —
mindestens: eine Übungs-Kette glatt durch (Späher → Mini-Bauer → fairer
Übungs-Prüfer), einmal strenger Übungs-Prüfer bis zur Folgen-Frage, eine
Rechte-Probe (Rückfrage ablehnen), eine Karten-Probe (Längengrenze), ein harter
Stopp mit Rückrollen — und die Alltagstests der Bauschritte, die noch nie im
Alltag liefen. Dialoge (Gespräch, Rechte-Frage, Karten-Vorschlag) bedient die
Session selbst über die Fernsteuerung; jede Abweichung von der Prozedur steht
im Protokoll, nicht in der Stille.

## Befund-Format (beide Auditoren)

`[D-xx]` (Doku) / `[C-xx]` (Code) · Schweregrad **KRITISCH/HOCH/MITTEL/KLEIN** ·
Fundstelle (Datei:Zeile bzw. Abschnitt) mit Zitat oder Repro · kleinster
Korrekturvorschlag. **Entwarnungen mit Beleg sind so wertvoll wie Befunde** —
sie ersparen der nächsten Session dieselben Verdachte.

## Abschluss (Hauptsession)

1. Jeden Auditor-Befund selbst nachmessen (lesen/greppen/Repro) — erst dann in
   die Liste; widerspricht ein Befund dem eigenen Wissensstand, ist die erste
   Hypothese eine veraltete Momentaufnahme der Unteraufgabe.
2. `ZWEITAUDIT-BEFUNDE.md` schreiben: Befunde nach Schwere sortiert, dann die
   Entwarnungen, dann die gefahrenen Läufe/Proben. Committen
   („Zweit-Audit: Befundliste …") — sonst nichts anfassen.
3. Abschlussbericht an Georg in Alltagssprache: die schwersten Befunde zuerst,
   mit einer Empfehlung, was als erste Behebungs-Session laufen sollte.
   Doku-Befunde beheben heißt später: an ALLEN Fundstellen (nach der veralteten
   Zahl/Phrase greppen, nicht nur die gemeldete Stelle); Code-Befunde bekommen
   in ihrer Bausession eine Prüfung, die ohne den Fix nachweislich fehlschlägt.
