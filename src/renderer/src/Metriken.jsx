// Metriken (BAUPLAN 31): lokale KI und Motor über alle Läufe hinweg — ein
// eigener Baustein, der zweimal erscheint: als globale Seite über den Knopf
// „Metriken" in der Titelleiste (Filter nach Projekt) und im Projekt als Tab
// „Metriken", vorgefiltert (projektPfad gesetzt). Die Rohdaten (Extrakte je
// Bericht, Urteile der lokalen KI) liefert der Hauptprozess; die Schnitte
// rechnet metrikRegeln.js hier nach dem Filtern — so kostet ein Filterwechsel
// keinen Roundtrip. Nur Nachschlagewerk: nichts davon wandert in einen Auftrag.
import { useEffect, useMemo, useState } from 'react'
import { texte } from '../../shared/texte.js'
import {
  blockModellAuswerten,
  harnessAuswerten,
  lokaleKiAuswerten,
  motorAuswerten
} from '../../shared/metrikRegeln.js'

const t = texte.metriken
// Lauf-Ausgänge heißen in den Kennzahlen genauso wie im Laufbericht.
const zustandLabel = (zustand) => texte.lauf.zustandLabels[zustand] ?? zustand

function tokensText(n) {
  return n == null ? '—' : Math.round(n).toLocaleString('de-DE')
}
function kostenText(usd) {
  return usd == null ? '—' : usd.toFixed(2).replace('.', ',') + ' $'
}
function quoteText(q) {
  return q == null ? t.keineQuote : Math.round(q * 100) + ' %'
}
// Kennzahlen mit einer Nachkommastelle — „0,7 Reparatur-Runden je Lauf".
function zahlText(n) {
  return n == null ? '—' : n.toFixed(1).replace('.', ',')
}
function datumKurz(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}
function datumMitJahr(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Ø-Zelle mit ehrlicher Lücken-Angabe: „12.300" oder „12.300 (2 ohne Verbrauch)".
function durchschnittZelle(wert, luecken, lueckenText, formatieren) {
  if (wert == null && luecken === 0) return '—'
  return (
    <>
      {formatieren(wert)}
      {luecken > 0 && <span className="metrik-luecke"> ({t.ohneAngabe(luecken, lueckenText)})</span>}
    </>
  )
}

function LokaleKiTabelle({ zeilen }) {
  return (
    <div className="themen-tabelle-rahmen metrik-tabelle-rahmen">
      <table className="themen-tabelle metrik-tabelle">
        <thead>
          <tr>
            <th>{t.spalteModell}</th>
            <th>{t.spalteBereich}</th>
            <th className="zahl">{t.spalteAnzahl}</th>
            <th className="zahl">{t.spalteQuote}</th>
            <th className="zahl">{t.spaltePositiv}</th>
            <th className="zahl">{t.spalteNegativ}</th>
            <th className="zahl">{t.spalteGescheitert}</th>
            <th className="zahl">{t.spalteSchritte}</th>
            <th>{t.spalteZeitraum}</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={`${z.modell} ${z.bereich}`}>
              <td className="mono">{z.modell}</td>
              <td>{t.bereiche[z.bereich] ?? z.bereich}</td>
              <td className="zahl">{z.anzahl}</td>
              <td className="zahl metrik-quote">{quoteText(z.quote)}</td>
              <td className="zahl">{z.positiv}</td>
              <td className="zahl">{z.negativ}</td>
              <td className="zahl">{z.gescheitert}</td>
              <td className="zahl">{z.schritteDurchschnitt.toFixed(1).replace('.', ',')}</td>
              <td>
                {datumMitJahr(z.von)}
                {z.von.slice(0, 10) !== z.bis.slice(0, 10) && ` – ${datumMitJahr(z.bis)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BlockTabelle({ zeilen }) {
  return (
    <div className="themen-tabelle-rahmen metrik-tabelle-rahmen">
      <table className="themen-tabelle metrik-tabelle">
        <thead>
          <tr>
            <th>{t.spalteBlock}</th>
            <th className="zahl">{t.spalteErstlaeufe}</th>
            <th className="zahl">{t.spalteTokensDurchschnitt}</th>
            <th className="zahl">{t.spalteKostenDurchschnitt}</th>
            <th className="zahl">{t.spalteWiederholungen}</th>
            <th className="zahl">{t.spalteTokensDurchschnitt}</th>
            <th className="zahl">{t.spalteKostenDurchschnitt}</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.block}>
              <td>{z.block}</td>
              <td className="zahl">{z.erstlauf.anzahl}</td>
              <td className="zahl">
                {durchschnittZelle(z.erstlauf.tokensDurchschnitt, z.erstlauf.ohneTokens, t.ohneVerbrauch, tokensText)}
              </td>
              <td className="zahl">
                {durchschnittZelle(z.erstlauf.kostenDurchschnitt, z.erstlauf.ohneKosten, t.ohneKosten, kostenText)}
              </td>
              <td className="zahl">{z.wiederholung.anzahl || '—'}</td>
              <td className="zahl">
                {z.wiederholung.anzahl
                  ? durchschnittZelle(z.wiederholung.tokensDurchschnitt, z.wiederholung.ohneTokens, t.ohneVerbrauch, tokensText)
                  : '—'}
              </td>
              <td className="zahl">
                {z.wiederholung.anzahl
                  ? durchschnittZelle(z.wiederholung.kostenDurchschnitt, z.wiederholung.ohneKosten, t.ohneKosten, kostenText)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Blocktyp × Modell (BAUPLAN 36): dieselbe Tabellen-Idee wie Modell × Bereich
// bei der lokalen KI — plus das „schafft es"-Signal (Wiederholungen, und bei
// Prüf-Blöcken die Erstbestehen-Quote).
function BlockModellTabelle({ zeilen }) {
  return (
    <div className="themen-tabelle-rahmen metrik-tabelle-rahmen">
      <table className="themen-tabelle metrik-tabelle">
        <thead>
          <tr>
            <th>{t.spalteBlock}</th>
            <th>{t.spalteModell}</th>
            {/* Denktiefe (0.48.1): die wirksame Stufe je Block — leer bei
                Modell-Standard ohne Messung, dann steht „—" in der Zelle. */}
            <th>{t.spalteDenktiefe}</th>
            <th className="zahl">{t.spalteErstlaeufe}</th>
            <th className="zahl">{t.spalteTokensDurchschnitt}</th>
            <th className="zahl">{t.spalteKostenDurchschnitt}</th>
            <th className="zahl">{t.spalteWiederholungen}</th>
            <th className="zahl">{t.spalteErstbestehen}</th>
          </tr>
        </thead>
        <tbody>
          {/* Schlüssel mit Denktiefe (K1): seit 0.48.1 teilt die Denktiefe die
              Zeilen — „Prüfer / opus / xhigh" und „Prüfer / opus / —" dürfen
              nicht denselben React-Key tragen, sonst verschluckt React Zeilen. */}
          {zeilen.map((z) => (
            <tr key={`${z.block} ${z.modell} ${z.denktiefe ?? ''}`}>
              <td>{z.block}</td>
              <td className="mono">{z.modell}</td>
              <td className="mono">{z.denktiefe || t.denktiefeOhne}</td>
              <td className="zahl">{z.erstlauf.anzahl}</td>
              <td className="zahl">
                {durchschnittZelle(z.erstlauf.tokensDurchschnitt, z.erstlauf.ohneTokens, t.ohneVerbrauch, tokensText)}
              </td>
              <td className="zahl">
                {durchschnittZelle(z.erstlauf.kostenDurchschnitt, z.erstlauf.ohneKosten, t.ohneKosten, kostenText)}
              </td>
              <td className="zahl">{z.wiederholung.anzahl || '—'}</td>
              <td className="zahl metrik-quote">
                {z.erstbestehenQuote == null
                  ? '—'
                  : `${quoteText(z.erstbestehenQuote)} (${z.erstBestanden}/${z.ersteUrteile})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Harness-Kennzahlen als Kacheln: eine große Zahl mit ihrer Erklärung darunter.
function KennzahlKachel({ titel, wert, hinweis }) {
  return (
    <div className="kennzahl-kachel">
      <div className="kennzahl-wert">{wert}</div>
      <div className="kennzahl-titel">{titel}</div>
      {hinweis && <div className="kennzahl-hinweis">{hinweis}</div>}
    </div>
  )
}

// Harness je Kette bzw. je Woche — dieselben Spalten, andere erste Spalte.
function HarnessTabelle({ zeilen, ersteSpalte, beschriftung }) {
  return (
    <div className="themen-tabelle-rahmen metrik-tabelle-rahmen">
      <table className="themen-tabelle metrik-tabelle">
        <thead>
          <tr>
            <th>{ersteSpalte}</th>
            <th className="zahl">{t.spalteLaeufe}</th>
            <th className="zahl">{t.spalteErstbestehen}</th>
            <th className="zahl">{t.spalteReparaturRunden}</th>
            <th className="zahl">{t.spalteFragen}</th>
            <th>{t.spalteAusgang}</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={i}>
              <td>{beschriftung(z)}</td>
              <td className="zahl">{z.laeufe}</td>
              <td className="zahl metrik-quote">{quoteText(z.erstbestehenQuote)}</td>
              <td className="zahl">{zahlText(z.reparaturJeLauf)}</td>
              <td className="zahl">{zahlText((z.rechteJeLauf ?? 0) + (z.folgenJeLauf ?? 0))}</td>
              <td>{t.ausgangZeile(z.ausgaenge, zustandLabel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Ketten und Projekte teilen sich die Spalten: Läufe · Ø Tokens · Ø Kosten ·
// Tokens gesamt · Kosten gesamt.
function SummenTabelle({ zeilen, ersteSpalte, beschriftung }) {
  return (
    <div className="themen-tabelle-rahmen metrik-tabelle-rahmen">
      <table className="themen-tabelle metrik-tabelle">
        <thead>
          <tr>
            <th>{ersteSpalte}</th>
            <th className="zahl">{t.spalteLaeufe}</th>
            <th className="zahl">{t.spalteTokensDurchschnitt}</th>
            <th className="zahl">{t.spalteKostenDurchschnitt}</th>
            <th className="zahl">{t.spalteTokensGesamt}</th>
            <th className="zahl">{t.spalteKostenGesamt}</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={i}>
              <td>{beschriftung(z)}</td>
              <td className="zahl">{z.anzahl}</td>
              <td className="zahl">{durchschnittZelle(z.tokensDurchschnitt, z.ohneTokens, t.ohneVerbrauch, tokensText)}</td>
              <td className="zahl">{durchschnittZelle(z.kostenDurchschnitt, z.ohneKosten, t.ohneKosten, kostenText)}</td>
              <td className="zahl">{tokensText(z.tokens)}</td>
              <td className="zahl">{z.mitKosten > 0 ? kostenText(z.kostenUsd) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Zeitverlauf je Woche als einfache Balken — „wird es billiger?".
function WochenBalken({ wochen }) {
  const max = Math.max(1, ...wochen.map((w) => w.tokens))
  return (
    <div className="metrik-wochen">
      {wochen.map((w) => (
        <div key={w.schluessel} className="metrik-woche">
          <div className="metrik-woche-label">
            {t.wocheLabel(w.nummer, datumKurz(w.montag), datumKurz(w.sonntag))}
          </div>
          <div className="metrik-woche-balken-spur">
            <div className="metrik-woche-balken" style={{ width: `${Math.max(1, (100 * w.tokens) / max)}%` }} />
          </div>
          <div className="metrik-woche-werte">{t.wocheZeile(w)}</div>
        </div>
      ))}
    </div>
  )
}

export default function Metriken({ projektPfad = null }) {
  const [daten, setDaten] = useState(null)
  const [filter, setFilter] = useState(projektPfad ?? 'alle')

  function laden() {
    window.flowforge.metrikenLaden().then((e) => {
      if (e.ok) setDaten(e)
    })
  }
  useEffect(laden, [])
  useEffect(() => {
    if (projektPfad) setFilter(projektPfad)
  }, [projektPfad])

  const nameVon = useMemo(() => {
    const m = new Map()
    for (const p of daten?.projekte ?? []) m.set(p.pfad, p.name)
    return (pfad) => m.get(pfad) ?? pfad
  }, [daten])

  const auswertung = useMemo(() => {
    if (!daten) return null
    const laeufe = filter === 'alle' ? daten.laeufe : daten.laeufe.filter((l) => l.projektPfad === filter)
    const urteile = filter === 'alle' ? daten.urteile : daten.urteile.filter((u) => u.projektPfad === filter)
    return {
      motor: motorAuswerten(laeufe),
      lokal: lokaleKiAuswerten(urteile),
      // Harness-Kennzahlen und Blocktyp × Modell (BAUPLAN 36) — dieselben
      // Extrakte, andere Schnitte; deshalb kostet auch das keinen Roundtrip.
      harness: harnessAuswerten(laeufe),
      jeModell: blockModellAuswerten(laeufe),
      laeufe: laeufe.length
    }
  }, [daten, filter])

  return (
    <section className={'metriken' + (projektPfad ? ' metriken-eingebettet' : '')}>
      <div className="metriken-kopf">
        <div>
          {!projektPfad && <h1>{t.ueberschrift}</h1>}
          <p className="feld-hinweis">{t.untertitel}</p>
        </div>
        <button className="knopf-sekundaer knopf-klein" onClick={laden}>
          {t.aktualisieren}
        </button>
      </div>
      {!daten && <p className="feld-hinweis">{t.laedt}</p>}
      {daten && !projektPfad && (
        <div className="filter-zeile">
          {[
            ['alle', t.filterAlle],
            ...daten.projekte.filter((p) => p.gefunden).map((p) => [p.pfad, p.name])
          ].map(([wert, titel]) => (
            <button
              key={wert}
              className={'filter-chip' + (filter === wert ? ' filter-aktiv' : '')}
              onClick={() => setFilter(wert)}
            >
              {titel}
            </button>
          ))}
        </div>
      )}
      {daten && daten.fehlendeProjekte.length > 0 && !projektPfad && (
        <p className="feld-hinweis">{t.fehlendeProjekte(daten.fehlendeProjekte)}</p>
      )}

      {auswertung && (
        <>
          <h2 className="metrik-abschnitt">{t.lokaleUeberschrift}</h2>
          <p className="feld-hinweis">{t.lokaleErklaerung}</p>
          {auswertung.lokal.zeilen.length === 0 ? (
            <p className="feld-hinweis metrik-leer">
              {filter === 'alle' ? t.lokaleLeer : t.lokaleLeerGefiltert}
            </p>
          ) : (
            <>
              <LokaleKiTabelle zeilen={auswertung.lokal.zeilen} />
              <p className="feld-hinweis">{t.quoteHinweis}</p>
            </>
          )}

          <h2 className="metrik-abschnitt">{t.motorUeberschrift}</h2>
          <p className="feld-hinweis">{t.motorErklaerung}</p>
          {auswertung.laeufe === 0 ? (
            <p className="feld-hinweis metrik-leer">{t.motorLeer}</p>
          ) : (
            <>
              <p className="metrik-gesamt">{t.gesamtZeile(auswertung.motor.gesamt)}</p>

              {/* Harness-Kennzahlen (BAUPLAN 36): Score UND Kosten messen. */}
              <h3 className="metrik-unterabschnitt">{t.harnessUeberschrift}</h3>
              <p className="feld-hinweis">{t.harnessErklaerung}</p>
              <div className="kennzahl-reihe">
                <KennzahlKachel
                  titel={t.harnessErstbestehen}
                  wert={quoteText(auswertung.harness.gesamt.erstbestehenQuote)}
                  hinweis={t.harnessErstbestehenHinweis(
                    auswertung.harness.gesamt.mitPruefung,
                    auswertung.harness.gesamt.laeufe
                  )}
                />
                <KennzahlKachel
                  titel={t.harnessReparatur}
                  wert={zahlText(auswertung.harness.gesamt.reparaturJeLauf)}
                  hinweis={t.harnessReparaturHinweis}
                />
                <KennzahlKachel
                  titel={t.harnessRechte}
                  wert={zahlText(auswertung.harness.gesamt.rechteJeLauf)}
                />
                <KennzahlKachel
                  titel={t.harnessFolgen}
                  wert={zahlText(auswertung.harness.gesamt.folgenJeLauf)}
                />
                <KennzahlKachel
                  titel={t.harnessUebertraege}
                  wert={zahlText(auswertung.harness.gesamt.uebertraegeJeLauf)}
                />
                <KennzahlKachel
                  titel={t.harnessZusammenfassungen}
                  wert={zahlText(auswertung.harness.gesamt.zusammenfassungenJeLauf)}
                  hinweis={t.harnessZusammenfassungenHinweis(
                    auswertung.harness.gesamt.ohneZusammenfassungsAngabe
                  )}
                />
              </div>
              <h4 className="metrik-unterabschnitt">{t.harnessJeKetteUeberschrift}</h4>
              <HarnessTabelle
                zeilen={auswertung.harness.jeKette}
                ersteSpalte={t.spalteKette}
                beschriftung={(z) => z.kette}
              />
              <h4 className="metrik-unterabschnitt">{t.harnessJeWocheUeberschrift}</h4>
              <HarnessTabelle
                zeilen={auswertung.harness.jeWoche}
                ersteSpalte={t.spalteWoche}
                beschriftung={(z) => t.wocheLabel(z.nummer, datumKurz(z.montag), datumKurz(z.sonntag))}
              />

              <h3 className="metrik-unterabschnitt">{t.jeBlockUeberschrift}</h3>
              <p className="feld-hinweis">{t.jeBlockErklaerung}</p>
              <BlockTabelle zeilen={auswertung.motor.jeBlock} />

              {/* Modell je Block (BAUPLAN 36): Wer hat wirklich gearbeitet? */}
              <h3 className="metrik-unterabschnitt">{t.jeModellUeberschrift}</h3>
              <p className="feld-hinweis">{t.jeModellErklaerung}</p>
              <BlockModellTabelle zeilen={auswertung.jeModell} />

              <h3 className="metrik-unterabschnitt">{t.jeKetteUeberschrift}</h3>
              <SummenTabelle
                zeilen={auswertung.motor.jeKette}
                ersteSpalte={t.spalteKette}
                beschriftung={(z) => z.kette}
              />

              {filter === 'alle' && (
                <>
                  <h3 className="metrik-unterabschnitt">{t.jeProjektUeberschrift}</h3>
                  <SummenTabelle
                    zeilen={auswertung.motor.jeProjekt}
                    ersteSpalte={t.spalteProjekt}
                    beschriftung={(z) => nameVon(z.projektPfad)}
                  />
                </>
              )}

              <h3 className="metrik-unterabschnitt">{t.jeWocheUeberschrift}</h3>
              <p className="feld-hinweis">{t.jeWocheErklaerung}</p>
              <WochenBalken wochen={auswertung.motor.jeWoche} />
            </>
          )}
        </>
      )}
    </section>
  )
}
