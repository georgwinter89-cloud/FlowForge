// Prüfung zum Fazit-Stutzen (Zweit-Audit C-04).
// Rot-vor-Grün: Der agentId-Anfangsfall schlug vor der Behebung fehl (leeres Fazit).
import { describe, it, expect } from 'vitest'
import { fazitStutzen } from '../src/main/motor/claudeCodeMotor.js'

describe('C-04 · fazitStutzen', () => {
  it('stutzt CLI-Metadaten (agentId-Zeile, usage-Block) hinter dem Fazit', () => {
    expect(fazitStutzen('PRUEFUNG: BESTANDEN\nagentId: abc-123\n<usage>{"in":1}</usage>')).toBe(
      'PRUEFUNG: BESTANDEN'
    )
  })
  it('stutzt ein Fazit, das zufällig mit „agentId:" beginnt, NICHT auf leer', () => {
    const fazit = 'agentId: heißt die Kennung im Protokoll — genau das erklärt dieser Befund.'
    expect(fazitStutzen(fazit)).toBe(fazit)
  })
  it('lässt ein Fazit ohne Metadaten unverändert', () => {
    expect(fazitStutzen('Alles erledigt.')).toBe('Alles erledigt.')
  })
})
