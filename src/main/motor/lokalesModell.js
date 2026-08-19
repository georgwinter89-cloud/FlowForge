// Abgeleitetes Ollama-Modell für den lokalen Block-Agenten (BAUPLAN 49).
//
// Warum es das gibt (gemessen 19.08.2026): Ohne abgeleitetes Modell lädt
// Ollama das Basis-Modell mit seinem Maximalkontext (Qwen3.8-27B: 262k) und
// spillt aus dem VRAM; die Claude-CLI schickt über den Anthropic-Modus weder
// num_ctx noch Sampling-Optionen mit. Der wirksame Hebel sind deshalb die
// Standardwerte AM MODELL: `POST /api/create { model, from, parameters }`
// legt `flowforge-<basis>` mit Georgs Kontextfenster und Feineinstellungen
// an (NDJSON-Stream, letzte Zeile {"status":"success"}). Erneutes Anlegen mit
// denselben Parametern lädt NICHT neu (gemessen) — das darf also vor jedem
// Lauf passieren; nur geänderte Werte kosten einen Neuladevorgang.
//
// Keine Electron-Abhängigkeit, nur fetch — damit lauf.js und Prüfskripte
// die Funktion direkt aufrufen können.
import { texte } from '../../shared/texte.js'
import { lokalesModellName, ollamaParameterAus } from '../../shared/lokalRegeln.js'

// 60 s: /api/create muss bei unveränderten Parametern nur Metadaten schreiben
// (Sekunden); ein ERSTES Anlegen kann die Gewichte neu verknüpfen — auch das
// liegt bei lokalen Platten weit unter einer Minute.
const ZEITGRENZE_MS = 60_000

function adresseBereinigen(adresse) {
  return String(adresse ?? '').trim().replace(/\/+$/, '')
}

// Liefert { ok:true, modell } (abgeleiteter Name) oder { ok:false, fehler }
// mit Klartext aus texte.lauf — nie still ein anderes Modell.
export async function lokalesModellBereitstellen({ adresse, basis, kontext, fein }) {
  const basisAdresse = adresseBereinigen(adresse)
  const basisName = String(basis ?? '').trim()
  const modell = lokalesModellName(basisName)
  const abbruch = AbortSignal.timeout(ZEITGRENZE_MS)

  // 1) Ist das Basis-Modell überhaupt da?
  let namen
  try {
    const antwort = await fetch(basisAdresse + '/api/tags', { signal: abbruch })
    if (!antwort.ok) return { ok: false, fehler: texte.lauf.lokalNichtErreichbar(basisAdresse) }
    const daten = await antwort.json()
    namen = (daten.models ?? []).map((m) => m.name)
  } catch {
    return { ok: false, fehler: texte.lauf.lokalNichtErreichbar(basisAdresse) }
  }
  const basisDa = namen.some((n) => n === basisName || n === basisName + ':latest')
  if (!basisDa) return { ok: false, fehler: texte.lauf.lokalModellFehlt(basisName) }

  // 2) Abgeleitetes Modell anlegen (oder unverändert bestätigen lassen).
  try {
    const antwort = await fetch(basisAdresse + '/api/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modell,
        from: basisName,
        parameters: ollamaParameterAus(fein, kontext)
      }),
      signal: abbruch
    })
    const roh = await antwort.text()
    if (!antwort.ok) {
      const text = fehlerTextAus(roh) || `HTTP ${antwort.status}`
      return { ok: false, fehler: texte.lauf.lokalModellFehler(text) }
    }
    let erfolg = false
    for (const zeile of roh.split(/\r?\n/)) {
      const t = zeile.trim()
      if (!t) continue
      let eintrag
      try {
        eintrag = JSON.parse(t)
      } catch {
        continue
      }
      if (eintrag?.error) return { ok: false, fehler: texte.lauf.lokalModellFehler(String(eintrag.error)) }
      if (eintrag?.status === 'success') erfolg = true
    }
    if (!erfolg) return { ok: false, fehler: texte.lauf.lokalModellFehler(texte.lauf.lokalModellKeinErfolg) }
  } catch (e) {
    return { ok: false, fehler: texte.lauf.lokalNichtErreichbar(basisAdresse) }
  }

  // 3) Fertig.
  return { ok: true, modell }
}

function fehlerTextAus(roh) {
  try {
    const daten = JSON.parse(roh)
    return daten?.error ? String(daten.error) : ''
  } catch {
    return String(roh ?? '').trim().slice(0, 200)
  }
}
