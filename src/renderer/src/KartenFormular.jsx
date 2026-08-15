import { useState } from 'react'
import { texte } from '../../shared/texte.js'
import { TEXT_MAX, THEMA_MAX, THEMEN_SORTEN } from '../../shared/kartenRegeln.js'

const t = texte.kartenFormular

// Formular für neue Karten und zum Bearbeiten. Die harte Prüfung passiert im
// Hauptprozess — hier gibt es nur den Zeichenzähler als Orientierung.
// Themen (BAUPLAN 30): Pflicht beim Anlegen; beim Bearbeiten alter Karten ohne
// Thema bleibt das Feld optional. themen = vorhandene Themen als Vorschläge.
export default function KartenFormular({ karte, themen = [], onSpeichern, onAbbrechen }) {
  const bearbeiten = Boolean(karte)
  const [sorte, setSorte] = useState(karte?.sorte ?? 'aufgabe')
  const [titel, setTitel] = useState(karte?.titel ?? '')
  const [text, setText] = useState(karte?.text ?? '')
  const [thema, setThema] = useState(karte?.thema ?? '')
  const [fehler, setFehler] = useState('')

  const uebrig = TEXT_MAX - text.trim().length
  const istStatus = karte?.sorte === 'status'
  const mitThema = THEMEN_SORTEN.includes(sorte)
  const themaPflicht = !bearbeiten || Boolean(karte?.thema)

  async function speichern() {
    const ergebnis = await onSpeichern({ sorte, titel, text, ...(mitThema ? { thema } : {}) })
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler)
  }

  return (
    <div className="dialog-schleier">
      <div className="dialog">
        <h2>{bearbeiten ? t.ueberschriftBearbeiten : t.ueberschriftNeu}</h2>
        {!bearbeiten && (
          <label className="feld">
            <span>{t.sorteFeld}</span>
            <select value={sorte} onChange={(e) => setSorte(e.target.value)}>
              <option value="aufgabe">{texte.karten.sorten.aufgabe}</option>
              <option value="entscheidung">{texte.karten.sorten.entscheidung}</option>
              <option value="wissen">{texte.karten.sorten.wissen}</option>
            </select>
          </label>
        )}
        {!istStatus && (
          <label className="feld">
            <span>{t.titelFeld}</span>
            <input autoFocus value={titel} onChange={(e) => setTitel(e.target.value)} />
          </label>
        )}
        {mitThema && (
          <label className="feld">
            <span>{themaPflicht ? t.themaFeld : t.themaFeldOptional}</span>
            <input
              list="karten-formular-themen"
              maxLength={THEMA_MAX}
              placeholder={t.themaPlatzhalter}
              value={thema}
              onChange={(e) => setThema(e.target.value)}
            />
            <datalist id="karten-formular-themen">
              {themen.map((eintrag) => (
                <option key={eintrag} value={eintrag} />
              ))}
            </datalist>
            <span className="feld-hinweis">
              {themen.length ? t.themaHinweis(themen) : t.themaHinweisLeer}
            </span>
          </label>
        )}
        <label className="feld">
          <span>{t.textFeld}</span>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          <span className={'feld-hinweis' + (uebrig < 0 ? ' zaehler-rot' : '')}>
            {uebrig >= 0 ? t.zeichenUebrig(uebrig) : t.zeichenZuViel(-uebrig)}
          </span>
        </label>
        {fehler && <p className="fehlermeldung">{fehler}</p>}
        <div className="dialog-knoepfe">
          <button className="knopf-sekundaer" onClick={onAbbrechen}>
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
