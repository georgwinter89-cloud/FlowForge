import { useCallback, useEffect, useRef, useState } from 'react'

// Einklapp-Zustände je Projekt (BAUPLAN 30): Karten-Gruppen, Themen und
// Bibliotheks-Klappen merken sich offen/zu — gespeichert im Datenordner je
// Projektpfad (main/klappen.js), nicht in projekt.json.
//
// useKlappen(pfad, standardZu) → [istOffen(schluessel), umschalten(schluessel)]
// Schlüssel sind freie Strings ('karten:erledigt', 'thema:Login', 'bib:uebung').
// standardZu = Schlüssel, die ohne gemerkten Zustand ZU sind; alles andere ist
// offen. Ohne pfad gilt nur der Standardzustand — nichts wird gespeichert.
export function useKlappen(pfad, standardZu = []) {
  const [zustaende, setZustaende] = useState({})
  const [geladen, setGeladen] = useState(false)
  // Als Ref, damit sich der Standard je Render ändern darf, ohne den Effekt
  // neu anzustoßen (Aufrufer geben gern ein frisches Array-Literal mit).
  const standardZuRef = useRef(standardZu)
  standardZuRef.current = standardZu

  useEffect(() => {
    let aktiv = true
    setGeladen(false)
    setZustaende({})
    if (!pfad || !window.flowforge?.klappenLaden) {
      setGeladen(true)
      return
    }
    window.flowforge.klappenLaden(pfad).then((ergebnis) => {
      if (!aktiv) return
      setZustaende(ergebnis?.ok && ergebnis.zustaende ? ergebnis.zustaende : {})
      setGeladen(true)
    })
    return () => {
      aktiv = false
    }
  }, [pfad])

  const istOffen = useCallback(
    (schluessel) => {
      if (typeof zustaende[schluessel] === 'boolean') return zustaende[schluessel]
      return !standardZuRef.current.includes(schluessel)
    },
    [zustaende]
  )

  // Aktueller Stand als Ref, damit umschalten außerhalb des State-Updaters
  // speichern kann (kein Nebeneffekt im Updater — StrictMode ruft den doppelt).
  const zustaendeRef = useRef(zustaende)
  zustaendeRef.current = zustaende

  const umschalten = useCallback(
    (schluessel) => {
      const alt = zustaendeRef.current
      const bisher =
        typeof alt[schluessel] === 'boolean'
          ? alt[schluessel]
          : !standardZuRef.current.includes(schluessel)
      const neu = { ...alt, [schluessel]: !bisher }
      zustaendeRef.current = neu
      setZustaende(neu)
      // Erst speichern, wenn der gemerkte Stand geladen ist — sonst
      // überschriebe ein früher Klick die Datei mit einem leeren Stand.
      if (pfad && geladen && window.flowforge?.klappenSpeichern)
        window.flowforge.klappenSpeichern(pfad, neu)
    },
    [pfad, geladen]
  )

  return [istOffen, umschalten]
}

// Ausklappbare Gruppe mit Kopfzeile (Pfeil ▸/▾, Titel, Anzahl) und optionalem
// Knopf-Slot rechts. Generisch — dieselbe Klappe nutzen Blockbibliothek und
// Karten-Seitenleiste. Klassen: .klappe, .klappe-kopf, .klappe-inhalt (stil.css).
export function Klappe({ titel, anzahl, offen, onUmschalten, rechts, children }) {
  return (
    <section className={'klappe' + (offen ? ' klappe-offen' : ' klappe-zu')}>
      <div className="klappe-kopf">
        <button
          type="button"
          className="klappe-schalter"
          aria-expanded={offen}
          onClick={onUmschalten}
        >
          <span className="klappe-pfeil" aria-hidden="true">
            {offen ? '▾' : '▸'}
          </span>
          <span className="klappe-titel">{titel}</span>
          {typeof anzahl === 'number' && <span className="klappe-anzahl">{anzahl}</span>}
        </button>
        {rechts && <div className="klappe-rechts">{rechts}</div>}
      </div>
      {offen && <div className="klappe-inhalt">{children}</div>}
    </section>
  )
}
