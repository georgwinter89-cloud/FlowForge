import { texte } from '../../shared/texte.js'
import { katalogEtiketten, etikettNameSchluessel } from '../../shared/blockKatalog.js'
import { teilFuerEtikett } from '../../shared/lieferschein.js'
import { etikettKlartext } from '../../shared/etikettRegeln.js'

const t = texte.etiketten

// Welche eigenen Blöcke nutzen dieses Etikett (braucht, brauchtOptional,
// liefert — Schlüsselvergleich)? Die Katalog-Nutzung steht schon am
// Katalog-Eintrag (katalogEtiketten), die eigene rechnet die Bibliothek aus
// der Blockliste der Projektansicht.
function eigeneNutzer(name, eigene) {
  const schluessel = etikettNameSchluessel(name)
  return (eigene ?? [])
    .filter((b) =>
      [...(b.braucht ?? []), ...(b.brauchtOptional ?? []), ...(b.liefert ?? [])].some(
        (e) => etikettNameSchluessel(e) === schluessel
      )
    )
    .map((b) => b.name)
}

function Marke({ klasse, children }) {
  return <span className={'block-chip etikett-marke ' + (klasse ?? '')}>{children}</span>
}

// Ein Eintrag der Etiketten-Liste: Name, Marken, Beschreibung, Klartext-Zeile
// (dieselbe Fassung wie im Editor und in der Werkzeug-Beschreibung),
// „genutzt von …" und die Knöpfe.
function EtikettEintrag({ name, marken, beschreibung, klartext, nutzer, knoepfe }) {
  return (
    <div className="bib-block etikett-eintrag">
      <p className="karte-titel etikett-kopf">
        <span>{name}</span>
        {marken}
      </p>
      {beschreibung && <p className="feld-hinweis">{beschreibung}</p>}
      <p className="etikett-klartext">{klartext}</p>
      <p className="feld-hinweis etikett-nutzung">
        {nutzer.length ? t.genutztVon(nutzer) : t.ungenutzt}
      </p>
      {knoepfe && <div className="karte-knoepfe">{knoepfe}</div>}
    </div>
  )
}

// Etiketten-Bibliothek (SPEC §4.5, BAUPLAN 48): Inhalt der Klappe „Etiketten"
// in der Blockbibliothek. Oben die Katalog-Etiketten (nicht änderbar; die
// lockeren kopierbar, K9), darunter die eigenen (bearbeiten, löschen).
// `etiketten` = eigene Etiketten (Projektansicht), `eigene` = eigene Blöcke
// (für „genutzt von").
export default function EtikettenBibliothek({
  etiketten,
  eigene,
  onBearbeiten,
  onLoeschen,
  onKopieren
}) {
  const katalog = katalogEtiketten().sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const eigeneSortiert = [...(etiketten ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'de')
  )

  return (
    <>
      <p className="feld-hinweis">{t.hinweis}</p>
      {katalog.map((eintrag) => {
        const teil = teilFuerEtikett(eintrag.name)
        const klartext = eintrag.fest
          ? t.klartext.fest(eintrag.name, teil?.werkzeug ?? '')
          : etikettKlartext({ name: eintrag.name, felder: [] })
        return (
          <EtikettEintrag
            key={'katalog-' + eintrag.name}
            name={eintrag.name}
            marken={
              <>
                <Marke klasse="etikett-marke-katalog">{t.markeKatalog}</Marke>
                {eintrag.fest && <Marke klasse="etikett-marke-fest">{t.markeFest}</Marke>}
                {eintrag.uebung && <Marke>{t.markeUebung}</Marke>}
              </>
            }
            beschreibung=""
            klartext={klartext}
            nutzer={[...eintrag.blockNamen, ...eigeneNutzer(eintrag.name, eigene)]}
            knoepfe={
              // Kopieren nur für die LOCKEREN Katalog-Etiketten (K9): Die festen
              // tragen ihre Form im Katalog, eine Kopie hätte sie nicht.
              !eintrag.fest && (
                <button className="knopf-klein" onClick={() => onKopieren(eintrag)}>
                  {t.kopieren}
                </button>
              )
            }
          />
        )
      })}
      {eigeneSortiert.map((etikett) => (
        <EtikettEintrag
          key={etikett.id}
          name={etikett.name}
          marken={
            <>
              {(etikett.felder ?? []).length > 0 && (
                <Marke klasse="etikett-marke-felder">{t.markeMitFeldern}</Marke>
              )}
              {etikett.automatisch && <Marke>{t.markeAutomatisch(etikett.quelle)}</Marke>}
            </>
          }
          beschreibung={etikett.beschreibung}
          klartext={etikettKlartext(etikett)}
          nutzer={eigeneNutzer(etikett.name, eigene)}
          knoepfe={
            <>
              <button className="knopf-klein" onClick={() => onBearbeiten(etikett)}>
                {t.bearbeiten}
              </button>
              <button className="knopf-klein" onClick={() => onLoeschen(etikett)}>
                {t.loeschen}
              </button>
            </>
          }
        />
      ))}
    </>
  )
}
