// Tolerante Listen-Felder (BAUPLAN 49): Über Ollamas Anthropic-Schnittstelle
// kommt ein Listen-Argument als JSON-Text an, sobald ein Element „ " enthält —
// das Schema nimmt den Text an, wenn er eine Liste ergibt; alles andere bleibt
// ein Fehler. Das JSON-Schema für den Agenten bleibt „array".
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { liste, listeAusText } from '../src/main/motor/werkzeugSchema.js'

describe('listeAusText', () => {
  it('lässt echte Arrays und Nicht-Texte unverändert', () => {
    expect(listeAusText(['a'])).toEqual(['a'])
    expect(listeAusText(undefined)).toBeUndefined()
    expect(listeAusText(3)).toBe(3)
  })
  it('parst einen JSON-Text, der eine Liste ergibt — auch mit „ “', () => {
    expect(listeAusText(JSON.stringify(['Feld „a“', 'b']))).toEqual(['Feld „a“', 'b'])
    expect(listeAusText('  [1, 2] ')).toEqual([1, 2])
  })
  it('lässt alles andere als Text stehen (Schema lehnt dann ab)', () => {
    expect(listeAusText('kein json')).toBe('kein json')
    expect(listeAusText('{"a":1}')).toBe('{"a":1}')
    expect(listeAusText('[kaputt')).toBe('[kaputt')
  })
})

describe('liste()', () => {
  const schema = z.object({
    getan: liste(z.string()).optional(),
    pakete: liste(z.object({ ziel: z.string(), kriterien: liste(z.string()) }))
  })
  it('nimmt Array und JSON-Text gleichermaßen an, auch verschachtelt', () => {
    expect(schema.parse({ pakete: [{ ziel: 'z', kriterien: ['k'] }] }).pakete[0].kriterien).toEqual(['k'])
    const alsText = schema.parse({
      getan: JSON.stringify(['„x“ getan']),
      pakete: JSON.stringify([{ ziel: 'z', kriterien: JSON.stringify(['k „1“']) }])
    })
    expect(alsText.getan).toEqual(['„x“ getan'])
    expect(alsText.pakete[0].kriterien).toEqual(['k „1“'])
  })
  it('lehnt Unsinn weiterhin ab', () => {
    expect(schema.safeParse({ pakete: 'kein json' }).success).toBe(false)
    expect(schema.safeParse({ pakete: [{ ziel: 1, kriterien: [] }] }).success).toBe(false)
  })
  it('zeigt dem Agenten weiterhin „array" im JSON-Schema', () => {
    const json = z.toJSONSchema(schema, { io: 'input' })
    expect(json.properties.pakete.type).toBe('array')
    expect(json.properties.pakete.items.properties.kriterien.type).toBe('array')
    expect(json.properties.getan.type).toBe('array')
  })
})

// Server-Aufbau in echt (Befund Prüfer 2, Bauschritt 50): Ein nachgestelltes
// `liste(...).max(4)` warf beim Aufbau des Mensch-Werkzeugkastens einen
// TypeError — VOR dem try des Motors, von schleife.catch verschluckt: Die
// gebaute App startete keinen einzigen Motor mehr, jeder Lauf hing still am
// ersten Block. Deshalb wird hier jeder Werkzeug-Server einmal WIRKLICH
// gebaut (kein Motor, kein Netz — nur die Schema-Konstruktion).
//
// Rot-vor-Grün: Mit `liste(z.string()).max(4)` in menschWerkzeuge.js (Stand
// 07d39ee) war menschWerkzeugServer(...) eine abgelehnte Promise.
describe('Werkzeug-Server lassen sich wirklich bauen (BAUPLAN 50)', () => {
  it('liste(element, deckel) deckelt im Array, nicht am ZodPipe', () => {
    const gedeckelt = liste(z.string(), 2)
    expect(gedeckelt.safeParse(['a', 'b']).success).toBe(true)
    expect(gedeckelt.safeParse(['a', 'b', 'c']).success).toBe(false)
    expect(gedeckelt.safeParse(JSON.stringify(['„a“'])).success).toBe(true)
    expect(z.toJSONSchema(z.object({ o: gedeckelt }), { io: 'input' }).properties.o.type).toBe('array')
  })
  it('alle Werkzeug-Server bauen ohne Wurf', async () => {
    const leer = async () => null
    const { menschWerkzeugServer } = await import('../src/main/motor/menschWerkzeuge.js')
    await menschWerkzeugServer({ aufMenschFrage: leer })
    const { kartenWerkzeugServer } = await import('../src/main/motor/kartenWerkzeuge.js')
    await kartenWerkzeugServer({ projektPfad: 'x', aufEreignis: () => {} })
    const { startWerkzeugServer } = await import('../src/main/motor/startWerkzeuge.js')
    await startWerkzeugServer({ projektPfad: 'x', aufEreignis: () => {} })
    const { pruefbefehlWerkzeugServer } = await import('../src/main/motor/pruefbefehlWerkzeuge.js')
    await pruefbefehlWerkzeugServer({ projektPfad: 'x', aufEreignis: () => {} })
    const { lieferscheinWerkzeugServer } = await import('../src/main/motor/lieferscheinWerkzeuge.js')
    await lieferscheinWerkzeugServer({ werkzeuge: [], holeBlock: () => null, aufMeldung: leer })
    const { vorschlagWerkzeugServer } = await import('../src/main/motor/vorschlagWerkzeuge.js')
    await vorschlagWerkzeugServer({ projektPfad: 'x', aufKartenVorschlag: leer })
    const { laufVorschlagWerkzeugServer } = await import('../src/main/motor/laufVorschlagWerkzeuge.js')
    await laufVorschlagWerkzeugServer({ projektPfad: 'x', aufLaufVorschlag: leer })
    const { kartenZuteilungWerkzeugServer } = await import('../src/main/motor/kartenZuteilungWerkzeuge.js')
    await kartenZuteilungWerkzeugServer({ aufKartenZuteilung: leer })
    const { appWerkzeugServer } = await import('../src/main/motor/appWerkzeuge.js')
    await appWerkzeugServer({ projektPfad: 'x', aufEreignis: () => {} })
    const { helferWerkzeugServer } = await import('../src/main/motor/helferWerkzeuge.js')
    await helferWerkzeugServer({ projektPfad: 'x', modell: 'm', adresse: 'http://127.0.0.1:1', aufEreignis: () => {} })
  })
})
