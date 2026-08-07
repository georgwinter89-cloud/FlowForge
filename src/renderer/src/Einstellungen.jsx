import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'

const t = texte.einstellungen

// Globale Einstellungen: Motor-Modus (Abo/API), API-Schlüssel, Ausgaben-Obergrenze.
export default function Einstellungen({ onSchliessen }) {
  const [modus, setModus] = useState('abo')
  const [apiSchluessel, setApiSchluessel] = useState('')
  const [obergrenze, setObergrenze] = useState(5)
  const [aboErlaubt, setAboErlaubt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    window.flowforge.einstellungenLaden().then((e) => {
      if (!e.ok) return
      setModus(e.einstellungen.motorModus)
      setApiSchluessel(e.einstellungen.apiSchluessel)
      setObergrenze(e.einstellungen.ausgabenObergrenzeUsd)
      setAboErlaubt(e.aboErlaubt)
      setGeladen(true)
    })
  }, [])

  async function speichern() {
    const ergebnis = await window.flowforge.einstellungenSpeichern({
      motorModus: modus,
      apiSchluessel,
      ausgabenObergrenzeUsd: Number(obergrenze)
    })
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    onSchliessen()
  }

  if (!geladen) return null

  return (
    <div className="dialog-schleier">
      <div className="dialog">
        <h2>{t.ueberschrift}</h2>
        <p className="bericht-abschnitt">{t.motorUeberschrift}</p>
        <div className="feld">
          <span>{t.modusFeld}</span>
          {aboErlaubt && (
            <label className="wahl-zeile">
              <input
                type="radio"
                name="modus"
                checked={modus === 'abo'}
                onChange={() => setModus('abo')}
              />
              <span>
                {t.modusAbo}
                <span className="feld-hinweis"> — {t.modusAboHinweis}</span>
              </span>
            </label>
          )}
          <label className="wahl-zeile">
            <input
              type="radio"
              name="modus"
              checked={modus === 'api'}
              onChange={() => setModus('api')}
            />
            <span>
              {t.modusApi}
              <span className="feld-hinweis"> — {t.modusApiHinweis}</span>
            </span>
          </label>
        </div>
        {modus === 'api' && (
          <>
            <label className="feld">
              <span>{t.apiSchluesselFeld}</span>
              <input
                type="password"
                placeholder={t.apiSchluesselPlatzhalter}
                value={apiSchluessel}
                onChange={(e) => setApiSchluessel(e.target.value)}
              />
            </label>
            <label className="feld">
              <span>{t.obergrenzeFeld}</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={obergrenze}
                onChange={(e) => setObergrenze(e.target.value)}
              />
              <span className="feld-hinweis">{t.obergrenzeHinweis}</span>
            </label>
          </>
        )}
        {fehler && <p className="fehlermeldung">{fehler}</p>}
        <div className="dialog-knoepfe">
          <button className="knopf-sekundaer" onClick={onSchliessen}>
            {t.abbrechen}
          </button>
          <button className="knopf-primaer" onClick={speichern}>
            {t.speichern}
          </button>
        </div>
      </div>
    </div>
  )
}
