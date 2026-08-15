// Co-Pilot (BAUPLAN 33): EIN Chat für Bedienung und Projekt — der Nachlauf-Chat
// (BAUPLAN 27) und der Bedien-Helfer sind derselbe Chat, kein zweites Fenster.
// Im Projekt kennt er das offene Projekt; liegt ein Laufbericht vor, setzt er
// die Lauf-Session fort (resume über die Session-Kennung; „frisch" heißt: der
// jüngste Bericht des Projekts), sonst startet er eine frische Session mit
// Projekt- und FlowForge-Wissen — welche Grundlage gilt, steht ehrlich im Chat.
// In der Projektübersicht (kein Projekt offen) beantwortet er nur Bedienfragen;
// sein Arbeitsordner ist der Datenordner, und der ist für seine Werkzeuge gesperrt.
// Zwei Betriebsarten wie bisher: Standard nur-lesend (Karten anlegen erlaubt),
// auf Zuruf „Chat darf reparieren" — dann Sicherungspunkt vor der ersten
// Änderung. Während ein Lauf läuft oder wartet: nur lesend, kein Sicherungspunkt,
// Reparieren gesperrt (ein Schreiber pro Projekt).
// Der Verlauf ist je Projekt gespeichert (Verwaltungsdatei chat.json) und
// überlebt Neustarts; nach jedem Lauf hängt der Chat an der neuen Lauf-Session,
// sichtbar durch eine Marke im Verlauf. Gespräche nach einem Lauf wandern
// zusätzlich in den Laufbericht.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'
import { texte } from '../shared/texte.js'
import { einstellungenLaden } from './einstellungen.js'
import { starteChatMotor } from './motor/claudeCodeMotor.js'
import {
  KONTEXT_FENSTER_STANDARD,
  FORTSETZUNG_WAECHTER_PROZENT
} from './motor/schnittstelle.js'
import { sicherungspunktAnlegen } from './sicherungspunkte.js'
import { prozessgruppeAbraeumen } from './prozesse.js'
import { specWissen } from './specWissen.js'

const BERICHTE_ORDNER = 'laufberichte'
// Verlaufsdatei je Projekt — Verwaltungsdatei (Sperrliste des Motors,
// Sicherungspunkt-Ausnahme); der Übersichts-Chat liegt im Datenordner.
export const CHAT_DATEI = 'chat.json'
const UEBERSICHT_DATEI = 'chat-uebersicht.json'
// Schlüssel des Übersichts-Chats (kein Projekt offen).
const UEBERSICHT = '@uebersicht'
// Bilder je Nachricht (Screenshots per Strg+V oder Datei-Knopf): Deckel, damit
// weder der IPC-Transfer noch das Kontextfenster des Motors platzt.
const BILDER_MAX = 4
const BILD_MAX_BYTES = 5 * 1024 * 1024
// Fortsetzungs-Versuche je Nachricht: eigene Chat-Session, dann Lauf-Session,
// dann frisch — mehr Kandidaten gibt es nicht.
const FORTSETZUNGS_VERSUCHE = 2

const chats = new Map() // schluessel → Chat

// Lauf-Zustand des Projekts (aktiv/wartet) — von lauf.js eingehängt, damit
// hier kein Import-Zyklus entsteht (lauf.js importiert dieses Modul).
let laufZustandQuelle = null
export function laufZustandQuelleSetzen(fn) {
  laufZustandQuelle = fn
}
function laufAktiv(projektPfad) {
  if (!projektPfad || !laufZustandQuelle) return false
  const z = laufZustandQuelle(projektPfad)
  return Boolean(z?.aktiv || z?.wartet)
}

// --- Reine Regel-Funktionen (prüfbar ohne Motor) ---------------------------

// Startplan des Chats: Die Lauf-Session wird fortgesetzt, wenn ihre Kennung im
// Laufbericht steht UND ihr Füllstand unter der Wächter-Schwelle liegt (die
// Mechanik aus BAUPLAN 16) — sonst frische Session mit Laufbericht-Kontext,
// ehrlich im Chat vermerkt, kein stiller Ausweichpfad. Ohne Bericht (noch kein
// Lauf) frisch mit Projekt- und FlowForge-Wissen; ohne Projekt (Übersicht)
// nur Bedienfragen.
export function chatStartplan(bericht, waechterProzent = FORTSETZUNG_WAECHTER_PROZENT, projekt = true) {
  if (!projekt) return { fortsetzen: null, hinweis: texte.chat.hinweisUebersicht }
  if (!bericht) return { fortsetzen: null, hinweis: texte.chat.hinweisOhneLauf }
  const sitzung = bericht?.laufSitzung
  if (typeof sitzung?.kennung === 'string' && sitzung.kennung) {
    const fenster =
      Number(sitzung.kontextFenster) > 0 ? Number(sitzung.kontextFenster) : KONTEXT_FENSTER_STANDARD
    const prozent = ((Number(sitzung.tokens) || 0) / fenster) * 100
    if (prozent < waechterProzent)
      return { fortsetzen: sitzung.kennung, hinweis: texte.chat.hinweisFortgesetzt }
  }
  return { fortsetzen: null, hinweis: texte.chat.hinweisFrisch }
}

// Laufbericht als Kontext einer frischen Chat-Session: Kopf, Blöcke mit
// Ergebnis, Fehlertext — gedeckelt, damit der Kontext nicht flutet.
const KONTEXT_BLOCK_MAX = 1500
const KONTEXT_GESAMT_MAX = 16000
export function laufberichtKontext(bericht) {
  const zeit = new Date(bericht.gestartetAm).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
  const teile = [
    texte.agentenChat.berichtKopf(
      bericht.workflow,
      zeit,
      texte.lauf.zustandLabels[bericht.zustand] ?? bericht.zustand
    )
  ]
  for (const eintrag of bericht.blockErgebnisse ?? []) {
    const text = String(eintrag.ergebnisText ?? '')
    teile.push(
      texte.agentenChat.berichtBlock(
        eintrag.block,
        texte.laufberichte.blockZustaende[eintrag.zustand] ?? eintrag.zustand,
        text.length > KONTEXT_BLOCK_MAX ? text.slice(0, KONTEXT_BLOCK_MAX) + ' …' : text
      )
    )
  }
  if (bericht.fehlertext) teile.push(texte.agentenChat.berichtFehler(bericht.fehlertext))
  const gesamt = teile.join('\n')
  return gesamt.length > KONTEXT_GESAMT_MAX ? gesamt.slice(0, KONTEXT_GESAMT_MAX) + ' …' : gesamt
}

// Bilder aus der Oberfläche (data-URLs) in Motor-Bildblöcke übersetzen —
// nur bekannte Formate, harte Größen- und Anzahl-Deckel.
export function bildBloecke(bilder) {
  if (!Array.isArray(bilder) || bilder.length === 0) return { ok: true, bloecke: [] }
  if (bilder.length > BILDER_MAX) return { ok: false, fehler: texte.chat.bildZuViele }
  const bloecke = []
  for (const roh of bilder) {
    const treffer = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
      String(roh ?? '')
    )
    if (!treffer) return { ok: false, fehler: texte.chat.bildFormat }
    if (treffer[2].length > (BILD_MAX_BYTES * 4) / 3)
      return { ok: false, fehler: texte.chat.bildZuGross }
    bloecke.push({
      type: 'image',
      source: { type: 'base64', media_type: treffer[1], data: treffer[2] }
    })
  }
  return { ok: true, bloecke }
}

// Der Abschnitt des Verlaufs, der zur aktuellen Lauf-Session gehört: alles
// nach der letzten Marke (oder der ganze Verlauf ohne Marke). Nur dieser
// Abschnitt wandert in den Laufbericht.
export function verlaufSeitMarke(verlauf) {
  const liste = Array.isArray(verlauf) ? verlauf : []
  let start = 0
  liste.forEach((e, i) => {
    if (e?.rolle === 'marke') start = i + 1
  })
  return liste.slice(start)
}

// Marken-Text: „ab hier: neue Lauf-Session vom 15.08., 14:32".
export function markenText(gestartetAm) {
  const d = new Date(gestartetAm)
  if (!Number.isFinite(d.getTime())) return texte.chat.markeOhneZeit
  const datum = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return texte.chat.marke(datum, zeit)
}

// --- Laufbericht finden und fortschreiben ----------------------------------

// Der Chat gehört immer zum jüngsten Laufbericht — die Dateinamen sind
// Zeitstempel, die neueste Datei ist die alphabetisch letzte.
function neuesterBericht(projektPfad) {
  const ordner = path.join(projektPfad, BERICHTE_ORDNER)
  let dateien = []
  try {
    dateien = fs.readdirSync(ordner).filter((d) => d.endsWith('.json'))
  } catch {
    return null
  }
  if (dateien.length === 0) return null
  dateien.sort()
  const datei = path.join(ordner, dateien[dateien.length - 1])
  try {
    return { datei, bericht: JSON.parse(fs.readFileSync(datei, 'utf8')) }
  } catch {
    return null
  }
}

function berichtLesen(datei) {
  try {
    return JSON.parse(fs.readFileSync(datei, 'utf8'))
  } catch {
    return null
  }
}

// Chat-Abschnitt und -Verbrauch in den Laufbericht schreiben (SPEC: „Gespräche
// nach einem Lauf wandern zusätzlich in den Laufbericht").
function chatInBerichtSchreiben(chat) {
  if (!chat.berichtDatei) return
  try {
    const bericht = JSON.parse(fs.readFileSync(chat.berichtDatei, 'utf8'))
    bericht.nachlaufChat = {
      verlauf: verlaufSeitMarke(chat.verlauf),
      verbrauch: chat.letzterVerbrauch
    }
    const tmp = chat.berichtDatei + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(bericht, null, 2), 'utf8')
    fs.renameSync(tmp, chat.berichtDatei)
  } catch {
    // Ein nicht speicherbarer Bericht darf den Chat nicht stören — der
    // Verlauf lebt weiter in der Verlaufsdatei.
  }
}

// --- Verlaufsdatei ---------------------------------------------------------

function verlaufsDatei(chat) {
  return chat.projektPfad
    ? path.join(chat.projektPfad, CHAT_DATEI)
    : path.join(app.getPath('userData'), UEBERSICHT_DATEI)
}

function verlaufSpeichern(chat) {
  try {
    const datei = verlaufsDatei(chat)
    const daten = {
      verlauf: chat.verlauf,
      kennung: chat.kennung,
      berichtDatei: chat.berichtDatei ? path.basename(chat.berichtDatei) : null,
      verbrauch: chat.letzterVerbrauch,
      verbrauchBasis: chat.verbrauchBasis
    }
    const tmp = datei + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(daten, null, 2), 'utf8')
    fs.renameSync(tmp, datei)
  } catch {
    // Nicht speicherbar (z.B. Projektordner weg): der Verlauf lebt im Speicher weiter.
  }
}

function verlaufLaden(chat) {
  try {
    const roh = JSON.parse(fs.readFileSync(verlaufsDatei(chat), 'utf8'))
    return {
      verlauf: Array.isArray(roh.verlauf) ? roh.verlauf : [],
      kennung: typeof roh.kennung === 'string' && roh.kennung ? roh.kennung : null,
      berichtDatei:
        chat.projektPfad && typeof roh.berichtDatei === 'string' && roh.berichtDatei
          ? path.join(chat.projektPfad, BERICHTE_ORDNER, roh.berichtDatei)
          : null,
      verbrauch: roh.verbrauch ?? null,
      verbrauchBasis: roh.verbrauchBasis ?? null
    }
  } catch {
    return null
  }
}

// --- Chat-Verwaltung -------------------------------------------------------

function ereignis(chat, daten) {
  const fenster = chat.fenster
  if (fenster && !fenster.isDestroyed())
    fenster.webContents.send('lauf-ereignis', { projektPfad: chat.projektPfad, ...daten })
}

// Verbrauch über alle Motoren dieses Chats: Basis (verstorbene Motoren) plus
// der lebende Motor. Der Füllstand (tokens) ist immer der der aktuellen Session.
function verbrauchGesamt(chat, motorVerbrauch) {
  const m = motorVerbrauch ?? chat.motor?.verbrauch() ?? null
  const b = chat.verbrauchBasis
  if (!m) return b
  if (!b) return m
  const aufschl =
    m.aufschluesselung || b.aufschluesselung
      ? {
          eingabe: (b.aufschluesselung?.eingabe ?? 0) + (m.aufschluesselung?.eingabe ?? 0),
          ausgabe: (b.aufschluesselung?.ausgabe ?? 0) + (m.aufschluesselung?.ausgabe ?? 0),
          cacheLesen: (b.aufschluesselung?.cacheLesen ?? 0) + (m.aufschluesselung?.cacheLesen ?? 0),
          cacheSchreiben:
            (b.aufschluesselung?.cacheSchreiben ?? 0) + (m.aufschluesselung?.cacheSchreiben ?? 0)
        }
      : null
  return {
    ...m,
    kostenUsd:
      b.kostenUsd != null || m.kostenUsd != null
        ? (b.kostenUsd ?? 0) + (m.kostenUsd ?? 0)
        : null,
    aufschluesselung: aufschl,
    unterTokens: (b.unterTokens ?? 0) + (m.unterTokens ?? 0)
  }
}

// Ein sterbender Motor gibt seinen Verbrauch in die Basis ab — die Summen am
// Chat bleiben dadurch ehrlich, auch über Sessionwechsel hinweg.
function motorVerabschieden(chat) {
  if (!chat.motor) return
  const stand = chat.motor.verbrauch()
  chat.verbrauchBasis = verbrauchGesamt(
    { verbrauchBasis: chat.verbrauchBasis, motor: null },
    { ...stand, tokens: 0, kontextProzentVon: null, kontextProzentBis: null }
  )
  if (chat.motor.sessionKennung) chat.kennung = chat.motor.sessionKennung
  chat.motor.beenden()
  chat.motor = null
}

function verlaufEintrag(chat, eintrag) {
  chat.verlauf.push(eintrag)
  ereignis(chat, { art: 'chat-eintrag', eintrag })
}

function chatAnlegen(projektPfad) {
  const chat = {
    schluessel: projektPfad ?? UEBERSICHT,
    projektPfad: projektPfad ?? null,
    fenster: null,
    berichtDatei: null,
    bericht: null,
    plan: chatStartplan(null, undefined, Boolean(projektPfad)),
    // Kennung der Chat-Session selbst — ein Motor-Neustart (nach Prozess-Tod,
    // Laufstart oder App-Neustart) setzt bevorzugt sie fort.
    kennung: null,
    fortsetzungsArt: null,
    motor: null,
    reparieren: false,
    beschaeftigt: false,
    abgleichAusstehend: false,
    sicherungGemacht: false,
    verlauf: [],
    verbrauchBasis: null,
    letzterVerbrauch: null,
    fragen: new Map(),
    offeneFrage: null,
    letzterSchritt: '',
    hinweisGezeigt: false
  }
  const gespeichert = verlaufLaden(chat)
  if (gespeichert) {
    chat.verlauf = gespeichert.verlauf
    chat.kennung = gespeichert.kennung
    chat.verbrauchBasis = gespeichert.verbrauchBasis
    chat.letzterVerbrauch = gespeichert.verbrauch
    chat.hinweisGezeigt = chat.verlauf.length > 0
    if (gespeichert.berichtDatei && fs.existsSync(gespeichert.berichtDatei)) {
      chat.berichtDatei = gespeichert.berichtDatei
      chat.bericht = berichtLesen(gespeichert.berichtDatei)
      chat.plan = chatStartplan(chat.bericht)
    }
  }
  return chat
}

// Gibt es inzwischen einen neueren Laufbericht? Dann hängt der Chat ab jetzt
// an der neuen Lauf-Session — sichtbar durch eine Marke im Verlauf; der
// ältere Teil bleibt zum Nachlesen, die KI kennt ihn nicht mehr. Nicht mitten
// im Lauf und nicht, während der Chat noch antwortet (dann nach der Antwort).
function berichtAbgleichen(chat) {
  if (!chat.projektPfad) return
  if (chat.beschaeftigt) {
    chat.abgleichAusstehend = true
    return
  }
  if (laufAktiv(chat.projektPfad)) return
  chat.abgleichAusstehend = false
  const neu = neuesterBericht(chat.projektPfad)
  if (!neu) return
  if (chat.berichtDatei === neu.datei) {
    if (!chat.bericht) chat.bericht = neu.bericht
    return
  }
  motorVerabschieden(chat)
  chat.kennung = null
  chat.berichtDatei = neu.datei
  chat.bericht = neu.bericht
  chat.plan = chatStartplan(neu.bericht)
  chat.verbrauchBasis = null
  chat.letzterVerbrauch = null
  chat.sicherungGemacht = false
  // Marke nur, wenn schon Verlauf da ist — ein leerer Chat bekommt keine.
  if (chat.verlauf.length > 0) {
    verlaufEintrag(chat, { rolle: 'marke', text: markenText(neu.bericht.gestartetAm) })
    verlaufEintrag(chat, { rolle: 'hinweis', text: chat.plan.hinweis })
    chat.hinweisGezeigt = true
  } else {
    chat.hinweisGezeigt = false
  }
  ereignis(chat, { art: 'chat-verbrauch', verbrauch: null })
  ereignis(chat, { art: 'chat-hinweis', hinweis: chat.plan.hinweis })
  verlaufSpeichern(chat)
}

function chatBesorgen(projektPfad) {
  const schluessel = projektPfad ?? UEBERSICHT
  let chat = chats.get(schluessel)
  if (!chat) {
    chat = chatAnlegen(projektPfad ?? null)
    chats.set(schluessel, chat)
  }
  berichtAbgleichen(chat)
  return chat
}

function motorBesorgen(chat) {
  if (chat.motor && !chat.motor.istTot()) return chat.motor
  motorVerabschieden(chat)
  const { einstellungen } = einstellungenLaden()
  // Bevorzugt die eigene Chat-Session fortsetzen (nach Prozess-Tod, Laufstart,
  // App-Neustart), sonst die Lauf-Session laut Startplan, sonst frisch.
  const kandidat = chat.kennung
    ? { kennung: chat.kennung, art: 'chat' }
    : chat.plan.fortsetzen
      ? { kennung: chat.plan.fortsetzen, art: 'lauf' }
      : null
  chat.fortsetzungsArt = kandidat?.art ?? null
  const projektPfad = chat.projektPfad
  chat.motor = starteChatMotor({
    projektPfad,
    // Übersichts-Chat: Arbeitsordner ist der Datenordner — und der ist für
    // seine Werkzeuge gesperrt (dort liegen die Einstellungen samt Schlüssel).
    datenordner: app.getPath('userData'),
    modus: einstellungen.motorModus,
    apiSchluessel: einstellungen.apiSchluessel,
    ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
    fortsetzen: kandidat?.kennung ?? null,
    laufKontext: kandidat || !chat.bericht ? '' : laufberichtKontext(chat.bericht),
    spec: specWissen(),
    // Während ein Lauf läuft oder wartet: nur lesend — die Einstellung „nur-
    // lesende Blöcke dürfen Befehle ausführen" gilt dann NICHT, Reparieren ist
    // gesperrt (ein Schreiber pro Projekt). Je Werkzeugaufruf frisch gelesen.
    holeNurLesenBefehle: () =>
      Boolean(einstellungenLaden().einstellungen.nurLesenBefehle) && !laufAktiv(projektPfad),
    holeReparieren: () => chat.reparieren && !laufAktiv(projektPfad),
    holeLaufAktiv: () => laufAktiv(projektPfad),
    // Herkunft (BAUPLAN 30): Karten aus dem Chat tragen „vom Chat" samt dem
    // Lauf, zu dem der Chat gerade gehört.
    herkunft: chat.bericht
      ? { quelle: 'chat', laufId: chat.bericht.id, laufStart: chat.bericht.gestartetAm }
      : { quelle: 'chat' },
    // Sicherungspunkt vor der ersten Änderung (BAUPLAN 27) — einmal je Chat-
    // Session; Reparaturen erscheinen damit in der Sicherungspunkt-Liste.
    vorErsterAenderung: async () => {
      if (chat.sicherungGemacht || !projektPfad || laufAktiv(projektPfad)) return
      chat.sicherungGemacht = true
      const punkt = await sicherungspunktAnlegen(
        projektPfad,
        texte.sicherungen.beschriftungVorChatReparatur
      )
      // Scheitert das Anlegen, probiert es die nächste Änderung erneut —
      // eine Reparatur ganz ohne Rückroll-Punkt soll nicht stillschweigend gelten.
      if (!punkt.ok) chat.sicherungGemacht = false
      if (punkt.ok) {
        ereignis(chat, {
          art: 'ticker',
          text: texte.ticker.chatZeile(texte.ticker.sicherungspunktAngelegt)
        })
        ereignis(chat, { art: 'chat-sicherungspunkt' })
      }
    },
    aufEreignis: (e) => {
      if (e.art === 'ticker') {
        chat.letzterSchritt = e.text
        ereignis(chat, { art: 'chat-schritt', text: e.text })
        return ereignis(chat, { art: 'ticker', text: texte.ticker.chatZeile(e.text) })
      }
      if (e.art === 'denken')
        return ereignis(chat, { art: 'denken', absender: texte.chat.denkAbsender, text: e.text })
      if (e.art === 'chat-verbrauch') {
        chat.letzterVerbrauch = verbrauchGesamt(chat, e.verbrauch)
        return ereignis(chat, { art: 'chat-verbrauch', verbrauch: chat.letzterVerbrauch })
      }
      // Karten-, Startanleitungs- und App-Ereignisse unverändert an die Oberfläche.
      ereignis(chat, e)
    },
    aufRechteFrage: (frage) => {
      // Automodus gilt auch im Chat — sichtbar im Ticker.
      const { einstellungen: aktuelle } = einstellungenLaden()
      if (aktuelle.rechteAutomatisch) {
        ereignis(chat, {
          art: 'ticker',
          text: texte.ticker.chatZeile(
            texte.ticker.rechteAutomatischErlaubt(
              frage.beschreibung.replace(/\s+/g, ' ').slice(0, 160)
            )
          )
        })
        return Promise.resolve(true)
      }
      return new Promise((antworten) => {
        const frageId = crypto.randomUUID()
        chat.offeneFrage = { frageId, beschreibung: frage.beschreibung }
        chat.fragen.set(frageId, (erlaubt) => {
          chat.fragen.delete(frageId)
          chat.offeneFrage = null
          ereignis(chat, { art: 'chat-frage-erledigt', frageId })
          antworten(erlaubt)
        })
        ereignis(chat, { art: 'chat-frage', frageId, beschreibung: frage.beschreibung })
      })
    }
  })
  return chat.motor
}

// Für die Oberfläche: Zustand und Verlauf des Chats (Projekt oder Übersicht).
// Das Fenster wird schon hier gemerkt, damit auch Ereignisse vor der ersten
// Nachricht (z.B. die Ticker-Zeile des Reparieren-Schalters) ankommen.
export function chatZustand(fenster, projektPfad) {
  const chat = chatBesorgen(projektPfad ?? null)
  if (fenster) chat.fenster = fenster
  return {
    ok: true,
    verfuegbar: true,
    uebersicht: !chat.projektPfad,
    hinweis: chat.plan.hinweis,
    verlauf: chat.verlauf,
    reparieren: chat.reparieren,
    beschaeftigt: chat.beschaeftigt,
    verbrauch: chat.letzterVerbrauch,
    laufAktiv: laufAktiv(chat.projektPfad),
    letzterSchritt: chat.letzterSchritt,
    // Nach einem Ansichtswechsel muss eine offene Rechte-Frage wiederkommen —
    // sonst hinge der Chat ewig an einem unsichtbaren Dialog.
    frage: chat.offeneFrage ?? null
  }
}

export function chatSenden(fenster, projektPfad, text, bilder) {
  if (projektPfad && !fs.existsSync(projektPfad))
    return { ok: false, fehler: texte.fehler.projektNichtGefunden }
  const chat = chatBesorgen(projektPfad ?? null)
  if (chat.beschaeftigt) return { ok: false, fehler: texte.chat.beschaeftigt }
  const sauber = String(text ?? '').trim()
  const geprueft = bildBloecke(bilder)
  if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler }
  if (!sauber && geprueft.bloecke.length === 0) return { ok: false, fehler: texte.fehler.unbekannt }
  if (fenster) chat.fenster = fenster
  chat.beschaeftigt = true
  chat.letzterSchritt = ''

  // Ehrlichkeit: Woher der Chat seinen Kontext hat, steht als erster Eintrag
  // sichtbar im Verlauf (und damit in der Verlaufsdatei / im Laufbericht).
  if (!chat.hinweisGezeigt) {
    chat.hinweisGezeigt = true
    verlaufEintrag(chat, { rolle: 'hinweis', text: chat.plan.hinweis })
  }
  verlaufEintrag(chat, { rolle: 'mensch', text: sauber, bilder: geprueft.bloecke.length })
  verlaufSpeichern(chat)
  chatInBerichtSchreiben(chat)
  ereignis(chat, { art: 'chat-beschaeftigt', beschaeftigt: true })

  // Während eines Laufs bekommt der Motor eine FlowForge-Notiz vor die
  // Nachricht — sonst weiß die KI nicht, dass gerade ein Lauf läuft und sie
  // nur lesend ist. Der sichtbare Verlauf zeigt weiterhin nur den Nutzertext.
  const notiz = laufAktiv(chat.projektPfad) ? texte.agentenChat.laufAktivNotiz : ''
  const textFuerMotor = notiz ? notiz + '\n' + sauber : sauber
  const inhalt =
    geprueft.bloecke.length > 0
      ? [...geprueft.bloecke, ...(textFuerMotor ? [{ type: 'text', text: textFuerMotor }] : [])]
      : textFuerMotor

  ;(async () => {
    let ergebnis = await motorBesorgen(chat).senden(inhalt)
    // Die Session ließ sich nicht fortsetzen: ehrlich vermerken, den nächsten
    // Kandidaten nehmen (eigene Chat-Session → Lauf-Session → frisch) und
    // dieselbe Nachricht erneut senden, damit sie nicht verloren geht.
    for (let versuch = 0; ergebnis.zustand === 'fortsetzung-gescheitert' && versuch < FORTSETZUNGS_VERSUCHE; versuch++) {
      const art = chat.fortsetzungsArt
      motorVerabschieden(chat)
      // NACH dem Verabschieden nullen — es übernimmt sonst die Kennung des
      // gescheiterten Motors, und der nächste Versuch liefe wieder ins Leere.
      chat.kennung = null
      if (art === 'chat') {
        verlaufEintrag(chat, { rolle: 'hinweis', text: texte.chat.hinweisChatSessionWeg })
      } else {
        chat.plan = { fortsetzen: null, hinweis: chat.bericht ? texte.chat.hinweisFrisch : chat.plan.hinweis }
        verlaufEintrag(chat, { rolle: 'hinweis', text: texte.chat.hinweisFortsetzungGescheitert })
        ereignis(chat, { art: 'chat-hinweis', hinweis: chat.plan.hinweis })
      }
      ergebnis = await motorBesorgen(chat).senden(inhalt)
    }
    if (chat.motor?.sessionKennung) chat.kennung = chat.motor.sessionKennung
    chat.beschaeftigt = false
    chat.letzterVerbrauch = verbrauchGesamt(chat, ergebnis.verbrauch)
    if (ergebnis.zustand === 'erfolgreich') {
      verlaufEintrag(chat, { rolle: 'ki', text: ergebnis.text })
    } else if (ergebnis.zustand === 'abgebrochen') {
      verlaufEintrag(chat, { rolle: 'hinweis', text: texte.chat.antwortAbgebrochen })
    } else if (ergebnis.zustand !== 'hart-abgebrochen') {
      verlaufEintrag(chat, {
        rolle: 'hinweis',
        text: ergebnis.fehlertext || texte.fehler.unbekannt
      })
    }
    verlaufSpeichern(chat)
    chatInBerichtSchreiben(chat)
    ereignis(chat, { art: 'chat-beschaeftigt', beschaeftigt: false })
    ereignis(chat, { art: 'chat-verbrauch', verbrauch: chat.letzterVerbrauch })
    // Ist während der Antwort ein Lauf zu Ende gegangen, hängt der Chat jetzt um.
    if (chat.abgleichAusstehend) berichtAbgleichen(chat)
  })()

  return { ok: true }
}

// Schalter „Chat darf reparieren" (BAUPLAN 27): gilt je Chat, wird je
// Werkzeugaufruf frisch gelesen — Umschalten wirkt sofort. Während ein Lauf
// läuft oder wartet, ist Reparieren gesperrt; in der Übersicht gibt es nichts
// zu reparieren.
export function chatReparierenSetzen(projektPfad, an) {
  const chat = chatBesorgen(projektPfad ?? null)
  if (!chat.projektPfad) return { ok: false, fehler: texte.chat.reparierenUebersicht }
  if (Boolean(an) && laufAktiv(chat.projektPfad))
    return { ok: false, fehler: texte.chat.reparierenWaehrendLauf }
  chat.reparieren = Boolean(an)
  ereignis(chat, {
    art: 'ticker',
    text: texte.ticker.chatZeile(chat.reparieren ? texte.chat.reparierenAn : texte.chat.reparierenAus)
  })
  return { ok: true, reparieren: chat.reparieren }
}

// Laufende Antwort abbrechen — die Chat-Session bleibt nutzbar.
export function chatAbbrechen(projektPfad) {
  const chat = chats.get(projektPfad ?? UEBERSICHT)
  chat?.motor?.abbrechen()
  return { ok: true }
}

// „Neues Gespräch": Verlauf leeren, Session verwerfen — der nächste Beitrag
// startet nach demselben Startplan (Lauf-Session, frisch, Übersicht). Was der
// Chat gestartet hat und noch lebt, wird abgeräumt (Prozess-Hygiene, BAUPLAN 32).
export function chatNeu(projektPfad) {
  const chat = chatBesorgen(projektPfad ?? null)
  if (chat.beschaeftigt) return { ok: false, fehler: texte.chat.beschaeftigt }
  for (const antworten of [...chat.fragen.values()]) antworten(false)
  motorVerabschieden(chat)
  chat.kennung = null
  chat.verlauf = []
  chat.verbrauchBasis = null
  chat.letzterVerbrauch = null
  chat.sicherungGemacht = false
  chat.hinweisGezeigt = false
  chat.letzterSchritt = ''
  chat.plan = chatStartplan(chat.bericht, undefined, Boolean(chat.projektPfad))
  verlaufSpeichern(chat)
  void prozessgruppeAbraeumen('chat:' + chat.schluessel)
  return { ok: true, ...chatZustand(null, projektPfad ?? null) }
}

// Rechte-Rückfragen des Chats (gleicher Dialog wie im Lauf).
export function chatFrageAntworten(frageId, erlaubt) {
  for (const chat of chats.values()) {
    const antworten = chat.fragen.get(frageId)
    if (antworten) {
      antworten(Boolean(erlaubt))
      return { ok: true }
    }
  }
  return { ok: false, fehler: texte.fehler.unbekannt }
}

// Arbeitet der Chat dieses Projekts gerade? (Ein Schreiber pro Projekt —
// solange die Antwort läuft, startet kein Lauf.)
export function chatBeschaeftigt(projektPfad) {
  return Boolean(chats.get(projektPfad)?.beschaeftigt)
}

// Laufstart (BAUPLAN 33): Der Chat bleibt — er ist ab jetzt nur lesend (die
// Getter lesen den Lauf-Zustand je Werkzeugaufruf). Sein Motor wird beendet
// und alles abgeräumt, was er (im Reparatur-Modus) gestartet hat; die nächste
// Nachricht setzt die Chat-Session über ihre Kennung fort.
export function chatLaufBeginnt(projektPfad) {
  const chat = chats.get(projektPfad)
  if (!chat) return
  for (const antworten of [...chat.fragen.values()]) antworten(false)
  motorVerabschieden(chat)
  verlaufSpeichern(chat)
  void prozessgruppeAbraeumen('chat:' + chat.schluessel)
  ereignis(chat, { art: 'chat-lauf', laufAktiv: true })
}

// Chat schließen (Projekt vergessen): Motor töten, Verlauf bleibt in der Datei.
export function chatSchliessen(projektPfad) {
  const chat = chats.get(projektPfad ?? UEBERSICHT)
  if (!chat) return
  for (const antworten of [...chat.fragen.values()]) antworten(false)
  chat.motor?.hartStoppen()
  chats.delete(chat.schluessel)
  void prozessgruppeAbraeumen('chat:' + chat.schluessel)
}
