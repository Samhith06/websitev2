'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { CoinMark, PlatformMark } from '@/components/ui/marks';
import type { LedgerEntry, Viewer } from '@/lib/types';


/**
 * The phone layout for the profile.
 *
 * The reference this follows is a real-money sportsbook, so two of its blocks
 * are deliberately absent: there is no wallet with a withdrawable balance and
 * no deposit. Matty Coins cannot be bought or cashed out, and a profile that
 * implied otherwise would undo the one decision keeping this site promotional
 * (Master Plan §12).
 */
export function ProfileMobile({
  viewer,
  ledger,
  tier,
  live,
}: {
  viewer: Viewer;
  ledger: LedgerEntry[];
  tier: string;
  live: boolean;
}) {
  const [razed, setRazed] = useState('');
  const wins = ledger.filter((e) => e.kind === 'game' && e.delta > 0).length;
  const losses = ledger.filter((e) => e.kind === 'game' && e.delta < 0).length;

  return (
    <div className="px-[18px] py-8 lg:hidden">
      {/* ------------------------------------------------------------- */}
      {/* Header                                                        */}
      {/* ------------------------------------------------------------- */}
      <section className="mb-8 flex flex-col items-center">
        <div className="relative mb-4 size-24 rounded-full border-2 border-brand p-1 shadow-[0_0_20px_rgba(43,143,255,0.28)]">
          <span className="grid size-full place-items-center rounded-full bg-brand-bg text-[26px] font-bold uppercase text-brand">
            {viewer.discordUsername.slice(0, 2)}
          </span>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-brand-ink">
            {tier}
          </span>
        </div>
        <p className="display text-[26px] leading-none text-ink [text-shadow:0_0_10px_rgba(43,143,255,0.4)]">
          {viewer.discordUsername}
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {live ? `Earning ${viewer.multiplier.value} MC / 3 min` : 'Earning paused — stream offline'}
        </p>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* Stats                                                         */}
      {/* ------------------------------------------------------------- */}
      <section className="mb-8 grid grid-cols-3 gap-2">
        <Stat label="Balance" value={coins(viewer.balance)} tone="brand" />
        <Stat label="Wins" value={String(wins)} tone="gold" />
        <Stat label="Losses" value={String(losses)} tone="muted" />
      </section>

      {/* ------------------------------------------------------------- */}
      {/* Account settings                                              */}
      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionHeading>Account settings</SectionHeading>

        <div className="flex flex-col gap-3">
          {/* Kick */}
          <Card className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#53FC18]">
                <span className="font-mono text-[13px] font-bold text-black">K</span>
              </span>
              <span className="text-[14px] text-ink">Kick account</span>
            </span>
            {viewer.kick ? (
              <span className="flex items-center gap-1.5 text-[#53FC18]">
                <BadgeCheck size={15} aria-hidden />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em]">Connected</span>
              </span>
            ) : (
              <Link href="#security" className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                Link now
              </Link>
            )}
          </Card>

          {/* Discord */}
          <Card className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-discord">
                <PlatformMark platform="discord" size={16} className="text-white" />
              </span>
              <span className="text-[14px] text-ink">Discord</span>
            </span>
            <span className="flex items-center gap-1.5 text-brand">
              <BadgeCheck size={15} aria-hidden />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]">Signed in</span>
            </span>
          </Card>

          {/* Razed username — used only to verify a leaderboard claim. */}
          <Card className="p-4">
            <label
              htmlFor="razed-username-mobile"
              className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
            >
              Razed username
            </label>
            <input
              id="razed-username-mobile"
              value={razed}
              onChange={(e) => setRazed(e.target.value)}
              placeholder="exactly as it appears on Razed"
              className="w-full rounded-[8px] border border-line bg-bg p-3 text-[14px] text-ink outline-none transition-colors duration-150 placeholder:text-faint focus:border-brand"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              Saved only so a moderator can check a leaderboard claim against Razed&rsquo;s figures.
              It does not link accounts and does not affect your position.
            </p>
          </Card>

          {/* Coins — not a wallet */}
          <Card className="p-4">
            <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Matty Coins
            </span>
            <Row label="Balance" value={coins(viewer.balance)} tone="brand" />
            <Row label="Lifetime earned" value={coins(viewer.lifetimeEarned)} />
            <Row label="Earned this week" value={coins(viewer.earnedThisWeek)} />
            <p className="mt-3 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed text-faint">
              Earned by watching. Cannot be bought, sold or withdrawn.
            </p>
          </Card>
        </div>
      </section>

    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[10px] border border-line bg-brand/[0.04]', className)}>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 border-b border-line pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
      {children}
    </h2>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'gold' | 'muted';
}) {
  const tones = { brand: 'text-brand', gold: 'text-gold', muted: 'text-ink-2' } as const;
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-line bg-brand/[0.04] px-2 py-3.5">
      <span className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      <span className={cn('font-mono text-[19px] tabular-nums', tones[tone])}>{value}</span>
    </div>
  );
}

function Row({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'brand' }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13.5px] text-ink-2">{label}</span>
      <span className="flex items-center gap-1.5">
        <CoinMark size={12} />
        <span
          className={cn('font-mono text-[13px] tabular-nums', tone === 'brand' ? 'text-brand' : 'text-ink')}
        >
          {value}
        </span>
      </span>
    </div>
  );
}
