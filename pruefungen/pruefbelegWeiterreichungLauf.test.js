// Prüfbeleg-Weiterreichung im ECHTEN Lauf (0.46.2) — gemessen am Ablaufplaner
// mit Motor-Ersatz (Muster aus welle.test.js): Der Auftrag, den jeder Block
// tatsächlich bekommt, und der Ticker sind echt; nur Motor, Rauchtest, Späher
// und Karten sind Attrappe.
//
// Rot-vor-Grün: Vor 0.46.2 bekam das Zweitaudit keinen Prüfbeleg in seinen
// Auftrag (der Katalog-Prüfer nahm das Etikett nicht), das Sessionende bekam
// BEIDE Belege (erster Prüfer und Zweitaudit gleich nah — Distanz-Regel), und
// die Ticker-Zeile uebergabeWeiterverarbeitet gab es nicht.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const steuerung = vi.hoisted(() => ({ bauen: null }))
vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async () => ({ geprueft: false, gruen: null, code: null, ausgabe: '', grund: 'keine' })
}))
vi.mock('../src/main/prozesse.js', async (importOriginal) => ({
  ...(await importOriginal()),
  prozessgruppeAnlegen: () => {},
  prozessgruppeAbraeumen: async () => ({ beendet: [], uebrig: [] })
}))
vi.mock('../src/main/startanleitung.js', async (importOriginal) => ({
  ...(await importOriginal()),
  startanleitungVorhanden: () => true
}))
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: [] })
}))

import { laufStarten } from '../src/main/lauf.js'
import { meldungPruefen } from '../src/shared/lieferschein.js'
import { pruefbefehlSetzen } from '../src/main/pruefbefehl.js'
import { texte } from '../src/shared/texte.js'

const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }
const bezeichnung = texte.ticker.blockBezeichnung

function motorErsatz(ergebnisFuer) {
  const wartend = new Map()
  const auftraege = new Map() // instanzId → Auftragstext des letzten Anlaufs
  steuerung.bauen = (optionen) => ({
    sessionKennung: null,
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      auftraege.set(block.instanzId, block.auftrag)
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, async () => {
          const meldungen = await ergebnisFuer(block, optionen)
          aufloesen({
            zustand: 'erfolgreich',
            ergebnisText: '',
            meldungen,
            fehlertext: '',
            fehlerArt: null,
            verbrauch: null
          })
        })
      })
    }
  })
  return {
    auftraege,
    async freigeben(instanzId) {
      const bis = Date.now() + 8000
      while (!wartend.has(instanzId) && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      const los = wartend.get(instanzId)
      if (!los) throw new Error('Block nie gestartet: ' + instanzId)
      wartend.delete(instanzId)
      await los()
    }
  }
}

function fensterErsatz() {
  const ereignisse = []
  return {
    ereignisse,
    fenster: {
      isDestroyed: () => false,
      isFocused: () => true,
      webContents: { send: (_kanal, daten) => ereignisse.push(daten) }
    },
    ticker: () => ereignisse.filter((e) => e.art === 'ticker').map((e) => e.text),
    async warteAuf(pruefung, was = 'Ereignis') {
      const bis = Date.now() + 10000
      while (!pruefung() && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      if (!pruefung()) throw new Error('Nicht eingetreten: ' + was)
    }
  }
}

function gitOrdner(projektPfad) {
  const schluessel = crypto
    .createHash('sha1')
    .update(path.resolve(projektPfad).toLowerCase())
    .digest('hex')
  return path.join(os.tmpdir(), 'flowforge-git', schluessel)
}
function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-weiterreichung-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.rmSync(gitOrdner(wurzel), { recursive: true, force: true })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}
let schreibSchritt = 0
function schreiben(wurzel, relativ, inhalt) {
  const ziel = path.join(wurzel, relativ)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, inhalt, 'utf8')
  const spaeter = new Date(Date.now() + 5000 + ++schreibSchritt * 1000)
  fs.utimesSync(ziel, spaeter, spaeter)
}

function paketMeldung(block, liste) {
  const pakete = block.ziele.map((ziel) => ({
    zielBlock: ziel.adresse,
    ziel: 'Teil ' + ziel.name,
    fertigKriterien: ['Läuft.'],
    erlaubteDateien: liste
  }))
  const ergebnis = meldungPruefen('arbeitspaket', { ...rahmen, pakete }, 'Arbeitspaket', {
    ziele: block.ziele
  })
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}
function pruefMeldung(fazit) {
  const ergebnis = meldungPruefen(
    'pruefbeleg',
    { ...rahmen, fazit, urteil: 'bestanden', beanstandungen: [], rotVorGruen: '', geprueft: [] },
    'Prüfbeleg'
  )
  if (ergebnis.fehler) throw new Error(ergebnis.fehler)
  return [ergebnis.meldung]
}

describe('0.46.2 · Prüfer → Zweitaudit → Sessionende im Lauf', () => {
  // Paket schneiden → Bauer → Prüfer · Erst → Prüfer · Zweitaudit → Sessionende,
  // und der erste Prüfer liegt ZUSÄTZLICH direkt vor dem Sessionende — dort
  // wären beide Belege gleich nah, die Distanz allein ließe beide durch.
  const projekt = frischesProjekt('kette')
  const bloecke = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Ein Teil' } },
    { instanzId: 'b', blockId: 'bauer', zusatz: '' },
    { instanzId: 'pe', blockId: 'pruefer', zusatz: 'Erst' },
    { instanzId: 'z', blockId: 'pruefer', zusatz: 'Zweitaudit' },
    { instanzId: 's', blockId: 'sessionende', zusatz: '' }
  ]
  const pfeile = [
    { von: 'p', nach: 'b' },
    { von: 'b', nach: 'pe' },
    { von: 'pe', nach: 'z' },
    { von: 'z', nach: 's' },
    { von: 'pe', nach: 's' }
  ]
  let sicht
  let motor

  beforeAll(async () => {
    fs.writeFileSync(
      path.join(projekt, 'workflow.json'),
      JSON.stringify({ reparaturRunden: 0, uebertragGrenze: 5, bloecke, pfeile }),
      'utf8'
    )
    schreiben(projekt, 'src/x.js', 'alt\n')
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        return paketMeldung(block, ['src/'])
      }
      if (block.instanzId === 'b') {
        schreiben(projekt, 'src/neu.js', 'gebaut\n')
        return [meldungPruefen('umsetzungsbericht', { ...rahmen }, 'Umsetzungsbericht').meldung]
      }
      if (block.instanzId === 'pe' || block.instanzId === 'z') {
        schreiben(projekt, 'pruefung/' + block.pruefOrdner + '/probe.test.js', 'test\n')
        pruefbefehlSetzen(projekt, block.instanzId, 'npm test')
        return pruefMeldung(block.instanzId === 'pe' ? 'Erstprüfung bestanden.' : 'Zweitaudit bestanden.')
      }
      return [meldungPruefen('rahmen', { ...rahmen }, null).meldung]
    })
    sicht = fensterErsatz()
    const start = await laufStarten(sicht.fenster, projekt, [], null, false, null)
    expect(start).toEqual({ ok: true })
    await motor.freigeben('p')
    await motor.freigeben('b')
    await motor.freigeben('pe')
    await motor.freigeben('z')
    await motor.freigeben('s')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  // Die Übergabe-Überschrift, wie der Lieferschein sie setzt; der Text darunter
  // ist der aufbereitete Beleg (Fazit, Urteil …) — geprüft wird nur das Fazit.
  const ueberschrift = (blockName) =>
    texte.agentenUebergabe.eintrag('Prüfbeleg', blockName, '').split('\n')[0]

  it('das Zweitaudit bekommt den Beleg des ersten Prüfers in den Auftrag — als optionale Übergabe', () => {
    const auftrag = motor.auftraege.get('z')
    expect(auftrag).toContain(ueberschrift('Prüfer · Erst'))
    expect(auftrag).toContain('Erstprüfung bestanden.')
  })

  it('der Vorspann des ersten Prüfers nennt das Zweitaudit als Empfänger seines Belegs', () => {
    const auftrag = motor.auftraege.get('pe')
    expect(auftrag).toContain(bezeichnung(4, 'Prüfer · Zweitaudit'))
    expect(auftrag).toContain('Prüfbeleg')
  })

  it('das Sessionende bekommt NUR den Beleg des Zweitaudits — der erste ist eingegangen', () => {
    const auftrag = motor.auftraege.get('s')
    expect(auftrag).toContain(ueberschrift('Prüfer · Zweitaudit'))
    expect(auftrag).toContain('Zweitaudit bestanden.')
    expect(auftrag).not.toContain(ueberschrift('Prüfer · Erst'))
    expect(auftrag).not.toContain('Erstprüfung bestanden.')
    // Und nicht als „(1 von 2)" nummeriert — es ist genau einer.
    expect(auftrag).not.toContain('Prüfbeleg (1 von 2)')
    expect(auftrag).not.toContain('Prüfbeleg (2 von 2)')
  })

  it('der Ticker sagt, warum — einmal, mit dem Weiterverarbeitungs-Wortlaut, nicht „näher im Schaubild"', () => {
    const zeilen = sicht.ticker()
    const erwartet = texte.ticker.uebergabeWeiterverarbeitet(
      'Prüfbeleg',
      bezeichnung(3, 'Prüfer · Erst'),
      bezeichnung(4, 'Prüfer · Zweitaudit'),
      bezeichnung(5, 'Sessionende'),
      bezeichnung(4, 'Prüfer · Zweitaudit')
    )
    expect(zeilen.filter((z) => z === erwartet)).toHaveLength(1)
    expect(zeilen.some((z) => z.includes('näher im Schaubild') && z.includes('Prüfbeleg'))).toBe(false)
  })

  it('der Lauf endet erfolgreich', () => {
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    expect(ende.zustand).toBe('erfolgreich')
  })
})
