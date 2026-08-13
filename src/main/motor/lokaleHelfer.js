// Lokale Helfer-KI (Experiment, Wunsch Georg 13.08.2026): Ein eigener kleiner
// Recherche-Kreislauf gegen Ollama. Die Block-Agenten delegieren reines
// Einlesen und Suchen an das lokale Modell statt an eine Motor-Unteraufgabe —
// das kostet kein Abo-Kontingent, nur Rechenzeit auf Georgs Rechner.
//
// Sicherheits-Zuschnitt (erzwungen im Code, nicht per Bitte): Das lokale
// Modell bekommt genau drei Werkzeuge — Ordner auflisten, Datei lesen,
// suchen — und alle drei arbeiten ausschließlich lesend innerhalb des
// Projektordners. Es kann nichts schreiben, nichts ausführen und nichts
// außerhalb des Projekts sehen. Sein Fazit ist reiner Text.
//
// Bewusst ohne Electron-Abhängigkeiten: das Modul ist einzeln (mit node)
// erprobbar, wie es die Bauplan-Regel für neue Bausteine verlangt.
import fs from 'node:fs'
import path from 'node:path'

// Standard-Adresse: Ollama auf diesem Rechner. Über die Einstellungen ist auch
// ein anderer Rechner im Heimnetz möglich (z.B. ein Gaming-PC mit richtiger
// Grafikkarte — dort laufen größere Modelle schneller und genauer).
const STANDARD_ADRESSE = 'http://127.0.0.1:11434'

// Deckel gegen Kontext-Überlauf des kleinen Modells (32k-Fenster):
// jede Werkzeug-Antwort bleibt kompakt, die Runden sind begrenzt.
const MAX_RUNDEN = 24
const MAX_ZEILEN_JE_LESEN = 250
const MAX_ZEICHEN_JE_ANTWORT = 12000
const MAX_TREFFER_JE_SUCHE = 40
const MAX_EINTRAEGE_JE_ORDNER = 200
const ANTWORT_ZEITLIMIT_MS = 5 * 60 * 1000
const KONTEXT_FENSTER = 16384

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

function werkzeugAusfuehren(projektPfad, name, eingabe) {
  if (name === 'ordner_auflisten') return ordnerAuflisten(projektPfad, eingabe)
  if (name === 'datei_lesen') return dateiLesen(projektPfad, eingabe)
  if (name === 'suchen') return suchen(projektPfad, eingabe)
  return `Unbekanntes Werkzeug: ${name}`
}

// Der Recherche-Kreislauf: Auftrag rein, kompaktes Fazit raus.
// aufSchritt (optional) meldet jede Werkzeug-Nutzung für den Liveticker.
export async function lokalRecherchieren({ projektPfad, auftrag, modell, adresse = STANDARD_ADRESSE, aufSchritt }) {
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
          tools: WERKZEUGE,
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
      const ergebnis = werkzeugAusfuehren(projektPfad, name, eingabe)
      nachrichten.push({ role: 'tool', tool_name: name, content: String(ergebnis) })
    }
  }
  return {
    ok: false,
    fehler: `Die lokale KI kam nach ${MAX_RUNDEN} Runden zu keinem Fazit.`,
    schritte
  }
}
