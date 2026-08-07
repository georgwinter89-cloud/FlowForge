import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Hauptprozess: Abhängigkeiten (v.a. das Agent-SDK mit seiner nativen claude.exe)
  // bleiben extern in node_modules statt mitgebündelt zu werden.
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()]
  }
})
