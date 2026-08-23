// Verbrauchs-Zeile (Kontext-Füllstand, Tokens, theoretische Kosten) — im
// Lauf-Tab, an den Block-Karten und am Co-Pilot (BAUPLAN 33) dieselbe Zeile.
import { texte } from '../../shared/texte.js'
import { LOKAL_WAECHTER_PROZENT } from '../../shared/lokalRegeln.js'
import { UEBERTRAG_SCHWELLE_PROZENT } from '../../shared/blockKatalog.js'
import KontextAnzeige from './KontextAnzeige.jsx'

const t = texte.lauf

// Wer gehört in den großen Balken? (Fund 9, gemessen 22.08.2026)
//
// Es gibt zwei Wächter mit zwei Maßstäben: den Koordinator-Faden mit der
// Übertrags-Schwelle und — bei lokalen Läufen — den Block-Agenten mit dem
// Lokal-Wächter. Bis hierher zeigten Balken UND rote Marke immer den
// Koordinator; bei einem lokalen Lauf ist das ausgerechnet der Untätige: Er
// startet Blöcke und wartet, gearbeitet wird im Agenten. Dessen Zahl stand
// klein als Fließtext daneben.
//
// Belastbar gemessen: Zwei Leser hintereinander haben den Balken für den
// arbeitenden Agenten gehalten — Georg, der die Anzeige beauftragt hat, und
// die Session, die danach in die falsche Richtung grub.
//
// Deshalb dreht sich die Zuordnung bei lokalen Läufen um: Balken und Marke
// gehören dem Block-Agenten, der Koordinator wird zur Nebenzeile. Bei
// Claude-Läufen bleibt alles wie bisher — dort hat der Koordinator den einzigen
// Wächter, und die Übertrags-Schwelle ist die einzige Schwelle.
export function balkenWahl(verbrauch) {
  if (verbrauch?.lokal && verbrauch.agentProzentBis != null)
    return {
      von: verbrauch.agentProzentVon,
      bis: verbrauch.agentProzentBis,
      marke: LOKAL_WAECHTER_PROZENT,
      label: t.kontextBlockAgent,
      nebenzeile:
        verbrauch.kontextProzentBis != null
          ? t.verbrauchKoordinator(
              verbrauch.kontextProzentVon,
              verbrauch.kontextProzentBis,
              UEBERTRAG_SCHWELLE_PROZENT
            )
          : null
    }
  if (verbrauch?.kontextProzentBis == null) return null
  return {
    von: verbrauch.kontextProzentVon,
    bis: verbrauch.kontextProzentBis,
    marke: null,
    label: null,
    nebenzeile:
      verbrauch.agentProzentBis != null
        ? t.verbrauchAgent(verbrauch.agentProzentVon, verbrauch.agentProzentBis)
        : null
  }
}

export default function VerbrauchZeile({ verbrauch, modus, label, mitBalken }) {
  if (!verbrauch) return null
  const balken = mitBalken ? balkenWahl(verbrauch) : null
  const teile = []
  // Der Füllstand steht in der Textzeile nur, wenn es keinen Balken gibt
  // (historische Laufberichte, Block-Karten) — sonst stünde er doppelt.
  if (!balken && verbrauch.kontextProzentVon != null)
    teile.push(t.verbrauchKontext(verbrauch.kontextProzentVon, verbrauch.kontextProzentBis))
  // Die Tokens tragen ihre eigene Beschriftung (Fund 9): Sie zählen ALLE Fäden
  // zusammen, während die Prozente immer nur einen einzigen messen. Bis hierher
  // standen beide Zahlen durch einen Mittelpunkt verbunden nebeneinander
  // („Kontext: etwa 20–25 % gefüllt · 111.811 Tokens") und lasen sich wie eine
  // Gleichung. Sie ist keine.
  if (verbrauch.tokens != null)
    teile.push(t.verbrauchTokens(verbrauch.tokens + (verbrauch.unterTokens ?? 0)))
  if (verbrauch.kostenUsd != null)
    teile.push(modus === 'abo' ? t.verbrauchKostenAbo : t.verbrauchKosten(verbrauch.kostenUsd))
  if (teile.length === 0 && !balken) return null
  return (
    <div>
      {/* Kontext-Füllstand als Balken (Mockup 3c) — nur im laufenden Lauf,
          nicht in den historischen Laufberichten. */}
      {balken && (
        <KontextAnzeige
          von={balken.von}
          bis={balken.bis}
          marke={balken.marke}
          label={[label, balken.label].filter(Boolean).join(' · ') || null}
        />
      )}
      {/* Der Faden, der NICHT im Balken steht — bei einem lokalen Lauf der
          wartende Koordinator, sonst der arbeitende Block-Agent. */}
      {balken?.nebenzeile && <p className="verbrauch-zeile verbrauch-agent">{balken.nebenzeile}</p>}
      <p className="verbrauch-zeile">
        {label && !mitBalken ? `„${label}": ` : ''}
        {teile.join(' · ')}
      </p>
    </div>
  )
}
