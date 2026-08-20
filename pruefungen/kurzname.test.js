// Automatische Laufzeit-Zusatznamen aus dem Zuschnitt (Zwischenschritt 0.51.1,
// Wunsch Georg). Georgs Beschwerde aus dem Life-OS-Lauf vom 20.08.2026 lautete
// wörtlich: „„Bauer" wartet, bis „Bauer" fertig ist" — zwei unbenannte gleiche
// Blöcke sind im Ticker nicht auseinanderzuhalten. Wer das Paket schneidet,
// weiß am besten, wonach er geschnitten hat, und gibt dem Ziel deshalb einen
// Kurznamen mit; FlowForge heftet ihn NUR für den Lauf an die Ziel-Instanz.
//
// Gemessen wird Verhalten, nicht Quelltext: Die Melde-Ebene läuft als reine
// Rechnung (meldungPruefen), das Anheften am echten Ablaufplaner mit
// Motor-Ersatz (Muster: welle.test.js, lokalerPoolLauf.test.js).
//
// Rot vor Grün: Vor diesem Schritt kannte das Schema kein Feld kurzname, die
// Prüfebene forderte keines, und knoten.name entstand EINMAL beim Kettenaufbau
// — jede Prüfung hier wäre rot gewesen.
import { describe, it, expect, vi, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const steuerung = vi.hoisted(() => ({ bauen: null }))
vi.mock('../src/main/motor/claudeCodeMotor.js', async (importOriginal) => ({
  ...(await importOriginal()),
  starteLaufMotor: (optionen) => steuerung.bauen(optionen)
}))
vi.mock('../src/main/torProzess.js', async (importOriginal) => ({
  ...(await importOriginal()),
  rauchtest: async () => ({ geprueft: true, gruen: true })
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
import { meldungPruefen, zuschnitteAusMeldung } from '../src/shared/lieferschein.js'
import { zielListe, laufstandPasst } from '../src/shared/kettenRegeln.js'
import { ZUSATZNAME_MAX } from '../src/shared/blockKatalog.js'
import { texte } from '../src/shared/texte.js'

const tl = texte.lieferschein
const rahmen = { fazit: 'Erledigt.', getan: [], offen: [], anmerkung: '' }

// ——— Ebene 2: Pflicht genau dann, wenn das Paket adressiert ist ——————————————

describe('0.51.1 · Der Kurzname ist Pflicht, sobald ein Paket sein Ziel benennt', () => {
  const bloecke = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Zwei Teile' } },
    { instanzId: 'b1', blockId: 'bauer', zusatz: '' },
    { instanzId: 'b2', blockId: 'bauer', zusatz: '' }
  ]
  const pfeile = [
    { von: 'p', nach: 'b1' },
    { von: 'p', nach: 'b2' }
  ]
  const ziele = zielListe(bloecke, pfeile, 'p')
  const paket = (zielBlock, kurzname, erlaubteDateien) => ({
    zielBlock,
    kurzname,
    ziel: 'Etwas bauen',
    fertigKriterien: ['Läuft.'],
    erlaubteDateien
  })
  const melden = (pakete, umfeld = { ziele }) =>
    meldungPruefen('arbeitspaket', { ...rahmen, pakete }, 'Arbeitspaket', umfeld)

  it('nimmt ein adressiertes Paket MIT Kurzname an und merkt ihn sich', () => {
    const ergebnis = melden([
      paket(ziele[0].adresse, 'Server-Briefing', ['src/a/']),
      paket(ziele[1].adresse, 'Ticker-Anzeige', ['src/b/'])
    ])
    expect(ergebnis.fehler).toBeUndefined()
    const zuschnitte = zuschnitteAusMeldung(ergebnis.meldung)
    expect(zuschnitte.map((z) => z.kurzname)).toEqual(['Server-Briefing', 'Ticker-Anzeige'])
  })

  it('weist ein adressiertes Paket OHNE Kurzname ab — in Klartext, mit dem Weg heraus', () => {
    const ergebnis = melden([
      paket(ziele[0].adresse, '', ['src/a/']),
      paket(ziele[1].adresse, 'Ticker-Anzeige', ['src/b/'])
    ])
    expect(ergebnis.fehler).toBe(tl.paketFehler(1, tl.kurznameFehlt(ziele[0].bezeichnung)))
    expect(ergebnis.fehler).toContain('kurzname')
    expect(ergebnis.fehler).toContain('2–3 Wörter')
  })

  it('verlangt beim adresslosen Paket keinen Kurznamen — verwendet ihn aber, wenn er da ist', () => {
    const einZiel = [ziele[0]]
    const ohne = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [{ ziel: 'Alles', fertigKriterien: ['Läuft.'] }] },
      'Arbeitspaket',
      { ziele: einZiel }
    )
    expect(ohne.fehler).toBeUndefined()
    expect(zuschnitteAusMeldung(ohne.meldung)[0].kurzname).toBe('')
    const mit = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [{ ziel: 'Alles', kurzname: 'Erster Wurf', fertigKriterien: ['Läuft.'] }] },
      'Arbeitspaket',
      { ziele: einZiel }
    )
    expect(mit.fehler).toBeUndefined()
    expect(zuschnitteAusMeldung(mit.meldung)[0].kurzname).toBe('Erster Wurf')
  })

  it('deckelt den Kurznamen auf die Länge des Zusatznamens und räumt Leerraum weg', () => {
    const lang = 'Ein  viel   zu langer Kurzname für eine Blockkarte'
    const ergebnis = melden([
      paket(ziele[0].adresse, lang, ['src/a/']),
      paket(ziele[1].adresse, '  Ticker-Anzeige  ', ['src/b/'])
    ])
    expect(ergebnis.fehler).toBeUndefined()
    const zuschnitte = zuschnitteAusMeldung(ergebnis.meldung)
    expect(zuschnitte[0].kurzname).toHaveLength(ZUSATZNAME_MAX)
    expect(zuschnitte[0].kurzname).toBe('Ein viel zu langer Kurzname für'.slice(0, ZUSATZNAME_MAX))
    expect(zuschnitte[1].kurzname).toBe('Ticker-Anzeige')
  })

  it('lässt Prüfskripte ohne Zielliste unberührt — ohne zielBlock kein Zwang', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [{ ziel: 'Alles', fertigKriterien: ['Läuft.'] }] },
      'Arbeitspaket',
      null
    )
    expect(ergebnis.fehler).toBeUndefined()
  })
})

// ——— Der Ablaufplaner mit Motor-Ersatz ———————————————————————————————————————

function motorErsatz(ergebnisFuer) {
  const wartend = new Map()
  const gestartet = []
  steuerung.bauen = (optionen) => ({
    sessionKennung: null,
    tokens: 0,
    istTot: () => false,
    beenden() {},
    hartStoppen() {},
    blockAusfuehren(block) {
      gestartet.push(block.instanzId)
      return new Promise((aufloesen) => {
        wartend.set(block.instanzId, async () => {
          aufloesen({
            zustand: 'erfolgreich',
            ergebnisText: '',
            meldungen: await ergebnisFuer(block, optionen),
            fehlertext: '',
            fehlerArt: null,
            verbrauch: null
          })
        })
      })
    }
  })
  return {
    gestartet,
    async freigeben(instanzId) {
      const bis = Date.now() + 5000
      while (!wartend.has(instanzId) && Date.now() < bis)
        await new Promise((r) => setTimeout(r, 10))
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
      const bis = Date.now() + 8000
      while (!pruefung() && Date.now() < bis) await new Promise((r) => setTimeout(r, 10))
      if (!pruefung()) throw new Error('Nicht eingetreten: ' + was)
    }
  }
}

function frischesProjekt(name) {
  const wurzel = path.join(os.tmpdir(), `flowforge-kurzname-${name}-${process.pid}`)
  fs.rmSync(wurzel, { recursive: true, force: true })
  fs.mkdirSync(wurzel, { recursive: true })
  return wurzel
}

function workflowSchreiben(projekt, bloecke, pfeile) {
  fs.writeFileSync(
    path.join(projekt, 'workflow.json'),
    JSON.stringify({ reparaturRunden: 0, uebertragGrenze: 5, bloecke, pfeile }),
    'utf8'
  )
}

function umsetzungsMeldung() {
  return [meldungPruefen('umsetzungsbericht', { ...rahmen }, 'Umsetzungsbericht').meldung]
}

// ——— Das Anheften im Lauf ————————————————————————————————————————————————————

describe('0.51.1 · Der Kurzname wird zum Zusatznamen der Ziel-Instanz — nur für den Lauf', () => {
  // Paket schneiden → drei Bauer: b1 ohne Namen, b2 mit Georgs Karten-Namen,
  // b3 ohne Namen und mit DEMSELBEN Kurznamen wie b1 (die Dopplung). Daneben
  // eine zweite Auftragsquelle p2, die b1 später NOCH einmal benennen will —
  // sie kommt zu spät.
  const projekt = frischesProjekt('anheften')
  const bloecke = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Drei Teile' } },
    { instanzId: 'b1', blockId: 'bauer', zusatz: '' },
    { instanzId: 'b2', blockId: 'bauer', zusatz: 'Georgs Name' },
    { instanzId: 'b3', blockId: 'bauer', zusatz: '' },
    { instanzId: 'p2', blockId: 'paket-schneiden', zusatz: 'Zweite Quelle', feldWerte: { wunsch: 'Teil eins genauer' } }
  ]
  const pfeile = [
    { von: 'p', nach: 'b1' },
    { von: 'p', nach: 'b2' },
    { von: 'p', nach: 'b3' },
    { von: 'p2', nach: 'b1' }
  ]
  const kurzNamen = {
    p: { b1: 'Server-Briefing', b2: 'Egal', b3: 'Server-Briefing' },
    p2: { b1: 'Zu spät' }
  }
  const listen = { b1: ['src/b1/'], b2: ['src/b2/'], b3: ['src/b3/'] }
  let sicht
  let motor
  let standWaehrendDesLaufs = null

  const enthaeltNamen = (zeilen, name) => zeilen.some((z) => z.includes('„' + name + '"'))
  // Die Kette in der Reihenfolge, die der Lauf gerechnet hat — genau die
  // vergleicht laufstandPasst gegen die Leinwand.
  const ketteVon = (stand) => stand.kettenIds.map((id) => bloecke.find((b) => b.instanzId === id))

  beforeAll(async () => {
    workflowSchreiben(projekt, bloecke, pfeile)
    motor = motorErsatz(async (block, optionen) => {
      if (block.instanzId === 'p' || block.instanzId === 'p2') {
        optionen.aufPaketMeldung({ instanzId: block.instanzId, aufgabenIds: [] })
        const pakete = block.ziele.map((ziel) => ({
          zielBlock: ziel.adresse,
          kurzname: kurzNamen[block.instanzId][ziel.instanzId],
          ziel: 'Teil ' + ziel.instanzId,
          fertigKriterien: ['Läuft.'],
          erlaubteDateien: listen[ziel.instanzId]
        }))
        const ergebnis = meldungPruefen('arbeitspaket', { ...rahmen, pakete }, 'Arbeitspaket', {
          ziele: block.ziele
        })
        if (ergebnis.fehler) throw new Error(ergebnis.fehler)
        return [ergebnis.meldung]
      }
      return umsetzungsMeldung()
    })
    sicht = fensterErsatz()
    expect(await laufStarten(sicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('p')
    // Der Laufstand von JETZT: p ist fertig, die Namen hängen, der Lauf läuft.
    await sicht.warteAuf(
      () => motor.gestartet.includes('b2') && motor.gestartet.includes('b3'),
      'die freien Bauer gestartet'
    )
    standWaehrendDesLaufs = JSON.parse(
      fs.readFileSync(path.join(projekt, 'laufstand.json'), 'utf8')
    )
    await motor.freigeben('b2')
    await motor.freigeben('b3')
    await motor.freigeben('p2')
    await motor.freigeben('b1')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')
  }, 60000)

  it('benennt den namenlosen Bauer nach dem Kurznamen — sichtbar im Ticker', () => {
    const zeilen = sicht.ticker()
    expect(
      zeilen.some(
        (z) =>
          z.startsWith('„Bauer" heißt in diesem Lauf jetzt „Bauer · Server-Briefing"') &&
          z.includes('Die Leinwand bleibt unverändert.')
      )
    ).toBe(true)
    // Und er heißt ab da überall so — auch in der Start-Zeile.
    expect(enthaeltNamen(zeilen, 'Bauer · Server-Briefing')).toBe(true)
  })

  it('lässt Georgs eigenen Karten-Zusatznamen gewinnen', () => {
    const zeilen = sicht.ticker()
    expect(enthaeltNamen(zeilen, 'Bauer · Georgs Name')).toBe(true)
    expect(enthaeltNamen(zeilen, 'Bauer · Egal')).toBe(false)
  })

  it('nummeriert eine Dopplung mechanisch durch, statt zweimal denselben Namen zu vergeben', () => {
    expect(enthaeltNamen(sicht.ticker(), 'Bauer · Server-Briefing 2')).toBe(true)
  })

  it('lässt den ERSTEN Melder gewinnen — ein späterer Zuschnitt benennt nicht um', () => {
    const zeilen = sicht.ticker()
    expect(zeilen.some((z) => z.includes('Zu spät'))).toBe(false)
    // Genau zwei Umbenennungen: b1 und b3. b2 gehört Georg, b1 wird nicht
    // zweimal benannt.
    expect(
      zeilen.filter((z) => z.startsWith('„Bauer" heißt in diesem Lauf jetzt'))
    ).toHaveLength(2)
  })

  it('trägt den Laufzeit-Namen ins zusatz-Feld der Berichte — nie in den Katalognamen', () => {
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    const je = Object.fromEntries(
      ende.bericht.blockErgebnisse
        .filter((b) => b.zustand === 'erfolgreich')
        .map((b) => [b.instanzId, b])
    )
    expect(je.b1.block).toBe('Bauer')
    expect(je.b3.block).toBe('Bauer')
    // Welcher der beiden namenlosen Bauer die „2" bekommt, entscheidet die
    // Reihenfolge der Ziel-Liste — die Regel ist, dass genau EINER sie trägt.
    expect([je.b1.zusatz, je.b3.zusatz].sort()).toEqual(['Server-Briefing', 'Server-Briefing 2'])
    expect(je.b2.zusatz).toBe('Georgs Name')
  })

  it('lässt die Leinwand unangetastet — workflow.json kennt die Namen nicht', () => {
    const workflow = JSON.parse(fs.readFileSync(path.join(projekt, 'workflow.json'), 'utf8'))
    expect(workflow.bloecke.map((b) => b.zusatz)).toEqual([
      '',
      '',
      'Georgs Name',
      '',
      'Zweite Quelle'
    ])
  })

  // Die Laufstand-Falle aus Bauschritt 41: stand.zusaetze ist der
  // Vergleichsanker gegen die Leinwand. Stünde der Laufzeit-Name dort, wäre
  // JEDE Wiederaufnahme ungültig — die Karte trägt ihn ja nicht.
  it('hält die Laufzeit-Namen in einem EIGENEN Laufstand-Feld, getrennt vom Vergleichsanker', () => {
    const stand = standWaehrendDesLaufs
    expect(Object.fromEntries(stand.zusaetze)).toEqual({
      p: '',
      b1: '',
      b2: 'Georgs Name',
      b3: '',
      p2: 'Zweite Quelle'
    })
    const laufzeit = Object.fromEntries(stand.laufzeitZusaetze)
    expect(Object.keys(laufzeit).sort()).toEqual(['b1', 'b3'])
    expect(Object.values(laufzeit).sort()).toEqual(['Server-Briefing', 'Server-Briefing 2'])
    // Verglichen wird gegen die Kette in der Reihenfolge, die der Lauf gerechnet hat.
    expect(laufstandPasst(ketteVon(stand), pfeile, stand)).toBe(true)
  })

  it('nimmt einen Laufstand von vor 0.51.1 unverändert an — das Feld darf fehlen', () => {
    const alt = { ...standWaehrendDesLaufs }
    delete alt.laufzeitZusaetze
    expect(laufstandPasst(ketteVon(alt), pfeile, alt)).toBe(true)
  })
})

// ——— Wiederaufnahme: die Namen kommen zurück —————————————————————————————————

describe('0.51.1 · Die Wiederaufnahme stellt die Laufzeit-Namen wieder her', () => {
  const projekt = frischesProjekt('wiederaufnahme')
  const bloecke = [
    { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '', feldWerte: { wunsch: 'Ein Teil' } },
    { instanzId: 'b', blockId: 'bauer', zusatz: '' }
  ]
  const pfeile = [{ von: 'p', nach: 'b' }]
  let sicht
  let motor
  let stand = null

  beforeAll(async () => {
    workflowSchreiben(projekt, bloecke, pfeile)
    const bauen = async (block, optionen) => {
      if (block.instanzId === 'p') {
        optionen.aufPaketMeldung({ instanzId: 'p', aufgabenIds: [] })
        const ergebnis = meldungPruefen(
          'arbeitspaket',
          {
            ...rahmen,
            pakete: block.ziele.map((ziel) => ({
              zielBlock: ziel.adresse,
              kurzname: 'Server-Briefing',
              ziel: 'Teil eins',
              fertigKriterien: ['Läuft.'],
              erlaubteDateien: ['src/b/']
            }))
          },
          'Arbeitspaket',
          { ziele: block.ziele }
        )
        if (ergebnis.fehler) throw new Error(ergebnis.fehler)
        return [ergebnis.meldung]
      }
      return umsetzungsMeldung()
    }
    motor = motorErsatz(bauen)
    const ersteSicht = fensterErsatz()
    expect(await laufStarten(ersteSicht.fenster, projekt, [], null, false, null)).toEqual({ ok: true })
    await motor.freigeben('p')
    await ersteSicht.warteAuf(() => motor.gestartet.includes('b'), 'Bauer gestartet')
    stand = JSON.parse(fs.readFileSync(path.join(projekt, 'laufstand.json'), 'utf8'))
    await motor.freigeben('b')
    await ersteSicht.warteAuf(() => ersteSicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende')

    // Zweiter Lauf, fortgesetzt am gespeicherten Stand: „p" ist fertig, „b"
    // läuft erneut — und muss wieder seinen Laufzeit-Namen tragen.
    motor = motorErsatz(bauen)
    sicht = fensterErsatz()
    expect(await laufStarten(sicht.fenster, projekt, [], stand, false, null)).toEqual({ ok: true })
    await motor.freigeben('b')
    await sicht.warteAuf(() => sicht.ereignisse.some((e) => e.art === 'fertig'), 'Laufende (fortgesetzt)')
  }, 60000)

  it('nennt den Block auch nach der Wiederaufnahme unter seinem Kurznamen', () => {
    expect(Object.fromEntries(stand.laufzeitZusaetze)).toEqual({ b: 'Server-Briefing' })
    expect(sicht.ticker()).toContain(texte.ticker.blockStartet(2, 2, 'Bauer · Server-Briefing'))
    const ende = sicht.ereignisse.find((e) => e.art === 'fertig')
    const bauer = ende.bericht.blockErgebnisse.find((b) => b.instanzId === 'b')
    expect(bauer.block).toBe('Bauer')
    expect(bauer.zusatz).toBe('Server-Briefing')
  })
})
