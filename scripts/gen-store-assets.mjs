/**
 * Generate the Google Play store graphics from Ember's flame:
 *   assets/store/icon-512.png        (512x512 app icon for the listing)
 *   assets/store/feature-graphic.png (1024x500 feature graphic — required)
 *
 * Run:  node scripts/gen-store-assets.mjs   (needs devDep @resvg/resvg-js)
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'store');
mkdirSync(OUT, { recursive: true });

const FLAME_2 = '#F5A623';
const FLAME_3 = '#E0592B';
const FLAME_1 = '#FFD36B';
const FLAME_INNER = '#FFEBB0';
const EYE = '#2A1A0A';
const BG_DEEP = '#0B1220';

const FLAME = `
  <path d="M100 18 C76 62 50 82 50 128 C50 174 74 212 100 212 C126 212 150 174 150 128 C150 92 128 74 118 48 C112 34 108 24 100 18 Z" fill="url(#body)"/>
  <path d="M100 78 C88 102 78 114 78 138 C78 166 88 188 100 188 C112 188 122 166 122 138 C122 118 112 106 108 92 C105 84 103 82 100 78 Z" fill="${FLAME_1}"/>
  <path d="M100 116 C94 128 90 136 90 150 C90 166 95 178 100 178 C105 178 110 166 110 150 C110 140 106 132 104 124 C102 120 101 118 100 116 Z" fill="${FLAME_INNER}"/>
  <circle cx="86" cy="132" r="5.5" fill="${EYE}"/>
  <circle cx="114" cy="132" r="5.5" fill="${EYE}"/>
  <path d="M90 148 Q100 156 110 148" stroke="${EYE}" stroke-width="3" stroke-linecap="round" fill="none"/>`;

const defs = `<defs>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FLAME_2}"/><stop offset="1" stop-color="${FLAME_3}"/></linearGradient>
  <radialGradient id="bg" cx="0.5" cy="0.5" r="0.75"><stop offset="0" stop-color="#20305A"/><stop offset="0.6" stop-color="#141E3A"/><stop offset="1" stop-color="${BG_DEEP}"/></radialGradient>
</defs>`;

function render(svg, width, outName) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(join(OUT, outName), png);
  console.log(`  ✓ ${outName}`);
}

// 512 icon — flame on the warm radial ground.
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${defs}
    <rect width="512" height="512" fill="url(#bg)"/>
    <g transform="translate(158 106) scale(0.98)">${FLAME}</g>
  </svg>`,
  512,
  'icon-512.png',
);

// 1024x500 feature graphic — flame at left, wordmark + tagline at right.
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">${defs}
    <rect width="1024" height="500" fill="url(#bg)"/>
    <ellipse cx="250" cy="250" rx="180" ry="200" fill="${FLAME_2}" opacity="0.14"/>
    <g transform="translate(160 130) scale(1.0)">${FLAME}</g>
    <text x="470" y="250" font-family="Georgia, serif" font-size="96" font-weight="700" fill="#EAF0FF">Versed</text>
    <text x="472" y="300" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="30" fill="#9AA7C7">Hide God’s Word in your heart —</text>
    <text x="472" y="340" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="30" fill="#9AA7C7">together.</text>
  </svg>`,
  1024,
  'feature-graphic.png',
);

console.log('Done. Store graphics in assets/store/.');
