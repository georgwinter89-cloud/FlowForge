// App-Icon erzeugen (BAUPLAN 30): Der Blitz existiert sonst nur als Inline-SVG
// in der Kopfleiste (App.jsx). Dieses Skript rasterisiert ihn ohne fremde
// Bibliotheken zu build/icon.png (256×256) — ein eigener PNG-Encoder auf Basis
// von zlib, Polygon-Füllung per Scanline mit Supersampling als Antialiasing.
//
// Aufruf: node tools/iconErzeugen.mjs
// Farben = Tokens der dunklen Werkbank (stil.css): Navy #0a0e18, Elektroblau
// #2563eb / #3b82f6. Der Blitz-Pfad ist derselbe wie in App.jsx:
// M13 2 L5 13 H11 L9.5 22 L19 9.5 H12.5 Z (viewBox 0 0 24 24).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const GROESSE = 256
const SUPER = 4 // Supersampling-Faktor je Achse (16 Proben je Pixel)

// Blitz-Polygon aus App.jsx (Koordinaten im 24er-Raster).
const BLITZ = [
  [13, 2],
  [5, 13],
  [11, 13],
  [9.5, 22],
  [19, 9.5],
  [12.5, 9.5]
]

const NAVY = [0x0a, 0x0e, 0x18]
const BLAU = [0x25, 0x63, 0xeb]
const BLAU_HELL = [0x3b, 0x82, 0xf6]
const WEISS = [0xff, 0xff, 0xff]

// ---------- Geometrie ----------

// Punkt-in-Polygon (Even-Odd) für die Scanline-Füllung.
function imPolygon(punkte, x, y) {
  let drin = false
  for (let i = 0, j = punkte.length - 1; i < punkte.length; j = i++) {
    const [xi, yi] = punkte[i]
    const [xj, yj] = punkte[j]
    const schneidet = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (schneidet) drin = !drin
  }
  return drin
}

// Abstand eines Punkts zur nächsten Polygonkante (fürs Glühen).
function abstandZumRand(punkte, x, y) {
  let min = Infinity
  for (let i = 0, j = punkte.length - 1; i < punkte.length; j = i++) {
    const [x1, y1] = punkte[j]
    const [x2, y2] = punkte[i]
    const dx = x2 - x1
    const dy = y2 - y1
    const laenge2 = dx * dx + dy * dy
    let t = laenge2 === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / laenge2
    t = Math.max(0, Math.min(1, t))
    const px = x1 + t * dx
    const py = y1 + t * dy
    min = Math.min(min, Math.hypot(x - px, y - py))
  }
  return min
}

// Abgerundetes Quadrat (Kachel): innen 1, außen 0.
function inKachel(x, y, groesse, radius) {
  const rx = Math.max(radius - x, 0, x - (groesse - radius))
  const ry = Math.max(radius - y, 0, y - (groesse - radius))
  return rx * rx + ry * ry <= radius * radius
}

// ---------- Rasterisierung ----------

// Der Blitz wird ins 256er-Bild skaliert: 24 Einheiten → 256 px, mit etwas
// Rand, damit die Spitzen nicht am Kachelrand kleben.
const RAND = 30
const SKALA = (GROESSE - 2 * RAND) / 24
const blitzPx = BLITZ.map(([x, y]) => [RAND + x * SKALA, RAND + y * SKALA])

// Farbe eines Bildpunkts (Subpixel-Koordinaten in Pixeln): liefert [r,g,b,a].
function probe(x, y) {
  // Außerhalb der abgerundeten Kachel: transparent.
  if (!inKachel(x, y, GROESSE, 56)) return [0, 0, 0, 0]
  // Grund: Navy mit leichtem Verlauf (oben minimal heller) für etwas Tiefe.
  const t = y / GROESSE
  let r = NAVY[0] + (0x10 - NAVY[0]) * (1 - t) * 0.5
  let g = NAVY[1] + (0x18 - NAVY[1]) * (1 - t) * 0.5
  let b = NAVY[2] + (0x2e - NAVY[2]) * (1 - t) * 0.5
  const d = abstandZumRand(blitzPx, x, y)
  if (imPolygon(blitzPx, x, y)) {
    // Blitz: Elektroblau, zur Oberkante hin heller — dazu ein weißer Kern
    // entlang der Mitte, damit er auf dunklem Grund „leuchtet".
    const v = Math.max(0, Math.min(1, (y - RAND) / (GROESSE - 2 * RAND)))
    // innen: 0 an der Kante, 1 tief im Blitz — dort wird es weiß.
    const innen = Math.min(1, d / 22)
    r = BLAU_HELL[0] * (1 - v) + BLAU[0] * v
    g = BLAU_HELL[1] * (1 - v) + BLAU[1] * v
    b = BLAU_HELL[2] * (1 - v) + BLAU[2] * v
    r = r + (WEISS[0] - r) * innen * 0.85
    g = g + (WEISS[1] - g) * innen * 0.85
    b = b + (WEISS[2] - b) * innen * 0.85
    return [r, g, b, 255]
  }
  // Glühen um den Blitz (wie box-shadow des .kopf-logo): weich abfallend.
  const gluehen = Math.max(0, 1 - d / 34)
  const staerke = gluehen * gluehen * 0.55
  r = r + (BLAU[0] - r) * staerke
  g = g + (BLAU[1] - g) * staerke
  b = b + (BLAU[2] - b) * staerke
  return [r, g, b, 255]
}

function rasterisieren() {
  const pixel = Buffer.alloc(GROESSE * GROESSE * 4)
  const schritt = 1 / SUPER
  for (let py = 0; py < GROESSE; py++) {
    for (let px = 0; px < GROESSE; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SUPER; sy++) {
        for (let sx = 0; sx < SUPER; sx++) {
          const [pr, pg, pb, pa] = probe(px + (sx + 0.5) * schritt, py + (sy + 0.5) * schritt)
          // Vormultipliziert mitteln, damit die Kachelkante sauber ausblendet.
          r += pr * pa
          g += pg * pa
          b += pb * pa
          a += pa
        }
      }
      const i = (py * GROESSE + px) * 4
      if (a > 0) {
        pixel[i] = Math.round(r / a)
        pixel[i + 1] = Math.round(g / a)
        pixel[i + 2] = Math.round(b / a)
        pixel[i + 3] = Math.round(a / (SUPER * SUPER))
      }
    }
  }
  return pixel
}

// ---------- PNG-Encoder ----------

const CRC_TABELLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABELLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(typ, daten) {
  const laenge = Buffer.alloc(4)
  laenge.writeUInt32BE(daten.length)
  const typUndDaten = Buffer.concat([Buffer.from(typ, 'ascii'), daten])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typUndDaten))
  return Buffer.concat([laenge, typUndDaten, crc])
}

function pngKodieren(pixel, breite, hoehe) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(breite, 0)
  ihdr.writeUInt32BE(hoehe, 4)
  ihdr[8] = 8 // Bittiefe
  ihdr[9] = 6 // Farbtyp RGBA
  ihdr[10] = 0 // Kompression
  ihdr[11] = 0 // Filter
  ihdr[12] = 0 // kein Interlace
  // Je Zeile ein Filter-Byte (0 = None) vor den Pixeldaten.
  const roh = Buffer.alloc((breite * 4 + 1) * hoehe)
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 4 + 1)] = 0
    pixel.copy(roh, y * (breite * 4 + 1) + 1, y * breite * 4, (y + 1) * breite * 4)
  }
  const idat = zlib.deflateSync(roh, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- Ausgabe ----------

const hier = path.dirname(fileURLToPath(import.meta.url))
const ziel = path.join(hier, '..', 'build', 'icon.png')
fs.mkdirSync(path.dirname(ziel), { recursive: true })
fs.writeFileSync(ziel, pngKodieren(rasterisieren(), GROESSE, GROESSE))
console.log('Icon geschrieben:', ziel)
