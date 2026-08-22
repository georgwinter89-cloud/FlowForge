// Karten-Index statt Volltext (BAUPLAN 53). Geprüft wird das Verhalten, nicht
// die Anwesenheit von Codezeilen:
//   - die Kurz-Kennung und ihre Auflösung (exakt, Präfix, mehrdeutig,
//     unbekannt, zu kurz) als reine Rechnung,
//   - das Ausgabeformat von karten_uebersicht — es darf KEINEN Kartentext
//     mehr enthalten, sonst ist der ganze Schritt umsonst,
//   - karten_lesen: Format, Deckel, Dubletten, leere und falsche Eingabe,
//     dazu der wirklich gebaute Werkzeug-Server,
//   - die Rechte („darf nur lesen" lässt beide Lesewerkzeuge durch, sperrt
//     Änderungen weiter) und die Ticker-Zeile,
//   - und dass JEDE Leitplanke, die eine Karten-Kennung von einem Agenten
//     annimmt, die Kurzform akzeptiert und danach die VOLLE id weitergibt.
//
// Rot-vor-Grün, so gemessen: Vor dem Bauschritt gab es kurzKennung,
// kennungAufloesen, kartenIndexZeile, uebersichtText, kartenLesenErgebnis und
// kartenAnzahl nicht (Import rot); karten_uebersicht baute
// `- id <uuid> · [sorte] titel: text`, KARTEN_NUR_LESEN war eine einzelne
// Zeichenkette (karten_lesen wäre unter „darf nur lesen" hart gesperrt
// gewesen), und alle Leitplanken verglichen die Eingabe direkt mit k.id — eine
// Kurz-Kennung fiel dort als „unbekannt"/„fremd" durch.
import { describe, it, expect, vi } from 'vitest'

// Der Werkzeug-Server liest die Karten über projekte.js aus dem Dateisystem —
// hier steht stattdessen ein fester Bestand, damit der Handler ohne
// Projektordner wirklich laufen kann (Muster webRechte.test.js).
const bestand = vi.hoisted(() => ({ karten: [] }))
vi.mock('../src/main/projekte.js', async (importOriginal) => ({
  ...(await importOriginal()),
  kartenLaden: () => ({ ok: true, karten: bestand.karten })
}))

import {
  KENNUNG_LAENGE,
  kurzKennung,
  idAusKennung,
  kennungAufloesen,
  kennungFuerLeitplanke
} from '../src/shared/kartenRegeln.js'
import {
  KARTEN_LESEN_MAX,
  kartenZeile,
  kartenIndexZeile,
  uebersichtText,
  kartenLesenErgebnis,
  kartenWerkzeugServer
} from '../src/main/motor/kartenWerkzeuge.js'
import { pruefeWerkzeug, tickerZeilen, kartenAnzahl } from '../src/main/motor/claudeCodeMotor.js'
import {
  kartenZuteilungPruefen,
  paketMeldungPruefen
} from '../src/main/motor/kartenZuteilungWerkzeuge.js'
import { laufVorschlagPruefen } from '../src/main/motor/laufVorschlagWerkzeuge.js'
import { themenVorschlagLeitplanken } from '../src/main/motor/vorschlagWerkzeuge.js'
import { meldungPruefen, zuschnittDeckung } from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const tk = texte.agentenKarten
const PROJEKT = 'C:\\Projekte\\Beispiel'

// Echte UUID-Form (projekte.js: crypto.randomUUID) — mit ausgedachten
// Kurz-IDs („a1") ließe sich über Kurz-Kennungen gar nichts messen.
const STATUS = '11111111-1111-4111-8111-111111111111'
const AUFGABE_OFFEN = 'aaaaaaa1-2222-4222-8222-222222222222'
const AUFGABE_FERTIG = 'aaaaaaa2-3333-4333-8333-333333333333'
const WISSEN = 'bbbbbbbb-4444-4444-8444-444444444444'
const ENTSCHEIDUNG = 'cccccccc-5555-4555-8555-555555555555'
const PRUEFUNG = 'dddddddd-6666-4666-8666-666666666666'

const KARTEN = [
  { id: STATUS, sorte: 'status', titel: 'Wo stehen wir', text: 'Kurz vor dem Umbau.', erledigt: false },
  { id: AUFGABE_OFFEN, sorte: 'aufgabe', titel: 'Login bauen', text: 'Formular mit zwei Feldern.', thema: 'Login', erledigt: false },
  { id: AUFGABE_FERTIG, sorte: 'aufgabe', titel: 'Absturz beheben', text: 'Beim Start des Motors.', thema: 'Stabilität', erledigt: true },
  { id: WISSEN, sorte: 'wissen', titel: 'Aufbau', text: 'Electron-App mit React.', thema: 'Aufbau', erledigt: false },
  { id: ENTSCHEIDUNG, sorte: 'entscheidung', titel: 'Farbwahl', text: 'Dunkel, weil Georg abends baut.', thema: 'Oberfläche', erledigt: false },
  { id: PRUEFUNG, sorte: 'pruefung', titel: 'Login geprüft', text: 'Hält seit dem 20.08.', erledigt: false }
]
bestand.karten = KARTEN

describe('BAUPLAN 53 · Die Kurz-Kennung', () => {
  it('sind die ersten 8 Zeichen der id', () => {
    expect(KENNUNG_LAENGE).toBe(8)
    expect(kurzKennung(AUFGABE_OFFEN)).toBe('aaaaaaa1')
    expect(kurzKennung(AUFGABE_OFFEN)).toHaveLength(KENNUNG_LAENGE)
    expect(kurzKennung(null)).toBe('')
  })

  it('nimmt die volle id an — auch mit Rand-Leerzeichen und in Großschreibung', () => {
    expect(kennungAufloesen(KARTEN, AUFGABE_OFFEN).karte.titel).toBe('Login bauen')
    expect(kennungAufloesen(KARTEN, `  ${AUFGABE_OFFEN}  `).karte.id).toBe(AUFGABE_OFFEN)
    expect(kennungAufloesen(KARTEN, AUFGABE_OFFEN.toUpperCase()).karte.id).toBe(AUFGABE_OFFEN)
  })

  it('nimmt die Kurz-Kennung an — das ist der ganze Zweck des Index', () => {
    expect(kennungAufloesen(KARTEN, kurzKennung(WISSEN)).karte.titel).toBe('Aufbau')
    expect(kennungAufloesen(KARTEN, ' AAAAAAA1 ').karte.id).toBe(AUFGABE_OFFEN)
  })

  it('meldet eine mehrdeutige Kennung mit den vollen ids, statt zu raten', () => {
    // „aaaaaaa" (7 Zeichen) passt auf beide Aufgaben-Karten.
    const urteil = kennungAufloesen(KARTEN, 'aaaaaaa')
    expect(urteil.karte).toBeUndefined()
    expect(urteil.mehrdeutig).toBe(true)
    expect(urteil.fehler).toBe(
      tk.mehrdeutigeKennung('aaaaaaa', `${AUFGABE_OFFEN}, ${AUFGABE_FERTIG}`)
    )
    expect(urteil.fehler).toContain(AUFGABE_OFFEN)
    expect(urteil.fehler).toContain(AUFGABE_FERTIG)
  })

  it('ehrliche Grenze: gleiche erste 8 Zeichen ergeben „mehrdeutig", keinen Zufallstreffer', () => {
    const zwillinge = [
      { id: 'abcdef12-0000-4000-8000-000000000001', sorte: 'aufgabe', titel: 'Eins', text: 'A', erledigt: false },
      { id: 'abcdef12-0000-4000-8000-000000000002', sorte: 'aufgabe', titel: 'Zwei', text: 'B', erledigt: false }
    ]
    const urteil = kennungAufloesen(zwillinge, 'abcdef12')
    expect(urteil.karte).toBeUndefined()
    expect(urteil.mehrdeutig).toBe(true)
    // Die volle id trifft trotzdem eindeutig — sie geht dem Präfix vor.
    expect(kennungAufloesen(zwillinge, zwillinge[1].id).karte.titel).toBe('Zwei')
  })

  it('sucht unter 4 Zeichen gar nicht erst — „a" träfe beliebig viele Karten', () => {
    expect(kennungAufloesen(KARTEN, 'aaa').fehler).toBe(tk.unbekannteId('aaa'))
    expect(kennungAufloesen(KARTEN, 'aaa').mehrdeutig).toBeUndefined()
    // Genau 4 Zeichen suchen dagegen schon — hier eindeutig.
    expect(kennungAufloesen(KARTEN, 'bbbb').karte.id).toBe(WISSEN)
  })

  it('meldet eine unbekannte Kennung im Klartext', () => {
    expect(kennungAufloesen(KARTEN, 'zzzzzzzz').fehler).toBe(tk.unbekannteId('zzzzzzzz'))
    expect(kennungAufloesen(KARTEN, '').fehler).toBe(tk.unbekannteId(''))
    expect(kennungAufloesen([], AUFGABE_OFFEN).fehler).toBe(tk.unbekannteId(AUFGABE_OFFEN))
  })

  it('idAusKennung rechnet ohne Karten-Objekte — nur gegen eine ID-Liste', () => {
    const ids = [AUFGABE_OFFEN, WISSEN]
    expect(idAusKennung(ids, 'bbbbbbbb').id).toBe(WISSEN)
    expect(idAusKennung(ids, AUFGABE_OFFEN).id).toBe(AUFGABE_OFFEN)
    expect(idAusKennung(ids, 'zzzzzzzz').fehler).toBe(tk.unbekannteId('zzzzzzzz'))
  })

  it('kennungFuerLeitplanke gibt Unbekanntes unverändert zurück — die Leitplanke urteilt selbst', () => {
    expect(kennungFuerLeitplanke(KARTEN, ' aaaaaaa1 ').id).toBe(AUFGABE_OFFEN)
    expect(kennungFuerLeitplanke(KARTEN, 'x9').id).toBe('x9')
    expect(kennungFuerLeitplanke(KARTEN, 'aaaaaaa').fehler).toContain(AUFGABE_FERTIG)
  })
})

describe('BAUPLAN 53 · karten_uebersicht ist ein Verzeichnis, kein Volltext', () => {
  const text = uebersichtText(KARTEN)

  it('enthält den Text KEINER Karte — das ist der Gewinn des Schritts', () => {
    for (const karte of KARTEN) expect(text).not.toContain(karte.text)
  })

  it('nennt jede Karte mit Kurz-Kennung, Sorte, Thema und Titel', () => {
    for (const karte of KARTEN) {
      expect(text).toContain(`- ${kurzKennung(karte.id)} · ${kartenIndexZeile(karte)}`)
      expect(text).toContain(karte.titel)
    }
    expect(text).toContain('Login')
  })

  it('trägt die volle UUID nicht mehr — sie war der ungezählte Posten der Messung', () => {
    for (const karte of KARTEN) expect(text).not.toContain(karte.id)
  })

  it('behält Reihenfolge und Kartenmenge, auch die Prüfkarte', () => {
    const zeilen = text.split('\n\n')[0].split('\n')
    expect(zeilen).toHaveLength(KARTEN.length)
    expect(zeilen.map((z) => z.split(' · ')[0])).toEqual(KARTEN.map((k) => `- ${kurzKennung(k.id)}`))
    expect(text).toContain('Login geprüft')
  })

  it('behält die Themenzeile am Ende', () => {
    expect(text.endsWith(texte.agentenKarten.themenZeile(['Login', 'Stabilität', 'Aufbau', 'Oberfläche']))).toBe(true)
  })

  it('ist die kurze Fassung derselben Zeile — Sortenmarke gleich, nur ohne „: text"', () => {
    const karte = KARTEN[1]
    expect(kartenZeile(karte)).toBe(`${kartenIndexZeile(karte)}: ${karte.text}`)
  })

  it('spart je Karte den ganzen Text UND die 28 überzähligen UUID-Zeichen', () => {
    for (const karte of KARTEN) {
      const bisher = `- id ${karte.id} · ${kartenZeile(karte)}`
      const jetzt = `- ${kurzKennung(karte.id)} · ${kartenIndexZeile(karte)}`
      expect(jetzt.length).toBeLessThan(bisher.length - karte.text.length)
    }
  })
})

describe('BAUPLAN 53 · karten_lesen holt den Volltext gezielt nach', () => {
  it('liefert je Karte „- Kennung · Volltextzeile"', () => {
    const ergebnis = kartenLesenErgebnis(KARTEN, [kurzKennung(ENTSCHEIDUNG)])
    expect(ergebnis.fehler).toBeUndefined()
    expect(ergebnis.anzahl).toBe(1)
    expect(ergebnis.text).toBe(`- ${kurzKennung(ENTSCHEIDUNG)} · ${kartenZeile(KARTEN[4])}`)
    expect(ergebnis.text).toContain('Dunkel, weil Georg abends baut.')
  })

  it('nimmt Kurzform und volle id gemischt an und wirft Dubletten still heraus', () => {
    const ergebnis = kartenLesenErgebnis(KARTEN, [
      kurzKennung(WISSEN),
      WISSEN,
      ' bbbbbbbb ',
      ENTSCHEIDUNG
    ])
    expect(ergebnis.anzahl).toBe(2)
    expect(ergebnis.text.split('\n')).toHaveLength(2)
  })

  it('deckelt bei 25 Kennungen je Aufruf und sagt im Klartext, was zu tun ist', () => {
    expect(KARTEN_LESEN_MAX).toBe(25)
    const zuViele = Array.from({ length: 26 }, (_, i) => `kennung-${i}`)
    expect(kartenLesenErgebnis(KARTEN, zuViele).fehler).toBe(tk.zuVieleIds(KARTEN_LESEN_MAX, 26))
    // Genau 25 sind erlaubt — der Deckel liegt nicht schon bei 24.
    const gerade25 = Array.from({ length: 25 }, (_, i) => (i === 0 ? WISSEN : `kennung-${i}`))
    expect(kartenLesenErgebnis(KARTEN, gerade25).fehler).not.toBe(
      tk.zuVieleIds(KARTEN_LESEN_MAX, 25)
    )
  })

  it('antwortet auf eine leere Anfrage mit Klartext statt mit einem leeren Block', () => {
    expect(kartenLesenErgebnis(KARTEN, []).fehler).toBe(tk.keineIds)
    expect(kartenLesenErgebnis(KARTEN, ['  ', '']).fehler).toBe(tk.keineIds)
    expect(kartenLesenErgebnis(KARTEN, undefined).fehler).toBe(tk.keineIds)
  })

  it('lässt eine unbekannte Kennung nicht still weg, sondern weist sie aus', () => {
    const ergebnis = kartenLesenErgebnis(KARTEN, [WISSEN, 'zzzzzzzz'])
    expect(ergebnis.text).toBeUndefined()
    expect(ergebnis.fehler).toBe(tk.unbekannteId('zzzzzzzz'))
  })

  it('weist eine mehrdeutige Kennung mit den vollen ids ab', () => {
    expect(kartenLesenErgebnis(KARTEN, ['aaaaaaa']).fehler).toContain(AUFGABE_FERTIG)
  })
})

// Der Deckel MUSS im Array sitzen (liste(element, deckel)), nicht als
// nachgestelltes .max() am ZodPipe: Das warf beim Server-Aufbau einen
// TypeError, der jeden Motorstart der gebauten App still verschluckte
// (Befund Prüfer 2, Bauschritt 50). Deshalb wird der Server hier wirklich
// gebaut und sein Schema wirklich gefahren.
describe('BAUPLAN 53 · der karten-Werkzeugkasten baut karten_lesen wirklich', () => {
  it('registriert karten_lesen neben karten_uebersicht', async () => {
    const server = await kartenWerkzeugServer({ projektPfad: PROJEKT, aufEreignis: () => {} })
    const werkzeuge = server.instance._registeredTools
    expect(Object.keys(werkzeuge)).toContain('karten_uebersicht')
    expect(Object.keys(werkzeuge)).toContain('karten_lesen')
    // Beide Beschreibungen sagen, dass die Übersicht den Text NICHT enthält —
    // ein Appell im Auftragstext allein hält nicht (Zugsimulator-Befund).
    expect(werkzeuge.karten_uebersicht.description).toBe(tk.uebersichtBeschreibung)
    expect(werkzeuge.karten_lesen.description).toBe(tk.lesenBeschreibung(KARTEN_LESEN_MAX))
    expect(werkzeuge.karten_uebersicht.description).toMatch(/OHNE ihren Text/)
    expect(werkzeuge.karten_lesen.description).toMatch(/nur Titel liefert/)
  })

  // Der Deckel gehört in den HANDLER, nicht ins Schema (Befund Prüfer 1,
  // gemessen über einen echten MCP-Aufruf): Ein `liste(…, 25)` lehnte 26
  // Kennungen ab, bevor der Handler zu Wort kam — beim Agenten landete
  // englisches Roh-JSON („Too big: expected array to have <=25 items") statt
  // des deutschen Satzes, der ihm sagt, wie er die Anfrage aufteilt. Das
  // Schema lässt die Liste also durch; die Grenze zieht der Klartext.
  it('lässt jede Listenlänge durchs Schema — inklusive JSON-Text von Ollama', async () => {
    const server = await kartenWerkzeugServer({ projektPfad: PROJEKT, aufEreignis: () => {} })
    const schema = server.instance._registeredTools.karten_lesen.inputSchema
    const ids = (n) => Array.from({ length: n }, (_, i) => `kennung-${i}`)
    expect(schema.safeParse({ ids: ids(25) }).success).toBe(true)
    expect(schema.safeParse({ ids: ids(26) }).success).toBe(true)
    // Über Ollamas Schnittstelle kommt die Liste als JSON-Text (BAUPLAN 49).
    expect(schema.safeParse({ ids: JSON.stringify([WISSEN]) }).success).toBe(true)
  })

  it('lehnt 26 Kennungen im Handler auf Deutsch ab, mit der Anweisung zum Aufteilen', async () => {
    const server = await kartenWerkzeugServer({ projektPfad: PROJEKT, aufEreignis: () => {} })
    const ids = Array.from({ length: 26 }, (_, i) => `kennung-${i}`)
    const antwort = await server.instance._registeredTools.karten_lesen.handler({ ids }, {})
    expect(antwort.isError).toBe(true)
    expect(antwort.content[0].text).toBe(tk.zuVieleIds(KARTEN_LESEN_MAX, 26))
    expect(antwort.content[0].text).toMatch(/Teile sie auf mehrere Aufrufe auf/)
  })

  it('liefert über den echten Handler den Volltext der genannten Karte', async () => {
    const server = await kartenWerkzeugServer({ projektPfad: PROJEKT, aufEreignis: () => {} })
    const antwort = await server.instance._registeredTools.karten_lesen.handler(
      { ids: [kurzKennung(WISSEN)] },
      {}
    )
    expect(antwort.isError).toBeFalsy()
    expect(antwort.content[0].text).toContain('Electron-App mit React.')
    const uebersicht = await server.instance._registeredTools.karten_uebersicht.handler({}, {})
    expect(uebersicht.content[0].text).not.toContain('Electron-App mit React.')
    // Und eine unbekannte Kennung kommt als ehrlicher Fehler zurück.
    const daneben = await server.instance._registeredTools.karten_lesen.handler(
      { ids: ['zzzzzzzz'] },
      {}
    )
    expect(daneben.isError).toBe(true)
    expect(daneben.content[0].text).toBe(tk.unbekannteId('zzzzzzzz'))
  })
})

describe('BAUPLAN 53 · „darf nur lesen" lässt beide Lesewerkzeuge durch', () => {
  const pruefen = (name, eingabe = {}) => pruefeWerkzeug(name, eingabe, PROJEKT, true, false)

  it('erlaubt karten_uebersicht UND karten_lesen ohne Rückfrage', () => {
    expect(pruefen('mcp__karten__karten_uebersicht').erlaubt).toBe(true)
    expect(pruefen('mcp__karten__karten_lesen', { ids: [WISSEN] }).erlaubt).toBe(true)
  })

  it('sperrt die schreibenden Karten-Werkzeuge weiterhin hart', () => {
    for (const name of [
      'mcp__karten__karte_aktualisieren',
      'mcp__karten__karte_erledigen',
      'mcp__karten__karte_anlegen'
    ]) {
      const urteil = pruefen(name)
      expect(urteil.erlaubt).toBeUndefined()
      expect(urteil.gesperrt).toBe(texte.rechteFrage.nurLesenGesperrtFuerAgent)
    }
  })

  it('lässt das Audit weiter Karten anlegen (Kennzeichen darfKartenAnlegen)', () => {
    const urteil = pruefeWerkzeug(
      'mcp__karten__karte_anlegen', {}, PROJEKT, true, false, true, false, true
    )
    expect(urteil.erlaubt).toBe(true)
  })
})

describe('BAUPLAN 53 · der Ticker zeigt, wie sparsam nachgelesen wird', () => {
  const blockIds = new Set(['block-1'])
  const aufruf = (name, eingabe) => ({
    type: 'assistant',
    parent_tool_use_id: 'block-1',
    message: { content: [{ type: 'tool_use', name, input: eingabe }] }
  })

  it('meldet karten_lesen mit der Anzahl, karten_uebersicht wie bisher', () => {
    expect(
      tickerZeilen(aufruf('mcp__karten__karten_lesen', { ids: ['a', 'b', 'c'] }), PROJEKT, blockIds)
    ).toEqual([texte.ticker.liestKartenVolltext(3)])
    expect(
      tickerZeilen(aufruf('mcp__karten__karten_uebersicht', {}), PROJEKT, blockIds)
    ).toEqual([texte.ticker.liestKarten])
  })

  it('zählt auch, wenn die Liste als JSON-Text ankommt (lokaler Motor)', () => {
    expect(kartenAnzahl(JSON.stringify(['a', 'b']))).toBe(2)
    expect(kartenAnzahl(['a'])).toBe(1)
    expect(kartenAnzahl(undefined)).toBe(0)
    expect(
      tickerZeilen(
        aufruf('mcp__karten__karten_lesen', { ids: JSON.stringify(['a', 'b']) }),
        PROJEKT,
        blockIds
      )
    ).toEqual([texte.ticker.liestKartenVolltext(2)])
  })
})

// §3 des Umbaus: Der Agent nennt überall dieselben Kennungen, die er im Index
// gesehen hat. Jede dieser Stellen SPEICHERT das Ergebnis weiter — eine
// Kurzform, die nicht aufgelöst wird, bricht dort still (Block ohne Karten,
// Vorschlagszeile ohne Chips, Aufgabe ohne Herkunftsstempel).
describe('BAUPLAN 53 · jede Leitplanke nimmt die Kurz-Kennung an und gibt die volle id weiter', () => {
  const ziel = (instanzId, nummer, name) => ({
    instanzId,
    nummer,
    name,
    adresse: String(nummer),
    bezeichnung: texte.ticker.blockBezeichnung(nummer, name)
  })
  const ziele = [ziel('i-bauer', 2, 'Bauer')]
  const ausgewaehlt = [AUFGABE_OFFEN, WISSEN, ENTSCHEIDUNG]

  it('karten_zuteilen: aus „aaaaaaa1" wird die volle id', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: '2', kartenIds: [kurzKennung(AUFGABE_OFFEN), 'bbbbbbbb'] }],
      karten: KARTEN,
      ausgewaehlt,
      ziele
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.zuteilung).toEqual([['i-bauer', [AUFGABE_OFFEN, WISSEN]]])
  })

  it('karten_zuteilen: die Status-Karte fällt auch als Kurzform still heraus', () => {
    const urteil = kartenZuteilungPruefen({
      zuteilung: [{ block: '2', kartenIds: [kurzKennung(STATUS), kurzKennung(AUFGABE_OFFEN)] }],
      karten: KARTEN,
      ausgewaehlt,
      ziele
    })
    expect(urteil.zuteilung).toEqual([['i-bauer', [AUFGABE_OFFEN]]])
  })

  it('paket_melden: die gemeldete Aufgabe trägt die volle id (Herkunftsstempel, Deckungsrechnung)', () => {
    const urteil = paketMeldungPruefen({
      aufgabenIds: [kurzKennung(AUFGABE_OFFEN), AUFGABE_OFFEN],
      karten: KARTEN,
      ausgewaehlt,
      feldGefuellt: false
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.aufgaben).toEqual([{ id: AUFGABE_OFFEN, titel: 'Login bauen' }])
  })

  it('naechster_lauf_vorschlagen: Kurzform kommt durch, nur Aufgaben bleiben stehen', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: [kurzKennung(AUFGABE_OFFEN), kurzKennung(WISSEN), kurzKennung(ENTSCHEIDUNG), kurzKennung(STATUS)],
      empfehlung: 'Weiter mit dem Login.',
      begruendung: 'Offen geblieben.',
      karten: KARTEN
    })
    expect(urteil.ok).toBe(true)
    // Wissen, Entscheidungen und Status kommen automatisch mit — sie hier zu
    // nennen füllte die Auswahl wieder mit dem, was 53 herausgenommen hat.
    expect(urteil.kartenIds).toEqual([AUFGABE_OFFEN])
    expect(urteil.kartenTitel).toEqual(['Login bauen'])
  })

  it('naechster_lauf_vorschlagen: Prüfkarten bleiben eine harte Ablehnung, auch als Kurzform', () => {
    const urteil = laufVorschlagPruefen({
      kartenIds: [kurzKennung(PRUEFUNG)],
      empfehlung: 'Weiter.',
      begruendung: '',
      karten: KARTEN
    })
    expect(urteil.fehler).toBe(texte.agentenLaufVorschlag.pruefkartenTabu)
  })

  it('karte_vorschlagen (Themen-Sammelform): der Eintrag trägt die volle id', () => {
    const urteil = themenVorschlagLeitplanken({
      themen: [{ kartenId: kurzKennung(WISSEN), thema: 'Architektur' }],
      karten: KARTEN
    })
    expect(urteil.ok).toBe(true)
    expect(urteil.eintraege[0].kartenId).toBe(WISSEN)
    expect(urteil.eintraege[0].thema).toBe('Architektur')
  })

  it('karte_vorschlagen (Einzelfall): der Dialog bekommt die volle id, nicht die Kurzform', async () => {
    // Die Auflösung sitzt hier im Handler, nicht in vorschlagLeitplanken —
    // deshalb wird der Server wirklich gebaut und wirklich gerufen.
    const { vorschlagWerkzeugServer } = await import('../src/main/motor/vorschlagWerkzeuge.js')
    let gesehen = null
    const server = await vorschlagWerkzeugServer({
      projektPfad: PROJEKT,
      aufKartenVorschlag: async (vorschlag) => {
        gesehen = vorschlag
        return { wahl: 'uebernommen' }
      }
    })
    await server.instance._registeredTools.karte_vorschlagen.handler(
      {
        art: 'aktualisieren',
        kartenId: kurzKennung(WISSEN),
        titel: 'Aufbau',
        text: 'Electron-App mit React und Vite.',
        begruendung: 'Vite fehlte.'
      },
      {}
    )
    expect(gesehen.kartenId).toBe(WISSEN)
    expect(gesehen.alteKarte.titel).toBe('Aufbau')
  })

  it('karte_vorschlagen: eine mehrdeutige Kennung wird gemeldet, nicht geraten', () => {
    const urteil = themenVorschlagLeitplanken({
      themen: [{ kartenId: 'aaaaaaa', thema: 'Architektur' }],
      karten: KARTEN
    })
    expect(urteil.fehler).toContain(AUFGABE_FERTIG)
  })

  it('melde_arbeitspaket: die Kurzform im Zuschnitt deckt die gemeldete Aufgabe', () => {
    const paket = [{ id: AUFGABE_OFFEN, titel: 'Login bauen' }]
    const zuschnitt = {
      zielBlock: '2',
      kurzname: 'Login',
      ziel: 'Login bauen',
      fertigKriterien: ['Formular steht.'],
      aufgabenIds: [kurzKennung(AUFGABE_OFFEN)]
    }
    const geprueft = meldungPruefen(
      'arbeitspaket',
      { fazit: 'Zugeschnitten.', pakete: [zuschnitt] },
      'Arbeitspaket',
      { ziele, paket }
    )
    expect(geprueft.fehler).toBeUndefined()
    // Gespeichert wird die volle id — sonst rechnete die Deckung mit zwei
    // verschiedenen Maßstäben.
    expect(geprueft.meldung.pakete[0].aufgabenIds).toEqual([AUFGABE_OFFEN])
    expect(zuschnittDeckung(ziele, paket, [geprueft.meldung]).fehlendeAufgaben).toEqual([])
  })

  it('zuschnittDeckung löst die Kurzform auch ohne Paket-Umfeld auf', () => {
    const paket = [{ id: AUFGABE_OFFEN, titel: 'Login bauen' }]
    // Ohne `paket` im Umfeld (Prüfskripte, selbstgebaute Wege) bleibt die
    // Kurzform im Zuschnitt stehen — die Deckung muss sie trotzdem treffen.
    const geprueft = meldungPruefen(
      'arbeitspaket',
      {
        fazit: 'Zugeschnitten.',
        pakete: [
          {
            zielBlock: '2',
            kurzname: 'Login',
            ziel: 'Login bauen',
            fertigKriterien: ['Formular steht.'],
            aufgabenIds: [kurzKennung(AUFGABE_OFFEN)]
          }
        ]
      },
      'Arbeitspaket',
      { ziele }
    )
    expect(geprueft.meldung.pakete[0].aufgabenIds).toEqual([kurzKennung(AUFGABE_OFFEN)])
    expect(zuschnittDeckung(ziele, paket, [geprueft.meldung]).fehlendeAufgaben).toEqual([])
  })
})

// Nacharbeit nach den Messungen von Prüfer 1 (22.08.2026). Alle drei Punkte
// sind Fälle, in denen FlowForge etwas Falsches BEHAUPTETE, statt zu scheitern
// — die gefährlichere Sorte Fehler.
describe('BAUPLAN 53 · Nacharbeit: Kollision, Ticker bei null, leergefilterter Vorschlag', () => {
  const DOPPEL_A = 'abcd1234-1111-4111-8111-111111111111'
  const DOPPEL_B = 'abcd1234-2222-4222-8222-222222222222'
  const EINZELN = 'ffffffff-3333-4333-8333-333333333333'
  const kollidierend = [
    { id: DOPPEL_A, sorte: 'wissen', titel: 'Doppel A', text: 'Text A.', thema: 'Aufbau' },
    { id: DOPPEL_B, sorte: 'wissen', titel: 'Doppel B', text: 'Text B.', thema: 'Aufbau' },
    { id: EINZELN, sorte: 'wissen', titel: 'Allein', text: 'Text C.', thema: 'Aufbau' }
  ]

  it('zeigt bei gleichen ersten 8 Zeichen die vollen ids — genau bei diesen beiden', () => {
    // Vorher standen zwei Zeilen mit derselben Kennung untereinander, ohne
    // jeden Hinweis: Der Agent nahm eine davon, und erst der Fehlversuch
    // nannte ihm die vollen ids.
    const text = uebersichtText(kollidierend)
    expect(text).toContain(`- ${DOPPEL_A} · `)
    expect(text).toContain(`- ${DOPPEL_B} · `)
    // Die unbeteiligte Karte behält die kurze Form.
    expect(text).toContain(`- ${kurzKennung(EINZELN)} · `)
    expect(text).not.toContain(`- ${EINZELN} · `)
  })

  it('nennt die vollen ids auch in der Antwort von karten_lesen', () => {
    const ergebnis = kartenLesenErgebnis(kollidierend, [DOPPEL_A, EINZELN])
    expect(ergebnis.text).toContain(`- ${DOPPEL_A} · `)
    expect(ergebnis.text).toContain(`- ${kurzKennung(EINZELN)} · `)
  })

  it('meldet keine Ticker-Zeile, wenn gar keine Kennung mitkam', () => {
    // „Liest 0 Karten im Volltext" behauptete einen Vorgang, den es nicht gab —
    // der Aufruf scheitert im nächsten Atemzug an der fehlenden Liste.
    const zeile = (eingabe) =>
      tickerZeilen(
        {
          type: 'assistant',
          parent_tool_use_id: 'block-1',
          message: {
            content: [{ type: 'tool_use', name: 'mcp__karten__karten_lesen', input: eingabe }]
          }
        },
        PROJEKT,
        new Set(['block-1'])
      )
    expect(zeile({})).toEqual([])
    expect(zeile({ ids: [] })).toEqual([])
    expect(zeile({ ids: ['aaaaaaa1'] })).toEqual([texte.ticker.liestKartenVolltext(1)])
  })

  it('weist einen Vorschlag ab, aus dem alles herausgefiltert wurde', () => {
    // Sonst: „Vorschlag gespeichert (0 Karten)" an den Agenten und eine
    // Vorschlagszeile ohne eine einzige Karte an Georg.
    const nurWissen = laufVorschlagPruefen({
      kartenIds: [kurzKennung(WISSEN), kurzKennung(ENTSCHEIDUNG)],
      empfehlung: 'Weiter mit dem Login.',
      begruendung: 'Offen.',
      karten: KARTEN
    })
    expect(nurWissen.fehler).toBe(texte.agentenLaufVorschlag.nurAufgaben)
    // Ein absichtlich leerer Vorschlag bleibt erlaubt — es gibt Läufe, nach
    // denen nichts ansteht.
    expect(
      laufVorschlagPruefen({
        kartenIds: [],
        empfehlung: 'Erst mal nichts.',
        begruendung: 'Alles erledigt.',
        karten: KARTEN
      }).ok
    ).toBe(true)
  })
})
