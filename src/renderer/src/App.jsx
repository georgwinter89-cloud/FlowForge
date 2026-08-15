import { useState } from 'react'
import { texte } from '../../shared/texte.js'
import Projektuebersicht from './Projektuebersicht.jsx'
import Projektansicht from './Projektansicht.jsx'
import Einstellungen from './Einstellungen.jsx'
import Metriken from './Metriken.jsx'
import Chat from './Chat.jsx'

export default function App() {
  // null = Projektübersicht, sonst { pfad, name, tab } des geöffneten Projekts.
  // tab steuert, welcher Leinwand-Tab beim Öffnen vorn liegt („Zum Gespräch"
  // auf der Übersicht springt direkt in den Lauf).
  const [offenesProjekt, setOffenesProjekt] = useState(null)
  const [einstellungenOffen, setEinstellungenOffen] = useState(false)
  // Metriken (BAUPLAN 31): globale Seite über alle Projekte — der Knopf in
  // der Titelleiste legt sie über die aktuelle Ansicht; die Brotkrume führt
  // zurück (das offene Projekt bleibt gemerkt).
  const [metrikenOffen, setMetrikenOffen] = useState(false)
  // Co-Pilot (BAUPLAN 33): ein seitliches Chat-Fenster — in der Übersicht wie
  // im Projekt; welcher Chat gemeint ist, entscheidet das offene Projekt.
  const [chatOffen, setChatOffen] = useState(false)

  return (
    <div className="app">
      <header className="kopfleiste">
        <span className="kopf-logo" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2 L5 13 H11 L9.5 22 L19 9.5 H12.5 Z" />
          </svg>
        </span>
        <span className="kopf-wort">
          <span className="app-name">
            Flow<span className="kopf-forge">Forge</span>
          </span>
          <span className="kopf-werkbank">{texte.kopfleiste.werkbank}</span>
        </span>
        {metrikenOffen ? (
          <button className="kopf-brotkrume" onClick={() => setMetrikenOffen(false)}>
            ← {offenesProjekt ? offenesProjekt.name : texte.kopfleiste.zuProjekten}
            &nbsp;&nbsp;/&nbsp;&nbsp;
            <b>{texte.metriken.ueberschrift}</b>
          </button>
        ) : (
          offenesProjekt && (
            <button className="kopf-brotkrume" onClick={() => setOffenesProjekt(null)}>
              ← {texte.kopfleiste.zuProjekten}&nbsp;&nbsp;/&nbsp;&nbsp;
              <b>{offenesProjekt.name}</b>
            </button>
          )
        )}
        <button
          className={'knopf-klein kopf-knopf' + (chatOffen ? ' kopf-knopf-aktiv' : '')}
          onClick={() => setChatOffen((alt) => !alt)}
        >
          💬 {texte.kopfleiste.chatKnopf}
        </button>
        <button
          className={'knopf-klein kopf-knopf' + (metrikenOffen ? ' kopf-knopf-aktiv' : '')}
          onClick={() => setMetrikenOffen((alt) => !alt)}
        >
          {texte.kopfleiste.metrikenKnopf}
        </button>
        <button
          className="knopf-klein kopf-knopf"
          onClick={() => setEinstellungenOffen(true)}
        >
          {texte.einstellungen.knopf}
        </button>
      </header>
      <div className="rumpf">
        <main className="inhalt">
          {metrikenOffen ? (
            <Metriken />
          ) : offenesProjekt ? (
            <Projektansicht pfad={offenesProjekt.pfad} initialTab={offenesProjekt.tab} />
          ) : (
            <Projektuebersicht
              onOeffnen={(pfad, name, tab) => setOffenesProjekt({ pfad, name, tab })}
            />
          )}
        </main>
        {chatOffen && (
          <Chat
            pfad={offenesProjekt?.pfad ?? null}
            projektName={offenesProjekt?.name ?? ''}
            onSchliessen={() => setChatOffen(false)}
          />
        )}
      </div>
      {einstellungenOffen && <Einstellungen onSchliessen={() => setEinstellungenOffen(false)} />}
    </div>
  )
}
