// Prüfungen zur Nachrichtenform an die lokale Helfer-KI (Wunsch Georg,
// 18.08.2026, Punkt 1) und zum Zuschnitt der Aufträge (Punkt 3) in
// Alltagssprache:
//   (1) JEDE Nachricht, die FlowForge an die lokale KI schickt, hat die Form
//       { role: 'user', content: '<Text>' } — kein system-Eintrag, keine
//       tool-Rolle. Der frühere System-Text steht am Anfang der ersten
//       Nutzer-Nachricht; Werkzeug-Ergebnisse (echte tool_calls UND getarnte
//       Aufrufe) kommen als Nutzer-Nachricht mit dem Werkzeugnamen im Text;
//       das Nachhaken bei leerer Antwort ist eine Nutzer-Nachricht. Nur die
//       Antworten des Modells (role assistant) bleiben unverändert im Verlauf.
//   (2) Der Runden-Deckel liegt bei 48 (größere Aufträge brauchen mehr
//       Werkzeug-Runden) und wird ehrlich im Fehlertext genannt.
//   (3) Die Auftrags-Texte sagen den Block-Agenten nicht mehr „möglichst
//       kleine" Teilaufträge — die Abnahme-Pflicht (teilstueck_abnehmen)
//       bleibt genannt.
//
// Gemessen wird Verhalten, nicht Code: mit einem nachgestellten Ollama
// (fetch-Stub) werden ALLE Anfrage-Bodies eingefangen, die die vier Kreisläufe
// abschicken, und jede Nachricht darin geprüft.
//
// Rot vor Grün: Vor dem Umbau schickten alle vier Kreisläufe zuerst eine
// system-Nachricht und hängten Werkzeug-Ergebnisse als role 'tool' an;
// MAX_RUNDEN war 32.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  lokalRecherchieren,
  lokalReparieren,
  lokalEntwerfen,
  lokalBauen,
  KREISLAUF_SYSTEMTEXTE,
  lokaleHelferKontextSetzen,
  KONTEXT_FENSTER_STANDARD
} from '../src/main/motor/lokaleHelfer.js'
import { texte } from '../src/shared/texte.js'

// Ollama nachgestellt: Jede Antwort ist eine Nachricht des lokalen Modells —
// erst Werkzeugaufrufe, zuletzt das Fazit. Alle Anfragen werden mitgeschrieben.
function ollamaStub(antworten) {
  const anfragen = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, { body }) => {
      anfragen.push(JSON.parse(body))
      const naechste =
        typeof antworten === 'function'
          ? antworten()
          : (antworten.shift() ?? { message: { role: 'assistant', content: 'Fertig.' } })
      return { ok: true, status: 200, json: async () => naechste }
    })
  )
  return anfragen
}

function aufruf(name, eingabe) {
  return { function: { name, arguments: eingabe } }
}

function antwortMit(...aufrufe) {
  return { message: { role: 'assistant', content: '', tool_calls: aufrufe } }
}

const fazit = { message: { role: 'assistant', content: 'Fertig: alles gemeldet.' } }
const leer = { message: { role: 'assistant', content: '' } }

// Alle Nachrichten aller Anfragen, die NICHT vom Modell stammen.
function eigeneNachrichten(anfragen) {
  return anfragen.flatMap((a) => a.messages).filter((m) => m.role !== 'assistant')
}

// Ein Kreislauf-Lauf je Art, mit denselben Grund-Argumenten.
const kreislaeufe = {
  lokalRecherchieren: { starte: lokalRecherchieren, system: KREISLAUF_SYSTEMTEXTE.recherche },
  lokalReparieren: { starte: lokalReparieren, system: KREISLAUF_SYSTEMTEXTE.reparatur },
  lokalEntwerfen: { starte: lokalEntwerfen, system: KREISLAUF_SYSTEMTEXTE.entwurf },
  lokalBauen: { starte: lokalBauen, system: KREISLAUF_SYSTEMTEXTE.bau }
}

describe('Lokale Helfer-KI · jede Nachricht von FlowForge ist eine Nutzer-Nachricht', () => {
  let projektPfad
  beforeEach(() => {
    projektPfad = fs.mkdtempSync(path.join(os.tmpdir(), 'flowforge-rollen-'))
    fs.mkdirSync(path.join(projektPfad, 'src'), { recursive: true })
    fs.writeFileSync(path.join(projektPfad, 'src/a.js'), 'const a = 1\n')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    fs.rmSync(projektPfad, { recursive: true, force: true })
  })

  for (const [name, { starte, system }] of Object.entries(kreislaeufe)) {
    it(`${name}: kein system, kein tool — nur user; Auftakt beginnt mit dem Rahmentext`, async () => {
      const anfragen = ollamaStub([
        antwortMit(aufruf('datei_lesen', { pfad: 'src/a.js' })),
        antwortMit(aufruf('suchen', { muster: 'const' })),
        fazit
      ])
      const ergebnis = await starte({
        projektPfad,
        auftrag: 'Mein Auftrag: sieh dir src/a.js an.',
        modell: 'stub',
        adresse: 'http://stub'
      })
      expect(ergebnis.ok).toBe(true)
      expect(anfragen.length).toBe(3)

      // Jede Nachricht, die nicht vom Modell stammt: genau role 'user', String-content.
      const eigene = eigeneNachrichten(anfragen)
      expect(eigene.length).toBeGreaterThan(0)
      for (const m of eigene) {
        expect(m.role).toBe('user')
        expect(typeof m.content).toBe('string')
        expect(m).not.toHaveProperty('tool_name')
      }
      const rollen = new Set(anfragen.flatMap((a) => a.messages).map((m) => m.role))
      expect(rollen.has('system')).toBe(false)
      expect(rollen.has('tool')).toBe(false)

      // Der Auftakt: Rahmentext, Leerzeile, dann der Auftrag — in EINER Nachricht.
      for (const a of anfragen) {
        expect(a.messages[0].role).toBe('user')
        expect(a.messages[0].content.startsWith(system)).toBe(true)
        expect(a.messages[0].content).toBe(system + '\n\nMein Auftrag: sieh dir src/a.js an.')
      }

      // Nach echten tool_calls kommt das Ergebnis als Nutzer-Nachricht mit Werkzeugnamen.
      const letzte = anfragen[2].messages
      // [Auftakt, assistant(datei_lesen), user(Ergebnis), assistant(suchen), user(Ergebnis)]
      expect(letzte.length).toBe(5)
      expect(letzte[1].role).toBe('assistant')
      expect(letzte[2]).toEqual({
        role: 'user',
        content: texte.agentenLokaleHelfer.werkzeugErgebnis('datei_lesen', letzte[2].content.split('\n').slice(1).join('\n'))
      })
      expect(letzte[2].content.startsWith('Ergebnis von datei_lesen:\n')).toBe(true)
      expect(letzte[2].content).toMatch(/const a = 1/)
      expect(letzte[4].content.startsWith('Ergebnis von suchen:\n')).toBe(true)
      expect(letzte[4].content).toMatch(/src[\\/]a\.js:1/)
      // Strikte Abwechslung: user, assistant, user, assistant, user.
      expect(letzte.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user'])
    })
  }

  it('mehrere tool_calls in EINER Antwort → genau EINE Nutzer-Nachricht mit allen Ergebnissen', async () => {
    const anfragen = ollamaStub([
      antwortMit(
        aufruf('datei_lesen', { pfad: 'src/a.js' }),
        aufruf('suchen', { muster: 'const' }),
        aufruf('ordner_auflisten', { pfad: 'src' })
      ),
      fazit
    ])
    const ergebnis = await lokalRecherchieren({ projektPfad, auftrag: 'egal', modell: 'stub', adresse: 'http://stub' })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.schritte).toBe(3)
    const verlauf = anfragen[1].messages
    expect(verlauf.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    const gebuendelt = verlauf[2].content
    expect(gebuendelt.startsWith('Ergebnis von datei_lesen:\n')).toBe(true)
    expect(gebuendelt).toMatch(/const a = 1/)
    expect(gebuendelt).toMatch(/\n\nErgebnis von suchen:\n/)
    expect(gebuendelt).toMatch(/src[\\/]a\.js:1/)
    expect(gebuendelt).toMatch(/\n\nErgebnis von ordner_auflisten:\n/)
    expect(gebuendelt).toMatch(/a\.js/)
    expect((gebuendelt.match(/Ergebnis von /g) ?? []).length).toBe(3)
  })

  it('mehrere getarnte Aufrufe in EINER Antwort → ebenfalls EINE gebündelte Nutzer-Nachricht', async () => {
    const anfragen = ollamaStub([
      {
        message: {
          role: 'assistant',
          content:
            '{"name":"datei_lesen","arguments":{"pfad":"src/a.js"}}\n' +
            '{"name":"suchen","arguments":{"muster":"const"}}'
        }
      },
      fazit
    ])
    await lokalRecherchieren({ projektPfad, auftrag: 'egal', modell: 'stub', adresse: 'http://stub' })
    const verlauf = anfragen[1].messages
    expect(verlauf.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(verlauf[2].content).toMatch(/^Ergebnis von datei_lesen:\n[\s\S]*\n\nErgebnis von suchen:\n/)
  })

  it('Antwort ohne message oder Modell-Nachricht ohne role → im Verlauf nur user/assistant', async () => {
    // Erste Antwort: gar keine message; zweite: message ohne role (leer → Nachhaken);
    // dritte: Fazit. Vorher landete `{}` bzw. ein rollenloses Objekt im Verlauf.
    const anfragen = ollamaStub([{}, { message: { content: '' } }, fazit])
    const ergebnis = await lokalRecherchieren({ projektPfad, auftrag: 'egal', modell: 'stub', adresse: 'http://stub' })
    // Erste leere Antwort → Nachhaken; zweite leere Antwort → ehrlicher Fehlschlag.
    expect(ergebnis.ok).toBe(false)
    expect(anfragen.length).toBe(2)
    for (const a of anfragen) {
      for (const m of a.messages) expect(['user', 'assistant']).toContain(m.role)
    }
    expect(anfragen[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(anfragen[1].messages[1]).toEqual({ role: 'assistant' })
  })

  it('Modell-Nachricht ohne role, aber mit tool_calls → wird als assistant geführt', async () => {
    const anfragen = ollamaStub([
      { message: { content: '', tool_calls: [aufruf('suchen', { muster: 'const' })] } },
      fazit
    ])
    const ergebnis = await lokalRecherchieren({ projektPfad, auftrag: 'egal', modell: 'stub', adresse: 'http://stub' })
    expect(ergebnis.ok).toBe(true)
    expect(anfragen[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    // Eine mitgelieferte Rolle bleibt, wie sie ist (kein Überschreiben).
  })

  it('kaputte tool_calls (null-Aufruf, arguments "null") verlassen den Kreislauf nicht mit einem Wurf', async () => {
    const schritte = []
    const anfragen = ollamaStub([
      {
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [null, { function: { name: 'datei_lesen', arguments: 'null' } }, { function: { name: 'suchen', arguments: '{kaputt' } }]
        }
      },
      fazit
    ])
    const ergebnis = await lokalRecherchieren({
      projektPfad,
      auftrag: 'egal',
      modell: 'stub',
      adresse: 'http://stub',
      aufSchritt: (n, e) => schritte.push([n, e])
    })
    expect(ergebnis.ok).toBe(true)
    expect(ergebnis.schritte).toBe(3)
    // null-Aufruf → unbekanntes Werkzeug „?", Eingabe {}; "null"/kaputt → Eingabe {}.
    expect(schritte).toEqual([
      ['?', {}],
      ['datei_lesen', {}],
      ['suchen', {}]
    ])
    const gebuendelt = anfragen[1].messages[2].content
    expect(gebuendelt).toMatch(/Ergebnis von \?:\nUnbekanntes Werkzeug: \?/)
    expect(gebuendelt).toMatch(/Ergebnis von datei_lesen:\nDatei nicht lesbar oder nicht vorhanden/)
    expect(gebuendelt).toMatch(/Ergebnis von suchen:\nAbgelehnt: leeres Suchmuster/)
  })

  it('getarnter Aufruf (JSON-Text statt tool_call): Ergebnis ebenfalls als Nutzer-Nachricht', async () => {
    const anfragen = ollamaStub([
      {
        message: {
          role: 'assistant',
          content: '```json\n{"name":"datei_lesen","arguments":{"pfad":"src/a.js"}}\n```'
        }
      },
      fazit
    ])
    const schritte = []
    const ergebnis = await lokalRecherchieren({
      projektPfad,
      auftrag: 'egal',
      modell: 'stub',
      adresse: 'http://stub',
      aufSchritt: (n) => schritte.push(n)
    })
    expect(ergebnis.ok).toBe(true)
    expect(schritte).toEqual(['aufruf_uebersetzt', 'datei_lesen'])
    const verlauf = anfragen[1].messages
    expect(verlauf.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(verlauf[2].content.startsWith('Ergebnis von datei_lesen:\n')).toBe(true)
    expect(verlauf[2].content).toMatch(/const a = 1/)
    expect(verlauf[2]).not.toHaveProperty('tool_name')
  })

  it('Nachhaken bei leerer Antwort ist eine Nutzer-Nachricht', async () => {
    const anfragen = ollamaStub([leer, fazit])
    const ergebnis = await lokalRecherchieren({
      projektPfad,
      auftrag: 'egal',
      modell: 'stub',
      adresse: 'http://stub'
    })
    expect(ergebnis.ok).toBe(true)
    const verlauf = anfragen[1].messages
    expect(verlauf.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(verlauf[2]).toEqual({ role: 'user', content: texte.agentenLokaleHelfer.nachhaken })
  })

  it('die Antworten des Modells bleiben unverändert im Verlauf (assistant samt tool_calls)', async () => {
    const modellAntwort = antwortMit(aufruf('suchen', { muster: 'const' }))
    const anfragen = ollamaStub([modellAntwort, fazit])
    await lokalBauen({ projektPfad, auftrag: 'egal', modell: 'stub', adresse: 'http://stub' })
    expect(anfragen[1].messages[1]).toEqual(modellAntwort.message)
  })

  it('Runden-Deckel: nach 48 Runden ohne Fazit endet der Kreislauf ehrlich mit „48"', async () => {
    // Der Runden-Deckel hängt seit 0.46.3 am Kontext-Fenster (48 bei 32k,
    // 64 bei 64k, 96 bei 128k) — hier ausdrücklich das 32k-Fenster.
    lokaleHelferKontextSetzen(32768)
    const anfragen = ollamaStub(() => antwortMit(aufruf('ordner_auflisten', { pfad: '.' })))
    const ergebnis = await lokalRecherchieren({
      projektPfad,
      auftrag: 'egal',
      modell: 'stub',
      adresse: 'http://stub'
    })
    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.fehler).toMatch(/48 Runden/)
    expect(anfragen.length).toBe(48)
    expect(ergebnis.schritte).toBe(48)
    lokaleHelferKontextSetzen(KONTEXT_FENSTER_STANDARD)
    // Auch im langen Verlauf: keine fremde Rolle eingeschlichen.
    const rollen = new Set(anfragen[47].messages.map((m) => m.role))
    expect([...rollen].sort()).toEqual(['assistant', 'user'])
  })
})

describe('Lokale Helfer-KI · Auftrags-Texte erlauben größere Aufträge, Abnahme bleibt Pflicht', () => {
  const t = texte.agentenLokaleHelfer
  it('„möglichst kleine" kommt in den Bau- und System-Texten nicht mehr vor', () => {
    for (const text of [t.bauenAuftragZusatz, t.systemZusatz, t.bauenBeschreibung, t.entwerfenBeschreibung, t.werkzeugBeschreibung]) {
      expect(text).not.toMatch(/möglichst kleine/)
      expect(text).not.toMatch(/eng umrissen/)
      expect(text).not.toMatch(/schablonenhaft/)
    }
    // Die System-Texte der Kreisläufe betonen „klein/eng" nicht mehr.
    for (const text of Object.values(KREISLAUF_SYSTEMTEXTE)) {
      expect(text).not.toMatch(/eng umrissen/)
      expect(text).not.toMatch(/schablonenhaft/)
    }
  })
  it('die Auftrags-Felder von lokal_entwerfen/lokal_bauen verlangen kein Pflicht-Vorbild mehr', () => {
    expect(t.entwerfenAuftragFeld).toMatch(/Vorbild \(Datei\) oder eine klare Beschreibung/)
    expect(t.entwerfenAuftragFeld).toMatch(/Fertig-Kriterium/)
    expect(t.bauenAuftragFeld).toMatch(/Fundstellen, Vorbild oder klare Beschreibung/)
    expect(t.bauenAuftragFeld).toMatch(/feste Schnittstellen/)
  })
  it('die Texte nennen ausdrücklich mittelgroße Stücke', () => {
    expect(t.bauenAuftragZusatz).toMatch(/größere Stücke/)
    expect(t.bauenBeschreibung).toMatch(/mittelgroß/)
    expect(t.systemZusatz).toMatch(/mittelgroß/)
    expect(t.entwerfenBeschreibung).toMatch(/mittelgroß/)
  })
  it('die Abnahme-Pflicht und die Leitplanken bleiben genannt', () => {
    expect(t.bauenAuftragZusatz).toMatch(/teilstueck_abnehmen/)
    expect(t.bauenAuftragZusatz).toMatch(/2 lokalen Anläufen/)
    expect(t.bauenAuftragZusatz).toMatch(/kein Pingpong/)
    expect(t.bauenAuftragZusatz).toMatch(/Bündle/)
    expect(t.systemZusatz).toMatch(/teilstueck_abnehmen/)
    expect(t.systemZusatz).toMatch(/entwurf_abnehmen/)
    expect(t.bauenBeschreibung).toMatch(/teilstueck_abnehmen/)
    expect(t.entwerfenBeschreibung).toMatch(/entwurf_abnehmen/)
    // Der ehrliche Hinweis „prüfe Fundorte selbst nach" bleibt.
    expect(t.werkzeugBeschreibung).toMatch(/liest du selbst nach/)
    expect(t.systemZusatz).toMatch(/liest du selbst nach/)
    expect(t.fazit('x')).toMatch(/selbst nach/)
  })
  it('Einstellungen: „kleine" bei den Aufträgen gestrichen, Ehrlichkeit über kleine Modelle bleibt', () => {
    expect(texte.einstellungen.lokaleHelferAktiv).not.toMatch(/kleine/)
    expect(texte.einstellungen.lokaleHelferHinweis).not.toMatch(/kleine Bau/)
    expect(texte.einstellungen.lokaleHelferHinweis).toMatch(/Kleine Modelle arbeiten langsamer und ungenauer/)
  })
})
