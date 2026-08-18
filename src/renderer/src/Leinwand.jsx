import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  blockDefinition,
  vorlageDefinition,
  blockKategorie,
  blockModellKlasse,
  blockAnzeigeName,
  pruefOrdnerFuer,
  MODELL_KLASSEN,
  ZUSATZNAME_MAX,
  REPARATUR_RUNDEN_MAX,
  UEBERTRAG_GRENZE_MAX
} from '../../shared/blockKatalog.js'
import {
  brauchtHerkunft,
  rueckfuehrungsZiel,
  schaubildReihenfolge,
  vorfahrenSortiert
} from '../../shared/kettenRegeln.js'
import { beanstandungZeile, fundZeile, zuschnitteAusMeldung } from '../../shared/lieferschein.js'
import { BlockChips } from './Blockbibliothek.jsx'
import Bestaetigung from './Bestaetigung.jsx'
import VerbrauchZeile from './VerbrauchZeile.jsx'
import Metriken from './Metriken.jsx'
import AppTab from './AppTab.jsx'

const t = texte.lauf
const tk = texte.kette
const ta = texte.kartenAuswahl
const tn = texte.laufVorschlag
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

// Anzeigename einer Schaubild-Karte (BAUPLAN 41): Katalogname plus Zusatzname
// — dieselbe Auflösung wie im Lauf, damit Ticker und Karte dasselbe sagen.
function anzeigeNameVon(bloecke, instanzId) {
  const eintrag = (bloecke ?? []).find((b) => b.instanzId === instanzId)
  return blockAnzeigeName(blockDefinition(eintrag?.blockId), eintrag)
}

function groesseText(bytes) {
  if (bytes < 1024) return tp.groesseBytes(bytes)
  return tp.groesseKb(Math.max(1, Math.round(bytes / 1024)))
}

// Prüfmappen-Ansicht an der Prüferkarte (BAUPLAN 17): aufklappbar wie das
// Block-Ergebnis, in Alltagssprache — welche Prüfungen der letzte Lauf
// hinterlassen hat. Seit BAUPLAN 41 zeigt jede Prüferkarte ihren EIGENEN
// Prüfordner; gelesen wird beim Aufklappen frisch.
function PruefmappenBereich({ pfad, ordner = '' }) {
  const [offen, setOffen] = useState(false)
  const [dateien, setDateien] = useState(null)
  function umschalten() {
    const jetztOffen = !offen
    setOffen(jetztOffen)
    if (jetztOffen)
      window.flowforge.pruefmappeLesen(pfad, ordner).then((e) => setDateien(e.ok ? e.dateien : []))
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
          {ordner && <p className="feld-hinweis">{tp.eigenerOrdner(ordner)}</p>}
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

// Karten-Vorschlag des Karten-Prüfers (BAUPLAN 26): alter Kartentext,
// Vorschlag und Begründung — du entscheidest je Karte: „Übernehmen" wendet
// den Vorschlag unverändert an, „Vorschlag bearbeiten" öffnet die Felder
// (harte Längengrenzen, geprüft im Hauptprozess), „Ablehnen" lässt die Karte
// in Ruhe. Angewendet wird immer von FlowForge, nie vom Agenten.
// Sammel-Dialog „Themen sortieren" (BAUPLAN 30): eine Tabelle aller
// betroffenen Karten mit vorgeschlagenem Thema — je Zeile änderbar oder
// abgelehnt, „Alle übernehmen" / „Alle ablehnen". Angreifer-Fund: 60 Karten im
// Einzeldialog wären 60 pausierende Dialoge.
function ThemenVorschlag({ eintrag, onAntwort }) {
  const tv = texte.vorschlag
  const v = eintrag.vorschlag
  const [zeilen, setZeilen] = useState([])
  const [fehler, setFehler] = useState('')
  useEffect(() => {
    setZeilen((v?.eintraege ?? []).map((z) => ({ ...z, wert: z.thema, abgelehnt: false })))
    setFehler('')
  }, [eintrag.frageId])
  if (!v) return null

  function zeileSetzen(idx, aenderung) {
    setZeilen((alt) => alt.map((z, i) => (i === idx ? { ...z, ...aenderung } : z)))
  }

  async function alleUebernehmen() {
    const eintraege = zeilen
      .filter((z) => !z.abgelehnt && z.wert.trim())
      .map((z) => ({ kartenId: z.kartenId, thema: z.wert.trim() }))
    const ergebnis = await onAntwort(
      eintrag.frageId,
      eintraege.length ? 'uebernehmen' : 'ablehnen',
      eintraege.length ? { eintraege } : null
    )
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler)
  }

  const themenBekannt = [...new Set(zeilen.map((z) => z.thema))]
  return (
    <div className="gespraech">
      <p className="gespraech-titel">{tv.themenUeberschrift}</p>
      <p className="feld-hinweis">{tv.themenHinweis}</p>
      <div className="themen-tabelle-rahmen">
        <table className="themen-tabelle">
          <thead>
            <tr>
              <th>{tv.themenSpalteKarte}</th>
              <th>{tv.themenSpalteBisher}</th>
              <th>{tv.themenSpalteNeu}</th>
              <th>{tv.themenAblehnenZeile}</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, idx) => (
              <tr key={z.kartenId} className={z.abgelehnt ? 'themen-zeile-abgelehnt' : ''}>
                <td>
                  <span className="karte-sorte">{texte.karten.sorten[z.sorte] ?? z.sorte}</span>{' '}
                  {z.titel}
                </td>
                <td>{z.altesThema ?? tv.themenKeins}</td>
                <td>
                  <input
                    list="themen-vorschlag-liste"
                    value={z.wert}
                    disabled={z.abgelehnt}
                    onChange={(e) => zeileSetzen(idx, { wert: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={z.abgelehnt}
                    onChange={(e) => zeileSetzen(idx, { abgelehnt: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="themen-vorschlag-liste">
          {themenBekannt.map((thema) => (
            <option key={thema} value={thema} />
          ))}
        </datalist>
      </div>
      <p className="bericht-abschnitt">{tv.begruendungLabel}</p>
      <p className="bericht-zeile">{v.begruendung}</p>
      {fehler && <p className="fehlermeldung">{fehler}</p>}
      <div className="gespraech-optionen">
        <button className="gespraech-option" onClick={alleUebernehmen}>
          <span className="option-empfohlen">{texte.gespraech.empfohlen}</span>
          {tv.themenAlleUebernehmen}
        </button>
        <button className="gespraech-option" onClick={() => onAntwort(eintrag.frageId, 'ablehnen', null)}>
          {tv.themenAlleAblehnen}
        </button>
      </div>
    </div>
  )
}

function KartenVorschlag({ eintrag, onAntwort }) {
  const tv = texte.vorschlag
  const v = eintrag.vorschlag
  const [bearbeiten, setBearbeiten] = useState(false)
  const [titel, setTitel] = useState('')
  const [text, setText] = useState('')
  const [thema, setThema] = useState('')
  const [fehler, setFehler] = useState('')
  // Frischer Vorschlag → Bearbeitungszustand zurücksetzen.
  useEffect(() => {
    setBearbeiten(false)
    setTitel(v?.titel ?? '')
    setText(v?.text ?? '')
    setThema(v?.thema ?? '')
    setFehler('')
  }, [eintrag.frageId])
  if (!v) return null
  if (v.art === 'thema') return <ThemenVorschlag eintrag={eintrag} onAntwort={onAntwort} />

  const mitFeldern = v.art === 'aktualisieren' || v.art === 'anlegen'
  const titelFest = v.art === 'aktualisieren' && v.alteKarte?.sorte === 'status'
  const sorteLabel = v.alteKarte ? (texte.karten.sorten[v.alteKarte.sorte] ?? v.alteKarte.sorte) : null

  async function antworten(wahl, felder) {
    const ergebnis = await onAntwort(eintrag.frageId, wahl, felder ?? null)
    // Scheitert das Anwenden (z.B. Längengrenze), bleibt der Vorschlag offen.
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler)
  }

  return (
    <div className="gespraech">
      <p className="gespraech-titel">{tv.ueberschrift}</p>
      <div className="gespraech-verlauf">
        <div className="gespraech-blase blase-agent blase-offen">
          <p className="bericht-abschnitt">
            {tv.artLabels[v.art] ?? v.art}
            {v.alteKarte ? ` — [${sorteLabel}] „${v.alteKarte.titel}"` : ''}
          </p>
          {v.alteKarte && (
            <>
              <p className="bericht-abschnitt">{tv.bisher}</p>
              <p className="bericht-zeile">{v.alteKarte.text}</p>
            </>
          )}
          {v.art === 'loeschen' && <p className="bericht-zeile">{tv.loeschenHinweis}</p>}
          {v.art === 'erledigen' && <p className="bericht-zeile">{tv.erledigenHinweis}</p>}
          {v.art === 'oeffnen' && <p className="bericht-zeile">{tv.oeffnenHinweis}</p>}
          {mitFeldern && !bearbeiten && (
            <>
              <p className="bericht-abschnitt">{tv.neu}</p>
              {!titelFest && v.titel !== v.alteKarte?.titel && (
                <p className="bericht-zeile">„{v.titel}"</p>
              )}
              <p className="bericht-zeile">{v.text}</p>
              {v.art === 'anlegen' && v.thema && (
                <p className="bericht-zeile">{texte.karten.themaMarke(v.thema)}</p>
              )}
            </>
          )}
          <p className="bericht-abschnitt">{tv.begruendungLabel}</p>
          <p className="bericht-zeile">{v.begruendung}</p>
        </div>
      </div>
      {bearbeiten ? (
        <div className="gespraech-eingabe">
          {!titelFest && (
            <label className="feld">
              <span>{tv.titelFeld}</span>
              <input value={titel} onChange={(e) => setTitel(e.target.value)} />
            </label>
          )}
          <label className="feld">
            <span>{tv.textFeld}</span>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {v.art === 'anlegen' && (
            <label className="feld">
              <span>{tv.themaFeld}</span>
              <input list="themen-liste" value={thema} onChange={(e) => setThema(e.target.value)} />
            </label>
          )}
          {fehler && <p className="fehlermeldung">{fehler}</p>}
          <div className="gespraech-optionen">
            <button
              className="knopf-primaer knopf-klein"
              disabled={!text.trim() || (!titelFest && !titel.trim())}
              onClick={() =>
                antworten('uebernehmen', v.art === 'anlegen' ? { titel, text, thema } : { titel, text })
              }
            >
              {tv.soUebernehmen}
            </button>
            <button className="knopf-sekundaer knopf-klein" onClick={() => setBearbeiten(false)}>
              {tv.zurueck}
            </button>
          </div>
        </div>
      ) : (
        <div className="gespraech-eingabe">
          {fehler && <p className="fehlermeldung">{fehler}</p>}
          <div className="gespraech-optionen">
            <button className="gespraech-option" onClick={() => antworten('uebernehmen')}>
              <span className="option-empfohlen">{texte.gespraech.empfohlen}</span>
              {tv.uebernehmen}
            </button>
            {mitFeldern && (
              <button className="gespraech-option" onClick={() => setBearbeiten(true)}>
                {tv.bearbeiten}
              </button>
            )}
            <button className="gespraech-option" onClick={() => antworten('ablehnen')}>
              {tv.ablehnen}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Lieferschein (BAUPLAN 42, SPEC §6): Das Blockergebnis steht als gegliederte
// Abschnitte da statt als Textblock — jede Beanstandung mit Fundort. Alte
// Berichte tragen keine Meldungen; dort zeigt die Anzeige weiter den Text.
const tl = texte.lieferschein

function Abschnitt({ label, zeilen }) {
  if (!zeilen?.length) return null
  return (
    <div className="lieferschein-abschnitt">
      <p className="bericht-abschnitt">{label}</p>
      <ul className="lieferschein-liste">
        {zeilen.map((zeile, i) => (
          <li key={i}>{zeile}</li>
        ))}
      </ul>
    </div>
  )
}

function LieferscheinAnsicht({ meldungen }) {
  return (
    <>
      {meldungen.map((m, i) => (
        <div className="lieferschein" key={i}>
          {m.etikett && <p className="lieferschein-etikett">{m.etikett}</p>}
          <p className="lieferschein-fazit">{m.fazit}</p>
          {/* Zuschnitt je Ziel (BAUPLAN 44): Ein Arbeitspaket trägt seit 44
              mehrere Zuschnitte, jeder mit Ziel und Datenvertrag.
              zuschnitteAusMeldung ist tolerant gegenüber Berichten von vorher
              (ein Paket, flach im Meldungsobjekt). */}
          {m.art === 'arbeitspaket' &&
            zuschnitteAusMeldung(m).map((paket, p) => (
              <div className="lieferschein-abschnitt" key={p}>
                {paket.zielBezeichnung && (
                  <p className="bericht-zeile">
                    {tl.labels.zielBlock}: {paket.zielBezeichnung}
                  </p>
                )}
                <p className="bericht-zeile">
                  {tl.labels.ziel}: {paket.ziel}
                </p>
                <Abschnitt label={tl.labels.fertigKriterien} zeilen={paket.fertigKriterien} />
                <Abschnitt label={tl.labels.schritte} zeilen={paket.schritte} />
                <Abschnitt label={tl.labels.fundstellen} zeilen={paket.fundstellen} />
                <Abschnitt label={tl.labels.bausteine} zeilen={paket.bausteine} />
                <Abschnitt label={tl.labels.schnittstellen} zeilen={paket.schnittstellen} />
                <Abschnitt label={tl.labels.erlaubteDateien} zeilen={paket.erlaubteDateien} />
                <Abschnitt label={tl.labels.nichtDabei} zeilen={paket.nichtDabei} />
              </div>
            ))}
          {m.art === 'pruefbeleg' && (
            <>
              <p className={'lieferschein-urteil urteil-' + m.urteil}>
                {tl.labels.urteil}: {tl.urteile[m.urteil] ?? m.urteil}
              </p>
              <Abschnitt label={tl.labels.geprueft} zeilen={m.geprueft} />
              <Abschnitt
                label={tl.labels.beanstandungen}
                zeilen={(m.beanstandungen ?? []).map(beanstandungZeile)}
              />
              {m.rotVorGruen && (
                <div className="lieferschein-abschnitt">
                  <p className="bericht-abschnitt">{tl.labels.rotVorGruen}</p>
                  <p className="bericht-zeile">{m.rotVorGruen}</p>
                </div>
              )}
            </>
          )}
          {m.art === 'umsetzungsbericht' && (
            <>
              <Abschnitt
                label={tl.labels.kriterien}
                zeilen={(m.kriterien ?? []).map((k) => `${k.kriterium} → ${k.wieUmgesetzt}`)}
              />
              <Abschnitt
                label={tl.labels.dateien}
                zeilen={(m.dateien ?? []).map(
                  (d) => `${d.pfad} (${tl.dateiArten[d.art] ?? d.art})`
                )}
              />
              <Abschnitt
                label={tl.labels.angriffsliste}
                zeilen={(m.angriffsliste ?? []).map((a) => `${a.fund} → ${a.umgang}`)}
              />
            </>
          )}
          {m.art === 'funde' &&
            ((m.funde ?? []).length ? (
              <Abschnitt label={tl.labels.funde} zeilen={m.funde.map(fundZeile)} />
            ) : (
              <p className="bericht-zeile">{tl.keineFunde}</p>
            ))}
          {m.art === 'rahmen' && m.inhalt && <p className="bericht-zeile">{m.inhalt}</p>}
          <Abschnitt label={tl.labels.getan} zeilen={m.getan} />
          <Abschnitt label={tl.labels.offen} zeilen={m.offen} />
          {m.anmerkung && (
            <div className="lieferschein-abschnitt">
              <p className="bericht-abschnitt">{tl.labels.anmerkung}</p>
              <p className="bericht-zeile">{m.anmerkung}</p>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// Ein Block-Ergebnis in den Bericht-Details (BAUPLAN 15): Zeile mit Ausgang,
// der Lieferschein klappt auf Klick auf.
function BlockErgebnisZeile({ eintrag }) {
  const [offen, setOffen] = useState(false)
  const [rauchtestAusgabeOffen, setRauchtestAusgabeOffen] = useState(false)
  const rauchtest = eintrag.rauchtest ?? null
  return (
    <div className="block-ergebnis">
      <button className="block-ergebnis-knopf" onClick={() => setOffen(!offen)}>
        {/* Zusatzname (BAUPLAN 41): Katalogname und Zusatz stehen getrennt im
            Bericht — hier zusammen, damit zwei gleiche Blöcke unterscheidbar sind. */}
        <span>
          {offen ? '▾' : '▸'} {tb.blockMitZusatz(eintrag.block, eintrag.zusatz)}
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
          {/* Modell je Block (BAUPLAN 36): Wer hat diesen Anlauf gearbeitet? */}
          <p className="feld-hinweis">
            {(eintrag.modelle ?? []).length > 0
              ? tb.modellZeile(eintrag.modelle)
              : tb.modellUnbekannt}
          </p>
          {eintrag.aufschluesselung && (
            <p className="feld-hinweis">{tb.aufschluesselungZeile(eintrag.aufschluesselung)}</p>
          )}
          {eintrag.kostenUsd != null && (
            <p className="feld-hinweis">{tb.apiKosten(eintrag.kostenUsd)}</p>
          )}
          {/* Rauchtest ehrlich (0.46.2): grün, rot mit Grund oder übersprungen
              mit Grund — die Ausgabe des Startversuchs klappt auf Wunsch auf. */}
          {rauchtest && (
            <div className="block-ergebnis-rauchtest">
              <p className="feld-hinweis">
                {tb.rauchtestZeile(rauchtest)}
                {rauchtest.gemessenAn && ` · ${tb.rauchtestGemessenAn(rauchtest.gemessenAn)}`}
              </p>
              {rauchtest.ausgabe && (
                <>
                  <button
                    className="link-knopf"
                    onClick={() => setRauchtestAusgabeOffen(!rauchtestAusgabeOffen)}
                  >
                    {rauchtestAusgabeOffen ? tb.rauchtestAusgabeVerbergen : tb.rauchtestAusgabeZeigen}
                  </button>
                  {rauchtestAusgabeOffen && (
                    <pre className="block-ergebnis-rauchtest-ausgabe">{rauchtest.ausgabe}</pre>
                  )}
                </>
              )}
            </div>
          )}
          {(eintrag.meldungen ?? []).length > 0 ? (
            <LieferscheinAnsicht meldungen={eintrag.meldungen} />
          ) : (
            eintrag.ergebnisText
          )}
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

// aufklappen (BAUPLAN 30): Sprung aus der Herkunfts-Kopfzeile einer Karte —
// der Bericht öffnet sich und rollt ins Bild.
function Laufbericht({ bericht, aufklappen = null }) {
  const [offen, setOffen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!aufklappen) return
    setOffen(true)
    setTimeout(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0)
  }, [aufklappen])
  const wahlLabels = {
    weitermachen: te.weitermachen,
    zurueckstellen: te.zurueckstellen,
    wiederherstellen: te.wiederherstellen
  }
  const dauer = dauerText(bericht)
  return (
    <div className={'bericht' + (aufklappen ? ' bericht-hervorgehoben' : '')} ref={ref}>
      <button className="bericht-kopf" onClick={() => setOffen(!offen)}>
        <span className="bericht-kopf-text">
          {zeitText(bericht.gestartetAm)} · {bericht.workflow}
          {bericht.sonderlauf && ` · ${texte.sonderlauf.berichtMarke}`}
        </span>
        <ZustandsMarke zustand={bericht.zustand} />
      </button>
      {offen && (
        <div className="bericht-details">
          {dauer && <p className="feld-hinweis">{dauer}</p>}
          {/* Paket (BAUPLAN 30): die gemeldeten Aufgaben-Karten dieses Laufs.
              Seit BAUPLAN 44 je Auftragsquelle eine Zeile — Berichte von vorher
              tragen eine blanke Titel-Liste und werden weiter so gezeigt. */}
          {Array.isArray(bericht.paket) &&
            (bericht.paket.length === 0 ? (
              <p className="feld-hinweis">{tb.paketLeerZeile}</p>
            ) : typeof bericht.paket[0] === 'string' ? (
              <p className="feld-hinweis">{tb.paketZeile(bericht.paket)}</p>
            ) : (
              bericht.paket.map((eintrag, i) => (
                <p className="feld-hinweis" key={i}>
                  {tb.paketBlockZeile(eintrag.block, eintrag.aufgaben ?? [])}
                </p>
              ))
            ))}
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
          {/* Karten-Vorschläge (Zweit-Audit D-03): SPEC verspricht die Zählung
              im Laufbericht — vorher wurde sie nur gespeichert, nie gezeigt. */}
          {bericht.kartenVorschlaege && (
            <p className="feld-hinweis">{tb.kartenVorschlaegeZeile(bericht.kartenVorschlaege)}</p>
          )}
          {/* Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): der Vorschlag
              des Sessionendes samt Empfehlung, sichtbar im Bericht. */}
          {bericht.naechsterLauf && (
            <p className="feld-hinweis">{tb.naechsterLaufZeile(bericht.naechsterLauf)}</p>
          )}
          {/* Karten-Zuteilung (BAUPLAN 29): wie Paket schneiden/Diagnose die
              Karten auf die Folgeblöcke verteilt hat. */}
          {(bericht.kartenZuteilung ?? []).length > 0 && (
            <p className="feld-hinweis">{tb.kartenZuteilungZeile(bericht.kartenZuteilung)}</p>
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
          {/* Nachlauf-Chat (BAUPLAN 27): der Chat-Verlauf als eigener
              Abschnitt im Laufbericht — Bilder als Marker, nicht als Daten. */}
          {(bericht.nachlaufChat?.verlauf ?? []).length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.chatLabel}</p>
              {bericht.nachlaufChat.verlauf.map((eintrag, i) => (
                <p key={i} className="bericht-zeile">
                  {eintrag.rolle === 'mensch' && <strong>{tb.chatRolleDu}: </strong>}
                  {eintrag.rolle === 'ki' && <strong>{tb.chatRolleKi}: </strong>}
                  {eintrag.text}
                  {(eintrag.bilder ?? 0) > 0 && ' ' + texte.chat.bildMarker(eintrag.bilder)}
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
          {/* Compaction sichtbar (BAUPLAN 36): Der Motor hat selbst ein
              Arbeitsgedächtnis eingedampft — das erklärt Gedächtnislücken. */}
          {(bericht.zusammenfassungen ?? []).length > 0 && (
            <div>
              <p className="bericht-abschnitt">{tb.zusammenfassungenLabel}</p>
              {bericht.zusammenfassungen.map((eintrag, i) => (
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
  herkunft,
  pfad,
  pruefKarten,
  zeigePruefkartenTipp,
  onKarteAbgelegt,
  onPruefkarteEntfernen,
  onFeld,
  onSpeichern,
  onZurueckZu,
  onZusatz,
  onLokaleKi,
  onModell,
  onEntfernen,
  onGreifen,
  onPfeilStart,
  messen
}) {
  const [ergebnisOffen, setErgebnisOffen] = useState(false)
  // Prüfkarten auf den Prüfer ziehen (BAUPLAN 18): nur Prüf-Blockkarten sind
  // Drop-Ziel — und nur, solange das Schaubild bearbeitbar ist.
  const nimmtKarten = bearbeitbar && def.prueft
  // Modellklasse (BAUPLAN 37): Wahl an der Karte, sonst Voreinstellung des
  // Blocks — dieselbe Auflösung wie im Hauptprozess.
  const modellKlasse = blockModellKlasse(def, eintrag)
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
        {/* Zusatzname (BAUPLAN 41): „Bauer · Datenbank" — auch im Kartenkopf,
            damit zwei gleiche Blöcke im Schaubild auseinanderzuhalten sind. */}
        <span className="karte-titel">
          {def.symbol} {blockAnzeigeName(def, eintrag)}
        </span>
        {aktiv && <span className="block-zustand">{t.laeuft}</span>}
        {bearbeitbar && (
          <button className="knopf-klein ketten-block-entfernen" onClick={onEntfernen}>
            {tk.entfernen}
          </button>
        )}
      </div>
      {/* Sicht-Hilfe (BAUPLAN 36): An den braucht-Chips steht, welcher Vorfahre
          das liefert — oder dass es fehlt. */}
      <BlockChips def={def} herkunft={herkunft} />
      {/* Zusatzname je Blockkarte (BAUPLAN 41): macht mehrere gleiche Blöcke
          unterscheidbar und sagt dem Zuschnitt, wofür dieser Block zuständig
          ist. Er wandert in Ticker, Aufträge, Übergaben und Laufbericht. */}
      <label className="feld feld-kompakt" title={tk.zusatzHinweis}>
        {tk.zusatzLabel}
        <input
          disabled={!bearbeitbar}
          value={eintrag.zusatz ?? ''}
          maxLength={ZUSATZNAME_MAX}
          placeholder={tk.zusatzPlatzhalter}
          onChange={(e) => onZusatz(e.target.value)}
          onBlur={onSpeichern}
        />
      </label>
      {/* Häkchen je Block (BAUPLAN 20): „lokale KI erlaubt" — Standard an,
          erbt den globalen Schalter. Abgewählt ist eine echte Sperre:
          kein lokal_recherchieren, keine lokale Vorreparatur für diesen Block. */}
      <label className="feld-kompakt lokale-ki-feld" title={tk.lokaleKiHinweis}>
        <input
          type="checkbox"
          disabled={!bearbeitbar}
          checked={eintrag.lokaleKi !== false}
          onChange={(e) => onLokaleKi(e.target.checked)}
        />
        {tk.lokaleKiLabel}
      </label>
      {/* Modellklasse je Block (BAUPLAN 37): frei wählbar — auch bei Bauer
          und Prüfer. Wählt Georg zu sparsam, zeigen die Metriken die Folge
          (mehr Reparatur-Runden), gesperrt wird nichts. */}
      <label className="feld feld-kompakt" title={tk.modellHinweis}>
        {tk.modellLabel}
        <select
          disabled={!bearbeitbar}
          value={modellKlasse}
          onChange={(e) => onModell(e.target.value)}
        >
          {MODELL_KLASSEN.map((klasse) => (
            <option key={klasse} value={klasse}>
              {tk.modellNamen[klasse]}
            </option>
          ))}
        </select>
      </label>
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
                {blockAnzeigeName(blockDefinition(d.blockId), d)}
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
              {/* Lieferschein (BAUPLAN 42): gegliedert statt Textblock — alte
                  Läufe haben keine Meldungen und zeigen weiter ihren Text. */}
              {(letztesErgebnis.meldungen ?? []).length > 0 ? (
                <LieferscheinAnsicht meldungen={letztesErgebnis.meldungen} />
              ) : (
                letztesErgebnis.ergebnisText
              )}
            </div>
          )}
        </div>
      )}
      {def.prueft && <PruefmappenBereich pfad={pfad} ordner={pruefOrdnerFuer(def, eintrag)} />}
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
  // Sprung zum Laufbericht (BAUPLAN 30): { laufId, n } aus der Herkunfts-Kopfzeile.
  berichtSprung = null,
  // App-Tab (BAUPLAN 32): Startanleitung, Sprung+Start vom Kopf-Knopf (Zähler),
  // Rückmeldung des App-Zustands an den Kopf.
  anleitung = null,
  appSprung = 0,
  onAppZustand,
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
  // Denk-Ansicht statt Rohprotokoll (BAUPLAN 24): die Denk-Texte der gerade
  // arbeitenden KI, je Absatz mit Absender — nur live, nie im Laufbericht.
  const [denken, setDenken] = useState([])
  const [denkenOffen, setDenkenOffen] = useState(false)
  // Verbrauch je Block (instanzId → Verbrauch) — parallele Blöcke melden
  // gleichzeitig; angezeigt wird eine Zeile pro laufendem Block.
  const [verbraeuche, setVerbraeuche] = useState({})
  const [letzterVerbrauch, setLetzterVerbrauch] = useState(null)
  const [frage, setFrage] = useState(null)
  const [entscheidung, setEntscheidung] = useState(null)
  // Gespräch mit dem Agenten: offene Frage + bisheriger Verlauf dieses Laufs.
  const [menschFrage, setMenschFrage] = useState(null)
  // Karten-Vorschläge (BAUPLAN 26): der offene Abnahme-Dialog des Karten-Prüfers.
  const [vorschlag, setVorschlag] = useState(null)
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
    ['schaubild', 'lauf', 'berichte', 'punkte', 'metriken', 'app'].includes(initialTab) ? initialTab : 'schaubild'
  )
  // Eigener Bestätigungs-Dialog statt window.confirm (Bugfix 13.08.2026):
  // null = zu, sonst { frage, knopf, gefahr, aktion }.
  const [bestaetigung, setBestaetigung] = useState(null)
  // Kartenvorauswahl für den Lauf (SPEC §5, BAUPLAN 7): Status + offene Aufgaben
  // sind vorausgewählt; Georg kann Karten dazuziehen (zusatz) oder vorausgewählte
  // rauswerfen (raus). Beides gilt für den nächsten Start, wird nicht gespeichert.
  const [kontextZusatz, setKontextZusatz] = useState(() => new Set())
  const [kontextRaus, setKontextRaus] = useState(() => new Set())
  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): die Vorschlags-Zeile an
  // der Kartenauswahl — null = keiner da, sonst { empfehlung, karten }.
  const [laufVorschlag, setLaufVorschlag] = useState(null)
  // Schaubild: gemessene Kartengrößen, laufender Karten-Zug, laufender Pfeil-Zug
  const [groessen, setGroessen] = useState({})
  const [ziehen, setZiehen] = useState(null) // { instanzId, dx, dy }
  const [pfeilZug, setPfeilZug] = useState(null) // { von, x, y }
  const tickerEnde = useRef(null)
  const denkEnde = useRef(null)
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

  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): frisch aus dem
  // Hauptprozess — gelöschte Karten fallen dort schon still heraus.
  function laufVorschlagLaden() {
    window.flowforge.naechsterLaufLaden(pfad).then((e) => e.ok && setLaufVorschlag(e.vorschlag))
  }

  useEffect(() => {
    berichteLaden()
    punkteLaden()
    laufVorschlagLaden()
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
      if (e.vorschlag) setVorschlag(e.vorschlag)
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
        setDenken([])
        setVerbraeuche({})
        setLetzterVerbrauch(null)
        setErgebnis(null)
        setGespraech([])
        setMenschFrage(null)
        setVorschlag(null)
        setFrage(null)
        setEntscheidung(null)
        setAktiveInstanzen(new Set())
        // Der Lauf-Start hat den Karten-Vorschlag abgeräumt (BAUPLAN 28).
        setLaufVorschlag(null)
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
      if (ereignis.art === 'denken')
        setDenken((alt) => [...alt, { absender: ereignis.absender, text: ereignis.text }])
      if (ereignis.art === 'verbrauch') {
        setLetzterVerbrauch(ereignis.verbrauch)
        if (ereignis.instanzId)
          setVerbraeuche((alt) => ({ ...alt, [ereignis.instanzId]: ereignis.verbrauch }))
      }
      if (ereignis.art === 'frage')
        setFrage({ frageId: ereignis.frageId, beschreibung: ereignis.beschreibung })
      if (ereignis.art === 'frage-erledigt') setFrage(null)
      // Folgen-Frage je Zweig (BAUPLAN 46): mehrere können nacheinander kommen
      // — lauf.js schickt nach jedem „erledigt" die nächste offene; `trifft`
      // sagt, was „Stand wiederherstellen" für diesen Zweig träfe.
      if (ereignis.art === 'entscheidung')
        setEntscheidung({
          frageId: ereignis.frageId,
          blockName: ereignis.blockName,
          runden: ereignis.runden,
          trifft: ereignis.trifft ?? null
        })
      if (ereignis.art === 'entscheidung-erledigt')
        setEntscheidung((alt) => (alt && alt.frageId !== ereignis.frageId ? alt : null))
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
      // Karten-Vorschläge (BAUPLAN 26): der Abnahme-Dialog des Karten-Prüfers.
      if (ereignis.art === 'vorschlag')
        setVorschlag({ frageId: ereignis.frageId, vorschlag: ereignis.vorschlag })
      if (ereignis.art === 'vorschlag-erledigt') setVorschlag(null)
      // Co-Pilot (BAUPLAN 33) lebt im Seitenfenster; hier zählt nur: eine
      // Chat-Reparatur legt einen Sicherungspunkt an — sofort in der Liste.
      if (ereignis.art === 'chat-sicherungspunkt') punkteLaden()
      if (ereignis.art === 'fertig') {
        setZustand('fertig')
        setErgebnis({ zustand: ereignis.zustand, fehlertext: ereignis.fehlertext })
        setAktiveInstanzen(new Set())
        setFrage(null)
        setEntscheidung(null)
        setMenschFrage(null)
        setVorschlag(null)
        berichteLaden()
        punkteLaden()
        // Ein Sessionende kann einen Karten-Vorschlag hinterlassen haben.
        laufVorschlagLaden()
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

  // Sprung zum Laufbericht (BAUPLAN 30): Berichte-Tab vorn, Filter auf „alle",
  // der Bericht klappt selbst auf (Laufbericht bekommt berichtSprung).
  useEffect(() => {
    if (!berichtSprung) return
    setBerichtFilter('alle')
    setTab('berichte')
  }, [berichtSprung])

  // „App starten" im Kopf (BAUPLAN 32): springt in den App-Tab; der Start
  // selbst passiert dort (Zähler appSprung als Anstoß).
  useEffect(() => {
    if (appSprung) setTab('app')
  }, [appSprung])

  useEffect(() => {
    denkEnde.current?.scrollIntoView({ block: 'nearest' })
  }, [denken, denkenOffen])

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

  // Zusatzname je Blockkarte (BAUPLAN 41): getippt wird frei, gespeichert wird
  // beim Verlassen des Feldes (wie die Formularfelder der Blöcke).
  function zusatzSetzen(instanzId, wert) {
    setWorkflow((alt) => ({
      ...alt,
      bloecke: alt.bloecke.map((b) => (b.instanzId === instanzId ? { ...b, zusatz: wert } : b))
    }))
  }

  // Häkchen je Block (BAUPLAN 20): „lokale KI erlaubt" abwählen oder wieder setzen.
  function lokaleKiSetzen(instanzId, erlaubt) {
    const bloecke = workflow.bloecke.map((b) =>
      b.instanzId === instanzId ? { ...b, lokaleKi: erlaubt } : b
    )
    ketteSpeichern({ ...workflow, bloecke })
  }

  // Modellklasse je Block (BAUPLAN 37): Wahl an der Blockkarte.
  function modellSetzen(instanzId, klasse) {
    const bloecke = workflow.bloecke.map((b) =>
      b.instanzId === instanzId ? { ...b, modell: klasse } : b
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
    setDenken([])
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
    // Prüfkarten gehören nicht in die Kartenauswahl (BAUPLAN 30, Kleinkram):
    // Sie haben ihren eigenen Weg über den Prüfer — freundlich ablehnen.
    const karte = (karten ?? []).find((k) => k.id === id)
    if (karte?.sorte === 'pruefung') {
      setMeldung(texte.kartenAuswahl.pruefkarteAbgelehnt)
      return
    }
    setMeldung('')
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

  // Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): „Übernehmen" stellt die
  // Kartenauswahl exakt auf den Vorschlag um — abgebildet auf die bestehende
  // Zusatz/Raus-Mechanik: Vorgeschlagene Karten außerhalb der Standard-
  // Vorauswahl kommen als Zusatz dazu, nicht vorgeschlagene offene Aufgaben
  // fliegen raus. Danach ist alles wie gewohnt per × und Drag & Drop änderbar —
  // das IST das Bearbeiten. Die Status-Karte bleibt immer dabei.
  function laufVorschlagUebernehmen() {
    const gewollt = new Set(laufVorschlag.karten.map((k) => k.id))
    const zusatz = new Set()
    const raus = new Set()
    for (const karte of karten ?? []) {
      if (karte.sorte === 'status') continue
      const standard = karte.sorte === 'aufgabe' && !karte.erledigt
      if (gewollt.has(karte.id)) {
        if (!standard) zusatz.add(karte.id)
      } else if (standard) raus.add(karte.id)
    }
    setKontextZusatz(zusatz)
    setKontextRaus(raus)
  }

  async function laufVorschlagVerwerfen() {
    setLaufVorschlag(null)
    await window.flowforge.naechsterLaufVerwerfen(pfad)
  }

  // Alle Karten laden (BAUPLAN 29): Status + alle Entscheidungs- und
  // Wissens-Karten + alle offenen Aufgaben. Erledigte Aufgaben und Prüfkarten
  // bleiben draußen (Historie liefert der Laufbericht, Prüfkarten haben ihren
  // eigenen Weg über den Prüfer). Danach wie gewohnt per × und Drag & Drop
  // änderbar — Paket schneiden/Diagnose teilt den Folgeblöcken dann zu.
  function alleKartenHinzufuegen() {
    const zusatz = new Set()
    for (const karte of karten ?? [])
      if (karte.sorte === 'entscheidung' || karte.sorte === 'wissen') zusatz.add(karte.id)
    setKontextZusatz(zusatz)
    setKontextRaus(new Set())
  }

  // „Standard-Auswahl": zurück auf die festgenagelte Vorauswahl (SPEC §5).
  function standardAuswahl() {
    setKontextZusatz(new Set())
    setKontextRaus(new Set())
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

  // Sicht-Hilfe (BAUPLAN 36): Die Fehlschlag-Rückführung ist bisher nur ein
  // Auswahlfeld an der Prüferkarte — im Schaubild war der Weg zurück unsichtbar.
  // Jetzt zieht ein gestrichelter Bogen vom Prüfer zu seinem Ziel. Als Bogen,
  // damit er den Vorwärtspfeil nicht überdeckt, wenn das Ziel direkt davor liegt.
  const rueckLinien = bloecke
    .map((eintrag) => {
      const def = blockDefinition(eintrag.blockId)
      if (!def?.prueft) return null
      const zielId = rueckfuehrungsZiel(bloecke, pfeile, eintrag.instanzId)
      if (!zielId) return null
      const von = karteRect(eintrag.instanzId)
      const nach = karteRect(zielId)
      if (!von || !nach) return null
      const start = randSchnitt(von, { x: nach.x + nach.w / 2, y: nach.y + nach.h / 2 })
      const ende = randSchnitt(nach, { x: von.x + von.w / 2, y: von.y + von.h / 2 })
      // Der Bogen weicht senkrecht zur Verbindungslinie aus.
      const dx = ende.x - start.x
      const dy = ende.y - start.y
      const laenge = Math.hypot(dx, dy) || 1
      const bogen = Math.min(90, Math.max(40, laenge / 3))
      const mitte = {
        x: (start.x + ende.x) / 2 - (dy / laenge) * bogen,
        y: (start.y + ende.y) / 2 + (dx / laenge) * bogen
      }
      return { id: eintrag.instanzId, start, ende, mitte }
    })
    .filter(Boolean)

  const zugStart = pfeilZug && karteRect(pfeilZug.von)

  // Offene Fragen ziehen den Blick auf den Lauf-Tab, auch wenn Georg gerade
  // woanders ist.
  const laufBrauchtDich = Boolean(frage || entscheidung || menschFrage || vorschlag)
  // Läufe in anderen Projekten — der laufende dieses Projekts zählt nicht mit.
  const andereLaeufe = laufAnzahl - (zustand === 'laeuft' ? 1 : 0)
  const tabs = [
    ['schaubild', texte.projektansicht.tabSchaubild],
    ['lauf', texte.projektansicht.tabLauf],
    ['berichte', `${texte.projektansicht.tabBerichte} (${berichte.length})`],
    ['punkte', `${texte.projektansicht.tabPunkte} (${punkte.length})`],
    // Metriken (BAUPLAN 31): dieselbe Seite wie in der Titelleiste, aufs
    // Projekt vorgefiltert — eigener Baustein (Metriken.jsx).
    ['metriken', texte.projektansicht.tabMetriken],
    // App-Tab (BAUPLAN 32): die Startanleitung läuft in FlowForge — eigener
    // Baustein (AppTab.jsx), immer gemountet, damit die Ausgabe nicht verloren
    // geht, wenn Georg zwischen den Tabs wechselt.
    ['app', texte.projektansicht.tabApp]
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
          {/* Alle Karten laden (BAUPLAN 29): ein Knopf lädt alles Wissenswerte,
              einer springt zurück auf die Standard-Vorauswahl. */}
          <button
            className="vorschlag-knopf"
            title={ta.alleHinzufuegenHinweis}
            onClick={alleKartenHinzufuegen}
          >
            {ta.alleHinzufuegen}
          </button>
          <button
            className="vorschlag-knopf"
            title={ta.standardAuswahlHinweis}
            onClick={standardAuswahl}
          >
            {ta.standardAuswahl}
          </button>
        </div>
      )}

      {/* Karten-Vorschlag fürs nächste Paket (BAUPLAN 28): kein blockierender
          Dialog — eine Zeile mit Empfehlung, Karten-Chips und zwei Knöpfen.
          Dritter Weg: einfach ignorieren und wie bisher selbst wählen. */}
      {tab === 'schaubild' && bearbeitbar && laufVorschlag && (
        <div className="kontext-bereich vorschlag-zeile" title={tn.hinweis}>
          <span className="kontext-titel">{tn.ueberschrift}:</span>
          <span className="vorschlag-empfehlung">{laufVorschlag.empfehlung}</span>
          {laufVorschlag.karten.length === 0 && (
            <em className="chip-fest">{tn.ohneKarten}</em>
          )}
          {laufVorschlag.karten.map((karte) => (
            <span
              key={karte.id}
              className={'kontext-chip chip-' + karte.sorte}
              title={texte.karten.sorten[karte.sorte] + ': ' + karte.titel}
            >
              <span className="chip-text">
                {texte.karten.sorten[karte.sorte]}: {karte.titel}
              </span>
            </span>
          ))}
          <button className="vorschlag-knopf" onClick={laufVorschlagUebernehmen}>
            {tn.uebernehmen}
          </button>
          <button className="vorschlag-knopf" onClick={laufVorschlagVerwerfen}>
            {tn.verwerfen}
          </button>
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
              <marker
                id="pfeilspitze-rueck"
                markerWidth="10"
                markerHeight="8"
                refX="9"
                refY="4"
                orient="auto"
              >
                {/* Rückführungs-Pfeilspitze = .rueck-linie (--signal-text);
                    marker-fill kann keine CSS-Variablen aus Klassen erben. */}
                <path d="M0,0 L10,4 L0,8 z" fill="#f4606e" />
              </marker>
            </defs>
            {/* Fehlschlag-Rückführung sichtbar (BAUPLAN 36). */}
            {rueckLinien.map((linie) => (
              <g key={'rueck-' + linie.id}>
                <path
                  d={`M ${linie.start.x} ${linie.start.y} Q ${linie.mitte.x} ${linie.mitte.y} ${linie.ende.x} ${linie.ende.y}`}
                  className="rueck-linie"
                  markerEnd="url(#pfeilspitze-rueck)"
                />
                <text x={linie.mitte.x} y={linie.mitte.y} className="rueck-beschriftung">
                  {workflow.reparaturRunden > 0
                    ? tk.rueckpfeilLabel(workflow.reparaturRunden)
                    : tk.rueckpfeilOhneRunden}
                </text>
              </g>
            ))}
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
                herkunft={brauchtHerkunft(bloecke, pfeile, eintrag.instanzId)}
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
                onZusatz={(wert) => zusatzSetzen(eintrag.instanzId, wert)}
                onLokaleKi={(erlaubt) => lokaleKiSetzen(eintrag.instanzId, erlaubt)}
                onModell={(klasse) => modellSetzen(eintrag.instanzId, klasse)}
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
                label={aktive.length > 1 ? anzeigeNameVon(bloecke, id) : null}
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

          {/* Karten-Vorschläge (BAUPLAN 26): der Abnahme-Dialog des
              Karten-Prüfers — übernehmen, bearbeiten oder ablehnen. */}
          {vorschlag && (
            <KartenVorschlag
              eintrag={vorschlag}
              onAntwort={(frageId, wahl, felder) =>
                window.flowforge.laufVorschlagAntworten(frageId, wahl, felder)
              }
            />
          )}

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
                    {def.symbol} {anzeigeNameVon(bloecke, id)}
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
                      {def.symbol} {anzeigeNameVon(bloecke, zeile.instanzId)}
                    </span>
                  )}
                  {zeile.text}
                </p>
              )
            })}
            <div ref={tickerEnde} />
          </div>

          <button className="knopf-klein" onClick={() => setDenkenOffen(!denkenOffen)}>
            {denkenOffen ? t.denkenVerbergen : t.denkenZeigen}
          </button>
          {denkenOffen && (
            <div className="denk-bereich">
              {denken.length === 0 && <p className="denk-leer">{t.denkenLeer}</p>}
              {denken.map((absatz, i) => (
                <div className="denk-absatz" key={i}>
                  <span className="denk-absender">{absatz.absender}</span>
                  <p className="denk-text">{absatz.text}</p>
                </div>
              ))}
              <div ref={denkEnde} />
            </div>
          )}

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
              <Laufbericht
                key={bericht.id}
                bericht={bericht}
                aufklappen={berichtSprung?.laufId === bericht.id ? berichtSprung : null}
              />
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

      {tab === 'metriken' && (
        <div className="berichte-bereich">
          <Metriken projektPfad={pfad} />
        </div>
      )}

      <div style={tab === 'app' ? undefined : { display: 'none' }}>
        <AppTab
          pfad={pfad}
          anleitung={anleitung}
          sichtbar={tab === 'app'}
          startAnstoss={appSprung}
          onZustand={onAppZustand}
        />
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
                  {/* Was der Rückroll trifft (BAUPLAN 46): der Zweig — oder
                      ehrlich der ganze Ordner, wenn ein Block keinen
                      Datenvertrag hat. */}
                  {wahl === 'wiederherstellen' && entscheidung.trifft && (
                    <span className="feld-hinweis">{entscheidung.trifft}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
