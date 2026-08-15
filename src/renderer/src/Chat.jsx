// Co-Pilot (BAUPLAN 33): EIN Chat für Bedienung und Projekt — als seitliches
// Fenster neben der Ansicht (bei schmalem Fenster als Überlagerung, CSS). In
// der Projektübersicht (pfad null) beantwortet er nur Bedienfragen; im Projekt
// kennt er das Projekt und hängt an der jüngsten Lauf-Session (Marke im
// Verlauf, wenn ein neuer Lauf dazukam). Mehrzeilige Eingabe, Screenshots per
// Strg+V oder Datei-Knopf, Schalter „Chat darf reparieren" (gesperrt, solange
// im Projekt ein Lauf läuft oder wartet), „Neues Gespräch", eigene
// Rechte-Rückfragen, Verbrauch sichtbar.
import { useEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'
import VerbrauchZeile from './VerbrauchZeile.jsx'
import Bestaetigung from './Bestaetigung.jsx'

const tc = texte.chat
const tf = texte.rechteFrage

// Antworten kommen als Text mit gelegentlichem **fett** — mehr Markdown wird
// dem Chat abgewöhnt (Systemtext); Fett wird gerendert statt als Sternchen gezeigt.
function fettRendern(text) {
  const teile = String(text ?? '').split(/\*\*(.+?)\*\*/g)
  if (teile.length === 1) return text
  return teile.map((teil, i) => (i % 2 === 1 ? <b key={i}>{teil}</b> : teil))
}

export default function Chat({ pfad, projektName, onSchliessen }) {
  const schluessel = pfad ?? null
  const [chat, setChat] = useState(null)
  const [verlauf, setVerlauf] = useState([])
  const [text, setText] = useState('')
  const [bilder, setBilder] = useState([])
  const [fehler, setFehler] = useState('')
  const [frage, setFrage] = useState(null)
  const [schritt, setSchritt] = useState('')
  const [modus, setModus] = useState('abo')
  const [bestaetigung, setBestaetigung] = useState(null)
  const ende = useRef(null)
  const dateiRef = useRef(null)

  function laden() {
    window.flowforge.chatZustand(schluessel).then((e) => {
      if (!e.ok) return
      setChat(e)
      setVerlauf(e.verlauf ?? [])
      setFrage(e.frage ?? null)
      setSchritt(e.letzterSchritt ?? '')
    })
  }

  useEffect(() => {
    setChat(null)
    setVerlauf([])
    setFrage(null)
    setFehler('')
    laden()
    window.flowforge.einstellungenLaden().then((e) => e.ok && setModus(e.einstellungen.motorModus))
    const abmelden = window.flowforge.aufLaufEreignis((ereignis) => {
      // Läufe-Übersicht kommt ohne Projektpfad: daraus weiß der Chat, ob sein
      // Projekt läuft oder wartet (dann nur lesend, Reparieren gesperrt).
      if (ereignis.art === 'laeufe') {
        if (schluessel)
          setChat(
            (c) =>
              c && {
                ...c,
                laufAktiv:
                  ereignis.aktive.includes(schluessel) ||
                  ereignis.warteschlange.includes(schluessel)
              }
          )
        return
      }
      if ((ereignis.projektPfad ?? null) !== schluessel) return
      if (ereignis.art === 'chat-eintrag') setVerlauf((alt) => [...alt, ereignis.eintrag])
      if (ereignis.art === 'chat-beschaeftigt') {
        setChat((c) => c && { ...c, beschaeftigt: ereignis.beschaeftigt })
        if (!ereignis.beschaeftigt) setSchritt('')
      }
      if (ereignis.art === 'chat-verbrauch')
        setChat((c) => c && { ...c, verbrauch: ereignis.verbrauch })
      if (ereignis.art === 'chat-hinweis') setChat((c) => c && { ...c, hinweis: ereignis.hinweis })
      if (ereignis.art === 'chat-schritt') setSchritt(ereignis.text)
      if (ereignis.art === 'chat-lauf' || (ereignis.art === 'zustand' && ereignis.zustand === 'laeuft'))
        setChat((c) => c && { ...c, laufAktiv: true })
      if (ereignis.art === 'chat-frage')
        setFrage({ frageId: ereignis.frageId, beschreibung: ereignis.beschreibung })
      if (ereignis.art === 'chat-frage-erledigt') setFrage(null)
      // Nach dem Lauf hängt der Chat an der neuen Lauf-Session — frisch laden
      // (Marke, Hinweis, Verbrauch kommen aus dem Hauptprozess).
      if (ereignis.art === 'fertig') laden()
    })
    return abmelden
  }, [schluessel])

  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'nearest' })
  }, [verlauf.length, chat?.beschaeftigt, frage?.frageId])

  function bildAufnehmen(datei) {
    if (!datei || !datei.type?.startsWith('image/')) return
    const leser = new FileReader()
    leser.onload = () =>
      setBilder((alt) => (alt.length >= 4 ? alt : [...alt, String(leser.result)]))
    leser.readAsDataURL(datei)
  }

  // Strg+V aus der Zwischenablage (PowerShell-Screenshot, App-Fenster …):
  // Bilder werden angehängt, reiner Text fällt normal ins Eingabefeld.
  function einfuegen(e) {
    const eintraege = [...(e.clipboardData?.items ?? [])].filter(
      (eintrag) => eintrag.kind === 'file' && eintrag.type.startsWith('image/')
    )
    if (eintraege.length === 0) return
    e.preventDefault()
    for (const eintrag of eintraege) bildAufnehmen(eintrag.getAsFile())
  }

  async function senden() {
    const sauber = text.trim()
    if ((!sauber && bilder.length === 0) || chat?.beschaeftigt) return
    setFehler('')
    const antwort = await window.flowforge.chatSenden(schluessel, sauber, bilder)
    if (antwort && !antwort.ok) return setFehler(antwort.fehler)
    setText('')
    setBilder([])
  }

  async function reparierenSetzen(an) {
    const ergebnis = await window.flowforge.chatReparierenSetzen(schluessel, an)
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    setFehler('')
    setChat((c) => c && { ...c, reparieren: ergebnis.reparieren })
  }

  function neuesGespraech() {
    setBestaetigung({
      frage: tc.neuesGespraechFrage,
      knopf: tc.neuesGespraech,
      aktion: async () => {
        const ergebnis = await window.flowforge.chatNeu(schluessel)
        if (!ergebnis.ok) return setFehler(ergebnis.fehler)
        setFehler('')
        setSchritt('')
        laden()
      }
    })
  }

  const laufAktiv = Boolean(chat?.laufAktiv)
  const uebersicht = !schluessel

  return (
    <aside className="chat-panel" aria-label={tc.titel}>
      <div className="chat-kopf">
        <div className="chat-kopf-text">
          <p className="gespraech-titel">{tc.titel}</p>
          <p className="chat-untertitel">
            {uebersicht ? tc.untertitelUebersicht : tc.untertitelProjekt(projektName ?? '')}
          </p>
        </div>
        <button
          className="knopf-klein"
          title={tc.neuesGespraechHinweis}
          disabled={!chat || chat.beschaeftigt}
          onClick={neuesGespraech}
        >
          {tc.neuesGespraech}
        </button>
        <button className="knopf-klein chat-schliessen" title={tc.schliessen} onClick={onSchliessen}>
          ×
        </button>
      </div>

      {laufAktiv && <p className="chat-lauf-hinweis">{tc.laufAktivHinweis}</p>}

      <div className="gespraech-verlauf chat-verlauf-panel">
        {verlauf.length === 0 && (
          <>
            <p className="feld-hinweis">{uebersicht ? tc.einleitungUebersicht : tc.einleitung}</p>
            {chat?.hinweis && <p className="feld-hinweis">{chat.hinweis}</p>}
          </>
        )}
        {verlauf.map((eintrag, i) => {
          if (eintrag.rolle === 'marke')
            return (
              <div key={i} className="chat-marke">
                <span>{eintrag.text}</span>
                <span className="chat-marke-hinweis">{tc.markeHinweis}</span>
              </div>
            )
          if (eintrag.rolle === 'hinweis')
            return (
              <p key={i} className="feld-hinweis chat-hinweis">
                {eintrag.text}
              </p>
            )
          return (
            <div
              key={i}
              className={
                'gespraech-blase chat-blase ' +
                (eintrag.rolle === 'mensch' ? 'blase-mensch' : 'blase-agent')
              }
            >
              {eintrag.rolle === 'ki' ? fettRendern(eintrag.text) : eintrag.text}
              {(eintrag.bilder ?? 0) > 0 && (
                <span className="chat-bild-marker"> {tc.bildMarker(eintrag.bilder)}</span>
              )}
            </div>
          )
        })}
        {chat?.beschaeftigt && (
          <p className="feld-hinweis chat-hinweis">
            {schritt ? tc.arbeitetSchritt(schritt) : tc.beschaeftigt}
          </p>
        )}
        <div ref={ende} />
      </div>

      {/* Rechte-Rückfrage des Chats — im Fenster selbst, damit sie auch in der
          Projektübersicht sichtbar ist (dort gibt es keinen Lauf-Tab). */}
      {frage && (
        <div className="chat-frage">
          <p className="gespraech-titel">{tf.ueberschrift}</p>
          <p className="frage-text">{frage.beschreibung}</p>
          <div className="dialog-knoepfe">
            <button
              className="knopf-sekundaer knopf-klein"
              onClick={() => window.flowforge.laufFrageAntworten(frage.frageId, false)}
            >
              {tf.ablehnen}
            </button>
            <button
              className="knopf-primaer knopf-klein"
              onClick={() => window.flowforge.laufFrageAntworten(frage.frageId, true)}
            >
              {tf.erlauben}
            </button>
          </div>
        </div>
      )}

      {/* Verbrauch sichtbar am Chat (dasselbe Muster wie im Lauf) —
          Chat-Nachrichten kosten Kontingent. */}
      {chat?.verbrauch && (
        <div>
          <VerbrauchZeile verbrauch={chat.verbrauch} modus={modus} mitBalken />
          <p className="feld-hinweis">{tc.verbrauchHinweis}</p>
        </div>
      )}

      <div className="gespraech-eingabe">
        {!uebersicht && (
          <label
            className="feld-kompakt chat-schalter"
            title={laufAktiv ? tc.reparierenWaehrendLauf : tc.reparierenHinweis}
          >
            <input
              type="checkbox"
              checked={Boolean(chat?.reparieren) && !laufAktiv}
              disabled={!chat || laufAktiv}
              onChange={(e) => reparierenSetzen(e.target.checked)}
            />
            {tc.reparierenLabel}
          </label>
        )}
        {bilder.length > 0 && (
          <div className="chat-bilder">
            {bilder.map((bild, i) => (
              <span key={i} className="chat-bild">
                <img src={bild} alt="" />
                <button
                  className="chip-entfernen"
                  title={tc.bildEntfernen}
                  onClick={() => setBilder((alt) => alt.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {fehler && <p className="fehlermeldung">{fehler}</p>}
        <div className="gespraech-zeile">
          <textarea
            rows={3}
            value={text}
            placeholder={tc.eingabePlatzhalter}
            onChange={(e) => setText(e.target.value)}
            onPaste={einfuegen}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                senden()
              }
            }}
          />
          <div className="chat-knoepfe">
            <button
              className="knopf-primaer knopf-klein"
              disabled={!chat || chat.beschaeftigt || (!text.trim() && bilder.length === 0)}
              onClick={senden}
            >
              {tc.senden}
            </button>
            <button
              className="knopf-sekundaer knopf-klein"
              onClick={() => dateiRef.current?.click()}
            >
              {tc.bildKnopf}
            </button>
            {chat?.beschaeftigt && (
              <button
                className="knopf-sekundaer knopf-klein"
                onClick={() => window.flowforge.chatAbbrechen(schluessel)}
              >
                {tc.stoppen}
              </button>
            )}
          </div>
          <input
            ref={dateiRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              for (const datei of e.target.files ?? []) bildAufnehmen(datei)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      {bestaetigung && (
        <Bestaetigung
          frage={bestaetigung.frage}
          knopf={bestaetigung.knopf}
          onBestaetigen={() => {
            const aktion = bestaetigung.aktion
            setBestaetigung(null)
            aktion?.()
          }}
          onAbbrechen={() => setBestaetigung(null)}
        />
      )}
    </aside>
  )
}
