import { useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  ETIKETT_NAME_MAX,
  ETIKETT_BESCHREIBUNG_MAX,
  FELDER_MAX,
  FELD_BEZEICHNUNG_MAX,
  FELD_HINWEIS_MAX,
  FELD_ARTEN,
  feldSchluesselBereinigen,
  auswahlWerteBereinigen,
  etikettKlartext
} from '../../shared/etikettRegeln.js'

const t = texte.etiketten
const tf = texte.kartenFormular

function Zaehler({ wert, max }) {
  const uebrig = max - wert.trim().length
  return (
    <span className={'feld-hinweis' + (uebrig < 0 ? ' zaehler-rot' : '')}>
      {uebrig >= 0 ? tf.zeichenUebrig(uebrig) : tf.zeichenZuViel(-uebrig)}
    </span>
  )
}

// Ein Feld im Formular → die Form, wie der Hauptprozess sie prüft: Schlüssel
// eingefroren, sobald das Feld einmal gespeichert war (er ist der Name im
// Werkzeug); für neue Felder live aus der Bezeichnung abgeleitet. Auswahlwerte
// kommen komma-getrennt aus dem Eingabefeld.
function feldZurForm(feld) {
  return {
    schluessel: feld.schluessel || feldSchluesselBereinigen(feld.bezeichnung),
    bezeichnung: feld.bezeichnung,
    art: feld.art,
    werte: feld.art === 'auswahl' ? auswahlWerteBereinigen(feld.werteText) : [],
    pflicht: Boolean(feld.pflicht),
    hinweis: feld.hinweis
  }
}

// Gespeicherte Felder → Formularzeilen (Auswahlwerte als Text).
function felderInsFormular(felder) {
  return (Array.isArray(felder) ? felder : []).map((feld, i) => ({
    key: 'f' + i + '-' + (feld.schluessel ?? ''),
    schluessel: feld.schluessel ?? '',
    bezeichnung: feld.bezeichnung ?? '',
    art: FELD_ARTEN.includes(feld.art) ? feld.art : 'text',
    werteText: Array.isArray(feld.werte) ? feld.werte.join(', ') : '',
    pflicht: Boolean(feld.pflicht),
    hinweis: feld.hinweis ?? ''
  }))
}

let zaehlerNeu = 0
function neuesFeld() {
  zaehlerNeu++
  return { key: 'neu' + zaehlerNeu, schluessel: '', bezeichnung: '', art: 'text', werteText: '', pflicht: false, hinweis: '' }
}

// Etikett-Editor (SPEC §4.5, BAUPLAN 48): ein Dialog im Stil des Block-
// Editors, aber ohne Stepper — KI-Feld, Name, Beschreibung, Felder-Liste und
// das Live-Gegenlesen „So liest es der Agent" (etikettKlartext: dieselbe
// Fassung, die der Agent als Werkzeug-Beschreibung bekommt). Bearbeiten und
// Kopieren nutzen denselben Dialog mit vorbefüllten Feldern; die harte Prüfung
// passiert im Hauptprozess (eigeneEtiketten.js).
// `etikett`: null = neu, sonst das Etikett (mit id = bearbeiten, ohne id =
// Kopie). `kopieVon`: Name des Katalog-Etiketts, von dem kopiert wird (K9).
export default function EtikettEditor({ etikett, kopieVon = null, onSpeichern, onAbbrechen }) {
  const bearbeiten = Boolean(etikett?.id)
  const [wunsch, setWunsch] = useState('')
  const [kiLaeuft, setKiLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [werte, setWerte] = useState({
    name: etikett?.name ?? '',
    beschreibung: etikett?.beschreibung ?? '',
    felder: felderInsFormular(etikett?.felder)
  })

  function setzen(feld, wert) {
    setWerte((alt) => ({ ...alt, [feld]: wert }))
  }

  function feldAendern(index, aenderung) {
    setWerte((alt) => ({
      ...alt,
      felder: alt.felder.map((f, i) => (i === index ? { ...f, ...aenderung } : f))
    }))
  }

  function feldEntfernen(index) {
    setWerte((alt) => ({ ...alt, felder: alt.felder.filter((_, i) => i !== index) }))
  }

  function feldHinzufuegen() {
    if (werte.felder.length >= FELDER_MAX) return
    setWerte((alt) => ({ ...alt, felder: [...alt.felder, neuesFeld()] }))
  }

  async function kiAusfuellen() {
    if (kiLaeuft) return
    setFehler('')
    setKiLaeuft(true)
    const ergebnis = await window.flowforge.etikettAssistent(wunsch, werte.name)
    setKiLaeuft(false)
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    // Der Vorschlag ersetzt Name, Beschreibung und Felder — alles bleibt von
    // Hand änderbar. Beim Bearbeiten bleibt der Name stehen, wenn die KI keinen
    // liefert.
    setWerte({
      name: ergebnis.vorschlag.name || werte.name,
      beschreibung: ergebnis.vorschlag.beschreibung,
      felder: felderInsFormular(ergebnis.vorschlag.felder)
    })
  }

  async function speichern() {
    const daten = {
      name: werte.name,
      beschreibung: werte.beschreibung,
      felder: werte.felder.map(feldZurForm)
    }
    if (bearbeiten) {
      daten.id = etikett.id
      // Das bisherige Werkzeug mitgeben, damit es erhalten bleibt (K13).
      daten.werkzeug = etikett.werkzeug ?? null
    }
    const ergebnis = await onSpeichern(daten)
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler)
  }

  const vorschau = etikettKlartext({ name: werte.name, felder: werte.felder.map(feldZurForm) })
  const ueberschrift = bearbeiten
    ? t.ueberschriftBearbeiten
    : kopieVon
      ? t.ueberschriftKopie
      : t.ueberschriftNeu

  return (
    <div className="dialog-schleier">
      <div className="dialog dialog-breit dialog-editor etikett-editor">
        <h2>{ueberschrift}</h2>
        {kopieVon && <p className="feld-hinweis etikett-kopie-hinweis">{t.kopieHinweis(kopieVon)}</p>}

        <label className="feld">
          <span>{t.kiFeld}</span>
          <textarea
            autoFocus={!bearbeiten}
            rows={2}
            value={wunsch}
            placeholder={t.kiPlatzhalter}
            onChange={(e) => setWunsch(e.target.value)}
          />
          <span className="feld-hinweis">{t.kiHinweis}</span>
        </label>
        <div className="dialog-knoepfe knoepfe-links">
          <button className="knopf-sekundaer" disabled={kiLaeuft} onClick={kiAusfuellen}>
            {kiLaeuft ? t.kiLaeuft : '✨ ' + t.kiKnopf}
          </button>
        </div>

        <div className="feld-nebeneinander">
          <label className="feld">
            <span>{t.nameFeld}</span>
            <input
              value={werte.name}
              placeholder={t.namePlatzhalter}
              onChange={(e) => setzen('name', e.target.value)}
            />
            <span className="feld-hinweis">{t.nameHinweis}</span>
            <Zaehler wert={werte.name} max={ETIKETT_NAME_MAX} />
          </label>
        </div>
        <label className="feld">
          <span>{t.beschreibungFeld}</span>
          <input
            value={werte.beschreibung}
            onChange={(e) => setzen('beschreibung', e.target.value)}
          />
          <span className="feld-hinweis">{t.beschreibungHinweis}</span>
          <Zaehler wert={werte.beschreibung} max={ETIKETT_BESCHREIBUNG_MAX} />
        </label>

        {/* Felder (≤ FELDER_MAX): je Zeile Bezeichnung, Art, Werte (nur bei
            Auswahl), Pflicht, Hinweis, × — „+ Feld" unten. */}
        <div className="feld">
          <span>{t.felderTitel}</span>
          <span className="feld-hinweis">{t.felderHinweis(FELDER_MAX)}</span>
          <div className="etikett-felder">
            {werte.felder.map((feld, index) => {
              const schluessel = feld.schluessel || feldSchluesselBereinigen(feld.bezeichnung)
              return (
                <div className="etikett-feld-zeile" key={feld.key}>
                  <div className="etikett-feld-kopf">
                    <label className="feld etikett-feld-bezeichnung">
                      <span>{t.feldBezeichnung}</span>
                      <input
                        value={feld.bezeichnung}
                        maxLength={FELD_BEZEICHNUNG_MAX}
                        placeholder={t.feldBezeichnungPlatzhalter}
                        onChange={(e) => feldAendern(index, { bezeichnung: e.target.value })}
                      />
                    </label>
                    <label className="feld etikett-feld-art">
                      <span>{t.feldArt}</span>
                      <select
                        value={feld.art}
                        onChange={(e) => feldAendern(index, { art: e.target.value })}
                      >
                        {FELD_ARTEN.map((art) => (
                          <option key={art} value={art}>
                            {t.artNamen[art]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="feld feld-schalter etikett-feld-pflicht">
                      <input
                        type="checkbox"
                        checked={feld.pflicht}
                        onChange={(e) => feldAendern(index, { pflicht: e.target.checked })}
                      />
                      <span>{t.feldPflicht}</span>
                    </label>
                    <button
                      type="button"
                      className="knopf-klein etikett-feld-entfernen"
                      title={t.feldEntfernen}
                      onClick={() => feldEntfernen(index)}
                    >
                      ×
                    </button>
                  </div>
                  {feld.art === 'auswahl' && (
                    <label className="feld">
                      <span>{t.feldWerte}</span>
                      <input
                        value={feld.werteText}
                        placeholder={t.feldWertePlatzhalter}
                        onChange={(e) => feldAendern(index, { werteText: e.target.value })}
                      />
                    </label>
                  )}
                  <label className="feld">
                    <span>{t.feldHinweis}</span>
                    <input
                      value={feld.hinweis}
                      maxLength={FELD_HINWEIS_MAX}
                      placeholder={t.feldHinweisPlatzhalter}
                      onChange={(e) => feldAendern(index, { hinweis: e.target.value })}
                    />
                  </label>
                  {schluessel && (
                    <span className="feld-hinweis etikett-feld-schluessel">
                      {t.feldSchluesselAnzeige(schluessel)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="dialog-knoepfe knoepfe-links">
            <button
              type="button"
              className="knopf-sekundaer knopf-klein"
              disabled={werte.felder.length >= FELDER_MAX}
              onClick={feldHinzufuegen}
            >
              {t.feldHinzufuegen}
            </button>
          </div>
        </div>

        {/* Live-Gegenlesen: genau der Satz, den der Agent als Werkzeug-
            Beschreibung liest — eine Quelle (etikettKlartext). */}
        <div className="etikett-vorschau">
          <span className="vorschau-label">{t.vorschauTitel}</span>
          <p className="etikett-klartext">{vorschau}</p>
        </div>

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
