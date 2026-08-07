import { texte } from '../../shared/texte.js'
import { BLOCK_KATALOG, blockKategorie } from '../../shared/blockKatalog.js'

const t = texte.kette

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
      {def.liefert.map((gabe) => (
        <span key={gabe} className="block-chip chip-liefert">
          {t.liefertLabel}: {gabe}
        </span>
      ))}
    </div>
  )
}

export default function Blockbibliothek() {
  return (
    <div className="bibliothek-liste">
      <p className="feld-hinweis">{texte.projektansicht.bibliothekHinweis}</p>
      {BLOCK_KATALOG.map((block) => (
        <div
          key={block.id}
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
        </div>
      ))}
    </div>
  )
}
