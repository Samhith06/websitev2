'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { coins } from '@/lib/format';
import { LIMITS } from '@/lib/games';
import {
  BACCARAT_LABELS, BACCARAT_LAYOUT, BACCARAT_PAYTABLE, BACCARAT_RULES,
  baccaratTotal, emptySpread, spreadTotal,
  type BaccaratBet, type BaccaratLine, type BaccaratOutcome, type BaccaratSpread,
} from '@/lib/baccarat';
import type { Card } from '@/lib/cards';
import { CoinMark } from '@/components/ui/marks';
import { publishBalance } from '@/lib/balance-bus';
import { readSoundPreference, sounds, writeSoundPreference } from '@/lib/sound';
import { FairnessDrawer, PlayingCard, SignInToPlay, useGame } from './shared';

/** The same ladder the blackjack table uses, so a chip means one thing here. */
const CHIPS = [1, 5, 10, 25, 50] as const;

/** The paytable, read in the order the spots sit on the felt. */
const feltOrder = BACCARAT_LAYOUT.map(
  (bet) => BACCARAT_PAYTABLE.find((row) => row.bet === bet)!,
);

/** What a settled coup looks like coming back off the wire. */
type Coup = {
  player: Card[];
  banker: Card[];
  playerTotal: number;
  bankerTotal: number;
  result: BaccaratOutcome;
  natural: boolean;
  playerPair: boolean;
  bankerPair: boolean;
  spread: BaccaratSpread;
  lines: BaccaratLine[];
};

/**
 * Baccarat.
 *
 * Nobody decides anything here once the cards are out — both hands are drawn by
 * a fixed table of rules — so the whole game is where the coins go beforehand,
 * and the layout gives that the room rather than the felt. Five spots, each
 * with its own stake, its own odds printed on it, and its own verdict after the
 * coup, so a player can always see which of their bets paid and which did not.
 *
 * The odds on those panels are not a casino's. Every one of the five is scaled
 * to return 99%, the figure the rest of the site advertises — a real table pays
 * between 85.6% and 98.9% depending on where you put the coins. The drawer at
 * the bottom prints both, because the comparison is the honest part.
 *
 * Nothing here decides an outcome. The spread goes up, the server draws the
 * coup from the round's seeds, and this renders what came back.
 */
export function Baccarat({ limits = LIMITS }: { limits?: { minBet: number; maxBet: number } }) {
  const { state, busy, error, signedOut, play, rotate } = useGame('baccarat');

  const [chip, setChip] = useState<number>(10);
  const [spread, setSpread] = useState<BaccaratSpread>(emptySpread);
  const [lastSpread, setLastSpread] = useState<BaccaratSpread | null>(null);
  const [coup, setCoup] = useState<Coup | null>(null);
  const [returned, setReturned] = useState<number | null>(null);
  /**
   * How many of the coup's cards are face up.
   *
   * The server settles the whole coup in one request — it has to, because the
   * drawing rules leave nobody a decision — but landing all six cards at once
   * throws the result away in a single frame. So the answer is held and turned
   * over a card at a time, in the order a dealer turns them.
   *
   * Everything that gives the ending away waits on this: the winner, the
   * per-spot verdicts, the balance, the bead. The cards are all the player has
   * until the last one lands, which is the entire point.
   */
  const [shown, setShown] = useState(0);
  const revealTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [history, setHistory] = useState<BaccaratOutcome[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [bumped, setBumped] = useState<BaccaratBet | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => setSoundOn(readSoundPreference()), []);

  /**
   * Marks one stake as just-changed, then unmarks it. The clearing is the part
   * that matters: a CSS animation only plays when the class arrives, so
   * leaving it on means the second nudge of the same spot does not animate —
   * which reads as the button having missed.
   */
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashBump = useCallback((bet: BaccaratBet) => {
    if (bumpTimer.current) clearTimeout(bumpTimer.current);
    setBumped(null);
    requestAnimationFrame(() => setBumped(bet));
    bumpTimer.current = setTimeout(() => setBumped(null), 400);
  }, []);

  useEffect(() => () => { if (bumpTimer.current) clearTimeout(bumpTimer.current); }, []);

  /**
   * The order a dealer turns them: player, banker, player, banker, then the
   * third cards — the player's before the banker's, because that is the order
   * they were drawn and the banker's decision depends on it.
   */
  const dealOrder = (c: Coup): Array<'p' | 'b'> => {
    const order: Array<'p' | 'b'> = ['p', 'b', 'p', 'b'];
    if (c.player.length > 2) order.push('p');
    if (c.banker.length > 2) order.push('b');
    return order;
  };

  const clearReveal = useCallback(() => {
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];
  }, []);

  useEffect(() => clearReveal, [clearReveal]);

  /** Turn everything face up at once — the skip button, and reduced motion. */
  const revealAll = useCallback((c: Coup) => {
    clearReveal();
    setShown(c.player.length + c.banker.length);
  }, [clearReveal]);

  /**
   * Turn them over on a timer.
   *
   * The opening four go at a steady clip because none of them is a decision —
   * they are dealt, not drawn. The pause before a third card is twice as long
   * on purpose: that card is the only moment in the game where anything is
   * still open, so it is the one worth waiting on. A coup that ends on a
   * natural is over in about a second and a half; the longest possible one
   * takes just under three.
   */
  const revealSlowly = useCallback((c: Coup) => {
    clearReveal();
    setShown(0);
    const order = dealOrder(c);
    let at = 0;
    order.forEach((_, i) => {
      at += i >= 4 ? 800 : 340;
      revealTimers.current.push(setTimeout(() => setShown(i + 1), at));
    });
  }, [clearReveal]);

  const staked = spreadTotal(spread);

  /**
   * The bead, the sound and the ledger line, once the last card is down.
   *
   * Driven off the reveal rather than the response, so the record of the coup
   * never appears before the coup does.
   */
  const settledCoup = coup && shown >= coup.player.length + coup.banker.length ? coup : null;
  const logged = useRef<Coup | null>(null);
  useEffect(() => {
    if (!settledCoup || logged.current === settledCoup) return;
    logged.current = settledCoup;
    setHistory((prev) => [settledCoup.result, ...prev].slice(0, 24));
    if (!soundOn) return;
    const paid = returned ?? 0;
    const stake = spreadTotal(settledCoup.spread);
    if (paid > stake) sounds.win(paid >= stake * 3);
    else sounds.settle();
  }, [settledCoup, returned, soundOn]);

  // How much of each hand is face up. Everything on screen reads from these
  // rather than from the coup, so nothing can leak a card that has not landed.
  const order = coup ? dealOrder(coup) : [];
  const facing = order.slice(0, shown);
  const playerUp = coup ? coup.player.slice(0, facing.filter((x) => x === 'p').length) : [];
  const bankerUp = coup ? coup.banker.slice(0, facing.filter((x) => x === 'b').length) : [];
  const revealing = Boolean(coup) && !settledCoup;

  /**
   * The balance the player should be looking at.
   *
   * The server moved it the moment the coup settled, so printing it straight
   * would announce the result while the cards are still coming — a jump up is
   * a win before anybody has seen one. While a reveal is running the
   * settlement is subtracted back out, which lands on the real figure the
   * instant the last card does, with no snapshot to keep in step.
   */
  const settlement = revealing && coup ? (returned ?? 0) - spreadTotal(coup.spread) : 0;
  const balance = (state?.balance ?? 0) - settlement;

  // The header's coin pill is server-rendered and cannot see a round settle,
  // so it is told every figure this table shows. It is told the *held* one:
  // publishing the settled balance mid-reveal would announce the result in the
  // page header while the cards were still coming.
  const previous = useRef<number | null>(null);
  const [balanceMoved, setBalanceMoved] = useState(false);
  useEffect(() => {
    if (!state) return;
    publishBalance(balance);
    if (previous.current !== null && previous.current !== balance) {
      setBalanceMoved(true);
      const timer = setTimeout(() => setBalanceMoved(false), 460);
      previous.current = balance;
      return () => clearTimeout(timer);
    }
    previous.current = balance;
  }, [state, balance]);

  /* ---------------------------------------------------------------------- */

  function nudge(bet: BaccaratBet, direction: 1 | -1) {
    if (busy) return;

    // Decided out here rather than inside the updater: an updater that also
    // sets error state runs twice in development, and it should only ever be
    // the arithmetic.
    if (direction > 0) {
      if (staked + chip > balance) {
        setRefusal('Not enough coins for that chip.');
        return;
      }
      if (staked + chip > limits.maxBet) {
        setRefusal(`The table takes at most ${limits.maxBet} MC across all spots.`);
        return;
      }
    } else if (spread[bet] === 0) {
      return;
    }

    const step = direction > 0 ? chip : Math.min(chip, spread[bet]);
    setSpread((prev) => ({ ...prev, [bet]: prev[bet] + step * direction }));
    setRefusal(null);
    flashBump(bet);
    if (soundOn) sounds.pick();
  }

  function clearAll() {
    setSpread(emptySpread());
    setRefusal(null);
  }

  function rebet() {
    if (!lastSpread) return;
    if (spreadTotal(lastSpread) > balance) {
      setRefusal('Not enough coins to back that again.');
      return;
    }
    setSpread({ ...lastSpread });
    setRefusal(null);
  }

  async function deal() {
    if (blocked) return;
    const placed = { ...spread };

    // The coup on the table belongs to the round just played, so it comes down
    // before the next one goes up — a stale hand under a fresh bet is how a
    // player misreads which round they are looking at.
    clearReveal();
    setShown(0);
    setCoup(null);
    setReturned(null);

    const result = await play({ bet: staked, spread: placed });
    if (!result) return;

    const outcome = result.outcome as unknown as Coup;
    setCoup(outcome);
    setReturned(result.payout);
    setLastSpread(placed);
    setSpread(emptySpread());

    // Anyone who has asked their system to stop moving things gets the answer
    // straight away rather than a suspense they did not want.
    const still =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still) revealAll(outcome);
    else revealSlowly(outcome);
  }


  if (signedOut) return <SignInToPlay game="Baccarat" />;

  const blocked =
    busy || revealing || !state || staked < limits.minBet || staked > balance || staked > limits.maxBet;

  const dealLabel =
    revealing ? 'Dealing…'
    : busy ? 'Dealing…'
    : !state ? 'Loading…'
    : staked === 0 ? 'Back a spot'
    : staked > balance ? 'Not enough coins'
    : staked > limits.maxBet ? `Table max is ${limits.maxBet}`
    : staked < limits.minBet ? `Table min is ${limits.minBet}`
    : `Deal · ${coins(staked)} MC`;

  const say =
    refusal ?? error ??
    (settledCoup ? summarise(settledCoup, returned ?? 0)
    : revealing ? dealingLine(playerUp.length, bankerUp.length)
    : 'Back Player, Banker or Tie — the cards draw themselves from there.');

  const tone =
    refusal || error ? 'bad'
    : settledCoup ? ((returned ?? 0) > 0 ? 'good' : 'bad')
    : revealing ? 'turn'
    : '';

  return (
    <div className="bjt">
      {/* ================================================================== */}
      <header className="bjt-head">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <h2>Baccarat</h2>
          <span className="bjt-rules">Punto banco · eight decks · every spot returns 99%</span>
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
            <span className="k">On the table</span>
            <span className="v">{coins(staked)}</span>
          </div>

          <div className="bjt-fig">
            <span className="k">Balance</span>
            <span className={`v money${balanceMoved ? ' bumped' : ''}`}>
              <CoinMark size={14} />
              {state ? coins(balance) : '—'}
            </span>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      <div className="bacc-felt">
        <div className="bacc-hands">
          {/* Totals are counted off the cards that are actually face up, not
              read off the coup — otherwise the score announces a card before
              it lands. A pair is only a pair once both cards are down. */}
          <Side
            title="Player"
            cards={playerUp}
            total={baccaratTotal(playerUp)}
            pair={playerUp.length >= 2 && Boolean(coup?.playerPair)}
            won={settledCoup?.result === 'player'}
            tied={settledCoup?.result === 'tie'}
            dealing={revealing}
          />

          <div className="bacc-verdict">
            <span className="bacc-vs">versus</span>
            {settledCoup ? (
              <>
                <span className={`bacc-flag ${settledCoup.result}`}>
                  {settledCoup.result === 'tie' ? 'Tie' : `${BACCARAT_LABELS[settledCoup.result]} wins`}
                </span>
                {settledCoup.natural ? <span className="bacc-flag natural">Natural</span> : null}
              </>
            ) : revealing && coup ? (
              <button type="button" className="bjt-mini" onClick={() => revealAll(coup)}>
                Skip
              </button>
            ) : null}
          </div>

          <Side
            title="Banker"
            cards={bankerUp}
            total={baccaratTotal(bankerUp)}
            pair={bankerUp.length >= 2 && Boolean(coup?.bankerPair)}
            won={settledCoup?.result === 'banker'}
            tied={settledCoup?.result === 'tie'}
            dealing={revealing}
          />
        </div>

        <p className={`bjt-say ${tone}`} role="status" aria-live="polite">
          {say}
        </p>

        <div className="bacc-spots">
          {BACCARAT_LAYOUT.map((bet) => {
            // Off `settledCoup`, not `coup`: a spot that reads "Paid 133"
            // while the third card is still in the air has given the game away.
            const settledLine = settledCoup?.lines.find((l) => l.bet === bet);
            const odds = BACCARAT_PAYTABLE.find((p) => p.bet === bet)!;
            // Once a coup is on the table it shows what that spot actually
            // had down and what it did; a fresh stake replaces it.
            const showSettled = Boolean(settledLine) && spread[bet] === 0;
            const amount = showSettled ? settledLine!.staked : spread[bet];

            return (
              <div
                key={bet}
                className={[
                  'bacc-spot',
                  `k-${bet}`,
                  amount > 0 ? 'staked' : '',
                  showSettled ? (settledLine!.result === 'lose' ? 'miss' : 'hit') : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="bacc-spot-top">
                  <span className="name">
                    <s aria-hidden />
                    {BACCARAT_LABELS[bet]}
                  </span>
                  <span className="odds">{odds.pays}</span>
                </div>

                <div className="bacc-stake">
                  <button
                    type="button"
                    className="bjt-step"
                    aria-label={`Take ${chip} off ${BACCARAT_LABELS[bet]}`}
                    disabled={busy || spread[bet] === 0}
                    onClick={() => nudge(bet, -1)}
                  >
                    −
                  </button>
                  <span
                    className={`amt${amount === 0 ? ' zero' : ''}${bumped === bet && spread[bet] > 0 ? ' bumped' : ''}`}
                  >
                    {amount === 0 ? '—' : amount}
                  </span>
                  <button
                    type="button"
                    className="bjt-step"
                    aria-label={`Add ${chip} to ${BACCARAT_LABELS[bet]}`}
                    disabled={busy}
                    onClick={() => nudge(bet, 1)}
                  >
                    +
                  </button>
                </div>

                {showSettled ? (
                  <span className={`verdict ${settledLine!.result}`}>
                    {settledLine!.result === 'win'
                      ? `Paid ${coins(settledLine!.returned)}`
                      : settledLine!.result === 'push'
                        ? 'Stake returned'
                        : 'Lost'}
                  </span>
                ) : (
                  <span className="bacc-hint">{odds.note}</span>
                )}
              </div>
            );
          })}
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
        </div>

        <div className="bjt-acts">
          <button type="button" className="btn ghost" onClick={clearAll} disabled={busy || staked === 0}>
            Clear
          </button>
          <button type="button" className="btn" onClick={rebet} disabled={busy || !lastSpread}>
            Rebet
          </button>
          <button type="button" className="btn pri" onClick={deal} disabled={blocked}>
            {dealLabel}
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {history.length ? (
        <div className="bacc-road">
          <span className="k">This session</span>
          <div className="bacc-beads">
            {history.map((r, i) => (
              <span key={i} className={`bacc-bead ${r}`} title={BACCARAT_LABELS[r]}>
                {r === 'player' ? 'P' : r === 'banker' ? 'B' : 'T'}
              </span>
            ))}
          </div>
          <p className="note">
            A record, not a signal. Every coup is dealt from its own freshly shuffled
            shoe, so nothing above changes what comes next.
          </p>
        </div>
      ) : null}

      <details className="bjt-ref">
        <summary>Paytable &amp; house rules</summary>
        <div className="bjt-refgrid">
          <div>
            <h4>What this table pays</h4>
            {feltOrder.map((row) => (
              <div key={row.bet} className="bjt-row">
                <span>{row.label}</span>
                <b>{row.pays}</b>
              </div>
            ))}
            <p className="bjt-note">
              Every one of those returns 99%, the figure printed on every game here.
            </p>
          </div>

          <div>
            <h4>What a casino pays</h4>
            {feltOrder.map((row) => (
              <div key={row.bet} className="bjt-row">
                <span>{row.label}</span>
                <b>{row.casino}</b>
              </div>
            ))}
            <p className="bjt-note">
              Which returns 98.76% on Player, 98.94% on Banker, 85.64% on Tie and 89.64%
              on a pair. Tie and the pairs are where a real table makes its money, and
              they are the two that move most here.
            </p>
          </div>

          <div>
            <h4>Table</h4>
            {BACCARAT_RULES.map((rule) => (
              <div key={rule.label} className="bjt-row">
                <span>{rule.label}</span>
                <b>{rule.value}</b>
              </div>
            ))}
            <p className="bjt-note">
              Stakes of {limits.minBet}–{limits.maxBet} MC across all spots. The drawing
              rules are the standard ones exactly — no decision reaches either hand, so
              the seeds fix every card before one is turned.
            </p>
          </div>
        </div>
      </details>

      <div style={{ padding: '0 0 2px' }}>
        <FairnessDrawer state={state} game="baccarat" onRotate={rotate} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Side({
  title,
  cards,
  total,
  pair,
  won,
  tied,
  dealing,
}: {
  title: string;
  cards?: Card[];
  total?: number;
  pair?: boolean;
  won?: boolean;
  tied?: boolean;
  /** A coup is on its way but this side has nothing face up yet. */
  dealing?: boolean;
}) {
  return (
    <section className={`bacc-side${won ? ' won' : ''}${tied ? ' tied' : ''}`} aria-label={title}>
      <div className="who">
        {title}
        {pair ? <span className="bacc-pair">Pair</span> : null}
      </div>

      <div className="bacc-row">
        {cards?.length ? (
          cards.map((card, i) => (
            /* `order` is left at zero: these arrive one at a time already, and
               the stagger meant for a hand dealt in one go would hold each
               card back a second time after it had been turned. */
            <PlayingCard key={`${card.r}${card.s}-${i}`} card={card} big />
          ))
        ) : (
          <span className="bjt-empty">{dealing ? 'Dealing…' : 'Waiting for bets'}</span>
        )}
      </div>

      <span className="bacc-score">{cards?.length ? total : '—'}</span>
    </section>
  );
}

/**
 * What the strip says while the cards are still coming.
 *
 * It narrates the deal without ever getting ahead of it — naming the card that
 * has just landed, and saying plainly when the hand is waiting on a third.
 */
function dealingLine(playerUp: number, bankerUp: number): string {
  const down = playerUp + bankerUp;
  if (down === 0) return 'Dealing.';
  if (down < 4) return down % 2 === 1 ? 'Player…' : 'Banker…';
  if (down === 4) return 'Player and banker are down. Anyone for a third?';
  if (down === 5) return playerUp === 3 ? 'Player takes a third…' : 'Banker takes a third…';
  return 'Banker takes a third…';
}

/** One line about the coup, in the order a dealer would say it. */
function summarise(coup: Coup, paid: number): string {
  const head =
    coup.result === 'tie'
      ? `Tie on ${coup.playerTotal}.`
      : `${BACCARAT_LABELS[coup.result]} wins, ${Math.max(coup.playerTotal, coup.bankerTotal)} to ${Math.min(coup.playerTotal, coup.bankerTotal)}.`;
  const natural = coup.natural ? ' Natural — no third card.' : '';
  const money = paid > 0 ? ` Paid ${coins(paid)} MC.` : ' Nothing back on that one.';
  return head + natural + money;
}
