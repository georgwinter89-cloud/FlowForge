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
//
// brauchtOptional (seit Bauschritt 9): Übergaben, die der Block nutzt, wenn ein
// Block davor sie liefert — aber nicht verlangt (die Steck-Regel prüft nur braucht).
// So kommt der Bauer in „Bug jagen" ohne Angreifer aus.
//
// erzeugtAufgaben (seit Bauschritt 9): Der Block legt selbst Aufgaben-Karten an
// (Spec-Interview). Er zählt damit als Auftragsquelle für spätere Blöcke, und
// seine neuen offenen Aufgaben rutschen automatisch in die Kartenauswahl des Laufs.

export const REPARATUR_RUNDEN_STANDARD = 2
export const REPARATUR_RUNDEN_MAX = 9

// Automatischer Übertrag (SPEC §5, BAUPLAN 11): so oft darf ein Lauf bei vollem
// Kontext an eine frische Session übergeben. null = unbegrenzt.
export const UEBERTRAG_GRENZE_STANDARD = 5
export const UEBERTRAG_GRENZE_MAX = 99

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
    id: 'spec-interview',
    name: 'Spec-Interview',
    symbol: '🎙️',
    beschreibung:
      'Grillt dich in mehreren Frage-Runden, bis klar ist, was gebaut werden soll — und legt die ersten Karten an.',
    braucht: [],
    liefert: ['Projekt-Überblick'],
    nurLesen: false,
    prueft: false,
    uebung: false,
    erzeugtAufgaben: true,
    felder: [
      {
        id: 'idee',
        label: 'Deine Idee in einem Satz',
        platzhalter: 'z.B. Eine App, die meine Ausgaben sortiert',
        pflicht: true
      }
    ],
    // Frage-Methode: „Grilling" nach Matt Pocock (Entscheidungsbaum, Runden,
    // Front, Empfehlungen) — auf Georgs Wunsch originalgetreu übernommen und an
    // das mensch_fragen-Werkzeug angepasst (eine Runde = ein Aufruf).
    auftrag:
      'Du führst das Spec-Interview für ein neues Projekt: Du grillst den Nutzer mit Fragen, ' +
      'bis ihr ein gemeinsames Verständnis erreicht habt. Antworte auf Deutsch. ' +
      'Die Idee des Nutzers: {{idee}}\n' +
      'Arbeite mit einem ENTSCHEIDUNGSBAUM: Jede Festlegung verzweigt in die ' +
      'Folge-Entscheidungen, die an ihr hängen. Den Baum arbeitest du in RUNDEN ab. Die FRONT ' +
      'ist die Menge aller Entscheidungen, deren Voraussetzungen bereits geklärt sind — also ' +
      'genau die Fragen, die du JETZT stellen kannst, ohne Antworten zu raten, die du noch ' +
      'nicht gehört hast. Stelle in jeder Runde die komplette Front auf einmal: ein einziger ' +
      'Aufruf von mensch_fragen, in dessen Fragetext alle Fragen der Runde stehen — ' +
      'nummeriert und jede mit deiner Empfehlung. Formatiere als reinen Text ohne ' +
      'Markdown-Zeichen, pro Frage nach diesem Muster:\n' +
      '❓ F1 — Titel: Fragetext, gern mit Auswahlmöglichkeiten.\n' +
      '➡️ Meine Empfehlung: deine empfohlene Antwort, kurz begründet.\n' +
      'Eine Frage, deren Antwort von einer anderen noch offenen Frage derselben Runde ' +
      'abhängt, gehört in eine SPÄTERE Runde, nicht in diese. Das optionen-Feld des ' +
      'Werkzeugs nutzt du nur, wenn die Runde aus genau einer Frage besteht. ' +
      'Jede Antwortrunde des Nutzers formt den Baum um: Geklärte Entscheidungen schieben die ' +
      'Front nach außen und schalten neue Fragen frei. Berechne die Front neu und stelle die ' +
      'nächste Runde. Hake nach, wenn eine Antwort vage ist oder einer früheren widerspricht. ' +
      'FAKTEN zu beschaffen ist deine Aufgabe, niemals die des Nutzers: Was sich aus dem ' +
      'Projektordner oder den Karten ablesen lässt, liest du selbst nach, statt danach zu ' +
      'fragen. Die ENTSCHEIDUNGEN trifft der Nutzer — lege ihm jede vor und warte auf seine ' +
      'Antwort. Frage nach Folgen in Alltagssprache („Was bedeutet das für dich …"), niemals ' +
      'nach Technik — Technik entscheidest du selbst und erklärst nur die Auswirkung. ' +
      'Das Interview ist fertig, wenn die Front leer ist: jeder Ast des Baums besucht, nichts ' +
      'stillschweigend angenommen. Fasse dann das gemeinsame Verständnis kompakt zusammen und ' +
      'lass es dir in einer letzten Runde ausdrücklich bestätigen, bevor du etwas festschreibst. ' +
      'Danach bringst du das Ergebnis in Karten: Lege für jede getroffene Festlegung eine ' +
      'Entscheidungs-Karte an („X festgelegt, weil Y"), lege die ersten Bau-Aufgaben als ' +
      'kleine, prüfbare Aufgaben-Karten an (die erste davon ist das erste Arbeitspaket) und ' +
      'aktualisiere die Status-Karte. Beachte die harten Längengrenzen — lieber mehrere ' +
      'fokussierte Karten als eine lange. Dateien im Projektordner fasst du nicht an. ' +
      'Dein Abschlusstext ist der Projekt-Überblick für die folgenden Blöcke — kompakt ' +
      '(höchstens etwa 25 Zeilen): 1. Was gebaut wird und für wen. 2. Der Kernablauf. ' +
      '3. Was bewusst draußen bleibt. 4. Die angelegten Aufgaben in der geplanten Reihenfolge.'
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
    id: 'diagnose',
    name: 'Diagnose',
    symbol: '🩺',
    beschreibung:
      'Belegt die Ursache eines Fehlers, bevor etwas angefasst wird — und schneidet daraus den minimalen Fix.',
    braucht: ['Projekt-Überblick'],
    liefert: ['Arbeitspaket'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    felder: [
      {
        id: 'fehlerbild',
        label: 'Was geht kaputt oder klemmt?',
        platzhalter: 'leer lassen = die offenen Aufgaben-Karten beschreiben den Fehler',
        pflicht: false,
        oderOffeneAufgaben: true
      }
    ],
    auftrag:
      'Du bist die Diagnose: Du belegst die Ursache eines Fehlers, BEVOR irgendetwas ' +
      'angefasst wird. Du darfst nichts verändern — nur lesen. Antworte auf Deutsch. ' +
      'Das Fehlerbild steht in diesem Feld:\n' +
      '{{fehlerbild}}\n' +
      'Ist das Feld leer, beschreiben die offenen Aufgaben-Karten den Fehler — wähle die ' +
      'passende und benenne sie. ' +
      'Verfolge den Fehler im Code: Lies die beteiligten Stellen, verfolge den Weg der Daten ' +
      'und finde die Ursache — nicht nur das Symptom. Belege die Ursache mit Fundort (Datei ' +
      'und Stelle) und einer kurzen Herleitung, warum genau dort das beobachtete Verhalten ' +
      'entsteht. Prüfe ehrlich, ob eine andere Erklärung ebenso gut passt — wenn ja, benenne ' +
      'beide und was sie unterscheiden würde. Rate nicht: Kannst du die Ursache nicht belegen, ' +
      'schreibe das offen und benenne, welche Information fehlt. ' +
      'Dein Abschlusstext ist das Arbeitspaket für den Bauer — kompakt (höchstens etwa 25 ' +
      'Zeilen): 1. Das Fehlerbild in einem Satz. 2. Die belegte Ursache mit Fundort und ' +
      'Herleitung. 3. Der minimale Fix: möglichst kleine Schritte, betroffene Dateien. ' +
      '4. Was ausdrücklich NICHT angefasst wird. 5. Fertig-Kriterien für den Prüfer — ' +
      'darunter: ein Test, der den Fehler nachstellt, ist vor dem Fix rot und danach grün.'
  },
  {
    id: 'bauer',
    name: 'Bauer',
    symbol: '🔨',
    beschreibung:
      'Setzt genau das Arbeitspaket um und räumt dabei die Funde der Angriffsliste aus, falls eine da ist.',
    braucht: ['Arbeitspaket'],
    brauchtOptional: ['Angriffsliste'],
    liefert: ['Umsetzungsbericht'],
    nurLesen: false,
    prueft: false,
    uebung: false,
    // Startanleitung als Pflicht-Artefakt (SPEC §8, BAUPLAN 10): Fehlt sie nach
    // dem Block, fordert der Lauf sie in einer Nachbesserungs-Runde ein.
    startanleitungPflicht: true,
    felder: [],
    auftrag:
      'Du bist der Bauer: Du setzt genau das Arbeitspaket um — nicht mehr und nicht weniger. ' +
      'Antworte auf Deutsch. Liegt dir eine Angriffsliste vor, arbeite sie von Anfang an ein: ' +
      'Räume jeden Fund aus ' +
      'oder begründe, warum er dieses Paket nicht trifft. Halte dich an Stil und Aufbau des ' +
      'bestehenden Codes und bleibe im Projektordner. Was das Arbeitspaket ausdrücklich ' +
      'ausschließt, baust du nicht — auch nicht nebenbei. Projektkarten fasst du nicht an, ' +
      'das übernimmt der Sessionende-Block. ' +
      'Kommt vom Prüfer eine Rückmeldung aus einer Reparatur-Runde, hat deren Behebung Vorrang. ' +
      'Pflicht-Artefakt Startanleitung: Bevor du fertig bist, lege mit dem Werkzeug ' +
      'startanleitung_setzen fest, wie man das gebaute Ergebnis startet — beschreibung (ein ' +
      'Satz), dazu befehl (Kommandozeile im Projektordner) und/oder adresse (http(s)-Adresse ' +
      'oder Datei im Projektordner für den Browser). Stimmt die vorhandene Startanleitung noch, ' +
      'setze sie unverändert erneut — ohne gültige Startanleitung gilt dein Auftrag als nicht fertig. ' +
      'Dein Abschlusstext ist die Übergabe an den Prüfer — kompakt (höchstens etwa 25 Zeilen): ' +
      '1. Was du umgesetzt hast. ' +
      '2. Welche Dateien du angelegt oder geändert hast. ' +
      '3. Wie du mit jedem Fund der Angriffsliste umgegangen bist (falls es eine gab). ' +
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
    id: 'frage-mensch',
    name: 'Frage an den Menschen',
    symbol: '💬',
    beschreibung:
      'Hält den Lauf an und stellt dir genau eine Frage — als Folgen-Frage mit Empfehlung. Deine Antwort geht an die nächsten Blöcke.',
    braucht: [],
    liefert: ['Antwort des Menschen'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    felder: [
      {
        id: 'thema',
        label: 'Worum geht es bei der Frage?',
        platzhalter: 'z.B. Soll die App auch offline funktionieren?',
        pflicht: true
      }
    ],
    auftrag:
      'Du stellst dem Nutzer GENAU EINE Frage — mit dem Werkzeug mensch_fragen — und wartest ' +
      'auf die Antwort. Antworte auf Deutsch. Worum es geht:\n' +
      '{{thema}}\n' +
      'Sieh dir vorher an, was du dazu wissen kannst (Projektkarten, bei Bedarf Dateien lesen), ' +
      'damit die Frage konkret wird. Formuliere eine Folgen-Frage in Alltagssprache: Was ' +
      'bedeutet die Wahl für den Nutzer und sein Projekt — keine Technik-Frage. Gib 2 bis 4 ' +
      'Antwort-Optionen mit und stelle deine Empfehlung an die erste Stelle, als Empfehlung ' +
      'benannt. Du veränderst nichts und baust nichts. ' +
      'Dein Abschlusstext ist die Übergabe an die folgenden Blöcke: die Frage, die Antwort ' +
      'des Nutzers wortgetreu, und in ein bis zwei Sätzen, was daraus für die weitere Arbeit folgt.'
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
// leere Leinwand gelegt werden.
export const VORLAGEN = [
  // Spec-Erfassung getrennt vom Bauen (Feedback Georg, 07.08.2026): erst das
  // Interview allein laufen lassen — die Karten sind dann da; gebaut wird
  // danach mit „Feature hinzufügen".
  {
    id: 'neue-app-starten',
    name: 'Neue App starten',
    symbol: '🌱',
    kette: ['spec-interview']
  },
  {
    id: 'feature-hinzufuegen',
    name: 'Feature hinzufügen',
    symbol: '🧩',
    kette: ['kontext-laden', 'paket-schneiden', 'angreifer', 'bauer', 'pruefer', 'sessionende']
  },
  {
    id: 'bug-jagen',
    name: 'Bug jagen',
    symbol: '🐞',
    kette: ['kontext-laden', 'diagnose', 'bauer', 'pruefer', 'sessionende']
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
