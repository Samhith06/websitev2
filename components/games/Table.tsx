'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { coins } from '@/lib/format';
import {
  DICE_MAX_CHANCE,
  DICE_MIN_CHANCE,
  KENO_MAX_PICKS,
  KENO_RISKS,
  KENO_RISK_LABELS,
  WHEELS,
  WHEEL_RISKS,
  WHEEL_RISK_LABELS,
  diceChance,
  diceMultiplier,
  kenoPaytable,
  wheelHitChance,
  wheelTopPayout,
} from '@/lib/games';
import { useGame } from './shared';
import type { KenoRisk, WheelRisk } from '@/lib/games';
import type { GameSlug } from '@/lib/types';

/**
 * The four game tables, sharing one frame.
 *
 * Nothing here decides an outcome. Every control assembles a request, the
 * server draws the result from the round's seeds, and the animation below
 * simply lands on the answer that came back — which is why each one is timed to
 * finish on a value it was given rather than one it chose.
 */
export function GameTable({ slug }: { slug: 'dice' | 'limbo' | 'wheel' | 'keno' }) {
  const { state, busy, error, signedOut, play, rotate } = useGame(slug as GameSlug);
  const [bet, setBet] = useState(10);

  if (signedOut) {
    return (
      <div className="gate">
        <h2>Sign in to play</h2>
        <p>Games are played entirely with Matty Coins earned from watching the stream.</p>
        <a className="btn pri discord" href={`/api/auth/signin?callbackUrl=/games/${slug}`}>
          Sign in with Discord
        </a>
      </div>
    );
  }

  // Null until the seed request lands. It is passed through as null rather
  // than coerced to 0, because "we don't know yet" and "you have nothing" want
  // different words on screen — the second is alarming and, for the first
  // second of every page load, untrue.
  const balance = state?.balance ?? null;

  return (
    <div className="gframe">
      <ControlPanel
        slug={slug}
        bet={bet}
        setBet={setBet}
        balance={balance}
        busy={busy}
        error={error}
        play={play}
        state={state}
        rotate={rotate}
      />
      <History state={state} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

type Play = ReturnType<typeof useGame>['play'];
type State = ReturnType<typeof useGame>['state'];

function ControlPanel({
  slug,
  bet,
  setBet,
  balance,
  busy,
  error,
  play,
  state,
  rotate,
}: {
  slug: 'dice' | 'limbo' | 'wheel' | 'keno';
  bet: number;
  setBet: (n: number) => void;
  balance: number | null;
  busy: boolean;
  error: string | null;
  play: Play;
  state: State;
  rotate: () => void;
}) {
  /* --- per-game control state ------------------------------------------ */
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<'over' | 'under'>('under');
  const [limboTarget, setLimboTarget] = useState('2.00');
  const [wheelRisk, setWheelRisk] = useState<WheelRisk>('medium');
  const [kenoRisk, setKenoRisk] = useState<KenoRisk>('classic');
  const [picks, setPicks] = useState<number[]>([]);

  /* --- animation state -------------------------------------------------- */
  const [display, setDisplay] = useState<string>('—');
  const [tone, setTone] = useState<'idle' | 'win' | 'lose'>('idle');
  const [spinDeg, setSpinDeg] = useState(0);
  const [revealed, setRevealed] = useState<{ drawn: number[]; hits: number[] } | null>(null);
  const [flash, setFlash] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Every animation is a pile of timeouts. Leaving them running after the
  // component goes away would set state on something unmounted and, worse,
  // reveal the tail of a round the player has navigated away from.
  useEffect(() => {
    const list = timers.current;
    return () => {
      for (const t of list) clearTimeout(t);
    };
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  const chance = diceChance(target, direction);
  const diceMult = diceMultiplier(chance);
  const limboNum = Math.max(1.01, Number(limboTarget) || 1.01);
  const kenoRow = picks.length ? kenoPaytable(kenoRisk, picks.length) : null;

  function adjust(op: 'half' | 'double' | 'max' | 'min') {
    const cap = balance ?? bet;
    const next =
      op === 'max' ? cap : op === 'min' ? 10 : op === 'half' ? Math.floor(bet / 2) : bet * 2;
    setBet(Math.max(1, Math.min(next, Math.max(cap, 1))));
  }

  async function submit() {
    if (busy) return;
    setTone('idle');
    setRevealed(null);
    setLabel(null);

    const payload =
      slug === 'dice'
        ? { bet, target, direction }
        : slug === 'limbo'
          ? { bet, target: limboNum }
          : slug === 'wheel'
            ? { bet, risk: wheelRisk }
            : { bet, risk: kenoRisk, picks };

    const result = await play(payload);
    if (!result) return;

    const won = result.payout > 0;
    const big = won && result.payout >= result.bet * 4;

    if (slug === 'dice') {
      const roll = Number(result.outcome.roll);
      // A short tumble, then the number the server already decided.
      for (let i = 0; i < 9; i++) {
        later(() => setDisplay((Math.random() * 100).toFixed(2)), i * 42);
      }
      later(() => {
        setDisplay(roll.toFixed(2));
        setTone(won ? 'win' : 'lose');
        if (big) setFlash(true);
      }, 400);
    }

    if (slug === 'limbo') {
      const crash = Number(result.outcome.result);
      for (let i = 1; i <= 16; i++) {
        later(() => setDisplay((1 + ((crash - 1) * i) / 16).toFixed(2) + '×'), i * 44);
      }
      later(() => {
        setDisplay(crash.toFixed(2) + '×');
        setTone(won ? 'win' : 'lose');
        if (big) setFlash(true);
      }, 16 * 44 + 40);
    }

    if (slug === 'wheel') {
      const index = Number(result.outcome.index);
      const segments = WHEELS[wheelRisk];
      const step = 360 / segments.length;
      // Six whole turns, then stop with the pointer over the winning segment.
      setSpinDeg((prev) => {
        const base = Math.ceil(prev / 360) * 360;
        return base + 360 * 6 + (360 - (index * step + step / 2));
      });
      setDisplay('—');
      later(() => {
        setDisplay(`${segments[index]}×`);
        setTone(won ? 'win' : 'lose');
        if (big) setFlash(true);
      }, 4300);
    }

    if (slug === 'keno') {
      const drawn = result.outcome.drawn as number[];
      const hits = result.outcome.hits as number[];
      setLabel('Drawing…');
      drawn.forEach((_, i) => {
        later(() => setRevealed({ drawn: drawn.slice(0, i + 1), hits }), 140 + i * 115);
      });
      later(
        () => {
          setLabel(
            `${hits.length} of ${picks.length} matched · ${
              result.multiplier ? `${result.multiplier}×` : 'no win'
            }`,
          );
          setTone(won ? 'win' : 'lose');
          if (big) setFlash(true);
        },
        140 + drawn.length * 115,
      );
    }
  }

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [flash]);

  const loading = balance === null;
  const overBalance = balance !== null && bet > balance;
  const canPlay = !loading && bet >= 1 && !overBalance && (slug !== 'keno' || picks.length > 0);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Controls                                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="gpanel">
        <div className="field">
          <label htmlFor="bet">Bet amount</label>
          <input
            id="bet"
            className="inp"
            type="number"
            min={1}
            value={bet}
            onChange={(e) => setBet(Math.max(1, Number(e.target.value) || 1))}
          />
          <div className="betrow">
            <button type="button" onClick={() => adjust('half')}>
              ½
            </button>
            <button type="button" onClick={() => adjust('double')}>
              2×
            </button>
            <button type="button" onClick={() => adjust('max')}>
              Max
            </button>
            <button type="button" onClick={() => adjust('min')}>
              Min
            </button>
          </div>
        </div>

        {slug === 'dice' ? (
          <>
            <div className="field">
              <label htmlFor="dice-dir">Direction</label>
              <select
                id="dice-dir"
                className="inp"
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'over' | 'under')}
              >
                <option value="under">Roll under</option>
                <option value="over">Roll over</option>
              </select>
            </div>
            <div className="readout">
              <span>Win chance</span>
              <b>{chance.toFixed(2)}%</b>
            </div>
            <div className="readout">
              <span>Multiplier</span>
              <b>{diceMult.toFixed(2)}×</b>
            </div>
          </>
        ) : null}

        {slug === 'limbo' ? (
          <>
            <div className="field">
              <label htmlFor="limbo-target">Target multiplier</label>
              <input
                id="limbo-target"
                className="inp"
                type="number"
                step="0.01"
                min="1.01"
                value={limboTarget}
                onChange={(e) => setLimboTarget(e.target.value)}
              />
            </div>
            <div className="readout">
              <span>Win chance</span>
              <b>{(99 / limboNum).toFixed(2)}%</b>
            </div>
          </>
        ) : null}

        {slug === 'wheel' ? (
          <>
            <div className="field">
              <label htmlFor="wheel-risk">Risk</label>
              <select
                id="wheel-risk"
                className="inp"
                value={wheelRisk}
                onChange={(e) => setWheelRisk(e.target.value as WheelRisk)}
              >
                {WHEEL_RISKS.map((r) => (
                  <option key={r} value={r}>
                    {WHEEL_RISK_LABELS[r]} · up to {wheelTopPayout(r)}×
                  </option>
                ))}
              </select>
            </div>
            <div className="readout">
              <span>Segments</span>
              <b>{WHEELS[wheelRisk].length}</b>
            </div>
            <div className="readout">
              <span>Pays on</span>
              <b>{(wheelHitChance(wheelRisk) * 100).toFixed(1)}% of spins</b>
            </div>
            <div className="readout">
              <span>Top payout</span>
              <b>{wheelTopPayout(wheelRisk)}×</b>
            </div>
          </>
        ) : null}

        {slug === 'keno' ? (
          <>
            <div className="field">
              <label htmlFor="keno-risk">Risk</label>
              <select
                id="keno-risk"
                className="inp"
                value={kenoRisk}
                onChange={(e) => setKenoRisk(e.target.value as KenoRisk)}
              >
                {KENO_RISKS.map((r) => (
                  <option key={r} value={r}>
                    {KENO_RISK_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="readout">
              <span>Picks</span>
              <b>
                {picks.length} / {KENO_MAX_PICKS}
              </b>
            </div>
            <div className="readout">
              <span>Max payout</span>
              <b>{kenoRow ? `${Math.max(...kenoRow)}×` : '—'}</b>
            </div>
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <button
                type="button"
                className="btn sm wide"
                onClick={() => {
                  const n = picks.length || 5;
                  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
                  const next: number[] = [];
                  for (let i = 0; i < n; i++) {
                    next.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
                  }
                  setPicks(next);
                  setRevealed(null);
                }}
              >
                Auto pick
              </button>
              <button
                type="button"
                className="btn sm wide ghost"
                onClick={() => {
                  setPicks([]);
                  setRevealed(null);
                  setLabel(null);
                }}
              >
                Clear
              </button>
            </div>
            <KenoPaytable risk={kenoRisk} picks={picks.length} />
          </>
        ) : null}

        <button
          className="btn pri wide"
          style={{ marginTop: 14 }}
          onClick={submit}
          disabled={busy || !canPlay}
        >
          {loading ? 'Loading…' : busy ? 'Playing…' : 'Place bet'}
        </button>

        {error ? (
          <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>
            {error}
          </div>
        ) : null}
        {overBalance ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            That is more than you have. Balance {coins(balance!)}.
          </div>
        ) : null}

        <Fairness state={state} rotate={rotate} />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Stage                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="gstage">
        <div className={`flash ${flash ? 'go' : ''}`} aria-hidden />

        {slug === 'dice' ? (
          <>
            <div className="stagelab">Roll result</div>
            <div className={`bighit ${tone}`}>{display === '—' ? '50.00' : display}</div>
            <div className="slider">
              <div className="strack">
                <div
                  className="lo"
                  style={{ width: `${direction === 'under' ? target : 100 - target}%` }}
                />
                <div
                  className="hi"
                  style={{ width: `${direction === 'under' ? 100 - target : target}%` }}
                />
              </div>
              <input
                type="range"
                min={DICE_MIN_CHANCE + 1}
                max={DICE_MAX_CHANCE}
                value={target}
                aria-label="Target"
                onChange={(e) => setTarget(Number(e.target.value))}
              />
              <div className="marker" style={{ left: `${target}%` }}>
                {target}
              </div>
            </div>
            <div className="scale">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </>
        ) : null}

        {slug === 'limbo' ? (
          <>
            <div className="stagelab">Crash point</div>
            <div className={`bighit ${tone}`}>{display === '—' ? '1.00×' : display}</div>
          </>
        ) : null}

        {slug === 'wheel' ? (
          <div className="wheelwrap">
            <div className="wheelbox">
              <div className="wheelptr" aria-hidden />
              <div
                className="wheeldisc"
                style={{
                  transform: `rotate(${spinDeg}deg)`,
                  background: `conic-gradient(${conic(WHEELS[wheelRisk])})`,
                }}
                aria-hidden
              />
              <div
                className="wheelhub"
                style={{
                  color:
                    tone === 'win' ? 'var(--gold)' : tone === 'lose' ? 'var(--red)' : 'var(--text)',
                }}
              >
                {display}
              </div>
            </div>
          </div>
        ) : null}

        {slug === 'keno' ? (
          <>
            <div className="stagelab">{label ?? `Pick up to ${KENO_MAX_PICKS} numbers`}</div>
            <div className="kgrid">
              {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
                const picked = picks.includes(n);
                const drawn = revealed?.drawn.includes(n) ?? false;
                const cls = drawn ? (picked ? 'hit' : 'miss') : picked ? 'pick' : '';
                return (
                  <button
                    key={n}
                    className={`kn ${cls}`}
                    disabled={busy}
                    onClick={() => {
                      setRevealed(null);
                      setLabel(null);
                      setPicks((p) =>
                        p.includes(n)
                          ? p.filter((x) => x !== n)
                          : p.length >= KENO_MAX_PICKS
                            ? p
                            : [...p, n],
                      );
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

/** The disc, painted from the same array the server pays from. */
function conic(segments: number[]): string {
  const step = 360 / segments.length;
  return segments
    .map((m, i) => {
      const colour =
        m === 0
          ? '#1E212B'
          : m < 1.6
            ? '#0E7C99'
            : m < 3
              ? '#22D3FF'
              : m < 6
                ? '#3DDC97'
                : '#FFD166';
      return `${colour} ${i * step}deg ${(i + 1) * step}deg`;
    })
    .join(',');
}

function KenoPaytable({ risk, picks }: { risk: KenoRisk; picks: number }) {
  const row = useMemo(() => (picks ? kenoPaytable(risk, picks) : null), [risk, picks]);

  return (
    <div className="paytable">
      {!row ? (
        <div className="ptnote">Pick numbers to see the paytable</div>
      ) : (
        <>
          <div className="pthead">
            {picks} pick{picks > 1 ? 's' : ''} · {KENO_RISK_LABELS[risk]}
          </div>
          <div className="ptrow">
            {row.map((value, hits) => (
              <div
                className={`pt ${value === 0 ? 'z' : value >= 50 ? 'hot' : ''}`}
                key={hits}
                title={`${hits} hits`}
              >
                <b>{hits}</b>
                <span>{value === 0 ? '—' : `${value}×`}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The provably fair drawer.
 *
 * The hash is shown before any of these rounds were played, and rotating
 * reveals the seed behind it. Without the reveal this panel would be
 * decoration, so the rotate button is the important control here, not the
 * client seed field.
 */
function Fairness({ state, rotate }: { state: State; rotate: () => void }) {
  if (!state) return null;

  return (
    <details className="fair">
      <summary>
        <span>Provably fair</span>
        <span className="chev">▾</span>
      </summary>
      <div className="fb">
        <div className="seed">
          <div className="sl">Server seed (hashed)</div>
          <div className="sv">{state.serverSeedHash}</div>
        </div>
        <div className="seed">
          <div className="sl">Client seed</div>
          <div className="sv">{state.clientSeed}</div>
        </div>
        <div className="seed">
          <div className="sl">Nonce</div>
          <div className="sv">{state.nonce}</div>
        </div>
        {state.previousServerSeed ? (
          <div className="seed">
            <div className="sl">Previous server seed — revealed</div>
            <div className="sv">{state.previousServerSeed}</div>
          </div>
        ) : null}
        <button className="btn sm wide" style={{ marginTop: 11 }} onClick={rotate}>
          Rotate seed &amp; reveal the old one
        </button>
        <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Rotating retires the current server seed and publishes it, so every round played under it
          can be recomputed. <a href="/verify">Check a round →</a>
        </p>
      </div>
    </details>
  );
}

function History({ state }: { state: State }) {
  const rounds = state?.rounds ?? [];
  return (
    <div className="gpanel">
      <h3 style={{ fontSize: 14, marginBottom: 11 }}>Your bets</h3>
      <div className="hist">
        {rounds.length === 0 ? (
          <div className="small muted">No bets yet this session.</div>
        ) : (
          rounds.map((round) => {
            const net = round.payout - round.bet;
            return (
              <div className={`hrow ${net >= 0 ? 'w' : 'l'}`} key={round.id}>
                <span className="hp">
                  {round.game} · {round.multiplier}×
                </span>
                <span className="ha">
                  {net >= 0 ? '+' : '−'}
                  {coins(Math.abs(net))}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
