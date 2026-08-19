import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'

const t = texte.einstellungen
const te = texte.erststart

// Erststart-Wahl (SPEC §2/§9, seit 0.46.4): Beim ersten Start entscheidet der
// Nutzer selbst, wie sich der Motor anmeldet — Abo-Login oder API-Schlüssel.
// Kein stiller Standard, kein „Abbrechen": ohne Wahl startet kein Motor
// (motorBereit in einstellungen.js). Die Wahltexte sind dieselben wie in den
// Einstellungen — auch der ehrliche Abrechnungs-Hinweis beim Abo.
export default function Erststart({ onFertig }) {
  const [einstellungen, setEinstellungen] = useState(null)
  const [aboErlaubt, setAboErlaubt] = useState(true)
  const [modus, setModus] = useState('')
  const [apiSchluessel, setApiSchluessel] = useState('')
  const [obergrenze, setObergrenze] = useState(5)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    window.flowforge.einstellungenLaden().then((e) => {
      if (!e.ok) return
      setEinstellungen(e.einstellungen)
      setAboErlaubt(e.aboErlaubt)
      setApiSchluessel(e.einstellungen.apiSchluessel ?? '')
      setObergrenze(e.einstellungen.ausgabenObergrenzeUsd ?? 5)
    })
  }, [])

  async function weiter() {
    if (!modus) return setFehler(t.fehlerModusFehlt)
    // Alle übrigen Einstellungen unverändert mitgeben — der Dialog entscheidet
    // nur den Motor-Modus.
    const ergebnis = await window.flowforge.einstellungenSpeichern({
      ...(einstellungen ?? {}),
      motorModus: modus,
      apiSchluessel,
      ausgabenObergrenzeUsd: Number(obergrenze)
    })
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    onFertig(ergebnis.einstellungen)
  }

  if (!einstellungen) return null

  return (
    <div className="dialog-schleier">
      <div className="dialog erststart">
        <h2>{te.ueberschrift}</h2>
        <p className="feld-hinweis erststart-einleitung">{te.einleitung}</p>
        <p className="bericht-abschnitt">{t.motorUeberschrift}</p>
        <div className="feld">
          <span>{t.modusFeld}</span>
          {aboErlaubt && (
            <label className="wahl-zeile">
              <input
                type="radio"
                name="erststart-modus"
                checked={modus === 'abo'}
                onChange={() => setModus('abo')}
              />
              <span>
                {t.modusAbo}
                <span className="feld-hinweis"> — {t.modusAboHinweis}</span>
                <span className="feld-hinweis"> {te.aboVoraussetzung}</span>
              </span>
            </label>
          )}
          <label className="wahl-zeile">
            <input
              type="radio"
              name="erststart-modus"
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
          <button className="knopf-primaer" onClick={weiter}>
            {te.weiter}
          </button>
        </div>
      </div>
    </div>
  )
}
