'use client';

import { useEffect, useState } from 'react';
import { Hash, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { LIMBO_MAX_TARGET, LIMBO_MIN_TARGET, LIMITS, limboChance } from '@/lib/games';
import { CoinMark } from '@/components/ui/marks';
import { readSoundPreference, sounds, writeSoundPreference } from '@/lib/sound';
import { FairnessDrawer, SignInToPlay, useGame } from './shared';

type Outcome = { result: number; target: number; won: boolean };

/**
 * Limbo — a target, one button, and a single number that counts up and stops.
 *
 * The history strip along the bottom of the canvas is the one history display
 * that earns its place on these screens, because limbo players read streaks.
 * It shows the round's own result, coloured by whether it cleared, rather than
 * a bare tick.
 */
export function Limbo() {
  const { state, busy, error, signedOut, result, play, rotate } = useGame('limbo');

  const [bet, setBet] = useState(20);
  const [target, setTarget] = useState('2.00');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [soundOn, setSoundOn] = useState(false);
  const [display, setDisplay] = useState(1);

  useEffect(() => setSoundOn(readSoundPreference()), []);

  const parsedTarget = Number(target) || 0;
  const validTarget = parsedTarget >= LIMBO_MIN_TARGET && parsedTarget <= LIMBO_MAX_TARGET;
  const chance = validTarget ? limboChance(parsedTarget) : 0;
  const outcome = result?.outcome as Outcome | undefined;
  const profit = validTarget ? Math.max(0, Math.round(bet * parsedTarget) - bet) : 0;

  /** Counts up fast and stops. Under a second — this is not a suspense device. */
  useEffect(() => {
    if (!outcome) return;
    const final = outcome.result;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 620);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(1 + (final - 1) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else if (soundOn) outcome.won ? sounds.win(outcome.target >= 10) : sounds.settle();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const balance = state?.balance ?? 0;
  const short = Boolean(state) && bet > balance;
  const blocked = !state || short || busy || !validTarget;

  const history = state?.rounds.filter((r) => r.game === 'limbo').slice(0, 14) ?? [];

  if (signedOut) return <SignInToPlay game="Limbo" />;

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ================================================================ */}
        {/* Betting sidebar                                                  */}
        {/* ================================================================ */}
        <div className="relative flex w-full shrink-0 flex-col rounded-[12px] border border-line bg-brand/[0.03] p-3 backdrop-blur-sm lg:w-80">
          {/* Manual / auto */}
          <div className="mb-5 flex rounded-[8px] bg-surface-2 p-1">
            {(['manual', 'auto'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'flex-1 rounded-[6px] py-1.5 text-center font-mono text-[11.5px] transition-colors duration-150',
                  mode === m ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink-2',
                )}
              >
                {m === 'manual' ? 'Manual' : 'Auto'}
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-col gap-5">
            {mode === 'auto' ? (
              <div className="rounded-[8px] border border-gold-line bg-gold-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-2">
                <span className="text-gold">Auto is switched off.</span> Rounds that keep firing
                while nobody is watching are the ones people regret.
              </div>
            ) : null}

            {/* Bet amount */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Bet amount
                </label>
                <span className="font-mono text-[11.5px] tabular-nums text-ink-2">
                  {coins(balance)} MC
                </span>
              </div>
              <div className="flex rounded-[8px] border border-line-2 bg-bg transition-all duration-150 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(43,143,255,0.2)]">
                <span className="grid w-9 shrink-0 place-items-center">
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
                <div className="flex items-center gap-1 pr-1.5">
                  <MiniBtn onClick={() => setBet(clampBet(Math.floor(bet / 2)))}>½</MiniBtn>
                  <MiniBtn onClick={() => setBet(clampBet(bet * 2))}>x2</MiniBtn>
                </div>
              </div>
            </div>

            {/* Target multiplier */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Target multiplier
              </label>
              <div
                className={cn(
                  'flex overflow-hidden rounded-[8px] border bg-bg transition-all duration-150',
                  validTarget
                    ? 'border-line-2 focus-within:border-brand focus-within:shadow-[0_0_0_2px_rgba(43,143,255,0.2)]'
                    : 'border-danger/60',
                )}
              >
                <input
                  type="number"
                  step="0.01"
                  min={LIMBO_MIN_TARGET}
                  value={target}
                  disabled={busy}
                  aria-label="Target multiplier"
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[17px] tabular-nums text-ink outline-none"
                />
                <span className="grid w-10 shrink-0 place-items-center bg-surface-2 font-mono text-[13px] text-muted">
                  x
                </span>
              </div>
              {!validTarget ? (
                <p className="mt-1.5 font-mono text-[10.5px] text-danger">
                  Between {LIMBO_MIN_TARGET} and {coins(LIMBO_MAX_TARGET)}
                </p>
              ) : null}
            </div>

            {/* Win chance — derived, never typed into */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Win chance
              </label>
              <div className="flex overflow-hidden rounded-[8px] border border-line bg-bg opacity-80">
                <span className="w-full min-w-0 flex-1 px-3 py-2.5 font-mono text-[17px] tabular-nums text-ink">
                  {chance > 0 ? chance.toFixed(4) : '—'}
                </span>
                <span className="grid w-10 shrink-0 place-items-center font-mono text-[13px] text-muted">
                  %
                </span>
              </div>
            </div>

            {/* Profit on win */}
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Profit on win
              </label>
              <div className="flex items-center gap-2 rounded-[8px] border border-line bg-bg px-3 py-2.5">
                <CoinMark size={15} />
                <span className="font-mono text-[17px] tabular-nums text-gold">{coins(profit)}</span>
              </div>
            </div>

            {error ? (
              <div className="rounded-[8px] border border-danger-line bg-danger-bg px-3 py-2.5 text-[12.5px] text-danger">
                {error}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => play({ bet, target: parsedTarget })}
            disabled={blocked}
            className={cn(
              'mt-5 w-full rounded-[10px] bg-brand py-4 text-[22px] uppercase tracking-wider text-brand-ink',
              'shadow-[0_0_15px_rgba(43,143,255,0.5)] transition-all duration-150',
              'hover:bg-brand-dim active:scale-[0.98]',
              'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
            )}
          >
            {!state ? 'Loading' : short ? 'Not enough coins' : busy ? 'Rolling' : 'Bet'}
          </button>
        </div>

        {/* ================================================================ */}
        {/* Canvas                                                           */}
        {/* ================================================================ */}
        <div className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-[12px] border border-line bg-bg/80 backdrop-blur-md">
          <span
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(43,143,255,0.16),rgba(7,11,20,0.9)_60%,rgba(7,11,20,1))]"
            aria-hidden
          />

          {/* Canvas top bar */}
          <div className="relative z-10 flex items-center justify-between p-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/80 px-3 py-1.5 font-mono text-[11px] tabular-nums text-ink-2">
              <Hash size={12} className="text-brand" aria-hidden />
              Round {state ? state.nonce + 1 : '—'}
            </span>
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
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5',
                'font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150',
                soundOn
                  ? 'border-brand-line bg-brand-bg text-brand'
                  : 'border-line bg-surface-2/80 text-faint hover:text-ink-2',
              )}
            >
              {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              Sound
            </button>
          </div>

          {/* The number */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
            <span
              className={cn(
                'display flex items-baseline leading-none tabular-nums',
                'text-[64px] sm:text-[92px] lg:text-[120px]',
                outcome
                  ? outcome.won
                    ? 'text-gold [text-shadow:0_0_20px_rgba(255,185,59,0.8),0_0_40px_rgba(255,185,59,0.45)]'
                    : 'text-muted'
                  : 'text-brand [text-shadow:0_0_20px_rgba(43,143,255,0.8),0_0_40px_rgba(43,143,255,0.5)]',
              )}
            >
              {(outcome ? display : 1).toFixed(2)}
              <span className="ml-2 text-[0.5em] opacity-80">x</span>
            </span>

            <span className="mt-4 rounded-full border border-line bg-surface-2/70 px-4 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.16em] text-ink-2">
              Target: {validTarget ? parsedTarget.toFixed(2) : '—'}x
            </span>
          </div>

          {/* History, pinned to the bottom of the canvas */}
          <div className="no-scrollbar relative z-10 flex items-center gap-1.5 overflow-x-auto border-t border-line bg-surface/70 p-2 backdrop-blur">
            {history.length === 0 ? (
              <span className="px-2 py-1 font-mono text-[11.5px] text-faint">
                The last fourteen results appear here.
              </span>
            ) : (
              history.map((round) => {
                const o = round.outcome as Outcome;
                const won = round.payout > 0;
                return (
                  <span
                    key={round.id}
                    title={`Target ${o.target.toFixed(2)}x`}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-[5px] border px-2.5 py-1.5 font-mono text-[12px] tabular-nums',
                      // Gold reads as money and grey reads as nothing, which is
                      // exactly what a cleared and a missed round are.
                      won
                        ? 'border-gold/45 bg-gold/15 font-medium text-gold'
                        : 'border-line bg-surface-2 text-faint',
                    )}
                  >
                    <span className={cn('size-1 shrink-0 rounded-full', won ? 'bg-gold' : 'bg-faint')} aria-hidden />
                    {o.result.toFixed(2)}x
                    <span className="sr-only">{won ? ' cleared' : ' missed'}</span>
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>

      <FairnessDrawer state={state} game="limbo" onRotate={rotate} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[5px] bg-surface-2 px-2.5 py-1 font-mono text-[11.5px] text-ink-2 transition-colors duration-150 hover:bg-line-2 hover:text-ink"
    >
      {children}
    </button>
  );
}

function clampBet(n: number) {
  if (!Number.isFinite(n)) return LIMITS.minBet;
  return Math.max(LIMITS.minBet, Math.min(LIMITS.maxBet, Math.floor(n)));
}
