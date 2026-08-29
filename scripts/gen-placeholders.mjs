// Generates dark placeholder thumbnails so the mock data has something to show
// until Matty's real clips and stills land.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

const slots = [
  'GATES OF OLYMPUS', 'SUGAR RUSH 1000', 'LE BANDIT', 'WANTED DEAD OR A WILD',
  'SAN QUENTIN', 'FRUIT PARTY', 'BIG BASS', 'MENTAL',
];

function frame({ w, h, title, accent, tag }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0D1422"/>
      <stop offset="0.55" stop-color="#111A2B"/>
      <stop offset="1" stop-color="#070B14"/>
    </linearGradient>
    <radialGradient id="r" cx="0.72" cy="0.2" r="0.8">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#r)"/>
  <g opacity="0.10" stroke="${accent}" stroke-width="1">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${(h / 9) * i}" x2="${w}" y2="${(h / 9) * i}"/>`).join('')}
  </g>
  <g transform="translate(${w / 2} ${h / 2})" opacity="0.14">
    <path d="M-46 34V-34L0 12l46-46v68" fill="none" stroke="${accent}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="${w / 2}" y="${h - 26}" fill="#6B7891" font-family="monospace" font-size="${Math.round(w / 34)}" letter-spacing="3" text-anchor="middle">${tag}</text>
</svg>`;
}

// Stream still, 16:9
writeFileSync(join(OUT, 'stream-thumb.svg'), frame({ w: 1280, h: 720, title: 'Stream', accent: '#2B8FFF', tag: 'MATTYSPINS · KICK' }));

// Clips
for (let i = 1; i <= 8; i++) {
  const vertical = i === 3 || i === 7;
  writeFileSync(
    join(OUT, `clip-${i}.svg`),
    frame({
      w: vertical ? 720 : 1280,
      h: vertical ? 1280 : 720,
      title: `Clip ${i}`,
      accent: '#2B8FFF',
      tag: slots[(i - 1) % slots.length],
    }),
  );
}

// Big wins — gold, because they are money
for (let i = 1; i <= 6; i++) {
  const vertical = i === 3;
  writeFileSync(
    join(OUT, `win-${i}.svg`),
    frame({
      w: vertical ? 720 : 1280,
      h: vertical ? 1280 : 720,
      title: `Big win ${i}`,
      accent: '#FFB93B',
      tag: slots[(i - 1) % slots.length],
    }),
  );
}

// Avatar
writeFileSync(join(OUT, 'avatar.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="Avatar">
  <rect width="96" height="96" fill="#0C1B33"/>
  <circle cx="48" cy="38" r="16" fill="#1E3A63"/>
  <path d="M16 88c0-17.7 14.3-32 32-32s32 14.3 32 32" fill="#1E3A63"/>
</svg>`);

// Portrait for About Matty
writeFileSync(join(OUT, 'matty.svg'), frame({ w: 900, h: 1100, title: 'Matty', accent: '#2B8FFF', tag: 'PORTRAIT — AWAITING ASSET' }));

console.log('placeholders written to', OUT);
