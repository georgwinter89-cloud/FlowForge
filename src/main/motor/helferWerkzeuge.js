// Lokale Helfer-KI als Agenten-Werkzeug (Experiment, Wunsch Georg 13.08.2026):
// Block-Agenten delegieren reine Recherche-Aufträge an die lokale KI (Ollama)
// statt an eine Motor-Unteraufgabe — kostet kein Abo-Kontingent. Das Werkzeug
// ist rein lesend (die lokale KI kann nur auflisten, lesen, suchen — hart im
// Code begrenzt) und deshalb auch unter der Sperre „darf nur lesen" erlaubt.
//
// Lokale Entwürfe (BAUPLAN 21): Dazu kommen lokal_entwerfen (schablonenhafte
// Schreibarbeit mit Vorbild — der Entwurf landet ausschließlich in der
// arbeitsablage/) und entwurf_abnehmen (die ausdrückliche Abnahme-Meldung des
// Block-Agenten: übernommen oder verworfen — ungeprüft zählt nichts). Beide
// sind Schreibarbeit und unter „darf nur lesen" gesperrt (claudeCodeMotor).
//
// Lokaler Bauer (BAUPLAN 22): lokal_bauen delegiert einen eng umrissenen,
// einzeln prüfbaren Bau-Teilauftrag an die lokale KI — mit echtem Schreibrecht
// im Projektordner. FlowForge legt vor jedem Teilauftrag einen Sicherungspunkt
// an; die Abnahme meldet der Block-Agent mit teilstueck_abnehmen, und bei
// „nicht gehalten" rollt FlowForge den Stand zurück, BEVOR der Agent selbst
// baut (Mechanik aus Bauschritt 20 wiederverwendet). Die Reihenfolge ist
// erzwungen: erst abnehmen, dann das nächste Teilstück — sonst wäre der
// Rückroll-Punkt nicht mehr eindeutig.
import { z } from 'zod'
import { texte } from '../../shared/texte.js'
import { lokalBauen, lokalEntwerfen, lokalRecherchieren } from './lokaleHelfer.js'
import {
  sicherungspunktAnlegen,
  aufLetztenPunktZuruecksetzen,
  letzterPunktId
} from '../sicherungspunkte.js'

// bewerten (BAUPLAN 23): Ist der Trefferquoten-Schalter an, bekommt der
// Block-Agent das Pflicht-Werkzeug recherche_bewerten nach jedem
// lokal_recherchieren — erst damit ist die Kosten-Wette der lokalen KI über
// alle drei Helfer-Arten ehrlich messbar. Ist er aus, gibt es weder Werkzeug
// noch Hinweis: kein Mehrverbrauch.
// holeProjektwissen (BAUPLAN 25): liefert die Kartenauswahl des Laufs als
// Abschnitt „Projektwissen" — FlowForge stellt sie jedem lokalen Auftrag
// voran. Grund: Die lokale KI kann keine Rückfragen stellen (Einweg-
// Kreisläufe); was nicht im Auftrag steht, existiert für sie nicht —
// Festlegungen aus Entscheidungs-Karten würden sonst übergangen. Je Aufruf
// frisch gelesen, denn die Kartenauswahl wächst mitten im Lauf.
// holeSicherung (BAUPLAN 45): liefert Strang, geschützte Bereiche und den
// eigenen Wirkbereich des GERADE laufenden Blocks —
// { kennung, bezeichnung, strang, geschuetzt, eigenerBereich }.
// Sicherungspunkte und Rollbacks der lokalen Helfer laufen darauf; ohne Strang
// (Block ohne Wirkbereich) verhält sich alles wie vor Bauschritt 45. Der
// eigene Wirkbereich ist die Notbremse, wenn ein anderer Block seit dem
// Rückroll-Punkt zusammengeführt hat: Dann wird nur noch darin zurückgenommen.
export async function helferWerkzeugServer({ projektPfad, modell, adresse, bewerten = false, holeProjektwissen = null, holeSicherung = null, aufEreignis }) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')

  function mitProjektwissen(auftrag) {
    try {
      return (holeProjektwissen?.() ?? '') + String(auftrag ?? '')
    } catch {
      // Ein klemmender Kartenblick darf den lokalen Auftrag nicht verhindern.
      return String(auftrag ?? '')
    }
  }

  // Sicherungspunkte je Schreiber (BAUPLAN 45): Ein klemmender Blick auf den
  // laufenden Block darf den lokalen Auftrag nicht verhindern — dann gilt eben
  // der gemeinsame Stand, wie vor Bauschritt 45.
  function sicherungVonJetzt() {
    try {
      return holeSicherung?.() ?? null
    } catch {
      return null
    }
  }

  // Ein Rollback und seine ehrlichen Folgen an einer Stelle. Der Rückgabewert
  // wurde bis Bauschritt 45 weggeworfen: Der Ticker meldete „zurückgerollt",
  // auch wenn der Rollback an einer gesperrten Datei gescheitert war — und der
  // Agent baute auf einem Stand weiter, den FlowForge für verworfen hielt.
  // Rückgabe: '' = sauber, sonst der Hinweis, den der Agent lesen muss.
  async function zurueckrollen({ strang, geschuetzt, eigenerBereich, punktId }, erfolgsText) {
    // Zeigt die Spitze des Strangs noch auf den gemerkten Punkt? Ein zweiter
    // Anlauf desselben Blocks (Reparatur-Runde) bekommt einen frischen Strang
    // unter demselben Namen — ein Teilstück, das aus dem Anlauf davor offen
    // blieb, würde sonst auf den Stand von JETZT zurückrollen und damit die
    // Arbeit der laufenden Runde wegwerfen. Genau diese Sorte stiller Verlust
    // soll Bauschritt 45 abstellen.
    if (punktId) {
      const spitze = await letzterPunktId(projektPfad, strang ?? null)
      if (spitze && spitze !== punktId) {
        aufEreignis({ art: 'ticker', text: texte.ticker.rollbackPunktVerschoben })
        return texte.agentenLokaleHelfer.rollbackPunktVerschobenHinweis
      }
    }
    const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad, {
      strang: strang ?? null,
      geschuetzt: geschuetzt ?? [],
      // Die zweite Bremse (Nacharbeit zu BAUPLAN 45): Hat ein anderer Block seit
      // diesem Punkt seine fertige Runde zusammengeführt, nähme ein voller
      // Rückroll sie mit. Dann wird nur noch im eigenen Wirkbereich
      // zurückgenommen — und beide erfahren davon, Georg unten im Ticker und
      // der Agent über den Rückgabewert.
      eigenerBereich: eigenerBereich ?? null
    })
    if (!zurueck.ok) {
      aufEreignis({ art: 'ticker', text: texte.ticker.rollbackGescheitert })
      return texte.agentenLokaleHelfer.rollbackGescheitertHinweis
    }
    // Der Erfolgs-Satz nur, wenn wirklich etwas zurückging — wie beim Zwilling
    // in lauf.js. Gemessen: Lag das Gebastel vollständig im geschützten Bereich
    // eines anderen Blocks, meldete der Ticker „der Stand ist wieder sauber",
    // während die Datei unverändert auf der Platte lag.
    //
    // Und der Gegenzweig, ebenfalls wie in lauf.js: Ging gar nichts zurück,
    // sagt der Ticker genau das. Sonst erfährt es nur der Agent (Rückgabewert
    // unten), und Georg liest von dem Versuch überhaupt nichts mehr. Ein
    // Rückroll ist hier immer versprochen — beide Aufrufer geben einen
    // Erfolgs-Satz mit.
    //
    // Welcher der beiden „nichts"-Sätze fällt, entscheidet sich an denselben
    // Zahlen wie im Zwilling (zurueckrollenAn in lauf.js): Blieb etwas stehen —
    // fremdes Revier oder überholter Anker —, dann WAR etwas zurückzunehmen, und
    // der verworfene Stand liegt weiter sichtbar im Ordner. Nur ohne jede
    // übersprungene Datei stimmt der Satz „stand schon auf dem Sicherungspunkt".
    if (erfolgsText)
      aufEreignis({
        art: 'ticker',
        text:
          zurueck.zurueckgesetzt === false
            ? (zurueck.geschuetztUebersprungen ?? 0) + (zurueck.fremdUebersprungen ?? 0) > 0
              ? texte.ticker.rollbackNichtsAngefasst
              : texte.ticker.rollbackNichtsZurueckgenommen
            : erfolgsText
      })
    // Beide Zeilen werden getickert, wenn beides zutraf — der Agent bekommt
    // dagegen EINEN Hinweis, und das ist der überholte Stand: Er sagt ihm, dass
    // fremde fertige Arbeit im Ordner steht, mit der er rechnen muss.
    if (zurueck.geschuetztUebersprungen > 0)
      aufEreignis({
        art: 'ticker',
        text: texte.ticker.rollbackGeschuetzt(zurueck.geschuetztUebersprungen)
      })
    if (zurueck.standUeberholt && zurueck.fremdUebersprungen > 0) {
      aufEreignis({
        art: 'ticker',
        text: texte.ticker.rollbackStandUeberholt(zurueck.fremdUebersprungen)
      })
      return texte.agentenLokaleHelfer.rollbackStandUeberholtHinweis(zurueck.fremdUebersprungen)
    }
    // Georg liest den Ticker, der Agent nicht: Ohne diesen Rückgabewert endet
    // seine Werkzeug-Antwort bei „der Projektstand ist sauber" und er baut auf
    // Resten weiter, die FlowForge absichtlich stehengelassen hat.
    if (zurueck.geschuetztUebersprungen > 0)
      return texte.agentenLokaleHelfer.rollbackGeschuetztHinweis(zurueck.geschuetztUebersprungen)
    if (zurueck.zurueckgesetzt === false)
      return texte.agentenLokaleHelfer.rollbackNichtsGefundenHinweis
    return ''
  }

  // Metriken (BAUPLAN 31): Die Urteile (bewerten/abnehmen) fallen nach dem
  // Kreislauf — sie tragen die Schritte des jeweils letzten Kreislaufs ihrer
  // Art mit, damit die Metrik-Datei Urteil und Aufwand zusammen sieht.
  let letzteRechercheSchritte = 0
  let letzteEntwurfSchritte = 0
  let letzteBauSchritte = 0

  const recherchieren = tool(
    'lokal_recherchieren',
    texte.agentenLokaleHelfer.werkzeugBeschreibung,
    {
      auftrag: z
        .string()
        .describe(
          'Der Recherche-Auftrag in Alltagssprache: was gesucht/gelesen werden soll und welche Fragen das Fazit beantworten muss.'
        )
    },
    async ({ auftrag }) => {
      // Auch hier (BAUPLAN 45): Ist inzwischen ein anderer Block dran, wird ein
      // offen gebliebenes Teilstück jetzt geschlossen — nicht erst, wenn jemand
      // versehentlich darauf zurückrollt.
      blockwechselPruefen()
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferStart(modell) })
      const ergebnis = await lokalRecherchieren({
        projektPfad,
        auftrag: mitProjektwissen(auftrag),
        modell,
        adresse,
        // Detail-Zeilen (BAUPLAN 23): Werkzeug UND Eingabe wandern in den
        // Ticker — Georg liest mit, welche Datei die lokale KI gerade liest.
        aufSchritt: (name, eingabe) =>
          aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferSchritt(name, eingabe) }),
        // Denk-Ansicht (BAUPLAN 24): das Denken der lokalen KI im Denk-Bereich.
        aufDenken: (text) =>
          aufEreignis({ art: 'denken', absender: texte.lauf.denkenLokaleKi, text })
      })
      // Zähl-Ereignis für den Laufbericht (Wunsch Georg, 13.08.2026): So steht
      // der Anteil der lokalen KI schwarz auf weiß im Bericht.
      letzteRechercheSchritte = ergebnis.schritte ?? 0
      aufEreignis({
        art: 'lokale-helfer',
        schritte: ergebnis.schritte ?? 0,
        gescheitert: !ergebnis.ok
      })
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferGescheitert(ergebnis.fehler) })
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.gescheitert(ergebnis.fehler) }],
          isError: true
        }
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleHelferFertig(ergebnis.schritte) })
      return {
        content: [
          {
            type: 'text',
            text:
              texte.agentenLokaleHelfer.fazit(ergebnis.fazit) +
              (bewerten ? texte.agentenLokaleHelfer.bewertenAufforderung : '')
          }
        ]
      }
    },
    { alwaysLoad: true }
  )

  // Trefferquote (BAUPLAN 23): die ausdrückliche Bewertung je Recherche-Fazit
  // — dasselbe Abnahme-Muster wie bei Entwürfen und Teilstücken, aber reine
  // Messung (nichts wird übernommen oder zurückgerollt). Nur registriert,
  // wenn der Schalter an ist.
  const rechercheBewerten = tool(
    'recherche_bewerten',
    texte.agentenLokaleHelfer.bewertenBeschreibung,
    {
      uebernommen: z
        .boolean()
        .describe('true = das Fazit fließt in deine Arbeit ein; false = verworfen, du recherchierst selbst nach.'),
      begruendung: z.string().describe('Ein Satz: warum übernommen oder verworfen.')
    },
    async ({ uebernommen, begruendung }) => {
      aufEreignis({
        art: 'lokale-helfer-recherche-urteil',
        uebernommen: Boolean(uebernommen),
        schritte: letzteRechercheSchritte
      })
      const satz = String(begruendung ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
      aufEreignis({
        art: 'ticker',
        text: uebernommen
          ? texte.ticker.rechercheUebernommen(satz)
          : texte.ticker.rechercheVerworfen(satz)
      })
      return {
        content: [{ type: 'text', text: texte.agentenLokaleHelfer.bewertet(Boolean(uebernommen)) }]
      }
    },
    { alwaysLoad: true }
  )

  // Lokale Entwürfe (BAUPLAN 21): Entwurf lokal, Abnahme beim Block-Agenten.
  const entwerfen = tool(
    'lokal_entwerfen',
    texte.agentenLokaleHelfer.entwerfenBeschreibung,
    {
      auftrag: z
        .string()
        .describe(
          'Der Schreibauftrag in Alltagssprache: was der Entwurf leisten muss — und das Vorbild (Datei), an dem er sich orientieren soll.'
        )
    },
    async ({ auftrag }) => {
      blockwechselPruefen()
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfStart(modell) })
      const ergebnis = await lokalEntwerfen({
        projektPfad,
        auftrag: mitProjektwissen(auftrag),
        modell,
        adresse,
        aufSchritt: (name, eingabe) =>
          aufEreignis({
            art: 'ticker',
            text:
              name === 'entwurf_schreiben'
                ? texte.ticker.lokaleEntwurfSchritt(eingabe?.pfad)
                : texte.ticker.lokaleHelferSchritt(name, eingabe)
          }),
        aufDenken: (text) =>
          aufEreignis({ art: 'denken', absender: texte.lauf.denkenLokaleKi, text })
      })
      const dateien = ergebnis.dateien ?? []
      letzteEntwurfSchritte = ergebnis.schritte ?? 0
      // Zähl-Ereignis für die Lokale-Helfer-Zeile des Laufberichts (BAUPLAN 21):
      // ein Entwurf zählt nur, wenn wirklich eine Entwurfsdatei entstand.
      aufEreignis({
        art: 'lokale-helfer-entwurf',
        schritte: ergebnis.schritte ?? 0,
        entwurf: ergebnis.ok && dateien.length > 0,
        gescheitert: !ergebnis.ok
      })
      if (!ergebnis.ok) {
        aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfGescheitert(ergebnis.fehler) })
        return {
          content: [
            { type: 'text', text: texte.agentenLokaleHelfer.entwerfenGescheitert(ergebnis.fehler) }
          ],
          isError: true
        }
      }
      if (!dateien.length) {
        aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfKeineDatei })
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.entwurfKeineDatei }],
          isError: true
        }
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleEntwurfFertig(dateien, ergebnis.schritte) })
      return {
        content: [
          { type: 'text', text: texte.agentenLokaleHelfer.entwurfFazit(ergebnis.fazit, dateien) }
        ]
      }
    },
    { alwaysLoad: true }
  )

  // Die ausdrückliche Abnahme (BAUPLAN 21): Der Block-Agent meldet je Entwurf,
  // ob er ihn übernommen oder verworfen hat — der Laufbericht zählt mit.
  const abnehmen = tool(
    'entwurf_abnehmen',
    texte.agentenLokaleHelfer.abnehmenBeschreibung,
    {
      entwurf: z
        .string()
        .describe('Die Entwurfsdatei in der arbeitsablage/, um die es geht.'),
      uebernommen: z
        .boolean()
        .describe('true = gegengelesen und selbst an den Zielort übernommen; false = verworfen.')
    },
    async ({ entwurf, uebernommen }) => {
      aufEreignis({
        art: 'lokale-helfer-entwurf-urteil',
        uebernommen: Boolean(uebernommen),
        schritte: letzteEntwurfSchritte
      })
      aufEreignis({
        art: 'ticker',
        text: uebernommen
          ? texte.ticker.entwurfUebernommen(entwurf)
          : texte.ticker.entwurfVerworfen(entwurf)
      })
      return {
        content: [{ type: 'text', text: texte.agentenLokaleHelfer.abgenommen(entwurf, uebernommen) }]
      }
    },
    { alwaysLoad: true }
  )

  // Lokaler Bauer (BAUPLAN 22): das offene Teilstück — gesetzt von lokal_bauen,
  // aufgelöst von teilstueck_abnehmen. Solange es offen ist, ist der neueste
  // Punkt seines Strangs garantiert „Stand vor lokalem Teilstück" — nur darum
  // darf die Abnahme mit dem letzten Punkt zurückrollen.
  //
  // Je BLOCK, nicht je Session (BAUPLAN 45): Dieser Werkzeug-Server wird genau
  // einmal je Motor-Session gebaut, und eine Lauf-Session bedient alle Blöcke
  // nacheinander (BAUPLAN 19). Bis Bauschritt 45 hieß das: Bauer A ließ sein
  // Teilstück offen, Bauer B wurde abgewiesen („erst abnehmen: A's Teilstück"),
  // nahm es mit „nicht gehalten" ab — und rollte damit die Arbeit zurück, die
  // ER seither geschrieben hatte. Der Zustand hängt jetzt am Block, samt seinem
  // Strang und seinen geschützten Bereichen.
  let offenesTeilstueck = null // { kennung, bezeichnung, teilstueck, strang, geschuetzt }

  // Beim Blockwechsel wird ein offener Zustand ehrlich geschlossen: Sein
  // Rückroll-Punkt gehört zum vorigen Block und darf hier nichts mehr auslösen.
  function blockwechselPruefen() {
    const jetzt = sicherungVonJetzt()
    if (offenesTeilstueck && offenesTeilstueck.kennung !== (jetzt?.kennung ?? null)) {
      aufEreignis({
        art: 'ticker',
        text: texte.ticker.teilstueckBeimBlockwechsel(
          offenesTeilstueck.bezeichnung,
          offenesTeilstueck.teilstueck
        )
      })
      offenesTeilstueck = null
    }
    return jetzt
  }

  const bauen = tool(
    'lokal_bauen',
    texte.agentenLokaleHelfer.bauenBeschreibung,
    {
      teilstueck: z
        .string()
        .describe('Kurzname des Teilstücks für Ticker und Abnahme, z.B. "2 von 5: Speichern-Knopf".'),
      auftrag: z
        .string()
        .describe(
          'Der Teilauftrag: Fundstellen oder Vorbild, feste Schnittstellen (welche Datei, welcher Funktionsname, was rein, was raus) und das Fertig-Kriterium.'
        )
    },
    async ({ teilstueck, auftrag }) => {
      const sicherung = blockwechselPruefen()
      if (offenesTeilstueck != null)
        return {
          content: [
            {
              type: 'text',
              text: texte.agentenLokaleHelfer.bauenErstAbnehmen(offenesTeilstueck.teilstueck)
            }
          ],
          isError: true
        }
      // Sicherungspunkt vor jedem Teilauftrag — ohne Rückroll-Punkt baut die
      // lokale KI nicht (dieselbe Regel wie bei der Vorreparatur). Auf den
      // Strang dieses Blocks (BAUPLAN 45).
      const punkt = await sicherungspunktAnlegen(
        projektPfad,
        texte.sicherungen.beschriftungVorLokalemTeilstueck,
        { strang: sicherung?.strang ?? null }
      )
      if (!punkt.ok)
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.bauenKeinSicherungspunkt }],
          isError: true
        }
      aufEreignis({ art: 'ticker', text: texte.ticker.lokaleBauenStart(teilstueck, modell) })
      const ergebnis = await lokalBauen({
        projektPfad,
        auftrag: mitProjektwissen(auftrag),
        modell,
        adresse,
        aufSchritt: (name, eingabe) =>
          aufEreignis({
            art: 'ticker',
            text:
              name === 'datei_schreiben'
                ? texte.ticker.lokaleBauenSchritt(eingabe?.pfad)
                : name === 'ersetzen'
                  ? texte.ticker.lokaleReparaturSchritt(eingabe?.pfad)
                  : texte.ticker.lokaleHelferSchritt(name, eingabe)
          }),
        aufDenken: (text) =>
          aufEreignis({ art: 'denken', absender: texte.lauf.denkenLokaleKi, text })
      })
      const aenderungen = (ergebnis.ersetzungen ?? 0) + (ergebnis.dateien?.length ?? 0)
      letzteBauSchritte = ergebnis.schritte ?? 0
      // Zähl-Ereignis für die Lokale-Helfer-Zeile des Laufberichts (BAUPLAN 22).
      aufEreignis({
        art: 'lokale-helfer-bauen',
        schritte: ergebnis.schritte ?? 0,
        gescheitert: !ergebnis.ok || aenderungen === 0
      })
      if (!ergebnis.ok || aenderungen === 0) {
        // Ein gescheiterter Versuch mit halben Änderungen wird sofort
        // zurückgerollt — der Agent baut auf sauberem Stand, nicht auf Gebastel.
        // Klappt das NICHT, muss er es lesen (BAUPLAN 45): Sonst sagt ihm die
        // Werkzeug-Antwort „der Stand ist sauber", und er baut auf Gebastel weiter.
        let hinweis = ''
        if (aenderungen > 0)
          hinweis = await zurueckrollen(
            { ...(sicherung ?? {}), punktId: punkt.id },
            texte.ticker.lokaleBauenZurueckgerollt
          )
        aufEreignis({
          art: 'ticker',
          text: ergebnis.ok
            ? texte.ticker.lokaleBauenNichtsGebaut
            : texte.ticker.lokaleBauenGescheitert(ergebnis.fehler)
        })
        return {
          content: [
            {
              type: 'text',
              text:
                (ergebnis.ok
                  ? texte.agentenLokaleHelfer.bauenKeineAenderung
                  : texte.agentenLokaleHelfer.bauenGescheitert(ergebnis.fehler)) + hinweis
            }
          ],
          isError: true
        }
      }
      offenesTeilstueck = {
        kennung: sicherung?.kennung ?? null,
        bezeichnung: sicherung?.bezeichnung ?? '',
        teilstueck,
        strang: sicherung?.strang ?? null,
        geschuetzt: sicherung?.geschuetzt ?? [],
        eigenerBereich: sicherung?.eigenerBereich ?? null,
        // Der Punkt, auf den die Abnahme zurückrollen darf — und nur der.
        punktId: punkt.id
      }
      aufEreignis({
        art: 'ticker',
        text: texte.ticker.lokaleBauenFertig(aenderungen, ergebnis.schritte)
      })
      return {
        content: [
          {
            type: 'text',
            text: texte.agentenLokaleHelfer.bauenFazit(
              ergebnis.fazit,
              ergebnis.dateien ?? [],
              ergebnis.ersetzungen ?? 0
            )
          }
        ]
      }
    },
    { alwaysLoad: true }
  )

  // Die Abnahme je Teilstück (BAUPLAN 22): gehalten = der Agent hat
  // gegengelesen und übernimmt; nicht gehalten = FlowForge rollt den Stand
  // auf den Punkt vor dem Teilstück zurück, der Agent baut selbst.
  const teilstueckAbnehmen = tool(
    'teilstueck_abnehmen',
    texte.agentenLokaleHelfer.abnehmenTeilstueckBeschreibung,
    {
      teilstueck: z.string().describe('Das Teilstück aus dem lokal_bauen-Aufruf, um das es geht.'),
      gehalten: z
        .boolean()
        .describe('true = gegengelesen und übernommen; false = verworfen, der Stand wird zurückgerollt.')
    },
    async ({ teilstueck, gehalten }) => {
      blockwechselPruefen()
      if (offenesTeilstueck == null)
        return {
          content: [{ type: 'text', text: texte.agentenLokaleHelfer.teilstueckOhneOffenes }]
        }
      // Zurückgerollt wird auf den Strang und mit den geschützten Bereichen des
      // Blocks, der das Teilstück GEBAUT hat (BAUPLAN 45) — nicht mit denen von
      // jetzt. Nach dem Blockwechsel gibt es hier ohnehin nichts mehr zu tun.
      const offen = offenesTeilstueck
      offenesTeilstueck = null
      aufEreignis({
        art: 'lokale-helfer-teilstueck-urteil',
        gehalten: Boolean(gehalten),
        schritte: letzteBauSchritte
      })
      if (!gehalten) {
        const hinweis = await zurueckrollen(offen, texte.ticker.teilstueckVerworfen(teilstueck))
        return {
          content: [
            {
              type: 'text',
              text: texte.agentenLokaleHelfer.teilstueckVerworfenText(teilstueck) + hinweis
            }
          ]
        }
      }
      aufEreignis({ art: 'ticker', text: texte.ticker.teilstueckGehalten(teilstueck) })
      return {
        content: [
          { type: 'text', text: texte.agentenLokaleHelfer.teilstueckGehaltenText(teilstueck) }
        ]
      }
    },
    { alwaysLoad: true }
  )

  return createSdkMcpServer({
    name: 'helfer',
    version: '1.0.0',
    instructions: texte.agentenLokaleHelfer.serverHinweis,
    tools: [
      recherchieren,
      entwerfen,
      abnehmen,
      bauen,
      teilstueckAbnehmen,
      ...(bewerten ? [rechercheBewerten] : [])
    ]
  })
}
