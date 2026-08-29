/**
 * Independent check of the game maths.
 *
 * Deliberately reimplements the formulas from the written spec rather than
 * importing lib/games.ts, so a mistake in the library does not verify itself.
 */
import { readFileSync } from 'node:fs';
import { createHmac, createHash } from 'node:crypto';

const root = process.argv[2];
const paytables = JSON.parse(readFileSync(`${root}/data/keno-paytables.json`, 'utf8'));

let failures = 0;
function check(name, actual, expected, tolerance) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(38)} ${actual.toFixed(5)}  (target ${expected}, ±${tolerance})`,
  );
}

/* ---------------------------------------------------------------- keno --- */

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

const BOARD = paytables.board.numbers;
const DRAWN = paytables.board.drawn;

/** Every keno table, all forty, solved to 99%. */
console.log('\n--- Keno paytables, all 40 tables ---');
const LO = 0.9875, HI = 0.9925;
const kenoRtp = (risk, picks) => {
  const table = paytables.paytables[risk][String(picks)];
  let rtp = 0;
  for (let hits = 0; hits < table.length; hits++) {
    rtp += table[hits] * ((comb(picks, hits) * comb(BOARD - picks, DRAWN - hits)) / comb(BOARD, DRAWN));
  }
  return rtp;
};
let outOfBand = 0;
for (const risk of Object.keys(paytables.paytables)) {
  for (let picks = 1; picks <= 10; picks++) {
    const rtp = kenoRtp(risk, picks);
    if (rtp < LO || rtp > HI) {
      outOfBand++;
      console.log(`      OUT OF BAND ${risk}/${picks} = ${(rtp * 100).toFixed(2)}%`);
    }
  }
}
check(`all 40 keno tables inside ${(LO*100).toFixed(2)}-${(HI*100).toFixed(2)}%`, outOfBand, 0, 0);
console.log('  10-pick tables (as supplied):');
for (const risk of Object.keys(paytables.paytables)) {
  console.log(`    ${risk.padEnd(8)}${(kenoRtp(risk, 10) * 100).toFixed(2)}%   top ${Math.max(...paytables.paytables[risk]['10'])}x`);
}

/* ------------------------------------------- fairness engine, empirical --- */

function floats(serverSeed, clientSeed, nonce, count) {
  const out = [];
  let cursor = 0;
  let bytes = [];
  const pull = () => {
    if (bytes.length === 0) {
      bytes = [...createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${cursor}`).digest()];
      cursor++;
    }
    return bytes.shift();
  };
  for (let i = 0; i < count; i++) {
    let v = 0;
    for (let j = 0; j < 4; j++) v += pull() / 256 ** (j + 1);
    out.push(v);
  }
  return out;
}

const SEED = createHash('sha256').update('mattyspins-test-seed').digest('hex');
const ROUNDS = 300_000;

console.log('\n--- Fairness engine, empirical over 300,000 rounds ---');

// Dice: target 50, roll over. Chance 50%, multiplier 100/50 * 0.99 = 1.98
let diceReturn = 0;
for (let n = 0; n < ROUNDS; n++) {
  const [f] = floats(SEED, 'check', n, 1);
  const roll = Math.floor(f * 10001) / 100;
  if (roll > 50) diceReturn += 1.98;
}
check('dice RTP (over 50)', diceReturn / ROUNDS, 0.99, 0.01);

// Limbo: target 2.00. Chance = 0.99/2 = 49.5%, pays 2.00
let limboReturn = 0;
for (let n = 0; n < ROUNDS; n++) {
  const [f] = floats(SEED, 'check', n, 1);
  const result = Math.max(1, Math.floor((1 / (1 - f)) * 0.99 * 100) / 100);
  if (result >= 2) limboReturn += 2;
}
check('limbo RTP (target 2.00x)', limboReturn / ROUNDS, 0.99, 0.01);

// Keno: classic, 6 picks
const classic6 = paytables.paytables.classic['6'];
const picks = [1, 2, 3, 4, 5, 6];
let kenoReturn = 0;
const KENO_ROUNDS = 120_000;
for (let n = 0; n < KENO_ROUNDS; n++) {
  const pool = Array.from({ length: BOARD }, (_, i) => i + 1);
  const f = floats(SEED, 'check', n, DRAWN);
  const drawn = [];
  for (let i = 0; i < DRAWN; i++) {
    const pick = i + Math.floor(f[i] * (pool.length - i));
    [pool[i], pool[pick]] = [pool[pick], pool[i]];
    drawn.push(pool[i]);
  }
  const hits = picks.filter((p) => drawn.includes(p)).length;
  kenoReturn += classic6[hits] ?? 0;
}
check('keno RTP (classic, 6 picks)', kenoReturn / KENO_ROUNDS, 0.99, 0.03);

// Keno draws must always be ten distinct numbers in range.
let malformed = 0;
for (let n = 0; n < 5_000; n++) {
  const pool = Array.from({ length: BOARD }, (_, i) => i + 1);
  const f = floats(SEED, 'distinct', n, DRAWN);
  const drawn = [];
  for (let i = 0; i < DRAWN; i++) {
    const pick = i + Math.floor(f[i] * (pool.length - i));
    [pool[i], pool[pick]] = [pool[pick], pool[i]];
    drawn.push(pool[i]);
  }
  if (new Set(drawn).size !== DRAWN) malformed++;
  if (drawn.some((d) => d < 1 || d > BOARD)) malformed++;
}
console.log(`${malformed === 0 ? 'PASS' : 'FAIL'}  keno draws distinct and in range   ${malformed} malformed of 5,000`);
if (malformed) failures++;

// Determinism: the same three values must always give the same answer.
const a = floats(SEED, 'same', 42, 4).join(',');
const b = floats(SEED, 'same', 42, 4).join(',');
const c = floats(SEED, 'same', 43, 4).join(',');
console.log(`${a === b ? 'PASS' : 'FAIL'}  deterministic for one nonce`);
console.log(`${a !== c ? 'PASS' : 'FAIL'}  different across nonces`);
if (a !== b || a === c) failures++;

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
