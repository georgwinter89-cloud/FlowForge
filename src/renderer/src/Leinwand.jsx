import { useEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'
import { blockDefinition, REPARATUR_RUNDEN_MAX } from '../../shared/blockKatalog.js'
import { BlockChips } from './Blockbibliothek.jsx'

const t = texte.lauf
const tk = texte.kette
const te = texte.entscheidung
const tf = texte.rechteFrage
const tb = texte.laufberichte
const ts = texte.sicherungen

function zeitText(zeitstempel) {
  return new Date(zeitstempel).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function VorschauGruppe({ ueberschrift, eintraege }) {
  if (eintraege.length === 0) return null
  return (
    <div>
      <p className="bericht-abschnitt">{ueberschrift}</p>
      {eintraege.map((eintrag) => (
        <p key={eintrag.pfad} className="bericht-zeile">
          {eintrag.pfad}
        </p>
      ))}
    </div>
  )
}

function VerbrauchZeile({ verbrauch, modus }) {
  if (!verbrauch) return null
  const teile = []
  if (verbrauch.kontextProzentVon != null)
    teile.push(t.verbrauchKontext(verbrauch.kontextProzentVon, verbrauch.kontextProzentBis))
  if (verbrauch.tokens != null) teile.push(t.verbrauchTokens(verbrauch.tokens))
  if (verbrauch.kostenUsd != null)
    teile.push(modus === 'abo' ? t.verbrauchKostenAbo : t.verbrauchKosten(verbrauch.kostenUsd))
  if (teile.length === 0) return null
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
  const wahlLabels = {
    weitermachen: te.weitermachen,
    zurueckstellen: te.zurueckstellen,
    wiederherstellen: te.wiederherstellen
  }
  return (
    <div className="bericht">
      <button className="bericht-kopf" onClick={() => setOffen(!offen)}>
        <span className="bericht-kopf-text">
          {zeitText(bericht.gestartetAm)} · {bericht.workflow}
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
          {(bericht.rechteFragen ?? []).length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.rechteFragenLabel}</p>
              {bericht.rechteFragen.map((frage, i) => (
                <p key={i} className="bericht-zeile">
                  {frage.beschreibung} — <strong>{frage.erlaubt ? tb.erlaubt : tb.abgelehnt}</strong>
                </p>
              ))}
            </div>
          )}
          {(bericht.entscheidungen ?? []).length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.entscheidungenLabel}</p>
              {bericht.entscheidungen.map((eintrag, i) => (
                <p key={i} className="bericht-zeile">
                  {eintrag.block} — <strong>{wahlLabels[eintrag.wahl] ?? eintrag.wahl}</strong>
                </p>
              ))}
            </div>
          )}
          <p className="bericht-abschnitt">{tb.verlaufLabel}</p>
          {(bericht.ticker ?? []).map((zeile, i) => (
            <p key={i} className="bericht-zeile">
              {new Date(zeile.zeit).toLocaleTimeString('de-DE')} — {zeile.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function AblageZone({ onAblegen }) {
  const [aktiv, setAktiv] = useState(false)
  return (
    <div
      className={'ablage-zone' + (aktiv ? ' ablage-aktiv' : '')}
      onDragOver={(e) => {
        e.preventDefault()
        setAktiv(true)
      }}
      onDragLeave={() => setAktiv(false)}
      onDrop={(e) => {
        setAktiv(false)
        onAblegen(e)
      }}
    >
      {tk.hierAblegen}
    </div>
  )
}

function KettenBlock({
  eintrag,
  index,
  bloecke,
  bearbeitbar,
  aktiv,
  onFeld,
  onSpeichern,
  onZurueckZu,
  onEntfernen
}) {
  const def = blockDefinition(eintrag.blockId)
  if (!def) return null
  const davor = bloecke.slice(0, index)
  return (
    <div className={'ketten-block' + (aktiv ? ' block-laeuft' : '')}>
      <div
        className="ketten-block-kopf"
        draggable={bearbeitbar}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/flowforge-instanz', eintrag.instanzId)
          e.dataTransfer.effectAllowed = 'move'
        }}
      >
        <span className="block-nummer">{index + 1}</span>
        <span className="karte-titel">
          {def.symbol} {def.name}
        </span>
        {aktiv && <span className="block-zustand">{t.laeuft}</span>}
        {bearbeitbar && (
          <button className="knopf-klein ketten-block-entfernen" onClick={onEntfernen}>
            {tk.entfernen}
          </button>
        )}
      </div>
      <BlockChips def={def} />
      {def.felder.map((feld) => (
        <label key={feld.id} className="feld feld-kompakt">
          {feld.label}
          {feld.pflicht ? ' *' : ''}
          <input
            disabled={!bearbeitbar}
            value={eintrag.feldWerte?.[feld.id] ?? ''}
            placeholder={feld.platzhalter}
            onChange={(e) => onFeld(feld.id, e.target.value)}
            onBlur={onSpeichern}
          />
        </label>
      ))}
      {def.prueft && davor.length > 0 && (
        <label className="feld feld-kompakt">
          {tk.zurueckZuLabel}
          <select
            disabled={!bearbeitbar}
            value={eintrag.zurueckZu ?? davor[davor.length - 1].instanzId}
            onChange={(e) => onZurueckZu(e.target.value)}
          >
            {davor.map((d, di) => (
              <option key={d.instanzId} value={d.instanzId}>
                {di + 1}. {blockDefinition(d.blockId)?.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

export default function Leinwand({ pfad, onWiederhergestellt }) {
  // zustand: 'bereit' (Kette bearbeiten) | 'laeuft' | 'fertig'
  const [zustand, setZustand] = useState('bereit')
  const [workflow, setWorkflow] = useState(null)
  const [meldung, setMeldung] = useState('')
  const [aktiveInstanz, setAktiveInstanz] = useState(null)
  const [ticker, setTicker] = useState([])
  const [roh, setRoh] = useState([])
  const [rohOffen, setRohOffen] = useState(false)
  const [verbrauch, setVerbrauch] = useState(null)
  const [frage, setFrage] = useState(null)
  const [entscheidung, setEntscheidung] = useState(null)
  const [ergebnis, setErgebnis] = useState(null)
  const [fehler, setFehler] = useState('')
  const [berichte, setBerichte] = useState([])
  const [modus, setModus] = useState('abo')
  // Vorschau: null = zu, sonst { punkt, unterschiede }
  const [punkte, setPunkte] = useState([])
  const [vorschau, setVorschau] = useState(null)
  const [sicherungsMeldung, setSicherungsMeldung] = useState('')
  const tickerEnde = useRef(null)

  function berichteLaden() {
    window.flowforge.laufberichteLaden(pfad).then((e) => e.ok && setBerichte(e.berichte))
  }

  function punkteLaden() {
    window.flowforge.sicherungspunkteLaden(pfad).then((e) => e.ok && setPunkte(e.punkte))
  }

  useEffect(() => {
    berichteLaden()
    punkteLaden()
    window.flowforge.workflowLaden(pfad).then((e) => e.ok && setWorkflow(e.workflow))
    window.flowforge.einstellungenLaden().then((e) => e.ok && setModus(e.einstellungen.motorModus))
    // Läuft schon etwas? Dann Anzeige und offene Fragen wiederherstellen —
    // sonst hinge der Lauf nach einem Ansichtswechsel ewig an einem Dialog.
    window.flowforge.laufZustand(pfad).then((e) => {
      if (!e.ok || !e.aktiv) return
      setZustand('laeuft')
      setAktiveInstanz(e.blockInstanzId ?? null)
      if (e.frage) setFrage(e.frage)
      if (e.entscheidung) setEntscheidung(e.entscheidung)
    })
    const abmelden = window.flowforge.aufLaufEreignis((ereignis) => {
      if (ereignis.projektPfad !== pfad) return
      if (ereignis.art === 'zustand' && ereignis.zustand === 'laeuft') setZustand('laeuft')
      if (ereignis.art === 'block') setAktiveInstanz(ereignis.instanzId)
      if (ereignis.art === 'ticker')
        setTicker((alt) => [...alt, { zeit: new Date(), text: ereignis.text }])
      if (ereignis.art === 'roh') setRoh((alt) => [...alt, ereignis.zeile])
      if (ereignis.art === 'verbrauch') setVerbrauch(ereignis.verbrauch)
      if (ereignis.art === 'frage')
        setFrage({ frageId: ereignis.frageId, beschreibung: ereignis.beschreibung })
      if (ereignis.art === 'frage-erledigt') setFrage(null)
      if (ereignis.art === 'entscheidung')
        setEntscheidung({
          frageId: ereignis.frageId,
          blockName: ereignis.blockName,
          runden: ereignis.runden
        })
      if (ereignis.art === 'entscheidung-erledigt') setEntscheidung(null)
      if (ereignis.art === 'fertig') {
        setZustand('fertig')
        setErgebnis({ zustand: ereignis.zustand, fehlertext: ereignis.fehlertext })
        setAktiveInstanz(null)
        setFrage(null)
        setEntscheidung(null)
        berichteLaden()
        punkteLaden()
        // Nach hartem Abbruch oder Wiederherstellung wurde der Projektordner
        // zurückgesetzt — Karten neu laden.
        if (ereignis.zustand === 'hart-abgebrochen' || ereignis.zustand === 'wiederhergestellt')
          onWiederhergestellt?.()
      }
    })
    return abmelden
  }, [pfad])

  useEffect(() => {
    tickerEnde.current?.scrollIntoView({ block: 'nearest' })
  }, [ticker])

  // --- Kette bearbeiten ---------------------------------------------------

  async function ketteSpeichern(neu) {
    const antwort = await window.flowforge.workflowSpeichern(pfad, neu)
    if (antwort.ok) {
      setWorkflow(antwort.workflow)
      setMeldung('')
    } else {
      setMeldung(antwort.fehler)
      // Zurück zum gespeicherten Stand, damit Anzeige und Datei übereinstimmen.
      window.flowforge.workflowLaden(pfad).then((e) => e.ok && setWorkflow(e.workflow))
    }
  }

  function beimAblegen(e, zielIndex) {
    e.preventDefault()
    const blockId = e.dataTransfer.getData('text/flowforge-block')
    const instanzId = e.dataTransfer.getData('text/flowforge-instanz')
    const bloecke = [...workflow.bloecke]
    if (blockId) {
      bloecke.splice(zielIndex, 0, { blockId, feldWerte: {}, zurueckZu: null })
    } else if (instanzId) {
      const von = bloecke.findIndex((b) => b.instanzId === instanzId)
      if (von === -1) return
      const [verschoben] = bloecke.splice(von, 1)
      bloecke.splice(von < zielIndex ? zielIndex - 1 : zielIndex, 0, verschoben)
    } else return
    ketteSpeichern({ ...workflow, bloecke })
  }

  function feldSetzen(instanzId, feldId, wert) {
    setWorkflow((alt) => ({
      ...alt,
      bloecke: alt.bloecke.map((b) =>
        b.instanzId === instanzId ? { ...b, feldWerte: { ...b.feldWerte, [feldId]: wert } } : b
      )
    }))
  }

  function zurueckZuSetzen(instanzId, ziel) {
    const bloecke = workflow.bloecke.map((b) =>
      b.instanzId === instanzId ? { ...b, zurueckZu: ziel } : b
    )
    ketteSpeichern({ ...workflow, bloecke })
  }

  function entfernen(instanzId) {
    ketteSpeichern({
      ...workflow,
      bloecke: workflow.bloecke.filter((b) => b.instanzId !== instanzId)
    })
  }

  function rundenSetzen(wert) {
    const runden = Math.max(0, Math.min(REPARATUR_RUNDEN_MAX, Number(wert) || 0))
    ketteSpeichern({ ...workflow, reparaturRunden: runden })
  }

  // --- Lauf ---------------------------------------------------------------

  async function starten() {
    setMeldung('')
    setFehler('')
    setTicker([])
    setRoh([])
    setVerbrauch(null)
    setErgebnis(null)
    setAktiveInstanz(null)
    const antwort = await window.flowforge.laufStarten(pfad)
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
    if (z === 'zurueckgestellt') return t.fertigZurueckgestellt
    if (z === 'wiederhergestellt') return t.fertigWiederhergestellt
    return t.fertigFehlgeschlagen
  }

  async function vorschauOeffnen(punkt) {
    setSicherungsMeldung('')
    const antwort = await window.flowforge.wiederherstellenVorschau(pfad, punkt.id)
    if (!antwort.ok) return setSicherungsMeldung(antwort.fehler)
    setVorschau({ punkt, unterschiede: antwort.unterschiede })
  }

  async function wiederherstellenBestaetigen() {
    const punkt = vorschau.punkt
    const antwort = await window.flowforge.wiederherstellen(pfad, punkt.id)
    setVorschau(null)
    if (!antwort.ok) return setSicherungsMeldung(antwort.fehler)
    setSicherungsMeldung(ts.erledigt(zeitText(punkt.zeit)))
    punkteLaden()
    onWiederhergestellt?.()
  }

  if (!workflow) return null
  const bearbeitbar = zustand === 'bereit'
  const bloecke = workflow.bloecke

  return (
    <div className="leinwand">
      {meldung && <p className="fehlermeldung">{meldung}</p>}
      {fehler && <p className="fehlermeldung">{fehler}</p>}

      {bearbeitbar && (
        <div className="kette-kopf">
          <button
            className="knopf-primaer knopf-klein"
            disabled={bloecke.length === 0}
            onClick={starten}
          >
            {tk.starten}
          </button>
          <label className="runden-feld" title={tk.reparaturRundenHinweis}>
            {tk.reparaturRundenLabel}
            <input
              type="number"
              min="0"
              max={REPARATUR_RUNDEN_MAX}
              value={workflow.reparaturRunden}
              onChange={(e) => rundenSetzen(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="kette">
        {bearbeitbar && <AblageZone onAblegen={(e) => beimAblegen(e, 0)} />}
        {bloecke.map((eintrag, i) => (
          <div key={eintrag.instanzId}>
            {!bearbeitbar && i > 0 && <div className="kette-pfeil">↓</div>}
            <KettenBlock
              eintrag={eintrag}
              index={i}
              bloecke={bloecke}
              bearbeitbar={bearbeitbar}
              aktiv={eintrag.instanzId === aktiveInstanz}
              onFeld={(feldId, wert) => feldSetzen(eintrag.instanzId, feldId, wert)}
              onSpeichern={() => ketteSpeichern(workflow)}
              onZurueckZu={(ziel) => zurueckZuSetzen(eintrag.instanzId, ziel)}
              onEntfernen={() => entfernen(eintrag.instanzId)}
            />
            {bearbeitbar && <AblageZone onAblegen={(e) => beimAblegen(e, i + 1)} />}
          </div>
        ))}
        {bloecke.length === 0 && <p className="feld-hinweis">{tk.leerHinweis}</p>}
      </div>

      {zustand !== 'bereit' && (
        <div className="lauf-ansicht">
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
                <span className="ticker-zeit">{zeile.zeit.toLocaleTimeString('de-DE')}</span>
                {zeile.text}
              </p>
            ))}
            <div ref={tickerEnde} />
          </div>

          <button className="knopf-klein" onClick={() => setRohOffen(!rohOffen)}>
            {rohOffen ? t.rohProtokollVerbergen : t.rohProtokollZeigen}
          </button>
          {rohOffen && <pre className="roh-protokoll">{roh.join('\n')}</pre>}

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

      <div className="berichte-bereich">
        <p className="bericht-abschnitt">{ts.ueberschrift}</p>
        {sicherungsMeldung && <p className="feld-hinweis">{sicherungsMeldung}</p>}
        {punkte.length === 0 && (
          <>
            <p className="feld-hinweis">{ts.keine}</p>
            <p className="feld-hinweis">{ts.hinweis}</p>
          </>
        )}
        {punkte.map((punkt) => (
          <div key={punkt.id} className="punkt-zeile">
            <span>
              {zeitText(punkt.zeit)} — {punkt.beschriftung}
            </span>
            <button
              className="knopf-klein"
              disabled={zustand === 'laeuft'}
              title={zustand === 'laeuft' ? ts.fehlerWaehrendLauf : undefined}
              onClick={() => vorschauOeffnen(punkt)}
            >
              {ts.wiederherstellen}
            </button>
          </div>
        ))}
      </div>

      {vorschau && (
        <div className="dialog-schleier">
          <div className="dialog">
            <h2>{ts.vorschauUeberschrift}</h2>
            <p className="frage-text">{ts.vorschauEinleitung(zeitText(vorschau.punkt.zeit))}</p>
            {vorschau.unterschiede.length === 0 ? (
              <p className="feld-hinweis">{ts.identisch}</p>
            ) : (
              <div className="vorschau-listen">
                <VorschauGruppe
                  ueberschrift={ts.gruppeAnders}
                  eintraege={vorschau.unterschiede.filter((u) => u.art === 'anders')}
                />
                <VorschauGruppe
                  ueberschrift={ts.gruppeVerschwindet}
                  eintraege={vorschau.unterschiede.filter((u) => u.art === 'nur-ordner')}
                />
                <VorschauGruppe
                  ueberschrift={ts.gruppeKommtZurueck}
                  eintraege={vorschau.unterschiede.filter((u) => u.art === 'nur-sicherung')}
                />
              </div>
            )}
            {vorschau.unterschiede.length > 0 && (
              <p className="feld-hinweis">{ts.laufberichteBleiben}</p>
            )}
            <div className="dialog-knoepfe">
              <button className="knopf-sekundaer" onClick={() => setVorschau(null)}>
                {ts.abbrechen}
              </button>
              {vorschau.unterschiede.length > 0 && (
                <button className="knopf-primaer" onClick={wiederherstellenBestaetigen}>
                  {ts.jetztWiederherstellen}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

      {entscheidung && !frage && (
        <div className="dialog-schleier">
          <div className="dialog">
            <h2>{te.ueberschrift}</h2>
            <p className="frage-text">
              {te.einleitung(entscheidung.blockName, entscheidung.runden)}
            </p>
            <div className="entscheidung-optionen">
              {[
                ['weitermachen', te.weitermachen, te.weitermachenHinweis],
                ['zurueckstellen', te.zurueckstellen, te.zurueckstellenHinweis],
                ['wiederherstellen', te.wiederherstellen, te.wiederherstellenHinweis]
              ].map(([wahl, titel, hinweis]) => (
                <button
                  key={wahl}
                  className="entscheidung-option"
                  onClick={() =>
                    window.flowforge.laufEntscheidungAntworten(entscheidung.frageId, wahl)
                  }
                >
                  <strong>{titel}</strong>
                  <span className="feld-hinweis">{hinweis}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
