#!/usr/bin/env node
/**
 * Draws the app icon and splash mark, and writes the SVG the iOS 26 layered
 * icon uses.
 *
 * All three come from one geometry definition, so the flat icon and the Liquid
 * Glass one cannot drift apart — which is the failure mode that would be hardest
 * to notice, since they never appear on screen at the same time.
 *
 * ## Why this draws pixels by hand
 *
 * There is no SVG rasteriser on this machine (no ImageMagick, no librsvg, no
 * cairo), and `qlmanage` renders thumbnails at a size and quality it chooses
 * rather than the one asked for. Depending on a transitive package would work
 * today and break on the next clean install.
 *
 * So the shape is evaluated as a distance field — every pixel asks how far it is
 * from the stroked path — and composited directly. That gives exact dimensions
 * and analytic antialiasing with no resampling, and the only imports are Node's
 * own. The PNG is encoded here too, for the same reason: `zlib` is built in and
 * a PNG is four chunks and a CRC.
 *
 * The splash screen's background is set by hand in `app.json` to the gradient's
 * midpoint, so the icon that appears on the home screen grows out of the splash
 * rather than replacing it.
 *
 * Run: npm run icon
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------

/**
 * An "A" for Antunello.
 *
 * The app is a personal one, and its name is the only thing about it that is
 * nobody else's — so the icon is the name, drawn as one bold letterform rather
 * than a generic fintech glyph. A first attempt at a rising chart line rendered,
 * technically correctly, as a golf club: the spline overshot its control points
 * and the end marker read as a ball. A letterform has no such failure mode, and
 * it survives being shrunk to 40px on a home screen, which is where an icon
 * actually lives.
 *
 * Drawn from primitives rather than as a filled outline: the arms are one
 * round-capped polyline through the apex, which is what gives the apex its soft
 * point and the feet their rounded ends, and the crossbar is a parallelogram
 * that meets each arm exactly along its axis.
 */
const APEX = [512, 246];
const LEFT_FOOT = [256, 762];
const RIGHT_FOOT = [768, 762];

/** Where the crossbar sits, measured down from the apex. */
const CROSSBAR_Y = 604;

/**
 * The x of an arm's axis at a given height.
 *
 * Interpolated between the foot and the apex. The first version of this had the
 * numerator inverted — `(APEX[1] - y)` rather than `(y - foot[1])` — which
 * mirrored it about the letter's centre: it returned 256 at the apex where the
 * answer is 512, and 512 at the foot where it is 256. The crossbar therefore
 * landed 100px off and no amount of adjusting its depth could fix it, which is
 * what three rounds of tuning the wrong variable looked like.
 *
 * @param foot The arm's foot, whose x the axis takes when `y` is the foot's.
 * @param y The height to evaluate at.
 * @returns The axis x, rounded to whole units.
 */
const armXAt = (foot, y) =>
  Math.round(foot[0] + ((APEX[0] - foot[0]) * (y - foot[1])) / (APEX[1] - foot[1]));

/** Stroke thickness. Heavy enough to hold at 40px, light enough to stay a letter. */
const STROKE = 100;

/**
 * The crossbar, as a parallelogram rather than a rectangle.
 *
 * A rectangle was wrong three times over. Its round ends punched out through the
 * slanted arms; shortened so they did not, its square ends stopped short and it
 * read as a box floating in the counter. The cause is the same both times: a
 * horizontal bar meeting a band leaning 26° off vertical has no depth at which
 * its corners are inside the band and its ends still reach it.
 *
 * So the bar's ends follow the arms. Each corner is placed **on an arm's axis**,
 * at the bar's top and bottom edges — which means the bar runs exactly to each
 * arm at every height, merging along the arm's length with no corner to escape.
 */
const CROSSBAR_HALF = STROKE / 2;
const CROSSBAR = [
  [armXAt(LEFT_FOOT, CROSSBAR_Y - CROSSBAR_HALF), CROSSBAR_Y - CROSSBAR_HALF],
  [armXAt(RIGHT_FOOT, CROSSBAR_Y - CROSSBAR_HALF), CROSSBAR_Y - CROSSBAR_HALF],
  [armXAt(RIGHT_FOOT, CROSSBAR_Y + CROSSBAR_HALF), CROSSBAR_Y + CROSSBAR_HALF],
  [armXAt(LEFT_FOOT, CROSSBAR_Y + CROSSBAR_HALF), CROSSBAR_Y + CROSSBAR_HALF],
];

/**
 * The arms, as one polyline through the apex.
 *
 * Round-capped, which is what gives the apex its soft point and the feet their
 * rounded ends. `strokeCoverage` still supports square caps because a stroke
 * that ends flush is a shape this may well need again; nothing uses it today.
 */
const STROKES = [{ points: [LEFT_FOOT, APEX, RIGHT_FOOT], roundCaps: true }];

/**
 * How much of a pixel one stroke covers.
 *
 * A round-capped segment is a capsule, so the nearest point on it is the nearest
 * point on the segment. A square-capped one is a rectangle, so a pixel beyond
 * either end is outside it entirely — which a clamped projection would get
 * wrong by treating it as a round cap.
 *
 * @returns Coverage from 0 to 1, before the one-pixel edge filter.
 */
function strokeCoverage(x, y, stroke) {
  const half = STROKE / 2;
  let best = -Infinity;

  for (let i = 0; i < stroke.points.length - 1; i += 1) {
    const [ax, ay] = stroke.points[i];
    const [bx, by] = stroke.points[i + 1];

    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    // Projection along the segment, unclamped: outside [0, 1] means past an end.
    const along = ((x - ax) * dx + (y - ay) * dy) / length;

    const distance = stroke.roundCaps
      ? Math.hypot(x - (ax + (Math.max(0, Math.min(1, along / length)) * dx)), y - (ay + (Math.max(0, Math.min(1, along / length)) * dy)))
      : Math.abs((x - ax) * (dy / length) - (y - ay) * (dx / length));

    if (!stroke.roundCaps && (along < 0 || along > length)) continue;
    if (half - distance > best) best = half - distance;
  }

  return best;
}

/**
 * How much of a pixel a convex polygon covers.
 *
 * For a convex shape the distance to the inside is the smallest signed distance
 * to any of its edges, so one pass over the edges answers it. Corners are
 * approximate — the true nearest feature there is a vertex, not an edge — which
 * is invisible at these sizes and not worth a second branch.
 *
 * @returns Coverage from 0 to 1, before the one-pixel edge filter.
 */
function polygonCoverage(x, y, points) {
  let inside = Infinity;

  for (let i = 0; i < points.length; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];

    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    // Signed distance to this edge, negative on the outside. The winding is
    // clockwise in screen coordinates, where y grows downward.
    const signed = ((y - ay) * dx - (x - ax) * dy) / length;
    if (signed < inside) inside = signed;
  }

  return inside;
}

/**
 * How much of a pixel the mark covers.
 *
 * The distance field is filtered over one pixel, which is what antialiases the
 * edge — no supersampling, so the result is exact rather than resampled.
 *
 * Coverage is unioned with `max` across the pieces rather than summed, so where
 * the crossbar overlaps an arm the join does not come out darker.
 *
 * @returns Coverage from 0 to 1.
 */
function markCoverage(x, y) {
  let best = polygonCoverage(x, y, CROSSBAR);

  for (const stroke of STROKES) {
    const coverage = strokeCoverage(x, y, stroke);
    if (coverage > best) best = coverage;
  }

  return Math.max(0, Math.min(1, best + 0.5));
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** Top-left of the background gradient. */
const BLUE_LIGHT = [0x3d, 0x9c, 0xff];
/** Bottom-right. */
const BLUE_DARK = [0x0a, 0x54, 0xc8];

/**
 * The background gradient.
 *
 * Top-left to bottom-right rather than vertical, so the icon does not read as a
 * band across the home screen.
 */
function backgroundAt(x, y, size) {
  const t = Math.max(0, Math.min(1, (x / size + y / size) / 2));
  return [
    Math.round(BLUE_LIGHT[0] + (BLUE_DARK[0] - BLUE_LIGHT[0]) * t),
    Math.round(BLUE_LIGHT[1] + (BLUE_DARK[1] - BLUE_LIGHT[1]) * t),
    Math.round(BLUE_LIGHT[2] + (BLUE_DARK[2] - BLUE_LIGHT[2]) * t),
  ];
}

/**
 * Renders the icon.
 *
 * @param size Output edge length in pixels.
 * @param transparent True for the splash mark, which sits on its own background.
 * @returns Raw RGBA bytes.
 */
function render(size, transparent) {
  const pixels = Buffer.alloc(size * size * 4);
  // The geometry is authored in a 1024-unit square, so every icon size is the
  // same drawing measured differently.
  const scale = size / 1024;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coverage = markCoverage((x + 0.5) / scale, (y + 0.5) / scale);
      const offset = (y * size + x) * 4;

      // The mark is white with a slight cool cast, so it sits in the blue rather
      // than looking pasted onto it.
      const mark = [0xf4, 0xf9, 0xff];

      if (transparent) {
        pixels[offset] = mark[0];
        pixels[offset + 1] = mark[1];
        pixels[offset + 2] = mark[2];
        pixels[offset + 3] = Math.round(coverage * 255);
        continue;
      }

      const background = backgroundAt(x, y, size);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset + channel] = Math.round(
          background[channel] + (mark[channel] - background[channel]) * coverage,
        );
      }
      // Opaque throughout: iOS masks the corners itself and rejects an icon
      // with an alpha channel.
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/** One PNG chunk: length, type, data, CRC over type and data. */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, crc]);
}

/**
 * Encodes raw pixels as a PNG.
 *
 * Colour type 2 (RGB) for the app icon and 6 (RGBA) for the splash mark, and
 * the difference matters: **iOS rejects an app icon that has an alpha channel**,
 * even one where every pixel is opaque. Writing RGBA and relying on the values
 * being 255 is the kind of thing that passes a visual check and fails App Store
 * validation — and, more to the point here, is not what the platform asked for.
 *
 * Filter 0 (none) on every scanline. Per-line filters chosen by a heuristic
 * would compress a gradient better, and are not worth the code for two files
 * written once.
 */
function encodePng(pixels, size, hasAlpha) {
  const channels = hasAlpha ? 4 : 3;
  const stride = size * channels;

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = hasAlpha ? 6 : 2; // colour type
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < size; x += 1) {
      const from = (y * size + x) * 4;
      const to = rowStart + 1 + x * channels;
      raw[to] = pixels[from];
      raw[to + 1] = pixels[from + 1];
      raw[to + 2] = pixels[from + 2];
      if (hasAlpha) raw[to + 3] = pixels[from + 3];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// The SVG layer for the iOS 26 icon
// ---------------------------------------------------------------------------

/**
 * The mark as SVG, for the layered icon format.
 *
 * Icon Composer composites this over the fill gradient below, so the shape is
 * drawn in white and the background is left to `icon.json`. It is generated from
 * the same constants as the raster version — the two never appear on screen
 * together, so a divergence between them would go unnoticed indefinitely.
 *
 * @returns SVG source.
 */
function markSvg() {
  const arms = STROKES.map(
    (stroke) =>
      `<path d="M ${stroke.points.map(([x, y]) => `${x} ${y}`).join(' L ')}"/>`,
  ).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g fill="none" stroke="#ffffff" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">
    ${arms}
  </g>
  <polygon fill="#ffffff" points="${CROSSBAR.map(([x, y]) => `${x},${y}`).join(' ')}"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Write everything
// ---------------------------------------------------------------------------

const outputs = [];

function write(relativePath, contents) {
  const absolute = join(ROOT, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  outputs.push(`${relativePath}  ${(contents.length / 1024).toFixed(1)} KB`);
}

write('assets/images/icon.png', encodePng(render(1024, false), 1024, false));
write('assets/images/splash-icon.png', encodePng(render(512, true), 512, true));
write('assets/expo.icon/Assets/antunello-mark.svg', Buffer.from(markSvg(), 'utf8'));

/**
 * The layered icon descriptor.
 *
 * Replaces the template's Expo symbol and blueprint grid with this mark over a
 * gradient of the app's own blue, so the icon picks up iOS 26's glass treatment
 * without a second drawing.
 */
write(
  'assets/expo.icon/icon.json',
  Buffer.from(
    `${JSON.stringify(
      {
        fill: { 'automatic-gradient': 'extended-srgb:0.05882,0.47843,0.90980,1.00000' },
        groups: [
          {
            layers: [{ 'image-name': 'antunello-mark.svg', name: 'antunello-mark' }],
            shadow: { kind: 'neutral', opacity: 0.5 },
            translucency: { enabled: true, value: 0.5 },
          },
        ],
        'supported-platforms': { circles: ['watchOS'], squares: 'shared' },
      },
      null,
      2,
    )}\n`,
    'utf8',
  ),
);

console.log(outputs.join('\n'));
