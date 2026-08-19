import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  LOKAL_FEIN_FELDER,
  LOKAL_FEIN_VORLAGEN,
  lokalFeinBereinigen,
  lokalFeinVorlageErkennen,
  lokalesModellName
} from '../../shared/lokalRegeln.js'

const t = texte.einstellungen

// Feineinstellungen der lokalen KI (BAUPLAN 49): Eingabegrenzen je Feld für
// die Zahlenfelder — dieselben Grenzen wie lokalFeinBereinigen im Hauptprozess
// (src/shared/lokalRegeln.js); leer = Ollama-Standard.
const LOKAL_FEIN_GRENZEN = {
  temperatur: { min: 0, max: 2, step: 0.05 },
  topP: { min: 0, max: 1, step: 0.01 },
  topK: { min: 0, max: 500, step: 1 },
  minP: { min: 0, max: 1, step: 0.01 },
  wiederholungsstrafe: { min: 0.5, max: 2, step: 0.05 },
  antwortlaenge: { min: 1, step: 1 },
  entwurfsTokens: { min: 0, max: 64, step: 1 }
}
const VORLAGEN_REIHENFOLGE = ['qwen-denken', 'qwen-coding', 'ollama-standard']

// Zahlen ↔ Text der Eingabefelder: null wird zum leeren Feld und zurück.
function feinAlsText(fein) {
  return Object.fromEntries(
    LOKAL_FEIN_FELDER.map((feld) => [feld, fein?.[feld] == null ? '' : String(fein[feld])])
  )
}
function feinAusText(felder) {
  return Object.fromEntries(
    LOKAL_FEIN_FELDER.map((feld) => {
      const roh = String(felder[feld] ?? '')
        .trim()
        .replace(',', '.')
      return [feld, roh === '' ? null : Number(roh)]
    })
  )
}

// Globale Einstellungen: Motor-Modus (Abo/API), API-Schlüssel, Ausgaben-Obergrenze.
export default function Einstellungen({ onSchliessen }) {
  // '' = noch nicht gewählt (Erststart-Wahl, 0.46.4) — dann ist kein Radio an.
  const [modus, setModus] = useState('')
  const [apiSchluessel, setApiSchluessel] = useState('')
  const [obergrenze, setObergrenze] = useState(5)
  const [rechteAutomatisch, setRechteAutomatisch] = useState(false)
  const [nurLesenBefehle, setNurLesenBefehle] = useState(false)
  const [unteraufgabenModell, setUnteraufgabenModell] = useState('sparsam')
  const [uebertragTest, setUebertragTest] = useState(false)
  const [lokaleHelferAktiv, setLokaleHelferAktiv] = useState(false)
  const [lokaleHelferQuote, setLokaleHelferQuote] = useState(true)
  const [lokaleHelferModell, setLokaleHelferModell] = useState('')
  const [lokaleHelferAdresse, setLokaleHelferAdresse] = useState('')
  const [lokaleHelferKontext, setLokaleHelferKontext] = useState(65536)
  // Lokale KI als Block-Agent (BAUPLAN 49): Häkchen + Feineinstellungen (als
  // Text je Feld, damit sich halb getippte Zahlen nicht sofort wegrunden).
  const [lokalBlockAgent, setLokalBlockAgent] = useState(false)
  const [lokalFeinText, setLokalFeinText] = useState(() =>
    feinAlsText(LOKAL_FEIN_VORLAGEN['ollama-standard'])
  )
  const [helferStatus, setHelferStatus] = useState(null)
  const [aboErlaubt, setAboErlaubt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    window.flowforge.einstellungenLaden().then((e) => {
      if (!e.ok) return
      setModus(e.einstellungen.motorModus ?? '')
      setApiSchluessel(e.einstellungen.apiSchluessel)
      setObergrenze(e.einstellungen.ausgabenObergrenzeUsd)
      setRechteAutomatisch(Boolean(e.einstellungen.rechteAutomatisch))
      setNurLesenBefehle(Boolean(e.einstellungen.nurLesenBefehle))
      setUnteraufgabenModell(
        e.einstellungen.unteraufgabenModell === 'wieBlock' ? 'wieBlock' : 'sparsam'
      )
      setUebertragTest(Boolean(e.einstellungen.uebertragTest))
      setLokaleHelferAktiv(Boolean(e.einstellungen.lokaleHelferAktiv))
      setLokaleHelferQuote(e.einstellungen.lokaleHelferQuote !== false)
      setLokaleHelferModell(e.einstellungen.lokaleHelferModell ?? '')
      setLokaleHelferAdresse(e.einstellungen.lokaleHelferAdresse ?? '')
      setLokaleHelferKontext(Number(e.einstellungen.lokaleHelferKontext) || 65536)
      setLokalBlockAgent(Boolean(e.einstellungen.lokalBlockAgent))
      setLokalFeinText(feinAlsText(lokalFeinBereinigen(e.einstellungen.lokalFein)))
      setAboErlaubt(e.aboErlaubt)
      setGeladen(true)
    })
  }, [])

  // Status der lokalen KI live anzeigen, sobald der Schalter an ist —
  // Georg sieht sofort, ob Ollama läuft und das Modell da ist.
  useEffect(() => {
    if (!lokaleHelferAktiv || !lokaleHelferModell.trim()) return setHelferStatus(null)
    let aktuell = true
    window.flowforge
      .lokaleHelferStatus(lokaleHelferModell.trim(), lokaleHelferAdresse.trim())
      .then((s) => {
        if (aktuell) setHelferStatus(s)
      })
    return () => {
      aktuell = false
    }
  }, [lokaleHelferAktiv, lokaleHelferModell, lokaleHelferAdresse])

  // Aktive Vorlage (Markierung der Knöpfe) und der Wert, der gespeichert
  // wird — beides aus denselben Feldern gerechnet.
  const lokalFein = feinAusText(lokalFeinText)
  const lokalFeinBereinigt = lokalFeinBereinigen(lokalFein)
  const aktiveVorlage = lokalFeinVorlageErkennen(lokalFeinBereinigt)

  function vorlageSetzen(schluessel) {
    setLokalFeinText(feinAlsText(LOKAL_FEIN_VORLAGEN[schluessel]))
  }

  function feinFeldSetzen(feld, wert) {
    setLokalFeinText((alt) => ({ ...alt, [feld]: wert }))
  }

  async function speichern() {
    // Ein Wert außerhalb der Grenzen würde im Hauptprozess still zu
    // „Ollama-Standard" — hier sagt FlowForge es lieber, bevor es speichert.
    for (const feld of LOKAL_FEIN_FELDER) {
      if (lokalFein[feld] != null && lokalFeinBereinigt[feld] == null)
        return setFehler(t.fehlerLokalFein(t.lokalBlockFeinFelder[feld]))
    }
    const ergebnis = await window.flowforge.einstellungenSpeichern({
      motorModus: modus,
      apiSchluessel,
      ausgabenObergrenzeUsd: Number(obergrenze),
      rechteAutomatisch,
      nurLesenBefehle,
      unteraufgabenModell,
      uebertragTest,
      lokaleHelferAktiv,
      lokaleHelferQuote,
      lokaleHelferModell,
      lokaleHelferAdresse,
      lokaleHelferKontext,
      lokalBlockAgent,
      lokalFein: lokalFeinBereinigt
    })
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    onSchliessen()
  }

  if (!geladen) return null

  return (
    <div className="dialog-schleier">
      <div className="dialog dialog-einstellungen">
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
          <label className="wahl-zeile">
            <input
              type="checkbox"
              checked={nurLesenBefehle}
              onChange={(e) => setNurLesenBefehle(e.target.checked)}
            />
            <span>
              {t.nurLesenBefehle}
              <span className="feld-hinweis"> — {t.nurLesenBefehleHinweis}</span>
            </span>
          </label>
        </div>
        {/* Unteraufgaben-Modell (BAUPLAN 37): Zuarbeit der Block-Agenten —
            der Motor-Zwilling der lokalen Helfer-KI. */}
        <p className="bericht-abschnitt">{t.unteraufgabenUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="radio"
              name="unteraufgaben"
              checked={unteraufgabenModell === 'sparsam'}
              onChange={() => setUnteraufgabenModell('sparsam')}
            />
            <span>
              {t.unteraufgabenSparsam}
              <span className="feld-hinweis"> — {t.unteraufgabenSparsamHinweis}</span>
            </span>
          </label>
          <label className="wahl-zeile">
            <input
              type="radio"
              name="unteraufgaben"
              checked={unteraufgabenModell === 'wieBlock'}
              onChange={() => setUnteraufgabenModell('wieBlock')}
            />
            <span>
              {t.unteraufgabenWieBlock}
              <span className="feld-hinweis"> — {t.unteraufgabenWieBlockHinweis}</span>
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
            <>
              <label className="wahl-zeile">
                <input
                  type="checkbox"
                  checked={lokaleHelferQuote}
                  onChange={(e) => setLokaleHelferQuote(e.target.checked)}
                />
                <span>
                  {t.lokaleHelferQuote}
                  <span className="feld-hinweis"> — {t.lokaleHelferQuoteHinweis}</span>
                </span>
              </label>
              <label className="feld">
                <span>{t.lokaleHelferAdresse}</span>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:11434"
                  value={lokaleHelferAdresse}
                  onChange={(e) => setLokaleHelferAdresse(e.target.value)}
                />
                <span className="feld-hinweis">{t.lokaleHelferAdresseHinweis}</span>
              </label>
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
                        ? t.lokaleHelferStatusKeinModell(lokaleHelferModell.trim()) +
                          (helferStatus.modelle?.length
                            ? ' ' + t.lokaleHelferStatusVorhandene(helferStatus.modelle)
                            : '')
                        : t.lokaleHelferStatusAus}
                  </span>
                )}
              </label>
              {/* Kontext-Fenster (seit 0.46.3): 32k / 64k / 128k — die
                  Werkzeug-Deckel der lokalen KI wachsen mit. */}
              <label className="feld">
                <span>{t.lokaleHelferKontext}</span>
                <select
                  value={lokaleHelferKontext}
                  onChange={(e) => setLokaleHelferKontext(Number(e.target.value))}
                >
                  {[32768, 65536, 131072].map((k) => (
                    <option key={k} value={k}>
                      {t.lokaleHelferKontextWahl(k)}
                    </option>
                  ))}
                </select>
                <span className="feld-hinweis">{t.lokaleHelferKontextHinweis}</span>
              </label>
            </>
          )}
        </div>
        {/* Lokale KI als Block-Agent (BAUPLAN 49): Häkchen nur bedienbar,
            wenn die Helfer-KI oben an ist — Modell, Adresse und Kontextfenster
            sind dieselben. Die Feineinstellungen werden zum abgeleiteten
            Ollama-Modell flowforge-<basis>; leer = Ollama-Standard. */}
        <p className="bericht-abschnitt">{t.lokalBlockUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="checkbox"
              disabled={!lokaleHelferAktiv}
              checked={lokalBlockAgent}
              onChange={(e) => setLokalBlockAgent(e.target.checked)}
            />
            <span>
              {t.lokalBlockAgent}
              <span className="feld-hinweis"> — {t.lokalBlockAgentHinweis}</span>
            </span>
          </label>
          {!lokaleHelferAktiv && <span className="feld-hinweis">{t.lokalBlockNurMitHelfer}</span>}
          {lokaleHelferAktiv && lokalBlockAgent && (
            <>
              <span className="feld-hinweis">
                {lokaleHelferModell.trim()
                  ? t.lokalBlockAbgeleitet(lokalesModellName(lokaleHelferModell.trim()))
                  : t.lokalBlockAbgeleitetOhneBasis}
              </span>
              <div className="feld">
                <span>{t.lokalBlockFeinTitel}</span>
                <span className="feld-hinweis">{t.lokalBlockFeinHinweis}</span>
              </div>
              <div className="feld">
                <span>{t.lokalBlockVorlagen}</span>
                <div className="filter-zeile">
                  {VORLAGEN_REIHENFOLGE.map((schluessel) => (
                    <button
                      key={schluessel}
                      type="button"
                      className={
                        'filter-chip' + (aktiveVorlage === schluessel ? ' filter-aktiv' : '')
                      }
                      onClick={() => vorlageSetzen(schluessel)}
                    >
                      {t.lokalBlockVorlageNamen[schluessel]}
                    </button>
                  ))}
                </div>
                <span className="feld-hinweis">{t.lokalBlockVorlagenHinweis}</span>
              </div>
              <div className="lokal-fein-raster">
                {LOKAL_FEIN_FELDER.map((feld) => (
                  <label key={feld} className="feld">
                    <span>{t.lokalBlockFeinFelder[feld]}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={LOKAL_FEIN_GRENZEN[feld].min}
                      max={LOKAL_FEIN_GRENZEN[feld].max}
                      step={LOKAL_FEIN_GRENZEN[feld].step}
                      value={lokalFeinText[feld]}
                      placeholder={t.lokalBlockFeinLeer}
                      onChange={(e) => feinFeldSetzen(feld, e.target.value)}
                    />
                    <span className="feld-hinweis">{t.lokalBlockFeinHinweise[feld]}</span>
                  </label>
                ))}
              </div>
              <span className="feld-hinweis">{t.lokalBlockDenkenHinweis}</span>
            </>
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
