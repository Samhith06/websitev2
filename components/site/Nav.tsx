'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { CoinMark, PlatformMark } from '@/components/ui/marks';
import type { Viewer } from '@/lib/types';

const BASE_LINKS = [
  { href: '/giveaways', label: 'Giveaways' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/shop', label: 'Shop' },
  { href: '/clips', label: 'Community' },
];

/** Secondary destinations live in the drawer and the footer, not the top row. */
const MORE_LINKS = [
  { href: '/wins', label: 'Wall of fame' },
  { href: '/casinos', label: 'Razed' },
  { href: '/verify', label: 'Verify a round' },
  { href: '/official', label: 'Official accounts' },
];

/**
 * Games is visible to everyone, and disappears the moment someone
 * self-excludes (§32, §39).
 *
 * It used to require being signed in, which made the link and the page
 * disagree: /games was public and rendered the full lobby, so the games were
 * reachable but undiscoverable. Sign-in is not what protects this — the age
 * gate runs before anything renders, and every play endpoint refuses an
 * unauthenticated request server-side. Hiding the link only hid it from the
 * people it was built for.
 *
 * The self-exclusion half is the part that must not be relaxed: once someone
 * has switched games off, the link goes for them and stays gone.
 */
function linksFor(viewer: Viewer) {
  const gamesVisible = viewer.games.enabled && !viewer.games.excludedUntil;
  return gamesVisible ? [...BASE_LINKS, { href: '/games', label: 'Games' }] : BASE_LINKS;
}

export type Account = {
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export function Nav({
  live,
  viewer,
  account,
}: {
  live: boolean;
  viewer: Viewer;
  /** The real Discord session, or null when signed out. */
  account?: Account | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = linksFor(viewer);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/92 backdrop-blur-sm">
      {/* Three columns so the links sit centred regardless of what flanks them. */}
      <nav className="container-page grid h-[58px] grid-cols-[auto_1fr_auto] items-center gap-4 lg:h-[68px]">
        <Link href="/" className="display text-[20px] leading-none tracking-tight lg:text-[23px]" aria-label="MattySpins, home">
          <span className="text-ink">MATTY</span>
          <span className="text-brand">SPINS</span>
        </Link>

        <ul className="hidden items-center justify-center gap-8 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'relative block py-[22px] text-[14.5px] transition-colors duration-150',
                  isActive(link.href) ? 'text-ink' : 'text-ink-2 hover:text-ink',
                )}
              >
                {link.label}
                {isActive(link.href) ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" aria-hidden />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        <div className="col-start-3 flex items-center gap-2">
          <LivePill live={live} />

          {account?.isAdmin ? (
            <Link
              href="/admin"
              className="hidden h-9 items-center rounded-[6px] border border-gold-line bg-gold-bg px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-gold transition-colors duration-150 hover:border-gold lg:inline-flex"
            >
              Admin
            </Link>
          ) : null}

          <div className="hidden lg:block">
            {account ? (
              <Link
                href="/me"
                className="flex h-9 items-center gap-2.5 rounded-[6px] border border-line-2 bg-surface pl-1.5 pr-3 transition-colors duration-150 hover:border-brand"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-[4px] bg-brand-bg text-[10px] font-semibold uppercase text-brand">
                  {account.username.slice(0, 2)}
                </span>
                <span className="text-[13.5px] text-ink-2">{account.username}</span>
                <span className="flex items-center gap-1 border-l border-line pl-2.5">
                  <CoinMark size={13} />
                  <span className="font-mono text-[12.5px] tabular-nums text-brand">{coins(viewer.balance)}</span>
                </span>
              </Link>
            ) : (
              <Link
                href="/api/auth/signin?callbackUrl=%2F"
                className="flex h-9 items-center gap-2 rounded-[6px] border border-line-2 bg-surface px-3.5 text-[13.5px] text-ink transition-colors duration-150 hover:border-brand hover:text-brand-dim"
              >
                <PlatformMark platform="discord" size={15} />
                Sign in with Discord
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid size-10 place-items-center rounded-[6px] border border-line bg-surface text-ink-2 lg:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 top-[58px] z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-bg/70"
          />
          <div className="absolute inset-y-0 right-0 w-[min(320px,88vw)] overflow-y-auto border-l border-line bg-surface">
            <ul className="p-4">
              {[...links, ...MORE_LINKS].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      'flex h-12 items-center border-b border-line text-[16px]',
                      isActive(link.href) ? 'text-brand' : 'text-ink-2',
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="p-4">
              {account?.isAdmin ? (
                <Link
                  href="/admin"
                  className="mb-3 flex h-11 items-center justify-center rounded-[6px] border border-gold-line bg-gold-bg font-mono text-[12px] uppercase tracking-[0.14em] text-gold"
                >
                  Admin dashboard
                </Link>
              ) : null}
              {account ? (
                <Link href="/me" className="block rounded-[6px] border border-brand-line bg-brand-bg p-4">
                  <div className="text-[15px] text-ink">{account.username}</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <CoinMark size={16} />
                    <span className="font-mono text-[18px] tabular-nums text-brand">{coins(viewer.balance)}</span>
                    <span className="font-mono text-[12px] text-muted">MC</span>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/api/auth/signin?callbackUrl=%2F"
                  className="flex h-12 items-center justify-center gap-2 rounded-[6px] border border-line-2 bg-surface-2 text-[15px] text-ink"
                >
                  <PlatformMark platform="discord" size={16} />
                  Sign in with Discord
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

/**
 * Live reads as a solid brand pill; offline drops to a plain bordered one. The
 * dot pulses only while live, and stops entirely under reduced-motion.
 */
function LivePill({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-[6px] px-3 font-mono text-[11px] uppercase tracking-[0.14em]',
        live
          ? 'border border-online-line bg-online-bg text-online'
          : 'border border-line bg-surface text-faint',
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          live ? 'animate-pulse-online bg-online' : 'bg-faint',
        )}
        aria-hidden
      />
      {live ? 'Live now' : 'Offline'}
    </span>
  );
}
