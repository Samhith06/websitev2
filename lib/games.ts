/**
 * Game maths and configuration — Master Plan §9.
 *
 * Every game runs at 99% RTP — a 1% house edge, thinner than the plan's
 * original 98%. Keno's ten-pick tables were supplied at that figure and the
 * rest were rescaled to match, so the edge no longer varies with how many
 * numbers you choose.
 *
 * The RTP a player is shown is always recomputed from the table in front of
 * them (`kenoRtp`) rather than read off a constant, so a bad edit
 * shows up on screen rather than hiding behind a number nobody derived.
 *
 * There is no daily wager cap. If coins inflate, shop prices move — never the
 * advertised edge.
 */
import paytableData from '@/data/keno-paytables.json';

export const RTP = 0.99;

/* -------------------------------------------------------------------------- */
/* Limits — Master Plan §9                                                    */
/* -------------------------------------------------------------------------- */

export const LIMITS = {
  minBet: 10,
  maxBet: 100,
  maxWinPerRound: 20_000,
};

/* -------------------------------------------------------------------------- */
/* Keno                                                                       */
/* -------------------------------------------------------------------------- */

export const KENO_RISKS = ['classic', 'low', 'medium', 'high'] as const;
export type KenoRisk = (typeof KENO_RISKS)[number];

export const KENO_RISK_LABELS: Record<KenoRisk, string> = {
  classic: 'Classic',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const KENO_BOARD = paytableData.board.numbers;
export const KENO_DRAWN = paytableData.board.drawn;
export const KENO_MAX_PICKS = 10;

type PaytableFile = {
  board: { numbers: number; drawn: number };
  rtp_target: number;
  paytables: Record<string, Record<string, number[]>>;
};

const tables = (paytableData as PaytableFile).paytables;

/**
 * The multipliers for a given risk level and pick count, indexed by hit count.
 * Index 0 is "0 hits", and it is a real row: the paytable renders every losing
 * tier explicitly. On High you can hit five of six and win nothing, and
 * learning that after the round rather than before it is what makes a fair
 * game feel rigged.
 */
export function kenoPaytable(risk: KenoRisk, picks: number): number[] {
  const table = tables[risk]?.[String(picks)];
  if (!table) return [0];
  return table;
}

export function kenoTopPayout(risk: KenoRisk, picks: number): number {
  return Math.max(...kenoPaytable(risk, picks));
}

/** Hypergeometric: the chance of exactly `hits` when picking `picks` of 40. */
function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

export function kenoHitChance(picks: number, hits: number): number {
  return (
    (combinations(picks, hits) * combinations(KENO_BOARD - picks, KENO_DRAWN - hits)) /
    combinations(KENO_BOARD, KENO_DRAWN)
  );
}

/** Recomputed from the table itself, so the header can never lie about it. */
export function kenoRtp(risk: KenoRisk, picks: number): number {
  const table = kenoPaytable(risk, picks);
  return table.reduce((sum, mult, hits) => sum + mult * kenoHitChance(picks, hits), 0);
}

export function kenoHits(picks: number[], drawn: number[]): number[] {
  const drawnSet = new Set(drawn);
  return picks.filter((n) => drawnSet.has(n));
}

/* -------------------------------------------------------------------------- */
/* Dice                                                                       */
/* -------------------------------------------------------------------------- */

export const DICE_MIN_CHANCE = 1;
export const DICE_MAX_CHANCE = 95;

/** The whole game is this one relationship: chance in, multiplier out. */
export function diceMultiplier(chancePercent: number): number {
  const clamped = Math.min(DICE_MAX_CHANCE, Math.max(DICE_MIN_CHANCE, chancePercent));
  return Math.floor((100 / clamped) * RTP * 10_000) / 10_000;
}

export function diceChance(target: number, direction: 'over' | 'under'): number {
  return direction === 'over' ? 100 - target : target;
}

export function diceWins(roll: number, target: number, direction: 'over' | 'under'): boolean {
  return direction === 'over' ? roll > target : roll < target;
}

/* -------------------------------------------------------------------------- */
/* Limbo                                                                      */
/* -------------------------------------------------------------------------- */

export const LIMBO_MIN_TARGET = 1.01;
export const LIMBO_MAX_TARGET = 1_000_000;

/** The chance of clearing a target, as a percentage. */
export function limboChance(target: number): number {
  return (RTP / target) * 100;
}

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A top-tier multiplier above 200× only pays in full below the maximum bet —
 * the paytable says so, and the server enforces it here.
 */
export function capPayout(bet: number, multiplier: number): number {
  return Math.min(Math.round(bet * multiplier), LIMITS.maxWinPerRound);
}

export function payoutIsCapped(bet: number, multiplier: number): boolean {
  return Math.round(bet * multiplier) > LIMITS.maxWinPerRound;
}
