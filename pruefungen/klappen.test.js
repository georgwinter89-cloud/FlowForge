// Prüfungen zu den Einklapp-Zuständen je Projekt (BAUPLAN 30): gespeichert im
// Datenordner je Projektpfad, nur Booleans, kaputte Datei → leer.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { klappenLaden, klappenSpeichern } from '../src/main/klappen.js'

const datei = path.join(app.getPath('userData'), 'klappen.json')

describe('Klappen-Zustände', () => {
  it('speichert je Projektpfad und lädt sie wieder', () => {
    expect(klappenSpeichern('C:\\A', { 'bib:uebung': true, 'karten:erledigt': false }).ok).toBe(
      true
    )
    expect(klappenSpeichern('C:\\B', { 'bib:uebung': false }).ok).toBe(true)
    expect(klappenLaden('C:\\A').zustaende).toEqual({
      'bib:uebung': true,
      'karten:erledigt': false
    })
    expect(klappenLaden('C:\\B').zustaende).toEqual({ 'bib:uebung': false })
    expect(klappenLaden('C:\\unbekannt').zustaende).toEqual({})
  })
  it('lässt nur Booleans unter String-Schlüsseln durch', () => {
    klappenSpeichern('C:\\C', { gut: true, zahl: 1, text: 'ja', '': true })
    expect(klappenLaden('C:\\C').zustaende).toEqual({ gut: true })
  })
  it('kaputte Datei → leer, danach wieder beschreibbar', () => {
    fs.writeFileSync(datei, '{kaputt', 'utf8')
    expect(klappenLaden('C:\\A').zustaende).toEqual({})
    expect(klappenSpeichern('C:\\A', { x: false }).ok).toBe(true)
    expect(klappenLaden('C:\\A').zustaende).toEqual({ x: false })
  })
})
