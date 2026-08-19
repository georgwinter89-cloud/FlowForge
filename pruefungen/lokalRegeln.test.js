// Prüfungen zu den Feineinstellungen der lokalen KI als Block-Agent (BAUPLAN 49,
// src/shared/lokalRegeln.js): Vorlagen, Bereinigung mit Grenzen, Name des
// abgeleiteten Ollama-Modells, Ollama-Parameter und Vorlagen-Erkennung.
//
// Rot-vor-Grün: Vor Bauschritt 49 gab es die Datei nicht — jeder Fall hier
// schlug mit „Cannot find module" fehl. Die Grenzfälle (Wert auf der Grenze,
// knapp daneben, Komma statt Punkt, Ganzzahl-Pflicht) sind die Stellen, an
// denen eine naive Regel still klemmen oder Unsinn durchlassen würde.
import { describe, it, expect } from 'vitest'
import {
  LOKAL_FEIN_FELDER,
  LOKAL_FEIN_VORLAGEN,
  lokalFeinBereinigen,
  lokalesModellName,
  ollamaParameterAus,
  lokalFeinVorlageErkennen
} from '../src/shared/lokalRegeln.js'

const LEER = {
  temperatur: null,
  topP: null,
  topK: null,
  minP: null,
  wiederholungsstrafe: null,
  antwortlaenge: null,
  entwurfsTokens: null
}

describe('BAUPLAN 49 · Felder und Vorlagen', () => {
  it('kennt genau die sieben Felder in fester Reihenfolge', () => {
    expect(LOKAL_FEIN_FELDER).toEqual([
      'temperatur',
      'topP',
      'topK',
      'minP',
      'wiederholungsstrafe',
      'antwortlaenge',
      'entwurfsTokens'
    ])
  })

  it('hat drei Vorlagen — Ollama-Standard leer, Qwen3.8 Denken/Coding aus der Modellkarte', () => {
    expect(Object.keys(LOKAL_FEIN_VORLAGEN).sort()).toEqual(
      ['ollama-standard', 'qwen-coding', 'qwen-denken'].sort()
    )
    expect(LOKAL_FEIN_VORLAGEN['ollama-standard']).toEqual(LEER)
    expect(LOKAL_FEIN_VORLAGEN['qwen-denken']).toEqual({
      ...LEER,
      temperatur: 1.0,
      topP: 0.95,
      topK: 20,
      minP: 0,
      wiederholungsstrafe: 1.0
    })
    expect(LOKAL_FEIN_VORLAGEN['qwen-coding']).toEqual({
      ...LEER,
      temperatur: 0.6,
      topP: 0.95,
      topK: 20,
      minP: 0,
      wiederholungsstrafe: 1.0
    })
  })

  it('jede Vorlage trägt genau die sieben Felder', () => {
    for (const vorlage of Object.values(LOKAL_FEIN_VORLAGEN))
      expect(Object.keys(vorlage).sort()).toEqual([...LOKAL_FEIN_FELDER].sort())
  })
})

describe('BAUPLAN 49 · lokalFeinBereinigen', () => {
  it('liefert aus nichts ein vollständiges Objekt mit null überall', () => {
    expect(lokalFeinBereinigen(undefined)).toEqual(LEER)
    expect(lokalFeinBereinigen(null)).toEqual(LEER)
    expect(lokalFeinBereinigen({})).toEqual(LEER)
    expect(lokalFeinBereinigen('quatsch')).toEqual(LEER)
  })

  it('übernimmt gültige Werte und wirft unbekannte Felder weg', () => {
    const fein = lokalFeinBereinigen({
      temperatur: 0.6,
      topP: 0.95,
      topK: 20,
      minP: 0,
      wiederholungsstrafe: 1.1,
      antwortlaenge: 4096,
      entwurfsTokens: 8,
      presence_penalty: 1.5,
      num_ctx: 65536
    })
    expect(fein).toEqual({
      temperatur: 0.6,
      topP: 0.95,
      topK: 20,
      minP: 0,
      wiederholungsstrafe: 1.1,
      antwortlaenge: 4096,
      entwurfsTokens: 8
    })
    expect(Object.keys(fein)).toEqual(LOKAL_FEIN_FELDER)
  })

  it('Grenzen: auf der Grenze gültig, knapp daneben null — nie still geklemmt', () => {
    expect(lokalFeinBereinigen({ temperatur: 0 }).temperatur).toBe(0)
    expect(lokalFeinBereinigen({ temperatur: 2 }).temperatur).toBe(2)
    expect(lokalFeinBereinigen({ temperatur: 2.01 }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ temperatur: -0.1 }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ topP: 1 }).topP).toBe(1)
    expect(lokalFeinBereinigen({ topP: 1.5 }).topP).toBe(null)
    expect(lokalFeinBereinigen({ minP: 0.05 }).minP).toBe(0.05)
    expect(lokalFeinBereinigen({ minP: 1.2 }).minP).toBe(null)
    expect(lokalFeinBereinigen({ topK: 500 }).topK).toBe(500)
    expect(lokalFeinBereinigen({ topK: 501 }).topK).toBe(null)
    expect(lokalFeinBereinigen({ wiederholungsstrafe: 0.5 }).wiederholungsstrafe).toBe(0.5)
    expect(lokalFeinBereinigen({ wiederholungsstrafe: 0.4 }).wiederholungsstrafe).toBe(null)
    expect(lokalFeinBereinigen({ wiederholungsstrafe: 2 }).wiederholungsstrafe).toBe(2)
    expect(lokalFeinBereinigen({ wiederholungsstrafe: 2.5 }).wiederholungsstrafe).toBe(null)
    expect(lokalFeinBereinigen({ entwurfsTokens: 64 }).entwurfsTokens).toBe(64)
    expect(lokalFeinBereinigen({ entwurfsTokens: 65 }).entwurfsTokens).toBe(null)
    expect(lokalFeinBereinigen({ entwurfsTokens: 0 }).entwurfsTokens).toBe(0)
  })

  it('Ganzzahl-Felder lehnen Brüche ab, Antwortlänge braucht mindestens 1', () => {
    expect(lokalFeinBereinigen({ topK: 20.5 }).topK).toBe(null)
    expect(lokalFeinBereinigen({ entwurfsTokens: 4.2 }).entwurfsTokens).toBe(null)
    expect(lokalFeinBereinigen({ antwortlaenge: 0 }).antwortlaenge).toBe(null)
    expect(lokalFeinBereinigen({ antwortlaenge: -5 }).antwortlaenge).toBe(null)
    expect(lokalFeinBereinigen({ antwortlaenge: 1 }).antwortlaenge).toBe(1)
    expect(lokalFeinBereinigen({ antwortlaenge: 100000 }).antwortlaenge).toBe(100000)
    expect(lokalFeinBereinigen({ antwortlaenge: 12.5 }).antwortlaenge).toBe(null)
  })

  it('Unsinn, leere Zeichenkette, Wahrheitswerte → null; Zahlen als Text (auch mit Komma) gelten', () => {
    expect(lokalFeinBereinigen({ temperatur: '' }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ temperatur: '   ' }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ temperatur: 'heiß' }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ temperatur: NaN }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ temperatur: Infinity }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ temperatur: true }).temperatur).toBe(null)
    expect(lokalFeinBereinigen({ temperatur: '0.7' }).temperatur).toBe(0.7)
    expect(lokalFeinBereinigen({ temperatur: '0,7' }).temperatur).toBe(0.7)
    expect(lokalFeinBereinigen({ topK: '40' }).topK).toBe(40)
  })
})

describe('BAUPLAN 49 · lokalesModellName', () => {
  it('baut aus Georgs Qwen den erwarteten Namen (Doppelpunkt und Großbuchstaben weg)', () => {
    expect(lokalesModellName('qwen3.8:27b-mtp-q4_K_M')).toBe('flowforge-qwen3.8-27b-mtp-q4_k_m')
  })

  it('lässt Punkte, Unterstriche und Bindestriche stehen, zieht Mehrfach-Bindestriche zusammen', () => {
    expect(lokalesModellName('gpt-oss:20b')).toBe('flowforge-gpt-oss-20b')
    expect(lokalesModellName('Llama 3.1 / 8B')).toBe('flowforge-llama-3.1-8b')
    expect(lokalesModellName('a::b')).toBe('flowforge-a-b')
  })

  it('ist stabil: derselbe Name beim zweiten Aufruf (sonst lüde Ollama jedes Mal neu)', () => {
    expect(lokalesModellName('qwen3.8:27b')).toBe(lokalesModellName('qwen3.8:27b'))
    expect(lokalesModellName(lokalesModellName('x'))).toBe('flowforge-flowforge-x')
  })

  it('übersteht leere Eingaben ohne Absturz', () => {
    expect(lokalesModellName('')).toBe('flowforge-')
    expect(lokalesModellName(undefined)).toBe('flowforge-')
  })
})

describe('BAUPLAN 49 · ollamaParameterAus', () => {
  it('setzt num_ctx immer und sonst nur belegte Felder — Ollama-Standard bleibt ungesetzt', () => {
    expect(ollamaParameterAus(LOKAL_FEIN_VORLAGEN['ollama-standard'], 65536)).toEqual({
      num_ctx: 65536
    })
  })

  it('übersetzt die Feldnamen in die Modelfile-Parameter von Ollama', () => {
    expect(ollamaParameterAus(LOKAL_FEIN_VORLAGEN['qwen-coding'], 65536)).toEqual({
      num_ctx: 65536,
      temperature: 0.6,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
      repeat_penalty: 1.0
    })
    expect(ollamaParameterAus({ antwortlaenge: 8192, entwurfsTokens: 4 }, 32768)).toEqual({
      num_ctx: 32768,
      num_predict: 8192,
      draft_num_predict: 4
    })
  })

  it('bereinigt dabei — ein Wert außerhalb der Grenze wird nicht an Ollama geschickt', () => {
    const p = ollamaParameterAus({ temperatur: 9, topK: 20 }, 65536)
    expect(p).toEqual({ num_ctx: 65536, top_k: 20 })
    expect(p).not.toHaveProperty('temperature')
    // presence_penalty gibt es bei Ollama nicht — darf nie auftauchen.
    expect(Object.keys(ollamaParameterAus(LOKAL_FEIN_VORLAGEN['qwen-denken'], 65536))).not.toContain(
      'presence_penalty'
    )
  })

  it('Min-p 0 ist ein gesetzter Wert, kein „leer"', () => {
    expect(ollamaParameterAus({ minP: 0 }, 65536)).toEqual({ num_ctx: 65536, min_p: 0 })
  })
})

describe('BAUPLAN 49 · lokalFeinVorlageErkennen (aktiver Knopf im Dialog)', () => {
  it('erkennt jede Vorlage an ihren Werten', () => {
    for (const [name, vorlage] of Object.entries(LOKAL_FEIN_VORLAGEN))
      expect(lokalFeinVorlageErkennen(vorlage)).toBe(name)
  })

  it('erkennt Ollama-Standard auch bei fehlendem oder leerem Objekt', () => {
    expect(lokalFeinVorlageErkennen(undefined)).toBe('ollama-standard')
    expect(lokalFeinVorlageErkennen({})).toBe('ollama-standard')
    expect(lokalFeinVorlageErkennen({ temperatur: '' })).toBe('ollama-standard')
  })

  it('eine eigene Mischung ist keine Vorlage (null)', () => {
    expect(lokalFeinVorlageErkennen({ ...LOKAL_FEIN_VORLAGEN['qwen-denken'], temperatur: 0.8 })).toBe(null)
    expect(lokalFeinVorlageErkennen({ ...LOKAL_FEIN_VORLAGEN['qwen-coding'], antwortlaenge: 4096 })).toBe(
      null
    )
    expect(lokalFeinVorlageErkennen({ topK: 20 })).toBe(null)
  })

  it('Denken und Coding unterscheiden sich nur in der Temperatur — und werden trotzdem auseinandergehalten', () => {
    expect(lokalFeinVorlageErkennen({ ...LOKAL_FEIN_VORLAGEN['qwen-coding'], temperatur: 1.0 })).toBe(
      'qwen-denken'
    )
    expect(lokalFeinVorlageErkennen({ ...LOKAL_FEIN_VORLAGEN['qwen-denken'], temperatur: 0.6 })).toBe(
      'qwen-coding'
    )
  })
})
