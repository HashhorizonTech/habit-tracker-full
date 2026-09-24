// Generates the app icon, Android adaptive icon layers, notification icon, splash mark and
// favicon from the Tend four-circle logo mark (SVG → PNG via sharp).
// Run: npm run gen:icons
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');

const BG = '#0a0d21'; // Aurora dark bg
const A1 = '#9f88ff';
const A2 = '#3bb9ed';

// Prototype mark: a 30×30 box with four 14px circles (top a1, right a2, bottom a1 75%, left a2 75%).
const CIRCLES = [
  { cx: 15, cy: 7, fill: A1, opacity: 1 },
  { cx: 23, cy: 15, fill: A2, opacity: 1 },
  { cx: 15, cy: 23, fill: A1, opacity: 0.75 },
  { cx: 7, cy: 15, fill: A2, opacity: 0.75 },
];

/** The mark as SVG elements, `width` px wide, centred in a `size` canvas. `mono` = solid colour. */
function mark(size, width, mono) {
  const s = width / 30;
  const o = (size - width) / 2;
  return CIRCLES.map(
    (c) =>
      `<circle cx="${o + c.cx * s}" cy="${o + c.cy * s}" r="${7 * s}" fill="${mono ?? c.fill}" fill-opacity="${mono ? 1 : c.opacity}"/>`,
  ).join('');
}

function svg(size, body, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${
    bg ?? ''
  }${body}</svg>`;
}

/** Solid bg plus a soft a1 glow behind the mark. */
function darkBg(size) {
  return `<defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${A1}" stop-opacity=".22"/><stop offset="1" stop-color="${A1}" stop-opacity="0"/></radialGradient></defs><rect width="${size}" height="${size}" fill="${BG}"/><circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.42}" fill="url(#g)"/>`;
}

const FILES = [
  // App icon (iOS / fallback): mark at ~54% with generous padding on the dark background.
  { name: 'icon.png', size: 1024, body: (n) => mark(n, n * 0.54), bg: darkBg },
  // Adaptive icon: the launcher masks to the centre ~66%, so the mark stays well inside it.
  { name: 'android-icon-foreground.png', size: 1024, body: (n) => mark(n, n * 0.46) },
  { name: 'android-icon-background.png', size: 1024, body: () => '', bg: (n) => `<rect width="${n}" height="${n}" fill="${BG}"/>` },
  { name: 'android-icon-monochrome.png', size: 1024, body: (n) => mark(n, n * 0.46, '#ffffff') },
  // Status-bar small icon: white silhouette on transparent (Android tints it).
  { name: 'notification-icon.png', size: 96, body: (n) => mark(n, n * 0.84, '#ffffff') },
  // Splash mark on transparent; app.json scales it to 120 dp on the dark splash background.
  { name: 'splash-icon.png', size: 1024, body: (n) => mark(n, n * 0.94) },
  { name: 'favicon.png', size: 48, body: (n) => mark(n, n * 0.92) },
];

mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  const src = svg(f.size, f.body(f.size), f.bg?.(f.size));
  const file = join(OUT, f.name);
  await sharp(Buffer.from(src)).png({ compressionLevel: 9 }).toFile(file);
  console.log(`${f.name.padEnd(30)} ${f.size}×${f.size}`);
}
