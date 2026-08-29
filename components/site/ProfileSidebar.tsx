'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CircleHelp, Coins, Gift, LayoutDashboard, LogOut, Settings, ShieldCheck, Trophy,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { PlatformMark } from '@/components/ui/marks';

const SECTIONS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'coins', label: 'Coin history', Icon: Coins },
  { id: 'redemptions', label: 'Redemptions', Icon: Gift },
  { id: 'claims', label: 'Prize claims', Icon: Trophy },
  { id: 'limits', label: 'Play settings', Icon: Settings },
  { id: 'security', label: 'Account', Icon: ShieldCheck },
];

/**
 * A docked sub-navigation for the account area, scoped to this page rather than
 * bolted on as a second site-wide navigation. It tracks which section is on
 * screen so the highlight follows the scroll instead of only responding to
 * clicks.
 */
export function ProfileSidebar({
  username,
  tier,
  discordInvite,
}: {
  username: string;
  tier: string;
  discordInvite: string;
}) {
  const [active, setActive] = useState('overview');

  useEffect(() => {
    const targets = SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const onScreen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (onScreen) setActive(onScreen.target.id);
      },
      // Bias towards the top of the viewport, under the sticky nav.
      { rootMargin: '-80px 0px -55% 0px', threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <aside className="lg:sticky lg:top-[84px]">
      <div className="rounded-[12px] border border-line bg-surface p-4">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-bg text-[14px] font-bold uppercase text-brand">
            {username.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-ink">{username}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">{tier}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label, Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? 'true' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[13.5px] transition-colors duration-150',
                active === id
                  ? 'bg-brand-bg font-medium text-brand'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              <Icon size={16} strokeWidth={1.9} className="shrink-0" />
              {label}
            </a>
          ))}
        </nav>

        <a
          href={discordInvite}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-discord font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-[filter] duration-150 hover:brightness-110"
        >
          <PlatformMark platform="discord" size={15} />
          Join Discord
        </a>

        <div className="mt-4 flex flex-col gap-0.5 border-t border-line pt-3">
          <Link
            href="/official"
            className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <CircleHelp size={15} strokeWidth={1.9} />
            Is this really Matty?
          </Link>
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] text-danger transition-colors duration-150 hover:bg-surface-2"
          >
            <LogOut size={15} strokeWidth={1.9} />
            Sign out
          </Link>
        </div>
      </div>
    </aside>
  );
}
