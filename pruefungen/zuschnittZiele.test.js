// Prüfungen zum Zuschnitt je benanntem Ziel (BAUPLAN 44) in Alltagssprache:
// „Paket schneiden" liefert nicht mehr EIN Arbeitspaket für alle, sondern je
// benanntem Ziel eines — und jeder Empfänger bekommt genau das, das für ihn
// geschnitten wurde. Ein benanntes Ziel ist dabei NICHT jeder, der das Etikett
// bekommt, sondern nur der Block, der das Paket UMSETZT: Bekäme der Prüfer ein
// eigenes Paket, misst er die Arbeit an anderen Fertig-Kriterien, als gebaut
// wurde. Er bekommt deshalb das Paket des Blocks, dessen Arbeit er prüft.
//
// Rot-vor-Grün: Vor dem Bauschritt gab es weder zielListe noch
// zuschnittRouting; das Arbeitspaket-Schema kannte kein Ziel und keine
// Dateiliste, und brauchtHerkunft holte für „Prüfer · UI" das Paket direkt von
// „Paket schneiden" (am Bauer vorbei) — jeder Fall hier lief nachweislich rot.
// Beim Nachbauen wurden die Erwartungen zusätzlich einzeln verfälscht (z.B.
// „der Prüfer bekommt das Paket des anderen Bauers") und liefen dann rot.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  zielListe,
  zielAdresse,
  zielFuerAdresse,
  zuschnittRouting,
  zuschnittAuftragZusatz,
  ARBEITSPAKET_ETIKETT
} from '../src/shared/kettenRegeln.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'
import {
  meldungPruefen,
  lieferscheinText,
  zuschnitteAusMeldung,
  zuschnittSchluessel,
  DATEILISTE_MAX
} from '../src/shared/lieferschein.js'
import { texte } from '../src/shared/texte.js'

const tl = texte.lieferschein
const rahmen = { fazit: 'Zugeschnitten.', getan: [], offen: [], anmerkung: '' }

// Georgs Alltagstest-Schaubild: Paket schneiden → Bauer · UI → Prüfer · UI und
// Paket schneiden → Bauer · Motor → Prüfer · Motor.
const bloecke = [
  { instanzId: 'p', blockId: 'paket-schneiden', zusatz: '' },
  { instanzId: 'bu', blockId: 'bauer', zusatz: 'UI' },
  { instanzId: 'pu', blockId: 'pruefer', zusatz: 'UI' },
  { instanzId: 'bm', blockId: 'bauer', zusatz: 'Motor' },
  { instanzId: 'pm', blockId: 'pruefer', zusatz: 'Motor' }
]
const pfeile = [
  { von: 'p', nach: 'bu' },
  { von: 'bu', nach: 'pu' },
  { von: 'p', nach: 'bm' },
  { von: 'bm', nach: 'pm' }
]

// Die Standard-Vorlage „Feature hinzufügen": genau ein Umsetzer.
const vorlageBloecke = [
  { instanzId: 'v-p', blockId: 'paket-schneiden', zusatz: '' },
  { instanzId: 'v-a', blockId: 'angreifer', zusatz: '' },
  { instanzId: 'v-b', blockId: 'bauer', zusatz: '' },
  { instanzId: 'v-pr', blockId: 'pruefer', zusatz: '' },
  { instanzId: 'v-e', blockId: 'sessionende', zusatz: '' }
]
const vorlagePfeile = [
  { von: 'v-p', nach: 'v-a' },
  { von: 'v-a', nach: 'v-b' },
  { von: 'v-b', nach: 'v-pr' },
  { von: 'v-pr', nach: 'v-e' }
]

describe('BAUPLAN 44 · Benannte Ziele sind die Blöcke, die das Paket umsetzen', () => {
  it('nennt beide Bauer mit ihrer Blocknummer als Adresse — und keinen Prüfer', () => {
    const ziele = zielListe(bloecke, pfeile, 'p')
    expect(ziele.map((z) => z.instanzId)).toEqual(['bu', 'bm'])
    expect(ziele.map((z) => z.adresse)).toEqual([zielAdresse(2), zielAdresse(4)])
    expect(ziele.map((z) => z.bezeichnung)).toEqual([
      texte.ticker.blockBezeichnung(2, 'Bauer · UI'),
      texte.ticker.blockBezeichnung(4, 'Bauer · Motor')
    ])
  })

  it('lässt nur-lesende und prüfende Empfänger aus — sonst misst der Prüfer an fremden Kriterien', () => {
    // In der Standard-Vorlage bekommen Angreifer, Bauer und Prüfer alle das
    // Etikett „Arbeitspaket" — benanntes Ziel ist trotzdem nur der Bauer.
    const ziele = zielListe(vorlageBloecke, vorlagePfeile, 'v-p')
    expect(ziele.map((z) => z.instanzId)).toEqual(['v-b'])
  })

  it('liefert keine Ziele für einen Block, der gar kein Arbeitspaket liefert', () => {
    expect(zielListe(bloecke, pfeile, 'bu')).toEqual([])
    expect(ARBEITSPAKET_ETIKETT).toBe('Arbeitspaket')
  })

  it('liest die Adresse aus Nummer, „Block 4 …" und eindeutigem Namen — nie aus einem doppelten', () => {
    const ziele = zielListe(bloecke, pfeile, 'p')
    expect(zielFuerAdresse(ziele, '4')?.instanzId).toBe('bm')
    expect(zielFuerAdresse(ziele, texte.ticker.blockBezeichnung(2, 'Bauer · UI'))?.instanzId).toBe(
      'bu'
    )
    expect(zielFuerAdresse(ziele, 'Bauer · Motor')?.instanzId).toBe('bm')
    expect(zielFuerAdresse(ziele, '9')).toBe(null)
    // Zwei gleichnamige Ziele: Der Name allein trifft keines von beiden.
    const gleich = [
      { instanzId: 'a', nummer: 2, name: 'Bauer', adresse: '2', bezeichnung: 'Block 2' },
      { instanzId: 'b', nummer: 3, name: 'Bauer', adresse: '3', bezeichnung: 'Block 3' }
    ]
    expect(zielFuerAdresse(gleich, 'Bauer')).toBe(null)
    expect(zielFuerAdresse(gleich, '3')?.instanzId).toBe('b')
  })

  // Rot vor Grün: Vorher griff die Auflösung zur ERSTEN Ziffer irgendwo im
  // Text. „Bauer · Phase 2" traf damit still Block 2 statt Block 3 — der
  // Zuschnitt ging an den falschen Bauer, ohne Abweisung und ohne
  // Ticker-Zeile. Die Zahl zählt seither nur noch am Anfang.
  it('ein Zusatzname mit Ziffer trifft seinen eigenen Block, nicht den mit dieser Nummer', () => {
    const ziele = [
      { instanzId: 'a', nummer: 2, name: 'Bauer · Phase 1', adresse: '2', bezeichnung: 'Block 2' },
      { instanzId: 'b', nummer: 3, name: 'Bauer · Phase 2', adresse: '3', bezeichnung: 'Block 3' }
    ]
    expect(zielFuerAdresse(ziele, 'Bauer · Phase 2')?.instanzId).toBe('b')
    expect(zielFuerAdresse(ziele, 'Bauer · Phase 1')?.instanzId).toBe('a')
    // Die Nummer als Adresse bleibt in allen bisherigen Schreibweisen gültig.
    expect(zielFuerAdresse(ziele, '3')?.instanzId).toBe('b')
    expect(zielFuerAdresse(ziele, 'Block 3')?.instanzId).toBe('b')
    expect(zielFuerAdresse(ziele, '3 Bauer · Phase 2')?.instanzId).toBe('b')
  })
})

describe('BAUPLAN 44 · Jeder Empfänger bekommt genau das für ihn geschnittene Paket', () => {
  const schluessel = ['bu', 'bm']

  it('gibt jedem Prüfer das Paket SEINES Bauers, nicht irgendeines', () => {
    expect(zuschnittRouting(bloecke, pfeile, 'pu', schluessel)).toEqual(['bu'])
    expect(zuschnittRouting(bloecke, pfeile, 'pm', schluessel)).toEqual(['bm'])
  })

  it('gibt jedem Bauer sein eigenes Paket', () => {
    expect(zuschnittRouting(bloecke, pfeile, 'bu', schluessel)).toEqual(['bu'])
    expect(zuschnittRouting(bloecke, pfeile, 'bm', schluessel)).toEqual(['bm'])
  })

  it('Rückfall ohne Bruch: ein Paket ohne Ziel gilt für alle', () => {
    for (const id of ['bu', 'bm', 'pu', 'pm'])
      expect(zuschnittRouting(bloecke, pfeile, id, [''])).toEqual([''])
  })

  // Diese Erwartung stand vorher genau andersherum („der Prüfer bekommt nur
  // ['bu']"). Sie ist umgeschrieben, weil sie ein Verhalten festhielt, das
  // SPEC §4.1 widerspricht: „Ein Zuschnitt ohne Adresse gilt für alle." Als
  // bloßer Rückfall erreichte er genau die Blöcke nie, die ein adressiertes
  // Paket haben — Bauer und Prüfer verloren still, was für alle gemeint war.
  it('das Paket ohne Adresse kommt ZUSÄTZLICH zum adressierten an, nicht ersatzweise', () => {
    expect(zuschnittRouting(bloecke, pfeile, 'bu', ['bu', ''])).toEqual(['bu', ''])
    expect(zuschnittRouting(bloecke, pfeile, 'pu', ['bu', ''])).toEqual(['bu', ''])
    expect(zuschnittRouting(bloecke, pfeile, 'pm', ['bu', 'bm', ''])).toEqual(['bm', ''])
  })

  it('ein Block vor allen Umsetzern greift alles an — auch neben einem Paket ohne Adresse', () => {
    // Der Angreifer der Standard-Vorlage sitzt zwischen Paket schneiden und
    // Bauer: Er hat kein eigenes und kein adressiertes Vorfahren-Paket.
    expect(zuschnittRouting(vorlageBloecke, vorlagePfeile, 'v-a', ['v-b', ''])).toEqual([
      'v-b',
      ''
    ])
  })

  it('Standard-Vorlage mit genau einem Umsetzer: alles wie vor dem Bauschritt', () => {
    // Der Angreifer liegt VOR dem Bauer — er hat kein adressiertes Paket unter
    // seinen Vorfahren und bekommt deshalb alles, was geschnitten wurde. Ohne
    // diesen Rückfall stünde er plötzlich ohne Arbeitspaket da.
    expect(zuschnittRouting(vorlageBloecke, vorlagePfeile, 'v-a', ['v-b'])).toEqual(['v-b'])
    expect(zuschnittRouting(vorlageBloecke, vorlagePfeile, 'v-b', ['v-b'])).toEqual(['v-b'])
    expect(zuschnittRouting(vorlageBloecke, vorlagePfeile, 'v-pr', ['v-b'])).toEqual(['v-b'])
  })

  it('ohne jedes Paket bleibt die Auswahl leer statt zu raten', () => {
    expect(zuschnittRouting(bloecke, pfeile, 'bu', [])).toEqual([])
  })
})

describe('BAUPLAN 44 · Zuschnitt und Datenvertrag als geprüfte Felder', () => {
  const ziele = zielListe(bloecke, pfeile, 'p')
  // Je Ziel eine EIGENE Dateiliste (seit BAUPLAN 46 Pflicht bei nebenläufigen
  // Zielen — die beiden Bauer hier laufen gleichzeitig): Bauer · UI die
  // Oberfläche, Bauer · Motor den Motor. Vor 46 trugen beide dieselbe Datei,
  // und die Meldung ging durch — heute weist sie das ab (eigene Prüfung unten).
  const paket = (zielBlock, ziel) => ({
    zielBlock,
    ziel,
    fertigKriterien: ['Der Test läuft grün.'],
    erlaubteDateien: zielBlock === '4' ? ['src/main/motor/'] : ['src/renderer/src/Leinwand.jsx']
  })

  it('nimmt beide Pakete in EINEM Aufruf an und merkt sich das Ziel je Zuschnitt', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [paket('2', 'Oberfläche bauen'), paket('4', 'Motor bauen')] },
      'Arbeitspaket',
      { ziele }
    )
    expect(ergebnis.fehler).toBeUndefined()
    const zuschnitte = zuschnitteAusMeldung(ergebnis.meldung)
    expect(zuschnitte.map(zuschnittSchluessel)).toEqual(['bu', 'bm'])
    expect(zuschnitte[0].zielBezeichnung).toBe(ziele[0].bezeichnung)
  })

  it('weist eine erfundene Zieladresse ab und nennt die gültigen', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [paket('9', 'Irgendwas')] },
      'Arbeitspaket',
      { ziele }
    )
    expect(ergebnis.fehler).toBe(
      tl.paketFehler(1, tl.zielBlockUnbekannt('9', ziele.map((z) => z.bezeichnung).join(' · ')))
    )
  })

  it('weist zwei Pakete für dasselbe Ziel ab', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [paket('2', 'Eins'), paket('2', 'Zwei')] },
      'Arbeitspaket',
      { ziele }
    )
    expect(ergebnis.fehler).toBe(tl.zielDoppelt(ziele[0].bezeichnung))
  })

  it('weist Glob-Muster in der Dateiliste mit einem Beispiel ab', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          {
            ziel: 'Etwas bauen',
            fertigKriterien: ['Läuft.'],
            erlaubteDateien: ['src/**/*.js']
          }
        ]
      },
      'Arbeitspaket'
    )
    expect(ergebnis.fehler).toBe(tl.paketFehler(1, tl.dateiMuster('src/**/*.js')))
  })

  it('hat für die Dateiliste eine eigene, großzügigere Anzahl-Grenze', () => {
    const viele = Array.from({ length: DATEILISTE_MAX + 1 }, (_, i) => `src/datei${i}.js`)
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [{ ziel: 'Viel', fertigKriterien: ['Läuft.'], erlaubteDateien: viele }] },
      'Arbeitspaket'
    )
    expect(ergebnis.fehler).toBe(
      tl.paketFehler(
        1,
        tl.zuVieleEintraege(tl.felder.erlaubteDateien, DATEILISTE_MAX, viele.length)
      )
    )
  })

  it('bringt Ziel und Dateiliste in den lesbaren Lieferschein — je Empfänger seinen', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          { ...paket('2', 'Oberfläche bauen'), erlaubteDateien: ['src/renderer/src/Leinwand.jsx'] },
          { ...paket('4', 'Motor bauen'), erlaubteDateien: ['src/main/lauf.js'] }
        ]
      },
      'Arbeitspaket',
      { ziele }
    )
    const fuerUi = lieferscheinText(ergebnis.meldung, 'bu')
    expect(fuerUi).toContain(`${tl.labels.zielBlock}: ${ziele[0].bezeichnung}`)
    expect(fuerUi).toContain(tl.labels.erlaubteDateien)
    expect(fuerUi).toContain('src/renderer/src/Leinwand.jsx')
    // Der Bauer · UI sieht das Paket des anderen NICHT.
    expect(fuerUi).not.toContain('src/main/lauf.js')
    // Ohne Schlüssel (Laufbericht) stehen beide drin.
    expect(lieferscheinText(ergebnis.meldung)).toContain('src/main/lauf.js')
  })

  it('Rückfall ohne Bruch: ein Paket ohne Ziel und ohne Dateiliste läuft unverändert durch', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [{ ziel: 'Etwas bauen', fertigKriterien: ['Läuft.'] }] },
      'Arbeitspaket',
      { ziele }
    )
    expect(ergebnis.fehler).toBeUndefined()
    const zuschnitte = zuschnitteAusMeldung(ergebnis.meldung)
    expect(zuschnittSchluessel(zuschnitte[0])).toBe('')
    expect(zuschnitte[0].erlaubteDateien).toEqual([])
    expect(lieferscheinText(ergebnis.meldung)).not.toContain(tl.labels.zielBlock + ':')
  })

  it('liest eine Meldung aus der Zeit vor dem Bauschritt weiter als einen Zuschnitt', () => {
    const alt = {
      art: 'arbeitspaket',
      etikett: 'Arbeitspaket',
      fazit: 'Alt.',
      ziel: 'Etwas bauen',
      fertigKriterien: ['Läuft.'],
      schritte: [],
      fundstellen: [],
      nichtDabei: []
    }
    expect(zuschnitteAusMeldung(alt)).toHaveLength(1)
    expect(lieferscheinText(alt)).toContain(`${tl.labels.ziel}: Etwas bauen`)
  })
})

// BAUPLAN 46: Welche Ziele laufen GLEICHZEITIG? Nur für die muss der Zuschnitt
// überschneidungsfrei sein. Rot vor Grün: Vor dem Bauschritt trug zielListe
// kein Feld nebenlaeufigZu (undefined statt Liste), und die Meldung unten mit
// derselben Datei in beiden Zuschnitten ging ohne Fehler durch.
describe('BAUPLAN 46 · Nebenläufige Ziele: wer neben wem schreiben kann', () => {
  it('nennt im Fächer den jeweils anderen Bauer als nebenläufig', () => {
    const ziele = zielListe(bloecke, pfeile, 'p')
    expect(ziele.find((z) => z.instanzId === 'bu').nebenlaeufigZu).toEqual(['bm'])
    expect(ziele.find((z) => z.instanzId === 'bm').nebenlaeufigZu).toEqual(['bu'])
  })

  it('in einer Kette Bauer A → Bauer B ist niemand nebenläufig', () => {
    const kette = [
      { instanzId: 'k-p', blockId: 'paket-schneiden', zusatz: '' },
      { instanzId: 'k-a', blockId: 'bauer', zusatz: 'A' },
      { instanzId: 'k-b', blockId: 'bauer', zusatz: 'B' }
    ]
    const kettenPfeile = [
      { von: 'k-p', nach: 'k-a' },
      { von: 'k-a', nach: 'k-b' }
    ]
    const ziele = zielListe(kette, kettenPfeile, 'k-p')
    expect(ziele.map((z) => z.instanzId)).toEqual(['k-a', 'k-b'])
    for (const ziel of ziele) expect(ziel.nebenlaeufigZu).toEqual([])
  })

  it('mit genau einem Ziel ist die Liste leer', () => {
    const [einziges] = zielListe(vorlageBloecke, vorlagePfeile, 'v-p')
    expect(einziges.nebenlaeufigZu).toEqual([])
  })
})

describe('BAUPLAN 46 · Überschneidende Zuschnitte werden beim Melden abgewiesen', () => {
  const ziele = zielListe(bloecke, pfeile, 'p')
  const paket = (zielBlock, erlaubteDateien) => ({
    zielBlock,
    ziel: 'Etwas bauen',
    fertigKriterien: ['Läuft.'],
    erlaubteDateien
  })

  it('nennt beide Ziele und die überlappenden Einträge', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          paket('2', ['src/renderer/src/Leinwand.jsx', 'src/shared/texte.js']),
          paket('4', ['src/main/motor/', 'src/shared/'])
        ]
      },
      'Arbeitspaket',
      { ziele }
    )
    expect(ergebnis.fehler).toBe(
      tl.zuschnittUeberschneidung(ziele[0].bezeichnung, ziele[1].bezeichnung, [
        '„src/shared/texte.js" ↔ „src/shared/"'
      ])
    )
  })

  it('weist einen adresslosen Zuschnitt MIT Dateiliste neben zwei nebenläufigen Zielen ab — mit dem Weg heraus', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          paket('2', ['src/renderer/src/Leinwand.jsx']),
          paket('4', ['src/main/motor/']),
          paket('', ['src/shared/texte.js'])
        ]
      },
      'Arbeitspaket',
      { ziele }
    )
    expect(ergebnis.fehler).toBe(
      tl.adressloserZuschnittMitListe(ziele.map((z) => z.bezeichnung).join(' · '))
    )
    expect(ergebnis.fehler).toMatch(/adressiere|Adressiere/)
    expect(ergebnis.fehler).toMatch(/erlaubteDateien/)
  })

  it('lässt disjunkte Zuschnitte durch — auch mit einem adresslosen OHNE Dateiliste', () => {
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          paket('2', ['src/renderer/src/Leinwand.jsx']),
          paket('4', ['src/main/motor/']),
          paket('', [])
        ]
      },
      'Arbeitspaket',
      { ziele }
    )
    expect(ergebnis.fehler).toBeUndefined()
    expect(zuschnitteAusMeldung(ergebnis.meldung)).toHaveLength(3)
  })

  it('kein Bruch: mit einem Ziel oder ohne Dateilisten ändert sich nichts', () => {
    const [einziges] = zielListe(vorlageBloecke, vorlagePfeile, 'v-p')
    const einZiel = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [paket(einziges.adresse, ['src/a.js']), paket('', ['src/a.js'])] },
      'Arbeitspaket',
      { ziele: [einziges] }
    )
    expect(einZiel.fehler).toBeUndefined()
    const ohneListen = meldungPruefen(
      'arbeitspaket',
      { ...rahmen, pakete: [paket('2', []), paket('4', [])] },
      'Arbeitspaket',
      { ziele }
    )
    expect(ohneListen.fehler).toBeUndefined()
  })

  it('in einer Kette Bauer A → Bauer B darf dieselbe Datei nacheinander angefasst werden', () => {
    const kette = [
      { instanzId: 'k-p', blockId: 'paket-schneiden', zusatz: '' },
      { instanzId: 'k-a', blockId: 'bauer', zusatz: 'A' },
      { instanzId: 'k-b', blockId: 'bauer', zusatz: 'B' }
    ]
    const kettenPfeile = [
      { von: 'k-p', nach: 'k-a' },
      { von: 'k-a', nach: 'k-b' }
    ]
    const kettenZiele = zielListe(kette, kettenPfeile, 'k-p')
    const ergebnis = meldungPruefen(
      'arbeitspaket',
      {
        ...rahmen,
        pakete: [
          paket(kettenZiele[0].adresse, ['src/a.js']),
          paket(kettenZiele[1].adresse, ['src/a.js'])
        ]
      },
      'Arbeitspaket',
      { ziele: kettenZiele }
    )
    expect(ergebnis.fehler).toBeUndefined()
  })
})

// Ein rohes NUL-Byte im Quelltext macht eine Datei für die Projektsuche zur
// Binärdatei: Eine Suche darin findet dann nichts mehr, und ein Vergleich zeigt
// das Byte als Leerstelle — es sieht aus wie ein Leerzeichen, ist aber keines.
// Die Metrik-Regeln trennen ihre Tabellenschlüssel mit genau diesem Zeichen;
// es steht deshalb in der Escape-Schreibweise da statt als Byte — derselbe
// Trenner, aber lesbar und durchsuchbar (BAUPLAN 44). Geprüft werden Quelltext
// UND Prüfungen: Auch eine Prüfdatei ist Quelltext, in den das Byte beim
// Bearbeiten rutschen kann. Rot vor Grün: Mit dem rohen Byte lief diese
// Prüfung rot.
describe('BAUPLAN 44 · Kein rohes Steuerzeichen im Quelltext', () => {
  it('keine Quell- oder Prüfdatei enthält ein NUL-Byte', () => {
    const wurzeln = [path.resolve('src'), path.resolve('pruefungen')]
    const treffer = []
    const durchgehen = (ordner) => {
      for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
        const voll = path.join(ordner, eintrag.name)
        if (eintrag.isDirectory()) durchgehen(voll)
        else if (/\.(js|jsx|css|json|html)$/.test(eintrag.name))
          if (fs.readFileSync(voll).includes(0)) treffer.push(voll)
      }
    }
    for (const wurzel of wurzeln) durchgehen(wurzel)
    expect(treffer).toEqual([])
  })
})

// Abschlussprüfung Bauschritt 44: Der Auftragszusatz hing am liefert-Etikett
// „Arbeitspaket", die Vollständigkeitsprüfung und das Werkzeug paket_melden
// dagegen am Kennzeichen kartenZuteilung. Im Katalog fallen die drei zusammen;
// bei einem im Block-Editor gebauten Block nicht — liefert-Etiketten sind dort
// freie Eingabe. So ein Block bekam wörtlich den Satz „… FlowForge prüft das und
// fordert sonst nach": Folgte er ihm, wies ihn die Meldungsprüfung ab („noch
// kein Paket gemeldet"), und paket_melden löste für ihn eine Rechte-Rückfrage
// aus. Er saß fest — aufgefordert zu etwas, das ihm verwehrt ist, und für den
// Gehorsam abgewiesen.
//
// Rot vor Grün: Vorher gab es zuschnittAuftragZusatz nicht (Import rot), und der
// Zusatz war unteilbar — jede Erwartung „kein Wort zu aufgabenIds" lief rot.
describe('BAUPLAN 44 · Der Auftragszusatz verspricht nur, was der Block einlösen darf', () => {
  const tz = texte.agentenZuschnitt
  const ziele = zielListe(bloecke, pfeile, 'p')

  it('gibt Ziel-Adressierung und erlaubteDateien an JEDEN Block, der ein Arbeitspaket liefert', () => {
    // Der Zuschnitt je Ziel ist auch ohne Aufgaben-Karten sinnvoll: Wer das
    // Paket liefert, muss wissen, an wen es geht und was es anfassen darf.
    expect(zuschnittAuftragZusatz(ziele, false)).toBe(
      tz.auftragZusatz(ziele.map((z) => z.bezeichnung))
    )
    expect(zuschnittAuftragZusatz([ziele[0]], false)).toBe(
      tz.auftragZusatzEines(ziele[0].bezeichnung)
    )
    expect(zuschnittAuftragZusatz([], false)).toBe(tz.auftragZusatzKeines)
  })

  it('sagt einem Block ohne das Kennzeichen kartenZuteilung kein Wort über aufgabenIds', () => {
    for (const lage of [ziele, [ziele[0]], []])
      expect(zuschnittAuftragZusatz(lage, false)).not.toContain(tz.aufgabenZusatz)
  })

  it('hängt den aufgabenIds-Teil nur an Auftragsquellen an — dort ändert sich nichts', () => {
    for (const lage of [ziele, [ziele[0]], []]) {
      const mit = zuschnittAuftragZusatz(lage, true)
      expect(mit).toBe(zuschnittAuftragZusatz(lage, false) + tz.aufgabenZusatz)
      expect(mit).toContain(tz.aufgabenZusatz)
    }
  })

  it('trifft im Katalog genau die Blöcke, die paket_melden auch rufen dürfen', () => {
    // Beide Enden derselben Rechnung: Wer den aufgabenIds-Satz bekommt, muss
    // das Kennzeichen tragen, das im Motor paket_melden freischaltet und die
    // Vollständigkeitsprüfung auslöst.
    expect(Boolean(blockDefinition('paket-schneiden').kartenZuteilung)).toBe(true)
    // Ein selbstgebauter Block liefert das Etikett ohne das Kennzeichen.
    const eigen = { id: 'eigen-zerleger', liefert: [ARBEITSPAKET_ETIKETT], nurLesen: true }
    expect(eigen.liefert.includes(ARBEITSPAKET_ETIKETT)).toBe(true)
    expect(Boolean(eigen.kartenZuteilung)).toBe(false)
    expect(zuschnittAuftragZusatz(ziele, Boolean(eigen.kartenZuteilung))).not.toContain(
      tz.aufgabenZusatz
    )
  })
})
