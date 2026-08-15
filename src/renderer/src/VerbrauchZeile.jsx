// Verbrauchs-Zeile (Kontext-Füllstand, Tokens, theoretische Kosten) — im
// Lauf-Tab, an den Block-Karten und am Co-Pilot (BAUPLAN 33) dieselbe Zeile.
import { texte } from '../../shared/texte.js'
import KontextAnzeige from './KontextAnzeige.jsx'

const t = texte.lauf

export default function VerbrauchZeile({ verbrauch, modus, label, mitBalken }) {
  if (!verbrauch) return null
  const teile = []
  if (verbrauch.kontextProzentVon != null)
    teile.push(t.verbrauchKontext(verbrauch.kontextProzentVon, verbrauch.kontextProzentBis))
  // Verbrauch der Unteraufgaben (BAUPLAN 17) zählt ehrlich mit — der
  // Kontext-Füllstand daneben misst nur die Hauptsession.
  if (verbrauch.tokens != null)
    teile.push(t.verbrauchTokens(verbrauch.tokens + (verbrauch.unterTokens ?? 0)))
  if (verbrauch.kostenUsd != null)
    teile.push(modus === 'abo' ? t.verbrauchKostenAbo : t.verbrauchKosten(verbrauch.kostenUsd))
  if (teile.length === 0) return null
  return (
    <div>
      {/* Kontext-Füllstand als Balken (Mockup 3c) — nur im laufenden Lauf,
          nicht in den historischen Laufberichten. */}
      {mitBalken && verbrauch.kontextProzentBis != null && (
        <KontextAnzeige
          von={verbrauch.kontextProzentVon}
          bis={verbrauch.kontextProzentBis}
          label={label}
        />
      )}
      <p className="verbrauch-zeile">
        {label && !mitBalken ? `„${label}": ` : ''}
        {teile.join(' · ')}
      </p>
    </div>
  )
}
