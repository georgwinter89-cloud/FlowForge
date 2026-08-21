// Feineinstellungen der lokalen KI als Block-Agent (BAUPLAN 49). Reine
// Rechenregeln ohne Electron und ohne Betriebssystem-Bausteine — der Renderer
// (Einstellungen-Dialog) und der Hauptprozess (einstellungen.js, lokalesModell.js)
// nutzen dieselben Regeln; die Prüfskripte fahren sie direkt.
//
// Hintergrund, gemessen 19.08.2026 (BAUPLAN 49): Die Claude-CLI schickt über
// den Anthropic-Modus von Ollama keine Temperatur und keine Sampling-Optionen
// mit. Der wirksame Hebel sind deshalb die Standardwerte AM MODELL: FlowForge
// legt aus Georgs Einstellungen ein abgeleitetes Ollama-Modell an
// (`flowforge-<basis>`, POST /api/create mit parameters) und startet den
// lokalen Block-Agenten darauf. null bedeutet überall „Ollama-Standard" — der
// Parameter wird dann gar nicht gesetzt, Ollama nimmt seinen eigenen Wert.
// Ein Denken-Schalter fehlt absichtlich: Über diesen Weg ist das Denken bei
// Qwen3.8 nicht abschaltbar (gemessen), die Einstellungen sagen es ehrlich.

// Eine Adresse säubern: trim, End-Slashes weg, muss mit http(s):// beginnen —
// sonst null (die Liste verwirft Ungültiges, statt still zu ersetzen).
// Wohnort seit 0.51.2 hier statt im Hauptprozess: Der Einstellungen-Dialog
// putzte Adressen bisher selbst (roh.trim()) und kam damit auf einen anderen
// Wert als die gespeicherte Normalform — gemessen 20.08.2026 fragte der
// Live-Status „http://gaming-pc:8080/" ab, während „http://gaming-pc:8080"
// gespeichert wurde, und der doppelte Schrägstrich landete wörtlich beim
// fremden Rechner. Renderer und Hauptprozess rechnen jetzt mit derselben
// Regel.
// Groß-/Kleinschreibung des Schemas zählt nicht mehr (Nacharbeit Befund 3,
// 21.08.2026): „HTTP://gaming-pc:11434" fiel bis dahin still durch, weil die
// Regel case-sensitive war. Das Schema wird dabei kleingeschrieben — sonst
// stünden „HTTP://a" und „http://a" als zwei verschiedene Adressen in der
// Ollama-Liste, obwohl es derselbe Rechner ist.
export function adresseBereinigen(roh) {
  const wert = String(roh ?? '')
    .trim()
    .replace(/\/+$/, '')
  const treffer = /^(https?):\/\/(.+)$/i.exec(wert)
  return treffer ? treffer[1].toLowerCase() + '://' + treffer[2] : null
}

// Sieht dieser Rechnername nach „bei mir im Netz" aus? Dann gilt http.
// Maßgeblich sind Port (jedes selbstgehostete SearXNG hat einen), fehlender
// Punkt (kurzer Rechnername wie „gaming-pc") und literale IP-Adressen.
function eigenesNetzMuster(wert) {
  const ohnePfad = String(wert).split(/[/?#]/)[0]
  const rechner = ohnePfad.split('@').pop()
  if (/:\d+$/.test(rechner)) return true
  if (rechner.startsWith('[')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(rechner)) return true
  return !rechner.includes('.')
}

// SearXNG-Adresse säubern (Nacharbeit Befund 3, gemessen 20.08.2026): Georg
// tippte „gaming-pc:8080" — genau so, wie er die Adresse im Browser aufruft.
// Das Feld nahm den Wert nicht an, sagte aber nichts: keine Statuszeile, kein
// Fehler, der Dialog schloss normal, und jede Suche lief weiter still über die
// eingebaute Quelle.
//
// Bewusst eine EIGENE Regel und nicht adresseBereinigen: Die Ollama-Liste
// verwirft ein „quatsch" weiter (dort ist ein Tippfehler ein Tippfehler und
// eine still ergänzte Fantasieadresse würde nur einen Lauf später scheitern) —
// hier gibt es genau ein Feld, einen Live-Status daneben und eine Hinweiszeile
// im Dialog, die die ergänzte Fassung zeigt.
//
// Vorbild ist das Haus selbst: websuche.js (adresseErlaubt) ergänzt ein
// fehlendes Schema, statt zu scheitern. Ein Schema, das FlowForge NICHT will
// (file:, ftp:, data:), wird auch hier nicht ergänzt — es bleibt ungültig, und
// der Dialog sagt das in Klartext.
//
// http oder https? Rechner im eigenen Netz sprechen http (der Platzhalter des
// Feldes lautet http://192.168.x.x:8080, und ein SearXNG im Docker-Container
// hat kein Zertifikat); ein Name mit Punkt und ohne Port ist eine öffentliche
// Instanz und bekommt https.
export function searxngAdresseBereinigen(roh) {
  const wert = String(roh ?? '')
    .trim()
    .replace(/\/+$/, '')
  if (!wert) return null
  const hatHttp = /^https?:\/\//i.test(wert)
  // Irgendein anderes Schema: nicht ergänzen, nicht retten.
  if (!hatHttp && /^[a-z][a-z0-9+.-]*:\/\//i.test(wert)) return null
  const mitSchema = hatHttp ? wert : (eigenesNetzMuster(wert) ? 'http://' : 'https://') + wert
  let url
  try {
    url = new URL(mitSchema)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null
  return url.toString().replace(/\/+$/, '')
}

export const LOKAL_FEIN_FELDER = [
  'temperatur',
  'topP',
  'topK',
  'minP',
  'wiederholungsstrafe',
  'antwortlaenge',
  'entwurfsTokens'
]

// Vorlagen (Herstellerempfehlungen der Qwen3.8-Modellkarte, Stand August 2026;
// „Coding" nach Unsloth eher Temperatur 0.6). Antwortlänge und Entwurfs-Tokens
// bleiben in allen Vorlagen beim Ollama-Standard.
export const LOKAL_FEIN_VORLAGEN = {
  'ollama-standard': {
    temperatur: null,
    topP: null,
    topK: null,
    minP: null,
    wiederholungsstrafe: null,
    antwortlaenge: null,
    entwurfsTokens: null
  },
  'qwen-denken': {
    temperatur: 1.0,
    topP: 0.95,
    topK: 20,
    minP: 0,
    wiederholungsstrafe: 1.0,
    antwortlaenge: null,
    entwurfsTokens: null
  },
  'qwen-coding': {
    temperatur: 0.6,
    topP: 0.95,
    topK: 20,
    minP: 0,
    wiederholungsstrafe: 1.0,
    antwortlaenge: null,
    entwurfsTokens: null
  }
}

// Grenzen je Feld (Ollama-Doku zu den Modelfile-Parametern). Außerhalb der
// Grenzen, leer oder Unsinn → null (= Ollama-Standard), nie still geklemmt —
// ein geklemmter Wert sähe im Dialog aus wie eine bewusste Wahl.
const GRENZEN = {
  temperatur: { min: 0, max: 2, ganzzahl: false },
  topP: { min: 0, max: 1, ganzzahl: false },
  topK: { min: 0, max: 500, ganzzahl: true },
  minP: { min: 0, max: 1, ganzzahl: false },
  wiederholungsstrafe: { min: 0.5, max: 2, ganzzahl: false },
  antwortlaenge: { min: 1, max: Infinity, ganzzahl: true },
  entwurfsTokens: { min: 0, max: 64, ganzzahl: true }
}

function feldBereinigen(feld, roh) {
  if (roh === null || roh === undefined) return null
  if (typeof roh === 'string' && roh.trim() === '') return null
  if (typeof roh === 'boolean') return null
  const zahl = typeof roh === 'number' ? roh : Number(String(roh).trim().replace(',', '.'))
  if (!Number.isFinite(zahl)) return null
  const g = GRENZEN[feld]
  if (g.ganzzahl && !Number.isInteger(zahl)) return null
  if (zahl < g.min || zahl > g.max) return null
  return zahl
}

// Liefert immer ein Objekt mit genau LOKAL_FEIN_FELDER; unbekannte Felder
// fallen weg, fehlende werden null.
export function lokalFeinBereinigen(roh) {
  const quelle = roh && typeof roh === 'object' ? roh : {}
  const fein = {}
  for (const feld of LOKAL_FEIN_FELDER) fein[feld] = feldBereinigen(feld, quelle[feld])
  return fein
}

// Name des abgeleiteten Ollama-Modells: 'flowforge-' + Basis, kleingeschrieben,
// alles außer [a-z0-9._-] wird '-', Mehrfach-'-' zusammengezogen. Der Name
// ist an Ollamas Modellnamen-Regeln angelehnt (Doppelpunkt des Tags wird '-').
// Beispiel: 'qwen3.8:27b-mtp-q4_K_M' → 'flowforge-qwen3.8-27b-mtp-q4_k_m'.
export function lokalesModellName(basis) {
  const sauber = String(basis ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
  return 'flowforge-' + sauber
}

// Parameter für POST /api/create — nur gesetzte Felder; num_ctx immer (das
// Kontextfenster aus den Einstellungen ist der Grund, warum es das
// abgeleitete Modell überhaupt gibt: ohne num_ctx lädt Ollama das Modell mit
// seinem Maximalkontext und spillt aus dem VRAM, gemessen 19.08.2026).
export function ollamaParameterAus(fein, kontext) {
  const f = lokalFeinBereinigen(fein)
  const p = { num_ctx: kontext }
  if (f.temperatur !== null) p.temperature = f.temperatur
  if (f.topP !== null) p.top_p = f.topP
  if (f.topK !== null) p.top_k = f.topK
  if (f.minP !== null) p.min_p = f.minP
  if (f.wiederholungsstrafe !== null) p.repeat_penalty = f.wiederholungsstrafe
  if (f.antwortlaenge !== null) p.num_predict = f.antwortlaenge
  if (f.entwurfsTokens !== null) p.draft_num_predict = f.entwurfsTokens
  return p
}

// Welche Vorlage entspricht diesen Werten genau? Für den Editor: welcher
// Vorlagen-Knopf ist „aktiv". null = eigene Mischung.
export function lokalFeinVorlageErkennen(fein) {
  const f = lokalFeinBereinigen(fein)
  for (const [name, vorlage] of Object.entries(LOKAL_FEIN_VORLAGEN)) {
    if (LOKAL_FEIN_FELDER.every((feld) => vorlage[feld] === f[feld])) return name
  }
  return null
}
