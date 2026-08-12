// Motor-Schnittstelle (SPEC §2): trennt FlowForge vom ausführenden KI-Agenten.
// Die restliche App kennt nur diesen Vertrag — welcher Motor dranhängt, ist ihr egal.
//
// Jeder Motor exportiert eine Funktion  starteMotorLauf(optionen)  mit:
//
//   optionen = {
//     projektPfad            Arbeitsordner; nur hier darf ohne Rückfrage geschrieben werden
//     auftrag                Arbeitsauftrag des Blocks (Klartext, Deutsch)
//     modus                  'abo' | 'api'
//     apiSchluessel          nur im API-Modus
//     ausgabenObergrenzeUsd  nur im API-Modus; der Motor bricht darüber selbst ab
//     nurLesen               Sperre „darf nur lesen" (SPEC §4.2): alles außer
//                            Lese-Werkzeugen wird hart abgelehnt, ohne Rückfrage
//     kontextFenster         optional: bekannte Fenstergröße aus früheren Sessions
//                            desselben Laufs (der Motor meldet die echte Größe erst
//                            am Session-Ende — so stimmt die Schwelle von Anfang an)
//     uebertrag              Automatischer Übertrag (SPEC §5): { aktiv, testModus, anweisung }.
//                            Läuft der Kontext über die Schwelle, unterbricht der Motor
//                            den Agenten, schickt ihm die anweisung (Karten aktualisieren,
//                            Übergabe schreiben) und endet mit zustand 'uebertrag' —
//                            der ergebnisText ist dann die Übergabe an die frische Session.
//
//   Jeder Motor stellt dem Agenten außerdem die Karten-Werkzeuge bereit
//   (kartenWerkzeuge.js): Karten lesen, anlegen, aktualisieren, erledigen —
//   mit denselben harten Regeln wie für Menschen (BAUPLAN 7). Erfolgreiche
//   Änderungen melden sich als Ereignis { art: 'karten', karten }.
//     aufEreignis(e)         e = { art: 'ticker', text }
//                              | { art: 'roh', zeile }
//                              | { art: 'verbrauch', verbrauch }
//     aufRechteFrage(frage)  frage = { beschreibung }; Promise<boolean> — erlaubt?
//   }
//
//   Rückgabe = {
//     fertig            Promise<{ zustand, fehlertext, fehlerArt, ergebnisText, verbrauch }>
//                       zustand: 'erfolgreich' | 'fehlgeschlagen'
//                              | 'sanft-gestoppt' | 'hart-abgebrochen' | 'uebertrag'
//                       fehlerArt (nur bei 'fehlgeschlagen'): 'kontingent' |
//                       'obergrenze' | 'anmeldung' | null — die Lauf-Verwaltung
//                       entscheidet daran z.B. über die Kontingent-Pause (SPEC §5)
//                       ergebnisText: Abschlusstext des Agenten — daraus liest
//                       FlowForge z.B. Prüfer-Urteile (PRUEFUNG: BESTANDEN/…)
//     sanftStoppen()    Motor unterbricht geordnet (Unterbrechungs-Funktion)
//     hartStoppen()     Prozessbaum sofort beenden
//   }
//
//   verbrauch = { tokens, kontextProzentVon, kontextProzentBis, kostenUsd }
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

const BAND_BREITE = 5 // Prozentpunkte

export function kontextBand(tokens, kontextFenster) {
  const fenster = kontextFenster > 0 ? kontextFenster : KONTEXT_FENSTER_STANDARD
  const prozent = Math.min(100, (tokens / fenster) * 100)
  const von = Math.min(95, Math.floor(prozent / BAND_BREITE) * BAND_BREITE)
  return { von, bis: von + BAND_BREITE }
}
