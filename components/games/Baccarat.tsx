'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { coins } from '@/lib/format';
import { LIMITS } from '@/lib/games';
import {
  BACCARAT_BETS, BACCARAT_LABELS, BACCARAT_PAYTABLE, BACCARAT_RULES,
  emptySpread, spreadTotal,
  type BaccaratBet, type BaccaratLine, type BaccaratOutcome, type BaccaratSpread,
} from '@/lib/baccarat';
import type { Card } from '@/lib/cards';
import { CoinMark } from '@/components/ui/marks';
import { publishBalance } from '@/lib/balance-bus';
import { readSoundPreference, sounds, writeSoundPreference } from '@/lib/sound';
import { FairnessDrawer, PlayingCard, SignInToPlay, useGame } from './shared';

/** The same ladder the blackjack table uses, so a chip means one thing here. */
const CHIPS = [1, 5, 10, 25, 50] as const;

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

  const balance = state?.balance ?? 0;
  const staked = spreadTotal(spread);

  // The header's coin pill is server-rendered and cannot see a round settle.
  const previous = useRef<number | null>(null);
  const [balanceMoved, setBalanceMoved] = useState(false);
  useEffect(() => {
    if (!state) return;
    publishBalance(state.balance);
    if (previous.current !== null && previous.current !== state.balance) {
      setBalanceMoved(true);
      const timer = setTimeout(() => setBalanceMoved(false), 460);
      previous.current = state.balance;
      return () => clearTimeout(timer);
    }
    previous.current = state.balance;
  }, [state]);

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
    setCoup(null);
    setReturned(null);

    const result = await play({ bet: staked, spread: placed });
    if (!result) return;

    const outcome = result.outcome as unknown as Coup;
    setCoup(outcome);
    setReturned(result.payout);
    setLastSpread(placed);
    setSpread(emptySpread());
    setHistory((prev) => [outcome.result, ...prev].slice(0, 24));

    if (soundOn) (result.payout > result.bet ? sounds.win(result.payout >= result.bet * 3) : sounds.settle());
  }

  if (signedOut) return <SignInToPlay game="Baccarat" />;

  const blocked =
    busy || !state || staked < limits.minBet || staked > balance || staked > limits.maxBet;

  const dealLabel =
    busy ? 'Dealing…'
    : !state ? 'Loading…'
    : staked === 0 ? 'Back a spot'
    : staked > balance ? 'Not enough coins'
    : staked > limits.maxBet ? `Table max is ${limits.maxBet}`
    : staked < limits.minBet ? `Table min is ${limits.minBet}`
    : `Deal · ${coins(staked)} MC`;

  const say =
    refusal ?? error ??
    (coup
      ? summarise(coup, returned ?? 0)
      : 'Back Player, Banker or Tie — the cards draw themselves from there.');

  const tone = refusal || error ? 'bad' : coup ? ((returned ?? 0) > 0 ? 'good' : 'bad') : '';

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
          <Side
            title="Player"
            cards={coup?.player}
            total={coup?.playerTotal}
            pair={coup?.playerPair}
            won={coup?.result === 'player'}
            tied={coup?.result === 'tie'}
          />

          <div className="bacc-verdict">
            <span className="bacc-vs">versus</span>
            {coup ? (
              <>
                <span className={`bacc-flag ${coup.result}`}>
                  {coup.result === 'tie' ? 'Tie' : `${BACCARAT_LABELS[coup.result]} wins`}
                </span>
                {coup.natural ? <span className="bacc-flag natural">Natural</span> : null}
              </>
            ) : null}
          </div>

          <Side
            title="Banker"
            cards={coup?.banker}
            total={coup?.bankerTotal}
            pair={coup?.bankerPair}
            won={coup?.result === 'banker'}
            tied={coup?.result === 'tie'}
          />
        </div>

        <p className={`bjt-say ${tone}`} role="status" aria-live="polite">
          {say}
        </p>

        <div className="bacc-spots">
          {BACCARAT_BETS.map((bet) => {
            const settledLine = coup?.lines.find((l) => l.bet === bet);
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
            {BACCARAT_PAYTABLE.map((row) => (
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
            {BACCARAT_PAYTABLE.map((row) => (
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
}: {
  title: string;
  cards?: Card[];
  total?: number;
  pair?: boolean;
  won?: boolean;
  tied?: boolean;
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
            <PlayingCard key={`${card.r}${card.s}-${i}`} card={card} order={i} big />
          ))
        ) : (
          <span className="bjt-empty">Waiting for bets</span>
        )}
      </div>

      <span className="bacc-score">{cards?.length ? total : '—'}</span>
    </section>
  );
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
