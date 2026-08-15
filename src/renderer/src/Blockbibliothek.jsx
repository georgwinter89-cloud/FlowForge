import { texte } from '../../shared/texte.js'
import {
  BLOCK_KATALOG,
  VORLAGEN,
  BEREICHE,
  BEREICH_EIGENE,
  blockKategorie,
  blockDefinition,
  blockBereich
} from '../../shared/blockKatalog.js'
import { useKlappen, Klappe } from './klappen.jsx'

const t = texte.kette
const tp = texte.projektansicht

// Chips für braucht/liefert/Sperren — dieselbe Anzeige nutzt auch die Leinwand.
export function BlockChips({ def }) {
  return (
    <div className="chip-zeile">
      {def.nurLesen && <span className="block-chip chip-sperre">{t.nurLesenMarke}</span>}
      {def.prueft && <span className="block-chip chip-pruefer">{t.prueftMarke}</span>}
      {def.braucht.map((bedarf) => (
        <span key={bedarf} className="block-chip chip-braucht">
          {t.brauchtLabel}: {bedarf}
        </span>
      ))}
      {(def.brauchtOptional ?? []).map((bedarf) => (
        <span key={bedarf} className="block-chip chip-braucht chip-optional">
          {t.brauchtLabel}: {bedarf} ({t.fallsDaZusatz})
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
const klappeSchluessel = (bereich) => 'bib:' + bereich

// Blockbibliothek in Klappen (BAUPLAN 30), nach der Aufgabe im Ablauf:
// Vorlagen · Auftrag finden · Bauen · Prüfen · Gedächtnis · Eigene · [je freie
// Kategorie eigener Blöcke eine Klappe, alphabetisch] · Übung (standardmäßig
// zu). Eigene Blöcke (SPEC §4.5, BAUPLAN 14) kommen als Liste von der
// Projektansicht — sie hält den Stand und öffnet den Block-Editor. Eigene
// Blöcke mit Katalog-Bereich liegen hinter den Katalog-Blöcken ihrer Klappe.
// `pfad` = Projektpfad für die gemerkten Klappen-Zustände (ohne pfad: nur
// Standardzustand, nichts wird gespeichert).
export default function Blockbibliothek({ pfad, eigene, onNeuerBlock, onBearbeiten, onLoeschen }) {
  const [istOffen, umschalten] = useKlappen(pfad, [KLAPPE_UEBUNG])
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
        {VORLAGEN.map((vorlage) => (
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
              {vorlage.kette.map((blockId) => blockDefinition(blockId)?.name).join(' → ')}
            </p>
          </div>
        ))}
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
