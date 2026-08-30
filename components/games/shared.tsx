'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { LIMITS } from '@/lib/games';
import { Button, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { CoinMark } from '@/components/ui/marks';
import { CopyButton } from '@/components/ui/CopyButton';
import type { GameSlug } from '@/lib/types';

/* -------------------------------------------------------------------------- */
/* The session hook                                                           */
/* -------------------------------------------------------------------------- */

export type GameState = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousServerSeed?: string;
  previousServerSeedHash?: string;
  balance: number;
  wageredToday: number;
  netToday: number;
  rounds: Array<{
    id: string; game: GameSlug; bet: number; multiplier: number; payout: number;
    nonce: number; outcome: unknown; createdAt: string;
  }>;
};

export type PlayResult = {
  multiplier: number;
  payout: number;
  bet: number;
  nonce: number;
  outcome: Record<string, unknown>;
};

export function useGame(game: GameSlug) {
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [result, setResult] = useState<PlayResult | null>(null);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    fetch('/api/games/seed')
      .then(async (r) => {
        // The endpoints are authenticated, so this is the ordinary path for
        // anyone not signed in — not an error to apologise for.
        if (r.status === 401) {
          setSignedOut(true);
          return null;
        }
        return r.json();
      })
      .then((data) => { if (data) setState(data); })
      .catch(() => setError('Could not reach the server. Nothing has been staked.'));
  }, []);

  /**
   * One idempotency key per intended round, generated before the request and
   * cleared only once the round settles. A repeated tap while a round is in
   * flight reuses it, so the server returns the same round rather than opening
   * a second one.
   */
  const play = useCallback(
    async (payload: Record<string, unknown> & { bet: number }) => {
      if (busy) return null;
      setBusy(true);
      setError(null);

      if (!keyRef.current) {
        keyRef.current = `${game}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }

      try {
        const response = await fetch('/api/games/play', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, game, idempotencyKey: keyRef.current }),
        });
        const data = await response.json();

        if (!data.ok) {
          if (data.error === 'not-signed-in') setSignedOut(true);
          setError(messageFor(data));
          keyRef.current = null;
          return null;
        }

        setState((prev) => (prev ? {
          ...prev,
          balance: data.balance,
          wageredToday: data.wageredToday,
          netToday: data.netToday,
          nonce: data.nextNonce,
          rounds: [data.round, ...prev.rounds].slice(0, 20),
        } : prev));

        const settled: PlayResult = {
          multiplier: data.round.multiplier,
          payout: data.round.payout,
          bet: data.round.bet,
          nonce: data.round.nonce,
          outcome: data.round.outcome,
        };
        setResult(settled);
        keyRef.current = null;
        return settled;
      } catch {
        // The bet is returned and the round is void — stated plainly (§39).
        setError('The round could not be completed. Your bet was not taken.');
        keyRef.current = null;
        return null;
      } finally {
        setBusy(false);
      }
    },
    [busy, game],
  );

  const rotate = useCallback(async (clientSeed?: string) => {
    const response = await fetch('/api/games/seed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientSeed }),
    });
    const data = await response.json();
    setState((prev) => (prev ? {
      ...prev,
      serverSeedHash: data.serverSeedHash,
      clientSeed: data.clientSeed,
      nonce: data.nonce,
      previousServerSeed: data.revealedServerSeed,
      previousServerSeedHash: data.revealedServerSeedHash,
    } : prev));
  }, []);

  return { state, busy, error, signedOut, result, play, rotate, setResult };
}

function messageFor(data: { error: string; limit?: number; shortfall?: number; remaining?: number; detail?: string }) {
  switch (data.error) {
    case 'not-signed-in':
      return 'Sign in with Discord to play — coins belong to an account.';
    case 'insufficient-coins':
      return `Not enough coins — you are ${coins(data.shortfall ?? 0)} MC short.`;
    case 'bet-below-minimum':
      return `Minimum bet is ${coins(data.limit ?? 0)} MC.`;
    case 'bet-above-maximum':
      return `Maximum bet is ${coins(data.limit ?? 0)} MC.`;
    default:
      return data.detail ?? 'That round could not be played.';
  }
}

/* -------------------------------------------------------------------------- */
/* Bet rail                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The same rail on all four games (UI Spec §35). The amount is always in the
 * button label so nobody misclicks a bet size.
 */
export function BetRail({
  bet,
  setBet,
  state,
  busy,
  onPlay,
  disabled,
  disabledReason,
  children,
  skipAnimation,
  setSkipAnimation,
}: {
  bet: number;
  setBet: (n: number) => void;
  state: GameState | null;
  busy: boolean;
  onPlay: () => void;
  disabled?: boolean;
  disabledReason?: string;
  children?: React.ReactNode;
  skipAnimation?: boolean;
  setSkipAnimation?: (v: boolean) => void;
}) {
  const balance = state?.balance ?? 0;
  const short = Boolean(state) && bet > balance;
  const blocked = disabled || short || busy || !state;

  // The unloaded case comes first: before the session arrives we know nothing
  // about the balance, and guessing reads as a refusal to someone who has done
  // nothing wrong.
  const label =
    !state ? 'Loading…'
    : short ? `Not enough coins — ${coins(bet - balance)} short`
    : disabled ? (disabledReason ?? 'Not ready')
    : busy ? 'Playing…'
    : `Play for ${coins(bet)} MC`;

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-4 p-5">
          <div>
            <Label className="mb-1.5">Bet amount</Label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                min={LIMITS.minBet}
                max={LIMITS.maxBet}
                value={bet}
                onChange={(e) => setBet(clamp(Number(e.target.value)))}
                className="flex-1"
              />
              <RailButton onClick={() => setBet(clamp(Math.floor(bet / 2)))}>½</RailButton>
              <RailButton onClick={() => setBet(clamp(bet * 2))}>2×</RailButton>
              <RailButton onClick={() => setBet(clamp(Math.min(LIMITS.maxBet, balance)))}>Max</RailButton>
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-faint">
              {LIMITS.minBet}–{LIMITS.maxBet} MC per round · max win {coins(LIMITS.maxWinPerRound)} MC
            </p>
          </div>

          {children}

          <Button full size="lg" onClick={onPlay} disabled={blocked} className="h-[52px]">
            {label}
          </Button>

          {setSkipAnimation ? (
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={skipAnimation}
                onChange={(e) => setSkipAnimation(e.target.checked)}
                className="size-4 accent-[#2B8FFF]"
              />
              Skip the animation
            </label>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function RailButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 shrink-0 rounded-[3px] border border-line-2 bg-surface-2 px-3 font-mono text-[12px] text-ink-2 transition-colors duration-150 hover:border-brand hover:text-brand"
    >
      {children}
    </button>
  );
}

function clamp(n: number) {
  if (!Number.isFinite(n)) return LIMITS.minBet;
  return Math.max(LIMITS.minBet, Math.min(LIMITS.maxBet, Math.floor(n)));
}

/* -------------------------------------------------------------------------- */
/* Result panel                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Wins and losses use the same panel. A loss is stated plainly and never
 * dressed up with a consolation animation (§34).
 */
export function ResultPanel({
  label,
  payout,
  bet,
  multiplier,
  won,
  className,
}: {
  label: string;
  payout: number;
  bet: number;
  multiplier: number;
  won: boolean;
  className?: string;
}) {
  return (
    <Card tone={won ? 'gold' : 'default'} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <Label className={won ? 'mb-2 text-gold/70' : 'mb-2'}>{label}</Label>
          <span className="flex items-baseline gap-3">
            <Num tone={won ? 'gold' : 'muted'} className="text-[30px] font-medium leading-none lg:text-[34px]">
              {won ? `+${coins(payout)}` : '0'}
            </Num>
            {won ? <CoinMark size={18} /> : null}
          </span>
        </div>
        <Num tone="muted" className="text-[13px]">
          {multiplier > 0 ? `${multiplier.toFixed(2)}× on ${coins(bet)}` : `0× on ${coins(bet)}`}
        </Num>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Fairness drawer                                                            */
/* -------------------------------------------------------------------------- */

/** Spans the full width below every game (§34). */
export function FairnessDrawer({
  state,
  game,
  onRotate,
}: {
  state: GameState | null;
  game: GameSlug;
  onRotate: (clientSeed?: string) => Promise<void>;
}) {
  const [clientSeed, setClientSeed] = useState('');
  const [open, setOpen] = useState(false);

  if (!state) return null;

  return (
    <Card className="mt-6">
      <div className="grid gap-px bg-line md:grid-cols-3 [&>div]:bg-surface">
        <SeedCell label="Server seed hash" value={state.serverSeedHash} truncate />
        <SeedCell label="Client seed" value={state.clientSeed} truncate />
        <div className="min-w-0 px-5 py-4">
          <Label className="mb-1.5">Nonce</Label>
          <Num className="text-[15px]">{state.nonce}</Num>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-4">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <RotateCw size={14} />
          Rotate seed
        </Button>
        <Link
          href={`/verify?game=${game}&clientSeed=${encodeURIComponent(state.clientSeed)}&nonce=${Math.max(0, state.nonce - 1)}`}
          className="inline-flex h-8 items-center rounded-[3px] border border-line-2 px-3 text-[12.5px] text-ink-2 transition-colors duration-150 hover:border-brand hover:text-brand"
        >
          Verify a round
        </Link>
        <p className="ml-auto max-w-lg text-[12.5px] leading-relaxed text-muted">
          The hash above commits the server to a seed it cannot change afterwards. Rotate it and the
          old seed is revealed, so every round you played on it can be recomputed by anyone.
        </p>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-line px-5 py-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <Label className="mb-1.5">New client seed (optional)</Label>
              <Input
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                placeholder={state.clientSeed}
              />
            </div>
            <Button
              onClick={async () => {
                await onRotate(clientSeed || undefined);
                setClientSeed('');
              }}
            >
              Rotate now
            </Button>
          </div>
          <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted">
            Rotating resets the nonce to zero on the new pair. Your old rounds stay verifiable
            forever against the revealed seed.
          </p>
        </div>
      ) : null}

      {state.previousServerSeed ? (
        <div className="border-t border-line px-5 py-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3"
            onClick={() => setOpen((v) => v)}
          >
            <Label className="text-gold">Previous server seed — revealed</Label>
            <ChevronDown size={14} className="text-muted" aria-hidden />
          </button>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[3px] border border-gold-line bg-gold-bg px-3 py-2 font-mono text-[12px] text-gold">
              {state.previousServerSeed}
            </code>
            <CopyButton value={state.previousServerSeed} compact />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function SeedCell({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    /* `min-w-0` is load-bearing: a grid item defaults to min-width:auto, so
       without it the cell refuses to shrink below the 64-character seed hash
       and pushes the whole page into a horizontal scroll on a phone. */
    <div className="min-w-0 px-5 py-4">
      <Label className="mb-1.5">{label}</Label>
      <div className="flex items-center gap-2">
        <code className={cn('min-w-0 flex-1 font-mono text-[12px] text-ink-2', truncate && 'truncate')}>
          {value}
        </code>
        <CopyButton value={value} compact label="" />
      </div>
    </div>
  );
}

/** A round that failed: the bet is returned, and it is said plainly (§39). */
export function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-[3px] border border-danger-line bg-danger-bg px-4 py-3 text-[13.5px] text-danger">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Signed out                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What a game shows when there is no session. The endpoints refuse anyway; this
 * explains why rather than leaving the controls sitting there inert.
 */
export function SignInToPlay({ game }: { game: string }) {
  return (
    <div className="grid place-items-center py-16">
      <Card className="w-full max-w-md p-7 text-center">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">{game}</p>
        <h2 className="display mt-3 text-[26px] leading-none text-ink">Sign in to play</h2>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
          Rounds are played with Matty Coins, and coins belong to an account. Sign in with Discord
          and your balance, your seed pair and your round history follow you.
        </p>
        <Link
          href="/api/auth/signin?callbackUrl=%2Fgames"
          className="mt-6 flex h-11 items-center justify-center gap-2 rounded-[8px] bg-discord text-[14px] font-medium text-white transition-[filter] duration-150 hover:brightness-110"
        >
          Sign in with Discord
        </Link>
        <p className="mt-4 font-mono text-[11px] leading-relaxed text-faint">
          The paytables, the RTP and the verifier stay readable without an account.
        </p>
      </Card>
    </div>
  );
}
