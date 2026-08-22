import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  LOKAL_FEIN_FELDER,
  LOKAL_FEIN_VORLAGEN,
  LOKAL_GEDULD_STANDARD,
  LOKAL_GEDULD_WAHL,
  LOKAL_KONTEXT_STANDARD,
  LOKAL_KONTEXT_WAHL,
  adresseBereinigen,
  lokalFeinBereinigen,
  lokalFeinVorlageErkennen,
  lokalesModellName,
  searxngAdresseBereinigen
} from '../../shared/lokalRegeln.js'
import {
  PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL,
  PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD,
  PRUEFKARTEN_DECKEL_LAUF_WAHL,
  PRUEFKARTEN_DECKEL_LAUF_STANDARD
} from '../../shared/pruefkartenRegeln.js'

const t = texte.einstellungen

// Feineinstellungen der lokalen KI (BAUPLAN 49): Eingabegrenzen je Feld für
// die Zahlenfelder — dieselben Grenzen wie lokalFeinBereinigen im Hauptprozess
// (src/shared/lokalRegeln.js); leer = Ollama-Standard.
const LOKAL_FEIN_GRENZEN = {
  temperatur: { min: 0, max: 2, step: 0.05 },
  topP: { min: 0, max: 1, step: 0.01 },
  topK: { min: 0, max: 500, step: 1 },
  minP: { min: 0, max: 1, step: 0.01 },
  wiederholungsstrafe: { min: 0.5, max: 2, step: 0.05 },
  antwortlaenge: { min: 1, step: 1 },
  entwurfsTokens: { min: 0, max: 64, step: 1 }
}
const VORLAGEN_REIHENFOLGE = ['qwen-denken', 'qwen-coding', 'ollama-standard']

// Entprellung der Live-Status-Abfragen (0.51.2). Gemessen 20.08.2026 in der
// gebauten App: 19 getippte Zeichen ergaben 19 echte HTTP-Anfragen an den
// fremden Rechner (//api/tags, /g/api/tags, /ga/api/tags, …), und gegen einen
// hängenden Server standen 7 Anfragen gleichzeitig offen. Halbfertige
// Rechnernamen kosten dabei allein 2,7 s Namensauflösung. Bei einer Suchquelle
// wäre das doppelt schlimm — sie reagiert auf Häufung mit Drosselung.
const STATUS_ENTPRELLUNG_MS = 600

// Zahlen ↔ Text der Eingabefelder: null wird zum leeren Feld und zurück.
function feinAlsText(fein) {
  return Object.fromEntries(
    LOKAL_FEIN_FELDER.map((feld) => [feld, fein?.[feld] == null ? '' : String(fein[feld])])
  )
}
function feinAusText(felder) {
  return Object.fromEntries(
    LOKAL_FEIN_FELDER.map((feld) => {
      const roh = String(felder[feld] ?? '')
        .trim()
        .replace(',', '.')
      return [feld, roh === '' ? null : Number(roh)]
    })
  )
}

// Globale Einstellungen: Motor-Modus (Abo/API), API-Schlüssel, Ausgaben-Obergrenze.
export default function Einstellungen({ onSchliessen }) {
  // '' = noch nicht gewählt (Erststart-Wahl, 0.46.4) — dann ist kein Radio an.
  const [modus, setModus] = useState('')
  const [apiSchluessel, setApiSchluessel] = useState('')
  const [obergrenze, setObergrenze] = useState(5)
  const [rechteAutomatisch, setRechteAutomatisch] = useState(false)
  const [nurLesenBefehle, setNurLesenBefehle] = useState(false)
  const [unteraufgabenModell, setUnteraufgabenModell] = useState('sparsam')
  const [uebertragTest, setUebertragTest] = useState(false)
  // Prüfkarten laufen von selbst (BAUPLAN 52): zwei Zeitgrenzen fürs
  // Abspielen alter Prüfungen — beide aus derselben Stufenliste, die auch der
  // Hauptprozess beim Speichern anwendet.
  const [deckelMesspunktMs, setDeckelMesspunktMs] = useState(
    PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD
  )
  const [deckelLaufMs, setDeckelLaufMs] = useState(PRUEFKARTEN_DECKEL_LAUF_STANDARD)
  const [lokaleHelferAktiv, setLokaleHelferAktiv] = useState(false)
  const [lokaleHelferQuote, setLokaleHelferQuote] = useState(true)
  const [lokaleHelferModell, setLokaleHelferModell] = useState('')
  // Adress-Liste (BAUPLAN 51): mehrere Ollama-Rechner/GPUs, Zeile je Adresse.
  // Die erste Adresse ist der Anker für Helfer-KI und Vorreparatur.
  const [lokaleHelferAdressen, setLokaleHelferAdressen] = useState([''])
  const [lokaleHelferKontext, setLokaleHelferKontext] = useState(LOKAL_KONTEXT_STANDARD)
  // Geduld der Werkzeug-Schicht (0.51.3): 0 = Vorgabe der Motor-Software.
  const [lokaleAntwortGeduldMs, setLokaleAntwortGeduldMs] = useState(LOKAL_GEDULD_STANDARD)
  // Lokale KI als Block-Agent (BAUPLAN 49): Häkchen + Feineinstellungen (als
  // Text je Feld, damit sich halb getippte Zahlen nicht sofort wegrunden).
  const [lokalBlockAgent, setLokalBlockAgent] = useState(false)
  const [lokalFeinText, setLokalFeinText] = useState(() =>
    feinAlsText(LOKAL_FEIN_VORLAGEN['ollama-standard'])
  )
  // Live-Status je Adresse (Schlüssel: getrimmte Adresse) über das bestehende
  // IPC lokaleHelferStatus — der Renderer fragt je Zeile einzeln, parallel.
  const [helferStatusJeAdresse, setHelferStatusJeAdresse] = useState({})
  // Websuche der lokalen Blöcke (0.51.2): leer = eingebaute Quelle. Eigener
  // Zustand statt eines gemeinsamen Objekts mit den Ollama-Adressen — die zwei
  // Prüfungen sagen Verschiedenes und dürfen sich nicht gegenseitig leeren.
  const [searxngAdresse, setSearxngAdresse] = useState('')
  const [searxngZustand, setSearxngZustand] = useState(null)
  const [aboErlaubt, setAboErlaubt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    window.flowforge.einstellungenLaden().then((e) => {
      if (!e.ok) return
      setModus(e.einstellungen.motorModus ?? '')
      setApiSchluessel(e.einstellungen.apiSchluessel)
      setObergrenze(e.einstellungen.ausgabenObergrenzeUsd)
      setRechteAutomatisch(Boolean(e.einstellungen.rechteAutomatisch))
      setNurLesenBefehle(Boolean(e.einstellungen.nurLesenBefehle))
      setUnteraufgabenModell(
        e.einstellungen.unteraufgabenModell === 'wieBlock' ? 'wieBlock' : 'sparsam'
      )
      setUebertragTest(Boolean(e.einstellungen.uebertragTest))
      setDeckelMesspunktMs(
        PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL.includes(
          Number(e.einstellungen.pruefkartenDeckelMesspunktMs)
        )
          ? Number(e.einstellungen.pruefkartenDeckelMesspunktMs)
          : PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD
      )
      setDeckelLaufMs(
        PRUEFKARTEN_DECKEL_LAUF_WAHL.includes(Number(e.einstellungen.pruefkartenDeckelLaufMs))
          ? Number(e.einstellungen.pruefkartenDeckelLaufMs)
          : PRUEFKARTEN_DECKEL_LAUF_STANDARD
      )
      setLokaleHelferAktiv(Boolean(e.einstellungen.lokaleHelferAktiv))
      setLokaleHelferQuote(e.einstellungen.lokaleHelferQuote !== false)
      setLokaleHelferModell(e.einstellungen.lokaleHelferModell ?? '')
      // einstellungenLaden garantiert die Liste seit BAUPLAN 51 — der
      // Rückfall aufs Einzelfeld ist nur ein Gurt für kaputte Antworten.
      setLokaleHelferAdressen(
        Array.isArray(e.einstellungen.lokaleHelferAdressen) &&
          e.einstellungen.lokaleHelferAdressen.length > 0
          ? e.einstellungen.lokaleHelferAdressen
          : [e.einstellungen.lokaleHelferAdresse ?? '']
      )
      setLokaleHelferKontext(Number(e.einstellungen.lokaleHelferKontext) || LOKAL_KONTEXT_STANDARD)
      setLokaleAntwortGeduldMs(
        LOKAL_GEDULD_WAHL.includes(Number(e.einstellungen.lokaleAntwortGeduldMs))
          ? Number(e.einstellungen.lokaleAntwortGeduldMs)
          : LOKAL_GEDULD_STANDARD
      )
      setLokalBlockAgent(Boolean(e.einstellungen.lokalBlockAgent))
      setLokalFeinText(feinAlsText(lokalFeinBereinigen(e.einstellungen.lokalFein)))
      setSearxngAdresse(e.einstellungen.searxngAdresse ?? '')
      setAboErlaubt(e.aboErlaubt)
      setGeladen(true)
    })
  }, [])

  // Status der lokalen KI live anzeigen, sobald der Schalter an ist —
  // Georg sieht je Adress-Zeile sofort, ob Ollama läuft und das Modell da ist.
  // Entprellt (0.51.2): Der Effekt hängt an Modellfeld UND Adressliste, feuerte
  // also je Tastendruck in JEDEM dieser Felder für JEDE Zeile eine echte
  // Anfrage. Geprüft wird nur, was als Adresse durchgeht (bereinigt) — und
  // genau die bereinigte Fassung ist auch der Schlüssel der Statuszeile, damit
  // Oberfläche und Hauptprozess dieselbe Adresse meinen.
  useEffect(() => {
    if (!lokaleHelferAktiv || !lokaleHelferModell.trim()) return setHelferStatusJeAdresse({})
    let aktuell = true
    const modell = lokaleHelferModell.trim()
    const uhr = setTimeout(() => {
      for (const roh of lokaleHelferAdressen) {
        const adresse = adresseBereinigen(roh)
        if (!adresse) continue
        window.flowforge.lokaleHelferStatus(modell, adresse).then((s) => {
          if (aktuell) setHelferStatusJeAdresse((alt) => ({ ...alt, [adresse]: s }))
        })
      }
    }, STATUS_ENTPRELLUNG_MS)
    return () => {
      aktuell = false
      clearTimeout(uhr)
    }
  }, [lokaleHelferAktiv, lokaleHelferModell, lokaleHelferAdressen])

  // Live-Status der SearXNG-Adresse (0.51.2) — eigener Effekt, eigener Zustand,
  // eigene Texte. Er hängt an dieser einen Adresse (und am Schalter, der den
  // Abschnitt überhaupt zeigt): Ein Tastendruck im Ollama-Modellfeld darf hier
  // keine Anfrage auslösen, und ein leeres Feld heißt „eingebaute Quelle" —
  // dann wird gar nicht erst geprüft.
  //
  // Gesäubert wird mit searxngAdresseBereinigen, derselben Regel wie im
  // Hauptprozess (Nacharbeit Befund 3): Mit der strengen Ollama-Regel
  // verschwand bei „gaming-pc:8080" gemessen sogar die Statuszeile — Georg sah
  // NICHTS, weder Status noch Fehler, und speicherte ins Leere.
  useEffect(() => {
    const adresse = searxngAdresseBereinigen(searxngAdresse)
    if (!lokaleHelferAktiv || !adresse) return setSearxngZustand(null)
    let aktuell = true
    const uhr = setTimeout(() => {
      Promise.resolve(window.flowforge?.searxngStatus?.(adresse)).then((s) => {
        if (aktuell && s) setSearxngZustand(s)
      })
    }, STATUS_ENTPRELLUNG_MS)
    return () => {
      aktuell = false
      clearTimeout(uhr)
    }
  }, [lokaleHelferAktiv, searxngAdresse])

  // Aktive Vorlage (Markierung der Knöpfe) und der Wert, der gespeichert
  // wird — beides aus denselben Feldern gerechnet.
  const lokalFein = feinAusText(lokalFeinText)
  const lokalFeinBereinigt = lokalFeinBereinigen(lokalFein)
  const aktiveVorlage = lokalFeinVorlageErkennen(lokalFeinBereinigt)

  // SearXNG-Adresse: die Fassung, die wirklich gespeichert wird (Nacharbeit
  // Befund 3). Weicht sie vom Getippten ab, steht sie im Dialog — eine still
  // ergänzte Adresse wäre nur eine andere Art, etwas anderes zu tun als das,
  // was dasteht. null heißt „nicht zu retten" (file:, data:, Unparsbares).
  const searxngRoh = searxngAdresse.trim()
  const searxngSauber = searxngAdresseBereinigen(searxngAdresse)
  const searxngUnbrauchbar = Boolean(searxngRoh) && searxngSauber === null

  function vorlageSetzen(schluessel) {
    setLokalFeinText(feinAlsText(LOKAL_FEIN_VORLAGEN[schluessel]))
  }

  function feinFeldSetzen(feld, wert) {
    setLokalFeinText((alt) => ({ ...alt, [feld]: wert }))
  }

  async function speichern() {
    // Ein Wert außerhalb der Grenzen würde im Hauptprozess still zu
    // „Ollama-Standard" — hier sagt FlowForge es lieber, bevor es speichert.
    for (const feld of LOKAL_FEIN_FELDER) {
      if (lokalFein[feld] != null && lokalFeinBereinigt[feld] == null)
        return setFehler(t.fehlerLokalFein(t.lokalBlockFeinFelder[feld]))
    }
    // Dasselbe Muster für die SearXNG-Adresse (Nacharbeit Befund 3): Was
    // FlowForge retten kann, ergänzt es (fehlendes http://); was es nicht
    // versteht, sagt es — statt den Wert wortlos fallen zu lassen und weiter
    // über die eingebaute Quelle zu suchen.
    if (searxngUnbrauchbar) return setFehler(t.fehlerSearxngAdresse)
    const ergebnis = await window.flowforge.einstellungenSpeichern({
      motorModus: modus,
      apiSchluessel,
      ausgabenObergrenzeUsd: Number(obergrenze),
      rechteAutomatisch,
      nurLesenBefehle,
      unteraufgabenModell,
      uebertragTest,
      // Prüfkarten-Deckel (BAUPLAN 52): Diese Liste ist handgeschrieben — ein
      // hier vergessenes Feld ließe sich im Dialog verstellen und stünde beim
      // nächsten Öffnen wieder auf dem alten Wert.
      pruefkartenDeckelMesspunktMs: deckelMesspunktMs,
      pruefkartenDeckelLaufMs: deckelLaufMs,
      lokaleHelferAktiv,
      lokaleHelferQuote,
      lokaleHelferModell,
      // Der Hauptprozess bereinigt die Liste (Ungültige raus, Duplikate raus,
      // leer → Standard) und schreibt das Einzelfeld als Spiegel der ersten
      // Adresse selbst.
      lokaleHelferAdressen,
      lokaleHelferKontext,
      // Geduld der Werkzeug-Schicht (0.51.3): Fehlte das Feld hier, hielte der
      // Hauptprozess zwar den gespeicherten Wert (undefined = aus der Datei),
      // aber Georg könnte ihn nie ändern.
      lokaleAntwortGeduldMs,
      lokalBlockAgent,
      lokalFein: lokalFeinBereinigt,
      // Websuche der lokalen Blöcke (0.51.2): Diese Liste ist handgeschrieben —
      // ein hier vergessenes Feld verschwindet still beim nächsten Speichern.
      searxngAdresse
    })
    if (!ergebnis.ok) return setFehler(ergebnis.fehler)
    onSchliessen()
  }

  if (!geladen) return null

  return (
    <div className="dialog-schleier">
      <div className="dialog dialog-einstellungen">
        <h2>{t.ueberschrift}</h2>
        <p className="bericht-abschnitt">{t.motorUeberschrift}</p>
        <div className="feld">
          <span>{t.modusFeld}</span>
          {aboErlaubt && (
            <label className="wahl-zeile">
              <input
                type="radio"
                name="modus"
                checked={modus === 'abo'}
                onChange={() => setModus('abo')}
              />
              <span>
                {t.modusAbo}
                <span className="feld-hinweis"> — {t.modusAboHinweis}</span>
              </span>
            </label>
          )}
          <label className="wahl-zeile">
            <input
              type="radio"
              name="modus"
              checked={modus === 'api'}
              onChange={() => setModus('api')}
            />
            <span>
              {t.modusApi}
              <span className="feld-hinweis"> — {t.modusApiHinweis}</span>
            </span>
          </label>
        </div>
        {modus === 'api' && (
          <>
            <label className="feld">
              <span>{t.apiSchluesselFeld}</span>
              <input
                type="password"
                placeholder={t.apiSchluesselPlatzhalter}
                value={apiSchluessel}
                onChange={(e) => setApiSchluessel(e.target.value)}
              />
            </label>
            <label className="feld">
              <span>{t.obergrenzeFeld}</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={obergrenze}
                onChange={(e) => setObergrenze(e.target.value)}
              />
              <span className="feld-hinweis">{t.obergrenzeHinweis}</span>
            </label>
          </>
        )}
        <p className="bericht-abschnitt">{t.rechteUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="radio"
              name="rechte"
              checked={!rechteAutomatisch}
              onChange={() => setRechteAutomatisch(false)}
            />
            <span>
              {t.rechteFragen}
              <span className="feld-hinweis"> — {t.rechteFragenHinweis}</span>
            </span>
          </label>
          <label className="wahl-zeile">
            <input
              type="radio"
              name="rechte"
              checked={rechteAutomatisch}
              onChange={() => setRechteAutomatisch(true)}
            />
            <span>
              {t.rechteAutomatisch}
              <span className="feld-hinweis"> — {t.rechteAutomatischHinweis}</span>
            </span>
          </label>
          <label className="wahl-zeile">
            <input
              type="checkbox"
              checked={nurLesenBefehle}
              onChange={(e) => setNurLesenBefehle(e.target.checked)}
            />
            <span>
              {t.nurLesenBefehle}
              <span className="feld-hinweis"> — {t.nurLesenBefehleHinweis}</span>
            </span>
          </label>
        </div>
        {/* Unteraufgaben-Modell (BAUPLAN 37): Zuarbeit der Block-Agenten —
            der Motor-Zwilling der lokalen Helfer-KI. */}
        <p className="bericht-abschnitt">{t.unteraufgabenUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="radio"
              name="unteraufgaben"
              checked={unteraufgabenModell === 'sparsam'}
              onChange={() => setUnteraufgabenModell('sparsam')}
            />
            <span>
              {t.unteraufgabenSparsam}
              <span className="feld-hinweis"> — {t.unteraufgabenSparsamHinweis}</span>
            </span>
          </label>
          <label className="wahl-zeile">
            <input
              type="radio"
              name="unteraufgaben"
              checked={unteraufgabenModell === 'wieBlock'}
              onChange={() => setUnteraufgabenModell('wieBlock')}
            />
            <span>
              {t.unteraufgabenWieBlock}
              <span className="feld-hinweis"> — {t.unteraufgabenWieBlockHinweis}</span>
            </span>
          </label>
        </div>
        <p className="bericht-abschnitt">{t.lokaleHelferUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="checkbox"
              checked={lokaleHelferAktiv}
              onChange={(e) => setLokaleHelferAktiv(e.target.checked)}
            />
            <span>
              {t.lokaleHelferAktiv}
              <span className="feld-hinweis"> — {t.lokaleHelferHinweis}</span>
            </span>
          </label>
          {lokaleHelferAktiv && (
            <>
              <label className="wahl-zeile">
                <input
                  type="checkbox"
                  checked={lokaleHelferQuote}
                  onChange={(e) => setLokaleHelferQuote(e.target.checked)}
                />
                <span>
                  {t.lokaleHelferQuote}
                  <span className="feld-hinweis"> — {t.lokaleHelferQuoteHinweis}</span>
                </span>
              </label>
              {/* Adress-Liste (BAUPLAN 51): Zeile je Ollama-Adresse mit
                  Entfernen-Knopf und Live-Status; die letzte Zeile bleibt —
                  der Adress-Pool ist nie leer (einstellungenLaden garantiert
                  das auch beim Speichern). */}
              <div className="feld">
                <span>{t.lokaleHelferAdressen}</span>
                {lokaleHelferAdressen.map((adresse, i) => {
                  // Derselbe Schlüssel, mit dem der Effekt oben gefragt hat —
                  // sonst zeigt die Zeile den Status einer anderen Adresse.
                  const sauber = adresseBereinigen(adresse)
                  const status = sauber ? helferStatusJeAdresse[sauber] : null
                  return (
                    <div key={i}>
                      <div className="filter-zeile">
                        <input
                          type="text"
                          placeholder="http://127.0.0.1:11434"
                          value={adresse}
                          onChange={(e) =>
                            setLokaleHelferAdressen((alt) =>
                              alt.map((a, j) => (j === i ? e.target.value : a))
                            )
                          }
                        />
                        <button
                          type="button"
                          className="knopf-sekundaer knopf-klein"
                          disabled={lokaleHelferAdressen.length === 1}
                          onClick={() =>
                            setLokaleHelferAdressen((alt) => alt.filter((_, j) => j !== i))
                          }
                        >
                          {t.lokaleHelferAdresseEntfernen}
                        </button>
                      </div>
                      {status && (
                        <span className="feld-hinweis">
                          {status.erreichbar && status.modellDa
                            ? t.lokaleHelferStatusBereit(lokaleHelferModell.trim())
                            : status.erreichbar
                              ? t.lokaleHelferStatusKeinModell(lokaleHelferModell.trim()) +
                                (status.modelle?.length
                                  ? ' ' + t.lokaleHelferStatusVorhandene(status.modelle)
                                  : '')
                              : t.lokaleHelferStatusAus}
                        </span>
                      )}
                    </div>
                  )
                })}
                <div className="filter-zeile">
                  <button
                    type="button"
                    className="knopf-sekundaer knopf-klein"
                    onClick={() => setLokaleHelferAdressen((alt) => [...alt, ''])}
                  >
                    {t.lokaleHelferAdresseHinzufuegen}
                  </button>
                </div>
                <span className="feld-hinweis">{t.lokaleHelferAdressenHinweis}</span>
              </div>
              <label className="feld">
                <span>{t.lokaleHelferModell}</span>
                <input
                  type="text"
                  value={lokaleHelferModell}
                  onChange={(e) => setLokaleHelferModell(e.target.value)}
                />
              </label>
              {/* Kontext-Fenster (seit 0.46.3): 32k / 64k / 96k / 128k — die
                  Werkzeug-Deckel der lokalen KI wachsen mit. Die Stufenliste
                  kommt seit 0.51.3 aus lokalRegeln.js: Stünde sie hier noch
                  einmal von Hand, böte der Dialog eine Stufe an, die das
                  Speichern still auf den Standard zurückdreht. */}
              <label className="feld">
                <span>{t.lokaleHelferKontext}</span>
                <select
                  value={lokaleHelferKontext}
                  onChange={(e) => setLokaleHelferKontext(Number(e.target.value))}
                >
                  {LOKAL_KONTEXT_WAHL.map((k) => (
                    <option key={k} value={k}>
                      {t.lokaleHelferKontextWahl(k)}
                    </option>
                  ))}
                </select>
                <span className="feld-hinweis">{t.lokaleHelferKontextHinweis}</span>
              </label>
              {/* Geduld der Werkzeug-Schicht (0.51.3): ehrlich als Notnagel
                  benannt — sie verhindert den Abbruch, macht aus einem
                  Speicherproblem aber nur kriechende Läufe. */}
              <label className="feld">
                <span>{t.lokaleGeduld}</span>
                <select
                  value={lokaleAntwortGeduldMs}
                  onChange={(e) => setLokaleAntwortGeduldMs(Number(e.target.value))}
                >
                  {LOKAL_GEDULD_WAHL.map((ms) => (
                    <option key={ms} value={ms}>
                      {t.lokaleGeduldWahl(ms)}
                    </option>
                  ))}
                </select>
                <span className="feld-hinweis">{t.lokaleGeduldHinweis}</span>
              </label>
              {/* Websuche der lokalen Blöcke (0.51.2): ein Feld. Leer =
                  eingebaute Quelle, gefüllt = eigene SearXNG-Instanz.
                  Der Abschnitt bleibt auch dann sichtbar, wenn der Block-Agent
                  noch aus ist — dann sagt eine Zeile ehrlich, wann er wirkt
                  (Nacharbeit Befund 6, Hausgeist „Rückfrage statt Sperre"). */}
              <div className="feld">
                <span>{t.websucheUeberschrift}</span>
                {!lokalBlockAgent && (
                  <span className="feld-hinweis">{t.websucheNurMitBlockAgent}</span>
                )}
                <label className="feld">
                  <span>{t.searxngAdresse}</span>
                  <input
                    type="text"
                    placeholder="gaming-pc:8080"
                    value={searxngAdresse}
                    onChange={(e) => setSearxngAdresse(e.target.value)}
                  />
                </label>
                {searxngUnbrauchbar && (
                  <span className="feld-hinweis">{t.fehlerSearxngAdresse}</span>
                )}
                {searxngSauber && searxngSauber !== searxngRoh && (
                  <span className="feld-hinweis">{t.searxngErgaenzt(searxngSauber)}</span>
                )}
                {searxngZustand && (
                  <span className="feld-hinweis">
                    {!searxngZustand.erreichbar
                      ? t.searxngStatusAus
                      : searxngZustand.gedrosselt
                        ? t.searxngStatusGedrosselt
                        : searxngZustand.jsonDa
                          ? t.searxngStatusBereit
                          : t.searxngStatusKeinJson}
                  </span>
                )}
                <span className="feld-hinweis">{t.searxngHinweis}</span>
              </div>
            </>
          )}
        </div>
        {/* Lokale KI als Block-Agent (BAUPLAN 49): Häkchen nur bedienbar,
            wenn die Helfer-KI oben an ist — Modell, Adresse und Kontextfenster
            sind dieselben. Die Feineinstellungen werden zum abgeleiteten
            Ollama-Modell flowforge-<basis>; leer = Ollama-Standard. */}
        <p className="bericht-abschnitt">{t.lokalBlockUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="checkbox"
              disabled={!lokaleHelferAktiv}
              checked={lokalBlockAgent}
              onChange={(e) => setLokalBlockAgent(e.target.checked)}
            />
            <span>
              {t.lokalBlockAgent}
              <span className="feld-hinweis"> — {t.lokalBlockAgentHinweis}</span>
            </span>
          </label>
          {!lokaleHelferAktiv && <span className="feld-hinweis">{t.lokalBlockNurMitHelfer}</span>}
          {lokaleHelferAktiv && lokalBlockAgent && (
            <>
              <span className="feld-hinweis">
                {lokaleHelferModell.trim()
                  ? t.lokalBlockAbgeleitet(lokalesModellName(lokaleHelferModell.trim()))
                  : t.lokalBlockAbgeleitetOhneBasis}
              </span>
              <div className="feld">
                <span>{t.lokalBlockFeinTitel}</span>
                <span className="feld-hinweis">{t.lokalBlockFeinHinweis}</span>
              </div>
              <div className="feld">
                <span>{t.lokalBlockVorlagen}</span>
                <div className="filter-zeile">
                  {VORLAGEN_REIHENFOLGE.map((schluessel) => (
                    <button
                      key={schluessel}
                      type="button"
                      className={
                        'filter-chip' + (aktiveVorlage === schluessel ? ' filter-aktiv' : '')
                      }
                      onClick={() => vorlageSetzen(schluessel)}
                    >
                      {t.lokalBlockVorlageNamen[schluessel]}
                    </button>
                  ))}
                </div>
                <span className="feld-hinweis">{t.lokalBlockVorlagenHinweis}</span>
              </div>
              <div className="lokal-fein-raster">
                {LOKAL_FEIN_FELDER.map((feld) => (
                  <label key={feld} className="feld">
                    <span>{t.lokalBlockFeinFelder[feld]}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={LOKAL_FEIN_GRENZEN[feld].min}
                      max={LOKAL_FEIN_GRENZEN[feld].max}
                      step={LOKAL_FEIN_GRENZEN[feld].step}
                      value={lokalFeinText[feld]}
                      placeholder={t.lokalBlockFeinLeer}
                      onChange={(e) => feinFeldSetzen(feld, e.target.value)}
                    />
                    <span className="feld-hinweis">{t.lokalBlockFeinHinweise[feld]}</span>
                  </label>
                ))}
              </div>
              <span className="feld-hinweis">{t.lokalBlockDenkenHinweis}</span>
            </>
          )}
        </div>
        {/* Prüfkarten laufen von selbst (BAUPLAN 52): Beide Grenzen ändern
            nur, wie OFT eine alte Prüfung läuft — nie, OB sie läuft. Genau das
            sagen auch die Hinweistexte, damit die Zahl nicht wie ein
            Sparprogramm für Prüfungen aussieht. */}
        <p className="bericht-abschnitt">{t.pruefkartenUeberschrift}</p>
        <div className="feld">
          <label className="feld">
            <span>{t.pruefkartenDeckelMesspunkt}</span>
            <select
              value={deckelMesspunktMs}
              onChange={(e) => setDeckelMesspunktMs(Number(e.target.value))}
            >
              {PRUEFKARTEN_DECKEL_MESSPUNKT_WAHL.map((ms) => (
                <option key={ms} value={ms}>
                  {t.pruefkartenDeckelMesspunktWahl(ms)}
                </option>
              ))}
            </select>
            <span className="feld-hinweis">{t.pruefkartenDeckelMesspunktHinweis}</span>
          </label>
          <label className="feld">
            <span>{t.pruefkartenDeckelLauf}</span>
            <select value={deckelLaufMs} onChange={(e) => setDeckelLaufMs(Number(e.target.value))}>
              {PRUEFKARTEN_DECKEL_LAUF_WAHL.map((ms) => (
                <option key={ms} value={ms}>
                  {t.pruefkartenDeckelLaufWahl(ms)}
                </option>
              ))}
            </select>
            <span className="feld-hinweis">{t.pruefkartenDeckelLaufHinweis}</span>
          </label>
        </div>
        <p className="bericht-abschnitt">{t.uebertragUeberschrift}</p>
        <div className="feld">
          <label className="wahl-zeile">
            <input
              type="checkbox"
              checked={uebertragTest}
              onChange={(e) => setUebertragTest(e.target.checked)}
            />
            <span>
              {t.uebertragTest}
              <span className="feld-hinweis"> — {t.uebertragTestHinweis}</span>
            </span>
          </label>
        </div>
        {fehler && <p className="fehlermeldung">{fehler}</p>}
        <div className="dialog-knoepfe">
          <button className="knopf-sekundaer" onClick={onSchliessen}>
            {t.abbrechen}
          </button>
          <button className="knopf-primaer" onClick={speichern}>
            {t.speichern}
          </button>
        </div>
      </div>
    </div>
  )
}
