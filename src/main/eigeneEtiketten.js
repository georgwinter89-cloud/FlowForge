// Etiketten-Bibliothek (SPEC §4.5, BAUPLAN 48): eigene Etiketten — global
// gespeichert (userData, eigene-etiketten.json), damit sie in allen Projekten
// gelten, genau wie eigene Blöcke. Die harten Regeln setzt etikettRegeln.js
// durch; nach jeder Änderung wird die Registry in blockKatalog.js nachgezogen,
// damit Lieferschein (teilFuerEtikett), Werkzeug-Server und Block-Editor die
// Etiketten auflösen können.
//
// Import-Richtung (K2): Diese Datei importiert eigeneBloecke.js — nie
// umgekehrt. eigeneBloecke.js bleibt etikettenfrei und liefert nur
// Daten/Logik über Blöcke (bloeckeMitEtikett, etikettUmbenennen,
// projekteMitBloecken). Die Auto-Anlage beim Block-Speichern wohnt deshalb
// HIER (blockSpeichernMitEtiketten), und index.js ruft sie statt
// eigenenBlockSpeichern.
//
// Bekannte Grenze (K24, nicht behoben): Wird ein Etikett umbenannt oder seine
// Form geändert, während ein unterbrochener Lauf wiederaufnehmbar ist, führt
// das nach der Wiederaufnahme zu genau einer Nachforderung des betroffenen
// Blocks — seine alten Meldungen tragen den alten Namen. Dieselbe Grenze gilt
// heute schon für Blöcke; die Sperre unten greift nur für Projekte, die LAUFEN
// oder WARTEN.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import {
  eigeneEtikettenSetzen,
  eigenesEtikett,
  etikettNameSchluessel,
  katalogEtiketten
} from '../shared/blockKatalog.js'
import { pruefeEtikett } from '../shared/etikettRegeln.js'
import { pruefeEigenenBlock } from '../shared/blockRegeln.js'
import {
  eigeneBloeckeListe,
  eigenenBlockSpeichern,
  etikettUmbenennen,
  bloeckeMitEtikett,
  projekteMitBloecken
} from './eigeneBloecke.js'
import { laufZustand } from './lauf.js'

let etiketten = []

function dateiPfad() {
  return path.join(app.getPath('userData'), 'eigene-etiketten.json')
}

function speichern() {
  const tmp = dateiPfad() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(etiketten, null, 2), 'utf8')
  fs.renameSync(tmp, dateiPfad())
  eigeneEtikettenSetzen(etiketten)
}

function katalogNamen() {
  return katalogEtiketten().map((e) => e.name)
}

// Beim App-Start aufrufen — VOR eigeneBloeckeLaden und vor der
// IPC-Registrierung (K18): Der Abgleich der Block-Etiketten (unten) und der
// Lieferschein brauchen die Registry.
export function eigeneEtikettenLaden() {
  let roh = []
  try {
    roh = JSON.parse(fs.readFileSync(dateiPfad(), 'utf8'))
  } catch {
    // Noch keine Datei — keine eigenen Etiketten.
  }
  etiketten = []
  const katalog = katalogNamen()
  for (const eintrag of Array.isArray(roh) ? roh : []) {
    if (typeof eintrag?.id !== 'string' || !eintrag.id.startsWith('etikett-')) continue
    if (etiketten.some((e) => e.id === eintrag.id)) continue
    const geprueft = pruefeEtikett(eintrag, { vorhandene: etiketten, katalogNamen: katalog })
    if (geprueft.fehler) continue
    etiketten.push(mitHerkunft(eintrag.id, geprueft.etikett, eintrag))
  }
  eigeneEtikettenSetzen(etiketten)
}

// Herkunfts-Marken (K2): automatisch angelegte Etiketten tragen
// `automatisch: true` und die Quelle (Blockname) — die Bibliothek zeigt das.
function mitHerkunft(id, etikett, quelle) {
  return {
    id,
    ...etikett,
    automatisch: Boolean(quelle?.automatisch),
    quelle: String(quelle?.quelle ?? '').trim()
  }
}

export function eigeneEtikettenListe() {
  return { ok: true, etiketten }
}

// Läuft oder wartet ein Projekt, dessen Schaubild einen eigenen Block mit
// diesem Etikett trägt? Dann ist eine Änderung an Name oder Form gesperrt —
// der Lauf hat das Werkzeug mit der alten Form registriert, und eine neue Form
// mitten im Lauf würde Meldungen abweisen, die der Agent nie richtig machen
// könnte. Liefert den Klartext-Fehler oder null.
function laufSperre(name) {
  const ids = bloeckeMitEtikett(name).map((b) => b.id)
  for (const projekt of projekteMitBloecken(ids)) {
    const zustand = laufZustand(projekt.pfad)
    if (zustand.aktiv || zustand.wartet)
      return texte.etikettRegeln.fehlerWaehrendLauf(projekt.name)
  }
  return null
}

// Speichern aus dem Etikett-Editor: neu (ohne id) oder Änderung (mit id).
// Umbenennen zieht in ALLEN eigenen Blöcken nach (etikettUmbenennen). Ein von
// Hand gespeichertes Etikett ist kein automatisches mehr — Georg hat es
// angesehen und bestätigt. Rückgabe immer der Gesamtstand { ok, etiketten }.
export function eigenesEtikettSpeichern(roh) {
  const vorhanden =
    typeof roh?.id === 'string' ? (etiketten.find((e) => e.id === roh.id) ?? null) : null
  const geprueft = pruefeEtikett(
    // Das bisherige Werkzeug mitgeben, damit es erhalten bleibt (K13) — der
    // Editor schickt es nicht zwingend zurück.
    vorhanden ? { ...roh, werkzeug: roh.werkzeug ?? vorhanden.werkzeug } : roh,
    { vorhandene: etiketten, katalogNamen: katalogNamen() }
  )
  if (geprueft.fehler) return { ok: false, fehler: geprueft.fehler }
  let nameGeaendert = false
  if (vorhanden) {
    nameGeaendert = vorhanden.name !== geprueft.etikett.name
    const felderGeaendert =
      JSON.stringify(vorhanden.felder ?? []) !== JSON.stringify(geprueft.etikett.felder)
    if (nameGeaendert || felderGeaendert) {
      const sperre = laufSperre(vorhanden.name)
      if (sperre) return { ok: false, fehler: sperre }
    }
  }
  const id = vorhanden ? vorhanden.id : 'etikett-' + crypto.randomUUID()
  const neu = mitHerkunft(id, geprueft.etikett, { automatisch: false, quelle: '' })
  etiketten = vorhanden ? etiketten.map((e) => (e.id === id ? neu : e)) : [...etiketten, neu]
  speichern()
  // Erst die Etiketten, dann die Blöcke: Liest jemand dazwischen, findet er
  // das Etikett schon unter dem neuen Namen.
  if (vorhanden && nameGeaendert) etikettUmbenennen(vorhanden.name, neu.name)
  return { ok: true, etiketten }
}

// Löschen: gesperrt, solange ein eigener Block das Etikett trägt — der Block
// stünde sonst mit einem Etikett da, das es nicht mehr gibt, und der Lauf
// wüsste nicht mehr, welche Form gemeint war. Der Fehler nennt die Blöcke.
// Katalog-Etiketten sind hier nie dabei (sie sind nur kopierbar).
export function eigenesEtikettLoeschen(id) {
  const eintrag = etiketten.find((e) => e.id === id)
  if (!eintrag) return { ok: false, fehler: texte.etikettRegeln.fehlerUnbekannt }
  const nutzer = bloeckeMitEtikett(eintrag.name)
  if (nutzer.length > 0)
    return {
      ok: false,
      fehler: texte.etikettRegeln.fehlerNochVerwendet(nutzer.map((b) => b.name))
    }
  etiketten = etiketten.filter((e) => e.id !== id)
  speichern()
  return { ok: true, etiketten }
}

// Die kanonische Schreibweise eines bekannten Etiketts (Katalog oder eigen,
// Schlüsselvergleich) — null, wenn es das Etikett noch nirgends gibt.
function kanonischerName(name) {
  const schluessel = etikettNameSchluessel(name)
  if (!schluessel) return null
  const katalog = katalogNamen().find((k) => etikettNameSchluessel(k) === schluessel)
  if (katalog) return katalog
  return eigenesEtikett(name)?.name ?? null
}

// Ein Etikett sicherstellen (BAUPLAN 48): Gibt es das Etikett schon (Katalog
// oder eigen), kommt seine kanonische Schreibweise zurück; sonst wird es als
// eigenes Etikett OHNE Felder angelegt — ein Etikett anzulegen bleibt Tippen,
// erst wer Struktur will, definiert sie im Editor. Speichert NICHT selbst (der
// Aufrufer speichert gesammelt). Liefert { name, neu, id }.
export function etikettSicherstellen(name, quelle = '') {
  const kanonisch = kanonischerName(name)
  if (kanonisch) return { name: kanonisch, neu: false, id: eigenesEtikett(kanonisch)?.id ?? null }
  const bereinigt = String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!bereinigt) return { name: '', neu: false, id: null }
  const id = 'etikett-' + crypto.randomUUID()
  etiketten = [
    ...etiketten,
    {
      id,
      name: bereinigt,
      beschreibung: '',
      felder: [],
      werkzeug: null,
      automatisch: true,
      quelle: String(quelle ?? '').trim()
    }
  ]
  // Registry sofort, damit der nächste Aufruf im selben Block das Etikett
  // schon kennt (zweimal „Notizen" in braucht und liefert).
  eigeneEtikettenSetzen(etiketten)
  return { name: bereinigt, neu: true, id }
}

// Block speichern MIT Etiketten-Abgleich (K1, K2) — der IPC-Handler
// `eigener-block-speichern` ruft diese Funktion. Reihenfolge, nie umgekehrt:
//   1. die ROHEN Eingaben kanonisieren (braucht, brauchtOptional, liefert,
//      brauchtWozu-Schlüssel → kanonische Schreibweise bekannter Etiketten),
//   2. pruefeEigenenBlock (die harten Block-Regeln),
//   3. Auto-Anlage der noch unbekannten Etiketten,
//   4. speichern (eigenenBlockSpeichern; scheitert es — Lauf-Sperre —, werden
//      die eben angelegten Etiketten wieder zurückgenommen, damit kein Etikett
//      ohne Block übrig bleibt).
// Rückgabe { ok, bloecke, etiketten, hinweise } — hinweise sind Klartext-Sätze
// („Etikett „X" wurde neu angelegt", „„x" wurde zu „X""), die Projektansicht
// zeigt sie einmalig.
export function blockSpeichernMitEtiketten(roh) {
  const tr = texte.etikettRegeln
  const hinweise = []
  const umbenannt = new Map()
  // Noch unbekannte Etiketten, die in DIESEM Block zum ersten Mal auftauchen
  // (Prüfer-Befund 48): „Plan" in braucht und „plan" in brauchtOptional sind
  // dasselbe Etikett — die erste Schreibweise gewinnt, damit die Regel „nie in
  // beiden Listen" greift und nicht erst der nächste App-Start sie angleicht.
  const neuGesehen = new Map()
  const kanonisieren = (liste) =>
    (Array.isArray(liste) ? liste : []).map((eintrag) => {
      const wert = String(eintrag ?? '')
        .replace(/\s+/g, ' ')
        .trim()
      const schluessel = etikettNameSchluessel(wert)
      const kanonisch = kanonischerName(wert) ?? neuGesehen.get(schluessel) ?? null
      if (kanonisch && kanonisch !== wert) {
        umbenannt.set(wert, kanonisch)
        if (!hinweise.includes(tr.hinweisSchreibweise(wert, kanonisch)))
          hinweise.push(tr.hinweisSchreibweise(wert, kanonisch))
        return kanonisch
      }
      if (!kanonisch && schluessel) neuGesehen.set(schluessel, wert)
      return kanonisch ?? wert
    })
  const wozuRoh = roh?.brauchtWozu && typeof roh.brauchtWozu === 'object' ? roh.brauchtWozu : {}
  const brauchtWozu = {}
  for (const [etikett, satz] of Object.entries(wozuRoh)) {
    const wert = String(etikett ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    brauchtWozu[umbenannt.get(wert) ?? kanonischerName(wert) ?? wert] = satz
  }
  const rohKanonisch = {
    ...roh,
    braucht: kanonisieren(roh?.braucht),
    brauchtOptional: kanonisieren(roh?.brauchtOptional),
    liefert: kanonisieren(roh?.liefert),
    brauchtWozu
  }
  const geprueft = pruefeEigenenBlock(rohKanonisch)
  if (geprueft.fehler) return { ok: false, fehler: geprueft.fehler }
  const block = geprueft.block
  const neueIds = []
  for (const etikett of [
    ...(block.braucht ?? []),
    ...(block.brauchtOptional ?? []),
    ...(block.liefert ?? [])
  ]) {
    const ergebnis = etikettSicherstellen(etikett, block.name)
    if (ergebnis.neu) {
      neueIds.push(ergebnis.id)
      hinweise.push(tr.hinweisNeuAngelegt(ergebnis.name))
    }
  }
  if (neueIds.length) speichern()
  const gespeichert = eigenenBlockSpeichern(rohKanonisch)
  if (!gespeichert.ok) {
    if (neueIds.length) {
      etiketten = etiketten.filter((e) => !neueIds.includes(e.id))
      speichern()
    }
    return gespeichert
  }
  return { ok: true, bloecke: gespeichert.bloecke, etiketten, hinweise }
}

// Altbestand beim App-Start (K18): alle Etiketten eigener Blöcke sicherstellen
// und auf die kanonische Schreibweise ziehen. Speichert nur, wenn sich etwas
// ändert — Blöcke über etikettUmbenennen (das speichert selbst), Etiketten
// gesammelt am Ende.
export function etikettenAbgleichen() {
  const namen = new Set()
  const quelleVon = new Map()
  for (const block of eigeneBloeckeListe().bloecke)
    for (const etikett of [
      ...(block.braucht ?? []),
      ...(block.brauchtOptional ?? []),
      ...(block.liefert ?? [])
    ]) {
      namen.add(etikett)
      if (!quelleVon.has(etikett)) quelleVon.set(etikett, block.name)
    }
  let neu = 0
  for (const name of namen) {
    const kanonisch = kanonischerName(name)
    if (kanonisch) {
      if (kanonisch !== name) etikettUmbenennen(name, kanonisch)
      continue
    }
    if (etikettSicherstellen(name, quelleVon.get(name)).neu) neu++
  }
  if (neu > 0) speichern()
  return { ok: true, etiketten, neu }
}
