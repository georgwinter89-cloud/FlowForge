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
// Lokale Entwürfe (BAUPLAN 21): Ein Entwurfs-Kreislauf für schablonenhafte
// Schreibarbeit mit Vorbild. Sein Schreibwerkzeug ist hart auf den Ordner
// arbeitsablage/ begrenzt — die Wegwerf-Fläche, die am Laufende geleert wird.
// Der Block-Agent (Motor) liest jeden Entwurf gegen und übernimmt ihn selbst
// an den Zielort — ungeprüft zählt nichts.
//
// Bewusst ohne Electron-Abhängigkeiten: das Modul ist einzeln (mit node)
// erprobbar, wie es die Bauplan-Regel für neue Bausteine verlangt.
import fs from 'node:fs'
import path from 'node:path'

// Standard-Adresse: Ollama auf diesem Rechner. Über die Einstellungen ist auch
// ein anderer Rechner im Heimnetz möglich (z.B. ein Gaming-PC mit richtiger
// Grafikkarte — dort laufen größere Modelle schneller und genauer).
const STANDARD_ADRESSE = 'http://127.0.0.1:11434'

// Deckel gegen Kontext-Überlauf des kleinen Modells. num_ctx wird je Anfrage
// mitgeschickt und überstimmt die Ollama-Einstellung — bewusst 32k, nicht
// mehr: Das Arbeitsgedächtnis (KV-Cache) kostet bei 14B grob 190 KB je
// Kontext-Token; 128k wären ~25 GB nur dafür und passen in keine 16-GB-Karte
// — Ollama lagert dann still auf die CPU aus und alles kriecht. Außerdem
// verlieren kleine Modelle in Riesen-Kontexten den Faden; die kompakten
// Werkzeug-Antworten sind auch Konzentrationshilfe (Wunsch Georg, 13.08.2026:
// großzügiger als die alten 16k, aber ehrlich begrenzt).
const MAX_RUNDEN = 32
const MAX_ZEILEN_JE_LESEN = 400
const MAX_ZEICHEN_JE_ANTWORT = 24000
const MAX_TREFFER_JE_SUCHE = 60
const MAX_EINTRAEGE_JE_ORDNER = 300
const ANTWORT_ZEITLIMIT_MS = 5 * 60 * 1000
const KONTEXT_FENSTER = 32768

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
    const namen = (daten.models ?? []).map((m) => m.name)
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
  return t.length > MAX_ZEICHEN_JE_ANTWORT
    ? t.slice(0, MAX_ZEICHEN_JE_ANTWORT) + '\n… (gekürzt — lies gezielter weiter, z.B. mit vonZeile)'
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
    if (zeilen.length >= MAX_EINTRAEGE_JE_ORDNER) {
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
  const bis = Math.min(zeilen.length, von + MAX_ZEILEN_JE_LESEN - 1)
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
  while (stapel.length && treffer.length < MAX_TREFFER_JE_SUCHE) {
    const ordner = stapel.pop()
    let eintraege
    try {
      eintraege = fs.readdirSync(ordner, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of eintraege) {
      if (treffer.length >= MAX_TREFFER_JE_SUCHE) break
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
      for (let i = 0; i < zeilen.length && treffer.length < MAX_TREFFER_JE_SUCHE; i++) {
        const passt = regex ? regex.test(zeilen[i]) : zeilen[i].includes(muster)
        if (passt) treffer.push(`${relativ}:${i + 1}: ${zeilen[i].trim().slice(0, 200)}`)
      }
    }
  }
  if (!treffer.length) return `Keine Treffer für: ${muster}`
  const hinweis =
    treffer.length >= MAX_TREFFER_JE_SUCHE ? '\n… (weitere Treffer weggelassen — suche enger)' : ''
  return gestutzt(treffer.join('\n') + hinweis)
}

const WERKZEUGE = [
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
        MAX_ZEILEN_JE_LESEN +
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

// --- Lokale Vorreparatur (BAUPLAN 20) --------------------------------------

// Versuchs-Budget je Rückführung: so oft darf die lokale KI reparieren,
// bevor der Motor-Bauer übernimmt. Lokale Versuche verbrauchen KEINE
// regulären Reparatur-Runden des Workflows.
export const LOKALE_REPARATUR_VERSUCHE = 2

// Opus sortiert vor (BAUPLAN 20): Der Prüfer markiert jede Beanstandung als
// „BEANSTANDUNG (mechanisch): …" oder „BEANSTANDUNG (grundsätzlich): …".
// Nur wenn ALLE Beanstandungen mechanisch sind, lohnt die lokale Wette —
// sonst muss der Motor-Bauer ohnehin ran, und jeder lokale Versuch kostete
// nur eine zusätzliche Nachprüfung. Ohne Marken wird sicher eskaliert.
export function beanstandungenEinstufen(pruefbeleg) {
  const marken = [
    ...String(pruefbeleg ?? '').matchAll(/BEANSTANDUNG\s*\((mechanisch|grunds(?:ä|ae)tzlich)\)/gi)
  ]
  if (marken.length === 0) return 'unmarkiert'
  return marken.every((m) => m[1].toLowerCase() === 'mechanisch') ? 'mechanisch' : 'grundsaetzlich'
}

// Tabu-Zonen des Ersetzen-Werkzeugs — dieselben harten Sperren wie beim
// Bauer, durchgesetzt im FlowForge-Code (nicht per Bitte an das Modell).
const REPARATUR_TABU_DATEIEN = new Set([
  'projekt.json',
  'karten.json',
  'workflow.json',
  'startanleitung.json',
  'laufstand.json'
])
const REPARATUR_TABU_ORDNER = new Set(['pruefung', 'laufberichte', 'node_modules', '.git'])

// Das einzige Schreib-Werkzeug der lokalen KI: gezieltes Ersetzen. Der alte
// Text muss genau und eindeutig in der Datei stehen — kein freies Schreiben,
// kein Anlegen, kein Löschen. zaehler.ersetzungen zählt die echten Änderungen.
function ersetzen(projektPfad, eingabe, zaehler) {
  const ziel = imProjekt(projektPfad, eingabe.pfad)
  if (!ziel) return 'Abgelehnt: Pfade außerhalb des Projektordners sind gesperrt.'
  const relativ = path.relative(path.resolve(projektPfad), ziel).toLowerCase()
  const oberster = relativ.split(path.sep)[0]
  if (REPARATUR_TABU_ORDNER.has(oberster))
    return `Abgelehnt: Der Ordner „${oberster}" ist für die lokale Reparatur gesperrt.`
  if (REPARATUR_TABU_DATEIEN.has(relativ))
    return 'Abgelehnt: FlowForge-Verwaltungsdateien sind gesperrt.'
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

function werkzeugAusfuehren(projektPfad, name, eingabe, zaehler) {
  if (name === 'ordner_auflisten') return ordnerAuflisten(projektPfad, eingabe)
  if (name === 'datei_lesen') return dateiLesen(projektPfad, eingabe)
  if (name === 'suchen') return suchen(projektPfad, eingabe)
  // Schreib-Werkzeuge nur im jeweils passenden Kreislauf — auch wenn das
  // Modell einen nicht angebotenen Werkzeugnamen halluziniert.
  if (name === 'ersetzen' && typeof zaehler?.ersetzungen === 'number')
    return ersetzen(projektPfad, eingabe, zaehler)
  if (name === 'entwurf_schreiben' && Array.isArray(zaehler?.dateien))
    return entwurfSchreiben(projektPfad, eingabe, zaehler)
  return `Unbekanntes Werkzeug: ${name}`
}

// Der Recherche-Kreislauf: Auftrag rein, kompaktes Fazit raus.
// aufSchritt (optional) meldet jede Werkzeug-Nutzung für den Liveticker.
export function lokalRecherchieren({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt }) {
  const nachrichten = [
    {
      role: 'system',
      content:
        'Du bist ein Recherche-Helfer, der in einem Projektordner liest und sucht — mehr ' +
        'nicht. Nutze die Werkzeuge gezielt und sparsam: erst Überblick (ordner_auflisten, ' +
        'suchen), dann nur die wirklich nötigen Stellen lesen. Wenn du genug weißt, ' +
        'antworte OHNE weiteren Werkzeugaufruf mit deinem Fazit: kompakt, auf Deutsch, ' +
        'mit Fundorten (Datei und Zeile). EISERNE REGEL: In dein Fazit gehört ' +
        'ausschließlich, was wörtlich in den Werkzeug-Ergebnissen stand. Wurde ein ' +
        'Zugriff abgelehnt oder nichts gefunden, schreibe genau das ins Fazit — erfinde ' +
        'niemals Dateiinhalte, Namen oder Zeilennummern.'
    },
    { role: 'user', content: String(auftrag ?? '') }
  ]
  return kreislauf({ projektPfad, nachrichten, werkzeuge: WERKZEUGE, modell, adresse, aufSchritt })
}

// Der Reparatur-Kreislauf (BAUPLAN 20): Beanstandungen des Prüfers rein,
// gezielte Ersetzungen im Projekt, kurzer Bericht raus. Zusätzlich zu den
// Lese-Werkzeugen gibt es genau das Ersetzen-Werkzeug — an kurzer Leine.
// ergebnis.ersetzungen zählt die echten Änderungen: 0 heißt „nichts passiert"
// — dann spart sich FlowForge die Nachprüfung.
export async function lokalReparieren({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt }) {
  const nachrichten = [
    {
      role: 'system',
      content:
        'Du bist ein Reparatur-Helfer in einem Projektordner. Du bekommst Beanstandungen ' +
        'eines Prüfers und behebst GENAU diese — nicht mehr, keine Verschönerungen, keine ' +
        'neuen Dateien. Finde die betroffenen Stellen mit suchen und datei_lesen, und ' +
        'behebe sie mit dem Werkzeug ersetzen: Der alt-Text muss ZEICHENGENAU so in der ' +
        'Datei stehen (samt Einrückung) und eindeutig sein — nimm zur Not umgebende ' +
        'Zeilen dazu. Lies eine Stelle immer erst mit datei_lesen, bevor du sie ersetzt. ' +
        'Wenn du fertig bist, antworte OHNE weiteren Werkzeugaufruf mit einer kurzen ' +
        'Liste auf Deutsch: was du wo ersetzt hast. Kannst du eine Stelle nicht finden ' +
        'oder nicht beheben, schreibe genau das — erfinde nichts.'
    },
    { role: 'user', content: String(auftrag ?? '') }
  ]
  const zaehler = { ersetzungen: 0 }
  const ergebnis = await kreislauf({
    projektPfad,
    nachrichten,
    werkzeuge: [...WERKZEUGE, ERSETZEN_WERKZEUG],
    modell,
    adresse,
    aufSchritt,
    zaehler
  })
  return { ...ergebnis, ersetzungen: zaehler.ersetzungen }
}

// Der Entwurfs-Kreislauf (BAUPLAN 21): schablonenhafter Schreibauftrag mit
// Vorbild rein, Entwurfsdateien in der Arbeitsablage raus. Zusätzlich zu den
// Lese-Werkzeugen gibt es genau das Entwurf-Schreibwerkzeug (nur
// arbeitsablage/). ergebnis.dateien nennt die geschriebenen Entwürfe —
// leer heißt „kein Entwurf entstanden".
export async function lokalEntwerfen({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt }) {
  const nachrichten = [
    {
      role: 'system',
      content:
        'Du bist ein Schreib-Helfer in einem Projektordner. Du bekommst einen eng ' +
        'umrissenen, schablonenhaften Schreibauftrag mit einem Vorbild. Lies zuerst das ' +
        'Vorbild (datei_lesen) und die im Auftrag genannten Stellen — dann schreibe deinen ' +
        'Entwurf mit entwurf_schreiben in den Ordner ' +
        ENTWURF_ORDNER +
        '/ (z.B. ' +
        ENTWURF_ORDNER +
        '/entwurf-name.js), als vollständige Datei. Nur dort darfst du schreiben; ein ' +
        'stärkeres Modell liest deinen Entwurf gegen und übernimmt ihn an den Zielort. ' +
        'Halte dich eng an Vorbild und Auftrag — keine Extras, keine Verschönerungen. ' +
        'Wenn du fertig bist, antworte OHNE weiteren Werkzeugaufruf mit einer kurzen ' +
        'Liste auf Deutsch: welche Entwurfsdateien du geschrieben hast und was sie ' +
        'enthalten. Konntest du etwas nicht, schreibe genau das — erfinde nichts.'
    },
    { role: 'user', content: String(auftrag ?? '') }
  ]
  const zaehler = { dateien: [] }
  const ergebnis = await kreislauf({
    projektPfad,
    nachrichten,
    werkzeuge: [...WERKZEUGE, ENTWURF_WERKZEUG],
    modell,
    adresse,
    aufSchritt,
    zaehler
  })
  return { ...ergebnis, dateien: zaehler.dateien }
}

// Gemeinsamer Kern beider Kreisläufe: Ollama-Runden mit Werkzeugaufrufen,
// bis ein Fazit kommt oder die Runden ausgehen.
async function kreislauf({ projektPfad, nachrichten, werkzeuge, modell, adresse, aufSchritt, zaehler = null }) {
  let schritte = 0
  // Denk-Modelle (z.B. gpt-oss) schreiben manchmal alles ins Denkfeld und
  // lassen die eigentliche Antwort leer (real beobachtet am 13.08.2026:
  // „kein Fazit geliefert" gleich beim ersten Einsatz). Einmal nachhaken
  // statt aufgeben — erst danach ist es ehrlich ein Fehlschlag.
  let nachgehakt = false
  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
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
          options: { temperature: 0.2, num_ctx: KONTEXT_FENSTER }
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

    const nachricht = antwort.message ?? {}
    const aufrufe = Array.isArray(nachricht.tool_calls) ? nachricht.tool_calls : []
    if (!aufrufe.length) {
      const fazit = String(nachricht.content ?? '').trim()
      if (fazit) return { ok: true, fazit, schritte }
      if (!nachgehakt) {
        nachgehakt = true
        nachrichten.push(nachricht)
        nachrichten.push({
          role: 'user',
          content:
            'Deine Antwort war leer. Gib jetzt dein Fazit als normale Antwort aus — ' +
            'kompakt, auf Deutsch, mit Fundorten aus den Werkzeug-Ergebnissen. ' +
            'Kein Werkzeugaufruf mehr.'
        })
        continue
      }
      return { ok: false, fehler: 'Die lokale KI hat kein Fazit geliefert.', schritte }
    }

    nachrichten.push(nachricht)
    for (const aufruf of aufrufe) {
      const name = aufruf.function?.name ?? '?'
      let eingabe = aufruf.function?.arguments ?? {}
      if (typeof eingabe === 'string') {
        try {
          eingabe = JSON.parse(eingabe)
        } catch {
          eingabe = {}
        }
      }
      schritte++
      aufSchritt?.(name, eingabe)
      const ergebnis = werkzeugAusfuehren(projektPfad, name, eingabe, zaehler)
      nachrichten.push({ role: 'tool', tool_name: name, content: String(ergebnis) })
    }
  }
  return {
    ok: false,
    fehler: `Die lokale KI kam nach ${MAX_RUNDEN} Runden zu keinem Fazit.`,
    schritte
  }
}
