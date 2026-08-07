import { useState } from 'react'
import { texte } from '../../shared/texte.js'
import Projektuebersicht from './Projektuebersicht.jsx'
import Projektansicht from './Projektansicht.jsx'

export default function App() {
  // null = Projektübersicht, sonst der Pfad des geöffneten Projekts
  const [offenesProjekt, setOffenesProjekt] = useState(null)

  return (
    <div className="app">
      <header className="kopfleiste">
        <span className="app-name">{texte.appName}</span>
      </header>
      <main className="inhalt">
        {offenesProjekt ? (
          <Projektansicht pfad={offenesProjekt} onZurueck={() => setOffenesProjekt(null)} />
        ) : (
          <Projektuebersicht onOeffnen={setOffenesProjekt} />
        )}
      </main>
    </div>
  )
}
