// Prüfskripte (seit Zweitaudit-Behebung 14.08.2026): `npm test` fährt die
// Regel-Prüfungen in pruefungen/ — ohne Electron, ohne laufenden Motor.
// Die Motor-Module importieren { app } aus 'electron'; der Alias ersetzt das
// durch einen kleinen Stub, damit die reinen Regel-Funktionen ladbar sind.
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const hier = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: { electron: path.join(hier, 'pruefungen', 'electronStub.js') }
  },
  test: {
    include: ['pruefungen/**/*.test.js']
  }
})
