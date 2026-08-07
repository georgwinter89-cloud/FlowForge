import { useState } from 'react'
import { texte } from '../../shared/texte.js'
import Projektuebersicht from './Projektuebersicht.jsx'
import Projektansicht from './Projektansicht.jsx'
import Einstellungen from './Einstellungen.jsx'

export default function App() {
  // null = Projektübersicht, sonst der Pfad des geöffneten Projekts
  const [offenesProjekt, setOffenesProjekt] = useState(null)
  const [einstellungenOffen, setEinstellungenOffen] = useState(false)

  return (
    <div className="app">
      <header className="kopfleiste">
        <span className="app-name">{texte.appName}</span>
        <button
          className="knopf-klein kopf-knopf"
          onClick={() => setEinstellungenOffen(true)}
        >
          {texte.einstellungen.knopf}
        </button>
      </header>
      <main className="inhalt">
        {offenesProjekt ? (
          <Projektansicht pfad={offenesProjekt} onZurueck={() => setOffenesProjekt(null)} />
        ) : (
          <Projektuebersicht onOeffnen={setOffenesProjekt} />
        )}
      </main>
      {einstellungenOffen && <Einstellungen onSchliessen={() => setEinstellungenOffen(false)} />}
    </div>
  )
}
