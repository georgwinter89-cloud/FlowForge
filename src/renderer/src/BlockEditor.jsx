import { Fragment, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  bekannteEtiketten,
  blockKategorie,
  blockModellKlasse,
  blockDenktiefe,
  klasseHatKostenHinweis,
  klasseIstLokal,
  BEREICHE,
  BEREICH_EIGENE,
  MODELL_KLASSEN,
  MODELL_KLASSE_STANDARD,
  DENKTIEFEN,
  DENKTIEFE_STANDARD,
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
  FORMULARFELDER_MAX,
  FELD_LABEL_MAX,
  FELD_PLATZHALTER_MAX,
  KENNZEICHEN,
  KENNZEICHEN_ROLLE,
  KENNZEICHEN_FEINHEITEN,
  PRUEFBELEG_ETIKETT,
  feldIdBereinigen,
  fremdePlatzhalter,
  kennzeichenAngleichen,
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
// `ausgeschlossen` (BAUPLAN 48): Etiketten der Schwester-Liste (braucht ↔
// braucht — falls da) — ein Etikett ist Pflicht ODER optional, nie beides.
function EtikettenFeld({
  label,
  hinweis,
  etiketten,
  onAendern,
  datalistId,
  vorschlaege,
  ausgeschlossen = [],
  optional = false
}) {
  const [eingabe, setEingabe] = useState('')

  function hinzufuegen() {
    const wert = eingabe.trim()
    if (!wert || etiketten.includes(wert) || etiketten.length >= ETIKETTEN_MAX) return
    if (ausgeschlossen.includes(wert)) return
    onAendern([...etiketten, wert])
    setEingabe('')
  }

  return (
    <div className="feld">
      <span>{label}</span>
      <div className="chip-zeile">
        {etiketten.map((etikett) => (
          <span
            key={etikett}
            className={'block-chip chip-braucht' + (optional ? ' chip-optional' : '')}
          >
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
            .filter((v) => !etiketten.includes(v) && !ausgeschlossen.includes(v))
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
// Vorspann der ehrliche Rückfall-Satz, kein erfundenes Wozu. Seit BAUPLAN 48
// auch für die optionalen Etiketten („falls da").
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

// Formularfelder an der Blockkarte (BAUPLAN 48, „Kein Kennzeichen ohne
// Editor-Feld"): höchstens drei, je Bezeichnung · Platzhalter-Text · Pflicht.
// Die Kennung (id) entsteht live aus der Bezeichnung — aber nur bei NEUEN
// Feldern (Korrektur K5): Ein gespeichertes Feld behält seine id, auch wenn
// die Bezeichnung sich ändert, sonst verwürfe das Schaubild die schon
// eingetippten Werte stumm. Jedes Feld muss als {{id}} im Auftrag stehen —
// der Knopf hängt die Zeile an, wenn sie fehlt; die harte Regel sitzt im
// Hauptprozess. Fremde {{x}} ohne Feld sind nur ein Hinweis (K6).
function FelderEditor({ felder, auftrag, onAendern, onEinfuegen }) {
  function aendern(index, teil) {
    onAendern(
      felder.map((feld, i) => {
        if (i !== index) return feld
        const neu = { ...feld, ...teil }
        if (!neu.eingefroren && 'label' in teil) neu.id = feldIdBereinigen(teil.label)
        return neu
      })
    )
  }
  const fremde = fremdePlatzhalter(auftrag, felder)
  return (
    <div className="feld editor-formularfelder">
      <span>{t.felderUeberschrift}</span>
      <span className="feld-hinweis">{t.felderHinweis}</span>
      {felder.map((feld, i) => {
        const imAuftrag = Boolean(feld.id) && auftrag.includes('{{' + feld.id + '}}')
        return (
          <div key={i} className="editor-formularfeld">
            <div className="feld-nebeneinander">
              <label className="feld">
                <span>{t.feldLabel}</span>
                <input
                  value={feld.label}
                  onChange={(e) => aendern(i, { label: e.target.value })}
                />
                <Zaehler wert={feld.label} max={FELD_LABEL_MAX} />
              </label>
              <button
                className="knopf-klein editor-formularfeld-entfernen"
                title={t.feldEntfernen}
                onClick={() => onAendern(felder.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
            <label className="feld">
              <span>{t.feldPlatzhalter}</span>
              <input
                value={feld.platzhalter}
                onChange={(e) => aendern(i, { platzhalter: e.target.value })}
              />
              <Zaehler wert={feld.platzhalter} max={FELD_PLATZHALTER_MAX} />
            </label>
            <label className="feld feld-schalter">
              <input
                type="checkbox"
                checked={feld.pflicht}
                onChange={(e) => aendern(i, { pflicht: e.target.checked })}
              />
              <span>{t.feldPflicht}</span>
            </label>
            <div className="editor-formularfeld-id">
              {feld.id ? (
                <>
                  <code>{t.feldIdHinweis(feld.id)}</code>
                  {imAuftrag ? (
                    <span className="feld-hinweis">{t.feldIdImAuftrag}</span>
                  ) : (
                    <>
                      <button
                        className="knopf-sekundaer knopf-klein"
                        onClick={() => onEinfuegen(feld)}
                      >
                        {t.feldIdEinfuegen(feld.id)}
                      </button>
                      <span className="feld-hinweis zaehler-rot">
                        {t.feldOhnePlatzhalterHinweis(feld.label)}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="feld-hinweis">{t.feldIdLeer}</span>
              )}
            </div>
          </div>
        )
      })}
      {felder.length < FORMULARFELDER_MAX && (
        <div className="dialog-knoepfe knoepfe-links">
          <button
            className="knopf-sekundaer knopf-klein"
            onClick={() =>
              onAendern([
                ...felder,
                { id: '', label: '', platzhalter: '', pflicht: false, eingefroren: false }
              ])
            }
          >
            {t.feldHinzufuegen}
          </button>
        </div>
      )}
      {fremde.length > 0 && <span className="feld-hinweis">{t.fremderPlatzhalter(fremde)}</span>}
    </div>
  )
}

// Ein Kennzeichen-Häkchen (BAUPLAN 48): Name + Folgen-Hinweis aus
// texte.blockEditor.kennzeichen (dieselbe Quelle wie der KI-Assistent),
// darunter die „KI: …"-Begründung, falls der Assistent es vorgeschlagen hat,
// und die Folgen-Sätze der Komfort-Reaktion beim Anhaken.
function KennzeichenHaekchen({ schluessel, wert, onAendern, hinweise, kiSatz }) {
  const k = t.kennzeichen[schluessel]
  return (
    <label className="feld feld-schalter">
      <input
        type="checkbox"
        checked={wert}
        onChange={(e) => onAendern(schluessel, e.target.checked)}
      />
      <span>
        {k.name}
        <span className="feld-hinweis">{k.hinweis}</span>
        {kiSatz && (
          <span className="feld-hinweis editor-feinheiten-ki">{t.kiBegruendung(kiSatz)}</span>
        )}
        {hinweise.map((satz) => (
          <span key={satz} className="feld-hinweis editor-feinheiten-folge">
            {satz}
          </span>
        ))}
      </span>
    </label>
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
// Rolle, Feinheiten & Modell → Probelauf-Vorschau. Bearbeiten nutzt denselben
// Assistenten, mit vorbefüllten Feldern. Die harte Prüfung passiert im
// Hauptprozess.
export default function BlockEditor({ block, onSpeichern, onAbbrechen }) {
  const bearbeiten = Boolean(block)
  const [schritt, setSchritt] = useState(1)
  const [wunsch, setWunsch] = useState('')
  const [kiLaeuft, setKiLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  // Kennzeichen (BAUPLAN 48): alle als Boolean im State, flach wie im
  // gespeicherten Block. Altbestand ohne Feld startet ohne Häkchen; ein neuer
  // Block startet sicher mit „darf nur lesen".
  const kennzeichenStart = {}
  for (const { schluessel } of KENNZEICHEN) kennzeichenStart[schluessel] = Boolean(block?.[schluessel])
  kennzeichenStart.nurLesen = block?.nurLesen ?? true
  const [werte, setWerte] = useState({
    name: block?.name ?? '',
    symbol: block?.symbol ?? '',
    beschreibung: block?.beschreibung ?? '',
    auftrag: block?.auftrag ?? '',
    braucht: block?.braucht ?? [],
    // brauchtOptional (BAUPLAN 48): Übergaben „falls da".
    brauchtOptional: block?.brauchtOptional ?? [],
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
    // Denktiefe (0.48.1): Voreinstellung des eigenen Blocks — Altbestand ohne
    // Feld läuft auf „Modell-Standard"; an der Karte bleibt sie änderbar.
    denktiefe: blockDenktiefe(block),
    ...kennzeichenStart,
    // Formularfelder (BAUPLAN 48): gespeicherte Felder sind „eingefroren" —
    // ihre id bleibt, auch wenn die Bezeichnung sich ändert (Korrektur K5).
    felder: (block?.felder ?? []).map((feld) => ({ ...feld, eingefroren: true }))
  })
  // Begründungen des KI-Assistenten je Kennzeichen (BAUPLAN 48) und die
  // Folgen-Sätze der Komfort-Reaktionen beim Anhaken — beides nur Anzeige.
  const [kiBegruendungen, setKiBegruendungen] = useState({})
  const [hinweise, setHinweise] = useState({})
  // Feinheiten zugeklappt, außer eines ist schon gesetzt (Bearbeiten) oder
  // die KI hat eines vorgeschlagen.
  const [feinheitenOffen, setFeinheitenOffen] = useState(
    KENNZEICHEN_FEINHEITEN.some((s) => kennzeichenStart[s])
  )
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

  // Kennzeichen setzen (BAUPLAN 48) — Komfort, die Regel bleibt im
  // Hauptprozess: Beim Anhaken zieht kennzeichenAngleichen die Folgen nach
  // (prueft ⇒ nurLesen aus + „Prüfbeleg" in liefert; kartenZuteilung ⇒
  // „Arbeitspaket"; pruefbefehlPflicht ⇒ prueft; startanleitungPflicht ⇒
  // nurLesen aus) und sagt es unter dem Häkchen. Beim Abwählen wird nichts
  // automatisch entfernt.
  //
  // „darf nur lesen" WIEDER anhaken, während „prüft" oder „Startanleitung ist
  // Pflicht" gesetzt ist (Prüfer-Befund 48): Die Angleichung würde das Häkchen
  // sofort und stumm wieder ausschalten — ein Klick ohne Wirkung und ohne
  // Erklärung. Stattdessen bleibt der Klick stehen und der Satz darunter sagt,
  // womit er sich beißt; beim Speichern lehnt die harte Regel mit Begründung ab
  // (Rückfrage statt Sperre — Georg entscheidet, welches Häkchen geht).
  function nurLesenKonflikt(w) {
    if (!w.nurLesen) return []
    const konflikte = ['prueft', 'startanleitungPflicht']
      .filter((k) => w[k])
      .map((k) => t.kennzeichen[k].name)
    return konflikte.length ? [t.kennzeichenKonflikt(konflikte)] : []
  }

  function kennzeichenSetzen(schluessel, wert) {
    const vorher = { ...werte, [schluessel]: wert }
    if (!wert || schluessel === 'nurLesen') {
      setWerte(vorher)
      // Beim Abwählen verschwindet der eigene Satz; der Konflikt-Satz unter
      // „nur lesen" wird neu gerechnet (weg, sobald das Gegenstück fehlt).
      setHinweise((alt) => ({
        ...alt,
        [schluessel]: [],
        nurLesen: nurLesenKonflikt(vorher)
      }))
      return
    }
    // Die Folgen-Sätze nur für das Häkchen, das sie wirklich auslöst (Prüfer-
    // Befund 48): Die Angleichung rechnet immer alles durch — steht z.B. noch
    // „Prüfbefehl ist Pflicht", zieht sie „prüft" auch dann nach, wenn gerade
    // ein anderes Häkchen geklickt wurde; der Satz darunter nannte dann das
    // falsche Häkchen.
    const neu = kennzeichenAngleichen(vorher)
    const name = t.kennzeichen[schluessel].name
    const saetze = []
    if (neu.prueft && !werte.prueft && schluessel === 'pruefbefehlPflicht')
      saetze.push(t.kennzeichenPrueftAn(name))
    if (
      !neu.nurLesen &&
      werte.nurLesen &&
      ['prueft', 'pruefbefehlPflicht', 'startanleitungPflicht'].includes(schluessel)
    )
      saetze.push(t.kennzeichenNurLesenAus(name))
    if (['prueft', 'pruefbefehlPflicht', 'kartenZuteilung'].includes(schluessel))
      for (const etikett of neu.liefert)
        if (!werte.liefert.includes(etikett)) saetze.push(t.kennzeichenErgaenzt(name, etikett))
    setWerte(neu)
    setHinweise((alt) => ({ ...alt, [schluessel]: saetze, nurLesen: nurLesenKonflikt(neu) }))
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
    // Kennzeichen (BAUPLAN 48) mit Rückfall false: Ein Vorschlag ohne ein Feld
    // darf kein Häkchen auf undefined setzen — die Checkbox kippte sonst von
    // „gesteuert" auf „ungesteuert". Die Begründungen wandern neben die
    // Häkchen; die KI-Felder sind neu (id läuft live mit der Bezeichnung).
    // Modell und Denktiefe (0.48.1, K2) ebenso mit Rückfall: Der Vorschlag
    // trägt keine Denktiefe — ohne Rückfall kippte auch dieses Select auf
    // „ungesteuert" und speicherte undefined.
    const { begruendungen, ...vorschlag } = ergebnis.vorschlag
    setWerte({
      brauchtWozu: {},
      brauchtOptional: [],
      modell: MODELL_KLASSE_STANDARD,
      denktiefe: DENKTIEFE_STANDARD,
      ...Object.fromEntries(KENNZEICHEN.map(({ schluessel }) => [schluessel, false])),
      ...vorschlag,
      felder: (vorschlag.felder ?? []).map((feld) => ({ ...feld, eingefroren: false })),
      bereich: bereichAnzeige(vorschlag.bereich)
    })
    setKiBegruendungen(begruendungen ?? {})
    setHinweise({})
    setFeinheitenOffen(KENNZEICHEN_FEINHEITEN.some((s) => vorschlag[s]))
  }

  async function speichern() {
    // Das Editor-Merkmal „eingefroren" bleibt hier; der Hauptprozess bekommt
    // die Felder so, wie sie gespeichert werden.
    const daten = {
      ...werte,
      felder: werte.felder.map(({ id, label, platzhalter, pflicht }) => ({
        id,
        label,
        platzhalter,
        pflicht
      }))
    }
    const ergebnis = await onSpeichern(bearbeiten ? { ...daten, id: block.id } : daten)
    if (ergebnis && !ergebnis.ok) setFehler(ergebnis.fehler)
  }

  // Platzhalter eines Feldes an den Auftrag anhängen (BAUPLAN 48) — als Zeile
  // „Bezeichnung: {{id}}", dieselbe Form wie beim KI-Vorschlag (K20).
  function platzhalterEinfuegen(feld) {
    const zeile = `${feld.label.trim() || feld.id}: {{${feld.id}}}`
    const auftrag = werte.auftrag.trimEnd()
    setzen('auftrag', auftrag ? auftrag + '\n' + zeile : zeile)
  }

  // Vorschau: der Block genau so, wie er in der Bibliothek liegt — seit
  // BAUPLAN 48 mit Prüfer-Chip und optionalen Etiketten, nicht mehr
  // prueft: false erzwungen.
  const vorschauDef = {
    ...werte,
    symbol: werte.symbol.trim() || '🧱'
  }
  // Kategorie in der Vorschau: so, wie sie nach dem Speichern heißen wird
  // (Anzeigename einer festen Klappe oder der freie Name; leer → „Eigene").
  const bereichGeprueft = pruefeBereich(werte.bereich)
  const vorschauBereich = bereichGeprueft.fehler
    ? werte.bereich.trim()
    : bereichName(bereichGeprueft.bereich)
  // Fremde {{x}} im Auftrag (Korrektur K6): Hinweis, kein Fehler.
  const fremde = fremdePlatzhalter(werte.auftrag, werte.felder)
  // Wie viele Feinheiten hat die KI gesetzt? Satz am Kopf von Schritt 3.
  const kiFeinheiten = KENNZEICHEN_FEINHEITEN.filter((s) => werte[s] && kiBegruendungen[s]).length

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
                  {fremde.length > 0 && (
                    <span className="feld-hinweis">{t.fremderPlatzhalter(fremde)}</span>
                  )}
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
                  ausgeschlossen={werte.brauchtOptional}
                />
                {/* braucht — falls da (BAUPLAN 48): optionale Übergaben, wie
                    sie Katalog-Blöcke seit Bauschritt 9 kennen. */}
                <EtikettenFeld
                  label={t.brauchtOptionalFeld}
                  hinweis={t.brauchtOptionalHinweis}
                  etiketten={werte.brauchtOptional}
                  onAendern={(neu) => setzen('brauchtOptional', neu)}
                  datalistId="etiketten-braucht-optional"
                  vorschlaege={vorschlaege}
                  ausgeschlossen={werte.braucht}
                  optional
                />
                <WozuFelder
                  etiketten={[...werte.braucht, ...werte.brauchtOptional]}
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
                {/* Prüfbeleg ohne „Prüft" (Korrektur K21): Das Urteil käme an,
                    würde aber nicht ausgewertet. */}
                {werte.liefert.includes(PRUEFBELEG_ETIKETT) && !werte.prueft && (
                  <p className="feld-hinweis editor-feinheiten-folge">
                    {t.pruefbelegOhnePrueft(PRUEFBELEG_ETIKETT)}
                  </p>
                )}
                <FelderEditor
                  felder={werte.felder}
                  auftrag={werte.auftrag}
                  onAendern={(neu) => setzen('felder', neu)}
                  onEinfuegen={platzhalterEinfuegen}
                />
              </>
            )}

            {schritt === 3 && (
              <>
                {kiFeinheiten > 0 && (
                  <p className="feld-hinweis editor-feinheiten-ki">{t.kiFeinheiten(kiFeinheiten)}</p>
                )}
                {/* Rolle (BAUPLAN 48): nur lesen · prüft · führt zusammen —
                    „Kein Kennzeichen ohne Editor-Feld". Die Verträglichkeit
                    prüft pruefeEigenenBlock beim Speichern. */}
                {KENNZEICHEN_ROLLE.map((schluessel) => (
                  <KennzeichenHaekchen
                    key={schluessel}
                    schluessel={schluessel}
                    wert={werte[schluessel]}
                    onAendern={kennzeichenSetzen}
                    hinweise={hinweise[schluessel] ?? []}
                    kiSatz={werte[schluessel] ? kiBegruendungen[schluessel] : ''}
                  />
                ))}
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
                  {/* Kosten-Wahrheit der Klasse Extra (0.48.1): derselbe Satz
                      wie an der Blockkarte, sichtbar sobald Extra gewählt ist. */}
                  {klasseHatKostenHinweis(werte.modell) && (
                    <span className="feld-hinweis">{t.modellExtraHinweis}</span>
                  )}
                  {/* Klasse lokal (BAUPLAN 49): derselbe Satz wie an der
                      Blockkarte — läuft auf der lokalen KI, ohne sie startet
                      der Lauf nicht, Denktiefe gilt dort nicht. */}
                  {klasseIstLokal(werte.modell) && (
                    <span className="feld-hinweis">{tkette.modellLokalHinweis}</span>
                  )}
                </label>
                {/* Denktiefe (0.48.1): Voreinstellung des eigenen Blocks — wie
                    gründlich das Modell nachdenkt; an der Karte je Block
                    änderbar. Der Hinweis nennt, dass Haiku sie ignoriert. */}
                <label className="feld">
                  <span>{t.denktiefeFeld}</span>
                  <select
                    value={werte.denktiefe}
                    onChange={(e) => setzen('denktiefe', e.target.value)}
                  >
                    {DENKTIEFEN.map((stufe) => (
                      <option key={stufe} value={stufe}>
                        {tkette.denktiefeNamen[stufe]}
                      </option>
                    ))}
                  </select>
                  <span className="feld-hinweis">{t.denktiefeHinweis}</span>
                  {klasseIstLokal(werte.modell) && (
                    <span className="feld-hinweis">{tkette.denktiefeLokalHinweis}</span>
                  )}
                </label>
                {/* Feinheiten (BAUPLAN 48): die übrigen Kennzeichen des
                    Katalogs, zugeklappt — offen, wenn eines gesetzt ist oder
                    die KI eines vorgeschlagen hat. */}
                <details
                  className="editor-feinheiten"
                  open={feinheitenOffen}
                  onToggle={(e) => setFeinheitenOffen(e.currentTarget.open)}
                >
                  <summary>{t.feinheitenTitel}</summary>
                  <p className="feld-hinweis">{t.feinheitenHinweis}</p>
                  {KENNZEICHEN_FEINHEITEN.map((schluessel) => (
                    <KennzeichenHaekchen
                      key={schluessel}
                      schluessel={schluessel}
                      wert={werte[schluessel]}
                      onAendern={kennzeichenSetzen}
                      hinweise={hinweise[schluessel] ?? []}
                      kiSatz={werte[schluessel] ? kiBegruendungen[schluessel] : ''}
                    />
                  ))}
                </details>
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
