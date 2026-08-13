import { texte } from '../../shared/texte.js'

// Eigener Bestätigungs-Dialog statt window.confirm/alert (Bugfix 13.08.2026):
// Das native Windows-Fenster stahl dem App-Fenster den Eingabefokus — danach
// waren Formulare tot (nichts anklickbar, nichts tippbar), bis man das Fenster
// einmal verließ und wieder anklickte. Eigene Dialoge haben das Problem nicht.
// Ohne onAbbrechen zeigt der Dialog nur einen Knopf (Hinweis-Modus, ersetzt alert).
export default function Bestaetigung({ frage, knopf, gefahr, onBestaetigen, onAbbrechen }) {
  return (
    <div className="dialog-schleier">
      <div className="dialog">
        <p className="frage-text">{frage}</p>
        <div className="dialog-knoepfe">
          {onAbbrechen && (
            <button className="knopf-sekundaer" onClick={onAbbrechen}>
              {texte.bestaetigung.abbrechen}
            </button>
          )}
          <button
            className={gefahr ? 'knopf-gefahr' : 'knopf-primaer'}
            onClick={onBestaetigen}
          >
            {knopf ?? (onAbbrechen ? texte.bestaetigung.ja : texte.bestaetigung.ok)}
          </button>
        </div>
      </div>
    </div>
  )
}
