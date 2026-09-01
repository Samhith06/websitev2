/**
 * Independent check of the blackjack maths.
 *
 * Reimplements the side-bet probabilities from scratch rather than importing
 * `lib/blackjack.ts`, so a mistake in the library cannot mark its own homework.
 * The base game is measured by simulation against basic strategy, because
 * blackjack's return comes out of the rules rather than a table that can be
 * solved — which is itself worth stating on the page.
 *
 *   node scripts/check-blackjack.mjs .
 */
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';

const root = process.argv[2] ?? '.';
const src = readFileSync(join(root, 'lib', 'blackjack.ts'), 'utf8');

function tableFrom(name) {
  const block = src.slice(src.indexOf(`export const ${name} = {`));
  const body = block.slice(block.indexOf('{') + 1, block.indexOf('}'));
  const out = {};
  for (const [, k, v] of body.matchAll(/(\w+)\s*:\s*([\d.]+)/g)) out[k] = Number(v);
  return out;
}

const PERFECT_PAIRS = tableFrom('PERFECT_PAIRS');
const PLUS_THREE = tableFrom('TWENTY_ONE_PLUS_THREE');

const DECKS = 6;
const N = DECKS * 52;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)}${detail}`);
  if (!ok) failures += 1;
}

/* -------------------------------------------------------------------------- */
console.log('--- Side bets, computed exactly over a six-deck shoe ---\n');

// Perfect pairs: given any first card, what the second can be.
const ppRtp =
  ((DECKS - 1) * (PERFECT_PAIRS.perfect + 1) +
    DECKS * (PERFECT_PAIRS.coloured + 1) +
    2 * DECKS * (PERFECT_PAIRS.mixed + 1)) /
  (N - 1);
check('perfect pairs returns 99%', Math.abs(ppRtp - 0.99) < 0.0015, `${(ppRtp * 100).toFixed(3)}%`);

// 21+3: every three-card multiset from the shoe, weighted by how many ways it
// can be drawn.
const order = (r) => RANKS.indexOf(r) + 1;
const types = [];
for (const r of RANKS) for (const s of SUITS) types.push({ r, s });

const counts = { suitedTrips: 0, straightFlush: 0, trips: 0, straight: 0, flush: 0, none: 0 };
let total = 0;
for (let a = 0; a < types.length; a += 1) {
  for (let b = a; b < types.length; b += 1) {
    for (let c = b; c < types.length; c += 1) {
      let ways;
      if (a === b && b === c) ways = (DECKS * (DECKS - 1) * (DECKS - 2)) / 6;
      else if (a === b || b === c) ways = ((DECKS * (DECKS - 1)) / 2) * DECKS;
      else ways = DECKS ** 3;

      const three = [types[a], types[b], types[c]];
      const suited = three.every((x) => x.s === three[0].s);
      const trips = three.every((x) => x.r === three[0].r);
      const o = three.map((x) => order(x.r)).sort((x, y) => x - y);
      const straight =
        (o[1] === o[0] + 1 && o[2] === o[1] + 1) || (o[0] === 1 && o[1] === 12 && o[2] === 13);

      const kind =
        suited && trips ? 'suitedTrips'
        : suited && straight ? 'straightFlush'
        : trips ? 'trips'
        : straight ? 'straight'
        : suited ? 'flush'
        : 'none';
      counts[kind] += ways;
      total += ways;
    }
  }
}
const t3Rtp = Object.entries(PLUS_THREE).reduce(
  (sum, [k, m]) => sum + (counts[k] / total) * (m + 1),
  0,
);
check('21+3 returns 99%', Math.abs(t3Rtp - 0.99) < 0.0015, `${(t3Rtp * 100).toFixed(3)}%`);

check('insurance is not offered', /Insurance', value: 'not offered/.test(src),
  'at 2:1 it would return 92.60%');

/* -------------------------------------------------------------------------- */
console.log('\n--- The shoe ---\n');

function* byteStream(serverSeed, clientSeed, nonce) {
  let cursor = 0;
  while (true) {
    const digest = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${cursor}`).digest();
    for (const byte of digest) yield byte;
    cursor += 1;
  }
}
function floats(serverSeed, clientSeed, nonce, count) {
  const stream = byteStream(serverSeed, clientSeed, nonce);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    let v = 0;
    for (let j = 0; j < 4; j += 1) v += stream.next().value / 256 ** (j + 1);
    out.push(v);
  }
  return out;
}
function buildShoe(serverSeed, clientSeed, nonce) {
  const shoe = [];
  for (let d = 0; d < DECKS; d += 1) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s });
  const swaps = floats(serverSeed, clientSeed, nonce, N - 1);
  for (let i = shoe.length - 1; i > 0; i -= 1) {
    const j = Math.floor(swaps[shoe.length - 1 - i] * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

const shoe = buildShoe('seed-a', 'client-a', 0);
check('a shoe holds 312 cards', shoe.length === N);
const tally = new Map();
for (const c of shoe) tally.set(`${c.r}${c.s}`, (tally.get(`${c.r}${c.s}`) ?? 0) + 1);
check('every card appears exactly six times',
  tally.size === 52 && [...tally.values()].every((n) => n === DECKS));
check('the same seed gives the same shoe',
  JSON.stringify(buildShoe('seed-a', 'client-a', 0)) === JSON.stringify(shoe));
check('a different nonce gives a different shoe',
  JSON.stringify(buildShoe('seed-a', 'client-a', 1)) !== JSON.stringify(shoe));

// A biased shuffle would leave aces clustered; check they spread evenly.
const acePositions = shoe.map((c, i) => (c.r === 'A' ? i : -1)).filter((i) => i >= 0);
const firstHalf = acePositions.filter((i) => i < N / 2).length;
check('aces are not clustered by the shuffle', firstHalf >= 6 && firstHalf <= 18, `${firstHalf} of 24 in the first half`);

/* -------------------------------------------------------------------------- */
console.log('\n--- Base game, simulated against basic strategy ---\n');

const value = (r) => (r === 'A' ? 11 : ['10', 'J', 'Q', 'K'].includes(r) ? 10 : Number(r));
function handTotal(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += value(c.r); if (c.r === 'A') aces += 1; }
  while (t > 21 && aces > 0) { t -= 10; aces -= 1; }
  return t;
}
function isSoft(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += value(c.r); if (c.r === 'A') aces += 1; }
  let d = 0;
  while (t > 21 && aces - d > 0) { t -= 10; d += 1; }
  return aces - d > 0;
}

/** Basic strategy for six decks, dealer stands all 17, no double after split. */
function decide(cards, up, canDouble, canSplit) {
  const t = handTotal(cards);
  const u = value(up.r) === 11 ? 11 : value(up.r);

  if (canSplit) {
    const p = value(cards[0].r);
    if (p === 11) return 'split';
    if (p === 8) return 'split';
    if (p === 10 || p === 5) { /* never split */ }
    else if (p === 9) { if (![7, 10, 11].includes(u)) return 'split'; }
    else if (p === 7) { if (u <= 7) return 'split'; }
    else if (p === 6) { if (u <= 6) return 'split'; }
    else if (p === 4) { /* no DAS: never */ }
    else if (p === 3 || p === 2) { if (u <= 7) return 'split'; }
  }

  if (isSoft(cards)) {
    if (t >= 19) return 'stand';
    if (t === 18) {
      if (canDouble && u >= 3 && u <= 6) return 'double';
      return u >= 9 ? 'hit' : 'stand';
    }
    if (canDouble) {
      if (t === 17 && u >= 3 && u <= 6) return 'double';
      if ((t === 16 || t === 15) && u >= 4 && u <= 6) return 'double';
      if ((t === 14 || t === 13) && u >= 5 && u <= 6) return 'double';
    }
    return 'hit';
  }

  if (canDouble) {
    if (t === 11) return 'double';
    if (t === 10 && u <= 9) return 'double';
    if (t === 9 && u >= 3 && u <= 6) return 'double';
  }
  if (t >= 17) return 'stand';
  if (t >= 13) return u <= 6 ? 'stand' : 'hit';
  if (t === 12) return u >= 4 && u <= 6 ? 'stand' : 'hit';
  return 'hit';
}

const ROUNDS = 400_000;
let staked = 0, returned = 0;
for (let n = 0; n < ROUNDS; n += 1) {
  const s = buildShoe('sim', 'client', n);
  let k = 0;
  const take = () => s[k++];

  const bet = 10;
  let roundStake = bet;
  const player = [take(), take()];
  const dealer = [take(), take()];
  let hands = [{ cards: player, bet, done: false, split: false }];

  const pBJ = handTotal(player) === 21;
  const dBJ = handTotal(dealer) === 21;

  if (!pBJ && !dBJ) {
    for (let i = 0; i < hands.length; i += 1) {
      const h = hands[i];
      while (!h.done) {
        const canDouble = h.cards.length === 2 && !h.split;
        const canSplit =
          h.cards.length === 2 && hands.length < 2 &&
          value(h.cards[0].r) === value(h.cards[1].r);
        const move = decide(h.cards, dealer[0], canDouble, canSplit);

        if (move === 'stand') h.done = true;
        else if (move === 'hit') {
          h.cards.push(take());
          if (handTotal(h.cards) >= 21) h.done = true;
        } else if (move === 'double') {
          roundStake += h.bet;
          h.bet *= 2;
          h.cards.push(take());
          h.done = true;
        } else {
          roundStake += h.bet;
          const aces = h.cards[0].r === 'A';
          const a = { cards: [h.cards[0], take()], bet: h.bet, done: aces, split: true };
          const b = { cards: [h.cards[1], take()], bet: h.bet, done: aces, split: true };
          hands = [a, b];
          i = -1;
          break;
        }
      }
    }
  }

  const anyLive = hands.some((h) => handTotal(h.cards) <= 21);
  if (!pBJ && !dBJ && anyLive) while (handTotal(dealer) < 17) dealer.push(take());
  const dt = handTotal(dealer);
  const dealerBJ = dealer.length === 2 && dt === 21;

  let back = 0;
  for (const h of hands) {
    const t = handTotal(h.cards);
    if (pBJ && !h.split) {
      if (dealerBJ) back += h.bet;
      else back += h.bet + Math.round(h.bet * 1.5);
    } else if (t > 21) { /* lost */ }
    else if (dealerBJ) { /* lost */ }
    else if (dt > 21 || t > dt) back += h.bet * 2;
    else if (t === dt) back += h.bet;
  }
  staked += roundStake;
  returned += back;
}
const rtp = returned / staked;
console.log(`  ${ROUNDS.toLocaleString()} rounds, ${staked.toLocaleString()} staked`);
check('base game returns 99-100% to basic strategy',
  rtp > 0.985 && rtp < 1.001, `${(rtp * 100).toFixed(2)}%`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
