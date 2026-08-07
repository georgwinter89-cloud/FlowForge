import { texte } from '../../shared/texte.js'
import { BLOCK_KATALOG, VORLAGEN, blockKategorie, blockDefinition } from '../../shared/blockKatalog.js'

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

function BibliothekBlock({ block }) {
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
    </div>
  )
}

export default function Blockbibliothek() {
  const arbeitsbloecke = BLOCK_KATALOG.filter((b) => !b.uebung)
  const uebungsbloecke = BLOCK_KATALOG.filter((b) => b.uebung)
  return (
    <div className="bibliothek-liste">
      <p className="bibliothek-gruppe">{tp.vorlagenTitel}</p>
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
      <p className="bibliothek-gruppe">{tp.arbeitsbloeckeTitel}</p>
      {arbeitsbloecke.map((block) => (
        <BibliothekBlock key={block.id} block={block} />
      ))}
      <p className="bibliothek-gruppe">{tp.uebungsbloeckeTitel}</p>
      <p className="feld-hinweis">{tp.bibliothekHinweis}</p>
      {uebungsbloecke.map((block) => (
        <BibliothekBlock key={block.id} block={block} />
      ))}
    </div>
  )
}
