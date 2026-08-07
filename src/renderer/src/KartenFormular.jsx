import { useState } from 'react'
import { texte } from '../../shared/texte.js'
import { TEXT_MAX } from '../../shared/kartenRegeln.js'

const t = texte.kartenFormular

// Formular für neue Karten und zum Bearbeiten. Die harte Prüfung passiert im
// Hauptprozess — hier gibt es nur den Zeichenzähler als Orientierung.
export default function KartenFormular({ karte, onSpeichern, onAbbrechen }) {
  const bearbeiten = Boolean(karte)
  const [sorte, setSorte] = useState(karte?.sorte ?? 'aufgabe')
  const [titel, setTitel] = useState(karte?.titel ?? '')
  const [text, setText] = useState(karte?.text ?? '')
  const [fehler, setFehler] = useState('')

  const uebrig = TEXT_MAX - text.trim().length
  const istStatus = karte?.sorte === 'status'

  async function speichern() {
    const ergebnis = await onSpeichern({ sorte, titel, text })
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
