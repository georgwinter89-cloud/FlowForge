// Empfänger im Auftrag (BAUPLAN 43) — die Textseite, mechanisch festgenagelt.
//
// Kern des Bauschritts: Kein Blockauftrag und kein Agenten-Text darf mehr einen
// anderen Block beim Namen nennen. Wer wirklich hinter einem Block liegt, weiß
// nur das Schaubild — der Katalog wusste es nie und behauptete es trotzdem
// („Deine Meldung ist die Übergabe an den Prüfer"). Liegt ein Bauer ohne Prüfer
// auf der Leinwand, schrieb er bis Bauschritt 42 trotzdem für ihn.
//
// Die Inventur ist bewusst MECHANISCH (über alle Katalognamen gegriffen) statt
// aus einer Liste abgeschrieben: Es waren nie „acht Stellen", und die nächste
// entsteht beim nächsten Auftrags-Feinschliff von selbst.
import { describe, it, expect } from 'vitest'
import { BLOCK_KATALOG } from '../src/shared/blockKatalog.js'
import { pruefeEigenenBlock, BRAUCHT_WOZU_MAX } from '../src/shared/blockRegeln.js'
import { texte } from '../src/shared/texte.js'

// Ein Katalogname gilt als genannt, wenn er als eigenes Wort vorkommt —
// deutsche Beugung (Prüfers, Prüfern) zählt mit. Ein vorangestellter
// Bindestrich zählt NICHT: „Übungs-Prüfer", „Karten-Prüfer" und
// „Blickwinkel-Prüfer" sind andere Wörter, und „Prüf-Blöcke" ist die
// entnamentlichte Sprechweise, die dieser Bauschritt gerade eingeführt hat.
function nennung(name) {
  const escapiert = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^A-Za-zÄÖÜäöüß-])${escapiert}(s|n|en)?(?![A-Za-zÄÖÜäöüß])`)
}

const KATALOG_NAMEN = BLOCK_KATALOG.map((b) => b.name)

// Agenten-Texte in texte.js: alles, was in einem Agenten-Prompt, einer
// Werkzeug-Beschreibung oder einer Rückmeldung an einen Agenten landet.
// GRENZE dieser Inventur: Sie greift nur texte.js ab — Agenten-Texte, die
// regelwidrig inline in src/main stünden, sähe sie nicht. Deshalb ist der
// letzte solche Text (der System-Prompt der lokalen Vorreparatur) mit diesem
// Bauschritt nach texte.agentenLokaleHelfer.reparaturSystem gezogen worden,
// statt die Lücke stehen zu lassen.
const AGENTEN_ABSCHNITTE = [
  'agentenMensch',
  'agentenVorschlag',
  'agentenLaufVorschlag',
  'agentenKartenZuteilung',
  'agentenPaket',
  'agentenKarten',
  'agentenUebergabe',
  'agentenVorspann',
  'agentenLaufSession',
  'agentenPruefordner',
  'agentenPruefkarten',
  'agentenLokaleHelfer',
  'agentenStart',
  'agentenPruefbefehl',
  'agentenApp',
  'agentenThemenSortieren',
  'lieferschein',
  'tor'
]

// Ausnahmen, jede einzeln begründet:
// - agentenChat: der Co-Pilot beantwortet Bedienfragen zu FlowForge; er MUSS
//   die Blockbibliothek und die Vorlagen beim Namen nennen können. Er erteilt
//   keinen Blockauftrag.
// - agentenBlockAssistent: füllt das Block-Formular für den Nutzer aus —
//   dieselbe Begründung.
// - rechteFrage: gemischt. Die Erlaubnis-Dialoge gehen an Georg („üblich ist
//   das nur im Sessionende-Block") und dürfen Namen nennen; geprüft werden
//   deshalb genau die Schlüssel auf …FuerAgent, die der Agent zu lesen bekommt.
const AUSNAHMEN = ['agentenChat', 'agentenBlockAssistent']

// Textbausteine sind teils Strings, teils Funktionen. Funktionen werden mit
// Platzhaltern aufgerufen — der erste Satz Argumente, der nicht wirft, gilt.
const PLATZHALTER = ['Beispiel', ['Beispiel'], 1, { beschreibung: 'Beispiel' }]

function textStuecke(wert, pfad, sammlung) {
  if (typeof wert === 'string') sammlung.push([pfad, wert])
  else if (typeof wert === 'function') {
    for (const kandidat of PLATZHALTER) {
      try {
        const ergebnis = wert(...Array(wert.length).fill(kandidat))
        if (typeof ergebnis === 'string') sammlung.push([pfad, ergebnis])
        break
      } catch {
        // nächster Platzhalter
      }
    }
  } else if (wert && typeof wert === 'object')
    for (const [schluessel, unterwert] of Object.entries(wert))
      textStuecke(unterwert, `${pfad}.${schluessel}`, sammlung)
  return sammlung
}

function agentenTexte() {
  const sammlung = []
  for (const abschnitt of AGENTEN_ABSCHNITTE)
    textStuecke(texte[abschnitt], abschnitt, sammlung)
  for (const [schluessel, wert] of Object.entries(texte.rechteFrage))
    if (schluessel.endsWith('FuerAgent')) textStuecke(wert, `rechteFrage.${schluessel}`, sammlung)
  return sammlung
}

describe('BAUPLAN 43 · Blockaufträge nennen keinen anderen Block beim Namen', () => {
  it('kein Arbeitsauftrag nennt einen fremden Katalog-Blocknamen', () => {
    for (const block of BLOCK_KATALOG)
      for (const name of KATALOG_NAMEN) {
        if (name === block.name) continue
        expect(block.auftrag, `${block.id} nennt „${name}"`).not.toMatch(nennung(name))
      }
  })

  it('auch die Kurzbeschreibungen kommen ohne fremde Blocknamen aus', () => {
    for (const block of BLOCK_KATALOG)
      for (const name of KATALOG_NAMEN) {
        if (name === block.name) continue
        expect(block.beschreibung ?? '', `${block.id} nennt „${name}"`).not.toMatch(nennung(name))
      }
  })

  it('kein Agenten-Text in texte.js nennt einen Katalog-Blocknamen', () => {
    for (const [pfad, text] of agentenTexte())
      for (const name of KATALOG_NAMEN)
        expect(text, `${pfad} nennt „${name}"`).not.toMatch(nennung(name))
  })

  it('die Ausnahmen sind genau die begründeten — und sie sind Absicht', () => {
    for (const ausnahme of AUSNAHMEN) expect(texte[ausnahme]).toBeTruthy()
    for (const ausnahme of AUSNAHMEN) expect(AGENTEN_ABSCHNITTE).not.toContain(ausnahme)
  })
})

describe('BAUPLAN 43 · brauchtWozu — das „wozu" hat eine Datenquelle', () => {
  it('jedes braucht- und brauchtOptional-Etikett hat einen Satz', () => {
    for (const block of BLOCK_KATALOG) {
      const etiketten = [...block.braucht, ...(block.brauchtOptional ?? [])]
      for (const etikett of etiketten) {
        const satz = block.brauchtWozu?.[etikett]
        expect(typeof satz, `${block.id} ohne brauchtWozu zu „${etikett}"`).toBe('string')
        expect(satz.trim().length, `${block.id} · ${etikett}`).toBeGreaterThan(10)
      }
    }
  })

  it('kein brauchtWozu zu einem Etikett, das der Block gar nicht braucht', () => {
    for (const block of BLOCK_KATALOG) {
      const etiketten = [...block.braucht, ...(block.brauchtOptional ?? [])]
      for (const etikett of Object.keys(block.brauchtWozu ?? {}))
        expect(etiketten, `${block.id} · ${etikett}`).toContain(etikett)
    }
  })

  it('jeder Satz passt hinter „Er …" — Verb voran, kein Schlusspunkt', () => {
    for (const block of BLOCK_KATALOG)
      for (const [etikett, satz] of Object.entries(block.brauchtWozu ?? {})) {
        expect(satz[0], `${block.id} · ${etikett}`).toBe(satz[0].toLowerCase())
        expect(satz.trim().endsWith('.'), `${block.id} · ${etikett}`).toBe(false)
      }
  })

  it('nennt im „wozu" ebenfalls keinen fremden Blocknamen', () => {
    for (const block of BLOCK_KATALOG)
      for (const [etikett, satz] of Object.entries(block.brauchtWozu ?? {}))
        for (const name of KATALOG_NAMEN) {
          if (name === block.name) continue
          expect(satz, `${block.id} · ${etikett} nennt „${name}"`).not.toMatch(nennung(name))
        }
  })
})

describe('BAUPLAN 43 · eigene Blöcke pflegen ihr „wozu" selbst', () => {
  // „Kein Kennzeichen ohne Editor-Feld" (BAUPLAN, Entscheidung Georg
  // 16.08.2026): Was ein Katalog-Block kann, kann ein selbstgebauter auch.
  const roh = { name: 'Marktforscher', auftrag: 'Tu was.', braucht: ['Marktanalyse'], liefert: [] }

  it('nimmt einen Satz je braucht-Etikett an und räumt ihn auf', () => {
    const urteil = pruefeEigenenBlock({
      ...roh,
      brauchtWozu: { Marktanalyse: '  vergleicht   die Zahlen mit dem Vorjahr.  ' }
    })
    expect(urteil.block.brauchtWozu).toEqual({
      Marktanalyse: 'vergleicht die Zahlen mit dem Vorjahr'
    })
  })

  it('wirft Sätze zu Etiketten weg, die der Block gar nicht braucht', () => {
    const urteil = pruefeEigenenBlock({ ...roh, brauchtWozu: { Altetikett: 'macht irgendwas' } })
    expect(urteil.block.brauchtWozu).toEqual({})
  })

  it('lässt eigene Blöcke ohne Angabe durch — dort greift der Rückfall-Satz', () => {
    expect(pruefeEigenenBlock(roh).block.brauchtWozu).toEqual({})
  })

  it('weist zu lange Sätze mit klarer Meldung ab', () => {
    const urteil = pruefeEigenenBlock({
      ...roh,
      brauchtWozu: { Marktanalyse: 'x'.repeat(BRAUCHT_WOZU_MAX + 1) }
    })
    expect(urteil.fehler).toBe(
      texte.blockRegeln.brauchtWozuZuLang('Marktanalyse', BRAUCHT_WOZU_MAX)
    )
  })
})

describe('BAUPLAN 43 · der Vorspann hat alle Bausteine', () => {
  // Datenvertrag zwischen Texten und Mechanik: Fehlt ein Schlüssel, baut die
  // Lauf-Verwaltung „undefined" in den Auftrag — und niemand merkt es.
  // „ohneEtiketten" gehört seit der Nacharbeit zu Bauschritt 43 dazu: Ein Block
  // ohne liefert-Etikett, hinter dem noch etwas liegt, bekam sonst die
  // Überschrift „Wer bekommt, was du lieferst" ohne eine einzige Antwort
  // darunter — die Mechanik greift den Schlüssel ab, also nagelt ihn die
  // Prüfung fest.
  const EINFACH = [
    'ueberschrift',
    'empfaengerUeberschrift',
    'keiner',
    'ohneEtiketten',

    'einzelblock'
  ]
  const FUNKTIONEN = {
    empfaenger: 3,
    empfaengerOptional: 3,
    wozuRueckfall: 1,
    keinerTrotzNachfahren: 1,
    verdraengt: 2,
    rueckfuehrung: 1,
    kette: 1,
    position: 2
  }

  it('kennt jeden Schlüssel des Datenvertrags', () => {
    for (const schluessel of EINFACH)
      expect(typeof texte.agentenVorspann[schluessel], schluessel).toBe('string')
    for (const [schluessel, stellen] of Object.entries(FUNKTIONEN)) {
      const fn = texte.agentenVorspann[schluessel]
      expect(typeof fn, schluessel).toBe('function')
      expect(fn.length, schluessel).toBe(stellen)
      expect(typeof fn(...Array(stellen).fill('Beispiel')), schluessel).toBe('string')
    }
  })

  // Ab hier wird nur noch STRUKTUR geprüft, nie Wortlaut: Überstrenge Fallen
  // (pixelgenaue Vergleiche, Wortverbote) sind laut SPEC untersagt, und die
  // Formulierungen dieses Bauschritts sind laufender Feinschliff. Der echte
  // Fehler wäre eine verschluckte oder vertauschte Stelle — nicht ein Satz,
  // der anders klingt als am Tag seiner Entstehung.
  it('trägt jede übergebene Stelle in Kette und Position hinein', () => {
    expect(texte.agentenVorspann.kette('A → B')).toContain('A → B')
    const ort = texte.agentenVorspann.position(2, 5)
    expect(ort).toMatch(/\b2\b/)
    expect(ort).toMatch(/\b5\b/)
  })

  it('hat für „es kommt niemand" drei eigene Bausteine', () => {
    // Drei verschiedene Wahrheiten, und keine darf die andere vertreten:
    // ohne Nachfahren ist der Block wirklich der letzte; ohne eigenes
    // Liefer-Etikett kann gar nichts andocken; mit Etiketten und Nachfahren,
    // die keines wollen, ist meist ein Etikett vertippt.
    const { keiner, ohneEtiketten, keinerTrotzNachfahren } = texte.agentenVorspann
    const mitNachfahren = keinerTrotzNachfahren('Block 2 „Sessionende"')
    expect(keiner.trim().length).toBeGreaterThan(20)
    expect(ohneEtiketten.trim().length).toBeGreaterThan(20)
    expect(mitNachfahren).toContain('Block 2 „Sessionende"')
    expect(new Set([keiner, ohneEtiketten, mitNachfahren]).size).toBe(3)
  })

  it('setzt einen brauchtWozu-Satz sauber zur Empfängerzeile zusammen', () => {
    const pruefer = BLOCK_KATALOG.find((b) => b.id === 'pruefer')
    const wozu = pruefer.brauchtWozu.Umsetzungsbericht
    const zeile = texte.agentenVorspann.empfaenger('Block 4 „Prüfer"', 'Umsetzungsbericht', wozu)
    expect(zeile).toContain('Block 4 „Prüfer"')
    expect(zeile).toContain('Umsetzungsbericht')
    expect(zeile).toContain(wozu)
    expect(zeile.trimEnd().endsWith('.')).toBe(true)
  })
})
