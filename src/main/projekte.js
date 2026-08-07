// Projekt- und Kartenverwaltung: legt Projektordner an, verwaltet die Liste
// bekannter Projekte und setzt die harten Kartenregeln durch (SPEC §3.1).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import { pruefeKarteneingabe } from '../shared/kartenRegeln.js'

const PROJEKT_DATEI = 'projekt.json'
const KARTEN_DATEI = 'karten.json'

function registryPfad() {
  return path.join(app.getPath('userData'), 'projekte.json')
}

function ladeRegistry() {
  try {
    const daten = JSON.parse(fs.readFileSync(registryPfad(), 'utf8'))
    return Array.isArray(daten) ? daten : []
  } catch {
    return []
  }
}

// Absturz mitten im Schreiben darf keine halbe Datei hinterlassen:
// erst vollständig in eine Temp-Datei, dann in einem Zug umbenennen.
function schreibeJsonAtomar(pfad, daten) {
  const tmp = pfad + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
  fs.renameSync(tmp, pfad)
}

function speichereRegistry(liste) {
  schreibeJsonAtomar(registryPfad(), liste)
}

function istBekanntesProjekt(pfad) {
  return ladeRegistry().some((eintrag) => eintrag.pfad === pfad)
}

function ladeKarten(projektPfad) {
  const daten = JSON.parse(fs.readFileSync(path.join(projektPfad, KARTEN_DATEI), 'utf8'))
  if (!Array.isArray(daten)) throw new Error('karten.json ist keine Liste')
  return daten
}

function speichereKarten(projektPfad, karten) {
  schreibeJsonAtomar(path.join(projektPfad, KARTEN_DATEI), karten)
}

// Windows verbietet bestimmte Zeichen in Ordnernamen; Punkte/Leerzeichen am Ende ebenso.
function ordnernameAusProjektname(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[. ]+$/, '')
    .trim()
}

export function projektAnlegen(name, ablageort) {
  const projektName = (name ?? '').trim()
  if (!projektName) return { ok: false, fehler: texte.neuesProjekt.fehlerKeinName }
  if (!ablageort || !fs.existsSync(ablageort))
    return { ok: false, fehler: texte.neuesProjekt.fehlerKeinOrt }

  const ordnerName = ordnernameAusProjektname(projektName)
  if (!ordnerName) return { ok: false, fehler: texte.neuesProjekt.fehlerNameUnbrauchbar }

  const pfad = path.join(ablageort, ordnerName)
  if (fs.existsSync(pfad))
    return { ok: false, fehler: texte.neuesProjekt.fehlerOrdnerExistiert(pfad) }

  const jetzt = new Date().toISOString()
  fs.mkdirSync(pfad, { recursive: true })
  schreibeJsonAtomar(path.join(pfad, PROJEKT_DATEI), { name: projektName, angelegtAm: jetzt })
  speichereKarten(pfad, [
    {
      id: crypto.randomUUID(),
      sorte: 'status',
      titel: texte.statusKarte.titel,
      text: texte.statusKarte.startText,
      angelegtAm: jetzt,
      geaendertAm: jetzt
    }
  ])

  const registry = ladeRegistry()
  registry.push({ pfad })
  speichereRegistry(registry)
  return { ok: true, pfad }
}

export function projekteLaden() {
  const liste = ladeRegistry().map((eintrag) => {
    try {
      const projekt = JSON.parse(
        fs.readFileSync(path.join(eintrag.pfad, PROJEKT_DATEI), 'utf8')
      )
      return { pfad: eintrag.pfad, name: projekt.name, gefunden: true }
    } catch {
      return { pfad: eintrag.pfad, name: path.basename(eintrag.pfad), gefunden: false }
    }
  })
  return { ok: true, projekte: liste }
}

export function projektVergessen(pfad) {
  speichereRegistry(ladeRegistry().filter((eintrag) => eintrag.pfad !== pfad))
  return { ok: true }
}

export function projektOeffnen(pfad) {
  if (!istBekanntesProjekt(pfad) || !fs.existsSync(path.join(pfad, PROJEKT_DATEI)))
    return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  try {
    const projekt = JSON.parse(fs.readFileSync(path.join(pfad, PROJEKT_DATEI), 'utf8'))
    const karten = ladeKarten(pfad)
    return { ok: true, projekt: { pfad, name: projekt.name }, karten }
  } catch {
    return { ok: false, fehler: texte.fehler.kartenDateiKaputt }
  }
}

// Gemeinsamer Rahmen für alle Kartenänderungen: Projekt prüfen, Karten laden,
// ändern, speichern — und immer den neuen Gesamtstand zurückgeben.
function mitKarten(projektPfad, aenderung) {
  if (!istBekanntesProjekt(projektPfad) || !fs.existsSync(projektPfad))
    return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  let karten
  try {
    karten = ladeKarten(projektPfad)
  } catch {
    return { ok: false, fehler: texte.fehler.kartenDateiKaputt }
  }
  const ergebnis = aenderung(karten)
  if (ergebnis) return ergebnis
  speichereKarten(projektPfad, karten)
  return { ok: true, karten }
}

export function karteAnlegen(projektPfad, { sorte, titel, text }) {
  return mitKarten(projektPfad, (karten) => {
    if (sorte === 'status' || !['aufgabe', 'entscheidung', 'wissen'].includes(sorte))
      return { ok: false, fehler: texte.kartenRegeln.statusUnantastbar }
    const fehler = pruefeKarteneingabe({ titel, text })
    if (fehler) return { ok: false, fehler }
    const jetzt = new Date().toISOString()
    karten.push({
      id: crypto.randomUUID(),
      sorte,
      titel: titel.trim(),
      text: text.trim(),
      ...(sorte === 'aufgabe' ? { erledigt: false } : {}),
      angelegtAm: jetzt,
      geaendertAm: jetzt
    })
  })
}

export function karteAendern(projektPfad, id, { titel, text }) {
  return mitKarten(projektPfad, (karten) => {
    const karte = karten.find((k) => k.id === id)
    if (!karte) return { ok: false, fehler: texte.fehler.unbekannt }
    // Die Status-Karte behält ihren festen Titel — nur der Inhalt ist änderbar.
    const neuerTitel = karte.sorte === 'status' ? karte.titel : titel
    const fehler = pruefeKarteneingabe({ titel: neuerTitel, text })
    if (fehler) return { ok: false, fehler }
    karte.titel = neuerTitel.trim()
    karte.text = text.trim()
    karte.geaendertAm = new Date().toISOString()
  })
}

export function karteErledigtSetzen(projektPfad, id, erledigt) {
  return mitKarten(projektPfad, (karten) => {
    const karte = karten.find((k) => k.id === id)
    if (!karte) return { ok: false, fehler: texte.fehler.unbekannt }
    if (karte.sorte !== 'aufgabe')
      return { ok: false, fehler: texte.kartenRegeln.nurAufgabenErledigbar }
    karte.erledigt = Boolean(erledigt)
    karte.geaendertAm = new Date().toISOString()
  })
}

export function karteLoeschen(projektPfad, id) {
  return mitKarten(projektPfad, (karten) => {
    const stelle = karten.findIndex((k) => k.id === id)
    if (stelle === -1) return { ok: false, fehler: texte.fehler.unbekannt }
    if (karten[stelle].sorte === 'status')
      return { ok: false, fehler: texte.kartenRegeln.statusUnantastbar }
    karten.splice(stelle, 1)
  })
}
