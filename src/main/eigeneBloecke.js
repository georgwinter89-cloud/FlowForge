// Eigene Blöcke (SPEC §4.5, BAUPLAN 14): vom Nutzer im Block-Editor gebaute
// Blöcke — global gespeichert (userData), damit sie in allen Projekten in der
// Bibliothek stehen. Die harten Regeln setzt blockRegeln.js durch; nach jeder
// Änderung wird die Registry in blockKatalog.js nachgezogen, damit Leinwand,
// Steck-Prüfung und Lauf die Blöcke auflösen können.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import { eigeneBloeckeSetzen, etikettNameSchluessel } from '../shared/blockKatalog.js'
import { pruefeEigenenBlock } from '../shared/blockRegeln.js'
import { projekteLaden } from './projekte.js'
import { workflowLaden } from './workflow.js'
import { laufZustand } from './lauf.js'

let bloecke = []

function dateiPfad() {
  return path.join(app.getPath('userData'), 'eigene-bloecke.json')
}

function speichern() {
  const tmp = dateiPfad() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(bloecke, null, 2), 'utf8')
  fs.renameSync(tmp, dateiPfad())
  eigeneBloeckeSetzen(bloecke)
}

// Beim App-Start aufrufen — VOR der IPC-Registrierung, denn workflowLaden
// wirft Blöcke, die es nicht auflösen kann, stillschweigend aus dem Schaubild.
export function eigeneBloeckeLaden() {
  let roh = []
  try {
    roh = JSON.parse(fs.readFileSync(dateiPfad(), 'utf8'))
  } catch {
    // Noch keine Datei — keine eigenen Blöcke.
  }
  bloecke = []
  for (const eintrag of Array.isArray(roh) ? roh : []) {
    if (typeof eintrag?.id !== 'string' || !eintrag.id.startsWith('eigen-')) continue
    if (bloecke.some((b) => b.id === eintrag.id)) continue
    const geprueft = pruefeEigenenBlock(eintrag)
    if (geprueft.fehler) continue
    bloecke.push({ id: eintrag.id, ...geprueft.block })
  }
  eigeneBloeckeSetzen(bloecke)
}

export function eigeneBloeckeListe() {
  return { ok: true, bloecke }
}

// In welchen bekannten Projekten liegt einer dieser Blöcke auf der Leinwand?
// Grundlage für die Lösch-Sperre: workflow.js würde einen unbekannt gewordenen
// Block beim nächsten Laden stillschweigend aus dem Schaubild werfen. Seit
// BAUPLAN 48 auch für mehrere Blöcke auf einmal — die Etiketten-Bibliothek
// fragt so, ob ein Projekt läuft, dessen Schaubild einen Block mit einem
// bestimmten Etikett trägt (Umbenenn-/Feldänderungs-Sperre).
export function projekteMitBloecken(blockIds) {
  const ids = new Set(Array.isArray(blockIds) ? blockIds : [])
  if (ids.size === 0) return []
  const treffer = []
  for (const projekt of projekteLaden().projekte) {
    if (!projekt.gefunden) continue
    const geladen = workflowLaden(projekt.pfad)
    if (geladen.ok && geladen.workflow.bloecke.some((b) => ids.has(b.blockId)))
      treffer.push(projekt)
  }
  return treffer
}

function projekteMitBlock(blockId) {
  return projekteMitBloecken([blockId])
}

// Welche eigenen Blöcke tragen dieses Etikett (braucht, brauchtOptional oder
// liefert, Schlüsselvergleich ohne Groß/Klein)? Grundlage der Lösch-Sperre für
// Etiketten (BAUPLAN 48) — diese Datei bleibt dabei etikettenfrei: Sie kennt
// nur ihre Blöcke, die Etiketten-Bibliothek wohnt in eigeneEtiketten.js (K2).
export function bloeckeMitEtikett(name) {
  const schluessel = etikettNameSchluessel(name)
  if (!schluessel) return []
  return bloecke.filter((b) =>
    [...(b.braucht ?? []), ...(b.brauchtOptional ?? []), ...(b.liefert ?? [])].some(
      (e) => etikettNameSchluessel(e) === schluessel
    )
  )
}

// Ein Etikett in ALLEN eigenen Blöcken umbenennen (BAUPLAN 48): braucht,
// brauchtOptional, liefert und die Schlüssel von brauchtWozu ziehen nach —
// sonst zeigte ein umbenanntes Etikett in der Bibliothek auf Blöcke, die es
// nicht mehr tragen, und der Lauf fände keine Lieferung mehr. Dieselbe
// Funktion zieht eine abweichende Schreibweise („prüfbeleg") auf die
// kanonische („Prüfbeleg"). Speichert und setzt die Registry; liefert
// { ok, bloecke, geaendert } — geaendert = Anzahl betroffener Blöcke.
export function etikettUmbenennen(alt, neu) {
  const schluessel = etikettNameSchluessel(alt)
  const neuerName = String(neu ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!schluessel || !neuerName) return { ok: true, bloecke, geaendert: 0 }
  const trifft = (e) => etikettNameSchluessel(e) === schluessel
  const liste = (eintraege) => {
    const ergebnis = []
    for (const e of Array.isArray(eintraege) ? eintraege : []) {
      const wert = trifft(e) ? neuerName : e
      if (!ergebnis.includes(wert)) ergebnis.push(wert)
    }
    return ergebnis
  }
  let geaendert = 0
  bloecke = bloecke.map((b) => {
    const betroffen = [...(b.braucht ?? []), ...(b.brauchtOptional ?? []), ...(b.liefert ?? [])].some(
      trifft
    )
    if (!betroffen) return b
    geaendert++
    const wozu = {}
    for (const [etikett, satz] of Object.entries(b.brauchtWozu ?? {}))
      wozu[trifft(etikett) ? neuerName : etikett] = satz
    return {
      ...b,
      braucht: liste(b.braucht),
      brauchtOptional: liste(b.brauchtOptional),
      liefert: liste(b.liefert),
      brauchtWozu: wozu
    }
  })
  if (geaendert > 0) speichern()
  return { ok: true, bloecke, geaendert }
}

export function eigenenBlockSpeichern(roh) {
  const geprueft = pruefeEigenenBlock(roh)
  if (geprueft.fehler) return { ok: false, fehler: geprueft.fehler }
  const vorhanden = typeof roh?.id === 'string' && bloecke.some((b) => b.id === roh.id)
  if (vorhanden) {
    // Kein Umbau eines Blocks, während ein Lauf ihn nutzt (SPEC §10 sinngemäß):
    // Die Definition wird beim Start jedes Blocks frisch aufgelöst — eine
    // Änderung mitten im Lauf würde den Rest des Laufs umschreiben.
    for (const projekt of projekteMitBlock(roh.id)) {
      const zustand = laufZustand(projekt.pfad)
      if (zustand.aktiv || zustand.wartet)
        return { ok: false, fehler: texte.blockEditor.fehlerWaehrendLauf(projekt.name) }
    }
  }
  const id = vorhanden ? roh.id : 'eigen-' + crypto.randomUUID()
  const neu = { id, ...geprueft.block }
  bloecke = vorhanden ? bloecke.map((b) => (b.id === id ? neu : b)) : [...bloecke, neu]
  speichern()
  return { ok: true, bloecke }
}

export function eigenenBlockLoeschen(id) {
  if (!bloecke.some((b) => b.id === id)) return { ok: false, fehler: texte.fehler.unbekannt }
  const verwendet = projekteMitBlock(id)
  if (verwendet.length > 0)
    return {
      ok: false,
      fehler: texte.blockEditor.fehlerNochVerwendet(verwendet.map((p) => p.name))
    }
  bloecke = bloecke.filter((b) => b.id !== id)
  speichern()
  return { ok: true, bloecke }
}
