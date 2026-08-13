// Motor-Schnittstelle (SPEC §2): trennt FlowForge vom ausführenden KI-Agenten.
// Die restliche App kennt nur diesen Vertrag — welcher Motor dranhängt, ist ihr egal.
//
// Eine Motor-Session pro Lauf (BAUPLAN 19): Jeder Motor exportiert eine
// Funktion  starteLaufMotor(optionen)  — sie öffnet EINE Session für den
// ganzen Lauf. Auf dem Hauptfaden sitzt ein Koordinator mit den engsten
// Rechten (nur delegieren); jeder Block läuft darin als frischer Agent ohne
// das Arbeitsgedächtnis der anderen Blöcke (SPEC §4.3).
//
//   optionen = {
//     projektPfad            Arbeitsordner; nur hier darf ohne Rückfrage geschrieben werden
//     modus                  'abo' | 'api'
//     apiSchluessel          nur im API-Modus
//     ausgabenObergrenzeUsd  nur im API-Modus; der Motor bricht darüber selbst ab
//     fortsetzen             optional: Kennung einer früheren Lauf-Session —
//                            der Motor setzt sie fort statt neu zu starten
//                            (Wiederaufnahme nach App-Neustart oder nach dem
//                            Tod des Session-Prozesses). Scheitert das, endet
//                            der erste Block mit 'fortsetzung-gescheitert',
//                            damit die Lauf-Verwaltung frisch startet.
//     kontextFenster         optional: bekannte Fenstergröße aus früheren Sessions
//                            (der Motor meldet die echte Größe erst am Turn-Ende —
//                            so stimmt die Übertrags-Schwelle von Anfang an)
//     aufEreignis(e)         e = { art: 'ticker', text }
//                              | { art: 'roh', zeile }
//                              | { art: 'verbrauch', verbrauch }
//     aufRechteFrage(frage)  frage = { beschreibung }; Promise<boolean> — erlaubt?
//     aufMenschFrage(daten)  Frage-an-den-Menschen-Werkzeug (SPEC §6)
//   }
//
//   Jeder Motor stellt den Agenten außerdem die Karten-Werkzeuge bereit
//   (kartenWerkzeuge.js): Karten lesen, anlegen, aktualisieren, erledigen —
//   mit denselben harten Regeln wie für Menschen (BAUPLAN 7). Erfolgreiche
//   Änderungen melden sich als Ereignis { art: 'karten', karten }.
//
//   Rückgabe = {
//     blockAusfuehren({ auftrag, blockName, nurLesen, darfPruefen, uebertrag })
//           Führt genau einen Block als frischen Agenten in der Lauf-Session
//           aus. Der Arbeitsauftrag wird beim Agent-Aufruf von FlowForge
//           selbst eingesetzt; die Sperren (nurLesen, Prüfmappen-Besitz)
//           gelten für den Agenten und seine Helfer — erkannt an der
//           Unteraufgaben-Kennung des Werkzeugaufrufs. uebertrag = { aktiv,
//           testModus, anweisung }: Läuft die Lauf-Session über die Schwelle,
//           wird unterbrochen; der ergebnisText ist dann die Übergabe an den
//           nächsten Anlauf, und die Session ist danach verbraucht (tot).
//           Promise<{ zustand, fehlertext, fehlerArt, ergebnisText, verbrauch,
//                     sessionKennung }>
//           zustand: 'erfolgreich' | 'fehlgeschlagen' | 'sanft-gestoppt'
//                  | 'hart-abgebrochen' | 'uebertrag' | 'fortsetzung-gescheitert'
//           fehlerArt (nur bei 'fehlgeschlagen'): 'kontingent' | 'obergrenze'
//                  | 'anmeldung' | 'ueberlastet' | null
//           ergebnisText: Fazit des Block-Agenten — daraus liest FlowForge
//                  z.B. Prüfer-Urteile (PRUEFUNG: BESTANDEN/…)
//     istTot()          Session nimmt keine Blöcke mehr an → neuen Motor
//                       starten (mit fortsetzen = sessionKennung)
//     sessionKennung    Kennung der Lauf-Session (für Laufstand/Wiederaufnahme)
//     tokens            Füllstand des Hauptfadens (für den Fortsetzungs-Wächter)
//     beenden()         Session geordnet schließen (Lauf-Ende)
//     sanftStoppen()    Motor unterbricht geordnet (Unterbrechungs-Funktion)
//     hartStoppen()     Prozessbaum sofort beenden
//   }
//
//   verbrauch = { tokens (Füllstand der Lauf-Session), blockZuwachs (Anteil
//   dieses Blocks am Hauptfaden), unterTokens (Verbrauch der Agenten dieses
//   Blocks), kontextProzentVon/Bis, kostenUsd und aufschluesselung (Anteil
//   dieses Blocks), kontextFenster, uebertragBand }
//   Der Kontext-Füllstand ist bewusst ein Toleranzbereich, kein Punktwert.

// Solange der Motor die echte Fenstergröße noch nicht gemeldet hat.
export const KONTEXT_FENSTER_STANDARD = 200000

// Automatischer Übertrag (SPEC §5): echte Schwelle als absoluter Füllstand.
export const UEBERTRAG_SCHWELLE_PROZENT = 85

// Test-Schalter „Übertrag schon bei 10 %" (BAUPLAN 11): Eine frische Session
// startet schon mit ~8–10 % Grundlast (Systemtext, Werkzeuge) — eine absolute
// 10-%-Schwelle würde sofort wieder feuern, ohne dass der Agent etwas schafft.
// Im Testmodus gilt darum: Startfüllstand + 10 Prozentpunkte.
export const UEBERTRAG_TEST_AUFSCHLAG_PUNKTE = 10

// Füllstands-Wächter der Session-Fortsetzung (BAUPLAN 16): Liegt die alte
// Session schon nahe der Übertrags-Schwelle, lohnt Fortsetzen nicht — die
// Wiederholung würde sofort wieder in den Übertrag laufen. Dann Kaltstart.
export const FORTSETZUNG_WAECHTER_PROZENT = UEBERTRAG_SCHWELLE_PROZENT - 10

const BAND_BREITE = 5 // Prozentpunkte

export function kontextBand(tokens, kontextFenster) {
  const fenster = kontextFenster > 0 ? kontextFenster : KONTEXT_FENSTER_STANDARD
  const prozent = Math.min(100, (tokens / fenster) * 100)
  const von = Math.min(95, Math.floor(prozent / BAND_BREITE) * BAND_BREITE)
  return { von, bis: von + BAND_BREITE }
}
