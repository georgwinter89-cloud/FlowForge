import { Fragment, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  bekannteEtiketten,
  blockKategorie,
  blockModellKlasse,
  BEREICHE,
  BEREICH_EIGENE,
  MODELL_KLASSEN,
  freieBereiche
} from '../../shared/blockKatalog.js'
import {
  BLOCK_NAME_MAX,
  BLOCK_SYMBOL_MAX,
  BLOCK_BESCHREIBUNG_MAX,
  BLOCK_AUFTRAG_MAX,
  BEREICH_MAX,
  BRAUCHT_WOZU_MAX,
  ETIKETTEN_MAX,
  pruefeBereich
} from '../../shared/blockRegeln.js'
import { BlockChips, bereichName } from './Blockbibliothek.jsx'

const t = texte.blockEditor
const tf = texte.kartenFormular
const tkette = texte.kette

function Zaehler({ wert, max }) {
  const uebrig = max - wert.trim().length
  return (
    <span className={'feld-hinweis' + (uebrig < 0 ? ' zaehler-rot' : '')}>
      {uebrig >= 0 ? tf.zeichenUebrig(uebrig) : tf.zeichenZuViel(-uebrig)}
    </span>
  )
}

// braucht/liefert als Chips mit Eingabefeld — Vorschläge sind die Etiketten
// der vorhandenen Blöcke, damit eigene Blöcke zu ihnen zusammenstecken.
function EtikettenFeld({ label, hinweis, etiketten, onAendern, datalistId, vorschlaege }) {
  const [eingabe, setEingabe] = useState('')

  function hinzufuegen() {
    const wert = eingabe.trim()
    if (!wert || etiketten.includes(wert) || etiketten.length >= ETIKETTEN_MAX) return
    onAendern([...etiketten, wert])
    setEingabe('')
  }

  return (
    <div className="feld">
      <span>{label}</span>
      <div className="chip-zeile">
        {etiketten.map((etikett) => (
          <span key={etikett} className="block-chip chip-braucht">
            {etikett}
            <button
              className="chip-entfernen"
              onClick={() => onAendern(etiketten.filter((e) => e !== etikett))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="etikett-eingabe">
        <input
          list={datalistId}
          value={eingabe}
          placeholder={t.etikettPlatzhalter}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              hinzufuegen()
            }
          }}
        />
        <datalist id={datalistId}>
          {vorschlaege
            .filter((v) => !etiketten.includes(v))
            .map((v) => (
              <option key={v} value={v} />
            ))}
        </datalist>
        <button className="knopf-sekundaer knopf-klein" onClick={hinzufuegen}>
          {t.etikettHinzufuegen}
        </button>
      </div>
      <span className="feld-hinweis">{hinweis}</span>
    </div>
  )
}

// Das „wozu" je braucht-Etikett (BAUPLAN 43, „Kein Kennzeichen ohne
// Editor-Feld"): ein einzeiliges Freitext-Feld pro Etikett, direkt unter der
// braucht-Liste. Der Satz landet im Auftrag des Blocks, der das Etikett
// liefert — deshalb steht „Er …" als Anlauf im Label. Ohne Angabe greift im
// Vorspann der ehrliche Rückfall-Satz, kein erfundenes Wozu.
function WozuFelder({ etiketten, wozu, onAendern }) {
  if (!etiketten.length) return null
  return (
    <div className="feld">
      <span>{t.brauchtWozuUeberschrift}</span>
      {etiketten.map((etikett) => (
        <label className="feld" key={etikett}>
          <span>{t.brauchtWozuFeld(etikett)}</span>
          <input
            value={wozu[etikett] ?? ''}
            placeholder={t.brauchtWozuPlatzhalter}
            onChange={(e) => onAendern({ ...wozu, [etikett]: e.target.value })}
          />
          <Zaehler wert={wozu[etikett] ?? ''} max={BRAUCHT_WOZU_MAX} />
        </label>
      ))}
      <span className="feld-hinweis">{t.brauchtWozuHinweis}</span>
    </div>
  )
}

// Gespeicherter Bereich → Text im Kategorie-Feld: Katalog-Schlüssel werden
// als Anzeigename gezeigt, „eigene"/leer bleibt leer, freie Namen wie sie sind.
function bereichAnzeige(bereich) {
  const wert = typeof bereich === 'string' ? bereich.trim() : ''
  if (!wert || wert === BEREICH_EIGENE) return ''
  return BEREICHE.includes(wert) ? bereichName(wert) : wert
}

// Block-Editor mit KI-Assistent (SPEC §4.5, BAUPLAN 14): Erstellungsassistent
// in 4 Schritten entlang der Block-Anatomie — Was tun? → braucht/liefert →
// Sperren → Probelauf-Vorschau. Bearbeiten nutzt denselben Assistenten,
// mit vorbefüllten Feldern. Die harte Prüfung passiert im Hauptprozess.
export default function BlockEditor({ block, onSpeichern, onAbbrechen }) {
  const bearbeiten = Boolean(block)
  const [schritt, setSchritt] = useState(1)
  const [wunsch, setWunsch] = useState('')
  const [kiLaeuft, setKiLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [werte, setWerte] = useState({
    name: block?.name ?? '',
    symbol: block?.symbol ?? '',
    beschreibung: block?.beschreibung ?? '',
    auftrag: block?.auftrag ?? '',
    braucht: block?.braucht ?? [],
    // Empfänger im Auftrag (BAUPLAN 43): Etikett → ein Satz. Altbestand ohne
    // Feld startet leer; beim Speichern fallen Sätze zu entfernten Etiketten
    // von selbst weg (pruefeEigenenBlock).
    brauchtWozu: block?.brauchtWozu ?? {},
    liefert: block?.liefert ?? [],
    // Kategorie (BAUPLAN 30): im Feld steht der Anzeigename bzw. der freie
    // Name; „Eigene" bleibt leer (Platzhalter erklärt das). Beim Speichern
    // macht pruefeBereich aus einem Anzeigenamen wieder den Schlüssel.
    bereich: bereichAnzeige(block?.bereich),
    // Modellklasse (BAUPLAN 37): Voreinstellung des eigenen Blocks —
    // Altbestand ohne Feld läuft auf Standard.
    modell: blockModellKlasse(block),
    nurLesen: block?.nurLesen ?? true
  })
  const vorschlaege = bekannteEtiketten()
  // Vorschläge fürs Kategorie-Feld: feste Klappen (Anzeigename), „Eigene" und
  // die freien Kategorien vorhandener eigener Blöcke.
  const bereichVorschlaege = [
    ...BEREICHE.map(bereichName),
    bereichName(BEREICH_EIGENE),
    ...freieBereiche()
  ]

  function setzen(feld, wert) {
    setWerte((alt) => ({ ...alt, [feld]: wert }))
  }

  async function kiAusfuellen() {
    if (kiLaeuft) return
    setFehler('')
    setKiLaeuft(true)
    const ergebnis = await window.flowforge.blockAssistent(wunsch)
    setKiLaeuft(false)
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    // Der Assistent liefert den Bereich als Schlüssel — im Feld steht der Name.
    // Das „wozu" (BAUPLAN 43) füllt der Assistent nicht: Es steht nie leer da,
    // sondern fehlt ehrlich, bis der Nutzer es tippt.
    setWerte({
      brauchtWozu: {},
      ...ergebnis.vorschlag,
      bereich: bereichAnzeige(ergebnis.vorschlag.bereich)
    })
  }

  async function speichern() {
    const ergebnis = await onSpeichern(bearbeiten ? { ...werte, id: block.id } : werte)
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler)
  }

  // Vorschau (Schritt 4): der Block genau so, wie er in der Bibliothek liegt.
  const vorschauDef = {
    ...werte,
    symbol: werte.symbol.trim() || '🧱',
    prueft: false
  }
  // Kategorie in der Vorschau: so, wie sie nach dem Speichern heißen wird
  // (Anzeigename einer festen Klappe oder der freie Name; leer → „Eigene").
  const bereichGeprueft = pruefeBereich(werte.bereich)
  const vorschauBereich = bereichGeprueft.fehler
    ? werte.bereich.trim()
    : bereichName(bereichGeprueft.bereich)

  const titel = [t.schritt1Titel, t.schritt2Titel, t.schritt3Titel, t.schritt4Titel]

  return (
    <div className="dialog-schleier">
      <div className="dialog dialog-breit dialog-editor">
        <h2>{bearbeiten ? t.ueberschriftBearbeiten : t.ueberschriftNeu}</h2>
        {/* Stepper (Mockup 4b): erledigte Schritte sind anklickbar (Zurück ist
            ohnehin erlaubt), kommende bleiben gesperrt bis „Weiter". */}
        <div className="stepper">
          {titel.map((schrittTitel, i) => {
            const nummer = i + 1
            const klasse =
              nummer < schritt
                ? ' schritt-erledigt'
                : nummer === schritt
                  ? ' schritt-aktiv'
                  : ''
            return (
              <Fragment key={nummer}>
                {i > 0 && <span className="stepper-linie" />}
                <button
                  className={'stepper-schritt' + klasse}
                  disabled={nummer > schritt}
                  onClick={nummer < schritt ? () => setSchritt(nummer) : undefined}
                >
                  <span className="stepper-kreis">{nummer < schritt ? '✓' : nummer}</span>
                  {schrittTitel}
                </button>
              </Fragment>
            )
          })}
        </div>

        <div className="editor-spalten">
          <div className="editor-schritt">
            {schritt === 1 && (
              <>
                <label className="feld">
                  <span>{t.kiFeld}</span>
                  <textarea
                    autoFocus
                    rows={3}
                    value={wunsch}
                    placeholder={t.kiPlatzhalter}
                    onChange={(e) => setWunsch(e.target.value)}
                  />
                  <span className="feld-hinweis">{t.kiHinweis}</span>
                </label>
                <div className="dialog-knoepfe knoepfe-links">
                  <button className="knopf-sekundaer" disabled={kiLaeuft} onClick={kiAusfuellen}>
                    {kiLaeuft ? t.kiLaeuft : '✨ ' + t.kiKnopf}
                  </button>
                </div>
                <div className="feld-nebeneinander">
                  <label className="feld">
                    <span>{t.nameFeld}</span>
                    <input value={werte.name} onChange={(e) => setzen('name', e.target.value)} />
                    <Zaehler wert={werte.name} max={BLOCK_NAME_MAX} />
                  </label>
                  <label className="feld feld-schmal">
                    <span>{t.symbolFeld}</span>
                    <input
                      value={werte.symbol}
                      maxLength={BLOCK_SYMBOL_MAX}
                      onChange={(e) => setzen('symbol', e.target.value)}
                    />
                  </label>
                </div>
                <label className="feld">
                  <span>{t.beschreibungFeld}</span>
                  <input
                    value={werte.beschreibung}
                    onChange={(e) => setzen('beschreibung', e.target.value)}
                  />
                  <Zaehler wert={werte.beschreibung} max={BLOCK_BESCHREIBUNG_MAX} />
                </label>
                {/* Kategorie / Bibliotheks-Klappe (BAUPLAN 30): vorhandene
                    wählen oder eine neue eintippen; leer = „Eigene". */}
                <label className="feld">
                  <span>{t.bereichFeld}</span>
                  <input
                    list="bereich-vorschlaege"
                    value={werte.bereich}
                    placeholder={t.bereichPlatzhalter}
                    onChange={(e) => setzen('bereich', e.target.value)}
                  />
                  <datalist id="bereich-vorschlaege">
                    {bereichVorschlaege.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                  <span className="feld-hinweis">{t.bereichHinweis}</span>
                  <Zaehler wert={werte.bereich} max={BEREICH_MAX} />
                </label>
                <label className="feld">
                  <span>{t.auftragFeld}</span>
                  <textarea
                    rows={8}
                    value={werte.auftrag}
                    onChange={(e) => setzen('auftrag', e.target.value)}
                  />
                  <span className="feld-hinweis">{t.auftragHinweis}</span>
                  <Zaehler wert={werte.auftrag} max={BLOCK_AUFTRAG_MAX} />
                </label>
              </>
            )}

            {schritt === 2 && (
              <>
                <EtikettenFeld
                  label={t.brauchtFeld}
                  hinweis={t.brauchtHinweis}
                  etiketten={werte.braucht}
                  onAendern={(neu) => setzen('braucht', neu)}
                  datalistId="etiketten-braucht"
                  vorschlaege={vorschlaege}
                />
                <WozuFelder
                  etiketten={werte.braucht}
                  wozu={werte.brauchtWozu}
                  onAendern={(neu) => setzen('brauchtWozu', neu)}
                />
                <EtikettenFeld
                  label={t.liefertFeld}
                  hinweis={t.liefertHinweis}
                  etiketten={werte.liefert}
                  onAendern={(neu) => setzen('liefert', neu)}
                  datalistId="etiketten-liefert"
                  vorschlaege={vorschlaege}
                />
              </>
            )}

            {schritt === 3 && (
              <>
                <label className="feld feld-schalter">
                  <input
                    type="checkbox"
                    checked={werte.nurLesen}
                    onChange={(e) => setzen('nurLesen', e.target.checked)}
                  />
                  <span>
                    {t.nurLesenFeld}
                    <span className="feld-hinweis">{t.nurLesenHinweis}</span>
                  </span>
                </label>
                {/* Modellklasse (BAUPLAN 37): „Kein Kennzeichen ohne
                    Editor-Feld" — was ein Katalog-Block kann, kann ein
                    eigener auch. */}
                <label className="feld">
                  <span>{t.modellFeld}</span>
                  <select
                    value={werte.modell}
                    onChange={(e) => setzen('modell', e.target.value)}
                  >
                    {MODELL_KLASSEN.map((klasse) => (
                      <option key={klasse} value={klasse}>
                        {tkette.modellNamen[klasse]}
                      </option>
                    ))}
                  </select>
                  <span className="feld-hinweis">{t.modellHinweis}</span>
                </label>
              </>
            )}

            {schritt === 4 && (
              <>
                <p className="feld-hinweis">{t.vorschauHinweis}</p>
                <p className="vorschau-label">{t.vorschauAuftrag}</p>
                <pre className="vorschau-auftrag">{werte.auftrag || '—'}</pre>
              </>
            )}
          </div>
          {/* Ständige Vorschau (Mockup 4b): der Block liegt auf allen
              Schritten live rechts „in der Bibliothek". */}
          <div className="editor-vorschau">
            <span className="vorschau-label">{t.vorschauTitel}</span>
            <div className="vorschau-panel">
              <div
                className={'bib-block vorschau-block kategorie-' + blockKategorie(vorschauDef)}
              >
                <p className="karte-titel">
                  {vorschauDef.symbol} {werte.name || '—'}
                </p>
                {werte.beschreibung && <p className="feld-hinweis">{werte.beschreibung}</p>}
                <BlockChips def={vorschauDef} />
                <p className="feld-hinweis vorschau-bereich">{t.bereichVorschau(vorschauBereich)}</p>
              </div>
            </div>
          </div>
        </div>

        {fehler && <p className="fehlermeldung">{fehler}</p>}
        <div className="dialog-knoepfe">
          <button className="knopf-sekundaer" onClick={onAbbrechen}>
            {t.abbrechen}
          </button>
          {schritt > 1 && (
            <button className="knopf-sekundaer" onClick={() => setSchritt(schritt - 1)}>
              ← {t.zurueck}
            </button>
          )}
          {schritt < 4 && (
            <button className="knopf-primaer" onClick={() => setSchritt(schritt + 1)}>
              {t.weiter} →
            </button>
          )}
          {schritt === 4 && (
            <button className="knopf-primaer" onClick={speichern}>
              {t.speichern}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
