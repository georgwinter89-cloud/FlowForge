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

// Diese Ordner gehören nicht in Sicherungspunkte: .git (eigenes Repo des Projekts),
// laufberichte (reines Nachschlagewerk — bleibt von Wiederherstellungen unberührt),
// node_modules (per Installation wiederherstellbar, viel zu groß).
const AUSGESCHLOSSEN = new Set(['.git', 'laufberichte', 'node_modules'])
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
