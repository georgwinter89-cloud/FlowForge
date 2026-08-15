// Diff der bisherigen Runden (BAUPLAN 34): Der frische Bauer einer
// Reparatur-Runde bekommt den exakten Unterschied „Das hast du in diesem Lauf
// bisher geändert" — gerechnet aus zwei Sicherungspunkten. Hier steht der reine
// Teil: Zeilen gegenüberstellen und den Text bauen. Das Lesen der
// Sicherungspunkte macht sicherungspunkte.js; ein git.exe braucht es nirgends.

// Zeilen Umgebung ober- und unterhalb einer geänderten Stelle.
const KONTEXT_ZEILEN = 2
// Deckel für den Zeilen-Vergleich: Bei sehr großen Änderungsbereichen kostet
// die Gegenüberstellung mehr, als sie nützt — dann gibt es nur noch
// „geändert ab Zeile N" (so sieht es der Bauplan für große Dateien vor).
const VERGLEICH_DECKEL_ZELLEN = 250_000
// So viele Zeilen einer neu angelegten Datei werden gezeigt.
const NEUE_DATEI_ZEILEN = 40

export function inZeilen(text) {
  if (text == null || text === '') return []
  return String(text).split(/\r?\n/)
}

// Längste gemeinsame Teilfolge, klassisch als Tabelle — liefert die
// Schrittfolge ' ' (unverändert), '-' (weg), '+' (dazu).
function schrittfolge(alt, neu) {
  const n = alt.length
  const m = neu.length
  const breite = m + 1
  const tabelle = new Int32Array((n + 1) * breite)
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      tabelle[i * breite + j] =
        alt[i] === neu[j]
          ? tabelle[(i + 1) * breite + j + 1] + 1
          : Math.max(tabelle[(i + 1) * breite + j], tabelle[i * breite + j + 1])
  const schritte = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (alt[i] === neu[j]) {
      schritte.push({ art: ' ', text: alt[i] })
      i++
      j++
    } else if (tabelle[(i + 1) * breite + j] >= tabelle[i * breite + j + 1]) {
      schritte.push({ art: '-', text: alt[i] })
      i++
    } else {
      schritte.push({ art: '+', text: neu[j] })
      j++
    }
  }
  while (i < n) schritte.push({ art: '-', text: alt[i++] })
  while (j < m) schritte.push({ art: '+', text: neu[j++] })
  return schritte
}

// Schneidet die Schrittfolge in Stellen: zusammenhängende Änderungen samt
// Umgebung. Lange unveränderte Strecken dazwischen trennen zwei Stellen. Die
// Umgebung VOR einer Änderung ist beim Durchlaufen noch nicht bekannt —
// deshalb wandern die letzten unveränderten Zeilen durch einen kleinen Puffer.
function stellenMitVorlauf(schritte, startZeileNeu) {
  const stellen = []
  let laufend = null
  let seitAenderung = 0
  const puffer = []
  let zeileNeu = startZeileNeu
  let zeileVonPuffer = startZeileNeu
  for (const schritt of schritte) {
    if (schritt.art === ' ') {
      if (laufend) {
        seitAenderung++
        if (seitAenderung <= KONTEXT_ZEILEN) laufend.zeilen.push(schritt)
        else laufend = null
      }
      if (!laufend) {
        puffer.push({ schritt, zeile: zeileNeu })
        if (puffer.length > KONTEXT_ZEILEN) puffer.shift()
      }
    } else {
      if (!laufend) {
        zeileVonPuffer = puffer.length ? puffer[0].zeile : zeileNeu
        laufend = { abZeile: zeileVonPuffer, zeilen: puffer.map((e) => e.schritt) }
        stellen.push(laufend)
        puffer.length = 0
      }
      seitAenderung = 0
      laufend.zeilen.push(schritt)
    }
    if (schritt.art !== '-') zeileNeu++
  }
  return stellen
}

// Vergleicht zwei Zeilen-Listen: Bilanz (+n/−m) und die geänderten Stellen.
export function zeilenVergleich(altZeilen, neuZeilen) {
  let anfang = 0
  while (
    anfang < altZeilen.length &&
    anfang < neuZeilen.length &&
    altZeilen[anfang] === neuZeilen[anfang]
  )
    anfang++
  let ende = 0
  while (
    ende < altZeilen.length - anfang &&
    ende < neuZeilen.length - anfang &&
    altZeilen[altZeilen.length - 1 - ende] === neuZeilen[neuZeilen.length - 1 - ende]
  )
    ende++
  const altRest = altZeilen.slice(anfang, altZeilen.length - ende)
  const neuRest = neuZeilen.slice(anfang, neuZeilen.length - ende)
  if (altRest.length === 0 && neuRest.length === 0)
    return { plus: 0, minus: 0, stellen: [], zuGross: false, abZeile: anfang + 1 }
  if (altRest.length * neuRest.length > VERGLEICH_DECKEL_ZELLEN)
    return {
      plus: neuRest.length,
      minus: altRest.length,
      stellen: [],
      zuGross: true,
      abZeile: anfang + 1
    }
  const schritte = schrittfolge(altRest, neuRest)
  // Umgebung aus dem gemeinsamen Anfang/Schluss dazunehmen.
  const vorne = neuZeilen
    .slice(Math.max(0, anfang - KONTEXT_ZEILEN), anfang)
    .map((text) => ({ art: ' ', text }))
  const hinten = neuZeilen
    .slice(neuZeilen.length - ende, neuZeilen.length - ende + KONTEXT_ZEILEN)
    .map((text) => ({ art: ' ', text }))
  const startZeile = anfang - vorne.length + 1
  const stellen = stellenMitVorlauf([...vorne, ...schritte, ...hinten], startZeile)
  return {
    plus: schritte.filter((s) => s.art === '+').length,
    minus: schritte.filter((s) => s.art === '-').length,
    stellen,
    zuGross: false,
    abZeile: anfang + 1
  }
}

// Eine Datei im Vergleich zweier Sicherungspunkte.
// alt/neu: null (nicht vorhanden), { binaer: true } oder { text }.
export function dateiUnterschied(pfad, alt, neu) {
  const art = alt == null ? 'neu' : neu == null ? 'geloescht' : 'geaendert'
  if (alt?.binaer || neu?.binaer)
    return { pfad, art, binaer: true, plus: 0, minus: 0, stellen: [], zuGross: false, abZeile: 1 }
  if (art === 'geloescht')
    return {
      pfad,
      art,
      binaer: false,
      plus: 0,
      minus: inZeilen(alt.text).length,
      stellen: [],
      zuGross: false,
      abZeile: 1
    }
  if (art === 'neu') {
    const zeilen = inZeilen(neu.text)
    const gezeigt = zeilen.slice(0, NEUE_DATEI_ZEILEN)
    return {
      pfad,
      art,
      binaer: false,
      plus: zeilen.length,
      minus: 0,
      stellen: gezeigt.length
        ? [{ abZeile: 1, zeilen: gezeigt.map((text) => ({ art: '+', text })) }]
        : [],
      zuGross: zeilen.length > NEUE_DATEI_ZEILEN,
      abZeile: 1
    }
  }
  const vergleich = zeilenVergleich(inZeilen(alt.text), inZeilen(neu.text))
  return { pfad, art, binaer: false, ...vergleich }
}

function bilanz(datei) {
  if (datei.binaer) return ''
  if (datei.art === 'neu') return ` (+${datei.plus})`
  if (datei.art === 'geloescht') return ` (−${datei.minus})`
  return ` (+${datei.plus}/−${datei.minus})`
}

const ART_WORT = { neu: 'neu', geaendert: 'geändert', geloescht: 'gelöscht' }

// Baut den Text, der in den Auftrag der Reparatur-Runde wandert. Gedeckelt:
// Die Dateiliste steht immer vollständig da (sie ist kurz), die Ausschnitte
// so weit, wie der Deckel reicht — der Rest fällt sichtbar auf
// „geändert ab Zeile N" zurück.
export function diffTextBauen(dateien, optionen = {}) {
  const deckel = optionen.deckel ?? 6000
  const liste = dateien.map(
    (datei) =>
      `- ${datei.pfad} — ${ART_WORT[datei.art] ?? datei.art}${bilanz(datei)}` +
      (datei.binaer ? ' (keine Textdatei)' : '')
  )
  const kopf = liste.join('\n')
  const ausschnitte = []
  let uebrig = Math.max(0, deckel - kopf.length)
  let weggelassen = 0
  for (const datei of dateien) {
    if (!datei.stellen.length) {
      if (datei.art === 'geaendert' && (datei.zuGross || datei.binaer)) weggelassen++
      continue
    }
    const bloecke = datei.stellen.map(
      (stelle) =>
        `--- ${datei.pfad}, ab Zeile ${stelle.abZeile} ---\n` +
        stelle.zeilen.map((z) => z.art + z.text).join('\n')
    )
    const text = bloecke.join('\n')
    if (text.length + 2 > uebrig) {
      weggelassen++
      continue
    }
    ausschnitte.push(text)
    uebrig -= text.length + 2
  }
  const teile = [kopf]
  if (ausschnitte.length) teile.push('', 'Die geänderten Stellen:', '', ausschnitte.join('\n\n'))
  if (weggelassen)
    teile.push(
      '',
      `(${weggelassen} ${weggelassen === 1 ? 'Datei ist' : 'Dateien sind'} zu groß für ` +
        'Ausschnitte — dort steht nur die Zeilenbilanz oben; sieh selbst nach, wenn du sie brauchst.)'
    )
  if (optionen.verschmutzt)
    teile.push(
      '',
      'Hinweis von FlowForge: Der Projektordner war beim ersten Start dieses Blocks schon ' +
        'verändert (ein nur-lesender Block darf in diesem Lauf Befehle ausführen) — ein ' +
        'Teil der Liste stammt womöglich nicht von dir.'
    )
  return teile.join('\n')
}

// Zeilen-Bilanz über alle Dateien — für die Ticker-Zeile.
export function diffBilanz(dateien) {
  return dateien.reduce((summe, datei) => summe + datei.plus + datei.minus, 0)
}
