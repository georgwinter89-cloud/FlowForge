import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  blockDefinition,
  vorlageDefinition,
  blockKategorie,
  REPARATUR_RUNDEN_MAX,
  UEBERTRAG_GRENZE_MAX
} from '../../shared/blockKatalog.js'
import { schaubildReihenfolge, vorfahrenSortiert } from '../../shared/kettenRegeln.js'
import { BlockChips } from './Blockbibliothek.jsx'
import Bestaetigung from './Bestaetigung.jsx'
import KontextAnzeige from './KontextAnzeige.jsx'

const t = texte.lauf
const tk = texte.kette
const ta = texte.kartenAuswahl
const te = texte.entscheidung
const tf = texte.rechteFrage
const tb = texte.laufberichte
const ts = texte.sicherungen
const tg = texte.gespraech
const tw = texte.wiederaufnahme
const tp = texte.pruefmappe

// Solange eine Karte noch nicht gemessen ist, rechnen Pfeile mit dieser Größe.
const KARTE_STANDARD = { w: 240, h: 140 }

function zeitText(zeitstempel) {
  return new Date(zeitstempel).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function groesseText(bytes) {
  if (bytes < 1024) return tp.groesseBytes(bytes)
  return tp.groesseKb(Math.max(1, Math.round(bytes / 1024)))
}

// Prüfmappen-Ansicht an der Prüferkarte (BAUPLAN 17): aufklappbar wie das
// Block-Ergebnis, in Alltagssprache — welche Prüfungen der letzte Lauf in
// pruefung/ hinterlassen hat. Alle Prüf-Blockkarten zeigen dieselbe Mappe;
// gelesen wird beim Aufklappen frisch.
function PruefmappenBereich({ pfad }) {
  const [offen, setOffen] = useState(false)
  const [dateien, setDateien] = useState(null)
  function umschalten() {
    const jetztOffen = !offen
    setOffen(jetztOffen)
    if (jetztOffen)
      window.flowforge.pruefmappeLesen(pfad).then((e) => setDateien(e.ok ? e.dateien : []))
  }
  return (
    <div className="block-ergebnis">
      <button className="block-ergebnis-knopf" onClick={umschalten}>
        <span>
          {offen ? '▾' : '▸'} {tp.titel}
        </span>
        {offen && dateien != null && (
          <span className="block-ergebnis-marke">{tp.anzahl(dateien.length)}</span>
        )}
      </button>
      {offen && dateien != null && (
        <div className="block-ergebnis-text">
          {dateien.length === 0 ? (
            <p className="feld-hinweis">{tp.leer}</p>
          ) : (
            <>
              {dateien.map((datei) => (
                <p key={datei.name} className="bericht-zeile">
                  {datei.name} · {groesseText(datei.bytes)} · {zeitText(datei.geaendertAm)}
                </p>
              ))}
              <p className="feld-hinweis">{tp.hinweis}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
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

function VerbrauchZeile({ verbrauch, modus, label, mitBalken }) {
  if (!verbrauch) return null
  const teile = []
  if (verbrauch.kontextProzentVon != null)
    teile.push(t.verbrauchKontext(verbrauch.kontextProzentVon, verbrauch.kontextProzentBis))
  // Verbrauch der Unteraufgaben (BAUPLAN 17) zählt ehrlich mit — der
  // Kontext-Füllstand daneben misst nur die Hauptsession.
  if (verbrauch.tokens != null)
    teile.push(t.verbrauchTokens(verbrauch.tokens + (verbrauch.unterTokens ?? 0)))
  if (verbrauch.kostenUsd != null)
    teile.push(modus === 'abo' ? t.verbrauchKostenAbo : t.verbrauchKosten(verbrauch.kostenUsd))
  if (teile.length === 0) return null
  return (
    <div>
      {/* Kontext-Füllstand als Balken (Mockup 3c) — nur im laufenden Lauf,
          nicht in den historischen Laufberichten. */}
      {mitBalken && verbrauch.kontextProzentBis != null && (
        <KontextAnzeige
          von={verbrauch.kontextProzentVon}
          bis={verbrauch.kontextProzentBis}
          label={label}
        />
      )}
      <p className="verbrauch-zeile">
        {label && !mitBalken ? `„${label}": ` : ''}
        {teile.join(' · ')}
      </p>
    </div>
  )
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
                  {/* „Empfohlen"-Abzeichen (Mockup 4a): Optionen sind nackte
                      Strings ohne Flag — der Werkzeug-Prompt verlangt, dass
                      die Empfehlung zuerst steht und benannt ist. Abzeichen
                      darum nur auf Option 1 und nur, wenn der Text die
                      Empfehlung tatsächlich benennt. */}
                  {i === 0 && frage.optionen.length > 1 && /empfehl/i.test(option) && (
                    <span className="option-empfohlen">{tg.empfohlen}</span>
                  )}
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

// Ein Block-Ergebnis in den Bericht-Details (BAUPLAN 15): Zeile mit Ausgang,
// der Abschlusstext klappt auf Klick auf.
function BlockErgebnisZeile({ eintrag }) {
  const [offen, setOffen] = useState(false)
  return (
    <div className="block-ergebnis">
      <button className="block-ergebnis-knopf" onClick={() => setOffen(!offen)}>
        <span>
          {offen ? '▾' : '▸'} {eintrag.block}
        </span>
        <span className={'block-ergebnis-marke marke-' + eintrag.zustand}>
          {tb.blockZustaende[eintrag.zustand] ?? eintrag.zustand}
        </span>
      </button>
      {offen && (
        <div className="block-ergebnis-text">
          <p className="feld-hinweis">
            {zeitText(eintrag.zeit)}
            {eintrag.tokens != null && ` · ${tb.blockTokens(eintrag.tokens)}`}
          </p>
          {eintrag.aufschluesselung && (
            <p className="feld-hinweis">{tb.aufschluesselungZeile(eintrag.aufschluesselung)}</p>
          )}
          {eintrag.kostenUsd != null && (
            <p className="feld-hinweis">{tb.apiKosten(eintrag.kostenUsd)}</p>
          )}
          {eintrag.ergebnisText}
        </div>
      )}
    </div>
  )
}

// Lauf-Dauer in Alltagssprache — Sekunden nur, solange es unter einer Minute war.
function dauerText(bericht) {
  if (!bericht.beendetAm) return null
  const sekunden = Math.round(
    (new Date(bericht.beendetAm) - new Date(bericht.gestartetAm)) / 1000
  )
  if (!Number.isFinite(sekunden) || sekunden < 0) return null
  if (sekunden < 60) return tb.dauerSekunden(sekunden)
  return tb.dauerMinuten(Math.round(sekunden / 60))
}

function Laufbericht({ bericht }) {
  const [offen, setOffen] = useState(false)
  const wahlLabels = {
    weitermachen: te.weitermachen,
    zurueckstellen: te.zurueckstellen,
    wiederherstellen: te.wiederherstellen
  }
  const dauer = dauerText(bericht)
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
          {dauer && <p className="feld-hinweis">{dauer}</p>}
          <VerbrauchZeile verbrauch={bericht.verbrauch} modus={bericht.modus} />
          {/* Token-Aufschlüsselung & theoretische API-Kosten (Wunsch Georg,
              13.08.2026) — die Kosten rechnet der Motor aus den Preisen der
              genutzten Modelle; im Abo-Modus nur zur Einordnung. */}
          {bericht.verbrauch?.aufschluesselung && (
            <p className="feld-hinweis">
              {tb.aufschluesselungZeile(bericht.verbrauch.aufschluesselung)}
            </p>
          )}
          {bericht.verbrauch?.kostenUsd != null && (
            <p className="feld-hinweis">
              {tb.apiKosten(bericht.verbrauch.kostenUsd)}
              {bericht.modus === 'abo' ? tb.apiKostenAboZusatz : ''}
            </p>
          )}
          {/* Lokale Helfer-KI (Wunsch Georg, 13.08.2026): ihr Anteil steht
              schwarz auf weiß im Bericht — Recherchen, Schritte, Fehlschläge. */}
          {bericht.lokaleHelfer && (
            <p className="feld-hinweis">{tb.lokaleHelferZeile(bericht.lokaleHelfer)}</p>
          )}
          {(bericht.blockErgebnisse ?? []).length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.blockErgebnisseLabel}</p>
              {bericht.blockErgebnisse.map((eintrag, i) => (
                <BlockErgebnisZeile key={i} eintrag={eintrag} />
              ))}
            </div>
          )}
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
                  {frage.beschreibung} —{' '}
                  <strong>
                    {frage.automatisch ? tb.automatischErlaubt : frage.erlaubt ? tb.erlaubt : tb.abgelehnt}
                  </strong>
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
          {(bericht.uebertraege ?? []).length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.uebertraegeLabel}</p>
              {bericht.uebertraege.map((eintrag, i) => (
                <p key={i} className="bericht-zeile">
                  {new Date(eintrag.zeit).toLocaleTimeString('de-DE')} — {eintrag.text}
                </p>
              ))}
            </div>
          )}
          {bericht.fortgesetzt && <p className="bericht-zeile">{tb.fortgesetztHinweis}</p>}
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
  pfad,
  pruefKarten,
  zeigePruefkartenTipp,
  onKarteAbgelegt,
  onPruefkarteEntfernen,
  onFeld,
  onSpeichern,
  onZurueckZu,
  onEntfernen,
  onGreifen,
  onPfeilStart,
  messen
}) {
  const [ergebnisOffen, setErgebnisOffen] = useState(false)
  // Prüfkarten auf den Prüfer ziehen (BAUPLAN 18): nur Prüf-Blockkarten sind
  // Drop-Ziel — und nur, solange das Schaubild bearbeitbar ist.
  const nimmtKarten = bearbeitbar && def.prueft
  return (
    <div
      className={
        'schaubild-karte kategorie-' + blockKategorie(def) + (aktiv ? ' block-laeuft' : '')
      }
      style={{ left: eintrag.position.x, top: eintrag.position.y }}
      data-instanz={eintrag.instanzId}
      ref={messen}
      onPointerDown={bearbeitbar ? onGreifen : undefined}
      onDragOver={
        nimmtKarten
          ? (e) => {
              if (e.dataTransfer.types.includes('text/flowforge-karte')) e.preventDefault()
            }
          : undefined
      }
      onDrop={nimmtKarten ? onKarteAbgelegt : undefined}
    >
      {/* Kategorie-Kicker (Mockup 3b): Arbeitsblock / Prüf-Block / Eigener Block. */}
      <span className="karte-kicker">
        {def.id?.startsWith('eigen-')
          ? tk.kickerEigen
          : def.prueft
            ? tk.kickerPruef
            : tk.kickerArbeit}
      </span>
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
      {/* Angehängte Prüfkarten (BAUPLAN 18): hängen sichtbar an der Karte;
          der Prüfer führt ihre aufbewahrten Prüfungen zusätzlich aus. */}
      {def.prueft && (pruefKarten.length > 0 || (bearbeitbar && zeigePruefkartenTipp)) && (
        <div className="pruefkarten-anhang" title={texte.pruefkarten.anhangTitel}>
          {pruefKarten.map((karte) => (
            <span key={karte.id} className="kontext-chip chip-pruefung" title={karte.text}>
              <span className="chip-text">{karte.titel}</span>
              {bearbeitbar && (
                <button
                  className="chip-entfernen"
                  title={texte.pruefkarten.entfernen}
                  onClick={() => onPruefkarteEntfernen(karte.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {pruefKarten.length === 0 && (
            <p className="feld-hinweis">{texte.pruefkarten.ziehHinweis}</p>
          )}
        </div>
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
      {def.prueft && <PruefmappenBereich pfad={pfad} />}
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

export default function Leinwand({
  pfad,
  initialTab,
  karten,
  kontingentVerhalten,
  onKontingentVerhalten,
  onWiederhergestellt
}) {
  // zustand: 'bereit' (Schaubild bearbeiten) | 'wartet' (in der Warteschlange,
  // BAUPLAN 12) | 'laeuft' | 'fertig'
  const [zustand, setZustand] = useState('bereit')
  // Parallelität (SPEC §5): wie viele Läufe insgesamt aktiv sind (für den
  // Verbrauchs-Hinweis) und ob dieses Projekt in der Warteschlange steht.
  const [laufAnzahl, setLaufAnzahl] = useState(0)
  const [wartePosition, setWartePosition] = useState(0)
  const [workflow, setWorkflow] = useState(null)
  const [meldung, setMeldung] = useState('')
  // Bei parallelen Zweigen laufen mehrere Karten gleichzeitig (BAUPLAN 13).
  const [aktiveInstanzen, setAktiveInstanzen] = useState(() => new Set())
  const [ticker, setTicker] = useState([])
  const [roh, setRoh] = useState([])
  const [rohOffen, setRohOffen] = useState(false)
  // Verbrauch je Block (instanzId → Verbrauch) — parallele Blöcke melden
  // gleichzeitig; angezeigt wird eine Zeile pro laufendem Block.
  const [verbraeuche, setVerbraeuche] = useState({})
  const [letzterVerbrauch, setLetzterVerbrauch] = useState(null)
  const [frage, setFrage] = useState(null)
  const [entscheidung, setEntscheidung] = useState(null)
  // Gespräch mit dem Agenten: offene Frage + bisheriger Verlauf dieses Laufs.
  const [menschFrage, setMenschFrage] = useState(null)
  const [gespraech, setGespraech] = useState([])
  const [ergebnis, setErgebnis] = useState(null)
  const [fehler, setFehler] = useState('')
  const [berichte, setBerichte] = useState([])
  // Laufberichte-Filter nach Ausgang (BAUPLAN 15): 'alle' oder ein Zustand.
  const [berichtFilter, setBerichtFilter] = useState('alle')
  const [modus, setModus] = useState('abo')
  // Vorschau: null = zu, sonst { punkt, unterschiede }
  const [punkte, setPunkte] = useState([])
  const [vorschau, setVorschau] = useState(null)
  const [sicherungsMeldung, setSicherungsMeldung] = useState('')
  // Wiederaufnahme-Angebot nach Neustart mitten im Lauf (BAUPLAN 11):
  // null = keins, sonst { gestartetAm, blockName }.
  const [wiederaufnahme, setWiederaufnahme] = useState(null)
  // Tabs der Mittelspalte (Feedback Georg, 07.08.2026): Schaubild, Lauf,
  // Berichte und Sicherungspunkte gestapelt wurden unübersichtlich.
  // initialTab: „Zum Gespräch"/„Zum Lauf" auf der Projektübersicht öffnen
  // das Projekt direkt mit dem Lauf-Tab vorn.
  const [tab, setTab] = useState(
    ['schaubild', 'lauf', 'berichte', 'punkte'].includes(initialTab) ? initialTab : 'schaubild'
  )
  // Eigener Bestätigungs-Dialog statt window.confirm (Bugfix 13.08.2026):
  // null = zu, sonst { frage, knopf, gefahr, aktion }.
  const [bestaetigung, setBestaetigung] = useState(null)
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
      if (!e.ok) return
      setLaufAnzahl(e.laufAnzahl ?? 0)
      setWartePosition(e.wartePosition ?? 0)
      if (!e.aktiv) {
        // Wartet das Projekt in der Warteschlange, zeigt der Lauf-Tab das an.
        if (e.wartet) {
          setZustand('wartet')
          setTab('lauf')
          return
        }
        // Kein aktiver Lauf, aber ein liegen gebliebener Laufstand? Dann wurde
        // die App mitten im Lauf beendet — Wiederaufnahme anbieten (SPEC §3.3).
        window.flowforge.laufstandInfo(pfad).then((info) => {
          if (info.ok && info.vorhanden)
            setWiederaufnahme({ gestartetAm: info.gestartetAm, blockName: info.blockName })
        })
        return
      }
      setZustand('laeuft')
      setTab('lauf')
      setAktiveInstanzen(new Set(e.blockInstanzIds ?? []))
      if (e.frage) setFrage(e.frage)
      if (e.entscheidung) setEntscheidung(e.entscheidung)
      if (e.menschFrage) setMenschFrage(e.menschFrage)
      if (e.gespraech) setGespraech(e.gespraech)
    })
    const abmelden = window.flowforge.aufLaufEreignis((ereignis) => {
      // Läufe-Übersicht (BAUPLAN 12): kommt ohne Projektpfad an alle Ansichten —
      // sie speist Verbrauchs-Hinweis und Warteschlangen-Anzeige.
      if (ereignis.art === 'laeufe') {
        setLaufAnzahl(ereignis.aktive.length)
        const position = ereignis.warteschlange.indexOf(pfad) + 1
        setWartePosition(position)
        if (position === 0 && !ereignis.aktive.includes(pfad))
          setZustand((z) => (z === 'wartet' ? 'bereit' : z))
        return
      }
      if (ereignis.projektPfad !== pfad) return
      if (ereignis.art === 'zustand' && ereignis.zustand === 'laeuft') {
        // Ein frischer Lauf beginnt — auch von allein aus der Warteschlange.
        // Die Anzeige des vorigen Laufs wird geleert wie bei einem Handstart.
        setTicker([])
        setRoh([])
        setVerbraeuche({})
        setLetzterVerbrauch(null)
        setErgebnis(null)
        setGespraech([])
        setMenschFrage(null)
        setFrage(null)
        setEntscheidung(null)
        setAktiveInstanzen(new Set())
        setZustand('laeuft')
        setTab('lauf')
      }
      // Der automatische Start aus der Warteschlange hat nicht geklappt
      // (z.B. Schaubild inzwischen verändert) — ehrlich anzeigen.
      if (ereignis.art === 'warteschlange-fehler') {
        setZustand((z) => (z === 'wartet' ? 'bereit' : z))
        setFehler(texte.lauf.warteschlangeFehler(ereignis.fehler))
        setTab('schaubild')
      }
      if (ereignis.art === 'block')
        setAktiveInstanzen((alt) => new Set(alt).add(ereignis.instanzId))
      if (ereignis.art === 'block-fertig')
        setAktiveInstanzen((alt) => {
          const neu = new Set(alt)
          neu.delete(ereignis.instanzId)
          return neu
        })
      if (ereignis.art === 'ticker')
        // instanzId kommt bei Motor-Zeilen mit — daran hängt die Blockfarbe
        // im Liveticker (Wunsch Georg, 13.08.2026). FlowForge-eigene Zeilen
        // (Sicherungspunkte, Blockstart …) bleiben neutral.
        setTicker((alt) => [
          ...alt,
          { zeit: new Date(), text: ereignis.text, instanzId: ereignis.instanzId ?? null }
        ])
      if (ereignis.art === 'roh') setRoh((alt) => [...alt, ereignis.zeile])
      if (ereignis.art === 'verbrauch') {
        setLetzterVerbrauch(ereignis.verbrauch)
        if (ereignis.instanzId)
          setVerbraeuche((alt) => ({ ...alt, [ereignis.instanzId]: ereignis.verbrauch }))
      }
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
        setAktiveInstanzen(new Set())
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
  // Im versteckten Schaubild (anderer Tab aktiv) misst der Browser 0 — dann die
  // letzten echten Größen behalten.
  useLayoutEffect(() => {
    const neu = {}
    for (const [id, el] of kartenRefs.current)
      if (el.offsetWidth > 0) neu[id] = { w: el.offsetWidth, h: el.offsetHeight }
    if (Object.keys(neu).length === 0) return
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

  // Vorlage (SPEC §4.4): legt eine ganze Kette fertig verbunden ab.
  function vorlageAblegen(vorlage) {
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
  }

  function neuAblegen(e) {
    e.preventDefault()
    const vorlageId = e.dataTransfer.getData('text/flowforge-vorlage')
    if (vorlageId) {
      const vorlage = vorlageDefinition(vorlageId)
      if (!vorlage) return
      // Liegt schon etwas auf der Leinwand, ersetzt die Vorlage es — aber nur
      // nach Rückfrage (Feedback Georg, 07.08.2026: erst Spec-Interview, dann
      // Bau-Vorlage auf dieselbe Leinwand). Eigener Dialog statt window.confirm.
      if (workflow.bloecke.length > 0)
        return setBestaetigung({
          frage: tk.vorlageErsetzenBestaetigung,
          knopf: texte.bestaetigung.ersetzen,
          aktion: () => vorlageAblegen(vorlage)
        })
      vorlageAblegen(vorlage)
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

  // Prüfkarten auf den Prüfer ziehen (BAUPLAN 18): Die Karte hängt danach
  // sichtbar an der Prüf-Blockkarte; beim nächsten Lauf legt FlowForge ihre
  // aufbewahrten Prüfungen in die Prüfmappe und der Prüfer führt sie mit aus.
  function pruefkarteAbgelegt(e, eintrag) {
    const id = e.dataTransfer.getData('text/flowforge-karte')
    if (!id) return
    e.preventDefault()
    e.stopPropagation()
    const karte = (karten ?? []).find((k) => k.id === id)
    if (!karte || karte.sorte !== 'pruefung') return setMeldung(texte.pruefkarten.nurPruefkarten)
    if ((eintrag.pruefKarten ?? []).includes(id)) return
    ketteSpeichern({
      ...workflow,
      bloecke: workflow.bloecke.map((b) =>
        b.instanzId === eintrag.instanzId
          ? { ...b, pruefKarten: [...(b.pruefKarten ?? []), id] }
          : b
      )
    })
  }

  function pruefkarteEntfernen(instanzId, kartenId) {
    ketteSpeichern({
      ...workflow,
      bloecke: workflow.bloecke.map((b) =>
        b.instanzId === instanzId
          ? { ...b, pruefKarten: (b.pruefKarten ?? []).filter((id) => id !== kartenId) }
          : b
      )
    })
  }

  function rundenSetzen(wert) {
    const runden = Math.max(0, Math.min(REPARATUR_RUNDEN_MAX, Number(wert) || 0))
    ketteSpeichern({ ...workflow, reparaturRunden: runden })
  }

  // Übertragsgrenze pro Workflow (SPEC §5): leeres Feld heißt unbegrenzt.
  function grenzeSetzen(wert) {
    if (String(wert).trim() === '') return ketteSpeichern({ ...workflow, uebertragGrenze: null })
    const grenze = Math.max(0, Math.min(UEBERTRAG_GRENZE_MAX, Number(wert) || 0))
    ketteSpeichern({ ...workflow, uebertragGrenze: grenze })
  }

  // --- Wiederaufnahme nach Neustart mitten im Lauf (BAUPLAN 11) -------------

  async function wiederaufnahmeStarten() {
    setWiederaufnahme(null)
    setFehler('')
    setTicker([])
    setRoh([])
    setVerbraeuche({})
    setLetzterVerbrauch(null)
    setErgebnis(null)
    setGespraech([])
    const antwort = await window.flowforge.laufFortsetzen(pfad)
    if (!antwort.ok) setFehler(antwort.fehler)
    // Sind alle Plätze belegt, wartet auch die Wiederaufnahme in der Schlange.
    if (antwort.ok && antwort.wartet) {
      setWartePosition(antwort.position ?? 1)
      setZustand('wartet')
      setTab('lauf')
    }
    // Das Zurücksetzen auf den Sicherungspunkt kann Karten verändert haben.
    onWiederhergestellt?.()
  }

  async function wiederaufnahmeVerwerfen() {
    setWiederaufnahme(null)
    await window.flowforge.laufstandVerwerfen(pfad)
  }

  // --- Kartenvorauswahl für den Lauf ---------------------------------------

  function kontextAuswahl() {
    // Feste Sortierung nach Sorte (Feedback Georg, 07.08.2026): Status zuerst,
    // dann Aufgaben, Entscheidungen, Wissen — statt Anlege-Reihenfolge.
    const sortenReihenfolge = { status: 0, aufgabe: 1, entscheidung: 2, wissen: 3 }
    return (karten ?? [])
      .filter(
        (k) =>
          k.sorte === 'status' ||
          kontextZusatz.has(k.id) ||
          (k.sorte === 'aufgabe' && !k.erledigt && !kontextRaus.has(k.id))
      )
      .sort((a, b) => (sortenReihenfolge[a.sorte] ?? 9) - (sortenReihenfolge[b.sorte] ?? 9))
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
    // Die Lauf-Anzeige leert das „Lauf startet"-Ereignis — so wird sie auch
    // bei automatischen Starts aus der Warteschlange frisch (BAUPLAN 12).
    const kartenIds = kontextAuswahl()
      .filter((k) => k.sorte !== 'status')
      .map((k) => k.id)
    const antwort = await window.flowforge.laufStarten(pfad, kartenIds)
    if (!antwort.ok) return setFehler(antwort.fehler)
    // Projekt belegt oder alle Plätze vergeben: der Start wartet sichtbar.
    if (antwort.wartet) {
      setWartePosition(antwort.position ?? 1)
      setZustand((z) => (z === 'laeuft' ? z : 'wartet'))
      setTab('lauf')
    }
  }

  async function warteschlangeVerlassen() {
    await window.flowforge.laufWarteschlangeVerlassen(pfad)
    setWartePosition(0)
    setZustand((z) => (z === 'wartet' ? 'bereit' : z))
  }

  function hartStoppen() {
    setBestaetigung({
      frage: t.hartStoppenBestaetigung,
      knopf: texte.bestaetigung.sofortAbbrechen,
      gefahr: true,
      aktion: () => window.flowforge.laufHartStoppen(pfad)
    })
  }

  function fertigText(z) {
    if (z === 'erfolgreich') return t.fertigErfolgreich
    if (z === 'sanft-gestoppt') return t.fertigSanft
    if (z === 'hart-abgebrochen') return t.fertigHart
    if (z === 'zurueckgestellt') return t.fertigZurueckgestellt
    if (z === 'wiederhergestellt') return t.fertigWiederhergestellt
    if (z === 'kontingent-erschoepft') return t.fertigKontingent
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
  // Prüfkarten des Projekts (BAUPLAN 18) — für die Anhänge an Prüf-Blockkarten;
  // gelöschte Karten fallen beim Auflösen still heraus.
  const pruefungsKarten = (karten ?? []).filter((k) => k.sorte === 'pruefung')

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

  // Offene Fragen ziehen den Blick auf den Lauf-Tab, auch wenn Georg gerade
  // woanders ist.
  const laufBrauchtDich = Boolean(frage || entscheidung || menschFrage)
  // Läufe in anderen Projekten — der laufende dieses Projekts zählt nicht mit.
  const andereLaeufe = laufAnzahl - (zustand === 'laeuft' ? 1 : 0)
  const tabs = [
    ['schaubild', texte.projektansicht.tabSchaubild],
    ['lauf', texte.projektansicht.tabLauf],
    ['berichte', `${texte.projektansicht.tabBerichte} (${berichte.length})`],
    ['punkte', `${texte.projektansicht.tabPunkte} (${punkte.length})`]
  ]

  return (
    <div className="leinwand">
      <div className="tab-leiste">
        {tabs.map(([wert, titel]) => (
          <button
            key={wert}
            className={'tab-knopf' + (tab === wert ? ' tab-aktiv' : '')}
            onClick={() => setTab(wert)}
          >
            {titel}
            {wert === 'lauf' && zustand === 'laeuft' && <span className="tab-marke">{t.laeuft}</span>}
            {wert === 'lauf' && zustand !== 'laeuft' && wartePosition > 0 && (
              <span className="tab-marke">{t.wartetMarke}</span>
            )}
            {wert === 'lauf' && laufBrauchtDich && <span className="tab-punkt" />}
          </button>
        ))}
      </div>

      {tab === 'schaubild' && meldung && <p className="fehlermeldung">{meldung}</p>}
      {tab === 'schaubild' && fehler && <p className="fehlermeldung">{fehler}</p>}

      {tab === 'schaubild' && (
        <div className="kette-kopf">
          {/* Der Start-Knopf bleibt auch während eines Laufs sichtbar (BAUPLAN
              12): ein weiterer Start wartet dann in der Warteschlange und
              läuft von allein an, sobald Platz ist. */}
          <button
            className="knopf-start"
            disabled={bloecke.length === 0 || wartePosition > 0}
            title={wartePosition > 0 ? t.schonInWarteschlange : undefined}
            onClick={starten}
          >
            ▶ {tk.starten}
          </button>
          <label className="runden-feld" title={tk.reparaturRundenHinweis}>
            {tk.reparaturRundenLabel}
            <input
              type="number"
              min="0"
              max={REPARATUR_RUNDEN_MAX}
              disabled={!bearbeitbar}
              value={workflow.reparaturRunden}
              onChange={(e) => rundenSetzen(e.target.value)}
            />
          </label>
          <label className="runden-feld" title={tk.uebertragGrenzeHinweis}>
            {tk.uebertragGrenzeLabel}
            <input
              type="number"
              min="0"
              max={UEBERTRAG_GRENZE_MAX}
              placeholder="∞"
              title={tk.uebertragUnbegrenzt}
              disabled={!bearbeitbar}
              value={workflow.uebertragGrenze ?? ''}
              onChange={(e) => grenzeSetzen(e.target.value)}
            />
          </label>
          <label className="runden-feld" title={tk.kontingentHinweis}>
            {tk.kontingentLabel}
            <select
              value={kontingentVerhalten}
              onChange={(e) => onKontingentVerhalten?.(e.target.value)}
            >
              <option value="pausieren">{tk.kontingentPausieren}</option>
              <option value="stoppen">{tk.kontingentStoppen}</option>
            </select>
          </label>
        </div>
      )}

      {/* Sichtbarer Hinweis (SPEC §5, BAUPLAN 12): parallele Läufe
          vervielfachen den Verbrauch. */}
      {tab === 'schaubild' && andereLaeufe > 0 && (
        <p className="feld-hinweis">⚠ {t.parallelStartHinweis(andereLaeufe)}</p>
      )}

      {tab === 'schaubild' && bearbeitbar && (
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
            <span
              key={karte.id}
              className={'kontext-chip chip-' + karte.sorte}
              title={texte.karten.sorten[karte.sorte] + ': ' + karte.titel}
            >
              <span className="chip-text">
                {texte.karten.sorten[karte.sorte]}: {karte.titel}
              </span>
              {karte.sorte === 'status' ? (
                <em className="chip-fest">{ta.immerDabei}</em>
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
        style={tab === 'schaubild' ? undefined : { display: 'none' }}
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
                {/* Pfeilspitzen-Farbe = .pfeil-linie (--akzent-hell); marker-fill
                    kann keine CSS-Variablen aus Klassen erben. */}
                <path d="M0,0 L10,4 L0,8 z" fill="#3b82f6" />
              </marker>
              <marker
                id="pfeilspitze-vorschau"
                markerWidth="10"
                markerHeight="8"
                refX="9"
                refY="4"
                orient="auto"
              >
                {/* Vorschau-Pfeilspitze = .pfeil-vorschau (--akzent-text). */}
                <path d="M0,0 L10,4 L0,8 z" fill="#7db0ff" />
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
                vorfahren={vorfahrenSortiert(bloecke, pfeile, eintrag.instanzId)}
                nummern={nummern}
                bearbeitbar={bearbeitbar}
                aktiv={aktiveInstanzen.has(eintrag.instanzId)}
                letztesErgebnis={letzteErgebnisse.get(eintrag.instanzId) ?? null}
                pfad={pfad}
                pruefKarten={(eintrag.pruefKarten ?? [])
                  .map((id) => pruefungsKarten.find((k) => k.id === id))
                  .filter(Boolean)}
                zeigePruefkartenTipp={pruefungsKarten.length > 0}
                onKarteAbgelegt={(e) => pruefkarteAbgelegt(e, eintrag)}
                onPruefkarteEntfernen={(id) => pruefkarteEntfernen(eintrag.instanzId, id)}
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

      {tab === 'lauf' && zustand === 'bereit' && ticker.length === 0 && (
        <p className="feld-hinweis">{texte.projektansicht.tabLaufLeer}</p>
      )}
      {/* Warteschlange (BAUPLAN 12): der Start wartet sichtbar und läuft von
          allein an, sobald ein Platz frei ist. */}
      {tab === 'lauf' && zustand === 'wartet' && (
        <div className="lauf-ansicht">
          <p className="feld-hinweis">{t.wartetHinweis(wartePosition)}</p>
          {laufAnzahl > 0 && (
            <p className="feld-hinweis">⚠ {t.parallelStartHinweis(laufAnzahl)}</p>
          )}
          <div className="lauf-knoepfe">
            <button className="knopf-sekundaer knopf-klein" onClick={warteschlangeVerlassen}>
              {t.warteschlangeVerlassen}
            </button>
          </div>
        </div>
      )}
      {tab === 'lauf' && zustand !== 'wartet' && !(zustand === 'bereit' && ticker.length === 0) && (
        <div className="lauf-ansicht">
          {/* Laufen mehrere Blöcke parallel, bekommt jeder seine eigene
              Verbrauchszeile — sonst genügt die letzte Meldung. */}
          {(() => {
            const aktive = [...aktiveInstanzen].filter((id) => verbraeuche[id])
            if (aktive.length === 0)
              return <VerbrauchZeile verbrauch={letzterVerbrauch} modus={modus} mitBalken />
            return aktive.map((id) => (
              <VerbrauchZeile
                key={id}
                verbrauch={verbraeuche[id]}
                modus={modus}
                mitBalken
                label={
                  aktive.length > 1
                    ? blockDefinition(bloecke.find((b) => b.instanzId === id)?.blockId)?.name
                    : null
                }
              />
            ))
          })()}

          {zustand === 'laeuft' && laufAnzahl > 1 && (
            <p className="feld-hinweis">⚠ {t.parallelHinweis(laufAnzahl)}</p>
          )}
          {wartePosition > 0 && (
            <p className="feld-hinweis">
              {t.folgelaufWartet}{' '}
              <button className="knopf-klein" onClick={warteschlangeVerlassen}>
                {t.warteschlangeVerlassen}
              </button>
            </p>
          )}

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

          {/* Welcher Block arbeitet gerade? (Wunsch Georg, 13.08.2026) —
              Chips in der Kategorie-Farbe der Leinwand, bei parallelen
              Zweigen mehrere gleichzeitig. */}
          {zustand === 'laeuft' && aktiveInstanzen.size > 0 && (
            <p className="lauf-aktive">
              {t.geradeArbeitet(aktiveInstanzen.size)}
              {[...aktiveInstanzen].map((id) => {
                const def = blockDefinition(bloecke.find((b) => b.instanzId === id)?.blockId)
                if (!def) return null
                return (
                  <span key={id} className={'lauf-aktiv-chip kategorie-' + blockKategorie(def)}>
                    {def.symbol} {def.name}
                  </span>
                )
              })}
            </p>
          )}

          <div className="ticker">
            {ticker.map((zeile, i) => {
              // Motor-Zeilen tragen die Farbe und das Etikett ihres Blocks —
              // so ist auf einen Blick zu sehen, wer gerade spricht.
              const def = zeile.instanzId
                ? blockDefinition(
                    bloecke.find((b) => b.instanzId === zeile.instanzId)?.blockId
                  )
                : null
              return (
                <p
                  key={i}
                  className={'ticker-zeile' + (def ? ' ticker-' + blockKategorie(def) : '')}
                >
                  <span className="ticker-zeit">{zeile.zeit.toLocaleTimeString('de-DE')}</span>
                  {def && (
                    <span className="ticker-block">
                      {def.symbol} {def.name}
                    </span>
                  )}
                  {zeile.text}
                </p>
              )
            })}
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
              <button
                className="knopf-sekundaer knopf-klein"
                onClick={() => {
                  setZustand('bereit')
                  setTab('schaubild')
                }}
              >
                {t.okKnopf}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'berichte' && (
        <div className="berichte-bereich">
          {berichte.length === 0 && <p className="feld-hinweis">{tb.keine}</p>}
          {berichte.length > 0 && (
            <div className="filter-zeile">
              {/* Als Filter erscheinen nur Ausgänge, die es wirklich gibt. */}
              {[
                ['alle', tb.filterAlle, berichte.length],
                ...[...new Set(berichte.map((b) => b.zustand))].map((zustand) => [
                  zustand,
                  t.zustandLabels[zustand] ?? zustand,
                  berichte.filter((b) => b.zustand === zustand).length
                ])
              ].map(([wert, titel, anzahl]) => (
                <button
                  key={wert}
                  className={'filter-chip' + (berichtFilter === wert ? ' filter-aktiv' : '')}
                  onClick={() => setBerichtFilter(wert)}
                >
                  {titel} ({anzahl})
                </button>
              ))}
            </div>
          )}
          {(() => {
            const gefiltert = berichte.filter(
              (b) => berichtFilter === 'alle' || b.zustand === berichtFilter
            )
            if (berichte.length > 0 && gefiltert.length === 0)
              return <p className="feld-hinweis">{tb.keineZumFilter}</p>
            return gefiltert.map((bericht) => (
              <Laufbericht key={bericht.id} bericht={bericht} />
            ))
          })()}
        </div>
      )}

      {tab === 'punkte' && (
        <div className="berichte-bereich">
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
      )}

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

      {wiederaufnahme && zustand === 'bereit' && (
        <div className="dialog-schleier">
          <div className="dialog">
            <h2>{tw.ueberschrift}</h2>
            <p className="frage-text">
              {tw.einleitung(zeitText(wiederaufnahme.gestartetAm), wiederaufnahme.blockName)}
            </p>
            <p className="feld-hinweis">{tw.verwerfenHinweis}</p>
            <div className="dialog-knoepfe">
              <button className="knopf-sekundaer" onClick={wiederaufnahmeVerwerfen}>
                {tw.verwerfen}
              </button>
              <button className="knopf-primaer" onClick={wiederaufnahmeStarten}>
                {tw.weitermachen}
              </button>
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

      {bestaetigung && (
        <Bestaetigung
          frage={bestaetigung.frage}
          knopf={bestaetigung.knopf}
          gefahr={bestaetigung.gefahr}
          onBestaetigen={() => {
            const aktion = bestaetigung.aktion
            setBestaetigung(null)
            aktion?.()
          }}
          onAbbrechen={() => setBestaetigung(null)}
        />
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
