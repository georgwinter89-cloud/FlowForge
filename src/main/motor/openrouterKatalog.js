// OpenRouter-Modellkatalog (Bauschritt 60): EINE Hauptprozess-Quelle für die
// Modellliste und die Anzeige-Preise der Einstellungen. Kein Electron-Import —
// das Modul bleibt einzeln erprobbar (Bauplan-Regel), der IPC-Handler wohnt in
// index.js.
//
// Die Preisliste dient NUR der Anzeige: Gerechnet wird mit ihr nie — die
// echten Kosten eines Laufs misst der Übersetzer aus usage.cost der Antworten
// (Cache-Rabatt und Tageszeit-Staffeln machten jede Basispreis-Rechnung
// systematisch falsch).
//
// Eingedampft wird HIER, im Hauptprozess: Die Rohliste von openrouter.ai ist
// gemessen ~687 KB — je Modell bleiben genau die fünf Felder übrig, die die
// Einstellungen zeigen. Nur die schmale Liste geht über IPC.

// Wie lange ein geholter Katalog gilt. Die Liste ändert sich selten, und der
// Einstellungs-Dialog wird gern mehrfach hintereinander geöffnet — jedes Mal
// neu laden hieße jedes Mal ~687 KB vom Anbieter ziehen.
export const KATALOG_TTL_MS = 10 * 60 * 1000

const ABRUF_ZEITGRENZE_MS = 8000

// Zwischenspeicher im Modul, je Ziel-Adresse genau ein Stand: Der Prüfstand
// (FLOWFORGE_OPENROUTER_ZIEL) und das echte OpenRouter dürfen sich nie
// gegenseitig eine fremde Liste unterschieben.
let zwischenspeicher = null // { ziel, geholtAm, modelle }

// Nur für Prüfungen: den Zwischenspeicher leeren.
export function katalogZuruecksetzen() {
  zwischenspeicher = null
}

// Preis-Strings des Anbieters („0.000008") in eine Zahl — alles, was keine
// endliche Zahl ergibt, wird ehrlich null („keine Angabe"), nie NaN und nie 0.
function preisZahl(wert) {
  if (wert == null || wert === '') return null
  const zahl = Number(wert)
  return Number.isFinite(zahl) ? zahl : null
}

// Kontextfenster: das kleinere von context_length und
// top_provider.context_length, sofern vorhanden — der Anbieter hinter
// OpenRouter kann weniger tragen als das Modell verspricht, und ein zu groß
// eingestelltes Fenster kappt er still. Fehlt beides (Ollama-Prüfstand liefert
// gar keins), bleibt es null.
function kontextZahl(eintrag) {
  const werte = [eintrag?.context_length, eintrag?.top_provider?.context_length]
    .map((w) => Number(w))
    .filter((w) => Number.isFinite(w) && w > 0)
  return werte.length > 0 ? Math.min(...werte) : null
}

// Einen Rohlisten-Eintrag auf die fünf Anzeige-Felder eindampfen. Der
// Ollama-Prüfstand liefert je Eintrag NUR id/object/created/owned_by
// (gemessen an 0.32.15, 26.08.2026) — dann sind Kontext und Preise null und
// nichts stirbt; der Name fällt auf die id zurück.
function eintragEindampfen(roh) {
  const id = String(roh?.id ?? '').trim()
  if (!id) return null
  return {
    id,
    name: typeof roh?.name === 'string' && roh.name.trim() ? roh.name.trim() : id,
    kontext: kontextZahl(roh),
    // Preise in USD je Token, wie der Anbieter sie führt — die Anzeige
    // rechnet selbst auf „je Million" um.
    preisHinein: preisZahl(roh?.pricing?.prompt),
    preisHeraus: preisZahl(roh?.pricing?.completion)
  }
}

// Die Modellliste vom Ziel holen: GET <ziel>/models (dieselbe Basis wie der
// Übersetzer, z.B. https://openrouter.ai/api/v1). Rückgabe
// { ok: true, modelle } oder { ok: false, fehler } — Ziel und Umleitungs-
// Kennzeichen setzt der IPC-Handler dazu, denn nur er kennt die Umgebung.
export async function katalogHolen({ ziel, neuLaden = false } = {}) {
  const basis = String(ziel ?? '')
    .trim()
    .replace(/\/+$/, '')
  if (!basis) return { ok: false, fehler: 'keine Ziel-Adresse' }

  if (
    !neuLaden &&
    zwischenspeicher &&
    zwischenspeicher.ziel === basis &&
    Date.now() - zwischenspeicher.geholtAm < KATALOG_TTL_MS
  )
    return { ok: true, modelle: zwischenspeicher.modelle }

  let daten
  try {
    const antwort = await fetch(basis + '/models', {
      signal: AbortSignal.timeout(ABRUF_ZEITGRENZE_MS)
    })
    if (!antwort.ok) return { ok: false, fehler: `Anbieter antwortete ${antwort.status}` }
    daten = await antwort.json()
  } catch (fehler) {
    return { ok: false, fehler: String(fehler?.message ?? fehler) }
  }

  const roh = Array.isArray(daten?.data) ? daten.data : null
  if (!roh) return { ok: false, fehler: 'Antwort ohne Modellliste' }

  const modelle = roh.map(eintragEindampfen).filter(Boolean)
  zwischenspeicher = { ziel: basis, geholtAm: Date.now(), modelle }
  return { ok: true, modelle }
}
