import { texte } from '../../shared/texte.js'

const t = texte.projektEinstellungen

function RechteGruppe({ titel, eintraege, klasse }) {
  return (
    <div className={'rechte-gruppe rechte-' + klasse}>
      <p className="rechte-titel">{titel}</p>
      <ul className="rechte-liste">
        {eintraege.map((eintrag) => (
          <li key={eintrag}>{eintrag}</li>
        ))}
      </ul>
    </div>
  )
}

// Rechte-Standard sichtbar in den Projekt-Einstellungen (SPEC §7, BAUPLAN 15):
// In V1 nur zum Nachlesen — verstellbar pro Projekt wird das erst in V2.
export default function ProjektEinstellungen({ onSchliessen }) {
  return (
    <div className="dialog-schleier">
      <div className="dialog dialog-breit">
        <h2>{t.ueberschrift}</h2>
        <div>
          <p className="bericht-abschnitt">{t.rechteUeberschrift}</p>
          <p className="feld-hinweis">{t.rechteEinleitung}</p>
        </div>
        <div className="rechte-spalten">
          <RechteGruppe titel={t.ohneRueckfrageTitel} eintraege={t.ohneRueckfrage} klasse="frei" />
          <RechteGruppe titel={t.mitRueckfrageTitel} eintraege={t.mitRueckfrage} klasse="frage" />
          <RechteGruppe titel={t.gesperrtTitel} eintraege={t.gesperrt} klasse="gesperrt" />
        </div>
        <p className="feld-hinweis">{t.hinweisAutomodus}</p>
        <p className="feld-hinweis">{t.kontingentHinweis}</p>
        <div className="dialog-knoepfe">
          <button className="knopf-primaer" onClick={onSchliessen}>
            {t.schliessen}
          </button>
        </div>
      </div>
    </div>
  )
}
