/**
 * Rebuilds data/keno-paytables.json from the Stake tables in the supplied
 * Keno.dc.html design, holding every table at 99% RTP.
 *
 * Every table keeps Stake's shape — the ratios between hit tiers, and so the
 * ladder a player reads — and is scaled by one constant so it returns exactly
 * 99%. Most of Stake's tables are already within a fraction of that and barely
 * move. Four are not, and three of those are not "high risk" but broken:
 *
 *     high 8 picks   61.54%
 *     high 9 picks   56.77%
 *     high 10 picks  28.46%
 *     classic 9      98.34%
 *
 * A 28% return means a player loses 71p in the pound on a page advertising 99%.
 * Scaling rather than replacing keeps what makes High feel like High — nothing
 * pays below five hits, and the top tier is enormous — while the number in the
 * corner stays true.
 *
 *   node scripts/adopt-stake-tables.mjs <path-to-design-script.js>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const TARGET = 0.99;
const src = readFileSync(process.argv[2], 'utf8');
const STAKE = eval('(' + src.slice(src.indexOf('{'), src.indexOf('};') + 1) + ')');

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return r;
}
const chance = (picks, k) => comb(picks, k) * comb(40 - picks, 10 - k) / comb(40, 10);
const rtpOf = (t, picks) => t.reduce((s, m, k) => s + m * chance(picks, k), 0);
const round2 = (n) => Math.round(n * 100) / 100;

const out = {
  board: { numbers: 40, drawn: 10 },
  rtp_target: TARGET,
  paytables: { classic: {}, low: {}, medium: {}, high: {} },
};
const notes = [];

for (const risk of ['classic', 'low', 'medium', 'high']) {
  for (let picks = 1; picks <= 10; picks++) {
    const table = STAKE[risk][picks - 1].slice();
    const before = rtpOf(table, picks);

    /*
     * Scale every paying tier by one constant.
     *
     * The first attempt lifted individual tiers and produced
     * [.. 20.15, 13, 63 ..] — five hits paying more than six, which is
     * incoherent to anyone reading the ladder. RTP is linear in the
     * multipliers, so a single factor reaches the target while preserving
     * Stake's exact ratios and, with them, the ordering.
     */
    const factor = TARGET / before;
    for (let hits = 0; hits < table.length; hits += 1) {
      if (table[hits] > 0) table[hits] = round2(table[hits] * factor);
    }

    /*
     * Scaling lands close, then rounding to a penny pushes it back off — on a
     * one-pick table there are only two numbers to round. A final nudge on the
     * single most probable paying tier closes the gap, and every candidate is
     * checked for monotonicity before it is accepted, so nothing can end up
     * paying less for more hits.
     */
    const monotonic = (t) => {
      let last = 0;
      for (const m of t) {
        if (m > 0 && m < last) return false;
        if (m > 0) last = m;
      }
      return true;
    };
    const paying = table
      .map((m, hits) => ({ m, hits, c: chance(picks, hits) }))
      .filter((t) => t.m > 0)
      .sort((a, b) => b.c - a.c);

    for (const tier of paying) {
      let best = Math.abs(rtpOf(table, picks) - TARGET);
      if (best <= 0.0002) break;
      for (let step = -40; step <= 40; step += 1) {
        const candidate = round2(table[tier.hits] + step * 0.01);
        if (candidate <= 0) continue;
        const saved = table[tier.hits];
        table[tier.hits] = candidate;
        const err = Math.abs(rtpOf(table, picks) - TARGET);
        if (err < best && monotonic(table)) best = err;
        else table[tier.hits] = saved;
      }
    }

    out.paytables[risk][String(picks)] = table;
    notes.push({ risk, picks, before, after: rtpOf(table, picks) });
  }
}

writeFileSync('data/keno-paytables.json', JSON.stringify(out, null, 1) + '\n');

console.log('Taken verbatim from Stake: ' + (40 - notes.length) + ' of 40 tables\n');
console.log('Re-solved to 99% (Stake shape kept):');
for (const n of notes) {
  console.log('  ' + n.risk.padEnd(8) + String(n.picks).padStart(2) + ' picks   ' +
    (n.before * 100).toFixed(2) + '%  ->  ' + (n.after * 100).toFixed(2) + '%');
}
console.log('\nhigh 10 picks now: ' + JSON.stringify(out.paytables.high['10']));
