// Sicherungspunkte (SPEC §3.3): automatische Sicherungen des Projektordners mit
// Wiederherstellen-Funktion. Technisch Git — aber in einem eigenen, versteckten
// Verzeichnis außerhalb des Projektordners (Kollisionsschutz laut BAUPLAN 4):
// das Projekt selbst darf dadurch jederzeit ein eigenes Git-Repo sein oder werden.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import git, { TREE, WORKDIR } from 'isomorphic-git'
import { texte } from '../shared/texte.js'
import { dateiUnterschied } from '../shared/laufDiff.js'
// Die EINE Rechenstelle für „gehört dieser Pfad in diese Liste" (BAUPLAN 44/45).
// Sie wohnt in einer eigenen Datei, nicht im Motor: Der Motor zöge Electron und
// das Agent-SDK in den Unterbau, und git.walk liefert seine Pfade in einer
// anderen Schreibweise (relativ zur Wurzel, Schrägstriche vorwärts) als das
// Schreib-Werkzeug — genau dafür ist diese Funktion da.
import { stehtInDateiliste } from './dateilistenPfade.js'

// Diese Ordner gehören nicht in Sicherungspunkte: .git (eigenes Repo des Projekts),
// laufberichte (reines Nachschlagewerk — bleibt von Wiederherstellungen unberührt),
// node_modules (per Installation wiederherstellbar, viel zu groß),
// laufstand.json (Zwischenstand des laufenden Laufs — eine Wiederherstellung
// würde sonst einen veralteten „unterbrochenen Lauf" zurückholen).
// arbeitsablage: Wegwerf-Fläche der Agenten — wird am Lauf-Ende ohnehin geleert.
// naechster-lauf.json (Karten-Vorschlag fürs nächste Paket, BAUPLAN 28): eine
// Wiederherstellung würde sonst abgeräumte alte Vorschläge zurückholen.
// chat.json (Verlauf des Co-Piloten, BAUPLAN 33): Gesprächsverlauf ist kein
// Projektstand — eine Wiederherstellung soll ihn nicht zurückdrehen.
// pruefbefehl.json (Tor ohne KI, BAUPLAN 35): gehört zum Lauf, nicht zum
// Projektstand — er zeigt auf die Prüfmappe, die der nächste Laufstart leert.
// Nebenwirkung, die genau so gewollt ist: Er taucht damit auch nicht im Diff
// der Reparatur-Runden auf (BAUPLAN 34).
const AUSGESCHLOSSEN = new Set(['.git', 'laufberichte', 'node_modules', 'laufstand.json', 'arbeitsablage', 'naechster-lauf.json', 'chat.json', 'pruefbefehl.json'])
const ZWEIG = 'haupt'
const AUTOR = { name: 'FlowForge', email: 'flowforge@lokal' }

// Ein Punkt-Strang je Schreiber (BAUPLAN 45). Der Grund für die
// Ein-Schreiber-Regel war nie die Dateikollision, sondern der projektweite
// Rückroll: aufLetztenPunktZuruecksetzen setzte den GANZEN Ordner zurück, und
// ausgelöst wird das nicht nur bei Fehlschlägen, sondern bei jedem verworfenen
// lokalen Teilstück (BAUPLAN 20/22).
//
// Leitsatz: Der ARBEITSORDNER ist die Wahrheit. Ein Strang ist nur ein Zeiger
// auf eine Punkt-Kette und wird NIEMALS ausgecheckt — git.checkout() käme hier
// nicht vor, denn es schriebe den Arbeitsordner um und wäre damit genau der
// projektweite Rückroll, den dieser Schritt abschafft. Die Trennung je
// Schreiber liegt im WIRKBEREICH, den Rückroll und Diff auswerten.
const STRANG_PRAEFIX = 'strang/'

// Der Zweigname eines Strangs — strang == null heißt 'haupt'. Der feste Vorsatz
// ist keine Kosmetik: Er ist der Grund, warum straengeAufraeumen 'haupt' nicht
// treffen KANN, statt es per Sonderfall auszunehmen.
//
// Gesäubert wird hart auf Buchstaben, Ziffern, Strich und Unterstrich: Ein
// Strangname ist eine Instanz-Kennung (UUID, teils mit Blockkennung davor), und
// isomorphic-git weist einen ungültigen Zweignamen mit einem Fehler ab — ein
// abgewiesener Strang hieße für den Schreiber „kein Rückroll-Punkt".
//
// Einen schon mitgebrachten Vorsatz setzt die Funktion NICHT ein zweites Mal:
// Der Lauf gibt den Strang als „strang/<Instanz-Kennung>" herein, und ein
// doppelter Vorsatz wäre zwar eindeutig, aber im Ticker und in jeder späteren
// Fehlersuche ein Rätsel. Beide Schreibweisen führen so auf denselben Zweig.
function zweigFuer(strang) {
  if (!strang) return ZWEIG
  let name = String(strang)
  while (name.startsWith(STRANG_PRAEFIX)) name = name.slice(STRANG_PRAEFIX.length)
  const sauber = name.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '')
  return STRANG_PRAEFIX + (sauber || 'namenlos')
}

// Der VOLLE Ref-Pfad. Wichtig, nicht kosmetisch: git.commit reicht seinen ref
// unverändert an writeRef weiter, und das legt die Datei unter gitdir/<ref> an.
// Mit dem kurzen Namen 'haupt' entstünde also eine Datei „haupt" NEBEN refs/ —
// die Spitze des Zweigs bewegte sich nie, und der nächste Punkt hinge wieder am
// selben Elternteil. Gelesen (log, statusMatrix) wird derselbe volle Pfad,
// damit es im Haus nur EINE Schreibweise gibt.
function refFuer(strang) {
  return 'refs/heads/' + zweigFuer(strang)
}

function ausgeschlossen(dateipfad) {
  return AUSGESCHLOSSEN.has(dateipfad.split('/')[0])
}

// ── Warteschlange je Projektordner (BAUPLAN 46) ─────────────────────────────
// Seit zwei Schreiber gleichzeitig laufen, legen zwei Blöcke gleichzeitig
// Punkte an, führen zusammen und rollen zurück — und alle teilen sich EINEN
// Git-Index im versteckten Verzeichnis. Zwei verschränkte statusMatrix/add/
// commit-Folgen ergäben Punkte, die halb den einen und halb den anderen Stand
// tragen, oder einen Commit auf einem Index, den der Nachbar gerade umbaut.
// Deshalb läuft jede exportierte Operation, die den Index oder die Refs liest
// oder schreibt, je Projektordner NACHEINANDER: eine kleine Promise-Kette.
//
// Verklemmungs-Regel: Innerhalb der Kette darf keine Funktion eine ANDERE
// Ketten-Funktion awaiten — sie wartete auf sich selbst. Die inneren
// Bausteine (…Intern, strangEinholen, standEinsammeln, unterschiede) laufen
// deshalb ohne Warteschlange; nur die exportierten Hüllen stellen sich an.
const warteschlangen = new Map()
function nacheinander(projektPfad, aufgabe) {
  const schluessel = path.resolve(String(projektPfad ?? '')).toLowerCase()
  const vorher = warteschlangen.get(schluessel) ?? Promise.resolve()
  // Die Aufgabe läuft auch dann, wenn die vorige geplatzt ist — ein Fehler des
  // Nachbarn darf den eigenen Punkt nicht verhindern.
  const jetzt = vorher.then(aufgabe, aufgabe)
  const kette = jetzt.catch(() => {})
  warteschlangen.set(schluessel, kette)
  kette.then(() => {
    if (warteschlangen.get(schluessel) === kette) warteschlangen.delete(schluessel)
  })
  return jetzt
}

function gitVerzeichnis(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(app.getPath('userData'), 'sicherungen', schluessel)
}

async function repoOeffnen(projektPfad) {
  const gitdir = gitVerzeichnis(projektPfad)
  if (!fs.existsSync(path.join(gitdir, 'HEAD')))
    await git.init({ fs, dir: projektPfad, gitdir, defaultBranch: ZWEIG })
  return gitdir
}

async function neuesterPunkt(gitdir, refPfad = refFuer(null)) {
  try {
    const [eintrag] = await git.log({ fs, gitdir, ref: refPfad, depth: 1 })
    return eintrag ?? null
  } catch {
    return null
  }
}

// Alle Projektdateien relativ zur Wurzel, mit /-Trennern (so will Git sie haben).
function alleDateien(wurzel, unter = '') {
  const liste = []
  for (const eintrag of fs.readdirSync(path.join(wurzel, unter), { withFileTypes: true })) {
    const relativ = unter ? unter + '/' + eintrag.name : eintrag.name
    if (ausgeschlossen(relativ)) continue
    if (eintrag.isDirectory()) liste.push(...alleDateien(wurzel, relativ))
    else if (eintrag.isFile()) liste.push(relativ)
  }
  return liste
}

// Bringt den Index auf den jetzigen Arbeitsordner, gerechnet gegen `refPfad`,
// und meldet, ob es dabei einen echten Unterschied gab. `kopf` ist die Spitze
// dieses Refs (null = noch gar kein Punkt).
//
// `ausgenommen` (BAUPLAN 46): Dateilisten-Einträge (Dateien und Ordner in der
// Schreibweise der Wirkbereiche) der ANDEREN gerade laufenden Schreiber. Was
// darin liegt, wird NICHT aus dem Arbeitsordner eingesammelt — dort steht
// gerade halbfertige fremde Arbeit —, sondern im Index auf den Stand von
// `basisRef` gesetzt (Voreinstellung: derselbe Ref, gegen den eingesammelt
// wird). Damit trägt „Nach Block A" genau A's Arbeit, und nach einem Absturz
// startet B sauber auf dem Stand „vor B". Ohne diese Ausnahme fror der Punkt
// des einen den Halbstand des anderen ein — und ein Rückroll auf ihn stellte
// den Halbstand wieder her.
//
// Rückgabe: { geaendert, ausgenommenDateien } — die Zahl der Dateien, die
// wegen der Ausnahme NICHT vom Arbeitsordner genommen wurden, obwohl sie dort
// vom Ref abweichen (die Zahl, die der Ticker nennen kann).
async function standEinsammeln(projektPfad, gitdir, refPfad, kopf, { ausgenommen = [], basisRef = null } = {}) {
  const bereiche = Array.isArray(ausgenommen) ? ausgenommen.filter(Boolean) : []
  const istAusgenommen = (datei) =>
    bereiche.length > 0 && stehtInDateiliste(datei, projektPfad, bereiche)
  let geaendert = false
  let ausgenommenDateien = 0
  const cache = {}
  if (!kopf) {
    for (const datei of alleDateien(projektPfad)) {
      if (istAusgenommen(datei)) {
        // Ohne Basis gibt es keinen Basis-Stand: Die Datei bleibt aus dem
        // ersten Punkt draußen (und aus dem Index, falls dort ein Rest liegt).
        await git.remove({ fs, dir: projektPfad, gitdir, cache, filepath: datei })
        ausgenommenDateien++
        continue
      }
      await git.add({ fs, dir: projektPfad, gitdir, cache, filepath: datei })
      geaendert = true
    }
    return { geaendert, ausgenommenDateien }
  }
  const basis = basisRef ?? refPfad
  const matrix = await git.statusMatrix({
    fs,
    dir: projektPfad,
    gitdir,
    ref: refPfad,
    cache,
    filter: (datei) => !ausgeschlossen(datei)
  })
  for (const [datei, imPunkt, imOrdner, imIndex] of matrix) {
    if (istAusgenommen(datei)) {
      // Immer auf die Basis setzen, auch wenn Ref, Ordner und Index gleich
      // aussehen: Der Index ist zwischen allen Strängen geteilt, und die Basis
      // kann ein anderer Ref sein als der, gegen den hier gerechnet wird.
      await git.resetIndex({ fs, dir: projektPfad, gitdir, cache, filepath: datei, ref: basis })
      if (imPunkt !== 1 || imOrdner !== 1) ausgenommenDateien++
      continue
    }
    if (imPunkt === 1 && imOrdner === 1 && imIndex === 1) continue
    if (imOrdner === 0) await git.remove({ fs, dir: projektPfad, gitdir, cache, filepath: datei })
    else await git.add({ fs, dir: projektPfad, gitdir, cache, filepath: datei })
    // Nur echte Unterschiede zum letzten Punkt zählen — nicht bloß Index-Reste.
    if (imPunkt !== 1 || imOrdner !== 1) geaendert = true
  }
  return { geaendert, ausgenommenDateien }
}

// Weichen zwei Punkte innerhalb der Pfade `bereiche` voneinander ab? Ein
// Baum-gegen-Baum-Gang ohne Blob-Inhalte (die oids stehen im Baum). Gebraucht
// für „Vorziehen statt Zwilling" mit ausgenommenen Bereichen: Ein Vorziehen
// machte den Strangpunkt zur Spitze von 'haupt' — dessen ausgenommene Bereiche
// müssen dann wirklich auf dem Basis-Stand von 'haupt' stehen, sonst friert
// das Vorziehen doch fremden Halbstand ein.
async function punkteWeichenAbIn(projektPfad, gitdir, oidA, oidB, bereiche) {
  if (!oidA || !oidB) return oidA !== oidB
  if (oidA === oidB) return false
  const treffer = await git.walk({
    fs,
    dir: projektPfad,
    gitdir,
    trees: [TREE({ ref: oidA }), TREE({ ref: oidB })],
    map: async (dateipfad, [a, b]) => {
      if (dateipfad === '.') return undefined
      if (ausgeschlossen(dateipfad)) return null
      const typA = a ? await a.type() : null
      const typB = b ? await b.type() : null
      if (typA !== 'blob' && typB !== 'blob') return undefined
      if (!stehtInDateiliste(dateipfad, projektPfad, bereiche)) return undefined
      const oidVonA = typA === 'blob' ? await a.oid() : null
      const oidVonB = typB === 'blob' ? await b.oid() : null
      return oidVonA === oidVonB ? undefined : dateipfad
    }
  })
  return (treffer ?? []).length > 0
}

// Legt einen Sicherungspunkt an — aber nur, wenn sich seit dem letzten etwas
// geändert hat. Gibt zurück, ob wirklich ein neuer Punkt entstanden ist, und
// die id des Punkts, der den jetzigen Stand festhält (neu oder schon vorhanden).
//
// `strang` (BAUPLAN 45) schreibt den Punkt auf den eigenen Strang eines
// Schreibers statt auf 'haupt'; HEAD wird dabei NIE bewegt.
//
// Der Ref läuft durch ALLE DREI Stellen (log, statusMatrix, commit) — das ist
// der Kern dieser Änderung und kein Aufräumen: Vorher kam „kopf" aus
// git.log({ref:'haupt'}), während statusMatrix und commit ohne ref gegen HEAD
// rechneten. Sobald Punkte auf einem Strang landen, wäre die zurückgegebene id
// nicht mehr der Punkt, auf den ein späterer Rückroll zielt — und genau darauf
// baut die Zusicherung in helferWerkzeuge.js („der neueste Punkt ist der Stand
// VOR dem Teilstück"). Die lokale KI baute dann auf Gebastel weiter, das sie
// gerade verworfen glaubt.
//
// `ausgenommen` (BAUPLAN 46): die Wirkbereiche der anderen gerade laufenden
// Schreiber — sie bleiben auf dem Stand der Spitze dieses Refs (standEinsammeln).
// Rückgabe zusätzlich `ausgenommenDateien`.
//
// Die exportierte Hülle stellt sich in die Warteschlange des Projektordners;
// die innere Fassung rufen die Stellen, die selbst schon in der Kette laufen
// (Zusammenführen, Wiederherstellen) — siehe Verklemmungs-Regel oben.
export function sicherungspunktAnlegen(projektPfad, beschriftung, optionen = {}) {
  return nacheinander(projektPfad, () => sicherungspunktAnlegenIntern(projektPfad, beschriftung, optionen))
}

async function sicherungspunktAnlegenIntern(projektPfad, beschriftung, { strang = null, ausgenommen = [] } = {}) {
  try {
    const gitdir = await repoOeffnen(projektPfad)
    const refPfad = refFuer(strang)
    const kopf = await neuesterPunkt(gitdir, refPfad)
    const { geaendert, ausgenommenDateien } = await standEinsammeln(projektPfad, gitdir, refPfad, kopf, {
      ausgenommen
    })
    if (!geaendert) return { ok: true, neu: false, id: kopf?.oid ?? null, ausgenommenDateien }
    const id = await git.commit({
      fs,
      dir: projektPfad,
      gitdir,
      ref: refPfad,
      message: beschriftung,
      author: AUTOR
    })
    return { ok: true, neu: true, id, ausgenommenDateien }
  } catch {
    return { ok: false, fehler: texte.sicherungen.fehlerAnlegen }
  }
}

// Öffnet den eigenen Strang eines Schreibers: refs/heads/strang/<name> zeigt
// danach auf die Spitze von 'haupt'. Der Arbeitsordner wird dabei NICHT
// angefasst (checkout: false) und HEAD bleibt, wo es ist — ein Strang ist ein
// Zeiger, kein Zustand.
//
// Liegt unter demselben Namen noch ein Strang mit unzusammengeführter Arbeit,
// wird die ZUERST eingeholt; klemmt das, öffnet die Funktion lieber gar nicht.
export function strangOeffnen(projektPfad, strang) {
  return nacheinander(projektPfad, () => strangOeffnenIntern(projektPfad, strang))
}

async function strangOeffnenIntern(projektPfad, strang) {
  try {
    const gitdir = await repoOeffnen(projektPfad)
    const zweig = zweigFuer(strang)
    // Erst einholen, dann neu setzen — und das ist kein Aufräumen nebenbei:
    // Der Strangname kommt aus der STABILEN Instanz-Kennung, derselbe Block
    // öffnet beim nächsten Laufstart also buchstäblich denselben Namen. Das
    // force unten schnitte damit genau den Punkt ab, den straengeAufraeumen
    // Sekunden vorher bewusst stehengelassen hat. Gemessen genau so, bevor
    // diese Rettung dazukam: Der behaltene Punkt hing danach an keinem Ref
    // mehr, während der Ticker Erhaltung versprach.
    const lage = await strangEinholen(projektPfad, gitdir, zweig)
    // Klemmt das Einholen, wird NICHT überschrieben: Ein Block ohne eigenen
    // Strang läuft wie vor Bauschritt 45 weiter, und der Lauf sagt das im
    // Ticker. Ein abgeschnittener Punkt wäre dagegen verlorene Arbeit.
    if (lage === 'klemmt') return { ok: false, fehler: texte.sicherungen.fehlerStrangOeffnen }
    const basis = await neuesterPunkt(gitdir, refFuer(null))
    // Noch kein einziger Punkt: Es gibt nichts, worauf ein Zweig zeigen könnte.
    // Der erste Punkt auf diesem Strang legt ihn dann als Wurzelpunkt an — der
    // Strang ist also trotzdem offen, nur eben ohne Basis.
    if (!basis) return { ok: true, id: null }
    // force: Ein Strang aus einem abgestürzten Lauf wird ehrlich neu gesetzt,
    // statt mit AlreadyExistsError den Laufstart zu kippen. Was er festhielt,
    // ist an dieser Stelle längst eingeholt.
    await git.branch({
      fs,
      gitdir,
      ref: zweig,
      object: basis.oid,
      checkout: false,
      force: true
    })
    return { ok: true, id: basis.oid }
  } catch {
    // Der eigene Text, nicht fehlerAnlegen: Der sagt wörtlich „Der Lauf wurde
    // sicherheitshalber nicht gestartet" — mitten im Lauf ist das schlicht
    // falsch, und der Lauf läuft hier ohne Trennung einfach weiter.
    return { ok: false, fehler: texte.sicherungen.fehlerStrangOeffnen }
  }
}

async function strangEntfernen(gitdir, zweig) {
  // Der Namensvorsatz ist der Schutz, und er muss auch HIER gelten, nicht nur
  // in straengeAufraeumen: zweigFuer(null) gibt 'haupt' zurück, ein Aufruf ohne
  // Strangnamen räumte damit den gemeinsamen Zweig weg. Gemessen genau so,
  // bevor diese Zeile dazukam: strangZusammenfuehren(pfad, null, …) meldete
  // { ok: true }, danach war die Zweigliste leer und Georgs Wiederherstellen-
  // Liste ebenfalls — kein Punkt gelöscht, keiner mehr erreichbar. Heute reicht
  // kein Aufrufer null herein; die Falle lag eine Zeile daneben.
  if (!String(zweig ?? '').startsWith(STRANG_PRAEFIX)) return
  try {
    await git.deleteBranch({ fs, gitdir, ref: zweig })
  } catch {
    // Kein Strang da — dann ist auch nichts wegzuräumen.
  }
}

// Enthält der Strang die jetzige Spitze von 'haupt', ist 'haupt' also seit dem
// Öffnen des Strangs stehengeblieben? Nur dann darf 'haupt' vorgezogen werden.
// Ist inzwischen ein anderer Punkt auf 'haupt' gelandet (ab Bauschritt 46 der
// Regelfall, mit zwei gleichzeitigen Schreibern), würde das Vorziehen ihn aus
// der Kette werfen — dann muss es der Punkt mit zwei Eltern sein.
async function hauptIstVorfahr(gitdir, hauptSpitze, strangSpitze) {
  if (!hauptSpitze) return true
  if (hauptSpitze.oid === strangSpitze.oid) return true
  try {
    return await git.isDescendent({
      fs,
      gitdir,
      oid: strangSpitze.oid,
      ancestor: hauptSpitze.oid,
      depth: -1
    })
  } catch {
    // Im Zweifel den vollen Weg gehen: Ein Punkt zu viel ist ein Schönheits-
    // fehler, ein abgehängter Punkt auf 'haupt' wäre verlorene Arbeit.
    return false
  }
}

// Führt den Strang eines Schreibers wieder mit 'haupt' zusammen: EIN Punkt auf
// 'haupt' mit den Eltern [hauptSpitze, strangSpitze] und dem Baum des JETZIGEN
// Arbeitsordners.
//
// Kein git.merge: Ein Merge-Algorithmus rechnet aus zwei Bäumen einen dritten
// aus und kann dabei in Konflikt geraten — in diesem Aufbau wirft er
// MergeConflictError und lässt einen halbfertigen Zustand zurück. Hier gibt es
// nichts auszurechnen: Der Arbeitsordner IST das Ergebnis, die beiden Eltern
// halten nur fest, woher es kam. Damit ist die Zusammenführung strukturell
// konfliktfrei — und alles, was in gar keinem Strang stand (die Prüfmappe zum
// Beispiel), ist selbstverständlich mit drin.
//
// `ausgenommen` (BAUPLAN 46): die Wirkbereiche der anderen Schreiber, die
// gerade noch laufen oder auf ihren Nachlauf warten. Der gemeinsame Punkt
// nimmt dort NICHT den Arbeitsordner (halbfertige fremde Arbeit), sondern den
// Stand der Spitze von 'haupt' — den Stand von vor diesen Blöcken. So bleibt
// „Nach Block A" genau A's Arbeit, und ein Absturz mitten in der Welle lässt B
// nicht als halb festgehalten zurück. Rückgabe zusätzlich `ausgenommenDateien`.
export function strangZusammenfuehren(projektPfad, strang, beschriftung, optionen = {}) {
  return nacheinander(projektPfad, () =>
    strangZusammenfuehrenIntern(projektPfad, strang, beschriftung, optionen)
  )
}

async function strangZusammenfuehrenIntern(projektPfad, strang, beschriftung, { ausgenommen = [] } = {}) {
  try {
    const gitdir = await repoOeffnen(projektPfad)
    const zweig = zweigFuer(strang)
    const hauptRef = refFuer(null)
    const strangRef = refFuer(strang)
    const strangSpitze = await neuesterPunkt(gitdir, strangRef)
    const hauptSpitze = await neuesterPunkt(gitdir, hauptRef)
    const bereiche = Array.isArray(ausgenommen) ? ausgenommen.filter(Boolean) : []
    // Kein Strang, oder einer, dessen Spitze 'haupt' LÄNGST KENNT: Dann gibt es
    // nichts zusammenzuführen, und der gemeinsame Punkt ist ein ganz
    // gewöhnlicher — sicherungspunktAnlegen legt ihn nur an, wenn sich im Ordner
    // überhaupt etwas geändert hat.
    //
    // Gemessen wird die ERREICHBARKEIT, nicht der Gleichstand der beiden
    // Spitzen, und das ist seit den mehreren gleichzeitig offenen Strängen kein
    // Feinschliff mehr: Ein Block, der auf seine Nachprüfung wartet, hält seinen
    // Strang offen; hat er in seinem Anlauf nichts geschrieben, steht dessen
    // Spitze noch auf dem alten gemeinsamen Punkt. Führt ein ANDERER Block
    // dazwischen zusammen, steckt dieser Punkt darin längst drin. Ein
    // Zusammenführungs-Punkt mit ihm als zweitem Elternteil trüge dann eine
    // Herkunft nach, die schon in der Kette steht — und weil dieser Weg an
    // sicherungspunktAnlegen vorbeiführt, entstünde er auch bei völlig
    // unverändertem Ordner. Gemessen genau so, bevor diese Zeile stand
    // (arbeitsablage/bauer-mechanik/anker-ohne-punkt.mess.js, MESSUNG D):
    //   D listeVorher  = ["Nach Block „Bauer"", "Zwischenstand Bauer", …]
    //   D listeNachher = ["Nach Block „Prüfer"", "Nach Block „Bauer"", …]
    //   D gleicherBaum = true
    // Zwei Einträge, ein Ordnerstand — genau das Doppel, das SPEC §3.3 abschafft.
    if (!(await strangUnzusammengefuehrt(gitdir, hauptSpitze, strangSpitze))) {
      const punkt = await sicherungspunktAnlegenIntern(projektPfad, beschriftung, {
        ausgenommen: bereiche
      })
      await strangEntfernen(gitdir, zweig)
      return punkt
    }
    // Vorziehen statt Zwilling (SPEC §3.3: EIN Punkt je schreibendem Block):
    // Trägt die Strangspitze schon genau denselben Ordnerstand UND dieselbe
    // Beschriftung, wäre der gemeinsame Punkt in jeder Hinsicht ein Doppel —
    // Georg bekäme in der Wiederherstellen-Liste zwei Einträge angeboten,
    // zwischen denen es sachlich nichts zu wählen gibt. Dann genügt es,
    // 'haupt' auf die Strangspitze vorzuziehen.
    //
    // Die Beschriftung gehört ausdrücklich zur Bedingung, und das ist keine
    // Vorsicht auf Verdacht: Auf dem Strang liegen die Rückroll-Punkte der
    // lokalen KI („vor lokalem Teilstück", helferWerkzeuge.js). Verwirft sie
    // ihren Versuch, steht der Ordner wieder genau auf so einem Punkt — ein
    // Vorziehen allein nach dem Baum hätte diesen Punkt zum Blockende gemacht,
    // und Georg läse in seiner Liste „vor lokalem Teilstück" statt „nach Block
    // X". Gemessen genau so, bevor diese Bedingung dazukam.
    const gleicheBeschriftung =
      String(strangSpitze.commit.message ?? '').trim() === String(beschriftung ?? '').trim()
    if (gleicheBeschriftung) {
      // Mit ausgenommenen Bereichen (BAUPLAN 46) gilt die Bedingung in ZWEI
      // Teilen: Außerhalb der Bereiche muss der Ordner auf der Strangspitze
      // stehen (wie bisher) — und INNERHALB muss die Strangspitze auf dem
      // Basis-Stand von 'haupt' stehen, denn genau der wird durch das Vorziehen
      // zur Spitze von 'haupt'. Ein Strangpunkt, der dort fremden Halbstand
      // trägt (ein Punkt, der ohne Ausnahme angelegt wurde), darf nicht
      // vorgezogen werden; dann entsteht der Punkt mit zwei Eltern, und dessen
      // Einsammeln setzt die Bereiche auf 'haupt'.
      const { geaendert } = await standEinsammeln(projektPfad, gitdir, strangRef, strangSpitze, {
        ausgenommen: bereiche
      })
      const bereicheAufBasis =
        bereiche.length === 0 ||
        !(await punkteWeichenAbIn(projektPfad, gitdir, hauptSpitze?.oid ?? null, strangSpitze.oid, bereiche))
      if (!geaendert && bereicheAufBasis && (await hauptIstVorfahr(gitdir, hauptSpitze, strangSpitze))) {
        await git.writeRef({ fs, gitdir, ref: hauptRef, value: strangSpitze.oid, force: true })
        await strangEntfernen(gitdir, zweig)
        // neu: false — es ist wirklich kein neuer Punkt entstanden; der Punkt
        // des Blocks IST jetzt die Spitze von 'haupt'.
        return { ok: true, neu: false, id: strangSpitze.oid, ausgenommenDateien: 0 }
      }
    }
    // Sonst gegen 'haupt' einsammeln, nicht gegen den Strang: Der Baum soll den
    // ganzen Arbeitsordner tragen, auch die Dateien außerhalb des Wirkbereichs
    // — außer den ausgenommenen Bereichen, die auf der Spitze von 'haupt'
    // bleiben (BAUPLAN 46).
    const { ausgenommenDateien } = await standEinsammeln(projektPfad, gitdir, hauptRef, hauptSpitze, {
      ausgenommen: bereiche
    })
    const id = await git.commit({
      fs,
      dir: projektPfad,
      gitdir,
      ref: hauptRef,
      message: beschriftung,
      author: AUTOR,
      parent: hauptSpitze ? [hauptSpitze.oid, strangSpitze.oid] : [strangSpitze.oid]
    })
    await strangEntfernen(gitdir, zweig)
    return { ok: true, neu: true, id, ausgenommenDateien }
  } catch {
    // Auch hier der eigene Text: Es scheitert die Zusammenführung mitten im
    // Lauf, nicht der Laufstart — und der Strang bleibt bewusst stehen (siehe
    // straengeAufraeumen), damit ein zweiter Anlauf ihn noch findet.
    return { ok: false, fehler: texte.sicherungen.fehlerStrangZusammenfuehren }
  }
}

// Trägt dieser Strang Punkte, die es sonst nirgends gibt — ist die
// Zusammenführung also ausgeblieben? Gemessen an der Erreichbarkeit: Enthält
// 'haupt' die Strangspitze bereits, ist der Strang bloß ein liegengebliebener
// Zeiger.
//
// Dieselbe Frage entscheidet an zwei Stellen: ob ein Strang beim Aufräumen
// eingeholt statt gelöscht wird — und ob eine Zusammenführung überhaupt eine
// ist. Beide Male ist die Antwort dieselbe, deshalb steht die Rechnung hier
// einmal.
async function strangUnzusammengefuehrt(gitdir, hauptSpitze, spitze) {
  if (!spitze) return false
  if (!hauptSpitze) return true
  if (spitze.oid === hauptSpitze.oid) return false
  try {
    return !(await git.isDescendent({
      fs,
      gitdir,
      oid: hauptSpitze.oid,
      ancestor: spitze.oid,
      depth: -1
    }))
  } catch {
    // Nicht entscheidbar heißt: stehenlassen. Ein Strang zu viel kostet nichts,
    // ein weggeworfener Punkt ist verlorene Arbeit.
    return true
  }
}

// Holt einen Strang ein, der Arbeit festhält, die 'haupt' nicht kennt: Sein
// Punkt wandert in die gemeinsame Kette und steht damit in Georgs Liste.
// Antwort: 'nichts' (es gab nichts einzuholen), 'eingeholt' (der Ref ist dabei
// weggeräumt worden) oder 'klemmt'.
//
// Bloßes Stehenlassen nützte Georg zu keinem Zeitpunkt etwas — gemessen: Ein
// Punkt, der nur auf einem Strang liegt, taucht in sicherungspunkteLaden gar
// nicht auf (die Liste wandert von 'haupt' aus), und es gibt keinen Weg, der
// einen Strang aus einem FRÜHEREN Lauf noch zusammenführt. „Aufbewahrt" hieß
// damit: unsichtbar, bis das nächste Öffnen desselben Namens ihn abschnitt.
//
// Die Beschriftung erbt der gemeinsame Punkt vom geretteten, und das ist keine
// Sparsamkeit: Steht der Arbeitsordner noch genau auf diesem Punkt — der
// Regelfall unmittelbar nach einem Abbruch —, zieht strangZusammenfuehren
// 'haupt' dann einfach vor, statt einen zweiten Eintrag mit demselben Stand
// anzulegen.
//
// Einen Haken für einen eigenen Rettungs-Satz von außen gibt es deshalb
// ausdrücklich NICHT: Eine mitgegebene Beschriftung wäre zwangsläufig eine
// andere als die des geretteten Punkts, hebelte damit das Vorziehen aus und
// erzwänge je Rettung zwei Einträge mit demselben Ordnerstand — genau das
// Doppel, das SPEC §3.3 abschafft.
async function strangEinholen(projektPfad, gitdir, zweig) {
  const spitze = await neuesterPunkt(gitdir, 'refs/heads/' + zweig)
  const hauptSpitze = await neuesterPunkt(gitdir, refFuer(null))
  if (!(await strangUnzusammengefuehrt(gitdir, hauptSpitze, spitze))) return 'nichts'
  const eingeholt = await strangZusammenfuehrenIntern(
    projektPfad,
    zweig,
    String(spitze.commit.message ?? '').trim()
  )
  return eingeholt.ok ? 'eingeholt' : 'klemmt'
}

// Räumt liegengebliebene Stränge weg — beim Laufstart und nach einem Absturz.
// 'haupt' kann davon nicht getroffen werden: Stränge tragen einen eigenen
// Namensvorsatz, das ist keine Ausnahme, sondern die Bauform.
//
// Drei Ausgänge, und die Unterscheidung ist der ganze Witz:
//   entfernt  — der Strang war ein liegengebliebener Zeiger, 'haupt' kannte
//               seinen Punkt längst. Löschen kostet nichts.
//   eingeholt — er hielt den Blockende-Punkt eines Anlaufs fest, dessen
//               Zusammenführung geklemmt hat. Der Punkt wandert JETZT in die
//               gemeinsame Kette und steht danach in Georgs Liste; erst dann
//               wird der Ref weggeräumt.
//   behalten  — auch das Einholen klemmte. Nur hier bleibt der Strang wirklich
//               stehen, und nur hier darf der Lauf von Erhaltung sprechen.
//
// `hauptSpitze` wird je Durchgang frisch gelesen: Jedes Einholen bewegt 'haupt'.
export function straengeAufraeumen(projektPfad) {
  return nacheinander(projektPfad, () => straengeAufraeumenIntern(projektPfad))
}

async function straengeAufraeumenIntern(projektPfad) {
  try {
    const gitdir = gitVerzeichnis(projektPfad)
    if (!fs.existsSync(path.join(gitdir, 'HEAD')))
      return { ok: true, entfernt: 0, eingeholt: 0, behalten: 0 }
    let entfernt = 0
    let eingeholt = 0
    let behalten = 0
    for (const zweig of await git.listBranches({ fs, gitdir })) {
      if (!zweig.startsWith(STRANG_PRAEFIX)) continue
      const lage = await strangEinholen(projektPfad, gitdir, zweig)
      if (lage === 'eingeholt') {
        eingeholt++
        continue
      }
      if (lage === 'klemmt') {
        behalten++
        continue
      }
      await git.deleteBranch({ fs, gitdir, ref: zweig })
      entfernt++
    }
    return { ok: true, entfernt, eingeholt, behalten }
  } catch {
    return { ok: false, entfernt: 0, eingeholt: 0, behalten: 0 }
  }
}

// Aus dem rohen git.log wird die Liste, die Georg sieht. Zwei Schritte, beide
// nötig und keiner davon Kosmetik:
//
// (1) Entdoppeln. git.log wandert nach einer Zusammenführung über ALLE
//     Elternpfade — über den Strang UND über 'haupt' — und hat nur eine Sperre
//     gegen Dopplungen in seiner aktuellen Warteschlange. Jeder Punkt vor der
//     Verzweigung kommt dadurch mehrfach: Georg sähe denselben Stand zweimal,
//     und die Oberfläche rendert doppelte React-Schlüssel.
//
// (2) Ordnen. Ein reines Sortieren nach Zeit trägt nicht: isomorphic-git
//     schreibt Zeitstempel sekundengenau, und in einer Sekunde passieren im
//     Lauf mehrere Punkte. Bei Gleichstand bliebe die Wanderreihenfolge von
//     git.log stehen — gemessen stand der ÄLTESTE Punkt dann mitten in der
//     Liste, vor zwei jüngeren, und keine Sortierung nach gleichen Zahlen kann
//     das richten. Geordnet wird deshalb nach dem AUFBAU der Kette: Ein Punkt
//     kommt erst dran, wenn alle Punkte, die auf ihm aufbauen, schon dran
//     waren. Ein Vorfahr steht damit nie vor seinem Nachfolger, egal was die
//     Uhr sagt. Unter den jeweils bereiten Punkten gewinnt der jüngste; bei
//     gleicher Sekunde entscheidet die Wanderreihenfolge von git.log, damit das
//     Ergebnis eindeutig statt zufällig ist.
function punkteOrdnen(eintraege) {
  const knoten = new Map()
  for (const eintrag of eintraege ?? []) {
    if (knoten.has(eintrag.oid)) continue
    knoten.set(eintrag.oid, {
      punkt: {
        id: eintrag.oid,
        beschriftung: eintrag.commit.message.trim(),
        zeit: eintrag.commit.committer.timestamp * 1000
      },
      eltern: eintrag.commit.parent ?? [],
      rang: knoten.size,
      // Wie viele Nachfolger stehen noch aus? Solange die Zahl über null liegt,
      // ist dieser Punkt nicht dran.
      offen: 0
    })
  }
  for (const eintrag of knoten.values())
    for (const elternId of eintrag.eltern) {
      const eltern = knoten.get(elternId)
      if (eltern) eltern.offen++
    }
  const bereit = [...knoten.values()].filter((eintrag) => eintrag.offen === 0)
  const punkte = []
  while (bereit.length) {
    bereit.sort((a, b) => b.punkt.zeit - a.punkt.zeit || a.rang - b.rang)
    const dran = bereit.shift()
    punkte.push(dran.punkt)
    for (const elternId of dran.eltern) {
      const eltern = knoten.get(elternId)
      if (eltern && --eltern.offen === 0) bereit.push(eltern)
    }
  }
  // Sicherheitsnetz gegen beschädigte Daten: Käme je ein Kreis zustande, blieben
  // Punkte liegen. Lieber unsortiert hinten dran als aus der Liste verschwunden
  // — Georg soll jeden Stand wiederherstellen können, den es gibt.
  if (punkte.length < knoten.size) {
    const gesehen = new Set(punkte.map((punkt) => punkt.id))
    for (const eintrag of knoten.values())
      if (!gesehen.has(eintrag.punkt.id)) punkte.push(eintrag.punkt)
  }
  return punkte
}

// Die Liste für die Oberfläche: jeder Punkt genau einmal, jüngster zuerst.
// In der Warteschlange, damit die Liste nie zwischen writeRef und deleteBranch
// einer laufenden Zusammenführung gelesen wird.
export function sicherungspunkteLaden(projektPfad) {
  return nacheinander(projektPfad, async () => {
    try {
      const gitdir = gitVerzeichnis(projektPfad)
      if (!fs.existsSync(path.join(gitdir, 'HEAD'))) return { ok: true, punkte: [] }
      return { ok: true, punkte: punkteOrdnen(await git.log({ fs, gitdir, ref: refFuer(null) })) }
    } catch {
      return { ok: true, punkte: [] }
    }
  })
}

// Ist das wirklich ein Punkt? git.walk mit TREE({ ref }) meldet für eine
// unbekannte oder leere Kennung KEINEN Fehler, sondern einen leeren Baum — und
// dann sähe jede Datei im Ordner aus wie „nur-ordner", also zu löschen. Ein
// Wiederherstellen auf 'deadbeef' oder '' räumte so den Projektordner (bzw. den
// Bereich) leer und meldete danach ok (Prüferbefund zu Bauschritt 46). Deshalb
// wird die Kennung VOR jedem Vergleich gelesen; klemmt das, wirft die Funktion,
// und die Aufrufer melden ok:false, bevor irgendetwas angewandt wurde.
async function punktSicherstellen(gitdir, punktId) {
  if (!punktId || typeof punktId !== 'string') throw new Error('kein Sicherungspunkt')
  await git.readCommit({ fs, gitdir, oid: punktId })
}

// Unterschiede zwischen einem Sicherungspunkt und dem jetzigen Projektordner.
// art: 'anders' (Datei wird zurückgesetzt), 'nur-sicherung' (kommt zurück),
// 'nur-ordner' (verschwindet beim Wiederherstellen).
async function unterschiede(projektPfad, gitdir, punktId) {
  await punktSicherstellen(gitdir, punktId)
  const liste = await git.walk({
    fs,
    dir: projektPfad,
    gitdir,
    trees: [TREE({ ref: punktId }), WORKDIR()],
    map: async (dateipfad, [sicherung, ordner]) => {
      if (dateipfad === '.') return undefined
      if (ausgeschlossen(dateipfad)) return null
      const sicherungTyp = sicherung ? await sicherung.type() : null
      const ordnerTyp = ordner ? await ordner.type() : null
      if (sicherungTyp === 'blob' && ordnerTyp === 'blob') {
        const punktOid = await sicherung.oid()
        if (punktOid === (await ordner.oid())) return undefined
        return { pfad: dateipfad, art: 'anders', blobOid: punktOid }
      }
      if (sicherungTyp === 'blob')
        // Im Punkt eine Datei — im Ordner nichts oder ein Unterordner (dessen
        // Inhalte tauchen beim Weiterlaufen als 'nur-ordner' auf).
        return { pfad: dateipfad, art: 'nur-sicherung', blobOid: await sicherung.oid() }
      if (ordnerTyp === 'blob') return { pfad: dateipfad, art: 'nur-ordner' }
      return undefined
    }
  })
  return liste ?? []
}

// Räumt nach dem Löschen einer Datei leere Elternordner weg (bis zur Projektwurzel).
function leereOrdnerAufraeumen(projektPfad, relativerPfad) {
  let ordner = path.dirname(path.join(projektPfad, relativerPfad))
  const wurzel = path.resolve(projektPfad)
  while (path.resolve(ordner) !== wurzel) {
    try {
      fs.rmdirSync(ordner) // schlägt bei nicht-leerem Ordner fehl — dann fertig
    } catch {
      return
    }
    ordner = path.dirname(ordner)
  }
}

async function anwenden(projektPfad, gitdir, liste) {
  // Erst löschen, dann schreiben — falls eine Datei einem Ordner weichen muss.
  for (const eintrag of liste) {
    if (eintrag.art !== 'nur-ordner') continue
    fs.rmSync(path.join(projektPfad, eintrag.pfad), { force: true, recursive: true })
    leereOrdnerAufraeumen(projektPfad, eintrag.pfad)
  }
  for (const eintrag of liste) {
    if (eintrag.art === 'nur-ordner') continue
    const ziel = path.join(projektPfad, eintrag.pfad)
    if (fs.existsSync(ziel) && fs.statSync(ziel).isDirectory())
      fs.rmSync(ziel, { force: true, recursive: true })
    fs.mkdirSync(path.dirname(ziel), { recursive: true })
    const { blob } = await git.readBlob({ fs, gitdir, oid: eintrag.blobOid })
    fs.writeFileSync(ziel, Buffer.from(blob))
  }
}

export function wiederherstellenVorschau(projektPfad, punktId) {
  return nacheinander(projektPfad, async () => {
    try {
      const gitdir = await repoOeffnen(projektPfad)
      const liste = await unterschiede(projektPfad, gitdir, punktId)
      return {
        ok: true,
        unterschiede: liste.map(({ pfad, art }) => ({ pfad, art }))
      }
    } catch {
      return { ok: false, fehler: texte.sicherungen.fehlerVorschau }
    }
  })
}

export function wiederherstellen(projektPfad, punktId) {
  return nacheinander(projektPfad, async () => {
    try {
      const gitdir = await repoOeffnen(projektPfad)
      // Erst die Kennung prüfen — vor dem Sicherheitsnetz, damit ein Tippfehler
      // nicht einmal einen Punkt anlegt (siehe punktSicherstellen).
      await punktSicherstellen(gitdir, punktId)
      // Sicherheitsnetz: den jetzigen Stand festhalten, falls er noch ungesichert ist —
      // so ist auch eine Wiederherstellung selbst wieder rückgängig zu machen.
      const netz = await sicherungspunktAnlegenIntern(
        projektPfad,
        texte.sicherungen.beschriftungVorWiederherstellung
      )
      if (!netz.ok) return { ok: false, fehler: texte.sicherungen.fehlerWiederherstellen }
      const liste = await unterschiede(projektPfad, gitdir, punktId)
      if (liste.length) {
        await anwenden(projektPfad, gitdir, liste)
        const punkt = await git.readCommit({ fs, gitdir, oid: punktId })
        const zeitText = new Date(punkt.commit.committer.timestamp * 1000).toLocaleString('de-DE', {
          dateStyle: 'short',
          timeStyle: 'short'
        })
        await sicherungspunktAnlegenIntern(
          projektPfad,
          texte.sicherungen.beschriftungWiederhergestellt(zeitText)
        )
      }
      return { ok: true }
    } catch {
      return { ok: false, fehler: texte.sicherungen.fehlerWiederherstellen }
    }
  })
}

// Wiederherstellen NUR innerhalb eines Bereichs (BAUPLAN 46): Die Folgen-Frage
// „Stand wiederherstellen" gilt jetzt je Zweig — zurückgesetzt werden allein
// die Wirkbereiche der Blöcke dieses Zweigs (`nurPfade`: Dateilisten und
// Prüfordner), während die erfolgreichen Zweige nebenan stehenbleiben. Bis
// Bauschritt 45 traf „Stand wiederherstellen" den ganzen Ordner — auch die
// Arbeit, die längst abgenommen war. Innerhalb des Bereichs geschieht alles,
// was wiederherstellen auch tut: ändern, anlegen UND löschen; außerhalb wird
// nichts angefasst.
//
// Vorher entsteht dasselbe Sicherheitsnetz wie bei wiederherstellen (der
// jetzige Stand, falls ungesichert) — `ausgenommen` hält dabei die
// Wirkbereiche der noch laufenden Schreiber auf dem Basis-Stand, wie jeder
// andere Punkt in der Welle. Rückgabe: { ok, dateien, uebersprungen } — was
// im Bereich zurückging und was außerhalb lag und deshalb blieb.
export function wiederherstellenBereich(projektPfad, punktId, { nurPfade = [], ausgenommen = [] } = {}) {
  return nacheinander(projektPfad, async () => {
    try {
      const bereiche = Array.isArray(nurPfade) ? nurPfade.filter(Boolean) : []
      // Ohne Bereich ist es kein Bereichs-Rückroll: lieber gar nichts anfassen
      // als still den ganzen Ordner — dafür gibt es wiederherstellen.
      if (bereiche.length === 0) return { ok: true, dateien: 0, uebersprungen: 0 }
      const gitdir = await repoOeffnen(projektPfad)
      await punktSicherstellen(gitdir, punktId)
      const netz = await sicherungspunktAnlegenIntern(
        projektPfad,
        texte.sicherungen.beschriftungVorWiederherstellung,
        { ausgenommen }
      )
      if (!netz.ok) return { ok: false, fehler: texte.sicherungen.fehlerWiederherstellen }
      const liste = await unterschiede(projektPfad, gitdir, punktId)
      const imBereich = liste.filter((eintrag) => stehtInDateiliste(eintrag.pfad, projektPfad, bereiche))
      if (imBereich.length) await anwenden(projektPfad, gitdir, imBereich)
      return { ok: true, dateien: imBereich.length, uebersprungen: liste.length - imBereich.length }
    } catch {
      return { ok: false, fehler: texte.sicherungen.fehlerWiederherstellen }
    }
  })
}

// ——— Diff für Reparatur-Runden (BAUPLAN 34) ————————————————————————————————
// Zusätzlich zu den ohnehin ausgeschlossenen Ordnern bleibt die Prüfmappe
// draußen: Die Prüfer-Tests liegen beim Rückführen uncommittet im Ordner (die
// Rückführung kehrt vor dem „nach Prüfer"-Punkt zurück) und wanderten sonst
// als „Bauer-Änderung" in den Diff.
const DIFF_AUSGESCHLOSSEN = new Set(['pruefung'])

function diffAusgeschlossen(dateipfad) {
  const erstes = dateipfad.split('/')[0]
  return AUSGESCHLOSSEN.has(erstes) || DIFF_AUSGESCHLOSSEN.has(erstes)
}

// Auf welchem Sicherungspunkt steht der Projektordner gerade? Grundlage für
// „Das hast du in diesem Lauf bisher geändert" — null, wenn es noch keinen gibt.
// Mit `strang` die Spitze DIESES Schreibers statt der von 'haupt'.
export function letzterPunktId(projektPfad, strang = null) {
  return nacheinander(projektPfad, async () => {
    try {
      const gitdir = gitVerzeichnis(projektPfad)
      if (!fs.existsSync(path.join(gitdir, 'HEAD'))) return null
      return (await neuesterPunkt(gitdir, refFuer(strang)))?.oid ?? null
    } catch {
      return null
    }
  })
}

// Weicht der Projektordner schon vom letzten Sicherungspunkt ab? Ehrliche
// Grenze des Diffs: Hat vorher ein nur-lesender Block per Befehl Dateien
// verändert, zählt das mit — dann steht das als Hinweis im Auftrag.
export function standWeichtAb(projektPfad, strang = null) {
  return nacheinander(projektPfad, async () => {
    try {
      const gitdir = gitVerzeichnis(projektPfad)
      if (!fs.existsSync(path.join(gitdir, 'HEAD'))) return false
      const kopf = await neuesterPunkt(gitdir, refFuer(strang))
      if (!kopf) return false
      const liste = await unterschiede(projektPfad, gitdir, kopf.oid)
      return liste.some((eintrag) => !diffAusgeschlossen(eintrag.pfad))
    } catch {
      return false
    }
  })
}

// Bis hierhin gilt eine Datei als Text — darüber (oder bei einem NUL-Byte)
// gibt es nur die Zeilenbilanz, keinen Ausschnitt.
const TEXT_MAX_BYTES = 400_000

async function inhaltVonBlob(gitdir, oid) {
  const { blob } = await git.readBlob({ fs, gitdir, oid })
  if (blob.length > TEXT_MAX_BYTES) return { binaer: true }
  if (blob.includes(0)) return { binaer: true }
  return { text: Buffer.from(blob).toString('utf8') }
}

// Unterschied zwischen zwei Sicherungspunkten: Dateiliste mit Zeilenbilanz und
// Ausschnitten der geänderten Stellen. Zwei TREE-Bäume wie die
// Wiederherstellen-Vorschau — kein git.exe nötig.
//
// `nurDateien` (BAUPLAN 45) filtert auf den Wirkbereich EINES Schreibers: Sein
// Diff soll zeigen, was ER geändert hat, nicht was gleichzeitig sonst noch im
// Ordner passiert ist. `ausserhalb` zählt, wie viele geänderte Dateien dabei
// weggefallen sind — der Ticker sagt das ehrlich dazu, sonst hielte der Leser
// einen gefilterten Diff für den ganzen.
export function punkteVergleichen(projektPfad, vonId, bisId, optionen = {}) {
  return nacheinander(projektPfad, () => punkteVergleichenIntern(projektPfad, vonId, bisId, optionen))
}

async function punkteVergleichenIntern(projektPfad, vonId, bisId, { nurDateien = null } = {}) {
  try {
    const gitdir = gitVerzeichnis(projektPfad)
    if (!fs.existsSync(path.join(gitdir, 'HEAD')))
      return { ok: false, dateien: [], ausserhalb: 0 }
    const roh = await git.walk({
      fs,
      dir: projektPfad,
      gitdir,
      trees: [TREE({ ref: vonId }), TREE({ ref: bisId })],
      map: async (dateipfad, [vorher, nachher]) => {
        if (dateipfad === '.') return undefined
        if (diffAusgeschlossen(dateipfad)) return null
        const vorherTyp = vorher ? await vorher.type() : null
        const nachherTyp = nachher ? await nachher.type() : null
        if (vorherTyp !== 'blob' && nachherTyp !== 'blob') return undefined
        const vorherOid = vorherTyp === 'blob' ? await vorher.oid() : null
        const nachherOid = nachherTyp === 'blob' ? await nachher.oid() : null
        if (vorherOid && nachherOid && vorherOid === nachherOid) return undefined
        return { pfad: dateipfad, vorherOid, nachherOid }
      }
    })
    const wirkbereich = Array.isArray(nurDateien) ? nurDateien.filter(Boolean) : []
    const dateien = []
    let ausserhalb = 0
    for (const eintrag of roh ?? []) {
      // git.walk liefert Pfade relativ zur Wurzel mit Schrägstrichen vorwärts,
      // die Dateiliste kommt als Modelltext — deshalb rechnet das die eine
      // gemeinsame Stelle aus (stehtInDateiliste), nie ein liste.includes().
      if (wirkbereich.length && !stehtInDateiliste(eintrag.pfad, projektPfad, wirkbereich)) {
        ausserhalb++
        continue
      }
      const alt = eintrag.vorherOid ? await inhaltVonBlob(gitdir, eintrag.vorherOid) : null
      const neu = eintrag.nachherOid ? await inhaltVonBlob(gitdir, eintrag.nachherOid) : null
      dateien.push(dateiUnterschied(eintrag.pfad, alt, neu))
    }
    dateien.sort((a, b) => a.pfad.localeCompare(b.pfad, 'de'))
    return { ok: true, dateien, ausserhalb }
  } catch {
    return { ok: false, dateien: [], ausserhalb: 0 }
  }
}

// Nach einem harten Abbruch: Projektordner zurück auf den letzten Sicherungspunkt
// (BAUPLAN 3/4) — halbfertige Änderungen des abgebrochenen Blocks verschwinden.
//
// `strang` (BAUPLAN 45) zielt auf die Spitze DIESES Schreibers statt auf 'haupt'.
//
// `geschuetzt` sind Pfade und Ordner, die der Rückroll nicht anfasst. Die
// Rechnung ist bewusst die UMKEHRUNG einer Beschränkung auf die eigene
// Dateiliste: Ausgeführte Befehle (npm run build) und der eigene Schreibpfad der
// lokalen KI schreiben laut BAUPLAN 44 ausdrücklich an der Dateilisten-Sperre
// vorbei. Ein Rückroll, der nur die eigene Liste anfasst, ließe deren Gebastel
// liegen — und der Agent baute darauf weiter, in dem Glauben, es sei weg.
// Also: ALLES anfassen, AUSSER den Wirkbereichen der anderen Block-Instanzen
// dieses Laufs. `geschuetztUebersprungen` zählt, was dadurch stehengeblieben
// ist, damit der Ticker es sagen kann.
//
// Die zweite Bremse gilt dem ÜBERHOLTEN ANKER (Nacharbeit zu BAUPLAN 45). Seit
// ein Strang offen bleibt, solange derselbe Block gleich wieder läuft, liegen
// mehrere Stränge gleichzeitig offen. Führt einer davon zusammen, zeigt der
// Anker des wartenden auf einen Ordnerstand von VOR dieser Zusammenführung —
// ein Rückroll darauf nähme die fertige, längst eingeholte Arbeit des anderen
// Blocks mit aus dem Ordner. Gemessen genau so, bevor diese Bremse dazukam: Die
// Datei des zweiten Schreibers stand danach wieder auf ihrem Ausgangsstand,
// während ihr Punkt weiter in Georgs Liste stand und kein Wort davon fiel.
//
// Erkannt wird das an derselben Frage wie beim Zusammenführen: Steckt die
// jetzige Spitze von 'haupt' noch in der Vorgeschichte des Ankers? Wenn nicht,
// ist 'haupt' seither eigene Wege gegangen.
//
// Aussieben kann der Unterbau an dieser Stelle NICHT selbst, und das ist keine
// Bequemlichkeit: Die Zusammenführung des anderen Blocks friert den ganzen
// Arbeitsordner ein, das Gebastel dieses Blocks steht danach im selben
// gemeinsamen Punkt wie die fremde Arbeit. Zwischen Anker und 'haupt' sehen
// beide Dateien gleich aus (gemessen in sicherungsstraenge.test.js). Wem eine
// Datei gehört, weiß allein der Lauf — deshalb kommt `eigenerBereich` von
// außen: Ist er benannt, wird nur darin zurückgenommen; sonst gar nichts.
// `fremdUebersprungen` zählt, was deshalb stehenblieb, und `standUeberholt`
// sagt warum — beides, damit der Rückroll nicht stumm weniger tut als versprochen.
//
// `eigenerBereich` greift ausdrücklich NUR beim überholten Anker. Als
// Dauer-Sperre wäre er genau der Fehler, vor dem der Absatz darüber warnt: Er
// ließe das Gebastel liegen, das an der Dateilisten-Sperre vorbei geschrieben
// wurde.
export function aufLetztenPunktZuruecksetzen(projektPfad, optionen = {}) {
  return nacheinander(projektPfad, () => aufLetztenPunktZuruecksetzenIntern(projektPfad, optionen))
}

async function aufLetztenPunktZuruecksetzenIntern(
  projektPfad,
  { strang = null, geschuetzt = null, eigenerBereich = null } = {}
) {
  try {
    const gitdir = await repoOeffnen(projektPfad)
    const kopf = await neuesterPunkt(gitdir, refFuer(strang))
    if (!kopf)
      return {
        ok: true,
        zurueckgesetzt: false,
        geschuetztUebersprungen: 0,
        standUeberholt: false,
        fremdUebersprungen: 0
      }
    const hauptSpitze = await neuesterPunkt(gitdir, refFuer(null))
    const standUeberholt = !(await hauptIstVorfahr(gitdir, hauptSpitze, kopf))
    const eigene = Array.isArray(eigenerBereich) ? eigenerBereich.filter(Boolean) : []
    const liste = await unterschiede(projektPfad, gitdir, kopf.oid)
    const bereiche = Array.isArray(geschuetzt) ? geschuetzt.filter(Boolean) : []
    const anzuwenden = []
    let geschuetztUebersprungen = 0
    let fremdUebersprungen = 0
    for (const eintrag of liste) {
      if (bereiche.length && stehtInDateiliste(eintrag.pfad, projektPfad, bereiche)) {
        geschuetztUebersprungen++
        continue
      }
      if (standUeberholt) {
        const imEigenen = eigene.length && stehtInDateiliste(eintrag.pfad, projektPfad, eigene)
        if (!imEigenen) {
          fremdUebersprungen++
          continue
        }
      }
      anzuwenden.push(eintrag)
    }
    if (anzuwenden.length) await anwenden(projektPfad, gitdir, anzuwenden)
    return {
      ok: true,
      zurueckgesetzt: anzuwenden.length > 0,
      geschuetztUebersprungen,
      standUeberholt,
      fremdUebersprungen
    }
  } catch {
    return { ok: false, fehler: texte.sicherungen.fehlerWiederherstellen }
  }
}
