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

// Eigene Blöcke (SPEC §4.5, BAUPLAN 14) kommen als Liste von der
// Projektansicht — sie hält den Stand und öffnet den Block-Editor.
export default function Blockbibliothek({ eigene, onNeuerBlock, onBearbeiten, onLoeschen }) {
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
      <div className="bibliothek-gruppe bibliothek-gruppe-zeile">
        <span>{tp.eigeneBloeckeTitel}</span>
        <button className="knopf-primaer knopf-klein" onClick={onNeuerBlock}>
          + {texte.blockEditor.neuerBlock}
        </button>
      </div>
      <p className="feld-hinweis">
        {eigene.length === 0 ? tp.eigeneBloeckeLeer : tp.eigeneBloeckeHinweis}
      </p>
      {eigene.map((block) => (
        <BibliothekBlock
          key={block.id}
          block={block}
          onBearbeiten={onBearbeiten}
          onLoeschen={onLoeschen}
        />
      ))}
      <p className="bibliothek-gruppe">{tp.uebungsbloeckeTitel}</p>
      <p className="feld-hinweis">{tp.bibliothekHinweis}</p>
      {uebungsbloecke.map((block) => (
        <BibliothekBlock key={block.id} block={block} />
      ))}
    </div>
  )
}
