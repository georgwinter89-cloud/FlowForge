import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'
import { eigeneBloeckeSetzen } from '../../shared/blockKatalog.js'
import KartenFormular from './KartenFormular.jsx'
import Leinwand from './Leinwand.jsx'
import Blockbibliothek from './Blockbibliothek.jsx'
import BlockEditor from './BlockEditor.jsx'
import ProjektEinstellungen from './ProjektEinstellungen.jsx'

const t = texte.projektansicht
const tk = texte.karten
const tst = texte.startanleitung

function Karte({ karte, onBearbeiten, onErledigt, onLoeschen }) {
  const istStatus = karte.sorte === 'status'
  const istAufgabe = karte.sorte === 'aufgabe'
  return (
    <div
      className={'karte karte-' + karte.sorte + (karte.erledigt ? ' karte-erledigt' : '')}
      // Kartenvorauswahl (SPEC §5): Karten lassen sich in den Lauf-Kontext auf
      // der Leinwand ziehen. Die Status-Karte ist ohnehin immer dabei.
      draggable={!istStatus}
      onDragStart={
        istStatus
          ? undefined
          : (e) => e.dataTransfer.setData('text/flowforge-karte', karte.id)
      }
    >
      <div className="karte-kopf">
        <span className="karte-sorte">{tk.sorten[karte.sorte]}</span>
        {istAufgabe && (
          <span className="karte-zustand">{karte.erledigt ? tk.erledigt : tk.offen}</span>
        )}
      </div>
      <p className="karte-titel">{karte.titel}</p>
      <p className="karte-text">{karte.text}</p>
      <div className="karte-knoepfe">
        {istAufgabe && (
          <button className="knopf-klein" onClick={() => onErledigt(karte)}>
            {karte.erledigt ? tk.wiederOeffnen : tk.erledigen}
          </button>
        )}
        <button className="knopf-klein" onClick={() => onBearbeiten(karte)}>
          {tk.bearbeiten}
        </button>
        {!istStatus && (
          <button className="knopf-klein" onClick={() => onLoeschen(karte)}>
            {tk.loeschen}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Projektansicht({ pfad, onZurueck }) {
  const [projekt, setProjekt] = useState(null)
  const [karten, setKarten] = useState([])
  const [fehler, setFehler] = useState('')
  const [filter, setFilter] = useState('alle')
  // false = zu, 'neu' = neue Karte, sonst die Karte, die bearbeitet wird
  const [formular, setFormular] = useState(false)
  // Startanleitung (SPEC §8): null = noch keine — der Knopf bleibt grau.
  const [anleitung, setAnleitung] = useState(null)
  const [startLaeuft, setStartLaeuft] = useState(false)
  const [startFehler, setStartFehler] = useState('')
  // Eigene Blöcke (SPEC §4.5, BAUPLAN 14): null = noch nicht geladen — erst
  // dann rendert die Leinwand, sonst könnte sie eigene Blöcke im Schaubild
  // nicht auflösen. false = Editor zu, 'neu' = neuer Block, sonst der Block.
  const [eigene, setEigene] = useState(null)
  const [blockEditor, setBlockEditor] = useState(false)
  // Projekt-Einstellungen (BAUPLAN 15): zeigen den Rechte-Standard des Agenten.
  const [einstellungenOffen, setEinstellungenOffen] = useState(false)

  function projektLaden() {
    window.flowforge.projektOeffnen(pfad).then((ergebnis) => {
      if (!ergebnis.ok) return setFehler(ergebnis.fehler)
      setProjekt(ergebnis.projekt)
      setKarten(ergebnis.karten)
    })
    // Auch nach einer Wiederherstellung kann die Startanleitung auftauchen
    // oder verschwinden — deshalb hier mitgeladen.
    window.flowforge.startanleitungLaden(pfad).then((ergebnis) => {
      if (ergebnis.ok) setAnleitung(ergebnis.anleitung)
    })
  }

  useEffect(projektLaden, [pfad])

  useEffect(() => {
    window.flowforge.eigeneBloeckeLaden().then((ergebnis) => {
      if (!ergebnis.ok) return
      eigeneBloeckeSetzen(ergebnis.bloecke)
      setEigene(ergebnis.bloecke)
    })
  }, [])

  // Jede Änderung an eigenen Blöcken liefert den neuen Gesamtstand zurück —
  // Registry zuerst, damit Leinwand und Regeln beim Neu-Rendern schon stimmen.
  function eigeneUebernehmen(ergebnis) {
    if (ergebnis.ok) {
      eigeneBloeckeSetzen(ergebnis.bloecke)
      setEigene(ergebnis.bloecke)
      setBlockEditor(false)
    }
    return ergebnis
  }

  async function blockSpeichern(block) {
    return eigeneUebernehmen(await window.flowforge.eigenenBlockSpeichern(block))
  }

  async function blockLoeschen(block) {
    if (!window.confirm(texte.blockEditor.loeschenBestaetigung(block.name))) return
    const ergebnis = eigeneUebernehmen(await window.flowforge.eigenenBlockLoeschen(block.id))
    // Lösch-Sperre (BAUPLAN 14): liegt der Block noch auf einer Leinwand,
    // lehnt der Hauptprozess ab — mit den Projektnamen.
    if (!ergebnis.ok) window.alert(ergebnis.fehler)
  }

  // Der Agent kann Karten und Startanleitung mitten im Lauf ändern —
  // Seitenleiste und „App starten"-Knopf ziehen sofort nach.
  useEffect(() => {
    return window.flowforge.aufLaufEreignis((ereignis) => {
      if (ereignis.projektPfad !== pfad) return
      if (ereignis.art === 'karten') setKarten(ereignis.karten)
      if (ereignis.art === 'startanleitung') setAnleitung(ereignis.anleitung)
      // Nach dem Laufende sicherheitshalber frisch laden — ein harter Abbruch
      // kann die Startanleitung per Sicherungspunkt zurückgedreht haben.
      if (ereignis.art === 'fertig')
        window.flowforge.startanleitungLaden(pfad).then((ergebnis) => {
          if (ergebnis.ok) setAnleitung(ergebnis.anleitung)
        })
    })
  }, [pfad])

  async function appStarten() {
    if (startLaeuft) return
    setStartFehler('')
    setStartLaeuft(true)
    const ergebnis = await window.flowforge.appStarten(pfad)
    setStartLaeuft(false)
    if (!ergebnis.ok) setStartFehler(ergebnis.fehler)
  }

  // Jede Kartenänderung liefert den neuen Gesamtstand zurück.
  function uebernehmen(ergebnis) {
    if (ergebnis.ok) {
      setKarten(ergebnis.karten)
      setFormular(false)
    }
    return ergebnis
  }

  async function speichern(eingabe) {
    const ergebnis =
      formular === 'neu'
        ? await window.flowforge.karteAnlegen(pfad, eingabe)
        : await window.flowforge.karteAendern(pfad, formular.id, eingabe)
    return uebernehmen(ergebnis)
  }

  async function erledigtWechseln(karte) {
    uebernehmen(await window.flowforge.karteErledigtSetzen(pfad, karte.id, !karte.erledigt))
  }

  async function loeschen(karte) {
    if (!window.confirm(tk.loeschenBestaetigung)) return
    uebernehmen(await window.flowforge.karteLoeschen(pfad, karte.id))
  }

  // Kontingent-Verhalten pro Projekt (SPEC §5): pausieren oder anhalten.
  async function kontingentVerhaltenSetzen(verhalten) {
    const ergebnis = await window.flowforge.kontingentVerhaltenSetzen(pfad, verhalten)
    if (ergebnis.ok)
      setProjekt((alt) => alt && { ...alt, kontingentVerhalten: ergebnis.kontingentVerhalten })
  }

  if (fehler) {
    return (
      <section className="projektansicht">
        <div className="ansicht-kopf">
          <button className="knopf-sekundaer" onClick={onZurueck}>
            ← {t.zurueck}
          </button>
        </div>
        <p className="fehlermeldung">{fehler}</p>
      </section>
    )
  }

  const statusKarte = karten.find((k) => k.sorte === 'status')
  const weitere = karten
    .filter((k) => k.sorte !== 'status')
    .filter((k) => filter === 'alle' || k.sorte === filter)
    .sort((a, b) => Number(a.erledigt === true) - Number(b.erledigt === true))

  return (
    <section className="projektansicht">
      <div className="ansicht-kopf">
        <button className="knopf-sekundaer" onClick={onZurueck}>
          ← {t.zurueck}
        </button>
        <h1>{projekt?.name}</h1>
        <div className="kopf-rechts">
          {startFehler && <span className="start-fehler">{startFehler}</span>}
          <button
            className="knopf-sekundaer knopf-klein"
            onClick={() => setEinstellungenOffen(true)}
          >
            {t.einstellungenKnopf}
          </button>
          <button
            className="knopf-primaer"
            disabled={!anleitung || startLaeuft}
            title={anleitung ? anleitung.beschreibung : tst.keineHinweis}
            onClick={appStarten}
          >
            ▶ {startLaeuft ? tst.startet : tst.knopf}
          </button>
        </div>
      </div>
      <div className="drei-spalten">
        <aside className="spalte spalte-karten">
          <div className="spalten-kopf">
            <h2>{tk.ueberschrift}</h2>
            <button className="knopf-primaer knopf-klein" onClick={() => setFormular('neu')}>
              + {tk.neueKarte}
            </button>
          </div>
          <div className="filter-zeile">
            {['alle', 'aufgabe', 'entscheidung', 'wissen'].map((wert) => (
              <button
                key={wert}
                className={'filter-chip' + (filter === wert ? ' filter-aktiv' : '')}
                onClick={() => setFilter(wert)}
              >
                {wert === 'alle' ? tk.filterAlle : tk.sorten[wert]}
              </button>
            ))}
          </div>
          <div className="karten-liste">
            {statusKarte && (
              <Karte
                karte={statusKarte}
                onBearbeiten={setFormular}
                onErledigt={erledigtWechseln}
                onLoeschen={loeschen}
              />
            )}
            {weitere.map((karte) => (
              <Karte
                key={karte.id}
                karte={karte}
                onBearbeiten={setFormular}
                onErledigt={erledigtWechseln}
                onLoeschen={loeschen}
              />
            ))}
            {weitere.length === 0 && <p className="feld-hinweis">{tk.keineKarten}</p>}
          </div>
        </aside>
        <div className="spalte spalte-leinwand">
          <div className="spalten-kopf">
            <h2>{t.leinwandTitel}</h2>
          </div>
          {/* Nach einer Wiederherstellung kann sich karten.json geändert haben.
              Erst rendern, wenn die eigenen Blöcke in der Registry sind —
              sonst könnte das Schaubild eigene Blöcke nicht auflösen. */}
          {eigene !== null && (
            <Leinwand
              pfad={pfad}
              karten={karten}
              kontingentVerhalten={projekt?.kontingentVerhalten ?? 'pausieren'}
              onKontingentVerhalten={kontingentVerhaltenSetzen}
              onWiederhergestellt={projektLaden}
            />
          )}
        </div>
        <aside className="spalte spalte-bibliothek">
          <div className="spalten-kopf">
            <h2>{t.bibliothekTitel}</h2>
          </div>
          <Blockbibliothek
            eigene={eigene ?? []}
            onNeuerBlock={() => setBlockEditor('neu')}
            onBearbeiten={setBlockEditor}
            onLoeschen={blockLoeschen}
          />
        </aside>
      </div>
      {formular && (
        <KartenFormular
          karte={formular === 'neu' ? null : formular}
          onSpeichern={speichern}
          onAbbrechen={() => setFormular(false)}
        />
      )}
      {blockEditor && (
        <BlockEditor
          block={blockEditor === 'neu' ? null : blockEditor}
          onSpeichern={blockSpeichern}
          onAbbrechen={() => setBlockEditor(false)}
        />
      )}
      {einstellungenOffen && (
        <ProjektEinstellungen onSchliessen={() => setEinstellungenOffen(false)} />
      )}
    </section>
  )
}
