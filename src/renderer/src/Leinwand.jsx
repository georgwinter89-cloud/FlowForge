import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  blockDefinition,
  vorlageDefinition,
  blockKategorie,
  REPARATUR_RUNDEN_MAX
} from '../../shared/blockKatalog.js'
import { schaubildReihenfolge, vorfahrenImPfad } from '../../shared/kettenRegeln.js'
import { BlockChips } from './Blockbibliothek.jsx'

const t = texte.lauf
const tk = texte.kette
const ta = texte.kartenAuswahl
const te = texte.entscheidung
const tf = texte.rechteFrage
const tb = texte.laufberichte
const ts = texte.sicherungen
const tg = texte.gespraech

// Solange eine Karte noch nicht gemessen ist, rechnen Pfeile mit dieser Größe.
const KARTE_STANDARD = { w: 240, h: 140 }

function zeitText(zeitstempel) {
  return new Date(zeitstempel).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

// Punkt auf dem Rand eines Karten-Rechtecks, vom Mittelpunkt aus in Richtung
// ziel — dort setzen Pfeile an, statt mitten in der Karte zu verschwinden.
function randSchnitt(rect, ziel) {
  const mx = rect.x + rect.w / 2
  const my = rect.y + rect.h / 2
  const dx = ziel.x - mx
  const dy = ziel.y - my
  if (dx === 0 && dy === 0) return { x: mx, y: my }
  const sx = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: mx + dx * s, y: my + dy * s }
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

// Gespräch mit dem Agenten (BAUPLAN 9): Verlauf als Chat, offene Frage mit
// Antwort-Optionen und Freitextfeld. Das Spec-Interview „grillt" hierüber.
function Gespraech({ verlauf, frage, onAntwort }) {
  const [antwortText, setAntwortText] = useState('')
  const ende = useRef(null)
  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'nearest' })
  }, [verlauf.length, frage?.frageId])

  function senden(text) {
    const sauber = text.trim()
    if (!sauber || !frage) return
    setAntwortText('')
    onAntwort(frage.frageId, sauber)
  }

  if (verlauf.length === 0 && !frage) return null
  return (
    <div className="gespraech">
      <p className="gespraech-titel">
        {frage ? tg.ueberschrift : tg.verlaufUeberschrift}
      </p>
      <div className="gespraech-verlauf">
        {verlauf.map((runde, i) => (
          <div key={i}>
            <div className="gespraech-blase blase-agent">{runde.frage}</div>
            <div className="gespraech-blase blase-mensch">{runde.antwort}</div>
          </div>
        ))}
        {frage && <div className="gespraech-blase blase-agent blase-offen">{frage.frage}</div>}
        <div ref={ende} />
      </div>
      {frage && (
        <div className="gespraech-eingabe">
          {(frage.optionen ?? []).length > 0 && (
            <div className="gespraech-optionen">
              {frage.optionen.map((option, i) => (
                <button key={i} className="gespraech-option" onClick={() => senden(option)}>
                  {option}
                </button>
              ))}
            </div>
          )}
          {(frage.optionen ?? []).length > 0 && (
            <p className="feld-hinweis">{tg.freitextHinweis}</p>
          )}
          <div className="gespraech-zeile">
            <textarea
              rows={3}
              value={antwortText}
              placeholder={tg.antwortPlatzhalter}
              onChange={(e) => setAntwortText(e.target.value)}
              onKeyDown={(e) => {
                // Enter schickt ab; Shift+Enter macht eine neue Zeile — bei
                // Runden mit mehreren Fragen braucht die Antwort mehrere Zeilen.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  senden(antwortText)
                }
              }}
            />
            <button
              className="knopf-primaer knopf-klein"
              disabled={!antwortText.trim()}
              onClick={() => senden(antwortText)}
            >
              {tg.antworten}
            </button>
          </div>
        </div>
      )}
    </div>
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
          {(bericht.gespraech ?? []).length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.gespraechLabel}</p>
              {bericht.gespraech.map((runde, i) => (
                <p key={i} className="bericht-zeile">
                  {runde.frage} — <strong>{runde.antwort}</strong>
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

function SchaubildKarte({
  eintrag,
  def,
  nummer,
  vorfahren,
  nummern,
  bearbeitbar,
  aktiv,
  letztesErgebnis,
  onFeld,
  onSpeichern,
  onZurueckZu,
  onEntfernen,
  onGreifen,
  onPfeilStart,
  messen
}) {
  const [ergebnisOffen, setErgebnisOffen] = useState(false)
  return (
    <div
      className={
        'schaubild-karte kategorie-' + blockKategorie(def) + (aktiv ? ' block-laeuft' : '')
      }
      style={{ left: eintrag.position.x, top: eintrag.position.y }}
      data-instanz={eintrag.instanzId}
      ref={messen}
      onPointerDown={bearbeitbar ? onGreifen : undefined}
    >
      <div className={'ketten-block-kopf' + (bearbeitbar ? ' schaubild-griff' : '')}>
        {nummer != null && <span className="block-nummer">{nummer}</span>}
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
      {def.prueft && vorfahren.length > 0 && (
        <label className="feld feld-kompakt">
          {tk.zurueckZuLabel}
          <select
            disabled={!bearbeitbar}
            value={eintrag.zurueckZu ?? vorfahren[vorfahren.length - 1].instanzId}
            onChange={(e) => onZurueckZu(e.target.value)}
          >
            {vorfahren.map((d) => (
              <option key={d.instanzId} value={d.instanzId}>
                {nummern.get(d.instanzId) != null ? nummern.get(d.instanzId) + '. ' : ''}
                {blockDefinition(d.blockId)?.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {letztesErgebnis && (
        <div className="block-ergebnis">
          <button
            className="block-ergebnis-knopf"
            onClick={() => setErgebnisOffen(!ergebnisOffen)}
          >
            <span>
              {ergebnisOffen ? '▾' : '▸'} {tb.blockErgebnis}
            </span>
            <span className={'block-ergebnis-marke marke-' + letztesErgebnis.zustand}>
              {tb.blockZustaende[letztesErgebnis.zustand] ?? letztesErgebnis.zustand}
            </span>
          </button>
          {ergebnisOffen && (
            <div className="block-ergebnis-text">
              <p className="feld-hinweis">{zeitText(letztesErgebnis.zeit)}</p>
              {letztesErgebnis.ergebnisText}
            </div>
          )}
        </div>
      )}
      {bearbeitbar && (
        <div
          className="pfeil-punkt"
          title={tk.pfeilZiehenHinweis}
          onPointerDown={onPfeilStart}
        >
          ↓
        </div>
      )}
    </div>
  )
}

export default function Leinwand({ pfad, karten, onWiederhergestellt }) {
  // zustand: 'bereit' (Schaubild bearbeiten) | 'laeuft' | 'fertig'
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
  // Gespräch mit dem Agenten: offene Frage + bisheriger Verlauf dieses Laufs.
  const [menschFrage, setMenschFrage] = useState(null)
  const [gespraech, setGespraech] = useState([])
  const [ergebnis, setErgebnis] = useState(null)
  const [fehler, setFehler] = useState('')
  const [berichte, setBerichte] = useState([])
  const [modus, setModus] = useState('abo')
  // Vorschau: null = zu, sonst { punkt, unterschiede }
  const [punkte, setPunkte] = useState([])
  const [vorschau, setVorschau] = useState(null)
  const [sicherungsMeldung, setSicherungsMeldung] = useState('')
  // Untere Bereiche standardmäßig eingeklappt — mehr Platz für die Leinwand.
  const [berichteOffen, setBerichteOffen] = useState(false)
  const [punkteOffen, setPunkteOffen] = useState(false)
  // Kartenvorauswahl für den Lauf (SPEC §5, BAUPLAN 7): Status + offene Aufgaben
  // sind vorausgewählt; Georg kann Karten dazuziehen (zusatz) oder vorausgewählte
  // rauswerfen (raus). Beides gilt für den nächsten Start, wird nicht gespeichert.
  const [kontextZusatz, setKontextZusatz] = useState(() => new Set())
  const [kontextRaus, setKontextRaus] = useState(() => new Set())
  // Schaubild: gemessene Kartengrößen, laufender Karten-Zug, laufender Pfeil-Zug
  const [groessen, setGroessen] = useState({})
  const [ziehen, setZiehen] = useState(null) // { instanzId, dx, dy }
  const [pfeilZug, setPfeilZug] = useState(null) // { von, x, y }
  const tickerEnde = useRef(null)
  const flaecheRef = useRef(null)
  const kartenRefs = useRef(new Map())
  // Aktuelle Werte für die Fenster-Listener (sonst arbeiten sie mit altem Stand).
  const workflowRef = useRef(null)
  workflowRef.current = workflow
  const ziehenRef = useRef(null)
  ziehenRef.current = ziehen
  const pfeilZugRef = useRef(null)
  pfeilZugRef.current = pfeilZug

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
      if (e.menschFrage) setMenschFrage(e.menschFrage)
      if (e.gespraech) setGespraech(e.gespraech)
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
      if (ereignis.art === 'mensch-frage')
        setMenschFrage({
          frageId: ereignis.frageId,
          frage: ereignis.frage,
          optionen: ereignis.optionen
        })
      if (ereignis.art === 'mensch-frage-erledigt') {
        setMenschFrage(null)
        if (ereignis.antwort != null)
          setGespraech((alt) => [...alt, { frage: ereignis.frage, antwort: ereignis.antwort }])
      }
      if (ereignis.art === 'fertig') {
        setZustand('fertig')
        setErgebnis({ zustand: ereignis.zustand, fehlertext: ereignis.fehlertext })
        setAktiveInstanz(null)
        setFrage(null)
        setEntscheidung(null)
        setMenschFrage(null)
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

  // Kartengrößen nach jedem Rendern messen — die Pfeile setzen am Kartenrand an.
  useLayoutEffect(() => {
    const neu = {}
    for (const [id, el] of kartenRefs.current) neu[id] = { w: el.offsetWidth, h: el.offsetHeight }
    setGroessen((alt) => {
      const altIds = Object.keys(alt)
      const neuIds = Object.keys(neu)
      const gleich =
        altIds.length === neuIds.length &&
        neuIds.every((id) => alt[id]?.w === neu[id].w && alt[id]?.h === neu[id].h)
      return gleich ? alt : neu
    })
  })

  // Karten-Zug und Pfeil-Zug laufen über Fenster-Listener, damit sie auch beim
  // Verlassen der Karte weitergehen. Gespeichert wird erst beim Loslassen.
  useEffect(() => {
    if (!ziehen && !pfeilZug) return
    function bewegen(e) {
      const rect = flaecheRef.current?.getBoundingClientRect()
      if (!rect) return
      const z = ziehenRef.current
      if (z) {
        const x = Math.max(0, Math.round(e.clientX - rect.left - z.dx))
        const y = Math.max(0, Math.round(e.clientY - rect.top - z.dy))
        setWorkflow((alt) => ({
          ...alt,
          bloecke: alt.bloecke.map((b) =>
            b.instanzId === z.instanzId ? { ...b, position: { x, y } } : b
          )
        }))
      } else if (pfeilZugRef.current) {
        setPfeilZug((alt) => alt && { ...alt, x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
    }
    function loslassen(e) {
      if (ziehenRef.current) {
        setZiehen(null)
        ketteSpeichern(workflowRef.current)
      } else if (pfeilZugRef.current) {
        const von = pfeilZugRef.current.von
        setPfeilZug(null)
        const ziel = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-instanz]')
        const nach = ziel?.getAttribute('data-instanz')
        if (nach && nach !== von)
          ketteSpeichern({
            ...workflowRef.current,
            pfeile: [...workflowRef.current.pfeile, { von, nach }]
          })
      }
    }
    window.addEventListener('pointermove', bewegen)
    window.addEventListener('pointerup', loslassen)
    return () => {
      window.removeEventListener('pointermove', bewegen)
      window.removeEventListener('pointerup', loslassen)
    }
  }, [Boolean(ziehen), Boolean(pfeilZug)])

  // --- Schaubild bearbeiten -----------------------------------------------

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

  function neuAblegen(e) {
    e.preventDefault()
    // Vorlage (SPEC §4.4): legt eine ganze Kette fertig verbunden ab — nur auf
    // die leere Leinwand, damit sie nichts Bestehendes durcheinanderbringt.
    const vorlageId = e.dataTransfer.getData('text/flowforge-vorlage')
    if (vorlageId) {
      const vorlage = vorlageDefinition(vorlageId)
      if (!vorlage) return
      if (workflow.bloecke.length > 0) {
        setMeldung(tk.vorlageNurLeer)
        return
      }
      const bloecke = vorlage.kette.map((blockId, i) => ({
        instanzId: crypto.randomUUID(),
        blockId,
        feldWerte: {},
        zurueckZu: null,
        position: { x: 40 + (i % 2) * 300, y: 40 + i * 190 }
      }))
      const pfeile = bloecke
        .slice(1)
        .map((block, i) => ({ von: bloecke[i].instanzId, nach: block.instanzId }))
      ketteSpeichern({ ...workflow, bloecke, pfeile })
      return
    }
    const blockId = e.dataTransfer.getData('text/flowforge-block')
    if (!blockId) return
    const rect = flaecheRef.current.getBoundingClientRect()
    const position = {
      x: Math.max(0, Math.round(e.clientX - rect.left - 120)),
      y: Math.max(0, Math.round(e.clientY - rect.top - 16))
    }
    ketteSpeichern({
      ...workflow,
      bloecke: [
        ...workflow.bloecke,
        { instanzId: crypto.randomUUID(), blockId, feldWerte: {}, zurueckZu: null, position }
      ]
    })
  }

  function karteGreifen(e, eintrag) {
    if (e.button !== 0) return
    if (e.target.closest('input, select, button, label, .pfeil-punkt')) return
    e.preventDefault()
    const rect = flaecheRef.current.getBoundingClientRect()
    setZiehen({
      instanzId: eintrag.instanzId,
      dx: e.clientX - rect.left - eintrag.position.x,
      dy: e.clientY - rect.top - eintrag.position.y
    })
  }

  function pfeilBeginnen(e, eintrag) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const rect = flaecheRef.current.getBoundingClientRect()
    setPfeilZug({
      von: eintrag.instanzId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  function pfeilLoeschen(pfeil) {
    ketteSpeichern({
      ...workflow,
      pfeile: workflow.pfeile.filter((p) => !(p.von === pfeil.von && p.nach === pfeil.nach))
    })
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
      bloecke: workflow.bloecke.filter((b) => b.instanzId !== instanzId),
      pfeile: workflow.pfeile.filter((p) => p.von !== instanzId && p.nach !== instanzId)
    })
  }

  function rundenSetzen(wert) {
    const runden = Math.max(0, Math.min(REPARATUR_RUNDEN_MAX, Number(wert) || 0))
    ketteSpeichern({ ...workflow, reparaturRunden: runden })
  }

  // --- Kartenvorauswahl für den Lauf ---------------------------------------

  function kontextAuswahl() {
    return (karten ?? []).filter(
      (k) =>
        k.sorte === 'status' ||
        kontextZusatz.has(k.id) ||
        (k.sorte === 'aufgabe' && !k.erledigt && !kontextRaus.has(k.id))
    )
  }

  function kontextAufnehmen(e) {
    const id = e.dataTransfer.getData('text/flowforge-karte')
    if (!id) return
    e.preventDefault()
    setKontextZusatz((alt) => new Set(alt).add(id))
    setKontextRaus((alt) => {
      const neu = new Set(alt)
      neu.delete(id)
      return neu
    })
  }

  function kontextEntfernen(karte) {
    if (kontextZusatz.has(karte.id))
      setKontextZusatz((alt) => {
        const neu = new Set(alt)
        neu.delete(karte.id)
        return neu
      })
    else setKontextRaus((alt) => new Set(alt).add(karte.id))
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
    setMenschFrage(null)
    setGespraech([])
    const kartenIds = kontextAuswahl()
      .filter((k) => k.sorte !== 'status')
      .map((k) => k.id)
    const antwort = await window.flowforge.laufStarten(pfad, kartenIds)
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
  const pfeile = workflow.pfeile

  // Letztes Block-Ergebnis pro Karte aus dem neuesten Laufbericht — bei
  // Reparatur-Runden gewinnt der späteste Durchgang.
  const letzteErgebnisse = new Map()
  for (const eintrag of berichte[0]?.blockErgebnisse ?? [])
    letzteErgebnisse.set(eintrag.instanzId, eintrag)

  // Nummern entlang des Pfads — nur wenn die Pfeile schon einen vollständigen
  // Pfad ergeben; sonst bleiben die Karten unnummeriert.
  const geordnet = schaubildReihenfolge(bloecke, pfeile)
  const nummern = new Map(
    geordnet.reihenfolge ? geordnet.reihenfolge.map((b, i) => [b.instanzId, i + 1]) : []
  )

  function karteRect(instanzId) {
    const block = bloecke.find((b) => b.instanzId === instanzId)
    if (!block) return null
    const g = groessen[instanzId] ?? KARTE_STANDARD
    return { x: block.position.x, y: block.position.y, w: g.w, h: g.h }
  }

  const pfeilLinien = pfeile
    .map((pfeil) => {
      const von = karteRect(pfeil.von)
      const nach = karteRect(pfeil.nach)
      if (!von || !nach) return null
      const start = randSchnitt(von, { x: nach.x + nach.w / 2, y: nach.y + nach.h / 2 })
      const ende = randSchnitt(nach, { x: von.x + von.w / 2, y: von.y + von.h / 2 })
      return {
        pfeil,
        start,
        ende,
        mitte: { x: (start.x + ende.x) / 2, y: (start.y + ende.y) / 2 }
      }
    })
    .filter(Boolean)

  let flaecheBreite = 900
  let flaecheHoehe = 480
  for (const block of bloecke) {
    const g = groessen[block.instanzId] ?? KARTE_STANDARD
    flaecheBreite = Math.max(flaecheBreite, block.position.x + g.w + 80)
    flaecheHoehe = Math.max(flaecheHoehe, block.position.y + g.h + 80)
  }

  const zugStart = pfeilZug && karteRect(pfeilZug.von)

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

      {bearbeitbar && (
        <div
          className="kontext-bereich"
          title={ta.hinweis}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/flowforge-karte')) e.preventDefault()
          }}
          onDrop={kontextAufnehmen}
        >
          <span className="kontext-titel">{ta.ueberschrift}:</span>
          {kontextAuswahl().map((karte) => (
            <span key={karte.id} className={'kontext-chip chip-' + karte.sorte}>
              {texte.karten.sorten[karte.sorte]}: {karte.titel}
              {karte.sorte === 'status' ? (
                <em className="chip-fest"> · {ta.immerDabei}</em>
              ) : (
                <button
                  className="chip-entfernen"
                  title={ta.entfernen}
                  onClick={() => kontextEntfernen(karte)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div
        className="schaubild"
        onDragOver={bearbeitbar ? (e) => e.preventDefault() : undefined}
        onDrop={bearbeitbar ? neuAblegen : undefined}
      >
        <div
          className="schaubild-flaeche"
          ref={flaecheRef}
          style={{ width: flaecheBreite, height: flaecheHoehe }}
        >
          <svg className="pfeil-ebene" width={flaecheBreite} height={flaecheHoehe}>
            <defs>
              <marker
                id="pfeilspitze"
                markerWidth="10"
                markerHeight="8"
                refX="9"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L10,4 L0,8 z" fill="#6b7484" />
              </marker>
              <marker
                id="pfeilspitze-vorschau"
                markerWidth="10"
                markerHeight="8"
                refX="9"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L10,4 L0,8 z" fill="#2563eb" />
              </marker>
            </defs>
            {pfeilLinien.map((linie, i) => (
              <line
                key={i}
                x1={linie.start.x}
                y1={linie.start.y}
                x2={linie.ende.x}
                y2={linie.ende.y}
                className="pfeil-linie"
                markerEnd="url(#pfeilspitze)"
              />
            ))}
            {pfeilZug && zugStart && (
              <line
                x1={randSchnitt(zugStart, pfeilZug).x}
                y1={randSchnitt(zugStart, pfeilZug).y}
                x2={pfeilZug.x}
                y2={pfeilZug.y}
                className="pfeil-linie pfeil-vorschau"
                markerEnd="url(#pfeilspitze-vorschau)"
              />
            )}
          </svg>
          {bloecke.map((eintrag) => {
            const def = blockDefinition(eintrag.blockId)
            if (!def) return null
            return (
              <SchaubildKarte
                key={eintrag.instanzId}
                eintrag={eintrag}
                def={def}
                nummer={nummern.get(eintrag.instanzId) ?? null}
                vorfahren={vorfahrenImPfad(bloecke, pfeile, eintrag.instanzId)}
                nummern={nummern}
                bearbeitbar={bearbeitbar}
                aktiv={eintrag.instanzId === aktiveInstanz}
                letztesErgebnis={letzteErgebnisse.get(eintrag.instanzId) ?? null}
                onFeld={(feldId, wert) => feldSetzen(eintrag.instanzId, feldId, wert)}
                onSpeichern={() => ketteSpeichern(workflowRef.current)}
                onZurueckZu={(ziel) => zurueckZuSetzen(eintrag.instanzId, ziel)}
                onEntfernen={() => entfernen(eintrag.instanzId)}
                onGreifen={(e) => karteGreifen(e, eintrag)}
                onPfeilStart={(e) => pfeilBeginnen(e, eintrag)}
                messen={(el) => {
                  if (el) kartenRefs.current.set(eintrag.instanzId, el)
                  else kartenRefs.current.delete(eintrag.instanzId)
                }}
              />
            )
          })}
          {bearbeitbar &&
            pfeilLinien.map((linie, i) => (
              <button
                key={'loeschen-' + i}
                className="pfeil-loeschen"
                style={{ left: linie.mitte.x, top: linie.mitte.y }}
                title={tk.pfeilLoeschen}
                onClick={() => pfeilLoeschen(linie.pfeil)}
              >
                ×
              </button>
            ))}
          {bloecke.length === 0 && <p className="schaubild-leer">{tk.leerHinweis}</p>}
        </div>
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

          <Gespraech
            verlauf={gespraech}
            frage={menschFrage}
            onAntwort={(frageId, antwort) => window.flowforge.laufMenschAntworten(frageId, antwort)}
          />

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
        <button className="bereich-kopf" onClick={() => setBerichteOffen(!berichteOffen)}>
          {berichteOffen ? '▾' : '▸'} {tb.ueberschrift} ({berichte.length})
        </button>
        {berichteOffen && (
          <>
            {berichte.length === 0 && <p className="feld-hinweis">{tb.keine}</p>}
            {berichte.map((bericht) => (
              <Laufbericht key={bericht.id} bericht={bericht} />
            ))}
          </>
        )}
      </div>

      <div className="berichte-bereich">
        <button className="bereich-kopf" onClick={() => setPunkteOffen(!punkteOffen)}>
          {punkteOffen ? '▾' : '▸'} {ts.ueberschrift} ({punkte.length})
        </button>
        {sicherungsMeldung && <p className="feld-hinweis">{sicherungsMeldung}</p>}
        {punkteOffen && (
          <>
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
          </>
        )}
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
