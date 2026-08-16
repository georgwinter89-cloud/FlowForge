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

function ausgeschlossen(dateipfad) {
  return AUSGESCHLOSSEN.has(dateipfad.split('/')[0])
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

async function neuesterPunkt(gitdir) {
  try {
    const [eintrag] = await git.log({ fs, gitdir, ref: ZWEIG, depth: 1 })
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

// Legt einen Sicherungspunkt an — aber nur, wenn sich seit dem letzten etwas
// geändert hat. Gibt zurück, ob wirklich ein neuer Punkt entstanden ist, und
// die id des Punkts, der den jetzigen Stand festhält (neu oder schon vorhanden).
export async function sicherungspunktAnlegen(projektPfad, beschriftung) {
  try {
    const gitdir = await repoOeffnen(projektPfad)
    const kopf = await neuesterPunkt(gitdir)
    let geaendert = false
    if (!kopf) {
      for (const datei of alleDateien(projektPfad)) {
        await git.add({ fs, dir: projektPfad, gitdir, filepath: datei })
        geaendert = true
      }
    } else {
      const cache = {}
      const matrix = await git.statusMatrix({
        fs,
        dir: projektPfad,
        gitdir,
        cache,
        filter: (datei) => !ausgeschlossen(datei)
      })
      for (const [datei, imPunkt, imOrdner, imIndex] of matrix) {
        if (imPunkt === 1 && imOrdner === 1 && imIndex === 1) continue
        if (imOrdner === 0) await git.remove({ fs, dir: projektPfad, gitdir, cache, filepath: datei })
        else await git.add({ fs, dir: projektPfad, gitdir, cache, filepath: datei })
        // Nur echte Unterschiede zum letzten Punkt zählen — nicht bloß Index-Reste.
        if (imPunkt !== 1 || imOrdner !== 1) geaendert = true
      }
    }
    if (!geaendert) return { ok: true, neu: false, id: kopf?.oid ?? null }
    const id = await git.commit({ fs, dir: projektPfad, gitdir, message: beschriftung, author: AUTOR })
    return { ok: true, neu: true, id }
  } catch {
    return { ok: false, fehler: texte.sicherungen.fehlerAnlegen }
  }
}

export async function sicherungspunkteLaden(projektPfad) {
  try {
    const gitdir = gitVerzeichnis(projektPfad)
    if (!fs.existsSync(path.join(gitdir, 'HEAD'))) return { ok: true, punkte: [] }
    const eintraege = await git.log({ fs, gitdir, ref: ZWEIG })
    const punkte = eintraege.map((eintrag) => ({
      id: eintrag.oid,
      beschriftung: eintrag.commit.message.trim(),
      zeit: eintrag.commit.committer.timestamp * 1000
    }))
    return { ok: true, punkte }
  } catch {
    return { ok: true, punkte: [] }
  }
}

// Unterschiede zwischen einem Sicherungspunkt und dem jetzigen Projektordner.
// art: 'anders' (Datei wird zurückgesetzt), 'nur-sicherung' (kommt zurück),
// 'nur-ordner' (verschwindet beim Wiederherstellen).
async function unterschiede(projektPfad, gitdir, punktId) {
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

export async function wiederherstellenVorschau(projektPfad, punktId) {
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
}

export async function wiederherstellen(projektPfad, punktId) {
  try {
    const gitdir = await repoOeffnen(projektPfad)
    // Sicherheitsnetz: den jetzigen Stand festhalten, falls er noch ungesichert ist —
    // so ist auch eine Wiederherstellung selbst wieder rückgängig zu machen.
    const netz = await sicherungspunktAnlegen(
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
      await sicherungspunktAnlegen(
        projektPfad,
        texte.sicherungen.beschriftungWiederhergestellt(zeitText)
      )
    }
    return { ok: true }
  } catch {
    return { ok: false, fehler: texte.sicherungen.fehlerWiederherstellen }
  }
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
export async function letzterPunktId(projektPfad) {
  try {
    const gitdir = gitVerzeichnis(projektPfad)
    if (!fs.existsSync(path.join(gitdir, 'HEAD'))) return null
    return (await neuesterPunkt(gitdir))?.oid ?? null
  } catch {
    return null
  }
}

// Weicht der Projektordner schon vom letzten Sicherungspunkt ab? Ehrliche
// Grenze des Diffs: Hat vorher ein nur-lesender Block per Befehl Dateien
// verändert, zählt das mit — dann steht das als Hinweis im Auftrag.
export async function standWeichtAb(projektPfad) {
  try {
    const gitdir = gitVerzeichnis(projektPfad)
    if (!fs.existsSync(path.join(gitdir, 'HEAD'))) return false
    const kopf = await neuesterPunkt(gitdir)
    if (!kopf) return false
    const liste = await unterschiede(projektPfad, gitdir, kopf.oid)
    return liste.some((eintrag) => !diffAusgeschlossen(eintrag.pfad))
  } catch {
    return false
  }
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
export async function punkteVergleichen(projektPfad, vonId, bisId) {
  try {
    const gitdir = gitVerzeichnis(projektPfad)
    if (!fs.existsSync(path.join(gitdir, 'HEAD'))) return { ok: false, dateien: [] }
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
    const dateien = []
    for (const eintrag of roh ?? []) {
      const alt = eintrag.vorherOid ? await inhaltVonBlob(gitdir, eintrag.vorherOid) : null
      const neu = eintrag.nachherOid ? await inhaltVonBlob(gitdir, eintrag.nachherOid) : null
      dateien.push(dateiUnterschied(eintrag.pfad, alt, neu))
    }
    dateien.sort((a, b) => a.pfad.localeCompare(b.pfad, 'de'))
    return { ok: true, dateien }
  } catch {
    return { ok: false, dateien: [] }
  }
}

// Nach einem harten Abbruch: Projektordner zurück auf den letzten Sicherungspunkt
// (BAUPLAN 3/4) — halbfertige Änderungen des abgebrochenen Blocks verschwinden.
export async function aufLetztenPunktZuruecksetzen(projektPfad) {
  try {
    const gitdir = await repoOeffnen(projektPfad)
    const kopf = await neuesterPunkt(gitdir)
    if (!kopf) return { ok: true, zurueckgesetzt: false }
    const liste = await unterschiede(projektPfad, gitdir, kopf.oid)
    if (liste.length) await anwenden(projektPfad, gitdir, liste)
    return { ok: true, zurueckgesetzt: liste.length > 0 }
  } catch {
    return { ok: false, fehler: texte.sicherungen.fehlerWiederherstellen }
  }
}
