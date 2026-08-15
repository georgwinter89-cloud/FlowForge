// Prozess-Regeln (BAUPLAN 32): die reinen Rechenregeln hinter Prozess-Hygiene
// und App-Tab — ohne Kind-Prozesse, ohne Electron, damit die Prüfskripte sie
// direkt fahren können. Die Wirkung (Späher, taskkill, App-Start) steckt in
// prozesse.js und appProzess.js.

// Ein Schnappschuss der Prozessliste ist eine Map pid → { pid, eltern, name,
// befehl, start } (start = Startzeit als Zahl; gegen PID-Wiederverwendung).

// Bekannte Prozesse einer Gruppe transitiv erweitern: Jeder Prozess, dessen
// Elternteil zur bekannten Menge gehört, kommt dazu — auch wenn der Elternteil
// längst tot ist (Windows behält die Eltern-Kennung; die Bash-Shell des
// Agenten stirbt sofort nach „npm start &", der Server lebt weiter). Ein
// bekannter Eintrag, dessen PID inzwischen mit anderer Startzeit auftaucht,
// wurde wiederverwendet: er zählt nicht mehr als Elternteil und gilt als tot.
// Liefert die Liste der neu aufgenommenen Prozesse.
export function nachkommenErweitern(bekannt, schnappschuss) {
  const neu = []
  // Wiederverwendete PIDs entwerten, Lebendigkeit nachziehen.
  for (const eintrag of bekannt.values()) {
    const jetzt = schnappschuss.get(eintrag.pid)
    if (!jetzt) {
      eintrag.lebt = false
      continue
    }
    if (jetzt.start !== eintrag.start) {
      eintrag.lebt = false
      eintrag.wiederverwendet = true
      continue
    }
    eintrag.lebt = true
    // Name und Befehlszeile können beim ersten Sehen noch fehlen (Wurzel nur
    // als PID gemeldet) — nachtragen.
    if (!eintrag.name && jetzt.name) eintrag.name = jetzt.name
    if (!eintrag.befehl && jetzt.befehl) eintrag.befehl = jetzt.befehl
  }
  // Fixpunkt: so lange erweitern, bis nichts mehr dazukommt.
  let veraendert = true
  let runden = 0
  while (veraendert && runden++ < 50) {
    veraendert = false
    for (const p of schnappschuss.values()) {
      if (bekannt.has(p.pid) && bekannt.get(p.pid).start === p.start) continue
      const elternteil = bekannt.get(p.eltern)
      if (!elternteil || elternteil.wiederverwendet) continue
      // Ein Elternteil ist älter als sein Kind — sonst ist die PID des
      // Elternteils zwischenzeitlich neu vergeben worden.
      if (elternteil.start > p.start) continue
      const eintrag = {
        pid: p.pid,
        start: p.start,
        name: p.name,
        befehl: p.befehl,
        eltern: p.eltern,
        wurzel: false,
        lebt: true,
        wiederverwendet: false
      }
      bekannt.set(p.pid, eintrag)
      neu.push(eintrag)
      veraendert = true
    }
  }
  return neu
}

// Wurzel in die bekannte Menge aufnehmen (Motor-Prozess, App-Shell). Die
// Startzeit ist beim Melden noch unbekannt — der nächste Schnappschuss trägt
// sie nach (start = null heißt: noch nicht gesehen).
export function wurzelAufnehmen(bekannt, pid, schnappschuss = null) {
  if (!Number.isInteger(pid) || pid <= 0) return null
  const gesehen = schnappschuss?.get(pid) ?? null
  const eintrag = {
    pid,
    start: gesehen?.start ?? null,
    name: gesehen?.name ?? '',
    befehl: gesehen?.befehl ?? '',
    eltern: gesehen?.eltern ?? null,
    wurzel: true,
    lebt: true,
    wiederverwendet: false
  }
  bekannt.set(pid, eintrag)
  return eintrag
}

// Wurzeln ohne Startzeit bekommen sie beim ersten Schnappschuss, in dem sie
// auftauchen — vorher können sie nicht sauber auf Wiederverwendung geprüft
// werden. (Läuft VOR nachkommenErweitern.)
export function wurzelnNachtragen(bekannt, schnappschuss) {
  for (const eintrag of bekannt.values()) {
    if (!eintrag.wurzel || eintrag.start !== null) continue
    const jetzt = schnappschuss.get(eintrag.pid)
    if (!jetzt) continue
    eintrag.start = jetzt.start
    eintrag.name = jetzt.name
    eintrag.befehl = jetzt.befehl
    eintrag.eltern = jetzt.eltern
  }
}

// Verwaiste Kandidaten für die Rückfall-Liste im App-Tab: Prozesse, die
// während eines Lauf-Zeitfensters gestartet wurden, deren Elternteil nicht mehr
// lebt (oder dessen PID neu vergeben wurde) und die zu keiner aktiven Gruppe
// gehören. Sie werden NIE automatisch beendet — nur gezeigt („vermutlich aus
// einem Lauf"), denn ein Editor, den Georg währenddessen öffnete, sähe genauso
// aus. Ausgenommen: FlowForge selbst, seine direkten Kinder (Renderer, Motor,
// Späher, App-Shell) und Systemprozesse ohne Befehlszeile.
export function verwaisteKandidaten(schnappschuss, { fenster, eigenePid, ausgeschlossen }) {
  const kandidaten = []
  for (const p of schnappschuss.values()) {
    if (p.pid === eigenePid || p.eltern === eigenePid) continue
    if (ausgeschlossen.has(p.pid)) continue
    if (!p.befehl) continue
    if (!fenster.some((f) => p.start >= f.von && (f.bis === null || p.start <= f.bis))) continue
    const elternteil = schnappschuss.get(p.eltern)
    const elternTot = !elternteil || elternteil.start > p.start
    if (!elternTot) continue
    kandidaten.push(p)
  }
  return kandidaten
}

// ANSI-Steuerfolgen aus der App-Ausgabe entfernen (Farben, Cursor, OSC-Titel).
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g

export function ansiEntfernen(text) {
  return text.replace(ANSI, '')
}

// Ausgabe-Puffer der App fortschreiben: \r\n → \n; ein einzelnes \r
// überschreibt die aktuelle Zeile (Fortschrittsbalken); der Puffer bleibt
// unter der Obergrenze (vorn wird zeilenweise abgeschnitten). Liefert den
// neuen Puffer.
export function ausgabeAnhaengen(puffer, text, maxZeichen) {
  const sauber = ansiEntfernen(text).replace(/\r\n/g, '\n')
  const teile = sauber.split('\r')
  let neu = puffer + teile[0]
  for (let i = 1; i < teile.length; i++) {
    neu = neu.slice(0, neu.lastIndexOf('\n') + 1) + teile[i]
  }
  if (neu.length > maxZeichen) {
    const schnitt = neu.length - maxZeichen
    const naechsteZeile = neu.indexOf('\n', schnitt)
    neu = naechsteZeile >= 0 ? neu.slice(naechsteZeile + 1) : neu.slice(schnitt)
  }
  return neu
}

// Port einer Startanleitungs-Adresse — nur für lokale Adressen (die
// Port-Prüfung vor dem Start gilt dem eigenen Rechner). null sonst.
export function lokalerPort(adresse) {
  let url
  try {
    url = new URL(adresse)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  const lokal = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', '::'].includes(host) ||
    host.startsWith('127.') || host.endsWith('.localhost')
  if (!lokal) return null
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null
}
