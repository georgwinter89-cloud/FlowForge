import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'

const t = texte.einstellungen

// Globale Einstellungen: Motor-Modus (Abo/API), API-Schlüssel, Ausgaben-Obergrenze.
export default function Einstellungen({ onSchliessen }) {
  const [modus, setModus] = useState('abo')
  const [apiSchluessel, setApiSchluessel] = useState('')
  const [obergrenze, setObergrenze] = useState(5)
  const [rechteAutomatisch, setRechteAutomatisch] = useState(false)
  const [uebertragTest, setUebertragTest] = useState(false)
  const [lokaleHelferAktiv, setLokaleHelferAktiv] = useState(false)
  const [lokaleHelferModell, setLokaleHelferModell] = useState('')
  const [helferStatus, setHelferStatus] = useState(null)
  const [aboErlaubt, setAboErlaubt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    window.flowforge.einstellungenLaden().then((e) => {
      if (!e.ok) return
      setModus(e.einstellungen.motorModus)
      setApiSchluessel(e.einstellungen.apiSchluessel)
      setObergrenze(e.einstellungen.ausgabenObergrenzeUsd)
      setRechteAutomatisch(Boolean(e.einstellungen.rechteAutomatisch))
      setUebertragTest(Boolean(e.einstellungen.uebertragTest))
      setLokaleHelferAktiv(Boolean(e.einstellungen.lokaleHelferAktiv))
      setLokaleHelferModell(e.einstellungen.lokaleHelferModell ?? '')
      setAboErlaubt(e.aboErlaubt)
      setGeladen(true)
    })
  }, [])

  // Status der lokalen KI live anzeigen, sobald der Schalter an ist —
  // Georg sieht sofort, ob Ollama läuft und das Modell da ist.
  useEffect(() => {
    if (!lokaleHelferAktiv || !lokaleHelferModell.trim()) return setHelferStatus(null)
    let aktuell = true
    window.flowforge.lokaleHelferStatus(lokaleHelferModell.trim()).then((s) => {
      if (aktuell) setHelferStatus(s)
    })
    return () => {
      aktuell = false
    }
  }, [lokaleHelferAktiv, lokaleHelferModell])

  async function speichern() {
    const ergebnis = await window.flowforge.einstellungenSpeichern({
      motorModus: modus,
      apiSchluessel,
      ausgabenObergrenzeUsd: Number(obergrenze),
      rechteAutomatisch,
      uebertragTest,
      lokaleHelferAktiv,
      lokaleHelferModell
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
        <p className="bericht-abschnitt">{t.rechteUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="radio"
              name="rechte"
              checked={!rechteAutomatisch}
              onChange={() => setRechteAutomatisch(false)}
            />
            <span>
              {t.rechteFragen}
              <span className="feld-hinweis"> — {t.rechteFragenHinweis}</span>
            </span>
          </label>
          <label className="wahl-zeile">
            <input
              type="radio"
              name="rechte"
              checked={rechteAutomatisch}
              onChange={() => setRechteAutomatisch(true)}
            />
            <span>
              {t.rechteAutomatisch}
              <span className="feld-hinweis"> — {t.rechteAutomatischHinweis}</span>
            </span>
          </label>
        </div>
        <p className="bericht-abschnitt">{t.lokaleHelferUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="checkbox"
              checked={lokaleHelferAktiv}
              onChange={(e) => setLokaleHelferAktiv(e.target.checked)}
            />
            <span>
              {t.lokaleHelferAktiv}
              <span className="feld-hinweis"> — {t.lokaleHelferHinweis}</span>
            </span>
          </label>
          {lokaleHelferAktiv && (
            <label className="feld">
              <span>{t.lokaleHelferModell}</span>
              <input
                type="text"
                value={lokaleHelferModell}
                onChange={(e) => setLokaleHelferModell(e.target.value)}
              />
              {helferStatus && (
                <span className="feld-hinweis">
                  {helferStatus.erreichbar && helferStatus.modellDa
                    ? t.lokaleHelferStatusBereit(lokaleHelferModell.trim())
                    : helferStatus.erreichbar
                      ? t.lokaleHelferStatusKeinModell(lokaleHelferModell.trim())
                      : t.lokaleHelferStatusAus}
                </span>
              )}
            </label>
          )}
        </div>
        <p className="bericht-abschnitt">{t.uebertragUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="checkbox"
              checked={uebertragTest}
              onChange={(e) => setUebertragTest(e.target.checked)}
            />
            <span>
              {t.uebertragTest}
              <span className="feld-hinweis"> — {t.uebertragTestHinweis}</span>
            </span>
          </label>
        </div>
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
