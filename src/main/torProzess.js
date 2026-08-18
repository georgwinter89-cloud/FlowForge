// Tor ohne KI (BAUPLAN 35): FlowForge führt Prüfbefehl und Rauchtest SELBST
// aus — ohne Motor, ohne Agenten, 0 Tokens. Mechanik wie im App-Tab
// (appProzess.js): Shell mit UTF-8-Codepage, keine Eingabe, ANSI gestrippt,
// windowsHide. Zwei Unterschiede, die hier zählen:
//   * Zeitlimit: Ein Testlauf, der hängt, darf den ganzen Lauf nicht anhalten —
//     nach Ablauf wird der Prozessbaum abgeräumt und das Ergebnis gilt als rot.
//   * Still: Kein Eintrag in der App-Tab-Verwaltung, keine Zustandsmeldung an
//     die Oberfläche, kein Browser-Fenster. Der Rauchtest darf die App, die
//     Georg gerade im Tab laufen hat, weder anzeigen noch überschreiben.
// Beide Läufe bekommen eine eigene Prozessgruppe: Was sie hinterlassen, räumt
// der Späher ab — ohne die Motor-Prozesse des Laufs anzufassen.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { ausgabeAnhaengen, lokalerPort } from './prozessRegeln.js'
import {
  prozessgruppeAnlegen,
  prozessWurzelMelden,
  prozessgruppeAbraeumen,
  portBesitzer,
  prozessBeenden,
  prozessZugehoerigkeit
} from './prozesse.js'
import { appLaeuft, einmalAnfragen, aufPortFreiWarten } from './appProzess.js'
import { startanleitungLaden } from './startanleitung.js'
import { texte } from '../shared/texte.js'

// So lange darf ein Prüfbefehl laufen. Großzügig genug für eine echte
// Testsuite, kurz genug, dass ein hängender Lauf auffällt statt zu blockieren.
export const PRUEFBEFEHL_ZEITLIMIT_MS = 5 * 60 * 1000
// Rauchtest: nur „läuft an und antwortet" — nicht mehr.
const RAUCHTEST_ZEITLIMIT_MS = 25 * 1000
const RAUCHTEST_ANLAUF_MS = 6 * 1000
const RAUCHTEST_ABSTAND_MS = 700
const AUSGABE_MAX_ZEICHEN = 40000

function umgebung() {
  return {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    FORCE_COLOR: '0',
    NO_COLOR: '1'
  }
}

function istWebAdresse(adresse) {
  return /^https?:\/\//i.test(adresse)
}

// Führt einen Befehl im Projektordner aus und liefert { code, ausgabe,
// zeitlimit }. code === 0 heißt grün. Bricht das Zeitlimit ab, gilt der Lauf
// als rot (zeitlimit: true) — ein Testlauf, der nicht endet, ist kein Beleg.
// abbrechen: wird im Sekundentakt gefragt — sagt sie true (Georg hat „Sanft
// anhalten" oder „Sofort abbrechen" gedrückt), wird der Prozessbaum sofort
// abgeräumt. Ohne diesen Haken liefe ein zäher Testlauf nach dem Abbruch noch
// minutenlang weiter.
export async function befehlAbspielen(
  projektPfad,
  befehl,
  { zeitlimitMs = PRUEFBEFEHL_ZEITLIMIT_MS, gruppe = null, aufLebenszeichen = null, abbrechen = null } = {}
) {
  const schluessel = gruppe ?? 'tor:' + projektPfad
  prozessgruppeAnlegen(schluessel, projektPfad)
  let kind
  try {
    kind = spawn('cmd.exe', ['/d', '/s', '/c', `"chcp 65001 >nul && ${befehl}"`], {
      cwd: projektPfad,
      env: umgebung(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      windowsVerbatimArguments: true
    })
  } catch (fehler) {
    await prozessgruppeAbraeumen(schluessel)
    return { code: -1, ausgabe: String(fehler?.message ?? fehler), zeitlimit: false, startFehler: true }
  }
  if (kind.pid) prozessWurzelMelden(schluessel, projektPfad, kind.pid)

  let ausgabe = ''
  const dekoder = { stdout: new TextDecoder('utf-8'), stderr: new TextDecoder('utf-8') }
  const aufnehmen = (quelle) => (stueck) => {
    ausgabe = ausgabeAnhaengen(ausgabe, dekoder[quelle].decode(stueck, { stream: true }), AUSGABE_MAX_ZEICHEN)
    aufLebenszeichen?.()
  }
  kind.stdout.on('data', aufnehmen('stdout'))
  kind.stderr.on('data', aufnehmen('stderr'))
  kind.on('error', (fehler) => {
    ausgabe = ausgabeAnhaengen(ausgabe, '\n' + String(fehler?.message ?? fehler) + '\n', AUSGABE_MAX_ZEICHEN)
  })

  let zeitlimit = false
  let abgebrochen = false
  const code = await new Promise((fertig) => {
    const wecker = setTimeout(() => {
      zeitlimit = true
      void prozessgruppeAbraeumen(schluessel)
    }, zeitlimitMs)
    // Abbruch-Wache: Der Lauf soll auf „Sofort abbrechen" auch dann reagieren,
    // wenn gerade ein fremder Testlauf die Zeit frisst.
    const wache = abbrechen
      ? setInterval(() => {
          if (!abbrechen()) return
          abgebrochen = true
          void prozessgruppeAbraeumen(schluessel)
        }, 1000)
      : null
    kind.on('exit', (code, signal) => {
      clearTimeout(wecker)
      if (wache) clearInterval(wache)
      fertig(code ?? (signal ? -1 : null))
    })
  })
  // Was die Shell hinterließ (Testserver, verwaiste Kinder), räumt die Gruppe ab.
  await prozessgruppeAbraeumen(schluessel)
  return {
    code: zeitlimit || abgebrochen ? -1 : code,
    ausgabe,
    zeitlimit,
    abgebrochen,
    startFehler: false
  }
}

// Rauchtest der Startanleitung (BAUPLAN 35): Startet die gebaute App einmal
// kurz und stoppt sie wieder — läuft der Befehl an, antwortet die Adresse?
// Liefert IMMER (0.46.2) { geprueft, gruen, code, ausgabe, grund, port?,
// besitzer?, abgeraeumt? }:
//   geprueft: false — konnte nicht sinnvoll geprüft werden (grund 'keine' |
//     'appLaeuft' | 'nichtsZuStarten' | 'abgebrochen' | 'portFremd'); dann
//     gruen: null, und der Rauchtest urteilt über gar nichts.
//   code — Fehlercode des Startversuchs; null = „lief noch, als abgeräumt
//     wurde" (bei einer Web-Adresse der Normalfall).
//   ausgabe — was der Startversuch schrieb (gedeckelt), auch bei Grün.
// Port-Prüfung vor dem Start (0.46.2, Mechanik aus dem App-Tab): Ist der Port
// der Adresse belegt und der Besitzer stammt aus diesem Lauf/Projekt (Späher-
// Gruppen, Reste), räumt FlowForge ihn ab (abgeraeumt) und startet dann; ein
// fremder Besitzer — Georgs eigener Server, ein Editor, FlowForge selbst, oder
// nur „vermutlich aus einem Lauf" — führt zu 'portFremd' mit besitzer statt zu
// einem falschen Rot (Befund Life-OS-Lauf 18.08.2026: Port 3888 von Waisen
// aus den eigenen Bauer-Tests belegt, beide Bauer bekamen „läuft nicht an").
// gruppe (BAUPLAN 41): Prozessgruppe dieses Rauchtests — je Aufruf eine
// eigene (seit 0.46.2 einer je Welle, benannt nach dem attribuierten Block;
// ein Bauer allein wie zuvor je Block-Instanz). Ohne sie räumte ein fertiger
// Rauchtest einen noch laufenden ab und meldete ein falsches Rot.
export async function rauchtest(projektPfad, { abbrechen = null, gruppe = null } = {}) {
  const uebersprungen = (grund, weiteres = {}) => ({
    geprueft: false,
    gruen: null,
    code: null,
    ausgabe: '',
    grund,
    ...weiteres
  })
  const { anleitung } = startanleitungLaden(projektPfad)
  if (!anleitung) return uebersprungen('keine')
  // Läuft die App gerade im App-Tab, würde der Rauchtest ihr den Port
  // wegnehmen und ein falsches Rot melden — dann lieber gar nicht prüfen.
  if (appLaeuft(projektPfad)) return uebersprungen('appLaeuft')

  // Nur Datei-Adresse, kein Befehl: Es gibt nichts zu starten — geprüft wird,
  // ob die Datei überhaupt existiert.
  if (!anleitung.befehl) {
    if (!anleitung.adresse || istWebAdresse(anleitung.adresse)) return uebersprungen('nichtsZuStarten')
    const voll = path.resolve(projektPfad, anleitung.adresse)
    return fs.existsSync(voll)
      ? { geprueft: true, gruen: true, code: null, ausgabe: '', grund: null }
      : {
          geprueft: true,
          gruen: false,
          code: null,
          ausgabe: texte.tor.rauchtestDateiFehlt(anleitung.adresse),
          grund: null
        }
  }

  // Port-Prüfung vor dem Start (0.46.2).
  const port = anleitung.adresse ? lokalerPort(anleitung.adresse) : null
  const abgeraeumt = []
  if (port) {
    const besitzer = await portBesitzer(port)
    if (besitzer) {
      const kurz = { pid: besitzer.pid, name: besitzer.name, befehl: besitzer.befehl }
      const zugehoerig = prozessZugehoerigkeit(besitzer.pid, besitzer.start, projektPfad)
      if (zugehoerig !== 'gruppe' && zugehoerig !== 'rest')
        return uebersprungen('portFremd', { port, besitzer: kurz, zugehoerigkeit: zugehoerig })
      const beendet = await prozessBeenden(besitzer.pid, besitzer.start)
      if (beendet.ok) abgeraeumt.push(kurz)
      if (!(await aufPortFreiWarten(port))) {
        // Ließ sich nicht wegräumen — dann kein Urteil, statt eines Rots, das
        // der Bauer nicht verschuldet hat.
        const jetzt = await portBesitzer(port)
        const wer = jetzt ? { pid: jetzt.pid, name: jetzt.name, befehl: jetzt.befehl } : kurz
        return uebersprungen('portFremd', { port, besitzer: wer, abgeraeumt, zugehoerigkeit: zugehoerig })
      }
    }
  }

  const schluessel = gruppe ?? 'rauchtest:' + projektPfad
  prozessgruppeAnlegen(schluessel, projektPfad)
  let kind
  try {
    kind = spawn('cmd.exe', ['/d', '/s', '/c', `"chcp 65001 >nul && ${anleitung.befehl}"`], {
      cwd: projektPfad,
      env: umgebung(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      windowsVerbatimArguments: true
    })
  } catch (fehler) {
    await prozessgruppeAbraeumen(schluessel)
    return {
      geprueft: true,
      gruen: false,
      code: -1,
      ausgabe: String(fehler?.message ?? fehler),
      grund: null,
      ...(port ? { port } : {}),
      abgeraeumt
    }
  }
  if (kind.pid) prozessWurzelMelden(schluessel, projektPfad, kind.pid)

  let ausgabe = ''
  const dekoder = { stdout: new TextDecoder('utf-8'), stderr: new TextDecoder('utf-8') }
  const aufnehmen = (quelle) => (stueck) => {
    ausgabe = ausgabeAnhaengen(ausgabe, dekoder[quelle].decode(stueck, { stream: true }), AUSGABE_MAX_ZEICHEN)
  }
  kind.stdout.on('data', aufnehmen('stdout'))
  kind.stderr.on('data', aufnehmen('stderr'))
  kind.on('error', (fehler) => {
    ausgabe = ausgabeAnhaengen(ausgabe, '\n' + String(fehler?.message ?? fehler) + '\n', AUSGABE_MAX_ZEICHEN)
  })

  let beendet = null // { code }
  kind.on('exit', (code, signal) => {
    beendet = { code: code ?? (signal ? -1 : null) }
  })

  const webAdresse = anleitung.adresse && istWebAdresse(anleitung.adresse)
  const schluss = Date.now() + (webAdresse ? RAUCHTEST_ZEITLIMIT_MS : RAUCHTEST_ANLAUF_MS)
  let antwortet = false
  let abgebrochen = false
  while (Date.now() < schluss) {
    if (beendet) break
    if (abbrechen?.()) {
      abgebrochen = true
      break
    }
    if (webAdresse && (await einmalAnfragen(anleitung.adresse))) {
      antwortet = true
      break
    }
    await new Promise((weiter) => setTimeout(weiter, RAUCHTEST_ABSTAND_MS))
  }
  // Der Stand VOR dem Abräumen zählt (0.46.2): Beendet FlowForge die noch
  // laufende App selbst (taskkill /F), meldet Windows danach Fehlercode 1 —
  // und genau dieser Code galt bis 0.46.1 als Rot: Jede App, die anlief und
  // antwortete (oder ohne Adresse länger als der Anlauf lief), war „lief
  // nicht an" (gemessen mit einem echten http-Server; Befund Life-OS-Lauf
  // 18.08.2026: beide Bauer rot, obwohl der Code lief). code === null heißt
  // seither ehrlich „lief noch, als abgeräumt wurde".
  const ende = beendet
  await prozessgruppeAbraeumen(schluessel)
  // Ein abgebrochener Rauchtest urteilt über nichts — Georg hat den Lauf
  // gestoppt, das ist kein Befund über die gebaute App.
  if (abgebrochen) return uebersprungen('abgebrochen', { ausgabe, ...(port ? { port } : {}), abgeraeumt })

  // Bewertung: Ein Befehl, der mit Fehlercode stirbt, ist immer rot. Eine
  // Web-Adresse muss antworten; ohne Adresse genügt „läuft noch oder sauber
  // durchgelaufen" — ein Kommandozeilen-Programm darf sich beenden.
  const urteil = (gruen, ausgabeText) => ({
    geprueft: true,
    gruen,
    code: ende ? ende.code : null,
    ausgabe: ausgabeText,
    grund: null,
    ...(port ? { port } : {}),
    abgeraeumt
  })
  if (ende && ende.code !== 0) return urteil(false, ausgabe)
  if (webAdresse && !antwortet)
    return urteil(false, ausgabe + '\n' + texte.tor.rauchtestKeineAntwort(anleitung.adresse))
  return urteil(true, ausgabe)
}
