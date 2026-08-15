// App-Tab (BAUPLAN 32, SPEC §8): die Startanleitung läuft in FlowForge —
// Startanleitung, Start/Stopp/Neustart, Ausgabe der laufenden App live
// (Standard + Fehler, ohne Farbcodes), Zustand, „Adresse im Browser öffnen",
// Port-Dialog vor dem Start und als Rückfall die Liste noch laufender
// Prozesse aus Läufen. Eigener Baustein — nicht in Leinwand.jsx.
import { useEffect, useRef, useState } from 'react'
import { texte } from '../../shared/texte.js'
import Bestaetigung from './Bestaetigung.jsx'

const t = texte.app

function uhrzeit(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function zeitpunkt(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ', ' + uhrzeit(iso)
}

function zustandText(zustand) {
  if (!zustand || zustand.zustand === 'aus') return t.zustandAus
  if (zustand.zustand === 'startet') return t.zustandStartet
  if (zustand.zustand === 'laeuft') return t.zustandLaeuft(uhrzeit(zustand.gestartetAm))
  if (zustand.zustand === 'nur-adresse') return t.zustandNurAdresse
  if (zustand.gestoppt) return t.zustandGestoppt(uhrzeit(zustand.beendetAm))
  return t.zustandBeendet(zustand.code, uhrzeit(zustand.beendetAm))
}

// Rückfall-Liste noch laufender Prozesse aus Läufen (Abgleich PID + Startzeit).
function VerwaisteListe({ sichtbar, onFrage }) {
  const [prozesse, setProzesse] = useState(null)
  const [laedt, setLaedt] = useState(false)

  async function laden() {
    setLaedt(true)
    const ergebnis = await window.flowforge.verwaisteProzesse()
    setLaedt(false)
    if (ergebnis.ok) setProzesse(ergebnis.prozesse)
  }

  // Beim ersten Sichtbarwerden laden — nicht im Hintergrund pollen.
  useEffect(() => {
    if (sichtbar && prozesse === null) laden()
  }, [sichtbar])

  function beenden(p) {
    onFrage({
      frage: t.prozessBeendenFrage(p.name, p.pid),
      knopf: t.prozessBeenden,
      gefahr: true,
      aktion: async () => {
        const ergebnis = await window.flowforge.prozessBeenden(p.pid, p.start)
        if (!ergebnis.ok && ergebnis.wiederverwendet) onFrage({ frage: t.prozessWiederverwendet })
        else if (!ergebnis.ok) onFrage({ frage: t.prozessNichtBeendet })
        setTimeout(laden, 500)
      }
    })
  }

  return (
    <section className="app-verwaiste">
      <div className="app-abschnitt-kopf">
        <h3>{t.verwaisteTitel}</h3>
        <button className="knopf-sekundaer knopf-klein" disabled={laedt} onClick={laden}>
          {t.verwaisteAktualisieren}
        </button>
      </div>
      <p className="feld-hinweis">{t.verwaisteHinweis}</p>
      {prozesse && prozesse.length === 0 && <p className="feld-hinweis app-sauber">{t.verwaisteLeer}</p>}
      {prozesse && prozesse.length > 0 && (
        <div className="app-prozess-liste">
          {prozesse.map((p) => (
            <div key={`${p.pid}:${p.start}`} className="app-prozess-zeile">
              <div className="app-prozess-text">
                <span className="app-prozess-name">
                  {p.name || '?'} <span className="app-prozess-pid">({p.pid})</span>
                </span>
                <span className={'app-prozess-marke' + (p.sicher ? ' app-prozess-sicher' : '')}>
                  {p.sicher ? t.verwaisteSicher : t.verwaisteVermutlich}
                </span>
                <span className="app-prozess-zeit">{t.verwaisteGestartet(zeitpunkt(p.gestartetAm))}</span>
                <code className="app-prozess-befehl" title={p.befehl}>
                  {p.befehl}
                </code>
              </div>
              <button className="knopf-gefahr" onClick={() => beenden(p)}>
                {t.prozessBeenden}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function AppTab({ pfad, anleitung, sichtbar, startAnstoss, onZustand }) {
  const [zustand, setZustand] = useState(null)
  const [ausgabe, setAusgabe] = useState('')
  const [wartetAdresse, setWartetAdresse] = useState(false)
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [fehler, setFehler] = useState('')
  // Port belegt (BAUPLAN 32): { port, pid, name, befehl } → Dialog.
  const [portDialog, setPortDialog] = useState(null)
  const [bestaetigung, setBestaetigung] = useState(null)
  const ausgabeEnde = useRef(null)
  const ausgabeBox = useRef(null)
  const letzterAnstoss = useRef(0)

  function zustandUebernehmen(z) {
    setZustand(z)
    onZustand?.(z)
  }

  useEffect(() => {
    setAusgabe('')
    setZustand(null)
    setFehler('')
    window.flowforge.appZustand(pfad).then((z) => {
      if (!z.ok) return
      zustandUebernehmen(z)
      setAusgabe(z.ausgabe ?? '')
    })
    return window.flowforge.aufAppEreignis((ereignis) => {
      if (ereignis.projektPfad !== pfad) return
      if (ereignis.art === 'app-ausgabe') setAusgabe(ereignis.ausgabe)
      if (ereignis.art === 'app-zustand') zustandUebernehmen(ereignis)
      if (ereignis.art === 'app-wartet-adresse') setWartetAdresse(ereignis.wartet)
    })
  }, [pfad])

  // Ausgabe unten halten, solange Georg nicht selbst hochgescrollt hat.
  useEffect(() => {
    const box = ausgabeBox.current
    if (!box) return
    const amEnde = box.scrollHeight - box.scrollTop - box.clientHeight < 40
    if (amEnde) ausgabeEnde.current?.scrollIntoView({ block: 'nearest' })
  }, [ausgabe])

  async function starten(portFreimachen = false) {
    if (beschaeftigt) return
    setFehler('')
    setBeschaeftigt(true)
    const ergebnis = await window.flowforge.appStarten(pfad, portFreimachen)
    setBeschaeftigt(false)
    if (ergebnis.ok) return
    if (ergebnis.portBelegt) return setPortDialog(ergebnis.portBelegt)
    setFehler(ergebnis.fehler ?? texte.fehler.unbekannt)
  }

  // Der „App starten"-Knopf im Kopf springt hierher und startet (Zähler).
  useEffect(() => {
    if (!startAnstoss || startAnstoss === letzterAnstoss.current) return
    letzterAnstoss.current = startAnstoss
    if (anleitung && !(zustand?.laeuft || zustand?.startet)) starten()
  }, [startAnstoss])

  async function stoppen() {
    if (beschaeftigt) return
    setBeschaeftigt(true)
    await window.flowforge.appStoppen(pfad)
    setBeschaeftigt(false)
  }

  async function neustarten() {
    if (beschaeftigt) return
    setFehler('')
    setBeschaeftigt(true)
    const ergebnis = await window.flowforge.appNeustarten(pfad)
    setBeschaeftigt(false)
    if (ergebnis.ok) return
    if (ergebnis.portBelegt) return setPortDialog(ergebnis.portBelegt)
    setFehler(ergebnis.fehler ?? texte.fehler.unbekannt)
  }

  async function adresseOeffnen() {
    setFehler('')
    const ergebnis = await window.flowforge.appAdresseOeffnen(pfad)
    if (!ergebnis.ok) setFehler(ergebnis.fehler ?? texte.fehler.unbekannt)
  }

  const laeuft = Boolean(zustand?.laeuft || zustand?.startet)
  const hatBefehl = Boolean(anleitung?.befehl)

  return (
    <div className="app-tab">
      <section className="app-kopf">
        <h3>{t.ueberschrift}</h3>
        {!anleitung && <p className="feld-hinweis">{t.keineAnleitung}</p>}
        {anleitung && (
          <>
            <p className="app-beschreibung">{anleitung.beschreibung}</p>
            <dl className="app-anleitung">
              {anleitung.befehl && (
                <>
                  <dt>{t.befehlLabel}</dt>
                  <dd>
                    <code>{anleitung.befehl}</code>
                  </dd>
                </>
              )}
              {anleitung.adresse && (
                <>
                  <dt>{t.adresseLabel}</dt>
                  <dd>
                    <code>{anleitung.adresse}</code>
                  </dd>
                </>
              )}
            </dl>
            {!hatBefehl && <p className="feld-hinweis">{t.keinBefehl}</p>}
            <div className="app-zeile">
              <span className={'app-zustand' + (laeuft ? ' app-zustand-laeuft' : '')}>
                {laeuft && <span className="pulspunkt" />}
                {zustandText(zustand)}
                {wartetAdresse && <span className="app-wartet"> · {t.wartetAufAdresse}</span>}
              </span>
              <div className="lauf-knoepfe">
                {!laeuft && (
                  <button className="knopf-primaer" disabled={beschaeftigt} onClick={() => starten()}>
                    ▶ {t.starten}
                  </button>
                )}
                {laeuft && (
                  <>
                    <button className="knopf-gefahr" disabled={beschaeftigt} onClick={stoppen}>
                      ■ {t.stoppen}
                    </button>
                    <button className="knopf-sekundaer" disabled={beschaeftigt} onClick={neustarten}>
                      ↻ {t.neustarten}
                    </button>
                  </>
                )}
                {anleitung.adresse && (
                  <button className="knopf-sekundaer" disabled={hatBefehl && !laeuft} onClick={adresseOeffnen}>
                    {t.adresseOeffnen}
                  </button>
                )}
              </div>
            </div>
            {fehler && <p className="fehlermeldung">{fehler}</p>}
          </>
        )}
      </section>

      {anleitung && hatBefehl && (
        <section className="app-ausgabe-bereich">
          <div className="app-abschnitt-kopf">
            <h3>{t.ausgabeTitel}</h3>
            <span className="feld-hinweis">{t.ausgabeHinweis}</span>
          </div>
          <div className="app-ausgabe" ref={ausgabeBox}>
            {ausgabe ? <pre>{ausgabe}</pre> : <p className="denk-leer">{t.ausgabeLeer}</p>}
            <div ref={ausgabeEnde} />
          </div>
        </section>
      )}

      <VerwaisteListe sichtbar={sichtbar} onFrage={setBestaetigung} />

      {portDialog && (
        <div className="dialog-schleier">
          <div className="dialog">
            <h2>{t.portBelegtTitel}</h2>
            <p className="frage-text">{t.portBelegtFrage(portDialog.port, portDialog.name, portDialog.pid)}</p>
            {portDialog.befehl && (
              <p className="feld-hinweis">
                {t.portBelegtBefehl}: <code>{portDialog.befehl}</code>
              </p>
            )}
            <div className="dialog-knoepfe">
              <button className="knopf-sekundaer" onClick={() => setPortDialog(null)}>
                {texte.bestaetigung.abbrechen}
              </button>
              <button
                className="knopf-primaer"
                onClick={() => {
                  setPortDialog(null)
                  starten(true)
                }}
              >
                {t.portBelegtKnopf}
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
          onAbbrechen={bestaetigung.aktion ? () => setBestaetigung(null) : null}
        />
      )}
    </div>
  )
}
