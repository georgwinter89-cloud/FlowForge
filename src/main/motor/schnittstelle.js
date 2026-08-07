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
//     aufEreignis(e)         e = { art: 'ticker', text }
//                              | { art: 'roh', zeile }
//                              | { art: 'verbrauch', verbrauch }
//     aufRechteFrage(frage)  frage = { beschreibung }; Promise<boolean> — erlaubt?
//   }
//
//   Rückgabe = {
//     fertig            Promise<{ zustand, fehlertext, ergebnisText, verbrauch }>
//                       zustand: 'erfolgreich' | 'fehlgeschlagen'
//                              | 'sanft-gestoppt' | 'hart-abgebrochen'
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

const BAND_BREITE = 5 // Prozentpunkte

export function kontextBand(tokens, kontextFenster) {
  const fenster = kontextFenster > 0 ? kontextFenster : KONTEXT_FENSTER_STANDARD
  const prozent = Math.min(100, (tokens / fenster) * 100)
  const von = Math.min(95, Math.floor(prozent / BAND_BREITE) * BAND_BREITE)
  return { von, bis: von + BAND_BREITE }
}
