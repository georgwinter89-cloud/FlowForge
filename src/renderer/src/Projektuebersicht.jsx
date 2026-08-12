import { useEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'

const t = texte.projektuebersicht
const tn = texte.neuesProjekt

// Zustand einer Kachel (SPEC §9, BAUPLAN 15): läuft / wartet auf Antwort /
// wartet in der Warteschlange — sonst der Ausgang des letzten Laufs.
function KachelZustand({ zustand }) {
  if (!zustand) return null
  if (zustand.laeuft || zustand.wartet) {
    return (
      <span className="kachel-marken">
        {zustand.brauchtAntwort ? (
          <span className="zustand-marke zustand-antwort">{t.kachelWartetAntwort}</span>
        ) : zustand.laeuft ? (
          <span className="zustand-marke zustand-aktiv">{t.kachelLaeuft}</span>
        ) : null}
        {zustand.wartet && (
          <span className="zustand-marke zustand-wartend">{t.kachelWarteschlange}</span>
        )}
      </span>
    )
  }
  if (!zustand.letzterLauf) return <span className="feld-hinweis">{t.kachelKeinLauf}</span>
  const zeit = new Date(zustand.letzterLauf.gestartetAm).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
  return (
    <span className="kachel-marken">
      <span className="feld-hinweis">{t.kachelLetzterLauf(zeit)}</span>
      <span className={'zustand-marke zustand-' + zustand.letzterLauf.zustand}>
        {texte.lauf.zustandLabels[zustand.letzterLauf.zustand] ?? zustand.letzterLauf.zustand}
      </span>
    </span>
  )
}

function NeuesProjektDialog({ onFertig, onAbbrechen }) {
  const [name, setName] = useState('')
  const [ablageort, setAblageort] = useState('')
  const [fehler, setFehler] = useState('')

  async function ordnerWaehlen() {
    const ergebnis = await window.flowforge.ablageortWaehlen()
    if (ergebnis.ok) setAblageort(ergebnis.pfad)
  }

  async function anlegen() {
    if (!name.trim()) return setFehler(tn.fehlerKeinName)
    if (!ablageort) return setFehler(tn.fehlerKeinOrt)
    const ergebnis = await window.flowforge.projektAnlegen(name, ablageort)
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    onFertig(ergebnis.pfad)
  }

  return (
    <div className="dialog-schleier">
      <div className="dialog">
        <h2>{tn.ueberschrift}</h2>
        <label className="feld">
          <span>{tn.nameFeld}</span>
          <input
            autoFocus
            value={name}
            placeholder={tn.namePlatzhalter}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="feld">
          <span>{tn.ablageortFeld}</span>
          <div className="ort-zeile">
            <button className="knopf-sekundaer" onClick={ordnerWaehlen}>
              {tn.ablageortWaehlen}
            </button>
            <span className="ort-pfad">{ablageort}</span>
          </div>
          <span className="feld-hinweis">{tn.ablageortHinweis}</span>
        </label>
        {fehler && <p className="fehlermeldung">{fehler}</p>}
        <div className="dialog-knoepfe">
          <button className="knopf-sekundaer" onClick={onAbbrechen}>
            {tn.abbrechen}
          </button>
          <button className="knopf-primaer" onClick={anlegen}>
            {tn.anlegen}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Projektuebersicht({ onOeffnen }) {
  const [projekte, setProjekte] = useState([])
  const [zustaende, setZustaende] = useState({})
  const [dialogOffen, setDialogOffen] = useState(false)
  // Für den Ereignis-Listener, der sonst mit dem Stand vom Mount arbeiten würde.
  const projekteRef = useRef([])

  async function zustaendeLaden(liste = projekteRef.current) {
    const pfade = liste.filter((p) => p.gefunden).map((p) => p.pfad)
    const ergebnis = await window.flowforge.projektZustaende(pfade)
    if (ergebnis.ok) setZustaende(ergebnis.zustaende)
  }

  async function laden() {
    const ergebnis = await window.flowforge.projekteLaden()
    if (!ergebnis.ok) return
    setProjekte(ergebnis.projekte)
    projekteRef.current = ergebnis.projekte
    zustaendeLaden(ergebnis.projekte)
  }

  useEffect(() => {
    laden()
    // Die Kacheln bleiben aktuell, während Läufe im Hintergrund weiterlaufen —
    // aber nur zustandsändernde Ereignisse zählen, nicht jede Ticker-Zeile.
    const relevant = new Set([
      'laeufe',
      'zustand',
      'frage',
      'frage-erledigt',
      'entscheidung',
      'entscheidung-erledigt',
      'mensch-frage',
      'mensch-frage-erledigt',
      'fertig'
    ])
    return window.flowforge.aufLaufEreignis((ereignis) => {
      if (relevant.has(ereignis.art)) zustaendeLaden()
    })
  }, [])

  async function vergessen(pfad) {
    await window.flowforge.projektVergessen(pfad)
    laden()
  }

  return (
    <section className="projektuebersicht">
      <div className="uebersicht-kopf">
        <h1>{t.ueberschrift}</h1>
        <button className="knopf-primaer" onClick={() => setDialogOffen(true)}>
          + {t.neuesProjekt}
        </button>
      </div>
      {projekte.length === 0 ? (
        <div className="leer-zustand">
          <p className="leer-titel">{t.leerHinweis}</p>
          <p className="leer-untertitel">{t.leerUntertitel}</p>
        </div>
      ) : (
        <div className="kachel-raster">
          {projekte.map((projekt) =>
            projekt.gefunden ? (
              <button
                key={projekt.pfad}
                className="projekt-kachel"
                onClick={() => onOeffnen(projekt.pfad)}
              >
                <span className="kachel-name">{projekt.name}</span>
                <span className="kachel-pfad">{projekt.pfad}</span>
                <KachelZustand zustand={zustaende[projekt.pfad]} />
              </button>
            ) : (
              <div key={projekt.pfad} className="projekt-kachel kachel-fehlt">
                <span className="kachel-name">{projekt.name}</span>
                <span className="kachel-pfad">{projekt.pfad}</span>
                <span className="kachel-warnung">{t.nichtGefunden}</span>
                <span className="feld-hinweis">{t.nichtGefundenHinweis}</span>
                <button className="knopf-sekundaer" onClick={() => vergessen(projekt.pfad)}>
                  {t.ausListeEntfernen}
                </button>
              </div>
            )
          )}
        </div>
      )}
      {dialogOffen && (
        <NeuesProjektDialog
          onAbbrechen={() => setDialogOffen(false)}
          onFertig={(pfad) => {
            setDialogOffen(false)
            onOeffnen(pfad)
          }}
        />
      )}
    </section>
  )
}
