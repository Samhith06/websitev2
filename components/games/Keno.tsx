'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, Volume2, VolumeX } from 'lucide-react';
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
 * Keno — the only launch game with real interface work (UI Spec §34).
 *
 * Two panels: a control rail on the left, the board on the right, and the
 * paytable running beneath the board as a node strip indexed by hit count
 * rather than as a vertical list. The player reads "how many did I hit" left to
 * right, and every losing tier is a visible 0× rather than an omission they
 * discover after the round.
 */
export function Keno() {
  const { state, busy, error, signedOut, result, play, rotate } = useGame('keno');

  const [risk, setRisk] = useState<KenoRisk>('classic');
  const [picks, setPicks] = useState<number[]>([]);
  const [bet, setBet] = useState(20);
  const [pickCount, setPickCount] = useState(10);
  const [mode, setMode] = useState<'manual' | 'autoplay'>('manual');
  const [revealed, setRevealed] = useState<number[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  // Read the stored preference after mount so the server and first paint agree.
  useEffect(() => setSoundOn(readSoundPreference()), []);

  const outcome = result?.outcome as Outcome | undefined;
  const tableLength = Math.max(1, picks.length);
  const paytable = useMemo(() => kenoPaytable(risk, tableLength), [risk, tableLength]);
  const rtp = useMemo(() => kenoRtp(risk, tableLength), [risk, tableLength]);

  /** Under three seconds, one number at a time, each with its own note. */
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
      }, (i + 1) * 110),
    );

    // The round's verdict lands just after the last number, not on top of it.
    if (soundOn) {
      timers.push(
        setTimeout(() => {
          const payout = outcome.hits.length > 0 ? outcome.hits.length : 0;
          if (payout > 0 && result && result.payout > 0) {
            sounds.win(result.multiplier >= 10);
          } else {
            sounds.settle();
          }
        }, outcome.drawn.length * 110 + 220),
      );
    }

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
      const next = removing
        ? prev.filter((p) => p !== n)
        : prev.length >= KENO_MAX_PICKS ? prev : [...prev, n];
      if (soundOn && next.length !== prev.length) {
        removing ? sounds.unpick() : sounds.pick();
      }
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
    !state ? 'Loading' : short ? 'Not enough coins' : picks.length === 0 ? 'Pick numbers' : locked ? 'Playing' : 'Play';
  const playBlocked = !state || short || picks.length === 0 || locked;

  if (signedOut) return <SignInToPlay game="Keno" />;

  return (
    <>
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* ================================================================ */}
        {/* Control rail                                                     */}
        {/* ================================================================ */}
        <aside className="relative z-10 flex w-full shrink-0 flex-col gap-5 overflow-hidden rounded-[24px] border border-line-2/40 bg-surface p-6 lg:w-80">
          <span
            className="pointer-events-none absolute -left-20 -top-20 size-40 rounded-full bg-brand/5 blur-3xl"
            aria-hidden
          />

          {/* Sound, top-right of the rail. Off until asked for. */}
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
            title={soundOn ? 'Sound on' : 'Sound off'}
            className={cn(
              'absolute right-4 top-4 z-20 inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5',
              'font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150',
              soundOn
                ? 'border-brand-line bg-brand-bg text-brand'
                : 'border-line bg-bg text-faint hover:text-ink-2',
            )}
          >
            {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            Sound
          </button>

          {/* Mode toggle */}
          <div className="relative z-10 mx-auto flex w-48 rounded-full bg-bg p-1">
            {(['manual', 'autoplay'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'flex-1 rounded-full py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-150',
                  mode === m ? 'bg-surface-2 text-brand shadow-sm' : 'text-muted hover:text-ink-2',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === 'autoplay' ? (
            <div className="relative z-10 rounded-[16px] border border-gold-line bg-gold-bg px-4 py-3.5 text-[13px] leading-relaxed text-ink-2">
              <span className="text-gold">Autoplay is switched off.</span> Rounds that keep firing
              while nobody is watching are the ones people regret. Play one at a time from Manual.
            </div>
          ) : null}

          {/* Bet amount */}
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
              <span className="flex items-center gap-1.5">
                Bet amount
                <Info size={12} className="text-faint" aria-hidden />
              </span>
              <span className="tabular-nums normal-case tracking-normal">
                {coins(balance)} Matty Coins
              </span>
            </div>
            <div className="flex items-center rounded-[16px] border border-line-2/60 bg-bg p-2 transition-colors duration-150 focus-within:border-brand/50">
              <span className="ml-1 grid size-6 shrink-0 place-items-center rounded-full bg-brand/10">
                <CoinMark size={14} />
              </span>
              <input
                type="number"
                min={LIMITS.minBet}
                max={LIMITS.maxBet}
                value={bet}
                disabled={locked}
                aria-label="Bet amount"
                onChange={(e) => setBet(clampBet(Number(e.target.value)))}
                className="w-full min-w-0 flex-1 bg-transparent px-2 font-mono text-[17px] tabular-nums text-ink outline-none"
              />
              <div className="flex shrink-0 gap-1 pr-1">
                <RailChip onClick={() => setBet(clampBet(Math.floor(bet / 2)))} disabled={locked}>1/2</RailChip>
                <RailChip onClick={() => setBet(clampBet(bet * 2))} disabled={locked}>2×</RailChip>
              </div>
            </div>
            <p className="font-mono text-[10px] text-faint">
              {LIMITS.minBet}–{LIMITS.maxBet} MC · max win {coins(LIMITS.maxWinPerRound)} MC
            </p>
          </div>

          {/* Risk level */}
          <div className="relative z-10 flex flex-col gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
              Risk level
            </span>
            <div
              className="flex justify-between rounded-[16px] border border-line-2/60 bg-bg p-1"
              role="tablist"
              aria-label="Risk level"
            >
              {KENO_RISKS.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={risk === level}
                  onClick={() => setRisk(level)}
                  className={cn(
                    'flex-1 rounded-[12px] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-150',
                    risk === level ? 'bg-surface-2 text-brand shadow-sm' : 'text-muted hover:text-ink-2',
                  )}
                >
                  {KENO_RISK_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          {/* Number picker */}
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-[16px] border border-brand-line/50 bg-surface-2 px-4 py-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
                Number picker
              </span>
              <button
                type="button"
                onClick={() => { setPicks([]); }}
                disabled={locked || picks.length === 0}
                className="text-[12.5px] text-ink-2 underline decoration-muted/50 underline-offset-2 transition-colors duration-150 hover:text-brand disabled:opacity-40"
              >
                Clear picks
              </button>
            </div>

            <div className="flex items-center gap-4 rounded-[16px] border border-brand-line/50 bg-surface-2 p-3">
              <span className="w-6 shrink-0 text-center font-mono text-[17px] tabular-nums text-brand">
                {picks.length || pickCount}
              </span>
              <div className="relative flex flex-1 items-center rounded-lg bg-bg py-2">
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
                  className="w-full accent-[#2B8FFF]"
                />
              </div>
              <button
                type="button"
                onClick={() => autoPick()}
                disabled={locked}
                className="shrink-0 pr-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink transition-colors duration-150 hover:text-brand disabled:opacity-40"
              >
                Pick
              </button>
            </div>
          </div>

          {/* Result reads back beside the controls that produced it. */}
          {settled && outcome ? (
            <div
              className={cn(
                'relative z-10 rounded-[16px] border px-4 py-3.5',
                result!.payout > 0 ? 'border-gold-line bg-gold-bg' : 'border-line bg-surface-2',
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                You hit {outcome.hits.length} of {outcome.picks.length}
              </span>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    'font-mono text-[26px] font-medium leading-none tabular-nums',
                    result!.payout > 0 ? 'text-gold' : 'text-muted',
                  )}
                >
                  {result!.payout > 0 ? `+${coins(result!.payout)}` : '0'}
                </span>
                <span className="font-mono text-[12px] tabular-nums text-muted">
                  {mult(result!.multiplier)} on {coins(result!.bet)}
                </span>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="relative z-10 rounded-[16px] border border-danger-line bg-danger-bg px-4 py-3 text-[13px] text-danger">
              {error}
            </div>
          ) : null}

          <div className="relative z-10 mt-auto pt-4">
            <button
              type="button"
              onClick={() => play({ bet, picks, risk })}
              disabled={playBlocked}
              className={cn(
                'w-full rounded-[16px] bg-brand py-4 text-[19px] uppercase tracking-wider text-brand-ink',
                'shadow-[0_0_20px_rgba(43,143,255,0.2)] transition-all duration-150',
                'hover:bg-brand-dim hover:shadow-[0_0_30px_rgba(43,143,255,0.4)] active:scale-[0.98]',
                'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
              )}
            >
              {playLabel}
            </button>
            {!playBlocked ? (
              <p className="mt-2 text-center font-mono text-[11px] tabular-nums text-faint">
                {coins(bet)} MC · {picks.length} pick{picks.length === 1 ? '' : 's'} ·{' '}
                {KENO_RISK_LABELS[risk]}
              </p>
            ) : null}
          </div>
        </aside>

        {/* ================================================================ */}
        {/* Board                                                            */}
        {/* ================================================================ */}
        <main className="relative flex min-w-0 flex-1 flex-col gap-8 overflow-hidden rounded-[24px] border border-line/60 bg-bg p-6 lg:p-10">
          <span
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(13,20,34,0.6),transparent_70%)]"
            aria-hidden
          />

          <div className="relative z-10 mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
              {picks.length} of {KENO_MAX_PICKS} picked
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
              {KENO_DRAWN} drawn from {KENO_BOARD} · RTP {(rtp * 100).toFixed(2)}%
            </span>
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-4xl flex-1 content-center grid-cols-5 gap-3 sm:gap-4 md:grid-cols-8">
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
                  aria-label={hit ? `${n}, hit` : drawn ? `${n}, drawn` : picked ? `${n}, picked` : `${n}`}
                  className={cn(
                    'grid aspect-square place-items-center rounded-[16px] border-2 font-mono text-[19px] tabular-nums',
                    'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25)] transition-all duration-200',
                    hit
                      ? 'border-gold bg-[radial-gradient(circle_at_center,rgba(255,185,59,0.45),rgba(255,185,59,0.9))] font-bold text-brand-ink shadow-[0_0_18px_rgba(255,185,59,0.35)]'
                      : drawn
                        ? 'border-gold/70 bg-surface-2 text-gold'
                        : picked
                          ? 'border-brand bg-[radial-gradient(circle_at_center,rgba(43,143,255,0.15),rgba(13,20,34,1))] font-bold text-brand shadow-[0_0_15px_rgba(43,143,255,0.3),inset_0_0_10px_rgba(43,143,255,0.1)]'
                          : 'border-transparent bg-surface text-white hover:bg-surface-2',
                    locked && 'cursor-default',
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* -------------------------------------------------------- */}
          {/* Multiplier node strip                                     */}
          {/* -------------------------------------------------------- */}
          <div className="relative z-10 mx-auto w-full max-w-4xl">
            <div className="no-scrollbar overflow-x-auto pb-1">
              <div
                className="relative grid min-w-max gap-1"
                style={{ gridTemplateColumns: `repeat(${paytable.length}, minmax(56px, 1fr))` }}
              >
                {/* The track sits behind the orbs, and the lit segment runs as
                    far as the hit count that actually landed. */}
                <span
                  className="pointer-events-none absolute left-[6%] right-[6%] top-[46px] h-px bg-line-2/60"
                  aria-hidden
                />
                {hitCount !== null && paytable.length > 1 ? (
                  <span
                    className="pointer-events-none absolute left-[6%] top-[46px] h-0.5 rounded-full bg-brand shadow-[0_0_8px_rgba(43,143,255,0.5)] transition-[width] duration-500"
                    style={{ width: `${(hitCount / (paytable.length - 1)) * 88}%` }}
                    aria-hidden
                  />
                ) : null}

                {paytable.map((multiplier, hits) => {
                  const active = hitCount === hits;
                  const paying = multiplier > 0;
                  return (
                    <div key={hits} className="relative flex flex-col items-center">
                      <span
                        className={cn(
                          'mb-2 flex h-7 items-center justify-center rounded-full px-3 font-mono text-[11.5px] tabular-nums',
                          active
                            ? 'border border-gold/40 bg-gold/10 text-gold'
                            : paying
                              ? 'bg-surface text-ink-2'
                              : 'bg-surface text-faint',
                        )}
                      >
                        {mult(multiplier)}
                      </span>
                      <span
                        className={cn(
                          'relative z-10 size-4 rounded-full',
                          active
                            ? 'bg-[radial-gradient(circle_at_30%_30%,#fff,#FFB93B)] shadow-[0_0_10px_rgba(255,185,59,0.8)]'
                            : 'bg-gradient-to-br from-line-2 to-surface shadow-[inset_0_2px_4px_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.5)]',
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'mt-1.5 font-mono text-[10px] tabular-nums',
                          active ? 'font-bold text-gold' : 'text-faint',
                        )}
                      >
                        {hits}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
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
      className="rounded-[12px] bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-ink-2 transition-colors duration-150 hover:bg-line-2 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function clampBet(n: number) {
  if (!Number.isFinite(n)) return LIMITS.minBet;
  return Math.max(LIMITS.minBet, Math.min(LIMITS.maxBet, Math.floor(n)));
}
