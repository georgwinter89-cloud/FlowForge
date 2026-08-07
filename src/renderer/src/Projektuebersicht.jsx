import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'

const t = texte.projektuebersicht
const tn = texte.neuesProjekt

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
  const [dialogOffen, setDialogOffen] = useState(false)

  async function laden() {
    const ergebnis = await window.flowforge.projekteLaden()
    if (ergebnis.ok) setProjekte(ergebnis.projekte)
  }

  useEffect(() => {
    laden()
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
