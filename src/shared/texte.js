// Alle Oberflächen-Texte zentral an einem Ort (Deutsch; weitere Sprachen in V2).

// Dauer in Alltagssprache (BAUPLAN 51): Sekunden nur unter einer Minute —
// gebraucht von den Metriken („davon lokal", Ø-Dauer) und dem Laufbericht.
function dauerKurz(ms) {
  const sekunden = Math.round(ms / 1000)
  if (!Number.isFinite(sekunden) || sekunden < 0) return '—'
  if (sekunden < 60) return `${sekunden} s`
  return `${Math.round(sekunden / 60)} Min`
}

export const texte = {
  fensterTitel: 'FlowForge',
  // Kopfleiste = Titelleiste der dunklen Werkbank (Mockup-Runden 3+4).
  kopfleiste: {
    werkbank: 'WERKBANK',
    zuProjekten: 'Projekte',
    // Metriken (BAUPLAN 31): Knopf in der Titelleiste → globale Seite.
    metrikenKnopf: 'Metriken',
    // Co-Pilot (BAUPLAN 33): Knopf in der Titelleiste → seitliches Chat-Fenster.
    chatKnopf: 'Co-Pilot'
  },
  // Metriken (BAUPLAN 31): lokale KI und Motor über alle Läufe hinweg — nur
  // Nachschlagewerk; nichts davon wandert je in einen Auftrag.
  metriken: {
    ueberschrift: 'Metriken',
    untertitel:
      'Was die lokale KI taugt und was der Motor kostet — über alle Läufe hinweg. Nur zum ' +
      'Nachschlagen; kein Lauf-Agent bekommt diese Zahlen zu sehen. Einzige Ausnahme: Der ' +
      'Co-Pilot kennt die „Lokale Bilanz" (was lokal gut lief), um dich zu beraten — in ' +
      'einen Lauf-Auftrag wandert davon nichts.',
    aktualisieren: 'Aktualisieren',
    laedt: 'Metriken werden gelesen …',
    filterAlle: 'Alle Projekte',
    fehlendeProjekte: (pfade) =>
      `Nur bekannte Projekte: ${pfade.length} ${pfade.length === 1 ? 'Projekt fehlt' : 'Projekte fehlen'} (Ordner nicht gefunden) — ${pfade.join(' · ')}`,
    // Abschnitt 1: lokale KI.
    lokaleUeberschrift: 'Lokale KI',
    lokaleErklaerung:
      'Jedes Urteil über lokale Arbeit zählt: Recherche-Fazit übernommen oder verworfen, Entwurf übernommen oder verworfen, Reparatur gehalten oder nicht, Teilstück gehalten oder nicht — dazu Kreisläufe, die ohne Ergebnis gescheitert sind. Gezählt seit Bauschritt 31; ältere Läufe stehen hier nicht.',
    lokaleLeer: 'Noch keine Urteile — die lokale KI war seit Bauschritt 31 noch nicht im Einsatz.',
    lokaleLeerGefiltert: 'Für dieses Projekt gibt es noch keine Urteile über die lokale KI.',
    spalteModell: 'Modell',
    spalteBereich: 'Bereich',
    spalteAnzahl: 'Urteile',
    spalteQuote: 'Quote',
    spaltePositiv: 'übernommen / gehalten',
    spalteNegativ: 'verworfen / nicht gehalten',
    spalteGescheitert: 'gescheitert',
    spalteSchritte: 'Ø Schritte',
    spalteZeitraum: 'Zeitraum',
    bereiche: { recherche: 'Recherche', entwurf: 'Entwurf', reparatur: 'Reparatur', bauen: 'Bauen' },
    keineQuote: '—',
    quoteHinweis: 'Quote = Anteil übernommen/gehalten an allen beurteilten (gescheiterte Kreisläufe zählen nicht mit).',
    // Abschnitt 2: Motor.
    motorUeberschrift: 'Motor',
    motorErklaerung:
      'Aus den Laufberichten aller bekannten Projekte — die Zahlen liegen dort exakt vor, auch für alte Läufe. Kosten sind theoretische API-Kosten; im Abo-Modus nur zur Einordnung.',
    motorLeer: 'Noch keine Laufberichte.',
    gesamtZeile: (g) =>
      `${g.anzahl} ${g.anzahl === 1 ? 'Lauf' : 'Läufe'} · ${g.tokens.toLocaleString('de-DE')} Tokens` +
      (g.mitKosten > 0 ? ` · ${g.kostenUsd.toFixed(2).replace('.', ',')} $ theoretische Kosten` : '') +
      (g.ohneKosten > 0 ? ` (${g.ohneKosten} ${g.ohneKosten === 1 ? 'Lauf' : 'Läufe'} ohne Kostenangabe)` : '') +
      // „Davon lokal" (BAUPLAN 51): lokale Tokens stehen als Beschriftung
      // NEBEN der Gesamtsumme — nie still herausgerechnet, Altberichte
      // widersprächen sonst. Der Abo-Anteil ist gesamt minus lokal.
      texte.metriken.davonLokalZusatz(g),
    davonLokalZusatz: (g) =>
      g.lokalTokens > 0
        ? ` · davon lokal: ${g.lokalTokens.toLocaleString('de-DE')} Tokens` +
          (g.mitLokalDauer > 0 ? `, ${dauerKurz(g.lokalDauerMs)}` : '') +
          (g.ohneLokalDauer > 0
            ? ` (${g.ohneLokalDauer} ${g.ohneLokalDauer === 1 ? 'Lauf' : 'Läufe'} ohne Dauer-Angabe)`
            : '') +
          ` · Abo-Anteil: ${Math.max(0, g.tokens - g.lokalTokens).toLocaleString('de-DE')} Tokens`
        : '',
    ohneKosten: 'ohne Kosten',
    ohneVerbrauch: 'ohne Verbrauch',
    ohneAngabe: (n, was) => `${n} ${was}`,
    jeBlockUeberschrift: 'Je Blocktyp',
    jeBlockErklaerung:
      'Erstlauf = der erste Anlauf eines Blocks im Lauf. Wiederholungen (Reparatur-Runden, Nachprüfungen, Nachforderungen) stehen getrennt — sonst verzerren sie den Durchschnitt.',
    spalteBlock: 'Block',
    spalteErstlaeufe: 'Erstläufe',
    spalteTokensDurchschnitt: 'Ø Tokens',
    spalteKostenDurchschnitt: 'Ø Kosten',
    spalteWiederholungen: 'Wiederholungen',
    jeKetteUeberschrift: 'Je Workflow-Kette',
    spalteKette: 'Kette',
    spalteLaeufe: 'Läufe',
    spalteTokensGesamt: 'Tokens gesamt',
    spalteKostenGesamt: 'Kosten gesamt',
    jeProjektUeberschrift: 'Je Projekt',
    spalteProjekt: 'Projekt',
    jeWocheUeberschrift: 'Zeitverlauf je Woche',
    jeWocheErklaerung: 'Wird es billiger? Tokens je Kalenderwoche als Balken; darunter Läufe und Kosten.',
    wocheLabel: (nummer, von, bis) => `KW ${nummer} (${von}–${bis})`,
    wocheZeile: (w) =>
      `${w.anzahl} ${w.anzahl === 1 ? 'Lauf' : 'Läufe'} · ${w.tokens.toLocaleString('de-DE')} Tokens` +
      (w.mitKosten > 0 ? ` · ${w.kostenUsd.toFixed(2).replace('.', ',')} $` : '') +
      (w.ohneKosten > 0 ? ` (${w.ohneKosten} ohne Kosten)` : '') +
      (w.lokalTokens > 0 ? ` · davon lokal: ${w.lokalTokens.toLocaleString('de-DE')}` : ''),
    // „Davon lokal" als Spalte (Ketten-/Projekt-Tabellen) und im Laufbericht
    // (Leinwand liest diese Texte mit — sie gehören zur Kontingent-Sicht).
    spalteDavonLokal: 'davon lokal',
    spalteDauerDurchschnitt: 'Ø Dauer',
    ohneDauer: 'ohne Dauer-Angabe',
    dauerText: (ms) => dauerKurz(ms),
    davonLokalZeile: (lokal) =>
      `Davon lokal (kostet kein Kontingent): ${Number(lokal.tokens ?? 0).toLocaleString('de-DE')} Tokens` +
      (Number.isFinite(lokal.dauerMs) && lokal.dauerMs > 0 ? ` · ${dauerKurz(lokal.dauerMs)}` : ''),
    blockDauer: (ms) => `Dauer: ${dauerKurz(ms)}`,
    sonderlaufMarke: 'Sonderlauf',
    // Harness-Kennzahlen (BAUPLAN 36): Wie gut trägt das Gerüst? Score UND
    // Kosten messen. Alles rückwirkend aus den Laufberichten gerechnet.
    harnessUeberschrift: 'Wie gut trägt das Gerüst',
    harnessErklaerung:
      'Nicht was es kostet, sondern was es taugt: Wie oft besteht der Prüfer beim ersten Mal, wie viele Reparatur-Runden braucht ein Lauf, wie oft muss FlowForge dich fragen. Aus denselben Laufberichten wie oben — auch rückwirkend.',
    harnessErstbestehen: 'Prüfer besteht beim ersten Mal',
    harnessErstbestehenHinweis: (mit, gesamt) =>
      `Anteil der Läufe, in denen jede Prüfung ihr erstes Urteil bestanden hat — gezählt über ${mit} von ${gesamt} ${gesamt === 1 ? 'Lauf' : 'Läufen'} mit Prüfung.`,
    harnessReparatur: 'Ø Reparatur-Runden je Lauf',
    harnessReparaturHinweis:
      'Gezählt als Prüf-Urteile „nicht bestanden" — jedes schickt den Lauf zurück zum Bauer oder löst die Folgen-Frage aus.',
    harnessRechte: 'Ø Rechte-Rückfragen je Lauf',
    harnessFolgen: 'Ø Folgen-Fragen je Lauf',
    harnessUebertraege: 'Ø Überträge je Lauf',
    harnessZusammenfassungen: 'Ø Zusammenfassungen je Lauf',
    harnessZusammenfassungenHinweis: (ohne) =>
      ohne > 0
        ? `Der Motor dampft sein Arbeitsgedächtnis selbst ein — erst seit Bauschritt 36 im Bericht; ${ohne} ältere ${ohne === 1 ? 'Lauf zählt' : 'Läufe zählen'} nicht mit.`
        : 'Der Motor dampft sein Arbeitsgedächtnis selbst ein — gezählt seit Bauschritt 36.',
    harnessJeKetteUeberschrift: 'Je Kette',
    harnessJeWocheUeberschrift: 'Je Kalenderwoche',
    spalteErstbestehen: 'Erstbestehen',
    spalteWoche: 'Woche',
    spalteReparaturRunden: 'Ø Reparatur-Runden',
    spalteFragen: 'Ø Fragen an dich',
    spalteAusgang: 'Ausgang',
    ausgangZeile: (ausgaenge, label) =>
      ausgaenge.length === 0 ? '—' : ausgaenge.map((a) => `${label(a.zustand)} ${a.anzahl}`).join(' · '),
    // Modell je Block (BAUPLAN 36).
    jeModellUeberschrift: 'Je Blocktyp × Modell',
    jeModellErklaerung:
      'Welches Modell hat den Block wirklich gearbeitet — und schafft es die Arbeit? Wiederholungen und Erstbestehen sind das „schafft es"-Signal. Läufe vor Bauschritt 36 (und Prüf-Runden, die FlowForge ohne Motor entschieden hat) stehen ehrlich als „ohne Modell".',
    keinModellHinweis: 'ohne Modell',
    // Denktiefe je Block (0.48.1): eigene Spalte in Blocktyp × Modell — die
    // Reparatur-Runden je Denktiefe sind die Zahl, an der Georg sie einstellt.
    spalteDenktiefe: 'Denktiefe',
    denktiefeOhne: '—',
    // Compaction sichtbar (BAUPLAN 36).
    zusammenfassungenLabel: 'Zusammenfassungen des Motors',
    // Urteil lokal vs. Abnahme (BAUPLAN 50): die Zahl, an der Georg entscheidet,
    // ob der lokale Prüfer bleibt. Aus den Laufberichten gerechnet — nur Läufe
    // seit Bauschritt 50 tragen die Felder; null statt 0, wo keine Paare sind.
    abnahmeUeberschrift: 'Lokaler Prüfer × Abnahme',
    abnahmeErklaerung:
      'Wie oft widerspricht der Claude-Prüfer dahinter dem Urteil des lokalen Prüfers — und wie oft dreht das Tor ohne KI ein lokales „bestanden" mechanisch? Je lokalem Prüfer und Abnahme zählt nur das erste Urteil der Abnahme im Lauf (Reparatur-Runden und Urteile aus dem Vor-Tor der Abnahme zählen nicht). Gezählt seit Bauschritt 50.',
    abnahmeLeer: 'Noch keine Paare — ein lokaler Prüfer mit Claude-Abnahme dahinter ist seit Bauschritt 50 noch nicht gelaufen.',
    abnahmeKachelWiderspruch: 'Abnahme widerspricht dem lokalen Prüfer',
    abnahmeKachelWiderspruchHinweis: (widersprueche, paare) =>
      paare > 0
        ? `${widersprueche} von ${paare} ${paare === 1 ? 'Paar' : 'Paaren'} (lokaler Prüfer → Claude-Abnahme).`
        : 'Noch kein Paar lokaler Prüfer → Claude-Abnahme.',
    abnahmeKachelTor: 'Tor widerspricht dem lokalen Prüfer',
    abnahmeKachelTorHinweis: (rot, nachspiele) =>
      nachspiele > 0
        ? `${rot} von ${nachspiele} ${nachspiele === 1 ? 'Nachspiel' : 'Nachspielen'}: Das lokale „bestanden" hielt dem eigenen Prüfbefehl nicht stand.`
        : 'Noch kein Nachspiel — gezählt, sobald ein lokaler Prüfer „bestanden" meldet und sein Prüfbefehl nachgespielt wird.',
    abnahmeQuoteMitZahlen: (quote, zaehler, nenner) => `${quote} (${zaehler}/${nenner})`,
    spalteLokalModell: 'lokales Modell',
    spalteAbnahmeModell: 'Abnahme-Modell',
    spaltePaare: 'Paare',
    spalteEinig: 'einig',
    spalteWidersprueche: 'Widersprüche',
    spalteWiderspruchQuote: 'Quote'
  },
  projektuebersicht: {
    ueberschrift: 'Projekte',
    leerHinweis: 'Noch keine Projekte.',
    leerUntertitel: 'Hier erscheinen deine Projekte als Kacheln, sobald du das erste anlegst.',
    neuesProjekt: 'Neues Projekt',
    oeffnen: 'Öffnen',
    nichtGefunden: 'Ordner nicht gefunden',
    nichtGefundenHinweis: 'Der Projektordner wurde verschoben oder gelöscht.',
    ausListeEntfernen: 'Aus der Übersicht entfernen',
    // Zustände auf den Kacheln (SPEC §9, BAUPLAN 15).
    kachelLaeuft: 'läuft …',
    kachelWartetAntwort: 'wartet auf deine Antwort',
    kachelWarteschlange: 'wartet in der Warteschlange',
    kachelLetzterLauf: (zeit) => `Letzter Lauf: ${zeit} —`,
    kachelKeinLauf: 'Noch kein Lauf.',
    // Hero-Kachel für den laufenden Lauf (Mockup 3a).
    heroLaeuft: 'Läuft',
    zumLauf: 'Zum Lauf →',
    zumGespraech: 'Zum Gespräch',
    kontextLabel: 'Kontext-Füllstand',
    verbrauchsHinweis: (aktiv, wartend) =>
      `Parallele Läufe vervielfachen den Verbrauch — ${aktiv} ${aktiv === 1 ? 'Lauf' : 'Läufe'} aktiv` +
      (wartend > 0 ? `, ${wartend} in der Warteschlange.` : '.')
  },
  neuesProjekt: {
    ueberschrift: 'Neues Projekt',
    nameFeld: 'Wie soll das Projekt heißen?',
    namePlatzhalter: 'z.B. Haushaltsplaner',
    ablageortFeld: 'Wo soll das Projekt gespeichert werden?',
    ablageortWaehlen: 'Ordner wählen …',
    ablageortHinweis: 'FlowForge legt dort einen eigenen Ordner mit dem Projektnamen an.',
    anlegen: 'Projekt anlegen',
    abbrechen: 'Abbrechen',
    fehlerKeinName: 'Bitte gib dem Projekt einen Namen.',
    fehlerKeinOrt: 'Bitte wähle einen Speicherort.',
    fehlerOrdnerExistiert: (pfad) =>
      `Dort gibt es schon einen Ordner mit diesem Namen (${pfad}). Bitte wähle einen anderen Namen oder Speicherort.`,
    fehlerNameUnbrauchbar: 'Aus diesem Namen lässt sich kein Ordnername machen. Bitte wähle einen anderen Namen.'
  },
  projektansicht: {
    leinwandTitel: 'Leinwand',
    // Tabs der Mittelspalte (Feedback Georg, 07.08.2026): Schaubild, Lauf,
    // Berichte und Sicherungspunkte gestapelt wurden unübersichtlich.
    tabSchaubild: 'Schaubild',
    tabLauf: 'Lauf',
    tabBerichte: 'Laufberichte',
    tabPunkte: 'Sicherungspunkte',
    // Metriken (BAUPLAN 31): dieselbe Seite wie in der Titelleiste, aufs Projekt vorgefiltert.
    tabMetriken: 'Metriken',
    // App-Tab (BAUPLAN 32): die Startanleitung läuft in FlowForge.
    tabApp: 'App',
    tabLaufLeer: 'Noch kein Lauf in dieser Sitzung. Starte den Workflow im Schaubild-Tab.',
    einstellungenKnopf: 'Projekt-Einstellungen',
    bibliothekTitel: 'Blockbibliothek',
    bibliothekHinweis: 'Zieh einen Block mit der Maus auf die Leinwand.',
    vorlagenTitel: 'Vorlagen',
    vorlageHinweis: 'Zieh die Vorlage auf die leere Leinwand — sie legt die ganze Kette fertig verbunden ab.',
    arbeitsbloeckeTitel: 'Arbeitsblöcke',
    eigeneBloeckeTitel: 'Eigene Blöcke',
    eigeneBloeckeHinweis:
      'Deine selbst gebauten Blöcke — sie stehen in allen Projekten zur Verfügung.',
    eigeneBloeckeLeer: 'Noch keine eigenen Blöcke. Bau dir einen mit dem Knopf oben.',
    uebungsbloeckeTitel: 'Übungs-Blöcke',
    // Klappen der Blockbibliothek (BAUPLAN 30): Anzeigenamen der festen
    // Bereiche aus blockKatalog.BEREICHE plus „Eigene" und „Übung".
    bereiche: {
      auftrag: 'Auftrag finden',
      bauen: 'Bauen',
      pruefen: 'Prüfen',
      gedaechtnis: 'Gedächtnis',
      eigene: 'Eigene',
      uebung: 'Übung'
    }
  },
  // Block-Editor mit KI-Assistent (SPEC §4.5, BAUPLAN 14).
  blockEditor: {
    neuerBlock: 'Neuer Block',
    ueberschriftNeu: 'Eigenen Block erstellen',
    ueberschriftBearbeiten: 'Block bearbeiten',
    schritt1Titel: 'Was soll der Block tun?',
    schritt2Titel: 'Was braucht und liefert er?',
    schritt3Titel: 'Rolle, Feinheiten & Modell',
    schritt4Titel: 'Probelauf-Vorschau',
    kiFeld: 'Beschreib in deinen Worten, was der Block tun soll',
    kiPlatzhalter: 'z.B. Ein Block, der alle Texte im Projekt auf Rechtschreibfehler durchsieht',
    kiKnopf: 'KI füllt das Formular aus',
    kiLaeuft: 'Die KI füllt das Formular aus …',
    kiHinweis:
      'Die KI füllt alle Formularfelder für dich aus — du kannst danach noch alles von Hand ändern. Oder du füllst die Felder gleich selbst aus.',
    nameFeld: 'Name',
    symbolFeld: 'Symbol (ein Emoji)',
    beschreibungFeld: 'Kurzbeschreibung für die Bibliothek',
    auftragFeld: 'Arbeitsauftrag an den Agenten',
    auftragHinweis:
      'Das ist die Anweisung, die der Agent bekommt. Sag klar, was er tun soll, was nicht — und was am Ende in seiner Ergebnis-Meldung stehen soll. Wie gemeldet wird, sagt FlowForge dem Agenten von selbst; du beschreibst nur den Inhalt.',
    brauchtFeld: 'braucht — Übergaben, die der Block von vorherigen Blöcken benötigt',
    brauchtHinweis:
      'Nur eintragen, was wirklich nötig ist: Der Block lässt sich dann nur hinter Blöcke stecken, die das liefern. Ohne „braucht" kann er auch am Anfang stehen.',
    liefertFeld: 'liefert — Etikett für das Ergebnis dieses Blocks',
    liefertHinweis:
      'Unter diesem Etikett bekommen spätere Blöcke die Ergebnis-Meldung dieses Blocks gereicht. Nutze möglichst die vorgeschlagenen Etiketten — dann passt der Block zu den vorhandenen, und bei „Arbeitspaket", „Prüfbeleg", „Umsetzungsbericht", „Angriffsliste", „Befundliste" und jedem eigenen Etikett mit Feldern (Klappe „Etiketten" in der Bibliothek) meldet der Agent sogar in geprüften Feldern statt als Fließtext.',
    etikettPlatzhalter: 'Etikett eintippen oder Vorschlag wählen …',
    etikettHinzufuegen: 'Hinzufügen',
    // Empfänger im Auftrag (BAUPLAN 43, „Kein Kennzeichen ohne Editor-Feld"):
    // Je braucht-Etikett ein Satz aus der Sicht DIESES Blocks — er landet im
    // Auftrag des Blocks, der das Etikett liefert („Er misst deine Arbeit …").
    brauchtWozuUeberschrift: 'Wozu braucht dein Block das?',
    brauchtWozuHinweis:
      'Je Etikett ein Satz aus der Sicht deines Blocks — er steht später im Auftrag des Blocks, der es liefert, hinter „Er …". Beispiel: „misst deine Arbeit an den Fertig-Kriterien — schreib sie so, dass er jedes bei dir findet". Lässt du es leer, steht dort nur, dass dein Block das Etikett verlangt.',
    brauchtWozuFeld: (etikett) => `„${etikett}" — Er …`,
    brauchtWozuPlatzhalter: 'z.B. misst deine Arbeit an den Fertig-Kriterien des Arbeitspakets',
    // brauchtOptional (BAUPLAN 48): Übergaben, die der Block nutzt, wenn sie
    // da sind — ohne Steck-Zwang. brauchtOptionalLabel ist das kurze Wort für
    // Fehlermeldungen (wie kette.brauchtLabel).
    brauchtOptionalLabel: 'braucht — falls da',
    brauchtOptionalFeld: 'braucht — falls da (optional)',
    brauchtOptionalHinweis:
      'Übergaben, die der Block gern nutzt, aber nicht verlangt: Liefert ein Block davor sie, bekommt er sie gereicht — sonst arbeitet er ohne. Der Block lässt sich also auch stecken, wenn niemand das liefert. Ein Etikett steht entweder hier oder oben bei „braucht", nicht in beiden.',
    // Prüfbeleg ohne Prüfer-Häkchen (BAUPLAN 48, Korrektur K21): Das Urteil
    // käme an, würde aber nicht ausgewertet.
    pruefbelegOhnePrueft: (etikett) =>
      `Ohne das Häkchen „Prüft" (Schritt 3) wertet FlowForge das Urteil in „${etikett}" nicht aus — „fehlgeschlagen" löst dann nichts aus: keine Reparatur-Runde, kein Tor, keine Prüfkarte.`,
    // Formularfelder an der Blockkarte (BAUPLAN 48): Eingaben, die Georg im
    // Schaubild tippt und die per {{id}} in den Auftrag wandern.
    felderUeberschrift: 'Felder an der Blockkarte',
    felderHinweis:
      'Felder erscheinen auf der Blockkarte im Schaubild — dort tippt man den Inhalt ein, und er landet im Arbeitsauftrag an der Stelle, wo der Platzhalter steht. Nur was der Block wirklich je Lauf anders braucht (z.B. „Was soll gebaut werden?"). Ein Pflicht-Feld hält den Start an, solange es leer ist.',
    feldLabel: 'Bezeichnung',
    feldPlatzhalter: 'Platzhalter-Text (grau im leeren Feld)',
    feldPflicht: 'Pflicht — leer hält der Start an',
    feldEntfernen: 'Feld entfernen',
    feldHinzufuegen: '+ Feld',
    feldIdHinweis: (id) => `Im Auftrag einsetzen als {{${id}}}`,
    feldIdEinfuegen: (id) => `{{${id}}} in den Auftrag einfügen`,
    feldIdImAuftrag: 'steht im Auftrag ✓',
    feldIdLeer: 'Gib dem Feld erst eine Bezeichnung — daraus entsteht der Platzhalter.',
    feldOhnePlatzhalterHinweis: (label) =>
      `„${label}" kommt im Auftrag noch nicht vor — ohne Platzhalter tippt man es ein, und nichts passiert damit.`,
    // Fremde Platzhalter (Korrektur K6): kein Fehler, nur ein Hinweis.
    fremderPlatzhalter: (namen) =>
      namen.length === 1
        ? `{{${namen[0]}}} hat kein Feld — bleibt so im Auftrag stehen.`
        : `${namen.map((n) => `{{${n}}}`).join(', ')} haben kein Feld — bleiben so im Auftrag stehen.`,
    // Kennzeichen eigener Blöcke (BAUPLAN 48, „Kein Kennzeichen ohne
    // Editor-Feld"): EINE Quelle für Name + Folgen-Hinweis je Kennzeichen —
    // Editor (Schritt 3) und KI-Assistent lesen beide hier. Reihenfolge und
    // Gruppen stehen in blockRegeln.KENNZEICHEN.
    kennzeichen: {
      nurLesen: {
        name: 'Sperre „darf nur lesen"',
        hinweis:
          'Der Block darf dann nichts verändern: kein Schreiben, keine verändernden Befehle (rein lesende laufen durch), kein Internet — nur lesen. Die sichere Wahl für alles, was nur ansehen und berichten soll. Nur-lesende Blöcke dürfen außerdem parallel zu einem schreibenden laufen.'
      },
      prueft: {
        name: 'Prüft',
        hinweis:
          'Der Block ist ein Prüfer: Er schreibt und führt Tests in seiner eigenen Prüfmappe aus und meldet ein Urteil im „Prüfbeleg". „Fehlgeschlagen" schickt den Lauf zur Reparatur zurück (so oft, wie die Reparatur-Runden am Schaubild erlauben), das Tor spielt seinen Prüfbefehl später ohne KI nach, und seine Beanstandungen werden Prüfkarten. Ein Prüfer muss schreiben dürfen — „nur lesen" geht nicht zusammen.'
      },
      fuehrtZusammen: {
        name: 'Führt zusammen',
        hinweis:
          'Für einen Block, der mehrere gleichartige Lieferungen zu einer macht (z.B. die Berichte von drei Bauern). Er bekommt dann ALLE Lieferungen seiner „braucht"-Etiketten statt nur der nächstgelegenen — und das Schaubild verlangt, dass mindestens zwei Blöcke vor ihm das Etikett liefern; sonst gäbe es nichts zusammenzuführen.'
      },
      pruefbefehlPflicht: {
        name: 'Prüfbefehl ist Pflicht',
        hinweis:
          'Nur für Prüfer: Der Block muss einen Prüfbefehl hinterlegen (den Befehl, der seine Tests startet) — sonst fordert FlowForge ihn einmal nach, statt den Lauf weiterzulassen. Mit Prüfbefehl kann das Tor die Prüfung später ohne KI wiederholen.'
      },
      startanleitungPflicht: {
        name: 'Startanleitung ist Pflicht',
        hinweis:
          'Macht den Block zum Bau-Block: Fehlt nach ihm eine Startanleitung (wie man das Projekt startet), fordert der Lauf sie in einer Nachbesserungs-Runde ein — und danach greift der Rauchtest (die App wird probeweise gestartet), er bekommt alle Baselines und die lokale Bauhilfe. Bei „nur lesen" könnte der Block sie nie anlegen.'
      },
      kartenZuteilung: {
        name: 'Teilt Karten zu',
        hinweis:
          'Der Block darf Aufgaben-Karten auf die nächsten Blöcke verteilen und schneidet damit das Arbeitspaket — so arbeitet „Paket schneiden". FlowForge prüft am Ende des Laufs, ob jedes zugeteilte Ziel gemeldet wurde. Dafür muss der Block „Arbeitspaket" liefern.'
      },
      erzeugtAufgaben: {
        name: 'Legt Aufgaben-Karten an',
        hinweis:
          'Der Block darf selbst Aufgaben-Karten anlegen — auch bei „nur lesen" (so arbeitet das Audit). Er zählt damit als Auftragsquelle: Seine neuen offenen Karten rutschen von selbst in die Kartenauswahl des Laufs, spätere Bau-Blöcke nehmen sie als Auftrag.'
      },
      kartenVorschlaege: {
        name: 'Schlägt Karten vor',
        hinweis:
          'Der Block darf dir Karten-Änderungen VORSCHLAGEN statt sie selbst zu machen — jeder Vorschlag kommt als Frage zu dir: übernehmen, bearbeiten oder ablehnen (so arbeitet der Karten-Prüfer). Für Blöcke, die das Projektgedächtnis nachmessen, ohne es eigenmächtig umzuschreiben.'
      },
      laufVorschlag: {
        name: 'Schlägt den nächsten Lauf vor',
        hinweis:
          'Am Ende darf der Block vorschlagen, welcher Workflow als Nächstes laufen sollte (mit Begründung). Du siehst den Vorschlag als Knopf und entscheidest — von selbst startet nichts.'
      },
      unteraufgabenWieBlock: {
        name: 'Unteraufgaben wie der Block selbst',
        hinweis:
          'Startet der Block Helfer für Unteraufgaben, arbeiten sie mit demselben Modell wie er — statt auf das sparsamere Modell aus den Einstellungen herabgestuft zu werden. Für Blöcke, deren Helfer der Kern der Arbeit sind (wie die Blickwinkel-Prüfer des Audits). Kostet entsprechend mehr.'
      },
      audit: {
        name: 'Audit-Hinweis',
        hinweis:
          'Nur ein Hinweis im Ticker beim Start: „bewusst gründlich und teuer". Sonst ändert das Häkchen nichts.'
      }
    },
    // Komfort-Reaktionen beim Anhaken (BAUPLAN 48) — die Regel selbst sitzt im
    // Hauptprozess (blockRegeln.pruefeVertraeglichkeit).
    feinheitenTitel: 'Feinheiten',
    feinheitenHinweis:
      'Selten nötig. Jedes Häkchen schaltet ein Werkzeug oder eine Pflicht frei, die sonst nur Katalog-Blöcke haben — der Hinweis daneben sagt, was es im Lauf bedeutet.',
    kennzeichenErgaenzt: (kennzeichen, etikett) =>
      `Weil „${kennzeichen}" gesetzt ist, steht jetzt „${etikett}" bei „liefert" (Schritt 2) — darüber kommt die Meldung bei FlowForge an.`,
    kennzeichenNurLesenAus: (kennzeichen) =>
      `„${kennzeichen}" braucht Schreibrechte — die Sperre „darf nur lesen" ist deshalb aus.`,
    // Prüfer-Befund 48: „nur lesen" bleibt beim Klick stehen, der Satz sagt den
    // Konflikt — entschieden wird beim Speichern (harte Regel mit Begründung).
    kennzeichenKonflikt: (namen) =>
      `Geht nicht zusammen mit ${namen.map((n) => '„' + n + '"').join(' und ')}: Ein Prüfer oder Bau-Block muss schreiben dürfen. Beim Speichern lehnt FlowForge das ab — nimm eines der Häkchen wieder heraus.`,
    kennzeichenPrueftAn: (kennzeichen) =>
      `„${kennzeichen}" gibt es nur für Prüfer — „Prüft" ist deshalb jetzt gesetzt.`,
    kiFeinheiten: (anzahl) =>
      anzahl === 1
        ? 'Die KI hat eine Feinheit vorgeschlagen — unten unter „Feinheiten", mit ihrer Begründung.'
        : `Die KI hat ${anzahl} Feinheiten vorgeschlagen — unten unter „Feinheiten", mit ihrer Begründung.`,
    kiBegruendung: (satz) => `KI: ${satz}`,
    kiBegruendungFehlt: 'Die KI hat das Häkchen gesetzt, aber nicht gesagt, warum — prüf selbst, ob es passt.',
    // Modellklasse eigener Blöcke (BAUPLAN 37): Voreinstellung des Blocks —
    // auf der Leinwand bleibt sie je Karte änderbar.
    modellFeld: 'Modell (Voreinstellung dieses Blocks)',
    modellHinweis:
      'Womit dieser Block normalerweise arbeitet. „Standard" ist das große Modell — nimm es für alles, wo wirklich gedacht, gebaut oder geprüft wird. Sparsamere Modelle kosten viel weniger und reichen für Zusammenfassen, Nachfragen und Aufräumen. „Extra" ist noch stärker, kann aber Guthaben statt Kontingent kosten. Auf der Leinwand kannst du die Wahl je Blockkarte noch ändern.',
    // Klasse Extra (0.48.1): Kosten-Wahrheit auch im Editor — derselbe Satz
    // wie an der Blockkarte (texte.kette.modellExtraHinweis).
    modellExtraHinweis:
      'Extra (Fable 5) kann je nach Abo Guthaben statt Kontingent kosten — FlowForge fragt beim ersten Lauf mit einem Extra-Block einmal nach. Gibt es Fable 5 für dein Konto nicht, bleibt der Block stehen, und FlowForge sagt es.',
    // Denktiefe (0.48.1): Voreinstellung des eigenen Blocks, an der Karte änderbar.
    denktiefeFeld: 'Denktiefe (Voreinstellung dieses Blocks)',
    denktiefeHinweis:
      'Wie gründlich das Modell vor jeder Antwort nachdenkt. „Modell-Standard" ist high und passt fast immer. Niedriger spart Zeit und Tokens bei kurzen, klar umrissenen Aufgaben; höher hilft bei harten Aufgaben, kostet aber mehr. „Sehr sparsam (Haiku)" kennt keine Denktiefe — dort wird die Wahl ignoriert.',
    vorschauHinweis:
      'So liegt der Block in der Bibliothek — und genau diesen Arbeitsauftrag bekommt der Agent. Passt alles? Dann speichern.',
    vorschauAuftrag: 'Arbeitsauftrag an den Agenten',
    vorschauTitel: 'Vorschau — so liegt er in der Bibliothek',
    zurueck: 'Zurück',
    weiter: 'Weiter',
    speichern: 'Block speichern',
    abbrechen: 'Abbrechen',
    bearbeiten: 'Bearbeiten',
    loeschen: 'Löschen',
    loeschenBestaetigung: (name) => `Den Block „${name}" wirklich löschen?`,
    fehlerNochVerwendet: (namen) =>
      `Dieser Block liegt noch auf der Leinwand von: ${namen.join(', ')}. Nimm ihn dort erst vom Schaubild — dann lässt er sich löschen.`,
    fehlerWaehrendLauf: (name) =>
      `Im Projekt „${name}" läuft oder wartet gerade ein Workflow mit diesem Block. Warte, bis er fertig ist — dann kannst du den Block ändern.`,
    fehlerBeschreibungFehlt: 'Beschreib zuerst in ein paar Worten, was der Block tun soll.',
    fehlerKeinVorschlag:
      'Die KI hat kein brauchbares Formular geliefert. Versuch es noch einmal — oder füll die Felder von Hand aus.',
    // Kategorie / Bereich des Blocks (BAUPLAN 30): Klappe in der Bibliothek.
    bereichFeld: 'Kategorie in der Bibliothek',
    bereichPlatzhalter: 'z.B. Prüfen — oder eine neue Kategorie eintippen',
    bereichHinweis:
      'Unter dieser Klappe liegt der Block in der Bibliothek. Wähle eine vorhandene Kategorie oder tipp eine neue ein — leer heißt „Eigene".',
    bereichVorschau: (name) => `Kategorie: ${name}`
  },
  blockRegeln: {
    nameFehlt: 'Bitte gib dem Block einen Namen.',
    nameZuLang: (max) => `Der Name ist zu lang (höchstens ${max} Zeichen).`,
    symbolZuLang: 'Als Symbol genügt ein einzelnes Emoji.',
    beschreibungZuLang: (max) => `Die Kurzbeschreibung ist zu lang (höchstens ${max} Zeichen).`,
    auftragFehlt: 'Der Arbeitsauftrag fehlt — ohne ihn wüsste der Agent nicht, was er tun soll.',
    auftragZuLang: (max) => `Der Arbeitsauftrag ist zu lang (höchstens ${max} Zeichen).`,
    etikettZuLang: (label, max) =>
      `Ein „${label}"-Etikett ist zu lang (höchstens ${max} Zeichen).`,
    zuVieleEtiketten: (label, max) => `Höchstens ${max} Etiketten bei „${label}".`,
    bereichZuLang: (max) => `Der Kategorie-Name ist zu lang (höchstens ${max} Zeichen).`,
    // Empfänger im Auftrag (BAUPLAN 43): das „wozu" je braucht-Etikett.
    brauchtWozuZuLang: (etikett, max) =>
      `Der „Wozu"-Satz zu „${etikett}" ist zu lang (höchstens ${max} Zeichen) — ein Satz genügt.`,
    // Führt zusammen (BAUPLAN 47): ohne Pflicht-Etikett gäbe es nichts, was
    // mehrfach ankommen könnte — das Häkchen liefe ins Leere.
    fuehrtZusammenOhneBraucht:
      'Ein Block, der zusammenführt, braucht mindestens ein „braucht"-Etikett — sonst gibt es nichts, was mehrfach bei ihm ankommen könnte. Trag eines ein oder nimm das Häkchen wieder heraus.',
    // brauchtOptional (BAUPLAN 48): ein Etikett ist Pflicht ODER „falls da".
    brauchtOptionalDoppelt: (etikett) =>
      `„${etikett}" steht bei „braucht" und bei „braucht — falls da". Entscheide dich: Pflicht (der Block steckt nur hinter Lieferanten) oder „falls da" (er nimmt es mit, wenn es kommt).`,
    // Formularfelder (BAUPLAN 48).
    zuVieleFelder: (max) => `Höchstens ${max} Felder je Block — mehr macht die Blockkarte unübersichtlich.`,
    feldLabelFehlt: 'Jedes Feld braucht eine Bezeichnung — sie steht auf der Blockkarte über dem Eingabefeld.',
    feldLabelZuLang: (max) => `Eine Feld-Bezeichnung ist zu lang (höchstens ${max} Zeichen).`,
    feldPlatzhalterZuLang: (label, max) =>
      `Der Platzhalter-Text zu „${label}" ist zu lang (höchstens ${max} Zeichen).`,
    feldIdLeer: (label) =>
      `Aus der Bezeichnung „${label}" lässt sich kein Platzhalter bilden — sie braucht mindestens einen Buchstaben.`,
    feldIdDoppelt: (id) =>
      `Zwei Felder ergeben denselben Platzhalter {{${id}}} — gib ihnen verschiedene Bezeichnungen.`,
    feldOhnePlatzhalter: (label, id) =>
      `Das Feld „${label}" kommt im Arbeitsauftrag nicht vor. Schreib {{${id}}} an die Stelle, wo der Agent den Inhalt lesen soll — sonst tippt man es ein, und nichts passiert damit.`,
    // Verträglichkeit der Kennzeichen (BAUPLAN 48): Jede Meldung nennt die
    // Folge im Lauf, nicht die Mechanik.
    prueftNurLesen:
      'Ein Prüfer muss Tests schreiben und ausführen dürfen — mit der Sperre „darf nur lesen" liefe jede Prüfung ins Leere. Nimm die Sperre heraus oder das Häkchen „Prüft".',
    prueftOhnePruefbeleg: (etikett) =>
      `Ein Prüfer muss „${etikett}" liefern — nur darüber kommt sein Urteil bei FlowForge an. Ohne das Etikett gäbe es keine Reparatur-Runde, kein Tor und keine Prüfkarte. Trag „${etikett}" bei „liefert" ein.`,
    pruefbefehlOhnePrueft:
      '„Prüfbefehl ist Pflicht" gibt es nur für Prüfer: Das Werkzeug dafür ist sonst gesperrt, und jeder Versuch löste eine Rechte-Rückfrage aus. Setz „Prüft" dazu oder nimm die Pflicht heraus.',
    startanleitungNurLesen:
      '„Startanleitung ist Pflicht" passt nicht zu „darf nur lesen": Der Block dürfte die Anleitung nie anlegen, und der Lauf forderte sie endlos nach. Nimm eines von beiden heraus.',
    kartenZuteilungOhneArbeitspaket: (etikett) =>
      `Ein Block, der Karten zuteilt, schneidet damit das Arbeitspaket — er muss „${etikett}" liefern, sonst prüft FlowForge am Ende eine Vollständigkeit, die der Block nie melden kann. Trag „${etikett}" bei „liefert" ein.`
  },
  kette: {
    starten: 'Workflow starten',
    // Kategorie-Kicker auf den Blockkarten (Mockup 3b).
    kickerArbeit: 'Arbeitsblock',
    kickerPruef: 'Prüf-Block',
    kickerEigen: 'Eigener Block',
    leerHinweis:
      'Dein Schaubild ist noch leer. Zieh Blöcke aus der Bibliothek rechts hierher, schieb sie zurecht und verbinde sie mit Pfeilen — die Pfeile bestimmen die Reihenfolge. Von einer Karte dürfen auch mehrere Pfeile ausgehen: Solche Zweige laufen parallel und werden am nächsten gemeinsamen Block wieder zusammengeführt.',
    pfeilZiehenHinweis: 'Pfeil ziehen: hier drücken und zum nächsten Block ziehen',
    pfeilLoeschen: 'Diesen Pfeil löschen',
    fehlerKreis:
      'Diese Pfeile ergeben einen Kreis — der Workflow hätte kein Ende. Bitte lösch einen der Pfeile.',
    fehlerPfeilUngueltig: 'Dieser Pfeil lässt sich nicht setzen.',
    fehlerPfeilDoppelt: 'Diese Verbindung gibt es schon.',
    fehlerNichtVerbunden: (name) =>
      `„${name}" hängt noch nicht am Schaubild. Verbinde alle Blöcke mit Pfeilen zu einem zusammenhängenden Schaubild — oder entferne den Block.`,
    entfernen: 'Entfernen',
    reparaturRundenLabel: 'Reparatur-Runden',
    reparaturRundenHinweis:
      'So oft darf ein Prüfer den Lauf zur Reparatur zurückschicken, bevor du gefragt wirst.',
    zurueckZuLabel: 'Bei Fehlschlag zurück zu:',
    brauchtLabel: 'braucht',
    liefertLabel: 'liefert',
    nurLesenMarke: 'darf nur lesen',
    prueftMarke: 'Prüfer',
    // Führt zusammen (BAUPLAN 47): Marke in Bibliothek und Schaubild.
    fuehrtZusammenMarke: 'führt zusammen',
    fallsDaZusatz: 'falls da',
    // Sicht-Hilfen am Schaubild (BAUPLAN 36): Woher kommt, was der Block
    // braucht — und was fehlt.
    kommtVon: (namen) => `← ${namen.join(' + ')}`,
    // Führt zusammen (BAUPLAN 47): Bei genau einem Lieferanten sagt der Chip
    // dasselbe wie die Steck-Prüfung — sonst stünde am Chip grün „kommt von
    // Bauer · A", während das Schaubild abgelehnt wird.
    kommtVonZuWenig: (namen) => `← nur ${namen.join(' + ')} — zwei nötig`,
    fehltMarke: '← fehlt',
    kommtNichtAn: '← liefert keiner',
    rueckpfeilLabel: (runden) =>
      `bei Fehlschlag, ${runden} ${runden === 1 ? 'Runde' : 'Runden'}`,
    rueckpfeilOhneRunden: 'bei Fehlschlag: keine Runde — es folgt sofort die Folgen-Frage',
    fehlerBraucht: (blockName, bedarf) =>
      `„${blockName}" braucht „${bedarf}" — aber keiner seiner Vorgänger entlang der Pfeile liefert das.`,
    // Führt zusammen (BAUPLAN 47): Ein Block, der zusammenführt, braucht
    // mindestens zwei Lieferanten je Pflicht-Etikett — sonst „führt er
    // zusammen", was nie geteilt war.
    fehlerFuehrtZusammen: (blockName, bedarf, anzahl) =>
      `„${blockName}" führt „${bedarf}" zusammen — dafür müssen mindestens zwei Blöcke vor ihm das liefern. ` +
      (anzahl === 1
        ? 'Bisher liefert es nur einer: Leg einen zweiten Lieferanten davor, oder nimm einen Block ohne „führt zusammen".'
        : 'Bisher liefert es keiner seiner Vorgänger entlang der Pfeile: Leg zwei Lieferanten davor, oder nimm einen Block ohne „führt zusammen".'),
    fehlerLeereKette: 'Die Kette ist noch leer. Zieh zuerst Blöcke aus der Bibliothek auf die Leinwand.',
    fehlerPflichtfeld: (blockName, feld) =>
      `Beim Block „${blockName}" ist das Pflichtfeld „${feld}" leer. Bitte ausfüllen — sonst startet der Lauf nicht.`,
    fehlerAuftragsquelle: (blockName, feld) =>
      `Beim Block „${blockName}" ist das Feld „${feld}" leer, und in der Kartenauswahl ist keine offene Aufgaben-Karte. Trag einen Wunsch ins Feld ein — oder leg links eine Aufgaben-Karte an. Sonst wüsste der Agent nicht, was gebaut werden soll.`,
    fehlerWaehrendLauf: 'Während ein Lauf läuft, kann die Kette nicht verändert werden.',
    fehlerWaehrendWarteschlange:
      'Dieser Workflow wartet in der Warteschlange auf seinen Start. Nimm ihn erst aus der Warteschlange, wenn du ihn ändern willst.',
    unbekannterBlock: 'Diesen Block kennt FlowForge nicht.',
    // Zusatzname je Blockkarte (BAUPLAN 41): unterscheidbar machen und dem
    // Zuschnitt sagen, wonach zu schneiden ist.
    zusatzLabel: 'Zusatzname',
    zusatzPlatzhalter: 'z.B. Datenbank',
    zusatzHinweis:
      'Ein eigener Name für genau diese Karte — aus „Bauer" wird „Bauer · Datenbank". Er macht mehrere gleiche Blöcke im selben Lauf unterscheidbar (Ticker, Laufbericht, Übergaben) und sagt gleichzeitig, wofür dieser Block zuständig ist. Für die Metriken bleibt der Blocktyp derselbe.',
    // Häkchen je Block (BAUPLAN 20): Abwahl der lokalen KI als echte Sperre.
    lokaleKiLabel: 'lokale KI erlaubt',
    lokaleKiHinweis:
      'Abgewählt: Dieser Block nutzt die lokale Helfer-KI nicht — weder für Recherchen noch für die lokale Vorreparatur. Wirkt nur, wenn die lokale KI in den Einstellungen überhaupt eingeschaltet ist.',
    // Modellklasse je Block (BAUPLAN 37): frei wählbar an jeder Blockkarte.
    modellLabel: 'Modell',
    modellNamen: {
      // Klasse Extra (0.48.1): Fable 5 — die stärkste Klasse, im Katalog
      // nirgends vorbelegt, mit Kosten-Hinweis (kann Guthaben kosten).
      extra: 'Extra (Fable 5)',
      standard: 'Standard (Opus)',
      sparsam: 'sparsam (Sonnet)',
      'sehr-sparsam': 'sehr sparsam (Haiku)',
      // Klasse lokal (BAUPLAN 49): Georgs lokale KI über Ollama — im Katalog
      // nirgends vorbelegt, kostet kein Kontingent.
      lokal: 'lokal (Ollama)'
    },
    // Klartext-Name der lokalen Klasse mit dem echten Ollama-Modell — für
    // Ticker und Laufbericht, sobald der Lauf das Modell kennt.
    lokalModellName: (modell) => `lokal (${modell})`,
    modellHinweis:
      'Womit dieser Block arbeitet. „Standard" ist das große Modell — richtig überall, wo wirklich gedacht wird (Bauen, Prüfen, Zuschneiden). Sparsamere Modelle kosten deutlich weniger, machen aber mehr Fehler: Zu sparsam gewählt, siehst du es an mehr Reparatur-Runden in den Metriken. „Extra (Fable 5)" ist noch stärker, kann aber je nach Abo Guthaben statt Kontingent kosten. „lokal (Ollama)" läuft auf deiner eigenen lokalen KI und kostet kein Kontingent.',
    // Klasse lokal (BAUPLAN 49): ehrlicher Hinweis an Karte und Editor — was
    // sie braucht, was sie kostet (nichts), was nicht gilt, und dass FlowForge
    // nie still auf Claude zurückfällt.
    modellLokalHinweis:
      'Läuft auf deiner lokalen KI (Einstellungen → Lokale KI als Block-Agent) und kostet kein Kontingent. Die Denktiefe gilt hier nicht. Ohne eingeschaltete und erreichbare lokale KI startet der Lauf nicht — FlowForge fällt nie still auf Claude zurück.',
    // Kosten-Wahrheit der Klasse Extra (0.48.1, Claude-Code-Doku „Model
    // configuration": über das Agent SDK gibt es keinen Einwilligungs-Dialog —
    // eine Fable-Anfrage, die Guthaben kostet, wird ohne Nachfrage abgerechnet).
    // Deshalb steht der Satz an der Karte, und FlowForge fragt beim ersten
    // Lauf selbst (texte.lauf.extraRueckfrage).
    modellExtraHinweis:
      'Extra (Fable 5) kann je nach Abo Guthaben statt Kontingent kosten — FlowForge fragt beim ersten Lauf mit einem Extra-Block einmal nach. Gibt es Fable 5 für dein Konto nicht, bleibt der Block stehen, und FlowForge sagt es.',
    // Denktiefe je Block (0.48.1): Zusatz zur Modellklasse, an jeder Karte
    // wählbar. Folgen-Texte aus der Claude-Code-Doku; „Modell-Standard" ist high.
    denktiefeLabel: 'Denktiefe',
    denktiefeNamen: {
      standard: 'Modell-Standard (high)',
      low: 'low — kurz, klar umrissen',
      medium: 'medium — spart Tokens, etwas weniger klug',
      high: 'high — Standard',
      xhigh: 'xhigh — tiefer, teurer',
      max: 'max — für harte Aufgaben, neigt zum Überdenken'
    },
    // Kurzform für Ticker, Laufbericht und Metriken.
    denktiefeKurz: {
      standard: 'Modell-Standard',
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
      max: 'max'
    },
    denktiefeHinweis:
      'Wie gründlich das Modell vor jeder Antwort nachdenkt. „Modell-Standard" ist high und passt fast immer. Niedriger spart Zeit und Tokens bei kurzen, klar umrissenen Aufgaben; höher hilft bei harten Aufgaben, kostet aber mehr — „max" vorher an einem kleinen Auftrag testen. Die Reparatur-Runden je Denktiefe stehen in den Metriken.',
    denktiefeHaikuHinweis:
      '„sehr sparsam (Haiku)" kennt keine Denktiefe — die Wahl wird dort ignoriert.',
    // Klasse lokal (BAUPLAN 49): Die Denktiefe ist ein Claude-Feld; beim
    // Ollama-Modell bleibt das Denken an (über diesen Weg nicht abschaltbar,
    // gemessen 19.08.2026).
    denktiefeLokalHinweis:
      '„lokal (Ollama)" kennt keine Denktiefe — die Wahl wird dort ignoriert; das Denken des lokalen Modells bleibt an.',
    uebertragGrenzeLabel: 'Überträge höchstens',
    uebertragGrenzeHinweis:
      'Läuft der Kontext eines Blocks voll (~85 %), übergibt der Agent an eine frische Session und arbeitet nahtlos weiter. So oft darf das pro Lauf passieren — Feld leer lassen heißt: unbegrenzt.',
    uebertragUnbegrenzt: 'leer = unbegrenzt',
    kontingentLabel: 'Kontingent erschöpft:',
    kontingentHinweis:
      'Was passieren soll, wenn dein Abo-Kontingent mitten im Lauf aufgebraucht ist. „Pausieren": FlowForge wartet und macht von selbst weiter, sobald es wieder Kontingent gibt. „Anhalten": der Lauf stoppt, du startest später selbst neu.',
    kontingentPausieren: 'pausieren, von selbst weitermachen',
    kontingentStoppen: 'anhalten, ich starte selbst neu',
    vorlageErsetzenBestaetigung:
      'Auf der Leinwand liegen schon Blöcke. Soll die Vorlage das vorhandene Schaubild ersetzen? Feldwerte und Verbindungen des alten Schaubilds gehen dabei verloren.',
    // Lokaler Prüfer mit Abnahme (BAUPLAN 50): Hinweis ohne Sperre — an der
    // Karte, im Schaubild-Kopf und im Start-Ticker. Folgen, nicht Mechanik:
    // Ein lokales Modell macht Fehler; ohne Claude-Prüfer dahinter gilt sein
    // Urteil allein, nur das Tor ohne KI spielt seinen Prüfbefehl nach.
    hinweisLokalerPrueferOhneAbnahme: (name) =>
      `„${name}" prüft lokal, aber kein Claude-Prüfer nimmt sein Urteil ab. Ein lokales Modell macht Fehler — ohne Abnahme gilt sein „bestanden" allein; FlowForge spielt nur seinen Prüfbefehl mechanisch nach. Der Lauf startet trotzdem.`,
    abnahmeEinfuegenKnopf: 'Abnahme-Prüfer einfügen',
    abnahmeZusatzname: 'Abnahme',
    // Bibliothek: Zusatz zur Vorlage „Feature hinzufügen · lokal".
    vorlageErklaerungLokal:
      'Opus an den Enden, lokale KI in der Mitte: Bauer und Prüfer laufen auf deiner lokalen KI, ein Standard-Prüfer „Abnahme" prüft das Urteil nach.',
    // Anzeige eines Ketten-Glieds mit Klasse/Zusatz in der Bibliothek:
    // „Prüfer · Abnahme", „Bauer (lokal)".
    vorlageGliedName: (name, zusatz, klasseKurz) =>
      name + (zusatz ? ` · ${zusatz}` : '') + (klasseKurz ? ` (${klasseKurz})` : ''),
    vorlageKlasseKurzLokal: 'lokal'
  },
  entscheidung: {
    ueberschrift: 'Der Prüfer ist weiterhin nicht zufrieden',
    einleitung: (block, runden) =>
      runden > 0
        ? `„${block}" hat die Prüfung auch nach ${runden === 1 ? 'einer Reparatur-Runde' : runden + ' Reparatur-Runden'} nicht bestanden. Wie soll es weitergehen?`
        : `„${block}" hat die Prüfung nicht bestanden, und Reparatur-Runden sind keine eingestellt. Wie soll es weitergehen?`,
    // Seit BAUPLAN 46 gilt jede Wahl nur für den Zweig dieses Prüfers — andere
    // Zweige laufen weiter; der Dialog sagt vorher, was „wiederherstellen" trifft.
    weitermachen: 'Weitermachen',
    weitermachenHinweis:
      'Dieser Zweig macht trotz der nicht bestandenen Prüfung mit dem nächsten Block weiter.',
    zurueckstellen: 'Zurückstellen',
    zurueckstellenHinweis:
      'Dieser Zweig endet hier; andere Zweige laufen zu Ende. Alles bisher Gebaute bleibt bestehen — du kannst später neu starten.',
    wiederherstellen: 'Stand wiederherstellen',
    wiederherstellenHinweis:
      'Die Dateien dieses Zweigs werden auf den Stand von vor diesem Lauf zurückgesetzt — andere Zweige bleiben unberührt.',
    // Was der Rückroll trifft (BAUPLAN 46): je Zweig-Block sein Wirkbereich —
    // oder ehrlich der ganze Ordner, wenn ein Block keinen Datenvertrag hat.
    trifftDateien: (name, anzahl) =>
      `${name} (${anzahl} ${anzahl === 1 ? 'Datei' : 'Dateien'})`,
    trifftPruefordner: (ordner) => `Prüfordner ${ordner}`,
    trifftBereiche: (teile) => `trifft: ${teile.join(', ')}`,
    trifftGanzerOrdner: (name) =>
      `trifft den ganzen Projektordner am Laufende — Block „${name}" hat keinen Datenvertrag (Dateiliste); zweigbezogen geht es dann nicht.`
  },
  karten: {
    ueberschrift: 'Karten',
    neueKarte: 'Neue Karte',
    filterAlle: 'Alle',
    sorten: {
      aufgabe: 'Aufgabe',
      entscheidung: 'Entscheidung',
      wissen: 'Wissen',
      status: 'Status',
      pruefung: 'Prüfung'
    },
    offen: 'offen',
    erledigt: 'erledigt',
    erledigen: 'Erledigen',
    wiederOeffnen: 'Wieder öffnen',
    bearbeiten: 'Bearbeiten',
    loeschen: 'Löschen',
    loeschenBestaetigung: 'Diese Karte wirklich löschen?',
    loeschenBestaetigungPruefung:
      'Diese Prüfkarte wirklich löschen? Ihre aufbewahrten Prüfdateien werden mitgelöscht — diese Prüfung lässt sich dann nicht mehr auf einen Prüfer ziehen.',
    keineKarten: 'Keine Karten in dieser Ansicht.',
    // Themen & Gruppen (BAUPLAN 30).
    themaMarke: (thema) => `Thema: ${thema}`,
    gruppen: {
      arbeit: 'Arbeit',
      wissen: 'Wissen',
      geprueft: 'Geprüft',
      erledigt: 'Erledigt'
    },
    sonstiges: 'Sonstiges',
    themaUmbenennen: 'Thema umbenennen',
    themaUmbenennenFrage: (thema) =>
      `Neuer Name für das Thema „${thema}" — alle seine Karten wandern mit. Ein vorhandener Name legt die Themen zusammen.`,
    themaUmbenennenKnopf: 'Umbenennen',
    themaZielHinweis: 'Karte hierher ziehen, um sie in dieses Thema zu verschieben.',
    // Aufräum-Knöpfe (Entscheidung Georg, 15.08.2026): Sonderläufe aus der
    // Karten-Seitenleiste — Lauf-Tab, Ticker und Abnahme wie bei jedem Lauf,
    // die Leinwand bleibt unangetastet.
    aufraeumenTitel: 'Aufräumen',
    kartenPruefenKnopf: 'Karten am Code prüfen',
    kartenPruefenHinweis:
      'Startet den Karten-Prüfer als Sonderlauf im Hintergrund: Er misst am Code nach, ob die Karten noch wahr sind, und schlägt Korrekturen vor — du entscheidest jede einzeln im Lauf-Tab. Die Leinwand bleibt unverändert.',
    themenSortierenKnopf: 'Themen sortieren',
    themenSortierenHinweis:
      'Startet einen Sonderlauf, der alle Karten ohne oder mit offensichtlich falschem Thema einsortiert — ohne Code-Nachmessen. Du bekommst EINE Tabelle mit Vorschlägen im Lauf-Tab: je Zeile änderbar, „Alle übernehmen" oder einzeln ablehnen.',
    sonderlaufGesperrt: 'Solange in diesem Projekt ein Lauf läuft oder wartet, ist Aufräumen gesperrt.',
    // Herkunft je Karte (BAUPLAN 30): kompakte Kopfzeile unter dem Titel.
    herkunft: {
      angelegt: 'angelegt',
      geaendert: 'zuletzt geändert',
      vonDir: 'von dir',
      vomChat: 'vom Chat',
      vomKartenPruefer: 'vom Karten-Prüfer',
      vonFlowForge: 'von FlowForge',
      vonBlock: (block) => `von ${block}`,
      bei: (aufgaben) => `bei „${aufgaben.join('“, „')}"`,
      lauf: (zeit) => `Lauf ${zeit}`,
      zumBericht: 'Zum Laufbericht springen',
      geradeEben: 'gerade eben',
      vorMinuten: (n) => `vor ${n} Min.`,
      vorStunden: (n) => `vor ${n} Std.`,
      vorTagen: (n) => `vor ${n} Tag${n === 1 ? '' : 'en'}`
    }
  },
  kartenFormular: {
    ueberschriftNeu: 'Neue Karte',
    ueberschriftBearbeiten: 'Karte bearbeiten',
    sorteFeld: 'Sorte',
    titelFeld: 'Titel',
    textFeld: 'Inhalt',
    // Themen (BAUPLAN 30).
    themaFeld: 'Thema (Pflicht)',
    themaFeldOptional: 'Thema (optional — alte Karte ohne Thema)',
    themaPlatzhalter: 'z.B. Login, Datenbank, Oberfläche',
    themaHinweis: (themen) => `Vorhandene Themen: ${themen.join(', ')} — ein neues nur, wenn keins passt.`,
    themaHinweisLeer: 'Ein kurzes Schlagwort, unter dem die Karte in der Seitenleiste einsortiert wird.',
    zeichenUebrig: (n) => `noch ${n} Zeichen`,
    zeichenZuViel: (n) => `${n} Zeichen zu viel`,
    speichern: 'Speichern',
    abbrechen: 'Abbrechen'
  },
  kartenRegeln: {
    titelFehlt: 'Bitte gib der Karte einen Titel.',
    titelZuLang: (max, ist) =>
      `Der Titel ist zu lang: ${ist} von höchstens ${max} Zeichen.`,
    textFehlt: 'Bitte schreib etwas in die Karte.',
    // Mit Ist-Länge (Befund 14.08.2026): Ohne die Zahl kürzte der Agent
    // blind und lief mehrfach in dieselbe Ablehnung.
    textZuLang: (max, ist) =>
      `Der Inhalt ist zu lang: ${ist} von höchstens ${max} Zeichen — kürze um ` +
      `mindestens ${ist - max} Zeichen oder teile den Inhalt auf mehrere fokussierte Karten auf.`,
    statusUnantastbar: 'Die Status-Karte gibt es genau einmal — sie kann nicht gelöscht oder neu angelegt werden.',
    nurAufgabenErledigbar: 'Nur Aufgaben-Karten können erledigt werden.',
    // Prüfkarten (BAUPLAN 18): legt und pflegt ausschließlich FlowForge.
    pruefkarteNurFlowForge:
      'Prüfkarten legt FlowForge selbst an — automatisch nach jeder bestandenen Prüfung. Sie lassen sich nicht anlegen oder über die Karten-Werkzeuge ändern.',
    // Themen (BAUPLAN 30): Pflicht beim Anlegen — die Ablehnung nennt die
    // vorhandenen Themen, damit auch ein Agent, der nichts vom Thema weiß,
    // sofort einsortieren kann (Rettungsanker, kein Block darf daran scheitern).
    themaFehlt: (vorhanden) =>
      'Bitte gib der Karte ein Thema (ein kurzes Schlagwort, unter dem sie einsortiert wird). ' +
      (vorhanden.length
        ? `Vorhandene Themen: ${vorhanden.join(', ')} — nimm eins davon; ein neues Thema nur, wenn keines passt.`
        : 'Es gibt noch keine Themen — wähle ein passendes Schlagwort.'),
    themaZuLang: (max, ist) =>
      `Das Thema ist zu lang: ${ist} von höchstens ${max} Zeichen — ein Schlagwort, kein Satz.`,
    keinThemaFuerSorte: 'Status- und Prüfkarten tragen kein Thema.'
  },
  statusKarte: {
    titel: 'Status',
    startText: 'Projekt frisch angelegt. Noch nichts gebaut.'
  },
  kartenAuswahl: {
    ueberschrift: 'Karten für den Lauf',
    hinweis:
      'Diese Karten bekommt der Agent zu Beginn jedes Blocks mit. Status-Karte und offene Aufgaben sind vorausgewählt — weitere Karten ziehst du aus der Seitenleiste hierher, rauswerfen per ×.',
    immerDabei: 'immer dabei',
    entfernen: 'Aus der Auswahl nehmen',
    // Alle Karten laden (BAUPLAN 29): ein Knopf lädt alles Wissenswerte in
    // die Auswahl — Paket schneiden teilt dann zu, wer was bekommt.
    alleHinzufuegen: 'Alle Karten hinzufügen',
    alleHinzufuegenHinweis:
      'Lädt Status-Karte, alle Entscheidungs- und Wissens-Karten und alle offenen Aufgaben in die Auswahl. Erledigte Aufgaben und Prüfkarten bleiben draußen. Paket schneiden bzw. Diagnose teilt den Folgeblöcken dann nur die Karten zu, die sie wirklich brauchen.',
    standardAuswahl: 'Standard-Auswahl',
    standardAuswahlHinweis:
      'Springt zurück auf die übliche Vorauswahl: Status-Karte und offene Aufgaben.',
    // Prüfkarten per Drag & Drop (BAUPLAN 30, Kleinkram): freundlich abgelehnt.
    pruefkarteAbgelehnt:
      'Prüfkarten gehören nicht in die Kartenauswahl — zieh sie stattdessen auf einen Prüfer-Block im Schaubild, dann führt er die aufbewahrte Prüfung erneut aus.'
  },
  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): die Vorschlags-Zeile an
  // der Kartenauswahl im Schaubild-Tab — eine Einladung, kein neuer Standard.
  laufVorschlag: {
    ueberschrift: 'Aus dem letzten Lauf empfohlen',
    hinweis:
      'Das Sessionende des letzten Laufs schlägt diese Karten für den nächsten Lauf vor. „Übernehmen" stellt die Kartenauswahl genau darauf um — danach wie gewohnt änderbar. Du kannst den Vorschlag auch verwerfen oder einfach ignorieren.',
    uebernehmen: 'Übernehmen',
    verwerfen: 'Verwerfen',
    ohneKarten: 'ohne Karten'
  },
  // Gespräch mit dem Agenten (BAUPLAN 9): Frage-Blöcke und das Spec-Interview
  // stellen Fragen über das mensch-Werkzeug — beantwortet wird hier.
  gespraech: {
    ueberschrift: 'Der Agent hat eine Frage an dich',
    verlaufUeberschrift: 'Gespräch',
    antwortPlatzhalter: 'Deine Antwort …',
    antworten: 'Antworten',
    freitextHinweis: 'Du kannst eine Option anklicken — oder frei antworten.',
    empfohlen: 'Empfohlen'
  },
  // Karten-Vorschläge (BAUPLAN 26): der Abnahme-Dialog des Karten-Prüfers —
  // du entscheidest je Karte: übernehmen, Vorschlag bearbeiten, ablehnen.
  vorschlag: {
    ueberschrift: 'Der Karten-Prüfer schlägt eine Änderung vor',
    artLabels: {
      aktualisieren: 'Karte aktualisieren',
      erledigen: 'Aufgabe abhaken',
      oeffnen: 'Aufgabe wieder öffnen',
      anlegen: 'Neue Aufgaben-Karte anlegen',
      loeschen: 'Karte löschen',
      thema: 'Themen sortieren'
    },
    // Sammel-Dialog „Themen sortieren" (BAUPLAN 30).
    themenAnzahl: (n) => `${n} Karte${n === 1 ? '' : 'n'}`,
    themenUeberschrift: 'Der Sortierer schlägt Themen vor',
    themenHinweis:
      'Je Zeile kannst du das Thema ändern oder die Zeile ablehnen. „Alle übernehmen" setzt alle nicht abgelehnten Themen auf einmal — nur das Thema ändert sich, kein Kartentext.',
    themenSpalteKarte: 'Karte',
    themenSpalteBisher: 'bisher',
    themenSpalteNeu: 'Thema',
    themenAblehnenZeile: 'ablehnen',
    themenAlleUebernehmen: 'Alle übernehmen',
    themenAlleAblehnen: 'Alle ablehnen',
    themenKeins: '—',
    themaFeld: 'Thema',
    bisher: 'So steht es auf der Karte:',
    neu: 'Vorschlag:',
    begruendungLabel: 'Begründung:',
    loeschenHinweis: 'Die Karte würde ersatzlos gelöscht.',
    erledigenHinweis: 'Die Aufgabe würde als erledigt abgehakt.',
    oeffnenHinweis: 'Die Aufgabe würde wieder als offen markiert.',
    uebernehmen: 'Übernehmen',
    bearbeiten: 'Vorschlag bearbeiten',
    ablehnen: 'Ablehnen',
    soUebernehmen: 'So übernehmen',
    zurueck: 'Zurück',
    titelFeld: 'Titel',
    textFeld: 'Inhalt'
  },
  // Co-Pilot (BAUPLAN 33, vorher Nachlauf-Chat BAUPLAN 27): EIN Chat für
  // Bedienung und Projekt — im Projekt hängt er an der Lauf-Session, in der
  // Übersicht beantwortet er Bedienfragen. Standard nur-lesend (Karten
  // anlegen erlaubt), auf Zuruf „Chat darf reparieren".
  chat: {
    titel: 'Co-Pilot',
    untertitelProjekt: (name) => `Projekt „${name}"`,
    untertitelUebersicht: 'Bedienung von FlowForge',
    einleitung:
      'Frag zum Projekt oder zur Bedienung von FlowForge — der Co-Pilot kennt die Karten, Laufberichte, die Startanleitung und die App-Ausgabe; nach einem Lauf kennt er auch dessen Blöcke, Fazite und Verlauf. Auf „leg das als Aufgabe an" legt er eine Karte an; der nächste Bau-Lauf arbeitet sie mit Sicherungspunkt und Prüfer ab.',
    einleitungUebersicht:
      'Frag, wie etwas in FlowForge geht — der Co-Pilot schlägt in der Produktbeschreibung nach. Für Fragen zu einem Projekt öffne das Projekt und frag dort.',
    eingabePlatzhalter: 'Deine Frage … (Strg+V fügt einen Screenshot ein)',
    senden: 'Senden',
    stoppen: 'Antwort abbrechen',
    schliessen: 'Chat schließen',
    neuesGespraech: 'Neues Gespräch',
    neuesGespraechHinweis:
      'Leert den Verlauf und verwirft die Session — die nächste Frage startet frisch (im Projekt wieder an der jüngsten Lauf-Session).',
    neuesGespraechFrage:
      'Neues Gespräch beginnen? Der bisherige Verlauf wird geleert und die KI vergisst ihn — die nächste Frage startet frisch.',
    beschaeftigt: 'Der Chat arbeitet …',
    arbeitetSchritt: (text) => `Der Chat arbeitet … ${text}`,
    laufAktivHinweis:
      'Im Projekt läuft (oder wartet) gerade ein Lauf — der Chat ist so lange nur lesend: Bedienfragen und „was macht der Bauer gerade" gehen, Reparieren ist gesperrt.',
    reparierenLabel: 'Chat darf reparieren',
    reparierenHinweis:
      'Angeschaltet schreibt der Chat wie ein Bauer und führt Befehle für dich aus (z.B. npm install): Vor der ersten Änderung entsteht ein Sicherungspunkt; Git, Prüfmappe und Verwaltungsdateien bleiben tabu. Ausgeschaltet liest er nur und darf Karten anlegen.',
    reparierenAn: 'Chat darf jetzt reparieren — vor der ersten Änderung entsteht ein Sicherungspunkt.',
    reparierenAus: 'Chat ist wieder nur-lesend (Karten anlegen bleibt erlaubt).',
    reparierenWaehrendLauf:
      'Solange in diesem Projekt ein Lauf läuft oder wartet, darf der Chat nicht reparieren — der Chat schreibt nicht, solange ein Lauf läuft.',
    reparierenUebersicht: 'In der Projektübersicht gibt es nichts zu reparieren — öffne dafür ein Projekt.',
    // Marke im Verlauf (Entscheidung Georg): Nach jedem Lauf hängt der Chat an
    // der neuen Lauf-Session — der ältere Teil bleibt zum Nachlesen, die KI
    // kennt ihn nicht mehr.
    marke: (datum, zeit) => `ab hier: neue Lauf-Session vom ${datum}, ${zeit}`,
    markeOhneZeit: 'ab hier: neue Lauf-Session',
    markeHinweis: 'Was darüber steht, kennt die KI nicht mehr — es bleibt zum Nachlesen.',
    bildKnopf: 'Bild anhängen',
    bildEntfernen: 'Bild entfernen',
    bildMarker: (n) => (n === 1 ? '[1 Bild angehängt]' : `[${n} Bilder angehängt]`),
    bildZuGross: 'Das Bild ist zu groß (höchstens 5 MB) — bitte kleiner zuschneiden.',
    bildZuViele: 'Höchstens 4 Bilder je Nachricht.',
    bildFormat: 'Dieses Dateiformat kann der Motor nicht lesen — nutze PNG, JPEG, GIF oder WebP.',
    // Ehrlichkeit: Woher der Chat seinen Kontext hat, steht sichtbar im Verlauf.
    hinweisFortgesetzt:
      'Dieser Chat setzt die Lauf-Session fort — der Agent kennt Blöcke, Fazite und Verlauf des Laufs.',
    hinweisFrisch:
      'Die Lauf-Session ist nicht mehr nutzbar (weg oder Kontext zu voll) — dieser Chat ist eine frische Session mit dem Laufbericht als Kontext.',
    hinweisFortsetzungGescheitert:
      'Die Lauf-Session ließ sich nicht fortsetzen — der Chat läuft jetzt als frische Session mit dem Laufbericht als Kontext.',
    hinweisChatSessionWeg:
      'Die vorige Chat-Session ließ sich nicht fortsetzen — die KI kennt den älteren Verlauf nicht mehr (er bleibt hier zum Nachlesen).',
    hinweisOhneLauf:
      'Noch kein Lauf in diesem Projekt — dieser Chat ist eine frische Session mit Projekt- und FlowForge-Wissen (Karten, Dateien, Startanleitung, Produktbeschreibung).',
    hinweisUebersicht:
      'Kein Projekt offen — der Co-Pilot beantwortet hier nur Bedienfragen zu FlowForge (aus der Produktbeschreibung). Der Datenordner ist für ihn gesperrt.',
    verbrauchHinweis: 'Chat-Nachrichten kosten Kontingent.',
    fehlerLaufWaehrendChat:
      'Der Chat arbeitet gerade in diesem Projekt — warte, bis seine Antwort da ist (oder brich sie ab), bevor du einen Lauf startest.',
    antwortAbgebrochen: 'Antwort abgebrochen.',
    denkAbsender: 'Chat'
  },
  benachrichtigung: {
    frageTitel: 'FlowForge — der Agent hat eine Frage',
    vorschlagTitel: 'FlowForge — ein Karten-Vorschlag wartet auf dich',
    fertigTitel: 'FlowForge — der Lauf ist beendet',
    pauseTitel: 'FlowForge — Kontingent erschöpft',
    pauseText:
      'Dein Abo-Kontingent ist im Moment aufgebraucht. FlowForge pausiert und macht von selbst weiter, sobald es wieder Kontingent gibt.',
    pauseGestopptText:
      'Dein Abo-Kontingent ist im Moment aufgebraucht. Der Lauf hat angehalten — starte ihn neu, sobald dein Kontingent wieder da ist.',
    weiterTitel: 'FlowForge — es geht weiter',
    weiterText: 'Der Motor arbeitet wieder — der Lauf macht von selbst weiter.',
    serverTitel: 'FlowForge — KI-Server überlastet',
    serverText:
      'Die KI-Server sind im Moment überlastet. FlowForge pausiert und macht von selbst weiter, sobald sie wieder erreichbar sind.'
  },
  // Wiederaufnahme nach App-/Rechner-Neustart mitten im Lauf (SPEC §3.3, BAUPLAN 11).
  wiederaufnahme: {
    ueberschrift: 'Ein Lauf wurde unterbrochen',
    einleitung: (zeit, blockName) =>
      `Beim letzten Mal wurde ein Lauf mitten in „${blockName}" unterbrochen (gestartet ${zeit}) — vermutlich durch einen Neustart. FlowForge kann den Projektordner auf den letzten Sicherungspunkt zurücksetzen und dort weitermachen.`,
    weitermachen: 'Am letzten Sicherungspunkt weitermachen',
    verwerfen: 'Nicht weitermachen',
    verwerfenHinweis:
      'Bei „Nicht weitermachen" bleibt alles wie es ist — du kannst den Workflow später ganz normal neu starten.',
    fehlerVeraendert:
      'Das Schaubild wurde seit der Unterbrechung verändert — der Lauf kann nicht fortgesetzt werden. Starte den Workflow einfach neu.',
    fehlerKeinStand: 'Es gibt keinen unterbrochenen Lauf mehr, der fortgesetzt werden könnte.'
  },
  // Texte, die an den Agenten gehen (nicht an Georg) — zentral wie alle anderen.
  agentenMensch: {
    antwort: (text) => `Antwort des Nutzers:\n${text}`,
    keineAntwort:
      'Der Lauf wurde angehalten — auf diese Frage kommt keine Antwort mehr. ' +
      'Beende deinen Auftrag ohne weitere Fragen.'
  },
  // Karten-Vorschläge (BAUPLAN 26): Texte an den Karten-Prüfer-Agenten.
  agentenVorschlag: {
    werkzeugBeschreibung:
      'Schlägt dem Nutzer eine Karten-Korrektur vor und wartet auf seine Entscheidung ' +
      '(übernehmen, bearbeiten, ablehnen) — FlowForge wendet sie an, du änderst nie ' +
      'selbst. Ein Vorschlag pro Aufruf, jeder mit Begründung und Beleg aus dem Code.',
    serverHinweis:
      'Mit karte_vorschlagen schlägst du dem Nutzer Karten-Korrekturen vor — er ' +
      'entscheidet jede einzeln, FlowForge wendet sie an. Karten änderst du nie direkt.',
    unbekannteId: (id) =>
      `Keine Karte mit der id ${id} — hol dir die ids mit karten_uebersicht.`,
    pruefkarteTabu:
      'Prüfkarten pflegt FlowForge selbst — zu ihnen gibt es keine Vorschläge. Erwähne ' +
      'Auffälliges stattdessen in deinem Kartenbericht.',
    entscheidungTabu:
      'Entscheidungs-Karten sind Festlegungen des Nutzers — sie werden nie umformuliert ' +
      'oder gelöscht. Widerspricht der Code der Festlegung, schlage stattdessen mit ' +
      'art "anlegen" eine Aufgaben-Karte vor, die den Widerspruch benennt.',
    statusNurAktualisierbar:
      'Die Status-Karte wird nie gelöscht — sie ist nur aktualisierbar. Ist ihr Inhalt ' +
      'veraltet, schlage mit art "aktualisieren" einen neuen Inhalt vor (ihr Titel bleibt fest).',
    felderUngueltig: (titelMax, textMax) =>
      `Abgelehnt: titel (höchstens ${titelMax} Zeichen) und text (höchstens ${textMax} ` +
      'Zeichen) müssen beide gefüllt sein. Bei der Status-Karte zählt nur der text — ' +
      'ihr Titel bleibt fest.',
    nichtsGeaendert:
      'Abgelehnt: Der Vorschlag ist wortgleich mit der Karte — nichts zu korrigieren.',
    nurAufgaben: 'Abhaken und Wiederöffnen gibt es nur bei Aufgaben-Karten.',
    schonErledigt: 'Diese Aufgabe ist schon abgehakt.',
    schonOffen: 'Diese Aufgabe ist schon offen.',
    keineAntwort:
      'Der Lauf wurde angehalten — dieser Vorschlag wird nicht mehr entschieden. ' +
      'Beende deinen Auftrag ohne weitere Vorschläge.',
    abgelehnt:
      'Der Nutzer hat den Vorschlag ABGELEHNT — die Karte bleibt unverändert. Vermerke ' +
      'das in deinem Kartenbericht und mach mit der nächsten Karte weiter.',
    uebernommen: 'Der Nutzer hat den Vorschlag übernommen — FlowForge hat ihn angewendet.',
    bearbeitetUebernommen: (titel, text) =>
      'Der Nutzer hat den Vorschlag BEARBEITET übernommen. Angewendet wurde seine ' +
      `Fassung — Titel: „${titel ?? ''}", Inhalt: „${text ?? ''}". Diese Fassung gilt; ` +
      'vermerke sie in deinem Kartenbericht.',
    // Sammelform „thema" (BAUPLAN 30).
    themenLeer: 'Abgelehnt: Bei art "thema" muss das Feld themen mindestens einen Eintrag enthalten.',
    themaDoppelt: (id) => `Abgelehnt: Die Karte ${id} kommt in themen mehrfach vor.`,
    themaFalscheSorte: (titel) =>
      `Abgelehnt: „${titel}" ist eine Status- oder Prüfkarte — die tragen kein Thema.`,
    themaLeer: (titel) => `Abgelehnt: Für „${titel}" fehlt das Thema.`,
    themaGleich: (titel) =>
      `Abgelehnt: „${titel}" trägt dieses Thema schon — lass die Karte weg.`,
    themenErgebnis: (uebernommen, abgelehnt) =>
      `Der Nutzer hat entschieden: ${uebernommen} Thema-Vorschlag${uebernommen === 1 ? '' : 'e'} ` +
      `übernommen (ggf. mit seinen Änderungen), ${abgelehnt} abgelehnt. FlowForge hat die ` +
      'übernommenen angewendet — vermerke das in deinem Kartenbericht.'
  },
  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): Texte an den
  // Sessionende-Agenten für naechster_lauf_vorschlagen.
  agentenLaufVorschlag: {
    werkzeugBeschreibung:
      'Schlägt die Kartenauswahl für den NÄCHSTEN Lauf vor: Karten-IDs plus ein Satz ' +
      'Empfehlung in Alltagssprache, was als Nächstes ansteht. FlowForge speichert das ' +
      'nur als Vorschlag — der Nutzer entscheidet selbst; nichts wird umgebaut oder gestartet.',
    serverHinweis:
      'Mit naechster_lauf_vorschlagen deckst du den Tisch für den nächsten Lauf — ein ' +
      'Vorschlag an den Nutzer, keine Automatik. Ein erneuter Aufruf ersetzt den alten Vorschlag.',
    unbekannteIds: (ids) =>
      `Keine Karte(n) mit diesen ids: ${ids} — nimm nur ids aus karten_uebersicht.`,
    pruefkartenTabu:
      'Prüfkarten gehören nicht in die Kartenauswahl — sie haben ihren eigenen Weg über ' +
      'die Prüf-Blöcke. Lass sie aus dem Vorschlag weg.',
    empfehlungUngueltig: (max) =>
      `Abgelehnt: empfehlung muss gefüllt sein — ein Satz in Alltagssprache, höchstens ${max} Zeichen.`,
    gespeichert: (anzahl) =>
      `Vorschlag gespeichert (${anzahl} Karte${anzahl === 1 ? '' : 'n'}). Der Nutzer sieht ` +
      'ihn an der Kartenauswahl und entscheidet selbst — ein erneuter Aufruf ersetzt ihn.'
  },
  // Karten-Zuteilung (BAUPLAN 29): Texte an die Auftragsquellen-Agenten
  // (Paket schneiden, Diagnose) für karten_zuteilen.
  agentenKartenZuteilung: {
    werkzeugBeschreibung:
      'Teilt den nachfolgenden Blöcken dieses Laufs die Karten zu, die sie wirklich ' +
      'brauchen — je Eintrag eine Blocknummer und die Karten-IDs aus der Kartenauswahl. ' +
      'Adressiert wird über die Blocknummer, denn zwei Blöcke können gleich heißen; jede ' +
      'Nummer trifft genau einen Block. Nicht genannte Blöcke bekommen wie bisher die volle ' +
      'Kartenauswahl; die Status-Karte ist immer dabei.',
    serverHinweis:
      'Mit karten_zuteilen bekommt jeder nachfolgende Block nur die Karten in den ' +
      'Auftrag, die er wirklich braucht — Kontext ist der teuerste Teil des Laufs. ' +
      'Ein erneuter Aufruf ersetzt die Zuteilung der erneut genannten Blöcke.',
    // Adressen statt einer Komma-Liste (BAUPLAN 44): Zusatznamen dürfen Kommas
    // enthalten, und zwei Blöcke ohne Zusatznamen erschienen als einer. Je Zeile
    // eine Adresse — dieselbe Bezeichnung, die Vorspann und Ticker nennen.
    auftragZusatz: (bezeichnungen) =>
      '\nZum Schluss: Teil mit dem Werkzeug karten_zuteilen den nachfolgenden Blöcken ' +
      'dieses Laufs die Karten aus der Kartenauswahl zu, die sie für ihre Arbeit ' +
      'wirklich brauchen (je Eintrag: block = die Blocknummer, kartenIds = ids aus der ' +
      'Kartenauswahl oben). Die nachfolgenden Blöcke sind:\n' +
      bezeichnungen.map((b) => '- ' + b).join('\n') +
      // Empfänger im Auftrag (BAUPLAN 43): Dieser Auftrag trägt zwei Blocklisten
      // — diese hier (alle Nachfahren, denn Karten kann jeder brauchen) und die
      // Empfänger-Zeilen des Vorspanns (nur wer wirklich etwas von dir bekommt).
      // Ohne diesen Halbsatz liest der Agent zwei Listen mit verschiedenem
      // Inhalt und hält eine davon für unvollständig. Der Verweis nennt die
      // Überschrift der anderen Liste WÖRTLICH (agentenVorspann.
      // empfaengerUeberschrift) — ein Wort wie „Vorspann" kennt nur FlowForge,
      // im Prompt des Agenten steht es nirgends, und er kann es nicht auflösen.
      '\nDas sind alle Blöcke hinter dir im Schaubild — nicht nur die, die oben unter ' +
      '„Wer bekommt, was du lieferst" stehen; Karten kann auch jemand brauchen, dem du ' +
      'nichts lieferst. Sei sparsam — Kontext ist der teuerste Teil des Laufs: Jeder Block bekommt ' +
      'nur, was er wirklich braucht (die Status-Karte ist immer dabei; eine leere ' +
      'Liste heißt „nur die Status-Karte"). Blöcke, die du nicht nennst, bekommen ' +
      'wie bisher die volle Auswahl.',
    leereZuteilung:
      'Abgelehnt: zuteilung muss mindestens einen Eintrag mit Blocknummer enthalten.',
    keineNachfolger:
      'Dieser Block hat keine nachfolgenden Blöcke im Schaubild — es gibt nichts zuzuteilen.',
    unbekannteBloecke: (namen, gueltig) =>
      `Keine nachfolgenden Blöcke unter dieser Adresse: ${namen}. ` +
      `Zuteilen kannst du an: ${gueltig} — trage im Feld block die Blocknummer ein.`,
    fremdeKarten: (ids) =>
      `Diese Karten gehören nicht zur Kartenauswahl dieses Laufs: ${ids} — ` +
      'zuteilen kannst du nur Karten aus der Kartenauswahl in deinem Auftrag.',
    gespeichert: (zeilen) =>
      `Zuteilung gespeichert: ${zeilen}. Nicht genannte Blöcke bekommen die volle Auswahl.`
  },
  // Paket melden (BAUPLAN 30, Herkunft): Die Auftragsquellen-Blöcke melden,
  // an welchen Aufgaben-Karten der Lauf arbeitet — FlowForge stempelt damit
  // jede Karte, die im Lauf entsteht oder sich ändert.
  agentenPaket: {
    werkzeugBeschreibung:
      'Meldet FlowForge, welche offenen Aufgaben-Karten dieses Arbeitspaket bearbeitet ' +
      '(ids aus der Kartenauswahl). FlowForge vermerkt damit an jeder Karte, die in diesem ' +
      'Lauf entsteht oder sich ändert, bei welcher Aufgabe das geschah. Leer, wenn der ' +
      'Auftrag allein aus dem Wunsch- bzw. Fehlerbild-Feld kam.',
    serverHinweis:
      'Mit paket_melden benennst du die Aufgaben-Karten deines Pakets — ein erneuter Aufruf ersetzt die Meldung.',
    auftragZusatz:
      '\nSobald feststeht, welche Aufgaben-Karte(n) das Paket bearbeitet, melde sie mit dem ' +
      'Werkzeug paket_melden (aufgabenIds = ids der offenen Aufgaben-Karten aus der ' +
      'Kartenauswahl oben; leer, wenn dein Auftrag allein aus dem Feld kam). FlowForge ' +
      'vermerkt damit an jeder Karte, die dieser Lauf anlegt oder ändert, aus welcher ' +
      'Aufgabe sie entstand.',
    leerOhneFeld:
      'Abgelehnt: aufgabenIds ist leer, aber das Wunsch-/Fehlerbild-Feld dieses Blocks ist ' +
      'auch leer — die offenen Aufgaben-Karten der Kartenauswahl sind dein Auftrag; nenne die, ' +
      'die du dir vornimmst.',
    unbekannteId: (id) => `Keine Karte mit der id ${id} — nimm nur ids aus der Kartenauswahl.`,
    keineOffeneAufgabe: (titel) => `„${titel}" ist keine offene Aufgaben-Karte.`,
    nichtInAuswahl: (titel) => `„${titel}" gehört nicht zur Kartenauswahl dieses Laufs.`,
    gemeldet: (anzahl) =>
      anzahl === 0
        ? 'Gemeldet: Das Paket kommt allein aus dem Feld — keine Aufgaben-Karten.'
        : `Gemeldet: ${anzahl} Aufgaben-Karte${anzahl === 1 ? '' : 'n'} für dieses Paket. FlowForge vermerkt sie als Herkunft.`
  },
  // Zuschnitt je benanntem Ziel (BAUPLAN 44): Der Auftrag der Auftragsquellen
  // nennt die Ziele mit ihrer Adresse — je Zeile eine, denn Zusatznamen dürfen
  // Kommas enthalten und zwei Blöcke ohne Zusatznamen hießen sonst gleich.
  agentenZuschnitt: {
    auftragZusatz: (bezeichnungen) =>
      '\nBenannte Ziele deines Zuschnitts — das sind die Blöcke hinter dir, die ein ' +
      'Arbeitspaket UMSETZEN:\n' +
      bezeichnungen.map((b) => '- ' + b).join('\n') +
      '\nSchneide für JEDES dieser Ziele ein eigenes Paket mit eigenen Fertig-Kriterien und ' +
      'trage alle Pakete in EINEM Aufruf von melde_arbeitspaket ein (Feld pakete; zielBlock = ' +
      'die Blocknummer von oben). Nur-lesende und prüfende Blöcke stehen nicht in dieser ' +
      'Liste — sie bekommen kein eigenes Paket, sondern das des Ziels, an dessen Arbeit sie ' +
      'hängen; sonst würde an anderen Kriterien gemessen, als gebaut wurde. ' +
      'Nenne je Paket in erlaubteDateien die Dateien und Ordner, die dieses ' +
      'Paket anfassen darf (auch neu entstehende): Diese Liste IST die Schreibsperre — was nicht ' +
      'drinsteht, kann der Umsetzer nicht schreiben. Schneide die Listen deshalb ' +
      'überschneidungsfrei und vollständig.',
    // Genau ein Ziel: Alles bleibt wie vor Bauschritt 44 — kein Wort über
    // Adressen, die es nicht auseinanderzuhalten gibt.
    auftragZusatzEines: (bezeichnung) =>
      `\nDein Paket geht an ${bezeichnung} — er setzt es um. Nenne in erlaubteDateien die ` +
      'Dateien und Ordner, die dieses Paket anfassen darf (auch neu entstehende): Diese Liste ' +
      'IST die Schreibsperre — was nicht drinsteht, kann er nicht schreiben.',
    auftragZusatzKeines:
      '\nHinter dir liegt kein Block, der ein Arbeitspaket umsetzt — schneide genau ein Paket ' +
      'und lass zielBlock leer; es gilt dann für alle. Nenne in erlaubteDateien trotzdem die ' +
      'Dateien und Ordner, die dieses Paket anfassen darf.',
    // Zweiter Teil des Zusatzes (Abschlussprüfung Bauschritt 44): Er gilt NUR
    // für Blöcke mit dem Kennzeichen kartenZuteilung — nur sie dürfen
    // paket_melden rufen und nur sie werden auf Vollständigkeit geprüft. Ein
    // selbstgebauter Block, der bloß „Arbeitspaket" liefert, bekam diesen Satz
    // vorher ebenfalls: Folgte er ihm, wies ihn die Prüfung ab („noch kein
    // Paket gemeldet"), und paket_melden löste für ihn eine Rechte-Rückfrage
    // aus — aufgefordert zu etwas, das ihm verwehrt ist, und für den Gehorsam
    // abgewiesen.
    aufgabenZusatz:
      ' Nenne je Paket außerdem in aufgabenIds die Aufgaben-Karten aus deiner ' +
      'paket_melden-Meldung, die es abdeckt — FlowForge prüft, ob jede gemeldete Aufgabe in ' +
      'mindestens einem Paket vorkommt, und fordert sonst nach.',
    // Nachforderung (BAUPLAN 44): dasselbe erprobte Muster wie Startanleitung
    // und Prüfbefehl — nichts neu erarbeiten, nur nachtragen. Was fehlt, steht
    // NAMENTLICH da; „irgendetwas ist unvollständig" wäre eine Schnitzeljagd.
    nachforderung: (aufgaben, ziele) =>
      '\n\nNachforderung von FlowForge zu deinem Zuschnitt: Er deckt nicht alles ab. Arbeite ' +
      'jetzt NICHTS neu und ändere nichts am Projekt — rufe allein melde_arbeitspaket erneut auf ' +
      '(ein Aufruf mit ALLEN Paketen, er ersetzt den bisherigen).' +
      (aufgaben.length
        ? '\nDiese Aufgaben deines gemeldeten Pakets kommen in keinem Zuschnitt vor — trage sie ' +
          'in aufgabenIds des Pakets ein, das sie umsetzt (oder schneide ein weiteres Paket ' +
          'dafür):\n' +
          aufgaben.map((a) => '- ' + a).join('\n')
        : '') +
      (ziele.length
        ? '\nDiese benannten Ziele haben kein Paket bekommen — jedes braucht eines mit eigenen ' +
          'Fertig-Kriterien (zielBlock = Blocknummer):\n' +
          ziele.map((z) => '- ' + z).join('\n')
        : '') +
      '\nGehört eine Aufgabe wirklich nicht in dieses Paket, sag das im Feld anmerkung — dann ' +
      'weiß der Nutzer, warum sie liegen bleibt.',
    // Ohne paket_melden gibt es nichts, wogegen gemessen werden könnte.
    nachforderungPaket:
      '\n\nNachforderung von FlowForge: Du hast nicht gemeldet, an welchen Aufgaben-Karten dieser ' +
      'Lauf arbeitet. Arbeite jetzt NICHTS neu — rufe paket_melden auf (aufgabenIds = ids der ' +
      'offenen Aufgaben-Karten deiner Kartenauswahl; leer, wenn dein Auftrag allein aus dem Feld ' +
      'kam) und danach melde_arbeitspaket erneut mit allen Paketen. Ohne die Paket-Meldung ' +
      'bekommt keine Karte dieses Laufs ihre Herkunft, und niemand prüft, ob dein Zuschnitt ' +
      'vollständig ist.'
  },
  agentenKarten: {
    kontext: (liste, themen = []) =>
      'Aktuelle Projektkarten (von FlowForge für diesen Lauf ausgewählt):\n' +
      liste +
      '\n\nWeitere Karten kannst du über die karten-Werkzeuge lesen, anlegen, aktualisieren und erledigen. ' +
      texte.agentenKarten.themenRegel(themen) +
      '\n\n',
    // Themen (BAUPLAN 30): Die vorhandenen Themen stehen im Auftrag — bewusst
    // NICHT in der Werkzeugbeschreibung (je Turn geänderte Beschreibungen
    // brächen den Prompt-Cache).
    themenRegel: (themen) =>
      (themen.length
        ? `Vorhandene Themen: ${themen.join(', ')}. `
        : 'Es gibt noch keine Themen. ') +
      'Jede neue Karte braucht ein thema: sortiere sie primär in ein vorhandenes Thema ein — ' +
      'ein neues Thema nur, wenn wirklich keines passt.',
    themenZeile: (themen) => `Vorhandene Themen: ${themen.join(', ')}.`,
    angelegt: (karte) => `Karte angelegt: „${karte.titel}" (${karte.sorte}, id ${karte.id}).`,
    aktualisiert: (karte) => `Karte aktualisiert: „${karte.titel}" (id ${karte.id}).`,
    erledigtGesetzt: (karte, erledigt) =>
      erledigt
        ? `Aufgabe „${karte.titel}" ist jetzt als erledigt markiert.`
        : `Aufgabe „${karte.titel}" ist wieder offen.`,
    unbekannteId: (id) =>
      `Keine Karte mit der id ${id} gefunden. Hol dir die aktuellen ids mit karten_uebersicht.`
  },
  // Übergaben zwischen Blöcken (SPEC §4.3): Der Abschlusstext eines Blocks wird
  // Folgeblöcken mit passendem „braucht" in den Auftrag gereicht.
  agentenUebergabe: {
    ueberschrift: 'Übergaben aus den vorherigen Blöcken dieses Laufs:\n\n',
    eintrag: (etikett, blockName, text) => `### ${etikett} — von Block „${blockName}"\n${text}\n\n`,
    // Fan-out ohne Datenverlust (BAUPLAN 34): Liefern mehrere gleich nahe
    // Vorfahren dasselbe Etikett (zwei Angreifer vor dem Bauer), bekommt der
    // Nachfolger alle nummeriert — früher gewann still einer.
    eintragMehrfach: (etikett, nummer, gesamt, blockName, text) =>
      `### ${etikett} (${nummer} von ${gesamt}) — von Block „${blockName}"\n${text}\n\n`,
    auftragEinleitung: 'Dein Arbeitsauftrag:\n',
    // Einstellung „Nur-lesende Blöcke dürfen Befehle ausführen" (Zweit-Audit
    // D-01): Die Blockaufträge verbieten Befehle kategorisch — ohne diesen
    // Zusatz versucht der Agent es auftragsgemäß gar nicht erst, obwohl die
    // Sperre im Motor längst gelockert ist.
    nurLesenBefehleZusatz:
      '\n\nZusatz von FlowForge: Die Einstellung „Nur-lesende Blöcke dürfen Befehle ' +
      'ausführen" ist an — abweichend von deinem Auftrag darfst du in diesem Lauf ' +
      'Befehle ausführen (z.B. Prüfskripte oder Tests, um deine Funde zu belegen). ' +
      'Es gelten die normalen Befehls-Regeln: Git und die Prüfmappe bleiben gesperrt, ' +
      'Unbekanntes löst eine Rückfrage aus. Die Schreib-Werkzeuge für Dateien bleiben ' +
      'für diesen Block gesperrt; für Karten gilt weiter, was dein Auftrag sagt.',
    // Empfänger im Auftrag (BAUPLAN 43): Wer geprüft hat, sagt der Vorspann
    // aus dem Schaubild — hier steht nur noch die Sache.
    prueferRueckmeldung: (kritik) =>
      '\n\nRückmeldung aus der Prüfung der letzten Runde (bitte beheben):\n' + kritik,
    // Gebündelte Rückführung (BAUPLAN 47): Schicken mehrere Prüfer denselben
    // Block zurück, steht jede Kritik unter ihrem Absender — der Bauer sieht,
    // wessen Beanstandung er gerade behebt; mehrere Teile stehen untereinander.
    prueferRueckmeldungTeil: (prueferName, kritik) => `Von „${prueferName}":\n${kritik}`,
    // Reparatur-Runde beim Prüfer (Entscheidung Georg, 12.08.2026): nur die
    // Beanstandungen der letzten Runde nachprüfen, keine erneute Vollprüfung.
    prueferNachpruefung: (kritik) =>
      '\n\nDies ist eine Reparatur-Runde: Deine Beanstandungen aus der letzten Runde wurden ' +
      'behoben. Prüfe in dieser Runde NUR diese Beanstandungen nach — keine erneute ' +
      'Vollprüfung, keine neuen Prüffelder. Deine Beanstandungen von letzter Runde:\n' + kritik,
    // Lokale Vorreparatur (BAUPLAN 20): ehrlich gesagt, WER repariert hat.
    lokaleNachpruefung: (kritik) =>
      '\n\nDies ist eine Nachprüfung: Eine kleine lokale KI hat versucht, deine ' +
      'Beanstandungen aus der letzten Runde mechanisch zu beheben. Prüfe in dieser Runde ' +
      'NUR diese Beanstandungen nach — keine erneute Vollprüfung, keine neuen Prüffelder. ' +
      'Sei streng: Ein kleines Modell macht Fehler, übernimm nichts ungeprüft. ' +
      'Deine Beanstandungen von letzter Runde:\n' + kritik,
    // Diff der bisherigen Runden (BAUPLAN 34, Retained Reasoning light): Der
    // frische Bauer soll nicht neu erkunden, sondern dort weitermachen, wo er
    // aufgehört hat — FlowForge rechnet den Unterschied aus den Sicherungspunkten.
    eigeneAenderungen: (diff) =>
      '\n\nDas hast du (derselbe Block) in diesem Lauf bisher am Projekt geändert — von ' +
      'FlowForge aus den Sicherungspunkten gerechnet, nicht von dir erzählt. Nimm es als ' +
      'gegeben: Erkunde diese Stellen nicht neu und triff keine anderen ' +
      'Entwurfsentscheidungen als beim letzten Mal — behebe nur die Beanstandungen.\n' +
      diff,
    // Gefilterter Diff (BAUPLAN 45): Der Überblick zeigt nur noch die eigene
    // Dateiliste. Was dabei wegfiel, wird gesagt statt verschwiegen — sonst
    // hielte der Agent den Ausschnitt für den ganzen Stand. Ohne „weitere"
    // formuliert: Der Satz steht auch dann allein da, wenn nach dem Filtern
    // GAR keine Datei übrig blieb — und da wäre „weitere" schlicht falsch.
    diffAusserhalb: (anzahl) =>
      `\n\n(${anzahl} ${anzahl === 1 ? 'geänderte Datei liegt' : 'geänderte Dateien liegen'} ` +
      `außerhalb deiner Dateiliste und ${anzahl === 1 ? 'ist' : 'sind'} hier nicht gezeigt — ` +
      `${anzahl === 1 ? 'sie gehört' : 'sie gehören'} anderen Blöcken.)`,
    // Diff für den Prüfer in der Nachprüfung: was sich seit seinem Urteil getan hat.
    aenderungenSeitUrteil: (diff) =>
      '\n\nDas hat sich am Projekt geändert, seit du dein Urteil gefällt hast — von ' +
      'FlowForge aus den Sicherungspunkten gerechnet (die Prüfmappe pruefung/ ist ' +
      'ausgenommen, deine eigenen Tests stehen also nicht darin):\n' + diff,
    // Das eigene Fazit der letzten Runde ist das „warum" zum Diff.
    vorFazit: (fazit) =>
      '\n\nDein eigenes Fazit aus der letzten Runde (so hast du es damals begründet):\n' + fazit,
    // Lieferschein (BAUPLAN 42): Ein neuer Anlauf desselben Blocks braucht eine
    // neue Meldung — die alte gehörte zum vorherigen Stand. Bei Nachforderungen
    // (Startanleitung, Prüfbefehl, Rauchtest) hat sich inhaltlich meist nichts
    // geändert; damit das nicht neu erarbeitet werden muss, steht die eigene
    // Meldung von eben im Auftrag.
    meldungWiederholen: (vorher) =>
      '\n\nZur Ergebnis-Meldung: Deine Meldung aus dem letzten Anlauf ist mit ihm verfallen — ' +
      'melde am Ende dieses Anlaufs erneut. Hat sich inhaltlich nichts geändert, melde ' +
      'unverändert dasselbe wie eben; sonst passe genau das an, was jetzt anders ist. Deine ' +
      'Meldung von eben:\n' + vorher,
    startanleitungNachforderung:
      '\n\nNachforderung von FlowForge: Dieser Auftrag ist schon umgesetzt, aber die ' +
      'Startanleitung des Projekts fehlt noch. Lege sie jetzt mit dem Werkzeug ' +
      'startanleitung_setzen an (beschreibung, dazu befehl und/oder adresse). ' +
      'Ändere sonst nichts am Projekt.',
    // Tor ohne KI (BAUPLAN 35): Der Prüfbefehl ist das Pflicht-Artefakt des
    // Prüfers — ohne ihn kann FlowForge in Reparatur-Runden nicht selbst
    // nachprüfen und muss jedes Mal einen Prüfer-Agenten bezahlen.
    pruefbefehlNachforderung:
      '\n\nNachforderung von FlowForge: Du hast in diesem Lauf schon geprüft, aber keinen ' +
      'gültigen Prüfbefehl hinterlegt. Prüfe jetzt NICHTS neu und führe keine Tests erneut ' +
      'aus: Lege allein den Startbefehl deiner Prüfmappe mit dem Werkzeug pruefbefehl_setzen ' +
      'fest (ein einzelner Aufruf, der alle deine Prüfungen ausführt und bei einem Fehlschlag ' +
      'mit Fehlercode endet).',
    // Rot-Fall des Tors: Das Protokoll geht neben der Kritik an den Bauer —
    // die Beanstandungs-Zeilen allein sagen nicht, wo es klemmt.
    torProtokoll: (protokoll) =>
      '\n\nDas hat FlowForge selbst gemessen: Der aufbewahrte Prüfbefehl wurde ohne Agenten ' +
      'abgespielt und ist rot. Nimm dieses Protokoll als Tatsache — es stammt aus einem ' +
      'echten Lauf, nicht aus einer Einschätzung:\n' + protokoll,
    // Grün-Fall des Tors: Der Prüfer-Agent prüft nur noch, was seine Tests
    // nicht abdecken — der Rest ist deterministisch belegt.
    torGruenNachpruefung: (befehl, kritik) =>
      '\n\nDies ist eine Nachprüfung — und FlowForge hat deinen Prüfbefehl vorher selbst ' +
      `abgespielt: „${befehl}" läuft GRÜN durch. Alle Beanstandungen, die deine Prüfungen ` +
      'abdecken, gelten damit als behoben; führe sie nicht erneut aus. Prüfe in dieser Runde ' +
      'NUR die Beanstandungen nach, die deine Prüfungen NICHT abdecken — keine erneute ' +
      'Vollprüfung, keine neuen Prüffelder. Ist damit alles erledigt, urteile ' +
      'PRUEFUNG: BESTANDEN. Deine Beanstandungen von letzter Runde:\n' + kritik,
    // Rauchtest (BAUPLAN 35): Die Startanleitung startet nicht — das merkt
    // FlowForge selbst, bevor der Prüfer eine Runde kostet.
    rauchtestRueckmeldung: (ausgabe) =>
      '\n\nNachforderung von FlowForge: Dein Auftrag ist umgesetzt, aber die Startanleitung ' +
      'des Projekts läuft nicht an — FlowForge hat sie selbst einmal kurz gestartet und wieder ' +
      'gestoppt. Bring das in Ordnung: Entweder der Code startet nicht (dann repariere ihn) ' +
      'oder die Startanleitung stimmt nicht mehr (dann setze sie mit startanleitung_setzen neu). ' +
      'Baue sonst nichts Neues. Die Ausgabe des Startversuchs:\n' + ausgabe,
    // Baseline (BAUPLAN 35): ehrlich, was schon vor dem Lauf kaputt war —
    // damit niemand Altlasten für seine eigene Arbeit hält.
    baselineRot: (befehl, ausgabe) =>
      `\n\nStand vor diesem Lauf: FlowForge hat den aufbewahrten Prüfbefehl „${befehl}" vor ` +
      'dem Start abgespielt — er war schon damals ROT. Diese Fehlschläge sind Altlasten, nicht ' +
      'deine: Du musst sie in diesem Paket nicht beheben (FlowForge legt sie als Aufgaben-Karte ' +
      'ab), und sie zählen nicht als Fehlschlag deiner Arbeit. Was neu dazukommt, zählt sehr ' +
      'wohl. Das war vorher schon rot:\n' + ausgabe,
    // Übergabe an den nächsten Anlauf desselben Blocks nach einem Übertrag.
    uebertragFortsetzung: (uebergabe) =>
      '\n\nÜbergabe deines Vorgängers: Genau dieser Auftrag lief schon in einem früheren ' +
      'Anlauf, dessen Kontext voll wurde. Setze die Arbeit nahtlos fort — beginne NICHT ' +
      'von vorn und wiederhole keine erledigten Schritte. Die Übergabe:\n' + uebergabe,
    uebertragOhneUebergabe:
      '\n\nHinweis von FlowForge: Genau dieser Auftrag lief schon in einem früheren Anlauf, ' +
      'dessen Kontext voll wurde — eine Übergabe liegt leider nicht vor. Prüfe zuerst den ' +
      'Stand im Projektordner und an den Karten, und setze die Arbeit dann fort, ohne ' +
      'Erledigtes zu wiederholen.',
    // Abnahme eines lokalen Prüfers (BAUPLAN 50): Der Prüfbeleg stammt von
    // einem Prüfer der Klasse „lokal" — der Claude-Prüfer dahinter ist seine
    // Abnahme. Derselbe Ton wie lokaleNachpruefung: streng, nichts ungeprüft.
    // Ohne Katalog-Blocknamen (BAUPLAN 43): „Prüf-Block", nicht „Prüfer".
    abnahmeLokalerPruefer: (name, modellName, torBestaetigungText) =>
      `\n\nDieser Prüfbeleg stammt von „${name}" — einem Prüf-Block, der auf Georgs lokaler ` +
      `KI läuft (Klasse ${modellName}). Du bist seine ABNAHME: Vollziehe sein Urteil nach — ` +
      'Stichproben nachstellen, Beanstandungen und Freisprüche gegenprüfen — und übernimm ' +
      'nichts ungeprüft. Sei streng: Ein kleines Modell übersieht Fehler und erklärt Dinge ' +
      'für geprüft, die es nicht angefasst hat. Dein Urteil zählt; weicht es von seinem ab, ' +
      'ist das kein Fehler, sondern genau dein Auftrag. Mechanisches Tor-Ergebnis zu seinem ' +
      `Prüfbefehl: ${torBestaetigungText}`
  },
  // Empfänger im Auftrag (BAUPLAN 43): FlowForge stellt jedem Blockauftrag
  // drei aus dem Schaubild gerechnete Angaben voran — die Empfänger (Block,
  // Etikett, wozu), die Kette in einer Zeile und die Position. Quelle sind
  // ausschließlich Blöcke und Pfeile, nicht der Koordinator und nicht der
  // Laufstatus; derselbe Block liest in Runde 2 dasselbe wie in Runde 1.
  //
  // Formulierungsregel, verbindlich: immer aus der EMPFÄNGERSICHT („Er misst
  // deine Arbeit an …"), nie als „danach kommt noch wer" — sonst schiebt der
  // Agent Verantwortung weiter. Deshalb steckt die Verantwortungssprache
  // ausschließlich in den Empfänger-Zeilen; Kette und Position sind reine
  // Ortsangaben ohne Erzählung. Aufträge anderer Blöcke werden nie mitgegeben.
  agentenVorspann: {
    ueberschrift:
      'Dein Platz in diesem Schaubild — von FlowForge aus Blöcken und Pfeilen gerechnet, ' +
      'nicht erzählt:\n\n',
    empfaengerUeberschrift: 'Wer bekommt, was du lieferst:\n',
    // „bezeichnung" ist immer texte.ticker.blockBezeichnung(nummer, name),
    // also „Block 3 „Prüfer · UI"" — mit Zusatznamen und Nummer, damit zwei
    // gleiche Blocksorten unterscheidbar bleiben (BAUPLAN 41).
    empfaenger: (bezeichnung, etikett, wozu) =>
      `- ${bezeichnung} bekommt deine Lieferung „${etikett}". Er ${wozu}.\n`,
    // Optionale Bedarfe brauchen eine eigene Sprache: Der Empfänger verlangt
    // nichts — verspricht der Vorspann hier zu viel, arbeitet der Block gegen
    // eine Erwartung, die es gar nicht gibt.
    empfaengerOptional: (bezeichnung, etikett, wozu) =>
      `- ${bezeichnung} nimmt deine Lieferung „${etikett}" mit, falls du eine lieferst — ` +
      `verlangt wird sie nicht. Er ${wozu}.\n`,
    // Mehrere Empfänger mit demselben Etikett und demselben „wozu" (BAUPLAN 44,
    // mitgenommen aus 43): Mit mehreren benannten Zielen hinter Paket schneiden
    // stand derselbe Satz sonst dreimal im Auftrag — in JEDEM Anlauf. Gebündelt
    // wird der Satz, nicht die Empfänger: Weggelassen wird keiner, denn sie
    // tragen die Verantwortungssprache. Bei genau EINEM Empfänger bleibt der
    // Wortlaut Zeichen für Zeichen der bisherige.
    empfaengerMehrere: (bezeichnungen, etikett, wozu) =>
      `- ${bezeichnungen.join(', ')} bekommen deine Lieferung „${etikett}". Jeder von ihnen ` +
      `${wozu}.\n`,
    empfaengerMehrereOptional: (bezeichnungen, etikett, wozu) =>
      `- ${bezeichnungen.join(', ')} nehmen deine Lieferung „${etikett}" mit, falls du eine ` +
      `lieferst — verlangt wird sie nicht. Jeder von ihnen ${wozu}.\n`,
    // Ehrlicher Rückfall, wenn der Empfänger-Block kein brauchtWozu zu diesem
    // Etikett hat (selbstgebaute Blöcke ohne Angabe): lieber zugeben, dass es
    // nicht genauer steht, als ein Wozu zu erfinden.
    wozuRueckfall: (etikett) =>
      `verlangt „${etikett}" laut Schaubild für seine eigene Arbeit — sein Auftrag sagt ` +
      'nicht genauer, wofür; liefere deshalb vollständig und ohne Auslassungen',
    keiner:
      'Was du lieferst, geht an niemanden — du bist der letzte Schritt in diesem Schaubild. ' +
      'Arbeite trotzdem vollständig: Deine Meldung ist das Ergebnis, das der Nutzer im ' +
      'Laufbericht liest.\n',
    // Selbstgebaute Blöcke haben freie Etiketten ohne Eindeutigkeit — ein
    // Tippfehler im eigenen Etikett sieht sonst aus wie „ich bin der Letzte".
    // Der häufigste Fall ist EIN Nachfahre mit vertipptem Etikett, deshalb ist
    // der Satz zahlneutral gebaut („gibt es noch …", „niemand"): Die Mechanik
    // übergibt eine fertige Liste und weiß nicht, ob sie einen oder fünf Namen
    // enthält.
    // Ein Block ohne liefert-Etiketten (Sessionende, Karten-Probe, Rechte-Probe,
    // jeder selbstgebaute Block ohne Etikett) hat gar keine Übergabe — an ihm
    // kann nichts andocken. Ohne eigenen Baustein bliebe die Überschrift „Wer
    // bekommt, was du lieferst" hier unbeantwortet; der Tippfehler-Satz unten
    // wäre eine Schnitzeljagd nach einem Etikett, das es nicht gibt.
    ohneEtiketten:
      'Was du tust, geht an niemanden: Dein Block trägt kein Liefer-Etikett, also bekommt ' +
      'kein anderer Block etwas von dir in seinen Auftrag — auch die, die im Schaubild ' +
      'hinter dir stehen, arbeiten ohne deine Meldung. Arbeite trotzdem vollständig: Deine ' +
      'Meldung ist das Ergebnis, das der Nutzer im Laufbericht liest.\n',
    // Die Nachfahren-Aufzählung ist die einzige Angabe des Vorspanns, die mit
    // dem Schaubild wächst — bei 40 Blöcken stünden hier 39 Namen, und der Satz
    // hängt an JEDEM Anlauf dieses Blocks (Reparatur-Runde, Nachforderung,
    // Übertrag). Für seinen Zweck (ein vertipptes eigenes Etikett sichtbar
    // machen) genügen die ersten Namen; der Rest wird ehrlich gezählt statt
    // verschwiegen.
    weitereBloecke: (anzahl) => `${anzahl} weitere`,
    keinerTrotzNachfahren: (namenListe) =>
      'Was du lieferst, geht an niemanden. Hinter dir gibt es im Schaubild zwar noch ' +
      `${namenListe} — dort verlangt aber niemand eines deiner Etiketten. Arbeite trotzdem ` +
      'vollständig; passt das nicht zu deiner Erwartung, ist meist ein Etikett anders ' +
      'geschrieben als gedacht.\n',
    // Verdrängung ehrlich sagen (BAUPLAN 40): Liegt ein zweiter Lieferant
    // desselben Etiketts näher am Empfänger, kommt deine Lieferung dort nicht
    // an — das gehört in den Vorspann, nicht erst in den Laufbericht.
    verdraengt: (etikett, gewinnerBezeichnung) =>
      `- Deine Lieferung „${etikett}" kommt bei niemandem an: ${gewinnerBezeichnung} liefert ` +
      'dasselbe Etikett und liegt näher am Empfänger — die nähere Lieferung gewinnt. Arbeite ' +
      'trotzdem vollständig; dein Ergebnis steht im Laufbericht.\n',
    // Vierte Angabe für Prüf-Blöcke: Wohin die Kritik bei „fehlgeschlagen"
    // wirklich geht, rechnet FlowForge aus dem Schaubild (gespeicherte Wahl,
    // sonst der nächste Vorfahre) — kein Katalogtext kann das wissen.
    rueckfuehrung: (bezeichnung) =>
      `Urteilst du „fehlgeschlagen", geht deine Kritik an ${bezeichnung}. Er behebt daraus, ` +
      'was du beanstandest — schreib jede Beanstandung so, dass sie dort ohne Rückfrage zu ' +
      'beheben ist: was nicht hält, wo, und wie schwer.\n',
    kette: (zeile) => `Die Kette dieses Schaubilds: ${zeile}\n`,
    position: (nummer, gesamt) => `Du bist Block ${nummer} von ${gesamt} in diesem Schaubild.\n`,
    einzelblock: 'Du bist der einzige Block in diesem Schaubild.\n'
  },
  // Eine Motor-Session pro Lauf (BAUPLAN 19): Der Koordinator in der Session
  // verteilt nur Aufträge — jeder Block läuft als frischer Agent. Den echten
  // Arbeitsauftrag setzt FlowForge beim Agent-Aufruf selbst ein, damit der
  // Koordinator schlank bleibt und nichts verfälschen kann.
  agentenLaufSession: {
    koordinatorSystem:
      'Du bist der Koordinator eines FlowForge-Laufs. Du erledigst niemals selbst Arbeit, ' +
      'liest keine Dateien und nutzt ausschließlich das Agent-Werkzeug. Wenn FlowForge dir ' +
      'einen Block ankündigt, startest du GENAU EINEN Block-Agenten: Rufe das Agent-Werkzeug ' +
      'auf mit subagent_type "block" und run_in_background false; als prompt genügt das Wort ' +
      'AUFTRAG — FlowForge setzt den echten Arbeitsauftrag beim Aufruf selbst ein. Wenn der ' +
      'Agent fertig ist, antwortest du nur mit: OK — das Fazit liest FlowForge selbst mit. ' +
      'Antworte auf Deutsch.',
    dispatch: (blockName) =>
      `FlowForge: Der Block „${blockName}" steht an. Starte jetzt genau einen Block-Agenten ` +
      '(Agent-Werkzeug, subagent_type "block", run_in_background false, prompt: AUFTRAG). ' +
      'Antworte danach nur mit: OK',
    blockAgentSystem: (projektPfad, titelMax, textMax) =>
      'Du bist ein Block-Agent von FlowForge und führst genau den Arbeitsauftrag aus, den ' +
      'du bekommst — nicht mehr und nicht weniger. Antworte auf Deutsch. Dein Ergebnis meldest ' +
      // Empfänger im Auftrag (BAUPLAN 43): Dieser System-Prompt gilt für JEDEN
      // Block-Agenten und wird einmal je Motor gebaut — er kann je Blockinstanz
      // gar nicht anders lauten und darf deshalb keinen Empfänger behaupten.
      // Wer die Lieferung bekommt (und ob überhaupt jemand), sagt der Vorspann.
      'du am Ende über das melde-Werkzeug, das dein Auftrag nennt — nur was dort steht, kommt ' +
      'überhaupt an.\n' +
      'Halte dein Arbeitsgedächtnis schlank — es ist der teuerste Teil des Laufs: Breites ' +
      'Suchen und Einlesen delegierst du an Unteraufgaben (Agent-Werkzeug), die dir nur ihr ' +
      'kompaktes Fazit zurückgeben. Lies keine Datei doppelt und nichts auf Vorrat.\n' +
      `Der Projektordner ist: ${projektPfad}\n` +
      'Verwende bei Datei-Werkzeugen (Read/Write/Edit) ausschließlich Pfade relativ zum ' +
      'Projektordner oder diesen absoluten Windows-Pfad. Niemals POSIX-Pfade wie /tmp/… ' +
      'oder /c/… verwenden — sie zeigen auf Windows auf falsche Orte.\n' +
      'Projektkarten: FlowForge verwaltet strukturierte Karten (Status, Aufgabe, ' +
      'Entscheidung, Wissen) als Gedächtnis des Projekts. Lies und schreibe sie ' +
      'ausschließlich über die karten-Werkzeuge (karten_uebersicht, karte_anlegen, ' +
      'karte_aktualisieren, karte_erledigen) — niemals über die Datei karten.json. ' +
      `Harte Regeln: Titel höchstens ${titelMax} Zeichen, Inhalt höchstens ${textMax} ` +
      'Zeichen; wer mehr zu sagen hat, legt mehrere fokussierte Karten an. Es gibt genau ' +
      'eine Status-Karte — sie kann weder gelöscht noch neu angelegt werden.',
    nurEinAgent:
      'FlowForge: Für diesen Block lief bereits ein Agent. Starte keinen weiteren — ' +
      'antworte nur mit: OK',
    koordinatorGesperrt:
      'FlowForge: Als Koordinator erledigst du nichts selbst — die Arbeit erledigen die ' +
      'Block-Agenten. Antworte nur mit: OK',
    // Automatischer Übertrag (SPEC §5): Die Lauf-Session ist fast voll — der
    // Koordinator schreibt die Übergabe, der Block läuft frisch erneut an.
    uebertragAnweisung:
      'WICHTIG — Anweisung von FlowForge: Das Kontextfenster dieser Lauf-Session ist fast ' +
      'voll; der laufende Block-Agent wurde unterbrochen, sein Block wird in einer frischen ' +
      'Session neu angestoßen. Starte KEINEN weiteren Agenten. Schreibe als Antwort eine ' +
      'kurze Übergabe für den nächsten Anlauf dieses Blocks: 1. Was in diesem Lauf bisher ' +
      'erledigt wurde (die Fazite kennst du). 2. Was der unterbrochene Block zuletzt tun ' +
      'sollte. 3. Was der nächste Anlauf wissen muss, um nahtlos weiterzumachen.'
  },
  // Nachlauf-Chat (BAUPLAN 27): Systemtexte des Chat-Motors. Der Chat ist die
  // fortgesetzte Lauf-Session — der Koordinator-Drill („antworte nur mit OK")
  // steckt noch im Verlauf und wird hier ausdrücklich aufgehoben.
  agentenChat: {
    // Kurzregeln der Bedienung (BAUPLAN 33): das Nötigste im Systemtext — für
    // alles Weitere liest der Chat gezielt in der SPEC.md (Index unten).
    kurzregeln:
      'Kurzregeln von FlowForge: Ein Projekt = ein Ordner mit Karten (Aufgabe, Entscheidung, ' +
      'Wissen, genau eine Status-Karte, Prüfkarten — höchstens 400 Zeichen Inhalt, Themen als ' +
      'zweite Ebene), Workflows (Schaubild aus Block-Karten und Pfeilen), Laufberichten und ' +
      'Sicherungspunkten (automatisch vor jedem Lauf und nach jedem schreibenden Block; ' +
      'Wiederherstellen mit Vorschau). Die Projektansicht hat links die Karten-Seitenleiste ' +
      '(Gruppen Arbeit · Wissen · Geprüft · Erledigt, Aufräum-Knöpfe „Karten am Code prüfen" ' +
      'und „Themen sortieren"), in der Mitte Tabs (Schaubild · Lauf · Laufberichte · ' +
      'Sicherungspunkte · Metriken · App) und rechts die Blockbibliothek in Kategorien ' +
      '(Vorlagen · Auftrag finden · Bauen · Prüfen · Gedächtnis · Eigene · Übung). Blöcke zieht ' +
      'man aufs Schaubild und verbindet sie mit Pfeilen; Prüfkarten zieht man auf einen ' +
      'Prüfer-Block; Karten zieht man in die Kartenauswahl unter dem Schaubild; „Lauf starten" ' +
      'wechselt in den Lauf-Tab (Liveticker, Denk-Bereich, Fragen des Agenten, Stopp in zwei ' +
      'Stufen). Vorlagen: „Neue App starten" (nur Spec-Interview), „Feature hinzufügen" (Paket ' +
      'schneiden → Angreifer → Bauer → Prüfer → Sessionende), „Bug jagen" (Diagnose → Bauer → ' +
      'Prüfer → Sessionende). Der App-Tab startet die gebaute App über ihre Startanleitung und ' +
      'zeigt die Ausgabe live. Titelleiste rechts: „Co-Pilot" (dieser Chat), „Metriken", ' +
      '„Einstellungen" (Motor-Modus, Automodus, lokale Helfer-KI).',
    system: ({ projektPfad, datenordner, titelMax, textMax, specPfad, specIndex }) =>
      'Du bist der Co-Pilot von FlowForge — ein Chat, der dem Nutzer bei der Bedienung von ' +
      'FlowForge und bei seinem Projekt hilft. Falls du vorher der Koordinator eines Laufs ' +
      'warst: Diese Rolle ist beendet — die Koordinator-Regeln (nur delegieren, nur mit OK ' +
      'antworten) gelten NICHT mehr. Antworte frei, hilfreich und auf Deutsch; deine Antwort ' +
      'geht direkt an den Nutzer, der kein Programmierer ist — erkläre in Alltagssprache, ' +
      'fasse dich kompakt. Die Antwort wird als reiner Text angezeigt: kein Markdown ' +
      '(keine Überschriften, Tabellen oder Code-Blöcke; höchstens **fett** für Knopfnamen), ' +
      'Absätze und einfache Listen mit „-" oder „1." sind gut.\n' +
      texte.agentenChat.kurzregeln +
      '\n' +
      (specPfad
        ? 'FlowForges Produktbeschreibung (SPEC.md) beschreibt die Gegenwart der App vollständig ' +
          `— lies sie GEZIELT mit dem Read-Werkzeug (offset/limit) aus dieser Datei: ${specPfad}\n` +
          'Abschnitts-Index (Zeilennummern):\n' +
          specIndex +
          '\nBei Bedienfragen: zuerst den passenden Abschnitt lesen, dann antworten — erfinde ' +
          'keine Knöpfe oder Abläufe.\n'
        : 'Die Produktbeschreibung liegt dieser Installation nicht bei — sag bei ' +
          'Bedienfragen ehrlich, was du aus den Kurzregeln weißt und was nicht.\n') +
      (projektPfad
        ? `Das offene Projekt liegt in: ${projektPfad}\n` +
          'Du darfst selbst Dateien lesen und suchen (auch über Unteraufgaben mit dem ' +
          'Agent-Werkzeug). Standardmäßig bist du nur-lesend: Der Normalweg für Erkenntnisse ist ' +
          'eine Aufgaben-Karte („leg das als Aufgabe an") — der nächste Bau-Lauf arbeitet sie mit ' +
          'Sicherungspunkt und Prüfer ab. Nur wenn der Nutzer den Schalter „Chat darf reparieren" ' +
          'anschaltet, darfst du Dateien ändern und Befehle für ihn ausführen (npm install, eine ' +
          'Erstanmeldung anlegen …); FlowForge legt vor deiner ersten Änderung selbst einen ' +
          'Sicherungspunkt an. Git, die Prüfmappe pruefung/ und FlowForges Verwaltungsdateien ' +
          'sind immer tabu. Läuft im Projekt gerade ein Workflow-Lauf, bist du hart nur-lesend ' +
          '(die Werkzeugantwort sagt es dir) — beantworte dann Fragen aus dem, was du lesen kannst.\n' +
          'Verwende bei Datei-Werkzeugen ausschließlich Pfade relativ zum Projektordner oder ' +
          'diesen absoluten Windows-Pfad — niemals POSIX-Pfade wie /tmp/… oder /c/….\n' +
          'Projektkarten liest und schreibst du ausschließlich über die karten-Werkzeuge ' +
          '(karten_uebersicht, karte_anlegen, karte_aktualisieren, karte_erledigen) — niemals ' +
          `über die Datei karten.json. Harte Regeln: Titel höchstens ${titelMax} Zeichen, Inhalt ` +
          `höchstens ${textMax} Zeichen; wer mehr zu sagen hat, legt mehrere fokussierte Karten an.\n` +
          'Die gebaute App des Projekts bedienst du über die app-Werkzeuge (app_starten, ' +
          'app_stoppen, app_neustarten, app_ausgabe) — derselbe Prozess, den der Nutzer im ' +
          'App-Tab sieht. Starte Server NIE über einen Befehl (er würde deinen Aufruf blockieren ' +
          'und beim nächsten Lauf sterben). Fragt der Nutzer, warum die App nicht startet: erst ' +
          'app_ausgabe lesen, dann antworten — beziehe dich erkennbar auf die Ausgabe. ' +
          'Laufberichte liegen im Ordner laufberichte/ (lesbar); die Startanleitung nennt Befehl ' +
          'und Adresse (startanleitung.json ist lesbar, gesetzt wird sie nur über startanleitung_setzen).'
        : 'Es ist KEIN Projekt offen (Projektübersicht): Du beantwortest nur Bedienfragen zu ' +
          'FlowForge. Dein Arbeitsordner ist FlowForges Datenordner ' +
          `(${datenordner}) — der ist für deine Werkzeuge gesperrt; Befehle und Schreiben ` +
          'sind hier gesperrt. Lies bei Bedarf ausschließlich die Produktbeschreibung über ihren ' +
          'absoluten Pfad. Fragt der Nutzer etwas zu einem konkreten Projekt, bitte ihn, das ' +
          'Projekt zu öffnen und dort zu fragen.'),
    // Während eines Laufs (BAUPLAN 33): Notiz vor der Nutzer-Nachricht — sonst
    // weiß die KI nicht, dass sie gerade hart nur-lesend ist.
    laufAktivNotiz:
      '[Notiz von FlowForge: Im Projekt läuft (oder wartet) gerade ein Workflow-Lauf. Du bist ' +
      'so lange hart nur-lesend — Karten anlegen, Dateien ändern, Befehle und Reparieren gehen ' +
      'erst nach dem Lauf. Beantworte die Frage aus dem, was du lesen kannst.]',
    // Frische Session statt Fortsetzung: der Laufbericht ist der Kontext.
    laufKontext: (text) =>
      '\nDie ursprüngliche Lauf-Session ist nicht mehr verfügbar. Hier der Laufbericht des ' +
      'Laufs, über den der Nutzer mit dir sprechen will:\n' + text,
    // Lokale Bilanz (BAUPLAN 51): kleiner Datenblock im Systemtext — nur
    // angehängt, wenn lokale Daten existieren (metrikRegeln.lokaleBilanz).
    // Der Co-Pilot ist das Sprachrohr des Nutzers: Er DARF diese Zahlen sehen
    // und daraus empfehlen, welche Blöcke lokal bleiben oder zurück zu Claude
    // sollen — in einen Lauf-Auftrag wandern sie nie (SPEC §3.4/§10). Die
    // Schwellen erzwingt schon die Rechenfunktion; der Text wiederholt die
    // Ehrlichkeits-Regel, damit die KI kleine Stichproben nicht schönredet.
    lokaleBilanzUrteile: {
      gut: 'lief gut',
      schlecht: 'lief schlecht',
      offen: 'kein eindeutiges Urteil',
      zuWenig: 'zu wenige Fälle für ein Urteil'
    },
    lokaleBilanzZeile: (z) => {
      const u = texte.agentenChat.lokaleBilanzUrteile[z.urteil] ?? z.urteil
      const quote = z.quote == null ? '' : `${Math.round(z.quote * 100)} %`
      if (z.art === 'zuarbeit')
        return (
          `- Lokale Zuarbeit ${z.modell} · ${texte.metriken.bereiche[z.bereich] ?? z.bereich}: ` +
          `${z.faelle} beurteilte Fälle, Quote ${quote || '—'}` +
          (z.gescheitert > 0 ? `, ${z.gescheitert} gescheitert` : '') +
          ` → ${u}`
        )
      if (z.art === 'block')
        return (
          `- Block „${z.block}" auf ${z.modell}: ${z.erstlaeufe} Erstläufe, ` +
          `${z.wiederholungen} Wiederholungen` +
          (z.ersteUrteile > 0 ? `, Erstbestehen ${quote} (${z.erstBestanden}/${z.ersteUrteile})` : '') +
          ` → ${u}`
        )
      return (
        `- Lokaler Prüfer ${z.lokalModell} vs. Abnahme ${z.abnahmeModell}: ` +
        `${z.faelle} Paare, Widerspruch ${quote || '—'} → ${u}`
      )
    },
    lokaleBilanz: (bilanz, stand) =>
      '\n\nLokale Bilanz (Stand ' + stand + ', aus den Messwerten der Metriken-Seite — für ' +
      'deine Empfehlungen an den Nutzer, welche Blöcke gut auf seiner lokalen KI laufen; ' +
      'diese Zahlen gehören NIE in einen Lauf- oder Karten-Text):\n' +
      bilanz.zeilen.map((z) => texte.agentenChat.lokaleBilanzZeile(z)).join('\n') +
      (bilanz.torNachspiele > 0
        ? `\n- Tor-Nachspiele gesamt: ${bilanz.torNachspiele}, davon drehte der Prüfbefehl ` +
          `${bilanz.torWidersprueche} lokale „bestanden"`
        : '') +
      (bilanz.weggelassen > 0 ? `\n- (${bilanz.weggelassen} weitere Zeilen mit weniger Fällen weggelassen)` : '') +
      '\nEhrlichkeits-Regel: Empfiehl „lokal lassen" oder „lokal umstellen" nur bei Zeilen ' +
      'mit mindestens 5 Fällen und dem Urteil „lief gut"; nenne bei jeder Empfehlung die ' +
      'Fallzahl. Bei weniger als 5 Fällen sag ehrlich: zu wenige Daten für ein Urteil.',
    berichtKopf: (workflow, zeit, zustand) =>
      `Workflow: ${workflow} · gestartet ${zeit} · Ausgang: ${zustand}`,
    berichtBlock: (name, zustand, text) => `\n### Block „${name}" (${zustand}):\n${text}`,
    berichtFehler: (text) => `\nFehler des Laufs: ${text}`
  },
  // Prüfkarten im Prüfer-Auftrag (BAUPLAN 18): Der Nutzer hat alte Prüfungen
  // auf diesen Prüf-Block gezogen — sie werden zusätzlich geprüft.
  // Prüfordner je Prüf-Instanz (BAUPLAN 41): Jeder schreibende Prüfer hat
  // seinen eigenen Unterordner in der Prüfmappe — sonst archiviert der erste
  // bestehende Prüfer die Tests aller anderen hinter seiner Prüfkarte.
  agentenPruefordner: {
    zusatz: (ordner) =>
      '\n\nDEIN PRÜFORDNER (von FlowForge zugewiesen): pruefung/' +
      ordner +
      '/\nAlle deine Prüfungen und Sammel-Skripte gehören ausschließlich dorthin — nicht ' +
      'direkt nach pruefung/ und nie in den Ordner eines anderen Prüf-Blocks (das ist gesperrt). ' +
      'Dein Prüfbefehl muss genau diesen Ordner ausführen (z.B. „npx vitest run pruefung/' +
      ordner +
      '"). Nur was in deinem Ordner liegt, bewahrt FlowForge nach bestandener Prüfung hinter ' +
      'deiner Prüfkarte auf.'
  },
  agentenPruefkarten: {
    einleitung:
      '\n\nZusätzlich von FlowForge — Wiederholungsprüfung: Der Nutzer hat die folgenden ' +
      'Prüfkarten auf diesen Prüf-Block gezogen. Führe deren Prüfungen ZUSÄTZLICH zu deiner ' +
      'eigentlichen Prüfung aus; die aufbewahrten Prüfdateien liegen schon in der Prüfmappe ' +
      '(je Karte ein eigener Unterordner). Passt eine alte Prüfung nicht mehr zum heutigen ' +
      'Code (verschobene Dateien, umgebaute Stellen, geänderte Pfade), passe sie in ihrem ' +
      'Unterordner an, statt sie zu verwerfen — FlowForge bewahrt die angepasste Fassung ' +
      'hinter der Karte auf. Scheitert eine dieser Prüfungen zu Recht, zählt das als nicht ' +
      'bestanden und gehört in deine Beanstandungen. Die Prüfkarten:\n',
    eintrag: (titel, text, ordner) => `- „${titel}" (Dateien in pruefung/${ordner}/): ${text}\n`,
    eintragOhneDateien: (titel, text) =>
      `- „${titel}" (keine aufbewahrten Prüfdateien — prüfe das Beschriebene mit frisch geschriebenen Prüfungen): ${text}\n`
  },
  // Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026): Recherche über
  // Ollama statt über Motor-Unteraufgaben — kostet kein Kontingent. Das lokale
  // Modell kann erfinden — deshalb trägt jedes Fazit einen ehrlichen
  // Warnhinweis, und die Agenten prüfen wichtige Fundorte selbst nach.
  // Zuschnitt (Wunsch Georg 18.08.2026): Die lokale KI darf auch mittelgroße,
  // zusammenhängende Aufträge und Neues mit klarer Beschreibung bekommen — die
  // Abnahme durch den Block-Agenten bleibt der Schiedsrichter.
  agentenLokaleHelfer: {
    werkzeugBeschreibung:
      'Delegiert einen rein lesenden Recherche-Auftrag (Dateien auflisten, lesen, ' +
      'durchsuchen) an die lokale Helfer-KI — sie kostet kein Kontingent. Liefert ein ' +
      'kompaktes Fazit mit Fundorten. Ruhig auch größere Aufträge: mehrere Dateien, ein ' +
      'ganzer Zusammenhang, eine Frage quer durchs Projekt. Die Stellen, auf die du deine ' +
      'Arbeit stützt, liest du selbst nach.',
    serverHinweis:
      'Die lokale Helfer-KI recherchiert rein lesend im Projektordner — auch bei größeren ' +
      'Einlese-Aufträgen. Nutze sie bevorzugt für Einlese- und Suchaufträge, statt eine ' +
      'Unteraufgabe des Motors zu starten.',
    // Nachrichtenform an die lokale KI (Wunsch Georg 18.08.2026): alles als
    // Nutzer-Nachricht — Werkzeug-Ergebnisse tragen deshalb ihre Herkunft im
    // Text, und das Nachhaken bei leerer Antwort ist eine gewöhnliche Nachricht.
    werkzeugErgebnis: (werkzeug, ergebnis) => `Ergebnis von ${werkzeug}:\n${ergebnis}`,
    nachhaken:
      'Deine Antwort war leer. Gib jetzt dein Fazit als normale Antwort aus — ' +
      'kompakt, auf Deutsch, mit Fundorten aus den Werkzeug-Ergebnissen. ' +
      'Kein Werkzeugaufruf mehr.',
    fazit: (text) =>
      'Fazit der lokalen Helfer-KI (kleines Modell — prüfe Fundorte, auf die du deine ' +
      'Arbeit stützt, selbst nach):\n' + text,
    gescheitert: (fehler) =>
      'Die lokale Helfer-KI konnte nicht recherchieren: ' +
      fehler +
      ' Erledige die Recherche stattdessen mit einer Unteraufgabe (Agent-Werkzeug) oder selbst.',
    // Trefferquote (BAUPLAN 23): nur wenn der Schalter „Trefferquote erfassen"
    // an ist — sonst gibt es weder Werkzeug noch Hinweis (kein Mehrverbrauch).
    // Die Abnahmen bei Entwürfen und Teilstücken bleiben davon unberührt
    // (sie steuern Übernahme und Rückrollen — Mechanik, keine Messung).
    bewertenAufforderung:
      '\n\nBewerte dieses Fazit jetzt mit recherche_bewerten: uebernommen (es fließt in ' +
      'deine Arbeit ein) oder verworfen (du recherchierst selbst nach) — mit einem Satz ' +
      'Begründung.',
    bewertenBeschreibung:
      'Meldet, was aus dem Fazit einer lokalen Recherche wurde: übernommen (es fließt in ' +
      'deine Arbeit ein) oder verworfen (du recherchierst selbst nach) — mit einem Satz ' +
      'Begründung. Pflicht nach jedem lokal_recherchieren.',
    bewertenSystemZusatz:
      'Nach jedem lokal_recherchieren bewertest du das Fazit mit recherche_bewerten: ' +
      'übernommen oder verworfen, mit einem Satz Begründung — FlowForge misst damit die ' +
      'Trefferquote der lokalen KI.\n',
    bewertet: (uebernommen) =>
      uebernommen
        ? 'Bewertung vermerkt: Fazit übernommen.'
        : 'Bewertung vermerkt: Fazit verworfen — recherchiere selbst nach, was du brauchst.',
    // Projektwissen (BAUPLAN 25): FlowForge stellt die Kartenauswahl des Laufs
    // jedem lokalen Auftrag voran — die lokale KI kann keine Rückfragen
    // stellen; was nicht im Auftrag steht, existiert für sie nicht.
    projektwissen: (liste) =>
      'Projektwissen (aktuelle Projektkarten, von FlowForge vorangestellt — Festlegungen ' +
      'aus Entscheidungs-Karten gelten verbindlich, rolle sie nicht neu auf):\n' +
      liste +
      '\n\nDein Auftrag:\n',
    // Lokale Vorreparatur (BAUPLAN 20): der System-Text des Reparatur-Helfers.
    // Er stand bis Bauschritt 43 regelwidrig inline im Motor und nannte dort
    // einen Blocknamen — derselbe Helfer las damit zwei Sprachen im selben
    // Aufruf, denn reparaturAuftrag darunter ist längst entnamentlicht.
    // Empfänger im Auftrag (BAUPLAN 43): Woher die Beanstandungen kommen, ist
    // für die Reparatur ohne Belang; wichtig ist allein die enge Leine.
    reparaturSystem:
      'Du bist ein Reparatur-Helfer in einem Projektordner. Du arbeitest allein: ' +
      'Rückfragen werden nie beantwortet — arbeite mit dem, was der Auftrag nennt, und ' +
      'schreibe Unklares in deinen Bericht statt zu fragen. Du bekommst Beanstandungen ' +
      'aus einer Prüfung und behebst GENAU diese — nicht mehr, keine Verschönerungen, ' +
      'keine neuen Dateien. Finde die betroffenen Stellen mit suchen und datei_lesen, und ' +
      'behebe sie mit dem Werkzeug ersetzen: Der alt-Text muss ZEICHENGENAU so in der ' +
      'Datei stehen (samt Einrückung) und eindeutig sein — nimm zur Not umgebende ' +
      'Zeilen dazu. Lies eine Stelle immer erst mit datei_lesen, bevor du sie ersetzt. ' +
      'Wenn du fertig bist, antworte OHNE weiteren Werkzeugaufruf mit einer kurzen ' +
      'Liste auf Deutsch: was du wo ersetzt hast. Kannst du eine Stelle nicht finden ' +
      'oder nicht beheben, schreibe genau das — erfinde nichts.',
    // Lokale Vorreparatur (BAUPLAN 20): der Auftrag an das lokale Modell —
    // eng umrissen, nur die mechanisch reparierbaren Beanstandungen.
    reparaturAuftrag: (kritik) =>
      'Eine Prüfung in diesem Projekt hat Beanstandungen gefunden, die als mechanisch ' +
      'reparierbar eingestuft sind (Tippfehler, falscher Wert, vergessener Randfall). ' +
      'Behebe GENAU diese Beanstandungen — nichts anderes:\n\n' +
      kritik,
    // Zusatz im Systemtext der Block-Agenten, wenn die lokale KI bereitsteht.
    systemZusatz:
      'Für Einlese- und Suchaufträge steht dir das Werkzeug lokal_recherchieren bereit ' +
      '(lokale KI, kostet kein Kontingent) — nutze es bevorzugt für Recherche: sowohl ' +
      'dort, wo dein Auftrag Unteraufgaben fürs Einlesen vorsieht, als auch für dein ' +
      'eigenes Umsehen im Projekt — ruhig auch größere Einlese-Aufträge über mehrere ' +
      'Dateien. Die Stellen, auf die du deine Arbeit stützt, liest du selbst nach. ' +
      'Scheitert es, nutze wie gewohnt das Agent-Werkzeug.\n' +
      'Für Schreibarbeit mit Vorbild oder klarer Beschreibung (z.B. „eine weitere ' +
      'Prüfdatei nach dem Muster von X", aber auch ein neues Modul mit festgelegter ' +
      'Schnittstelle oder mehrere zusammengehörige Dateien) steht dir lokal_entwerfen ' +
      'bereit: Die lokale KI schreibt einen Entwurf in die arbeitsablage/ — nie an den ' +
      'Zielort. Du liest den Entwurf gegen, übernimmst ihn selbst an den Zielort (oder ' +
      'verwirfst ihn und schreibst selbst — ungeprüft zählt nichts) und meldest die ' +
      'Entscheidung mit entwurf_abnehmen. Auch Neues ohne exaktes Vorbild darf sie ' +
      'entwerfen, wenn du Schnittstelle und Fertig-Kriterium klar beschreibst.\n' +
      'Für zusammenhängende, einzeln prüfbare Umsetzungs-Teilaufträge — ruhig auch ' +
      'mittelgroße Stücke wie ein ganzes Modul oder eine ganze Funktion mit fester ' +
      'Schnittstelle — steht dir lokal_bauen ' +
      'bereit: Die lokale KI baut das Teilstück direkt im Projekt (FlowForge legt vorher ' +
      'einen Sicherungspunkt an). Du liest jedes Teilstück SOFORT gegen und meldest die ' +
      'Abnahme mit teilstueck_abnehmen — bei „nicht gehalten" rollt FlowForge den Stand ' +
      'automatisch zurück und du baust selbst. Höchstens 2 lokale Anläufe je Teilstück, ' +
      'dann baust du es selbst — kein Pingpong.\n',
    // Lokale Entwürfe (BAUPLAN 21): Schreibarbeit mit Vorbild oder klarer
    // Beschreibung lokal entwerfen lassen, Abnahme beim Block-Agenten —
    // ungeprüft zählt nichts.
    entwerfenBeschreibung:
      'Delegiert Schreibarbeit mit Vorbild oder klarer Beschreibung an die lokale ' +
      'Helfer-KI — sie kostet kein Kontingent und schreibt einen ENTWURF in die ' +
      'arbeitsablage/, nie an den Zielort. Auch mittelgroße Stücke sind erlaubt: ein ' +
      'ganzes Modul mit festgelegter Schnittstelle, mehrere zusammengehörige Dateien, ' +
      'Neues ohne exaktes Vorbild — nenne dann Schnittstelle und Fertig-Kriterium. Danach ' +
      'liest du den Entwurf gegen, übernimmst ihn selbst an den Zielort oder verwirfst ' +
      'ihn, und meldest die Entscheidung mit entwurf_abnehmen.',
    // Feld-Beschreibung des Auftrags (Prüfer-Befund 18.08.2026: klang nach
    // Pflicht-Vorbild — eine klare Beschreibung reicht seit dem Zuschnitt).
    entwerfenAuftragFeld:
      'Der Schreibauftrag in Alltagssprache: was der Entwurf leisten muss — und das ' +
      'Vorbild (Datei) oder eine klare Beschreibung mit Schnittstelle und Fertig-Kriterium.',
    entwurfFazit: (fazit, dateien) =>
      'Entwurf der lokalen Helfer-KI (kleines Modell — ungeprüft zählt nichts):\n' +
      'Entwurfsdateien: ' +
      dateien.join(', ') +
      '\n' +
      fazit +
      '\n\nLies den Entwurf jetzt vollständig gegen. Übernimm ihn selbst an den Zielort ' +
      '(gern mit Korrekturen) oder verwirf ihn und schreibe selbst — und melde deine ' +
      'Entscheidung mit entwurf_abnehmen.',
    entwurfKeineDatei:
      'Die lokale Helfer-KI hat keinen Entwurf geschrieben. Erledige die Schreibarbeit selbst.',
    entwerfenGescheitert: (fehler) =>
      'Die lokale Helfer-KI konnte nicht entwerfen: ' + fehler + ' Erledige die Schreibarbeit selbst.',
    abnehmenBeschreibung:
      'Meldet die Abnahme-Entscheidung zu einem Entwurf der lokalen Helfer-KI: übernommen ' +
      '(du hast ihn gegengelesen und selbst an den Zielort gebracht) oder verworfen (du ' +
      'schreibst selbst). Pflicht nach jedem lokal_entwerfen.',
    abgenommen: (entwurf, uebernommen) =>
      uebernommen
        ? `Abnahme vermerkt: Entwurf „${entwurf}" übernommen.`
        : `Abnahme vermerkt: Entwurf „${entwurf}" verworfen — du schreibst selbst.`,
    // Lokaler Bauer (BAUPLAN 22): zusammenhängende Teilaufträge baut die lokale
    // KI direkt im Projekt — Opus zerlegt, liest jedes Teilstück sofort gegen
    // und bleibt der Schiedsrichter. Ungeprüft zählt nichts.
    bauenBeschreibung:
      'Delegiert einen zusammenhängenden, einzeln prüfbaren Bau-Teilauftrag an die lokale ' +
      'Helfer-KI — ruhig auch ein mittelgroßes Stück: ein ganzes Modul, eine ganze ' +
      'Funktion mit festgelegter Schnittstelle, mehrere zusammengehörige Dateien, auch ' +
      'Neues ohne exaktes Vorbild. Sie baut mit Schreibrecht direkt im Projektordner ' +
      '(Prüfmappe und FlowForge-Verwaltungsdateien bleiben gesperrt; FlowForge legt vorher ' +
      'automatisch einen Sicherungspunkt an). Nenne im Auftrag Fundstellen oder Vorbild ' +
      'bzw. eine klare Beschreibung, feste Schnittstellen (Datei, Funktionsname, was rein, ' +
      'was raus) und das Fertig-Kriterium. Danach liest du das Teilstück sofort gegen und ' +
      'meldest die Abnahme mit teilstueck_abnehmen — Pflicht, bevor du das nächste ' +
      'Teilstück baust.',
    bauenAuftragFeld:
      'Der Teilauftrag: Fundstellen, Vorbild oder klare Beschreibung, feste Schnittstellen ' +
      '(welche Datei, welcher Funktionsname, was rein, was raus) und das Fertig-Kriterium.',
    bauenFazit: (fazit, dateien, ersetzungen) =>
      'Teilstück der lokalen Helfer-KI (kleines Modell — ungeprüft zählt nichts):\n' +
      (dateien.length ? 'Geschriebene Dateien: ' + dateien.join(', ') + '\n' : '') +
      (ersetzungen > 0
        ? `Gezielte Ersetzungen: ${ersetzungen}\n`
        : '') +
      fazit +
      '\n\nLies das Teilstück jetzt vollständig gegen — die geänderten Stellen selbst, ' +
      'nicht nur den Bericht. Dann melde deine Abnahme mit teilstueck_abnehmen: gehalten ' +
      '(du übernimmst es; kleine Korrekturen machst du danach selbst) oder nicht gehalten ' +
      '(FlowForge rollt den Stand auf den Sicherungspunkt zurück und du baust selbst).',
    bauenErstAbnehmen: (teilstueck) =>
      `Zuerst die Abnahme: Melde das offene Teilstück „${teilstueck}" mit ` +
      'teilstueck_abnehmen, bevor du das nächste baust — sonst ist der Rückroll-Punkt ' +
      'nicht mehr eindeutig.',
    bauenKeinSicherungspunkt:
      'Es ließ sich kein Sicherungspunkt anlegen — ohne Rückroll-Punkt baut die lokale KI ' +
      'nicht. Baue dieses Teilstück selbst.',
    bauenGescheitert: (fehler) =>
      'Die lokale Helfer-KI konnte das Teilstück nicht bauen: ' +
      fehler +
      ' Der Projektstand ist sauber (halbe Änderungen wurden zurückgerollt). Baue dieses ' +
      'Teilstück selbst — oder versuche es einmal mit einem präziseren Teilauftrag erneut ' +
      '(höchstens 2 lokale Anläufe je Teilstück).',
    bauenKeineAenderung:
      'Die lokale Helfer-KI hat nichts gebaut (keine Änderung im Projekt). Baue dieses ' +
      'Teilstück selbst — oder versuche es einmal mit einem präziseren Teilauftrag erneut ' +
      '(höchstens 2 lokale Anläufe je Teilstück).',
    abnehmenTeilstueckBeschreibung:
      'Meldet die Abnahme zu einem mit lokal_bauen gebauten Teilstück: gehalten ' +
      '(gegengelesen und übernommen) oder nicht gehalten (FlowForge rollt den Stand auf ' +
      'den Sicherungspunkt vor dem Teilstück zurück — danach baust du es selbst). ' +
      'Pflicht nach jedem lokal_bauen, bevor das nächste Teilstück gebaut wird.',
    teilstueckGehaltenText: (teilstueck) =>
      `Abnahme vermerkt: Teilstück „${teilstueck}" gehalten.`,
    teilstueckVerworfenText: (teilstueck) =>
      `Abnahme vermerkt: Teilstück „${teilstueck}" nicht gehalten — der Stand ist auf den ` +
      'Punkt vor dem Teilstück zurückgerollt. Baue es jetzt selbst (oder gib der lokalen ' +
      'KI genau einen präziseren zweiten Anlauf, falls sie noch keinen hatte).',
    teilstueckOhneOffenes:
      'Kein offenes Teilstück — nichts abzunehmen und nichts zurückzurollen. (Ein ' +
      'gescheiterter lokal_bauen-Versuch ist schon aufgeräumt.)',
    // Ehrlichkeit beim Zurückrollen (BAUPLAN 45): Bisher wurde der Rückgabewert
    // weggeworfen — der Agent las „zurückgerollt" und baute auf einem Stand
    // weiter, den FlowForge für verworfen hielt. Scheitert es, muss er es lesen.
    rollbackGescheitertHinweis:
      '\n\nACHTUNG: Das Zurückrollen hat NICHT geklappt — der Satz oben über den sauberen ' +
      'Stand gilt NICHT. Die Änderungen der lokalen KI liegen noch im Projekt. Baue nicht ' +
      'blind darauf weiter: Sieh dir die genannten Dateien zuerst selbst an und bring sie ' +
      'in Ordnung.',
    rollbackPunktVerschobenHinweis:
      '\n\nACHTUNG: Dieses Teilstück stammt aus einem früheren Anlauf dieses Blocks — ' +
      'FlowForge hat NICHTS zurückgerollt, weil dabei auch die Arbeit dieser Runde ' +
      'verschwunden wäre. Sieh dir die betroffenen Stellen selbst an und bring sie in Ordnung.',
    // Der Rückroll lässt die Arbeitsbereiche der anderen Blöcke absichtlich stehen
    // (BAUPLAN 45). Ohne diesen Zusatz endete die Werkzeug-Antwort bei „der
    // Projektstand ist sauber" — gemessen genau so, während das Gebastel der
    // lokalen KI in einer fremden Prüfmappe liegenblieb.
    rollbackGeschuetztHinweis: (anzahl) =>
      '\n\nACHTUNG: Nicht alles wurde zurückgenommen. ' +
      `${anzahl} ${anzahl === 1 ? 'Änderung liegt' : 'Änderungen liegen'} im Arbeitsbereich ` +
      'anderer Blöcke (zum Beispiel in deren Prüfmappe) und blieb absichtlich stehen — der ' +
      'Satz oben über den sauberen Stand gilt nur für deine eigenen Dateien. Fass fremde ' +
      'Arbeitsbereiche nicht an; rechne aber damit, dass dort noch Reste dieses Versuchs liegen.',
    // Überholter Rückroll-Punkt (Nacharbeit zu BAUPLAN 45): Ein anderer Block
    // hat seit diesem Punkt seine fertige Runde beigesteuert. Voll
    // zurückzurollen nähme sie mit — also blieb stehen, was nicht sicher diesem
    // Block gehört. Ohne diesen Zusatz hielte der Agent den Ordner für sauber.
    rollbackStandUeberholtHinweis: (anzahl) =>
      '\n\nACHTUNG: Nicht alles wurde zurückgenommen. Seit dem Sicherungspunkt, auf den ' +
      `zurückgerollt wurde, hat ein anderer Block fertige Arbeit beigesteuert; ${anzahl} ` +
      `${anzahl === 1 ? 'Änderung blieb' : 'Änderungen blieben'} deshalb stehen, damit sie ` +
      'nicht mitfällt. Der Satz oben über den sauberen Stand gilt nur für deine eigenen ' +
      'Dateien — sieh dir die betroffenen Stellen selbst an, bevor du darauf weiterbaust.',
    // Und der stille Gegenfall: Die lokale KI hat geschrieben, der Rückroll fand
    // aber nichts zurückzunehmen. Dann ist „sauber" eine Behauptung ohne Deckung.
    rollbackNichtsGefundenHinweis:
      '\n\nACHTUNG: Beim Zurückrollen war nichts zurückzunehmen, obwohl die lokale KI ' +
      'Dateien angefasst hat — der Satz oben über den sauberen Stand ist damit nicht ' +
      'verbürgt. Sieh dir die genannten Dateien selbst an, bevor du darauf weiterbaust.',
    // Zusatz im Auftrag schreibender Blöcke (nur wenn die lokale KI bereitsteht
    // und das Häkchen am Block an ist — eingesetzt von der Lauf-Verwaltung).
    bauenAuftragZusatz:
      '\n\nZusatz von FlowForge — lokales Bauen (die lokale KI steht bereit): Zerlege das ' +
      'Arbeitspaket in zusammenhängende, einzeln prüfbare Teilaufträge — ruhig auch ' +
      'größere Stücke mit klarer Schnittstelle (ein ganzes Modul, eine ganze Funktion, ' +
      'mehrere zusammengehörige Dateien, auch Neues ohne exaktes Vorbild) — jeder mit ' +
      'Fundstellen, Vorbild oder klarer Beschreibung, eigenem Fertig-Kriterium und vorher ' +
      'festgelegten Schnittstellen (welche Datei, welcher Funktionsname, was rein, was ' +
      'raus), damit die Teile zusammenstecken. Rufe je Teilauftrag lokal_bauen und lies ' +
      'das Teilstück SOFORT gegen — Gegenlesen ist billiger als Selberschreiben; melde ' +
      'jede Abnahme mit teilstueck_abnehmen, bevor du das nächste Teilstück baust. Hält ' +
      'ein Teilauftrag nach 2 lokalen Anläufen nicht, baue GENAU dieses Teilstück selbst ' +
      'und mach mit dem nächsten weiter — kein Pingpong. Bündle nach Zusammengehörigkeit: ' +
      'Einen trivialen Auftrag präzise zu beschreiben kostet fast so viel, wie ihn selbst ' +
      'zu erledigen — fasse Kleinigkeiten lieber zu einem zusammenhängenden Teilauftrag ' +
      'zusammen; nur eine einzelne, für sich stehende Kleinst-Änderung erledigst du direkt ' +
      'selbst. Ein verworfenes Teilstück ist KEIN Urteil über die übrigen: Versuche jedes ' +
      'Teilstück zuerst lokal — erst wenn mehrere hintereinander nicht halten, bau den ' +
      'Rest selbst.',
    // Tabu-Liste der lokalen Helfer-KI (BAUPLAN 46): Der Schreibpfad der lokalen
    // KI lief bis Bauschritt 45 an der Dateiliste des Blocks vorbei (SPEC §7,
    // „ehrliche Grenze"). Jetzt gilt sie auch hier — Ablehnung mit demselben Weg
    // heraus wie beim Bauer: im Feld anmerkung melden, nicht erneut versuchen.
    // Der Text geht an die lokale KI, die ihn ins Fazit trägt; von dort liest
    // ihn der Block-Agent.
    ausserhalbDateiliste: (datei, liste) =>
      `Abgelehnt: „${datei}" steht nicht in der Dateiliste dieses Blocks. Schreiben darfst du ` +
      `nur in: ${liste.join(', ')} (und in arbeitsablage/). Versuche es NICHT erneut — schreibe ` +
      'in dein Fazit, dass diese Datei fehlt; der Block-Agent meldet das im Feld anmerkung.'
  },
  // KI-Assistent des Block-Editors (SPEC §4.5, BAUPLAN 14) — Texte an den Motor.
  agentenBlockAssistent: {
    keineWerkzeuge:
      'Für diese Aufgabe gibt es keine Werkzeuge. Antworte direkt mit dem geforderten JSON.',
    auftrag: (beschreibung, etiketten) =>
      'Du hilfst im Block-Editor von FlowForge, einer App, in der ein Nicht-Programmierer ' +
      'Coding-Workflows aus Blöcken baut. Ein Block ist ein Arbeitsauftrag an einen ' +
      'KI-Agenten, der in einem Projektordner arbeitet. Der Nutzer hat beschrieben, was ' +
      'sein neuer Block tun soll — du füllst daraus das Block-Formular aus.\n\n' +
      'Beschreibung des Nutzers:\n' +
      beschreibung +
      '\n\n' +
      'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Erklärtext und ohne ' +
      'Markdown-Zäune, mit genau diesen Feldern:\n' +
      '{"name": "...", "symbol": "...", "beschreibung": "...", "auftrag": "...", ' +
      '"braucht": ["..."], "brauchtOptional": ["..."], "liefert": ["..."], ' +
      '"kennzeichen": {"nurLesen": true}, "begruendungen": {"nurLesen": "..."}, ' +
      '"felder": []}\n\n' +
      'Regeln:\n' +
      '- name: kurzer deutscher Name (höchstens 40 Zeichen).\n' +
      '- symbol: genau ein passendes Emoji.\n' +
      '- beschreibung: ein Satz für die Blockbibliothek, verständlich für einen ' +
      'Nicht-Programmierer (höchstens 200 Zeichen).\n' +
      '- auftrag: der Arbeitsauftrag an den Agenten, auf Deutsch, in Du-Form (höchstens ' +
      '4000 Zeichen). Sag klar, was er tun soll und was ausdrücklich nicht. Beginne mit ' +
      'seiner Rolle („Du bist …"), verlange „Antworte auf Deutsch", und beende den ' +
      'Auftrag mit einer Anweisung, was inhaltlich in seine Ergebnis-Meldung gehört — ' +
      'kompakt (höchstens etwa 25 Zeilen), denn sie ist die Übergabe an die folgenden ' +
      'Blöcke. WIE gemeldet wird, sagt FlowForge dem Agenten selbst; schreibe darüber ' +
      'nichts. Ist das Kennzeichen nurLesen gesetzt, schreibe ausdrücklich hinein: „Du ' +
      'darfst nichts verändern — nur lesen."\n' +
      '- braucht: Etiketten der Übergaben, die dieser Block von vorherigen Blöcken ' +
      'zwingend benötigt (höchstens 5, je höchstens 40 Zeichen). Nur was wirklich nötig ' +
      'ist — ein Block ohne braucht kann am Anfang des Workflows stehen.\n' +
      '- brauchtOptional: Etiketten, die der Block nutzt, wenn ein Block davor sie ' +
      'liefert, aber nicht verlangt (höchstens 5; ein Etikett steht nie in braucht UND ' +
      'brauchtOptional). Meist leer.\n' +
      '- liefert: Etiketten für das Ergebnis dieses Blocks, wenn spätere Blöcke es ' +
      'nutzen sollen (höchstens 5).\n' +
      '- Verwende bei braucht/brauchtOptional/liefert möglichst diese vorhandenen ' +
      'Etiketten, statt neue zu erfinden: ' +
      etiketten.join(', ') +
      '.',
    // Kennzeichen-Zusatz (BAUPLAN 48): alle Kennzeichen, die ein eigener Block
    // tragen darf, mit Name und Folgen-Hinweis aus DERSELBEN Quelle wie der
    // Editor (texte.blockEditor.kennzeichen) — plus die Verträglichkeitsregeln
    // in Klartext. Jedes gesetzte Kennzeichen braucht eine Begründung in
    // Folgen-Sprache; der Editor zeigt sie neben dem Häkchen.
    kennzeichenZusatz: (liste) =>
      '\n- kennzeichen: ein Objekt { schluessel: true/false } mit den Fähigkeiten und ' +
      'Pflichten des Blocks. Nimm NUR, was die Beschreibung wirklich verlangt — ein ' +
      'Block ohne besondere Kennzeichen ist der Normalfall. Erlaubte Schlüssel, je mit ' +
      'Bedeutung für den Lauf:\n' +
      liste.map((k) => `  · "${k.schluessel}" (${k.name}): ${k.hinweis}`).join('\n') +
      '\n  Regeln, die zusammenpassen müssen (sonst lehnt FlowForge den Block ab): ' +
      'nurLesen true, wenn der Block nichts am Projekt verändern muss (ansehen, ' +
      'berichten) — im Zweifel die sichere Wahl; prueft verlangt nurLesen false und ' +
      '„Prüfbeleg" in liefert; pruefbefehlPflicht verlangt prueft; ' +
      'startanleitungPflicht verlangt nurLesen false; kartenZuteilung verlangt ' +
      '„Arbeitspaket" in liefert; fuehrtZusammen verlangt mindestens ein braucht-Etikett ' +
      'und gilt NUR, wenn der Block mehrere gleichartige Lieferungen desselben Etiketts ' +
      'zu einer machen soll (vor ihm müssen dann mindestens zwei Blöcke es liefern).\n' +
      '- begruendungen: ein Objekt { schluessel: "ein Satz" } NUR für die Kennzeichen, ' +
      'die du auf true setzt — je ein Satz in Folgen-Sprache für einen ' +
      'Nicht-Programmierer, warum dieser Block das braucht (höchstens 200 Zeichen). ' +
      'Kein gesetztes Kennzeichen ohne Begründung.',
    // Felder-Zusatz (BAUPLAN 48): Formularfelder nur, wenn der Block je Lauf
    // wirklich eine Eingabe von Georg braucht.
    felderZusatz: (max) =>
      '\n- felder: Eingabefelder auf der Blockkarte, deren Inhalt in den Auftrag ' +
      'eingesetzt wird — je { "label": "...", "platzhalter": "...", "pflicht": true/false }. ' +
      `Höchstens ${max}; nur, wenn der Block je Lauf wirklich eine Eingabe des Nutzers ` +
      'braucht (z.B. „Was soll gebaut werden?"). Meist eine leere Liste. Für jedes Feld ' +
      'schreibe an die passende Stelle im Auftrag den Platzhalter {{id}}, wobei id die ' +
      'Bezeichnung klein, ohne Umlaute (ae/oe/ue/ss) und mit _ statt Leerzeichen ist ' +
      '(„Was soll gebaut werden?" → {{was_soll_gebaut_werden}}). pflicht true heißt: ' +
      'Leer hält der Start an.',
    // Kategorie-Zusatz (BAUPLAN 30): wird an den Auftrag angehängt; die KI
    // wählt eine der vorhandenen Bibliotheks-Klappen, Standard „eigene".
    bereichZusatz: (bereiche) =>
      '\n- Zusätzlich ein Feld "bereich": die Kategorie (Klappe) der Blockbibliothek, ' +
      'in der der Block liegen soll. Erlaubte Werte, jeweils mit ihrer Bedeutung: ' +
      bereiche.map((b) => `"${b.schluessel}" (${b.name})`).join(', ') +
      '. Wähle die passende — passt keine wirklich, nimm "eigene". Erfinde keinen neuen Wert.',
    // Modell-Zusatz (BAUPLAN 37): die KI schlägt die Modellklasse mit vor;
    // der Nutzer sieht und ändert sie im Editor.
    modellZusatz: (klassen) =>
      '\n- Zusätzlich ein Feld "modell": die Modellklasse, mit der der Block arbeitet. ' +
      'Erlaubte Werte: ' +
      klassen.map((k) => `"${k.schluessel}" (${k.name})`).join(', ') +
      '. Nimm "standard" für alles, wo wirklich gedacht, gebaut oder geprüft wird; ' +
      '"sparsam" für Zusammenfassen, Nachfragen, Aufräumen und andere Zuarbeit; ' +
      '"sehr-sparsam" nur für ganz mechanische Aufgaben. Im Zweifel "standard". ' +
      '"extra" schlägst du nie von dir aus vor — es kann den Nutzer Guthaben kosten; er wählt es selbst.'
  },
  // Startanleitung & „App starten"-Knopf (SPEC §8, BAUPLAN 10).
  // App-Tab (BAUPLAN 32, SPEC §8): Ausgabe der laufenden App in FlowForge,
  // Start/Stopp/Neustart, Port-Prüfung, Rückfall-Liste verwaister Prozesse.
  app: {
    ueberschrift: 'Deine App',
    keineAnleitung:
      'Noch keine Startanleitung. Ein Bau-Workflow (z.B. „Feature hinzufügen") legt sie an — danach startet deine App hier mit einem Klick, und du siehst ihre Ausgabe live.',
    beschreibungLabel: 'Was die App tut',
    befehlLabel: 'Befehl',
    adresseLabel: 'Adresse',
    keinBefehl: 'Diese Startanleitung hat keinen Befehl — nur eine Adresse bzw. Datei. „Starten" öffnet sie direkt.',
    starten: 'Starten',
    stoppen: 'Stoppen',
    neustarten: 'Neu starten',
    adresseOeffnen: 'Adresse im Browser öffnen',
    wartetAufAdresse: 'wartet, bis die Adresse antwortet …',
    zustandAus: 'nicht gestartet',
    zustandStartet: 'startet …',
    zustandLaeuft: (seit) => `läuft seit ${seit}`,
    zustandBeendet: (code, wann) =>
      code === 0 ? `beendet (Code 0) um ${wann}` : `beendet mit Code ${code ?? '?'} um ${wann}`,
    zustandGestoppt: (wann) => `gestoppt um ${wann}`,
    zustandNurAdresse: 'geöffnet (kein eigener Prozess)',
    ausgabeTitel: 'Ausgabe',
    ausgabeLeer: 'Noch keine Ausgabe. Wenn deine App etwas schreibt, steht es hier — mit Umlauten.',
    ausgabeHinweis:
      'Standard- und Fehlerausgabe der App, live. Eingaben sind nicht möglich: Die Startanleitung muss ohne Tastatur auskommen.',
    startZeile: (befehl) => `▶ ${befehl}`,
    endeZeile: (code) => (code === 0 ? '■ Die App hat sich beendet (Code 0).' : `■ Die App hat sich beendet — Code ${code ?? '?'}.`),
    stoppZeile: '■ Gestoppt über FlowForge.',
    fehlerLaeuftSchon: 'Die App läuft schon — stopp sie zuerst oder nimm „Neu starten".',
    fehlerKeineAdresse: 'Diese Startanleitung hat keine Adresse.',
    fehlerAdresseNichtErreichbar:
      'Die App hat sich beendet, bevor die Adresse geantwortet hat — sieh in die Ausgabe.',
    fehlerStart: (grund) => `Die App ließ sich nicht starten${grund ? `: ${grund}` : '.'}`,
    fehlerPortFlowForge: (port) => `Port ${port} gehört FlowForge selbst — das kann ich nicht beenden.`,
    fehlerPortNichtFrei: (port) =>
      `Port ${port} ist immer noch belegt. Sieh in der Liste „noch laufende Prozesse" nach oder warte einen Moment.`,
    // Port-Prüfung vor dem Start: Dialog mit dem Besitzer-Prozess.
    portBelegtTitel: 'Port ist belegt',
    portBelegtFrage: (port, name, pid) =>
      `Port ${port} ist schon belegt — von „${name || 'unbekannt'}" (Prozess ${pid}). Meist ist das ein Server, den ein früherer Lauf gestartet und nie beendet hat. Soll ich ihn beenden und deine App dann starten?`,
    portBelegtBefehl: 'Befehlszeile',
    portBelegtKnopf: 'Beenden und starten',
    // Rückfall-Liste (BAUPLAN 32): falls doch einmal etwas hängen bleibt.
    verwaisteTitel: 'Noch laufende Prozesse aus Läufen',
    verwaisteHinweis:
      'Normalerweise beendet FlowForge am Ende jedes Laufs alles, was der Lauf gestartet hat. Diese Liste ist der Rückfall: Prozesse, die sich nicht beenden ließen, und verwaiste Prozesse, die während eines Laufs entstanden sind (vermutlich aus einem Lauf — kann aber auch etwas sein, das du selbst gestartet hast; sieh auf die Befehlszeile).',
    verwaisteLeer: 'Nichts hängt — alles sauber.',
    verwaisteAktualisieren: 'Liste aktualisieren',
    verwaisteSicher: 'aus einem Lauf',
    verwaisteVermutlich: 'vermutlich aus einem Lauf',
    verwaisteGestartet: (wann) => `gestartet ${wann}`,
    prozessBeenden: 'Beenden',
    prozessBeendenFrage: (name, pid) =>
      `Prozess „${name || 'unbekannt'}" (${pid}) beenden? Das geht sofort und ohne Rückfrage an das Programm.`,
    prozessWiederverwendet: 'Dieser Prozess ist inzwischen ein anderer — die Liste wird neu geladen.',
    prozessNichtBeendet: 'Der Prozess ließ sich nicht beenden — vielleicht braucht er Administratorrechte.'
  },
  startanleitung: {
    knopf: 'App starten',
    knopfLaeuft: 'App läuft',
    startet: 'startet …',
    keineHinweis:
      'Noch keine Startanleitung. Ein Bau-Workflow (z.B. „Feature hinzufügen") legt sie an — danach startet deine App hier mit einem Klick.',
    fehlerKeine:
      'Es gibt noch keine Startanleitung. Lass zuerst einen Bau-Workflow laufen — er legt sie als Pflicht-Artefakt an.',
    fehlerDateiFehlt: (datei) =>
      `Die Startanleitung zeigt auf „${datei}" — diese Datei gibt es nicht (mehr). Lass einen Bau-Workflow die Anleitung erneuern.`,
    fehlerOeffnen: 'Die App ließ sich nicht öffnen. Bitte versuch es noch einmal.'
  },
  // Texte des start-Werkzeugs an den Agenten.
  agentenStart: {
    gesetzt: (anleitung) =>
      `Startanleitung festgelegt: ${anleitung.beschreibung}` +
      (anleitung.befehl ? ` · Befehl: ${anleitung.befehl}` : '') +
      (anleitung.adresse ? ` · Adresse: ${anleitung.adresse}` : ''),
    fehlerBeschreibung: (max, ist = 0) =>
      `Die beschreibung fehlt oder ist zu lang (höchstens ${max} Zeichen${ist > max ? `, deine hat ${ist}` : ''}) — ein Satz in Alltagssprache genügt.`,
    fehlerQuelleFehlt:
      'Gib mindestens eines an: befehl (Kommandozeile im Projektordner) und/oder adresse (http(s)-Adresse oder Datei im Projektordner).',
    fehlerZuLang: 'befehl oder adresse ist zu lang — halte beides kurz und konkret.',
    fehlerAdresse:
      'Die adresse muss mit http:// oder https:// beginnen — oder eine Datei im Projektordner sein (relativer Pfad, kein Ausbruch per „..").'
  },
  // Prüfbefehl-Werkzeug (BAUPLAN 35): Texte an den Agenten.
  agentenPruefbefehl: {
    anweisungen:
      'Mit pruefbefehl_setzen hinterlegst du den Startbefehl deiner Prüfmappe. FlowForge spielt ' +
      'ihn in Reparatur-Runden selbst ab — ohne dich zu starten und ohne Kontingent zu kosten. ' +
      'Nutze es, wenn dein Arbeitsauftrag den Prüfbefehl verlangt — niemals über die Datei ' +
      'pruefbefehl.json.',
    werkzeugBeschreibung:
      'Hinterlegt den Befehl, mit dem sich die Prüfungen in pruefung/ von außen starten lassen — ' +
      'Pflicht-Artefakt jedes Prüf-Auftrags. FlowForge führt ihn in Reparatur-Runden selbst aus, ' +
      'bevor es dich erneut startet: Bleibt er rot, geht das Fehlerprotokoll ohne dich in die ' +
      'Reparatur. Genau EIN Befehl, der ohne Rückfrage und ohne Tastatureingabe durchläuft.',
    befehlParam:
      'Der Befehl, der im Projektordner alle deine Prüfungen ausführt und bei einem Fehlschlag ' +
      'mit einem Fehlercode endet (z.B. „npx vitest run pruefung" oder „python pruefung/pruefe.py"). ' +
      'Ein einzelner Befehl — keine Verkettung mit &, |, ; und keine Unterausführung.',
    gesetzt: (befehl) =>
      `Prüfbefehl festgelegt: ${befehl} — FlowForge spielt ihn in Reparatur-Runden selbst ab.`,
    fehlerLeer: 'Der befehl fehlt. Gib genau einen Befehl an, der deine Prüfungen ausführt.',
    fehlerZuLang:
      'Der befehl ist zu lang. Halte ihn kurz und konkret — ein Aufruf, der alle Prüfungen startet.',
    fehlerVerkettung:
      'Der befehl darf nur ein einzelner Aufruf sein: keine Verkettung (&, &&, |, ;), keine ' +
      'Umleitung (>, <) und keine Unterausführung ($(…), Backticks). Braucht deine Prüfung ' +
      'mehrere Schritte, lege ein Skript in pruefung/ ab und rufe nur dieses auf.',
    fehlerWerkzeug: (werkzeug) =>
      `„${werkzeug}" ist als Prüfbefehl nicht zugelassen. FlowForge führt den Prüfbefehl ohne ` +
      'Rückfrage aus und lässt deshalb nur Test-Werkzeuge zu (node, npm, npx, pnpm, yarn, ' +
      'vitest, jest, mocha, tsc, python, py, pytest, deno, bun, go, cargo, dotnet, mvn, gradle, ' +
      'make, rspec, phpunit). Rufe deine Prüfungen über eines davon auf.'
  },
  // Lieferschein (BAUPLAN 42): Jeder Block meldet sein Ergebnis über ein
  // Werkzeug — gemeinsamer Rahmen für alle, darunter je liefert-Etikett ein
  // eigener Teil. Hier stehen Werkzeug-Beschreibungen, Feldtexte, Ablehnungen
  // und die Beschriftungen der lesbaren Fassung.
  lieferschein: {
    serverHinweis:
      'Mit den melde-Werkzeugen gibst du dein Blockergebnis an FlowForge zurück. Genau eines ' +
      'davon ist für deinen Block freigeschaltet — dein Arbeitsauftrag nennt es. Ohne diese ' +
      'Meldung gilt dein Block als nicht erledigt; dein Abschlusstext wird NICHT ausgewertet.',
    // Diesen Zusatz hängt FlowForge an JEDEN Blockauftrag — auch an
    // selbstgebaute Blöcke, die das Werkzeug sonst nicht kennen könnten.
    // Empfänger im Auftrag (BAUPLAN 43): empfängerfrei formuliert — WER die
    // Lieferung bekommt (und ob überhaupt jemand), steht im Vorspann, der je
    // Blockinstanz aus dem Schaubild gerechnet wird.
    auftragZusatz: (werkzeug, etikett) =>
      '\n\nSo meldest du dein Ergebnis (Pflicht, von FlowForge): Rufe zum Schluss genau EINMAL ' +
      `das Werkzeug ${werkzeug} auf` +
      (etikett ? ` — es ist deine Lieferung „${etikett}".` : '.') +
      ' Fülle alle Felder aus, die zu deiner Arbeit etwas zu sagen haben: fazit ist ein einziger ' +
      'Satz (er steht im Ticker und im Bericht), getan und offen sind kurze Stichpunkte, und ' +
      'anmerkung ist das Freifeld für alles, was in kein Feld passt und trotzdem ankommen ' +
      'soll. Dein Abschlusstext wird von FlowForge nicht mehr ausgewertet — ' +
      'was nicht in der Meldung steht, kommt nirgends an. Weist FlowForge deine Meldung ab, ' +
      'lies die Begründung und rufe das Werkzeug korrigiert erneut auf.',
    mehrereWerkzeuge: (werkzeuge) =>
      ` Dein Block liefert mehreres — rufe jedes dieser Werkzeuge einmal auf: ${werkzeuge.join(', ')}.`,
    angenommen: (etikett) =>
      etikett
        ? `Meldung angenommen — deine Lieferung „${etikett}" ist bei FlowForge eingegangen.`
        : 'Meldung angenommen — dein Blockergebnis ist bei FlowForge eingegangen.',
    // Nachforderung (dasselbe erprobte Muster wie Startanleitung und Prüfbefehl):
    // genau eine Runde, danach gilt der Block als fehlgeschlagen.
    nachforderung: (werkzeug, abschlusstext) =>
      '\n\nNachforderung von FlowForge: Du hast in diesem Lauf schon gearbeitet, aber dein ' +
      `Ergebnis nie gemeldet — das Werkzeug ${werkzeug} wurde nicht (oder nicht vollständig) ` +
      'aufgerufen. Arbeite jetzt NICHTS neu und ändere nichts am Projekt: Trage allein die ' +
      'Meldung nach, und zwar aus dem, was du eben getan hast. Dein Abschlusstext von eben:\n' +
      abschlusstext,
    ohneMeldung:
      'Der Block hat sein Ergebnis auch nach der Nachforderung nicht gemeldet — ohne Meldung ' +
      'hat er in diesem Lauf nichts geliefert.',
    // Feldnamen, die in Ablehnungen genannt werden. Seit 0.46.1 (keine Längen-
    // und Anzahl-Grenzen mehr für Meldungen) sind das nur noch die Pflichtfelder
    // und die Prüfkarte, für die die Karten-Grenzen gelten.
    felder: {
      fazit: 'fazit',
      ziel: 'ziel',
      pruefkarteTitel: 'pruefkarteTitel',
      pruefkarteText: 'pruefkarteText'
    },
    // Ablehnungen nennen immer die Ist-Länge bzw. die erlaubten Werte — der
    // Agent soll korrigieren können, ohne zu raten. feldZuLang gilt nur noch
    // für die Prüfkarte (Karten-Grenzen, SPEC §3.1).
    feldFehlt: (feld) => `Das Feld ${feld} fehlt oder ist leer — es ist Pflicht.`,
    feldZuLang: (feld, max, ist) =>
      `Das Feld ${feld} ist zu lang: ${ist} Zeichen, erlaubt sind höchstens ${max}. Fasse dich kürzer.`,
    unbekannteArt: (art) => `Unbekannte Meldungsart „${art}".`,
    etikettFehlt: (etiketten) =>
      `Dein Block liefert mehreres — gib im Feld etikett an, worum es geht: ${etiketten.join(', ')}.`,
    etikettUnbekannt: (gewaehlt, etiketten) =>
      `„${gewaehlt}" liefert dieser Block nicht. ` +
      (etiketten.length ? `Möglich ist: ${etiketten.join(', ')}.` : 'Dieser Block liefert nichts an folgende Blöcke.'),
    arbeitspaketOhneKriterien:
      'Ein Arbeitspaket ohne Fertig-Kriterien ist keins: Ohne sie gäbe es weder ein Ziel für ' +
      'die Umsetzung noch einen Maßstab für die Prüfung. Trage in fertigKriterien mindestens ' +
      'eine prüfbare Aussage ein.',
    // Zuschnitt je Ziel und Datenvertrag (BAUPLAN 44). Jede Abweisung sagt, was
    // stattdessen zu tun ist — der Agent soll korrigieren können, ohne zu raten.
    arbeitspaketOhnePaket:
      'Abgelehnt: pakete ist leer. Trage je benanntem Ziel deines Auftrags einen Zuschnitt ein ' +
      '— gibt es kein benanntes Ziel, genau einen ohne zielBlock.',
    paketFehler: (nummer, grund) => `Paket ${nummer}: ${grund}`,
    ohneZiel: 'ohne Ziel',
    zielDoppelt: (bezeichnung) =>
      `Zwei Pakete für dasselbe Ziel (${bezeichnung}): Der Empfänger bekäme eines von beiden, ` +
      'ohne dass irgendwer sagen könnte welches. Fasse sie zu einem Paket zusammen oder gib ' +
      'jedem sein eigenes Ziel.',
    zielBlockUnbekannt: (gewaehlt, gueltig) =>
      `„${gewaehlt}" ist keines deiner benannten Ziele. Adressieren kannst du an: ${gueltig} — ` +
      'trage in zielBlock die Blocknummer ein (z.B. „3").',
    // Kurzname je Ziel (0.51.1): Pflicht, sobald das Paket adressiert ist —
    // aus ihm wird der Laufzeit-Zusatzname der Ziel-Instanz, damit zwei
    // gleiche Blöcke im Ticker auseinanderzuhalten sind.
    kurznameFehlt: (zielBezeichnung) =>
      `Dem Paket für ${zielBezeichnung} fehlt der kurzname. Gib dem Ziel einen Kurznamen aus ` +
      '2–3 Wörtern, der sagt, woran es arbeitet (z.B. „Server-Briefing") — FlowForge hängt ihn ' +
      'als Zusatznamen an den Block, damit im Ticker nicht zwei gleichnamige Blöcke stehen.',
    zielBlockOhneZiele: (gewaehlt) =>
      `Du hast das Paket an „${gewaehlt}" adressiert, aber hinter dir liegt kein Block, der ein ` +
      'Arbeitspaket umsetzt. Lass zielBlock leer — dann gilt dein Paket für alle.',
    // Zuschnitte nebenläufiger Ziele (BAUPLAN 46): Zwei Umsetzer, die weder
    // hintereinander noch voreinander liegen, laufen parallel — nur wenn ihre
    // Dateilisten sich ausschließen. Überschneidung wird beim MELDEN abgewiesen,
    // bevor ein Token in die Bauer fließt; der Text nennt Paar und Einträge.
    zuschnittUeberschneidung: (zielA, zielB, eintraege) =>
      `Die Zuschnitte für ${zielA} und ${zielB} überschneiden sich in erlaubteDateien: ` +
      `${eintraege.join(', ')}. Diese beiden Blöcke laufen gleichzeitig — dieselbe Datei in ` +
      'beiden Listen hieße zwei Schreiber an einer Stelle. Teile die Dateien eindeutig einem ' +
      'der beiden zu (oder fasse die Arbeit daran in EINEM Zuschnitt zusammen).',
    adressloserZuschnittMitListe: (ziele) =>
      'Ein Zuschnitt ohne zielBlock gilt für ALLE Ziele — mit erlaubteDateien stünde dieselbe ' +
      `Dateiliste bei ${ziele}, die gleichzeitig laufen, und sie überschnitten sich mit sich ` +
      'selbst. Adressiere den Zuschnitt an genau ein Ziel (zielBlock) oder lass erlaubteDateien ' +
      'dort weg.',
    // Die Verbindung Zuschnitt → Aufgaben-Karte wird hart geprüft (BAUPLAN 44):
    // Eine erfundene id deckte sonst nichts ab, und die Vollständigkeit wäre
    // wieder eine Schätzung.
    aufgabenIdsOhnePaket:
      'Du nennst in aufgabenIds Aufgaben-Karten, hast aber noch kein Paket gemeldet. Rufe zuerst ' +
      'paket_melden auf (welche offenen Aufgaben-Karten dieser Lauf bearbeitet) — danach kannst ' +
      'du je Zuschnitt sagen, welche davon er abdeckt.',
    aufgabeUnbekannt: (id, gueltig) =>
      `„${id}" gehört nicht zu deinem gemeldeten Paket. In aufgabenIds gehören nur ids aus ` +
      `deiner paket_melden-Meldung: ${gueltig}.`,
    dateiMuster: (eintrag) =>
      `„${eintrag}" ist ein Muster, kein Pfad — Platzhalter wie * ? [ ] { } versteht FlowForge ` +
      'nicht und würde nichts treffen. Nenne die Dateien einzeln (z.B. „src/main/lauf.js") oder ' +
      'den Ordner mit Schrägstrich am Ende (z.B. „src/shared/").',
    // Ausbrechender Eintrag (BAUPLAN 44): Er stünde sichtbar im Vertrag, träfe
    // aber nie eine Datei — der Bauer würde dann ausgerechnet an der Datei
    // gestoppt, die er vor sich in der Liste liest. Deshalb schon beim Melden
    // abweisen, mit dem Ist-Wert.
    dateiAusserhalb: (eintrag) =>
      `„${eintrag}" zeigt aus dem Projektordner hinaus — der Datenvertrag nennt nur Dateien ` +
      'INNERHALB des Projekts. Schreibe den Pfad relativ zum Projektordner, ohne führenden ' +
      'Schrägstrich, ohne Laufwerksbuchstaben und ohne „.." (z.B. „src/main/lauf.js").',
    // Projektordner als Eintrag (BAUPLAN 44): Er überlebte das Melden, traf in
    // der Schreibsperre aber nichts — die Liste war nicht leer (die Sperre galt
    // also), und der Bauer wurde an jedem Schreibversuch gestoppt mit der
    // Begründung, die Datei stehe nicht in einer Liste, die „alles" sagt.
    // Deshalb abweisen, mit Ist-Wert und dem sauberen Weg für diesen Fall.
    dateiProjektordner: (eintrag) =>
      `„${eintrag}" meint den ganzen Projektordner — ein Datenvertrag, der alles erlaubt, ist ` +
      'kein Vertrag, und als Schreibsperre träfe der Eintrag keine einzige Datei. Nenne die ' +
      'Dateien und Ordner einzeln (z.B. „src/main/lauf.js", „src/shared/"). Soll dieses Paket ' +
      'wirklich ohne Einschränkung arbeiten, lass erlaubteDateien ganz weg — ohne Liste sperrt ' +
      'nichts.',
    urteilFehlt: (werte) => `Das Feld urteil fehlt oder ist unbekannt. Erlaubt ist genau: ${werte.join(' oder ')}.`,
    urteilOhneBeanstandung:
      'Urteil „fehlgeschlagen" ohne eine einzige Beanstandung: Damit wüsste die Reparatur nicht, ' +
      'was zu beheben ist. Trage jede Beanstandung einzeln ein (mit Einstufung und Fundort) — oder ' +
      'urteile ehrlich „bestanden".',
    bestandenMitBeanstandung:
      'Urteil „bestanden", aber es stehen Beanstandungen in der Meldung. Entweder ist die Prüfung ' +
      'bestanden (dann gehören die Punkte in anmerkung, nicht in beanstandungen) oder sie ist ' +
      'fehlgeschlagen (dann urteile so).',
    einstufungFehlt: (werte) =>
      `Jede Beanstandung braucht eine einstufung: ${werte.join(' oder ')}. „mechanisch" ist ein eng ` +
      'umrissener, mechanisch behebbarer Fehler (Tippfehler, falscher Wert, vergessener Randfall); ' +
      'alles, was Umbau, neue Struktur oder eine Entscheidung braucht, ist „grundsaetzlich". Im ' +
      'Zweifel „grundsaetzlich".',
    schwereFehlt: (werte) => `Jeder Fund braucht eine schwere: ${werte.join(', ')}.`,
    dateiArtFehlt: (werte) => `Jede Datei braucht eine art: ${werte.join(', ')}.`,
    pruefkarteUnvollstaendig:
      'Für die Prüfkarte brauchst du beides: pruefkarteTitel (kurzer Name des Geprüften) und ' +
      'pruefkarteText (was geprüft wurde und woran man erkennt, dass es in Ordnung ist).',
    kriteriumUnvollstaendig:
      'Jeder Eintrag in kriterien braucht beides: kriterium (das Fertig-Kriterium) und ' +
      'wieUmgesetzt (wie du es umgesetzt hast).',
    fundUnvollstaendig:
      'Jeder Eintrag in angriffsliste braucht beides: fund (der Fund aus der Angriffsliste) und umgang ' +
      '(wie du ihn ausgeräumt hast oder warum er dieses Paket nicht trifft).',
    keineFunde: 'Keine wesentlichen Funde.',
    einstufungen: { mechanisch: 'mechanisch', grundsaetzlich: 'grundsätzlich' },
    schweren: { hoch: 'hoch', mittel: 'mittel', niedrig: 'niedrig' },
    urteile: { bestanden: 'bestanden', fehlgeschlagen: 'fehlgeschlagen' },
    dateiArten: { neu: 'neu', geaendert: 'geändert', geloescht: 'gelöscht' },
    labels: {
      fazit: 'Fazit',
      getan: 'Erledigt',
      offen: 'Offen geblieben',
      anmerkung: 'Anmerkung',
      ziel: 'Ziel des Pakets',
      fertigKriterien: 'Fertig-Kriterien',
      schritte: 'Umsetzungsschritte',
      fundstellen: 'Voraussichtlich betroffen',
      nichtDabei: 'Nicht Teil des Pakets',
      // Zuschnitt je Ziel und Datenvertrag (BAUPLAN 44).
      zielBlock: 'Für',
      erlaubteDateien: 'Erlaubte Dateien',
      bausteine: 'Diese Bausteine entstehen',
      schnittstellen: 'Rein und raus',
      urteil: 'Urteil',
      beanstandungen: 'Beanstandungen',
      rotVorGruen: 'Rot-vor-Grün-Beleg',
      geprueft: 'Geprüfte Kriterien',
      kriterien: 'Kriterium für Kriterium',
      dateien: 'Angelegte und geänderte Dateien',
      angriffsliste: 'Umgang mit der Angriffsliste',
      funde: 'Funde'
    },
    // Werkzeug-Beschreibungen (sie stehen im Werkzeugkasten des Agenten).
    // Empfänger im Auftrag (BAUPLAN 43): Diese Beschreibungen baut FlowForge
    // EINMAL je Motor-Session und sie stehen im Werkzeugkasten jedes Agenten —
    // je Blockinstanz können sie gar nicht anders lauten (Prompt-Cache). Sie
    // dürfen deshalb keinen Empfänger behaupten; das tut der Vorspann.
    werkzeuge: {
      rahmen:
        'Meldet dein Blockergebnis an FlowForge — Pflicht zum Abschluss deines Blocks. Der Rahmen ' +
        '(fazit, getan, offen, anmerkung) plus ein Freitext-Feld für deine eigentliche Lieferung.',
      arbeitspaket:
        'Meldet die geschnittenen Arbeitspakete an FlowForge — Pflicht zum Abschluss deines ' +
        'Blocks, und zwar in EINEM Aufruf: pakete trägt je benanntem Ziel einen Zuschnitt ' +
        '(ein zweiter Aufruf ersetzt den ersten). Die Fertig-Kriterien sind der Maßstab, an ' +
        'dem das Ergebnis später gemessen wird; erlaubteDateien ist der Datenvertrag — nenne ' +
        'Dateien und Ordner einzeln, Platzhalter wie * oder ** sind nicht erlaubt.',
      pruefbeleg:
        'Meldet deinen Prüfbeleg an FlowForge — Pflicht zum Abschluss deines Blocks. Aus dem ' +
        'Urteil und den Beanstandungen steuert FlowForge die Reparatur-Runden; aus der Prüfkarte ' +
        'entsteht bei bestandener Prüfung das Prüf-Gedächtnis des Projekts.',
      umsetzungsbericht:
        'Meldet deinen Umsetzungsbericht an FlowForge — Pflicht zum Abschluss deines Blocks. Je ' +
        'Fertig-Kriterium des Arbeitspakets: wie und wo du es umgesetzt hast.',
      angriffsliste:
        'Meldet deine Angriffsliste an FlowForge — Pflicht zum Abschluss deines Blocks. ' +
        'Nichts gefunden? Dann melde eine leere Liste — das ist ein ' +
        'gutes Ergebnis, erfinde keine Funde.',
      befundliste:
        'Meldet deine Befundliste an FlowForge — Pflicht zum Abschluss deines Blocks. Nichts ' +
        'Wesentliches gefunden? Dann melde eine leere Liste — erfinde keine Funde.'
    },
    param: {
      fazit: 'Dein Ergebnis in EINEM Satz — er steht im Ticker, am Block und im Laufbericht.',
      getan: 'Kurze Stichpunkte: was du in diesem Block wirklich erledigt hast.',
      offen: 'Kurze Stichpunkte: was offen geblieben ist oder bewusst nicht getan wurde.',
      // Empfänger im Auftrag (BAUPLAN 43): Diese Feldbeschreibung steht im
      // Werkzeugkasten jedes Agenten und wird einmal je Motor gebaut — sie darf
      // keinen nächsten Block behaupten, sonst widerspricht sie beim letzten
      // Block dem Vorspann („geht an niemanden") im selben Prompt. Wortlaut wie
      // in auftragZusatz oben.
      anmerkung:
        'Freifeld: alles, was in kein anderes Feld passt und trotzdem ankommen soll. ' +
        'Leer lassen, wenn es nichts gibt.',
      etikett: 'Nur nötig, wenn dein Block mehreres liefert: worum es bei dieser Meldung geht.',
      inhalt: 'Deine eigentliche Lieferung als Fließtext — so ausführlich wie nötig, so kurz wie möglich.',
      ziel: 'Das Ziel des Arbeitspakets in einem Satz.',
      fertigKriterien:
        'Prüfbare Aussagen, an denen sich das Ergebnis später messen lässt — bei gebündelten ' +
        'Aufgaben eigene Kriterien je Teilstück. Mindestens eine.',
      schritte: 'Umsetzungsschritte in sinnvoller Reihenfolge.',
      fundstellen: 'Voraussichtlich betroffene Dateien und Stellen.',
      nichtDabei: 'Was ausdrücklich NICHT Teil des Pakets ist.',
      // Zuschnitt je Ziel und Datenvertrag (BAUPLAN 44).
      pakete:
        'Je benanntem Ziel deines Auftrags EIN Zuschnitt — alle in diesem einen Aufruf. Gibt ' +
        'es kein benanntes Ziel, genau einer ohne zielBlock (er gilt dann für alle).',
      zielBlock:
        'Die Blocknummer des Ziels, für das dieser Zuschnitt ist (z.B. „3") — dein Auftrag ' +
        'listet die benannten Ziele mit ihrer Nummer. Danach richtet FlowForge die Zustellung ' +
        'aus: Nur dieser Block und die Blöcke hinter ihm, die an seiner Arbeit weiterarbeiten, ' +
        'bekommen diesen Zuschnitt. Leer lassen, wenn es nur ein Ziel gibt oder keines ' +
        'benannt ist.',
      // Kurzname je Ziel (0.51.1) — daraus wird der Laufzeit-Zusatzname.
      kurzname:
        'Ein Kurzname für den Ziel-Block dieses Zuschnitts, 2–3 Wörter, die sagen, woran er ' +
        'arbeitet (z.B. „Server-Briefing"). FlowForge hängt ihn als Zusatznamen an die ' +
        'Ziel-Instanz — sonst tragen zwei gleichartige Ziele denselben Namen und niemand ' +
        'sieht im Verlauf, wer gerade woran arbeitet. Pflicht, sobald du zielBlock angibst.',
      paketAufgabenIds:
        'Die ids der Aufgaben-Karten aus deiner paket_melden-Meldung, die dieser Zuschnitt ' +
        'abdeckt — daran erkennt FlowForge, dass keine Aufgabe unter den Tisch fällt.',
      erlaubteDateien:
        'Der Datenvertrag: welche Dateien und Ordner dieses Paket anfassen darf — auch die, ' +
        'die erst entstehen. Je Eintrag ein Pfad relativ zum Projektordner ' +
        '(„src/main/lauf.js") oder ein Ordner mit Schrägstrich am Ende („src/shared/"). ' +
        'Platzhalter wie *, ** oder ? versteht FlowForge nicht und weist sie ab. Diese Liste ' +
        'IST die Schreibsperre des umsetzenden Blocks: Was nicht drinsteht, kann er nicht ' +
        'schreiben. Nenne sie vollständig und schneide sie so, dass zwei Pakete sich nicht ' +
        'überschneiden.',
      bausteine: 'Welche Bausteine in diesem Paket entstehen — je Eintrag einer, mit Namen.',
      schnittstellen:
        'Was in dieses Paket hineingeht und was herauskommt — die Nahtstellen zu den anderen ' +
        'Paketen, je Eintrag eine.',
      urteil:
        'bestanden = alle Fertig-Kriterien halten · fehlgeschlagen = mindestens eines hält nicht ' +
        '(dann gehört jede Beanstandung einzeln in beanstandungen).',
      beanstandungen:
        'Je Beanstandung ein Eintrag: was nicht hält (text), wo (fundort) und wie schwer sie zu ' +
        'beheben ist (einstufung). Die Einstufung entscheidet, ob eine kleine lokale KI die ' +
        'Reparatur zuerst versuchen darf.',
      beanstandungText: 'Was nicht hält — konkret genug, dass es sich ohne Rückfrage beheben lässt.',
      beanstandungEinstufung:
        'mechanisch = eng umrissen und mechanisch behebbar (Tippfehler, falscher Wert, vergessener ' +
        'Randfall) · grundsaetzlich = braucht Umbau, neue Struktur oder eine Entscheidung. Im Zweifel grundsaetzlich.',
      fundort: 'Wo genau — Datei und Stelle.',
      rotVorGruen:
        'Der Rot-vor-Grün-Beleg: die tatsächlichen Ausgaben des Tests mit verfälschter Erwartung ' +
        '(rot) und danach unverändert echt (grün), kurz zitiert.',
      geprueft: 'Welche Fertig-Kriterien du wie geprüft hast.',
      pruefkarteTitel:
        'Kurzer Name des Geprüften — daraus legt FlowForge bei bestandener Prüfung die Prüfkarte an.',
      pruefkarteText:
        'Was geprüft wurde und woran man erkennt, dass es in Ordnung ist — ein bis zwei Sätze in ' +
        'Alltagssprache.',
      kriterien: 'Je Fertig-Kriterium des Arbeitspakets ein Eintrag: welches, und wie du es umgesetzt hast.',
      kriterium: 'Das Fertig-Kriterium aus dem Arbeitspaket.',
      wieUmgesetzt: 'Wie du es umgesetzt hast — mit Fundort.',
      dateien: 'Jede Datei, die du angelegt, geändert oder gelöscht hast.',
      dateiPfad: 'Pfad relativ zum Projektordner.',
      dateiArt: 'neu, geaendert oder geloescht.',
      angriffsliste:
        'Nur wenn dir eine Angriffsliste vorlag: je Fund, wie du ihn ausgeräumt hast — oder warum ' +
        'er dieses Paket nicht trifft.',
      fund: 'Der Fund aus der Angriffsliste.',
      umgang: 'Wie du damit umgegangen bist.',
      funde: 'Je Fund ein Eintrag — nach Schwere sortiert, mit Fundort. Leere Liste ist erlaubt.',
      fundText: 'Der Fund in ein bis zwei Sätzen.',
      schwere: 'hoch, mittel oder niedrig.'
    }
  },
  // Tor ohne KI (BAUPLAN 35): FlowForge spielt Prüfbefehl und Rauchtest selbst
  // ab. Das Ergebnis wird seit BAUPLAN 42 direkt als strukturierter Prüfbeleg
  // gemeldet — nicht mehr als Text mit Marken.
  tor: {
    belegKopf: (befehl, code) =>
      `Prüfbefehl von FlowForge abgespielt (ohne Agenten): „${befehl}" — rot, ` +
      `Rückgabecode ${code}.`,
    belegKopfZeitlimit: (befehl) =>
      `Prüfbefehl von FlowForge abgespielt (ohne Agenten): „${befehl}" — rot, der Befehl ` +
      'lief in das Zeitlimit und wurde abgebrochen.',
    // Fundort einer Tor-Beanstandung: FlowForge kennt keine Datei, wohl aber
    // den Befehl, der die Zeile ausgegeben hat.
    beanstandungFundort: (befehl) => `Prüfbefehl: ${befehl}`,
    beanstandungOhneZeilen: (befehl) =>
      `Der Prüfbefehl „${befehl}" schlägt fehl, ohne eine erkennbare Fehlerzeile auszugeben — ` +
      'sieh im vollständigen Protokoll nach.',
    weitere: (anzahl) =>
      `${anzahl} weitere Fehlerzeile${anzahl === 1 ? '' : 'n'} stehen im vollständigen Protokoll, ` +
      'das der Rückmeldung zusätzlich beiliegt.',
    // Bewusst „grundsaetzlich": FlowForge kann ein Fehlerprotokoll nicht
    // einstufen — nur der Prüfer kann das. Damit bleibt die lokale
    // Vorreparatur (BAUPLAN 20) hier außen vor, statt blind zu raten.
    einstufung: 'grundsaetzlich',
    protokoll: (ausgabe) => `\n\nVollständige Ausgabe des Prüfbefehls:\n${ausgabe}`,
    rauchtestDateiFehlt: (adresse) =>
      `Die Startanleitung zeigt auf die Datei „${adresse}" — die gibt es im Projektordner nicht.`,
    rauchtestKeineAntwort: (adresse) =>
      `Der Befehl lief an, aber unter ${adresse} antwortete nichts.`,
    rauchtestOhneAusgabe:
      'Der Startversuch schlug fehl, ohne eine Ausgabe zu hinterlassen — der Befehl der Startanleitung läuft so nicht an.',
    // Altlast-Karte (BAUPLAN 35): War der Prüfbefehl schon vor dem Lauf rot,
    // wird daraus eine offene Aufgaben-Karte statt einer Reparatur-Runde.
    // Der Titel bleibt bewusst stabil (ohne Datum), damit derselbe Befund
    // nicht bei jedem Lauf eine neue Karte anlegt.
    altlastTitel: 'Altlast: Prüfungen waren schon vor dem Lauf rot',
    altlastThema: 'Altlasten',
    // Die Karten-Längengrenze (400 Zeichen) ist hart — deshalb wird hier
    // gedeckelt, statt die Karte am Ende abgewiesen zu bekommen.
    altlastText: (befehl, zeilen) => {
      const kopf =
        `Der aufbewahrte Prüfbefehl „${befehl}" war schon vor dem Lauf rot — das stammt nicht ` +
        'aus dem aktuellen Paket. Rot war: '
      const platz = Math.max(0, 400 - kopf.length)
      const rest = String(zeilen ?? '').replace(/\s+/g, ' ').trim()
      return kopf + (rest.length > platz ? rest.slice(0, Math.max(0, platz - 1)) + '…' : rest)
    },
    // Tor-Anker des lokalen Prüfers (BAUPLAN 50): Klartext je Ausgang — für
    // den Auftrag der Abnahme (agentenUebergabe.abnahmeLokalerPruefer).
    // null = kein Nachspiel (der lokale Prüfer hat „fehlgeschlagen" gemeldet,
    // oder das Vor-Tor dieses Anlaufs war schon grün).
    bestaetigungFuerAbnahme: (torBestaetigung) =>
      ({
        gruen: 'grün — sein Prüfbefehl lief ohne KI durch, das Urteil „bestanden" ist mechanisch bestätigt.',
        altlasten:
          'rot, aber nur mit Fehlschlägen, die schon vor dem Lauf da waren (Altlasten) — kein neuer Fehlschlag.',
        rot: 'rot — FlowForge hat sein „bestanden" mechanisch auf „fehlgeschlagen" gedreht.',
        keine: 'nicht möglich — er hat keinen Prüfbefehl hinterlegt; sein Urteil ist mechanisch unbestätigt.',
        abgebrochen: 'abgebrochen — sein Urteil ist mechanisch unbestätigt.'
      })[torBestaetigung] ?? 'kein Nachspiel — sein Urteil wurde nicht mechanisch nachgespielt.'
  },
  // App-Werkzeuge des Co-Piloten (BAUPLAN 33): Texte an den Agenten.
  agentenApp: {
    anweisungen:
      'Mit den app-Werkzeugen bedienst du die gebaute App des Projekts über FlowForges App-Tab: ' +
      'app_starten / app_stoppen / app_neustarten steuern den Prozess, app_ausgabe liefert Zustand ' +
      'und die letzte Ausgabe. Es ist derselbe Prozess, den der Nutzer im App-Tab sieht.',
    startenBeschreibung:
      'Startet die App des Projekts nach ihrer Startanleitung im App-Tab von FlowForge (sichtbar ' +
      'für den Nutzer). Liefert Zustand und die ersten Zeilen der Ausgabe. Ist der Port belegt, ' +
      'nennt die Antwort den Besitzer-Prozess — beenden lässt er sich nur mit port_freimachen ' +
      '(löst eine Rückfrage beim Nutzer aus).',
    portFreimachenParam:
      'true = einen fremden Prozess, der den Port der Startanleitung belegt, vorher beenden (Rückfrage beim Nutzer)',
    stoppenBeschreibung: 'Stoppt die im App-Tab laufende App (ganzer Prozessbaum).',
    neustartenBeschreibung:
      'Stoppt die App und startet sie neu nach ihrer Startanleitung; liefert Zustand und die ersten Zeilen der Ausgabe.',
    ausgabeBeschreibung:
      'Liest Zustand („läuft seit …", „beendet mit Code …") und die letzte Ausgabe der App aus dem ' +
      'App-Tab (Standard- und Fehlerausgabe). Erst lesen, dann über Fehler sprechen.',
    zeichenParam: (standard, max) =>
      `Wie viele Zeichen vom Ende der Ausgabe (Standard ${standard}, höchstens ${max})`,
    gestartet: 'App gestartet.',
    neuGestartet: 'App neu gestartet.',
    gestoppt: 'App gestoppt.',
    zustand: (text) => `Zustand: ${text}`,
    ausgabe: (text) => `Ausgabe (Ende):\n${text}`,
    keineAusgabe: 'Noch keine Ausgabe.',
    portBelegt: (port, name, pid, befehl) =>
      `Port ${port} ist belegt — von „${name || 'unbekannt'}" (Prozess ${pid}${befehl ? `, Befehlszeile: ${befehl}` : ''}). ` +
      'Meist ein Server, den ein früherer Lauf gestartet und nie beendet hat. Erkläre es dem Nutzer; ' +
      'beenden kannst du ihn nur mit app_starten(port_freimachen: true) — das fragt den Nutzer.'
  },
  // Eigener Bestätigungs-Dialog statt nativer Windows-Fenster (Bugfix 13.08.2026).
  bestaetigung: {
    abbrechen: 'Abbrechen',
    ja: 'Ja',
    ok: 'Alles klar',
    loeschen: 'Löschen',
    ersetzen: 'Vorlage übernehmen',
    sofortAbbrechen: 'Sofort abbrechen'
  },
  fehler: {
    projektNichtGefunden: 'Der Projektordner ist nicht mehr da. Wurde er verschoben oder gelöscht?',
    kartenDateiKaputt:
      'Die Kartendatei dieses Projekts ist beschädigt und konnte nicht gelesen werden.',
    unbekannt: 'Das hat leider nicht geklappt. Bitte versuch es noch einmal.'
  },
  einstellungen: {
    ueberschrift: 'Einstellungen',
    knopf: 'Einstellungen',
    motorUeberschrift: 'KI-Motor',
    modusFeld: 'Wie soll sich der Motor anmelden?',
    modusAbo: 'Mit meinem Claude-Abo',
    // Abo-Regel neu (SPEC §2, 0.46.4): kein Verstecken, kein Schalter-Theater —
    // der ehrliche Satz steht beim Erststart und hier in den Einstellungen.
    modusAboHinweis:
      'Nutzt dein bestehendes Claude-Login (Claude Code CLI). Läuft über dein Abo-Kontingent. ' +
      'Anthropic hat angekündigt, Agent-SDK-Nutzung künftig getrennt abzurechnen, und will ' +
      'vorher Bescheid geben — dann ist der API-Schlüssel der Weg. Ausnahme schon heute: ' +
      'Blöcke der Klasse „Extra (Fable 5)" können je nach Abo Guthaben statt Kontingent kosten ' +
      '— FlowForge fragt beim ersten Lauf mit einem Extra-Block einmal nach.',
    modusApi: 'Mit API-Schlüssel',
    modusApiHinweis: 'Abrechnung pro Verbrauch über dein Anthropic-Konto.',
    apiSchluesselFeld: 'API-Schlüssel',
    apiSchluesselPlatzhalter: 'sk-ant-…',
    obergrenzeFeld: 'Ausgaben-Obergrenze pro Lauf (US-Dollar)',
    obergrenzeHinweis: 'Erreicht ein Lauf diese Grenze, hält der Motor von selbst an.',
    // Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026).
    lokaleHelferUeberschrift: 'Lokale Helfer-KI (Experiment)',
    lokaleHelferAktiv: 'Recherche-, Entwurfs- und Bau-Aufträge an eine lokale KI (Ollama) geben',
    lokaleHelferHinweis:
      'Die Block-Agenten geben Einlesen, Suchen, Entwürfe und zusammenhängende ' +
      'Bau-Teilaufträge — auch mittelgroße Stücke wie ein ganzes Modul — an eine KI auf ' +
      'deinem Rechner ab; das kostet kein Abo-Kontingent, nur Rechenzeit. Schreiben darf ' +
      'die lokale KI nur an kurzer Leine: ' +
      'Entwürfe landen in der Wegwerf-Ablage und werden vom Motor gegengelesen, die ' +
      'Vorreparatur ersetzt gezielt nach Prüfer-Beanstandungen, und jedes gebaute ' +
      'Teilstück wird sofort abgenommen — immer mit Sicherungspunkt und automatischem ' +
      'Zurückrollen, wenn es nicht hält. ' +
      'Achtung: Kleine Modelle arbeiten langsamer und ungenauer; wichtige Fundorte ' +
      'prüft der Agent selbst nach. Voraussetzung: Ollama läuft und das Modell ist ' +
      'heruntergeladen.',
    // Trefferquote (BAUPLAN 23): Standard an, solange die lokale KI ein
    // Experiment ist — ohne Quote ist die Kosten-Wette blind.
    lokaleHelferQuote: 'Trefferquote der lokalen KI erfassen',
    lokaleHelferQuoteHinweis:
      'Nach jeder lokalen Recherche meldet der Agent, ob er das Fazit übernommen oder ' +
      'verworfen hat (minimaler Token-Mehrverbrauch). Ticker und Laufbericht zählen mit — ' +
      'so siehst du, ob sich die lokale KI lohnt.',
    lokaleHelferModell: 'Modellname bei Ollama',
    // Adress-Liste (BAUPLAN 51): mehrere Ollama-Rechner/GPUs — Listeneditor
    // statt Einzelfeld. Die erste Adresse bleibt der Anker für Helfer-KI und
    // Vorreparatur.
    lokaleHelferAdressen: 'Adressen der Ollama-Rechner',
    lokaleHelferAdresseHinzufuegen: 'Adresse hinzufügen',
    lokaleHelferAdresseEntfernen: 'Entfernen',
    lokaleHelferAdressenHinweis:
      'http://127.0.0.1:11434 = dieser Rechner. Es geht auch ein anderer Rechner im ' +
      'Heimnetz, z.B. ein Gaming-PC: http://192.168.x.x:11434 — dort muss Ollama laufen ' +
      'und für das Netzwerk freigegeben sein. Mit mehreren Adressen laufen mehrere lokale ' +
      'Blöcke gleichzeitig (einer je Adresse). Jede Adresse braucht dasselbe Basis-Modell ' +
      '(oben); die Helfer-KI und die Vorreparatur nutzen immer die erste Adresse. ' +
      'Achtung: „localhost" und „http://127.0.0.1" meinen dieselbe Grafikkarte — trag ' +
      'denselben Rechner nur einmal ein, sonst teilen sich zwei Blöcke eine Karte und ' +
      'alles wird langsam.',
    lokaleHelferStatusBereit: (modell) => `Ollama läuft, Modell „${modell}" ist da.`,
    lokaleHelferStatusKeinModell: (modell) =>
      `Ollama läuft, aber das Modell „${modell}" ist nicht heruntergeladen.`,
    lokaleHelferStatusVorhandene: (modelle) => `Vorhanden: ${modelle.join(', ')}.`,
    lokaleHelferStatusAus: 'Ollama ist unter dieser Adresse gerade nicht erreichbar.',
    // Kontext-Fenster (seit 0.46.3): 32k / 64k / 128k, Werkzeug-Deckel wachsen mit.
    lokaleHelferKontext: 'Kontextfenster der lokalen KI',
    lokaleHelferKontextWahl: (kontext) => `${Math.round(kontext / 1024)}k Token`,
    lokaleHelferKontextHinweis:
      'Wie viel die lokale KI auf einmal im Kopf behält. Mit dem Fenster wachsen auch ihre ' +
      'Portionen (Zeilen je Lesen, Suchtreffer, Runden). Faustregel fürs Grafikspeicher-Budget: ' +
      'Das Arbeitsgedächtnis kostet zusätzlich zu den Modell-Gewichten grob 250 KB je Token bei ' +
      'einem 27B-Modell — 64k ≈ 16 GB, 128k ≈ 32 GB. Passt es nicht mehr in die Karte, ' +
      'lagert Ollama still in den Arbeitsspeicher aus und alles wird sehr langsam. Empfehlung: ' +
      '64k; 128k nur, wenn Ollama beim Laufen (ollama ps) noch „100 % GPU" zeigt.',
    // Lokale KI als Block-Agent (BAUPLAN 49): Georgs lokale KI darf ganze
    // Blöcke übernehmen (Modellklasse „lokal" an der Karte). Läuft über
    // Ollamas Anthropic-Schnittstelle in einer eigenen Motor-Instanz. Die
    // Feineinstellungen werden zu einem abgeleiteten Ollama-Modell
    // flowforge-<basis>; Empfehlungen aus der Qwen3.8-Modellkarte (08/2026).
    lokalBlockUeberschrift: 'Lokale KI als Block-Agent',
    lokalBlockAgent: 'Lokale KI darf ganze Blöcke übernehmen (Modellklasse „lokal")',
    lokalBlockAgentHinweis:
      'An jeder Blockkarte und im Block-Editor gibt es dann die Modellklasse „lokal (Ollama)": ' +
      'Der Block läuft komplett auf deiner lokalen KI — mit denselben Werkzeugen, Sperren und ' +
      'Rückfragen wie bei Claude, kostet kein Kontingent, nur Rechenzeit. Modell, Adresse und ' +
      'Kontextfenster sind die der lokalen Helfer-KI oben. Ohne eingeschaltete und erreichbare ' +
      'lokale KI startet ein Lauf mit einem lokalen Block nicht — FlowForge fällt nie still auf ' +
      'Claude zurück. Je Ollama-Adresse läuft ein lokaler Block zur Zeit (eine Grafikkarte) — ' +
      'mit mehreren eingetragenen Adressen laufen entsprechend mehrere lokale Blöcke parallel.',
    lokalBlockNurMitHelfer:
      'Erst die lokale Helfer-KI oben einschalten — der Block-Agent nutzt deren Modell und Adresse.',
    lokalBlockFeinTitel: 'Feineinstellungen des lokalen Modells',
    lokalBlockFeinHinweis:
      'Die Claude-Werkzeuge schicken keine Temperatur und keine Ollama-Optionen mit — wirksam ' +
      'sind die Standardwerte am Modell. Deshalb legt FlowForge aus diesen Werten und dem ' +
      'Kontextfenster ein abgeleitetes Ollama-Modell an (Name: flowforge-<dein Modell>, auf ' +
      'dem Ollama-Rechner) und lässt lokale Blöcke darauf laufen. Es lädt nur neu in den ' +
      'Grafikspeicher, wenn du hier Werte änderst — nicht je Lauf. Leer = Ollama nimmt seinen ' +
      'Standardwert.',
    lokalBlockAbgeleitet: (name) => `Abgeleitetes Modell bei Ollama: ${name}`,
    lokalBlockAbgeleitetOhneBasis: 'Trag oben zuerst den Modellnamen bei Ollama ein.',
    lokalBlockVorlagen: 'Vorlagen',
    lokalBlockVorlagenHinweis:
      'Setzen alle Felder auf einmal. „Qwen3.8 Denken" sind die Herstellerwerte der ' +
      'Qwen3.8-Modellkarte für Aufgaben mit Nachdenken, „Qwen3.8 Coding" dieselben mit ' +
      'niedrigerer Temperatur fürs Programmieren — Empfehlung für den Bauer. ' +
      '„Ollama-Standard" leert alle Felder.',
    lokalBlockVorlageNamen: {
      'qwen-denken': 'Qwen3.8 Denken',
      'qwen-coding': 'Qwen3.8 Coding',
      'ollama-standard': 'Ollama-Standard'
    },
    lokalBlockFeinLeer: 'leer = Ollama-Standard',
    lokalBlockFeinFelder: {
      temperatur: 'Temperatur',
      topP: 'Top-p',
      topK: 'Top-k',
      minP: 'Min-p',
      wiederholungsstrafe: 'Wiederholungsstrafe',
      antwortlaenge: 'Antwortlänge (Token)',
      entwurfsTokens: 'Entwurfs-Tokens (MTP)'
    },
    lokalBlockFeinHinweise: {
      temperatur:
        'Wie viel Zufall in jeder Antwort steckt (0–2). Niedrig = vorhersagbarer, neigt aber zu ' +
        'Wiederholungen; hoch = kreativer, aber fahriger. Qwen3.8 empfiehlt 1.0 fürs Denken, ' +
        'fürs Programmieren eher 0.6.',
      topP:
        'Aus wie viel Wahrscheinlichkeitsmasse das nächste Wort gezogen wird (0–1). Kleiner = ' +
        'enger, sicherer; größer = mehr Auswahl. Qwen3.8-Empfehlung: 0.95.',
      topK:
        'Höchstens so viele Kandidaten je Wort (ganze Zahl, 0 = aus). Kleiner schneidet ' +
        'Unsinn ab, zu klein macht die Antwort eintönig. Qwen3.8-Empfehlung: 20.',
      minP:
        'Mindest-Wahrscheinlichkeit eines Kandidaten im Verhältnis zum besten (0–1). 0 = ' +
        'aus. Qwen3.8-Empfehlung: 0.',
      wiederholungsstrafe:
        'Bestraft Wörter, die schon dastehen (0.5–2; 1.0 = keine Strafe). Höher hilft gegen ' +
        'Schleifen, verdirbt aber Code, der sich wiederholen MUSS (Klammern, Namen). ' +
        'Qwen3.8-Empfehlung: 1.0.',
      antwortlaenge:
        'Höchstens so viele Token je Antwort (ganze Zahl). Leer = unbegrenzt — für einen ' +
        'Block-Agenten die Empfehlung: abgeschnittene Antworten brechen Werkzeugaufrufe.',
      entwurfsTokens:
        'Spekulatives Dekodieren: So viele Token entwirft der eingebaute Entwurfskopf auf ' +
        'einmal (0–64, 0 = aus). Wirkt nur bei Modellen mit Entwurfskopf, z.B. den ' +
        'MTP-Fassungen von Qwen3.8 (bis ~2× schneller); bei anderen ändert sich nichts. Ob es ' +
        'wirkt, siehst du im Ticker und Laufbericht an Dauer und Tokens je Block.'
    },
    lokalBlockDenkenHinweis:
      'Denken bleibt an: Über diesen Weg lässt sich das Nachdenken des lokalen Modells nicht ' +
      'abschalten (gemessen 19.08.2026) — deshalb gibt es hier keinen Schalter, und die ' +
      'Denktiefe der Blockkarte gilt für lokale Blöcke nicht. Die Antwort enthält den Denkteil ' +
      'nicht, er kostet nur Zeit und Tokens.',
    fehlerLokalFein: (feld) => `Feineinstellung „${feld}" liegt außerhalb des erlaubten Bereichs.`,
    // Unteraufgaben-Modell (BAUPLAN 37): der Motor-Zwilling der lokalen
    // Helfer-KI — Zuarbeit muss nicht auf dem großen Modell laufen.
    unteraufgabenUeberschrift: 'Modell der Unteraufgaben',
    unteraufgabenSparsam: 'Sparsam (Standard)',
    unteraufgabenSparsamHinweis:
      'Wenn ein Block breit suchen oder viel einlesen muss, gibt er das an Unteraufgaben ab — Späher des Angreifers, Einlese-Helfer von Bauer, Prüfer und Diagnose. Die laufen dann auf dem kleineren Modell (Sonnet): deutlich billiger, und der Block selbst liest ihr Fazit ohnehin gegen. Läuft ein Block schon sparsamer, wird er nicht teurer gemacht.',
    unteraufgabenWieBlock: 'Wie der Block selbst',
    unteraufgabenWieBlockHinweis:
      'Unteraufgaben laufen auf demselben Modell wie ihr Block. Teurer, aber die Zuarbeit ist genauso gründlich wie der Block. Die drei Blickwinkel des Audits folgen ohnehin immer ihrem Block.',
    uebertragUeberschrift: 'Sessions & Übertrag',
    uebertragTest: 'Test-Schalter: Übertrag schon bei etwa 10 %',
    uebertragTestHinweis:
      'Nur zum Ausprobieren des automatischen Übertrags: Er greift dann schon, sobald ein Block ' +
      'etwa 10 Prozentpunkte Kontext verbraucht hat — statt erst bei 85 %. Im Alltag ausschalten, ' +
      'sonst wird unnötig oft übergeben.',
    rechteUeberschrift: 'Rechte-Rückfragen',
    rechteFragen: 'Jedes Mal fragen (Standard)',
    rechteFragenHinweis:
      'Bei allem außerhalb des Projektordners, Internet und unbekannten Befehlen wirst du gefragt.',
    // Befehle trotz „darf nur lesen" (Entscheidung Georg, 14.08.2026):
    // Auf-eigene-Gefahr-Schalter, Standard aus.
    nurLesenBefehle: 'Nur-lesende Blöcke dürfen Befehle ausführen (auf eigene Gefahr)',
    nurLesenBefehleHinweis:
      'Angreifer und Diagnose dürfen dann z.B. Prüfskripte laufen lassen, um ihre Funde zu ' +
      'belegen — mit denselben Regeln wie beim Bauer (Git bleibt gesperrt, Unbekanntes ' +
      'fragt). Achtung: Ein ausgeführtes Skript kann Dateien verändern — die Garantie ' +
      '„nur-lesende Blöcke fassen nichts an" gilt dann nicht mehr. Schreib-Werkzeuge ' +
      'bleiben für diese Blöcke gesperrt.',
    rechteAutomatisch: 'Automodus: automatisch erlauben',
    rechteAutomatischHinweis:
      'Rückfragen werden ohne Nachfrage erlaubt und im Laufbericht vermerkt. Die harten Sperren ' +
      '(Git, FlowForge-Verwaltungsdateien, „darf nur lesen") gelten weiterhin. Der Agent darf dann ' +
      'aber z.B. außerhalb des Projektordners schreiben und ins Internet — nutze das nur, wenn du ' +
      'dem Auftrag vertraust.',
    speichern: 'Speichern',
    abbrechen: 'Abbrechen',
    fehlerApiSchluesselFehlt: 'Für den API-Modus brauchst du einen API-Schlüssel.',
    fehlerObergrenze: 'Die Ausgaben-Obergrenze muss eine Zahl größer als 0 sein.',
    // Erststart-Wahl (0.46.4): kein stiller Standard.
    fehlerModusFehlt:
      'Wähle zuerst, wie sich der Motor anmelden soll — mit deinem Claude-Abo oder mit API-Schlüssel (Einstellungen → KI-Motor).'
  },
  // Erststart-Dialog (SPEC §9, seit 0.46.4): Beim ersten Start wählt der Nutzer
  // den Motor-Modus selbst; die Wahltexte sind dieselben wie in den Einstellungen.
  erststart: {
    ueberschrift: 'Willkommen bei FlowForge',
    einleitung:
      'FlowForge startet im Hintergrund die Claude Code CLI als KI-Motor. Bevor es losgeht, ' +
      'entscheide einmal, wie sich der Motor anmelden soll — du kannst das jederzeit in den ' +
      'Einstellungen ändern.',
    aboVoraussetzung:
      'Voraussetzung: Du bist einmal in der Claude-App bzw. mit „claude" auf diesem Rechner angemeldet.',
    weiter: 'Los geht’s'
  },
  lauf: {
    laeuft: 'läuft …',
    sanftStoppen: 'Sanft anhalten',
    sanftStoppenHinweis: 'Der laufende Block macht fertig, dann hält der Lauf an.',
    hartStoppen: 'Sofort abbrechen',
    hartStoppenBestaetigung:
      'Sofort abbrechen? Der Block gilt dann als nicht gelaufen — angefangene Änderungen werden auf den letzten Sicherungspunkt zurückgesetzt.',
    // Lauf-Tab zeigt, welcher Block gerade arbeitet (Wunsch Georg, 13.08.2026).
    geradeArbeitet: (n) => (n === 1 ? 'Gerade arbeitet:' : 'Gerade arbeiten:'),
    // Denk-Ansicht statt Rohprotokoll (BAUPLAN 24): sichtbares Denken der
    // gerade arbeitenden KI — JSON-Zeilen sieht kein Mensch durch.
    denkenZeigen: 'Denken einblenden',
    denkenVerbergen: 'Denken ausblenden',
    denkenLeer: 'Noch kein Denken zu sehen — sobald die KI nachdenkt, steht es hier.',
    denkenKoordinator: 'Koordinator',
    denkenUnteraufgabe: 'Unteraufgabe',
    denkenLokaleKi: 'lokale KI',
    verbrauchKontext: (von, bis) => `Kontext: etwa ${von}–${bis} % gefüllt`,
    // Füllstand des Block-Agenten (BAUPLAN 36): der Balken misst den
    // Koordinator, gearbeitet wird aber im Agenten.
    verbrauchAgent: (von, bis) =>
      `Der arbeitende Block-Agent hat sein eigenes Fenster: etwa ${von}–${bis} % gefüllt.`,
    verbrauchTokens: (tokens) => `${tokens.toLocaleString('de-DE')} Tokens`,
    verbrauchKosten: (usd) => `Kosten bisher: ${usd.toFixed(2).replace('.', ',')} $`,
    verbrauchKostenAbo: 'im Abo enthalten',
    zustandLabels: {
      erfolgreich: 'Erfolgreich',
      fehlgeschlagen: 'Fehlgeschlagen',
      'sanft-gestoppt': 'Sanft gestoppt',
      'hart-abgebrochen': 'Sofort abgebrochen',
      zurueckgestellt: 'Zurückgestellt',
      wiederhergestellt: 'Stand wiederhergestellt',
      'kontingent-erschoepft': 'Kontingent erschöpft — angehalten'
    },
    fertigErfolgreich: 'Der Lauf ist fertig — alle Blöcke sind durch.',
    fertigFehlgeschlagen: 'Der Lauf ist fehlgeschlagen.',
    fertigSanft: 'Der Lauf wurde sanft angehalten. Der Stand ist am letzten Sicherungspunkt.',
    fertigHart:
      'Der Lauf wurde sofort abgebrochen. Der laufende Block gilt als nicht gelaufen; angefangene Änderungen wurden auf den letzten Sicherungspunkt zurückgesetzt.',
    // Seit BAUPLAN 46 zweigbezogen: Die Folgen-Frage beendet nur ihren Zweig.
    fertigZurueckgestellt:
      'Mindestens ein Zweig wurde zurückgestellt, die übrigen liefen zu Ende. Alles bisher Gebaute bleibt bestehen — du kannst später neu starten.',
    fertigWiederhergestellt:
      'Ein Zweig wurde auf den Stand von vor dem Lauf zurückgesetzt — oder, wenn ein Block keinen Datenvertrag hatte, der ganze Projektordner. Der Liveticker sagt, welches von beiden.',
    fertigKontingent:
      'Dein Abo-Kontingent ist im Moment erschöpft. Der Lauf hat angehalten — alles bisher Gebaute bleibt bestehen. Starte den Workflow neu, sobald dein Kontingent wieder da ist.',
    okKnopf: 'Alles klar',
    schonAktiv: 'Es läuft schon ein Workflow. Bitte warte, bis er fertig ist.',
    // Eine Motor-Session pro Lauf (BAUPLAN 19): Ohne Fazit des Block-Agenten
    // gilt der Block ehrlich als fehlgeschlagen — statt ein leeres Ergebnis
    // an die Folgeblöcke weiterzureichen.
    blockOhneFazit:
      'Der Block-Agent hat kein Fazit geliefert — der Block gilt als fehlgeschlagen.',
    // Parallelität & Warteschlange (SPEC §5, BAUPLAN 12).
    schonInWarteschlange: 'Dieser Workflow steht schon in der Warteschlange.',
    wartetMarke: 'wartet',
    wartetHinweis: (position) =>
      'Der Lauf wartet in der Warteschlange' +
      (position > 1 ? ` (Platz ${position})` : '') +
      ' und startet von allein, sobald Platz ist — höchstens 3 Workflows laufen gleichzeitig, und pro Projekt nur einer.',
    warteschlangeVerlassen: 'Aus der Warteschlange nehmen',
    warteschlangeFehler: (fehler) => `Der wartende Lauf konnte nicht starten: ${fehler}`,
    folgelaufWartet:
      'Ein weiterer Lauf ist vorgemerkt und startet von allein, sobald dieser fertig ist.',
    parallelHinweis: (anzahl) =>
      `${anzahl} Workflows laufen gleichzeitig — parallele Läufe vervielfachen den Verbrauch deines Kontingents.`,
    parallelStartHinweis: (anzahl) =>
      anzahl === 1
        ? 'In einem anderen Projekt läuft gerade ein Workflow — ein weiterer Lauf vervielfacht den Verbrauch deines Kontingents.'
        : `In anderen Projekten laufen gerade ${anzahl} Workflows — ein weiterer Lauf vervielfacht den Verbrauch deines Kontingents.`,
    // Parallele Zweige (SPEC §4.1, BAUPLAN 13): sichtbarer Verbrauchs-Hinweis.
    parallelBloeckeHinweis: (anzahl) =>
      `${anzahl} Blöcke laufen jetzt gleichzeitig — parallele Blöcke vervielfachen den Verbrauch deines Kontingents.`,
    aboNichtErlaubt:
      'Diese FlowForge-Version läuft nur mit API-Schlüssel. Bitte hinterlege einen in den Einstellungen.',
    motorNichtAngemeldet:
      'Der Motor ist nicht angemeldet. Bitte melde dich einmal in der Claude-App bzw. mit „claude" an — oder hinterlege einen API-Schlüssel in den Einstellungen.',
    obergrenzeErreicht: 'Die Ausgaben-Obergrenze für diesen Lauf wurde erreicht.',
    kontingentErschoepft: 'Dein Abo-Kontingent ist im Moment aufgebraucht.',
    serverUeberlastet: 'Die KI-Server sind im Moment überlastet.',
    // Klasse Extra (0.48.1): Folgen-Frage vor dem ersten Lauf mit einem
    // Extra-Block im Abo-Modus — einmal, die Antwort „trotzdem starten" wird
    // gemerkt (Einstellung extraKostenBestaetigt). Im API-Modus entfällt sie:
    // dort zahlt ohnehin jeder Block pro Verbrauch.
    extraRueckfrage:
      'In diesem Workflow läuft mindestens ein Block auf „Extra (Fable 5)". Je nach Abo rechnet Anthropic Fable 5 über Guthaben statt über dein Kontingent ab — über den Motor ohne Nachfrage. Was das für dich bedeutet: Der Lauf kann echtes Geld kosten, auch wenn dein Kontingent reicht. Empfehlung: Starte nur, wenn du Guthaben hinterlegt hast oder dein Abo Fable 5 einschließt; sonst stelle die Blöcke auf „Standard (Opus)". Trotzdem starten? FlowForge merkt sich die Antwort und fragt nicht noch einmal.',
    extraRueckfrageKnopf: 'Trotzdem starten',
    // Fable 5 für dieses Konto nicht verfügbar (Fehlertext der CLI) — kein
    // stiller Rückfall auf Opus: Der Block bleibt stehen.
    extraNichtVerfuegbar:
      'Fable 5 ist für dein Konto nicht verfügbar (kein Guthaben oder nicht im Abo enthalten). Der Block ist stehen geblieben — stelle ihn auf „Standard (Opus)" oder lade Guthaben auf, und starte neu.',
    // Klasse lokal (BAUPLAN 49): Klartext statt stillem Rückfall. Ohne
    // eingeschaltete, erlaubte und erreichbare lokale KI startet kein Lauf
    // mit einem lokalen Block — sonst bezahlte Georg, was er lokal wollte.
    lokalNichtErlaubt:
      'In diesem Workflow läuft mindestens ein Block auf „lokal (Ollama)", aber die lokale KI ist nicht als Block-Agent freigegeben. Schalte in den Einstellungen die lokale KI ein und setze das Häkchen „als Block-Agent erlaubt" — oder stelle den Block auf eine Claude-Klasse. FlowForge fällt nie still auf Claude zurück.',
    lokalNichtErreichbar: (adresse) =>
      `Die lokale KI unter ${adresse} ist nicht erreichbar. Starte Ollama (oder prüfe die Adresse in den Einstellungen) und starte den Lauf neu — FlowForge fällt nie still auf Claude zurück.`,
    lokalModellFehlt: (modell) =>
      `Das Modell „${modell}" ist bei deiner lokalen KI nicht vorhanden. Lade es in Ollama (ollama pull ${modell}) oder trage in den Einstellungen ein vorhandenes Modell ein — FlowForge fällt nie still auf Claude zurück.`,
    lokalModellFehler: (text) =>
      `Das abgeleitete Ollama-Modell für FlowForge konnte nicht angelegt werden: ${text}. Prüfe die Feineinstellungen der lokalen KI und die Ollama-Version — FlowForge fällt nie still auf Claude zurück.`,
    // Adress-Pool (BAUPLAN 51): Wächter-Text — darf im Betrieb nie erscheinen.
    // Ein lokaler Block ohne zugeteilte Adresse bricht hart ab, statt still
    // zur ersten Adresse zu greifen (zwei Motoren auf einer GPU).
    lokalOhneZuteilung: (name) =>
      `„${name}" sollte lokal laufen, hat aber keine zugeteilte KI-Adresse — der Block bricht ab, statt sich still eine zu nehmen. Das ist ein Fehler in FlowForge selbst; starte den Lauf neu.`,
    // Ollama hat das Anlegen weder bestätigt noch einen Fehler genannt.
    lokalModellKeinErfolg: 'Ollama hat das Anlegen nicht bestätigt (keine Erfolgsmeldung)'
  },
  rechteFrage: {
    ueberschrift: 'Der Agent bittet um Erlaubnis',
    folgenHinweis:
      'Wenn du ablehnst, sucht der Agent einen anderen Weg innerhalb des Projektordners — oder beendet den Auftrag mit einer Erklärung.',
    erlauben: 'Erlauben',
    ablehnen: 'Ablehnen',
    schreibenAusserhalb: (pfad) =>
      `Der Agent möchte außerhalb des Projektordners schreiben:\n${pfad}`,
    befehl: (befehl) => `Der Agent möchte einen Kommandozeilen-Befehl ausführen:\n${befehl}`,
    // Befehle in einer Welle (BAUPLAN 46): Während parallel ein anderer Block
    // schreibt, fragt auch ein sonst rückfragefreies Entwickler-Werkzeug nach
    // — Befehle schreiben an der Dateiliste vorbei, und ein Build oder Test
    // liest zudem den Halbstand des Nachbarn. Rein lesende Befehle bleiben frei.
    befehlInWelle: (befehl) =>
      `Der Agent will ausführen: ${befehl}\n— während parallel ein anderer Block schreibt. ` +
      'Befehle schreiben an der Dateiliste vorbei und sehen den halbfertigen Stand des Nachbarn; ' +
      'deshalb fragt FlowForge in einer Welle auch bei sonst freien Entwickler-Werkzeugen nach.',
    internet: (ziel) => `Der Agent möchte aufs Internet zugreifen:\n${ziel}`,
    unbekanntesWerkzeug: (name) =>
      `Der Agent möchte ein Werkzeug nutzen, das FlowForge nicht kennt: ${name}`,
    // Karten-Vorschläge (BAUPLAN 26, gelockert 14.08.2026): rückfragefrei nur
    // im Karten-Prüfer — andere Blöcke fragen nach dem üblichen Verfahren.
    vorschlag:
      'Der Agent möchte dir einen Karten-Vorschlag machen — üblich ist das nur im Karten-Prüfer-Block. Erlaubst du es, entscheidest du den Vorschlag danach trotzdem Karte für Karte.',
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): rückfragefrei nur im
    // Sessionende — andere Blöcke fragen nach dem üblichen Verfahren.
    laufVorschlag:
      'Der Agent möchte eine Kartenauswahl für den nächsten Lauf vorschlagen — üblich ist das nur im Sessionende-Block. Erlaubst du es, bleibt es trotzdem nur ein Vorschlag, den du an der Kartenauswahl übernimmst oder verwirfst.',
    // Karten-Zuteilung (BAUPLAN 29): rückfragefrei nur in Auftragsquellen-
    // Blöcken (Paket schneiden, Diagnose) — andere fragen nach dem üblichen
    // Verfahren.
    kartenZuteilung:
      'Der Agent möchte den nachfolgenden Blöcken Karten zuteilen — üblich ist das nur in Paket schneiden und Diagnose. Erlaubst du es, bekommen die genannten Blöcke nur ihre zugeteilten Karten in den Auftrag (die Status-Karte immer).',
    // Lieferschein (BAUPLAN 42): rückfragefrei ist je Block genau das Werkzeug
    // zu seinem liefert-Etikett — ein fremdes Melde-Werkzeug fragt nach.
    lieferschein: (werkzeug) =>
      `Der Agent möchte sein Ergebnis mit „${werkzeug}" melden — dieses Melde-Werkzeug gehört ` +
      'aber nicht zu dem, was dieser Block laut Schaubild liefert. Erlaubst du es, kommt die ' +
      'Meldung trotzdem nur bei den Blöcken an, die das passende Etikett brauchen.',
    // Prüfbefehl (BAUPLAN 35): rückfragefrei nur in Prüf-Blöcken — er gehört
    // zur Prüfmappe, und FlowForge spielt ihn später ohne Rückfrage ab.
    pruefbefehl:
      'Der Agent möchte den Prüfbefehl des Projekts festlegen — den Befehl, den FlowForge in Reparatur-Runden selbst abspielt, um ohne KI nachzuprüfen. Üblich ist das nur im Prüfer. Erlaubst du es, wird der Befehl trotzdem hart geprüft: nur ein einzelnes Test-Werkzeug, keine Verkettung.',
    abgelehntFuerAgent:
      'Der Nutzer hat das nicht erlaubt. Suche einen anderen Weg innerhalb des Projektordners — oder beende den Auftrag mit einer kurzen Erklärung.',
    gitGesperrtFuerAgent:
      'Git ist in FlowForge-Projekten gesperrt: Die App verwaltet Sicherungspunkte selbst. Arbeite ohne Git weiter.',
    nurLesenGesperrtFuerAgent:
      'Dieser Block darf nur lesen. Schreiben, verändernde Befehle und Internet sind hier gesperrt. Beende den Auftrag nur mit Lese-Werkzeugen.',
    // Verfeinerte Lese-Sperre (Feedback Georg, 12.08.2026): rein lesende
    // Befehle laufen durch — für alles andere sagt die Meldung ehrlich, warum.
    nurLesenBefehlFuerAgent:
      'Dieser Block darf nur lesen. Rein lesende Befehle (z.B. dir, ls, type, cat, findstr, grep, where, echo, pwd, head, tail, wc — auch die PowerShell-Gegenstücke wie Get-ChildItem, Get-Content, Select-String) laufen durch — dieser Befehl gehört nicht dazu, auch Ausführen von Programmen oder Tests zählt nicht als Lesen. Nutze die Lese-Werkzeuge oder einen rein lesenden Befehl.',
    // Prüfmappen-Sperre (Feedback Georg, 12.08.2026): die Testdateien im
    // Prüfordner gehören dem Prüfer — kein anderer Block ändert sie.
    pruefmappeGesperrtFuerAgent:
      'Der Prüfordner „pruefung" gehört den Prüf-Blöcken: Nur sie dürfen dort Dateien anlegen oder ändern. Lass die Prüfmappe unverändert — wenn eine Prüfung deiner Meinung nach falsch ist, schreibe das ins Feld anmerkung deiner Ergebnis-Meldung.',
    // Prüfordner je Prüf-Instanz (BAUPLAN 41): Auch ein Prüf-Block schreibt nur
    // in seinen eigenen Unterordner — sonst archiviert er fremde Tests.
    fremderPruefordnerFuerAgent: (ordner) =>
      `In der Prüfmappe gehört dir nur dein eigener Ordner: pruefung/${ordner}/ — dort legst du alle deine Prüfungen ab (und lässt deinen Prüfbefehl genau darauf zeigen). Andere Stellen unter pruefung/ gehören anderen Prüf-Blöcken und sind gesperrt.`,
    // Datenvertrag als Schreibsperre (BAUPLAN 44): Was nicht in der Dateiliste
    // des eigenen Arbeitspakets steht, wird hart abgelehnt — keine Rückfrage,
    // denn im Automodus wäre sie wirkungslos. Der Text sagt dem Agenten, was er
    // STATTDESSEN tun soll, statt ihn im Kreis probieren zu lassen.
    ausserhalbDateilisteFuerAgent: (datei, liste) =>
      `„${datei}" steht nicht in der Dateiliste deines Arbeitspakets. Anfassen darfst du nur: ` +
      `${liste.join(', ')} (dazu deinen Ordner arbeitsablage/ für Wegwerf-Hilfen). Braucht dein ` +
      'Paket wirklich eine weitere Datei, schreibe das ins Feld anmerkung deiner Ergebnis-Meldung ' +
      '— dann schneidet der nächste Lauf das Paket richtig. Baue den Rest fertig, statt es erneut ' +
      'zu versuchen.',
    // Bilder-Verbot in der Prüfmappe (BAUPLAN 17): hartes Nein, auch für Prüf-Blöcke.
    pruefmappeBildFuerAgent:
      'Bilddateien sind im Prüfordner „pruefung" verboten (hartes Nein, auch für Prüf-Blöcke): Prüfungen sind kleine Textdateien und Skripte. Prüfe ohne Bildvergleiche — die blockieren künftige, völlig erlaubte Änderungen.',
    verwaltungGesperrtFuerAgent:
      'Diese Datei verwaltet FlowForge selbst — sie ist für direkte Änderungen gesperrt. Karten liest und schreibst du über die karten-Werkzeuge.',
    // Häkchen je Block (BAUPLAN 20): abgewählt = echte Sperre, kein Hinweis.
    lokaleKiGesperrtFuerAgent:
      'Die lokale Helfer-KI ist für diesen Block abgeschaltet (Häkchen an der Block-Karte). Nutze für Unteraufgaben das Agent-Werkzeug.',
    // Co-Pilot (BAUPLAN 33): App bedienen im nur-lesenden Chat fragt nach;
    // einen fremden Port-Besitzer beenden fragt immer.
    appBedienen:
      'Der Chat möchte deine App starten oder stoppen (über den App-Tab). Im nur-lesenden Chat fragt er dafür — mit „Chat darf reparieren" ginge es ohne Rückfrage.',
    appPortFreimachen:
      'Der Chat möchte einen fremden Prozess beenden, der den Port deiner App belegt, und die App dann starten. Das geht sofort und ohne Rückfrage an das Programm.',
    // Übersichts-Chat: Datenordner und alles außer Lesen gesperrt.
    datenordnerGesperrtFuerAgent:
      'FlowForges Datenordner ist für dich gesperrt (dort liegen Einstellungen und Schlüssel). Ohne offenes Projekt liest du nur die Produktbeschreibung über ihren absoluten Pfad.',
    uebersichtGesperrtFuerAgent:
      'Ohne offenes Projekt beantwortest du nur Bedienfragen zu FlowForge — Befehle, Schreiben und Projektzugriffe sind hier gesperrt. Bitte den Nutzer, das Projekt zu öffnen, wenn es um sein Projekt geht.',
    // Seit Bauschritt 46 schreiben mehrere Blöcke gleichzeitig — die Regel für
    // den Chat lautet deshalb nicht mehr „ein Schreiber pro Projekt", sondern:
    // Der Chat schreibt nicht, solange ein Lauf läuft (er hat keine Dateiliste
    // und keinen Strang, wäre also ein Schreiber ohne Wirkbereich).
    chatWaehrendLaufFuerAgent:
      'Im Projekt läuft gerade ein Workflow-Lauf — der Chat schreibt nicht, solange ein Lauf läuft, und ist so lange hart nur-lesend. Beantworte die Frage aus dem, was du lesen kannst; Änderungen gehen erst nach dem Lauf.'
  },
  ticker: {
    // Eine Motor-Session pro Lauf (BAUPLAN 19): Der Motor startet einmal,
    // die Blöcke laufen darin als frische Agenten.
    laufSessionGestartet: (modell) =>
      `Motor gestartet (${modell}) — eine Lauf-Session für den ganzen Lauf; jeder Block läuft darin als eigener Agent.`,
    laufSessionFortgesetzt: 'Lauf-Session fortgesetzt statt neu gestartet.',
    // Lokal (BAUPLAN 49): eigene Instanz gegen Ollama, Denktiefe gilt nicht.
    blockAgentGestartetLokal: (name, modellName) =>
      `„${name}" läuft als frischer Agent in seiner eigenen lokalen Session — Modell: ${modellName}.`,
    blockAgentGestartet: (name, modellName, denktiefeName = '') =>
      `„${name}" läuft als frischer Agent in der Lauf-Session` +
      (modellName
        ? ` — Modell: ${modellName}` + (denktiefeName ? `, Denktiefe: ${denktiefeName}` : '') + '.'
        : '.'),
    // Denktiefe (0.48.1): beim ersten Werkzeugaufruf des Block-Agenten meldet
    // die CLI die wirksame Stufe (Hook effort.level) — nachweisbar, nicht nur
    // gewünscht. Kennt das Modell keine Denktiefe (Haiku), sagt der Ticker es.
    denktiefeGemessen: (stufe) => `Denktiefe wirksam: ${stufe} (vom Motor gemeldet).`,
    denktiefeNichtUnterstuetzt: (modellName) =>
      `${modellName || 'Dieses Modell'} kennt keine Denktiefe — die Wahl an der Karte wird ignoriert.`,
    // Inhaltsfilter-Rückfall (0.48.1): Lehnt das Modell eine Antwort ab
    // (Kategorie Cyber/Biologie …), wiederholt die CLI sie auf einem
    // Rückfall-Modell — der Wechsel wird genannt, nie still hingenommen.
    modellRueckfall: (von, nach, kategorie) =>
      `Inhaltsfilter: „${von}" hat eine Antwort abgelehnt${kategorie ? ` (Kategorie ${kategorie})` : ''} — der Motor hat sie auf „${nach}" wiederholt.`,
    unteraufgabenSparsam: (modellName) =>
      `Unteraufgaben der Block-Agenten (Späher, Einlese-Helfer) laufen ${modellName}.`,
    // Zusatz, wenn ein lokaler Block mitläuft (BAUPLAN 49): in dessen Instanz
    // gibt es kein Sonnet — seine Unteraufgaben erben das Ollama-Modell.
    unteraufgabenLokalZusatz:
      'Lokale Blöcke: ihre Unteraufgaben laufen auf dem lokalen Modell.',
    koordinatorGestoppt:
      'Werkzeug-Versuch des Koordinators gestoppt — Arbeit erledigen nur die Block-Agenten.',
    parallelEigeneSession: (name) =>
      `„${name}" läuft parallel in einer eigenen Session — die Lauf-Session ist gerade beschäftigt.`,
    // Klasse lokal (BAUPLAN 49): Block-Agent auf Georgs lokaler KI (Ollama im
    // Anthropic-Modus) — immer in einer eigenen Motor-Instanz, Kosten 0.
    // Adress-Pool (BAUPLAN 51): bei mehreren bereiten Adressen steht die
    // Anzahl dabei — bei einer bleibt die Zeile wortgleich wie bisher.
    lokalBereit: (modell, kontext = null, adressen = 1) =>
      `Lokale KI als Block-Agent bereit (${modell}${kontext ? ', Kontext ' + Math.round(kontext / 1024) + 'k' : ''}${adressen > 1 ? ', ' + adressen + ' Adressen' : ''}) — Blöcke der Klasse „lokal" kosten kein Kontingent.`,
    // Adress-Pool (BAUPLAN 51): Eine nicht bereite Adresse wird für diesen
    // Lauf ausgeklammert — sichtbar mit Grund, nie still.
    lokalAdresseAusgeklammert: (adresse, grund) =>
      `Lokale KI-Adresse ${adresse} ist für diesen Lauf ausgeklammert: ${grund} ` +
      `Der Lauf läuft ohne diese Adresse weiter — prüfe sie in den Einstellungen.`,
    lokalGrundNichtErreichbar: 'Sie ist gerade nicht erreichbar.',
    lokalGrundModellFehlt: (modell) => `Das Basis-Modell „${modell}" fehlt dort.`,
    lokalSessionGestartet: (modell, kontext = null) =>
      `Motor gestartet gegen deine lokale KI (${modell}${kontext ? ', Kontext ' + Math.round(kontext / 1024) + 'k' : ''}) — kostet kein Kontingent; Kosten und Fenster meldet hier FlowForge, nicht die CLI.`,
    lokalEigeneSession: (blockName, modell) =>
      `„${blockName}" läuft lokal (${modell}) in einer eigenen Session — nie in der Claude-Lauf-Session.`,
    // Eine GPU je Ollama-Adresse (BAUPLAN 49/51): je Adresse des Pools läuft
    // ein lokaler Block zur Zeit. Bei einer Adresse der vertraute Wortlaut;
    // bei mehreren nennt die Zeile die ehrliche Adress-Anzahl statt einer
    // festen Grafikkarten-Behauptung (eine Adresse muss keine eigene Karte
    // sein). `anderer` trägt bei mehreren Haltern alle Namen, bereits mit
    // '", „' verbunden (warteGrundMelden).
    warteGrundLokal: (name, anderer = '', anzahl = 1) =>
      anzahl > 1
        ? `„${name}" wartet — alle ${anzahl} lokalen KI-Adressen sind belegt (durch „${anderer}").`
        : `„${name}" wartet, bis ${anderer ? `„${anderer}"` : 'der andere lokale Block'} fertig ist — die lokale KI bearbeitet einen Block zur Zeit.`,
    // Lokale Helfer-KI (Experiment): sichtbar, wenn die lokale KI recherchiert.
    lokaleHelferBereit: (modell, kontext = null) =>
      `Lokale Helfer-KI bereit (${modell}${kontext ? ', Kontext ' + Math.round(kontext / 1024) + 'k' : ''}) — Recherche-Aufträge kosten kein Kontingent.`,
    lokaleHelferNichtErreichbar:
      'Lokale Helfer-KI ist eingeschaltet, aber Ollama ist nicht erreichbar (oder das Modell fehlt) — Unteraufgaben laufen normal über den Motor.',
    lokaleHelferStart: (modell) => `Lokale KI recherchiert (${modell}) …`,
    // Detail-Zeilen je Schritt (BAUPLAN 23): der Ticker nennt das Ziel —
    // welche Datei (samt Startzeile), welches Suchmuster, welcher Ordner.
    // Die Eingaben kommen vom kleinen Modell und können fehlen oder wuchern:
    // defensiv lesen und kürzen.
    lokaleHelferSchritt: (werkzeug, eingabe) => {
      const kurz = (wert, max) => {
        const einzeilig = String(wert ?? '').replace(/\s+/g, ' ').trim()
        return einzeilig.length > max ? einzeilig.slice(0, max) + '…' : einzeilig
      }
      if (werkzeug === 'aufruf_uebersetzt')
        return 'Lokale KI · Werkzeugaufruf kam als Text getarnt — FlowForge hat ihn übersetzt und führt ihn aus.'
      if (werkzeug === 'datei_lesen') {
        const pfad = kurz(eingabe?.pfad, 80)
        if (!pfad) return 'Lokale KI · liest eine Datei.'
        const von = Number(eingabe?.vonZeile)
        return von > 1
          ? `Lokale KI · liest ${pfad} ab Zeile ${von}.`
          : `Lokale KI · liest ${pfad}.`
      }
      if (werkzeug === 'suchen') {
        const muster = kurz(eingabe?.muster, 60)
        return muster
          ? `Lokale KI · durchsucht das Projekt nach „${muster}".`
          : 'Lokale KI · durchsucht das Projekt.'
      }
      if (werkzeug === 'ordner_auflisten') {
        const pfad = kurz(eingabe?.pfad, 80)
        return pfad && pfad !== '.'
          ? `Lokale KI · sieht sich ${pfad} an.`
          : 'Lokale KI · sieht sich den Projektordner an.'
      }
      return `Lokale KI · nutzt Werkzeug ${kurz(werkzeug, 40) || '?'}.`
    },
    lokaleHelferFertig: (schritte) =>
      `Lokale KI fertig — Fazit nach ${schritte} ${schritte === 1 ? 'Schritt' : 'Schritten'}.`,
    // Trefferquote (BAUPLAN 23): sichtbar, ob der Agent das Fazit wirklich
    // berücksichtigt hat — samt seiner Begründung.
    rechercheUebernommen: (begruendung) =>
      `Agent übernimmt das Fazit der lokalen KI${begruendung ? ': ' + begruendung : '.'}`,
    rechercheVerworfen: (begruendung) =>
      `Agent verwirft das Fazit der lokalen KI${begruendung ? ': ' + begruendung : '.'}`,
    lokaleHelferGescheitert: (fehler) => `Lokale KI gescheitert: ${fehler}`,
    lokaleKiGesperrt:
      'lokal_recherchieren gestoppt — die lokale KI ist für diesen Block abgeschaltet.',
    // Lokale Entwürfe (BAUPLAN 21): sichtbar, wenn die lokale KI entwirft —
    // und was aus dem Entwurf wurde (Abnahme durch den Block-Agenten).
    lokaleEntwurfStart: (modell) => `Lokale KI entwirft (${modell}) …`,
    lokaleEntwurfSchritt: (pfad) =>
      pfad ? `Lokale KI · schreibt Entwurf ${pfad}.` : 'Lokale KI · schreibt einen Entwurf.',
    lokaleEntwurfFertig: (dateien, schritte) =>
      `Lokale KI fertig — ${dateien.length === 1 ? 'ein Entwurf' : dateien.length + ' Entwürfe'} in der Arbeitsablage ` +
      `(${schritte} ${schritte === 1 ? 'Schritt' : 'Schritte'}). Der Agent liest gegen.`,
    lokaleEntwurfKeineDatei:
      'Lokale KI hat keinen Entwurf geschrieben — der Agent schreibt selbst.',
    lokaleEntwurfGescheitert: (fehler) => `Lokaler Entwurf gescheitert: ${fehler}`,
    entwurfUebernommen: (entwurf) => `Entwurf übernommen: ${entwurf}.`,
    entwurfVerworfen: (entwurf) => `Entwurf verworfen: ${entwurf} — der Agent schreibt selbst.`,
    // Lokaler Bauer (BAUPLAN 22): jedes Teilstück ehrlich im Ticker —
    // Zerlegen, Bauen, Abnahme und Rückrollen sind sichtbar.
    lokaleBauenStart: (teilstueck, modell) =>
      `Lokale KI baut Teilstück „${teilstueck}" (${modell}) — Sicherungspunkt liegt an.`,
    lokaleBauenSchritt: (pfad) =>
      pfad ? `Lokale KI · schreibt ${pfad}.` : 'Lokale KI · schreibt eine Datei.',
    lokaleBauenFertig: (aenderungen, schritte) =>
      `Lokale KI fertig — ${aenderungen} ${aenderungen === 1 ? 'Änderung' : 'Änderungen'} im Projekt ` +
      `(${schritte} ${schritte === 1 ? 'Schritt' : 'Schritte'}). Der Agent liest gegen.`,
    lokaleBauenNichtsGebaut:
      'Lokale KI hat nichts gebaut — der Agent baut dieses Teilstück selbst.',
    lokaleBauenGescheitert: (fehler) => `Lokales Bauen gescheitert: ${fehler}`,
    lokaleBauenZurueckgerollt:
      'Halbfertige Änderungen des gescheiterten Bau-Versuchs zurückgerollt — der Stand ist wieder sauber.',
    teilstueckGehalten: (teilstueck) =>
      `Teilstück „${teilstueck}" gehalten — Abnahme bestanden.`,
    teilstueckVerworfen: (teilstueck) =>
      `Teilstück „${teilstueck}" nicht gehalten — Stand zurückgerollt, der Agent baut selbst.`,
    // Lokale Vorreparatur (BAUPLAN 20): jeder Versuch ehrlich im Ticker.
    // Übersprungen bei einem Prüfer der Klasse „lokal" (0.51.1): dasselbe
    // Modell auf derselben GPU repariert nicht, was es eben nicht geprüft
    // bekommen hat — und es stritte mit dem nächsten lokalen Block um die
    // Adresse. Der Grund steht im Ticker, sonst hielte Georg das Ausbleiben
    // der Vorreparatur für einen Fehler.
    lokaleVorreparaturUebersprungen: (prueferName) =>
      `Lokale Vorreparatur übersprungen — „${prueferName}" lief selbst auf der lokalen KI. ` +
      'Die Reparatur geht direkt an den Motor-Bauer.',
    lokaleReparaturNichtMechanisch: (zielName) =>
      `Keine rein mechanischen Beanstandungen — die Reparatur geht direkt an „${zielName}" (Motor).`,
    lokaleReparaturStart: (versuch, max, modell) =>
      `Lokale Reparatur, Versuch ${versuch} von ${max} (${modell}) — Sicherungspunkt liegt an.`,
    lokaleReparaturSchritt: (pfad) =>
      pfad ? `Lokale KI · ersetzt gezielt in ${pfad}.` : 'Lokale KI · ersetzt gezielt eine Stelle.',
    lokaleReparaturFertig: (ersetzungen) =>
      `Lokale Reparatur fertig — ${ersetzungen} ${ersetzungen === 1 ? 'Stelle' : 'Stellen'} ersetzt. Der Prüfer prüft nach.`,
    lokaleReparaturNichtsErsetzt:
      'Lokale Reparatur ohne Ergebnis — nichts ersetzt, der Versuch zählt trotzdem.',
    lokaleReparaturGescheitert: (fehler) => `Lokale Reparatur gescheitert: ${fehler}`,
    lokaleReparaturZurueckgerollt: (versuch, max) =>
      `Nachprüfung nicht bestanden — der Stand wurde auf den Punkt vor der lokalen Reparatur zurückgerollt (Versuch ${versuch} von ${max}).`,
    lokaleReparaturGehalten:
      'Nachprüfung bestanden — die lokale Reparatur hat gehalten, keine Motor-Reparatur nötig.',
    lokaleReparaturOpusUebernimmt: (zielName) =>
      `Die lokale Reparatur hat nicht gereicht — jetzt übernimmt „${zielName}" über den Motor.`,
    schreibtDatei: (pfad) => `Schreibt Datei: ${pfad}`,
    aendertDatei: (pfad) => `Ändert Datei: ${pfad}`,
    liestDatei: (pfad) => `Liest: ${pfad}`,
    durchsucht: 'Durchsucht das Projekt.',
    plant: 'Plant die Arbeitsschritte.',
    unteraufgabe: 'Startet eine Unteraufgabe.',
    // Ziel der Unteraufgabe sichtbar (BAUPLAN 25) — z.B. die drei
    // Blickwinkel-Prüfer des Audits.
    unteraufgabeMitZiel: (ziel) => `Startet Unteraufgabe: ${ziel}`,
    // Zeilen aus Unteraufgaben (BAUPLAN 17): der Wegwerf-Helfer wühlt in
    // seinem eigenen Kontext — im Ticker klar gekennzeichnet.
    unteraufgabeZeile: (text) => `Unteraufgabe · ${text}`,
    befehl: (befehl) => `Kommandozeile: ${befehl}`,
    internet: (ziel) => `Internetzugriff: ${ziel}`,
    werkzeug: (name) => `Nutzt Werkzeug: ${name}`,
    rechteFrageGestellt: 'Rechte-Rückfrage an dich — bitte oben beantworten.',
    rechteAutomatischErlaubt: (beschreibung) => `Automodus — automatisch erlaubt: ${beschreibung}`,
    rechteFrageErlaubt: 'Du hast es erlaubt.',
    rechteFrageAbgelehnt: 'Du hast es abgelehnt.',
    sanftAngefordert: 'Sanftes Anhalten angefordert — der laufende Block macht fertig.',
    hartAbgebrochen: 'Sofort abgebrochen.',
    gitGesperrt: 'Git-Befehl gesperrt — Sicherungspunkte übernimmt FlowForge.',
    nurLesenGesperrt: 'Schreib-Versuch gestoppt — dieser Block darf nur lesen.',
    nurLesenBefehlGesperrt:
      'Befehl gestoppt — dieser Block darf nur lesen (rein lesende Befehle laufen durch).',
    nurLesenBefehleAktiv:
      'Einstellung aktiv: Nur-lesende Blöcke dürfen Befehle ausführen (auf eigene Gefahr).',
    pruefmappeGesperrt:
      'Änderung an der Prüfmappe gestoppt — die Prüfdateien gehören dem Prüfer.',
    pruefmappeBildGesperrt:
      'Bilddatei in der Prüfmappe gestoppt — Bilder sind dort verboten, auch für den Prüfer.',
    // Prüfordner je Prüfer (BAUPLAN 41).
    fremderPruefordnerGesperrt:
      'Schreiben außerhalb des eigenen Prüfordners gestoppt — jeder Prüfer hat seinen eigenen.',
    // Datenvertrag als Schreibsperre (BAUPLAN 44): in Alltagssprache, damit
    // Georg im Ticker sieht, was passiert ist — und woran es lag.
    ausserhalbDateilisteGesperrt: (datei) =>
      `Schreiben an „${datei}" gestoppt — die Datei steht nicht in der Dateiliste des ` +
      'Arbeitspakets dieses Blocks.',
    // Einmal je Block: Ab hier gilt die Sperre. Bekommt ein Block mehrere
    // Arbeitspakete, gilt die Vereinigung ihrer Listen — die Zahl sagt es.
    dateilisteAktiv: (bezeichnung, anzahl) =>
      `Datenvertrag aktiv für ${bezeichnung}: ${anzahl} erlaubte Datei${anzahl === 1 ? '' : 'en'} ` +
      '— Schreibversuche daneben werden gestoppt (arbeitsablage/ bleibt frei).',
    // Lauf-Mappe statt Projekt-Mappe (BAUPLAN 17).
    pruefmappeGeleert:
      'Prüfmappe geleert — der Prüfer baut seine Prüfungen frisch fürs aktuelle Paket.',
    // Prüfkarten (BAUPLAN 18).
    pruefkartenEingelegt: (n) =>
      n === 1
        ? 'Eine Prüfkarte liegt am Prüfer — ihre aufbewahrten Prüfungen sind wieder in der Prüfmappe.'
        : `${n} Prüfkarten liegen an Prüfern — ihre aufbewahrten Prüfungen sind wieder in der Prüfmappe.`,
    pruefkarteAngelegt: (titel) => `Prüfung bestanden und aufbewahrt — neue Prüfkarte: „${titel}"`,
    arbeitsablageGeleert: 'Arbeitsablage geleert.',
    // Prozess-Hygiene (BAUPLAN 32): am Lauf-Ende ehrlich vermerkt.
    verwaisteBeendet: (n, namen = []) => {
      const liste = [...new Set(namen.filter(Boolean))].slice(0, 4).join(', ')
      return (
        (n === 1 ? '1 verwaister Prozess' : `${n} verwaiste Prozesse`) +
        ` aus dem Lauf beendet${liste ? ` (${liste})` : ''}.`
      )
    },
    verwaisteUebrig: (n) =>
      `${n} ${n === 1 ? 'Prozess aus dem Lauf ließ' : 'Prozesse aus dem Lauf ließen'} sich nicht beenden — siehe App-Tab, Liste „noch laufende Prozesse".`,
    verwaltungGesperrt: 'Schreib-Versuch auf eine FlowForge-Verwaltungsdatei gestoppt.',
    liestKarten: 'Liest die Projektkarten.',
    karteAngelegt: (titel) => `Karte angelegt: „${titel}"`,
    karteAktualisiert: (titel) => `Karte aktualisiert: „${titel}"`,
    aufgabeErledigt: (titel) => `Aufgabe abgehakt: „${titel}"`,
    aufgabeGeoeffnet: (titel) => `Aufgabe wieder geöffnet: „${titel}"`,
    karteAbgelehnt: (grund) => `Karten-Änderung abgelehnt: ${grund}`,
    startanleitungGesetzt: 'Startanleitung festgelegt — „App starten" ist bereit.',
    startanleitungAbgelehnt: (grund) => `Startanleitung abgelehnt: ${grund}`,
    // Startanleitung in der Welle (0.46.2): Sie ist eine Projektdatei, kein
    // Teil des Datenvertrags — überschreibt ein Block die Anleitung eines
    // anderen, der gerade Revier belegt, sagt der Ticker es mit beiden Befehlen.
    startanleitungErsetzt: (wer, wen, alt, neu) =>
      `„${wer}" hat die Startanleitung von „${wen}" ersetzt: „${alt}" → „${neu}"`,
    startanleitungNachgefordert: (block) =>
      `Die Startanleitung fehlt — „${block}" bekommt eine Nachbesserungs-Runde.`,
    startanleitungWeiterOhne:
      'Die Startanleitung fehlt weiterhin — der Lauf macht weiter, „App starten" bleibt aus.',
    // Tor ohne KI (BAUPLAN 35): Prüfbefehl, Rauchtest und Baseline laufen ohne
    // Motor — jede Zeile hier steht für gesparte Tokens und ist deshalb
    // sichtbar im Ticker und damit im Laufbericht.
    pruefbefehlGesetzt: (befehl) =>
      `Prüfbefehl festgelegt: ${befehl} — FlowForge kann jetzt ohne KI nachprüfen.`,
    pruefbefehlAbgelehnt: (grund) => `Prüfbefehl abgelehnt: ${grund}`,
    pruefbefehlNachgefordert: (block) =>
      `Der Prüfbefehl fehlt — „${block}" bekommt eine Nachbesserungs-Runde (er prüft nichts neu).`,
    pruefbefehlWeiterOhne:
      'Der Prüfbefehl fehlt weiterhin — Reparatur-Runden brauchen wieder einen Prüfer-Agenten.',
    // Je Prüf-Instanz ein eigener Prüfbefehl (BAUPLAN 41) — der Ticker sagt,
    // wessen Befehl gerade läuft.
    torSpielt: (block, befehl) =>
      `Prüfbefehl von „${block}" wird abgespielt (ohne KI, 0 Tokens): ${befehl}`,
    torRot: (anzahl) =>
      `Prüfbefehl abgespielt: rot (${anzahl} ${anzahl === 1 ? 'Fehlerzeile' : 'Fehlerzeilen'}) — zurück zum Bauer ohne Prüfer-Agent.`,
    torRotZeitlimit:
      'Prüfbefehl abgespielt: rot (Zeitlimit überschritten) — zurück zum Bauer ohne Prüfer-Agent.',
    torGruen:
      'Prüfbefehl abgespielt: grün — der Prüfer prüft nur noch die grundsätzlichen Beanstandungen.',
    torAltlasten: (anzahl) =>
      `Prüfbefehl abgespielt: rot, aber nur mit ${anzahl === 1 ? 'dem Fehlschlag' : `den ${anzahl} Fehlschlägen`}, ${anzahl === 1 ? 'der' : 'die'} schon vor dem Lauf da ${anzahl === 1 ? 'war' : 'waren'} — das zählt nicht als neuer Fehlschlag.`,
    baselineSpielt: (befehl) => `Stand vor dem Lauf wird gemessen (ohne KI): ${befehl}`,
    baselineGruen: 'Stand vor dem Lauf: alle aufbewahrten Prüfungen grün.',
    baselineRot: (anzahl) =>
      `Stand vor dem Lauf: schon rot (${anzahl} ${anzahl === 1 ? 'Fehlerzeile' : 'Fehlerzeilen'}) — das sind Altlasten, keine Fehlschläge dieses Laufs.`,
    baselineAltlastKarte: (titel) => `Altlast als Aufgaben-Karte abgelegt: „${titel}"`,
    rauchtestGruen: 'Rauchtest der Startanleitung: die App läuft an.',
    rauchtestUebersprungen:
      'Rauchtest übersprungen: Die App läuft gerade im App-Tab — FlowForge nimmt ihr den Port nicht weg.',
    // Rauchtest ehrlich (0.46.2): Der Grund steht im Ticker — Fehlercode plus
    // letzte Ausgabezeile bei Rot, sonst warum nichts geprüft wurde.
    rauchtestRotGrund: (code, zeile, block) =>
      `Rauchtest: rot (${code == null ? 'ohne Fehlercode' : 'Code ' + code})${zeile ? ' — ' + zeile : ''} — „${block}" bekommt eine Nachbesserungs-Runde, bevor der Prüfer etwas kostet.`,
    rauchtestWeiterOhneGrund: (code, zeile) =>
      `Rauchtest: weiterhin rot (${code == null ? 'ohne Fehlercode' : 'Code ' + code})${zeile ? ' — ' + zeile : ''} — der Lauf macht ehrlich vermerkt weiter.`,
    rauchtestKeineAnleitung: 'Rauchtest übersprungen: keine Startanleitung vorhanden — kein Urteil.',
    rauchtestNichtsZuStarten:
      'Rauchtest übersprungen: Die Startanleitung hat weder Befehl noch Datei-Adresse — nichts zu starten, kein Urteil.',
    rauchtestAbgebrochen: 'Rauchtest abgebrochen: Der Lauf wurde gestoppt — kein Urteil über die App.',
    rauchtestPortFremd: (port, besitzer, vermutlich) =>
      `Rauchtest übersprungen: Port ${port} ist von ${besitzer.name || 'einem Prozess'} (PID ${besitzer.pid}${besitzer.befehl ? ', „' + besitzer.befehl.slice(0, 120) + '"' : ''}) belegt, der ${vermutlich ? 'nur vermutlich' : 'nicht'} zu diesem Lauf gehört — kein Urteil.`,
    rauchtestPortFlowForge: (port) =>
      `Rauchtest übersprungen: Port ${port} ist von FlowForge selbst belegt — kein Urteil.`,
    rauchtestWaiseBeendet: (p, port) =>
      `Waisenprozess ${p.name || 'PID ' + p.pid} (PID ${p.pid}${p.befehl ? ', „' + p.befehl.slice(0, 120) + '"' : ''}) aus diesem Lauf beendet — Port ${port} war belegt.`,
    // Rauchtest einmal je Welle (0.46.2): Wer die Runde bekommt, wenn niemand
    // in der Welle die Startanleitung gesetzt hat.
    rauchtestRueckfall: (block) =>
      `Niemand in dieser Welle hat die Startanleitung gesetzt — die Nachbesserung geht an „${block}" (zuletzt fertig geworden).`,
    sicherungspunktAngelegt: 'Sicherungspunkt angelegt.',
    zurueckgesetzt: 'Projektordner auf den letzten Sicherungspunkt zurückgesetzt.',
    // Sicherungspunkte je Schreiber (BAUPLAN 45). „Strang" ist ein Fachwort —
    // für Georg heißt es „eigener Sicherungsstrang für diesen Block".
    strangGeoeffnet: (bezeichnung) =>
      `Eigener Sicherungsstrang für ${bezeichnung} — Zurückrollen und Änderungs-Überblick ` +
      'gelten ab jetzt nur für seine Dateien.',
    // Ehrlich, wo die Trennung NICHT gilt: Ohne Arbeitspaket mit Dateiliste hat
    // FlowForge keinen Anhalt, welche Dateien diesem Block gehören.
    strangOhneWirkbereich: (bezeichnung) =>
      `${bezeichnung} bekommt KEINEN eigenen Sicherungsstrang — ohne Arbeitspaket mit ` +
      'Dateiliste weiß FlowForge nicht, welche Dateien ihm gehören. Zurückrollen gilt für ' +
      'ihn wie bisher für den ganzen Projektordner.',
    // Und ehrlich, wo die Trennung an der Technik scheitert: Ohne diese Zeile
    // liefe der Block klammheimlich ohne Trennung — genau die Annahme, die
    // strangOhneWirkbereich verhindern soll.
    strangNichtGeoeffnet: (bezeichnung) =>
      `Der eigene Sicherungsstrang für ${bezeichnung} ließ sich NICHT anlegen — der Block ` +
      'läuft ohne Trennung weiter. Zurückrollen fasst für ihn wie bisher den ganzen ' +
      'Projektordner, und sein Änderungs-Überblick ist ungefiltert.',
    strangZusammengefuehrt: (bezeichnung) =>
      `Der eigene Sicherungsstrang von ${bezeichnung} ist wieder mit dem gemeinsamen ` +
      'Stand zusammengeführt — sein Sicherungspunkt steht in der Liste.',
    strangNichtZusammengefuehrt: (bezeichnung) =>
      `Der eigene Sicherungsstrang von ${bezeichnung} ließ sich NICHT mit dem gemeinsamen ` +
      'Stand zusammenführen — sein Sicherungspunkt fehlt deshalb noch in der Liste. ' +
      'FlowForge versucht es am Ende des Laufs erneut.',
    straengeAufgeraeumt: (anzahl) =>
      anzahl === 1
        ? 'Ein liegengebliebener Sicherungsstrang aus einem früheren Abbruch wurde entfernt.'
        : `${anzahl} liegengebliebene Sicherungsstränge aus einem früheren Abbruch wurden entfernt.`,
    // Aufgeräumt wird nur, was der gemeinsame Stand ohnehin schon kennt. Hält
    // ein Strang Arbeit fest, die nie zusammengeführt wurde, holt der Laufstart
    // sie ein — erst danach steht sie als Sicherungspunkt in der Liste.
    straengeGerettet: (anzahl) =>
      anzahl === 1
        ? 'Ein Sicherungsstrang aus einem früheren Abbruch hielt noch Arbeit fest, die nie beim ' +
          'gemeinsamen Stand angekommen war — sie ist jetzt eingeholt und steht als ' +
          'Sicherungspunkt in der Liste.'
        : `${anzahl} Sicherungsstränge aus einem früheren Abbruch hielten noch Arbeit fest, die ` +
          'nie beim gemeinsamen Stand angekommen war — sie ist jetzt eingeholt und steht als ' +
          'Sicherungspunkte in der Liste.',
    // Stehen bleibt nur noch, wo auch das Einholen geklemmt hat. Kein
    // Versprechen mehr, das der nächste Lauf bricht: Es bleibt liegen, in der
    // Liste steht es nicht — genau so wird es gesagt.
    straengeBehalten: (anzahl) =>
      anzahl === 1
        ? 'Ein Sicherungsstrang aus einem früheren Abbruch hält Arbeit fest, die nie beim ' +
          'gemeinsamen Stand angekommen ist — sie ließ sich auch jetzt nicht einholen. Er ' +
          'bleibt unangetastet liegen, steht aber nicht in der Liste der Sicherungspunkte; ' +
          'FlowForge versucht es beim nächsten Start erneut.'
        : `${anzahl} Sicherungsstränge aus einem früheren Abbruch halten Arbeit fest, die nie ` +
          'beim gemeinsamen Stand angekommen ist — sie ließ sich auch jetzt nicht einholen. Sie ' +
          'bleiben unangetastet liegen, stehen aber nicht in der Liste der Sicherungspunkte; ' +
          'FlowForge versucht es beim nächsten Start erneut.',
    straengeNichtAufgeraeumt:
      'Die Sicherungsstränge aus früheren Abbrüchen ließen sich nicht aufräumen — der Lauf ' +
      'läuft normal weiter, FlowForge versucht es beim nächsten Start erneut.',
    // Auch der Rückbezug wird mitgebeugt: „1 Änderung blieb … sie liegen" war
    // im Ticker einer echten Messung zu lesen — und genau eine fremde Änderung
    // ist der Regelfall, sobald ein einziger fremder Prüfer im Lauf steht.
    rollbackGeschuetzt: (anzahl) =>
      `${anzahl} ${anzahl === 1 ? 'Änderung blieb' : 'Änderungen blieben'} beim Zurückrollen ` +
      `unberührt — ${anzahl === 1 ? 'sie liegt' : 'sie liegen'} im Arbeitsbereich anderer ` +
      'Blöcke (deren Prüfmappe oder Dateiliste).',
    rollbackGescheitert:
      'Das Zurückrollen hat NICHT geklappt — der Projektordner steht noch auf dem verworfenen ' +
      'Stand. Der Agent hat den Hinweis bekommen und baut nicht blind darauf weiter.',
    // Der stille Gegenfall zum Erfolgs-Satz: Es sollte zurückgerollt werden, es
    // war aber nichts zurückzunehmen. Gemessen, bevor diese Zeile dazukam: Der
    // Ticker sprang wortlos zur nächsten Zeile, während der Agent den Hinweis
    // sehr wohl bekam — Georg las von der versuchten Reparatur gar nichts mehr.
    // Steht nur dort, wo ein Rückroll wirklich versprochen war; am harten Stopp
    // ist „nichts zurückzunehmen" der Normalfall.
    //
    // ZWEI Sätze, weil derselbe Rückgabewert zwei sehr verschiedene Lagen meint
    // (gemessen): „nichts zurückgenommen" heißt einmal „es war wirklich nichts
    // zu tun" und einmal „es gab etwas, es blieb aber alles stehen". Der erste
    // Satz an der zweiten Lage war schlicht falsch — er behauptete einen
    // sauberen Ordner, während direkt darunter stand, was liegengeblieben ist.
    rollbackNichtsZurueckgenommen:
      'Beim Zurückrollen war nichts zurückzunehmen — der Projektordner stand schon genau auf ' +
      'dem Sicherungspunkt. Verworfen wurde damit nichts, obwohl etwas verworfen werden sollte.',
    rollbackNichtsAngefasst:
      'Beim Zurückrollen wurde nichts angefasst — der verworfene Stand liegt unverändert im ' +
      'Projektordner. Zurückzunehmen gab es sehr wohl etwas; es steht aber vollständig in ' +
      'Bereichen, die FlowForge stehenlassen muss. Die Zeile darunter sagt, welche das sind.',
    // Der gemeinsame Stand ist weitergerückt, seit der Rückroll-Punkt festgelegt
    // wurde: Ein ANDERER Block hat inzwischen seine fertige Runde beigesteuert.
    // Voll zurückzurollen nähme sie mit. Gemessen genau so, bevor diese Grenze
    // dazukam: Die Arbeit des zweiten Bauers verschwand aus dem Projektordner,
    // ihr Sicherungspunkt stand weiter in der Liste, und der Ticker meldete
    // nichts als „zurückgerollt".
    rollbackStandUeberholt: (anzahl) =>
      `${anzahl} ${anzahl === 1 ? 'Änderung blieb' : 'Änderungen blieben'} beim Zurückrollen ` +
      'stehen, weil seit diesem Sicherungspunkt ein anderer Block seine fertige Runde ' +
      `beigesteuert hat — ${anzahl === 1 ? 'sie würde' : 'sie würden'} sonst mit aus dem ` +
      'Projektordner fallen. Zurückgenommen wurde nur, was FlowForge dem betroffenen Block ' +
      'selbst zuordnen kann.',
    // Ein offen gebliebenes Teilstück aus einem früheren Anlauf desselben
    // Blocks: Sein Rückroll-Punkt gehört nicht mehr zum jetzigen Stand — ein
    // Rückroll würfe die Arbeit der laufenden Runde weg.
    rollbackPunktVerschoben:
      'Das offene Teilstück gehört zu einem früheren Anlauf dieses Blocks — es wird NICHTS ' +
      'zurückgerollt, sonst fiele die Arbeit der laufenden Runde mit. Der Agent bringt es selbst ' +
      'in Ordnung.',
    // Offenes Teilstück je Block (BAUPLAN 45): Bis hierher lebte es in der
    // Lauf-Session, die alle Blöcke nacheinander bedient — der nächste Block
    // konnte es abnehmen und damit SEINE Arbeit zurückrollen.
    teilstueckBeimBlockwechsel: (bezeichnung, teilstueck) =>
      `Offenes Teilstück „${teilstueck}" aus ${bezeichnung} wurde nie abgenommen — mit dem ` +
      'Blockwechsel ist es geschlossen. Zurückgerollt wird nichts: Der Rückroll-Punkt gehört ' +
      'zum vorherigen Block.',
    diffAusserhalb: (anzahl) =>
      `${anzahl} ${anzahl === 1 ? 'geänderte Datei liegt' : 'geänderte Dateien liegen'} außerhalb ` +
      `der Dateiliste dieses Blocks — ${anzahl === 1 ? 'sie steht' : 'sie stehen'} nicht in ` +
      'seinem Änderungs-Überblick.',
    fertigIn: (sekunden) => `Fertig nach ${sekunden} Sekunden.`,
    blockStartet: (nr, gesamt, name) => `Block ${nr} von ${gesamt}: „${name}" startet.`,
    // Karten-Vorschläge (BAUPLAN 26): Vorschlag und Ausgang sichtbar im Ticker.
    kartenVorschlagGestellt: (artLabel, titel) =>
      `Karten-Vorschlag wartet auf dich: ${artLabel} — „${titel}".`,
    kartenVorschlagUebernommen: (titel) => `Karten-Vorschlag übernommen: „${titel}".`,
    kartenVorschlagBearbeitet: (titel) =>
      `Karten-Vorschlag mit deinen Änderungen übernommen: „${titel}".`,
    kartenVorschlagAbgelehnt: (titel) => `Karten-Vorschlag abgelehnt: „${titel}".`,
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): sichtbar im Ticker
    // und damit auch im Laufbericht des erzeugenden Laufs.
    laufVorschlagGespeichert: (anzahl, empfehlung) =>
      `Vorschlag fürs nächste Paket: ${anzahl} Karte${anzahl === 1 ? '' : 'n'} — ${empfehlung}`,
    // Karten-Zuteilung (BAUPLAN 29): sichtbar im Ticker und damit im Laufbericht.
    kartenZuteilung: (zeilen) => `Karten verteilt: ${zeilen}`,
    // Paket melden & Themen (BAUPLAN 30). Seit BAUPLAN 44 mit der Bezeichnung
    // des meldenden Blocks: Zwei Auftragsquellen im Schaubild ergaben sonst zwei
    // Zeilen, die nicht auseinanderzuhalten waren.
    paketGemeldet: (bezeichnung, titel) =>
      titel.length
        ? `Paket gemeldet von ${bezeichnung}: ${titel.length} Aufgabe${titel.length === 1 ? '' : 'n'} — „${titel.join('“, „')}". Karten aus diesem Lauf tragen das als Herkunft.`
        : `Paket gemeldet von ${bezeichnung}: allein aus dem Feld — keine Aufgaben-Karten.`,
    // Zuschnitt je Ziel (BAUPLAN 44): Wer welches Paket bekommen hat, ist die
    // erste Stelle, an der Georg nachsieht, wenn ein Bauer das Falsche baute.
    zuschnittGeschnitten: (bezeichnung, zeilen) =>
      `Zuschnitt von ${bezeichnung}: ${zeilen.join(' | ')}`,
    zuschnittZiel: (bezeichnung, anzahlDateien) =>
      `${bezeichnung} — ${anzahlDateien} erlaubte Datei${anzahlDateien === 1 ? '' : 'en'}`,
    zuschnittOhneZiel: (anzahlDateien) =>
      `ohne Ziel (gilt für alle) — ${anzahlDateien} erlaubte Datei${anzahlDateien === 1 ? '' : 'en'}`,
    // Laufzeit-Zusatzname (0.51.1): Das Umbenennen muss sichtbar sein — sonst
    // heißt ein Block im Ticker plötzlich anders, ohne dass Georg weiß, woher.
    // Die Leinwand bleibt unangetastet, deshalb „in diesem Lauf".
    laufzeitZusatzAngeheftet: (alterName, neuerName, quelle) =>
      `„${alterName}" heißt in diesem Lauf jetzt „${neuerName}" — Kurzname aus dem Zuschnitt ` +
      `von ${quelle}. Die Leinwand bleibt unverändert.`,
    // Vollständigkeit des Zuschnitts (BAUPLAN 44). Jede Zeile steht im Ticker
    // und damit im Laufbericht — Georgs Alltagstest („er übergeht eine Aufgabe")
    // muss dort sichtbar sein, sonst hält er die Prüfung für nicht gelaufen.
    paketNachgefordert: (bezeichnung) =>
      `${bezeichnung} hat nicht gemeldet, an welchen Aufgaben-Karten der Lauf arbeitet — FlowForge ` +
      'fordert die Paket-Meldung einmal nach (ohne sie prüft niemand die Vollständigkeit).',
    // Ohne „auch nach der Nachforderung" formuliert: Die Runde kann auch
    // deshalb ausbleiben, weil der Lauf gerade angehalten wird — dann hätte der
    // Satz eine Nachforderung behauptet, die es nie gab.
    paketFehltWeiter: (bezeichnung) =>
      `${bezeichnung} hat kein Paket gemeldet — die Vollständigkeit des Zuschnitts bleibt in ` +
      'diesem Lauf ungeprüft, und die Karten dieses Laufs tragen keine Aufgabe als Herkunft.',
    // Die ehrliche Grenze: Kommt der Auftrag allein aus dem Wunsch-/Fehlerbild-
    // Feld, gibt es keine Aufgaben-Karten, gegen die gemessen werden könnte.
    paketOhneAufgaben: (bezeichnung) =>
      `${bezeichnung} arbeitet allein aus seinem Feld — geprüft wird deshalb nur, ob jedes ` +
      'benannte Ziel ein Paket bekommen hat, nicht ob jede Aufgabe darin vorkommt.',
    // Selbstauskunft verhindern (BAUPLAN 44): Gemessen wird immer gegen die
    // ERSTE Meldung — ein späteres Schrumpfen besteht die Prüfung nicht, es
    // steht hier.
    paketGeschrumpft: (bezeichnung, vorher, nachher) =>
      `${bezeichnung} meldet sein Paket kleiner als zuvor (${vorher} → ${nachher} Aufgaben) — ` +
      'gemessen wird weiterhin gegen die erste Meldung.',
    zuschnittNachgefordert: (bezeichnung, aufgaben, ziele) =>
      `${bezeichnung} hat seinen Zuschnitt nicht vollständig geschnitten` +
      (aufgaben.length ? ` (nicht abgedeckt: „${aufgaben.join('“, „')}")` : '') +
      (ziele.length ? ` (ohne Paket: ${ziele.join(' | ')})` : '') +
      ' — FlowForge fordert einmal nach.',
    zuschnittWeiterOhne: (bezeichnung, aufgaben, ziele) =>
      `${bezeichnung} hat den Zuschnitt nicht vervollständigt` +
      (aufgaben.length ? ` (nicht abgedeckt: „${aufgaben.join('“, „')}")` : '') +
      (ziele.length ? ` (ohne Paket: ${ziele.join(' | ')})` : '') +
      ' — der Lauf macht ehrlich vermerkt weiter.',
    themenUebernommen: (uebernommen, abgelehnt) =>
      `Themen sortiert: ${uebernommen} übernommen, ${abgelehnt} abgelehnt.`,
    // Audit (BAUPLAN 25): volle Lesetiefe, bewusst teuer — die Kosten-Folge
    // steht sichtbar am Start (Entscheidung Georg, 14.08.2026).
    auditKostenHinweis:
      'Rundum-Blick mit voller Lesetiefe: Die drei Blickwinkel-Prüfer lesen das ganze Projekt — ein Audit-Lauf kann mehrere hunderttausend Tokens kosten.',
    zweigeZusammengefuehrt: (name, anzahl) =>
      `„${name}" führt ${anzahl} Zweige zusammen — alle Vorgänger sind fertig.`,
    // Warte-Grund (BAUPLAN 36): Eine stille Pause im Verzweigten sieht aus wie
    // ein Hänger — hier steht, worauf gewartet wird. Seit BAUPLAN 46 mit den
    // vier Gründen der Welle: Zwei Schreiber dürfen gleichzeitig, wenn ihre
    // Dateilisten getrennt sind — sonst sagt die Zeile, woran es hängt.
    warteAufUeberschneidung: (name, anderer, paare) =>
      `„${name}" wartet, bis „${anderer}" fertig ist — beide Dateilisten überschneiden sich` +
      (paare ? ` (${paare})` : '') +
      '.',
    warteOhneDatenvertrag: (name, anderer, selbstOhne) =>
      selbstOhne
        ? `„${name}" wartet, bis „${anderer}" fertig ist — „${name}" hat keinen Datenvertrag (Dateiliste) und schreibt darum nicht parallel.`
        : `„${name}" wartet, bis „${anderer}" fertig ist — „${anderer}" hat keinen Datenvertrag (Dateiliste); ohne ihn schreibt kein zweiter Block daneben.`,
    prueferWartetAufUmsetzer: (name, anderer) =>
      `„${name}" wartet, bis „${anderer}" fertig gebaut hat — ein Prüfer urteilt nie über einen halben Stand.`,
    umsetzerWartetAufPruefer: (name, anderer) =>
      `„${name}" wartet, bis „${anderer}" fertig geprüft hat — solange ein Prüfer misst, baut keiner daneben.`,
    // Eine offene Folgen-Frage belegt ihren Zweig (BAUPLAN 46): „Stand
    // wiederherstellen" könnte die Dateien des Zweigs zurücksetzen — ein Bauer,
    // dessen Liste sich damit überschneidet, wartet, statt hineinzuschreiben.
    warteAufFolgenFrage: (name, pruefer) =>
      `„${name}" wartet, bis die Folgen-Frage zu „${pruefer}" beantwortet ist — die Dateien dieses Zweigs könnten noch zurückgesetzt werden.`,
    warteAufZweig: (name, offene) =>
      `„${name}" wartet auf ${offene.map((n) => `„${n}"`).join(' und ')} — der andere Zweig ist schon fertig.`,
    // Welle (BAUPLAN 46): mehrere Schreiber gleichzeitig — die Zeile kommt,
    // sobald es zum ersten Mal in dieser Welle zwei sind.
    welleGestartet: (anzahl) =>
      `Welle: ${anzahl} Blöcke schreiben gleichzeitig (Dateilisten getrennt).`,
    // Nachlauf (BAUPLAN 46): Der Rauchtest misst erst, wenn nebenan keiner
    // mehr halb geschrieben hat.
    nachlaufWartet: (name) => `Rauchtest von „${name}" wartet, bis die Welle steht.`,
    // Folgen-Frage je Zweig (BAUPLAN 46): Der Rückroll trifft nur den Zweig.
    zweigWiederhergestellt: (name, dateien) =>
      `Zweig „${name}" auf den Stand vor dem Lauf zurückgesetzt (${dateien} ${dateien === 1 ? 'Datei' : 'Dateien'}), andere Zweige unberührt.`,
    zweigWiederherstellenGescheitert: (name) =>
      `Zweig „${name}" ließ sich NICHT auf den Stand vor dem Lauf zurücksetzen — der Projektordner bleibt, wie er ist.`,
    // Harter Stopp mit mehreren Schreibern (BAUPLAN 46): je Block eine Zeile.
    zurueckgesetztBlock: (name) =>
      `Arbeit von „${name}" auf ihren letzten Sicherungspunkt zurückgesetzt.`,
    // Compaction sichtbar (BAUPLAN 36): Der Motor dampft sein Arbeitsgedächtnis
    // selbst ein — das erklärt später, warum ein Agent Details vergessen hat.
    zusammengefasst: ({ wer, istKoordinator, vorher, nachher, automatisch }) =>
      `Der Motor hat das Arbeitsgedächtnis ${istKoordinator ? 'des Koordinators' : `von „${wer}"`} zusammengefasst` +
      (automatisch ? ' (der Kontext lief voll)' : '') +
      (vorher != null
        ? ` — vorher ${vorher.toLocaleString('de-DE')} Tokens${nachher != null ? `, danach ${nachher.toLocaleString('de-DE')}` : ''}.`
        : '.'),
    pruefungBestanden: 'Prüfung bestanden.',
    pruefungNichtBestanden: 'Prüfung nicht bestanden.',
    pruefungOhneErgebnis:
      'Der Prüfer hat keinen Prüfbeleg gemeldet — das gilt als nicht bestanden.',
    rueckfuehrung: (name, runde, gesamt) =>
      `Zurück zu „${name}" — Reparatur-Runde ${runde} von ${gesamt}.`,
    // Gebündelte Rückführung (BAUPLAN 47): Ein zweiter Prüfer, der denselben
    // Block zurückschickt, bevor der wieder gestartet ist, hängt seine
    // Beanstandungen an — eine Reparatur-Runde statt zwei, 0 Tokens.
    rueckfuehrungGebuendelt: (prueferName, zielName, anzahl) =>
      `„${prueferName}" schickt „${zielName}" ebenfalls zurück — gebündelt in dieselbe ` +
      `Reparatur-Runde (${anzahl} ${anzahl === 1 ? 'Beanstandung' : 'Beanstandungen'} dazu), ` +
      'keine zweite Runde.',
    // Nachgeholte Rückführung (BAUPLAN 47): Kam die Kritik eines Prüfers an,
    // während das Ziel gerade lief (ein nur-lesendes oder prüfendes Ziel startet
    // neben Prüfern sofort), läuft es nach dem Anlauf gleich noch einmal — sonst
    // wäre die Runde genommen und die Kritik trotzdem verloren.
    rueckfuehrungNachgeholt: (name) =>
      `„${name}" lief schon, als diese Rückmeldung kam — der Block läuft mit ihr gleich noch einmal.`,
    // Lieferschein (BAUPLAN 42): Was ein Block gemeldet hat, steht im Ticker —
    // und damit im Laufbericht.
    meldungAngekommen: (name, fazit) => `„${name}" meldet: ${fazit}`,
    meldungAbgewiesen: (name, grund) => `Meldung von „${name}" abgewiesen — ${grund}`,
    meldungNachgefordert: (name) =>
      `„${name}" hat sein Ergebnis nicht gemeldet — FlowForge fordert die Meldung einmal nach.`,
    meldungFehlt: (name, etiketten) =>
      `„${name}" hat auch nach der Nachforderung nichts gemeldet` +
      (etiketten.length ? ` (es fehlt: ${etiketten.join(', ')})` : '') +
      ' — der Block gilt als fehlgeschlagen.',
    // Kanten-Ehrlichkeit (BAUPLAN 34): Was an den Kanten passiert, steht im
    // Ticker — und damit im Laufbericht.
    beanstandungenUebergeben: (anzahl, name) =>
      `${anzahl} ${anzahl === 1 ? 'Beanstandung' : 'Beanstandungen'} an „${name}" übergeben.`,
    diffUebergeben: (name, dateien, zeilen) =>
      `Änderungen der letzten Runde an „${name}" übergeben: ${dateien} ` +
      `${dateien === 1 ? 'Datei' : 'Dateien'}, ${zeilen} ${zeilen === 1 ? 'Zeile' : 'Zeilen'}.`,
    diffGekuerzt: 'Der Änderungs-Überblick war zu lang — FlowForge hat ihn sichtbar gekürzt.',
    uebergabenZusammengefuehrt: (anzahl, etikett) =>
      `${anzahl} Lieferungen „${etikett}" zusammengeführt — der Block bekommt alle, ` +
      'keine geht still verloren.',
    // Fan-in ohne stillen Verlust (BAUPLAN 40): Liefern zwei verschieden weit
    // entfernte Vorfahren dasselbe Etikett, gewinnt weiter der nähere — aber
    // die verdrängte Arbeit war bezahlt und verschwand bisher wortlos.
    blockBezeichnung: (nummer, name) => (nummer ? `Block ${nummer} „${name}"` : `„${name}"`),
    uebergabeVerdraengt: (etikett, empfaenger, gewinner, verdraengt) =>
      `„${etikett}" für ${empfaenger} kommt von ${gewinner} — näher im Schaubild. ` +
      `Verdrängt: ${verdraengt}; diese Arbeit geht nicht in den Auftrag.`,
    // Verdrängung durch Weiterverarbeitung (0.46.2): Der Beleg des ersten
    // Prüfers ging ins Zweitaudit ein — beim gemeinsamen Empfänger zählt der
    // des Zweitaudits. Nichts ist verloren, es steht nur woanders drin.
    uebergabeWeiterverarbeitet: (etikett, verdraengt, weiterverarbeiter, empfaenger, gewinner) =>
      `„${etikett}" von ${verdraengt} ging in ${weiterverarbeiter} ein — ` +
      `bei ${empfaenger} zählt der von ${gewinner}.`,
    // Folgen-Frage je Zweig (BAUPLAN 46): Mehrere können offen sein, und jede
    // Wahl trifft nur ihren Zweig — deshalb nennt jede Zeile den Prüfer.
    entscheidungGestellt: (name) =>
      `Folgen-Frage zu „${name}" an dich — bitte im Fenster beantworten` +
      ' (andere Zweige laufen derweil weiter).',
    menschFrageGestellt: 'Frage an dich — bitte im Gespräch antworten.',
    menschGeantwortet: 'Deine Antwort ist beim Agenten.',
    entscheidungWeitermachen: (name) =>
      `Du hast entschieden: „${name}" — weitermachen; der Zweig gilt als erledigt.`,
    entscheidungZurueckgestellt: (name) =>
      `Du hast entschieden: „${name}" — zurückstellen; dieser Zweig endet hier, andere laufen zu Ende.`,
    entscheidungWiederhergestellt: (name) =>
      `Du hast entschieden: „${name}" — Stand von vor dem Lauf wiederherstellen (nur für diesen Zweig).`,
    entscheidungWiederhergestelltGanz: (name) =>
      `Du hast entschieden: „${name}" — Stand von vor dem Lauf wiederherstellen; ohne Datenvertrag trifft das am Laufende den ganzen Projektordner.`,
    uebertragAngefordert: (von, bis) =>
      `Der Kontext ist zu etwa ${von}–${bis} % gefüllt — Übertrag: Der Agent notiert den Zwischenstand und übergibt.`,
    uebertragWeiter: (nummer, grenze) =>
      `Übergabe angekommen — eine frische Session macht nahtlos weiter (Übertrag ${nummer}${grenze != null ? ' von höchstens ' + grenze : ''}).`,
    uebertragGrenzeErreicht: (grenze) =>
      `Die Übertragsgrenze (${grenze}) ist erreicht — dieser Block läuft ohne weiteren Übertrag zu Ende.`,
    kontingentPause:
      'Dein Abo-Kontingent ist im Moment aufgebraucht — der Lauf pausiert und probiert es alle 10 Minuten von selbst wieder.',
    serverPause:
      'Die KI-Server sind überlastet — der Lauf pausiert und probiert es alle 10 Minuten von selbst wieder.',
    kontingentVersuch: 'Pause vorbei: FlowForge versucht es jetzt wieder.',
    kontingentWeiter: 'Es geht weiter — der Motor arbeitet wieder.',
    ausWarteschlangeGestartet:
      'Der Platz war frei — dieser Lauf startet jetzt von allein aus der Warteschlange.',
    motorWartet: (versuch, max) =>
      `Die KI-Server sind gerade überlastet — der Motor versucht es weiter (Versuch ${versuch} von ${max}).`,
    // Lokaler Motor (Befund Prüfer 2, Bausession 51): Der Fehler kommt von
    // Ollama, nicht von den Anthropic-Servern — der Text darf nicht so tun.
    motorWartetLokal: (adresse, versuch, max) =>
      `Deine lokale KI unter ${adresse} meldet einen Fehler — der Motor versucht es weiter (Versuch ${versuch} von ${max}).`,
    wiederaufnahme: (nummer, gesamt, name) =>
      `Wiederaufnahme am letzten Sicherungspunkt — weiter mit Block ${nummer} von ${gesamt}: „${name}".`,
    sessionFortsetzenGescheitert:
      'Die Lauf-Session ließ sich nicht fortsetzen — es geht mit einer frischen Session weiter.',
    // Nachlauf-Chat (BAUPLAN 27): Chat-Zeilen im Ticker klar gekennzeichnet —
    // Reparaturen des Chats sind damit sichtbar wie jede Agenten-Arbeit.
    chatZeile: (text) => `Chat · ${text}`,
    // Co-Pilot (BAUPLAN 33): App-Werkzeuge und Sperren des Übersichts-Chats.
    appGestartet: 'App über den App-Tab gestartet.',
    appNeuGestartet: 'App über den App-Tab neu gestartet.',
    appGestoppt: 'App über den App-Tab gestoppt.',
    appPortBelegt: (port) => `App nicht gestartet — Port ${port} ist belegt (siehe App-Tab).`,
    appStartFehler: (grund) => `App nicht gestartet: ${grund}`,
    datenordnerGesperrt: 'Zugriff auf den Datenordner gestoppt — er ist für den Chat gesperrt.',
    uebersichtGesperrt: 'Werkzeug gestoppt — ohne offenes Projekt beantwortet der Chat nur Bedienfragen.',
    // Lokaler Prüfer (BAUPLAN 50): Tor-Anker — meldet ein Prüfer der Klasse
    // „lokal" „bestanden", spielt FlowForge seinen Prüfbefehl einmal ohne KI
    // ab. Der Ticker sagt je Ausgang, was mit dem Urteil geschehen ist.
    torBestaetigtLokal: (name) =>
      `Tor-Anker: Prüfbefehl von „${name}" grün — das Urteil „bestanden" des lokalen Prüfers ist mechanisch bestätigt.`,
    torAltlastenLokal: (name) =>
      `Tor-Anker: Prüfbefehl von „${name}" rot, aber nur mit Fehlschlägen, die schon vor dem Lauf da waren — das Urteil „bestanden" des lokalen Prüfers bleibt stehen.`,
    torDrehtLokal: (name, anzahl) =>
      `Tor-Anker: Prüfbefehl von „${name}" rot (${anzahl} ${anzahl === 1 ? 'Fehlerzeile' : 'Fehlerzeilen'}) — das Urteil „bestanden" des lokalen Prüfers wird mechanisch auf „fehlgeschlagen" gedreht; normale Rückführung.`,
    torKeinBefehlLokal: (name) =>
      `Tor-Anker: „${name}" hat keinen Prüfbefehl hinterlegt — keine mechanische Bestätigung des lokalen Urteils möglich; es gilt ungeprüft.`,
    torAbgebrochenLokal: (name) =>
      `Tor-Anker: Prüfbefehl von „${name}" abgebrochen (Lauf gestoppt) — das lokale Urteil bleibt unbestätigt.`,
    // Abnahme (BAUPLAN 50): Ein Claude-Prüfer hinter dem lokalen Prüfer hat
    // geurteilt — der Ticker stellt beide Urteile nebeneinander.
    abnahmeBestaetigt: (abnahmeName, lokalName, urteil) =>
      `Abnahme: „${abnahmeName}" bestätigt das Urteil „${urteil}" des lokalen Prüfers „${lokalName}".`,
    abnahmeWiderspricht: (abnahmeName, lokalName, urteilLokal, urteilAbnahme) =>
      `Abnahme: „${abnahmeName}" widerspricht dem lokalen Prüfer „${lokalName}" — lokal „${urteilLokal}", Abnahme „${urteilAbnahme}".`,
    // Das Urteil der Abnahme kam aus ihrem eigenen Vor-Tor (Reparatur-Runde),
    // kein Agent hat den Beleg gelesen — ehrlich benannt, zählt in der Metrik nicht.
    abnahmeDurchTor: (abnahmeName, lokalName, urteilLokal, urteilAbnahme) =>
      `Abnahme: Das Urteil „${urteilAbnahme}" von „${abnahmeName}" kam aus ihrem Vor-Tor ohne KI (lokaler Prüfer „${lokalName}": „${urteilLokal}") — kein Agent hat den Beleg gelesen.`,
    // Steck-Hinweis beim Laufstart (keine Sperre): Ein lokaler Prüfer ohne
    // Claude-Prüfer dahinter prüft ohne Abnahme — der Lauf startet trotzdem.
    lokalerPrueferOhneAbnahme: (name) =>
      `Hinweis: Hinter dem lokalen Prüfer „${name}" nimmt kein Claude-Prüfer ab — sein Urteil hängt nur am Tor-Anker (Prüfbefehl). Der Lauf startet trotzdem.`
  },
  sicherungen: {
    ueberschrift: 'Sicherungspunkte',
    keine: 'Noch keine Sicherungspunkte.',
    hinweis: 'FlowForge sichert den Projektordner automatisch — vor jedem Lauf und nach jedem gelungenen Block.',
    wiederherstellen: 'Wiederherstellen',
    vorschauUeberschrift: 'Diesen Stand wiederherstellen?',
    vorschauEinleitung: (zeit) => `Das Projekt wird auf den Stand von ${zeit} zurückgesetzt.`,
    identisch: 'Der jetzige Stand ist mit diesem Sicherungspunkt identisch — es gibt nichts zurückzusetzen.',
    gruppeAnders: 'Wird zurückgesetzt:',
    gruppeVerschwindet: 'Verschwindet:',
    gruppeKommtZurueck: 'Kommt zurück:',
    laufberichteBleiben: 'Laufberichte bleiben in jedem Fall erhalten. Vorher wird der jetzige Stand automatisch gesichert — du kannst also auch das Wiederherstellen rückgängig machen.',
    jetztWiederherstellen: 'Jetzt wiederherstellen',
    abbrechen: 'Abbrechen',
    erledigt: (zeit) => `Stand von ${zeit} wiederhergestellt.`,
    beschriftungProjektAngelegt: 'Projekt angelegt',
    beschriftungVorLauf: (block) => `Stand vor „${block}"`,
    beschriftungNachBlock: (block) => `„${block}" fertig`,
    beschriftungVorWiederherstellung: 'Stand vor der Wiederherstellung',
    // Lokale Vorreparatur (BAUPLAN 20): auf genau diesen Punkt wird
    // zurückgerollt, wenn die Nachprüfung scheitert.
    beschriftungVorLokalerReparatur: 'Stand vor lokaler Reparatur',
    // Lokaler Bauer (BAUPLAN 22): auf genau diesen Punkt wird zurückgerollt,
    // wenn die Abnahme des Teilstücks scheitert.
    beschriftungVorLokalemTeilstueck: 'Stand vor lokalem Teilstück',
    // Sicherungspunkte je Schreiber (BAUPLAN 45): Der Punkt am Blockende IST
    // die Zusammenführung des eigenen Strangs — es gibt weiterhin genau EINEN
    // Eintrag je schreibendem Block, sonst stünde derselbe Ordnerstand zweimal
    // in Georgs Liste. Der Zusatzname des Blocks (BAUPLAN 41) steht hier —
    // nicht im Namen des Strangs. Für „fertig" gilt beschriftungNachBlock;
    // endet der Block anders (ein Prüfer, der zurückweist, ein abgebrochener
    // Anlauf), darf dort nicht „fertig" stehen.
    beschriftungRundeBeendet: (block) => `Stand nach Runde „${block}"`,
    // Nachlauf-Chat (BAUPLAN 27): vor der ersten Änderung des Chats.
    beschriftungVorChatReparatur: 'Stand vor Chat-Reparatur',
    beschriftungWiederhergestellt: (zeit) => `Zurückgeholt: Stand von ${zeit}`,
    fehlerAnlegen: 'Der Sicherungspunkt konnte nicht angelegt werden. Der Lauf wurde sicherheitshalber nicht gestartet.',
    // Stränge scheitern mitten im Lauf, nicht beim Start (BAUPLAN 45) — der
    // Satz oben wäre dort schlicht falsch.
    fehlerStrangOeffnen:
      'Der eigene Sicherungsstrang für diesen Block konnte nicht angelegt werden. Der Block läuft ohne Trennung weiter.',
    fehlerStrangZusammenfuehren:
      'Der eigene Sicherungsstrang dieses Blocks konnte nicht mit dem gemeinsamen Stand zusammengeführt werden.',
    fehlerVorschau: 'Die Vorschau konnte nicht erstellt werden.',
    fehlerWiederherstellen: 'Das Wiederherstellen hat nicht geklappt. Der Projektordner wurde nicht verändert.',
    fehlerWaehrendLauf: 'Während ein Workflow läuft, kann nichts wiederhergestellt werden.',
    fehlerWaehrendWarteschlange:
      'Dieses Projekt wartet in der Warteschlange auf einen Lauf — solange kann nichts wiederhergestellt werden.'
  },
  // Rechte-Standard sichtbar in den Projekt-Einstellungen (SPEC §7, BAUPLAN 15).
  projektEinstellungen: {
    ueberschrift: 'Projekt-Einstellungen',
    rechteUeberschrift: 'Rechte des Agenten',
    rechteEinleitung:
      'Diese Regeln gelten für jeden Agenten, der in diesem Projekt arbeitet. Sie sind in V1 fest eingebaut — pro Projekt verstellbar werden sie in einer späteren Version.',
    ohneRueckfrageTitel: 'Ohne Rückfrage erlaubt',
    ohneRueckfrage: [
      'Im Projektordner lesen, schreiben und löschen',
      'Programmbibliotheken aus offiziellen Quellen installieren',
      'Tests und bekannte Entwickler-Werkzeuge ausführen (node, npm, python …)',
      'Rein lesende Kommandozeilen-Befehle (dir, type, findstr …)'
    ],
    mitRueckfrageTitel: 'Nur mit deiner Erlaubnis',
    mitRueckfrage: [
      'Alles außerhalb des Projektordners',
      'Sonstige Internetzugriffe',
      'Unbekannte Kommandozeilen-Befehle und alles Unumkehrbare'
    ],
    gesperrtTitel: 'Immer gesperrt (hartes Nein)',
    gesperrt: [
      'Git — Sicherungspunkte verwaltet FlowForge selbst',
      'FlowForge-Verwaltungsdateien (Karten, Workflow, Laufberichte) — Karten pflegt der Agent über die Karten-Werkzeuge',
      'Bei Blöcken mit Sperre „darf nur lesen": jede Veränderung'
    ],
    hinweisAutomodus:
      'Ob Rückfragen automatisch erlaubt werden (Automodus), stellst du oben rechts unter „Einstellungen" ein — das gilt für alle Projekte. Die harten Sperren gelten auch im Automodus.',
    kontingentHinweis:
      'Das Verhalten bei erschöpftem Abo-Kontingent und die Übertragsgrenze stellst du direkt im Schaubild-Tab über dem Schaubild ein.',
    schliessen: 'Schließen'
  },
  // Prüfmappen-Ansicht an der Prüferkarte (BAUPLAN 17): nur zum Nachlesen —
  // bearbeiten darf die Mappe weiterhin nur der Prüfer.
  pruefmappe: {
    titel: 'Prüfmappe',
    anzahl: (n) => (n === 1 ? '1 Prüfung' : `${n} Prüfungen`),
    leer: 'Die Prüfmappe ist leer. Der Prüfer legt hier während des Laufs seine Prüfungen fürs aktuelle Paket ab — beim Start des nächsten Laufs wird sie geleert.',
    hinweis:
      'Gezählt werden Prüf-Dateien, nicht einzelne Testfälle darin. Nur zum Nachlesen — bearbeiten darf die Mappe nur der Prüfer.',
    // Prüfordner je Prüfer (BAUPLAN 41): Jede Prüferkarte zeigt ihre eigene
    // Mappe — deshalb steht hier, welcher Ordner gemeint ist.
    eigenerOrdner: (ordner) => `Eigener Prüfordner dieser Karte: pruefung/${ordner}/`,
    groesseBytes: (bytes) => `${bytes} Byte`,
    groesseKb: (kb) => `${kb} KB`
  },
  // Prüfkarten (SPEC §3.1/§4.3, BAUPLAN 18): gezielte Wiederholungsprüfung —
  // der Nutzer zieht Prüfkarten auf einen Prüf-Block, FlowForge legt deren
  // aufbewahrte Prüfdateien beim Laufstart in die Prüfmappe.
  pruefkarten: {
    anhangTitel: 'Prüfkarten für diesen Lauf',
    ziehHinweis:
      'Zieh eine Prüfkarte aus der Seitenleiste hierher — der Prüfer prüft sie dann beim nächsten Lauf zusätzlich.',
    entfernen: 'Von diesem Prüfer nehmen',
    nurPruefkarten:
      'Auf einen Prüfer lassen sich nur Prüfkarten ziehen (die grünen Häkchen-Karten legt FlowForge nach jeder bestandenen Prüfung an). Andere Karten ziehst du in die Kartenauswahl über dem Schaubild.',
    ersatzTitel: (zeit) => `Geprüft am ${zeit}`,
    ersatzText:
      'Diese Prüfung wurde bestanden. Einzelheiten stehen im Laufbericht dieses Laufs.'
  },
  // Sonderläufe (BAUPLAN 30): Aufräum-Knöpfe der Karten-Seitenleiste.
  sonderlauf: {
    themenSortierenName: 'Themen sortieren',
    berichtMarke: 'Sonderlauf'
  },
  // Sortiermodus des Karten-Prüfers (BAUPLAN 30): klassifiziert alle Karten
  // ohne oder mit offensichtlich falschem Thema — ohne Code-Nachmessen — und
  // schlägt sie in EINEM Sammel-Dialog vor.
  agentenThemenSortieren: {
    auftrag:
      'Du bist der Themen-Sortierer: Du bringst Ordnung in die Themen der Projektkarten — ' +
      'ohne am Code nachzumessen und ohne Karten umzuformulieren. Antworte auf Deutsch. ' +
      'Du selbst veränderst NICHTS: keine Dateien, keine Programme oder Tests, keine ' +
      'direkten Kartenänderungen. Hol dir mit karten_uebersicht alle Karten samt ihren ' +
      'Themen (Karten ohne Themen-Marke haben noch keins). Jede Aufgaben-, Entscheidungs- ' +
      'und Wissens-Karte soll unter EINEM kurzen Thema stehen (Schlagwort, kein Satz). ' +
      'Bevorzuge die vorhandenen Themen — ein neues Thema nur, wenn wirklich keines ' +
      'passt; halte die Zahl der Themen klein (lieber sechs klare als zwanzig feine). ' +
      'Nimm dir vor: (1) alle Karten OHNE Thema, (2) Karten, deren Thema offensichtlich ' +
      'nicht zum Inhalt passt (nur bei klarem Fehlgriff, nicht bei Geschmacksfragen). ' +
      'Status- und Prüfkarten tragen kein Thema — lass sie weg. Dateien im Projektordner ' +
      'brauchst du dafür nicht zu lesen; die Kartentexte reichen. Schlage dann ALLE ' +
      'betroffenen Karten in EINEM einzigen Aufruf von karte_vorschlagen mit art "thema" ' +
      'vor (Feld themen: je Karte kartenId und thema; begruendung: nach welchem Muster du ' +
      'sortiert hast). Der Nutzer bekommt eine Tabelle, ändert oder lehnt einzelne Zeilen ' +
      'ab, und FlowForge wendet seine Entscheidung an. Gibt es nichts zu sortieren, machst ' +
      'du keinen Vorschlag und sagst das ehrlich. ' +
      'Ins Feld inhalt deiner Meldung gehören 3 bis 6 Sätze: welche Themen es jetzt gibt, wie ' +
      'viele Karten du vorgeschlagen hast und was der Nutzer davon übernommen oder abgelehnt hat.'
  },
  laufberichte: {
    ueberschrift: 'Laufberichte',
    keine: 'Noch keine Laufberichte.',
    unbekannterBlock: 'Block',
    // Paket & Sonderlauf (BAUPLAN 30).
    paketZeile: (titel) => `Paket dieses Laufs: „${titel.join('“, „')}"`,
    paketLeerZeile: 'Paket dieses Laufs: allein aus dem Feld — keine Aufgaben-Karten.',
    // Paket je Auftragsquelle (BAUPLAN 44): Zwei Auftragsquellen im Schaubild
    // überschrieben sich vorher wortlos — jetzt steht je Block eine Zeile.
    paketBlockZeile: (bezeichnung, titel) =>
      titel.length
        ? `Paket von ${bezeichnung}: „${titel.join('“, „')}"`
        : `Paket von ${bezeichnung}: allein aus dem Feld — keine Aufgaben-Karten.`,
    keineZumFilter: 'Kein Laufbericht mit diesem Ausgang.',
    filterAlle: 'Alle',
    dauerSekunden: (s) => `Dauer: ${s} Sekunden`,
    dauerMinuten: (m) => `Dauer: etwa ${m} ${m === 1 ? 'Minute' : 'Minuten'}`,
    blockErgebnisseLabel: 'Blöcke dieses Laufs',
    // Zusatzname (BAUPLAN 41): Im Bericht stehen Katalogname und Zusatzname
    // getrennt — angezeigt werden sie zusammen, gezählt wird der Blocktyp.
    blockMitZusatz: (block, zusatz) => (zusatz ? `${block} · ${zusatz}` : block),
    blockErgebnis: 'Letzter Lauf',
    blockZustaende: {
      erfolgreich: 'erledigt',
      fehlgeschlagen: 'fehlgeschlagen',
      'pruefung-bestanden': 'Prüfung bestanden',
      'pruefung-nicht-bestanden': 'Prüfung nicht bestanden',
      'startanleitung-fehlt': 'Startanleitung fehlte',
      // Rauchtest (BAUPLAN 35): Die App ließ sich nicht starten — kein
      // Fehlschlag des Bauers, aber auch kein sauberes „erledigt".
      'startanleitung-laeuft-nicht': 'Startanleitung lief nicht an',
      // Lieferschein (BAUPLAN 42): Der Block hat gearbeitet, sein Ergebnis aber
      // auch nach der Nachforderung nicht gemeldet — ohne Meldung gibt es keine
      // Lieferung an die folgenden Blöcke.
      'ohne-meldung': 'Ergebnis nicht gemeldet',
      // Vollständigkeit des Zuschnitts (BAUPLAN 44): Der Block hat gearbeitet
      // und gemeldet, aber nicht jede gemeldete Aufgabe bzw. nicht jedes
      // benannte Ziel bedient — er trägt in einem kurzen zweiten Anlauf nach.
      'zuschnitt-unvollstaendig': 'Zuschnitt unvollständig'
    },
    // Rauchtest am Block-Ergebnis (0.46.2): grün, rot mit Fehlercode und
    // Grund, oder übersprungen mit Grund — nicht nur „lief nicht an".
    rauchtestZeile: (r) => {
      const code = r.code == null ? 'ohne Fehlercode' : 'Code ' + r.code
      if (r.gruen === true) return 'Rauchtest: grün — die App läuft an.'
      if (r.gruen === false) return `Rauchtest: rot (${code})${r.zeile ? ' — ' + r.zeile : ''}`
      const gruende = {
        keine: 'keine Startanleitung vorhanden',
        appLaeuft: 'die App lief gerade im App-Tab',
        nichtsZuStarten: 'die Startanleitung hat weder Befehl noch Datei-Adresse',
        abgebrochen: 'der Lauf wurde gestoppt',
        portFremd: r.port
          ? `Port ${r.port} war belegt` +
            (r.besitzer ? ` von ${r.besitzer.name || 'PID ' + r.besitzer.pid} (PID ${r.besitzer.pid})` : '') +
            ', der nicht zu diesem Lauf gehört'
          : 'der Port war fremd belegt'
      }
      return `Rauchtest: übersprungen — ${gruende[r.grund] ?? r.grund ?? 'kein Urteil'}`
    },
    rauchtestGemessenAn: (bezeichnung) =>
      `Ein Rauchtest für die ganze Welle — bei Rot geht die Nachbesserung an ${bezeichnung}.`,
    rauchtestAusgabeZeigen: 'Ausgabe des Startversuchs zeigen',
    rauchtestAusgabeVerbergen: 'Ausgabe des Startversuchs verbergen',
    details: 'Einzelheiten',
    schliessen: 'Zuklappen',
    fehlertextLabel: 'Fehler',
    rechteFragenLabel: 'Rechte-Rückfragen',
    entscheidungenLabel: 'Folgen-Fragen',
    gespraechLabel: 'Gespräch',
    uebertraegeLabel: 'Überträge (Kontext war voll)',
    // Übertrags-Protokoll in Alltagssprache (BAUPLAN 11).
    uebertragZeile: (block, von, bis, nummer, grenze) =>
      `Der Kontext von „${block}" war zu etwa ${von}–${bis} % gefüllt. Der Agent hat den Zwischenstand notiert und übergeben; eine frische Session hat nahtlos weitergearbeitet (Übertrag ${nummer}${grenze != null ? ' von höchstens ' + grenze : ''}).`,
    uebertragOhneUebergabeZeile: (block) =>
      `Der Kontext von „${block}" war voll, aber die Übergabe ging verloren — die frische Session hat den Stand selbst aus Projektordner und Karten gelesen.`,
    fortgesetztHinweis: 'Dieser Lauf wurde nach einer Unterbrechung am letzten Sicherungspunkt fortgesetzt.',
    blockTokens: (tokens) => `Verbrauch: ${tokens.toLocaleString('de-DE')} Tokens`,
    // Karten-Vorschläge (Zweit-Audit D-03): Die gespeicherte Zählung des
    // Karten-Prüfers steht sichtbar im Bericht — nicht nur in Ticker-Zeilen.
    kartenVorschlaegeZeile: (z) =>
      `Karten-Vorschläge: ${z.uebernommen ?? 0} übernommen · ${z.bearbeitet ?? 0} bearbeitet · ${z.abgelehnt ?? 0} abgelehnt`,
    // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): der Vorschlag des
    // Sessionendes samt Empfehlung und Begründung im Bericht.
    naechsterLaufZeile: (v) =>
      `Vorschlag fürs nächste Paket: ${v.empfehlung}` +
      (v.karten?.length ? ` — Karten: ${v.karten.join(', ')}` : ' — ohne Karten') +
      (v.begruendung ? ` (${v.begruendung})` : ''),
    // Karten-Zuteilung (BAUPLAN 29): wie die Karten verteilt wurden — je
    // Block mit Kartenzahl, wie im Ticker.
    // Getrennt durch „ | ": Die Bezeichnung enthält seit BAUPLAN 44 selbst
    // Trennzeichen („Block 3 „Bauer · UI"").
    kartenZuteilungZeile: (eintraege) =>
      'Karten verteilt: ' + eintraege.map((e) => `${e.block} ${e.anzahl}`).join(' | '),
    // Lokale Helfer-KI (Wunsch Georg, 13.08.2026): ihr Anteil im Bericht.
    // Seit BAUPLAN 20 zählen auch die Vorreparatur-Versuche mit — samt der
    // Frage, wie viele davon die Nachprüfung bestanden haben.
    // Seit BAUPLAN 31 mit dem Modell — die Zahlen gehören zu einem Modell.
    lokaleHelferZeile: (l) =>
      `Lokale Helfer-KI${l.modell ? ` (${l.modell})` : ''}: ${l.recherchen} ${l.recherchen === 1 ? 'Recherche' : 'Recherchen'} · ` +
      `${l.schritte} ${l.schritte === 1 ? 'Schritt' : 'Schritte'} übernommen — ohne Kontingent` +
      (l.gescheitert > 0 ? ` (${l.gescheitert} davon gescheitert)` : '') +
      // Trefferquote (BAUPLAN 23): wie viele Recherche-Fazite der Agent
      // wirklich übernommen hat — nur gezählt, wenn der Schalter an war.
      ((l.recherchenUebernommen ?? 0) + (l.recherchenVerworfen ?? 0) > 0
        ? ` · Fazite: ${l.recherchenUebernommen ?? 0} übernommen, ${l.recherchenVerworfen ?? 0} verworfen`
        : '') +
      ((l.reparaturen ?? 0) > 0
        ? ` · ${l.reparaturen} Reparatur-${l.reparaturen === 1 ? 'Versuch' : 'Versuche'}, ${l.reparaturenGehalten ?? 0} ${(l.reparaturenGehalten ?? 0) === 1 ? 'hat' : 'haben'} gehalten`
        : '') +
      // Lokale Entwürfe (BAUPLAN 21): übernommen/verworfen ehrlich gezählt —
      // gescheiterte Entwurfs-Versuche extra, nicht bei den Recherchen.
      ((l.entwuerfe ?? 0) > 0
        ? ` · ${l.entwuerfe} ${l.entwuerfe === 1 ? 'Entwurf' : 'Entwürfe'} (${l.entwuerfeUebernommen ?? 0} übernommen, ${l.entwuerfeVerworfen ?? 0} verworfen${(l.entwuerfeGescheitert ?? 0) > 0 ? `, ${l.entwuerfeGescheitert} ${l.entwuerfeGescheitert === 1 ? 'Versuch' : 'Versuche'} gescheitert` : ''})`
        : (l.entwuerfeGescheitert ?? 0) > 0
          ? ` · ${l.entwuerfeGescheitert} Entwurfs-${l.entwuerfeGescheitert === 1 ? 'Versuch' : 'Versuche'} gescheitert`
          : '') +
      // Lokaler Bauer (BAUPLAN 22): lokal gehaltene und vom Agenten selbst
      // gebaute Teilstücke — daran sieht Georg, ob sich die Wette rechnet.
      ((l.teilstueckeGehalten ?? 0) + (l.teilstueckeVerworfen ?? 0) > 0 ||
      (l.teilstueckeGescheitert ?? 0) > 0
        ? ` · Teilstücke: ${l.teilstueckeGehalten ?? 0} lokal gebaut und gehalten, ${l.teilstueckeVerworfen ?? 0} hat der Agent selbst gebaut` +
          ((l.teilstueckeGescheitert ?? 0) > 0
            ? `, ${l.teilstueckeGescheitert} Bau-${l.teilstueckeGescheitert === 1 ? 'Versuch' : 'Versuche'} ohne Ergebnis`
            : '')
        : ''),
    // Token-Aufschlüsselung & theoretische API-Kosten (Wunsch Georg, 13.08.2026).
    aufschluesselungZeile: (a) =>
      `Eingabe ${a.eingabe.toLocaleString('de-DE')} · Ausgabe ${a.ausgabe.toLocaleString('de-DE')} · ` +
      `Cache gelesen ${a.cacheLesen.toLocaleString('de-DE')} · Cache geschrieben ${a.cacheSchreiben.toLocaleString('de-DE')}`,
    apiKosten: (usd) => `Theoretische API-Kosten: ${usd.toFixed(2).replace('.', ',')} $`,
    apiKostenAboZusatz: ' — bei dir im Abo enthalten, nur zur Einordnung',
    // Modell je Block (BAUPLAN 36): welches Modell diesen Anlauf gearbeitet hat
    // — bei Mischung mit Anteilen, sonst schlicht der Name.
    modellZeile: (modelle) =>
      'Modell: ' +
      (modelle.length === 1
        ? modelle[0].modell
        : modelle
            .map((m) => `${m.modell} ${Math.round(m.anteil * 100)} %`)
            .join(' · ')),
    modellUnbekannt:
      'Modell: nicht vermerkt — ein Lauf vor Bauschritt 36 oder ein Anlauf ganz ohne Motor (Tor ohne KI).',
    // Klasse und Denktiefe je Anlauf (0.48.1): was an der Karte gewählt war
    // und was der Motor als wirksame Denktiefe gemeldet hat.
    // Klassen ohne Denktiefe (Haiku, lokal) und lokale Kosten (BAUPLAN 49).
    denktiefeGiltNicht: 'gilt hier nicht',
    lokalKeineKosten: 'Kosten: keine — lief auf deiner lokalen KI, kein Kontingent, keine Dollar.',
    klasseZeile: (klasseName, denktiefeName, gemessen) =>
      `Klasse: ${klasseName}` +
      (denktiefeName ? ` · Denktiefe: ${denktiefeName}` : '') +
      (gemessen ? ` (wirksam: ${gemessen})` : ''),
    // Compaction sichtbar (BAUPLAN 36): eigener Abschnitt im Bericht.
    zusammenfassungenLabel: 'Zusammenfassungen des Motors',
    erlaubt: 'erlaubt',
    abgelehnt: 'abgelehnt',
    automatischErlaubt: 'automatisch erlaubt (Automodus)',
    verlaufLabel: 'Verlauf',
    // Nachlauf-Chat (BAUPLAN 27): der Chat-Verlauf als eigener Abschnitt.
    chatLabel: 'Nachlauf-Chat',
    chatRolleDu: 'Du',
    chatRolleKi: 'Chat',
    // Lokaler Prüfer mit Opus-Abnahme (BAUPLAN 50): beide Urteile nebeneinander
    // — das Tor-Nachspiel am Eintrag des lokalen Prüfers, die Abnahme am
    // Eintrag des Claude-Prüfers, und am lokalen Eintrag der Verweis zurück.
    // Urteile heißen wie im Lieferschein; alte Berichte tragen keines der
    // Felder, dann steht keine Zeile da.
    urteilNamen: { bestanden: 'bestanden', fehlgeschlagen: 'fehlgeschlagen' },
    torBestaetigungNamen: {
      gruen: 'grün — bestätigt das lokale „bestanden"',
      altlasten: 'nur Altlasten, keine neuen Fehler — bestätigt das lokale „bestanden"',
      rot: 'rot — das lokale „bestanden" wurde mechanisch auf „fehlgeschlagen" gedreht',
      keine: 'kein Prüfbefehl hinterlegt — keine mechanische Bestätigung möglich',
      abgebrochen: 'Nachspiel abgebrochen — das lokale Urteil bleibt unbestätigt'
    },
    torBestaetigungKurz: {
      gruen: 'grün',
      altlasten: 'Altlasten',
      rot: 'rot',
      keine: 'kein Prüfbefehl',
      abgebrochen: 'abgebrochen'
    },
    // Am Eintrag des lokalen Prüfers: sein eigenes Urteil (vor einer Drehung)
    // und was das Tor-Nachspiel ergab. Die Namen werden zur Laufzeit aus
    // texte.laufberichte gelesen — das Objekt steht dann längst.
    torBestaetigungZeile: (torBestaetigung, urteilLokal) =>
      (urteilLokal
        ? `Urteil des lokalen Prüfers: „${texte.laufberichte.urteilNamen[urteilLokal] ?? urteilLokal}" · `
        : '') +
      'Tor ohne KI (Prüfbefehl nachgespielt): ' +
      (texte.laufberichte.torBestaetigungNamen[torBestaetigung] ?? String(torBestaetigung)),
    // Am Eintrag des lokalen Prüfers: was die Abnahme dahinter gesagt hat.
    abnahmeZeile: (abnahme) =>
      `Abnahme durch „${abnahme.zusatz ? `${abnahme.block} · ${abnahme.zusatz}` : abnahme.block}": ` +
      (abnahme.widerspruch
        ? `widerspricht — die Abnahme urteilt „${texte.laufberichte.urteilNamen[abnahme.urteil] ?? abnahme.urteil}"`
        : `bestätigt das Urteil („${texte.laufberichte.urteilNamen[abnahme.urteil] ?? abnahme.urteil}")`),
    // Am Eintrag des Abnahme-Prüfers: je lokalem Partner beide Urteile.
    abnahmeFuerZeile: (a) =>
      `Abnahme für „${a.zusatz ? `${a.block} · ${a.zusatz}` : a.block}"` +
      (a.modell ? ` (${a.modell})` : '') +
      `: lokal „${texte.laufberichte.urteilNamen[a.urteilLokal] ?? a.urteilLokal}" · ` +
      `Abnahme „${texte.laufberichte.urteilNamen[a.urteilAbnahme] ?? a.urteilAbnahme}"` +
      (a.widerspruch ? ' — Widerspruch' : ' — einig') +
      (a.torBestaetigung
        ? ` · Tor: ${texte.laufberichte.torBestaetigungKurz[a.torBestaetigung] ?? a.torBestaetigung}`
        : '') +
      (a.durchTor ? ' · das Urteil der Abnahme kam aus ihrem eigenen Vor-Tor, nicht vom Agenten' : '')
  },
  // Etiketten-Bibliothek (SPEC §4.5, BAUPLAN 48): Etiketten werden bearbeitbar
  // wie Blöcke — Klappe in der Blockbibliothek, eigener Editor, Klartext-
  // Gegenlesen. Texte in Alltagssprache: Folgen, nicht Mechanik.
  etiketten: {
    klappeTitel: 'Etiketten',
    hinweis:
      'Etiketten verbinden Blöcke: Was ein Block unter einem Etikett liefert, bekommt der nächste, der es braucht. Ein Etikett ohne Felder ist nur ein Name — der Agent meldet dann frei. Mit Feldern weiß er genau, was hinein muss, und FlowForge weist eine unvollständige Meldung sichtbar zurück.',
    neuesEtikett: 'Neues Etikett',
    // Kurzform für den Klappen-Kopf (die Bibliotheksspalte ist schmal).
    neuKnopf: 'Neu',
    markeKatalog: 'Katalog',
    markeFest: 'feste Felder',
    markeUebung: 'Übung',
    markeMitFeldern: 'mit Feldern',
    markeAutomatisch: (quelle) =>
      quelle ? `automatisch, aus Block „${quelle}"` : 'automatisch angelegt',
    kopieren: 'Kopieren',
    bearbeiten: 'Bearbeiten',
    loeschen: 'Löschen',
    genutztVon: (namen) => `genutzt von: ${namen.join(', ')}`,
    ungenutzt: 'noch von keinem Block genutzt',
    loeschenBestaetigung: (name) => `Das Etikett „${name}" wirklich löschen?`,
    // Editor
    ueberschriftNeu: 'Neues Etikett',
    ueberschriftBearbeiten: 'Etikett bearbeiten',
    ueberschriftKopie: 'Etikett kopieren',
    // Vorbelegte Beschreibung einer Kopie — nennt Herkunft und wer das Original
    // im Katalog nutzt; Georg darf sie überschreiben.
    kopieBeschreibung: (vonName, blockNamen) =>
      `Eigene Fassung von „${vonName}" (Katalog` +
      (blockNamen?.length ? `, dort genutzt von ${blockNamen.join(', ')}` : '') +
      ').',
    kopieHinweis: (vonName) =>
      `Eine Kopie ist ein NEUES Etikett: Die Katalog-Blöcke kennen es nicht, es steckt nur an Blöcke, die genau diesen Namen nutzen. Die festen Felder des Katalogs bleiben beim Katalog — hier legst du eigene an. (Kopie von „${vonName}")`,
    kiFeld: 'Beschreib in deinen Worten, was unter diesem Etikett gemeldet werden soll',
    kiPlatzhalter:
      'z.B. Eine Marktanalyse: Zielgruppe in einem Satz, die wichtigsten Wettbewerber als Liste und eine Einschätzung des Preisniveaus',
    kiKnopf: 'KI schlägt Felder vor',
    kiLaeuft: 'Die KI schlägt Felder vor …',
    kiHinweis:
      'Die KI füllt Name, Beschreibung und Felder aus — du kannst danach alles von Hand ändern. Oder du füllst das Formular gleich selbst aus.',
    nameFeld: 'Name des Etiketts',
    namePlatzhalter: 'z.B. Marktanalyse',
    nameHinweis:
      'So heißt das Etikett an den Blöcken (braucht/liefert). Groß/Klein zählt nicht: „marktanalyse" und „Marktanalyse" sind dasselbe Etikett.',
    beschreibungFeld: 'Beschreibung (optional)',
    beschreibungHinweis:
      'Ein Satz, was unter diesem Etikett geliefert wird — steht in der Bibliothek und als Vorschlag im Block-Editor.',
    felderTitel: 'Felder (optional)',
    felderHinweis: (max) =>
      `Ohne Felder meldet der Agent frei (Fazit, Erledigt, Offen, Anmerkung und ein Freitext). Mit Feldern meldet er genau diese — Pflichtfelder müssen gefüllt sein, sonst weist FlowForge die Meldung zurück und er bessert nach. Höchstens ${max} Felder, keine Verschachtelung.`,
    feldBezeichnung: 'Bezeichnung',
    feldBezeichnungPlatzhalter: 'z.B. Zielgruppe',
    feldArt: 'Art',
    feldWerte: 'Auswahlwerte (durch Komma getrennt)',
    feldWertePlatzhalter: 'z.B. niedrig, mittel, hoch',
    feldPflicht: 'Pflicht',
    feldHinweis: 'Hinweis für den Agenten (optional)',
    feldHinweisPlatzhalter: 'z.B. In einem Satz: für wen das Produkt gedacht ist',
    feldEntfernen: 'Feld entfernen',
    feldHinzufuegen: '+ Feld',
    feldSchluesselAnzeige: (schluessel) => `Feldname im Werkzeug: ${schluessel}`,
    artNamen: {
      text: 'ein Satz',
      langtext: 'Text (mehrzeilig)',
      liste: 'Liste',
      auswahl: 'Auswahl'
    },
    vorschauTitel: 'So liest es der Agent',
    speichern: 'Etikett speichern',
    abbrechen: 'Abbrechen',
    // Klartext (etikettRegeln.etikettKlartext) — EINE Quelle für Editor-
    // Vorschau, Bibliothek und das Gegenlesen des Assistenten.
    klartext: {
      mitFeldern: (name, teile) =>
        `Wer „${name}" liefert, gibt an: ${teile.join(' · ')}. Dazu immer Fazit, Erledigt, Offen und eine Anmerkung.`,
      ohneFelder: (name) =>
        `Wer „${name}" liefert, meldet frei: Fazit, Erledigt, Offen, Anmerkung und einen Freitext.`,
      fest: (name, werkzeug) =>
        `Wer „${name}" liefert, meldet in den festen Feldern des Katalogs (Werkzeug ${werkzeug}).`,
      arten: {
        text: 'ein Satz',
        langtext: 'Text',
        liste: 'Liste',
        auswahl: (werte) => `Auswahl: ${werte.join(', ')}`
      },
      pflicht: 'Pflicht'
    },
    // Hinweise nach dem Block-Speichern (K2): einmalig, kein Gefahr-Knopf.
    hinweiseTitel: 'Beim Speichern des Blocks ist Folgendes passiert:'
  },
  // Harte Regeln für Etiketten (etikettRegeln.js, BAUPLAN 48) — durchgesetzt im
  // Hauptprozess, die Oberfläche zeigt die Sätze.
  etikettRegeln: {
    nameFehlt: 'Bitte gib dem Etikett einen Namen.',
    nameZuLang: (max) => `Der Name ist zu lang (höchstens ${max} Zeichen).`,
    nameKatalog: (name, fest = false) =>
      `„${name}" ist ein Etikett des Katalogs — das lässt sich nicht überschreiben, sonst brächen die Vorlagen still. ` +
      (fest ? 'Nimm einen anderen Namen.' : 'Kopiere es oder nimm einen anderen Namen.'),
    nameVergeben: (name) =>
      `Ein Etikett „${name}" gibt es schon (Groß/Klein zählt nicht). Bearbeite das vorhandene oder nimm einen anderen Namen.`,
    beschreibungZuLang: (max) => `Die Beschreibung ist zu lang (höchstens ${max} Zeichen).`,
    zuVieleFelder: (max) => `Höchstens ${max} Felder je Etikett — was darüber hinausgeht, gehört in die Anmerkung.`,
    feldBezeichnungFehlt: (nummer) => `Feld ${nummer} braucht eine Bezeichnung.`,
    feldBezeichnungZuLang: (bezeichnung, max) =>
      `Die Bezeichnung „${bezeichnung}" ist zu lang (höchstens ${max} Zeichen).`,
    feldArtUnbekannt: (bezeichnung, arten) =>
      `Das Feld „${bezeichnung}" hat keine gültige Art. Möglich ist: ${arten.join(', ')}.`,
    feldSchluesselLeer: (bezeichnung) =>
      `Aus der Bezeichnung „${bezeichnung}" lässt sich kein Feldname bilden — sie braucht mindestens einen Buchstaben.`,
    feldSchluesselReserviert: (bezeichnung, schluessel) =>
      `Das Feld „${bezeichnung}" hieße im Werkzeug „${schluessel}" — dieser Name ist schon der gemeinsame Rahmen jeder Meldung (Fazit, Erledigt, Offen, Anmerkung, Etikett, Inhalt). Nimm eine andere Bezeichnung.`,
    feldSchluesselDoppelt: (bezeichnung, schluessel) =>
      `Zwei Felder hießen im Werkzeug gleich („${schluessel}", bei „${bezeichnung}") — der Agent könnte sie nicht auseinanderhalten. Gib ihnen verschiedene Bezeichnungen.`,
    auswahlWerte: (bezeichnung, min, max) =>
      `Eine Auswahl „${bezeichnung}" braucht ${min} bis ${max} Werte, durch Komma getrennt.`,
    auswahlWertZuLang: (bezeichnung, max) =>
      `Ein Auswahlwert bei „${bezeichnung}" ist zu lang (höchstens ${max} Zeichen).`,
    feldHinweisZuLang: (bezeichnung, max) =>
      `Der Hinweis zu „${bezeichnung}" ist zu lang (höchstens ${max} Zeichen).`,
    fehlerWaehrendLauf: (projekt) =>
      `Im Projekt „${projekt}" läuft oder wartet gerade ein Workflow mit einem Block, der dieses Etikett nutzt. Warte, bis er fertig ist — dann kannst du Name oder Felder ändern.`,
    fehlerNochVerwendet: (namen) =>
      `Dieses Etikett nutzen noch diese Blöcke: ${namen.join(', ')}. Nimm es dort erst aus braucht/liefert — dann lässt es sich löschen.`,
    fehlerUnbekannt: 'Dieses Etikett gibt es nicht (mehr).',
    fehlerBeschreibungFehlt: 'Beschreib zuerst in ein paar Worten, was unter dem Etikett gemeldet werden soll.',
    fehlerKeinVorschlag:
      'Die KI hat keinen brauchbaren Vorschlag geliefert. Versuch es noch einmal — oder füll die Felder von Hand aus.',
    // Hinweise aus dem Block-Speichern (K2): Auto-Anlage und Schreibweise.
    hinweisNeuAngelegt: (name) =>
      `Etikett „${name}" wurde neu angelegt (ohne Felder — der Agent meldet frei). Du findest es in der Klappe „Etiketten".`,
    hinweisSchreibweise: (alt, neu) => `„${alt}" wurde zu „${neu}" — so heißt das Etikett schon.`
  },
  // KI-Assistent des Etikett-Editors (BAUPLAN 48): Beschreibung in
  // Alltagssprache → Name, Beschreibung, Felder.
  agentenEtikettAssistent: {
    auftrag: (beschreibung, name, arten, felderMax) =>
      'Du hilfst im Etikett-Editor von FlowForge, einer App, in der ein Nicht-Programmierer ' +
      'Coding-Workflows aus Blöcken baut. Ein Etikett ist der Name einer Übergabe zwischen ' +
      'Blöcken: Ein Block liefert sie, der nächste braucht sie. Ein Etikett kann Felder ' +
      'haben — dann meldet der KI-Agent des liefernden Blocks genau diese Felder über ein ' +
      'Werkzeug, und FlowForge weist eine unvollständige Meldung zurück. Der Nutzer hat ' +
      'beschrieben, was unter dem Etikett gemeldet werden soll — du füllst daraus das ' +
      'Formular aus.\n\n' +
      'Beschreibung des Nutzers:\n' +
      beschreibung +
      (name ? `\n\nVorhandener Name des Etiketts (behalte ihn, wenn er passt): ${name}` : '') +
      '\n\n' +
      'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Erklärtext und ohne ' +
      'Markdown-Zäune, mit genau diesen Feldern:\n' +
      '{"name": "...", "beschreibung": "...", "felder": [{"bezeichnung": "...", "art": "text", ' +
      '"werte": [], "pflicht": true, "hinweis": "..."}]}\n\n' +
      'Regeln:\n' +
      '- name: kurzer deutscher Name des Etiketts (höchstens 40 Zeichen), ein Hauptwort wie ' +
      '„Marktanalyse" oder „Testplan".\n' +
      '- beschreibung: ein Satz, was unter diesem Etikett geliefert wird (höchstens 200 Zeichen).\n' +
      `- felder: höchstens ${felderMax}, flach (keine Verschachtelung). Nur Felder, die der ` +
      'nächste Block wirklich braucht — Fazit, Erledigt, Offen und Anmerkung hat jede Meldung ' +
      'ohnehin, lege sie NICHT als Felder an. Lieber wenige klare Felder als viele.\n' +
      '- bezeichnung: Klartext für den Menschen (höchstens 60 Zeichen), z.B. „Zielgruppe".\n' +
      '- art: genau eine von ' +
      arten.map((a) => `"${a.schluessel}" (${a.name})`).join(', ') +
      '. "text" für einen Satz, "langtext" für mehrere Absätze, "liste" für Stichpunkte, ' +
      '"auswahl" für eine Einstufung mit festen Werten.\n' +
      '- werte: nur bei "auswahl" — 2 bis 12 kurze Werte (je höchstens 40 Zeichen), sonst [].\n' +
      '- pflicht: true, wenn der nächste Block ohne dieses Feld nicht arbeiten kann; sonst false.\n' +
      '- hinweis: ein Satz für den Agenten, was genau in das Feld gehört (höchstens 200 Zeichen); ' +
      'er wird die Feldbeschreibung im Werkzeug.'
  },
  // Lieferschein-Texte für eigene Etiketten mit Feldern (BAUPLAN 48) — eigene
  // Gruppe neben texte.lieferschein, damit kein Etikett-Name einen festen
  // Schlüssel dort trifft (ein Etikett „Eigen" träfe sonst werkzeuge.eigen).
  lieferscheinEtiketten: {
    werkzeugEigen: (name, klartext) =>
      `Meldet deine Lieferung „${name}" an FlowForge — Pflicht zum Abschluss deines Blocks. ` +
      klartext +
      ' Pflichtfelder müssen gefüllt sein; Auswahlfelder nehmen nur die genannten Werte.',
    auswahlBeschreibung: (werte) => `Auswahl: ${werte.join(', ')}.`,
    pflichtZusatz: ' Pflichtfeld.',
    auswahlUngueltig: (feld, werte) =>
      `Das Feld ${feld} nimmt nur diese Werte: ${werte.join(', ')}. Wähle genau einen davon.`,
    etikettOhneForm: (etikett) =>
      `Für „${etikett}" gibt es in FlowForge gerade keine Form mit Feldern — melde über melde_ergebnis.`
  }
}
