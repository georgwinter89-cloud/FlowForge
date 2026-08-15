// Projekt- und Kartenverwaltung: legt Projektordner an, verwaltet die Liste
// bekannter Projekte und setzt die harten Kartenregeln durch (SPEC §3.1).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import {
  pruefeKarteneingabe,
  pruefeThema,
  themaNormalisieren,
  themaSchluessel,
  kanonischesThema,
  THEMEN_SORTEN,
  THEMA_MAX,
  TITEL_MAX,
  TEXT_MAX
} from '../shared/kartenRegeln.js'
import { sicherungspunktAnlegen } from './sicherungspunkte.js'
import { pruefkartenArchivLoeschen } from './pruefkarten.js'

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

// Karten eines Projekts lesen — genutzt von den Agenten-Werkzeugen (BAUPLAN 7)
// und der Kartenvorauswahl beim Lauf-Start.
export function kartenLaden(projektPfad) {
  if (!istBekanntesProjekt(projektPfad) || !fs.existsSync(projektPfad))
    return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  try {
    return { ok: true, karten: ladeKarten(projektPfad) }
  } catch {
    return { ok: false, fehler: texte.fehler.kartenDateiKaputt }
  }
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

export async function projektAnlegen(name, ablageort) {
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
  // Erster Sicherungspunkt direkt beim Anlegen — schlägt er fehl, bleibt das
  // Projekt trotzdem nutzbar; spätestens der nächste Lauf sichert erneut.
  await sicherungspunktAnlegen(pfad, texte.sicherungen.beschriftungProjektAngelegt)
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
    return {
      ok: true,
      projekt: { pfad, name: projekt.name, kontingentVerhalten: kontingentVerhaltenLaden(pfad) },
      karten
    }
  } catch {
    return { ok: false, fehler: texte.fehler.kartenDateiKaputt }
  }
}

// Kontingent-Verhalten pro Projekt (SPEC §5): Was passiert, wenn das
// Abo-Kontingent mitten im Lauf erschöpft ist — 'pausieren' (automatisch
// weitermachen, sobald wieder Kontingent da ist) oder 'stoppen'.
export function kontingentVerhaltenLaden(pfad) {
  try {
    const projekt = JSON.parse(fs.readFileSync(path.join(pfad, PROJEKT_DATEI), 'utf8'))
    return projekt.kontingentVerhalten === 'stoppen' ? 'stoppen' : 'pausieren'
  } catch {
    return 'pausieren'
  }
}

export function kontingentVerhaltenSetzen(pfad, verhalten) {
  if (!istBekanntesProjekt(pfad) || !fs.existsSync(path.join(pfad, PROJEKT_DATEI)))
    return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  try {
    const datei = path.join(pfad, PROJEKT_DATEI)
    const projekt = JSON.parse(fs.readFileSync(datei, 'utf8'))
    projekt.kontingentVerhalten = verhalten === 'stoppen' ? 'stoppen' : 'pausieren'
    schreibeJsonAtomar(datei, projekt)
    return { ok: true, kontingentVerhalten: projekt.kontingentVerhalten }
  } catch {
    return { ok: false, fehler: texte.fehler.unbekannt }
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

// Herkunft je Karte (BAUPLAN 30): Wer hat die Karte angelegt bzw. zuletzt
// geändert — und aus welchem Zweck? quelle: 'nutzer' (Seitenleiste), 'chat'
// (Nachlauf-Chat), 'kartenpruefer' (übernommener Vorschlag), 'flowforge'
// (Prüfkarten) oder 'block' (ein Block-Agent im Lauf). Bei Läufen dazu Block,
// Lauf-Kennung/-Start und die Aufgaben-Karten des Pakets (Titel als
// Schnappschuss — die Aufgabe kann später gelöscht werden). Die Herkunft
// wandert nie in Aufträge oder karten_uebersicht (Kontext).
const HERKUNFT_QUELLEN = new Set(['nutzer', 'chat', 'kartenpruefer', 'flowforge', 'block'])
export const HERKUNFT_NUTZER = Object.freeze({ quelle: 'nutzer' })

function herkunftBereinigen(roh) {
  const quelle = HERKUNFT_QUELLEN.has(roh?.quelle) ? roh.quelle : 'nutzer'
  const sauber = { quelle }
  if (typeof roh?.block === 'string' && roh.block.trim()) sauber.block = roh.block.trim().slice(0, 60)
  if (typeof roh?.laufId === 'string' && roh.laufId) sauber.laufId = roh.laufId
  if (typeof roh?.laufStart === 'string' && roh.laufStart) sauber.laufStart = roh.laufStart
  if (Array.isArray(roh?.aufgaben)) {
    const aufgaben = roh.aufgaben
      .filter((a) => a && typeof a.id === 'string')
      .map((a) => ({ id: a.id, titel: String(a.titel ?? '').slice(0, TITEL_MAX) }))
      .slice(0, 20)
    if (aufgaben.length) sauber.aufgaben = aufgaben
  }
  return sauber
}

function stempeln(karte, herkunft, jetzt, { neu = false } = {}) {
  const h = herkunftBereinigen(herkunft)
  karte.geaendertAm = jetzt
  if (neu) {
    karte.angelegtAm = jetzt
    karte.angelegtVon = h
  } else {
    karte.geaendertVon = h
  }
}

export function karteAnlegen(projektPfad, { sorte, titel, text, thema }, herkunft = HERKUNFT_NUTZER) {
  return mitKarten(projektPfad, (karten) => {
    // Prüfkarten legt nur FlowForge selbst an (BAUPLAN 18).
    if (sorte === 'pruefung')
      return { ok: false, fehler: texte.kartenRegeln.pruefkarteNurFlowForge }
    if (sorte === 'status' || !THEMEN_SORTEN.includes(sorte))
      return { ok: false, fehler: texte.kartenRegeln.statusUnantastbar }
    const fehler = pruefeKarteneingabe({ titel, text })
    if (fehler) return { ok: false, fehler }
    // Thema ist Pflicht beim Anlegen (BAUPLAN 30) — die Ablehnung nennt die
    // vorhandenen Themen, damit auch ein Agent, der nichts vom Thema weiß,
    // sofort einsortieren kann.
    const themaUrteil = pruefeThema(karten, thema, { pflicht: true })
    if (themaUrteil.fehler) return { ok: false, fehler: themaUrteil.fehler }
    const jetzt = new Date().toISOString()
    const karte = {
      id: crypto.randomUUID(),
      sorte,
      titel: titel.trim(),
      text: text.trim(),
      thema: themaUrteil.thema,
      ...(sorte === 'aufgabe' ? { erledigt: false } : {})
    }
    stempeln(karte, herkunft, jetzt, { neu: true })
    karten.push(karte)
  })
}

// thema: undefined = unverändert lassen; '' = (nur bei Karten ohne Thema
// erlaubt) leer lassen; sonst neues Thema. Alte Karten ohne Thema bleiben
// bearbeitbar, ohne dass ein Thema erzwungen wird (BAUPLAN 30).
export function karteAendern(projektPfad, id, { titel, text, thema }, herkunft = HERKUNFT_NUTZER) {
  return mitKarten(projektPfad, (karten) => {
    const karte = karten.find((k) => k.id === id)
    if (!karte) return { ok: false, fehler: texte.fehler.unbekannt }
    // Die Status-Karte behält ihren festen Titel — nur der Inhalt ist änderbar.
    const neuerTitel = karte.sorte === 'status' ? karte.titel : titel
    const fehler = pruefeKarteneingabe({ titel: neuerTitel, text })
    if (fehler) return { ok: false, fehler }
    let neuesThema = null
    if (thema !== undefined && THEMEN_SORTEN.includes(karte.sorte)) {
      const urteil = pruefeThema(karten, thema, { pflicht: Boolean(karte.thema) })
      if (urteil.fehler) return { ok: false, fehler: urteil.fehler }
      neuesThema = urteil.thema
    }
    karte.titel = neuerTitel.trim()
    karte.text = text.trim()
    if (neuesThema !== null) {
      if (neuesThema) karte.thema = neuesThema
      else delete karte.thema
    }
    stempeln(karte, herkunft, new Date().toISOString())
  })
}

export function karteErledigtSetzen(projektPfad, id, erledigt, herkunft = HERKUNFT_NUTZER) {
  return mitKarten(projektPfad, (karten) => {
    const karte = karten.find((k) => k.id === id)
    if (!karte) return { ok: false, fehler: texte.fehler.unbekannt }
    if (karte.sorte !== 'aufgabe')
      return { ok: false, fehler: texte.kartenRegeln.nurAufgabenErledigbar }
    karte.erledigt = Boolean(erledigt)
    stempeln(karte, herkunft, new Date().toISOString())
  })
}

// Nur das Thema einer Karte setzen (BAUPLAN 30): Drag & Drop in eine andere
// Themengruppe, Sammel-Dialog „Themen sortieren". Status- und Prüfkarten
// tragen kein Thema.
export function karteThemaSetzen(projektPfad, id, thema, herkunft = HERKUNFT_NUTZER) {
  return mitKarten(projektPfad, (karten) => {
    const karte = karten.find((k) => k.id === id)
    if (!karte) return { ok: false, fehler: texte.fehler.unbekannt }
    if (!THEMEN_SORTEN.includes(karte.sorte))
      return { ok: false, fehler: texte.kartenRegeln.keinThemaFuerSorte }
    const urteil = pruefeThema(karten, thema, { pflicht: true })
    if (urteil.fehler) return { ok: false, fehler: urteil.fehler }
    if (karte.thema === urteil.thema) return { ok: true, karten }
    karte.thema = urteil.thema
    stempeln(karte, herkunft, new Date().toISOString())
  })
}

// Thema umbenennen (BAUPLAN 30): alle Karten des Themas; Umbenennen auf einen
// vorhandenen Namen legt die Themen zusammen. Die Karten gelten dabei nicht
// als „geändert" — nur die Ordnung wechselt.
export function themaUmbenennen(projektPfad, altesThema, neuesThema) {
  return mitKarten(projektPfad, (karten) => {
    const altSchluessel = themaSchluessel(altesThema)
    if (!altSchluessel) return { ok: false, fehler: texte.fehler.unbekannt }
    const eingabe = themaNormalisieren(neuesThema)
    if (!eingabe) return { ok: false, fehler: texte.kartenRegeln.themaFehlt([]) }
    if (eingabe.length > THEMA_MAX)
      return { ok: false, fehler: texte.kartenRegeln.themaZuLang(THEMA_MAX, eingabe.length) }
    // Ziel: vorhandene Schreibweise eines anderen Themas (Zusammenlegen) —
    // oder die Eingabe selbst (auch reine Schreibweisen-Korrektur).
    const zielSchluessel = themaSchluessel(eingabe)
    const ziel =
      zielSchluessel === altSchluessel
        ? eingabe
        : kanonischesThema(
            karten.filter((k) => themaSchluessel(k.thema) !== altSchluessel),
            eingabe
          )
    for (const karte of karten)
      if (typeof karte.thema === 'string' && themaSchluessel(karte.thema) === altSchluessel)
        karte.thema = ziel
  })
}

export function karteLoeschen(projektPfad, id) {
  let geloeschte = null
  const ergebnis = mitKarten(projektPfad, (karten) => {
    const stelle = karten.findIndex((k) => k.id === id)
    if (stelle === -1) return { ok: false, fehler: texte.fehler.unbekannt }
    if (karten[stelle].sorte === 'status')
      return { ok: false, fehler: texte.kartenRegeln.statusUnantastbar }
    geloeschte = karten[stelle]
    karten.splice(stelle, 1)
  })
  // Löschen einer Prüfkarte räumt ihre aufbewahrten Prüfdateien mit weg
  // (BAUPLAN 18) — sonst sammelte sich verwaistes Archiv an.
  if (ergebnis.ok && geloeschte?.sorte === 'pruefung')
    pruefkartenArchivLoeschen(projektPfad, geloeschte.id)
  return ergebnis
}

// Prüfkarten (BAUPLAN 18): legt ausschließlich FlowForge selbst an — nach
// jeder bestandenen Prüfung. Die harten Längengrenzen gelten auch hier;
// FlowForge kürzt aber, statt zu scheitern — die Karte muss immer entstehen.
function gekuerztAuf(wert, max) {
  const sauber = String(wert ?? '').trim()
  return sauber.length > max ? sauber.slice(0, max - 2).trimEnd() + ' …' : sauber
}

export function pruefkarteAnlegen(projektPfad, { titel, text }, herkunft = { quelle: 'flowforge' }) {
  let karte = null
  const ergebnis = mitKarten(projektPfad, (karten) => {
    karte = {
      id: crypto.randomUUID(),
      sorte: 'pruefung',
      titel: gekuerztAuf(titel, TITEL_MAX),
      text: gekuerztAuf(text, TEXT_MAX)
    }
    stempeln(karte, herkunft, new Date().toISOString(), { neu: true })
    karten.push(karte)
  })
  return ergebnis.ok ? { ...ergebnis, karte } : ergebnis
}

// Prüfmappen-Ansicht (BAUPLAN 17): Was hat der letzte Lauf in pruefung/
// hinterlassen? Je Prüfdatei Name, Größe und Zuletzt-geändert — nur zum
// Nachlesen an der Prüferkarte; bearbeiten darf die Mappe weiterhin nur der
// Prüfer. Gezählt werden Prüf-Dateien, nicht einzelne Testfälle darin.
export function pruefmappeUebersicht(projektPfad) {
  if (!istBekanntesProjekt(projektPfad) || !fs.existsSync(projektPfad))
    return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const mappe = path.join(projektPfad, 'pruefung')
  const dateien = []
  function sammle(ordner) {
    let eintraege = []
    try {
      eintraege = fs.readdirSync(ordner, { withFileTypes: true })
    } catch {
      return
    }
    for (const eintrag of eintraege) {
      const voll = path.join(ordner, eintrag.name)
      if (eintrag.isDirectory()) {
        sammle(voll)
        continue
      }
      try {
        const info = fs.statSync(voll)
        dateien.push({
          name: path.relative(mappe, voll).replaceAll(path.sep, '/'),
          bytes: info.size,
          geaendertAm: info.mtime.toISOString()
        })
      } catch {
        // Eine gerade verschwundene Datei blockiert nicht die Liste.
      }
    }
  }
  sammle(mappe)
  dateien.sort((a, b) => (a.name < b.name ? -1 : 1))
  return { ok: true, dateien }
}
