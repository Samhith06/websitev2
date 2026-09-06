/**
 * Baccarat — punto banco, eight decks (Master Plan §9).
 *
 * There is nothing to decide in this game. Both hands are dealt and drawn by a
 * fixed table of rules that has not changed in a century, so the only choice a
 * player makes is where to put the coins before the cards come out. That makes
 * it a single-round game like dice or the wheel rather than a conversation like
 * blackjack: one request in, a settled coup back, and the whole thing
 * recomputable from `serverSeed:clientSeed:nonce`.
 *
 * **The paytable is re-priced, and that is the only liberty taken here.** The
 * rules below are the standard ones exactly. The odds are not: a real table
 * pays 1:1 on Player (98.76%), 0.95:1 on Banker (98.94%), 8:1 on Tie (85.64%)
 * and 11:1 on a pair (89.64%), and every one of those is under the 99% printed
 * on every game page here. So each is scaled to return 99% instead, the same
 * treatment the keno tables and the blackjack side bets got. Tie and the pairs
 * move a long way; Player and Banker barely move at all, which is worth knowing
 * — the base game was already close to honest, and it is the side bets that a
 * casino makes its living on.
 *
 * The figures come out untidy. That is the point: a round number would mean the
 * edge had been rounded rather than held. `scripts/check-rtp.mjs` recomputes
 * every one of them from an exact enumeration of the shoe and fails on drift.
 */

import { freshShoe, type Card, type Rank } from './cards';

export const BACCARAT_DECKS = 8;
export const BACCARAT_SHOE_SIZE = BACCARAT_DECKS * 52;

/** An unshuffled eight-deck shoe. The shuffle needs the seeds, so it is done
 *  in `lib/fairness.ts`; this is only the composition. */
export function freshBaccaratShoe(): Card[] {
  return freshShoe(BACCARAT_DECKS);
}

/* -------------------------------------------------------------------------- */
/* Card and hand values                                                       */
/* -------------------------------------------------------------------------- */

/** Ace is one, pips are themselves, and every ten-card is nothing. */
export function baccaratValue(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return Number(rank);
}

/** Totals run modulo ten, which is why nine is the best hand in the game. */
export function baccaratTotal(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + baccaratValue(c.r), 0) % 10;
}

/* -------------------------------------------------------------------------- */
/* The bets                                                                   */
/* -------------------------------------------------------------------------- */

export const BACCARAT_BETS = ['player', 'banker', 'tie', 'playerPair', 'bankerPair'] as const;
export type BaccaratBet = (typeof BACCARAT_BETS)[number];

/**
 * What one coin staked comes back as when the bet wins — the stake included,
 * which is the convention `lib/games.ts` uses everywhere (an even-money bet is
 * 2, a push is 1, a loss is 0).
 *
 * Every figure is `0.99 / P(win)`, computed from the exact enumeration in
 * `scripts/check-rtp.mjs`, then truncated to five places so the rounding falls
 * on the house's side rather than ours:
 *
 *   Player      P = 0.446246609, ties push       → 99.0000%
 *   Banker      P = 0.458597423, ties push       → 98.9999%
 *   Tie         P = 0.095155968                  → 98.9998%
 *   Either pair P = 31/415 = 0.074698795         → 98.9999%
 */
export const BACCARAT_PAYS: Record<BaccaratBet, number> = {
  player: 2.00526,
  banker: 1.95126,
  tie: 10.40397,
  playerPair: 13.25322,
  bankerPair: 13.25322,
};

/**
 * The odds as a casino would write them, for the paytable panel.
 *
 * Kept beside the multipliers rather than derived on the page, so the two can
 * never drift apart, and printed next to what a real table pays because the
 * comparison is the interesting part.
 */
export const BACCARAT_PAYTABLE: Array<{
  bet: BaccaratBet;
  label: string;
  pays: string;
  casino: string;
  note: string;
}> = [
  {
    bet: 'player',
    label: 'Player',
    pays: '1.0053 : 1',
    casino: '1 : 1',
    note: 'A tie hands your stake back.',
  },
  {
    bet: 'banker',
    label: 'Banker',
    pays: '0.9513 : 1',
    casino: '0.95 : 1',
    note: 'Commission of 4.87%, not the usual 5%. A tie hands your stake back.',
  },
  {
    bet: 'tie',
    label: 'Tie',
    pays: '9.404 : 1',
    casino: '8 : 1',
    note: 'Loses on anything but a tie. The worst bet on a real table by a distance.',
  },
  {
    bet: 'playerPair',
    label: 'Player pair',
    pays: '12.2532 : 1',
    casino: '11 : 1',
    note: "Player's first two cards share a rank.",
  },
  {
    bet: 'bankerPair',
    label: 'Banker pair',
    pays: '12.2532 : 1',
    casino: '11 : 1',
    note: "Banker's first two cards share a rank.",
  },
];

export const BACCARAT_LABELS: Record<BaccaratBet, string> = {
  player: 'Player',
  banker: 'Banker',
  tie: 'Tie',
  playerPair: 'Player pair',
  bankerPair: 'Banker pair',
};

export type BaccaratSpread = Record<BaccaratBet, number>;

export const emptySpread = (): BaccaratSpread => ({
  player: 0, banker: 0, tie: 0, playerPair: 0, bankerPair: 0,
});

export function spreadTotal(spread: BaccaratSpread): number {
  return BACCARAT_BETS.reduce((sum, key) => sum + (spread[key] || 0), 0);
}

/* -------------------------------------------------------------------------- */
/* The coup                                                                   */
/* -------------------------------------------------------------------------- */

export type BaccaratOutcome = 'player' | 'banker' | 'tie';

export type Coup = {
  player: Card[];
  banker: Card[];
  playerTotal: number;
  bankerTotal: number;
  outcome: BaccaratOutcome;
  /** Eight or nine off the first four cards, which ends the coup at once. */
  natural: boolean;
  playerPair: boolean;
  bankerPair: boolean;
  /** How far into the shoe the coup reached, for anyone checking the deal. */
  cursor: number;
};

/**
 * Does the banker take a third card?
 *
 * The table below is the whole of baccarat's supposed mystique. It is not a
 * strategy and nobody at the table chooses it — it is fixed, and it is written
 * out in full here rather than compressed, because a reader checking the game
 * against any published set of rules should be able to do it line by line.
 */
export function bankerDraws(bankerTotal: number, playerThird: number | null): boolean {
  // The player stood, so the banker follows the same rule the player did.
  if (playerThird === null) return bankerTotal <= 5;

  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return playerThird !== 8;
  if (bankerTotal === 4) return playerThird >= 2 && playerThird <= 7;
  if (bankerTotal === 5) return playerThird >= 4 && playerThird <= 7;
  if (bankerTotal === 6) return playerThird === 6 || playerThird === 7;
  return false; // seven stands
}

/**
 * Deals one coup off the front of a shuffled shoe.
 *
 * The shoe is fixed before a card is turned, so this is a pure reading of it:
 * hand the same shoe in twice and the same coup comes out, which is what makes
 * the round checkable afterwards.
 */
export function playCoup(shoe: Card[]): Coup {
  let cursor = 0;
  const take = () => shoe[cursor++];

  // Player, banker, player, banker — the order a dealer uses.
  const player: Card[] = [take()];
  const banker: Card[] = [take()];
  player.push(take());
  banker.push(take());

  const playerPair = player[0].r === player[1].r;
  const bankerPair = banker[0].r === banker[1].r;

  let playerTotal = baccaratTotal(player);
  let bankerTotal = baccaratTotal(banker);
  const natural = playerTotal >= 8 || bankerTotal >= 8;

  if (!natural) {
    let playerThird: number | null = null;
    if (playerTotal <= 5) {
      const card = take();
      player.push(card);
      playerThird = baccaratValue(card.r);
      playerTotal = baccaratTotal(player);
    }
    if (bankerDraws(bankerTotal, playerThird)) {
      banker.push(take());
      bankerTotal = baccaratTotal(banker);
    }
  }

  const outcome: BaccaratOutcome =
    playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie';

  return {
    player, banker, playerTotal, bankerTotal,
    outcome, natural, playerPair, bankerPair, cursor,
  };
}

/* -------------------------------------------------------------------------- */
/* Settlement                                                                 */
/* -------------------------------------------------------------------------- */

export type BaccaratLine = {
  bet: BaccaratBet;
  staked: number;
  /** 'win', 'push' — a tie on Player or Banker — or 'lose'. */
  result: 'win' | 'push' | 'lose';
  returned: number;
};

/**
 * What each spot is owed, and the total.
 *
 * A tie is a push on Player and Banker rather than a loss. That is the real
 * rule and it is worth stating, because it is the reason those two bets are
 * priced against `0.99 - P(tie)` rather than against 0.99 flat.
 */
export function settleCoup(spread: BaccaratSpread, coup: Coup): {
  lines: BaccaratLine[];
  returned: number;
} {
  const won: Record<BaccaratBet, boolean> = {
    player: coup.outcome === 'player',
    banker: coup.outcome === 'banker',
    tie: coup.outcome === 'tie',
    playerPair: coup.playerPair,
    bankerPair: coup.bankerPair,
  };

  const lines: BaccaratLine[] = [];
  let returned = 0;

  for (const bet of BACCARAT_BETS) {
    const staked = spread[bet] || 0;
    if (staked <= 0) continue;

    const pushes = (bet === 'player' || bet === 'banker') && coup.outcome === 'tie';
    const result: BaccaratLine['result'] = won[bet] ? 'win' : pushes ? 'push' : 'lose';
    const back =
      result === 'win' ? Math.round(staked * BACCARAT_PAYS[bet])
      : result === 'push' ? staked
      : 0;

    returned += back;
    lines.push({ bet, staked, result, returned: back });
  }

  return { lines, returned };
}

/** The house rules, printed on the page so nothing is implied. */
export const BACCARAT_RULES = [
  { label: 'Decks', value: String(BACCARAT_DECKS) },
  { label: 'Player draws', value: '0–5' },
  { label: 'Player stands', value: '6–7' },
  { label: 'Natural', value: '8 or 9 ends it' },
  { label: 'Banker', value: 'by the drawing table' },
  { label: 'Tie on Player/Banker', value: 'stake returned' },
] as const;
