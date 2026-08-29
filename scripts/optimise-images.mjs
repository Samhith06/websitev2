/**
 * Converts source artwork to WebP at the size it is actually displayed.
 *
 * The originals are kept — this writes alongside them, so re-running with
 * different settings never destroys the source. Point `imageUrl` in
 * `lib/mock.ts` at the .webp once you are happy with it.
 *
 *   node scripts/optimise-images.mjs                 # convert the defaults
 *   node scripts/optimise-images.mjs some/file.png   # convert one file
 */
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';

const DIR = 'public/brand';

/**
 * Cards render these at roughly 600px wide. Twice that covers retina without
 * shipping a 1000px image to a phone that will draw it at 340.
 */
const MAX_WIDTH = 1200;
const QUALITY = 78;

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`;

const explicit = process.argv.slice(2);
const files = explicit.length
  ? explicit
  : (await readdir(DIR))
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      .map((f) => join(DIR, f));

let before = 0;
let after = 0;

for (const file of files) {
  const { dir, name } = parse(file);
  const out = join(dir, `${name}.webp`);

  const original = (await stat(file)).size;
  const meta = await sharp(file).metadata();

  await sharp(file)
    .resize({ width: Math.min(MAX_WIDTH, meta.width ?? MAX_WIDTH), withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(out);

  const compressed = (await stat(out)).size;
  before += original;
  after += compressed;

  const saved = Math.round((1 - compressed / original) * 100);
  console.log(
    `  ${name.padEnd(14)} ${String(meta.width).padStart(4)}px  ${kb(original).padStart(7)} -> ${kb(compressed).padStart(6)}  (-${saved}%)`,
  );
}

if (files.length > 1) {
  console.log(
    `\n  total          ${kb(before)} -> ${kb(after)}  (-${Math.round((1 - after / before) * 100)}%)`,
  );
}
