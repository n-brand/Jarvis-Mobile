/**
 * Draws the PWA icons straight to PNG, with nothing but node:zlib. Run after
 * changing the design: `node scripts/make-icons.mjs`. The output is
 * committed, so a build never needs this.
 *
 * Art style taken from the portfolio (n-brand.github.io/portfolio): the same
 * composition as its app icon (tools/make-icons.ps1 there) — navy ground, a
 * soft glow disc, a rounded tile turned -6° with a darker edge underneath —
 * in the colours of the portfolio's JARVIS card: Iron-Man red tile, the flat
 * cyan reactor (dashed outer ring, solid inner ring, white core, glow) and the
 * sound-wave bars either side of it.
 *
 * Everything is laid out on a 100×100 grid, like the portfolio script.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = '#0d1a2d'
const GLOW = '#1b3558'
const TILE = '#a51d2d'
const TILE_SHADE = '#6e0f1b'
const CYAN = '#4dd4ff'
const CYAN_LIGHT = '#a5ecff'
const CORE = '#e9fbff'
const ANGLE = (-6 * Math.PI) / 180
const PIVOT = [50, 48]

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** Signed distance to a rounded rectangle (negative inside). */
function roundRect(px, py, x, y, w, h, r) {
  const qx = Math.abs(px - (x + w / 2)) - (w / 2 - r)
  const qy = Math.abs(py - (y + h / 2)) - (h / 2 - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** Coverage from a signed distance, with `aa` grid units of soft edge. */
const fill = (d, aa) => Math.min(1, Math.max(0, 0.5 - d / aa))

/**
 * The layers at one point of the 100-grid, bottom to top, as [colour, alpha].
 * `tile` is the tile's edge length — 60 normally, smaller for the maskable
 * icon so a circular Android mask can't clip it.
 */
function layers(x, y, tile, aa) {
  const out = [[BG, 1], [GLOW, fill(Math.hypot(x - 50, y - 48) - 36, aa)]]

  // Into the tile's own frame: undo the rotation about the pivot and the scale.
  const k = tile / 60
  const dx = x - PIVOT[0]
  const dy = y - PIVOT[1]
  const tx = (dx * Math.cos(-ANGLE) - dy * Math.sin(-ANGLE)) / k + PIVOT[0]
  const ty = (dx * Math.sin(-ANGLE) + dy * Math.cos(-ANGLE)) / k + PIVOT[1]
  const taa = aa / k

  out.push([TILE_SHADE, fill(roundRect(tx, ty, 20, 23, 60, 60, 15), taa)])
  const face = roundRect(tx, ty, 20, 18, 60, 60, 15)
  out.push([TILE, fill(face, taa)])
  const onFace = (a) => Math.min(a, fill(face, taa))

  // Reactor, centred on the tile face — the portfolio card's proportions
  // (r 40 / 26 / 12, strokes 4 / 3) scaled to fit the tile.
  const d = Math.hypot(tx - 50, ty - 48)
  out.push([CORE, onFace(Math.max(0, 1 - d / 20) ** 2 * 0.35)])
  // Dashed ring: 16-on/8-off along the circumference, as on the card.
  const turn = ((Math.atan2(ty - 48, tx - 50) / (2 * Math.PI)) % 1 + 1) % 1
  const dashes = Math.round((2 * Math.PI * 14) / 8.4)
  const dashOn = (turn * dashes) % 1 < 2 / 3
  if (dashOn) out.push([CYAN, onFace(fill(Math.abs(d - 14) - 1.5, taa))])
  out.push([CYAN_LIGHT, onFace(fill(Math.abs(d - 9) - 0.9, taa))])
  out.push([CORE, onFace(fill(d - 4.2, taa))])

  // Sound-wave bars, the taller one outside, the shorter toward the reactor.
  for (const [cx, h] of [[25, 12], [29.4, 7]]) {
    for (const bx of [cx, 100 - cx]) {
      out.push([CYAN, onFace(fill(roundRect(tx, ty, bx - 1.1, 48 - h / 2, 2.2, h, 1.1), taa))])
    }
  }
  return out
}

function pixel(x, y, tile, aa) {
  let c = [0, 0, 0]
  for (const [hex, a] of layers(x, y, tile, aa)) {
    if (a <= 0) continue
    const col = rgb(hex)
    c = c.map((v, i) => v + (col[i] - v) * a)
  }
  return c
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function png(size, tile) {
  const unit = 100 / size
  const aa = unit // one pixel of soft edge, expressed in grid units
  const stride = size * 3 + 1
  const rows = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    rows[y * stride] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0]
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        pixel((x + ox) * unit, (y + oy) * unit, tile, aa).forEach((v, i) => (sum[i] += v))
      }
      for (let i = 0; i < 3; i++) rows[y * stride + 1 + x * 3 + i] = Math.round(sum[i] / 4)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const [name, size, tile] of [
  ['apple-touch-icon.png', 180, 60],
  ['icon-192.png', 192, 60],
  ['icon-512.png', 512, 60],
  ['icon-maskable-512.png', 512, 46],
]) {
  writeFileSync(`public/icons/${name}`, png(size, tile))
  console.log(`  public/icons/${name}`)
}
