import { texte } from '../../shared/texte.js'
import {
  BLOCK_KATALOG,
  VORLAGEN,
  BEREICHE,
  BEREICH_EIGENE,
  blockKategorie,
  blockDefinition,
  blockBereich,
  katalogEtiketten,
  klasseIstLokal,
  vorlagenKette
} from '../../shared/blockKatalog.js'
import { useKlappen, Klappe } from './klappen.jsx'
// Etiketten-Bibliothek (SPEC §4.5, BAUPLAN 48): Inhalt der Klappe „Etiketten".
import EtikettenBibliothek from './EtikettenBibliothek.jsx'

const t = texte.kette
const tp = texte.projektansicht

// Chips für braucht/liefert/Sperren — dieselbe Anzeige nutzt auch die Leinwand.
// herkunft (BAUPLAN 36): Nur im Schaubild gesetzt — Etikett → Namen der
// liefernden Vorfahren (leer = fehlt). In der Bibliothek gibt es keine Pfeile
// und damit keine Herkunft; die Chips bleiben dort wie bisher.
export function BlockChips({ def, herkunft = null }) {
  // „kommt von Paket schneiden" bzw. „fehlt" an den braucht-Chips.
  function herkunftZusatz(bedarf, optional) {
    if (!herkunft) return null
    const namen = herkunft.get(bedarf) ?? []
    // Führt zusammen (BAUPLAN 47): Ein Pflicht-Etikett mit genau EINEM
    // Lieferanten ist dort ein Mangel — die Steck-Prüfung verlangt zwei. Der
    // Chip sagt dasselbe wie die Prüfung, sonst stünde hier grün „kommt von
    // Bauer · A", während das Schaubild abgelehnt wird.
    if (def.fuehrtZusammen && !optional && namen.length === 1)
      return <span className="chip-herkunft chip-fehlt"> {t.kommtVonZuWenig(namen)}</span>
    if (namen.length > 0)
      return <span className="chip-herkunft"> {t.kommtVon(namen)}</span>
    // Ein optionales Etikett, das keiner liefert, ist kein Mangel — der Block
    // arbeitet dann ohne. Ein fehlendes Pflicht-Etikett ist einer.
    return <span className={optional ? 'chip-herkunft' : 'chip-herkunft chip-fehlt'}> {optional ? t.kommtNichtAn : t.fehltMarke}</span>
  }
  return (
    <div className="chip-zeile">
      {def.nurLesen && <span className="block-chip chip-sperre">{t.nurLesenMarke}</span>}
      {def.prueft && <span className="block-chip chip-pruefer">{t.prueftMarke}</span>}
      {def.fuehrtZusammen && (
        <span className="block-chip chip-zusammen">{t.fuehrtZusammenMarke}</span>
      )}
      {def.braucht.map((bedarf) => (
        <span key={bedarf} className="block-chip chip-braucht">
          {t.brauchtLabel}: {bedarf}
          {herkunftZusatz(bedarf, false)}
        </span>
      ))}
      {(def.brauchtOptional ?? []).map((bedarf) => (
        <span key={bedarf} className="block-chip chip-braucht chip-optional">
          {t.brauchtLabel}: {bedarf} ({t.fallsDaZusatz})
          {herkunftZusatz(bedarf, true)}
        </span>
      ))}
      {def.liefert.map((gabe) => (
        <span key={gabe} className="block-chip chip-liefert">
          {t.liefertLabel}: {gabe}
        </span>
      ))}
    </div>
  )
}

function BibliothekBlock({ block, onBearbeiten, onLoeschen }) {
  return (
    <div
      className={'bib-block kategorie-' + blockKategorie(block)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/flowforge-block', block.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <p className="karte-titel">
        {block.symbol} {block.name}
      </p>
      <p className="feld-hinweis">{block.beschreibung}</p>
      <BlockChips def={block} />
      {onBearbeiten && (
        <div className="karte-knoepfe">
          <button className="knopf-klein" onClick={() => onBearbeiten(block)}>
            {texte.blockEditor.bearbeiten}
          </button>
          <button className="knopf-klein" onClick={() => onLoeschen(block)}>
            {texte.blockEditor.loeschen}
          </button>
        </div>
      )}
    </div>
  )
}

// Anzeigename einer Bibliotheks-Klappe: feste Bereiche und „Eigene"/„Übung"
// aus texte.js, freie Kategorien eigener Blöcke heißen wie eingetippt.
export function bereichName(bereich) {
  return tp.bereiche[bereich] ?? bereich
}

// Klappen-Schlüssel für die gemerkten Zustände (main/klappen.js).
const KLAPPE_VORLAGEN = 'bib:vorlagen'
const KLAPPE_UEBUNG = 'bib:uebung'
// Etiketten (BAUPLAN 48, K17): eigener Schlüssel, nicht 'bib:etiketten' — der
// kollidierte mit einer freien Kategorie „etiketten" eigener Blöcke.
const KLAPPE_ETIKETTEN = 'bib:etikett-bibliothek'
const klappeSchluessel = (bereich) => 'bib:' + bereich

// Blockbibliothek in Klappen (BAUPLAN 30), nach der Aufgabe im Ablauf:
// Vorlagen · Auftrag finden · Bauen · Prüfen · Gedächtnis · Eigene · [je freie
// Kategorie eigener Blöcke eine Klappe, alphabetisch] · Etiketten (BAUPLAN 48,
// standardmäßig zu) · Übung (standardmäßig zu). Eigene Blöcke (SPEC §4.5,
// BAUPLAN 14) kommen als Liste von der Projektansicht — sie hält den Stand und
// öffnet den Block-Editor; dasselbe gilt für die eigenen Etiketten und den
// Etikett-Editor. Eigene Blöcke mit Katalog-Bereich liegen hinter den
// Katalog-Blöcken ihrer Klappe. `pfad` = Projektpfad für die gemerkten
// Klappen-Zustände (ohne pfad: nur Standardzustand, nichts wird gespeichert).
export default function Blockbibliothek({
  pfad,
  eigene,
  onNeuerBlock,
  onBearbeiten,
  onLoeschen,
  etiketten = [],
  onNeuesEtikett,
  onEtikettBearbeiten,
  onEtikettLoeschen,
  onEtikettKopieren
}) {
  const [istOffen, umschalten] = useKlappen(pfad, [KLAPPE_UEBUNG, KLAPPE_ETIKETTEN])
  const uebungsbloecke = BLOCK_KATALOG.filter((b) => b.uebung)

  // Eigene Blöcke je Bereich einsortieren; freie Kategorien alphabetisch.
  const eigeneJeBereich = new Map()
  for (const block of eigene) {
    const bereich = blockBereich(block) ?? BEREICH_EIGENE
    if (!eigeneJeBereich.has(bereich)) eigeneJeBereich.set(bereich, [])
    eigeneJeBereich.get(bereich).push(block)
  }
  const freieBereiche = [...eigeneJeBereich.keys()]
    .filter((b) => b !== BEREICH_EIGENE && !BEREICHE.includes(b))
    .sort((a, b) => a.localeCompare(b, 'de'))
  const eigeneOhneBereich = eigeneJeBereich.get(BEREICH_EIGENE) ?? []

  const bearbeitbar = { onBearbeiten, onLoeschen }

  return (
    <div className="bibliothek-liste">
      <Klappe
        titel={tp.vorlagenTitel}
        anzahl={VORLAGEN.length}
        offen={istOffen(KLAPPE_VORLAGEN)}
        onUmschalten={() => umschalten(KLAPPE_VORLAGEN)}
      >
        <p className="feld-hinweis">{tp.vorlageHinweis}</p>
        {VORLAGEN.map((vorlage) => {
          // Ketten-Glieder mit Klasse/Zusatz (BAUPLAN 50): „Bauer (lokal) →
          // Prüfer (lokal) → Prüfer · Abnahme" — die Vorlage sagt vorher, was
          // sie ablegt. Für die lokale Vorlage dazu der Satz, worum es geht.
          const glieder = vorlagenKette(vorlage)
          return (
            <div
              key={vorlage.id}
              className="bib-block bib-vorlage"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/flowforge-vorlage', vorlage.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
            >
              <p className="karte-titel">
                {vorlage.symbol} {vorlage.name}
              </p>
              <p className="feld-hinweis">
                {glieder
                  .map((glied) =>
                    t.vorlageGliedName(
                      blockDefinition(glied.blockId)?.name,
                      glied.zusatz,
                      klasseIstLokal(glied.modell) ? t.vorlageKlasseKurzLokal : ''
                    )
                  )
                  .join(' → ')}
              </p>
              {glieder.some((glied) => klasseIstLokal(glied.modell)) && (
                <p className="feld-hinweis">{t.vorlageErklaerungLokal}</p>
              )}
            </div>
          )
        })}
      </Klappe>

      {BEREICHE.map((bereich) => {
        const katalog = BLOCK_KATALOG.filter((b) => !b.uebung && blockBereich(b) === bereich)
        const eigeneHier = eigeneJeBereich.get(bereich) ?? []
        return (
          <Klappe
            key={bereich}
            titel={bereichName(bereich)}
            anzahl={katalog.length + eigeneHier.length}
            offen={istOffen(klappeSchluessel(bereich))}
            onUmschalten={() => umschalten(klappeSchluessel(bereich))}
          >
            {katalog.map((block) => (
              <BibliothekBlock key={block.id} block={block} />
            ))}
            {eigeneHier.map((block) => (
              <BibliothekBlock key={block.id} block={block} {...bearbeitbar} />
            ))}
          </Klappe>
        )
      })}

      <Klappe
        titel={bereichName(BEREICH_EIGENE)}
        anzahl={eigeneOhneBereich.length}
        offen={istOffen(klappeSchluessel(BEREICH_EIGENE))}
        onUmschalten={() => umschalten(klappeSchluessel(BEREICH_EIGENE))}
        rechts={
          <button className="knopf-primaer knopf-klein" onClick={onNeuerBlock}>
            + {texte.blockEditor.neuerBlock}
          </button>
        }
      >
        <p className="feld-hinweis">
          {eigene.length === 0 ? tp.eigeneBloeckeLeer : tp.eigeneBloeckeHinweis}
        </p>
        {eigeneOhneBereich.map((block) => (
          <BibliothekBlock key={block.id} block={block} {...bearbeitbar} />
        ))}
      </Klappe>

      {freieBereiche.map((bereich) => (
        <Klappe
          key={bereich}
          titel={bereich}
          anzahl={eigeneJeBereich.get(bereich).length}
          offen={istOffen(klappeSchluessel(bereich))}
          onUmschalten={() => umschalten(klappeSchluessel(bereich))}
        >
          {eigeneJeBereich.get(bereich).map((block) => (
            <BibliothekBlock key={block.id} block={block} {...bearbeitbar} />
          ))}
        </Klappe>
      ))}

      {/* Etiketten-Bibliothek (SPEC §4.5, BAUPLAN 48): Katalog-Etiketten und
          eigene — mit Knopf für ein neues Etikett. Der Zähler zählt alles,
          was in der Klappe liegt (wie die anderen Klappen); der Knopf heißt
          kurz „+ Neu", sonst schnitt er den Klappentitel ab (Prüfer-Befund). */}
      <Klappe
        titel={texte.etiketten.klappeTitel}
        anzahl={katalogEtiketten().length + etiketten.length}
        offen={istOffen(KLAPPE_ETIKETTEN)}
        onUmschalten={() => umschalten(KLAPPE_ETIKETTEN)}
        rechts={
          onNeuesEtikett && (
            <button
              className="knopf-primaer knopf-klein"
              title={texte.etiketten.neuesEtikett}
              onClick={onNeuesEtikett}
            >
              + {texte.etiketten.neuKnopf}
            </button>
          )
        }
      >
        <EtikettenBibliothek
          etiketten={etiketten}
          eigene={eigene}
          onBearbeiten={onEtikettBearbeiten}
          onLoeschen={onEtikettLoeschen}
          onKopieren={onEtikettKopieren}
        />
      </Klappe>

      <Klappe
        titel={bereichName('uebung')}
        anzahl={uebungsbloecke.length}
        offen={istOffen(KLAPPE_UEBUNG)}
        onUmschalten={() => umschalten(KLAPPE_UEBUNG)}
      >
        <p className="feld-hinweis">{tp.bibliothekHinweis}</p>
        {uebungsbloecke.map((block) => (
          <BibliothekBlock key={block.id} block={block} />
        ))}
      </Klappe>
    </div>
  )
}
