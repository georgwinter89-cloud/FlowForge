import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'
import KartenFormular from './KartenFormular.jsx'
import Leinwand from './Leinwand.jsx'
import Blockbibliothek from './Blockbibliothek.jsx'

const t = texte.projektansicht
const tk = texte.karten

function Karte({ karte, onBearbeiten, onErledigt, onLoeschen }) {
  const istStatus = karte.sorte === 'status'
  const istAufgabe = karte.sorte === 'aufgabe'
  return (
    <div
      className={'karte karte-' + karte.sorte + (karte.erledigt ? ' karte-erledigt' : '')}
      // Kartenvorauswahl (SPEC §5): Karten lassen sich in den Lauf-Kontext auf
      // der Leinwand ziehen. Die Status-Karte ist ohnehin immer dabei.
      draggable={!istStatus}
      onDragStart={
        istStatus
          ? undefined
          : (e) => e.dataTransfer.setData('text/flowforge-karte', karte.id)
      }
    >
      <div className="karte-kopf">
        <span className="karte-sorte">{tk.sorten[karte.sorte]}</span>
        {istAufgabe && (
          <span className="karte-zustand">{karte.erledigt ? tk.erledigt : tk.offen}</span>
        )}
      </div>
      <p className="karte-titel">{karte.titel}</p>
      <p className="karte-text">{karte.text}</p>
      <div className="karte-knoepfe">
        {istAufgabe && (
          <button className="knopf-klein" onClick={() => onErledigt(karte)}>
            {karte.erledigt ? tk.wiederOeffnen : tk.erledigen}
          </button>
        )}
        <button className="knopf-klein" onClick={() => onBearbeiten(karte)}>
          {tk.bearbeiten}
        </button>
        {!istStatus && (
          <button className="knopf-klein" onClick={() => onLoeschen(karte)}>
            {tk.loeschen}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Projektansicht({ pfad, onZurueck }) {
  const [projekt, setProjekt] = useState(null)
  const [karten, setKarten] = useState([])
  const [fehler, setFehler] = useState('')
  const [filter, setFilter] = useState('alle')
  // false = zu, 'neu' = neue Karte, sonst die Karte, die bearbeitet wird
  const [formular, setFormular] = useState(false)

  function projektLaden() {
    window.flowforge.projektOeffnen(pfad).then((ergebnis) => {
      if (!ergebnis.ok) return setFehler(ergebnis.fehler)
      setProjekt(ergebnis.projekt)
      setKarten(ergebnis.karten)
    })
  }

  useEffect(projektLaden, [pfad])

  // Der Agent kann Karten mitten im Lauf anlegen/ändern (BAUPLAN 7) —
  // die Seitenleiste zieht sofort nach.
  useEffect(() => {
    return window.flowforge.aufLaufEreignis((ereignis) => {
      if (ereignis.projektPfad === pfad && ereignis.art === 'karten') setKarten(ereignis.karten)
    })
  }, [pfad])

  // Jede Kartenänderung liefert den neuen Gesamtstand zurück.
  function uebernehmen(ergebnis) {
    if (ergebnis.ok) {
      setKarten(ergebnis.karten)
      setFormular(false)
    }
    return ergebnis
  }

  async function speichern(eingabe) {
    const ergebnis =
      formular === 'neu'
        ? await window.flowforge.karteAnlegen(pfad, eingabe)
        : await window.flowforge.karteAendern(pfad, formular.id, eingabe)
    return uebernehmen(ergebnis)
  }

  async function erledigtWechseln(karte) {
    uebernehmen(await window.flowforge.karteErledigtSetzen(pfad, karte.id, !karte.erledigt))
  }

  async function loeschen(karte) {
    if (!window.confirm(tk.loeschenBestaetigung)) return
    uebernehmen(await window.flowforge.karteLoeschen(pfad, karte.id))
  }

  if (fehler) {
    return (
      <section className="projektansicht">
        <div className="ansicht-kopf">
          <button className="knopf-sekundaer" onClick={onZurueck}>
            ← {t.zurueck}
          </button>
        </div>
        <p className="fehlermeldung">{fehler}</p>
      </section>
    )
  }

  const statusKarte = karten.find((k) => k.sorte === 'status')
  const weitere = karten
    .filter((k) => k.sorte !== 'status')
    .filter((k) => filter === 'alle' || k.sorte === filter)
    .sort((a, b) => Number(a.erledigt === true) - Number(b.erledigt === true))

  return (
    <section className="projektansicht">
      <div className="ansicht-kopf">
        <button className="knopf-sekundaer" onClick={onZurueck}>
          ← {t.zurueck}
        </button>
        <h1>{projekt?.name}</h1>
      </div>
      <div className="drei-spalten">
        <aside className="spalte spalte-karten">
          <div className="spalten-kopf">
            <h2>{tk.ueberschrift}</h2>
            <button className="knopf-primaer knopf-klein" onClick={() => setFormular('neu')}>
              + {tk.neueKarte}
            </button>
          </div>
          <div className="filter-zeile">
            {['alle', 'aufgabe', 'entscheidung', 'wissen'].map((wert) => (
              <button
                key={wert}
                className={'filter-chip' + (filter === wert ? ' filter-aktiv' : '')}
                onClick={() => setFilter(wert)}
              >
                {wert === 'alle' ? tk.filterAlle : tk.sorten[wert]}
              </button>
            ))}
          </div>
          <div className="karten-liste">
            {statusKarte && (
              <Karte
                karte={statusKarte}
                onBearbeiten={setFormular}
                onErledigt={erledigtWechseln}
                onLoeschen={loeschen}
              />
            )}
            {weitere.map((karte) => (
              <Karte
                key={karte.id}
                karte={karte}
                onBearbeiten={setFormular}
                onErledigt={erledigtWechseln}
                onLoeschen={loeschen}
              />
            ))}
            {weitere.length === 0 && <p className="feld-hinweis">{tk.keineKarten}</p>}
          </div>
        </aside>
        <div className="spalte spalte-leinwand">
          <div className="spalten-kopf">
            <h2>{t.leinwandTitel}</h2>
          </div>
          {/* Nach einer Wiederherstellung kann sich karten.json geändert haben. */}
          <Leinwand pfad={pfad} karten={karten} onWiederhergestellt={projektLaden} />
        </div>
        <aside className="spalte spalte-bibliothek">
          <div className="spalten-kopf">
            <h2>{t.bibliothekTitel}</h2>
          </div>
          <Blockbibliothek />
        </aside>
      </div>
      {formular && (
        <KartenFormular
          karte={formular === 'neu' ? null : formular}
          onSpeichern={speichern}
          onAbbrechen={() => setFormular(false)}
        />
      )}
    </section>
  )
}
