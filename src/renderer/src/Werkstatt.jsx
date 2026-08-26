// Werkstatt (Bauschritt 54): die lokale KI live sehen und wirklich messen.
//
// Zwei Ansichten in einer Seite, weil sie zwei verschiedene Fragen beantworten:
//  - OHNE LAUF: „Kann ich jetzt lokal bauen?" — je Ollama-Adresse erreichbar,
//    Modell da, abgeleitetes Modell da, Anteil in der Grafikkarte. Heute
//    erfährt Georg das erst mitten im Lauf im Ticker.
//  - WÄHREND EINES LAUFS: was jeder lokale Block wirklich verbraucht — und der
//    Kern des Schrittes: der Füllstand gemessen NEBEN geschätzt.
//
// Zwei Takte, weil die Quellen verschieden teuer sind: Der Stand der
// Zählstellen liegt im eigenen Prozess und kostet nichts (Sekundentakt); der
// Zustand der Rechner sind echte Anfragen an fremde Rechner und läuft deshalb
// ruhig (beim Öffnen, auf Knopfdruck, danach alle 15 Sekunden). Der Grund steht
// im Bestand: 0.51.2 ging je Tastendruck eine Anfrage an eine fremde Quelle
// hinaus — 19 getippte Zeichen waren 19 Anfragen.
import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'
import { prozentGanz, tokenJeSekunde } from '../../shared/zaehlRegeln.js'

const t = texte.werkstatt

const STAND_TAKT_MS = 1000
const RECHNER_TAKT_MS = 15000

function zahl(n) {
  return n == null ? '—' : Math.round(n).toLocaleString('de-DE')
}

function dauer(ms) {
  const s = Math.max(0, Math.round(Number(ms) / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

function tempo(tokens, dauerMs) {
  const wert = tokenJeSekunde(tokens, dauerMs)
  return wert == null ? '—' : wert.toFixed(1).replace('.', ',')
}

// Ein Balken, der beide Zahlen NEBENEINANDER zeigt statt nacheinander — genau
// das ist die Aussage. Die Marke ist die geltende Übertrags-Schwelle des
// Blocks; über 100 % wird nicht abgeschnitten, sondern rot: Dann kappt Ollama.
function FuellstandBalken({ vergleich, marke }) {
  const gemessen = prozentGanz(vergleich.gemessenProzent)
  const geschaetzt = prozentGanz(vergleich.geschaetztProzent)
  const breite = (p) => Math.max(0, Math.min(100, p ?? 0)) + '%'
  return (
    <div className="werkstatt-fuellstand">
      <div className="werkstatt-balken">
        <div
          className={'werkstatt-balken-wert werkstatt-gemessen' + (gemessen > 100 ? ' werkstatt-ueber' : '')}
          style={{ width: breite(gemessen) }}
        />
        {marke != null && <div className="werkstatt-marke" style={{ left: marke + '%' }} />}
      </div>
      <div className="werkstatt-balken-zeile">
        <span className="werkstatt-punkt werkstatt-gemessen" /> {t.fuellstandGemessen}{' '}
        {gemessen == null ? '—' : gemessen + ' %'} ({zahl(vergleich.gemessen)})
      </div>
      <div className="werkstatt-balken">
        <div className="werkstatt-balken-wert werkstatt-geschaetzt" style={{ width: breite(geschaetzt) }} />
        {marke != null && <div className="werkstatt-marke" style={{ left: marke + '%' }} />}
      </div>
      <div className="werkstatt-balken-zeile">
        <span className="werkstatt-punkt werkstatt-geschaetzt" /> {t.fuellstandGeschaetzt}{' '}
        {geschaetzt == null ? '—' : geschaetzt + ' %'} ({zahl(vergleich.geschaetzt)})
        {marke != null && <span className="metrik-luecke"> · {t.fuellstandMarke(marke)}</span>}
      </div>
      <p className="feld-hinweis">{t.fuellstandZeile(vergleich)}</p>
      {vergleich.abstand > 0 && <p className="feld-hinweis werkstatt-warnung">{t.fuellstandZuNiedrig}</p>}
      {vergleich.abstand < 0 && <p className="feld-hinweis">{t.fuellstandZuHoch}</p>}
      {gemessen > 100 && <p className="feld-hinweis werkstatt-warnung">{t.fuellstandUeberFenster}</p>}
    </div>
  )
}

function RechnerTabelle({ rechner }) {
  return (
    <div className="themen-tabelle-rahmen metrik-tabelle-rahmen">
      <table className="themen-tabelle metrik-tabelle">
        <thead>
          <tr>
            <th>{t.spalteAdresse}</th>
            <th>{t.spalteErreichbar}</th>
            <th>{t.spalteBasisModell}</th>
            <th>{t.spalteAbgeleitet}</th>
            <th>{t.spalteGeladen}</th>
            <th className="zahl">{t.spalteKarte}</th>
          </tr>
        </thead>
        <tbody>
          {rechner.adressen.map((a) => (
            <tr key={a.adresse}>
              <td className="mono">{a.adresse}</td>
              <td className={a.erreichbar ? '' : 'werkstatt-warnung'}>{a.erreichbar ? t.ja : t.nein}</td>
              <td className={a.erreichbar && !a.basisDa ? 'werkstatt-warnung' : ''}>
                {a.erreichbar ? (a.basisDa ? t.ja : t.nein) : '—'}
              </td>
              <td>{a.erreichbar ? (a.abgeleitetDa ? t.ja : t.nein) : '—'}</td>
              <td className="mono">
                {!a.erreichbar
                  ? '—'
                  : a.geladen === null
                    ? t.nichtBeantwortbar
                    : a.geladen.length === 0
                      ? t.nichtsGeladen
                      : a.geladen.map((m) => m.name).join(' · ')}
              </td>
              <td className={'zahl' + (a.speicher?.ok && !a.speicher.passt ? ' werkstatt-warnung' : '')}>
                {!a.erreichbar || !a.speicher?.ok ? t.nichtBeantwortbar : t.karteProzent(a.speicher.prozent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StellenTabelle({ stellen }) {
  return (
    <div className="themen-tabelle-rahmen metrik-tabelle-rahmen">
      <table className="themen-tabelle metrik-tabelle">
        <thead>
          <tr>
            <th>{t.spalteArt}</th>
            <th>{t.spalteBlock}</th>
            <th>{t.spalteModell}</th>
            <th>{t.spalteZiel}</th>
            <th className="zahl">{t.spalteLaufzeit}</th>
            <th className="zahl">{t.spalteAnfragen}</th>
            <th className="zahl">{t.spalteHinein}</th>
            <th className="zahl">{t.spalteHeraus}</th>
            <th className="zahl">{t.spalteTempo}</th>
          </tr>
        </thead>
        <tbody>
          {stellen.map((s, i) => (
            <tr key={`${s.art} ${s.ziel} ${i}`}>
              {/* Drei Arten (Bauschritt 60): Helfer-KI, OpenRouter (der
                  eingebaute Übersetzer), sonst lokaler Block — vorher lief
                  alles Unbekannte als „Block" durch. */}
              <td>
                {s.art === 'helfer' ? t.artHelfer : s.art === 'openrouter' ? t.artOpenrouter : t.artBlock}
              </td>
              <td>{s.blockName || t.ohneName}</td>
              <td className="mono">{s.modell || t.ohneName}</td>
              <td className="mono">{s.ziel}</td>
              <td className="zahl">{dauer(s.dauerMs)}</td>
              <td className="zahl">
                {zahl(s.anfragen)}
                {s.offeneAnfragen > 0 && (
                  <span className="werkstatt-laeuft"> {t.laeuftGerade(s.offeneAnfragen)}</span>
                )}
              </td>
              <td className="zahl">{zahl(s.tokenHinein)}</td>
              <td className="zahl">{zahl(s.tokenHeraus)}</td>
              <td className="zahl">{tempo(s.tokenHeraus, s.dauerMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Werkstatt() {
  const [stand, setStand] = useState(null)
  const [rechner, setRechner] = useState(null)

  // Billiger Takt: Der Stand liegt im eigenen Prozess.
  useEffect(() => {
    let lebt = true
    const holen = () =>
      window.flowforge.werkstattStand().then((a) => lebt && a?.ok && setStand(a))
    holen()
    const uhr = setInterval(holen, STAND_TAKT_MS)
    return () => {
      lebt = false
      clearInterval(uhr)
    }
  }, [])

  // Teurer Takt: echte Anfragen an fremde Rechner — deshalb ruhig, und
  // derselbe Weg für den Knopf wie für die Uhr (eine Stelle, ein Verhalten).
  const rechnerHolen = () => window.flowforge.werkstattRechner().then((a) => a?.ok && setRechner(a))
  useEffect(() => {
    rechnerHolen()
    const uhr = setInterval(rechnerHolen, RECHNER_TAKT_MS)
    return () => clearInterval(uhr)
    // Absichtlich einmal beim Öffnen: rechnerHolen hängt an nichts, was sich
    // ändert — eine Abhängigkeit hier würde die Uhr bei jedem Bild neu setzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stellen = stand?.stellen ?? []
  // Nur Block-Messstellen tragen einen Füllstand: Die Helfer-KI führt eigene
  // kleine Kreisläufe mit eigenem Kontext — dort gäbe es nichts zu vergleichen.
  // Gezeigt wird auch die Messung OHNE Vergleich (der Block-Agent hat noch
  // nicht angefangen, es gibt also noch keine Schätzung) — sie ist die halbe
  // Aussage, aber die richtige Hälfte. OpenRouter-Einträge (Bauschritt 60)
  // hält genau dieser Filter draußen: Der Übersetzer meldet weder vergleich
  // noch gemessen, weil es dort keine Schätzung gibt — ein Balken wäre
  // erfunden.
  const mitFuellstand = stellen.filter((s) => s.vergleich || s.gemessen != null)
  const bereite = rechner?.adressen.filter((a) => a.erreichbar && a.basisDa).length ?? 0
  const gesamt = rechner?.adressen.length ?? 0

  return (
    <section className="metriken werkstatt">
      <div className="metriken-kopf">
        <div>
          <h1>{t.ueberschrift}</h1>
          <p className="feld-hinweis">{t.untertitel}</p>
        </div>
        <button className="knopf-sekundaer knopf-klein" onClick={rechnerHolen}>
          {t.aktualisieren}
        </button>
      </div>

      <h2 className="metrik-abschnitt">{t.laufUeberschrift}</h2>
      <p className="feld-hinweis">{t.laufErklaerung}</p>
      {stellen.length === 0 ? (
        <p className="feld-hinweis metrik-leer">{t.laufLeer}</p>
      ) : (
        <StellenTabelle stellen={stellen} />
      )}

      <h2 className="metrik-abschnitt">{t.fuellstandUeberschrift}</h2>
      <p className="feld-hinweis">{t.fuellstandErklaerung}</p>
      {mitFuellstand.length === 0 ? (
        <p className="feld-hinweis metrik-leer">{t.fuellstandLeer}</p>
      ) : (
        mitFuellstand.map((s, i) => (
          <div className="werkstatt-block" key={`${s.ziel} ${i}`}>
            <h3 className="metrik-unterabschnitt">
              {s.blockName || t.ohneName} · {s.modell}
            </h3>
            {s.vergleich ? (
              <FuellstandBalken vergleich={s.vergleich} marke={s.waechterProzent} />
            ) : (
              <p className="feld-hinweis">
                {t.nurGemessen(s.gemessen, prozentGanz(s.gemessenProzent))}
              </p>
            )}
          </div>
        ))
      )}

      <h2 className="metrik-abschnitt">{t.rechnerUeberschrift}</h2>
      <p className="feld-hinweis">{t.rechnerErklaerung}</p>
      {!rechner ? (
        <p className="feld-hinweis">{t.rechnerLaedt}</p>
      ) : gesamt === 0 ? (
        <p className="feld-hinweis metrik-leer">{t.rechnerLeer}</p>
      ) : !rechner.basisModell ? (
        <p className="feld-hinweis metrik-leer">{t.ohneModell}</p>
      ) : (
        <>
          <p className="metrik-gesamt">
            {bereite === 0
              ? t.bereitNein
              : bereite === gesamt
                ? t.bereitJa
                : t.bereitTeilweise(bereite, gesamt)}
          </p>
          <RechnerTabelle rechner={rechner} />
          {rechner.adressen.some((a) => a.erreichbar && !a.basisDa) && (
            <p className="feld-hinweis werkstatt-warnung">{t.modellFehltHinweis(rechner.basisModell)}</p>
          )}
          {rechner.adressen.some((a) => a.erreichbar && a.basisDa && !a.abgeleitetDa) && (
            <p className="feld-hinweis">{t.abgeleitetFehltHinweis}</p>
          )}
          {rechner.adressen.some((a) => a.speicher?.ok && !a.speicher.passt) && (
            <p className="feld-hinweis werkstatt-warnung">{t.karteKnapp}</p>
          )}
        </>
      )}

      <h2 className="metrik-abschnitt">{t.grenzenUeberschrift}</h2>
      <ul className="werkstatt-grenzen">
        {t.grenzen.map((zeile) => (
          <li className="feld-hinweis" key={zeile}>
            {zeile}
          </li>
        ))}
      </ul>
    </section>
  )
}
