// Empfänger im Auftrag (BAUPLAN 43) — die Mechanik: Wer bekommt wirklich, was
// dieser Block liefert?
//
// Rot-vor-Grün: Vor diesem Bauschritt gab es die Rechnung überhaupt nicht — der
// Katalog behauptete Empfänger fest verdrahtet („Deine Meldung ist die Übergabe
// an den Prüfer"), auch wenn gar keiner auf der Leinwand lag. empfaengerLage,
// kettenZeile und vorspannText existierten nicht; jeder Fall unten schlug fehl.
//
// Geprüft wird Verhalten, nicht Wortlaut: Die erwarteten Textstücke kommen aus
// texte.agentenVorspann selbst — B darf jeden Satz umformulieren, ohne dass
// hier etwas rot wird. Rot wird es, wenn FlowForge den FALSCHEN Baustein wählt
// oder den falschen Block nennt.
import { describe, it, expect } from 'vitest'
import {
  empfaengerLage,
  kettenZeile,
  vorspannText,
  vorspannZeile,
  KETTE_MAX_BLOECKE,
  NACHFAHREN_MAX_NAMEN
} from '../src/shared/kettenRegeln.js'
import { texte } from '../src/shared/texte.js'
import { blockDefinition } from '../src/shared/blockKatalog.js'

const v = texte.agentenVorspann
const bezeichnung = (nummer, name) => texte.ticker.blockBezeichnung(nummer, name)
// Der Satz, den der Empfänger-Block zu diesem Etikett hinterlegt hat — genau
// den muss der Vorspann beim Lieferanten einsetzen.
const wozu = (blockId, etikett) => blockDefinition(blockId).brauchtWozu[etikett]

function block(instanzId, blockId, zusatz = '', rest = {}) {
  return { instanzId, blockId, zusatz, feldWerte: {}, zurueckZu: null, ...rest }
}
function pfeil(von, nach) {
  return { von, nach }
}
// Aufzählung in Alltagssprache, wie der Vorspann sie baut: „A, B und C".
// Nachgebaut, weil die Mechanik in kettenRegeln.js nicht nach außen gehört.
function aufzaehlungErwartet(stuecke) {
  if (stuecke.length <= 1) return stuecke[0] ?? ''
  return stuecke.slice(0, -1).join(', ') + ' und ' + stuecke[stuecke.length - 1]
}
// Wie viele echte Blöcke stehen in der Kettenzeile? Klammern und Trenner weg,
// „…" zählt nicht mit — das ist die Zahl, die der Deckel begrenzen soll.
function bloeckeInZeile(zeile) {
  return zeile
    .replaceAll('{', '')
    .replaceAll('}', '')
    .split(/ → | \| /)
    .filter((t) => t !== '…').length
}

describe('BAUPLAN 43 · Wer nichts abgibt, bekommt das gesagt', () => {
  // Der Alltagstest des Bauschritts: ein Bauer ohne Prüfer dahinter.
  const bloecke = [block('p', 'paket-schneiden'), block('b', 'bauer')]
  const pfeile = [pfeil('p', 'b')]

  it('sagt dem letzten Block, dass seine Lieferung an niemanden geht', () => {
    const lage = empfaengerLage(bloecke, pfeile, 'b')
    expect(lage.empfaenger).toEqual([])
    expect(lage.nachfahren).toEqual([])
    expect(vorspannText(bloecke, pfeile, 'b')).toContain(v.keiner)
  })

  it('nennt dem Vorgänger denselben Bauer als Empfänger — mit seinem „wozu"', () => {
    const text = vorspannText(bloecke, pfeile, 'p')
    expect(text).toContain(
      v.empfaenger(bezeichnung(2, 'Bauer'), 'Arbeitspaket', wozu('bauer', 'Arbeitspaket'))
    )
  })

  it('liefert die Ursache mit, wenn Nachfahren da sind, aber keiner das Etikett will', () => {
    // Ein Angreifer vor dem Sessionende: Der nimmt Umsetzungsbericht und
    // Prüfbeleg — eine Angriffsliste verlangt er nicht. Genau so sieht ein
    // vertipptes Etikett an einem selbstgebauten Block aus.
    const eigen = [block('a', 'angreifer'), block('s', 'sessionende')]
    const kanten = [pfeil('a', 's')]
    const lage = empfaengerLage(eigen, kanten, 'a')
    expect(lage.empfaenger).toEqual([])
    expect(lage.nachfahren.map((n) => n.name)).toEqual(['Sessionende'])
    expect(vorspannText(eigen, kanten, 'a')).toContain(
      v.keinerTrotzNachfahren(bezeichnung(2, 'Sessionende'))
    )
  })
})

describe('BAUPLAN 43 · Empfänger sind nicht alle Nachfahren mit passendem braucht', () => {
  // Dasselbe Schaubild wie in fanIn.test.js: Zwei Angreifer hintereinander vor
  // dem Bauer. Der nähere gewinnt — die Angriffsliste des entfernteren kommt
  // NIRGENDS an. Ein Vorspann, der bloß „Nachfahre braucht mein Etikett" prüft,
  // verspräche ihm hier einen Empfänger, den er nicht hat.
  const bloecke = [
    block('paket', 'paket-schneiden'),
    block('a1', 'angreifer'),
    block('a2', 'angreifer'),
    block('bauer', 'bauer')
  ]
  const pfeile = [pfeil('paket', 'a1'), pfeil('a1', 'a2'), pfeil('a2', 'bauer')]

  it('sagt dem verdrängten Angreifer die Verdrängung, statt ihm einen Empfänger zu versprechen', () => {
    const lage = empfaengerLage(bloecke, pfeile, 'a1')
    expect(lage.empfaenger).toEqual([])
    expect(lage.verdraengt).toEqual([
      { etikett: 'Angriffsliste', gewinner: [{ instanzId: 'a2', nummer: 3, name: 'Angreifer' }] }
    ])
    const text = vorspannText(bloecke, pfeile, 'a1')
    expect(text).toContain(v.verdraengt('Angriffsliste', bezeichnung(3, 'Angreifer')))
    // Und NICHT der Satz „keiner davon verlangt eines deiner Etiketten" —
    // verlangt wird sie sehr wohl, nur von einem Näheren geliefert.
    expect(text).not.toContain(v.keinerTrotzNachfahren(bezeichnung(4, 'Bauer')))
  })

  it('nennt dem näheren Angreifer den Bauer als Empfänger', () => {
    const lage = empfaengerLage(bloecke, pfeile, 'a2')
    expect(lage.empfaenger.map((e) => [e.nummer, e.etikett])).toEqual([[4, 'Angriffsliste']])
    expect(lage.verdraengt).toEqual([])
  })
})

describe('BAUPLAN 43 · Pflicht und optional sprechen verschieden', () => {
  // Paket schneiden liefert dem Bauer das Arbeitspaket (Pflicht), der Angreifer
  // die Angriffsliste (optional — „Bug jagen" kommt ohne sie aus).
  const bloecke = [
    block('p', 'paket-schneiden'),
    block('a', 'angreifer'),
    block('b', 'bauer')
  ]
  const pfeile = [pfeil('p', 'a'), pfeil('a', 'b')]

  it('kennzeichnet den Pflicht-Bedarf und den optionalen getrennt', () => {
    const vonPaket = empfaengerLage(bloecke, pfeile, 'p').empfaenger
    expect(vonPaket.map((e) => [e.etikett, e.optional])).toEqual([
      ['Arbeitspaket', false],
      ['Arbeitspaket', false]
    ])
    const vonAngreifer = empfaengerLage(bloecke, pfeile, 'a').empfaenger
    expect(vonAngreifer.map((e) => [e.etikett, e.optional])).toEqual([['Angriffsliste', true]])
  })

  it('setzt für beide den jeweils anderen Baustein ein', () => {
    expect(vorspannText(bloecke, pfeile, 'p')).toContain(
      v.empfaenger(bezeichnung(2, 'Angreifer'), 'Arbeitspaket', wozu('angreifer', 'Arbeitspaket'))
    )
    expect(vorspannText(bloecke, pfeile, 'a')).toContain(
      v.empfaengerOptional(
        bezeichnung(3, 'Bauer'),
        'Angriffsliste',
        wozu('bauer', 'Angriffsliste')
      )
    )
  })
})

describe('BAUPLAN 43 · Zwei gleiche Blöcke bleiben unterscheidbar', () => {
  const bloecke = [
    block('p', 'paket-schneiden'),
    block('b', 'bauer'),
    block('u', 'pruefer', 'UI'),
    block('m', 'pruefer', 'Motor')
  ]
  const pfeile = [pfeil('p', 'b'), pfeil('b', 'u'), pfeil('b', 'm')]

  // Umgeschrieben mit BAUPLAN 44: Vorher stand für JEDEN Empfänger eine eigene
  // Zeile — bei zwei Prüfern also derselbe „wozu"-Satz zweimal, in jedem Anlauf.
  // Seit 44 wird der SATZ gebündelt, sobald zwei Empfänger in Etikett,
  // Verbindlichkeit und „wozu" übereinstimmen; genannt werden weiterhin beide
  // mit Nummer und Zusatzname (weggelassen wird nie einer — sie tragen die
  // Verantwortungssprache).
  it('nennt beide Prüfer mit Zusatznamen und eigener Nummer — in EINER Zeile', () => {
    const text = vorspannText(bloecke, pfeile, 'b')
    expect(text).toContain(
      v.empfaengerMehrere(
        [bezeichnung(3, 'Prüfer · UI'), bezeichnung(4, 'Prüfer · Motor')],
        'Umsetzungsbericht',
        wozu('pruefer', 'Umsetzungsbericht')
      )
    )
    // Und der „wozu"-Satz steht danach genau einmal statt zweimal.
    expect(text.split(wozu('pruefer', 'Umsetzungsbericht'))).toHaveLength(2)
  })

  it('stellt die beiden Prüfer in der Kettenzeile NEBENeinander', () => {
    // Die topologische Reihenfolge allein machte daraus „Prüfer → Prüfer" —
    // einen, der den anderen prüft. Das ist der Fund, um den es hier geht.
    const teile = kettenZeile(bloecke, pfeile).split(' → ')
    expect(teile).toHaveLength(3)
    expect(teile[2]).toContain('Prüfer · UI')
    expect(teile[2]).toContain('Prüfer · Motor')
    expect(teile.filter((t) => t.includes('Prüfer'))).toHaveLength(1)
  })
})

describe('BAUPLAN 43 · Kette und Position sind reine Ortsangaben', () => {
  it('nennt Kette und Position, sobald mehr als ein Block da ist', () => {
    const bloecke = [block('p', 'paket-schneiden'), block('b', 'bauer')]
    const pfeile = [pfeil('p', 'b')]
    const text = vorspannText(bloecke, pfeile, 'b')
    expect(text).toContain(v.kette('1 Paket schneiden → 2 Bauer'))
    expect(text).toContain(v.position(2, 2))
  })

  it('lässt beide beim Ein-Block-Workflow weg', () => {
    // Sonderläufe und manuelle Ein-Block-Läufe (Audit, Gesamtprüfung): Eine
    // „Kette" aus einem Block und ein „Block 1 von 1" sind nur Rauschen.
    const allein = [block('b', 'bauer')]
    const text = vorspannText(allein, [], 'b')
    expect(text).toContain(v.einzelblock)
    expect(text).not.toContain(v.kette('').trimEnd())
    expect(text).not.toContain(v.position(1, 1))
  })

  it('deckelt lange Ketten und lässt die Lücke an den Nummern ablesen', () => {
    const bloecke = []
    const pfeile = []
    for (let i = 0; i < 20; i++) {
      bloecke.push(block('b' + i, 'bauer', 'Nr ' + i))
      if (i > 0) pfeile.push(pfeil('b' + (i - 1), 'b' + i))
    }
    const zeile = kettenZeile(bloecke, pfeile)
    expect(zeile).toContain('…')
    expect(zeile.startsWith('1 Bauer · Nr 0')).toBe(true)
    expect(zeile.endsWith('20 Bauer · Nr 19')).toBe(true)
    expect(bloeckeInZeile(zeile)).toBeLessThanOrEqual(KETTE_MAX_BLOECKE)
  })

  it('deckelt auch, wenn die LETZTE Ebene allein schon zu breit ist', () => {
    // Zwanzig parallele Prüfer hinter einem Bauer: Der Deckel rechnete das
    // Budget für den Anfang negativ, die Endebene stand ungekürzt da, und
    // ausgerechnet „1 Paket schneiden → 2 Bauer" — die Blöcke, die den Ort
    // erklären — fielen weg. Beides muss halten: Anfang steht, Deckel greift.
    const bloecke = [block('p', 'paket-schneiden'), block('b', 'bauer')]
    const pfeile = [pfeil('p', 'b')]
    for (let i = 0; i < 20; i++) {
      bloecke.push(block('t' + i, 'pruefer', 'T' + i))
      pfeile.push(pfeil('b', 't' + i))
    }
    const zeile = kettenZeile(bloecke, pfeile)
    expect(zeile.startsWith('1 Paket schneiden → 2 Bauer → ')).toBe(true)
    expect(bloeckeInZeile(zeile)).toBeLessThanOrEqual(KETTE_MAX_BLOECKE)
    // Die Kürzung sitzt IN der Ebene: erster und letzter Prüfer bleiben stehen.
    expect(zeile).toContain('3 Prüfer · T0')
    expect(zeile).toContain('22 Prüfer · T19')
    expect(zeile).toContain('…')
  })

  it('deckelt auch, wenn die ERSTE Ebene allein schon zu breit ist', () => {
    // Spiegelfall zum vorigen — und genau der, der bisher durchrutschte: Acht
    // Paket-Blöcke nebeneinander, dahinter acht Bauer (die Kreuzpfeile halten
    // das Schaubild zusammen, ohne die Ebenen zu verschieben). Die letzte Ebene
    // fraß das ganze Budget, die vordere Schleife brach sofort ab, „vorne"
    // blieb leer — die Zeile begann mit dem bloßen „…", und der Anfang fiel
    // komplett weg, obwohl der Deckel Anfang UND Ende zusagt.
    const bloecke = []
    const pfeile = []
    for (let i = 0; i < 8; i++) bloecke.push(block('w' + i, 'paket-schneiden', 'W' + i))
    for (let i = 0; i < 8; i++) bloecke.push(block('n' + i, 'bauer', 'B' + i))
    for (let i = 0; i < 8; i++) {
      pfeile.push(pfeil('w' + i, 'n' + i))
      if (i > 0) pfeile.push(pfeil('w' + (i - 1), 'n' + i))
    }
    const zeile = kettenZeile(bloecke, pfeile)
    expect(zeile.startsWith('…')).toBe(false)
    // Anfang und Ende der ersten Ebene stehen — gekürzt wird ihre Mitte.
    expect(zeile).toContain('1 Paket schneiden · W0')
    expect(zeile).toContain('8 Paket schneiden · W7')
    expect(zeile).toContain('16 Bauer · B7')
    expect(zeile).toContain('…')
    expect(bloeckeInZeile(zeile)).toBeLessThanOrEqual(KETTE_MAX_BLOECKE)
  })
})

describe('BAUPLAN 43 · Der lesende Block fehlt nie in seiner eigenen Kette', () => {
  // Zwanzig Blöcke in Reihe: Block 15 las „1 … → 11 → … → 20" und fand sich
  // selbst nicht darin — während direkt darunter „Du bist Block 15 von 20"
  // stand. Gekürzt wird deshalb um den lesenden Block herum: seine Ebene bleibt
  // immer stehen, gekürzt wird davor und danach.
  const bloecke = []
  const pfeile = []
  for (let i = 0; i < 20; i++) {
    bloecke.push(block('b' + i, 'bauer', 'Nr ' + i))
    if (i > 0) pfeile.push(pfeil('b' + (i - 1), 'b' + i))
  }
  const eintrag = (i) => `${i + 1} Bauer · Nr ${i}`

  it('lässt jeden Block sich selbst in der gedeckelten Kette finden', () => {
    for (let i = 0; i < bloecke.length; i++) {
      const zeile = kettenZeile(bloecke, pfeile, 'b' + i)
      expect(zeile).toContain(eintrag(i))
      // Der Deckel darf dabei nicht aufgehen — sonst wäre die Kur schlimmer
      // als die Krankheit.
      expect(bloeckeInZeile(zeile)).toBeLessThanOrEqual(KETTE_MAX_BLOECKE)
      // Anfang und Ende bleiben trotzdem stehen.
      expect(zeile.startsWith(eintrag(0))).toBe(true)
      expect(zeile.endsWith(eintrag(19))).toBe(true)
    }
  })

  it('zeigt im Auftrag dieselbe Kette, in der die Positionszeile den Block verortet', () => {
    const text = vorspannText(bloecke, pfeile, 'b14')
    expect(text).toContain(v.position(15, 20))
    const kettenzeile = text.split('\n').find((z) => z.startsWith(v.kette('').trim()))
    expect(kettenzeile).toContain(eintrag(14))
  })
})

describe('BAUPLAN 43 · Auch INNERHALB seiner Ebene fällt der lesende Block nicht heraus', () => {
  // Die Reihenkette oben hat auf jeder Ebene genau EINEN Block — dort genügt es,
  // die eigene Ebene stehen zu lassen. Sobald eine Ebene breiter ist als ihr
  // Anteil am Deckel, wird sie in sich gekürzt, und wer in ihrer Mitte steht,
  // fiel wieder heraus: 1 Paket schneiden → 6 parallele Bauer → 6 Prüfer ergab
  // für Bauer B3 „… {2 Bauer · B0 | 3 · B1 | 4 · B2 | … | 7 · B5} …", eine Zeile
  // darunter „Du bist Block 5 von 13". Genau der Selbstwiderspruch, gegen den
  // der Deckel gebaut wurde.
  const bloecke = [block('p', 'paket-schneiden')]
  const pfeile = []
  for (let i = 0; i < 6; i++) {
    bloecke.push(block('b' + i, 'bauer', 'B' + i))
    pfeile.push(pfeil('p', 'b' + i))
  }
  for (let i = 0; i < 6; i++) {
    bloecke.push(block('t' + i, 'pruefer', 'T' + i))
    pfeile.push(pfeil('b' + i, 't' + i))
  }
  // Nummern folgen der topologischen Reihenfolge: 1 = Paket, 2..7 = Bauer,
  // 8..13 = Prüfer.
  const bauerEintrag = (i) => `${i + 2} Bauer · B${i}`
  const prueferEintrag = (i) => `${i + 8} Prüfer · T${i}`

  it('lässt jeden Block einer breiten Ebene sich selbst finden', () => {
    for (let i = 0; i < 6; i++) {
      const bauerZeile = kettenZeile(bloecke, pfeile, 'b' + i)
      expect(bauerZeile).toContain(bauerEintrag(i))
      expect(bloeckeInZeile(bauerZeile)).toBeLessThanOrEqual(KETTE_MAX_BLOECKE)
      const prueferZeile = kettenZeile(bloecke, pfeile, 't' + i)
      expect(prueferZeile).toContain(prueferEintrag(i))
      expect(bloeckeInZeile(prueferZeile)).toBeLessThanOrEqual(KETTE_MAX_BLOECKE)
    }
  })

  it('hält Anfang und Ende der gekürzten Ebene trotzdem stehen', () => {
    // Der Deckel soll den lesenden Block ergänzen, nicht die bisherige Zusage
    // ersetzen: Die Ränder erklären weiter, wie breit die Ebene wirklich ist.
    const zeile = kettenZeile(bloecke, pfeile, 'b3')
    expect(zeile.startsWith('1 Paket schneiden → ')).toBe(true)
    expect(zeile).toContain(bauerEintrag(0))
    expect(zeile).toContain(bauerEintrag(5))
    expect(zeile).toContain('…')
  })

  it('zeigt im Auftrag dieselbe Kette, in der die Positionszeile den Block verortet', () => {
    const text = vorspannText(bloecke, pfeile, 'b3')
    expect(text).toContain(v.position(5, 13))
    const kettenzeile = text.split('\n').find((z) => z.startsWith(v.kette('').trim()))
    expect(kettenzeile).toContain(bauerEintrag(3))
  })

  it('hält das auch bei zwanzig Blöcken nebeneinander', () => {
    // Dieselbe Mechanik, nur breiter: ein Bauer, dahinter zwanzig parallele
    // Prüfer. Vorher fanden sich 14 von 20 nicht in ihrer eigenen Kette.
    const breit = [block('p', 'paket-schneiden'), block('b', 'bauer')]
    const kanten = [pfeil('p', 'b')]
    for (let i = 0; i < 20; i++) {
      breit.push(block('t' + i, 'pruefer', 'T' + i))
      kanten.push(pfeil('b', 't' + i))
    }
    for (let i = 0; i < 20; i++) {
      const zeile = kettenZeile(breit, kanten, 't' + i)
      expect(zeile).toContain(`${i + 3} Prüfer · T${i}`)
      expect(bloeckeInZeile(zeile)).toBeLessThanOrEqual(KETTE_MAX_BLOECKE)
    }
  })
})

describe('BAUPLAN 43 · Der Tippfehler-Hinweis zählt, statt alles aufzuzählen', () => {
  // 40 Bauer in Reihe: Keiner von ihnen verlangt einen Umsetzungsbericht, also
  // greift beim ersten der Tippfehler-Hinweis — und der zählte bisher alle 39
  // Nachfahren mit Namen auf. Das war die einzige ungedeckelte Angabe des
  // Vorspanns, direkt unter einer Kettenzeile, die ab 12 Blöcken kürzt; und der
  // Satz hängt an JEDEM Anlauf des Blocks.
  const bloecke = []
  const pfeile = []
  for (let i = 0; i < 40; i++) {
    bloecke.push(block('b' + i, 'bauer', 'Nr ' + i))
    if (i > 0) pfeile.push(pfeil('b' + (i - 1), 'b' + i))
  }

  it('nennt nur die ersten Nachfahren und zählt den Rest ehrlich', () => {
    const text = vorspannText(bloecke, pfeile, 'b0')
    // Die Bezeichnung „Block N „…"" steht ausschließlich in Aufzählungen — die
    // Kettenzeile schreibt Nummer und Name ohne sie. Gezählt wird also genau,
    // wie viele Nachfahren namentlich im Vorspann stehen.
    const genannt = bloecke.filter((b, i) => text.includes(bezeichnung(i + 1, 'Bauer · Nr ' + i)))
    expect(genannt.length).toBeLessThanOrEqual(NACHFAHREN_MAX_NAMEN)
    // Und es ist derselbe Satz wie sonst, nur mit gedeckelter Liste: die ersten
    // Nachfahren namentlich, dahinter die Zahl der übrigen.
    const erstenNamen = []
    for (let i = 1; i <= NACHFAHREN_MAX_NAMEN; i++)
      erstenNamen.push(bezeichnung(i + 1, 'Bauer · Nr ' + i))
    expect(text).toContain(
      v.keinerTrotzNachfahren(
        aufzaehlungErwartet([...erstenNamen, v.weitereBloecke(39 - NACHFAHREN_MAX_NAMEN)])
      )
    )
  })

  it('lässt kurze Listen unangetastet', () => {
    // Zwei Nachfahren: Beide gehören genannt — ein „und 0 weitere" wäre Unsinn.
    const kurz = [block('a', 'angreifer'), block('s1', 'sessionende', 'A'), block('s2', 'sessionende', 'B')]
    const kanten = [pfeil('a', 's1'), pfeil('s1', 's2')]
    expect(vorspannText(kurz, kanten, 'a')).toContain(
      v.keinerTrotzNachfahren(
        aufzaehlungErwartet([bezeichnung(2, 'Sessionende · A'), bezeichnung(3, 'Sessionende · B')])
      )
    )
  })
})

describe('BAUPLAN 43 · Wer gar keine Etiketten hat, wird nicht auf Tippfehler-Suche geschickt', () => {
  // Das Sessionende liefert nichts (liefert: []) — dasselbe gilt für
  // Karten-Probe, Rechte-Probe und jeden selbstgebauten Block ohne Etikett.
  // Liegt hinter ihm noch etwas (hier ein zweites Sessionende), sind BEIDE
  // vorhandenen Sätze falsch: „du bist der letzte Schritt" stimmt nicht, und
  // „meist ist ein Etikett anders geschrieben als gedacht" schickt den Agenten
  // hinter einem Etikett her, das es bei ihm gar nicht gibt.
  const bloecke = [
    block('b', 'bauer'),
    block('t', 'pruefer'),
    block('sa', 'sessionende', 'A'),
    block('sb', 'sessionende', 'B')
  ]
  const pfeile = [pfeil('b', 't'), pfeil('t', 'sa'), pfeil('sa', 'sb')]

  it('nimmt weder den Tippfehler-Hinweis noch „du bist der letzte Schritt"', () => {
    const text = vorspannText(bloecke, pfeile, 'sa')
    expect(text).not.toContain(v.keinerTrotzNachfahren(bezeichnung(4, 'Sessionende · B')))
    expect(text).not.toContain(v.keiner)
    // Der eigene Baustein dafür (texte.agentenVorspann.ohneEtiketten) muss
    // stehen — nicht „falls vorhanden". Eine Erwartung, die sich selbst
    // abschaltet, solange der Baustein fehlt, deckt genau den Fehler zu, für
    // den sie geschrieben wurde: Der Abschnitt bliebe leer und npm test grün.
    expect(text).toContain(v.ohneEtiketten)
    expect(text).not.toContain('undefined')
  })

  it('lässt den Tippfehler-Hinweis dort stehen, wo er hingehört', () => {
    // Derselbe Block-Typ, aber MIT Etiketten: Ein Angreifer vor dem Sessionende
    // liefert eine Angriffsliste, die dort niemand verlangt — genau der Fall,
    // für den der Satz gedacht ist (selbstgebaute Blöcke, vertipptes Etikett).
    const eigen = [block('a', 'angreifer'), block('s', 'sessionende')]
    const kanten = [pfeil('a', 's')]
    expect(vorspannText(eigen, kanten, 'a')).toContain(
      v.keinerTrotzNachfahren(bezeichnung(2, 'Sessionende'))
    )
  })

  it('lässt dem echten letzten Block seinen Satz', () => {
    // Sessionende ganz am Ende: keine Nachfahren, keine Etiketten — „du bist
    // der letzte Schritt" stimmt hier, und die Wache darf ihn nicht wegnehmen.
    const text = vorspannText(bloecke, pfeile, 'sb')
    expect(text).toContain(v.keiner)
  })
})

describe('BAUPLAN 43 · Prüf-Blöcke erfahren, wohin ihre Kritik geht', () => {
  const bloecke = [
    block('p', 'paket-schneiden'),
    block('b', 'bauer'),
    block('t', 'pruefer')
  ]
  const pfeile = [pfeil('p', 'b'), pfeil('b', 't')]

  it('nennt ohne eigene Wahl den nächsten Vorfahren', () => {
    expect(vorspannText(bloecke, pfeile, 't')).toContain(
      v.rueckfuehrung(bezeichnung(2, 'Bauer'))
    )
  })

  it('nennt das eingestellte Ziel, nicht blind den nächsten Vorfahren', () => {
    const gewaehlt = bloecke.map((b) => (b.instanzId === 't' ? { ...b, zurueckZu: 'p' } : b))
    const text = vorspannText(gewaehlt, pfeile, 't')
    expect(text).toContain(v.rueckfuehrung(bezeichnung(1, 'Paket schneiden')))
    expect(text).not.toContain(v.rueckfuehrung(bezeichnung(2, 'Bauer')))
  })

  it('lässt die Angabe weg, wo sie nicht hingehört', () => {
    // Kein Prüf-Block — und ein Prüfer ohne Vorfahren hat kein Ziel.
    expect(vorspannText(bloecke, pfeile, 'b')).not.toContain(
      v.rueckfuehrung(bezeichnung(1, 'Paket schneiden'))
    )
    const allein = [block('t', 'pruefer')]
    expect(vorspannText(allein, [], 't')).toContain(v.einzelblock)
  })
})

describe('BAUPLAN 43 · Georg kann nachlesen, was der Block bekommen hat', () => {
  // Der Alltagstest verlangt, dass „geht an niemanden — du bist der letzte
  // Schritt" im Laufbericht steht. Der zusammengesetzte Auftrag geht aber nur
  // an den Motor und wird nirgends aufbewahrt. Deshalb tickert der Lauf den
  // Vorspann je Block einmal — und der Verlauf des Laufberichts IST der Ticker.
  // Eine Ticker-Zeile ist eine Zeile: Der Vorspann muss dafür umbruchfrei
  // werden, ohne dass dabei ein Satz zerfällt.
  const bloecke = [block('p', 'paket-schneiden'), block('b', 'bauer')]
  const pfeile = [pfeil('p', 'b')]
  const einzeilig = (s) => s.replace(/\s+/g, ' ').trim()

  it('trägt den „geht an niemanden"-Satz in EINER Zeile', () => {
    const zeile = vorspannZeile(bloecke, pfeile, 'b')
    expect(zeile).not.toContain('\n')
    expect(zeile).toContain(einzeilig(v.keiner))
  })

  it('verliert dabei keine Angabe — Empfänger, Kette und Position stehen drin', () => {
    const zeile = vorspannZeile(bloecke, pfeile, 'p')
    expect(zeile).not.toContain('\n')
    expect(zeile).toContain(
      einzeilig(v.empfaenger(bezeichnung(2, 'Bauer'), 'Arbeitspaket', wozu('bauer', 'Arbeitspaket')))
    )
    expect(zeile).toContain(einzeilig(v.kette('1 Paket schneiden → 2 Bauer')))
    expect(zeile).toContain(einzeilig(v.position(1, 2)))
  })

  it('sagt im Ticker Wort für Wort dasselbe wie im Auftrag', () => {
    // Zwei Quellen, ein Text: Stünde im Ticker etwas anderes als im Auftrag,
    // wäre die Nachlese wertlos.
    expect(vorspannZeile(bloecke, pfeile, 'b')).toBe(einzeilig(vorspannText(bloecke, pfeile, 'b')))
  })
})

describe('BAUPLAN 43 · Derselbe Block liest in jedem Anlauf dasselbe', () => {
  // Der Auftrag wird bei JEDEM Anlauf neu gebaut — Reparatur-Runde,
  // Nachforderung, Übertrag, Kontingent-Pause. Läse der Vorspann irgendwo in
  // den Laufstatus, stünde in Runde 2 etwas anderes als in Runde 1, und der
  // Prompt-Cache wäre gleich mit hin.
  const bloecke = [
    block('p', 'paket-schneiden'),
    block('b', 'bauer'),
    block('t', 'pruefer', 'Motor')
  ]
  const pfeile = [pfeil('p', 'b'), pfeil('b', 't')]

  it('liefert bei wiederholtem Aufruf Wort für Wort denselben Text', () => {
    const erster = vorspannText(bloecke, pfeile, 'b')
    const zweiter = vorspannText(bloecke, pfeile, 'b')
    expect(zweiter).toBe(erster)
  })

  it('hängt nur an den Daten, nicht an den Objekten — frische Kopie, gleicher Text', () => {
    const kopie = JSON.parse(JSON.stringify(bloecke))
    const kopiePfeile = JSON.parse(JSON.stringify(pfeile))
    expect(vorspannText(kopie, kopiePfeile, 'b')).toBe(vorspannText(bloecke, pfeile, 'b'))
  })
})

describe('BAUPLAN 44 · Gleiche Empfänger-Zeilen stehen einmal statt dreimal', () => {
  // Rot-vor-Grün: Vor Bauschritt 44 hängte vorspannText je Empfänger eine eigene
  // Zeile an — bei drei Bauern hinter „Paket schneiden" stand derselbe
  // „wozu"-Satz dreimal im Auftrag, und zwar in JEDEM Anlauf. Die Bausteine
  // empfaengerMehrere/empfaengerMehrereOptional gab es nicht (Zugriff darauf war
  // undefined). Beim Nachbauen wurde zusätzlich die Grenze verfälscht
  // (Bündelung schon ab EINEM Empfänger) — dann wurde die Prüfung „bei genau
  // einem Empfänger bleibt der Wortlaut der bisherige" rot.
  const dreiBauer = [
    block('p', 'paket-schneiden'),
    block('b1', 'bauer', 'UI'),
    block('b2', 'bauer', 'Motor'),
    block('b3', 'bauer', 'Daten')
  ]
  const dreiPfeile = [pfeil('p', 'b1'), pfeil('p', 'b2'), pfeil('p', 'b3')]

  it('fasst drei Bauer mit demselben „wozu" in EINE Zeile — und lässt keinen weg', () => {
    const text = vorspannText(dreiBauer, dreiPfeile, 'p')
    const namen = [
      bezeichnung(2, 'Bauer · UI'),
      bezeichnung(3, 'Bauer · Motor'),
      bezeichnung(4, 'Bauer · Daten')
    ]
    expect(text).toContain(
      v.empfaengerMehrere(namen, 'Arbeitspaket', wozu('bauer', 'Arbeitspaket'))
    )
    for (const name of namen) expect(text).toContain(name)
    // Der teure Teil — der „wozu"-Satz — steht genau einmal.
    expect(text.split(wozu('bauer', 'Arbeitspaket'))).toHaveLength(2)
  })

  it('bleibt bei genau EINEM Empfänger Zeichen für Zeichen beim bisherigen Wortlaut', () => {
    const einer = [block('p', 'paket-schneiden'), block('b', 'bauer')]
    const einerPfeile = [pfeil('p', 'b')]
    expect(vorspannText(einer, einerPfeile, 'p')).toContain(
      v.empfaenger(bezeichnung(2, 'Bauer'), 'Arbeitspaket', wozu('bauer', 'Arbeitspaket'))
    )
  })

  it('bündelt nur bei gleichem Etikett, gleicher Verbindlichkeit und gleichem „wozu"', () => {
    // Standard-Vorlage: Angreifer, Bauer und Prüfer bekommen alle das
    // Arbeitspaket — aber mit drei VERSCHIEDENEN „wozu"-Sätzen. Da hilft
    // Bündeln nicht, und es darf auch nichts verschmelzen.
    const vorlage = [
      block('p', 'paket-schneiden'),
      block('a', 'angreifer'),
      block('b', 'bauer'),
      block('t', 'pruefer')
    ]
    const kanten = [pfeil('p', 'a'), pfeil('a', 'b'), pfeil('b', 't')]
    const text = vorspannText(vorlage, kanten, 'p')
    for (const [nummer, name, id] of [
      [2, 'Angreifer', 'angreifer'],
      [3, 'Bauer', 'bauer'],
      [4, 'Prüfer', 'pruefer']
    ])
      expect(text).toContain(
        v.empfaenger(bezeichnung(nummer, name), 'Arbeitspaket', wozu(id, 'Arbeitspaket'))
      )
  })

  it('hält optionale Empfänger von verlangten getrennt — sonst verspricht der Satz zu viel', () => {
    // Zwei Bauer nehmen die Angriffsliste OPTIONAL mit; die Zeile muss die
    // optionale Sprache tragen, nicht die verlangende.
    const bloecke = [
      block('a', 'angreifer'),
      block('b1', 'bauer', 'UI'),
      block('b2', 'bauer', 'Motor')
    ]
    const kanten = [pfeil('a', 'b1'), pfeil('a', 'b2')]
    const text = vorspannText(bloecke, kanten, 'a')
    expect(text).toContain(
      v.empfaengerMehrereOptional(
        [bezeichnung(2, 'Bauer · UI'), bezeichnung(3, 'Bauer · Motor')],
        'Angriffsliste',
        wozu('bauer', 'Angriffsliste')
      )
    )
  })
})
