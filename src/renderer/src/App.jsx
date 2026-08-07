import { texte } from '../../shared/texte.js'
import Projektuebersicht from './Projektuebersicht.jsx'

export default function App() {
  return (
    <div className="app">
      <header className="kopfleiste">
        <span className="app-name">{texte.appName}</span>
      </header>
      <main className="inhalt">
        <Projektuebersicht />
      </main>
    </div>
  )
}
