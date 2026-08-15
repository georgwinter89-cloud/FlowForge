// FlowForge-Wissen für den Co-Pilot (BAUPLAN 33): Die SPEC.md ist die einzige
// Beschreibung der Gegenwart — sie wird mit der App gebündelt (extraResource
// neben dem asar, im Dev der Projektordner) und dem Chat als LESBARE DATEI
// bereitgestellt, nicht als Systemtext (28.000 Tokens je frischer Session
// wären Verschwendung). In den Systemtext wandert nur ein Abschnitts-Index
// mit Zeilenbereichen, damit der Chat gezielt liest. Kein zweites
// Bedien-Dokument (Doku-Regel).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function specPfad() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'SPEC.md')
  // Dev: out/main → ../../SPEC.md. In den Regel-Prüfungen (ESM) gibt es kein
  // __dirname — dann der Projektordner relativ zum Arbeitsverzeichnis.
  const hier = typeof __dirname === 'string' ? path.join(__dirname, '../../SPEC.md') : null
  return hier && fs.existsSync(hier) ? hier : path.resolve('SPEC.md')
}

// Reiner Index-Bau (prüfbar ohne Datei): Überschriften der Ebenen 2 und 3
// (## / ###) mit ihrem Zeilenbereich — die Zeilen sind 1-basiert wie beim
// Read-Werkzeug (offset/limit).
export function specIndexErzeugen(text) {
  const zeilen = String(text ?? '').split(/\r?\n/)
  const eintraege = []
  zeilen.forEach((zeile, i) => {
    const treffer = /^(#{2,3})\s+(.+?)\s*$/.exec(zeile)
    if (!treffer) return
    eintraege.push({ tiefe: treffer[1].length, titel: treffer[2], von: i + 1, bis: zeilen.length })
  })
  // Ein Abschnitt endet vor der nächsten Überschrift gleicher oder höherer Ebene.
  for (let i = 0; i < eintraege.length; i++) {
    for (let j = i + 1; j < eintraege.length; j++) {
      if (eintraege[j].tiefe <= eintraege[i].tiefe) {
        eintraege[i].bis = eintraege[j].von - 1
        break
      }
    }
  }
  return eintraege
}

export function specIndexText(eintraege) {
  return eintraege
    .map((e) => `${e.tiefe === 3 ? '  ' : ''}Zeilen ${e.von}–${e.bis}: ${e.titel}`)
    .join('\n')
}

// Zwischenspeicher je Änderungszeit der Datei — die SPEC ändert sich nur mit
// einer neuen FlowForge-Version.
let cache = null
export function specWissen() {
  const pfad = specPfad()
  let mtime = 0
  try {
    mtime = fs.statSync(pfad).mtimeMs
  } catch {
    return { pfad, vorhanden: false, indexText: '', zeilen: 0 }
  }
  if (cache && cache.pfad === pfad && cache.mtime === mtime) return cache.wissen
  let text = ''
  try {
    text = fs.readFileSync(pfad, 'utf8')
  } catch {
    return { pfad, vorhanden: false, indexText: '', zeilen: 0 }
  }
  const eintraege = specIndexErzeugen(text)
  const wissen = {
    pfad,
    vorhanden: true,
    indexText: specIndexText(eintraege),
    zeilen: text.split(/\r?\n/).length
  }
  cache = { pfad, mtime, wissen }
  return wissen
}
