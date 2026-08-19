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
