// Reine Rechenglieder der Dateilisten-Messung (BAUPLAN 55): Normalisierung,
// Ordner-Deckung, Abgleich gemeldet/gemessen, Vereinigung über Anläufe und der
// arbeitsablage-Abbild-Diff. Alles ohne Dateisystem — der Weg über echte
// Sicherungspunkte steht in messungZusammenfuehrung.test.js.
//
// Rot vor Grün (gemessen am Stand vor Bauschritt 55): Keine der fünf Funktionen
// und die Konstante existierten — jeder Aufruf lief in einen TypeError.
import { describe, it, expect } from 'vitest'
import {
  dateiPfadNormalisieren,
  istOrdnerEintrag,
  dateilistenAbgleich,
  messungVereinen,
  arbeitsablageAbgleich,
  MESSUNG_VERWALTUNGSDATEIEN
} from '../src/shared/lieferschein.js'

describe('BAUPLAN 55 · dateiPfadNormalisieren', () => {
  it('bringt alle rohen Schreibweisen auf dieselbe Form', () => {
    // Gemeldete Pfade kommen so an, wie das Modell sie schrieb — alle vier
    // meinen dieselbe Datei (lieferschein.js nimmt sie unnormalisiert an).
    for (const roh of ['./a/b.js', 'a\\b.js', '/a/b.js', 'a//b.js']) {
      expect(dateiPfadNormalisieren(roh)).toBe('a/b.js')
    }
  })

  it('lässt Groß-/Kleinschreibung unangetastet', () => {
    expect(dateiPfadNormalisieren('.\\Src\\App.JS')).toBe('Src/App.JS')
  })

  it('kürzt innere Punkt-Segmente und Ränder wie das Melde-Ende', () => {
    expect(dateiPfadNormalisieren('src/./api//x.js')).toBe('src/api/x.js')
    expect(dateiPfadNormalisieren('  src/api/x.js  ')).toBe('src/api/x.js')
    expect(dateiPfadNormalisieren('src/api/.')).toBe('src/api')
  })

  it('lässt beim absoluten Windows-Pfad das Laufwerkspräfix ehrlich stehen', () => {
    // Bewusst kein Sonderbau: Der Pfad matcht dann nichts Gemessenes und
    // landet in der Abweichungszeile, statt still zu verschwinden.
    expect(dateiPfadNormalisieren('C:\\projekt\\js\\app.js')).toBe('C:/projekt/js/app.js')
  })
})

describe('BAUPLAN 55 · istOrdnerEintrag', () => {
  it('erkennt Ordner an Schrägstrich-Endung oder fehlender Datei-Endung', () => {
    expect(istOrdnerEintrag('src/api/')).toBe(true)
    expect(istOrdnerEintrag('src/api')).toBe(true)
    expect(istOrdnerEintrag('src/app.js')).toBe(false)
    // Wörtlich die Ordner-Regel von dateilistenUeberschneidung: '.hidden'
    // trägt eine Endung und ist eine Datei.
    expect(istOrdnerEintrag('src/.hidden')).toBe(false)
    expect(istOrdnerEintrag('')).toBe(false)
  })
})

describe('BAUPLAN 55 · dateilistenAbgleich', () => {
  it('zählt nur Pfade — eine andere Art ist KEINE Abweichung', () => {
    const ergebnis = dateilistenAbgleich(
      [{ pfad: './js/app.js', art: 'neu' }],
      [{ pfad: 'js/app.js', art: 'geaendert' }]
    )
    expect(ergebnis.nurGemeldet).toEqual([])
    expect(ergebnis.nurGemessen).toEqual([])
  })

  it('vergleicht ohne Groß-/Kleinschreibung (Windows)', () => {
    const ergebnis = dateilistenAbgleich(
      [{ pfad: 'JS\\App.js', art: 'geaendert' }],
      [{ pfad: 'js/app.js', art: 'geaendert' }]
    )
    expect(ergebnis.nurGemeldet).toEqual([])
    expect(ergebnis.nurGemessen).toEqual([])
  })

  it('ein gemeldeter Ordner deckt alles Gemessene darunter — mit und ohne Schrägstrich', () => {
    for (const ordner of ['src/api/', 'src/api']) {
      const ergebnis = dateilistenAbgleich(
        [{ pfad: ordner, art: 'geaendert' }],
        [
          { pfad: 'src/api/x.js', art: 'neu' },
          { pfad: 'src/api/tief/y.js', art: 'geaendert' }
        ]
      )
      expect(ergebnis.nurGemeldet).toEqual([])
      expect(ergebnis.nurGemessen).toEqual([])
    }
  })

  it('ein Ordner ohne eine einzige gemessene Datei darunter ist nurGemeldet', () => {
    const ergebnis = dateilistenAbgleich(
      [{ pfad: 'src/leer/', art: 'geaendert' }],
      [{ pfad: 'src/api/x.js', art: 'neu' }]
    )
    expect(ergebnis.nurGemeldet).toEqual(['src/leer/'])
    expect(ergebnis.nurGemessen).toEqual(['src/api/x.js'])
  })

  it('nurGemeldet behält die Schreibweise der Meldung, nurGemessen ist normalisiert', () => {
    const ergebnis = dateilistenAbgleich(
      [{ pfad: './fehlt/mich.js', art: 'neu' }],
      [{ pfad: 'wirklich/da.js', art: 'neu' }]
    )
    expect(ergebnis.nurGemeldet).toEqual(['./fehlt/mich.js'])
    expect(ergebnis.nurGemessen).toEqual(['wirklich/da.js'])
  })

  it('zwei Schreibweisen derselben fehlenden Datei ergeben EINE nurGemeldet-Zeile', () => {
    const ergebnis = dateilistenAbgleich(
      [
        { pfad: 'fehlt.js', art: 'neu' },
        { pfad: 'fehlt.js', art: 'neu' },
        { pfad: './fehlt.js', art: 'geaendert' }
      ],
      []
    )
    expect(ergebnis.nurGemeldet).toEqual(['fehlt.js'])
  })

  it('leere und kaputte Eingaben kippen nichts', () => {
    expect(dateilistenAbgleich(null, null)).toEqual({ nurGemeldet: [], nurGemessen: [] })
    expect(dateilistenAbgleich([{ pfad: '' }], [{ pfad: '  ' }])).toEqual({
      nurGemeldet: [],
      nurGemessen: []
    })
  })
})

describe('BAUPLAN 55 · messungVereinen — die Netto-Wirkung über Anläufe', () => {
  const vereint = (a, b) => {
    const liste = messungVereinen(a, b)
    return Object.fromEntries(liste.map((e) => [e.pfad, e.art]))
  }

  it('neu + geaendert → unterm Strich neu', () => {
    expect(vereint([{ pfad: 'a.js', art: 'neu' }], [{ pfad: 'a.js', art: 'geaendert' }])).toEqual({
      'a.js': 'neu'
    })
  })

  it('neu + geloescht → der Eintrag entfällt (war unterm Strich nie da)', () => {
    expect(vereint([{ pfad: 'a.js', art: 'neu' }], [{ pfad: 'a.js', art: 'geloescht' }])).toEqual({})
  })

  it('geaendert + geloescht → geloescht', () => {
    expect(
      vereint([{ pfad: 'a.js', art: 'geaendert' }], [{ pfad: 'a.js', art: 'geloescht' }])
    ).toEqual({ 'a.js': 'geloescht' })
  })

  it('geloescht + neu → unterm Strich geaendert', () => {
    expect(vereint([{ pfad: 'a.js', art: 'geloescht' }], [{ pfad: 'a.js', art: 'neu' }])).toEqual({
      'a.js': 'geaendert'
    })
  })

  it('sonst gewinnt der jüngere Wert', () => {
    expect(
      vereint([{ pfad: 'a.js', art: 'geloescht' }], [{ pfad: 'a.js', art: 'geaendert' }])
    ).toEqual({ 'a.js': 'geaendert' })
    expect(vereint([{ pfad: 'a.js', art: 'geaendert' }], [{ pfad: 'a.js', art: 'neu' }])).toEqual({
      'a.js': 'neu'
    })
  })

  it('nicht überlappende Einträge bleiben beide erhalten', () => {
    expect(vereint([{ pfad: 'a.js', art: 'neu' }], [{ pfad: 'b.js', art: 'geaendert' }])).toEqual({
      'a.js': 'neu',
      'b.js': 'geaendert'
    })
  })

  it('findet denselben Pfad auch in verschiedener Schreibweise wieder', () => {
    // Kern-Messung und arbeitsablage-Messung liefern kanonische Pfade — aber
    // die Vereinigung darf an einer abweichenden Schreibweise nicht zwei
    // Einträge für EINE Datei anhäufen.
    expect(vereint([{ pfad: './a.js', art: 'neu' }], [{ pfad: 'a.js', art: 'geloescht' }])).toEqual(
      {}
    )
  })
})

describe('BAUPLAN 55 · arbeitsablageAbgleich', () => {
  it('erkennt neu, geändert (Größe ODER Zeitstempel) und gelöscht', () => {
    const vorher = {
      'bleibt.txt': { groesse: 5, mtimeMs: 1000 },
      'groesse.txt': { groesse: 5, mtimeMs: 1000 },
      'zeit.txt': { groesse: 5, mtimeMs: 1000 },
      'weg.txt': { groesse: 5, mtimeMs: 1000 }
    }
    const nachher = {
      'bleibt.txt': { groesse: 5, mtimeMs: 1000 },
      'groesse.txt': { groesse: 9, mtimeMs: 1000 },
      'zeit.txt': { groesse: 5, mtimeMs: 2000 },
      'frisch.txt': { groesse: 1, mtimeMs: 3000 }
    }
    expect(arbeitsablageAbgleich(vorher, nachher)).toEqual([
      { pfad: 'frisch.txt', art: 'neu' },
      { pfad: 'groesse.txt', art: 'geaendert' },
      { pfad: 'weg.txt', art: 'geloescht' },
      { pfad: 'zeit.txt', art: 'geaendert' }
    ])
  })

  it('leere Abbilder ergeben eine leere Liste — auch bei fehlender Eingabe', () => {
    expect(arbeitsablageAbgleich({}, {})).toEqual([])
    expect(arbeitsablageAbgleich(null, undefined)).toEqual([])
  })
})

describe('BAUPLAN 55 · MESSUNG_VERWALTUNGSDATEIEN', () => {
  it('führt genau die Verwaltungsdateien des Vertrags, laufberichte/ als Präfix', () => {
    expect([...MESSUNG_VERWALTUNGSDATEIEN].sort()).toEqual(
      [
        'projekt.json',
        'karten.json',
        'workflow.json',
        'startanleitung.json',
        'laufstand.json',
        'naechster-lauf.json',
        'chat.json',
        'pruefbefehl.json',
        'laufberichte/'
      ].sort()
    )
    // Der Präfix-Eintrag ist am Schrägstrich erkennbar — genau einer.
    expect(MESSUNG_VERWALTUNGSDATEIEN.filter((p) => p.endsWith('/'))).toEqual(['laufberichte/'])
  })
})
