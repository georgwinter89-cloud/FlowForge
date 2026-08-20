// Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026): Ein eigener kleiner
// Recherche-Kreislauf gegen Ollama. Die Block-Agenten delegieren reines
// Einlesen und Suchen an das lokale Modell statt an eine Motor-Unteraufgabe —
// das kostet kein Abo-Kontingent, nur Rechenzeit auf Georgs Rechner.
//
// Sicherheits-Zuschnitt (erzwungen im Code, nicht per Bitte): Beim
// Recherchieren bekommt das lokale Modell genau drei Werkzeuge — Ordner
// auflisten, Datei lesen, suchen — und alle drei arbeiten ausschließlich
// lesend innerhalb des Projektordners. Es kann nichts ausführen und nichts
// außerhalb des Projekts sehen. Sein Fazit ist reiner Text.
//
// Lokale Vorreparatur (BAUPLAN 20): Zusätzlich gibt es einen eng gezügelten
// Reparatur-Kreislauf mit genau einem Schreib-Werkzeug — gezieltes Ersetzen
// (kein freies Datei-Schreiben), nur im Projektordner, Prüfmappe und
// FlowForge-Verwaltungsdateien tabu. Die Nachprüfung des Prüfers bleibt der
// Schiedsrichter; FlowForge rollt gescheiterte Versuche zurück (lauf.js).
//
// Lokale Entwürfe (BAUPLAN 21): Ein Entwurfs-Kreislauf für Schreibarbeit mit
// Vorbild oder klarer Beschreibung. Sein Schreibwerkzeug ist hart auf den Ordner
// arbeitsablage/ begrenzt — die Wegwerf-Fläche, die am Laufende geleert wird.
// Der Block-Agent (Motor) liest jeden Entwurf gegen und übernimmt ihn selbst
// an den Zielort — ungeprüft zählt nichts.
//
// Lokaler Bauer (BAUPLAN 22): Ein Bau-Kreislauf für einzeln prüfbare
// Teilaufträge — mit echtem Schreibrecht im Projektordner (gezieltes
// Ersetzen plus ganze Dateien schreiben), unter denselben harten Sperren wie
// der Bauer: Prüfmappe, Verwaltungsdateien und Git bleiben tabu. Den
// Sicherungspunkt vor jedem Teilauftrag und das Rückrollen bei gescheiterter
// Abnahme übernimmt FlowForge (helferWerkzeuge.js) — Opus liest jedes
// Teilstück sofort gegen.
//
// Zuschnitt der Aufträge (Wunsch Georg 18.08.2026): Die lokale KI darf auch
// mittelgroße, zusammenhängende Teilaufträge und Neues mit klarer Beschreibung
// bekommen — ein ganzes Modul mit festgelegter Schnittstelle, mehrere
// zusammengehörige Dateien, ein Entwurf ohne exaktes Vorbild. Schiedsrichter
// bleibt die Abnahme durch den Block-Agenten (Gegenlesen, Rückroll bei „nicht
// gehalten"); die Regeln „2 Anläufe, kein Pingpong, prüfe Fundorte selbst nach"
// gelten weiter.
//
// Nachrichtenform (Wunsch Georg 18.08.2026): JEDE Nachricht, die FlowForge an
// die lokale KI schickt, hat die Form { role: 'user', content: '<Text>' } —
// kein system-Eintrag, keine tool-Rolle. Grund: Manche lokalen Modelle bzw.
// ihre Chat-Vorlagen kommen mit system- und tool-Rollen nicht zurecht (Vorlage
// ohne System-Slot, tool-Nachricht wird verschluckt oder als Fehler gewertet);
// eine einheitliche Nutzer-Rolle läuft mit jeder Vorlage. Der bisherige
// System-Text steht deshalb am Anfang der ersten Nutzer-Nachricht, Werkzeug-
// Ergebnisse gehen als Nutzer-Nachricht mit Kennzeichnung („Ergebnis von
// <werkzeug>:") — alle Ergebnisse einer Runde gebündelt in EINER Nachricht,
// damit sich user und assistant strikt abwechseln —, das Nachhaken ebenso. Nur
// die Antworten des Modells selbst (role assistant, ggf. mit tool_calls/
// thinking) bleiben unverändert im Verlauf (fehlt die Rolle, wird sie ergänzt).
//
// Tabu-Liste (BAUPLAN 46): Vorreparatur und lokaler Bauer bekommen die
// Dateiliste des Blocks, für den sie schreiben, und lehnen Schreiben außerhalb
// ab (arbeitsablage/ frei, ohne Liste keine Sperre) — die Lücke, die SPEC §7
// bis Bauschritt 45 als ehrliche Grenze nannte, ist damit zu.
//
// Bewusst ohne Electron-Abhängigkeiten: das Modul ist einzeln (mit node)
// erprobbar, wie es die Bauplan-Regel für neue Bausteine verlangt.
import fs from 'node:fs'
import path from 'node:path'
import { texte } from '../../shared/texte.js'
// Tabu-Liste (BAUPLAN 46): dieselbe Rechnung „gehört diese Datei in diese
// Liste" wie die Schreibsperre des Motors — kein eigener Abgleicher hier,
// sonst sperrte die lokale KI eine Datei, die der Bauer schreiben darf.
import { stehtInDateiliste } from '../dateilistenPfade.js'

// Standard-Adresse: Ollama auf diesem Rechner. Über die Einstellungen ist auch
// ein anderer Rechner im Heimnetz möglich (z.B. ein Gaming-PC mit richtiger
// Grafikkarte — dort laufen größere Modelle schneller und genauer).
const STANDARD_ADRESSE = 'http://127.0.0.1:11434'

// Kontext-Fenster der lokalen KI (Einstellung `lokaleHelferKontext`, seit
// 0.46.3 — Wunsch Georg 18.08.2026 für ein 27B-Modell auf einer 32-GB-Karte):
// 32k, 64k oder 128k Token; num_ctx wird je Anfrage mitgeschickt und
// überstimmt die Ollama-Einstellung. Ehrliche Grenze, die in der Einstellung
// steht: Das Arbeitsgedächtnis (KV-Cache) wächst mit dem Fenster — bei einem
// 27B-Modell grob 250 KB je Token, also ~16 GB bei 64k und ~32 GB bei 128k
// zusätzlich zu den Gewichten. Passt es nicht in die Karte, lagert Ollama still
// auf die CPU aus und alles kriecht; kleine Modelle verlieren in Riesen-
// Kontexten außerdem den Faden. Deshalb Standard 64k, nicht 128k.
//
// Die Werkzeug-Deckel (Zeilen je Lesen, Zeichen je Antwort, Suchtreffer,
// Ordnereinträge) und der Runden-Deckel wachsen mit dem Fenster mit — sonst
// bekäme ein 128k-Modell dieselben Häppchen wie ein 32k-Modell und bräuchte
// nur mehr Runden. Bezugsgröße sind die 32k-Werte (400 / 24.000 / 60 / 300 /
// 48 Runden — die 48 statt 32 seit 18.08.2026, weil die lokale KI auch
// mittelgroße Aufträge bekommt); bei 64k das Doppelte, bei 128k das Vierfache
// (Runden: 48 / 64 / 96 — Runden hängen an der Aufgabentiefe, nicht linear
// am Fenster). Alle Deckel liegen in `grenzen`, gesetzt über
// lokaleHelferKontextSetzen — einmal je Laufstart aus den Einstellungen.
export const KONTEXT_FENSTER_STANDARD = 65536
export const KONTEXT_FENSTER_WAHL = [32768, 65536, 131072]
const ANTWORT_ZEITLIMIT_MS = 5 * 60 * 1000

export function grenzenFuer(kontext) {
  const fenster = KONTEXT_FENSTER_WAHL.includes(Number(kontext))
    ? Number(kontext)
    : KONTEXT_FENSTER_STANDARD
  const faktor = fenster / 32768
  return {
    kontext: fenster,
    runden: fenster >= 131072 ? 96 : fenster >= 65536 ? 64 : 48,
    zeilenJeLesen: 400 * faktor,
    zeichenJeAntwort: 24000 * faktor,
    trefferJeSuche: 60 * faktor,
    eintraegeJeOrdner: 300 * faktor
  }
}

let grenzen = grenzenFuer(KONTEXT_FENSTER_STANDARD)

// Vom Lauf beim Start aufgerufen (Einstellung ist global — alle Läufe teilen
// sich denselben Wert). Liefert die geltenden Grenzen zurück (für Ticker/Test).
export function lokaleHelferKontextSetzen(kontext) {
  grenzen = grenzenFuer(kontext)
  return { ...grenzen }
}

export function lokaleHelferGrenzen() {
  return { ...grenzen }
}

// Ordner, in denen nie gesucht oder gelistet wird — Ballast ohne Erkenntnis.
const UEBERSPRUNGEN = new Set(['node_modules', '.git', 'laufberichte'])

// Ist Ollama erreichbar und das Modell vorhanden? Liefert eine ehrliche
// Auskunft für den Laufstart (Ticker) und die Einstellungen-Anzeige.
export async function lokaleHelferPruefen(modell, adresse = STANDARD_ADRESSE) {
  try {
    const abbruch = AbortSignal.timeout(3000)
    const antwort = await fetch((adresse || STANDARD_ADRESSE) + '/api/tags', { signal: abbruch })
    if (!antwort.ok) return { erreichbar: false, modellDa: false }
    const daten = await antwort.json()
    // Feld wirklich prüfen, nicht nur „irgendein JSON kam zurück" (gemessene
    // Restlücke, 20.08.2026): Ein Dienst, der unter dieser Adresse zufällig
    // {"irgendwas":"x"} liefert, ergab bisher {erreichbar:true, modelle:[]} —
    // die Anzeige sagte dann „Ollama läuft, Modell fehlt", obwohl dort gar kein
    // Ollama antwortet.
    if (!Array.isArray(daten?.models)) return { erreichbar: true, modellDa: false, modelle: [] }
    const namen = daten.models.map((m) => String(m?.name ?? '')).filter(Boolean)
    const modellDa = namen.some((n) => n === modell || n === modell + ':latest')
    return { erreichbar: true, modellDa, modelle: namen }
  } catch {
    return { erreichbar: false, modellDa: false }
  }
}

function imProjekt(projektPfad, angefragt) {
  const wurzel = path.resolve(projektPfad)
  const ziel = path.resolve(wurzel, String(angefragt ?? '.'))
  const relativ = path.relative(wurzel.toLowerCase(), ziel.toLowerCase())
  if (relativ !== '' && (relativ.startsWith('..') || path.isAbsolute(relativ))) return null
  return ziel
}

function gestutzt(text) {
  const t = String(text)
  return t.length > grenzen.zeichenJeAntwort
    ? t.slice(0, grenzen.zeichenJeAntwort) + '\n… (gekürzt — lies gezielter weiter, z.B. mit vonZeile)'
    : t
}

// Werkzeug 1: Ordner auflisten (rein lesend, nur im Projekt).
function ordnerAuflisten(projektPfad, eingabe) {
  const ziel = imProjekt(projektPfad, eingabe.pfad ?? '.')
  if (!ziel) return 'Abgelehnt: Pfade außerhalb des Projektordners sind gesperrt.'
  let eintraege
  try {
    eintraege = fs.readdirSync(ziel, { withFileTypes: true })
  } catch {
    return `Ordner nicht lesbar oder nicht vorhanden: ${eingabe.pfad ?? '.'}`
  }
  const zeilen = []
  for (const e of eintraege) {
    if (UEBERSPRUNGEN.has(e.name)) continue
    if (zeilen.length >= grenzen.eintraegeJeOrdner) {
      zeilen.push('… (weitere Einträge weggelassen)')
      break
    }
    if (e.isDirectory()) zeilen.push(e.name + '/')
    else {
      let groesse = ''
      try {
        groesse = ' (' + fs.statSync(path.join(ziel, e.name)).size + ' Byte)'
      } catch {
        // Größe ist nur Beiwerk.
      }
      zeilen.push(e.name + groesse)
    }
  }
  return zeilen.length ? zeilen.join('\n') : '(leer)'
}

// Werkzeug 2: Datei lesen (rein lesend, nur im Projekt, mit Zeilenfenster).
function dateiLesen(projektPfad, eingabe) {
  const ziel = imProjekt(projektPfad, eingabe.pfad)
  if (!ziel) return 'Abgelehnt: Pfade außerhalb des Projektordners sind gesperrt.'
  let inhalt
  try {
    inhalt = fs.readFileSync(ziel, 'utf8')
  } catch {
    return `Datei nicht lesbar oder nicht vorhanden: ${eingabe.pfad}`
  }
  const zeilen = inhalt.split('\n')
  const von = Math.max(1, Number(eingabe.vonZeile) || 1)
  const bis = Math.min(zeilen.length, von + grenzen.zeilenJeLesen - 1)
  const teil = zeilen
    .slice(von - 1, bis)
    .map((z, i) => `${von + i}: ${z}`)
    .join('\n')
  const kopf = `${eingabe.pfad} — Zeilen ${von}-${bis} von ${zeilen.length}\n`
  const rest =
    bis < zeilen.length ? `\n… Datei geht weiter — lies mit vonZeile: ${bis + 1} nach.` : ''
  return gestutzt(kopf + teil + rest)
}

// Werkzeug 3: Suchen (rein lesend, nur Textdateien im Projekt).
function suchen(projektPfad, eingabe) {
  const muster = String(eingabe.muster ?? '').trim()
  if (!muster) return 'Abgelehnt: leeres Suchmuster.'
  let regex
  try {
    regex = new RegExp(muster, 'i')
  } catch {
    regex = null // dann wörtliche Suche
  }
  const treffer = []
  const stapel = [path.resolve(projektPfad)]
  while (stapel.length && treffer.length < grenzen.trefferJeSuche) {
    const ordner = stapel.pop()
    let eintraege
    try {
      eintraege = fs.readdirSync(ordner, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of eintraege) {
      if (treffer.length >= grenzen.trefferJeSuche) break
      const voll = path.join(ordner, e.name)
      if (e.isDirectory()) {
        if (!UEBERSPRUNGEN.has(e.name)) stapel.push(voll)
        continue
      }
      if (/\.(png|jpe?g|gif|ico|webp|woff2?|ttf|zip|exe|dll|pdf|mp3|wav)$/i.test(e.name)) continue
      let inhalt
      try {
        if (fs.statSync(voll).size > 2 * 1024 * 1024) continue
        inhalt = fs.readFileSync(voll, 'utf8')
      } catch {
        continue
      }
      const relativ = path.relative(projektPfad, voll)
      const zeilen = inhalt.split('\n')
      for (let i = 0; i < zeilen.length && treffer.length < grenzen.trefferJeSuche; i++) {
        const passt = regex ? regex.test(zeilen[i]) : zeilen[i].includes(muster)
        if (passt) treffer.push(`${relativ}:${i + 1}: ${zeilen[i].trim().slice(0, 200)}`)
      }
    }
  }
  if (!treffer.length) return `Keine Treffer für: ${muster}`
  const hinweis =
    treffer.length >= grenzen.trefferJeSuche ? '\n… (weitere Treffer weggelassen — suche enger)' : ''
  return gestutzt(treffer.join('\n') + hinweis)
}

// Als Funktion, nicht als Konstante: Die Beschreibung von datei_lesen nennt den
// Zeilen-Deckel, und der hängt am eingestellten Kontext-Fenster (grenzen).
function lesendeWerkzeuge() {
  return [
  {
    type: 'function',
    function: {
      name: 'ordner_auflisten',
      description: 'Listet einen Ordner im Projekt auf (Dateien und Unterordner).',
      parameters: {
        type: 'object',
        properties: {
          pfad: { type: 'string', description: 'Ordner relativ zum Projekt, z.B. "." oder "js"' }
        },
        required: ['pfad']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'datei_lesen',
      description:
        'Liest eine Textdatei im Projekt (höchstens ' +
        grenzen.zeilenJeLesen +
        ' Zeilen je Aufruf; mit vonZeile weiterblättern).',
      parameters: {
        type: 'object',
        properties: {
          pfad: { type: 'string', description: 'Datei relativ zum Projekt, z.B. "js/main.js"' },
          vonZeile: { type: 'number', description: 'Erste Zeile (Standard 1)' }
        },
        required: ['pfad']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suchen',
      description: 'Durchsucht alle Textdateien des Projekts nach einem Muster (auch regulärer Ausdruck).',
      parameters: {
        type: 'object',
        properties: {
          muster: { type: 'string', description: 'Suchmuster, z.B. ein Funktionsname' }
        },
        required: ['muster']
      }
    }
  }
  ]
}

// --- Lokale Vorreparatur (BAUPLAN 20) --------------------------------------

// Versuchs-Budget je Rückführung: so oft darf die lokale KI reparieren,
// bevor der Motor-Bauer übernimmt. Lokale Versuche verbrauchen KEINE
// regulären Reparatur-Runden des Workflows.
export const LOKALE_REPARATUR_VERSUCHE = 2

// Opus sortiert vor (BAUPLAN 20): Der Prüfer stuft jede Beanstandung als
// „mechanisch" oder „grundsaetzlich" ein. Nur wenn ALLE mechanisch sind, lohnt
// die lokale Wette. Seit dem Lieferschein (BAUPLAN 42) steht die Einstufung als
// Feld in der Meldung — die Regel dafür wohnt in lieferschein.js
// (beanstandungenEinstufen).

// Tabu-Zonen der Schreib-Werkzeuge (Vorreparatur UND lokaler Bauer) —
// dieselben harten Sperren wie beim Bauer, durchgesetzt im FlowForge-Code
// (nicht per Bitte an das Modell).
const SCHREIB_TABU_DATEIEN = new Set([
  'projekt.json',
  'karten.json',
  'workflow.json',
  'startanleitung.json',
  'laufstand.json',
  'naechster-lauf.json',
  'chat.json'
])
const SCHREIB_TABU_ORDNER = new Set(['pruefung', 'laufberichte', 'node_modules', '.git'])

// Gemeinsame Tabu-Prüfung: null = erlaubt, sonst die Ablehnung als Text.
//
// `dateiListe` (BAUPLAN 46): die Dateiliste des Blocks, für den die lokale KI
// gerade schreibt (Vorreparatur: die des Rückführungs-Ziels; lokal_bauen: die
// des Bauers). Bis Bauschritt 45 schrieb dieser Pfad mit echtem Schreibrecht
// im ganzen Projektordner an der Dateiliste vorbei — SPEC §7 nannte das
// ehrlich als Grenze. Jetzt ist die Liste hier eine Tabu-Liste: Ein Ziel
// außerhalb wird abgelehnt, mit dem Weg heraus (im Fazit melden, nicht erneut
// versuchen). null/leer = keine Sperre (SPEC §7 (2), alte Laufstände);
// arbeitsablage/ bleibt frei (SPEC §7 (4)). Die spezifischeren Sperren oben
// (Prüfmappe, Verwaltungsdateien) gehen vor und nennen ihren eigenen Grund.
const FREIER_ORDNER = 'arbeitsablage'
function schreibTabu(projektPfad, ziel, dateiListe = null) {
  const relativ = path.relative(path.resolve(projektPfad), ziel).toLowerCase()
  const oberster = relativ.split(path.sep)[0]
  if (SCHREIB_TABU_ORDNER.has(oberster))
    return `Abgelehnt: Der Ordner „${oberster}" ist für die lokale KI gesperrt.`
  if (SCHREIB_TABU_DATEIEN.has(relativ))
    return 'Abgelehnt: FlowForge-Verwaltungsdateien sind gesperrt.'
  if (Array.isArray(dateiListe) && dateiListe.length > 0) {
    if (oberster === FREIER_ORDNER) return null
    if (!stehtInDateiliste(ziel, projektPfad, dateiListe))
      return texte.agentenLokaleHelfer.ausserhalbDateiliste(
        relativ.split(path.sep).join('/'),
        dateiListe
      )
  }
  return null
}

// Das einzige Schreib-Werkzeug der lokalen KI: gezieltes Ersetzen. Der alte
// Text muss genau und eindeutig in der Datei stehen — kein freies Schreiben,
// kein Anlegen, kein Löschen. zaehler.ersetzungen zählt die echten Änderungen.
function ersetzen(projektPfad, eingabe, zaehler, dateiListe = null) {
  const ziel = imProjekt(projektPfad, eingabe.pfad)
  if (!ziel) return 'Abgelehnt: Pfade außerhalb des Projektordners sind gesperrt.'
  const tabu = schreibTabu(projektPfad, ziel, dateiListe)
  if (tabu) return tabu
  const alt = String(eingabe.alt ?? '')
  const neu = String(eingabe.neu ?? '')
  if (!alt) return 'Abgelehnt: leerer alt-Text.'
  if (alt === neu) return 'Abgelehnt: alt und neu sind identisch — nichts zu ersetzen.'
  let inhalt
  try {
    inhalt = fs.readFileSync(ziel, 'utf8')
  } catch {
    return `Datei nicht lesbar oder nicht vorhanden: ${eingabe.pfad}`
  }
  const vorkommen = inhalt.split(alt).length - 1
  if (vorkommen === 0)
    return (
      'Nicht gefunden: Der alt-Text steht so nicht in der Datei. Er muss ZEICHENGENAU ' +
      'stimmen (auch Einrückung und Zeilenumbrüche) — lies die Stelle mit datei_lesen nach.'
    )
  if (vorkommen > 1)
    return `Nicht eindeutig: Der alt-Text kommt ${vorkommen}-mal vor. Nimm umgebende Zeilen dazu, bis er eindeutig ist.`
  try {
    fs.writeFileSync(ziel, inhalt.replace(alt, neu), 'utf8')
  } catch {
    return `Die Datei ließ sich nicht schreiben: ${eingabe.pfad}`
  }
  zaehler.ersetzungen++
  return `Ersetzt in ${eingabe.pfad}.`
}

const ERSETZEN_WERKZEUG = {
  type: 'function',
  function: {
    name: 'ersetzen',
    description:
      'Ersetzt in einer Projektdatei genau eine Textstelle. alt muss zeichengenau und eindeutig in der Datei stehen.',
    parameters: {
      type: 'object',
      properties: {
        pfad: { type: 'string', description: 'Datei relativ zum Projekt, z.B. "js/main.js"' },
        alt: { type: 'string', description: 'Der bisherige Text — zeichengenau, samt Einrückung' },
        neu: { type: 'string', description: 'Der neue Text an dieser Stelle' }
      },
      required: ['pfad', 'alt', 'neu']
    }
  }
}

// --- Lokale Entwürfe (BAUPLAN 21) ------------------------------------------

// Der einzige Ablageort für Entwürfe: die Wegwerf-Fläche der Agenten. Von
// Sicherungspunkten ausgenommen, am Laufende geleert — ein unbrauchbarer
// Entwurf ist ehrlich billiger Ausschuss, kein Schaden.
const ENTWURF_ORDNER = 'arbeitsablage'

// Das Schreibwerkzeug des Entwurfs-Kreislaufs: freies Datei-Schreiben, aber
// ausschließlich unter arbeitsablage/ — hart im Code begrenzt, kein Ersetzen
// in Projektdateien (das bleibt der Vorreparatur mit eigenen Leitplanken).
// zaehler.dateien sammelt die geschriebenen Entwurfspfade.
function entwurfSchreiben(projektPfad, eingabe, zaehler) {
  const ziel = imProjekt(projektPfad, eingabe.pfad)
  if (!ziel) return 'Abgelehnt: Pfade außerhalb des Projektordners sind gesperrt.'
  const relativ = path.relative(path.resolve(projektPfad), ziel)
  const oberster = relativ.split(path.sep)[0].toLowerCase()
  if (oberster !== ENTWURF_ORDNER || relativ.toLowerCase() === ENTWURF_ORDNER)
    return `Abgelehnt: Entwürfe dürfen nur in den Ordner ${ENTWURF_ORDNER}/ geschrieben werden — nimm z.B. ${ENTWURF_ORDNER}/entwurf-name.txt.`
  const inhalt = String(eingabe.inhalt ?? '')
  if (!inhalt.trim()) return 'Abgelehnt: leerer Entwurf — schreibe den vollständigen Inhalt in inhalt.'
  try {
    fs.mkdirSync(path.dirname(ziel), { recursive: true })
    fs.writeFileSync(ziel, inhalt, 'utf8')
  } catch {
    return `Die Datei ließ sich nicht schreiben: ${eingabe.pfad}`
  }
  const pfadNormal = relativ.split(path.sep).join('/')
  if (!zaehler.dateien.includes(pfadNormal)) zaehler.dateien.push(pfadNormal)
  return `Entwurf geschrieben: ${pfadNormal} (${inhalt.length} Zeichen).`
}

const ENTWURF_WERKZEUG = {
  type: 'function',
  function: {
    name: 'entwurf_schreiben',
    description:
      'Schreibt eine Entwurfsdatei — ausschließlich in den Ordner ' +
      ENTWURF_ORDNER +
      '/. Der Inhalt muss vollständig sein (die ganze Datei, kein Ausschnitt).',
    parameters: {
      type: 'object',
      properties: {
        pfad: {
          type: 'string',
          description: 'Zieldatei, z.B. "' + ENTWURF_ORDNER + '/entwurf-pruefung-x.js"'
        },
        inhalt: { type: 'string', description: 'Der vollständige Dateiinhalt' }
      },
      required: ['pfad', 'inhalt']
    }
  }
}

// --- Lokaler Bauer (BAUPLAN 22) --------------------------------------------

// Das zweite Schreibwerkzeug des Bau-Kreislaufs: ganze Dateien schreiben —
// für neue Dateien oder komplette Neuschriebe im Teilauftrag. Dieselben
// Tabu-Zonen wie beim Ersetzen; zaehler.geschrieben sammelt die Pfade.
function dateiSchreiben(projektPfad, eingabe, zaehler, dateiListe = null) {
  const ziel = imProjekt(projektPfad, eingabe.pfad)
  if (!ziel) return 'Abgelehnt: Pfade außerhalb des Projektordners sind gesperrt.'
  const tabu = schreibTabu(projektPfad, ziel, dateiListe)
  if (tabu) return tabu
  const inhalt = String(eingabe.inhalt ?? '')
  if (!inhalt.trim())
    return 'Abgelehnt: leerer Inhalt — schreibe die vollständige Datei in inhalt.'
  try {
    fs.mkdirSync(path.dirname(ziel), { recursive: true })
    fs.writeFileSync(ziel, inhalt, 'utf8')
  } catch {
    return `Die Datei ließ sich nicht schreiben: ${eingabe.pfad}`
  }
  const pfadNormal = path
    .relative(path.resolve(projektPfad), ziel)
    .split(path.sep)
    .join('/')
  if (!zaehler.geschrieben.includes(pfadNormal)) zaehler.geschrieben.push(pfadNormal)
  return `Geschrieben: ${pfadNormal} (${inhalt.length} Zeichen).`
}

const DATEI_SCHREIBEN_WERKZEUG = {
  type: 'function',
  function: {
    name: 'datei_schreiben',
    description:
      'Schreibt eine Datei im Projekt vollständig neu (auch neue Dateien). Für kleine Änderungen an bestehenden Dateien nimm stattdessen ersetzen.',
    parameters: {
      type: 'object',
      properties: {
        pfad: { type: 'string', description: 'Datei relativ zum Projekt, z.B. "js/neu.js"' },
        inhalt: { type: 'string', description: 'Der vollständige Dateiinhalt' }
      },
      required: ['pfad', 'inhalt']
    }
  }
}

// `dateiListe` (BAUPLAN 46) erreicht nur die beiden Schreib-Werkzeuge im
// Projekt; Entwürfe sind ohnehin auf arbeitsablage/ begrenzt, Lesen ist frei.
function werkzeugAusfuehren(projektPfad, name, eingabe, zaehler, dateiListe = null) {
  if (name === 'ordner_auflisten') return ordnerAuflisten(projektPfad, eingabe)
  if (name === 'datei_lesen') return dateiLesen(projektPfad, eingabe)
  if (name === 'suchen') return suchen(projektPfad, eingabe)
  // Schreib-Werkzeuge nur im jeweils passenden Kreislauf — auch wenn das
  // Modell einen nicht angebotenen Werkzeugnamen halluziniert.
  if (name === 'ersetzen' && typeof zaehler?.ersetzungen === 'number')
    return ersetzen(projektPfad, eingabe, zaehler, dateiListe)
  if (name === 'entwurf_schreiben' && Array.isArray(zaehler?.dateien))
    return entwurfSchreiben(projektPfad, eingabe, zaehler)
  if (name === 'datei_schreiben' && Array.isArray(zaehler?.geschrieben))
    return dateiSchreiben(projektPfad, eingabe, zaehler, dateiListe)
  return `Unbekanntes Werkzeug: ${name}`
}

// Die einzige Nachrichtenform von FlowForge an die lokale KI (Wunsch Georg
// 18.08.2026, s. Kopf): immer role 'user' mit einem String als content — kein
// system, kein tool. Wer eine Nachricht an die lokale KI baut, geht hier durch;
// so kann kein Kreislauf still eine andere Rolle einschleusen.
function nutzerNachricht(text) {
  return { role: 'user', content: String(text ?? '') }
}

// Werkzeug-Ergebnisse zurück an die lokale KI: keine tool-Rolle mehr, sondern
// eine Nutzer-Nachricht, die im Text klar sagt, von welchem Werkzeug jedes
// Ergebnis stammt — sonst hielte das Modell den Dateiinhalt für eine neue
// Anweisung. Alle Ergebnisse EINER Runde stehen in EINER Nutzer-Nachricht
// (Prüfer-Hinweis 18.08.2026): Vorlagen mit strikter Abwechslung user/assistant
// verschlucken sonst die zweite und dritte Nachricht hintereinander. Gilt für
// echte tool_calls UND für den getarnten Pfad. `ergebnisse` = [[name, text], …].
function werkzeugErgebnisNachricht(ergebnisse) {
  return nutzerNachricht(
    ergebnisse
      .map(([name, ergebnis]) => texte.agentenLokaleHelfer.werkzeugErgebnis(name, String(ergebnis)))
      .join('\n\n')
  )
}

// Erste Nachricht eines Kreislaufs: der frühere System-Text, Leerzeile, dann
// der Auftrag (der ggf. schon mit dem Projektwissen beginnt) — alles in EINER
// Nutzer-Nachricht, damit auch Vorlagen ohne System-Slot den Rahmen lesen.
function auftaktNachricht(systemText, auftrag) {
  return nutzerNachricht(systemText + '\n\n' + String(auftrag ?? ''))
}

// System-Texte der vier Kreisläufe — hier gesammelt, damit Prüfungen den
// Auftakt gegen genau diesen Wortlaut messen können.
export const KREISLAUF_SYSTEMTEXTE = {
  recherche:
    'Du bist ein Recherche-Helfer, der in einem Projektordner liest und sucht — mehr ' +
    'nicht. Du arbeitest allein: Niemand liest deine Antwort im Gespräch, Rückfragen ' +
    'werden nie beantwortet. Stelle also KEINE Fragen — recherchiere mit dem, was der ' +
    'Auftrag nennt; bleibt etwas unklar, schreibe ins Fazit, was du gefunden hast und ' +
    'was offen blieb. Nutze die Werkzeuge gezielt: erst Überblick (ordner_auflisten, ' +
    'suchen), dann die nötigen Stellen lesen — auch mehrere Dateien und größere ' +
    'Zusammenhänge, wenn der Auftrag das verlangt. Wenn du genug weißt, ' +
    'antworte OHNE weiteren Werkzeugaufruf mit deinem Fazit: kompakt, auf Deutsch, ' +
    'mit Fundorten (Datei und Zeile). EISERNE REGEL: In dein Fazit gehört ' +
    'ausschließlich, was wörtlich in den Werkzeug-Ergebnissen stand. Wurde ein ' +
    'Zugriff abgelehnt oder nichts gefunden, schreibe genau das ins Fazit — erfinde ' +
    'niemals Dateiinhalte, Namen oder Zeilennummern.',
  // Empfänger im Auftrag (BAUPLAN 43): Der Reparatur-Text liegt zentral in
  // texte.js — inline nannte er einen Blocknamen, während der Auftrag darunter
  // (reparaturAuftrag) schon entnamentlicht war, und die Inventur-Prüfung
  // konnte ihn hier gar nicht sehen.
  reparatur: texte.agentenLokaleHelfer.reparaturSystem,
  entwurf:
    'Du bist ein Schreib-Helfer in einem Projektordner. Du arbeitest allein: ' +
    'Rückfragen werden nie beantwortet — arbeite mit dem, was der Auftrag nennt, und ' +
    'schreibe Unklares in deinen Bericht statt zu fragen. Du bekommst einen ' +
    'Schreibauftrag mit einem Vorbild oder einer klaren Beschreibung — das kann eine ' +
    'einzelne Datei nach Muster sein oder ein ganzes Modul mit festgelegter ' +
    'Schnittstelle. Lies zuerst das Vorbild (datei_lesen) und die im Auftrag ' +
    'genannten Stellen — dann schreibe deinen Entwurf mit entwurf_schreiben in den Ordner ' +
    ENTWURF_ORDNER +
    '/ (z.B. ' +
    ENTWURF_ORDNER +
    '/entwurf-name.js), als vollständige Datei; mehrere zusammengehörige Dateien sind ' +
    'mehrere Aufrufe. Nur dort darfst du schreiben; ein ' +
    'stärkeres Modell liest deinen Entwurf gegen und übernimmt ihn an den Zielort. ' +
    'Halte dich an Vorbild, Beschreibung und die genannten Schnittstellen — keine ' +
    'Extras, keine Verschönerungen. ' +
    'Wenn du fertig bist, antworte OHNE weiteren Werkzeugaufruf mit einer kurzen ' +
    'Liste auf Deutsch: welche Entwurfsdateien du geschrieben hast und was sie ' +
    'enthalten. Konntest du etwas nicht, schreibe genau das — erfinde nichts.',
  bau:
    'Du bist ein Bau-Helfer in einem Projektordner. Du arbeitest allein: Rückfragen ' +
    'werden nie beantwortet — arbeite mit dem, was der Auftrag nennt, und schreibe ' +
    'Unklares in deinen Bericht statt zu fragen. Du bekommst einen zusammenhängenden ' +
    'Teilauftrag mit Fundstellen oder Vorbild, festen Schnittstellen und einem ' +
    'Fertig-Kriterium — das kann eine gezielte Änderung sein oder ein ganzes Modul, eine ' +
    'ganze Funktion, mehrere zusammengehörige Dateien. Lies zuerst die im Auftrag ' +
    'genannten Stellen (datei_lesen), ' +
    'dann setze GENAU den Teilauftrag um: Bestehende Dateien änderst du mit ersetzen ' +
    '(der alt-Text muss ZEICHENGENAU so in der Datei stehen, samt Einrückung, und ' +
    'eindeutig sein — nimm zur Not umgebende Zeilen dazu); neue Dateien oder komplette ' +
    'Neuschriebe schreibst du mit datei_schreiben als vollständige Datei. Halte dich ' +
    'exakt an die im Auftrag genannten Datei- und Funktionsnamen und Schnittstellen — ' +
    'keine Extras, keine Verschönerungen, nichts außerhalb des Teilauftrags. Ein ' +
    'stärkeres Modell liest deine Arbeit sofort gegen. Wenn du fertig bist, antworte ' +
    'OHNE weiteren Werkzeugaufruf mit einer kurzen Liste auf Deutsch: was du wo ' +
    'geändert oder angelegt hast. Konntest du etwas nicht, schreibe genau das — ' +
    'erfinde nichts.'
}

// Der Recherche-Kreislauf: Auftrag rein, kompaktes Fazit raus.
// aufSchritt (optional) meldet jede Werkzeug-Nutzung für den Liveticker.
// aufDenken (optional, BAUPLAN 24) meldet das Denken der lokalen KI für den
// Denk-Bereich: das thinking-Feld der Ollama-Antwort (Denk-Modelle wie
// gpt-oss) — oder, bei Modellen ohne Denkfeld, ihren Antworttext vor den
// Werkzeugaufrufen (das „laute Denken" kleiner Modelle).
export function lokalRecherchieren({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt, aufDenken }) {
  const nachrichten = [auftaktNachricht(KREISLAUF_SYSTEMTEXTE.recherche, auftrag)]
  return kreislauf({ projektPfad, nachrichten, werkzeuge: lesendeWerkzeuge(), modell, adresse, aufSchritt, aufDenken })
}

// Der Reparatur-Kreislauf (BAUPLAN 20): Beanstandungen des Prüfers rein,
// gezielte Ersetzungen im Projekt, kurzer Bericht raus. Zusätzlich zu den
// Lese-Werkzeugen gibt es genau das Ersetzen-Werkzeug — an kurzer Leine.
// ergebnis.ersetzungen zählt die echten Änderungen: 0 heißt „nichts passiert"
// — dann spart sich FlowForge die Nachprüfung.
// `dateiListe` (BAUPLAN 46): die Tabu-Liste — beim Vorreparieren die Dateiliste
// des RÜCKFÜHRUNGS-ZIELS (des Bauers, dessen Arbeit repariert wird), nicht die
// des Prüfers; null = keine Sperre.
export async function lokalReparieren({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt, aufDenken, dateiListe = null }) {
  const nachrichten = [auftaktNachricht(KREISLAUF_SYSTEMTEXTE.reparatur, auftrag)]
  const zaehler = { ersetzungen: 0 }
  const ergebnis = await kreislauf({
    projektPfad,
    nachrichten,
    werkzeuge: [...lesendeWerkzeuge(), ERSETZEN_WERKZEUG],
    modell,
    adresse,
    aufSchritt,
    aufDenken,
    zaehler,
    dateiListe
  })
  return { ...ergebnis, ersetzungen: zaehler.ersetzungen }
}

// Der Entwurfs-Kreislauf (BAUPLAN 21): Schreibauftrag mit Vorbild oder klarer
// Beschreibung rein, Entwurfsdateien in der Arbeitsablage raus. Zusätzlich zu
// den Lese-Werkzeugen gibt es genau das Entwurf-Schreibwerkzeug (nur
// arbeitsablage/). ergebnis.dateien nennt die geschriebenen Entwürfe —
// leer heißt „kein Entwurf entstanden".
export async function lokalEntwerfen({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt, aufDenken }) {
  const nachrichten = [auftaktNachricht(KREISLAUF_SYSTEMTEXTE.entwurf, auftrag)]
  const zaehler = { dateien: [] }
  const ergebnis = await kreislauf({
    projektPfad,
    nachrichten,
    werkzeuge: [...lesendeWerkzeuge(), ENTWURF_WERKZEUG],
    modell,
    adresse,
    aufSchritt,
    aufDenken,
    zaehler
  })
  return { ...ergebnis, dateien: zaehler.dateien }
}

// Der Bau-Kreislauf (BAUPLAN 22): ein zusammenhängender, einzeln prüfbarer
// Teilauftrag rein (auch ein ganzes Modul oder mehrere zusammengehörige
// Dateien), echte Änderungen im Projektordner raus. Zusätzlich zu den
// Lese-Werkzeugen gibt es gezieltes Ersetzen UND ganze Dateien schreiben —
// unter den unveränderten Tabu-Zonen. ergebnis.ersetzungen und
// ergebnis.dateien zählen die echten Änderungen: beides leer heißt „nichts
// gebaut" — dann gibt es auch nichts abzunehmen oder zurückzurollen.
// `dateiListe` (BAUPLAN 46): die Dateiliste des Blocks als Tabu-Liste; null =
// keine Sperre. Gilt IMMER, wenn eine Liste vorliegt — nicht nur in der Welle.
export async function lokalBauen({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt, aufDenken, dateiListe = null }) {
  const nachrichten = [auftaktNachricht(KREISLAUF_SYSTEMTEXTE.bau, auftrag)]
  const zaehler = { ersetzungen: 0, geschrieben: [] }
  const ergebnis = await kreislauf({
    projektPfad,
    nachrichten,
    werkzeuge: [...lesendeWerkzeuge(), ERSETZEN_WERKZEUG, DATEI_SCHREIBEN_WERKZEUG],
    modell,
    adresse,
    aufSchritt,
    aufDenken,
    zaehler,
    dateiListe
  })
  return { ...ergebnis, ersetzungen: zaehler.ersetzungen, dateien: zaehler.geschrieben }
}

// Getarnte Werkzeugaufrufe auspacken (Befund 14.08.2026): Manche Modelle —
// allen voran qwen2.5-coder — schreiben Werkzeugaufrufe als JSON-Text in die
// Antwort (oft in ```json-Zäunen) statt im Werkzeug-Format der Ollama-Vorlage.
// Ollama reicht das als normalen Text durch, und der Aufruf würde nie
// ausgeführt. FlowForge erkennt solche Aufrufe selbst: Akzeptiert wird nur,
// was sauber als JSON parst UND dessen name exakt ein angebotenes Werkzeug
// ist — Fazite, die zufällig JSON zitieren, bleiben Fazite.

// Findet das Ende des JSON-Objekts, das bei start beginnt (Klammer-Tiefe,
// String- und Escape-fest) — oder -1, wenn es nie schließt.
function jsonEnde(text, start) {
  let tiefe = 0
  let inText = false
  let maskiert = false
  for (let i = start; i < text.length; i++) {
    const zeichen = text[i]
    if (inText) {
      if (maskiert) maskiert = false
      else if (zeichen === '\\') maskiert = true
      else if (zeichen === '"') inText = false
      continue
    }
    if (zeichen === '"') inText = true
    else if (zeichen === '{') tiefe++
    else if (zeichen === '}') {
      tiefe--
      if (tiefe === 0) return i
    }
  }
  return -1
}

function getarnteAufrufe(text, werkzeuge) {
  const namen = new Set(werkzeuge.map((w) => w.function?.name))
  const funde = []
  let i = 0
  while ((i = text.indexOf('{', i)) !== -1) {
    const ende = jsonEnde(text, i)
    if (ende === -1) {
      i++
      continue
    }
    let roh = null
    try {
      roh = JSON.parse(text.slice(i, ende + 1))
    } catch {
      // kein gültiges JSON — weiter ab dem nächsten Zeichen
    }
    if (roh && typeof roh.name === 'string' && namen.has(roh.name)) {
      let eingabe = roh.arguments
      if (typeof eingabe === 'string') {
        try {
          eingabe = JSON.parse(eingabe)
        } catch {
          eingabe = {}
        }
      }
      funde.push({ name: roh.name, eingabe: eingabe && typeof eingabe === 'object' ? eingabe : {} })
      i = ende + 1
    } else i++
  }
  return funde
}

// Gemeinsamer Kern der Kreisläufe: Ollama-Runden mit Werkzeugaufrufen,
// bis ein Fazit kommt oder die Runden ausgehen.
async function kreislauf({ projektPfad, nachrichten, werkzeuge, modell, adresse, aufSchritt, aufDenken, zaehler = null, dateiListe = null }) {
  let schritte = 0
  // Denk-Modelle (z.B. gpt-oss) schreiben manchmal alles ins Denkfeld und
  // lassen die eigentliche Antwort leer (real beobachtet am 13.08.2026:
  // „kein Fazit geliefert" gleich beim ersten Einsatz). Einmal nachhaken
  // statt aufgeben — erst danach ist es ehrlich ein Fehlschlag.
  let nachgehakt = false
  for (let runde = 0; runde < grenzen.runden; runde++) {
    let antwort
    try {
      const httpAntwort = await fetch((adresse || STANDARD_ADRESSE) + '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(ANTWORT_ZEITLIMIT_MS),
        body: JSON.stringify({
          model: modell,
          messages: nachrichten,
          tools: werkzeuge,
          stream: false,
          options: { temperature: 0.2, num_ctx: grenzen.kontext }
        })
      })
      if (!httpAntwort.ok)
        return { ok: false, fehler: `Ollama antwortet mit Status ${httpAntwort.status}.`, schritte }
      antwort = await httpAntwort.json()
    } catch (fehler) {
      return {
        ok: false,
        fehler: 'Die lokale KI ist nicht erreichbar oder hat zu lange gebraucht: ' + String(fehler?.message ?? fehler),
        schritte
      }
    }

    // Die Modell-Nachricht wandert unverändert in den Verlauf — nur die Rolle
    // wird ergänzt, falls sie fehlt (Prüfer-Befund 18.08.2026: eine Antwort
    // ohne message oder ohne role landete als rollenloses Objekt im Verlauf,
    // und die nächste Anfrage trug „user, null, user" — genau die Rollen-
    // Unordnung, die die Nutzer-only-Form vermeiden soll). Trägt das Modell
    // eine Rolle, bleibt sie stehen.
    const roh = antwort?.message && typeof antwort.message === 'object' ? antwort.message : {}
    const nachricht = typeof roh.role === 'string' && roh.role ? roh : { ...roh, role: 'assistant' }
    const aufrufe = Array.isArray(nachricht.tool_calls) ? nachricht.tool_calls : []
    // Denk-Ansicht (BAUPLAN 24): das thinking-Feld der Denk-Modelle — oder,
    // wenn es fehlt, der Antworttext VOR Werkzeugaufrufen (das „laute Denken"
    // kleiner Modelle; ohne Aufrufe ist der Text das Fazit, kein Denken).
    const denkText = String(nachricht.thinking ?? '').trim()
    if (denkText) aufDenken?.(denkText)
    else if (aufrufe.length) {
      const lautesDenken = String(nachricht.content ?? '').trim()
      if (lautesDenken) aufDenken?.(lautesDenken)
    }
    if (!aufrufe.length) {
      const fazit = String(nachricht.content ?? '').trim()
      // Getarnte Aufrufe (s.o.): als Text gelieferte Werkzeugaufrufe auspacken
      // und normal ausführen — ehrlich im Ticker vermerkt. Das Modell spricht
      // den falschen Dialekt, aber die Arbeit läuft trotzdem.
      const getarnt = fazit ? getarnteAufrufe(fazit, werkzeuge) : []
      if (getarnt.length) {
        nachrichten.push(nachricht)
        aufSchritt?.('aufruf_uebersetzt', {})
        const ergebnisse = []
        for (const { name, eingabe } of getarnt) {
          schritte++
          aufSchritt?.(name, eingabe)
          const ergebnis = werkzeugAusfuehren(projektPfad, name, eingabe, zaehler, dateiListe)
          ergebnisse.push([name, ergebnis])
        }
        nachrichten.push(werkzeugErgebnisNachricht(ergebnisse))
        continue
      }
      if (fazit) return { ok: true, fazit, schritte }
      if (!nachgehakt) {
        nachgehakt = true
        nachrichten.push(nachricht)
        nachrichten.push(nutzerNachricht(texte.agentenLokaleHelfer.nachhaken))
        continue
      }
      return { ok: false, fehler: 'Die lokale KI hat kein Fazit geliefert.', schritte }
    }

    nachrichten.push(nachricht)
    const ergebnisse = []
    for (const aufruf of aufrufe) {
      // Dieselbe Absicherung wie im getarnten Pfad (Prüfer-Befund 18.08.2026):
      // Ein Aufruf kann null sein, arguments kann als String "null" kommen —
      // beides darf den Kreislauf nicht mit einem Wurf verlassen. Unbekanntes
      // wird als unbekanntes Werkzeug beantwortet, kaputte Eingabe wird {}.
      const name = aufruf?.function?.name ?? '?'
      let eingabe = aufruf?.function?.arguments ?? {}
      if (typeof eingabe === 'string') {
        try {
          eingabe = JSON.parse(eingabe)
        } catch {
          eingabe = {}
        }
      }
      if (!eingabe || typeof eingabe !== 'object') eingabe = {}
      schritte++
      aufSchritt?.(name, eingabe)
      const ergebnis = werkzeugAusfuehren(projektPfad, name, eingabe, zaehler, dateiListe)
      ergebnisse.push([name, ergebnis])
    }
    nachrichten.push(werkzeugErgebnisNachricht(ergebnisse))
  }
  return {
    ok: false,
    fehler: `Die lokale KI kam nach ${grenzen.runden} Runden zu keinem Fazit.`,
    schritte
  }
}
