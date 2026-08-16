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
import { ausgabeAnhaengen } from './prozessRegeln.js'
import { prozessgruppeAnlegen, prozessWurzelMelden, prozessgruppeAbraeumen } from './prozesse.js'
import { appLaeuft, einmalAnfragen } from './appProzess.js'
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
// Liefert { geprueft, gruen, ausgabe, grund }. geprueft: false heißt „konnte
// nicht sinnvoll geprüft werden" (keine Startanleitung, App läuft schon im Tab,
// nichts zu starten) — dann urteilt der Rauchtest über gar nichts.
// gruppe (BAUPLAN 41): Prozessgruppe dieses Rauchtests — je Block-Instanz eine
// eigene. Ohne sie räumte der fertige Rauchtest des einen Bauers den laufenden
// des anderen ab und meldete ein falsches Rot.
export async function rauchtest(projektPfad, { abbrechen = null, gruppe = null } = {}) {
  const { anleitung } = startanleitungLaden(projektPfad)
  if (!anleitung) return { geprueft: false, grund: 'keine' }
  // Läuft die App gerade im App-Tab, würde der Rauchtest ihr den Port
  // wegnehmen und ein falsches Rot melden — dann lieber gar nicht prüfen.
  if (appLaeuft(projektPfad)) return { geprueft: false, grund: 'appLaeuft' }

  // Nur Datei-Adresse, kein Befehl: Es gibt nichts zu starten — geprüft wird,
  // ob die Datei überhaupt existiert.
  if (!anleitung.befehl) {
    if (!anleitung.adresse || istWebAdresse(anleitung.adresse))
      return { geprueft: false, grund: 'nichtsZuStarten' }
    const voll = path.resolve(projektPfad, anleitung.adresse)
    return fs.existsSync(voll)
      ? { geprueft: true, gruen: true, ausgabe: '' }
      : {
          geprueft: true,
          gruen: false,
          ausgabe: texte.tor.rauchtestDateiFehlt(anleitung.adresse)
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
    return { geprueft: true, gruen: false, ausgabe: String(fehler?.message ?? fehler) }
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
  await prozessgruppeAbraeumen(schluessel)
  // Ein abgebrochener Rauchtest urteilt über nichts — Georg hat den Lauf
  // gestoppt, das ist kein Befund über die gebaute App.
  if (abgebrochen) return { geprueft: false, grund: 'abgebrochen' }

  // Bewertung: Ein Befehl, der mit Fehlercode stirbt, ist immer rot. Eine
  // Web-Adresse muss antworten; ohne Adresse genügt „läuft noch oder sauber
  // durchgelaufen" — ein Kommandozeilen-Programm darf sich beenden.
  if (beendet && beendet.code !== 0)
    return { geprueft: true, gruen: false, ausgabe, code: beendet.code }
  if (webAdresse && !antwortet)
    return {
      geprueft: true,
      gruen: false,
      ausgabe: ausgabe + '\n' + texte.tor.rauchtestKeineAntwort(anleitung.adresse)
    }
  return { geprueft: true, gruen: true, ausgabe }
}
