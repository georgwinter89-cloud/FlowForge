import { useEffect, useState } from 'react'
import { texte } from '../../shared/texte.js'
import { eigeneBloeckeSetzen } from '../../shared/blockKatalog.js'
import { THEMEN_SORTEN, themaSchluessel, vorhandeneThemen, THEMA_MAX } from '../../shared/kartenRegeln.js'
import KartenFormular from './KartenFormular.jsx'
import Bestaetigung from './Bestaetigung.jsx'
import Leinwand from './Leinwand.jsx'
import Blockbibliothek from './Blockbibliothek.jsx'
import BlockEditor from './BlockEditor.jsx'
import ProjektEinstellungen from './ProjektEinstellungen.jsx'
import { useKlappen, Klappe } from './klappen.jsx'

const t = texte.projektansicht
const tk = texte.karten
const tst = texte.startanleitung
const th = texte.karten.herkunft

// Zeitangabe in Alltagssprache für die Herkunfts-Kopfzeile (BAUPLAN 30).
function relativeZeit(iso) {
  const dann = new Date(iso).getTime()
  if (!Number.isFinite(dann)) return ''
  const minuten = Math.max(0, Math.round((Date.now() - dann) / 60000))
  if (minuten < 1) return th.geradeEben
  if (minuten < 60) return th.vorMinuten(minuten)
  const stunden = Math.round(minuten / 60)
  if (stunden < 24) return th.vorStunden(stunden)
  return th.vorTagen(Math.round(stunden / 24))
}

function laufZeitText(iso) {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit' }) + ', ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

// „von dir" · „von Sessionende bei ‚Login bauen' (Lauf 14.08., 11:08)"
function herkunftText(h) {
  if (!h) return ''
  const teile = []
  if (h.quelle === 'nutzer') teile.push(th.vonDir)
  else if (h.quelle === 'chat') teile.push(th.vomChat)
  else if (h.quelle === 'kartenpruefer')
    // Übernommener Vorschlag — im Sortiermodus heißt der Block anders.
    teile.push(h.block && h.block !== 'Karten-Prüfer' ? th.vonBlock(h.block) : th.vomKartenPruefer)
  else if (h.quelle === 'flowforge') teile.push(th.vonFlowForge)
  else if (h.quelle === 'block') teile.push(th.vonBlock(h.block ?? '?'))
  if (h.aufgaben?.length) teile.push(th.bei(h.aufgaben.map((a) => a.titel)))
  if (h.laufStart) teile.push(`(${th.lauf(laufZeitText(h.laufStart))})`)
  return teile.join(' ')
}

// Kompakte Kopfzeile unter dem Titel (BAUPLAN 30): „geändert vor 2 Std. ·
// angelegt von … (Lauf …)" — klickbar zum Laufbericht. Alte Karten ohne
// Herkunft zeigen nur das Datum.
function HerkunftZeile({ karte, onZumBericht }) {
  const zeit = relativeZeit(karte.geaendertAm ?? karte.angelegtAm)
  const geaendert = karte.geaendertVon
  const angelegt = karte.angelegtVon
  const teile = []
  if (zeit) teile.push({ text: `${th.geaendert} ${zeit}` })
  if (geaendert && geaendert.quelle !== 'nutzer')
    teile.push({ text: `${th.geaendert} ${herkunftText(geaendert)}`, laufId: geaendert.laufId })
  if (angelegt)
    teile.push({ text: `${th.angelegt} ${herkunftText(angelegt)}`, laufId: angelegt.laufId })
  if (teile.length === 0) return null
  return (
    <p className="karte-herkunft">
      {teile.map((teil, idx) => (
        <span key={idx}>
          {idx > 0 && ' · '}
          {teil.laufId ? (
            <button
              className="karte-herkunft-link"
              title={th.zumBericht}
              onClick={() => onZumBericht(teil.laufId)}
            >
              {teil.text}
            </button>
          ) : (
            teil.text
          )}
        </span>
      ))}
    </p>
  )
}

function Karte({ karte, onBearbeiten, onErledigt, onLoeschen, onZumBericht }) {
  const istStatus = karte.sorte === 'status'
  const istAufgabe = karte.sorte === 'aufgabe'
  return (
    <div
      className={'karte karte-' + karte.sorte + (karte.erledigt ? ' karte-erledigt' : '')}
      // Kartenvorauswahl (SPEC §5): Karten lassen sich in den Lauf-Kontext auf
      // der Leinwand ziehen — und (BAUPLAN 30) in eine andere Themengruppe.
      // Die Status-Karte ist ohnehin immer dabei.
      draggable={!istStatus}
      onDragStart={
        istStatus
          ? undefined
          : (e) => e.dataTransfer.setData('text/flowforge-karte', karte.id)
      }
    >
      <div className="karte-kopf">
        <span className="karte-sorte">{tk.sorten[karte.sorte]}</span>
        {istAufgabe && (
          <span className="karte-zustand">{karte.erledigt ? tk.erledigt : tk.offen}</span>
        )}
      </div>
      <p className="karte-titel">{karte.titel}</p>
      <HerkunftZeile karte={karte} onZumBericht={onZumBericht} />
      <p className="karte-text">{karte.text}</p>
      <div className="karte-knoepfe">
        {istAufgabe && (
          <button className="knopf-klein" onClick={() => onErledigt(karte)}>
            {karte.erledigt ? tk.wiederOeffnen : tk.erledigen}
          </button>
        )}
        <button className="knopf-klein" onClick={() => onBearbeiten(karte)}>
          {tk.bearbeiten}
        </button>
        {!istStatus && (
          <button className="knopf-klein" onClick={() => onLoeschen(karte)}>
            {tk.loeschen}
          </button>
        )}
      </div>
    </div>
  )
}

// Themen als zweite Ebene (BAUPLAN 30) in „Arbeit" und „Wissen": je Thema eine
// Klappe (Drop-Ziel fürs Verschieben, umbenennbar); Karten ohne Thema unter
// „Sonstiges". Hat die Gruppe noch gar kein Thema, liegen die Karten flach.
function ThemenGruppe({ gruppe, karten, istOffen, umschalten, onThemaSetzen, onThemaUmbenennen, kartenProps }) {
  const themen = vorhandeneThemen(karten).sort((a, b) => a.localeCompare(b, 'de'))
  if (themen.length === 0)
    return karten.map((karte) => <Karte key={karte.id} karte={karte} {...kartenProps} />)
  const ohne = karten.filter((k) => !k.thema)
  const abschnitte = themen.map((thema) => ({
    thema,
    schluessel: themaSchluessel(thema),
    karten: karten.filter((k) => k.thema && themaSchluessel(k.thema) === themaSchluessel(thema))
  }))
  if (ohne.length) abschnitte.push({ thema: tk.sonstiges, schluessel: '', karten: ohne, sonstiges: true })
  return abschnitte.map((abschnitt) => {
    const klappenId = `thema:${gruppe}:${abschnitt.schluessel}`
    return (
      <div
        key={klappenId}
        className="thema-klappe"
        title={abschnitt.sonstiges ? undefined : tk.themaZielHinweis}
        onDragOver={abschnitt.sonstiges ? undefined : (e) => {
          if (e.dataTransfer.types.includes('text/flowforge-karte')) e.preventDefault()
        }}
        onDrop={abschnitt.sonstiges ? undefined : (e) => {
          const id = e.dataTransfer.getData('text/flowforge-karte')
          if (!id) return
          e.preventDefault()
          onThemaSetzen(id, abschnitt.thema)
        }}
      >
        <Klappe
          titel={abschnitt.thema}
          anzahl={abschnitt.karten.length}
          offen={istOffen(klappenId)}
          onUmschalten={() => umschalten(klappenId)}
          rechts={
            abschnitt.sonstiges ? null : (
              <button
                className="knopf-klein"
                title={tk.themaUmbenennen}
                onClick={() => onThemaUmbenennen(abschnitt.thema)}
              >
                ✎
              </button>
            )
          }
        >
          {abschnitt.karten.map((karte) => (
            <Karte key={karte.id} karte={karte} {...kartenProps} />
          ))}
        </Klappe>
      </div>
    )
  })
}

export default function Projektansicht({ pfad, initialTab }) {
  const [projekt, setProjekt] = useState(null)
  const [karten, setKarten] = useState([])
  const [fehler, setFehler] = useState('')
  const [filter, setFilter] = useState('alle')
  // false = zu, 'neu' = neue Karte, sonst die Karte, die bearbeitet wird
  const [formular, setFormular] = useState(false)
  // Startanleitung (SPEC §8): null = noch keine — der Knopf bleibt grau.
  const [anleitung, setAnleitung] = useState(null)
  // App-Tab (BAUPLAN 32): der Kopf-Knopf springt in den Tab und startet dort
  // (Zähler als Anstoß); läuft die App schon, springt er nur.
  const [appSprung, setAppSprung] = useState(0)
  const [appLaeuft, setAppLaeuft] = useState(false)
  // Eigene Blöcke (SPEC §4.5, BAUPLAN 14): null = noch nicht geladen — erst
  // dann rendert die Leinwand, sonst könnte sie eigene Blöcke im Schaubild
  // nicht auflösen. false = Editor zu, 'neu' = neuer Block, sonst der Block.
  const [eigene, setEigene] = useState(null)
  const [blockEditor, setBlockEditor] = useState(false)
  // Projekt-Einstellungen (BAUPLAN 15): zeigen den Rechte-Standard des Agenten.
  const [einstellungenOffen, setEinstellungenOffen] = useState(false)
  // Eigener Bestätigungs-Dialog statt window.confirm/alert (Bugfix 13.08.2026):
  // null = zu, sonst { frage, knopf, gefahr, aktion } — ohne aktion nur Hinweis.
  const [bestaetigung, setBestaetigung] = useState(null)
  // Thema umbenennen (BAUPLAN 30): null = zu, sonst { alt, wert, fehler }.
  const [themaDialog, setThemaDialog] = useState(null)
  // Sprung zum Laufbericht aus der Herkunfts-Kopfzeile (BAUPLAN 30): { laufId, n }.
  const [berichtSprung, setBerichtSprung] = useState(null)
  // Läuft oder wartet das Projekt? Dann sind die Aufräum-Knöpfe gesperrt.
  const [laufAktiv, setLaufAktiv] = useState(false)
  const [aufraeumFehler, setAufraeumFehler] = useState('')
  // Einklapp-Zustände je Projekt (BAUPLAN 30): „Erledigt" ist standardmäßig zu.
  const [istOffen, umschalten] = useKlappen(pfad, ['karten:erledigt'])

  function projektLaden() {
    window.flowforge.projektOeffnen(pfad).then((ergebnis) => {
      if (!ergebnis.ok) return setFehler(ergebnis.fehler)
      setProjekt(ergebnis.projekt)
      setKarten(ergebnis.karten)
    })
    // Auch nach einer Wiederherstellung kann die Startanleitung auftauchen
    // oder verschwinden — deshalb hier mitgeladen.
    window.flowforge.startanleitungLaden(pfad).then((ergebnis) => {
      if (ergebnis.ok) setAnleitung(ergebnis.anleitung)
    })
  }

  useEffect(projektLaden, [pfad])

  useEffect(() => {
    window.flowforge.eigeneBloeckeLaden().then((ergebnis) => {
      if (!ergebnis.ok) return
      eigeneBloeckeSetzen(ergebnis.bloecke)
      setEigene(ergebnis.bloecke)
    })
  }, [])

  useEffect(() => {
    window.flowforge.laufZustand(pfad).then((e) => {
      if (e.ok) setLaufAktiv(Boolean(e.aktiv || e.wartet))
    })
  }, [pfad])

  // Jede Änderung an eigenen Blöcken liefert den neuen Gesamtstand zurück —
  // Registry zuerst, damit Leinwand und Regeln beim Neu-Rendern schon stimmen.
  function eigeneUebernehmen(ergebnis) {
    if (ergebnis.ok) {
      eigeneBloeckeSetzen(ergebnis.bloecke)
      setEigene(ergebnis.bloecke)
      setBlockEditor(false)
    }
    return ergebnis
  }

  async function blockSpeichern(block) {
    return eigeneUebernehmen(await window.flowforge.eigenenBlockSpeichern(block))
  }

  function blockLoeschen(block) {
    setBestaetigung({
      frage: texte.blockEditor.loeschenBestaetigung(block.name),
      knopf: texte.bestaetigung.loeschen,
      gefahr: true,
      aktion: async () => {
        const ergebnis = eigeneUebernehmen(await window.flowforge.eigenenBlockLoeschen(block.id))
        // Lösch-Sperre (BAUPLAN 14): liegt der Block noch auf einer Leinwand,
        // lehnt der Hauptprozess ab — mit den Projektnamen.
        if (!ergebnis.ok) setBestaetigung({ frage: ergebnis.fehler })
      }
    })
  }

  // Der Agent kann Karten und Startanleitung mitten im Lauf ändern —
  // Seitenleiste und „App starten"-Knopf ziehen sofort nach.
  useEffect(() => {
    return window.flowforge.aufLaufEreignis((ereignis) => {
      // Läufe-Übersicht (BAUPLAN 12): kommt ohne Projektpfad — daraus wissen
      // die Aufräum-Knöpfe, ob dieses Projekt gerade läuft oder wartet.
      if (ereignis.art === 'laeufe') {
        setLaufAktiv(ereignis.aktive.includes(pfad) || ereignis.warteschlange.includes(pfad))
        return
      }
      if (ereignis.projektPfad !== pfad) return
      if (ereignis.art === 'karten') setKarten(ereignis.karten)
      if (ereignis.art === 'startanleitung') setAnleitung(ereignis.anleitung)
      if (ereignis.art === 'zustand' && ereignis.zustand === 'laeuft') setLaufAktiv(true)
      // Nach dem Laufende sicherheitshalber frisch laden — ein harter Abbruch
      // kann die Startanleitung per Sicherungspunkt zurückgedreht haben.
      if (ereignis.art === 'fertig') {
        setLaufAktiv(false)
        window.flowforge.startanleitungLaden(pfad).then((ergebnis) => {
          if (ergebnis.ok) setAnleitung(ergebnis.anleitung)
        })
      }
    })
  }, [pfad])

  function appStarten() {
    setAppSprung((n) => n + 1)
  }

  // Jede Kartenänderung liefert den neuen Gesamtstand zurück.
  function uebernehmen(ergebnis) {
    if (ergebnis.ok) {
      setKarten(ergebnis.karten)
      setFormular(false)
    }
    return ergebnis
  }

  async function speichern(eingabe) {
    const ergebnis =
      formular === 'neu'
        ? await window.flowforge.karteAnlegen(pfad, eingabe)
        : await window.flowforge.karteAendern(pfad, formular.id, eingabe)
    return uebernehmen(ergebnis)
  }

  async function erledigtWechseln(karte) {
    uebernehmen(await window.flowforge.karteErledigtSetzen(pfad, karte.id, !karte.erledigt))
  }

  function loeschen(karte) {
    // Löschen einer Prüfkarte räumt ihre aufbewahrten Prüfdateien mit weg
    // (BAUPLAN 18) — die Rückfrage sagt das ehrlich dazu.
    setBestaetigung({
      frage:
        karte.sorte === 'pruefung' ? tk.loeschenBestaetigungPruefung : tk.loeschenBestaetigung,
      knopf: texte.bestaetigung.loeschen,
      gefahr: true,
      aktion: async () => uebernehmen(await window.flowforge.karteLoeschen(pfad, karte.id))
    })
  }

  // Themen (BAUPLAN 30): Karte per Drag & Drop in ein anderes Thema.
  async function themaSetzen(kartenId, thema) {
    const ergebnis = await window.flowforge.karteThemaSetzen(pfad, kartenId, thema)
    if (ergebnis.ok) setKarten(ergebnis.karten)
    else setBestaetigung({ frage: ergebnis.fehler })
  }

  async function themaUmbenennenSpeichern() {
    if (!themaDialog) return
    const ergebnis = await window.flowforge.themaUmbenennen(pfad, themaDialog.alt, themaDialog.wert)
    if (!ergebnis.ok) return setThemaDialog({ ...themaDialog, fehler: ergebnis.fehler })
    setKarten(ergebnis.karten)
    setThemaDialog(null)
  }

  // Aufräum-Knöpfe (BAUPLAN 30): Sonderlauf im Hintergrund — der Lauf-Tab
  // springt über das Lauf-Ereignis von selbst auf.
  async function sonderlaufStarten(art) {
    setAufraeumFehler('')
    const ergebnis = await window.flowforge.sonderlaufStarten(pfad, art)
    if (!ergebnis.ok) setAufraeumFehler(ergebnis.fehler)
  }

  function zumBericht(laufId) {
    setBerichtSprung((alt) => ({ laufId, n: (alt?.n ?? 0) + 1 }))
  }

  // Kontingent-Verhalten pro Projekt (SPEC §5): pausieren oder anhalten.
  async function kontingentVerhaltenSetzen(verhalten) {
    const ergebnis = await window.flowforge.kontingentVerhaltenSetzen(pfad, verhalten)
    if (ergebnis.ok)
      setProjekt((alt) => alt && { ...alt, kontingentVerhalten: ergebnis.kontingentVerhalten })
  }

  if (fehler) {
    return (
      <section className="projektansicht">
        <p className="fehlermeldung">{fehler}</p>
      </section>
    )
  }

  const statusKarte = karten.find((k) => k.sorte === 'status')
  const gefiltert = karten
    .filter((k) => k.sorte !== 'status')
    .filter((k) => filter === 'alle' || k.sorte === filter)
  // Feste Karten-Gruppen (BAUPLAN 30) — ergeben sich aus der Sorte, nichts zu
  // pflegen: Arbeit (offene Aufgaben) · Wissen (Entscheidungen + Wissen) ·
  // Geprüft (Prüfkarten) · Erledigt (erledigte Aufgaben, standardmäßig zu).
  const gruppen = [
    { id: 'arbeit', karten: gefiltert.filter((k) => k.sorte === 'aufgabe' && !k.erledigt), themen: true },
    { id: 'wissen', karten: gefiltert.filter((k) => k.sorte === 'entscheidung' || k.sorte === 'wissen'), themen: true },
    { id: 'geprueft', karten: gefiltert.filter((k) => k.sorte === 'pruefung') },
    { id: 'erledigt', karten: gefiltert.filter((k) => k.sorte === 'aufgabe' && k.erledigt) }
  ].filter((g) => filter === 'alle' || g.karten.length > 0)
  const kartenProps = {
    onBearbeiten: setFormular,
    onErledigt: erledigtWechseln,
    onLoeschen: loeschen,
    onZumBericht: zumBericht
  }
  const alleThemen = vorhandeneThemen(karten)

  return (
    <section className="projektansicht">
      <div className="ansicht-kopf">
        <h1>{projekt?.name}</h1>
        <div className="kopf-rechts">
          <button
            className="knopf-sekundaer knopf-klein"
            onClick={() => setEinstellungenOffen(true)}
          >
            {t.einstellungenKnopf}
          </button>
          <button
            className="knopf-primaer"
            disabled={!anleitung}
            title={anleitung ? anleitung.beschreibung : tst.keineHinweis}
            onClick={appStarten}
          >
            ▶ {appLaeuft ? tst.knopfLaeuft : tst.knopf}
          </button>
        </div>
      </div>
      <div className="drei-spalten">
        <aside className="spalte spalte-karten">
          <div className="spalten-kopf">
            <h2>{tk.ueberschrift}</h2>
            <button className="knopf-primaer knopf-klein" onClick={() => setFormular('neu')}>
              + {tk.neueKarte}
            </button>
          </div>
          <div className="filter-zeile">
            {['alle', 'aufgabe', 'entscheidung', 'wissen', 'pruefung'].map((wert) => (
              <button
                key={wert}
                className={'filter-chip' + (filter === wert ? ' filter-aktiv' : '')}
                onClick={() => setFilter(wert)}
              >
                {wert === 'alle' ? tk.filterAlle : tk.sorten[wert]}
              </button>
            ))}
          </div>
          {/* Aufräum-Knöpfe (Entscheidung Georg, 15.08.2026): Aufräumen gehört
              zu den Karten, nicht aufs Schaubild — je ein Sonderlauf. */}
          <div className="aufraeum-zeile" title={laufAktiv ? tk.sonderlaufGesperrt : undefined}>
            <button
              className="knopf-sekundaer knopf-klein"
              disabled={laufAktiv}
              title={tk.kartenPruefenHinweis}
              onClick={() => sonderlaufStarten('karten-pruefen')}
            >
              📇 {tk.kartenPruefenKnopf}
            </button>
            <button
              className="knopf-sekundaer knopf-klein"
              disabled={laufAktiv}
              title={tk.themenSortierenHinweis}
              onClick={() => sonderlaufStarten('themen-sortieren')}
            >
              🗂 {tk.themenSortierenKnopf}
            </button>
          </div>
          {aufraeumFehler && <p className="fehlermeldung">{aufraeumFehler}</p>}
          <div className="karten-liste">
            {statusKarte && <Karte karte={statusKarte} {...kartenProps} />}
            {gruppen.map((gruppe) => (
              <Klappe
                key={gruppe.id}
                titel={tk.gruppen[gruppe.id]}
                anzahl={gruppe.karten.length}
                offen={istOffen('karten:' + gruppe.id)}
                onUmschalten={() => umschalten('karten:' + gruppe.id)}
              >
                {gruppe.karten.length === 0 && <p className="feld-hinweis">{tk.keineKarten}</p>}
                {gruppe.themen ? (
                  <ThemenGruppe
                    gruppe={gruppe.id}
                    karten={gruppe.karten}
                    istOffen={istOffen}
                    umschalten={umschalten}
                    onThemaSetzen={themaSetzen}
                    onThemaUmbenennen={(thema) => setThemaDialog({ alt: thema, wert: thema, fehler: '' })}
                    kartenProps={kartenProps}
                  />
                ) : (
                  gruppe.karten.map((karte) => <Karte key={karte.id} karte={karte} {...kartenProps} />)
                )}
              </Klappe>
            ))}
            {gruppen.length === 0 && <p className="feld-hinweis">{tk.keineKarten}</p>}
          </div>
        </aside>
        <div className="spalte spalte-leinwand">
          <div className="spalten-kopf">
            <h2>{t.leinwandTitel}</h2>
          </div>
          {/* Nach einer Wiederherstellung kann sich karten.json geändert haben.
              Erst rendern, wenn die eigenen Blöcke in der Registry sind —
              sonst könnte das Schaubild eigene Blöcke nicht auflösen. */}
          {eigene !== null && (
            <Leinwand
              pfad={pfad}
              initialTab={initialTab}
              karten={karten}
              berichtSprung={berichtSprung}
              anleitung={anleitung}
              appSprung={appSprung}
              onAppZustand={(z) => setAppLaeuft(Boolean(z?.laeuft || z?.startet))}
              kontingentVerhalten={projekt?.kontingentVerhalten ?? 'pausieren'}
              onKontingentVerhalten={kontingentVerhaltenSetzen}
              onWiederhergestellt={projektLaden}
            />
          )}
        </div>
        <aside className="spalte spalte-bibliothek">
          <div className="spalten-kopf">
            <h2>{t.bibliothekTitel}</h2>
          </div>
          <Blockbibliothek
            pfad={pfad}
            eigene={eigene ?? []}
            onNeuerBlock={() => setBlockEditor('neu')}
            onBearbeiten={setBlockEditor}
            onLoeschen={blockLoeschen}
          />
        </aside>
      </div>
      {formular && (
        <KartenFormular
          karte={formular === 'neu' ? null : formular}
          themen={alleThemen}
          onSpeichern={speichern}
          onAbbrechen={() => setFormular(false)}
        />
      )}
      {themaDialog && (
        <div className="dialog-schleier">
          <div className="dialog">
            <h2>{tk.themaUmbenennen}</h2>
            <p className="feld-hinweis">{tk.themaUmbenennenFrage(themaDialog.alt)}</p>
            <label className="feld">
              <input
                autoFocus
                list="themen-liste"
                maxLength={THEMA_MAX}
                value={themaDialog.wert}
                onChange={(e) => setThemaDialog({ ...themaDialog, wert: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && themaUmbenennenSpeichern()}
              />
            </label>
            {themaDialog.fehler && <p className="fehlermeldung">{themaDialog.fehler}</p>}
            <div className="dialog-knoepfe">
              <button className="knopf-sekundaer" onClick={() => setThemaDialog(null)}>
                {texte.kartenFormular.abbrechen}
              </button>
              <button className="knopf-primaer" onClick={themaUmbenennenSpeichern}>
                {tk.themaUmbenennenKnopf}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Vorhandene Themen als Vorschlagsliste für alle Themen-Eingaben. */}
      <datalist id="themen-liste">
        {alleThemen.map((thema) => (
          <option key={thema} value={thema} />
        ))}
      </datalist>
      {blockEditor && (
        <BlockEditor
          block={blockEditor === 'neu' ? null : blockEditor}
          onSpeichern={blockSpeichern}
          onAbbrechen={() => setBlockEditor(false)}
        />
      )}
      {einstellungenOffen && (
        <ProjektEinstellungen onSchliessen={() => setEinstellungenOffen(false)} />
      )}
      {bestaetigung && (
        <Bestaetigung
          frage={bestaetigung.frage}
          knopf={bestaetigung.knopf}
          gefahr={bestaetigung.gefahr}
          onBestaetigen={() => {
            const aktion = bestaetigung.aktion
            setBestaetigung(null)
            aktion?.()
          }}
          onAbbrechen={bestaetigung.aktion ? () => setBestaetigung(null) : null}
        />
      )}
    </section>
  )
}
