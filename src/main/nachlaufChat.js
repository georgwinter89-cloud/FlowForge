// Nachlauf-Chat (BAUPLAN 27): Gespräch mit der Lauf-Session nach dem Lauf.
// Technisch die fortgesetzte Lauf-Session (resume über die Session-Kennung aus
// dem Laufbericht); ist sie weg oder ihr Kontext über der Wächter-Schwelle,
// startet ehrlich vermerkt eine frische Session mit dem Laufbericht als
// Kontext. Zwei Betriebsarten, im Chat umschaltbar: Standard nur-lesend
// (Karten anlegen erlaubt), auf Zuruf „Chat darf reparieren" — dann entsteht
// vor der ersten Änderung ein Sicherungspunkt. Der Chat-Verlauf wandert als
// eigener Abschnitt in den Laufbericht des Laufs.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { texte } from '../shared/texte.js'
import { einstellungenLaden } from './einstellungen.js'
import { starteChatMotor } from './motor/claudeCodeMotor.js'
import {
  KONTEXT_FENSTER_STANDARD,
  FORTSETZUNG_WAECHTER_PROZENT
} from './motor/schnittstelle.js'
import { sicherungspunktAnlegen } from './sicherungspunkte.js'

const BERICHTE_ORDNER = 'laufberichte'
// Bilder je Nachricht (Screenshots per Strg+V oder Datei-Knopf): Deckel, damit
// weder der IPC-Transfer noch das Kontextfenster des Motors platzt.
const BILDER_MAX = 4
const BILD_MAX_BYTES = 5 * 1024 * 1024

const chats = new Map() // projektPfad → Chat

// --- Reine Regel-Funktionen (prüfbar ohne Motor) ---------------------------

// Startplan des Chats: Die Lauf-Session wird fortgesetzt, wenn ihre Kennung im
// Laufbericht steht UND ihr Füllstand unter der Wächter-Schwelle liegt (die
// Mechanik aus BAUPLAN 16) — sonst frische Session mit Laufbericht-Kontext,
// ehrlich im Chat vermerkt, kein stiller Ausweichpfad.
export function chatStartplan(bericht, waechterProzent = FORTSETZUNG_WAECHTER_PROZENT) {
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

// Chat-Verlauf und -Verbrauch in den Laufbericht schreiben (SPEC: „Der
// Chat-Verlauf wandert als eigener Abschnitt in den Laufbericht des Laufs").
function chatInBerichtSchreiben(chat) {
  try {
    const bericht = JSON.parse(fs.readFileSync(chat.berichtDatei, 'utf8'))
    bericht.nachlaufChat = {
      verlauf: chat.verlauf,
      verbrauch: chat.letzterVerbrauch
    }
    const tmp = chat.berichtDatei + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(bericht, null, 2), 'utf8')
    fs.renameSync(tmp, chat.berichtDatei)
  } catch {
    // Ein nicht speicherbarer Bericht darf den Chat nicht stören — der
    // Verlauf lebt weiter im Arbeitsspeicher.
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

function chatBesorgen(projektPfad) {
  const gefunden = neuesterBericht(projektPfad)
  let chat = chats.get(projektPfad)
  // Gibt es inzwischen einen neueren Laufbericht, gehört der alte Chat zum
  // vorigen Lauf — er wird verworfen (arbeiten kann er dabei nicht: solange
  // der Chat beschäftigt ist, startet kein Lauf).
  if (chat && gefunden && chat.berichtDatei !== gefunden.datei) {
    chatSchliessen(projektPfad)
    chat = null
  }
  if (chat) return chat
  if (!gefunden) return null
  const plan = chatStartplan(gefunden.bericht)
  chat = {
    projektPfad,
    fenster: null,
    berichtDatei: gefunden.datei,
    bericht: gefunden.bericht,
    plan,
    // Kennung der Chat-Session selbst — ein Motor-Neustart (z.B. nach
    // Prozess-Tod) setzt bevorzugt sie fort, nicht mehr die Lauf-Session.
    kennung: null,
    motor: null,
    reparieren: false,
    beschaeftigt: false,
    sicherungGemacht: false,
    verlauf: gefunden.bericht.nachlaufChat?.verlauf ?? [],
    verbrauchBasis: gefunden.bericht.nachlaufChat?.verbrauch ?? null,
    letzterVerbrauch: gefunden.bericht.nachlaufChat?.verbrauch ?? null,
    fragen: new Map(),
    offeneFrage: null,
    hinweisGezeigt: (gefunden.bericht.nachlaufChat?.verlauf ?? []).length > 0
  }
  chats.set(projektPfad, chat)
  return chat
}

function motorBesorgen(chat) {
  if (chat.motor && !chat.motor.istTot()) return chat.motor
  motorVerabschieden(chat)
  const { einstellungen } = einstellungenLaden()
  // Bevorzugt die eigene Chat-Session fortsetzen (nach Prozess-Tod), sonst
  // die Lauf-Session laut Startplan, sonst frisch mit Laufbericht-Kontext.
  const fortsetzen = chat.kennung ?? chat.plan.fortsetzen
  chat.motor = starteChatMotor({
    projektPfad: chat.projektPfad,
    modus: einstellungen.motorModus,
    apiSchluessel: einstellungen.apiSchluessel,
    ausgabenObergrenzeUsd: einstellungen.ausgabenObergrenzeUsd,
    fortsetzen,
    laufKontext: fortsetzen ? '' : laufberichtKontext(chat.bericht),
    nurLesenBefehle: Boolean(einstellungen.nurLesenBefehle),
    holeReparieren: () => chat.reparieren,
    // Sicherungspunkt vor der ersten Änderung (BAUPLAN 27) — einmal je Chat;
    // Reparaturen erscheinen damit in der Sicherungspunkt-Liste.
    vorErsterAenderung: async () => {
      if (chat.sicherungGemacht) return
      chat.sicherungGemacht = true
      const punkt = await sicherungspunktAnlegen(
        chat.projektPfad,
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
      if (e.art === 'ticker')
        return ereignis(chat, { art: 'ticker', text: texte.ticker.chatZeile(e.text) })
      if (e.art === 'denken')
        return ereignis(chat, { art: 'denken', absender: texte.chat.denkAbsender, text: e.text })
      if (e.art === 'chat-verbrauch') {
        chat.letzterVerbrauch = verbrauchGesamt(chat, e.verbrauch)
        return ereignis(chat, { art: 'chat-verbrauch', verbrauch: chat.letzterVerbrauch })
      }
      // Karten-Ereignisse u.ä. unverändert an die Oberfläche.
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
          ereignis(chat, { art: 'frage-erledigt', frageId })
          antworten(erlaubt)
        })
        ereignis(chat, { art: 'frage', frageId, beschreibung: frage.beschreibung })
      })
    }
  })
  return chat.motor
}

// Für die Oberfläche: Gibt es einen Chat zum letzten Lauf — und wo steht er?
// Das Fenster wird schon hier gemerkt, damit auch Ereignisse vor der ersten
// Nachricht (z.B. die Ticker-Zeile des Reparieren-Schalters) ankommen.
export function chatZustand(fenster, projektPfad) {
  const chat = chatBesorgen(projektPfad)
  if (!chat) return { ok: true, verfuegbar: false }
  if (fenster) chat.fenster = fenster
  return {
    ok: true,
    verfuegbar: true,
    hinweis: chat.plan.hinweis,
    verlauf: chat.verlauf,
    reparieren: chat.reparieren,
    beschaeftigt: chat.beschaeftigt,
    verbrauch: chat.letzterVerbrauch,
    // Nach einem Ansichtswechsel muss eine offene Rechte-Frage wiederkommen —
    // sonst hinge der Chat ewig an einem unsichtbaren Dialog.
    frage: chat.offeneFrage ?? null
  }
}

export function chatSenden(fenster, projektPfad, text, bilder) {
  const chat = chatBesorgen(projektPfad)
  if (!chat) return { ok: false, fehler: texte.chat.keinBericht }
  if (chat.beschaeftigt) return { ok: false, fehler: texte.chat.beschaeftigt }
  const sauber = String(text ?? '').trim()
  const geprueft = bildBloecke(bilder)
  if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler }
  if (!sauber && geprueft.bloecke.length === 0) return { ok: false, fehler: texte.fehler.unbekannt }
  chat.fenster = fenster
  chat.beschaeftigt = true

  // Ehrlichkeit: Woher der Chat seinen Kontext hat, steht als erster Eintrag
  // sichtbar im Verlauf (und damit im Laufbericht).
  if (!chat.hinweisGezeigt) {
    chat.hinweisGezeigt = true
    verlaufEintrag(chat, { rolle: 'hinweis', text: chat.plan.hinweis })
  }
  verlaufEintrag(chat, { rolle: 'mensch', text: sauber, bilder: geprueft.bloecke.length })
  chatInBerichtSchreiben(chat)
  ereignis(chat, { art: 'chat-beschaeftigt', beschaeftigt: true })

  const inhalt =
    geprueft.bloecke.length > 0
      ? [...geprueft.bloecke, ...(sauber ? [{ type: 'text', text: sauber }] : [])]
      : sauber

  ;(async () => {
    let ergebnis = await motorBesorgen(chat).senden(inhalt)
    // Die Lauf-Session ließ sich doch nicht fortsetzen: ehrlich vermerken,
    // frisch mit Laufbericht-Kontext starten — und dieselbe Nachricht erneut
    // senden, damit sie nicht verloren geht.
    if (ergebnis.zustand === 'fortsetzung-gescheitert') {
      chat.plan = { fortsetzen: null, hinweis: texte.chat.hinweisFrisch }
      motorVerabschieden(chat)
      // NACH dem Verabschieden nullen — es übernimmt sonst die Kennung des
      // gescheiterten Motors, und der nächste Versuch liefe wieder ins Leere.
      chat.kennung = null
      verlaufEintrag(chat, { rolle: 'hinweis', text: texte.chat.hinweisFortsetzungGescheitert })
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
    chatInBerichtSchreiben(chat)
    ereignis(chat, { art: 'chat-beschaeftigt', beschaeftigt: false })
    ereignis(chat, { art: 'chat-verbrauch', verbrauch: chat.letzterVerbrauch })
  })()

  return { ok: true }
}

// Schalter „Chat darf reparieren" (BAUPLAN 27): gilt je Chat, wird je
// Werkzeugaufruf frisch gelesen — Umschalten wirkt sofort.
export function chatReparierenSetzen(projektPfad, an) {
  const chat = chatBesorgen(projektPfad)
  if (!chat) return { ok: false, fehler: texte.chat.keinBericht }
  chat.reparieren = Boolean(an)
  ereignis(chat, {
    art: 'ticker',
    text: texte.ticker.chatZeile(chat.reparieren ? texte.chat.reparierenAn : texte.chat.reparierenAus)
  })
  return { ok: true, reparieren: chat.reparieren }
}

// Laufende Antwort abbrechen — die Chat-Session bleibt nutzbar.
export function chatAbbrechen(projektPfad) {
  const chat = chats.get(projektPfad)
  chat?.motor?.abbrechen()
  return { ok: true }
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

// Chat schließen (Laufstart, Projekt vergessen): Der Chat gehört zum letzten
// Lauf — ein neuer Lauf bringt einen neuen Chat mit frischem Kontext.
export function chatSchliessen(projektPfad) {
  const chat = chats.get(projektPfad)
  if (!chat) return
  for (const antworten of [...chat.fragen.values()]) antworten(false)
  chat.motor?.hartStoppen()
  chats.delete(projektPfad)
}
