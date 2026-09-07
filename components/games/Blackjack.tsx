'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { coins, mult } from '@/lib/format';
import { LIMITS } from '@/lib/games';
import {
  HOUSE_RULES, MAX_SEATS, PERFECT_PAIRS, TWENTY_ONE_PLUS_THREE,
  type Action, type RoundState,
  handTotal, isSoft,
} from '@/lib/blackjack';
import { CoinMark } from '@/components/ui/marks';
import { publishBalance } from '@/lib/balance-bus';
import { readSoundPreference, sounds, writeSoundPreference } from '@/lib/sound';
import { FairnessDrawer, PlayingCard, SignInToPlay } from './shared';

type View = {
  roundId: number | null;
  state: RoundState;
  actions: Action[];
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  balance: number;
  staked: number;
  returned: number | null;
};

type Refusal = { ok: false; error: string; detail?: string };

/** Chips in coins rather than dollars — the design's ladder, our currency. */
const CHIPS = [1, 5, 10, 25, 50] as const;

type Spot = 'main' | 'pairs' | 'plusThree';
type Bet = Record<Spot, number>;

const SPOTS: Array<{ key: Spot; label: string; hint: string }> = [
  { key: 'main', label: 'Main', hint: 'the hand itself' },
  { key: 'pairs', label: 'Pairs', hint: 'your first two cards' },
  { key: 'plusThree', label: '21+3', hint: 'your two plus the upcard' },
];

const emptyBets = (n: number): Bet[] =>
  Array.from({ length: n }, () => ({ main: 0, pairs: 0, plusThree: 0 }));

const betTotal = (b: Bet) => b.main + b.pairs + b.plusThree;

/* -------------------------------------------------------------------------- */
/* The deal, a card at a time                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The server settles as much of a round as it can in one request — the opening
 * deal is four to eight cards, and a stand runs the dealer's whole turn — but
 * landing all of them in one frame throws the round away in that frame. A
 * dealer does not do that, and neither does this: the answer arrives whole and
 * is then put on the felt one card at a time, in the order it was dealt.
 *
 * A pile is one place a card can land: the dealer, or one hand at one seat.
 * Split hands are separate piles, which is what lets a split deal its two new
 * second cards rather than having them appear already there.
 */
const DEALER = 'dealer';
const pileOf = (seat: number, hand: number) => `${seat}:${hand}`;

/** How many cards each pile in a round actually holds. */
function pileSizes(state: RoundState): Record<string, number> {
  const sizes: Record<string, number> = { [DEALER]: state.dealer.length };
  state.seats.forEach((seat, s) =>
    seat.hands.forEach((hand, h) => {
      sizes[pileOf(s, h)] = hand.cards.length;
    }),
  );
  return sizes;
}

/** One thing landing: a card onto a pile, or the hole card turning over. */
type Step = { pile: string; slow?: boolean } | { flip: true };

/**
 * What has to happen to get from what is face up to what the server says.
 *
 * The opening cards go round the table the way a dealer's hand does — one to
 * every seat, one to the dealer, then round again — rather than filling each
 * hand before starting the next. Everything after the dealer's two is the
 * dealer's own draw, and that waits behind the hole card, because the hole
 * turning over is the moment the round is decided.
 */
function dealSteps(state: RoundState, from: Record<string, number>, flip: boolean): Step[] {
  const piles = state.seats.flatMap((seat, s) =>
    seat.hands.map((hand, h) => ({
      pile: pileOf(s, h),
      up: from[pileOf(s, h)] ?? 0,
      all: hand.cards.length,
    })),
  );
  const dealerUp = from[DEALER] ?? 0;
  const steps: Step[] = [];

  const rounds = piles.reduce((most, p) => Math.max(most, p.all), 0);
  for (let r = 0; r < rounds; r += 1) {
    for (const p of piles) if (p.all > r && p.up <= r) steps.push({ pile: p.pile });
    if (r < 2 && state.dealer.length > r && dealerUp <= r) steps.push({ pile: DEALER });
  }

  if (flip) steps.push({ flip: true });
  for (let i = Math.max(dealerUp, 2); i < state.dealer.length; i += 1) {
    steps.push({ pile: DEALER, slow: true });
  }
  return steps;
}

/**
 * How long to wait before each one.
 *
 * The opening cards are dealt, not drawn, so they go at a steady clip. The
 * pause before the hole turns is the longest in the game because it is the
 * only moment where everything is still open, and the dealer's draws after it
 * are slower than the deal for the same reason: each one can end the round.
 */
const paceOf = (step: Step) => ('flip' in step ? 620 : step.slow ? 540 : 300);

/** Anyone who has asked their system to stop moving things gets it at once. */
const motionOff = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Blackjack, rebuilt after tester feedback.
 *
 * The rules, the shoe and the endpoint underneath are unchanged — the shoe is
 * still committed on the server before a card is dealt, so a hand can be
 * recomputed afterwards from the same three values as every other game here.
 * What changed is everything a player touches, and each change answers a
 * specific complaint:
 *
 *   • **Betting.** The old table gave each seat three unlabelled chip circles
 *     driven by one shared chip ladder, and several testers came away believing
 *     a bet placed on one hand had been copied onto all of them. It never was —
 *     the state was per-seat then and is per-seat now — but a design that has to
 *     be trusted on that point has already failed. So each hand now carries its
 *     own panel with its own three named stakes, its own running total, its own
 *     step controls and its own clear. Copying a bet across hands is still
 *     possible, but only by asking for it: "same on all" is a button.
 *
 *   • **Room.** Seats were squeezed side by side and shrank until they were
 *     unreadable. Hands now hold a minimum width and, on a phone, scroll one at
 *     a time instead of compressing. The paytables moved into a drawer.
 *
 *   • **The palette.** The old felt carried its own colours and two of its own
 *     typefaces, so the table read as a different site. This uses the site's:
 *     cyan for interface, gold for money, green and red for outcomes, mono for
 *     every figure.
 *
 *   • **Feedback.** Cards land one at a time in the order they were dealt —
 *     round the table, then the dealer, and the dealer's hole card turning
 *     last — with the result, the payout and the balance all held back until
 *     it does. Stakes bump when they change, the balance pulses when it moves,
 *     the hand to act is ringed and labelled, and every hand states its own
 *     result.
 *
 * Insurance is still absent on purpose. At the usual 2:1 it returns 92.6%, and
 * the page promises 99%; priced fairly it is exactly neutral and only adds a
 * decision. The reference drawer says so rather than leaving people wondering.
 */
export function Blackjack({ limits = LIMITS }: { limits?: { minBet: number; maxBet: number } }) {
  const [view, setView] = useState<View | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  const [handCount, setHandCount] = useState(1);
  const [chip, setChip] = useState<number>(10);
  const [bets, setBets] = useState<Bet[]>(emptyBets(MAX_SEATS));
  const [lastBets, setLastBets] = useState<Bet[] | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'flat' | 'turn' | 'good' | 'bad' }>({
    text: 'Set a stake on each hand you want in, then deal.',
    tone: 'flat',
  });

  /** Which stake just moved, so exactly that figure animates and no other. */
  const [bumped, setBumped] = useState<string | null>(null);
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef<string | null>(null);

  /**
   * Marks one figure as just-changed, then unmarks it.
   *
   * The clearing is the part that matters: a CSS animation only plays when the
   * class arrives, so leaving it on means the second nudge of the same stake
   * does not animate — which reads as the button having missed.
   */
  const flashBump = useCallback((id: string) => {
    if (bumpTimer.current) clearTimeout(bumpTimer.current);
    setBumped(null);
    requestAnimationFrame(() => setBumped(id));
    bumpTimer.current = setTimeout(() => setBumped(null), 400);
  }, []);

  useEffect(() => () => { if (bumpTimer.current) clearTimeout(bumpTimer.current); }, []);

  useEffect(() => setSoundOn(readSoundPreference()), []);

  /* ---- what is face up, which is not the same as what the server said ---- */

  /** Cards face up per pile, and whether the hole card has turned. */
  const [shown, setShown] = useState<Record<string, number>>({});
  const [holeUp, setHoleUp] = useState(false);

  // The timers run outside React, so they read and write the counts through
  // refs: a queue built from a stale render would deal cards twice.
  const shownRef = useRef<Record<string, number>>({});
  const holeUpRef = useRef(false);
  const dealTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  /** Which round those counts belong to, so a new one starts from an empty
      felt rather than from the last round's piles. */
  const roundRef = useRef<number | null>(null);

  const stopDealing = useCallback(() => {
    dealTimers.current.forEach(clearTimeout);
    dealTimers.current = [];
  }, []);

  useEffect(() => stopDealing, [stopDealing]);

  /**
   * Everything face up at once — a round found mid-play by a refresh, the skip
   * button, and anyone who has asked for less motion.
   */
  const landAll = useCallback((data: View) => {
    stopDealing();
    roundRef.current = data.roundId;
    shownRef.current = pileSizes(data.state);
    holeUpRef.current = !data.state.holeHidden;
    setShown(shownRef.current);
    setHoleUp(holeUpRef.current);
  }, [stopDealing]);

  /**
   * Whatever is on the table, including a hand left mid-play by a refresh.
   *
   * One failed read used to leave the table blank for good: no balance, no
   * seed, and no reason given. A player would see a dash where their coins
   * belong and have no way to tell a broken table from an empty account. So a
   * refusal is now said out loud, and a request that simply did not land is
   * tried again before giving up.
   */
  const load = useCallback(async (attempt = 0): Promise<void> => {
    const retry = async (reason: string) => {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        return load(attempt + 1);
      }
      setError(reason);
    };

    try {
      const response = await fetch('/api/games/blackjack', { cache: 'no-store' });
      if (response.status === 401) {
        setSignedOut(true);
        return;
      }
      if (!response.ok) {
        const refusal = await response.json().catch(() => null);
        return retry(refusal?.detail ?? 'The table could not be loaded. Nothing has been staked.');
      }

      const data = await response.json();
      // roundId 0 means "nothing dealt yet" — still worth taking, because it
      // carries the balance and the seed commitment.
      if (data.roundId === null || data.roundId === undefined) {
        return retry('The table could not be loaded. Nothing has been staked.');
      }
      setView(data);
      setError(null);
      // A round found part-played is not being dealt now — it was dealt
      // before the refresh — so it goes down whole.
      landAll(data);
      // A hand left on the table by a refresh has to say so. Without this the
      // strip still reads "set a stake, then deal" over a round that is
      // already half played.
      describe(data);
    } catch {
      return retry('Could not reach the table. Nothing has been staked.');
    }
  }, [landAll]);

  useEffect(() => { void load(); }, [load]);

  // A view with no seats is the empty table, not a finished round.
  const state = view && view.state.seats.length > 0 ? view.state : null;

  /**
   * True while the answer is ahead of the felt.
   *
   * Read off the cards rather than kept as a flag of its own: the server's
   * reply and the first tick of the reveal are two separate updates, and a
   * flag set on the second one leaves a frame in between where the round is
   * settled, the cards are not down, and every verdict on the table is
   * showing. Derived, there is no such frame — the moment a reply arrives it
   * is by definition ahead of what is face up.
   */
  const dealing = Boolean(
    state && (
      (shown[DEALER] ?? 0) < state.dealer.length
      || (!state.holeHidden && !holeUp && state.dealer.length >= 2)
      || state.seats.some((seat, s) =>
        seat.hands.some((hand, h) => (shown[pileOf(s, h)] ?? 0) < hand.cards.length))
    ),
  );

  const settled = state?.phase === 'settled';
  const playing = state?.phase === 'playing';
  // A settled round whose cards are still landing is not a betting table yet:
  // swapping the panels back to chips would announce the result over the top
  // of the dealer's last card.
  const betting = (!state || settled) && !dealing;

  /**
   * The balance the player should be looking at.
   *
   * The server moved it the moment the round settled, so printing it straight
   * would announce the result while the dealer is still drawing — a jump up is
   * a win before anybody has seen one. While the cards are coming the
   * settlement is subtracted back out, which lands on the real figure the
   * instant the last card does, with no snapshot to keep in step.
   */
  const held = dealing && settled ? view?.returned ?? 0 : 0;
  const balance = (view?.balance ?? 0) - held;
  const staged = bets.slice(0, handCount).reduce((sum, b) => sum + betTotal(b), 0);

  // A hand left mid-play by a refresh has more hands on the table than the
  // control bar knows about, so the bar follows the table rather than the
  // other way round.
  useEffect(() => {
    if (state && state.seats.length > handCount) setHandCount(state.seats.length);
  }, [state, handCount]);

  // The header's coin pill is server-rendered in the layout and cannot see a
  // round settle, so every balance the server hands back is republished to it.
  const previousBalance = useRef<number | null>(null);
  const [balanceMoved, setBalanceMoved] = useState(false);
  useEffect(() => {
    if (!view) return;
    // The *held* figure: publishing the settled one mid-deal would announce
    // the result in the page header while the cards were still coming.
    publishBalance(balance);
    if (previousBalance.current !== null && previousBalance.current !== balance) {
      setBalanceMoved(true);
      const timer = setTimeout(() => setBalanceMoved(false), 460);
      previousBalance.current = balance;
      return () => clearTimeout(timer);
    }
    previousBalance.current = balance;
  }, [view, balance]);

  /* ---------------------------------------------------------------- */

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/games/blackjack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as View | Refusal;

      if ('ok' in data) {
        if (data.error === 'not-signed-in') setSignedOut(true);
        setError(data.detail ?? 'That could not be done.');
        return null;
      }
      setView(data);
      return data;
    } catch {
      setError('Could not reach the table. Nothing has been staked.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function deal() {
    if (dealBlocked) return;
    keyRef.current = keyRef.current ?? `bj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const placed = bets.slice(0, handCount).map((b) => ({ ...b }));

    const data = await send({ op: 'deal', bets: placed, idempotencyKey: keyRef.current });
    keyRef.current = null;
    if (!data) return;

    setLastBets(placed);
    setBets(emptyBets(MAX_SEATS));
    if (soundOn) sounds.pick();
    land(data);
  }

  async function act(action: Action) {
    const data = await send({ op: 'act', action });
    if (!data) return;
    if (soundOn) (action === 'double' || action === 'split' ? sounds.quickPick(2) : sounds.draw(0));
    land(data);
  }

  /**
   * Put a server answer on the felt, one card at a time.
   *
   * Everything that would give the round away is driven off the last card
   * landing rather than off the response: the result labels, the payout line,
   * the balance and the sound all wait for it.
   */
  function land(data: View) {
    if (motionOff()) {
      landAll(data);
      announce(data);
      return;
    }

    stopDealing();

    // A new round sweeps the felt: the counts held are the last round's piles,
    // and carrying them over would leave the new cards counted as already
    // dealt. Clearing it here rather than when the bet is sent means the last
    // round stays readable until the new one is actually on its way down.
    const fresh = data.roundId !== roundRef.current;
    roundRef.current = data.roundId;
    if (fresh) {
      holeUpRef.current = false;
      setHoleUp(false);
    }
    const from = fresh ? {} : { ...shownRef.current };

    // A split turns one hand into two, each keeping a card and taking a new
    // one. Both piles go back to a single card so the two new cards land in
    // turn — otherwise the first hand's replacement simply appears.
    data.state.seats.forEach((seat, s) => {
      if (seat.hands.length > 1 && from[pileOf(s, 1)] === undefined) {
        from[pileOf(s, 0)] = 1;
        from[pileOf(s, 1)] = 1;
      }
    });

    const flip = !data.state.holeHidden && !holeUpRef.current && data.state.dealer.length >= 2;
    const steps = dealSteps(data.state, from, flip);

    if (steps.length === 0) {
      landAll(data);
      announce(data);
      return;
    }

    shownRef.current = from;
    setShown(from);
    // One card is not a deal worth narrating; a hand is.
    if (steps.length > 1) setMessage({ text: 'Dealing.', tone: 'flat' });

    let at = 0;
    steps.forEach((step, i) => {
      at += paceOf(step);
      dealTimers.current.push(setTimeout(() => {
        if ('flip' in step) {
          holeUpRef.current = true;
          setHoleUp(true);
          if (soundOn) sounds.pick();
        } else {
          const next = { ...shownRef.current };
          next[step.pile] = (next[step.pile] ?? 0) + 1;
          shownRef.current = next;
          setShown(next);
          if (soundOn) sounds.draw(Math.min(i, 6));
        }
        if (i === steps.length - 1) announce(data);
      }, at));
    });
  }

  /** Turn the rest of it over now. */
  function skipDeal() {
    if (!view) return;
    landAll(view);
    announce(view);
  }

  /** What the strip says about a view. Silent, so `load` can use it too. */
  function describe(data: View) {
    if (data.state.seats.length === 0) {
      setMessage({ text: 'Set a stake on each hand you want in, then deal.', tone: 'flat' });
      return;
    }
    if (data.state.phase !== 'settled') {
      setMessage(
        data.state.activeSeat >= 0
          ? { text: `Hand ${data.state.activeSeat + 1} to act — hit, stand${data.actions.includes('double') ? ', double' : ''}${data.actions.includes('split') ? ' or split' : ''}.`, tone: 'turn' }
          : { text: 'Dealing.', tone: 'flat' },
      );
      return;
    }
    const back = data.returned ?? 0;
    setMessage(
      back > 0
        ? { text: `Dealer ${handTotal(data.state.dealer)}. The round paid ${coins(back)} MC.`, tone: back >= data.staked ? 'good' : 'flat' }
        : { text: `Dealer ${handTotal(data.state.dealer)}. The house takes the round.`, tone: 'bad' },
    );
  }

  /** The same words, plus the sound a settlement earns. */
  function announce(data: View) {
    describe(data);
    if (data.state.phase !== 'settled' || !soundOn) return;
    const back = data.returned ?? 0;
    if (back > data.staked) sounds.win(back >= data.staked * 3);
    else sounds.settle();
  }

  /* ---- betting, per hand, and only ever on the hand it was asked for ---- */

  function nudge(hand: number, spot: Spot, direction: 1 | -1) {
    if (!betting || busy) return;
    const current = bets[hand];

    // Refusals are decided out here rather than inside the state updater. An
    // updater that also sets error state is run twice in development and is
    // the wrong place to make a decision anyway — it should only ever be the
    // arithmetic.
    if (direction > 0) {
      if (staged + chip > balance) {
        setError('Not enough coins for that chip.');
        return;
      }
      // Stopped at the chip rather than at the Deal button. Letting somebody
      // build a 300-coin spread across five hands and only then telling them
      // the table takes 100 means unpicking it a chip at a time.
      if (staged + chip > limits.maxBet) {
        setError(`The table takes at most ${limits.maxBet} MC across all hands.`);
        return;
      }
      // A side bet without a main bet is not a blackjack hand, and the server
      // refuses it — so it is refused here, before a stake is placed that
      // would only be handed back with an error.
      if (spot !== 'main' && current.main === 0) {
        setError(`Hand ${hand + 1} needs a main bet before a side bet.`);
        return;
      }
    } else if (current[spot] === 0) {
      return;
    }

    const step = direction > 0 ? chip : Math.min(chip, current[spot]);

    setBets((prev) => {
      const next = prev.map((b) => ({ ...b }));
      next[hand] = { ...prev[hand], [spot]: prev[hand][spot] + step * direction };

      // Taking the main bet away takes its side bets with it rather than
      // leaving stakes the server would refuse at the deal.
      if (spot === 'main' && next[hand].main === 0) {
        next[hand].pairs = 0;
        next[hand].plusThree = 0;
      }
      return next;
    });

    setError(null);
    flashBump(`${hand}:${spot}`);
    if (soundOn) sounds.pick();
  }

  function clearHand(hand: number) {
    if (!betting || busy) return;
    setBets((prev) => {
      const next = prev.map((b) => ({ ...b }));
      next[hand] = { main: 0, pairs: 0, plusThree: 0 };
      return next;
    });
    setError(null);
  }

  /**
   * Copy one hand's stake onto every other hand in play.
   *
   * This is the thing testers believed was happening by itself. It is worth
   * having — backing five hands identically is a normal way to play — but it
   * has to be asked for, and it has to be affordable, so the whole copy is
   * refused rather than half applied.
   */
  function copyToAll(hand: number) {
    if (!betting || busy) return;
    const source = bets[hand];
    if (betTotal(source) === 0) return;

    const cost = betTotal(source) * handCount;
    if (cost > balance) {
      setError(`Backing all ${handCount} hands like that needs ${coins(cost)} MC.`);
      return;
    }
    if (cost > limits.maxBet) {
      setError(`That would put ${coins(cost)} MC on the table, over the ${limits.maxBet} maximum.`);
      return;
    }

    setBets((prev) => {
      const next = prev.map((b) => ({ ...b }));
      for (let i = 0; i < handCount; i += 1) next[i] = { ...source };
      return next;
    });
    setError(null);
    if (soundOn) sounds.quickPick(2);
  }

  function clearAll() {
    setBets(emptyBets(MAX_SEATS));
    setError(null);
  }

  function rebet() {
    if (!lastBets) return;
    const next = emptyBets(MAX_SEATS);
    lastBets.forEach((b, i) => { next[i] = { ...b }; });
    setBets(next);
    setHandCount(Math.max(handCount, lastBets.length));
    setError(null);
  }

  if (signedOut) return <SignInToPlay game="Blackjack" />;

  const actions = view?.actions ?? [];

  // Every figure on the felt is counted off the cards that are actually face
  // up, never off the state — otherwise a total announces a card before it
  // lands, which is the whole thing this is meant to stop.
  const dealerUp = state ? state.dealer.slice(0, shown[DEALER] ?? 0) : [];
  const holeDown = Boolean(state && (state.holeHidden || !holeUp));
  const dealerTotal = handTotal(holeDown ? dealerUp.slice(0, 1) : dealerUp);

  const dealLabel =
    busy || dealing ? 'Dealing…'
    : !view ? 'Loading…'
    : staged === 0 ? 'Place a bet'
    : staged > balance ? 'Not enough coins'
    : staged > limits.maxBet ? `Table max is ${limits.maxBet}`
    : staged < limits.minBet ? `Table min is ${limits.minBet}`
    : `Deal · ${coins(staged)} MC`;

  const dealBlocked =
    busy || dealing || !view
    || staged < limits.minBet || staged > balance || staged > limits.maxBet;

  return (
    <div className="bjt">
      {/* ================================================================== */}
      <header className="bjt-head">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <h2>Blackjack</h2>
          <span className="bjt-rules">
            Six decks · dealer stands all 17 · blackjack pays 3:2
          </span>
        </div>

        <div className="bjt-figs">
          <button
            type="button"
            className="bjt-sound"
            aria-pressed={soundOn}
            onClick={() => { const next = !soundOn; setSoundOn(next); writeSoundPreference(next); }}
          >
            <i aria-hidden />
            {soundOn ? 'Sound on' : 'Muted'}
          </button>

          <div className="bjt-fig">
            <span className="k">In play</span>
            <span className="v">{coins(betting ? staged : state?.staked ?? 0)}</span>
          </div>

          <div className="bjt-fig">
            <span className="k">Balance</span>
            <span className={`v money${balanceMoved ? ' bumped' : ''}`}>
              <CoinMark size={14} />
              {view ? coins(balance) : '—'}
            </span>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      <div className="bjt-felt">
        <div className="bjt-dealer">
          <div className="bjt-who">
            Dealer
            {dealerUp.length ? (
              <span className={`bjt-total${dealerTotal > 21 ? ' bust' : ''}`}>
                {holeDown ? `${dealerTotal} +` : dealerTotal}
              </span>
            ) : null}
            {/* Suspense nobody wants is just waiting, so the rest of the round
                is always one tap away. */}
            {dealing ? (
              <button type="button" className="bjt-mini" onClick={skipDeal}>
                Skip
              </button>
            ) : null}
          </div>

          <div className="bjt-hold">
            {state?.dealer.length ? (
              dealerUp.map((card, i) => (
                <PlayingCard
                  key={`${card.r}${card.s}-${i}`}
                  card={card}
                  faceDown={holeDown && i === 1}
                  order={dealing ? 0 : i}
                  big
                />
              ))
            ) : (
              <span className="bjt-empty">Waiting for bets</span>
            )}
          </div>
        </div>

        <p
          className={`bjt-say ${error ? 'bad' : message.tone === 'flat' ? '' : message.tone}`}
          role="status"
          aria-live="polite"
        >
          {error ?? message.text}
        </p>

        <div className="bjt-hands">
          {Array.from({ length: handCount }, (_, i) => (
            <HandPanel
              key={i}
              index={i}
              seat={state?.seats[i]}
              bet={bets[i]}
              chip={chip}
              betting={betting}
              busy={busy}
              active={Boolean(playing) && state?.activeSeat === i}
              activeHand={state?.activeHand ?? 0}
              bumped={bumped}
              dealing={dealing}
              faceUp={
                state?.seats[i]?.hands.map((_, h) => shown[pileOf(i, h)] ?? 0) ?? []
              }
              canCopy={handCount > 1}
              onNudge={nudge}
              onClear={clearHand}
              onCopyToAll={copyToAll}
            />
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      <div className="bjt-bar">
        <div className="bjt-group">
          <span className="k">Chip</span>
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className="bjt-chip"
              aria-label={`${c} coin chip`}
              aria-pressed={chip === c}
              onClick={() => setChip(c)}
            >
              {c}
            </button>
          ))}

          <span className="k" style={{ marginLeft: 8 }}>Hands</span>
          {Array.from({ length: MAX_SEATS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className="bjt-count"
              aria-label={`Play ${n} hand${n === 1 ? '' : 's'}`}
              aria-pressed={handCount === n}
              disabled={!betting || busy}
              /* Changing the count no longer wipes what is already staked.
                 The deal only ever sends the hands in play, so a stake on a
                 hand that has been dialled away simply is not sent — and it is
                 still there if the count goes back up. */
              onClick={() => setHandCount(n)}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="bjt-acts">
          {betting ? (
            <>
              <button type="button" className="btn ghost" onClick={clearAll} disabled={busy || staged === 0}>
                Clear all
              </button>
              <button type="button" className="btn" onClick={rebet} disabled={busy || !lastBets}>
                Rebet
              </button>
              <button type="button" className="btn pri" onClick={deal} disabled={dealBlocked}>
                {dealLabel}
              </button>
            </>
          ) : (
            <>
              {actions.includes('split') ? (
                <button type="button" className="btn" onClick={() => act('split')} disabled={busy || dealing}>
                  Split
                </button>
              ) : null}
              {actions.includes('double') ? (
                <button type="button" className="btn gold" onClick={() => act('double')} disabled={busy || dealing}>
                  Double
                </button>
              ) : null}
              <button type="button" className="btn" onClick={() => act('stand')} disabled={busy || dealing}>
                Stand
              </button>
              <button type="button" className="btn pri" onClick={() => act('hit')} disabled={busy || dealing}>
                Hit
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      <details className="bjt-ref">
        <summary>Paytables &amp; house rules</summary>
        <div className="bjt-refgrid">
          <Reference
            title="21 + 3"
            rows={Object.entries(TWENTY_ONE_PLUS_THREE).map(
              ([k, v]) => [PLUS_THREE_LABELS[k] ?? k, mult(v)] as [string, string],
            )}
          />
          <Reference
            title="Perfect pairs"
            rows={Object.entries(PERFECT_PAIRS).map(
              ([k, v]) => [PAIR_LABELS[k] ?? k, mult(v)] as [string, string],
            )}
          />
          <Reference
            title="Table"
            rows={HOUSE_RULES.map((r) => [r.label, r.value] as [string, string])}
            note={`Stakes of ${limits.minBet}–${limits.maxBet} MC across all hands. Both side bets return 99%, the same as every other game here. Insurance is not offered — at 2:1 it returns 92.6%, and priced fairly it is exactly neutral.`}
          />
        </div>
      </details>

      {/* The commitment, unchanged — it is what makes the shoe checkable. */}
      <div style={{ padding: '0 0 2px' }}>
        <FairnessDrawer
          state={view ? {
            serverSeedHash: view.serverSeedHash,
            clientSeed: view.clientSeed,
            nonce: view.nonce,
            balance: view.balance,
            wageredToday: 0,
            netToday: 0,
            rounds: [],
          } : null}
          game="blackjack"
          onRotate={async () => { await load(); }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* One hand                                                                   */
/* -------------------------------------------------------------------------- */

function HandPanel({
  index,
  seat,
  bet,
  chip,
  betting,
  busy,
  active,
  activeHand,
  bumped,
  dealing,
  faceUp,
  canCopy,
  onNudge,
  onClear,
  onCopyToAll,
}: {
  index: number;
  seat: RoundState['seats'][number] | undefined;
  bet: Bet;
  chip: number;
  betting: boolean;
  busy: boolean;
  active: boolean;
  activeHand: number;
  bumped: string | null;
  /** True while cards are still landing anywhere on the table. */
  dealing: boolean;
  /** How many of each of this seat's hands are face up. */
  faceUp: number[];
  canCopy: boolean;
  onNudge: (hand: number, spot: Spot, direction: 1 | -1) => void;
  onClear: (hand: number) => void;
  onCopyToAll: (hand: number) => void;
}) {
  /**
   * Bring this hand into view when it is the one to act.
   *
   * On a phone the hands are a horizontal scroller, so with three of them the
   * live hand is usually off-screen — and being told "hand 2 to act" while
   * hand 2 is somewhere to the right undoes the whole point of ringing it.
   * `inline: 'center'` slides the rail to it; `block: 'nearest'` means the
   * page itself only moves if the table is off-screen vertically too.
   */
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active) return;
    // A smooth scroll is dropped outright while the tab is hidden — so a hand
    // that becomes live while the player is in another app would still be off
    // to the right when they came back. Jumping straight there is correct in
    // that case, and it is what anyone asking for less motion wants anyway.
    const jump =
      document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    panel.current?.scrollIntoView({
      behavior: jump ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [active]);

  // While betting the stake rows show what is being built; once a round is on
  // the table they show what that hand actually has down. The settled hand
  // stays in `seat` until the next deal replaces it, which is what lets a
  // player read their result while staking the next round.
  const shown: Bet = betting
    ? bet
    : { main: seat?.main ?? 0, pairs: seat?.pairs ?? 0, plusThree: seat?.plusThree ?? 0 };

  // A verdict is only a verdict once the cards behind it are on the felt —
  // a hand announcing "Win" while the dealer is still drawing is exactly the
  // thing dealing a card at a time is meant to prevent. It stays readable
  // afterwards, through the next round's betting, which is how a player checks
  // what they just made.
  const decided = !dealing;
  const results = seat?.hands.map((h) => h.result) ?? [];
  const won = decided && !betting && results.length > 0 && results.every((r) => r === 'win');
  const lost = decided && !betting && results.length > 0 && results.every((r) => r === 'lose');

  const total = betTotal(shown);

  // Between rounds the stake rows go back to zero, which loses the one figure
  // a player wants at exactly that moment: what this hand had on it. So the
  // foot carries it until they start staking again — in the foot rather than
  // in the rows themselves, because a row showing last round's 30 above a "+"
  // that would set it to 10 is worse than not showing it at all.
  const settledStake = seat ? seat.main + seat.pairs + seat.plusThree : 0;
  const showLast = betting && total === 0 && settledStake > 0;

  return (
    <section
      ref={panel}
      className={`bjt-hand${active ? ' active' : ''}${won ? ' won' : ''}${lost ? ' lost' : ''}`}
      aria-label={`Hand ${index + 1}`}
    >
      <div className="bjt-hand-top">
        <span className="bjt-hand-name">
          <span className="bjt-no">{index + 1}</span>
          Hand {index + 1}
        </span>
        {active ? <span className="bjt-turn">Your turn</span> : null}
      </div>

      <div className="bjt-cards">
        {seat?.hands.length ? (
          seat.hands.map((hand, h) => {
            const cards = hand.cards.slice(0, faceUp[h] ?? 0);
            const value = handTotal(cards);
            const soft = isSoft(cards) && value <= 21;
            const focused = active && h === activeHand;
            return (
              <div key={h} className="bjt-split">
                <div className="row">
                  {cards.map((card, c) => (
                    /* `order` is left at zero while the round is being dealt:
                       the cards are already arriving one at a time, and the
                       stagger would delay each one a second time. */
                    <PlayingCard
                      key={`${card.r}${card.s}-${c}`}
                      card={card}
                      order={dealing ? 0 : c}
                    />
                  ))}
                </div>
                <div className="meta">
                  {cards.length ? (
                    <span
                      className={`bjt-total${value > 21 ? ' bust' : focused ? ' focus' : soft ? ' soft' : ''}`}
                    >
                      {soft ? `soft ${value}` : value}
                    </span>
                  ) : null}
                  {decided && hand.resultLabel ? (
                    <span className={`bjt-res ${hand.result ?? 'lose'}`}>{hand.resultLabel}</span>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <span className="bjt-empty">{betting ? 'Not dealt yet' : 'Sitting out'}</span>
        )}
      </div>

      {/* The side bets are read off the first two cards, so they are said once
          those two are down and not before. */}
      {seat?.notes.length && (faceUp[0] ?? 0) >= 2 ? (
        <div className="bjt-notes">
          {seat.notes.map((note) => (
            <span key={note} className={note.includes('+') ? 'hit' : undefined}>
              {note}
            </span>
          ))}
        </div>
      ) : null}

      {/* The stakes. Named, per hand, and adjustable one chip at a time — the
          three anonymous circles are what nobody could read. */}
      <div className="bjt-bets">
        {SPOTS.map(({ key, label, hint }) => {
          const amount = shown[key];
          const locked = !betting || busy;
          return (
            <div key={key} className={`bjt-bet spot-${key}`}>
              <span className="lbl" title={hint}>
                <s aria-hidden />
                {label}
              </span>
              <span
                className={`amt${amount === 0 ? ' zero' : ''}${bumped === `${index}:${key}` ? ' bumped' : ''}`}
              >
                {amount === 0 ? '—' : amount}
              </span>
              <button
                type="button"
                className="bjt-step"
                aria-label={`Take ${chip} off ${label} on hand ${index + 1}`}
                disabled={locked || amount === 0}
                onClick={() => onNudge(index, key, -1)}
              >
                −
              </button>
              <button
                type="button"
                className="bjt-step"
                aria-label={`Add ${chip} to ${label} on hand ${index + 1}`}
                disabled={locked}
                onClick={() => onNudge(index, key, 1)}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      <div className="bjt-hand-foot">
        {showLast ? (
          <span className="tot">
            Last round <b style={{ color: 'var(--muted)' }}>{coins(settledStake)}</b>
          </span>
        ) : (
          <span className="tot">
            {/* Just "stake": the panel is already titled with the hand's
                number, and repeating it wraps this line onto two on a phone. */}
            Stake <b>{total === 0 ? '0' : coins(total)}</b>
          </span>
        )}
        <span style={{ display: 'flex', gap: 6 }}>
          {canCopy ? (
            <button
              type="button"
              className="bjt-mini"
              disabled={!betting || busy || total === 0}
              onClick={() => onCopyToAll(index)}
              title="Copy this hand's stake onto every hand in play"
            >
              Same on all
            </button>
          ) : null}
          <button
            type="button"
            className="bjt-mini"
            disabled={!betting || busy || total === 0}
            onClick={() => onClear(index)}
          >
            Clear
          </button>
        </span>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const PLUS_THREE_LABELS: Record<string, string> = {
  suitedTrips: 'Suited trips',
  straightFlush: 'Straight flush',
  trips: 'Three of a kind',
  straight: 'Straight',
  flush: 'Flush',
};

const PAIR_LABELS: Record<string, string> = {
  perfect: 'Perfect pair',
  coloured: 'Coloured pair',
  mixed: 'Mixed pair',
};

function Reference({
  title,
  rows,
  note,
}: {
  title: string;
  rows: Array<[string, string]>;
  note?: string;
}) {
  return (
    <div>
      <h4>{title}</h4>
      {rows.map(([name, value]) => (
        <div key={name} className="bjt-row">
          <span>{name}</span>
          <b>{value}</b>
        </div>
      ))}
      {note ? <p className="bjt-note">{note}</p> : null}
    </div>
  );
}
