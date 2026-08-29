'use client';

import { useEffect, useState } from 'react';
import { Info, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { LIMITS, diceChance, diceMultiplier } from '@/lib/games';
import { CoinMark } from '@/components/ui/marks';
import { readSoundPreference, sounds, writeSoundPreference } from '@/lib/sound';
import { FairnessDrawer, SignInToPlay, useGame } from './shared';

type Outcome = { roll: number; target: number; direction: 'over' | 'under'; won: boolean; chance: number };

/**
 * Dice — one relationship, shown three ways.
 *
 * Target, win chance and payout multiplier move together, so they sit side by
 * side under the track at the same size. Changing any one of them is changing
 * the same decision, and the screen should make that obvious.
 */
export function Dice() {
  const { state, busy, error, signedOut, result, play, rotate } = useGame('dice');

  const [bet, setBet] = useState(20);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [soundOn, setSoundOn] = useState(false);
  const [display, setDisplay] = useState(50);

  useEffect(() => setSoundOn(readSoundPreference()), []);

  const chance = diceChance(target, direction);
  const multiplier = diceMultiplier(chance);
  const outcome = result?.outcome as Outcome | undefined;
  const profit = Math.max(0, Math.round(bet * multiplier) - bet);

  /** The result counts toward its landing place rather than snapping to it. */
  useEffect(() => {
    if (!outcome) return;
    const from = display;
    const to = outcome.roll;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else if (soundOn) outcome.won ? sounds.win(multiplier >= 10) : sounds.settle();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const balance = state?.balance ?? 0;
  const short = Boolean(state) && bet > balance;
  const blocked = !state || short || busy;

  const history = state?.rounds.filter((r) => r.game === 'dice').slice(0, 12) ?? [];

  if (signedOut) return <SignInToPlay game="Dice" />;

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-12">
        {/* ================================================================ */}
        {/* Betting panel                                                    */}
        {/* ================================================================ */}
        <div className="relative flex flex-col gap-5 rounded-[14px] border border-line bg-brand/[0.03] p-5 lg:col-span-3">
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              writeSoundPreference(next);
              if (next) sounds.pick();
            }}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
            className={cn(
              'absolute right-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5',
              'font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150',
              soundOn ? 'border-brand-line bg-brand-bg text-brand' : 'border-line bg-bg text-faint hover:text-ink-2',
            )}
          >
            {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            Sound
          </button>

          {/* Manual / auto */}
          <div className="flex border-b border-line">
            {(['manual', 'auto'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'flex-1 border-b-2 py-2 text-center font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors duration-150',
                  mode === m
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-ink-2',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === 'auto' ? (
            <div className="rounded-[8px] border border-gold-line bg-gold-bg px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
              <span className="text-gold">Auto is switched off.</span> Rounds that keep firing while
              nobody is watching are the ones people regret.
            </div>
          ) : null}

          {/* Bet amount */}
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Bet amount
              <Info size={11} className="text-faint" aria-hidden />
            </span>
            <div className="flex items-center rounded-[6px] border border-line-2 bg-surface-2 transition-colors duration-150 focus-within:border-brand">
              <span className="grid size-9 shrink-0 place-items-center">
                <CoinMark size={15} />
              </span>
              <input
                type="number"
                min={LIMITS.minBet}
                max={LIMITS.maxBet}
                value={bet}
                disabled={busy}
                aria-label="Bet amount"
                onChange={(e) => setBet(clampBet(Number(e.target.value)))}
                className="w-full min-w-0 flex-1 bg-transparent py-2.5 font-mono text-[17px] tabular-nums text-ink outline-none"
              />
              <div className="flex shrink-0 border-l border-line">
                <RailBtn onClick={() => setBet(clampBet(Math.floor(bet / 2)))}>½</RailBtn>
                <RailBtn onClick={() => setBet(clampBet(bet * 2))} border>2×</RailBtn>
              </div>
            </div>
          </div>

          {/* Profit on win */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Profit on win
            </span>
            <div className="flex items-center gap-2 rounded-[6px] border border-line bg-surface-2 px-3 py-2.5">
              <CoinMark size={15} />
              <span className="font-mono text-[17px] tabular-nums text-gold">{coins(profit)}</span>
            </div>
          </div>

          {/* Over / under */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Range type
            </span>
            <div className="grid grid-cols-2 gap-1.5 rounded-[8px] border border-line bg-surface-2 p-1">
              {(['under', 'over'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  aria-pressed={direction === d}
                  disabled={busy}
                  className={cn(
                    'rounded-[6px] py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150',
                    direction === d
                      ? 'border border-brand/50 bg-brand-bg text-brand'
                      : 'border border-transparent text-muted hover:text-ink-2',
                  )}
                >
                  Roll {d}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-[6px] border border-danger-line bg-danger-bg px-3 py-2.5 text-[12.5px] text-danger">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => play({ bet, target, direction })}
            disabled={blocked}
            className={cn(
              'mt-auto w-full rounded-[8px] bg-brand py-4 text-[19px] uppercase tracking-wide text-brand-ink',
              'shadow-[0_0_20px_rgba(43,143,255,0.2)] transition-all duration-150',
              'hover:bg-brand-dim active:scale-[0.98]',
              'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
            )}
          >
            {!state ? 'Loading' : short ? 'Not enough coins' : busy ? 'Rolling' : 'Roll dice'}
          </button>
        </div>

        {/* ================================================================ */}
        {/* Board                                                            */}
        {/* ================================================================ */}
        <div className="flex flex-col gap-5 lg:col-span-9">
          <div className="relative flex min-h-[380px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[14px] border border-line bg-brand/[0.03] p-6 lg:p-8">
            <span
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(43,143,255,0.12),transparent_70%)]"
              aria-hidden
            />

            {/* The roll, large */}
            <div className="relative z-10 mb-10 text-center">
              <span
                className={cn(
                  'display block text-[76px] leading-none tabular-nums lg:text-[112px]',
                  outcome
                    ? outcome.won
                      ? 'text-gold [text-shadow:0_0_24px_rgba(255,185,59,0.45)]'
                      : 'text-muted'
                    : 'text-ink [text-shadow:0_0_20px_rgba(43,143,255,0.45)]',
                )}
              >
                {display.toFixed(2)}
              </span>
              <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.16em] text-brand">
                Roll {direction} {target.toFixed(2)} to win
              </p>
            </div>

            {/* Track */}
            <div className="relative z-10 w-full max-w-[80%]">
              <div className="absolute left-0 right-0 top-1/2 flex h-4 -translate-y-1/2 overflow-hidden rounded-full">
                <span
                  className={cn('h-full', direction === 'over' ? 'bg-danger/20' : 'bg-brand/25')}
                  style={{ width: `${target}%` }}
                  aria-hidden
                />
                <span
                  className={cn('h-full flex-1', direction === 'over' ? 'bg-brand/25' : 'bg-danger/20')}
                  aria-hidden
                />
              </div>

              {/* Where the last roll landed. */}
              {outcome ? (
                <span
                  className={cn(
                    'absolute top-1/2 z-30 h-7 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-300',
                    outcome.won ? 'bg-gold shadow-[0_0_12px_rgba(255,185,59,0.9)]' : 'bg-ink-2',
                  )}
                  style={{ left: `${outcome.roll}%` }}
                  aria-hidden
                />
              ) : null}

              <input
                type="range"
                min={2}
                max={98}
                step={0.5}
                value={target}
                disabled={busy}
                onChange={(e) => setTarget(Number(e.target.value))}
                aria-label="Roll target"
                className="dice-range relative z-20 h-12 w-full cursor-pointer bg-transparent"
              />

              <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-faint">
                <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
              </div>
            </div>

            {/* The three figures that move together. */}
            <div className="relative z-10 mt-8 grid w-full max-w-[80%] grid-cols-3 gap-3">
              <Figure label="Multiplier" value={`${multiplier.toFixed(4)}×`} />
              <Figure label={`Roll ${direction}`} value={target.toFixed(2)} tone="brand" />
              <Figure label="Win chance" value={`${chance.toFixed(2)}%`} />
            </div>
          </div>

          {/* Recent rolls */}
          <div className="rounded-[14px] border border-line bg-brand/[0.03]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-2">
                Recent rolls
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                This session
              </span>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto p-4">
              {history.length === 0 ? (
                <span className="py-2 font-mono text-[12px] text-faint">
                  No rolls yet — the last twelve appear here.
                </span>
              ) : (
                history.map((round) => {
                  const o = round.outcome as Outcome;
                  const won = round.payout > 0;
                  return (
                    <span
                      key={round.id}
                      className={cn(
                        'flex min-w-[76px] shrink-0 items-center justify-center gap-1.5 rounded-[6px] border py-2.5 font-mono text-[14px] tabular-nums',
                        won
                          ? 'border-gold/30 bg-gold/10 font-medium text-gold'
                          : 'border-line bg-surface-2 text-faint',
                      )}
                    >
                      <span className={cn('size-1 shrink-0 rounded-full', won ? 'bg-gold' : 'bg-faint')} aria-hidden />
                      {o.roll.toFixed(2)}
                      <span className="sr-only">{won ? ' won' : ' lost'}</span>
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <FairnessDrawer state={state} game="dice" onRotate={rotate} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Figure({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'brand' }) {
  return (
    <div className="flex flex-col items-center rounded-[8px] border border-line bg-surface-2 px-3 py-3">
      <span className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-[18px] tabular-nums lg:text-[20px]',
          tone === 'brand' ? 'text-brand' : 'text-ink',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RailBtn({
  children,
  onClick,
  border,
}: {
  children: React.ReactNode;
  onClick: () => void;
  border?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2.5 font-mono text-[12px] text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-brand',
        border && 'border-l border-line',
      )}
    >
      {children}
    </button>
  );
}

function clampBet(n: number) {
  if (!Number.isFinite(n)) return LIMITS.minBet;
  return Math.max(LIMITS.minBet, Math.min(LIMITS.maxBet, Math.floor(n)));
}
