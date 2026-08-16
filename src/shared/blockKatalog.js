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

// Echte Übertrags-Schwelle als absoluter Füllstand (SPEC §5). Liegt hier im
// shared-Bereich, weil auch der Kontext-Balken der Oberfläche die rote Marke
// an dieser Schwelle zeichnet — der Renderer darf keine Motor-Module laden.
export const UEBERTRAG_SCHWELLE_PROZENT = 85

// Bereiche der Blockbibliothek (BAUPLAN 30): Klappen nach der Aufgabe im
// Ablauf — Reihenfolge der Anzeige. Jeder Katalog-Arbeitsblock trägt sein
// `bereich` fest (NICHT `kategorie`, das ist die Farbkategorie in
// blockKategorie()); Übungs-Blöcke brauchen keins und landen unter „Übung".
// Eigene Blöcke wählen ihren Bereich im Block-Editor: einen dieser Schlüssel,
// BEREICH_EIGENE oder einen freien Namen (eigene Klappe). Anzeigenamen der
// festen Bereiche stehen in texte.projektansicht.bereiche.
export const BEREICHE = ['auftrag', 'bauen', 'pruefen', 'gedaechtnis']
export const BEREICH_EIGENE = 'eigene'

export const BLOCK_KATALOG = [
  {
    // Seit 12.08.2026 (Entscheidung Georg) nicht mehr Teil der Vorlagen: Jeder
    // Block liest ohnehin selbst im Projekt — ein eigener Einlese-Block kostete
    // nur eine volle Extra-Session. Bleibt in der Bibliothek für Schaubilder,
    // die ihn noch nutzen oder bewusst wollen.
    id: 'kontext-laden',
    name: 'Kontext laden',
    symbol: '📖',
    beschreibung:
      'Verschafft sich einen Überblick über Projekt und Karten. Meist unnötig — jeder Block liest selbst; kostet einen eigenen Agenten-Lauf.',
    braucht: [],
    liefert: ['Projekt-Überblick'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    bereich: 'bauen',
    felder: [],
    auftrag:
      'Du bist der erste Block eines Workflows und lädst den Kontext. Antworte auf Deutsch. ' +
      'Verschaffe dir einen gründlichen Überblick über dieses Projekt: Sieh dir die Dateien im ' +
      'Projektordner an (Aufbau und die wichtigsten Inhalte) und lies alle Projektkarten mit ' +
      'karten_uebersicht. Du darfst nichts verändern — nur lesen: Rein lesende Befehle ' +
      '(Ordner auflisten, suchen, Dateien ansehen) laufen durch; Programme oder Tests ' +
      'auszuführen ist für diesen Block gesperrt — versuche es gar nicht erst. ' +
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
    bereich: 'auftrag',
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
      'fokussierte Karten als eine lange. Jede Karte bekommt ein thema (kurzes Schlagwort): ' +
      'Bündle die Karten in 3 bis 6 Themen — nicht mehr; sie sind die Ordnung der ' +
      'Karten-Seitenleiste. Dateien im Projektordner fasst du nicht an. ' +
      'Dein Abschlusstext ist der Projekt-Überblick für die folgenden Blöcke — kompakt ' +
      '(höchstens etwa 25 Zeilen): 1. Was gebaut wird und für wen. 2. Der Kernablauf. ' +
      '3. Was bewusst draußen bleibt. 4. Die angelegten Aufgaben in der geplanten Reihenfolge.'
  },
  {
    id: 'paket-schneiden',
    name: 'Paket schneiden',
    symbol: '✂️',
    beschreibung:
      'Schneidet aus dem Wunsch ein zusammenhängendes Arbeitspaket mit prüfbaren Fertig-Kriterien — so groß wie sinnvoll, so klein wie nötig.',
    braucht: [],
    // Liegt ein Projekt-Überblick vor (z.B. vom Spec-Interview), wird er
    // mitgereicht — verlangt wird er nicht: Der Block liest selbst (12.08.2026).
    brauchtOptional: ['Projekt-Überblick'],
    liefert: ['Arbeitspaket'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    bereich: 'auftrag',
    // Karten-Zuteilung (BAUPLAN 29): nur Auftragsquellen-Blöcke dürfen
    // karten_zuteilen rückfragefrei nutzen — durchgesetzt am Werkzeugaufruf
    // (dasselbe Freischalt-Muster wie laufVorschlag). Den Werkzeug-Zusatz
    // samt Nachfolger-Liste hängt lauf.js dynamisch an den Auftrag.
    kartenZuteilung: true,
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
      '(nur lesen; rein lesende Befehle laufen durch, Programme oder Tests auszuführen ist ' +
      'gesperrt — versuche es gar nicht erst). Antworte auf Deutsch. ' +
      'Der Wunsch des Nutzers steht in diesem Feld:\n' +
      '{{wunsch}}\n' +
      'Ist das Feld leer, sind die offenen Aufgaben-Karten der Wunsch — wähle daraus die ' +
      'sinnvollste nächste Arbeit und benenne, welche Karte(n) du dir vornimmst; ' +
      'zusammengehörige Aufgaben darfst du zu einem Paket bündeln. ' +
      'Prüfe durch eigenes Lesen im Projektordner (liegt dir ein Projekt-Überblick vor, nutze ' +
      'ihn als Abkürzung), wie sich dieser Wunsch in EIN zusammenhängendes Arbeitspaket ' +
      'fassen lässt. Miss die Paketgröße NICHT an der Sitzungslänge: Läuft der Kontext des ' +
      'Bauers voll, übergibt FlowForge automatisch an einen frischen Anlauf, der nahtlos ' +
      'weitermacht — jeder eigene Lauf kostet dagegen eigenen Grundaufwand. Schneide ' +
      'deshalb so GROSS wie inhaltlich sinnvoll: Was zusammengehört und sich gemeinsam prüfen ' +
      'lässt, gehört in EIN Paket. Schneide nur dann kleiner, wenn der Wunsch wirklich ' +
      'unabhängige Baustellen mischt oder mittendrin eine Entscheidung des Nutzers nötig wäre ' +
      '— dann benenne, was bewusst draußen bleibt. ' +
      'Projektkarten sind nie Teil des Pakets — sie pflegt der ' +
      'Sessionende-Block nach der Prüfung; nimm sie weder in die Schritte noch in die ' +
      'Fertig-Kriterien auf. ' +
      'Dein Abschlusstext ist die Übergabe an Angreifer und Bauer — kompakt (höchstens etwa ' +
      '40 Zeilen) und mit genau diesen Punkten: ' +
      '1. Ziel des Pakets in einem Satz. ' +
      '2. Voraussichtlich betroffene Dateien. ' +
      '3. Umsetzungsschritte in sinnvoller Reihenfolge. ' +
      '4. Was ausdrücklich NICHT Teil des Pakets ist. ' +
      '5. Fertig-Kriterien: prüfbare Aussagen, an denen ein Prüfer das Ergebnis messen kann — ' +
      'bei gebündelten Aufgaben eigene Kriterien je Teilstück.'
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
    bereich: 'pruefen',
    felder: [],
    auftrag:
      'Du bist der Angreifer: Du suchst, woran dieses Arbeitspaket scheitern könnte — BEVOR ' +
      'gebaut wird. Du darfst nichts verändern — nur lesen: Rein lesende Befehle (Ordner ' +
      'auflisten, suchen, Dateien ansehen) laufen durch; Programme oder Tests auszuführen ist ' +
      'für diesen Block gesperrt — versuche es gar nicht erst. Antworte auf Deutsch. ' +
      'Halte dein eigenes Arbeitsgedächtnis schlank: Delegiere das Durchsuchen und Einlesen ' +
      'an Unteraufgaben (bevorzugt lokal_recherchieren, falls es bereitsteht — sonst das ' +
      'Agent-Werkzeug) — aber SPARSAM: höchstens ZWEI Unteraufgaben in ' +
      'diesem ganzen Auftrag, jede mit einem eng umrissenen Suchauftrag. Weder du noch die ' +
      'Helfer lesen das ganze Projekt ein: Gelesen werden die im Arbeitspaket genannten ' +
      'Stellen und ihre direkte Nachbarschaft (was sie aufruft, was sie verwenden) — mehr ' +
      'nicht. Der Wegwerf-Helfer wühlt in seinem eigenen Kontext und liefert dir nur sein ' +
      'kompaktes Fazit mit Fundorten zurück; selbst liest du nur nach, was du zum Bewerten ' +
      'eines Fundes wirklich brauchst. ' +
      'Suche an diesen Stellen gezielt nach: Annahmen im Arbeitspaket, die nicht stimmen; ' +
      'Stellen, die mitgeändert werden müssen, aber nicht genannt sind; versteckten ' +
      'Abhängigkeiten; Rand- und Fehlerfällen; Konflikten mit bestehendem Verhalten. ' +
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
    braucht: [],
    brauchtOptional: ['Projekt-Überblick'],
    liefert: ['Arbeitspaket'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    bereich: 'auftrag',
    // Karten-Zuteilung (BAUPLAN 29): wie Paket schneiden — die Diagnose ist
    // die Auftragsquelle von „Bug jagen".
    kartenZuteilung: true,
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
      'angefasst wird. Du darfst nichts verändern — nur lesen: Rein lesende Befehle laufen ' +
      'durch; Programme oder Tests auszuführen ist für diesen Block gesperrt — versuche es ' +
      'gar nicht erst. Antworte auf Deutsch. ' +
      'Das Fehlerbild steht in diesem Feld:\n' +
      '{{fehlerbild}}\n' +
      'Ist das Feld leer, beschreiben die offenen Aufgaben-Karten den Fehler — wähle die ' +
      'passende und benenne sie. ' +
      'Halte dein eigenes Arbeitsgedächtnis schlank: Delegiere breites Suchen und Einlesen ' +
      'an Unteraufgaben (bevorzugt lokal_recherchieren, falls es bereitsteht — sonst das ' +
      'Agent-Werkzeug) — der Wegwerf-Helfer wühlt in seinem eigenen Kontext ' +
      'und liefert dir nur sein kompaktes Fazit mit Fundorten zurück. Die entscheidenden ' +
      'Stellen für deinen Beleg liest du selbst nach. ' +
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
    bereich: 'bauen',
    // Startanleitung als Pflicht-Artefakt (SPEC §8, BAUPLAN 10): Fehlt sie nach
    // dem Block, fordert der Lauf sie in einer Nachbesserungs-Runde ein.
    startanleitungPflicht: true,
    felder: [],
    auftrag:
      'Du bist der Bauer: Du setzt genau das Arbeitspaket um — nicht mehr und nicht weniger. ' +
      'Antworte auf Deutsch. Liegt dir eine Angriffsliste vor, arbeite sie von Anfang an ein: ' +
      'Räume jeden Fund aus ' +
      'oder begründe, warum er dieses Paket nicht trifft. ' +
      'ARBEITSGEDÄCHTNIS-REGEL (dein Kontext ist der teuerste Teil des Laufs): Musst du mehr ' +
      'als zwei Dateien einlesen oder im Projekt suchen, erledigt das EINE Unteraufgabe ' +
      '(bevorzugt das Werkzeug lokal_recherchieren, falls es bereitsteht — es kostet kein ' +
      'Kontingent; sonst das Agent-Werkzeug) mit eng umrissenem Auftrag — der Helfer wühlt ' +
      'in seinem eigenen ' +
      'Kontext und liefert dir nur ein kompaktes Fazit mit Fundorten. Selbst öffnest du nur ' +
      'die Stellen, die du in diesem Paket wirklich änderst, keine Datei doppelt und nichts ' +
      'auf Vorrat — was du schon weißt, liest du nicht erneut. ' +
      'Halte dich an Stil und Aufbau des ' +
      'bestehenden Codes und bleibe im Projektordner. Was das Arbeitspaket ausdrücklich ' +
      'ausschließt, baust du nicht — auch nicht nebenbei. Projektkarten fasst du nicht an, ' +
      'das übernimmt der Sessionende-Block. ' +
      'Die Prüfmappe im Ordner pruefung/ gehört dem Prüfer: Du änderst dort nie etwas (das ' +
      'ist gesperrt) — hältst du eine Prüfung für falsch, schreibe das in deinen ' +
      'Abschlusstext. Prüfen ist nicht deine Aufgabe: Kontrolliere deine Arbeit mit eigenen, ' +
      'schnellen Stichproben. Beim ersten Durchlauf ist die Prüfmappe ohnehin leer (FlowForge ' +
      'leert sie am Laufstart); liegen dort in einer Reparatur-Runde Prüfungen des Prüfers, ' +
      'darfst du sie höchstens EINMAL ganz am Ende laufen lassen — keine Dauerschleife. ' +
      'Eigene Hilfsskripte und Probedateien legst du im Ordner arbeitsablage/ ab — FlowForge ' +
      'leert ihn nach dem Lauf von selbst. ' +
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
      'Frischer Agent ohne Bauer-Wissen: schreibt eigene Tests, führt sie aus und liefert einen Rot-vor-Grün-Beleg.',
    braucht: ['Arbeitspaket', 'Umsetzungsbericht'],
    liefert: ['Prüfbeleg'],
    nurLesen: false,
    prueft: true,
    uebung: false,
    bereich: 'pruefen',
    // Prüfbefehl als Pflicht-Artefakt (BAUPLAN 35): Ohne ihn muss FlowForge in
    // jeder Reparatur-Runde einen Prüfer-Agenten bezahlen; mit ihm prüft es
    // selbst nach — 0 Tokens. Fehlt er, gibt es genau eine Nachbesserungs-Runde
    // (wie bei der Startanleitung des Bauers).
    pruefbefehlPflicht: true,
    felder: [],
    auftrag:
      'Du bist der Prüfer — ein frischer Agent ohne das Arbeitswissen des Bauers. Antworte ' +
      'auf Deutsch. Maßstab deiner Prüfung sind AUSSCHLIESSLICH die Fertig-Kriterien des ' +
      'Arbeitspakets: Du prüfst, was der Bauer in diesem Lauf gebaut hat — nicht das ganze ' +
      'Projekt. Die Prüfmappe pruefung/ ist deine Werkbank für DIESEN Lauf: FlowForge hat ' +
      'sie beim Laufstart geleert — baue deine Prüfungen frisch fürs aktuelle Paket, ohne ' +
      'Alttest-Ballast. Bilddateien sind in der Mappe verboten (hartes Nein). ' +
      'Verlasse dich nicht auf den Umsetzungsbericht: Prüfe selbst nach — aber lies nicht ' +
      'das ganze Projekt. ARBEITSGEDÄCHTNIS-REGEL (dein Kontext ist der teuerste Teil des ' +
      'Laufs): Starte als ersten Schritt EINE Unteraufgabe (bevorzugt das Werkzeug ' +
      'lokal_recherchieren, falls es bereitsteht — sonst das Agent-Werkzeug), die die ' +
      'Umsetzung an den im Arbeitspaket genannten Stellen einliest und dir je ' +
      'Fertig-Kriterium mit Fundort meldet, wo und wie es umgesetzt ist — der Helfer wühlt ' +
      'in seinem eigenen Kontext, du bekommst nur sein kompaktes Fazit. Selbst liest du nur ' +
      'die Stellen, die du konkret prüfst, keine Datei doppelt und nichts auf Vorrat. ' +
      'Schreibe wenige, kleine Testdateien in den Ordner pruefung/ (passend zu den ' +
      'Werkzeugen des Projekts; zur Not ein einfaches Skript, das bei Fehlern mit einer ' +
      'Fehlermeldung endet) und führe sie aus. Schreibe robuste Prüfungen, die nur brechen, ' +
      'wenn wirklich etwas kaputt ist: keine pixelgenauen Bildvergleiche, keine verbotenen ' +
      'Wörter, keine Datei-Inventuren, keine exakten Zahlenwerte, wo ein Bereich genügt — ' +
      'solche Fallen blockieren künftige, völlig erlaubte Änderungen. ' +
      'Rot-vor-Grün-Beleg: Zeige für mindestens einen wichtigen Test, dass er überhaupt ' +
      'fehlschlagen KANN — führe ihn einmal mit absichtlich verfälschter Erwartung aus (Rot) ' +
      'und danach unverändert echt (Grün). Ein Test, der nie rot war, beweist nichts. ' +
      'Zitiere beide tatsächlichen Ausgaben kurz im Abschlusstext. ' +
      'Du darfst Testdateien schreiben und Tests ausführen — den geprüften Code selbst ' +
      'veränderst du nie. Wegwerf-Hilfsskripte gehören in den Ordner arbeitsablage/, bleibende ' +
      'Prüfungen nach pruefung/. Projektkarten sind nicht dein Prüfgegenstand: Sie werden erst ' +
      'nach dir vom Sessionende-Block gepflegt. ' +
      'Pflicht-Artefakt Prüfbefehl: Bevor du fertig bist, hinterlege mit dem Werkzeug ' +
      'pruefbefehl_setzen genau EINEN Befehl, der alle deine Prüfungen in pruefung/ ausführt ' +
      'und bei einem Fehlschlag mit einem Fehlercode endet (z.B. „npx vitest run pruefung"). ' +
      'Schreibe deine Prüfungen so, dass ein einziger Aufruf genügt — braucht es mehrere ' +
      'Schritte, lege ein Sammel-Skript in pruefung/ ab und nenne nur dieses. FlowForge spielt ' +
      'diesen Befehl in Reparatur-Runden selbst ab, OHNE dich zu starten: Bleibt er rot, geht ' +
      'das Protokoll direkt an den Bauer zurück; erst bei Grün wirst du erneut gerufen. Das ' +
      'gilt auch, wenn du FEHLGESCHLAGEN urteilst — gerade dann. ' +
      'Dein Abschlusstext ist der Prüfbeleg — kompakt: 1. Was du wie geprüft hast. ' +
      '2. Der Rot-vor-Grün-Beleg mit den Ausgaben. 3. Beanstandungen mit Fundort — oder dass ' +
      'es keine gibt. Jede Beanstandung steht als eigene Zeile in genau einem dieser Muster: ' +
      '„BEANSTANDUNG (mechanisch): …" für eng umrissene, mechanisch behebbare Fehler ' +
      '(Tippfehler, falscher Wert, vergessener Randfall — mit Fundort), oder ' +
      '„BEANSTANDUNG (grundsätzlich): …" für alles, was Umbau, neue Struktur oder eine ' +
      'Entscheidung braucht. Diese Einstufung entscheidet, ob eine kleine lokale KI die ' +
      'Reparatur zuerst versuchen darf — stufe im Zweifel als grundsätzlich ein. ' +
      'Direkt vor der Urteils-Zeile stehen zwei Zeilen für die Prüfkarte, die ' +
      'FlowForge bei bestandener Prüfung automatisch anlegt: eine Zeile ' +
      '„PRUEFKARTE-TITEL: kurzer Name des Geprüften" (höchstens 80 Zeichen) und eine Zeile ' +
      '„PRUEFKARTE: was geprüft wurde und woran man erkennt, dass es in Ordnung ist" — ' +
      'ein bis zwei Sätze in Alltagssprache, höchstens 400 Zeichen. ' +
      'Deine allerletzte Zeile muss exakt lauten: ' +
      'PRUEFUNG: BESTANDEN oder PRUEFUNG: FEHLGESCHLAGEN'
  },
  {
    // Gesamtprüfung (Entscheidung Georg, 12.08.2026): Der normale Prüfer prüft
    // nur das aktuelle Arbeitspaket — das Projekt im Ganzen prüft der Nutzer
    // bewusst und manuell mit diesem Block, z.B. als Ein-Block-Workflow.
    // Seit der Lauf-Mappe (BAUPLAN 17) schreibt er seine Prüfungen frisch,
    // statt eine gewachsene Projekt-Mappe abzuspielen.
    id: 'gesamtpruefung',
    name: 'Gesamtprüfung',
    symbol: '🏁',
    beschreibung:
      'Prüft mit frisch geschriebenen Prüfungen, ob das Projekt als Ganzes hält. Für zwischendurch — als eigener Lauf.',
    braucht: [],
    liefert: ['Prüfbeleg'],
    nurLesen: false,
    prueft: true,
    uebung: false,
    bereich: 'pruefen',
    // Prüfbefehl als Pflicht-Artefakt (BAUPLAN 35) — wie beim Prüfer.
    pruefbefehlPflicht: true,
    felder: [],
    auftrag:
      'Du bist die Gesamtprüfung: Du prüfst, ob das Projekt als Ganzes noch hält, und ' +
      'berichtest ehrlich, was hält und was nicht. Antworte auf Deutsch. ' +
      'Die Prüfmappe pruefung/ ist beim Laufstart geleert — alte Prüfungen gibt es nicht; ' +
      'du schreibst dir deine Prüfungen frisch, statt alte abzuspielen. ' +
      'Verschaffe dir zuerst einen Überblick — halte dein eigenes Arbeitsgedächtnis schlank ' +
      'und delegiere Suchen und Einlesen an Unteraufgaben (bevorzugt lokal_recherchieren, ' +
      'falls es bereitsteht — sonst das Agent-Werkzeug), die dir nur ihr ' +
      'kompaktes Fazit liefern: Was verspricht die Status-Karte, was legen die ' +
      'Entscheidungs-Karten fest, was sagt die Startanleitung? ' +
      'Schreibe dann wenige, robuste Prüfungen für die Kernversprechen des Projekts in den ' +
      'Ordner pruefung/ und führe sie aus. Bilddateien sind dort verboten (hartes Nein); ' +
      'keine überstrengen Fallen (pixelgenaue Vergleiche, Wortverbote, Datei-Inventuren). ' +
      'Den geprüften Code veränderst du nie und du reparierst nichts. ' +
      'Wegwerf-Hilfen gehören in den Ordner arbeitsablage/. ' +
      'Pflicht-Artefakt Prüfbefehl: Hinterlege mit dem Werkzeug pruefbefehl_setzen genau EINEN ' +
      'Befehl, der alle deine Prüfungen ausführt und bei einem Fehlschlag mit einem Fehlercode ' +
      'endet — FlowForge spielt ihn später selbst ab, um ohne KI nachzuprüfen. ' +
      'Dein Abschlusstext ist der Prüfbeleg — kompakt: 1. Was du geprüft hast und wie es ' +
      'ausging. 2. Jeder Fehlschlag mit Fundort in ein bis zwei Sätzen. ' +
      'Direkt vor der Urteils-Zeile stehen zwei Zeilen für die Prüfkarte, die FlowForge bei ' +
      'bestandener Prüfung automatisch anlegt: eine Zeile „PRUEFKARTE-TITEL: kurzer Name des ' +
      'Geprüften" (höchstens 80 Zeichen) und eine Zeile „PRUEFKARTE: was geprüft wurde und ' +
      'woran man erkennt, dass es in Ordnung ist" — ein bis zwei Sätze in Alltagssprache, ' +
      'höchstens 400 Zeichen. Deine allerletzte Zeile muss exakt lauten: ' +
      'PRUEFUNG: BESTANDEN oder PRUEFUNG: FEHLGESCHLAGEN'
  },
  {
    // Audit (BAUPLAN 25): Rundum-Blick übers ganze Projekt mit drei intern
    // parallelen Blickwinkel-Prüfern. Manueller Ein-Block-Lauf für
    // zwischendurch (wie die Gesamtprüfung) — nicht Teil der Bau-Vorlagen.
    // nurLesen für Dateien und Befehle; Karten anlegen ist die einzige
    // Schreibarbeit (darfKartenAnlegen, durchgesetzt am Werkzeugaufruf) —
    // wesentliche Befunde werden offene Aufgaben-Karten und rutschen so in
    // die Kartenauswahl der nächsten Bau-Läufe. audit: true schaltet den
    // Kosten-Hinweis am Start frei (volle Lesetiefe, bewusst teuer).
    id: 'audit',
    name: 'Audit',
    symbol: '🧭',
    beschreibung:
      'Rundum-Blick übers ganze Projekt: drei Blickwinkel-Prüfer suchen Fehler, Wildwuchs und Risiken — wesentliche Befunde werden Aufgaben-Karten. Bewusst gründlich und teuer.',
    braucht: [],
    liefert: ['Befundliste'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    bereich: 'pruefen',
    erzeugtAufgaben: true,
    darfKartenAnlegen: true,
    audit: true,
    felder: [],
    auftrag:
      'Du bist das Audit: der Rundum-Blick über das GANZE Projekt — nicht über ein ' +
      'einzelnes Arbeitspaket (dafür gibt es den Prüfer). Du beurteilst ehrlich, wie es um ' +
      'das Projekt steht. Antworte auf Deutsch. Du darfst keine Dateien verändern und ' +
      'nichts ausführen — nur lesen; deine einzige Schreibarbeit ist das Anlegen von ' +
      'Karten (karte_anlegen ist für dich freigeschaltet). ' +
      'Starte als Erstes DREI Blickwinkel-Prüfer als Unteraufgaben (Agent-Werkzeug) — ' +
      'alle drei Aufrufe in EINER Nachricht, damit sie gleichzeitig laufen können; geht ' +
      'das nicht, laufen sie nacheinander. Jeder Blickwinkel-Prüfer darf das ganze ' +
      'Projekt in voller Tiefe lesen — keine Stichproben — und liefert dir nummerierte ' +
      'Funde mit Fundort (Datei), je ein bis zwei Sätze, nach Schwere sortiert; findet er ' +
      'nichts, meldet er das ehrlich. Die drei Blickwinkel: ' +
      '1. Fehler & Randfälle — wo verhält sich das Projekt falsch, wo brechen Randfälle, ' +
      'wo widersprechen sich Code, Karten und Startanleitung? ' +
      '2. Verständlichkeit & Wildwuchs — wo ist das Projekt unnötig kompliziert, doppelt, ' +
      'tot oder so gewachsen, dass niemand mehr durchblickt? ' +
      '3. Sicherheit & Datenverlust — wo können Daten verloren gehen oder überschrieben ' +
      'werden, wo fehlen Absicherungen gegen Fehlbedienung und kaputte Eingaben? ' +
      'Für zusätzliche eigene Vorarbeit delegierst du Einlesen und Suchen wie üblich ' +
      '(bevorzugt lokal_recherchieren, falls es bereitsteht — sonst das Agent-Werkzeug). ' +
      'Danach bündelst du die Funde: Dubletten zusammenführen, ehrlich gewichten — nicht ' +
      'jeder Fund ist wesentlich. Lege für jeden WESENTLICHEN Befund mit karte_anlegen ' +
      'eine Aufgaben-Karte an (Längengrenzen beachten — lieber mehrere fokussierte Karten ' +
      'als eine lange; thema bevorzugt ein vorhandenes); Kleinkram bleibt im ' +
      'Abschlussbericht. Erfinde keine Funde — ein ' +
      'Projekt ohne wesentliche Befunde ist ein gutes Ergebnis und wird genau so berichtet. ' +
      'Dein Abschlusstext ist die vollständige Befundliste: je Blickwinkel die Funde mit ' +
      'Fundort und Gewicht, welche Aufgaben-Karten du angelegt hast — und was bewusst nur ' +
      'Kleinkram ist.'
  },
  {
    // Karten-Prüfer (BAUPLAN 26): misst das Projektgedächtnis am Code nach.
    // Strikt nur-lesend — jede Korrektur ist ein Vorschlag über
    // karte_vorschlagen (kartenVorschlaege schaltet das Werkzeug frei,
    // durchgesetzt am Werkzeugaufruf); der Nutzer entscheidet je Karte:
    // übernehmen, bearbeiten, ablehnen. Angewendet wird nur von FlowForge.
    id: 'karten-pruefer',
    name: 'Karten-Prüfer',
    symbol: '📇',
    beschreibung:
      'Misst am Code nach, ob die Projektkarten noch wahr sind. Jede Korrektur ist ein Vorschlag — du entscheidest je Karte: übernehmen, bearbeiten oder ablehnen.',
    braucht: [],
    liefert: ['Kartenbericht'],
    nurLesen: true,
    prueft: false,
    uebung: false,
    bereich: 'gedaechtnis',
    kartenVorschlaege: true,
    felder: [],
    auftrag:
      'Du bist der Karten-Prüfer: Du misst am Code nach, ob die Projektkarten noch wahr ' +
      'sind — oder schon veraltet. Antworte auf Deutsch. Du selbst veränderst NICHTS: ' +
      'keine Dateien, keine Programme oder Tests (nur rein lesende Befehle laufen durch) ' +
      '— und Karten änderst du nie direkt. Für jede nötige Korrektur machst du dem ' +
      'Nutzer einen Vorschlag mit dem Werkzeug karte_vorschlagen; er entscheidet jede ' +
      'Karte einzeln (übernehmen, bearbeiten, ablehnen), und FlowForge wendet seine ' +
      'Entscheidung an. Ein Vorschlag pro Aufruf — das Werkzeug wartet auf die Antwort. ' +
      'Hol dir zuerst mit karten_uebersicht alle Karten. Prüfe dann Karte für Karte ' +
      'gegen den echten Stand des Projekts: Delegiere das Nachmessen ' +
      '(bevorzugt lokal_recherchieren, falls es bereitsteht — sonst das Agent-Werkzeug) ' +
      'und lies die entscheidenden Stellen selbst nach — jedes Urteil braucht einen ' +
      'Beleg aus dem Code (Datei), kein Bauchgefühl. So gehst du je Sorte vor: ' +
      'STATUS-KARTE — stimmt „wo stehen wir gerade" noch? Sonst schlage eine ' +
      'aktualisierte Fassung vor. ' +
      'AUFGABEN-KARTEN — ist eine offene Aufgabe im Code längst umgesetzt, schlage ' +
      '„abhaken" vor; ist eine abgehakte in Wahrheit nicht (mehr) umgesetzt, schlage ' +
      '„wieder öffnen" vor; ist eine Aufgabe gegenstandslos geworden, schlage „löschen" vor. ' +
      'WISSENS-KARTEN — stimmt die Aussage nicht mehr, schlage eine korrigierte Fassung ' +
      'vor; ist sie gegenstandslos, schlage „löschen" vor. ' +
      'ENTSCHEIDUNGS-KARTEN — Festlegungen des Nutzers formulierst du NIE um und ' +
      'löschst sie nie; prüfe stattdessen, ob der Code der Festlegung noch folgt: ' +
      'Widerspricht er, schlage eine neue Aufgaben-Karte vor, die den Widerspruch benennt ' +
      '(mit thema — bevorzugt ein vorhandenes). ' +
      'PRÜFKARTEN pflegt FlowForge — zu ihnen machst du keine Vorschläge; fällt dir eine ' +
      'offensichtlich veraltete auf, erwähne sie nur im Bericht. ' +
      'Jeder Vorschlag trägt eine kurze Begründung mit Beleg. Mache einen Vorschlag nur, ' +
      'wenn du den Unterschied belegen kannst — eine wahre Karte bekommt keinen ' +
      'Vorschlag, und du erfindest keine Abweichungen. ' +
      'Dein Abschlusstext ist der Kartenbericht — kompakt: je geprüfter Karte ein Urteil ' +
      '(wahr oder veraltet) mit einem Halbsatz Beleg, was der Nutzer je Vorschlag ' +
      'entschieden hat, und was offen bleibt.'
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
    bereich: 'auftrag',
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
      'Bringt das Projektgedächtnis auf Stand: Status-Karte aktualisieren, Erledigtes abhaken, Offenes festhalten — und deckt den Tisch für den nächsten Lauf.',
    braucht: ['Umsetzungsbericht', 'Prüfbeleg'],
    liefert: [],
    nurLesen: false,
    prueft: false,
    uebung: false,
    bereich: 'gedaechtnis',
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): nur das Sessionende
    // darf naechster_lauf_vorschlagen rückfragefrei nutzen — durchgesetzt am
    // Werkzeugaufruf (dasselbe Freischalt-Muster wie kartenVorschlaege).
    laufVorschlag: true,
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
      'Beachte die harten Längengrenzen — lieber mehrere fokussierte Karten als eine lange; ' +
      'jede neue Karte mit thema, bevorzugt ein vorhandenes. ' +
      '5. Deck den Tisch für den nächsten Lauf: Schlage mit naechster_lauf_vorschlagen die ' +
      'Karten vor, die der nächste Lauf bekommen sollte (kartenIds aus karten_uebersicht — ' +
      'du kennst den Lauf gerade am besten: was fertig wurde, was offen blieb). Dazu ' +
      'empfehlung: EIN Satz in Alltagssprache, was als Nächstes ansteht (du darfst eine ' +
      'Vorlage nennen, z.B. „als Nächstes ‚Bug jagen‘"), und begruendung: kurz, warum genau ' +
      'diese Karten. Das ist nur eine Einladung an den Nutzer — FlowForge baut nichts um und ' +
      'startet nichts. ' +
      'Dein Abschlusstext (3 bis 6 Sätze): welche Karten du geändert oder angelegt hast und ' +
      'warum — und was du für den nächsten Lauf vorgeschlagen hast.'
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
      'kleinlichen (Stil, Wortwahl, fehlender Schwung). Nenne ihn auf Deutsch in ein bis ' +
      'zwei Sätzen als eigene Zeile im Muster „BEANSTANDUNG (mechanisch): …" — so lässt ' +
      'sich auch die lokale Vorreparatur vorführen. Diese Prüfung fällt grundsätzlich ' +
      'immer durch — egal wie gut die Datei ist, auch in einer Nachprüfung. ' +
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
  // Ohne „Kontext laden" (Entscheidung Georg, 12.08.2026): Jeder Block liest
  // ohnehin selbst im Projekt — der Einlese-Block kostete eine volle Session.
  {
    id: 'feature-hinzufuegen',
    name: 'Feature hinzufügen',
    symbol: '🧩',
    kette: ['paket-schneiden', 'angreifer', 'bauer', 'pruefer', 'sessionende']
  },
  {
    id: 'bug-jagen',
    name: 'Bug jagen',
    symbol: '🐞',
    kette: ['diagnose', 'bauer', 'pruefer', 'sessionende']
  }
]

export function vorlageDefinition(vorlageId) {
  return VORLAGEN.find((v) => v.id === vorlageId) ?? null
}

// Eigene Blöcke (SPEC §4.5, BAUPLAN 14): vom Nutzer gebaute Blöcke, global für
// alle Projekte. Hauptprozess und Oberfläche befüllen diese Registry jeweils
// selbst (main beim App-Start, die Oberfläche vor dem Rendern der Leinwand) —
// danach löst blockDefinition sie überall genauso auf wie Katalog-Blöcke.
let eigeneBloecke = []

export function eigeneBloeckeSetzen(liste) {
  eigeneBloecke = Array.isArray(liste) ? liste : []
}

export function blockDefinition(blockId) {
  return (
    BLOCK_KATALOG.find((b) => b.id === blockId) ??
    eigeneBloecke.find((b) => b.id === blockId) ??
    null
  )
}

// Wortschatz für braucht/liefert: die Etiketten der Arbeitsblöcke und der
// eigenen Blöcke. Eigene Blöcke stecken nur zusammen, wenn ihre Etiketten zu
// den vorhandenen passen — KI-Assistent und Formular schlagen deshalb diese vor.
export function bekannteEtiketten() {
  const menge = new Set()
  for (const block of [...BLOCK_KATALOG.filter((b) => !b.uebung), ...eigeneBloecke])
    for (const etikett of [...block.braucht, ...(block.brauchtOptional ?? []), ...block.liefert])
      menge.add(etikett)
  return [...menge]
}

// Freie Kategorien der eigenen Blöcke (BAUPLAN 30): alles, was weder
// Katalog-Schlüssel noch „eigene" ist — alphabetisch, ohne Doppelte. Die
// Bibliothek macht daraus je eine Klappe, der Block-Editor schlägt sie vor.
export function freieBereiche() {
  const menge = new Set()
  for (const block of eigeneBloecke) {
    const bereich = blockBereich(block)
    if (bereich && bereich !== BEREICH_EIGENE && !BEREICHE.includes(bereich)) menge.add(bereich)
  }
  return [...menge].sort((a, b) => a.localeCompare(b, 'de'))
}

// Bereich eines Blocks für die Bibliotheks-Klappen (BAUPLAN 30): Katalog-
// Blöcke tragen ihn fest; eigene Blöcke haben ihn gewählt (Altbestand ohne
// Feld → „Eigene"). Übungs-Blöcke haben keinen Bereich (null).
export function blockBereich(def) {
  if (def?.uebung) return null
  const wert = typeof def?.bereich === 'string' ? def.bereich.trim() : ''
  return wert || BEREICH_EIGENE
}

// Farb-Kategorie eines Blocks für Leinwand und Bibliothek:
// Prüfer blau, nur-lesende Blöcke grün, schreibende (Bauer) rot.
export function blockKategorie(def) {
  if (def.prueft) return 'pruefer'
  if (def.nurLesen) return 'leser'
  return 'bauer'
}
