// Lieferschein (BAUPLAN 42): Blockergebnisse als geprüfte Felder statt als
// Marker-Zeilen im Abschlusstext. Bis Bauschritt 41 meldete ein Agent teils
// über Werkzeuge und teils über drei Zeilen im Fließtext („PRUEFUNG:",
// „BEANSTANDUNG (…):", „PRUEFKARTE:"), die FlowForge per Textsuche las — an
// diesen Zeilen hingen Urteil, Reparatur-Runde, lokale Vorreparatur und das
// Prüfkarten-Archiv. Vergaß das Modell eine Zeile, fehlte sie einfach.
//
// Hier stehen die reinen Regeln (ohne Motor, ohne Electron), damit die
// Prüfskripte sie direkt fahren können:
//   - welches Werkzeug zu welchem liefert-Etikett gehört,
//   - was eine Meldung enthalten muss (Ebene 2: Längen, Anzahl, Plausibilität —
//     Claudes strenger Schema-Modus kennt keine Längengrenzen),
//   - ob die Lieferung den Bedarf des Nachfolgers deckt (Ebene 3, Kanten-Prüfung),
//   - wie eine Meldung als lesbarer Text aussieht (Übergabe und Laufbericht).
// Die Schema-Ebene (Ebene 1) steht im Werkzeug selbst (lieferscheinWerkzeuge.js).
import { texte } from './texte.js'
import { TITEL_MAX, TEXT_MAX } from './kartenRegeln.js'
import { zielFuerAdresse } from './kettenRegeln.js'

// Ein Werkzeug je liefert-Etikett, nicht je Blocksorte: Die MCP-Server werden
// einmal je Motor gebaut und ein Lauf-Motor bedient alle Blöcke (BAUPLAN 19) —
// ein Werkzeug, das sein Schema je Block wechselt, ist damit unmöglich.
export const FESTE_TEILE = {
  Arbeitspaket: { werkzeug: 'melde_arbeitspaket', art: 'arbeitspaket' },
  Prüfbeleg: { werkzeug: 'melde_pruefbeleg', art: 'pruefbeleg' },
  Umsetzungsbericht: { werkzeug: 'melde_umsetzungsbericht', art: 'umsetzungsbericht' },
  Angriffsliste: { werkzeug: 'melde_angriffsliste', art: 'funde' },
  Befundliste: { werkzeug: 'melde_befundliste', art: 'funde' }
}

// Der gemeinsame Rahmen allein — für Blöcke, die nichts liefern (Sessionende)
// und für die bewusst locker gehaltenen Etiketten (Projekt-Überblick, Antwort
// des Menschen, Kartenbericht, alles Selbstgebaute): Rahmen plus ein
// Freitext-Feld. Enge Schemata kosten Nuance bei explorativer Arbeit.
export const RAHMEN_WERKZEUG = 'melde_ergebnis'
export const WERKZEUG_PRAEFIX = 'mcp__lieferschein__'

// Harte Grenzen (Ebene 2). Bewusst großzügig genug für echte Arbeit und eng
// genug, dass ein Lieferschein den Kontext des nächsten Blocks nicht flutet.
export const FAZIT_MAX = 300
export const ZEILE_MAX = 300
export const LISTE_MAX = 20
export const ANMERKUNG_MAX = 1500
export const FUNDORT_MAX = 200
export const BEANSTANDUNG_MAX = 400
export const BELEG_MAX = 1200
export const INHALT_MAX = 6000

// Zuschnitt je Ziel (BAUPLAN 44): So viele Pakete trägt EINE Meldung höchstens
// — ein Schaubild mit mehr benannten Zielen ist keins mehr, das ein Mensch liest.
export const PAKETE_MAX = 12
// Der Datenvertrag hat eine EIGENE Anzahl-Grenze statt LISTE_MAX (20) zu erben:
// Aus dieser Liste wird mit Bauschritt 46 die Schreibsperre — eine zu enge
// Grenze wäre dann kein gekürzter Text, sondern ein blockierter Bauer.
export const DATEILISTE_MAX = 60
// Aufgaben-Kennungen zählen aus demselben Grund eigens (BAUPLAN 44): Die beiden
// Enden derselben Rechnung müssen gleich weit reichen. Gälte hier LISTE_MAX (20),
// während paket_melden mehr Karten annimmt, könnte ein Paket mit 21 Aufgaben die
// Vollständigkeit nie bestehen — FlowForge forderte endlos etwas nach, das der
// Agent gar nicht eintragen darf, und beschuldigte ihn für eine eigene Grenze.
// Deshalb gilt diese Zahl an BEIDEN Enden (paketMeldungPruefen und hier).
export const AUFGABEN_MAX = 200

export const EINSTUFUNGEN = ['mechanisch', 'grundsaetzlich']
export const URTEILE = ['bestanden', 'fehlgeschlagen']
export const SCHWEREN = ['hoch', 'mittel', 'niedrig']
export const DATEI_ARTEN = ['neu', 'geaendert', 'geloescht']

export function teilFuerEtikett(etikett) {
  return FESTE_TEILE[etikett] ?? null
}

// Die Etiketten dieses Blocks ohne eigenes Werkzeug — sie laufen über den
// Rahmen (melde_ergebnis) mit Freitext.
export function lockereEtiketten(def) {
  return (def?.liefert ?? []).filter((etikett) => !teilFuerEtikett(etikett))
}

// Welche Lieferschein-Werkzeuge darf DIESER Block nutzen? Alles andere löst die
// übliche Rechte-Rückfrage aus (Freischalt-Muster wie karte_vorschlagen).
export function werkzeugeFuerBlock(def) {
  const namen = new Set()
  const etiketten = def?.liefert ?? []
  let brauchtRahmen = etiketten.length === 0
  for (const etikett of etiketten) {
    const teil = teilFuerEtikett(etikett)
    if (teil) namen.add(teil.werkzeug)
    else brauchtRahmen = true
  }
  if (brauchtRahmen) namen.add(RAHMEN_WERKZEUG)
  return namen
}

// Beim Laufstart steht das Schaubild fest — FlowForge registriert genau die
// Werkzeuge, die DIESE Kette braucht. `defs` sind die Blockdefinitionen der
// Kette (auch mehrfach; doppelte schaden nicht).
export function werkzeugeFuerKette(defs) {
  const namen = new Set()
  for (const def of defs ?? []) for (const name of werkzeugeFuerBlock(def)) namen.add(name)
  return [...namen]
}

// Welche Art Teil gehört zu diesem Werkzeug?
export function artFuerWerkzeug(werkzeug) {
  if (werkzeug === RAHMEN_WERKZEUG) return 'rahmen'
  for (const teil of Object.values(FESTE_TEILE)) if (teil.werkzeug === werkzeug) return teil.art
  return null
}

// Welches Etikett meldet dieser Block mit dem festen Werkzeug? Es gilt genau
// das Etikett des Blocks, das zu diesem Werkzeug gehört — so kann ein Angreifer
// keine Befundliste melden und umgekehrt.
export function etikettFuerWerkzeug(def, werkzeug) {
  for (const etikett of def?.liefert ?? [])
    if (teilFuerEtikett(etikett)?.werkzeug === werkzeug) return etikett
  return null
}

// Rahmen-Werkzeug: Zu welchem Etikett gehört diese Meldung? Bei genau einem
// lockeren Etikett ist die Zuordnung eindeutig; bei mehreren muss der Agent es
// nennen. Liefert { etikett } (null = Block liefert nichts) oder { fehler }.
export function rahmenEtikett(def, roh) {
  const locker = lockereEtiketten(def)
  const gewaehlt = String(roh ?? '').trim()
  if (locker.length === 0) {
    if (gewaehlt) return { fehler: texte.lieferschein.etikettUnbekannt(gewaehlt, locker) }
    return { etikett: null }
  }
  if (!gewaehlt) {
    if (locker.length === 1) return { etikett: locker[0] }
    return { fehler: texte.lieferschein.etikettFehlt(locker) }
  }
  const treffer = locker.find((e) => e.toLowerCase() === gewaehlt.toLowerCase())
  if (!treffer) return { fehler: texte.lieferschein.etikettUnbekannt(gewaehlt, locker) }
  return { etikett: treffer }
}

// --- Ebene 2: FlowForge prüft im Code ---------------------------------------

function einzeilig(wert) {
  return String(wert ?? '').replace(/\s+/g, ' ').trim()
}

function mehrzeilig(wert) {
  return String(wert ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

// Ein Pflicht-Textfeld: gefüllt und in der Längengrenze (die Ablehnung nennt
// die Ist-Länge — dieselbe Ehrlichkeit wie bei den Karten).
function pflichtText(wert, max, feld, einzeilen = true) {
  const text = einzeilen ? einzeilig(wert) : mehrzeilig(wert)
  if (!text) return { fehler: texte.lieferschein.feldFehlt(feld) }
  if (text.length > max) return { fehler: texte.lieferschein.feldZuLang(feld, max, text.length) }
  return { text }
}

function freierText(wert, max, feld, einzeilen = true) {
  const text = einzeilen ? einzeilig(wert) : mehrzeilig(wert)
  if (!text) return { text: '' }
  if (text.length > max) return { fehler: texte.lieferschein.feldZuLang(feld, max, text.length) }
  return { text }
}

// Eine Liste kurzer Zeilen: leere Einträge fliegen raus, Anzahl und Länge sind
// gedeckelt. `zuViel` überschreibt die Abweisung bei zu vielen Einträgen — der
// Standardrat („fasse zusammen") passt für Fließtext, aber nicht für Listen aus
// Kennungen, wo es nichts zusammenzufassen gibt.
function zeilenListe(roh, feld, { max = LISTE_MAX, zeileMax = ZEILE_MAX, zuViel = null } = {}) {
  const zeilen = []
  for (const eintrag of Array.isArray(roh) ? roh : []) {
    const text = einzeilig(eintrag)
    if (!text) continue
    if (text.length > zeileMax)
      return { fehler: texte.lieferschein.eintragZuLang(feld, zeileMax, text.length) }
    zeilen.push(text)
  }
  if (zeilen.length > max)
    return {
      fehler: zuViel
        ? zuViel(max, zeilen.length)
        : texte.lieferschein.zuVieleEintraege(feld, max, zeilen.length)
    }
  return { zeilen }
}

// Der gemeinsame Rahmen aller Meldungen (BAUPLAN 42): fazit · getan · offen ·
// anmerkung. Das Freifeld ist die Antwort auf die Formular-Falle — was in kein
// Feld passt und der nächste Block trotzdem wissen sollte.
function rahmenPruefen(roh) {
  const tl = texte.lieferschein
  const fazit = pflichtText(roh?.fazit, FAZIT_MAX, tl.felder.fazit)
  if (fazit.fehler) return fazit
  const getan = zeilenListe(roh?.getan, tl.felder.getan)
  if (getan.fehler) return getan
  const offen = zeilenListe(roh?.offen, tl.felder.offen)
  if (offen.fehler) return offen
  const anmerkung = freierText(roh?.anmerkung, ANMERKUNG_MAX, tl.felder.anmerkung, false)
  if (anmerkung.fehler) return anmerkung
  return {
    rahmen: {
      fazit: fazit.text,
      getan: getan.zeilen,
      offen: offen.zeilen,
      anmerkung: anmerkung.text
    }
  }
}

// Die EINE Schreibweise eines Dateilisten-Eintrags (BAUPLAN 44): Beide Enden
// derselben Rechnung — das Melden hier und die Schreibsperre im Motor
// (stehtInDateiliste) — müssen gleich normalisieren, sonst nimmt das eine an,
// was das andere nie trifft: Ein Eintrag „/src/main/lauf.js" (eine naheliegende
// Schreibweise für „relativ zum Projektordner") galt als gültiger Vertrag,
// während der Motor ihn auf die Laufwerkswurzel rechnete und übersprang — der
// Schreibversuch auf genau diese Datei wurde dann mit der Begründung gestoppt,
// sie stehe nicht in der Liste, in der sie sichtbar stand.
//
// Rückgabe: { pfad } in einheitlicher Schreibweise (Schrägstriche vorwärts,
// ohne './' und ohne führenden '/'), { hinaus } mit dem UNVERÄNDERTEN Ist-Wert,
// wenn der Eintrag aus dem Projektordner hinausführt, oder { wurzel } mit dem
// Ist-Wert, wenn er auf den Projektordner SELBST zeigt.
export function dateiEintragNormalisieren(wert) {
  // Der Ist-Wert für die Ablehnung bleibt so stehen, wie der Agent ihn schrieb.
  const roh = String(wert ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const text = roh.replace(/\\/g, '/')
  if (!text) return { pfad: '' }
  // Zeigt aus dem Projekt hinaus: UNC-Freigabe („\\server\ablage") und
  // Laufwerksbuchstabe („C:\…") sind absolut, „.." bricht aus.
  if (text.startsWith('//') || /^[a-zA-Z]:/.test(text)) return { hinaus: roh }
  // Ein führender Schrägstrich meint „relativ zum Projektordner" — eine völlig
  // naheliegende Schreibweise, die ohne dieses Wegkürzen auf die Wurzel des
  // Laufwerks gerechnet würde und damit nie eine Projektdatei träfe.
  //
  // Gekürzt wird, bis nichts mehr wegzukürzen ist (Abschlussprüfung Bauschritt
  // 44): In fester Reihenfolge blieb ein Schrägstrich stehen, den erst das
  // Entfernen des Punkt-Vorsatzes freilegte — „.//" wurde zu „/" und damit zu
  // einem angenommenen, gespeicherten Eintrag, der auf die Laufwerkswurzel
  // zeigte. Die Liste galt dann als nicht leer (die Sperre griff also), traf
  // aber keine einzige Datei, und der Bauer wurde an JEDEM Schreibversuch
  // gestoppt. Jede Schreibweise, die am Ende auf den Projektordner selbst
  // zeigt, muss in den wurzel-Ausgang laufen.
  let pfad = text
  let vorher = ''
  while (pfad !== vorher) {
    vorher = pfad
    pfad = pfad.replace(/^\/+/, '').replace(/^(\.\/)+/, '')
  }
  if (pfad.split('/').includes('..')) return { hinaus: roh }
  // Zeigt auf den Projektordner selbst („.", „./", „.\", „/" allein): Er
  // überlebte das Melden, traf in der Sperre aber nichts — die Liste war nicht
  // leer (die Sperre galt also), rechnete sich aber auf einen leeren relativen
  // Pfad und wurde übersprungen. Folge: Der Bauer wurde an JEDEM Schreibversuch
  // gestoppt, mit der Begründung, die Datei stehe nicht in einer Liste, die
  // „alles" sagt (BAUPLAN 44).
  if (!pfad || pfad === '.') return { wurzel: roh }
  return { pfad }
}

// Der Datenvertrag (BAUPLAN 44): welche Dateien dieses Paket anfassen darf.
// Glob-Muster werden abgewiesen statt still ins Leere zu laufen — es gibt im
// ganzen Projekt keinen Glob-Abgleicher, und ab Bauschritt 46 wäre die Folge
// ein Bauer, der bei jedem Schreibversuch gestoppt wird. Geprüft wird nur der
// genannte Pfad, nie der Dateibestand: Der Vertrag nennt auch neu anzulegende
// Dateien.
function dateiListePruefen(roh) {
  const tl = texte.lieferschein
  const eintraege = []
  for (const wert of Array.isArray(roh) ? roh : []) {
    // Auf eine Schreibweise bringen — dieselbe Rechnung wie die Schreibsperre.
    const eintrag = dateiEintragNormalisieren(wert)
    // Ein ausbrechender Eintrag wird beim MELDEN abgewiesen (wie ein
    // Glob-Muster), statt still als wirkungsloser Vertragsteil stehenzubleiben.
    if (eintrag.hinaus) return { fehler: tl.dateiAusserhalb(eintrag.hinaus) }
    // Ein Eintrag, der den Projektordner selbst meint, wird ebenfalls beim
    // MELDEN abgewiesen: Ein Vertrag, der alles erlaubt, ist kein Vertrag — und
    // in der Sperre träfe er keine einzige Datei. Für diesen Fall gibt es einen
    // sauberen Weg, und der Text nennt ihn: erlaubteDateien weglassen, dann
    // gilt „keine Liste = keine Sperre".
    if (eintrag.wurzel) return { fehler: tl.dateiProjektordner(eintrag.wurzel) }
    const text = eintrag.pfad
    if (!text) continue
    if (/[*?[\]{}]/.test(text)) return { fehler: tl.dateiMuster(text) }
    if (text.length > FUNDORT_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.erlaubteDateien, FUNDORT_MAX, text.length) }
    if (!eintraege.includes(text)) eintraege.push(text)
  }
  if (eintraege.length > DATEILISTE_MAX)
    return {
      fehler: tl.zuVieleEintraege(tl.felder.erlaubteDateien, DATEILISTE_MAX, eintraege.length)
    }
  return { eintraege }
}

// EIN Zuschnitt: das alte Arbeitspaket plus Zieladresse und Datenvertrag.
// `umfeld.ziele` sind die benannten Ziele des rufenden Blocks (kettenRegeln.
// zielListe); liegen sie vor, wird die Adresse hart dagegen validiert — eine
// erfundene Adresse träfe sonst niemanden, ohne dass jemand es merkt.
function zuschnittPruefen(roh, umfeld) {
  const tl = texte.lieferschein
  const ziel = pflichtText(roh?.ziel, ZEILE_MAX, tl.felder.ziel)
  if (ziel.fehler) return ziel
  const kriterien = zeilenListe(roh?.fertigKriterien, tl.felder.fertigKriterien)
  if (kriterien.fehler) return kriterien
  // Kanten-Prüfung im Kleinen: Ein Arbeitspaket ohne Fertig-Kriterien ist keins
  // — der Prüfer hätte keinen Maßstab und der Bauer kein Ziel.
  if (kriterien.zeilen.length === 0) return { fehler: tl.arbeitspaketOhneKriterien }
  const schritte = zeilenListe(roh?.schritte, tl.felder.schritte)
  if (schritte.fehler) return schritte
  const fundstellen = zeilenListe(roh?.fundstellen, tl.felder.fundstellen)
  if (fundstellen.fehler) return fundstellen
  const nichtDabei = zeilenListe(roh?.nichtDabei, tl.felder.nichtDabei)
  if (nichtDabei.fehler) return nichtDabei
  const bausteine = zeilenListe(roh?.bausteine, tl.felder.bausteine)
  if (bausteine.fehler) return bausteine
  const schnittstellen = zeilenListe(roh?.schnittstellen, tl.felder.schnittstellen)
  if (schnittstellen.fehler) return schnittstellen
  // Verbindung zur gemeldeten Aufgaben-Karte (BAUPLAN 44): Ohne sie wäre die
  // Vollständigkeitsprüfung ein Textvergleich — genau die Bauform, die
  // Bauschritt 42 abgeschafft hat. Geprüft wird deshalb HART gegen das mit
  // paket_melden gemeldete Paket (`umfeld.paket`, Muster: paketMeldungPruefen):
  // Eine erfundene id deckte sonst nichts ab und niemand merkte es.
  //
  // Die Anzahl-Grenze ist AUFGABEN_MAX, dieselbe wie in paketMeldungPruefen —
  // mit dem geerbten LISTE_MAX (20) wäre ein Paket mit 21 gemeldeten Aufgaben
  // nicht mehr vollständig zuschneidbar gewesen.
  const aufgabenIds = zeilenListe(roh?.aufgabenIds, tl.felder.aufgabenIds, {
    max: AUFGABEN_MAX,
    zeileMax: FUNDORT_MAX,
    zuViel: (max, ist) => tl.zuVieleAufgabenIds(max, ist)
  })
  if (aufgabenIds.fehler) return aufgabenIds
  if (umfeld && 'paket' in umfeld && aufgabenIds.zeilen.length) {
    const paket = Array.isArray(umfeld.paket) ? umfeld.paket : null
    // Noch gar kein Paket gemeldet: Die Reihenfolge ist die Antwort — erst
    // paket_melden, dann der Zuschnitt. Sonst zeigte die Verbindung ins Leere.
    if (!paket) return { fehler: tl.aufgabenIdsOhnePaket }
    const bekannt = new Set(paket.map((a) => String(a?.id)))
    for (const id of aufgabenIds.zeilen)
      if (!bekannt.has(id))
        return {
          fehler: tl.aufgabeUnbekannt(
            id,
            paket.map((a) => `${a?.id} („${a?.titel ?? ''}")`).join(', ')
          )
        }
  }
  const dateien = dateiListePruefen(roh?.erlaubteDateien)
  if (dateien.fehler) return dateien
  let zielBlock = ''
  let zielInstanzId = null
  let zielBezeichnung = ''
  const rohZiel = einzeilig(roh?.zielBlock)
  if (rohZiel) {
    const ziele = Array.isArray(umfeld?.ziele) ? umfeld.ziele : null
    if (ziele && ziele.length) {
      const treffer = zielFuerAdresse(ziele, rohZiel)
      if (!treffer)
        return {
          fehler: tl.zielBlockUnbekannt(rohZiel, ziele.map((z) => z.bezeichnung).join(' · '))
        }
      zielBlock = treffer.adresse
      zielInstanzId = treffer.instanzId
      zielBezeichnung = treffer.bezeichnung
    } else if (ziele) return { fehler: tl.zielBlockOhneZiele(rohZiel) }
    else {
      // Ohne Zielliste (Prüfskripte, selbstgebaute Wege) bleibt die Adresse
      // stehen, wie sie kam — geprüft wird dann nur die Länge.
      if (rohZiel.length > ZEILE_MAX)
        return { fehler: tl.feldZuLang(tl.felder.zielBlock, ZEILE_MAX, rohZiel.length) }
      zielBlock = rohZiel
      zielBezeichnung = rohZiel
    }
  }
  return {
    paket: {
      zielBlock,
      zielInstanzId,
      zielBezeichnung,
      ziel: ziel.text,
      fertigKriterien: kriterien.zeilen,
      schritte: schritte.zeilen,
      fundstellen: fundstellen.zeilen,
      nichtDabei: nichtDabei.zeilen,
      bausteine: bausteine.zeilen,
      schnittstellen: schnittstellen.zeilen,
      erlaubteDateien: dateien.eintraege,
      aufgabenIds: aufgabenIds.zeilen
    }
  }
}

// Ein Aufruf trägt ALLE Pakete (BAUPLAN 44, Entscheidung Georg): Der
// Sammel-Schlüssel der Meldungen ist (etikett, art) — ein zweiter Aufruf
// ersetzte den ersten, und von drei Paketen überlebte nur das dritte. Ein
// Aufruf ist zugleich atomar: Er übersteht einen Übertrag mitten in der Meldung.
function arbeitspaketPruefen(roh, umfeld) {
  const tl = texte.lieferschein
  // Rückfall ohne Bruch: Eine Meldung im alten Format (ein Paket, flach) gilt
  // als Liste mit genau einem Eintrag.
  const rohe = Array.isArray(roh?.pakete) ? roh.pakete : roh?.ziel != null ? [roh] : []
  if (rohe.length === 0) return { fehler: tl.arbeitspaketOhnePaket }
  if (rohe.length > PAKETE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.pakete, PAKETE_MAX, rohe.length) }
  const pakete = []
  const belegt = new Set()
  for (let i = 0; i < rohe.length; i++) {
    const geprueft = zuschnittPruefen(rohe[i], umfeld)
    if (geprueft.fehler) return { fehler: tl.paketFehler(i + 1, geprueft.fehler) }
    // Zwei Pakete für dasselbe Ziel: Der Empfänger bekäme eines von beiden,
    // ohne dass jemand sagen könnte welches — lieber sofort abweisen.
    const schluessel = zuschnittSchluessel(geprueft.paket)
    if (belegt.has(schluessel))
      return { fehler: tl.zielDoppelt(geprueft.paket.zielBezeichnung || tl.ohneZiel) }
    belegt.add(schluessel)
    pakete.push(geprueft.paket)
  }
  return { teil: { pakete } }
}

// Der Schlüssel, unter dem ein Zuschnitt zugestellt wird: die Instanz des
// benannten Ziels, '' für ein Paket ohne Ziel (gilt für alle).
export function zuschnittSchluessel(paket) {
  return paket?.zielInstanzId ?? ''
}

// Die Zuschnitte einer Arbeitspaket-Meldung — tolerant gegenüber Meldungen aus
// der Zeit vor Bauschritt 44 (ein Paket, flach im Meldungsobjekt).
export function zuschnitteAusMeldung(meldung) {
  if (Array.isArray(meldung?.pakete)) return meldung.pakete
  if (meldung?.ziel != null) return [meldung]
  return []
}

// Alle Zuschnitte einer Meldungsliste — eine Stelle für Deckung, Ticker und
// Schreibsperre, damit sie nicht dreimal verschieden zählen.
export function zuschnitteAusMeldungen(meldungen) {
  const alle = []
  for (const meldung of meldungen ?? [])
    if (meldung?.art === 'arbeitspaket') alle.push(...zuschnitteAusMeldung(meldung))
  return alle
}

// Der Arbeitsbereich eines Blocks aus den Paketen, die bei ihm ankommen
// (BAUPLAN 44): die VEREINIGUNG ihrer Dateilisten, wie SPEC §4.1 und §7 (3) es
// zusagen. Ein Paket ohne Liste trägt nichts bei — es setzt die Sperre aber
// auch nicht aus: Sonst hätte ein einziges listenloses Paket neben einem
// vollständigen die ganze Sperre lautlos abgeschaltet, und Georg hielte eine
// Sperre für geltend, die es nicht ist. Keine Liste in KEINEM Paket heißt
// weiterhin keine Sperre (null) — das ist der Rückfall ohne Bruch für alte
// Laufstände.
export function dateiListeVereinigen(zuschnitte) {
  const dateien = []
  for (const paket of zuschnitte ?? [])
    for (const datei of paket?.erlaubteDateien ?? [])
      if (!dateien.includes(datei)) dateien.push(datei)
  return dateien.length ? dateien : null
}

// Vollständigkeit des Zuschnitts (BAUPLAN 44) — die reine Rechnung, ohne Motor
// und ohne Electron, damit die Regel-Prüfungen sie direkt fahren können.
//
// Zwei Fragen, beide beantwortbar erst seit Teil A:
//   1. Kommt jede Aufgabe des GEMELDETEN Pakets (paket_melden) in mindestens
//      einem Zuschnitt vor? Gemessen wird gegen `aufgabenIds` je Zuschnitt —
//      eine Rechnung, keine Textsuche.
//   2. Hat jedes benannte Ziel ein Paket bekommen?
//
// Rückfall ohne Bruch: Ein einziger Zuschnitt OHNE Zieladresse gilt für alle
// (Routing-Regel) — bei höchstens EINEM benannten Ziel ist damit alles bedient,
// und ein Agent, der wie vor Bauschritt 44 ein Paket ohne Ziel meldet, läuft
// unverändert durch. Ab ZWEI benannten Zielen ist ein Paket ohne Adresse dagegen
// genau das Problem, das dieser Schritt löst: Beide bekämen denselben Zuschnitt.
export function zuschnittDeckung(ziele, gemeldetesPaket, meldungen) {
  const zuschnitte = zuschnitteAusMeldungen(meldungen)
  const fehlendeAufgaben = []
  const unbedienteZiele = []
  // Ohne einen einzigen Zuschnitt gibt es nichts zu decken — dass gar nichts
  // gemeldet wurde, fängt die Meldungspflicht ab (meldungVollstaendig).
  if (zuschnitte.length === 0) return { fehlendeAufgaben, unbedienteZiele }
  const abgedeckt = new Set()
  for (const paket of zuschnitte)
    for (const id of paket?.aufgabenIds ?? []) abgedeckt.add(String(id))
  for (const aufgabe of Array.isArray(gemeldetesPaket) ? gemeldetesPaket : [])
    if (!abgedeckt.has(String(aufgabe?.id))) fehlendeAufgaben.push(aufgabe)
  const liste = Array.isArray(ziele) ? ziele : []
  const ohneZiel = zuschnitte.some((paket) => !paket?.zielInstanzId)
  if (!(ohneZiel && liste.length <= 1)) {
    const bedient = new Set(zuschnitte.map((paket) => paket?.zielInstanzId).filter(Boolean))
    for (const ziel of liste) if (!bedient.has(ziel.instanzId)) unbedienteZiele.push(ziel)
  }
  return { fehlendeAufgaben, unbedienteZiele }
}

function pruefbelegPruefen(roh) {
  const tl = texte.lieferschein
  const urteil = String(roh?.urteil ?? '').trim().toLowerCase()
  if (!URTEILE.includes(urteil)) return { fehler: tl.urteilFehlt(URTEILE) }
  const beanstandungen = []
  for (const eintrag of Array.isArray(roh?.beanstandungen) ? roh.beanstandungen : []) {
    const text = einzeilig(eintrag?.text)
    if (!text) continue
    if (text.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.beanstandungen, BEANSTANDUNG_MAX, text.length) }
    const einstufung = String(eintrag?.einstufung ?? '').trim().toLowerCase()
    if (!EINSTUFUNGEN.includes(einstufung)) return { fehler: tl.einstufungFehlt(EINSTUFUNGEN) }
    const fundort = einzeilig(eintrag?.fundort)
    if (fundort.length > FUNDORT_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.fundort, FUNDORT_MAX, fundort.length) }
    beanstandungen.push({ einstufung, text, fundort })
  }
  if (beanstandungen.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.beanstandungen, LISTE_MAX, beanstandungen.length) }
  // Plausibilität (Ebene 2): Ein Fehlurteil ohne eine einzige Beanstandung ist
  // für den Bauer wertlos; ein bestandenes Urteil mit offenen Beanstandungen
  // führt zu nichts — beides wird sofort abgewiesen statt still übernommen.
  if (urteil === 'fehlgeschlagen' && beanstandungen.length === 0)
    return { fehler: tl.urteilOhneBeanstandung }
  if (urteil === 'bestanden' && beanstandungen.length > 0)
    return { fehler: tl.bestandenMitBeanstandung }
  const rotVorGruen = freierText(roh?.rotVorGruen, BELEG_MAX, tl.felder.rotVorGruen, false)
  if (rotVorGruen.fehler) return rotVorGruen
  const geprueft = zeilenListe(roh?.geprueft, tl.felder.geprueft)
  if (geprueft.fehler) return geprueft
  // Prüfkarte: dieselben harten Längengrenzen wie für jede andere Karte —
  // FlowForge legt sie nach bestandener Prüfung selbst an (BAUPLAN 18).
  let pruefkarte = null
  const kartenTitel = einzeilig(roh?.pruefkarteTitel)
  const kartenText = einzeilig(roh?.pruefkarteText)
  if (kartenTitel || kartenText) {
    if (!kartenTitel || !kartenText) return { fehler: tl.pruefkarteUnvollstaendig }
    if (kartenTitel.length > TITEL_MAX)
      return { fehler: tl.feldZuLang(tl.felder.pruefkarteTitel, TITEL_MAX, kartenTitel.length) }
    if (kartenText.length > TEXT_MAX)
      return { fehler: tl.feldZuLang(tl.felder.pruefkarteText, TEXT_MAX, kartenText.length) }
    pruefkarte = { titel: kartenTitel, text: kartenText }
  }
  return {
    teil: {
      urteil,
      beanstandungen,
      rotVorGruen: rotVorGruen.text,
      geprueft: geprueft.zeilen,
      pruefkarte
    }
  }
}

function umsetzungsberichtPruefen(roh) {
  const tl = texte.lieferschein
  const kriterien = []
  for (const eintrag of Array.isArray(roh?.kriterien) ? roh.kriterien : []) {
    const kriterium = einzeilig(eintrag?.kriterium)
    const wieUmgesetzt = einzeilig(eintrag?.wieUmgesetzt)
    if (!kriterium && !wieUmgesetzt) continue
    if (!kriterium || !wieUmgesetzt) return { fehler: tl.kriteriumUnvollstaendig }
    if (kriterium.length > ZEILE_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.kriterien, ZEILE_MAX, kriterium.length) }
    if (wieUmgesetzt.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.kriterien, BEANSTANDUNG_MAX, wieUmgesetzt.length) }
    kriterien.push({ kriterium, wieUmgesetzt })
  }
  if (kriterien.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.kriterien, LISTE_MAX, kriterien.length) }
  const dateien = []
  for (const eintrag of Array.isArray(roh?.dateien) ? roh.dateien : []) {
    const pfad = einzeilig(eintrag?.pfad)
    if (!pfad) continue
    if (pfad.length > FUNDORT_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.dateien, FUNDORT_MAX, pfad.length) }
    const art = String(eintrag?.art ?? '').trim().toLowerCase()
    if (!DATEI_ARTEN.includes(art)) return { fehler: tl.dateiArtFehlt(DATEI_ARTEN) }
    dateien.push({ pfad, art })
  }
  if (dateien.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.dateien, LISTE_MAX, dateien.length) }
  const angriffsliste = []
  for (const eintrag of Array.isArray(roh?.angriffsliste) ? roh.angriffsliste : []) {
    const fund = einzeilig(eintrag?.fund)
    const umgang = einzeilig(eintrag?.umgang)
    if (!fund && !umgang) continue
    if (!fund || !umgang) return { fehler: tl.fundUnvollstaendig }
    if (fund.length > ZEILE_MAX || umgang.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.angriffsliste, BEANSTANDUNG_MAX, Math.max(fund.length, umgang.length)) }
    angriffsliste.push({ fund, umgang })
  }
  if (angriffsliste.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.angriffsliste, LISTE_MAX, angriffsliste.length) }
  return { teil: { kriterien, dateien, angriffsliste } }
}

function fundePruefen(roh) {
  const tl = texte.lieferschein
  const funde = []
  for (const eintrag of Array.isArray(roh?.funde) ? roh.funde : []) {
    const text = einzeilig(eintrag?.text)
    if (!text) continue
    if (text.length > BEANSTANDUNG_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.funde, BEANSTANDUNG_MAX, text.length) }
    const schwere = String(eintrag?.schwere ?? '').trim().toLowerCase()
    if (!SCHWEREN.includes(schwere)) return { fehler: tl.schwereFehlt(SCHWEREN) }
    const fundort = einzeilig(eintrag?.fundort)
    if (fundort.length > FUNDORT_MAX)
      return { fehler: tl.eintragZuLang(tl.felder.fundort, FUNDORT_MAX, fundort.length) }
    funde.push({ schwere, text, fundort })
  }
  if (funde.length > LISTE_MAX)
    return { fehler: tl.zuVieleEintraege(tl.felder.funde, LISTE_MAX, funde.length) }
  // Eine leere Fundliste ist ein gutes Ergebnis, kein Fehler — der Auftrag
  // verlangt ausdrücklich Ehrlichkeit statt erfundener Funde.
  return { teil: { funde } }
}

function rahmenTeilPruefen(roh) {
  const tl = texte.lieferschein
  const inhalt = freierText(roh?.inhalt, INHALT_MAX, tl.felder.inhalt, false)
  if (inhalt.fehler) return inhalt
  return { teil: { inhalt: inhalt.text } }
}

const TEIL_PRUEFER = {
  rahmen: rahmenTeilPruefen,
  arbeitspaket: arbeitspaketPruefen,
  pruefbeleg: pruefbelegPruefen,
  umsetzungsbericht: umsetzungsberichtPruefen,
  funde: fundePruefen
}

// Die eine Stelle, an der eine Meldung geprüft wird — für Werkzeug und
// Prüfskripte gleichermaßen. `umfeld` (BAUPLAN 44) reicht durch, was nur der
// Lauf weiß: `ziele` sind die benannten Ziele des rufenden Blocks, gegen die
// eine Zieladresse validiert wird. Liefert { fehler } oder { meldung }.
export function meldungPruefen(art, roh, etikett = null, umfeld = null) {
  const pruefer = TEIL_PRUEFER[art]
  if (!pruefer) return { fehler: texte.lieferschein.unbekannteArt(String(art)) }
  const rahmen = rahmenPruefen(roh)
  if (rahmen.fehler) return rahmen
  const teil = pruefer(roh, umfeld)
  if (teil.fehler) return teil
  return { meldung: { art, etikett: etikett ?? null, ...rahmen.rahmen, ...teil.teil } }
}

// --- Ebene 3: Kanten-Prüfung -------------------------------------------------

// Deckt die Lieferung dieses Blocks, was er laut Schaubild liefert? Ein Block
// mit zwei Etiketten, der nur eines meldet, fällt hier auf.
export function fehlendeLieferungen(def, meldungen) {
  const gemeldet = new Set((meldungen ?? []).map((m) => m?.etikett).filter(Boolean))
  return (def?.liefert ?? []).filter((etikett) => !gemeldet.has(etikett))
}

// Hat dieser Block vollständig gemeldet? Blöcke ohne liefert-Etikett brauchen
// mindestens den Rahmen — sonst wüsste weder Ticker noch Bericht, was war.
export function meldungVollstaendig(def, meldungen) {
  if (!Array.isArray(meldungen) || meldungen.length === 0) return false
  return fehlendeLieferungen(def, meldungen).length === 0
}

// --- Lesbare Fassung ---------------------------------------------------------

function abschnitt(label, zeilen) {
  if (!zeilen?.length) return ''
  return `${label}:\n` + zeilen.map((z) => '- ' + z).join('\n') + '\n'
}

// Eine Beanstandung in einer Zeile — dieselbe Fassung im Auftrag des Bauers,
// im Ticker-Umfeld und im Laufbericht.
export function beanstandungZeile(b) {
  const tl = texte.lieferschein
  const kopf = tl.einstufungen[b?.einstufung] ?? b?.einstufung ?? ''
  const ort = b?.fundort ? ` (${b.fundort})` : ''
  return `[${kopf}]${ort} ${b?.text ?? ''}`.trim()
}

export function fundZeile(f) {
  const tl = texte.lieferschein
  const kopf = tl.schweren[f?.schwere] ?? f?.schwere ?? ''
  const ort = f?.fundort ? ` (${f.fundort})` : ''
  return `[${kopf}]${ort} ${f?.text ?? ''}`.trim()
}

// Ein Zuschnitt als lesbarer Text (BAUPLAN 44). Zieladresse und Datenvertrag
// stehen mit drin — stünden sie nur geprüft im Objekt, käme der Vertrag beim
// Bauer nie an.
export function zuschnittText(paket) {
  const tl = texte.lieferschein
  let text = ''
  if (paket?.zielBezeichnung) text += `${tl.labels.zielBlock}: ${paket.zielBezeichnung}\n`
  text += `${tl.labels.ziel}: ${paket?.ziel ?? ''}\n`
  text += abschnitt(tl.labels.fertigKriterien, paket?.fertigKriterien)
  text += abschnitt(tl.labels.schritte, paket?.schritte)
  text += abschnitt(tl.labels.fundstellen, paket?.fundstellen)
  text += abschnitt(tl.labels.bausteine, paket?.bausteine)
  text += abschnitt(tl.labels.schnittstellen, paket?.schnittstellen)
  text += abschnitt(tl.labels.erlaubteDateien, paket?.erlaubteDateien)
  text += abschnitt(tl.labels.nichtDabei, paket?.nichtDabei)
  return text
}

// Der Lieferschein als lesbarer Text: geht als Übergabe an die Nachfolger und
// steht so im Laufbericht. Gegliedert — nicht mehr als Fließtext, aus dem
// FlowForge sich etwas heraussucht.
//
// `zielSchluessel` (BAUPLAN 44) wählt bei einem Arbeitspaket den Zuschnitt für
// GENAU EINEN Empfänger; ohne Angabe stehen alle Zuschnitte drin (Laufbericht,
// Blockkarte, Wiederhol-Vorlage).
export function lieferscheinText(meldung, zielSchluessel = undefined) {
  const tl = texte.lieferschein
  if (!meldung) return ''
  let text = `${tl.labels.fazit}: ${meldung.fazit}\n`
  if (meldung.art === 'arbeitspaket') {
    const alle = zuschnitteAusMeldung(meldung)
    const gewaehlt =
      zielSchluessel === undefined
        ? alle
        : alle.filter((p) => zuschnittSchluessel(p) === zielSchluessel)
    for (const paket of gewaehlt.length ? gewaehlt : alle) text += zuschnittText(paket)
  } else if (meldung.art === 'pruefbeleg') {
    text += `${tl.labels.urteil}: ${tl.urteile[meldung.urteil] ?? meldung.urteil}\n`
    text += abschnitt(tl.labels.geprueft, meldung.geprueft)
    text += abschnitt(tl.labels.beanstandungen, meldung.beanstandungen.map(beanstandungZeile))
    if (meldung.rotVorGruen) text += `${tl.labels.rotVorGruen}:\n${meldung.rotVorGruen}\n`
  } else if (meldung.art === 'umsetzungsbericht') {
    text += abschnitt(
      tl.labels.kriterien,
      meldung.kriterien.map((k) => `${k.kriterium} → ${k.wieUmgesetzt}`)
    )
    text += abschnitt(
      tl.labels.dateien,
      meldung.dateien.map((d) => `${d.pfad} (${tl.dateiArten[d.art] ?? d.art})`)
    )
    text += abschnitt(
      tl.labels.angriffsliste,
      meldung.angriffsliste.map((a) => `${a.fund} → ${a.umgang}`)
    )
  } else if (meldung.art === 'funde') {
    text += meldung.funde.length
      ? abschnitt(tl.labels.funde, meldung.funde.map(fundZeile))
      : tl.keineFunde + '\n'
  } else if (meldung.inhalt) {
    text += meldung.inhalt + '\n'
  }
  text += abschnitt(tl.labels.getan, meldung.getan)
  text += abschnitt(tl.labels.offen, meldung.offen)
  if (meldung.anmerkung) text += `${tl.labels.anmerkung}:\n${meldung.anmerkung}\n`
  return text.trim()
}

// --- Was FlowForge aus einer Meldung liest -----------------------------------

// Prüfer-Urteil (früher die Marker-Zeile „PRUEFUNG: BESTANDEN"):
// true = bestanden, false = nicht bestanden, null = kein Prüfbeleg gemeldet.
export function urteilAusMeldungen(meldungen) {
  const beleg = pruefbelegAusMeldungen(meldungen)
  if (!beleg) return null
  return beleg.urteil === 'bestanden'
}

export function pruefbelegAusMeldungen(meldungen) {
  const treffer = (meldungen ?? []).filter((m) => m?.art === 'pruefbeleg')
  return treffer.length ? treffer[treffer.length - 1] : null
}

export function beanstandungenAusMeldungen(meldungen) {
  return pruefbelegAusMeldungen(meldungen)?.beanstandungen ?? []
}

// Opus sortiert vor (BAUPLAN 20): Nur wenn ALLE Beanstandungen mechanisch sind,
// lohnt die lokale Wette — sonst muss der Motor-Bauer ohnehin ran. Ohne
// Beanstandungen wird sicher eskaliert.
export function beanstandungenEinstufen(beanstandungen) {
  const liste = Array.isArray(beanstandungen) ? beanstandungen : []
  if (liste.length === 0) return 'unmarkiert'
  return liste.every((b) => b?.einstufung === 'mechanisch') ? 'mechanisch' : 'grundsaetzlich'
}

// Grün-Fall des Tors (BAUPLAN 35): Der Prüfbefehl lief durch — mechanische, von
// Tests gedeckte Beanstandungen gelten damit als erledigt. Übrig bleiben die
// grundsätzlichen; ist keine dabei, prüft der Prüfer nur noch formal nach.
export function grundsaetzlicheBeanstandungen(beanstandungen) {
  return (Array.isArray(beanstandungen) ? beanstandungen : []).filter(
    (b) => b?.einstufung === 'grundsaetzlich'
  )
}

// Prüfkarte (BAUPLAN 18): aus dem Feld statt aus zwei Marker-Zeilen.
export function pruefkarteAusMeldungen(meldungen) {
  return pruefbelegAusMeldungen(meldungen)?.pruefkarte ?? null
}
