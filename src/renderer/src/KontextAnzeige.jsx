import { texte } from '../../shared/texte.js'
import { UEBERTRAG_SCHWELLE_PROZENT } from '../../shared/blockKatalog.js'

// Kontext-Füllstand als Balken (Mockup 3a/3c): blauer Verlauf bis zum oberen
// Rand des Toleranzbands, rote Marke an der Übertrags-Schwelle. Der Füllstand
// ist bewusst ein Band (von–bis), kein Punktwert — angezeigt wird das Band.
export default function KontextAnzeige({ von, bis, label }) {
  if (bis == null) return null
  const breite = Math.max(0, Math.min(100, bis))
  return (
    <div className="kontext-balken-bereich">
      <div className="kontext-balken-zeile">
        <span>{label ?? texte.projektuebersicht.kontextLabel}</span>
        <span className="kontext-balken-wert">
          {von != null && von !== bis ? `${von}–${bis} %` : `${breite} %`}
        </span>
      </div>
      <div className="kontext-balken">
        <span className="kontext-balken-fuellung" style={{ width: breite + '%' }} />
        <span
          className="kontext-balken-marke"
          style={{ left: UEBERTRAG_SCHWELLE_PROZENT + '%' }}
        />
      </div>
    </div>
  )
}
