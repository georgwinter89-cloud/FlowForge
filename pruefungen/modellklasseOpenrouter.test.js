// Prüfungen zur sechsten Modellklasse „openrouter" (Bauschritt 59): freie
// Modellwahl über den eingebauten Übersetzer. Geprüft werden die Regeln im
// Katalog (Einordnung ZWISCHEN sehr-sparsam und lokal, Platzhalter-Alias,
// keine Denktiefe, kein Kosten-Hinweis, keine Vorbelegung), der KI-Assistent
// (schlägt openrouter nie vor), die vier Einstellungs-Felder (Standard +
// Speichern + Bereinigung — inklusive „fremder Aufrufer ohne Feld löscht den
// Schlüssel NICHT"), die harte WebSearch/WebFetch-Sperre an der echten
// pruefeWerkzeug, die Kosten-Ehrlichkeit (null = „nicht gemessen", nie 0)
// in metrikRegeln, die Texte der Oberfläche und — am Quelltext — die
// Startprüfung, die Weiche und die Fund-4-feste Options-Übergabe in lauf.js
// samt Motor und Renderer.
//
// Vertrauens-Entscheidung (Georg, 25.08.2026, Korrektur in der Session):
// OpenRouter-Prüfer zählen wie jedes CLOUD-Modell — kein Abnahme-Hinweis,
// kein Tor-Anker-Zwang. Der Gegenpol steht additiv in lokalerPruefer.test.js.
//
// Rot-vor-Grün: Vor Bauschritt 59 hatte MODELL_KLASSEN fünf Einträge,
// MODELL_KLASSE_OPENROUTER/klasseIstOpenRouter gab es nicht, einstellungen.js
// kannte die vier openRouter*-Felder nicht, pruefeWerkzeug ließ WebSearch in
// jeder Motor-Instanz zur Rückfrage durch, und die texte-Schlüssel fehlten.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Eigener Datenordner (Muster modellklasseLokal.test.js): Die anderen
// Prüfdateien teilen sich den Stub-Ordner und schreiben dort einstellungen.json.
const datenOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-openrouter-'))
vi.mock('electron', () => ({
  app: { getPath: () => datenOrdner, isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: {},
  shell: {}
}))

const {
  BLOCK_KATALOG,
  MODELL_KLASSEN,
  MODELL_KLASSE_OPENROUTER,
  blockDefinition,
  blockModellKlasse,
  klasseHatKostenHinweis,
  klasseIstLokal,
  klasseIstOpenRouter,
  klasseKenntDenktiefe,
  modellKlasseGueltig,
  sdkModell,
  unterModellFuer
} = await import('../src/shared/blockKatalog.js')
const { pruefeEigenenBlock } = await import('../src/shared/blockRegeln.js')
const { vorschlagSaeubern } = await import('../src/main/blockAssistent.js')
const { einstellungenLaden, einstellungenSpeichern } = await import('../src/main/einstellungen.js')
const { pruefeWerkzeug } = await import('../src/main/motor/claudeCodeMotor.js')
const { laufExtraktAusBericht } = await import('../src/shared/metrikRegeln.js')
const { texte } = await import('../src/shared/texte.js')

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lesen = (rel) => fs.readFileSync(path.join(wurzel, rel), 'utf8')

beforeEach(() => {
  fs.rmSync(path.join(datenOrdner, 'einstellungen.json'), { force: true })
})

describe('Bauschritt 59 · Klasse openrouter im Katalog', () => {
  it('steht ZWISCHEN sehr-sparsam und lokal — die Rangfolge trägt die Unteraufgaben-Regel', () => {
    expect(MODELL_KLASSEN.indexOf('openrouter')).toBe(MODELL_KLASSEN.indexOf('sehr-sparsam') + 1)
    expect(MODELL_KLASSEN.at(-1)).toBe('lokal')
    expect(MODELL_KLASSE_OPENROUTER).toBe('openrouter')
    expect(modellKlasseGueltig('openrouter')).toBe('openrouter')
  })

  it('klasseIstOpenRouter erkennt genau diese eine Klasse — und lokal bleibt getrennt', () => {
    expect(MODELL_KLASSEN.filter(klasseIstOpenRouter)).toEqual(['openrouter'])
    expect(klasseIstOpenRouter('lokal')).toBe(false)
    expect(klasseIstOpenRouter(undefined)).toBe(false)
    expect(klasseIstLokal('openrouter')).toBe(false)
  })

  it('der SDK-Alias ist der Platzhalter „openrouter" — sonst fiele die Klasse still auf Opus', () => {
    expect(sdkModell('openrouter')).toBe('openrouter')
  })

  it('kennt keine Denktiefe und trägt keinen Kosten-Hinweis', () => {
    expect(klasseKenntDenktiefe('openrouter')).toBe(false)
    expect(klasseHatKostenHinweis('openrouter')).toBe(false)
  })

  it('Unteraufgaben eines OpenRouter-Blocks bleiben auf dem eigenen Modell', () => {
    const bauer = blockDefinition('bauer')
    expect(unterModellFuer(bauer, 'openrouter', 'sparsam')).toBe('openrouter')
    expect(unterModellFuer(bauer, 'openrouter', 'wieBlock')).toBe('openrouter')
  })

  it('kein Katalog-Block ist auf openrouter vorbelegt — immer Georgs bewusste Wahl', () => {
    for (const def of BLOCK_KATALOG) {
      expect(def.modell).not.toBe('openrouter')
      expect(blockModellKlasse(def)).not.toBe('openrouter')
    }
  })

  it('an der Karte und im Editor ist openrouter wählbar', () => {
    expect(blockModellKlasse(blockDefinition('bauer'), { modell: 'openrouter' })).toBe('openrouter')
    const grund = { name: 'Fremder Bauer', auftrag: 'Du baust.' }
    expect(pruefeEigenenBlock({ ...grund, modell: 'openrouter' }).block.modell).toBe('openrouter')
  })
})

describe('Bauschritt 59 · Der KI-Assistent schlägt openrouter nie vor', () => {
  it('ein Vorschlag mit modell openrouter wird auf Standard gezogen (wie Extra und lokal)', () => {
    expect(vorschlagSaeubern({ modell: 'openrouter' }).modell).toBe('standard')
    expect(vorschlagSaeubern({ modell: 'lokal' }).modell).toBe('standard')
    expect(vorschlagSaeubern({ modell: 'sparsam' }).modell).toBe('sparsam')
  })

  it('auch die Klassen-Liste für den Assistenten filtert openrouter heraus (am Quelltext)', () => {
    const assistent = lesen('src/main/blockAssistent.js')
    expect(assistent).toMatch(/!klasseIstOpenRouter\(k\)/)
  })
})

describe('Bauschritt 59 · Einstellungen: die vier openRouter-Felder', () => {
  it('Standard: Häkchen aus, Schlüssel und Modell leer, Kontext 200000', () => {
    const e = einstellungenLaden().einstellungen
    expect(e.openRouterAktiv).toBe(false)
    expect(e.openRouterSchluessel).toBe('')
    expect(e.openRouterModell).toBe('')
    expect(e.openRouterKontext).toBe(200000)
  })

  it('Speichern übernimmt alle vier Felder — getrimmt, Kontext auch als Ziffern-Text', () => {
    const ergebnis = einstellungenSpeichern({
      motorModus: 'abo',
      openRouterAktiv: true,
      openRouterSchluessel: '  sk-or-geheim  ',
      openRouterModell: '  stealth/ox-alpha  ',
      openRouterKontext: '1000000'
    })
    expect(ergebnis.ok).toBe(true)
    const e = einstellungenLaden().einstellungen
    expect(e.openRouterAktiv).toBe(true)
    expect(e.openRouterSchluessel).toBe('sk-or-geheim')
    expect(e.openRouterModell).toBe('stealth/ox-alpha')
    expect(e.openRouterKontext).toBe(1000000)
  })

  it('ein fremder Aufrufer ohne die Felder löscht Schlüssel, Modell und Kontext NICHT', () => {
    einstellungenSpeichern({
      motorModus: 'abo',
      openRouterAktiv: true,
      openRouterSchluessel: 'sk-or-geheim',
      openRouterModell: 'stealth/ox-alpha',
      openRouterKontext: 1000000
    })
    // Ein älterer Dialog kennt die Felder nicht — genau der Fall, in dem das
    // apiSchluessel-Muster den Schlüssel still leeren würde.
    einstellungenSpeichern({ motorModus: 'abo' })
    const e = einstellungenLaden().einstellungen
    expect(e.openRouterSchluessel).toBe('sk-or-geheim')
    expect(e.openRouterModell).toBe('stealth/ox-alpha')
    expect(e.openRouterKontext).toBe(1000000)
    // Das Häkchen folgt bewusst dem lokalBlockAgent-Muster (Boolean) — ohne
    // Feld fällt es auf aus, nie auf ein stilles An.
    expect(e.openRouterAktiv).toBe(false)
  })

  it('Georgs bewusstes Leeren des Schlüssels bleibt ein Leeren', () => {
    einstellungenSpeichern({ motorModus: 'abo', openRouterSchluessel: 'sk-or-geheim' })
    einstellungenSpeichern({ motorModus: 'abo', openRouterSchluessel: '' })
    expect(einstellungenLaden().einstellungen.openRouterSchluessel).toBe('')
  })

  it('Kontext-Unsinn fällt auf den Standard — beim Speichern wie beim Laden von Hand-Dateien', () => {
    einstellungenSpeichern({ motorModus: 'abo', openRouterKontext: 'quatsch' })
    expect(einstellungenLaden().einstellungen.openRouterKontext).toBe(200000)
    einstellungenSpeichern({ motorModus: 'abo', openRouterKontext: -5 })
    expect(einstellungenLaden().einstellungen.openRouterKontext).toBe(200000)
    fs.writeFileSync(
      path.join(datenOrdner, 'einstellungen.json'),
      JSON.stringify({ motorModus: 'abo', openRouterKontext: 3.14, openRouterAktiv: 'ja' })
    )
    const e = einstellungenLaden().einstellungen
    expect(e.openRouterKontext).toBe(200000)
    expect(e.openRouterAktiv).toBe(false)
  })
})

describe('Bauschritt 59 · WebSearch/WebFetch sind in OpenRouter-Motoren HART gesperrt', () => {
  const projekt = 'D:\\pruefungen-uebungsprojekt'
  // Alle Positionen bis zum neuen letzten Parameter openrouterMotor.
  const urteil = (name, { nurLesen = false, openrouterMotor = false } = {}) =>
    pruefeWerkzeug(name, {}, projekt, nurLesen, false, true, false, false, false, false, false, '', [], null, false, [], openrouterMotor)

  it('WebSearch und WebFetch enden mit Klartext-Sperre statt Rechte-Frage', () => {
    for (const name of ['WebSearch', 'WebFetch']) {
      const u = urteil(name, { openrouterMotor: true })
      expect(u.gesperrt).toBe(texte.rechteFrage.openrouterInternetFuerAgent)
      expect(u.tickerText).toBe(texte.ticker.openrouterInternetGesperrt)
      expect(u.frage).toBeUndefined()
    }
    // Seit Bauschritt 60 zeigt die Sperre den ECHTEN Ersatzweg: Die zwei
    // Nachschlage-Werkzeuge gibt es in OpenRouter-Motoren jetzt wirklich.
    expect(texte.rechteFrage.openrouterInternetFuerAgent).toMatch(/web_suche und webseite_lesen/)
    expect(texte.ticker.openrouterInternetGesperrt).toMatch(/web_suche und webseite_lesen/)
  })

  it('die Sperre gilt auch unter „darf nur lesen" — mit dem OpenRouter-Grund, keiner Ausrede', () => {
    const u = urteil('WebSearch', { nurLesen: true, openrouterMotor: true })
    expect(u.gesperrt).toBe(texte.rechteFrage.openrouterInternetFuerAgent)
  })

  it('ohne OpenRouter-Motor bleibt alles wie bisher (Rückfrage statt Sperre)', () => {
    const u = urteil('WebSearch')
    expect(u.gesperrt).toBeUndefined()
    expect(u.frage).toBeTruthy()
  })

  it('andere Werkzeuge eines OpenRouter-Motors bleiben unberührt', () => {
    expect(urteil('Read', { openrouterMotor: true }).erlaubt).toBe(true)
  })
})

describe('Bauschritt 59 · Kosten null heißt „nicht gemessen", nie 0', () => {
  it('metrikRegeln zählt null als „ohne Angabe" — je Lauf und je Block', () => {
    const extrakt = laufExtraktAusBericht(
      {
        gestartetAm: '2026-08-25T10:00:00.000Z',
        verbrauch: { tokens: 1234, kostenUsd: null },
        blockErgebnisse: [
          { block: 'Bauer', zustand: 'erfolgreich', tokens: 1234, kostenUsd: null, klasse: 'openrouter' }
        ]
      },
      'D:\\projekt'
    )
    expect(extrakt.kostenUsd).toBe(null)
    expect(extrakt.bloecke[0].kostenUsd).toBe(null)
  })

  it('der Motor addiert die erfundenen CLI-Kosten für openrouter nicht (am Quelltext)', () => {
    const motor = lesen('src/main/motor/claudeCodeMotor.js')
    expect(motor).toMatch(/!lokal && !openrouter && typeof nachricht\.total_cost_usd === 'number'/)
    expect(motor).toMatch(/!lokal && !openrouter && modus === 'api' && ausgabenObergrenzeUsd > 0/)
  })
})

describe('Bauschritt 59 · Texte, auf die die Oberfläche baut', () => {
  it('Karte/Editor: Name, Hinweise und der Klartext-Modellname', () => {
    const tk = texte.kette
    expect(tk.modellNamen.openrouter).toBe('OpenRouter')
    expect(tk.openrouterModellName('stealth/ox-alpha')).toBe('OpenRouter (stealth/ox-alpha)')
    expect(tk.modellOpenRouterHinweis).toMatch(/nie still/)
    expect(tk.modellOpenRouterHinweis).toMatch(/nicht gemessen/)
    // Der Denktiefe-Satz gehört der Klasse selbst — weder Haiku noch Ollama.
    expect(tk.denktiefeOpenrouterHinweis).not.toMatch(/Haiku|Ollama/)
    expect(tk.denktiefeOpenrouterHinweis).toMatch(/Denktiefe/)
  })

  it('Lauf: drei getrennte Klartext-Absagen und der Übersetzer-Fehler', () => {
    const tl = texte.lauf
    for (const satz of [tl.openrouterNichtErlaubt, tl.openrouterSchluesselFehlt, tl.openrouterModellFehlt]) {
      expect(satz).toMatch(/OpenRouter/)
      expect(satz).toMatch(/nie still/)
    }
    expect(tl.openrouterUebersetzerFehler('kaputt')).toMatch(/kaputt/)
    expect(tl.openrouterUebersetzerFehler('')).toMatch(/unbekannter Fehler/)
  })

  it('Ticker und Bericht: eigene OpenRouter-Formulierungen statt der Ollama-Sätze', () => {
    const tt = texte.ticker
    expect(tt.openrouterSessionGestartet('stealth/ox-alpha', 1048576)).toMatch(/stealth\/ox-alpha/)
    expect(tt.openrouterSessionGestartet('m', 200000)).not.toMatch(/Ollama|lokal/i)
    expect(tt.openrouterEigeneSession('Bauer', 'stealth/ox-alpha')).toMatch(/Bauer/)
    expect(tt.blockAgentGestartetOpenrouter('Bauer', 'OpenRouter (m)')).toMatch(/OpenRouter \(m\)/)
    expect(typeof tt.openrouterInternetGesperrt).toBe('string')
    // Prüfstands-Weiche: Eine gesetzte Umleitung wird nie verschwiegen.
    expect(tt.openrouterZielUmgeleitet('http://127.0.0.1:11434/v1')).toMatch(/http:\/\/127\.0\.0\.1:11434\/v1/)
    expect(tt.openrouterZielUmgeleitet('x')).toMatch(/Prüfstand/)
    // Bauschritt 60: Die Session-Zeile verspricht keine Preisliste mehr,
    // sondern die MESSUNG — Kosten kommen aus den Antworten des Anbieters.
    expect(tt.openrouterSessionGestartet('m', 200000)).toMatch(
      /Kosten übernimmt FlowForge aus den Antworten des Anbieters/
    )
    // „Nicht gemessen" bleibt der Rückfall, wenn der Anbieter nichts meldet —
    // daneben gibt es jetzt die Zeile für den GEMESSENEN Betrag.
    expect(texte.laufberichte.openrouterKosten).toMatch(/nicht gemessen/)
    expect(texte.laufberichte.openrouterKostenGemessen(0.0042)).toMatch(/0,0042/)
    expect(texte.laufberichte.openrouterKostenGemessen(0.0042)).toMatch(/echtes Geld/)
    expect(texte.laufberichte.openrouterKostenGemessen(0.0042)).not.toMatch(/Abo-Kontingent[^,]*enthalten/)
  })

  it('Einstellungen: Bereich, Felder und der ehrliche Daten-Hinweis', () => {
    const te = texte.einstellungen
    expect(te.openRouterUeberschrift).toBe('OpenRouter')
    for (const schluessel of [
      'openRouterAktiv',
      'openRouterAktivHinweis',
      'openRouterSchluesselFeld',
      'openRouterModellFeld',
      'openRouterKontextFeld',
      'openRouterKontextHinweis',
      'fehlerOpenRouterKontext'
    ])
      expect(typeof te[schluessel], schluessel).toBe('string')
    expect(te.openRouterAktivHinweis).toMatch(/nie still/)
    // Neutrale Anbieterwahl (Entscheidung Georg, 25.08.2026): keine Warn-
    // oder Anbieterhinweise im Dialog — der frühere Daten-Hinweis ist raus.
    expect(te.openRouterDatenHinweis).toBeUndefined()
  })
})

describe('Bauschritt 59 · Lauf und Motor (am Quelltext)', () => {
  it('lauf.js: klassenbasierte Startprüfung mit drei getrennten Absagen', () => {
    const lauf = lesen('src/main/lauf.js')
    expect(lauf).toMatch(/klasseIstOpenRouter\(blockModellKlasse\(defVon\(e\.blockId\), e\)\)/)
    expect(lauf).toMatch(/texte\.lauf\.openrouterNichtErlaubt/)
    expect(lauf).toMatch(/texte\.lauf\.openrouterSchluesselFehlt/)
    expect(lauf).toMatch(/texte\.lauf\.openrouterModellFehlt/)
  })

  it('lauf.js: eigene Motor-Instanz, Option FELDWEISE (Fund-4-Falle), Platzhalter und Klartext-Name', () => {
    const lauf = lesen('src/main/lauf.js')
    expect(lauf).toMatch(/openrouterEigeneSession/)
    // Kein Spread — jedes Feld einzeln, sonst kommt ein neues nie im Motor an.
    expect(lauf).not.toMatch(/\.\.\.openrouterOption/)
    expect(lauf).toMatch(/modell: openrouterOption\.modell/)
    expect(lauf).toMatch(/kontext: openrouterOption\.kontext/)
    expect(lauf).toMatch(/schluessel: openrouterOption\.schluessel/)
    expect(lauf).toMatch(/istOpenRouter \? 'openrouter'/)
    expect(lauf).toMatch(/texte\.kette\.openrouterModellName\(einstellungen\.openRouterModell\)/)
    // Kein Adress-Pool: die lokale Zuteilung bleibt an klasseIstLokal hängen.
    expect(lauf).not.toMatch(/openrouterZuteilung|openrouterPool/)
    // Kontextfenster-Wächter (Fund-1-Falle andersherum): Das feste
    // OpenRouter-Fenster darf nie als Claude-Fenster gelernt werden.
    expect(lauf).toMatch(/!knotenLokal && !knotenOpenRouter/)
  })

  it('Motor: Übersetzer je Instanz mit Abbau in allen Endpfaden, Umgebung ohne echten Schlüssel', () => {
    const motor = lesen('src/main/motor/claudeCodeMotor.js')
    expect(motor).toMatch(/uebersetzerStarten\(\{/)
    // Abbau im finally UND im Fänger der Schleife — wie die Zählstelle.
    expect(motor.match(/uebersetzerAbbauen\(\)/g)?.length).toBeGreaterThanOrEqual(2)
    expect(motor).toMatch(/ANTHROPIC_AUTH_TOKEN = 'openrouter'/)
    // Prüfstands-Weiche: Die Variable kommt aus der HAUPTPROZESS-Umgebung,
    // wird als `ziel` an den Übersetzer gereicht und nie still umgeleitet.
    expect(motor).toMatch(/process\.env\.FLOWFORGE_OPENROUTER_ZIEL \|\| undefined/)
    expect(motor).toMatch(/ziel: pruefstandZiel/)
    expect(motor).toMatch(/texte\.ticker\.openrouterZielUmgeleitet\(pruefstandZiel\)/)
    // Der OpenRouter-Zweig steht VOR dem API-Zweig — sonst landete Georgs
    // Anthropic-Schlüssel in der OpenRouter-Umgebung.
    expect(motor.indexOf("umgebung.ANTHROPIC_BASE_URL = uebersetzer.adresse")).toBeLessThan(
      motor.indexOf("else if (modus === 'api') umgebung.ANTHROPIC_API_KEY = apiSchluessel")
    )
  })

  it('Renderer: Hinweise an Karte und Editor, Kosten-Zeile „nicht gemessen"', () => {
    const leinwand = lesen('src/renderer/src/Leinwand.jsx')
    expect(leinwand).toMatch(/klasseIstOpenRouter\(modellKlasse\) && \(/)
    expect(leinwand).toMatch(/tk\.modellOpenRouterHinweis/)
    expect(leinwand).toMatch(/tk\.denktiefeOpenrouterHinweis/)
    expect(leinwand).toMatch(/tb\.openrouterKosten/)
    const editor = lesen('src/renderer/src/BlockEditor.jsx')
    expect(editor).toMatch(/klasseIstOpenRouter\(werte\.modell\) && \(/)
    expect(editor).toMatch(/tkette\.modellOpenRouterHinweis/)
    expect(editor).toMatch(/tkette\.denktiefeOpenrouterHinweis/)
    const dialog = lesen('src/renderer/src/Einstellungen.jsx')
    expect(dialog).toMatch(/checked=\{openRouterAktiv\}/)
    expect(dialog).toMatch(/value=\{openRouterSchluessel\}/)
    // Neutrale Anbieterwahl (0.60.1): der Dialog rendert KEINEN Daten-Hinweis.
    expect(dialog).not.toMatch(/openRouterDatenHinweis/)
    const speichern = dialog.slice(dialog.indexOf('async function speichern()'))
    for (const feld of ['openRouterAktiv', 'openRouterSchluessel', 'openRouterModell', 'openRouterKontext'])
      expect(speichern).toContain(feld)
  })
})

// ———————————————————————————————————————————————————————————————————————————
// Bauschritt 60 · OpenRouter im Alltag: Websuche, gemessene Kosten, eigener
// Verbrauchs-Topf. Die Mess-Prüfungen dazu fahren echte HTTP-Runden
// (uebersetzer.test.js: usage:{include:true}, usage.cost; webWerkzeuge.test.js:
// der openrouter-Motor trägt mcp__web__*; openrouterKatalog.test.js: der
// Katalog gegen Stub-Anbieter). Hier stehen die Quelltext-Anker der
// Verdrahtung — die Stellen, die keine reine Funktion hergibt.
//
// Rot vor Grün: Vor Bauschritt 60 hieß das Gate `const webServer = lokal`,
// blockVerbrauch kannte kein openrouter-Feld, lauf.js keinen
// gesamtVerbrauch.openrouter-Topf und keine websuche-Option für
// OpenRouter-Motoren, und einen Katalog-Handler gab es nicht.
// ———————————————————————————————————————————————————————————————————————————
describe('Bauschritt 60 · Verdrahtung (am Quelltext)', () => {
  it('Motor: webServer-Gate umfasst openrouter — holeLuft bleibt ein reines Lokal-Thema', () => {
    const motor = lesen('src/main/motor/claudeCodeMotor.js')
    expect(motor).toMatch(/const webServer = fremd/)
    expect(motor).toMatch(/holeLuft: lokal\s*\n?\s*\?/)
    // Der System-Zusatz der Websuche hängt an `fremd`, nicht an `lokal`.
    expect(motor).toMatch(/\(fremd \? '\\n' \+ texte\.agentenWebsuche\.systemZusatz : ''\)/)
  })

  it('Motor: blockVerbrauch trägt das openrouter-Kennzeichen und die Delta-Buchung der gemessenen Kosten', () => {
    const motor = lesen('src/main/motor/claudeCodeMotor.js')
    expect(motor).toMatch(/openrouter: Boolean\(openrouter\)/)
    // Delta-Buchung (Muster kostenStand): stand().kostenUsd ist je Instanz
    // kumuliert — mehrere result-Nachrichten je Anlauf buchen nur den Zuwachs.
    expect(motor).toMatch(/let openrouterKostenStand = null/)
    expect(motor).toMatch(/gemessen - openrouterKostenStand/)
    // Die Werkstatt bekommt den Übersetzer-Verkehr als eigene Art — mit
    // EIGENER Abmelde-Variable, nicht der der Zählstelle.
    expect(motor).toMatch(/art: 'openrouter'/)
    expect(motor).toMatch(/let uebersetzerWerkstattAbmelden = null/)
    expect(motor).toMatch(/uebersetzerWerkstattAbmelden\?\.\(\)/)
  })

  it('lauf.js: eigener Topf verbrauch.openrouter — echte Anbieter-Kosten nie im Abo-Feld', () => {
    const lauf = lesen('src/main/lauf.js')
    expect(lauf).toMatch(/openrouter: \{ tokens: 0, dauerMs: 0, kostenUsd: null \}/)
    expect(lauf).toMatch(/gesamtVerbrauch\.openrouter\.dauerMs \+= anlaufDauerMs/)
    expect(lauf).toMatch(/gesamtVerbrauch\.openrouter\.tokens \+= zaehlTokens/)
    // Die Weiche: OpenRouter-Kosten in den Topf, alle anderen wie bisher in
    // die theoretische API-Kosten-Anzeige — blockKosten trägt beide weiter.
    expect(lauf).toMatch(/if \(knotenOpenRouter\)\s*\n\s*gesamtVerbrauch\.openrouter\.kostenUsd =/)
  })

  it('lauf.js: OpenRouter-Motoren bekommen die websuche-Option — feldweise neben dem openrouter-Literal', () => {
    const lauf = lesen('src/main/lauf.js')
    const openrouterZweig = lauf.slice(
      lauf.indexOf('...(openrouterOption'),
      lauf.indexOf('nurLesenBefehle: Boolean')
    )
    expect(openrouterZweig).toMatch(/websuche: \{ searxngAdresse: einstellungen\.searxngAdresse \?\? '' \}/)
  })

  it('index.js: Katalog-Handler mit derselben Prüfstands-Weiche wie der Übersetzer', () => {
    const index = lesen('src/main/index.js')
    expect(index).toMatch(/ipcMain\.handle\('openrouter-katalog'/)
    expect(index).toMatch(/process\.env\.FLOWFORGE_OPENROUTER_ZIEL \|\| ''/)
    expect(index).toMatch(/https:\/\/openrouter\.ai\/api\/v1/)
    expect(index).toMatch(/umgeleitet: Boolean\(pruefstandZiel\)/)
  })

  it('Werkstatt-Texte: eigene Art, neutrales Ziel, sechs ehrliche Grenzen', () => {
    expect(texte.werkstatt.artOpenrouter).toBe('OpenRouter')
    expect(texte.werkstatt.spalteZiel).toBe('Ziel')
    expect(texte.werkstatt.grenzen).toHaveLength(6)
    expect(texte.werkstatt.grenzen[5]).toMatch(/Übersetzer/)
  })
})
