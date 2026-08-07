import { useEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'
import { UEBUNGS_WORKFLOWS } from '../../shared/uebungsWorkflows.js'

const t = texte.lauf
const tf = texte.rechteFrage
const tb = texte.laufberichte

function VerbrauchZeile({ verbrauch, modus }) {
  if (!verbrauch) return null
  const teile = [
    t.verbrauchKontext(verbrauch.kontextProzentVon, verbrauch.kontextProzentBis),
    t.verbrauchTokens(verbrauch.tokens)
  ]
  if (verbrauch.kostenUsd != null)
    teile.push(modus === 'abo' ? t.verbrauchKostenAbo : t.verbrauchKosten(verbrauch.kostenUsd))
  return <p className="verbrauch-zeile">{teile.join(' · ')}</p>
}

function ZustandsMarke({ zustand }) {
  return (
    <span className={'zustand-marke zustand-' + zustand}>
      {t.zustandLabels[zustand] ?? zustand}
    </span>
  )
}

function Laufbericht({ bericht }) {
  const [offen, setOffen] = useState(false)
  const zeit = new Date(bericht.gestartetAm).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
  return (
    <div className="bericht">
      <button className="bericht-kopf" onClick={() => setOffen(!offen)}>
        <span>
          {zeit} · {bericht.workflow}
        </span>
        <ZustandsMarke zustand={bericht.zustand} />
      </button>
      {offen && (
        <div className="bericht-details">
          <VerbrauchZeile verbrauch={bericht.verbrauch} modus={bericht.modus} />
          {bericht.fehlertext && (
            <p className="fehlermeldung">
              {tb.fehlertextLabel}: {bericht.fehlertext}
            </p>
          )}
          {bericht.rechteFragen.length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.rechteFragenLabel}</p>
              {bericht.rechteFragen.map((frage, i) => (
                <p key={i} className="bericht-zeile">
                  {frage.beschreibung} — <strong>{frage.erlaubt ? tb.erlaubt : tb.abgelehnt}</strong>
                </p>
              ))}
            </div>
          )}
          <p className="bericht-abschnitt">{tb.verlaufLabel}</p>
          {bericht.ticker.map((zeile, i) => (
            <p key={i} className="bericht-zeile">
              {new Date(zeile.zeit).toLocaleTimeString('de-DE')} — {zeile.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Leinwand({ pfad }) {
  // zustand: 'bereit' | 'laeuft' | 'fertig'
  const [zustand, setZustand] = useState('bereit')
  const [blockName, setBlockName] = useState('')
  const [ticker, setTicker] = useState([])
  const [roh, setRoh] = useState([])
  const [rohOffen, setRohOffen] = useState(false)
  const [verbrauch, setVerbrauch] = useState(null)
  const [frage, setFrage] = useState(null)
  const [ergebnis, setErgebnis] = useState(null)
  const [fehler, setFehler] = useState('')
  const [berichte, setBerichte] = useState([])
  const [modus, setModus] = useState('abo')
  const tickerEnde = useRef(null)

  function berichteLaden() {
    window.flowforge.laufberichteLaden(pfad).then((e) => e.ok && setBerichte(e.berichte))
  }

  useEffect(() => {
    berichteLaden()
    window.flowforge.einstellungenLaden().then((e) => e.ok && setModus(e.einstellungen.motorModus))
    window.flowforge.laufZustand(pfad).then((e) => {
      if (e.ok && e.aktiv) setZustand('laeuft')
    })
    const abmelden = window.flowforge.aufLaufEreignis((ereignis) => {
      if (ereignis.projektPfad !== pfad) return
      if (ereignis.art === 'zustand' && ereignis.zustand === 'laeuft') {
        setZustand('laeuft')
        setBlockName(ereignis.blockName)
      }
      if (ereignis.art === 'ticker')
        setTicker((alt) => [...alt, { zeit: new Date(), text: ereignis.text }])
      if (ereignis.art === 'roh') setRoh((alt) => [...alt, ereignis.zeile])
      if (ereignis.art === 'verbrauch') setVerbrauch(ereignis.verbrauch)
      if (ereignis.art === 'frage')
        setFrage({ frageId: ereignis.frageId, beschreibung: ereignis.beschreibung })
      if (ereignis.art === 'frage-erledigt') setFrage(null)
      if (ereignis.art === 'fertig') {
        setZustand('fertig')
        setErgebnis({ zustand: ereignis.zustand, fehlertext: ereignis.fehlertext })
        setFrage(null)
        berichteLaden()
      }
    })
    return abmelden
  }, [pfad])

  useEffect(() => {
    tickerEnde.current?.scrollIntoView({ block: 'nearest' })
  }, [ticker])

  async function starten(workflow) {
    setFehler('')
    setTicker([])
    setRoh([])
    setVerbrauch(null)
    setErgebnis(null)
    const antwort = await window.flowforge.laufStarten(pfad, workflow.id)
    if (!antwort.ok) setFehler(antwort.fehler)
  }

  async function hartStoppen() {
    if (!window.confirm(t.hartStoppenBestaetigung)) return
    await window.flowforge.laufHartStoppen(pfad)
  }

  function fertigText(z) {
    if (z === 'erfolgreich') return t.fertigErfolgreich
    if (z === 'sanft-gestoppt') return t.fertigSanft
    if (z === 'hart-abgebrochen') return t.fertigHart
    return t.fertigFehlgeschlagen
  }

  return (
    <div className="leinwand">
      {zustand === 'bereit' && (
        <div className="leinwand-bereit">
          <p className="feld-hinweis">{t.uebungsHinweis}</p>
          {fehler && <p className="fehlermeldung">{fehler}</p>}
          {UEBUNGS_WORKFLOWS.map((workflow) => (
            <div key={workflow.id} className="workflow-karte">
              <div>
                <p className="karte-titel">{workflow.name}</p>
                <p className="feld-hinweis">{workflow.beschreibung}</p>
              </div>
              <button className="knopf-primaer knopf-klein" onClick={() => starten(workflow)}>
                {t.starten}
              </button>
            </div>
          ))}
        </div>
      )}

      {zustand !== 'bereit' && (
        <div className="lauf-ansicht">
          <div className={'block-kachel' + (zustand === 'laeuft' ? ' block-laeuft' : '')}>
            <span className="karte-titel">{blockName || t.tickerUeberschrift}</span>
            {zustand === 'laeuft' && <span className="block-zustand">{t.laeuft}</span>}
            {zustand === 'fertig' && ergebnis && <ZustandsMarke zustand={ergebnis.zustand} />}
          </div>

          <VerbrauchZeile verbrauch={verbrauch} modus={modus} />

          {zustand === 'laeuft' && (
            <div className="lauf-knoepfe">
              <button
                className="knopf-sekundaer knopf-klein"
                title={t.sanftStoppenHinweis}
                onClick={() => window.flowforge.laufSanftStoppen(pfad)}
              >
                {t.sanftStoppen}
              </button>
              <button className="knopf-gefahr knopf-klein" onClick={hartStoppen}>
                {t.hartStoppen}
              </button>
            </div>
          )}

          <div className="ticker">
            {ticker.map((zeile, i) => (
              <p key={i} className="ticker-zeile">
                <span className="ticker-zeit">
                  {zeile.zeit.toLocaleTimeString('de-DE')}
                </span>
                {zeile.text}
              </p>
            ))}
            <div ref={tickerEnde} />
          </div>

          <button className="knopf-klein" onClick={() => setRohOffen(!rohOffen)}>
            {rohOffen ? t.rohProtokollVerbergen : t.rohProtokollZeigen}
          </button>
          {rohOffen && (
            <pre className="roh-protokoll">
              {roh.join('\n')}
            </pre>
          )}

          {zustand === 'fertig' && ergebnis && (
            <div className={'lauf-ergebnis ergebnis-' + ergebnis.zustand}>
              <p>{fertigText(ergebnis.zustand)}</p>
              {ergebnis.fehlertext && <p className="feld-hinweis">{ergebnis.fehlertext}</p>}
              <button className="knopf-sekundaer knopf-klein" onClick={() => setZustand('bereit')}>
                {t.okKnopf}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="berichte-bereich">
        <p className="bericht-abschnitt">{tb.ueberschrift}</p>
        {berichte.length === 0 && <p className="feld-hinweis">{tb.keine}</p>}
        {berichte.map((bericht) => (
          <Laufbericht key={bericht.id} bericht={bericht} />
        ))}
      </div>

      {frage && (
        <div className="dialog-schleier">
          <div className="dialog">
            <h2>{tf.ueberschrift}</h2>
            <p className="frage-text">{frage.beschreibung}</p>
            <p className="feld-hinweis">{tf.folgenHinweis}</p>
            <div className="dialog-knoepfe">
              <button
                className="knopf-sekundaer"
                onClick={() => window.flowforge.laufFrageAntworten(frage.frageId, false)}
              >
                {tf.ablehnen}
              </button>
              <button
                className="knopf-primaer"
                onClick={() => window.flowforge.laufFrageAntworten(frage.frageId, true)}
              >
                {tf.erlauben}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
