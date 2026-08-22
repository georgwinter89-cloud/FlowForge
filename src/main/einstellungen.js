// Globale Einstellungen (Motor-Modus, API-Schlüssel, Ausgaben-Obergrenze).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { texte } from '../shared/texte.js'
import {
  LOKAL_FEIN_VORLAGEN,
  LOKAL_GEDULD_STANDARD,
  LOKAL_KONTEXT_WAHL,
  lokalFeinBereinigen,
  lokaleGeduldBereinigen,
  adresseBereinigen,
  searxngAdresseBereinigen
} from '../shared/lokalRegeln.js'
import {
  PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD,
  PRUEFKARTEN_DECKEL_LAUF_STANDARD,
  pruefkartenDeckelMesspunktBereinigen,
  pruefkartenDeckelLaufBereinigen
} from '../shared/pruefkartenRegeln.js'

// Abo-Regel (SPEC §2, neu seit 0.46.4 — Entscheidung Georg, 19.08.2026): Der
// Abo-Modus bleibt auch in veröffentlichten Versionen an. Anthropic sagt seit
// dem 15.06.2026 selbst, dass Agent-SDK- und Drittanbieter-Nutzung bis auf
// Weiteres über das Abo-Kontingent läuft und Änderungen vorher angekündigt
// werden. Ein `false` hier wäre ein Schild, kein Schloss — statt Verstecken
// gibt es die Erststart-Wahl mit ehrlichem Abrechnungs-Hinweis (texte.js).
// Die Konstante bleibt als Notbremse, falls Anthropic den Weg wirklich sperrt.
export const ABO_MODUS_ERLAUBT = true

const MOTOR_MODI = ['abo', 'api']

const STANDARD = {
  // Kein stiller Standard (0.46.4): Bis der Nutzer beim ersten Start gewählt
  // hat, ist der Modus leer — Lauf, Chat und Block-Assistent verweigern dann
  // mit Klartext (motorBereit) statt still über das Abo zu laufen.
  motorModus: '',
  apiSchluessel: '',
  ausgabenObergrenzeUsd: 5,
  // Automodus (Feedback Georg, 07.08.2026): Rechte-Rückfragen automatisch
  // erlauben statt jedes Mal zu fragen. Harte Sperren bleiben unberührt.
  rechteAutomatisch: false,
  // Befehle trotz „darf nur lesen" (Entscheidung Georg, 14.08.2026): Auf
  // eigene Gefahr dürfen nur-lesende Blöcke (Angreifer, Diagnose) Befehle
  // ausführen wie der Bauer — z.B. Prüfskripte, um Annahmen zu messen. Die
  // Garantie „ein Skriptlauf kann nichts verändern" fällt damit; deshalb
  // Standard aus. Schreib-Werkzeuge bleiben unter der Sperre.
  nurLesenBefehle: false,
  // Unteraufgaben-Modell (BAUPLAN 37): Späher des Angreifers und die
  // Einlese-Helfer von Bauer, Prüfer und Diagnose sind Zuarbeit — sie lesen,
  // suchen und fassen zusammen. 'sparsam' gibt ihnen das kleinere Modell (der
  // Motor-Zwilling der lokalen Helfer-KI), 'wieBlock' lässt sie auf der Klasse
  // ihres Blocks laufen. Standard sparsam: Zuarbeit ist der billigste Ort zum
  // Sparen, und die Abnahme des Block-Agenten bleibt der Schiedsrichter.
  unteraufgabenModell: 'sparsam',
  // Test-Schalter (BAUPLAN 11): Übertrag schon nach ~10 Prozentpunkten
  // Kontext-Verbrauch statt erst bei 85 % — nur zum Ausprobieren.
  uebertragTest: false,
  // Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026): Recherche-
  // Unteraufgaben laufen über eine lokale KI (Ollama) statt über den Motor —
  // kostet kein Kontingent. Nur aktiv, wenn Ollama beim Laufstart erreichbar ist.
  lokaleHelferAktiv: false,
  // Trefferquote (BAUPLAN 23): Nach jeder lokalen Recherche meldet der
  // Block-Agent, ob er das Fazit übernommen oder verworfen hat (minimaler
  // Token-Mehrverbrauch). Standard an, solange die lokale KI ein Experiment
  // ist — ohne Quote ist die Kosten-Wette blind.
  lokaleHelferQuote: true,
  lokaleHelferModell: 'qwen2.5:7b',
  // Adresse des Ollama-Servers — localhost oder ein anderer Rechner im
  // Heimnetz (z.B. der Gaming-PC mit richtiger Grafikkarte).
  lokaleHelferAdresse: 'http://127.0.0.1:11434',
  // Adress-LISTE (BAUPLAN 51): mehrere Ollama-Rechner/GPUs — je Adresse läuft
  // ein lokaler Block zur Zeit, mit mehreren Adressen laufen sie parallel.
  // einstellungenLaden garantiert die Liste IMMER als nicht-leeres Array
  // bereinigter Adressen; Element 0 ist die bisherige Adresse und bleibt der
  // Anker für Helfer-KI und lokale Vorreparatur. Das alte Einzelfeld oben
  // wird als Spiegel adressen[0] weitergeführt — Alt-Lesestellen und Tests
  // bleiben gültig.
  lokaleHelferAdressen: ['http://127.0.0.1:11434'],
  // Kontext-Fenster der lokalen KI in Token (32k / 64k / 96k / 128k; Wunsch
  // Georg 18.08.2026 für ein 27B-Modell auf einer 32-GB-Karte, die 96k als
  // Mittelweg seit 0.51.3). Die Werkzeug-Deckel der lokalen KI wachsen mit
  // (lokaleHelfer.js). Standard 64k: passt bei 27B samt Gewichten in 32 GB;
  // 128k nur, wenn die Karte es wirklich hergibt — was die VRAM-Passt-Prüfung
  // seit 0.51.3 im Ticker beantwortet statt es der Faustregel zu überlassen.
  lokaleHelferKontext: 65536,
  // Geduld der Werkzeug-Schicht (0.51.3, Entscheidung Georg): Wie lange der
  // Motor auf eine Antwort der lokalen KI wartet, bevor er den Block abbricht.
  // 0 = gar nicht setzen, dann gilt die Vorgabe der Motor-Software. Wirkt NUR
  // in der Umgebung lokaler Motor-Instanzen; die Helfer-KI behält ihr eigenes
  // 5-Minuten-Limit, Claude-Blöcke bleiben unberührt.
  lokaleAntwortGeduldMs: LOKAL_GEDULD_STANDARD,
  // Lokale KI als Block-Agent (BAUPLAN 49): Häkchen „als Block-Agent erlaubt".
  // Nur wirksam, wenn lokaleHelferAktiv an ist. Ohne dieses Häkchen lehnt der
  // Start einen Block der Klasse „lokal" mit Klartext ab — kein stiller
  // Rückfall auf Claude (sonst bezahlt Georg, was er lokal wollte).
  lokalBlockAgent: false,
  // Feineinstellungen der lokalen KI (Temperatur, Top-p/k, Min-p,
  // Wiederholungsstrafe, Antwortlänge, Entwurfs-Tokens): daraus legt FlowForge
  // ein abgeleitetes Ollama-Modell an (lokalRegeln.js). null = Ollama-Standard.
  // Basis-Modell, Adresse und Kontext sind die lokaleHelfer*-Felder oben.
  lokalFein: LOKAL_FEIN_VORLAGEN['ollama-standard'],
  // Websuche der lokalen Blöcke (0.51.2): Adresse einer eigenen SearXNG-
  // Instanz. Leer = eingebaute Quelle — es gibt bewusst KEIN zweites Feld für
  // die Quellenwahl (Entscheidung Georg, 20.08.2026): ein Feld weniger, das
  // durch die Speicher-Siebe verlorengehen kann.
  searxngAdresse: '',
  // Kosten-Rückfrage „Extra (Fable 5)" (0.48.1): Beim ersten Lauf mit einem
  // Extra-Block fragt FlowForge einmal, ob der Lauf trotz möglicher
  // Guthaben-Abrechnung starten darf. true = Georg hat „trotzdem starten"
  // gewählt, die Frage kommt nicht wieder. Einziger Schreiber auf true ist
  // extraKostenBestaetigen() — der Einstellungen-Dialog kann den Wert weder
  // setzen noch zurücksetzen (einstellungenSpeichern liest ihn aus der Datei).
  extraKostenBestaetigt: false,
  // Prüfkarten laufen von selbst (BAUPLAN 52): Zeitgrenzen für das Abspielen
  // archivierter Prüfungen. Sie ändern nur, wie OFT eine Karte läuft, nie ob —
  // jede ausgewählte Karte kommt mindestens einmal je Lauf dran (Entscheidung
  // Georg, 21.08.2026). Die Stufenlisten stehen in src/shared/pruefkartenRegeln.js,
  // damit Dialog und Speichern dieselbe Liste sehen (die 0.51.3-Lehre: eine
  // Stufe an zwei Orten heißt, der Dialog bietet an, was das Speichern
  // stillschweigend zurückdreht).
  pruefkartenDeckelMesspunktMs: PRUEFKARTEN_DECKEL_MESSPUNKT_STANDARD,
  pruefkartenDeckelLaufMs: PRUEFKARTEN_DECKEL_LAUF_STANDARD
}

// Die Stufenliste hat seit 0.51.3 genau einen Wohnort (src/shared/lokalRegeln.js) —
// vorher stand sie hier, in lokaleHelfer.js und im Auswahlfeld des Dialogs,
// und eine neue Stufe an nur zwei Stellen hieße: Der Dialog bietet 96k an,
// das Speichern dreht es still auf 64k zurück.
const KONTEXT_WAHL = LOKAL_KONTEXT_WAHL

// Die Adress-Liste säubern (BAUPLAN 51): je Eintrag dieselbe Regel wie bisher
// beim Einzelfeld, Ungültige verwerfen, exakte String-Duplikate entfernen —
// und nie leer: ohne gültigen Eintrag gilt der Standard. Aliasse (localhost
// vs. 127.0.0.1) bleiben absichtlich beide stehen — das ist nur per Hinweis-
// text ehrlich benennbar, nicht mechanisch prüfbar (V5).
function adressListeBereinigen(liste) {
  const sauber = []
  for (const roh of Array.isArray(liste) ? liste : []) {
    const wert = adresseBereinigen(roh)
    if (wert && !sauber.includes(wert)) sauber.push(wert)
  }
  return sauber.length ? sauber : [...STANDARD.lokaleHelferAdressen]
}

function dateiPfad() {
  return path.join(app.getPath('userData'), 'einstellungen.json')
}

export function einstellungenLaden() {
  let gespeichert = {}
  try {
    gespeichert = JSON.parse(fs.readFileSync(dateiPfad(), 'utf8'))
  } catch {
    // Noch keine Datei — Standardwerte gelten.
  }
  const daten = { ...STANDARD, ...gespeichert }
  // Nur die zwei bekannten Modi zählen als Wahl — ein alter oder kaputter
  // Wert fällt auf „nicht gewählt" zurück und löst die Erststart-Wahl aus.
  if (!MOTOR_MODI.includes(daten.motorModus)) daten.motorModus = ''
  if (!ABO_MODUS_ERLAUBT && daten.motorModus === 'abo') daten.motorModus = ''
  // Feineinstellungen der lokalen KI (BAUPLAN 49) immer in der vollen Form —
  // eine ältere oder von Hand bearbeitete Datei darf keine halben Objekte
  // durchreichen.
  daten.lokalFein = lokalFeinBereinigen(daten.lokalFein)
  // Migration Adress-Liste (BAUPLAN 51) — AUSSCHLIESSLICH hier, nach dem
  // Merge (Muster lokalFeinBereinigen): Fehlt das Array (ältere Datei), wird
  // der alte Einzel-String zur Ein-Element-Liste. Danach ist die Liste IMMER
  // ein nicht-leeres Array bereinigter Adressen, und das alte Feld spiegelt
  // Element 0 — gemockte einstellungenLaden-Ketten (lokalerPrueferLauf.test)
  // ziehen damit gratis mit.
  // Wichtig: in GESPEICHERT nachsehen, nicht im Merge-Ergebnis — der
  // STANDARD-Merge liefert immer ein Array und würde die Migration des
  // alten Strings sonst still verschlucken.
  daten.lokaleHelferAdressen = adressListeBereinigen(
    Array.isArray(gespeichert.lokaleHelferAdressen)
      ? gespeichert.lokaleHelferAdressen
      : [daten.lokaleHelferAdresse]
  )
  daten.lokaleHelferAdresse = daten.lokaleHelferAdressen[0]
  // Migration Geduld (0.51.4) — an derselben Stelle wie die beiden darüber:
  // Die Stufe 0 („gar nicht setzen") gibt es nicht mehr. Eine gespeicherte 0
  // stammt aus 0.51.3 und war nie Georgs Wahl, sondern die damalige Vorgabe —
  // sie fällt auf den neuen Standard. Ohne diese Zeile stünde der Dialog vor
  // einem Wert, zu dem es keinen Auswahl-Eintrag mehr gibt, und die Wartezeit
  // im Motor wiche von der angezeigten ab.
  daten.lokaleAntwortGeduldMs = lokaleGeduldBereinigen(daten.lokaleAntwortGeduldMs)
  // Prüfkarten-Deckel (BAUPLAN 52): an derselben Stelle bereinigt wie die
  // Geduld — der Lauf liest die Werte direkt aus dieser Antwort und darf nie
  // vor einer Zahl stehen, die im Dialog gar nicht wählbar ist.
  daten.pruefkartenDeckelMesspunktMs = pruefkartenDeckelMesspunktBereinigen(
    daten.pruefkartenDeckelMesspunktMs
  )
  daten.pruefkartenDeckelLaufMs = pruefkartenDeckelLaufBereinigen(daten.pruefkartenDeckelLaufMs)
  return {
    ok: true,
    einstellungen: daten,
    aboErlaubt: ABO_MODUS_ERLAUBT,
    motorGewaehlt: motorGewaehlt(daten)
  }
}

// Erststart-Wahl (0.46.4): Hat der Nutzer schon gesagt, wie sich der Motor
// anmelden soll? Erst dann zeigt FlowForge die Projektübersicht ohne den
// Erststart-Dialog.
export function motorGewaehlt(einstellungen) {
  return MOTOR_MODI.includes(einstellungen?.motorModus)
}

// Eine Stelle für „darf der Motor starten?" — Lauf, Chat und Block-Assistent
// fragen hier, statt die drei Bedingungen je für sich zu wiederholen.
export function motorBereit(einstellungen) {
  if (!motorGewaehlt(einstellungen))
    return { ok: false, fehler: texte.einstellungen.fehlerModusFehlt }
  if (einstellungen.motorModus === 'abo' && !ABO_MODUS_ERLAUBT)
    return { ok: false, fehler: texte.lauf.aboNichtErlaubt }
  if (einstellungen.motorModus === 'api' && !einstellungen.apiSchluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }
  return { ok: true }
}

// Gemerkte Antworten, die kein Dialog mitschickt (und keiner zurücksetzen
// darf): werden beim Speichern aus der Datei übernommen, nie aus `neu` —
// sonst vergäße jeder Einstellungen- oder Erststart-Dialog die Antwort (der
// Erststart schickt den kompletten geladenen Satz, also auch ein `false`).
function gemerkteAntworten() {
  const { einstellungen } = einstellungenLaden()
  return { extraKostenBestaetigt: einstellungen.extraKostenBestaetigt === true }
}

// Kosten-Rückfrage Extra (0.48.1): Georg hat „trotzdem starten" gewählt —
// merken, damit die Frage nicht bei jedem Lauf wiederkommt.
export function extraKostenBestaetigen() {
  const { einstellungen } = einstellungenLaden()
  const daten = { ...einstellungen, extraKostenBestaetigt: true }
  // Standardwerte, die noch nie gespeichert wurden, landen hier mit in der
  // Datei — harmlos, einstellungenLaden mischt ohnehin STANDARD darunter.
  dateiSchreiben(daten)
  return { ok: true }
}

// Der Rename ist der atomare Teil: Entweder steht die alte Datei da oder die
// neue, nie eine halbe. Auf Windows kann er aber vorübergehend mit EPERM
// scheitern, wenn jemand anders die Zieldatei gerade offen hat — Virenscanner
// und Suchindex tun das im Sekundentakt (in den Prüfungen 21.08.2026
// reproduziert, dort durch parallel laufende Prüf-Arbeiter). Ein einzelner
// Fehlschlag würde Georgs Einstellung still verwerfen, obwohl nichts kaputt
// ist. Deshalb drei kurze Anläufe; hält die Sperre länger, fliegt der Fehler
// weiter nach oben — ein stilles Schlucken wäre schlimmer.
const SCHREIB_ANLAEUFE = 3
function dateiSchreiben(daten) {
  const tmp = dateiPfad() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
  for (let anlauf = 1; ; anlauf++) {
    try {
      fs.renameSync(tmp, dateiPfad())
      return
    } catch (fehler) {
      const kurzfristig = fehler?.code === 'EPERM' || fehler?.code === 'EACCES'
      if (!kurzfristig || anlauf >= SCHREIB_ANLAEUFE) throw fehler
      // Kurz blockierend warten: Diese Funktion hat keinen asynchronen Weg,
      // und es geht um Millisekunden, nicht um eine Wartezeit, die man sieht.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * anlauf)
    }
  }
}

export function einstellungenSpeichern(neu) {
  const modus = MOTOR_MODI.includes(neu.motorModus) ? neu.motorModus : ''
  const schluessel = String(neu.apiSchluessel ?? '').trim()
  const obergrenze = Number(neu.ausgabenObergrenzeUsd)
  if (!modus || (modus === 'abo' && !ABO_MODUS_ERLAUBT))
    return { ok: false, fehler: texte.einstellungen.fehlerModusFehlt }
  if (modus === 'api' && !schluessel)
    return { ok: false, fehler: texte.einstellungen.fehlerApiSchluesselFehlt }
  if (modus === 'api' && (!Number.isFinite(obergrenze) || obergrenze <= 0))
    return { ok: false, fehler: texte.einstellungen.fehlerObergrenze }

  // Adress-Liste (BAUPLAN 51): je Eintrag bereinigen, Ungültige verwerfen,
  // Duplikate raus, leer → Standard. Aufrufer ohne Array dürfen die Liste
  // nicht verlieren (Befund Prüfer 1, Bausession 51): Sie wird wie die
  // gemerkten Antworten aus der DATEI übernommen; schickt der Aufrufer nur
  // das alte Einzelfeld, ersetzt das den Anker (Element 0), die weiteren
  // Adressen bleiben — sonst verlöre jedes Speichern ohne das Feld still
  // Georgs GPU-Konfiguration.
  let adressen
  if (Array.isArray(neu.lokaleHelferAdressen)) {
    adressen = adressListeBereinigen(neu.lokaleHelferAdressen)
  } else {
    const { einstellungen: bisher } = einstellungenLaden()
    const einzel = adresseBereinigen(neu.lokaleHelferAdresse)
    adressen = adressListeBereinigen(
      einzel ? [einzel, ...bisher.lokaleHelferAdressen.slice(1)] : bisher.lokaleHelferAdressen
    )
  }

  // SearXNG-Adresse (0.51.2) — dasselbe Muster wie die Adress-Liste darüber,
  // aus demselben Grund: einstellungenSpeichern schreibt eine Positivliste,
  // und ein Aufrufer, der das Feld gar nicht mitschickt (jeder ältere Dialog),
  // löschte es sonst still. Deshalb drei Fälle, jeder eine bewusste Aussage:
  //   undefined → der Aufrufer kennt das Feld nicht: Wert aus der DATEI halten;
  //   Leerstring → Georg hat das Feld geleert: eingebaute Quelle;
  //   sonst      → bereinigen; nur ein wirklich unbrauchbarer Wert (file:,
  //                data:, Unparsbares) lässt die alte Adresse stehen — kein
  //                Fehler, der das ganze Speichern abbräche, der Dialog sagt es
  //                daneben in Klartext.
  //
  // Gesäubert wird mit searxngAdresseBereinigen und NICHT mit der strengen
  // Regel der Ollama-Liste (Nacharbeit Befund 3): „gaming-pc:8080" — genau die
  // Schreibweise, die Georg im Browser tippt — wurde gemessen 20.08.2026 still
  // verworfen; er sah keinen Fehler, und jede Suche lief weiter über die
  // eingebaute Quelle. Das fehlende Schema wird jetzt ergänzt, genau wie
  // webseite_lesen es mit „www.electronjs.org" tut.
  let searxng
  if (neu.searxngAdresse === undefined) {
    const { einstellungen: bisher } = einstellungenLaden()
    searxng = bisher.searxngAdresse
  } else if (String(neu.searxngAdresse).trim() === '') {
    searxng = ''
  } else {
    const sauber = searxngAdresseBereinigen(neu.searxngAdresse)
    if (sauber) searxng = sauber
    else {
      const { einstellungen: bisher } = einstellungenLaden()
      searxng = bisher.searxngAdresse
    }
  }

  const daten = {
    motorModus: modus,
    apiSchluessel: schluessel,
    ausgabenObergrenzeUsd: Number.isFinite(obergrenze) && obergrenze > 0 ? obergrenze : STANDARD.ausgabenObergrenzeUsd,
    rechteAutomatisch: Boolean(neu.rechteAutomatisch),
    nurLesenBefehle: Boolean(neu.nurLesenBefehle),
    // Nur die zwei bekannten Werte; alles andere (auch ein fehlendes Feld
    // älterer Aufrufer) fällt auf den Standard zurück.
    unteraufgabenModell: neu.unteraufgabenModell === 'wieBlock' ? 'wieBlock' : 'sparsam',
    uebertragTest: Boolean(neu.uebertragTest),
    lokaleHelferAktiv: Boolean(neu.lokaleHelferAktiv),
    // Fehlt das Feld (ältere Aufrufer), bleibt der Standard an — sonst fiele
    // die Quote beim Speichern still auf aus.
    lokaleHelferQuote:
      neu.lokaleHelferQuote == null ? STANDARD.lokaleHelferQuote : Boolean(neu.lokaleHelferQuote),
    lokaleHelferModell:
      String(neu.lokaleHelferModell ?? '').trim() || STANDARD.lokaleHelferModell,
    // Das Einzelfeld ist seit BAUPLAN 51 der Spiegel von adressen[0] — es
    // wird IMMER mitgeschrieben, damit Alt-Lesestellen gültig bleiben.
    lokaleHelferAdressen: adressen,
    lokaleHelferAdresse: adressen[0],
    // Nur die drei bekannten Fenster; alles andere (auch ein fehlendes Feld
    // älterer Aufrufer) fällt auf den Standard zurück.
    lokaleHelferKontext: KONTEXT_WAHL.includes(Number(neu.lokaleHelferKontext))
      ? Number(neu.lokaleHelferKontext)
      : STANDARD.lokaleHelferKontext,
    // Geduld der Werkzeug-Schicht (0.51.3) — nach dem Muster der SearXNG-
    // Adresse und NICHT nach dem des Kontextfensters: Ein Aufrufer, der das
    // Feld gar nicht kennt, darf Georgs Wahl nicht still auf „Standard"
    // zurückdrehen. Genau dieser stille Verlust war der Befund von Prüfer 1 in
    // Bausession 51 (Adress-Liste) — und hier wöge er schwerer, weil der
    // zurückgedrehte Wert genau den Abbruch zurückholt, gegen den die
    // Einstellung gebaut ist. undefined → Wert aus der Datei halten;
    // alles andere → bereinigen (unbekannte Stufe = Standard).
    lokaleAntwortGeduldMs:
      neu.lokaleAntwortGeduldMs === undefined
        ? lokaleGeduldBereinigen(einstellungenLaden().einstellungen.lokaleAntwortGeduldMs)
        : lokaleGeduldBereinigen(neu.lokaleAntwortGeduldMs),
    // Prüfkarten-Deckel (BAUPLAN 52) — nach demselben Muster wie die Geduld
    // darüber: Ein Aufrufer, der das Feld gar nicht kennt (undefined), darf
    // Georgs Wahl nicht still auf den Standard zurückdrehen; alles andere wird
    // auf eine gültige Stufe gezogen.
    pruefkartenDeckelMesspunktMs:
      neu.pruefkartenDeckelMesspunktMs === undefined
        ? pruefkartenDeckelMesspunktBereinigen(
            einstellungenLaden().einstellungen.pruefkartenDeckelMesspunktMs
          )
        : pruefkartenDeckelMesspunktBereinigen(neu.pruefkartenDeckelMesspunktMs),
    pruefkartenDeckelLaufMs:
      neu.pruefkartenDeckelLaufMs === undefined
        ? pruefkartenDeckelLaufBereinigen(einstellungenLaden().einstellungen.pruefkartenDeckelLaufMs)
        : pruefkartenDeckelLaufBereinigen(neu.pruefkartenDeckelLaufMs),
    // Lokale KI als Block-Agent (BAUPLAN 49): Häkchen und Feineinstellungen.
    // Fehlt lokalFein (ältere Aufrufer), bleibt alles Ollama-Standard.
    lokalBlockAgent: Boolean(neu.lokalBlockAgent),
    lokalFein: lokalFeinBereinigen(neu.lokalFein),
    // Websuche der lokalen Blöcke (0.51.2): leer = eingebaute Quelle.
    searxngAdresse: searxng,
    // NIE aus `neu` (siehe gemerkteAntworten).
    ...gemerkteAntworten()
  }
  dateiSchreiben(daten)
  return { ok: true, einstellungen: daten, aboErlaubt: ABO_MODUS_ERLAUBT, motorGewaehlt: true }
}
