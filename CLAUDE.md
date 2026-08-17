# FlowForge — Regeln für Bausessions

FlowForge ist eine Electron-Desktop-App, mit der Nicht-Programmierer per Drag & Drop
Coding-Workflows aus Blöcken bauen, die ein KI-Agent ausführt.
Produktdefinition: [SPEC.md](SPEC.md) · Bauschritte: [BAUPLAN.md](BAUPLAN.md) · abgeschlossene Schritte 1–32: [BAUPLAN-ARCHIV.md](BAUPLAN-ARCHIV.md)

## Sessionstart
1. SPEC.md und BAUPLAN.md lesen.
2. `git log --oneline` lesen: Commits der Form „Bauschritt N: …" markieren fertige
   Schritte. Diese Session setzt genau den nächsten Bauschritt um — einen, nie mehrere.
3. Vor dem Bauen eine kurze Angriffsliste erstellen (nur lesend): woran könnte genau
   dieser Schritt scheitern? Funde zuerst ausräumen.

Ausnahme: Sagt Georg „Führe das Zweit-Audit aus", gilt statt alldem die Prozedur in
[ZWEITAUDIT.md](ZWEITAUDIT.md) — nur Befundliste, kein Bauschritt, kein Build.

## Sessionende (Pflicht — einplanen, bevor der Kontext knapp wird)
- Der Alltagstest des Schritts (siehe BAUPLAN) ist von Georg durchführbar; Anleitung
  dafür in Alltagssprache ausgeben.
- Versionsnummer in package.json an den Bauschritt koppeln: Bauschritt N → 0.N.0
  (Zwischen-Sessions ohne Bauschritt erhöhen die dritte Stelle). Erst dann bauen —
  Georg erkennt den Stand am Dateinamen der Setup-Datei.
- `npm test` (Regel-Prüfungen in `pruefungen/`) muss grün sein, bevor gebaut wird.
- Installierbare Version bauen; Build-Befehle sind die in package.json definierten Scripts.
- Abschluss-Commit: „Bauschritt N: <Titel>".

## Georg
Georg programmiert nicht — Claude schreibt allen Code. Kommunikation auf Deutsch.
Entscheidungsfragen als Folgen-Fragen stellen („was bedeutet das für dich"), nie als
Mechanismus-Fragen, immer mit einer Empfehlung.

## Doku
SPEC.md ist die einzige Beschreibung der Gegenwart — Verhaltensänderungen dort
nachziehen. Verlaufs-/Chronik-Dokumente in Prosa sind verboten; Historie liefert git.
