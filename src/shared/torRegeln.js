// Tor ohne KI (BAUPLAN 35): Bevor in einer Reparatur-Runde ein Prüfer-Agent
// startet, spielt FlowForge den Prüfbefehl des Prüfers SELBST ab — 0 Tokens.
// Bleibt es rot, geht das Fehlerprotokoll sofort zurück an den Bauer; erst bei
// Grün kostet ein Prüfer-Agent wieder Kontingent.
// Hier stehen die reinen Rechenregeln (ohne Prozesse, ohne Electron), damit die
// Prüfskripte sie direkt fahren können; die Wirkung steckt in torProzess.js
// und lauf.js.

// Der Prüfbefehl kommt von einem Agenten, wird aber von FlowForge OHNE
// Rechte-Rückfrage ausgeführt (das ist der ganze Sinn: kein Agent, keine
// Tokens). Deshalb liegt er an einer deutlich kürzeren Leine als ein
// Agenten-Befehl: genau ein Werkzeug aus dieser Liste, keine Verkettung, keine
// Unterausführung, keine Umleitung. Ein Prüfbefehl ist ein Testlauf — mehr
// braucht er nicht zu können.
export const PRUEFBEFEHL_WERKZEUGE = new Set([
  'node', 'npm', 'npx', 'pnpm', 'yarn', 'vitest', 'jest', 'mocha', 'tsc',
  'python', 'python3', 'py', 'pytest',
  'deno', 'bun', 'go', 'cargo', 'dotnet', 'mvn', 'gradle', 'make',
  'rspec', 'phpunit'
])

// Zeichen, die aus einem Befehl mehrere machen (oder einen anderen einschleusen).
const VERKETTUNG = /[&|;\n\r<>`]|\$\(/

export const PRUEFBEFEHL_MAX = 300

// Harte Validierung des Prüfbefehls — dieselbe für Werkzeug und Datei-Ladung.
// Liefert { befehl } oder { fehlerArt } (den Text dazu kennt texte.js).
export function pruefbefehlPruefen(roh) {
  const befehl = String(roh ?? '').trim()
  if (!befehl) return { fehlerArt: 'leer' }
  if (befehl.length > PRUEFBEFEHL_MAX) return { fehlerArt: 'zuLang' }
  if (VERKETTUNG.test(befehl)) return { fehlerArt: 'verkettung' }
  const erstes = befehl
    .split(/\s+/)[0]
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
    .split(/[\\/]/)
    .pop()
    .replace(/\.(exe|cmd|bat)$/, '')
  if (!PRUEFBEFEHL_WERKZEUGE.has(erstes)) return { fehlerArt: 'werkzeug', werkzeug: erstes }
  return { befehl }
}

// Zeilen einer Befehlsausgabe, die nach Fehlschlag aussehen. Bewusst großzügig:
// Der Vergleich Baseline ↔ jetzt braucht keine perfekte Trefferquote, sondern
// dieselbe Regel auf beiden Seiten.
const FEHLER_MUSTER =
  /(\bfail(?:s|ed|ing|ure|ures)?\b|\berror(?:s)?\b|\bexception\b|\btraceback\b|\bassert\w*\b|\bnot ok\b|\bfehlgeschlagen\b|\bfehler\b|[✗×✘✖])/i

// Normalform einer Fehlerzeile: Was sich zwischen zwei Läufen ohnehin ändert
// (Zahlen, Zeiten, Pfadtrenner, Einrückung), darf nicht zu „neu kaputt" führen.
export function fehlerZeileNormal(zeile) {
  return String(zeile)
    .replace(/\\/g, '/')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Alle Fehlerzeilen einer Ausgabe, in Reihenfolge und ohne Dubletten.
export function fehlerZeilen(ausgabe) {
  const gesehen = new Set()
  const funde = []
  for (const zeile of String(ausgabe ?? '').split(/\r?\n/)) {
    const getrimmt = zeile.trim()
    if (!getrimmt || !FEHLER_MUSTER.test(getrimmt)) continue
    const normal = fehlerZeileNormal(getrimmt)
    if (gesehen.has(normal)) continue
    gesehen.add(normal)
    funde.push({ zeile: getrimmt, normal })
  }
  return funde
}

// Baseline „vorher schon rot" (BAUPLAN 35): Was jetzt rot ist und in der
// Baseline schon rot war, ist eine Altlast — dafür verbrennt FlowForge keine
// Reparatur-Runde. Gemeldet wird nur NEU Kaputtes.
// Liefert die neuen Fehlerzeilen im Original (lesbar für den Bauer).
export function neueFehler(baselineAusgabe, jetztAusgabe) {
  const alt = new Set(fehlerZeilen(baselineAusgabe).map((f) => f.normal))
  return fehlerZeilen(jetztAusgabe)
    .filter((f) => !alt.has(f.normal))
    .map((f) => f.zeile)
}

// Grün-Fall (BAUPLAN 35): Der Prüfbefehl lief durch — mechanische, von Tests
// gedeckte Beanstandungen gelten damit als erledigt. Der Prüfer-Agent bekommt
// nur noch die grundsätzlichen zum Nachprüfen. Liefert null, wenn keine
// grundsätzliche Zeile übrig bleibt (dann prüft er nur noch formal nach).
const GRUNDSAETZLICH = /^\s*(?:[-*•]\s*|\d+[.)]\s*)?BEANSTANDUNG\s*\(\s*grunds(?:ae|ä)tzlich/i

export function grundsaetzlicheKritik(kritik) {
  const zeilen = String(kritik ?? '')
    .split(/\r?\n/)
    .filter((zeile) => GRUNDSAETZLICH.test(zeile))
  return zeilen.length ? zeilen.join('\n') : null
}
