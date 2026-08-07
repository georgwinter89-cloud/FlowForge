import { useState } from 'react'
import { texte } from '../../shared/texte.js'

const t = texte.projektuebersicht

export default function Projektuebersicht() {
  const [hinweis, setHinweis] = useState('')
  const projekte = []

  return (
    <section className="projektuebersicht">
      <div className="uebersicht-kopf">
        <h1>{t.ueberschrift}</h1>
        <button className="knopf-primaer" onClick={() => setHinweis(t.neuesProjektNochNicht)}>
          + {t.neuesProjekt}
        </button>
      </div>
      {hinweis && <p className="hinweis">{hinweis}</p>}
      {projekte.length === 0 && (
        <div className="leer-zustand">
          <p className="leer-titel">{t.leerHinweis}</p>
          <p className="leer-untertitel">{t.leerUntertitel}</p>
        </div>
      )}
    </section>
  )
}
