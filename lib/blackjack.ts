/**
 * Blackjack rules and the provably-fair shoe (Master Plan §9).
 *
 * Built from the supplied Claude Design table. Three things in that design are
 * deliberately changed, each because it would otherwise break something this
 * site has already promised:
 *
 *   • **The shoe is committed, not shuffled in the browser.** The design calls
 *     `Math.random()` and keeps one shoe across rounds. Here a fresh 312-card
 *     shoe is derived from `serverSeed:clientSeed:nonce`, so every card in a
 *     round can be recomputed by anybody afterwards. One shoe per round is the
 *     point: a shoe carried between rounds would make a hand's outcome depend
 *     on rounds before it, and verifying one hand would mean replaying a whole
 *     session.
 *
 *   • **The side-bet paytables are re-priced.** The design ships the usual
 *     casino numbers, which return 93.89% (perfect pairs) and 95.38% (21+3).
 *     Both sit under the 99% printed on every game page. The tables below keep
 *     the design's shape and are scaled so each returns 99%, the same treatment
 *     the keno tables got.
 *
 *   • **Insurance is not offered.** At the standard 2:1 it returns 92.60% — the
 *     worst bet on the table, and one that exists in real casinos to profit
 *     from a mistake basic strategy tells you never to make. Priced fairly it
 *     would be 2.207:1, at which point it is exactly neutral and only adds a
 *     decision. Neither version earns its place, so the dealer never offers it.
 *
 * House rules, stated on the page: six decks, dealer stands on all 17,
 * blackjack pays 3:2, double on any first two cards, split once, no double
 * after split, no surrender.
 */

export const DECKS = 6;
export const SHOE_SIZE = DECKS * 52;
export const MAX_SEATS = 5;
export const MAX_HANDS_PER_SEAT = 2;

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['S', 'H', 'D', 'C'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/** A card is stored as rank + suit; everything else is derived. */
export type Card = { r: Rank; s: Suit };

export const isRed = (card: Card) => card.s === 'H' || card.s === 'D';

/** Aces count 11 here; `handTotal` demotes them as needed. */
export function cardValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'J' || rank === 'Q' || rank === 'K' || rank === '10') return 10;
  return Number(rank);
}

function rankOrder(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

/* -------------------------------------------------------------------------- */
/* Hand arithmetic                                                            */
/* -------------------------------------------------------------------------- */

export function handTotal(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

/** Soft means an ace is still counting as eleven — the total can drop by ten. */
export function isSoft(cards: Card[]): boolean {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === 'A') aces += 1;
  }
  let demoted = 0;
  while (total > 21 && aces - demoted > 0) {
    total -= 10;
    demoted += 1;
  }
  return aces - demoted > 0;
}

/** A split hand cannot make blackjack, however it totals. */
export function isBlackjack(cards: Card[], fromSplit: boolean): boolean {
  return !fromSplit && cards.length === 2 && handTotal(cards) === 21;
}

/* -------------------------------------------------------------------------- */
/* Side bets                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Scaled from the design's own tables so each returns 99% on a six-deck shoe.
 * `scripts/check-blackjack.mjs` recomputes both exactly and fails on drift.
 */
export const PERFECT_PAIRS = {
  perfect: 26.36,
  coloured: 12.65,
  mixed: 6.43,
} as const;

export const TWENTY_ONE_PLUS_THREE = {
  suitedTrips: 103.8,
  straightFlush: 41.52,
  trips: 31.14,
  straight: 10.38,
  flush: 5.25,
} as const;

export type SideWin = { label: string; multiplier: number };

export function perfectPairs(cards: Card[]): SideWin | null {
  const [a, b] = cards;
  if (!a || !b || a.r !== b.r) return null;
  if (a.s === b.s) return { label: 'Perfect pair', multiplier: PERFECT_PAIRS.perfect };
  if (isRed(a) === isRed(b)) return { label: 'Coloured pair', multiplier: PERFECT_PAIRS.coloured };
  return { label: 'Mixed pair', multiplier: PERFECT_PAIRS.mixed };
}

export function twentyOnePlusThree(cards: Card[], upcard: Card | undefined): SideWin | null {
  if (!upcard || cards.length < 2) return null;
  const three = [cards[0], cards[1], upcard];

  const suited = three.every((c) => c.s === three[0].s);
  const trips = three.every((c) => c.r === three[0].r);
  const o = three.map((c) => rankOrder(c.r)).sort((x, y) => x - y);
  // Ace plays low in A-2-3 and high in Q-K-A.
  const straight = (o[1] === o[0] + 1 && o[2] === o[1] + 1) || (o[0] === 1 && o[1] === 12 && o[2] === 13);

  if (suited && trips) return { label: 'Suited trips', multiplier: TWENTY_ONE_PLUS_THREE.suitedTrips };
  if (suited && straight) return { label: 'Straight flush', multiplier: TWENTY_ONE_PLUS_THREE.straightFlush };
  if (trips) return { label: 'Three of a kind', multiplier: TWENTY_ONE_PLUS_THREE.trips };
  if (straight) return { label: 'Straight', multiplier: TWENTY_ONE_PLUS_THREE.straight };
  if (suited) return { label: 'Flush', multiplier: TWENTY_ONE_PLUS_THREE.flush };
  return null;
}

/* -------------------------------------------------------------------------- */
/* Round state                                                                */
/* -------------------------------------------------------------------------- */

export type HandResult = 'win' | 'lose' | 'push';

export type Hand = {
  cards: Card[];
  bet: number;
  done: boolean;
  doubled: boolean;
  fromSplit: boolean;
  blackjack: boolean;
  result: HandResult | null;
  resultLabel: string | null;
};

export type Seat = {
  index: number;
  main: number;
  pairs: number;
  plusThree: number;
  hands: Hand[];
  /** Side-bet outcomes, resolved the moment the cards are on the table. */
  notes: string[];
  sideWon: number;
};

export type Phase = 'playing' | 'dealer' | 'settled';

export type RoundState = {
  /** How far into the shoe we are. The shoe itself is rebuilt from the seed. */
  cursor: number;
  seats: Seat[];
  dealer: Card[];
  /** The dealer's hole card stays hidden until the dealer's turn. */
  holeHidden: boolean;
  phase: Phase;
  activeSeat: number;
  activeHand: number;
  /** Total staked, and total returned once settled. */
  staked: number;
  returned: number;
};

export type SeatBet = { main: number; pairs: number; plusThree: number };

function blankHand(bet: number, fromSplit = false): Hand {
  return {
    cards: [], bet, done: false, doubled: false, fromSplit,
    blackjack: false, result: null, resultLabel: null,
  };
}

/**
 * Deals the opening cards and resolves the side bets.
 *
 * Everything a round will ever need is decided here — the shoe is fixed, so the
 * only thing later actions do is take the next card off it.
 */
export function openRound(shoe: Card[], bets: SeatBet[]): RoundState {
  const seats: Seat[] = bets.map((b, index) => ({
    index,
    main: b.main,
    pairs: b.pairs,
    plusThree: b.plusThree,
    hands: b.main > 0 ? [blankHand(b.main)] : [],
    notes: [],
    sideWon: 0,
  }));

  let cursor = 0;
  const take = () => shoe[cursor++];

  // Two rounds of dealing, players first, exactly as at a table.
  const live = seats.filter((s) => s.hands.length > 0);
  const dealer: Card[] = [];
  for (let pass = 0; pass < 2; pass += 1) {
    for (const seat of live) seat.hands[0].cards.push(take());
    dealer.push(take());
  }

  // Side bets settle against the opening cards and the dealer's upcard.
  const upcard = dealer[0];
  for (const seat of seats) {
    if (!seat.hands.length) continue;
    const cards = seat.hands[0].cards;

    if (seat.pairs > 0) {
      const win = perfectPairs(cards);
      if (win) {
        const paid = Math.round(seat.pairs * win.multiplier);
        seat.sideWon += seat.pairs + paid;
        seat.notes.push(`${win.label} · +${paid}`);
      } else {
        seat.notes.push('Pairs · no pair');
      }
    }
    if (seat.plusThree > 0) {
      const win = twentyOnePlusThree(cards, upcard);
      if (win) {
        const paid = Math.round(seat.plusThree * win.multiplier);
        seat.sideWon += seat.plusThree + paid;
        seat.notes.push(`${win.label} · +${paid}`);
      } else {
        seat.notes.push('21+3 · no hand');
      }
    }

    // A natural is done before anybody acts.
    if (isBlackjack(cards, false)) {
      seat.hands[0].blackjack = true;
      seat.hands[0].done = true;
    }
  }

  // The dealer peeks. A natural ends the round there and then, before anyone
  // can double or split into a hand that was already beaten — without this the
  // house collects stakes the player never had a fair chance to withhold, and
  // the game returns less than the 99.5% the page claims.
  const dealerNatural = isBlackjack(dealer, false);
  if (dealerNatural) {
    for (const seat of seats) for (const hand of seat.hands) hand.done = true;
  }

  const staked = bets.reduce((sum, b) => sum + b.main + b.pairs + b.plusThree, 0);

  const state: RoundState = {
    cursor,
    seats,
    dealer,
    holeHidden: dealerNatural ? false : true,
    phase: 'playing',
    activeSeat: -1,
    activeHand: 0,
    staked,
    returned: 0,
  };

  if (dealerNatural) {
    state.phase = 'dealer';
    state.activeSeat = -1;
  } else {
    advance(state, 0, 0);
  }
  return state;
}

/** Moves focus to the next hand that still has a decision, or to the dealer. */
export function advance(state: RoundState, fromSeat: number, fromHand: number): void {
  for (let i = fromSeat; i < state.seats.length; i += 1) {
    const seat = state.seats[i];
    const start = i === fromSeat ? fromHand : 0;
    for (let j = start; j < seat.hands.length; j += 1) {
      if (!seat.hands[j].done) {
        state.activeSeat = i;
        state.activeHand = j;
        state.phase = 'playing';
        return;
      }
    }
  }
  state.activeSeat = -1;
  state.phase = 'dealer';
}

export type Action = 'hit' | 'stand' | 'double' | 'split';

/** What the hand in focus may legally do, given the balance behind it. */
export function actionsFor(state: RoundState, spendable: number): Action[] {
  if (state.phase !== 'playing' || state.activeSeat < 0) return [];
  const seat = state.seats[state.activeSeat];
  const hand = seat?.hands[state.activeHand];
  if (!hand || hand.done) return [];

  const actions: Action[] = ['hit', 'stand'];
  const fresh = hand.cards.length === 2;

  // No double after split, following the house rules printed on the page.
  if (fresh && !hand.fromSplit && spendable >= hand.bet) actions.push('double');
  if (
    fresh &&
    seat.hands.length < MAX_HANDS_PER_SEAT &&
    cardValue(hand.cards[0].r) === cardValue(hand.cards[1].r) &&
    spendable >= hand.bet
  ) {
    actions.push('split');
  }
  return actions;
}

export type ApplyResult = { ok: true; extraStake: number } | { ok: false; error: string };

/**
 * Applies one decision. Returns how much more was staked, so the caller can
 * move exactly that many coins in the same transaction.
 */
export function applyAction(state: RoundState, shoe: Card[], action: Action, spendable: number): ApplyResult {
  if (!actionsFor(state, spendable).includes(action)) {
    return { ok: false, error: 'That is not a legal move for this hand.' };
  }

  const seat = state.seats[state.activeSeat];
  const hand = seat.hands[state.activeHand];
  const take = () => shoe[state.cursor++];
  let extraStake = 0;

  if (action === 'hit') {
    hand.cards.push(take());
    const total = handTotal(hand.cards);
    if (total >= 21) {
      hand.done = true;
      if (total > 21) {
        hand.result = 'lose';
        hand.resultLabel = 'Bust';
      }
    }
  } else if (action === 'stand') {
    hand.done = true;
  } else if (action === 'double') {
    extraStake = hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(take());
    hand.done = true;
    if (handTotal(hand.cards) > 21) {
      hand.result = 'lose';
      hand.resultLabel = 'Bust';
    }
  } else {
    // Split. Aces get one card each and stand, as the house rules say.
    extraStake = hand.bet;
    const [first, second] = hand.cards;
    const aces = first.r === 'A';
    const a = blankHand(hand.bet, true);
    const b = blankHand(hand.bet, true);
    a.cards = [first, take()];
    b.cards = [second, take()];
    for (const h of [a, b]) {
      if (aces || handTotal(h.cards) >= 21) h.done = true;
    }
    seat.hands = [a, b];
    state.activeHand = 0;
  }

  state.staked += extraStake;

  if (state.seats[state.activeSeat].hands[state.activeHand]?.done !== false) {
    advance(state, state.activeSeat, state.activeHand + 1);
  }
  return { ok: true, extraStake };
}

/**
 * The dealer's turn and settlement, run as one step.
 *
 * The dealer only draws when a hand is still live. With everybody bust the
 * cards are turned over and that is the round — drawing anyway would burn
 * cards off a shoe somebody may want to verify.
 */
export function settle(state: RoundState, shoe: Card[]): void {
  state.holeHidden = false;

  const live = state.seats.some((s) =>
    s.hands.some((h) => h.result !== 'lose' && handTotal(h.cards) <= 21),
  );
  if (live) {
    while (handTotal(state.dealer) < 17) state.dealer.push(shoe[state.cursor++]);
  }

  const dealerTotal = handTotal(state.dealer);
  const dealerBlackjack = state.dealer.length === 2 && dealerTotal === 21;

  let returned = 0;
  for (const seat of state.seats) {
    returned += seat.sideWon;
    for (const hand of seat.hands) {
      if (hand.result) continue;
      const total = handTotal(hand.cards);

      if (total > 21) {
        hand.result = 'lose';
        hand.resultLabel = 'Bust';
      } else if (hand.blackjack && !dealerBlackjack) {
        hand.result = 'win';
        hand.resultLabel = 'Blackjack';
        returned += hand.bet + Math.round(hand.bet * 1.5);
      } else if (hand.blackjack && dealerBlackjack) {
        hand.result = 'push';
        hand.resultLabel = 'Push';
        returned += hand.bet;
      } else if (dealerBlackjack) {
        hand.result = 'lose';
        hand.resultLabel = 'Dealer blackjack';
      } else if (dealerTotal > 21) {
        hand.result = 'win';
        hand.resultLabel = 'Dealer bust';
        returned += hand.bet * 2;
      } else if (total > dealerTotal) {
        hand.result = 'win';
        hand.resultLabel = 'Win';
        returned += hand.bet * 2;
      } else if (total === dealerTotal) {
        hand.result = 'push';
        hand.resultLabel = 'Push';
        returned += hand.bet;
      } else {
        hand.result = 'lose';
        hand.resultLabel = 'Lose';
      }
      hand.done = true;
    }
  }

  state.returned = returned;
  state.phase = 'settled';
  state.activeSeat = -1;
}

/** The house rules, printed on the page so nothing is implied. */
export const HOUSE_RULES = [
  { label: 'Blackjack', value: '3:2' },
  { label: 'Dealer stands', value: 'all 17' },
  { label: 'Decks', value: String(DECKS) },
  { label: 'Double', value: 'any first two' },
  { label: 'Split', value: 'once, no double after' },
  { label: 'Insurance', value: 'not offered' },
] as const;
