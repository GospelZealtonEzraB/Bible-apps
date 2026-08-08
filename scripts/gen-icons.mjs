/**
 * Generate Versed's app icons + splash from Ember's flame.
 *
 * Deterministic, self-contained: builds each SVG in code (reusing Ember's
 * flame paths + FLAME_* palette) and rasterizes with @resvg/resvg-js.
 *
 * Run:  node scripts/gen-icons.mjs
 * Outputs (overwrites): assets/icon.png, splash-icon.png,
 *   android-icon-foreground.png, android-icon-background.png,
 *   android-icon-monochrome.png, favicon.png
 *
 * @resvg/resvg-js is a dev-only tool; install with `npm i -D @resvg/resvg-js`
 * if it's missing. Nothing here ships in the app bundle.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// Ember's palette (mirrors src/components/Ember.tsx)
const FLAME_3 = '#E0592B';
const FLAME_2 = '#F5A623';
const FLAME_1 = '#FFD36B';
const FLAME_INNER = '#FFEBB0';
const EYE = '#2A1A0A';
const BG_DEEP = '#0B1220';

// The flame body + inner layers, in Ember's 200x240 viewBox.
const FLAME = `
  <path d="M100 18 C76 62 50 82 50 128 C50 174 74 212 100 212 C126 212 150 174 150 128 C150 92 128 74 118 48 C112 34 108 24 100 18 Z" fill="url(#body)"/>
  <path d="M100 78 C88 102 78 114 78 138 C78 166 88 188 100 188 C112 188 122 166 122 138 C122 118 112 106 108 92 C105 84 103 82 100 78 Z" fill="${FLAME_1}"/>
  <path d="M100 116 C94 128 90 136 90 150 C90 166 95 178 100 178 C105 178 110 166 110 150 C110 140 106 132 104 124 C102 120 101 118 100 116 Z" fill="${FLAME_INNER}"/>
`;

// A gentle content face so the icon reads as the mascot.
const FACE = `
  <circle cx="86" cy="132" r="5.5" fill="${EYE}"/>
  <circle cx="114" cy="132" r="5.5" fill="${EYE}"/>
  <path d="M90 148 Q100 156 110 148" stroke="${EYE}" stroke-width="3" stroke-linecap="round" fill="none"/>
`;

const bodyGradient = `
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${FLAME_2}"/>
    <stop offset="1" stop-color="${FLAME_3}"/>
  </linearGradient>
`;

/** Warm radial ground behind the flame, on a deep-navy field. */
function radialBg(id) {
  return `
    <radialGradient id="${id}" cx="0.5" cy="0.46" r="0.62">
      <stop offset="0" stop-color="#20305A"/>
      <stop offset="0.6" stop-color="#141E3A"/>
      <stop offset="1" stop-color="${BG_DEEP}"/>
    </radialGradient>
  `;
}

/**
 * Compose an SVG. `flame` placed centered in a `size` canvas, scaled by
 * `flameScale` of the canvas height, over an optional background.
 */
function iconSvg({ size = 1024, background = 'radial', face = true, flameScale = 0.58, glow = true } = {}) {
  const fw = 200;
  const fh = 240;
  const targetH = size * flameScale;
  const scale = targetH / fh;
  const tx = (size - fw * scale) / 2;
  const ty = (size - fh * scale) / 2;

  const bg =
    background === 'radial'
      ? `<rect width="${size}" height="${size}" fill="url(#bg)"/>`
      : background === 'none'
        ? ''
        : `<rect width="${size}" height="${size}" fill="${background}"/>`;

  const glowEl = glow
    ? `<ellipse cx="${size / 2}" cy="${size * 0.5}" rx="${size * 0.30}" ry="${size * 0.34}" fill="${FLAME_2}" opacity="0.16"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>${bodyGradient}${background === 'radial' ? radialBg('bg') : ''}</defs>
    ${bg}
    ${glowEl}
    <g transform="translate(${tx} ${ty}) scale(${scale})">
      ${FLAME}
      ${face ? FACE : ''}
    </g>
  </svg>`;
}

/** A single-color silhouette of the flame for the Android monochrome layer. */
function monochromeSvg({ size = 1024, color = '#ffffff', flameScale = 0.5 } = {}) {
  const fw = 200;
  const fh = 240;
  const targetH = size * flameScale;
  const scale = targetH / fh;
  const tx = (size - fw * scale) / 2;
  const ty = (size - fh * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <g transform="translate(${tx} ${ty}) scale(${scale})">
      <path d="M100 18 C76 62 50 82 50 128 C50 174 74 212 100 212 C126 212 150 174 150 128 C150 92 128 74 118 48 C112 34 108 24 100 18 Z" fill="${color}"/>
    </g>
  </svg>`;
}

function render(svg, width, outName) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  const png = r.render().asPng();
  writeFileSync(join(OUT, outName), png);
  console.log(`  ✓ ${outName} (${width}px, ${(png.length / 1024).toFixed(0)} kB)`);
}

console.log('Generating Versed icons from Ember’s flame…');
// Main app icon — flame + face on a warm radial ground.
render(iconSvg({ size: 1024 }), 1024, 'icon.png');
// Splash — flame on transparent so it blends into Expo's #0B1220 surround;
// a soft warm halo reads as a glow, not a box.
render(iconSvg({ size: 1024, background: 'none', flameScale: 0.42, glow: true }), 1024, 'splash-icon.png');
// Android adaptive foreground — flame in the safe zone (transparent bg).
render(iconSvg({ size: 1024, background: 'none', flameScale: 0.44, glow: false }), 1024, 'android-icon-foreground.png');
// Android adaptive background — the warm radial ground alone.
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${radialBg('bg')}</defs><rect width="1024" height="1024" fill="url(#bg)"/></svg>`,
  1024,
  'android-icon-background.png',
);
// Android monochrome — flame silhouette.
render(monochromeSvg({ size: 1024 }), 1024, 'android-icon-monochrome.png');
// Web favicon.
render(iconSvg({ size: 256 }), 256, 'favicon.png');
console.log('Done. All six assets regenerated.');
