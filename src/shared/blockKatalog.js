// Blockbibliothek V1 (SPEC §4.3): echte Arbeitsblöcke (BAUPLAN 8) plus die
// Übungs-Blöcke aus Schritt 5/7 (uebung: true). Anatomie eines Blocks laut
// SPEC §4.2: Name · Symbol · Arbeitsauftrag · braucht/liefert · Sperren
// (nur lesen, Pflichtfelder).
//
// braucht/liefert ist seit Schritt 8 auch die Datenweitergabe im Lauf: Der
// Abschlusstext eines Blocks wird unter seinen liefert-Etiketten gespeichert
// und Folgeblöcken mit passendem braucht in den Auftrag gereicht (lauf.js).
//
// Prüfer-Blöcke (prueft: true) müssen ihr Urteil als letzte Zeile ausgeben:
// „PRUEFUNG: BESTANDEN" oder „PRUEFUNG: FEHLGESCHLAGEN" — FlowForge wertet das aus.

export const REPARATUR_RUNDEN_STANDARD = 2
export const REPARATUR_RUNDEN_MAX = 9

export const BLOCK_KATALOG = [
  {
    id: 'kontext-laden',
    name: 'Kontext laden',
    symbol: '📖',
    beschreibung:
      'Verschafft sich einen Überblick über Projekt und Karten — die Grundlage für alle folgenden Blöcke.',
    braucht: [],
    liefert: ['Projekt-Überblick'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    felder: [],
    auftrag:
      'Du bist der erste Block eines Workflows und lädst den Kontext. Antworte auf Deutsch. ' +
      'Verschaffe dir einen gründlichen Überblick über dieses Projekt: Sieh dir die Dateien im ' +
      'Projektordner an (Aufbau und die wichtigsten Inhalte) und lies alle Projektkarten mit ' +
      'karten_uebersicht. Du darfst nichts verändern — nur lesen. ' +
      'Dein Abschlusstext ist die Übergabe an die folgenden Blöcke — schreibe ihn kompakt ' +
      '(höchstens etwa 30 Zeilen) und decke ab: ' +
      '1. Was für ein Projekt das ist und wie es aufgebaut ist. ' +
      '2. Womit es gebaut, getestet und gestartet wird (falls erkennbar). ' +
      '3. Was Status-Karte, offene Aufgaben und Entscheidungs-Karten sagen. ' +
      '4. Besonderheiten, die man beim Ändern kennen muss.'
  },
  {
    id: 'paket-schneiden',
    name: 'Paket schneiden',
    symbol: '✂️',
    beschreibung:
      'Schneidet aus dem Wunsch ein kleines, in einer Sitzung schaffbares Arbeitspaket mit prüfbaren Fertig-Kriterien.',
    braucht: ['Projekt-Überblick'],
    liefert: ['Arbeitspaket'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    felder: [
      {
        id: 'wunsch',
        label: 'Was soll gebaut werden?',
        platzhalter: 'leer lassen = die offenen Aufgaben-Karten sind der Auftrag',
        pflicht: false,
        // Auftragsquelle (Entscheidung Georg, 07.08.2026): Feld ODER offene
        // Aufgaben-Karten — sind beide leer, hält der Start an (lauf.js).
        oderOffeneAufgaben: true
      }
    ],
    auftrag:
      'Du schneidest das nächste Arbeitspaket — du baust selbst nichts und veränderst nichts ' +
      '(nur lesen). Antworte auf Deutsch. Der Wunsch des Nutzers steht in diesem Feld:\n' +
      '{{wunsch}}\n' +
      'Ist das Feld leer, sind die offenen Aufgaben-Karten der Wunsch — wähle daraus die ' +
      'sinnvollste nächste Arbeit (ein Paket, nicht alle auf einmal) und benenne, welche ' +
      'Karte du dir vornimmst. ' +
      'Prüfe anhand des Projekt-Überblicks und bei Bedarf durch eigenes Lesen im Projektordner, ' +
      'wie sich dieser Wunsch in EIN kleines, in einer Sitzung schaffbares Arbeitspaket fassen ' +
      'lässt. Ist der Wunsch zu groß, schneide das sinnvollste erste Paket heraus und benenne, ' +
      'was bewusst draußen bleibt. Projektkarten sind nie Teil des Pakets — sie pflegt der ' +
      'Sessionende-Block nach der Prüfung; nimm sie weder in die Schritte noch in die ' +
      'Fertig-Kriterien auf. ' +
      'Dein Abschlusstext ist die Übergabe an Angreifer und Bauer — kompakt (höchstens etwa ' +
      '25 Zeilen) und mit genau diesen Punkten: ' +
      '1. Ziel des Pakets in einem Satz. ' +
      '2. Voraussichtlich betroffene Dateien. ' +
      '3. Umsetzungsschritte in sinnvoller Reihenfolge. ' +
      '4. Was ausdrücklich NICHT Teil des Pakets ist. ' +
      '5. Fertig-Kriterien: prüfbare Aussagen, an denen ein Prüfer das Ergebnis messen kann.'
  },
  {
    id: 'angreifer',
    name: 'Angreifer',
    symbol: '⚔️',
    beschreibung:
      'Sucht vor dem Bauen, woran das Arbeitspaket scheitern könnte. Darf nichts verändern.',
    braucht: ['Arbeitspaket'],
    liefert: ['Angriffsliste'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    felder: [],
    auftrag:
      'Du bist der Angreifer: Du suchst, woran dieses Arbeitspaket scheitern könnte — BEVOR ' +
      'gebaut wird. Du darfst nichts verändern — nur lesen. Antworte auf Deutsch. ' +
      'Sieh dir die im Arbeitspaket genannten Stellen im Projektordner genau an und suche ' +
      'gezielt nach: Annahmen im Arbeitspaket, die nicht stimmen; Stellen, die mitgeändert ' +
      'werden müssen, aber nicht genannt sind; versteckten Abhängigkeiten; Rand- und ' +
      'Fehlerfällen; Konflikten mit bestehendem Verhalten. ' +
      'Dein Abschlusstext ist die Angriffsliste für den Bauer: nummerierte Funde, nach Gefahr ' +
      'sortiert, je Fund ein bis zwei Sätze mit Fundort (Datei). Findest du nach gründlicher ' +
      'Suche nichts, schreibe das ehrlich als leere Angriffsliste — erfinde keine Funde.'
  },
  {
    id: 'bauer',
    name: 'Bauer',
    symbol: '🔨',
    beschreibung:
      'Setzt genau das Arbeitspaket um und räumt dabei die Funde der Angriffsliste aus.',
    braucht: ['Arbeitspaket', 'Angriffsliste'],
    liefert: ['Umsetzungsbericht'],
    nurLesen: false,
    prueft: false,
    uebung: false,
    felder: [],
    auftrag:
      'Du bist der Bauer: Du setzt genau das Arbeitspaket um — nicht mehr und nicht weniger. ' +
      'Antworte auf Deutsch. Arbeite die Angriffsliste von Anfang an ein: Räume jeden Fund aus ' +
      'oder begründe, warum er dieses Paket nicht trifft. Halte dich an Stil und Aufbau des ' +
      'bestehenden Codes und bleibe im Projektordner. Was das Arbeitspaket ausdrücklich ' +
      'ausschließt, baust du nicht — auch nicht nebenbei. Projektkarten fasst du nicht an, ' +
      'das übernimmt der Sessionende-Block. ' +
      'Kommt vom Prüfer eine Rückmeldung aus einer Reparatur-Runde, hat deren Behebung Vorrang. ' +
      'Dein Abschlusstext ist die Übergabe an den Prüfer — kompakt (höchstens etwa 25 Zeilen): ' +
      '1. Was du umgesetzt hast. ' +
      '2. Welche Dateien du angelegt oder geändert hast. ' +
      '3. Wie du mit jedem Fund der Angriffsliste umgegangen bist. ' +
      '4. Wie man das Ergebnis startet oder ausprobiert. ' +
      '5. Was du bewusst nicht getan hast.'
  },
  {
    id: 'pruefer',
    name: 'Prüfer',
    symbol: '🔬',
    beschreibung:
      'Frische Session ohne Bauer-Wissen: schreibt eigene Tests, führt sie aus und liefert einen Rot-vor-Grün-Beleg.',
    braucht: ['Arbeitspaket', 'Umsetzungsbericht'],
    liefert: ['Prüfbeleg'],
    nurLesen: false,
    prueft: true,
    uebung: false,
    felder: [],
    auftrag:
      'Du bist der Prüfer — eine frische Session ohne das Arbeitswissen des Bauers. Antworte ' +
      'auf Deutsch. Maßstab deiner Prüfung sind die Fertig-Kriterien des Arbeitspakets. ' +
      'Verlasse dich nicht auf den Umsetzungsbericht: Lies den Code selbst und prüfe nach. ' +
      'Schreibe eigene, kleine Tests als Testdateien im Projektordner (passend zu den ' +
      'Werkzeugen des Projekts; zur Not ein einfaches Skript, das bei Fehlern mit einer ' +
      'Fehlermeldung endet) und führe sie aus. ' +
      'Rot-vor-Grün-Beleg: Zeige für mindestens einen wichtigen Test, dass er überhaupt ' +
      'fehlschlagen KANN — führe ihn einmal mit absichtlich verfälschter Erwartung aus (Rot) ' +
      'und danach unverändert echt (Grün). Ein Test, der nie rot war, beweist nichts. ' +
      'Zitiere beide tatsächlichen Ausgaben kurz im Abschlusstext. ' +
      'Du darfst Testdateien schreiben und Tests ausführen — den geprüften Code selbst ' +
      'veränderst du nie. Projektkarten sind nicht dein Prüfgegenstand: Sie werden erst nach ' +
      'dir vom Sessionende-Block gepflegt. ' +
      'Dein Abschlusstext ist der Prüfbeleg — kompakt: 1. Was du wie geprüft hast. ' +
      '2. Der Rot-vor-Grün-Beleg mit den Ausgaben. 3. Beanstandungen mit Fundort — oder dass ' +
      'es keine gibt. Deine allerletzte Zeile muss exakt lauten: ' +
      'PRUEFUNG: BESTANDEN oder PRUEFUNG: FEHLGESCHLAGEN'
  },
  {
    id: 'sessionende',
    name: 'Sessionende',
    symbol: '🌙',
    beschreibung:
      'Bringt das Projektgedächtnis auf Stand: Status-Karte aktualisieren, Erledigtes abhaken, Offenes festhalten.',
    braucht: ['Umsetzungsbericht', 'Prüfbeleg'],
    liefert: [],
    nurLesen: false,
    prueft: false,
    uebung: false,
    felder: [],
    auftrag:
      'Du bist das Sessionende: Du bringst das Projektgedächtnis auf den neuesten Stand — am ' +
      'Code und an Dateien änderst du nichts. Antworte auf Deutsch und arbeite ausschließlich ' +
      'mit den karten-Werkzeugen: ' +
      '1. Hol dir mit karten_uebersicht den aktuellen Stand aller Karten. ' +
      '2. Aktualisiere die Status-Karte: Wo steht das Projekt jetzt, nach diesem Lauf — ' +
      'einschließlich des Prüfungs-Ergebnisses? ' +
      '3. Hake mit karte_erledigen genau die Aufgaben-Karten ab, die dieser Lauf wirklich ' +
      'erledigt hat. ' +
      '4. Lege für offen gebliebene oder neu entdeckte Arbeit kurze Aufgaben-Karten an; halte ' +
      'getroffene Entscheidungen und neues Wissen als Entscheidungs- bzw. Wissens-Karten fest. ' +
      'Beachte die harten Längengrenzen — lieber mehrere fokussierte Karten als eine lange. ' +
      'Dein Abschlusstext (3 bis 6 Sätze): welche Karten du geändert oder angelegt hast und warum.'
  },
  {
    id: 'spaeher',
    name: 'Späher',
    symbol: '🔍',
    beschreibung:
      'Sieht sich den Projektordner an und fasst zusammen, was drin liegt. Darf nichts verändern.',
    braucht: [],
    liefert: ['Projekt-Überblick'],
    nurLesen: true,
    prueft: false,
    uebung: true,
    felder: [],
    auftrag:
      'Sieh dich im Projektordner um (Dateien und deren Inhalte) und fasse auf Deutsch ' +
      'in drei bis fünf Sätzen zusammen, was in diesem Projekt liegt. ' +
      'Du darfst nichts verändern — nur lesen.'
  },
  {
    id: 'mini-bauer',
    name: 'Mini-Bauer',
    symbol: '🔨',
    beschreibung:
      'Legt eine kleine Textdatei im Projektordner an — oder verbessert sie, wenn es sie schon gibt.',
    braucht: [],
    liefert: ['Textdatei'],
    nurLesen: false,
    prueft: false,
    uebung: true,
    felder: [
      {
        id: 'dateiname',
        label: 'Dateiname der Textdatei',
        platzhalter: 'z.B. gruss.txt',
        pflicht: true
      }
    ],
    auftrag:
      'Lege im Projektordner eine Textdatei namens {{dateiname}} an. ' +
      'Inhalt: eine freundliche Begrüßung auf Deutsch (2–3 Sätze) und das heutige Datum. ' +
      'Falls die Datei schon existiert, verbessere den Text ein wenig und hänge eine neue ' +
      'Zeile mit Datum und Uhrzeit an. Arbeite ausschließlich im Projektordner und fasse ' +
      'am Ende in zwei Sätzen zusammen, was du getan hast.'
  },
  {
    id: 'pruefer-fair',
    name: 'Übungs-Prüfer (fair)',
    symbol: '✅',
    beschreibung:
      'Prüft die Textdatei und lässt sie durch, wenn sie in Ordnung ist. Darf nichts verändern.',
    braucht: ['Textdatei'],
    liefert: ['Prüfbeleg'],
    nurLesen: true,
    prueft: true,
    uebung: true,
    felder: [],
    auftrag:
      'Du bist der Prüfer. Sieh dir die zuletzt geänderte Textdatei (.txt) im Projektordner an. ' +
      'Die Prüfung ist bestanden, wenn sie eine freundliche Begrüßung auf Deutsch und ein Datum ' +
      'enthält. Du darfst nichts verändern — nur lesen. Begründe dein Urteil auf Deutsch in ein ' +
      'bis zwei Sätzen. Deine allerletzte Zeile muss exakt lauten: ' +
      'PRUEFUNG: BESTANDEN oder PRUEFUNG: FEHLGESCHLAGEN'
  },
  {
    id: 'pruefer-streng',
    name: 'Übungs-Prüfer (streng)',
    symbol: '🧐',
    beschreibung:
      'Findet absichtlich immer etwas zu meckern — zum Ausprobieren der Reparatur-Runden.',
    braucht: ['Textdatei'],
    liefert: ['Prüfbeleg'],
    nurLesen: true,
    prueft: true,
    uebung: true,
    felder: [],
    auftrag:
      'Du bist ein absichtlich strenger Übungs-Prüfer — dein einziger Zweck ist, die ' +
      'Reparatur-Runden von FlowForge vorzuführen. Sieh dir die zuletzt geänderte Textdatei ' +
      '(.txt) im Projektordner an und finde genau einen Kritikpunkt, gern auch einen ' +
      'kleinlichen (Stil, Wortwahl, fehlender Schwung). Nenne ihn auf Deutsch in ein bis zwei ' +
      'Sätzen. Diese Prüfung fällt grundsätzlich immer durch — egal wie gut die Datei ist. ' +
      'Du darfst nichts verändern — nur lesen. Deine allerletzte Zeile muss exakt lauten: ' +
      'PRUEFUNG: FEHLGESCHLAGEN'
  },
  {
    id: 'karten-probe',
    name: 'Karten-Probe',
    symbol: '🗂️',
    beschreibung:
      'Liest die Status-Karte vor und legt eine Aufgaben-Karte an — inklusive Test, dass zu lange Karten abgelehnt werden.',
    braucht: [],
    liefert: [],
    nurLesen: false,
    prueft: false,
    uebung: true,
    felder: [],
    auftrag:
      'Dies ist eine Übung für die Karten-Werkzeuge von FlowForge. Antworte auf Deutsch. ' +
      'Schritt 1: Hol dir mit karten_uebersicht alle Karten und merke dir den Inhalt der Status-Karte. ' +
      'Schritt 2: Versuche absichtlich, mit karte_anlegen eine Aufgaben-Karte anzulegen, deren Inhalt ' +
      'deutlich länger als 400 Zeichen ist — die Ablehnung ist gewollt und Teil der Übung. Genau ein Versuch. ' +
      'Schritt 3: Lege dann eine richtige Aufgaben-Karte an: Titel „Karten-Probe erledigt", Inhalt: zwei ' +
      'kurze Sätze darüber, was diese Übung gezeigt hat. ' +
      'Fasse am Ende in zwei bis drei Sätzen zusammen: den wörtlichen Inhalt der Status-Karte und ob die ' +
      'Längengrenze in Schritt 2 gegriffen hat.'
  },
  {
    id: 'rechte-probe',
    name: 'Rechte-Probe',
    symbol: '🛡️',
    beschreibung:
      'Versucht absichtlich, außerhalb des Projektordners zu schreiben — damit du die Rechte-Rückfrage siehst.',
    braucht: [],
    liefert: [],
    nurLesen: false,
    prueft: false,
    uebung: true,
    felder: [],
    auftrag:
      'Dies ist ein Test der Rechte-Durchsetzung von FlowForge. Antworte auf Deutsch. ' +
      'Wichtig zum Verständnis: Bei Aktionen außerhalb des Projektordners zeigt FlowForge dem Nutzer ' +
      'eine Erlaubnis-Frage, die du selbst NICHT siehst — du merkst nur, ob die Aktion durchgelassen ' +
      'oder abgelehnt wird. Beides ist ein Erfolg dieses Tests. ' +
      'Versuche jetzt, mit dem Write-Werkzeug eine Datei namens flowforge-probe.txt mit dem Inhalt "Probe" ' +
      'direkt im Windows-Temp-Ordner des Nutzers anzulegen, also bewusst AUSSERHALB des Projektordners. ' +
      'Genau ein Versuch, kein zweiter. ' +
      'Wird die Aktion abgelehnt: Erkläre in ein bis zwei Sätzen, dass der Nutzer sie in der ' +
      'Erlaubnis-Frage abgelehnt hat und die Schranke funktioniert. ' +
      'Geht die Aktion durch: Erkläre in ein bis zwei Sätzen, dass der Nutzer sie in der ' +
      'Erlaubnis-Frage bewusst freigegeben hat — auch dann hat die Schranke funktioniert. ' +
      'Schlage in keinem Fall Änderungen an FlowForge, Einstellungen oder Berechtigungsregeln vor.'
  }
]

// Vorlagen-Workflows (SPEC §4.4): fertige Ketten, die per Drag & Drop auf die
// leere Leinwand gelegt werden. „Neue App starten" und „Bug jagen" folgen mit
// Bauschritt 9 (brauchen Spec-Interview bzw. Diagnose).
export const VORLAGEN = [
  {
    id: 'feature-hinzufuegen',
    name: 'Feature hinzufügen',
    symbol: '🧩',
    kette: ['kontext-laden', 'paket-schneiden', 'angreifer', 'bauer', 'pruefer', 'sessionende']
  }
]

export function vorlageDefinition(vorlageId) {
  return VORLAGEN.find((v) => v.id === vorlageId) ?? null
}

export function blockDefinition(blockId) {
  return BLOCK_KATALOG.find((b) => b.id === blockId) ?? null
}

// Farb-Kategorie eines Blocks für Leinwand und Bibliothek:
// Prüfer blau, nur-lesende Blöcke grün, schreibende (Bauer) rot.
export function blockKategorie(def) {
  if (def.prueft) return 'pruefer'
  if (def.nurLesen) return 'leser'
  return 'bauer'
}
