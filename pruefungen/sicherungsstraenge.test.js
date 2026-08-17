// Sicherungspunkte je Schreiber (BAUPLAN 45). Gemessen wird an echten Punkten
// im versteckten Git-Verzeichnis, nicht an einer nachgebauten Rechnung: Der
// Fehler, um den es hier geht, sitzt genau in der Frage, welcher Ref beim
// Anlegen, beim Vergleichen und beim Zurücksetzen gemeint ist — am Ergebnis
// einer reinen Funktion sieht man das nie.
//
// Rot vor Grün (gemessen am Stand vor Bauschritt 45, Commit 46c9b44):
//   - strangOeffnen/strangZusammenfuehren/straengeAufraeumen gab es nicht;
//     die Aufrufe liefen in einen TypeError.
//   - sicherungspunktAnlegen nahm keinen Strang: Der Punkt landete auf 'haupt',
//     letzterPunktId(pfad) und letzterPunktId(pfad, strang) waren gleich.
//   - aufLetztenPunktZuruecksetzen kannte keine geschützten Bereiche: Die
//     fremde Prüfmappe wurde mit zurückgesetzt, geschuetztUebersprungen
//     war undefined.
//   - punkteVergleichen kannte kein nurDateien: Der Vergleich lieferte alle
//     drei Dateien statt der einen aus dem Wirkbereich.
//   - sicherungspunkteLaden entdoppelte nicht: Nach zwei Zusammenführungen
//     stand der Basispunkt mehrfach in der Liste.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import git from 'isomorphic-git'
import { app } from 'electron'
import { texte } from '../src/shared/texte.js'
import {
  sicherungspunktAnlegen,
  sicherungspunkteLaden,
  strangOeffnen,
  strangZusammenfuehren,
  straengeAufraeumen,
  letzterPunktId,
  punkteVergleichen,
  aufLetztenPunktZuruecksetzen,
  wiederherstellenVorschau
} from '../src/main/sicherungspunkte.js'

// Das versteckte Git-Verzeichnis leitet sich allein aus dem Projektpfad ab
// (sha1 des kleingeschriebenen Pfads unter userData) und ÜBERLEBT das Löschen
// des Projektordners. pruefungen/electronStub.js gibt allen Prüfungen denselben
// festen Temp-Ordner — ohne dieses Mitlöschen wäre die Prüfung beim ersten Lauf
// grün und danach rot, sobald das Betriebssystem eine Prozesskennung
// wiederverwendet: Der Ordner wäre frisch, die Punkte wären die von gestern.
function gitOrdner(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
    .slice(0, 16)
  return path.join(app.getPath('userData'), 'sicherungen', schluessel)
}

function projektAnlegen(name) {
  const pfad = path.join(os.tmpdir(), `flowforge-strang-${name}-${process.pid}`)
  fs.rmSync(pfad, { recursive: true, force: true })
  fs.rmSync(gitOrdner(pfad), { recursive: true, force: true })
  fs.mkdirSync(pfad, { recursive: true })
  return pfad
}

// Bekannte Grenze der Sicherungspunkte (belegt 15.08.2026, siehe
// laufDiffPunkte.test.js): Die Änderungs-Erkennung von isomorphic-git vergleicht
// Zeitstempel nur sekundengenau. Im Alltag arbeitet ein Block Sekunden bis
// Minuten; die Prüfung stellt diesen Abstand künstlich her, statt eine
// Sub-Sekunden-Wette einzugehen.
//
// Der Zähler ist dabei nicht Zierrat: Ein fester Aufschlag gäbe zwei schnell
// aufeinanderfolgenden Schreibvorgängen DIESELBE Sekunde, und eine Änderung
// gleicher Länge („eins\n" → „ZWEI\n") bliebe dann unsichtbar — die Prüfung
// wäre grün, ohne je einen zweiten Punkt gesehen zu haben.
let schreibZaehler = 0
function schreiben(projektPfad, relativ, inhalt) {
  const ziel = path.join(projektPfad, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  const spaeter = new Date(Date.now() + ++schreibZaehler * 2000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

function lesen(projektPfad, relativ) {
  const ziel = path.join(projektPfad, relativ)
  return fs.existsSync(ziel) ? fs.readFileSync(ziel, 'utf8') : null
}

// Der ganze Arbeitsordner als vergleichbares Abbild — Pfad zu Inhalt.
function ordnerAbbild(wurzel, unter = '') {
  const abbild = {}
  for (const eintrag of fs.readdirSync(path.join(wurzel, unter), { withFileTypes: true })) {
    const relativ = unter ? unter + '/' + eintrag.name : eintrag.name
    if (eintrag.isDirectory()) Object.assign(abbild, ordnerAbbild(wurzel, relativ))
    else abbild[relativ] = fs.readFileSync(path.join(wurzel, relativ), 'utf8')
  }
  return abbild
}

describe('BAUPLAN 45 · Ein Punkt auf einem Strang bewegt „haupt" nicht', () => {
  const projektPfad = projektAnlegen('eigenerstrang')
  let basis = null
  let aufStrang = null

  beforeAll(async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    basis = await letzterPunktId(projektPfad)
    await strangOeffnen(projektPfad, 'bauer-1')
    schreiben(projektPfad, 'app.js', 'ZWEI\n')
    aufStrang = await sicherungspunktAnlegen(projektPfad, 'Teilstück 1', { strang: 'bauer-1' })
  })

  it('öffnet den Strang auf der Spitze von „haupt"', async () => {
    const nochmal = await strangOeffnen(projektPfad, 'bauer-2')
    expect(nochmal.ok).toBe(true)
    expect(nochmal.id).toBe(basis)
  })

  it('legt den Punkt auf dem Strang an, nicht auf „haupt"', async () => {
    expect(aufStrang.ok).toBe(true)
    expect(aufStrang.neu).toBe(true)
    expect(await letzterPunktId(projektPfad)).toBe(basis)
    expect(await letzterPunktId(projektPfad, 'bauer-1')).toBe(aufStrang.id)
    expect(aufStrang.id).not.toBe(basis)
  })

  it('meint denselben Zweig, ob mit oder ohne mitgebrachten Vorsatz', async () => {
    // Der Lauf reicht den Strang als „strang/<Instanz-Kennung>" herein. Ein
    // zweiter Vorsatz wäre zwar eindeutig, aber niemand fände sich mehr zurecht.
    expect(await letzterPunktId(projektPfad, 'strang/bauer-1')).toBe(aufStrang.id)
  })

  it('rollt auf den Strangpunkt zurück, nicht auf „haupt"', async () => {
    // Der Kern des ganzen Schritts: Ein verworfenes Teilstück (BAUPLAN 20/22)
    // rollt auf den Stand DIESES Schreibers zurück — vorher wäre hier der
    // projektweite Stand von vor dem Lauf herausgekommen.
    schreiben(projektPfad, 'app.js', 'DREI gebastelt\n')
    const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad, { strang: 'bauer-1' })
    expect(zurueck.ok).toBe(true)
    expect(zurueck.zurueckgesetzt).toBe(true)
    expect(lesen(projektPfad, 'app.js')).toBe('ZWEI\n')
    // Der Regelfall, gegen den der Sonderfall weiter unten steht: 'haupt' ist
    // seit dem Öffnen des Strangs stehengeblieben, der Anker also unüberholt —
    // dann fasst der Rückroll wie eh und je den ganzen Ordner an.
    expect(zurueck.standUeberholt).toBe(false)
    expect(zurueck.fremdUebersprungen).toBe(0)
  })

  it('gibt genau die id zurück, auf die ein Rückroll dieses Schreibers zielt', async () => {
    // Die Zusicherung, auf der helferWerkzeuge.js baut: „der neueste Punkt ist
    // der Stand VOR dem Teilstück". Läuft der Ref nicht durch alle drei Stellen
    // (log, statusMatrix, commit), meint die gemeldete id einen anderen Punkt
    // als der spätere Rückroll — die lokale KI baute dann auf Gebastel weiter,
    // das sie gerade verworfen glaubt.
    expect(await letzterPunktId(projektPfad, 'bauer-1')).toBe(aufStrang.id)
  })
})

describe('BAUPLAN 45 · Rückroll mit geschützten Bereichen', () => {
  const projektPfad = projektAnlegen('geschuetzt')
  let ergebnis = null

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'A\n')
    schreiben(projektPfad, 'pruefung/p1/test.js', 'P1\n')
    schreiben(projektPfad, 'pruefung/p2/test.js', 'P2\n')
    schreiben(projektPfad, 'notizen.txt', 'N\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Block')

    // Der abgebrochene Schreiber hinterlässt Gebastel — auch außerhalb seiner
    // eigenen Dateiliste (Befehle und der lokale Schreibpfad kommen an der
    // Sperre vorbei, BAUPLAN 44). Gleichzeitig hat ein anderer Prüfer in seiner
    // eigenen Mappe gearbeitet; die ist sein Wirkbereich und bleibt stehen.
    schreiben(projektPfad, 'src/app.js', 'A gebastelt\n')
    schreiben(projektPfad, 'src/neu.js', 'frisch\n')
    schreiben(projektPfad, 'pruefung/p1/test.js', 'P1 gearbeitet\n')
    schreiben(projektPfad, 'pruefung/p2/test.js', 'P2 gebastelt\n')
    ergebnis = await aufLetztenPunktZuruecksetzen(projektPfad, { geschuetzt: ['pruefung/p1'] })
  })

  it('lässt den geschützten Bereich unangetastet', () => {
    expect(lesen(projektPfad, 'pruefung/p1/test.js')).toBe('P1 gearbeitet\n')
  })

  it('setzt alles andere zurück — auch außerhalb der eigenen Dateiliste', () => {
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.zurueckgesetzt).toBe(true)
    expect(lesen(projektPfad, 'src/app.js')).toBe('A\n')
    expect(lesen(projektPfad, 'src/neu.js')).toBe(null)
    // Eine fremde Mappe ist geschützt, „die Prüfmappe" als Ganzes nicht — der
    // Schutz gilt je Wirkbereich, nicht je Ordnersorte.
    expect(lesen(projektPfad, 'pruefung/p2/test.js')).toBe('P2\n')
    expect(lesen(projektPfad, 'notizen.txt')).toBe('N\n')
  })

  it('zählt, was wegen des Schutzes stehengeblieben ist', () => {
    expect(ergebnis.geschuetztUebersprungen).toBe(1)
  })

  it('verhält sich ohne geschützte Bereiche wie bisher', async () => {
    schreiben(projektPfad, 'src/app.js', 'nochmal gebastelt\n')
    const zurueck = await aufLetztenPunktZuruecksetzen(projektPfad)
    expect(zurueck.ok).toBe(true)
    expect(zurueck.zurueckgesetzt).toBe(true)
    expect(zurueck.geschuetztUebersprungen).toBe(0)
    expect(lesen(projektPfad, 'src/app.js')).toBe('A\n')
    // Ohne Strang gibt es keinen Anker, den etwas überholen könnte: Der Anker
    // IST der gemeinsame Stand. Diese Zeile hält fest, dass die neue Bremse den
    // alten Weg nicht anfasst.
    expect(zurueck.standUeberholt).toBe(false)
  })
})

// Die Lage, um die es im Block darunter geht — der Reihe nach am echten
// Unterbau aufgebaut, nicht nachgerechnet:
//   1. Ausgangsstand auf 'haupt'.
//   2. Ein wartender Block (Prüfer) öffnet seinen Strang und legt darauf einen
//      EIGENEN Punkt an: den Anker der lokalen Vorreparatur.
//   3. Die lokale KI bastelt in einer fremden Datei (BAUPLAN 44: Befehle und
//      der lokale Schreibpfad kommen an der Dateilisten-Sperre vorbei).
//   4. Ein ZWEITER Schreiber wird fertig und führt seinen Strang zusammen —
//      'haupt' zieht damit an dem Anker vorbei.
//   5. Die Nachprüfung scheitert, der Lauf rollt auf den Anker zurück.
async function ueberholterAnker(name) {
  const projektPfad = projektAnlegen(name)
  schreiben(projektPfad, 'src/app.js', 'sauberer Stand\n')
  schreiben(projektPfad, 'src/zweiter-zweig.js', 'noch leer\n')
  await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
  const basis = await letzterPunktId(projektPfad)

  await strangOeffnen(projektPfad, 'strang/pruefer')
  schreiben(projektPfad, 'pruefung/pruefer/beleg.test.js', 'weist die Arbeit zurück\n')
  const anker = await sicherungspunktAnlegen(projektPfad, 'Stand vor lokaler Reparatur', {
    strang: 'strang/pruefer'
  })
  schreiben(projektPfad, 'src/app.js', 'GEBASTEL der lokalen KI\n')

  await strangOeffnen(projektPfad, 'strang/bauer-2')
  schreiben(projektPfad, 'src/zweiter-zweig.js', 'ECHTE ARBEIT DES ZWEITEN BAUERS\n')
  await sicherungspunktAnlegen(projektPfad, 'Zwischenstand Bauer 2', { strang: 'strang/bauer-2' })
  const zusammen = await strangZusammenfuehren(
    projektPfad,
    'strang/bauer-2',
    'Nach Block „Bauer 2"'
  )
  return { projektPfad, basis, anker, zusammen }
}

describe('BAUPLAN 45 · Ohne Strangnamen wird nichts gelöscht', () => {
  // Beim Gegenlesen des eigenen Unterbaus gemessen, nicht vermutet: Ein Strang
  // ohne Namen ist 'haupt' (zweigFuer(null) gibt den gemeinsamen Zweig zurück),
  // und strangZusammenfuehren räumte am Ende IMMER „seinen" Zweig weg. Der
  // Aufruf mit strang = null löschte damit den Zweig 'haupt' — und meldete
  // dabei { ok: true }.
  //
  // Rot vor Grün, so gemessen (arbeitsablage/bauer-mechanik/nullstrang.mess.js,
  // vor der einen Zeile in strangEntfernen):
  //   MESS ergebnis = {"ok":true,"neu":false,"id":"4d4620fa…"}
  //   MESS zweige   = []
  //   MESS punkte   = []            ← Georgs ganze Liste
  //   MESS nachher  = null          ← letzterPunktId findet nichts mehr
  // Kein Punkt war gelöscht, aber keiner mehr erreichbar: Georg hätte in
  // „Wiederherstellen" eine leere Liste vorgefunden, ohne dass irgendwo etwas
  // rot geworden wäre. Heute reicht kein Aufrufer null herein (lauf.js steigt
  // in strangSchliessenAn vorher aus) — die Falle liegt eine Zeile daneben, und
  // der Zweigname allein soll ja der Schutz sein („Stränge tragen einen eigenen
  // Namensvorsatz, das ist keine Ausnahme, sondern die Bauform").
  const projektPfad = projektAnlegen('ohne-strangnamen')

  it('lässt „haupt" stehen, wenn der Strangname fehlt', async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    const vorher = await letzterPunktId(projektPfad)

    const ergebnis = await strangZusammenfuehren(projektPfad, null, 'Block fertig')
    expect(ergebnis.ok).toBe(true)

    // Die Zusage in einem Satz: Georgs Liste ist noch da.
    expect(await letzterPunktId(projektPfad)).toBe(vorher)
    const punkte = (await sicherungspunkteLaden(projektPfad)).punkte
    expect(punkte.map((punkt) => punkt.beschriftung)).toEqual(['Stand vor dem Lauf'])
    expect(await git.listBranches({ fs, gitdir: gitOrdner(projektPfad) })).toEqual(['haupt'])
  })
})

describe('BAUPLAN 45 · Rückroll auf einen Anker, den der gemeinsame Stand überholt hat', () => {
  // Nacharbeit Runde 2, Prüfer-Befund 4. Gemessener Mangel: Seit ein Strang
  // offen bleibt, solange derselbe Block gleich wieder läuft, können zwei
  // Stränge gleichzeitig offen liegen. Führt der eine zusammen, während der
  // andere seinen eigenen Anker hält, zeigt dieser Anker auf einen Ordnerstand
  // von VOR der fremden Zusammenführung — und ein Rückroll darauf warf die
  // fertige, bereits eingeholte Arbeit des anderen Blocks lautlos aus dem
  // Ordner. Der Punkt blieb in Georgs Liste, der Ordnerinhalt war weg.
  //
  // Rot vor Grün, so gemessen (Stand vor dieser Nacharbeit,
  // `npx vitest run pruefungen/sicherungsstraenge.test.js -t "überholt hat"`):
  //   × lässt die schon zusammengeführte Arbeit des anderen Blocks stehen
  //     AssertionError: expected 'noch leer\n' to be 'ECHTE ARBEIT DES ZWEITEN…'
  //   × sagt, dass es einen überholten Anker war, statt es zu verschweigen
  //     AssertionError: expected undefined to be true
  //   × nimmt in diesem Fall von sich aus gar nichts zurück
  //     AssertionError: expected true to be false
  // Die erste Zeile ist der Verlust selbst: 'src/zweiter-zweig.js' stand nach
  // dem Rückroll wieder auf dem Stand von vor der fremden Arbeit.
  let lage = null
  let zurueck = null

  beforeAll(async () => {
    lage = await ueberholterAnker('ueberholt')
    zurueck = await aufLetztenPunktZuruecksetzen(lage.projektPfad, {
      strang: 'strang/pruefer',
      geschuetzt: []
    })
  })

  it('hat den Anker wirklich überholt — der gemeinsame Stand steht woanders', async () => {
    // Erst die Vorbedingung messen, sonst prüfte alles Weitere ins Leere.
    expect(lage.anker.neu).toBe(true)
    expect(lage.zusammen.ok).toBe(true)
    const gemeinsam = await letzterPunktId(lage.projektPfad)
    expect(gemeinsam).toBe(lage.zusammen.id)
    expect(gemeinsam).not.toBe(lage.anker.id)
    expect(await letzterPunktId(lage.projektPfad, 'strang/pruefer')).toBe(lage.anker.id)
  })

  it('lässt die schon zusammengeführte Arbeit des anderen Blocks stehen', () => {
    expect(zurueck.ok).toBe(true)
    expect(lesen(lage.projektPfad, 'src/zweiter-zweig.js')).toBe(
      'ECHTE ARBEIT DES ZWEITEN BAUERS\n'
    )
  })

  it('sagt, dass es ein überholter Anker war, statt es zu verschweigen', () => {
    // Der Ticker hängt an diesen beiden Zahlen: Ohne sie bliebe der Vorgang für
    // Georg genau so still wie der Verlust vorher.
    expect(zurueck.standUeberholt).toBe(true)
    expect(zurueck.fremdUebersprungen).toBe(2)
  })

  it('nimmt ohne benannten eigenen Bereich von sich aus gar nichts zurück', () => {
    expect(zurueck.zurueckgesetzt).toBe(false)
    // Auch das Gebastel bleibt also liegen. Das ist die ehrliche Grenze und
    // nicht die schönere Hälfte: Wer sein Gebastel trotzdem loswerden will,
    // muss seinen eigenen Bereich benennen (Fall darunter).
    expect(lesen(lage.projektPfad, 'src/app.js')).toBe('GEBASTEL der lokalen KI\n')
  })

  it('kann fremde Arbeit an dieser Stelle nicht am Inhalt erkennen', async () => {
    // Der Beleg dafür, warum der Unterbau NICHT selbst aussieben kann und der
    // eigene Bereich von außen kommen muss: Die Zusammenführung des zweiten
    // Blocks friert den GANZEN Arbeitsordner ein — das Gebastel der lokalen KI
    // steht damit im selben gemeinsamen Punkt wie die fremde Arbeit. Zwischen
    // Anker und gemeinsamem Stand sehen beide Dateien gleich aus.
    const vergleich = await punkteVergleichen(lage.projektPfad, lage.anker.id, lage.zusammen.id)
    expect(vergleich.dateien.map((datei) => datei.pfad)).toEqual([
      'src/app.js',
      'src/zweiter-zweig.js'
    ])
  })
})

describe('BAUPLAN 45 · Mit benanntem eigenem Bereich räumt der Rückroll wieder auf', () => {
  // Die Gegenprobe zum Fall darüber: Wer seinen Wirkbereich mitgibt, bekommt
  // sein Gebastel zurückgenommen — und nur das. Die Trennung, welche Datei wem
  // gehört, kann allein der Lauf treffen; hier wird gemessen, dass der Unterbau
  // sie sauber ausführt.
  let lage = null
  let zurueck = null

  beforeAll(async () => {
    lage = await ueberholterAnker('ueberholt-bereich')
    zurueck = await aufLetztenPunktZuruecksetzen(lage.projektPfad, {
      strang: 'strang/pruefer',
      geschuetzt: [],
      eigenerBereich: ['src/app.js']
    })
  })

  it('nimmt das eigene Gebastel zurück', () => {
    expect(zurueck.ok).toBe(true)
    expect(zurueck.zurueckgesetzt).toBe(true)
    expect(lesen(lage.projektPfad, 'src/app.js')).toBe('sauberer Stand\n')
  })

  it('lässt die fremde Arbeit trotzdem stehen und zählt sie', () => {
    expect(lesen(lage.projektPfad, 'src/zweiter-zweig.js')).toBe(
      'ECHTE ARBEIT DES ZWEITEN BAUERS\n'
    )
    expect(zurueck.standUeberholt).toBe(true)
    expect(zurueck.fremdUebersprungen).toBe(1)
  })

  it('greift nur beim überholten Anker, nicht als heimliche Dauer-Sperre', async () => {
    // Wichtig genug für eine eigene Zeile: Ein Rückroll, der IMMER nur die
    // eigene Dateiliste anfasst, ließe das Gebastel liegen, das Befehle und der
    // lokale Schreibpfad an der Sperre vorbei geschrieben haben (BAUPLAN 44) —
    // genau davor warnt der Kommentar an aufLetztenPunktZuruecksetzen. Der
    // eigene Bereich ist deshalb ein Notnagel für den überholten Anker, sonst
    // nichts: Ohne Überholung fasst derselbe Aufruf wieder alles an.
    const projektPfad = projektAnlegen('bereich-ohne-ueberholung')
    schreiben(projektPfad, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    await strangOeffnen(projektPfad, 'strang/allein')
    schreiben(projektPfad, 'src/app.js', 'gebastelt\n')
    schreiben(projektPfad, 'src/fremd.js', 'am Sperrgitter vorbei\n')
    const ohne = await aufLetztenPunktZuruecksetzen(projektPfad, {
      strang: 'strang/allein',
      eigenerBereich: ['src/app.js']
    })
    expect(ohne.standUeberholt).toBe(false)
    expect(ohne.fremdUebersprungen).toBe(0)
    expect(lesen(projektPfad, 'src/app.js')).toBe('alt\n')
    expect(lesen(projektPfad, 'src/fremd.js')).toBe(null)
  })
})

// Die Kante aus Prüfer-Befund 3 (Nacharbeit Runde 3), der Reihe nach am echten
// Unterbau aufgebaut. Der einzige Unterschied zu `ueberholterAnker` oben ist
// der, der alles kippt: Der wartende Block hat in seinem Anlauf NICHTS
// geschrieben. Sein Ankerpunkt entsteht deshalb gar nicht neu —
// sicherungspunktAnlegen meldet neu:false, und der Strang steht weiter auf der
// alten Spitze von 'haupt'.
//   1. Ausgangsstand auf 'haupt'.
//   2. Der Prüfer öffnet seinen Strang und schreibt nichts.
//   3. Die lokale KI bastelt in seiner Datei (BAUPLAN 44: Befehle und der
//      lokale Schreibpfad kommen an der Dateilisten-Sperre vorbei).
//   4. Ein Bauer wird fertig und führt zusammen — 'haupt' zieht am Anker vorbei
//      und trägt das Gebastel dabei bereits mit.
async function ankerOhneEigenenPunkt(name) {
  const projektPfad = projektAnlegen(name)
  schreiben(projektPfad, 'src/app.js', 'sauberer Stand\n')
  schreiben(projektPfad, 'src/bauer.js', 'noch leer\n')
  await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
  const basis = await letzterPunktId(projektPfad)

  await strangOeffnen(projektPfad, 'strang/pruefer-b')
  const anker = await sicherungspunktAnlegen(projektPfad, 'Stand vor lokaler Reparatur', {
    strang: 'strang/pruefer-b'
  })
  schreiben(projektPfad, 'src/app.js', 'GEBASTEL der lokalen KI\n')

  await strangOeffnen(projektPfad, 'strang/bauer')
  schreiben(projektPfad, 'src/bauer.js', 'ECHTE ARBEIT DES BAUERS\n')
  await sicherungspunktAnlegen(projektPfad, 'Zwischenstand Bauer', { strang: 'strang/bauer' })
  const zusammen = await strangZusammenfuehren(projektPfad, 'strang/bauer', 'Nach Block „Bauer"')
  return { projektPfad, basis, anker, zusammen }
}

describe('BAUPLAN 45 · Ein Anker, der gar kein eigener Punkt ist', () => {
  // Prüfer-Befund 3, an DIESEM Unterbau nachgemessen. Der Befund selbst zielt
  // auf die Entscheidung im Ablaufplaner (ob ein wartender Strang neu angesetzt
  // wird); hier steht, was der Unterbau dabei zusagt — und was er ausdrücklich
  // NICHT selbst entscheiden kann.
  //
  // Gemessen (arbeitsablage/bauer-mechanik/anker-ohne-punkt.mess.js), beide
  // Hälften desselben Aufbaus:
  //   A (Strang neu angesetzt): spitze==haupt = true, zurueck.zurueckgesetzt =
  //     false, standUeberholt = false, src/app.js = "GEBASTEL\n"
  //   B (Strang stehengelassen): zurueckgesetzt = true, standUeberholt = true,
  //     fremdUebersprungen = 1, src/app.js = "sauberer Stand\n",
  //     src/bauer.js = "ECHTE ARBEIT DES BAUERS\n"
  // Der Unterschied liegt allein darin, ob strangOeffnen noch einmal gerufen
  // wird. Diese Prüfung hält beide Hälften fest, damit niemand die zweite für
  // selbstverständlich hält.
  //
  // Rot vor Grün — die Bremse gegen den überholten Anker greift auch für einen
  // Anker OHNE eigenen Punkt, und das ist keine Selbstverständlichkeit: Sie
  // rechnet über die Erreichbarkeit, nicht über die Herkunft des Punkts.
  // Gemessen mit versuchsweise abgeschalteter Bremse (`standUeberholt = false`
  // fest verdrahtet, dann
  // `npx vitest run pruefungen/sicherungsstraenge.test.js -t "gar kein eigener Punkt"`):
  //   × nimmt das eigene Gebastel zurück, solange der Anker steht
  //     AssertionError: expected false to be true      (zurueck.standUeberholt)
  // Und was dabei im Ordner passierte (dieselbe Lage in der Messdatei):
  //   B zurueck      = {"zurueckgesetzt":true,"standUeberholt":false,"fremdUebersprungen":0}
  //   B src/bauer.js = "noch leer\n"
  // Die fertige, längst eingeholte Arbeit des Bauers war aus dem Projektordner
  // verschwunden — der Verlust, den diese Zeilen abhalten.
  let lage = null

  beforeAll(async () => {
    lage = await ankerOhneEigenenPunkt('anker-ohne-punkt')
  })

  it('ist wirklich die Kante: der Anker ist die alte Spitze von „haupt"', () => {
    // Erst die Vorbedingung messen, sonst prüfte alles Weitere ins Leere. Genau
    // hier unterscheidet sich der Fall vom grünen: kein eigener Punkt.
    expect(lage.anker.ok).toBe(true)
    expect(lage.anker.neu).toBe(false)
    expect(lage.anker.id).toBe(lage.basis)
    expect(lage.zusammen.ok).toBe(true)
  })

  it('nimmt das eigene Gebastel zurück, solange der Anker steht', async () => {
    // Die Zusage in einem Satz — am DATEIINHALT gemessen, nicht an Zahlen: Der
    // Rückroll findet den überholten Anker auch dann, wenn dieser Anker nie ein
    // eigener Punkt war.
    const zurueck = await aufLetztenPunktZuruecksetzen(lage.projektPfad, {
      strang: 'strang/pruefer-b',
      geschuetzt: [],
      eigenerBereich: ['src/app.js']
    })
    expect(zurueck.ok).toBe(true)
    expect(zurueck.standUeberholt).toBe(true)
    expect(zurueck.zurueckgesetzt).toBe(true)
    expect(zurueck.fremdUebersprungen).toBe(1)
    expect(lesen(lage.projektPfad, 'src/app.js')).toBe('sauberer Stand\n')
    expect(lesen(lage.projektPfad, 'src/bauer.js')).toBe('ECHTE ARBEIT DES BAUERS\n')
  })

  it('verliert den Anker, sobald der Strang neu geöffnet wird — die ehrliche Grenze', async () => {
    // strangOeffnen setzt den Zweig IMMER auf die Spitze von 'haupt' (das force
    // ist der Kern der Funktion, siehe dort). Für einen Strang ohne eigenen
    // Punkt heißt das: Nach dem Neu-Öffnen zeigt der Anker auf einen Stand, der
    // das Gebastel schon enthält, und es gibt nichts mehr zurückzunehmen.
    //
    // Der Unterbau kann das nicht von sich aus verhindern: Ob ein Strang neu
    // angesetzt werden DARF, hängt daran, ob derselbe Block gleich wieder läuft
    // — und das weiß allein der Ablaufplaner. Diese Zeile hält die Grenze fest,
    // statt sie zu verschweigen; wer den Anker braucht, ruft strangOeffnen nicht
    // erneut.
    const zweite = await ankerOhneEigenenPunkt('anker-neu-angesetzt')
    const nochmal = await strangOeffnen(zweite.projektPfad, 'strang/pruefer-b')
    expect(nochmal.ok).toBe(true)
    expect(nochmal.id).toBe(zweite.zusammen.id)
    expect(await letzterPunktId(zweite.projektPfad, 'strang/pruefer-b')).toBe(zweite.zusammen.id)

    const zurueck = await aufLetztenPunktZuruecksetzen(zweite.projektPfad, {
      strang: 'strang/pruefer-b',
      geschuetzt: [],
      eigenerBereich: ['src/app.js']
    })
    expect(zurueck.zurueckgesetzt).toBe(false)
    expect(zurueck.standUeberholt).toBe(false)
    expect(lesen(zweite.projektPfad, 'src/app.js')).toBe('GEBASTEL der lokalen KI\n')
  })
})

describe('BAUPLAN 45 · Eine Strangspitze, die „haupt" längst kennt, ist keine Zusammenführung', () => {
  // Nacharbeit Runde 3, beim Gegenlesen des eigenen Unterbaus gemessen. Die
  // Bedingung in strangZusammenfuehren fragte auf GLEICHSTAND der beiden
  // Spitzen — das trifft den Fall nicht, den die mehreren gleichzeitig offenen
  // Stränge herbeiführen: Ein Block, der auf seine Nachprüfung wartet und in
  // seinem Anlauf nichts geschrieben hat, steht mit seiner Strangspitze auf dem
  // ALTEN gemeinsamen Punkt. Führt ein anderer Block dazwischen zusammen, ist
  // dieser Punkt darin längst enthalten — gleich ist er trotzdem nicht.
  //
  // Rot vor Grün, so gemessen (Bedingung versuchsweise zurück auf
  // `!strangSpitze || strangSpitze.oid === hauptSpitze?.oid`, dann
  // `npx vitest run pruefungen/sicherungsstraenge.test.js -t "längst kennt"`):
  //   × legt gar keinen Punkt an, wenn sich im Ordner nichts geändert hat
  //     AssertionError: expected true to be false          (schluss.neu)
  //   × hängt einen wirklich neuen Stand ohne zweiten Elternteil an
  //     AssertionError: expected [ Array(2) ] to deeply equal [ Array(1) ]
  // Die erste Zeile ist der Schaden: Georgs Liste bekam einen zweiten Eintrag
  // mit NACHWEISLICH demselben Baum (git.readCommit → commit.tree gleich) —
  // genau das Doppel, das SPEC §3.3 abschafft, und diesmal ohne dass der Block
  // auch nur eine Datei angefasst hätte.

  it('legt gar keinen Punkt an, wenn sich im Ordner nichts geändert hat', async () => {
    const lage = await ankerOhneEigenenPunkt('spitze-bekannt-still')
    const vorher = (await sicherungspunkteLaden(lage.projektPfad)).punkte
    const schluss = await strangZusammenfuehren(
      lage.projektPfad,
      'strang/pruefer-b',
      'Nach Block „Prüfer"'
    )
    expect(schluss.ok).toBe(true)
    expect(schluss.neu).toBe(false)
    expect(schluss.id).toBe(lage.zusammen.id)
    const nachher = (await sicherungspunkteLaden(lage.projektPfad)).punkte
    expect(nachher.map((punkt) => punkt.beschriftung)).toEqual(
      vorher.map((punkt) => punkt.beschriftung)
    )
    // Und der Strang ist trotzdem weg — er hielt ja nichts fest.
    expect(await letzterPunktId(lage.projektPfad, 'strang/pruefer-b')).toBe(null)
  })

  it('hängt einen wirklich neuen Stand ohne zweiten Elternteil an', async () => {
    // Die Gegenprobe: Hat der Block sehr wohl etwas verändert (hier der Rückroll
    // aus dem Fall darüber), entsteht ein echter Punkt — aber ein gewöhnlicher.
    // Ein zweiter Elternteil, der schon Vorfahr des ersten ist, trüge eine
    // Herkunft nach, die längst in der Kette steht.
    const lage = await ankerOhneEigenenPunkt('spitze-bekannt-geaendert')
    await aufLetztenPunktZuruecksetzen(lage.projektPfad, {
      strang: 'strang/pruefer-b',
      geschuetzt: [],
      eigenerBereich: ['src/app.js']
    })
    const schluss = await strangZusammenfuehren(
      lage.projektPfad,
      'strang/pruefer-b',
      'Nach Block „Prüfer"'
    )
    expect(schluss.ok).toBe(true)
    expect(schluss.neu).toBe(true)
    const punkt = await git.readCommit({
      fs,
      gitdir: gitOrdner(lage.projektPfad),
      oid: schluss.id
    })
    expect(punkt.commit.parent).toEqual([lage.zusammen.id])
    // Und nichts geht dabei verloren: Der Punkt des Bauers steht weiter in
    // Georgs Liste, die fertige Arbeit weiter im Ordner.
    const punkte = (await sicherungspunkteLaden(lage.projektPfad)).punkte
    expect(punkte.map((p) => p.id)).toContain(lage.zusammen.id)
    expect(lesen(lage.projektPfad, 'src/bauer.js')).toBe('ECHTE ARBEIT DES BAUERS\n')
  })
})

describe('BAUPLAN 45 · Zusammenführen ohne Merge-Algorithmus', () => {
  const projektPfad = projektAnlegen('zusammen')
  let basis = null
  let aufStrang = null
  let zusammen = null

  beforeAll(async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    basis = await letzterPunktId(projektPfad)
    await strangOeffnen(projektPfad, 'bauer')
    schreiben(projektPfad, 'app.js', 'ZWEI\n')
    aufStrang = await sicherungspunktAnlegen(projektPfad, 'Teilstück', { strang: 'bauer' })
    // Diese Datei stand in KEINEM Strang — sie muss trotzdem im Baum des
    // gemeinsamen Punkts liegen, denn der Arbeitsordner ist die Wahrheit.
    schreiben(projektPfad, 'pruefung/p1/test.js', 'pruefe alles\n')
    zusammen = await strangZusammenfuehren(projektPfad, 'bauer', 'Block fertig')
  })

  it('setzt EINEN Punkt auf „haupt" mit beiden Eltern', async () => {
    expect(zusammen.ok).toBe(true)
    expect(zusammen.neu).toBe(true)
    expect(await letzterPunktId(projektPfad)).toBe(zusammen.id)
    const punkt = await git.readCommit({ fs, gitdir: gitOrdner(projektPfad), oid: zusammen.id })
    expect(punkt.commit.parent).toEqual([basis, aufStrang.id])
  })

  it('trägt den JETZIGEN Arbeitsordner im Baum — auch die Prüfmappe', async () => {
    // Deckt sich der Baum des Punkts mit dem Arbeitsordner, hat die Vorschau
    // nichts anzubieten. Das ist zugleich die Probe darauf, dass niemand
    // ausgecheckt hat: Ein Merge-Algorithmus hätte hier einen dritten Stand
    // hinterlassen.
    const vorschau = await wiederherstellenVorschau(projektPfad, zusammen.id)
    expect(vorschau.ok).toBe(true)
    expect(vorschau.unterschiede).toEqual([])
    // Und der Gegenbeweis, dass die Prüfmappe wirklich IM Baum liegt: Fehlt sie
    // im Ordner, will die Vorschau sie zurückholen.
    fs.rmSync(path.join(projektPfad, 'pruefung/p1/test.js'))
    const danach = await wiederherstellenVorschau(projektPfad, zusammen.id)
    expect(danach.unterschiede).toContainEqual({ pfad: 'pruefung/p1/test.js', art: 'nur-sicherung' })
  })

  it('räumt den Strang-Ref danach weg', async () => {
    expect(await letzterPunktId(projektPfad, 'bauer')).toBe(null)
    expect((await straengeAufraeumen(projektPfad)).entfernt).toBe(0)
  })
})

describe('BAUPLAN 45 · Kein Punkt, der einen vorhandenen wiederholt', () => {
  // Nacharbeit Runde 1. Gemessener Mangel: Ein einziger Bauer-Block ergab drei
  // Einträge in Georgs Wiederherstellen-Liste — „Stand vor dem Lauf", der
  // Blockende-Punkt und die Zusammenführung. Die beiden letzten trugen
  // NACHWEISLICH denselben Baum (git.readCommit → commit.tree gleich): zwei
  // Angebote, zwischen denen es sachlich nichts zu wählen gibt, und eine
  // Liste, die je Lauf ungefähr auf das Doppelte wuchs. SPEC §3.3 sagt einen
  // Punkt je erfolgreichem schreibendem Block zu, nicht zwei.
  //
  // Rot vor Grün: Vor der Nacharbeit war die Liste unten ['Nach Block „Bauer"',
  // 'Nach Block „Bauer"', 'Stand vor dem Lauf'] — derselbe Satz zweimal — und
  // zusammen.id ein anderer Punkt als blockende.id.
  const projektPfad = projektAnlegen('einpunkt')
  let vorLauf = null
  let blockende = null
  let zusammen = null
  let punkte = []

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    vorLauf = await letzterPunktId(projektPfad)
    await strangOeffnen(projektPfad, 'strang/bauer-1')
    schreiben(projektPfad, 'src/app.js', 'gebaut\n')
    blockende = await sicherungspunktAnlegen(projektPfad, 'Nach Block „Bauer"', {
      strang: 'strang/bauer-1'
    })
    zusammen = await strangZusammenfuehren(projektPfad, 'strang/bauer-1', 'Nach Block „Bauer"')
    punkte = (await sicherungspunkteLaden(projektPfad)).punkte
  })

  it('zieht „haupt" auf den Strangpunkt vor, statt einen Zwilling anzulegen', async () => {
    expect(zusammen.ok).toBe(true)
    expect(zusammen.neu).toBe(false)
    expect(zusammen.id).toBe(blockende.id)
    expect(await letzterPunktId(projektPfad)).toBe(blockende.id)
  })

  it('zeigt Georg genau zwei Einträge: vor dem Lauf und nach dem Block', () => {
    expect(punkte.map((p) => p.beschriftung)).toEqual(['Nach Block „Bauer"', 'Stand vor dem Lauf'])
  })

  it('hängt den Blockende-Punkt an den Stand vor dem Lauf — die Kette bleibt eine', async () => {
    const punkt = await git.readCommit({ fs, gitdir: gitOrdner(projektPfad), oid: blockende.id })
    expect(punkt.commit.parent).toEqual([vorLauf])
  })

  it('räumt den Strang trotzdem weg', async () => {
    expect(await letzterPunktId(projektPfad, 'strang/bauer-1')).toBe(null)
  })
})

describe('BAUPLAN 45 · Eine andere Beschriftung geht nie verloren', () => {
  // Die Kehrseite des Vorziehens, und der Grund, warum die Beschriftung mit in
  // der Bedingung steht. Gemessen mit einem bedingungslosen Vorziehen (nur
  // Baum und Vorfahr geprüft): Georgs Liste lautete danach
  //   ['Vor lokalem Teilstück', 'Stand vor dem Lauf']
  // — der Satz „nach Block X" kam nie an.
  //
  // Der Fall ist der Alltag, kein Sonderfall: Auf dem Strang liegen die
  // Rückroll-Punkte der lokalen KI (helferWerkzeuge.js legt vor jedem
  // Teilstück einen an). Verwirft sie ihren Versuch, steht der Ordner wieder
  // genau auf so einem Punkt — Baum gleich, Beschriftung eine ganz andere.
  const projektPfad = projektAnlegen('beschriftung')
  let aufStrang = null
  let zusammen = null
  let punkte = []

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    await strangOeffnen(projektPfad, 'strang/bauer-1')
    schreiben(projektPfad, 'src/app.js', 'gebaut\n')
    aufStrang = await sicherungspunktAnlegen(projektPfad, 'Vor lokalem Teilstück', {
      strang: 'strang/bauer-1'
    })
    // Der lokale Versuch wird verworfen — der Ordner steht wieder genau auf dem
    // Strangpunkt. Genau hier schließt der Lauf den Strang mit SEINER
    // Beschriftung.
    zusammen = await strangZusammenfuehren(projektPfad, 'strang/bauer-1', 'Nach Block „Bauer"')
    punkte = (await sicherungspunkteLaden(projektPfad)).punkte
  })

  it('legt für die andere Beschriftung einen eigenen Punkt an', () => {
    expect(zusammen.ok).toBe(true)
    expect(zusammen.neu).toBe(true)
    expect(zusammen.id).not.toBe(aufStrang.id)
  })

  it('stellt „nach Block X" obenan und behält den Strangpunkt darunter', () => {
    expect(punkte.map((p) => p.beschriftung)).toEqual([
      'Nach Block „Bauer"',
      'Vor lokalem Teilstück',
      'Stand vor dem Lauf'
    ])
  })
})

describe('BAUPLAN 45 · Zwei Stränge, jeder Punkt genau einmal', () => {
  const projektPfad = projektAnlegen('zweistraenge')
  let punkte = []

  beforeAll(async () => {
    schreiben(projektPfad, 'a.js', 'eins\n')
    schreiben(projektPfad, 'b.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    // Beide Stränge gehen vom SELBEN Basispunkt aus — das ist der Fall, in dem
    // git.log nach dem Zusammenführen über zwei Elternpfade zurückwandert.
    await strangOeffnen(projektPfad, 'eins')
    schreiben(projektPfad, 'a.js', 'ZWEI\n')
    await sicherungspunktAnlegen(projektPfad, 'Strang eins', { strang: 'eins' })
    await strangOeffnen(projektPfad, 'zwei')
    schreiben(projektPfad, 'b.js', 'ZWEI\n')
    await sicherungspunktAnlegen(projektPfad, 'Strang zwei', { strang: 'zwei' })
    await strangZusammenfuehren(projektPfad, 'eins', 'Block eins fertig')
    await strangZusammenfuehren(projektPfad, 'zwei', 'Block zwei fertig')
    punkte = (await sicherungspunkteLaden(projektPfad)).punkte
  })

  it('zeigt jeden Punkt genau einmal', () => {
    const ids = punkte.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Basis + zwei Strangpunkte + zwei Zusammenführungen. Der zweite Strang
    // wurde erst nach dem ersten Zusammenführen eingeholt — 'haupt' war also
    // weitergezogen, und beide Zusammenführungen tragen wirklich einen eigenen
    // Stand. Vorgezogen (statt als eigener Punkt geführt) wird nur, wo es
    // nichts zu verlieren gibt; das steht eine Prüfung weiter unten.
    expect(ids.length).toBe(5)
  })

  it('lässt keinen Vorfahren vor seinem Nachfolger stehen', async () => {
    // Die Zusage der Liste in einem Satz — und die Probe darauf, dass sie auch
    // dann trägt, wenn zwei Punkte in dieselbe Sekunde fallen: Der Basispunkt
    // ist der Vorfahr aller anderen und muss deshalb ganz hinten stehen.
    expect(punkte[punkte.length - 1].beschriftung).toBe('Stand vor dem Lauf')
    expect(punkte[0].beschriftung).toBe('Block zwei fertig')
  })
})

describe('BAUPLAN 45 · Zwei gleichzeitig offene Stränge, nacheinander eingeholt', () => {
  // Gegengelesen für den nächsten Schritt: Ein Strang bleibt künftig offen,
  // solange derselbe Block gleich wieder läuft — es liegen dann MEHRERE
  // Stränge gleichzeitig offen, und einer wird zusammengeführt, während ein
  // anderer noch steht. Gemessen wird der ganze Ablauf am echten Unterbau,
  // nicht am Code gelesen.
  //
  // Die Stelle, an der es hängt, ist die ZWEITE Zusammenführung. Ihre
  // Strangspitze trägt denselben Ordnerstand wie zum Zeitpunkt ihres Punkts und
  // dieselbe Beschriftung, die der Lauf mitbringt — das ist genau die
  // Vorbedingung fürs Vorziehen (SPEC §3.3: kein Punkt, der einen vorhandenen
  // wiederholt). Vorgezogen werden DARF hier aber nicht: Die Strangspitze weiß
  // nichts von der ersten Zusammenführung, 'haupt' fiele auf sie zurück, und
  // der Punkt des ersten Blocks hinge danach an keinem Ref mehr — verlorene
  // Arbeit, die Georgs Liste nie wieder zeigt. hauptIstVorfahr hält das ab.
  //
  // Rot vor Grün, so gemessen: Die Bedingung in strangZusammenfuehren wurde
  // versuchsweise von `!geaendert && (await hauptIstVorfahr(…))` auf
  // `!geaendert` verkürzt, dann
  // `npx vitest run pruefungen/sicherungsstraenge.test.js -t "gleichzeitig offene"`
  // — vier Zeilen rot:
  //   × hängt jede Zusammenführung an ihre beiden Eltern
  //     AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]
  //   × wirft den Punkt der ersten Zusammenführung nicht weg
  //     AssertionError: expected false to be true        (mB.neu)
  //   × zeigt jeden Punkt genau einmal, keinen Vorfahren vor seinem Nachfolger
  //     AssertionError: expected 2 to be 5
  //   × räumt den offen gebliebenen dritten Strang beim nächsten Start weg
  //     AssertionError: entfernt +0 statt 1
  // Georgs Liste schrumpfte dabei von fünf Punkten auf zwei: Block A, sein
  // Strangpunkt und die erste Zusammenführung waren von 'haupt' aus nicht mehr
  // erreichbar — und der dritte Strang hielt plötzlich als einziger die Spur
  // dorthin.
  const projektPfad = projektAnlegen('gleichzeitig')
  let basis = null
  let offenA = null
  let offenB = null
  let offenC = null
  let sA = null
  let sB = null
  let mA = null
  let mB = null
  let bWaehrendCOeffnet = null
  let ordnerVorZusammenfuehren = null
  let ordnerNachA = null
  let ordnerNachB = null
  let punkte = []

  // Steht in der Liste ein Punkt VOR einem seiner Eltern? Die Zusage
  // „kein Vorfahr vor seinem Nachfolger" an den echten Eltern gemessen, statt
  // eine erwartete Reihenfolge abzuschreiben: Bei zwei Zusammenführungen in
  // derselben Sekunde ist die Reihenfolge unter den gleichzeitig bereiten
  // Punkten Sache der Wanderung von git.log, die Vorfahren-Regel dagegen gilt
  // immer.
  async function elternVerletzungen(liste) {
    const platz = new Map(liste.map((punkt, stelle) => [punkt.id, stelle]))
    const verletzt = []
    for (const punkt of liste) {
      const roh = await git.readCommit({ fs, gitdir: gitOrdner(projektPfad), oid: punkt.id })
      for (const elternId of roh.commit.parent ?? [])
        if (platz.has(elternId) && platz.get(elternId) < platz.get(punkt.id))
          verletzt.push(`${punkt.beschriftung} steht hinter seinem Elternteil`)
    }
    return verletzt
  }

  beforeAll(async () => {
    schreiben(projektPfad, 'a.js', 'eins\n')
    schreiben(projektPfad, 'b.js', 'eins\n')
    schreiben(projektPfad, 'gemeinsam.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    basis = await letzterPunktId(projektPfad)

    // Beide Stränge gehen vom selben Basispunkt aus und bleiben beide offen.
    offenA = await strangOeffnen(projektPfad, 'strang/bauer-a')
    offenB = await strangOeffnen(projektPfad, 'strang/bauer-b')
    schreiben(projektPfad, 'a.js', 'A fertig\n')
    sA = await sicherungspunktAnlegen(projektPfad, 'Nach Block „A"', { strang: 'strang/bauer-a' })
    schreiben(projektPfad, 'b.js', 'B fertig\n')
    sB = await sicherungspunktAnlegen(projektPfad, 'Nach Block „B"', { strang: 'strang/bauer-b' })

    ordnerVorZusammenfuehren = ordnerAbbild(projektPfad)
    // Dieselbe Beschriftung wie der Strangpunkt — der Lauf schließt den Strang
    // am Blockende mit genau dem Satz, der schon darauf steht.
    mA = await strangZusammenfuehren(projektPfad, 'strang/bauer-a', 'Nach Block „A"')
    ordnerNachA = ordnerAbbild(projektPfad)
    // Mitten zwischen den beiden Zusammenführungen öffnet ein dritter Block
    // seinen Strang, während 'strang/bauer-b' noch offen liegt.
    offenC = await strangOeffnen(projektPfad, 'strang/bauer-c')
    bWaehrendCOeffnet = await letzterPunktId(projektPfad, 'strang/bauer-b')
    mB = await strangZusammenfuehren(projektPfad, 'strang/bauer-b', 'Nach Block „B"')
    ordnerNachB = ordnerAbbild(projektPfad)
    punkte = (await sicherungspunkteLaden(projektPfad)).punkte
  })

  it('öffnet beide Stränge auf demselben Basispunkt', () => {
    expect(offenA.ok).toBe(true)
    expect(offenB.ok).toBe(true)
    expect(offenA.id).toBe(basis)
    expect(offenB.id).toBe(basis)
  })

  it('hält die Spitzen beider Stränge und die von „haupt" auseinander', async () => {
    // Gemessen zum Zeitpunkt, an dem beide Stränge Punkte trugen: drei
    // verschiedene Antworten aus derselben Funktion.
    expect(sA.neu).toBe(true)
    expect(sB.neu).toBe(true)
    expect(sA.id).not.toBe(sB.id)
    expect(sA.id).not.toBe(basis)
    expect(sB.id).not.toBe(basis)
    // Und nach dem Einholen ist jeder Strang wirklich weg — nicht bloß leer.
    expect(await letzterPunktId(projektPfad, 'strang/bauer-a')).toBe(null)
    expect(await letzterPunktId(projektPfad, 'strang/bauer-b')).toBe(null)
  })

  it('lässt den Arbeitsordner bei beiden Zusammenführungen unangetastet', () => {
    expect(ordnerNachA).toEqual(ordnerVorZusammenfuehren)
    expect(ordnerNachB).toEqual(ordnerVorZusammenfuehren)
    expect(ordnerNachB['a.js']).toBe('A fertig\n')
    expect(ordnerNachB['b.js']).toBe('B fertig\n')
  })

  it('gibt jedem Zusammenführungs-Punkt den vollen Ordner-Stand', async () => {
    // Beide Punkte müssen den GANZEN Ordner tragen, auch die Arbeit des jeweils
    // anderen Strangs: Deckt sich der Baum mit dem Arbeitsordner, hat die
    // Vorschau nichts anzubieten.
    expect((await wiederherstellenVorschau(projektPfad, mA.id)).unterschiede).toEqual([])
    expect((await wiederherstellenVorschau(projektPfad, mB.id)).unterschiede).toEqual([])
  })

  it('hängt jede Zusammenführung an ihre beiden Eltern', async () => {
    const gitdir = gitOrdner(projektPfad)
    const ersteM = await git.readCommit({ fs, gitdir, oid: mA.id })
    const zweiteM = await git.readCommit({ fs, gitdir, oid: mB.id })
    expect(ersteM.commit.parent).toEqual([basis, sA.id])
    expect(zweiteM.commit.parent).toEqual([mA.id, sB.id])
  })

  it('wirft den Punkt der ersten Zusammenführung nicht weg', async () => {
    // Der Kern des Gegenlesens: Die zweite Zusammenführung erfüllt alle
    // Vorbedingungen fürs Vorziehen (gleicher Baum, gleiche Beschriftung) und
    // darf trotzdem nicht vorziehen — 'haupt' fiele sonst hinter mA zurück.
    expect(mB.neu).toBe(true)
    expect(mB.id).not.toBe(sB.id)
    expect(await letzterPunktId(projektPfad)).toBe(mB.id)
    expect(punkte.map((punkt) => punkt.id)).toContain(mA.id)
  })

  it('gibt dem später geöffneten Strang die Spitze von „haupt" als Basis', async () => {
    expect(offenC.ok).toBe(true)
    expect(offenC.id).toBe(mA.id)
    expect(offenC.id).not.toBe(basis)
    // Und der noch offene zweite Strang bleibt davon unberührt.
    expect(bWaehrendCOeffnet).toBe(sB.id)
  })

  it('zeigt jeden Punkt genau einmal, keinen Vorfahren vor seinem Nachfolger', async () => {
    const ids = punkte.map((punkt) => punkt.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Basis + zwei Strangpunkte + zwei Zusammenführungen.
    expect(ids.length).toBe(5)
    expect(punkte[punkte.length - 1].beschriftung).toBe('Stand vor dem Lauf')
    expect(await elternVerletzungen(punkte)).toEqual([])
  })

  it('räumt den offen gebliebenen dritten Strang beim nächsten Start weg', async () => {
    // Er hält nichts fest, was 'haupt' nicht längst kennt — also löschen, nicht
    // einholen, und der gemeinsame Stand bleibt, wo er ist.
    const aufgeraeumt = await straengeAufraeumen(projektPfad)
    expect(aufgeraeumt).toEqual({ ok: true, entfernt: 1, eingeholt: 0, behalten: 0 })
    expect(await letzterPunktId(projektPfad, 'strang/bauer-c')).toBe(null)
    expect(await letzterPunktId(projektPfad)).toBe(mB.id)
  })
})

describe('BAUPLAN 45 · Die Reihenfolge der Punkt-Liste hängt nicht an der Uhr', () => {
  // Nacharbeit Runde 1. Die frühere Prüfung hier lautete
  //   expect(zeiten).toEqual([...zeiten].sort((a, b) => b - a))
  // und verglich damit das Ergebnis der Sortierung mit sich selbst — eine
  // Tautologie, die unabhängig vom Verhalten grün war.
  //
  // Über die Uhr ist die Zusage nicht prüfbar: isomorphic-git schreibt
  // Zeitstempel sekundengenau, und ob zwei Punkte eines Laufs in dieselbe
  // Sekunde fallen, entscheidet der Zufall. Deshalb wird die Punkt-Kette hier
  // von Hand gesetzt, mit AUSDRÜCKLICHEN Zeitstempeln (git.commit nimmt
  // author/committer.timestamp), und die erwartete Reihenfolge steht als feste
  // Liste von Beschriftungen da.
  //
  // Rot vor Grün, gemessen am Stand vor dieser Nacharbeit: Bei gleicher Sekunde
  // lieferte sicherungspunkteLaden
  //   ['Block zwei fertig', 'Strang zwei', 'Stand vor dem Lauf',
  //    'Block eins fertig', 'Strang eins']
  // — der ÄLTESTE Punkt stand an dritter Stelle, vor zwei jüngeren. Eine
  // Sortierung nach Zeit kann das nicht richten, weil alle Zahlen gleich sind.
  const AUTOR = { name: 'FlowForge', email: 'flowforge@lokal' }

  // Die Verzweigung, die nach zwei gleichzeitigen Strängen entsteht:
  //   P0 ── S1 ─┐            (Strang eins)
  //    │        ├─ M1 ── M2  (Zusammenführungen auf 'haupt')
  //    └── S2 ──┘            (Strang zwei)
  async function ketteBauen(projektPfad, zeiten) {
    const gitdir = gitOrdner(projektPfad)
    await git.init({ fs, dir: projektPfad, gitdir, defaultBranch: 'haupt' })
    const baum = await git.writeTree({ fs, gitdir, tree: [] })
    const setzen = (nachricht, zeit, eltern) =>
      git.commit({
        fs,
        gitdir,
        ref: 'refs/heads/haupt',
        message: nachricht,
        tree: baum,
        parent: eltern,
        author: { ...AUTOR, timestamp: zeit, timezoneOffset: 0 },
        committer: { ...AUTOR, timestamp: zeit, timezoneOffset: 0 }
      })
    const p0 = await setzen('Stand vor dem Lauf', zeiten[0], [])
    const s1 = await setzen('Strang eins', zeiten[1], [p0])
    const s2 = await setzen('Strang zwei', zeiten[2], [p0])
    const m1 = await setzen('Block eins fertig', zeiten[3], [p0, s1])
    await setzen('Block zwei fertig', zeiten[4], [m1, s2])
    return { p0 }
  }

  it('ordnet bei verschiedenen Sekunden vom jüngsten zum ältesten', async () => {
    const projektPfad = projektAnlegen('reihenfolge-sekunden')
    await ketteBauen(projektPfad, [1000, 1001, 1002, 1003, 1004])
    const punkte = (await sicherungspunkteLaden(projektPfad)).punkte
    expect(punkte.map((p) => p.beschriftung)).toEqual([
      'Block zwei fertig',
      'Block eins fertig',
      'Strang zwei',
      'Strang eins',
      'Stand vor dem Lauf'
    ])
  })

  it('hält auch bei gleicher Sekunde — kein Vorfahr vor seinem Nachfolger', async () => {
    const projektPfad = projektAnlegen('reihenfolge-gleichstand')
    await ketteBauen(projektPfad, [1000, 1000, 1000, 1000, 1000])
    const punkte = (await sicherungspunkteLaden(projektPfad)).punkte
    // Bei Gleichstand entscheidet nicht mehr die Uhr, sondern der Aufbau: Ein
    // Punkt kommt erst dran, wenn alle Punkte, die auf ihm aufbauen, schon
    // dran waren. Unter den gleichzeitig bereiten gewinnt die
    // Wanderreihenfolge von git.log — das Ergebnis ist damit eindeutig statt
    // zufällig.
    expect(punkte.map((p) => p.beschriftung)).toEqual([
      'Block zwei fertig',
      'Strang zwei',
      'Block eins fertig',
      'Strang eins',
      'Stand vor dem Lauf'
    ])
  })

  it('entdoppelt, was git.log doppelt liefert', async () => {
    // Auch dieser Beleg steht jetzt auf festen Zeitstempeln: Mit echten
    // Sekundenabständen wandert git.log gemessen ohne Dopplung durch, und die
    // Zeile „git.log liefert mehr" wäre dann rot, ohne dass sich am Verhalten
    // etwas geändert hätte.
    const projektPfad = projektAnlegen('entdoppeln')
    const { p0 } = await ketteBauen(projektPfad, [1000, 1000, 1000, 1000, 1000])
    const roh = await git.log({ fs, gitdir: gitOrdner(projektPfad), ref: 'refs/heads/haupt' })
    expect(roh.filter((e) => e.oid === p0).length).toBeGreaterThan(1)
    const punkte = (await sicherungspunkteLaden(projektPfad)).punkte
    expect(punkte.filter((p) => p.id === p0).length).toBe(1)
    expect(punkte.length).toBe(5)
  })
})

describe('BAUPLAN 45 · Verwaiste Stränge aufräumen', () => {
  const projektPfad = projektAnlegen('aufraeumen')
  let basis = null

  beforeAll(async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    basis = await letzterPunktId(projektPfad)
    await strangOeffnen(projektPfad, 'abgestuerzt-1')
    await strangOeffnen(projektPfad, 'abgestuerzt-2')
  })

  it('entfernt die verwaisten Stränge und lässt „haupt" in Ruhe', async () => {
    const ergebnis = await straengeAufraeumen(projektPfad)
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.entfernt).toBe(2)
    expect(await letzterPunktId(projektPfad)).toBe(basis)
    expect(await letzterPunktId(projektPfad, 'abgestuerzt-1')).toBe(null)
  })

  it('ist beim zweiten Mal ein leerer Lauf', async () => {
    expect((await straengeAufraeumen(projektPfad)).entfernt).toBe(0)
  })
})

describe('BAUPLAN 45 · Ein unzusammengeführter Strang wird eingeholt, nicht weggeworfen', () => {
  // Nacharbeit Runde 1. Gemessener Mangel: Klemmte die Zusammenführung, blieb
  // der Blockende-Punkt auf dem Strang liegen und war von 'haupt' aus nicht
  // erreichbar — er stand in keiner Liste mehr. Das Aufräumen beim nächsten
  // Laufstart löschte dann den Ref und damit die letzte Spur.
  //
  // Nacharbeit Runde 3: Das bloße Stehenlassen war die halbe Antwort. Gemessen
  // wurde, dass ein nur auf einem Strang liegender Punkt in Georgs Liste
  // überhaupt nicht auftaucht — „behalten" hieß also: unsichtbar aufbewahrt.
  // Seither holt das Aufräumen ihn wirklich ein.
  //
  // Rot vor Grün: Vor Runde 1 meldete straengeAufraeumen hier entfernt=1 und
  // der Punkt war über keinen Weg mehr zu finden; vor Runde 3 meldete es
  // behalten=1, und der Punkt fehlte in sicherungspunkteLaden.
  const projektPfad = projektAnlegen('unzusammengefuehrt')
  let blockende = null
  let ergebnis = null

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    await strangOeffnen(projektPfad, 'strang/bauer-1')
    schreiben(projektPfad, 'src/app.js', 'gebaut\n')
    blockende = await sicherungspunktAnlegen(projektPfad, 'Nach Block „Bauer"', {
      strang: 'strang/bauer-1'
    })
    ergebnis = await straengeAufraeumen(projektPfad)
  })

  it('holt ihn ein, statt ihn wegzuwerfen oder unsichtbar aufzubewahren', () => {
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.entfernt).toBe(0)
    expect(ergebnis.eingeholt).toBe(1)
    expect(ergebnis.behalten).toBe(0)
  })

  it('stellt seinen Punkt damit in Georgs Liste', async () => {
    const punkte = (await sicherungspunkteLaden(projektPfad)).punkte
    expect(punkte.map((p) => p.id)).toContain(blockende.id)
    // Und kein Doppel: Der Ordner stand noch genau auf diesem Punkt, also wird
    // 'haupt' vorgezogen statt ein zweiter Eintrag mit demselben Stand angelegt.
    expect(punkte.map((p) => p.beschriftung)).toEqual(['Nach Block „Bauer"', 'Stand vor dem Lauf'])
  })

  it('räumt den Ref dabei weg und ist beim zweiten Mal ein leerer Lauf', async () => {
    expect(await letzterPunktId(projektPfad, 'strang/bauer-1')).toBe(null)
    const nochmal = await straengeAufraeumen(projektPfad)
    expect(nochmal.entfernt).toBe(0)
    expect(nochmal.eingeholt).toBe(0)
    expect(nochmal.behalten).toBe(0)
  })
})

describe('BAUPLAN 45 · Ein behaltener Strang überlebt den nächsten Laufstart', () => {
  // Nacharbeit Runde 3. Gemessener Mangel (Prüfer-Fall M4-A): Der Laufstart
  // meldete „ein Sicherungsstrang hält noch Arbeit fest … er bleibt deshalb
  // erhalten" — und Sekunden später öffnete derselbe Block seinen Strang
  // erneut. Der Name kommt aus der stabilen Instanz-Kennung, ist also
  // buchstäblich derselbe; git.branch mit force setzte den Ref auf die Spitze
  // von 'haupt', und der gerettete Punkt hing danach an keinem Ref mehr. Die
  // Aufbewahrung nützte Georg zu keinem Zeitpunkt etwas: Solange der Strang
  // nicht eingeholt war, stand sein Punkt ohnehin in keiner Liste.
  //
  // Rot vor Grün, so gemessen (Stand vor dieser Nacharbeit,
  // `npx vitest run pruefungen/sicherungsstraenge.test.js -t "überlebt"`):
  //   × holt den Strang beim Aufräumen ein, statt ihn nur zu behalten
  //     AssertionError: expected undefined to be 1   (eingeholt gab es nicht)
  //   × zeigt den geretteten Punkt in Georgs Liste
  //     AssertionError: expected [ 'Stand vor dem Lauf' ] to contain 'Nach …'
  //   × lässt ihn auch nach dem Neu-Öffnen desselben Strangs erreichbar
  const projektPfad = projektAnlegen('behalten-ueberlebt')
  let blockende = null
  let aufgeraeumt = null

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    await strangOeffnen(projektPfad, 'strang/bauer-1')
    schreiben(projektPfad, 'src/app.js', 'gebaut\n')
    blockende = await sicherungspunktAnlegen(projektPfad, 'Nach Block „Bauer"', {
      strang: 'strang/bauer-1'
    })
    // Genau der Ablauf des nächsten Laufstarts: erst aufräumen, dann öffnet
    // derselbe Block (gleiche Instanz-Kennung, gleicher Strangname) neu.
    aufgeraeumt = await straengeAufraeumen(projektPfad)
    await strangOeffnen(projektPfad, 'strang/bauer-1')
  })

  it('holt den Strang beim Aufräumen ein, statt ihn nur zu behalten', () => {
    expect(aufgeraeumt.ok).toBe(true)
    expect(aufgeraeumt.eingeholt).toBe(1)
    expect(aufgeraeumt.behalten).toBe(0)
    expect(aufgeraeumt.entfernt).toBe(0)
  })

  it('zeigt den geretteten Punkt in Georgs Liste', async () => {
    const punkte = (await sicherungspunkteLaden(projektPfad)).punkte
    expect(punkte.map((p) => p.id)).toContain(blockende.id)
  })

  it('lässt ihn auch nach dem Neu-Öffnen desselben Strangs erreichbar', async () => {
    // Der Kern des Befunds: Das force in strangOeffnen darf nichts abschneiden.
    const punkte = (await sicherungspunkteLaden(projektPfad)).punkte
    expect(punkte.map((p) => p.beschriftung)).toContain('Nach Block „Bauer"')
    // Und der neu geöffnete Strang steht wirklich auf der Spitze von 'haupt'.
    expect(await letzterPunktId(projektPfad, 'strang/bauer-1')).toBe(
      await letzterPunktId(projektPfad)
    )
  })
})

describe('BAUPLAN 45 · Einholen, wenn „haupt" inzwischen weitergezogen ist', () => {
  // Der Ablauf des echten Laufstarts, in seiner echten Reihenfolge: lauf.js
  // legt ZUERST „Stand vor dem Lauf" auf 'haupt' an und räumt DANACH die
  // Stränge auf. 'haupt' ist damit schon an der Verzweigung vorbei, und das
  // Vorziehen aus dem Fall darüber greift nicht mehr — es muss der Punkt mit
  // zwei Eltern sein. Gemessen wird hier, dass der gerettete Punkt auch auf
  // diesem Weg in Georgs Liste ankommt.
  const projektPfad = projektAnlegen('haupt-weitergezogen')
  let blockende = null
  let ergebnis = null
  let punkte = []

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor Lauf 1')
    await strangOeffnen(projektPfad, 'strang/bauer-1')
    schreiben(projektPfad, 'src/app.js', 'gebaut\n')
    blockende = await sicherungspunktAnlegen(projektPfad, 'Nach Block „Bauer"', {
      strang: 'strang/bauer-1'
    })
    // Abbruch ohne Zusammenführung. Der nächste Lauf beginnt wie immer mit
    // seinem eigenen Punkt auf 'haupt' — erst danach wird aufgeräumt.
    await sicherungspunktAnlegen(projektPfad, 'Stand vor Lauf 2')
    ergebnis = await straengeAufraeumen(projektPfad)
    punkte = (await sicherungspunkteLaden(projektPfad)).punkte
  })

  it('holt ihn auch dann ein', () => {
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.eingeholt).toBe(1)
    expect(ergebnis.behalten).toBe(0)
  })

  it('macht den geretteten Punkt in Georgs Liste erreichbar', () => {
    expect(punkte.map((p) => p.id)).toContain(blockende.id)
  })

  it('hängt ihn als zweiten Elternteil an den gemeinsamen Stand', async () => {
    const spitze = await letzterPunktId(projektPfad)
    const punkt = await git.readCommit({ fs, gitdir: gitOrdner(projektPfad), oid: spitze })
    expect(punkt.commit.parent).toHaveLength(2)
    expect(punkt.commit.parent[1]).toBe(blockende.id)
  })

  it('erbt dabei die Beschriftung des geretteten Punkts', () => {
    // Ehrliche Grenze, damit sie niemanden überrascht: Auf diesem Weg trägt der
    // gemeinsame Punkt denselben Satz wie der gerettete — Georg liest ihn also
    // zweimal, mit zwei verschiedenen Ständen dahinter. Geerbt wird trotzdem,
    // und zwar mit Absicht: Steht der Ordner noch genau auf dem Strangpunkt
    // (der Fall eine Prüfung weiter oben), zieht dieselbe Beschriftung 'haupt'
    // vor und erspart den zweiten Eintrag ganz. Einen Haken für einen eigenen
    // Rettungs-Satz gibt es deshalb ausdrücklich nicht: Ein anderer Satz
    // hebelte das Vorziehen aus und erzwänge je Rettung genau das Doppel, das
    // SPEC §3.3 abschafft.
    expect(punkte).toHaveLength(4)
    expect(punkte[0].beschriftung).toBe('Nach Block „Bauer"')
    expect(punkte.filter((p) => p.beschriftung === 'Nach Block „Bauer"')).toHaveLength(2)
  })
})

describe('BAUPLAN 45 · Klemmt das Einholen, wird der Strang nicht überschrieben', () => {
  // Die Kehrseite: Gelingt die Rettung nicht, ist „behalten" wieder die
  // Wahrheit — dann darf aber auch das Öffnen nicht mit force darüberfahren.
  // Lieber ein Block ohne eigenen Strang (der Lauf sagt das im Ticker) als ein
  // abgeschnittener Punkt.
  //
  // Rot vor Grün, so gemessen: `strangOeffnen` gab vorher { ok: true } zurück
  //   und letzterPunktId(pfad, 'strang/bauer-1') war danach die Spitze von
  //   'haupt' statt des Blockende-Punkts.
  const projektPfad = projektAnlegen('rettung-klemmt')
  let blockende = null

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'alt\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
    await strangOeffnen(projektPfad, 'strang/bauer-1')
    schreiben(projektPfad, 'src/app.js', 'gebaut\n')
    blockende = await sicherungspunktAnlegen(projektPfad, 'Nach Block „Bauer"', {
      strang: 'strang/bauer-1'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('zählt ihn als behalten und lässt den Ref stehen', async () => {
    // Der Fehlschlag wird echt herbeigeführt: Steht der Ordner noch genau auf
    // dem Strangpunkt, zieht die Zusammenführung 'haupt' per writeRef vor —
    // das ist hier die Stelle, an der es klemmen kann.
    vi.spyOn(git, 'writeRef').mockRejectedValue(new Error('Ref klemmt'))
    const ergebnis = await straengeAufraeumen(projektPfad)
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.eingeholt).toBe(0)
    expect(ergebnis.behalten).toBe(1)
    vi.restoreAllMocks()
    expect(await letzterPunktId(projektPfad, 'strang/bauer-1')).toBe(blockende.id)
  })

  it('öffnet den Strang lieber gar nicht, als ihn abzuschneiden', async () => {
    vi.spyOn(git, 'writeRef').mockRejectedValue(new Error('Ref klemmt'))
    const geoeffnet = await strangOeffnen(projektPfad, 'strang/bauer-1')
    expect(geoeffnet.ok).toBe(false)
    expect(geoeffnet.fehler).toBe(texte.sicherungen.fehlerStrangOeffnen)
    vi.restoreAllMocks()
    expect(await letzterPunktId(projektPfad, 'strang/bauer-1')).toBe(blockende.id)
  })
})

describe('BAUPLAN 45 · Der Arbeitsordner bleibt unangetastet', () => {
  const projektPfad = projektAnlegen('ordner')

  it('verändert bei Strang-Anlage und Zusammenführung keine einzige Datei', async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    schreiben(projektPfad, 'unterordner/hilfe.js', 'hilft\n')
    schreiben(projektPfad, 'pruefung/p1/test.js', 'pruefe\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')

    const vorStrang = ordnerAbbild(projektPfad)
    await strangOeffnen(projektPfad, 'bauer')
    expect(ordnerAbbild(projektPfad)).toEqual(vorStrang)

    schreiben(projektPfad, 'app.js', 'ZWEI\n')
    const vorPunkt = ordnerAbbild(projektPfad)
    await sicherungspunktAnlegen(projektPfad, 'Teilstück', { strang: 'bauer' })
    expect(ordnerAbbild(projektPfad)).toEqual(vorPunkt)

    await strangZusammenfuehren(projektPfad, 'bauer', 'Block fertig')
    expect(ordnerAbbild(projektPfad)).toEqual(vorPunkt)
  })
})

describe('BAUPLAN 45 · Diff auf den eigenen Wirkbereich', () => {
  const projektPfad = projektAnlegen('wirkbereich')
  let vorher = null
  let nachher = null

  beforeAll(async () => {
    schreiben(projektPfad, 'src/app.js', 'eins\n')
    schreiben(projektPfad, 'src/andere.js', 'eins\n')
    schreiben(projektPfad, 'doku.md', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Block')
    vorher = await letzterPunktId(projektPfad)
    schreiben(projektPfad, 'src/app.js', 'ZWEI\n')
    schreiben(projektPfad, 'src/andere.js', 'ZWEI\n')
    schreiben(projektPfad, 'doku.md', 'ZWEI\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand nach dem Block')
    nachher = await letzterPunktId(projektPfad)
  })

  it('zeigt ohne Dateiliste alles und meldet nichts als weggefallen', async () => {
    const vergleich = await punkteVergleichen(projektPfad, vorher, nachher)
    expect(vergleich.dateien.map((d) => d.pfad)).toEqual(['doku.md', 'src/andere.js', 'src/app.js'])
    expect(vergleich.ausserhalb).toBe(0)
  })

  it('filtert auf die eigene Dateiliste und zählt das Weggefallene', async () => {
    const vergleich = await punkteVergleichen(projektPfad, vorher, nachher, {
      nurDateien: ['src/app.js']
    })
    expect(vergleich.ok).toBe(true)
    expect(vergleich.dateien.map((d) => d.pfad)).toEqual(['src/app.js'])
    expect(vergleich.ausserhalb).toBe(2)
  })

  it('nimmt einen Ordner-Eintrag als ganzen Bereich', async () => {
    const vergleich = await punkteVergleichen(projektPfad, vorher, nachher, { nurDateien: ['src'] })
    expect(vergleich.dateien.map((d) => d.pfad)).toEqual(['src/andere.js', 'src/app.js'])
    expect(vergleich.ausserhalb).toBe(1)
  })

  it('kann eine Prüfmappe nicht in den Diff zurückholen', async () => {
    // Ehrliche Grenze, damit sie niemanden überrascht: Die Prüfmappe ist seit
    // BAUPLAN 34 grundsätzlich vom Diff ausgenommen (die Prüfer-Tests liegen
    // beim Rückführen uncommittet im Ordner und wanderten sonst als
    // „Bauer-Änderung" mit). Dieser Ausschluss greift VOR dem Wirkbereich —
    // wer einen Prüfordner als nurDateien übergibt, bekommt darum nichts,
    // und alles andere zählt als weggefiltert.
    schreiben(projektPfad, 'pruefung/p1/test.js', 'pruefe\n')
    await sicherungspunktAnlegen(projektPfad, 'Prüfmappe angelegt')
    const mitMappe = await letzterPunktId(projektPfad)
    const vergleich = await punkteVergleichen(projektPfad, nachher, mitMappe, {
      nurDateien: ['pruefung/p1/']
    })
    expect(vergleich.dateien).toEqual([])
  })

  it('rechnet die Schreibweisen der Dateiliste um, statt Text zu vergleichen', async () => {
    // git.walk liefert „src/app.js"; die Liste kommt als Modelltext und trägt
    // mal Rückwärts-Schrägstriche, mal ein führendes „/" für „relativ zum
    // Projektordner". Ein liste.includes(pfad) träfe hier nichts.
    for (const eintrag of ['src\\app.js', '/src/app.js', './src/app.js']) {
      const vergleich = await punkteVergleichen(projektPfad, vorher, nachher, {
        nurDateien: [eintrag]
      })
      expect(vergleich.dateien.map((d) => d.pfad)).toEqual(['src/app.js'])
    }
  })
})

describe('BAUPLAN 45 · Klemmt ein Strang, sagt der Fehler die Wahrheit über den Lauf', () => {
  // Nacharbeit Runde 2. Gemessener Mangel: Beide catch-Zweige gaben
  // texte.sicherungen.fehlerAnlegen zurück — „Der Lauf wurde sicherheitshalber
  // nicht gestartet". Mitten im Lauf ist dieser Satz schlicht falsch; die eigens
  // dafür angelegten Texte kamen im ganzen Hauptprozess an keiner Stelle vor.
  //
  // Gemessen wird deshalb der RÜCKGABEWERT bei erzwungenem Fehlschlag, nicht die
  // Wortwahl der Konstante: Die Prüfung, die das abdecken sollte, las nur
  // texte.js und war grün, während der falsche Satz ausgeliefert wurde. Eine
  // Prüfung, die den Code nie anfasst, sichert auch nichts zu.
  //
  // Rot vor Grün, so gemessen: Beide catch-Zweige in sicherungspunkte.js wurden
  // versuchsweise auf fehlerAnlegen zurückgesetzt, dann
  // `npx vitest run pruefungen/sicherungsstraenge.test.js -t "Klemmt ein Strang"`:
  //   × meldet beim Öffnen den Strang-Text, nicht den vom Laufstart
  //   × meldet beim Zusammenführen den eigenen Text und lässt den Strang stehen
  //   AssertionError: expected 'Der Sicherungspunkt konnte nicht ange…'
  //   to be 'Der eigene Sicherungsstrang für diesen Block…'
  const projektPfad = projektAnlegen('fehlertexte')

  beforeAll(async () => {
    schreiben(projektPfad, 'app.js', 'eins\n')
    await sicherungspunktAnlegen(projektPfad, 'Stand vor dem Lauf')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('meldet beim Öffnen den Strang-Text, nicht den vom Laufstart', async () => {
    // Der Fehlschlag wird echt herbeigeführt, statt ihn anzunehmen: git.branch
    // ist genau die Stelle, an der ein Strang klemmen kann.
    vi.spyOn(git, 'branch').mockRejectedValue(new Error('Strang klemmt'))
    const ergebnis = await strangOeffnen(projektPfad, 'klemmt-1')
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehler).toBe(texte.sicherungen.fehlerStrangOeffnen)
    expect(ergebnis.fehler).not.toMatch(/nicht gestartet/)
  })

  it('meldet beim Zusammenführen den eigenen Text und lässt den Strang stehen', async () => {
    await strangOeffnen(projektPfad, 'klemmt-2')
    schreiben(projektPfad, 'app.js', 'ZWEI\n')
    const aufStrang = await sicherungspunktAnlegen(projektPfad, 'Teilstück', { strang: 'klemmt-2' })
    expect(aufStrang.neu).toBe(true)

    vi.spyOn(git, 'commit').mockRejectedValue(new Error('Zusammenführung klemmt'))
    const ergebnis = await strangZusammenfuehren(projektPfad, 'klemmt-2', 'Nach Block „Bauer"')
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehler).toBe(texte.sicherungen.fehlerStrangZusammenfuehren)
    expect(ergebnis.fehler).not.toMatch(/nicht gestartet/)

    // Und die Zusage, die daran hängt: Der Blockende-Punkt ist nicht verloren —
    // ein zweiter Anlauf findet den Strang noch (siehe straengeAufraeumen).
    vi.restoreAllMocks()
    expect(await letzterPunktId(projektPfad, 'klemmt-2')).toBe(aufStrang.id)
  })
})
