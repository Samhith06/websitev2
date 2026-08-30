'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { coins, mult } from '@/lib/format';
import {
  KENO_BOARD, KENO_DRAWN, KENO_MAX_PICKS, KENO_RISKS, KENO_RISK_LABELS,
  LIMITS, kenoPaytable, kenoRtp,
} from '@/lib/games';
import type { KenoRisk } from '@/lib/games';
import { CoinMark } from '@/components/ui/marks';
import { readSoundPreference, sounds, writeSoundPreference } from '@/lib/sound';
import { FairnessDrawer, SignInToPlay, useGame } from './shared';

type Outcome = { drawn: number[]; picks: number[]; hits: number[]; risk: KenoRisk };

/**
 * Keno, rebuilt from the supplied Claude Design board.
 *
 * The design's layout is followed closely — a 292px control rail beside an
 * eight-across board, the history strip above it, the paytable as a flat row of
 * cells beneath — and four things in it are deliberately not carried over,
 * because each one would undo something this site has already decided:
 *
 *   • **Its paytables.** The design ships Stake's published tables. Ours are
 *     solved to 99% RTP and checked by `npm run check:rtp`, and pasting a
 *     different set of multipliers over them would quietly make the advertised
 *     figure untrue. The tables here still come from `lib/games.ts`.
 *   • **Its draw.** The design rolls the numbers in the browser with
 *     `Math.random()`. Ours are drawn on the server from a committed seed, so
 *     the round can be recomputed by anybody afterwards (§9).
 *   • **Its balance.** The design keeps a $1,000 float in `localStorage` with a
 *     Reset button. Ours is a real ledger balance, so there is nothing to reset
 *     and the figure is in Matty Coins — never dollars, because coins cannot be
 *     bought and a currency symbol would imply otherwise (Master Plan §12).
 *   • **Its green accent.** Blue is the only loud colour on this site and amber
 *     only ever means money, so hits are brand blue and the balance stays gold.
 */
export function Keno() {
  const { state, busy, error, signedOut, result, play, rotate } = useGame('keno');

  const [risk, setRisk] = useState<KenoRisk>('classic');
  const [picks, setPicks] = useState<number[]>([]);
  const [bet, setBet] = useState(20);
  const [pickCount, setPickCount] = useState(10);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // Keyed by a running count rather than the nonce, which restarts at zero
  // whenever the player rotates their seed mid-session.
  const [history, setHistory] = useState<Array<{ id: number; multiplier: number }>>([]);

  // Read the stored preference after mount so the server and first paint agree.
  useEffect(() => setSoundOn(readSoundPreference()), []);

  const outcome = result?.outcome as Outcome | undefined;
  const tableLength = Math.max(1, picks.length);
  const paytable = useMemo(() => kenoPaytable(risk, tableLength), [risk, tableLength]);
  const rtp = useMemo(() => kenoRtp(risk, tableLength), [risk, tableLength]);

  /** One number every 105ms, each with its own note. Under two seconds total. */
  useEffect(() => {
    if (!outcome) return;
    setRevealed([]);
    setRevealing(true);

    let hitsSoFar = 0;
    const timers: ReturnType<typeof setTimeout>[] = outcome.drawn.map((n, i) =>
      setTimeout(() => {
        setRevealed((prev) => [...prev, n]);
        if (soundOn) {
          if (outcome.picks.includes(n)) sounds.hit(hitsSoFar++);
          else sounds.draw(i);
        }
        if (i === outcome.drawn.length - 1) setRevealing(false);
      }, (i + 1) * 105),
    );

    // The round's verdict lands just after the last number, not on top of it.
    timers.push(
      setTimeout(() => {
        if (soundOn) {
          if (result && result.payout > 0) sounds.win(result.multiplier >= 10);
          else sounds.settle();
        }
        if (result) {
          setHistory((prev) =>
            [{ id: (prev[0]?.id ?? 0) + 1, multiplier: result.multiplier }, ...prev].slice(0, 12));
        }
      }, outcome.drawn.length * 105 + 200),
    );

    return () => timers.forEach(clearTimeout);
    // `result` is the settled round that produced this outcome, so it is stable here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, soundOn]);

  const locked = busy || revealing;
  const settled = Boolean(outcome) && !revealing;
  const hitCount = settled && outcome ? outcome.hits.length : null;

  function toggle(n: number) {
    if (locked) return;
    setPicks((prev) => {
      const removing = prev.includes(n);
      if (!removing && prev.length >= KENO_MAX_PICKS) {
        if (soundOn) sounds.unpick();
        return prev;
      }
      const next = removing ? prev.filter((p) => p !== n) : [...prev, n].sort((a, b) => a - b);
      if (soundOn) (removing ? sounds.unpick : sounds.pick)();
      setPickCount(Math.max(1, next.length));
      return next;
    });
  }

  function autoPick(count = pickCount) {
    if (locked) return;
    const pool = Array.from({ length: KENO_BOARD }, (_, i) => i + 1);
    const chosen: number[] = [];
    while (chosen.length < count) {
      chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    setPicks(chosen.sort((a, b) => a - b));
    if (soundOn) sounds.quickPick(count);
  }

  const balance = state?.balance ?? 0;
  const short = Boolean(state) && bet > balance;

  const playLabel =
    !state ? 'Loading'
    : locked ? 'Drawing…'
    : picks.length === 0 ? 'Pick 1–10 numbers'
    : short ? 'Not enough coins'
    : 'Place bet';
  const canPlay = Boolean(state) && !locked && picks.length > 0 && !short;

  if (signedOut) return <SignInToPlay game="Keno" />;

  return (
    <>
      {/* ================================================================== */}
      {/* Header — eyebrow, title, balance, sound                            */}
      {/* ================================================================== */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-7 gap-y-4 border-b border-line pb-4">
        {/* The page already carries the H1 and the RTP line, so this strip
            keeps the design's header without printing "Keno" twice. */}
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          {KENO_DRAWN} drawn from {KENO_BOARD}
        </span>

        <div className="flex items-end gap-6">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Balance
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[24px] font-medium leading-none tabular-nums text-gold">
              <CoinMark size={16} />
              {coins(balance)}
            </span>
          </div>

          {/* Labelled, not a bare glyph — an unlabelled speaker icon is how
              people miss that there is sound at all. */}
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              writeSoundPreference(next);
              if (next) sounds.pick();
            }}
            aria-pressed={soundOn}
            className={cn(
              'rounded-[8px] border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]',
              'transition-colors duration-150',
              soundOn
                ? 'border-brand-line bg-brand-bg text-brand'
                : 'border-line bg-bg text-faint hover:border-line-2 hover:text-ink-2',
            )}
          >
            {soundOn ? 'Sound on' : 'Sound off'}
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[292px_minmax(0,1fr)] lg:items-start">
        {/* ================================================================ */}
        {/* Control rail                                                     */}
        {/* ================================================================ */}
        <aside className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-5">
          {/* Bet amount */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Bet amount
            </label>
            <div className="flex items-center gap-2 rounded-[10px] border border-line-2 bg-bg py-1 pl-3 pr-1 transition-colors duration-150 focus-within:border-brand">
              <CoinMark size={14} />
              <input
                type="number"
                min={LIMITS.minBet}
                max={LIMITS.maxBet}
                value={bet}
                disabled={locked}
                aria-label="Bet amount"
                onChange={(e) => setBet(clampBet(Number(e.target.value)))}
                className="w-full min-w-0 flex-1 bg-transparent py-2 font-mono text-[15px] tabular-nums text-ink outline-none"
              />
              <div className="flex shrink-0 gap-1">
                <RailChip onClick={() => setBet(clampBet(Math.floor(bet / 2)))} disabled={locked}>½</RailChip>
                <RailChip onClick={() => setBet(clampBet(bet * 2))} disabled={locked}>2×</RailChip>
              </div>
            </div>
            <p className="font-mono text-[10px] text-faint">
              {LIMITS.minBet}–{LIMITS.maxBet} MC · max win {coins(LIMITS.maxWinPerRound)} MC
            </p>
          </div>

          {/* Risk — a 2×2 grid, each level carrying its own hue so the choice
              is legible without reading the label. */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Risk</span>
            <div className="grid grid-cols-2 gap-[7px]" role="tablist" aria-label="Risk level">
              {KENO_RISKS.map((level) => {
                const on = risk === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setRisk(level)}
                    className={cn(
                      'rounded-[10px] border px-3 py-2.5 text-left text-[13px] font-medium',
                      'transition-colors duration-150',
                      on
                        ? `${RISK_TONE[level].bg} ${RISK_TONE[level].border} text-ink`
                        : 'border-line-2 bg-bg text-muted hover:text-ink-2',
                    )}
                  >
                    {KENO_RISK_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Number picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Number picker
              </label>
              <button
                type="button"
                onClick={() => setPicks([])}
                disabled={locked || picks.length === 0}
                className="text-[12px] text-ink-2 underline underline-offset-[3px] transition-colors duration-150 hover:text-ink disabled:opacity-40"
              >
                Clear picks
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-[10px] border border-line-2 bg-bg py-2 pl-3 pr-2">
              <span className="min-w-[18px] font-mono text-[15px] tabular-nums text-ink">
                {picks.length || pickCount}
              </span>
              <input
                type="range"
                min={1}
                max={KENO_MAX_PICKS}
                value={pickCount}
                disabled={locked}
                aria-label="How many numbers to pick"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPickCount(v);
                  autoPick(v);
                }}
                className="h-1 min-w-0 flex-1 accent-[#2B8FFF]"
              />
              <button
                type="button"
                onClick={() => autoPick()}
                disabled={locked}
                className="shrink-0 rounded-[8px] border border-line-2 bg-surface-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-2 transition-colors duration-150 hover:text-ink disabled:opacity-40"
              >
                Pick
              </button>
            </div>
            <span
              className={cn(
                'font-mono text-[10px] tracking-[0.1em]',
                picks.length === KENO_MAX_PICKS ? 'text-brand' : 'text-muted',
              )}
            >
              {picks.length} / {KENO_MAX_PICKS} selected
            </span>
          </div>

          {error ? (
            <div className="rounded-[10px] border border-danger-line bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => play({ bet, picks, risk })}
            disabled={!canPlay}
            className={cn(
              'mt-0.5 rounded-[12px] py-4 text-[16px] font-semibold transition-[filter] duration-150',
              canPlay
                ? 'bg-brand text-brand-ink hover:brightness-110'
                : 'cursor-not-allowed bg-surface-2 text-muted',
            )}
          >
            {playLabel}
          </button>
        </aside>

        {/* ================================================================ */}
        {/* Board                                                            */}
        {/* ================================================================ */}
        <main className="flex min-w-0 flex-col gap-4">
          {/* History — limbo-style streak reading, but for multipliers. */}
          <div className="flex min-h-[30px] items-center gap-3">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              History
            </span>
            <div className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,#000_88%,transparent)]">
              {history.length === 0 ? (
                <span className="font-mono text-[11px] text-faint">No rounds yet this session</span>
              ) : (
                history.map((h) => (
                  <span
                    key={h.id}
                    className={cn(
                      'animate-keno-rise whitespace-nowrap rounded-[6px] px-2.5 py-1.5 font-mono text-[11px] tabular-nums',
                      h.multiplier >= 1 ? 'bg-brand-bg text-brand' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {mult(h.multiplier)}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* The board itself */}
          <div className="rounded-[16px] border border-line bg-surface p-4 sm:p-5">
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5 md:grid-cols-8">
              {Array.from({ length: KENO_BOARD }, (_, i) => i + 1).map((n) => {
                const picked = picks.includes(n);
                const drawn = revealed.includes(n);
                const hit = picked && drawn;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    disabled={locked}
                    aria-pressed={picked}
                    aria-label={
                      hit ? `${n}, hit` : drawn ? `${n}, drawn` : picked ? `${n}, picked` : `${n}`
                    }
                    className={cn(
                      'grid aspect-square select-none place-items-center rounded-[12px] border',
                      'font-mono text-[19px] font-medium tabular-nums',
                      'transition-[background-color,border-color,box-shadow] duration-150',
                      hit
                        ? 'animate-keno-pop border-brand bg-brand text-brand-ink shadow-[0_0_0_1px_rgba(43,143,255,0.33),0_6px_22px_-6px_rgba(43,143,255,0.67)]'
                        : drawn
                          ? 'animate-keno-miss border-line-2 bg-bg text-muted'
                          : picked
                            ? 'border-line-2 bg-surface-2 text-ink'
                            : 'border-line-2 bg-bg text-muted hover:border-line-2 hover:text-ink-2',
                      locked ? 'cursor-default' : 'cursor-pointer',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* -------------------------------------------------------- */}
          {/* Paytable — one cell per hit count, losing tiers included   */}
          {/* -------------------------------------------------------- */}
          <div className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface px-4 pb-4 pt-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {picks.length
                  ? `Payouts — ${picks.length} pick${picks.length === 1 ? '' : 's'}, ${KENO_RISK_LABELS[risk].toLowerCase()} risk`
                  : 'Payouts — select numbers to see the table'}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-faint">
                RTP {(rtp * 100).toFixed(2)}%
              </span>
            </div>

            <div className="no-scrollbar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1">
              {paytable.map((multiplier, hits) => {
                const active = hitCount === hits;
                const paying = multiplier > 0;
                return (
                  <div
                    key={hits}
                    className={cn(
                      'flex min-w-[52px] flex-1 flex-col items-center gap-px rounded-[8px] border px-1.5 py-1.5',
                      'transition-colors duration-150',
                      active
                        ? paying
                          ? 'border-brand bg-brand-bg'
                          : 'border-danger-line bg-danger-bg'
                        : 'border-line bg-bg',
                    )}
                  >
                    <span
                      className={cn(
                        'font-mono text-[9px] tracking-[0.04em]',
                        active ? 'text-ink-2' : 'text-muted',
                      )}
                    >
                      {hits}
                    </span>
                    <span
                      className={cn(
                        'whitespace-nowrap font-mono text-[12px] font-medium tabular-nums',
                        paying ? (active ? 'text-brand' : 'text-ink-2') : 'text-faint',
                      )}
                    >
                      {mult(multiplier)}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[12px] leading-relaxed text-muted">
              Every tier is shown, including the ones that pay nothing — on High you can hit five of
              six and win 0×, and that is worth knowing before the round rather than after it.
            </p>
          </div>
        </main>
      </div>

      <FairnessDrawer state={state} game="keno" onRotate={rotate} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A hue per risk level, following the design. Blue stays the site's own accent
 * and carries Classic; the other three borrow the tokens that already mean
 * "safe", "money" and "danger" elsewhere, so nothing new enters the palette.
 */
const RISK_TONE: Record<KenoRisk, { bg: string; border: string }> = {
  classic: { bg: 'bg-brand-bg', border: 'border-brand' },
  low: { bg: 'bg-[#0C1F16]', border: 'border-[#2ED47A]' },
  medium: { bg: 'bg-gold-bg', border: 'border-gold' },
  high: { bg: 'bg-danger-bg', border: 'border-danger' },
};

function RailChip({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[7px] border border-line-2 bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-ink-2 transition-colors duration-150 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function clampBet(n: number) {
  if (!Number.isFinite(n)) return LIMITS.minBet;
  return Math.max(LIMITS.minBet, Math.min(LIMITS.maxBet, Math.floor(n)));
}
